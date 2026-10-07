import { describe, expect, it } from 'vitest'
import { canAccessClinicalRecords, canManagePatients, hasRole } from '../src/services/supabaseRbac'
import { tenantCan } from '../src/services/v3Tenant'
import type { SupabaseClinicMembership, SupabaseClinicRole } from '../src/types/supabaseAuth'
import type { V3TenantSnapshot } from '../src/types/v3Tenant'

function membership(clinicId: string, role: SupabaseClinicRole): SupabaseClinicMembership {
  return { id: `${clinicId}-${role}`, clinicId, userId: 'user-1', role, isActive: true }
}

const roles: SupabaseClinicRole[] = ['admin', 'assistant', 'professional', 'finance', 'manager']

describe('display RBAC', () => {
  it('matches a role only inside the selected clinic', () => {
    const memberships = [membership('clinic-a', 'admin')]
    expect(hasRole(memberships, 'clinic-a', ['admin'])).toBe(true)
    expect(hasRole(memberships, 'clinic-b', ['admin'])).toBe(false)
    expect(hasRole(memberships, 'clinic-a', ['finance'])).toBe(false)
  })

  it('treats finance as unable to manage patients', () => {
    for (const role of roles) {
      const allowed = role !== 'finance'
      expect(canManagePatients([membership('clinic-a', role)], 'clinic-a')).toBe(allowed)
    }
  })

  it('limits clinical records to admin, manager and professional', () => {
    const allowed = new Set<SupabaseClinicRole>(['admin', 'manager', 'professional'])
    for (const role of roles) {
      expect(canAccessClinicalRecords([membership('clinic-a', role)], 'clinic-a')).toBe(allowed.has(role))
      expect(tenantCan(ready(role), 'clinical.records')).toBe(allowed.has(role))
    }
    expect(canAccessClinicalRecords([membership('clinic-a', 'professional')], 'clinic-b')).toBe(false)
    expect(
      canAccessClinicalRecords(
        [{ ...membership('clinic-a', 'professional'), isActive: false } as SupabaseClinicMembership],
        'clinic-a',
      ),
    ).toBe(false)
    expect(tenantCan(ready('assistant'), 'patients.manage')).toBe(true)
    expect(tenantCan(ready('finance'), 'patients.manage')).toBe(false)
  })
})

function ready(role: SupabaseClinicRole): V3TenantSnapshot {
  return {
    status: 'authenticated_ready',
    userId: 'user-1',
    profile: { id: 'user-1', fullName: 'Staff', email: 'staff@example.com' },
    memberships: [membership('clinic-a', role)],
    activeClinicId: 'clinic-a',
    activeClinic: { id: 'clinic-a', name: 'Clinica', slug: 'clinica', timezone: 'America/Manaus' },
    activeRole: role,
    error: null,
  }
}
