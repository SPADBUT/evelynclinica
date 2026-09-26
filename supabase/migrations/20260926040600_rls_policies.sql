-- A1: enable RLS + policies
-- Principle:
--   anon → no access to business data
--   authenticated → only own organization_id (from current_organization_id())
--   capabilities → has_permission(...)
--   organization_id on writes must equal current_organization_id() (ignore client spoof)

-- ---------------------------------------------------------------------------
-- Grants: revoke anon; grant authenticated (RLS still applies)
-- ---------------------------------------------------------------------------

revoke all on table public.organizations from anon, public;
revoke all on table public.roles from anon, public;
revoke all on table public.permissions from anon, public;
revoke all on table public.role_permissions from anon, public;
revoke all on table public.staff_profiles from anon, public;
revoke all on table public.staff_roles from anon, public;
revoke all on table public.patients from anon, public;
revoke all on table public.audit_logs from anon, public;

-- service_role: server-side only (BYPASSRLS). NEVER expose this key in the browser.
grant all on table public.organizations to service_role;
grant all on table public.roles to service_role;
grant all on table public.permissions to service_role;
grant all on table public.role_permissions to service_role;
grant all on table public.staff_profiles to service_role;
grant all on table public.staff_roles to service_role;
grant all on table public.patients to service_role;
grant all on table public.audit_logs to service_role;

grant select on table public.organizations to authenticated;
grant update on table public.organizations to authenticated;

grant select on table public.roles to authenticated;
grant select on table public.permissions to authenticated;
grant select on table public.role_permissions to authenticated;

grant select, insert, update on table public.staff_profiles to authenticated;
grant select, insert, delete on table public.staff_roles to authenticated;

grant select, insert, update, delete on table public.patients to authenticated;

grant select, insert on table public.audit_logs to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.staff_roles enable row level security;
alter table public.patients enable row level security;
alter table public.audit_logs enable row level security;

alter table public.organizations force row level security;
alter table public.roles force row level security;
alter table public.permissions force row level security;
alter table public.role_permissions force row level security;
alter table public.staff_profiles force row level security;
alter table public.staff_roles force row level security;
alter table public.patients force row level security;
alter table public.audit_logs force row level security;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------

create policy organizations_select_own
  on public.organizations
  for select
  to authenticated
  using (
    id = public.current_organization_id()
    and public.has_permission('organizations.read')
  );

create policy organizations_update_manage
  on public.organizations
  for update
  to authenticated
  using (
    id = public.current_organization_id()
    and public.has_permission('organizations.manage')
  )
  with check (
    id = public.current_organization_id()
    and public.has_permission('organizations.manage')
  );

-- No INSERT/DELETE for authenticated — org provisioning is ops/service_role.

-- ---------------------------------------------------------------------------
-- roles / permissions / role_permissions (catalog — read only for staff)
-- ---------------------------------------------------------------------------

create policy roles_select_authenticated
  on public.roles
  for select
  to authenticated
  using (public.current_organization_id() is not null);

create policy permissions_select_authenticated
  on public.permissions
  for select
  to authenticated
  using (public.current_organization_id() is not null);

create policy role_permissions_select_authenticated
  on public.role_permissions
  for select
  to authenticated
  using (public.current_organization_id() is not null);

-- ---------------------------------------------------------------------------
-- staff_profiles
-- ---------------------------------------------------------------------------

create policy staff_profiles_select_org
  on public.staff_profiles
  for select
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and (
      id = (select auth.uid())
      or public.has_permission('staff.read')
    )
  );

-- Inserts: only staff.manage; organization_id MUST equal current org (no spoof).
create policy staff_profiles_insert_manage
  on public.staff_profiles
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_permission('staff.manage')
  );

create policy staff_profiles_update_manage
  on public.staff_profiles
  for update
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_permission('staff.manage')
  )
  with check (
    organization_id = public.current_organization_id()
    and public.has_permission('staff.manage')
  );

-- ---------------------------------------------------------------------------
-- staff_roles
-- ---------------------------------------------------------------------------

create policy staff_roles_select_org
  on public.staff_roles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.staff_profiles sp
      where sp.id = staff_roles.staff_id
        and sp.organization_id = public.current_organization_id()
    )
    and (
      staff_id = (select auth.uid())
      or public.has_permission('staff.read')
    )
  );

create policy staff_roles_insert_manage
  on public.staff_roles
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.staff_profiles sp
      where sp.id = staff_roles.staff_id
        and sp.organization_id = public.current_organization_id()
    )
    and public.has_permission('staff.manage')
  );

create policy staff_roles_delete_manage
  on public.staff_roles
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.staff_profiles sp
      where sp.id = staff_roles.staff_id
        and sp.organization_id = public.current_organization_id()
    )
    and public.has_permission('staff.manage')
  );

-- ---------------------------------------------------------------------------
-- patients
-- ---------------------------------------------------------------------------

create policy patients_select_org
  on public.patients
  for select
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_permission('patients.read')
  );

create policy patients_insert_org
  on public.patients
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_permission('patients.write')
  );

create policy patients_update_org
  on public.patients
  for update
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_permission('patients.write')
  )
  with check (
    organization_id = public.current_organization_id()
    and public.has_permission('patients.write')
  );

create policy patients_delete_org
  on public.patients
  for delete
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_permission('patients.write')
  );

-- ---------------------------------------------------------------------------
-- audit_logs (append-oriented: select + insert only)
-- ---------------------------------------------------------------------------

create policy audit_logs_select_org
  on public.audit_logs
  for select
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_permission('audit.read')
  );

create policy audit_logs_insert_org
  on public.audit_logs
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_permission('audit.write')
    and (
      actor_user_id is null
      or actor_user_id = (select auth.uid())
    )
  );

-- No UPDATE/DELETE policies → immutable for authenticated clients.
