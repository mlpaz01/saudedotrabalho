import { TRPCError } from "@trpc/server";
import { sql as drzSql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import { protectedProcedure, router } from "./trpc";

function rowsOf(result: any): any[] {
  return Array.isArray(result?.[0])
    ? result[0]
    : Array.isArray(result)
      ? result
      : [];
}

function roleOf(ctx: any) {
  return String(ctx.user?.role || "");
}

function companyOf(ctx: any) {
  return Number(ctx.user?.companyId || 0);
}

function parseJson(value: any, fallback: any) {
  if (Array.isArray(value) || (value && typeof value === "object")) return value;
  if (!value) return fallback;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

const globalRoles = ["admin_global", "super_admin"];
const sgqRoles = [
  "gestor_qualidade",
  "qualidade",
  "treinamento",
  "rh",
  "admin",
  "company_admin",
  ...globalRoles,
];

function requireSgq(ctx: any) {
  if (!sgqRoles.includes(roleOf(ctx)))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acesso reservado aos perfis de SGQ, Qualidade ou administradores autorizados.",
    });
}

function requireGlobal(ctx: any) {
  if (!globalRoles.includes(roleOf(ctx)))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Configuração global restrita ao SuperAdmin.",
    });
}

let ready = false;

async function ensureSgqTables() {
  if (ready) return;
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS sgq_product_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_type VARCHAR(30) NOT NULL DEFAULT 'company',
    owner_id INT NOT NULL DEFAULT 0,
    product_enabled TINYINT(1) NOT NULL DEFAULT 0,
    modules_json LONGTEXT NULL,
    commercial_plan VARCHAR(80) NULL,
    notes TEXT NULL,
    updated_by INT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_sgq_product_owner (owner_type, owner_id)
  )`);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS sgq_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL DEFAULT 0,
    module_key VARCHAR(80) NOT NULL,
    code VARCHAR(80) NULL,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(60) NOT NULL DEFAULT 'rascunho',
    severity VARCHAR(40) NULL,
    process_name VARCHAR(255) NULL,
    responsible_user_id INT NULL,
    due_date DATE NULL,
    metadata_json LONGTEXT NULL,
    evidence_json LONGTEXT NULL,
    created_by INT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    archived_at DATETIME NULL,
    INDEX idx_sgq_records_company_module (company_id, module_key, status),
    INDEX idx_sgq_records_due_date (company_id, due_date)
  )`);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS sgq_training_catalog (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_type VARCHAR(30) NOT NULL DEFAULT 'global',
    owner_id INT NOT NULL DEFAULT 0,
    code VARCHAR(80) NOT NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(120) NULL,
    workload_minutes INT NOT NULL DEFAULT 0,
    validity_months INT NULL,
    official_content TINYINT(1) NOT NULL DEFAULT 1,
    available_to_white_label TINYINT(1) NOT NULL DEFAULT 1,
    description MEDIUMTEXT NULL,
    modules_json LONGTEXT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'ativo',
    version VARCHAR(40) NOT NULL DEFAULT '1.0',
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_sgq_training_owner_code (owner_type, owner_id, code)
  )`);
  await db.execute(drzSql`INSERT IGNORE INTO sgq_training_catalog
    (owner_type, owner_id, code, title, category, workload_minutes, validity_months, description, modules_json, available_to_white_label, version)
    VALUES
    ('global',0,'SGQ-ISO9001-BASE','Fundamentos da ISO 9001 e Sistema de Gestão da Qualidade','ISO 9001',120,24,'Curso oficial introdutório para colaboradores e lideranças sobre princípios da qualidade, processos, evidências e melhoria contínua.','["treinamentos","competencias","conformidade_sgq"]',1,'1.0'),
    ('global',0,'SGQ-AUD-INT','Auditoria Interna da Qualidade','Auditorias',240,24,'Treinamento para planejamento, execução, registro de evidências, tratamento de achados e acompanhamento de auditorias internas.','["auditorias","checklists","nao_conformidades"]',1,'1.0'),
    ('global',0,'SGQ-NC-CAP','Não Conformidade, Causa Raiz e Plano de Ação','Melhoria contínua',180,24,'Capacitação prática para registrar ocorrências, analisar causa raiz, definir ações corretivas e acompanhar eficácia.','["nao_conformidades","causa_raiz","planos_acao","melhoria_continua"]',1,'1.0'),
    ('global',0,'SGQ-DOC-PROC','Controle de Documentos e Processos','Documentos',90,24,'Treinamento sobre padronização documental, versões, aprovação, ciência e relacionamento com processos corporativos.','["documentos","processos","fluxos"]',1,'1.0')`);
  ready = true;
}

const moduleKeys = [
  "documentos",
  "processos",
  "fluxos",
  "nao_conformidades",
  "causa_raiz",
  "planos_acao",
  "riscos_corporativos",
  "auditorias",
  "checklists",
  "indicadores",
  "fornecedores",
  "treinamentos",
  "competencias",
  "reunioes_atas",
  "melhoria_continua",
  "biblioteca",
  "conformidade_sgq",
] as const;

export const sgqRouter = router({
  listProductSettings: protectedProcedure.query(async ({ ctx }) => {
    requireGlobal(ctx);
    await ensureSgqTables();
    const db = await getDb();
    if (!db) return [];
    const result: any = await db.execute(drzSql`
      SELECT s.*, c.name company_name, c.cnpj company_cnpj
      FROM sgq_product_settings s
      LEFT JOIN companies c ON s.owner_type='company' AND c.id=s.owner_id
      ORDER BY s.owner_type, COALESCE(c.name, CAST(s.owner_id AS CHAR))
    `);
    return rowsOf(result).map((row: any) => ({
      ...row,
      modules: parseJson(row.modules_json, []),
    }));
  }),

  summary: protectedProcedure.query(async ({ ctx }) => {
    requireSgq(ctx);
    await ensureSgqTables();
    const db = await getDb();
    if (!db) return null;
    const companyId = companyOf(ctx);
    const [settingsResult, countersResult, dueResult, trainingResult] =
      await Promise.all([
        db.execute(
          drzSql`SELECT * FROM sgq_product_settings WHERE owner_type='company' AND owner_id=${companyId} LIMIT 1`
        ),
        db.execute(
          drzSql`SELECT module_key,status,COUNT(*) total FROM sgq_records WHERE company_id=${companyId} AND archived_at IS NULL GROUP BY module_key,status`
        ),
        db.execute(
          drzSql`SELECT COUNT(*) total FROM sgq_records WHERE company_id=${companyId} AND archived_at IS NULL AND due_date IS NOT NULL AND due_date<CURDATE()`
        ),
        db.execute(
          drzSql`SELECT COUNT(*) total FROM sgq_training_catalog WHERE status='ativo' AND available_to_white_label=1`
        ),
      ]);
    return {
      settings: rowsOf(settingsResult)[0] || {
        product_enabled: globalRoles.includes(roleOf(ctx)) ? 1 : 0,
      },
      counters: rowsOf(countersResult),
      overdue: Number(rowsOf(dueResult)[0]?.total || 0),
      officialTrainings: Number(rowsOf(trainingResult)[0]?.total || 0),
      modules: moduleKeys,
    };
  }),

  listRecords: protectedProcedure
    .input(
      z.object({
        moduleKey: z.enum(moduleKeys).optional(),
        status: z.string().max(60).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      requireSgq(ctx);
      await ensureSgqTables();
      const db = await getDb();
      if (!db) return [];
      const companyId = companyOf(ctx);
      const result: any = await db.execute(
        input.moduleKey
          ? input.status
            ? drzSql`SELECT r.*,u.name responsible_name FROM sgq_records r LEFT JOIN users u ON u.id=r.responsible_user_id WHERE r.company_id=${companyId} AND r.module_key=${input.moduleKey} AND r.status=${input.status} AND r.archived_at IS NULL ORDER BY COALESCE(r.due_date,'2999-12-31'),r.updated_at DESC LIMIT 800`
            : drzSql`SELECT r.*,u.name responsible_name FROM sgq_records r LEFT JOIN users u ON u.id=r.responsible_user_id WHERE r.company_id=${companyId} AND r.module_key=${input.moduleKey} AND r.archived_at IS NULL ORDER BY COALESCE(r.due_date,'2999-12-31'),r.updated_at DESC LIMIT 800`
          : drzSql`SELECT r.*,u.name responsible_name FROM sgq_records r LEFT JOIN users u ON u.id=r.responsible_user_id WHERE r.company_id=${companyId} AND r.archived_at IS NULL ORDER BY r.updated_at DESC LIMIT 800`
      );
      return rowsOf(result).map((row: any) => ({
        ...row,
        metadata: parseJson(row.metadata_json, {}),
        evidence: parseJson(row.evidence_json, []),
      }));
    }),

  upsertRecord: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        moduleKey: z.enum(moduleKeys),
        code: z.string().max(80).optional(),
        title: z.string().min(3).max(255),
        status: z.string().min(2).max(60).default("rascunho"),
        severity: z.string().max(40).optional(),
        processName: z.string().max(255).optional(),
        responsibleUserId: z.number().int().positive().nullable().optional(),
        dueDate: z.string().max(10).nullable().optional(),
        metadata: z.record(z.string(), z.any()).default({}),
        evidence: z.array(z.any()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireSgq(ctx);
      await ensureSgqTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db || !companyId)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Empresa não identificada para o SGQ." });
      let id = Number(input.id || 0);
      if (id) {
        await db.execute(
          drzSql`UPDATE sgq_records SET module_key=${input.moduleKey},code=${input.code || null},title=${input.title},status=${input.status},severity=${input.severity || null},process_name=${input.processName || null},responsible_user_id=${input.responsibleUserId || null},due_date=${input.dueDate || null},metadata_json=${JSON.stringify(input.metadata)},evidence_json=${JSON.stringify(input.evidence)},updated_by=${Number(ctx.user.id)} WHERE id=${id} AND company_id=${companyId}`
        );
      } else {
        const inserted: any = await db.execute(
          drzSql`INSERT INTO sgq_records (company_id,module_key,code,title,status,severity,process_name,responsible_user_id,due_date,metadata_json,evidence_json,created_by,updated_by) VALUES (${companyId},${input.moduleKey},${input.code || null},${input.title},${input.status},${input.severity || null},${input.processName || null},${input.responsibleUserId || null},${input.dueDate || null},${JSON.stringify(input.metadata)},${JSON.stringify(input.evidence)},${Number(ctx.user.id)},${Number(ctx.user.id)})`
        );
        id = Number((inserted as any)[0]?.insertId || 0);
      }
      return { ok: true, id };
    }),

  archiveRecord: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireSgq(ctx);
      await ensureSgqTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.execute(
        drzSql`UPDATE sgq_records SET archived_at=NOW(),updated_by=${Number(ctx.user.id)} WHERE id=${input.id} AND company_id=${companyId}`
      );
      return { ok: true };
    }),

  listTrainingCatalog: protectedProcedure.query(async ({ ctx }) => {
    requireSgq(ctx);
    await ensureSgqTables();
    const db = await getDb();
    if (!db) return [];
    const result: any = await db.execute(
      drzSql`SELECT * FROM sgq_training_catalog WHERE status='ativo' AND (owner_type='global' OR owner_id=${companyOf(ctx)}) ORDER BY official_content DESC,category,title`
    );
    return rowsOf(result).map((row: any) => ({
      ...row,
      modules: parseJson(row.modules_json, []),
    }));
  }),

  upsertOfficialTraining: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        code: z.string().min(2).max(80),
        title: z.string().min(3).max(255),
        category: z.string().max(120).optional(),
        workloadMinutes: z.number().int().min(0).max(100000).default(0),
        validityMonths: z.number().int().min(0).max(600).nullable().optional(),
        description: z.string().max(50000).optional(),
        modules: z.array(z.enum(moduleKeys)).default([]),
        availableToWhiteLabel: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireGlobal(ctx);
      await ensureSgqTables();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let id = Number(input.id || 0);
      if (id) {
        await db.execute(
          drzSql`UPDATE sgq_training_catalog SET code=${input.code},title=${input.title},category=${input.category || null},workload_minutes=${input.workloadMinutes},validity_months=${input.validityMonths || null},description=${input.description || null},modules_json=${JSON.stringify(input.modules)},available_to_white_label=${input.availableToWhiteLabel ? 1 : 0},updated_by=${Number(ctx.user.id)} WHERE id=${id} AND owner_type='global'`
        );
      } else {
        const inserted: any = await db.execute(
          drzSql`INSERT INTO sgq_training_catalog (owner_type,owner_id,code,title,category,workload_minutes,validity_months,description,modules_json,available_to_white_label,updated_by) VALUES ('global',0,${input.code},${input.title},${input.category || null},${input.workloadMinutes},${input.validityMonths || null},${input.description || null},${JSON.stringify(input.modules)},${input.availableToWhiteLabel ? 1 : 0},${Number(ctx.user.id)}) ON DUPLICATE KEY UPDATE title=VALUES(title),category=VALUES(category),workload_minutes=VALUES(workload_minutes),validity_months=VALUES(validity_months),description=VALUES(description),modules_json=VALUES(modules_json),available_to_white_label=VALUES(available_to_white_label),updated_by=VALUES(updated_by)`
        );
        id = Number((inserted as any)[0]?.insertId || 0);
      }
      return { ok: true, id };
    }),

  setProductSettings: protectedProcedure
    .input(
      z.object({
        ownerType: z.enum(["company", "white_label"]).default("company"),
        ownerId: z.number().int().min(0),
        enabled: z.boolean(),
        modules: z.array(z.enum(moduleKeys)).default([...moduleKeys]),
        commercialPlan: z.string().max(80).optional(),
        notes: z.string().max(5000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireGlobal(ctx);
      await ensureSgqTables();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.execute(
        drzSql`INSERT INTO sgq_product_settings (owner_type,owner_id,product_enabled,modules_json,commercial_plan,notes,updated_by) VALUES (${input.ownerType},${input.ownerId},${input.enabled ? 1 : 0},${JSON.stringify(input.modules)},${input.commercialPlan || null},${input.notes || null},${Number(ctx.user.id)}) ON DUPLICATE KEY UPDATE product_enabled=VALUES(product_enabled),modules_json=VALUES(modules_json),commercial_plan=VALUES(commercial_plan),notes=VALUES(notes),updated_by=VALUES(updated_by)`
      );
      return { ok: true };
    }),
});
