import { describe, expect, it } from "vitest";
import {
  auditPcmso,
  buildPcmsoDraft,
  buildPcmsoTitle,
  suggestMedicalResponse,
} from "./pcmsoIntelligence";

describe("PCMSO intelligence", () => {
  it("creates a safe automatic title", () => {
    expect(
      buildPcmsoTitle({
        companyName: "Empresa XYZ Ltda",
        branchName: "Filial Rio",
        validFrom: "2026-08-01",
      })
    ).toBe("PCMSO - Empresa XYZ Ltda - Filial Rio - 2026");
  });

  it("suggests but never approves medical monitoring", () => {
    const suggestion = suggestMedicalResponse({ risk_name: "Ruído contínuo" });
    expect(suggestion.monitoringName).toContain("Audiometria");
    expect(suggestion.rationale).toContain("validação");
  });

  it("builds the NR-07 document foundation from PGR rows", () => {
    const draft = buildPcmsoDraft({
      companyName: "Empresa",
      pgrTitle: "PGR 2026",
      riskRows: [{ gse_name: "Produção", risk_name: "Ruído" }],
    });
    expect(draft.chapters.map(item => item.title)).toContain(
      "Critérios de interpretação e conduta"
    );
    expect(draft.methodology).toContain("1 GSE");
  });

  it("keeps incomplete programs visibly pending", () => {
    const result = auditPcmso({
      program: { title: "PCMSO" },
      monitoring: [],
      annexCount: 0,
      analyticalReportCount: 0,
    });
    expect(result.score).toBeLessThan(50);
    expect(result.pending).toContain("PGR de referência");
  });
});
