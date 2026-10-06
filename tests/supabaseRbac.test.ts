import { describe, expect, it } from 'vitest'
import { canManagePatients, hasRole } from '../src/services/supabaseRbac'
import type { SupabaseClinicMembership, SupabaseClinicRole } from '../src/types/supabaseAuth'

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
})
