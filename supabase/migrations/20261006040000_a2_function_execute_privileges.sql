-- A2 corrective: restrict EXECUTE on security helpers.
-- Supabase default privileges grant EXECUTE to anon, authenticated, and
-- service_role when a function is created. REVOKE FROM PUBLIC does not
-- remove those direct grants. This migration only adjusts EXECUTE.
-- The function owner retains EXECUTE. RLS, policies, triggers, and
-- function bodies are unchanged.

-- ---------------------------------------------------------------------------
-- Helpers: authenticated only
-- ---------------------------------------------------------------------------

revoke execute on function public.current_user_id() from public;
revoke execute on function public.current_user_id() from anon;
revoke execute on function public.current_user_id() from service_role;
grant execute on function public.current_user_id() to authenticated;

revoke execute on function public.is_clinic_member(uuid) from public;
revoke execute on function public.is_clinic_member(uuid) from anon;
revoke execute on function public.is_clinic_member(uuid) from service_role;
grant execute on function public.is_clinic_member(uuid) to authenticated;

revoke execute on function public.has_clinic_role(uuid, public.clinic_role[]) from public;
revoke execute on function public.has_clinic_role(uuid, public.clinic_role[]) from anon;
revoke execute on function public.has_clinic_role(uuid, public.clinic_role[]) from service_role;
grant execute on function public.has_clinic_role(uuid, public.clinic_role[]) to authenticated;

revoke execute on function public.accessible_clinic_ids() from public;
revoke execute on function public.accessible_clinic_ids() from anon;
revoke execute on function public.accessible_clinic_ids() from service_role;
grant execute on function public.accessible_clinic_ids() to authenticated;

revoke execute on function public.is_staff_in_any_clinic() from public;
revoke execute on function public.is_staff_in_any_clinic() from anon;
revoke execute on function public.is_staff_in_any_clinic() from service_role;
grant execute on function public.is_staff_in_any_clinic() to authenticated;

revoke execute on function public.can_manage_patients(uuid) from public;
revoke execute on function public.can_manage_patients(uuid) from anon;
revoke execute on function public.can_manage_patients(uuid) from service_role;
grant execute on function public.can_manage_patients(uuid) to authenticated;

revoke execute on function public.shares_clinic_with(uuid) from public;
revoke execute on function public.shares_clinic_with(uuid) from anon;
revoke execute on function public.shares_clinic_with(uuid) from service_role;
grant execute on function public.shares_clinic_with(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Trigger function: authenticated and service_role
-- ---------------------------------------------------------------------------

revoke execute on function public.prevent_clinic_id_mutation() from public;
revoke execute on function public.prevent_clinic_id_mutation() from anon;
grant execute on function public.prevent_clinic_id_mutation() to authenticated, service_role;
