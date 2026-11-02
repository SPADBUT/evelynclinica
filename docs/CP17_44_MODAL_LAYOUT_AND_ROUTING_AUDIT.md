# CP17.44 — Layout dos modais e auditoria da navegação V2/V3

Correção estrutural do modal compartilhado e diagnóstico do destino após o login. A autenticação, a recuperação de senha, o tenant e a autorização não foram alterados. Não houve commit, push, merge, deploy, migration, escrita no Supabase, e-mail ou uso de paciente real.

A branch de trabalho é `cursor/v3-0-foundation-a2`. O HEAD publicado continua `122088361699358e34948069947c7142210942c3` (`docs(v3): record CP17.42 preview deployment`). `origin/main` não foi modificado e permanece `52d62ee92a41e2b7e89201401453e10144d67ebf`.

O Preview visualmente homologado é o da aplicação `fa03058d8383fc2fa996620ac5a700c9683c6ad2`. Esta correção ainda não está nesse Preview.

## 1. Causa raiz dos dois defeitos visuais

Os dois defeitos usam o mesmo componente, `src/components/ui/Modal.tsx`.

- Cadastro em `/pacientes`: `PatientsPage` abre `Modal` com título “Novo paciente”. O primeiro campo é “Nome completo”.
- Novo orçamento em `/orcamentos`: `BudgetsPage` abre o mesmo `Modal` com título “Novo orçamento”. O primeiro campo é “Paciente”.

Nenhum dos dois formulários tinha posicionamento próprio. O corte vinha do overlay.

O overlay era `fixed inset-0` com `flex`, `items-start`, `justify-center`, `overflow-y-auto` e, a partir do breakpoint `sm` (desktop), `sm:items-center`. O painel tinha `my-4` e o miolo (`px-5 py-4`) não rolava.

Em um flex container com `align-items: center` e `overflow: auto`, um filho mais alto que a viewport é centralizado e o excesso é distribuído para fora dos dois lados. O início do filho fica acima da área visível e a rolagem do overlay não o traz de volta: o `scrollTop` mínimo continua mostrando o miolo, com o título cortado. Em 1920×1080 o formulário de paciente cabe quase inteiro e o corte depende da altura útil; em 1366×768, 1280×720 ou com zoom de 125% e 150%, o formulário passa da altura e o topo some. Por isso o nome ficava inacessível e o título do orçamento aparecia cortado no Edge, em desktop.

Não havia `top` nem `transform` empurrando o painel. O cabeçalho da aplicação não cobria o modal (`z-50`). O mecanismo era o alinhamento central dentro do scroller da página.

## 2. Arquivos alterados

- `src/components/ui/Modal.tsx` — layout do modal.
- `tests/modalLayout.test.tsx` — teste novo de layout e de regressão dos dois formulários V2.
- `docs/CP17_44_MODAL_LAYOUT_AND_ROUTING_AUDIT.md` — este relatório.

Não foram alterados `PatientsPage`, `BudgetsPage`, validações, campos, persistência, rotas, login, recuperação de senha, tenant ou autorização.

`docs/CP17_43_PRE_HOMOLOGATION.md` continua não rastreado, da etapa anterior, e não faz parte desta correção.

O mesmo `Modal` também é usado por agenda, fotos, consentimentos, contratos, CRM, detalhe do paciente e pelas telas V3 de pacientes e agenda. A correção vale para esses usos. Os formulários dessas telas não foram editados.

## 3. Solução aplicada

A rolagem deixou de ser do overlay e passou a ser do miolo do diálogo.

- Enquanto o modal está aberto, `document.body.style.overflow` fica `hidden`. Ao fechar, o valor anterior é restaurado. A página atrás do modal não rola.
- O overlay permanece `fixed inset-0 z-50 flex`, com `p-4`, sem `items-center`, sem `overflow-y-auto` e sem `sm:items-center`.
- O diálogo é `m-auto flex max-h-full min-h-0 w-full flex-col overflow-hidden`. A largura continua `max-w-3xl` quando `wide`, e `max-w-xl` nos demais. `min-h-0` permite que o item flex encolha abaixo do conteúdo; sem isso, `max-h-full` não limita um filho com `min-height: auto`.
- O cabeçalho, com o título e o botão Fechar, é `shrink-0`. Permanece visível.
- O miolo é `min-h-0 flex-1 overflow-y-auto overscroll-contain`. Campos e botões de ação rolam ali.
- Um diálogo curto continua centrado por `m-auto`. Um diálogo alto ocupa no máximo a viewport menos o respiro de `p-4` e não ultrapassa a altura útil.

Não houve deslocamento manual em pixels. Cores, borda, raio e tipografia do painel foram mantidos.

Os botões Cancelar e Salvar continuam no formulário, dentro da área rolável. Ficam acessíveis ao rolar o miolo. O título e o Fechar não saem da vista.

## 4. Testes executados e resultados

Em 2 de novembro de 2026, por volta de 14:37 (horário de Brasília):

| Verificação | Resultado |
|---|---|
| `npm test` | 21 arquivos passaram, 2 ignorados; 170 testes passaram, 19 ignorados. Os 2 novos estão em `tests/modalLayout.test.tsx`. Os testes de RLS continuam ignorados. |
| `npm run lint` | saída 0. Cinco avisos antigos de fast refresh, em `SupabaseAuthContext`, `AuthContext`, `V3TenantContext`, `ClinicContext` e `PatientsPage`. |
| Build com flag V2 | sucesso. Ver seção 5. |
| Build com flag V3 | sucesso. Ver seção 5. |

`tests/modalLayout.test.tsx` cobre:

- título fora da área `overflow-y-auto`, primeiro campo e botão Salvar dentro dela, classes `max-h-full`, `min-h-0` e `overflow-hidden`, ausência de `items-center` no diálogo, e `body` com `overflow: hidden`;
- login V2 de demonstração, abertura de “Novo paciente” em Prontuários e de “Novo orçamento” em Orçamentos, com título, primeiro campo e botão de salvar. O fechamento remove o diálogo.

A medição visual usou Chrome headless contra o Vite local em `http://127.0.0.1:5175`, com `VITE_BASE_PATH=/`, a mesma base do Preview. O zoom do navegador foi reproduzido pelo viewport CSS: largura e altura da tela divididas por 1, 1,25 e 1,5. Não foi o controle de zoom do Microsoft Edge; a restrição de layout é a mesma.

Combinações medidas: 1920×1080, 1366×768 e 1280×720, cada uma a 100%, 125% e 150%, para os dois modais. São 18 medições. Todas passaram.

Em cada uma:

- o diálogo inteiro ficou dentro da viewport;
- o título ficou visível antes e depois de rolar o miolo até o fim;
- o primeiro campo ficou visível sem rolar a página e sem rolar o miolo;
- o botão Salvar ficou inteiro na área rolável depois de levar o miolo ao fim;
- a rolagem da página permaneceu 0;
- `body` ficou com `overflow: hidden`;
- o miolo ficou com `overflow-y: auto`.

No caso mais baixo, 1280×720 a 150% (viewport CSS 853×480), o diálogo do paciente ocupou a faixa vertical de 16 a 464 px. O título ficou em 34–66 px. “Nome completo” ficou em 122–168 px. O miolo tinha 470 px de rolagem e o Salvar ficou alcançável. O orçamento teve o mesmo limite de altura, título visível, campo Paciente visível e 304 px de rolagem interna.

Capturas em `/opt/cursor/artifacts/modals/`: abertura em 1920×1080 a 100%, 1366×768 a 125% e 1280×720 a 150%; e o miolo rolado até os botões nesse último tamanho, para os dois formulários. Os nomes no seletor de orçamento são os pacientes fictícios da base de demonstração V2.

## 5. Evidências de build V2 e V3

Flag desligada, `VITE_SUPABASE_AUTH_ENABLED=false npm run build`:

- `tsc -b` e `vite build` concluíram sem erro.
- Um único JavaScript: `dist/assets/index-GORtYbLQ.js`, 387,43 kB (gzip 114,02 kB).
- CSS: `dist/assets/index-BK1ej0Vv.css`, 27,67 kB.
- O bundle contém “Clínica Estética · V2”.
- Não contém “Clínica Estética · V3”, `supabase` nem `createClient`.

Flag ligada, `VITE_SUPABASE_AUTH_ENABLED=true VITE_BASE_PATH=/ npx vite build --outDir /tmp/v3-flag-on --emptyOutDir`:

- 15 chunks JavaScript. O `tsc -b` já tinha passado no build V2, no mesmo código.
- Entrada `index-DKZznzmN.js`, 381,81 kB.
- Chunk da biblioteca `staffRecovery-C5f0yaV3.js`, 215,89 kB.
- O conjunto contém `createClient`, “Clínica Estética · V3”, “Esqueci minha senha” e `/v3/patients`.
- Esse diretório é local e não faz parte do Preview publicado.

`dist/` está no `.gitignore`. Nenhum artefato de build foi commitado.

## 6. Diagnóstico do redirecionamento após login

Nenhuma linha de autenticação foi alterada. A causa provável e a correção recomendada ficam só neste relatório.

### O que o código faz

`VITE_SUPABASE_AUTH_ENABLED` é lida em tempo de build. Só a string exata `true` liga o login V3 (`src/pages/LoginPage.tsx`).

Com a flag desligada, `V2LoginPage` envia equipe autenticada para `/` e paciente para `/portal`. A rota `/` é `DashboardPage`: título “Bom atendimento, …” e subtítulo “V2 — CRM, autenticação e assinatura digital de termos.”

Com a flag ligada, `SupabaseStaffLogin` não envia ninguém para `/`. Paciente V2 vai para `/portal`. Equipe com tenant `authenticated_ready` (`isAuthorizedStaff`) vai para `V3_STAFF_HOME`, que é `/v3/patients`, tanto no login novo quanto quando já existe sessão autorizada em `/login`. A recuperação de senha só navega para `/v3/patients` depois de `updateUser` sem erro.

`/` continua sendo o painel V2 de propósito. O comentário em `src/auth/staffAccess.ts` registra isso. O item “Painel” da navegação aponta para `/` nos dois modos.

O rodapé `V2 · CRM & assinatura` em `src/components/layout/AppLayout.tsx` é fixo. Aparece também quando a flag está ligada. Ver esse texto não prova que o bundle é V2.

`vercel.json` define apenas `VITE_BASE_PATH=/`. Não define a flag de autenticação. `.env.example` traz `VITE_SUPABASE_AUTH_ENABLED=false`.

### Telas V2 e telas V3

V2, presentes com a flag ligada ou desligada:

| Rota | Tela |
|---|---|
| `/login` | Login V2 somente com a flag desligada. Com a flag ligada, esta URL é o login Supabase. |
| `/` | Painel V2. |
| `/crm` | CRM. |
| `/pacientes` e `/pacientes/:id` | Prontuários. |
| `/agenda` | Agenda V2. |
| `/fotos` | Antes e depois. |
| `/termos` | Consentimentos. |
| `/contratos` | Contratos. |
| `/orcamentos` | Orçamentos. |
| `/portal` | Portal do paciente. |

V3, montadas só quando a flag é exatamente `true`. Com a flag desligada, `/v3/patients`, `/v3/patients/:id` e `/v3/agenda` redirecionam para `/`; `/auth/recovery` redireciona para `/login`.

| Rota | Tela |
|---|---|
| `/login` | Login de equipe Supabase, com “Esqueci minha senha”. Destino da equipe autorizada: `/v3/patients`. |
| `/auth/recovery` | Recuperação de senha. |
| `/v3/patients` e `/v3/patients/:id` | Pacientes clínicos. |
| `/v3/agenda` | Agenda clínica. |

Com a flag ligada, a navegação ganha “Pacientes” (`/v3/patients`) e “Agenda clínica” (`/v3/agenda`), além dos itens V2. “Prontuários” continua em `/pacientes`.

As capturas do defeito foram feitas em `/pacientes` e `/orcamentos`. Essas duas rotas são V2 nos dois modos.

### Causa provável

O único login de equipe que termina em `/` é o de `V2LoginPage`. `SupabaseStaffLogin` não possui navegação para `/`. Chegar ao painel V2 logo depois de entrar é o comportamento da flag desligada.

A flag do Preview publicado em `fa03058` continua **não comprovada**. A proteção SSO da Vercel impede ler o JavaScript e as variáveis da implantação sem sessão do time, e este ambiente não tem token da Vercel. O `vercel.json` não liga a flag. Se o projeto na Vercel também não tiver `VITE_SUPABASE_AUTH_ENABLED=true` no momento do build, o Preview executa o login V2 e abre `/`, com o rodapé “V2 · CRM & assinatura”.

Há um segundo caminho, que só existe se a flag estiver ligada: a pessoa entra, cai em `/v3/patients`, e depois abre `/` ou clica em “Painel”. O painel mostrado é o V2, e o rodapé continua com o texto V2. Isso não é um desvio do login; é o contrato atual de que `/` permanece o painel V2.

A observação da homologação — painel V2 imediatamente após o login, rodapé V2, e uso de `/pacientes` e `/orcamentos` — combina com a primeira explicação.

### Correção recomendada, ainda não aplicada

1. Confirmar, na configuração de Preview do projeto, que `VITE_SUPABASE_AUTH_ENABLED` é exatamente `true`, e gerar um novo Preview a partir do commit que já contém o login V3.
2. Só depois dessa prova, homologar de novo: o login de equipe autorizada deve abrir `/v3/patients`, e `/` deve continuar sendo o painel V2 se for acessado de propósito.
3. Não mudar o código de redirecionamento antes dessa confirmação. Se o bundle já estiver com a flag ligada, alterar `SupabaseStaffLogin` não explica a ida para `/`.
4. Trocar o texto do rodapé, ou fazer `/` abrir `/v3/patients` quando a flag está ligada, é outra decisão de produto. Não faz parte desta etapa.

## 7. Riscos e pendências

- O modal compartilhado mudou para todas as telas que o usam. A medição no navegador cobriu novo paciente e novo orçamento. Agenda, fotos, termos, contratos, CRM e os modais V3 herdam o mesmo limite de altura e a mesma rolagem interna, sem mudança de campos.
- Em viewport baixa, os botões de ação saem da primeira vista e reaparecem ao rolar o miolo. O título e o Fechar permanecem visíveis.
- O zoom foi medido pelo viewport CSS no Chrome, não pelo controle de zoom do Edge. Os 18 casos passaram, inclusive o equivalente a 1280×720 a 150%.
- O travamento de rolagem grava e restaura o `overflow` inline do `body`. Dois modais empilhados não são o uso atual.
- A autenticação não foi corrigida. A ida ao painel V2 depois do login permanece até a flag do Preview ser comprovada e, se estiver desligada, até um novo build com ela ligada.
- Esta correção de layout não está no Preview `fa03058`. Não houve deploy.
- RLS de ponta a ponta continua fora desta etapa e não está validado.
- Limitações já registradas na recuperação PKCE (sessão indeterminada quando a leitura falha, falha de `signOut` local com storage remanescente, e logout global do botão Sair) continuam como estavam.
