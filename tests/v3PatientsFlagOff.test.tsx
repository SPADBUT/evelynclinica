import { createClient } from '@supabase/supabase-js'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { V3PatientListRoute } from '../src/v3/V3PatientRoutes'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ auth: {}, from: vi.fn() })),
}))

async function submitLogin(email: string, password: string) {
  fireEvent.change(screen.getByPlaceholderText('seu@email.com'), { target: { value: email } })
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
}

describe('V3 patients stay out of the default V2 path', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('does not mount the V3 patient route when the flag is off', () => {
    render(
      <MemoryRouter initialEntries={['/v3/patients']}>
        <Routes>
          <Route path="/" element={<p>Painel V2</p>} />
          <Route path="/v3/patients" element={<V3PatientListRoute />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('Painel V2')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Nova paciente' })).toBeNull()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('keeps the V2 patient screen and hides the V3 entry', async () => {
    render(<App />)
    await submitLogin('evelyn@clinica.com', 'evelyn123')
    expect(await screen.findByText('Bom atendimento, Evelyn')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Pacientes' })).toBeNull()
    fireEvent.click(screen.getByRole('link', { name: 'Prontuários' }))
    expect(await screen.findByRole('heading', { name: 'Prontuários' })).toBeTruthy()
    expect(screen.queryByText('Nova paciente')).toBeNull()
    expect(createClient).not.toHaveBeenCalled()
  })
})
