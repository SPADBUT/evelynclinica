import type { Tables } from '../../types/database.types'
import { requireSupabase } from '../supabase'

export type TreatmentRow = Tables<'treatments'>

export async function listTreatments(clinicId: string): Promise<
  { ok: true; data: TreatmentRow[] } | { ok: false; error: string }
> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('treatments')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data ?? [] }
}
