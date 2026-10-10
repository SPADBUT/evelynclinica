import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { addMinutesToClock, formatSaoPauloTime, saoPauloDateKey, saoPauloToday, saoPauloWallToIso } from '../../lib/saoPauloTime'
import type { V3AgendaProcedure, V3Appointment, V3AppointmentInput, V3BookableProfessional } from '../../types/appointment'
import type { V3Patient } from '../../types/patient'

interface AppointmentFormProps {
  patients: readonly V3Patient[]
  professionals: readonly V3BookableProfessional[]
  procedures: readonly V3AgendaProcedure[]
  lockedPatientId?: string
  appointment?: V3Appointment | null
  day: string
  saving: boolean
  error: string | null
  onCancel: () => void
  onSubmit: (input: V3AppointmentInput) => void
}

export function V3AppointmentForm({
  patients,
  professionals,
  procedures,
  lockedPatientId,
  appointment,
  day,
  saving,
  error,
  onCancel,
  onSubmit,
}: AppointmentFormProps) {
  const initialDate = appointment ? saoPauloDateKey(appointment.startsAt) ?? day : day
  const [patientId, setPatientId] = useState(lockedPatientId ?? appointment?.patientId ?? patients[0]?.id ?? '')
  const [professionalId, setProfessionalId] = useState(appointment?.professionalId ?? professionals[0]?.userId ?? '')
  const [procedureId, setProcedureId] = useState(appointment?.procedureId ?? '')
  const [title, setTitle] = useState(appointment?.title ?? '')
  const [procedureName, setProcedureName] = useState(appointment?.procedureName ?? '')
  const [date, setDate] = useState(initialDate || saoPauloToday())
  const [startTime, setStartTime] = useState(appointment ? formatSaoPauloTime(appointment.startsAt) : '10:00')
  const [endTime, setEndTime] = useState(appointment ? formatSaoPauloTime(appointment.endsAt) : '11:00')
  const [notes, setNotes] = useState(appointment?.notes ?? '')
  const [localError, setLocalError] = useState<string | null>(null)

  function applyProcedure(nextId: string) {
    setProcedureId(nextId)
    const procedure = procedures.find((item) => item.id === nextId)
    if (!procedure) return
    if (!procedureName.trim()) setProcedureName(procedure.name)
    if (!title.trim()) setTitle(procedure.name)
    if (procedure.defaultDurationMinutes) {
      const nextEnd = addMinutesToClock(startTime, procedure.defaultDurationMinutes)
      if (nextEnd) setEndTime(nextEnd)
    }
  }

  function submit() {
    // Both clocks use the same calendar day. An end after midnight is outside
    // this form; the server still accepts an absolute duration of up to 12 hours.
    const startsAt = saoPauloWallToIso(date, startTime)
    const endsAt = saoPauloWallToIso(date, endTime)
    if (!patientId) {
      setLocalError('Selecione a paciente.')
      return
    }
    if (!professionalId) {
      setLocalError('Selecione o profissional.')
      return
    }
    if (!title.trim()) {
      setLocalError('Informe o título do horário.')
      return
    }
    if (!startsAt || !endsAt || endsAt <= startsAt) {
      setLocalError('O término precisa ser depois do início, no fuso de São Paulo.')
      return
    }
    setLocalError(null)
    onSubmit({
      patientId,
      professionalId,
      procedureId: procedureId || null,
      title: title.trim(),
      procedureName: procedureName.trim() || null,
      startsAt,
      endsAt,
      notes: notes.trim() || null,
    })
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      {lockedPatientId ? null : (
        <Field label="Paciente">
          <Select value={patientId} onChange={(event) => setPatientId(event.target.value)} disabled={saving}>
            <option value="">Selecione</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.fullName}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Profissional">
        <Select value={professionalId} onChange={(event) => setProfessionalId(event.target.value)} disabled={saving}>
          <option value="">Selecione</option>
          {professionals.map((professional) => (
            <option key={professional.userId} value={professional.userId}>
              {professional.fullName}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Procedimento do catálogo">
        <Select value={procedureId} onChange={(event) => applyProcedure(event.target.value)} disabled={saving}>
          <option value="">Não vincular</option>
          {procedures.map((procedure) => (
            <option key={procedure.id} value={procedure.id}>
              {procedure.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Título">
        <Input value={title} onChange={(event) => setTitle(event.target.value)} disabled={saving} />
      </Field>
      <Field label="Nome do procedimento">
        <Input value={procedureName} onChange={(event) => setProcedureName(event.target.value)} disabled={saving} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Data">
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} disabled={saving} />
        </Field>
        <Field label="Início">
          <Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} disabled={saving} />
        </Field>
        <Field label="Término">
          <Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} disabled={saving} />
        </Field>
      </div>
      <Field label="Observação operacional">
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} disabled={saving} />
      </Field>
      <p className="text-xs text-muted">
        Horários interpretados em America/Sao_Paulo, com início e término no mesmo dia.
      </p>
      {localError || error ? (
        <p role="alert" className="text-sm text-danger">
          {localError || error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Fechar
        </Button>
        <Button type="submit" disabled={saving}>
          {appointment ? 'Salvar horário' : 'Registrar horário'}
        </Button>
      </div>
    </form>
  )
}
