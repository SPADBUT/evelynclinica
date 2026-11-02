# CP17.36 — Login da V3 e entrada em `/v3/patients`

Alteração local, ainda sem commit, push ou deploy. A Production e o Supabase remoto não foram modificados.

A CP17.38 ajustou o código PKCE que não é recuperação e substituiu a cobertura que usava um parágrafo no lugar de `/v3/patients`. O detalhe dessa correção está em `docs/CP17_38_RECOVERY_AND_INTEGRATION_TESTS.md`. Os números abaixo são da suíte reexecutada depois dessa correção.

## Arquivos modificados

- `src/pages/LoginScreen.tsx`
- `src/pages/SupabaseStaffLogin.tsx`
- `src/pages/V3PasswordRecoveryPage.tsx`
- `src/auth/staffAccess.ts`
- `tests/staffLogin.flagOn.test.tsx`
- `tests/v3PasswordRecovery.test.tsx`
- `docs/CP17_36_LOGIN_V3_IMPLEMENTATION.md`

## Decisões técnicas

O subtítulo de `LoginScreen` passou a ser um parâmetro. O valor padrão permanece `Clínica Estética · V2`, então `V2LoginPage` não muda de aparência. `SupabaseStaffLogin` envia `Clínica Estética · V3`. O botão “Esqueci minha senha” continua no `extra` desse formulário.

O destino de uma sessão Supabase já autorizada é a constante `V3_STAFF_HOME`, igual a `/v3/patients`. Ela é usada em dois pontos:

- `SupabaseStaffLogin`, quando `isAuthorizedStaff` é verdadeiro. Isso cobre o login que acaba de obter uma membership ativa, a escolha da clínica quando há mais de uma, e uma sessão já gravada em `evelyn-supabase-auth` ao abrir `/login`.
- `V3PasswordRecoveryPage`, depois de `updateUser` concluir.

`isAuthorizedStaff` continua exigindo `authenticated_ready`. Paciente V2 segue para `/portal`. Quem não tem membership permanece na tela de login com a recusa. Quem tem várias memberships continua escolhendo a clínica antes de entrar.

`/v3/patients` permanece dentro de `RequireStaff`. Com a flag ligada, `SupabaseRequireStaff` só libera o `Outlet` para staff autorizado. Sem sessão, a rota volta para `/login`. Com a flag desligada, `V3PatientListRoute` redireciona para `/` e o bundle não inclui o cliente Supabase.

`/` não foi trocado. O painel V2 continua sendo a home da flag desligada e permanece acessível pelo menu “Painel” quando a flag está ligada. O shell não foi reconstruído.

## Testes executados e resultados

`npm test`: 20 arquivos aprovados, 2 ignorados. 145 testes aprovados, 19 ignorados. Os 19 ignorados são os e2e de RLS, que só rodam com `V3_RLS_E2E=1`. Esta auditoria não executou esses e2e e não declara RLS validado em banco real.

Cobertura desta mudança, com o complemento da CP17.38:

1. Login Supabase com uma membership abre a lista, mostra a paciente sintética “Lia Sintetica”, consulta `clinic-a` e não mostra “Não foi possível listar” nem “Bom atendimento, Evelyn”.
2. Usuário autenticado sem membership vê “Nenhuma membership ativa.” e não vê a lista.
3. Várias memberships permanecem na escolha até o clique; só então a lista abre.
4. Recuperação concluída com membership ativa abre a página real de pacientes, não um texto substituto.
5. Sessão já existente em `/login` abre a lista sem chamar `signInWithPassword`.
6. Flag desligada mantém o login V2, o painel em `/` e `/auth/recovery` no login V2.
7. Flag ligada mostra “Clínica Estética · V3” e “Esqueci minha senha”. Flag desligada mostra “Clínica Estética · V2”.
8. Visitante sem sessão em `/v3/patients` cai no login e não vê “Nova paciente”.

`npm run lint`: cinco avisos antigos de fast refresh, sem aviso novo.

## Builds

Flag desligada: um único JavaScript, `dist/assets/index-CXDEYMue.js`. Contém “Clínica Estética · V2”. Não contém o cliente Supabase: as strings `supabase` e `createClient` estão ausentes, assim como “Clínica Estética · V3”, “Esqueci minha senha”, “Nova paciente”, “Recuperação de senha” e a string `/v3/patients`. O path relativo `v3/patients` e `v3/agenda` permanece no bundle porque `App.tsx` registra a rota. Com a flag desligada o componente da página não é importado e a rota redireciona para `/`.

Flag ligada, em `/tmp/v3-flag-on`: contém o subtítulo V3, “Esqueci minha senha”, `/v3/patients`, a mensagem de código que não é recuperação, e os chunks de login, recuperação e pacientes. O subtítulo V2 também permanece no bundle porque o formulário compartilhado continua no mesmo aplicativo.

## Comparação V2 e V3

| Situação | Flag desligada | Flag ligada |
|---|---|---|
| `/login` | Login V2, subtítulo “Clínica Estética · V2” | Login Supabase, subtítulo “Clínica Estética · V3”, com “Esqueci minha senha” |
| Sessão staff válida em `/login` | Painel V2 em `/` | Lista `/v3/patients` |
| Recuperação concluída | A rota nem abre o formulário V3; volta ao login V2 | `/v3/patients` |
| Sem sessão em `/v3/patients` | Guard V2 manda para `/login`; a página V3 não monta | Guard Supabase manda para `/login` |
| `/` | Painel V2 | Painel V2, se o staff já passou pelo guard |

## Riscos remanescentes

- O menu e o rodapé ainda dizem “Painel” e “V2 · CRM & assinatura”. Entrar em `/` manualmente continua abrindo o painel demo da V2.
- A lista de pacientes depende do Supabase. Um erro de leitura mostra “Não foi possível listar” dentro da rota V3, não devolve o usuário ao painel V2.
- O alias do Preview ainda não recebe este código. Não houve commit nem deploy.
- O fluxo real de e-mail de recuperação não foi executado.
