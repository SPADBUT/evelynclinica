import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetSupabaseClientForTests } from '../src/lib/supabase'
import {
  loadStaffAccess,
  queryCanManagePatients,
  queryHasClinicRole,
  resolveActiveClinic,
  signInWithPassword,
  signOut,
} from '../src/services/supabaseAuthService'
import type { SupabaseClinicMembership } from '../src/types/supabaseAuth'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

const profileRow = {
  id: 'user-1',
  full_name: 'Evelyn',
  email: 'evelyn@clinica.com',
}

function membershipRow(clinicId: string, role: string, isActive = true) {
  return {
    id: `membership-${clinicId}`,
    clinic_id: clinicId,
    user_id: 'user-1',
    role,
    is_active: isActive,
  }
}

function queryResult(data: unknown, error: { message: string } | null = null) {
  const response = { data, error }
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => Promise.resolve(response),
    then: (
      onFulfilled: (value: typeof response) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(response).then(onFulfilled, onRejected),
  }
  return builder
}

function staffClient(options: {
  profile?: unknown
  memberships?: unknown
  profileError?: { message: string } | null
  membershipError?: { message: string } | null
}): SupabaseClient {
  const from = vi.fn((table: string) => {
    if (table === 'profiles') return queryResult(options.profile ?? null, options.profileError ?? null)
    if (table === 'clinic_memberships') {
      return queryResult(options.memberships ?? [], options.membershipError ?? null)
    }
    throw new Error(`unexpected table ${table}`)
  })
  return { from } as unknown as SupabaseClient
}

function membership(clinicId: string, role: SupabaseClinicMembership['role']): SupabaseClinicMembership {
  return {
    id: `membership-${clinicId}`,
    clinicId,
    userId: 'user-1',
    role,
    isActive: true,
  }
}

describe('staff profile and memberships', () => {
  it('maps the signed-in profile', async () => {
    const client = staffClient({
      profile: profileRow,
      memberships: [membershipRow('clinic-a', 'admin')],
    })
    const result = await loadStaffAccess(client, 'user-1')
    expect(result.profile).toEqual({
      id: 'user-1',
      fullName: 'Evelyn',
      email: 'evelyn@clinica.com',
    })
    expect(client.from).toHaveBeenCalledWith('profiles')
  })

  it('reads active memberships for the signed-in user', async () => {
    const client = staffClient({
      profile: profileRow,
      memberships: [membershipRow('clinic-a', 'assistant')],
    })
    const result = await loadStaffAccess(client, 'user-1')
    expect(result.error).toBeNull()
    expect(result.memberships).toEqual([
      {
        id: 'membership-clinic-a',
        clinicId: 'clinic-a',
        userId: 'user-1',
        role: 'assistant',
        isActive: true,
      },
    ])
    expect(client.from).toHaveBeenCalledWith('clinic_memberships')
  })

  it('uses the only active membership as the clinic', () => {
    const resolution = resolveActiveClinic([membership('clinic-a', 'admin')], null)
    expect(resolution.activeClinicId).toBe('clinic-a')
    expect(resolution.error).toBeNull()
  })

  it('keeps multiple memberships unselected until a listed clinic is chosen', () => {
    const memberships = [membership('clinic-a', 'admin'), membership('clinic-b', 'manager')]
    const pending = resolveActiveClinic(memberships, 'clinic-not-mine')
    expect(pending.activeClinicId).toBeNull()
    expect(pending.error?.code).toBe('multiple_memberships')

    const selected = resolveActiveClinic(memberships, 'clinic-b')
    expect(selected.activeClinicId).toBe('clinic-b')
    expect(selected.error).toBeNull()
  })

  it('reports no active membership', async () => {
    const client = staffClient({
      profile: profileRow,
      memberships: [membershipRow('clinic-a', 'paciente', true)],
    })
    const result = await loadStaffAccess(client, 'user-1')
    expect(result.profile?.id).toBe('user-1')
    expect(result.memberships).toEqual([])
    expect(result.error?.code).toBe('no_active_membership')
    expect(resolveActiveClinic(result.memberships, null).error?.code).toBe('no_active_membership')
  })

  it('reports a missing profile without echoing the query error', async () => {
    const client = staffClient({ profile: null, memberships: [] })
    const missing = await loadStaffAccess(client, 'user-1')
    expect(missing.error?.code).toBe('profile_missing')

    const failed = await loadStaffAccess(
      staffClient({
        profileError: { message: 'relation secret_internal exposed' },
        memberships: [],
      }),
      'user-1',
    )
    expect(failed.error?.code).toBe('auth_failed')
    expect(failed.error?.message).not.toContain('secret_internal')
  })

  it('reports a missing session', async () => {
    const result = await loadStaffAccess(staffClient({}), '')
    expect(result.error?.code).toBe('no_session')
  })
})

describe('sign in and sign out', () => {
  const auth = {
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
  }

  beforeEach(() => {
    vi.unstubAllEnvs()
    resetSupabaseClientForTests()
    auth.signInWithPassword.mockReset()
    auth.signOut.mockReset()
    vi.mocked(createClient).mockReset()
    vi.mocked(createClient).mockReturnValue({ auth } as unknown as SupabaseClient)
  })

  it('rejects sign-in while the feature flag is off', async () => {
    const result = await signInWithPassword('evelyn@clinica.com', 'secret')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('disabled')
    expect(createClient).not.toHaveBeenCalled()
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('signs in with a password and does not keep the provider error text', async () => {
    vi.stubEnv('VITE_SUPABASE_AUTH_ENABLED', 'true')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    auth.signInWithPassword.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } }, user: { id: 'user-1' } },
      error: null,
    })

    const result = await signInWithPassword('evelyn@clinica.com', 'secret')
    expect(result).toEqual({ ok: true, userId: 'user-1' })
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'evelyn@clinica.com',
      password: 'secret',
    })
  })

  it('maps invalid credentials to a generic message', async () => {
    vi.stubEnv('VITE_SUPABASE_AUTH_ENABLED', 'true')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    auth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    })

    const result = await signInWithPassword('evelyn@clinica.com', 'wrong')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('invalid_credentials')
      expect(result.error.message).not.toContain('Invalid login credentials')
    }
  })

  it('signs out through the auth client', async () => {
    vi.stubEnv('VITE_SUPABASE_AUTH_ENABLED', 'true')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    auth.signOut.mockResolvedValue({ error: null })
    const result = await signOut()
    expect(result).toEqual({ ok: true })
    expect(auth.signOut).toHaveBeenCalledTimes(1)
  })
})

describe('database role hints', () => {
  it('reads has_clinic_role and can_manage_patients', async () => {
    const rpc = vi.fn(async (fn: string) => ({ data: fn === 'has_clinic_role', error: null }))
    const client = { rpc } as unknown as SupabaseClient
    await expect(queryHasClinicRole(client, 'clinic-a', ['admin'])).resolves.toBe(true)
    await expect(queryCanManagePatients(client, 'clinic-a')).resolves.toBe(false)
    expect(rpc).toHaveBeenCalledWith('has_clinic_role', {
      p_clinic_id: 'clinic-a',
      p_roles: ['admin'],
    })
    expect(rpc).toHaveBeenCalledWith('can_manage_patients', { p_clinic_id: 'clinic-a' })
  })
})
