import { Link } from 'react-router-dom'
import {
  CalendarDays,
  Camera,
  ClipboardSignature,
  ScrollText,
  Users,
  Wallet,
} from 'lucide-react'
import { useClinic } from '../context/ClinicContext'
import { formatShortDate, todayISO } from '../lib/format'
import { Badge, Card, PageHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

const statusTone = {
  agendado: 'info',
  confirmado: 'success',
  realizado: 'neutral',
  cancelado: 'danger',
  faltou: 'warning',
} as const

export function DashboardPage() {
  const { patients, appointments, consents, contracts, budgets, photos, getPatient, resetDemoData } =
    useClinic()
  const today = todayISO()
  const todayAppts = appointments
    .filter((a) => a.date === today)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
  const pendingConsents = consents.filter((c) => c.status === 'enviado' || c.status === 'rascunho')
  const openBudgets = budgets.filter((b) => b.status === 'enviado' || b.status === 'rascunho')

  const stats = [
    { label: 'Pacientes', value: patients.length, icon: Users, to: '/pacientes' },
    { label: 'Hoje na agenda', value: todayAppts.length, icon: CalendarDays, to: '/agenda' },
    { label: 'Fotos clínicas', value: photos.length, icon: Camera, to: '/fotos' },
    { label: 'Termos pendentes', value: pendingConsents.length, icon: ClipboardSignature, to: '/termos' },
    { label: 'Contratos', value: contracts.length, icon: ScrollText, to: '/contratos' },
    { label: 'Orçamentos abertos', value: openBudgets.length, icon: Wallet, to: '/orcamentos' },
  ]

  return (
    <div>
      <PageHeader
        title="Bom atendimento, Evelyn"
        subtitle="Visão geral da clínica — prontuários, agenda e documentos em um só lugar."
        actions={
          <Button variant="secondary" size="sm" onClick={() => resetDemoData()}>
            Restaurar dados demo
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => (
          <Link key={stat.label} to={stat.to}>
            <Card className="transition hover:border-rose hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">{stat.label}</p>
                  <p className="mt-2 font-display text-4xl text-plum">{stat.value}</p>
                </div>
                <div className="rounded-xl bg-cream-dark p-2.5 text-mauve">
                  <stat.icon size={20} />
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl text-plum">Agenda de hoje</h2>
            <Link to="/agenda" className="text-sm text-mauve hover:underline">
              Ver agenda
            </Link>
          </div>
          {todayAppts.length === 0 ? (
            <p className="text-sm text-muted">Nenhum atendimento para hoje.</p>
          ) : (
            <ul className="space-y-3">
              {todayAppts.map((appt) => (
                <li
                  key={appt.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border bg-cream/60 px-3 py-3"
                >
                  <div>
                    <p className="font-medium text-ink">
                      {appt.startTime} · {getPatient(appt.patientId)?.name ?? 'Paciente'}
                    </p>
                    <p className="text-sm text-muted">{appt.procedure}</p>
                  </div>
                  <Badge tone={statusTone[appt.status]}>{appt.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl text-plum">Pendências</h2>
          </div>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center justify-between rounded-xl bg-cream px-3 py-3">
              <span>Termos aguardando assinatura</span>
              <Badge tone="warning">{pendingConsents.length}</Badge>
            </li>
            <li className="flex items-center justify-between rounded-xl bg-cream px-3 py-3">
              <span>Orçamentos em aberto</span>
              <Badge tone="info">{openBudgets.length}</Badge>
            </li>
            <li className="flex items-center justify-between rounded-xl bg-cream px-3 py-3">
              <span>Contratos ativos</span>
              <Badge tone="success">
                {contracts.filter((c) => c.status === 'assinado').length}
              </Badge>
            </li>
          </ul>
          <p className="mt-4 text-xs text-muted">
            Hoje: {formatShortDate(today)}. Dados permanecem neste navegador até a V2 (nuvem + CRM).
          </p>
        </Card>
      </div>
    </div>
  )
}
