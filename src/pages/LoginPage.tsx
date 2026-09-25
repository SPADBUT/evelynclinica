import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) {
    return <Navigate to={user.role === 'paciente' ? '/portal' : '/'} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
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
        <div className="mb-8 text-center animate-[fadeUp_0.6s_ease-out]">
          <p className="font-display text-5xl text-plum md:text-6xl">Evelyn</p>
          <p className="mt-2 text-xs uppercase tracking-[0.25em] text-mauve">Clínica Estética · V2</p>
          <p className="mt-4 text-sm text-muted">
            Acesse com seu login para a área clínica ou para assinar termos.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="animate-[fadeUp_0.7s_ease-out] space-y-4 rounded-3xl border border-border bg-white/80 p-6 shadow-sm backdrop-blur"
        >
          <Field label="E-mail">
            <Input
              type="email"
              autoComplete="off"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
            />
          </Field>
          <Field label="Senha">
            <Input
              type="password"
              autoComplete="off"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>

        <div className="mt-6 animate-[fadeUp_0.85s_ease-out] rounded-2xl border border-dashed border-border bg-white/50 p-4 text-xs text-muted">
          <p className="font-medium text-ink">Contas demo</p>
          <ul className="mt-2 space-y-1">
            <li>
              Clínica: <code>evelyn@clinica.com</code> / <code>evelyn123</code>
            </li>
            <li>
              Assistente: <code>assistente@clinica.com</code> / <code>assistente123</code>
            </li>
            <li>
              Paciente (termo pendente): <code>juliana.ferreira@email.com</code> /{' '}
              <code>paciente123</code>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
