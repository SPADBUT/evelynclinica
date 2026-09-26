import type { Tables } from '../../types/database.types'
import { requireSupabase } from '../supabase'

export type DocumentRow = Tables<'documents'>

export async function listDocuments(clinicId: string): Promise<
  { ok: true; data: DocumentRow[] } | { ok: false; error: string }
> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data ?? [] }
}
