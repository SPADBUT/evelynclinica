-- A1 security tests (loaded after fixtures by run_a1_validation.sql)
-- Covers: anon, cross-org IDOR, organization_id spoof, role spoof via metadata,
-- SECURITY DEFINER search_path, clinical.write denied for assistant.
--
-- IMPORTANT: must SET ROLE to non-superuser roles. Superusers bypass RLS.

\set ON_ERROR_STOP on

create temporary table a1_test_results (
  test_name text primary key,
  passed boolean not null,
  detail text
);

-- Tests run under SET ROLE authenticated/anon; allow writes to the result table.
grant all on table a1_test_results to authenticated, anon, service_role;

create or replace function pg_temp.record_test(p_name text, p_passed boolean, p_detail text default null)
returns void
language plpgsql
security definer
set search_path = pg_temp, public
as $$
begin
  insert into a1_test_results (test_name, passed, detail)
  values (p_name, p_passed, p_detail)
  on conflict (test_name) do update
    set passed = excluded.passed,
        detail = excluded.detail;
end;
$$;

-- Allow the bootstrap role to assume PostgREST-like roles
do $$
begin
  execute format('grant authenticated to %I', current_user);
  execute format('grant anon to %I', current_user);
  execute format('grant service_role to %I', current_user);
end;
$$;

create or replace function pg_temp.as_user(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', p_user_id::text, false);
  execute 'set role authenticated';
end;
$$;

create or replace function pg_temp.as_anon()
returns void
language plpgsql
as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  execute 'set role anon';
end;
$$;

create or replace function pg_temp.as_service()
returns void
language plpgsql
as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  execute 'set role service_role';
end;
$$;

create or replace function pg_temp.as_bootstrap()
returns void
language plpgsql
as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;

do $$
declare
  org_a uuid;
  org_b uuid;
  patient_a uuid;
  patient_b uuid;
  admin_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  clinician_a uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  assistant_a uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  admin_b uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  cnt integer;
  got_org uuid;
  spoofed boolean;
  fn_def text;
  raised boolean;
  patient_name text;
begin
  perform pg_temp.as_bootstrap();

  select id into org_a from public.organizations where slug = 'clinica-a';
  select id into org_b from public.organizations where slug = 'clinica-b';
  select id into patient_a from public.patients where organization_id = org_a and full_name = 'Patient Org A';
  select id into patient_b from public.patients where organization_id = org_b and full_name = 'Patient Org B';

  -- =========================================================================
  -- A. Cross-organization IDOR
  -- =========================================================================
  perform pg_temp.as_user(admin_a);
  select count(*) into cnt from public.patients where id = patient_b;
  perform pg_temp.as_bootstrap();
  perform pg_temp.record_test(
    'A_cross_org_idor_select',
    cnt = 0,
    format('admin_a saw %s patients from org_b (expected 0)', cnt)
  );

  perform pg_temp.as_user(admin_a);
  update public.patients set full_name = 'Hacked' where id = patient_b;
  get diagnostics cnt = row_count;
  perform pg_temp.as_bootstrap();
  select full_name into patient_name from public.patients where id = patient_b;
  perform pg_temp.record_test(
    'A_cross_org_idor_update',
    cnt = 0 and patient_name = 'Patient Org B',
    format('row_count=%s name=%s', cnt, patient_name)
  );

  -- =========================================================================
  -- B. Anon access
  -- =========================================================================
  perform pg_temp.as_anon();
  begin
    select count(*) into cnt from public.patients;
  exception
    when insufficient_privilege then
      cnt := -1;
  end;
  perform pg_temp.as_bootstrap();
  if cnt = -1 then
    perform pg_temp.record_test('B_anon_patients', true, 'privilege denied (good)');
  else
    perform pg_temp.record_test('B_anon_patients', cnt = 0, format('anon saw %s patients', cnt));
  end if;

  perform pg_temp.as_anon();
  begin
    select count(*) into cnt from public.organizations;
  exception
    when insufficient_privilege then
      cnt := -1;
  end;
  perform pg_temp.as_bootstrap();
  if cnt = -1 then
    perform pg_temp.record_test('B_anon_organizations', true, 'privilege denied (good)');
  else
    perform pg_temp.record_test('B_anon_organizations', cnt = 0, format('anon saw %s orgs', cnt));
  end if;

  perform pg_temp.as_anon();
  begin
    select count(*) into cnt from public.staff_profiles;
  exception
    when insufficient_privilege then
      cnt := -1;
  end;
  perform pg_temp.as_bootstrap();
  if cnt = -1 then
    perform pg_temp.record_test('B_anon_staff_profiles', true, 'privilege denied (good)');
  else
    perform pg_temp.record_test('B_anon_staff_profiles', cnt = 0, format('anon saw %s staff', cnt));
  end if;

  -- =========================================================================
  -- C. Client organization_id spoof on INSERT/UPDATE
  -- =========================================================================
  perform pg_temp.as_user(admin_a);
  spoofed := false;
  begin
    insert into public.patients (organization_id, full_name)
    values (org_b, 'Spoofed into B');
    spoofed := true;
  exception when others then
    spoofed := false;
  end;
  perform pg_temp.as_bootstrap();
  perform pg_temp.record_test(
    'C_org_id_spoof_insert',
    not spoofed
      and not exists (select 1 from public.patients where full_name = 'Spoofed into B'),
    'insert with foreign organization_id must fail'
  );

  perform pg_temp.as_user(admin_a);
  insert into public.patients (organization_id, full_name)
  values (org_a, 'Legit Patient A')
  returning id into patient_a;
  perform pg_temp.as_bootstrap();
  perform pg_temp.record_test(
    'C_org_id_legit_insert',
    patient_a is not null,
    'admin_a can insert into own organization'
  );

  perform pg_temp.as_user(admin_a);
  spoofed := false;
  begin
    update public.patients
    set organization_id = org_b
    where id = patient_a;
    get diagnostics cnt = row_count;
    spoofed := cnt > 0;
  exception when others then
    spoofed := false;
  end;
  perform pg_temp.as_bootstrap();
  perform pg_temp.record_test(
    'C_org_id_spoof_update',
    not spoofed
      and (select organization_id from public.patients where id = patient_a) = org_a,
    'cannot reassign patient.organization_id to another org'
  );

  -- =========================================================================
  -- D. Role / user_metadata not authoritative
  -- =========================================================================
  perform pg_temp.as_bootstrap();
  update auth.users
  set raw_user_meta_data = jsonb_build_object('role', 'admin', 'organization_id', org_b::text)
  where id = assistant_a;

  perform pg_temp.as_user(assistant_a);
  got_org := public.current_organization_id();
  perform pg_temp.record_test(
    'D_metadata_ignored_for_org',
    got_org = org_a,
    format('got org %s (expected org_a)', got_org)
  );
  perform pg_temp.record_test(
    'D_metadata_ignored_for_clinical_write',
    public.has_permission('clinical.write') = false,
    'assistant must not get clinical.write from user_metadata'
  );
  perform pg_temp.record_test(
    'D_metadata_ignored_for_staff_manage',
    public.has_permission('staff.manage') = false,
    'assistant must not get staff.manage from user_metadata'
  );

  spoofed := false;
  begin
    insert into public.staff_roles (staff_id, role_id)
    select assistant_a, id from public.roles where code = 'admin';
    spoofed := true;
  exception when others then
    spoofed := false;
  end;
  perform pg_temp.as_bootstrap();
  perform pg_temp.record_test(
    'D_role_self_escalation_blocked',
    not spoofed
      and not exists (
        select 1
        from public.staff_roles sr
        join public.roles r on r.id = sr.role_id
        where sr.staff_id = assistant_a and r.code = 'admin'
      ),
    'assistant cannot assign admin role to self'
  );

  -- =========================================================================
  -- E / F. SECURITY DEFINER + search_path
  -- =========================================================================
  select pg_get_functiondef('public.current_organization_id()'::regprocedure)
  into fn_def;
  perform pg_temp.record_test(
    'E_current_org_is_security_definer',
    fn_def ilike '%SECURITY DEFINER%',
    left(fn_def, 200)
  );
  perform pg_temp.record_test(
    'F_current_org_search_path_public',
    fn_def ilike '%search_path%public%',
    'search_path must be fixed to public'
  );

  select pg_get_functiondef('public.has_permission(text)'::regprocedure)
  into fn_def;
  perform pg_temp.record_test(
    'E_has_permission_is_security_definer',
    fn_def ilike '%SECURITY DEFINER%',
    left(fn_def, 200)
  );
  perform pg_temp.record_test(
    'F_has_permission_search_path_public',
    fn_def ilike '%search_path%public%',
    'search_path must be fixed to public'
  );

  perform pg_temp.as_anon();
  raised := false;
  begin
    perform public.current_organization_id();
  exception when insufficient_privilege then
    raised := true;
  end;
  perform pg_temp.as_bootstrap();
  perform pg_temp.record_test(
    'E_anon_cannot_execute_current_organization_id',
    raised,
    'execute should be revoked from anon/public'
  );

  -- =========================================================================
  -- RBAC matrix smoke
  -- =========================================================================
  perform pg_temp.as_user(assistant_a);
  perform pg_temp.record_test(
    'RBAC_assistant_patients_write',
    public.has_permission('patients.write') = true,
    'assistant may write operational patients'
  );
  perform pg_temp.record_test(
    'RBAC_assistant_no_clinical_write',
    public.has_permission('clinical.write') = false,
    'assistant must not write clinical'
  );
  perform pg_temp.record_test(
    'RBAC_assistant_no_clinical_read',
    public.has_permission('clinical.read') = false,
    'assistant least privilege: no clinical.read'
  );

  perform pg_temp.as_user(clinician_a);
  perform pg_temp.record_test(
    'RBAC_clinician_clinical_write',
    public.has_permission('clinical.write') = true,
    'clinician may write clinical'
  );
  perform pg_temp.record_test(
    'RBAC_clinician_patients_write',
    public.has_permission('patients.write') = true,
    'clinician may write patients'
  );

  perform pg_temp.as_user(admin_a);
  perform pg_temp.record_test(
    'RBAC_admin_all_staff_manage',
    public.has_permission('staff.manage') = true,
    'admin manages staff'
  );

  perform pg_temp.as_user(admin_b);
  got_org := public.current_organization_id();
  select count(*) into cnt from public.patients where organization_id = org_a;
  perform pg_temp.as_bootstrap();
  perform pg_temp.record_test(
    'A_admin_b_org_is_b',
    got_org = org_b,
    format('got %s', got_org)
  );
  perform pg_temp.record_test(
    'A_admin_b_cannot_list_org_a_patients',
    cnt = 0,
    format('saw %s', cnt)
  );

  -- =========================================================================
  -- G. service_role bypasses RLS — must never ship in the browser
  -- =========================================================================
  perform pg_temp.as_service();
  select count(*) into cnt from public.patients;
  perform pg_temp.as_bootstrap();
  perform pg_temp.record_test(
    'G_service_role_bypasses_rls',
    cnt >= 2,
    format('service_role saw %s patients — MUST NOT ship in browser bundle', cnt)
  );
end;
$$;

\echo '=== A1 security test results ==='
select test_name, passed, coalesce(detail, '') as detail
from a1_test_results
order by test_name;

do $$
declare
  failed integer;
  total integer;
begin
  select count(*) filter (where passed = false), count(*)
  into failed, total
  from a1_test_results;

  if failed > 0 then
    raise exception 'A1 security tests failed: % of % assertion(s)', failed, total;
  end if;
  raise notice 'All A1 security tests passed (% assertions)', total;
end;
$$;
