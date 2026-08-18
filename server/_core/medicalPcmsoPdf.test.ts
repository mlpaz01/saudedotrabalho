import { describe, expect, it } from "vitest";
import {
  buildPcmsoPdfHtml,
  removePcmsoAnalyticalReportSection,
  removePcmsoSuggestedExamsSection,
} from "./medicalRouter";

describe("PCMSO official PDF content", () => {
  it("removes the generated suggested-exams section and preserves the next official section", () => {
    const html = [
      "<h2>20.4. Controle médico</h2><p>Conteúdo aprovado.</p>",
      "<h3>20.5. Exames Ocupacionais Sugeridos</h3>",
      "<p>Exame automático que não foi definido pelo médico.</p>",
      "<h2>21. Condutas do programa</h2><p>Conduta oficial.</p>",
    ].join("");

    const result = removePcmsoSuggestedExamsSection(html);

    expect(result).toContain("20.4. Controle médico");
    expect(result).toContain("21. Condutas do programa");
    expect(result).toContain("Conduta oficial");
    expect(result).not.toContain("Exames Ocupacionais Sugeridos");
    expect(result).not.toContain("Exame automático");
  });

  it("does not alter official content when the obsolete section is absent", () => {
    const html = "<h2>17. METODOLOGIA DO PROGRAMA</h2><p>Texto oficial.</p>";
    expect(removePcmsoSuggestedExamsSection(html)).toBe(html);
  });

  it("keeps the annual analytical report outside the PCMSO body", () => {
    const html =
      "<h2>25.9. Indicadores</h2><p>Indicadores.</p><h3>25.10. Relatório Analítico Anual</h3><p>Bloco independente.</p><h2>26. Responsabilidades</h2><p>Responsabilidades.</p>";
    const result = removePcmsoAnalyticalReportSection(html);
    expect(result).toContain("25.9. Indicadores");
    expect(result).toContain("26. Responsabilidades");
    expect(result).not.toContain("Relatório Analítico Anual");
    expect(result).not.toContain("Bloco independente");
  });

  it("builds one official sequence without the old blank conclusion or analytical report", () => {
    const html = buildPcmsoPdfHtml({
      program: {
        title: "PCMSO Oficial",
        company_name: "Empresa Teste",
        introduction:
          "<h2>14. AVALIAÇÃO DAS MEDIDAS DE PREVENÇÃO</h2><p>Texto novo.</p>",
        conclusion:
          "<h2>17. METODOLOGIA DO PROGRAMA</h2><p>Continuação oficial.</p><h2>20.5. Exames Ocupacionais Sugeridos</h2><p>Não usar.</p><h2>21. RESPONSABILIDADES</h2><p>Texto oficial.</p><h2>25.10. Relatório Analítico Anual</h2><p>Documento separado.</p><h2>26. CONTROLE</h2><p>Controle oficial.</p>",
      },
      monitoring: [],
      annexes: [],
    });

    expect(html).toContain("14. AVALIAÇÃO DAS MEDIDAS DE PREVENÇÃO");
    expect(html).toContain("15. Detalhamento dos GSEs");
    expect(html).toContain("17. METODOLOGIA DO PROGRAMA");
    expect(html).toContain("21. RESPONSABILIDADES");
    expect(html).toContain("26. CONTROLE");
    expect(html).not.toContain("Exames Ocupacionais Sugeridos");
    expect(html).not.toContain("<h2>16. Conclusão</h2>");
    expect(html).not.toContain("Relatório Analítico Anual");
    expect(html).not.toContain("Documento separado");
  });
});
