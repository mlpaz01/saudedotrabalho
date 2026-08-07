export type PcmsoRiskRow = {
  risk_name?: string | null;
  risk_type?: string | null;
  risk_classification?: string | null;
  technical_detail?: string | null;
  gse_name?: string | null;
  monitoring_kind?: string | null;
  monitoring_name?: string | null;
  periodicity?: string | null;
  possible_aggravations?: string | null;
  ai_rationale?: string | null;
  suggestion_status?: string | null;
};

const clean = (value: unknown) => String(value || "").trim();
const normalized = (value: unknown) =>
  clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function buildPcmsoTitle(input: {
  companyName?: string | null;
  branchName?: string | null;
  validFrom?: string | null;
}) {
  const company = clean(input.companyName) || "EMPRESA";
  const branch = clean(input.branchName);
  const year = clean(input.validFrom).slice(0, 4) || String(new Date().getFullYear());
  return ["PCMSO", company, branch, year].filter(Boolean).join(" - ");
}

export function suggestMedicalResponse(row: PcmsoRiskRow) {
  const text = normalized(
    [row.risk_name, row.risk_type, row.technical_detail].filter(Boolean).join(" ")
  );
  const base = {
    monitoringKind: "avaliacao_clinica",
    monitoringName: "Avaliação clínica ocupacional dirigida aos riscos identificados",
    possibleAggravations:
      "Possíveis agravos relacionados à exposição devem ser avaliados pelo médico responsável conforme características do agente, intensidade, duração e suscetibilidade individual.",
    periodicity:
      "Definir pelo médico conforme classificação do risco, NR-07 e anexos aplicáveis",
    rationale:
      "Sugestão assistiva baseada na descrição disponível no PGR. Exige validação médica e não substitui avaliação clínica ou normativa do caso concreto.",
  };

  if (/ruido|auditiv|pressao sonora/.test(text))
    return {
      ...base,
      monitoringKind: "exame_complementar",
      monitoringName: "Audiometria ocupacional, quando aplicável",
      possibleAggravations:
        "Alterações auditivas relacionadas à exposição ocupacional a níveis de pressão sonora.",
      periodicity:
        "Conforme NR-07, anexo aplicável, histórico ocupacional e critério médico",
      rationale:
        "A exposição a ruído requer análise da dose, nível de ação, medidas de controle, critérios específicos da NR-07 e validação médica antes da definição do monitoramento.",
    };
  if (/quimic|poeira|solvente|fumos|nevoa|gas|vapor|silic|benzen|chumbo/.test(text))
    return {
      ...base,
      monitoringKind: "avaliacao_clinica",
      monitoringName:
        "Avaliação clínica dirigida e exames complementares definidos para o agente identificado",
      possibleAggravations:
        "Agravos compatíveis com o agente químico, via de exposição, dose e órgãos-alvo, a confirmar tecnicamente.",
      rationale:
        "A indicação de exame depende da identificação precisa do agente, avaliação da exposição, nível de ação e regras do anexo aplicável; a plataforma não presume um exame genérico.",
    };
  if (/biologic|virus|bacter|fung|paras|material infect/.test(text))
    return {
      ...base,
      monitoringName:
        "Avaliação clínica ocupacional, vigilância de sinais e sintomas e imunização quando recomendada",
      possibleAggravations:
        "Infecções e outros agravos relacionados ao agente biológico e à atividade executada.",
      rationale:
        "A resposta médica deve considerar agente, atividade, via de exposição, medidas de prevenção e recomendações oficiais de imunização.",
    };
  if (/ergonom|postur|repet|levantamento|sobrecarga fisica|mobiliario/.test(text))
    return {
      ...base,
      monitoringName: "Avaliação clínica musculoesquelética e funcional dirigida",
      possibleAggravations:
        "Sintomas e agravos musculoesqueléticos relacionados às exigências biomecânicas e organização da atividade.",
      rationale:
        "O PGR e a avaliação ergonômica orientam a anamnese e o exame clínico; exame complementar só deve ser definido quando clinicamente justificado.",
    };
  if (/psicossocial|assedio|sobrecarga mental|estresse|ritmo|organizacao do trabalho/.test(text))
    return {
      ...base,
      monitoringName:
        "Vigilância clínica e ocupacional de sinais e sintomas, preservando sigilo e abordagem coletiva dos fatores organizacionais",
      possibleAggravations:
        "Sinais e sintomas relacionados ao estresse ocupacional e outros desfechos psicossociais, sem inferência diagnóstica automática.",
      rationale:
        "Indicadores coletivos do trabalho podem orientar vigilância e prevenção, mas não autorizam diagnóstico individual nem quebra de anonimato.",
    };
  if (/calor|temperatura|frio|termic/.test(text))
    return {
      ...base,
      monitoringName: "Avaliação clínica dirigida à exposição térmica",
      possibleAggravations:
        "Alterações fisiológicas relacionadas à carga térmica, hidratação e condições individuais de saúde.",
      rationale:
        "A definição do acompanhamento depende da avaliação ambiental, atividade, controles e características individuais relevantes.",
    };
  if (/altura|espaco confinado|eletric|conducao|operacao critica|atividade critica/.test(text))
    return {
      ...base,
      monitoringName: "Avaliação clínica de aptidão para atividade crítica",
      possibleAggravations:
        "Condições de saúde capazes de interferir na execução segura da atividade crítica, avaliadas individualmente pelo médico.",
      rationale:
        "A NR-07 exige avaliação compatível com os riscos e com as patologias que possam comprometer a execução segura da atividade.",
    };
  return base;
}

export function buildPcmsoDraft(input: {
  companyName: string;
  pgrTitle?: string | null;
  riskRows: PcmsoRiskRow[];
}) {
  const gses = Array.from(
    new Set(input.riskRows.map(row => clean(row.gse_name) || "Sem GSE"))
  );
  const risks = input.riskRows.length;
  const introduction = `O Programa de Controle Médico de Saúde Ocupacional da ${input.companyName} foi estruturado como resposta médica aos riscos ocupacionais identificados no ${clean(input.pgrTitle) || "PGR de referência"}. A análise utiliza os GSEs como unidade central de integração entre exposição, possíveis agravos, vigilância e planejamento médico.`;
  const objective =
    "Proteger e preservar a saúde dos empregados, rastrear e detectar precocemente agravos relacionados ao trabalho, apoiar a avaliação de aptidão e subsidiar as medidas de prevenção da organização, com decisões clínicas sob responsabilidade do médico responsável.";
  const methodology = `Foram importados ${gses.length} GSE(s) e ${risks} risco(s) do PGR. Para cada risco, a plataforma organiza possíveis agravos, resposta médica sugerida, fundamentação e periodicidade para validação humana. O método contempla vigilância ativa por exames dirigidos e coleta de sinais e sintomas, vigilância passiva por demandas espontâneas, integração com ASO e prontuário, análise epidemiológica consolidada e comunicação de inconsistências aos responsáveis pelo PGR.`;
  const chapters = [
    {
      title: "Campo de aplicação",
      content:
        "O programa abrange os empregados incluídos nos GSEs e estabelecimentos definidos no PGR de referência, respeitando alterações de função, risco, local de trabalho e condições de saúde relevantes.",
    },
    {
      title: "Base normativa",
      content:
        "NR-07 e seus anexos, NR-01 e PGR da organização, além de normas complementares aplicáveis aos agentes e atividades identificados. A versão normativa deve ser confirmada pelo responsável técnico na data de emissão.",
    },
    {
      title: "Diretrizes do PCMSO",
      content:
        "O programa prioriza rastreamento e detecção precoce de agravos, identificação de exposições excessivas, avaliação de aptidão, apoio às medidas de prevenção, análises epidemiológicas, encaminhamentos, reabilitação e readaptação quando aplicáveis, além de imunização relacionada aos riscos quando houver recomendação oficial.",
    },
    {
      title: "Exames ocupacionais",
      content:
        "O planejamento contempla exames admissional, periódico, de retorno ao trabalho, de mudança de risco ocupacional e demissional. Exames complementares são definidos a partir dos riscos, anexos aplicáveis, achados clínicos e julgamento médico, sem associação automática genérica.",
    },
    {
      title: "Critérios de interpretação e conduta",
      content:
        "Resultados e achados devem ser avaliados em conjunto com histórico clínico e ocupacional, exposições e controles. Alterações podem demandar investigação, reavaliação, acompanhamento, revisão do PGR, encaminhamento ou outras condutas médicas, preservado o sigilo profissional.",
    },
    {
      title: "Vigilância da saúde ocupacional",
      content:
        "A vigilância passiva considera demandas espontâneas dos trabalhadores. A vigilância ativa utiliza avaliações clínicas, exames dirigidos e análise consolidada de sinais, sintomas e indicadores relacionados aos riscos ocupacionais.",
    },
    {
      title: "Relatório analítico",
      content:
        "O relatório analítico anual consolida exames realizados, resultados anormais, incidência e prevalência, informações estatísticas por unidade de análise permitida, comparação com períodos anteriores e recomendações para prevenção, sem exposição indevida de dados clínicos individuais.",
    },
  ];
  return { introduction, objective, methodology, chapters };
}

export function auditPcmso(input: {
  program: Record<string, any>;
  monitoring: PcmsoRiskRow[];
  annexCount: number;
  analyticalReportCount: number;
}) {
  const requirements = [
    ["Identificação e vigência", !!input.program.title && !!input.program.valid_from && !!input.program.valid_until],
    ["Médico responsável e CRM", !!input.program.doctor_name && !!input.program.doctor_crm],
    ["PGR de referência", !!input.program.pgr_id],
    ["GSEs e riscos importados", input.monitoring.length > 0],
    ["Todos os riscos com decisão médica", input.monitoring.length > 0 && input.monitoring.every(row => clean(row.monitoring_kind) !== "nao_definido")],
    ["Possíveis agravos documentados", input.monitoring.length > 0 && input.monitoring.every(row => !!clean(row.possible_aggravations))],
    ["Periodicidades definidas", input.monitoring.filter(row => clean(row.monitoring_kind) !== "nao_aplicavel").every(row => !!clean(row.periodicity))],
    ["Metodologia", !!clean(input.program.methodology)],
    ["Diretrizes e vigilância", !!clean(input.program.chapters_json)],
    ["Critérios de interpretação e conduta", normalized(input.program.chapters_json).includes("conduta")],
    ["Relatório analítico", input.analyticalReportCount > 0],
    ["Assinatura médica", !!input.program.signed_at || !!input.program.signature_hash],
    ["Arquivamento/versionamento preparado", input.annexCount >= 0],
    ["PGR sincronizado", !Number(input.program.review_required || 0)],
  ].map(([label, passed]) => ({ label: String(label), passed: Boolean(passed) }));
  const passed = requirements.filter(item => item.passed).length;
  const score = Math.round((passed / requirements.length) * 100);
  return {
    score,
    requirements,
    pending: requirements.filter(item => !item.passed).map(item => item.label),
    disclaimer:
      "A auditoria é assistiva e não constitui certificação, aprovação normativa ou substituição da responsabilidade técnica do médico.",
  };
}
