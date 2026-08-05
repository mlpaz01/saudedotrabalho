import { describe, expect, it } from "vitest";
import { calculateLeaveReviewFlags } from "./occupationalHealthRouter";

describe("regras de revisão de afastamentos", () => {
  it("sinaliza revisão previdenciária somente acima de 15 dias", () => {
    expect(calculateLeaveReviewFlags(15, "2026-08-01")).toEqual({
      benefitReviewRequired: false,
      recurrenceReviewRequired: false,
    });
    expect(calculateLeaveReviewFlags(16, "2026-08-01").benefitReviewRequired).toBe(true);
  });

  it("sinaliza recorrência até 60 dias sem transformar o alerta em decisão", () => {
    expect(calculateLeaveReviewFlags(3, "2026-08-30", "2026-07-01").recurrenceReviewRequired).toBe(true);
    expect(calculateLeaveReviewFlags(3, "2026-08-31", "2026-07-01").recurrenceReviewRequired).toBe(false);
    expect(calculateLeaveReviewFlags(3, "2026-06-30", "2026-07-01").recurrenceReviewRequired).toBe(false);
  });
});
