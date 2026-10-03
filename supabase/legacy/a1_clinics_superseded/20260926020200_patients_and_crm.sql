-- A1: patients, tags, CRM leads

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
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
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.patients is
  'Clinical patient registry. Soft-deletable via deleted_at. No patient auth accounts.';

create trigger patients_set_updated_at
  before update on public.patients
  for each row execute function public.set_updated_at();

create index patients_clinic_id_idx on public.patients (clinic_id);
create index patients_clinic_status_idx on public.patients (clinic_id, status)
  where deleted_at is null;
create index patients_clinic_email_idx on public.patients (clinic_id, lower(email))
  where email is not null and deleted_at is null;
create index patients_clinic_cpf_idx on public.patients (clinic_id, cpf)
  where cpf is not null and deleted_at is null;

create table public.patient_tags (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid not null references public.patients (id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint patient_tags_tag_not_blank check (length(trim(tag)) > 0),
  constraint patient_tags_patient_tag_unique unique (patient_id, tag)
);

comment on table public.patient_tags is
  'Normalized patient tags (V2 Patient.tags[]).';

create index patient_tags_clinic_id_idx on public.patient_tags (clinic_id);
create index patient_tags_patient_id_idx on public.patient_tags (patient_id);
create index patient_tags_clinic_tag_idx on public.patient_tags (clinic_id, tag);

create table public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  full_name text not null,
  email text,
  phone text,
  source text,
  stage public.crm_lead_stage not null default 'lead',
  interest text,
  notes text,
  patient_id uuid references public.patients (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.crm_leads is
  'V2 Lead domain. patient_id nullable — lead is not necessarily a patient.';

create trigger crm_leads_set_updated_at
  before update on public.crm_leads
  for each row execute function public.set_updated_at();

create index crm_leads_clinic_id_idx on public.crm_leads (clinic_id);
create index crm_leads_clinic_stage_idx on public.crm_leads (clinic_id, stage)
  where deleted_at is null;
create index crm_leads_patient_id_idx on public.crm_leads (patient_id)
  where patient_id is not null;

-- Ensure lead.patient belongs to same clinic when set
create or replace function public.enforce_crm_lead_patient_clinic()
returns trigger
language plpgsql
as $$
declare
  patient_clinic uuid;
begin
  if new.patient_id is null then
    return new;
  end if;

  select clinic_id into patient_clinic
  from public.patients
  where id = new.patient_id;

  if patient_clinic is null then
    raise exception 'crm_leads.patient_id % does not exist', new.patient_id;
  end if;

  if patient_clinic <> new.clinic_id then
    raise exception 'crm_leads.patient_id must belong to the same clinic';
  end if;

  return new;
end;
$$;

create trigger crm_leads_enforce_patient_clinic
  before insert or update of patient_id, clinic_id on public.crm_leads
  for each row execute function public.enforce_crm_lead_patient_clinic();
