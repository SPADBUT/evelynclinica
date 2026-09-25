import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { useClinic } from '../context/ClinicContext'
import type { BudgetItem, BudgetStatus } from '../types'
import { budgetTotal, formatCurrency, formatShortDate, todayISO } from '../lib/format'
import { Badge, Card, EmptyState, PageHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Field, Input, Select, Textarea } from '../components/ui/Field'

const tone: Record<BudgetStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  rascunho: 'neutral',
  enviado: 'info',
  aprovado: 'success',
  recusado: 'danger',
  expirado: 'warning',
}

function emptyItem(): BudgetItem {
  return { id: uuid(), description: '', quantity: 1, unitPrice: 0 }
}

export function BudgetsPage() {
  const { budgets, patients, upsertBudget, deleteBudget, getPatient } = useClinic()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    patientId: patients[0]?.id ?? '',
    title: '',
    items: [emptyItem()],
    discount: 0,
    notes: '',
    status: 'rascunho' as BudgetStatus,
    validUntil: todayISO(),
  })

  return (
    <div>
      <PageHeader
        title="Orçamentos"
        subtitle="Monte propostas de procedimentos com itens, descontos e validade."
        actions={
          <Button
            disabled={patients.length === 0}
            onClick={() => {
              setForm({
                patientId: patients[0]?.id ?? '',
                title: '',
                items: [emptyItem()],
                discount: 0,
                notes: '',
                status: 'rascunho',
                validUntil: todayISO(),
              })
              setOpen(true)
            }}
          >
            <Plus size={16} /> Novo orçamento
          </Button>
        }
      />

      {budgets.length === 0 ? (
        <EmptyState
          title="Nenhum orçamento"
          description="Crie orçamentos para apresentar pacotes e procedimentos."
        />
      ) : (
        <div className="space-y-3">
          {budgets.map((budget) => {
            const total = budgetTotal(budget.items, budget.discount)
            return (
              <Card key={budget.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium text-ink">{budget.title}</p>
                    <p className="text-sm text-muted">
                      {getPatient(budget.patientId)?.name} · válido até{' '}
                      {formatShortDate(budget.validUntil)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={tone[budget.status]}>{budget.status}</Badge>
                    <p className="font-display text-2xl text-plum">{formatCurrency(total)}</p>
                  </div>
                </div>

                <ul className="mt-4 space-y-2 rounded-xl bg-cream p-3 text-sm">
                  {budget.items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-3">
                      <span>
                        {item.quantity}× {item.description}
                      </span>
                      <span>{formatCurrency(item.quantity * item.unitPrice)}</span>
                    </li>
                  ))}
                  {budget.discount > 0 ? (
                    <li className="flex justify-between border-t border-border pt-2 text-mauve">
                      <span>Desconto</span>
                      <span>- {formatCurrency(budget.discount)}</span>
                    </li>
                  ) : null}
                </ul>

                {budget.notes ? <p className="mt-3 text-sm text-muted">{budget.notes}</p> : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Select
                    value={budget.status}
                    onChange={(e) =>
                      upsertBudget({ ...budget, status: e.target.value as BudgetStatus })
                    }
                  >
                    <option value="rascunho">Rascunho</option>
                    <option value="enviado">Enviado</option>
                    <option value="aprovado">Aprovado</option>
                    <option value="recusado">Recusado</option>
                    <option value="expirado">Expirado</option>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm('Excluir orçamento?')) deleteBudget(budget.id)
                    }}
                  >
                    <Trash2 size={14} /> Excluir
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={open} title="Novo orçamento" onClose={() => setOpen(false)} wide>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!form.patientId || !form.title || form.items.length === 0) return
            upsertBudget({
              ...form,
              discount: Number(form.discount) || 0,
              items: form.items.map((item) => ({
                ...item,
                quantity: Number(item.quantity) || 1,
                unitPrice: Number(item.unitPrice) || 0,
              })),
            })
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

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Itens</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setForm({ ...form, items: [...form.items, emptyItem()] })}
              >
                <Plus size={14} /> Item
              </Button>
            </div>
            {form.items.map((item, index) => (
              <div key={item.id} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-12">
                <Field label="Descrição" className="sm:col-span-6">
                  <Input
                    required
                    value={item.description}
                    onChange={(e) => {
                      const items = [...form.items]
                      items[index] = { ...item, description: e.target.value }
                      setForm({ ...form, items })
                    }}
                  />
                </Field>
                <Field label="Qtd" className="sm:col-span-2">
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => {
                      const items = [...form.items]
                      items[index] = { ...item, quantity: Number(e.target.value) }
                      setForm({ ...form, items })
                    }}
                  />
                </Field>
                <Field label="Valor unit." className="sm:col-span-3">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => {
                      const items = [...form.items]
                      items[index] = { ...item, unitPrice: Number(e.target.value) }
                      setForm({ ...form, items })
                    }}
                  />
                </Field>
                <div className="flex items-end sm:col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={form.items.length === 1}
                    onClick={() =>
                      setForm({ ...form, items: form.items.filter((i) => i.id !== item.id) })
                    }
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Desconto (R$)">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.discount}
                onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })}
              />
            </Field>
            <Field label="Validade">
              <Input
                type="date"
                required
                value={form.validUntil}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
              />
            </Field>
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as BudgetStatus })}
              >
                <option value="rascunho">Rascunho</option>
                <option value="enviado">Enviado</option>
                <option value="aprovado">Aprovado</option>
                <option value="recusado">Recusado</option>
                <option value="expirado">Expirado</option>
              </Select>
            </Field>
          </div>

          <p className="rounded-xl bg-cream px-3 py-3 text-sm">
            Total:{' '}
            <strong className="text-plum">
              {formatCurrency(budgetTotal(form.items, form.discount))}
            </strong>
          </p>

          <Field label="Observações">
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar orçamento</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
