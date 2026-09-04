export type ExamParameterInput = {
  name: string;
  value: string;
  unit?: string | null;
  reference?: string | null;
};

export type ExamReferenceRule = {
  id: number;
  parameter_name: string;
  aliases_json?: string | null;
  sex_scope?: string | null;
  age_min_years?: number | string | null;
  age_max_years?: number | string | null;
  method_pattern?: string | null;
  laboratory_pattern?: string | null;
  unit?: string | null;
  lower_bound?: number | string | null;
  upper_bound?: number | string | null;
  critical_lower_bound?: number | string | null;
  critical_upper_bound?: number | string | null;
  qualitative_normal_json?: string | null;
  qualitative_altered_json?: string | null;
  version?: number | null;
};

export type ExamScreeningContext = {
  sex?: string | null;
  ageYears?: number | null;
  methodName?: string | null;
  laboratoryName?: string | null;
};

export type ExamParameterScreening = {
  parameter: string;
  rawValue: string;
  numericValue: number | null;
  unit: string | null;
  reference: string | null;
  referenceSource: "laudo" | "catalogo" | "nenhuma";
  ruleId: number | null;
  ruleVersion: number | null;
  status:
    | "normal"
    | "baixo"
    | "alto"
    | "critico_baixo"
    | "critico_alto"
    | "alterado_qualitativo"
    | "nao_comparavel"
    | "sem_regra";
  reason: string;
};

export type ExamScreeningResult = {
  status: "normal" | "alterado" | "critico" | "parcial" | "nao_classificado";
  medicalPriority: "rotina" | "alta" | "critica";
  requiresMedicalReview: true;
  summary: string;
  evaluatedParameters: number;
  unmatchedParameters: number;
  flags: ExamParameterScreening[];
  engineVersion: "1.0";
};

type ComparableReference = {
  lower: number | null;
  upper: number | null;
  qualitativeNormal: string[];
};

export function normalizeClinicalText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeUnit(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/[µμ]/g, "u")
    .replace(/[³]/g, "3")
    .replace(/[²]/g, "2")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9/%]+/g, "");
}

export function parseClinicalNumber(value: unknown): number | null {
  const source = String(value || "").trim();
  const token = source.match(/[+-]?\d[\d.,\s]*/)?.[0]?.trim();
  if (!token) return null;
  let normalized = token.replace(/\s+/g, "");
  const lastDot = normalized.lastIndexOf(".");
  const lastComma = normalized.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? "." : ",";
    const thousands = decimal === "." ? /,/g : /\./g;
    normalized = normalized.replace(thousands, "");
    if (decimal === ",") normalized = normalized.replace(",", ".");
  } else if (lastComma >= 0) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (lastDot >= 0) {
    const thousandPattern = /^[+-]?\d{1,3}(\.\d{3})+$/;
    if (thousandPattern.test(normalized))
      normalized = normalized.replace(/\./g, "");
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function jsonStrings(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return String(value)
      .split(/[,;|]/)
      .map(item => item.trim())
      .filter(Boolean);
  }
}

function qualitativeTokens(reference: string) {
  const normalized = normalizeClinicalText(reference);
  const known = [
    "nao reagente",
    "negativo",
    "ausente",
    "sem alteracoes",
    "normal",
    "adequado",
  ];
  return known.filter(token => normalized.includes(token));
}

export function parseDocumentReference(
  reference: unknown
): ComparableReference | null {
  const raw = String(reference || "").trim();
  if (!raw) return null;
  const normalized = normalizeClinicalText(raw);
  const numbers = (raw.match(/[+-]?\d[\d.,\s]*/g) || [])
    .map(parseClinicalNumber)
    .filter((value): value is number => value !== null);
  let lower: number | null = null;
  let upper: number | null = null;

  if (numbers.length >= 2 && /\b(a|ate|entre|de)\b|[-–—]/i.test(normalized)) {
    lower = Math.min(numbers[0], numbers[1]);
    upper = Math.max(numbers[0], numbers[1]);
  } else if (numbers.length) {
    const value = numbers[0];
    if (
      /<=|</.test(raw) ||
      /\b(ate|maxim|inferior a|abaixo de)\b/i.test(normalized)
    )
      upper = value;
    else if (
      />=|>/.test(raw) ||
      /\b(acima de|minim|superior a)\b/i.test(normalized)
    )
      lower = value;
  }

  const qualitativeNormal = qualitativeTokens(raw);
  if (lower === null && upper === null && !qualitativeNormal.length)
    return null;
  return { lower, upper, qualitativeNormal };
}

function normalizedSex(value: unknown) {
  const normalized = normalizeClinicalText(value);
  if (["f", "feminino", "mulher"].includes(normalized)) return "feminino";
  if (["m", "masculino", "homem"].includes(normalized)) return "masculino";
  if (["outro", "nao binario", "nao_binario"].includes(normalized))
    return "outro";
  return "nao_informado";
}

function ruleMatchesContext(
  rule: ExamReferenceRule,
  parameter: ExamParameterInput,
  context: ExamScreeningContext
) {
  const ruleSex = normalizedSex(rule.sex_scope || "todos");
  const workerSex = normalizedSex(context.sex);
  if (
    normalizeClinicalText(rule.sex_scope) !== "todos" &&
    ruleSex !== workerSex
  )
    return false;

  const age = context.ageYears ?? null;
  const ageMin = numberOrNull(rule.age_min_years);
  const ageMax = numberOrNull(rule.age_max_years);
  if ((ageMin !== null || ageMax !== null) && age === null) return false;
  if (age !== null && ageMin !== null && age < ageMin) return false;
  if (age !== null && ageMax !== null && age > ageMax) return false;

  if (rule.method_pattern) {
    const method = normalizeClinicalText(context.methodName);
    if (!method || !method.includes(normalizeClinicalText(rule.method_pattern)))
      return false;
  }
  if (rule.laboratory_pattern) {
    const laboratory = normalizeClinicalText(context.laboratoryName);
    if (
      !laboratory ||
      !laboratory.includes(normalizeClinicalText(rule.laboratory_pattern))
    )
      return false;
  }
  if (rule.unit && normalizeUnit(rule.unit) !== normalizeUnit(parameter.unit))
    return false;
  return true;
}

function selectRule(
  rules: ExamReferenceRule[],
  parameter: ExamParameterInput,
  context: ExamScreeningContext
) {
  const parameterName = normalizeClinicalText(parameter.name);
  return rules
    .filter(rule => {
      const names = [
        rule.parameter_name,
        ...jsonStrings(rule.aliases_json),
      ].map(normalizeClinicalText);
      return (
        names.includes(parameterName) &&
        ruleMatchesContext(rule, parameter, context)
      );
    })
    .sort((left, right) => {
      const specificity = (rule: ExamReferenceRule) =>
        Number(normalizeClinicalText(rule.sex_scope) !== "todos") +
        Number(
          rule.age_min_years !== null && rule.age_min_years !== undefined
        ) +
        Number(
          rule.age_max_years !== null && rule.age_max_years !== undefined
        ) +
        Number(Boolean(rule.method_pattern)) +
        Number(Boolean(rule.laboratory_pattern)) +
        Number(Boolean(rule.unit));
      return (
        specificity(right) - specificity(left) ||
        Number(right.version || 0) - Number(left.version || 0)
      );
    })[0];
}

function qualitativeStatus(
  value: string,
  normalValues: string[],
  alteredValues: string[]
) {
  const normalized = normalizeClinicalText(value);
  const matches = (candidate: string) => {
    const expected = normalizeClinicalText(candidate);
    return normalized === expected || normalized.includes(expected);
  };
  if (normalValues.some(matches)) return "normal" as const;
  if (alteredValues.some(matches)) return "alterado_qualitativo" as const;
  const normalizedNormal = normalValues.map(normalizeClinicalText);
  const expectsNegative = normalizedNormal.some(candidate =>
    ["negativo", "nao reagente", "ausente", "sem alteracoes"].includes(
      candidate
    )
  );
  if (
    expectsNegative &&
    ["positivo", "reagente", "presente", "com alteracoes", "alterado"].some(
      candidate => normalized.includes(candidate)
    )
  )
    return "alterado_qualitativo" as const;
  return null;
}

function screenParameter(
  parameter: ExamParameterInput,
  rules: ExamReferenceRule[],
  context: ExamScreeningContext
): ExamParameterScreening {
  const rule = selectRule(rules, parameter, context);
  const documentReference = parseDocumentReference(parameter.reference);
  const numericValue = parseClinicalNumber(parameter.value);
  const catalogNormal = rule ? jsonStrings(rule.qualitative_normal_json) : [];
  const catalogAltered = rule ? jsonStrings(rule.qualitative_altered_json) : [];
  const normalValues = documentReference?.qualitativeNormal.length
    ? documentReference.qualitativeNormal
    : catalogNormal;
  const qualitative = qualitativeStatus(
    parameter.value,
    normalValues,
    catalogAltered
  );
  const lower = documentReference?.lower ?? numberOrNull(rule?.lower_bound);
  const upper = documentReference?.upper ?? numberOrNull(rule?.upper_bound);
  const criticalLower = numberOrNull(rule?.critical_lower_bound);
  const criticalUpper = numberOrNull(rule?.critical_upper_bound);
  const referenceSource = documentReference
    ? "laudo"
    : rule
      ? "catalogo"
      : "nenhuma";
  const base = {
    parameter: parameter.name,
    rawValue: parameter.value,
    numericValue,
    unit: parameter.unit || null,
    reference: parameter.reference || null,
    referenceSource,
    ruleId: rule?.id || null,
    ruleVersion: rule?.version ? Number(rule.version) : null,
  } as const;

  if (qualitative)
    return {
      ...base,
      status: qualitative,
      reason:
        qualitative === "normal"
          ? "Resultado qualitativo compatível com a referência."
          : "Resultado qualitativo fora da referência esperada.",
    };
  if (numericValue === null) {
    return {
      ...base,
      status: rule || documentReference ? "nao_comparavel" : "sem_regra",
      reason:
        rule || documentReference
          ? "O valor não pôde ser convertido em número para comparação."
          : "Não existe regra aplicável para este parâmetro.",
    };
  }
  if (criticalLower !== null && numericValue < criticalLower)
    return {
      ...base,
      status: "critico_baixo",
      reason: `Valor abaixo do limite crítico (${criticalLower}).`,
    };
  if (criticalUpper !== null && numericValue > criticalUpper)
    return {
      ...base,
      status: "critico_alto",
      reason: `Valor acima do limite crítico (${criticalUpper}).`,
    };
  if (lower !== null && numericValue < lower)
    return {
      ...base,
      status: "baixo",
      reason: `Valor abaixo da referência mínima (${lower}).`,
    };
  if (upper !== null && numericValue > upper)
    return {
      ...base,
      status: "alto",
      reason: `Valor acima da referência máxima (${upper}).`,
    };
  if (lower !== null || upper !== null)
    return {
      ...base,
      status: "normal",
      reason: "Valor dentro da faixa de referência aplicável.",
    };
  return {
    ...base,
    status: rule ? "nao_comparavel" : "sem_regra",
    reason: rule
      ? "A regra localizada não possui limites comparáveis para este valor."
      : "Não existe regra aplicável para este parâmetro.",
  };
}

export function evaluateExamParameters(
  parameters: ExamParameterInput[],
  rules: ExamReferenceRule[],
  context: ExamScreeningContext = {}
): ExamScreeningResult {
  const flags = parameters
    .filter(
      parameter =>
        String(parameter.name || "").trim() &&
        String(parameter.value || "").trim()
    )
    .map(parameter => screenParameter(parameter, rules, context));
  const critical = flags.filter(flag =>
    flag.status.startsWith("critico_")
  ).length;
  const altered = flags.filter(flag =>
    ["baixo", "alto", "alterado_qualitativo"].includes(flag.status)
  ).length;
  const normal = flags.filter(flag => flag.status === "normal").length;
  const unmatched = flags.filter(flag =>
    ["sem_regra", "nao_comparavel"].includes(flag.status)
  ).length;
  const evaluated = normal + altered + critical;
  let status: ExamScreeningResult["status"] = "nao_classificado";
  if (critical) status = "critico";
  else if (altered) status = "alterado";
  else if (normal && unmatched) status = "parcial";
  else if (normal) status = "normal";
  const medicalPriority: ExamScreeningResult["medicalPriority"] =
    status === "critico"
      ? "critica"
      : status === "alterado"
        ? "alta"
        : "rotina";
  const summary =
    status === "critico"
      ? `${critical} parâmetro(s) ultrapassaram limite crítico e exigem avaliação médica prioritária.`
      : status === "alterado"
        ? `${altered} parâmetro(s) ficaram fora da referência e exigem avaliação médica.`
        : status === "normal"
          ? `${normal} parâmetro(s) ficaram dentro das referências comparáveis.`
          : status === "parcial"
            ? `${normal} parâmetro(s) dentro da referência e ${unmatched} sem comparação automática.`
            : "Não foi possível comparar automaticamente os parâmetros informados.";
  return {
    status,
    medicalPriority,
    requiresMedicalReview: true,
    summary,
    evaluatedParameters: evaluated,
    unmatchedParameters: unmatched,
    flags,
    engineVersion: "1.0",
  };
}
