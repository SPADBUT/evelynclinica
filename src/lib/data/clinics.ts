import type { ClinicRole, Tables } from '../../types/database.types'
import { requireSupabase } from '../supabase'
import { getVerifiedUser } from './auth'

export type Profile = Tables<'profiles'>
export type Clinic = Tables<'clinics'>
export type ClinicMembership = Tables<'clinic_memberships'>

export type MembershipWithClinic = ClinicMembership & {
  clinic: Clinic
}

export type ClinicScope = {
  profile: Profile
  memberships: MembershipWithClinic[]
}

export async function fetchClinicScope(): Promise<
  { ok: true; data: ClinicScope } | { ok: false; error: string }
> {
  const verified = await getVerifiedUser()
  if (!verified.ok) return verified

  const supabase = requireSupabase()
  const userId = verified.data.id

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (profileError) {
    return { ok: false, error: profileError.message }
  }
  if (!profile) {
    return {
      ok: false,
      error: 'Perfil não encontrado. Contate o administrador da clínica.',
    }
  }

  const { data: membershipRows, error: membershipError } = await supabase
    .from('clinic_memberships')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (membershipError) {
    return { ok: false, error: membershipError.message }
  }

  const membershipsRaw = membershipRows ?? []
  if (membershipsRaw.length === 0) {
    return { ok: true, data: { profile, memberships: [] } }
  }

  const clinicIds = [...new Set(membershipsRaw.map((m) => m.clinic_id))]
  const { data: clinics, error: clinicsError } = await supabase
    .from('clinics')
    .select('*')
    .in('id', clinicIds)

  if (clinicsError) {
    return { ok: false, error: clinicsError.message }
  }

  const clinicById = new Map((clinics ?? []).map((c) => [c.id, c]))
  const memberships: MembershipWithClinic[] = membershipsRaw
    .map((m) => {
      const clinic = clinicById.get(m.clinic_id)
      if (!clinic) return null
      return { ...m, clinic }
    })
    .filter((m): m is MembershipWithClinic => m !== null)

  return { ok: true, data: { profile, memberships } }
}

export function resolveCurrentClinicId(
  memberships: MembershipWithClinic[],
  preferredClinicId: string | null,
): string | null {
  if (memberships.length === 0) return null
  if (preferredClinicId && memberships.some((m) => m.clinic_id === preferredClinicId)) {
    return preferredClinicId
  }
  return memberships[0]?.clinic_id ?? null
}

export function roleForClinic(
  memberships: MembershipWithClinic[],
  clinicId: string | null,
): ClinicRole | null {
  if (!clinicId) return null
  return memberships.find((m) => m.clinic_id === clinicId)?.role ?? null
}
