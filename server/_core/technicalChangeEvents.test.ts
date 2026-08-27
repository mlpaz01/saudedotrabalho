import { describe, expect, it } from "vitest";
import { technicalChangedFields, technicalTargetRole } from "./technicalChangeEvents";

describe("eventos técnicos SESMT x Médico", () => {
  it("direciona a atualização ao perfil oposto", () => {
    expect(technicalTargetRole("sesmt")).toBe("medico");
    expect(technicalTargetRole("admin")).toBe("medico");
    expect(technicalTargetRole("medico")).toBe("sesmt");
  });

  it("preserva a comparação antes e depois", () => {
    const changes = technicalChangedFields(
      { agente: "Ruído", severidade: "média", periodicidade: "Anual" },
      { agente: "Ruído", severidade: "alta", periodicidade: "6 meses" },
    );
    expect(changes).toEqual({
      severidade: { before: "média", after: "alta" },
      periodicidade: { before: "Anual", after: "6 meses" },
    });
  });
});
