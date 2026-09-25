import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useClinic } from '../context/ClinicContext'
import type { InteractionChannel, LeadStage, ReminderKind } from '../types'
import { formatPhone, formatShortDate, todayISO } from '../lib/format'
import { Badge, Card, EmptyState, PageHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Field, Input, Select, Textarea } from '../components/ui/Field'

const stages: { id: LeadStage; label: string }[] = [
  { id: 'lead', label: 'Lead' },
  { id: 'avaliacao', label: 'Avaliação' },
  { id: 'tratamento', label: 'Tratamento' },
  { id: 'manutencao', label: 'Manutenção' },
]

const stageTone: Record<LeadStage, 'neutral' | 'info' | 'warning' | 'success'> = {
  lead: 'info',
  avaliacao: 'warning',
  tratamento: 'success',
  manutencao: 'neutral',
}

const emptyLead = {
  name: '',
  email: '',
  phone: '',
  source: 'Instagram',
  stage: 'lead' as LeadStage,
  interest: '',
  notes: '',
}

export function CrmPage() {
  const { user } = useAuth()
  const {
    leads,
    interactions,
    reminders,
    patients,
    upsertLead,
    deleteLead,
    upsertInteraction,
    upsertReminder,
    getPatient,
  } = useClinic()

  const [leadOpen, setLeadOpen] = useState(false)
  const [interactionOpen, setInteractionOpen] = useState(false)
  const [reminderOpen, setReminderOpen] = useState(false)
  const [form, setForm] = useState(emptyLead)
  const [interactionForm, setInteractionForm] = useState({
    patientId: '',
    leadId: '',
    channel: 'whatsapp' as InteractionChannel,
    summary: '',
    occurredAt: new Date().toISOString().slice(0, 16),
  })
  const [reminderForm, setReminderForm] = useState({
    patientId: patients[0]?.id ?? '',
    kind: 'retorno' as ReminderKind,
    title: '',
    dueDate: todayISO(),
    notes: '',
    done: false,
  })

  const openReminders = useMemo(
    () =>
      reminders
        .filter((r) => !r.done)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [reminders],
  )

  const recentInteractions = useMemo(
    () =>
      [...interactions].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 8),
    [interactions],
  )

  return (
    <div>
      <PageHeader
        title="CRM & relacionamento"
        subtitle="Pipeline de leads, interações e lembretes de retorno."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setInteractionForm({
                  patientId: '',
                  leadId: leads[0]?.id ?? '',
                  channel: 'whatsapp',
                  summary: '',
                  occurredAt: new Date().toISOString().slice(0, 16),
                })
                setInteractionOpen(true)
              }}
            >
              Nova interação
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setReminderForm({
                  patientId: patients[0]?.id ?? '',
                  kind: 'retorno',
                  title: '',
                  dueDate: todayISO(),
                  notes: '',
                  done: false,
                })
                setReminderOpen(true)
              }}
            >
              Novo lembrete
            </Button>
            <Button
              onClick={() => {
                setForm(emptyLead)
                setLeadOpen(true)
              }}
            >
              <Plus size={16} /> Novo lead
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stages.map((stage) => {
          const column = leads.filter((l) => l.stage === stage.id)
          return (
            <div key={stage.id} className="rounded-2xl border border-border bg-white/70 p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-sm font-medium text-ink">{stage.label}</h2>
                <Badge tone={stageTone[stage.id]}>{column.length}</Badge>
              </div>
              <div className="space-y-2">
                {column.length === 0 ? (
                  <p className="px-1 py-6 text-center text-xs text-muted">Vazio</p>
                ) : (
                  column.map((lead) => (
                    <Card key={lead.id} className="!rounded-xl !p-3 shadow-none">
                      <p className="font-medium text-ink">{lead.name}</p>
                      <p className="text-xs text-muted">{lead.interest || lead.source}</p>
                      <p className="mt-1 text-xs text-muted">{formatPhone(lead.phone)}</p>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {stages.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className={`rounded-lg px-2 py-1 text-[10px] uppercase tracking-wide ${
                              lead.stage === s.id
                                ? 'bg-plum text-cream'
                                : 'bg-cream-dark text-muted hover:bg-blush'
                            }`}
                            onClick={() => upsertLead({ ...lead, stage: s.id })}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('Excluir lead?')) deleteLead(lead.id)
                          }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-display text-2xl text-plum">Interações recentes</h2>
          {recentInteractions.length === 0 ? (
            <EmptyState
              title="Sem interações"
              description="Registre WhatsApp, e-mail ou ligações."
            />
          ) : (
            <ul className="space-y-3">
              {recentInteractions.map((item) => (
                <li key={item.id} className="rounded-xl border border-border bg-cream/50 px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone="info">{item.channel}</Badge>
                    <span className="text-xs text-muted">{formatShortDate(item.occurredAt)}</span>
                  </div>
                  <p className="mt-2 text-sm text-ink">{item.summary}</p>
                  <p className="mt-1 text-xs text-muted">
                    {item.patientId
                      ? getPatient(item.patientId)?.name
                      : leads.find((l) => l.id === item.leadId)?.name ?? 'Contato'}{' '}
                    · {item.createdBy}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-display text-2xl text-plum">Lembretes</h2>
          {openReminders.length === 0 ? (
            <p className="text-sm text-muted">Nenhum lembrete pendente.</p>
          ) : (
            <ul className="space-y-3">
              {openReminders.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border bg-cream/50 px-3 py-3"
                >
                  <div>
                    <p className="font-medium text-ink">{item.title}</p>
                    <p className="text-xs text-muted">
                      {item.kind} · {formatShortDate(item.dueDate)}
                      {item.patientId ? ` · ${getPatient(item.patientId)?.name}` : ''}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => upsertReminder({ ...item, done: true })}
                  >
                    Concluir
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Modal open={leadOpen} title="Novo lead" onClose={() => setLeadOpen(false)}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!form.name.trim()) return
            upsertLead(form)
            setLeadOpen(false)
          }}
        >
          <Field label="Nome">
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="E-mail">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Telefone">
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Origem">
            <Input
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
            />
          </Field>
          <Field label="Interesse">
            <Input
              value={form.interest}
              onChange={(e) => setForm({ ...form, interest: e.target.value })}
            />
          </Field>
          <Field label="Notas">
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setLeadOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Modal>

      <Modal open={interactionOpen} title="Nova interação" onClose={() => setInteractionOpen(false)}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!interactionForm.summary.trim()) return
            upsertInteraction({
              patientId: interactionForm.patientId || undefined,
              leadId: interactionForm.leadId || undefined,
              channel: interactionForm.channel,
              summary: interactionForm.summary,
              occurredAt: new Date(interactionForm.occurredAt).toISOString(),
              createdBy: user?.name ?? 'Equipe',
            })
            setInteractionOpen(false)
          }}
        >
          <Field label="Canal">
            <Select
              value={interactionForm.channel}
              onChange={(e) =>
                setInteractionForm({
                  ...interactionForm,
                  channel: e.target.value as InteractionChannel,
                })
              }
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="email">E-mail</option>
              <option value="ligacao">Ligação</option>
              <option value="outro">Outro</option>
            </Select>
          </Field>
          <Field label="Lead (opcional)">
            <Select
              value={interactionForm.leadId}
              onChange={(e) => setInteractionForm({ ...interactionForm, leadId: e.target.value })}
            >
              <option value="">—</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Paciente (opcional)">
            <Select
              value={interactionForm.patientId}
              onChange={(e) =>
                setInteractionForm({ ...interactionForm, patientId: e.target.value })
              }
            >
              <option value="">—</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Quando">
            <Input
              type="datetime-local"
              value={interactionForm.occurredAt}
              onChange={(e) =>
                setInteractionForm({ ...interactionForm, occurredAt: e.target.value })
              }
            />
          </Field>
          <Field label="Resumo">
            <Textarea
              required
              value={interactionForm.summary}
              onChange={(e) =>
                setInteractionForm({ ...interactionForm, summary: e.target.value })
              }
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setInteractionOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Modal>

      <Modal open={reminderOpen} title="Novo lembrete" onClose={() => setReminderOpen(false)}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!reminderForm.title.trim()) return
            upsertReminder(reminderForm)
            setReminderOpen(false)
          }}
        >
          <Field label="Título">
            <Input
              required
              value={reminderForm.title}
              onChange={(e) => setReminderForm({ ...reminderForm, title: e.target.value })}
            />
          </Field>
          <Field label="Tipo">
            <Select
              value={reminderForm.kind}
              onChange={(e) =>
                setReminderForm({ ...reminderForm, kind: e.target.value as ReminderKind })
              }
            >
              <option value="retorno">Retorno</option>
              <option value="orcamento_validade">Validade de orçamento</option>
              <option value="outro">Outro</option>
            </Select>
          </Field>
          <Field label="Paciente">
            <Select
              value={reminderForm.patientId}
              onChange={(e) => setReminderForm({ ...reminderForm, patientId: e.target.value })}
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Data">
            <Input
              type="date"
              value={reminderForm.dueDate}
              onChange={(e) => setReminderForm({ ...reminderForm, dueDate: e.target.value })}
            />
          </Field>
          <Field label="Notas">
            <Textarea
              value={reminderForm.notes}
              onChange={(e) => setReminderForm({ ...reminderForm, notes: e.target.value })}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setReminderOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
