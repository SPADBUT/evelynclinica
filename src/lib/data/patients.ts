import type { Tables, TablesInsert } from '../../types/database.types'
import { requireSupabase } from '../supabase'

export type PatientRow = Tables<'patients'>

export async function listPatients(clinicId: string): Promise<
  { ok: true; data: PatientRow[] } | { ok: false; error: string }
> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('clinic_id', clinicId)
    .is('deleted_at', null)
    .order('full_name', { ascending: true })

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data ?? [] }
}

export async function createPatient(
  input: TablesInsert<'patients'>,
): Promise<{ ok: true; data: PatientRow } | { ok: false; error: string }> {
  const supabase = requireSupabase()
  const { data, error } = await supabase.from('patients').insert(input).select('*').single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, data }
}

export async function getPatient(
  clinicId: string,
  patientId: string,
): Promise<{ ok: true; data: PatientRow | null } | { ok: false; error: string }> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('id', patientId)
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  return { ok: true, data }
}
