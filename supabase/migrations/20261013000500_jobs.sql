-- Sat+ — «Работа и вакансии»: vacancies that employers publish themselves.
-- A signed-in employer submits a vacancy; a moderator approves or rejects it. Vacancies are live for
-- 30 days and can be renewed, so the list does not fill up with positions that are long filled.
-- Salary is shown only when the employer states it. Only categories are seeded.

create table public.job_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,64}$'),
  name_ru text not null check (char_length(name_ru) between 2 and 60),
  name_kk text not null check (char_length(name_kk) between 2 and 60),
  icon text not null default 'briefcase' check (icon ~ '^[a-z0-9-]{2,40}$'),
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger job_categories_updated_at before update on public.job_categories
  for each row execute function public.set_updated_at();

insert into public.job_categories (slug, name_ru, name_kk, icon, sort_order) values
  ('sales', 'Торговля и продажи', 'Сауда және сату', 'shopping-bag', 10),
  ('food', 'Кафе и общепит', 'Кафе және қоғамдық тамақтану', 'utensils', 20),
  ('industry', 'Производство и горное дело', 'Өндіріс және тау-кен ісі', 'factory', 30),
  ('transport', 'Водители и транспорт', 'Жүргізушілер және көлік', 'truck', 40),
  ('construction', 'Строительство и ремонт', 'Құрылыс және жөндеу', 'hard-hat', 50),
  ('education', 'Образование', 'Білім беру', 'graduation-cap', 60),
  ('health', 'Медицина и аптеки', 'Медицина және дәріханалар', 'stethoscope', 70),
  ('office', 'Офис и бухгалтерия', 'Кеңсе және бухгалтерия', 'calculator', 80),
  ('it', 'IT и связь', 'IT және байланыс', 'monitor', 90),
  ('beauty', 'Красота', 'Сұлулық', 'scissors', 100),
  ('services', 'Сервис и обслуживание', 'Сервис және қызмет көрсету', 'wrench', 110),
  ('security', 'Охрана', 'Күзет', 'shield', 120),
  ('other', 'Другое', 'Басқа', 'briefcase', 1000);

create table public.job_listings (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,120}$'),
  category_id uuid references public.job_categories (id) on delete set null,
  title text not null check (char_length(title) between 3 and 120),
  employer_name text not null check (char_length(employer_name) between 2 and 120),
  employment_type text not null default 'full' check (employment_type in ('full', 'part', 'shift', 'temporary', 'internship')),
  experience text not null default 'any' check (experience in ('any', 'none', '1_3', '3_plus')),
  -- Free text as the employer wrote it, e.g. «5/2, с 9:00 до 18:00» or «вахта 15/15».
  schedule text check (schedule is null or char_length(schedule) <= 120),
  -- Monthly salary in tenge, only when the employer states it. Never estimated.
  salary_from integer check (salary_from is null or salary_from between 1 and 10000000),
  salary_to integer check (salary_to is null or salary_to between 1 and 10000000),
  salary_note text check (salary_note is null or char_length(salary_note) <= 120),
  description text not null check (char_length(description) between 20 and 5000),
  address text check (address is null or char_length(address) <= 200),
  contact_name text check (contact_name is null or char_length(contact_name) between 2 and 80),
  phone text not null check (phone ~ '^\+?[0-9 ()-]{6,24}$'),
  has_whatsapp boolean not null default false,
  email text check (email is null or (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  link_url text check (link_url is null or link_url ~ '^https://'),
  owner_id uuid references auth.users (id) on delete cascade,
  source_name text check (source_name is null or char_length(source_name) between 2 and 120),
  consent_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected', 'archived')),
  reject_reason text check (reject_reason is null or char_length(reject_reason) <= 300),
  is_sponsored boolean not null default false,
  expires_on date,
  published_at timestamptz,
  moderated_by uuid references auth.users (id) on delete set null,
  moderated_at timestamptz,
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (salary_from is null or salary_to is null or salary_from <= salary_to),
  check (owner_id is not null or source_name is not null),
  check (owner_id is null or consent_at is not null),
  check (status <> 'published' or expires_on is not null),
  check (status <> 'rejected' or reject_reason is not null)
);
create trigger job_listings_updated_at before update on public.job_listings
  for each row execute function public.set_updated_at();
create index job_listings_public_idx on public.job_listings (city_id, published_at desc) where status = 'published';
create index job_listings_owner_idx on public.job_listings (owner_id, created_at desc);
create index job_listings_pending_idx on public.job_listings (created_at) where status = 'pending';
create index job_listings_category_idx on public.job_listings (category_id);
create index job_listings_search_idx on public.job_listings using gin (search_text extensions.gin_trgm_ops);

create or replace function public.job_listings_build_search_text()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.search_text := lower(concat_ws(' ', new.title, new.employer_name, new.description, new.address, new.schedule,
    (select concat_ws(' ', c.name_ru, c.name_kk) from public.job_categories c where c.id = new.category_id)));
  return new;
end;
$$;
create trigger job_listings_search_text
  before insert or update of title, employer_name, description, address, schedule, category_id on public.job_listings
  for each row execute function public.job_listings_build_search_text();

-- Complaints now also cover vacancies.
alter table public.listing_complaints drop constraint listing_complaints_target_type_check;
alter table public.listing_complaints add constraint listing_complaints_target_type_check
  check (target_type in ('service_listing', 'job_listing'));

create or replace function public.job_listings_drop_complaints()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.listing_complaints where target_type = 'job_listing' and target_id = old.id;
  return old;
end;
$$;
create trigger job_listings_drop_complaints after delete on public.job_listings
  for each row execute function public.job_listings_drop_complaints();

alter table public.moderation_actions drop constraint moderation_actions_target_type_check;
alter table public.moderation_actions add constraint moderation_actions_target_type_check
  check (target_type in ('price_submission', 'report', 'news_submission', 'promotion_submission', 'business_submission',
    'service_listing', 'listing_complaint', 'job_listing'));

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
select 'job_listing'::text, jl.id, jl.created_at, false
from public.job_listings jl
where jl.status = 'pending'
union all
select 'listing_complaint'::text, lc.id, lc.created_at, lc.reason = 'fraud'
from public.listing_complaints lc
where lc.status = 'open';

-- ---------------------------------------------------------------------------
-- Owner functions
-- ---------------------------------------------------------------------------

create or replace function public.job_listing_days()
returns integer
language sql
immutable
set search_path = ''
as $$ select 30 $$;

create or replace function public.job_listing_free_slug(p_base text)
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
  while exists (select 1 from public.job_listings where slug = v_slug) loop
    v_slug := p_base || '-' || substr(md5(gen_random_uuid()::text), 1, 5);
  end loop;
  return v_slug;
end;
$$;

-- Employers may pick only an active category.
create or replace function public.job_listing_category_ok(p_category uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_category is not null and exists (select 1 from public.job_categories where id = p_category and is_active);
$$;

create or replace function public.submit_job_listing(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_category uuid := nullif(p->>'category_id', '')::uuid;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if (select count(*) from public.job_listings where owner_id = v_uid and status in ('pending', 'published')) >= 10 then
    raise exception 'job_active_limit' using errcode = 'P0001';
  end if;
  if (select count(*) from public.job_listings where owner_id = v_uid and created_at > now() - interval '1 day') >= 5 then
    raise exception 'job_daily_limit' using errcode = 'P0001';
  end if;
  if not public.job_listing_category_ok(v_category) then
    raise exception 'category not found' using errcode = 'P0002';
  end if;

  insert into public.job_listings (
    city_id, slug, category_id, title, employer_name, employment_type, experience, schedule, salary_from, salary_to,
    salary_note, description, address, contact_name, phone, has_whatsapp, email, link_url, owner_id, consent_at, status)
  values (
    (select id from public.cities where slug = 'satpaev'), public.job_listing_free_slug(p->>'slug'), v_category, p->>'title',
    p->>'employer_name', coalesce(nullif(p->>'employment_type', ''), 'full'), coalesce(nullif(p->>'experience', ''), 'any'),
    nullif(p->>'schedule', ''), nullif(p->>'salary_from', '')::integer, nullif(p->>'salary_to', '')::integer,
    nullif(p->>'salary_note', ''), p->>'description', nullif(p->>'address', ''), nullif(p->>'contact_name', ''), p->>'phone',
    coalesce((p->>'has_whatsapp')::boolean, false), nullif(p->>'email', ''), nullif(p->>'link_url', ''), v_uid, now(), 'pending')
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.update_my_job_listing(p_id uuid, p jsonb)
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
  if not public.job_listing_category_ok(v_category) then
    raise exception 'category not found' using errcode = 'P0002';
  end if;
  update public.job_listings set
    category_id = v_category,
    title = p->>'title',
    employer_name = p->>'employer_name',
    employment_type = coalesce(nullif(p->>'employment_type', ''), 'full'),
    experience = coalesce(nullif(p->>'experience', ''), 'any'),
    schedule = nullif(p->>'schedule', ''),
    salary_from = nullif(p->>'salary_from', '')::integer,
    salary_to = nullif(p->>'salary_to', '')::integer,
    salary_note = nullif(p->>'salary_note', ''),
    description = p->>'description',
    address = nullif(p->>'address', ''),
    contact_name = nullif(p->>'contact_name', ''),
    phone = p->>'phone',
    has_whatsapp = coalesce((p->>'has_whatsapp')::boolean, false),
    email = nullif(p->>'email', ''),
    link_url = nullif(p->>'link_url', ''),
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

-- Hide (e.g. the position is filled), show again (back to moderation) or renew for another 30 days.
create or replace function public.my_job_listing_action(p_id uuid, p_action text)
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
  select status, expires_on into v_row from public.job_listings where id = p_id and owner_id = auth.uid() for update;
  if not found then
    raise exception 'listing not found' using errcode = 'P0002';
  end if;
  case p_action
    when 'archive' then
      if v_row.status = 'archived' then
        raise exception 'job_wrong_state' using errcode = 'P0001';
      end if;
      update public.job_listings set status = 'archived' where id = p_id;
    when 'restore' then
      if v_row.status <> 'archived' then
        raise exception 'job_wrong_state' using errcode = 'P0001';
      end if;
      update public.job_listings set status = 'pending', reject_reason = null, moderated_by = null, moderated_at = null where id = p_id;
    when 'renew' then
      -- In the last 7 days or after expiry; renewal never moves the vacancy up.
      if v_row.status <> 'published' or v_row.expires_on > public.city_today() + 7 then
        raise exception 'job_renew_too_early' using errcode = 'P0001';
      end if;
      update public.job_listings set expires_on = public.city_today() + public.job_listing_days() where id = p_id;
    else
      raise exception 'unknown action' using errcode = '22023';
  end case;
end;
$$;

create or replace function public.delete_my_job_listing(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  delete from public.job_listings where id = p_id and owner_id = auth.uid();
  if not found then
    raise exception 'listing not found' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff functions
-- ---------------------------------------------------------------------------

create or replace function public.staff_moderate_job_listing(p_id uuid, p_action text, p_reason text default null)
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
  select status into v_status from public.job_listings where id = p_id for update;
  if not found then
    raise exception 'listing not found' using errcode = 'P0002';
  end if;
  if v_status <> 'pending' then
    raise exception 'listing already moderated' using errcode = 'P0001';
  end if;
  if p_action = 'approve' then
    update public.job_listings set
      status = 'published',
      expires_on = greatest(coalesce(expires_on, public.city_today()), public.city_today() + public.job_listing_days()),
      published_at = coalesce(published_at, now()),
      moderated_by = auth.uid(),
      moderated_at = now()
    where id = p_id;
  elsif p_action = 'reject' then
    if coalesce(trim(p_reason), '') = '' then
      raise exception 'reason required' using errcode = '22023';
    end if;
    update public.job_listings set
      status = 'rejected', reject_reason = left(trim(p_reason), 300), moderated_by = auth.uid(), moderated_at = now()
    where id = p_id;
  else
    raise exception 'unknown action' using errcode = '22023';
  end if;
  insert into public.moderation_actions (moderator_id, target_type, target_id, action, reason)
  values (auth.uid(), 'job_listing', p_id, case when p_action = 'approve' then 'publish' else 'reject' end,
    case when p_action = 'reject' then left(trim(p_reason), 300) end);
  perform public.write_audit('job_listing.' || p_action, 'job_listing', p_id, '{}'::jsonb);
end;
$$;

create or replace function public.staff_save_job_listing(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_status text := coalesce(nullif(p->>'status', ''), 'published');
  v_expires date := nullif(p->>'expires_on', '')::date;
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
    v_expires := public.city_today() + public.job_listing_days();
  end if;

  if v_id is null then
    insert into public.job_listings (
      city_id, slug, category_id, title, employer_name, employment_type, experience, schedule, salary_from, salary_to,
      salary_note, description, address, contact_name, phone, has_whatsapp, email, link_url, source_name, status,
      is_sponsored, expires_on, published_at, moderated_by, moderated_at)
    values (
      (select id from public.cities where slug = 'satpaev'), public.job_listing_free_slug(p->>'slug'),
      nullif(p->>'category_id', '')::uuid, p->>'title', p->>'employer_name', coalesce(nullif(p->>'employment_type', ''), 'full'),
      coalesce(nullif(p->>'experience', ''), 'any'), nullif(p->>'schedule', ''), nullif(p->>'salary_from', '')::integer,
      nullif(p->>'salary_to', '')::integer, nullif(p->>'salary_note', ''), p->>'description', nullif(p->>'address', ''),
      nullif(p->>'contact_name', ''), p->>'phone', coalesce((p->>'has_whatsapp')::boolean, false), nullif(p->>'email', ''),
      nullif(p->>'link_url', ''), nullif(p->>'source_name', ''), v_status, coalesce((p->>'is_sponsored')::boolean, false),
      v_expires, case when v_status = 'published' then now() end, auth.uid(), now())
    returning id into v_id;
    perform public.write_audit('job_listing.create', 'job_listing', v_id, jsonb_build_object('status', v_status));
  else
    update public.job_listings set
      slug = p->>'slug',
      category_id = nullif(p->>'category_id', '')::uuid,
      title = p->>'title',
      employer_name = p->>'employer_name',
      employment_type = coalesce(nullif(p->>'employment_type', ''), 'full'),
      experience = coalesce(nullif(p->>'experience', ''), 'any'),
      schedule = nullif(p->>'schedule', ''),
      salary_from = nullif(p->>'salary_from', '')::integer,
      salary_to = nullif(p->>'salary_to', '')::integer,
      salary_note = nullif(p->>'salary_note', ''),
      description = p->>'description',
      address = nullif(p->>'address', ''),
      contact_name = nullif(p->>'contact_name', ''),
      phone = p->>'phone',
      has_whatsapp = coalesce((p->>'has_whatsapp')::boolean, false),
      email = nullif(p->>'email', ''),
      link_url = nullif(p->>'link_url', ''),
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
    perform public.write_audit('job_listing.update', 'job_listing', v_id, jsonb_build_object('status', v_status));
  end if;
  return v_id;
end;
$$;

create or replace function public.staff_delete_job_listing(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.job_listings where id = p_id;
  if not found then
    raise exception 'listing not found' using errcode = 'P0002';
  end if;
  perform public.write_audit('job_listing.delete', 'job_listing', p_id, '{}'::jsonb);
end;
$$;

-- Complaint handling now hides vacancies too.
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
  if p_hide then
    if v_row.target_type = 'service_listing' then
      update public.service_listings set status = 'archived', moderated_by = auth.uid(), moderated_at = now() where id = v_row.target_id;
    elsif v_row.target_type = 'job_listing' then
      update public.job_listings set status = 'archived', moderated_by = auth.uid(), moderated_at = now() where id = v_row.target_id;
    end if;
    perform public.write_audit(v_row.target_type || '.hide', v_row.target_type, v_row.target_id, jsonb_build_object('complaint', p_id));
  end if;
  insert into public.moderation_actions (moderator_id, target_type, target_id, action, reason)
  values (auth.uid(), 'listing_complaint', p_id, case when p_status = 'resolved' then 'resolve' else 'dismiss' end,
    nullif(left(trim(coalesce(p_note, '')), 300), ''));
end;
$$;

-- Public list: published and not expired, newest first. Sponsorship never changes the order.
create or replace function public.search_job_listings(
  p_query text default null,
  p_category text default null,
  p_employment text default null,
  p_with_salary boolean default false,
  p_no_experience boolean default false,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid, slug text, title text, employer_name text, employment_type text, experience text, schedule text,
  salary_from integer, salary_to integer, address text, is_sponsored boolean, published_at timestamptz,
  category_slug text, total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (select nullif(lower(trim(coalesce(p_query, ''))), '') as text, public.city_today() as today)
  select j.id, j.slug, j.title, j.employer_name, j.employment_type, j.experience, j.schedule, j.salary_from, j.salary_to,
         j.address, j.is_sponsored, j.published_at, c.slug, count(*) over ()
  from public.job_listings j
  left join public.job_categories c on c.id = j.category_id
  cross join q
  where j.status = 'published'
    and j.expires_on >= q.today
    and (p_category is null or c.slug = p_category)
    and (p_employment is null or j.employment_type = p_employment)
    and (not coalesce(p_with_salary, false) or j.salary_from is not null or j.salary_to is not null)
    and (not coalesce(p_no_experience, false) or j.experience in ('none', 'any'))
    and (q.text is null or j.search_text like '%' || replace(replace(replace(q.text, '\', '\\'), '%', '\%'), '_', '\_') || '%')
  order by j.published_at desc, j.id
  limit least(greatest(coalesce(p_limit, 24), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

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
  -- Service listings and vacancies carry the person's own contacts: remove them entirely.
  delete from public.service_listings where owner_id = v_uid;
  delete from public.job_listings where owner_id = v_uid;
  update public.listing_complaints set reporter_id = null, client_hash = null where reporter_id = v_uid;
  update public.profiles set display_name = null, email = null where id = v_uid;
  return v_paths;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS and grants
-- ---------------------------------------------------------------------------
alter table public.job_categories enable row level security;
alter table public.job_listings enable row level security;

grant select on public.job_categories, public.job_listings to anon, authenticated;
grant insert, update, delete on public.job_categories to authenticated;

create policy job_categories_read on public.job_categories for select using (is_active or public.is_moderator());
create policy job_categories_admin on public.job_categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy job_listings_read on public.job_listings for select
  using ((status = 'published' and expires_on >= public.city_today()) or owner_id = auth.uid() or public.is_moderator());
-- Writes go through the functions above (no direct table writes).

grant execute on function public.submit_job_listing(jsonb), public.update_my_job_listing(uuid, jsonb),
  public.my_job_listing_action(uuid, text), public.delete_my_job_listing(uuid),
  public.staff_moderate_job_listing(uuid, text, text), public.staff_save_job_listing(jsonb),
  public.staff_delete_job_listing(uuid) to authenticated;
grant execute on function public.search_job_listings(text, text, text, boolean, boolean, integer, integer) to anon, authenticated;
revoke execute on function public.job_listing_free_slug(text), public.job_listing_category_ok(uuid) from public, anon, authenticated;
