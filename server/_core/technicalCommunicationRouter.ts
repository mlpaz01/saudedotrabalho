import { TRPCError } from "@trpc/server";
import { sql as drzSql } from "drizzle-orm";
import { z } from "zod";
import { getDb, logAudit } from "../db";
import { protectedProcedure, router } from "./trpc";
import { ensurePgrVersioningTables } from "./pgrVersioning";
import {
  ensureTechnicalChangeEventTables,
  TECHNICAL_EVENT_STATUSES,
} from "./technicalChangeEvents";

function rowsOf(result: any): any[] {
  return Array.isArray(result?.[0]) ? result[0] : Array.isArray(result) ? result : [];
}

function requireTechnicalAccess(ctx: any) {
  const allowed = new Set(["sesmt", "medico", "admin", "rh", "company_admin", "admin_global", "super_admin"]);
  if (!ctx.user || !allowed.has(String(ctx.user.role || ""))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado aos perfis técnicos autorizados." });
  }
  const isGlobal = ["admin_global", "super_admin"].includes(String(ctx.user.role || ""));
  const companyId = Number(ctx.user.companyId || 0);
  if (!companyId && !isGlobal) throw new TRPCError({ code: "BAD_REQUEST", message: "Empresa não definida." });
  return { companyId, isGlobal };
}

function requireSesmt(ctx: any) {
  const allowed = new Set(["sesmt", "admin", "rh", "company_admin", "admin_global", "super_admin"]);
  if (!ctx.user || !allowed.has(String(ctx.user.role || ""))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado ao SESMT e administradores autorizados." });
  }
  const isGlobal = ["admin_global", "super_admin"].includes(String(ctx.user.role || ""));
  const companyId = Number(ctx.user.companyId || 0);
  if (!companyId && !isGlobal) throw new TRPCError({ code: "BAD_REQUEST", message: "Empresa não definida." });
  return { companyId, isGlobal };
}

function parseJson(value: unknown) {
  try { return JSON.parse(String(value || "{}")); } catch { return {}; }
}

function eventTargetForRole(role: string) {
  return role === "medico" ? "medico" : role === "sesmt" ? "sesmt" : null;
}

export const technicalCommunicationRouter = router({
  feed: protectedProcedure.query(async ({ ctx }) => {
    const access = requireTechnicalAccess(ctx);
    const db = await getDb();
    if (!db) return { events: [], newCount: 0, pendingCount: 0, counts: {} };
    await ensureTechnicalChangeEventTables(db);
    const roleTarget = eventTargetForRole(String(ctx.user.role || ""));
    const result: any = await db.execute(drzSql`SELECT e.*,
        actor.name created_by_name,actor.email created_by_email,company.name company_name,company.cnpj company_cnpj
      FROM technical_change_events e
      JOIN companies company ON company.id=e.company_id
      LEFT JOIN users actor ON actor.id=e.created_by
      WHERE 1=1
        ${access.companyId ? drzSql`AND e.company_id=${access.companyId}` : drzSql``}
        ${roleTarget ? drzSql`AND e.target_role=${roleTarget}` : drzSql``}
      ORDER BY FIELD(e.status,'nova','requer_analise','em_analise','visualizada','ajuste_realizado','concluida'),e.created_at DESC,e.id DESC
      LIMIT 500`);
    const events = rowsOf(result).map(row => ({
      ...row,
      before: parseJson(row.before_json),
      after: parseJson(row.after_json),
      changes: parseJson(row.changes_json),
      context: parseJson(row.context_json),
    }));
    const counts = events.reduce((acc: Record<string, number>, event: any) => {
      acc[event.status] = (acc[event.status] || 0) + 1;
      return acc;
    }, {});
    return {
      events,
      counts,
      newCount: counts.nova || 0,
      pendingCount: events.filter((event: any) => !["ajuste_realizado", "concluida"].includes(event.status)).length,
    };
  }),

  updateEventStatus: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      status: z.enum(TECHNICAL_EVENT_STATUSES),
      notes: z.string().trim().max(4000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const access = requireTechnicalAccess(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await ensureTechnicalChangeEventTables(db);
      const roleTarget = eventTargetForRole(String(ctx.user.role || ""));
      const result: any = await db.execute(drzSql`UPDATE technical_change_events SET
        status=${input.status},
        viewed_at=CASE WHEN ${input.status} IN ('visualizada','requer_analise','em_analise','ajuste_realizado','concluida') THEN COALESCE(viewed_at,NOW()) ELSE viewed_at END,
        viewed_by=CASE WHEN ${input.status} IN ('visualizada','requer_analise','em_analise','ajuste_realizado','concluida') THEN COALESCE(viewed_by,${Number(ctx.user.id)}) ELSE viewed_by END,
        analysis_started_at=CASE WHEN ${input.status} IN ('em_analise','ajuste_realizado','concluida') THEN COALESCE(analysis_started_at,NOW()) ELSE analysis_started_at END,
        analysis_started_by=CASE WHEN ${input.status} IN ('em_analise','ajuste_realizado','concluida') THEN COALESCE(analysis_started_by,${Number(ctx.user.id)}) ELSE analysis_started_by END,
        resolved_at=CASE WHEN ${input.status} IN ('ajuste_realizado','concluida') THEN NOW() ELSE NULL END,
        resolved_by=CASE WHEN ${input.status} IN ('ajuste_realizado','concluida') THEN ${Number(ctx.user.id)} ELSE NULL END,
        resolution_notes=COALESCE(${input.notes || null},resolution_notes)
        WHERE id=${input.id}
          ${access.companyId ? drzSql`AND company_id=${access.companyId}` : drzSql``}
          ${roleTarget ? drzSql`AND target_role=${roleTarget}` : drzSql``}`);
      if (!Number((result as any)[0]?.affectedRows || 0)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Atualização não encontrada ou não destinada ao seu perfil." });
      }
      await logAudit({
        userId: Number(ctx.user.id),userEmail: ctx.user.email || null,action: "technical_change_status_updated",
        entityType: "technical_change_event",entityId: input.id,detailsJson: { status: input.status, notes: input.notes || null },
      });
      return { ok: true };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const access = requireTechnicalAccess(ctx);
    const db = await getDb();
    if (!db) return [];
    await ensurePgrVersioningTables(db);
    const result: any = await db.execute(drzSql`SELECT a.*,
        pc.title pcmso_title,pc.revision_number pcmso_revision_number,
        resultpc.title result_pcmso_title,resultpc.revision_number result_pcmso_revision_number,
        oldp.title previous_pgr_title,oldp.revision_number previous_pgr_revision,
        newp.title new_pgr_title,newp.revision_number new_pgr_revision,newp.revision_reason,
        sender.name sender_name,doctor.name medical_completed_by_name,ack.name sesmt_acknowledged_by_name,
        company.name company_name,company.cnpj company_cnpj
      FROM pcmso_pgr_revision_alerts a
      JOIN companies company ON company.id=a.company_id
      JOIN pcmso_programs_v2 pc ON pc.id=a.pcmso_id AND pc.company_id=a.company_id
      LEFT JOIN pcmso_programs_v2 resultpc ON resultpc.id=a.result_pcmso_id AND resultpc.company_id=a.company_id
      JOIN pgr_documents oldp ON oldp.id=a.previous_pgr_id
      JOIN pgr_documents newp ON newp.id=a.new_pgr_id
      LEFT JOIN users sender ON sender.id=a.sent_for_medical_by
      LEFT JOIN users doctor ON doctor.id=a.medical_completed_by
      LEFT JOIN users ack ON ack.id=a.sesmt_acknowledged_by
      ${access.companyId ? drzSql`WHERE a.company_id=${access.companyId}` : drzSql``}
      ORDER BY FIELD(a.status,'aguardando_sesmt','aguardando_medico','em_analise_medica','pendente','concluido','sem_alteracao'),a.updated_at DESC,a.id DESC`);
    return rowsOf(result).map(row => ({
      ...row,
      changes: parseJson(row.changes_json),
      medicalResponse: parseJson(row.medical_response_json),
    }));
  }),

  acknowledge: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), notes: z.string().trim().max(2000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const access = requireSesmt(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await ensurePgrVersioningTables(db);
      const result: any = await db.execute(drzSql`UPDATE pcmso_pgr_revision_alerts
        SET status='concluido',sesmt_acknowledged_at=NOW(),sesmt_acknowledged_by=${Number(ctx.user.id)},
            notes=COALESCE(${input.notes || null},notes)
        WHERE id=${input.id} ${access.companyId ? drzSql`AND company_id=${access.companyId}` : drzSql``}
          AND status IN ('aguardando_sesmt','sem_alteracao')`);
      if (!Number((result as any)[0]?.affectedRows || 0)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A atualização ainda não está pronta para conclusão pelo SESMT." });
      }
      await logAudit({
        userId: Number(ctx.user.id),userEmail: ctx.user.email || null,action: "technical_update_sesmt_acknowledged",
        entityType: "pcmso_pgr_revision_alert",entityId: input.id,detailsJson: { notes: input.notes || null },
      });
      return { ok: true };
    }),
});
