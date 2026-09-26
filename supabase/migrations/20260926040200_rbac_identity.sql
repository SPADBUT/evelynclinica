-- A1: staff identity + RBAC tables
-- auth.users → staff_profiles → staff_roles → roles
-- roles ← role_permissions → permissions
-- Authority for roles is staff_roles (never auth.users.raw_user_meta_data).

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint roles_code_format check (code ~ '^[a-z][a-z0-9_]*$'),
  constraint roles_code_unique unique (code),
  constraint roles_name_not_blank check (length(trim(name)) > 0)
);

comment on table public.roles is
  'Canonical staff roles: admin, clinician, assistant. No patient role in V3.';

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint permissions_code_format check (code ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),
  constraint permissions_code_unique unique (code),
  constraint permissions_name_not_blank check (length(trim(name)) > 0)
);

comment on table public.permissions is
  'Capability codes (domain.action). Seeded in A1; enforced by RLS helpers.';

create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint role_permissions_unique unique (role_id, permission_id)
);

comment on table public.role_permissions is
  'Maps roles to permissions. Source of truth for RBAC capabilities.';

create index role_permissions_role_id_idx on public.role_permissions (role_id);
create index role_permissions_permission_id_idx on public.role_permissions (permission_id);

-- Staff profile: 1:1 with auth.users; belongs to exactly one organization (A1).
create table public.staff_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  full_name text not null,
  email text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint staff_profiles_full_name_not_blank check (length(trim(full_name)) > 0),
  constraint staff_profiles_email_unique unique (email)
);

comment on table public.staff_profiles is
  'Internal staff only. Patients do NOT get auth.users / staff_profiles in V3.';

comment on column public.staff_profiles.organization_id is
  'Tenant of the staff member. current_organization_id() reads this — never trust client-sent org id.';

create trigger staff_profiles_set_updated_at
  before update on public.staff_profiles
  for each row execute function public.set_updated_at();

create index staff_profiles_organization_id_idx
  on public.staff_profiles (organization_id);

create index staff_profiles_org_active_idx
  on public.staff_profiles (organization_id)
  where is_active = true;

create table public.staff_roles (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_profiles (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  constraint staff_roles_unique unique (staff_id, role_id)
);

comment on table public.staff_roles is
  'Assigned roles for a staff user. RLS/RBAC authority — not JWT user_metadata.';

create index staff_roles_staff_id_idx on public.staff_roles (staff_id);
create index staff_roles_role_id_idx on public.staff_roles (role_id);
