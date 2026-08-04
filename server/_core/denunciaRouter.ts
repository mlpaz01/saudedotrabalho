import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import { protectedProcedure, publicProcedure, router } from "./trpc";

const ADMIN_ROLES = ["admin", "company_admin", "admin_global", "super_admin", "rh", "sesmt"];
const GLOBAL_ROLES = ["admin_global", "super_admin"];
const reportStatus = z.enum(["received", "under_analysis", "investigating", "concluded_substantiated", "concluded_unsubstantiated", "archived"]);

function rowsOf(result: any): any[] { return Array.isArray(result?.[0]) ? result[0] : []; }
function assertAdmin(ctx: any) {
  if (!ADMIN_ROLES.includes(String(ctx.user?.role || ""))) throw new TRPCError({ code: "FORBIDDEN" });
}
function allowedCompany(ctx: any, requested?: number) {
  const global = GLOBAL_ROLES.includes(String(ctx.user?.role || ""));
  if (global) return requested || null;
  const own = Number(ctx.user?.companyId || 0);
  if (!own || (requested && requested !== own)) throw new TRPCError({ code: "FORBIDDEN" });
  return own;
}

function assertReportCompany(ctx: any, reportCompanyId: unknown) {
  if (GLOBAL_ROLES.includes(String(ctx.user?.role || ""))) return;
  const own = Number(ctx.user?.companyId || 0);
  if (!own || !reportCompanyId || Number(reportCompanyId) !== own) throw new TRPCError({ code: "FORBIDDEN" });
}

let ready = false;
async function ensureTables() {
  if (ready) return;
  const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  await db.execute(sql`CREATE TABLE IF NOT EXISTS canal_denuncias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NULL,
    protocol_code VARCHAR(20) NOT NULL UNIQUE,
    category VARCHAR(80) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    frequency VARCHAR(30) NOT NULL,
    perceived_risk VARCHAR(20) NOT NULL,
    is_anonymous TINYINT(1) NOT NULL DEFAULT 1,
    reporter_email VARCHAR(255), reporter_phone VARCHAR(50),
    incident_date DATE, incident_location VARCHAR(255),
    accused_role VARCHAR(150), accused_department VARCHAR(150),
    description TEXT NOT NULL, witnesses TEXT,
    lgpd_consent TINYINT(1) NOT NULL DEFAULT 0,
    status VARCHAR(40) NOT NULL DEFAULT 'received',
    internal_notes TEXT, response_to_reporter TEXT,
    sla_due_date DATE, retention_until DATE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    closed_at DATETIME NULL,
    INDEX idx_denuncia_company_status (company_id, status),
    INDEX idx_denuncia_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const additions = [
    "ADD COLUMN company_id INT NULL", "ADD COLUMN accused_role VARCHAR(150) NULL", "ADD COLUMN accused_department VARCHAR(150) NULL",
    "ADD COLUMN internal_notes TEXT NULL", "ADD COLUMN response_to_reporter TEXT NULL", "ADD COLUMN sla_due_date DATE NULL",
    "ADD COLUMN retention_until DATE NULL", "ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
    "ADD COLUMN closed_at DATETIME NULL",
  ];
  for (const addition of additions) { try { await db.execute(sql.raw(`ALTER TABLE canal_denuncias ${addition}`)); } catch {} }
  await db.execute(sql`CREATE TABLE IF NOT EXISTS denuncia_routing (
    company_id INT PRIMARY KEY,
    route_to_roles JSON,
    route_to_user_ids JSON,
    notify_email VARCHAR(320),
    updated_by_user_id INT,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS denuncia_audit (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_id INT NOT NULL,
    action VARCHAR(80) NOT NULL,
    details TEXT,
    performed_by_user_id INT,
    performed_by_role VARCHAR(50),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_denuncia_audit_report (report_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  ready = true;
}

export const denunciaRouter = router({
  submitReport: publicProcedure
    .input(z.object({
      companyId: z.number().int().positive().optional(),
      category: z.string().min(1).max(80), severity: z.enum(["baixa", "media", "alta", "critica"]),
      frequency: z.string().min(1).max(30), perceivedRisk: z.string().min(1).max(20),
      isAnonymous: z.boolean(), reporterEmail: z.string().email().optional().or(z.literal("")), reporterPhone: z.string().max(50).optional(),
      incidentDate: z.string().max(20).optional(), incidentLocation: z.string().max(255).optional(),
      accusedRole: z.string().max(150).optional(), accusedDepartment: z.string().max(150).optional(),
      description: z.string().min(10).max(20000), witnesses: z.string().max(5000).optional(), lgpdConsent: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      await ensureTables(); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const code = "SDT-" + Date.now().toString(36).toUpperCase().slice(-6) + Math.random().toString(36).substring(2, 5).toUpperCase();
      const companyId = input.companyId ?? (Number((ctx.user as any)?.companyId || 0) || null);
      await db.execute(sql`INSERT INTO canal_denuncias
        (company_id,protocol_code,category,severity,frequency,perceived_risk,is_anonymous,reporter_email,reporter_phone,incident_date,incident_location,accused_role,accused_department,description,witnesses,lgpd_consent,status,sla_due_date,retention_until)
        VALUES (${companyId},${code},${input.category},${input.severity},${input.frequency},${input.perceivedRisk},${input.isAnonymous ? 1 : 0},${input.reporterEmail || null},${input.reporterPhone || null},${input.incidentDate || null},${input.incidentLocation || null},${input.accusedRole || null},${input.accusedDepartment || null},${input.description},${input.witnesses || null},${input.lgpdConsent ? 1 : 0},'received',DATE_ADD(CURDATE(), INTERVAL 7 DAY),DATE_ADD(CURDATE(), INTERVAL 5 YEAR))`);
      return { protocolCode: code };
    }),

  trackByProtocol: publicProcedure.input(z.object({ protocolCode: z.string().min(1).max(30) })).query(async ({ input }) => {
    await ensureTables(); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const row = rowsOf(await db.execute(sql`SELECT protocol_code,category,severity,status,created_at,updated_at,response_to_reporter FROM canal_denuncias WHERE protocol_code=${input.protocolCode.trim().toUpperCase()} LIMIT 1`))[0];
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Protocolo nao encontrado." });
    return { protocolCode: String(row.protocol_code), category: String(row.category), severity: String(row.severity), status: String(row.status), createdAt: String(row.created_at), updatedAt: String(row.updated_at), responseToReporter: row.response_to_reporter ? String(row.response_to_reporter) : null };
  }),

  getRouting: protectedProcedure.input(z.object({ companyId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    assertAdmin(ctx); allowedCompany(ctx, input.companyId); await ensureTables();
    const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const row = rowsOf(await db.execute(sql`SELECT * FROM denuncia_routing WHERE company_id=${input.companyId} LIMIT 1`))[0];
    const parse = (value: any, fallback: any[]) => { try { return typeof value === "string" ? JSON.parse(value) : value || fallback; } catch { return fallback; } };
    return { routeToRoles: parse(row?.route_to_roles, ["rh", "sesmt"]), routeToUserIds: parse(row?.route_to_user_ids, []), notifyEmail: row?.notify_email || "" };
  }),

  saveRouting: protectedProcedure.input(z.object({ companyId: z.number().int().positive(), routeToRoles: z.array(z.string().max(50)), routeToUserIds: z.array(z.number().int()), notifyEmail: z.string().email().nullable() })).mutation(async ({ ctx, input }) => {
    assertAdmin(ctx); allowedCompany(ctx, input.companyId); await ensureTables();
    const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.execute(sql`INSERT INTO denuncia_routing (company_id,route_to_roles,route_to_user_ids,notify_email,updated_by_user_id)
      VALUES (${input.companyId},${JSON.stringify(input.routeToRoles)},${JSON.stringify(input.routeToUserIds)},${input.notifyEmail},${ctx.user.id})
      ON DUPLICATE KEY UPDATE route_to_roles=VALUES(route_to_roles),route_to_user_ids=VALUES(route_to_user_ids),notify_email=VALUES(notify_email),updated_by_user_id=VALUES(updated_by_user_id)`);
    return { ok: true };
  }),

  listReports: protectedProcedure.input(z.object({ companyId: z.number().int().positive().optional(), status: z.string().max(40).optional(), category: z.string().max(80).optional() })).query(async ({ ctx, input }) => {
    assertAdmin(ctx); const companyId = allowedCompany(ctx, input.companyId); await ensureTables();
    const db = await getDb(); if (!db) return [];
    return rowsOf(await db.execute(sql`SELECT * FROM canal_denuncias
      WHERE (${companyId} IS NULL OR company_id=${companyId}) AND (${input.status ?? null} IS NULL OR status=${input.status ?? null}) AND (${input.category ?? null} IS NULL OR category=${input.category ?? null})
      ORDER BY created_at DESC,id DESC LIMIT 1000`));
  }),

  getReport: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
    assertAdmin(ctx); await ensureTables(); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const row = rowsOf(await db.execute(sql`SELECT * FROM canal_denuncias WHERE id=${input.id} LIMIT 1`))[0];
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    assertReportCompany(ctx, row.company_id);
    return row;
  }),

  getAuditLog: protectedProcedure.input(z.object({ reportId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    assertAdmin(ctx); await ensureTables(); const db = await getDb(); if (!db) return [];
    const report = rowsOf(await db.execute(sql`SELECT company_id FROM canal_denuncias WHERE id=${input.reportId} LIMIT 1`))[0];
    if (!report) throw new TRPCError({ code: "NOT_FOUND" }); assertReportCompany(ctx, report.company_id);
    return rowsOf(await db.execute(sql`SELECT * FROM denuncia_audit WHERE report_id=${input.reportId} ORDER BY created_at DESC,id DESC`));
  }),

  updateReportStatus: protectedProcedure.input(z.object({ id: z.number().int().positive(), status: reportStatus, internal_notes: z.string().max(20000).optional(), response_to_reporter: z.string().max(20000).optional() })).mutation(async ({ ctx, input }) => {
    assertAdmin(ctx); await ensureTables(); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const report = rowsOf(await db.execute(sql`SELECT company_id,status FROM canal_denuncias WHERE id=${input.id} LIMIT 1`))[0];
    if (!report) throw new TRPCError({ code: "NOT_FOUND" }); assertReportCompany(ctx, report.company_id);
    const concluded = input.status.startsWith("concluded_") || input.status === "archived";
    await db.execute(sql`UPDATE canal_denuncias SET status=${input.status},internal_notes=${input.internal_notes ?? null},response_to_reporter=${input.response_to_reporter ?? null},closed_at=${concluded ? new Date() : null} WHERE id=${input.id}`);
    await db.execute(sql`INSERT INTO denuncia_audit (report_id,action,details,performed_by_user_id,performed_by_role) VALUES (${input.id},'status_updated',${`Status alterado de ${report.status} para ${input.status}.`},${ctx.user.id},${String(ctx.user.role)})`);
    return { ok: true };
  }),

  dashboardStats: protectedProcedure.input(z.object({ companyId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
    assertAdmin(ctx); const companyId = allowedCompany(ctx, input.companyId); await ensureTables(); const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const filter = companyId ? `company_id=${companyId}` : "1=1";
    const summary = rowsOf(await db.execute(sql.raw(`SELECT COUNT(*) total,SUM(status IN ('received','under_analysis','investigating')) open,SUM(status IN ('concluded_substantiated','concluded_unsubstantiated','archived')) concluded,AVG(CASE WHEN closed_at IS NOT NULL THEN TIMESTAMPDIFF(HOUR,created_at,closed_at)/24 END) avgResolutionDays FROM canal_denuncias WHERE ${filter}`)))[0] || {};
    const group = async (select: string, groupBy: string) => rowsOf(await db.execute(sql.raw(`SELECT ${select},COUNT(*) total FROM canal_denuncias WHERE ${filter} GROUP BY ${groupBy} ORDER BY total DESC`)));
    return {
      total: Number(summary.total || 0), open: Number(summary.open || 0), concluded: Number(summary.concluded || 0), avgResolutionDays: Number(summary.avgResolutionDays || 0),
      byPeriod: await group("DATE_FORMAT(created_at,'%Y-%m') period", "DATE_FORMAT(created_at,'%Y-%m')"),
      byCategory: await group("category", "category"), bySector: await group("COALESCE(accused_department,'Nao informado') sector", "COALESCE(accused_department,'Nao informado')"), byStatus: await group("status", "status"),
    };
  }),
});
