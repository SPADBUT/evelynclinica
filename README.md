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
| V2 | CRM + Auth + Consentimentos *(atual na UI / GitHub Pages)* |
| **V3** | **Patient 360 + Clinical CRM** *(Vercel + Supabase)* |
| V4 | Financial Intelligence |
| V5 | Growth + WhatsApp + Automação + IA |

### Fundação V3 — Checkpoint A1 (canônico)

Schema mínimo + RLS em `organizations` / `staff_*` / `permissions` / `patients` / `audit_logs`.

- Schema canônico: `docs/SCHEMA_FOUNDATION_A1.md`
- Arquitetura: `docs/V3_ARCHITECTURE.md`
- Mapping V2→V3 (histórico): `docs/V2_TO_V3_MAPPING.md`
- Schema legado clinics (não aplicável): `docs/SCHEMA_A1.md` + `supabase/legacy/`
- Roadmap: `ROADMAP.md`

Validação A1:

```bash
./supabase/scripts/run_a1_validation.sh
```

UI V2 permanece inalterada nesta fase. Auth Supabase = A2. Vercel = A3.
