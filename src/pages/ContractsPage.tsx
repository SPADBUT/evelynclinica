import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useClinic } from '../context/ClinicContext'
import { CONTRACT_CLAUSES } from '../data/seed'
import type { ContractStatus } from '../types'
import { formatCurrency, formatShortDate, todayISO } from '../lib/format'
import { Badge, Card, EmptyState, PageHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Field, Input, Select, Textarea } from '../components/ui/Field'

const tone: Record<ContractStatus, 'neutral' | 'info' | 'success' | 'warning'> = {
  rascunho: 'neutral',
  enviado: 'warning',
  assinado: 'success',
  encerrado: 'info',
}

export function ContractsPage() {
  const { contracts, patients, upsertContract, deleteContract, getPatient } = useClinic()
  const [open, setOpen] = useState(false)
  const [viewId, setViewId] = useState<string | null>(null)
  const [form, setForm] = useState({
    patientId: patients[0]?.id ?? '',
    title: '',
    description: '',
    value: 0,
    startDate: todayISO(),
    endDate: '',
    status: 'rascunho' as ContractStatus,
    clauses: CONTRACT_CLAUSES,
  })

  const viewing = contracts.find((c) => c.id === viewId)

  return (
    <div>
      <PageHeader
        title="Contratos"
        subtitle="Gestão de contratos de planos e pacotes de procedimentos."
        actions={
          <Button
            disabled={patients.length === 0}
            onClick={() => {
              setForm({
                patientId: patients[0]?.id ?? '',
                title: '',
                description: '',
                value: 0,
                startDate: todayISO(),
                endDate: '',
                status: 'rascunho',
                clauses: CONTRACT_CLAUSES,
              })
              setOpen(true)
            }}
          >
            <Plus size={16} /> Novo contrato
          </Button>
        }
      />

      {contracts.length === 0 ? (
        <EmptyState
          title="Nenhum contrato"
          description="Registre contratos de pacotes e planos de tratamento."
        />
      ) : (
        <div className="space-y-3">
          {contracts.map((item) => (
            <Card
              key={item.id}
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-ink">{item.title}</p>
                <p className="text-sm text-muted">
                  {getPatient(item.patientId)?.name} · {formatCurrency(item.value)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {formatShortDate(item.startDate)}
                  {item.endDate ? ` → ${formatShortDate(item.endDate)}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={tone[item.status]}>{item.status}</Badge>
                <Select
                  value={item.status}
                  onChange={(e) =>
                    upsertContract({ ...item, status: e.target.value as ContractStatus })
                  }
                >
                  <option value="rascunho">Rascunho</option>
                  <option value="enviado">Enviado</option>
                  <option value="assinado">Assinado</option>
                  <option value="encerrado">Encerrado</option>
                </Select>
                <Button variant="secondary" size="sm" onClick={() => setViewId(item.id)}>
                  Abrir
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm('Excluir contrato?')) deleteContract(item.id)
                  }}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} title="Novo contrato" onClose={() => setOpen(false)} wide>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!form.patientId || !form.title) return
            upsertContract({
              ...form,
              value: Number(form.value) || 0,
              endDate: form.endDate || undefined,
            })
            setOpen(false)
          }}
        >
          <Field label="Paciente" className="sm:col-span-2">
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
          <Field label="Título" className="sm:col-span-2">
            <Input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <Field label="Descrição" className="sm:col-span-2">
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <Field label="Valor (R$)">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
            />
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as ContractStatus })}
            >
              <option value="rascunho">Rascunho</option>
              <option value="enviado">Enviado</option>
              <option value="assinado">Assinado</option>
              <option value="encerrado">Encerrado</option>
            </Select>
          </Field>
          <Field label="Início">
            <Input
              type="date"
              required
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </Field>
          <Field label="Término">
            <Input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </Field>
          <Field label="Cláusulas" className="sm:col-span-2">
            <Textarea
              className="min-h-40"
              value={form.clauses}
              onChange={(e) => setForm({ ...form, clauses: e.target.value })}
            />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(viewing)}
        title={viewing?.title ?? 'Contrato'}
        onClose={() => setViewId(null)}
        wide
      >
        {viewing ? (
          <div className="space-y-4 text-sm">
            <p className="text-muted">
              {getPatient(viewing.patientId)?.name} · {formatCurrency(viewing.value)} ·{' '}
              <Badge tone={tone[viewing.status]}>{viewing.status}</Badge>
            </p>
            <p>{viewing.description}</p>
            <pre className="whitespace-pre-wrap rounded-xl bg-cream p-4 leading-relaxed">
              {viewing.clauses}
            </pre>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
