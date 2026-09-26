# Evelyn · Clínica Estética — V2

Aplicativo de gestão clínica para **Evelyn Preto Silva**, biomédica estética.

A **V2** adiciona CRM, autenticação e portal da paciente para assinatura digital de termos.

## O que há na V2

- Login com perfis: clínica (admin), assistente e paciente
- Portal da paciente para ler e assinar termos (assinatura manuscrita + aceite)
- CRM: pipeline lead → avaliação → tratamento → manutenção
- Histórico de interações (WhatsApp, e-mail, ligação)
- Lembretes de retorno e validade de orçamento
- Tags em pacientes
- Tudo da V1: prontuários, agenda, fotos, termos, contratos e orçamentos

## Contas demo

| Perfil | E-mail | Senha |
|---|---|---|
| Clínica | `evelyn@clinica.com` | `evelyn123` |
| Assistente | `assistente@clinica.com` | `assistente123` |
| Paciente (termo pendente) | `juliana.ferreira@email.com` | `paciente123` |
| Paciente | `ana.mendes@email.com` | `paciente123` |

## Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- React Router
- Persistência local (`localStorage`) com sessão e hash de senha (SHA-256 + salt)

> **LGPD:** dados e sessões ficam neste navegador. A estrutura de auth/assinatura já prepara a migração para backend em nuvem.

## Como rodar

```bash
npm install
npm run dev
```

Abra o endereço indicado (geralmente `http://localhost:5173/evelynclinica/`).

```bash
npm run build
npm run preview
```

## Fluxo de assinatura do termo

1. Na área clínica: **Consentimentos → Acesso da paciente** (gera login/senha)
2. Crie o termo e clique **Enviar p/ assinatura** (status `enviado`)
3. A paciente entra no login e assina em **Portal → Meus termos**

## Deploy (GitHub Pages)

**https://spadbut.github.io/evelynclinica/**

Após merge em `main`, o workflow publica automaticamente.

## Estrutura

```
src/
├── components/     # UI, layouts clínica/portal, assinatura
├── context/        # Auth + estado da clínica
├── data/           # seed demo V2
├── pages/          # módulos clínicos + portal paciente
└── types/          # modelos V2
```

## Roadmap (definições oficiais)

| Versão | Foco |
|---|---|
| V1 | Operação da clínica |
| V2 | CRM + Auth + Consentimentos *(atual na UI)* |
| **V3** | **Patient 360 + Clinical CRM** |
| V4 | Financial Intelligence |
| V5 | Growth + WhatsApp + Automação + IA |

Fundação V3:

- **A1** — schema/migrations Supabase ✅
- **A2** — Auth + RLS + Data Layer (em revisão) — ver `docs/A2_AUTH_RLS.md`

A UI operacional V2 permanece (localStorage). Com `VITE_SUPABASE_*` configurado, a equipe usa Supabase Auth + memberships + RLS.

```bash
cp .env.example .env.local
# preencha URL + publishable/anon key
npm run dev
```

Stack local (requer Docker):

```bash
npm run db:start
npm run db:reset
npm run db:types
npm run db:test:rls
```

- Arquitetura: `docs/V3_ARCHITECTURE.md`
- Schema A1: `docs/SCHEMA_A1.md`
- Auth/RLS A2: `docs/A2_AUTH_RLS.md`
- Mapping V2→V3: `docs/V2_TO_V3_MAPPING.md`
- Roadmap completo: `ROADMAP.md`
