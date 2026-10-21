import { lazy, Suspense } from 'react'
import { Navigate } from 'react-router-dom'

const agendaRoutesEnabled = import.meta.env.VITE_SUPABASE_AUTH_ENABLED === 'true'

const V3AgendaPage = agendaRoutesEnabled
  ? lazy(() => import('../pages/v3/V3AgendaPage.tsx').then((mod) => ({ default: mod.V3AgendaPage })))
  : null

function AgendaRouteFallback() {
  return <p className="text-sm text-muted">Carregando agenda…</p>
}

export function V3AgendaRoute() {
  if (!V3AgendaPage) return <Navigate to="/" replace />
  return (
    <Suspense fallback={<AgendaRouteFallback />}>
      <V3AgendaPage />
    </Suspense>
  )
}
