-- A2: RLS helper functions
-- All helpers used by policies are SECURITY DEFINER with fixed search_path
-- to avoid RLS recursion when reading clinic_memberships.

create or replace function public.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid();
$$;

comment on function public.current_user_id() is
  'A2: auth.uid() wrapper for policies/tests. SECURITY DEFINER; search_path=public.';

create or replace function public.is_clinic_member(p_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clinic_memberships m
    where m.clinic_id = p_clinic_id
      and m.user_id = auth.uid()
      and m.is_active = true
  );
$$;

comment on function public.is_clinic_member(uuid) is
  'A2: true when auth.uid() has an active membership in the clinic. Bypasses RLS on memberships to avoid recursion.';

create or replace function public.clinic_member_role(p_clinic_id uuid)
returns public.clinic_role
language sql
stable
security definer
set search_path = public
as $$
  select m.role
  from public.clinic_memberships m
  where m.clinic_id = p_clinic_id
    and m.user_id = auth.uid()
    and m.is_active = true
  limit 1;
$$;

comment on function public.clinic_member_role(uuid) is
  'A2: active clinic_role for auth.uid() in the given clinic, or null.';

create or replace function public.has_clinic_role(
  p_clinic_id uuid,
  variadic p_roles public.clinic_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clinic_memberships m
    where m.clinic_id = p_clinic_id
      and m.user_id = auth.uid()
      and m.is_active = true
      and m.role = any (p_roles)
  );
$$;

comment on function public.has_clinic_role(uuid, public.clinic_role[]) is
  'A2: membership role check. Prefer has_clinic_permission for capability gates.';

-- Single source of truth for RBAC capabilities (mirrored in src/lib/auth/permissions.ts).
-- Permission strings use domain.action (e.g. patients.read).
create or replace function public.has_clinic_permission(
  p_clinic_id uuid,
  p_permission text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role public.clinic_role;
begin
  if p_clinic_id is null or p_permission is null or length(trim(p_permission)) = 0 then
    return false;
  end if;

  select m.role into v_role
  from public.clinic_memberships m
  where m.clinic_id = p_clinic_id
    and m.user_id = auth.uid()
    and m.is_active = true
  limit 1;

  if v_role is null then
    return false;
  end if;

  -- OWNER/ADMIN: full clinic access
  if v_role = 'admin' then
    return true;
  end if;

  -- Manager (prepared): operational + admin read; no membership mutations
  if v_role = 'manager' then
    return p_permission not in ('memberships.write', 'clinics.write');
  end if;

  -- Professional (prepared): clinical + patients + appointments
  if v_role = 'professional' then
    return p_permission in (
      'clinics.read',
      'memberships.read',
      'patients.read', 'patients.write',
      'patient_tags.read', 'patient_tags.write',
      'appointments.read', 'appointments.write',
      'treatments.read', 'treatments.write',
      'treatment_sessions.read', 'treatment_sessions.write',
      'clinical_records.read', 'clinical_records.write',
      'documents.read', 'documents.write',
      'photos.read', 'photos.write',
      'products.read',
      'product_batches.read',
      'treatment_product_usages.read', 'treatment_product_usages.write',
      'procedures.read',
      'procedure_templates.read',
      'alerts.read', 'alerts.write',
      'tasks.read', 'tasks.write',
      'secure_links.read'
    );
  end if;

  -- Finance (prepared): commercial focus
  if v_role = 'finance' then
    return p_permission in (
      'clinics.read',
      'memberships.read',
      'patients.read',
      'crm_leads.read',
      'quotes.read', 'quotes.write',
      'products.read', 'products.write',
      'product_batches.read', 'product_batches.write',
      'documents.read',
      'interactions.read'
    );
  end if;

  -- ASSISTANT: operational access (no clinic/membership admin, no audit)
  if v_role = 'assistant' then
    return p_permission in (
      'clinics.read',
      'memberships.read',
      'patients.read', 'patients.write',
      'patient_tags.read', 'patient_tags.write',
      'crm_leads.read', 'crm_leads.write',
      'appointments.read', 'appointments.write',
      'treatments.read', 'treatments.write',
      'treatment_sessions.read', 'treatment_sessions.write',
      'clinical_records.read', 'clinical_records.write',
      'documents.read', 'documents.write',
      'quotes.read', 'quotes.write',
      'products.read', 'products.write',
      'product_batches.read', 'product_batches.write',
      'treatment_product_usages.read', 'treatment_product_usages.write',
      'photos.read', 'photos.write',
      'interactions.read', 'interactions.write',
      'alerts.read', 'alerts.write',
      'tasks.read', 'tasks.write',
      'procedures.read', 'procedures.write',
      'procedure_templates.read', 'procedure_templates.write',
      'secure_links.read', 'secure_links.write'
    );
  end if;

  return false;
end;
$$;

comment on function public.has_clinic_permission(uuid, text) is
  'A2: RBAC capability check from clinic_memberships.role. Frontend can() mirrors this matrix. RLS is the security boundary.';

revoke all on function public.current_user_id() from public;
revoke all on function public.is_clinic_member(uuid) from public;
revoke all on function public.clinic_member_role(uuid) from public;
revoke all on function public.has_clinic_role(uuid, public.clinic_role[]) from public;
revoke all on function public.has_clinic_permission(uuid, text) from public;

grant execute on function public.current_user_id() to authenticated;
grant execute on function public.is_clinic_member(uuid) to authenticated;
grant execute on function public.clinic_member_role(uuid) to authenticated;
grant execute on function public.has_clinic_role(uuid, public.clinic_role[]) to authenticated;
grant execute on function public.has_clinic_permission(uuid, text) to authenticated;
