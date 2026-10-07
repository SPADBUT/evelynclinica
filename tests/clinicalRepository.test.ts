import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetSupabaseClientForTests } from '../src/lib/supabase'
import { clinicalSummary } from '../src/pages/v3/clinicalDirectory'
import {
  assembleClinicalRecord,
  currentClinicalVersion,
  readClinicalHeader,
  readClinicalVersion,
} from '../src/services/clinicalMapping'
import {
  appendClinicalRecordVersion,
  cancelClinicalRecord,
  createClinicalRecord,
  finalizeClinicalRecord,
  getClinicalRecord,
  listClinicalContext,
  listClinicalRecords,
} from '../src/services/clinicalRepository'
import type { V3ClinicalRecordInput } from '../src/types/clinicalRecord'
import type { SupabaseClinicMembership, SupabaseClinicRole } from '../src/types/supabaseAuth'
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
  queue: [] as Array<{ data: unknown; error: DbError | null }>,
  rpcError: null as DbError | null,
  throwNetwork: false,
  from: [] as string[],
  insert: [] as Array<{ table: string; row: Record<string, unknown> }>,
  update: [] as Array<{ table: string; row: Record<string, unknown> }>,
  rpc: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  filters: [] as string[],
  deletes: [] as string[],
}))

function take() {
  if (db.throwNetwork) return Promise.reject(new TypeError('Failed to fetch'))
  const next = db.queue.shift()
  if (!next) return Promise.resolve({ data: null, error: { code: 'TEST', message: 'test queue empty' } })
  return Promise.resolve(next)
}

function installClient() {
  const from = vi.fn((table: string) => {
    db.from.push(table)
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        db.filters.push(`${table}:eq:${column}:${String(value)}`)
        return builder
      },
      is: (column: string, value: unknown) => {
        db.filters.push(`${table}:is:${column}:${String(value)}`)
        return builder
      },
      in: (column: string, value: unknown) => {
        const printed = Array.isArray(value) ? value.map(String).join(',') : String(value)
        db.filters.push(`${table}:in:${column}:${printed}`)
        return builder
      },
      order: (column: string, options: { ascending?: boolean }) => {
        db.filters.push(`${table}:order:${column}:${String(options.ascending)}`)
        return builder
      },
      insert: (row: Record<string, unknown>) => {
        db.insert.push({ table, row })
        return builder
      },
      update: (row: Record<string, unknown>) => {
        db.update.push({ table, row })
        return builder
      },
      delete: () => {
        db.deletes.push(table)
        return builder
      },
      maybeSingle: () => take(),
      then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
        take().then(onFulfilled, onRejected),
    }
    return builder
  })
  const rpc = vi.fn((fn: string, args: Record<string, unknown>) => {
    db.rpc.push({ fn, args })
    if (db.throwNetwork) return Promise.reject(new TypeError('Failed to fetch'))
    const id = typeof args.p_clinical_record_id === 'string' ? args.p_clinical_record_id : 'record-1'
    return Promise.resolve({ data: db.rpcError ? null : id, error: db.rpcError })
  })
  vi.mocked(createClient).mockReturnValue({ from, rpc } as unknown as SupabaseClient)
}

function push(data: unknown, error: DbError | null = null) {
  db.queue.push({ data, error })
}

function patientRow(overrides: Record<string, unknown> = {}) {
  return { id: 'patient-1', clinic_id: CLINIC, deleted_at: null, ...overrides }
}

function header(overrides: Record<string, unknown> = {}) {
  return {
    id: 'record-1',
    clinic_id: CLINIC,
    patient_id: 'patient-1',
    treatment_id: null,
    treatment_session_id: null,
    procedure_id: null,
    status: 'draft',
    current_version_id: 'version-1',
    created_by: 'user-1',
    created_at: '2026-10-07T12:00:00.000Z',
    updated_at: '2026-10-07T12:00:00.000Z',
    treatment_sessions: null,
    ...overrides,
  }
}

function version(overrides: Record<string, unknown> = {}) {
  return {
    id: 'version-1',
    clinic_id: CLINIC,
    clinical_record_id: 'record-1',
    version_number: 1,
    procedure_name: 'Limpeza',
    professional_name: 'Staff',
    anamnesis: '',
    evolution: 'texto original',
    products_used_summary: null,
    next_steps: '',
    change_reason: null,
    recorded_at: '2026-10-07T12:00:00.000Z',
    created_by: 'user-1',
    created_at: '2026-10-07T12:00:00.000Z',
    ...overrides,
  }
}

function snapshot(status: V3TenantStatus, role: SupabaseClinicRole = 'professional'): V3TenantSnapshot {
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

describe('clinical mapping', () => {
  it('reads a version and hides a blank professional name', () => {
    const parsed = readClinicalVersion(version({ professional_name: '  ' }))
    expect(parsed?.professionalName).toBeNull()
    expect(parsed?.procedureName).toBe('Limpeza')
    expect(readClinicalVersion({ id: 'x' })).toBeNull()
  })

  it('points at the current version and keeps older ones ordered', () => {
    const older = readClinicalVersion(version())
    const newer = readClinicalVersion(version({ id: 'version-2', version_number: 2, evolution: 'texto corrigido' }))
    const row = readClinicalHeader(header({ current_version_id: 'version-1', treatment_sessions: { session_number: 3 } }))
    expect(older && newer && row).toBeTruthy()
    if (!older || !newer || !row) return
    const record = assembleClinicalRecord(row, [older, newer])
    expect(record.versions.map((item) => item.versionNumber)).toEqual([2, 1])
    expect(record.sessionNumber).toBe(3)
    expect(currentClinicalVersion(record)?.id).toBe('version-1')
    expect(currentClinicalVersion({ ...record, currentVersionId: null })?.versionNumber).toBe(2)
  })

  it('summarizes an empty evolution without inventing clinical text', () => {
    expect(clinicalSummary('   ')).toBe('Sem observações clínicas.')
    expect(clinicalSummary('retorno')).toBe('retorno')
    expect(clinicalSummary('a'.repeat(180)).endsWith('…')).toBe(true)
    expect(clinicalSummary('a'.repeat(180)).length).toBeLessThanOrEqual(160)
  })
})

describe('clinical repository', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    resetSupabaseClientForTests()
    vi.mocked(createClient).mockClear()
    db.queue = []
    db.rpcError = null
    db.throwNetwork = false
    db.from = []
    db.insert = []
    db.update = []
    db.rpc = []
    db.filters = []
    db.deletes = []
    installClient()
    vi.stubEnv('VITE_SUPABASE_AUTH_ENABLED', 'true')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
  })

  it('does not query without an active clinic or clinical role', async () => {
    const missing = await listClinicalRecords(snapshot('unauthenticated'), 'patient-1')
    expect(missing.ok).toBe(false)
    if (!missing.ok) expect(missing.error.code).toBe('unauthenticated')

    const noClinic = await listClinicalRecords(snapshot('authenticated_without_membership'), 'patient-1')
    expect(noClinic.ok).toBe(false)
    if (!noClinic.ok) expect(noClinic.error.code).toBe('no_active_clinic')

    const finance = await listClinicalRecords(snapshot('authenticated_ready', 'finance'), 'patient-1')
    expect(finance.ok).toBe(false)
    if (!finance.ok) expect(finance.error.code).toBe('forbidden')

    const assistant = await createClinicalRecord(snapshot('authenticated_ready', 'assistant'), {
      patientId: 'patient-1',
      procedureName: 'Limpeza',
    })
    expect(assistant.ok).toBe(false)
    if (!assistant.ok) expect(assistant.error.code).toBe('forbidden')

    const inactive = snapshot('authenticated_ready', 'professional')
    inactive.memberships = [{ ...inactive.memberships[0], isActive: false } as SupabaseClinicMembership]
    const inactiveResult = await getClinicalRecord(inactive, 'record-1')
    expect(inactiveResult.ok).toBe(false)
    if (!inactiveResult.ok) expect(inactiveResult.error.code).toBe('forbidden')

    expect(createClient).not.toHaveBeenCalled()
    expect(db.from).toEqual([])
  })

  it('lists only the active clinic and patient, including an empty state', async () => {
    push(patientRow())
    push([])
    const empty = await listClinicalRecords(snapshot('authenticated_ready'), 'patient-1')
    expect(empty.ok).toBe(true)
    if (empty.ok) expect(empty.value).toEqual([])
    expect(db.from).toEqual(['patients', 'clinical_records'])
    expect(db.filters).toContain(`patients:eq:clinic_id:${CLINIC}`)
    expect(db.filters).toContain('patients:eq:id:patient-1')
    expect(db.filters).toContain('patients:is:deleted_at:null')
    expect(db.filters).toContain(`clinical_records:eq:clinic_id:${CLINIC}`)
    expect(db.filters).toContain('clinical_records:eq:patient_id:patient-1')
  })

  it('drops another clinic from the list and from the version history', async () => {
    push(patientRow())
    push([header(), header({ id: 'record-b', clinic_id: 'clinic-b', patient_id: 'patient-9' })])
    push([
      version(),
      version({
        id: 'version-b',
        clinic_id: 'clinic-b',
        clinical_record_id: 'record-1',
        version_number: 2,
        evolution: 'texto de outra clinica',
      }),
    ])
    const result = await listClinicalRecords(snapshot('authenticated_ready', 'admin'), 'patient-1')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.map((record) => record.id)).toEqual(['record-1'])
      expect(result.value[0].versions.map((item) => item.evolution)).toEqual(['texto original'])
    }
    expect(db.filters).toContain('clinical_record_versions:in:clinical_record_id:record-1')
    expect(JSON.stringify(result)).not.toContain('texto de outra clinica')
  })

  it('treats a hidden record id as not found inside the active clinic', async () => {
    push(null)
    const missing = await getClinicalRecord(snapshot('authenticated_ready'), 'record-b')
    expect(missing.ok).toBe(false)
    if (!missing.ok) expect(missing.error.code).toBe('clinical_record_not_found')
    expect(db.filters).toContain('clinical_records:eq:id:record-b')
    expect(db.filters).toContain(`clinical_records:eq:clinic_id:${CLINIC}`)
    expect(db.from).toEqual(['clinical_records'])

    push(header({ clinic_id: 'clinic-b' }))
    const foreign = await getClinicalRecord(snapshot('authenticated_ready'), 'record-1')
    expect(foreign.ok).toBe(false)
    if (!foreign.ok) expect(foreign.error.code).toBe('clinical_record_not_found')
  })

  it('does not offer another clinic patient in the clinical selects', async () => {
    push(patientRow({ id: 'patient-b', clinic_id: 'clinic-b' }))
    const foreignPatient = await listClinicalContext(snapshot('authenticated_ready'), 'patient-b')
    expect(foreignPatient.ok).toBe(false)
    if (!foreignPatient.ok) expect(foreignPatient.error.code).toBe('patient_not_found')
    expect(db.from).toEqual(['patients'])

    push(patientRow())
    push([
      { id: 'proc-a', clinic_id: CLINIC, name: 'Limpeza', is_active: true },
      { id: 'proc-b', clinic_id: 'clinic-b', name: 'Outra clinica', is_active: true },
      { id: 'proc-off', clinic_id: CLINIC, name: 'Inativo', is_active: false },
    ])
    push([
      { id: 'treat-a', clinic_id: CLINIC, patient_id: 'patient-1', name: 'Plano' },
      { id: 'treat-b', clinic_id: CLINIC, patient_id: 'patient-2', name: 'Outra paciente' },
    ])
    push([
      { id: 'sess-a', clinic_id: CLINIC, patient_id: 'patient-1', treatment_id: 'treat-a', session_number: 2 },
      { id: 'sess-b', clinic_id: 'clinic-b', patient_id: 'patient-1', treatment_id: 'treat-b', session_number: 1 },
    ])
    const context = await listClinicalContext(snapshot('authenticated_ready'), 'patient-1')
    expect(context.ok).toBe(true)
    if (context.ok) {
      expect(context.value.procedures.map((item) => item.name)).toEqual(['Limpeza'])
      expect(context.value.treatments.map((item) => item.name)).toEqual(['Plano'])
      expect(context.value.sessions.map((item) => item.id)).toEqual(['sess-a'])
    }
    expect(db.filters).toContain(`procedures:eq:clinic_id:${CLINIC}`)
    expect(db.filters).toContain('procedures:eq:is_active:true')
    expect(db.filters).toContain(`treatments:eq:patient_id:patient-1`)
    expect(db.filters).toContain(`treatment_sessions:eq:clinic_id:${CLINIC}`)
  })

  it('creates a draft through one transactional rpc and reloads it', async () => {
    push(patientRow())
    push(header())
    push([version({ evolution: 'texto clinico secreto', products_used_summary: 'toxina', next_steps: 'retorno' })])
    const result = await createClinicalRecord(snapshot('authenticated_ready', 'professional'), {
      patientId: 'patient-1',
      procedureName: '  Limpeza  ',
      evolution: 'texto clinico secreto',
      productsUsedSummary: 'toxina',
      nextSteps: 'retorno',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.status).toBe('draft')
      expect(result.value.clinicId).toBe(CLINIC)
      expect(result.value.currentVersionId).toBe('version-1')
      expect(result.value.versions).toHaveLength(1)
      expect(result.value.versions[0]?.evolution).toBe('texto clinico secreto')
    }
    expect(db.insert).toEqual([])
    expect(db.update).toEqual([])
    expect(db.rpc).toHaveLength(1)
    expect(db.rpc[0]?.fn).toBe('create_clinical_evolution')
    expect(db.rpc[0]?.args).toEqual(
      expect.objectContaining({
        p_clinic_id: CLINIC,
        p_patient_id: 'patient-1',
        p_procedure_name: 'Limpeza',
        p_evolution: 'texto clinico secreto',
        p_products_used_summary: 'toxina',
        p_next_steps: 'retorno',
      }),
    )
    expect(db.rpc[0]?.args).not.toHaveProperty('created_by')
    expect(db.rpc[0]?.args).not.toHaveProperty('p_created_by')
    expect(db.rpc[0]?.args).not.toHaveProperty('professional_name')
    expect(db.rpc[0]?.args).not.toHaveProperty('p_professional_name')
    expect(db.rpc[0]?.args).not.toHaveProperty('p_version_number')
    expect(db.rpc[0]?.args).not.toHaveProperty('p_current_version_id')
    expect(db.rpc[0]?.args).not.toHaveProperty('p_status')
    expect(JSON.stringify(db.rpc)).not.toContain('write_clinical_audit')
    expect(db.deletes).toEqual([])
  })

  it('rejects a caller-supplied clinic, author or professional name', async () => {
    const clinic = await createClinicalRecord(snapshot('authenticated_ready'), {
      patientId: 'patient-1',
      procedureName: 'Limpeza',
      clinic_id: 'clinic-b',
    } as V3ClinicalRecordInput)
    expect(clinic.ok).toBe(false)
    if (!clinic.ok) expect(clinic.error.code).toBe('clinic_transfer_rejected')

    const author = await createClinicalRecord(snapshot('authenticated_ready'), {
      patientId: 'patient-1',
      procedureName: 'Limpeza',
      professional_name: 'Outra pessoa',
    } as V3ClinicalRecordInput)
    expect(author.ok).toBe(false)
    if (!author.ok) expect(author.error.code).toBe('invalid_input')
    expect(createClient).not.toHaveBeenCalled()
  })

  it('keeps the session inside the same patient and treatment', async () => {
    push(patientRow())
    push({ id: 'sess-1', clinic_id: CLINIC, patient_id: 'patient-1', treatment_id: 'treat-1' })
    push(header({ treatment_id: 'treat-1', treatment_session_id: 'sess-1', treatment_sessions: { session_number: 2 } }))
    push([version()])
    const created = await createClinicalRecord(snapshot('authenticated_ready'), {
      patientId: 'patient-1',
      treatmentSessionId: 'sess-1',
      procedureName: 'Limpeza',
    })
    expect(created.ok).toBe(true)
    if (created.ok) expect(created.value.sessionNumber).toBe(2)
    expect(db.rpc[0]?.args).toEqual(
      expect.objectContaining({
        p_clinic_id: CLINIC,
        p_treatment_id: 'treat-1',
        p_treatment_session_id: 'sess-1',
      }),
    )
    expect(db.insert).toEqual([])

    db.rpc = []
    push(patientRow())
    push({ id: 'sess-1', clinic_id: CLINIC, patient_id: 'patient-1', treatment_id: 'treat-1' })
    const mismatch = await createClinicalRecord(snapshot('authenticated_ready'), {
      patientId: 'patient-1',
      treatmentId: 'treat-2',
      treatmentSessionId: 'sess-1',
      procedureName: 'Limpeza',
    })
    expect(mismatch.ok).toBe(false)
    if (!mismatch.ok) expect(mismatch.error.code).toBe('invalid_input')
    expect(db.rpc).toEqual([])
    expect(db.insert).toEqual([])
  })

  it('appends a version through one rpc and preserves the previous one', async () => {
    push(header({ status: 'finalized' }))
    push([version({ evolution: 'texto original' })])
    push(header({ status: 'corrected', current_version_id: 'version-2' }))
    push([
      version({ id: 'version-2', version_number: 2, evolution: 'texto corrigido', change_reason: 'correção' }),
      version({ evolution: 'texto original' }),
    ])
    const result = await appendClinicalRecordVersion(snapshot('authenticated_ready', 'manager'), 'record-1', {
      procedureName: 'Limpeza',
      evolution: 'texto corrigido',
      changeReason: 'correção',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.status).toBe('corrected')
      expect(result.value.currentVersionId).toBe('version-2')
      expect(result.value.versions.map((item) => item.versionNumber)).toEqual([2, 1])
      expect(result.value.versions[1]?.evolution).toBe('texto original')
    }
    expect(db.insert).toEqual([])
    expect(db.update).toEqual([])
    expect(db.rpc).toEqual([
      {
        fn: 'append_clinical_evolution',
        args: expect.objectContaining({
          p_clinic_id: CLINIC,
          p_clinical_record_id: 'record-1',
          p_procedure_name: 'Limpeza',
          p_evolution: 'texto corrigido',
          p_change_reason: 'correção',
        }),
      },
    ])
    expect(db.rpc[0]?.args).not.toHaveProperty('p_version_number')
    expect(db.rpc[0]?.args).not.toHaveProperty('p_professional_name')
    expect(db.rpc[0]?.args).not.toHaveProperty('p_created_by')
    expect(JSON.stringify(db.rpc)).not.toContain('write_clinical_audit')
    expect(db.deletes).toEqual([])
  })

  it('refuses a new version after cancellation and does not touch history', async () => {
    push(header({ status: 'cancelled' }))
    push([version({ evolution: 'texto original' })])
    const result = await appendClinicalRecordVersion(snapshot('authenticated_ready'), 'record-1', {
      procedureName: 'Limpeza',
      evolution: 'novo',
      changeReason: 'tarde',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('record_closed')
    expect(db.rpc).toEqual([])
    expect(db.insert).toEqual([])
    expect(db.update).toEqual([])
    expect(db.deletes).toEqual([])
  })

  it('finalizes and cancels through one rpc without rewriting versions', async () => {
    push(header())
    push([version({ evolution: 'texto original' })])
    push(header({ status: 'finalized' }))
    push([version({ evolution: 'texto original' })])
    const finalized = await finalizeClinicalRecord(snapshot('authenticated_ready', 'admin'), 'record-1')
    expect(finalized.ok).toBe(true)
    if (finalized.ok) {
      expect(finalized.value.status).toBe('finalized')
      expect(finalized.value.versions[0]?.evolution).toBe('texto original')
    }
    expect(db.update).toEqual([])
    expect(db.insert).toEqual([])
    expect(db.rpc).toEqual([
      {
        fn: 'transition_clinical_evolution',
        args: expect.objectContaining({
          p_clinic_id: CLINIC,
          p_clinical_record_id: 'record-1',
          p_status: 'finalized',
        }),
      },
    ])

    db.rpc = []
    push(header({ status: 'finalized' }))
    push([version()])
    const again = await finalizeClinicalRecord(snapshot('authenticated_ready'), 'record-1')
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.error.code).toBe('record_closed')
    expect(db.rpc).toEqual([])
    expect(db.update).toEqual([])

    push(header())
    push([version({ evolution: 'texto original' })])
    push(header({ status: 'cancelled' }))
    push([version({ evolution: 'texto original' })])
    const cancelled = await cancelClinicalRecord(snapshot('authenticated_ready'), 'record-1')
    expect(cancelled.ok).toBe(true)
    if (cancelled.ok) {
      expect(cancelled.value.status).toBe('cancelled')
      expect(cancelled.value.versions[0]?.evolution).toBe('texto original')
    }
    expect(db.deletes).toEqual([])
    expect(db.update).toEqual([])
    expect(db.rpc.at(-1)).toEqual({
      fn: 'transition_clinical_evolution',
      args: expect.objectContaining({ p_status: 'cancelled' }),
    })
  })

  it('maps database denials without exposing the policy text', async () => {
    push(patientRow())
    push(null, { code: '42501', message: 'new row violates row-level security policy' })
    const denied = await listClinicalRecords(snapshot('authenticated_ready'), 'patient-1')
    expect(denied.ok).toBe(false)
    if (!denied.ok) {
      expect(denied.error.code).toBe('forbidden')
      expect(denied.error.message).toBe('Acesso negado pela política da clínica.')
      expect(denied.error.message.toLowerCase()).not.toContain('row-level')
    }

    push(patientRow())
    db.rpcError = { code: 'P0001', message: 'clinic_id is immutable' }
    const immutable = await createClinicalRecord(snapshot('authenticated_ready'), {
      patientId: 'patient-1',
      procedureName: 'Limpeza',
    })
    expect(immutable.ok).toBe(false)
    if (!immutable.ok) expect(immutable.error.code).toBe('clinic_transfer_rejected')

    db.rpcError = { code: '42501', message: 'clinical evolution unauthenticated' }
    push(patientRow())
    const anonymous = await createClinicalRecord(snapshot('authenticated_ready'), {
      patientId: 'patient-1',
      procedureName: 'Limpeza',
    })
    expect(anonymous.ok).toBe(false)
    if (!anonymous.ok) expect(anonymous.error.code).toBe('unauthenticated')

    db.rpcError = { code: 'P0002', message: 'clinical evolution patient missing' }
    push(patientRow())
    const missingPatient = await createClinicalRecord(snapshot('authenticated_ready'), {
      patientId: 'patient-1',
      procedureName: 'Limpeza',
    })
    expect(missingPatient.ok).toBe(false)
    if (!missingPatient.ok) expect(missingPatient.error.code).toBe('patient_not_found')

    db.rpcError = { code: 'P0002', message: 'clinical evolution record missing' }
    push(patientRow())
    const missingRecord = await createClinicalRecord(snapshot('authenticated_ready'), {
      patientId: 'patient-1',
      procedureName: 'Limpeza',
    })
    expect(missingRecord.ok).toBe(false)
    if (!missingRecord.ok) expect(missingRecord.error.code).toBe('clinical_record_not_found')

    db.rpcError = { code: 'P0001', message: 'clinical evolution closed' }
    push(patientRow())
    const closedRecord = await createClinicalRecord(snapshot('authenticated_ready'), {
      patientId: 'patient-1',
      procedureName: 'Limpeza',
    })
    expect(closedRecord.ok).toBe(false)
    if (!closedRecord.ok) expect(closedRecord.error.code).toBe('record_closed')

    db.rpcError = { code: '22023', message: 'clinical evolution invalid input' }
    push(patientRow())
    const invalidInput = await createClinicalRecord(snapshot('authenticated_ready'), {
      patientId: 'patient-1',
      procedureName: 'Limpeza',
    })
    expect(invalidInput.ok).toBe(false)
    if (!invalidInput.ok) expect(invalidInput.error.code).toBe('invalid_input')

    db.rpcError = { code: '23505', message: 'duplicate key value violates unique constraint' }
    push(patientRow())
    const duplicate = await createClinicalRecord(snapshot('authenticated_ready'), {
      patientId: 'patient-1',
      procedureName: 'Limpeza',
    })
    expect(duplicate.ok).toBe(false)
    if (!duplicate.ok) expect(duplicate.error.code).toBe('repository_error')
    db.rpcError = null

    db.throwNetwork = true
    const network = await listClinicalRecords(snapshot('authenticated_ready'), 'patient-1')
    expect(network.ok).toBe(false)
    if (!network.ok) expect(network.error.code).toBe('repository_error')
  })

  it('keeps the repository off V2 identity and the service role', () => {
    const files = [
      'src/services/clinicalRepository.ts',
      'src/services/clinicalMapping.ts',
      'src/lib/clinicalRepositoryError.ts',
      'src/types/clinicalRecord.ts',
      'src/pages/v3/V3ClinicalEvolution.tsx',
      'src/pages/v3/useV3ClinicalRecords.ts',
    ]
    const combined = files.map((file) => readFileSync(file, 'utf8')).join('\n')
    expect(combined).toContain('getSupabaseClient')
    expect(combined).toContain('create_clinical_evolution')
    expect(combined).toContain('append_clinical_evolution')
    expect(combined).toContain('transition_clinical_evolution')
    expect(readFileSync('src/services/clinicalRepository.ts', 'utf8')).not.toContain('write_clinical_audit')
    expect(readFileSync('src/services/clinicalRepository.ts', 'utf8')).not.toContain('.insert(')
    expect(readFileSync('src/services/clinicalRepository.ts', 'utf8')).not.toContain('.update(')
    expect(combined).not.toContain('localStorage')
    expect(combined).not.toContain('service_role')
    expect(combined).not.toContain('createClient')
    expect(combined).not.toContain('AuthContext')
    expect(combined).not.toContain('ClinicContext')
    expect(combined).not.toContain('storage.ts')
    expect(combined).not.toContain(CLINIC)
    expect(combined).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    expect(combined.toLowerCase()).not.toContain('evelyn')
    expect(readFileSync('src/services/patientRepository.ts', 'utf8')).not.toContain('clinical_records')
  })
})
