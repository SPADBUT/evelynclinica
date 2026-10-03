# Roadmap — Evelyn Clínica Estética

Definições oficiais (canônicas):

| Versão | Nome |
|---|---|
| V1 | Operação da clínica |
| V2 | CRM + Auth + Consentimentos |
| V3 | Patient 360 + Clinical CRM |
| V4 | Financial Intelligence |
| V5 | Growth + WhatsApp + Automação + IA |

---

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

**Checkpoints oficiais da Fase A** (substituem a numeração A1–A8 anterior):

| Checkpoint | Escopo | Status |
|---|---|---|
| **A1** | Schema canônico (`organizations`…) + migrations + RLS | 🚧 |
| **A2** | Auth staff (Supabase) + RBAC runtime | ⏳ |
| **A3** | Frontend Supabase + Vercel (`base /`, SPA rewrite) | ⏳ |
| **A4** | Hardening + testes + docs raiz | ⏳ |

Schema canônico: `docs/SCHEMA_FOUNDATION_A1.md`.  
Modelo legado `clinics`/`profiles`: `supabase/legacy/a1_clinics_superseded/` (não aplicável).  
PR #6 (Auth sobre clinics): **superseded** — `docs/PR6_SUPERSEDED.md`.

| Módulo posterior (fora da foundation mínima A1) | Status |
|---|---|
| Clinical records / treatments / products / photos / documents | ⏳ pós-A1 |
| Secure Links + Storage + Edge Functions | ⏳ pós-foundation |
| Patient 360 (produto completo) | ⏳ pós-fundação |
| CRM clínico/comercial (evolução) | ⏳ pós-fundação |

Deploy:

| Target | Papel |
|---|---|
| Vercel (`evelynclinica.vercel.app`) | V3 produção — Supabase Auth |
| GitHub Pages (`/evelynclinica/`) | Demo V2 — localStorage (não migrar nesta fase) |

Escopo funcional da V3 **não** inclui financeiro (isso é V4) nem WhatsApp/IA (isso é V5).

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
3. **Evolutivo** — V1 local → V2 CRM/auth → V3 Patient 360 / Clinical CRM → V4 Financial Intelligence → V5 Growth.
4. **LGPD by design** — consentimento, minimização, RLS e trilha de auditoria.
