# Roadmap — Evelyn Clínica Estética

## V1 — Operação da clínica ✅

Foco: operação do consultório (persistência local).

| Módulo | Status |
|---|---|
| Pacientes / prontuários | ✅ |
| Evoluções clínicas | ✅ |
| Agenda | ✅ |
| Fotos antes & depois | ✅ |
| Documentos / termos | ✅ |
| Contratos | ✅ |
| Orçamentos | ✅ |
| Dashboard do dia | ✅ |
| Persistência local | ✅ |

---

## V2 — CRM + Auth + Consentimentos ✅

Foco: relacionamento, autenticação local e assinatura digital.

| Módulo | Status |
|---|---|
| Autenticação interna (admin + assistente) | ✅ |
| Portal atual da paciente (login local) | ✅ |
| Consentimentos e assinatura digital | ✅ |
| CRM / pipeline (lead → avaliação → tratamento → manutenção) | ✅ |
| Interações (WhatsApp, e-mail, ligação) | ✅ |
| Tags em pacientes | ✅ |
| Reminders (retorno / validade de orçamento) | ✅ |
| Migração automática dos dados V1 | ✅ |

### Notas da V2

- Persistência em `localStorage` — adequada a demo / um dispositivo.
- Fotos em Base64 no navegador.
- Pacientes com login/senha local (substituído por Secure Links na V3).

---

## V3 — Patient 360 + Clinical CRM 🚧

Foco: backend real, prontuário longitudinal e CRM clínico/comercial seguro.

| Módulo | Status |
|---|---|
| PostgreSQL + migrations versionadas | 🚧 A1 |
| Multi-tenancy (`clinics` + `clinic_id`) | 🚧 A1 |
| Auth (equipe) + roles | ⏳ A2 |
| RLS e isolamento entre clínicas | ⏳ A2 |
| Data layer (services/repositórios) | ⏳ A3 |
| Storage privado + fotos | ⏳ A4 |
| Secure Links (paciente sem senha) | ⏳ A5 |
| Auditoria runtime | ⏳ A5 |
| Migração V2 → PostgreSQL | ⏳ A6 |
| Deploy SPA (Vercel) + deep links | ⏳ A7 |
| Patient 360 | ⏳ pós-fundação |
| CRM clínico/comercial (evolução) | ⏳ pós-fundação |
| Prontuário longitudinal + evoluções versionadas | 🚧 schema A1 / UI depois |
| Anamneses / documentos versionados | 🚧 schema A1 |
| Produtos / lotes / rastreabilidade | 🚧 schema A1 |
| Alertas / recorrência | 🚧 schema A1 / lógica depois |
| Testes de segurança + regressão | ⏳ A8 |

Fundação em fases **A1–A8** — ver `docs/V3_ARCHITECTURE.md`.

---

## V4 — Financial Intelligence

Foco: saúde financeira do negócio.

- Fluxo de caixa (entradas / saídas)
- Contas a pagar e receber
- Custos e margem por procedimento
- Preço / ROI
- LTV e CAC
- DRE gerencial e break-even
- Dashboard financeiro

---

## V5 — Growth + WhatsApp + Automação + IA

Foco: crescimento e inteligência comercial.

- WhatsApp
- Campanhas e automações
- Reativação / aniversário / follow-up
- IA e recomendações
- Inteligência comercial

---

## Princípios de produto

1. **Clínico primeiro** — prontuário e segurança do paciente acima de tudo.
2. **Elegante e simples** — UI limpa, sem parecer SaaS genérico.
3. **Evolutivo** — V1 local → V2 CRM/auth → V3 nuvem/prontuário → V4 financeiro → V5 growth.
4. **LGPD by design** — consentimento, minimização, RLS e trilha de auditoria.
