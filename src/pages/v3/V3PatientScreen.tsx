import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { V3TenantContextValue } from '../../context/V3TenantContext'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/Card'

export function V3PatientScreen({
  tenant,
  children,
}: {
  tenant: V3TenantContextValue
  children: ReactNode
}) {
  if (tenant.status === 'loading') {
    return <p className="text-sm text-muted">Carregando pacientes…</p>
  }

  if (tenant.status === 'unauthenticated') {
    return (
      <EmptyState
        title="Sessão necessária"
        description="Entre novamente para ver as pacientes da clínica ativa."
        action={
          <Link to="/login" className="text-sm text-plum underline">
            Ir para o login
          </Link>
        }
      />
    )
  }

  if (tenant.status === 'authenticated_without_membership') {
    return (
      <EmptyState
        title="Sem clínica"
        description="Sua conta não participa de nenhuma clínica."
      />
    )
  }

  if (tenant.status === 'authenticated_needs_clinic_selection') {
    return (
      <EmptyState
        title="Selecione a clínica"
        description="Há mais de uma clínica ativa. A lista de pacientes usa somente a clínica escolhida."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            {tenant.memberships.map((membership, index) => (
              <Button
                key={membership.id}
                variant="secondary"
                onClick={() => tenant.selectClinic(membership.clinicId)}
              >
                Continuar como {membership.role}
                {tenant.memberships.filter((item) => item.role === membership.role).length > 1
                  ? ` ${index + 1}`
                  : ''}
              </Button>
            ))}
          </div>
        }
      />
    )
  }

  if (tenant.status === 'error') {
    return (
      <EmptyState
        title="Não foi possível abrir a clínica"
        description={tenant.error?.message ?? 'Erro ao carregar a clínica.'}
      />
    )
  }

  if (!tenant.can('patients.manage')) {
    return (
      <EmptyState
        title="Acesso restrito"
        description="O papel ativo não gerencia pacientes."
      />
    )
  }

  return children
}
