-- A1: documents (versioned) + commercial quotes

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid not null references public.patients (id) on delete restrict,
  type public.document_type not null,
  title text not null,
  status public.document_status not null default 'draft',
  procedure_name text,
  current_version_id uuid, -- FK after versions
  quote_id uuid, -- FK after quotes (optional link)
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint documents_title_not_blank check (length(trim(title)) > 0)
);

comment on table public.documents is
  'Clinical/commercial documents (consent, contract, anamnesis, etc.). Signed docs stay historically intact via versions.';

create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

create index documents_clinic_id_idx on public.documents (clinic_id);
create index documents_patient_id_idx on public.documents (patient_id);
create index documents_clinic_type_status_idx
  on public.documents (clinic_id, type, status);

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  document_id uuid not null references public.documents (id) on delete restrict,
  version_number integer not null,
  content text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint document_versions_version_positive check (version_number > 0),
  constraint document_versions_unique_version unique (document_id, version_number)
);

comment on table public.document_versions is
  'Immutable document content versions. Do not edit signed version content in place.';

create index document_versions_clinic_id_idx on public.document_versions (clinic_id);
create index document_versions_document_id_idx on public.document_versions (document_id);

alter table public.documents
  add constraint documents_current_version_id_fkey
  foreign key (current_version_id)
  references public.document_versions (id)
  on delete set null;

create table public.document_signatures (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  document_id uuid not null references public.documents (id) on delete restrict,
  document_version_id uuid not null references public.document_versions (id) on delete restrict,
  signed_by_name text not null,
  signed_at timestamptz not null default timezone('utc', now()),
  signature_storage_path text,
  ip_address inet,
  user_agent text,
  secure_link_id uuid, -- FK after secure_links
  created_at timestamptz not null default timezone('utc', now()),
  constraint document_signatures_name_not_blank check (length(trim(signed_by_name)) > 0)
);

comment on table public.document_signatures is
  'Signature audit for a specific document version. Append-oriented; do not hard-delete.';

create index document_signatures_clinic_id_idx on public.document_signatures (clinic_id);
create index document_signatures_document_id_idx on public.document_signatures (document_id);
create index document_signatures_version_id_idx on public.document_signatures (document_version_id);

-- Quotes (V2 Budget)
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid references public.patients (id) on delete set null,
  lead_id uuid references public.crm_leads (id) on delete set null,
  title text not null,
  discount numeric(12, 2) not null default 0,
  notes text,
  status public.quote_status not null default 'draft',
  valid_until date,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint quotes_title_not_blank check (length(trim(title)) > 0),
  constraint quotes_discount_non_negative check (discount >= 0),
  constraint quotes_has_subject check (patient_id is not null or lead_id is not null)
);

comment on table public.quotes is
  'Commercial quotes (V2 Budget). Soft-deletable. May link patient and/or lead.';

create trigger quotes_set_updated_at
  before update on public.quotes
  for each row execute function public.set_updated_at();

create index quotes_clinic_id_idx on public.quotes (clinic_id);
create index quotes_patient_id_idx on public.quotes (patient_id)
  where patient_id is not null;
create index quotes_lead_id_idx on public.quotes (lead_id)
  where lead_id is not null;
create index quotes_clinic_status_idx on public.quotes (clinic_id, status)
  where deleted_at is null;

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  quote_id uuid not null references public.quotes (id) on delete cascade,
  description text not null,
  quantity numeric(12, 3) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  constraint quote_items_description_not_blank check (length(trim(description)) > 0),
  constraint quote_items_quantity_positive check (quantity > 0),
  constraint quote_items_unit_price_non_negative check (unit_price >= 0)
);

comment on table public.quote_items is
  'Line items for quotes (V2 BudgetItem).';

create index quote_items_clinic_id_idx on public.quote_items (clinic_id);
create index quote_items_quote_id_idx on public.quote_items (quote_id);

alter table public.documents
  add constraint documents_quote_id_fkey
  foreign key (quote_id) references public.quotes (id) on delete set null;

create index documents_quote_id_idx on public.documents (quote_id)
  where quote_id is not null;
