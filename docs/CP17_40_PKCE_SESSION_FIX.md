# CP17.40 — Isolamento da sessão na recuperação PKCE

Correção do defeito apontado na CP17.39. Um código PKCE que não emite `PASSWORD_RECOVERY` não pode deixar uma autenticação inesperada ativa neste navegador. A sessão anterior só permanece quando a restauração é comprovada. Não há logout global.

Biblioteca conferida no código instalado, não na documentação externa: `@supabase/supabase-js` 2.117.2 e `@supabase/auth-js` 2.117.2 (`package-lock.json`). Arquivos lidos: `node_modules/@supabase/auth-js/dist/module/GoTrueClient.js` e `GoTrueAdminApi.js`.

Nada foi publicado. Não houve commit, push, merge, deploy, migration, escrita no Supabase, alteração na Vercel, e-mail ou dado real. RLS não foi executado.

## Máquina de estados

A troca bem-sucedida grava a sessão do código antes de a promise resolver. A sessão anterior só pode voltar se os dois tokens tiverem sido lidos antes disso.

| Cenário | Leitura anterior | Depois da troca, se não houver `PASSWORD_RECOVERY` | Sessão final | Formulário |
|---|---|---|---|---|
| A. Não havia sessão | `getSession` sem erro e sem sessão | `signOut({ scope: 'local' })` sobre a sessão do código. O retorno é lido. `getSession` confirma o storage | Vazio quando o logout local remove o storage e não devolve erro | Fechado. Marcador ausente |
| B. Sessão anterior completa e diferente | Access token e refresh token capturados | `setSession` com esse par. Sucesso só se o retorno e o `getSession` seguinte tiverem o mesmo access token, e esse token for o anterior ou um token rotacionado do mesmo usuário. Caso contrário, logout local da sessão ativa | A anterior, quando a restauração fecha. Vazio, quando o logout local limpa. Residual, quando o logout local falha | Fechado. Marcador ausente |
| C. Access token anterior igual | Par completo e o access token da troca é o mesmo | Não chama `setSession` nem `signOut` se a leitura seguinte confirma o mesmo access token, ou se essa leitura falha. Se a leitura mostra outro access token, logout local | A sessão cujo access token foi confirmado | Fechado |
| D. Falha ao ler a sessão anterior | `getSession` devolve erro, lança, ou não há refresh token utilizável | A troca pode já ter substituído o storage. Logout local da sessão ativa. Não se afirma que a sessão anterior foi preservada | Igual ao fim do logout local. A sessão antiga não é reconstruída | Fechado. Marcador ausente |
| E. Falha ao restaurar | Par capturado, mas `setSession` devolve erro, lança, devolve sessão nula, ou a sessão efetiva não confere | `signOut({ scope: 'local' })`. Erro, exceção ou sessão ainda legível não são sucesso. Não há segunda tentativa com escopo global | Vazio só quando o retorno não tem erro e a leitura seguinte não mostra access token | Fechado. Sem texto de sessão encerrada |
| F. Código de recuperação | Qualquer | Evento `PASSWORD_RECOVERY`. Marcador `evelyn-v3-recovery-pending`. Sem `signOut` e sem `setSession` | Sessão criada pela troca | Aberto. `/v3/patients` só depois de `updateUser` sem erro. O guard decide |

`exchangeCodeForSession` que devolve erro, ou que lança, continua no caminho `expired`, sem logout. Nesse retorno a biblioteca não grava sessão quando o erro é de autenticação e ocorre antes de `_saveSession`. Uma exceção depois de `_saveSession` pode deixar a sessão do código gravada. Esse caso não é distinguível, no `catch`, de uma falha que não gravou nada. Um logout cego poderia apagar uma sessão anterior ainda válida. Fica como limite, não como sucesso silencioso.

## Comportamento observado na biblioteca 2.117.2

APIs usadas: `getSession`, `exchangeCodeForSession`, `onAuthStateChange`, `setSession` e `signOut({ scope: 'local' })`. Não foram usadas funções privadas.

### signOut({ scope: 'local' })

`signOut` sem argumentos usa escopo `global` (`GoTrueClient.js`, por volta da linha 3414). O fluxo de recuperação nunca chama essa forma.

`_signOut` lê a sessão atual e, com access token, chama `admin.signOut(jwt, scope)`. Isso faz `POST /logout?scope=local` (`GoTrueAdminApi.js`, linhas 65–84). O comentário da biblioteca diz que o JWT de acesso continua válido até expirar. O logout revoga o refresh token da sessão apresentada e, quando o escopo não é `others`, `_removeSession` apaga a chave de storage, a chave de usuário, os verifiers PKCE e emite `SIGNED_OUT`.

Erro de API fora de 401, 403 e 404: a biblioteca ainda chama `_removeSession` e devolve `{ error }`. Ausência de exceção, portanto, não significa `{ error: null }`. Se `admin.signOut` lança um erro que não é `AuthError`, a exceção sobe antes de `_removeSession` e o storage pode continuar. Se a leitura interna da sessão falha com um erro que não é sessão ausente, `_signOut` devolve `{ error }` sem remover o storage.

A aplicação lê `{ error }`, captura exceção e lê `getSession` em seguida. Qualquer um destes três resultados impede tratar a limpeza como concluída: erro retornado, exceção, leitura ilegível ou access token ainda presente. Não há repetição com escopo global.

### setSession

`_setSession` (por volta da linha 3033) lança `AuthSessionMissingError` para token vazio. Esse erro é `AuthError` e volta como `{ error }`, sem gravar. Access token sem `exp`, ou com `exp` no passado, vai para `_callRefreshToken`. Sucesso grava a sessão renovada e emite `TOKEN_REFRESHED`. Falha devolve `{ error }` e não grava o par antigo.

Se o refresh falha e a sessão armazenada ainda tem `expires_at` no futuro, `_callRefreshToken` preserva essa sessão (por volta das linhas 4307–4314). Depois da troca, essa sessão armazenada é a do código. Por isso uma restauração falha deixa a sessão do código no storage, e o passo seguinte é o logout local.

Access token ainda válido segue `_getUser` e, no sucesso, `_saveSession` mais `SIGNED_IN`.

### getSession

`getSession` público passa por `_useSession` e `__loadSession`. Storage vazio devolve sessão nula, sem refresh. Sessão cuja expiração está dentro de `EXPIRY_MARGIN_MS` (3 ticks de 30 segundos, 90 segundos) pode disparar refresh. Não existe leitura pública sem esse efeito. A confirmação usa `getSession` mesmo assim. Storage já apagado não tem o que renovar.

### Eventos

`exchangeCodeForSession` grava a sessão e só então aguarda os assinantes, com `PASSWORD_RECOVERY` quando o verifier termina em `/recovery`, senão `SIGNED_IN` (por volta das linhas 1647–1651). `SupabaseAuthContext` publica qualquer evento que traga sessão. Durante a restauração podem ocorrer `SIGNED_IN` da troca, `TOKEN_REFRESHED` ou `SIGNED_IN` de `setSession`, e `SIGNED_OUT` do logout local. A página só abre o formulário no estado `ready`, depois do bootstrap inteiro, então o evento intermediário da troca não abre o formulário.

## Testes e resultados

O storage do teste é a variável `held`. Cada mock grava, substitui ou apaga esse valor. O teste lê `held` depois que a interface assenta. `signOut` do mock lança se o escopo não for `local`.

| Caso | Teste | Estado final comprovado |
|---|---|---|
| Sem sessão anterior | signs out a non-recovery code when no session existed | `held` nulo, um `signOut({ scope: 'local' })`, marcador ausente, formulário fechado, login sem a paciente |
| Restauração comprovada | restores a pre-existing session when the code is not a recovery | `held` volta a `prior-access` / `prior-refresh` do usuário anterior, sem `signOut`, lista da clínica `clinic-a` |
| Access token igual | keeps the current session when the access token is unchanged | Sem `setSession` e sem `signOut`. Access token final `same-access`. Login abre a lista da sessão anterior |
| Access token informado igual, storage diferente | signs out locally when the reported access token matches but storage does not | Logout local e `held` nulo |
| `getSession` com erro antes da troca | ends the code session locally when getSession fails before the exchange | Sem `setSession`. Logout local. `held` nulo. Sem texto de preservação |
| `getSession` lança antes da troca | ends the code session locally when getSession throws before the exchange | Igual ao erro de leitura |
| Refresh token vazio | ends the code session locally when the prior refresh token cannot be restored | Tratado como leitura não restaurável. Logout local. `held` nulo |
| `setSession` devolve erro | signs out the code session when setSession returns an error | O par anterior é apresentado. A sessão do código é encerrada no storage do mock |
| `setSession` lança | signs out the code session when setSession throws | Logout local. A mensagem da exceção não aparece |
| Retorno sem erro e storage divergente | rejects a setSession result that does not match the stored session | Logout local. `held` nulo |
| Retorno sem erro ecoando a sessão do código | rejects a setSession result that only echoes the code session | Logout local. `held` nulo |
| Token rotacionado do mesmo usuário | keeps a rotated token only when it belongs to the prior user | `held` fica no token rotacionado do usuário anterior. Sem `signOut`. A lista abre |
| `signOut` devolve erro e limpa o storage | does not claim the session ended when signOut returns an error after clearing storage | `held` nulo, mas a tela não diz que a sessão foi encerrada |
| `signOut` devolve erro e o storage fica | leaves a residual session visible when signOut returns an error and storage remains | `held` continua a sessão do código. Login mostra “Perfil não encontrado.” Sem formulário de senha |
| `signOut` lança | leaves a residual session when signOut throws before clearing storage | `held` continua a sessão do código. A exceção não aparece. Sem segundo logout |
| Código que não é recuperação | os casos acima, fora da recuperação válida | Formulário fechado e marcador ausente |
| Recuperação válida | opens the V3 patient list after a completed recovery | `PASSWORD_RECOVERY`, sem `signOut`, `held` na sessão de recuperação, “Lia Sintetica” só depois de `updateUser` sem erro, consulta em `clinic-a` |
| Marcador depois de fluxo inválido | os fluxos inválidos gravam `evelyn-v3-recovery-pending` antes e esperam `null` depois | Marcador removido mesmo quando a limpeza não pode ser afirmada |

Paciente dos testes: Lia Sintetica, `patient-synthetic-1`, `lia.sintetica@example.com`, clínica `clinic-a`. Não é uma pessoa real.

Suíte completa, em 2 de novembro de 2026, 13:57 (America/Sao_Paulo):

- `npm test`: 20 arquivos aprovados, 2 ignorados, 158 testes aprovados, 19 ignorados. Os 19 ignorados são o RLS e2e, que permanece desligado.
- `npm run lint`: saída 0. Cinco avisos antigos de fast refresh, em `SupabaseAuthContext`, `AuthContext`, `PatientsPage`, `V3TenantContext` e `ClinicContext`.
- Build com a flag desligada: `dist/assets/index-CXDEYMue.js` (387,27 kB), um único JavaScript. Contém “Clínica Estética · V2” e o caminho `v3/patients`. Não contém `supabase`, `createClient`, o subtítulo V3, “Esqueci minha senha”, “Nova paciente”, `PASSWORD_RECOVERY` nem a mensagem do código inválido.
- Build com `VITE_SUPABASE_AUTH_ENABLED=true`, saída em `/tmp/v3-flag-on`: 15 chunks. A mensagem “Este link não corresponde a uma recuperação de senha válida.” está em `V3PasswordRecoveryPage-C6FfHVmU.js`, junto com `scope` local. Esse chunk não contém escopo global.

## Limitações técnicas

- `getSession` pode renovar a sessão quando o access token está na margem de 90 segundos. A confirmação não é uma leitura pura.
- O access token da sessão do código continua utilizável até `exp` depois do logout local. O logout revoga o refresh token enviado em `/logout?scope=local`, que é o da sessão então armazenada, não as outras sessões do usuário.
- Quando os access tokens coincidem, o refresh token gravado pela troca pode substituir o anterior. `setSession` não é chamado, para não apresentar de novo o refresh token antigo.
- Um token rotacionado só conta como a sessão anterior se o usuário anterior foi lido e o usuário efetivo é o mesmo. Sem id de usuário, a rotação cai no logout local.
- Se o logout local devolve erro, lança, ou a leitura seguinte ainda vê sessão, a interface fica no estado `not_recovery` e não anuncia sucesso. A sessão residual, quando existe, continua neste navegador.
- Exceção de `exchangeCodeForSession` depois de gravar a sessão não entra na limpeza.
- O botão “Sair” do staff continua em `supabaseAuthService.signOut`, que chama `signOut()` sem escopo. Isso é o logout explícito já existente, fora deste fluxo, e não foi alterado.

## Riscos residuais

- Preview e produção ainda não executam este código. RLS ao vivo não foi validado.
- Restaurar um refresh token expirado fala com o servidor e pode rotacionar a família desse token. Não houve chamada remota nesta etapa.
- Uma falha real de `signOut({ scope: 'local' })` antes de `_removeSession` deixa a autenticação do código ativa. A correção torna isso visível e não o converte em logout global.
- O shell da rota `/` continua o painel V2.

## Parecer para Preview

O bloqueio da CP17.39 está corrigido: código que não é `PASSWORD_RECOVERY` não conserva a sessão da troca quando a leitura anterior falha ou quando a restauração não se confirma, desde que o logout local remova o storage. A sessão anterior legítima permanece quando `setSession` e a leitura seguinte concordam.

Pronto para Preview nesse isolamento, sem tratar a limpeza falha como sucesso e sem RLS executado. A publicação continua aguardando aprovação. Não houve commit nem deploy.
