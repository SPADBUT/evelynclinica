-- CP16.1: transactional clinical evolution writes.
-- Additive. Does not edit earlier migrations or the clinical table shape.
-- create, append, and transition each run in the caller's PostgreSQL transaction.
-- An error aborts the whole transaction: header, version, pointer, and audit.
--
-- Authenticated clients lose direct INSERT/UPDATE on clinical_records and
-- clinical_record_versions. SELECT policies stay. write_clinical_audit is no
-- longer executable by authenticated; the three functions call it as owner.

-- ---------------------------------------------------------------------------
-- create_clinical_evolution
-- ---------------------------------------------------------------------------

create or replace function public.create_clinical_evolution(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_treatment_id uuid,
  p_treatment_session_id uuid,
  p_procedure_id uuid,
  p_procedure_name text,
  p_recorded_at timestamptz,
  p_anamnesis text,
  p_evolution text,
  p_products_used_summary text,
  p_next_steps text,
  p_change_reason text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_patient_clinic uuid;
  v_patient_deleted timestamptz;
  v_treatment_id uuid;
  v_session_clinic uuid;
  v_session_patient uuid;
  v_session_treatment uuid;
  v_treatment_clinic uuid;
  v_treatment_patient uuid;
  v_procedure_clinic uuid;
  v_procedure_name text;
  v_procedure_active boolean;
  v_name text;
  v_record_id uuid;
  v_version_id uuid;
  v_updated bigint;
begin
  v_user := public.current_user_id();
  if v_user is null then
    raise exception 'clinical evolution unauthenticated' using errcode = '42501';
  end if;

  if p_patient_id is null then
    raise exception 'clinical evolution patient missing' using errcode = 'P0002';
  end if;

  select p.clinic_id, p.deleted_at
    into v_patient_clinic, v_patient_deleted
  from public.patients p
  where p.id = p_patient_id
  for share;

  if v_patient_clinic is null
     or v_patient_deleted is not null
     or v_patient_clinic is distinct from p_clinic_id then
    raise exception 'clinical evolution patient missing' using errcode = 'P0002';
  end if;

  if not public.can_access_clinical_records(v_patient_clinic) then
    raise exception 'clinical evolution denied' using errcode = '42501';
  end if;

  v_treatment_id := p_treatment_id;
  v_name := nullif(trim(coalesce(p_procedure_name, '')), '');

  if p_treatment_session_id is not null then
    select s.clinic_id, s.patient_id, s.treatment_id
      into v_session_clinic, v_session_patient, v_session_treatment
    from public.treatment_sessions s
    where s.id = p_treatment_session_id
    for share;

    if v_session_clinic is null
       or v_session_clinic is distinct from v_patient_clinic
       or v_session_patient is distinct from p_patient_id
       or v_session_treatment is null then
      raise exception 'clinical evolution invalid input' using errcode = '22023';
    end if;

    if p_treatment_id is not null and p_treatment_id is distinct from v_session_treatment then
      raise exception 'clinical evolution invalid input' using errcode = '22023';
    end if;

    v_treatment_id := v_session_treatment;
  elsif p_treatment_id is not null then
    select t.clinic_id, t.patient_id
      into v_treatment_clinic, v_treatment_patient
    from public.treatments t
    where t.id = p_treatment_id
    for share;

    if v_treatment_clinic is null
       or v_treatment_clinic is distinct from v_patient_clinic
       or v_treatment_patient is distinct from p_patient_id then
      raise exception 'clinical evolution invalid input' using errcode = '22023';
    end if;
  end if;

  if p_procedure_id is not null then
    select pr.clinic_id, pr.name, pr.is_active
      into v_procedure_clinic, v_procedure_name, v_procedure_active
    from public.procedures pr
    where pr.id = p_procedure_id
    for share;

    if v_procedure_clinic is null
       or v_procedure_clinic is distinct from v_patient_clinic
       or v_procedure_active is distinct from true then
      raise exception 'clinical evolution invalid input' using errcode = '22023';
    end if;

    if v_name is null then
      v_name := nullif(trim(coalesce(v_procedure_name, '')), '');
    end if;
  end if;

  if v_name is null then
    raise exception 'clinical evolution invalid input' using errcode = '22023';
  end if;

  insert into public.clinical_records (
    clinic_id,
    patient_id,
    treatment_id,
    treatment_session_id,
    procedure_id,
    status,
    created_by,
    current_version_id
  ) values (
    v_patient_clinic,
    p_patient_id,
    v_treatment_id,
    p_treatment_session_id,
    p_procedure_id,
    'draft',
    v_user,
    null
  )
  returning id into v_record_id;

  insert into public.clinical_record_versions (
    clinic_id,
    clinical_record_id,
    version_number,
    procedure_name,
    anamnesis,
    evolution,
    products_used_summary,
    next_steps,
    change_reason,
    recorded_at,
    created_by
  ) values (
    v_patient_clinic,
    v_record_id,
    1,
    v_name,
    coalesce(p_anamnesis, ''),
    coalesce(p_evolution, ''),
    nullif(trim(coalesce(p_products_used_summary, '')), ''),
    coalesce(p_next_steps, ''),
    nullif(trim(coalesce(p_change_reason, '')), ''),
    coalesce(p_recorded_at, timezone('utc', now())),
    v_user
  )
  returning id into v_version_id;

  update public.clinical_records
  set current_version_id = v_version_id
  where id = v_record_id
    and clinic_id = v_patient_clinic;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'clinical evolution invariant failed' using errcode = 'P0001';
  end if;

  perform public.write_clinical_audit(
    v_patient_clinic,
    'clinical_record.created',
    'clinical_record',
    v_record_id,
    jsonb_build_object('version_number', 1, 'status', 'draft')
  );

  return v_record_id;
end;
$$;

comment on function public.create_clinical_evolution(uuid, uuid, uuid, uuid, uuid, text, timestamptz, text, text, text, text, text) is
  'Creates one clinical evolution, its first version, the current pointer, and the audit row in a single transaction.';

-- ---------------------------------------------------------------------------
-- append_clinical_evolution
-- ---------------------------------------------------------------------------

create or replace function public.append_clinical_evolution(
  p_clinic_id uuid,
  p_clinical_record_id uuid,
  p_procedure_name text,
  p_recorded_at timestamptz,
  p_anamnesis text,
  p_evolution text,
  p_products_used_summary text,
  p_next_steps text,
  p_change_reason text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_record public.clinical_records%rowtype;
  v_name text;
  v_reason text;
  v_next integer;
  v_status public.clinical_record_status;
  v_version_id uuid;
  v_updated bigint;
begin
  v_user := public.current_user_id();
  if v_user is null then
    raise exception 'clinical evolution unauthenticated' using errcode = '42501';
  end if;

  if p_clinical_record_id is null then
    raise exception 'clinical evolution record missing' using errcode = 'P0002';
  end if;

  select *
    into v_record
  from public.clinical_records
  where id = p_clinical_record_id
  for update;

  if not found then
    raise exception 'clinical evolution record missing' using errcode = 'P0002';
  end if;

  if v_record.clinic_id is distinct from p_clinic_id then
    raise exception 'clinical evolution clinic mismatch' using errcode = '42501';
  end if;

  if not public.can_access_clinical_records(v_record.clinic_id) then
    raise exception 'clinical evolution denied' using errcode = '42501';
  end if;

  if v_record.status::text = 'cancelled' then
    raise exception 'clinical evolution closed' using errcode = 'P0001';
  end if;

  if v_record.current_version_id is null then
    raise exception 'clinical evolution invariant failed' using errcode = 'P0001';
  end if;

  v_name := nullif(trim(coalesce(p_procedure_name, '')), '');
  v_reason := nullif(trim(coalesce(p_change_reason, '')), '');
  if v_name is null or v_reason is null then
    raise exception 'clinical evolution invalid input' using errcode = '22023';
  end if;

  select coalesce(max(v.version_number), 0) + 1
    into v_next
  from public.clinical_record_versions v
  where v.clinical_record_id = v_record.id;

  if v_next is null or v_next < 1 or v_next > 100000 then
    raise exception 'clinical evolution invariant failed' using errcode = 'P0001';
  end if;

  if v_record.status::text = 'finalized' then
    v_status := 'corrected';
  else
    v_status := v_record.status;
  end if;

  insert into public.clinical_record_versions (
    clinic_id,
    clinical_record_id,
    version_number,
    procedure_name,
    anamnesis,
    evolution,
    products_used_summary,
    next_steps,
    change_reason,
    recorded_at,
    created_by
  ) values (
    v_record.clinic_id,
    v_record.id,
    v_next,
    v_name,
    coalesce(p_anamnesis, ''),
    coalesce(p_evolution, ''),
    nullif(trim(coalesce(p_products_used_summary, '')), ''),
    coalesce(p_next_steps, ''),
    v_reason,
    coalesce(p_recorded_at, timezone('utc', now())),
    v_user
  )
  returning id into v_version_id;

  update public.clinical_records
  set current_version_id = v_version_id,
      status = v_status
  where id = v_record.id
    and clinic_id = v_record.clinic_id;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'clinical evolution invariant failed' using errcode = 'P0001';
  end if;

  perform public.write_clinical_audit(
    v_record.clinic_id,
    'clinical_record.versioned',
    'clinical_record',
    v_record.id,
    jsonb_build_object('version_number', v_next, 'status', v_status::text)
  );

  return v_record.id;
end;
$$;

comment on function public.append_clinical_evolution(uuid, uuid, text, timestamptz, text, text, text, text, text) is
  'Appends one immutable version under a row lock, moves the current pointer, and writes the audit in the same transaction.';

-- ---------------------------------------------------------------------------
-- transition_clinical_evolution
-- ---------------------------------------------------------------------------

create or replace function public.transition_clinical_evolution(
  p_clinic_id uuid,
  p_clinical_record_id uuid,
  p_status text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_record public.clinical_records%rowtype;
  v_status public.clinical_record_status;
  v_action text;
  v_number integer;
  v_updated bigint;
begin
  v_user := public.current_user_id();
  if v_user is null then
    raise exception 'clinical evolution unauthenticated' using errcode = '42501';
  end if;

  if p_clinical_record_id is null then
    raise exception 'clinical evolution record missing' using errcode = 'P0002';
  end if;

  select *
    into v_record
  from public.clinical_records
  where id = p_clinical_record_id
  for update;

  if not found then
    raise exception 'clinical evolution record missing' using errcode = 'P0002';
  end if;

  if v_record.clinic_id is distinct from p_clinic_id then
    raise exception 'clinical evolution clinic mismatch' using errcode = '42501';
  end if;

  if not public.can_access_clinical_records(v_record.clinic_id) then
    raise exception 'clinical evolution denied' using errcode = '42501';
  end if;

  if v_record.current_version_id is null then
    raise exception 'clinical evolution invariant failed' using errcode = 'P0001';
  end if;

  if p_status = 'finalized' then
    if v_record.status::text not in ('draft', 'in_progress', 'corrected') then
      raise exception 'clinical evolution closed' using errcode = 'P0001';
    end if;
    v_status := 'finalized';
    v_action := 'clinical_record.finalized';
  elsif p_status = 'cancelled' then
    if v_record.status::text = 'cancelled' then
      raise exception 'clinical evolution closed' using errcode = 'P0001';
    end if;
    v_status := 'cancelled';
    v_action := 'clinical_record.cancelled';
  else
    raise exception 'clinical evolution invalid input' using errcode = '22023';
  end if;

  select v.version_number
    into v_number
  from public.clinical_record_versions v
  where v.id = v_record.current_version_id
    and v.clinical_record_id = v_record.id
    and v.clinic_id = v_record.clinic_id;

  if v_number is null or v_number < 1 or v_number > 100000 then
    raise exception 'clinical evolution invariant failed' using errcode = 'P0001';
  end if;

  update public.clinical_records
  set status = v_status
  where id = v_record.id
    and clinic_id = v_record.clinic_id;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'clinical evolution invariant failed' using errcode = 'P0001';
  end if;

  perform public.write_clinical_audit(
    v_record.clinic_id,
    v_action,
    'clinical_record',
    v_record.id,
    jsonb_build_object('version_number', v_number, 'status', v_status::text)
  );

  return v_record.id;
end;
$$;

comment on function public.transition_clinical_evolution(uuid, uuid, text) is
  'Finalizes or cancels a clinical evolution under a row lock and writes the audit in the same transaction. Versions stay unchanged.';

-- ---------------------------------------------------------------------------
-- EXECUTE. Default privileges also grant anon and service_role.
-- ---------------------------------------------------------------------------

revoke all on function public.create_clinical_evolution(uuid, uuid, uuid, uuid, uuid, text, timestamptz, text, text, text, text, text) from public;
revoke all on function public.append_clinical_evolution(uuid, uuid, text, timestamptz, text, text, text, text, text) from public;
revoke all on function public.transition_clinical_evolution(uuid, uuid, text) from public;

revoke execute on function public.create_clinical_evolution(uuid, uuid, uuid, uuid, uuid, text, timestamptz, text, text, text, text, text) from public, anon, authenticated, service_role;
revoke execute on function public.append_clinical_evolution(uuid, uuid, text, timestamptz, text, text, text, text, text) from public, anon, authenticated, service_role;
revoke execute on function public.transition_clinical_evolution(uuid, uuid, text) from public, anon, authenticated, service_role;

grant execute on function public.create_clinical_evolution(uuid, uuid, uuid, uuid, uuid, text, timestamptz, text, text, text, text, text) to authenticated;
grant execute on function public.append_clinical_evolution(uuid, uuid, text, timestamptz, text, text, text, text, text) to authenticated;
grant execute on function public.transition_clinical_evolution(uuid, uuid, text) to authenticated;

revoke execute on function public.write_clinical_audit(uuid, text, text, uuid, jsonb) from authenticated;

-- ---------------------------------------------------------------------------
-- Direct client writes stop here. SELECT policies remain.
-- ---------------------------------------------------------------------------

drop policy clinical_records_insert_clinical on public.clinical_records;
drop policy clinical_records_update_clinical on public.clinical_records;
drop policy clinical_record_versions_insert_clinical on public.clinical_record_versions;
