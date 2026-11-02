# CP17.45 — Revisão final da CP17.44

Revisão da correção do modal compartilhado e checagem da flag do Preview. Nenhum arquivo de autenticação, redirecionamento, Supabase ou dado foi alterado. Não houve commit, push, merge, deploy, migration nem mudança de variável de ambiente.

A branch é `cursor/v3-0-foundation-a2`. HEAD local e `origin/cursor/v3-0-foundation-a2` continuam `122088361699358e34948069947c7142210942c3`. `origin/main` continua `52d62ee92a41e2b7e89201401453e10144d67ebf`.

A publicação em Preview não foi executada. A flag `VITE_SUPABASE_AUTH_ENABLED=true` não pôde ser comprovada.

## 1. Revisão do código

O componente alterado é `src/components/ui/Modal.tsx`. Há 25 aberturas em 13 telas: prontuários, orçamentos, agenda, fotos, consentimentos, contratos, CRM, detalhe do paciente e as telas V3 de pacientes, agenda e evolução. Os formulários dessas telas não foram editados.

Não há modal dentro de outro. Várias telas declaram mais de um `Modal` (consentimentos, contratos, CRM, detalhe do paciente, agenda V3, evolução clínica e detalhe V3). Cada um abre por um controle da página, atrás do overlay `fixed inset-0 z-50`. Nenhum miolo de modal liga o estado de outro. Na execução, “Novo paciente” deixou um único `[role="dialog"]`.

Os estados são independentes. Se algum código futuro deixasse dois abertos ao mesmo tempo, o efeito de cada um guarda o `overflow` anterior. Fechar o mais recente devolveria `hidden`. Fechar o primeiro enquanto o segundo continuasse aberto devolveria o valor anterior do primeiro e a página voltaria a rolar. Esse caminho não existe nas telas atuais. Não foi aplicada trava compartilhada, porque isso seria uma mudança além do uso real.

A restauração é segura no uso atual. O efeito grava `document.body.style.overflow`, define `hidden` e, na limpeza, devolve o valor gravado e remove o listener de Escape. Foi conferido no Chrome local, em `http://127.0.0.1:5175` com `VITE_BASE_PATH=/`:

- Abrir “Novo paciente” deixou `overflow` em `hidden`.
- Digitar no primeiro campo manteve um diálogo e `overflow: hidden`. O `onClose` inline das páginas muda a cada render e reexecuta o efeito; a trava foi reaplicada e o diálogo permaneceu.
- Um `keydown` com `Escape` no `window` fechou o diálogo e devolveu `overflow` para vazio.
- O botão com `aria-label="Fechar"` está no cabeçalho, fora da área `overflow-y-auto`, visível, e o clique fechou o diálogo com `overflow` vazio.
- Navegar para `/` com o modal aberto desmontou o diálogo e deixou `overflow` vazio.

O `keyboard.press('Escape')` do harness headless não entregou nenhum `keydown` à página. O listener da aplicação respondeu ao evento disparado na própria página. Isso não é falha do modal.

A rolagem interna do formulário longo funcionou. Em viewport 1280×640, o miolo de “Novo paciente” tinha 310 px roláveis. Depois de ir ao fim, o botão Salvar ficou dentro do miolo, o título continuou visível e a rolagem da página ficou em 0. O diálogo terminou em 624 px, dentro dos 640 px da viewport.

Deslocamento pela barra de rolagem: nesta instância do Chrome a página rolava (altura do documento 605 px contra viewport de 420 px) e a largura da barra, `innerWidth - clientWidth`, era 0 antes e depois de abrir. A coluna principal permaneceu em 260 px. Não houve deslocamento observável. O CSS pede uma barra WebKit de 8 px em `src/index.css`. Neste Chrome a barra não ocupa largura de layout. Um Edge de desktop que reserve esses 8 px pode mover o fundo em cerca de 8 px quando `overflow: hidden` esconde a barra. Isso não foi reproduzido aqui e não deixa conteúdo do modal inacessível. A compensação, se a homologação no Edge mostrar o salto, é `scrollbar-gutter: stable` em `html`. Não foi aplicada nesta revisão.

Não foi encontrado defeito que impeça a correção da CP17.44. O código do modal não foi alterado nesta etapa.

## 2. Testes

Executados em 2 de novembro de 2026, por volta de 14:44 (horário de Brasília).

| Verificação | Resultado |
|---|---|
| `npm test` | 21 arquivos passaram, 2 ignorados. 170 testes passaram, 19 ignorados. |
| `npm run lint` | saída 0. Cinco avisos antigos de fast refresh, em `ClinicContext`, `SupabaseAuthContext`, `AuthContext`, `V3TenantContext` e `PatientsPage`. |
| Build V2, `VITE_SUPABASE_AUTH_ENABLED=false npm run build` | `tsc -b` e `vite build` sem erro. Um JavaScript: `dist/assets/index-DpspT_BS.js`, 387,43 kB. Contém “Clínica Estética · V2” e `max-h-full`. Não contém `supabase`, `createClient`, “Clínica Estética · V3” nem a classe antiga `sm:items-center` do overlay. |
| Build V3, `VITE_SUPABASE_AUTH_ENABLED=true VITE_BASE_PATH=/ npx vite build --outDir /tmp/v3-flag-on --emptyOutDir` | 15 chunks. Contém `createClient`, “Clínica Estética · V3”, `/v3/patients` e `max-h-full`. A classe antiga do overlay não está no bundle. Saída local, fora do Git. |

Os 19 testes ignorados são os de RLS de ponta a ponta: 15 em `tests/patientRls.e2e.test.ts` e 4 em `tests/clinicalRls.e2e.test.ts`. Os dois arquivos usam `describe.skipIf` enquanto `V3_RLS_E2E` não é `1`. Continuam pendentes. Não estão aprovados. RLS não foi executado.

`tests/modalLayout.test.tsx` monta o `Modal` compartilhado e também a aplicação V2. O primeiro teste confere a estrutura: o título fica fora do miolo rolável, o campo e o botão Salvar ficam dentro, e `document.body.style.overflow` fica `hidden`. As classes `max-h-full`, `min-h-0` e `overflow-hidden` entram como parte dessa checagem, não como única asserção. O segundo teste entra com a conta de demonstração, abre “Novo paciente” e “Novo orçamento” pelas páginas reais, confere título, primeiro campo e botão de salvar, vê a trava de rolagem e fecha pelo botão Fechar. Esse arquivo não dispara Escape nem afirma a restauração do `overflow` depois do fechamento. Essas duas conferências foram feitas no navegador, nesta revisão.

## 3. Estado Git

| Item | Valor |
|---|---|
| Branch | `cursor/v3-0-foundation-a2` |
| HEAD | `122088361699358e34948069947c7142210942c3` |
| `origin/cursor/v3-0-foundation-a2` | o mesmo commit |
| `origin/main` | `52d62ee92a41e2b7e89201401453e10144d67ebf` |

Working tree, sem descartar nada:

- `src/components/ui/Modal.tsx` modificado, 10 inserções e 5 remoções.
- `tests/modalLayout.test.tsx` não rastreado.
- `docs/CP17_43_PRE_HOMOLOGATION.md` não rastreado, preservado.
- `docs/CP17_44_MODAL_LAYOUT_AND_ROUTING_AUDIT.md` não rastreado, preservado.
- `docs/CP17_45_FINAL_REVIEW.md` não rastreado, este relatório.

Não há `.env` no workspace. `dist/` está no `.gitignore`. O build V3 ficou em `/tmp/v3-flag-on`. Nenhum segredo, `dist/` ou artefato temporário entra no conjunto a publicar.

## 4. Feature flag do Preview

`VITE_SUPABASE_AUTH_ENABLED=true` permanece **não comprovada** no Preview publicado de `fa03058d8383fc2fa996620ac5a700c9683c6ad2`.

O que foi possível verificar, sem alterar a Vercel:

- `vercel.json` define só `VITE_BASE_PATH=/`.
- `.env.example` traz `VITE_SUPABASE_AUTH_ENABLED=false`.
- Não há `.env` local.
- Não há CLI da Vercel nem arquivo de autenticação da CLI.
- A variável de ambiente deste agente cujo nome contém Supabase ou Vercel é só `SUPABASE_ACCESS_TOKEN`. Ela não foi usada e não informa a configuração de build da Vercel.
- Em 2 de novembro de 2026, por volta de 14:43 (horário de Brasília), `GET` de `https://evelynclinica-qszvel7wt-spadbuts-projects.vercel.app/` respondeu HTTP 302 para `https://vercel.com/sso-api`. O bundle publicado continua ilegível daqui.

Sem essa prova, o Preview não mostra se o login de equipe vai para `/v3/patients` ou para o painel V2. A flag não foi alterada.

## 5. Riscos remanescentes

- A flag do Preview segue não comprovada. Publicar de novo sem ela ligada reproduz o login V2 e o painel em `/`.
- O mesmo modal serve às 25 aberturas. A medição de comportamento nesta etapa usou “Novo paciente”. A medição geométrica da CP17.44 cobriu também “Novo orçamento”. As demais telas herdam o layout e não tiveram passe visual próprio.
- Dois modais abertos ao mesmo tempo não ocorrem nas telas atuais. A restauração de `overflow` não é uma pilha global.
- O salto de layout ao sumir a barra não apareceu neste Chrome. Pode aparecer num Edge que reserve a barra de 8 px. A correção, se isso for visto na homologação, é `scrollbar-gutter: stable` em `html`.
- O teste unitário não cobre Escape nem a restauração depois de desmontar. O navegador cobriu os dois nesta revisão.
- Os 19 testes de RLS continuam pendentes.
- As limitações já registradas da recuperação PKCE continuam como estavam.
- O redirecionamento depois do login não foi alterado, conforme a CP17.44.

## 6. Plano de publicação

Não executar enquanto a flag não estiver comprovada e enquanto não houver autorização explícita.

Quando as duas condições existirem:

1. Conferir de novo que a branch é `cursor/v3-0-foundation-a2` e que `main` não entra no commit.
2. Incluir somente:
   - `src/components/ui/Modal.tsx`
   - `tests/modalLayout.test.tsx`
   - `docs/CP17_43_PRE_HOMOLOGATION.md`
   - `docs/CP17_44_MODAL_LAYOUT_AND_ROUTING_AUDIT.md`
   - `docs/CP17_45_FINAL_REVIEW.md`
3. Deixar de fora `.env`, `dist/`, `/tmp/v3-flag-on` e artefatos de medição.
4. Um commit nessa branch, com mensagem `fix(ui): keep modal title inside the viewport`.
5. Push somente de `cursor/v3-0-foundation-a2`.
6. Esperar o Preview da Vercel, registrar o commit, a URL e o status, e confirmar que o bundle publicado foi gerado com `VITE_SUPABASE_AUTH_ENABLED=true`.
7. Não fazer merge e não promover para Production.

Nesta etapa o plano fica registrado e parado. A flag não está comprovada.
