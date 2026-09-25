import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { v4 as uuid } from 'uuid'
import { createSalt, hashPassword } from '../lib/auth'
import { loadClinicData, resetClinicData, saveClinicData } from '../lib/storage'
import type {
  Appointment,
  AuthUser,
  Budget,
  ClinicData,
  ConsentForm,
  Contract,
  Interaction,
  Lead,
  MedicalRecordEntry,
  Patient,
  PhotoRecord,
  Reminder,
} from '../types'

interface ClinicContextValue {
  patients: Patient[]
  records: MedicalRecordEntry[]
  appointments: Appointment[]
  photos: PhotoRecord[]
  consents: ConsentForm[]
  contracts: Contract[]
  budgets: Budget[]
  users: AuthUser[]
  leads: Lead[]
  interactions: Interaction[]
  reminders: Reminder[]
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
  signConsent: (input: {
    consentId: string
    signedBy: string
    signatureData: string
  }) => { ok: true } | { ok: false; error: string }
  upsertContract: (item: Omit<Contract, 'id' | 'createdAt'> & { id?: string }) => string
  deleteContract: (id: string) => void
  upsertBudget: (item: Omit<Budget, 'id' | 'createdAt'> & { id?: string }) => string
  deleteBudget: (id: string) => void
  upsertLead: (item: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => string
  deleteLead: (id: string) => void
  upsertInteraction: (item: Omit<Interaction, 'id' | 'createdAt'> & { id?: string }) => string
  deleteInteraction: (id: string) => void
  upsertReminder: (item: Omit<Reminder, 'id' | 'createdAt'> & { id?: string }) => string
  deleteReminder: (id: string) => void
  ensurePatientAccess: (input: {
    patientId: string
    password: string
  }) => Promise<{ ok: true; email: string } | { ok: false; error: string }>
  resetDemoData: () => void
  reload: () => void
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

  const reload = useCallback(() => {
    setData(loadClinicData())
  }, [])

  const getPatient = useCallback(
    (id: string) => data.patients.find((p) => p.id === id),
    [data.patients],
  )

  const upsertPatient: ClinicContextValue['upsertPatient'] = useCallback((patient) => {
    const now = new Date().toISOString()
    const id = patient.id ?? uuid()
    setData((prev) => {
      const existing = prev.patients.find((p) => p.id === id)
      const nextPatient: Patient = existing
        ? { ...existing, ...patient, id, tags: patient.tags ?? existing.tags ?? [], updatedAt: now }
        : {
            ...patient,
            id,
            tags: patient.tags ?? [],
            createdAt: now,
            updatedAt: now,
          }
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
  }, [])

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
        users: prev.users.filter((u) => u.patientId !== id),
        interactions: prev.interactions.filter((i) => i.patientId !== id),
        reminders: prev.reminders.filter((r) => r.patientId !== id),
        leads: prev.leads.map((l) => (l.patientId === id ? { ...l, patientId: undefined } : l)),
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

  const signConsent: ClinicContextValue['signConsent'] = useCallback((input) => {
    let result: { ok: true } | { ok: false; error: string } = { ok: false, error: 'Termo não encontrado.' }
    setData((prev) => {
      const consent = prev.consents.find((c) => c.id === input.consentId)
      if (!consent) {
        result = { ok: false, error: 'Termo não encontrado.' }
        return prev
      }
      if (consent.status === 'assinado') {
        result = { ok: false, error: 'Este termo já foi assinado.' }
        return prev
      }
      if (consent.status === 'rascunho') {
        result = { ok: false, error: 'Este termo ainda não foi liberado para assinatura.' }
        return prev
      }
      const nextConsent: ConsentForm = {
        ...consent,
        status: 'assinado',
        signedAt: new Date().toISOString(),
        signedBy: input.signedBy.trim(),
        signatureData: input.signatureData,
        signedUserAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      }
      const next = {
        ...prev,
        consents: prev.consents.map((c) => (c.id === consent.id ? nextConsent : c)),
      }
      saveClinicData(next)
      result = { ok: true }
      return next
    })
    return result
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

  const upsertLead: ClinicContextValue['upsertLead'] = useCallback((item) => {
    const now = new Date().toISOString()
    const id = item.id ?? uuid()
    setData((prev) => {
      const existing = prev.leads.find((l) => l.id === id)
      const nextLead: Lead = existing
        ? { ...existing, ...item, id, updatedAt: now }
        : { ...item, id, createdAt: now, updatedAt: now }
      const next = {
        ...prev,
        leads: existing
          ? prev.leads.map((l) => (l.id === id ? nextLead : l))
          : [nextLead, ...prev.leads],
      }
      saveClinicData(next)
      return next
    })
    return id
  }, [])

  const deleteLead = useCallback((id: string) => {
    setData((prev) => {
      const next = {
        ...prev,
        leads: prev.leads.filter((l) => l.id !== id),
        interactions: prev.interactions.filter((i) => i.leadId !== id),
      }
      saveClinicData(next)
      return next
    })
  }, [])

  const upsertInteraction: ClinicContextValue['upsertInteraction'] = useCallback((item) => {
    let id = ''
    setData((prev) => {
      const result = upsertInList(prev.interactions, item)
      id = result.id
      const next = { ...prev, interactions: result.list }
      saveClinicData(next)
      return next
    })
    return id
  }, [])

  const deleteInteraction = useCallback((id: string) => {
    setData((prev) => {
      const next = { ...prev, interactions: prev.interactions.filter((i) => i.id !== id) }
      saveClinicData(next)
      return next
    })
  }, [])

  const upsertReminder: ClinicContextValue['upsertReminder'] = useCallback((item) => {
    let id = ''
    setData((prev) => {
      const result = upsertInList(prev.reminders, item)
      id = result.id
      const next = { ...prev, reminders: result.list }
      saveClinicData(next)
      return next
    })
    return id
  }, [])

  const deleteReminder = useCallback((id: string) => {
    setData((prev) => {
      const next = { ...prev, reminders: prev.reminders.filter((r) => r.id !== id) }
      saveClinicData(next)
      return next
    })
  }, [])

  const ensurePatientAccess: ClinicContextValue['ensurePatientAccess'] = useCallback(
    async ({ patientId, password }) => {
      const patient = data.patients.find((p) => p.id === patientId)
      if (!patient) return { ok: false, error: 'Paciente não encontrado.' }
      if (!patient.email.trim()) return { ok: false, error: 'Paciente sem e-mail cadastrado.' }
      if (password.trim().length < 6) {
        return { ok: false, error: 'A senha precisa ter ao menos 6 caracteres.' }
      }

      const salt = createSalt('paciente')
      const passwordHash = await hashPassword(password.trim(), salt)
      const now = new Date().toISOString()

      setData((prev) => {
        const existing = prev.users.find((u) => u.patientId === patientId || u.email === patient.email)
        let users: AuthUser[]
        if (existing) {
          users = prev.users.map((u) =>
            u.id === existing.id
              ? {
                  ...u,
                  name: patient.name,
                  email: patient.email,
                  role: 'paciente',
                  patientId,
                  passwordSalt: salt,
                  passwordHash,
                  active: true,
                }
              : u,
          )
        } else {
          users = [
            {
              id: uuid(),
              name: patient.name,
              email: patient.email,
              role: 'paciente',
              patientId,
              passwordSalt: salt,
              passwordHash,
              createdAt: now,
              active: true,
            },
            ...prev.users,
          ]
        }
        const next = { ...prev, users }
        saveClinicData(next)
        return next
      })

      return { ok: true, email: patient.email }
    },
    [data.patients],
  )

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
      users: data.users,
      leads: data.leads,
      interactions: data.interactions,
      reminders: data.reminders,
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
      signConsent,
      upsertContract,
      deleteContract,
      upsertBudget,
      deleteBudget,
      upsertLead,
      deleteLead,
      upsertInteraction,
      deleteInteraction,
      upsertReminder,
      deleteReminder,
      ensurePatientAccess,
      resetDemoData,
      reload,
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
      signConsent,
      upsertContract,
      deleteContract,
      upsertBudget,
      deleteBudget,
      upsertLead,
      deleteLead,
      upsertInteraction,
      deleteInteraction,
      upsertReminder,
      deleteReminder,
      ensurePatientAccess,
      resetDemoData,
      reload,
    ],
  )

  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>
}

export function useClinic() {
  const ctx = useContext(ClinicContext)
  if (!ctx) throw new Error('useClinic deve ser usado dentro de ClinicProvider')
  return ctx
}
