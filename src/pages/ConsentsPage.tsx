import { useState } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import { useClinic } from '../context/ClinicContext'
import { CONSENT_TEMPLATE } from '../data/seed'
import type { ConsentStatus } from '../types'
import { formatDate, formatShortDate } from '../lib/format'
import { Badge, Card, EmptyState, PageHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Field, Input, Select, Textarea } from '../components/ui/Field'

const tone: Record<ConsentStatus, 'neutral' | 'info' | 'success' | 'warning'> = {
  rascunho: 'neutral',
  enviado: 'warning',
  assinado: 'success',
  expirado: 'info',
}

export function ConsentsPage() {
  const { consents, patients, upsertConsent, deleteConsent, getPatient } = useClinic()
  const [open, setOpen] = useState(false)
  const [viewId, setViewId] = useState<string | null>(null)
  const [form, setForm] = useState({
    patientId: patients[0]?.id ?? '',
    title: '',
    procedure: '',
    content: CONSENT_TEMPLATE,
    status: 'rascunho' as ConsentStatus,
  })

  const viewing = consents.find((c) => c.id === viewId)

  return (
    <div>
      <PageHeader
        title="Termos de consentimento"
        subtitle="Modelos e registros de consentimento informado por procedimento."
        actions={
          <Button
            disabled={patients.length === 0}
            onClick={() => {
              setForm({
                patientId: patients[0]?.id ?? '',
                title: '',
                procedure: '',
                content: CONSENT_TEMPLATE,
                status: 'rascunho',
              })
              setOpen(true)
            }}
          >
            <Plus size={16} /> Novo termo
          </Button>
        }
      />

      {consents.length === 0 ? (
        <EmptyState
          title="Nenhum termo cadastrado"
          description="Crie termos vinculados ao paciente e ao procedimento realizado."
        />
      ) : (
        <div className="space-y-3">
          {consents.map((item) => (
            <Card
              key={item.id}
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-ink">{item.title}</p>
                <p className="text-sm text-muted">
                  {getPatient(item.patientId)?.name} · {item.procedure}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Criado em {formatShortDate(item.createdAt)}
                  {item.signedAt ? ` · Assinado em ${formatDate(item.signedAt)}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={tone[item.status]}>{item.status}</Badge>
                <Button variant="secondary" size="sm" onClick={() => setViewId(item.id)}>
                  Abrir
                </Button>
                {item.status !== 'assinado' ? (
                  <Button
                    size="sm"
                    onClick={() =>
                      upsertConsent({
                        ...item,
                        status: 'assinado',
                        signedAt: new Date().toISOString(),
                        signedBy: getPatient(item.patientId)?.name,
                      })
                    }
                  >
                    <Check size={14} /> Marcar assinado
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm('Excluir termo?')) deleteConsent(item.id)
                  }}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} title="Novo termo de consentimento" onClose={() => setOpen(false)} wide>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!form.patientId || !form.title) return
            upsertConsent(form)
            setOpen(false)
          }}
        >
          <Field label="Paciente">
            <Select
              required
              value={form.patientId}
              onChange={(e) => setForm({ ...form, patientId: e.target.value })}
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Título">
            <Input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <Field label="Procedimento">
            <Input
              required
              value={form.procedure}
              onChange={(e) => setForm({ ...form, procedure: e.target.value })}
            />
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as ConsentStatus })}
            >
              <option value="rascunho">Rascunho</option>
              <option value="enviado">Enviado</option>
              <option value="assinado">Assinado</option>
              <option value="expirado">Expirado</option>
            </Select>
          </Field>
          <Field label="Conteúdo do termo">
            <Textarea
              className="min-h-48"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(viewing)}
        title={viewing?.title ?? 'Termo'}
        onClose={() => setViewId(null)}
        wide
      >
        {viewing ? (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              {getPatient(viewing.patientId)?.name} · {viewing.procedure} ·{' '}
              <Badge tone={tone[viewing.status]}>{viewing.status}</Badge>
            </p>
            <pre className="whitespace-pre-wrap rounded-xl bg-cream p-4 text-sm leading-relaxed text-ink">
              {viewing.content}
            </pre>
            {viewing.signedBy ? (
              <p className="text-sm text-success">
                Assinado por {viewing.signedBy} em {formatDate(viewing.signedAt)}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
