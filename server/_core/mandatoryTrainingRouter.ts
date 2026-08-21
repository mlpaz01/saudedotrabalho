import { TRPCError } from "@trpc/server";
import { sql as drzSql } from "drizzle-orm";
import { z } from "zod";
import { getDb, logAudit } from "../db";
import { sendEmail } from "./email";
import { activeEmployeeSql, ensureActiveEmployeeColumns } from "./activeEmployees";
import { protectedProcedure, router } from "./trpc";

const MANAGER_ROLES = new Set([
  "treinamento",
  "admin",
  "rh",
  "sesmt",
  "company_admin",
  "admin_global",
  "super_admin",
  "chefia",
]);

const FULL_MANAGER_ROLES = new Set([
  "treinamento",
  "admin",
  "rh",
  "sesmt",
  "company_admin",
  "admin_global",
  "super_admin",
]);

let tablesReady = false;

function rowsOf(result: any): any[] {
  return Array.isArray(result?.[0]) ? result[0] : Array.isArray(result) ? result : [];
}

function companyIdOf(ctx: any, requestedCompanyId?: number): number {
  const ownCompanyId = Number(ctx.user?.companyId || 0);
  const isGlobal = ["admin_global", "super_admin"].includes(roleOf(ctx));
  if (requestedCompanyId) {
    if (!isGlobal && requestedCompanyId !== ownCompanyId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Empresa fora do seu escopo de acesso." });
    }
    return requestedCompanyId;
  }
  const companyId = ownCompanyId;
  if (!companyId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Empresa nao identificada." });
  }
  return companyId;
}

function roleOf(ctx: any): string {
  return String(ctx.user?.role || "");
}

function requireManager(ctx: any) {
  if (!MANAGER_ROLES.has(roleOf(ctx))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado a gestao de treinamentos." });
  }
}

function requireFullManager(ctx: any) {
  if (!FULL_MANAGER_ROLES.has(roleOf(ctx))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Seu perfil possui apenas a consulta da equipe." });
  }
}

function parseJson<T>(value: unknown, fallback: T): T {
  try {
    const parsed = JSON.parse(String(value || ""));
    return parsed && typeof parsed === "object" ? parsed as T : fallback;
  } catch {
    return fallback;
  }
}

function toDate(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

async function ensureTables(db: any) {
  if (tablesReady) return;
  await ensureActiveEmployeeColumns(db);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS mandatory_training_settings (
    company_id INT PRIMARY KEY,
    is_enabled TINYINT(1) NOT NULL DEFAULT 0,
    updated_by INT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS mandatory_training_programs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    module_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    workload_minutes INT NOT NULL DEFAULT 0,
    validity_months INT NULL,
    recurrence_months INT NULL,
    start_date DATE NULL,
    due_date DATE NOT NULL,
    is_mandatory TINYINT(1) NOT NULL DEFAULT 1,
    certificate_required TINYINT(1) NOT NULL DEFAULT 1,
    audience_json LONGTEXT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'ativo',
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_mtp_company (company_id,status,due_date),
    INDEX idx_mtp_module (module_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS mandatory_training_assignments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    program_id BIGINT NOT NULL,
    user_id INT NOT NULL,
    cycle_number INT NOT NULL DEFAULT 1,
    status VARCHAR(24) NOT NULL DEFAULT 'pendente',
    due_date DATE NOT NULL,
    started_at DATETIME NULL,
    completed_at DATETIME NULL,
    certificate_id INT NULL,
    valid_until DATE NULL,
    exemption_reason VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_mta_cycle (program_id,user_id,cycle_number),
    INDEX idx_mta_user (company_id,user_id,status,due_date),
    INDEX idx_mta_program (program_id,status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS mandatory_training_communications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    assignment_id BIGINT NOT NULL,
    user_id INT NOT NULL,
    channel VARCHAR(24) NOT NULL,
    reminder_stage VARCHAR(24) NOT NULL,
    recipient VARCHAR(320) NULL,
    status VARCHAR(24) NOT NULL,
    error_message TEXT NULL,
    sent_by INT NULL,
    sent_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_mtc_reminder (assignment_id,channel,reminder_stage),
    INDEX idx_mtc_company (company_id,created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  tablesReady = true;
}

async function enabledForCompany(db: any, companyId: number): Promise<boolean> {
  const result: any = await db.execute(drzSql`SELECT is_enabled FROM mandatory_training_settings WHERE company_id=${companyId} LIMIT 1`);
  return Boolean(Number(rowsOf(result)[0]?.is_enabled || 0));
}

async function requireEnabled(db: any, companyId: number) {
  if (!(await enabledForCompany(db, companyId))) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Treinamentos Obrigatorios e um modulo adicional e ainda nao esta habilitado para esta empresa.",
    });
  }
}

async function createRenewalAssignments(db: any, companyId: number, programId?: number) {
  const result: any = await db.execute(drzSql`SELECT a.id,a.program_id,a.user_id,a.cycle_number,
      COALESCE(a.valid_until,DATE_ADD(a.completed_at,INTERVAL p.recurrence_months MONTH)) renewal_due
    FROM mandatory_training_assignments a
    JOIN mandatory_training_programs p ON p.id=a.program_id AND p.company_id=a.company_id
    WHERE a.company_id=${companyId} AND p.status='ativo' AND p.recurrence_months>0
      AND a.status IN ('concluido','vencido') AND a.completed_at IS NOT NULL
      AND COALESCE(a.valid_until,DATE_ADD(a.completed_at,INTERVAL p.recurrence_months MONTH))<=DATE_ADD(CURDATE(),INTERVAL 30 DAY)
      AND NOT EXISTS (SELECT 1 FROM mandatory_training_assignments next_cycle
        WHERE next_cycle.program_id=a.program_id AND next_cycle.user_id=a.user_id
          AND next_cycle.cycle_number>a.cycle_number)
      ${programId ? drzSql`AND a.program_id=${programId}` : drzSql``}`);
  for (const row of rowsOf(result)) {
    const dueDate = toDate(row.renewal_due);
    if (!dueDate) continue;
    await db.execute(drzSql`INSERT IGNORE INTO mandatory_training_assignments
      (company_id,program_id,user_id,cycle_number,status,due_date)
      VALUES(${companyId},${Number(row.program_id)},${Number(row.user_id)},${Number(row.cycle_number || 1) + 1},'pendente',${dueDate})`);
  }
}

async function syncAssignments(db: any, companyId: number, programId?: number) {
  const result: any = await db.execute(drzSql`SELECT a.id,a.user_id,a.program_id,a.cycle_number,a.status,a.due_date,a.created_at,
      p.module_id,p.validity_months,p.certificate_required,
      up.percentWatched progress_percent,up.isCompleted progress_completed,up.completedAt progress_completed_at,
      cert.id certificate_id,cert.issuedAt certificate_issued_at,cert.expires_at certificate_expires_at
    FROM mandatory_training_assignments a
    JOIN mandatory_training_programs p ON p.id=a.program_id AND p.company_id=a.company_id
    LEFT JOIN user_progress up ON up.userId=a.user_id AND up.moduleId=p.module_id
    LEFT JOIN certificates cert ON cert.id=COALESCE(a.certificate_id,(SELECT c2.id FROM certificates c2
      WHERE c2.userId=a.user_id AND c2.moduleId=p.module_id
        AND (a.cycle_number=1 OR c2.issuedAt>=a.created_at)
      ORDER BY c2.issuedAt DESC,c2.id DESC LIMIT 1))
    WHERE a.company_id=${companyId} AND a.status<>'desativado' ${programId ? drzSql`AND a.program_id=${programId}` : drzSql``}`);
  const today = new Date().toISOString().slice(0, 10);
  for (const row of rowsOf(result)) {
    const progressCompletedAt = toDate(row.progress_completed_at);
    const assignmentCreatedAt = toDate(row.created_at);
    const completed = Boolean(Number(row.progress_completed || 0)) &&
      (Number(row.cycle_number || 1) === 1 || Boolean(progressCompletedAt && assignmentCreatedAt && progressCompletedAt >= assignmentCreatedAt));
    let status = String(row.status || "pendente");
    if (completed) status = "concluido";
    else if (Number(row.progress_percent || 0) > 0) status = "em_andamento";
    else if (String(row.due_date || "").slice(0, 10) < today) status = "vencido";
    else status = "pendente";
    const completedAt = completed ? row.progress_completed_at || row.certificate_issued_at || new Date() : null;
    let validUntil: string | null = toDate(row.certificate_expires_at);
    if (!validUntil && completedAt && Number(row.validity_months || 0) > 0) {
      const date = new Date(completedAt);
      date.setMonth(date.getMonth() + Number(row.validity_months));
      validUntil = date.toISOString().slice(0, 10);
    }
    if (validUntil && validUntil < today) status = "vencido";
    await db.execute(drzSql`UPDATE mandatory_training_assignments SET status=${status},
      started_at=CASE WHEN ${Number(row.progress_percent || 0)} > 0 THEN COALESCE(started_at,NOW()) ELSE started_at END,
      completed_at=${completedAt},certificate_id=${row.certificate_id || null},valid_until=${validUntil}
      WHERE id=${Number(row.id)} AND company_id=${companyId}`);
  }
  await createRenewalAssignments(db, companyId, programId);
}

type Audience = {
  allEmployees?: boolean;
  branchIds?: number[];
  sectorIds?: number[];
  positions?: string[];
  gseIds?: number[];
  userIds?: number[];
};

async function resolveAudience(db: any, companyId: number, audience: Audience): Promise<number[]> {
  const result: any = await db.execute(drzSql`SELECT u.id,u.branch_id,u.sector_id,u.position,h.gse_id
    FROM users u
    LEFT JOIN occupational_gse_worker_history h ON h.company_id=u.company_id AND h.collaborator_id=u.id AND h.is_current=1
    WHERE u.company_id=${companyId} AND ${drzSql.raw(activeEmployeeSql("u"))}`);
  const branchIds = new Set((audience.branchIds || []).map(Number));
  const sectorIds = new Set((audience.sectorIds || []).map(Number));
  const positions = new Set((audience.positions || []).map(v => String(v).trim().toLowerCase()));
  const gseIds = new Set((audience.gseIds || []).map(Number));
  const userIds = new Set((audience.userIds || []).map(Number));
  const hasFilters = branchIds.size || sectorIds.size || positions.size || gseIds.size || userIds.size;
  return Array.from(new Set(rowsOf(result).filter(row => {
    if (audience.allEmployees) return true;
    if (!hasFilters) return false;
    return userIds.has(Number(row.id)) || branchIds.has(Number(row.branch_id)) ||
      sectorIds.has(Number(row.sector_id)) || positions.has(String(row.position || "").trim().toLowerCase()) ||
      gseIds.has(Number(row.gse_id));
  }).map(row => Number(row.id))));
}

const audienceSchema = z.object({
  allEmployees: z.boolean().optional(),
  branchIds: z.array(z.number().int().positive()).optional(),
  sectorIds: z.array(z.number().int().positive()).optional(),
  positions: z.array(z.string().trim().min(1).max(120)).optional(),
  gseIds: z.array(z.number().int().positive()).optional(),
  userIds: z.array(z.number().int().positive()).optional(),
}).refine(value => Boolean(value.allEmployees || value.branchIds?.length || value.sectorIds?.length ||
  value.positions?.length || value.gseIds?.length || value.userIds?.length), {
  message: "Selecione ao menos um criterio de publico-alvo.",
});

const programSchema = z.object({
  companyId: z.number().int().positive().optional(),
  id: z.number().int().positive().optional(),
  moduleId: z.number().int().positive(),
  name: z.string().trim().min(3).max(255),
  description: z.string().trim().max(5000).optional(),
  workloadMinutes: z.number().int().min(0).max(100000).default(0),
  validityMonths: z.number().int().min(0).max(600).nullable().optional(),
  recurrenceMonths: z.number().int().min(0).max(600).nullable().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isMandatory: z.boolean().default(true),
  certificateRequired: z.boolean().default(true),
  audience: audienceSchema,
  status: z.enum(["rascunho", "ativo", "arquivado"]).default("ativo"),
});

export const mandatoryTrainingRouter = router({
  moduleAccess: protectedProcedure
  .input(z.object({ companyId: z.number().int().positive().optional() }).optional())
  .query(async ({ ctx, input }) => {
    const db = await getDb();
    const canManage = FULL_MANAGER_ROLES.has(roleOf(ctx));
    const canViewTeam = MANAGER_ROLES.has(roleOf(ctx));
    if (!db) return { enabled: false, canManage, canViewTeam, companySelectionRequired: false, selectedCompanyId: null, companies: [] };
    await ensureTables(db);
    const isGlobal = ["admin_global", "super_admin"].includes(roleOf(ctx));
    const companiesResult: any = isGlobal
      ? await db.execute(drzSql`SELECT id,name,cnpj FROM companies WHERE isActive=1 ORDER BY name`)
      : [[]];
    const companies = isGlobal ? rowsOf(companiesResult) : [];
    const selectedCompanyId = Number(input?.companyId || ctx.user?.companyId || 0);
    if (!selectedCompanyId) {
      return { enabled: false, canManage, canViewTeam, companySelectionRequired: true, selectedCompanyId: null, companies };
    }
    const companyId = companyIdOf(ctx, selectedCompanyId);
    return {
      enabled: await enabledForCompany(db, companyId),
      canManage,
      canViewTeam,
      companySelectionRequired: false,
      selectedCompanyId: companyId,
      companies,
    };
  }),

  setEnabled: protectedProcedure
    .input(z.object({ companyId: z.number().int().positive().optional(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (!new Set(["super_admin", "admin_global", "company_admin"]).has(roleOf(ctx))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Somente a administracao pode habilitar este modulo." });
      }
      const companyId = companyIdOf(ctx, input.companyId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await ensureTables(db);
      await db.execute(drzSql`INSERT INTO mandatory_training_settings(company_id,is_enabled,updated_by)
        VALUES(${companyId},${input.enabled ? 1 : 0},${Number(ctx.user.id)})
        ON DUPLICATE KEY UPDATE is_enabled=VALUES(is_enabled),updated_by=VALUES(updated_by),updated_at=NOW()`);
      await logAudit({ userId: Number(ctx.user.id), userEmail: ctx.user.email || null,
        action: input.enabled ? "mandatory_training_enabled" : "mandatory_training_disabled",
        entityType: "company", entityId: companyId, detailsJson: { enabled: input.enabled } });
      return { ok: true };
    }),

  setupOptions: protectedProcedure
  .input(z.object({ companyId: z.number().int().positive().optional() }).optional())
  .query(async ({ ctx, input }) => {
    requireFullManager(ctx);
    const companyId = companyIdOf(ctx, input?.companyId);
    const db = await getDb();
    if (!db) return { courses: [], branches: [], sectors: [], positions: [], gses: [], users: [] };
    await ensureTables(db);
    await requireEnabled(db, companyId);
    const [coursesR, branchesR, sectorsR, positionsR, gsesR, usersR] = await Promise.all([
      db.execute(drzSql`SELECT m.id,m.title,m.description,m.durationMinutes,m.validity_days
        FROM modules m WHERE m.isActive=1 AND m.publish_status='published' AND
        (m.created_by_company_id IS NULL OR m.created_by_company_id=${companyId} OR EXISTS
          (SELECT 1 FROM company_content_enrollments e WHERE e.company_id=${companyId} AND e.content_type='module' AND e.content_id=m.id AND e.is_active=1))
        ORDER BY m.title`),
      db.execute(drzSql`SELECT id,name FROM branches WHERE company_id=${companyId} ORDER BY name`),
      db.execute(drzSql`SELECT id,name,branch_id FROM sectors WHERE company_id=${companyId} ORDER BY name`),
      db.execute(drzSql`SELECT DISTINCT position FROM users WHERE company_id=${companyId} AND position IS NOT NULL AND position<>'' ORDER BY position`),
      db.execute(drzSql`SELECT id,code,name FROM occupational_gse_master WHERE company_id=${companyId} AND is_active=1 ORDER BY code,name`),
      db.execute(drzSql`SELECT id,name,cpf,employee_registration,branch_id,sector_id,position FROM users u
        WHERE u.company_id=${companyId} AND ${drzSql.raw(activeEmployeeSql("u"))} ORDER BY u.name`),
    ]);
    return { courses: rowsOf(coursesR), branches: rowsOf(branchesR), sectors: rowsOf(sectorsR),
      positions: rowsOf(positionsR).map(row => String(row.position)), gses: rowsOf(gsesR), users: rowsOf(usersR) };
  }),

  listPrograms: protectedProcedure
  .input(z.object({ companyId: z.number().int().positive().optional() }).optional())
  .query(async ({ ctx, input }) => {
    requireManager(ctx);
    const companyId = companyIdOf(ctx, input?.companyId);
    const db = await getDb();
    if (!db) return [];
    await ensureTables(db);
    await requireEnabled(db, companyId);
    await syncAssignments(db, companyId);
    const result: any = await db.execute(drzSql`SELECT p.*,m.title module_title,
      COUNT(a.id) assigned_count,
      SUM(a.status='concluido') completed_count,
      SUM(a.status IN ('pendente','em_andamento')) pending_count,
      SUM(a.status='vencido') overdue_count
      FROM mandatory_training_programs p JOIN modules m ON m.id=p.module_id
      LEFT JOIN mandatory_training_assignments a ON a.program_id=p.id AND a.company_id=p.company_id AND a.status<>'desativado'
      WHERE p.company_id=${companyId} GROUP BY p.id,m.title ORDER BY FIELD(p.status,'ativo','rascunho','arquivado'),p.due_date,p.id DESC`);
    return rowsOf(result).map(row => ({ ...row, audience: parseJson<Audience>(row.audience_json, {}) }));
  }),

  upsertProgram: protectedProcedure.input(programSchema).mutation(async ({ ctx, input }) => {
    requireFullManager(ctx);
    const companyId = companyIdOf(ctx, input.companyId);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await ensureTables(db);
    await requireEnabled(db, companyId);
    const moduleR: any = await db.execute(drzSql`SELECT id,title,durationMinutes,validity_days FROM modules WHERE id=${input.moduleId} AND isActive=1 LIMIT 1`);
    const module = rowsOf(moduleR)[0];
    if (!module) throw new TRPCError({ code: "NOT_FOUND", message: "Curso do Studio nao encontrado." });
    const audienceJson = JSON.stringify(input.audience);
    let programId = input.id || 0;
    if (input.id) {
      const result: any = await db.execute(drzSql`UPDATE mandatory_training_programs SET
        module_id=${input.moduleId},name=${input.name},description=${input.description || null},
        workload_minutes=${input.workloadMinutes || Number(module.durationMinutes || 0)},
        validity_months=${input.validityMonths ?? (module.validity_days ? Math.max(1, Math.round(Number(module.validity_days) / 30)) : null)},
        recurrence_months=${input.recurrenceMonths ?? null},start_date=${input.startDate || null},due_date=${input.dueDate},
        is_mandatory=${input.isMandatory ? 1 : 0},certificate_required=${input.certificateRequired ? 1 : 0},
        audience_json=${audienceJson},status=${input.status}
        WHERE id=${input.id} AND company_id=${companyId}`);
      if (!Number((result as any)[0]?.affectedRows || 0)) throw new TRPCError({ code: "NOT_FOUND" });
    } else {
      const result: any = await db.execute(drzSql`INSERT INTO mandatory_training_programs
        (company_id,module_id,name,description,workload_minutes,validity_months,recurrence_months,start_date,due_date,is_mandatory,certificate_required,audience_json,status,created_by)
        VALUES(${companyId},${input.moduleId},${input.name},${input.description || null},
          ${input.workloadMinutes || Number(module.durationMinutes || 0)},
          ${input.validityMonths ?? (module.validity_days ? Math.max(1, Math.round(Number(module.validity_days) / 30)) : null)},
          ${input.recurrenceMonths ?? null},${input.startDate || null},${input.dueDate},${input.isMandatory ? 1 : 0},
          ${input.certificateRequired ? 1 : 0},${audienceJson},${input.status},${Number(ctx.user.id)})`);
      programId = Number((result as any)[0]?.insertId || 0);
    }
    const userIds = await resolveAudience(db, companyId, input.audience);
    for (const userId of userIds) {
      await db.execute(drzSql`INSERT INTO mandatory_training_assignments(company_id,program_id,user_id,due_date)
        VALUES(${companyId},${programId},${userId},${input.dueDate})
        ON DUPLICATE KEY UPDATE due_date=VALUES(due_date),status=IF(status='desativado','pendente',status),updated_at=NOW()`);
    }
    if (userIds.length) {
      const ids = userIds.map(Number).join(",");
      await db.execute(drzSql.raw(`UPDATE mandatory_training_assignments SET status='desativado',exemption_reason='Fora do publico-alvo apos atualizacao' WHERE company_id=${companyId} AND program_id=${programId} AND cycle_number=1 AND status IN ('pendente','em_andamento','vencido') AND user_id NOT IN (${ids})`));
    } else {
      await db.execute(drzSql`UPDATE mandatory_training_assignments SET status='desativado',exemption_reason='Fora do publico-alvo apos atualizacao'
        WHERE company_id=${companyId} AND program_id=${programId} AND cycle_number=1 AND status IN ('pendente','em_andamento','vencido')`);
    }
    await syncAssignments(db, companyId, programId);
    await logAudit({ userId: Number(ctx.user.id), userEmail: ctx.user.email || null,
      action: input.id ? "mandatory_training_updated" : "mandatory_training_created",
      entityType: "mandatory_training_program", entityId: programId,
      detailsJson: { moduleId: input.moduleId, dueDate: input.dueDate, audience: input.audience, assignments: userIds.length } });
    return { ok: true, id: programId, assignments: userIds.length };
  }),

  archiveProgram: protectedProcedure.input(z.object({ id: z.number().int().positive(), companyId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
    requireFullManager(ctx);
    const companyId = companyIdOf(ctx, input.companyId);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await ensureTables(db);
    await db.execute(drzSql`UPDATE mandatory_training_programs SET status='arquivado' WHERE id=${input.id} AND company_id=${companyId}`);
    await logAudit({ userId: Number(ctx.user.id), userEmail: ctx.user.email || null, action: "mandatory_training_archived",
      entityType: "mandatory_training_program", entityId: input.id, detailsJson: {} });
    return { ok: true };
  }),

  teamAssignments: protectedProcedure
  .input(z.object({ companyId: z.number().int().positive().optional() }).optional())
  .query(async ({ ctx, input }) => {
    requireManager(ctx);
    const companyId = companyIdOf(ctx, input?.companyId);
    const db = await getDb();
    if (!db) return [];
    await ensureTables(db);
    await requireEnabled(db, companyId);
    await syncAssignments(db, companyId);
    const sectorId = roleOf(ctx) === "chefia" ? Number(ctx.user.sectorId || 0) : 0;
    if (roleOf(ctx) === "chefia" && !sectorId) return [];
    const result: any = await db.execute(drzSql`SELECT a.id,a.status,a.due_date,a.completed_at,a.valid_until,
      p.id program_id,p.name program_name,p.module_id,p.certificate_required,p.validity_months,
      u.id user_id,u.name user_name,u.cpf,u.employee_registration,u.position,
      b.name branch_name,s.name sector_name,c.certificateCode certificate_code,c.pdfUrl certificate_url
      FROM mandatory_training_assignments a
      JOIN mandatory_training_programs p ON p.id=a.program_id AND p.company_id=a.company_id
      JOIN users u ON u.id=a.user_id AND u.company_id=a.company_id
      LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN sectors s ON s.id=u.sector_id
      LEFT JOIN certificates c ON c.id=a.certificate_id
      WHERE a.company_id=${companyId} AND a.status<>'desativado' AND p.status='ativo'
      ${sectorId ? drzSql`AND u.sector_id=${sectorId}` : drzSql``}
      ORDER BY FIELD(a.status,'vencido','pendente','em_andamento','concluido'),a.due_date,u.name`);
    return rowsOf(result);
  }),

  myAssignments: protectedProcedure.query(async ({ ctx }) => {
    const companyId = companyIdOf(ctx);
    const db = await getDb();
    if (!db) return [];
    await ensureTables(db);
    if (!(await enabledForCompany(db, companyId))) return [];
    await syncAssignments(db, companyId);
    const result: any = await db.execute(drzSql`SELECT a.id,a.cycle_number,a.status,a.due_date,a.started_at,a.completed_at,a.valid_until,
      p.name,p.description,p.module_id,p.workload_minutes,p.validity_months,p.recurrence_months,p.certificate_required,
      m.thumbnailUrl,m.image_url,c.certificateCode certificate_code,c.pdfUrl certificate_url
      FROM mandatory_training_assignments a
      JOIN mandatory_training_programs p ON p.id=a.program_id AND p.company_id=a.company_id AND p.status='ativo'
      JOIN modules m ON m.id=p.module_id LEFT JOIN certificates c ON c.id=a.certificate_id
      WHERE a.company_id=${companyId} AND a.user_id=${Number(ctx.user.id)} AND a.status<>'desativado'
      ORDER BY FIELD(a.status,'vencido','pendente','em_andamento','concluido'),a.due_date`);
    return rowsOf(result);
  }),

  startAssignment: protectedProcedure
    .input(z.object({ assignmentId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const companyId = companyIdOf(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await ensureTables(db);
      await requireEnabled(db, companyId);
      const result: any = await db.execute(drzSql`SELECT a.id,a.cycle_number,a.created_at,p.module_id,
          up.completedAt progress_completed_at
        FROM mandatory_training_assignments a
        JOIN mandatory_training_programs p ON p.id=a.program_id AND p.company_id=a.company_id
        LEFT JOIN user_progress up ON up.userId=a.user_id AND up.moduleId=p.module_id
        WHERE a.id=${input.assignmentId} AND a.company_id=${companyId} AND a.user_id=${Number(ctx.user.id)}
          AND a.status IN ('pendente','em_andamento','vencido') AND p.status='ativo' LIMIT 1`);
      const assignment = rowsOf(result)[0];
      if (!assignment) throw new TRPCError({ code: "NOT_FOUND", message: "Treinamento não encontrado." });
      const oldCompletion = toDate(assignment.progress_completed_at);
      const assignmentCreated = toDate(assignment.created_at);
      if (Number(assignment.cycle_number || 1) > 1 && oldCompletion && assignmentCreated && oldCompletion < assignmentCreated) {
        await db.execute(drzSql`UPDATE user_progress SET percentWatched=0,isCompleted=0,completedAt=NULL,lastWatchedAt=NOW()
          WHERE userId=${Number(ctx.user.id)} AND moduleId=${Number(assignment.module_id)}`);
      }
      await db.execute(drzSql`UPDATE mandatory_training_assignments SET status='em_andamento',started_at=COALESCE(started_at,NOW())
        WHERE id=${input.assignmentId} AND company_id=${companyId} AND user_id=${Number(ctx.user.id)}`);
      await logAudit({ userId: Number(ctx.user.id), userEmail: ctx.user.email || null,
        action: "mandatory_training_started", entityType: "mandatory_training_assignment", entityId: input.assignmentId,
        detailsJson: { cycleNumber: Number(assignment.cycle_number || 1), moduleId: Number(assignment.module_id) } });
      return { ok: true, moduleId: Number(assignment.module_id) };
    }),

  sendReminders: protectedProcedure
    .input(z.object({ companyId: z.number().int().positive().optional(), programId: z.number().int().positive().optional(), channels: z.array(z.enum(["interno", "email", "whatsapp"])).min(1) }))
    .mutation(async ({ ctx, input }) => {
      requireFullManager(ctx);
      const companyId = companyIdOf(ctx, input.companyId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await ensureTables(db);
      await requireEnabled(db, companyId);
      await syncAssignments(db, companyId, input.programId);
      const result: any = await db.execute(drzSql`SELECT a.id assignment_id,a.due_date,a.status,p.name program_name,
        u.id user_id,u.name,u.email,u.whatsapp_e164
        FROM mandatory_training_assignments a JOIN mandatory_training_programs p ON p.id=a.program_id
        JOIN users u ON u.id=a.user_id WHERE a.company_id=${companyId} AND p.status='ativo'
        AND a.status IN ('pendente','em_andamento','vencido') ${input.programId ? drzSql`AND a.program_id=${input.programId}` : drzSql``}`);
      const summary = { analyzed: 0, internal: 0, email: 0, whatsapp: 0, skipped: 0, failed: 0 };
      for (const row of rowsOf(result)) {
        summary.analyzed++;
        const days = Math.ceil((new Date(String(row.due_date).slice(0, 10) + "T12:00:00").getTime() - Date.now()) / 86400000);
        const stage = days < 0 ? "vencido" : days <= 1 ? "1_dia" : days <= 7 ? "7_dias" : days <= 15 ? "15_dias" : days <= 30 ? "30_dias" : "antecipado";
        const body = days < 0 ? `O treinamento obrigatorio ${row.program_name} esta vencido.` :
          `O treinamento obrigatorio ${row.program_name} deve ser concluido em ${Math.max(0, days)} dia(s).`;
        for (const channel of input.channels) {
          let recipient: string | null = null;
          let status = "enviado";
          let error: string | null = null;
          try {
            if (channel === "interno") {
              const key = `mandatory-training:${row.assignment_id}:${stage}`;
              await db.execute(drzSql`INSERT INTO notifications(user_id,company_id,type,priority,title,body,link,icon,dedup_key)
                VALUES(${Number(row.user_id)},${companyId},'treinamento_obrigatorio',${days < 0 ? "alta" : "media"},
                  'Treinamento obrigatorio',${body},'/treinamentos-obrigatorios','graduation-cap',${key})
                ON DUPLICATE KEY UPDATE body=VALUES(body),priority=VALUES(priority),read_at=NULL,created_at=NOW()`);
              summary.internal++;
            } else if (channel === "email") {
              recipient = String(row.email || "");
              if (!recipient) { status = "sem_destinatario"; summary.skipped++; }
              else {
                const sent = await sendEmail({ to: recipient, toName: row.name || recipient,
                  subject: `Treinamento obrigatorio: ${row.program_name}`,
                  html: `<p>Ola, ${String(row.name || "colaborador")}.</p><p>${body}</p><p>Acesse a plataforma para realizar o curso e consultar seu certificado.</p>` });
                if (!sent.ok) { status = "falhou"; error = sent.error || "Falha no envio"; summary.failed++; }
                else summary.email++;
              }
            } else {
              recipient = String(row.whatsapp_e164 || "");
              if (!recipient) { status = "sem_destinatario"; summary.skipped++; }
              else {
                const { sendWhatsappText } = await import("./whatsapp");
                const sent = await sendWhatsappText(recipient, `${body} Acesse a Plataforma Saude do Trabalho.`, { userId: Number(ctx.user.id), companyId });
                if (!sent.ok) { status = "falhou"; error = sent.error || "Falha no envio"; summary.failed++; }
                else summary.whatsapp++;
              }
            }
          } catch (cause: any) {
            status = "falhou"; error = cause?.message || "Falha no envio"; summary.failed++;
          }
          await db.execute(drzSql`INSERT INTO mandatory_training_communications
            (company_id,assignment_id,user_id,channel,reminder_stage,recipient,status,error_message,sent_by,sent_at)
            VALUES(${companyId},${Number(row.assignment_id)},${Number(row.user_id)},${channel},${stage},${recipient},${status},${error},${Number(ctx.user.id)},NOW())
            ON DUPLICATE KEY UPDATE recipient=VALUES(recipient),status=VALUES(status),error_message=VALUES(error_message),sent_by=VALUES(sent_by),sent_at=NOW()`);
        }
      }
      await logAudit({ userId: Number(ctx.user.id), userEmail: ctx.user.email || null, action: "mandatory_training_reminders_sent",
        entityType: "mandatory_training_program", entityId: input.programId || 0, detailsJson: { channels: input.channels, summary } });
      return summary;
    }),
});
