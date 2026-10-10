import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient } from '../lib/supabase'
import { SupabaseAuthError } from '../lib/supabaseAuthError'
import {
  isSupabaseClinicRole,
  type SupabaseClinicMembership,
  type SupabaseClinicRole,
  type SupabaseStaffProfile,
} from '../types/supabaseAuth'

export interface StaffAccessSnapshot {
  profile: SupabaseStaffProfile | null
  memberships: SupabaseClinicMembership[]
  error: SupabaseAuthError | null
}

export interface ActiveClinicResolution {
  activeClinicId: string | null
  error: SupabaseAuthError | null
}

interface AuthFailureLike {
  code?: string
  message?: string
}

function readProfile(value: unknown): SupabaseStaffProfile | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (typeof row.id !== 'string' || typeof row.full_name !== 'string' || typeof row.email !== 'string') {
    return null
  }
  return { id: row.id, fullName: row.full_name, email: row.email }
}

function readMembership(value: unknown): SupabaseClinicMembership | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (
    typeof row.id !== 'string' ||
    typeof row.clinic_id !== 'string' ||
    typeof row.user_id !== 'string' ||
    row.is_active !== true ||
    !isSupabaseClinicRole(row.role)
  ) {
    return null
  }
  return {
    id: row.id,
    clinicId: row.clinic_id,
    userId: row.user_id,
    role: row.role,
    isActive: true,
  }
}

function readMemberships(value: unknown): SupabaseClinicMembership[] {
  if (!Array.isArray(value)) return []
  return value
    .map((row) => readMembership(row))
    .filter((row): row is SupabaseClinicMembership => row !== null)
    .sort((left, right) => left.clinicId.localeCompare(right.clinicId))
}

/**
 * Reads the signed-in staff profile and active memberships.
 * RLS still applies. This function does not insert profiles, memberships, or clinics.
 */
export async function loadStaffAccess(
  client: SupabaseClient,
  userId: string,
): Promise<StaffAccessSnapshot> {
  if (!userId) {
    return {
      profile: null,
      memberships: [],
      error: new SupabaseAuthError('no_session', 'Sessão inexistente.'),
    }
  }

  const [profileResult, membershipResult] = await Promise.all([
    client.from('profiles').select('id, full_name, email').eq('id', userId).maybeSingle(),
    client
      .from('clinic_memberships')
      .select('id, clinic_id, user_id, role, is_active')
      .eq('user_id', userId)
      .eq('is_active', true),
  ])

  if (profileResult.error || membershipResult.error) {
    return {
      profile: null,
      memberships: [],
      error: new SupabaseAuthError('auth_failed', 'Não foi possível carregar o perfil.'),
    }
  }

  const profile = readProfile(profileResult.data)
  if (!profile) {
    return {
      profile: null,
      memberships: [],
      error: new SupabaseAuthError('profile_missing', 'Perfil não encontrado.'),
    }
  }

  const memberships = readMemberships(membershipResult.data)
  if (memberships.length === 0) {
    return {
      profile,
      memberships: [],
      error: new SupabaseAuthError('no_active_membership', 'Nenhuma membership ativa.'),
    }
  }

  return { profile, memberships, error: null }
}

/**
 * Picks a clinic for the screen from memberships already loaded.
 * A selected id is used only when it belongs to that list.
 * One active membership is used automatically.
 * The result must not be sent to the database as proof of access.
 */
export function resolveActiveClinic(
  memberships: readonly SupabaseClinicMembership[],
  selectedClinicId: string | null,
): ActiveClinicResolution {
  if (memberships.length === 0) {
    return {
      activeClinicId: null,
      error: new SupabaseAuthError('no_active_membership', 'Nenhuma membership ativa.'),
    }
  }

  if (memberships.length === 1) {
    return { activeClinicId: memberships[0].clinicId, error: null }
  }

  const selected = selectedClinicId
    ? memberships.find((membership) => membership.clinicId === selectedClinicId)
    : undefined
  if (!selected) {
    return {
      activeClinicId: null,
      error: new SupabaseAuthError(
        'multiple_memberships',
        'Há mais de uma clínica ativa. Selecione uma clínica.',
      ),
    }
  }

  return { activeClinicId: selected.clinicId, error: null }
}

function isInvalidCredentials(error: AuthFailureLike): boolean {
  const code = error.code?.toLowerCase() ?? ''
  if (code === 'invalid_credentials' || code === 'invalid_grant') return true
  const message = error.message?.toLowerCase() ?? ''
  return message.includes('invalid login credentials')
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<{ ok: true; userId: string } | { ok: false; error: SupabaseAuthError }> {
  let client: SupabaseClient
  try {
    client = getSupabaseClient()
  } catch (error) {
    if (error instanceof SupabaseAuthError) return { ok: false, error }
    return { ok: false, error: new SupabaseAuthError('auth_failed', 'Não foi possível autenticar.') }
  }

  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) {
    return {
      ok: false,
      error: isInvalidCredentials(error)
        ? new SupabaseAuthError('invalid_credentials', 'E-mail ou senha inválidos.')
        : new SupabaseAuthError('auth_failed', 'Não foi possível autenticar.'),
    }
  }

  if (!data.session || !data.user) {
    return { ok: false, error: new SupabaseAuthError('no_session', 'Sessão inexistente.') }
  }

  return { ok: true, userId: data.user.id }
}

export async function signOut(): Promise<{ ok: true } | { ok: false; error: SupabaseAuthError }> {
  let client: SupabaseClient
  try {
    client = getSupabaseClient()
  } catch (error) {
    if (error instanceof SupabaseAuthError) return { ok: false, error }
    return {
      ok: false,
      error: new SupabaseAuthError('auth_failed', 'Não foi possível encerrar a sessão.'),
    }
  }

  const { error } = await client.auth.signOut()
  if (error) {
    return { ok: false, error: new SupabaseAuthError('auth_failed', 'Não foi possível encerrar a sessão.') }
  }
  return { ok: true }
}

async function readBooleanRpc(
  client: SupabaseClient,
  fn: 'has_clinic_role' | 'can_manage_patients',
  args: Record<string, unknown>,
  failureMessage: string,
): Promise<boolean> {
  const { data, error } = await client.rpc(fn, args)
  if (error || typeof data !== 'boolean') {
    throw new SupabaseAuthError('auth_failed', failureMessage)
  }
  return data
}

/** Asks the database. The boolean is a hint for the screen; RLS still enforces the query. */
export function queryHasClinicRole(
  client: SupabaseClient,
  clinicId: string,
  roles: readonly SupabaseClinicRole[],
): Promise<boolean> {
  return readBooleanRpc(
    client,
    'has_clinic_role',
    { p_clinic_id: clinicId, p_roles: [...roles] },
    'Não foi possível consultar o papel.',
  )
}

/** Asks public.can_manage_patients. The boolean is a hint for the screen. */
export function queryCanManagePatients(client: SupabaseClient, clinicId: string): Promise<boolean> {
  return readBooleanRpc(
    client,
    'can_manage_patients',
    { p_clinic_id: clinicId },
    'Não foi possível consultar o acesso a pacientes.',
  )
}
