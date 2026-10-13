-- Database tests for the «Работа и вакансии» module (employer vacancies, moderation, expiry, complaints).
-- Run against a LOCAL/STAGING database with migrations + seed.sql applied:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/jobs_test.sql
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

-- Vacancy payload for the owner functions (test data only).
create or replace function pg_temp.job(p_slug text, p_title text, p_category text default 'sales') returns jsonb language sql as $$
  select jsonb_build_object(
    'slug', p_slug, 'title', p_title, 'employer_name', 'ИП Тестовый магазин',
    'description', 'Работа с покупателями, выкладка товара, работа на кассе. Обучение на месте.',
    'category_id', (select id from public.job_categories where slug = p_category),
    'employment_type', 'full', 'experience', 'none', 'schedule', '5/2',
    'salary_from', 150000, 'salary_to', 200000,
    'phone', '+7 700 000 00 22', 'has_whatsapp', true);
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000aa05', 'admin@jobtest.invalid'),
  ('00000000-0000-0000-0000-00000000bb05', 'mod@jobtest.invalid'),
  ('00000000-0000-0000-0000-00000000cc05', 'employer@jobtest.invalid'),
  ('00000000-0000-0000-0000-00000000dd05', 'other@jobtest.invalid');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-00000000aa05', 'admin'),
  ('00000000-0000-0000-0000-00000000bb05', 'moderator');

-- 1. Reference data only ------------------------------------------------------
select pg_temp.check((select count(*) from public.job_categories) >= 10, 'job categories are seeded');
select pg_temp.check((select count(*) from public.job_listings) = 0, 'no vacancies are seeded');

-- 2. Anonymous users cannot write -------------------------------------------
select pg_temp.as_anon();
do $$ begin
  insert into public.job_listings (city_id, slug, title, employer_name, description, phone, source_name)
  select id, 'x-anon', 'Аноним', 'Аноним', 'Описание длиннее двадцати символов', '+7 700 000 00 00', 'Я' from public.cities limit 1;
  raise exception 'TEST FAILED: anon must not insert vacancies';
exception when insufficient_privilege then raise notice 'ok - anon cannot insert vacancies';
end $$;
do $$ begin
  perform public.submit_job_listing(pg_temp.job('x-anon', 'Продавец аноним'));
  raise exception 'TEST FAILED: anon must not submit';
exception when insufficient_privilege then raise notice 'ok - anon cannot submit a vacancy';
end $$;
select pg_temp.reset();

-- 3. Employer submits; vacancy is hidden until moderated ---------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000cc05');
select public.submit_job_listing(pg_temp.job('prodavec', 'Продавец-консультант'));
select public.submit_job_listing(pg_temp.job('prodavec', 'Продавец-кассир'));
select public.submit_job_listing(pg_temp.job('voditel', 'Водитель категории C', 'transport')
  || '{"employment_type":"shift","experience":"3_plus","salary_from":null,"salary_to":null,"salary_note":"по договорённости","description":"Перевозка грузов по городу и области на грузовике компании."}');
select pg_temp.check((select count(*) from public.job_listings) = 3, 'employer sees own pending vacancies');
select pg_temp.check((select count(distinct slug) from public.job_listings) = 3, 'a taken slug gets a unique suffix');
select pg_temp.check((select bool_and(status = 'pending' and consent_at is not null and not is_sponsored) from public.job_listings),
  'submitted vacancies are pending, with consent recorded');
select pg_temp.check((select salary_from is null and salary_to is null from public.job_listings where slug = 'voditel'),
  'salary stays empty when the employer does not state it');
do $$ begin
  perform public.submit_job_listing(pg_temp.job('bez-kategorii', 'Вакансия без категории') - 'category_id');
  raise exception 'TEST FAILED: category is required';
exception when no_data_found then raise notice 'ok - a vacancy needs a category';
end $$;
do $$ begin
  perform public.submit_job_listing(pg_temp.job('zarplata', 'Перепутанная зарплата') || '{"salary_from":300000,"salary_to":100000}');
  raise exception 'TEST FAILED: salary range';
exception when check_violation then raise notice 'ok - salary «from» cannot exceed «to»';
end $$;
do $$ begin
  perform public.submit_job_listing(pg_temp.job('tip', 'Неизвестный тип занятости') || '{"employment_type":"remote-ish"}');
  raise exception 'TEST FAILED: employment type';
exception when check_violation then raise notice 'ok - employment type is checked';
end $$;
do $$ begin
  perform public.submit_job_listing(pg_temp.job('pochta', 'Плохая почта') || '{"email":"не почта"}');
  raise exception 'TEST FAILED: email format';
exception when check_violation then raise notice 'ok - email format is checked';
end $$;
select public.submit_job_listing(pg_temp.job('kassir', 'Кассир'));
select public.submit_job_listing(pg_temp.job('gruzchik', 'Грузчик на склад'));
do $$ begin
  perform public.submit_job_listing(pg_temp.job('shestaya', 'Шестая вакансия за день'));
  raise exception 'TEST FAILED: daily limit';
exception when raise_exception then
  if sqlerrm <> 'job_daily_limit' then raise; end if;
  raise notice 'ok - no more than 5 new vacancies a day';
end $$;
do $$ begin
  update public.job_listings set status = 'published' where slug = 'prodavec';
  raise exception 'TEST FAILED: owner must not publish directly';
exception when insufficient_privilege then raise notice 'ok - employer cannot change vacancies directly';
end $$;
select pg_temp.reset();

-- Active vacancies are limited to ten.
update public.job_listings set created_at = now() - interval '2 days' where owner_id = '00000000-0000-0000-0000-00000000cc05';
select pg_temp.as_user('00000000-0000-0000-0000-00000000cc05');
select public.submit_job_listing(pg_temp.job('v' || g, 'Вакансия номер ' || g)) from generate_series(6, 9) g;
select pg_temp.reset();
update public.job_listings set created_at = now() - interval '2 days' where owner_id = '00000000-0000-0000-0000-00000000cc05';
select pg_temp.as_user('00000000-0000-0000-0000-00000000cc05');
select public.submit_job_listing(pg_temp.job('v10', 'Десятая вакансия'));
do $$ begin
  perform public.submit_job_listing(pg_temp.job('v11', 'Одиннадцатая вакансия'));
  raise exception 'TEST FAILED: active limit';
exception when raise_exception then
  if sqlerrm <> 'job_active_limit' then raise; end if;
  raise notice 'ok - no more than 10 active vacancies per person';
end $$;
select pg_temp.reset();
delete from public.job_listings where slug ~ '^v[0-9]+$';

select pg_temp.as_anon();
select pg_temp.check((select count(*) from public.job_listings) = 0, 'anon does not see pending vacancies');
select pg_temp.reset();
select pg_temp.as_user('00000000-0000-0000-0000-00000000dd05');
select pg_temp.check((select count(*) from public.job_listings) = 0, 'other users do not see pending vacancies');
do $$ begin
  perform public.update_my_job_listing((select id from public.job_listings where slug = 'voditel'), pg_temp.job('voditel', 'Чужая правка', 'transport'));
  raise exception 'TEST FAILED: other user edits';
exception when no_data_found then raise notice 'ok - another user cannot edit the vacancy';
end $$;
do $$ begin
  perform public.staff_moderate_job_listing((select id from public.job_listings where slug = 'voditel'), 'approve');
  raise exception 'TEST FAILED: regular user approves';
exception when insufficient_privilege then raise notice 'ok - regular user cannot approve vacancies';
end $$;
select pg_temp.reset();
select pg_temp.check((select count(*) from public.moderation_queue where item_type = 'job_listing') = 5,
  'pending vacancies appear in the moderation queue');

-- 4. Moderation --------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000bb05');
select public.staff_moderate_job_listing(id, 'approve') from public.job_listings where slug in ('prodavec', 'voditel', 'kassir');
do $$ begin
  perform public.staff_moderate_job_listing((select id from public.job_listings where slug = 'gruzchik'), 'reject', ' ');
  raise exception 'TEST FAILED: reject needs a reason';
exception when invalid_parameter_value then raise notice 'ok - rejection needs a reason';
end $$;
select public.staff_moderate_job_listing((select id from public.job_listings where slug = 'gruzchik'), 'reject', 'Не указаны обязанности');
do $$ begin
  perform public.staff_moderate_job_listing((select id from public.job_listings where slug = 'prodavec'), 'approve');
  raise exception 'TEST FAILED: double moderation';
exception when raise_exception then raise notice 'ok - a vacancy cannot be moderated twice';
end $$;
select pg_temp.reset();
select pg_temp.check((select expires_on from public.job_listings where slug = 'prodavec') = public.city_today() + 30,
  'approved vacancy is live for 30 days');
select pg_temp.check((select status || '|' || reject_reason from public.job_listings where slug = 'gruzchik') = 'rejected|Не указаны обязанности',
  'rejected vacancy keeps the reason for the employer');
select pg_temp.check((select count(*) from public.moderation_actions where target_type = 'job_listing') = 4,
  'moderation decisions are logged');

select pg_temp.as_anon();
select pg_temp.check((select count(*) from public.job_listings) = 3, 'anon sees approved vacancies');
select pg_temp.check((select count(*) from public.search_job_listings(null, null, null, false, false, 24, 0)) = 3, 'list shows approved vacancies');
select pg_temp.check((select count(*) from public.search_job_listings('выкладка', null, null, false, false, 24, 0)) = 2, 'search finds by description');
select pg_temp.check((select count(*) from public.search_job_listings('водител', null, null, false, false, 24, 0)) = 1, 'search finds by title');
select pg_temp.check((select count(*) from public.search_job_listings(null, 'transport', null, false, false, 24, 0)) = 1, 'filter by category');
select pg_temp.check((select count(*) from public.search_job_listings(null, null, 'shift', false, false, 24, 0)) = 1, 'filter by employment type');
select pg_temp.check((select count(*) from public.search_job_listings(null, null, null, true, false, 24, 0)) = 2, 'filter «salary stated»');
select pg_temp.check((select count(*) from public.search_job_listings(null, null, null, false, true, 24, 0)) = 2, 'filter «no experience needed»');
select pg_temp.check((select count(*) from public.search_job_listings('100%_', null, null, false, false, 24, 0)) = 0, 'LIKE wildcards are escaped');
select pg_temp.reset();

-- 5. Employer edits, renews, hides --------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000cc05');
do $$ begin
  perform public.my_job_listing_action((select id from public.job_listings where slug = 'prodavec'), 'renew');
  raise exception 'TEST FAILED: renew too early';
exception when raise_exception then
  if sqlerrm <> 'job_renew_too_early' then raise; end if;
  raise notice 'ok - a fresh vacancy cannot be renewed yet';
end $$;
select public.update_my_job_listing((select id from public.job_listings where slug = 'voditel'),
  pg_temp.job('voditel', 'Водитель категории C, вахта', 'transport'));
select pg_temp.check((select status from public.job_listings where slug = 'voditel') = 'pending', 'an edit sends the vacancy back to moderation');
select public.my_job_listing_action((select id from public.job_listings where slug = 'kassir'), 'archive');
select pg_temp.check((select status from public.job_listings where slug = 'kassir') = 'archived', 'employer closes a filled vacancy');
do $$ begin
  perform public.my_job_listing_action((select id from public.job_listings where slug = 'kassir'), 'archive');
  raise exception 'TEST FAILED: archive twice';
exception when raise_exception then raise notice 'ok - a hidden vacancy cannot be hidden again';
end $$;
select public.my_job_listing_action((select id from public.job_listings where slug = 'kassir'), 'restore');
select pg_temp.check((select status from public.job_listings where slug = 'kassir') = 'pending', 'a restored vacancy is moderated again');
select pg_temp.reset();

select pg_temp.as_anon();
select pg_temp.check((select count(*) from public.job_listings where slug = 'voditel') = 0, 'edited vacancy is hidden until approved again');
select pg_temp.reset();

-- Expiry: in the last week the employer can renew; after the end the vacancy disappears.
update public.job_listings set expires_on = public.city_today() + 5 where slug = 'prodavec';
select pg_temp.as_user('00000000-0000-0000-0000-00000000cc05');
select public.my_job_listing_action((select id from public.job_listings where slug = 'prodavec'), 'renew');
select pg_temp.reset();
select pg_temp.check((select expires_on from public.job_listings where slug = 'prodavec') = public.city_today() + 30, 'employer renews for 30 days');
update public.job_listings set expires_on = public.city_today() - 1 where slug = 'prodavec';
select pg_temp.as_anon();
select pg_temp.check((select count(*) from public.job_listings where slug = 'prodavec') = 0, 'expired vacancy is hidden');
select pg_temp.check((select count(*) from public.search_job_listings(null, null, null, false, false, 24, 0)) = 0, 'expired vacancy leaves the list');
select pg_temp.reset();
select pg_temp.as_user('00000000-0000-0000-0000-00000000cc05');
select pg_temp.check((select count(*) from public.job_listings where slug = 'prodavec') = 1, 'employer still sees an expired vacancy');
select public.my_job_listing_action((select id from public.job_listings where slug = 'prodavec'), 'renew');
select pg_temp.reset();
select pg_temp.as_anon();
select pg_temp.check((select count(*) from public.job_listings where slug = 'prodavec') = 1, 'a renewed vacancy is back');
select pg_temp.reset();

-- 6. Staff vacancies, sponsorship ---------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000bb05');
do $$ begin
  perform public.staff_save_job_listing(pg_temp.job('bez-istochnika', 'Вакансия без источника') || '{"status":"published"}');
  raise exception 'TEST FAILED: staff vacancy needs a source';
exception when check_violation then raise notice 'ok - a staff vacancy without an owner needs a source';
end $$;
do $$ begin
  perform public.staff_save_job_listing(pg_temp.job('sponsor', 'Рекламная вакансия') || '{"status":"published","source_name":"Договор","is_sponsored":true}');
  raise exception 'TEST FAILED: moderator marks sponsored';
exception when insufficient_privilege then raise notice 'ok - only admins can mark sponsored vacancies';
end $$;
select pg_temp.reset();
select pg_temp.as_user('00000000-0000-0000-0000-00000000aa05');
select public.staff_save_job_listing(pg_temp.job('sponsor', 'Рекламная вакансия', 'office')
  || '{"status":"published","source_name":"Договор о размещении","is_sponsored":true}');
select pg_temp.reset();
update public.job_listings set published_at = now() - interval '20 days' where slug = 'sponsor';
select pg_temp.as_anon();
select pg_temp.check((select (array_agg(slug))[1] from public.search_job_listings(null, null, null, false, false, 24, 0)) = 'prodavec',
  'sponsorship does not move a vacancy up');
select pg_temp.reset();

-- 7. Complaints ---------------------------------------------------------------
insert into public.listing_complaints (id, target_type, target_id, reason, message, reporter_id, client_hash)
select '00000000-0000-0000-0000-0000000000f1', 'job_listing', id, 'fraud', 'Просят оплатить обучение заранее',
  '00000000-0000-0000-0000-00000000dd05', repeat('c', 64)
from public.job_listings where slug = 'sponsor';
insert into public.listing_complaints (id, target_type, target_id, reason, client_hash)
select '00000000-0000-0000-0000-0000000000f2', 'job_listing', id, 'not_actual', repeat('d', 64)
from public.job_listings where slug = 'prodavec';
select pg_temp.check((select count(*) from public.moderation_queue where item_type = 'listing_complaint' and flagged) = 1,
  'fraud complaints about vacancies are flagged in the queue');
select pg_temp.as_user('00000000-0000-0000-0000-00000000bb05');
select public.staff_resolve_listing_complaint('00000000-0000-0000-0000-0000000000f1', 'resolved', 'Скрыто до выяснения', true);
select public.staff_resolve_listing_complaint('00000000-0000-0000-0000-0000000000f2', 'dismissed', 'Работодатель подтвердил');
select pg_temp.reset();
select pg_temp.check((select status from public.job_listings where slug = 'sponsor') = 'archived', 'resolving with «hide» hides the vacancy');
select pg_temp.check((select status from public.job_listings where slug = 'prodavec') = 'published', 'dismissed complaint leaves the vacancy');

-- 8. Deletion -----------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000bb05');
do $$ begin
  perform public.staff_delete_job_listing((select id from public.job_listings where slug = 'sponsor'));
  raise exception 'TEST FAILED: moderator deletes';
exception when insufficient_privilege then raise notice 'ok - moderators cannot delete vacancies';
end $$;
select pg_temp.reset();
select pg_temp.as_user('00000000-0000-0000-0000-00000000aa05');
select public.staff_delete_job_listing((select id from public.job_listings where slug = 'sponsor'));
select pg_temp.reset();
select pg_temp.check((select count(*) from public.listing_complaints where id = '00000000-0000-0000-0000-0000000000f1') = 0,
  'deleting a vacancy removes its complaints');
select pg_temp.check((select count(*) from public.admin_audit_logs where entity_type = 'job_listing') >= 7,
  'staff actions are written to the audit log');

select pg_temp.as_user('00000000-0000-0000-0000-00000000cc05');
select public.delete_my_job_listing((select id from public.job_listings where slug = 'gruzchik'));
select pg_temp.check((select count(*) from public.job_listings where slug = 'gruzchik') = 0, 'employer deletes own vacancy');
select public.delete_my_data();
select pg_temp.reset();
select pg_temp.check((select count(*) from public.job_listings where owner_id = '00000000-0000-0000-0000-00000000cc05') = 0,
  'account deletion removes the person''s vacancies');
select pg_temp.check((select count(*) from public.listing_complaints where target_type = 'job_listing') = 0,
  'complaints about removed vacancies are removed too');

rollback;
\echo 'ALL JOB TESTS PASSED'
