import type { Tables } from '../../types/database.types'
import { requireSupabase } from '../supabase'

export type AppointmentRow = Tables<'appointments'>

export async function listAppointments(clinicId: string): Promise<
  { ok: true; data: AppointmentRow[] } | { ok: false; error: string }
> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('starts_at', { ascending: true })

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data ?? [] }
}
