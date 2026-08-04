import { TRPCError } from "@trpc/server";
import { sql as drzSql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import { protectedProcedure, router } from "./trpc";

const ADMIN_ROLES = new Set(["admin", "company_admin", "admin_global", "super_admin", "rh"]);
const STATUS = z.enum(["ai_handling", "escalated", "open", "in_progress", "waiting_user", "resolved", "closed"]);

let supportReady = false;
async function ensureSupportTables() {
  if (supportReady) return;
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponivel." });
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS support_tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NULL,
    user_id INT NOT NULL,
    subject VARCHAR(255) NOT NULL,
    category VARCHAR(100) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'open',
    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    assigned_to_user_id INT NULL,
    last_message_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    escalated_at DATETIME NULL,
    resolved_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_support_company_status (company_id, status),
    INDEX idx_support_user (user_id, created_at),
    INDEX idx_support_assigned (assigned_to_user_id, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS support_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    sender_type VARCHAR(20) NOT NULL,
    sender_user_id INT NULL,
    sender_name VARCHAR(255) NULL,
    body TEXT NOT NULL,
    attachment_url TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_support_message_ticket (ticket_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  supportReady = true;
}

function rowsOf(result: any): any[] {
  return Array.isArray(result?.[0]) ? result[0] : Array.isArray(result) ? result : [];
}

function isAdmin(ctx: any) {
  return ADMIN_ROLES.has(String(ctx.user?.role || ""));
}

async function requireTicketAccess(ctx: any, ticketId: number) {
  await ensureSupportTables();
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const result: any = await db.execute(drzSql`SELECT * FROM support_tickets WHERE id=${ticketId} LIMIT 1`);
  const ticket = rowsOf(result)[0];
  if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "Chamado nao encontrado." });
  const sameCompany = Number(ticket.company_id || 0) === Number(ctx.user?.companyId || 0);
  if (Number(ticket.user_id) !== Number(ctx.user?.id) && !(isAdmin(ctx) && (sameCompany || ["admin_global", "super_admin"].includes(String(ctx.user?.role))))) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return { db, ticket };
}

export const supportRouter = router({
  listMyTickets: protectedProcedure.query(async ({ ctx }) => {
    await ensureSupportTables();
    const db = await getDb(); if (!db) return { tickets: [] };
    const result: any = await db.execute(drzSql`SELECT * FROM support_tickets WHERE user_id=${ctx.user.id} ORDER BY last_message_at DESC, id DESC`);
    return { tickets: rowsOf(result) };
  }),

  createTicket: protectedProcedure
    .input(z.object({ subject: z.string().min(3).max(255), category: z.string().max(100).optional(), firstMessage: z.string().min(1).max(20000) }))
    .mutation(async ({ ctx, input }) => {
      await ensureSupportTables();
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result: any = await db.execute(drzSql`INSERT INTO support_tickets
        (company_id, user_id, subject, category, status, last_message_at)
        VALUES (${(ctx.user as any).companyId ?? null}, ${ctx.user.id}, ${input.subject}, ${input.category ?? null}, 'open', NOW())`);
      const ticketId = Number(result?.[0]?.insertId ?? result?.insertId ?? 0);
      await db.execute(drzSql`INSERT INTO support_messages
        (ticket_id, sender_type, sender_user_id, sender_name, body)
        VALUES (${ticketId}, 'user', ${ctx.user.id}, ${(ctx.user as any).name ?? (ctx.user as any).email ?? "Usuario"}, ${input.firstMessage})`);
      return { ticketId };
    }),

  getTicket: protectedProcedure
    .input(z.object({ ticketId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const { db, ticket } = await requireTicketAccess(ctx, input.ticketId);
      const result: any = await db.execute(drzSql`SELECT * FROM support_messages WHERE ticket_id=${input.ticketId} ORDER BY created_at, id`);
      return { ticket, messages: rowsOf(result) };
    }),

  sendMessage: protectedProcedure
    .input(z.object({ ticketId: z.number().int().positive(), body: z.string().min(1).max(20000), attachmentBase64: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = await requireTicketAccess(ctx, input.ticketId);
      await db.execute(drzSql`INSERT INTO support_messages (ticket_id, sender_type, sender_user_id, sender_name, body)
        VALUES (${input.ticketId}, 'user', ${ctx.user.id}, ${(ctx.user as any).name ?? (ctx.user as any).email ?? "Usuario"}, ${input.body})`);
      await db.execute(drzSql`UPDATE support_tickets SET last_message_at=NOW(), status=IF(status IN ('resolved','closed'), 'open', status) WHERE id=${input.ticketId}`);
      return { ok: true };
    }),

  escalateToHuman: protectedProcedure
    .input(z.object({ ticketId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = await requireTicketAccess(ctx, input.ticketId);
      await db.execute(drzSql`UPDATE support_tickets SET status='escalated', escalated_at=NOW(), last_message_at=NOW() WHERE id=${input.ticketId}`);
      await db.execute(drzSql`INSERT INTO support_messages (ticket_id, sender_type, sender_name, body)
        VALUES (${input.ticketId}, 'system', 'Sistema', 'Chamado encaminhado para atendimento humano.')`);
      return { ok: true };
    }),

  listAllTickets: protectedProcedure
    .input(z.object({ status: z.string().optional(), companyId: z.number().int().optional() }).optional())
    .query(async ({ ctx, input }) => {
      if (!isAdmin(ctx)) throw new TRPCError({ code: "FORBIDDEN" });
      await ensureSupportTables();
      const db = await getDb(); if (!db) return { tickets: [] };
      const global = ["admin_global", "super_admin"].includes(String(ctx.user.role));
      const companyId = global ? input?.companyId : (ctx.user as any).companyId;
      const result: any = await db.execute(drzSql`
        SELECT t.*, u.name AS user_name, u.email AS user_email
        FROM support_tickets t LEFT JOIN users u ON u.id=t.user_id
        WHERE (${companyId ?? null} IS NULL OR t.company_id=${companyId ?? null})
          AND (${input?.status ?? null} IS NULL OR t.status=${input?.status ?? null})
        ORDER BY t.last_message_at DESC, t.id DESC`);
      return { tickets: rowsOf(result) };
    }),

  supportDashboard: protectedProcedure.query(async ({ ctx }) => {
    if (!isAdmin(ctx)) throw new TRPCError({ code: "FORBIDDEN" });
    await ensureSupportTables();
    const db = await getDb(); if (!db) return { open: 0, resolved: 0, avgResolutionHours: 0, byStatus: {} };
    const global = ["admin_global", "super_admin"].includes(String(ctx.user.role));
    const companyId = global ? null : (ctx.user as any).companyId;
    const result: any = await db.execute(drzSql`SELECT status, COUNT(*) AS total,
      AVG(CASE WHEN resolved_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, created_at, resolved_at) / 60 ELSE NULL END) AS avg_hours
      FROM support_tickets WHERE (${companyId ?? null} IS NULL OR company_id=${companyId ?? null}) GROUP BY status`);
    const rows = rowsOf(result);
    const byStatus = Object.fromEntries(rows.map((row) => [String(row.status), Number(row.total || 0)]));
    return {
      open: rows.filter((row) => !["resolved", "closed"].includes(String(row.status))).reduce((sum, row) => sum + Number(row.total || 0), 0),
      resolved: Number(byStatus.resolved || 0) + Number(byStatus.closed || 0),
      avgResolutionHours: rows.reduce((sum, row) => sum + Number(row.avg_hours || 0), 0) / Math.max(1, rows.filter((row) => row.avg_hours != null).length),
      byStatus,
    };
  }),

  agentReply: protectedProcedure
    .input(z.object({ ticketId: z.number().int().positive(), body: z.string().min(1).max(20000), attachmentBase64: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!isAdmin(ctx)) throw new TRPCError({ code: "FORBIDDEN" });
      const { db } = await requireTicketAccess(ctx, input.ticketId);
      await db.execute(drzSql`INSERT INTO support_messages (ticket_id, sender_type, sender_user_id, sender_name, body)
        VALUES (${input.ticketId}, 'agent', ${ctx.user.id}, ${(ctx.user as any).name ?? (ctx.user as any).email ?? "Analista"}, ${input.body})`);
      await db.execute(drzSql`UPDATE support_tickets SET status='waiting_user', last_message_at=NOW() WHERE id=${input.ticketId}`);
      return { ok: true };
    }),

  assignTicket: protectedProcedure
    .input(z.object({ ticketId: z.number().int().positive(), agentUserId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (!isAdmin(ctx)) throw new TRPCError({ code: "FORBIDDEN" });
      const { db } = await requireTicketAccess(ctx, input.ticketId);
      await db.execute(drzSql`UPDATE support_tickets SET assigned_to_user_id=${input.agentUserId}, status='in_progress' WHERE id=${input.ticketId}`);
      return { ok: true };
    }),

  updateTicketStatus: protectedProcedure
    .input(z.object({ ticketId: z.number().int().positive(), status: STATUS }))
    .mutation(async ({ ctx, input }) => {
      if (!isAdmin(ctx)) throw new TRPCError({ code: "FORBIDDEN" });
      const { db } = await requireTicketAccess(ctx, input.ticketId);
      const resolved = ["resolved", "closed"].includes(input.status);
      await db.execute(drzSql`UPDATE support_tickets SET status=${input.status}, resolved_at=${resolved ? new Date() : null}, last_message_at=NOW() WHERE id=${input.ticketId}`);
      return { ok: true };
    }),
});
