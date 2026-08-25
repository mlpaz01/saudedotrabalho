import { describe, expect, it } from "vitest";
import { buildS2221Payload, isValidS2221ExamCode } from "./esocialRouter";

describe("eSocial S-2221", () => {
  it("valida a série de duas letras e os nove dígitos do código sequencial", () => {
    expect(isValidS2221ExamCode("AB123456789")).toBe(true);
    expect(isValidS2221ExamCode("ab123456789")).toBe(true);
    expect(isValidS2221ExamCode("AB12345678")).toBe(false);
    expect(isValidS2221ExamCode("A1123456789")).toBe(false);
  });

  it("mantém o resultado clínico fora do payload oficial", () => {
    const payload = buildS2221Payload(
      {
        examDate: "2026-08-25",
        laboratoryCnpj: "12.345.678/0001-95",
        examCode: "ab123456789",
        doctorName: "Dra. Teste",
        doctorCrm: "12345",
        doctorUf: "sp",
        resultStatus: "positive",
      },
      { cpf: "529.982.247-25", employee_registration: "MAT-2026" },
      { cnpj: "12.345.678/0001-95", environment: "restricted" },
    );

    expect(payload.evtToxic.ideEvento.tpAmb).toBe(2);
    expect(payload.evtToxic.ideEmpregador).toEqual({ tpInsc: 1, nrInsc: "12345678" });
    expect(payload.evtToxic.toxicologico).toEqual({
      dtExame: "2026-08-25",
      cnpjLab: "12345678000195",
      codSeqExame: "AB123456789",
      nmMed: "Dra. Teste",
      nrCRM: "12345",
      ufCRM: "SP",
    });
    expect(JSON.stringify(payload)).not.toContain("positive");
  });
});
