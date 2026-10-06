import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetSupabaseClientForTests } from '../src/lib/supabase'
import { mapV2PatientToCreateInput } from '../src/services/patientMapping'
import {
  createPatient,
  getPatientById,
  listPatients,
  softDeletePatient,
  updatePatient,
} from '../src/services/patientRepository'
import type { Patient } from '../src/types'
import type { V3PatientCreateInput, V3PatientUpdateInput } from '../src/types/patient'
import type { SupabaseClinicRole } from '../src/types/supabaseAuth'
import type { V3TenantSnapshot, V3TenantStatus } from '../src/types/v3Tenant'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

const CLINIC = 'clinic-from-tenant'

interface DbError {
  code?: string
  message?: string
}

const db = vi.hoisted(() => ({
  data: null as unknown,
  error: null as DbError | null,
  throwNetwork: false,
  from: [] as string[],
  insert: [] as unknown[],
  update: [] as unknown[],
  deletes: 0,
  filters: [] as string[],
}))

function queryResult() {
  const response = { data: db.data, error: db.error }
  const builder = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      db.filters.push(`eq:${column}:${String(value)}`)
      return builder
    },
    is: (column: string, value: unknown) => {
      db.filters.push(`is:${column}:${String(value)}`)
      return builder
    },
    order: (column: string, options: { ascending?: boolean }) => {
      db.filters.push(`order:${column}:${String(options.ascending)}`)
      return builder
    },
    insert: (row: unknown) => {
      db.insert.push(row)
      return builder
    },
    update: (row: unknown) => {
      db.update.push(row)
      return builder
    },
    delete: () => {
      db.deletes += 1
      return builder
    },
    maybeSingle: () => {
      if (db.throwNetwork) return Promise.reject(new TypeError('Failed to fetch'))
      return Promise.resolve(response)
    },
    then: (
      onFulfilled: (value: typeof response) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => {
      if (db.throwNetwork) return Promise.reject(new TypeError('Failed to fetch')).then(onFulfilled, onRejected)
      return Promise.resolve(response).then(onFulfilled, onRejected)
    },
  }
  return builder
}

function installClient() {
  const from = vi.fn((table: string) => {
    db.from.push(table)
    return queryResult()
  })
  vi.mocked(createClient).mockReturnValue({ from } as unknown as SupabaseClient)
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'patient-1',
    clinic_id: CLINIC,
    full_name: 'Paciente Sintetico',
    email: 'sintetico@example.com',
    phone: null,
    cpf: null,
    birth_date: null,
    gender: null,
    address: null,
    allergies: null,
    medications: null,
    notes: null,
    status: 'active',
    deleted_at: null,
    created_at: '2026-10-06T00:00:00.000Z',
    updated_at: '2026-10-06T00:00:00.000Z',
    ...overrides,
  }
}

function snapshot(status: V3TenantStatus, role: SupabaseClinicRole = 'admin'): V3TenantSnapshot {
  const ready = status === 'authenticated_ready'
  return {
    status,
    userId: status === 'unauthenticated' || status === 'loading' ? null : 'user-1',
    profile: ready ? { id: 'user-1', fullName: 'Staff', email: 'staff@example.com' } : null,
    memberships: ready
      ? [{ id: 'membership-1', clinicId: CLINIC, userId: 'user-1', role, isActive: true }]
      : [],
    activeClinicId: ready ? CLINIC : null,
    activeClinic: ready
      ? { id: CLINIC, name: 'Clinica de teste', slug: 'clinica-de-teste', timezone: 'America/Manaus' }
      : null,
    activeRole: ready ? role : null,
    error: null,
  }
}

describe('patient repository', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    resetSupabaseClientForTests()
    vi.mocked(createClient).mockClear()
    db.data = null
    db.error = null
    db.throwNetwork = false
    db.from = []
    db.insert = []
    db.update = []
    db.deletes = 0
    db.filters = []
    installClient()
    vi.stubEnv('VITE_SUPABASE_AUTH_ENABLED', 'true')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
  })

  it('lists nothing and does not open a client without an active tenant', async () => {
    const result = await listPatients(snapshot('unauthenticated'))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('unauthenticated')
    expect(createClient).not.toHaveBeenCalled()
    expect(db.from).toEqual([])
  })

  it('lists the active clinic and keeps soft-deleted rows out', async () => {
    db.data = [row(), row({ id: 'patient-2', full_name: 'Segundo' })]
    const result = await listPatients(snapshot('authenticated_ready'))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.map((patient) => patient.fullName)).toEqual(['Paciente Sintetico', 'Segundo'])
      expect(result.value.every((patient) => patient.clinicId === CLINIC)).toBe(true)
    }
    expect(db.from).toEqual(['patients'])
    expect(db.filters).toContain(`eq:clinic_id:${CLINIC}`)
    expect(db.filters).toContain('is:deleted_at:null')
    expect(db.filters).toContain('order:created_at:false')
  })

  it('gets one patient by id inside the active clinic', async () => {
    db.data = row()
    const result = await getPatientById(snapshot('authenticated_ready'), 'patient-1')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.id).toBe('patient-1')
    expect(db.filters).toContain('eq:id:patient-1')
    expect(db.filters).toContain(`eq:clinic_id:${CLINIC}`)
  })

  it('refuses create when there is no active clinic', async () => {
    const result = await createPatient(snapshot('authenticated_without_membership'), { fullName: 'Novo' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('no_active_clinic')
    expect(db.insert).toEqual([])
    expect(createClient).not.toHaveBeenCalled()
  })

  it('creates a patient with clinic_id taken from the tenant snapshot', async () => {
    db.data = row({ full_name: 'Novo Paciente' })
    const result = await createPatient(snapshot('authenticated_ready', 'assistant'), {
      fullName: '  Novo Paciente  ',
      email: '  ',
      status: 'active',
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.fullName).toBe('Novo Paciente')
    expect(db.insert).toEqual([
      expect.objectContaining({
        clinic_id: CLINIC,
        full_name: 'Novo Paciente',
        email: null,
        status: 'active',
      }),
    ])
  })

  it('updates fields and never writes clinic_id', async () => {
    db.data = row({ notes: 'retorno' })
    const result = await updatePatient(snapshot('authenticated_ready'), 'patient-1', { notes: 'retorno' })
    expect(result.ok).toBe(true)
    expect(db.update).toEqual([{ notes: 'retorno' }])
    expect(JSON.stringify(db.update)).not.toContain('clinic_id')
    expect(db.filters).toContain(`eq:clinic_id:${CLINIC}`)
  })

  it('rejects a clinic transfer before touching patients', async () => {
    const input = { notes: 'mover', clinic_id: 'outra-clinica' } as V3PatientUpdateInput
    const result = await updatePatient(snapshot('authenticated_ready'), 'patient-1', input)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('clinic_transfer_rejected')
    expect(db.from).toEqual([])
    expect(db.update).toEqual([])

    const created = await createPatient(
      snapshot('authenticated_ready'),
      { fullName: 'Novo', clinicId: 'outra-clinica' } as V3PatientCreateInput,
    )
    expect(created.ok).toBe(false)
    if (!created.ok) expect(created.error.code).toBe('clinic_transfer_rejected')
    expect(db.insert).toEqual([])
  })

  it('refuses finance before querying patients', async () => {
    const result = await listPatients(snapshot('authenticated_ready', 'finance'))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('forbidden')
    expect(db.from).toEqual([])
    expect(createClient).not.toHaveBeenCalled()
  })

  it('maps a surfaced RLS error to forbidden instead of patient_not_found', async () => {
    db.error = { code: '42501', message: 'new row violates row-level security policy' }
    const result = await createPatient(snapshot('authenticated_ready'), { fullName: 'Bloqueado' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('forbidden')
      expect(result.error.code).not.toBe('patient_not_found')
      expect(result.error.message).not.toMatch(/row-level security/i)
    }
  })

  it('reports a missing patient when the query returns no row', async () => {
    db.data = null
    const result = await getPatientById(snapshot('authenticated_ready'), 'missing')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('patient_not_found')
  })

  it('soft-deletes by setting deleted_at and does not call delete', async () => {
    db.data = row({ deleted_at: '2026-10-06T01:00:00.000Z' })
    const result = await softDeletePatient(snapshot('authenticated_ready'), 'patient-1')
    expect(result.ok).toBe(true)
    expect(db.deletes).toBe(0)
    expect(db.update).toHaveLength(1)
    expect(db.update[0]).toEqual({ deleted_at: expect.any(String) })
  })

  it('maps the clinic_id trigger and network failures without hiding them as not found', async () => {
    db.error = { code: 'P0001', message: 'clinic_id is immutable' }
    const immutable = await updatePatient(snapshot('authenticated_ready'), 'patient-1', { notes: 'x' })
    expect(immutable.ok).toBe(false)
    if (!immutable.ok) expect(immutable.error.code).toBe('clinic_transfer_rejected')

    db.error = null
    db.throwNetwork = true
    const network = await listPatients(snapshot('authenticated_ready'))
    expect(network.ok).toBe(false)
    if (!network.ok) expect(network.error.code).toBe('repository_error')
  })

  it('keeps the repository on the official client and off V2 identity stores', () => {
    const files = [
      'src/services/patientRepository.ts',
      'src/services/patientMapping.ts',
      'src/types/patient.ts',
      'src/lib/patientRepositoryError.ts',
    ]
    const combined = files.map((file) => readFileSync(file, 'utf8')).join('\n')
    expect(combined).toContain('getSupabaseClient')
    expect(combined).not.toContain('localStorage')
    expect(combined).not.toContain('service_role')
    expect(combined).not.toContain('createClient')
    expect(combined).not.toContain('AuthContext')
    expect(combined).not.toContain('ClinicContext')
    expect(combined).not.toContain('storage.ts')
    expect(combined).not.toContain('auth.ts')
    expect(combined).not.toMatch(/from '\.\.\/lib\/auth'|from '\.\/auth'/)
    expect(combined).not.toContain(CLINIC)
    expect(combined).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    expect(combined.toLowerCase()).not.toContain('evelyn')
  })

  it('leaves the V2 patient screens independent of the repository', () => {
    const files = [
      'src/pages/PatientsPage.tsx',
      'src/pages/PatientDetailPage.tsx',
      'src/context/AuthContext.tsx',
      'src/context/ClinicContext.tsx',
      'src/App.tsx',
      'src/lib/storage.ts',
      'src/lib/auth.ts',
    ]
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      expect(source, file).not.toContain('patientRepository')
      expect(source, file).not.toContain('V3Tenant')
    }
  })

  it('maps a V2 patient without inventing a clinic id', () => {
    const patient: Patient = {
      id: 'local-1',
      name: 'Local',
      email: 'local@example.com',
      phone: '92999999999',
      cpf: '00000000000',
      birthDate: '1990-01-02',
      gender: 'feminino',
      address: 'Rua 1',
      allergies: '',
      medications: '',
      notes: '',
      status: 'em_tratamento',
      tags: ['vip'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const input = mapV2PatientToCreateInput(patient)
    expect(input).toEqual({
      fullName: 'Local',
      email: 'local@example.com',
      phone: '92999999999',
      cpf: '00000000000',
      birthDate: '1990-01-02',
      gender: 'feminino',
      address: 'Rua 1',
      allergies: '',
      medications: '',
      notes: '',
      status: 'in_treatment',
    })
    expect(input).not.toHaveProperty('clinicId')
    expect(input).not.toHaveProperty('clinic_id')
    expect(input).not.toHaveProperty('tags')
  })

  it('stays unauthenticated when the feature flag is off', async () => {
    vi.stubEnv('VITE_SUPABASE_AUTH_ENABLED', 'false')
    const result = await listPatients(snapshot('authenticated_ready'))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('unauthenticated')
    expect(createClient).not.toHaveBeenCalled()
  })
})
