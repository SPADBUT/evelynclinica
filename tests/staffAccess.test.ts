import { describe, expect, it } from 'vitest'
import { isAuthorizedStaff } from '../src/auth/staffAccess'
import type { SupabaseAuthState } from '../src/types/supabaseAuth'

function state(overrides: Partial<SupabaseAuthState> = {}): Pick<
  SupabaseAuthState,
  'profile' | 'memberships' | 'activeClinicId' | 'error'
> {
  return {
    profile: { id: 'user-1', fullName: 'Checkpoint Staff', email: 'staff@example.com' },
    memberships: [
      {
        id: 'membership-1',
        clinicId: 'clinic-a',
        userId: 'user-1',
        role: 'admin',
        isActive: true,
      },
    ],
    activeClinicId: 'clinic-a',
    error: null,
    ...overrides,
  }
}

describe('isAuthorizedStaff', () => {
  it('accepts an active clinic role already loaded for this user', () => {
    expect(isAuthorizedStaff(state())).toBe(true)
    expect(
      isAuthorizedStaff(
        state({
          memberships: [
            {
              id: 'membership-1',
              clinicId: 'clinic-a',
              userId: 'user-1',
              role: 'finance',
              isActive: true,
            },
          ],
        }),
      ),
    ).toBe(true)
  })

  it('rejects a missing profile, a missing clinic, an error, or a clinic outside the membership list', () => {
    expect(isAuthorizedStaff(state({ profile: null }))).toBe(false)
    expect(isAuthorizedStaff(state({ activeClinicId: null }))).toBe(false)
    expect(isAuthorizedStaff(state({ activeClinicId: 'clinic-other' }))).toBe(false)
    expect(isAuthorizedStaff(state({ error: { code: 'no_active_membership' } as never }))).toBe(false)
  })
})
