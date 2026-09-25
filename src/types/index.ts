export type PatientStatus = 'ativo' | 'inativo' | 'em_tratamento'

export type UserRole = 'admin' | 'assistente' | 'paciente'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  /** Vincula conta de paciente ao prontuário */
  patientId?: string
  passwordSalt: string
  passwordHash: string
  createdAt: string
  active: boolean
}

export interface SessionUser {
  id: string
  name: string
  email: string
  role: UserRole
  patientId?: string
}

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
  tags: string[]
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
  /** Data URL (base64) — V1/V2 local. Storage em nuvem em evolução. */
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
  /** Assinatura manuscrita (data URL do canvas) */
  signatureData?: string
  /** Trilha LGPD: user agent no momento da assinatura */
  signedUserAgent?: string
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
  signedAt?: string
  signedBy?: string
  signatureData?: string
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

/** Pipeline CRM V2 */
export type LeadStage = 'lead' | 'avaliacao' | 'tratamento' | 'manutencao'

export interface Lead {
  id: string
  name: string
  email: string
  phone: string
  source: string
  stage: LeadStage
  interest: string
  notes: string
  patientId?: string
  createdAt: string
  updatedAt: string
}

export type InteractionChannel = 'whatsapp' | 'email' | 'ligacao' | 'outro'

export interface Interaction {
  id: string
  /** Paciente ou lead */
  patientId?: string
  leadId?: string
  channel: InteractionChannel
  summary: string
  occurredAt: string
  createdBy: string
  createdAt: string
}

export type ReminderKind = 'retorno' | 'orcamento_validade' | 'outro'

export interface Reminder {
  id: string
  patientId?: string
  kind: ReminderKind
  title: string
  dueDate: string
  done: boolean
  notes: string
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
  users: AuthUser[]
  leads: Lead[]
  interactions: Interaction[]
  reminders: Reminder[]
}

export const STORAGE_KEY = 'evelyn-clinic-v2'
export const SESSION_KEY = 'evelyn-clinic-session-v2'
export const LEGACY_STORAGE_KEY = 'evelyn-clinic-v1'
