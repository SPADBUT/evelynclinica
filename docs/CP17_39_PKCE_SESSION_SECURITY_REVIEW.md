# CP17.39 — Revisão de segurança da sessão PKCE

Atualização CP17.40: a correção recomendada nesta auditoria foi implementada. O parecer e a matriz abaixo permanecem como registro da revisão. O resultado da implementação está na seção final e em `docs/CP17_40_PKCE_SESSION_FIX.md`.

Revisão somente de leitura da CP17.38. Nenhum código, Supabase, Vercel, migration, e-mail, commit, push ou deploy foi alterado. RLS não foi executado.

Biblioteca instalada, conferida em `package-lock.json`: `@supabase/supabase-js` 2.117.2 e `@supabase/auth-js` 2.117.2. O comportamento abaixo foi lido em `node_modules/@supabase/auth-js/dist/module/GoTrueClient.js` e `GoTrueAdminApi.js`, não inferido da documentação externa.

## Parecer

Os caminhos em que `getSession`, `signOut({ scope: 'local' })` ou `setSession` concluem sem erro atendem os dois princípios: o formulário não abre e a sessão inesperada não permanece; uma sessão anterior diferente é restaurada em vez de ser apagada com logout.

Os caminhos de falha não atendem os dois princípios ao mesmo tempo. Pior: quando a leitura prévia falha, quando não há refresh token utilizável, ou quando `setSession` devolve erro, a implementação não desconecta. A troca do código já substituiu o storage pela sessão nova. Deixar essa sessão ativa não preserva a sessão legítima, que já saiu do storage, e mantém a autenticação inesperada.

Por esse motivo, a CP17.38 não está pronta para Preview até tratar essas falhas. A correção recomendada não usa revogação global.

## O que o código faz

`src/services/staffRecoverySession.ts` lê a sessão antes de `exchangeCodeForSession`. O cliente instalado grava a sessão nova e emite `PASSWORD_RECOVERY` ou `SIGNED_IN` antes de a promise resolver (`GoTrueClient.js`, por volta das linhas 1647–1651). O evento de recuperação só sai quando o verifier PKCE termina em `/recovery`.

Se o evento não for `PASSWORD_RECOVERY` e existir sessão no resultado:

1. Apaga `evelyn-v3-recovery-pending`.
2. Se a leitura prévia não for confiável, retorna sem logout e sem restauração.
3. Se não havia access token, chama `signOut({ scope: 'local' })` e ignora o objeto `{ error }`. Só um `throw` entra no `catch`.
4. Se o access token criado é o mesmo da sessão anterior, não faz nada.
5. Se é diferente, chama `setSession` com os dois tokens capturados. Se o retorno traz `error`, ou se a chamada lança, retorna sem logout.

O formulário só aparece com o estado `ready`, depois do evento de recuperação. O estado `not_recovery` mostra “Este link não corresponde a uma recuperação de senha válida.” e o link para o login.

## Comportamento real do Supabase JS 2.117.2

### signOut({ scope: 'local' })

`_signOut` não é só local. Com um access token presente, chama `admin.signOut(jwt, scope)`, que faz `POST /logout?scope=local` (`GoTrueAdminApi.js`, linhas 65–75). Em seguida, se o escopo não for `others`, `_removeSession` remove a chave de storage, a chave de usuário, todos os verifiers PKCE, e emite `SIGNED_OUT`.

O comentário do próprio cliente diz que `local` encerra a sessão atual, e que `global`, o padrão, encerra todas. O JWT de acesso continua válido até expirar; o logout revoga o refresh token e apaga o storage. Isso não é revogação global, desde que o escopo enviado seja `local`. O código da CP17.38 passa esse escopo. Não chama `signOut()` sem argumentos.

Erro de API que não seja 401, 403 ou 404: a biblioteca ainda executa `_removeSession` e devolve `{ error }`. A CP17.38 não lê esse `error`. Na prática o storage já foi limpo, mas o código não confirma. Se `admin.signOut` lançar um erro que não é `AuthError`, a exceção sobe antes de `_removeSession`. O `catch` da aplicação engole a exceção, o formulário fica fechado e a sessão nova pode continuar no storage.

### setSession

`_setSession` rejeita token vazio com exceção. Se o access token não tem `exp`, ou se `exp` já passou, trata o token como expirado e chama `_callRefreshToken(refreshToken)`. Esse refresh fala com o servidor. Sucesso grava a sessão renovada e emite `TOKEN_REFRESHED`. Falha devolve `{ data: { user: null, session: null }, error }` sem gravar os tokens antigos.

Se o refresh falha e a sessão que está no storage ainda tem `expires_at` no futuro, `_callRefreshToken` preserva essa sessão armazenada. Depois do `exchangeCodeForSession`, o storage contém a sessão do código, normalmente recém-emitida e ainda válida. Uma falha ao renovar o refresh token anterior, portanto, deixa a sessão do código no storage. A aplicação vê `error` e não chama `signOut`.

Se o access token anterior ainda não expirou, `setSession` chama `_getUser(accessToken)`. Sucesso grava exatamente aqueles tokens e emite `SIGNED_IN`. Falha devolve `{ error }` e não grava. O storage continua com a sessão do código.

Refresh token já rotacionado ou revogado: o servidor recusa a renovação. A biblioteca não restaura o par antigo. Em projetos com detecção de reutilização, apresentar um refresh token já gasto pode invalidar a família daquele token. Esta revisão não executou esse servidor. O risco fica registrado, sem confirmação remota.

### Corrida de eventos

`_notifyAllSubscribers` espera cada callback. `exchangeCodeForSession` só retorna depois de emitir `SIGNED_IN` ou `PASSWORD_RECOVERY`. `SupabaseAuthContext` grava qualquer evento com sessão, sem filtrar o nome do evento. A ordem real é: evento da troca, depois `SIGNED_OUT` ou o evento da restauração, e só então o gate da página muda. O efeito de tenant cancela a carga do usuário anterior quando o id muda. Não há teste com o cliente real provando essa ordem sob atraso de rede.

Há guarda de época dentro de `_callRefreshToken` para um `signOut` que ocorra durante a gravação. A aplicação não coordena essa corrida; depende dessa guarda da biblioteca.

## Matriz de estados

A coluna “efetivo” descreve o que este código e a biblioteca 2.117.2 produzem. “Residual” é autenticação inesperada que continua utilizável no navegador. “Perda” é a sessão legítima anterior deixando de estar ativa neste navegador.

| Cenário | Estado inicial | Operação | Final esperado pelos dois princípios | Final efetivo | Residual ou perda |
|---|---|---|---|---|---|
| Sem sessão anterior, código não é recuperação, `signOut` local conclui e remove o storage | Storage vazio | Troca grava a sessão do código; `signOut({ scope: 'local' })` revoga essa sessão no `/logout?scope=local` e apaga o storage | Formulário fechado; navegador sem sessão; outras sessões do usuário intactas | Formulário fechado; `SIGNED_OUT`; login sem entrar na lista | Sem residual local. O JWT copiado antes do logout vale até expirar. Não é revogação global |
| Sem sessão anterior e `signOut` devolve `{ error }` depois de `_removeSession` | Storage vazio | A biblioteca limpa o storage e devolve erro; a aplicação ignora o erro | Igual ao sucesso local | Storage limpo, formulário fechado. A aplicação não verifica o retorno | Sem residual local se `_removeSession` rodou. A aplicação não prova isso |
| Sem sessão anterior e `signOut` lança antes de `_removeSession` | Storage vazio | `catch` engole a exceção | Sem autenticação inesperada | Formulário fechado e a sessão do código pode continuar gravada | Residual. O login seguinte entra na aplicação |
| Sessão anterior com os dois tokens e access token diferente; `setSession` conclui sem erro | Tokens A no storage | Troca grava B; `setSession(A)` grava A de novo, ou o par renovado de A, e emite `SIGNED_IN` ou `TOKEN_REFRESHED` | Formulário fechado; sessão ativa volta a ser A; B não fica ativo | Esse é o caminho implementado quando a rede aceita A | Sem residual de B. A local permanece. Se o refresh de A rotacionar o token, o par antigo de outra aba pode ficar inválido |
| Sessão anterior com access token igual ao da resposta | Token A | Nenhuma limpeza | A permanece; formulário fechado | A permanece, porque a comparação só olha o access token | Sem residual novo. Um refresh token diferente no objeto da troca, se a biblioteca já o gravou, fica no storage |
| Sessão anterior sem refresh token, ou com string vazia | Access token presente, refresh vazio ou ausente | `readPriorSession` marca a leitura como desconhecida. Não há logout nem `setSession` | Não dá para restaurar. O seguro é apagar só a sessão do código | A troca já substituiu o storage por B. B permanece | Residual de B. A local já foi perdida pela troca, e o código não a recupera |
| Access tokens diferentes e `setSession` devolve `{ error }` | Tokens A | A aplicação retorna sem `signOut` | B não pode ficar ativo. A local só sobrevive se a restauração gravar | B continua no storage quando o refresh ou `_getUser` falha e a biblioteca preserva a sessão armazenada | Residual de B. Perda local de A, que já tinha sido substituída |
| Access tokens diferentes e `setSession` lança | Tokens A | `catch` retorna sem logout | Igual à falha com `{ error }` | B permanece se a exceção ocorreu antes de gravar A | Residual de B e perda local de A |
| `getSession` devolve `error` ou lança, e o código não é recuperação | Desconhecido. Pode haver sessão no storage | Leitura marcada como desconhecida. Troca grava B. Sem logout | Sem B ativo. A local não pode ser restaurada porque os tokens não foram lidos | B permanece | Residual de B. A local, se existia, já foi substituída e não é protegida por esta omissão |
| `exchangeCodeForSession` devolve erro ou sessão nula | A ou vazio | Retorno `expired`. Sem `signOut` | A, se existia e a biblioteca não a substituiu, permanece. Formulário fechado | A biblioteca não grava sessão nesse retorno. A permanece | Sem residual novo. Sem perda provocada pela limpeza |
| `exchangeCodeForSession` grava a sessão e depois lança | A ou vazio | O `catch` da aplicação devolve `expired` e não limpa | Se a gravação foi de um código que não é recuperação, B não deveria ficar | B pode ficar gravada e a tela diz que o link expirou | Residual possível. Não há teste |
| Código válido de recuperação | A ou vazio | Evento `PASSWORD_RECOVERY`. Marcador gravado. Sem `signOut` e sem `setSession` | Formulário abre com a sessão de recuperação | É o que o código faz. O sucesso de `updateUser` segue para `/v3/patients` e o guard decide | A local é substituída pela sessão de recuperação. Isso é o fluxo pedido, não uma limpeza |

## Princípios quando os dois não cabem juntos

Depois que `exchangeCodeForSession` teve sucesso, o storage deste navegador já é a sessão do código. A sessão anterior só pode voltar se os tokens tiverem sido lidos antes e `setSession` gravar de novo. Não existe, neste cliente, um storage com as duas sessões.

O comportamento mais seguro, sem `signOut()` global:

- Restaurar com `setSession` somente quando os dois tokens anteriores foram lidos e o access token mudou.
- Se a restauração devolver `error` ou lançar, chamar `signOut({ scope: 'local' })` em seguida. Nesse momento o storage é a sessão do código. O logout local revoga essa sessão, não todas as sessões do usuário. A sessão anterior já não está no storage; o refresh token dela no servidor só permanece intacto se `setSession` não o tiver apresentado ao endpoint de refresh.
- Se a leitura prévia falhou, ou se não há refresh token, fazer o mesmo `signOut` local. Omitir o logout não devolve a sessão antiga.
- Ler `{ error }` de `signOut`. Se a chamada lançar, repetir não é obrigatório, mas o gate não pode ser tratado como prova de que o storage ficou vazio. Uma leitura posterior de `getSession` diria se ainda há sessão.
- Não chamar `signOut()` sem escopo.

Enquanto essa falha não for tratada, um código que não é recuperação pode deixar o usuário do código autenticado. O formulário de senha continua fechado. O link “Ir para o login” entra na área autorizada se essa conta tiver membership.

## Testes

Arquivo: `tests/v3PasswordRecovery.test.tsx`. O cliente é mock. `held` substitui o storage. `signOut` do mock sempre zera `held` e emite `SIGNED_OUT`. `setSession` do mock sempre grava os tokens pedidos e emite `TOKEN_REFRESHED`. Nenhum teste inspeciona a chave `evelyn-supabase-auth` nem o retorno `{ error }` real da biblioteca.

| Caso pedido | Existe | O que prova | O que não prova |
|---|---|---|---|
| Sem sessão anterior | Sim. “signs out a non-recovery code when no session existed and returns to login” | Chama `signOut({ scope: 'local' })` uma vez, não chama `setSession`, fecha o formulário, apaga o marcador e, com o mock apagando `held`, o login não mostra a paciente | Que o storage real foi removido, que `/logout?scope=local` foi chamado, ou o que acontece se `signOut` devolver erro ou lançar |
| Sessão anterior restaurada | Sim. “restores a pre-existing session when the code is not a recovery” | Não chama `signOut`, chama `setSession` com `prior-access` e `prior-refresh`, e o mock faz a lista abrir com a paciente da sessão anterior | Que o `setSession` real gravou os tokens, renovou um token expirado, ou emitiu `SIGNED_IN` |
| Sessão anterior preservada quando o access token é o mesmo | Não | — | — |
| Falha de `getSession` | Não | — | — |
| Falha de `setSession` | Não | — | — |
| Falha de logout local | Não | — | — |
| Código que não é recuperação | Sim, nos dois testes acima | O formulário não abre | Os modos de falha da limpeza |
| Recuperação válida | Sim. “opens the V3 patient list after a completed recovery with one active membership” | O evento abre o formulário, `signOut` não é chamado, e o guard real, com Supabase mockado, mostra “Lia Sintetica” para `clinic-a` | O verifier PKCE real e a gravação da sessão pela biblioteca |

Os testes integrados olham a interface depois que o mock publica a sessão. Isso é mais do que contar uma chamada, e ainda assim o estado final da sessão é o do mock, não o do GoTrue.

## Correções recomendadas

Não foram implementadas nesta etapa.

1. Em `forgetUnrelatedCodeSession`, se `setSession` devolver `error` ou lançar, chamar `signOut({ scope: 'local' })`.
2. Se `readPriorSession` não for confiável, fazer o mesmo logout local depois de uma troca que criou sessão e não emitiu `PASSWORD_RECOVERY`.
3. Ler `{ error }` de `signOut`. Não tratar ausência de exceção como storage vazio.
4. Testes de componente, ainda com mock, para: `getSession` com erro; tokens sem refresh; `setSession` com `{ error }` e a sessão do código ainda publicada; `signOut` lançando e a sessão do código permanecendo; access tokens iguais sem logout. O teste de falha deve mostrar o login sem a lista, ou registrar que a sessão residual continua, em vez de só esperar a chamada.
5. Não adicionar `signOut()` global.

## Riscos que permanecem mesmo com a correção

- O JWT de acesso da sessão do código vale até `exp`, mesmo depois do logout local.
- Restaurar por refresh pode rotacionar ou, no servidor, invalidar um refresh token já usado por outra aba. Isso não foi executado aqui.
- O shell V2, o Preview ainda sem este código e a ausência de RLS ao vivo continuam como na CP17.38.

## Resultado da implementação CP17.40

A correção foi aplicada em `src/services/staffRecoverySession.ts` e coberta por `tests/v3PasswordRecovery.test.tsx`. Não houve commit, push, merge, deploy, migration, alteração de Supabase ou de Vercel.

O defeito que bloqueava o Preview está fechado no cliente: depois de um código que não emite `PASSWORD_RECOVERY`, a sessão criada pela troca só permanece se a sessão anterior for restaurada de forma comprovada, ou se o access token efetivo continuar igual ao access token anterior. Leitura prévia falha, refresh token ausente, `setSession` com erro, `setSession` com retorno inconsistente e exceção em `setSession` passam a chamar `signOut({ scope: 'local' })`. O retorno e uma leitura seguinte de `getSession` são inspecionados. Erro, exceção ou sessão residual não são tratados como encerramento bem-sucedido e não disparam `signOut()` global.

Validação local desta etapa: `npm test` com 20 arquivos aprovados, 2 ignorados, 158 testes aprovados e 19 ignorados; `npm run lint` com os cinco avisos antigos de fast refresh; build com a flag desligada em `dist/assets/index-CXDEYMue.js`, sem cliente Supabase; build com a flag ligada em `/tmp/v3-flag-on`, com a mensagem de código inválido e `scope: local` no chunk de recuperação.

O parecer desta auditoria, de que a CP17.38 não estava pronta, continua válido como histórico. Com a CP17.40, o isolamento de sessão descrito acima fica pronto para Preview, ainda sem RLS executado e com os limites registrados em `docs/CP17_40_PKCE_SESSION_FIX.md`. Se `signOut({ scope: 'local' })` falhar antes de apagar o storage, a sessão do código continua neste navegador e a interface não afirma o contrário.
