export const clinicOrderStatuses = [
  "recebida",
  "agendamento_pendente",
  "agendada",
  "atendimento_realizado",
  "resultado_pendente",
  "resultado_enviado",
  "concluida",
] as const;

export type ClinicOrderStatus = (typeof clinicOrderStatuses)[number];

const clinicProcedureAllowlist = new Set([
  "auth.me",
  "auth.logout",
  "notifications.unreadCount",
  "notifications.refresh",
  "notifications.list",
  "notifications.markRead",
  "notifications.markAllRead",
  "plans.myEntitlements",
  "knowledge.search",
  "knowledge.get",
  "knowledge.ask",
  "support.listMyTickets",
  "support.createTicket",
  "support.getTicket",
  "support.sendMessage",
  "support.escalateToHuman",
]);

export function isClinicProcedureAllowed(path: string) {
  return path.startsWith("clinicPortal.") || clinicProcedureAllowlist.has(path);
}

const statusTransitions: Record<ClinicOrderStatus, ClinicOrderStatus[]> = {
  recebida: ["agendamento_pendente", "agendada", "atendimento_realizado"],
  agendamento_pendente: ["agendada", "atendimento_realizado"],
  agendada: ["agendamento_pendente", "atendimento_realizado"],
  atendimento_realizado: ["resultado_pendente", "resultado_enviado"],
  resultado_pendente: ["resultado_enviado"],
  resultado_enviado: ["concluida", "resultado_pendente"],
  concluida: [],
};

export function canTransitionClinicOrder(
  current: ClinicOrderStatus,
  next: ClinicOrderStatus
) {
  return current === next || statusTransitions[current].includes(next);
}

export function summarizeClinicBilling(
  rows: Array<{
    amount?: number | string | null;
    proof_private_path?: string | null;
  }>
) {
  return rows.reduce(
    (summary, row) => {
      summary.attendances += 1;
      summary.total += Number(row.amount || 0);
      if (row.proof_private_path) summary.withProof += 1;
      else summary.missingProof += 1;
      return summary;
    },
    { attendances: 0, total: 0, withProof: 0, missingProof: 0 }
  );
}
