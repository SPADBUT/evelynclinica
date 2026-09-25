import { useCallback, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useClinic } from '../../context/ClinicContext'
import { SignaturePad } from '../../components/SignaturePad'
import { Button } from '../../components/ui/Button'
import { Badge, Card, PageHeader } from '../../components/ui/Card'
import { Field, Input } from '../../components/ui/Field'
import { formatDate } from '../../lib/format'

export function SignConsentPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { consents, signConsent } = useClinic()
  const consent = consents.find((c) => c.id === id)

  const [fullName, setFullName] = useState(user?.name ?? '')
  const [accepted, setAccepted] = useState(false)
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const signatureRef = useRef<string | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const onSignatureChange = useCallback((data: string | null) => {
    signatureRef.current = data
    setSignatureData(data)
  }, [])

  if (!consent || consent.patientId !== user?.patientId) {
    return <Navigate to="/portal" replace />
  }

  if (consent.status === 'rascunho') {
    return <Navigate to="/portal" replace />
  }

  const alreadySigned = consent.status === 'assinado'

  function handleSign() {
    if (!consent) return
    setError('')
    const signature = signatureRef.current ?? signatureData
    if (!fullName.trim()) {
      setError('Informe o nome completo.')
      return
    }
    if (!accepted) {
      setError('Confirme que leu e concorda com o termo.')
      return
    }
    if (!signature) {
      setError('Desenhe sua assinatura na área indicada.')
      return
    }
    setSaving(true)
    const result = signConsent({
      consentId: consent.id,
      signedBy: fullName.trim(),
      signatureData: signature,
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    navigate('/portal', { replace: true })
  }

  return (
    <div>
      <PageHeader
        title={consent.title}
        subtitle={`${consent.procedure} · ${alreadySigned ? 'Assinado' : 'Aguardando sua assinatura'}`}
        actions={
          <Link to="/portal">
            <Button variant="secondary" size="sm">
              Voltar
            </Button>
          </Link>
        }
      />

      <Card className="mb-4">
        <div className="mb-3 flex items-center gap-2">
          <Badge tone={alreadySigned ? 'success' : 'warning'}>{consent.status}</Badge>
          {consent.signedAt ? (
            <span className="text-xs text-muted">
              Assinado por {consent.signedBy} em {formatDate(consent.signedAt)}
            </span>
          ) : null}
        </div>
        <pre className="whitespace-pre-wrap rounded-xl bg-cream p-4 text-sm leading-relaxed text-ink">
          {consent.content}
        </pre>
        {consent.signatureData ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Assinatura</p>
            <img
              src={consent.signatureData}
              alt="Assinatura do termo"
              className="max-h-32 rounded-xl border border-border bg-white"
            />
          </div>
        ) : null}
      </Card>

      {!alreadySigned ? (
        <Card className="space-y-4">
          <Field label="Nome completo (como no documento)">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </Field>

          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
              Assinatura manuscrita
            </p>
            <SignaturePad onChange={onSignatureChange} typedName={fullName} />
          </div>

          <label className="flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              className="mt-1"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            <span>
              Declaro que li e compreendi o termo de consentimento informado e autorizo o procedimento
              descrito.
            </span>
          </label>

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => navigate('/portal')}>
              Cancelar
            </Button>
            <Button onClick={handleSign} disabled={saving}>
              {saving ? 'Registrando…' : 'Assinar termo'}
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  )
}
