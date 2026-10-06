import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSupabaseAuth } from '../context/SupabaseAuthContext'
import { useV3Tenant } from '../context/V3TenantContext'
import { loadClinicData } from '../lib/storage'
import { Button } from '../components/ui/Button'
import { isAuthorizedStaff } from '../auth/staffAccess'
import { LoginScreen } from './LoginScreen'

function isV2PatientEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase()
  return loadClinicData().users.some(
    (user) => user.active && user.role === 'paciente' && user.email.trim().toLowerCase() === normalized,
  )
}

export function SupabaseStaffLogin() {
  const auth = useSupabaseAuth()
  const tenant = useV3Tenant()
  const v2 = useAuth()
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (v2.isPatient) return <Navigate to="/portal" replace />
  if (isAuthorizedStaff(tenant)) return <Navigate to="/" replace />

  const choosingClinic = tenant.status === 'authenticated_needs_clinic_selection'
  const denied =
    tenant.status === 'authenticated_without_membership' ||
    (tenant.status === 'error' && Boolean(auth.user))

  async function onSubmit(email: string, password: string) {
    setError('')
    if (isV2PatientEmail(email)) {
      setSubmitting(true)
      const result = await v2.login(email, password)
      setSubmitting(false)
      if (!result.ok) setError(result.error)
      return
    }

    setSubmitting(true)
    const result = await auth.signInWithPassword(email, password)
    setSubmitting(false)
    if (!result.ok) setError(result.error.message)
  }

  const clinicPicker = choosingClinic ? (
    <div className="mb-4 rounded-2xl border border-border bg-white/80 p-4 text-sm text-ink">
      <p>{tenant.error?.message}</p>
      <div className="mt-3 space-y-2">
        {tenant.memberships.map((membership) => (
          <Button
            key={membership.id}
            type="button"
            variant="secondary"
            className="w-full justify-between"
            onClick={() => {
              tenant.selectClinic(membership.clinicId)
            }}
          >
            <span className="capitalize">{membership.role}</span>
            <span className="font-mono text-xs text-muted">{membership.clinicId}</span>
          </Button>
        ))}
      </div>
    </div>
  ) : null

  const denial = denied ? (
    <div className="mb-4 rounded-2xl border border-danger/30 bg-white/80 p-4 text-sm text-danger">
      <p>{tenant.error?.message ?? 'Acesso negado.'}</p>
      <Button
        type="button"
        variant="secondary"
        className="mt-3"
        onClick={() => {
          void auth.signOut()
        }}
      >
        Sair
      </Button>
    </div>
  ) : null

  const anonymousError = !auth.user && tenant.status !== 'loading' ? (tenant.error?.message ?? '') : ''

  return (
    <LoginScreen
      onSubmit={onSubmit}
      error={error || anonymousError}
      loading={submitting || (Boolean(auth.user) && tenant.status === 'loading')}
      extra={
        <>
          {clinicPicker}
          {denial}
        </>
      }
    />
  )
}
