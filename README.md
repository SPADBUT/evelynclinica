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

Ver `ROADMAP.md` para V3 (financeiro).
