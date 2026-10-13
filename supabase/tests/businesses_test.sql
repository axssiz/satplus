-- Database tests for the «Заведения и организации» module (RLS, directory, suggestions and corrections).
-- Run against a LOCAL/STAGING database with migrations + seed.sql applied:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/businesses_test.sql
-- Everything runs in one transaction and is rolled back at the end.

\set QUIET on
\pset tuples_only on
begin;

create or replace function pg_temp.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
end $$;

create or replace function pg_temp.reset() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

create or replace function pg_temp.check(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then
    raise exception 'TEST FAILED: %', msg;
  end if;
  raise notice 'ok - %', msg;
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000aa03', 'admin@biztest.invalid'),
  ('00000000-0000-0000-0000-00000000bb03', 'mod@biztest.invalid'),
  ('00000000-0000-0000-0000-00000000cc03', 'user@biztest.invalid');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-00000000aa03', 'admin'),
  ('00000000-0000-0000-0000-00000000bb03', 'moderator');

-- 1. Reference data only ------------------------------------------------------
select pg_temp.check((select count(*) from public.business_categories) >= 10, 'directory categories are seeded');
select pg_temp.check((select count(*) from public.businesses) = 0, 'no organisations are seeded');

-- 2. Anonymous and regular users cannot write -------------------------------
select pg_temp.as_anon();
do $$ begin
  insert into public.businesses (city_id, slug, name, source_name) select id, 'x-anon', 'Аноним', 'Я' from public.cities limit 1;
  raise exception 'TEST FAILED: anon must not insert organisations';
exception when insufficient_privilege then raise notice 'ok - anon cannot insert organisations';
end $$;
do $$ begin
  perform count(*) from public.business_submissions;
  raise exception 'TEST FAILED: anon must not read suggestions';
exception when insufficient_privilege then raise notice 'ok - anon cannot read directory suggestions';
end $$;
select pg_temp.reset();
select pg_temp.as_user('00000000-0000-0000-0000-00000000cc03');
do $$ begin
  perform public.staff_save_business('{"slug":"x-user","name":"Кафе пользователя","source_name":"Я","status":"published"}'::jsonb, null);
  raise exception 'TEST FAILED: regular user must not publish';
exception when insufficient_privilege then raise notice 'ok - regular user cannot publish organisations';
end $$;
do $$ begin
  insert into public.business_categories (slug, name_ru, name_kk) values ('x-cat', 'Категория', 'Санат');
  raise exception 'TEST FAILED: regular user must not add categories';
exception when insufficient_privilege then raise notice 'ok - regular user cannot add categories';
end $$;
select pg_temp.reset();

-- 3. Suggestions are private; shape is enforced --------------------------------
insert into public.business_submissions (id, city_id, kind, name, category_id, address, details, contact, client_hash, user_id, is_owner)
select '00000000-0000-0000-0000-0000000000d1', c.id, 'new', 'Кофейня у парка',
  (select id from public.business_categories where slug = 'food'), 'ул. Примерная, 1', 'Открылась недавно', '+7 700 000 00 02', 'hash-b1',
  '00000000-0000-0000-0000-00000000cc03', true
from public.cities c where c.slug = 'satpaev';
do $$ begin
  insert into public.business_submissions (city_id, kind) select id, 'new' from public.cities limit 1;
  raise exception 'TEST FAILED: new suggestion needs a name';
exception when check_violation then raise notice 'ok - a new organisation suggestion needs a name';
end $$;
do $$ begin
  insert into public.business_submissions (city_id, kind, details) select id, 'correction', 'Неверный телефон' from public.cities limit 1;
  raise exception 'TEST FAILED: correction needs an organisation';
exception when check_violation then raise notice 'ok - a correction must point to an organisation';
end $$;
select pg_temp.check((select count(*) from public.moderation_queue where item_type = 'business_submission') = 1,
  'suggestions appear in the moderation queue');
select pg_temp.as_user('00000000-0000-0000-0000-00000000cc03');
select pg_temp.check((select count(*) from public.business_submissions) = 1, 'author sees own suggestion');
select pg_temp.reset();

-- 4. Moderator publishes; verification needs a date ----------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000bb03');
do $$
declare v uuid;
begin
  v := public.staff_save_business(jsonb_build_object(
    'slug', 'kofeinya-u-parka', 'name', 'Кофейня у парка', 'category_id', (select id from public.business_categories where slug = 'food'),
    'address', 'ул. Примерная, 1', 'latitude', '47.9', 'longitude', '67.53', 'source_name', 'Сообщение владельца, проверено',
    'status', 'published'), '00000000-0000-0000-0000-0000000000d1');
  perform pg_temp.check(v is not null, 'moderator publishes an organisation from a suggestion');
end $$;
do $$ begin
  perform public.staff_save_business('{"slug":"x-verified","name":"Проверенная без даты","source_name":"Редакция","verification_status":"verified","status":"draft"}'::jsonb, null);
  raise exception 'TEST FAILED: verified needs a date';
exception when check_violation then raise notice 'ok - "verified" requires the verification date';
end $$;
do $$ begin
  perform public.staff_save_business('{"slug":"x-coords","name":"Только широта","source_name":"Редакция","latitude":"47.9","status":"draft"}'::jsonb, null);
  raise exception 'TEST FAILED: half coordinates must fail';
exception when check_violation then raise notice 'ok - coordinates come in pairs';
end $$;
do $$ begin
  perform public.staff_save_business('{"slug":"x-phone","name":"Плохой телефон","source_name":"Редакция","phone":"звоните","status":"draft"}'::jsonb, null);
  raise exception 'TEST FAILED: bad phone must fail';
exception when check_violation then raise notice 'ok - phone format is checked';
end $$;
select public.staff_save_business('{"slug":"apteka-draft","name":"Аптека черновик","source_name":"Редакция","status":"draft"}'::jsonb, null);
select public.staff_save_business(jsonb_build_object('slug','akimat','name','Акимат города','source_name','Сайт акимата',
  'category_id',(select id from public.business_categories where slug='government'),'verification_status','verified',
  'last_verified_at', current_date::text,'status','published'), null);
do $$ begin
  perform public.staff_save_business('{"slug":"sponsor-b","name":"Партнёр","source_name":"Партнёр","status":"draft","is_sponsored":true}'::jsonb, null);
  raise exception 'TEST FAILED: moderator must not mark sponsored';
exception when insufficient_privilege then raise notice 'ok - only admins can mark sponsored organisations';
end $$;
select pg_temp.reset();

-- A correction is applied by saving the same organisation
insert into public.business_submissions (id, city_id, kind, business_id, details, client_hash)
select '00000000-0000-0000-0000-0000000000d2', c.id, 'correction', b.id, 'Сменился телефон: +7 700 111 22 33', 'hash-b2'
from public.cities c, public.businesses b where c.slug = 'satpaev' and b.slug = 'kofeinya-u-parka';
insert into public.business_submissions (id, city_id, kind, business_id, details, client_hash)
select '00000000-0000-0000-0000-0000000000d3', c.id, 'correction', b.id, 'Закрылись навсегда', 'hash-b3'
from public.cities c, public.businesses b where c.slug = 'satpaev' and b.slug = 'kofeinya-u-parka';
select pg_temp.as_user('00000000-0000-0000-0000-00000000bb03');
do $$ begin
  perform public.staff_save_business(jsonb_build_object('slug','akimat','name','Акимат города','source_name','Сайт акимата','status','published',
    'id',(select id from public.businesses where slug='akimat')), '00000000-0000-0000-0000-0000000000d2');
  raise exception 'TEST FAILED: correction applied to another organisation';
exception when others then
  if sqlerrm like 'TEST FAILED%' then raise; end if;
  raise notice 'ok - a correction cannot be applied to another organisation';
end $$;
select public.staff_save_business(jsonb_build_object('id',(select id from public.businesses where slug='kofeinya-u-parka'),
  'slug','kofeinya-u-parka','name','Кофейня у парка','category_id',(select id from public.business_categories where slug='food'),
  'address','ул. Примерная, 1','latitude','47.9','longitude','67.53','phone','+7 700 111 22 33',
  'source_name','Сообщение владельца, проверено','status','published'), '00000000-0000-0000-0000-0000000000d2');
select public.reject_business_submission('00000000-0000-0000-0000-0000000000d3', 'Организация работает, проверено звонком');
select pg_temp.reset();

select pg_temp.check((select phone from public.businesses where slug = 'kofeinya-u-parka') = '+7 700 111 22 33', 'correction is applied');
select pg_temp.check((select status from public.business_submissions where id = '00000000-0000-0000-0000-0000000000d2') = 'approved',
  'correction marked approved');
select pg_temp.check((select status from public.business_submissions where id = '00000000-0000-0000-0000-0000000000d3') = 'rejected',
  'correction can be rejected with a reason');
select pg_temp.check((select count(*) from public.moderation_actions where target_type = 'business_submission') = 3,
  'moderation decisions are logged');
select pg_temp.check((select count(*) from public.admin_audit_logs where entity_type = 'business') = 4,
  'directory changes are written to the audit log');

-- 5. What readers see --------------------------------------------------------
select pg_temp.as_anon();
select pg_temp.check((select count(*) from public.businesses) = 2, 'anon sees only published organisations');
select pg_temp.check((select array_agg(slug) from public.search_businesses(null, null, 24, 0)) = array['akimat', 'kofeinya-u-parka'],
  'directory is alphabetical');
select pg_temp.check((select count(*) from public.search_businesses('кофе', null, 24, 0)) = 1, 'search finds by name');
select pg_temp.check((select count(*) from public.search_businesses('примерная', null, 24, 0)) = 1, 'search finds by address');
select pg_temp.check((select count(*) from public.search_businesses('рестораны', null, 24, 0)) = 1, 'search finds by category name');
select pg_temp.check((select count(*) from public.search_businesses(null, 'government', 24, 0)) = 1, 'filter by category');
select pg_temp.check((select count(*) from public.search_businesses('100%_', null, 24, 0)) = 0, 'LIKE wildcards are escaped');
select pg_temp.reset();

-- Sponsorship never changes the order
select pg_temp.as_user('00000000-0000-0000-0000-00000000aa03');
select public.staff_save_business('{"slug":"yakor","name":"Якорь","source_name":"Партнёр","status":"published","is_sponsored":true}'::jsonb, null);
select pg_temp.reset();
select pg_temp.as_anon();
select pg_temp.check((select (array_agg(slug))[3] from public.search_businesses(null, null, 24, 0)) = 'yakor',
  'sponsored organisation keeps its alphabetical place');
select pg_temp.reset();

-- 6. Only admins delete; account deletion removes personal data ---------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000bb03');
do $$ begin
  perform public.staff_delete_business((select id from public.businesses where slug = 'apteka-draft'));
  raise exception 'TEST FAILED: moderator must not delete';
exception when insufficient_privilege then raise notice 'ok - moderators cannot delete organisations';
end $$;
select pg_temp.reset();
select pg_temp.as_user('00000000-0000-0000-0000-00000000aa03');
select public.staff_delete_business((select id from public.businesses where slug = 'apteka-draft'));
select pg_temp.reset();
select pg_temp.check((select count(*) from public.businesses where slug = 'apteka-draft') = 0, 'admin deletes an organisation');

select pg_temp.as_user('00000000-0000-0000-0000-00000000cc03');
select public.delete_my_data();
select pg_temp.reset();
select pg_temp.check((select user_id is null and contact is null and client_hash is null
  from public.business_submissions where id = '00000000-0000-0000-0000-0000000000d1'),
  'account deletion unlinks the person from published suggestions');

rollback;
\echo 'ALL BUSINESS TESTS PASSED'
