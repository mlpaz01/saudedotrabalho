import { describe, expect, it } from "vitest";
import {
  canTransitionClinicOrder,
  isClinicProcedureAllowed,
  summarizeClinicBilling,
} from "./clinicPortal";

describe("clinic portal workflow", () => {
  it("permite o avanço operacional e bloqueia reabertura após conclusão", () => {
    expect(canTransitionClinicOrder("recebida", "agendada")).toBe(true);
    expect(canTransitionClinicOrder("agendada", "atendimento_realizado")).toBe(
      true
    );
    expect(canTransitionClinicOrder("concluida", "recebida")).toBe(false);
  });

  it("consolida produção, valor e pendências documentais", () => {
    expect(
      summarizeClinicBilling([
        { amount: "75.50", proof_private_path: "/proof/1.pdf" },
        { amount: 100, proof_private_path: null },
      ])
    ).toEqual({
      attendances: 2,
      total: 175.5,
      withProof: 1,
      missingProof: 1,
    });
  });

  it("permite somente os procedimentos auxiliares necessários ao portal", () => {
    expect(isClinicProcedureAllowed("clinicPortal.listOrders")).toBe(true);
    expect(isClinicProcedureAllowed("notifications.list")).toBe(true);
    expect(isClinicProcedureAllowed("support.listMyTickets")).toBe(true);
    expect(isClinicProcedureAllowed("support.listAllTickets")).toBe(false);
    expect(isClinicProcedureAllowed("occupationalLifecycle.listWorkers")).toBe(
      false
    );
  });
});
