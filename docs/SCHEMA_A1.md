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

## Como aplicar (local)

Requer [Supabase CLI](https://supabase.com/docs/guides/cli) + Docker:

```bash
# na raiz do repositório
npx supabase start          # sobe stack local (se ainda não estiver)
npx supabase db reset       # aplica migrations do zero
# ou
npx supabase migration up
```

Sem projeto remoto nesta A1 — não há `SUPABASE_URL` / keys no código.

## Validação A1

Migrations aplicadas com sucesso em PostgreSQL 16 local com stub mínimo de `auth.users` (sem Docker/Supabase CLI neste ambiente).

Comandos recomendados com Supabase CLI + Docker:

```bash
npx supabase start
npx supabase db reset
```

Sem projeto remoto nesta A1 — não há `SUPABASE_URL` / keys no código.
