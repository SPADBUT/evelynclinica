import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, EmptyState } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { createAppointment, transitionAppointment, updateAppointment } from '../../services/appointmentRepository'
import type { AppointmentStatus, V3Appointment, V3AppointmentInput } from '../../types/appointment'
import { V3AppointmentCard } from './V3AppointmentCard'
import { V3AppointmentForm } from './V3AppointmentForm'
import { useV3PatientAgenda } from './useV3Appointments'
import { saoPauloToday } from '../../lib/saoPauloTime'

export function V3PatientAgenda({ patientId, patientName }: { patientId: string; patientName: string }) {
  const model = useV3PatientAgenda(patientId)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<V3Appointment | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const appointments = (model.appointments ?? []).filter((item) => item.patientId === patientId)

  async function create(input: V3AppointmentInput) {
    setSaving(true)
    setFormError(null)
    const result = await createAppointment(model.tenant, { ...input, patientId })
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
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-2xl text-plum">Agenda</h2>
        <div className="flex flex-wrap gap-2">
          <Link to="/v3/agenda" className="text-sm text-plum underline">
            Abrir agenda da clínica
          </Link>
          {model.canRead ? (
            <Button
              type="button"
              onClick={() => {
                setFormError(null)
                setCreating(true)
              }}
              disabled={model.professionals.length === 0}
            >
              Novo horário
            </Button>
          ) : null}
        </div>
      </div>
      <p className="mt-2 text-sm text-muted">Somente os horários de {patientName}. Fuso America/Sao_Paulo.</p>

      {!model.canRead ? (
        <div className="mt-4">
          <EmptyState title="Agenda restrita" description="Este papel não consulta a agenda da clínica." />
        </div>
      ) : null}

      {model.loading ? <p className="mt-4 text-sm text-muted">Carregando agenda…</p> : null}
      {model.error ? (
        <div className="mt-4">
          <EmptyState title="Não foi possível carregar" description={model.error.message} />
        </div>
      ) : null}
      {formError && !creating && !editing ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {formError}
        </p>
      ) : null}

      {model.appointments && appointments.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="Nenhum horário" description="Ainda não há agendamento para esta paciente." />
        </div>
      ) : null}

      {appointments.length > 0 ? (
        <ul className="mt-4 grid gap-3">
          {appointments.map((appointment) => (
            <V3AppointmentCard
              key={appointment.id}
              appointment={appointment}
              role={model.tenant.activeRole}
              showPatient={false}
              saving={saving}
              onEdit={(item) => {
                setFormError(null)
                setEditing(item)
              }}
              onTransition={(item, status) => void transition(item, status)}
            />
          ))}
        </ul>
      ) : null}

      <Modal open={creating} title="Novo horário" onClose={() => setCreating(false)} wide>
        <V3AppointmentForm
          patients={[]}
          professionals={model.professionals}
          procedures={model.procedures}
          lockedPatientId={patientId}
          day={saoPauloToday()}
          saving={saving}
          error={formError}
          onCancel={() => setCreating(false)}
          onSubmit={(input) => void create(input)}
        />
      </Modal>

      <Modal open={Boolean(editing)} title="Remarcar horário" onClose={() => setEditing(null)} wide>
        {editing ? (
          <V3AppointmentForm
            patients={[]}
            professionals={model.professionals}
            procedures={model.procedures}
            lockedPatientId={patientId}
            appointment={editing}
            day={saoPauloToday()}
            saving={saving}
            error={formError}
            onCancel={() => setEditing(null)}
            onSubmit={(input) => void save(input)}
          />
        ) : null}
      </Modal>
    </Card>
  )
}
