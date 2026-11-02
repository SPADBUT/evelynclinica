import type { V3TenantStatus } from '../types/v3Tenant'

/** Entry for an authorized Supabase staff session. `/` stays the V2 panel. */
export const V3_STAFF_HOME = '/v3/patients'

/**
 * Staff shell access for the existing V2 screens.
 * Ready means the tenant layer already resolved an active membership.
 * That flag is not a credential and it does not grant database access.
 */
export function isAuthorizedStaff(state: { status: V3TenantStatus }): boolean {
  return state.status === 'authenticated_ready'
}
