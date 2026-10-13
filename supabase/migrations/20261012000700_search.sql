-- Catalog search, public counters and demand analytics.

-- Product search: by name (RU/KZ), brand, manufacturer (substring + trigram similarity
-- for typos) and exact barcode. Runs as the caller, so RLS hides DEMO data when needed.
create or replace function public.search_products(
  p_query text default null,
  p_category_slug text default null,
  p_only_priced boolean default false,
  p_sort text default 'popular',
  p_limit integer default 24,
  p_offset integer default 0,
  p_branch_id uuid default null
)
returns table (
  id uuid,
  total_count bigint,
  last_observed_at timestamptz,
  fresh_offer_count integer,
  relevance real
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select nullif(lower(trim(left(p_query, 100))), '') as q
  ),
  barcode as (
    select pb.product_id
    from public.product_barcodes pb, q
    where q.q ~ '^[0-9]{8,14}$' and pb.barcode = q.q
  ),
  stats as (
    select
      vp.product_id,
      max(vp.observed_at) as last_observed_at,
      count(*) filter (
        where vp.status = 'verified'
          and vp.observed_at >= now() - make_interval(days => public.setting_int('price_stale_days', 14))
      )::integer as fresh_count
    from public.verified_prices vp
    where p_branch_id is null or vp.branch_id = p_branch_id
    group by vp.product_id
  ),
  base as (
    select
      p.id,
      s.last_observed_at,
      coalesce(s.fresh_count, 0) as fresh_count,
      p.popularity,
      p.name_ru,
      case when q.q is null then 0::real else extensions.word_similarity(q.q, p.search_text) end as rel
    from public.products p
    cross join q
    join public.product_categories c on c.id = p.category_id
    left join stats s on s.product_id = p.id
    where p.is_active
      and (p_category_slug is null or c.slug = p_category_slug)
      and (
        q.q is null
        or p.id in (select product_id from barcode)
        or strpos(p.search_text, q.q) > 0
        or extensions.word_similarity(q.q, p.search_text) > 0.45
      )
      and (not p_only_priced or coalesce(s.fresh_count, 0) > 0)
  )
  select b.id, count(*) over (), b.last_observed_at, b.fresh_count, b.rel
  from base b
  order by
    case when p_sort = 'relevance' then b.rel end desc nulls last,
    case when p_sort = 'updated' then b.last_observed_at end desc nulls last,
    case when p_sort = 'name' then b.name_ru end asc,
    b.popularity desc,
    b.name_ru asc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

-- Public counters for the home page (real numbers only).
create or replace function public.public_price_stats()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'products', (select count(*) from public.products where is_active),
    -- Headline numbers count real data only; DEMO stores and prices are excluded.
    'branches', (select count(*) from public.store_branches b join public.stores s on s.id = b.store_id
                 where b.is_active and s.is_active and not s.is_demo),
    'fresh_verified', (
      select count(*) from public.verified_prices
      where status = 'verified' and not is_demo
        and observed_at >= now() - make_interval(days => public.setting_int('price_stale_days', 14))),
    'updates_7d', (select count(*) from public.price_history where not is_demo and recorded_at >= now() - interval '7 days'),
    'stale_days', public.setting_int('price_stale_days', 14)
  );
$$;

-- Demand per branch (staff analytics).
create or replace view public.price_request_branch_stats
with (security_invoker = true) as
select pr.branch_id, count(*)::integer as total_requests, max(pr.created_at) as last_requested_at
from public.price_requests pr
where pr.branch_id is not null
group by pr.branch_id;

grant select on public.price_request_branch_stats to authenticated;
grant execute on function public.search_products(text, text, boolean, text, integer, integer, uuid),
  public.public_price_stats() to anon, authenticated;
