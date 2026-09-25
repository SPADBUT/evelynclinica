import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { useClinic } from '../context/ClinicContext'
import type { PhotoSide } from '../types'
import { formatShortDate, todayISO } from '../lib/format'
import { Badge, Card, EmptyState, PageHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Field, Input, Select, Textarea } from '../components/ui/Field'

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function PhotosPage() {
  const { photos, patients, upsertPhoto, deletePhoto, getPatient } = useClinic()
  const [patientFilter, setPatientFilter] = useState('all')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    patientId: patients[0]?.id ?? '',
    procedure: '',
    side: 'antes' as PhotoSide,
    takenAt: todayISO(),
    notes: '',
    imageData: '',
    pairId: '',
  })

  const filtered = useMemo(() => {
    const list =
      patientFilter === 'all' ? photos : photos.filter((p) => p.patientId === patientFilter)
    return [...list].sort((a, b) => b.takenAt.localeCompare(a.takenAt))
  }, [photos, patientFilter])

  const pairs = useMemo(() => {
    const map = new Map<string, typeof photos>()
    for (const photo of filtered) {
      const key = photo.pairId || photo.id
      const current = map.get(key) ?? []
      current.push(photo)
      map.set(key, current)
    }
    return [...map.entries()]
  }, [filtered])

  return (
    <div>
      <PageHeader
        title="Antes & Depois"
        subtitle="Arquivo fotográfico clínico para acompanhamento de resultados."
        actions={
          <Button
            disabled={patients.length === 0}
            onClick={() => {
              setForm({
                patientId: patients[0]?.id ?? '',
                procedure: '',
                side: 'antes',
                takenAt: todayISO(),
                notes: '',
                imageData: '',
                pairId: uuid(),
              })
              setOpen(true)
            }}
          >
            <Plus size={16} /> Adicionar foto
          </Button>
        }
      />

      <div className="mb-4 max-w-xs">
        <Field label="Filtrar paciente">
          <Select value={patientFilter} onChange={(e) => setPatientFilter(e.target.value)}>
            <option value="all">Todos</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {pairs.length === 0 ? (
        <EmptyState
          title="Nenhuma foto registrada"
          description="Envie fotos de antes e depois vinculadas ao paciente e ao procedimento."
        />
      ) : (
        <div className="space-y-6">
          {pairs.map(([pairId, group]) => {
            const sample = group[0]
            return (
              <Card key={pairId}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink">
                      {getPatient(sample.patientId)?.name} · {sample.procedure}
                    </p>
                    <p className="text-sm text-muted">{group.length} foto(s) no conjunto</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {group.map((photo) => (
                    <figure key={photo.id} className="overflow-hidden rounded-xl border border-border bg-cream">
                      <img
                        src={photo.imageData}
                        alt={`${photo.side} — ${photo.procedure}`}
                        className="aspect-[4/3] w-full object-cover"
                      />
                      <figcaption className="flex items-start justify-between gap-2 p-3">
                        <div>
                          <Badge tone={photo.side === 'antes' ? 'warning' : 'success'}>
                            {photo.side}
                          </Badge>
                          <p className="mt-2 text-sm text-muted">
                            {formatShortDate(photo.takenAt)}
                            {photo.notes ? ` · ${photo.notes}` : ''}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('Excluir foto?')) deletePhoto(photo.id)
                          }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={open} title="Nova foto clínica" onClose={() => setOpen(false)}>
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!form.patientId || !form.procedure || !form.imageData) return
            upsertPhoto({
              patientId: form.patientId,
              procedure: form.procedure,
              side: form.side,
              takenAt: form.takenAt,
              notes: form.notes,
              imageData: form.imageData,
              pairId: form.pairId || undefined,
            })
            setOpen(false)
          }}
        >
          <Field label="Paciente">
            <Select
              required
              value={form.patientId}
              onChange={(e) => setForm({ ...form, patientId: e.target.value })}
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Procedimento">
            <Input
              required
              value={form.procedure}
              onChange={(e) => setForm({ ...form, procedure: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <Select
                value={form.side}
                onChange={(e) => setForm({ ...form, side: e.target.value as PhotoSide })}
              >
                <option value="antes">Antes</option>
                <option value="depois">Depois</option>
              </Select>
            </Field>
            <Field label="Data da foto">
              <Input
                type="date"
                required
                value={form.takenAt}
                onChange={(e) => setForm({ ...form, takenAt: e.target.value })}
              />
            </Field>
          </div>
          <Field label="ID do par (opcional — mesma chave une antes/depois)">
            <Input
              value={form.pairId}
              onChange={(e) => setForm({ ...form, pairId: e.target.value })}
            />
          </Field>
          <Field label="Arquivo de imagem">
            <Input
              type="file"
              accept="image/*"
              required
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                if (file.size > 1_500_000) {
                  alert('Use imagens até ~1.5MB nesta V1 (armazenamento local).')
                  return
                }
                const dataUrl = await fileToDataUrl(file)
                setForm((prev) => ({ ...prev, imageData: dataUrl }))
              }}
            />
          </Field>
          {form.imageData ? (
            <img
              src={form.imageData}
              alt="Pré-visualização"
              className="max-h-48 rounded-xl object-cover"
            />
          ) : null}
          <Field label="Observações">
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar foto</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
