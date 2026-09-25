import { format, parseISO, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDate(value?: string, pattern = "dd 'de' MMMM 'de' yyyy"): string {
  if (!value) return '—'
  const date = parseISO(value)
  if (!isValid(date)) return value
  return format(date, pattern, { locale: ptBR })
}

export function formatShortDate(value?: string): string {
  return formatDate(value, 'dd/MM/yyyy')
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return value
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function budgetTotal(
  items: { quantity: number; unitPrice: number }[],
  discount = 0,
): number {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  return Math.max(0, subtotal - discount)
}

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}
