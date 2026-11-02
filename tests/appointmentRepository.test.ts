import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetSupabaseClientForTests } from '../src/lib/supabase'
import {
  agendaScopeFromTenant,
  createAppointment,
  listAgendaDay,
  listPatientAppointments,
  transitionAppointment,
} from '../src/services/appointmentRepository'
import type { SupabaseClinicRole } from '../src/types/supabaseAuth'
import type { V3TenantSnapshot } from '../src/types/v3Tenant'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

const CLINIC = 'clinic-from-tenant'

const db = vi.hoisted(() => ({
  rpc: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  rpcError: null as { code?: string; message?: string } | null,
  filters: [] as string[],
  deletes: [] as string[],
  rows: [] as unknown[],
}))

function installClient() {
  const from = vi.fn((table: string) => {
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        db.filters.push(`${table}:eq:${column}:${String(value)}`)
        return builder
      },
      gte: (column: string, value: unknown) => {
        db.filters.push(`${table}:gte:${column}:${String(value)}`)
        return builder
      },
      lt: (column: string, value: unknown) => {
        db.filters.push(`${table}:lt:${column}:${String(value)}`)
        return builder
      },
      order: () => builder,
      delete: () => {
        db.deletes.push(table)
        return builder
      },
      maybeSingle: () => Promise.resolve({ data: db.rows[0] ?? null, error: null }),
      then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve({ data: db.rows, error: null }).then(onFulfilled, onRejected),
    }
    return builder
  })
  const rpc = vi.fn((fn: string, args: Record<string, unknown>) => {
    db.rpc.push({ fn, args })
    return Promise.resolve({ data: db.rpcError ? null : 'appointment-1', error: db.rpcError })
  })
  vi.mocked(createClient).mockReturnValue({ auth: {}, from, rpc } as unknown as SupabaseClient)
}

function tenant(role: SupabaseClinicRole): V3TenantSnapshot {
  return {
    status: 'authenticated_ready',
    userId: 'user-1',
    profile: { id: 'user-1', fullName: 'Staff', email: 'staff@example.com' },
    memberships: [{ id: 'membership-1', clinicId: CLINIC, userId: 'user-1', role, isActive: true }],
    activeClinicId: CLINIC,
    activeClinic: { id: CLINIC, name: 'Clinica', slug: 'clinica', timezone: 'America/Sao_Paulo' },
    activeRole: role,
    error: null,
  }
}

const row = {
  id: 'appointment-1',
  clinic_id: CLINIC,
  patient_id: 'patient-1',
  professional_id: 'pro-1',
  procedure_id: null,
  title: 'Avaliacao',
  procedure_name: 'Procedimento sintetico',
  starts_at: '2026-10-10T13:00:00.000Z',
  ends_at: '2026-10-10T14:00:00.000Z',
  status: 'scheduled',
  notes: 'nota operacional',
  created_by: 'user-1',
  created_at: '2026-10-10T12:00:00.000Z',
  updated_at: '2026-10-10T12:00:00.000Z',
  patients: { full_name: 'Paciente Sintetica' },
  professional: { full_name: 'Profissional Sintetico' },
}

describe('appointment repository', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_AUTH_ENABLED', 'true')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    resetSupabaseClientForTests()
    db.rpc = []
    db.rpcError = null
    db.filters = []
    db.deletes = []
    db.rows = [row]
    installClient()
  })

  it('refuses finance and a clinic id supplied by the caller', async () => {
    expect(agendaScopeFromTenant(tenant('finance')).ok).toBe(false)
    const rejected = await createAppointment(tenant('admin'), {
      clinicId: 'other-clinic',
      patientId: 'patient-1',
      professionalId: 'pro-1',
      title: 'Avaliacao',
      startsAt: '2026-10-10T13:00:00.000Z',
      endsAt: '2026-10-10T14:00:00.000Z',
    } as never)
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) expect(rejected.error.code).toBe('clinic_transfer_rejected')
    expect(db.rpc).toHaveLength(0)
  })

  it('creates through the tenant clinic and reloads that row', async () => {
    const created = await createAppointment(tenant('assistant'), {
      patientId: 'patient-1',
      professionalId: 'pro-1',
      title: 'Avaliacao',
      startsAt: '2026-10-10T13:00:00.000Z',
      endsAt: '2026-10-10T14:00:00.000Z',
      notes: 'nota operacional',
    })
    expect(created.ok).toBe(true)
    expect(db.rpc[0]).toMatchObject({
      fn: 'create_appointment',
      args: {
        p_clinic_id: CLINIC,
        p_patient_id: 'patient-1',
        p_professional_id: 'pro-1',
        p_notes: 'nota operacional',
      },
    })
    expect(db.rpc[0]?.args).not.toHaveProperty('p_created_by')
    expect(db.filters).toContain(`appointments:eq:clinic_id:${CLINIC}`)
    expect(db.deletes).toHaveLength(0)
  })

  it('maps a database conflict without returning the database message', async () => {
    db.rpcError = {
      code: '23P01',
      message: 'conflicting key value violates exclusion constraint appointments_patient_overlap patient secret',
    }
    const result = await transitionAppointment(tenant('admin'), 'appointment-1', 'scheduled')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('conflict')
      expect(result.error.message).toBe('Horário indisponível.')
      expect(result.error.message).not.toContain('secret')
    }
  })

  it('lists one patient inside the active clinic and one Sao Paulo day', async () => {
    const day = await listAgendaDay(tenant('manager'), '2026-10-10')
    expect(day.ok).toBe(true)
    expect(db.filters).toContain('appointments:gte:starts_at:2026-10-10T03:00:00.000Z')
    expect(db.filters).toContain('appointments:lt:starts_at:2026-10-11T03:00:00.000Z')
    const patient = await listPatientAppointments(tenant('professional'), 'patient-1')
    expect(patient.ok).toBe(true)
    if (patient.ok) expect(patient.value.every((item) => item.patientId === 'patient-1')).toBe(true)
    expect(db.filters).toContain('appointments:eq:patient_id:patient-1')
  })
})
