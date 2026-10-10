export type PatientRepositoryErrorCode =
  | 'unauthenticated'
  | 'no_active_clinic'
  | 'forbidden'
  | 'patient_not_found'
  | 'clinic_transfer_rejected'
  | 'invalid_input'
  | 'repository_error'

export class PatientRepositoryError extends Error {
  readonly code: PatientRepositoryErrorCode

  constructor(code: PatientRepositoryErrorCode, message: string) {
    super(message)
    this.name = 'PatientRepositoryError'
    this.code = code
  }
}

export type PatientResult<T> = { ok: true; value: T } | { ok: false; error: PatientRepositoryError }
