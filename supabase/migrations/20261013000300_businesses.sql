-- Sat+ — «Заведения и организации»: city directory with categories, map, reader suggestions and corrections.
-- Only categories are seeded. Organisations appear when staff publish them; unverified facts stay NULL.

create table public.business_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,64}$'),
  name_ru text not null check (char_length(name_ru) between 2 and 60),
  name_kk text not null check (char_length(name_kk) between 2 and 60),
  -- lucide icon name, mapped on the client; unknown names fall back to a generic icon.
  icon text not null default 'building-2' check (icon ~ '^[a-z0-9-]{2,40}$'),
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger business_categories_updated_at before update on public.business_categories
  for each row execute function public.set_updated_at();

insert into public.business_categories (slug, name_ru, name_kk, icon, sort_order) values
  ('food', 'Кафе и рестораны', 'Кафелер мен мейрамханалар', 'utensils', 10),
  ('shops', 'Магазины', 'Дүкендер', 'shopping-bag', 20),
  ('pharmacy', 'Аптеки', 'Дәріханалар', 'pill', 30),
  ('health', 'Медицина', 'Медицина', 'stethoscope', 40),
  ('government', 'Госучреждения', 'Мемлекеттік мекемелер', 'landmark', 50),
  ('finance', 'Банки и платежи', 'Банктер мен төлемдер', 'banknote', 60),
  ('education', 'Образование', 'Білім беру', 'graduation-cap', 70),
  ('sport', 'Спорт', 'Спорт', 'dumbbell', 80),
  ('beauty', 'Красота', 'Сұлулық', 'scissors', 90),
  ('auto', 'Авто', 'Авто', 'car', 100),
  ('services', 'Бытовые услуги', 'Тұрмыстық қызметтер', 'wrench', 110),
  ('leisure', 'Досуг и культура', 'Демалыс және мәдениет', 'drama', 120),
  ('hotels', 'Гостиницы', 'Қонақүйлер', 'bed-double', 130),
  ('other', 'Другое', 'Басқа', 'building-2', 1000);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,120}$'),
  category_id uuid references public.business_categories (id) on delete set null,
  name text not null check (char_length(name) between 2 and 120),
  description text check (description is null or char_length(description) <= 2000),
  -- Unverified facts stay NULL. Never fill with guesses.
  address text check (address is null or char_length(address) <= 200),
  latitude numeric(9, 6) check (latitude is null or latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude is null or longitude between -180 and 180),
  phone text check (phone is null or phone ~ '^\+?[0-9 ()-]{6,24}$'),
  phone_alt text check (phone_alt is null or phone_alt ~ '^\+?[0-9 ()-]{6,24}$'),
  website text check (website is null or website ~ '^https://'),
  social_url text check (social_url is null or social_url ~ '^https://'),
  -- Free text exactly as verified, e.g. "Пн–Пт 9:00–18:00, Сб 10:00–15:00".
  opening_hours text check (opening_hours is null or char_length(opening_hours) <= 300),
  cover_path text,
  cover_alt text check (cover_alt is null or char_length(cover_alt) <= 200),
  -- Where the data comes from: "Проверено редакцией на месте", "Сайт организации", …
  source_name text not null check (char_length(source_name) between 2 and 120),
  verification_status text not null default 'needs_check'
    check (verification_status in ('needs_check', 'verified')),
  last_verified_at date,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  -- Paid placement; always labelled, never moves a card up in lists.
  is_sponsored boolean not null default false,
  submission_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  search_text text not null default '',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((latitude is null) = (longitude is null)),
  check (verification_status = 'needs_check' or last_verified_at is not null)
);
create trigger businesses_updated_at before update on public.businesses
  for each row execute function public.set_updated_at();
create index businesses_public_idx on public.businesses (city_id, name) where status = 'published';
create index businesses_category_idx on public.businesses (category_id);
create index businesses_search_idx on public.businesses using gin (search_text extensions.gin_trgm_ops);

create or replace function public.businesses_build_search_text()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.search_text := lower(concat_ws(' ', new.name, new.description, new.address,
    (select concat_ws(' ', c.name_ru, c.name_kk) from public.business_categories c where c.id = new.category_id)));
  return new;
end;
$$;
create trigger businesses_search_text before insert or update of name, description, address, category_id on public.businesses
  for each row execute function public.businesses_build_search_text();

-- Reader suggestions: a new organisation, or a correction to an existing one. Private until moderated.
create table public.business_submissions (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id),
  kind text not null check (kind in ('new', 'correction')),
  business_id uuid references public.businesses (id) on delete cascade,
  name text check (name is null or char_length(name) between 2 and 120),
  category_id uuid references public.business_categories (id) on delete set null,
  address text check (address is null or char_length(address) <= 200),
  phone text check (phone is null or char_length(phone) <= 40),
  website text check (website is null or website ~ '^https://'),
  opening_hours text check (opening_hours is null or char_length(opening_hours) <= 300),
  details text check (details is null or char_length(details) <= 2000),
  is_owner boolean not null default false,
  contact text check (contact is null or char_length(contact) <= 120),
  photo_path text,
  user_id uuid references auth.users (id) on delete set null,
  client_hash text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text check (reject_reason is null or char_length(reject_reason) <= 300),
  result_business_id uuid references public.businesses (id) on delete set null,
  moderated_by uuid references auth.users (id) on delete set null,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint business_submissions_shape check (
    (kind = 'new' and name is not null and business_id is null)
    or (kind = 'correction' and business_id is not null and details is not null)
  )
);
create index business_submissions_pending_idx on public.business_submissions (created_at) where status = 'pending';
create index business_submissions_client_idx on public.business_submissions (client_hash, created_at desc);
create index business_submissions_user_idx on public.business_submissions (user_id, created_at desc);

alter table public.businesses
  add constraint businesses_submission_fk foreign key (submission_id) references public.business_submissions (id) on delete set null;

alter table public.moderation_actions drop constraint moderation_actions_target_type_check;
alter table public.moderation_actions add constraint moderation_actions_target_type_check
  check (target_type in ('price_submission', 'report', 'news_submission', 'promotion_submission', 'business_submission'));

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
where bs.status = 'pending';

-- ---------------------------------------------------------------------------
-- Staff functions
-- ---------------------------------------------------------------------------

-- Create or update an organisation. When p_submission_id is given, the reader suggestion
-- (new organisation or correction) is marked approved in the same transaction.
create or replace function public.staff_save_business(p jsonb, p_submission_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_status text := coalesce(p->>'status', 'draft');
  v_verification text := coalesce(nullif(p->>'verification_status', ''), 'needs_check');
  v_city uuid;
  v_sub record;
  v_was_published boolean;
begin
  if not public.is_moderator() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce((p->>'is_sponsored')::boolean, false) and not public.is_admin() then
    raise exception 'only admins can mark sponsored content' using errcode = '42501';
  end if;
  select id into v_city from public.cities where slug = coalesce(nullif(p->>'city_slug', ''), 'satpaev');
  if v_city is null then
    raise exception 'city not found' using errcode = 'P0002';
  end if;

  if p_submission_id is not null then
    select status, kind, business_id into v_sub from public.business_submissions where id = p_submission_id for update;
    if not found then
      raise exception 'submission not found' using errcode = 'P0002';
    end if;
    if v_sub.status <> 'pending' then
      raise exception 'submission already moderated' using errcode = 'P0001';
    end if;
    if v_sub.kind = 'correction' and v_sub.business_id is distinct from v_id then
      raise exception 'correction belongs to another organisation' using errcode = 'P0001';
    end if;
  end if;

  if v_id is null then
    insert into public.businesses (
      city_id, slug, category_id, name, description, address, latitude, longitude, phone, phone_alt, website,
      social_url, opening_hours, cover_path, cover_alt, source_name, verification_status, last_verified_at,
      status, is_sponsored, published_at, submission_id, created_by, updated_by)
    values (
      v_city, p->>'slug', nullif(p->>'category_id', '')::uuid, p->>'name', nullif(p->>'description', ''),
      nullif(p->>'address', ''), nullif(p->>'latitude', '')::numeric, nullif(p->>'longitude', '')::numeric,
      nullif(p->>'phone', ''), nullif(p->>'phone_alt', ''), nullif(p->>'website', ''), nullif(p->>'social_url', ''),
      nullif(p->>'opening_hours', ''), nullif(p->>'cover_path', ''), nullif(p->>'cover_alt', ''), p->>'source_name',
      v_verification, nullif(p->>'last_verified_at', '')::date, v_status, coalesce((p->>'is_sponsored')::boolean, false),
      case when v_status = 'published' then now() end, p_submission_id, auth.uid(), auth.uid())
    returning id into v_id;
    perform public.write_audit('business.create', 'business', v_id, jsonb_build_object('status', v_status, 'slug', p->>'slug'));
  else
    select status = 'published' into v_was_published from public.businesses where id = v_id;
    update public.businesses set
      slug = p->>'slug',
      category_id = nullif(p->>'category_id', '')::uuid,
      name = p->>'name',
      description = nullif(p->>'description', ''),
      address = nullif(p->>'address', ''),
      latitude = nullif(p->>'latitude', '')::numeric,
      longitude = nullif(p->>'longitude', '')::numeric,
      phone = nullif(p->>'phone', ''),
      phone_alt = nullif(p->>'phone_alt', ''),
      website = nullif(p->>'website', ''),
      social_url = nullif(p->>'social_url', ''),
      opening_hours = nullif(p->>'opening_hours', ''),
      cover_path = case when p ? 'cover_path' then nullif(p->>'cover_path', '') else cover_path end,
      cover_alt = nullif(p->>'cover_alt', ''),
      source_name = p->>'source_name',
      verification_status = v_verification,
      last_verified_at = nullif(p->>'last_verified_at', '')::date,
      status = v_status,
      is_sponsored = case when public.is_admin() then coalesce((p->>'is_sponsored')::boolean, false) else is_sponsored end,
      published_at = case when v_status = 'published' and not coalesce(v_was_published, false) then now() else published_at end,
      updated_by = auth.uid()
    where id = v_id;
    if not found then
      raise exception 'business not found' using errcode = 'P0002';
    end if;
    perform public.write_audit('business.update', 'business', v_id, jsonb_build_object('status', v_status));
  end if;

  if p_submission_id is not null then
    update public.business_submissions
    set status = 'approved', result_business_id = v_id, moderated_by = auth.uid(), moderated_at = now()
    where id = p_submission_id;
    insert into public.moderation_actions (moderator_id, target_type, target_id, action, reason)
    values (auth.uid(), 'business_submission', p_submission_id, 'publish', null);
  end if;
  return v_id;
end;
$$;

create or replace function public.reject_business_submission(p_submission_id uuid, p_reason text)
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
  select status into v_status from public.business_submissions where id = p_submission_id for update;
  if not found then
    raise exception 'submission not found' using errcode = 'P0002';
  end if;
  if v_status <> 'pending' then
    raise exception 'submission already moderated' using errcode = 'P0001';
  end if;
  update public.business_submissions
  set status = 'rejected', reject_reason = left(p_reason, 300), moderated_by = auth.uid(), moderated_at = now()
  where id = p_submission_id;
  insert into public.moderation_actions (moderator_id, target_type, target_id, action, reason)
  values (auth.uid(), 'business_submission', p_submission_id, 'reject', left(p_reason, 300));
end;
$$;

create or replace function public.staff_delete_business(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.businesses where id = p_id;
  if not found then
    raise exception 'business not found' using errcode = 'P0002';
  end if;
  perform public.write_audit('business.delete', 'business', p_id, '{}'::jsonb);
end;
$$;

-- Public directory. Alphabetical; sponsorship never changes the order.
create or replace function public.search_businesses(
  p_query text default null,
  p_category text default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid, slug text, name text, address text, phone text, opening_hours text, latitude numeric, longitude numeric,
  cover_path text, cover_alt text, is_sponsored boolean, verification_status text, category_slug text, total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (select nullif(lower(trim(coalesce(p_query, ''))), '') as text)
  select b.id, b.slug, b.name, b.address, b.phone, b.opening_hours, b.latitude, b.longitude, b.cover_path, b.cover_alt,
         b.is_sponsored, b.verification_status, c.slug, count(*) over ()
  from public.businesses b
  left join public.business_categories c on c.id = b.category_id
  cross join q
  where b.status = 'published'
    and (p_category is null or c.slug = p_category)
    and (q.text is null or b.search_text like '%' || replace(replace(replace(q.text, '\', '\\'), '%', '\%'), '_', '\_') || '%')
  order by lower(b.name), b.id
  limit least(greatest(coalesce(p_limit, 24), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- Account deletion also covers directory suggestions (photos are removed by the server first).
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
  update public.profiles set display_name = null, email = null where id = v_uid;
  return v_paths;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS and grants
-- ---------------------------------------------------------------------------
alter table public.business_categories enable row level security;
alter table public.businesses enable row level security;
alter table public.business_submissions enable row level security;

grant select on public.business_categories, public.businesses to anon, authenticated;
grant insert, update, delete on public.business_categories to authenticated;
grant select on public.business_submissions to authenticated;

create policy business_categories_read on public.business_categories for select using (is_active or public.is_moderator());
create policy business_categories_admin on public.business_categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy businesses_read on public.businesses for select
  using (status = 'published' or public.is_moderator());
-- Writes go through staff_save_business / staff_delete_business (no direct table writes).

create policy business_submissions_read on public.business_submissions for select to authenticated
  using (public.is_moderator() or user_id = auth.uid());
-- Inserts happen on the server (validated, rate limited) with the service role.

grant execute on function public.staff_save_business(jsonb, uuid), public.reject_business_submission(uuid, text),
  public.staff_delete_business(uuid) to authenticated;
grant execute on function public.search_businesses(text, text, integer, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('business-images', 'business-images', true, 3145728, array['image/jpeg', 'image/png', 'image/webp']),
  ('business-submissions', 'business-submissions', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy business_images_read on storage.objects for select
  using (bucket_id = 'business-images');
create policy business_images_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'business-images' and public.is_moderator());
create policy business_images_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'business-images' and public.is_moderator());
create policy business_images_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'business-images' and public.is_moderator());
create policy business_submissions_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'business-submissions' and public.is_moderator());
