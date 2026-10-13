-- Database tests for the «Новости» module (RLS, publishing, moderation of suggestions).
-- Run against a LOCAL/STAGING database with migrations + seed.sql applied:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/news_test.sql
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
  ('00000000-0000-0000-0000-00000000aa01', 'admin@newstest.invalid'),
  ('00000000-0000-0000-0000-00000000bb01', 'mod@newstest.invalid'),
  ('00000000-0000-0000-0000-00000000cc01', 'user@newstest.invalid');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-00000000aa01', 'admin'),
  ('00000000-0000-0000-0000-00000000bb01', 'moderator');

-- 1. Reference data: categories only, no articles ---------------------------
select pg_temp.check((select count(*) from public.news_categories) >= 8, 'news categories are seeded');
select pg_temp.check((select count(*) from public.news) = 0, 'no articles are seeded');

-- 2. Anonymous and regular users cannot write -------------------------------
select pg_temp.as_anon();
do $$ begin
  insert into public.news (city_id, slug, title, body, source_name)
  select id, 'x-anon', 'Заголовок', repeat('текст ', 10), 'Источник' from public.cities limit 1;
  raise exception 'TEST FAILED: anon must not insert news';
exception when insufficient_privilege then raise notice 'ok - anon cannot insert news';
end $$;
do $$ begin
  perform count(*) from public.news_submissions;
  raise exception 'TEST FAILED: anon must not read news_submissions';
exception when insufficient_privilege then raise notice 'ok - anon cannot read news suggestions';
end $$;
select pg_temp.reset();

select pg_temp.as_user('00000000-0000-0000-0000-00000000cc01');
do $$ begin
  perform public.staff_save_news('{"slug":"x-user","title":"Заголовок новости","body":"Достаточно длинный текст новости.","source_name":"Источник","status":"published"}'::jsonb, null);
  raise exception 'TEST FAILED: regular user must not publish';
exception when insufficient_privilege then raise notice 'ok - regular user cannot publish news';
end $$;
select pg_temp.reset();

-- 3. A reader suggestion (inserted by the server) is private ----------------
insert into public.news_submissions (id, city_id, title, body, contact, client_hash, user_id)
select '00000000-0000-0000-0000-0000000000f1', id, 'Ремонт дороги на улице',
  'Жители сообщают, что начался ремонт дороги, источник приложен.', '+7 700 000 00 00', 'hash-1',
  '00000000-0000-0000-0000-00000000cc01'
from public.cities where slug = 'satpaev';
insert into public.news_submissions (id, city_id, title, body, client_hash)
select '00000000-0000-0000-0000-0000000000f2', id, 'Ещё одно предложение',
  'Текст второго предложения новости для проверки отклонения.', 'hash-2'
from public.cities where slug = 'satpaev';

select pg_temp.check((select count(*) from public.moderation_queue where item_type = 'news_submission') = 2,
  'suggestions appear in the moderation queue');

select pg_temp.as_user('00000000-0000-0000-0000-00000000cc01');
select pg_temp.check((select count(*) from public.news_submissions) = 1, 'author sees only own suggestion');
select pg_temp.reset();

-- 4. Moderator publishes from a suggestion; drafts stay hidden ---------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000bb01');
select pg_temp.check((select count(*) from public.news_submissions) = 2, 'moderator sees all suggestions');
do $$
declare v uuid;
begin
  v := public.staff_save_news(jsonb_build_object(
    'slug', 'remont-dorogi', 'title', 'Начался ремонт дороги', 'body', 'Подробный текст новости о ремонте дороги.',
    'source_name', 'Сообщение жителя, проверено редакцией', 'status', 'published',
    'category_id', (select id from public.news_categories where slug = 'utilities')),
    '00000000-0000-0000-0000-0000000000f1');
  perform pg_temp.check(v is not null, 'moderator publishes an article from a suggestion');
end $$;
do $$ begin
  perform public.staff_save_news('{"slug":"remont-2","title":"Повторная публикация","body":"Повторная попытка опубликовать то же предложение.","source_name":"Источник","status":"published"}'::jsonb,
    '00000000-0000-0000-0000-0000000000f1');
  raise exception 'TEST FAILED: suggestion must not be used twice';
exception when others then
  if sqlerrm like 'TEST FAILED%' then raise; end if;
  raise notice 'ok - an already moderated suggestion cannot be published twice';
end $$;
select public.staff_save_news('{"slug":"chernovik","title":"Черновик новости","body":"Этот черновик не должен быть виден читателям.","source_name":"Редакция","status":"draft"}'::jsonb, null);
select public.staff_save_news(jsonb_build_object('slug','budushchaya','title','Запланированная новость',
  'body','Эта новость запланирована на завтра и пока скрыта.','source_name','Редакция','status','published',
  'published_at', (now() + interval '1 day')::text), null);
do $$ begin
  perform public.staff_save_news('{"slug":"sponsored","title":"Партнёрский материал","body":"Модератор не может отметить рекламу.","source_name":"Партнёр","status":"draft","is_sponsored":true}'::jsonb, null);
  raise exception 'TEST FAILED: moderator must not mark sponsored content';
exception when insufficient_privilege then raise notice 'ok - only admins can mark sponsored content';
end $$;
select public.reject_news_submission('00000000-0000-0000-0000-0000000000f2', 'Нет источника');
select pg_temp.reset();

select pg_temp.check((select status from public.news_submissions where id = '00000000-0000-0000-0000-0000000000f1') = 'approved'
  and (select news_id from public.news_submissions where id = '00000000-0000-0000-0000-0000000000f1') is not null,
  'suggestion is marked approved and linked to the article');
select pg_temp.check((select status from public.news_submissions where id = '00000000-0000-0000-0000-0000000000f2') = 'rejected',
  'suggestion can be rejected with a reason');
select pg_temp.check((select count(*) from public.moderation_actions where target_type = 'news_submission') = 2,
  'moderation decisions are logged');
select pg_temp.check((select count(*) from public.admin_audit_logs where entity_type = 'news') = 3,
  'article changes are written to the audit log');

-- 5. What readers see --------------------------------------------------------
select pg_temp.as_anon();
select pg_temp.check((select count(*) from public.news) = 1, 'anon sees only published, already dated articles');
select pg_temp.check((select count(*) from public.search_news(null, null, 12, 0)) = 1, 'public feed lists the published article');
select pg_temp.check((select count(*) from public.search_news('ремонт', null, 12, 0)) = 1, 'feed search finds by title');
select pg_temp.check((select count(*) from public.search_news('несуществующее', null, 12, 0)) = 0, 'feed search excludes non-matching');
select pg_temp.check((select count(*) from public.search_news(null, 'utilities', 12, 0)) = 1
  and (select count(*) from public.search_news(null, 'sport', 12, 0)) = 0, 'feed filters by category');
select pg_temp.check((select count(*) from public.search_news('100%_', null, 12, 0)) = 0, 'LIKE wildcards in search are escaped');
select pg_temp.reset();

-- 6. Only admins delete; account deletion removes private suggestion data ----
select pg_temp.as_user('00000000-0000-0000-0000-00000000bb01');
do $$ begin
  perform public.staff_delete_news((select id from public.news where slug = 'chernovik'));
  raise exception 'TEST FAILED: moderator must not delete news';
exception when insufficient_privilege then raise notice 'ok - moderators cannot delete articles';
end $$;
select pg_temp.reset();
select pg_temp.as_user('00000000-0000-0000-0000-00000000aa01');
select public.staff_delete_news((select id from public.news where slug = 'chernovik'));
select pg_temp.reset();
select pg_temp.check((select count(*) from public.news where slug = 'chernovik') = 0, 'admin deletes an article');

select pg_temp.as_user('00000000-0000-0000-0000-00000000cc01');
select public.delete_my_data();
select pg_temp.reset();
select pg_temp.check((select user_id is null and contact is null and client_hash is null
  from public.news_submissions where id = '00000000-0000-0000-0000-0000000000f1'),
  'account deletion unlinks the person from published suggestions');

rollback;
\echo 'ALL NEWS TESTS PASSED'
