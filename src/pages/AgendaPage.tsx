import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useClinic } from '../context/ClinicContext'
import type { AppointmentStatus } from '../types'
import { formatShortDate, todayISO } from '../lib/format'
import { Badge, Card, EmptyState, PageHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Field, Input, Select, Textarea } from '../components/ui/Field'

const statusTone: Record<AppointmentStatus, 'info' | 'success' | 'neutral' | 'danger' | 'warning'> = {
  agendado: 'info',
  confirmado: 'success',
  realizado: 'neutral',
  cancelado: 'danger',
  faltou: 'warning',
}

export function AgendaPage() {
  const { appointments, patients, upsertAppointment, deleteAppointment, getPatient } = useClinic()
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    patientId: patients[0]?.id ?? '',
    title: '',
    procedure: '',
    date: todayISO(),
    startTime: '10:00',
    endTime: '11:00',
    status: 'agendado' as AppointmentStatus,
    notes: '',
  })

  const dayItems = useMemo(
    () =>
      appointments
        .filter((a) => a.date === selectedDate)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [appointments, selectedDate],
  )

  const upcoming = useMemo(
    () =>
      [...appointments]
        .filter((a) => a.date >= todayISO() && a.status !== 'cancelado')
        .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
        .slice(0, 8),
    [appointments],
  )

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle="Organize avaliações, procedimentos e retornos."
        actions={
          <Button
            onClick={() => {
              setForm({
                patientId: patients[0]?.id ?? '',
                title: '',
                procedure: '',
                date: selectedDate,
                startTime: '10:00',
                endTime: '11:00',
                status: 'agendado',
                notes: '',
              })
              setOpen(true)
            }}
            disabled={patients.length === 0}
          >
            <Plus size={16} /> Novo agendamento
          </Button>
        }
      />

      <div className="mb-4 max-w-xs">
        <Field label="Dia">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <h2 className="mb-3 font-display text-2xl text-plum">
            {formatShortDate(selectedDate)}
          </h2>
          {dayItems.length === 0 ? (
            <EmptyState
              title="Agenda livre neste dia"
              description="Nenhum horário marcado. Crie um agendamento para preencher a agenda."
            />
          ) : (
            <div className="space-y-3">
              {dayItems.map((item) => (
                <Card key={item.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-ink">
                      {item.startTime} – {item.endTime} · {item.title || item.procedure}
                    </p>
                    <p className="text-sm text-muted">
                      {getPatient(item.patientId)?.name ?? 'Paciente'} · {item.procedure}
                    </p>
                    {item.notes ? <p className="mt-1 text-xs text-muted">{item.notes}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={item.status}
                      onChange={(e) =>
                        upsertAppointment({
                          ...item,
                          status: e.target.value as AppointmentStatus,
                        })
                      }
                    >
                      <option value="agendado">Agendado</option>
                      <option value="confirmado">Confirmado</option>
                      <option value="realizado">Realizado</option>
                      <option value="cancelado">Cancelado</option>
                      <option value="faltou">Faltou</option>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('Excluir agendamento?')) deleteAppointment(item.id)
                      }}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Card>
          <h2 className="font-display text-2xl text-plum">Próximos</h2>
          <ul className="mt-4 space-y-3">
            {upcoming.map((item) => (
              <li key={item.id} className="rounded-xl bg-cream px-3 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {formatShortDate(item.date)} · {item.startTime}
                  </span>
                  <Badge tone={statusTone[item.status]}>{item.status}</Badge>
                </div>
                <p className="mt-1 text-muted">
                  {getPatient(item.patientId)?.name} — {item.procedure}
                </p>
              </li>
            ))}
            {upcoming.length === 0 ? (
              <li className="text-sm text-muted">Sem próximos agendamentos.</li>
            ) : null}
          </ul>
        </Card>
      </div>

      <Modal open={open} title="Novo agendamento" onClose={() => setOpen(false)}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!form.patientId || !form.procedure) return
            upsertAppointment(form)
            setSelectedDate(form.date)
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
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex.: Retorno bioestimulador"
            />
          </Field>
          <Field label="Procedimento">
            <Input
              required
              value={form.procedure}
              onChange={(e) => setForm({ ...form, procedure: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Data">
              <Input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </Field>
            <Field label="Início">
              <Input
                type="time"
                required
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              />
            </Field>
            <Field label="Fim">
              <Input
                type="time"
                required
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as AppointmentStatus })}
            >
              <option value="agendado">Agendado</option>
              <option value="confirmado">Confirmado</option>
              <option value="realizado">Realizado</option>
              <option value="cancelado">Cancelado</option>
              <option value="faltou">Faltou</option>
            </Select>
          </Field>
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
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
