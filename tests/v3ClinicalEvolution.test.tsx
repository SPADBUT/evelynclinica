import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseAuthProvider } from '../src/context/SupabaseAuthContext'
import { V3TenantProvider } from '../src/context/V3TenantContext'
import { ClinicalRepositoryError } from '../src/lib/clinicalRepositoryError'
import { resetSupabaseClientForTests } from '../src/lib/supabase'
import { V3PatientDetailPage } from '../src/pages/v3/V3PatientDetailPage'
import {
  appendClinicalRecordVersion,
  createClinicalRecord,
  listClinicalContext,
  listClinicalRecords,
} from '../src/services/clinicalRepository'
import { getPatientById } from '../src/services/patientRepository'
import type { V3ClinicalRecord } from '../src/types/clinicalRecord'
import type { V3Patient } from '../src/types/patient'

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

vi.mock('../src/services/clinicalRepository', () => ({
  listClinicalRecords: vi.fn(),
  listClinicalContext: vi.fn(),
  getClinicalRecord: vi.fn(),
  createClinicalRecord: vi.fn(),
  appendClinicalRecordVersion: vi.fn(),
  finalizeClinicalRecord: vi.fn(),
  cancelClinicalRecord: vi.fn(),
}))

const state = vi.hoisted(() => ({
  role: 'admin',
  records: [] as V3ClinicalRecord[],
  listError: null as ClinicalRepositoryError | null,
}))

function patient(): V3Patient {
  return {
    id: 'patient-1',
    clinicId: 'clinic-a',
    fullName: 'Ana Sintetica',
    email: 'ana@example.com',
    phone: null,
    cpf: null,
    birthDate: null,
    gender: null,
    address: null,
    allergies: null,
    medications: null,
    notes: null,
    status: 'active',
    deletedAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-07T00:00:00.000Z',
  }
}

function record(overrides: Partial<V3ClinicalRecord> = {}): V3ClinicalRecord {
  return {
    id: 'record-1',
    clinicId: 'clinic-a',
    patientId: 'patient-1',
    treatmentId: null,
    treatmentSessionId: 'session-1',
    procedureId: null,
    status: 'finalized',
    currentVersionId: 'version-2',
    createdBy: 'user-1',
    createdAt: '2026-10-07T12:00:00.000Z',
    updatedAt: '2026-10-07T13:00:00.000Z',
    sessionNumber: 2,
    versions: [
      {
        id: 'version-2',
        recordId: 'record-1',
        clinicId: 'clinic-a',
        versionNumber: 2,
        procedureName: 'Limpeza',
        professionalName: 'Staff Norte',
        anamnesis: '',
        evolution: 'texto corrigido',
        productsUsedSummary: null,
        nextSteps: '',
        changeReason: 'correção',
        recordedAt: '2026-10-07T13:00:00.000Z',
        createdBy: 'user-1',
        createdAt: '2026-10-07T13:00:00.000Z',
      },
      {
        id: 'version-1',
        recordId: 'record-1',
        clinicId: 'clinic-a',
        versionNumber: 1,
        procedureName: 'Limpeza',
        professionalName: null,
        anamnesis: '',
        evolution: 'texto original',
        productsUsedSummary: null,
        nextSteps: '',
        changeReason: null,
        recordedAt: '2026-10-07T12:00:00.000Z',
        createdBy: 'user-1',
        createdAt: '2026-10-07T12:00:00.000Z',
      },
    ],
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

function installClient() {
  const auth = {
    getSession: vi.fn().mockResolvedValue({
      data: { session: { access_token: 'token', user: { id: 'user-1', email: 'staff@example.com' } } },
      error: null,
    }),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  }
  const from = vi.fn((table: string) => {
    if (table === 'profiles') return queryResult({ id: 'user-1', full_name: 'Staff Norte', email: 'staff@example.com' })
    if (table === 'clinic_memberships') {
      return queryResult([
        {
          id: `membership-${state.role}`,
          clinic_id: 'clinic-a',
          user_id: 'user-1',
          role: state.role,
          is_active: true,
        },
      ])
    }
    if (table === 'clinics') {
      return queryResult({ id: 'clinic-a', name: 'Clínica Norte', slug: 'clinica-norte', timezone: 'America/Manaus' })
    }
    throw new Error(`unexpected table ${table}`)
  })
  vi.mocked(createClient).mockReturnValue({ auth, from } as unknown as SupabaseClient)
}

function renderDetail() {
  return render(
    <SupabaseAuthProvider>
      <V3TenantProvider>
        <MemoryRouter initialEntries={['/v3/patients/patient-1']}>
          <Routes>
            <Route path="/v3/patients/:id" element={<V3PatientDetailPage />} />
          </Routes>
        </MemoryRouter>
      </V3TenantProvider>
    </SupabaseAuthProvider>,
  )
}

describe('clinical evolution on Patient 360', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_AUTH_ENABLED', 'true')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    resetSupabaseClientForTests()
    state.role = 'admin'
    state.records = []
    state.listError = null
    installClient()
    vi.mocked(getPatientById).mockResolvedValue({ ok: true, value: patient() })
    vi.mocked(listClinicalRecords).mockImplementation(async () => {
      if (state.listError) return { ok: false, error: state.listError }
      return { ok: true, value: state.records }
    })
    vi.mocked(listClinicalContext).mockResolvedValue({
      ok: true,
      value: {
        procedures: [{ id: 'proc-1', name: 'Limpeza' }],
        treatments: [{ id: 'treat-1', name: 'Plano' }],
        sessions: [{ id: 'session-1', treatmentId: 'treat-1', sessionNumber: 2 }],
      },
    })
    vi.mocked(createClinicalRecord).mockImplementation(async (_tenant, input) => {
      const created = record({
        status: 'draft',
        currentVersionId: 'version-1',
        treatmentSessionId: input.treatmentSessionId ?? null,
        versions: [
          {
            ...record().versions[1],
            evolution: input.evolution ?? '',
            procedureName: input.procedureName ?? null,
            professionalName: 'Staff Norte',
          },
        ],
      })
      state.records = [created]
      return { ok: true, value: created }
    })
    vi.mocked(appendClinicalRecordVersion).mockImplementation(async () => {
      state.records = [record()]
      return { ok: true, value: record() }
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
  })

  it('shows an empty state and creates an evolution without a clinic id', async () => {
    renderDetail()
    expect(await screen.findByText('Nenhuma evolução')).toBeTruthy()
    expect(screen.queryByText('Limpeza')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Nova evolução' }))
    fireEvent.change(screen.getByLabelText('Procedimento do catálogo'), { target: { value: 'proc-1' } })
    fireEvent.change(screen.getByLabelText('Tratamento'), { target: { value: 'treat-1' } })
    fireEvent.change(screen.getByLabelText('Sessão'), { target: { value: 'session-1' } })
    fireEvent.change(screen.getByLabelText('Observações clínicas'), { target: { value: 'texto clinico seguro' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar evolução' }))
    await waitFor(() => expect(createClinicalRecord).toHaveBeenCalled())
    const input = vi.mocked(createClinicalRecord).mock.calls[0][1]
    expect(input.patientId).toBe('patient-1')
    expect(input.procedureName).toBe('Limpeza')
    expect(input.treatmentSessionId).toBe('session-1')
    expect(input).not.toHaveProperty('clinicId')
    expect(input).not.toHaveProperty('clinic_id')
    expect(input).not.toHaveProperty('professionalName')
    expect(await screen.findAllByText('texto clinico seguro')).toHaveLength(2)
    expect(screen.getByText('Sessão 2')).toBeTruthy()
    expect(screen.getAllByText('Staff Norte')).toHaveLength(2)
    expect(screen.getAllByText('Rascunho')).toHaveLength(2)
  })

  it('shows the current version and keeps the previous text in history', async () => {
    state.records = [record()]
    renderDetail()
    expect(await screen.findByText('texto corrigido')).toBeTruthy()
    expect(screen.getByText('Finalizada')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    fireEvent.click(screen.getByRole('button', { name: 'Versão 1' }))
    expect(screen.getByText('texto original')).toBeTruthy()
    expect(screen.getAllByText('Staff Norte')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Nova versão' }))
    fireEvent.change(screen.getByLabelText('Motivo da alteração'), { target: { value: 'correção' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar versão' }))
    await waitFor(() => expect(appendClinicalRecordVersion).toHaveBeenCalled())
    const input = vi.mocked(appendClinicalRecordVersion).mock.calls[0][2]
    expect(input).not.toHaveProperty('clinic_id')
    expect(input.changeReason).toBe('correção')
  })

  it('shows a repository error without inventing an evolution', async () => {
    state.listError = new ClinicalRepositoryError('repository_error', 'Não foi possível concluir a operação de evolução.')
    renderDetail()
    expect(await screen.findByText('Não foi possível carregar')).toBeTruthy()
    expect(screen.getByText('Não foi possível concluir a operação de evolução.')).toBeTruthy()
    expect(screen.queryByText('Limpeza')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Nova evolução' })).toBeNull()
  })

  it('hides clinical content from an assistant', async () => {
    state.role = 'assistant'
    renderDetail()
    expect(await screen.findByText('Conteúdo clínico restrito')).toBeTruthy()
    expect(screen.getByText('Este papel não consulta evolução clínica.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Nova evolução' })).toBeNull()
    expect(listClinicalRecords).not.toHaveBeenCalled()
    expect(listClinicalContext).not.toHaveBeenCalled()
  })
})
