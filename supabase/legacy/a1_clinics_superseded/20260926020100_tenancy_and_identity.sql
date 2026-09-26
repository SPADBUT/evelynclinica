-- A1: multi-tenancy + identity (Auth runtime = A2; RLS = A2)

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint clinics_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint clinics_slug_unique unique (slug)
);

comment on table public.clinics is
  'Tenant root. All business entities reference clinic_id for multi-tenancy.';

create trigger clinics_set_updated_at
  before update on public.clinics
  for each row execute function public.set_updated_at();

-- profiles: 1:1 with auth.users (Supabase Auth)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_email_unique unique (email)
);

comment on table public.profiles is
  'Staff profile linked to auth.users. Patients do not get profiles/accounts in V3.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.clinic_memberships (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.clinic_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint clinic_memberships_clinic_user_unique unique (clinic_id, user_id)
);

comment on table public.clinic_memberships is
  'User ↔ clinic membership with role. clinic_id for RLS must derive from this (A2).';

create trigger clinic_memberships_set_updated_at
  before update on public.clinic_memberships
  for each row execute function public.set_updated_at();

create index clinic_memberships_user_id_idx
  on public.clinic_memberships (user_id);

create index clinic_memberships_clinic_id_idx
  on public.clinic_memberships (clinic_id);

create index clinic_memberships_active_role_idx
  on public.clinic_memberships (clinic_id, role)
  where is_active = true;
