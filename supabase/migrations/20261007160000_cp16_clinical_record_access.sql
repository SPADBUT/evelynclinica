-- CP16: clinical evolution access.
-- Additive. Does not change A1 tables or A2 policies.
-- clinical_records and clinical_record_versions already have RLS enabled
-- and no policies, so the client is denied until this migration.
--
-- Access is binary on purpose: active admin, manager, and professional.
-- Assistant and finance are excluded. There is no partial clinical matrix.
-- Inactive memberships fail public.has_clinic_role (is_active = true).

-- ---------------------------------------------------------------------------
-- Role gate
-- ---------------------------------------------------------------------------

create or replace function public.can_access_clinical_records(p_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_clinic_role(
    p_clinic_id,
    array['admin', 'manager', 'professional']::public.clinic_role[]
  );
$$;

comment on function public.can_access_clinical_records(uuid) is
  'True for an active admin, manager, or professional in p_clinic_id. Assistant and finance are excluded.';

-- ---------------------------------------------------------------------------
-- Version immutability and authorship
-- ---------------------------------------------------------------------------

create or replace function public.reject_clinical_record_version_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'clinical_record_versions are immutable';
end;
$$;

comment on function public.reject_clinical_record_version_update() is
  'Rejects every update of a clinical version. Corrections insert a new version.';

create or replace function public.prevent_clinical_record_identity_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.patient_id is distinct from old.patient_id
     or new.treatment_id is distinct from old.treatment_id
     or new.treatment_session_id is distinct from old.treatment_session_id
     or new.procedure_id is distinct from old.procedure_id
     or new.created_by is distinct from old.created_by then
    raise exception 'clinical record identity is immutable';
  end if;
  return new;
end;
$$;

comment on function public.prevent_clinical_record_identity_mutation() is
  'Patient, treatment, session, procedure, and author stay on the header. Status and current_version_id remain editable.';

create or replace function public.reject_clinical_record_author_spoof()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.created_by is distinct from public.current_user_id() then
    raise exception 'clinical record author must be the current user' using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on function public.reject_clinical_record_author_spoof() is
  'Header created_by must be the authenticated user. A null author is allowed only when auth.uid() is null.';

create or replace function public.stamp_clinical_version_author()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text;
begin
  if new.created_by is distinct from public.current_user_id() then
    raise exception 'clinical version author must be the current user' using errcode = '42501';
  end if;

  select p.full_name into v_name
  from public.profiles p
  where p.id = new.created_by;

  new.professional_name := nullif(trim(coalesce(v_name, '')), '');
  return new;
end;
$$;

comment on function public.stamp_clinical_version_author() is
  'Copies the author profile name onto the version at insert. Later profile renames do not rewrite history.';

create trigger clinical_record_versions_reject_update
  before update on public.clinical_record_versions
  for each row execute function public.reject_clinical_record_version_update();

create trigger clinical_records_prevent_identity_mutation
  before update of patient_id, treatment_id, treatment_session_id, procedure_id, created_by
  on public.clinical_records
  for each row execute function public.prevent_clinical_record_identity_mutation();

create trigger clinical_records_reject_author_spoof
  before insert on public.clinical_records
  for each row execute function public.reject_clinical_record_author_spoof();

create trigger clinical_record_versions_stamp_author
  before insert on public.clinical_record_versions
  for each row execute function public.stamp_clinical_version_author();

-- ---------------------------------------------------------------------------
-- Audit without clinical narrative
-- ---------------------------------------------------------------------------

create or replace function public.write_clinical_audit(
  p_clinic_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_metadata jsonb := '{}'::jsonb;
  v_number numeric;
begin
  if not public.can_access_clinical_records(p_clinic_id) then
    raise exception 'clinical audit denied' using errcode = '42501';
  end if;

  if p_action not in (
    'clinical_record.created',
    'clinical_record.versioned',
    'clinical_record.finalized',
    'clinical_record.cancelled'
  ) then
    raise exception 'clinical audit action not allowed' using errcode = '22023';
  end if;

  if p_entity_type is distinct from 'clinical_record' then
    raise exception 'clinical audit entity not allowed' using errcode = '22023';
  end if;

  if p_entity_id is null or not exists (
    select 1
    from public.clinical_records r
    where r.id = p_entity_id
      and r.clinic_id = p_clinic_id
  ) then
    raise exception 'clinical audit target missing' using errcode = '42501';
  end if;

  if p_metadata is not null and jsonb_typeof(p_metadata) = 'object' then
    begin
      if jsonb_typeof(p_metadata -> 'version_number') = 'number' then
        v_number := (p_metadata ->> 'version_number')::numeric;
        if v_number = trunc(v_number) and v_number between 1 and 100000 then
          v_metadata := v_metadata || jsonb_build_object('version_number', v_number::integer);
        end if;
      end if;
    exception
      when others then
        v_number := null;
    end;

    if (p_metadata ->> 'status') in ('draft', 'in_progress', 'finalized', 'corrected', 'cancelled') then
      v_metadata := v_metadata || jsonb_build_object('status', p_metadata ->> 'status');
    end if;
  end if;

  insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    p_clinic_id,
    public.current_user_id(),
    p_action,
    p_entity_type,
    p_entity_id,
    v_metadata
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.write_clinical_audit(uuid, text, text, uuid, jsonb) is
  'Append-only clinical audit. Metadata keeps version_number and status only. Narrative fields are dropped.';

-- ---------------------------------------------------------------------------
-- EXECUTE. Default privileges also grant anon and service_role.
-- ---------------------------------------------------------------------------

revoke all on function public.can_access_clinical_records(uuid) from public;
revoke all on function public.write_clinical_audit(uuid, text, text, uuid, jsonb) from public;
revoke all on function public.reject_clinical_record_version_update() from public;
revoke all on function public.prevent_clinical_record_identity_mutation() from public;
revoke all on function public.reject_clinical_record_author_spoof() from public;
revoke all on function public.stamp_clinical_version_author() from public;

revoke execute on function public.can_access_clinical_records(uuid) from public, anon, service_role;
revoke execute on function public.write_clinical_audit(uuid, text, text, uuid, jsonb) from public, anon, service_role;
grant execute on function public.can_access_clinical_records(uuid) to authenticated;
grant execute on function public.write_clinical_audit(uuid, text, text, uuid, jsonb) to authenticated;

revoke execute on function public.reject_clinical_record_version_update() from public, anon;
revoke execute on function public.prevent_clinical_record_identity_mutation() from public, anon;
revoke execute on function public.reject_clinical_record_author_spoof() from public, anon;
revoke execute on function public.stamp_clinical_version_author() from public, anon;
grant execute on function public.reject_clinical_record_version_update() to authenticated, service_role;
grant execute on function public.prevent_clinical_record_identity_mutation() to authenticated, service_role;
grant execute on function public.reject_clinical_record_author_spoof() to authenticated, service_role;
grant execute on function public.stamp_clinical_version_author() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Policies. No DELETE. Versions have no UPDATE.
-- ---------------------------------------------------------------------------

create policy clinical_records_select_clinical
  on public.clinical_records
  for select
  to authenticated
  using (public.can_access_clinical_records(clinic_id));

create policy clinical_records_insert_clinical
  on public.clinical_records
  for insert
  to authenticated
  with check (
    public.can_access_clinical_records(clinic_id)
    and created_by = public.current_user_id()
  );

create policy clinical_records_update_clinical
  on public.clinical_records
  for update
  to authenticated
  using (public.can_access_clinical_records(clinic_id))
  with check (public.can_access_clinical_records(clinic_id));

comment on policy clinical_records_update_clinical on public.clinical_records is
  'Status and current version pointer only. Identity columns are rejected by trigger. Physical delete has no policy.';

create policy clinical_record_versions_select_clinical
  on public.clinical_record_versions
  for select
  to authenticated
  using (public.can_access_clinical_records(clinic_id));

create policy clinical_record_versions_insert_clinical
  on public.clinical_record_versions
  for insert
  to authenticated
  with check (
    public.can_access_clinical_records(clinic_id)
    and created_by = public.current_user_id()
  );

comment on policy clinical_record_versions_insert_clinical on public.clinical_record_versions is
  'Insert-only history. Updates are rejected by trigger and by the absence of an update policy.';

create policy procedures_select_clinical
  on public.procedures
  for select
  to authenticated
  using (public.can_access_clinical_records(clinic_id));

comment on policy procedures_select_clinical on public.procedures is
  'Read-only procedure catalog for clinical evolution. No insert, update, or delete policy.';

create policy treatments_select_clinical
  on public.treatments
  for select
  to authenticated
  using (public.can_access_clinical_records(clinic_id));

comment on policy treatments_select_clinical on public.treatments is
  'Read-only treatment list for clinical evolution. No insert, update, or delete policy.';

create policy treatment_sessions_select_clinical
  on public.treatment_sessions
  for select
  to authenticated
  using (public.can_access_clinical_records(clinic_id));

comment on policy treatment_sessions_select_clinical on public.treatment_sessions is
  'Read-only session list for clinical evolution. No insert, update, or delete policy.';
