import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from '../src/App'
import { Modal } from '../src/components/ui/Modal'

async function submitLogin(email: string, password: string) {
  fireEvent.change(screen.getByPlaceholderText('seu@email.com'), { target: { value: email } })
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
}

describe('modal layout', () => {
  afterEach(() => {
    cleanup()
    document.body.style.overflow = ''
    localStorage.clear()
  })

  it('keeps the title outside the scrolling body and locks the page', () => {
    const onClose = () => {}
    render(
      <Modal open title="Novo paciente" onClose={onClose} wide>
        <label>
          Nome completo
          <input aria-label="Nome completo" />
        </label>
        <button type="button">Salvar</button>
      </Modal>,
    )

    const dialog = screen.getByRole('dialog')
    const title = screen.getByRole('heading', { name: 'Novo paciente' })
    const scroller = dialog.querySelector('.overflow-y-auto')

    expect(dialog.className).toContain('max-h-full')
    expect(dialog.className).toContain('min-h-0')
    expect(dialog.className).toContain('overflow-hidden')
    expect(dialog.className).not.toContain('items-center')
    expect(scroller).toBeTruthy()
    expect(scroller?.contains(title)).toBe(false)
    expect(scroller?.contains(screen.getByRole('button', { name: 'Salvar' }))).toBe(true)
    expect(scroller?.contains(screen.getByLabelText('Nome completo'))).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('opens the V2 patient and budget forms with the shared modal', async () => {
    localStorage.clear()
    render(<App />)
    await submitLogin('evelyn@clinica.com', 'evelyn123')
    expect(await screen.findByText('Bom atendimento, Evelyn')).toBeTruthy()

    fireEvent.click(screen.getByRole('link', { name: 'Prontuários' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Novo paciente' }))
    expect(await screen.findByRole('heading', { name: 'Novo paciente' })).toBeTruthy()
    expect(screen.getByText('Nome completo')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeTruthy()
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('heading', { name: 'Novo paciente' })).toBeNull()

    fireEvent.click(screen.getByRole('link', { name: 'Orçamentos' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Novo orçamento' }))
    expect(await screen.findByRole('heading', { name: 'Novo orçamento' })).toBeTruthy()
    expect(screen.getByText('Paciente')).toBeTruthy()
    expect(screen.getByText('Título')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Salvar orçamento' })).toBeTruthy()
    const dialog = screen.getByRole('dialog')
    const scroller = dialog.querySelector('.overflow-y-auto')
    expect(scroller?.contains(screen.getByRole('heading', { name: 'Novo orçamento' }))).toBe(false)
    expect(scroller?.contains(screen.getByRole('button', { name: 'Salvar orçamento' }))).toBe(true)
  })
})
