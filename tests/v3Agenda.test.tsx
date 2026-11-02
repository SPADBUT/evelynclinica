import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseAuthProvider } from '../src/context/SupabaseAuthContext'
import { V3TenantProvider } from '../src/context/V3TenantContext'
import { AppointmentRepositoryError } from '../src/lib/appointmentRepositoryError'
import { resetSupabaseClientForTests } from '../src/lib/supabase'
import { V3AgendaPage } from '../src/pages/v3/V3AgendaPage'
import { V3AgendaRoute } from '../src/v3/V3AgendaRoutes'
import {
  createAppointment,
  listActiveProcedures,
  listAgendaDay,
  listBookableProfessionals,
  transitionAppointment,
} from '../src/services/appointmentRepository'
import { listPatients } from '../src/services/patientRepository'
import type { V3Appointment } from '../src/types/appointment'
import { Routes, Route } from 'react-router-dom'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

vi.mock('../src/services/appointmentRepository', () => ({
  listAgendaDay: vi.fn(),
  listPatientAppointments: vi.fn(),
  listBookableProfessionals: vi.fn(),
  listActiveProcedures: vi.fn(),
  createAppointment: vi.fn(),
  updateAppointment: vi.fn(),
  transitionAppointment: vi.fn(),
}))

vi.mock('../src/services/patientRepository', () => ({
  listPatients: vi.fn(),
  getPatientById: vi.fn(),
  createPatient: vi.fn(),
  updatePatient: vi.fn(),
  softDeletePatient: vi.fn(),
}))

function appointment(): V3Appointment {
  return {
    id: 'appointment-1',
    clinicId: 'clinic-a',
    patientId: 'patient-1',
    patientName: 'Paciente Sintetica',
    professionalId: 'pro-1',
    professionalName: 'Profissional Sintetico',
    procedureId: null,
    title: 'Avaliacao sintetica',
    procedureName: 'Procedimento sintetico',
    startsAt: '2026-10-10T13:00:00.000Z',
    endsAt: '2026-10-10T14:00:00.000Z',
    status: 'scheduled',
    notes: 'nota operacional',
    createdBy: 'user-1',
    createdAt: '2026-10-10T12:00:00.000Z',
    updatedAt: '2026-10-10T12:00:00.000Z',
  }
}

function installClient() {
  const auth = {
    getSession: vi.fn().mockResolvedValue({
      data: { session: { access_token: 'token', user: { id: 'user-1', email: 'staff@example.com' } } },
      error: null,
    }),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  }
  const from = vi.fn((table: string) => {
    const payload =
      table === 'profiles'
        ? { id: 'user-1', full_name: 'Staff', email: 'staff@example.com' }
        : table === 'clinic_memberships'
          ? [{ id: 'membership-1', clinic_id: 'clinic-a', user_id: 'user-1', role: 'admin', is_active: true }]
          : table === 'clinics'
            ? { id: 'clinic-a', name: 'Clinica', slug: 'clinica', timezone: 'America/Sao_Paulo' }
            : null
    const builder = {
      select: () => builder,
      eq: () => builder,
      maybeSingle: () => Promise.resolve({ data: Array.isArray(payload) ? null : payload, error: null }),
      then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve({ data: payload, error: null }).then(onFulfilled, onRejected),
    }
    return builder
  })
  vi.mocked(createClient).mockReturnValue({ auth, from } as unknown as SupabaseClient)
}

describe('V3 agenda screen', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_AUTH_ENABLED', 'true')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    resetSupabaseClientForTests()
    installClient()
    vi.mocked(listAgendaDay).mockResolvedValue({ ok: true, value: [appointment()] })
    vi.mocked(listPatients).mockResolvedValue({
      ok: true,
      value: [
        {
          id: 'patient-1',
          clinicId: 'clinic-a',
          fullName: 'Paciente Sintetica',
          email: null,
          phone: null,
          cpf: null,
          birthDate: null,
          gender: null,
          address: null,
          allergies: null,
          medications: null,
          notes: null,
          status: 'active',
          deletedAt: null,
          createdAt: '2026-10-01T00:00:00.000Z',
          updatedAt: '2026-10-01T00:00:00.000Z',
        },
      ],
    })
    vi.mocked(listBookableProfessionals).mockResolvedValue({
      ok: true,
      value: [{ userId: 'pro-1', fullName: 'Profissional Sintetico', role: 'professional' }],
    })
    vi.mocked(listActiveProcedures).mockResolvedValue({ ok: true, value: [] })
    vi.mocked(transitionAppointment).mockResolvedValue({
      ok: false,
      error: new AppointmentRepositoryError('conflict', 'Horário indisponível.'),
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
  })

  it('shows the Sao Paulo hour and keeps a conflict message free of other patients', async () => {
    render(
      <SupabaseAuthProvider>
        <V3TenantProvider>
          <MemoryRouter>
            <V3AgendaPage />
          </MemoryRouter>
        </V3TenantProvider>
      </SupabaseAuthProvider>,
    )
    expect(await screen.findByText(/10:00\s*[–-]\s*11:00/)).toBeTruthy()
    expect(screen.getByText('Paciente Sintetica')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Excluir' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Horário indisponível.')
    expect(screen.getByRole('alert').textContent).not.toContain('Paciente')
  })

  it('creates a slot without sending clinic or author fields', async () => {
    vi.mocked(createAppointment).mockResolvedValue({ ok: true, value: appointment() })
    render(
      <SupabaseAuthProvider>
        <V3TenantProvider>
          <MemoryRouter>
            <V3AgendaPage />
          </MemoryRouter>
        </V3TenantProvider>
      </SupabaseAuthProvider>,
    )
    const openForm = await screen.findByRole('button', { name: 'Novo horário' })
    await waitFor(() => {
      if ((openForm as HTMLButtonElement).disabled) throw new Error('agenda form still locked')
    })
    fireEvent.click(openForm)
    fireEvent.change(screen.getByLabelText('Paciente'), { target: { value: 'patient-1' } })
    fireEvent.change(screen.getByLabelText('Profissional'), { target: { value: 'pro-1' } })
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Retorno sintetico' } })
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-10-10' } })
    fireEvent.change(screen.getByLabelText('Início'), { target: { value: '10:00' } })
    fireEvent.change(screen.getByLabelText('Término'), { target: { value: '11:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar horário' }))
    expect(createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ activeClinicId: 'clinic-a' }),
      expect.objectContaining({
        patientId: 'patient-1',
        professionalId: 'pro-1',
        title: 'Retorno sintetico',
        startsAt: '2026-10-10T13:00:00.000Z',
        endsAt: '2026-10-10T14:00:00.000Z',
      }),
    )
    const input = vi.mocked(createAppointment).mock.calls[0]?.[1] as unknown as Record<string, unknown>
    expect(input).not.toHaveProperty('clinicId')
    expect(input).not.toHaveProperty('createdBy')
    expect(input).not.toHaveProperty('status')
  })
})

describe('V3 agenda route flag', () => {
  it('returns to the panel when the flag is off', () => {
    vi.stubEnv('VITE_SUPABASE_AUTH_ENABLED', 'false')
    render(
      <MemoryRouter initialEntries={['/v3/agenda']}>
        <Routes>
          <Route path="/" element={<p>Painel V2</p>} />
          <Route path="/v3/agenda" element={<V3AgendaRoute />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('Painel V2')).toBeTruthy()
    expect(screen.queryByText('Agenda clínica')).toBeNull()
  })
})
