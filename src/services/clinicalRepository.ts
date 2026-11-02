import type { SupabaseClient } from '@supabase/supabase-js'
import { ClinicalRepositoryError, type ClinicalResult } from '../lib/clinicalRepositoryError'
import { SupabaseAuthError } from '../lib/supabaseAuthError'
import { getSupabaseClient } from '../lib/supabase'
import {
  assembleClinicalRecord,
  readClinicalHeader,
  readClinicalVersion,
  readProcedureOption,
  readSessionOption,
  readTreatmentOption,
  type ClinicalHeader,
} from './clinicalMapping'
import { tenantCan } from './v3Tenant'
import type {
  ClinicalRecordStatus,
  V3ClinicalContext,
  V3ClinicalRecord,
  V3ClinicalRecordInput,
  V3ClinicalVersion,
  V3ClinicalVersionInput,
} from '../types/clinicalRecord'
import type { V3TenantSnapshot } from '../types/v3Tenant'

const HEADER_COLUMNS =
  'id, clinic_id, patient_id, treatment_id, treatment_session_id, procedure_id, status, current_version_id, created_by, created_at, updated_at, treatment_sessions(session_number)'

const VERSION_COLUMNS =
  'id, clinic_id, clinical_record_id, version_number, procedure_name, professional_name, anamnesis, evolution, products_used_summary, next_steps, change_reason, recorded_at, created_by, created_at'

const CLINIC_KEYS = ['clinicId', 'clinic_id'] as const
const AUTHOR_KEYS = ['createdBy', 'created_by', 'professionalName', 'professional_name', 'status', 'id'] as const
const LINK_KEYS = [
  'patientId',
  'patient_id',
  'treatmentId',
  'treatment_id',
  'treatmentSessionId',
  'treatment_session_id',
  'procedureId',
  'procedure_id',
  'currentVersionId',
  'current_version_id',
] as const

interface ClinicalScope {
  clinicId: string
  userId: string
}

interface PostgrestErrorLike {
  code?: string
  message?: string
}

function failure<T>(error: ClinicalRepositoryError): ClinicalResult<T> {
  return { ok: false, error }
}

function success<T>(value: T): ClinicalResult<T> {
  return { ok: true, value }
}

function invalid(message: string): ClinicalRepositoryError {
  return new ClinicalRepositoryError('invalid_input', message)
}

function closed(message: string): ClinicalRepositoryError {
  return new ClinicalRepositoryError('record_closed', message)
}

/**
 * Reads the clinic from the tenant snapshot.
 * The caller cannot pass another clinic id through this function.
 * RLS remains authoritative.
 */
export function clinicalScopeFromTenant(tenant: V3TenantSnapshot): ClinicalResult<ClinicalScope> {
  if (tenant.status === 'unauthenticated' || tenant.status === 'loading') {
    return failure(new ClinicalRepositoryError('unauthenticated', 'Sessão de staff indisponível.'))
  }

  if (tenant.status === 'error' && !tenant.userId) {
    return failure(new ClinicalRepositoryError('unauthenticated', 'Sessão de staff indisponível.'))
  }

  if (
    tenant.status === 'authenticated_without_membership' ||
    tenant.status === 'authenticated_needs_clinic_selection' ||
    !tenant.activeClinicId ||
    !tenant.userId
  ) {
    return failure(new ClinicalRepositoryError('no_active_clinic', 'Nenhuma clínica ativa selecionada.'))
  }

  if (tenant.status === 'error' || !tenantCan(tenant, 'clinical.records')) {
    return failure(new ClinicalRepositoryError('forbidden', 'O papel ativo não acessa evolução clínica.'))
  }

  return success({ clinicId: tenant.activeClinicId, userId: tenant.userId })
}

function rejectedKeys(input: object, keys: readonly string[], message: string, code: ClinicalRepositoryError['code']) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      return new ClinicalRepositoryError(code, message)
    }
  }
  return null
}

function rejectedClinicalOverride(input: object, extraKeys: readonly string[] = []): ClinicalRepositoryError | null {
  return (
    rejectedKeys(
      input,
      CLINIC_KEYS,
      'A clínica da evolução não pode ser alterada por este fluxo.',
      'clinic_transfer_rejected',
    ) ??
    rejectedKeys(
      input,
      [...AUTHOR_KEYS, ...extraKeys],
      'Autor, situação e clínica não fazem parte deste formulário.',
      'invalid_input',
    )
  )
}

function blankToNull(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function textOrEmpty(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

function recordedAtValue(value: string | null | undefined): ClinicalResult<string | undefined> {
  if (value == null || value.trim() === '') return success(undefined)
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return failure(invalid('Data da evolução inválida.'))
  return success(date.toISOString())
}

function mapDatabaseError(error: PostgrestErrorLike): ClinicalRepositoryError {
  const code = error.code ?? ''
  const message = (error.message ?? '').toLowerCase()
  if (code === '42501' && message.includes('unauthenticated')) {
    return new ClinicalRepositoryError('unauthenticated', 'Sessão de staff indisponível.')
  }
  if (
    code === '42501' ||
    message.includes('row-level security') ||
    message.includes('permission denied') ||
    message.includes('clinical audit denied') ||
    message.includes('clinical evolution denied') ||
    message.includes('clinical evolution clinic mismatch') ||
    message.includes('author must be the current user')
  ) {
    return new ClinicalRepositoryError('forbidden', 'Acesso negado pela política da clínica.')
  }
  if (code === 'P0002' && message.includes('patient')) {
    return new ClinicalRepositoryError('patient_not_found', 'Paciente não encontrado nesta clínica.')
  }
  if (code === 'P0002') {
    return new ClinicalRepositoryError('clinical_record_not_found', 'Evolução não encontrada.')
  }
  if (code === 'P0001' && message.includes('clinic_id is immutable')) {
    return new ClinicalRepositoryError('clinic_transfer_rejected', 'A clínica da evolução não pode ser alterada.')
  }
  if (code === 'P0001' && message.includes('clinical evolution closed')) {
    return new ClinicalRepositoryError('record_closed', 'Evolução cancelada não pode ser alterada.')
  }
  if (code === 'P0001' && (message.includes('immutable') || message.includes('identity') || message.includes('invariant'))) {
    return new ClinicalRepositoryError('repository_error', 'O histórico clínico não pode ser alterado.')
  }
  if (
    code === 'P0001' &&
    (message.includes('cross-clinic') || message.includes('same patient') || message.includes('referenced row'))
  ) {
    return new ClinicalRepositoryError('forbidden', 'Acesso negado pela política da clínica.')
  }
  if (code === '22023' || code === '22P02' || code === '23503') {
    return new ClinicalRepositoryError('invalid_input', 'Vínculo clínico não encontrado nesta clínica.')
  }
  if (code === '23505') {
    return new ClinicalRepositoryError('repository_error', 'Não foi possível concluir a operação de evolução.')
  }
  return new ClinicalRepositoryError('repository_error', 'Não foi possível concluir a operação de evolução.')
}

function openClient(): ClinicalResult<SupabaseClient> {
  try {
    return success(getSupabaseClient())
  } catch (error) {
    if (error instanceof SupabaseAuthError && (error.code === 'disabled' || error.code === 'missing_env')) {
      return failure(new ClinicalRepositoryError('unauthenticated', 'Sessão Supabase indisponível.'))
    }
    return failure(new ClinicalRepositoryError('repository_error', 'Não foi possível concluir a operação de evolução.'))
  }
}

function scoped(tenant: V3TenantSnapshot): ClinicalResult<{ client: SupabaseClient; scope: ClinicalScope }> {
  const scope = clinicalScopeFromTenant(tenant)
  if (!scope.ok) return scope
  const client = openClient()
  if (!client.ok) return client
  return success({ client: client.value, scope: scope.value })
}

async function requireActivePatient(
  client: SupabaseClient,
  scope: ClinicalScope,
  patientId: string,
): Promise<ClinicalResult<{ id: string }>> {
  if (!patientId.trim()) return failure(invalid('Paciente sem identificador.'))
  try {
    const { data, error } = await client
      .from('patients')
      .select('id, clinic_id, deleted_at')
      .eq('id', patientId)
      .eq('clinic_id', scope.clinicId)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) return failure(mapDatabaseError(error))
    if (!data || typeof data !== 'object') {
      return failure(new ClinicalRepositoryError('patient_not_found', 'Paciente não encontrado nesta clínica.'))
    }
    const row = data as Record<string, unknown>
    if (row.id !== patientId || row.clinic_id !== scope.clinicId || row.deleted_at != null) {
      return failure(new ClinicalRepositoryError('patient_not_found', 'Paciente não encontrado nesta clínica.'))
    }
    return success({ id: patientId })
  } catch {
    return failure(new ClinicalRepositoryError('repository_error', 'Não foi possível concluir a operação de evolução.'))
  }
}

function readVersions(value: unknown, scope: ClinicalScope): ClinicalResult<V3ClinicalVersion[]> {
  if (!Array.isArray(value)) {
    return failure(new ClinicalRepositoryError('repository_error', 'Resposta de evolução inválida.'))
  }
  const versions: V3ClinicalVersion[] = []
  for (const row of value) {
    const version = readClinicalVersion(row)
    if (!version) return failure(new ClinicalRepositoryError('repository_error', 'Resposta de evolução inválida.'))
    if (version.clinicId !== scope.clinicId) continue
    versions.push(version)
  }
  return success(versions)
}

async function loadRecord(
  client: SupabaseClient,
  scope: ClinicalScope,
  recordId: string,
): Promise<ClinicalResult<V3ClinicalRecord>> {
  if (!recordId.trim()) return failure(invalid('Evolução sem identificador.'))
  try {
    const headerResult = await client
      .from('clinical_records')
      .select(HEADER_COLUMNS)
      .eq('id', recordId)
      .eq('clinic_id', scope.clinicId)
      .maybeSingle()
    if (headerResult.error) return failure(mapDatabaseError(headerResult.error))
    const header = readClinicalHeader(headerResult.data)
    if (!header || header.clinicId !== scope.clinicId || header.id !== recordId) {
      return failure(new ClinicalRepositoryError('clinical_record_not_found', 'Evolução não encontrada.'))
    }
    const versionResult = await client
      .from('clinical_record_versions')
      .select(VERSION_COLUMNS)
      .eq('clinical_record_id', recordId)
      .eq('clinic_id', scope.clinicId)
      .order('version_number', { ascending: false })
    if (versionResult.error) return failure(mapDatabaseError(versionResult.error))
    const versions = readVersions(versionResult.data, scope)
    if (!versions.ok) return versions
    return success(assembleClinicalRecord(header, versions.value))
  } catch {
    return failure(new ClinicalRepositoryError('repository_error', 'Não foi possível concluir a operação de evolução.'))
  }
}

async function callEvolutionRpc(
  client: SupabaseClient,
  fn: 'create_clinical_evolution' | 'append_clinical_evolution' | 'transition_clinical_evolution',
  args: Record<string, unknown>,
): Promise<ClinicalResult<string>> {
  try {
    const result = await client.rpc(fn, args)
    if (result.error) return failure(mapDatabaseError(result.error))
    if (typeof result.data !== 'string' || result.data.trim() === '') {
      return failure(new ClinicalRepositoryError('repository_error', 'Resposta de evolução inválida.'))
    }
    return success(result.data)
  } catch {
    return failure(new ClinicalRepositoryError('repository_error', 'Não foi possível concluir a operação de evolução.'))
  }
}

export async function listClinicalRecords(
  tenant: V3TenantSnapshot,
  patientId: string,
): Promise<ClinicalResult<V3ClinicalRecord[]>> {
  const ready = scoped(tenant)
  if (!ready.ok) return ready
  const patient = await requireActivePatient(ready.value.client, ready.value.scope, patientId)
  if (!patient.ok) return patient
  try {
    const { data, error } = await ready.value.client
      .from('clinical_records')
      .select(HEADER_COLUMNS)
      .eq('clinic_id', ready.value.scope.clinicId)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
    if (error) return failure(mapDatabaseError(error))
    if (!Array.isArray(data)) {
      return failure(new ClinicalRepositoryError('repository_error', 'Resposta de evolução inválida.'))
    }
    const headers: ClinicalHeader[] = []
    for (const row of data) {
      const header = readClinicalHeader(row)
      if (!header) return failure(new ClinicalRepositoryError('repository_error', 'Resposta de evolução inválida.'))
      if (header.clinicId !== ready.value.scope.clinicId || header.patientId !== patientId) continue
      headers.push(header)
    }
    if (headers.length === 0) return success([])
    const versionResult = await ready.value.client
      .from('clinical_record_versions')
      .select(VERSION_COLUMNS)
      .eq('clinic_id', ready.value.scope.clinicId)
      .in(
        'clinical_record_id',
        headers.map((header) => header.id),
      )
      .order('version_number', { ascending: false })
    if (versionResult.error) return failure(mapDatabaseError(versionResult.error))
    const versions = readVersions(versionResult.data, ready.value.scope)
    if (!versions.ok) return versions
    return success(headers.map((header) => assembleClinicalRecord(header, versions.value)))
  } catch {
    return failure(new ClinicalRepositoryError('repository_error', 'Não foi possível concluir a operação de evolução.'))
  }
}

export async function getClinicalRecord(
  tenant: V3TenantSnapshot,
  recordId: string,
): Promise<ClinicalResult<V3ClinicalRecord>> {
  const ready = scoped(tenant)
  if (!ready.ok) return ready
  return loadRecord(ready.value.client, ready.value.scope, recordId)
}

export async function listClinicalContext(
  tenant: V3TenantSnapshot,
  patientId: string,
): Promise<ClinicalResult<V3ClinicalContext>> {
  const ready = scoped(tenant)
  if (!ready.ok) return ready
  const patient = await requireActivePatient(ready.value.client, ready.value.scope, patientId)
  if (!patient.ok) return patient
  try {
    const procedures = await ready.value.client
      .from('procedures')
      .select('id, clinic_id, name, is_active')
      .eq('clinic_id', ready.value.scope.clinicId)
      .eq('is_active', true)
      .order('name', { ascending: true })
    if (procedures.error) return failure(mapDatabaseError(procedures.error))
    const treatments = await ready.value.client
      .from('treatments')
      .select('id, clinic_id, patient_id, name')
      .eq('clinic_id', ready.value.scope.clinicId)
      .eq('patient_id', patientId)
      .order('name', { ascending: true })
    if (treatments.error) return failure(mapDatabaseError(treatments.error))
    const sessions = await ready.value.client
      .from('treatment_sessions')
      .select('id, clinic_id, patient_id, treatment_id, session_number')
      .eq('clinic_id', ready.value.scope.clinicId)
      .eq('patient_id', patientId)
      .order('session_number', { ascending: true })
    if (sessions.error) return failure(mapDatabaseError(sessions.error))
    if (!Array.isArray(procedures.data) || !Array.isArray(treatments.data) || !Array.isArray(sessions.data)) {
      return failure(new ClinicalRepositoryError('repository_error', 'Resposta de evolução inválida.'))
    }
    return success({
      procedures: procedures.data.flatMap((row) => {
        const option = readProcedureOption(row, ready.value.scope.clinicId)
        return option ? [option] : []
      }),
      treatments: treatments.data.flatMap((row) => {
        const option = readTreatmentOption(row, ready.value.scope.clinicId, patientId)
        return option ? [option] : []
      }),
      sessions: sessions.data.flatMap((row) => {
        const option = readSessionOption(row, ready.value.scope.clinicId, patientId)
        return option ? [option] : []
      }),
    })
  } catch {
    return failure(new ClinicalRepositoryError('repository_error', 'Não foi possível concluir a operação de evolução.'))
  }
}

async function resolveLinks(
  client: SupabaseClient,
  scope: ClinicalScope,
  patientId: string,
  input: V3ClinicalRecordInput,
): Promise<ClinicalResult<{ treatmentId: string | null; treatmentSessionId: string | null; procedureId: string | null; procedureName: string }>> {
  const requestedTreatment = blankToNull(input.treatmentId)
  const requestedSession = blankToNull(input.treatmentSessionId)
  const requestedProcedure = blankToNull(input.procedureId)
  let treatmentId = requestedTreatment
  let procedureName = blankToNull(input.procedureName) ?? ''

  try {
    if (requestedSession) {
      const { data, error } = await client
        .from('treatment_sessions')
        .select('id, clinic_id, patient_id, treatment_id')
        .eq('id', requestedSession)
        .eq('clinic_id', scope.clinicId)
        .eq('patient_id', patientId)
        .maybeSingle()
      if (error) return failure(mapDatabaseError(error))
      const row = data as Record<string, unknown> | null
      if (!row || row.clinic_id !== scope.clinicId || row.patient_id !== patientId || typeof row.treatment_id !== 'string') {
        return failure(invalid('Sessão não pertence a esta paciente.'))
      }
      if (requestedTreatment && requestedTreatment !== row.treatment_id) {
        return failure(invalid('A sessão não pertence ao tratamento selecionado.'))
      }
      treatmentId = row.treatment_id
    } else if (requestedTreatment) {
      const { data, error } = await client
        .from('treatments')
        .select('id, clinic_id, patient_id')
        .eq('id', requestedTreatment)
        .eq('clinic_id', scope.clinicId)
        .eq('patient_id', patientId)
        .maybeSingle()
      if (error) return failure(mapDatabaseError(error))
      const row = data as Record<string, unknown> | null
      if (!row || row.clinic_id !== scope.clinicId || row.patient_id !== patientId) {
        return failure(invalid('Tratamento não pertence a esta paciente.'))
      }
    }

    if (requestedProcedure) {
      const { data, error } = await client
        .from('procedures')
        .select('id, clinic_id, name, is_active')
        .eq('id', requestedProcedure)
        .eq('clinic_id', scope.clinicId)
        .eq('is_active', true)
        .maybeSingle()
      if (error) return failure(mapDatabaseError(error))
      const row = data as Record<string, unknown> | null
      if (!row || row.clinic_id !== scope.clinicId || row.is_active !== true || typeof row.name !== 'string') {
        return failure(invalid('Procedimento não encontrado nesta clínica.'))
      }
      if (!procedureName) procedureName = row.name.trim()
    }
  } catch {
    return failure(new ClinicalRepositoryError('repository_error', 'Não foi possível concluir a operação de evolução.'))
  }

  if (!procedureName) return failure(invalid('Informe o procedimento.'))
  return success({
    treatmentId,
    treatmentSessionId: requestedSession,
    procedureId: requestedProcedure,
    procedureName,
  })
}

export async function createClinicalRecord(
  tenant: V3TenantSnapshot,
  input: V3ClinicalRecordInput,
): Promise<ClinicalResult<V3ClinicalRecord>> {
  const rejected = rejectedClinicalOverride(input)
  if (rejected) return failure(rejected)
  const ready = scoped(tenant)
  if (!ready.ok) return ready
  const patient = await requireActivePatient(ready.value.client, ready.value.scope, input.patientId)
  if (!patient.ok) return patient
  const recorded = recordedAtValue(input.recordedAt)
  if (!recorded.ok) return recorded
  const links = await resolveLinks(ready.value.client, ready.value.scope, input.patientId, input)
  if (!links.ok) return links
  const created = await callEvolutionRpc(ready.value.client, 'create_clinical_evolution', {
    p_clinic_id: ready.value.scope.clinicId,
    p_patient_id: input.patientId,
    p_treatment_id: links.value.treatmentId,
    p_treatment_session_id: links.value.treatmentSessionId,
    p_procedure_id: links.value.procedureId,
    p_procedure_name: links.value.procedureName,
    p_recorded_at: recorded.value ?? null,
    p_anamnesis: textOrEmpty(input.anamnesis),
    p_evolution: textOrEmpty(input.evolution),
    p_products_used_summary: blankToNull(input.productsUsedSummary),
    p_next_steps: textOrEmpty(input.nextSteps),
    p_change_reason: blankToNull(input.changeReason),
  })
  if (!created.ok) return created
  return loadRecord(ready.value.client, ready.value.scope, created.value)
}

export async function appendClinicalRecordVersion(
  tenant: V3TenantSnapshot,
  recordId: string,
  input: V3ClinicalVersionInput,
): Promise<ClinicalResult<V3ClinicalRecord>> {
  const rejected = rejectedClinicalOverride(input, LINK_KEYS)
  if (rejected) return failure(rejected)
  const ready = scoped(tenant)
  if (!ready.ok) return ready
  const reason = blankToNull(input.changeReason)
  if (!reason) return failure(invalid('Informe o motivo da nova versão.'))
  const procedureName = blankToNull(input.procedureName)
  if (!procedureName) return failure(invalid('Informe o procedimento.'))
  const recorded = recordedAtValue(input.recordedAt)
  if (!recorded.ok) return recorded
  const existing = await loadRecord(ready.value.client, ready.value.scope, recordId)
  if (!existing.ok) return existing
  if (existing.value.status === 'cancelled') {
    return failure(closed('Evolução cancelada não pode ser alterada.'))
  }
  const appended = await callEvolutionRpc(ready.value.client, 'append_clinical_evolution', {
    p_clinic_id: ready.value.scope.clinicId,
    p_clinical_record_id: existing.value.id,
    p_procedure_name: procedureName,
    p_recorded_at: recorded.value ?? null,
    p_anamnesis: textOrEmpty(input.anamnesis),
    p_evolution: textOrEmpty(input.evolution),
    p_products_used_summary: blankToNull(input.productsUsedSummary),
    p_next_steps: textOrEmpty(input.nextSteps),
    p_change_reason: reason,
  })
  if (!appended.ok) return appended
  return loadRecord(ready.value.client, ready.value.scope, appended.value)
}

async function transition(
  tenant: V3TenantSnapshot,
  recordId: string,
  next: (status: ClinicalRecordStatus) => ClinicalResult<ClinicalRecordStatus>,
): Promise<ClinicalResult<V3ClinicalRecord>> {
  const ready = scoped(tenant)
  if (!ready.ok) return ready
  const existing = await loadRecord(ready.value.client, ready.value.scope, recordId)
  if (!existing.ok) return existing
  const status = next(existing.value.status)
  if (!status.ok) return status
  const changed = await callEvolutionRpc(ready.value.client, 'transition_clinical_evolution', {
    p_clinic_id: ready.value.scope.clinicId,
    p_clinical_record_id: existing.value.id,
    p_status: status.value,
  })
  if (!changed.ok) return changed
  return loadRecord(ready.value.client, ready.value.scope, changed.value)
}

export async function finalizeClinicalRecord(
  tenant: V3TenantSnapshot,
  recordId: string,
): Promise<ClinicalResult<V3ClinicalRecord>> {
  return transition(tenant, recordId, (status) => {
    if (status === 'draft' || status === 'in_progress' || status === 'corrected') return success('finalized')
    if (status === 'finalized') return failure(closed('Evolução já finalizada.'))
    return failure(closed('Evolução cancelada não pode ser alterada.'))
  })
}

export async function cancelClinicalRecord(
  tenant: V3TenantSnapshot,
  recordId: string,
): Promise<ClinicalResult<V3ClinicalRecord>> {
  return transition(tenant, recordId, (status) => {
    if (status === 'cancelled') return failure(closed('Evolução já cancelada.'))
    return success('cancelled')
  })
}
