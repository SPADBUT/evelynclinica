# CP17.42 — Publicação controlada do Preview V3

Consolidação das etapas CP17.36, CP17.38, CP17.40 e CP17.41, com as limitações já registradas na CP17.41. A branch `main` não foi alterada. Não houve merge, promoção para Production, mudança de variável de ambiente, migration, escrita no Supabase, e-mail ou alteração de dado real.

RLS não foi executado e não está validado.

## Commit e branch

| Item | Valor |
|---|---|
| Branch | `cursor/v3-0-foundation-a2` |
| Commit da aplicação | `fa03058d8383fc2fa996620ac5a700c9683c6ad2` |
| Mensagem | `fix(v3): harden staff recovery and route entry` |
| Pai | `4f566409642fdd36db1dbc2bad0a53cbe4a0e335` |
| Push | `4f56640..fa03058` somente em `origin/cursor/v3-0-foundation-a2` |
| `origin/main` depois do push | `52d62ee92a41e2b7e89201401453e10144d67ebf` |

O commit inclui o código e os documentos CP17.36, CP17.38, CP17.39, CP17.40 e CP17.41. Não inclui `dist/`, `.env`, token nem segredo. Este relatório foi escrito depois do deploy e descreve esse commit. Um commit posterior só com este arquivo não muda a aplicação.

## Verificação antes do commit

Working tree conferido em `cursor/v3-0-foundation-a2`, HEAD `4f566409642fdd36db1dbc2bad0a53cbe4a0e335`, igual a `origin/cursor/v3-0-foundation-a2` naquele momento.

Arquivos do commit:

- `src/auth/staffAccess.ts`
- `src/pages/LoginScreen.tsx`
- `src/pages/SupabaseStaffLogin.tsx`
- `src/pages/V3PasswordRecoveryPage.tsx`
- `src/services/staffRecoverySession.ts`
- `tests/staffLogin.flagOn.test.tsx`
- `tests/v3PasswordRecovery.test.tsx`
- `docs/CP17_36_LOGIN_V3_IMPLEMENTATION.md`
- `docs/CP17_38_RECOVERY_AND_INTEGRATION_TESTS.md`
- `docs/CP17_39_PKCE_SESSION_SECURITY_REVIEW.md`
- `docs/CP17_40_PKCE_SESSION_FIX.md`
- `docs/CP17_41_PKCE_FAILURE_PATH_REVIEW.md`

Não havia outros arquivos modificados ou não rastreados.

Resultados, em 2 de novembro de 2026, 14:09 (America/Sao_Paulo):

- `npm test`: 20 arquivos aprovados, 2 ignorados, 168 testes aprovados, 19 ignorados. Os 19 ignorados são o RLS e2e.
- `npm run lint`: saída 0. Cinco avisos antigos de fast refresh, em `SupabaseAuthContext`, `AuthContext`, `V3TenantContext`, `ClinicContext` e `PatientsPage`.
- Build com `VITE_SUPABASE_AUTH_ENABLED=false`: `dist/assets/index-CXDEYMue.js`, um JavaScript, com “Clínica Estética · V2” e sem `supabase` ou `createClient`.
- Build com `VITE_SUPABASE_AUTH_ENABLED=true`, em `/tmp/v3-flag-on`: 15 chunks. A mensagem do link inválido e `scope` local estão em `V3PasswordRecoveryPage-ChP1pYQE.js`.

## Preview

O deployment foi lido na API de deployments do GitHub para o commit `fa03058d8383fc2fa996620ac5a700c9683c6ad2`.

| Item | Valor |
|---|---|
| Ambiente | Preview |
| Status | `success` — “Deployment has completed” |
| ID do deployment no GitHub | `7498434658` |
| ID mostrado no status da Vercel | `B96kUtWBEBPYBsQnSpXT4skxaT5t` |
| URL do deployment | https://evelynclinica-qszvel7wt-spadbuts-projects.vercel.app |
| Criado em | 2 de novembro de 2026, 14:10 (America/Sao_Paulo) |
| `production_environment` | `false` |
| SHA publicado | `fa03058d8383fc2fa996620ac5a700c9683c6ad2` |

Uma requisição a essa URL, às 14:11 (America/Sao_Paulo), respondeu HTTP 302 para `https://vercel.com/sso-api`, com `x-robots-tag: noindex`. O Preview está protegido por SSO da Vercel. Por isso o HTML e o JavaScript servidos não foram lidos.

## Feature flag

`VITE_SUPABASE_AUTH_ENABLED` não foi lida nem alterada no projeto da Vercel. O SSO impede ver o bundle publicado. O valor da flag neste Preview não está comprovado. Os dois builds locais acima só descrevem o que cada valor produz na máquina de build.

## Limitações e pendências

- As limitações da CP17.41 continuam: leitura ilegível depois da falha da troca não autoriza logout; `signOut({ scope: 'local' })` que preserva o storage deixa a sessão neste navegador; o access token vale até expirar; o botão “Sair” do staff ainda usa `signOut()` sem escopo.
- RLS ao vivo não foi validado.
- A homologação funcional do Preview, inclusive login, recuperação e a flag, não foi feita. O SSO bloqueia o acesso anônimo.
- Produção permanece no commit `52d62ee` da `main`. Nenhum domínio de produção foi alterado.

A homologação funcional aguarda autorização.
