import { useAuth } from '../../context/AuthContext'
import { useClinic } from '../../context/ClinicContext'
import { formatCurrency, formatDate, formatShortDate } from '../../lib/format'
import { Badge, Card, EmptyState, PageHeader } from '../../components/ui/Card'
import type { ContractStatus } from '../../types'

const tone: Record<ContractStatus, 'neutral' | 'info' | 'success' | 'warning'> = {
  rascunho: 'neutral',
  enviado: 'warning',
  assinado: 'success',
  encerrado: 'info',
}

export function PatientContractsPage() {
  const { user } = useAuth()
  const { contracts } = useClinic()
  const mine = contracts.filter((c) => c.patientId === user?.patientId && c.status !== 'rascunho')

  return (
    <div>
      <PageHeader
        title="Meus contratos"
        subtitle="Planos e contratos liberados pela clínica para sua conferência."
      />

      {mine.length === 0 ? (
        <EmptyState
          title="Nenhum contrato disponível"
          description="Contratos enviados pela clínica aparecerão nesta área."
        />
      ) : (
        <div className="space-y-3">
          {mine.map((item) => (
            <Card key={item.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">{item.title}</p>
                  <p className="mt-1 text-sm text-muted">{item.description}</p>
                  <p className="mt-2 text-sm text-ink">{formatCurrency(item.value)}</p>
                  <p className="mt-1 text-xs text-muted">
                    Início {formatShortDate(item.startDate)}
                    {item.endDate ? ` · Fim ${formatShortDate(item.endDate)}` : ''}
                    {item.signedAt ? ` · Assinado em ${formatDate(item.signedAt)}` : ''}
                  </p>
                </div>
                <Badge tone={tone[item.status]}>{item.status}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
