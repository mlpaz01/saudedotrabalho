import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import { protectedProcedure, router } from "./trpc";

const asoRow = z.object({
  matricula: z.string().min(1).max(120),
  tipo_exame: z.string().max(100).optional(),
  data_realizacao: z.string().min(1).max(20),
  resultado: z.string().max(100).optional(),
  validade: z.string().max(20).optional(),
  medico: z.string().max(255).optional(),
  crm: z.string().max(80).optional(),
  notas: z.string().max(5000).optional(),
});

const absenceRow = z.object({
  matricula: z.string().min(1).max(120),
  data_inicio: z.string().min(1).max(20),
  data_fim: z.string().max(20).optional(),
  motivo: z.string().max(255).optional(),
  cid: z.string().max(30).optional(),
  atestado_url: z.string().max(1500).optional(),
});

function requireCompany(ctx: any): number {
  const companyId = Number(ctx.user?.companyId || 0);
  if (!companyId) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione uma empresa antes da importacao." });
  if (!["admin", "company_admin", "admin_global", "super_admin", "rh", "sesmt"].includes(String(ctx.user?.role || ""))) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return companyId;
}

let ready = false;
async function ensureTables() {
  if (ready) return;
  const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  try { await db.execute(sql`ALTER TABLE users ADD COLUMN employee_registration VARCHAR(120) NULL`); } catch {}
  try { await db.execute(sql`CREATE INDEX idx_users_company_registration ON users(company_id, employee_registration)`); } catch {}
  await db.execute(sql`CREATE TABLE IF NOT EXISTS ehs_asos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    user_id INT NOT NULL,
    employee_registration VARCHAR(120) NOT NULL,
    exam_type VARCHAR(100),
    performed_at DATE NOT NULL,
    result VARCHAR(100),
    valid_until DATE,
    physician VARCHAR(255),
    crm VARCHAR(80),
    notes TEXT,
    imported_by_user_id INT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_ehs_aso (company_id, user_id, performed_at, exam_type),
    INDEX idx_ehs_aso_company_date (company_id, performed_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS ehs_absences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    user_id INT NOT NULL,
    employee_registration VARCHAR(120) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    reason VARCHAR(255),
    cid VARCHAR(30),
    certificate_url TEXT,
    imported_by_user_id INT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_ehs_absence (company_id, user_id, start_date, reason),
    INDEX idx_ehs_absence_company_date (company_id, start_date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  ready = true;
}

function validDate(value?: string) {
  if (!value) return null;
  const normalized = value.trim().replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, "$3-$2-$1");
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

async function resolveUser(db: any, companyId: number, identifier: string) {
  const raw = identifier.trim();
  const digits = raw.replace(/\D/g, "");
  const result: any = await db.execute(sql`
    SELECT id FROM users
    WHERE company_id=${companyId} AND (
      employee_registration=${raw}
      OR CAST(id AS CHAR)=${raw}
      OR email=${raw}
      OR REPLACE(REPLACE(REPLACE(cpf,'.',''),'-',''),' ','')=${digits}
    ) LIMIT 1`);
  return Array.isArray(result?.[0]) ? result[0][0] : undefined;
}

export const ehsRouter = router({
  importAsos: protectedProcedure
    .input(z.object({ rows: z.array(asoRow).min(1).max(5000), dryRun: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const companyId = requireCompany(ctx); await ensureTables();
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let inserted = 0, skipped = 0;
      const errors: Array<{ row: number; message: string }> = [];
      for (let index = 0; index < input.rows.length; index++) {
        const row = input.rows[index];
        const performedAt = validDate(row.data_realizacao);
        const user = await resolveUser(db, companyId, row.matricula);
        if (!user || !performedAt) { skipped++; errors.push({ row: index + 2, message: !user ? "Colaborador nao localizado pela matricula/CPF/e-mail." : "Data de realizacao invalida." }); continue; }
        if (!input.dryRun) {
          await db.execute(sql`INSERT INTO ehs_asos
            (company_id,user_id,employee_registration,exam_type,performed_at,result,valid_until,physician,crm,notes,imported_by_user_id)
            VALUES (${companyId},${Number(user.id)},${row.matricula},${row.tipo_exame || "periodico"},${performedAt},${row.resultado || null},${validDate(row.validade)},${row.medico || null},${row.crm || null},${row.notas || null},${ctx.user.id})
            ON DUPLICATE KEY UPDATE result=VALUES(result), valid_until=VALUES(valid_until), physician=VALUES(physician), crm=VALUES(crm), notes=VALUES(notes)`);
        }
        inserted++;
      }
      return { summary: { inserted, skipped, total: input.rows.length }, errors };
    }),

  importAbsences: protectedProcedure
    .input(z.object({ rows: z.array(absenceRow).min(1).max(5000), dryRun: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const companyId = requireCompany(ctx); await ensureTables();
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let inserted = 0, skipped = 0;
      const errors: Array<{ row: number; message: string }> = [];
      for (let index = 0; index < input.rows.length; index++) {
        const row = input.rows[index];
        const startDate = validDate(row.data_inicio);
        const user = await resolveUser(db, companyId, row.matricula);
        if (!user || !startDate) { skipped++; errors.push({ row: index + 2, message: !user ? "Colaborador nao localizado pela matricula/CPF/e-mail." : "Data inicial invalida." }); continue; }
        if (!input.dryRun) {
          await db.execute(sql`INSERT INTO ehs_absences
            (company_id,user_id,employee_registration,start_date,end_date,reason,cid,certificate_url,imported_by_user_id)
            VALUES (${companyId},${Number(user.id)},${row.matricula},${startDate},${validDate(row.data_fim)},${row.motivo || null},${row.cid || null},${row.atestado_url || null},${ctx.user.id})
            ON DUPLICATE KEY UPDATE end_date=VALUES(end_date), cid=VALUES(cid), certificate_url=VALUES(certificate_url)`);
        }
        inserted++;
      }
      return { summary: { inserted, skipped, total: input.rows.length }, errors };
    }),
});
