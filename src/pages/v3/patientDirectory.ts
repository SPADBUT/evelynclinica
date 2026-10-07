import type { V3Patient, V3PatientCreateInput, V3PatientStatus } from '../../types/patient'
import { V3_PATIENT_STATUSES } from '../../types/patient'

/**
 * Local filter over the tenant list.
 * A later checkpoint can replace this with a server query without changing the screen.
 */
export function filterPatients(patients: readonly V3Patient[], query: string): V3Patient[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return [...patients]
  const digits = needle.replace(/\D/g, '')
  return patients.filter((patient) => matches(patient, needle, digits))
}

export const PATIENT_STATUS_LABEL: Record<V3PatientStatus, string> = {
  active: 'Ativa',
  inactive: 'Inativa',
  in_treatment: 'Em tratamento',
}

export const PATIENT_360_SECTIONS = [
  'Histórico de tratamentos',
  'Evoluções clínicas',
  'Fotos',
  'Documentos e consentimentos',
  'Orçamentos',
  'Interações',
  'Agenda',
] as const

export interface V3PatientFormValue {
  fullName: string
  email: string
  phone: string
  cpf: string
  birthDate: string
  gender: string
  address: string
  allergies: string
  medications: string
  notes: string
  status: V3PatientStatus
}

export const emptyPatientFormValue: V3PatientFormValue = {
  fullName: '',
  email: '',
  phone: '',
  cpf: '',
  birthDate: '',
  gender: '',
  address: '',
  allergies: '',
  medications: '',
  notes: '',
  status: 'active',
}

export function formValueFromPatient(patient: V3Patient): V3PatientFormValue {
  return {
    fullName: patient.fullName,
    email: patient.email ?? '',
    phone: patient.phone ?? '',
    cpf: patient.cpf ?? '',
    birthDate: patient.birthDate ?? '',
    gender: patient.gender ?? '',
    address: patient.address ?? '',
    allergies: patient.allergies ?? '',
    medications: patient.medications ?? '',
    notes: patient.notes ?? '',
    status: patient.status,
  }
}

/** Editable columns only. id, clinic_id and timestamps are not part of this input. */
export function toPatientInput(value: V3PatientFormValue): V3PatientCreateInput {
  return {
    fullName: value.fullName,
    email: value.email,
    phone: value.phone,
    cpf: value.cpf,
    birthDate: value.birthDate,
    gender: value.gender,
    address: value.address,
    allergies: value.allergies,
    medications: value.medications,
    notes: value.notes,
    status: value.status,
  }
}

export function isPatientStatus(value: string): value is V3PatientStatus {
  return (V3_PATIENT_STATUSES as readonly string[]).includes(value)
}

function matches(patient: V3Patient, needle: string, digits: string): boolean {
  if (patient.fullName.toLowerCase().includes(needle)) return true
  if (includesText(patient.email, needle)) return true
  if (includesText(patient.phone, needle) || includesDigits(patient.phone, digits)) return true
  if (includesText(patient.cpf, needle) || includesDigits(patient.cpf, digits)) return true
  return false
}

function includesText(value: string | null, needle: string): boolean {
  return value != null && value.toLowerCase().includes(needle)
}

function includesDigits(value: string | null, digits: string): boolean {
  return digits.length > 0 && value != null && value.replace(/\D/g, '').includes(digits)
}
