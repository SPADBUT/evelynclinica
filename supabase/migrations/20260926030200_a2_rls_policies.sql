-- A2: enable RLS + policies for all business tables.
-- Principle: authenticated → active clinic_membership → clinic_id → permission.
-- Client-supplied clinic_id is never trusted without has_clinic_permission().

-- ---------------------------------------------------------------------------
-- Identity / tenancy
-- ---------------------------------------------------------------------------

alter table public.clinics enable row level security;
alter table public.profiles enable row level security;
alter table public.clinic_memberships enable row level security;

create policy clinics_select on public.clinics
  for select to authenticated
  using (public.is_clinic_member(id));

create policy clinics_update on public.clinics
  for update to authenticated
  using (public.has_clinic_permission(id, 'clinics.write'))
  with check (public.has_clinic_permission(id, 'clinics.write'));

-- Clinic creation is bootstrap/service-role only in A2 (seed/tests as postgres).
create policy clinics_insert on public.clinics
  for insert to authenticated
  with check (false);

create policy clinics_delete on public.clinics
  for delete to authenticated
  using (false);

create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.clinic_memberships mine
      join public.clinic_memberships theirs
        on theirs.clinic_id = mine.clinic_id
      where mine.user_id = auth.uid()
        and mine.is_active = true
        and theirs.user_id = profiles.id
        and theirs.is_active = true
    )
  );

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Inserts come from handle_new_user() SECURITY DEFINER trigger.
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy profiles_delete on public.profiles
  for delete to authenticated
  using (false);

create policy clinic_memberships_select on public.clinic_memberships
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_clinic_member(clinic_id)
  );

create policy clinic_memberships_insert on public.clinic_memberships
  for insert to authenticated
  with check (public.has_clinic_permission(clinic_id, 'memberships.write'));

create policy clinic_memberships_update on public.clinic_memberships
  for update to authenticated
  using (public.has_clinic_permission(clinic_id, 'memberships.write'))
  with check (public.has_clinic_permission(clinic_id, 'memberships.write'));

create policy clinic_memberships_delete on public.clinic_memberships
  for delete to authenticated
  using (public.has_clinic_permission(clinic_id, 'memberships.write'));

-- ---------------------------------------------------------------------------
-- Helper macro pattern for clinic_id tables
-- ---------------------------------------------------------------------------

-- patients
alter table public.patients enable row level security;

create policy patients_select on public.patients
  for select to authenticated
  using (public.has_clinic_permission(clinic_id, 'patients.read'));

create policy patients_insert on public.patients
  for insert to authenticated
  with check (public.has_clinic_permission(clinic_id, 'patients.write'));

create policy patients_update on public.patients
  for update to authenticated
  using (public.has_clinic_permission(clinic_id, 'patients.write'))
  with check (public.has_clinic_permission(clinic_id, 'patients.write'));

create policy patients_delete on public.patients
  for delete to authenticated
  using (public.has_clinic_permission(clinic_id, 'patients.write'));

-- patient_tags
alter table public.patient_tags enable row level security;

create policy patient_tags_select on public.patient_tags
  for select to authenticated
  using (public.has_clinic_permission(clinic_id, 'patient_tags.read'));

create policy patient_tags_insert on public.patient_tags
  for insert to authenticated
  with check (public.has_clinic_permission(clinic_id, 'patient_tags.write'));

create policy patient_tags_update on public.patient_tags
  for update to authenticated
  using (public.has_clinic_permission(clinic_id, 'patient_tags.write'))
  with check (public.has_clinic_permission(clinic_id, 'patient_tags.write'));

create policy patient_tags_delete on public.patient_tags
  for delete to authenticated
  using (public.has_clinic_permission(clinic_id, 'patient_tags.write'));

-- crm_leads
alter table public.crm_leads enable row level security;

create policy crm_leads_select on public.crm_leads
  for select to authenticated
  using (public.has_clinic_permission(clinic_id, 'crm_leads.read'));

create policy crm_leads_insert on public.crm_leads
  for insert to authenticated
  with check (public.has_clinic_permission(clinic_id, 'crm_leads.write'));

create policy crm_leads_update on public.crm_leads
  for update to authenticated
  using (public.has_clinic_permission(clinic_id, 'crm_leads.write'))
  with check (public.has_clinic_permission(clinic_id, 'crm_leads.write'));

create policy crm_leads_delete on public.crm_leads
  for delete to authenticated
  using (public.has_clinic_permission(clinic_id, 'crm_leads.write'));

-- procedures
alter table public.procedures enable row level security;

create policy procedures_select on public.procedures
  for select to authenticated
  using (public.has_clinic_permission(clinic_id, 'procedures.read'));

create policy procedures_insert on public.procedures
  for insert to authenticated
  with check (public.has_clinic_permission(clinic_id, 'procedures.write'));

create policy procedures_update on public.procedures
  for update to authenticated
  using (public.has_clinic_permission(clinic_id, 'procedures.write'))
  with check (public.has_clinic_permission(clinic_id, 'procedures.write'));

create policy procedures_delete on public.procedures
  for delete to authenticated
  using (public.has_clinic_permission(clinic_id, 'procedures.write'));

-- procedure_templates
alter table public.procedure_templates enable row level security;

create policy procedure_templates_select on public.procedure_templates
  for select to authenticated
  using (public.has_clinic_permission(clinic_id, 'procedure_templates.read'));

create policy procedure_templates_insert on public.procedure_templates
  for insert to authenticated
  with check (public.has_clinic_permission(clinic_id, 'procedure_templates.write'));

create policy procedure_templates_update on public.procedure_templates
  for update to authenticated
  using (public.has_clinic_permission(clinic_id, 'procedure_templates.write'))
  with check (public.has_clinic_permission(clinic_id, 'procedure_templates.write'));

create policy procedure_templates_delete on public.procedure_templates
  for delete to authenticated
  using (public.has_clinic_permission(clinic_id, 'procedure_templates.write'));

-- treatments
alter table public.treatments enable row level security;

create policy treatments_select on public.treatments
  for select to authenticated
  using (public.has_clinic_permission(clinic_id, 'treatments.read'));

create policy treatments_insert on public.treatments
  for insert to authenticated
  with check (public.has_clinic_permission(clinic_id, 'treatments.write'));

create policy treatments_update on public.treatments
  for update to authenticated
  using (public.has_clinic_permission(clinic_id, 'treatments.write'))
  with check (public.has_clinic_permission(clinic_id, 'treatments.write'));

create policy treatments_delete on public.treatments
  for delete to authenticated
  using (public.has_clinic_permission(clinic_id, 'treatments.write'));

-- treatment_sessions
alter table public.treatment_sessions enable row level security;

create policy treatment_sessions_select on public.treatment_sessions
  for select to authenticated
  using (public.has_clinic_permission(clinic_id, 'treatment_sessions.read'));

create policy treatment_sessions_insert on public.treatment_sessions
  for insert to authenticated
  with check (public.has_clinic_permission(clinic_id, 'treatment_sessions.write'));

create policy treatment_sessions_update on public.treatment_sessions
  for update to authenticated
  using (public.has_clinic_permission(clinic_id, 'treatment_sessions.write'))
  with check (public.has_clinic_permission(clinic_id, 'treatment_sessions.write'));

create policy treatment_sessions_delete on public.treatment_sessions
  for delete to authenticated
  using (public.has_clinic_permission(clinic_id, 'treatment_sessions.write'));

-- appointments
alter table public.appointments enable row level security;

create policy appointments_select on public.appointments
  for select to authenticated
  using (public.has_clinic_permission(clinic_id, 'appointments.read'));

create policy appointments_insert on public.appointments
  for insert to authenticated
  with check (public.has_clinic_permission(clinic_id, 'appointments.write'));

create policy appointments_update on public.appointments
  for update to authenticated
  using (public.has_clinic_permission(clinic_id, 'appointments.write'))
  with check (public.has_clinic_permission(clinic_id, 'appointments.write'));

create policy appointments_delete on public.appointments
  for delete to authenticated
  using (public.has_clinic_permission(clinic_id, 'appointments.write'));

-- clinical_records
alter table public.clinical_records enable row level security;

create policy clinical_records_select on public.clinical_records
  for select to authenticated
  using (public.has_clinic_permission(clinic_id, 'clinical_records.read'));

create policy clinical_records_insert on public.clinical_records
  for insert to authenticated
  with check (public.has_clinic_permission(clinic_id, 'clinical_records.write'));

create policy clinical_records_update on public.clinical_records
  for update to authenticated
  using (public.has_clinic_permission(clinic_id, 'clinical_records.write'))
  with check (public.has_clinic_permission(clinic_id, 'clinical_records.write'));

create policy clinical_records_delete on public.clinical_records
  for delete to authenticated
  using (false);

-- clinical_record_versions (immutable append)
alter table public.clinical_record_versions enable row level security;

create policy clinical_record_versions_select on public.clinical_record_versions
  for select to authenticated
  using (public.has_clinic_permission(clinic_id, 'clinical_records.read'));

create policy clinical_record_versions_insert on public.clinical_record_versions
  for insert to authenticated
  with check (public.has_clinic_permission(clinic_id, 'clinical_records.write'));

create policy clinical_record_versions_update on public.clinical_record_versions
  for update to authenticated
  using (false)
  with check (false);

create policy clinical_record_versions_delete on public.clinical_record_versions
  for delete to authenticated
  using (false);

-- documents
alter table public.documents enable row level security;

create policy documents_select on public.documents
  for select to authenticated
  using (public.has_clinic_permission(clinic_id, 'documents.read'));

create policy documents_insert on public.documents
  for insert to authenticated
  with check (public.has_clinic_permission(clinic_id, 'documents.write'));

create policy documents_update on public.documents
  for update to authenticated
  using (public.has_clinic_permission(clinic_id, 'documents.write'))
  with check (public.has_clinic_permission(clinic_id, 'documents.write'));

create policy documents_delete on public.documents
  for delete to authenticated
  using (false);

-- document_versions (immutable append)
alter table public.document_versions enable row level security;

create policy document_versions_select on public.document_versions
  for select to authenticated
  using (public.has_clinic_permission(clinic_id, 'documents.read'));

create policy document_versions_insert on public.document_versions
  for insert to authenticated
  with check (public.has_clinic_permission(clinic_id, 'documents.write'));

create policy document_versions_update on public.document_versions
  for update to authenticated
  using (false)
  with check (false);

create policy document_versions_delete on public.document_versions
  for delete to authenticated
  using (false);

-- document_signatures (append)
alter table public.document_signatures enable row level security;

create policy document_signatures_select on public.document_signatures
  for select to authenticated
  using (public.has_clinic_permission(clinic_id, 'documents.read'));

create policy document_signatures_insert on public.document_signatures
  for insert to authenticated
  with check (public.has_clinic_permission(clinic_id, 'documents.write'));

create policy document_signatures_update on public.document_signatures
  for update to authenticated
  using (false)
  with check (false);

create policy document_signatures_delete on public.document_signatures
  for delete to authenticated
  using (false);

-- quotes
alter table public.quotes enable row level security;

create policy quotes_select on public.quotes
  for select to authenticated
  using (public.has_clinic_permission(clinic_id, 'quotes.read'));

create policy quotes_insert on public.quotes
  for insert to authenticated
  with check (public.has_clinic_permission(clinic_id, 'quotes.write'));

create policy quotes_update on public.quotes
  for update to authenticated
  using (public.has_clinic_permission(clinic_id, 'quotes.write'))
  with check (public.has_clinic_permission(clinic_id, 'quotes.write'));

create policy quotes_delete on public.quotes
  for delete to authenticated
  using (public.has_clinic_permission(clinic_id, 'quotes.write'));

-- quote_items
alter table public.quote_items enable row level security;

create policy quote_items_select on public.quote_items
  for select to authenticated
  using (public.has_clinic_permission(clinic_id, 'quotes.read'));

create policy quote_items_insert on public.quote_items
  for insert to authenticated
  with check (public.has_clinic_permission(clinic_id, 'quotes.write'));

create policy quote_items_update on public.quote_items
  for update to authenticated
  using (public.has_clinic_permission(clinic_id, 'quotes.write'))
  with check (public.has_clinic_permission(clinic_id, 'quotes.write'));

create policy quote_items_delete on public.quote_items
  for delete to authenticated
  using (public.has_clinic_permission(clinic_id, 'quotes.write'));

-- products
alter table public.products enable row level security;

create policy products_select on public.products
  for select to authenticated
  using (public.has_clinic_permission(clinic_id, 'products.read'));

create policy products_insert on public.products
  for insert to authenticated
  with check (public.has_clinic_permission(clinic_id, 'products.write'));

create policy products_update on public.products
  for update to authenticated
  using (public.has_clinic_permission(clinic_id, 'products.write'))
  with check (public.has_clinic_permission(clinic_id, 'products.write'));

create policy products_delete on public.products
  for delete to authenticated
  using (public.has_clinic_permission(clinic_id, 'products.write'));

-- product_batches
alter table public.product_batches enable row level security;

create policy product_batches_select on public.product_batches
  for select to authenticated
  using (public.has_clinic_permission(clinic_id, 'product_batches.read'));

create policy product_batches_insert on public.product_batches
  for insert to authenticated
  with check (public.has_clinic_permission(clinic_id, 'product_batches.write'));

create policy product_batches_update on public.product_batches
  for update to authenticated
  using (public.has_clinic_permission(clinic_id, 'product_batches.write'))
  with check (public.has_clinic_permission(clinic_id, 'product_batches.write'));

create policy product_batches_delete on public.product_batches
  for delete to authenticated
  using (public.has_clinic_permission(clinic_id, 'product_batches.write'));

-- treatment_product_usages (append)
alter table public.treatment_product_usages enable row level security;

create policy treatment_product_usages_select on public.treatment_product_usages
  for select to authenticated
  using (public.has_clinic_permission(clinic_id, 'treatment_product_usages.read'));

create policy treatment_product_usages_insert on public.treatment_product_usages
  for insert to authenticated
  with check (public.has_clinic_permission(clinic_id, 'treatment_product_usages.write'));

create policy treatment_product_usages_update on public.treatment_product_usages
  for update to authenticated
  using (false)
  with check (false);

create policy treatment_product_usages_delete on public.treatment_product_usages
  for delete to authenticated
  using (false);

-- photos
alter table public.photos enable row level security;

create policy photos_select on public.photos
  for select to authenticated
  using (public.has_clinic_permission(clinic_id, 'photos.read'));

create policy photos_insert on public.photos
  for insert to authenticated
  with check (public.has_clinic_permission(clinic_id, 'photos.write'));

create policy photos_update on public.photos
  for update to authenticated
  using (public.has_clinic_permission(clinic_id, 'photos.write'))
  with check (public.has_clinic_permission(clinic_id, 'photos.write'));

create policy photos_delete on public.photos
  for delete to authenticated
  using (public.has_clinic_permission(clinic_id, 'photos.write'));

-- interactions
alter table public.interactions enable row level security;

create policy interactions_select on public.interactions
  for select to authenticated
  using (public.has_clinic_permission(clinic_id, 'interactions.read'));

create policy interactions_insert on public.interactions
  for insert to authenticated
  with check (public.has_clinic_permission(clinic_id, 'interactions.write'));

create policy interactions_update on public.interactions
  for update to authenticated
  using (public.has_clinic_permission(clinic_id, 'interactions.write'))
  with check (public.has_clinic_permission(clinic_id, 'interactions.write'));

create policy interactions_delete on public.interactions
  for delete to authenticated
  using (public.has_clinic_permission(clinic_id, 'interactions.write'));

-- alerts
alter table public.alerts enable row level security;

create policy alerts_select on public.alerts
  for select to authenticated
  using (public.has_clinic_permission(clinic_id, 'alerts.read'));

create policy alerts_insert on public.alerts
  for insert to authenticated
  with check (public.has_clinic_permission(clinic_id, 'alerts.write'));

create policy alerts_update on public.alerts
  for update to authenticated
  using (public.has_clinic_permission(clinic_id, 'alerts.write'))
  with check (public.has_clinic_permission(clinic_id, 'alerts.write'));

create policy alerts_delete on public.alerts
  for delete to authenticated
  using (public.has_clinic_permission(clinic_id, 'alerts.write'));

-- tasks
alter table public.tasks enable row level security;

create policy tasks_select on public.tasks
  for select to authenticated
  using (public.has_clinic_permission(clinic_id, 'tasks.read'));

create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (public.has_clinic_permission(clinic_id, 'tasks.write'));

create policy tasks_update on public.tasks
  for update to authenticated
  using (public.has_clinic_permission(clinic_id, 'tasks.write'))
  with check (public.has_clinic_permission(clinic_id, 'tasks.write'));

create policy tasks_delete on public.tasks
  for delete to authenticated
  using (public.has_clinic_permission(clinic_id, 'tasks.write'));

-- secure_links (staff only; patient token runtime = A5 / Edge Functions)
alter table public.secure_links enable row level security;

create policy secure_links_select on public.secure_links
  for select to authenticated
  using (public.has_clinic_permission(clinic_id, 'secure_links.read'));

create policy secure_links_insert on public.secure_links
  for insert to authenticated
  with check (public.has_clinic_permission(clinic_id, 'secure_links.write'));

create policy secure_links_update on public.secure_links
  for update to authenticated
  using (public.has_clinic_permission(clinic_id, 'secure_links.write'))
  with check (public.has_clinic_permission(clinic_id, 'secure_links.write'));

create policy secure_links_delete on public.secure_links
  for delete to authenticated
  using (public.has_clinic_permission(clinic_id, 'secure_links.write'));

-- audit_logs: extremely restricted
alter table public.audit_logs enable row level security;

create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (
    clinic_id is not null
    and public.has_clinic_permission(clinic_id, 'audit_logs.read')
  );

-- Inserts for future instrumentation; only into clinics the actor belongs to.
create policy audit_logs_insert on public.audit_logs
  for insert to authenticated
  with check (
    clinic_id is not null
    and public.is_clinic_member(clinic_id)
    and (actor_user_id is null or actor_user_id = auth.uid())
  );

create policy audit_logs_update on public.audit_logs
  for update to authenticated
  using (false)
  with check (false);

create policy audit_logs_delete on public.audit_logs
  for delete to authenticated
  using (false);
