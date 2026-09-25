# Roadmap — Evelyn Clínica Estética

## V1 — Gestão clínica operacional ✅ (atual)

Foco: operação do consultório.

| Módulo | Status |
|---|---|
| Prontuários de pacientes | ✅ |
| Evoluções clínicas (anamnese / procedimento / próximos passos) | ✅ |
| Agenda | ✅ |
| Fotos antes & depois | ✅ |
| Termos de consentimento | ✅ |
| Contratos | ✅ |
| Orçamentos | ✅ |
| Painel com resumo do dia | ✅ |
| Persistência local (dispositivo) | ✅ |

### Limitações conscientes da V1

- Sem login / multi-usuário
- Sem nuvem (dados no `localStorage`)
- Fotos em base64 com limite de tamanho
- Sem assinatura digital avançada (marca “assinado” manualmente)
- Sem envio automático de PDF/WhatsApp

---

## V2 — CRM & relacionamento

Foco: gestão de clientes e recorrência.

- Autenticação e perfis (Evelyn + assistente)
- Backend seguro (API + banco) com LGPD
- CRM: pipeline de leads → avaliação → tratamento → manutenção
- Histórico de interações (WhatsApp, e-mail, ligações)
- Gestão de assinaturas / planos recorrentes
- Lembretes automáticos de retorno e validade de orçamento
- Assinatura digital de termos e contratos
- Upload de fotos em storage dedicado
- Tags, segmentos e campanhas leves

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

---

## Princípios de produto

1. **Clínico primeiro** — prontuário e segurança do paciente acima de tudo.
2. **Elegante e simples** — UI limpa, sem parecer SaaS genérico.
3. **Evolutivo** — V1 local → V2 CRM/nuvem → V3 financeiro.
4. **LGPD by design** — consentimento, minimização e trilha de acesso.
