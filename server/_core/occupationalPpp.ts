import crypto from "crypto";

export const LABOR_HISTORY_COLUMNS = [
  "CPF",
  "Matricula",
  "Data Inicio",
  "Data Fim",
  "Tipo Evento",
  "Filial",
  "Setor",
  "Cargo Funcao",
  "Codigo GSE GHE",
  "GSE GHE",
  "Descricao Atividades",
  "Tipo Risco",
  "Codigo Agente eSocial",
  "Agente Risco Exposicao",
  "Intensidade Concentracao",
  "Tecnica Utilizada",
  "EPC Eficaz",
  "EPI Eficaz",
  "CA EPI",
  "Exame",
  "Data Exame",
  "Aptidao",
  "Origem Documento",
  "Observacoes",
] as const;

export const LABOR_EVENT_TYPES = [
  "admissao",
  "periodo_laboral",
  "mudanca_funcao",
  "transferencia",
  "exposicao",
  "exame",
  "afastamento",
  "desligamento",
  "outro",
] as const;

export type LaborEventType = (typeof LABOR_EVENT_TYPES)[number];

export type LaborHistoryRow = {
  sourceRow: number;
  cpf: string;
  registration: string;
  validFrom: string;
  validUntil: string | null;
  eventType: LaborEventType;
  branchName: string;
  sectorName: string;
  positionName: string;
  gseCode: string;
  gseName: string;
  activityDescription: string;
  riskType: string;
  riskAgentCode: string;
  riskAgent: string;
  intensityConcentration: string;
  evaluationTechnique: string;
  epcEffective: boolean | null;
  epiEffective: boolean | null;
  epiCa: string;
  examName: string;
  examDate: string | null;
  fitnessStatus: string;
  sourceDocument: string;
  notes: string;
};

export type LaborHistoryValidation = {
  row: LaborHistoryRow;
  errors: string[];
  warnings: string[];
};

export function normalizeHistoryText(value: unknown) {
  if (value == null) return "";
  if (typeof value === "object") {
    const richText = (value as any).richText;
    if (Array.isArray(richText))
      return richText
        .map(part => String(part?.text || ""))
        .join("")
        .trim();
    if ((value as any).text != null) return String((value as any).text).trim();
    if ((value as any).result != null)
      return String((value as any).result).trim();
  }
  return String(value).trim();
}

export function normalizeHistoryHeader(value: unknown) {
  return normalizeHistoryText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeCpf(value: unknown) {
  return normalizeHistoryText(value).replace(/\D/g, "").slice(0, 11);
}

export function normalizeHistoryDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return date.toISOString().slice(0, 10);
  }
  const text = normalizeHistoryText(value);
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (iso) return validDate(iso[1], iso[2], iso[3]);
  const br = text.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (br)
    return validDate(
      br[3],
      String(Number(br[2])).padStart(2, "0"),
      String(Number(br[1])).padStart(2, "0")
    );
  return null;
}

function validDate(year: string, month: string, day: string) {
  const value = `${year}-${month}-${day}`;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
    ? value
    : null;
}

export function normalizeHistoryBoolean(value: unknown): boolean | null {
  const text = normalizeHistoryHeader(value);
  if (!text) return null;
  if (["sim", "s", "yes", "1", "eficaz"].includes(text)) return true;
  if (["nao", "n", "no", "0", "ineficaz"].includes(text)) return false;
  return null;
}

export function normalizeLaborEventType(value: unknown): LaborEventType {
  const text = normalizeHistoryHeader(value);
  if (!text) return "periodo_laboral";
  if (text.includes("admiss")) return "admissao";
  if (text.includes("deslig") || text.includes("demiss")) return "desligamento";
  if (
    text.includes("mudanca") &&
    (text.includes("func") || text.includes("cargo"))
  )
    return "mudanca_funcao";
  if (text.includes("transfer")) return "transferencia";
  if (text.includes("expos")) return "exposicao";
  if (text.includes("exame") || text.includes("aso")) return "exame";
  if (text.includes("afast")) return "afastamento";
  if (text.includes("period")) return "periodo_laboral";
  return "outro";
}

function valueFrom(row: Record<string, unknown>, ...aliases: string[]) {
  const normalized = new Map(
    Object.entries(row).map(([key, value]) => [
      normalizeHistoryHeader(key),
      value,
    ])
  );
  for (const alias of aliases) {
    const found = normalized.get(normalizeHistoryHeader(alias));
    if (found != null && found !== "") return found;
  }
  return "";
}

export function validateLaborHistoryRow(
  raw: Record<string, unknown>,
  sourceRow: number
): LaborHistoryValidation {
  const startRaw = valueFrom(raw, "Data Inicio", "Inicio", "Data Inicial");
  const endRaw = valueFrom(raw, "Data Fim", "Fim", "Data Final");
  const examDateRaw = valueFrom(raw, "Data Exame", "Data do Exame");
  const row: LaborHistoryRow = {
    sourceRow,
    cpf: normalizeCpf(valueFrom(raw, "CPF")),
    registration: normalizeHistoryText(
      valueFrom(raw, "Matricula", "Registro", "Matricula do Vinculo")
    ),
    validFrom: normalizeHistoryDate(startRaw) || "",
    validUntil: normalizeHistoryDate(endRaw),
    eventType: normalizeLaborEventType(valueFrom(raw, "Tipo Evento", "Evento")),
    branchName: normalizeHistoryText(valueFrom(raw, "Filial")),
    sectorName: normalizeHistoryText(valueFrom(raw, "Setor")),
    positionName: normalizeHistoryText(
      valueFrom(raw, "Cargo Funcao", "Cargo", "Funcao")
    ),
    gseCode: normalizeHistoryText(
      valueFrom(raw, "Codigo GSE GHE", "Codigo GSE", "Codigo GHE")
    ),
    gseName: normalizeHistoryText(valueFrom(raw, "GSE GHE", "GSE", "GHE")),
    activityDescription: normalizeHistoryText(
      valueFrom(
        raw,
        "Descricao Atividades",
        "Atividades",
        "Descricao da Atividade"
      )
    ),
    riskType: normalizeHistoryText(
      valueFrom(raw, "Tipo Risco", "Tipo do Risco")
    ),
    riskAgentCode: normalizeHistoryText(
      valueFrom(raw, "Codigo Agente eSocial", "Codigo Agente", "Tabela 24")
    ),
    riskAgent: normalizeHistoryText(
      valueFrom(raw, "Agente Risco Exposicao", "Agente", "Risco", "Exposicao")
    ),
    intensityConcentration: normalizeHistoryText(
      valueFrom(raw, "Intensidade Concentracao", "Intensidade", "Concentracao")
    ),
    evaluationTechnique: normalizeHistoryText(
      valueFrom(raw, "Tecnica Utilizada", "Tecnica", "Metodologia")
    ),
    epcEffective: normalizeHistoryBoolean(valueFrom(raw, "EPC Eficaz", "EPC")),
    epiEffective: normalizeHistoryBoolean(valueFrom(raw, "EPI Eficaz", "EPI")),
    epiCa: normalizeHistoryText(
      valueFrom(raw, "CA EPI", "CA", "Certificado Aprovacao")
    ),
    examName: normalizeHistoryText(
      valueFrom(raw, "Exame", "Exame Ocupacional")
    ),
    examDate: normalizeHistoryDate(examDateRaw),
    fitnessStatus: normalizeHistoryText(
      valueFrom(raw, "Aptidao", "Apto Inapto")
    ),
    sourceDocument: normalizeHistoryText(
      valueFrom(raw, "Origem Documento", "Documento Origem", "Fonte")
    ),
    notes: normalizeHistoryText(valueFrom(raw, "Observacoes", "Observacao")),
  };
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!row.cpf && !row.registration)
    errors.push("Informe CPF ou matricula para localizar o colaborador.");
  if (!row.validFrom) errors.push("Data Inicio ausente ou invalida.");
  if (endRaw && !row.validUntil) errors.push("Data Fim invalida.");
  if (examDateRaw && !row.examDate) errors.push("Data Exame invalida.");
  if (row.validFrom && row.validUntil && row.validUntil < row.validFrom)
    errors.push("Data Fim anterior a Data Inicio.");
  if (
    !row.positionName &&
    !row.sectorName &&
    !row.gseName &&
    !row.riskAgent &&
    !row.examName &&
    !row.activityDescription
  )
    errors.push("A linha nao possui informacao laboral para importar.");
  if (row.riskAgent && !row.riskAgentCode)
    warnings.push(
      "Agente sem codigo eSocial/Tabela 24; revisar antes da emissao."
    );
  if (row.eventType === "exame" && !row.examName)
    warnings.push("Evento de exame sem nome do procedimento.");
  if (row.cpf && row.cpf.length !== 11)
    errors.push("CPF deve possuir 11 digitos.");
  return { row, errors, warnings };
}

export function laborHistoryHash(
  companyId: number,
  collaboratorId: number,
  row: LaborHistoryRow
) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        companyId,
        collaboratorId,
        ...row,
        sourceRow: undefined,
      })
    )
    .digest("hex");
}
