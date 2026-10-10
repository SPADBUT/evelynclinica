export type AppointmentRepositoryErrorCode =
  | 'unauthenticated'
  | 'no_active_clinic'
  | 'forbidden'
  | 'not_found'
  | 'clinic_transfer_rejected'
  | 'invalid_input'
  | 'conflict'
  | 'invalid_transition'
  | 'closed'
  | 'repository_error'

export class AppointmentRepositoryError extends Error {
  readonly code: AppointmentRepositoryErrorCode

  constructor(code: AppointmentRepositoryErrorCode, message: string) {
    super(message)
    this.name = 'AppointmentRepositoryError'
    this.code = code
  }
}

export type AppointmentResult<T> = { ok: true; value: T } | { ok: false; error: AppointmentRepositoryError }
