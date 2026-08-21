import { TRPCError } from "@trpc/server";
import { sql as drzSql } from "drizzle-orm";
import { z } from "zod";
import { getDb, logAudit } from "../db";
import { protectedProcedure, router } from "./trpc";
import { ensurePgrVersioningTables } from "./pgrVersioning";

function rowsOf(result: any): any[] {
  return Array.isArray(result?.[0]) ? result[0] : Array.isArray(result) ? result : [];
}

function requireSesmt(ctx: any) {
  const allowed = new Set(["sesmt", "admin", "rh", "company_admin", "admin_global", "super_admin"]);
  if (!ctx.user || !allowed.has(String(ctx.user.role || ""))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado ao SESMT e administradores autorizados." });
  }
  const companyId = Number(ctx.user.companyId || 0);
  if (!companyId) throw new TRPCError({ code: "BAD_REQUEST", message: "Empresa não definida." });
  return companyId;
}

function parseJson(value: unknown) {
  try { return JSON.parse(String(value || "{}")); } catch { return {}; }
}

export const technicalCommunicationRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const companyId = requireSesmt(ctx);
    const db = await getDb();
    if (!db) return [];
    await ensurePgrVersioningTables(db);
    const result: any = await db.execute(drzSql`SELECT a.*,
        pc.title pcmso_title,pc.revision_number pcmso_revision_number,
        resultpc.title result_pcmso_title,resultpc.revision_number result_pcmso_revision_number,
        oldp.title previous_pgr_title,oldp.revision_number previous_pgr_revision,
        newp.title new_pgr_title,newp.revision_number new_pgr_revision,newp.revision_reason,
        sender.name sender_name,doctor.name medical_completed_by_name,ack.name sesmt_acknowledged_by_name
      FROM pcmso_pgr_revision_alerts a
      JOIN pcmso_programs_v2 pc ON pc.id=a.pcmso_id AND pc.company_id=a.company_id
      LEFT JOIN pcmso_programs_v2 resultpc ON resultpc.id=a.result_pcmso_id AND resultpc.company_id=a.company_id
      JOIN pgr_documents oldp ON oldp.id=a.previous_pgr_id
      JOIN pgr_documents newp ON newp.id=a.new_pgr_id
      LEFT JOIN users sender ON sender.id=a.sent_for_medical_by
      LEFT JOIN users doctor ON doctor.id=a.medical_completed_by
      LEFT JOIN users ack ON ack.id=a.sesmt_acknowledged_by
      WHERE a.company_id=${companyId}
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
      const companyId = requireSesmt(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await ensurePgrVersioningTables(db);
      const result: any = await db.execute(drzSql`UPDATE pcmso_pgr_revision_alerts
        SET status='concluido',sesmt_acknowledged_at=NOW(),sesmt_acknowledged_by=${Number(ctx.user.id)},
            notes=COALESCE(${input.notes || null},notes)
        WHERE id=${input.id} AND company_id=${companyId} AND status IN ('aguardando_sesmt','sem_alteracao')`);
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
