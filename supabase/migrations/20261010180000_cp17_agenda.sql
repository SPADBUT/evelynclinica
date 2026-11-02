-- CP17: persisted clinic agenda.
-- Additive. Does not edit earlier migrations or clinical tables.
-- Assumes roles anon, authenticated, and service_role already exist.
-- Appointments must be empty before professional_id becomes mandatory.
-- Reads use RLS. Writes go through the three security definer functions.
-- Active overlap is prevented for the same professional and the same patient.
-- Cancelled, completed, and no_show rows do not occupy a slot.
-- Audit metadata stores statuses only.

-- ---------------------------------------------------------------------------
-- Extension required for uuid equality inside a gist exclusion constraint
-- ---------------------------------------------------------------------------

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Columns. Stop if history already exists: a backfill would invent a professional.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from public.appointments) then
    raise exception 'cp17 appointments must be empty before professional_id' using errcode = 'P0001';
  end if;
end
$$;

alter table public.appointments
  add column professional_id uuid not null references public.profiles (id) on delete restrict,
  add column created_by uuid not null references public.profiles (id) on delete restrict;

comment on column public.appointments.professional_id is
  'Bookable staff member. Active admin or professional in the same clinic.';

comment on column public.appointments.created_by is
  'Staff user who created the appointment. Stamped from auth.uid().';

alter table public.appointments
  add constraint appointments_duration_limit
  check (ends_at <= starts_at + interval '12 hours');

alter table public.appointments
  add constraint appointments_professional_overlap
  exclude using gist (
    clinic_id with =,
    professional_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status in ('scheduled', 'confirmed'));

alter table public.appointments
  add constraint appointments_patient_overlap
  exclude using gist (
    clinic_id with =,
    patient_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status in ('scheduled', 'confirmed'));

create index appointments_clinic_professional_starts_idx
  on public.appointments (clinic_id, professional_id, starts_at);

-- ---------------------------------------------------------------------------
-- Identity and bookable professional
-- ---------------------------------------------------------------------------

create or replace function public.guard_appointment_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if public.current_user_id() is null then
      raise exception 'appointment unauthenticated' using errcode = '42501';
    end if;
    new.created_by := public.current_user_id();
    return new;
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'appointment author immutable' using errcode = '42501';
  end if;

  if new.patient_id is distinct from old.patient_id then
    raise exception 'appointment patient immutable' using errcode = '42501';
  end if;

  if new.clinic_id is distinct from old.clinic_id then
    raise exception 'clinic_id is immutable' using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.guard_appointment_identity() is
  'Stamps created_by on insert and rejects later changes to author, patient, or clinic.';

create or replace function public.enforce_appointment_professional()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_role public.clinic_role;
  v_active boolean;
  v_recheck boolean := true;
begin
  if tg_op = 'UPDATE' then
    v_recheck := new.status in ('scheduled', 'confirmed');
  end if;

  if not v_recheck then
    return new;
  end if;

  select m.role, m.is_active
    into v_role, v_active
  from public.clinic_memberships m
  where m.clinic_id = new.clinic_id
    and m.user_id = new.professional_id;

  if v_active is distinct from true
     or v_role is null
     or v_role not in ('admin'::public.clinic_role, 'professional'::public.clinic_role) then
    raise exception 'appointment professional not bookable' using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.enforce_appointment_professional() is
  'Requires an active admin or professional membership in the appointment clinic. Rechecked on insert and on every update that leaves the row scheduled or confirmed.';

create trigger appointments_guard_identity
  before insert or update on public.appointments
  for each row execute function public.guard_appointment_identity();

create trigger appointments_enforce_professional
  before insert or update on public.appointments
  for each row execute function public.enforce_appointment_professional();

-- ---------------------------------------------------------------------------
-- Role gate and audit
-- ---------------------------------------------------------------------------

create or replace function public.can_manage_agenda(p_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_clinic_role(
    p_clinic_id,
    array['admin', 'assistant', 'professional', 'manager']::public.clinic_role[]
  );
$$;

comment on function public.can_manage_agenda(uuid) is
  'True for an active admin, assistant, professional, or manager. Finance is excluded.';

create or replace function public.write_appointment_audit(
  p_clinic_id uuid,
  p_action text,
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
  v_status text;
  v_previous text;
begin
  if not public.can_manage_agenda(p_clinic_id) then
    raise exception 'appointment audit denied' using errcode = '42501';
  end if;

  if p_action not in (
    'appointment.created',
    'appointment.updated',
    'appointment.transitioned'
  ) then
    raise exception 'appointment audit action not allowed' using errcode = '22023';
  end if;

  if p_entity_id is null or not exists (
    select 1
    from public.appointments a
    where a.id = p_entity_id
      and a.clinic_id = p_clinic_id
  ) then
    raise exception 'appointment audit target missing' using errcode = '42501';
  end if;

  if p_metadata is not null and jsonb_typeof(p_metadata) = 'object' then
    v_status := p_metadata ->> 'status';
    v_previous := p_metadata ->> 'previous_status';
    if v_status in ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show') then
      v_metadata := v_metadata || jsonb_build_object('status', v_status);
    end if;
    if v_previous in ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show') then
      v_metadata := v_metadata || jsonb_build_object('previous_status', v_previous);
    end if;
  end if;

  insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    p_clinic_id,
    public.current_user_id(),
    p_action,
    'appointment',
    p_entity_id,
    v_metadata
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.write_appointment_audit(uuid, text, uuid, jsonb) is
  'Append-only appointment audit. Metadata keeps status fields and drops notes or procedure text.';

-- ---------------------------------------------------------------------------
-- Narrow catalogs
-- ---------------------------------------------------------------------------

create or replace function public.list_bookable_professionals(p_clinic_id uuid)
returns table (
  user_id uuid,
  full_name text,
  role public.clinic_role
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can_manage_agenda(p_clinic_id) then
    raise exception 'appointment denied' using errcode = '42501';
  end if;

  return query
  select p.id, p.full_name, m.role
  from public.clinic_memberships m
  join public.profiles p on p.id = m.user_id
  where m.clinic_id = p_clinic_id
    and m.is_active = true
    and m.role in ('admin'::public.clinic_role, 'professional'::public.clinic_role)
  order by p.full_name, p.id;
end;
$$;

comment on function public.list_bookable_professionals(uuid) is
  'Active admin and professional members of one clinic. Names only.';

create or replace function public.list_active_procedures(p_clinic_id uuid)
returns table (
  id uuid,
  name text,
  default_duration_minutes integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can_manage_agenda(p_clinic_id) then
    raise exception 'appointment denied' using errcode = '42501';
  end if;

  return query
  select pr.id, pr.name, pr.default_duration_minutes
  from public.procedures pr
  where pr.clinic_id = p_clinic_id
    and pr.is_active = true
  order by pr.name, pr.id;
end;
$$;

comment on function public.list_active_procedures(uuid) is
  'Active procedure id, name, and default duration. Description is not returned.';

-- ---------------------------------------------------------------------------
-- create_appointment
-- ---------------------------------------------------------------------------

create or replace function public.create_appointment(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_professional_id uuid,
  p_procedure_id uuid,
  p_title text,
  p_procedure_name text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_notes text
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
  v_procedure_clinic uuid;
  v_procedure_name text;
  v_procedure_active boolean;
  v_title text;
  v_name text;
  v_notes text;
  v_id uuid;
begin
  v_user := public.current_user_id();
  if v_user is null then
    raise exception 'appointment unauthenticated' using errcode = '42501';
  end if;

  if not public.can_manage_agenda(p_clinic_id) then
    raise exception 'appointment denied' using errcode = '42501';
  end if;

  if p_patient_id is null or p_professional_id is null or p_starts_at is null or p_ends_at is null then
    raise exception 'appointment invalid input' using errcode = '22023';
  end if;

  if p_ends_at <= p_starts_at or p_ends_at > p_starts_at + interval '12 hours' then
    raise exception 'appointment invalid input' using errcode = '22023';
  end if;

  v_title := nullif(trim(coalesce(p_title, '')), '');
  if v_title is null then
    raise exception 'appointment invalid input' using errcode = '22023';
  end if;

  select p.clinic_id, p.deleted_at
    into v_patient_clinic, v_patient_deleted
  from public.patients p
  where p.id = p_patient_id
  for share;

  if v_patient_clinic is null
     or v_patient_deleted is not null
     or v_patient_clinic is distinct from p_clinic_id then
    raise exception 'appointment patient missing' using errcode = 'P0002';
  end if;

  v_name := nullif(trim(coalesce(p_procedure_name, '')), '');
  if p_procedure_id is not null then
    select pr.clinic_id, pr.name, pr.is_active
      into v_procedure_clinic, v_procedure_name, v_procedure_active
    from public.procedures pr
    where pr.id = p_procedure_id
    for share;

    if v_procedure_clinic is distinct from p_clinic_id or v_procedure_active is distinct from true then
      raise exception 'appointment invalid input' using errcode = '22023';
    end if;

    if v_name is null then
      v_name := nullif(trim(coalesce(v_procedure_name, '')), '');
    end if;
  end if;

  v_notes := nullif(trim(coalesce(p_notes, '')), '');

  insert into public.appointments (
    clinic_id,
    patient_id,
    professional_id,
    procedure_id,
    title,
    procedure_name,
    starts_at,
    ends_at,
    status,
    notes,
    created_by
  ) values (
    p_clinic_id,
    p_patient_id,
    p_professional_id,
    p_procedure_id,
    v_title,
    v_name,
    p_starts_at,
    p_ends_at,
    'scheduled',
    v_notes,
    v_user
  )
  returning id into v_id;

  perform public.write_appointment_audit(
    p_clinic_id,
    'appointment.created',
    v_id,
    jsonb_build_object('status', 'scheduled')
  );

  return v_id;
end;
$$;

comment on function public.create_appointment(uuid, uuid, uuid, uuid, text, text, timestamptz, timestamptz, text) is
  'Creates one scheduled appointment and its audit row in the caller transaction.';

-- ---------------------------------------------------------------------------
-- update_appointment
-- ---------------------------------------------------------------------------

create or replace function public.update_appointment(
  p_clinic_id uuid,
  p_appointment_id uuid,
  p_professional_id uuid,
  p_procedure_id uuid,
  p_title text,
  p_procedure_name text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_notes text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_record public.appointments%rowtype;
  v_procedure_clinic uuid;
  v_procedure_name text;
  v_procedure_active boolean;
  v_title text;
  v_name text;
  v_notes text;
  v_updated bigint;
begin
  v_user := public.current_user_id();
  if v_user is null then
    raise exception 'appointment unauthenticated' using errcode = '42501';
  end if;

  if p_appointment_id is null or p_professional_id is null or p_starts_at is null or p_ends_at is null then
    raise exception 'appointment invalid input' using errcode = '22023';
  end if;

  if p_ends_at <= p_starts_at or p_ends_at > p_starts_at + interval '12 hours' then
    raise exception 'appointment invalid input' using errcode = '22023';
  end if;

  select *
    into v_record
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'appointment missing' using errcode = 'P0002';
  end if;

  if v_record.clinic_id is distinct from p_clinic_id then
    raise exception 'appointment denied' using errcode = '42501';
  end if;

  if not public.can_manage_agenda(v_record.clinic_id) then
    raise exception 'appointment denied' using errcode = '42501';
  end if;

  if v_record.status not in ('scheduled', 'confirmed') then
    raise exception 'appointment closed' using errcode = 'P0001';
  end if;

  v_title := nullif(trim(coalesce(p_title, '')), '');
  if v_title is null then
    raise exception 'appointment invalid input' using errcode = '22023';
  end if;

  v_name := nullif(trim(coalesce(p_procedure_name, '')), '');
  if p_procedure_id is not null then
    select pr.clinic_id, pr.name, pr.is_active
      into v_procedure_clinic, v_procedure_name, v_procedure_active
    from public.procedures pr
    where pr.id = p_procedure_id
    for share;

    if v_procedure_clinic is distinct from v_record.clinic_id or v_procedure_active is distinct from true then
      raise exception 'appointment invalid input' using errcode = '22023';
    end if;

    if v_name is null then
      v_name := nullif(trim(coalesce(v_procedure_name, '')), '');
    end if;
  end if;

  v_notes := nullif(trim(coalesce(p_notes, '')), '');

  update public.appointments
  set professional_id = p_professional_id,
      procedure_id = p_procedure_id,
      title = v_title,
      procedure_name = v_name,
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      notes = v_notes
  where id = v_record.id
    and clinic_id = v_record.clinic_id
    and patient_id = v_record.patient_id
    and status = v_record.status;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'appointment invariant failed' using errcode = 'P0001';
  end if;

  perform public.write_appointment_audit(
    v_record.clinic_id,
    'appointment.updated',
    v_record.id,
    jsonb_build_object('status', v_record.status::text, 'previous_status', v_record.status::text)
  );

  return v_record.id;
end;
$$;

comment on function public.update_appointment(uuid, uuid, uuid, uuid, text, text, timestamptz, timestamptz, text) is
  'Updates schedule fields while the appointment is scheduled or confirmed. Patient and status stay put.';

-- ---------------------------------------------------------------------------
-- transition_appointment
-- ---------------------------------------------------------------------------

create or replace function public.transition_appointment(
  p_clinic_id uuid,
  p_appointment_id uuid,
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
  v_record public.appointments%rowtype;
  v_status public.appointment_status;
  v_allowed boolean := false;
  v_updated bigint;
begin
  v_user := public.current_user_id();
  if v_user is null then
    raise exception 'appointment unauthenticated' using errcode = '42501';
  end if;

  if p_appointment_id is null or p_status is null then
    raise exception 'appointment invalid input' using errcode = '22023';
  end if;

  if p_status not in ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show') then
    raise exception 'appointment invalid input' using errcode = '22023';
  end if;

  v_status := p_status::public.appointment_status;

  select *
    into v_record
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'appointment missing' using errcode = 'P0002';
  end if;

  if v_record.clinic_id is distinct from p_clinic_id then
    raise exception 'appointment denied' using errcode = '42501';
  end if;

  if not public.can_manage_agenda(v_record.clinic_id) then
    raise exception 'appointment denied' using errcode = '42501';
  end if;

  v_allowed := case
    when v_record.status = 'scheduled' and v_status in ('confirmed', 'cancelled', 'completed', 'no_show') then true
    when v_record.status = 'confirmed' and v_status in ('scheduled', 'cancelled', 'completed', 'no_show') then true
    when v_record.status = 'cancelled' and v_status in ('scheduled', 'confirmed') then true
    when v_record.status = 'no_show' and v_status in ('scheduled', 'confirmed', 'completed') then true
    when v_record.status = 'completed' and v_status = 'scheduled' then true
    else false
  end;

  if not v_allowed then
    raise exception 'appointment transition denied' using errcode = 'P0001';
  end if;

  if v_record.status = 'completed' and v_status = 'scheduled' then
    if not public.has_clinic_role(v_record.clinic_id, array['admin']::public.clinic_role[]) then
      raise exception 'appointment transition denied' using errcode = '42501';
    end if;
  end if;

  update public.appointments
  set status = v_status
  where id = v_record.id
    and clinic_id = v_record.clinic_id
    and status = v_record.status;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'appointment invariant failed' using errcode = 'P0001';
  end if;

  perform public.write_appointment_audit(
    v_record.clinic_id,
    'appointment.transitioned',
    v_record.id,
    jsonb_build_object('previous_status', v_record.status::text, 'status', v_status::text)
  );

  return v_record.id;
end;
$$;

comment on function public.transition_appointment(uuid, uuid, text) is
  'Moves an appointment through the allowed status matrix and writes the audit in the same transaction.';

-- ---------------------------------------------------------------------------
-- EXECUTE. Default privileges also grant anon and service_role.
-- ---------------------------------------------------------------------------

revoke all on function public.can_manage_agenda(uuid) from public;
revoke all on function public.write_appointment_audit(uuid, text, uuid, jsonb) from public;
revoke all on function public.list_bookable_professionals(uuid) from public;
revoke all on function public.list_active_procedures(uuid) from public;
revoke all on function public.create_appointment(uuid, uuid, uuid, uuid, text, text, timestamptz, timestamptz, text) from public;
revoke all on function public.update_appointment(uuid, uuid, uuid, uuid, text, text, timestamptz, timestamptz, text) from public;
revoke all on function public.transition_appointment(uuid, uuid, text) from public;
revoke all on function public.guard_appointment_identity() from public;
revoke all on function public.enforce_appointment_professional() from public;

revoke execute on function public.can_manage_agenda(uuid) from public, anon, authenticated, service_role;
revoke execute on function public.write_appointment_audit(uuid, text, uuid, jsonb) from public, anon, authenticated, service_role;
revoke execute on function public.list_bookable_professionals(uuid) from public, anon, authenticated, service_role;
revoke execute on function public.list_active_procedures(uuid) from public, anon, authenticated, service_role;
revoke execute on function public.create_appointment(uuid, uuid, uuid, uuid, text, text, timestamptz, timestamptz, text) from public, anon, authenticated, service_role;
revoke execute on function public.update_appointment(uuid, uuid, uuid, uuid, text, text, timestamptz, timestamptz, text) from public, anon, authenticated, service_role;
revoke execute on function public.transition_appointment(uuid, uuid, text) from public, anon, authenticated, service_role;
revoke execute on function public.guard_appointment_identity() from public, anon, authenticated, service_role;
revoke execute on function public.enforce_appointment_professional() from public, anon, authenticated, service_role;

grant execute on function public.can_manage_agenda(uuid) to authenticated;
grant execute on function public.list_bookable_professionals(uuid) to authenticated;
grant execute on function public.list_active_procedures(uuid) to authenticated;
grant execute on function public.create_appointment(uuid, uuid, uuid, uuid, text, text, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.update_appointment(uuid, uuid, uuid, uuid, text, text, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.transition_appointment(uuid, uuid, text) to authenticated;
grant execute on function public.guard_appointment_identity() to authenticated;
grant execute on function public.enforce_appointment_professional() to authenticated;

-- ---------------------------------------------------------------------------
-- Read policy only. No insert, update, or delete policy.
-- ---------------------------------------------------------------------------

create policy appointments_select_agenda
  on public.appointments
  for select
  to authenticated
  using (public.can_manage_agenda(clinic_id));

comment on policy appointments_select_agenda on public.appointments is
  'Clinic agenda read for operational roles. Writes stay on the security definer functions. Physical delete has no policy.';
