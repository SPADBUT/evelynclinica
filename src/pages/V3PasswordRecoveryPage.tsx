import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { AuthError } from '@supabase/supabase-js'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import { getSupabaseClient } from '../lib/supabase'
import { recoveryUrlWithoutSecrets, type RecoveryGate } from '../lib/staffRecovery'
import {
  bootstrapRecoverySession,
  clearRecoveryPending,
} from '../services/staffRecoverySession'

const MINIMUM_PASSWORD_LENGTH = 8

export function V3PasswordRecoveryPage() {
  const navigate = useNavigate()
  const [gate, setGate] = useState<RecoveryGate | null>(null)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    void Promise.resolve()
      .then(() => bootstrapRecoverySession(getSupabaseClient()))
      .then((next) => {
        if (!cancelled) setGate(next)
      })
      .catch(() => {
        if (!cancelled) setGate({ status: 'missing' })
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (password !== confirmation) {
      setFormError('A confirmação não confere.')
      return
    }
    if (password.length < MINIMUM_PASSWORD_LENGTH) {
      setFormError('Use pelo menos 8 caracteres.')
      return
    }

    setFormError('')
    setSaving(true)
    try {
      const client = getSupabaseClient()
      const { error } = await client.auth.updateUser({ password })
      if (error) {
        setFormError(updateFailureMessage(error))
        setSaving(false)
        return
      }
      clearRecoveryPending()
      const cleaned = recoveryUrlWithoutSecrets(window.location.href)
      window.history.replaceState(window.history.state, '', cleaned)
      navigate('/', { replace: true })
    } catch {
      setFormError('Não foi possível atualizar a senha.')
      setSaving(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-cream">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-12">
        <div className="mb-8 text-center">
          <p className="font-display text-5xl text-plum">Evelyn</p>
          <p className="mt-2 text-xs uppercase tracking-[0.25em] text-mauve">Recuperação de senha</p>
        </div>
        <div className="rounded-3xl border border-border bg-white/80 p-6 shadow-sm">
          {gate === null ? <p className="text-sm text-muted">Validando o link de recuperação…</p> : null}
          {gate?.status === 'ready' ? (
            <form onSubmit={onSubmit} className="space-y-4">
              <Field label="Nova senha">
                <Input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </Field>
              <Field label="Confirmar senha">
                <Input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </Field>
              {formError ? <p className="text-sm text-danger">{formError}</p> : null}
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? 'Salvando…' : 'Definir senha'}
              </Button>
            </form>
          ) : null}
          {gate && gate.status !== 'ready' ? (
            <div className="space-y-4 text-sm text-ink">
              <p>{gateMessage(gate.status)}</p>
              <Link to="/login" className="text-plum underline">
                Ir para o login
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function gateMessage(status: Exclude<RecoveryGate['status'], 'ready'>): string {
  if (status === 'expired') return 'O link de recuperação expirou ou já foi usado.'
  if (status === 'not_recovery') return 'Este link não é uma recuperação de senha.'
  return 'Não há sessão de recuperação. Abra o link mais recente neste navegador.'
}

function updateFailureMessage(error: AuthError): string {
  const code = error.code?.toLowerCase() ?? ''
  const message = error.message?.toLowerCase() ?? ''
  if (code === 'weak_password' || message.includes('weak') || message.includes('at least')) {
    return 'A senha não atende às regras exigidas.'
  }
  return 'Não foi possível atualizar a senha.'
}
