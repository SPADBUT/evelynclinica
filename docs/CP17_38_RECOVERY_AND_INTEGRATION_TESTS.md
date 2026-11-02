# CP17.38 — Código que não é recuperação e testes integrados

Correção local sobre a CP17.36. Não houve commit, push, deploy, e-mail, migration nem alteração de Supabase ou Vercel. RLS não foi executado contra banco real.

## Comportamento corrigido

`exchangeCodeForSession` grava a sessão antes de devolver o resultado. O evento `PASSWORD_RECOVERY` só ocorre quando o verifier PKCE termina em `/recovery`, e o cliente emite esse evento antes de a promise resolver.

Quando o código cria uma sessão e o evento não é `PASSWORD_RECOVERY`:

- O formulário de senha não abre.
- A mensagem é “Este link não corresponde a uma recuperação de senha válida.”
- O marcador `evelyn-v3-recovery-pending` é removido.
- A sessão lida antes da troca decide o que fazer:
  - Leitura bem-sucedida e nenhuma sessão local: `signOut({ scope: 'local' })`. O escopo local remove a sessão deste navegador e não revoga as outras sessões do usuário.
  - Leitura bem-sucedida com access token diferente: `setSession` restaura os tokens capturados antes da troca. Não há `signOut`.
  - O access token criado é o mesmo que já existia: a sessão local permanece.
  - A leitura falhou, ou os tokens capturados estão vazios: ninguém é desconectado. Não há como distinguir a sessão criada da que já existia.
- O link “Ir para o login” continua na tela. Sem sessão prévia, o login abre o formulário e não entra em `/v3/patients`.

Uma recuperação válida continua exigindo o evento, grava o marcador e só então mostra o formulário. O sucesso de `updateUser` segue para `/v3/patients`, onde o guard real decide.

## Arquivos

- `src/services/staffRecoverySession.ts`
- `src/pages/V3PasswordRecoveryPage.tsx`
- `tests/v3PasswordRecovery.test.tsx`
- `tests/staffLogin.flagOn.test.tsx`
- `docs/CP17_36_LOGIN_V3_IMPLEMENTATION.md`
- `docs/CP17_38_RECOVERY_AND_INTEGRATION_TESTS.md`

## Testes anteriores e novos

O teste que navegava para um parágrafo “Pacientes da equipe” foi removido. Os fluxos abaixo usam `App`, `SupabaseAuthProvider`, `V3TenantProvider`, `BrowserRouter` e o guard real. O cliente Supabase continua mockado. A paciente exibida é “Lia Sintetica”, dado sintético.

- Recuperação concluída, uma membership e clínica `clinic-a`: a lista mostra “Lia Sintetica” e “Nova paciente”, sem “Não foi possível listar”.
- Recuperação concluída sem membership: “Nenhuma membership ativa.”, botão “Entrar”, lista não consultada.
- Recuperação concluída com duas memberships: a escolha aparece e a lista não é consultada; depois do clique em manager, a consulta usa `clinic-b` e a paciente aparece.
- Falha de `updateUser`: o formulário “Definir senha” permanece e a lista não é consultada.
- Código com `SIGNED_IN` e sem sessão prévia: `signOut({ scope: 'local' })` uma vez, `setSession` não é chamado, e “Ir para o login” mostra o formulário V3 sem a paciente.
- Sessão prévia `prior-access` e código `code-access`: `setSession` restaura os tokens anteriores, `signOut` não é chamado, e o login seguinte abre a lista da sessão anterior.

O login com uma membership, em `tests/staffLogin.flagOn.test.tsx`, deixou de aceitar a falha da tabela `patients`. O mock devolve “Lia Sintetica”, a consulta registra `clinic-a`, e “Não foi possível listar” fica ausente. Os testes de ausência de membership, várias memberships, anônimo e V2 permanecem.

Continuam isolados, de propósito, os testes de URL, código expirado, confirmação divergente, senha curta, refresh do marcador e classificação de erro de envio. Eles não afirmam que o guard foi exercido.

## Limitações que os mocks não cobrem

- `getSession`, `exchangeCodeForSession`, `signOut` e `setSession` são mocks. O teste integrado prova a ordem das chamadas e o que o guard faz com a sessão publicada por esses mocks. Não prova o armazenamento real do GoTrue.
- Se `signOut({ scope: 'local' })` devolver erro sem lançar, o formulário continua fechado, mas o teste não simula essa falha. A sessão local pode permanecer.
- Se `setSession` falhar, o código não chama `signOut`, para não apagar a sessão capturada. O navegador pode ficar com a sessão do código. Esse fracasso não tem teste.
- Se `getSession` falhar antes da troca, ou se os tokens lidos estiverem vazios, não há `signOut` nem `setSession`.
- Uma exceção depois de o cliente real já ter gravado a sessão cai no estado “expirado” e não desfaz essa gravação. O mock não reproduz essa janela.
- O refresh token criado pelo código e depois substituído por `setSession` pode continuar válido no servidor. O escopo local não o revoga. Nenhum teste fala com o servidor.
- A página de pacientes e o repositório estão no fluxo, mas a política RLS não foi executada. Os 19 testes `V3_RLS_E2E` seguem ignorados.

## Testes e builds

`npm test`: 20 arquivos aprovados, 2 ignorados. 145 testes aprovados, 19 ignorados. Os ignorados são `tests/patientRls.e2e.test.ts` e `tests/clinicalRls.e2e.test.ts`.

`npm run lint`: os mesmos cinco avisos antigos de fast refresh. Nenhum aviso novo.

Build com a flag desligada: `dist/assets/index-CXDEYMue.js`, um único JavaScript. Contém “Clínica Estética · V2” e o path `v3/patients`. Não contém `supabase`, `createClient`, “Clínica Estética · V3”, “Esqueci minha senha”, “Nova paciente” nem “Recuperação de senha”.

Build com a flag ligada, em `/tmp/v3-flag-on`: 15 chunks. Contém o subtítulo V3, “Esqueci minha senha”, `/v3/patients`, `supabase` e a mensagem “Este link não corresponde a uma recuperação de senha válida.”

## Riscos que permanecem

- O shell e o endereço `/` continuam no painel V2. O menu ainda oferece os prontuários locais a qualquer papel com membership.
- Finance entra no shell e vê “Acesso restrito” na lista. Isso não foi alterado.
- A restauração da sessão prévia depende de `setSession` aceitar os tokens capturados. Se o cliente os recusar, a sessão do código pode ficar ativa e o formulário de senha continua fechado.
- O Preview publicado ainda não contém esta correção.
- O e-mail real de recuperação não foi enviado. RLS de pacientes não foi comprovado nesta etapa.
