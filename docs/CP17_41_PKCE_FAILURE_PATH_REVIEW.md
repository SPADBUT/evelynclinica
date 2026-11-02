# CP17.41 — Revisão dos caminhos de falha PKCE

Revisão da CP17.40 sobre dois resíduos: exceção em `exchangeCodeForSession` depois de uma possível gravação, e falha de `signOut` antes ou depois da remoção do storage. Biblioteca conferida no código instalado: `@supabase/supabase-js` 2.117.2 e `@supabase/auth-js` 2.117.2. Arquivos lidos: `GoTrueClient.js` (`_exchangeCodeForSession` por volta da linha 1606, `signOut` / `_signOut` por volta de 3414, `_saveSession` por volta de 4382, `_removeSession` por volta de 4418) e `GoTrueAdminApi.js` (`signOut`, linhas 65–84).

Os documentos CP17.36 a CP17.40 não foram reescritos. Não houve commit, push, deploy, migration, alteração remota, e-mail ou dado real. RLS não foi executado.

## Conclusão

**B. Correção parcialmente possível, com limitação explicitamente documentada.**

A parte distinguível foi implementada em `src/services/staffRecoverySession.ts`. O formulário de recuperação só abre quando `exchangeCodeForSession` devolve sessão e o evento é `PASSWORD_RECOVERY`. Onde a leitura não permite saber se a sessão atual é a anterior ou a do código, não há logout. O escopo global não é usado.

## Exceção em exchangeCodeForSession

`_exchangeCodeForSession` só rejeita a promise quando o erro capturado não é `AuthError` (`isAuthError` exige `__isAuthError`). Erros de autenticação, inclusive verifier ausente e falha do `/token`, voltam como `{ error, session: null }` e não gravam sessão, porque `_saveSession` ainda não rodou.

A gravação fica neste trecho, antes do retorno:

1. `_saveSession(data.session)`
2. `_notifyAllSubscribers(PASSWORD_RECOVERY ou SIGNED_IN)`
3. retorno da promise

`_notifyAllSubscribers` espera todos os assinantes com `Promise.all` e relança o primeiro erro. Um assinante que lance depois do save faz a promise rejeitar, ou voltar `{ error }` se o erro for `AuthError`, com a sessão já no storage. O mesmo vale se `_saveSession` gravar o item e uma linha seguinte lançar.

Depois da falha, o bootstrap lê `getSession` e compara com a sessão capturada antes da troca e com o evento observado durante a troca.

| Evidência depois da falha | Ação | Formulário |
|---|---|---|
| Leitura sem sessão e não havia sessão anterior | Nenhuma. Nada foi gravado | Fechado (`expired`) |
| Leitura igual ao access token anterior | Nenhuma. A troca não substituiu o storage | Fechado. A sessão anterior permanece |
| Leitura sem sessão, mas o par anterior foi capturado | `setSession`. Se a restauração não se confirmar e uma sessão aparecer, logout local | Fechado |
| Leitura com outro access token e o par anterior foi capturado | `setSession`. Falha comprovada segue para logout local | Fechado |
| Não havia sessão e agora há | Logout local. A troca criou a sessão | Fechado |
| A leitura anterior falhou, mas `SIGNED_IN` ou `PASSWORD_RECOVERY` anunciou exatamente o access token que está no storage | Logout local. O save já substituiu o que estava guardado | Fechado |
| A leitura seguinte falha ou lança | Nenhuma. A origem ficou indeterminada | Fechado. A sessão que estiver no storage permanece |
| A leitura anterior falhou, não houve evento, e ainda há sessão | Nenhuma. Pode ser a sessão antiga, que não foi lida | Fechado |

`PASSWORD_RECOVERY` seguido de exceção não abre o formulário. A promise não concluiu. Se o storage ficou com essa sessão nova e a leitura confirma, ela entra na limpeza acima.

`getSession` continua podendo renovar um token dentro da margem de 90 segundos. Essa leitura não é pura. Por isso uma confirmação ilegível não autoriza logout: `signOut` também lê a sessão por dentro e, se enxergasse a sessão anterior, revogaria o refresh token dela em `/logout?scope=local`.

## Falha de signOut

`_signOut` com access token chama `POST /logout?scope=local`. Em erro de API que não seja 401, 403 ou 404, chama `_removeSession` e devolve `{ error }`. Se `admin.signOut` lança um erro que não é `AuthError`, a exceção sobe antes de `_removeSession` e o storage continua. `_removeSession` apaga a chave e só então emite `SIGNED_OUT`. Uma exceção entre a remoção e o evento deixa o storage vazio sem avisar os assinantes. Uma exceção dentro do aviso pode ocorrer depois de os assinantes já terem recebido `SIGNED_OUT`, porque o aviso usa `Promise.all`.

| Caso | Storage | O que o código faz | O que a interface diz |
|---|---|---|---|
| `{ error }` e `_removeSession` já rodou, com `SIGNED_OUT` | Vazio | Uma chamada local. Não repete | O link não é recuperação válida, ou expirou. Não diz que a sessão foi encerrada |
| `{ error }` antes de remover, ou a leitura interna falha | Permanece | Uma chamada local. Não repete | Não diz que a sessão foi encerrada. O login ainda vê essa sessão |
| Exceção antes de remover | Permanece | Uma chamada local. Não repete | Igual à linha anterior |
| Exceção depois de remover, sem `SIGNED_OUT` | Vazio | Segunda chamada `signOut({ scope: 'local' })`. Sem access token, a biblioteca não chama `/logout`; só emite `SIGNED_OUT` | Não diz que a sessão foi encerrada. O login fica sem essa autenticação quando o segundo aviso ocorre |
| Exceção depois de remover, com `SIGNED_OUT` já observado | Vazio | Não repete | Não diz que a sessão foi encerrada |

A segunda chamada só existe quando a primeira falhou, `getSession` leu storage vazio e o evento `SIGNED_OUT` não foi visto. Se a segunda também falhar, o fluxo para. Não há escopo global.

Quando o storage preserva a sessão, não há outra ação segura com a API pública. Repetir o logout local revogaria de novo a mesma sessão se ela ainda estiver legível, e não há garantia de que a segunda tentativa apague o que a primeira não apagou. O access token continua válido até `exp` mesmo depois de um logout local bem-sucedido. Isso é comentário da própria biblioteca.

## Testes

O storage continua sendo a variável `held`. O mock de `signOut` lança se o escopo não for `local`. Os testes novos leem `held` depois que a tela assenta.

| Estado | Resultado comprovado |
|---|---|
| Exceção antes de gravar, com sessão anterior | `held` segue `prior-access`. Sem `signOut` e sem `setSession`. Formulário fechado |
| Exceção antes de gravar, sem sessão | `held` nulo. Sem `signOut` |
| Exceção depois de gravar, sem sessão anterior | `held` nulo depois do logout local. Login mostra “Entrar” |
| Exceção depois de substituir uma sessão capturada | `setSession` com o par anterior. `held` volta a `prior-access`. A lista abre para Lia Sintetica |
| `{ error }` depois de gravar e emitir `SIGNED_IN` | Logout local. `held` nulo. O texto do erro não aparece |
| `PASSWORD_RECOVERY` e exceção em seguida | Formulário fechado. `held` nulo |
| Leitura seguinte ilegível | Sem `signOut`. `held` continua a sessão gravada. A tela não diz que ela foi encerrada |
| Leitura anterior falha e a exceção não emite evento | Sem `signOut`. `held` continua a sessão que já estava lá |
| `signOut` limpa, não emite `SIGNED_OUT` e lança | Duas chamadas locais. `held` nulo. Login mostra “Entrar” |
| `signOut` limpa, emite `SIGNED_OUT` e lança | Uma chamada local. `held` nulo |
| `{ error }` com storage limpo, ou preservado, ou exceção antes de limpar | Os testes da CP17.40 seguem válidos: uma chamada, sem frase de sessão encerrada |

Suíte em 2 de novembro de 2026, 14:05 (America/Sao_Paulo):

- `npm test`: 20 arquivos aprovados, 2 ignorados, 168 testes aprovados, 19 ignorados. Os ignorados são o RLS e2e.
- `npm run lint`: saída 0, com os cinco avisos antigos de fast refresh.
- Build com a flag desligada: `dist/assets/index-CXDEYMue.js`, sem `supabase` e sem `PASSWORD_RECOVERY`.
- Build com a flag ligada, em `/tmp/v3-flag-on`: o chunk `V3PasswordRecoveryPage-ChP1pYQE.js` contém a mensagem do link inválido e `scope` local. O texto `scope` global aparece no chunk do cliente Supabase, que é a biblioteca, e não numa chamada nova deste fluxo.

## Limitações que permanecem

- Leitura ilegível depois da falha da troca: a sessão no storage fica como está.
- Leitura anterior ilegível e ausência de `SIGNED_IN` / `PASSWORD_RECOVERY`: uma sessão ainda presente não é encerrada.
- `signOut({ scope: 'local' })` que falha e deixa o storage ocupado: a autenticação continua neste navegador. A interface não anuncia o contrário.
- O JWT de acesso vale até expirar.
- `getSession` pode renovar token na margem de 90 segundos.
- O botão “Sair” do staff continua chamando `signOut()` sem escopo. Está fora deste fluxo.

## Parecer para Preview

O caminho em que a troca grava e depois falha deixou de manter essa sessão quando a leitura consegue provar a substituição. O caminho em que a origem não pode ser provada permanece sem logout, de propósito. Pronto para Preview com essa limitação explícita. A publicação continua aguardando aprovação.
