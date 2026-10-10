import {
  isClinicalRecordStatus,
  type V3ClinicalProcedureOption,
  type V3ClinicalRecord,
  type V3ClinicalSessionOption,
  type V3ClinicalTreatmentOption,
  type V3ClinicalVersion,
} from '../types/clinicalRecord'

export interface ClinicalHeader {
  id: string
  clinicId: string
  patientId: string
  treatmentId: string | null
  treatmentSessionId: string | null
  procedureId: string | null
  status: V3ClinicalRecord['status']
  currentVersionId: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
  sessionNumber: number | null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function displayName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function requiredText(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

export function readClinicalVersion(value: unknown): V3ClinicalVersion | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const anamnesis = requiredText(row.anamnesis)
  const evolution = requiredText(row.evolution)
  const nextSteps = requiredText(row.next_steps)
  if (
    typeof row.id !== 'string' ||
    typeof row.clinic_id !== 'string' ||
    typeof row.clinical_record_id !== 'string' ||
    typeof row.version_number !== 'number' ||
    !Number.isInteger(row.version_number) ||
    row.version_number < 1 ||
    anamnesis === null ||
    evolution === null ||
    nextSteps === null ||
    typeof row.recorded_at !== 'string' ||
    typeof row.created_at !== 'string'
  ) {
    return null
  }
  return {
    id: row.id,
    recordId: row.clinical_record_id,
    clinicId: row.clinic_id,
    versionNumber: row.version_number,
    procedureName: displayName(row.procedure_name),
    professionalName: displayName(row.professional_name),
    anamnesis,
    evolution,
    productsUsedSummary: text(row.products_used_summary),
    nextSteps,
    changeReason: text(row.change_reason),
    recordedAt: row.recorded_at,
    createdBy: text(row.created_by),
    createdAt: row.created_at,
  }
}

function sessionNumber(value: unknown): number | null {
  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== 'object') return null
  const number = (row as Record<string, unknown>).session_number
  return typeof number === 'number' && Number.isInteger(number) && number > 0 ? number : null
}

export function readClinicalHeader(value: unknown): ClinicalHeader | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (
    typeof row.id !== 'string' ||
    typeof row.clinic_id !== 'string' ||
    typeof row.patient_id !== 'string' ||
    !isClinicalRecordStatus(row.status) ||
    typeof row.created_at !== 'string' ||
    typeof row.updated_at !== 'string'
  ) {
    return null
  }
  return {
    id: row.id,
    clinicId: row.clinic_id,
    patientId: row.patient_id,
    treatmentId: text(row.treatment_id),
    treatmentSessionId: text(row.treatment_session_id),
    procedureId: text(row.procedure_id),
    status: row.status,
    currentVersionId: text(row.current_version_id),
    createdBy: text(row.created_by),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sessionNumber: sessionNumber(row.treatment_sessions),
  }
}

export function assembleClinicalRecord(
  header: ClinicalHeader,
  versions: readonly V3ClinicalVersion[],
): V3ClinicalRecord {
  const own = versions
    .filter((version) => version.recordId === header.id && version.clinicId === header.clinicId)
    .sort((left, right) => right.versionNumber - left.versionNumber)
  return { ...header, versions: own }
}

export function currentClinicalVersion(record: V3ClinicalRecord): V3ClinicalVersion | null {
  if (record.currentVersionId) {
    const pointed = record.versions.find((version) => version.id === record.currentVersionId)
    if (pointed) return pointed
  }
  return record.versions[0] ?? null
}

export function readProcedureOption(
  value: unknown,
  clinicId: string,
): V3ClinicalProcedureOption | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (row.clinic_id !== clinicId || row.is_active !== true) return null
  if (typeof row.id !== 'string' || typeof row.name !== 'string' || row.name.trim().length === 0) return null
  return { id: row.id, name: row.name.trim() }
}

export function readTreatmentOption(
  value: unknown,
  clinicId: string,
  patientId: string,
): V3ClinicalTreatmentOption | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (row.clinic_id !== clinicId || row.patient_id !== patientId) return null
  if (typeof row.id !== 'string' || typeof row.name !== 'string' || row.name.trim().length === 0) return null
  return { id: row.id, name: row.name.trim() }
}

export function readSessionOption(
  value: unknown,
  clinicId: string,
  patientId: string,
): V3ClinicalSessionOption | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (row.clinic_id !== clinicId || row.patient_id !== patientId) return null
  if (typeof row.id !== 'string' || typeof row.treatment_id !== 'string') return null
  const number = row.session_number
  return {
    id: row.id,
    treatmentId: row.treatment_id,
    sessionNumber: typeof number === 'number' && Number.isInteger(number) && number > 0 ? number : null,
  }
}
