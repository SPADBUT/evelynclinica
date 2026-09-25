import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useClinic } from '../context/ClinicContext'
import { formatDate, formatPhone, formatShortDate, todayISO } from '../lib/format'
import { Badge, Card, EmptyState, PageHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Field, Input, Textarea } from '../components/ui/Field'
import { emptyPatientForm, PatientForm } from './PatientsPage'

export function PatientDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    getPatient,
    upsertPatient,
    deletePatient,
    records,
    upsertRecord,
    deleteRecord,
    appointments,
    photos,
    consents,
    contracts,
    budgets,
  } = useClinic()

  const patient = id ? getPatient(id) : undefined
  const [editOpen, setEditOpen] = useState(false)
  const [recordOpen, setRecordOpen] = useState(false)
  const [form, setForm] = useState(emptyPatientForm)
  const [recordForm, setRecordForm] = useState({
    date: todayISO(),
    procedure: '',
    professional: 'Evelyn Preto Silva',
    anamnesis: '',
    evolution: '',
    productsUsed: '',
    nextSteps: '',
  })

  const patientRecords = useMemo(
    () => records.filter((r) => r.patientId === id).sort((a, b) => b.date.localeCompare(a.date)),
    [records, id],
  )

  if (!patient) {
    return (
      <EmptyState
        title="Paciente não encontrado"
        description="Este prontuário pode ter sido removido."
        action={
          <Link to="/pacientes">
            <Button variant="secondary">Voltar</Button>
          </Link>
        }
      />
    )
  }

  function openEdit() {
    setForm({
      name: patient!.name,
      email: patient!.email,
      phone: patient!.phone,
      cpf: patient!.cpf,
      birthDate: patient!.birthDate,
      gender: patient!.gender,
      address: patient!.address,
      allergies: patient!.allergies,
      medications: patient!.medications,
      notes: patient!.notes,
      status: patient!.status,
    })
    setEditOpen(true)
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/pacientes')}
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-plum"
      >
        <ArrowLeft size={16} /> Voltar para prontuários
      </button>

      <PageHeader
        title={patient.name}
        subtitle={`${formatPhone(patient.phone)} · CPF ${patient.cpf || '—'}`}
        actions={
          <>
            <Button variant="secondary" onClick={openEdit}>
              Editar cadastro
            </Button>
            <Button
              onClick={() => {
                setRecordForm({
                  date: todayISO(),
                  procedure: '',
                  professional: 'Evelyn Preto Silva',
                  anamnesis: '',
                  evolution: '',
                  productsUsed: '',
                  nextSteps: '',
                })
                setRecordOpen(true)
              }}
            >
              <Plus size={16} /> Nova evolução
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="font-display text-2xl text-plum">Dados clínicos</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
            <Info label="Nascimento" value={formatShortDate(patient.birthDate)} />
            <Info label="Gênero" value={patient.gender} />
            <Info label="E-mail" value={patient.email || '—'} />
            <Info label="Status" value={patient.status} />
            <Info label="Endereço" value={patient.address || '—'} />
            <Info label="Alergias" value={patient.allergies || '—'} />
            <Info label="Medicamentos" value={patient.medications || '—'} />
            <Info label="Observações" value={patient.notes || '—'} />
          </dl>
        </Card>

        <Card>
          <h2 className="font-display text-2xl text-plum">Resumo</h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex justify-between">
              <span className="text-muted">Evoluções</span>
              <Badge tone="info">{patientRecords.length}</Badge>
            </li>
            <li className="flex justify-between">
              <span className="text-muted">Agendamentos</span>
              <Badge>{appointments.filter((a) => a.patientId === id).length}</Badge>
            </li>
            <li className="flex justify-between">
              <span className="text-muted">Fotos</span>
              <Badge>{photos.filter((p) => p.patientId === id).length}</Badge>
            </li>
            <li className="flex justify-between">
              <span className="text-muted">Termos</span>
              <Badge>{consents.filter((c) => c.patientId === id).length}</Badge>
            </li>
            <li className="flex justify-between">
              <span className="text-muted">Contratos</span>
              <Badge>{contracts.filter((c) => c.patientId === id).length}</Badge>
            </li>
            <li className="flex justify-between">
              <span className="text-muted">Orçamentos</span>
              <Badge>{budgets.filter((b) => b.patientId === id).length}</Badge>
            </li>
          </ul>
          <Button
            variant="danger"
            size="sm"
            className="mt-5 w-full"
            onClick={() => {
              if (confirm(`Excluir prontuário de ${patient.name}?`)) {
                deletePatient(patient.id)
                navigate('/pacientes')
              }
            }}
          >
            <Trash2 size={14} /> Excluir paciente
          </Button>
        </Card>
      </div>

      <h2 className="mb-3 font-display text-2xl text-plum">Evoluções do prontuário</h2>
      {patientRecords.length === 0 ? (
        <EmptyState
          title="Sem evoluções ainda"
          description="Registre anamnese, procedimento realizado e próximos passos."
          action={
            <Button onClick={() => setRecordOpen(true)}>
              <Plus size={16} /> Nova evolução
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {patientRecords.map((entry) => (
            <Card key={entry.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-ink">{entry.procedure}</p>
                  <p className="text-sm text-muted">
                    {formatDate(entry.date)} · {entry.professional}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm('Excluir esta evolução?')) deleteRecord(entry.id)
                  }}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
              <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                <Block title="Anamnese" text={entry.anamnesis} />
                <Block title="Evolução" text={entry.evolution} />
                <Block title="Produtos" text={entry.productsUsed} />
                <Block title="Próximos passos" text={entry.nextSteps} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={editOpen} title="Editar paciente" onClose={() => setEditOpen(false)} wide>
        <PatientForm
          form={form}
          setForm={setForm}
          onCancel={() => setEditOpen(false)}
          onSave={() => {
            upsertPatient({ ...form, id: patient.id })
            setEditOpen(false)
          }}
        />
      </Modal>

      <Modal open={recordOpen} title="Nova evolução" onClose={() => setRecordOpen(false)} wide>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!recordForm.procedure.trim()) return
            upsertRecord({ ...recordForm, patientId: patient.id })
            setRecordOpen(false)
          }}
        >
          <Field label="Data">
            <Input
              type="date"
              required
              value={recordForm.date}
              onChange={(e) => setRecordForm({ ...recordForm, date: e.target.value })}
            />
          </Field>
          <Field label="Profissional">
            <Input
              value={recordForm.professional}
              onChange={(e) => setRecordForm({ ...recordForm, professional: e.target.value })}
            />
          </Field>
          <Field label="Procedimento" className="sm:col-span-2">
            <Input
              required
              value={recordForm.procedure}
              onChange={(e) => setRecordForm({ ...recordForm, procedure: e.target.value })}
            />
          </Field>
          <Field label="Anamnese" className="sm:col-span-2">
            <Textarea
              value={recordForm.anamnesis}
              onChange={(e) => setRecordForm({ ...recordForm, anamnesis: e.target.value })}
            />
          </Field>
          <Field label="Evolução" className="sm:col-span-2">
            <Textarea
              value={recordForm.evolution}
              onChange={(e) => setRecordForm({ ...recordForm, evolution: e.target.value })}
            />
          </Field>
          <Field label="Produtos utilizados">
            <Textarea
              value={recordForm.productsUsed}
              onChange={(e) => setRecordForm({ ...recordForm, productsUsed: e.target.value })}
            />
          </Field>
          <Field label="Próximos passos">
            <Textarea
              value={recordForm.nextSteps}
              onChange={(e) => setRecordForm({ ...recordForm, nextSteps: e.target.value })}
            />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => setRecordOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar evolução</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-ink">{value}</dd>
    </div>
  )
}

function Block({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl bg-cream px-3 py-3">
      <p className="text-xs uppercase tracking-wide text-muted">{title}</p>
      <p className="mt-1 whitespace-pre-wrap text-ink">{text || '—'}</p>
    </div>
  )
}
