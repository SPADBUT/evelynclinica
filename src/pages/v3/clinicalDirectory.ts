import type { ClinicalRecordStatus } from '../../types/clinicalRecord'

export const CLINICAL_STATUS_LABEL: Record<ClinicalRecordStatus, string> = {
  draft: 'Rascunho',
  in_progress: 'Em andamento',
  finalized: 'Finalizada',
  corrected: 'Corrigida',
  cancelled: 'Cancelada',
}

const SUMMARY_LIMIT = 160

export function clinicalSummary(evolution: string): string {
  const trimmed = evolution.trim()
  if (!trimmed) return 'Sem observações clínicas.'
  if (trimmed.length <= SUMMARY_LIMIT) return trimmed
  return `${trimmed.slice(0, SUMMARY_LIMIT - 3)}…`
}
