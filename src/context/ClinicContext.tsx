import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { v4 as uuid } from 'uuid'
import { loadClinicData, resetClinicData, saveClinicData } from '../lib/storage'
import type {
  Appointment,
  Budget,
  ClinicData,
  ConsentForm,
  Contract,
  MedicalRecordEntry,
  Patient,
  PhotoRecord,
} from '../types'

interface ClinicContextValue {
  patients: Patient[]
  records: MedicalRecordEntry[]
  appointments: Appointment[]
  photos: PhotoRecord[]
  consents: ConsentForm[]
  contracts: Contract[]
  budgets: Budget[]
  getPatient: (id: string) => Patient | undefined
  upsertPatient: (patient: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => string
  deletePatient: (id: string) => void
  upsertRecord: (entry: Omit<MedicalRecordEntry, 'id' | 'createdAt'> & { id?: string }) => string
  deleteRecord: (id: string) => void
  upsertAppointment: (item: Omit<Appointment, 'id' | 'createdAt'> & { id?: string }) => string
  deleteAppointment: (id: string) => void
  upsertPhoto: (item: Omit<PhotoRecord, 'id' | 'createdAt'> & { id?: string }) => string
  deletePhoto: (id: string) => void
  upsertConsent: (item: Omit<ConsentForm, 'id' | 'createdAt'> & { id?: string }) => string
  deleteConsent: (id: string) => void
  upsertContract: (item: Omit<Contract, 'id' | 'createdAt'> & { id?: string }) => string
  deleteContract: (id: string) => void
  upsertBudget: (item: Omit<Budget, 'id' | 'createdAt'> & { id?: string }) => string
  deleteBudget: (id: string) => void
  resetDemoData: () => void
}

const ClinicContext = createContext<ClinicContextValue | null>(null)

function upsertInList<T extends { id: string; createdAt: string }>(
  list: T[],
  item: Omit<T, 'id' | 'createdAt'> & { id?: string },
): { list: T[]; id: string } {
  const id = item.id ?? uuid()
  const existing = list.find((entry) => entry.id === id)
  const nextItem = existing
    ? ({ ...existing, ...item, id } as T)
    : ({ ...item, id, createdAt: new Date().toISOString() } as T)
  return {
    id,
    list: existing
      ? list.map((entry) => (entry.id === id ? nextItem : entry))
      : [nextItem, ...list],
  }
}

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ClinicData>(() => loadClinicData())

  const commit = useCallback((next: ClinicData) => {
    saveClinicData(next)
    setData(next)
  }, [])

  const getPatient = useCallback(
    (id: string) => data.patients.find((p) => p.id === id),
    [data.patients],
  )

  const upsertPatient: ClinicContextValue['upsertPatient'] = useCallback(
    (patient) => {
      const now = new Date().toISOString()
      const id = patient.id ?? uuid()
      setData((prev) => {
        const existing = prev.patients.find((p) => p.id === id)
        const nextPatient: Patient = existing
          ? { ...existing, ...patient, id, updatedAt: now }
          : { ...patient, id, createdAt: now, updatedAt: now }
        const next = {
          ...prev,
          patients: existing
            ? prev.patients.map((p) => (p.id === id ? nextPatient : p))
            : [nextPatient, ...prev.patients],
        }
        saveClinicData(next)
        return next
      })
      return id
    },
    [],
  )

  const deletePatient = useCallback((id: string) => {
    setData((prev) => {
      const next = {
        ...prev,
        patients: prev.patients.filter((p) => p.id !== id),
        records: prev.records.filter((r) => r.patientId !== id),
        appointments: prev.appointments.filter((a) => a.patientId !== id),
        photos: prev.photos.filter((p) => p.patientId !== id),
        consents: prev.consents.filter((c) => c.patientId !== id),
        contracts: prev.contracts.filter((c) => c.patientId !== id),
        budgets: prev.budgets.filter((b) => b.patientId !== id),
      }
      saveClinicData(next)
      return next
    })
  }, [])

  const upsertRecord: ClinicContextValue['upsertRecord'] = useCallback((item) => {
    let id = ''
    setData((prev) => {
      const result = upsertInList(prev.records, item)
      id = result.id
      const next = { ...prev, records: result.list }
      saveClinicData(next)
      return next
    })
    return id
  }, [])

  const deleteRecord = useCallback((id: string) => {
    setData((prev) => {
      const next = { ...prev, records: prev.records.filter((r) => r.id !== id) }
      saveClinicData(next)
      return next
    })
  }, [])

  const upsertAppointment: ClinicContextValue['upsertAppointment'] = useCallback((item) => {
    let id = ''
    setData((prev) => {
      const result = upsertInList(prev.appointments, item)
      id = result.id
      const next = { ...prev, appointments: result.list }
      saveClinicData(next)
      return next
    })
    return id
  }, [])

  const deleteAppointment = useCallback((id: string) => {
    setData((prev) => {
      const next = { ...prev, appointments: prev.appointments.filter((a) => a.id !== id) }
      saveClinicData(next)
      return next
    })
  }, [])

  const upsertPhoto: ClinicContextValue['upsertPhoto'] = useCallback((item) => {
    let id = ''
    setData((prev) => {
      const result = upsertInList(prev.photos, item)
      id = result.id
      const next = { ...prev, photos: result.list }
      saveClinicData(next)
      return next
    })
    return id
  }, [])

  const deletePhoto = useCallback((id: string) => {
    setData((prev) => {
      const next = { ...prev, photos: prev.photos.filter((p) => p.id !== id) }
      saveClinicData(next)
      return next
    })
  }, [])

  const upsertConsent: ClinicContextValue['upsertConsent'] = useCallback((item) => {
    let id = ''
    setData((prev) => {
      const result = upsertInList(prev.consents, item)
      id = result.id
      const next = { ...prev, consents: result.list }
      saveClinicData(next)
      return next
    })
    return id
  }, [])

  const deleteConsent = useCallback((id: string) => {
    setData((prev) => {
      const next = { ...prev, consents: prev.consents.filter((c) => c.id !== id) }
      saveClinicData(next)
      return next
    })
  }, [])

  const upsertContract: ClinicContextValue['upsertContract'] = useCallback((item) => {
    let id = ''
    setData((prev) => {
      const result = upsertInList(prev.contracts, item)
      id = result.id
      const next = { ...prev, contracts: result.list }
      saveClinicData(next)
      return next
    })
    return id
  }, [])

  const deleteContract = useCallback((id: string) => {
    setData((prev) => {
      const next = { ...prev, contracts: prev.contracts.filter((c) => c.id !== id) }
      saveClinicData(next)
      return next
    })
  }, [])

  const upsertBudget: ClinicContextValue['upsertBudget'] = useCallback((item) => {
    let id = ''
    setData((prev) => {
      const result = upsertInList(prev.budgets, item)
      id = result.id
      const next = { ...prev, budgets: result.list }
      saveClinicData(next)
      return next
    })
    return id
  }, [])

  const deleteBudget = useCallback((id: string) => {
    setData((prev) => {
      const next = { ...prev, budgets: prev.budgets.filter((b) => b.id !== id) }
      saveClinicData(next)
      return next
    })
  }, [])

  const resetDemoData = useCallback(() => {
    commit(resetClinicData())
  }, [commit])

  const value = useMemo<ClinicContextValue>(
    () => ({
      patients: data.patients,
      records: data.records,
      appointments: data.appointments,
      photos: data.photos,
      consents: data.consents,
      contracts: data.contracts,
      budgets: data.budgets,
      getPatient,
      upsertPatient,
      deletePatient,
      upsertRecord,
      deleteRecord,
      upsertAppointment,
      deleteAppointment,
      upsertPhoto,
      deletePhoto,
      upsertConsent,
      deleteConsent,
      upsertContract,
      deleteContract,
      upsertBudget,
      deleteBudget,
      resetDemoData,
    }),
    [
      data,
      getPatient,
      upsertPatient,
      deletePatient,
      upsertRecord,
      deleteRecord,
      upsertAppointment,
      deleteAppointment,
      upsertPhoto,
      deletePhoto,
      upsertConsent,
      deleteConsent,
      upsertContract,
      deleteContract,
      upsertBudget,
      deleteBudget,
      resetDemoData,
    ],
  )

  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>
}

export function useClinic() {
  const ctx = useContext(ClinicContext)
  if (!ctx) throw new Error('useClinic deve ser usado dentro de ClinicProvider')
  return ctx
}
