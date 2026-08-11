import { describe, expect, it } from "vitest";
import { classifyExamPlanning } from "./occupationalExamPlanning";

describe("classifyExamPlanning", () => {
  it("gera requisicao normal quando nao existe resultado", () => {
    expect(
      classifyExamPlanning({
        sourceAvailable: true,
        resultCount: 0,
        requestCount: 0,
      })
    ).toMatchObject({ status: "pendente", shouldGenerate: true });
  });

  it("nao considera mera requisicao como exame concluido", () => {
    expect(
      classifyExamPlanning({
        sourceAvailable: true,
        resultCount: 0,
        requestCount: 1,
      })
    ).toMatchObject({
      status: "requisicao_sem_resultado",
      shouldGenerate: true,
    });
  });

  it("bloqueia requisicao normal quando existe resultado no exercicio", () => {
    expect(
      classifyExamPlanning({
        sourceAvailable: true,
        resultCount: 1,
        requestCount: 1,
      })
    ).toMatchObject({
      status: "resultado_no_exercicio",
      shouldGenerate: false,
    });
  });

  it("permite repeticao com justificativa", () => {
    expect(
      classifyExamPlanning({
        sourceAvailable: true,
        resultCount: 1,
        requestCount: 1,
        requestKind: "repeticao",
        justification: "Repeticao indicada pelo medico responsavel.",
      })
    ).toMatchObject({
      status: "repeticao_autorizada",
      shouldGenerate: true,
      requestKind: "repeticao",
    });
  });

  it("exige justificativa para repeticao", () => {
    expect(
      classifyExamPlanning({
        sourceAvailable: true,
        resultCount: 1,
        requestCount: 1,
        requestKind: "repeticao",
        justification: "curta",
      })
    ).toMatchObject({
      status: "repeticao_sem_justificativa",
      shouldGenerate: false,
    });
  });
});
