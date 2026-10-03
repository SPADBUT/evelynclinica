# DIAGNÓSTICO EXECUTIVO — Auditoria técnica V2 → V3

> **Tipo:** auditoria somente leitura (código inspecionado; nenhuma alteração de código, Supabase, Vercel ou banco foi feita na geração deste documento).  
> **App publicada:** https://evelynclinica.vercel.app/  
> **Data da auditoria:** 2026-10-03

A aplicação publicada é **100% V2/demo**: SPA React com CRUD funcional, mas **toda persistência em `localStorage`**. Não há client Supabase, TanStack Query, APIs HTTP nem Edge Functions no frontend. A **V3 existe só como schema SQL + docs (fase A1)** em `supabase/migrations/` — ainda não conectada à UI. O “Restaurar dados demo” regrava o seed sem proteção de ambiente.

Contexto de produto alvo (incremental):

- V3.0 Foundation/Auth
- V3.1 Patient 360
- V3.2 Fotos/Documentos/Consentimentos
- V3.3 Agenda
- V3.4 CRM
- V3.5 Financeiro
- V3.6 WhatsApp
- V3.7 IA

Regra: **ROBUST ARCHITECTURE + INCREMENTAL MVPs + REAL USAGE + FEEDBACK**.

---

## 1. Arquitetura atual

| Camada | Situação |
|---|---|
| Framework | React SPA (Vite), **não** Next.js |
| React | `^19.2.8` (instalado **19.3.0**) |
| TypeScript | `~6.0.2` (instalado **6.0.3**) |
| Vite | `^8.3.0` (instalado **8.3.1**) |
| Tailwind | v4 via `@tailwindcss/vite` **4.3.3** |
| Roteamento | `react-router-dom` **7.18.4** + `BrowserRouter` com `basename` de `import.meta.env.BASE_URL` |
| Estado | Context API: `AuthContext` + `ClinicContext` (monólito de mutations) |
| TanStack Query | **Ausente** |
| Supabase client | **Ausente** (`@supabase/supabase-js` não está nas deps) |
| Auth | Local: usuários em `ClinicData.users`, senha SHA-256+salt (`src/lib/auth.ts`), sessão em `localStorage` (`evelyn-clinic-session-v2`) |
| Persistência | `localStorage` chave `evelyn-clinic-v2` (+ migração de `evelyn-clinic-v1`) |
| sessionStorage | **Não usado** |
| Mocks/demo | `src/data/seed.ts` → `createSeedData()` |
| APIs / backend runtime | **Nenhum** no frontend |
| Edge Functions | Pasta `supabase/functions` **inexistente** |
| Package | `version: "2.0.0"`, descrição explícita V2 |

**Backend V3 (só no repo, não ligado à app):** migrations A1 + `supabase/config.toml` + docs (`docs/V3_ARCHITECTURE.md`, `docs/SCHEMA_A1.md`, `docs/V2_TO_V3_MAPPING.md`).

### Estrutura relevante

```
src/
├── components/     # UI, layouts clínica/portal, assinatura
├── context/        # Auth + estado da clínica
├── data/           # seed demo V2
├── pages/          # módulos clínicos + portal paciente
└── types/          # modelos V2

supabase/
├── migrations/     # schema V3 A1
├── scripts/        # validate_a1_schema.sql
└── config.toml
```

---

## 2. Rotas

| ROTA | TELA | COMPONENTE PRINCIPAL | FONTE DOS DADOS | V2/V3 | OBSERVAÇÃO |
|---|---|---|---|---|---|
| `/login` | Login | `LoginPage` | `localStorage` users + sessão | V2 | Contas demo hardcoded na UI |
| `/` | Painel | `DashboardPage` | `ClinicContext` ← localStorage | V2 | Texto “V2 — CRM…”, botão restore |
| `/crm` | CRM | `CrmPage` | leads/interactions/reminders LS | V2 | Kanban por estágio |
| `/pacientes` | Prontuários (lista) | `PatientsPage` | patients LS | V2 | Nav chama “Prontuários” |
| `/pacientes/:id` | Detalhe + evoluções | `PatientDetailPage` | patients + records LS | V2 | Mistura demográfico/clínico |
| `/agenda` | Agenda | `AgendaPage` | appointments LS | V2 | CRUD completo local |
| `/fotos` | Antes & Depois | `PhotosPage` | photos LS (Base64) | V2 | Upload → data URL |
| `/termos` | Consentimentos | `ConsentsPage` | consents + users LS | V2 | “Acesso da paciente” |
| `/contratos` | Contratos | `ContractsPage` | contracts LS | V2 | |
| `/orcamentos` | Orçamentos | `BudgetsPage` | budgets LS | V2 | |
| `/portal` | Meus termos | `PatientConsentsPage` | consents filtrados | V2 | Role `paciente` |
| `/portal/termos/:id` | Assinar termo | `SignConsentPage` | signConsent → LS | V2 | Canvas + aceite |
| `/portal/contratos` | Meus contratos | `PatientContractsPage` | contracts filtrados | V2 | Somente leitura |
| `*` | Redirect | `Navigate → /login` | — | V2 | |

Guardas: `RequireStaff` / `RequirePatient` (`src/components/RequireAuth.tsx`).

Nav clínica (`AppLayout`): Painel, CRM, Prontuários, Agenda, Antes & Depois, Consentimentos, Contratos, Orçamentos.

---

## 3. Fontes de dados

| Fonte | Uso |
|---|---|
| **localStorage** | Única fonte de verdade clínica + auth users + sessão |
| sessionStorage | Não usado |
| mock/seed | `createSeedData()` no 1º load / restore / fallback de erro |
| arquivo estático | Templates de texto em `seed.ts` (`CONSENT_TEMPLATE`, `CONTRACT_CLAUSES`); fotos placeholder SVG |
| estado React | Espelho em memória de `ClinicData` via Context |
| Supabase | **Zero queries/mutations no frontend** |
| API HTTP | Nenhuma |

### Chaves de storage

| Chave | Conteúdo |
|---|---|
| `evelyn-clinic-v2` | Dados da clínica (`ClinicData`) |
| `evelyn-clinic-session-v2` | Sessão do usuário logado |
| `evelyn-clinic-v1` | Legado (merge parcial + seed de users/CRM) |

### Onde o demo é definido

- Definição: `src/data/seed.ts` (`createSeedData`)
- Carga/gravação: `src/lib/storage.ts` (`loadClinicData`, `saveClinicData`, `resetClinicData`)
- Mutations da UI: `src/context/ClinicContext.tsx`
- Auth/sessão: `src/context/AuthContext.tsx`

---

## 4. Módulos

| Módulo | STATUS | Reaproveitar | Refazer | Descartar (depois) |
|---|---|---|---|---|
| Dashboard | funcional + demo | layout/métricas de UX | fonte de dados | botão restore + copy V2 |
| CRM | funcional localStorage | UX pipeline + tipos Lead | persistência Supabase `crm_leads` | seed leads |
| Pacientes / Prontuários | funcional LS | formulários, busca, navigação | service layer + Patient 360 | hard delete cascata atual |
| Agenda | funcional LS | UI calendário/status | `appointments` + RLS | — |
| Antes & Depois | funcional LS Base64 | UX de pares antes/depois | Storage privado (A4) | Base64 como arquitetura |
| Consentimentos | funcional LS | fluxo rascunho→enviado→assinado + SignaturePad | `documents` + Secure Links | login/senha paciente |
| Contratos | funcional LS | formulário/status | unificar em `documents` type=contract | — |
| Orçamentos | funcional LS | itens/desconto/status | `quotes`/`quote_items` | — |
| Acesso paciente | funcional demo | ideia de portal | **substituir** por Secure Links (A5) | `ensurePatientAccess` + accounts `paciente` |
| Autenticação | funcional local | RequireStaff/Patient patterns | Supabase Auth + profiles/memberships (A2) | hash no browser, demo credenciais |

Nenhum módulo UI está “já V3”. O que é V3 está só no schema.

---

## 5. Supabase (somente inspeção de código)

| Item | Achado |
|---|---|
| Client criado? | **Não** |
| Queries/mutations frontend? | **Nenhuma** |
| Env vars esperadas no app? | Só `VITE_BASE_PATH` (deploy). Docs: sem `SUPABASE_URL`/keys nesta A1 |
| Auth Supabase? | Schema preparado (`profiles` → `auth.users`); runtime = A2 |
| RLS no frontend? | Não. Migrations: RLS **adiado para A2** |
| Chamadas privilegiadas? | Não |
| Edge Functions? | Não referenciadas |

### Tabelas no schema A1

`clinics`, `profiles`, `clinic_memberships`, `patients`, `patient_tags`, `crm_leads`, `procedures`, `procedure_templates`, `treatments`, `treatment_sessions`, `appointments`, `clinical_records`, `clinical_record_versions`, `documents`, `document_versions`, `document_signatures`, `quotes`, `quote_items`, `products`, `product_batches`, `treatment_product_usages`, `photos`, `interactions`, `alerts`, `tasks`, `secure_links`, `audit_logs`.

### Comparação com nomes alternativos (organizations / staff_profiles / roles…)

No código canônico de `docs/V3_ARCHITECTURE.md` / migrations, o equivalente é:

| Nome citado | No repo A1 |
|---|---|
| organizations | `clinics` |
| staff_profiles | `profiles` |
| roles / staff_roles | enum `clinic_role` + `clinic_memberships.role` |
| permissions / role_permissions | **ainda não modelados** (roles futuras: professional/finance/manager sem matriz de permissões) |
| patients | `patients` ✅ |
| audit_logs | `audit_logs` ✅ |

### Migrations

- `20260926020000_extensions_and_enums.sql`
- `20260926020100_tenancy_and_identity.sql`
- `20260926020200_patients_and_crm.sql`
- `20260926020300_clinical_core.sql`
- `20260926020400_documents_and_quotes.sql`
- `20260926020500_products_photos_ops.sql`
- `20260926020600_secure_links_and_audit.sql`
- `20260926020700_same_clinic_integrity.sql`

---

## 6. Modelo de paciente

Interface `Patient` em `src/types/index.ts` — **um único registro mistura demográfico + clínico**. Comercial vive em `Lead` / `Budget` / `Contract` (separados, mas sem domínio clínico estruturado).

### OPERACIONAL / DEMOGRÁFICO

- `name`
- `email`
- `phone`
- `cpf`
- `birthDate`
- `gender`
- `address`
- `status` (`ativo` | `inativo` | `em_tratamento`)
- `tags[]`
- `createdAt` / `updatedAt`

### CLÍNICO (no próprio Patient)

- `allergies`
- `medications`
- `notes`

### CLÍNICO (entidade separada `MedicalRecordEntry`)

- `procedure`
- `professional`
- `anamnesis`
- `evolution`
- `productsUsed`
- `nextSteps`
- `date` / `createdAt`

### COMERCIAL (não no Patient)

**Lead:** `source`, `stage`, `interest`, `notes`, `patientId?`  
**Budget:** itens, `discount`, `status`, `validUntil`  
**Contract:** `value`, `status`, cláusulas

**Conclusão:** o modelo V2 mistura demográfico e clínico no mesmo objeto `Patient`; comercial está paralelo (leads/orçamentos), não versionado como no schema V3 (`clinical_records` + versions, tags normalizadas, soft delete).

---

## 7. Fluxos

| Fluxo | UI → função → persistência |
|---|---|
| **A) Criar paciente** | `PatientsPage` modal → `upsertPatient` → `saveClinicData` → **localStorage** |
| **B) Editar paciente** | `PatientDetailPage` → `upsertPatient({…, id})` → LS |
| **C) Criar lead** | `CrmPage` → `upsertLead` → LS |
| **D) Mudar estágio CRM** | botões no card → `upsertLead({…, stage})` → LS |
| **E) Criar orçamento** | `BudgetsPage` → `upsertBudget` → LS |
| **F) Status orçamento** | `<Select>` → `upsertBudget({…, status})` → LS |
| **G) Criar contrato** | `ContractsPage` → `upsertContract` → LS |
| **H) Criar consentimento** | `ConsentsPage` → `upsertConsent` (template seed) → LS |
| **I) Assinar consentimento** | Portal `SignConsentPage` → `signConsent` (valida status, grava signature Base64 + UA) → LS · **ou** “Marcar manual” na clínica |
| **J) Criar consulta** | `AgendaPage` → `upsertAppointment` → LS |
| **K) Registrar foto** | `PhotosPage` FileReader → Base64 → `upsertPhoto` → LS |
| **L) Acesso paciente** | `ensurePatientAccess` cria/atualiza `AuthUser` role `paciente` → LS · login local → `/portal` |

Nenhum fluxo toca banco/API.

---

## 8. Dados demo

Fonte principal: `src/data/seed.ts`. Credenciais também em `README.md` e `LoginPage.tsx`.

| Tipo | Exemplos | Arquivo |
|---|---|---|
| Pacientes | Ana Beatriz Mendes, Camila Rocha Santos, Juliana Ferreira | `seed.ts` |
| Telefones | `11987654321`, `11976543210`, `11965432109`, leads `11988887777`, `11977776666` | `seed.ts` |
| Emails | `ana.mendes@…`, `camila.rocha@…`, `juliana.ferreira@…`, `mariana.lopes@…`, `fernanda.alves@…` | `seed.ts` + `LoginPage`/`README` |
| Staff | `evelyn@clinica.com` / `evelyn123`, `assistente@clinica.com` / `assistente123` | `seed.ts` + UI |
| Paciente login | `juliana.ferreira@email.com` / `paciente123`, `ana.mendes@email.com` / `paciente123` | `seed.ts` + README |
| Datas clínicas | 2026-01…2026-03 (retornos relativos a `todayISO()`) | `seed.ts` |
| Orçamentos | peeling Camila (enviado), toxina Juliana (rascunho) | `seed.ts` |
| Contratos | Plano Harmonização Facial Ana — R$ 4800 | `seed.ts` |
| Consentimentos | Bioestimulador assinado (Ana); avaliação enviado (Juliana) | `seed.ts` |
| Agenda | 2 hoje + 1 em +2 dias | `seed.ts` |
| Fotos | SVG Base64 “Antes”/“Depois” | `seed.ts` |
| Interações | WhatsApp/email/ligação demo | `seed.ts` |
| Lembretes | retorno Ana; validade orçamento Camila | `seed.ts` |
| Leads | Mariana Lopes, Fernanda Alves (+ Ana/Camila convertidas) | `seed.ts` |

---

## 9. “Restaurar dados demo”

| Pergunta | Resposta |
|---|---|
| Onde o botão é criado | `DashboardPage.tsx` → actions do `PageHeader` |
| Função | `resetDemoData()` do `ClinicContext` |
| Cadeia | `resetDemoData` → `resetClinicData()` → `createSeedData()` → `saveClinicData` |
| O que restaura | **Todo** `ClinicData` (pacientes, records, agenda, fotos, termos, contratos, orçamentos, users, leads, interactions, reminders) |
| Onde grava | `localStorage['evelyn-clinic-v2']` |
| Proteção de ambiente | **Nenhuma** — aparece em produção Vercel/GitHub Pages sem `import.meta.env.DEV` |

Também auto-seeda no primeiro acesso / erro de parse (`loadClinicData`).

Textos V2 visíveis na UI:

- Dashboard: “V2 — CRM, autenticação e assinatura digital de termos.”
- Dashboard: “Dados V2 neste navegador (auth + portal da paciente).”
- Layout: “V2 · CRM & assinatura”
- Login: “Clínica Estética · V2” + bloco “Contas demo”

---

## 10. Base path / Vercel

| Config | Valor |
|---|---|
| `vite.config.ts` | `base = resolveViteBase(VITE_BASE_PATH)`; default **`/evelynclinica/`** se unset |
| `vercel.json` | `VITE_BASE_PATH: "/"` + SPA rewrite `/(.*) → /index.html` |
| `BrowserRouter` | `basename` = `BASE_URL` sem trailing slash (root → `undefined`) |
| `deploy-pages.yml` | build com `VITE_BASE_PATH=/evelynclinica/` + `404.html` fallback |
| GitHub Pages | `/evelynclinica/` |
| Vercel | `/` |

**Veredito:** dual-host está coerente. Contanto que Vercel continue injetando `/` e Pages `/evelynclinica/`, um não quebra o outro. Risco: build local/preview **sem** env usa default Pages (subpath).

---

## 11. Classificação de arquivos (A/B/C/D)

| Arquivo | Classe | Nota |
|---|---|---|
| `src/App.tsx` | **B** | Rotas/basename ok; trocar providers quando houver auth real |
| `src/main.tsx` | **A** | |
| `src/types/index.ts` | **B** | Domínio útil; alinhar a enums V3 / separar clínico |
| `src/lib/format.ts` | **A** | |
| `src/lib/auth.ts` | **C** | Substituir por Auth Supabase; hash local não serve produção |
| `src/lib/storage.ts` | **D→B temporário** | Útil até A6; depois remover |
| `src/data/seed.ts` | **D** | Demo only; manter só para dev |
| `src/context/AuthContext.tsx` | **C** | Reescrever sobre Supabase Auth |
| `src/context/ClinicContext.tsx` | **C** | Monólito → services/repos (A3) |
| `src/components/RequireAuth.tsx` | **B** | Manter padrão de guards |
| `src/components/SignaturePad.tsx` | **A** | Reaproveitar na V3.2 |
| `src/components/layout/*` | **B** | Nav/branding ok; remover “V2 · CRM” |
| `src/components/ui/*` | **A** | |
| `src/pages/*` (todas) | **B** | UI/fluxos reaproveitáveis; data layer não |
| `supabase/migrations/*` | **A** | Fundação V3 — **não tocar** até A2 planejado |
| `docs/V3_ARCHITECTURE.md`, `SCHEMA_A1.md`, `V2_TO_V3_MAPPING.md` | **A** | Canônicos |
| `vite.config.ts`, `vercel.json`, `deploy-pages.yml` | **A** | Dual deploy estável |
| `package.json` | **B** | Ainda descreve V2; faltam deps Supabase/Query na hora certa |

Legenda:

- **A** = reaproveitar na V3
- **B** = adaptar
- **C** = substituir
- **D** = legado/V2 e pode ser removido posteriormente

---

## 12. Matriz de migração

| MÓDULO | ESTADO ATUAL | FONTE DE DADOS | V2/V3 | REAPROVEITAR | ADAPTAR | REFAZER | PRIORIDADE |
|---|---|---|---|---|---|---|---|
| Foundation/Auth | UI local; schema A1 pronto | LS / SQL | V2 UI + V3 schema | migrations, layouts | guards, base path | Auth+RLS+client | **P0** |
| Pacientes / Patient 360 | CRUD flat | LS | V2 | forms, lista | tipos→patients | 360 unificado + clinical versions | **P0→P1** |
| Fotos/Docs/Consent | Funcional demo | LS Base64 | V2 | SignaturePad, status machine | documents schema | Storage + Secure Links | **P1** |
| Agenda | Funcional | LS | V2 | UI status | appointments | multi-user/RLS | **P2** |
| CRM | Funcional | LS | V2 | kanban UX | crm_leads mapping | scoring/WA depois | **P3** |
| Financeiro | inexistente produto | — | — | — | — | V3.5 / V4 docs | depois |
| WhatsApp / IA | inexistente | — | — | interactions channel enum | — | V3.6–3.7 | depois |

---

## 13. Plano recomendado de migração

Baseado no código encontrado (não genérico):

### V3.0 Foundation (A2 + A3 mínimos)

1. Manter UI V2 rodando em LS.
2. **Não começar** reescrevendo CRM/Agenda.
3. Ligar projeto Supabase; aplicar migrations existentes; Auth staff (`admin`/`assistant`) + RLS em `clinic_id` via `clinic_memberships`; criar `src/lib/supabase.ts` + data layer fina.
4. Trocar só login staff primeiro (feature flag / dual-read se necessário).
5. Remover/ocultar “Restaurar dados demo” em produção **só depois** de ter auth real.

### V3.1 Patient 360

1. Migrar `patients` + `patient_tags` + leitura de records.
2. Reaproveitar `PatientsPage` / `PatientDetailPage` como shell; dados via services.
3. ETL inicial do LS (A6 parcial) conforme `docs/V2_TO_V3_MAPPING.md`.

### V3.2 Fotos / Documentos / Consentimentos

1. `documents` + signatures; Storage privado para fotos/assinaturas.
2. Substituir `ensurePatientAccess` + accounts paciente por `secure_links` (A5).
3. Reaproveitar `SignaturePad` e fluxo rascunho→enviado→assinado.

### V3.3 Agenda

1. Portar `AgendaPage` para `appointments` já modelados.

### V3.4 CRM

1. Portar `CrmPage` para `crm_leads` / `interactions` / `alerts`.
2. Só depois da fundação clínica estável (regra do roadmap do repo: clínico primeiro).

**Ordem segura:** schema já existe → Auth/RLS → Patient → Docs/Fotos/Secure Links → Agenda → CRM.  
**Não** inverter (CRM/WhatsApp antes de Auth/RLS quebraria LGPD e isolamento).

---

## 14. Respostas finais

### A. O que da aplicação atual podemos aproveitar?

UI completa dos módulos, `SignaturePad`, componentes UI, roteamento/base path dual, tipos de domínio, mapping V2→V3, e **todo o schema A1** em `supabase/migrations/`.

### B. O que é essencialmente V2/demo?

Toda a SPA em `src/` quanto a dados: Context + localStorage + `seed.ts` + contas demo + restore + login de paciente com senha + fotos Base64. Labels “V2” no layout/login/dashboard.

### C. O que precisa ser reconstruído para V3?

Auth, sessão, data layer, persistência, RLS, Storage, acesso paciente (Secure Links), Patient 360 longitudinal, e depois acoplar módulos um a um. `ClinicContext` como “banco” deve morrer.

### D. Qual deve ser o PRIMEIRO incremento?

**V3.0 Foundation:** Supabase Auth staff + RLS + client + data layer mínima + (opcional) read-only `patients` — **sem** reescrever CRM/Agenda ainda. O schema A1 já está pronto; o gap é runtime A2/A3.

### E. Quais arquivos NÃO tocar ainda?

- `supabase/migrations/*` (estáveis; só evoluir com migration nova em A2)
- `docs/V3_*`, `SCHEMA_A1.md`, `V2_TO_V3_MAPPING.md`
- `vite.config.ts`, `vercel.json`, `.github/workflows/deploy-pages.yml` (dual-host ok)
- Evitar “limpeza” massiva de `src/pages/*` / `seed.ts` antes da data layer — a UI V2 ainda é o MVP utilizável

---

## Referências no repositório

| Documento | Papel |
|---|---|
| `ROADMAP.md` | Versões oficiais V1–V5 |
| `docs/V3_ARCHITECTURE.md` | Arquitetura canônica V3 |
| `docs/SCHEMA_A1.md` | Referência rápida do schema A1 |
| `docs/V2_TO_V3_MAPPING.md` | Mapeamento de dados V2 → V3 |
| `README.md` | Contas demo e stack V2 |
| Este arquivo | Auditoria técnica pré-migração |
