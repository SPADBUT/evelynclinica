-- A1 local validation (PostgreSQL 16 + auth.users stub)
-- NOT a Supabase CLI/Docker stack validation.

\set ON_ERROR_STOP on

drop schema if exists public cascade;
drop schema if exists auth cascade;
create schema auth;
create schema public;

create table auth.users (
  id uuid primary key,
  email text
);

\i /workspace/supabase/migrations/20260926020000_extensions_and_enums.sql
\i /workspace/supabase/migrations/20260926020100_tenancy_and_identity.sql
\i /workspace/supabase/migrations/20260926020200_patients_and_crm.sql
\i /workspace/supabase/migrations/20260926020300_clinical_core.sql
\i /workspace/supabase/migrations/20260926020400_documents_and_quotes.sql
\i /workspace/supabase/migrations/20260926020500_products_photos_ops.sql
\i /workspace/supabase/migrations/20260926020600_secure_links_and_audit.sql
\i /workspace/supabase/migrations/20260926020700_same_clinic_integrity.sql

do $$
declare
  clinic_a uuid;
  clinic_b uuid;
  patient_a uuid;
  patient_b uuid;
  lead_a uuid;
  treatment_a uuid;
  session_a uuid;
  appointment_a uuid;
  cr_a uuid;
  cr_other uuid;
  version_a uuid;
  product_a uuid;
  product_b uuid;
  batch_a uuid;
  batch_b uuid;
  doc_a uuid;
  doc_ver_a uuid;
  quote_a uuid;
  raised boolean;
begin
  insert into public.clinics (name, slug) values ('Clinic A', 'clinic-a') returning id into clinic_a;
  insert into public.clinics (name, slug) values ('Clinic B', 'clinic-b') returning id into clinic_b;

  insert into public.patients (clinic_id, full_name)
  values (clinic_a, 'Patient A') returning id into patient_a;
  insert into public.patients (clinic_id, full_name)
  values (clinic_b, 'Patient B') returning id into patient_b;

  -- Happy path clinical chain
  insert into public.treatments (clinic_id, patient_id, name)
  values (clinic_a, patient_a, 'Toxina') returning id into treatment_a;

  insert into public.appointments (clinic_id, patient_id, title, starts_at, ends_at)
  values (clinic_a, patient_a, 'Sessão 1', now(), now() + interval '1 hour')
  returning id into appointment_a;

  insert into public.treatment_sessions (clinic_id, treatment_id, patient_id, appointment_id, session_number)
  values (clinic_a, treatment_a, patient_a, appointment_a, 1)
  returning id into session_a;

  insert into public.clinical_records (clinic_id, patient_id, treatment_id, treatment_session_id, status)
  values (clinic_a, patient_a, treatment_a, session_a, 'draft')
  returning id into cr_a;

  insert into public.clinical_record_versions (
    clinic_id, clinical_record_id, version_number, evolution
  ) values (clinic_a, cr_a, 1, 'Evolução inicial')
  returning id into version_a;

  update public.clinical_records
  set current_version_id = version_a
  where id = cr_a;

  insert into public.products (clinic_id, name, brand)
  values (clinic_a, 'Toxina A', 'Brand') returning id into product_a;
  insert into public.products (clinic_id, name, brand)
  values (clinic_b, 'Toxina B', 'Brand') returning id into product_b;

  insert into public.product_batches (clinic_id, product_id, batch_code)
  values (clinic_a, product_a, 'LOT-A') returning id into batch_a;
  insert into public.product_batches (clinic_id, product_id, batch_code)
  values (clinic_b, product_b, 'LOT-B') returning id into batch_b;

  insert into public.treatment_product_usages (
    clinic_id, patient_id, clinical_record_id, product_id, product_batch_id,
    product_name, quantity, unit
  ) values (
    clinic_a, patient_a, cr_a, product_a, batch_a, 'Toxina A', 1, 'ui'
  );

  insert into public.documents (clinic_id, patient_id, type, title)
  values (clinic_a, patient_a, 'consent', 'Termo A') returning id into doc_a;

  insert into public.document_versions (clinic_id, document_id, version_number, content)
  values (clinic_a, doc_a, 1, 'conteúdo') returning id into doc_ver_a;

  update public.documents set current_version_id = doc_ver_a where id = doc_a;

  insert into public.quotes (clinic_id, patient_id, title)
  values (clinic_a, patient_a, 'Orçamento A') returning id into quote_a;

  insert into public.crm_leads (clinic_id, full_name, patient_id)
  values (clinic_a, 'Lead A', patient_a) returning id into lead_a;

  insert into public.secure_links (
    clinic_id, patient_id, resource_type, resource_id, action, token_hash, expires_at
  ) values (
    clinic_a, patient_a, 'document', doc_a, 'view',
    repeat('a', 64), now() + interval '1 day'
  );

  -- Cross-clinic: crm_leads.patient_id
  raised := false;
  begin
    insert into public.crm_leads (clinic_id, full_name, patient_id)
    values (clinic_a, 'Bad Lead', patient_b);
  exception when others then
    raised := true;
  end;
  if not raised then
    raise exception 'EXPECTED FAIL: crm_leads cross-clinic patient';
  end if;

  -- Cross-clinic: appointments.patient_id
  raised := false;
  begin
    insert into public.appointments (clinic_id, patient_id, title, starts_at, ends_at)
    values (clinic_a, patient_b, 'Bad', now(), now() + interval '1 hour');
  exception when others then
    raised := true;
  end;
  if not raised then
    raise exception 'EXPECTED FAIL: appointments cross-clinic patient';
  end if;

  -- Cross-clinic: clinical_records.patient_id
  raised := false;
  begin
    insert into public.clinical_records (clinic_id, patient_id)
    values (clinic_a, patient_b);
  exception when others then
    raised := true;
  end;
  if not raised then
    raise exception 'EXPECTED FAIL: clinical_records cross-clinic patient';
  end if;

  -- Cross-clinic: clinical_records.treatment_id
  raised := false;
  begin
    insert into public.clinical_records (clinic_id, patient_id, treatment_id)
    values (clinic_b, patient_b, treatment_a);
  exception when others then
    raised := true;
  end;
  if not raised then
    raise exception 'EXPECTED FAIL: clinical_records cross-clinic treatment';
  end if;

  -- Cross-clinic: documents.patient_id
  raised := false;
  begin
    insert into public.documents (clinic_id, patient_id, type, title)
    values (clinic_a, patient_b, 'consent', 'Bad Doc');
  exception when others then
    raised := true;
  end;
  if not raised then
    raise exception 'EXPECTED FAIL: documents cross-clinic patient';
  end if;

  -- Cross-clinic: quotes.patient_id
  raised := false;
  begin
    insert into public.quotes (clinic_id, patient_id, title)
    values (clinic_a, patient_b, 'Bad Quote');
  exception when others then
    raised := true;
  end;
  if not raised then
    raise exception 'EXPECTED FAIL: quotes cross-clinic patient';
  end if;

  -- Cross-clinic: product_batches.product_id
  raised := false;
  begin
    insert into public.product_batches (clinic_id, product_id, batch_code)
    values (clinic_a, product_b, 'BAD-LOT');
  exception when others then
    raised := true;
  end;
  if not raised then
    raise exception 'EXPECTED FAIL: product_batches cross-clinic product';
  end if;

  -- Cross-clinic: treatment_product_usages.product_batch_id
  raised := false;
  begin
    insert into public.treatment_product_usages (
      clinic_id, patient_id, product_id, product_batch_id, product_name, quantity, unit
    ) values (
      clinic_a, patient_a, product_a, batch_b, 'Bad', 1, 'ui'
    );
  exception when others then
    raised := true;
  end;
  if not raised then
    raise exception 'EXPECTED FAIL: usages cross-clinic batch';
  end if;

  -- Cross-clinic: secure_links resource
  raised := false;
  begin
    insert into public.secure_links (
      clinic_id, patient_id, resource_type, resource_id, action, token_hash, expires_at
    ) values (
      clinic_b, patient_b, 'document', doc_a, 'view',
      repeat('b', 64), now() + interval '1 day'
    );
  exception when others then
    raised := true;
  end;
  if not raised then
    raise exception 'EXPECTED FAIL: secure_links cross-clinic resource';
  end if;

  -- current_version must belong to same record
  insert into public.clinical_records (clinic_id, patient_id)
  values (clinic_a, patient_a) returning id into cr_other;

  raised := false;
  begin
    update public.clinical_records
    set current_version_id = version_a
    where id = cr_other;
  exception when others then
    raised := true;
  end;
  if not raised then
    raise exception 'EXPECTED FAIL: current_version_id from another record';
  end if;

  -- Cannot delete used batch
  raised := false;
  begin
    delete from public.product_batches where id = batch_a;
  exception when others then
    raised := true;
  end;
  if not raised then
    raise exception 'EXPECTED FAIL: delete used product_batch';
  end if;

  raise notice 'A1 SQL validation PASSED';
end;
$$;
