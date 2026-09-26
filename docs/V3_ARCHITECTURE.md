# V3 Architecture — Evelyn Clínica Estética

Documento canônico da fundação V3.  
Fonte: escopo da Fase A (fundação) e decisões arquiteturais fechadas.  
Não inventa funcionalidades além do definido.

---

## 1. Objetivo da V3

Transformar a V2 (protótipo frontend com `localStorage`) em uma aplicação preparada para produção clínica/LGPD, com:

- backend real (Supabase / PostgreSQL)
- autenticação de equipe (Supabase Auth)
- isolamento multi-clínica via RLS
- Storage privado para conteúdo clínico
- Secure Links para pacientes (sem login/senha)
- base para Patient 360, CRM clínico e prontuário longitudinal

**Nesta fundação (Fases A1–A8)** não se implementa Patient 360 completo, scoring, WhatsApp, financeiro, IA nem dashboards V3 novos.

---

## 2. Arquitetura geral

```
UI (React 19 + Vite + Tailwind)
        ↓
Application / Data layer (services, repositories, hooks)
        ↓
Supabase Client (anon/publishable key only)
        ↓
PostgreSQL + RLS + Storage + Auth (+ Edge Functions quando necessário)
```

- Frontend permanece SPA (não migrar para Next.js nesta etapa).
- Secret / service role key **nunca** no browser.
- Isolamento de dados **não** depende de filtros só no frontend.

---

## 3. Backend — Supabase / PostgreSQL

Usar:

| Capacidade | Uso |
|---|---|
| PostgreSQL | Fonte oficial de dados |
| Auth | Usuários internos (equipe) |
| Storage | Buckets **privados** para fotos/arquivos clínicos |
| Edge Functions | Operações sensíveis (ex.: Secure Links) |
| RLS | Isolamento e autorização no banco |

Migrations versionadas em `supabase/migrations/`.  
Ambientes previstos: **local → staging → production** (sem alteração manual de schema).

**A1:** schema + migrations no repositório. Projeto remoto e credenciais: etapas posteriores.

---

## 4. Auth

**Internos (com conta):**

- `admin` (Evelyn / administradora)
- `assistant` (operacional)

**Estrutura preparada (roles futuras, sem permissões extras agora):**

- `professional`
- `finance`
- `manager`

**Pacientes:**

- **Não** terão login/senha tradicional.
- Acesso via **Secure Links** (token de uso limitado).

Modelo:

```
auth.users → profiles
profiles + clinics → clinic_memberships (role)
```

Regra: usuário → pertence a uma clínica → possui role → acessa só o autorizado daquela clínica.

**STATUS A1:** tabelas `profiles` e `clinic_memberships` existem no schema. Runtime Auth = **A2**.

---

## 5. RLS

- RLS em **todas** as tabelas expostas ao frontend.
- Policies explícitas para SELECT / INSERT / UPDATE / DELETE quando aplicável.
- `clinic_id` nas policies derivado da membership do usuário autenticado — **não** confiar no `clinic_id` enviado pelo cliente.
- Testes de isolamento, roles, anon e IDOR = **A2 / A8**.

**STATUS A1:** schema compatível com RLS (`clinic_id` nas entidades de negócio). Policies **não** implementadas nesta fase.

---

## 6. Multi-tenancy

Tabela `clinics` desde o início.  
Entidades de negócio relevantes possuem `clinic_id`.

Mesmo com uma clínica hoje, o modelo nasce multi-clinic.

Além de `clinic_id`, a A1 inclui triggers de integridade same-clinic (migration `…_same_clinic_integrity.sql`) para impedir FKs cross-clinic óbvias (patient, treatment, documents, quotes, batches/usages, secure_links, etc.). Isso **não** substitui RLS (A2).

---

## 7. Data layer

Direção alvo:

```
src/data/ | src/services/ | src/lib/ | src/hooks/
```

UI consome serviços/repositórios — evitar queries Supabase espalhadas nos componentes.

**STATUS A1:** não refatorar `ClinicContext` / UI. Data layer = **A3**.

---

## 8. Patient 360

Visão unificada do paciente (clínico + comercial + relacionamento).

**STATUS:** FUTURO / NÃO DECIDIDO em detalhe de UI e scoring.  
Fundação de dados: `patients`, vínculos clínicos/documentais/CRM.

---

## 9. Clinical CRM

Preservar domínio V2 de leads via `crm_leads`.

Fluxo conceitual:

```
Lead → Avaliação → Orçamento → Paciente → Tratamento
```

- `crm_leads.patient_id` é **nullable** (lead ≠ paciente obrigatório).
- Conversão/associação a `patients` é permitida depois.
- Não redesenhar CRM comercial completo na fundação.

---

## 10. Prontuário longitudinal

Modelo:

```
Patient
  → Treatment
    → Treatment Session
      → Procedure
        → Clinical Evolution
          ├── Products / Lots (usages com snapshot)
          ├── Photos
          ├── Documents
          ├── Complications   STATUS: FUTURO / NÃO DECIDIDO (tabela dedicada)
          └── Next Return
```

Estados de evolução clínica:

- `draft`
- `in_progress`
- `finalized`
- `corrected`
- `cancelled`

Versionamento via `clinical_records` + `clinical_record_versions`.  
Não sobrescrever silenciosamente evolução finalizada.

**STATUS A1:** modelo/schema apenas. UI completa = fases posteriores.

---

## 11. Produtos e lotes

- `products` — cadastro mestre
- `product_batches` — lotes
- `treatment_product_usages` — uso clínico com **snapshot** (nome, marca, fabricante, lote, validade, quantidade, unidade, vínculos, data/hora)

Histórico de uso não muda se o cadastro mestre for alterado depois.  
Não apagar `product_batch` referenciado por usages.  
Inventário completo: **STATUS: FUTURO / NÃO DECIDIDO**.

---

## 12. Fotos

- Eliminar Base64 como arquitetura definitiva (migração na A4/A6).
- Storage **privado**; path sugerido: `clinic/{clinic_id}/patients/{patient_id}/...`
- Metadata em `photos` (A1); binário no Storage (A4).
- Categorias: `before` | `during` | `after` | `follow_up`
- Vínculos opcionais: appointment, treatment_session, procedure

**Signed URL** (acesso temporário a arquivo) ≠ **Secure Link** (autorização de ação do paciente).

---

## 13. Documentos

Tabelas: `documents`, `document_versions`, `document_signatures`.

Tipos previstos: consentimento, anamnese, orçamento (doc), contrato, autorização de imagem, instruções pré/pós.

Status: `draft` | `sent` | `viewed` | `in_progress` | `signed` | `refused` | `expired` | `cancelled`

Documento assinado é imutável; alteração ⇒ nova versão.

Orçamentos comerciais também existem como `quotes` / `quote_items` (domínio V2 `Budget`).

---

## 14. Secure Links

Paciente sem conta. URLs do tipo:

- `/secure/term/{token}`
- `/secure/anamnesis/{token}`
- `/secure/quote/{token}`
- `/secure/appointment/{token}`

Regras:

- token criptograficamente aleatório e longo
- persistir apenas **hash** (`token_hash`)
- vínculo a clínica, paciente, recurso e ação
- `expires_at`, `revoked_at`, `used_at`
- escopo mínimo (sem acesso genérico ao paciente)
- preferir Edge Functions para operações sensíveis

**STATUS A1:** tabela `secure_links`. Runtime = **A5**.

---

## 15. Auditoria

Tabela `audit_logs` (append-oriented).

Campos: actor, clinic, action, entity_type, entity_id, timestamp, IP/UA quando disponível, metadata (sem dados clínicos desnecessários).

Eventos relevantes (implementação gradual): login/logout, assinatura, visualização sensível, prontuário, secure links, upload/download clínico.

**STATUS A1:** schema. Instrumentação completa = fases posteriores (A5+).

---

## 16. Routing / hosting

- Manter `BrowserRouter` (não HashRouter como solução definitiva).
- Produção V3: **Vercel** (ou Cloudflare Pages/Workers se houver justificativa clara).
- GitHub Pages **não** é o ambiente de produção V3.
- SPA rewrites para deep links (`/secure/...` sem navegação prévia).

**STATUS A1:** sem mudança de deploy. Configuração = **A7**.

---

## 17. Migração V2 → V3

Estratégia:

```
localStorage V2 → export JSON → ETL/import → staging/validation → PostgreSQL
```

Relatório: encontrados, importados, duplicidades, inválidos, erros, órfãos, fotos/docs.

- Senhas de pacientes **não** migram.
- Mecanismo V2 permanece até a migração ser validada.
- Idempotente sempre que possível.

**STATUS A1:** apenas mapping documentado (`docs/V2_TO_V3_MAPPING.md`). Script/execução = **A6**.

---

## 18. Roadmap de produto

| Versão | Foco |
|---|---|
| V1 | Operação da clínica |
| V2 | CRM + Auth + Consentimentos |
| **V3** | Patient 360 + Clinical CRM |
| V4 | Financial Intelligence |
| V5 | Growth + WhatsApp + Automação + IA |

Detalhe em `ROADMAP.md`.

---

## 19. Fases de implementação (fundação)

| Fase | Escopo |
|---|---|
| **A1** | Supabase scaffold + schema + migrations + docs *(esta entrega)* |
| **A2** | Auth + profiles/memberships runtime + RLS + testes RLS |
| **A3** | Data layer + substituição gradual do ClinicContext |
| **A4** | Storage privado + fotos |
| **A5** | Secure Links + Edge Functions + auditoria runtime |
| **A6** | Migração V2 → Postgres |
| **A7** | Routing + Vercel + deep links |
| **A8** | Testes de segurança + regressão V2 |

---

## 20. Prioridades

1. Segurança  
2. Integridade dos dados  
3. Isolamento entre clínicas  
4. Auditabilidade  
5. Capacidade de migração  
6. Estabilidade da V2  
7. Extensibilidade da V3  
8. UX  

---

## 21. Soft delete (política)

Não aplicar `deleted_at` em todas as tabelas.

| Abordagem | Entidades |
|---|---|
| Status + versionamento + audit (sem hard delete como fluxo normal) | `clinical_records`, `document_versions`, `document_signatures`, `treatment_product_usages`, `audit_logs` |
| `deleted_at` quando restauração fizer sentido | `patients`, `quotes`, `tasks`, `crm_leads` (quando apropriado) |
| Integridade | Não apagar `product_batches` referenciados por usages |

Na dúvida: preservar registro e usar status/arquivamento.

---

## 22. Identificadores

- PK: `uuid` com `default gen_random_uuid()`
- Sem `serial` / `bigserial` como PK de negócio
- UUID **não** é autorização; Auth + RLS + escopo de recurso são

---

*Última atualização: Fase A1 — schema e documentação de fundação.*
