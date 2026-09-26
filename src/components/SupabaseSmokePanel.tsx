import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useClinicScope } from '../context/ClinicScopeContext'
import { createPatient, listPatients, type PatientRow } from '../lib/data/patients'
import { Button } from './ui/Button'
import { Card } from './ui/Card'

/**
 * Minimal A2 smoke panel: profile → membership → clinic → RLS-backed query.
 * Does not replace V2 local ClinicContext data.
 */
export function SupabaseSmokePanel() {
  const { supabaseReady, authMode } = useAuth()
  const { profile, currentClinic, role, memberships, can, currentClinicId, setCurrentClinicId } =
    useClinicScope()
  const [patients, setPatients] = useState<PatientRow[]>([])
  const [status, setStatus] = useState<string>('')
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    if (!currentClinicId || !can('patients.read')) {
      setPatients([])
      return
    }
    setBusy(true)
    const result = await listPatients(currentClinicId)
    setBusy(false)
    if (!result.ok) {
      setStatus(result.error)
      setPatients([])
      return
    }
    setPatients(result.data)
    setStatus(`RLS OK · ${result.data.length} paciente(s) visíveis nesta clínica.`)
  }, [currentClinicId, can])

  useEffect(() => {
    void reload()
  }, [reload])

  if (!supabaseReady || authMode !== 'supabase') return null

  async function onCreateSmoke() {
    if (!currentClinicId || !can('patients.write')) {
      setStatus('Sem permissão patients.write nesta clínica.')
      return
    }
    setBusy(true)
    const result = await createPatient({
      clinic_id: currentClinicId,
      full_name: `Smoke ${new Date().toISOString().slice(11, 19)}`,
      status: 'active',
      notes: 'A2 smoke test patient',
    })
    setBusy(false)
    if (!result.ok) {
      setStatus(result.error)
      return
    }
    setStatus(`Criado via Data Layer + RLS: ${result.data.full_name}`)
    await reload()
  }

  return (
    <Card className="mb-6 border-dashed border-mauve/40 bg-white/70">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-mauve">A2 · Supabase</p>
          <h2 className="mt-1 font-display text-2xl text-plum">Auth → Membership → RLS</h2>
          <p className="mt-2 text-sm text-muted">
            Profile: <strong className="text-ink">{profile?.full_name ?? '—'}</strong>
            {' · '}
            Role: <strong className="text-ink">{role ?? '—'}</strong>
            {' · '}
            Clínica: <strong className="text-ink">{currentClinic?.name ?? '—'}</strong>
          </p>
        </div>
        {memberships.length > 1 ? (
          <label className="text-xs text-muted">
            Clínica
            <select
              className="ml-2 rounded-lg border border-border bg-white px-2 py-1 text-sm text-ink"
              value={currentClinicId ?? ''}
              onChange={(e) => setCurrentClinicId(e.target.value)}
            >
              {memberships.map((m) => (
                <option key={m.id} value={m.clinic_id}>
                  {m.clinic.name} ({m.role})
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void reload()}>
          Consultar patients
        </Button>
        <Button size="sm" disabled={busy || !can('patients.write')} onClick={() => void onCreateSmoke()}>
          Smoke insert
        </Button>
      </div>

      {status ? <p className="mt-3 text-xs text-muted">{status}</p> : null}

      {patients.length > 0 ? (
        <ul className="mt-3 max-h-40 space-y-1 overflow-auto text-sm text-ink">
          {patients.slice(0, 8).map((p) => (
            <li key={p.id} className="rounded-lg bg-cream px-2 py-1">
              {p.full_name}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  )
}
