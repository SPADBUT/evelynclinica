import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { Badge, Card, EmptyState, PageHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { formatPhone, formatShortDate } from '../../lib/format'
import { createPatient } from '../../services/patientRepository'
import type { V3Patient } from '../../types/patient'
import {
  emptyPatientFormValue,
  filterPatients,
  PATIENT_STATUS_LABEL,
  toPatientInput,
  type V3PatientFormValue,
} from './patientDirectory'
import { useV3PatientList } from './useV3Patients'
import { V3PatientForm } from './V3PatientForm'
import { V3PatientScreen } from './V3PatientScreen'

const statusTone = {
  active: 'success',
  inactive: 'neutral',
  in_treatment: 'info',
} as const

export function V3PatientsPage() {
  const directory = useV3PatientList()
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<V3PatientFormValue>(emptyPatientFormValue)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const patients = directory.data
  const visible = useMemo(() => filterPatients(patients ?? [], query), [patients, query])
  const clinicName = directory.tenant.activeClinic?.name

  async function save() {
    if (!form.fullName.trim()) {
      setFormError('Nome completo é obrigatório.')
      return
    }
    setSaving(true)
    setFormError(null)
    const result = await createPatient(directory.tenant, toPatientInput(form))
    setSaving(false)
    if (!result.ok) {
      setFormError(result.error.message)
      return
    }
    setCreating(false)
    await directory.reload()
  }

  return (
    <V3PatientScreen tenant={directory.tenant}>
      <PageHeader
        title="Pacientes"
        subtitle={
          clinicName
            ? `${clinicName}. Lista ativa, sem pacientes arquivadas.`
            : 'Lista ativa da clínica selecionada.'
        }
        actions={
          <Button
            onClick={() => {
              setForm(emptyPatientFormValue)
              setFormError(null)
              setCreating(true)
            }}
          >
            <Plus size={16} /> Nova paciente
          </Button>
        }
      />

      <div className="relative mb-4 max-w-md">
        <Search size={16} className="pointer-events-none absolute top-3.5 left-3 text-muted" />
        <input
          className="w-full rounded-xl border border-border bg-white py-2.5 pr-3 pl-9 text-sm outline-none focus:border-rose focus:ring-2 focus:ring-blush"
          placeholder="Buscar por nome, e-mail, telefone ou CPF"
          aria-label="Buscar pacientes"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {directory.loading && patients === null ? <p className="text-sm text-muted">Carregando pacientes…</p> : null}

      {directory.error ? (
        <EmptyState title="Não foi possível listar" description={directory.error.message} />
      ) : null}

      {patients && patients.length === 0 ? (
        <EmptyState
          title="Nenhuma paciente"
          description="A clínica ainda não tem pacientes ativas."
        />
      ) : null}

      {patients && patients.length > 0 && visible.length === 0 ? (
        <EmptyState
          title="Nenhum resultado"
          description="Nenhuma paciente da lista ativa corresponde à busca."
        />
      ) : null}

      {visible.length > 0 ? (
        <div className="grid gap-3">
          <div className="hidden px-5 text-xs font-medium tracking-wide text-muted uppercase md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto_auto]">
            <span>Nome</span>
            <span>Telefone</span>
            <span>E-mail</span>
            <span>Situação</span>
            <span>Atualização</span>
          </div>
          {visible.map((patient) => (
            <PatientRow key={patient.id} patient={patient} />
          ))}
        </div>
      ) : null}

      <Modal open={creating} title="Nova paciente" onClose={() => setCreating(false)} wide>
        <V3PatientForm
          value={form}
          saving={saving}
          error={formError}
          submitLabel="Cadastrar"
          onChange={setForm}
          onCancel={() => setCreating(false)}
          onSubmit={() => void save()}
        />
      </Modal>
    </V3PatientScreen>
  )
}

function PatientRow({ patient }: { patient: V3Patient }) {
  return (
    <Card className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto_auto] md:items-center">
      <div className="min-w-0">
        <Link to={`/v3/patients/${patient.id}`} className="font-display text-2xl text-plum hover:text-mauve">
          {patient.fullName}
        </Link>
      </div>
      <p className="text-sm text-ink">{patient.phone ? formatPhone(patient.phone) : '—'}</p>
      <p className="truncate text-sm text-ink">{patient.email ?? '—'}</p>
      <Badge tone={statusTone[patient.status]}>{PATIENT_STATUS_LABEL[patient.status]}</Badge>
      <p className="text-sm text-muted">{formatShortDate(patient.updatedAt)}</p>
    </Card>
  )
}
