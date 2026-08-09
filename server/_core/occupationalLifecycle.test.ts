import { describe, expect, it } from "vitest";
import {
  classifyNumericReference,
  evaluateAsoReadiness,
  nextReissueVersion,
  normalizeGseCode,
  orderLabel,
} from "./occupationalLifecycle";

describe("occupational lifecycle rules", () => {
  it("normalizes a stable GSE code", () => {
    expect(normalizeGseCode(" gse 001 - Produção ")).toBe("GSE-001-PRODU-O");
  });

  it("versions requisitions without replacing their history", () => {
    expect(nextReissueVersion([1, 2, 4])).toBe(5);
    expect(orderLabel(1)).toBe("Original");
    expect(orderLabel(3)).toBe("3ª via");
  });

  it("requires every expected exam and medical review before ASO", () => {
    expect(
      evaluateAsoReadiness({
        expectedExamIds: [10, 11],
        completedExamIds: [10],
        pendingMedicalReview: 1,
      })
    ).toEqual({ ready: false, missingExamIds: [11], pendingMedicalReview: 1 });
    expect(
      evaluateAsoReadiness({
        expectedExamIds: [10, 11],
        completedExamIds: [10, 11],
        pendingMedicalReview: 0,
      }).ready
    ).toBe(true);
  });

  it("uses the reference supplied with the result", () => {
    expect(classifyNumericReference(14.2, 12, 16)).toBe(
      "conforme_referencia"
    );
    expect(classifyNumericReference(18, 12, 16)).toBe("fora_referencia");
    expect(classifyNumericReference(18)).toBe("pendente_revisao");
  });
});
