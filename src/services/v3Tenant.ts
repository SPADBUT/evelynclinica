import type { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseAuthError } from '../lib/supabaseAuthError'
import { canAccessClinicalRecords, canManagePatients, hasRole as membershipHasRole } from './supabaseRbac'
import { resolveActiveClinic } from './supabaseAuthService'
import type { SupabaseClinicMembership, SupabaseClinicRole, SupabaseStaffProfile } from '../types/supabaseAuth'
import type { V3Clinic, V3Permission, V3TenantSnapshot, V3TenantStatus } from '../types/v3Tenant'

export interface TenantDerivationInput {
  sessionReady: boolean
  userId: string | null
  authError: SupabaseAuthError | null
  profile: SupabaseStaffProfile | null
  memberships: readonly SupabaseClinicMembership[]
  staffReady: boolean
  staffError: SupabaseAuthError | null
  selectedClinicId: string | null
  clinic: V3Clinic | null
  clinicError: SupabaseAuthError | null
  clinicSettled: boolean
}

const emptyIdentity = {
  profile: null,
  memberships: [] as readonly SupabaseClinicMembership[],
  activeClinicId: null,
  activeClinic: null,
  activeRole: null,
  error: null,
}

function snapshot(
  status: V3TenantStatus,
  userId: string | null,
  identity: Partial<V3TenantSnapshot> = {},
): V3TenantSnapshot {
  return {
    status,
    userId,
    ...emptyIdentity,
    ...identity,
  }
}

/**
 * Decides the tenant screen state from data already loaded.
 * A clinic id survives only when it belongs to an active membership.
 */
export function deriveTenantSnapshot(input: TenantDerivationInput): V3TenantSnapshot {
  if (!input.sessionReady || (input.userId !== null && !input.staffReady)) {
    return snapshot('loading', input.userId)
  }

  if (!input.userId) {
    if (input.authError) return snapshot('error', null, { error: input.authError })
    return snapshot('unauthenticated', null)
  }

  if (input.staffError && input.staffError.code !== 'no_active_membership') {
    return snapshot('error', input.userId, { profile: input.profile, error: input.staffError })
  }

  if (input.staffError?.code === 'no_active_membership' || input.memberships.length === 0) {
    return snapshot('authenticated_without_membership', input.userId, {
      profile: input.profile,
      error:
        input.staffError ??
        new SupabaseAuthError('no_active_membership', 'Nenhuma membership ativa.'),
    })
  }

  const resolution = resolveActiveClinic(input.memberships, input.selectedClinicId)
  const membership = resolution.activeClinicId
    ? input.memberships.find(
        (item) =>
          item.isActive && item.userId === input.userId && item.clinicId === resolution.activeClinicId,
      )
    : undefined

  if (!resolution.activeClinicId || !membership) {
    return snapshot('authenticated_needs_clinic_selection', input.userId, {
      profile: input.profile,
      memberships: input.memberships,
      error: resolution.error,
    })
  }

  if (!input.clinicSettled) {
    return snapshot('loading', input.userId, {
      profile: input.profile,
      memberships: input.memberships,
    })
  }

  if (input.clinicError || !input.clinic || input.clinic.id !== membership.clinicId) {
    return snapshot('error', input.userId, {
      profile: input.profile,
      memberships: input.memberships,
      error: input.clinicError ?? new SupabaseAuthError('auth_failed', 'Clínica ativa não encontrada.'),
    })
  }

  return snapshot('authenticated_ready', input.userId, {
    profile: input.profile,
    memberships: input.memberships,
    activeClinicId: membership.clinicId,
    activeClinic: input.clinic,
    activeRole: membership.role,
    error: null,
  })
}

/** Clinic id used to load public.clinics. Null until a membership can name it. */
export function tenantClinicTarget(
  userId: string | null,
  staffReady: boolean,
  staffError: SupabaseAuthError | null,
  memberships: readonly SupabaseClinicMembership[],
  selectedClinicId: string | null,
): string | null {
  if (!userId || !staffReady || staffError) return null
  return resolveActiveClinic(memberships, selectedClinicId).activeClinicId
}

function readClinic(value: unknown): V3Clinic | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (
    typeof row.id !== 'string' ||
    typeof row.name !== 'string' ||
    typeof row.slug !== 'string' ||
    typeof row.timezone !== 'string' ||
    row.id.length === 0 ||
    row.name.length === 0 ||
    row.slug.length === 0 ||
    row.timezone.length === 0
  ) {
    return null
  }
  return { id: row.id, name: row.name, slug: row.slug, timezone: row.timezone }
}

/**
 * Reads one clinic row. Does not insert or update clinics, profiles, or memberships.
 * A row whose id differs from the requested id is refused.
 */
export async function loadClinic(
  client: SupabaseClient,
  clinicId: string,
): Promise<{ clinic: V3Clinic | null; error: SupabaseAuthError | null }> {
  const { data, error } = await client
    .from('clinics')
    .select('id, name, slug, timezone')
    .eq('id', clinicId)
    .maybeSingle()

  if (error) {
    return { clinic: null, error: new SupabaseAuthError('auth_failed', 'Não foi possível carregar a clínica.') }
  }

  const clinic = readClinic(data)
  if (!clinic || clinic.id !== clinicId) {
    return { clinic: null, error: new SupabaseAuthError('auth_failed', 'Clínica ativa não encontrada.') }
  }

  return { clinic, error: null }
}

/** Display hint for the active membership. False until the tenant is ready. */
export function tenantHasRole(state: V3TenantSnapshot, role: SupabaseClinicRole): boolean {
  if (state.status !== 'authenticated_ready' || !state.activeClinicId) return false
  return membershipHasRole(state.memberships, state.activeClinicId, [role])
}

/** Display hint for the active membership. False until the tenant is ready. */
export function tenantHasAnyRole(
  state: V3TenantSnapshot,
  roles: readonly SupabaseClinicRole[],
): boolean {
  if (state.status !== 'authenticated_ready' || !state.activeClinicId) return false
  return membershipHasRole(state.memberships, state.activeClinicId, roles)
}

/**
 * Display hint for the active clinic.
 * patients.manage excludes finance.
 * clinical.records allows admin, manager, and professional only.
 * RLS still enforces the query.
 */
export function tenantCan(state: V3TenantSnapshot, permission: V3Permission): boolean {
  if (state.status !== 'authenticated_ready' || !state.activeClinicId) return false
  if (permission === 'patients.manage') return canManagePatients(state.memberships, state.activeClinicId)
  if (permission === 'clinical.records') return canAccessClinicalRecords(state.memberships, state.activeClinicId)
  return false
}
