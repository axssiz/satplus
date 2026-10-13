-- QaiArzan prices: submissions, evidence, verified prices, history, requests, reports,
-- reputation, moderation, views, shopping lists.

-- ---------------------------------------------------------------------------
-- User price submissions (always start as pending; never public until approved)
-- ---------------------------------------------------------------------------
create table public.price_submissions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  branch_id uuid not null references public.store_branches (id) on delete cascade,
  kind text not null default 'new' check (kind in ('new', 'confirm')),
  price numeric(12, 2) not null check (price > 0 and price < 10000000),
  -- Pack actually seen on the shelf (required for analog products, validated server-side).
  pack_quantity numeric(12, 3) check (pack_quantity is null or pack_quantity > 0),
  pack_unit text check (pack_unit is null or pack_unit in ('g', 'kg', 'ml', 'l', 'pcs')),
  brand_label text check (brand_label is null or char_length(brand_label) <= 80),
  observed_at timestamptz not null default now(),
  comment text check (comment is null or char_length(comment) <= 500),
  user_id uuid references auth.users (id) on delete set null,
  -- Salted hash of IP + user agent, only for rate limiting. Raw IPs are never stored.
  client_hash text check (client_hash is null or char_length(client_hash) = 64),
  source text not null default 'user' check (source in ('user', 'admin', 'import')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_as text check (approved_as is null or approved_as in ('verified', 'estimated')),
  reference_price numeric(12, 2),
  is_anomalous boolean not null default false,
  anomaly_reason text,
  moderated_by uuid references auth.users (id) on delete set null,
  moderated_at timestamptz,
  reject_reason text check (reject_reason is null or char_length(reject_reason) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((pack_quantity is null) = (pack_unit is null)),
  check (observed_at <= created_at + interval '1 hour'),
  check ((status = 'approved') = (approved_as is not null))
);
create index price_submissions_queue_idx on public.price_submissions (status, created_at);
create index price_submissions_product_idx on public.price_submissions (product_id, created_at desc);
create index price_submissions_user_idx on public.price_submissions (user_id, created_at desc);
create index price_submissions_client_idx on public.price_submissions (client_hash, created_at desc);
create trigger price_submissions_updated_at before update on public.price_submissions
  for each row execute function public.set_updated_at();

-- Photos of price tags / receipts. Stored in the private "price-evidence" bucket,
-- re-encoded on the client (EXIF stripped) and optionally redacted by the user.
create table public.price_evidence (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.price_submissions (id) on delete cascade,
  storage_path text not null unique,
  kind text not null check (kind in ('price_tag', 'receipt', 'shelf')),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  redacted_by_user boolean not null default false,
  created_at timestamptz not null default now()
);
create index price_evidence_submission_idx on public.price_evidence (submission_id);

-- ---------------------------------------------------------------------------
-- Current price per product per branch (one row). Only moderated data lands here.
-- ---------------------------------------------------------------------------
create table public.verified_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  branch_id uuid not null references public.store_branches (id) on delete cascade,
  price numeric(12, 2) not null check (price > 0 and price < 10000000),
  status text not null check (status in ('verified', 'estimated')),
  pack_quantity numeric(12, 3) check (pack_quantity is null or pack_quantity > 0),
  pack_unit text check (pack_unit is null or pack_unit in ('g', 'kg', 'ml', 'l', 'pcs')),
  brand_label text check (brand_label is null or char_length(brand_label) <= 80),
  source_type text not null check (source_type in (
    'user_submission', 'admin_check', 'store_website', 'price_tag_photo', 'receipt', 'import', 'demo')),
  source_note text check (source_note is null or char_length(source_note) <= 300),
  source_url text check (source_url is null or source_url ~ '^https://'),
  observed_at timestamptz not null,
  verified_at timestamptz not null default now(),
  verified_by uuid references auth.users (id) on delete set null,
  submission_id uuid references public.price_submissions (id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, branch_id),
  check ((pack_quantity is null) = (pack_unit is null)),
  -- An estimated price is only allowed with a real, named source.
  check (status <> 'estimated' or source_note is not null or source_url is not null),
  check (is_demo = (source_type = 'demo'))
);
create index verified_prices_branch_idx on public.verified_prices (branch_id);
create index verified_prices_observed_idx on public.verified_prices (observed_at desc);
create trigger verified_prices_updated_at before update on public.verified_prices
  for each row execute function public.set_updated_at();

-- Every accepted price point, append-only. Charts read only from here.
create table public.price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  branch_id uuid not null references public.store_branches (id) on delete cascade,
  price numeric(12, 2) not null check (price > 0),
  status text not null check (status in ('verified', 'estimated')),
  pack_quantity numeric(12, 3),
  pack_unit text check (pack_unit is null or pack_unit in ('g', 'kg', 'ml', 'l', 'pcs')),
  brand_label text,
  source_type text not null,
  observed_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  recorded_by uuid references auth.users (id) on delete set null,
  submission_id uuid references public.price_submissions (id) on delete set null,
  is_demo boolean not null default false
);
create index price_history_product_idx on public.price_history (product_id, observed_at desc);
create index price_history_branch_idx on public.price_history (branch_id, observed_at desc);

-- DEMO prices may only be attached to DEMO stores, and real stores never get DEMO prices.
create or replace function public.enforce_demo_consistency()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_store_demo boolean;
begin
  select s.is_demo into v_store_demo
  from public.store_branches b join public.stores s on s.id = b.store_id
  where b.id = new.branch_id;
  if v_store_demo is distinct from new.is_demo then
    raise exception 'DEMO prices are only allowed for DEMO stores (and only DEMO prices for them)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger verified_prices_demo_guard before insert or update on public.verified_prices
  for each row execute function public.enforce_demo_consistency();
create trigger price_history_demo_guard before insert or update on public.price_history
  for each row execute function public.enforce_demo_consistency();

-- ---------------------------------------------------------------------------
-- "Хочу узнать цену" votes. One vote per voter per product (and branch).
-- ---------------------------------------------------------------------------
create table public.price_requests (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  branch_id uuid references public.store_branches (id) on delete cascade,
  voter_key text not null check (char_length(voter_key) between 8 and 80),
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index price_requests_unique_vote on public.price_requests (
  product_id, coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid), voter_key);
create index price_requests_product_idx on public.price_requests (product_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Error reports ("Сообщить об ошибке") and complaints.
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('product', 'verified_price', 'store_branch')),
  target_id uuid not null,
  reason text not null check (reason in ('wrong_price', 'wrong_info', 'duplicate', 'outdated', 'other')),
  message text check (message is null or char_length(message) <= 1000),
  reporter_id uuid references auth.users (id) on delete set null,
  client_hash text check (client_hash is null or char_length(client_hash) = 64),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 300),
  created_at timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at);
create index reports_target_idx on public.reports (target_type, target_id);

-- ---------------------------------------------------------------------------
-- Reputation points. Not money, no monetary value; only for approved useful actions.
-- ---------------------------------------------------------------------------
create table public.user_reputation (
  user_id uuid primary key references auth.users (id) on delete cascade,
  points integer not null default 0 check (points >= 0),
  approved_actions integer not null default 0 check (approved_actions >= 0),
  updated_at timestamptz not null default now()
);

create table public.reputation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null check (action in ('price_added', 'photo_added', 'price_confirmed', 'error_fixed')),
  points integer not null check (points > 0 and points <= 100),
  source_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, action, source_id)
);
create index reputation_events_user_idx on public.reputation_events (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Moderation log.
-- ---------------------------------------------------------------------------
create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid references auth.users (id) on delete set null,
  target_type text not null check (target_type in ('price_submission', 'report')),
  target_id uuid not null,
  action text not null check (action in ('approve', 'reject', 'resolve', 'dismiss')),
  reason text,
  created_at timestamptz not null default now()
);
create index moderation_actions_target_idx on public.moderation_actions (target_type, target_id);
create index moderation_actions_created_idx on public.moderation_actions (created_at desc);

-- ---------------------------------------------------------------------------
-- Aggregated product views (no personal data).
-- ---------------------------------------------------------------------------
create table public.product_views_daily (
  product_id uuid not null references public.products (id) on delete cascade,
  day date not null default current_date,
  views integer not null default 0 check (views >= 0),
  primary key (product_id, day)
);

-- ---------------------------------------------------------------------------
-- Shopping lists (account sync; anonymous users keep lists in the browser).
-- ---------------------------------------------------------------------------
create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Мой список' check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shopping_lists_user_idx on public.shopping_lists (user_id);
create trigger shopping_lists_updated_at before update on public.shopping_lists
  for each row execute function public.set_updated_at();

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity numeric(10, 3) not null default 1 check (quantity > 0 and quantity <= 1000),
  created_at timestamptz not null default now(),
  unique (list_id, product_id)
);
