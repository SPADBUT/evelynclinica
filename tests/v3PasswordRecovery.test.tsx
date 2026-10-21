import { StrictMode } from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StaffRecoveryRequest } from '../src/auth/StaffRecoveryRequest'
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

const listener = vi.hoisted(() => ({ current: null as ((event: string) => void) | null }))

const auth = {
  getSession: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  updateUser: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChange: vi.fn((callback: (event: string) => void) => {
    listener.current = callback
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  }),
}

function installClient() {
  vi.mocked(createClient).mockReturnValue({ auth, from: vi.fn() } as unknown as SupabaseClient)
}

function renderRecovery() {
  return render(
    <MemoryRouter initialEntries={['/auth/recovery']}>
      <Routes>
        <Route path="/auth/recovery" element={<V3PasswordRecoveryPage />} />
        <Route path="/" element={<p>Fluxo de staff</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

function recoverySession() {
  auth.exchangeCodeForSession.mockImplementation(async () => {
    listener.current?.('PASSWORD_RECOVERY')
    return {
      data: { session: { user: { id: 'user-1' } }, user: { id: 'user-1' } },
      error: null,
    }
  })
}

describe('V3 password recovery', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.stubEnv('VITE_SUPABASE_AUTH_ENABLED', 'true')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    resetSupabaseClientForTests()
    resetRecoveryBootstrapForTests()
    window.sessionStorage.clear()
    listener.current = null
    auth.getSession.mockReset()
    auth.exchangeCodeForSession.mockReset()
    auth.updateUser.mockReset()
    auth.resetPasswordForEmail.mockReset()
    auth.onAuthStateChange.mockClear()
    installClient()
    window.history.replaceState({}, '', '/auth/recovery')
  })

  afterEach(() => {
    cleanup()
    window.sessionStorage.clear()
  })

  it('builds the preview callback without a site url override', () => {
    expect(recoveryRedirectTo('https://preview.example')).toBe('https://preview.example/auth/recovery')
    expect(readRecoveryCallback('https://preview.example/auth/recovery?code=fake-code&sb_flow_id=short').flowId).toBeNull()
    expect(readRecoveryCallback('https://preview.example/auth/recovery?code=fake-code&sb_flow_id=flow-1234').flowId).toBe('flow-1234')
    expect(recoveryUrlWithoutSecrets('https://preview.example/auth/recovery?code=fake-code&sb_flow_id=flow-1234#hidden')).toBe(
      '/auth/recovery',
    )
  })

  it('exchanges one valid code and continues to the staff gate', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code&sb_flow_id=flow-1234&type=recovery')
    recoverySession()
    auth.updateUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/auth/recovery']}>
          <Routes>
            <Route path="/auth/recovery" element={<V3PasswordRecoveryPage />} />
            <Route path="/" element={<p>Fluxo de staff</p>} />
          </Routes>
        </MemoryRouter>
      </StrictMode>,
    )

    expect(await screen.findByRole('button', { name: 'Definir senha' })).toBeTruthy()
    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1)
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('fake-code', { flowId: 'flow-1234' })
    expect(window.location.search).toBe('')
    expect(window.sessionStorage.getItem(RECOVERY_PENDING_KEY)).toBe('1')

    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'senha-nova-segura' } })
    fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: 'senha-nova-segura' } })
    fireEvent.click(screen.getByRole('button', { name: 'Definir senha' }))

    expect(await screen.findByText('Fluxo de staff')).toBeTruthy()
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'senha-nova-segura' })
    expect(window.sessionStorage.getItem(RECOVERY_PENDING_KEY)).toBeNull()
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled()
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

  it('rejects a code that signs in without a recovery event', async () => {
    window.history.replaceState({}, '', '/auth/recovery?code=fake-code')
    auth.exchangeCodeForSession.mockImplementation(async () => {
      listener.current?.('SIGNED_IN')
      return {
        data: { session: { user: { id: 'user-1' } }, user: { id: 'user-1' } },
        error: null,
      }
    })

    renderRecovery()

    expect(await screen.findByText('Este link não é uma recuperação de senha.')).toBeTruthy()
    expect(screen.queryByLabelText('Nova senha')).toBeNull()
    expect(window.sessionStorage.getItem(RECOVERY_PENDING_KEY)).toBeNull()
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
    expect(screen.queryByText('Fluxo de staff')).toBeNull()
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
