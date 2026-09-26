import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'

export function ForgotPasswordPage() {
  const { resetPassword, supabaseReady } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await resetPassword(email)
    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setDone(true)
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-cream">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 10% 20%, #e8cfc8 0%, transparent 55%), radial-gradient(ellipse 70% 50% at 90% 80%, #dce6df 0%, transparent 50%), linear-gradient(160deg, #faf6f3 0%, #f0e8e3 100%)',
        }}
      />
      <div className="relative mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-12">
        <div className="mb-8 text-center">
          <p className="font-display text-5xl text-plum">Evelyn</p>
          <p className="mt-2 text-xs uppercase tracking-[0.25em] text-mauve">Recuperar senha</p>
        </div>

        {!supabaseReady ? (
          <div className="rounded-3xl border border-border bg-white/80 p-6 text-sm text-muted">
            Recuperação de senha está disponível apenas com Supabase Auth configurado.
            <p className="mt-4">
              <Link to="/login" className="text-plum underline">
                Voltar ao login
              </Link>
            </p>
          </div>
        ) : done ? (
          <div className="rounded-3xl border border-border bg-white/80 p-6 text-sm text-muted">
            Se o e-mail existir, enviamos um link de recuperação. Verifique sua caixa de entrada.
            <p className="mt-4">
              <Link to="/login" className="text-plum underline">
                Voltar ao login
              </Link>
            </p>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="space-y-4 rounded-3xl border border-border bg-white/80 p-6 shadow-sm backdrop-blur"
          >
            <Field label="E-mail da equipe">
              <Input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </Field>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Enviando…' : 'Enviar link'}
            </Button>
            <p className="text-center text-xs text-muted">
              <Link to="/login" className="text-plum underline-offset-2 hover:underline">
                Voltar ao login
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
