import type { Patient, PatientStatus } from '../types'
import type { V3PatientCreateInput, V3PatientStatus } from '../types/patient'

/**
 * Explicit correspondence from the V2 local patient to public.patients.
 * V2 tags are not a column. They belong to public.patient_tags and stay out of this map.
 * clinic_id is not derived from the V2 record.
 */
const V2_STATUS_TO_V3: Record<PatientStatus, V3PatientStatus> = {
  ativo: 'active',
  inativo: 'inactive',
  em_tratamento: 'in_treatment',
}

export function mapV2PatientStatus(status: PatientStatus): V3PatientStatus {
  return V2_STATUS_TO_V3[status]
}

export function mapV2PatientToCreateInput(patient: Patient): V3PatientCreateInput {
  return {
    fullName: patient.name,
    email: patient.email,
    phone: patient.phone,
    cpf: patient.cpf,
    birthDate: patient.birthDate,
    gender: patient.gender,
    address: patient.address,
    allergies: patient.allergies,
    medications: patient.medications,
    notes: patient.notes,
    status: mapV2PatientStatus(patient.status),
  }
}
