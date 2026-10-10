import type { Session, User } from '@supabase/supabase-js'
import type { SupabaseAuthError } from '../lib/supabaseAuthError'

export const SUPABASE_CLINIC_ROLES = [
  'admin',
  'assistant',
  'professional',
  'finance',
  'manager',
] as const

export type SupabaseClinicRole = (typeof SUPABASE_CLINIC_ROLES)[number]

export function isSupabaseClinicRole(value: unknown): value is SupabaseClinicRole {
  return typeof value === 'string' && (SUPABASE_CLINIC_ROLES as readonly string[]).includes(value)
}

export interface SupabaseStaffProfile {
  id: string
  fullName: string
  email: string
}

export interface SupabaseClinicMembership {
  id: string
  clinicId: string
  userId: string
  role: SupabaseClinicRole
  isActive: true
}

/** Auth session only. Profile, clinic, and role live in the V3 tenant context. */
export interface SupabaseAuthState {
  enabled: boolean
  configured: boolean
  loading: boolean
  session: Session | null
  user: User | null
  error: SupabaseAuthError | null
}
