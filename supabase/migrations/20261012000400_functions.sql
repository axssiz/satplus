-- QaiArzan business functions and read views.
-- All privileged writes go through SECURITY DEFINER functions that check the caller's role.

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

-- Current prices with store data and an effective status that marks old prices as "stale".
create or replace view public.current_prices
with (security_invoker = true) as
select
  vp.id,
  vp.product_id,
  vp.branch_id,
  b.store_id,
  b.slug as branch_slug,
  b.name as branch_name,
  b.address as branch_address,
  s.slug as store_slug,
  s.name as store_name,
  s.logo_path as store_logo_path,
  vp.is_demo,
  vp.price,
  vp.status,
  case
    when vp.observed_at < now() - make_interval(days => public.setting_int('price_stale_days', 14))
      then 'stale'
    else vp.status
  end as effective_status,
  vp.pack_quantity,
  vp.pack_unit,
  vp.brand_label,
  vp.source_type,
  vp.source_note,
  vp.source_url,
  vp.observed_at,
  vp.verified_at
from public.verified_prices vp
join public.store_branches b on b.id = vp.branch_id
join public.stores s on s.id = b.store_id;

-- Moderation queue: pending submissions + open reports in one list.
create or replace view public.moderation_queue
with (security_invoker = true) as
select 'price_submission'::text as item_type, ps.id, ps.created_at, ps.is_anomalous as flagged
from public.price_submissions ps
where ps.status = 'pending'
union all
select 'report'::text, r.id, r.created_at, false
from public.reports r
where r.status = 'open';

-- Demand for prices: votes per product since its latest accepted price.
create or replace view public.price_request_stats
with (security_invoker = true) as
select
  pr.product_id,
  count(*)::integer as total_requests,
  count(*) filter (
    where pr.created_at > coalesce(
      (select max(vp.observed_at) from public.verified_prices vp where vp.product_id = pr.product_id),
      '-infinity'::timestamptz)
  )::integer as open_requests,
  max(pr.created_at) as last_requested_at
from public.price_requests pr
group by pr.product_id;

-- ---------------------------------------------------------------------------
-- Reputation (internal helper, not callable by clients)
-- ---------------------------------------------------------------------------
create or replace function public.award_reputation(p_user_id uuid, p_action text, p_source_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_points integer := case p_action
    when 'price_added' then 10
    when 'photo_added' then 5
    when 'price_confirmed' then 3
    when 'error_fixed' then 5
  end;
  v_inserted integer;
begin
  if p_user_id is null or v_points is null then
    return;
  end if;
  insert into public.reputation_events (user_id, action, points, source_id)
  values (p_user_id, p_action, v_points, p_source_id)
  on conflict (user_id, action, source_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted > 0 then
    insert into public.user_reputation (user_id, points, approved_actions, updated_at)
    values (p_user_id, v_points, 1, now())
    on conflict (user_id) do update
      set points = public.user_reputation.points + excluded.points,
          approved_actions = public.user_reputation.approved_actions + 1,
          updated_at = now();
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Core: apply an accepted price (shared by moderation and admin entry)
-- ---------------------------------------------------------------------------
create or replace function public.apply_accepted_price(
  p_product_id uuid,
  p_branch_id uuid,
  p_price numeric,
  p_status text,
  p_source_type text,
  p_source_note text,
  p_source_url text,
  p_observed_at timestamptz,
  p_pack_quantity numeric,
  p_pack_unit text,
  p_brand_label text,
  p_submission_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.verified_prices;
  v_stale_days integer := public.setting_int('price_stale_days', 14);
  v_id uuid;
  v_keep_current boolean := false;
begin
  if p_status not in ('verified', 'estimated') then
    raise exception 'invalid price status %', p_status using errcode = '22023';
  end if;
  if p_observed_at > now() + interval '1 hour' then
    raise exception 'observed_at is in the future' using errcode = '22023';
  end if;

  select * into v_current
  from public.verified_prices
  where product_id = p_product_id and branch_id = p_branch_id
  for update;

  if found then
    -- Never replace a newer observation with an older one,
    -- and never replace a fresh verified price with an estimate.
    v_keep_current := v_current.observed_at > p_observed_at
      or (p_status = 'estimated'
          and v_current.status = 'verified'
          and v_current.observed_at >= now() - make_interval(days => v_stale_days));
  end if;

  if not v_keep_current then
    insert into public.verified_prices as vp (
      product_id, branch_id, price, status, pack_quantity, pack_unit, brand_label,
      source_type, source_note, source_url, observed_at, verified_at, verified_by, submission_id, is_demo)
    values (
      p_product_id, p_branch_id, p_price, p_status, p_pack_quantity, p_pack_unit, p_brand_label,
      p_source_type, p_source_note, p_source_url, p_observed_at, now(), auth.uid(), p_submission_id,
      p_source_type = 'demo')
    on conflict (product_id, branch_id) do update set
      price = excluded.price,
      status = excluded.status,
      pack_quantity = excluded.pack_quantity,
      pack_unit = excluded.pack_unit,
      brand_label = excluded.brand_label,
      source_type = excluded.source_type,
      source_note = excluded.source_note,
      source_url = excluded.source_url,
      observed_at = excluded.observed_at,
      verified_at = excluded.verified_at,
      verified_by = excluded.verified_by,
      submission_id = excluded.submission_id,
      is_demo = excluded.is_demo
    returning vp.id into v_id;
  else
    v_id := v_current.id;
  end if;

  insert into public.price_history (
    product_id, branch_id, price, status, pack_quantity, pack_unit, brand_label,
    source_type, observed_at, recorded_by, submission_id, is_demo)
  values (
    p_product_id, p_branch_id, p_price, p_status, p_pack_quantity, p_pack_unit, p_brand_label,
    p_source_type, p_observed_at, auth.uid(), p_submission_id, p_source_type = 'demo');

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Moderation
-- ---------------------------------------------------------------------------
create or replace function public.approve_price_submission(
  p_submission_id uuid,
  p_as text default 'verified',
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.price_submissions;
  v_receipt boolean;
  v_photo boolean;
  v_source_type text;
  v_note text;
  v_id uuid;
begin
  if not public.is_moderator() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_as not in ('verified', 'estimated') then
    raise exception 'invalid status' using errcode = '22023';
  end if;

  select * into s from public.price_submissions where id = p_submission_id for update;
  if not found then
    raise exception 'submission not found' using errcode = 'P0002';
  end if;
  if s.status <> 'pending' then
    raise exception 'submission already moderated' using errcode = 'P0001';
  end if;

  select
    exists (select 1 from public.price_evidence e where e.submission_id = s.id),
    exists (select 1 from public.price_evidence e where e.submission_id = s.id and e.kind = 'receipt')
  into v_photo, v_receipt;

  v_source_type := case
    when v_receipt then 'receipt'
    when v_photo then 'price_tag_photo'
    else 'user_submission'
  end;
  v_note := coalesce(nullif(trim(p_note), ''), case
    when p_as = 'estimated' then 'Сообщение пользователя QaiArzan, не подтверждено фото'
    else null
  end);

  update public.price_submissions
  set status = 'approved', approved_as = p_as, moderated_by = auth.uid(), moderated_at = now()
  where id = s.id;

  v_id := public.apply_accepted_price(
    s.product_id, s.branch_id, s.price, p_as, v_source_type, v_note, null, s.observed_at,
    s.pack_quantity, s.pack_unit, s.brand_label, s.id);

  if s.user_id is not null then
    perform public.award_reputation(
      s.user_id, case when s.kind = 'confirm' then 'price_confirmed' else 'price_added' end, s.id);
    if v_photo then
      perform public.award_reputation(s.user_id, 'photo_added', s.id);
    end if;
  end if;

  insert into public.moderation_actions (moderator_id, target_type, target_id, action, reason)
  values (auth.uid(), 'price_submission', s.id, 'approve', p_as);

  return v_id;
end;
$$;

create or replace function public.reject_price_submission(p_submission_id uuid, p_reason text)
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
  select status into v_status from public.price_submissions where id = p_submission_id for update;
  if not found then
    raise exception 'submission not found' using errcode = 'P0002';
  end if;
  if v_status <> 'pending' then
    raise exception 'submission already moderated' using errcode = 'P0001';
  end if;
  update public.price_submissions
  set status = 'rejected', reject_reason = left(p_reason, 300), moderated_by = auth.uid(), moderated_at = now()
  where id = p_submission_id;
  insert into public.moderation_actions (moderator_id, target_type, target_id, action, reason)
  values (auth.uid(), 'price_submission', p_submission_id, 'reject', left(p_reason, 300));
end;
$$;

create or replace function public.resolve_report(p_report_id uuid, p_action text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.reports;
begin
  if not public.is_moderator() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_action not in ('resolve', 'dismiss') then
    raise exception 'invalid action' using errcode = '22023';
  end if;
  select * into r from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'report not found' using errcode = 'P0002';
  end if;
  if r.status <> 'open' then
    raise exception 'report already handled' using errcode = 'P0001';
  end if;
  update public.reports
  set status = case when p_action = 'resolve' then 'resolved' else 'dismissed' end,
      resolved_by = auth.uid(), resolved_at = now(), resolution_note = left(p_note, 300)
  where id = r.id;
  if p_action = 'resolve' and r.reporter_id is not null then
    perform public.award_reputation(r.reporter_id, 'error_fixed', r.id);
  end if;
  insert into public.moderation_actions (moderator_id, target_type, target_id, action, reason)
  values (auth.uid(), 'report', r.id, p_action, left(p_note, 300));
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff price entry (manual grid and CSV import). All-or-nothing per call.
-- p_items: [{product_id, branch_id, price, status, source_type, source_note, source_url,
--            observed_at, pack_quantity, pack_unit, brand_label}]
-- ---------------------------------------------------------------------------
create or replace function public.staff_upsert_prices(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  it jsonb;
  v_count integer := 0;
  v_submission uuid;
  v_status text;
  v_observed timestamptz;
  v_source_type text;
begin
  if not public.is_moderator() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 2000 then
    raise exception 'p_items must be an array of at most 2000 items' using errcode = '22023';
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    v_status := coalesce(it ->> 'status', 'verified');
    v_observed := coalesce((it ->> 'observed_at')::timestamptz, now());
    v_source_type := coalesce(it ->> 'source_type', 'admin_check');
    if v_source_type = 'demo' then
      raise exception 'DEMO prices can only be created by the demo seed' using errcode = '22023';
    end if;

    insert into public.price_submissions (
      product_id, branch_id, kind, price, pack_quantity, pack_unit, brand_label, observed_at,
      user_id, source, status, approved_as, moderated_by, moderated_at, comment)
    values (
      (it ->> 'product_id')::uuid, (it ->> 'branch_id')::uuid, 'new', (it ->> 'price')::numeric,
      (it ->> 'pack_quantity')::numeric, it ->> 'pack_unit', it ->> 'brand_label', v_observed,
      auth.uid(), case when v_source_type = 'import' then 'import' else 'admin' end,
      'approved', v_status, auth.uid(), now(), it ->> 'source_note')
    returning id into v_submission;

    perform public.apply_accepted_price(
      (it ->> 'product_id')::uuid, (it ->> 'branch_id')::uuid, (it ->> 'price')::numeric, v_status,
      v_source_type, it ->> 'source_note', it ->> 'source_url', v_observed,
      (it ->> 'pack_quantity')::numeric, it ->> 'pack_unit', it ->> 'brand_label', v_submission);
    v_count := v_count + 1;
  end loop;

  perform public.write_audit('prices.upsert', 'verified_prices', null,
    jsonb_build_object('count', v_count));
  return v_count;
end;
$$;

create or replace function public.staff_remove_price(p_verified_price_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.verified_prices;
begin
  if not public.is_moderator() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.verified_prices where id = p_verified_price_id returning * into v;
  if not found then
    raise exception 'price not found' using errcode = 'P0002';
  end if;
  perform public.write_audit('prices.remove', 'verified_prices', v.id,
    jsonb_build_object('product_id', v.product_id, 'branch_id', v.branch_id, 'price', v.price,
                       'reason', left(p_reason, 300)));
end;
$$;

-- ---------------------------------------------------------------------------
-- Roles (admin only). The last admin cannot remove themselves.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_role(p_user_id uuid, p_role text, p_grant boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_grant then
    insert into public.user_roles (user_id, role, granted_by)
    values (p_user_id, p_role, auth.uid())
    on conflict do nothing;
  else
    if p_role = 'admin'
       and (select count(*) from public.user_roles where role = 'admin') <= 1
       and exists (select 1 from public.user_roles where user_id = p_user_id and role = 'admin') then
      raise exception 'cannot remove the last admin' using errcode = 'P0001';
    end if;
    delete from public.user_roles where user_id = p_user_id and role = p_role;
  end if;
  perform public.write_audit(case when p_grant then 'role.grant' else 'role.revoke' end,
    'user', p_user_id, jsonb_build_object('role', p_role));
end;
$$;

-- ---------------------------------------------------------------------------
-- Public helpers
-- ---------------------------------------------------------------------------
create or replace function public.record_product_view(p_product_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.product_views_daily (product_id, day, views)
  select p.id, current_date, 1 from public.products p where p.id = p_product_id and p.is_active
  on conflict (product_id, day) do update set views = public.product_views_daily.views + 1;
$$;

-- Open "Хочу узнать цену" votes for a set of products (counts only, no voter data).
create or replace function public.price_request_counts(p_product_ids uuid[])
returns table (product_id uuid, open_requests integer)
language sql
stable
security definer
set search_path = ''
as $$
  select pr.product_id, count(*)::integer
  from public.price_requests pr
  where pr.product_id = any (p_product_ids)
    and pr.created_at > coalesce(
      (select max(vp.observed_at) from public.verified_prices vp
       where vp.product_id = pr.product_id and vp.status = 'verified'),
      '-infinity'::timestamptz)
  group by pr.product_id;
$$;

-- Removes or anonymizes the caller's personal data. Returns evidence file paths
-- so the server can delete the files from storage; the auth user itself is
-- deleted by the server with the service role afterwards.
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
  update public.profiles set display_name = null, email = null where id = v_uid;
  return v_paths;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin dashboard counters (moderators and admins).
-- ---------------------------------------------------------------------------
create or replace function public.qaiarzan_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_stale integer := public.setting_int('price_stale_days', 14);
  v jsonb;
begin
  if not public.is_moderator() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'users_total', (select count(*) from public.profiles),
    'products_active', (select count(*) from public.products where is_active),
    'branches_active', (select count(*) from public.store_branches b join public.stores s on s.id = b.store_id
                        where b.is_active and s.is_active and not s.is_demo),
    'prices_total', (select count(*) from public.verified_prices where not is_demo),
    'prices_fresh_verified', (select count(*) from public.verified_prices
                              where not is_demo and status = 'verified'
                                and observed_at >= now() - make_interval(days => v_stale)),
    'prices_estimated', (select count(*) from public.verified_prices where not is_demo and status = 'estimated'),
    'pending_submissions', (select count(*) from public.price_submissions where status = 'pending'),
    'flagged_submissions', (select count(*) from public.price_submissions where status = 'pending' and is_anomalous),
    'open_reports', (select count(*) from public.reports where status = 'open'),
    'submissions_7d', (select count(*) from public.price_submissions
                       where source = 'user' and created_at >= now() - interval '7 days'),
    'price_updates_7d', (select count(*) from public.price_history
                         where not is_demo and recorded_at >= now() - interval '7 days'),
    'views_7d', (select coalesce(sum(views), 0) from public.product_views_daily
                 where day >= current_date - 6),
    'open_price_requests', (select coalesce(sum(open_requests), 0) from public.price_request_stats),
    'stale_days', v_stale
  ) into v;
  return v;
end;
$$;
