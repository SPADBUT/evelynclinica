import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseAuthProvider } from '../src/context/SupabaseAuthContext'
import { V3TenantProvider } from '../src/context/V3TenantContext'
import { resetSupabaseClientForTests } from '../src/lib/supabase'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

interface Listener {
  (event: string, session: unknown): void
}

const harness = vi.hoisted(() => {
  const state: { listener: Listener | null } = { listener: null }
  return state
})

const db = vi.hoisted(() => ({
  profile: null as unknown,
  memberships: [] as unknown[],
}))

function clinicResult() {
  let clinicId = ''
  const builder = {
    select: () => builder,
    eq: (column: string, value: string) => {
      if (column === 'id') clinicId = value
      return builder
    },
    insert: () => {
      throw new Error('provisioning is not allowed')
    },
    upsert: () => {
      throw new Error('provisioning is not allowed')
    },
    update: () => {
      throw new Error('provisioning is not allowed')
    },
    delete: () => {
      throw new Error('provisioning is not allowed')
    },
    maybeSingle: () =>
      Promise.resolve({
        data: clinicId
          ? {
              id: clinicId,
              name: `Clinic ${clinicId}`,
              slug: clinicId,
              timezone: 'America/Sao_Paulo',
            }
          : null,
        error: null,
      }),
  }
  return builder
}

function queryResult(data: unknown) {
  const response = { data, error: null }
  const builder = {
    select: () => builder,
    eq: () => builder,
    insert: () => {
      throw new Error('provisioning is not allowed')
    },
    upsert: () => {
      throw new Error('provisioning is not allowed')
    },
    update: () => {
      throw new Error('provisioning is not allowed')
    },
    delete: () => {
      throw new Error('provisioning is not allowed')
    },
    maybeSingle: () => Promise.resolve(response),
    then: (
      onFulfilled: (value: typeof response) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(response).then(onFulfilled, onRejected),
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

function staffProfile() {
  db.profile = { id: 'user-1', full_name: 'Checkpoint Staff', email: 'staff@example.com' }
}

function oneMembership() {
  db.memberships = [
    {
      id: 'membership-a',
      clinic_id: 'clinic-a',
      user_id: 'user-1',
      role: 'admin',
      is_active: true,
    },
  ]
}

let App: typeof import('../src/App').default

function renderApp() {
  return render(
    <SupabaseAuthProvider>
      <V3TenantProvider>
        <App />
      </V3TenantProvider>
    </SupabaseAuthProvider>,
  )
}

async function submitLogin(email: string, password: string) {
  fireEvent.change(screen.getByPlaceholderText('seu@email.com'), { target: { value: email } })
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
}

describe('staff login when Supabase Auth is enabled', () => {
  beforeAll(async () => {
    vi.stubEnv('VITE_SUPABASE_AUTH_ENABLED', 'true')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    App = (await import('../src/App')).default
  })

  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState({}, '', '/')
    resetSupabaseClientForTests()
    harness.listener = null
    db.profile = null
    db.memberships = []
    auth.getSession.mockReset()
    auth.signInWithPassword.mockReset()
    auth.signOut.mockReset()
    auth.onAuthStateChange.mockClear()
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    installClient()
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('uses Supabase Auth for staff and opens the V2 shell after one active membership', async () => {
    staffProfile()
    oneMembership()
    auth.signInWithPassword.mockImplementation(async () => {
      harness.listener?.('SIGNED_IN', session)
      return { data: { session, user: session.user }, error: null }
    })

    renderApp()
    expect(await screen.findByText('Clínica Estética · V2')).toBeTruthy()

    await submitLogin('staff@example.com', 'staff-secret')
    expect(await screen.findByText('Bom atendimento, Evelyn')).toBeTruthy()
    expect(screen.getByText('Checkpoint Staff')).toBeTruthy()
    expect(screen.getByText('admin')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Prontuários' })).toBeTruthy()
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'staff@example.com',
      password: 'staff-secret',
    })
    expect(localStorage.getItem('evelyn-clinic-session-v2')).toBeNull()
    expect(document.body.textContent).not.toContain('staff-secret')
    expect(JSON.stringify(vi.mocked(createClient).mock.calls)).not.toMatch(/service_role/i)
    expect(createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'anon-key',
      expect.objectContaining({
        auth: expect.objectContaining({ storageKey: 'evelyn-supabase-auth' }),
      }),
    )
  })

  it('keeps invalid credentials on the login screen', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    })

    renderApp()
    await screen.findByRole('button', { name: 'Entrar' })
    await submitLogin('staff@example.com', 'wrong-password')

    expect(await screen.findByText('E-mail ou senha inválidos.')).toBeTruthy()
    expect(document.body.textContent).not.toContain('Invalid login credentials')
    expect(screen.queryByText('Bom atendimento, Evelyn')).toBeNull()
    expect(screen.queryByText('Nenhuma membership ativa.')).toBeNull()
  })

  it('denies an authenticated user without an active membership and does not open the shell', async () => {
    staffProfile()
    db.memberships = []
    auth.signInWithPassword.mockImplementation(async () => {
      harness.listener?.('SIGNED_IN', session)
      return { data: { session, user: session.user }, error: null }
    })
    auth.signOut.mockImplementation(async () => {
      harness.listener?.('SIGNED_OUT', null)
      return { error: null }
    })

    renderApp()
    await screen.findByRole('button', { name: 'Entrar' })
    await submitLogin('staff@example.com', 'staff-secret')

    expect(await screen.findByText('Nenhuma membership ativa.')).toBeTruthy()
    expect(screen.queryByText('Bom atendimento, Evelyn')).toBeNull()
    expect(screen.queryByRole('link', { name: 'CRM' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByText('Nenhuma membership ativa.')).toBeNull())
  })

  it('asks for a clinic when several memberships are active, then enters only the selected one', async () => {
    staffProfile()
    db.memberships = [
      {
        id: 'membership-b',
        clinic_id: 'clinic-b',
        user_id: 'user-1',
        role: 'manager',
        is_active: true,
      },
      {
        id: 'membership-a',
        clinic_id: 'clinic-a',
        user_id: 'user-1',
        role: 'admin',
        is_active: true,
      },
    ]
    auth.signInWithPassword.mockImplementation(async () => {
      harness.listener?.('SIGNED_IN', session)
      return { data: { session, user: session.user }, error: null }
    })

    renderApp()
    await screen.findByRole('button', { name: 'Entrar' })
    await submitLogin('staff@example.com', 'staff-secret')

    expect(await screen.findByText('Há mais de uma clínica ativa. Selecione uma clínica.')).toBeTruthy()
    expect(screen.queryByText('Bom atendimento, Evelyn')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /manager/i }))
    expect(await screen.findByText('Bom atendimento, Evelyn')).toBeTruthy()
    expect(screen.getByText('Checkpoint Staff')).toBeTruthy()
    expect(screen.getByText('manager')).toBeTruthy()
  })

  it('recovers the staff session from getSession and signs out of Supabase', async () => {
    staffProfile()
    oneMembership()
    auth.getSession.mockResolvedValue({ data: { session }, error: null })
    auth.signOut.mockImplementation(async () => {
      harness.listener?.('SIGNED_OUT', null)
      return { error: null }
    })

    const first = renderApp()
    expect(await screen.findByText('Checkpoint Staff')).toBeTruthy()
    expect(screen.getByText('Bom atendimento, Evelyn')).toBeTruthy()
    expect(auth.signInWithPassword).not.toHaveBeenCalled()

    first.unmount()
    resetSupabaseClientForTests()
    installClient()

    renderApp()
    expect(await screen.findByText('Checkpoint Staff')).toBeTruthy()
    expect(auth.signInWithPassword).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeTruthy()
    expect(screen.queryByText('Bom atendimento, Evelyn')).toBeNull()
  })

  it('keeps the patient portal on the V2 login and ignores a leftover V2 staff session', async () => {
    auth.signInWithPassword.mockRejectedValue(new Error('patient login must stay on V2'))

    renderApp()
    await screen.findByRole('button', { name: 'Entrar' })
    await submitLogin('juliana.ferreira@email.com', 'paciente123')

    expect(await screen.findByText('Portal da paciente')).toBeTruthy()
    expect(screen.getByText('Juliana Ferreira')).toBeTruthy()
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
    expect(screen.queryByText('Bom atendimento, Evelyn')).toBeNull()

    cleanup()
    localStorage.clear()
    window.history.replaceState({}, '', '/')
    localStorage.setItem(
      'evelyn-clinic-session-v2',
      JSON.stringify({
        id: 'v2-admin',
        name: 'Evelyn Preto Silva',
        email: 'evelyn@clinica.com',
        role: 'admin',
      }),
    )

    renderApp()
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeTruthy()
    expect(screen.queryByText('Bom atendimento, Evelyn')).toBeNull()
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
  })
})
