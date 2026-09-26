-- A1: tenant root

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint organizations_name_not_blank check (length(trim(name)) > 0),
  constraint organizations_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint organizations_slug_unique unique (slug)
);

comment on table public.organizations is
  'Tenant root. Business rows are scoped by organization_id. Isolation is enforced by RLS.';

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();
