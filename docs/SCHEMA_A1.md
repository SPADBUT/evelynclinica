# Schema V3 — referência rápida (A1)

Migrations em `supabase/migrations/`.  
RLS **não** habilitado nesta fase (A2).

## Tabelas

| Tabela | `clinic_id` | Soft delete / imutabilidade |
|---|---|---|
| `clinics` | — | — |
| `profiles` | — | FK → `auth.users` |
| `clinic_memberships` | sim | `is_active` |
| `patients` | sim | `deleted_at` |
| `patient_tags` | sim | cascade com patient |
| `crm_leads` | sim | `deleted_at`; `patient_id` nullable |
| `procedures` | sim | `is_active` |
| `procedure_templates` | sim | — |
| `treatments` | sim | `status` |
| `treatment_sessions` | sim | `status` |
| `appointments` | sim | `status` |
| `clinical_records` | sim | `status` (sem hard delete como fluxo) |
| `clinical_record_versions` | sim | versionamento imutável |
| `documents` | sim | `status` |
| `document_versions` | sim | versionamento imutável |
| `document_signatures` | sim | append |
| `quotes` | sim | `deleted_at` |
| `quote_items` | sim | cascade com quote |
| `products` | sim | `is_active` |
| `product_batches` | sim | bloqueio de delete se usado |
| `treatment_product_usages` | sim | snapshot + append |
| `photos` | sim | metadata; Storage A4 |
| `interactions` | sim | — |
| `alerts` | sim | `is_done` |
| `tasks` | sim | `deleted_at` |
| `secure_links` | sim | hash only; runtime A5 |
| `audit_logs` | nullable | append |

## Diagrama clínico (conceitual)

```
clinics
  └── patients
        ├── treatments
        │     └── treatment_sessions ── appointments
        │           └── clinical_records
        │                 └── clinical_record_versions
        │                 └── treatment_product_usages ← product_batches ← products
        ├── documents → document_versions → document_signatures
        ├── photos
        └── secure_links
```

## Integridade same-clinic (A1)

FKs simples não impedem `entity.clinic_id` ≠ `related.clinic_id`.  
Migration `20260926020700_same_clinic_integrity.sql` adiciona triggers estruturais para:

- `crm_leads.patient_id`, `quotes`/`interactions` patient/lead
- cadeia clínica: treatment → session → appointment → clinical_record(+version)
- `documents` / versions / signatures (patient, quote, version ownership)
- `product_batches.product_id` e `treatment_product_usages` (batch/product)
- `photos`, `alerts`, `tasks`, `patient_tags`
- `secure_links` (patient + recurso polimórfico na mesma clínica)

**RLS ainda não está implementado** — esses triggers são preparação estrutural para A2.

## `current_version_id` (FK circular controlada)

`clinical_records.current_version_id` → `clinical_record_versions.id`  
`documents.current_version_id` → `document_versions.id`

Por que existe: ponteiro estável para a versão “atual” sem varrer `max(version_number)`.

Por que é seguro na criação:

1. A coluna é **nullable** — o header nasce com `current_version_id = null`.
2. Ordem canônica de insert: **header → version → UPDATE do ponteiro**.
3. Trigger same-clinic exige que o ponteiro aponte para uma versão **do mesmo** record/document e da mesma clínica.

Não usamos `DEFERRABLE` nem ordem frágil de INSERT único: null + update posterior é o caminho explícito (também documentado em `docs/V2_TO_V3_MAPPING.md`).

## Como aplicar (local)

Requer [Supabase CLI](https://supabase.com/docs/guides/cli) + Docker:

```bash
npx supabase start
npx supabase db reset
```

Sem projeto remoto nesta A1 — não há `SUPABASE_URL` / keys no código.

## Validação A1

**Schema SQL validado em PostgreSQL 16; validação completa do stack Supabase será realizada em A2 com Supabase CLI/Docker.**

Nesta fase:

- migrations aplicadas em PostgreSQL 16 com stub mínimo de `auth.users`
- smoke de isolamento same-clinic (lead↔patient, usage↔batch, documents, quotes, appointments, clinical_records, secure_links)
- **não** declarar que “Supabase local foi validado” — Docker/Supabase CLI não foram executados neste ambiente
