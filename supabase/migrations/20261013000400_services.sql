-- Sat+ — «Услуги и мастера»: listings that craftspeople and service providers publish about themselves.
-- A signed-in user submits a listing; a moderator approves or rejects it. Listings expire after 90 days
-- unless the owner renews them, so the catalogue does not fill up with stale phone numbers.
-- Only categories are seeded. No listings are created by the migration.

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,64}$'),
  name_ru text not null check (char_length(name_ru) between 2 and 60),
  name_kk text not null check (char_length(name_kk) between 2 and 60),
  -- lucide icon name, mapped on the client; unknown names fall back to a generic icon.
  icon text not null default 'wrench' check (icon ~ '^[a-z0-9-]{2,40}$'),
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger service_categories_updated_at before update on public.service_categories
  for each row execute function public.set_updated_at();

insert into public.service_categories (slug, name_ru, name_kk, icon, sort_order) values
  ('repair', 'Ремонт и отделка', 'Жөндеу және әрлеу', 'hammer', 10),
  ('plumbing', 'Сантехника', 'Сантехника', 'droplets', 20),
  ('electric', 'Электрика', 'Электрика', 'zap', 30),
  ('appliances', 'Ремонт техники', 'Техника жөндеу', 'washing-machine', 40),
  ('computers', 'Компьютеры и телефоны', 'Компьютерлер мен телефондар', 'smartphone', 50),
  ('cleaning', 'Уборка', 'Тазалау', 'sparkles', 60),
  ('moving', 'Грузоперевозки', 'Жүк тасымалдау', 'truck', 70),
  ('auto', 'Автоуслуги', 'Авто қызметтері', 'car', 80),
  ('beauty', 'Красота', 'Сұлулық', 'scissors', 90),
  ('tutoring', 'Репетиторы и курсы', 'Репетиторлар мен курстар', 'graduation-cap', 100),
  ('photo', 'Фото и видео', 'Фото және бейне', 'camera', 110),
  ('events', 'Праздники', 'Мерекелер', 'party-popper', 120),
  ('sewing', 'Пошив и ремонт одежды', 'Киім тігу және жөндеу', 'shirt', 130),
  ('other', 'Другое', 'Басқа', 'wrench', 1000);

create table public.service_listings (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,120}$'),
  category_id uuid references public.service_categories (id) on delete set null,
  title text not null check (char_length(title) between 5 and 120),
  -- How the provider wants to be called: a first name, «Бригада Асхата», «ИП …».
  provider_name text not null check (char_length(provider_name) between 2 and 80),
  description text not null check (char_length(description) between 20 and 3000),
  -- Exactly as the provider wrote it, e.g. «от 5 000 ₸ за выезд». Never computed or compared.
  price_note text check (price_note is null or char_length(price_note) <= 120),
  area text check (area is null or char_length(area) <= 120),
  phone text not null check (phone ~ '^\+?[0-9 ()-]{6,24}$'),
  has_whatsapp boolean not null default false,
  link_url text check (link_url is null or link_url ~ '^https://'),
  cover_path text,
  cover_alt text check (cover_alt is null or char_length(cover_alt) <= 200),
  -- Owner (the provider). NULL only for listings staff added from a verified source.
  owner_id uuid references auth.users (id) on delete cascade,
  source_name text check (source_name is null or char_length(source_name) between 2 and 120),
  -- The owner agreed to publish the contacts above.
  consent_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected', 'archived')),
  reject_reason text check (reject_reason is null or char_length(reject_reason) <= 300),
  -- Paid placement; always labelled, never moves a listing up.
  is_sponsored boolean not null default false,
  expires_on date,
  published_at timestamptz,
  moderated_by uuid references auth.users (id) on delete set null,
  moderated_at timestamptz,
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (owner_id is not null or source_name is not null),
  check (owner_id is null or consent_at is not null),
  check (status <> 'published' or expires_on is not null),
  check (status <> 'rejected' or reject_reason is not null)
);
create trigger service_listings_updated_at before update on public.service_listings
  for each row execute function public.set_updated_at();
create index service_listings_public_idx on public.service_listings (city_id, published_at desc) where status = 'published';
create index service_listings_owner_idx on public.service_listings (owner_id, created_at desc);
create index service_listings_pending_idx on public.service_listings (created_at) where status = 'pending';
create index service_listings_category_idx on public.service_listings (category_id);
create index service_listings_search_idx on public.service_listings using gin (search_text extensions.gin_trgm_ops);

create or replace function public.service_listings_build_search_text()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.search_text := lower(concat_ws(' ', new.title, new.provider_name, new.description, new.area,
    (select concat_ws(' ', c.name_ru, c.name_kk) from public.service_categories c where c.id = new.category_id)));
  return new;
end;
$$;
create trigger service_listings_search_text
  before insert or update of title, provider_name, description, area, category_id on public.service_listings
  for each row execute function public.service_listings_build_search_text();

-- Complaints about user listings (services now; jobs and classifieds will reuse it).
create table public.listing_complaints (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('service_listing')),
  target_id uuid not null,
  reason text not null check (reason in ('fraud', 'spam', 'wrong_contacts', 'not_actual', 'offensive', 'other')),
  message text check (message is null or char_length(message) <= 1000),
  reporter_id uuid references auth.users (id) on delete set null,
  client_hash text check (client_hash is null or char_length(client_hash) = 64),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 300),
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index listing_complaints_open_idx on public.listing_complaints (created_at) where status = 'open';
create index listing_complaints_target_idx on public.listing_complaints (target_type, target_id);
create index listing_complaints_client_idx on public.listing_complaints (client_hash, created_at desc);

create or replace function public.service_listings_drop_complaints()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.listing_complaints where target_type = 'service_listing' and target_id = old.id;
  return old;
end;
$$;
create trigger service_listings_drop_complaints after delete on public.service_listings
  for each row execute function public.service_listings_drop_complaints();

alter table public.moderation_actions drop constraint moderation_actions_target_type_check;
alter table public.moderation_actions add constraint moderation_actions_target_type_check
  check (target_type in ('price_submission', 'report', 'news_submission', 'promotion_submission', 'business_submission',
    'service_listing', 'listing_complaint'));

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
where ns.status = 'pending'
union all
select 'promotion_submission'::text, pr.id, pr.created_at, false
from public.promotion_submissions pr
where pr.status = 'pending'
union all
select 'business_submission'::text, bs.id, bs.created_at, false
from public.business_submissions bs
where bs.status = 'pending'
union all
select 'service_listing'::text, sl.id, sl.created_at, false
from public.service_listings sl
where sl.status = 'pending'
union all
select 'listing_complaint'::text, lc.id, lc.created_at, lc.reason = 'fraud'
from public.listing_complaints lc
where lc.status = 'open';

-- ---------------------------------------------------------------------------
-- Owner functions
-- ---------------------------------------------------------------------------

-- Listing lifetime in days; the owner renews it from «Мои объявления».
create or replace function public.service_listing_days()
returns integer
language sql
immutable
set search_path = ''
as $$ select 90 $$;

-- A free slug based on p_base (the server passes a transliterated title).
create or replace function public.service_listing_free_slug(p_base text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text := p_base;
begin
  if p_base !~ '^[a-z0-9-]{2,110}$' then
    raise exception 'invalid slug' using errcode = '22023';
  end if;
  while exists (select 1 from public.service_listings where slug = v_slug) loop
    v_slug := p_base || '-' || substr(md5(gen_random_uuid()::text), 1, 5);
  end loop;
  return v_slug;
end;
$$;

-- The signed-in user submits a listing. It is hidden until a moderator approves it.
create or replace function public.submit_service_listing(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_city uuid;
  v_category uuid := nullif(p->>'category_id', '')::uuid;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if (select count(*) from public.service_listings where owner_id = v_uid and status in ('pending', 'published')) >= 5 then
    raise exception 'service_active_limit' using errcode = 'P0001';
  end if;
  if (select count(*) from public.service_listings where owner_id = v_uid and created_at > now() - interval '1 day') >= 3 then
    raise exception 'service_daily_limit' using errcode = 'P0001';
  end if;
  if v_category is null or not exists (select 1 from public.service_categories where id = v_category and is_active) then
    raise exception 'category not found' using errcode = 'P0002';
  end if;
  select id into v_city from public.cities where slug = 'satpaev';

  insert into public.service_listings (
    city_id, slug, category_id, title, provider_name, description, price_note, area, phone, has_whatsapp,
    link_url, cover_path, cover_alt, owner_id, consent_at, status)
  values (
    v_city, public.service_listing_free_slug(p->>'slug'), v_category, p->>'title', p->>'provider_name', p->>'description',
    nullif(p->>'price_note', ''), nullif(p->>'area', ''), p->>'phone', coalesce((p->>'has_whatsapp')::boolean, false),
    nullif(p->>'link_url', ''), nullif(p->>'cover_path', ''), nullif(p->>'cover_alt', ''), v_uid, now(), 'pending')
  returning id into v_id;
  return v_id;
end;
$$;

-- The owner edits a listing. Any change goes back to moderation; the publication period is kept.
create or replace function public.update_my_service_listing(p_id uuid, p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category uuid := nullif(p->>'category_id', '')::uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if v_category is null or not exists (select 1 from public.service_categories where id = v_category and is_active) then
    raise exception 'category not found' using errcode = 'P0002';
  end if;
  update public.service_listings set
    category_id = v_category,
    title = p->>'title',
    provider_name = p->>'provider_name',
    description = p->>'description',
    price_note = nullif(p->>'price_note', ''),
    area = nullif(p->>'area', ''),
    phone = p->>'phone',
    has_whatsapp = coalesce((p->>'has_whatsapp')::boolean, false),
    link_url = nullif(p->>'link_url', ''),
    cover_path = case when p ? 'cover_path' then nullif(p->>'cover_path', '') else cover_path end,
    cover_alt = nullif(p->>'cover_alt', ''),
    consent_at = now(),
    status = 'pending',
    reject_reason = null,
    moderated_by = null,
    moderated_at = null
  where id = p_id and owner_id = auth.uid();
  if not found then
    raise exception 'listing not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Hide, show again (back to moderation) or renew for another 90 days.
create or replace function public.my_service_listing_action(p_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select status, expires_on into v_row from public.service_listings where id = p_id and owner_id = auth.uid() for update;
  if not found then
    raise exception 'listing not found' using errcode = 'P0002';
  end if;
  case p_action
    when 'archive' then
      if v_row.status = 'archived' then
        raise exception 'service_wrong_state' using errcode = 'P0001';
      end if;
      update public.service_listings set status = 'archived' where id = p_id;
    when 'restore' then
      if v_row.status <> 'archived' then
        raise exception 'service_wrong_state' using errcode = 'P0001';
      end if;
      update public.service_listings
      set status = 'pending', reject_reason = null, moderated_by = null, moderated_at = null
      where id = p_id;
    when 'renew' then
      -- Renewal is allowed in the last 30 days or after expiry; it never moves the listing up.
      if v_row.status <> 'published' or v_row.expires_on > public.city_today() + 30 then
        raise exception 'service_renew_too_early' using errcode = 'P0001';
      end if;
      update public.service_listings
      set expires_on = public.city_today() + public.service_listing_days()
      where id = p_id;
    else
      raise exception 'unknown action' using errcode = '22023';
  end case;
end;
$$;

-- Returns the cover path so the server can remove the file.
create or replace function public.delete_my_service_listing(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cover text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  delete from public.service_listings where id = p_id and owner_id = auth.uid() returning cover_path into v_cover;
  if not found then
    raise exception 'listing not found' using errcode = 'P0002';
  end if;
  return v_cover;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff functions
-- ---------------------------------------------------------------------------

create or replace function public.staff_moderate_service_listing(p_id uuid, p_action text, p_reason text default null)
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
  select status into v_status from public.service_listings where id = p_id for update;
  if not found then
    raise exception 'listing not found' using errcode = 'P0002';
  end if;
  if v_status <> 'pending' then
    raise exception 'listing already moderated' using errcode = 'P0001';
  end if;
  if p_action = 'approve' then
    update public.service_listings set
      status = 'published',
      expires_on = greatest(coalesce(expires_on, public.city_today()), public.city_today() + public.service_listing_days()),
      published_at = coalesce(published_at, now()),
      moderated_by = auth.uid(),
      moderated_at = now()
    where id = p_id;
  elsif p_action = 'reject' then
    if coalesce(trim(p_reason), '') = '' then
      raise exception 'reason required' using errcode = '22023';
    end if;
    update public.service_listings set
      status = 'rejected', reject_reason = left(trim(p_reason), 300), moderated_by = auth.uid(), moderated_at = now()
    where id = p_id;
  else
    raise exception 'unknown action' using errcode = '22023';
  end if;
  insert into public.moderation_actions (moderator_id, target_type, target_id, action, reason)
  values (auth.uid(), 'service_listing', p_id, case when p_action = 'approve' then 'publish' else 'reject' end,
    case when p_action = 'reject' then left(trim(p_reason), 300) end);
  perform public.write_audit('service_listing.' || p_action, 'service_listing', p_id, '{}'::jsonb);
end;
$$;

-- Staff create a listing from a verified source (no owner) or correct any listing.
create or replace function public.staff_save_service_listing(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_status text := coalesce(nullif(p->>'status', ''), 'published');
  v_expires date := nullif(p->>'expires_on', '')::date;
  v_city uuid;
begin
  if not public.is_moderator() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce((p->>'is_sponsored')::boolean, false) and not public.is_admin() then
    raise exception 'only admins can mark sponsored content' using errcode = '42501';
  end if;
  if v_status not in ('pending', 'published', 'archived') then
    raise exception 'invalid status' using errcode = '22023';
  end if;
  if v_status = 'published' and v_expires is null then
    v_expires := public.city_today() + public.service_listing_days();
  end if;

  if v_id is null then
    select id into v_city from public.cities where slug = 'satpaev';
    insert into public.service_listings (
      city_id, slug, category_id, title, provider_name, description, price_note, area, phone, has_whatsapp, link_url,
      cover_path, cover_alt, source_name, status, is_sponsored, expires_on, published_at, moderated_by, moderated_at)
    values (
      v_city, public.service_listing_free_slug(p->>'slug'), nullif(p->>'category_id', '')::uuid, p->>'title',
      p->>'provider_name', p->>'description', nullif(p->>'price_note', ''), nullif(p->>'area', ''), p->>'phone',
      coalesce((p->>'has_whatsapp')::boolean, false), nullif(p->>'link_url', ''), nullif(p->>'cover_path', ''),
      nullif(p->>'cover_alt', ''), nullif(p->>'source_name', ''), v_status, coalesce((p->>'is_sponsored')::boolean, false),
      v_expires, case when v_status = 'published' then now() end, auth.uid(), now())
    returning id into v_id;
    perform public.write_audit('service_listing.create', 'service_listing', v_id, jsonb_build_object('status', v_status));
  else
    update public.service_listings set
      slug = p->>'slug',
      category_id = nullif(p->>'category_id', '')::uuid,
      title = p->>'title',
      provider_name = p->>'provider_name',
      description = p->>'description',
      price_note = nullif(p->>'price_note', ''),
      area = nullif(p->>'area', ''),
      phone = p->>'phone',
      has_whatsapp = coalesce((p->>'has_whatsapp')::boolean, false),
      link_url = nullif(p->>'link_url', ''),
      cover_path = case when p ? 'cover_path' then nullif(p->>'cover_path', '') else cover_path end,
      cover_alt = nullif(p->>'cover_alt', ''),
      source_name = coalesce(nullif(p->>'source_name', ''), source_name),
      status = v_status,
      reject_reason = null,
      expires_on = coalesce(v_expires, expires_on),
      published_at = case when v_status = 'published' then coalesce(published_at, now()) else published_at end,
      is_sponsored = case when public.is_admin() then coalesce((p->>'is_sponsored')::boolean, false) else is_sponsored end,
      moderated_by = auth.uid(),
      moderated_at = now()
    where id = v_id;
    if not found then
      raise exception 'listing not found' using errcode = 'P0002';
    end if;
    perform public.write_audit('service_listing.update', 'service_listing', v_id, jsonb_build_object('status', v_status));
  end if;
  return v_id;
end;
$$;

create or replace function public.staff_delete_service_listing(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cover text;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.service_listings where id = p_id returning cover_path into v_cover;
  if not found then
    raise exception 'listing not found' using errcode = 'P0002';
  end if;
  perform public.write_audit('service_listing.delete', 'service_listing', p_id, '{}'::jsonb);
  return v_cover;
end;
$$;

-- Close a complaint; optionally hide the listing in the same step.
create or replace function public.staff_resolve_listing_complaint(p_id uuid, p_status text, p_note text default null, p_hide boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
begin
  if not public.is_moderator() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_status not in ('resolved', 'dismissed') then
    raise exception 'invalid status' using errcode = '22023';
  end if;
  select status, target_type, target_id into v_row from public.listing_complaints where id = p_id for update;
  if not found then
    raise exception 'complaint not found' using errcode = 'P0002';
  end if;
  if v_row.status <> 'open' then
    raise exception 'complaint already handled' using errcode = 'P0001';
  end if;
  update public.listing_complaints
  set status = p_status, resolution_note = nullif(left(trim(coalesce(p_note, '')), 300), ''), resolved_by = auth.uid(), resolved_at = now()
  where id = p_id;
  if p_hide and v_row.target_type = 'service_listing' then
    update public.service_listings set status = 'archived', moderated_by = auth.uid(), moderated_at = now() where id = v_row.target_id;
    perform public.write_audit('service_listing.hide', 'service_listing', v_row.target_id, jsonb_build_object('complaint', p_id));
  end if;
  insert into public.moderation_actions (moderator_id, target_type, target_id, action, reason)
  values (auth.uid(), 'listing_complaint', p_id, case when p_status = 'resolved' then 'resolve' else 'dismiss' end, nullif(left(trim(coalesce(p_note, '')), 300), ''));
end;
$$;

-- Public catalogue: published and not expired, newest first. Sponsorship never changes the order.
create or replace function public.search_service_listings(
  p_query text default null,
  p_category text default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid, slug text, title text, provider_name text, price_note text, area text, cover_path text, cover_alt text,
  is_sponsored boolean, published_at timestamptz, category_slug text, total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (select nullif(lower(trim(coalesce(p_query, ''))), '') as text, public.city_today() as today)
  select s.id, s.slug, s.title, s.provider_name, s.price_note, s.area, s.cover_path, s.cover_alt, s.is_sponsored,
         s.published_at, c.slug, count(*) over ()
  from public.service_listings s
  left join public.service_categories c on c.id = s.category_id
  cross join q
  where s.status = 'published'
    and s.expires_on >= q.today
    and (p_category is null or c.slug = p_category)
    and (q.text is null or s.search_text like '%' || replace(replace(replace(q.text, '\', '\\'), '%', '\%'), '_', '\_') || '%')
  order by s.published_at desc, s.id
  limit least(greatest(coalesce(p_limit, 24), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- Account deletion removes the user's own listings (covers are removed by the server first).
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
  -- Promotion reports: same rule as news suggestions.
  delete from public.promotion_submissions where user_id = v_uid and status <> 'approved';
  update public.promotion_submissions set user_id = null, client_hash = null, contact = null where user_id = v_uid;
  -- Directory suggestions: same rule.
  delete from public.business_submissions where user_id = v_uid and status <> 'approved';
  update public.business_submissions set user_id = null, client_hash = null, contact = null where user_id = v_uid;
  -- Service listings carry the person's own name and phone: remove them entirely.
  delete from public.service_listings where owner_id = v_uid;
  update public.listing_complaints set reporter_id = null, client_hash = null where reporter_id = v_uid;
  update public.profiles set display_name = null, email = null where id = v_uid;
  return v_paths;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS and grants
-- ---------------------------------------------------------------------------
alter table public.service_categories enable row level security;
alter table public.service_listings enable row level security;
alter table public.listing_complaints enable row level security;

grant select on public.service_categories, public.service_listings to anon, authenticated;
grant insert, update, delete on public.service_categories to authenticated;
grant select on public.listing_complaints to authenticated;

create policy service_categories_read on public.service_categories for select using (is_active or public.is_moderator());
create policy service_categories_admin on public.service_categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Readers see live listings; owners see their own in any state; staff see everything.
create policy service_listings_read on public.service_listings for select
  using ((status = 'published' and expires_on >= public.city_today()) or owner_id = auth.uid() or public.is_moderator());
-- Writes go through the functions above (no direct table writes).

create policy listing_complaints_read on public.listing_complaints for select to authenticated
  using (public.is_moderator());
-- Complaints are inserted on the server (validated, rate limited) with the service role.

grant execute on function public.city_today() to anon, authenticated;
grant execute on function public.submit_service_listing(jsonb), public.update_my_service_listing(uuid, jsonb),
  public.my_service_listing_action(uuid, text), public.delete_my_service_listing(uuid),
  public.staff_moderate_service_listing(uuid, text, text), public.staff_save_service_listing(jsonb),
  public.staff_delete_service_listing(uuid), public.staff_resolve_listing_complaint(uuid, text, text, boolean)
  to authenticated;
grant execute on function public.search_service_listings(text, text, integer, integer) to anon, authenticated;
revoke execute on function public.service_listing_free_slug(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: listing photos. Paths are random; a photo is linked from the site only once the listing is live.
-- Uploads happen on the server after validation (owner) or by staff.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('service-images', 'service-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy service_images_read on storage.objects for select
  using (bucket_id = 'service-images');
create policy service_images_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'service-images' and public.is_moderator());
create policy service_images_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'service-images' and public.is_moderator());
