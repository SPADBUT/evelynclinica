import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
  'src/components/RequireAuth.tsx',
  'src/pages/LoginPage.tsx',
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

describe('V2 auth stays the default path', () => {
  afterEach(() => {
    cleanup()
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
})
