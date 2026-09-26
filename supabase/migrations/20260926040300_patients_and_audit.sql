-- A1: patients + audit_logs

create type public.patient_status as enum (
  'active',
  'inactive',
  'in_treatment'
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  full_name text not null,
  email text,
  phone text,
  cpf text,
  birth_date date,
  gender text,
  address text,
  allergies text,
  medications text,
  notes text,
  status public.patient_status not null default 'active',
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint patients_full_name_not_blank check (length(trim(full_name)) > 0)
);

comment on table public.patients is
  'Patient registry. Soft-deletable via deleted_at. No patient Auth accounts in V3.';

create trigger patients_set_updated_at
  before update on public.patients
  for each row execute function public.set_updated_at();

create index patients_organization_id_idx on public.patients (organization_id);
create index patients_org_status_idx
  on public.patients (organization_id, status)
  where deleted_at is null;
create index patients_org_email_idx
  on public.patients (organization_id, lower(email))
  where email is not null and deleted_at is null;
create index patients_org_cpf_idx
  on public.patients (organization_id, cpf)
  where cpf is not null and deleted_at is null;

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  actor_user_id uuid references public.staff_profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  occurred_at timestamptz not null default timezone('utc', now()),
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  constraint audit_logs_action_not_blank check (length(trim(action)) > 0),
  constraint audit_logs_entity_type_not_blank check (length(trim(entity_type)) > 0),
  constraint audit_logs_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.audit_logs is
  'Append-oriented audit trail. Do not store unnecessary clinical content in metadata.';

create index audit_logs_organization_id_idx on public.audit_logs (organization_id);
create index audit_logs_occurred_at_idx on public.audit_logs (occurred_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_actor_user_id_idx
  on public.audit_logs (actor_user_id)
  where actor_user_id is not null;
create index audit_logs_org_action_idx
  on public.audit_logs (organization_id, action);
