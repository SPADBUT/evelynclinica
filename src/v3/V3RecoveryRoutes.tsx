import { lazy, Suspense } from 'react'
import { Navigate } from 'react-router-dom'

const recoveryEnabled = import.meta.env.VITE_SUPABASE_AUTH_ENABLED === 'true'

const V3PasswordRecoveryPage = recoveryEnabled
  ? lazy(() =>
      import('../pages/V3PasswordRecoveryPage.tsx').then((mod) => ({
        default: mod.V3PasswordRecoveryPage,
      })),
    )
  : null

export function V3RecoveryRoute() {
  if (!V3PasswordRecoveryPage) return <Navigate to="/login" replace />
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted">Validando o link de recuperação…</p>}>
      <V3PasswordRecoveryPage />
    </Suspense>
  )
}
