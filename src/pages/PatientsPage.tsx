import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, Trash2 } from 'lucide-react'
import { useClinic } from '../context/ClinicContext'
import type { Patient, PatientStatus } from '../types'
import { formatPhone, formatShortDate, initials } from '../lib/format'
import { Badge, Card, EmptyState, PageHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Field, Input, Select, Textarea } from '../components/ui/Field'

export const emptyPatientForm = {
  name: '',
  email: '',
  phone: '',
  cpf: '',
  birthDate: '',
  gender: 'Feminino',
  address: '',
  allergies: '',
  medications: '',
  notes: '',
  status: 'ativo' as PatientStatus,
}

const statusTone: Record<PatientStatus, 'success' | 'neutral' | 'info'> = {
  ativo: 'success',
  inativo: 'neutral',
  em_tratamento: 'info',
}

export function PatientsPage() {
  const navigate = useNavigate()
  const { patients, upsertPatient, deletePatient } = useClinic()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyPatientForm)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return patients
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        p.cpf.includes(q),
    )
  }, [patients, query])

  function save() {
    if (!form.name.trim()) return
    const id = upsertPatient(form)
    setOpen(false)
    navigate(`/pacientes/${id}`)
  }

  return (
    <div>
      <PageHeader
        title="Prontuários"
        subtitle="Cadastro de pacientes e acesso ao histórico clínico."
        actions={
          <Button
            onClick={() => {
              setForm(emptyPatientForm)
              setOpen(true)
            }}
          >
            <Plus size={16} /> Novo paciente
          </Button>
        }
      />

      <div className="mb-4 max-w-md">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute top-3.5 left-3 text-muted" />
          <input
            className="w-full rounded-xl border border-border bg-white py-2.5 pr-3 pl-9 text-sm outline-none focus:border-rose focus:ring-2 focus:ring-blush"
            placeholder="Buscar por nome, e-mail, telefone ou CPF..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum paciente encontrado"
          description="Cadastre o primeiro paciente para começar a gestão de prontuários."
          action={
            <Button
              onClick={() => {
                setForm(emptyPatientForm)
                setOpen(true)
              }}
            >
              <Plus size={16} /> Novo paciente
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((patient) => (
            <PatientRow
              key={patient.id}
              patient={patient}
              onDelete={() => {
                if (confirm(`Excluir prontuário de ${patient.name}?`)) deletePatient(patient.id)
              }}
            />
          ))}
        </div>
      )}

      <Modal open={open} title="Novo paciente" onClose={() => setOpen(false)} wide>
        <PatientForm form={form} setForm={setForm} onCancel={() => setOpen(false)} onSave={save} />
      </Modal>
    </div>
  )
}

function PatientRow({ patient, onDelete }: { patient: Patient; onDelete: () => void }) {
  return (
    <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blush font-medium text-plum">
          {initials(patient.name)}
        </div>
        <div>
          <Link to={`/pacientes/${patient.id}`} className="font-medium text-ink hover:text-mauve">
            {patient.name}
          </Link>
          <p className="text-sm text-muted">
            {formatPhone(patient.phone)} · {patient.email || 'sem e-mail'}
          </p>
          <p className="mt-1 text-xs text-muted">Atualizado em {formatShortDate(patient.updatedAt)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge tone={statusTone[patient.status]}>
          {patient.status === 'em_tratamento' ? 'em tratamento' : patient.status}
        </Badge>
        <Link to={`/pacientes/${patient.id}`}>
          <Button variant="secondary" size="sm">
            Abrir
          </Button>
        </Link>
        <Button variant="ghost" size="sm" onClick={onDelete} aria-label="Excluir">
          <Trash2 size={16} />
        </Button>
      </div>
    </Card>
  )
}

export function PatientForm({
  form,
  setForm,
  onCancel,
  onSave,
}: {
  form: typeof emptyPatientForm
  setForm: (value: typeof emptyPatientForm) => void
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault()
        onSave()
      }}
    >
      <Field label="Nome completo" className="sm:col-span-2">
        <Input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </Field>
      <Field label="E-mail">
        <Input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </Field>
      <Field label="Telefone">
        <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </Field>
      <Field label="CPF">
        <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
      </Field>
      <Field label="Nascimento">
        <Input
          type="date"
          value={form.birthDate}
          onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
        />
      </Field>
      <Field label="Gênero">
        <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
          <option>Feminino</option>
          <option>Masculino</option>
          <option>Outro</option>
          <option>Prefiro não informar</option>
        </Select>
      </Field>
      <Field label="Status">
        <Select
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value as PatientStatus })}
        >
          <option value="ativo">Ativo</option>
          <option value="em_tratamento">Em tratamento</option>
          <option value="inativo">Inativo</option>
        </Select>
      </Field>
      <Field label="Endereço" className="sm:col-span-2">
        <Input
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
      </Field>
      <Field label="Alergias">
        <Textarea
          value={form.allergies}
          onChange={(e) => setForm({ ...form, allergies: e.target.value })}
        />
      </Field>
      <Field label="Medicamentos em uso">
        <Textarea
          value={form.medications}
          onChange={(e) => setForm({ ...form, medications: e.target.value })}
        />
      </Field>
      <Field label="Observações" className="sm:col-span-2">
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">Salvar</Button>
      </div>
    </form>
  )
}
