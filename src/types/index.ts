export type PatientStatus = 'ativo' | 'inativo' | 'em_tratamento'

export interface Patient {
  id: string
  name: string
  email: string
  phone: string
  cpf: string
  birthDate: string
  gender: string
  address: string
  allergies: string
  medications: string
  notes: string
  status: PatientStatus
  createdAt: string
  updatedAt: string
}

export interface MedicalRecordEntry {
  id: string
  patientId: string
  date: string
  procedure: string
  professional: string
  anamnesis: string
  evolution: string
  productsUsed: string
  nextSteps: string
  createdAt: string
}

export type AppointmentStatus =
  | 'agendado'
  | 'confirmado'
  | 'realizado'
  | 'cancelado'
  | 'faltou'

export interface Appointment {
  id: string
  patientId: string
  title: string
  procedure: string
  date: string
  startTime: string
  endTime: string
  status: AppointmentStatus
  notes: string
  createdAt: string
}

export type PhotoSide = 'antes' | 'depois'

export interface PhotoRecord {
  id: string
  patientId: string
  procedure: string
  side: PhotoSide
  takenAt: string
  notes: string
  /** Data URL (base64) — V1 local. Em V2: storage em nuvem. */
  imageData: string
  pairId?: string
  createdAt: string
}

export type ConsentStatus = 'rascunho' | 'enviado' | 'assinado' | 'expirado'

export interface ConsentForm {
  id: string
  patientId: string
  title: string
  procedure: string
  content: string
  status: ConsentStatus
  signedAt?: string
  signedBy?: string
  createdAt: string
}

export type ContractStatus = 'rascunho' | 'enviado' | 'assinado' | 'encerrado'

export interface Contract {
  id: string
  patientId: string
  title: string
  description: string
  value: number
  startDate: string
  endDate?: string
  status: ContractStatus
  clauses: string
  createdAt: string
}

export type BudgetStatus = 'rascunho' | 'enviado' | 'aprovado' | 'recusado' | 'expirado'

export interface BudgetItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
}

export interface Budget {
  id: string
  patientId: string
  title: string
  items: BudgetItem[]
  discount: number
  notes: string
  status: BudgetStatus
  validUntil: string
  createdAt: string
}

export interface ClinicData {
  patients: Patient[]
  records: MedicalRecordEntry[]
  appointments: Appointment[]
  photos: PhotoRecord[]
  consents: ConsentForm[]
  contracts: Contract[]
  budgets: Budget[]
}

export const STORAGE_KEY = 'evelyn-clinic-v1'
