import { isAppointmentStatus, type V3AgendaProcedure, type V3Appointment, type V3BookableProfessional } from '../types/appointment'

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function nestedName(value: unknown): string | null {
  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== 'object') return null
  return text((row as { full_name?: unknown }).full_name)
}

export function readAppointment(value: unknown): V3Appointment | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (
    typeof row.id !== 'string' ||
    typeof row.clinic_id !== 'string' ||
    typeof row.patient_id !== 'string' ||
    typeof row.professional_id !== 'string' ||
    typeof row.title !== 'string' ||
    row.title.trim().length === 0 ||
    typeof row.starts_at !== 'string' ||
    typeof row.ends_at !== 'string' ||
    !isAppointmentStatus(row.status) ||
    typeof row.created_by !== 'string' ||
    typeof row.created_at !== 'string' ||
    typeof row.updated_at !== 'string'
  ) {
    return null
  }
  return {
    id: row.id,
    clinicId: row.clinic_id,
    patientId: row.patient_id,
    patientName: nestedName(row.patients),
    professionalId: row.professional_id,
    professionalName: nestedName(row.professional),
    procedureId: text(row.procedure_id),
    title: row.title.trim(),
    procedureName: text(row.procedure_name),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    notes: text(row.notes),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function readBookableProfessional(value: unknown): V3BookableProfessional | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (typeof row.user_id !== 'string' || typeof row.full_name !== 'string' || row.full_name.trim().length === 0) {
    return null
  }
  if (row.role !== 'admin' && row.role !== 'professional') return null
  return { userId: row.user_id, fullName: row.full_name.trim(), role: row.role }
}

export function readAgendaProcedure(value: unknown): V3AgendaProcedure | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (typeof row.id !== 'string' || typeof row.name !== 'string' || row.name.trim().length === 0) return null
  const duration = row.default_duration_minutes
  if (duration !== null && (typeof duration !== 'number' || !Number.isInteger(duration) || duration <= 0)) return null
  return {
    id: row.id,
    name: row.name.trim(),
    defaultDurationMinutes: typeof duration === 'number' ? duration : null,
  }
}
