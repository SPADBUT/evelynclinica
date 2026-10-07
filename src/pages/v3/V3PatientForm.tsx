import { V3_PATIENT_STATUSES } from '../../types/patient'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import {
  isPatientStatus,
  PATIENT_STATUS_LABEL,
  type V3PatientFormValue,
} from './patientDirectory'

export function V3PatientForm({
  value,
  saving,
  error,
  submitLabel,
  onChange,
  onCancel,
  onSubmit,
}: {
  value: V3PatientFormValue
  saving: boolean
  error: string | null
  submitLabel: string
  onChange: (next: V3PatientFormValue) => void
  onCancel: () => void
  onSubmit: () => void
}) {
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <Field label="Nome completo" className="sm:col-span-2">
        <Input
          value={value.fullName}
          onChange={(event) => onChange({ ...value, fullName: event.target.value })}
          required
          autoComplete="name"
        />
      </Field>
      <Field label="E-mail">
        <Input
          type="email"
          value={value.email}
          onChange={(event) => onChange({ ...value, email: event.target.value })}
          autoComplete="email"
        />
      </Field>
      <Field label="Telefone">
        <Input
          value={value.phone}
          onChange={(event) => onChange({ ...value, phone: event.target.value })}
          autoComplete="tel"
        />
      </Field>
      <Field label="CPF">
        <Input value={value.cpf} onChange={(event) => onChange({ ...value, cpf: event.target.value })} />
      </Field>
      <Field label="Data de nascimento">
        <Input
          type="date"
          value={value.birthDate}
          onChange={(event) => onChange({ ...value, birthDate: event.target.value })}
        />
      </Field>
      <Field label="Gênero">
        <Input
          value={value.gender}
          onChange={(event) => onChange({ ...value, gender: event.target.value })}
        />
      </Field>
      <Field label="Situação">
        <Select
          value={value.status}
          onChange={(event) => {
            if (isPatientStatus(event.target.value)) onChange({ ...value, status: event.target.value })
          }}
        >
          {V3_PATIENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {PATIENT_STATUS_LABEL[status]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Endereço" className="sm:col-span-2">
        <Input
          value={value.address}
          onChange={(event) => onChange({ ...value, address: event.target.value })}
        />
      </Field>
      <Field label="Alergias" className="sm:col-span-2">
        <Textarea
          value={value.allergies}
          onChange={(event) => onChange({ ...value, allergies: event.target.value })}
        />
      </Field>
      <Field label="Medicamentos" className="sm:col-span-2">
        <Textarea
          value={value.medications}
          onChange={(event) => onChange({ ...value, medications: event.target.value })}
        />
      </Field>
      <Field label="Observações" className="sm:col-span-2">
        <Textarea
          value={value.notes}
          onChange={(event) => onChange({ ...value, notes: event.target.value })}
        />
      </Field>
      {error ? (
        <p role="alert" className="text-sm text-danger sm:col-span-2">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
