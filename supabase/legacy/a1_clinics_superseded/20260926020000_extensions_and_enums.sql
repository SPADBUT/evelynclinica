-- A1: extensions, shared enums, updated_at helper
-- RLS policies intentionally deferred to A2.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.clinic_role as enum (
  'admin',
  'assistant',
  'professional',
  'finance',
  'manager'
);

create type public.patient_status as enum (
  'active',
  'inactive',
  'in_treatment'
);

create type public.crm_lead_stage as enum (
  'lead',
  'evaluation',
  'treatment',
  'maintenance'
);

create type public.appointment_status as enum (
  'scheduled',
  'confirmed',
  'completed',
  'cancelled',
  'no_show'
);

create type public.treatment_status as enum (
  'planned',
  'active',
  'completed',
  'cancelled'
);

create type public.treatment_session_status as enum (
  'scheduled',
  'in_progress',
  'completed',
  'cancelled'
);

create type public.clinical_record_status as enum (
  'draft',
  'in_progress',
  'finalized',
  'corrected',
  'cancelled'
);

create type public.document_type as enum (
  'consent',
  'anamnesis',
  'quote',
  'contract',
  'image_authorization',
  'pre_instructions',
  'post_instructions'
);

create type public.document_status as enum (
  'draft',
  'sent',
  'viewed',
  'in_progress',
  'signed',
  'refused',
  'expired',
  'cancelled'
);

create type public.quote_status as enum (
  'draft',
  'sent',
  'approved',
  'refused',
  'expired'
);

create type public.interaction_channel as enum (
  'whatsapp',
  'email',
  'phone',
  'other'
);

create type public.alert_kind as enum (
  'return',
  'quote_expiry',
  'other'
);

create type public.task_status as enum (
  'open',
  'done',
  'cancelled'
);

create type public.photo_category as enum (
  'before',
  'during',
  'after',
  'follow_up'
);

create type public.secure_link_resource_type as enum (
  'term',
  'anamnesis',
  'quote',
  'appointment',
  'document'
);

create type public.secure_link_action as enum (
  'view',
  'sign',
  'accept',
  'refuse',
  'respond'
);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Maintains updated_at on row updates. A1 foundation helper.';
