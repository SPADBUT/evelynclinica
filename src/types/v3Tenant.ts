import type { SupabaseAuthError } from '../lib/supabaseAuthError'
import type { SupabaseClinicMembership, SupabaseClinicRole, SupabaseStaffProfile } from './supabaseAuth'

/**
 * UI permission checked against the active membership.
 * This is not a business permission matrix and it does not grant access.
 * RLS remains authoritative.
 */
export const V3_PERMISSIONS = ['patients.manage'] as const

export type V3Permission = (typeof V3_PERMISSIONS)[number]

export type V3TenantStatus =
  | 'loading'
  | 'unauthenticated'
  | 'authenticated_without_membership'
  | 'authenticated_needs_clinic_selection'
  | 'authenticated_ready'
  | 'error'

/** Clinic row already stored in public.clinics. The id is not an authorization proof. */
export interface V3Clinic {
  id: string
  name: string
  slug: string
  timezone: string
}

export type SelectClinicResult = { ok: true } | { ok: false; reason: 'unknown_clinic' }

/**
 * Staff identity for future V3 modules.
 * activeClinicId is chosen in memory for UX and query composition.
 * It is not an authorization mechanism.
 */
export interface V3TenantSnapshot {
  status: V3TenantStatus
  userId: string | null
  profile: SupabaseStaffProfile | null
  memberships: readonly SupabaseClinicMembership[]
  activeClinicId: string | null
  activeClinic: V3Clinic | null
  activeRole: SupabaseClinicRole | null
  error: SupabaseAuthError | null
}
