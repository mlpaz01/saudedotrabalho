import { describe, expect, it } from "vitest";
import {
  laborHistoryHash,
  normalizeHistoryDate,
  validateLaborHistoryRow,
} from "./occupationalPpp";

describe("historico laboral do PPP", () => {
  it("normaliza datas brasileiras e datas seriais do Excel", () => {
    expect(normalizeHistoryDate("15/03/2020")).toBe("2020-03-15");
    expect(normalizeHistoryDate(43891)).toBe("2020-03-01");
    expect(normalizeHistoryDate("31/02/2020")).toBeNull();
  });

  it("mapeia uma linha completa do modelo de importacao", () => {
    const result = validateLaborHistoryRow(
      {
        CPF: "529.982.247-25",
        "Data Inicio": "01/02/2018",
        "Data Fim": "31/12/2022",
        "Tipo Evento": "Mudanca de funcao",
        "Cargo Funcao": "Operador",
        "GSE GHE": "Producao",
        "Agente Risco Exposicao": "Ruido continuo",
        "Codigo Agente eSocial": "02.01.001",
        "EPI Eficaz": "Sim",
      },
      2
    );
    expect(result.errors).toEqual([]);
    expect(result.row.cpf).toBe("52998224725");
    expect(result.row.eventType).toBe("mudanca_funcao");
    expect(result.row.epiEffective).toBe(true);
  });

  it("bloqueia linhas sem identificador e com periodo invertido", () => {
    const result = validateLaborHistoryRow(
      {
        "Data Inicio": "10/10/2024",
        "Data Fim": "09/10/2024",
        Cargo: "Analista",
      },
      3
    );
    expect(result.errors).toContain(
      "Informe CPF ou matricula para localizar o colaborador."
    );
    expect(result.errors).toContain("Data Fim anterior a Data Inicio.");
  });

  it("gera hash estavel e sensivel ao colaborador", () => {
    const parsed = validateLaborHistoryRow(
      { CPF: "52998224725", "Data Inicio": "2020-01-01", Cargo: "Tecnico" },
      2
    ).row;
    expect(laborHistoryHash(1, 10, parsed)).toBe(
      laborHistoryHash(1, 10, parsed)
    );
    expect(laborHistoryHash(1, 10, parsed)).not.toBe(
      laborHistoryHash(1, 11, parsed)
    );
  });
});
