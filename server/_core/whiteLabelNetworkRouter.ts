import { TRPCError } from "@trpc/server";
import { sql as drzSql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import { activeEmployeeSql } from "./activeEmployees";
import { ensureCrmTables } from "./crm";
import { protectedProcedure, router } from "./trpc";
import { ensureWhiteLabelTables } from "./whiteLabel";
import { getWhiteLabelPartnerIdForCompany, whiteLabelPartnerOwnsCompany } from "./whiteLabelAccess";

function rowsOf(result: any): any[] {
  return Array.isArray(result?.[0]) ? result[0] : Array.isArray(result) ? result : [];
}

let networkTablesReady = false;
async function ensureNetworkTables() {
  if (networkTablesReady) return;
  await ensureWhiteLabelTables();
  await ensureCrmTables();
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponivel." });
  try { await db.execute(drzSql`ALTER TABLE commercial_proposals ADD COLUMN white_label_partner_id INT NULL`); } catch {}
  try { await db.execute(drzSql`CREATE INDEX idx_proposal_white_label ON commercial_proposals(white_label_partner_id, status, created_at)`); } catch {}
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS white_label_course_library (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    partner_id INT NOT NULL,
    module_id INT NOT NULL,
    custom_title VARCHAR(255) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    selected_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_white_label_course (partner_id,module_id),
    INDEX idx_white_label_course_partner (partner_id,is_active,sort_order)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS white_label_course_distribution (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    partner_id INT NOT NULL,
    module_id INT NOT NULL,
    company_id INT NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    distributed_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_white_label_course_company (partner_id,module_id,company_id),
    INDEX idx_white_label_course_company (company_id,is_active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  networkTablesReady = true;
}

const networkAdminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (String(ctx.user.role) !== "company_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito ao administrador da rede." });
  }
  const partnerId = Number((ctx.user as any)._whiteLabelPartnerId || 0)
    || await getWhiteLabelPartnerIdForCompany(Number((ctx.user as any)._originalCompanyId || ctx.user.companyId || 0));
  if (!partnerId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Administrador sem rede white label vinculada." });
  }
  return next({ ctx: { ...ctx, whiteLabelPartnerId: partnerId } });
});

async function requireOwnedCompany(partnerId: number, companyId: number) {
  if (!await whiteLabelPartnerOwnsCompany(partnerId, companyId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Empresa fora da rede administrada." });
  }
}

async function logNetworkAction(partnerId: number, companyId: number | null, userId: number, action: string, details: unknown) {
  const db = await getDb();
  if (!db) return;
  await db.execute(drzSql`INSERT INTO white_label_audit_logs
    (partner_id, company_id, action, details_json, user_id)
    VALUES (${partnerId}, ${companyId}, ${action}, ${JSON.stringify(details ?? {})}, ${userId})`);
}

export const whiteLabelNetworkRouter = router({
  context: networkAdminProcedure.query(async ({ ctx }) => {
    await ensureNetworkTables();
    const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const partnerId = Number((ctx as any).whiteLabelPartnerId);
    const partnerResult: any = await db.execute(drzSql`
      SELECT w.id, w.legal_name, w.trade_name, w.brand_name, w.logo_url, w.custom_domain,
             w.plan_code, w.status, w.monthly_price, p.label AS plan_label,
             p.included_cnpjs, p.included_employees, p.included_storage_gb, p.included_ai_credits
      FROM white_label_partners w
      LEFT JOIN white_label_plan_catalog p ON p.code=w.plan_code
      WHERE w.id=${partnerId} LIMIT 1`);
    const walletResult: any = await db.execute(drzSql`
      SELECT * FROM white_label_ai_wallets WHERE partner_id=${partnerId} LIMIT 1`);
    const metricsResult: any = await db.execute(drzSql.raw(`
      SELECT COUNT(DISTINCT l.company_id) AS companies,
             COUNT(DISTINCT CASE WHEN ${activeEmployeeSql("u")} THEN u.id END) AS active_employees,
             COUNT(DISTINCT u.id) AS users
      FROM white_label_company_links l
      LEFT JOIN users u ON u.company_id=l.company_id
      WHERE l.partner_id=${partnerId} AND l.is_active=1`));
    const proposalsResult: any = await db.execute(drzSql`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN status IN ('aprovada','convertida') THEN 1 ELSE 0 END) AS won,
             COALESCE(SUM(CASE WHEN status IN ('aprovada','convertida') THEN valor_mensal ELSE 0 END),0) AS won_mrr
      FROM commercial_proposals WHERE white_label_partner_id=${partnerId}`);
    return {
      partner: rowsOf(partnerResult)[0] ?? null,
      wallet: rowsOf(walletResult)[0] ?? null,
      metrics: rowsOf(metricsResult)[0] ?? { companies: 0, active_employees: 0, users: 0 },
      proposals: rowsOf(proposalsResult)[0] ?? { total: 0, won: 0, won_mrr: 0 },
      selectedCompanyId: Number(ctx.user.companyId || 0),
      homeCompanyId: Number((ctx.user as any)._originalCompanyId || ctx.user.companyId || 0),
    };
  }),

  getCompanyName: networkAdminProcedure
    .input(z.object({ companyId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const partnerId = Number((ctx as any).whiteLabelPartnerId);
      await requireOwnedCompany(partnerId, input.companyId);
      const db = await getDb(); if (!db) return null;
      const result: any = await db.execute(drzSql`SELECT name FROM companies WHERE id=${input.companyId} LIMIT 1`);
      return rowsOf(result)[0]?.name ?? null;
    }),

  listCompanies: networkAdminProcedure.query(async ({ ctx }) => {
    await ensureNetworkTables();
    const db = await getDb(); if (!db) return [];
    const partnerId = Number((ctx as any).whiteLabelPartnerId);
    const result: any = await db.execute(drzSql.raw(`
      SELECT c.id, c.name, c.cnpj, c.logo_url, c.primary_color, c.plan,
             c.subscription_status, c.max_employees, c.access_method,
             c.communication_channel, c.is_active,
             COUNT(DISTINCT u.id) AS users_count,
             COUNT(DISTINCT CASE WHEN ${activeEmployeeSql("u")} THEN u.id END) AS active_employees,
             COUNT(DISTINCT b.id) AS branches_count,
             COUNT(DISTINCT s.id) AS sectors_count,
             COUNT(DISTINCT e.id) AS enrolled_modules
      FROM white_label_company_links l
      JOIN companies c ON c.id=l.company_id
      LEFT JOIN users u ON u.company_id=c.id
      LEFT JOIN branches b ON b.company_id=c.id AND b.is_active=1
      LEFT JOIN sectors s ON s.company_id=c.id AND s.is_active=1
      LEFT JOIN company_content_enrollments e ON e.company_id=c.id AND e.is_active=1
      WHERE l.partner_id=${partnerId} AND l.is_active=1
      GROUP BY c.id ORDER BY c.name`));
    return rowsOf(result);
  }),

  createCompany: networkAdminProcedure
    .input(z.object({
      name: z.string().min(2).max(255),
      cnpj: z.string().max(20).optional().nullable(),
      maxEmployees: z.number().int().min(1).max(100000).default(50),
      plan: z.string().max(50).default("essencial"),
    }))
    .mutation(async ({ ctx, input }) => {
      await ensureNetworkTables();
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const partnerId = Number((ctx as any).whiteLabelPartnerId);
      if (input.cnpj) {
        const dup: any = await db.execute(drzSql`SELECT id FROM companies WHERE cnpj=${input.cnpj} LIMIT 1`);
        if (rowsOf(dup).length) throw new TRPCError({ code: "CONFLICT", message: "CNPJ ja cadastrado." });
      }
      const inserted: any = await db.execute(drzSql`INSERT INTO companies
        (name, cnpj, plan, subscription_status, max_employees, is_active, white_label_partner_id)
        VALUES (${input.name}, ${input.cnpj ?? null}, ${input.plan}, 'active', ${input.maxEmployees}, 1, ${partnerId})`);
      const insertMeta: any = Array.isArray(inserted) ? inserted[0] : inserted;
      const companyId = Number(insertMeta?.insertId || 0);
      if (!companyId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao criar empresa." });
      await db.execute(drzSql`INSERT INTO white_label_company_links
        (partner_id, company_id, client_label, is_active)
        VALUES (${partnerId}, ${companyId}, ${input.name}, 1)`);
      await logNetworkAction(partnerId, companyId, Number(ctx.user.id), "network_company_created", input);
      return { ok: true, companyId };
    }),

  updateCompany: networkAdminProcedure
    .input(z.object({
      companyId: z.number().int().positive(),
      name: z.string().min(2).max(255),
      maxEmployees: z.number().int().min(1).max(100000),
      plan: z.string().max(50),
      accessMethod: z.enum(["email", "cpf", "both", "whatsapp"]),
      communicationChannel: z.enum(["email", "whatsapp", "both"]),
      isActive: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const partnerId = Number((ctx as any).whiteLabelPartnerId);
      await requireOwnedCompany(partnerId, input.companyId);
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.execute(drzSql`UPDATE companies SET
        name=${input.name}, max_employees=${input.maxEmployees}, plan=${input.plan},
        access_method=${input.accessMethod}, communication_channel=${input.communicationChannel},
        is_active=${input.isActive ? 1 : 0}
        WHERE id=${input.companyId}`);
      await logNetworkAction(partnerId, input.companyId, Number(ctx.user.id), "network_company_updated", input);
      return { ok: true };
    }),

  listUsers: networkAdminProcedure
    .input(z.object({ companyId: z.number().int().positive().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const partnerId = Number((ctx as any).whiteLabelPartnerId);
      if (input?.companyId) await requireOwnedCompany(partnerId, input.companyId);
      const db = await getDb(); if (!db) return [];
      const companyFilter = input?.companyId ? drzSql`AND u.company_id=${input.companyId}` : drzSql``;
      const result: any = await db.execute(drzSql`
        SELECT u.id, u.name, u.email, u.role, u.is_active, u.employment_status,
               u.lastSignedIn, c.id AS company_id, c.name AS company_name,
               b.name AS branch_name, s.name AS sector_name
        FROM users u
        JOIN white_label_company_links l ON l.company_id=u.company_id AND l.is_active=1
        JOIN companies c ON c.id=u.company_id
        LEFT JOIN branches b ON b.id=u.branch_id
        LEFT JOIN sectors s ON s.id=u.sector_id
        WHERE l.partner_id=${partnerId} ${companyFilter}
        ORDER BY c.name, u.name LIMIT 2000`);
      return rowsOf(result);
    }),

  listProposals: networkAdminProcedure.query(async ({ ctx }) => {
    await ensureNetworkTables();
    const db = await getDb(); if (!db) return [];
    const partnerId = Number((ctx as any).whiteLabelPartnerId);
    const result: any = await db.execute(drzSql`
      SELECT * FROM commercial_proposals
      WHERE white_label_partner_id=${partnerId}
      ORDER BY updated_at DESC, id DESC LIMIT 500`);
    return rowsOf(result);
  }),

  upsertProposal: networkAdminProcedure
    .input(z.object({
      id: z.number().int().positive().optional(),
      companyName: z.string().min(2).max(255),
      cnpj: z.string().max(20).optional().nullable(),
      contactName: z.string().max(160).optional().nullable(),
      email: z.string().email().optional().nullable(),
      phone: z.string().max(40).optional().nullable(),
      employees: z.number().int().min(0).default(0),
      monthlyValue: z.number().min(0).default(0),
      status: z.enum(["lead", "negociacao", "proposta_enviada", "aguardando_retorno", "aprovada", "reprovada", "convertida"]).default("lead"),
      notes: z.string().max(10000).optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ensureNetworkTables();
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const partnerId = Number((ctx as any).whiteLabelPartnerId);
      if (input.id) {
        const owned: any = await db.execute(drzSql`SELECT id FROM commercial_proposals WHERE id=${input.id} AND white_label_partner_id=${partnerId} LIMIT 1`);
        if (!rowsOf(owned).length) throw new TRPCError({ code: "FORBIDDEN" });
        await db.execute(drzSql`UPDATE commercial_proposals SET
          razao_social=${input.companyName}, nome_fantasia=${input.companyName}, cnpj=${input.cnpj ?? null},
          responsavel=${input.contactName ?? null}, email=${input.email ?? null}, telefone=${input.phone ?? null},
          qtd_colaboradores=${input.employees}, valor_mensal=${input.monthlyValue}, valor_anual=${input.monthlyValue * 12},
          valor_total=${input.monthlyValue * 12}, status=${input.status}, observacoes=${input.notes ?? null}
          WHERE id=${input.id} AND white_label_partner_id=${partnerId}`);
      } else {
        await db.execute(drzSql`INSERT INTO commercial_proposals
          (razao_social, nome_fantasia, cnpj, responsavel, email, telefone, qtd_colaboradores,
           valor_mensal, valor_anual, valor_total, status, observacoes, white_label_partner_id, created_by_user_id)
          VALUES (${input.companyName}, ${input.companyName}, ${input.cnpj ?? null}, ${input.contactName ?? null},
          ${input.email ?? null}, ${input.phone ?? null}, ${input.employees}, ${input.monthlyValue},
          ${input.monthlyValue * 12}, ${input.monthlyValue * 12}, ${input.status}, ${input.notes ?? null},
          ${partnerId}, ${ctx.user.id})`);
      }
      await logNetworkAction(partnerId, null, Number(ctx.user.id), "network_proposal_saved", { id: input.id ?? null, companyName: input.companyName, status: input.status });
      return { ok: true };
    }),

  listCourseLibrary: networkAdminProcedure.query(async ({ ctx }) => {
    await ensureNetworkTables();
    const db = await getDb(); if (!db) return { courses: [], companies: [] };
    const partnerId = Number((ctx as any).whiteLabelPartnerId);
    const coursesResult: any = await db.execute(drzSql`SELECT m.id,m.title,m.description,m.durationMinutes,m.image_url,m.template_category,m.profession,m.validity_days,
      COALESCE(l.is_active,0) selected,COALESCE(l.custom_title,m.title) display_title,COALESCE(l.sort_order,m.orderIndex) sort_order,
      GROUP_CONCAT(DISTINCT CASE WHEN d.is_active=1 THEN d.company_id END ORDER BY d.company_id) company_ids
      FROM modules m
      LEFT JOIN white_label_course_library l ON l.module_id=m.id AND l.partner_id=${partnerId}
      LEFT JOIN white_label_course_distribution d ON d.module_id=m.id AND d.partner_id=${partnerId}
      WHERE m.isActive=1 AND m.publish_status='published' AND (m.is_catalog_master=1 OR m.created_by_company_id IS NULL)
      GROUP BY m.id,l.id ORDER BY COALESCE(l.is_active,0) DESC,COALESCE(l.sort_order,m.orderIndex),m.title`);
    const companiesResult: any = await db.execute(drzSql`SELECT c.id,c.name,c.cnpj FROM white_label_company_links link JOIN companies c ON c.id=link.company_id WHERE link.partner_id=${partnerId} AND link.is_active=1 AND c.is_active=1 ORDER BY c.name`);
    return { courses: rowsOf(coursesResult).map((row:any) => ({ ...row, companyIds: String(row.company_ids || "").split(",").filter(Boolean).map(Number) })), companies: rowsOf(companiesResult) };
  }),

  saveCourseLibrary: networkAdminProcedure.input(z.object({
    moduleId: z.number().int().positive(), selected: z.boolean(), customTitle: z.string().max(255).optional(),
    sortOrder: z.number().int().min(0).max(100000).default(0), companyIds: z.array(z.number().int().positive()).default([]),
  })).mutation(async ({ ctx, input }) => {
    await ensureNetworkTables();
    const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const partnerId = Number((ctx as any).whiteLabelPartnerId);
    const officialResult: any = await db.execute(drzSql`SELECT id FROM modules WHERE id=${input.moduleId} AND isActive=1 AND publish_status='published' AND (is_catalog_master=1 OR created_by_company_id IS NULL) LIMIT 1`);
    if (!rowsOf(officialResult)[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "Curso oficial não localizado ou ainda não publicado." });
    for (const companyId of input.companyIds) await requireOwnedCompany(partnerId, companyId);
    await db.execute(drzSql`INSERT INTO white_label_course_library (partner_id,module_id,custom_title,sort_order,is_active,selected_by) VALUES (${partnerId},${input.moduleId},${input.customTitle || null},${input.sortOrder},${input.selected ? 1 : 0},${Number(ctx.user.id)}) ON DUPLICATE KEY UPDATE custom_title=VALUES(custom_title),sort_order=VALUES(sort_order),is_active=VALUES(is_active),selected_by=VALUES(selected_by)`);
    const existingCompaniesResult: any = await db.execute(drzSql`SELECT company_id FROM white_label_course_distribution WHERE partner_id=${partnerId} AND module_id=${input.moduleId}`);
    const existingCompanyIds = rowsOf(existingCompaniesResult).map((row:any) => Number(row.company_id));
    const desired = input.selected ? new Set(input.companyIds) : new Set<number>();
    for (const companyId of new Set([...existingCompanyIds, ...input.companyIds])) {
      const active = desired.has(companyId);
      await db.execute(drzSql`INSERT INTO white_label_course_distribution (partner_id,module_id,company_id,is_active,distributed_by) VALUES (${partnerId},${input.moduleId},${companyId},${active ? 1 : 0},${Number(ctx.user.id)}) ON DUPLICATE KEY UPDATE is_active=VALUES(is_active),distributed_by=VALUES(distributed_by)`);
      if (active) await db.execute(drzSql`INSERT INTO company_content_enrollments (company_id,content_type,content_id,is_active) VALUES (${companyId},'module',${input.moduleId},1) ON DUPLICATE KEY UPDATE is_active=1`);
      else await db.execute(drzSql`UPDATE company_content_enrollments SET is_active=0 WHERE company_id=${companyId} AND content_type='module' AND content_id=${input.moduleId}`);
    }
    await logNetworkAction(partnerId, null, Number(ctx.user.id), "network_course_library_updated", { moduleId: input.moduleId, selected: input.selected, companyIds: input.companyIds });
    return { ok: true };
  }),

  listAudit: networkAdminProcedure.query(async ({ ctx }) => {
    const db = await getDb(); if (!db) return [];
    const partnerId = Number((ctx as any).whiteLabelPartnerId);
    const result: any = await db.execute(drzSql`
      SELECT a.*, u.name AS user_name, u.email AS user_email, c.name AS company_name
      FROM white_label_audit_logs a
      LEFT JOIN users u ON u.id=a.user_id
      LEFT JOIN companies c ON c.id=a.company_id
      WHERE a.partner_id=${partnerId}
      ORDER BY a.id DESC LIMIT 200`);
    return rowsOf(result);
  }),
});
