import type { Tables } from '../../types/database.types'
import { requireSupabase } from '../supabase'

export type ProductRow = Tables<'products'>
export type ProductBatchRow = Tables<'product_batches'>

export async function listProducts(clinicId: string): Promise<
  { ok: true; data: ProductRow[] } | { ok: false; error: string }
> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('name', { ascending: true })

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data ?? [] }
}

export async function listProductBatches(clinicId: string): Promise<
  { ok: true; data: ProductBatchRow[] } | { ok: false; error: string }
> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('product_batches')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data ?? [] }
}
