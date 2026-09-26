# A2 — Auth + RLS + Data Layer

Documento canônico da fase A2. Complementa `docs/V3_ARCHITECTURE.md` e `docs/SCHEMA_A1.md`.

---

## 1. Objetivo

Transformar a fundação A1 em uma aplicação com:

- Supabase Auth real (equipe)
- sessão persistente
- profiles + clinic memberships
- RLS multi-clínica
- autorização por papel/permissão
- Data Layer tipado (fundação)
- preparação para substituir mocks/localStorage gradualmente

**Fora de escopo A2:** Patient 360, CRM avançado, prontuário completo, Secure Links runtime, Storage, financeiro, WhatsApp, IA, login de paciente.

---

## 2. Arquitetura Auth

```
UI Login (email + password)
        ↓
AuthContext (identidade)
        ↓
Supabase Auth (session persistida no storage do client SDK)
        ↓
auth.getUser()  → identidade verificada quando necessário
        ↓
profiles (1:1 auth.users)
        ↓
ClinicScopeContext (autorização de clínica)
        ↓
clinic_memberships → clinics → currentClinic (preferência UI)
        ↓
Data Layer → Postgres + RLS
```

Separação:

| Camada | Responsabilidade |
|---|---|
| `AuthContext` | Identidade: user, session, loading, signIn/Out, resetPassword |
| `ClinicScopeContext` | Autorização de clínica: profile, memberships, role, `can()` |
| `ClinicContext` | Dados operacionais V2 ainda em localStorage (migração incremental A3+) |

Pacientes **não** usam Supabase Auth. Portal V2 por senha local permanece legado até Secure Links (A5).

---

## 3. Fluxo de sessão

1. App inicia → `AuthProvider` resolve sessão (`getSession` + listener `onAuthStateChange`).
2. Loading até a sessão ser conhecida.
3. Se autenticado via Supabase → `getVerifiedUser()` / profile fetch.
4. `ClinicScopeProvider` carrega memberships ativas e define `currentClinicId`.
5. Preferência de clínica em `localStorage` (`evelyn-current-clinic-id`) — **somente UX**.
6. Logout → `supabase.auth.signOut()` + limpa sessão legado.

Modo sem env Supabase: Auth legado V2 (localStorage + SHA-256) para não quebrar o demo GitHub Pages.

---

## 4. Profiles e memberships

- Trigger `handle_new_user` (A2 migration) cria `profiles` a partir de `auth.users`.
- Membership: `clinic_memberships (clinic_id, user_id, role, is_active)`.
- Fonte de verdade do papel: **membership.role** (`clinic_role`). Não há role duplicada em JWT custom claims nesta fase.

---

## 5. Roles e permissões

Enum A1: `admin | assistant | professional | finance | manager`.

Capacidades centralizadas em:

- SQL: `public.has_clinic_permission(clinic_id, permission)`
- TS: `src/lib/auth/permissions.ts` → `can(role, permission)`

Exemplos: `patients.read`, `patients.write`, `clinical_records.read`, `audit_logs.read`.

| Role | Resumo |
|---|---|
| `admin` | Acesso completo à clínica |
| `assistant` | Operacional (sem admin de memberships/clínica, sem audit) |
| demais | Preparadas no enum + matriz; uso futuro |

Frontend `can()` é UX. **RLS é segurança.**

---

## 6. RLS

Migrations:

- `20260926030000_a2_auth_profile_trigger.sql`
- `20260926030100_a2_rls_helpers.sql`
- `20260926030200_a2_rls_policies.sql`

Helpers (SECURITY DEFINER, `search_path = public`):

- `current_user_id()`
- `is_clinic_member(clinic_id)`
- `clinic_member_role(clinic_id)`
- `has_clinic_role(clinic_id, roles...)`
- `has_clinic_permission(clinic_id, permission)`

Princípio:

```
authenticated user → active membership → clinic_id → permission → SELECT/INSERT/UPDATE/DELETE
```

Tabelas com RLS: todas as de negócio A1, incluindo `clinics`, `profiles`, `clinic_memberships`, `audit_logs`, `secure_links`.

Append-only (sem UPDATE/DELETE via client): versions, signatures, usages, audit_logs (delete negado).

`secure_links`: acesso staff via membership; runtime paciente = A5 (não confundir com Auth admin).

---

## 7. Política multi-clínica

- Usuário pode ter N memberships.
- Seletor de clínica = preferência UI.
- Queries do Data Layer passam `clinic_id` da clínica atual para UX/performance.
- Isolamento real: policies RLS (testes em `supabase/scripts/rls_security_tests.sql`).

---

## 8. Data Layer

```
src/lib/data/
  auth.ts
  clinics.ts
  patients.ts
  appointments.ts
  treatments.ts
  documents.ts
  quotes.ts
  products.ts
  index.ts
```

Cliente único: `src/lib/supabase/` (`@supabase/supabase-js`, singleton, anon/publishable only).

UI não deve espalhar `supabase.from(...)` — usar o Data Layer.

Smoke na Dashboard: `SupabaseSmokePanel` (list/insert patients sob RLS).

---

## 9. Environment

`.env.example`:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Alias aceito: `VITE_SUPABASE_ANON_KEY`.

Nunca commitar `.env` / service_role.

Scripts:

```bash
npm run db:start
npm run db:reset
npm run db:types
npm run db:test:rls
```

---

## 10. Testes RLS

Arquivo: `supabase/scripts/rls_security_tests.sql`

Cobre TEST 1–10 (cross-clinic + orphan + admin/assistant).

Requer Docker + Supabase CLI local.

---

## 11. localStorage (auditoria A2)

| Chave | Classificação | Decisão A2 |
|---|---|---|
| `evelyn-clinic-v2` | C/D dado de negócio/clínico | Mantido como fonte V2 até A3/A6 |
| `evelyn-clinic-v1` | C legado | Somente migração one-shot |
| `evelyn-clinic-session-v2` | E sessão manual | Substituída por Supabase Auth quando configurado; legado para paciente/demo |
| `evelyn-current-clinic-id` | B preferência UI | OK permanecer |
| Storage interno do `@supabase/supabase-js` | sessão Auth | Gerenciado pelo SDK (não armazenar tokens manualmente) |

Detalhe: `docs/LOCALSTORAGE_AUDIT.md`.

---

## 12. Limitações deste ambiente / entrega

- **Docker não disponível** neste Cloud Agent → `supabase start` / `db reset` / execução real dos testes RLS **não** foram validados aqui.
- Tipos `database.types.ts` gerados manualmente a partir do schema; regenerar com `npm run db:types` quando o stack local estiver disponível.
- UI operacional continua em localStorage (A3 migrará gradualmente).
- Portal paciente por login local = legado V2 até A5.

---

## 13. Riscos restantes

- Matriz SQL/TS de permissões pode divergir se atualizada só de um lado.
- `auth.users` insert shape nos testes SQL pode variar entre versões do Supabase — ajustar se o stack local falhar.
- GitHub Pages sem env Supabase continua em modo legado (esperado).
- IDOR mitigado por RLS, mas A8 deve aprofundar regressão de segurança.

---

*A2 — Auth + RLS + Data Layer*
