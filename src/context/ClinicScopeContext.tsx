import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import { can as canPermission, type Permission } from '../lib/auth/permissions'
import {
  fetchClinicScope,
  resolveCurrentClinicId,
  roleForClinic,
  type Clinic,
  type MembershipWithClinic,
  type Profile,
} from '../lib/data/clinics'
import type { ClinicRole } from '../types/database.types'

/** UI preference only — never used as authorization boundary. */
export const CURRENT_CLINIC_PREF_KEY = 'evelyn-current-clinic-id'

interface ClinicScopeContextValue {
  profile: Profile | null
  memberships: MembershipWithClinic[]
  currentClinic: Clinic | null
  currentClinicId: string | null
  role: ClinicRole | null
  loading: boolean
  error: string | null
  setCurrentClinicId: (clinicId: string) => void
  refresh: () => Promise<void>
  can: (permission: Permission) => boolean
  hasMembership: boolean
}

const ClinicScopeContext = createContext<ClinicScopeContextValue | null>(null)

function readPreferredClinicId(): string | null {
  try {
    return localStorage.getItem(CURRENT_CLINIC_PREF_KEY)
  } catch {
    return null
  }
}

function writePreferredClinicId(clinicId: string | null) {
  try {
    if (!clinicId) localStorage.removeItem(CURRENT_CLINIC_PREF_KEY)
    else localStorage.setItem(CURRENT_CLINIC_PREF_KEY, clinicId)
  } catch {
    // ignore quota / private mode
  }
}

export function ClinicScopeProvider({ children }: { children: ReactNode }) {
  const { authUser, authMode, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [memberships, setMemberships] = useState<MembershipWithClinic[]>([])
  const [currentClinicId, setCurrentClinicIdState] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (authMode !== 'supabase' || !authUser) {
      setProfile(null)
      setMemberships([])
      setCurrentClinicIdState(null)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    const result = await fetchClinicScope()
    if (!result.ok) {
      setProfile(null)
      setMemberships([])
      setCurrentClinicIdState(null)
      setError(result.error)
      setLoading(false)
      return
    }

    const preferred = readPreferredClinicId()
    const resolved = resolveCurrentClinicId(result.data.memberships, preferred)
    setProfile(result.data.profile)
    setMemberships(result.data.memberships)
    setCurrentClinicIdState(resolved)
    if (resolved) writePreferredClinicId(resolved)
    setLoading(false)
  }, [authMode, authUser])

  useEffect(() => {
    if (authLoading) return
    void refresh()
  }, [authLoading, refresh])

  const setCurrentClinicId = useCallback(
    (clinicId: string) => {
      if (!memberships.some((m) => m.clinic_id === clinicId)) return
      setCurrentClinicIdState(clinicId)
      writePreferredClinicId(clinicId)
    },
    [memberships],
  )

  const currentClinic = useMemo(
    () => memberships.find((m) => m.clinic_id === currentClinicId)?.clinic ?? null,
    [memberships, currentClinicId],
  )

  const role = useMemo(
    () => roleForClinic(memberships, currentClinicId),
    [memberships, currentClinicId],
  )

  const value = useMemo<ClinicScopeContextValue>(
    () => ({
      profile,
      memberships,
      currentClinic,
      currentClinicId,
      role,
      loading,
      error,
      setCurrentClinicId,
      refresh,
      can: (permission) => canPermission(role, permission),
      hasMembership: memberships.length > 0,
    }),
    [
      profile,
      memberships,
      currentClinic,
      currentClinicId,
      role,
      loading,
      error,
      setCurrentClinicId,
      refresh,
    ],
  )

  return <ClinicScopeContext.Provider value={value}>{children}</ClinicScopeContext.Provider>
}

export function useClinicScope() {
  const ctx = useContext(ClinicScopeContext)
  if (!ctx) throw new Error('useClinicScope deve ser usado dentro de ClinicScopeProvider')
  return ctx
}
