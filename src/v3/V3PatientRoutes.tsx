import { lazy, Suspense } from 'react'
import { Navigate } from 'react-router-dom'

const patientRoutesEnabled = import.meta.env.VITE_SUPABASE_AUTH_ENABLED === 'true'

const V3PatientsPage = patientRoutesEnabled
  ? lazy(() => import('../pages/v3/V3PatientsPage.tsx').then((mod) => ({ default: mod.V3PatientsPage })))
  : null

const V3PatientDetailPage = patientRoutesEnabled
  ? lazy(() =>
      import('../pages/v3/V3PatientDetailPage.tsx').then((mod) => ({ default: mod.V3PatientDetailPage })),
    )
  : null

function PatientRouteFallback() {
  return <p className="text-sm text-muted">Carregando pacientes…</p>
}

export function V3PatientListRoute() {
  if (!V3PatientsPage) return <Navigate to="/" replace />
  return (
    <Suspense fallback={<PatientRouteFallback />}>
      <V3PatientsPage />
    </Suspense>
  )
}

export function V3PatientDetailRoute() {
  if (!V3PatientDetailPage) return <Navigate to="/" replace />
  return (
    <Suspense fallback={<PatientRouteFallback />}>
      <V3PatientDetailPage />
    </Suspense>
  )
}
