-- A1: products/batches/usages, photos metadata, interactions, alerts, tasks

create table public.products (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  name text not null,
  brand text,
  manufacturer text,
  unit text not null default 'unit',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint products_name_not_blank check (length(trim(name)) > 0),
  constraint products_unit_not_blank check (length(trim(unit)) > 0)
);

comment on table public.products is
  'Product master data. Clinical usages store snapshots and do not depend on later master edits.';

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create index products_clinic_id_idx on public.products (clinic_id);
create unique index products_clinic_name_brand_unique
  on public.products (clinic_id, lower(name), lower(coalesce(brand, '')));

create table public.product_batches (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  batch_code text not null,
  expiration_date date,
  received_at date,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint product_batches_code_not_blank check (length(trim(batch_code)) > 0),
  constraint product_batches_unique_code unique (clinic_id, product_id, batch_code)
);

comment on table public.product_batches is
  'Product lots. Must not be deleted when referenced by treatment_product_usages.';

create trigger product_batches_set_updated_at
  before update on public.product_batches
  for each row execute function public.set_updated_at();

create index product_batches_clinic_id_idx on public.product_batches (clinic_id);
create index product_batches_product_id_idx on public.product_batches (product_id);
create index product_batches_batch_code_idx on public.product_batches (clinic_id, batch_code);

create table public.treatment_product_usages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid not null references public.patients (id) on delete restrict,
  clinical_record_id uuid references public.clinical_records (id) on delete restrict,
  treatment_session_id uuid references public.treatment_sessions (id) on delete set null,
  procedure_id uuid references public.procedures (id) on delete set null,
  -- Links to master (optional after snapshot; prefer keep for reverse lookup)
  product_id uuid references public.products (id) on delete restrict,
  product_batch_id uuid references public.product_batches (id) on delete restrict,
  -- Historical snapshot (immutable intent)
  product_name text not null,
  brand text,
  manufacturer text,
  batch_code text,
  expiration_date date,
  quantity numeric(12, 3) not null,
  unit text not null,
  used_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint treatment_product_usages_name_not_blank check (length(trim(product_name)) > 0),
  constraint treatment_product_usages_quantity_positive check (quantity > 0),
  constraint treatment_product_usages_unit_not_blank check (length(trim(unit)) > 0)
);

comment on table public.treatment_product_usages is
  'Clinical product/lot usage with historical snapshot. Append-oriented; do not hard-delete.';

create index treatment_product_usages_clinic_id_idx
  on public.treatment_product_usages (clinic_id);
create index treatment_product_usages_patient_id_idx
  on public.treatment_product_usages (patient_id);
create index treatment_product_usages_clinical_record_id_idx
  on public.treatment_product_usages (clinical_record_id)
  where clinical_record_id is not null;
create index treatment_product_usages_batch_id_idx
  on public.treatment_product_usages (product_batch_id)
  where product_batch_id is not null;
create index treatment_product_usages_batch_code_idx
  on public.treatment_product_usages (clinic_id, batch_code)
  where batch_code is not null;

-- Prevent deleting batches that were used clinically
create or replace function public.prevent_delete_used_product_batch()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.treatment_product_usages u
    where u.product_batch_id = old.id
  ) then
    raise exception
      'Cannot delete product_batch %: referenced by treatment_product_usages',
      old.id;
  end if;
  return old;
end;
$$;

create trigger product_batches_prevent_delete_if_used
  before delete on public.product_batches
  for each row execute function public.prevent_delete_used_product_batch();

-- Photos: metadata only in A1 (binary Storage = A4)
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid not null references public.patients (id) on delete restrict,
  appointment_id uuid references public.appointments (id) on delete set null,
  treatment_session_id uuid references public.treatment_sessions (id) on delete set null,
  procedure_id uuid references public.procedures (id) on delete set null,
  category public.photo_category not null,
  storage_path text,
  captured_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint photos_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.photos is
  'Clinical photo metadata. storage_path filled when private Storage is enabled (A4). No public buckets.';

create trigger photos_set_updated_at
  before update on public.photos
  for each row execute function public.set_updated_at();

create index photos_clinic_id_idx on public.photos (clinic_id);
create index photos_patient_id_idx on public.photos (patient_id);
create index photos_appointment_id_idx on public.photos (appointment_id)
  where appointment_id is not null;
create index photos_treatment_session_id_idx on public.photos (treatment_session_id)
  where treatment_session_id is not null;
create index photos_clinic_category_idx on public.photos (clinic_id, category);

-- Interactions (V2)
create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid references public.patients (id) on delete set null,
  lead_id uuid references public.crm_leads (id) on delete set null,
  channel public.interaction_channel not null,
  summary text not null,
  occurred_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint interactions_summary_not_blank check (length(trim(summary)) > 0),
  constraint interactions_has_subject check (patient_id is not null or lead_id is not null)
);

comment on table public.interactions is
  'CRM interaction log (V2 Interaction).';

create index interactions_clinic_id_idx on public.interactions (clinic_id);
create index interactions_patient_id_idx on public.interactions (patient_id)
  where patient_id is not null;
create index interactions_lead_id_idx on public.interactions (lead_id)
  where lead_id is not null;
create index interactions_clinic_occurred_at_idx
  on public.interactions (clinic_id, occurred_at desc);

-- Alerts (primarily from V2 Reminder return/quote_expiry)
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid references public.patients (id) on delete set null,
  kind public.alert_kind not null default 'other',
  title text not null,
  due_at date,
  is_done boolean not null default false,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint alerts_title_not_blank check (length(trim(title)) > 0)
);

comment on table public.alerts is
  'Operational/clinical alerts (V2 Reminder: return, quote expiry).';

create trigger alerts_set_updated_at
  before update on public.alerts
  for each row execute function public.set_updated_at();

create index alerts_clinic_id_idx on public.alerts (clinic_id);
create index alerts_clinic_due_at_idx on public.alerts (clinic_id, due_at)
  where is_done = false;
create index alerts_patient_id_idx on public.alerts (patient_id)
  where patient_id is not null;

-- Tasks (operational; soft-deletable)
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid references public.patients (id) on delete set null,
  title text not null,
  due_at date,
  status public.task_status not null default 'open',
  assignee_user_id uuid references public.profiles (id) on delete set null,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint tasks_title_not_blank check (length(trim(title)) > 0)
);

comment on table public.tasks is
  'Operational tasks. Soft-deletable via deleted_at.';

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create index tasks_clinic_id_idx on public.tasks (clinic_id);
create index tasks_clinic_status_idx on public.tasks (clinic_id, status)
  where deleted_at is null;
create index tasks_assignee_user_id_idx on public.tasks (assignee_user_id)
  where assignee_user_id is not null;
