import { hasRole } from '../services/supabaseRbac'
import { SUPABASE_CLINIC_ROLES, type SupabaseAuthState } from '../types/supabaseAuth'

/**
 * Staff shell access for the V2 screens.
 * Active clinic comes from the membership list already loaded.
 * It is not a credential and it does not grant database access.
 */
export function isAuthorizedStaff(
  state: Pick<SupabaseAuthState, 'profile' | 'memberships' | 'activeClinicId' | 'error'>,
): boolean {
  if (!state.profile || !state.activeClinicId || state.error) return false
  return hasRole(state.memberships, state.activeClinicId, SUPABASE_CLINIC_ROLES)
}
