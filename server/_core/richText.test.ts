import { describe, expect, it } from "vitest";
import { richTextToPlainText, sanitizeRichText } from "./richText";

describe("conteúdo rico dos documentos técnicos", () => {
  it("preserva parágrafos e listas sem expor tags como texto", () => {
    const result = sanitizeRichText(
      "<p>Condutas possíveis:</p><ul><li><p>acompanhamento;</p></li><li><p>repetição do exame;</p></li><li><p>avaliação especializada.</p></li></ul>"
    );
    expect(result).toContain("<p>Condutas possíveis:</p>");
    expect(result).toContain("<ul>");
    expect(result).toContain("<li><p>acompanhamento;</p></li>");
    expect(result).not.toContain("&lt;li&gt;");
  });

  it("remove scripts, eventos e URLs executáveis", () => {
    const result = sanitizeRichText(
      '<p onclick="alert(1)">Texto</p><script>alert(2)</script><a href="javascript:alert(3)">link</a>'
    );
    expect(result).toBe("<p>Texto</p><a>link</a>");
  });

  it("transforma texto simples em parágrafos editáveis", () => {
    expect(sanitizeRichText("Primeiro parágrafo.\n\nSegundo parágrafo.")).toBe(
      "<p>Primeiro parágrafo.</p><p>Segundo parágrafo.</p>"
    );
  });

  it("gera título simples a partir de HTML", () => {
    expect(richTextToPlainText("<strong>Conclusão</strong>")).toBe("Conclusão");
  });
});
