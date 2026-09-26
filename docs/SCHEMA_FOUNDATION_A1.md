# Schema Foundation A1 (CANÔNICO)

> **Este é o schema canônico do V3.**  
> O schema anterior baseado em `clinics` / `profiles` / `clinic_memberships` está **superseded** e preservado apenas em `supabase/legacy/a1_clinics_superseded/`.

Checkpoint **A1** da Fase A — foundation mínima + RLS.

## Migrations (aplicáveis)

| Arquivo | Conteúdo |
|---|---|
| `20260926040000_extensions_and_helpers.sql` | `pgcrypto`, `set_updated_at()` |
| `20260926040100_organizations.sql` | `organizations` |
| `20260926040200_rbac_identity.sql` | `roles`, `permissions`, `role_permissions`, `staff_profiles`, `staff_roles` |
| `20260926040300_patients_and_audit.sql` | `patients`, `audit_logs` |
| `20260926040400_seed_rbac.sql` | seed roles/permissions/role_permissions |
| `20260926040500_rls_helpers.sql` | `current_organization_id()`, `has_permission()`, `staff_has_role()` |
| `20260926040600_rls_policies.sql` | grants + RLS policies |

## Tabelas (8)

| Tabela | Papel |
|---|---|
| `organizations` | Tenant root |
| `staff_profiles` | 1:1 com `auth.users` (equipe interna) |
| `roles` | Catálogo: `admin`, `clinician`, `assistant` |
| `staff_roles` | Atribuição de roles ao staff |
| `permissions` | Capacidades `domain.action` |
| `role_permissions` | Matriz role → permission |
| `patients` | Cadastro **operacional/demográfico** (sem Auth, sem campos clínicos) |
| `audit_logs` | Trilha append-only |

### `patients` — colunas (somente demográficas)

`id`, `organization_id`, `full_name`, `email`, `phone`, `cpf`, `birth_date`, `gender`, `address`, `status`, `deleted_at`, `created_at`, `updated_at`

**Não** inclui `allergies`, `medications`, `notes` nem outros dados clínicos.  
Conteúdo clínico futuro → tabelas protegidas por `clinical.read` / `clinical.write`.

## Relação de identidade

```
auth.users → staff_profiles → staff_roles → roles
                              roles ← role_permissions → permissions
```

- Pacientes **não** têm `auth.users` / `staff_profiles` / role.
- `user_metadata` **não** é autoridade de role nem de organização.

## `current_organization_id()`

```sql
SECURITY DEFINER
SET search_path = ''
-- all relations schema-qualified (public.staff_profiles, auth.uid(), …)
-- return organization_id where id = auth.uid() and is_active
```

Mesmo padrão em `has_permission()` e `staff_has_role()`.

- Fonte de verdade do tenant para RLS.
- Cliente **não** define `organization_id` confiável: policies exigem `organization_id = current_organization_id()`.
- `EXECUTE` revogado de `PUBLIC`/`anon`; concedido a `authenticated`.

## Matriz de roles × permissions (seed)

| Permission | admin | clinician | assistant |
|---|---|---|---|
| organizations.read | ✓ | ✓ | ✓ |
| organizations.manage | ✓ | | |
| staff.read | ✓ | ✓ | ✓ |
| staff.manage | ✓ | | |
| patients.read | ✓ | ✓ | ✓ |
| patients.write | ✓ | ✓ | ✓ |
| clinical.read | ✓ | ✓ | |
| clinical.write | ✓ | ✓ | |
| audit.read | ✓ | ✓ | |
| audit.write | ✓ | ✓ | ✓ |

- `patients.*` = cadastro operacional (assistant permitido).
- `clinical.*` = registros clínicos futuros (assistant **sem** acesso). Em A1 não há tabela clínica ainda; a ausência de `clinical.*` no assistant é validada nos testes.

## Matriz RLS (resumo)

| Tabela | anon | authenticated |
|---|---|---|
| organizations | sem grant / sem policy | SELECT própria org + `organizations.read`; UPDATE com `organizations.manage` |
| roles / permissions / role_permissions | sem acesso | SELECT se `current_organization_id()` not null |
| staff_profiles | sem acesso | SELECT org; INSERT/UPDATE com `staff.manage` + org match |
| staff_roles | sem acesso | SELECT org; INSERT/DELETE com `staff.manage` |
| patients | sem acesso | CRUD se org match + `patients.read`/`patients.write` |
| audit_logs | sem acesso | SELECT `audit.read`; INSERT `audit.write` (actor = self); sem UPDATE/DELETE |

`service_role` tem ALL + BYPASSRLS — **somente servidor**, nunca no frontend.

## Hardening futuro (A4 — não bloqueia A1)

`audit_logs` hoje permite INSERT autenticado com `audit.write`. Revisar em A4:

- evitar INSERT arbitrário de eventos pelo frontend;
- preferir triggers / RPCs controladas para eventos confiáveis.

## Versão do PostgreSQL

- `supabase/config.toml` → `db.major_version = 15` (**não alterado** até confirmação remota).
- Harness local A1 validou em **PostgreSQL 16**.
- Antes de `supabase db push` no projeto `evelyn-v3`, obter a versão real:

```sql
SHOW server_version;
-- ou: SELECT version();
```

SQL da foundation evita features exclusivas de uma major; alinhar `major_version` só após a leitura remota.

## Validação

```bash
./supabase/scripts/run_a1_validation.sh
```

Cobre: cross-org IDOR, anon, spoof de `organization_id`, spoof de role via `user_metadata`, SECURITY DEFINER + `search_path` vazio, assistant sem capacidades clínicas, ausência de colunas clínicas em `patients`, bypass do `service_role`.

## Fora de escopo A1

Patient 360, clinical records, treatments, documents, CRM, secure links, Storage, Edge Functions, Auth runtime frontend (A2), Vercel (A3), redesign de `audit_logs` (A4).
