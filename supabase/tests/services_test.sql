-- Database tests for the «Услуги и мастера» module (owner listings, moderation, expiry, complaints).
-- Run against a LOCAL/STAGING database with migrations + seed.sql applied:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/services_test.sql
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

-- Listing payload for the owner functions.
create or replace function pg_temp.listing(p_slug text, p_title text, p_category text default 'plumbing') returns jsonb language sql as $$
  select jsonb_build_object(
    'slug', p_slug, 'title', p_title, 'provider_name', 'Мастер Ерлан',
    'description', 'Устанавливаю и ремонтирую смесители, унитазы и трубы. Выезд по городу.',
    'category_id', (select id from public.service_categories where slug = p_category),
    'phone', '+7 700 000 00 11', 'has_whatsapp', true, 'price_note', 'от 5 000 ₸ за выезд', 'area', 'Весь город');
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000aa04', 'admin@svctest.invalid'),
  ('00000000-0000-0000-0000-00000000bb04', 'mod@svctest.invalid'),
  ('00000000-0000-0000-0000-00000000cc04', 'master@svctest.invalid'),
  ('00000000-0000-0000-0000-00000000dd04', 'other@svctest.invalid');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-00000000aa04', 'admin'),
  ('00000000-0000-0000-0000-00000000bb04', 'moderator');

-- 1. Reference data only ------------------------------------------------------
select pg_temp.check((select count(*) from public.service_categories) >= 10, 'service categories are seeded');
select pg_temp.check((select count(*) from public.service_listings) = 0, 'no listings are seeded');

-- 2. Anonymous users cannot write -------------------------------------------
select pg_temp.as_anon();
do $$ begin
  insert into public.service_listings (city_id, slug, title, provider_name, description, phone, source_name)
  select id, 'x-anon', 'Аноним мастер', 'Аноним', 'Описание длиннее двадцати символов', '+7 700 000 00 00', 'Я' from public.cities limit 1;
  raise exception 'TEST FAILED: anon must not insert listings';
exception when insufficient_privilege then raise notice 'ok - anon cannot insert listings';
end $$;
do $$ begin
  perform public.submit_service_listing(pg_temp.listing('x-anon', 'Сантехник аноним'));
  raise exception 'TEST FAILED: anon must not submit';
exception when insufficient_privilege then raise notice 'ok - anon cannot submit a listing';
end $$;
do $$ begin
  perform count(*) from public.listing_complaints;
  raise exception 'TEST FAILED: anon must not read complaints';
exception when insufficient_privilege then raise notice 'ok - anon cannot read complaints';
end $$;
select pg_temp.reset();

-- 3. Owner submits; listing is hidden until moderated ------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000cc04');
select public.submit_service_listing(pg_temp.listing('santehnik', 'Сантехник на дом'));
select public.submit_service_listing(pg_temp.listing('santehnik', 'Сантехник на дом, второй'));
select public.submit_service_listing(pg_temp.listing('elektrik', 'Электрик, мелкий ремонт', 'electric'));
select pg_temp.check((select count(*) from public.service_listings) = 3, 'owner sees own pending listings');
select pg_temp.check((select count(distinct slug) from public.service_listings) = 3, 'a taken slug gets a unique suffix');
select pg_temp.check((select bool_and(status = 'pending' and consent_at is not null and not is_sponsored) from public.service_listings),
  'submitted listings are pending, with consent recorded');
do $$ begin
  perform public.submit_service_listing(pg_temp.listing('chetvertyi', 'Четвёртое объявление за день'));
  raise exception 'TEST FAILED: daily limit';
exception when raise_exception then
  if sqlerrm <> 'service_daily_limit' then raise; end if;
  raise notice 'ok - no more than 3 new listings a day';
end $$;
do $$ begin
  update public.service_listings set status = 'published' where slug = 'santehnik';
  raise exception 'TEST FAILED: owner must not publish directly';
exception when insufficient_privilege then raise notice 'ok - owner cannot change listings directly';
end $$;
select pg_temp.reset();

-- Active listings are limited to five (older submissions do not count towards the daily limit).
update public.service_listings set created_at = now() - interval '2 days' where owner_id = '00000000-0000-0000-0000-00000000cc04';
select pg_temp.as_user('00000000-0000-0000-0000-00000000cc04');
do $$ begin
  perform public.submit_service_listing(pg_temp.listing('bez-kategorii', 'Мастер без категории') - 'category_id');
  raise exception 'TEST FAILED: category is required';
exception when no_data_found then raise notice 'ok - a listing needs a category';
end $$;
do $$ begin
  perform public.submit_service_listing(pg_temp.listing('plohoi-telefon', 'Мастер с плохим телефоном') || '{"phone":"звоните"}');
  raise exception 'TEST FAILED: phone format';
exception when check_violation then raise notice 'ok - phone format is checked';
end $$;
select public.submit_service_listing(pg_temp.listing('chetvertyi', 'Четвёртое объявление'));
select public.submit_service_listing(pg_temp.listing('pyatyi', 'Пятое объявление'));
do $$ begin
  perform public.submit_service_listing(pg_temp.listing('shestoi', 'Шестое объявление'));
  raise exception 'TEST FAILED: active limit';
exception when raise_exception then
  if sqlerrm <> 'service_active_limit' then raise; end if;
  raise notice 'ok - no more than 5 active listings per person';
end $$;
select pg_temp.reset();

select pg_temp.as_anon();
select pg_temp.check((select count(*) from public.service_listings) = 0, 'anon does not see pending listings');
select pg_temp.reset();
select pg_temp.as_user('00000000-0000-0000-0000-00000000dd04');
select pg_temp.check((select count(*) from public.service_listings) = 0, 'other users do not see pending listings');
do $$ begin
  perform public.update_my_service_listing((select id from public.service_listings where slug = 'elektrik'), pg_temp.listing('elektrik', 'Чужая правка', 'electric'));
  raise exception 'TEST FAILED: other user edits';
exception when no_data_found then raise notice 'ok - another user cannot edit the listing';
end $$;
do $$ begin
  perform public.staff_moderate_service_listing((select id from public.service_listings where slug = 'elektrik'), 'approve');
  raise exception 'TEST FAILED: regular user approves';
exception when insufficient_privilege then raise notice 'ok - regular user cannot approve listings';
end $$;
select pg_temp.reset();
select pg_temp.check((select count(*) from public.moderation_queue where item_type = 'service_listing') = 5,
  'pending listings appear in the moderation queue');

-- 4. Moderation --------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000bb04');
select public.staff_moderate_service_listing(id, 'approve') from public.service_listings where slug in ('santehnik', 'elektrik');
do $$ begin
  perform public.staff_moderate_service_listing((select id from public.service_listings where slug = 'chetvertyi'), 'reject', ' ');
  raise exception 'TEST FAILED: reject needs a reason';
exception when invalid_parameter_value then raise notice 'ok - rejection needs a reason';
end $$;
select public.staff_moderate_service_listing((select id from public.service_listings where slug = 'chetvertyi'), 'reject', 'Нет описания услуги');
do $$ begin
  perform public.staff_moderate_service_listing((select id from public.service_listings where slug = 'santehnik'), 'approve');
  raise exception 'TEST FAILED: double moderation';
exception when raise_exception then raise notice 'ok - a listing cannot be moderated twice';
end $$;
select pg_temp.reset();
select pg_temp.check((select expires_on from public.service_listings where slug = 'santehnik') = public.city_today() + 90,
  'approved listing is live for 90 days');
select pg_temp.check((select status || '|' || reject_reason from public.service_listings where slug = 'chetvertyi') = 'rejected|Нет описания услуги',
  'rejected listing keeps the reason for the owner');
select pg_temp.check((select count(*) from public.moderation_actions where target_type = 'service_listing') = 3,
  'moderation decisions are logged');

select pg_temp.as_anon();
select pg_temp.check((select count(*) from public.service_listings) = 2, 'anon sees approved listings');
select pg_temp.check((select count(*) from public.search_service_listings(null, null, 24, 0)) = 2, 'catalogue lists approved listings');
select pg_temp.check((select count(*) from public.search_service_listings('смесители', null, 24, 0)) = 2, 'search finds by description');
select pg_temp.check((select count(*) from public.search_service_listings('электрик', null, 24, 0)) = 1, 'search finds by title and category');
select pg_temp.check((select count(*) from public.search_service_listings(null, 'electric', 24, 0)) = 1, 'filter by category');
select pg_temp.check((select count(*) from public.search_service_listings('100%_', null, 24, 0)) = 0, 'LIKE wildcards are escaped');
select pg_temp.reset();

-- 5. Owner edits, renews, hides ----------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000cc04');
do $$ begin
  perform public.my_service_listing_action((select id from public.service_listings where slug = 'santehnik'), 'renew');
  raise exception 'TEST FAILED: renew too early';
exception when raise_exception then
  if sqlerrm <> 'service_renew_too_early' then raise; end if;
  raise notice 'ok - a fresh listing cannot be renewed yet';
end $$;
select public.update_my_service_listing((select id from public.service_listings where slug = 'elektrik'),
  pg_temp.listing('elektrik', 'Электрик, ремонт проводки', 'electric'));
select pg_temp.check((select status from public.service_listings where slug = 'elektrik') = 'pending', 'an edit sends the listing back to moderation');
select public.my_service_listing_action((select id from public.service_listings where slug = 'pyatyi'), 'archive');
select pg_temp.check((select status from public.service_listings where slug = 'pyatyi') = 'archived', 'owner hides a listing');
select public.my_service_listing_action((select id from public.service_listings where slug = 'pyatyi'), 'restore');
select pg_temp.check((select status from public.service_listings where slug = 'pyatyi') = 'pending', 'a restored listing is moderated again');
select pg_temp.reset();

select pg_temp.as_anon();
select pg_temp.check((select count(*) from public.service_listings where slug = 'elektrik') = 0, 'edited listing is hidden until approved again');
select pg_temp.reset();

-- Expiry: close to the end the owner can renew; after the end the listing disappears.
update public.service_listings set expires_on = public.city_today() + 10 where slug = 'santehnik';
select pg_temp.as_user('00000000-0000-0000-0000-00000000cc04');
select public.my_service_listing_action((select id from public.service_listings where slug = 'santehnik'), 'renew');
select pg_temp.reset();
select pg_temp.check((select expires_on from public.service_listings where slug = 'santehnik') = public.city_today() + 90, 'owner renews for 90 days');
update public.service_listings set expires_on = public.city_today() - 1 where slug = 'santehnik';
select pg_temp.as_anon();
select pg_temp.check((select count(*) from public.service_listings where slug = 'santehnik') = 0, 'expired listing is hidden');
select pg_temp.check((select count(*) from public.search_service_listings(null, null, 24, 0)) = 0, 'expired listing leaves the catalogue');
select pg_temp.reset();
select pg_temp.as_user('00000000-0000-0000-0000-00000000cc04');
select pg_temp.check((select count(*) from public.service_listings where slug = 'santehnik') = 1, 'owner still sees an expired listing');
select public.my_service_listing_action((select id from public.service_listings where slug = 'santehnik'), 'renew');
select pg_temp.reset();
select pg_temp.as_anon();
select pg_temp.check((select count(*) from public.service_listings where slug = 'santehnik') = 1, 'a renewed listing is back');
select pg_temp.reset();

-- 6. Staff listings, sponsorship ---------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000bb04');
do $$ begin
  perform public.staff_save_service_listing(pg_temp.listing('bez-istochnika', 'Мастер без источника') || '{"status":"published"}');
  raise exception 'TEST FAILED: staff listing needs a source';
exception when check_violation then raise notice 'ok - a staff listing without an owner needs a source';
end $$;
do $$ begin
  perform public.staff_save_service_listing(pg_temp.listing('sponsor', 'Рекламный мастер') || '{"status":"published","source_name":"Договор","is_sponsored":true}');
  raise exception 'TEST FAILED: moderator marks sponsored';
exception when insufficient_privilege then raise notice 'ok - only admins can mark sponsored listings';
end $$;
select pg_temp.reset();
select pg_temp.as_user('00000000-0000-0000-0000-00000000aa04');
select public.staff_save_service_listing(pg_temp.listing('sponsor', 'Рекламный мастер', 'cleaning')
  || '{"status":"published","source_name":"Договор о размещении","is_sponsored":true}');
select pg_temp.reset();
-- The sponsored listing is the newest by creation but was published earlier: it must not jump ahead.
update public.service_listings set published_at = now() - interval '30 days' where slug = 'sponsor';
select pg_temp.as_anon();
select pg_temp.check((select (array_agg(slug))[1] from public.search_service_listings(null, null, 24, 0)) = 'santehnik',
  'sponsorship does not move a listing up');
select pg_temp.reset();

-- 7. Complaints ---------------------------------------------------------------
insert into public.listing_complaints (id, target_type, target_id, reason, message, reporter_id, client_hash)
select '00000000-0000-0000-0000-0000000000e1', 'service_listing', id, 'fraud', 'Просит предоплату и пропадает',
  '00000000-0000-0000-0000-00000000dd04', repeat('a', 64)
from public.service_listings where slug = 'sponsor';
insert into public.listing_complaints (id, target_type, target_id, reason, client_hash)
select '00000000-0000-0000-0000-0000000000e2', 'service_listing', id, 'not_actual', repeat('b', 64)
from public.service_listings where slug = 'santehnik';
select pg_temp.check((select count(*) from public.moderation_queue where item_type = 'listing_complaint' and flagged) = 1,
  'fraud complaints are flagged in the queue');
select pg_temp.as_user('00000000-0000-0000-0000-00000000dd04');
select pg_temp.check((select count(*) from public.listing_complaints) = 0, 'regular users do not see complaints');
select pg_temp.reset();
select pg_temp.as_user('00000000-0000-0000-0000-00000000bb04');
select public.staff_resolve_listing_complaint('00000000-0000-0000-0000-0000000000e1', 'resolved', 'Скрыто до выяснения', true);
select public.staff_resolve_listing_complaint('00000000-0000-0000-0000-0000000000e2', 'dismissed', 'Мастер подтвердил по телефону');
do $$ begin
  perform public.staff_resolve_listing_complaint('00000000-0000-0000-0000-0000000000e2', 'resolved');
  raise exception 'TEST FAILED: complaint handled twice';
exception when raise_exception then raise notice 'ok - a complaint cannot be handled twice';
end $$;
select pg_temp.reset();
select pg_temp.check((select status from public.service_listings where slug = 'sponsor') = 'archived', 'resolving with «hide» hides the listing');
select pg_temp.check((select status from public.service_listings where slug = 'santehnik') = 'published', 'dismissed complaint leaves the listing');

-- 8. Deletion -----------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000bb04');
do $$ begin
  perform public.staff_delete_service_listing((select id from public.service_listings where slug = 'sponsor'));
  raise exception 'TEST FAILED: moderator deletes';
exception when insufficient_privilege then raise notice 'ok - moderators cannot delete listings';
end $$;
select pg_temp.reset();
select pg_temp.as_user('00000000-0000-0000-0000-00000000aa04');
select public.staff_delete_service_listing((select id from public.service_listings where slug = 'sponsor'));
select pg_temp.reset();
select pg_temp.check((select count(*) from public.listing_complaints where id = '00000000-0000-0000-0000-0000000000e1') = 0,
  'deleting a listing removes its complaints');
select pg_temp.check((select count(*) from public.admin_audit_logs where entity_type = 'service_listing') >= 6,
  'staff actions are written to the audit log');

select pg_temp.as_user('00000000-0000-0000-0000-00000000cc04');
select public.delete_my_service_listing((select id from public.service_listings where slug = 'pyatyi'));
select pg_temp.check((select count(*) from public.service_listings where slug = 'pyatyi') = 0, 'owner deletes own listing');
select public.delete_my_data();
select pg_temp.reset();
select pg_temp.check((select count(*) from public.service_listings where owner_id = '00000000-0000-0000-0000-00000000cc04') = 0,
  'account deletion removes the person''s listings');
select pg_temp.check((select count(*) from public.listing_complaints where target_type = 'service_listing') = 0,
  'complaints about removed listings are removed too');

select pg_temp.as_user('00000000-0000-0000-0000-00000000dd04');
select public.delete_my_data();
select pg_temp.reset();

rollback;
\echo 'ALL SERVICE TESTS PASSED'
