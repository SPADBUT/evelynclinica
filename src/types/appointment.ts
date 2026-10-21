export const APPOINTMENT_STATUSES = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'] as const

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]

export function isAppointmentStatus(value: unknown): value is AppointmentStatus {
  return typeof value === 'string' && (APPOINTMENT_STATUSES as readonly string[]).includes(value)
}

export interface V3Appointment {
  id: string
  clinicId: string
  patientId: string
  patientName: string | null
  professionalId: string
  professionalName: string | null
  procedureId: string | null
  title: string
  procedureName: string | null
  startsAt: string
  endsAt: string
  status: AppointmentStatus
  notes: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface V3BookableProfessional {
  userId: string
  fullName: string
  role: 'admin' | 'professional'
}

export interface V3AgendaProcedure {
  id: string
  name: string
  defaultDurationMinutes: number | null
}

/** Fields the staff form may send. Clinic, author, and status are not part of this input. */
export interface V3AppointmentInput {
  patientId: string
  professionalId: string
  procedureId?: string | null
  title: string
  procedureName?: string | null
  startsAt: string
  endsAt: string
  notes?: string | null
}

export type V3AppointmentUpdateInput = Omit<V3AppointmentInput, 'patientId'>
