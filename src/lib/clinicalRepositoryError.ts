export type ClinicalRepositoryErrorCode =
  | 'unauthenticated'
  | 'no_active_clinic'
  | 'forbidden'
  | 'clinical_record_not_found'
  | 'patient_not_found'
  | 'clinic_transfer_rejected'
  | 'invalid_input'
  | 'record_closed'
  | 'repository_error'

export class ClinicalRepositoryError extends Error {
  readonly code: ClinicalRepositoryErrorCode

  constructor(code: ClinicalRepositoryErrorCode, message: string) {
    super(message)
    this.name = 'ClinicalRepositoryError'
    this.code = code
  }
}

export type ClinicalResult<T> = { ok: true; value: T } | { ok: false; error: ClinicalRepositoryError }
