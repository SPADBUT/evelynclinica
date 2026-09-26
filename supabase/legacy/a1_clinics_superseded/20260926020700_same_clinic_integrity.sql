-- A1 QA: same-clinic structural integrity (no RLS yet — A2)
-- Prevents obvious cross-clinic FK associations that plain FKs alone cannot block.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.raise_cross_clinic(p_context text)
returns void
language plpgsql
as $$
begin
  raise exception 'cross-clinic relationship rejected: %', p_context;
end;
$$;

comment on function public.raise_cross_clinic(text) is
  'Shared error for same-clinic integrity triggers (A1). RLS remains A2.';

create or replace function public.assert_same_clinic(
  p_expected uuid,
  p_actual uuid,
  p_context text
)
returns void
language plpgsql
as $$
begin
  if p_actual is null then
    raise exception '%: referenced row not found', p_context;
  end if;
  if p_actual <> p_expected then
    perform public.raise_cross_clinic(p_context);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- patient_tags
-- ---------------------------------------------------------------------------

create or replace function public.enforce_patient_tags_clinic()
returns trigger
language plpgsql
as $$
declare
  ref_clinic uuid;
begin
  select clinic_id into ref_clinic from public.patients where id = new.patient_id;
  perform public.assert_same_clinic(new.clinic_id, ref_clinic, 'patient_tags.patient_id');
  return new;
end;
$$;

create trigger patient_tags_enforce_clinic
  before insert or update of clinic_id, patient_id on public.patient_tags
  for each row execute function public.enforce_patient_tags_clinic();

-- ---------------------------------------------------------------------------
-- procedure_templates
-- ---------------------------------------------------------------------------

create or replace function public.enforce_procedure_templates_clinic()
returns trigger
language plpgsql
as $$
declare
  ref_clinic uuid;
begin
  if new.procedure_id is not null then
    select clinic_id into ref_clinic from public.procedures where id = new.procedure_id;
    perform public.assert_same_clinic(new.clinic_id, ref_clinic, 'procedure_templates.procedure_id');
  end if;
  return new;
end;
$$;

create trigger procedure_templates_enforce_clinic
  before insert or update of clinic_id, procedure_id on public.procedure_templates
  for each row execute function public.enforce_procedure_templates_clinic();

-- ---------------------------------------------------------------------------
-- treatments
-- ---------------------------------------------------------------------------

create or replace function public.enforce_treatments_clinic()
returns trigger
language plpgsql
as $$
declare
  ref_clinic uuid;
begin
  select clinic_id into ref_clinic from public.patients where id = new.patient_id;
  perform public.assert_same_clinic(new.clinic_id, ref_clinic, 'treatments.patient_id');
  return new;
end;
$$;

create trigger treatments_enforce_clinic
  before insert or update of clinic_id, patient_id on public.treatments
  for each row execute function public.enforce_treatments_clinic();

-- ---------------------------------------------------------------------------
-- treatment_sessions
-- ---------------------------------------------------------------------------

create or replace function public.enforce_treatment_sessions_clinic()
returns trigger
language plpgsql
as $$
declare
  treatment_clinic uuid;
  treatment_patient uuid;
  patient_clinic uuid;
  appointment_clinic uuid;
  appointment_patient uuid;
begin
  select clinic_id, patient_id into treatment_clinic, treatment_patient
  from public.treatments where id = new.treatment_id;
  perform public.assert_same_clinic(new.clinic_id, treatment_clinic, 'treatment_sessions.treatment_id');

  if treatment_patient <> new.patient_id then
    raise exception 'treatment_sessions.patient_id must match treatments.patient_id';
  end if;

  select clinic_id into patient_clinic from public.patients where id = new.patient_id;
  perform public.assert_same_clinic(new.clinic_id, patient_clinic, 'treatment_sessions.patient_id');

  if new.appointment_id is not null then
    select clinic_id, patient_id into appointment_clinic, appointment_patient
    from public.appointments where id = new.appointment_id;
    perform public.assert_same_clinic(
      new.clinic_id, appointment_clinic, 'treatment_sessions.appointment_id'
    );
    if appointment_patient <> new.patient_id then
      raise exception 'treatment_sessions.appointment_id must belong to the same patient';
    end if;
  end if;

  return new;
end;
$$;

create trigger treatment_sessions_enforce_clinic
  before insert or update of clinic_id, treatment_id, patient_id, appointment_id
  on public.treatment_sessions
  for each row execute function public.enforce_treatment_sessions_clinic();

-- ---------------------------------------------------------------------------
-- appointments
-- ---------------------------------------------------------------------------

create or replace function public.enforce_appointments_clinic()
returns trigger
language plpgsql
as $$
declare
  ref_clinic uuid;
begin
  select clinic_id into ref_clinic from public.patients where id = new.patient_id;
  perform public.assert_same_clinic(new.clinic_id, ref_clinic, 'appointments.patient_id');

  if new.procedure_id is not null then
    select clinic_id into ref_clinic from public.procedures where id = new.procedure_id;
    perform public.assert_same_clinic(new.clinic_id, ref_clinic, 'appointments.procedure_id');
  end if;

  return new;
end;
$$;

create trigger appointments_enforce_clinic
  before insert or update of clinic_id, patient_id, procedure_id on public.appointments
  for each row execute function public.enforce_appointments_clinic();

-- ---------------------------------------------------------------------------
-- clinical_records (+ current_version ownership)
-- ---------------------------------------------------------------------------

create or replace function public.enforce_clinical_records_clinic()
returns trigger
language plpgsql
as $$
declare
  ref_clinic uuid;
  ref_patient uuid;
  version_record_id uuid;
begin
  select clinic_id into ref_clinic from public.patients where id = new.patient_id;
  perform public.assert_same_clinic(new.clinic_id, ref_clinic, 'clinical_records.patient_id');

  if new.treatment_id is not null then
    select clinic_id, patient_id into ref_clinic, ref_patient
    from public.treatments where id = new.treatment_id;
    perform public.assert_same_clinic(new.clinic_id, ref_clinic, 'clinical_records.treatment_id');
    if ref_patient <> new.patient_id then
      raise exception 'clinical_records.treatment_id must belong to the same patient';
    end if;
  end if;

  if new.treatment_session_id is not null then
    select clinic_id, patient_id into ref_clinic, ref_patient
    from public.treatment_sessions where id = new.treatment_session_id;
    perform public.assert_same_clinic(
      new.clinic_id, ref_clinic, 'clinical_records.treatment_session_id'
    );
    if ref_patient <> new.patient_id then
      raise exception 'clinical_records.treatment_session_id must belong to the same patient';
    end if;
  end if;

  if new.procedure_id is not null then
    select clinic_id into ref_clinic from public.procedures where id = new.procedure_id;
    perform public.assert_same_clinic(new.clinic_id, ref_clinic, 'clinical_records.procedure_id');
  end if;

  -- current_version_id is nullable so insert order is: record → version → update pointer.
  -- FK alone does not guarantee the version belongs to THIS record.
  if new.current_version_id is not null then
    select clinic_id, clinical_record_id into ref_clinic, version_record_id
    from public.clinical_record_versions where id = new.current_version_id;
    perform public.assert_same_clinic(
      new.clinic_id, ref_clinic, 'clinical_records.current_version_id'
    );
    if version_record_id <> new.id then
      raise exception
        'clinical_records.current_version_id must reference a version of the same record';
    end if;
  end if;

  return new;
end;
$$;

create trigger clinical_records_enforce_clinic
  before insert or update of
    clinic_id, patient_id, treatment_id, treatment_session_id, procedure_id, current_version_id
  on public.clinical_records
  for each row execute function public.enforce_clinical_records_clinic();

create or replace function public.enforce_clinical_record_versions_clinic()
returns trigger
language plpgsql
as $$
declare
  ref_clinic uuid;
begin
  select clinic_id into ref_clinic
  from public.clinical_records where id = new.clinical_record_id;
  perform public.assert_same_clinic(
    new.clinic_id, ref_clinic, 'clinical_record_versions.clinical_record_id'
  );
  return new;
end;
$$;

create trigger clinical_record_versions_enforce_clinic
  before insert or update of clinic_id, clinical_record_id on public.clinical_record_versions
  for each row execute function public.enforce_clinical_record_versions_clinic();

-- ---------------------------------------------------------------------------
-- documents / versions / signatures
-- ---------------------------------------------------------------------------

create or replace function public.enforce_documents_clinic()
returns trigger
language plpgsql
as $$
declare
  ref_clinic uuid;
  version_document_id uuid;
begin
  select clinic_id into ref_clinic from public.patients where id = new.patient_id;
  perform public.assert_same_clinic(new.clinic_id, ref_clinic, 'documents.patient_id');

  if new.quote_id is not null then
    select clinic_id into ref_clinic from public.quotes where id = new.quote_id;
    perform public.assert_same_clinic(new.clinic_id, ref_clinic, 'documents.quote_id');
  end if;

  if new.current_version_id is not null then
    select clinic_id, document_id into ref_clinic, version_document_id
    from public.document_versions where id = new.current_version_id;
    perform public.assert_same_clinic(
      new.clinic_id, ref_clinic, 'documents.current_version_id'
    );
    if version_document_id <> new.id then
      raise exception
        'documents.current_version_id must reference a version of the same document';
    end if;
  end if;

  return new;
end;
$$;

create trigger documents_enforce_clinic
  before insert or update of clinic_id, patient_id, quote_id, current_version_id
  on public.documents
  for each row execute function public.enforce_documents_clinic();

create or replace function public.enforce_document_versions_clinic()
returns trigger
language plpgsql
as $$
declare
  ref_clinic uuid;
begin
  select clinic_id into ref_clinic from public.documents where id = new.document_id;
  perform public.assert_same_clinic(
    new.clinic_id, ref_clinic, 'document_versions.document_id'
  );
  return new;
end;
$$;

create trigger document_versions_enforce_clinic
  before insert or update of clinic_id, document_id on public.document_versions
  for each row execute function public.enforce_document_versions_clinic();

create or replace function public.enforce_document_signatures_clinic()
returns trigger
language plpgsql
as $$
declare
  doc_clinic uuid;
  version_clinic uuid;
  version_document_id uuid;
  link_clinic uuid;
begin
  select clinic_id into doc_clinic from public.documents where id = new.document_id;
  perform public.assert_same_clinic(
    new.clinic_id, doc_clinic, 'document_signatures.document_id'
  );

  select clinic_id, document_id into version_clinic, version_document_id
  from public.document_versions where id = new.document_version_id;
  perform public.assert_same_clinic(
    new.clinic_id, version_clinic, 'document_signatures.document_version_id'
  );
  if version_document_id <> new.document_id then
    raise exception
      'document_signatures.document_version_id must belong to document_id';
  end if;

  if new.secure_link_id is not null then
    select clinic_id into link_clinic from public.secure_links where id = new.secure_link_id;
    perform public.assert_same_clinic(
      new.clinic_id, link_clinic, 'document_signatures.secure_link_id'
    );
  end if;

  return new;
end;
$$;

create trigger document_signatures_enforce_clinic
  before insert or update of clinic_id, document_id, document_version_id, secure_link_id
  on public.document_signatures
  for each row execute function public.enforce_document_signatures_clinic();

-- ---------------------------------------------------------------------------
-- quotes / quote_items
-- ---------------------------------------------------------------------------

create or replace function public.enforce_quotes_clinic()
returns trigger
language plpgsql
as $$
declare
  ref_clinic uuid;
begin
  if new.patient_id is not null then
    select clinic_id into ref_clinic from public.patients where id = new.patient_id;
    perform public.assert_same_clinic(new.clinic_id, ref_clinic, 'quotes.patient_id');
  end if;

  if new.lead_id is not null then
    select clinic_id into ref_clinic from public.crm_leads where id = new.lead_id;
    perform public.assert_same_clinic(new.clinic_id, ref_clinic, 'quotes.lead_id');
  end if;

  return new;
end;
$$;

create trigger quotes_enforce_clinic
  before insert or update of clinic_id, patient_id, lead_id on public.quotes
  for each row execute function public.enforce_quotes_clinic();

create or replace function public.enforce_quote_items_clinic()
returns trigger
language plpgsql
as $$
declare
  ref_clinic uuid;
begin
  select clinic_id into ref_clinic from public.quotes where id = new.quote_id;
  perform public.assert_same_clinic(new.clinic_id, ref_clinic, 'quote_items.quote_id');
  return new;
end;
$$;

create trigger quote_items_enforce_clinic
  before insert or update of clinic_id, quote_id on public.quote_items
  for each row execute function public.enforce_quote_items_clinic();

-- ---------------------------------------------------------------------------
-- products / batches / usages
-- ---------------------------------------------------------------------------

create or replace function public.enforce_product_batches_clinic()
returns trigger
language plpgsql
as $$
declare
  product_clinic uuid;
begin
  select clinic_id into product_clinic from public.products where id = new.product_id;
  perform public.assert_same_clinic(
    new.clinic_id, product_clinic, 'product_batches.product_id'
  );
  return new;
end;
$$;

create trigger product_batches_enforce_clinic
  before insert or update of clinic_id, product_id on public.product_batches
  for each row execute function public.enforce_product_batches_clinic();

create or replace function public.enforce_treatment_product_usages_clinic()
returns trigger
language plpgsql
as $$
declare
  ref_clinic uuid;
  batch_product_id uuid;
begin
  select clinic_id into ref_clinic from public.patients where id = new.patient_id;
  perform public.assert_same_clinic(
    new.clinic_id, ref_clinic, 'treatment_product_usages.patient_id'
  );

  if new.clinical_record_id is not null then
    select clinic_id into ref_clinic
    from public.clinical_records where id = new.clinical_record_id;
    perform public.assert_same_clinic(
      new.clinic_id, ref_clinic, 'treatment_product_usages.clinical_record_id'
    );
  end if;

  if new.treatment_session_id is not null then
    select clinic_id into ref_clinic
    from public.treatment_sessions where id = new.treatment_session_id;
    perform public.assert_same_clinic(
      new.clinic_id, ref_clinic, 'treatment_product_usages.treatment_session_id'
    );
  end if;

  if new.procedure_id is not null then
    select clinic_id into ref_clinic from public.procedures where id = new.procedure_id;
    perform public.assert_same_clinic(
      new.clinic_id, ref_clinic, 'treatment_product_usages.procedure_id'
    );
  end if;

  if new.product_id is not null then
    select clinic_id into ref_clinic from public.products where id = new.product_id;
    perform public.assert_same_clinic(
      new.clinic_id, ref_clinic, 'treatment_product_usages.product_id'
    );
  end if;

  if new.product_batch_id is not null then
    select clinic_id, product_id into ref_clinic, batch_product_id
    from public.product_batches where id = new.product_batch_id;
    perform public.assert_same_clinic(
      new.clinic_id, ref_clinic, 'treatment_product_usages.product_batch_id'
    );
    if new.product_id is not null and batch_product_id <> new.product_id then
      raise exception
        'treatment_product_usages.product_id must match product_batches.product_id';
    end if;
  end if;

  return new;
end;
$$;

create trigger treatment_product_usages_enforce_clinic
  before insert or update of
    clinic_id, patient_id, clinical_record_id, treatment_session_id,
    procedure_id, product_id, product_batch_id
  on public.treatment_product_usages
  for each row execute function public.enforce_treatment_product_usages_clinic();

-- ---------------------------------------------------------------------------
-- photos / interactions / alerts / tasks
-- ---------------------------------------------------------------------------

create or replace function public.enforce_photos_clinic()
returns trigger
language plpgsql
as $$
declare
  ref_clinic uuid;
  ref_patient uuid;
begin
  select clinic_id into ref_clinic from public.patients where id = new.patient_id;
  perform public.assert_same_clinic(new.clinic_id, ref_clinic, 'photos.patient_id');

  if new.appointment_id is not null then
    select clinic_id, patient_id into ref_clinic, ref_patient
    from public.appointments where id = new.appointment_id;
    perform public.assert_same_clinic(new.clinic_id, ref_clinic, 'photos.appointment_id');
    if ref_patient <> new.patient_id then
      raise exception 'photos.appointment_id must belong to the same patient';
    end if;
  end if;

  if new.treatment_session_id is not null then
    select clinic_id, patient_id into ref_clinic, ref_patient
    from public.treatment_sessions where id = new.treatment_session_id;
    perform public.assert_same_clinic(
      new.clinic_id, ref_clinic, 'photos.treatment_session_id'
    );
    if ref_patient <> new.patient_id then
      raise exception 'photos.treatment_session_id must belong to the same patient';
    end if;
  end if;

  if new.procedure_id is not null then
    select clinic_id into ref_clinic from public.procedures where id = new.procedure_id;
    perform public.assert_same_clinic(new.clinic_id, ref_clinic, 'photos.procedure_id');
  end if;

  return new;
end;
$$;

create trigger photos_enforce_clinic
  before insert or update of
    clinic_id, patient_id, appointment_id, treatment_session_id, procedure_id
  on public.photos
  for each row execute function public.enforce_photos_clinic();

create or replace function public.enforce_interactions_clinic()
returns trigger
language plpgsql
as $$
declare
  ref_clinic uuid;
begin
  if new.patient_id is not null then
    select clinic_id into ref_clinic from public.patients where id = new.patient_id;
    perform public.assert_same_clinic(new.clinic_id, ref_clinic, 'interactions.patient_id');
  end if;

  if new.lead_id is not null then
    select clinic_id into ref_clinic from public.crm_leads where id = new.lead_id;
    perform public.assert_same_clinic(new.clinic_id, ref_clinic, 'interactions.lead_id');
  end if;

  return new;
end;
$$;

create trigger interactions_enforce_clinic
  before insert or update of clinic_id, patient_id, lead_id on public.interactions
  for each row execute function public.enforce_interactions_clinic();

create or replace function public.enforce_alerts_clinic()
returns trigger
language plpgsql
as $$
declare
  ref_clinic uuid;
begin
  if new.patient_id is not null then
    select clinic_id into ref_clinic from public.patients where id = new.patient_id;
    perform public.assert_same_clinic(new.clinic_id, ref_clinic, 'alerts.patient_id');
  end if;
  return new;
end;
$$;

create trigger alerts_enforce_clinic
  before insert or update of clinic_id, patient_id on public.alerts
  for each row execute function public.enforce_alerts_clinic();

create or replace function public.enforce_tasks_clinic()
returns trigger
language plpgsql
as $$
declare
  ref_clinic uuid;
begin
  if new.patient_id is not null then
    select clinic_id into ref_clinic from public.patients where id = new.patient_id;
    perform public.assert_same_clinic(new.clinic_id, ref_clinic, 'tasks.patient_id');
  end if;
  return new;
end;
$$;

create trigger tasks_enforce_clinic
  before insert or update of clinic_id, patient_id on public.tasks
  for each row execute function public.enforce_tasks_clinic();

-- ---------------------------------------------------------------------------
-- secure_links: patient + polymorphic resource same clinic
-- ---------------------------------------------------------------------------

create or replace function public.enforce_secure_links_clinic()
returns trigger
language plpgsql
as $$
declare
  patient_clinic uuid;
  resource_clinic uuid;
  resource_patient uuid;
begin
  select clinic_id into patient_clinic from public.patients where id = new.patient_id;
  perform public.assert_same_clinic(new.clinic_id, patient_clinic, 'secure_links.patient_id');

  case new.resource_type
    when 'term', 'anamnesis', 'document' then
      select clinic_id, patient_id into resource_clinic, resource_patient
      from public.documents where id = new.resource_id;
      perform public.assert_same_clinic(
        new.clinic_id, resource_clinic, 'secure_links.resource_id(document)'
      );
      if resource_patient <> new.patient_id then
        raise exception 'secure_links.resource_id document must belong to patient_id';
      end if;
    when 'quote' then
      select clinic_id, patient_id into resource_clinic, resource_patient
      from public.quotes where id = new.resource_id;
      perform public.assert_same_clinic(
        new.clinic_id, resource_clinic, 'secure_links.resource_id(quote)'
      );
      if resource_patient is not null and resource_patient <> new.patient_id then
        raise exception 'secure_links.resource_id quote must belong to patient_id';
      end if;
    when 'appointment' then
      select clinic_id, patient_id into resource_clinic, resource_patient
      from public.appointments where id = new.resource_id;
      perform public.assert_same_clinic(
        new.clinic_id, resource_clinic, 'secure_links.resource_id(appointment)'
      );
      if resource_patient <> new.patient_id then
        raise exception 'secure_links.resource_id appointment must belong to patient_id';
      end if;
    else
      raise exception 'secure_links.resource_type % is not supported', new.resource_type;
  end case;

  return new;
end;
$$;

create trigger secure_links_enforce_clinic
  before insert or update of clinic_id, patient_id, resource_type, resource_id
  on public.secure_links
  for each row execute function public.enforce_secure_links_clinic();

comment on function public.enforce_secure_links_clinic() is
  'Ensures secure_links patient and polymorphic resource share clinic_id (A1 structural guard; RLS = A2).';
