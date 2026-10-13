-- Sat+ — «Акции и скидки»: store promotions with validity dates, reader reports and moderation.
-- Promotions never change QaiArzan prices or the "где дешевле" ranking: they are separate records.
-- An ended promotion disappears from the active list by date alone; no background job is needed.

-- Current date in the city's time zone (Сатпаев: UTC+5).
create or replace function public.city_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Almaty')::date;
$$;

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,120}$'),
  store_id uuid not null references public.stores (id) on delete cascade,
  -- Optional: the promotion is valid only in one branch.
  branch_id uuid references public.store_branches (id) on delete set null,
  category_id uuid references public.product_categories (id) on delete set null,
  title text not null check (char_length(title) between 5 and 160),
  description text check (description is null or char_length(description) <= 4000),
  -- Short label as printed by the store, e.g. "−20%" or "2 по цене 1". Free text, not a computed price.
  discount_label text check (discount_label is null or char_length(discount_label) <= 40),
  conditions text check (conditions is null or char_length(conditions) <= 1000),
  starts_on date,
  ends_on date not null,
  cover_path text,
  cover_alt text check (cover_alt is null or char_length(cover_alt) <= 200),
  source_name text not null check (char_length(source_name) between 2 and 120),
  source_url text check (source_url is null or source_url ~ '^https://'),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  -- Paid promotion of the card; always labelled, never affects price rankings.
  is_sponsored boolean not null default false,
  submission_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  search_text text not null default '',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotions_dates check (starts_on is null or starts_on <= ends_on)
);
create trigger promotions_updated_at before update on public.promotions
  for each row execute function public.set_updated_at();
create index promotions_active_idx on public.promotions (city_id, ends_on) where status = 'published';
create index promotions_store_idx on public.promotions (store_id, ends_on desc);
create index promotions_search_idx on public.promotions using gin (search_text extensions.gin_trgm_ops);

create or replace function public.promotions_build_search_text()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.search_text := lower(concat_ws(' ', new.title, new.description, new.discount_label,
    (select s.name from public.stores s where s.id = new.store_id)));
  return new;
end;
$$;
create trigger promotions_search_text before insert or update of title, description, discount_label, store_id on public.promotions
  for each row execute function public.promotions_build_search_text();

-- A branch, when set, must belong to the promotion's store.
create or replace function public.promotions_check_branch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.branch_id is not null and not exists (
    select 1 from public.store_branches b where b.id = new.branch_id and b.store_id = new.store_id
  ) then
    raise exception 'branch does not belong to the store' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger promotions_branch_check before insert or update of branch_id, store_id on public.promotions
  for each row execute function public.promotions_check_branch();

-- Reader reports of a promotion seen in a store (private until a moderator publishes it).
create table public.promotion_submissions (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id),
  store_id uuid references public.stores (id) on delete set null,
  store_text text check (store_text is null or char_length(store_text) <= 120),
  title text not null check (char_length(title) between 5 and 160),
  details text check (details is null or char_length(details) <= 2000),
  ends_on date,
  source_url text check (source_url is null or source_url ~ '^https://'),
  contact text check (contact is null or char_length(contact) <= 120),
  photo_path text,
  user_id uuid references auth.users (id) on delete set null,
  client_hash text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text check (reject_reason is null or char_length(reject_reason) <= 300),
  promotion_id uuid references public.promotions (id) on delete set null,
  moderated_by uuid references auth.users (id) on delete set null,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint promotion_submissions_store check (store_id is not null or store_text is not null)
);
create index promotion_submissions_pending_idx on public.promotion_submissions (created_at) where status = 'pending';
create index promotion_submissions_client_idx on public.promotion_submissions (client_hash, created_at desc);
create index promotion_submissions_user_idx on public.promotion_submissions (user_id, created_at desc);

alter table public.promotions
  add constraint promotions_submission_fk foreign key (submission_id) references public.promotion_submissions (id) on delete set null;

alter table public.moderation_actions drop constraint moderation_actions_target_type_check;
alter table public.moderation_actions add constraint moderation_actions_target_type_check
  check (target_type in ('price_submission', 'report', 'news_submission', 'promotion_submission'));

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
where pr.status = 'pending';

-- ---------------------------------------------------------------------------
-- Staff functions
-- ---------------------------------------------------------------------------
create or replace function public.staff_save_promotion(p jsonb, p_submission_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_status text := coalesce(p->>'status', 'draft');
  v_city uuid;
  v_sub_status text;
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
    select status into v_sub_status from public.promotion_submissions where id = p_submission_id for update;
    if not found then
      raise exception 'submission not found' using errcode = 'P0002';
    end if;
    if v_sub_status <> 'pending' then
      raise exception 'submission already moderated' using errcode = 'P0001';
    end if;
  end if;

  if v_id is null then
    insert into public.promotions (
      city_id, slug, store_id, branch_id, category_id, title, description, discount_label, conditions,
      starts_on, ends_on, cover_path, cover_alt, source_name, source_url, status, is_sponsored,
      published_at, submission_id, created_by, updated_by)
    values (
      v_city, p->>'slug', (p->>'store_id')::uuid, nullif(p->>'branch_id', '')::uuid, nullif(p->>'category_id', '')::uuid,
      p->>'title', nullif(p->>'description', ''), nullif(p->>'discount_label', ''), nullif(p->>'conditions', ''),
      nullif(p->>'starts_on', '')::date, (p->>'ends_on')::date, nullif(p->>'cover_path', ''), nullif(p->>'cover_alt', ''),
      p->>'source_name', nullif(p->>'source_url', ''), v_status, coalesce((p->>'is_sponsored')::boolean, false),
      case when v_status = 'published' then now() end, p_submission_id, auth.uid(), auth.uid())
    returning id into v_id;
    perform public.write_audit('promotion.create', 'promotion', v_id, jsonb_build_object('status', v_status, 'slug', p->>'slug'));
  else
    select status = 'published' into v_was_published from public.promotions where id = v_id;
    update public.promotions set
      slug = p->>'slug',
      store_id = (p->>'store_id')::uuid,
      branch_id = nullif(p->>'branch_id', '')::uuid,
      category_id = nullif(p->>'category_id', '')::uuid,
      title = p->>'title',
      description = nullif(p->>'description', ''),
      discount_label = nullif(p->>'discount_label', ''),
      conditions = nullif(p->>'conditions', ''),
      starts_on = nullif(p->>'starts_on', '')::date,
      ends_on = (p->>'ends_on')::date,
      cover_path = case when p ? 'cover_path' then nullif(p->>'cover_path', '') else cover_path end,
      cover_alt = nullif(p->>'cover_alt', ''),
      source_name = p->>'source_name',
      source_url = nullif(p->>'source_url', ''),
      status = v_status,
      is_sponsored = case when public.is_admin() then coalesce((p->>'is_sponsored')::boolean, false) else is_sponsored end,
      published_at = case when v_status = 'published' and not coalesce(v_was_published, false) then now() else published_at end,
      updated_by = auth.uid()
    where id = v_id;
    if not found then
      raise exception 'promotion not found' using errcode = 'P0002';
    end if;
    perform public.write_audit('promotion.update', 'promotion', v_id, jsonb_build_object('status', v_status));
  end if;

  if p_submission_id is not null then
    update public.promotion_submissions
    set status = 'approved', promotion_id = v_id, moderated_by = auth.uid(), moderated_at = now()
    where id = p_submission_id;
    insert into public.moderation_actions (moderator_id, target_type, target_id, action, reason)
    values (auth.uid(), 'promotion_submission', p_submission_id, 'publish', null);
  end if;
  return v_id;
end;
$$;

create or replace function public.reject_promotion_submission(p_submission_id uuid, p_reason text)
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
  select status into v_status from public.promotion_submissions where id = p_submission_id for update;
  if not found then
    raise exception 'submission not found' using errcode = 'P0002';
  end if;
  if v_status <> 'pending' then
    raise exception 'submission already moderated' using errcode = 'P0001';
  end if;
  update public.promotion_submissions
  set status = 'rejected', reject_reason = left(p_reason, 300), moderated_by = auth.uid(), moderated_at = now()
  where id = p_submission_id;
  insert into public.moderation_actions (moderator_id, target_type, target_id, action, reason)
  values (auth.uid(), 'promotion_submission', p_submission_id, 'reject', left(p_reason, 300));
end;
$$;

create or replace function public.staff_delete_promotion(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.promotions where id = p_id;
  if not found then
    raise exception 'promotion not found' using errcode = 'P0002';
  end if;
  perform public.write_audit('promotion.delete', 'promotion', p_id, '{}'::jsonb);
end;
$$;

-- Public list. p_state: 'active' (today within dates), 'upcoming' (starts later), 'ended'.
-- Stores are joined through RLS, so DEMO and inactive stores stay hidden automatically.
create or replace function public.search_promotions(
  p_state text default 'active',
  p_query text default null,
  p_store text default null,
  p_category text default null,
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  id uuid, slug text, title text, discount_label text, starts_on date, ends_on date, cover_path text, cover_alt text,
  is_sponsored boolean, store_slug text, store_name text, store_logo_path text, store_is_demo boolean,
  branch_name text, category_slug text, total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (select nullif(lower(trim(coalesce(p_query, ''))), '') as text, public.city_today() as today)
  select pr.id, pr.slug, pr.title, pr.discount_label, pr.starts_on, pr.ends_on, pr.cover_path, pr.cover_alt,
         pr.is_sponsored, s.slug, s.name, s.logo_path, s.is_demo, b.name, c.slug, count(*) over ()
  from public.promotions pr
  join public.stores s on s.id = pr.store_id
  left join public.store_branches b on b.id = pr.branch_id
  left join public.product_categories c on c.id = pr.category_id
  cross join q
  where pr.status = 'published'
    and case coalesce(p_state, 'active')
      when 'active' then (pr.starts_on is null or pr.starts_on <= q.today) and pr.ends_on >= q.today
      when 'upcoming' then pr.starts_on > q.today
      when 'ended' then pr.ends_on < q.today
      else false end
    and (p_store is null or s.slug = p_store)
    and (p_category is null or c.slug = p_category)
    and (q.text is null or pr.search_text like '%' || replace(replace(replace(q.text, '\', '\\'), '%', '\%'), '_', '\_') || '%')
  -- Order is by date only: sponsorship never moves a card up.
  order by
    case when coalesce(p_state, 'active') = 'ended' then null else pr.ends_on end asc nulls last,
    case when coalesce(p_state, 'active') = 'ended' then pr.ends_on end desc nulls last,
    pr.created_at desc
  limit least(greatest(coalesce(p_limit, 12), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- Account deletion also covers promotion reports (photos are removed by the server first).
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
  update public.profiles set display_name = null, email = null where id = v_uid;
  return v_paths;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS and grants
-- ---------------------------------------------------------------------------
alter table public.promotions enable row level security;
alter table public.promotion_submissions enable row level security;

grant select on public.promotions to anon, authenticated;
grant select on public.promotion_submissions to authenticated;

-- Published promotions of visible stores are public (including ended ones, shown as "завершена").
create policy promotions_read on public.promotions for select
  using (
    (status = 'published' and exists (select 1 from public.stores s where s.id = store_id))
    or public.is_moderator()
  );
create policy promotion_submissions_read on public.promotion_submissions for select to authenticated
  using (public.is_moderator() or user_id = auth.uid());

grant execute on function public.staff_save_promotion(jsonb, uuid), public.reject_promotion_submission(uuid, text),
  public.staff_delete_promotion(uuid) to authenticated;
grant execute on function public.search_promotions(text, text, text, text, integer, integer), public.city_today()
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('promotion-images', 'promotion-images', true, 3145728, array['image/jpeg', 'image/png', 'image/webp']),
  ('promotion-submissions', 'promotion-submissions', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy promotion_images_read on storage.objects for select
  using (bucket_id = 'promotion-images');
create policy promotion_images_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'promotion-images' and public.is_moderator());
create policy promotion_images_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'promotion-images' and public.is_moderator());
create policy promotion_images_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'promotion-images' and public.is_moderator());
create policy promotion_submissions_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'promotion-submissions' and public.is_moderator());
