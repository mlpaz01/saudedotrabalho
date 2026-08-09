export type AsoValidationInput = {
  expectedExamIds: number[];
  completedExamIds: number[];
  pendingMedicalReview: number;
};

export function normalizeGseCode(value: string) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function nextReissueVersion(currentVersions: number[]) {
  return Math.max(0, ...currentVersions.map(value => Number(value) || 0)) + 1;
}

export function orderLabel(version: number) {
  if (version <= 1) return "Original";
  return `${version}ª via`;
}

export function evaluateAsoReadiness(input: AsoValidationInput) {
  const completed = new Set(input.completedExamIds.map(Number));
  const missingExamIds = [...new Set(input.expectedExamIds.map(Number))].filter(
    id => !completed.has(id)
  );
  return {
    ready: missingExamIds.length === 0 && input.pendingMedicalReview === 0,
    missingExamIds,
    pendingMedicalReview: Math.max(0, Number(input.pendingMedicalReview) || 0),
  };
}

export function classifyNumericReference(
  value: number,
  minimum?: number | null,
  maximum?: number | null
) {
  if (!Number.isFinite(value)) return "inconclusivo" as const;
  if (minimum != null && Number.isFinite(minimum) && value < minimum)
    return "fora_referencia" as const;
  if (maximum != null && Number.isFinite(maximum) && value > maximum)
    return "fora_referencia" as const;
  if (minimum == null && maximum == null) return "pendente_revisao" as const;
  return "conforme_referencia" as const;
}
