import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseAuthProvider } from '../src/context/SupabaseAuthContext'
import { V3TenantProvider, useV3Tenant } from '../src/context/V3TenantContext'
import { resetSupabaseClientForTests } from '../src/lib/supabase'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

interface Listener {
  (event: string, session: unknown): void
}

const harness = vi.hoisted(() => ({ listener: null as Listener | null }))

const db = vi.hoisted(() => ({
  profile: null as unknown,
  memberships: [] as unknown[],
  clinicError: false,
}))

function queryResult(data: unknown) {
  const response = { data, error: null }
  const builder = {
    select: () => builder,
    eq: () => builder,
    insert: () => {
      throw new Error('provisioning is not allowed')
    },
    update: () => {
      throw new Error('provisioning is not allowed')
    },
    upsert: () => {
      throw new Error('provisioning is not allowed')
    },
    delete: () => {
      throw new Error('provisioning is not allowed')
    },
    maybeSingle: () => Promise.resolve(response),
    then: (onFulfilled: (value: typeof response) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(response).then(onFulfilled, onRejected),
  }
  return builder
}

function clinicResult() {
  let clinicId = ''
  const builder = {
    select: () => builder,
    eq: (column: string, value: string) => {
      if (column === 'id') clinicId = value
      return builder
    },
    maybeSingle: () => {
      if (db.clinicError) return Promise.resolve({ data: null, error: { message: 'hidden' } })
      return Promise.resolve({
        data: clinicId
          ? { id: clinicId, name: `Clinic ${clinicId}`, slug: clinicId, timezone: 'America/Manaus' }
          : null,
        error: null,
      })
    },
  }
  return builder
}

const auth = {
  getSession: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChange: vi.fn((callback: Listener) => {
    harness.listener = callback
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  }),
}

const session = {
  access_token: 'token',
  user: { id: 'user-1', email: 'staff@example.com' },
}

function membership(clinicId: string, role: string, isActive = true) {
  return {
    id: `membership-${clinicId}`,
    clinic_id: clinicId,
    user_id: 'user-1',
    role,
    is_active: isActive,
  }
}

function installClient() {
  auth.onAuthStateChange.mockImplementation((callback: Listener) => {
    harness.listener = callback
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
  const from = vi.fn((table: string) => {
    if (table === 'profiles') return queryResult(db.profile)
    if (table === 'clinic_memberships') return queryResult(db.memberships)
    if (table === 'clinics') return clinicResult()
    throw new Error(`unexpected table ${table}`)
  })
  vi.mocked(createClient).mockReturnValue({ auth, from } as unknown as SupabaseClient)
  return from
}

function Probe() {
  const tenant = useV3Tenant()
  const [selectReason, setSelectReason] = useState('')
  return (
    <div>
      <p data-testid="status">{tenant.status}</p>
      <p data-testid="user">{tenant.userId ?? ''}</p>
      <p data-testid="clinic">{tenant.activeClinicId ?? ''}</p>
      <p data-testid="clinic-name">{tenant.activeClinic?.name ?? ''}</p>
      <p data-testid="role">{tenant.activeRole ?? ''}</p>
      <p data-testid="memberships">{tenant.memberships.map((item) => item.clinicId).join(',')}</p>
      <p data-testid="error">{tenant.error?.code ?? ''}</p>
      <p data-testid="admin">{String(tenant.hasRole('admin'))}</p>
      <p data-testid="finance">{String(tenant.hasRole('finance'))}</p>
      <p data-testid="any">{String(tenant.hasAnyRole(['admin', 'manager']))}</p>
      <p data-testid="can-patients">{String(tenant.can('patients.manage'))}</p>
      <p data-testid="select-reason">{selectReason}</p>
      <button
        type="button"
        onClick={() => {
          const result = tenant.selectClinic('clinic-a')
          setSelectReason(result.ok ? 'ok' : result.reason)
        }}
      >
        select-a
      </button>
      <button
        type="button"
        onClick={() => {
          const result = tenant.selectClinic('clinic-b')
          setSelectReason(result.ok ? 'ok' : result.reason)
        }}
      >
        select-b
      </button>
      <button
        type="button"
        onClick={() => {
          const result = tenant.selectClinic('clinic-outside')
          setSelectReason(result.ok ? 'ok' : result.reason)
        }}
      >
        select-outside
      </button>
    </div>
  )
}

function renderTenant() {
  return render(
    <SupabaseAuthProvider>
      <V3TenantProvider>
        <Probe />
      </V3TenantProvider>
    </SupabaseAuthProvider>,
  )
}

describe('V3 tenant context', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubEnv('VITE_SUPABASE_AUTH_ENABLED', 'true')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    resetSupabaseClientForTests()
    harness.listener = null
    db.profile = { id: 'user-1', full_name: 'Staff', email: 'staff@example.com' }
    db.memberships = []
    db.clinicError = false
    auth.getSession.mockReset()
    auth.signOut.mockReset()
    auth.onAuthStateChange.mockClear()
    installClient()
    auth.signOut.mockImplementation(async () => {
      harness.listener?.('SIGNED_OUT', null)
      return { error: null }
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
    localStorage.clear()
  })

  it('stays unauthenticated without a session and does not store the clinic', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    renderTenant()
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'))
    expect(screen.getByTestId('clinic').textContent).toBe('')
    expect(screen.getByTestId('admin').textContent).toBe('false')
    expect(screen.getByTestId('can-patients').textContent).toBe('false')
    expect(localStorage.length).toBe(0)
  })

  it('marks an authenticated user without an active membership', async () => {
    db.memberships = [membership('clinic-old', 'admin', false)]
    auth.getSession.mockResolvedValue({ data: { session }, error: null })
    renderTenant()
    await waitFor(() =>
      expect(screen.getByTestId('status').textContent).toBe('authenticated_without_membership'),
    )
    expect(screen.getByTestId('error').textContent).toBe('no_active_membership')
    expect(screen.getByTestId('clinic').textContent).toBe('')
    expect(screen.getByTestId('memberships').textContent).toBe('')
    expect(screen.getByTestId('can-patients').textContent).toBe('false')
  })

  it('selects the only active membership and ignores an inactive one', async () => {
    db.memberships = [membership('clinic-old', 'finance', false), membership('clinic-a', 'professional', true)]
    auth.getSession.mockResolvedValue({ data: { session }, error: null })
    renderTenant()
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated_ready'))
    expect(screen.getByTestId('clinic').textContent).toBe('clinic-a')
    expect(screen.getByTestId('clinic-name').textContent).toBe('Clinic clinic-a')
    expect(screen.getByTestId('role').textContent).toBe('professional')
    expect(screen.getByTestId('memberships').textContent).toBe('clinic-a')
    expect(screen.getByTestId('admin').textContent).toBe('false')
    expect(screen.getByTestId('can-patients').textContent).toBe('true')
    expect(localStorage.length).toBe(0)
  })

  it('requires an explicit clinic, rejects an outside id, then switches roles', async () => {
    db.memberships = [membership('clinic-b', 'finance'), membership('clinic-a', 'admin')]
    auth.getSession.mockResolvedValue({ data: { session }, error: null })
    renderTenant()

    await waitFor(() =>
      expect(screen.getByTestId('status').textContent).toBe('authenticated_needs_clinic_selection'),
    )
    expect(screen.getByTestId('clinic').textContent).toBe('')
    expect(screen.getByTestId('role').textContent).toBe('')
    expect(screen.getByTestId('error').textContent).toBe('multiple_memberships')

    fireEvent.click(screen.getByRole('button', { name: 'select-outside' }))
    expect(screen.getByTestId('select-reason').textContent).toBe('unknown_clinic')
    expect(screen.getByTestId('clinic').textContent).toBe('')
    expect(screen.getByTestId('status').textContent).toBe('authenticated_needs_clinic_selection')

    fireEvent.click(screen.getByRole('button', { name: 'select-a' }))
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated_ready'))
    expect(screen.getByTestId('clinic').textContent).toBe('clinic-a')
    expect(screen.getByTestId('role').textContent).toBe('admin')
    expect(screen.getByTestId('admin').textContent).toBe('true')
    expect(screen.getByTestId('finance').textContent).toBe('false')
    expect(screen.getByTestId('any').textContent).toBe('true')
    expect(screen.getByTestId('can-patients').textContent).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'select-b' }))
    await waitFor(() => expect(screen.getByTestId('role').textContent).toBe('finance'))
    expect(screen.getByTestId('clinic').textContent).toBe('clinic-b')
    expect(screen.getByTestId('clinic-name').textContent).toBe('Clinic clinic-b')
    expect(screen.getByTestId('admin').textContent).toBe('false')
    expect(screen.getByTestId('finance').textContent).toBe('true')
    expect(screen.getByTestId('can-patients').textContent).toBe('false')
    expect(screen.getByTestId('memberships').textContent).not.toContain('clinic-outside')
  })

  it('clears the tenant on logout and rebuilds it from the session on the next mount', async () => {
    db.memberships = [membership('clinic-a', 'manager')]
    auth.getSession.mockResolvedValue({ data: { session }, error: null })
    const first = renderTenant()
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated_ready'))
    expect(screen.getByTestId('role').textContent).toBe('manager')

    harness.listener?.('SIGNED_OUT', null)
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'))
    expect(screen.getByTestId('user').textContent).toBe('')
    expect(screen.getByTestId('clinic').textContent).toBe('')
    expect(screen.getByTestId('role').textContent).toBe('')
    expect(screen.getByTestId('memberships').textContent).toBe('')
    expect(screen.getByTestId('can-patients').textContent).toBe('false')

    first.unmount()
    resetSupabaseClientForTests()
    installClient()
    auth.getSession.mockResolvedValue({ data: { session }, error: null })
    renderTenant()
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated_ready'))
    expect(screen.getByTestId('clinic').textContent).toBe('clinic-a')
    expect(screen.getByTestId('role').textContent).toBe('manager')
    expect(screen.getByTestId('clinic-name').textContent).toBe('Clinic clinic-a')
  })

  it('asks for a clinic again after refresh when several memberships are active', async () => {
    db.memberships = [membership('clinic-a', 'admin'), membership('clinic-b', 'assistant')]
    auth.getSession.mockResolvedValue({ data: { session }, error: null })
    const first = renderTenant()
    await waitFor(() =>
      expect(screen.getByTestId('status').textContent).toBe('authenticated_needs_clinic_selection'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'select-b' }))
    await waitFor(() => expect(screen.getByTestId('role').textContent).toBe('assistant'))

    first.unmount()
    resetSupabaseClientForTests()
    installClient()
    auth.getSession.mockResolvedValue({ data: { session }, error: null })
    renderTenant()
    await waitFor(() =>
      expect(screen.getByTestId('status').textContent).toBe('authenticated_needs_clinic_selection'),
    )
    expect(screen.getByTestId('clinic').textContent).toBe('')
    expect(screen.getByTestId('role').textContent).toBe('')
  })

  it('does not persist tenant identity or hardcode a clinic in the V3 layer', () => {
    const files = [
      'src/context/V3TenantContext.tsx',
      'src/services/v3Tenant.ts',
      'src/types/v3Tenant.ts',
      'src/context/SupabaseAuthContext.tsx',
    ]
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      expect(source, file).not.toContain('localStorage')
      expect(source.toLowerCase(), file).not.toContain('service_role')
      expect(source, file).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
      expect(source.toLowerCase(), file).not.toContain('evelyn')
    }
  })
})
