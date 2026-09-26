-- A1: procedures, treatments, sessions, appointments, clinical records

create table public.procedures (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  name text not null,
  description text,
  default_duration_minutes integer,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint procedures_name_not_blank check (length(trim(name)) > 0),
  constraint procedures_duration_positive check (
    default_duration_minutes is null or default_duration_minutes > 0
  )
);

comment on table public.procedures is
  'Clinic procedure catalog. Appointments/evolutions may also store free-text names for V2 compatibility.';

create trigger procedures_set_updated_at
  before update on public.procedures
  for each row execute function public.set_updated_at();

create index procedures_clinic_id_idx on public.procedures (clinic_id);
create unique index procedures_clinic_name_unique
  on public.procedures (clinic_id, lower(name));

create table public.procedure_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  procedure_id uuid references public.procedures (id) on delete set null,
  name text not null,
  document_type public.document_type,
  content text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint procedure_templates_name_not_blank check (length(trim(name)) > 0)
);

comment on table public.procedure_templates is
  'Reusable templates (consent text, instructions, etc.) optionally tied to a procedure.';

create trigger procedure_templates_set_updated_at
  before update on public.procedure_templates
  for each row execute function public.set_updated_at();

create index procedure_templates_clinic_id_idx on public.procedure_templates (clinic_id);
create index procedure_templates_procedure_id_idx on public.procedure_templates (procedure_id);

create table public.treatments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid not null references public.patients (id) on delete restrict,
  name text not null,
  status public.treatment_status not null default 'planned',
  started_at date,
  ended_at date,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint treatments_name_not_blank check (length(trim(name)) > 0)
);

comment on table public.treatments is
  'Longitudinal treatment plan for a patient.';

create trigger treatments_set_updated_at
  before update on public.treatments
  for each row execute function public.set_updated_at();

create index treatments_clinic_id_idx on public.treatments (clinic_id);
create index treatments_patient_id_idx on public.treatments (patient_id);
create index treatments_clinic_status_idx on public.treatments (clinic_id, status);

create table public.treatment_sessions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  treatment_id uuid not null references public.treatments (id) on delete restrict,
  patient_id uuid not null references public.patients (id) on delete restrict,
  appointment_id uuid, -- FK added after appointments
  session_number integer,
  scheduled_at timestamptz,
  status public.treatment_session_status not null default 'scheduled',
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint treatment_sessions_number_positive check (
    session_number is null or session_number > 0
  )
);

comment on table public.treatment_sessions is
  'Individual session within a treatment.';

create trigger treatment_sessions_set_updated_at
  before update on public.treatment_sessions
  for each row execute function public.set_updated_at();

create index treatment_sessions_clinic_id_idx on public.treatment_sessions (clinic_id);
create index treatment_sessions_treatment_id_idx on public.treatment_sessions (treatment_id);
create index treatment_sessions_patient_id_idx on public.treatment_sessions (patient_id);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid not null references public.patients (id) on delete restrict,
  procedure_id uuid references public.procedures (id) on delete set null,
  title text not null,
  procedure_name text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'scheduled',
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint appointments_title_not_blank check (length(trim(title)) > 0),
  constraint appointments_time_range check (ends_at > starts_at)
);

comment on table public.appointments is
  'Clinic agenda. procedure_name preserves V2 free-text; procedure_id optional catalog link.';

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

create index appointments_clinic_id_idx on public.appointments (clinic_id);
create index appointments_patient_id_idx on public.appointments (patient_id);
create index appointments_clinic_starts_at_idx on public.appointments (clinic_id, starts_at);
create index appointments_clinic_status_idx on public.appointments (clinic_id, status);

alter table public.treatment_sessions
  add constraint treatment_sessions_appointment_id_fkey
  foreign key (appointment_id) references public.appointments (id) on delete set null;

create index treatment_sessions_appointment_id_idx
  on public.treatment_sessions (appointment_id)
  where appointment_id is not null;

-- Clinical records (evolution header) + versions
create table public.clinical_records (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid not null references public.patients (id) on delete restrict,
  treatment_id uuid references public.treatments (id) on delete set null,
  treatment_session_id uuid references public.treatment_sessions (id) on delete set null,
  procedure_id uuid references public.procedures (id) on delete set null,
  status public.clinical_record_status not null default 'draft',
  current_version_id uuid, -- FK added after versions table
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.clinical_records is
  'Clinical evolution header. Content lives in clinical_record_versions. Do not hard-delete finalized history.';

create trigger clinical_records_set_updated_at
  before update on public.clinical_records
  for each row execute function public.set_updated_at();

create index clinical_records_clinic_id_idx on public.clinical_records (clinic_id);
create index clinical_records_patient_id_idx on public.clinical_records (patient_id);
create index clinical_records_treatment_session_id_idx
  on public.clinical_records (treatment_session_id)
  where treatment_session_id is not null;
create index clinical_records_clinic_status_idx
  on public.clinical_records (clinic_id, status);

create table public.clinical_record_versions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  clinical_record_id uuid not null references public.clinical_records (id) on delete restrict,
  version_number integer not null,
  procedure_name text,
  professional_name text,
  anamnesis text not null default '',
  evolution text not null default '',
  products_used_summary text,
  next_steps text not null default '',
  change_reason text,
  recorded_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint clinical_record_versions_version_positive check (version_number > 0),
  constraint clinical_record_versions_unique_version
    unique (clinical_record_id, version_number)
);

comment on table public.clinical_record_versions is
  'Immutable version history for clinical evolutions. Corrections create new versions.';

create index clinical_record_versions_clinic_id_idx
  on public.clinical_record_versions (clinic_id);
create index clinical_record_versions_record_id_idx
  on public.clinical_record_versions (clinical_record_id);

alter table public.clinical_records
  add constraint clinical_records_current_version_id_fkey
  foreign key (current_version_id)
  references public.clinical_record_versions (id)
  on delete set null;
