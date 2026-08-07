import { describe, expect, it } from "vitest";
import { searchKnowledgeArticles } from "./knowledgeCatalog";

describe("knowledge catalog", () => {
  it("localiza cobrança segmentada com linguagem natural", () => {
    const [article] = searchKnowledgeArticles("como cobrar somente os funcionários da filial Bahia", "rh", 3);
    expect(article?.slug).toBe("cobrar-drps-aep-segmentado");
  });

  it("prioriza cadastro de atestado para pergunta do RH", () => {
    const [article] = searchKnowledgeArticles("recebi um atestado físico e quero usar OCR", "rh", 3);
    expect(article?.slug).toBe("atestados-rh-ocr-arquivo");
  });

  it("não expõe administração white label ao colaborador", () => {
    const articles = searchKnowledgeArticles("white label domínio créditos", "user", 20);
    expect(articles.some((article) => article.slug === "white-label-rede")).toBe(false);
  });
});
