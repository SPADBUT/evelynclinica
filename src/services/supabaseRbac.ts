import type { SupabaseClinicMembership, SupabaseClinicRole } from '../types/supabaseAuth'

/**
 * Roles that public.can_manage_patients allows.
 * Finance is excluded. Hard delete stays admin-only in RLS.
 * These helpers are display hints. They do not grant access.
 */
const PATIENT_MANAGER_ROLES = ['admin', 'assistant', 'professional', 'manager'] as const

export function hasRole(
  memberships: readonly SupabaseClinicMembership[],
  clinicId: string,
  roles: readonly SupabaseClinicRole[],
): boolean {
  return memberships.some(
    (membership) =>
      membership.isActive && membership.clinicId === clinicId && roles.includes(membership.role),
  )
}

export function canManagePatients(
  memberships: readonly SupabaseClinicMembership[],
  clinicId: string,
): boolean {
  return hasRole(memberships, clinicId, PATIENT_MANAGER_ROLES)
}
