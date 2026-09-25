# Roadmap — Evelyn Clínica Estética

## V1 — Gestão clínica operacional ✅

Foco: operação do consultório.

| Módulo | Status |
|---|---|
| Prontuários de pacientes | ✅ |
| Evoluções clínicas | ✅ |
| Agenda | ✅ |
| Fotos antes & depois | ✅ |
| Termos de consentimento | ✅ |
| Contratos | ✅ |
| Orçamentos | ✅ |
| Painel com resumo do dia | ✅ |
| Persistência local | ✅ |

---

## V2 — CRM & relacionamento ✅ (atual)

Foco: gestão de clientes, autenticação e assinatura digital.

| Módulo | Status |
|---|---|
| Autenticação e perfis (Evelyn + assistente + paciente) | ✅ |
| Portal da paciente | ✅ |
| Assinatura digital de termos (canvas + aceite + trilha) | ✅ |
| Geração de login/senha para pacientes | ✅ |
| CRM: pipeline leads → avaliação → tratamento → manutenção | ✅ |
| Histórico de interações (WhatsApp, e-mail, ligações) | ✅ |
| Lembretes de retorno e validade de orçamento | ✅ |
| Tags / segmentos leves em pacientes | ✅ |
| Migração automática dos dados V1 | ✅ |

### Notas da V2

- Persistência ainda local (`localStorage`) com senhas hasheadas — adequado para operação em um dispositivo / demo.
- Próximo passo de infraestrutura: API + banco em nuvem (mesmo modelo de dados).
- Fotos ainda em base64 no dispositivo; storage dedicado permanece na evolução de infraestrutura.

---

## V3 — Gestão financeira

Foco: saúde financeira do negócio.

- Fluxo de caixa (entradas / saídas)
- Contas a pagar e receber
- Projeções de faturamento
- Cálculo de margem por procedimento
- ROI de campanhas e canais
- LTV (lifetime value) por paciente
- Ticket médio, taxa de conversão de orçamento e inadimplência
- Dashboards e exportação para planilha/contabilidade
- Backend seguro em nuvem com LGPD (continuidade da V2)

---

## Princípios de produto

1. **Clínico primeiro** — prontuário e segurança do paciente acima de tudo.
2. **Elegante e simples** — UI limpa, sem parecer SaaS genérico.
3. **Evolutivo** — V1 local → V2 CRM/auth → V3 financeiro + nuvem.
4. **LGPD by design** — consentimento, minimização e trilha de acesso.
