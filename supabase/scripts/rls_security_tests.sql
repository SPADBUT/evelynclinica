-- A2 RLS security tests (cross-clinic + RBAC)
--
-- Prerequisites (real Supabase local stack + Docker):
--   npx supabase start
--   npx supabase db reset
--   npm run db:test:rls
--
-- Requires real auth schema from local Supabase. Does not use fake stubs outside auth.users.
-- Entire run is transactional and rolls back.

begin;

do $$
declare
  clinic_a uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  clinic_b uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
  user_a_admin uuid := '11111111-1111-4111-8111-111111111111';
  user_a_assistant uuid := '22222222-2222-4222-8222-222222222222';
  user_b_admin uuid := '33333333-3333-4333-8333-333333333333';
  user_orphan uuid := '44444444-4444-4444-8444-444444444444';
  patient_a uuid := 'a0000000-0000-4000-8000-000000000001';
  patient_b uuid := 'b0000000-0000-4000-8000-000000000001';
  clinical_b uuid := 'c0000000-0000-4000-8000-000000000001';
  document_b uuid := 'd0000000-0000-4000-8000-000000000001';
  quote_b uuid := 'e0000000-0000-4000-8000-000000000001';
  product_b uuid := 'f0000000-0000-4000-8000-000000000001';
  batch_b uuid := 'f0000000-0000-4000-8000-000000000002';
  v_id uuid;
  v_count integer;
  v_failed boolean;
begin
  -- Seed as current role (expected: postgres / supabase_admin — bypasses RLS)
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values
    (user_a_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'admin-a@test.local', crypt('password-a', gen_salt('bf')), timezone('utc', now()),
     '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Admin A"}'::jsonb,
     timezone('utc', now()), timezone('utc', now())),
    (user_a_assistant, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'assistant-a@test.local', crypt('password-a', gen_salt('bf')), timezone('utc', now()),
     '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Assistant A"}'::jsonb,
     timezone('utc', now()), timezone('utc', now())),
    (user_b_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'admin-b@test.local', crypt('password-b', gen_salt('bf')), timezone('utc', now()),
     '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Admin B"}'::jsonb,
     timezone('utc', now()), timezone('utc', now())),
    (user_orphan, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'orphan@test.local', crypt('password-o', gen_salt('bf')), timezone('utc', now()),
     '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Orphan User"}'::jsonb,
     timezone('utc', now()), timezone('utc', now()))
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, email) values
    (user_a_admin, 'Admin A', 'admin-a@test.local'),
    (user_a_assistant, 'Assistant A', 'assistant-a@test.local'),
    (user_b_admin, 'Admin B', 'admin-b@test.local'),
    (user_orphan, 'Orphan User', 'orphan@test.local')
  on conflict (id) do nothing;

  insert into public.clinics (id, name, slug) values
    (clinic_a, 'Clinic A', 'clinic-a'),
    (clinic_b, 'Clinic B', 'clinic-b')
  on conflict (id) do nothing;

  insert into public.clinic_memberships (clinic_id, user_id, role, is_active) values
    (clinic_a, user_a_admin, 'admin', true),
    (clinic_a, user_a_assistant, 'assistant', true),
    (clinic_b, user_b_admin, 'admin', true)
  on conflict (clinic_id, user_id) do nothing;

  insert into public.patients (id, clinic_id, full_name, email, status) values
    (patient_a, clinic_a, 'Patient A', 'pa@test.local', 'active'),
    (patient_b, clinic_b, 'Patient B', 'pb@test.local', 'active')
  on conflict (id) do nothing;

  insert into public.clinical_records (id, clinic_id, patient_id, status) values
    (clinical_b, clinic_b, patient_b, 'draft')
  on conflict (id) do nothing;

  insert into public.documents (id, clinic_id, patient_id, type, title, status) values
    (document_b, clinic_b, patient_b, 'consent', 'Doc B', 'draft')
  on conflict (id) do nothing;

  insert into public.quotes (id, clinic_id, patient_id, title, status) values
    (quote_b, clinic_b, patient_b, 'Quote B', 'draft')
  on conflict (id) do nothing;

  insert into public.products (id, clinic_id, name, unit) values
    (product_b, clinic_b, 'Product B', 'unit')
  on conflict (id) do nothing;

  insert into public.product_batches (id, clinic_id, product_id, batch_code) values
    (batch_b, clinic_b, product_b, 'LOT-B-1')
  on conflict (id) do nothing;

  -- Impersonate User A admin
  perform set_config('request.jwt.claim.sub', user_a_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  -- TEST 1
  if not exists (select 1 from public.patients where id = patient_a) then
    raise exception 'A2 RLS FAIL: TEST 1 User A reads patient of Clinic A';
  end if;
  raise notice 'A2 RLS PASS: TEST 1';

  -- TEST 2
  if exists (select 1 from public.patients where id = patient_b) then
    raise exception 'A2 RLS FAIL: TEST 2 User A cannot read patient of Clinic B';
  end if;
  raise notice 'A2 RLS PASS: TEST 2';

  -- TEST 3
  v_failed := false;
  begin
    insert into public.patients (clinic_id, full_name, status)
    values (clinic_b, 'Evil Insert', 'active');
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'A2 RLS FAIL: TEST 3 User A cannot insert patient into Clinic B';
  end if;
  raise notice 'A2 RLS PASS: TEST 3';

  -- TEST 4
  update public.patients set full_name = 'Hacked' where id = patient_b;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'A2 RLS FAIL: TEST 4 User A cannot update patient of Clinic B';
  end if;
  raise notice 'A2 RLS PASS: TEST 4';

  -- TEST 5
  if exists (select 1 from public.clinical_records where id = clinical_b) then
    raise exception 'A2 RLS FAIL: TEST 5 User A cannot read clinical_record of Clinic B';
  end if;
  raise notice 'A2 RLS PASS: TEST 5';

  -- TEST 6
  if exists (select 1 from public.documents where id = document_b) then
    raise exception 'A2 RLS FAIL: TEST 6 User A cannot read document of Clinic B';
  end if;
  raise notice 'A2 RLS PASS: TEST 6';

  -- TEST 7
  if exists (select 1 from public.quotes where id = quote_b) then
    raise exception 'A2 RLS FAIL: TEST 7 User A cannot read quote of Clinic B';
  end if;
  raise notice 'A2 RLS PASS: TEST 7';

  -- TEST 8
  if exists (select 1 from public.product_batches where id = batch_b) then
    raise exception 'A2 RLS FAIL: TEST 8 User A cannot read product_batch of Clinic B';
  end if;
  raise notice 'A2 RLS PASS: TEST 8';

  -- TEST 9 orphan
  perform set_config('request.jwt.claim.sub', user_orphan::text, true);
  execute 'set local role authenticated';
  if exists (select 1 from public.patients)
     or exists (select 1 from public.clinics)
     or exists (select 1 from public.quotes) then
    raise exception 'A2 RLS FAIL: TEST 9 orphan cannot access clinic data';
  end if;
  raise notice 'A2 RLS PASS: TEST 9';

  -- TEST 10a admin write
  perform set_config('request.jwt.claim.sub', user_a_admin::text, true);
  execute 'set local role authenticated';
  insert into public.patients (clinic_id, full_name, status)
  values (clinic_a, 'Admin Created', 'active')
  returning id into v_id;
  if v_id is null then
    raise exception 'A2 RLS FAIL: TEST 10a Admin A can insert patient in Clinic A';
  end if;
  raise notice 'A2 RLS PASS: TEST 10a';

  -- TEST 10b assistant write patient
  perform set_config('request.jwt.claim.sub', user_a_assistant::text, true);
  execute 'set local role authenticated';
  insert into public.patients (clinic_id, full_name, status)
  values (clinic_a, 'Assistant Created', 'active')
  returning id into v_id;
  if v_id is null then
    raise exception 'A2 RLS FAIL: TEST 10b Assistant A can insert patient in Clinic A';
  end if;
  raise notice 'A2 RLS PASS: TEST 10b';

  -- TEST 10c assistant cannot write memberships
  v_failed := false;
  begin
    insert into public.clinic_memberships (clinic_id, user_id, role)
    values (clinic_a, user_orphan, 'assistant');
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'A2 RLS FAIL: TEST 10c Assistant A cannot write memberships';
  end if;
  raise notice 'A2 RLS PASS: TEST 10c';

  -- TEST 10d assistant cannot read audit_logs
  if exists (select 1 from public.audit_logs) then
    -- empty table still "passes" not exists; insert as admin first then check
    null;
  end if;
  -- Create an audit row as admin, then verify assistant cannot see it
  perform set_config('request.jwt.claim.sub', user_a_admin::text, true);
  execute 'set local role authenticated';
  insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type)
  values (clinic_a, user_a_admin, 'test', 'patients')
  returning id into v_id;

  perform set_config('request.jwt.claim.sub', user_a_assistant::text, true);
  execute 'set local role authenticated';
  if exists (select 1 from public.audit_logs where id = v_id) then
    raise exception 'A2 RLS FAIL: TEST 10d Assistant A cannot read audit_logs';
  end if;
  raise notice 'A2 RLS PASS: TEST 10d';

  -- TEST 10e/f admin audit insert + no delete
  perform set_config('request.jwt.claim.sub', user_a_admin::text, true);
  execute 'set local role authenticated';
  if not exists (select 1 from public.audit_logs where id = v_id) then
    raise exception 'A2 RLS FAIL: TEST 10e Admin A can read own clinic audit_logs';
  end if;
  raise notice 'A2 RLS PASS: TEST 10e';

  delete from public.audit_logs where id = v_id;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'A2 RLS FAIL: TEST 10f Admin A cannot delete audit_logs';
  end if;
  raise notice 'A2 RLS PASS: TEST 10f';

  raise notice 'A2 RLS security tests completed successfully.';
end;
$$;

rollback;
