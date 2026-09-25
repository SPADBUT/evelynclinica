import type { ClinicData } from '../types'
import { STORAGE_KEY } from '../types'
import { createSeedData } from '../data/seed'

export function loadClinicData(): ClinicData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const seed = createSeedData()
      saveClinicData(seed)
      return seed
    }
    return JSON.parse(raw) as ClinicData
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
