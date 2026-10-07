import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'node:fs'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseAuthProvider } from '../src/context/SupabaseAuthContext'
import { V3TenantProvider } from '../src/context/V3TenantContext'
import { PatientRepositoryError } from '../src/lib/patientRepositoryError'
import { resetSupabaseClientForTests } from '../src/lib/supabase'
import { filterPatients } from '../src/pages/v3/patientDirectory'
import { V3PatientDetailPage } from '../src/pages/v3/V3PatientDetailPage'
import { V3PatientsPage } from '../src/pages/v3/V3PatientsPage'
import { listClinicalContext, listClinicalRecords } from '../src/services/clinicalRepository'
import {
  createPatient,
  getPatientById,
  listPatients,
  softDeletePatient,
  updatePatient,
} from '../src/services/patientRepository'
import type { V3Patient } from '../src/types/patient'

vi.mock('../src/services/clinicalRepository', () => ({
  listClinicalRecords: vi.fn(),
  listClinicalContext: vi.fn(),
  getClinicalRecord: vi.fn(),
  createClinicalRecord: vi.fn(),
  appendClinicalRecordVersion: vi.fn(),
  finalizeClinicalRecord: vi.fn(),
  cancelClinicalRecord: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

vi.mock('../src/services/patientRepository', () => ({
  listPatients: vi.fn(),
  getPatientById: vi.fn(),
  createPatient: vi.fn(),
  updatePatient: vi.fn(),
  softDeletePatient: vi.fn(),
}))

interface Listener {
  (event: string, session: unknown): void
}

const harness = vi.hoisted(() => ({ listener: null as Listener | null }))

const db = vi.hoisted(() => ({
  profile: null as unknown,
  memberships: [] as unknown[],
  patients: [] as V3Patient[],
  detail: null as V3Patient | null,
  listError: null as PatientRepositoryError | null,
}))

function sample(overrides: Partial<V3Patient> = {}): V3Patient {
  return {
    id: 'patient-1',
    clinicId: 'clinic-a',
    fullName: 'Ana Sintetica',
    email: 'ana@example.com',
    phone: '92999999999',
    cpf: '00000000000',
    birthDate: '1990-01-02',
    gender: 'feminino',
    address: 'Rua 1',
    allergies: 'nenhuma',
    medications: null,
    notes: 'observação',
    status: 'active',
    deletedAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-06T12:00:00.000Z',
    ...overrides,
  }
}

function queryResult(data: unknown) {
  const response = { data, error: null }
  const builder = {
    select: () => builder,
    eq: () => builder,
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
    maybeSingle: () =>
      Promise.resolve({
        data: clinicId
          ? { id: clinicId, name: 'Clínica Norte', slug: 'clinica-norte', timezone: 'America/Manaus' }
          : null,
        error: null,
      }),
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
}

function membership(role: string, clinicId = 'clinic-a') {
  return {
    id: `membership-${clinicId}-${role}`,
    clinic_id: clinicId,
    user_id: 'user-1',
    role,
    is_active: true,
  }
}

function renderPatients(path = '/v3/patients') {
  return render(
    <SupabaseAuthProvider>
      <V3TenantProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/v3/patients" element={<V3PatientsPage />} />
            <Route path="/v3/patients/:id" element={<V3PatientDetailPage />} />
            <Route path="/login" element={<p>Tela de login</p>} />
          </Routes>
        </MemoryRouter>
      </V3TenantProvider>
    </SupabaseAuthProvider>,
  )
}

describe('V3 patients experience', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_AUTH_ENABLED', 'true')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    resetSupabaseClientForTests()
    db.profile = { id: 'user-1', full_name: 'Staff Norte', email: 'staff@example.com' }
    db.memberships = [membership('admin')]
    db.patients = [sample(), sample({ id: 'patient-2', fullName: 'Bia Sintetica', email: 'bia@example.com', phone: '1133334444' })]
    db.detail = sample()
    db.listError = null
    auth.getSession.mockReset()
    auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'token', user: { id: 'user-1', email: 'staff@example.com' } } },
      error: null,
    })
    installClient()
    vi.mocked(listPatients).mockImplementation(async () => {
      if (db.listError) return { ok: false, error: db.listError }
      return { ok: true, value: db.patients }
    })
    vi.mocked(getPatientById).mockImplementation(async () => {
      if (!db.detail) {
        return { ok: false, error: new PatientRepositoryError('patient_not_found', 'Paciente não encontrado.') }
      }
      return { ok: true, value: db.detail }
    })
    vi.mocked(createPatient).mockImplementation(async (_tenant, input) => {
      const created = sample({ id: 'patient-new', fullName: input.fullName.trim(), email: input.email || null })
      db.patients = [created, ...db.patients]
      return { ok: true, value: created }
    })
    vi.mocked(updatePatient).mockImplementation(async (_tenant, id, input) => {
      const next = sample({ ...db.detail, id, fullName: input.fullName ?? db.detail?.fullName ?? '', phone: input.phone || null })
      db.detail = next
      return { ok: true, value: next }
    })
    vi.mocked(softDeletePatient).mockImplementation(async (_tenant, id) => {
      db.patients = db.patients.filter((patient) => patient.id !== id)
      db.detail = db.detail ? { ...db.detail, deletedAt: '2026-10-06T18:00:00.000Z' } : null
      return { ok: true, value: sample({ id, deletedAt: '2026-10-06T18:00:00.000Z' }) }
    })
    vi.mocked(listClinicalRecords).mockResolvedValue({ ok: true, value: [] })
    vi.mocked(listClinicalContext).mockResolvedValue({
      ok: true,
      value: { procedures: [], treatments: [], sessions: [] },
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
  })

  it('renders the active clinic list', async () => {
    renderPatients()
    expect(await screen.findByRole('link', { name: 'Ana Sintetica' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Bia Sintetica' })).toBeTruthy()
    expect(screen.getByText('Clínica Norte. Lista ativa, sem pacientes arquivadas.')).toBeTruthy()
    expect(screen.getAllByText('(92) 99999-9999').length).toBeGreaterThan(0)
    expect(listPatients).toHaveBeenCalled()
    expect(createClient).toHaveBeenCalled()
  })

  it('shows a loading state until the repository answers', async () => {
    let release: (() => void) | null = null
    vi.mocked(listPatients).mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ ok: true, value: db.patients })
        }),
    )
    renderPatients()
    await waitFor(() => expect(listPatients).toHaveBeenCalled())
    expect(screen.queryByRole('link', { name: 'Ana Sintetica' })).toBeNull()
    expect(screen.getByText('Carregando pacientes…')).toBeTruthy()
    release?.()
    expect(await screen.findByRole('link', { name: 'Ana Sintetica' })).toBeTruthy()
  })

  it('shows an empty state when the clinic has no active patients', async () => {
    db.patients = []
    renderPatients()
    expect(await screen.findByText('Nenhuma paciente')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Ana Sintetica' })).toBeNull()
  })

  it('shows a repository error without inventing patients', async () => {
    db.listError = new PatientRepositoryError('repository_error', 'Não foi possível concluir a operação de paciente.')
    renderPatients()
    expect(await screen.findByText('Não foi possível listar')).toBeTruthy()
    expect(screen.getByText('Não foi possível concluir a operação de paciente.')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Ana Sintetica' })).toBeNull()
  })

  it('filters the loaded list locally', async () => {
    renderPatients()
    expect(await screen.findByRole('link', { name: 'Ana Sintetica' })).toBeTruthy()
    expect(listPatients).toHaveBeenCalledTimes(1)
    fireEvent.change(screen.getByLabelText('Buscar pacientes'), { target: { value: 'bia' } })
    expect(screen.queryByRole('link', { name: 'Ana Sintetica' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Bia Sintetica' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Buscar pacientes'), { target: { value: 'ana@example.com' } })
    expect(screen.getByRole('link', { name: 'Ana Sintetica' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Bia Sintetica' })).toBeNull()
    fireEvent.change(screen.getByLabelText('Buscar pacientes'), { target: { value: 'ninguém' } })
    expect(screen.getByText('Nenhum resultado')).toBeTruthy()
    expect(listPatients).toHaveBeenCalledTimes(1)
  })

  it('opens a patient from the list', async () => {
    renderPatients()
    fireEvent.click(await screen.findByRole('link', { name: 'Ana Sintetica' }))
    expect(await screen.findByRole('heading', { name: 'Ana Sintetica' })).toBeTruthy()
    expect(screen.getByText('Resumo')).toBeTruthy()
    expect(screen.getByText('Histórico')).toBeTruthy()
    expect(screen.getAllByText('Em construção')).toHaveLength(6)
    expect(screen.getByText('Histórico de tratamentos')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Evoluções clínicas' })).toBeTruthy()
    expect(await screen.findByText('Nenhuma evolução')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Nova evolução' })).toBeTruthy()
    expect(screen.getByText('Documentos e consentimentos')).toBeTruthy()
    expect(screen.getByText('Agenda')).toBeTruthy()
    expect(getPatientById).toHaveBeenCalledWith(expect.objectContaining({ activeClinicId: 'clinic-a' }), 'patient-1')
    expect(listClinicalRecords).toHaveBeenCalledWith(expect.objectContaining({ activeClinicId: 'clinic-a' }), 'patient-1')
    expect(vi.mocked(listClinicalRecords).mock.calls[0]).toHaveLength(2)
  })

  it('creates a patient through the repository', async () => {
    renderPatients()
    fireEvent.click(await screen.findByRole('button', { name: 'Nova paciente' }))
    fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: '  Clara Sintetica  ' } })
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'clara@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar' }))
    expect(await screen.findByRole('link', { name: 'Clara Sintetica' })).toBeTruthy()
    expect(createPatient).toHaveBeenCalledTimes(1)
    const input = vi.mocked(createPatient).mock.calls[0][1]
    expect(input.fullName).toBe('  Clara Sintetica  ')
    expect(input).not.toHaveProperty('clinicId')
    expect(input).not.toHaveProperty('clinic_id')
    expect(JSON.stringify(input)).not.toContain('clinic-b')
  })

  it('edits basic data and does not send a clinic id', async () => {
    renderPatients('/v3/patients/patient-1')
    fireEvent.click(await screen.findByRole('button', { name: 'Editar dados' }))
    fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '11988887777' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(updatePatient).toHaveBeenCalled())
    const input = vi.mocked(updatePatient).mock.calls[0][2]
    expect(input.phone).toBe('11988887777')
    expect(input).not.toHaveProperty('clinicId')
    expect(input).not.toHaveProperty('clinic_id')
    expect(input).not.toHaveProperty('id')
    expect(input).not.toHaveProperty('deletedAt')
    expect(await screen.findByText('(11) 98888-7777')).toBeTruthy()
  })

  it('archives through soft delete after confirmation', async () => {
    db.patients = [sample()]
    renderPatients('/v3/patients/patient-1')
    fireEvent.click(await screen.findByRole('button', { name: 'Arquivar' }))
    expect(screen.getByRole('heading', { name: 'Arquivar paciente?' })).toBeTruthy()
    expect(
      screen.getByText('Ela deixará de aparecer na lista ativa, mas seus registros permanecerão preservados.'),
    ).toBeTruthy()
    expect(softDeletePatient).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar arquivamento' }))
    await waitFor(() => expect(softDeletePatient).toHaveBeenCalledWith(expect.anything(), 'patient-1'))
    expect(await screen.findByText('Nenhuma paciente')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Ana Sintetica' })).toBeNull()
  })

  it('shows a missing patient without inventing a record', async () => {
    db.detail = null
    renderPatients('/v3/patients/missing')
    expect(await screen.findByText('Paciente não encontrada')).toBeTruthy()
    expect(screen.queryByText('Histórico de tratamentos')).toBeNull()
    expect(screen.queryByText('Nenhuma evolução')).toBeNull()
    expect(getPatientById).toHaveBeenCalledWith(expect.objectContaining({ activeClinicId: 'clinic-a' }), 'missing')
    expect(listClinicalRecords).not.toHaveBeenCalled()
  })

  it('asks for a session and does not call the repository', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    renderPatients()
    expect(await screen.findByText('Sessão necessária')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Nova paciente' })).toBeNull()
    expect(listPatients).not.toHaveBeenCalled()
  })

  it('does not load patients without a clinic membership', async () => {
    db.memberships = []
    renderPatients()
    expect(await screen.findByText('Sem clínica')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Nova paciente' })).toBeNull()
    expect(listPatients).not.toHaveBeenCalled()
  })

  it('hides manage actions when the role cannot manage patients', async () => {
    db.memberships = [membership('finance')]
    renderPatients()
    expect(await screen.findByText('Acesso restrito')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Nova paciente' })).toBeNull()
    expect(listPatients).not.toHaveBeenCalled()
    expect(listClinicalRecords).not.toHaveBeenCalled()
  })

  it('keeps Patient 360 off V2 identity and storage', () => {
    const files = readdirSync('src/pages/v3').map((name) => `src/pages/v3/${name}`)
    files.push('src/v3/V3PatientRoutes.tsx')
    const combined = files.map((file) => readFileSync(file, 'utf8')).join('\n')
    expect(combined).not.toContain('AuthContext')
    expect(combined).not.toContain('ClinicContext')
    expect(combined).not.toContain('localStorage')
    expect(combined).not.toContain('service_role')
    expect(combined).not.toContain('createClient')
    expect(combined).not.toContain('storage.ts')
    expect(combined).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    expect(combined.toLowerCase()).not.toContain('evelyn')
    expect(readFileSync('src/pages/v3/V3PatientsPage.tsx', 'utf8')).toContain('createPatient')
    expect(readFileSync('src/pages/v3/V3PatientsPage.tsx', 'utf8')).not.toContain(".from(")
    expect(readFileSync('src/pages/v3/V3PatientDetailPage.tsx', 'utf8')).toContain('updatePatient')
    expect(readFileSync('src/pages/v3/V3PatientDetailPage.tsx', 'utf8')).toContain('softDeletePatient')
    expect(readFileSync('src/App.tsx', 'utf8').toLowerCase()).not.toContain('supabase')
    expect(readFileSync('src/App.tsx', 'utf8')).not.toContain('patientRepository')
    const routes = readFileSync('src/v3/V3PatientRoutes.tsx', 'utf8')
    expect(routes.indexOf("VITE_SUPABASE_AUTH_ENABLED === 'true'")).toBeLessThan(
      routes.indexOf("import('../pages/v3/V3PatientsPage.tsx')"),
    )
  })
})

describe('patient directory search', () => {
  it('matches name, email, phone and cpf', () => {
    const patients = [
      sample(),
      sample({ id: 'patient-2', fullName: 'Bia Sintetica', email: 'bia@example.com', phone: '1133334444', cpf: null }),
    ]
    expect(filterPatients(patients, '').map((patient) => patient.id)).toEqual(['patient-1', 'patient-2'])
    expect(filterPatients(patients, 'ANA').map((patient) => patient.id)).toEqual(['patient-1'])
    expect(filterPatients(patients, 'bia@example.com').map((patient) => patient.id)).toEqual(['patient-2'])
    expect(filterPatients(patients, '99999').map((patient) => patient.id)).toEqual(['patient-1'])
    expect(filterPatients(patients, '000.000.000-00').map((patient) => patient.id)).toEqual(['patient-1'])
  })
})
