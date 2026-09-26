import type { Tables } from '../../types/database.types'
import { requireSupabase } from '../supabase'

export type QuoteRow = Tables<'quotes'>

export async function listQuotes(clinicId: string): Promise<
  { ok: true; data: QuoteRow[] } | { ok: false; error: string }
> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('clinic_id', clinicId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data ?? [] }
}
