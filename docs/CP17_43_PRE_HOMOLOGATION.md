# CP17.43 — Preparação da homologação funcional do Preview

Preparação apenas. Nenhum cenário abaixo foi executado. Não houve edição de código da aplicação, commit, push, merge, deploy, migration, SQL remoto, alteração de Supabase, de variável de ambiente, de proteção da Vercel, e-mail, criação de usuário ou uso de paciente real.

A homologação funcional continua não autorizada.

## Estado Git

Conferido em 2 de novembro de 2026, antes de criar este arquivo.

| Item | Valor |
|---|---|
| Branch atual | `cursor/v3-0-foundation-a2` |
| HEAD local | `122088361699358e34948069947c7142210942c3` |
| `origin/cursor/v3-0-foundation-a2` | `122088361699358e34948069947c7142210942c3` |
| Commit da aplicação | `fa03058d8383fc2fa996620ac5a700c9683c6ad2` |
| Mensagem da aplicação | `fix(v3): harden staff recovery and route entry` |
| `main` | `52d62ee92a41e2b7e89201401453e10144d67ebf` |
| `origin/main` | `52d62ee92a41e2b7e89201401453e10144d67ebf` |
| Alterações não commitadas | Nenhuma, no momento da conferência |
| `docs/CP17_42_PREVIEW_DEPLOYMENT.md` | Presente e rastreado |

`fa03058` é ancestral do HEAD. O único arquivo entre os dois commits é `docs/CP17_42_PREVIEW_DEPLOYMENT.md`. O código da aplicação publicado nesse commit não mudou depois dele.

Este documento é o único arquivo criado nesta etapa e permanece fora de commit, por restrição desta etapa.

## Diagnóstico do SSO

O deployment `B96kUtWBEBPYBsQnSpXT4skxaT5t` continua registrado no GitHub como deployment `7498434658`, ambiente Preview, `production_environment: false`, SHA `fa03058d8383fc2fa996620ac5a700c9683c6ad2`, status `success`.

URL: https://evelynclinica-qszvel7wt-spadbuts-projects.vercel.app

Às 14:15 (America/Sao_Paulo), um pedido sem sessão à raiz respondeu HTTP 302, `content-type: text/plain`, `server: Vercel`, `x-robots-tag: noindex`, com `location` em `https://vercel.com/sso-api` apontando de volta para essa mesma URL. O cookie de nonce da resposta não foi registrado.

Isso é a Vercel Authentication, a proteção de deployment da Vercel, não um erro da aplicação. A documentação atual da Vercel descreve o mesmo comportamento: visitante sem sessão é enviado ao login da Vercel; quem já está logado e tem acesso é autenticado e recebe um cookie restrito àquela URL. Quem não tem acesso é levado a pedir acesso.

Podem passar por essa proteção, sem desligá-la, contas já autorizadas no projeto: membros do time com papel de viewer ou superior, membros do projeto, grupos de acesso, usuários a quem o acesso já foi concedido. Link compartilhável e o cabeçalho de bypass de automação também existem na documentação. Nesta etapa nenhum dos dois foi criado. Criar qualquer um deles alteraria acesso ou produziria um token, o que está fora desta preparação.

Não há CLI da Vercel autenticada neste ambiente e não há credencial da Vercel disponível para ler o projeto. Por isso este agente não conclui o login e não vê o HTML publicado.

### Ação do proprietário, sem mudar a proteção

1. Entrar em https://vercel.com com a conta que já é membro do time `spadbuts-projects` e tem ao menos Viewer no projeto `evelynclinica`.
2. Abrir o deployment https://vercel.com/spadbuts-projects/evelynclinica/B96kUtWBEBPYBsQnSpXT4skxaT5t e usar a visita do próprio painel, ou abrir direto https://evelynclinica-qszvel7wt-spadbuts-projects.vercel.app no mesmo navegador.
3. Concluir o redirecionamento de login se a Vercel pedir. A proteção permanece ligada. O cookie vale para essa URL e não serve para outra URL do mesmo deployment.
4. Se a conta não tiver acesso, a tela de pedido de acesso aparece. Aceitar esse pedido seria uma mudança de acesso e não faz parte desta etapa.

Não desligar a Vercel Authentication. Não alterar Deployment Protection. Não gerar link compartilhável nem bypass.

## Feature flag

Classificação: **Não comprovado.**

Evidência disponível:

- `vercel.json` define só `VITE_BASE_PATH=/`. Não define `VITE_SUPABASE_AUTH_ENABLED`.
- `.env.example` traz `VITE_SUPABASE_AUTH_ENABLED=false`. Esse exemplo não é o ambiente da Vercel.
- O código liga o fluxo V3 somente quando o valor compilado é a string exata `true` (`src/lib/supabaseEnv.ts` e `src/pages/LoginPage.tsx`). Qualquer outro valor, inclusive vazio, mantém o login V2.
- O JavaScript publicado não pôde ser lido por causa do SSO.
- Não há credencial da Vercel neste ambiente para listar as variáveis do projeto. Nenhuma variável foi alterada.

O build local com a flag ligada não comprova o deployment. Também não há evidência de que a flag esteja desligada na Vercel, então o resultado não é “Incompatível”.

Durante a homologação futura, a primeira observação que comprova a flag é a tela `/login`:

- Subtítulo “Clínica Estética · V3” e botão “Esqueci minha senha”: flag ligada neste deployment.
- Subtítulo “Clínica Estética · V2” e ausência de “Esqueci minha senha”: flag desligada. Os cenários V3 seguintes ficam reprovados por incompatibilidade, não por falha de tela.

## Roteiro de homologação

Não executar agora. Usar somente contas e clínicas sintéticas já existentes, autorizadas pelo proprietário. Não criar usuário, não enviar e-mail e não abrir prontuário de paciente real nesta preparação. Não gravar senha, access token, refresh token nem link de recuperação na evidência. Registrar horário em America/Sao_Paulo, URL exata, texto visível e se a navegação ocorreu.

O roteiro pressupõe que o proprietário já atravessou o SSO na URL do deployment `fa03058`. Se a flag observada for a V2, interromper os itens 2 a 11 e registrar incompatibilidade.

### 1. Acesso à tela de login V3

Pré-condições: SSO concluído na URL do deployment. Navegador sem sessão da aplicação, ou sessão encerrada.

Passos: abrir `/login` nessa URL.

Resultado esperado: título Evelyn, subtítulo “Clínica Estética · V3”, campos de e-mail e senha, botão “Entrar” e “Esqueci minha senha”. A rota `/` não é a tela de login. Com a flag ligada, `/` continua sendo o painel V2 para quem já passou no guard.

Evidência: captura de `/login` sem mostrar senha. Anotar o subtítulo exato.

Aprovação: subtítulo V3 e “Esqueci minha senha” visíveis. Reprovação: subtítulo V2, ausência do pedido de recuperação, ou erro antes do formulário.

### 2. Login com usuário de equipe autorizado

Pré-condições: item 1 aprovado. Uma conta sintética de staff já existente, com perfil, uma membership ativa e papel que gerencia pacientes. Senha conhecida pelo proprietário. Nenhum paciente real precisa aparecer. Se a lista tiver paciente real, não abrir o prontuário e interromper a navegação de dados.

Passos: enviar e-mail e senha em `/login`.

Resultado esperado: a aplicação vai para `/v3/patients`. O guard só libera com tenant `authenticated_ready`. A lista da clínica da membership pode aparecer. Não deve aparecer “Não foi possível listar” para uma consulta bem-sucedida.

Evidência: URL final, papel visível e o fato de a lista ter carregado ou estado vazio. Não copiar dados clínicos. Não fotografar identificadores reais se aparecerem.

Aprovação: URL `/v3/patients` com a conta autorizada. Reprovação: permanece em `/login`, vai para `/`, mostra “Nenhuma membership ativa.” ou “Perfil não encontrado.” para essa conta.

### 3. Recuperação de senha por e-mail

Pré-condições: autorização explícita, separada, para enviar um e-mail. Conta sintética. Confirmar, sem alterar o Supabase, que a lista de redirect aceita a origem exata deste Preview. Sem essa confirmação, não enviar o e-mail. Não reutilizar link já gasto.

Passos: em `/login`, usar “Esqueci minha senha”, informar só o e-mail sintético e enviar. Abrir o link no mesmo tipo de navegador. Definir uma senha nova de teste, com confirmação igual e pelo menos 8 caracteres. Não registrar a senha.

Resultado esperado: a mensagem de envio não revela se a conta existe além do texto já previsto. O link abre `/auth/recovery` com o formulário “Definir senha”. Só depois de `updateUser` sem erro a navegação vai para `/v3/patients`, e o guard decide se a conta entra. Confirmação diferente mostra “A confirmação não confere.” e não chama a troca. Senha curta mostra “Use pelo menos 8 caracteres.”

Evidência: texto da tela de envio, presença do formulário, URL depois do sucesso, e a ausência de token na barra de endereço depois do carregamento. Não arquivar o corpo do e-mail.

Aprovação: formulário só no fluxo de recuperação e navegação para `/v3/patients` apenas após sucesso, se a conta for staff autorizado. Reprovação: formulário aberto para link inválido, senha alterada com erro na tela, ou token permanecendo na URL.

### 4. Acesso à rota `/v3/patients`

Pré-condições: item 2 aprovado, sessão da mesma conta.

Passos: recarregar `/v3/patients`. Usar o atalho “Pacientes” do menu, se estiver visível.

Resultado esperado: a rota permanece `/v3/patients`. O menu, com a flag ligada, oferece “Pacientes” e “Agenda clínica” além dos itens V2. “Painel” continua em `/`.

Evidência: URL e itens de menu visíveis, sem dados clínicos.

Aprovação: a rota autenticada permanece em `/v3/patients`. Reprovação: redireciona para `/` ou `/login` com a sessão autorizada ainda válida.

### 5. Verificação de membership e tenant

Pré-condições: a conta do item 2 tem uma membership ativa conhecida. Se existir uma segunda conta sintética com duas memberships, usá-la neste item. Não criar membership.

Passos: depois do login, observar clínica e papel. Se houver seletor, escolher uma clínica sintética e observar a lista. Trocar para a outra clínica sintética, se existir, e observar de novo.

Resultado esperado: uma membership entra direto. Várias memberships mostram “Há mais de uma clínica ativa. Selecione uma clínica.” A lista segue a clínica escolhida. O papel ativo aparece na identidade do staff.

Evidência: papel, identificador da clínica de teste e a URL. Não registrar nomes de pacientes.

Aprovação: a clínica ativa é uma das memberships da conta. Reprovação: lista de outra clínica, ou entrada sem seleção quando há mais de uma membership.

### 6. Acesso à agenda `/v3/agenda`

Pré-condições: sessão autorizada do item 2. Não criar, editar nem apagar agendamento nesta primeira passagem.

Passos: abrir `/v3/agenda` pelo menu “Agenda clínica” e, em seguida, recarregar a URL.

Resultado esperado: a rota permanece `/v3/agenda`. A agenda da clínica ativa carrega ou mostra estado vazio. Não deve cair no painel V2 nem na agenda V2 `/agenda`.

Evidência: URL e o estado vazio ou a indicação de que a grade carregou, sem detalhes clínicos.

Aprovação: `/v3/agenda` abre para o staff autorizado. Reprovação: redireciona para `/` ou `/login`, ou mostra a agenda V2 no lugar da V3.

### 7. Testes de navegação direta por URL

Pré-condições: anotar dois estados, sem sessão e com a sessão do item 2. Usar a barra de endereço. Não usar identificador de paciente real. Para detalhe, usar um id sintético inexistente, como `00000000-0000-4000-8000-000000000000`.

Passos, sem sessão: abrir `/v3/patients`, `/v3/agenda`, `/v3/patients/00000000-0000-4000-8000-000000000000`, `/auth/recovery` e `/`.

Passos, com sessão autorizada: repetir `/v3/patients`, `/v3/agenda`, o id inexistente e `/`.

Resultado esperado sem sessão: as rotas dentro do guard vão para `/login`. `/auth/recovery` sem código mostra “Não há sessão de recuperação. Abra o link mais recente neste navegador.” e não mostra “Definir senha”. `/` vai para `/login`.

Resultado esperado com sessão autorizada: `/v3/patients` e `/v3/agenda` abrem. O id inexistente não inventa paciente e mostra “Paciente não encontrada” ou equivalente de erro, sem ficha. `/` abre o painel V2, porque a entrada V3 não substitui o índice.

Evidência: URL inicial, URL final e o título da tela. Sem tokens.

Aprovação: cada rota cai no destino descrito. Reprovação: conteúdo V3 sem sessão, formulário de senha sem link de recuperação, ou paciente inventado para o id inexistente.

### 8. Testes de logout e sessão

Pré-condições: sessão do item 2 em um navegador. Não usar outro dispositivo como critério de aprovação. O botão “Sair” do staff continua chamando `signOut()` sem escopo. O comportamento global não foi alterado e não está resolvido.

Passos: acionar “Sair”. Tentar abrir `/v3/patients` de novo. Voltar a entrar com a mesma conta.

Resultado esperado neste navegador: a sessão local some e `/login` volta a aparecer. `/v3/patients` sem sessão volta a `/login`. Um novo login funciona. Não exigir que outras sessões da mesma conta permaneçam. Se outra sessão cair, registrar como observação da limitação, não como correção.

Evidência: URL depois de sair e depois de entrar de novo. Não registrar tokens.

Aprovação: este navegador sai e o login seguinte entra. Reprovação: “Sair” deixa `/v3/patients` utilizável neste navegador, ou o novo login falha para a mesma conta.

### 9. Usuário sem membership

Pré-condições: conta sintética já existente, com autenticação válida e sem membership ativa. Não remover membership de conta real para produzir esse caso.

Passos: entrar em `/login` com essa conta. Tentar `/v3/patients` se a tela permitir.

Resultado esperado: “Nenhuma membership ativa.” ou “Perfil não encontrado.”, com “Sair”. A lista de pacientes e a agenda V3 não abrem.

Evidência: texto da negativa e a URL. Sem dados de paciente.

Aprovação: a conta não entra no shell V3. Reprovação: `/v3/patients` ou `/v3/agenda` abrem.

### 10. Usuário sem autorização

Pré-condições: não criar conta. Separar dois casos só se a conta sintética já existir.

Passos: em `/login`, tentar uma senha incorreta da conta do item 2. Se já existir conta sintética com papel que entra no shell e não gerencia pacientes, entrar com ela e abrir `/v3/patients`.

Resultado esperado: senha incorreta mostra “E-mail ou senha inválidos.” e permanece em `/login`. Papel sem `patients.manage` pode passar do guard e, na lista, mostra “Acesso restrito” e “O papel ativo não gerencia pacientes.”, sem a lista.

Evidência: texto exato e URL. Não mostrar a senha.

Aprovação: credencial inválida não cria sessão utilizável. O papel sem gestão não vê a lista. Reprovação: senha incorreta entra, ou o papel sem gestão lista pacientes. Se a conta de papel restrito não existir, o segundo caso fica bloqueado, não reprovado.

### 11. Isolamento entre clínicas

Pré-condições: duas clínicas sintéticas e uma conta de teste que participe só de uma delas, ou duas memberships sintéticas na mesma conta. Ambiente de teste apropriado significa que ambas as clínicas e os registros visíveis são sintéticos. Se isso não existir, não criar clínica, não copiar paciente e marcar o item como bloqueado.

Passos: entrar com a conta de uma clínica e observar só o identificador da clínica ativa em `/v3/patients` e `/v3/agenda`. Se houver seletor, trocar para a outra clínica sintética e observar de novo. Não abrir ficha.

Resultado esperado: cada tela usa somente a clínica ativa. Não aparece registro da clínica da qual a conta não é membro.

Evidência: identificadores das clínicas de teste e a ausência de mistura. Sem conteúdo clínico.

Aprovação: a clínica ativa delimita a lista e a agenda. Reprovação: dados de uma clínica aparecem com outra clínica selecionada. Bloqueio: não há duas clínicas sintéticas já prontas.

## Limitações conhecidas

Estas limitações não estão resolvidas.

- RLS e2e não foi executado. Os 19 testes que dependem de `V3_RLS_E2E` continuam ignorados. A homologação de tela não valida RLS.
- Se a leitura da sessão falhar depois de uma troca de código PKCE, a origem da sessão pode ficar indeterminada. O fluxo não faz logout nesse caso. A sessão que estiver no navegador pode permanecer, e a tela não deve ser lida como prova de que ela foi encerrada.
- Se `signOut({ scope: 'local' })` falhar antes de liberar o storage, a sessão pode permanecer no navegador. A interface não anuncia sucesso nesse caso.
- O logout global não foi alterado nesta etapa. O botão “Sair” do staff ainda usa `signOut()` sem escopo, e o padrão da biblioteca instalada é global.

## Bloqueios e ações para iniciar os testes

1. Autorização explícita para executar a homologação. Sem ela, o roteiro permanece só documento.
2. O proprietário precisa abrir o Preview com uma conta Vercel que já tenha acesso, na URL https://evelynclinica-qszvel7wt-spadbuts-projects.vercel.app, sem desligar o SSO.
3. No primeiro carregamento de `/login`, registrar o subtítulo. Se for V2, a flag deste deployment está incompatível com a homologação V3 e os itens 2 a 11 não começam.
4. Conta sintética de staff com uma membership ativa, senha sob guarda do proprietário, e nenhuma necessidade de abrir paciente real.
5. Para os itens 9, 10 e 11, as contas ou a segunda clínica sintética precisam já existir. Não criá-las nesta preparação.
6. O e-mail de recuperação só entra no roteiro com autorização própria e com a origem deste Preview já aceita no redirect. Esta etapa não enviou e-mail.

Até essas condições, a homologação funcional não começa.
