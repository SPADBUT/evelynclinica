import { Navigate, Outlet } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSupabaseAuth } from '../context/SupabaseAuthContext'
import { useV3Tenant } from '../context/V3TenantContext'
import { Button } from '../components/ui/Button'
import { isAuthorizedStaff } from './staffAccess'

/**
 * Reversible route bridge. Loaded only when VITE_SUPABASE_AUTH_ENABLED=true.
 * V2 AuthContext stays the patient session. This gate does not write it.
 */
export function SupabaseRequireStaff() {
  const tenant = useV3Tenant()
  const v2 = useAuth()

  if (tenant.status === 'loading') return <p className="p-6 text-sm text-muted">Carregando sessão…</p>
  if (isAuthorizedStaff(tenant)) return <Outlet />
  if (v2.isPatient) return <Navigate to="/portal" replace />
  return <Navigate to="/login" replace />
}

export function SupabaseStaffIdentity() {
  const { profile, activeRole } = useV3Tenant()
  const { signOut } = useSupabaseAuth()

  return (
    <>
      <p className="mt-2 text-cream/90">{profile?.fullName}</p>
      <p className="mt-0.5 capitalize">{activeRole}</p>
      <Button
        variant="ghost"
        size="sm"
        className="mt-3 text-blush hover:bg-white/10 hover:text-white"
        onClick={() => {
          void signOut()
        }}
      >
        <LogOut size={14} /> Sair
      </Button>
    </>
  )
}
