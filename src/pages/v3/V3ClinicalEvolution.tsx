import { useState } from 'react'
import { Badge, Card, EmptyState } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { formatDate } from '../../lib/format'
import {
  appendClinicalRecordVersion,
  cancelClinicalRecord,
  createClinicalRecord,
  finalizeClinicalRecord,
} from '../../services/clinicalRepository'
import { currentClinicalVersion } from '../../services/clinicalMapping'
import type { ClinicalRecordStatus, V3ClinicalRecord, V3ClinicalVersion } from '../../types/clinicalRecord'
import { CLINICAL_STATUS_LABEL, clinicalSummary } from './clinicalDirectory'
import { useV3ClinicalRecords } from './useV3ClinicalRecords'

const statusTone: Record<ClinicalRecordStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  draft: 'neutral',
  in_progress: 'info',
  finalized: 'success',
  corrected: 'warning',
  cancelled: 'danger',
}

interface EvolutionForm {
  recordedAt: string
  procedureId: string
  procedureName: string
  treatmentId: string
  treatmentSessionId: string
  anamnesis: string
  evolution: string
  productsUsedSummary: string
  nextSteps: string
  changeReason: string
}

const emptyForm: EvolutionForm = {
  recordedAt: '',
  procedureId: '',
  procedureName: '',
  treatmentId: '',
  treatmentSessionId: '',
  anamnesis: '',
  evolution: '',
  productsUsedSummary: '',
  nextSteps: '',
  changeReason: '',
}

function formFromVersion(record: V3ClinicalRecord, version: V3ClinicalVersion | null): EvolutionForm {
  return {
    ...emptyForm,
    procedureId: record.procedureId ?? '',
    procedureName: version?.procedureName ?? '',
    treatmentId: record.treatmentId ?? '',
    treatmentSessionId: record.treatmentSessionId ?? '',
    anamnesis: version?.anamnesis ?? '',
    evolution: version?.evolution ?? '',
    productsUsedSummary: version?.productsUsedSummary ?? '',
    nextSteps: version?.nextSteps ?? '',
  }
}

function toIso(value: string): string | null {
  if (!value.trim()) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function V3ClinicalEvolution({ patientId }: { patientId: string }) {
  const model = useV3ClinicalRecords(patientId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [versionId, setVersionId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [versioning, setVersioning] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [form, setForm] = useState<EvolutionForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  if (!model.canRead) {
    return (
      <Card>
        <h2 className="font-display text-2xl text-plum">Evoluções clínicas</h2>
        <div className="mt-4">
          <EmptyState
            title="Conteúdo clínico restrito"
            description="Este papel não consulta evolução clínica."
          />
        </div>
      </Card>
    )
  }

  const records = model.records
  const selected = records?.find((record) => record.id === selectedId) ?? null
  const selectedVersion =
    selected?.versions.find((version) => version.id === versionId) ??
    (selected ? currentClinicalVersion(selected) : null)
  const context = model.context
  const sessions = (context?.sessions ?? []).filter(
    (session) => !form.treatmentId || session.treatmentId === form.treatmentId,
  )

  function openCreate() {
    setForm(emptyForm)
    setFormError(null)
    setCreating(true)
  }

  function openVersion(record: V3ClinicalRecord) {
    const current = currentClinicalVersion(record)
    setForm(formFromVersion(record, current))
    setFormError(null)
    setVersioning(true)
  }

  async function submitCreate() {
    if (!form.procedureName.trim() && !form.procedureId) {
      setFormError('Informe o procedimento.')
      return
    }
    if (form.recordedAt && !toIso(form.recordedAt)) {
      setFormError('Data da evolução inválida.')
      return
    }
    setSaving(true)
    setFormError(null)
    const result = await createClinicalRecord(model.tenant, {
      patientId,
      treatmentId: form.treatmentId || null,
      treatmentSessionId: form.treatmentSessionId || null,
      procedureId: form.procedureId || null,
      procedureName: form.procedureName,
      recordedAt: form.recordedAt ? toIso(form.recordedAt) : null,
      anamnesis: form.anamnesis,
      evolution: form.evolution,
      productsUsedSummary: form.productsUsedSummary,
      nextSteps: form.nextSteps,
    })
    setSaving(false)
    if (!result.ok) {
      setFormError(result.error.message)
      return
    }
    setCreating(false)
    setSelectedId(result.value.id)
    setVersionId(result.value.currentVersionId)
    await model.reload()
  }

  async function submitVersion() {
    if (!selected) return
    if (!form.procedureName.trim()) {
      setFormError('Informe o procedimento.')
      return
    }
    if (!form.changeReason.trim()) {
      setFormError('Informe o motivo da nova versão.')
      return
    }
    setSaving(true)
    setFormError(null)
    const result = await appendClinicalRecordVersion(model.tenant, selected.id, {
      procedureName: form.procedureName,
      recordedAt: form.recordedAt ? toIso(form.recordedAt) : null,
      anamnesis: form.anamnesis,
      evolution: form.evolution,
      productsUsedSummary: form.productsUsedSummary,
      nextSteps: form.nextSteps,
      changeReason: form.changeReason,
    })
    setSaving(false)
    if (!result.ok) {
      setFormError(result.error.message)
      return
    }
    setVersioning(false)
    setVersionId(result.value.currentVersionId)
    await model.reload()
  }

  async function confirmFinalize() {
    if (!selected) return
    setSaving(true)
    setFormError(null)
    const result = await finalizeClinicalRecord(model.tenant, selected.id)
    setSaving(false)
    if (!result.ok) {
      setFormError(result.error.message)
      return
    }
    setFinalizing(false)
    await model.reload()
  }

  async function confirmCancel() {
    if (!selected) return
    setSaving(true)
    setFormError(null)
    const result = await cancelClinicalRecord(model.tenant, selected.id)
    setSaving(false)
    if (!result.ok) {
      setFormError(result.error.message)
      return
    }
    setCancelling(false)
    await model.reload()
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-2xl text-plum">Evoluções clínicas</h2>
        {records && records.length > 0 ? (
          <Button type="button" onClick={openCreate}>
            Nova evolução
          </Button>
        ) : null}
      </div>

      {model.loading ? <p className="mt-4 text-sm text-muted">Carregando evoluções…</p> : null}

      {model.error ? (
        <div className="mt-4">
          <EmptyState title="Não foi possível carregar" description={model.error.message} />
        </div>
      ) : null}

      {records && records.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Nenhuma evolução"
            description="Ainda não há evolução clínica para esta paciente."
            action={
              <Button type="button" onClick={openCreate}>
                Nova evolução
              </Button>
            }
          />
        </div>
      ) : null}

      {records && records.length > 0 ? (
        <ul className="mt-4 grid gap-3">
          {records.map((record) => {
            const current = currentClinicalVersion(record)
            return (
              <li key={record.id} className="rounded-xl border border-border px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-ink">
                    {current ? formatDate(current.recordedAt, 'dd/MM/yyyy HH:mm') : '—'}
                    {' · '}
                    {current?.procedureName ?? 'Procedimento não informado'}
                  </p>
                  <Badge tone={statusTone[record.status]}>{CLINICAL_STATUS_LABEL[record.status]}</Badge>
                </div>
                {record.treatmentSessionId ? (
                  <p className="mt-1 text-xs text-muted">
                    {record.sessionNumber ? `Sessão ${record.sessionNumber}` : 'Sessão vinculada'}
                  </p>
                ) : null}
                {current?.professionalName ? (
                  <p className="mt-1 text-xs text-muted">{current.professionalName}</p>
                ) : null}
                <p className="mt-2 text-sm text-ink">{clinicalSummary(current?.evolution ?? '')}</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setSelectedId(record.id)
                    setVersionId(current?.id ?? null)
                    setFormError(null)
                  }}
                >
                  Abrir
                </Button>
              </li>
            )
          })}
        </ul>
      ) : null}

      {selected && selectedVersion ? (
        <div className="mt-5 border-t border-border pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-xl text-plum">Evolução</h3>
            <Badge tone={statusTone[selected.status]}>{CLINICAL_STATUS_LABEL[selected.status]}</Badge>
          </div>
          <p className="mt-2 text-sm text-muted">
            Versão {selectedVersion.versionNumber}
            {selectedVersion.id === selected.currentVersionId ? ' · vigente' : ''}
            {' · '}
            {formatDate(selectedVersion.recordedAt, 'dd/MM/yyyy HH:mm')}
          </p>
          {selectedVersion.professionalName ? (
            <p className="mt-1 text-sm text-ink">{selectedVersion.professionalName}</p>
          ) : null}
          <dl className="mt-4 grid gap-3">
            <Detail label="Procedimento" value={selectedVersion.procedureName} />
            <Detail label="Anamnese" value={selectedVersion.anamnesis} />
            <Detail label="Observações clínicas" value={selectedVersion.evolution} />
            <Detail label="Produtos utilizados" value={selectedVersion.productsUsedSummary} />
            <Detail label="Próximos passos" value={selectedVersion.nextSteps} />
            <Detail label="Motivo da versão" value={selectedVersion.changeReason} />
          </dl>

          <h4 className="mt-5 text-sm font-medium text-ink">Histórico de versões</h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {selected.versions.map((version) => (
              <Button
                key={version.id}
                type="button"
                size="sm"
                variant={version.id === selectedVersion.id ? 'primary' : 'secondary'}
                onClick={() => setVersionId(version.id)}
              >
                Versão {version.versionNumber}
              </Button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {selected.status !== 'cancelled' ? (
              <Button type="button" variant="secondary" onClick={() => openVersion(selected)}>
                Nova versão
              </Button>
            ) : null}
            {selected.status === 'draft' || selected.status === 'in_progress' || selected.status === 'corrected' ? (
              <Button type="button" onClick={() => setFinalizing(true)}>
                Finalizar
              </Button>
            ) : null}
            {selected.status !== 'cancelled' ? (
              <Button type="button" variant="danger" onClick={() => setCancelling(true)}>
                Cancelar evolução
              </Button>
            ) : null}
          </div>
          {formError && !creating && !versioning && !finalizing && !cancelling ? (
            <p role="alert" className="mt-3 text-sm text-danger">
              {formError}
            </p>
          ) : null}
        </div>
      ) : null}

      <Modal open={creating} title="Nova evolução" onClose={() => setCreating(false)} wide>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void submitCreate()
          }}
        >
          <p className="text-sm text-muted">A versão anterior de uma evolução finalizada permanece no histórico.</p>
          {model.contextError ? (
            <p className="text-sm text-muted">Catálogo indisponível. O nome do procedimento ainda pode ser informado.</p>
          ) : null}
          <Field label="Data e hora">
            <Input
              type="datetime-local"
              value={form.recordedAt}
              onChange={(event) => setForm({ ...form, recordedAt: event.target.value })}
            />
          </Field>
          <Field label="Procedimento do catálogo">
            <Select
              value={form.procedureId}
              onChange={(event) => {
                const procedureId = event.target.value
                const procedure = context?.procedures.find((item) => item.id === procedureId)
                setForm((current) => ({
                  ...current,
                  procedureId,
                  procedureName: current.procedureName.trim() ? current.procedureName : (procedure?.name ?? ''),
                }))
              }}
            >
              <option value="">Não vincular</option>
              {(context?.procedures ?? []).map((procedure) => (
                <option key={procedure.id} value={procedure.id}>
                  {procedure.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nome do procedimento">
            <Input
              value={form.procedureName}
              onChange={(event) => setForm({ ...form, procedureName: event.target.value })}
            />
          </Field>
          <Field label="Tratamento">
            <Select
              value={form.treatmentId}
              onChange={(event) =>
                setForm({ ...form, treatmentId: event.target.value, treatmentSessionId: '' })
              }
            >
              <option value="">Não vincular</option>
              {(context?.treatments ?? []).map((treatment) => (
                <option key={treatment.id} value={treatment.id}>
                  {treatment.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Sessão">
            <Select
              value={form.treatmentSessionId}
              onChange={(event) => setForm({ ...form, treatmentSessionId: event.target.value })}
            >
              <option value="">Não vincular</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.sessionNumber ? `Sessão ${session.sessionNumber}` : 'Sessão vinculada'}
                </option>
              ))}
            </Select>
          </Field>
          <NarrativeFields form={form} onChange={setForm} />
          {formError ? (
            <p role="alert" className="text-sm text-danger">
              {formError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreating(false)} disabled={saving}>
              Fechar
            </Button>
            <Button type="submit" disabled={saving}>
              Registrar evolução
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={versioning} title="Nova versão" onClose={() => setVersioning(false)} wide>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void submitVersion()
          }}
        >
          <p className="text-sm text-muted">A versão anterior permanece no histórico. Nada é sobrescrito.</p>
          <Field label="Nome do procedimento">
            <Input
              value={form.procedureName}
              onChange={(event) => setForm({ ...form, procedureName: event.target.value })}
            />
          </Field>
          <Field label="Motivo da alteração">
            <Input
              value={form.changeReason}
              onChange={(event) => setForm({ ...form, changeReason: event.target.value })}
            />
          </Field>
          <NarrativeFields form={form} onChange={setForm} />
          {formError ? (
            <p role="alert" className="text-sm text-danger">
              {formError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setVersioning(false)} disabled={saving}>
              Fechar
            </Button>
            <Button type="submit" disabled={saving}>
              Salvar versão
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={finalizing} title="Finalizar evolução?" onClose={() => setFinalizing(false)}>
        <p className="text-sm text-ink">Depois de finalizada, alterações geram uma nova versão.</p>
        {formError ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {formError}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setFinalizing(false)} disabled={saving}>
            Voltar
          </Button>
          <Button type="button" onClick={() => void confirmFinalize()} disabled={saving}>
            Confirmar finalização
          </Button>
        </div>
      </Modal>

      <Modal open={cancelling} title="Cancelar evolução?" onClose={() => setCancelling(false)}>
        <p className="text-sm text-ink">O histórico de versões permanece. A evolução deixa de aceitar novas versões.</p>
        {formError ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {formError}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setCancelling(false)} disabled={saving}>
            Voltar
          </Button>
          <Button type="button" variant="danger" onClick={() => void confirmCancel()} disabled={saving}>
            Confirmar cancelamento
          </Button>
        </div>
      </Modal>
    </Card>
  )
}

function NarrativeFields({
  form,
  onChange,
}: {
  form: EvolutionForm
  onChange: (form: EvolutionForm) => void
}) {
  return (
    <>
      <Field label="Anamnese">
        <Textarea value={form.anamnesis} onChange={(event) => onChange({ ...form, anamnesis: event.target.value })} />
      </Field>
      <Field label="Observações clínicas">
        <Textarea value={form.evolution} onChange={(event) => onChange({ ...form, evolution: event.target.value })} />
      </Field>
      <Field label="Produtos utilizados">
        <Textarea
          value={form.productsUsedSummary}
          onChange={(event) => onChange({ ...form, productsUsedSummary: event.target.value })}
        />
      </Field>
      <Field label="Próximos passos">
        <Textarea value={form.nextSteps} onChange={(event) => onChange({ ...form, nextSteps: event.target.value })} />
      </Field>
    </>
  )
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-1 text-sm whitespace-pre-wrap text-ink">{value && value.trim().length > 0 ? value : '—'}</dd>
    </div>
  )
}
