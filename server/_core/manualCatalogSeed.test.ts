import { describe, expect, it } from "vitest";
import { manualCatalogSeed } from "./manualCatalogSeed";

describe("manualCatalogSeed", () => {
  it("preserva os 163 artigos unicos do catalogo aprovado para importacao", () => {
    expect(manualCatalogSeed).toHaveLength(163);
    expect(new Set(manualCatalogSeed.map(article => article.slug)).size).toBe(
      163
    );
  });

  it("mantem todos os artigos em validacao antes da publicacao", () => {
    expect(
      manualCatalogSeed.every(
        article =>
          article.workflowStatus === "em_validacao" && !article.isActive
      )
    ).toBe(true);
  });

  it("usa rotas internas e possui ao menos um perfil autorizado", () => {
    for (const article of manualCatalogSeed) {
      expect(article.route.startsWith("/")).toBe(true);
      expect(article.roles.length).toBeGreaterThan(0);
      expect(article.title.trim().length).toBeGreaterThan(0);
      expect(article.module.trim().length).toBeGreaterThan(0);
    }
  });
});
