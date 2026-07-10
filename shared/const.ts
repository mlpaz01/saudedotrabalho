export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

/**
 * P14 #3 — Alerta ético Psicologia → RH. Mensagens fixas (não editáveis), sem
 * qualquer conteúdo clínico — Código de Ética do Psicólogo / sigilo profissional.
 * A psicóloga só ESCOLHE um modelo; nunca compõe texto livre para este canal.
 */
export const ETHICAL_ALERT_TEMPLATES: { key: string; label: string; body: string }[] = [
  { key: "acolhimento_condicoes_trabalho", label: "Acompanhamento próximo — condições de trabalho",
    body: "Recomenda-se acompanhamento próximo deste colaborador quanto às condições de trabalho, favorecendo ambiente acolhedor e comunicação aberta." },
  { key: "carga_demandas_lideranca", label: "Atenção à carga de demandas e suporte da liderança",
    body: "Sugere-se atenção especial à carga de demandas e ao suporte da liderança imediata durante as próximas semanas." },
  { key: "reforco_saude_mental", label: "Reforço das ações de promoção da saúde mental",
    body: "Recomenda-se reforço das ações de promoção da saúde mental e acompanhamento preventivo deste colaborador." },
  { key: "reducao_exposicao_estresse", label: "Redução da exposição a ambientes de elevado estresse",
    body: "Sempre que possível, recomenda-se reduzir a exposição deste colaborador a ambientes de elevado estresse." },
  { key: "monitoramento_bem_estar", label: "Monitoramento preventivo do bem-estar ocupacional",
    body: "A profissional responsável recomenda monitoramento preventivo do bem-estar ocupacional deste colaborador, sem necessidade de qualquer intervenção clínica por parte da empresa." },
];

/** P14 #5 — Pipeline comercial do Intermediador: 8 etapas fixas (ordem = funil). */
export const PROSPECT_STAGES: { key: string; label: string }[] = [
  { key: "lead_identificado", label: "Lead identificado" },
  { key: "primeiro_contato", label: "Primeiro contato" },
  { key: "apresentacao_realizada", label: "Apresentação realizada" },
  { key: "proposta_enviada", label: "Proposta enviada" },
  { key: "negociacao", label: "Negociação" },
  { key: "contrato_em_elaboracao", label: "Contrato em elaboração" },
  { key: "cliente_fechado", label: "Cliente fechado" },
  { key: "negociacao_perdida", label: "Negociação perdida" },
];

export const ETHICAL_ALERT_DISCLAIMER =
  "Esta comunicação é uma recomendação preventiva sobre condições organizacionais de trabalho. " +
  "NÃO constitui laudo psicológico, parecer técnico, diagnóstico ou documento clínico, e não contém " +
  "qualquer informação protegida por sigilo profissional.";

/**
 * R5-P12 #11 — METODOLOGIA PSICOSSOCIAL CANÔNICA (fonte única).
 * Usada por PGR, Laudo NR-01, Laudo AEP, Central de Conformidade e relatórios
 * (Legitimidade Metodológica, Segurança da Informação, LGPD), para eliminar
 * qualquer divergência entre documentos. Cobre: digital, impresso, OCR,
 * tratamento de rasuras, respostas inválidas, sigilo e consolidação estatística.
 */
export const METODOLOGIA_PSICOSSOCIAL_TITULO = "Metodologia de Coleta e Processamento de Dados Psicossociais";

export const METODOLOGIA_PSICOSSOCIAL_SECOES: { h: string; p?: string[]; ol?: string[] }[] = [
  {
    h: "",
    p: [
      "A coleta e o processamento de dados psicossociais seguem a NR-01 (Portaria MTP nº 1.419/2024), a Lei nº 14.457/2022 e a Lei nº 13.709/2018 (LGPD), por duas vias operacionais complementares que produzem dados equivalentes e consolidáveis: questionários digitais e questionários impressos com leitura automática.",
    ],
  },
  {
    h: "1. Questionários digitais",
    p: [
      "Aplicação eletrônica do questionário (DRPS / AEP) na plataforma. O colaborador responde de forma autenticada e individual em ambiente seguro; as respostas são gravadas de forma anônima e agregadas por setor para análise estatística e definição de Grupos Similares de Exposição (GSE).",
    ],
  },
  {
    h: "2. Questionários impressos (com digitalização e leitura automática)",
    p: ["Para colaboradores sem acesso digital regular, o questionário é aplicado em papel seguindo o fluxo oficial:"],
    ol: [
      "Impressão a partir da plataforma, com aviso de confidencialidade e orientações de preenchimento na própria folha (assinalar apenas uma alternativa por pergunta e não rasurar).",
      "Aplicação manual com as instruções padronizadas.",
      "Upload dos questionários digitalizados (PDF/JPG/PNG) pelo RH, com seleção obrigatória de ciclo, pesquisa e setor — todo o lote é vinculado ao setor selecionado nesta etapa, e não ao campo de setor eventualmente preenchido à mão no papel (usado apenas para conferência do RH), eliminando divergências de sigla, abreviação ou grafia.",
      "Assinatura eletrônica de um único Termo de Confidencialidade por lote (nome, CPF e cargo do responsável), declarando custódia dos originais em envelope lacrado.",
      "Geração automática de um único Recibo de Confidencialidade por lote, com código de rastreabilidade e QR Code, fixado externamente ao envelope lacrado.",
      "Leitura automática (OCR) das marcações e gravação das respostas no banco como se fossem respostas digitais, alimentando cálculo de risco, dashboards, plano de ação, indicadores e os documentos técnicos.",
    ],
  },
  {
    h: "3. Tratamento de respostas rasuradas e múltiplas marcações",
    p: [
      "A leitura automática não interrompe o processamento diante de inconsistências pontuais. Quando uma resposta está rasurada ou apresenta mais de uma alternativa assinalada, somente aquela questão é desconsiderada; as demais respostas válidas do mesmo questionário permanecem compondo normalmente a análise estatística do setor. Esse critério preserva o sigilo dos envelopes (evita reabertura de documentos físicos) e mantém a conformidade com a LGPD.",
    ],
  },
  {
    h: "4. Indicadores do processamento e regras de cálculo",
    p: [
      "Cada lote gera um relatório de leitura automática com indicadores organizados em três grupos, para transparência e auditoria: (i) nível questionário — mede documentos; (ii) qualidade da leitura (OCR) — mede a precisão do reconhecimento de marcações; (iii) estatísticas do questionário — descrevem o preenchimento, sem indicar falha de leitura. Um contador de nível de questão (ex.: rasura) não altera um contador de nível de documento (ex.: não processados), e uma estatística de preenchimento (ex.: em branco) não indica falha de leitura.",
      "Nível questionário (documento): (a) Recebidos — total de páginas/imagens enviadas no lote; (b) Questionários — documentos montados a partir das páginas (quando um questionário tem múltiplas páginas, elas são mescladas em uma única resposta); (c) Lidos com sucesso — questionários em que a leitura capturou ao menos uma resposta objetiva válida; (d) Não processados — páginas com falha técnica de leitura (imagem ilegível, muito escura ou distorcida, ou erro do motor de leitura), que não inclui rasuras. Aproveitamento de questionários = (Lidos com sucesso ÷ Questionários) × 100.",
      "Qualidade da leitura (OCR), apurada sobre as questões objetivas (Likert / múltipla escolha) de todos os documentos processados: mede exclusivamente a precisão do reconhecimento das marcações. Rasura e múltipla marcação são estados que o OCR identifica corretamente (a marcação existe e foi corretamente classificada, apenas não gera uma resposta utilizável); somente 'não interpretadas' representa uma falha real de leitura. Fórmula: Aproveitamento da leitura = (Respostas válidas + Rasura + Múltipla marcação) ÷ (Respostas válidas + Rasura + Múltipla marcação + Não interpretadas) × 100. Questões em branco NÃO entram nesse cálculo — ausência de marcação não é falha de leitura, é dado do preenchimento.",
      "Estatísticas do questionário — descrevem o preenchimento, não a qualidade da leitura: Respostas válidas (marcações reconhecidas e gravadas), Em branco (questão sem nenhuma alternativa assinalada) e Proporção respondida = Respostas válidas ÷ total de questões objetivas processadas × 100. Um lote pode ter 100% de aproveitamento da leitura (OCR) mesmo com muitas questões em branco — isso indica um questionário parcialmente preenchido, não uma falha de reconhecimento. Campos discursivos não entram em nenhum desses cálculos.",
    ],
  },
  {
    h: "5. Campos discursivos (texto livre)",
    p: [
      "Questionários que contêm campos discursivos (resposta escrita à mão, texto livre — comuns em instrumentos como a AEP) têm essas questões tratadas à parte: a leitura automática processa apenas questões objetivas. Os campos discursivos são apenas contabilizados e sinalizados no relatório como pendentes de transcrição manual e, por definição, nunca são classificados como respostas inválidas nem impactam o percentual de aproveitamento. A interpretação automática de texto manuscrito não integra o escopo atual da leitura automática.",
    ],
  },
  {
    h: "6. Sigilo, consolidação e rastreabilidade (LGPD)",
    p: [
      "Em ambas as vias, respostas individuais não são identificadas: apenas agregados por setor são exibidos em painéis e documentos. Os originais físicos permanecem em envelope lacrado sob custódia do responsável nomeado no Termo, abertos apenas mediante necessidade administrativa formal ou determinação judicial. Toda operação fica auditada (responsável, data/hora, código de rastreabilidade e situação do processamento), e a origem impressa fica sinalizada no ciclo de Análise de Risco correspondente.",
    ],
  },
];

/** Renderiza a metodologia canônica como HTML (para PDFs server-side e relatórios). */
export function metodologiaPsicossocialHtml(opts?: { headingTag?: "h2" | "h3"; subTag?: "h3" | "h4" }): string {
  const H = opts?.headingTag ?? "h2";
  const S = opts?.subTag ?? "h3";
  const body = METODOLOGIA_PSICOSSOCIAL_SECOES.map((sec) => {
    const head = sec.h ? `<${S} style="margin-top:14px">${sec.h}</${S}>` : "";
    const paras = (sec.p ?? []).map((t) => `<p>${t}</p>`).join("");
    const list = sec.ol ? `<ol>${sec.ol.map((li) => `<li>${li}</li>`).join("")}</ol>` : "";
    return head + paras + list;
  }).join("");
  return `<${H}>${METODOLOGIA_PSICOSSOCIAL_TITULO}</${H}>${body}`;
}
