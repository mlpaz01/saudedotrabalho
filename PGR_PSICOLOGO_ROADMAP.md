# Reestruturação PGR + Psicólogo — Status

Resposta às mensagens do Bruno (2026-06-20 / 2026-06-21 + PDF de referência da
K3M Engenharia para Gelar Refrigeração).

> **Aprendizado da 2ª mensagem (21/06):** o Bruno comparou o que entregamos
> com PGRs reais de mercado e disse, com razão, que ainda estamos digitalizando
> formulários — não inteligenciando o documento. A mudança que ele pede é
> **arquitetural** (GSE/GHE como espinha dorsal, IA real cruzando módulos),
> não cosmética. É épico de 3-6 semanas, NÃO cabe no cutover.

## Análise do PDF de referência (K3M Engenharia)

PGR ambiental/segurança tradicional, sem psicossocial. Estrutura:
1. Dados administrativos
2. **GRUPOS HOMOGÊNEOS DE EXPOSIÇÃO (GHE)** — logo na 2ª seção, é a espinha dorsal
3. Introdução, objetivo, base legal, considerações
4. Tabela dos grupos de risco / abrangência
5. Antecipação e reconhecimento de riscos
6. Avaliação de riscos ambientais (níveis 1-5, prioridades 1-4)
7. Caracterização do tipo de exposição (Q/Qt, contínua/intermitente)
8. Critério e matriz de risco
9. Possíveis resultados
10. **Plano de ação único** (sem "psicossocial" separado)
11. Cronograma de ações e treinamentos
12. Registro de dados, CIPA (com Quadro I — dimensionamento), incêndio
13. EPI (lista + ficha de controle individual por colaborador)
14. Dados técnicos dos equipamentos de medição
15. Encerramento + responsável técnico

**Nosso gap concreto vs esse modelo:**
- GHE é JSON dentro de `pgr_documents`, não tabela com FKs — limita a "tudo
  vinculado ao GHE".
- Falta tipo de exposição (qualitativa/quantitativa, contínua/intermitente).
- Plano dividido em PGR + Psicossocial — precisa unificar.
- Falta CIPA (dimensionamento por nº de funcionários + Quadro I).
- Falta ficha individual de controle de EPI por colaborador.
- Falta seção "Dados técnicos dos equipamentos de medição".

**Nosso diferencial competitivo (que o PDF da K3M NÃO tem):**
- Psicossocial integrado (NR-01 novo exige; eles não atendem).
- Importação automática do ciclo psicossocial.
- Indicadores e dashboards.
- Workflow de revisão e status.

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

---

## Acréscimos da mensagem 21/06 (PGR Inteligente / GSE-first)

### Mudança arquitetural — Sprint 1 do "PGR Inteligente" — ✅ CONCLUÍDA (2026-06-21)

**Sprint 1 entregue em ~1 dia de trabalho focado:**

```
✅ Dia 1-2    Schema: 9 tabelas pgr_gse* + FKs ON DELETE CASCADE
✅ Dia 3-4    13 procedures tRPC (CRUD + 8 set* idempotentes + migrate + legacyStatus)
✅ Dia 5-6    UI AdminPGRGseManager.tsx com 8 abas internas
✅ Dia 7-8    Migração JSON → tabelas, idempotente, com fuzzy match de setor
✅ Dia 9-10   generatePDF refatorado (parallel-write, sem regressão no caminho legado)
✅ Dia 11-12  Banners "Modelo legado" + suite E2E 10/10 (LGPD não regrediu)
✅ Dia 13-14  Cutover preparado (cutover_prod.py com DDLs idempotentes + smoke checks)
```

**O que ficou no modelo de dados** (decisões consolidadas):

- Nova tabela `pgr_gse` com colunas próprias: `id, pgr_id, nome, descricao,
  num_trabalhadores, num_homens, num_mulheres, ai_suggested (bool)`.
- Tabelas relacionais por FK ao `gse_id`:
  - `pgr_gse_cargos (gse_id, cargo)`
  - `pgr_gse_setores (gse_id, sector_id)` — N-N (um setor pode pertencer a vários GSEs e vice-versa)
  - `pgr_gse_riscos (gse_id, risco_id, severidade, probabilidade)`
  - `pgr_gse_epc (gse_id, epc_id)`
  - `pgr_gse_epi (gse_id, epi_id)`
  - `pgr_gse_acoes (gse_id, acao_id)` — plano de ação
  - `pgr_gse_evidencias (gse_id, evidencia_id, tipo)`
  - `pgr_gse_treinamentos (gse_id, treinamento_id)`
- **Migração de dados** dos `pgr_documents.ghe_funcoes` (JSON) → `pgr_gse` (tabela
  + relacionamentos). Sem perder PGRs existentes.

### Sprint 2 — IA contextualizada (após Sprint 1, ~2-3 semanas)

- **Sugerir GSE inteligente** (botão ✨): cruza setores + cargos + atividades +
  histórico via LLM (GROQ — já usado em outras IAs do projeto). Devolve:
  ```
  GSE 01 — Administrativo: {RH, Financeiro, Comercial, Adm, TI}, 25 trab.
  GSE 02 — Operadores de Campo: {Operador Máquinas, Guindauto, Servente}, 18 trab.
  GSE 03 — Equipe Técnica Civil: {Eng Civil, Téc Campo, Supervisor Obras}, 6 trab.
  ```
  Usuário aceita/edita/exclui. Cada criação grava `ai_suggested=true`.
- **Sugerir Inventário** por GSE: cruza descrição das atividades + cargo + AEP +
  inventário psicossocial + Tabelas eSocial 23/24 + NR-06 + histórico da
  empresa. Devolve agentes/fontes/danos/medidas/EPC/EPI sugeridos.
- **Sugerir Matriz**: severidade × probabilidade a partir do inventário + AEP +
  histórico.
- **Gerar Plano de Ação (5W2H)**: por GSE, prioriza alto/crítico, gera ações
  com responsável e prazo.

### Sprint 3 — Conformidade + Auditoria + Evidências (~1-2 semanas)

- **Central de Conformidade do PGR** (estilo NR-01 que já existe): valida
  inventário/matriz/plano/GSE/responsável técnico/revisões/treinamentos/EPC/EPI
  preenchidos. Devolve 🟢/🟡/🔴 + score geral.
- **Auditoria Inteligente** (expandir `auditPgr` existente): riscos sem
  tratamento/monitoramento/EPC/EPI, GSE sem riscos, ações vencidas, responsáveis
  ausentes, campos obrigatórios vazios.
- **Evidências vinculadas a GSE/risco/ação**: upload + galeria + composição
  automática no PDF.

### Sprint 4 — Reaproveitamento + Revisões com diff (~1-2 semanas)

- "Deseja usar PGR XX como base?" no Novo PGR → copia GSE/inventário/matriz/
  plano/EPC/EPI/caracterizações.
- Controle de revisão contínuo: `PGR YYYY Rev 01/02/03` sem reconstruir do zero.
- Revisão anual assistida: diff automático mostrando o que mudou desde a
  última emissão (inclusões/exclusões/alterações), com filtros por tipo.

### Gaps adicionais vindos do PDF da K3M (acrescentar a sprints futuros)

- **CIPA**: módulo de dimensionamento por nº de funcionários + Quadro I da NR-05.
- **Tipo de exposição** por risco: qualitativa/quantitativa, contínua/intermitente.
- **Ficha individual de EPI** por colaborador (entrega/troca/devolução com
  assinatura).
- **Equipamentos de medição**: cadastro dos instrumentos usados em avaliações
  quantitativas (decibelímetro, dosímetro, etc.) com nº de série + validade da
  calibração.
- **Proteção contra incêndio**: ficha de inspeção de extintores (NR-23).
