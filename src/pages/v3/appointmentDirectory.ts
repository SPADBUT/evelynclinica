import type { AppointmentStatus } from '../../types/appointment'
import type { SupabaseClinicRole } from '../../types/supabaseAuth'

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  completed: 'Realizado',
  cancelled: 'Cancelado',
  no_show: 'Faltou',
}

export const APPOINTMENT_STATUS_TONE: Record<AppointmentStatus, 'info' | 'success' | 'neutral' | 'danger' | 'warning'> = {
  scheduled: 'info',
  confirmed: 'success',
  completed: 'neutral',
  cancelled: 'danger',
  no_show: 'warning',
}

export interface AppointmentTransition {
  status: AppointmentStatus
  label: string
}

export function appointmentTransitions(
  status: AppointmentStatus,
  role: SupabaseClinicRole | null,
): AppointmentTransition[] {
  if (status === 'scheduled') {
    return [
      { status: 'confirmed', label: 'Confirmar' },
      { status: 'completed', label: 'Realizado' },
      { status: 'no_show', label: 'Faltou' },
      { status: 'cancelled', label: 'Cancelar' },
    ]
  }
  if (status === 'confirmed') {
    return [
      { status: 'scheduled', label: 'Voltar para agendado' },
      { status: 'completed', label: 'Realizado' },
      { status: 'no_show', label: 'Faltou' },
      { status: 'cancelled', label: 'Cancelar' },
    ]
  }
  if (status === 'cancelled') {
    return [
      { status: 'scheduled', label: 'Reabrir' },
      { status: 'confirmed', label: 'Reabrir confirmado' },
    ]
  }
  if (status === 'no_show') {
    return [
      { status: 'scheduled', label: 'Reabrir' },
      { status: 'confirmed', label: 'Reabrir confirmado' },
      { status: 'completed', label: 'Realizado' },
    ]
  }
  if (status === 'completed' && role === 'admin') {
    return [{ status: 'scheduled', label: 'Reabrir' }]
  }
  return []
}

export function canEditAppointment(status: AppointmentStatus): boolean {
  return status === 'scheduled' || status === 'confirmed'
}
