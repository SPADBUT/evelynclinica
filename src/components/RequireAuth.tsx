import { lazy, Suspense } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const supabaseStaffLogin = import.meta.env.VITE_SUPABASE_AUTH_ENABLED === 'true'

const SupabaseRequireStaff = supabaseStaffLogin
  ? lazy(() =>
      import('../auth/SupabaseStaffGate.tsx').then((mod) => ({ default: mod.SupabaseRequireStaff })),
    )
  : null

export function RequireStaff() {
  if (SupabaseRequireStaff) {
    return (
      <Suspense fallback={<p className="p-6 text-sm text-muted">Carregando sessão…</p>}>
        <SupabaseRequireStaff />
      </Suspense>
    )
  }
  return <V2RequireStaff />
}

function V2RequireStaff() {
  const { user, isStaff } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!isStaff) return <Navigate to="/portal" replace />
  return <Outlet />
}

export function RequirePatient() {
  const { user, isPatient } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!isPatient) return <Navigate to="/" replace />
  return <Outlet />
}
