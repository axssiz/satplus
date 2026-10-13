-- Sat+ — «Новости Сатпаева»: categories, articles, reader suggestions and moderation.
-- Articles are written or approved by staff only. Reader suggestions are private until a
-- moderator turns them into an article; nothing is published automatically.

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------
create table public.news_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,64}$'),
  name_ru text not null check (char_length(name_ru) between 2 and 60),
  name_kk text not null check (char_length(name_kk) between 2 and 60),
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger news_categories_updated_at before update on public.news_categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Articles. Each article is written in one language (lang); the UI labels it when the
-- reader's language differs. A source is mandatory: Sat+ does not publish unsourced news.
-- ---------------------------------------------------------------------------
create table public.news (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,120}$'),
  category_id uuid references public.news_categories (id) on delete set null,
  lang text not null default 'ru' check (lang in ('ru', 'kk')),
  title text not null check (char_length(title) between 5 and 200),
  summary text check (summary is null or char_length(summary) <= 400),
  body text not null check (char_length(body) between 20 and 20000),
  cover_path text,
  cover_alt text check (cover_alt is null or char_length(cover_alt) <= 200),
  source_name text not null check (char_length(source_name) between 2 and 120),
  source_url text check (source_url is null or source_url ~ '^https://'),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_important boolean not null default false,
  -- Paid placement must always be labelled in the UI ("Реклама"/"Партнёрский материал").
  is_sponsored boolean not null default false,
  published_at timestamptz,
  submission_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint news_published_has_date check (status <> 'published' or published_at is not null)
);
create trigger news_updated_at before update on public.news
  for each row execute function public.set_updated_at();

create index news_public_feed_idx on public.news (city_id, published_at desc) where status = 'published';
create index news_category_idx on public.news (category_id, published_at desc);
create index news_search_idx on public.news using gin (search_text extensions.gin_trgm_ops);

create or replace function public.news_build_search_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_text := lower(concat_ws(' ', new.title, new.summary, new.source_name));
  return new;
end;
$$;
create trigger news_search_text before insert or update of title, summary, source_name on public.news
  for each row execute function public.news_build_search_text();

-- ---------------------------------------------------------------------------
-- Reader suggestions (private). Contact is optional and visible to staff only.
-- ---------------------------------------------------------------------------
create table public.news_submissions (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id),
  category_id uuid references public.news_categories (id) on delete set null,
  title text not null check (char_length(title) between 5 and 200),
  body text not null check (char_length(body) between 20 and 5000),
  source_url text check (source_url is null or source_url ~ '^https://'),
  contact text check (contact is null or char_length(contact) <= 120),
  photo_path text,
  user_id uuid references auth.users (id) on delete set null,
  client_hash text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text check (reject_reason is null or char_length(reject_reason) <= 300),
  news_id uuid references public.news (id) on delete set null,
  moderated_by uuid references auth.users (id) on delete set null,
  moderated_at timestamptz,
  created_at timestamptz not null default now()
);
create index news_submissions_pending_idx on public.news_submissions (created_at) where status = 'pending';
create index news_submissions_client_idx on public.news_submissions (client_hash, created_at desc);
create index news_submissions_user_idx on public.news_submissions (user_id, created_at desc);

alter table public.news
  add constraint news_submission_fk foreign key (submission_id) references public.news_submissions (id) on delete set null;

-- Moderation log accepts the new target type.
alter table public.moderation_actions drop constraint moderation_actions_target_type_check;
alter table public.moderation_actions add constraint moderation_actions_target_type_check
  check (target_type in ('price_submission', 'report', 'news_submission'));
alter table public.moderation_actions drop constraint moderation_actions_action_check;
alter table public.moderation_actions add constraint moderation_actions_action_check
  check (action in ('approve', 'reject', 'resolve', 'dismiss', 'publish'));

-- Moderation queue now includes news suggestions.
create or replace view public.moderation_queue
with (security_invoker = true) as
select 'price_submission'::text as item_type, ps.id, ps.created_at, ps.is_anomalous as flagged
from public.price_submissions ps
where ps.status = 'pending'
union all
select 'report'::text, r.id, r.created_at, false
from public.reports r
where r.status = 'open'
union all
select 'news_submission'::text, ns.id, ns.created_at, false
from public.news_submissions ns
where ns.status = 'pending';

-- ---------------------------------------------------------------------------
-- Staff functions
-- ---------------------------------------------------------------------------

-- Create or update an article. When p_submission_id is given, the suggestion is marked
-- approved and linked in the same transaction.
create or replace function public.staff_save_news(p jsonb, p_submission_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_status text := coalesce(p->>'status', 'draft');
  v_published_at timestamptz := nullif(p->>'published_at', '')::timestamptz;
  v_city uuid;
  v_sub_status text;
begin
  if not public.is_moderator() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_status = 'published' and v_published_at is null then
    v_published_at := now();
  end if;
  if v_published_at is not null and v_published_at > now() + interval '1 year' then
    raise exception 'published_at is too far in the future' using errcode = '22023';
  end if;
  if coalesce((p->>'is_sponsored')::boolean, false) and not public.is_admin() then
    raise exception 'only admins can mark sponsored content' using errcode = '42501';
  end if;

  select id into v_city from public.cities where slug = coalesce(nullif(p->>'city_slug', ''), 'satpaev');
  if v_city is null then
    raise exception 'city not found' using errcode = 'P0002';
  end if;

  if p_submission_id is not null then
    select status into v_sub_status from public.news_submissions where id = p_submission_id for update;
    if not found then
      raise exception 'submission not found' using errcode = 'P0002';
    end if;
    if v_sub_status <> 'pending' then
      raise exception 'submission already moderated' using errcode = 'P0001';
    end if;
  end if;

  if v_id is null then
    insert into public.news (
      city_id, slug, category_id, lang, title, summary, body, cover_path, cover_alt,
      source_name, source_url, status, is_important, is_sponsored, published_at,
      submission_id, created_by, updated_by)
    values (
      v_city, p->>'slug', nullif(p->>'category_id', '')::uuid, coalesce(p->>'lang', 'ru'),
      p->>'title', nullif(p->>'summary', ''), p->>'body', nullif(p->>'cover_path', ''), nullif(p->>'cover_alt', ''),
      p->>'source_name', nullif(p->>'source_url', ''), v_status,
      coalesce((p->>'is_important')::boolean, false), coalesce((p->>'is_sponsored')::boolean, false),
      v_published_at, p_submission_id, auth.uid(), auth.uid())
    returning id into v_id;
    perform public.write_audit('news.create', 'news', v_id, jsonb_build_object('status', v_status, 'slug', p->>'slug'));
  else
    update public.news set
      slug = p->>'slug',
      category_id = nullif(p->>'category_id', '')::uuid,
      lang = coalesce(p->>'lang', 'ru'),
      title = p->>'title',
      summary = nullif(p->>'summary', ''),
      body = p->>'body',
      cover_path = case when p ? 'cover_path' then nullif(p->>'cover_path', '') else cover_path end,
      cover_alt = nullif(p->>'cover_alt', ''),
      source_name = p->>'source_name',
      source_url = nullif(p->>'source_url', ''),
      status = v_status,
      is_important = coalesce((p->>'is_important')::boolean, false),
      is_sponsored = case when public.is_admin() then coalesce((p->>'is_sponsored')::boolean, false) else is_sponsored end,
      published_at = v_published_at,
      updated_by = auth.uid()
    where id = v_id;
    if not found then
      raise exception 'news not found' using errcode = 'P0002';
    end if;
    perform public.write_audit('news.update', 'news', v_id, jsonb_build_object('status', v_status));
  end if;

  if p_submission_id is not null then
    update public.news_submissions
    set status = 'approved', news_id = v_id, moderated_by = auth.uid(), moderated_at = now()
    where id = p_submission_id;
    insert into public.moderation_actions (moderator_id, target_type, target_id, action, reason)
    values (auth.uid(), 'news_submission', p_submission_id, 'publish', null);
  end if;

  return v_id;
end;
$$;

create or replace function public.reject_news_submission(p_submission_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if not public.is_moderator() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select status into v_status from public.news_submissions where id = p_submission_id for update;
  if not found then
    raise exception 'submission not found' using errcode = 'P0002';
  end if;
  if v_status <> 'pending' then
    raise exception 'submission already moderated' using errcode = 'P0001';
  end if;
  update public.news_submissions
  set status = 'rejected', reject_reason = left(p_reason, 300), moderated_by = auth.uid(), moderated_at = now()
  where id = p_submission_id;
  insert into public.moderation_actions (moderator_id, target_type, target_id, action, reason)
  values (auth.uid(), 'news_submission', p_submission_id, 'reject', left(p_reason, 300));
end;
$$;

create or replace function public.staff_delete_news(p_news_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.news where id = p_news_id;
  if not found then
    raise exception 'news not found' using errcode = 'P0002';
  end if;
  perform public.write_audit('news.delete', 'news', p_news_id, '{}'::jsonb);
end;
$$;

-- Public, paginated feed with optional category and text search.
create or replace function public.search_news(
  p_query text default null,
  p_category text default null,
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  id uuid, slug text, category_slug text, lang text, title text, summary text, cover_path text,
  cover_alt text, source_name text, is_important boolean, is_sponsored boolean,
  published_at timestamptz, total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (select nullif(lower(trim(coalesce(p_query, ''))), '') as text)
  select n.id, n.slug, c.slug, n.lang, n.title, n.summary, n.cover_path, n.cover_alt, n.source_name,
         n.is_important, n.is_sponsored, n.published_at, count(*) over ()
  from public.news n
  left join public.news_categories c on c.id = n.category_id
  cross join q
  where n.status = 'published'
    and n.published_at <= now()
    and (p_category is null or c.slug = p_category)
    and (q.text is null or n.search_text like '%' || replace(replace(replace(q.text, '\', '\\'), '%', '\%'), '_', '\_') || '%')
  order by n.published_at desc
  limit least(greatest(coalesce(p_limit, 12), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- Account deletion also covers news suggestions.
create or replace function public.delete_my_data()
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_paths text[];
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select coalesce(array_agg(e.storage_path), '{}') into v_paths
  from public.price_evidence e
  join public.price_submissions s on s.id = e.submission_id
  where s.user_id = v_uid;

  delete from public.price_evidence e
  using public.price_submissions s
  where s.id = e.submission_id and s.user_id = v_uid;
  delete from public.price_submissions where user_id = v_uid and status = 'pending';
  -- Accepted prices are public facts; keep them but drop the link to the person.
  update public.price_submissions set user_id = null, client_hash = null, comment = null where user_id = v_uid;
  update public.reports set reporter_id = null, client_hash = null where reporter_id = v_uid;
  delete from public.price_requests where user_id = v_uid;
  delete from public.shopping_lists where user_id = v_uid;
  delete from public.reputation_events where user_id = v_uid;
  delete from public.user_reputation where user_id = v_uid;
  -- News suggestions: drop unmoderated ones, anonymise the rest (photos are removed by the server first).
  delete from public.news_submissions where user_id = v_uid and status <> 'approved';
  update public.news_submissions set user_id = null, client_hash = null, contact = null where user_id = v_uid;
  update public.profiles set display_name = null, email = null where id = v_uid;
  return v_paths;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS and grants
-- ---------------------------------------------------------------------------
alter table public.news_categories enable row level security;
alter table public.news enable row level security;
alter table public.news_submissions enable row level security;

grant select on public.news_categories, public.news to anon, authenticated;
grant insert, update, delete on public.news_categories to authenticated;
grant select on public.news_submissions to authenticated;

create policy news_categories_read on public.news_categories for select using (is_active or public.is_moderator());
create policy news_categories_admin on public.news_categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Readers see only published, already-dated articles; staff see everything.
create policy news_read on public.news for select
  using ((status = 'published' and published_at <= now()) or public.is_moderator());
-- Article writes go through staff_save_news / staff_delete_news (no direct table writes).

create policy news_submissions_staff_read on public.news_submissions for select to authenticated
  using (public.is_moderator() or user_id = auth.uid());
-- Inserts happen on the server (validated, rate limited) with the service role.

grant execute on function public.staff_save_news(jsonb, uuid), public.reject_news_submission(uuid, text),
  public.staff_delete_news(uuid) to authenticated;
grant execute on function public.search_news(text, text, integer, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: public covers (staff write), private reader photos (server writes, staff read)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('news-images', 'news-images', true, 3145728, array['image/jpeg', 'image/png', 'image/webp']),
  ('news-submissions', 'news-submissions', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy news_images_read on storage.objects for select
  using (bucket_id = 'news-images');
create policy news_images_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'news-images' and public.is_moderator());
create policy news_images_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'news-images' and public.is_moderator());
create policy news_images_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'news-images' and public.is_moderator());
create policy news_submissions_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'news-submissions' and public.is_moderator());

-- ---------------------------------------------------------------------------
-- Reference data: categories only (no articles are seeded).
-- ---------------------------------------------------------------------------
insert into public.news_categories (slug, name_ru, name_kk, sort_order) values
  ('city', 'Город', 'Қала', 10),
  ('announcements', 'Объявления', 'Хабарландырулар', 20),
  ('utilities', 'ЖКХ и дороги', 'ТКШ және жолдар', 30),
  ('society', 'Общество', 'Қоғам', 40),
  ('education', 'Образование', 'Білім', 50),
  ('culture', 'Культура', 'Мәдениет', 60),
  ('sport', 'Спорт', 'Спорт', 70),
  ('business', 'Экономика и бизнес', 'Экономика және бизнес', 80)
on conflict (slug) do nothing;
