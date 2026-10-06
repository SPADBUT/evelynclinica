import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { SupabaseAuthProvider } from '../src/context/SupabaseAuthContext'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ auth: {}, from: vi.fn() })),
}))

const frozenFiles = [
  'src/context/AuthContext.tsx',
  'src/context/ClinicContext.tsx',
  'src/lib/storage.ts',
  'src/lib/auth.ts',
  'src/App.tsx',
  'src/pages/DashboardPage.tsx',
  'src/pages/CrmPage.tsx',
  'src/pages/PatientsPage.tsx',
  'src/pages/PatientDetailPage.tsx',
  'src/pages/AgendaPage.tsx',
  'src/pages/PhotosPage.tsx',
  'src/pages/ConsentsPage.tsx',
  'src/pages/ContractsPage.tsx',
  'src/pages/BudgetsPage.tsx',
  'src/pages/patient/PatientConsentsPage.tsx',
  'src/pages/patient/PatientContractsPage.tsx',
  'src/pages/patient/SignConsentPage.tsx',
]

const bridgeFiles = [
  'src/main.tsx',
  'src/pages/LoginPage.tsx',
  'src/components/RequireAuth.tsx',
  'src/components/layout/AppLayout.tsx',
]

async function submitLogin(email: string, password: string) {
  fireEvent.change(screen.getByPlaceholderText('seu@email.com'), { target: { value: email } })
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
}

describe('V2 auth stays the default path', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('loads Supabase Auth only when the build flag is true', () => {
    const main = readFileSync('src/main.tsx', 'utf8')
    expect(main).toContain("import.meta.env.VITE_SUPABASE_AUTH_ENABLED === 'true'")
    expect(main).toContain("import('./context/SupabaseAuthContext.tsx')")
    expect(main).not.toMatch(/from '\.\/context\/SupabaseAuthContext/)
  })

  it('does not import Supabase from the V2 auth and business files', () => {
    for (const file of frozenFiles) {
      const source = readFileSync(file, 'utf8')
      expect(source.toLowerCase(), file).not.toContain('supabase')
    }
  })

  it('keeps the staff bridge behind the feature flag and out of the Supabase client', () => {
    for (const file of bridgeFiles) {
      const source = readFileSync(file, 'utf8')
      expect(source, file).toContain("import.meta.env.VITE_SUPABASE_AUTH_ENABLED === 'true'")
      expect(source, file).not.toContain("from '@supabase/supabase-js'")
      expect(source, file).not.toContain('createClient')
      expect(source.toLowerCase(), file).not.toContain('service_role')
    }

    const login = readFileSync('src/pages/LoginPage.tsx', 'utf8')
    expect(login.slice(login.indexOf('function V2LoginPage')).toLowerCase()).not.toContain('supabase')

    const guards = readFileSync('src/components/RequireAuth.tsx', 'utf8')
    expect(guards.slice(guards.indexOf('function V2RequireStaff')).toLowerCase()).not.toContain('supabase')
    expect(guards.slice(guards.indexOf('export function RequirePatient')).toLowerCase()).not.toContain(
      'supabase',
    )
  })

  it('still renders the V2 login when the feature flag is off', async () => {
    render(
      <SupabaseAuthProvider>
        <App />
      </SupabaseAuthProvider>,
    )
    expect(await screen.findByText('Clínica Estética · V2')).toBeTruthy()
    expect(screen.getByPlaceholderText('seu@email.com')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('keeps staff login, patient portal, invalid credentials, and logout on AuthContext', async () => {
    render(<App />)

    expect(await screen.findByText('Clínica Estética · V2')).toBeTruthy()
    await submitLogin('evelyn@clinica.com', 'senha-errada')
    expect(await screen.findByText('E-mail ou senha inválidos.')).toBeTruthy()
    expect(screen.queryByText('Bom atendimento, Evelyn')).toBeNull()

    await submitLogin('evelyn@clinica.com', 'evelyn123')
    expect(await screen.findByText('Bom atendimento, Evelyn')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'CRM' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeTruthy()
    expect(localStorage.getItem('evelyn-clinic-session-v2')).toBeNull()

    await submitLogin('juliana.ferreira@email.com', 'paciente123')
    expect(await screen.findByText('Portal da paciente')).toBeTruthy()
    expect(screen.getByText('Juliana Ferreira')).toBeTruthy()
    expect(screen.queryByText('Bom atendimento, Evelyn')).toBeNull()
    expect(createClient).not.toHaveBeenCalled()
  })
})
