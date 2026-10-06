import { lazy, Suspense, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LoginScreen } from './LoginScreen'

const supabaseStaffLogin = import.meta.env.VITE_SUPABASE_AUTH_ENABLED === 'true'

const SupabaseStaffLogin = supabaseStaffLogin
  ? lazy(() =>
      import('./SupabaseStaffLogin.tsx').then((mod) => ({ default: mod.SupabaseStaffLogin })),
    )
  : null

export function LoginPage() {
  if (SupabaseStaffLogin) {
    return (
      <Suspense fallback={null}>
        <SupabaseStaffLogin />
      </Suspense>
    )
  }
  return <V2LoginPage />
}

function V2LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) {
    return <Navigate to={user.role === 'paciente' ? '/portal' : '/'} replace />
  }

  async function onSubmit(email: string, password: string) {
    setError('')
    setLoading(true)
    const result = await login(email, password)
    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    navigate(result.user.role === 'paciente' ? '/portal' : '/', { replace: true })
  }

  return <LoginScreen onSubmit={onSubmit} error={error} loading={loading} />
}
