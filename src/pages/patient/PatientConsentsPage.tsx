import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useClinic } from '../../context/ClinicContext'
import { formatDate, formatShortDate } from '../../lib/format'
import { Badge, Card, EmptyState, PageHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import type { ConsentStatus } from '../../types'

const tone: Record<ConsentStatus, 'neutral' | 'info' | 'success' | 'warning'> = {
  rascunho: 'neutral',
  enviado: 'warning',
  assinado: 'success',
  expirado: 'info',
}

export function PatientConsentsPage() {
  const { user } = useAuth()
  const { consents } = useClinic()
  const mine = consents.filter((c) => c.patientId === user?.patientId && c.status !== 'rascunho')

  return (
    <div>
      <PageHeader
        title="Meus termos"
        subtitle="Leia e assine digitalmente os termos de consentimento liberados pela clínica."
      />

      {mine.length === 0 ? (
        <EmptyState
          title="Nenhum termo disponível"
          description="Quando a clínica enviar um termo para você, ele aparecerá aqui."
        />
      ) : (
        <div className="space-y-3">
          {mine.map((item) => (
            <Card key={item.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-ink">{item.title}</p>
                <p className="text-sm text-muted">{item.procedure}</p>
                <p className="mt-1 text-xs text-muted">
                  Liberado em {formatShortDate(item.createdAt)}
                  {item.signedAt ? ` · Assinado em ${formatDate(item.signedAt)}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={tone[item.status]}>{item.status}</Badge>
                {item.status === 'enviado' || item.status === 'expirado' ? (
                  <Link to={`/portal/termos/${item.id}`}>
                    <Button size="sm">Assinar</Button>
                  </Link>
                ) : (
                  <Link to={`/portal/termos/${item.id}`}>
                    <Button size="sm" variant="secondary">
                      Ver
                    </Button>
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
