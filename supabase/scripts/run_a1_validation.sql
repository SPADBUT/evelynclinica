-- A1 security validation harness (PostgreSQL 16)
-- Stubs minimal Supabase Auth pieces so migrations + RLS can be tested without Docker.
-- Run via: supabase/scripts/run_a1_validation.sh

\set ON_ERROR_STOP on

drop schema if exists public cascade;
drop schema if exists auth cascade;
create schema auth;
create schema public;

create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

-- Session subject: tests set request.jwt.claim.sub
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end;
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to authenticated, service_role;

\echo '=== Applying canonical A1 migrations ==='
\i /workspace/supabase/migrations/20260926040000_extensions_and_helpers.sql
\i /workspace/supabase/migrations/20260926040100_organizations.sql
\i /workspace/supabase/migrations/20260926040200_rbac_identity.sql
\i /workspace/supabase/migrations/20260926040300_patients_and_audit.sql
\i /workspace/supabase/migrations/20260926040400_seed_rbac.sql
\i /workspace/supabase/migrations/20260926040500_rls_helpers.sql
\i /workspace/supabase/migrations/20260926040600_rls_policies.sql

\echo '=== Seed orgs + staff fixtures ==='

do $$
declare
  org_a uuid;
  org_b uuid;
  admin_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  clinician_a uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  assistant_a uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  admin_b uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  role_admin uuid;
  role_clinician uuid;
  role_assistant uuid;
begin
  insert into public.organizations (name, slug)
  values ('Clinica A', 'clinica-a')
  returning id into org_a;

  insert into public.organizations (name, slug)
  values ('Clinica B', 'clinica-b')
  returning id into org_b;

  insert into auth.users (id, email) values
    (admin_a, 'admin-a@example.com'),
    (clinician_a, 'clinician-a@example.com'),
    (assistant_a, 'assistant-a@example.com'),
    (admin_b, 'admin-b@example.com');

  insert into public.staff_profiles (id, organization_id, full_name, email) values
    (admin_a, org_a, 'Admin A', 'admin-a@example.com'),
    (clinician_a, org_a, 'Clinician A', 'clinician-a@example.com'),
    (assistant_a, org_a, 'Assistant A', 'assistant-a@example.com'),
    (admin_b, org_b, 'Admin B', 'admin-b@example.com');

  select id into role_admin from public.roles where code = 'admin';
  select id into role_clinician from public.roles where code = 'clinician';
  select id into role_assistant from public.roles where code = 'assistant';

  insert into public.staff_roles (staff_id, role_id) values
    (admin_a, role_admin),
    (clinician_a, role_clinician),
    (assistant_a, role_assistant),
    (admin_b, role_admin);

  insert into public.patients (organization_id, full_name) values
    (org_a, 'Patient Org A'),
    (org_b, 'Patient Org B');
end;
$$;

\i /workspace/supabase/scripts/a1_security_tests.sql

\echo '=== A1 validation complete ==='
