# Evelyn Clínica — Auditoria V2 e Arquitetura V3

> **Status:** proposta para aprovação — **sem implementação**.  
> **Data:** 2026-09-26  
> **Escopo:** auditoria da main (V2) + arquitetura alvo para Clinical CRM / Patient 360.

---

## Sumário executivo

A V2 é um **protótipo SPA sólido** (React 19 + Vite + TypeScript) com domínio clínico e CRM bem modelados no frontend, mas com **persistência, autenticação e autorização incompatíveis com produção clínica / LGPD**.

A recomendação é:

1. **Manter** o frontend React/Vite/Tailwind e a linguagem de domínio (pacientes, agenda, termos, CRM).
2. **Substituir** `localStorage` por **PostgreSQL + API** (recomendado: **Supabase**).
3. **Substituir** login de paciente por **Secure Links** (token opaco, expirável, revogável).
4. **Hospedar** a SPA em ambiente com rewrite real (Vercel / Cloudflare / domínio próprio) — GitHub Pages só como demo.
5. **V3 = Clinical CRM / Patient 360**; financeiro fica na **V4**.

---

## 1. Auditoria da arquitetura atual (V2)

### 1.1 Stack e deploy

| Item | Estado atual |
|---|---|
| React 19 + TypeScript + Vite 8 | ✅ |
| Tailwind CSS v4 | ✅ |
| React Router 7 (`BrowserRouter`, `basename=/evelynclinica`) | ✅ |
| Persistência | `localStorage` (`evelyn-clinic-v2`) |
| Sessão | `localStorage` (`evelyn-clinic-session-v2`) |
| Auth | SHA-256 + salt no cliente (`src/lib/auth.ts`) |
| Deploy | GitHub Pages + Actions; `dist/404.html` = cópia do `index.html` |
| Domínio | `https://spadbut.github.io/evelynclinica/` |
| Tamanho aproximado | ~5k linhas em `src/` |

### 1.2 Mapa de pastas

```
src/
├── App.tsx                 # rotas
├── main.tsx
├── index.css
├── types/index.ts          # modelo de domínio V2
├── lib/
│   ├── auth.ts             # hash/verify senha (Web Crypto)
│   ├── storage.ts          # load/save/migrate/reset localStorage
│   └── format.ts           # data, moeda, telefone
├── data/seed.ts            # demo + templates
├── context/
│   ├── AuthContext.tsx     # login/logout/sessão
│   └── ClinicContext.tsx   # CRUD monolítico de toda a clínica
├── components/
│   ├── RequireAuth.tsx     # RequireStaff / RequirePatient
│   ├── SignaturePad.tsx    # canvas de assinatura
│   ├── layout/             # AppLayout, PatientLayout
│   └── ui/                 # Button, Card, Field, Modal
└── pages/
    ├── LoginPage, DashboardPage, CrmPage
    ├── PatientsPage, PatientDetailPage
    ├── AgendaPage, PhotosPage
    ├── ConsentsPage, ContractsPage, BudgetsPage
    └── patient/            # portal: termos, assinatura, contratos
```

### 1.3 Rotas

| Rota | Guard | Página |
|---|---|---|
| `/login` | público | Login |
| `/` | staff | Dashboard |
| `/crm` | staff | CRM (leads, interações, lembretes) |
| `/pacientes` | staff | Lista de pacientes |
| `/pacientes/:id` | staff | Detalhe + evoluções |
| `/agenda` | staff | Agenda |
| `/fotos` | staff | Antes & depois |
| `/termos` | staff | Consentimentos + geração de acesso |
| `/contratos` | staff | Contratos |
| `/orcamentos` | staff | Orçamentos |
| `/portal` | paciente | Meus termos |
| `/portal/termos/:id` | paciente | Assinar termo |
| `/portal/contratos` | paciente | Contratos |
| `*` | — | redirect `/login` |

**Não existem** rotas `/secure/...` na V2.

### 1.4 Contexts

| Context | Responsabilidade | Observação |
|---|---|---|
| `AuthContext` | sessão, login, logout, flags `isStaff` / `isPatient` | Sessão sem expiração; sem refresh token |
| `ClinicContext` | **todo** o estado e mutações da clínica (~520 linhas) | God-object; qualquer staff lê/escreve tudo |

### 1.5 Tipos / domínio

| Tipo | Uso | Limitações para V3 |
|---|---|---|
| `Patient` | cadastro + tags | Sem segmentos estruturados; tags livres |
| `MedicalRecordEntry` | evolução clínica | Texto livre; `productsUsed: string`; sem versionamento |
| `Appointment` | agenda | Sem confirmação via link; sem vínculo a sessão de tratamento |
| `PhotoRecord` | fotos | `imageData` base64; `pairId` opcional |
| `ConsentForm` | termos | Assinatura + UA; sem token público; status `expirado` sem job |
| `Contract` | contratos | Assinatura staff-side; portal só leitura |
| `Budget` / `BudgetItem` | orçamentos | Sem aceite pela paciente via link |
| `Lead` | pipeline CRM | Paralelo a paciente; conversão frágil |
| `Interaction` | histórico de contato | Manual; sem canal WhatsApp real |
| `Reminder` | lembretes | Local; sem automação |
| `AuthUser` | usuários | Roles sem permissões granulares |

### 1.6 Storage

- Chave V2: `evelyn-clinic-v2`
- Migração V1 → V2: lê `evelyn-clinic-v1`, mescla com seed (users/leads novos)
- Blob JSON único com **todos** os dados (inclui hashes, CPF, fotos base64, assinaturas)
- Quota do browser (~5–10 MB) será estourada com fotos reais
- Sem sync multi-dispositivo; sem backup; sem isolamento por usuário

### 1.7 Autenticação e perfis

- Roles: `admin` \| `assistente` \| `paciente`
- Staff = admin **ou** assistente (mesmo acesso a tudo)
- Paciente: login/senha gerados pela clínica (`ensurePatientAccess`)
- Hash: SHA-256(`salt:password`) — **não** é Argon2/bcrypt; hashes ficam no `localStorage`
- Sessão: JSON em `localStorage` sem TTL, sem rotação, sem httpOnly

### 1.8 Módulos funcionais — estado real

| Módulo | Status V2 | Qualidade |
|---|---|---|
| CRM pipeline | ✅ | Kanban simples; leads ≠ pacientes |
| Interações | ✅ | Registro manual WhatsApp/e-mail/ligação |
| Consentimentos | ✅ | Fluxo rascunho → enviado → assinado |
| Assinatura | ✅ | Canvas + nome + aceite + user-agent |
| Portal paciente | ✅ | Login obrigatório |
| Agenda | ✅ | CRUD + status |
| Prontuário / evolução | ✅ (básico) | Entrada plana, editável, sem versão |
| Fotos | ✅ (protótipo) | Base64 no storage |
| Orçamentos | ✅ | Sem aceite paciente |
| Contratos | ✅ | Assinatura incompleta no portal |
| Produto / lote | ❌ | Só texto em `productsUsed` |
| Anamnese estruturada | ❌ | Campo texto em evolução |
| Secure links | ❌ | — |
| Audit logs | ❌ | — |
| Automações | ❌ | — |
| RBAC fino | ❌ | Roles decorativos |

### 1.9 Decisão por artefato: manter / refatorar / substituir / migrar

| Artefato | Decisão | Motivo |
|---|---|---|
| UI / design system (Button, Card, Field, Modal, layouts) | **Manter** | Identidade visual e DX boas |
| Páginas de listagem/CRUD (Agenda, Pacientes, CRM, Orçamentos) | **Refatorar** | Separar UI de data layer; conectar API |
| `SignaturePad` | **Manter** | Reaproveitável em secure links |
| Tipos de domínio (`Patient`, `Appointment`, stages CRM…) | **Migrar** → schema SQL | Conceitos corretos; faltam relações |
| `ClinicContext` monolítico | **Substituir** | Por hooks/services + React Query (ou similar) |
| `AuthContext` local | **Substituir** | Auth server-side (staff); paciente via token |
| `lib/auth.ts` (SHA-256 client) | **Substituir** | Hash no servidor (Argon2id) |
| `lib/storage.ts` / localStorage | **Substituir** | Banco + storage de objetos |
| Login de paciente | **Substituir** | Secure Links (sem senha) |
| `MedicalRecordEntry` flat | **Refatorar** | Atendimento → procedimento → evolução versionada |
| Fotos base64 | **Substituir** | Object storage privado + signed URLs |
| `productsUsed` string | **Substituir** | `products` + `product_batches` + usages |
| Seed / demo | **Manter** (dev) | Seed SQL + fixtures |
| GitHub Pages como prod clínica | **Substituir** | Host com rewrite + backend |
| Fallback `404.html` | **Manter** só enquanto Pages for demo | Insuficiente para WhatsApp/prod |
| ROADMAP V3 = financeiro | **Substituir** | V3 = Patient 360 |
| Portal `/portal` com login | **Migrar / reduzir** | Staff portal opcional; paciente = `/secure/*` |

---

## 2. Problemas encontrados

### Críticos (bloqueiam produção clínica)

1. **Dados clínicos no browser** — CPF, prontuário, fotos, assinaturas, hashes no `localStorage`.
2. **Sem criptografia em repouso / em trânsito controlada** — HTTPS do Pages ajuda, mas o dado fica no disco do cliente.
3. **Auth inadequada** — SHA-256 client-side; sessão sem expiração; sem MFA; hashes dumpáveis.
4. **Sem RBAC real** — assistente = admin; qualquer staff apaga prontuário/paciente.
5. **Sem audit log** — impossível provar quem leu/alterou prontuário (exigência LGPD / boa prática clínica).
6. **Fotos em Base64** — estoura quota; sem CDN; sem controle de acesso por arquivo.
7. **Paciente precisa de login/senha** — fricção alta para WhatsApp; senhas compartilhadas por staff.

### Altos

8. **Prontuário não versionado** — edição sobrescreve histórico clínico.
9. **Produto/lote inexistente** — não responde “qual lote na Maria?” / “lote ABC em quais pacientes?”.
10. **IDOR conceitual** — no cliente, filtros por `patientId`; no mesmo storage está **tudo**. Em API futura, se repetir o padrão sem RLS/policies, vira IDOR real.
11. **Consentimento “enviado” sem canal** — status muda, mas não há link/token/entrega.
12. **Roadmap desatualizado** — V3 documentada como financeira.

### Médios

13. **SPA deep links no GitHub Pages** — há `404.html` fallback (bom para demo), mas:
    - resposta HTTP ainda pode ser **404**;
    - SEO/analytics/WhatsApp previews podem se comportar mal;
    - não há controle de headers de segurança customizados.
14. **`ClinicContext` god-object** — difícil testar, escalar e separar bounded contexts.
15. **Leads vs pacientes duplicados** — risco de dados divergentes na conversão.
16. **Status `expirado` em consent/budget** sem job ou regra automática.
17. **Sem soft delete** — exclusão física perde trilha clínica.
18. **UUIDs regenerados no seed** — cada “Restaurar demo” muda IDs (ok p/ demo; ruim p/ scripts).

### Baixos / dívida

19. Contratos no portal só leitura; assinatura de contrato incompleta.
20. Sem testes automatizados.
21. Sem camada de API/adapters — UI acoplada ao storage.

---

## 3. Arquitetura recomendada (visão)

```
┌─────────────────────────────────────────────────────────────────┐
│  Canais                                                          │
│  Staff App (React) │ Paciente Secure Links │ WhatsApp (futuro)  │
└──────────────┬───────────────┬─────────────────────┬────────────┘
               │               │                     │
               ▼               ▼                     ▼
┌──────────────────┐  ┌────────────────┐  ┌──────────────────────┐
│  Hosting SPA     │  │  Edge / API    │  │  Webhook adapter     │
│  (Vercel/CF)     │  │  (Supabase     │  │  (Edge Function)     │
│  rewrite /*→idx  │  │   + Functions) │  │                      │
└────────┬─────────┘  └────────┬───────┘  └──────────┬───────────┘
         │                     │                     │
         │              ┌──────▼─────────────────────▼──┐
         │              │  Auth (staff JWT)              │
         │              │  Secure Link validator         │
         │              │  RBAC + RLS policies           │
         │              │  Audit writer                  │
         │              └──────────────┬─────────────────┘
         │                             │
         │              ┌──────────────▼─────────────────┐
         │              │  PostgreSQL (dados clínicos)   │
         │              │  Storage privado (fotos/docs)  │
         │              │  Queue/jobs (expiry, automations)│
         │              └────────────────────────────────┘
```

### Princípios

1. **Clínico primeiro** — prontuário versionado, auditável, com controle de acesso.
2. **Paciente sem senha** — ações transacionais via Secure Link.
3. **Zero trust no cliente** — o browser nunca é fonte da verdade.
4. **RLS + autorização por recurso** — defesa em profundidade contra IDOR.
5. **Evolutivo** — V3 clínica; V4 financeiro reutiliza as mesmas entidades de paciente/procedimento/orçamento.
6. **WhatsApp-ready** — eventos de domínio (`secure_link.opened`, `quote.accepted`…) alimentam timeline e automações.

---

## 4. Stack recomendada

### Decisão: **Supabase (PostgreSQL + Auth + Storage + Edge Functions)**

| Critério | Avaliação |
|---|---|
| LGPD / dados sensíveis | PostgreSQL + RLS + Storage privado; hospedar em região compatível (preferir EU ou BR quando disponível); DPA Supabase; processo interno de retenção/exclusão |
| Auth staff | Supabase Auth (e-mail/senha + opcional MFA); roles em `app_metadata` / tabela `users`+`roles` |
| RBAC | Policies RLS por role + claims; funções `has_permission()` |
| Storage privado | Buckets privados; **signed URLs** de curta duração |
| Audit logs | Triggers SQL + tabela `audit_logs`; Edge Function para leituras sensíveis |
| Custo | Adequado para clínica single-tenant / few users; sobe com storage de fotos |
| Simplicidade | Menos ops que API própria no início; schema SQL explícito |
| Escalabilidade | Suficiente para V3–V5 de uma clínica; multi-clínica depois com `organization_id` |
| WhatsApp futuro | Edge Function recebe webhook → cria `interactions` / dispara `secure_links` |

### Alternativa (se rejeitar BaaS)

**PostgreSQL (Neon/RDS) + API própria (Hono/Fastify/Nest) + S3-compatible (R2/S3) + Auth (Lucia/Auth.js ou Better Auth)**

Escolher se: necessidade forte de controle jurídico/infra própria, orçamento de engenharia maior, ou compliance que exija VPC dedicada desde o dia 1.

### Frontend (manter)

- React 19 + TypeScript + Vite + Tailwind + React Router
- Adicionar: cliente de dados (`@supabase/supabase-js` **ou** fetch tipado), cache (`TanStack Query`), validação (`Zod`)
- Remover dependência de `localStorage` como fonte de verdade

### Hospedagem

| Fase | Onde | Motivo |
|---|---|---|
| Demo atual | GitHub Pages | OK para protótipo |
| V3 produção | **Vercel ou Cloudflare Pages** + domínio próprio | Rewrite SPA real, headers de segurança, env secrets |
| API/DB | Supabase cloud | Auth + DB + Storage + Functions |

**Não** recomendamos HashRouter como arquitetura definitiva (URLs `#/...` ruins para WhatsApp/confiança do paciente).

---

## 5. Modelo de dados (V3)

> Notação: `1—*`, `*—1`, `*—*`. Campos de auditoria padrão em quase todas as tabelas: `created_at`, `updated_at`, `created_by`, `deleted_at` (soft delete).

### 5.1 Diagrama de relacionamentos (texto)

```
organizations (1) ──* users
organizations (1) ──* patients
users *──* roles (via user_roles)
roles (1) ──* role_permissions

patients (1) ──* appointments
patients (1) ──* clinical_records
patients (1) ──* treatments
patients (1) ──* photos
patients (1) ──* documents
patients (1) ──* quotes
patients (1) ──* interactions
patients (1) ──* anamnesis_responses
patients *──* tags (via patient_tags)
patients *──* segments (via patient_segments)

treatments (1) ──* treatment_sessions
treatment_sessions (1) ──* procedures (ou procedure_executions)
procedures (1) ──* treatment_product_usages
procedures (1) ──* photos
procedures *──1 clinical_records (evolução)

clinical_records (1) ──* clinical_record_versions

products (1) ──* product_batches
product_batches (1) ──* treatment_product_usages

anamnesis_templates (1) ──* anamnesis_versions
anamnesis_versions (1) ──* anamnesis_responses

document_templates (1) ──* document_versions
documents *──1 document_versions (conteúdo congelado)
documents (1) ──* document_signatures
documents (1) ──* secure_links

quotes (1) ──* quote_items
quotes (1) ──* secure_links

appointments (1) ──* secure_links

secure_links → (polimórfico) resource_type + resource_id
messages ⊆ interactions (ou tabela irmã)
alerts, tasks → patient / appointment / quote
automation_rules (1) ──* automation_runs
audit_logs → actor + resource + action
```

### 5.2 Entidades (campos essenciais)

#### Identidade e acesso

```text
organizations
  id, name, slug, timezone, settings_json

users
  id, organization_id, email, name, phone,
  auth_provider_id, active, last_login_at

roles
  id, organization_id, code (admin|clinician|assistant|viewer), name

user_roles
  user_id, role_id

permissions
  code (patients.read, records.write, photos.read, ...)

role_permissions
  role_id, permission_id
```

> Paciente **não** é `users` com senha. Paciente é `patients` + ações via `secure_links`.

#### Pacientes e CRM

```text
patients
  id, organization_id, name, email, phone, cpf_hash, cpf_encrypted,
  birth_date, gender, address, allergies, medications, notes,
  status (ativo|inativo|em_tratamento), source, lead_stage?,
  created_at, updated_at, deleted_at

patient_tags
  patient_id, tag (text) | tag_id

tags
  id, organization_id, name, color

patient_segments
  patient_id, segment_id

segments
  id, organization_id, name, rules_json   -- V3 simples; V5 AI

-- Leads V2 podem migrar para patients com stage comercial
-- ou tabela leads residual até unificação
```

#### Agenda

```text
appointments
  id, organization_id, patient_id, title, procedure_name,
  starts_at, ends_at, status (agendado|confirmado|realizado|cancelado|faltou),
  notes, confirmed_at, confirmation_channel, treatment_session_id?
```

#### Prontuário longitudinal

```text
treatments
  id, organization_id, patient_id, name, status, started_at, ended_at, notes

treatment_sessions
  id, treatment_id, appointment_id?, session_date, professional_user_id, notes

procedures
  id, treatment_session_id, name, area, notes, performed_at

clinical_records
  id, organization_id, patient_id, treatment_session_id?, procedure_id?,
  record_type (evolucao|anamnese|intercorrencia|alta),
  current_version_id, professional_user_id

clinical_record_versions
  id, clinical_record_id, version_number,
  anamnesis_text, evolution_text, next_steps,
  snapshot_json,   -- estado completo no momento
  created_by, created_at, change_reason
```

**Fluxo clínico:**  
`Paciente → Treatment → Session (Atendimento) → Procedure → Evolution (versionada) → Product usage → Photos → Documents → próximo Appointment`

#### Produto / lote (rastreabilidade)

```text
products
  id, organization_id, name, manufacturer, sku, unit, active

product_batches
  id, product_id, lot_code, expires_at, received_at, quantity_initial, quantity_remaining, notes

treatment_product_usages
  id, procedure_id, patient_id,   -- denormalizado para query bidirecional
  product_id, product_batch_id,
  -- SNAPSHOT imutável:
  product_name_snapshot, manufacturer_snapshot, lot_code_snapshot, expires_at_snapshot,
  quantity_used, unit, used_at, recorded_by
```

Consultas alvo:

- lote da paciente Maria → `treatment_product_usages WHERE patient_id = ?`
- pacientes do lote ABC123 → `WHERE lot_code_snapshot = 'ABC123' OR product_batch_id = ?`

#### Fotos

```text
photos
  id, organization_id, patient_id, procedure_id?, treatment_session_id?,
  side (antes|depois), pair_id, taken_at, notes,
  storage_path, mime_type, bytes, checksum,
  created_by, deleted_at
```

#### Anamnese

```text
anamnesis_templates
  id, organization_id, name, active

anamnesis_versions
  id, template_id, version_number, schema_json, published_at

anamnesis_responses
  id, patient_id, template_version_id, secure_link_id?,
  answers_json, submitted_at, ip_hash, user_agent
```

#### Documentos / assinaturas / secure links

```text
document_templates
  id, organization_id, name, kind (consent|contract|other)

document_versions
  id, template_id, version_number, title, body_markdown, published_at

documents
  id, organization_id, patient_id, kind, template_version_id,
  title, body_snapshot, status (draft|sent|signed|expired|revoked),
  procedure_name, related_appointment_id?

document_signatures
  id, document_id, signer_name, signed_at,
  signature_storage_path,   -- NÃO base64 eterno no DB se grande
  ip_hash, user_agent, evidence_json

secure_links
  id, organization_id,
  token_hash,               -- NUNCA o token em claro
  action_type (anamnesis|consent|quote|appointment|followup),
  resource_type, resource_id,
  patient_id,
  expires_at, revoked_at, used_at, max_uses, use_count,
  created_by, last_opened_at, metadata_json
```

Rotas conceituais:

- `/secure/anamnesis/{token}`
- `/secure/consent/{token}`
- `/secure/quote/{token}`
- `/secure/appointment/{token}`

#### Orçamentos

```text
quotes
  id, organization_id, patient_id, title, status,
  discount, notes, valid_until, accepted_at, rejected_at

quote_items
  id, quote_id, description, quantity, unit_price, procedure_code?
```

#### Interações, mensagens, alertas, tarefas

```text
interactions
  id, organization_id, patient_id, channel (whatsapp|email|phone|system|other),
  direction (inbound|outbound), summary, payload_json,
  occurred_at, created_by

messages
  id, interaction_id?, patient_id, channel, external_id,
  body, status, sent_at, delivered_at, read_at

alerts
  id, organization_id, patient_id?, kind, title, due_at, status, payload_json

tasks
  id, organization_id, assignee_user_id, patient_id?, title, due_at, status
```

#### Automações e auditoria

```text
automation_rules
  id, organization_id, name, trigger_event, conditions_json, actions_json, active

automation_runs
  id, rule_id, trigger_event, status, started_at, finished_at, error, context_json

audit_logs
  id, organization_id, actor_user_id?, actor_type (user|patient_link|system),
  action, resource_type, resource_id, patient_id?,
  ip_hash, user_agent, before_json, after_json, created_at
```

### 5.3 Índices críticos

- `treatment_product_usages (patient_id)`, `(product_batch_id)`, `(lot_code_snapshot)`
- `secure_links (token_hash)` UNIQUE
- `audit_logs (patient_id, created_at)`, `(resource_type, resource_id)`
- `appointments (organization_id, starts_at)`
- `clinical_records (patient_id)`

---

## 6. Estratégia de migração do localStorage

### Fase 0 — Congelar protótipo

- V2 em Pages permanece como demo.
- Export JSON (`exportClinicData` já existe) como artefato de migração.

### Fase 1 — Export / ETL

1. Staff exporta `evelyn-clinic-v2` (JSON).
2. Script de migração (one-shot):
   - mapeia `patients`, `appointments`, `consents` → `documents`, `budgets` → `quotes`, `records` → `clinical_records` + 1ª versão;
   - `productsUsed` texto → usage **não estruturado** (flag `legacy_text`) até curadoria manual de lotes;
   - fotos base64 → upload Storage + `photos.storage_path`;
   - users staff → Supabase Auth + `users`;
   - users paciente → **não** migrar senha; gerar secure links sob demanda.
3. Validação: contagens, checksums, amostragem de prontuários.

### Fase 2 — Dual-run (opcional, curto)

- App lê API; feature flag `USE_API`.
- Escrita só na API (evitar split-brain).

### Fase 3 — Cutover

- Domínio aponta para host V3.
- localStorage vira somente cache UI efêmero (ou some).
- Manter export de emergência nos primeiros 30 dias.

### Regras

- Nunca migrar senhas SHA-256 locais como válidas em produção.
- Assinaturas: preservar imagem + metadados em Storage / `document_signatures`.
- Soft-delete preferível a hard-delete pós-migração.

---

## 7. Estratégia de routing / deep links

### Situação atual

- `BrowserRouter` + `basename=/evelynclinica`
- CI já faz `cp dist/index.html dist/404.html` — mitiga 404 em refresh no Pages
- Limitações: status 404, headers, preview cards, confiança em links WhatsApp

### Avaliação das opções

| Opção | Prós | Contras | Veredito |
|---|---|---|---|
| BrowserRouter + `404.html` | Simples no Pages | 404 HTTP; frágil p/ links externos | Aceitável **só demo** |
| HashRouter | Deep links “sempre funcionam” | URLs `#/secure/...` ruins p/ paciente/WhatsApp | **Não** como definitivo |
| Host com SPA rewrite (Vercel/CF) + BrowserRouter | URLs limpas; 200 OK; headers | Migrar hosting | **Recomendado p/ V3** |
| Backend serve SPA + API same-origin | Máximo controle | Mais ops | Alternativa madura |

### Recomendação

1. **Curto prazo (ainda no Pages):** manter BrowserRouter + `404.html`; não investir em HashRouter.
2. **V3 produção:** mover SPA para **Vercel ou Cloudflare Pages** com rewrite `/* → /index.html`, domínio `app.evelynclinica.com.br` (ou similar).
3. **Secure links** em path limpo: `https://app.../secure/consent/{token}` — token só no path/query, nunca em fragmento `#` (fragmento não vai ao servidor; dificulta audit server-side se necessário).
4. Token na URL: usar path; logar apenas **prefixo** do token em audit; armazenar **hash**.
5. Quando houver backend próprio, same-origin (`app` + `/api`) simplifica cookies httpOnly para staff.

---

## 8. Estratégia de segurança

### 8.1 Autenticação da equipe

- Supabase Auth (e-mail/senha) + **MFA opcional** (obrigatório para `admin` idealmente).
- Sessão: JWT curto + refresh; cookies httpOnly se same-origin.
- Lockout / rate limit em login.
- Senhas: Argon2id (cuidado do provedor Auth — não SHA-256).

### 8.2 RBAC

Roles sugeridas:

| Role | Escopo típico |
|---|---|
| `admin` | tudo + usuários + export + automações |
| `clinician` | prontuário completo, fotos, procedimentos, produtos |
| `assistant` | agenda, CRM, envio de links, orçamentos; **leitura** limitada de prontuário |
| `viewer` | somente leitura agregada (se necessário) |

Permissões por código (`records.write`, `photos.read`, …), não só por role string.

### 8.3 Autorização por recurso + anti-IDOR

- Toda query filtra `organization_id` + RLS.
- Paciente: acesso **somente** via `secure_links` validado server-side para `resource_id` específico.
- Staff: policies checam `has_permission` **e** membership na org.
- Nunca confiar em `patientId` enviado pelo cliente sem ownership check.
- IDs opacos (UUID v4); sem sequenciais públicos.

### 8.4 Secure tokens

| Propriedade | Implementação |
|---|---|
| Aleatório | `crypto.randomBytes(32)` (256 bits) |
| Não previsível | sem IDs sequenciais no token |
| Armazenamento | só `SHA-256(token)` ou HMAC no DB |
| Expiração | `expires_at` obrigatório (ex.: 72h anamnese, 7d orçamento) |
| Revogação | `revoked_at` + UI staff |
| Uso único / N usos | `max_uses` / `use_count` |
| Vínculo | `action_type` + `resource_type/id` + `patient_id` |
| Auditável | `last_opened_at`, `used_at`, `audit_logs` |

### 8.5 Storage privado e signed URLs

- Bucket privado `clinical-photos`, `signatures`, `documents`.
- Upload autenticado (staff) ou via edge após validar secure link (se paciente envia foto — futuro).
- Download: signed URL **1–5 minutos**, content-disposition controlado.
- Nunca URLs públicas permanentes de foto clínica.

### 8.6 Criptografia

- Em trânsito: TLS 1.2+.
- Em repouso: encryption do provedor (disk) + **campo sensível** (CPF) com encryption application-level (chave em vault/KMS).
- Assinaturas e fotos: Storage encrypted at rest.

### 8.7 Audit logs

Registrar no mínimo:

- login/logout staff
- create/update/delete (soft) de prontuário, documento, foto
- **leitura** de prontuário completo e fotos (access log)
- emissão/revogação/uso de secure link
- exportação de dados

Retenção: política definida (ex.: 5 anos clínicos alinhado a normas profissionais aplicáveis — validar com assessoria jurídica).

### 8.8 Backup

- PITR PostgreSQL (Supabase Pro ou equivalente).
- Backup Storage versionado.
- Teste de restore trimestral.
- Export LGPD sob demanda (paciente).

### 8.9 Controle de acesso ao prontuário

- UI: “modo clínico” separado de CRM comercial.
- Assistant: mascarar campos sensíveis se política assim definir.
- Break-glass: admin acessa com motivo obrigatório → audit.
- Watermark / disable cache agressivo em fotos (headers `Cache-Control: private, no-store` nas signed URLs quando possível).

---

## 9. Estratégia de storage (fotos e arquivos)

| Aspecto | V2 | V3 |
|---|---|---|
| Formato | Data URL base64 no JSON | Arquivo binário no object storage |
| Acesso | Qualquer um com o JSON | Privado + signed URL |
| Metadados | Misturados no record | Tabela `photos` + path |
| Pares antes/depois | `pair_id` | Manter conceito |
| Assinaturas | base64 no consent | Storage path em `document_signatures` |
| Limites | Quota localStorage | Quotas por plano + compressão/resize no upload |

Pipeline de upload (staff):

1. Cliente pede URL de upload assinada (ou usa SDK com policy).
2. Valida MIME (`image/jpeg`, `image/png`, `image/webp`), tamanho máx., magic bytes.
3. Opcional: gerar thumbnail server-side.
4. Grava metadados só após upload OK.
5. Audit `photo.created`.

---

## 10. Roadmap revisado

### V1 — Gestão operacional ✅

Prontuários básicos, evoluções, agenda, fotos, termos, contratos, orçamentos, painel, persistência local.

### V2 — CRM / Auth / Consentimentos ✅ (protótipo)

Login multi-perfil, portal paciente, assinatura de termos, pipeline CRM, interações, lembretes, tags, migração V1→V2. **Persistência ainda local.**

### V3 — Clinical CRM / Patient 360 ⏳ (próxima)

**Não implementar até aprovação desta arquitetura.**

- Backend + PostgreSQL + Auth staff + RLS
- Secure Links (anamnese, termo, orçamento, confirmação de agenda)
- Patient 360: timeline unificada (agenda, evoluções, docs, fotos, interações, orçamentos)
- Prontuário longitudinal versionado
- Produtos + lotes + rastreabilidade
- Storage privado de fotos
- Documentos versionados + assinatura com evidência
- RBAC + audit logs
- Hospedagem com deep links reais
- Migração dos dados V2
- **Hooks de domínio** prontos para WhatsApp (sem integrar ainda)
- Automações mínimas (expiração de link, lembrete interno)

### V4 — Financial Intelligence

Fluxo de caixa, contas a pagar/receber, margem por procedimento, LTV, ticket, conversão de orçamento, inadimplência, dashboards, export contábil — **reutilizando** `quotes`, `procedures`, `patients` da V3.

### V5 — Growth + Automation + AI

WhatsApp bidirecional, automações avançadas, segmentos inteligentes, assistente de prontuário, predição de retorno/churn, campanhas — sobre eventos e dados já estruturados.

### Princípios (atualizados)

1. Clínico primeiro  
2. Elegante e simples  
3. Evolutivo: local → CRM protótipo → **nuvem clínica** → financeiro → growth  
4. LGPD by design  
5. Paciente sem fricção (secure links)  
6. Rastreabilidade de produto/lote  

---

## 11. Sequência de implementação da V3 (após aprovação)

Ordem sugerida (cada fase entregável e testável):

### Fase A — Fundação (infra)

1. Projeto Supabase + schema core (`organizations`, `users`, `roles`, `patients`)
2. Auth staff + RLS básico
3. App React apontando para API (feature flag)
4. Deploy SPA com rewrite (Vercel/CF) + domínio
5. `audit_logs` + middleware de escrita

### Fase B — Paciente 360 read model

6. Migrar pacientes, agenda, interações, tags
7. Tela Patient 360 (timeline) substituindo detalhe atual
8. CRM stages unificados no paciente (ou bridge leads→patients)

### Fase C — Secure Links

9. Tabela `secure_links` + emissão staff
10. Rotas públicas `/secure/*` + validação server-side
11. Fluxos: consent, quote, appointment confirm
12. Revogação / expiração / audit de abertura

### Fase D — Prontuário + produtos

13. `treatments` / `sessions` / `procedures` / `clinical_records` + versions
14. Catálogo `products` / `product_batches`
15. `treatment_product_usages` com snapshot
16. UI clínica de evolução (sem sobrescrita cega)

### Fase E — Docs + fotos

17. Templates/versions de documentos; migrar consents
18. Storage privado + upload fotos; migrar base64
19. Assinatura via secure link com evidência

### Fase F — Anamnese + automações leves

20. Templates de anamnese + response via link
21. Jobs: expirar links, alertas internos
22. Event bus interno (`domain_events`) para futuro WhatsApp

### Fase G — Hardening

23. MFA admin, revisão RLS, pentest leve / checklist IDOR
24. Backup/restore testado, política de retenção
25. Desligar dependência localStorage; atualizar README/ROADMAP

**Fora da V3:** gateway WhatsApp, financeiro, AI.

---

## 12. Complexidade por módulo (relativa)

Escala: **S** (contido) · **M** (moderado) · **L** (alto) · **XL** (estrutural / risco LGPD)

| Módulo | Complexidade | Dependências | Notas |
|---|---|---|---|
| Infra Supabase + CI/CD + hosting | M | — | Base de tudo |
| Auth staff + roles + RLS | L | Infra | Crítico segurança |
| Pacientes + tags/segments | M | Auth | Migração V2 direta |
| Agenda | S–M | Pacientes | Estável na V2 |
| CRM / interações / timeline 360 | M–L | Pacientes | Unificar lead/paciente |
| Secure Links framework | L | Auth, audit | Coração do paciente sem login |
| Consent / documentos / assinatura | L | Secure Links, Storage | Reaproveita SignaturePad |
| Orçamento via link | M | Secure Links, quotes | |
| Confirmação de agenda | S–M | Secure Links | |
| Prontuário versionado | L | Pacientes | Mudança de modelo mental |
| Produto / lote / usages | M–L | Prontuário | Snapshot obrigatório |
| Fotos + storage privado | L | Storage, RLS | Migrar base64 |
| Anamnese templates/responses | M | Secure Links | |
| Audit logs + access log | M | Tudo | Triggers + app |
| Automações mínimas | M | Events | Sem WhatsApp ainda |
| Migração localStorage → cloud | L | Quase todos | One-shot + validação |
| WhatsApp (só preparar hooks) | S | Events | Não integrar |
| Financeiro | — | — | **V4** |
| AI / growth | — | — | **V5** |

---

## O que NÃO fazer agora

- Não implementar módulos V3.
- Não trocar Router/HashRouter ainda sem plano de hosting.
- Não “só plugar Supabase” sem RLS + audit + secure links.
- Não manter login/senha de paciente como caminho principal.
- Não usar Base64 como arquitetura definitiva de fotos.
- Não começar V4 financeira antes do Patient 360.

---

## Pedido de aprovação

Para iniciar a implementação, confirmar:

1. **Stack:** Supabase (recomendado) vs API própria + Postgres.  
2. **Hosting V3:** Vercel ou Cloudflare Pages (sair do Pages como prod).  
3. **Paciente sem login:** Secure Links como padrão (portal com senha só se necessário depois).  
4. **Escopo V3** conforme seções 10–11.  
5. **Migração:** export V2 → ETL one-shot aceitável.

Após aprovação, a sequência começa pela **Fase A (fundação)**.
