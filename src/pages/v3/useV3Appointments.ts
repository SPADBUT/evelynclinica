import { useCallback, useEffect, useState } from 'react'
import { useV3Tenant, type V3TenantContextValue } from '../../context/V3TenantContext'
import { AppointmentRepositoryError, type AppointmentResult } from '../../lib/appointmentRepositoryError'
import { saoPauloToday } from '../../lib/saoPauloTime'
import {
  listActiveProcedures,
  listAgendaDay,
  listBookableProfessionals,
  listPatientAppointments,
} from '../../services/appointmentRepository'
import { listPatients } from '../../services/patientRepository'
import type { V3AgendaProcedure, V3Appointment, V3BookableProfessional } from '../../types/appointment'
import type { V3Patient } from '../../types/patient'

interface AgendaCatalog {
  patients: V3Patient[]
  professionals: V3BookableProfessional[]
  procedures: V3AgendaProcedure[]
}

interface AgendaModel {
  tenant: V3TenantContextValue
  canRead: boolean
  day: string
  setDay: (day: string) => void
  appointments: V3Appointment[] | null
  patients: V3Patient[]
  professionals: V3BookableProfessional[]
  procedures: V3AgendaProcedure[]
  error: AppointmentRepositoryError | null
  loading: boolean
  reload: () => Promise<void>
}

function canReadAgenda(tenant: V3TenantContextValue): boolean {
  return tenant.status === 'authenticated_ready' && tenant.can('agenda.manage')
}

const emptyCatalog: AgendaCatalog = { patients: [], professionals: [], procedures: [] }

export function useV3Agenda(): AgendaModel {
  const tenant = useV3Tenant()
  const canRead = canReadAgenda(tenant)
  const [day, setDay] = useState(saoPauloToday)
  const queryKey = canRead ? `${tenant.activeClinicId ?? ''}:${day}` : ''
  const [appointments, setAppointments] = useState<V3Appointment[] | null>(null)
  const [catalog, setCatalog] = useState<AgendaCatalog>(emptyCatalog)
  const [error, setError] = useState<AppointmentRepositoryError | null>(null)
  const [seenKey, setSeenKey] = useState(queryKey)

  if (seenKey !== queryKey) {
    setSeenKey(queryKey)
    setAppointments(null)
    setCatalog(emptyCatalog)
    setError(null)
  }

  const load = useCallback(async (): Promise<AppointmentResult<{ appointments: V3Appointment[]; catalog: AgendaCatalog }>> => {
    const listed = await listAgendaDay(tenant, day)
    if (!listed.ok) return listed
    const [patientResult, professionalResult, procedureResult] = await Promise.all([
      listPatients(tenant),
      listBookableProfessionals(tenant),
      listActiveProcedures(tenant),
    ])
    if (!patientResult.ok) {
      return { ok: false, error: new AppointmentRepositoryError('repository_error', patientResult.error.message) }
    }
    if (!professionalResult.ok) return professionalResult
    if (!procedureResult.ok) return procedureResult
    return {
      ok: true,
      value: {
        appointments: listed.value,
        catalog: {
          patients: patientResult.value,
          professionals: professionalResult.value,
          procedures: procedureResult.value,
        },
      },
    }
  }, [day, tenant])

  const apply = useCallback((result: Awaited<ReturnType<typeof load>>) => {
    if (!result.ok) {
      setAppointments(null)
      setCatalog(emptyCatalog)
      setError(result.error)
      return
    }
    setError(null)
    setAppointments(result.value.appointments)
    setCatalog(result.value.catalog)
  }, [])

  const reload = useCallback(async () => {
    if (!canRead) return
    try {
      apply(await load())
    } catch {
      setAppointments(null)
      setError(new AppointmentRepositoryError('repository_error', 'Não foi possível carregar a agenda.'))
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
        setAppointments(null)
        setError(new AppointmentRepositoryError('repository_error', 'Não foi possível carregar a agenda.'))
      })
    return () => {
      cancelled = true
    }
  }, [apply, canRead, load])

  return {
    tenant,
    canRead,
    day,
    setDay,
    appointments,
    patients: catalog.patients,
    professionals: catalog.professionals,
    procedures: catalog.procedures,
    error,
    loading: canRead && appointments === null && error === null,
    reload,
  }
}

interface PatientAgendaModel {
  tenant: V3TenantContextValue
  canRead: boolean
  appointments: V3Appointment[] | null
  professionals: V3BookableProfessional[]
  procedures: V3AgendaProcedure[]
  error: AppointmentRepositoryError | null
  loading: boolean
  reload: () => Promise<void>
}

export function useV3PatientAgenda(patientId: string): PatientAgendaModel {
  const tenant = useV3Tenant()
  const canRead = canReadAgenda(tenant)
  const queryKey = canRead ? `${tenant.activeClinicId ?? ''}:${patientId}` : ''
  const [appointments, setAppointments] = useState<V3Appointment[] | null>(null)
  const [professionals, setProfessionals] = useState<V3BookableProfessional[]>([])
  const [procedures, setProcedures] = useState<V3AgendaProcedure[]>([])
  const [error, setError] = useState<AppointmentRepositoryError | null>(null)
  const [seenKey, setSeenKey] = useState(queryKey)

  if (seenKey !== queryKey) {
    setSeenKey(queryKey)
    setAppointments(null)
    setProfessionals([])
    setProcedures([])
    setError(null)
  }

  const load = useCallback(async (): Promise<
    AppointmentResult<{ appointments: V3Appointment[]; professionals: V3BookableProfessional[]; procedures: V3AgendaProcedure[] }>
  > => {
    const listed = await listPatientAppointments(tenant, patientId)
    if (!listed.ok) return listed
    const [professionalResult, procedureResult] = await Promise.all([
      listBookableProfessionals(tenant),
      listActiveProcedures(tenant),
    ])
    if (!professionalResult.ok) return professionalResult
    if (!procedureResult.ok) return procedureResult
    return {
      ok: true,
      value: {
        appointments: listed.value,
        professionals: professionalResult.value,
        procedures: procedureResult.value,
      },
    }
  }, [patientId, tenant])

  const apply = useCallback((result: Awaited<ReturnType<typeof load>>) => {
    if (!result.ok) {
      setAppointments(null)
      setProfessionals([])
      setProcedures([])
      setError(result.error)
      return
    }
    setError(null)
    setAppointments(result.value.appointments)
    setProfessionals(result.value.professionals)
    setProcedures(result.value.procedures)
  }, [])

  const reload = useCallback(async () => {
    if (!canRead) return
    try {
      apply(await load())
    } catch {
      setAppointments(null)
      setError(new AppointmentRepositoryError('repository_error', 'Não foi possível carregar a agenda.'))
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
        setAppointments(null)
        setError(new AppointmentRepositoryError('repository_error', 'Não foi possível carregar a agenda.'))
      })
    return () => {
      cancelled = true
    }
  }, [apply, canRead, load])

  return {
    tenant,
    canRead,
    appointments,
    professionals,
    procedures,
    error,
    loading: canRead && appointments === null && error === null,
    reload,
  }
}
