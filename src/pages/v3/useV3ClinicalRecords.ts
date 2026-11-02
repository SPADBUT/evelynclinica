import { useCallback, useEffect, useState } from 'react'
import { useV3Tenant, type V3TenantContextValue } from '../../context/V3TenantContext'
import { ClinicalRepositoryError, type ClinicalResult } from '../../lib/clinicalRepositoryError'
import { listClinicalContext, listClinicalRecords } from '../../services/clinicalRepository'
import type { V3ClinicalContext, V3ClinicalRecord } from '../../types/clinicalRecord'

interface ClinicalQueryState {
  tenant: V3TenantContextValue
  canRead: boolean
  records: V3ClinicalRecord[] | null
  context: V3ClinicalContext | null
  error: ClinicalRepositoryError | null
  contextError: ClinicalRepositoryError | null
  loading: boolean
  reload: () => Promise<void>
}

function canReadClinical(tenant: V3TenantContextValue): boolean {
  return tenant.status === 'authenticated_ready' && tenant.can('clinical.records')
}

export function useV3ClinicalRecords(patientId: string): ClinicalQueryState {
  const tenant = useV3Tenant()
  const canRead = canReadClinical(tenant)
  const queryKey = canRead ? `${tenant.activeClinicId ?? ''}:${patientId}` : ''
  const [records, setRecords] = useState<V3ClinicalRecord[] | null>(null)
  const [context, setContext] = useState<V3ClinicalContext | null>(null)
  const [error, setError] = useState<ClinicalRepositoryError | null>(null)
  const [contextError, setContextError] = useState<ClinicalRepositoryError | null>(null)
  const [seenKey, setSeenKey] = useState(queryKey)

  if (seenKey !== queryKey) {
    setSeenKey(queryKey)
    setRecords(null)
    setContext(null)
    setError(null)
    setContextError(null)
  }

  const load = useCallback(async (): Promise<
    ClinicalResult<{ records: V3ClinicalRecord[]; context: V3ClinicalContext | null; contextError: ClinicalRepositoryError | null }>
  > => {
    const listed = await listClinicalRecords(tenant, patientId)
    if (!listed.ok) return listed
    const options = await listClinicalContext(tenant, patientId)
    if (!options.ok) {
      return { ok: true, value: { records: listed.value, context: null, contextError: options.error } }
    }
    return { ok: true, value: { records: listed.value, context: options.value, contextError: null } }
  }, [patientId, tenant])

  const apply = useCallback((result: Awaited<ReturnType<typeof load>>) => {
    if (!result.ok) {
      setRecords(null)
      setContext(null)
      setContextError(null)
      setError(result.error)
      return
    }
    setError(null)
    setRecords(result.value.records)
    setContext(result.value.context)
    setContextError(result.value.contextError)
  }, [])

  const reload = useCallback(async () => {
    if (!canRead) return
    try {
      apply(await load())
    } catch {
      setRecords(null)
      setError(new ClinicalRepositoryError('repository_error', 'Não foi possível carregar as evoluções.'))
    }
  }, [apply, canRead, load])

  useEffect(() => {
    if (!canRead) return
    let cancelled = false
    void load()
      .then((result) => {
        if (!cancelled) apply(result)
      })
      .catch(() => {
        if (cancelled) return
        setRecords(null)
        setError(new ClinicalRepositoryError('repository_error', 'Não foi possível carregar as evoluções.'))
      })
    return () => {
      cancelled = true
    }
  }, [apply, canRead, load])

  return {
    tenant,
    canRead,
    records,
    context,
    error,
    contextError,
    loading: canRead && records === null && error === null,
    reload,
  }
}
