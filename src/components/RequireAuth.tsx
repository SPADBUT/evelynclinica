import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function RequireStaff() {
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
