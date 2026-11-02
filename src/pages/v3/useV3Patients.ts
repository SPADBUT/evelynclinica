import { useCallback, useEffect, useState } from 'react'
import { useV3Tenant, type V3TenantContextValue } from '../../context/V3TenantContext'
import type { PatientRepositoryError } from '../../lib/patientRepositoryError'
import { getPatientById, listPatients } from '../../services/patientRepository'
import type { V3Patient } from '../../types/patient'
import type { PatientResult } from '../../lib/patientRepositoryError'

interface PatientQueryState<T> {
  tenant: V3TenantContextValue
  canManage: boolean
  data: T | null
  error: PatientRepositoryError | null
  loading: boolean
  reload: () => Promise<void>
}

function canQuery(tenant: V3TenantContextValue): boolean {
  return tenant.status === 'authenticated_ready' && tenant.can('patients.manage')
}

function usePatientQuery<T>(
  queryKey: string,
  enabled: boolean,
  load: () => Promise<PatientResult<T>>,
): Pick<PatientQueryState<T>, 'data' | 'error' | 'loading' | 'reload'> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<PatientRepositoryError | null>(null)
  const [seenKey, setSeenKey] = useState(queryKey)

  if (seenKey !== queryKey) {
    setSeenKey(queryKey)
    setData(null)
    setError(null)
  }

  const reload = useCallback(async () => {
    if (!enabled) return
    const result = await load()
    if (!result.ok) {
      setData(null)
      setError(result.error)
      return
    }
    setError(null)
    setData(result.value)
  }, [enabled, load])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void load().then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setData(null)
        setError(result.error)
        return
      }
      setError(null)
      setData(result.value)
    })
    return () => {
      cancelled = true
    }
  }, [enabled, load])

  return {
    data,
    error,
    loading: enabled && data === null && error === null,
    reload,
  }
}

export function useV3PatientList(): PatientQueryState<V3Patient[]> {
  const tenant = useV3Tenant()
  const canManage = canQuery(tenant)
  const load = useCallback(() => listPatients(tenant), [tenant])
  const query = usePatientQuery(canManage ? (tenant.activeClinicId ?? '') : '', canManage, load)
  return { tenant, canManage, ...query }
}

export function useV3PatientDetail(patientId: string): PatientQueryState<V3Patient> {
  const tenant = useV3Tenant()
  const canManage = canQuery(tenant)
  const load = useCallback(() => getPatientById(tenant, patientId), [patientId, tenant])
  const query = usePatientQuery(canManage ? `${tenant.activeClinicId ?? ''}:${patientId}` : '', canManage, load)
  return { tenant, canManage, ...query }
}
