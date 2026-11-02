import { StrictMode } from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { StaffRecoveryRequest } from '../src/auth/StaffRecoveryRequest'
import { SupabaseAuthProvider } from '../src/context/SupabaseAuthContext'
import { V3TenantProvider } from '../src/context/V3TenantContext'
import {
  RECOVERY_PENDING_KEY,
  readRecoveryCallback,
  recoveryRedirectTo,
  recoveryUrlWithoutSecrets,
} from '../src/lib/staffRecovery'
import { resetSupabaseClientForTests } from '../src/lib/supabase'
import { V3PasswordRecoveryPage } from '../src/pages/V3PasswordRecoveryPage'
import { resetRecoveryBootstrapForTests } from '../src/services/staffRecoverySession'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

type AuthListener = (event: string, session?: unknown) => void

const listeners = vi.hoisted(() => ({ all: [] as AuthListener[] }))

function emit(event: string, session?: unknown) {
  for (const callback of [...listeners.all]) callback(event, session)
}

interface HeldSession {
  access_token: string
  refresh_token: string
  user: { id: string; email: string }
}

/**
 * Stand-in for the auth storage key. Each mock writes, replaces, or clears
 * this value itself. Assertions read it after the UI settles.
 */
let held: HeldSession | null = null

const db = vi.hoisted(() => ({
  profile: null as Record<string, unknown> | null,
  memberships: [] as Array<Record<string, unknown>>,
  patients: [] as Array<Record<string, unknown>>,
  patientClinicIds: [] as string[],
}))

const auth = {
  getSession: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  updateUser: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  setSession: vi.fn(),
  onAuthStateChange: vi.fn((callback: AuthListener) => {
    listeners.all.push(callback)
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            listeners.all = listeners.all.filter((item) => item !== callback)
          },
        },
      },
    }
  }),
}

const syntheticPatient = {
  id: 'patient-synthetic-1',
  clinic_id: 'clinic-a',
  full_name: 'Lia Sintetica',
  email: 'lia.sintetica@example.com',
  phone: '11988887777',
  cpf: null,
  birth_date: null,
  gender: null,
  address: null,
  allergies: null,
  medications: null,
  notes: null,
  status: 'active',
  deleted_at: null,
  created_at: '2026-03-01T12:00:00.000Z',
  updated_at: '2026-03-02T12:00:00.000Z',
}

function chain(resolve: () => { data: unknown; error: null }) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    is: () => builder,
    order: () => builder,
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
    maybeSingle: () => Promise.resolve(resolve()),
    then: (
      onFulfilled: (value: { data: unknown; error: null }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(resolve()).then(onFulfilled, onRejected),
  }
  return builder
}

function installClient() {
  const from = vi.fn((table: string) => {
    if (table === 'profiles') {
      let userId = ''
      const builder = chain(() => ({
        data: userId === 'user-1' ? db.profile : null,
        error: null,
      }))
      const eq = builder.eq
      builder.eq = (column: string, value: string) => {
        if (column === 'id') userId = value
        return eq()
      }
      return builder
    }
    if (table === 'clinic_memberships') {
      let userId = ''
      const builder = chain(() => ({
        data: userId === 'user-1' ? db.memberships : [],
        error: null,
      }))
      const eq = builder.eq
      builder.eq = (column: string, value: string) => {
        if (column === 'user_id') userId = value
        return eq()
      }
      return builder
    }
    if (table === 'clinics') {
      let clinicId = ''
      const builder = chain(() => ({
        data: clinicId
          ? { id: clinicId, name: `Clinic ${clinicId}`, slug: clinicId, timezone: 'America/Sao_Paulo' }
          : null,
        error: null,
      }))
      const eq = builder.eq
      builder.eq = (column: string, value: string) => {
        if (column === 'id') clinicId = value
        return eq()
      }
      return builder
    }
    if (table === 'patients') {
      let clinicId = ''
      const builder = chain(() => ({
        data: clinicId ? db.patients.map((patient) => ({ ...patient, clinic_id: clinicId })) : db.patients,
        error: null,
      }))
      const eq = builder.eq
      builder.eq = (column: string, value: string) => {
        if (column === 'clinic_id') {
          clinicId = value
          db.patientClinicIds.push(value)
        }
        return eq()
      }
      return builder
    }
    throw new Error(`unexpected table ${table}`)
  })
  vi.mocked(createClient).mockReturnValue({ auth, from } as unknown as SupabaseClient)
}

function renderRecovery() {
  return render(
    <MemoryRouter initialEntries={['/auth/recovery']}>
      <Routes>
        <Route path="/auth/recovery" element={<V3PasswordRecoveryPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

let App: typeof import('../src/App').default

function renderIntegrated() {
  return render(
    <StrictMode>
      <SupabaseAuthProvider>
        <V3TenantProvider>
          <App />
        </V3TenantProvider>
      </SupabaseAuthProvider>
    </StrictMode>,
  )
}

function recoverySession() {
  auth.exchangeCodeForSession.mockImplementation(async () => {
    const session: HeldSession = {
      access_token: 'recovery-access',
      refresh_token: 'recovery-refresh',
      user: { id: 'user-1', email: 'staff@example.com' },
    }
    held = session
    emit('PASSWORD_RECOVERY', session)
    return { data: { session, user: session.user }, error: null }
  })
}

function codeSession(accessToken = 'code-access', refreshToken = 'code-refresh'): HeldSession {
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    user: { id: 'user-2', email: 'other@example.com' },
  }
}

function priorSession(): HeldSession {
  return {
    access_token: 'prior-access',
    refresh_token: 'prior-refresh',
    user: { id: 'user-1', email: 'staff@example.com' },
  }
}

/** Writes the code session into storage and emits SIGNED_IN. Returns when the exchange flag flips. */
function exchangeUnrelatedCode(session: HeldSession = codeSession()) {
  let exchanged = false
  auth.exchangeCodeForSession.mockImplementation(async () => {
    held = session
    exchanged = true
    emit('SIGNED_IN', session)
    return { data: { session, user: session.user }, error: null }
  })
  return {
    failReadsUntilExchange(mode: 'error' | 'throw') {
      auth.getSession.mockImplementation(async () => {
        if (!exchanged) {
          if (mode === 'throw') throw new Error('getSession failed before exchange')
          return { data: { session: null }, error: { message: 'getSession failed before exchange' } }
        }
        return { data: { session: held }, error: null }
      })
    },
  }
}

function requireLocalSignOut() {
  for (const call of auth.signOut.mock.calls) {
    expect(call[0]).toEqual({ scope: 'local' })
  }
}

function expectSecretsHidden() {
  const text = document.body.textContent ?? ''
  for (const secret of [
    'prior-access',
    'prior-refresh',
    'code-access',
    'code-refresh',
    'same-access',
    'rotated-access',
    'rotated-refresh',
    'recovery-access',
    'recovery-refresh',
  ]) {
    expect(text).not.toContain(secret)
  }
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

async function submitNewPassword(value = 'senha-nova-segura') {
  fireEvent.change(await screen.findByLabelText('Nova senha'), { target: { value } })
  fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: 'Definir senha' }))
}

describe('V3 password recovery', () => {
  beforeAll(async () => {
    vi.stubEnv('VITE_SUPABASE_AUTH_ENABLED', 'true')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    App = (await import('../src/App')).default
  })

  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.stubEnv('VITE_SUPABASE_AUTH_ENABLED', 'true')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    resetSupabaseClientForTests()
    resetRecoveryBootstrapForTests()
    window.sessionStorage.clear()
    localStorage.clear()
    held = null
    listeners.all = []
    db.profile = null
    db.memberships = []
    db.patients = []
    db.patientClinicIds = []
    auth.getSession.mockReset()
    auth.exchangeCodeForSession.mockReset()
    auth.updateUser.mockReset()
    auth.resetPasswordForEmail.mockReset()
    auth.signOut.mockReset()
    auth.setSession.mockReset()
    auth.signInWithPassword.mockReset()
    auth.onAuthStateChange.mockClear()
    auth.getSession.mockImplementation(async () => ({ data: { session: held }, error: null }))
    auth.signOut.mockImplementation(async (options?: { scope?: string }) => {
      if (options?.scope !== 'local') {
        throw new Error('recovery cleanup must use scope local')
      }
      held = null
      emit('SIGNED_OUT', null)
      return { error: null }
    })
    auth.setSession.mockImplementation(async (tokens: { access_token: string; refresh_token: string }) => {
      const user =
        tokens.access_token === 'prior-access'
          ? { id: 'user-1', email: 'staff@example.com' }
          : { id: 'user-2', email: 'other@example.com' }
      held = { access_token: tokens.access_token, refresh_token: tokens.refresh_token, user }
      emit('TOKEN_REFRESHED', held)
      return { data: { session: held, user }, error: null }
    })
    installClient()
    window.history.replaceState({}, '', '/auth/recovery')
  })

  afterEach(() => {
    cleanup()
    window.sessionStorage.clear()
    localStorage.clear()
  })

  it('builds the preview callback without a site url override', () => {
    expect(recoveryRedirectTo('https://preview.example')).toBe('https://preview.example/auth/recovery')
    expect(readRecoveryCallback('https://preview.example/auth/recovery?code=fake-code&sb_flow_id=short').flowId).toBeNull()
    expect(readRecoveryCallback('https://preview.example/auth/recovery?code=fake-code&sb_flow_id=flow-1234').flowId).toBe('flow-1234')
    expect(recoveryUrlWithoutSecrets('https://preview.example/auth/recovery?code=fake-code&sb_flow_id=flow-1234#hidden')).toBe(
      '/auth/recovery',
    )
  })

  it('opens the V3 patient list after a completed recovery with one active membership', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code&sb_flow_id=flow-1234&type=recovery')
    staffProfile()
    oneMembership()
    db.patients = [syntheticPatient]
    recoverySession()
    auth.updateUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    renderIntegrated()

    expect(await screen.findByRole('button', { name: 'Definir senha' })).toBeTruthy()
    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1)
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('fake-code', { flowId: 'flow-1234' })
    expect(window.location.search).toBe('')
    expect(window.sessionStorage.getItem(RECOVERY_PENDING_KEY)).toBe('1')

    await submitNewPassword()

    expect(await screen.findByRole('link', { name: 'Lia Sintetica' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Nova paciente' })).toBeTruthy()
    expect(screen.queryByText('Não foi possível listar')).toBeNull()
    expect(screen.queryByText('Bom atendimento, Evelyn')).toBeNull()
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'senha-nova-segura' })
    expect(window.sessionStorage.getItem(RECOVERY_PENDING_KEY)).toBeNull()
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled()
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(auth.setSession).not.toHaveBeenCalled()
    expect(held?.access_token).toBe('recovery-access')
    expect(held?.user.id).toBe('user-1')
    expect(db.patientClinicIds.length).toBeGreaterThan(0)
    expect(db.patientClinicIds.every((clinicId) => clinicId === 'clinic-a')).toBe(true)
  })

  it('returns a completed recovery without a membership to the login denial', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    staffProfile()
    db.patients = [syntheticPatient]
    recoverySession()
    auth.updateUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    renderIntegrated()
    await submitNewPassword()

    expect(await screen.findByText('Nenhuma membership ativa.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Lia Sintetica' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Nova paciente' })).toBeNull()
    expect(db.patientClinicIds).toEqual([])
  })

  it('keeps a completed recovery with several memberships on clinic selection', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
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
    db.patients = [syntheticPatient]
    recoverySession()
    auth.updateUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    renderIntegrated()
    await submitNewPassword()

    expect(await screen.findByText('Há mais de uma clínica ativa. Selecione uma clínica.')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Lia Sintetica' })).toBeNull()
    expect(db.patientClinicIds).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: /manager/i }))

    expect(await screen.findByRole('link', { name: 'Lia Sintetica' })).toBeTruthy()
    expect(db.patientClinicIds.length).toBeGreaterThan(0)
    expect(db.patientClinicIds.every((clinicId) => clinicId === 'clinic-b')).toBe(true)
  })

  it('stays on recovery when the password update fails inside the guarded app', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    staffProfile()
    oneMembership()
    db.patients = [syntheticPatient]
    recoverySession()
    auth.updateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'update failed', code: 'unexpected_failure' },
    })

    renderIntegrated()
    await submitNewPassword()

    expect(await screen.findByText('Não foi possível atualizar a senha.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Definir senha' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Lia Sintetica' })).toBeNull()
    expect(window.sessionStorage.getItem(RECOVERY_PENDING_KEY)).toBe('1')
    expect(db.patientClinicIds).toEqual([])
  })

  it('reports an invalid or expired code without showing the form', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    auth.exchangeCodeForSession.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'expired' },
    })

    renderRecovery()

    expect(await screen.findByText('O link de recuperação expirou ou já foi usado.')).toBeTruthy()
    expect(screen.queryByLabelText('Nova senha')).toBeNull()
    expect(window.location.search).toBe('')
    expect(auth.signOut).not.toHaveBeenCalled()
  })

  it('reports an expired callback from the url without exchanging it', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code&error_code=otp_expired&error_description=expired')

    renderRecovery()

    expect(await screen.findByText('O link de recuperação expirou ou já foi usado.')).toBeTruthy()
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Nova senha')).toBeNull()
    expect(window.location.search).toBe('')
  })

  it('does not treat a recovery type parameter as a session', async () => {
    window.history.replaceState({}, '', '/auth/recovery?type=recovery')

    renderRecovery()

    expect(await screen.findByText('Não há sessão de recuperação. Abra o link mais recente neste navegador.')).toBeTruthy()
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled()
    expect(auth.getSession).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Nova senha')).toBeNull()
  })

  it('keeps the form available after a validated recovery session is refreshed', async () => {
    window.sessionStorage.setItem(RECOVERY_PENDING_KEY, '1')
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null })

    renderRecovery()

    expect(await screen.findByRole('button', { name: 'Definir senha' })).toBeTruthy()
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('signs out a non-recovery code when no session existed and returns to login', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    window.sessionStorage.setItem(RECOVERY_PENDING_KEY, '1')
    staffProfile()
    oneMembership()
    db.patients = [syntheticPatient]
    auth.exchangeCodeForSession.mockImplementation(async () => {
      const session: HeldSession = {
        access_token: 'code-access',
        refresh_token: 'code-refresh',
        user: { id: 'user-2', email: 'other@example.com' },
      }
      held = session
      emit('SIGNED_IN', session)
      return { data: { session, user: session.user }, error: null }
    })

    renderIntegrated()

    expect(await screen.findByText('Este link não corresponde a uma recuperação de senha válida.')).toBeTruthy()
    expect(screen.queryByLabelText('Nova senha')).toBeNull()
    expect(screen.queryByText(/sessão encerrada/i)).toBeNull()
    expect(screen.queryByText(/preservada/i)).toBeNull()
    expect(window.sessionStorage.getItem(RECOVERY_PENDING_KEY)).toBeNull()
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(auth.setSession).not.toHaveBeenCalled()
    expect(held).toBeNull()
    expectSecretsHidden()

    fireEvent.click(screen.getByRole('link', { name: 'Ir para o login' }))

    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeTruthy()
    expect(screen.getByText('Clínica Estética · V3')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Lia Sintetica' })).toBeNull()
    expect(screen.queryByText('Nenhuma membership ativa.')).toBeNull()
    expect(screen.queryByText('Perfil não encontrado.')).toBeNull()
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('restores a pre-existing session when the code is not a recovery', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    window.sessionStorage.setItem(RECOVERY_PENDING_KEY, '1')
    held = {
      access_token: 'prior-access',
      refresh_token: 'prior-refresh',
      user: { id: 'user-1', email: 'staff@example.com' },
    }
    staffProfile()
    oneMembership()
    db.patients = [syntheticPatient]
    auth.exchangeCodeForSession.mockImplementation(async () => {
      const session: HeldSession = {
        access_token: 'code-access',
        refresh_token: 'code-refresh',
        user: { id: 'user-2', email: 'other@example.com' },
      }
      held = session
      emit('SIGNED_IN', session)
      return { data: { session, user: session.user }, error: null }
    })

    renderIntegrated()

    expect(await screen.findByText('Este link não corresponde a uma recuperação de senha válida.')).toBeTruthy()
    expect(screen.queryByLabelText('Nova senha')).toBeNull()
    expect(screen.queryByText(/sessão encerrada/i)).toBeNull()
    expect(window.sessionStorage.getItem(RECOVERY_PENDING_KEY)).toBeNull()
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(auth.setSession).toHaveBeenCalledWith({
      access_token: 'prior-access',
      refresh_token: 'prior-refresh',
    })
    expect(held?.access_token).toBe('prior-access')
    expect(held?.refresh_token).toBe('prior-refresh')
    expect(held?.user.id).toBe('user-1')
    expectSecretsHidden()

    fireEvent.click(screen.getByRole('link', { name: 'Ir para o login' }))

    expect(await screen.findByRole('link', { name: 'Lia Sintetica' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Entrar' })).toBeNull()
    expect(db.patientClinicIds.every((clinicId) => clinicId === 'clinic-a')).toBe(true)
    expect(held?.access_token).toBe('prior-access')
    expect(held?.user.id).toBe('user-1')
  })

  it('keeps the current session when the access token is unchanged', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    window.sessionStorage.setItem(RECOVERY_PENDING_KEY, '1')
    held = {
      access_token: 'same-access',
      refresh_token: 'prior-refresh',
      user: { id: 'user-1', email: 'staff@example.com' },
    }
    staffProfile()
    oneMembership()
    db.patients = [syntheticPatient]
    auth.exchangeCodeForSession.mockImplementation(async () => {
      const session: HeldSession = {
        access_token: 'same-access',
        refresh_token: 'same-refresh-after-exchange',
        user: { id: 'user-1', email: 'staff@example.com' },
      }
      held = session
      emit('SIGNED_IN', session)
      return { data: { session, user: session.user }, error: null }
    })

    renderIntegrated()

    expect(await screen.findByText('Este link não corresponde a uma recuperação de senha válida.')).toBeTruthy()
    expect(screen.queryByLabelText('Nova senha')).toBeNull()
    expect(window.sessionStorage.getItem(RECOVERY_PENDING_KEY)).toBeNull()
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(auth.setSession).not.toHaveBeenCalled()
    expect(held?.access_token).toBe('same-access')
    expect(held?.user.id).toBe('user-1')
    expectSecretsHidden()

    fireEvent.click(screen.getByRole('link', { name: 'Ir para o login' }))

    expect(await screen.findByRole('link', { name: 'Lia Sintetica' })).toBeTruthy()
    expect(held?.access_token).toBe('same-access')
  })

  it('signs out locally when the reported access token matches but storage does not', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    window.sessionStorage.setItem(RECOVERY_PENDING_KEY, '1')
    held = {
      access_token: 'same-access',
      refresh_token: 'prior-refresh',
      user: { id: 'user-1', email: 'staff@example.com' },
    }
    auth.exchangeCodeForSession.mockImplementation(async () => {
      held = codeSession()
      const reported: HeldSession = {
        access_token: 'same-access',
        refresh_token: 'prior-refresh',
        user: { id: 'user-1', email: 'staff@example.com' },
      }
      emit('SIGNED_IN', held)
      return { data: { session: reported, user: reported.user }, error: null }
    })

    renderIntegrated()

    expect(await screen.findByText('Este link não corresponde a uma recuperação de senha válida.')).toBeTruthy()
    expect(screen.queryByLabelText('Nova senha')).toBeNull()
    expect(window.sessionStorage.getItem(RECOVERY_PENDING_KEY)).toBeNull()
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    requireLocalSignOut()
    expect(held).toBeNull()
    expectSecretsHidden()
  })

  it('ends the code session locally when getSession fails before the exchange', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    window.sessionStorage.setItem(RECOVERY_PENDING_KEY, '1')
    held = priorSession()
    const exchange = exchangeUnrelatedCode()
    exchange.failReadsUntilExchange('error')

    renderIntegrated()

    expect(await screen.findByText('Este link não corresponde a uma recuperação de senha válida.')).toBeTruthy()
    expect(screen.queryByLabelText('Nova senha')).toBeNull()
    expect(screen.queryByText(/preservada/i)).toBeNull()
    expect(screen.queryByText(/sessão encerrada/i)).toBeNull()
    expect(screen.queryByText('getSession failed before exchange')).toBeNull()
    expect(window.sessionStorage.getItem(RECOVERY_PENDING_KEY)).toBeNull()
    expect(auth.setSession).not.toHaveBeenCalled()
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    requireLocalSignOut()
    expect(held).toBeNull()
    expectSecretsHidden()
  })

  it('ends the code session locally when getSession throws before the exchange', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    window.sessionStorage.setItem(RECOVERY_PENDING_KEY, '1')
    held = priorSession()
    const exchange = exchangeUnrelatedCode()
    exchange.failReadsUntilExchange('throw')

    renderIntegrated()

    expect(await screen.findByText('Este link não corresponde a uma recuperação de senha válida.')).toBeTruthy()
    expect(screen.queryByLabelText('Nova senha')).toBeNull()
    expect(screen.queryByText('getSession failed before exchange')).toBeNull()
    expect(window.sessionStorage.getItem(RECOVERY_PENDING_KEY)).toBeNull()
    expect(auth.setSession).not.toHaveBeenCalled()
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    requireLocalSignOut()
    expect(held).toBeNull()
    expectSecretsHidden()
  })

  it('ends the code session locally when the prior refresh token cannot be restored', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    window.sessionStorage.setItem(RECOVERY_PENDING_KEY, '1')
    held = {
      access_token: 'prior-access',
      refresh_token: '',
      user: { id: 'user-1', email: 'staff@example.com' },
    }
    exchangeUnrelatedCode()

    renderIntegrated()

    expect(await screen.findByText('Este link não corresponde a uma recuperação de senha válida.')).toBeTruthy()
    expect(screen.queryByLabelText('Nova senha')).toBeNull()
    expect(screen.queryByText(/preservada/i)).toBeNull()
    expect(window.sessionStorage.getItem(RECOVERY_PENDING_KEY)).toBeNull()
    expect(auth.setSession).not.toHaveBeenCalled()
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    requireLocalSignOut()
    expect(held).toBeNull()
    expectSecretsHidden()
  })

  it('signs out the code session when setSession returns an error', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    window.sessionStorage.setItem(RECOVERY_PENDING_KEY, '1')
    held = priorSession()
    exchangeUnrelatedCode()
    auth.setSession.mockImplementation(async () => ({
      data: { session: null, user: null },
      error: { message: 'refresh rejected' },
    }))

    renderIntegrated()

    expect(await screen.findByText('Este link não corresponde a uma recuperação de senha válida.')).toBeTruthy()
    expect(screen.queryByLabelText('Nova senha')).toBeNull()
    expect(screen.queryByText('refresh rejected')).toBeNull()
    expect(screen.queryByText(/sessão encerrada/i)).toBeNull()
    expect(window.sessionStorage.getItem(RECOVERY_PENDING_KEY)).toBeNull()
    expect(auth.setSession).toHaveBeenCalledWith({
      access_token: 'prior-access',
      refresh_token: 'prior-refresh',
    })
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    requireLocalSignOut()
    expect(held).toBeNull()
    expectSecretsHidden()
  })

  it('signs out the code session when setSession throws', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    window.sessionStorage.setItem(RECOVERY_PENDING_KEY, '1')
    held = priorSession()
    exchangeUnrelatedCode()
    auth.setSession.mockImplementation(async () => {
      throw new Error('setSession exploded')
    })

    renderIntegrated()

    expect(await screen.findByText('Este link não corresponde a uma recuperação de senha válida.')).toBeTruthy()
    expect(screen.queryByLabelText('Nova senha')).toBeNull()
    expect(screen.queryByText('setSession exploded')).toBeNull()
    expect(window.sessionStorage.getItem(RECOVERY_PENDING_KEY)).toBeNull()
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    requireLocalSignOut()
    expect(held).toBeNull()
    expectSecretsHidden()
  })

  it('rejects a setSession result that does not match the stored session', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    window.sessionStorage.setItem(RECOVERY_PENDING_KEY, '1')
    held = priorSession()
    exchangeUnrelatedCode()
    auth.setSession.mockImplementation(async () => ({
      data: {
        session: priorSession(),
        user: priorSession().user,
      },
      error: null,
    }))

    renderIntegrated()

    expect(await screen.findByText('Este link não corresponde a uma recuperação de senha válida.')).toBeTruthy()
    expect(screen.queryByLabelText('Nova senha')).toBeNull()
    expect(window.sessionStorage.getItem(RECOVERY_PENDING_KEY)).toBeNull()
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    requireLocalSignOut()
    expect(held).toBeNull()
    expectSecretsHidden()
  })

  it('rejects a setSession result that only echoes the code session', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    window.sessionStorage.setItem(RECOVERY_PENDING_KEY, '1')
    held = priorSession()
    exchangeUnrelatedCode()
    auth.setSession.mockImplementation(async () => ({
      data: { session: held, user: held?.user ?? null },
      error: null,
    }))

    renderIntegrated()

    expect(await screen.findByText('Este link não corresponde a uma recuperação de senha válida.')).toBeTruthy()
    expect(screen.queryByLabelText('Nova senha')).toBeNull()
    expect(window.sessionStorage.getItem(RECOVERY_PENDING_KEY)).toBeNull()
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    requireLocalSignOut()
    expect(held).toBeNull()
    expectSecretsHidden()
  })

  it('keeps a rotated token only when it belongs to the prior user', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    window.sessionStorage.setItem(RECOVERY_PENDING_KEY, '1')
    held = priorSession()
    staffProfile()
    oneMembership()
    db.patients = [syntheticPatient]
    exchangeUnrelatedCode()
    auth.setSession.mockImplementation(async () => {
      const session: HeldSession = {
        access_token: 'rotated-access',
        refresh_token: 'rotated-refresh',
        user: { id: 'user-1', email: 'staff@example.com' },
      }
      held = session
      emit('TOKEN_REFRESHED', session)
      return { data: { session, user: session.user }, error: null }
    })

    renderIntegrated()

    expect(await screen.findByText('Este link não corresponde a uma recuperação de senha válida.')).toBeTruthy()
    expect(screen.queryByLabelText('Nova senha')).toBeNull()
    expect(window.sessionStorage.getItem(RECOVERY_PENDING_KEY)).toBeNull()
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(held?.access_token).toBe('rotated-access')
    expect(held?.refresh_token).toBe('rotated-refresh')
    expect(held?.user.id).toBe('user-1')
    expectSecretsHidden()

    fireEvent.click(screen.getByRole('link', { name: 'Ir para o login' }))

    expect(await screen.findByRole('link', { name: 'Lia Sintetica' })).toBeTruthy()
    expect(held?.access_token).toBe('rotated-access')
    expect(held?.user.id).toBe('user-1')
  })

  it('does not claim the session ended when signOut returns an error after clearing storage', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    window.sessionStorage.setItem(RECOVERY_PENDING_KEY, '1')
    exchangeUnrelatedCode()
    auth.signOut.mockImplementation(async (options?: { scope?: string }) => {
      if (options?.scope !== 'local') throw new Error('recovery cleanup must use scope local')
      held = null
      emit('SIGNED_OUT', null)
      return { error: { message: 'logout api failed' } }
    })

    renderIntegrated()

    expect(await screen.findByText('Este link não corresponde a uma recuperação de senha válida.')).toBeTruthy()
    expect(screen.queryByLabelText('Nova senha')).toBeNull()
    expect(screen.queryByText(/sessão encerrada/i)).toBeNull()
    expect(screen.queryByText('logout api failed')).toBeNull()
    expect(window.sessionStorage.getItem(RECOVERY_PENDING_KEY)).toBeNull()
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    requireLocalSignOut()
    expect(held).toBeNull()
    expectSecretsHidden()
  })

  it('leaves a residual session visible when signOut returns an error and storage remains', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    window.sessionStorage.setItem(RECOVERY_PENDING_KEY, '1')
    exchangeUnrelatedCode()
    auth.signOut.mockImplementation(async (options?: { scope?: string }) => {
      if (options?.scope !== 'local') throw new Error('recovery cleanup must use scope local')
      return { error: { message: 'logout left the session in place' } }
    })

    renderIntegrated()

    expect(await screen.findByText('Este link não corresponde a uma recuperação de senha válida.')).toBeTruthy()
    expect(screen.queryByLabelText('Nova senha')).toBeNull()
    expect(screen.queryByText(/sessão encerrada/i)).toBeNull()
    expect(screen.queryByText('logout left the session in place')).toBeNull()
    expect(window.sessionStorage.getItem(RECOVERY_PENDING_KEY)).toBeNull()
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    requireLocalSignOut()
    expect(held?.access_token).toBe('code-access')
    expect(held?.user.id).toBe('user-2')
    expectSecretsHidden()

    fireEvent.click(screen.getByRole('link', { name: 'Ir para o login' }))

    expect(await screen.findByText('Perfil não encontrado.')).toBeTruthy()
    expect(screen.queryByLabelText('Nova senha')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Lia Sintetica' })).toBeNull()
    expect(held?.access_token).toBe('code-access')
    expect(auth.signOut).toHaveBeenCalledTimes(1)
  })

  it('leaves a residual session when signOut throws before clearing storage', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    window.sessionStorage.setItem(RECOVERY_PENDING_KEY, '1')
    exchangeUnrelatedCode()
    auth.signOut.mockImplementation(async (options?: { scope?: string }) => {
      if (options?.scope !== 'local') throw new Error('recovery cleanup must use scope local')
      throw new Error('signOut exploded')
    })

    renderIntegrated()

    expect(await screen.findByText('Este link não corresponde a uma recuperação de senha válida.')).toBeTruthy()
    expect(screen.queryByLabelText('Nova senha')).toBeNull()
    expect(screen.queryByText('signOut exploded')).toBeNull()
    expect(screen.queryByText(/sessão encerrada/i)).toBeNull()
    expect(window.sessionStorage.getItem(RECOVERY_PENDING_KEY)).toBeNull()
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    requireLocalSignOut()
    expect(held?.access_token).toBe('code-access')
    expect(held?.user.id).toBe('user-2')
    expectSecretsHidden()
  })

  it('keeps the prior session when exchange throws before saving', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    window.sessionStorage.setItem(RECOVERY_PENDING_KEY, '1')
    held = priorSession()
    auth.exchangeCodeForSession.mockImplementation(async () => {
      throw new Error('exchange exploded before save')
    })

    renderIntegrated()

    expect(await screen.findByText('O link de recuperação expirou ou já foi usado.')).toBeTruthy()
    expect(screen.queryByLabelText('Nova senha')).toBeNull()
    expect(screen.queryByText('exchange exploded before save')).toBeNull()
    expect(screen.queryByText(/sessão encerrada/i)).toBeNull()
    expect(window.sessionStorage.getItem(RECOVERY_PENDING_KEY)).toBeNull()
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(auth.setSession).not.toHaveBeenCalled()
    expect(held?.access_token).toBe('prior-access')
    expect(held?.refresh_token).toBe('prior-refresh')
    expect(held?.user.id).toBe('user-1')
    expectSecretsHidden()
  })

  it('does nothing when exchange throws and no session exists', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    auth.exchangeCodeForSession.mockImplementation(async () => {
      throw new Error('exchange exploded before save')
    })

    renderRecovery()

    expect(await screen.findByText('O link de recuperação expirou ou já foi usado.')).toBeTruthy()
    expect(screen.queryByLabelText('Nova senha')).toBeNull()
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(auth.setSession).not.toHaveBeenCalled()
    expect(held).toBeNull()
    expectSecretsHidden()
  })

  it('ends a session saved before exchange throws when none existed before', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    window.sessionStorage.setItem(RECOVERY_PENDING_KEY, '1')
    auth.exchangeCodeForSession.mockImplementation(async () => {
      held = codeSession()
      emit('SIGNED_IN', held)
      throw new Error('exchange exploded after save')
    })

    renderIntegrated()

    expect(await screen.findByText('O link de recuperação expirou ou já foi usado.')).toBeTruthy()
    expect(screen.queryByLabelText('Nova senha')).toBeNull()
    expect(screen.queryByText('exchange exploded after save')).toBeNull()
    expect(screen.queryByText(/sessão encerrada/i)).toBeNull()
    expect(window.sessionStorage.getItem(RECOVERY_PENDING_KEY)).toBeNull()
    expect(auth.setSession).not.toHaveBeenCalled()
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    requireLocalSignOut()
    expect(held).toBeNull()
    expectSecretsHidden()

    fireEvent.click(screen.getByRole('link', { name: 'Ir para o login' }))

    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Lia Sintetica' })).toBeNull()
    expect(screen.queryByText('Perfil não encontrado.')).toBeNull()
    expect(held).toBeNull()
  })

  it('restores a captured session when exchange throws after replacing it', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    window.sessionStorage.setItem(RECOVERY_PENDING_KEY, '1')
    held = priorSession()
    staffProfile()
    oneMembership()
    db.patients = [syntheticPatient]
    auth.exchangeCodeForSession.mockImplementation(async () => {
      held = codeSession()
      emit('SIGNED_IN', held)
      throw new Error('exchange exploded after save')
    })

    renderIntegrated()

    expect(await screen.findByText('O link de recuperação expirou ou já foi usado.')).toBeTruthy()
    expect(screen.queryByLabelText('Nova senha')).toBeNull()
    expect(screen.queryByText('exchange exploded after save')).toBeNull()
    expect(window.sessionStorage.getItem(RECOVERY_PENDING_KEY)).toBeNull()
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(auth.setSession).toHaveBeenCalledWith({
      access_token: 'prior-access',
      refresh_token: 'prior-refresh',
    })
    expect(held?.access_token).toBe('prior-access')
    expect(held?.user.id).toBe('user-1')
    expectSecretsHidden()

    fireEvent.click(screen.getByRole('link', { name: 'Ir para o login' }))

    expect(await screen.findByRole('link', { name: 'Lia Sintetica' })).toBeTruthy()
    expect(held?.access_token).toBe('prior-access')
  })

  it('ends the code session when exchange returns an error after saving', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    window.sessionStorage.setItem(RECOVERY_PENDING_KEY, '1')
    auth.exchangeCodeForSession.mockImplementation(async () => {
      held = codeSession()
      emit('SIGNED_IN', held)
      return { data: { session: null, user: null }, error: { message: 'notify failed after save' } }
    })

    renderIntegrated()

    expect(await screen.findByText('O link de recuperação expirou ou já foi usado.')).toBeTruthy()
    expect(screen.queryByLabelText('Nova senha')).toBeNull()
    expect(screen.queryByText('notify failed after save')).toBeNull()
    expect(window.sessionStorage.getItem(RECOVERY_PENDING_KEY)).toBeNull()
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    requireLocalSignOut()
    expect(held).toBeNull()
    expectSecretsHidden()
  })

  it('closes the form when a recovery event is followed by an exchange throw', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    auth.exchangeCodeForSession.mockImplementation(async () => {
      const session: HeldSession = {
        access_token: 'recovery-access',
        refresh_token: 'recovery-refresh',
        user: { id: 'user-1', email: 'staff@example.com' },
      }
      held = session
      emit('PASSWORD_RECOVERY', session)
      throw new Error('exchange exploded after recovery save')
    })

    renderIntegrated()

    expect(await screen.findByText('O link de recuperação expirou ou já foi usado.')).toBeTruthy()
    expect(screen.queryByLabelText('Nova senha')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Definir senha' })).toBeNull()
    expect(screen.queryByText('exchange exploded after recovery save')).toBeNull()
    expect(window.sessionStorage.getItem(RECOVERY_PENDING_KEY)).toBeNull()
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    requireLocalSignOut()
    expect(held).toBeNull()
    expectSecretsHidden()
  })

  it('does not sign out when the session after a throw cannot be read', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    let exchanged = false
    auth.exchangeCodeForSession.mockImplementation(async () => {
      held = codeSession()
      emit('SIGNED_IN', held)
      exchanged = true
      throw new Error('exchange exploded after save')
    })
    auth.getSession.mockImplementation(async () => {
      if (!exchanged) return { data: { session: held }, error: null }
      return { data: { session: null }, error: { message: 'unreadable after exchange' } }
    })

    renderIntegrated()

    expect(await screen.findByText('O link de recuperação expirou ou já foi usado.')).toBeTruthy()
    expect(screen.queryByLabelText('Nova senha')).toBeNull()
    expect(screen.queryByText('unreadable after exchange')).toBeNull()
    expect(screen.queryByText(/sessão encerrada/i)).toBeNull()
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(auth.setSession).not.toHaveBeenCalled()
    expect(held?.access_token).toBe('code-access')
    expect(held?.user.id).toBe('user-2')
    expectSecretsHidden()
  })

  it('does not sign out an unread session when exchange throws without an auth event', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    held = priorSession()
    let priorRead = true
    auth.getSession.mockImplementation(async () => {
      if (priorRead) {
        priorRead = false
        return { data: { session: null }, error: { message: 'getSession failed before exchange' } }
      }
      return { data: { session: held }, error: null }
    })
    auth.exchangeCodeForSession.mockImplementation(async () => {
      throw new Error('exchange exploded before save')
    })

    renderIntegrated()

    expect(await screen.findByText('O link de recuperação expirou ou já foi usado.')).toBeTruthy()
    expect(screen.queryByLabelText('Nova senha')).toBeNull()
    expect(screen.queryByText('getSession failed before exchange')).toBeNull()
    expect(screen.queryByText(/preservada/i)).toBeNull()
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(auth.setSession).not.toHaveBeenCalled()
    expect(held?.access_token).toBe('prior-access')
    expect(held?.user.id).toBe('user-1')
    expectSecretsHidden()
  })

  it('notifies subscribers when signOut throws after removing storage', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    window.sessionStorage.setItem(RECOVERY_PENDING_KEY, '1')
    exchangeUnrelatedCode()
    let calls = 0
    auth.signOut.mockImplementation(async (options?: { scope?: string }) => {
      if (options?.scope !== 'local') throw new Error('recovery cleanup must use scope local')
      calls += 1
      held = null
      if (calls === 1) throw new Error('signOut exploded after clear')
      emit('SIGNED_OUT', null)
      return { error: null }
    })

    renderIntegrated()

    expect(await screen.findByText('Este link não corresponde a uma recuperação de senha válida.')).toBeTruthy()
    expect(screen.queryByLabelText('Nova senha')).toBeNull()
    expect(screen.queryByText('signOut exploded after clear')).toBeNull()
    expect(screen.queryByText(/sessão encerrada/i)).toBeNull()
    expect(window.sessionStorage.getItem(RECOVERY_PENDING_KEY)).toBeNull()
    expect(auth.signOut).toHaveBeenCalledTimes(2)
    requireLocalSignOut()
    expect(held).toBeNull()
    expectSecretsHidden()

    fireEvent.click(screen.getByRole('link', { name: 'Ir para o login' }))

    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeTruthy()
    expect(screen.queryByText('Perfil não encontrado.')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Lia Sintetica' })).toBeNull()
    expect(held).toBeNull()
  })

  it('stops after one local signOut when the throw already emitted SIGNED_OUT', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    exchangeUnrelatedCode()
    auth.signOut.mockImplementation(async (options?: { scope?: string }) => {
      if (options?.scope !== 'local') throw new Error('recovery cleanup must use scope local')
      held = null
      emit('SIGNED_OUT', null)
      throw new Error('signOut exploded after notify')
    })

    renderIntegrated()

    expect(await screen.findByText('Este link não corresponde a uma recuperação de senha válida.')).toBeTruthy()
    expect(screen.queryByLabelText('Nova senha')).toBeNull()
    expect(screen.queryByText('signOut exploded after notify')).toBeNull()
    expect(screen.queryByText(/sessão encerrada/i)).toBeNull()
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    requireLocalSignOut()
    expect(held).toBeNull()
    expectSecretsHidden()
  })

  it('does not update the password when the confirmation differs', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    recoverySession()
    renderRecovery()

    expect(await screen.findByRole('button', { name: 'Definir senha' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'senha-nova-segura' } })
    fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: 'outra-senha-segura' } })
    fireEvent.click(screen.getByRole('button', { name: 'Definir senha' }))

    expect(await screen.findByText('A confirmação não confere.')).toBeTruthy()
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it('rejects a password that is too short', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    recoverySession()
    renderRecovery()

    expect(await screen.findByRole('button', { name: 'Definir senha' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'curta12' } })
    fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: 'curta12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Definir senha' }))

    expect(await screen.findByText('Use pelo menos 8 caracteres.')).toBeTruthy()
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it('keeps the form in place when the password update fails', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    recoverySession()
    auth.updateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'update failed', code: 'unexpected_failure' },
    })
    renderRecovery()

    expect(await screen.findByRole('button', { name: 'Definir senha' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'senha-nova-segura' } })
    fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: 'senha-nova-segura' } })
    fireEvent.click(screen.getByRole('button', { name: 'Definir senha' }))

    expect(await screen.findByText('Não foi possível atualizar a senha.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Definir senha' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Lia Sintetica' })).toBeNull()
  })

  it('sends a recovery email only from the explicit login action', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null })
    render(<StaffRecoveryRequest origin="https://preview.example" />)

    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Esqueci minha senha' }))
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled()

    fireEvent.change(screen.getByPlaceholderText('staff@clinica.com'), {
      target: { value: 'staff@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link de recuperação' }))

    await waitFor(() => expect(auth.resetPasswordForEmail).toHaveBeenCalledTimes(1))
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('staff@example.com', {
      redirectTo: 'https://preview.example/auth/recovery',
    })
    expect(await screen.findByText('Se existir uma conta de staff, o link de recuperação foi enviado.')).toBeTruthy()
  })

  const leakedAuthText =
    'token=raw-recovery-code apikey=service-role-secret https://example.supabase.co/auth/v1/verify'

  async function submitRecovery(error: { message: string; status?: number; code?: string }) {
    auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error })
    render(<StaffRecoveryRequest origin="https://preview.example" />)
    fireEvent.click(screen.getByRole('button', { name: 'Esqueci minha senha' }))
    fireEvent.change(screen.getByPlaceholderText('staff@clinica.com'), {
      target: { value: 'staff@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link de recuperação' }))
    await waitFor(() => expect(auth.resetPasswordForEmail).toHaveBeenCalledTimes(1))
  }

  function expectLeakHidden() {
    const text = document.body.textContent ?? ''
    expect(text).not.toContain('raw-recovery-code')
    expect(text).not.toContain('service-role-secret')
    expect(text).not.toContain('auth/v1/verify')
    expect(text).not.toContain(leakedAuthText)
  }

  it('maps a 429 without showing the raw auth error', async () => {
    await submitRecovery({
      message: leakedAuthText,
      status: 429,
      code: 'over_email_send_rate_limit',
    })

    expect(
      screen.getByText('O envio de e-mail está temporariamente limitado. Aguarde antes de pedir outro link.'),
    ).toBeTruthy()
    expectLeakHidden()
  })

  it('maps HTTP 429 even when the auth code is absent', async () => {
    await submitRecovery({ message: leakedAuthText, status: 429 })

    expect(
      screen.getByText('O envio de e-mail está temporariamente limitado. Aguarde antes de pedir outro link.'),
    ).toBeTruthy()
    expectLeakHidden()
  })

  it('maps a transport failure with status 0', async () => {
    await submitRecovery({ message: leakedAuthText, status: 0 })

    expect(screen.getByText('Não foi possível contactar o serviço de autenticação.')).toBeTruthy()
    expectLeakHidden()
  })

  it('keeps a missing status on the generic recovery message', async () => {
    await submitRecovery({ message: leakedAuthText, code: 'unexpected' })

    expect(screen.getByText('Não foi possível enviar o link de recuperação.')).toBeTruthy()
    expect(screen.queryByText('Não foi possível contactar o serviço de autenticação.')).toBeNull()
    expectLeakHidden()
  })

  it('maps unexpected_failure without showing the raw auth error', async () => {
    await submitRecovery({ message: leakedAuthText, status: 400, code: 'unexpected_failure' })

    expect(screen.getByText('O serviço de e-mail não concluiu o envio.')).toBeTruthy()
    expectLeakHidden()
  })

  it('prefers the rate-limit message when that code arrives with status 500', async () => {
    await submitRecovery({
      message: leakedAuthText,
      status: 500,
      code: 'over_email_send_rate_limit',
    })

    expect(
      screen.getByText('O envio de e-mail está temporariamente limitado. Aguarde antes de pedir outro link.'),
    ).toBeTruthy()
    expect(screen.queryByText('O serviço de e-mail não concluiu o envio.')).toBeNull()
    expectLeakHidden()
  })

  it('maps HTTP 500 and above as an email service failure', async () => {
    await submitRecovery({ message: leakedAuthText, status: 503 })

    expect(screen.getByText('O serviço de e-mail não concluiu o envio.')).toBeTruthy()
    expectLeakHidden()
  })

  it('keeps unrecognized auth errors on the generic recovery message', async () => {
    await submitRecovery({ message: leakedAuthText, status: 400, code: 'validation_failed' })

    expect(screen.getByText('Não foi possível enviar o link de recuperação.')).toBeTruthy()
    expect(screen.queryByText('O serviço de e-mail não concluiu o envio.')).toBeNull()
    expectLeakHidden()
  })
})
