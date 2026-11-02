import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  appendClinicalRecordVersion,
  createClinicalRecord,
  getClinicalRecord,
  listClinicalContext,
  listClinicalRecords,
} from '../src/services/clinicalRepository'
import { getSupabaseClient, resetSupabaseClientForTests } from '../src/lib/supabase'
import {
  loadStaffAccess,
  resolveActiveClinic,
  signInWithPassword,
  signOut,
} from '../src/services/supabaseAuthService'
import { loadClinic } from '../src/services/v3Tenant'
import type { SupabaseClinicMembership, SupabaseStaffProfile } from '../src/types/supabaseAuth'
import type { V3Clinic, V3TenantSnapshot } from '../src/types/v3Tenant'
import type { V3ClinicalRecordInput } from '../src/types/clinicalRecord'

/**
 * Hosted RLS checks for clinical evolution.
 * Skipped unless V3_RLS_E2E=1. This checkpoint does not create remote fixtures.
 * The anon key is the only credential used by the client.
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

describe.skipIf(!enabled)('clinical records RLS e2e', () => {
  let fixture: Fixture
  let staffA: V3TenantSnapshot
  let staffB: V3TenantSnapshot
  let financeA: V3TenantSnapshot
  let createdId: string | null = null

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

  beforeAll(async () => {
    fixture = JSON.parse(readFileSync('/tmp/c14-e2e-fixtures.json', 'utf8')) as Fixture
    const signedA = await signInAs(fixture.staffA)
    staffA = await tenantFor(signedA.userId, signedA.client)
    const signedB = await signInAs(fixture.staffB)
    staffB = await tenantFor(signedB.userId, signedB.client)
    const signedFinance = await signInAs(fixture.financeA)
    financeA = await tenantFor(signedFinance.userId, signedFinance.client)
  })

  afterAll(async () => {
    await signOut()
    resetSupabaseClientForTests()
  })

  it('lets clinic A create and read its own evolution', async () => {
    await signInAs(fixture.staffA)
    const created = await createClinicalRecord(staffA, {
      patientId: fixture.patientA.id,
      procedureName: 'Procedimento sintetico',
      evolution: 'evolucao sintetica',
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    createdId = created.value.id
    expect(created.value.clinicId).toBe(fixture.clinicA.id)
    const listed = await listClinicalRecords(staffA, fixture.patientA.id)
    expect(listed.ok).toBe(true)
    if (listed.ok) expect(listed.value.some((record) => record.id === created.value.id)).toBe(true)
  })

  it('hides clinic A evolution from clinic B, finance, and a missing membership', async () => {
    expect(createdId).toBeTruthy()
    await signInAs(fixture.staffB)
    const foreign = await getClinicalRecord(staffB, createdId ?? '')
    expect(foreign.ok).toBe(false)
    const context = await listClinicalContext(staffB, fixture.patientA.id)
    expect(context.ok).toBe(false)

    await signInAs(fixture.financeA)
    const finance = await listClinicalRecords(financeA, fixture.patientA.id)
    expect(finance.ok).toBe(false)
    if (!finance.ok) expect(finance.error.code).toBe('forbidden')

    await signInAs(fixture.noMembership)
    const outsider = await listClinicalRecords(
      { ...staffA, status: 'authenticated_without_membership', activeClinicId: null, memberships: [] },
      fixture.patientA.id,
    )
    expect(outsider.ok).toBe(false)
  })

  it('keeps the first version when a correction is appended', async () => {
    expect(createdId).toBeTruthy()
    await signInAs(fixture.staffA)
    const appended = await appendClinicalRecordVersion(staffA, createdId ?? '', {
      procedureName: 'Procedimento sintetico',
      evolution: 'evolucao corrigida',
      changeReason: 'correcao sintetica',
    })
    expect(appended.ok).toBe(true)
    if (!appended.ok) return
    expect(appended.value.versions.map((version) => version.versionNumber)).toContain(1)
    expect(appended.value.versions.map((version) => version.versionNumber)).toContain(2)
  })

  it('rejects a clinic id supplied by the caller', async () => {
    await signInAs(fixture.staffA)
    const rejected = await createClinicalRecord(staffA, {
      patientId: fixture.patientA.id,
      procedureName: 'Procedimento sintetico',
      clinic_id: fixture.clinicB.id,
    } as V3ClinicalRecordInput)
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) expect(rejected.error.code).toBe('clinic_transfer_rejected')
  })
})
