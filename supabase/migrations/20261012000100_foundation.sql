-- Sat+ / QaiArzan — foundation: extensions, helpers, cities, roles, profiles, settings.

create extension if not exists pg_trgm with schema extensions;

-- Generic updated_at trigger.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cities (multi-city ready: Сатпаев first, Жезказган and others later)
-- ---------------------------------------------------------------------------
create table public.cities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,64}$'),
  name_ru text not null check (char_length(name_ru) between 2 and 80),
  name_kk text not null check (char_length(name_kk) between 2 and 80),
  timezone text not null default 'Asia/Almaty',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger cities_updated_at before update on public.cities
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Roles. Regular users have no row; staff roles are granted explicitly.
-- ---------------------------------------------------------------------------
create table public.roles (
  code text primary key check (code in ('moderator', 'admin')),
  name_ru text not null,
  description text
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 2 and 40),
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null references public.roles (code),
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- Profile row is created automatically for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- Admins are implicitly moderators.
create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('moderator', 'admin')
  );
$$;

-- ---------------------------------------------------------------------------
-- Application settings (non-secret, readable by everyone).
-- ---------------------------------------------------------------------------
create table public.app_settings (
  key text primary key check (key ~ '^[a-z_]{2,64}$'),
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

create or replace function public.setting_int(p_key text, p_default integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (value #>> '{}')::integer from public.app_settings where key = p_key), p_default);
$$;

-- DEMO data is only ever visible while this flag is on. In production keep it false.
create or replace function public.demo_mode_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (value #>> '{}')::boolean from public.app_settings where key = 'demo_mode'), false);
$$;

-- ---------------------------------------------------------------------------
-- Admin audit log (append-only).
-- ---------------------------------------------------------------------------
create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) between 2 and 64),
  entity_type text not null check (char_length(entity_type) between 2 and 64),
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);
create index admin_audit_logs_entity_idx on public.admin_audit_logs (entity_type, entity_id);

create or replace function public.write_audit(p_action text, p_entity_type text, p_entity_id uuid, p_details jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;
