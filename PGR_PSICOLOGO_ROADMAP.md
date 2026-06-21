# Reestruturação PGR + Psicólogo — Status

Resposta à lista do Bruno (mensagem de 2026-06-20).

## ✅ Entregue HOJE em `develop` (cabe no cutover de amanhã)

### PGR
- **§1 Escopo na criação** — modal "Filial específica vs Consolidado"; salva em `pgr_documents.branch_id`; badge no editor.
- **§2 Cargo obrigatório** — coluna `users.position`; importador exige cargo (rejeita linha sem); `updateCollaborator` aceita.
- **§3 Importação automática do RH** — botão "Importar do RH" no editor: puxa filiais/setores/cargos/colaboradores já cadastrados, popula `caracterizacao_setores` + `ghe_funcoes` + `num_funcionarios`. Respeita escopo (filial → só dados daquela filial).
- **§4 Importação do Ciclo Psicossocial** — botão "Importar Ciclo Psicossocial" com seletor: copia inventário + plano para `pgr_documents.inventario` e `plano_psicossocial`. Setor vem junto.

### Psicólogo
- **§2 Status expandidos** — Agendado / Confirmado / Realizado / Cancelado / Não compareceu / Reagendado.
- **§4 Gestão de agendamentos pelo psicólogo** — criar (já existia), reagendar (novo status), cancelar (já existia), bloquear horário (via `availability_blocks`, já existia).
- **§7 + §11 Observações Profissionais sigilosas** — `appointments.outcome_notes` (já existia no schema). Backend bloqueia gravação por RH/colaborador (403). `listAppointments` esconde o campo para perfis sem permissão. Verificado logado como psico × RH.
- **§10 + §12 Indicadores básicos** — nova aba "Indicadores": total, taxa de comparecimento, no-show, cancelamento, distribuição por status, evolução 12 meses. RH vê (sem `outcome_notes`).

## 🚧 ROADMAP — itens que dependem de sprint dedicado

Cada um destes é um épico — implementação correta exige ≥ 1 sprint cada. Implementar agora sem planejamento abre 5 bugs novos para cada feature.

### PGR
- **§5 GHE/GSE inteligente** — agrupamento automático por similaridade de exposições. Precisa heurística (ou LLM com prompt direcionado) sobre cargos+setores+riscos. Hoje o GHE/GSE entra cru do RH.
- **§6 Tabelas eSocial 23 (riscos) e 24 (agentes nocivos)** — carregar e usar como vocabulário controlado em inventário e matriz. Precisa importer + UI de "ponte" para sugerir códigos.
- **§7 Inventário Inteligente (✨ Sugerir)** — botão existe em parte; reestruturar para cruzar cargo+setor+filial+atividades+AEP+psicossocial+histórico via LLM e devolver agentes/fontes/danos/medidas/EPCs/EPIs.
- **§8 Matriz Inteligente (✨ Sugerir)** — análogo: probabilidade/severidade/classificação a partir do inventário+AEP+histórico.
- **§9 Plano de Ação Inteligente (✨ 5W2H)** — gerar plano via LLM a partir de inventário+matriz priorizando alto/crítico.
- **§10 Unificação dos planos de ação** — remover "Plano de Ação Psicossocial" e ter um único "Plano de Ação" no PGR cobrindo todos os riscos (físicos/químicos/biológicos/ergonômicos/acidentes/psicossociais). **Não fiz** porque acabei de consertar a regressão de segmentação por setor do plano psicossocial; unificar agora joga esse trabalho fora. Pede 1 sprint próprio para migração de dados.
- **§11 EPI/EPC inteligentes via NR-06** — embutir classificação NR-06 e sugerir EPIs por risco (ruído→protetor, altura→cinturão, etc.). Precisa cadastro estruturado da NR-06 internamente.
- **§13 Texto fixo + dinâmico** — boa parte já existe (template do PDF). Refatorar para o sistema sugerir complementações por contexto pede LLM mais ciente do PGR completo.
- **§14 Conclusão Técnica Assistida (✨)** — existe em `generateNarrative`; revisar prompt para usar inventário+matriz+plano+indicadores sem inventar.
- **§15 Central de Conformidade do PGR** — análoga à da NR-01 (que já existe); precisa criar checklist específico do PGR + UI.
- **§16 Auditoria Inteligente (✨)** — existe `auditPgr`; ampliar regras (riscos sem tratamento/monitoramento/EPC/EPI, ações vencidas etc.).
- **§17 Dashboard Executivo do PGR** — existe `executiveOverview`; expandir para os indicadores específicos do roadmap.
- **§18 Revisões inteligentes** — botões ✨ por seção, validando consistência interna.
- **§19 Evidências fotográficas** — upload + vínculo a setor/cargo/GHE/risco + exibição no PDF. Precisa storage + UI de galeria + posicionamento no PDF.
- **§20 Gráficos e indicadores dentro do PGR** — gerar gráficos a partir dos dados e incorporar no PDF.
- **§21 Reaproveitar PGR anterior** — pergunta na criação: "Usar PGR XX como base?" → copiar GHE/inventário/matriz/plano/EPC/EPI/caracterizações.
- **§22 + §23 Revisões com diff inteligente** — controle versionado `PGR 2026 Rev 01/02/03`, com diff automático (o que mudou desde a última emissão: novos riscos, removidos, mudanças de quadro etc.).
- **REGRA DE OURO** — implementar policy global "nenhuma informação já existente é solicitada de novo" depende dos itens acima estarem prontos.

### Psicólogo
- **§5 Integração Google Meet/Teams** — OAuth dedicado (Google Calendar API ou Microsoft Graph), criação automática do evento, link salvo em `meeting_url`. **Risco médio-alto** (credenciais OAuth, fluxo de consent, refresh tokens). Por enquanto, link é colado manualmente no dialog de status.
- **§6 Notificações automáticas pós-agendamento** — depende de templates de e-mail bem feitos (SMTP já funciona); fácil de fazer mas pede revisão de copy com a Marise.
- **§13 Controle de horário de uso da plataforma por empresa** — **alto risco operacional**. Se mal calibrado, trava o Bruno fora do horário e o suporte vira pesadelo. Precisa: configuração no super-admin, regras por setor, exceções temporárias, log de auditoria, mensagem clara ao usuário bloqueado. Pede 1 sprint completo com testes amplos antes de virar produção.

## Critério para ordenação

Sugiro ordenar os épicos do roadmap pelo **par (impacto para o Bruno × risco operacional)**:

1. **Baixo risco, alto valor** (próximo): §10 Unificação dos planos, §17 Dashboard, §14 Conclusão técnica, §6 (notificações), §15 Central de Conformidade, §16 Auditoria.
2. **Médio risco**: §7/§8/§9 (IA inteligente), §11 (EPI/EPC NR-06), §19 (evidências).
3. **Alto risco (planejar com cuidado)**: §5 (Meet/Teams), §13 (controle de jornada), §22/§23 (revisões com diff), §21 (reaproveitar PGR).

Esta sequência mantém o ritmo de entrega sem regressão.
