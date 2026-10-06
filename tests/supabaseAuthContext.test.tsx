import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseAuthProvider, useSupabaseAuth } from '../src/context/SupabaseAuthContext'
import { resetSupabaseClientForTests } from '../src/lib/supabase'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

interface Listener {
  (event: string, session: unknown): void
}

const harness = vi.hoisted(() => {
  const state: { listener: Listener | null; insideListener: boolean } = {
    listener: null,
    insideListener: false,
  }
  return state
})

function queryResult(data: unknown) {
  const response = { data, error: null }
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

const auth = {
  getSession: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChange: vi.fn((callback: Listener) => {
    harness.listener = (event, session) => {
      harness.insideListener = true
      callback(event, session)
      harness.insideListener = false
    }
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  }),
}

const unsubscribe = vi.fn()

function installClient() {
  auth.onAuthStateChange.mockImplementation((callback: Listener) => {
    harness.listener = (event, session) => {
      harness.insideListener = true
      callback(event, session)
      harness.insideListener = false
    }
    return { data: { subscription: { unsubscribe } } }
  })
  const from = vi.fn((table: string) => {
    if (harness.insideListener) {
      throw new Error('database call inside auth listener')
    }
    if (table === 'profiles') {
      return queryResult({ id: 'user-1', full_name: 'Evelyn', email: 'evelyn@clinica.com' })
    }
    return queryResult([
      {
        id: 'membership-a',
        clinic_id: 'clinic-a',
        user_id: 'user-1',
        role: 'admin',
        is_active: true,
      },
      {
        id: 'membership-b',
        clinic_id: 'clinic-b',
        user_id: 'user-1',
        role: 'manager',
        is_active: true,
      },
    ])
  })
  vi.mocked(createClient).mockReturnValue({ auth, from } as unknown as SupabaseClient)
  return { from }
}

function Probe() {
  const state = useSupabaseAuth()
  const [signInCode, setSignInCode] = useState('')
  return (
    <div>
      <p data-testid="enabled">{String(state.enabled)}</p>
      <p data-testid="configured">{String(state.configured)}</p>
      <p data-testid="loading">{String(state.loading)}</p>
      <p data-testid="user">{state.user?.id ?? ''}</p>
      <p data-testid="clinic">{state.activeClinicId ?? ''}</p>
      <p data-testid="error">{state.error?.code ?? ''}</p>
      <p data-testid="memberships">{state.memberships.length}</p>
      <p data-testid="signin-result">{signInCode}</p>
      <button type="button" onClick={() => state.selectActiveClinic('clinic-b')}>
        select
      </button>
      <button type="button" onClick={() => state.selectActiveClinic('clinic-other')}>
        select-other
      </button>
      <button
        type="button"
        onClick={() => {
          void state.signInWithPassword('evelyn@clinica.com', 'super-secret-password').then((result) => {
            setSignInCode(result.ok ? 'ok' : result.error.code)
          })
        }}
      >
        signin
      </button>
      <button type="button" onClick={() => void state.signOut()}>
        signout
      </button>
    </div>
  )
}

const session = {
  access_token: 'token',
  user: { id: 'user-1', email: 'evelyn@clinica.com' },
}

describe('SupabaseAuthProvider', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    resetSupabaseClientForTests()
    harness.listener = null
    harness.insideListener = false
    unsubscribe.mockClear()
    auth.getSession.mockReset()
    auth.signInWithPassword.mockReset()
    auth.signOut.mockReset()
    auth.onAuthStateChange.mockClear()
    installClient()
  })

  afterEach(() => {
    cleanup()
  })

  it('keeps the provider inert when the feature flag is off', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    render(
      <SupabaseAuthProvider>
        <Probe />
      </SupabaseAuthProvider>,
    )

    expect(screen.getByTestId('enabled').textContent).toBe('false')
    expect(screen.getByTestId('configured').textContent).toBe('false')
    expect(screen.getByTestId('loading').textContent).toBe('false')
    expect(createClient).not.toHaveBeenCalled()
    expect(auth.onAuthStateChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'signin' }))
    await waitFor(() => expect(screen.getByTestId('signin-result').textContent).toBe('disabled'))
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('starts signed out after the initial session read', async () => {
    vi.stubEnv('VITE_SUPABASE_AUTH_ENABLED', 'true')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    let resolveSession: (value: unknown) => void = () => {}
    auth.getSession.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve
      }),
    )

    render(
      <SupabaseAuthProvider>
        <Probe />
      </SupabaseAuthProvider>,
    )

    expect(screen.getByTestId('loading').textContent).toBe('true')
    resolveSession({ data: { session: null }, error: null })
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
    expect(screen.getByTestId('user').textContent).toBe('')
    expect(auth.onAuthStateChange).toHaveBeenCalledTimes(1)
  })

  it('loads one clinic from the session without calling the database inside the listener', async () => {
    vi.stubEnv('VITE_SUPABASE_AUTH_ENABLED', 'true')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    const { from } = installClient()
    from.mockImplementation((table: string) => {
      if (harness.insideListener) throw new Error('database call inside auth listener')
      if (table === 'profiles') {
        return queryResult({ id: 'user-1', full_name: 'Evelyn', email: 'evelyn@clinica.com' })
      }
      return queryResult([
        {
          id: 'membership-a',
          clinic_id: 'clinic-a',
          user_id: 'user-1',
          role: 'professional',
          is_active: true,
        },
      ])
    })
    auth.getSession.mockResolvedValue({ data: { session }, error: null })

    render(
      <SupabaseAuthProvider>
        <Probe />
      </SupabaseAuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('clinic').textContent).toBe('clinic-a'))
    expect(screen.getByTestId('error').textContent).toBe('')
    expect(from).toHaveBeenCalledWith('profiles')
    expect(from).toHaveBeenCalledWith('clinic_memberships')

    harness.listener?.('TOKEN_REFRESHED', session)
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(from.mock.calls.filter((call) => call[0] === 'profiles')).toHaveLength(1)
  })

  it('requires a local clinic choice when several memberships are active', async () => {
    vi.stubEnv('VITE_SUPABASE_AUTH_ENABLED', 'true')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    auth.getSession.mockResolvedValue({ data: { session }, error: null })

    render(
      <SupabaseAuthProvider>
        <Probe />
      </SupabaseAuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('multiple_memberships'))
    expect(screen.getByTestId('clinic').textContent).toBe('')
    expect(screen.getByTestId('memberships').textContent).toBe('2')

    fireEvent.click(screen.getByRole('button', { name: 'select-other' }))
    expect(screen.getByTestId('clinic').textContent).toBe('')

    fireEvent.click(screen.getByRole('button', { name: 'select' }))
    expect(screen.getByTestId('clinic').textContent).toBe('clinic-b')
    expect(screen.getByTestId('error').textContent).toBe('')
  })

  it('signs in and signs out through the auth client', async () => {
    vi.stubEnv('VITE_SUPABASE_AUTH_ENABLED', 'true')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    auth.signInWithPassword.mockImplementation(async () => {
      harness.listener?.('SIGNED_IN', session)
      return { data: { session, user: session.user }, error: null }
    })
    auth.signOut.mockImplementation(async () => {
      harness.listener?.('SIGNED_OUT', null)
      return { error: null }
    })

    render(
      <SupabaseAuthProvider>
        <Probe />
      </SupabaseAuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))

    fireEvent.click(screen.getByRole('button', { name: 'signin' }))
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('user-1'))
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'evelyn@clinica.com',
      password: 'super-secret-password',
    })
    expect(document.body.textContent).not.toContain('super-secret-password')

    fireEvent.click(screen.getByRole('button', { name: 'signout' }))
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe(''))
    expect(auth.signOut).toHaveBeenCalledTimes(1)
  })

  it('removes the auth listener on unmount', async () => {
    vi.stubEnv('VITE_SUPABASE_AUTH_ENABLED', 'true')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    const view = render(
      <SupabaseAuthProvider>
        <Probe />
      </SupabaseAuthProvider>,
    )
    await waitFor(() => expect(auth.onAuthStateChange).toHaveBeenCalledTimes(1))
    view.unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
