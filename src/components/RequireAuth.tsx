import { Link, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useClinicScope } from '../context/ClinicScopeContext'
import { useCallback } from 'react'

function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream text-sm text-muted">
      Carregando sessão…
    </div>
  )
}

export function RequireStaff() {
  const { user, loading, isStaff, authMode, supabaseReady, signOut } = useAuth()
  const { loading: scopeLoading, hasMembership, error } = useClinicScope()

  const onSignOut = useCallback(() => {
    void signOut()
  }, [signOut])

  if (loading) return <AuthLoading />
  if (!user) return <Navigate to="/login" replace />
  if (!isStaff) return <Navigate to="/portal" replace />

  // Supabase staff must resolve membership before entering the clinic area
  if (supabaseReady && authMode === 'supabase') {
    if (scopeLoading) return <AuthLoading />
    if (error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-cream px-4 text-center">
          <p className="text-sm text-danger">{error}</p>
          <button type="button" className="text-sm text-plum underline" onClick={onSignOut}>
            Sair
          </button>
        </div>
      )
    }
    if (!hasMembership) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-cream px-4 text-center">
          <p className="font-display text-3xl text-plum">Evelyn</p>
          <p className="max-w-md text-sm text-muted">
            Sua conta está autenticada, mas não possui membership em nenhuma clínica. Contate o
            administrador.
          </p>
          <button type="button" className="text-sm text-plum underline" onClick={onSignOut}>
            Sair
          </button>
          <Link to="/login" className="text-xs text-muted underline">
            Login
          </Link>
        </div>
      )
    }
  }

  return <Outlet />
}

export function RequirePatient() {
  const { user, loading, isPatient } = useAuth()
  if (loading) return <AuthLoading />
  if (!user) return <Navigate to="/login" replace />
  if (!isPatient) return <Navigate to="/" replace />
  return <Outlet />
}
