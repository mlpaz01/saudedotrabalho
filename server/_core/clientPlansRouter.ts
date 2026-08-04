import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import { activeEmployeeSql, ensureActiveEmployeeColumns } from "./activeEmployees";
import { protectedProcedure, router } from "./trpc";

const PLANS = [
  { code: "nr01_inteligente", label: "NR-01 Inteligente", description: "Gestao psicossocial, treinamentos e conformidade NR-01.", monthly_price: 2900, order_index: 1, max_employees: 100 },
  { code: "saude_integral", label: "Saude Integral", description: "NR-01 com vertentes de saude e prevencao integradas.", monthly_price: 6900, order_index: 2, max_employees: 500 },
  { code: "corporate", label: "Corporate", description: "Ecossistema completo, governanca e recursos avancados.", monthly_price: 14000, order_index: 3, max_employees: 2000 },
] as const;

const VERTENTES = [
  { code: "mental", name: "Saude Mental", description: "Acolhimento, agenda e indicadores psicossociais.", color: "#0f766e", monthly_price: 900 },
  { code: "sst", name: "SST e PGR", description: "PGR, GSE, EPI/EPC e conformidade ocupacional.", color: "#0369a1", monthly_price: 1200 },
  { code: "educacao", name: "Educacao Corporativa", description: "Cursos, trilhas, certificados e campanhas.", color: "#7c3aed", monthly_price: 700 },
] as const;

const ADDONS = [
  { code: "ai_100k", name: "100 mil creditos de IA", description: "Franquia mensal adicional para os estudios.", package: "ia", monthly_price: 499, quantifiable: 1 },
  { code: "storage_10gb", name: "10 GB adicionais", description: "Armazenamento adicional para documentos e evidencias.", package: "capacidade", monthly_price: 99, quantifiable: 1 },
  { code: "analytics_plus", name: "Analytics+", description: "Indicadores executivos e exportacoes avancadas.", package: "analytics", monthly_price: 690, quantifiable: 0 },
  { code: "acolhimento", name: "Acolhimento online", description: "Pacote de atendimento psicologico online.", package: "saude_mental", monthly_price: 990, quantifiable: 1 },
] as const;

function assertGlobal(ctx: any) {
  if (!["admin_global", "super_admin"].includes(String(ctx.user?.role || ""))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso exclusivo do SuperAdmin." });
  }
}

function rowsOf(result: any): any[] {
  return Array.isArray(result?.[0]) ? result[0] : [];
}

let ready = false;
async function ensureTables() {
  if (ready) return;
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponivel." });
  await ensureActiveEmployeeColumns(db);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS client_plan_vertentes (
    company_id INT NOT NULL,
    vertente_code VARCHAR(60) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (company_id, vertente_code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS client_plan_addons (
    company_id INT NOT NULL,
    addon_code VARCHAR(80) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (company_id, addon_code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS client_plan_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    action VARCHAR(40) NOT NULL,
    old_plan_code VARCHAR(60),
    new_plan_code VARCHAR(60),
    monthly_total_before DECIMAL(12,2) NOT NULL DEFAULT 0,
    monthly_total_after DECIMAL(12,2) NOT NULL DEFAULT 0,
    reason TEXT,
    changed_by_user_id INT,
    user_email VARCHAR(320),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_client_plan_history (company_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  ready = true;
}

function planByCode(code: string | null | undefined) {
  return PLANS.find((item) => item.code === code) ?? PLANS[0];
}

function calculateTotal(planCode: string, vertentes: string[], addons: Array<{ code: string; quantity: number }>) {
  const plan = planByCode(planCode);
  const vertentesTotal = vertentes.reduce((total, code) => total + Number(VERTENTES.find((item) => item.code === code)?.monthly_price || 0), 0);
  const addonsTotal = addons.reduce((total, item) => total + Number(ADDONS.find((addon) => addon.code === item.code)?.monthly_price || 0) * Math.max(1, item.quantity), 0);
  return { planPrice: plan.monthly_price, vertentesTotal, addonsTotal, totalMonthly: plan.monthly_price + vertentesTotal + addonsTotal };
}

export const clientPlansRouter = router({
  listAvailablePlans: protectedProcedure.query(({ ctx }) => { assertGlobal(ctx); return PLANS; }),
  listAvailableVertentes: protectedProcedure.query(({ ctx }) => { assertGlobal(ctx); return VERTENTES; }),
  listAvailableAddons: protectedProcedure.query(({ ctx }) => { assertGlobal(ctx); return ADDONS; }),

  listClients: protectedProcedure.query(async ({ ctx }) => {
    assertGlobal(ctx);
    await ensureTables();
    const db = await getDb(); if (!db) return [];
    const result: any = await db.execute(sql.raw(`
      SELECT c.id, c.name, c.cnpj, c.plan, c.subscription_status,
        (SELECT COUNT(*) FROM users u WHERE u.company_id=c.id AND ${activeEmployeeSql("u")}) AS active_users,
        (SELECT GROUP_CONCAT(v.vertente_code ORDER BY v.vertente_code SEPARATOR ',') FROM client_plan_vertentes v WHERE v.company_id=c.id) AS vertentes
      FROM companies c WHERE c.is_active=1 ORDER BY c.name`));
    return rowsOf(result);
  }),

  getClientSubscription: protectedProcedure
    .input(z.object({ companyId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      assertGlobal(ctx); await ensureTables();
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const companyResult: any = await db.execute(sql.raw(`SELECT c.*,
        (SELECT COUNT(*) FROM users u WHERE u.company_id=c.id AND ${activeEmployeeSql("u")}) AS active_users
        FROM companies c WHERE c.id=${Number(input.companyId)} LIMIT 1`));
      const company = rowsOf(companyResult)[0];
      if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa nao encontrada." });
      const vertentes = rowsOf(await db.execute(sql`SELECT * FROM client_plan_vertentes WHERE company_id=${input.companyId}`));
      const addons = rowsOf(await db.execute(sql`SELECT * FROM client_plan_addons WHERE company_id=${input.companyId}`));
      const totals = calculateTotal(String(company.plan || PLANS[0].code), vertentes.map((v) => String(v.vertente_code)), addons.map((a) => ({ code: String(a.addon_code), quantity: Number(a.quantity || 1) })));
      const plan = planByCode(String(company.plan || ""));
      return { company, plan, vertentes, addons, totals, capacity: { totalCap: Number(company.max_employees || plan.max_employees) } };
    }),

  getSubscriptionHistory: protectedProcedure
    .input(z.object({ companyId: z.number().int().positive(), limit: z.number().int().min(1).max(100).default(30) }))
    .query(async ({ ctx, input }) => {
      assertGlobal(ctx); await ensureTables();
      const db = await getDb(); if (!db) return [];
      return rowsOf(await db.execute(sql.raw(`SELECT * FROM client_plan_history WHERE company_id=${input.companyId} ORDER BY id DESC LIMIT ${input.limit}`)));
    }),

  updateClientSubscription: protectedProcedure
    .input(z.object({
      companyId: z.number().int().positive(),
      planCode: z.enum(["nr01_inteligente", "saude_integral", "corporate"]),
      vertentes: z.array(z.enum(["mental", "sst", "educacao"])),
      addons: z.array(z.object({ code: z.string().min(1).max(80), quantity: z.number().int().min(1).max(100) })),
      reason: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertGlobal(ctx); await ensureTables();
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const currentResult: any = await db.execute(sql`SELECT plan, mrr FROM companies WHERE id=${input.companyId} LIMIT 1`);
      const current = rowsOf(currentResult)[0];
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa nao encontrada." });
      for (const addon of input.addons) {
        if (!ADDONS.some((item) => item.code === addon.code)) throw new TRPCError({ code: "BAD_REQUEST", message: `Add-on invalido: ${addon.code}` });
      }
      const before = Number(current.mrr || 0);
      const totals = calculateTotal(input.planCode, input.vertentes, input.addons);
      const action = String(current.plan) === input.planCode ? "subscription_update" : totals.totalMonthly >= before ? "plan_upgrade" : "plan_downgrade";
      await db.execute(sql`UPDATE companies SET plan=${input.planCode}, mrr=${String(totals.totalMonthly)}, max_employees=${planByCode(input.planCode).max_employees} WHERE id=${input.companyId}`);
      await db.execute(sql`DELETE FROM client_plan_vertentes WHERE company_id=${input.companyId}`);
      for (const code of input.vertentes) await db.execute(sql`INSERT INTO client_plan_vertentes (company_id, vertente_code) VALUES (${input.companyId}, ${code})`);
      await db.execute(sql`DELETE FROM client_plan_addons WHERE company_id=${input.companyId}`);
      for (const addon of input.addons) {
        await db.execute(sql`INSERT INTO client_plan_addons (company_id, addon_code, quantity) VALUES (${input.companyId}, ${addon.code}, ${addon.quantity})`);
      }
      await db.execute(sql`INSERT INTO client_plan_history
        (company_id, action, old_plan_code, new_plan_code, monthly_total_before, monthly_total_after, reason, changed_by_user_id, user_email)
        VALUES (${input.companyId}, ${action}, ${String(current.plan || "")}, ${input.planCode}, ${before}, ${totals.totalMonthly}, ${input.reason ?? null}, ${ctx.user.id}, ${(ctx.user as any).email ?? null})`);
      return { ok: true, totalMonthly: totals.totalMonthly };
    }),
});
