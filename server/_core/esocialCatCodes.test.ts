import { describe, expect, it } from "vitest";
import codes from "./data/esocialCatCodes.json";

describe("catálogo interno de códigos da CAT", () => {
  it("contém as quatro tabelas exigidas no fluxo da CAT", () => {
    const kinds = new Set(codes.map(item => item.kind));
    expect(kinds).toEqual(
      new Set([
        "causative_agent",
        "generating_situation",
        "body_part",
        "injury_nature",
      ])
    );
  });

  it("não possui código duplicado dentro da mesma tabela", () => {
    const keys = codes.map(item => `${item.kind}:${item.code}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("mantém descrição e versão de origem em todos os itens", () => {
    expect(codes.length).toBeGreaterThan(300);
    expect(
      codes.every(
        item =>
          item.code.trim() &&
          item.description.trim() &&
          item.sourceVersion.includes("eSocial S-1.3")
      )
    ).toBe(true);
  });
});
