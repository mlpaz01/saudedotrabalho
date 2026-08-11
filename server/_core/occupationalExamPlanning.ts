export type ExamRequestKind = "normal" | "repeticao";

export type ExamPlanningStatus =
  | "pendente"
  | "requisicao_sem_resultado"
  | "resultado_no_exercicio"
  | "repeticao_autorizada"
  | "repeticao_sem_justificativa"
  | "fora_do_pcmso";

export interface ExamPlanningInput {
  sourceAvailable: boolean;
  resultCount: number;
  requestCount: number;
  requestKind?: ExamRequestKind;
  justification?: string | null;
}

export interface ExamPlanningDecision {
  status: ExamPlanningStatus;
  shouldGenerate: boolean;
  requestKind: ExamRequestKind;
  reason: string;
}

export function classifyExamPlanning(
  input: ExamPlanningInput
): ExamPlanningDecision {
  if (!input.sourceAvailable) {
    return {
      status: "fora_do_pcmso",
      shouldGenerate: false,
      requestKind: "normal",
      reason: "O exame não está previsto para o trabalhador neste PCMSO.",
    };
  }

  const hasResult = Number(input.resultCount || 0) > 0;
  const wantsRepeat = input.requestKind === "repeticao";
  const justification = String(input.justification || "").trim();

  if (hasResult && wantsRepeat) {
    if (justification.length < 10) {
      return {
        status: "repeticao_sem_justificativa",
        shouldGenerate: false,
        requestKind: "repeticao",
        reason: "A repetição exige justificativa com pelo menos 10 caracteres.",
      };
    }
    return {
      status: "repeticao_autorizada",
      shouldGenerate: true,
      requestKind: "repeticao",
      reason:
        "Resultado já existente; nova requisição autorizada como repetição.",
    };
  }

  if (hasResult) {
    return {
      status: "resultado_no_exercicio",
      shouldGenerate: false,
      requestKind: "normal",
      reason: "Exame já possui resultado registrado no exercício.",
    };
  }

  if (Number(input.requestCount || 0) > 0) {
    return {
      status: "requisicao_sem_resultado",
      shouldGenerate: true,
      requestKind: "normal",
      reason:
        "Existe requisição no exercício, mas ainda não há resultado registrado.",
    };
  }

  return {
    status: "pendente",
    shouldGenerate: true,
    requestKind: "normal",
    reason: "Não existe resultado para o exame no exercício selecionado.",
  };
}
