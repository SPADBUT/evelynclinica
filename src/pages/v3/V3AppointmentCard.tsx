import { Badge } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { formatSaoPauloDateTime, formatSaoPauloTime } from '../../lib/saoPauloTime'
import type { V3Appointment } from '../../types/appointment'
import type { SupabaseClinicRole } from '../../types/supabaseAuth'
import { APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUS_TONE, appointmentTransitions, canEditAppointment } from './appointmentDirectory'

export function V3AppointmentCard({
  appointment,
  role,
  showPatient,
  saving,
  onEdit,
  onTransition,
}: {
  appointment: V3Appointment
  role: SupabaseClinicRole | null
  showPatient: boolean
  saving: boolean
  onEdit: (appointment: V3Appointment) => void
  onTransition: (appointment: V3Appointment, status: V3Appointment['status']) => void
}) {
  const transitions = appointmentTransitions(appointment.status, role)
  return (
    <li className="rounded-xl border border-border px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink">
          {formatSaoPauloTime(appointment.startsAt)} – {formatSaoPauloTime(appointment.endsAt)}
          {' · '}
          {appointment.title}
        </p>
        <Badge tone={APPOINTMENT_STATUS_TONE[appointment.status]}>{APPOINTMENT_STATUS_LABEL[appointment.status]}</Badge>
      </div>
      <p className="mt-1 text-xs text-muted">{formatSaoPauloDateTime(appointment.startsAt)}</p>
      {showPatient ? <p className="mt-2 text-sm text-ink">{appointment.patientName ?? 'Paciente'}</p> : null}
      <p className="mt-1 text-sm text-muted">
        {appointment.professionalName ?? 'Profissional'}
        {appointment.procedureName ? ` · ${appointment.procedureName}` : ''}
      </p>
      {appointment.notes ? <p className="mt-2 text-sm text-ink">{appointment.notes}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {canEditAppointment(appointment.status) ? (
          <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={() => onEdit(appointment)}>
            Remarcar
          </Button>
        ) : null}
        {transitions.map((transition) => (
          <Button
            key={transition.status}
            type="button"
            size="sm"
            variant={transition.status === 'cancelled' ? 'danger' : 'secondary'}
            disabled={saving}
            onClick={() => onTransition(appointment, transition.status)}
          >
            {transition.label}
          </Button>
        ))}
      </div>
    </li>
  )
}
