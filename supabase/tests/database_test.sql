-- Database tests for RLS, moderation and price rules.
-- Run against a LOCAL/STAGING database that has migrations + seed.sql applied:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/database_test.sql
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

-- Fixtures -----------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@dbtest.invalid'),
  ('00000000-0000-0000-0000-0000000000b1', 'mod@dbtest.invalid'),
  ('00000000-0000-0000-0000-0000000000c1', 'user@dbtest.invalid'),
  ('00000000-0000-0000-0000-0000000000c2', 'other@dbtest.invalid');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin'),
  ('00000000-0000-0000-0000-0000000000b1', 'moderator');

create temporary table t_ctx as
select
  (select id from public.products where slug = 'kartofel') as product_id,
  (select id from public.products where slug = 'sahar') as analog_id,
  (select id from public.store_branches where slug = 'akcent-satpaev-1') as branch_id,
  (select id from public.store_branches where slug = 'magnit-satpaev-1') as branch2_id;
grant select on t_ctx to anon, authenticated;

-- 1. Profiles are created automatically ------------------------------------
select pg_temp.check((select count(*) from public.profiles where email like '%@dbtest.invalid') = 4,
  'profile is created for each new auth user');

-- 2. Anonymous access -------------------------------------------------------
select pg_temp.as_anon();
select pg_temp.check((select count(*) from public.products) >= 50, 'anon can read the product catalog');
select pg_temp.check((select count(*) from public.store_branches where slug like 'akcent%') = 1,
  'anon can read real store branches');
do $$ begin
  perform count(*) from public.price_submissions;
  raise exception 'TEST FAILED: anon must not read price_submissions';
exception when insufficient_privilege then raise notice 'ok - anon cannot read price submissions';
end $$;
do $$ begin
  insert into public.verified_prices (product_id, branch_id, price, status, source_type, observed_at)
  select product_id, branch_id, 1, 'verified', 'admin_check', now() from t_ctx;
  raise exception 'TEST FAILED: anon must not write verified_prices';
exception when insufficient_privilege then raise notice 'ok - anon cannot write verified prices';
end $$;
do $$ begin
  perform public.approve_price_submission(gen_random_uuid(), 'verified', null);
  raise exception 'TEST FAILED: anon must not call approve';
exception when insufficient_privilege then raise notice 'ok - anon cannot call moderation functions';
end $$;
select pg_temp.reset();

-- 3. DEMO isolation ---------------------------------------------------------
insert into public.stores (slug, name, is_demo) values ('demo-test', 'Демо тест', true);
insert into public.store_branches (store_id, city_id, slug, name)
select s.id, c.id, 'demo-test-1', 'Демо тест 1' from public.stores s, public.cities c
where s.slug = 'demo-test' and c.slug = 'satpaev';
insert into public.verified_prices (product_id, branch_id, price, status, source_type, observed_at, is_demo)
select t.product_id, b.id, 100, 'verified', 'demo', now(), true
from t_ctx t, public.store_branches b where b.slug = 'demo-test-1';

do $$ begin
  insert into public.verified_prices (product_id, branch_id, price, status, source_type, observed_at, is_demo)
  select product_id, branch_id, 100, 'verified', 'demo', now(), true from t_ctx;
  raise exception 'TEST FAILED: DEMO price on a real store must be rejected';
exception when check_violation then raise notice 'ok - DEMO prices cannot be attached to real stores';
end $$;

update public.app_settings set value = 'false' where key = 'demo_mode';
select pg_temp.as_anon();
select pg_temp.check((select count(*) from public.current_prices where is_demo) = 0,
  'DEMO prices are hidden when demo_mode is off');
select pg_temp.check((select count(*) from public.stores where is_demo) = 0,
  'DEMO stores are hidden when demo_mode is off');
select pg_temp.reset();
update public.app_settings set value = 'true' where key = 'demo_mode';
select pg_temp.as_anon();
select pg_temp.check((select count(*) from public.current_prices where is_demo) > 0,
  'DEMO prices are visible when demo_mode is on');
select pg_temp.reset();
update public.app_settings set value = 'false' where key = 'demo_mode';

-- 4. Moderation flow --------------------------------------------------------
insert into public.price_submissions (id, product_id, branch_id, price, observed_at, user_id, source)
select '00000000-0000-0000-0000-00000000f001', product_id, branch_id, 250, now() - interval '1 hour',
  '00000000-0000-0000-0000-0000000000c1', 'user' from t_ctx;
insert into public.price_evidence (submission_id, storage_path, kind, mime_type, size_bytes)
values ('00000000-0000-0000-0000-00000000f001', 'test/f001.jpg', 'price_tag', 'image/jpeg', 1000);

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
select pg_temp.check((select count(*) from public.price_submissions) = 0,
  'a user cannot see other users'' submissions');
do $$ begin
  perform public.approve_price_submission('00000000-0000-0000-0000-00000000f001', 'verified', null);
  raise exception 'TEST FAILED: regular user must not approve';
exception when insufficient_privilege then raise notice 'ok - regular user cannot approve submissions';
end $$;
select pg_temp.reset();

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.check((select count(*) from public.price_submissions) = 1, 'author sees own submission');
select pg_temp.check((select count(*) from public.price_evidence) = 0, 'author cannot read evidence rows');
select pg_temp.reset();

select pg_temp.as_anon();
select pg_temp.check((select count(*) from public.current_prices c, t_ctx t
  where c.product_id = t.product_id and c.branch_id = t.branch_id) = 0,
  'pending submission is not public');
select pg_temp.reset();

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select public.approve_price_submission('00000000-0000-0000-0000-00000000f001', 'verified', null);
do $$ begin
  perform public.approve_price_submission('00000000-0000-0000-0000-00000000f001', 'verified', null);
  raise exception 'TEST FAILED: double approval must fail';
exception when raise_exception then raise notice 'ok - a submission cannot be approved twice';
end $$;
select pg_temp.reset();

select pg_temp.as_anon();
select pg_temp.check((select price from public.current_prices c, t_ctx t
  where c.product_id = t.product_id and c.branch_id = t.branch_id) = 250,
  'approved price becomes public');
select pg_temp.check((select source_type from public.current_prices c, t_ctx t
  where c.product_id = t.product_id and c.branch_id = t.branch_id) = 'price_tag_photo',
  'source type reflects attached photo');
select pg_temp.check((select count(*) from public.price_history h, t_ctx t
  where h.product_id = t.product_id and h.branch_id = t.branch_id) = 1, 'history row recorded');
select pg_temp.reset();

select pg_temp.check((select points from public.user_reputation
  where user_id = '00000000-0000-0000-0000-0000000000c1') = 15,
  'reputation: 10 for price + 5 for photo');

-- 5. Price precedence rules -------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
-- an estimate must not replace a fresh verified price
select public.staff_upsert_prices(jsonb_build_array(jsonb_build_object(
  'product_id', (select product_id from t_ctx), 'branch_id', (select branch_id from t_ctx),
  'price', 199, 'status', 'estimated', 'source_type', 'store_website',
  'source_note', 'Сайт магазина', 'observed_at', now())));
select pg_temp.check((select price from public.verified_prices v, t_ctx t
  where v.product_id = t.product_id and v.branch_id = t.branch_id) = 250,
  'estimate does not replace a fresh verified price');
-- an older observation must not replace a newer one
select public.staff_upsert_prices(jsonb_build_array(jsonb_build_object(
  'product_id', (select product_id from t_ctx), 'branch_id', (select branch_id from t_ctx),
  'price', 300, 'status', 'verified', 'source_type', 'admin_check',
  'observed_at', now() - interval '3 days')));
select pg_temp.check((select price from public.verified_prices v, t_ctx t
  where v.product_id = t.product_id and v.branch_id = t.branch_id) = 250,
  'older observation does not replace a newer one');
select pg_temp.check((select count(*) from public.price_history h, t_ctx t
  where h.product_id = t.product_id and h.branch_id = t.branch_id) = 3,
  'all accepted observations are kept in history');
-- a newer verified price replaces it
select public.staff_upsert_prices(jsonb_build_array(jsonb_build_object(
  'product_id', (select product_id from t_ctx), 'branch_id', (select branch_id from t_ctx),
  'price', 260, 'status', 'verified', 'source_type', 'admin_check', 'observed_at', now())));
select pg_temp.check((select price from public.verified_prices v, t_ctx t
  where v.product_id = t.product_id and v.branch_id = t.branch_id) = 260,
  'newer verified price replaces the current one');
do $$ begin
  perform public.staff_upsert_prices(jsonb_build_array(jsonb_build_object(
    'product_id', (select product_id from t_ctx), 'branch_id', (select branch2_id from t_ctx),
    'price', 1, 'status', 'verified', 'source_type', 'demo')));
  raise exception 'TEST FAILED: staff must not create DEMO prices';
exception when invalid_parameter_value then raise notice 'ok - staff cannot create DEMO prices';
end $$;
do $$ begin
  perform public.staff_upsert_prices(jsonb_build_array(jsonb_build_object(
    'product_id', (select product_id from t_ctx), 'branch_id', (select branch2_id from t_ctx),
    'price', 100, 'status', 'estimated', 'source_type', 'admin_check')));
  raise exception 'TEST FAILED: estimate without source must fail';
exception when check_violation then raise notice 'ok - estimated price requires a named source';
end $$;
select pg_temp.reset();

-- 6. Stale prices -----------------------------------------------------------
update public.verified_prices v set observed_at = now() - interval '20 days'
from t_ctx t where v.product_id = t.product_id and v.branch_id = t.branch_id;
select pg_temp.check((select effective_status from public.current_prices c, t_ctx t
  where c.product_id = t.product_id and c.branch_id = t.branch_id) = 'stale',
  'price older than price_stale_days is marked stale');

-- 7. Rejection and reports --------------------------------------------------
insert into public.price_submissions (id, product_id, branch_id, price, user_id, source)
select '00000000-0000-0000-0000-00000000f002', product_id, branch_id, 5, '00000000-0000-0000-0000-0000000000c1', 'user'
from t_ctx;
insert into public.reports (id, target_type, target_id, reason, reporter_id)
select '00000000-0000-0000-0000-00000000e001', 'product', product_id, 'wrong_info',
  '00000000-0000-0000-0000-0000000000c2' from t_ctx;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.check((select count(*) from public.moderation_queue) = 2, 'moderation queue lists both items');
select public.reject_price_submission('00000000-0000-0000-0000-00000000f002', 'Неверная цена');
select public.resolve_report('00000000-0000-0000-0000-00000000e001', 'resolve', 'Исправлено');
select pg_temp.check((select count(*) from public.moderation_queue) = 0, 'queue empty after moderation');
select pg_temp.reset();
select pg_temp.check((select points from public.user_reputation
  where user_id = '00000000-0000-0000-0000-0000000000c2') = 5, 'reporter gets points for a confirmed fix');
select pg_temp.check((select points from public.user_reputation
  where user_id = '00000000-0000-0000-0000-0000000000c1') = 15, 'rejected submission gives no points');

-- 8. Admin-only catalog writes and roles ------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  update public.products set name_ru = 'Взлом' where slug = 'kartofel';
  if found then raise exception 'TEST FAILED: moderator must not edit products'; end if;
  raise notice 'ok - moderator cannot edit catalog';
end $$;
do $$ begin
  perform public.admin_set_role('00000000-0000-0000-0000-0000000000c1', 'admin', true);
  raise exception 'TEST FAILED: moderator must not grant roles';
exception when insufficient_privilege then raise notice 'ok - moderator cannot grant roles';
end $$;
select pg_temp.reset();

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  update public.products set popularity = popularity + 1 where slug = 'kartofel';
  if not found then raise exception 'TEST FAILED: admin can edit catalog'; end if;
  raise notice 'ok - admin can edit catalog';
end $$;
do $$ begin
  perform public.admin_set_role('00000000-0000-0000-0000-0000000000a1', 'admin', false);
  raise exception 'TEST FAILED: last admin must not be removable';
exception when raise_exception then raise notice 'ok - the last admin cannot be removed';
end $$;
select pg_temp.check((select count(*) from public.admin_audit_logs) >= 1, 'admin can read audit log');
select pg_temp.reset();

do $$ begin
  insert into public.products (slug, category_id, name_ru, unit)
  select 'kartofel-dup', category_id, 'Картофель', unit from public.products where slug = 'kartofel';
  raise exception 'TEST FAILED: duplicate product must be rejected';
exception when unique_violation then raise notice 'ok - duplicate products are rejected';
end $$;

-- 9. Profiles: users can only change their display name ---------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
update public.profiles set display_name = 'Покупатель' where id = '00000000-0000-0000-0000-0000000000c1';
update public.profiles set display_name = 'Чужой' where id = '00000000-0000-0000-0000-0000000000c2';
do $$ begin
  update public.profiles set email = 'x@y.z' where id = '00000000-0000-0000-0000-0000000000c1';
  raise exception 'TEST FAILED: email must not be user-editable';
exception when insufficient_privilege then raise notice 'ok - users cannot edit their email column';
end $$;
select pg_temp.reset();
select pg_temp.check((select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000c2') is null,
  'users cannot edit other profiles');

-- 10. Personal data deletion ------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.check(array_length(public.delete_my_data(), 1) = 1, 'delete_my_data returns evidence paths');
select pg_temp.reset();
select pg_temp.check((select count(*) from public.price_submissions
  where user_id = '00000000-0000-0000-0000-0000000000c1') = 0, 'submissions are unlinked from the user');
select pg_temp.check((select count(*) from public.user_reputation
  where user_id = '00000000-0000-0000-0000-0000000000c1') = 0, 'reputation removed');
select pg_temp.check((select count(*) from public.verified_prices v, t_ctx t
  where v.product_id = t.product_id and v.branch_id = t.branch_id) = 1, 'accepted public prices are kept');

rollback;
\echo 'ALL DATABASE TESTS PASSED'
