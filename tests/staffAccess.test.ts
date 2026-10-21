import { describe, expect, it } from 'vitest'
import { isAuthorizedStaff } from '../src/auth/staffAccess'
import type { V3TenantStatus } from '../src/types/v3Tenant'

const statuses: V3TenantStatus[] = [
  'loading',
  'unauthenticated',
  'authenticated_without_membership',
  'authenticated_needs_clinic_selection',
  'authenticated_ready',
  'error',
]

describe('isAuthorizedStaff', () => {
  it('opens the V2 shell only when the tenant is ready', () => {
    for (const status of statuses) {
      expect(isAuthorizedStaff({ status }), status).toBe(status === 'authenticated_ready')
    }
  })
})
