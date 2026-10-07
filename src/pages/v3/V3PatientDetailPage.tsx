import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Card, EmptyState, PageHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { formatPhone, formatShortDate } from '../../lib/format'
import { softDeletePatient, updatePatient } from '../../services/patientRepository'
import {
  formValueFromPatient,
  PATIENT_360_SECTIONS,
  PATIENT_STATUS_LABEL,
  toPatientInput,
  type V3PatientFormValue,
} from './patientDirectory'
import { useV3PatientDetail } from './useV3Patients'
import { V3ClinicalEvolution } from './V3ClinicalEvolution'
import { V3PatientForm } from './V3PatientForm'
import { V3PatientScreen } from './V3PatientScreen'

const statusTone = {
  active: 'success',
  inactive: 'neutral',
  in_treatment: 'info',
} as const

export function V3PatientDetailPage() {
  const params = useParams()
  const patientId = params.id ?? ''
  const navigate = useNavigate()
  const detail = useV3PatientDetail(patientId)
  const patient = detail.data
  const [editing, setEditing] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [form, setForm] = useState<V3PatientFormValue | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function save() {
    if (!form || !patient) return
    if (!form.fullName.trim()) {
      setFormError('Nome completo é obrigatório.')
      return
    }
    setSaving(true)
    setFormError(null)
    const result = await updatePatient(detail.tenant, patient.id, toPatientInput(form))
    setSaving(false)
    if (!result.ok) {
      setFormError(result.error.message)
      return
    }
    setEditing(false)
    await detail.reload()
  }

  async function archive() {
    if (!patient) return
    setSaving(true)
    setFormError(null)
    const result = await softDeletePatient(detail.tenant, patient.id)
    setSaving(false)
    if (!result.ok) {
      setFormError(result.error.message)
      return
    }
    setArchiving(false)
    navigate('/v3/patients')
  }

  return (
    <V3PatientScreen tenant={detail.tenant}>
      <p className="mb-4">
        <Link to="/v3/patients" className="text-sm text-plum underline">
          Voltar para a lista
        </Link>
      </p>

      {detail.loading && !patient ? <p className="text-sm text-muted">Carregando pacientes…</p> : null}

      {detail.error ? (
        <EmptyState
          title={detail.error.code === 'patient_not_found' ? 'Paciente não encontrada' : 'Não foi possível abrir'}
          description={detail.error.message}
        />
      ) : null}

      {patient ? (
        <div className="grid gap-6">
          <PageHeader
            title={patient.fullName}
            subtitle={detail.tenant.activeClinic?.name ?? 'Clínica ativa'}
            actions={
              <>
                <Badge tone={statusTone[patient.status]}>{PATIENT_STATUS_LABEL[patient.status]}</Badge>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setForm(formValueFromPatient(patient))
                    setFormError(null)
                    setEditing(true)
                  }}
                >
                  Editar dados
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setFormError(null)
                    setArchiving(true)
                  }}
                >
                  Arquivar
                </Button>
              </>
            }
          />

          <Card>
            <h2 className="font-display text-2xl text-plum">Resumo</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <Fact label="Telefone" value={patient.phone ? formatPhone(patient.phone) : null} />
              <Fact label="E-mail" value={patient.email} />
              <Fact label="Nascimento" value={patient.birthDate ? formatShortDate(patient.birthDate) : null} />
              <Fact label="Gênero" value={patient.gender} />
              <Fact label="CPF" value={patient.cpf} />
            </dl>
          </Card>

          <Card>
            <h2 className="font-display text-2xl text-plum">Informações</h2>
            <dl className="mt-4 grid gap-4">
              <Fact label="Endereço" value={patient.address} />
              <Fact label="Alergias" value={patient.allergies} />
              <Fact label="Medicamentos" value={patient.medications} />
              <Fact label="Observações" value={patient.notes} />
            </dl>
          </Card>

          <V3ClinicalEvolution patientId={patient.id} />

          <Card>
            <h2 className="font-display text-2xl text-plum">Histórico</h2>
            <p className="mt-2 text-sm text-muted">
              Estes módulos ainda não fazem parte desta versão. Nenhum registro foi inventado.
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {PATIENT_360_SECTIONS.map((section) => (
                <li key={section} className="rounded-xl border border-dashed border-border px-4 py-3">
                  <p className="text-sm text-ink">{section}</p>
                  <p className="text-xs text-muted">Em construção</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}

      <Modal open={editing} title="Editar dados" onClose={() => setEditing(false)} wide>
        {form ? (
          <V3PatientForm
            value={form}
            saving={saving}
            error={formError}
            submitLabel="Salvar"
            onChange={setForm}
            onCancel={() => setEditing(false)}
            onSubmit={() => void save()}
          />
        ) : null}
      </Modal>

      <Modal open={archiving} title="Arquivar paciente?" onClose={() => setArchiving(false)}>
        <p className="text-sm text-ink">
          Ela deixará de aparecer na lista ativa, mas seus registros permanecerão preservados.
        </p>
        {formError ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {formError}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setArchiving(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" variant="danger" onClick={() => void archive()} disabled={saving}>
            Confirmar arquivamento
          </Button>
        </div>
      </Modal>
    </V3PatientScreen>
  )
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{value && value.length > 0 ? value : '—'}</dd>
    </div>
  )
}
