import { describe, expect, it } from "vitest";
import {
  auditTechnicalDocument,
  buildTechnicalDocumentDraft,
  buildTechnicalDocumentTitle,
} from "./technicalDocumentIntelligence";

describe("technicalDocumentIntelligence", () => {
  it("gera título rastreável", () => {
    expect(
      buildTechnicalDocumentTitle({
        type: "ltcat",
        companyName: "Empresa Teste",
        year: 2026,
      })
    ).toContain("Empresa Teste - 2026");
  });

  it("gera estrutura sem firmar conclusão automática", () => {
    const draft = buildTechnicalDocumentDraft({
      type: "insalubridade",
      companyName: "Empresa",
      pgrTitle: "PGR 2026",
      riskRows: [{ gse_name: "Produção", risk_name: "Ruído" }],
    });
    expect(draft.chapters.length).toBeGreaterThan(3);
    expect(draft.conclusion).toContain("em elaboração");
  });

  it("impede alta conformidade com decisões pendentes", () => {
    const result = auditTechnicalDocument({
      document: {
        pgr_id: 1,
        pgr_synced_at: new Date(),
        responsible_name: "Engenheiro",
        responsible_registration: "CREA 1",
        objective: "x".repeat(80),
        legal_basis: "x".repeat(80),
        methodology: "x".repeat(120),
        conclusion: "x".repeat(80),
      },
      risks: [{ decision_status: "pendente" }],
      attachmentCount: 0,
    });
    expect(result.criticalPending.some(item => item.key === "decisions")).toBe(true);
  });
});
