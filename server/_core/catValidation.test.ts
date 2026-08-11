import { describe, expect, it } from "vitest";
import { mysqlDateTime, validateCatDraft } from "./catValidation";

const validInput = {
  collaboratorId: 10,
  eventAt: "2026-08-10T13:30:00.000Z",
  catType: "inicial",
  accidentType: "tipico",
  employerRegistrationType: "cnpj",
  hoursWorkedBeforeAccident: "04:30",
  lastWorkedDate: "2026-08-10",
  locationType: "1",
  location: "Rua do Trabalho",
  locationNumber: "100",
  locationDetail: "Área de manutenção",
  neighborhood: "Centro",
  postalCode: "20000000",
  eventCity: "Rio de Janeiro",
  eventCityCode: "3304557",
  eventUf: "RJ",
  eventCountry: "Brasil",
  eventCountryCode: "105",
  description:
    "O trabalhador caiu no piso durante a manutenção e sofreu contusão no braço direito.",
  causativeAgentCode: "303000000",
  causativeAgent: "Piso de edifício",
  generatingSituationCode: "200012900",
  generatingSituation: "Queda de pessoa com diferença de nível, NIC",
  bodyPartCode: "753510100",
  bodyPart: "Braço",
  laterality: "direita",
  injuryNatureCode: "702015000",
  injuryNature: "Contusão, esmagamento (superfície cutânea intacta)",
  leaveRequired: false,
  deathOccurred: false,
  medicalAttendanceAt: "2026-08-10T14:00:00.000Z",
  treatmentDays: 3,
  diagnosis: "Contusão no braço direito",
  cid: "S400",
  doctorName: "Médica Responsável",
  doctorCouncil: "CRM",
  doctorUf: "RJ",
  doctorRegistration: "123456",
};

const worker = {
  id: 10,
  cpf: "52998224725",
  employee_registration: "MAT-100",
};

const company = { cnpj: "11222333000181" };

describe("conferência inteligente da CAT", () => {
  it("aprova um rascunho completo e coerente", () => {
    const result = validateCatDraft({
      input: validInput,
      worker,
      company,
      now: new Date("2026-08-11T12:00:00.000Z"),
    });
    expect(result.status).toBe("ready");
    expect(result.canSave).toBe(true);
    expect(result.errors).toBe(0);
  });

  it("bloqueia escada permanente e inflamação quando o relato descreve escada portátil e entorse", () => {
    const result = validateCatDraft({
      input: {
        ...validInput,
        description:
          "O funcionário caiu ao utilizar uma escada portátil e sofreu entorse no tornozelo direito.",
        diagnosis: "Entorse no tornozelo direito",
        causativeAgent:
          "Escada permanente cujos degraus permitem apoio integral do pé",
        bodyPart: "Pé (exceto artelhos)",
        injuryNatureCode: "702025000",
        injuryNature:
          "Inflamação de articulação, tendão ou músculo; não inclui distensão, torção ou suas consequências",
      },
      worker,
      company,
      now: new Date("2026-08-11T12:00:00.000Z"),
    });
    const codes = result.issues.map(issue => issue.code);
    expect(codes).toContain("CAT_LADDER_AGENT_MISMATCH");
    expect(codes).toContain("CAT_INJURY_TWIST_MISMATCH");
    expect(result.status).toBe("blocked");
  });

  it("bloqueia códigos que descrevem tipos incompatíveis de escada", () => {
    const result = validateCatDraft({
      input: {
        ...validInput,
        description:
          "O trabalhador caiu de uma escada durante a manutenção do equipamento.",
        causativeAgent: "Escada permanente com degraus",
        generatingSituation: "Queda de escada móvel ou portátil",
      },
      worker,
      company,
      now: new Date("2026-08-11T12:00:00.000Z"),
    });
    expect(
      result.issues.some(issue => issue.code === "CAT_LADDER_CODES_MISMATCH")
    ).toBe(true);
  });

  it("não considera a CAT pronta quando faltam vínculo e atendimento obrigatório", () => {
    const result = validateCatDraft({
      input: {
        ...validInput,
        medicalAttendanceAt: "",
        cid: "",
        doctorName: "",
      },
      worker: { id: 10, cpf: "52998224725", employee_registration: "" },
      company,
      now: new Date("2026-08-11T12:00:00.000Z"),
    });
    const codes = result.issues.map(issue => issue.code);
    expect(codes).toContain("CAT_WORKER_REGISTRATION");
    expect(codes).toContain("CAT_MEDICAL_DATE");
    expect(codes).toContain("CAT_CID");
    expect(result.canSave).toBe(false);
  });

  it("rejeita códigos que não pertencem às tabelas oficiais", () => {
    const result = validateCatDraft({
      input: validInput,
      worker,
      company,
      invalidOfficialCodes: [
        { field: "injuryNatureCode", code: "999999999", table: "17" },
      ],
      now: new Date("2026-08-11T12:00:00.000Z"),
    });
    expect(
      result.issues.some(issue => issue.code === "CAT_OFFICIAL_CODE")
    ).toBe(true);
    expect(result.status).toBe("blocked");
  });
});

describe("datas da CAT no MySQL", () => {
  it("preserva o horário local informado no campo datetime-local", () => {
    expect(mysqlDateTime("2026-08-10T10:30")).toBe("2026-08-10 10:30:00");
  });

  it("converte ISO para DATETIME sem enviar o sufixo Z ao banco", () => {
    expect(mysqlDateTime("2026-08-10T13:30:00.000Z")).toBe(
      "2026-08-10 13:30:00"
    );
  });

  it("retorna null para uma data inválida", () => {
    expect(mysqlDateTime("data inválida")).toBeNull();
  });
});
