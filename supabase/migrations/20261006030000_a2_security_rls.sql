-- A2: security helpers, clinic_id immutability, and RLS.
-- Additive only. Does not alter A1 tables, constraints, indexes, or functions.
-- RLS is enabled and not forced. Table grants are unchanged.
-- Assumes roles authenticated and service_role already exist (Supabase).

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER, active memberships only)
-- ---------------------------------------------------------------------------

create or replace function public.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid();
$$;

comment on function public.current_user_id() is
  'Authenticated user id (auth.uid()). Matches profiles.id and clinic_memberships.user_id.';

create or replace function public.has_clinic_role(
  p_clinic_id uuid,
  p_roles public.clinic_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinic_memberships m
    where m.clinic_id = p_clinic_id
      and m.user_id = public.current_user_id()
      and m.is_active = true
      and m.role = any (p_roles)
  );
$$;

comment on function public.has_clinic_role(uuid, public.clinic_role[]) is
  'True when the current user has an active membership in p_clinic_id with one of p_roles.';

create or replace function public.is_clinic_member(p_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinic_memberships m
    where m.clinic_id = p_clinic_id
      and m.user_id = public.current_user_id()
      and m.is_active = true
  );
$$;

comment on function public.is_clinic_member(uuid) is
  'True when the current user has an active membership in p_clinic_id.';

create or replace function public.accessible_clinic_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.clinic_id
  from public.clinic_memberships m
  where m.user_id = public.current_user_id()
    and m.is_active = true;
$$;

comment on function public.accessible_clinic_ids() is
  'Clinic ids where the current user has an active membership.';

create or replace function public.is_staff_in_any_clinic()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.accessible_clinic_ids()
  );
$$;

comment on function public.is_staff_in_any_clinic() is
  'True when the current user has at least one active clinic membership.';

create or replace function public.can_manage_patients(p_clinic_id uuid)
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

comment on function public.can_manage_patients(uuid) is
  'True when the current user may read or write patients in p_clinic_id. Finance is excluded. Hard delete is not included.';

create or replace function public.shares_clinic_with(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinic_memberships mine
    join public.clinic_memberships theirs
      on theirs.clinic_id = mine.clinic_id
    where mine.user_id = public.current_user_id()
      and mine.is_active = true
      and theirs.user_id = p_profile_id
      and theirs.is_active = true
  );
$$;

comment on function public.shares_clinic_with(uuid) is
  'True when the current user and p_profile_id both have an active membership in the same clinic.';

revoke all on function public.current_user_id() from public;
revoke all on function public.has_clinic_role(uuid, public.clinic_role[]) from public;
revoke all on function public.is_clinic_member(uuid) from public;
revoke all on function public.accessible_clinic_ids() from public;
revoke all on function public.is_staff_in_any_clinic() from public;
revoke all on function public.can_manage_patients(uuid) from public;
revoke all on function public.shares_clinic_with(uuid) from public;

grant execute on function public.current_user_id() to authenticated;
grant execute on function public.has_clinic_role(uuid, public.clinic_role[]) to authenticated;
grant execute on function public.is_clinic_member(uuid) to authenticated;
grant execute on function public.accessible_clinic_ids() to authenticated;
grant execute on function public.is_staff_in_any_clinic() to authenticated;
grant execute on function public.can_manage_patients(uuid) to authenticated;
grant execute on function public.shares_clinic_with(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- clinic_id immutability (SECURITY INVOKER)
-- ---------------------------------------------------------------------------

create or replace function public.prevent_clinic_id_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.clinic_id is distinct from old.clinic_id then
    raise exception 'clinic_id is immutable';
  end if;
  return new;
end;
$$;

comment on function public.prevent_clinic_id_mutation() is
  'Rejects UPDATE that changes clinic_id, including writers that bypass RLS.';

revoke all on function public.prevent_clinic_id_mutation() from public;
grant execute on function public.prevent_clinic_id_mutation() to authenticated, service_role;

create trigger clinic_memberships_prevent_clinic_id_mutation
  before update of clinic_id on public.clinic_memberships
  for each row execute function public.prevent_clinic_id_mutation();

create trigger patients_prevent_clinic_id_mutation
  before update of clinic_id on public.patients
  for each row execute function public.prevent_clinic_id_mutation();

create trigger patient_tags_prevent_clinic_id_mutation
  before update of clinic_id on public.patient_tags
  for each row execute function public.prevent_clinic_id_mutation();

create trigger crm_leads_prevent_clinic_id_mutation
  before update of clinic_id on public.crm_leads
  for each row execute function public.prevent_clinic_id_mutation();

create trigger procedures_prevent_clinic_id_mutation
  before update of clinic_id on public.procedures
  for each row execute function public.prevent_clinic_id_mutation();

create trigger procedure_templates_prevent_clinic_id_mutation
  before update of clinic_id on public.procedure_templates
  for each row execute function public.prevent_clinic_id_mutation();

create trigger treatments_prevent_clinic_id_mutation
  before update of clinic_id on public.treatments
  for each row execute function public.prevent_clinic_id_mutation();

create trigger treatment_sessions_prevent_clinic_id_mutation
  before update of clinic_id on public.treatment_sessions
  for each row execute function public.prevent_clinic_id_mutation();

create trigger appointments_prevent_clinic_id_mutation
  before update of clinic_id on public.appointments
  for each row execute function public.prevent_clinic_id_mutation();

create trigger clinical_records_prevent_clinic_id_mutation
  before update of clinic_id on public.clinical_records
  for each row execute function public.prevent_clinic_id_mutation();

create trigger clinical_record_versions_prevent_clinic_id_mutation
  before update of clinic_id on public.clinical_record_versions
  for each row execute function public.prevent_clinic_id_mutation();

create trigger documents_prevent_clinic_id_mutation
  before update of clinic_id on public.documents
  for each row execute function public.prevent_clinic_id_mutation();

create trigger document_versions_prevent_clinic_id_mutation
  before update of clinic_id on public.document_versions
  for each row execute function public.prevent_clinic_id_mutation();

create trigger document_signatures_prevent_clinic_id_mutation
  before update of clinic_id on public.document_signatures
  for each row execute function public.prevent_clinic_id_mutation();

create trigger quotes_prevent_clinic_id_mutation
  before update of clinic_id on public.quotes
  for each row execute function public.prevent_clinic_id_mutation();

create trigger quote_items_prevent_clinic_id_mutation
  before update of clinic_id on public.quote_items
  for each row execute function public.prevent_clinic_id_mutation();

create trigger products_prevent_clinic_id_mutation
  before update of clinic_id on public.products
  for each row execute function public.prevent_clinic_id_mutation();

create trigger product_batches_prevent_clinic_id_mutation
  before update of clinic_id on public.product_batches
  for each row execute function public.prevent_clinic_id_mutation();

create trigger treatment_product_usages_prevent_clinic_id_mutation
  before update of clinic_id on public.treatment_product_usages
  for each row execute function public.prevent_clinic_id_mutation();

create trigger photos_prevent_clinic_id_mutation
  before update of clinic_id on public.photos
  for each row execute function public.prevent_clinic_id_mutation();

create trigger interactions_prevent_clinic_id_mutation
  before update of clinic_id on public.interactions
  for each row execute function public.prevent_clinic_id_mutation();

create trigger alerts_prevent_clinic_id_mutation
  before update of clinic_id on public.alerts
  for each row execute function public.prevent_clinic_id_mutation();

create trigger tasks_prevent_clinic_id_mutation
  before update of clinic_id on public.tasks
  for each row execute function public.prevent_clinic_id_mutation();

create trigger secure_links_prevent_clinic_id_mutation
  before update of clinic_id on public.secure_links
  for each row execute function public.prevent_clinic_id_mutation();

create trigger audit_logs_prevent_clinic_id_mutation
  before update of clinic_id on public.audit_logs
  for each row execute function public.prevent_clinic_id_mutation();

-- ---------------------------------------------------------------------------
-- RLS enabled, not forced
-- ---------------------------------------------------------------------------

alter table public.clinics enable row level security;
alter table public.profiles enable row level security;
alter table public.clinic_memberships enable row level security;
alter table public.patients enable row level security;
alter table public.patient_tags enable row level security;
alter table public.crm_leads enable row level security;
alter table public.procedures enable row level security;
alter table public.procedure_templates enable row level security;
alter table public.treatments enable row level security;
alter table public.treatment_sessions enable row level security;
alter table public.appointments enable row level security;
alter table public.clinical_records enable row level security;
alter table public.clinical_record_versions enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.document_signatures enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.products enable row level security;
alter table public.product_batches enable row level security;
alter table public.treatment_product_usages enable row level security;
alter table public.photos enable row level security;
alter table public.interactions enable row level security;
alter table public.alerts enable row level security;
alter table public.tasks enable row level security;
alter table public.secure_links enable row level security;
alter table public.audit_logs enable row level security;

-- ---------------------------------------------------------------------------
-- Policies (authenticated only). Future-module tables stay policy-free.
-- ---------------------------------------------------------------------------

create policy clinics_select_member
  on public.clinics
  for select
  to authenticated
  using (public.is_clinic_member(id));

create policy clinics_update_admin
  on public.clinics
  for update
  to authenticated
  using (public.has_clinic_role(id, array['admin']::public.clinic_role[]))
  with check (public.has_clinic_role(id, array['admin']::public.clinic_role[]));

create policy profiles_select_self_or_same_clinic
  on public.profiles
  for select
  to authenticated
  using (
    id = public.current_user_id()
    or public.shares_clinic_with(id)
  );

create policy profiles_update_self
  on public.profiles
  for update
  to authenticated
  using (id = public.current_user_id())
  with check (id = public.current_user_id());

create policy clinic_memberships_select_self_or_admin
  on public.clinic_memberships
  for select
  to authenticated
  using (
    user_id = public.current_user_id()
    or public.has_clinic_role(clinic_id, array['admin']::public.clinic_role[])
  );

create policy patients_select_managers
  on public.patients
  for select
  to authenticated
  using (public.can_manage_patients(clinic_id));

create policy patients_insert_managers
  on public.patients
  for insert
  to authenticated
  with check (public.can_manage_patients(clinic_id));

create policy patients_update_managers
  on public.patients
  for update
  to authenticated
  using (public.can_manage_patients(clinic_id))
  with check (public.can_manage_patients(clinic_id));

create policy patients_delete_admin
  on public.patients
  for delete
  to authenticated
  using (public.has_clinic_role(clinic_id, array['admin']::public.clinic_role[]));

create policy patient_tags_select_managers
  on public.patient_tags
  for select
  to authenticated
  using (public.can_manage_patients(clinic_id));

create policy patient_tags_insert_managers
  on public.patient_tags
  for insert
  to authenticated
  with check (public.can_manage_patients(clinic_id));

create policy patient_tags_update_managers
  on public.patient_tags
  for update
  to authenticated
  using (public.can_manage_patients(clinic_id))
  with check (public.can_manage_patients(clinic_id));

create policy patient_tags_delete_admin
  on public.patient_tags
  for delete
  to authenticated
  using (public.has_clinic_role(clinic_id, array['admin']::public.clinic_role[]));
