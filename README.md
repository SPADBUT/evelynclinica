# Evelyn · Clínica Estética — V1

Aplicativo de gestão clínica para **Evelyn Preto Silva**, biomédica estética.

A **V1** cobre a operação do dia a dia:

- Prontuários de pacientes (cadastro + evoluções)
- Agenda de atendimentos
- Fotos clínicas de antes e depois
- Termos de consentimento informado
- Contratos de planos/pacotes
- Orçamentos com itens e descontos

## Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- React Router
- Persistência local (`localStorage`) — ideal para prototipar sem backend

> **LGPD:** nesta V1 os dados ficam apenas no navegador do dispositivo. Em V2 haverá backend seguro, autenticação e armazenamento em nuvem.

## Como rodar

```bash
npm install
npm run dev
```

Abra o endereço indicado no terminal (geralmente `http://localhost:5173`).

```bash
npm run build    # build de produção
npm run preview  # preview do build
```

## Deploy (GitHub Pages)

O site é publicado via GitHub Actions em **GitHub Pages**, com domínio customizado:

- `evelynclinica.com.br`

Após o merge em `main`, configure em **Settings → Pages → Custom domain** o domínio acima e aponte o DNS conforme o passo a passo do provedor.

## Estrutura

```
.
├── src/
│   ├── components/     # UI + layout
│   ├── context/        # estado global da clínica
│   ├── data/           # seed demo
│   ├── lib/            # storage + formatadores
│   ├── pages/          # módulos da V1
│   └── types/          # modelos de dados
├── ROADMAP.md          # V1 / V2 / V3
└── package.json
```

## Dados demo

Na primeira abertura o app carrega pacientes, agenda, termos, contratos e orçamentos de exemplo.  
No painel há o botão **Restaurar dados demo**.
