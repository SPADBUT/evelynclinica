export const CLINICAL_RECORD_STATUSES = [
  'draft',
  'in_progress',
  'finalized',
  'corrected',
  'cancelled',
] as const

export type ClinicalRecordStatus = (typeof CLINICAL_RECORD_STATUSES)[number]

export function isClinicalRecordStatus(value: unknown): value is ClinicalRecordStatus {
  return typeof value === 'string' && (CLINICAL_RECORD_STATUSES as readonly string[]).includes(value)
}

export interface V3ClinicalVersion {
  id: string
  recordId: string
  clinicId: string
  versionNumber: number
  procedureName: string | null
  professionalName: string | null
  anamnesis: string
  evolution: string
  productsUsedSummary: string | null
  nextSteps: string
  changeReason: string | null
  recordedAt: string
  createdBy: string | null
  createdAt: string
}

export interface V3ClinicalRecord {
  id: string
  clinicId: string
  patientId: string
  treatmentId: string | null
  treatmentSessionId: string | null
  procedureId: string | null
  status: ClinicalRecordStatus
  currentVersionId: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
  sessionNumber: number | null
  versions: V3ClinicalVersion[]
}

export interface V3ClinicalRecordInput {
  patientId: string
  treatmentId?: string | null
  treatmentSessionId?: string | null
  procedureId?: string | null
  procedureName?: string | null
  recordedAt?: string | null
  anamnesis?: string | null
  evolution?: string | null
  productsUsedSummary?: string | null
  nextSteps?: string | null
  changeReason?: string | null
}

export interface V3ClinicalVersionInput {
  procedureName?: string | null
  recordedAt?: string | null
  anamnesis?: string | null
  evolution?: string | null
  productsUsedSummary?: string | null
  nextSteps?: string | null
  changeReason?: string | null
}

export interface V3ClinicalProcedureOption {
  id: string
  name: string
}

export interface V3ClinicalTreatmentOption {
  id: string
  name: string
}

export interface V3ClinicalSessionOption {
  id: string
  treatmentId: string
  sessionNumber: number | null
}

export interface V3ClinicalContext {
  procedures: V3ClinicalProcedureOption[]
  treatments: V3ClinicalTreatmentOption[]
  sessions: V3ClinicalSessionOption[]
}
