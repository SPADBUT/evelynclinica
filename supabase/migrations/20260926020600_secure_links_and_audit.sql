-- A1: secure_links foundation + audit_logs
-- Runtime Secure Links = A5; full audit instrumentation = A5+

create table public.secure_links (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid not null references public.patients (id) on delete restrict,
  resource_type public.secure_link_resource_type not null,
  resource_id uuid not null,
  action public.secure_link_action not null,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint secure_links_token_hash_not_blank check (length(trim(token_hash)) >= 32),
  constraint secure_links_token_hash_unique unique (token_hash)
);

comment on table public.secure_links is
  'Patient Secure Links. Store token HASH only — never plaintext. Runtime validation in A5.';

comment on column public.secure_links.token_hash is
  'Cryptographic hash of the bearer token. Plaintext token must not be persisted.';

create index secure_links_clinic_id_idx on public.secure_links (clinic_id);
create index secure_links_patient_id_idx on public.secure_links (patient_id);
create index secure_links_resource_idx
  on public.secure_links (clinic_id, resource_type, resource_id);
create index secure_links_expires_at_idx on public.secure_links (expires_at)
  where revoked_at is null;

-- Link signatures back to secure_links when signed via Secure Link
alter table public.document_signatures
  add constraint document_signatures_secure_link_id_fkey
  foreign key (secure_link_id) references public.secure_links (id) on delete set null;

create index document_signatures_secure_link_id_idx
  on public.document_signatures (secure_link_id)
  where secure_link_id is not null;

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics (id) on delete set null,
  actor_user_id uuid references public.profiles (id) on delete set null,
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

create index audit_logs_clinic_id_idx on public.audit_logs (clinic_id);
create index audit_logs_occurred_at_idx on public.audit_logs (occurred_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_actor_user_id_idx on public.audit_logs (actor_user_id)
  where actor_user_id is not null;
create index audit_logs_clinic_action_idx on public.audit_logs (clinic_id, action);
