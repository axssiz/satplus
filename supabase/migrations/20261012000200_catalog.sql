-- QaiArzan catalog: stores, branches, categories, brands, products, barcodes, equivalences.

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,64}$'),
  name text not null check (char_length(name) between 1 and 80),
  logo_path text,
  website text check (website is null or website ~ '^https://'),
  description text check (description is null or char_length(description) <= 1000),
  verification_status text not null default 'needs_check'
    check (verification_status in ('unverified', 'needs_check', 'verified')),
  is_demo boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger stores_updated_at before update on public.stores
  for each row execute function public.set_updated_at();

-- Every physical branch is its own entity; prices always belong to a branch.
create table public.store_branches (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  city_id uuid not null references public.cities (id),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,96}$'),
  name text not null check (char_length(name) between 1 and 120),
  -- Unverified facts stay NULL. Never fill with guesses.
  address text check (address is null or char_length(address) <= 200),
  latitude numeric(9, 6) check (latitude is null or latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude is null or longitude between -180 and 180),
  opening_hours text check (opening_hours is null or char_length(opening_hours) <= 200),
  phone text check (phone is null or phone ~ '^\+?[0-9 ()-]{6,24}$'),
  verification_status text not null default 'needs_check'
    check (verification_status in ('unverified', 'needs_check', 'verified')),
  last_verified_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((latitude is null) = (longitude is null))
);
create index store_branches_store_idx on public.store_branches (store_id);
create index store_branches_city_idx on public.store_branches (city_id);
create trigger store_branches_updated_at before update on public.store_branches
  for each row execute function public.set_updated_at();

-- A branch is publicly visible when it and its store are active and, for DEMO stores, demo mode is on.
create or replace function public.branch_visible(p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.store_branches b
    join public.stores s on s.id = b.store_id
    where b.id = p_branch_id
      and b.is_active and s.is_active
      and (not s.is_demo or public.demo_mode_enabled())
  );
$$;

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,64}$'),
  name_ru text not null check (char_length(name_ru) between 2 and 80),
  name_kk text not null check (char_length(name_kk) between 2 and 80),
  icon text not null default 'package' check (icon ~ '^[a-z0-9-]{2,40}$'),
  parent_id uuid references public.product_categories (id) on delete set null,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger product_categories_updated_at before update on public.product_categories
  for each row execute function public.set_updated_at();

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,64}$'),
  name text not null check (char_length(name) between 1 and 80),
  manufacturer text check (manufacturer is null or char_length(manufacturer) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index brands_name_lower_idx on public.brands (lower(name));
create trigger brands_updated_at before update on public.brands
  for each row execute function public.set_updated_at();

-- unit: the base unit used for "price per unit" (kg, l, pcs).
-- identical: one exact SKU (brand + pack). Only same-product prices are ranked.
-- analog:    a generic position (e.g. "Сахар-песок"); every price carries its own pack and brand,
--            and ranking is by price per base unit.
-- is_weighted: sold by weight, the price is per 1 base unit (kg).
create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,96}$'),
  category_id uuid not null references public.product_categories (id),
  brand_id uuid references public.brands (id) on delete set null,
  name_ru text not null check (char_length(name_ru) between 2 and 160),
  name_kk text check (name_kk is null or char_length(name_kk) between 2 and 160),
  manufacturer text check (manufacturer is null or char_length(manufacturer) <= 120),
  description_ru text check (description_ru is null or char_length(description_ru) <= 2000),
  description_kk text check (description_kk is null or char_length(description_kk) <= 2000),
  image_path text,
  unit text not null check (unit in ('kg', 'l', 'pcs')),
  net_quantity numeric(12, 3) check (net_quantity is null or net_quantity > 0),
  net_unit text check (net_unit is null or net_unit in ('g', 'kg', 'ml', 'l', 'pcs')),
  comparison_mode text not null default 'analog' check (comparison_mode in ('identical', 'analog')),
  is_weighted boolean not null default false,
  fat_percent numeric(4, 1) check (fat_percent is null or fat_percent between 0 and 100),
  attributes jsonb not null default '{}'::jsonb,
  specs_verified boolean not null default false,
  is_active boolean not null default true,
  popularity integer not null default 0,
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((net_quantity is null) = (net_unit is null)),
  -- Weighted goods are priced per base unit and have no fixed pack.
  check (not is_weighted or net_quantity is null)
);
create index products_category_idx on public.products (category_id) where is_active;
create index products_brand_idx on public.products (brand_id);
create index products_popularity_idx on public.products (popularity desc);
create index products_search_trgm_idx on public.products using gin (search_text extensions.gin_trgm_ops);
-- Duplicate protection: same normalized name + brand + pack is one product.
create unique index products_dedup_idx on public.products (
  lower(regexp_replace(name_ru, '\s+', ' ', 'g')),
  coalesce(brand_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(net_quantity, 0),
  coalesce(net_unit, '-')
);
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create or replace function public.products_build_search_text()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_brand text;
begin
  select b.name into v_brand from public.brands b where b.id = new.brand_id;
  new.search_text := lower(concat_ws(' ', new.name_ru, new.name_kk, v_brand, new.manufacturer));
  return new;
end;
$$;
create trigger products_search_text before insert or update of name_ru, name_kk, brand_id, manufacturer
  on public.products for each row execute function public.products_build_search_text();

create or replace function public.brands_touch_products()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.name is distinct from old.name then
    update public.products set brand_id = brand_id where brand_id = new.id;
  end if;
  return new;
end;
$$;
create trigger brands_touch_products after update on public.brands
  for each row execute function public.brands_touch_products();

create table public.product_barcodes (
  barcode text primary key check (barcode ~ '^[0-9]{8,14}$'),
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index product_barcodes_product_idx on public.product_barcodes (product_id);

-- Groups of interchangeable products, compared by price per base unit.
create table public.product_equivalence_groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,64}$'),
  name_ru text not null,
  name_kk text not null,
  base_unit text not null check (base_unit in ('kg', 'l', 'pcs')),
  created_at timestamptz not null default now()
);

create table public.product_equivalences (
  group_id uuid not null references public.product_equivalence_groups (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  primary key (group_id, product_id)
);
create index product_equivalences_product_idx on public.product_equivalences (product_id);
