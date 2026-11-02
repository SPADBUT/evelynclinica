import { useState, type FormEvent } from 'react'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import { requestPasswordRecovery } from '../services/supabaseAuthService'

export function StaffRecoveryRequest({ origin = window.location.origin }: { origin?: string }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    setPending(true)
    const result = await requestPasswordRecovery(email, origin)
    setPending(false)
    setMessage(
      result.ok
        ? 'Se existir uma conta de staff, o link de recuperação foi enviado.'
        : result.error.message,
    )
  }

  if (!open) {
    return (
      <div className="mb-4 text-center">
        <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
          Esqueci minha senha
        </Button>
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mb-4 space-y-3 rounded-2xl border border-border bg-white/80 p-4"
    >
      <Field label="E-mail da conta">
        <Input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="staff@clinica.com"
        />
      </Field>
      {message ? <p className="text-sm text-ink">{message}</p> : null}
      <Button type="submit" variant="secondary" className="w-full" disabled={pending}>
        {pending ? 'Enviando…' : 'Enviar link de recuperação'}
      </Button>
    </form>
  )
}
