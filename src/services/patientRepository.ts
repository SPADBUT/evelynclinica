import type { SupabaseClient } from '@supabase/supabase-js'
import { PatientRepositoryError, type PatientResult } from '../lib/patientRepositoryError'
import { SupabaseAuthError } from '../lib/supabaseAuthError'
import { getSupabaseClient } from '../lib/supabase'
import { tenantCan } from './v3Tenant'
import {
  isV3PatientStatus,
  type V3Patient,
  type V3PatientCreateInput,
  type V3PatientStatus,
  type V3PatientUpdateInput,
} from '../types/patient'
import type { V3TenantSnapshot } from '../types/v3Tenant'

const PATIENT_COLUMNS =
  'id, clinic_id, full_name, email, phone, cpf, birth_date, gender, address, allergies, medications, notes, status, deleted_at, created_at, updated_at'

interface PatientScope {
  clinicId: string
}

interface PostgrestErrorLike {
  code?: string
  message?: string
}

const TRANSFER_KEYS = ['clinicId', 'clinic_id'] as const

function failure<T>(error: PatientRepositoryError): PatientResult<T> {
  return { ok: false, error }
}

function success<T>(value: T): PatientResult<T> {
  return { ok: true, value }
}

/**
 * Reads the clinic from the tenant snapshot.
 * A component cannot pass its own clinic id through this function.
 * The resulting id is still not authorization. RLS remains authoritative.
 */
export function patientScopeFromTenant(
  tenant: V3TenantSnapshot,
): PatientResult<PatientScope> {
  if (tenant.status === 'unauthenticated' || tenant.status === 'loading') {
    return failure(new PatientRepositoryError('unauthenticated', 'Sessão de staff indisponível.'))
  }

  if (tenant.status === 'error' && !tenant.userId) {
    return failure(new PatientRepositoryError('unauthenticated', 'Sessão de staff indisponível.'))
  }

  if (
    tenant.status === 'authenticated_without_membership' ||
    tenant.status === 'authenticated_needs_clinic_selection' ||
    !tenant.activeClinicId
  ) {
    return failure(new PatientRepositoryError('no_active_clinic', 'Nenhuma clínica ativa selecionada.'))
  }

  if (tenant.status === 'error' || !tenantCan(tenant, 'patients.manage')) {
    return failure(new PatientRepositoryError('forbidden', 'O papel ativo não gerencia pacientes.'))
  }

  return success({ clinicId: tenant.activeClinicId })
}

function rejectedClinicTransfer(input: object): PatientRepositoryError | null {
  for (const key of TRANSFER_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      return new PatientRepositoryError(
        'clinic_transfer_rejected',
        'A clínica do paciente não pode ser alterada por este fluxo.',
      )
    }
  }
  return null
}

function blankToNull(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function invalid(message: string): PatientRepositoryError {
  return new PatientRepositoryError('invalid_input', message)
}

function validateStatus(status: V3PatientStatus | undefined): PatientRepositoryError | null {
  if (status === undefined) return null
  if (!isV3PatientStatus(status)) return invalid('Situação do paciente inválida.')
  return null
}

function validateBirthDate(value: string | null | undefined): PatientRepositoryError | null {
  if (value == null || value === '') return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return invalid('Data de nascimento inválida.')
  return null
}

function mapDatabaseError(error: PostgrestErrorLike): PatientRepositoryError {
  const code = error.code ?? ''
  const message = (error.message ?? '').toLowerCase()
  if (
    code === '42501' ||
    message.includes('row-level security') ||
    message.includes('permission denied')
  ) {
    return new PatientRepositoryError('forbidden', 'Acesso negado pela política da clínica.')
  }
  if (code === 'P0001' && message.includes('clinic_id is immutable')) {
    return new PatientRepositoryError(
      'clinic_transfer_rejected',
      'A clínica do paciente não pode ser alterada.',
    )
  }
  return new PatientRepositoryError('repository_error', 'Não foi possível concluir a operação de paciente.')
}

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function readPatient(value: unknown): V3Patient | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (
    typeof row.id !== 'string' ||
    typeof row.clinic_id !== 'string' ||
    typeof row.full_name !== 'string' ||
    !isV3PatientStatus(row.status) ||
    typeof row.created_at !== 'string' ||
    typeof row.updated_at !== 'string'
  ) {
    return null
  }
  return {
    id: row.id,
    clinicId: row.clinic_id,
    fullName: row.full_name,
    email: readOptionalString(row.email),
    phone: readOptionalString(row.phone),
    cpf: readOptionalString(row.cpf),
    birthDate: readOptionalString(row.birth_date),
    gender: readOptionalString(row.gender),
    address: readOptionalString(row.address),
    allergies: readOptionalString(row.allergies),
    medications: readOptionalString(row.medications),
    notes: readOptionalString(row.notes),
    status: row.status,
    deletedAt: readOptionalString(row.deleted_at),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function readPatients(value: unknown): V3Patient[] | null {
  if (!Array.isArray(value)) return null
  const patients: V3Patient[] = []
  for (const row of value) {
    const patient = readPatient(row)
    if (!patient) return null
    patients.push(patient)
  }
  return patients
}

function openClient(): PatientResult<SupabaseClient> {
  try {
    return success(getSupabaseClient())
  } catch (error) {
    if (error instanceof SupabaseAuthError && (error.code === 'disabled' || error.code === 'missing_env')) {
      return failure(new PatientRepositoryError('unauthenticated', 'Sessão Supabase indisponível.'))
    }
    return failure(new PatientRepositoryError('repository_error', 'Não foi possível concluir a operação de paciente.'))
  }
}

function scoped(
  tenant: V3TenantSnapshot,
): PatientResult<{ client: SupabaseClient; scope: PatientScope }> {
  const scope = patientScopeFromTenant(tenant)
  if (!scope.ok) return scope
  const client = openClient()
  if (!client.ok) return client
  return success({ client: client.value, scope: scope.value })
}

export async function listPatients(tenant: V3TenantSnapshot): Promise<PatientResult<V3Patient[]>> {
  const ready = scoped(tenant)
  if (!ready.ok) return ready
  try {
    const { data, error } = await ready.value.client
      .from('patients')
      .select(PATIENT_COLUMNS)
      .eq('clinic_id', ready.value.scope.clinicId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (error) return failure(mapDatabaseError(error))
    const patients = readPatients(data)
    if (!patients) {
      return failure(new PatientRepositoryError('repository_error', 'Resposta de pacientes inválida.'))
    }
    return success(patients)
  } catch {
    return failure(new PatientRepositoryError('repository_error', 'Não foi possível concluir a operação de paciente.'))
  }
}

export async function getPatientById(
  tenant: V3TenantSnapshot,
  patientId: string,
): Promise<PatientResult<V3Patient>> {
  if (!patientId.trim()) return failure(invalid('Paciente sem identificador.'))
  const ready = scoped(tenant)
  if (!ready.ok) return ready
  try {
    const { data, error } = await ready.value.client
      .from('patients')
      .select(PATIENT_COLUMNS)
      .eq('id', patientId)
      .eq('clinic_id', ready.value.scope.clinicId)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) return failure(mapDatabaseError(error))
    // A hidden row and a missing row both come back empty. A surfaced RLS error stays forbidden.
    const patient = readPatient(data)
    if (!patient) return failure(new PatientRepositoryError('patient_not_found', 'Paciente não encontrado.'))
    return success(patient)
  } catch {
    return failure(new PatientRepositoryError('repository_error', 'Não foi possível concluir a operação de paciente.'))
  }
}

function createRow(scope: PatientScope, input: V3PatientCreateInput): PatientResult<Record<string, unknown>> {
  const transfer = rejectedClinicTransfer(input)
  if (transfer) return failure(transfer)
  const statusError = validateStatus(input.status)
  if (statusError) return failure(statusError)
  const birthError = validateBirthDate(input.birthDate)
  if (birthError) return failure(birthError)
  const fullName = input.fullName?.trim?.() ?? ''
  if (!fullName) return failure(invalid('Nome do paciente é obrigatório.'))
  return success({
    clinic_id: scope.clinicId,
    full_name: fullName,
    email: blankToNull(input.email),
    phone: blankToNull(input.phone),
    cpf: blankToNull(input.cpf),
    birth_date: blankToNull(input.birthDate),
    gender: blankToNull(input.gender),
    address: blankToNull(input.address),
    allergies: blankToNull(input.allergies),
    medications: blankToNull(input.medications),
    notes: blankToNull(input.notes),
    status: input.status ?? 'active',
  })
}

export async function createPatient(
  tenant: V3TenantSnapshot,
  input: V3PatientCreateInput,
): Promise<PatientResult<V3Patient>> {
  const transfer = rejectedClinicTransfer(input)
  if (transfer) return failure(transfer)
  const ready = scoped(tenant)
  if (!ready.ok) return ready
  const row = createRow(ready.value.scope, input)
  if (!row.ok) return row
  try {
    const { data, error } = await ready.value.client
      .from('patients')
      .insert(row.value)
      .select(PATIENT_COLUMNS)
      .maybeSingle()
    if (error) return failure(mapDatabaseError(error))
    const patient = readPatient(data)
    if (!patient) {
      return failure(new PatientRepositoryError('repository_error', 'Resposta de pacientes inválida.'))
    }
    return success(patient)
  } catch {
    return failure(new PatientRepositoryError('repository_error', 'Não foi possível concluir a operação de paciente.'))
  }
}

function updateRow(input: V3PatientUpdateInput): PatientResult<Record<string, unknown>> {
  const transfer = rejectedClinicTransfer(input)
  if (transfer) return failure(transfer)
  const statusError = validateStatus(input.status)
  if (statusError) return failure(statusError)
  const birthError = validateBirthDate(input.birthDate)
  if (birthError) return failure(birthError)
  const row: Record<string, unknown> = {}
  if (input.fullName !== undefined) {
    const fullName = input.fullName.trim()
    if (!fullName) return failure(invalid('Nome do paciente é obrigatório.'))
    row.full_name = fullName
  }
  if (input.email !== undefined) row.email = blankToNull(input.email)
  if (input.phone !== undefined) row.phone = blankToNull(input.phone)
  if (input.cpf !== undefined) row.cpf = blankToNull(input.cpf)
  if (input.birthDate !== undefined) row.birth_date = blankToNull(input.birthDate)
  if (input.gender !== undefined) row.gender = blankToNull(input.gender)
  if (input.address !== undefined) row.address = blankToNull(input.address)
  if (input.allergies !== undefined) row.allergies = blankToNull(input.allergies)
  if (input.medications !== undefined) row.medications = blankToNull(input.medications)
  if (input.notes !== undefined) row.notes = blankToNull(input.notes)
  if (input.status !== undefined) row.status = input.status
  if (Object.keys(row).length === 0) return failure(invalid('Nenhum campo para atualizar.'))
  return success(row)
}

export async function updatePatient(
  tenant: V3TenantSnapshot,
  patientId: string,
  input: V3PatientUpdateInput,
): Promise<PatientResult<V3Patient>> {
  if (!patientId.trim()) return failure(invalid('Paciente sem identificador.'))
  const row = updateRow(input)
  if (!row.ok) return row
  const ready = scoped(tenant)
  if (!ready.ok) return ready
  try {
    const { data, error } = await ready.value.client
      .from('patients')
      .update(row.value)
      .eq('id', patientId)
      .eq('clinic_id', ready.value.scope.clinicId)
      .is('deleted_at', null)
      .select(PATIENT_COLUMNS)
      .maybeSingle()
    if (error) return failure(mapDatabaseError(error))
    // Zero updated rows are empty, including an update the policy does not match.
    const patient = readPatient(data)
    if (!patient) return failure(new PatientRepositoryError('patient_not_found', 'Paciente não encontrado.'))
    return success(patient)
  } catch {
    return failure(new PatientRepositoryError('repository_error', 'Não foi possível concluir a operação de paciente.'))
  }
}

/** Sets public.patients.deleted_at. This is an update, not a physical delete. */
export async function softDeletePatient(
  tenant: V3TenantSnapshot,
  patientId: string,
): Promise<PatientResult<V3Patient>> {
  if (!patientId.trim()) return failure(invalid('Paciente sem identificador.'))
  const ready = scoped(tenant)
  if (!ready.ok) return ready
  try {
    const { data, error } = await ready.value.client
      .from('patients')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', patientId)
      .eq('clinic_id', ready.value.scope.clinicId)
      .is('deleted_at', null)
      .select(PATIENT_COLUMNS)
      .maybeSingle()
    if (error) return failure(mapDatabaseError(error))
    const patient = readPatient(data)
    if (!patient) return failure(new PatientRepositoryError('patient_not_found', 'Paciente não encontrado.'))
    return success(patient)
  } catch {
    return failure(new PatientRepositoryError('repository_error', 'Não foi possível concluir a operação de paciente.'))
  }
}
