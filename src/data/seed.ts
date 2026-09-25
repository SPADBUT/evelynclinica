import { v4 as uuid } from 'uuid'
import type { ClinicData } from '../types'
import { todayISO } from '../lib/format'

const CONSENT_TEMPLATE = `TERMO DE CONSENTIMENTO INFORMADO

Eu, paciente abaixo identificado(a), declaro ter sido devidamente informado(a) sobre o procedimento estético proposto, seus benefícios, riscos, contraindicações e cuidados pós-procedimento.

Declaro que:
1. Tive oportunidade de esclarecer todas as dúvidas;
2. Autorizo a realização do procedimento e o registro fotográfico para acompanhamento clínico;
3. Comprometo-me a seguir as orientações pré e pós-procedimento;
4. Entendo que resultados podem variar conforme biotipo, hábitos e resposta individual.

Este documento é parte integrante do prontuário clínico.`

const CONTRACT_CLAUSES = `1. Objeto: prestação de serviços de biomedicina estética conforme plano acordado.
2. Valores e forma de pagamento conforme orçamento aprovado.
3. Cancelamentos com menos de 24h podem gerar taxa administrativa.
4. Fotografias clínicas são de uso exclusivo do prontuário, salvo autorização expressa.
5. Foro: comarca do local de atendimento.`

export function createSeedData(): ClinicData {
  const today = todayISO()
  const p1 = uuid()
  const p2 = uuid()
  const p3 = uuid()
  const pairId = uuid()

  return {
    patients: [
      {
        id: p1,
        name: 'Ana Beatriz Mendes',
        email: 'ana.mendes@email.com',
        phone: '11987654321',
        cpf: '123.456.789-00',
        birthDate: '1992-04-18',
        gender: 'Feminino',
        address: 'Av. Paulista, 1000 — São Paulo/SP',
        allergies: 'Nenhuma conhecida',
        medications: 'Anticoncepcional oral',
        notes: 'Preferência por horários matinais.',
        status: 'em_tratamento',
        createdAt: '2026-01-10T10:00:00.000Z',
        updatedAt: '2026-03-01T10:00:00.000Z',
      },
      {
        id: p2,
        name: 'Camila Rocha Santos',
        email: 'camila.rocha@email.com',
        phone: '11976543210',
        cpf: '987.654.321-00',
        birthDate: '1988-11-02',
        gender: 'Feminino',
        address: 'Rua Augusta, 450 — São Paulo/SP',
        allergies: 'Látex',
        medications: 'Nenhuma',
        notes: 'Histórico de melasma — evitar exposição solar.',
        status: 'ativo',
        createdAt: '2026-02-05T14:00:00.000Z',
        updatedAt: '2026-02-20T14:00:00.000Z',
      },
      {
        id: p3,
        name: 'Juliana Ferreira',
        email: 'juliana.ferreira@email.com',
        phone: '11965432109',
        cpf: '456.789.123-00',
        birthDate: '1995-07-25',
        gender: 'Feminino',
        address: 'Rua Oscar Freire, 200 — São Paulo/SP',
        allergies: 'Nenhuma',
        medications: 'Vitamina D',
        notes: 'Primeira avaliação estética.',
        status: 'ativo',
        createdAt: '2026-03-12T09:00:00.000Z',
        updatedAt: '2026-03-12T09:00:00.000Z',
      },
    ],
    records: [
      {
        id: uuid(),
        patientId: p1,
        date: '2026-02-15',
        procedure: 'Bioestimulador de colágeno — face',
        professional: 'Evelyn Preto Silva',
        anamnesis:
          'Paciente relata flacidez leve em terço médio. Sem contraindicações. Pele fototipo III.',
        evolution:
          'Aplicação de 2 seringas em pontos estratégicos. Boa tolerância, sem intercorrências.',
        productsUsed: 'Bioestimulador — 2 seringas',
        nextSteps: 'Retorno em 30 dias para avaliação e protocolo de manutenção.',
        createdAt: '2026-02-15T11:30:00.000Z',
      },
      {
        id: uuid(),
        patientId: p2,
        date: '2026-02-20',
        procedure: 'Peeling químico controlado',
        professional: 'Evelyn Preto Silva',
        anamnesis: 'Queixa de manchas e textura irregular. Alergia a látex — usar luvas sem látex.',
        evolution: 'Peeling realizado com boa resposta imediata. Orientado home care.',
        productsUsed: 'Ácido mandélico 30%',
        nextSteps: 'Sessão 2 em 21 dias. Fotoproteção rigorosa.',
        createdAt: '2026-02-20T16:00:00.000Z',
      },
    ],
    appointments: [
      {
        id: uuid(),
        patientId: p1,
        title: 'Retorno bioestimulador',
        procedure: 'Avaliação + retoque',
        date: today,
        startTime: '10:00',
        endTime: '11:00',
        status: 'confirmado',
        notes: 'Trazer fotos de acompanhamento.',
        createdAt: '2026-03-01T10:00:00.000Z',
      },
      {
        id: uuid(),
        patientId: p3,
        title: 'Avaliação inicial',
        procedure: 'Consulta de avaliação estética',
        date: today,
        startTime: '14:30',
        endTime: '15:30',
        status: 'agendado',
        notes: 'Primeira visita — preencher ficha completa.',
        createdAt: '2026-03-12T09:30:00.000Z',
      },
      {
        id: uuid(),
        patientId: p2,
        title: 'Peeling — sessão 2',
        procedure: 'Peeling químico',
        date: addDays(today, 2),
        startTime: '11:00',
        endTime: '12:00',
        status: 'agendado',
        notes: '',
        createdAt: '2026-03-01T10:00:00.000Z',
      },
    ],
    photos: [
      {
        id: uuid(),
        patientId: p1,
        procedure: 'Bioestimulador de colágeno',
        side: 'antes',
        takenAt: '2026-02-15',
        notes: 'Vista frontal — pré-procedimento',
        imageData: placeholderImage('Antes', '#8b5e66'),
        pairId,
        createdAt: '2026-02-15T11:00:00.000Z',
      },
      {
        id: uuid(),
        patientId: p1,
        procedure: 'Bioestimulador de colágeno',
        side: 'depois',
        takenAt: '2026-03-15',
        notes: 'Vista frontal — 30 dias',
        imageData: placeholderImage('Depois', '#5c3d45'),
        pairId,
        createdAt: '2026-03-15T11:00:00.000Z',
      },
    ],
    consents: [
      {
        id: uuid(),
        patientId: p1,
        title: 'Consentimento — Bioestimulador',
        procedure: 'Bioestimulador de colágeno',
        content: CONSENT_TEMPLATE,
        status: 'assinado',
        signedAt: '2026-02-15T10:45:00.000Z',
        signedBy: 'Ana Beatriz Mendes',
        createdAt: '2026-02-14T18:00:00.000Z',
      },
      {
        id: uuid(),
        patientId: p3,
        title: 'Consentimento — Avaliação e protocolo',
        procedure: 'Consulta de avaliação estética',
        content: CONSENT_TEMPLATE,
        status: 'enviado',
        createdAt: '2026-03-12T09:10:00.000Z',
      },
    ],
    contracts: [
      {
        id: uuid(),
        patientId: p1,
        title: 'Plano de Harmonização Facial — 3 sessões',
        description: 'Protocolo de bioestimulação com 3 sessões e retorno de avaliação.',
        value: 4800,
        startDate: '2026-02-15',
        endDate: '2026-05-15',
        status: 'assinado',
        clauses: CONTRACT_CLAUSES,
        createdAt: '2026-02-14T18:30:00.000Z',
      },
    ],
    budgets: [
      {
        id: uuid(),
        patientId: p2,
        title: 'Protocolo pele — peeling + home care',
        items: [
          {
            id: uuid(),
            description: 'Peeling químico (sessão)',
            quantity: 3,
            unitPrice: 450,
          },
          {
            id: uuid(),
            description: 'Kit home care fotoproteção',
            quantity: 1,
            unitPrice: 320,
          },
        ],
        discount: 100,
        notes: 'Condição especial para pacote de 3 sessões.',
        status: 'enviado',
        validUntil: addDays(today, 15),
        createdAt: '2026-03-01T12:00:00.000Z',
      },
      {
        id: uuid(),
        patientId: p3,
        title: 'Avaliação + toxina botulínica',
        items: [
          {
            id: uuid(),
            description: 'Consulta de avaliação',
            quantity: 1,
            unitPrice: 250,
          },
          {
            id: uuid(),
            description: 'Toxina botulínica (área superior)',
            quantity: 1,
            unitPrice: 1800,
          },
        ],
        discount: 0,
        notes: '',
        status: 'rascunho',
        validUntil: addDays(today, 30),
        createdAt: '2026-03-12T10:00:00.000Z',
      },
    ],
  }
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function placeholderImage(label: string, color: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
      <rect width="640" height="480" fill="${color}"/>
      <text x="320" y="240" text-anchor="middle" fill="#faf6f3" font-family="Georgia, serif" font-size="42">${label}</text>
      <text x="320" y="290" text-anchor="middle" fill="#e8cfc8" font-family="Arial, sans-serif" font-size="18">Foto clínica demonstrativa</text>
    </svg>
  `.trim()
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export { CONSENT_TEMPLATE, CONTRACT_CLAUSES }
