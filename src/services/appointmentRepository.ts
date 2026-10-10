import type { SupabaseClient } from '@supabase/supabase-js'
import { AppointmentRepositoryError, type AppointmentResult } from '../lib/appointmentRepositoryError'
import { nextCalendarDay, saoPauloWallToIso } from '../lib/saoPauloTime'
import { getSupabaseClient } from '../lib/supabase'
import { tenantCan } from './v3Tenant'
import { readAgendaProcedure, readAppointment, readBookableProfessional } from './appointmentMapping'
import type {
  AppointmentStatus,
  V3AgendaProcedure,
  V3Appointment,
  V3AppointmentInput,
  V3AppointmentUpdateInput,
  V3BookableProfessional,
} from '../types/appointment'
import type { V3TenantSnapshot } from '../types/v3Tenant'

const APPOINTMENT_COLUMNS =
  'id, clinic_id, patient_id, professional_id, procedure_id, title, procedure_name, starts_at, ends_at, status, notes, created_by, created_at, updated_at, patients(full_name), professional:profiles!appointments_professional_id_fkey(full_name)'

const CLINIC_KEYS = ['clinicId', 'clinic_id'] as const
const AUTHORITY_KEYS = ['createdBy', 'created_by', 'status', 'id'] as const

interface AgendaScope {
  clinicId: string
  userId: string
  client: SupabaseClient
}

interface PostgrestErrorLike {
  code?: string
  message?: string
}

function failure<T>(error: AppointmentRepositoryError): AppointmentResult<T> {
  return { ok: false, error }
}

function success<T>(value: T): AppointmentResult<T> {
  return { ok: true, value }
}

function invalid(message: string): AppointmentRepositoryError {
  return new AppointmentRepositoryError('invalid_input', message)
}

/**
 * Reads the clinic from the tenant snapshot.
 * The caller cannot pass another clinic id through this function.
 * RLS remains authoritative.
 */
export function agendaScopeFromTenant(tenant: V3TenantSnapshot): AppointmentResult<AgendaScope> {
  if (tenant.status === 'unauthenticated' || tenant.status === 'loading') {
    return failure(new AppointmentRepositoryError('unauthenticated', 'Sessão de staff indisponível.'))
  }

  if (tenant.status === 'error' && !tenant.userId) {
    return failure(new AppointmentRepositoryError('unauthenticated', 'Sessão de staff indisponível.'))
  }

  if (
    tenant.status === 'authenticated_without_membership' ||
    tenant.status === 'authenticated_needs_clinic_selection' ||
    !tenant.activeClinicId ||
    !tenant.userId
  ) {
    return failure(new AppointmentRepositoryError('no_active_clinic', 'Nenhuma clínica ativa selecionada.'))
  }

  if (tenant.status === 'error' || !tenantCan(tenant, 'agenda.manage')) {
    return failure(new AppointmentRepositoryError('forbidden', 'O papel ativo não acessa a agenda.'))
  }

  try {
    return success({ clinicId: tenant.activeClinicId, userId: tenant.userId, client: getSupabaseClient() })
  } catch {
    return failure(new AppointmentRepositoryError('repository_error', 'Não foi possível concluir a operação de agenda.'))
  }
}

function rejectedKeys(input: object, keys: readonly string[], message: string, code: AppointmentRepositoryError['code']) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      return new AppointmentRepositoryError(code, message)
    }
  }
  return null
}

function rejectedAppointmentOverride(input: object): AppointmentRepositoryError | null {
  return (
    rejectedKeys(input, CLINIC_KEYS, 'A clínica do horário não pode ser enviada por este fluxo.', 'clinic_transfer_rejected') ??
    rejectedKeys(input, AUTHORITY_KEYS, 'Autor e status não podem ser enviados por este fluxo.', 'invalid_input')
  )
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

function mapDatabaseError(error: PostgrestErrorLike): AppointmentRepositoryError {
  const code = error.code ?? ''
  const message = error.message ?? ''
  if (code === '23P01' || message.includes('exclusion constraint') || message.includes('appointments_professional_overlap') || message.includes('appointments_patient_overlap')) {
    return new AppointmentRepositoryError('conflict', 'Horário indisponível.')
  }
  if (message.includes('appointment closed')) {
    return new AppointmentRepositoryError('closed', 'Este horário não aceita alteração.')
  }
  if (message.includes('appointment transition denied')) {
    return new AppointmentRepositoryError('invalid_transition', 'Esta mudança de status não é permitida.')
  }
  if (message.includes('appointment professional not bookable')) {
    return new AppointmentRepositoryError('invalid_input', 'Profissional indisponível para agenda.')
  }
  if (message.includes('appointment patient missing') || message.includes('appointment missing') || code === 'P0002') {
    return new AppointmentRepositoryError('not_found', 'Horário ou paciente não encontrado nesta clínica.')
  }
  if (message.includes('appointment invalid input') || code === '22023' || code === '23514') {
    return new AppointmentRepositoryError('invalid_input', 'Dados do horário inválidos.')
  }
  if (message.includes('appointment unauthenticated')) {
    return new AppointmentRepositoryError('unauthenticated', 'Sessão de staff indisponível.')
  }
  if (code === '42501' || message.includes('appointment denied')) {
    return new AppointmentRepositoryError('forbidden', 'O papel ativo não acessa a agenda.')
  }
  return new AppointmentRepositoryError('repository_error', 'Não foi possível concluir a operação de agenda.')
}

async function callRpc(client: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<AppointmentResult<string>> {
  try {
    const result = await client.rpc(fn, args)
    if (result.error) return failure(mapDatabaseError(result.error))
    if (typeof result.data !== 'string' || result.data.trim() === '') {
      return failure(new AppointmentRepositoryError('repository_error', 'Resposta de agenda inválida.'))
    }
    return success(result.data)
  } catch {
    return failure(new AppointmentRepositoryError('repository_error', 'Não foi possível concluir a operação de agenda.'))
  }
}

async function loadAppointment(client: SupabaseClient, clinicId: string, appointmentId: string): Promise<AppointmentResult<V3Appointment>> {
  try {
    const { data, error } = await client
      .from('appointments')
      .select(APPOINTMENT_COLUMNS)
      .eq('clinic_id', clinicId)
      .eq('id', appointmentId)
      .maybeSingle()
    if (error) return failure(mapDatabaseError(error))
    const appointment = readAppointment(data)
    if (!appointment || appointment.clinicId !== clinicId) {
      return failure(new AppointmentRepositoryError('not_found', 'Horário ou paciente não encontrado nesta clínica.'))
    }
    return success(appointment)
  } catch {
    return failure(new AppointmentRepositoryError('repository_error', 'Não foi possível concluir a operação de agenda.'))
  }
}

function readRows<T>(value: unknown, read: (row: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null
  const rows: T[] = []
  for (const row of value) {
    const parsed = read(row)
    if (!parsed) return null
    rows.push(parsed)
  }
  return rows
}

export async function listAgendaDay(tenant: V3TenantSnapshot, day: string): Promise<AppointmentResult<V3Appointment[]>> {
  const ready = agendaScopeFromTenant(tenant)
  if (!ready.ok) return ready
  const nextDay = nextCalendarDay(day)
  const startsAt = saoPauloWallToIso(day, '00:00')
  const endsBefore = nextDay ? saoPauloWallToIso(nextDay, '00:00') : null
  if (!startsAt || !endsBefore) return failure(invalid('Data da agenda inválida.'))
  try {
    const { data, error } = await ready.value.client
      .from('appointments')
      .select(APPOINTMENT_COLUMNS)
      .eq('clinic_id', ready.value.clinicId)
      .gte('starts_at', startsAt)
      .lt('starts_at', endsBefore)
      .order('starts_at', { ascending: true })
    if (error) return failure(mapDatabaseError(error))
    const appointments = readRows(data, readAppointment)
    if (!appointments || appointments.some((item) => item.clinicId !== ready.value.clinicId)) {
      return failure(new AppointmentRepositoryError('repository_error', 'Resposta de agenda inválida.'))
    }
    return success(appointments)
  } catch {
    return failure(new AppointmentRepositoryError('repository_error', 'Não foi possível concluir a operação de agenda.'))
  }
}

export async function listPatientAppointments(
  tenant: V3TenantSnapshot,
  patientId: string,
): Promise<AppointmentResult<V3Appointment[]>> {
  const ready = agendaScopeFromTenant(tenant)
  if (!ready.ok) return ready
  if (!patientId.trim()) return failure(invalid('Paciente inválida.'))
  try {
    const { data, error } = await ready.value.client
      .from('appointments')
      .select(APPOINTMENT_COLUMNS)
      .eq('clinic_id', ready.value.clinicId)
      .eq('patient_id', patientId)
      .order('starts_at', { ascending: false })
    if (error) return failure(mapDatabaseError(error))
    const appointments = readRows(data, readAppointment)
    if (!appointments || appointments.some((item) => item.clinicId !== ready.value.clinicId || item.patientId !== patientId)) {
      return failure(new AppointmentRepositoryError('repository_error', 'Resposta de agenda inválida.'))
    }
    return success(appointments)
  } catch {
    return failure(new AppointmentRepositoryError('repository_error', 'Não foi possível concluir a operação de agenda.'))
  }
}

export async function listBookableProfessionals(tenant: V3TenantSnapshot): Promise<AppointmentResult<V3BookableProfessional[]>> {
  const ready = agendaScopeFromTenant(tenant)
  if (!ready.ok) return ready
  try {
    const result = await ready.value.client.rpc('list_bookable_professionals', { p_clinic_id: ready.value.clinicId })
    if (result.error) return failure(mapDatabaseError(result.error))
    const professionals = readRows(result.data, readBookableProfessional)
    if (!professionals) return failure(new AppointmentRepositoryError('repository_error', 'Resposta de agenda inválida.'))
    return success(professionals)
  } catch {
    return failure(new AppointmentRepositoryError('repository_error', 'Não foi possível concluir a operação de agenda.'))
  }
}

export async function listActiveProcedures(tenant: V3TenantSnapshot): Promise<AppointmentResult<V3AgendaProcedure[]>> {
  const ready = agendaScopeFromTenant(tenant)
  if (!ready.ok) return ready
  try {
    const result = await ready.value.client.rpc('list_active_procedures', { p_clinic_id: ready.value.clinicId })
    if (result.error) return failure(mapDatabaseError(result.error))
    const procedures = readRows(result.data, readAgendaProcedure)
    if (!procedures) return failure(new AppointmentRepositoryError('repository_error', 'Resposta de agenda inválida.'))
    return success(procedures)
  } catch {
    return failure(new AppointmentRepositoryError('repository_error', 'Não foi possível concluir a operação de agenda.'))
  }
}

function scheduleArgs(scope: AgendaScope, input: V3AppointmentInput | V3AppointmentUpdateInput) {
  return {
    p_clinic_id: scope.clinicId,
    p_professional_id: input.professionalId,
    p_procedure_id: blankToNull(input.procedureId),
    p_title: input.title.trim(),
    p_procedure_name: blankToNull(input.procedureName),
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_notes: blankToNull(input.notes),
  }
}

function validateSchedule(input: { professionalId: string; title: string; startsAt: string; endsAt: string }): AppointmentRepositoryError | null {
  if (!input.professionalId.trim()) return invalid('Selecione o profissional.')
  if (!input.title.trim()) return invalid('Informe o título do horário.')
  const starts = new Date(input.startsAt)
  const ends = new Date(input.endsAt)
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts) {
    return invalid('O término precisa ser depois do início.')
  }
  if (ends.getTime() - starts.getTime() > 12 * 60 * 60 * 1000) {
    return invalid('O horário não pode durar mais de 12 horas.')
  }
  return null
}

export async function createAppointment(
  tenant: V3TenantSnapshot,
  input: V3AppointmentInput,
): Promise<AppointmentResult<V3Appointment>> {
  const rejected = rejectedAppointmentOverride(input)
  if (rejected) return failure(rejected)
  const ready = agendaScopeFromTenant(tenant)
  if (!ready.ok) return ready
  if (!input.patientId.trim()) return failure(invalid('Selecione a paciente.'))
  const scheduleError = validateSchedule(input)
  if (scheduleError) return failure(scheduleError)
  const created = await callRpc(ready.value.client, 'create_appointment', {
    ...scheduleArgs(ready.value, input),
    p_patient_id: input.patientId,
  })
  if (!created.ok) return created
  return loadAppointment(ready.value.client, ready.value.clinicId, created.value)
}

export async function updateAppointment(
  tenant: V3TenantSnapshot,
  appointmentId: string,
  input: V3AppointmentUpdateInput,
): Promise<AppointmentResult<V3Appointment>> {
  const rejected = rejectedAppointmentOverride(input)
  if (rejected) return failure(rejected)
  const ready = agendaScopeFromTenant(tenant)
  if (!ready.ok) return ready
  if (!appointmentId.trim()) return failure(invalid('Horário inválido.'))
  const scheduleError = validateSchedule(input)
  if (scheduleError) return failure(scheduleError)
  const updated = await callRpc(ready.value.client, 'update_appointment', {
    ...scheduleArgs(ready.value, input),
    p_appointment_id: appointmentId,
  })
  if (!updated.ok) return updated
  return loadAppointment(ready.value.client, ready.value.clinicId, updated.value)
}

export async function transitionAppointment(
  tenant: V3TenantSnapshot,
  appointmentId: string,
  status: AppointmentStatus,
): Promise<AppointmentResult<V3Appointment>> {
  const ready = agendaScopeFromTenant(tenant)
  if (!ready.ok) return ready
  if (!appointmentId.trim()) return failure(invalid('Horário inválido.'))
  const transitioned = await callRpc(ready.value.client, 'transition_appointment', {
    p_clinic_id: ready.value.clinicId,
    p_appointment_id: appointmentId,
    p_status: status,
  })
  if (!transitioned.ok) return transitioned
  return loadAppointment(ready.value.client, ready.value.clinicId, transitioned.value)
}
