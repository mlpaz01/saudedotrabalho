export type TechnicalDocumentType =
  | "ltcat"
  | "insalubridade"
  | "periculosidade";

type RiskRow = {
  gse_name?: string | null;
  risk_name?: string | null;
  risk_type?: string | null;
  risk_classification?: string | null;
  technical_detail?: string | null;
  possible_damage?: string | null;
  source?: string | null;
  decision_status?: string | null;
  technical_conclusion?: string | null;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

const LABELS: Record<TechnicalDocumentType, string> = {
  ltcat: "LTCAT - Laudo Técnico das Condições Ambientais do Trabalho",
  insalubridade: "Laudo Técnico de Insalubridade",
  periculosidade: "Laudo Técnico de Periculosidade",
};

const LEGAL_BASIS: Record<TechnicalDocumentType, string> = {
  ltcat:
    "Lei nº 8.213/1991, Decreto nº 3.048/1999 e normas previdenciárias aplicáveis, sem prejuízo das Normas Regulamentadoras e referências técnicas pertinentes.",
  insalubridade:
    "Consolidação das Leis do Trabalho e NR-15, considerando seus anexos e critérios qualitativos ou quantitativos aplicáveis a cada agente.",
  periculosidade:
    "Consolidação das Leis do Trabalho e NR-16, considerando atividades, operações, áreas de risco e demais critérios aplicáveis.",
};

export function buildTechnicalDocumentTitle(input: {
  type: TechnicalDocumentType;
  companyName?: string | null;
  year?: number | null;
}) {
  return `${LABELS[input.type]} - ${clean(input.companyName) || "Empresa"} - ${input.year || new Date().getFullYear()}`;
}

export function buildTechnicalDocumentDraft(input: {
  type: TechnicalDocumentType;
  companyName?: string | null;
  pgrTitle?: string | null;
  riskRows: RiskRow[];
}) {
  const gses = [...new Set(input.riskRows.map(row => clean(row.gse_name) || "Sem GSE"))];
  const risks = input.riskRows
    .map(row => clean(row.risk_name))
    .filter(Boolean);
  const objective =
    input.type === "ltcat"
      ? "Caracterizar as condições ambientais de trabalho e registrar, sob responsabilidade técnica, a análise dos agentes potencialmente nocivos para fins previdenciários."
      : input.type === "insalubridade"
        ? "Avaliar tecnicamente a existência ou inexistência de condições insalubres nas atividades e ambientes abrangidos pelo escopo selecionado."
        : "Avaliar tecnicamente a existência ou inexistência de condições perigosas nas atividades, operações e áreas abrangidas pelo escopo selecionado.";
  const methodology = `A elaboração parte do ${clean(input.pgrTitle) || "PGR de referência"}, seus GSEs, inventário de riscos, detalhamentos técnicos, medidas de controle e evidências disponíveis. Foram identificados ${gses.length} GSE(s) e ${risks.length} risco(s). A classificação definitiva depende da análise do responsável técnico, inspeções, medições e documentos aplicáveis. Sugestões automatizadas não substituem avaliação profissional nem produzem conclusão pericial automática.`;
  const chapters = [
    {
      title: "Identificação da organização e escopo",
      content: `Organização: ${clean(input.companyName) || "a confirmar"}. Escopo construído a partir dos GSEs importados do PGR: ${gses.join(", ") || "nenhum GSE importado"}.`,
    },
    {
      title: "Fundamentação legal e técnica",
      content: LEGAL_BASIS[input.type],
    },
    {
      title: "Caracterização dos ambientes e atividades",
      content:
        "A caracterização deve consolidar locais, processos, atividades, trabalhadores potencialmente expostos, jornadas, fontes geradoras, vias de exposição e medidas de prevenção existentes.",
    },
    {
      title: "Avaliação dos agentes e condições",
      content:
        "Cada risco deve receber decisão técnica própria, com indicação do critério qualitativo ou quantitativo, metodologia, resultados, limites ou referências aplicáveis e avaliação das medidas de controle.",
    },
    {
      title: "Conclusão técnica",
      content:
        "A conclusão somente poderá ser firmada após validação de todos os riscos do escopo pelo responsável técnico e análise das evidências necessárias.",
    },
  ];
  return {
    objective,
    legalBasis: LEGAL_BASIS[input.type],
    methodology,
    chapters,
    conclusion:
      "Documento em elaboração. A conclusão final será registrada e assinada pelo responsável técnico após revisão integral do conteúdo, das evidências e do escopo.",
  };
}

export function auditTechnicalDocument(input: {
  document: Record<string, any>;
  risks: RiskRow[];
  attachmentCount: number;
}) {
  const checks = [
    {
      key: "pgr",
      label: "PGR de referência selecionado e sincronizado",
      ok: Boolean(input.document.pgr_id && input.document.pgr_synced_at),
      critical: true,
    },
    {
      key: "scope",
      label: "GSEs e riscos importados do PGR",
      ok: input.risks.length > 0,
      critical: true,
    },
    {
      key: "decisions",
      label: "Todos os riscos possuem decisão técnica",
      ok:
        input.risks.length > 0 &&
        input.risks.every(row => row.decision_status === "validado"),
      critical: true,
    },
    {
      key: "responsible",
      label: "Responsável técnico e registro profissional definidos",
      ok: Boolean(
        clean(input.document.responsible_name) &&
          clean(input.document.responsible_registration)
      ),
      critical: true,
    },
    {
      key: "objective",
      label: "Objetivo e escopo descritos",
      ok: clean(input.document.objective).length >= 40,
      critical: false,
    },
    {
      key: "legal_basis",
      label: "Fundamentação legal e técnica registrada",
      ok: clean(input.document.legal_basis).length >= 40,
      critical: false,
    },
    {
      key: "methodology",
      label: "Metodologia registrada",
      ok: clean(input.document.methodology).length >= 80,
      critical: true,
    },
    {
      key: "conclusion",
      label: "Conclusão técnica registrada",
      ok: clean(input.document.conclusion).length >= 40,
      critical: true,
    },
    {
      key: "attachments",
      label: "Evidências ou anexos associados",
      ok: input.attachmentCount > 0,
      critical: false,
    },
    {
      key: "pgr_current",
      label: "PGR não foi alterado depois da sincronização",
      ok: !Number(input.document.review_required || 0),
      critical: true,
    },
  ];
  const passed = checks.filter(check => check.ok).length;
  const score = Math.round((passed / checks.length) * 100);
  return {
    score,
    checks,
    pending: checks.filter(check => !check.ok),
    criticalPending: checks.filter(check => !check.ok && check.critical),
    disclaimer:
      "Auditoria assistida de completude e coerência. Não certifica conformidade, não substitui inspeção, medição, perícia ou responsabilidade técnica.",
  };
}

export function technicalDocumentLabel(type: TechnicalDocumentType) {
  return LABELS[type];
}
