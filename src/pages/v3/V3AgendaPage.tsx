import { useState } from 'react'
import { Badge, Card, EmptyState, PageHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { createAppointment, transitionAppointment, updateAppointment } from '../../services/appointmentRepository'
import type { AppointmentStatus, V3Appointment, V3AppointmentInput } from '../../types/appointment'
import { V3AppointmentCard } from './V3AppointmentCard'
import { V3AppointmentForm } from './V3AppointmentForm'
import { V3PatientScreen } from './V3PatientScreen'
import { useV3Agenda } from './useV3Appointments'

export function V3AgendaPage() {
  const model = useV3Agenda()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<V3Appointment | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function create(input: V3AppointmentInput) {
    setSaving(true)
    setFormError(null)
    const result = await createAppointment(model.tenant, input)
    setSaving(false)
    if (!result.ok) {
      setFormError(result.error.message)
      return
    }
    setCreating(false)
    await model.reload()
  }

  async function save(input: V3AppointmentInput) {
    if (!editing) return
    setSaving(true)
    setFormError(null)
    const result = await updateAppointment(model.tenant, editing.id, {
      professionalId: input.professionalId,
      procedureId: input.procedureId,
      title: input.title,
      procedureName: input.procedureName,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      notes: input.notes,
    })
    setSaving(false)
    if (!result.ok) {
      setFormError(result.error.message)
      return
    }
    setEditing(null)
    await model.reload()
  }

  async function transition(appointment: V3Appointment, status: AppointmentStatus) {
    setSaving(true)
    setFormError(null)
    const result = await transitionAppointment(model.tenant, appointment.id, status)
    setSaving(false)
    if (!result.ok) {
      setFormError(result.error.message)
      return
    }
    await model.reload()
  }

  return (
    <V3PatientScreen tenant={model.tenant}>
      <PageHeader
        title="Agenda clínica"
        subtitle="Horários da clínica ativa, exibidos em America/Sao_Paulo."
        actions={
          model.canRead ? (
            <Button
              type="button"
              onClick={() => {
                setFormError(null)
                setCreating(true)
              }}
              disabled={model.patients.length === 0 || model.professionals.length === 0}
            >
              Novo horário
            </Button>
          ) : null
        }
      />

      {!model.canRead ? (
        <EmptyState title="Agenda restrita" description="Este papel não consulta a agenda da clínica." />
      ) : (
        <div className="grid gap-6">
          <div className="max-w-xs">
            <Field label="Dia">
              <Input type="date" value={model.day} onChange={(event) => model.setDay(event.target.value)} />
            </Field>
          </div>

          {model.loading ? <p className="text-sm text-muted">Carregando agenda…</p> : null}
          {model.error ? <EmptyState title="Não foi possível carregar" description={model.error.message} /> : null}
          {formError && !creating && !editing ? (
            <p role="alert" className="text-sm text-danger">
              {formError}
            </p>
          ) : null}

          {model.appointments && model.appointments.length === 0 ? (
            <EmptyState title="Agenda livre neste dia" description="Nenhum horário marcado para esta data." />
          ) : null}

          {model.appointments && model.appointments.length > 0 ? (
            <Card>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="font-display text-2xl text-plum">Horários</h2>
                <Badge tone="neutral">{model.appointments.length}</Badge>
              </div>
              <ul className="grid gap-3">
                {model.appointments.map((appointment) => (
                  <V3AppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    role={model.tenant.activeRole}
                    showPatient
                    saving={saving}
                    onEdit={(item) => {
                      setFormError(null)
                      setEditing(item)
                    }}
                    onTransition={(item, status) => void transition(item, status)}
                  />
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      )}

      <Modal open={creating} title="Novo horário" onClose={() => setCreating(false)} wide>
        <V3AppointmentForm
          patients={model.patients}
          professionals={model.professionals}
          procedures={model.procedures}
          day={model.day}
          saving={saving}
          error={formError}
          onCancel={() => setCreating(false)}
          onSubmit={(input) => void create(input)}
        />
      </Modal>

      <Modal open={Boolean(editing)} title="Remarcar horário" onClose={() => setEditing(null)} wide>
        {editing ? (
          <V3AppointmentForm
            patients={model.patients}
            professionals={model.professionals}
            procedures={model.procedures}
            lockedPatientId={editing.patientId}
            appointment={editing}
            day={model.day}
            saving={saving}
            error={formError}
            onCancel={() => setEditing(null)}
            onSubmit={(input) => void save(input)}
          />
        ) : null}
      </Modal>
    </V3PatientScreen>
  )
}
