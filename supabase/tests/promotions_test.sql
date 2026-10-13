-- Database tests for the «Акции и скидки» module (RLS, dates, moderation of reader reports).
-- Run against a LOCAL/STAGING database with migrations + seed.sql applied:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/promotions_test.sql
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
  ('00000000-0000-0000-0000-00000000aa02', 'admin@promotest.invalid'),
  ('00000000-0000-0000-0000-00000000bb02', 'mod@promotest.invalid'),
  ('00000000-0000-0000-0000-00000000cc02', 'user@promotest.invalid');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-00000000aa02', 'admin'),
  ('00000000-0000-0000-0000-00000000bb02', 'moderator');
update public.app_settings set value = 'false'::jsonb where key = 'demo_mode';

-- 1. Nothing is invented ------------------------------------------------------
select pg_temp.check((select count(*) from public.promotions) = 0, 'no promotions are seeded');
select pg_temp.check(public.city_today() = (now() at time zone 'Asia/Almaty')::date, 'city_today uses Almaty time');

-- 2. Anonymous and regular users cannot write -------------------------------
select pg_temp.as_anon();
do $$ begin
  insert into public.promotions (city_id, slug, store_id, title, ends_on, source_name)
  select c.id, 'x-anon', s.id, 'Скидка анонима', current_date, 'Источник'
  from public.cities c, public.stores s where s.slug = 'magnit' limit 1;
  raise exception 'TEST FAILED: anon must not insert promotions';
exception when insufficient_privilege then raise notice 'ok - anon cannot insert promotions';
end $$;
do $$ begin
  perform count(*) from public.promotion_submissions;
  raise exception 'TEST FAILED: anon must not read promotion_submissions';
exception when insufficient_privilege then raise notice 'ok - anon cannot read promotion reports';
end $$;
select pg_temp.reset();

select pg_temp.as_user('00000000-0000-0000-0000-00000000cc02');
do $$ begin
  perform public.staff_save_promotion(jsonb_build_object('slug','x-user','title','Скидка пользователя',
    'store_id',(select id from public.stores where slug='magnit'),'ends_on',current_date::text,'source_name','Я','status','published'), null);
  raise exception 'TEST FAILED: regular user must not publish';
exception when insufficient_privilege then raise notice 'ok - regular user cannot publish promotions';
end $$;
select pg_temp.reset();

-- 3. Reader reports are private ----------------------------------------------
insert into public.promotion_submissions (id, city_id, store_id, title, details, contact, client_hash, user_id)
select '00000000-0000-0000-0000-0000000000e1', c.id, s.id, 'Скидка на молоко 20%',
  'Видел ценник в магазине, фото приложено.', '+7 700 000 00 01', 'hash-p1', '00000000-0000-0000-0000-00000000cc02'
from public.cities c, public.stores s where c.slug = 'satpaev' and s.slug = 'magnit';
insert into public.promotion_submissions (id, city_id, store_text, title, client_hash)
select '00000000-0000-0000-0000-0000000000e2', id, 'Ларёк у рынка', 'Неизвестная акция', 'hash-p2'
from public.cities where slug = 'satpaev';
do $$ begin
  insert into public.promotion_submissions (city_id, title) select id, 'Без магазина' from public.cities limit 1;
  raise exception 'TEST FAILED: a report needs a store';
exception when check_violation then raise notice 'ok - a report must name a store';
end $$;
select pg_temp.check((select count(*) from public.moderation_queue where item_type = 'promotion_submission') = 2,
  'reports appear in the moderation queue');
select pg_temp.as_user('00000000-0000-0000-0000-00000000cc02');
select pg_temp.check((select count(*) from public.promotion_submissions) = 1, 'author sees only own report');
select pg_temp.reset();

-- 4. Moderator publishes; dates decide what is active ------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000bb02');
do $$
declare v uuid;
begin
  v := public.staff_save_promotion(jsonb_build_object(
    'slug', 'magnit-moloko', 'title', 'Скидка на молоко', 'discount_label', '−20%',
    'store_id', (select id from public.stores where slug = 'magnit'),
    'category_id', (select id from public.product_categories where slug = 'dairy'),
    'starts_on', (public.city_today() - 1)::text, 'ends_on', (public.city_today() + 3)::text,
    'source_name', 'Сообщение покупателя, проверено', 'status', 'published'),
    '00000000-0000-0000-0000-0000000000e1');
  perform pg_temp.check(v is not null, 'moderator publishes a promotion from a report');
end $$;
do $$ begin
  perform public.staff_save_promotion(jsonb_build_object('slug','magnit-2','title','Повторная публикация',
    'store_id',(select id from public.stores where slug='magnit'),'ends_on',public.city_today()::text,
    'source_name','Источник','status','published'), '00000000-0000-0000-0000-0000000000e1');
  raise exception 'TEST FAILED: report must not be used twice';
exception when others then
  if sqlerrm like 'TEST FAILED%' then raise; end if;
  raise notice 'ok - an already moderated report cannot be published twice';
end $$;
select public.staff_save_promotion(jsonb_build_object('slug','akcent-skoro','title','Скоро: неделя скидок',
  'store_id',(select id from public.stores where slug='akcent'),'starts_on',(public.city_today()+5)::text,
  'ends_on',(public.city_today()+12)::text,'source_name','Сайт сети','source_url','https://example.org/a','status','published'), null);
select public.staff_save_promotion(jsonb_build_object('slug','samadi-proshla','title','Прошедшая распродажа',
  'store_id',(select id from public.stores where slug='samadi'),'ends_on',(public.city_today()-1)::text,
  'source_name','Сайт сети','status','published'), null);
select public.staff_save_promotion(jsonb_build_object('slug','svetofor-draft','title','Черновик акции светофор',
  'store_id',(select id from public.stores where slug='svetofor'),'ends_on',(public.city_today()+1)::text,
  'source_name','Редакция','status','draft'), null);
select public.staff_save_promotion(jsonb_build_object('slug','demo-akciya','title','Акция демо-магазина',
  'store_id',(select id from public.stores where slug='demo-a'),'ends_on',(public.city_today()+1)::text,
  'source_name','DEMO','status','published'), null);
do $$ begin
  perform public.staff_save_promotion(jsonb_build_object('slug','sponsored-p','title','Партнёрская акция',
    'store_id',(select id from public.stores where slug='magnit'),'ends_on',public.city_today()::text,
    'source_name','Партнёр','status','draft','is_sponsored',true), null);
  raise exception 'TEST FAILED: moderator must not mark sponsored promotions';
exception when insufficient_privilege then raise notice 'ok - only admins can mark sponsored promotions';
end $$;
do $$ begin
  perform public.staff_save_promotion(jsonb_build_object('slug','bad-dates','title','Неверные даты акции',
    'store_id',(select id from public.stores where slug='magnit'),'starts_on',(public.city_today()+2)::text,
    'ends_on',public.city_today()::text,'source_name','Редакция','status','draft'), null);
  raise exception 'TEST FAILED: start after end must fail';
exception when check_violation then raise notice 'ok - start date after end date is rejected';
end $$;
do $$ begin
  perform public.staff_save_promotion(jsonb_build_object('slug','bad-branch','title','Чужой филиал акции',
    'store_id',(select id from public.stores where slug='magnit'),
    'branch_id',(select id from public.store_branches b where b.store_id = (select id from public.stores where slug='akcent') limit 1),
    'ends_on',public.city_today()::text,'source_name','Редакция','status','draft'), null);
  raise exception 'TEST FAILED: branch of another store must fail';
exception when check_violation then raise notice 'ok - branch must belong to the store';
end $$;
select public.reject_promotion_submission('00000000-0000-0000-0000-0000000000e2', 'Не удалось подтвердить');
select pg_temp.reset();

select pg_temp.check((select status from public.promotion_submissions where id = '00000000-0000-0000-0000-0000000000e1') = 'approved'
  and (select promotion_id from public.promotion_submissions where id = '00000000-0000-0000-0000-0000000000e1') is not null,
  'report is marked approved and linked');
select pg_temp.check((select status from public.promotion_submissions where id = '00000000-0000-0000-0000-0000000000e2') = 'rejected',
  'report can be rejected with a reason');
select pg_temp.check((select count(*) from public.moderation_actions where target_type = 'promotion_submission') = 2,
  'moderation decisions are logged');
select pg_temp.check((select count(*) from public.admin_audit_logs where entity_type = 'promotion') = 5,
  'promotion changes are written to the audit log');

-- 5. What readers see --------------------------------------------------------
select pg_temp.as_anon();
select pg_temp.check((select count(*) from public.promotions) = 3, 'anon sees published promotions of visible stores only');
select pg_temp.check((select array_agg(slug order by slug) from public.search_promotions('active', null, null, null, 12, 0)) = array['magnit-moloko'],
  'active list holds only promotions valid today');
select pg_temp.check((select array_agg(slug) from public.search_promotions('upcoming', null, null, null, 12, 0)) = array['akcent-skoro'],
  'upcoming list holds future promotions');
select pg_temp.check((select array_agg(slug) from public.search_promotions('ended', null, null, null, 12, 0)) = array['samadi-proshla'],
  'ended list holds expired promotions');
select pg_temp.check((select count(*) from public.search_promotions('active', 'молоко', null, null, 12, 0)) = 1, 'search finds by title');
select pg_temp.check((select count(*) from public.search_promotions('active', 'магнит', null, null, 12, 0)) = 1, 'search finds by store name');
select pg_temp.check((select count(*) from public.search_promotions('active', null, 'magnit', null, 12, 0)) = 1
  and (select count(*) from public.search_promotions('active', null, 'akcent', null, 12, 0)) = 0, 'filter by store');
select pg_temp.check((select count(*) from public.search_promotions('active', null, null, 'dairy', 12, 0)) = 1
  and (select count(*) from public.search_promotions('active', null, null, 'meat', 12, 0)) = 0, 'filter by category');
select pg_temp.check((select count(*) from public.search_promotions('active', '100%_', null, null, 12, 0)) = 0, 'LIKE wildcards are escaped');
select pg_temp.reset();

-- Demo stores' promotions appear only in demo mode
update public.app_settings set value = 'true'::jsonb where key = 'demo_mode';
select pg_temp.as_anon();
select pg_temp.check((select count(*) from public.search_promotions('active', null, null, null, 12, 0)) = 2, 'demo store promotion visible in demo mode');
select pg_temp.reset();

-- Sponsorship never changes the order
select pg_temp.as_user('00000000-0000-0000-0000-00000000aa02');
select public.staff_save_promotion(jsonb_build_object('slug','sponsor-late','title','Партнёрская акция надолго',
  'store_id',(select id from public.stores where slug='kaspiy'),'ends_on',(public.city_today()+30)::text,
  'source_name','Партнёр','status','published','is_sponsored',true), null);
select pg_temp.reset();
select pg_temp.as_anon();
select pg_temp.check((select (array_agg(slug))[3] from public.search_promotions('active', null, null, null, 12, 0)) = 'sponsor-late',
  'sponsored promotion is ordered by its date like any other');
select pg_temp.reset();

-- 6. Only admins delete; account deletion removes personal data ---------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000bb02');
do $$ begin
  perform public.staff_delete_promotion((select id from public.promotions where slug = 'svetofor-draft'));
  raise exception 'TEST FAILED: moderator must not delete promotions';
exception when insufficient_privilege then raise notice 'ok - moderators cannot delete promotions';
end $$;
select pg_temp.reset();
select pg_temp.as_user('00000000-0000-0000-0000-00000000aa02');
select public.staff_delete_promotion((select id from public.promotions where slug = 'svetofor-draft'));
select pg_temp.reset();
select pg_temp.check((select count(*) from public.promotions where slug = 'svetofor-draft') = 0, 'admin deletes a promotion');

select pg_temp.as_user('00000000-0000-0000-0000-00000000cc02');
select public.delete_my_data();
select pg_temp.reset();
select pg_temp.check((select user_id is null and contact is null and client_hash is null
  from public.promotion_submissions where id = '00000000-0000-0000-0000-0000000000e1'),
  'account deletion unlinks the person from published reports');

rollback;
\echo 'ALL PROMOTION TESTS PASSED'
