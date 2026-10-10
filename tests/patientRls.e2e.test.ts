import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient, resetSupabaseClientForTests } from '../src/lib/supabase'
import {
  createPatient,
  getPatientById,
  listPatients,
  softDeletePatient,
  updatePatient,
} from '../src/services/patientRepository'
import {
  loadStaffAccess,
  resolveActiveClinic,
  signInWithPassword,
  signOut,
} from '../src/services/supabaseAuthService'
import { loadClinic } from '../src/services/v3Tenant'
import type { V3PatientUpdateInput } from '../src/types/patient'
import type { SupabaseClinicMembership, SupabaseStaffProfile } from '../src/types/supabaseAuth'
import type { V3Clinic, V3TenantSnapshot } from '../src/types/v3Tenant'

/**
 * Hosted RLS checks for the synthetic E2E fixtures.
 * Skipped unless V3_RLS_E2E=1, so `npm test` does not open a network session.
 * Passwords stay in the local fixture file and are not written to the report.
 * This file uses the anon key only.
 */
const enabled = process.env.V3_RLS_E2E === '1'

interface Account {
  id: string
  email: string
  password: string
  role: string | null
}

interface Fixture {
  url: string
  anon: string
  clinicA: { id: string; slug: string }
  clinicB: { id: string; slug: string }
  staffA: Account
  staffB: Account
  financeA: Account
  noMembership: Account
  patientA: { id: string; clinicId: string }
  patientB: { id: string; clinicId: string }
}

interface ScenarioReport {
  id: string
  result: 'passed' | 'failed'
  detail: string
}

const report: { scenarios: ScenarioReport[]; createdPatientId: string | null; softDeleteRole: string | null } = {
  scenarios: [],
  createdPatientId: null,
  softDeleteRole: null,
}

function record(id: string, detail: string) {
  report.scenarios.push({ id, result: 'passed', detail })
}

function readySnapshot(
  userId: string,
  profile: SupabaseStaffProfile,
  memberships: readonly SupabaseClinicMembership[],
  clinic: V3Clinic,
): V3TenantSnapshot {
  const membership = memberships.find((item) => item.clinicId === clinic.id)
  if (!membership) throw new Error('active membership missing')
  return {
    status: 'authenticated_ready',
    userId,
    profile,
    memberships,
    activeClinicId: clinic.id,
    activeClinic: clinic,
    activeRole: membership.role,
    error: null,
  }
}

describe.skipIf(!enabled)('patients RLS e2e', () => {
  let fixture: Fixture
  let staffA: V3TenantSnapshot
  let createdPatientId: string | null = null
  let patientANotes = 'e2e fixture clinic a'

  async function signInAs(account: Account) {
    vi.stubEnv('VITE_SUPABASE_AUTH_ENABLED', 'true')
    vi.stubEnv('VITE_SUPABASE_URL', fixture.url)
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', fixture.anon)
    resetSupabaseClientForTests()
    await signOut()
    const signedIn = await signInWithPassword(account.email, account.password)
    if (!signedIn.ok) throw new Error(`sign-in failed: ${signedIn.error.code}`)
    return { userId: signedIn.userId, client: getSupabaseClient() }
  }

  async function tenantFor(userId: string, client: SupabaseClient) {
    const access = await loadStaffAccess(client, userId)
    if (access.error || !access.profile) throw new Error(access.error?.code ?? 'staff access missing')
    const resolved = resolveActiveClinic(access.memberships, null)
    if (resolved.error || !resolved.activeClinicId) throw new Error(resolved.error?.code ?? 'clinic unresolved')
    const clinic = await loadClinic(client, resolved.activeClinicId)
    if (clinic.error || !clinic.clinic) throw new Error(clinic.error?.code ?? 'clinic row missing')
    return readySnapshot(userId, access.profile, access.memberships, clinic.clinic)
  }

  beforeAll(() => {
    fixture = JSON.parse(readFileSync('/tmp/c14-e2e-fixtures.json', 'utf8')) as Fixture
    if (fixture.clinicA.slug !== 'e2e-patient-clinic-a' || fixture.clinicB.slug !== 'e2e-patient-clinic-b') {
      throw new Error('fixture file is not the synthetic patient E2E pair')
    }
    if (fixture.clinicA.id === fixture.clinicB.id) throw new Error('fixture clinics are not distinct')
  })

  afterAll(async () => {
    await signOut()
    resetSupabaseClientForTests()
    mkdirSync('/opt/cursor/artifacts', { recursive: true })
    writeFileSync('/opt/cursor/artifacts/patient-rls-e2e.json', JSON.stringify(report, null, 2))
  })

  it('1: staff_a selects patient_a', async () => {
    const session = await signInAs(fixture.staffA)
    expect(session.userId).toBe(fixture.staffA.id)
    staffA = await tenantFor(session.userId, session.client)
    expect(staffA.activeClinicId).toBe(fixture.clinicA.id)
    expect(staffA.activeRole).toBe('admin')

    const patient = await getPatientById(staffA, fixture.patientA.id)
    expect(patient.ok, patient.ok ? '' : patient.error.code).toBe(true)
    if (patient.ok) {
      expect(patient.value.clinicId).toBe(fixture.clinicA.id)
      expect(patient.value.fullName).toBe('E2E Patient A')
    }
    const listed = await listPatients(staffA)
    expect(listed.ok, listed.ok ? '' : listed.error.code).toBe(true)
    if (listed.ok) {
      expect(listed.value.some((row) => row.id === fixture.patientA.id)).toBe(true)
      expect(listed.value.every((row) => row.clinicId === fixture.clinicA.id)).toBe(true)
    }
    record('1', 'staff_a read patient_a through the repository')
  }, 30_000)

  it('2: staff_a inserts a patient in clinic A', async () => {
    const created = await createPatient(staffA, {
      fullName: 'E2E Patient Created',
      email: 'e2e-patient-created@example.com',
      notes: 'created by staff_a',
      status: 'active',
    })
    expect(created.ok, created.ok ? '' : created.error.code).toBe(true)
    if (!created.ok) return
    createdPatientId = created.value.id
    report.createdPatientId = created.value.id
    expect(created.value.clinicId).toBe(fixture.clinicA.id)
    record('2', `staff_a created ${created.value.id} in clinic A`)
  }, 30_000)

  it('3: staff_a updates patient_a', async () => {
    patientANotes = 'e2e staff a update'
    const updated = await updatePatient(staffA, fixture.patientA.id, { notes: patientANotes })
    expect(updated.ok, updated.ok ? '' : updated.error.code).toBe(true)
    if (!updated.ok) return
    expect(updated.value.notes).toBe(patientANotes)
    expect(updated.value.clinicId).toBe(fixture.clinicA.id)
    record('3', 'staff_a updated patient_a notes without changing clinic_id')
  }, 30_000)

  it('4: staff_a cannot see patient_b', async () => {
    const client = getSupabaseClient()
    const ownRows = await client.from('patients').select('id, clinic_id')
    expect(ownRows.error).toBeNull()
    const rows = ownRows.data ?? []
    expect(rows.some((row) => row.id === fixture.patientB.id)).toBe(false)
    expect(rows.every((row) => row.clinic_id === fixture.clinicA.id)).toBe(true)

    const otherClinicRow = await client.from('patients').select('id, clinic_id').eq('id', fixture.patientB.id).maybeSingle()
    expect(otherClinicRow.error).toBeNull()
    expect(otherClinicRow.data).toBeNull()

    const viaRepository = await getPatientById(staffA, fixture.patientB.id)
    expect(viaRepository.ok).toBe(false)
    if (!viaRepository.ok) expect(viaRepository.error.code).toBe('patient_not_found')
    record('4', 'patient_b is absent from staff_a results under RLS')
  }, 30_000)

  it('5: staff_a cannot insert into clinic B', async () => {
    const client = getSupabaseClient()
    const inserted = await client
      .from('patients')
      .insert({
        clinic_id: fixture.clinicB.id,
        full_name: 'E2E Denied Cross Insert',
        email: 'e2e-patient-cross-insert@example.com',
      })
      .select('id')
      .maybeSingle()
    expect(inserted.data).toBeNull()
    expect(inserted.error?.code).toBe('42501')
    record('5', 'insert with clinic B id returned 42501')
  }, 30_000)

  it('6: staff_a cannot move patient_a to clinic B', async () => {
    const client = getSupabaseClient()
    const changed = await client
      .from('patients')
      .update({ clinic_id: fixture.clinicB.id })
      .eq('id', fixture.patientA.id)
      .select('id, clinic_id')
      .maybeSingle()
    expect(changed.error?.code).toBe('P0001')
    expect(changed.error?.message ?? '').toMatch(/clinic_id is immutable/i)
    const still = await getPatientById(staffA, fixture.patientA.id)
    expect(still.ok).toBe(true)
    if (still.ok) expect(still.value.clinicId).toBe(fixture.clinicA.id)
    record('6', 'trigger rejected clinic_id mutation with P0001')
  }, 30_000)

  it('14: the repository rejects an arbitrary clinic_id before the request', async () => {
    const input = { notes: 'deve ser ignorado', clinic_id: fixture.clinicB.id } as V3PatientUpdateInput
    const rejected = await updatePatient(staffA, fixture.patientA.id, input)
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) {
      expect(rejected.error.code).toBe('clinic_transfer_rejected')
      expect(rejected.error.message).toContain('por este fluxo')
    }
    const unchanged = await getPatientById(staffA, fixture.patientA.id)
    expect(unchanged.ok).toBe(true)
    if (unchanged.ok) expect(unchanged.value.notes).toBe(patientANotes)
    record('14', 'repository rejected clinic_id before Supabase')
  }, 30_000)

  it('7: staff_b selects patient_b', async () => {
    const session = await signInAs(fixture.staffB)
    expect(session.userId).toBe(fixture.staffB.id)
    const staffB = await tenantFor(session.userId, session.client)
    expect(staffB.activeClinicId).toBe(fixture.clinicB.id)
    const patient = await getPatientById(staffB, fixture.patientB.id)
    expect(patient.ok, patient.ok ? '' : patient.error.code).toBe(true)
    if (patient.ok) expect(patient.value.clinicId).toBe(fixture.clinicB.id)
    record('7', 'staff_b read patient_b through the repository')
  }, 30_000)

  it('8: staff_b cannot see patient_a', async () => {
    const client = getSupabaseClient()
    const ownRows = await client.from('patients').select('id, clinic_id')
    expect(ownRows.error).toBeNull()
    const rows = ownRows.data ?? []
    expect(rows.some((row) => row.id === fixture.patientA.id)).toBe(false)
    expect(rows.some((row) => row.id === createdPatientId)).toBe(false)
    expect(rows.every((row) => row.clinic_id === fixture.clinicB.id)).toBe(true)
    const otherClinicRow = await client.from('patients').select('id').eq('id', fixture.patientA.id).maybeSingle()
    expect(otherClinicRow.error).toBeNull()
    expect(otherClinicRow.data).toBeNull()
    record('8', 'patient_a and the clinic A insert are absent from staff_b results')
  }, 30_000)

  it('9: finance_a select follows the existing RLS', async () => {
    const session = await signInAs(fixture.financeA)
    expect(session.userId).toBe(fixture.financeA.id)
    const finance = await tenantFor(session.userId, session.client)
    expect(finance.activeRole).toBe('finance')
    expect(finance.activeClinicId).toBe(fixture.clinicA.id)

    const selected = await session.client.from('patients').select('id, clinic_id')
    expect(selected.error).toBeNull()
    expect(selected.data ?? []).toEqual([])

    const listed = await listPatients(finance)
    expect(listed.ok).toBe(false)
    if (!listed.ok) expect(listed.error.code).toBe('forbidden')
    record('9', 'finance select is empty under RLS; repository returns forbidden')
  }, 30_000)

  it('10: finance_a cannot insert a patient', async () => {
    const client = getSupabaseClient()
    const inserted = await client
      .from('patients')
      .insert({
        clinic_id: fixture.clinicA.id,
        full_name: 'E2E Finance Denied',
        email: 'e2e-patient-finance-denied@example.com',
      })
      .select('id')
      .maybeSingle()
    expect(inserted.data).toBeNull()
    expect(inserted.error?.code).toBe('42501')
    record('10', 'finance insert returned 42501')
  }, 30_000)

  it('11: finance_a cannot update a patient', async () => {
    const client = getSupabaseClient()
    const updated = await client
      .from('patients')
      .update({ notes: 'finance should not write' })
      .eq('id', fixture.patientA.id)
      .select('id, notes')
      .maybeSingle()
    expect(updated.error).toBeNull()
    expect(updated.data).toBeNull()
    record('11', 'finance update matched no row and returned no error')
  }, 30_000)

  it('12: no_membership select returns no patients', async () => {
    const session = await signInAs(fixture.noMembership)
    expect(session.userId).toBe(fixture.noMembership.id)
    const access = await loadStaffAccess(session.client, session.userId)
    expect(access.memberships).toEqual([])
    const selected = await session.client.from('patients').select('id, clinic_id')
    expect(selected.error).toBeNull()
    expect(selected.data ?? []).toEqual([])
    record('12', 'user without membership received an empty patient list')
  }, 30_000)

  it('13: no_membership cannot insert a patient', async () => {
    const client = getSupabaseClient()
    const inserted = await client
      .from('patients')
      .insert({
        clinic_id: fixture.clinicA.id,
        full_name: 'E2E Nomember Denied',
        email: 'e2e-patient-nomember-denied@example.com',
      })
      .select('id')
      .maybeSingle()
    expect(inserted.data).toBeNull()
    expect(inserted.error?.code).toBe('42501')
    record('13', 'no-membership insert returned 42501')
  }, 30_000)

  it('15: soft delete is an update allowed for staff_a and denied for finance', async () => {
    const financeSession = await signInAs(fixture.financeA)
    const finance = await tenantFor(financeSession.userId, financeSession.client)
    const financeRepository = await softDeletePatient(finance, fixture.patientA.id)
    expect(financeRepository.ok).toBe(false)
    if (!financeRepository.ok) expect(financeRepository.error.code).toBe('forbidden')
    const financeDirect = await financeSession.client
      .from('patients')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', fixture.patientA.id)
      .select('id, deleted_at')
      .maybeSingle()
    expect(financeDirect.error).toBeNull()
    expect(financeDirect.data).toBeNull()

    const staffSession = await signInAs(fixture.staffA)
    staffA = await tenantFor(staffSession.userId, staffSession.client)
    const before = await getPatientById(staffA, fixture.patientA.id)
    expect(before.ok).toBe(true)
    if (before.ok) {
      expect(before.value.deletedAt).toBeNull()
      expect(before.value.notes).toBe(patientANotes)
    }

    const archived = await softDeletePatient(staffA, fixture.patientA.id)
    expect(archived.ok, archived.ok ? '' : archived.error.code).toBe(true)
    if (archived.ok) expect(archived.value.deletedAt).toBeTruthy()
    const listed = await listPatients(staffA)
    expect(listed.ok).toBe(true)
    if (listed.ok) expect(listed.value.some((row) => row.id === fixture.patientA.id)).toBe(false)
    report.softDeleteRole = staffA.activeRole
    record('15', `soft delete succeeded for role ${staffA.activeRole}; finance was denied`)
  }, 30_000)
})
