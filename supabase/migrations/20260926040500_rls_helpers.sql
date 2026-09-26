-- A1: RLS helpers (SECURITY DEFINER)
-- Organization and permissions are derived from staff_profiles + staff_roles.
-- Never trust organization_id or role sent by the client.

-- ---------------------------------------------------------------------------
-- current_organization_id()
-- ---------------------------------------------------------------------------

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select sp.organization_id
  from public.staff_profiles sp
  where sp.id = (select auth.uid())
    and sp.is_active = true;
$$;

comment on function public.current_organization_id() is
  'A1: organization_id of the authenticated active staff profile. SECURITY DEFINER; fixed search_path=public. Returns null for anon/inactive/missing profile.';

revoke all on function public.current_organization_id() from public;
grant execute on function public.current_organization_id() to authenticated;

-- ---------------------------------------------------------------------------
-- has_permission(code)
-- ---------------------------------------------------------------------------

create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_profiles sp
    join public.staff_roles sr on sr.staff_id = sp.id
    join public.role_permissions rp on rp.role_id = sr.role_id
    join public.permissions p on p.id = rp.permission_id
    where sp.id = (select auth.uid())
      and sp.is_active = true
      and p.code = p_permission
  );
$$;

comment on function public.has_permission(text) is
  'A1: true when auth.uid() has an active staff profile with a role granting the permission code. SECURITY DEFINER; search_path=public.';

revoke all on function public.has_permission(text) from public;
grant execute on function public.has_permission(text) to authenticated;

-- ---------------------------------------------------------------------------
-- staff_has_role(code) — convenience for policies/tests
-- ---------------------------------------------------------------------------

create or replace function public.staff_has_role(p_role_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_profiles sp
    join public.staff_roles sr on sr.staff_id = sp.id
    join public.roles r on r.id = sr.role_id
    where sp.id = (select auth.uid())
      and sp.is_active = true
      and r.code = p_role_code
  );
$$;

comment on function public.staff_has_role(text) is
  'A1: true when auth.uid() has the given role code via staff_roles. Prefer has_permission for capability checks.';

revoke all on function public.staff_has_role(text) from public;
grant execute on function public.staff_has_role(text) to authenticated;
