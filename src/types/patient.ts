/** Values of public.patient_status. Not the V2 PatientStatus union. */
export const V3_PATIENT_STATUSES = ['active', 'inactive', 'in_treatment'] as const

export type V3PatientStatus = (typeof V3_PATIENT_STATUSES)[number]

/**
 * Row of public.patients.
 * clinicId is stored on the row. It is chosen by the active tenant, not by patient input.
 * deletedAt is the A1 soft-delete column. Tags live in public.patient_tags and are not part of this row.
 */
export interface V3Patient {
  id: string
  clinicId: string
  fullName: string
  email: string | null
  phone: string | null
  cpf: string | null
  birthDate: string | null
  gender: string | null
  address: string | null
  allergies: string | null
  medications: string | null
  notes: string | null
  status: V3PatientStatus
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

/** Fields a caller may send. clinic_id is intentionally absent. */
export interface V3PatientCreateInput {
  fullName: string
  email?: string | null
  phone?: string | null
  cpf?: string | null
  birthDate?: string | null
  gender?: string | null
  address?: string | null
  allergies?: string | null
  medications?: string | null
  notes?: string | null
  status?: V3PatientStatus
}

export type V3PatientUpdateInput = Partial<V3PatientCreateInput>

export function isV3PatientStatus(value: unknown): value is V3PatientStatus {
  return typeof value === 'string' && (V3_PATIENT_STATUSES as readonly string[]).includes(value)
}
