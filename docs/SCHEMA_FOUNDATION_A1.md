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
| `patients` | Cadastro de pacientes (sem Auth) |
| `audit_logs` | Trilha append-only |

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
SET search_path = public
-- return staff_profiles.organization_id where id = auth.uid() and is_active
```

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

`clinical.*` está preparado para tabelas clínicas futuras. Em A1 só existe `patients` (operacional).

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

## Validação

```bash
./supabase/scripts/run_a1_validation.sh
```

Cobre: cross-org IDOR, anon, spoof de `organization_id`, spoof de role via `user_metadata`, SECURITY DEFINER/`search_path`, RBAC assistant vs clinician, bypass do `service_role`.

## Fora de escopo A1

Patient 360, clinical records, treatments, documents, CRM, secure links, Storage, Edge Functions, Auth runtime frontend (A2), Vercel (A3).
