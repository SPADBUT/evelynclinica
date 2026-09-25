import type { ClinicData, Patient } from '../types'
import { LEGACY_STORAGE_KEY, STORAGE_KEY } from '../types'
import { createSeedData } from '../data/seed'

function normalizePatient(patient: Patient & { tags?: string[] }): Patient {
  return {
    ...patient,
    tags: patient.tags ?? [],
  }
}

function migrateLegacy(raw: string): ClinicData | null {
  try {
    const legacy = JSON.parse(raw) as Partial<ClinicData>
    const seed = createSeedData()
    return {
      ...seed,
      patients: (legacy.patients ?? seed.patients).map((p) => normalizePatient(p as Patient)),
      records: legacy.records ?? seed.records,
      appointments: legacy.appointments ?? seed.appointments,
      photos: legacy.photos ?? seed.photos,
      consents: legacy.consents ?? seed.consents,
      contracts: legacy.contracts ?? seed.contracts,
      budgets: legacy.budgets ?? seed.budgets,
      users: seed.users,
      leads: seed.leads,
      interactions: seed.interactions,
      reminders: seed.reminders,
    }
  } catch {
    return null
  }
}

function normalizeClinicData(data: ClinicData): ClinicData {
  return {
    ...data,
    patients: (data.patients ?? []).map((p) => normalizePatient(p)),
    users: data.users ?? [],
    leads: data.leads ?? [],
    interactions: data.interactions ?? [],
    reminders: data.reminders ?? [],
  }
}

export function loadClinicData(): ClinicData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return normalizeClinicData(JSON.parse(raw) as ClinicData)
    }

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy) {
      const migrated = migrateLegacy(legacy)
      if (migrated) {
        saveClinicData(migrated)
        return migrated
      }
    }

    const seed = createSeedData()
    saveClinicData(seed)
    return seed
  } catch {
    const seed = createSeedData()
    saveClinicData(seed)
    return seed
  }
}

export function saveClinicData(data: ClinicData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function resetClinicData(): ClinicData {
  const seed = createSeedData()
  saveClinicData(seed)
  return seed
}

export function exportClinicData(): string {
  return JSON.stringify(loadClinicData(), null, 2)
}
