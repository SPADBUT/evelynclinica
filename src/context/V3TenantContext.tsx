import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { SupabaseAuthError } from '../lib/supabaseAuthError'
import { getSupabaseClient } from '../lib/supabase'
import { loadStaffAccess } from '../services/supabaseAuthService'
import {
  deriveTenantSnapshot,
  loadClinic,
  tenantCan,
  tenantClinicTarget,
  tenantHasAnyRole,
  tenantHasRole,
} from '../services/v3Tenant'
import { useSupabaseAuth } from './SupabaseAuthContext'
import type { SupabaseClinicMembership, SupabaseClinicRole, SupabaseStaffProfile } from '../types/supabaseAuth'
import type { SelectClinicResult, V3Clinic, V3Permission, V3TenantSnapshot } from '../types/v3Tenant'

export interface V3TenantContextValue extends V3TenantSnapshot {
  selectClinic: (clinicId: string) => SelectClinicResult
  hasRole: (role: SupabaseClinicRole) => boolean
  hasAnyRole: (roles: readonly SupabaseClinicRole[]) => boolean
  can: (permission: V3Permission) => boolean
}

const V3TenantContext = createContext<V3TenantContextValue | null>(null)

/**
 * Staff tenant state. Mounted only when Supabase Auth is enabled.
 * Session lives in SupabaseAuthContext. This context does not write V2 storage
 * and does not persist the active clinic.
 */
export function V3TenantProvider({ children }: { children: ReactNode }) {
  const auth = useSupabaseAuth()
  const userId = auth.user?.id ?? null
  const [profile, setProfile] = useState<SupabaseStaffProfile | null>(null)
  const [memberships, setMemberships] = useState<SupabaseClinicMembership[]>([])
  const [staffError, setStaffError] = useState<SupabaseAuthError | null>(null)
  const [accessUserId, setAccessUserId] = useState<string | null>(null)
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null)
  const [trackedUserId, setTrackedUserId] = useState<string | null>(userId)
  const [clinic, setClinic] = useState<V3Clinic | null>(null)
  const [clinicError, setClinicError] = useState<SupabaseAuthError | null>(null)
  const [clinicLoadedFor, setClinicLoadedFor] = useState<string | null>(null)
  const staffReady = !userId || accessUserId === userId

  if (trackedUserId !== userId) {
    setTrackedUserId(userId)
    setProfile(null)
    setMemberships([])
    setStaffError(null)
    setAccessUserId(null)
    setSelectedClinicId(null)
    setClinic(null)
    setClinicError(null)
    setClinicLoadedFor(null)
  }

  useEffect(() => {
    if (!auth.configured || auth.loading || !userId) return

    let cancelled = false
    loadStaffAccess(getSupabaseClient(), userId)
      .then((result) => {
        if (cancelled) return
        setProfile(result.profile)
        setMemberships(result.memberships)
        setStaffError(result.error)
        setAccessUserId(userId)
      })
      .catch(() => {
        if (cancelled) return
        setProfile(null)
        setMemberships([])
        setStaffError(new SupabaseAuthError('auth_failed', 'Não foi possível carregar o perfil.'))
        setAccessUserId(userId)
      })

    return () => {
      cancelled = true
    }
  }, [auth.configured, auth.loading, userId])

  const clinicTarget = useMemo(
    () => tenantClinicTarget(userId, staffReady, staffError, memberships, selectedClinicId),
    [userId, staffReady, staffError, memberships, selectedClinicId],
  )

  useEffect(() => {
    if (!clinicTarget || !auth.configured) return

    let cancelled = false
    loadClinic(getSupabaseClient(), clinicTarget)
      .then((result) => {
        if (cancelled) return
        setClinic(result.clinic)
        setClinicError(result.error)
        setClinicLoadedFor(clinicTarget)
      })
      .catch(() => {
        if (cancelled) return
        setClinic(null)
        setClinicError(new SupabaseAuthError('auth_failed', 'Não foi possível carregar a clínica.'))
        setClinicLoadedFor(clinicTarget)
      })

    return () => {
      cancelled = true
    }
  }, [auth.configured, clinicTarget])

  const snapshot = useMemo(
    () =>
      deriveTenantSnapshot({
        sessionReady: !auth.loading,
        userId,
        authError: auth.error,
        profile,
        memberships,
        staffReady,
        staffError,
        selectedClinicId,
        clinic,
        clinicError,
        clinicSettled: clinicTarget === null || clinicLoadedFor === clinicTarget,
      }),
    [
      auth.loading,
      auth.error,
      userId,
      profile,
      memberships,
      staffReady,
      staffError,
      selectedClinicId,
      clinic,
      clinicError,
      clinicTarget,
      clinicLoadedFor,
    ],
  )

  const selectClinic = useCallback(
    (clinicId: string): SelectClinicResult => {
      const allowed = memberships.some(
        (membership) => membership.isActive && membership.userId === userId && membership.clinicId === clinicId,
      )
      if (!allowed) return { ok: false, reason: 'unknown_clinic' }
      setSelectedClinicId(clinicId)
      return { ok: true }
    },
    [memberships, userId],
  )

  const hasRole = useCallback((role: SupabaseClinicRole) => tenantHasRole(snapshot, role), [snapshot])
  const hasAnyRole = useCallback(
    (roles: readonly SupabaseClinicRole[]) => tenantHasAnyRole(snapshot, roles),
    [snapshot],
  )
  const can = useCallback((permission: V3Permission) => tenantCan(snapshot, permission), [snapshot])

  const value = useMemo<V3TenantContextValue>(
    () => ({
      ...snapshot,
      selectClinic,
      hasRole,
      hasAnyRole,
      can,
    }),
    [snapshot, selectClinic, hasRole, hasAnyRole, can],
  )

  return <V3TenantContext.Provider value={value}>{children}</V3TenantContext.Provider>
}

export function useV3Tenant(): V3TenantContextValue {
  const context = useContext(V3TenantContext)
  if (!context) {
    throw new Error('useV3Tenant deve ser usado dentro de V3TenantProvider')
  }
  return context
}
