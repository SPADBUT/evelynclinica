export type SupabaseAuthErrorCode =
  | 'disabled'
  | 'missing_env'
  | 'invalid_credentials'
  | 'no_session'
  | 'profile_missing'
  | 'no_active_membership'
  | 'multiple_memberships'
  | 'auth_failed'

export class SupabaseAuthError extends Error {
  readonly code: SupabaseAuthErrorCode

  constructor(code: SupabaseAuthErrorCode, message: string) {
    super(message)
    this.name = 'SupabaseAuthError'
    this.code = code
  }
}
