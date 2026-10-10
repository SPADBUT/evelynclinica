-- Local CP17 checks. Not applied to hosted Supabase.
-- Expects migrations, auth.uid(), and the authenticated role to exist.
\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'cp17-admin-a@example.com'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'cp17-assistant-a@example.com'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'cp17-professional-a@example.com'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'cp17-manager-a@example.com'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', 'cp17-finance-a@example.com'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6', 'cp17-inactive-a@example.com'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'cp17-admin-b@example.com');

insert into public.profiles (id, full_name, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Admin A', 'cp17-admin-a@example.com'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'Assistant A', 'cp17-assistant-a@example.com'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'Professional A', 'cp17-professional-a@example.com'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'Manager A', 'cp17-manager-a@example.com'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', 'Finance A', 'cp17-finance-a@example.com'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6', 'Inactive Pro', 'cp17-inactive-a@example.com'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'Admin B', 'cp17-admin-b@example.com');

insert into public.clinics (id, name, slug, timezone) values
  ('11111111-1111-4111-8111-111111111111', 'Clinica A', 'cp17-clinica-a', 'America/Sao_Paulo'),
  ('22222222-2222-4222-8222-222222222222', 'Clinica B', 'cp17-clinica-b', 'America/Sao_Paulo');

insert into public.clinic_memberships (clinic_id, user_id, role, is_active) values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'admin', true),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'assistant', true),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'professional', true),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'manager', true),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', 'finance', true),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6', 'professional', false),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'admin', true);

insert into public.patients (id, clinic_id, full_name, email) values
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', '11111111-1111-4111-8111-111111111111', 'Paciente A1', 'cp17-a1@example.com'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2', '11111111-1111-4111-8111-111111111111', 'Paciente A2', 'cp17-a2@example.com'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3', '11111111-1111-4111-8111-111111111111', 'Paciente Arquivada', 'cp17-arch@example.com'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc4', '22222222-2222-4222-8222-222222222222', 'Paciente B', 'cp17-b@example.com');

update public.patients
set deleted_at = timezone('utc', now())
where id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3';

insert into public.procedures (id, clinic_id, name, default_duration_minutes, is_active) values
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', '11111111-1111-4111-8111-111111111111', 'Procedimento A', 60, true),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd2', '11111111-1111-4111-8111-111111111111', 'Procedimento Inativo', 30, false),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd3', '22222222-2222-4222-8222-222222222222', 'Procedimento B', 45, true);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', false);

insert into public.clinical_records (id, clinic_id, patient_id, status, created_by)
values (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
  '11111111-1111-4111-8111-111111111111',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  'finalized',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
);

create temporary table cp17_clinical_before as
select id, status::text as status, updated_at
from public.clinical_records
where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;

create temporary table cp17_ids (
  name text primary key,
  id uuid not null
);
grant all on table cp17_ids to authenticated, anon;

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', false);
set role authenticated;

insert into cp17_ids (name, id)
select 'base', public.create_appointment(
  '11111111-1111-4111-8111-111111111111',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
  'Horario base',
  null,
  timestamptz '2026-10-15 10:00:00-03',
  timestamptz '2026-10-15 11:00:00-03',
  'OPERATIONAL-NOTE-CP17'
);

insert into cp17_ids (name, id)
select 'adjacent', public.create_appointment(
  '11111111-1111-4111-8111-111111111111',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  null,
  'Horario adjacente',
  'Nome livre',
  timestamptz '2026-10-15 11:00:00-03',
  timestamptz '2026-10-15 12:00:00-03',
  null
);

insert into cp17_ids (name, id)
select 'parallel_a', public.create_appointment(
  '11111111-1111-4111-8111-111111111111',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  null,
  'Profissional A no mesmo horario',
  null,
  timestamptz '2026-10-16 10:00:00-03',
  timestamptz '2026-10-16 11:00:00-03',
  null
);

insert into cp17_ids (name, id)
select 'parallel_b', public.create_appointment(
  '11111111-1111-4111-8111-111111111111',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  null,
  'Admin no mesmo horario',
  null,
  timestamptz '2026-10-16 10:00:00-03',
  timestamptz '2026-10-16 11:00:00-03',
  null
);

do $$
begin
  perform public.create_appointment(
    '11111111-1111-4111-8111-111111111111',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    null,
    'Sobreposicao profissional',
    null,
    timestamptz '2026-10-15 10:30:00-03',
    timestamptz '2026-10-15 11:30:00-03',
    'nao pode vazar'
  );
  raise exception 'expected professional overlap';
exception
  when exclusion_violation then
    null;
end
$$;

do $$
begin
  perform public.create_appointment(
    '11111111-1111-4111-8111-111111111111',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    null,
    'Sobreposicao paciente',
    null,
    timestamptz '2026-10-15 10:15:00-03',
    timestamptz '2026-10-15 10:45:00-03',
    null
  );
  raise exception 'expected patient overlap';
exception
  when exclusion_violation then
    null;
end
$$;

do $$
begin
  perform public.create_appointment(
    '11111111-1111-4111-8111-111111111111',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    null,
    'Mesmo instante em UTC',
    null,
    timestamptz '2026-10-15 13:00:00+00',
    timestamptz '2026-10-15 14:00:00+00',
    null
  );
  raise exception 'expected timezone overlap';
exception
  when exclusion_violation then
    null;
end
$$;

do $$
begin
  perform public.create_appointment(
    '11111111-1111-4111-8111-111111111111',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    null,
    'Arquivada',
    null,
    timestamptz '2026-10-16 10:00:00-03',
    timestamptz '2026-10-16 11:00:00-03',
    null
  );
  raise exception 'expected archived patient failure';
exception
  when no_data_found then
    null;
end
$$;

do $$
begin
  perform public.create_appointment(
    '11111111-1111-4111-8111-111111111111',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc4',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    null,
    'Outra clinica',
    null,
    timestamptz '2026-10-16 10:00:00-03',
    timestamptz '2026-10-16 11:00:00-03',
    null
  );
  raise exception 'expected cross clinic patient failure';
exception
  when no_data_found then
    null;
end
$$;

do $$
begin
  perform public.create_appointment(
    '11111111-1111-4111-8111-111111111111',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6',
    null,
    'Profissional inativo',
    null,
    timestamptz '2026-10-16 10:00:00-03',
    timestamptz '2026-10-16 11:00:00-03',
    null
  );
  raise exception 'expected inactive professional failure';
exception
  when insufficient_privilege then
    null;
end
$$;

do $$
begin
  perform public.create_appointment(
    '11111111-1111-4111-8111-111111111111',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    null,
    'Assistente nao bookable',
    null,
    timestamptz '2026-10-16 12:00:00-03',
    timestamptz '2026-10-16 13:00:00-03',
    null
  );
  raise exception 'expected assistant professional failure';
exception
  when insufficient_privilege then
    null;
end
$$;

do $$
begin
  insert into public.appointments (
    clinic_id, patient_id, professional_id, title, starts_at, ends_at, created_by
  ) values (
    '11111111-1111-4111-8111-111111111111',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    'Insert direto',
    timestamptz '2026-10-17 10:00:00-03',
    timestamptz '2026-10-17 11:00:00-03',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  );
  raise exception 'expected direct insert failure';
exception
  when insufficient_privilege then
    null;
end
$$;

select public.transition_appointment(
  '11111111-1111-4111-8111-111111111111',
  (select id from cp17_ids where name = 'base'),
  'confirmed'
);

select public.transition_appointment(
  '11111111-1111-4111-8111-111111111111',
  (select id from cp17_ids where name = 'base'),
  'cancelled'
);

insert into cp17_ids (name, id)
select 'reopened', public.create_appointment(
  '11111111-1111-4111-8111-111111111111',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  null,
  'Reposicao apos cancelar',
  null,
  timestamptz '2026-10-15 10:00:00-03',
  timestamptz '2026-10-15 11:00:00-03',
  null
);

select public.update_appointment(
  '11111111-1111-4111-8111-111111111111',
  (select id from cp17_ids where name = 'reopened'),
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  null,
  'Remarcado',
  null,
  timestamptz '2026-10-18 15:00:00-03',
  timestamptz '2026-10-18 16:00:00-03',
  'nota remarcada'
);

select public.transition_appointment(
  '11111111-1111-4111-8111-111111111111',
  (select id from cp17_ids where name = 'reopened'),
  'completed'
);

reset role;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', false);
set role authenticated;

insert into cp17_ids (name, id)
select 'assistant_slot', public.create_appointment(
  '11111111-1111-4111-8111-111111111111',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  null,
  'Criado pela assistente',
  null,
  timestamptz '2026-10-21 09:00:00-03',
  timestamptz '2026-10-21 10:00:00-03',
  null
);

do $$
declare
  v_id uuid;
begin
  select id into v_id from cp17_ids where name = 'reopened';
  perform public.transition_appointment(
    '11111111-1111-4111-8111-111111111111',
    v_id,
    'scheduled'
  );
  raise exception 'assistant must not reopen completed';
exception
  when insufficient_privilege then
    null;
end
$$;

reset role;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', false);
set role authenticated;

select public.transition_appointment(
  '11111111-1111-4111-8111-111111111111',
  (select id from cp17_ids where name = 'reopened'),
  'scheduled'
);

select public.transition_appointment(
  '11111111-1111-4111-8111-111111111111',
  (select id from cp17_ids where name = 'reopened'),
  'cancelled'
);

do $$
declare
  v_id uuid;
  v_pros integer;
  v_procs integer;
  v_leaked integer;
  v_denied boolean := false;
begin
  select id into v_id from cp17_ids where name = 'base';
  begin
    perform public.transition_appointment(
      '11111111-1111-4111-8111-111111111111',
      v_id,
      'cancelled'
    );
  exception
    when raise_exception then
      if sqlerrm = 'appointment transition denied' then
        v_denied := true;
      else
        raise;
      end if;
  end;
  if not v_denied then
    raise exception 'same status must be denied';
  end if;

  select count(*) into v_pros
  from public.list_bookable_professionals('11111111-1111-4111-8111-111111111111');
  if v_pros <> 2 then
    raise exception 'expected two bookable professionals, got %', v_pros;
  end if;

  select count(*) into v_leaked
  from public.list_bookable_professionals('11111111-1111-4111-8111-111111111111') listed
  where listed.user_id in (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6'
  );
  if v_leaked <> 0 then
    raise exception 'non bookable member leaked';
  end if;

  select count(*) into v_procs
  from public.list_active_procedures('11111111-1111-4111-8111-111111111111');
  if v_procs <> 1 then
    raise exception 'expected one active procedure, got %', v_procs;
  end if;
end
$$;

reset role;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', false);
set role authenticated;

insert into cp17_ids (name, id)
select 'manager_slot', public.create_appointment(
  '11111111-1111-4111-8111-111111111111',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  null,
  'Criado pela gestao',
  null,
  timestamptz '2026-10-22 09:00:00-03',
  timestamptz '2026-10-22 10:00:00-03',
  null
);

reset role;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', false);
set role authenticated;

do $$
begin
  perform public.create_appointment(
    '11111111-1111-4111-8111-111111111111',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    null,
    'Financeiro',
    null,
    timestamptz '2026-10-19 10:00:00-03',
    timestamptz '2026-10-19 11:00:00-03',
    null
  );
  raise exception 'finance must not create';
exception
  when insufficient_privilege then
    null;
end
$$;

reset role;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', false);
set role authenticated;

do $$
begin
  perform public.create_appointment(
    '11111111-1111-4111-8111-111111111111',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    null,
    'Clinica B escrevendo A',
    null,
    timestamptz '2026-10-19 12:00:00-03',
    timestamptz '2026-10-19 13:00:00-03',
    null
  );
  raise exception 'clinic B must not write clinic A';
exception
  when insufficient_privilege then
    null;
end
$$;

reset role;
set role anon;

do $$
begin
  perform public.create_appointment(
    '11111111-1111-4111-8111-111111111111',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    null,
    'Anon',
    null,
    timestamptz '2026-10-19 14:00:00-03',
    timestamptz '2026-10-19 15:00:00-03',
    null
  );
  raise exception 'anon must not execute';
exception
  when insufficient_privilege then
    null;
end
$$;

reset role;

create temporary table cp17_counts (
  name text primary key,
  n integer not null
);
grant all on table cp17_counts to authenticated, anon;

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', false);
set role authenticated;
insert into cp17_counts (name, n)
select 'clinic_b', count(*)::integer from public.appointments;
reset role;

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', false);
set role authenticated;
insert into cp17_counts (name, n)
select 'finance', count(*)::integer from public.appointments;
reset role;

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', false);
set role authenticated;
insert into cp17_counts (name, n)
select 'admin_patient', count(*)::integer
from public.appointments
where patient_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';

update public.appointments
set title = 'alterado direto'
where id = (select id from cp17_ids where name = 'base');

insert into cp17_counts (name, n)
select 'direct_update', count(*)::integer
from public.appointments
where title = 'alterado direto';

delete from public.appointments
where id = (select id from cp17_ids where name = 'base');

insert into cp17_counts (name, n)
select 'base_after_delete', count(*)::integer
from public.appointments
where id = (select id from cp17_ids where name = 'base');
reset role;

set role anon;
insert into cp17_counts (name, n)
select 'anon', count(*)::integer from public.appointments;
reset role;

do $$
declare
  v_base uuid;
  v_status text;
  v_notes text;
  v_patient uuid;
  v_audit_notes integer;
  v_audit_actions integer;
  v_clinical integer;
  v_clinical_count integer;
  v_auth_create boolean;
  v_wide boolean;
  v_search integer;
  v_policies integer;
  v_write_policies integer;
begin
  select id into v_base from cp17_ids where name = 'base';

  select status::text, notes, patient_id
    into v_status, v_notes, v_patient
  from public.appointments
  where id = v_base;

  if v_status is distinct from 'cancelled' or v_patient is distinct from 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1' then
    raise exception 'cancelled history was not preserved';
  end if;
  if v_notes is distinct from 'OPERATIONAL-NOTE-CP17' then
    raise exception 'direct update changed operational notes';
  end if;
  if (select n from cp17_counts where name = 'direct_update') <> 0 then
    raise exception 'direct update changed a row';
  end if;
  if (select n from cp17_counts where name = 'base_after_delete') <> 1 then
    raise exception 'direct delete removed history';
  end if;
  if (select n from cp17_counts where name = 'clinic_b') <> 0 then
    raise exception 'clinic B can see clinic A appointments';
  end if;
  if (select n from cp17_counts where name = 'finance') <> 0 then
    raise exception 'finance can see appointments';
  end if;
  if (select n from cp17_counts where name = 'anon') <> 0 then
    raise exception 'anon can see appointments';
  end if;
  if (select n from cp17_counts where name = 'admin_patient') < 2 then
    raise exception 'admin should see the patient history';
  end if;

  select count(*) into v_audit_notes
  from public.audit_logs
  where entity_type = 'appointment'
    and (
      metadata::text ilike '%OPERATIONAL-NOTE-CP17%'
      or metadata::text ilike '%nota remarcada%'
      or metadata::text ilike '%procedimento%'
      or metadata ? 'notes'
      or metadata ? 'title'
      or metadata ? 'procedure_name'
    );
  if v_audit_notes <> 0 then
    raise exception 'audit stored operational text';
  end if;

  select count(*) into v_audit_actions
  from public.audit_logs
  where entity_type = 'appointment'
    and action in ('appointment.created', 'appointment.updated', 'appointment.transitioned');
  if v_audit_actions < 5 then
    raise exception 'appointment audit trail incomplete';
  end if;

  select count(*) into v_clinical_count from public.clinical_records;
  if v_clinical_count <> 1 then
    raise exception 'agenda writes changed the clinical record count';
  end if;

  select count(*) into v_clinical
  from public.clinical_records c
  join cp17_clinical_before b on b.id = c.id
  where c.status::text = b.status
    and c.updated_at = b.updated_at;
  if v_clinical <> 1 then
    raise exception 'clinical record changed';
  end if;

  select has_function_privilege('authenticated', 'public.create_appointment(uuid, uuid, uuid, uuid, text, text, timestamptz, timestamptz, text)', 'execute')
    into v_auth_create;
  if v_auth_create is distinct from true then
    raise exception 'authenticated lost create execute';
  end if;

  select has_function_privilege('anon', 'public.create_appointment(uuid, uuid, uuid, uuid, text, text, timestamptz, timestamptz, text)', 'execute')
    or has_function_privilege('service_role', 'public.create_appointment(uuid, uuid, uuid, uuid, text, text, timestamptz, timestamptz, text)', 'execute')
    or has_function_privilege('authenticated', 'public.write_appointment_audit(uuid, text, uuid, jsonb)', 'execute')
    or has_function_privilege('anon', 'public.update_appointment(uuid, uuid, uuid, uuid, text, text, timestamptz, timestamptz, text)', 'execute')
    or has_function_privilege('anon', 'public.transition_appointment(uuid, uuid, text)', 'execute')
    into v_wide;
  if v_wide then
    raise exception 'execute privileges are wider than authenticated writes';
  end if;

  select count(*) into v_search
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'guard_appointment_identity',
      'enforce_appointment_professional',
      'can_manage_agenda',
      'write_appointment_audit',
      'list_bookable_professionals',
      'list_active_procedures',
      'create_appointment',
      'update_appointment',
      'transition_appointment'
    )
    and exists (
      select 1
      from unnest(coalesce(p.proconfig, array[]::text[])) cfg
      where cfg in ('search_path=', 'search_path=""')
    );
  if v_search <> 9 then
    raise exception 'agenda functions must keep an empty search_path, found %', v_search;
  end if;

  select count(*) into v_policies
  from pg_policy
  where polrelid = 'public.appointments'::regclass
    and polcmd = 'r';
  select count(*) into v_write_policies
  from pg_policy
  where polrelid = 'public.appointments'::regclass
    and polcmd <> 'r';
  if v_policies <> 1 or v_write_policies <> 0 then
    raise exception 'appointments must allow select only';
  end if;
end
$$;

reset role;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', false);
set role authenticated;

do $$
begin
  perform public.create_appointment(
    '11111111-1111-4111-8111-111111111111',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    'Procedimento inexistente',
    null,
    timestamptz '2026-10-23 10:00:00-03',
    timestamptz '2026-10-23 11:00:00-03',
    null
  );
  raise exception 'expected missing procedure failure';
exception
  when invalid_parameter_value then
    null;
end
$$;

do $$
begin
  perform public.create_appointment(
    '11111111-1111-4111-8111-111111111111',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
    'Procedimento inativo',
    null,
    timestamptz '2026-10-23 12:00:00-03',
    timestamptz '2026-10-23 13:00:00-03',
    null
  );
  raise exception 'expected inactive procedure failure';
exception
  when invalid_parameter_value then
    null;
end
$$;

do $$
begin
  perform public.create_appointment(
    '11111111-1111-4111-8111-111111111111',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd3',
    'Procedimento de outra clinica',
    null,
    timestamptz '2026-10-23 14:00:00-03',
    timestamptz '2026-10-23 15:00:00-03',
    null
  );
  raise exception 'expected cross clinic procedure failure';
exception
  when invalid_parameter_value then
    null;
end
$$;

insert into cp17_ids (name, id)
select 'matrix', public.create_appointment(
  '11111111-1111-4111-8111-111111111111',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
  'Matriz de status',
  null,
  timestamptz '2026-10-24 10:00:00-03',
  timestamptz '2026-10-24 11:00:00-03',
  null
);

do $$
declare
  v_id uuid;
  v_status text;
  v_denied boolean;
begin
  select id into v_id from cp17_ids where name = 'matrix';

  begin
    perform public.update_appointment(
      '11111111-1111-4111-8111-111111111111',
      v_id,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
      'Matriz de status',
      null,
      timestamptz '2026-10-24 10:00:00-03',
      timestamptz '2026-10-24 11:00:00-03',
      null
    );
    raise exception 'inactive procedure update must fail';
  exception
    when invalid_parameter_value then
      null;
  end;

  begin
    perform public.update_appointment(
      '11111111-1111-4111-8111-111111111111',
      v_id,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd3',
      'Matriz de status',
      null,
      timestamptz '2026-10-24 10:00:00-03',
      timestamptz '2026-10-24 11:00:00-03',
      null
    );
    raise exception 'cross clinic procedure update must fail';
  exception
    when invalid_parameter_value then
      null;
  end;

  if (select procedure_id from public.appointments where id = v_id)
     is distinct from 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1' then
    raise exception 'rejected procedure update changed the row';
  end if;

  perform public.transition_appointment(
    '11111111-1111-4111-8111-111111111111', v_id, 'no_show'
  );

  v_denied := false;
  begin
    perform public.transition_appointment(
      '11111111-1111-4111-8111-111111111111', v_id, 'cancelled'
    );
  exception
    when raise_exception then
      if sqlerrm = 'appointment transition denied' then
        v_denied := true;
      else
        raise;
      end if;
  end;
  if not v_denied then
    raise exception 'no_show to cancelled must be denied';
  end if;

  v_denied := false;
  begin
    perform public.transition_appointment(
      '11111111-1111-4111-8111-111111111111', v_id, 'no_show'
    );
  exception
    when raise_exception then
      if sqlerrm = 'appointment transition denied' then
        v_denied := true;
      else
        raise;
      end if;
  end;
  if not v_denied then
    raise exception 'same no_show status must be denied';
  end if;

  select status::text into v_status from public.appointments where id = v_id;
  if v_status is distinct from 'no_show' then
    raise exception 'no_show row changed after denied transitions';
  end if;

  perform public.transition_appointment(
    '11111111-1111-4111-8111-111111111111', v_id, 'completed'
  );

  v_denied := false;
  begin
    perform public.transition_appointment(
      '11111111-1111-4111-8111-111111111111', v_id, 'no_show'
    );
  exception
    when raise_exception then
      if sqlerrm = 'appointment transition denied' then
        v_denied := true;
      else
        raise;
      end if;
  end;
  if not v_denied then
    raise exception 'completed to no_show must be denied';
  end if;

  v_denied := false;
  begin
    perform public.transition_appointment(
      '11111111-1111-4111-8111-111111111111', v_id, 'confirmed'
    );
  exception
    when raise_exception then
      if sqlerrm = 'appointment transition denied' then
        v_denied := true;
      else
        raise;
      end if;
  end;
  if not v_denied then
    raise exception 'completed to confirmed must be denied';
  end if;

  perform public.transition_appointment(
    '11111111-1111-4111-8111-111111111111', v_id, 'scheduled'
  );
  perform public.transition_appointment(
    '11111111-1111-4111-8111-111111111111', v_id, 'confirmed'
  );
  perform public.transition_appointment(
    '11111111-1111-4111-8111-111111111111', v_id, 'no_show'
  );
  perform public.transition_appointment(
    '11111111-1111-4111-8111-111111111111', v_id, 'scheduled'
  );
  perform public.transition_appointment(
    '11111111-1111-4111-8111-111111111111', v_id, 'cancelled'
  );

  v_denied := false;
  begin
    perform public.transition_appointment(
      '11111111-1111-4111-8111-111111111111', v_id, 'no_show'
    );
  exception
    when raise_exception then
      if sqlerrm = 'appointment transition denied' then
        v_denied := true;
      else
        raise;
      end if;
  end;
  if not v_denied then
    raise exception 'cancelled to no_show must be denied';
  end if;

  v_denied := false;
  begin
    perform public.transition_appointment(
      '11111111-1111-4111-8111-111111111111', v_id, 'completed'
    );
  exception
    when raise_exception then
      if sqlerrm = 'appointment transition denied' then
        v_denied := true;
      else
        raise;
      end if;
  end;
  if not v_denied then
    raise exception 'cancelled to completed must be denied';
  end if;

  select status::text into v_status from public.appointments where id = v_id;
  if v_status is distinct from 'cancelled' then
    raise exception 'matrix appointment should stay cancelled';
  end if;

  perform public.transition_appointment(
    '11111111-1111-4111-8111-111111111111', v_id, 'confirmed'
  );
  perform public.transition_appointment(
    '11111111-1111-4111-8111-111111111111', v_id, 'scheduled'
  );
  perform public.transition_appointment(
    '11111111-1111-4111-8111-111111111111', v_id, 'cancelled'
  );
end
$$;

insert into cp17_ids (name, id)
select 'freed', public.create_appointment(
  '11111111-1111-4111-8111-111111111111',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  null,
  'Horario a reabrir',
  null,
  timestamptz '2026-10-25 10:00:00-03',
  timestamptz '2026-10-25 11:00:00-03',
  null
);

select public.transition_appointment(
  '11111111-1111-4111-8111-111111111111',
  (select id from cp17_ids where name = 'freed'),
  'cancelled'
);

insert into cp17_ids (name, id)
select 'occupier', public.create_appointment(
  '11111111-1111-4111-8111-111111111111',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  null,
  'Horario que ocupa o intervalo',
  null,
  timestamptz '2026-10-25 10:30:00-03',
  timestamptz '2026-10-25 11:30:00-03',
  null
);

do $$
declare
  v_freed uuid;
  v_status text;
begin
  select id into v_freed from cp17_ids where name = 'freed';
  begin
    perform public.transition_appointment(
      '11111111-1111-4111-8111-111111111111',
      v_freed,
      'scheduled'
    );
    raise exception 'reopen into an occupied slot must fail';
  exception
    when exclusion_violation then
      null;
  end;

  select status::text into v_status from public.appointments where id = v_freed;
  if v_status is distinct from 'cancelled' then
    raise exception 'occupied reopen changed the cancelled row';
  end if;

  select status::text into v_status
  from public.appointments
  where id = (select id from cp17_ids where name = 'occupier');
  if v_status is distinct from 'scheduled' then
    raise exception 'occupying appointment was not preserved';
  end if;
end
$$;

reset role;

begin;

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', false);
set role authenticated;

insert into cp17_ids (name, id)
select 'inactive_update', public.create_appointment(
  '11111111-1111-4111-8111-111111111111',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  null,
  'Atualizacao com profissional inativo',
  null,
  timestamptz '2026-10-26 10:00:00-03',
  timestamptz '2026-10-26 11:00:00-03',
  null
);

reset role;

update public.clinic_memberships
set is_active = false
where clinic_id = '11111111-1111-4111-8111-111111111111'
  and user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', false);
set role authenticated;

do $$
declare
  v_id uuid;
  v_starts timestamptz;
  v_status text;
begin
  select id, starts_at, status::text
    into v_id, v_starts, v_status
  from public.appointments
  where id = (select id from cp17_ids where name = 'inactive_update');

  if v_status is distinct from 'scheduled' then
    raise exception 'inactive-update fixture must start scheduled';
  end if;

  begin
    perform public.update_appointment(
      '11111111-1111-4111-8111-111111111111',
      v_id,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
      null,
      'Atualizacao com profissional inativo',
      null,
      timestamptz '2026-10-26 14:00:00-03',
      timestamptz '2026-10-26 15:00:00-03',
      null
    );
    raise exception 'update must recheck an inactive professional';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    perform public.transition_appointment(
      '11111111-1111-4111-8111-111111111111',
      v_id,
      'confirmed'
    );
    raise exception 'confirm must recheck an inactive professional';
  exception
    when insufficient_privilege then
      null;
  end;

  if (select starts_at from public.appointments where id = v_id) is distinct from v_starts
     or (select status::text from public.appointments where id = v_id) is distinct from 'scheduled' then
    raise exception 'rejected professional recheck changed the row';
  end if;

  perform public.transition_appointment(
    '11111111-1111-4111-8111-111111111111',
    v_id,
    'cancelled'
  );

  begin
    perform public.transition_appointment(
      '11111111-1111-4111-8111-111111111111',
      v_id,
      'scheduled'
    );
    raise exception 'reopen must recheck an inactive professional';
  exception
    when insufficient_privilege then
      null;
  end;

  if (select status::text from public.appointments where id = v_id) is distinct from 'cancelled' then
    raise exception 'inactive reopen changed the cancelled row';
  end if;
end
$$;

reset role;
rollback;

create temporary table cp17_rollback_snapshot as
select
  (select count(*)::integer from public.appointments) as appointments,
  (select count(*)::integer from public.audit_logs where entity_type = 'appointment') as audits,
  (select status::text from public.clinical_records where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1') as clinical_status,
  (select updated_at from public.clinical_records where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1') as clinical_updated_at,
  (select updated_at from public.appointments where id = (select id from cp17_ids where name = 'adjacent')) as adjacent_updated_at;

begin;

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
begin
  raise exception 'cp17 injected audit failure' using errcode = 'P0001';
end;
$$;

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', false);
set role authenticated;

do $$
declare
  v_id uuid;
  v_before timestamptz;
  v_failed boolean := false;
begin
  begin
    perform public.create_appointment(
      '11111111-1111-4111-8111-111111111111',
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
      null,
      'Auditoria deve reverter',
      'nome que nao pode permanecer',
      timestamptz '2026-10-27 10:00:00-03',
      timestamptz '2026-10-27 11:00:00-03',
      'OBSERVACAO-NAO-PODE-PERSISTIR'
    );
  exception
    when raise_exception then
      if sqlerrm = 'cp17 injected audit failure' then
        v_failed := true;
      else
        raise;
      end if;
  end;
  if not v_failed then
    raise exception 'create audit failure was not raised';
  end if;

  select id, updated_at into v_id, v_before
  from public.appointments
  where id = (select id from cp17_ids where name = 'adjacent');

  v_failed := false;
  begin
    perform public.transition_appointment(
      '11111111-1111-4111-8111-111111111111',
      v_id,
      'confirmed'
    );
  exception
    when raise_exception then
      if sqlerrm = 'cp17 injected audit failure' then
        v_failed := true;
      else
        raise;
      end if;
  end;
  if not v_failed then
    raise exception 'transition audit failure was not raised';
  end if;

  if (select status::text from public.appointments where id = v_id) is distinct from 'scheduled'
     or (select updated_at from public.appointments where id = v_id) is distinct from v_before then
    raise exception 'transition persisted despite audit failure';
  end if;
end
$$;

reset role;

do $$
declare
  v_appointments integer;
  v_audits integer;
  v_leftover integer;
begin
  select count(*) into v_appointments from public.appointments;
  select count(*) into v_audits from public.audit_logs where entity_type = 'appointment';
  select count(*) into v_leftover
  from public.appointments
  where title = 'Auditoria deve reverter'
     or notes = 'OBSERVACAO-NAO-PODE-PERSISTIR'
     or procedure_name = 'nome que nao pode permanecer';

  if v_appointments <> (select appointments from cp17_rollback_snapshot) then
    raise exception 'appointment count changed after audit failure: % vs %',
      v_appointments, (select appointments from cp17_rollback_snapshot);
  end if;
  if v_audits <> (select audits from cp17_rollback_snapshot) then
    raise exception 'audit count changed after audit failure: % vs %',
      v_audits, (select audits from cp17_rollback_snapshot);
  end if;
  if v_leftover <> 0 then
    raise exception 'failed appointment left a row';
  end if;
  if exists (
    select 1
    from public.audit_logs
    where metadata::text ilike '%OBSERVACAO-NAO-PODE-PERSISTIR%'
       or metadata::text ilike '%nome que nao pode permanecer%'
       or metadata::text ilike '%Auditoria deve reverter%'
  ) then
    raise exception 'failed audit stored operational text';
  end if;
  if not exists (
    select 1
    from public.clinical_records
    where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'
      and status::text = (select clinical_status from cp17_rollback_snapshot)
      and updated_at = (select clinical_updated_at from cp17_rollback_snapshot)
  ) then
    raise exception 'clinical row changed during audit rollback';
  end if;
  if (
    select updated_at from public.appointments
    where id = (select id from cp17_ids where name = 'adjacent')
  ) is distinct from (
    select adjacent_updated_at from cp17_rollback_snapshot
  ) then
    raise exception 'adjacent appointment changed during audit rollback';
  end if;
end
$$;

rollback;

begin;

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', false);
set role authenticated;

insert into cp17_ids (name, id)
select 'restored', public.create_appointment(
  '11111111-1111-4111-8111-111111111111',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  null,
  'Fluxo normal apos auditoria',
  null,
  timestamptz '2026-10-28 10:00:00-03',
  timestamptz '2026-10-28 11:00:00-03',
  'nota do fluxo normal'
);

reset role;

do $$
declare
  v_id uuid;
begin
  select id into v_id from cp17_ids where name = 'restored';

  if not exists (
    select 1
    from public.appointments a
    join public.audit_logs l on l.entity_id = a.id
    where a.id = v_id
      and a.status = 'scheduled'
      and l.action = 'appointment.created'
      and l.metadata = jsonb_build_object('status', 'scheduled')
  ) then
    raise exception 'restored audit did not record status only';
  end if;

  if exists (
    select 1
    from public.audit_logs
    where entity_id = v_id
      and (
        metadata::text ilike '%nota do fluxo normal%'
        or metadata ? 'notes'
        or metadata ? 'title'
        or metadata ? 'procedure_name'
      )
  ) then
    raise exception 'restored audit stored operational text';
  end if;
end
$$;

rollback;
reset role;

select 'cp17 local checks passed' as result;
