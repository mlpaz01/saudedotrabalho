import { describe, expect, it } from "vitest";
import {
  evaluateExamParameters,
  parseClinicalNumber,
  parseDocumentReference,
} from "./examReferenceEngine";

describe("triagem parametrizada de exames ocupacionais", () => {
  it("interpreta separador de milhar brasileiro", () => {
    expect(parseClinicalNumber("30.000/mm³")).toBe(30000);
    expect(parseClinicalNumber("4,5 milhões")).toBe(4.5);
  });

  it("identifica leucócitos acima da referência informada no laudo", () => {
    const result = evaluateExamParameters(
      [
        {
          name: "Leucócitos",
          value: "30.000/mm³",
          unit: "/mm³",
          reference: "4.000 a 11.000/mm³",
        },
      ],
      []
    );
    expect(result.status).toBe("alterado");
    expect(result.flags[0]).toMatchObject({
      status: "alto",
      numericValue: 30000,
      referenceSource: "laudo",
    });
  });

  it("utiliza regra versionada do catálogo quando o laudo não traz faixa", () => {
    const result = evaluateExamParameters(
      [{ name: "Glicose", value: "92", unit: "mg/dL" }],
      [
        {
          id: 10,
          parameter_name: "Glicose",
          sex_scope: "todos",
          unit: "mg/dL",
          lower_bound: 70,
          upper_bound: 99,
          critical_upper_bound: 300,
          version: 2,
        },
      ]
    );
    expect(result.status).toBe("normal");
    expect(result.flags[0]).toMatchObject({
      status: "normal",
      referenceSource: "catalogo",
      ruleId: 10,
      ruleVersion: 2,
    });
  });

  it("destaca limite crítico sem decidir aptidão", () => {
    const result = evaluateExamParameters(
      [{ name: "Glicose", value: "450", unit: "mg/dL" }],
      [
        {
          id: 11,
          parameter_name: "Glicose",
          sex_scope: "todos",
          unit: "mg/dL",
          lower_bound: 70,
          upper_bound: 99,
          critical_upper_bound: 300,
          version: 1,
        },
      ]
    );
    expect(result.status).toBe("critico");
    expect(result.medicalPriority).toBe("critica");
    expect(result.requiresMedicalReview).toBe(true);
    expect(result).not.toHaveProperty("fitnessStatus");
  });

  it("respeita sexo e faixa etária na seleção da regra", () => {
    const result = evaluateExamParameters(
      [{ name: "Ferritina", value: "18", unit: "ng/mL" }],
      [
        {
          id: 20,
          parameter_name: "Ferritina",
          sex_scope: "masculino",
          age_min_years: 18,
          unit: "ng/mL",
          lower_bound: 30,
          upper_bound: 400,
          version: 1,
        },
        {
          id: 21,
          parameter_name: "Ferritina",
          sex_scope: "feminino",
          age_min_years: 18,
          unit: "ng/mL",
          lower_bound: 15,
          upper_bound: 150,
          version: 1,
        },
      ],
      { sex: "feminino", ageYears: 34 }
    );
    expect(result.status).toBe("normal");
    expect(result.flags[0].ruleId).toBe(21);
  });

  it("classifica referências qualitativas sem usar diagnóstico", () => {
    const result = evaluateExamParameters(
      [{ name: "Toxicologia", value: "Positivo", reference: "Negativo" }],
      []
    );
    expect(result.status).toBe("alterado");
    expect(result.flags[0].status).toBe("alterado_qualitativo");
  });

  it("marca comparação parcial quando faltam regras para parte do laudo", () => {
    const result = evaluateExamParameters(
      [
        { name: "Hemoglobina", value: "14", reference: "12 a 16" },
        { name: "Observação livre", value: "Sem descrição comparável" },
      ],
      []
    );
    expect(result.status).toBe("parcial");
    expect(result.evaluatedParameters).toBe(1);
    expect(result.unmatchedParameters).toBe(1);
  });

  it("interpreta referências de limite único", () => {
    expect(parseDocumentReference("até 200 mg/dL")).toMatchObject({
      upper: 200,
    });
    expect(parseDocumentReference(">= 40 mg/dL")).toMatchObject({ lower: 40 });
  });
});
