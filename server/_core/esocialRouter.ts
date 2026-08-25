import { TRPCError } from "@trpc/server";
import { sql as drzSql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import { ensureOccupationalTables } from "./occupationalLifecycleRouter";
import { protectedProcedure, router } from "./trpc";

const GLOBAL_ROLES = ["super_admin", "admin_global"];
const COMPANY_ROLES = ["sesmt", "admin", "company_admin", ...GLOBAL_ROLES];
const EVENT_STATUSES = [
  "pendente_integracao",
  "necessita_correcao",
  "pronto_para_envio",
  "enviado",
  "processando",
  "aceito",
  "rejeitado",
] as const;

let tablesReady = false;

function rowsOf(result: any): any[] {
  return Array.isArray(result?.[0]) ? result[0] : Array.isArray(result) ? result : [];
}

function roleOf(ctx: any) {
  return String(ctx.user?.role || "");
}

function requireAccess(ctx: any) {
  if (!COMPANY_ROLES.includes(roleOf(ctx))) throw new TRPCError({ code: "FORBIDDEN" });
}

function isGlobal(ctx: any) {
  return GLOBAL_ROLES.includes(roleOf(ctx));
}

function companyOf(ctx: any, requested?: number | null) {
  if (isGlobal(ctx) && requested) return Number(requested);
  const companyId = Number(ctx.user?.companyId || 0);
  if (!companyId) throw new TRPCError({ code: "BAD_REQUEST", message: "Empresa não identificada." });
  return companyId;
}

async function ensureColumn(db: any, table: string, column: string, definition: string) {
  const found: any = await db.execute(drzSql.raw(`SHOW COLUMNS FROM \`${table}\` LIKE '${column.replace(/'/g, "''")}'`));
  if (!rowsOf(found).length) await db.execute(drzSql.raw(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`));
}

async function ensureEsocialTables() {
  if (tablesReady) return;
  await ensureOccupationalTables();
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS esocial_company_integrations (
    company_id INT NOT NULL PRIMARY KEY,
    environment VARCHAR(30) NOT NULL DEFAULT 'restricted',
    status VARCHAR(40) NOT NULL DEFAULT 'not_configured',
    employer_registration_type VARCHAR(10) NULL,
    employer_registration_number VARCHAR(30) NULL,
    certificate_alias VARCHAR(180) NULL,
    certificate_valid_until DATE NULL,
    proxy_company_cnpj VARCHAR(20) NULL,
    layout_version VARCHAR(60) NOT NULL DEFAULT 'S-1.3 NT 06/2026',
    notes TEXT NULL,
    last_validation_at DATETIME NULL,
    last_error TEXT NULL,
    updated_by INT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS esocial_transmission_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transmission_id BIGINT NOT NULL,
    company_id INT NOT NULL,
    previous_status VARCHAR(40) NULL,
    new_status VARCHAR(40) NOT NULL,
    detail TEXT NULL,
    protocol VARCHAR(120) NULL,
    receipt VARCHAR(120) NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_esocial_history_event (transmission_id, created_at),
    INDEX idx_esocial_history_company (company_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS occupational_s2221_exams (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    collaborator_id INT NOT NULL,
    exam_type VARCHAR(30) NOT NULL DEFAULT 'periodic',
    exam_date DATE NOT NULL,
    admission_date DATE NULL,
    next_due_date DATE NULL,
    laboratory_name VARCHAR(220) NOT NULL,
    laboratory_cnpj VARCHAR(14) NOT NULL,
    exam_code VARCHAR(11) NOT NULL,
    result_status VARCHAR(30) NOT NULL DEFAULT 'pending',
    doctor_name VARCHAR(220) NOT NULL,
    doctor_crm VARCHAR(30) NOT NULL,
    doctor_uf CHAR(2) NOT NULL,
    notes TEXT NULL,
    transmission_id BIGINT NULL,
    created_by INT NULL,
    updated_by INT NULL,
    archived_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_s2221_company_exam_code (company_id, exam_code),
    INDEX idx_s2221_company_employee (company_id, collaborator_id, exam_date),
    INDEX idx_s2221_company_due (company_id, next_due_date),
    INDEX idx_s2221_transmission (transmission_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await ensureColumn(db, "occupational_esocial_transmissions", "collaborator_id", "INT NULL");
  await ensureColumn(db, "occupational_esocial_transmissions", "event_date", "DATE NULL");
  await ensureColumn(db, "occupational_esocial_transmissions", "due_date", "DATE NULL");
  await ensureColumn(db, "occupational_esocial_transmissions", "attempt_count", "INT NOT NULL DEFAULT 0");
  await ensureColumn(db, "occupational_esocial_transmissions", "last_attempt_at", "DATETIME NULL");
  await ensureColumn(db, "occupational_esocial_transmissions", "last_response_at", "DATETIME NULL");
  await ensureColumn(db, "occupational_esocial_transmissions", "correction_guidance", "TEXT NULL");
  tablesReady = true;
}

function parseJson(value: unknown, fallback: any = null) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try { return JSON.parse(String(value)); } catch { return fallback; }
}

function digits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function validCpf(value: unknown) {
  const cpf = digits(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) sum += Number(cpf[i]) * (length + 1 - i);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

function validCnpj(value: unknown) {
  const cnpj = digits(value);
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const digit = (base: string, weights: number[]) => {
    const sum = base.split("").reduce((total, char, index) => total + Number(char) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = digit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = digit(cnpj.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${first}${second}` === cnpj.slice(12);
}

export function isValidS2221ExamCode(value: unknown) {
  return /^[A-Z]{2}\d{9}$/.test(String(value || "").trim().toUpperCase());
}

function s2221Validation(input: any, employee: any, employer: any = {}) {
  const issues: Array<{ field: string; message: string; action: string }> = [];
  if (!employee) issues.push({ field: "Funcionário", message: "Colaborador não localizado nesta empresa.", action: "Selecione novamente o colaborador." });
  if (!validCpf(employee?.cpf)) issues.push({ field: "CPF", message: "CPF ausente ou inválido.", action: "Corrija o CPF no cadastro do colaborador." });
  if (!String(employee?.employee_registration || "").trim()) issues.push({ field: "Matrícula eSocial", message: "Matrícula do vínculo não informada.", action: "Informe a matrícula no cadastro do colaborador antes da transmissão." });
  if (!validCnpj(employer?.cnpj)) issues.push({ field: "CNPJ do empregador", message: "CNPJ da empresa ausente ou inválido.", action: "Corrija o CNPJ no cadastro da empresa antes da transmissão." });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.examDate || ""))) issues.push({ field: "Data do exame", message: "Data de realização inválida.", action: "Informe a data no formato DD/MM/AAAA." });
  if (!validCnpj(input.laboratoryCnpj)) issues.push({ field: "CNPJ do laboratório", message: "CNPJ ausente ou inválido.", action: "Confira o cadastro do laboratório." });
  if (!isValidS2221ExamCode(input.examCode)) issues.push({ field: "Código do exame", message: "O código deve conter duas letras e nove números (AA999999999).", action: "Informe o código sequencial fornecido pelo laboratório." });
  if (!String(input.laboratoryName || "").trim()) issues.push({ field: "Laboratório", message: "Laboratório responsável não informado.", action: "Informe o laboratório que realizou o exame." });
  if (!String(input.doctorName || "").trim()) issues.push({ field: "Médico", message: "Médico responsável não informado.", action: "Informe o nome do médico." });
  if (!String(input.doctorCrm || "").trim()) issues.push({ field: "CRM", message: "CRM não informado.", action: "Informe o CRM do médico responsável." });
  if (!/^[A-Z]{2}$/.test(String(input.doctorUf || "").trim().toUpperCase())) issues.push({ field: "UF do CRM", message: "UF do CRM inválida.", action: "Selecione a UF do registro profissional." });
  if (input.examType === "pre_admission" && !input.admissionDate) issues.push({ field: "Admissão", message: "A data de admissão é necessária no exame pré-admissional.", action: "Informe a data de admissão para calcular o prazo do evento." });
  return issues;
}

function nextDueDate(examDate: string, examType: string) {
  if (examType !== "periodic") return null;
  const date = new Date(`${examDate}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 30);
  return date.toISOString().slice(0, 10);
}

function transmissionDueDate(examDate: string, examType: string, admissionDate?: string | null) {
  const base = new Date(`${examType === "pre_admission" && admissionDate ? admissionDate : examDate}T12:00:00Z`);
  if (examType === "pre_admission") base.setUTCDate(base.getUTCDate() + 15);
  else {
    base.setUTCMonth(base.getUTCMonth() + 1, 15);
  }
  return base.toISOString().slice(0, 10);
}

export function buildS2221Payload(input: any, employee: any, employer: any = {}) {
  const employerCnpj = digits(employer.cnpj);
  return {
    evtToxic: {
      ideEvento: { indRetif: 1, tpAmb: employer.environment === "production" ? 1 : 2, procEmi: 1, verProc: "Saude do Trabalho" },
      ideEmpregador: { tpInsc: 1, nrInsc: employerCnpj.slice(0, 8) },
      ideVinculo: { cpfTrab: digits(employee.cpf), matricula: String(employee.employee_registration || "") },
      toxicologico: {
        dtExame: input.examDate,
        cnpjLab: digits(input.laboratoryCnpj),
        codSeqExame: String(input.examCode || "").trim().toUpperCase(),
        nmMed: String(input.doctorName || "").trim(),
        nrCRM: String(input.doctorCrm || "").trim(),
        ufCRM: String(input.doctorUf || "").trim().toUpperCase(),
      },
    },
  };
}

function validationIssues(row: any) {
  const existing = parseJson(row.validation_json, []);
  const issues: Array<{ field: string; message: string; action: string }> = [];
  if (Array.isArray(existing)) {
    for (const item of existing) {
      if (!item) continue;
      issues.push({
        field: String(item.field || item.campo || "Evento"),
        message: String(item.message || item.mensagem || item),
        action: String(item.action || item.acao || "Revise o cadastro de origem antes do envio."),
      });
    }
  }
  if (!row.company_cnpj) issues.push({ field: "CNPJ", message: "CNPJ da empresa não informado.", action: "Acesse o cadastro da empresa e informe o CNPJ." });
  if (!row.collaborator_cpf) issues.push({ field: "CPF", message: "CPF do colaborador não informado.", action: "Acesse Colaboradores e complete o CPF." });
  if (!row.employee_registration) issues.push({ field: "Matrícula eSocial", message: "Matrícula do vínculo não informada.", action: "Informe a matrícula quando o evento for transmitido ao eSocial." });
  if (!row.payload_json) issues.push({ field: "Payload", message: "Evento ainda não possui estrutura de envio.", action: "Volte ao módulo de origem e gere novamente a conferência do evento." });
  return issues;
}

const listInput = z.object({
  companyId: z.number().int().positive().optional(),
  status: z.enum(EVENT_STATUSES).optional(),
  eventCode: z.string().max(20).optional(),
  limit: z.number().int().min(1).max(1000).default(250),
}).default({ limit: 250 });

export const esocialRouter = router({
  context: protectedProcedure.query(async ({ ctx }) => {
    requireAccess(ctx);
    await ensureEsocialTables();
    return { global: isGlobal(ctx), companyId: Number(ctx.user?.companyId || 0), layoutVersion: "S-1.3 NT 06/2026", officialTransportAvailable: false };
  }),

  companies: protectedProcedure.query(async ({ ctx }) => {
    requireAccess(ctx);
    await ensureEsocialTables();
    const db = await getDb();
    if (!db) return [];
    const companyId = isGlobal(ctx) ? 0 : companyOf(ctx);
    const result: any = await db.execute(drzSql`SELECT c.id,c.name,c.cnpj,
      COALESCE(i.status,'not_configured') integration_status,i.environment,i.layout_version,
      i.certificate_alias,i.certificate_valid_until,i.last_validation_at,i.last_error
      FROM companies c LEFT JOIN esocial_company_integrations i ON i.company_id=c.id
      WHERE (${companyId}=0 OR c.id=${companyId}) AND c.is_active=1 AND TRIM(COALESCE(c.name,''))<>'' ORDER BY c.name`);
    return rowsOf(result);
  }),

  getConfiguration: protectedProcedure.input(z.object({ companyId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
    requireAccess(ctx);
    await ensureEsocialTables();
    const db = await getDb();
    if (!db) return null;
    const companyId = companyOf(ctx, input.companyId);
    const result: any = await db.execute(drzSql`SELECT c.id company_id,c.name company_name,c.cnpj,i.* FROM companies c LEFT JOIN esocial_company_integrations i ON i.company_id=c.id WHERE c.id=${companyId} LIMIT 1`);
    return rowsOf(result)[0] || null;
  }),

  saveConfiguration: protectedProcedure.input(z.object({
    companyId: z.number().int().positive(),
    environment: z.enum(["restricted", "production"]),
    status: z.enum(["not_configured", "configuration_pending", "ready_for_tests", "active", "blocked"]),
    employerRegistrationType: z.enum(["1", "2"]).optional(),
    employerRegistrationNumber: z.string().max(30).optional(),
    certificateAlias: z.string().max(180).optional(),
    certificateValidUntil: z.string().date().optional(),
    proxyCompanyCnpj: z.string().max(20).optional(),
    notes: z.string().max(5000).optional(),
  })).mutation(async ({ ctx, input }) => {
    requireAccess(ctx);
    if (!isGlobal(ctx)) throw new TRPCError({ code: "FORBIDDEN", message: "A conexão governamental é configurada pelo SuperAdmin Global." });
    await ensureEsocialTables();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.execute(drzSql`INSERT INTO esocial_company_integrations
      (company_id,environment,status,employer_registration_type,employer_registration_number,certificate_alias,certificate_valid_until,proxy_company_cnpj,layout_version,notes,last_validation_at,last_error,updated_by)
      VALUES (${input.companyId},${input.environment},${input.status},${input.employerRegistrationType || null},${input.employerRegistrationNumber || null},${input.certificateAlias || null},${input.certificateValidUntil || null},${input.proxyCompanyCnpj || null},'S-1.3 NT 06/2026',${input.notes || null},NOW(),NULL,${Number(ctx.user.id)})
      ON DUPLICATE KEY UPDATE environment=VALUES(environment),status=VALUES(status),employer_registration_type=VALUES(employer_registration_type),employer_registration_number=VALUES(employer_registration_number),certificate_alias=VALUES(certificate_alias),certificate_valid_until=VALUES(certificate_valid_until),proxy_company_cnpj=VALUES(proxy_company_cnpj),layout_version=VALUES(layout_version),notes=VALUES(notes),last_validation_at=NOW(),last_error=NULL,updated_by=VALUES(updated_by)`);
    return { ok: true };
  }),

  summary: protectedProcedure.input(z.object({ companyId: z.number().int().positive().optional() }).default({})).query(async ({ ctx, input }) => {
    requireAccess(ctx);
    await ensureEsocialTables();
    const db = await getDb();
    if (!db) return {};
    const companyId = companyOf(ctx, input.companyId);
    const result: any = await db.execute(drzSql`SELECT COUNT(*) total,
      SUM(status='pronto_para_envio') ready_count,SUM(status IN ('pendente_integracao','necessita_correcao')) pending_count,
      SUM(status IN ('enviado','processando')) processing_count,SUM(status='aceito') accepted_count,SUM(status='rejeitado') rejected_count
      FROM occupational_esocial_transmissions WHERE company_id=${companyId}`);
    return rowsOf(result)[0] || {};
  }),

  events: protectedProcedure.input(listInput).query(async ({ ctx, input }) => {
    requireAccess(ctx);
    await ensureEsocialTables();
    const db = await getDb();
    if (!db) return [];
    const companyId = companyOf(ctx, input.companyId);
    const status = input.status || "";
    const eventCode = input.eventCode || "";
    const safeEventCode = eventCode.replace(/[^A-Za-z0-9-]/g, "");
    const safeStatus = status.replace(/[^a-z_]/g, "");
    const result: any = await db.execute(drzSql.raw(`SELECT t.*,c.name company_name,c.cnpj company_cnpj,
      COALESCE(t.collaborator_id,cat.collaborator_id) resolved_collaborator_id,
      u.name collaborator_name,u.cpf collaborator_cpf,u.employee_registration,
      cat.accident_at,cat.validation_status,cat.validation_json
      FROM occupational_esocial_transmissions t
      JOIN companies c ON c.id=t.company_id
      LEFT JOIN occupational_cat_records cat ON t.entity_type='cat' AND cat.id=t.entity_id AND cat.company_id=t.company_id
      LEFT JOIN users u ON u.id=COALESCE(t.collaborator_id,cat.collaborator_id) AND u.company_id=t.company_id
      WHERE t.company_id=${companyId}${safeStatus ? ` AND t.status='${safeStatus}'` : ""}${safeEventCode ? ` AND t.event_code='${safeEventCode}'` : ""}
      ORDER BY t.updated_at DESC,t.id DESC LIMIT ${Number(input.limit)}`));
    return rowsOf(result).map(row => ({ ...row, issues: validationIssues(row), payload: parseJson(row.payload_json), response: parseJson(row.response_json) }));
  }),

  s2221Employees: protectedProcedure.input(z.object({ companyId: z.number().int().positive().optional(), search: z.string().max(120).optional() }).default({})).query(async ({ ctx, input }) => {
    requireAccess(ctx);
    await ensureEsocialTables();
    const db = await getDb();
    if (!db) return [];
    const companyId = companyOf(ctx, input.companyId);
    const search = String(input.search || "").trim();
    const like = `%${search}%`;
    const result: any = await db.execute(drzSql`SELECT u.id,u.name,u.cpf,u.employee_registration,u.position,
      b.name branch_name,s.name sector_name
      FROM users u
      LEFT JOIN branches b ON b.id=u.branch_id AND b.company_id=u.company_id
      LEFT JOIN sectors s ON s.id=u.sector_id AND s.company_id=u.company_id
      WHERE u.company_id=${companyId} AND u.is_active=1
        AND (${search}='' OR u.name LIKE ${like} OR u.cpf LIKE ${like} OR u.employee_registration LIKE ${like})
      ORDER BY u.name LIMIT 300`);
    return rowsOf(result);
  }),

  s2221Summary: protectedProcedure.input(z.object({ companyId: z.number().int().positive().optional() }).default({})).query(async ({ ctx, input }) => {
    requireAccess(ctx);
    await ensureEsocialTables();
    const db = await getDb();
    if (!db) return {};
    const companyId = companyOf(ctx, input.companyId);
    const result: any = await db.execute(drzSql`SELECT
      (SELECT COUNT(DISTINCT u.id) FROM users u WHERE u.company_id=${companyId} AND u.is_active=1 AND LOWER(COALESCE(u.position,'')) LIKE '%motorista%') total_drivers,
      COUNT(DISTINCT CASE WHEN x.next_due_date>=CURDATE() AND x.result_status IN ('negative','positive','inconclusive') THEN x.collaborator_id END) up_to_date,
      COUNT(DISTINCT CASE WHEN x.result_status='pending' THEN x.collaborator_id END) awaiting_result,
      COUNT(DISTINCT CASE WHEN t.status IN ('pendente_integracao','necessita_correcao','pronto_para_envio') THEN x.collaborator_id END) pending_send,
      COUNT(DISTINCT CASE WHEN t.status IN ('enviado','processando','aceito') THEN x.collaborator_id END) sent,
      COUNT(DISTINCT CASE WHEN t.status='rejeitado' THEN x.collaborator_id END) rejected
      FROM occupational_s2221_exams x
      LEFT JOIN occupational_esocial_transmissions t ON t.id=x.transmission_id AND t.company_id=x.company_id
      WHERE x.company_id=${companyId} AND x.archived_at IS NULL`);
    const row = rowsOf(result)[0] || {};
    const total = Number(row.total_drivers || 0);
    const covered = Number(row.up_to_date || 0) + Number(row.awaiting_result || 0);
    return { ...row, pending: Math.max(0, total - covered) };
  }),

  s2221List: protectedProcedure.input(z.object({
    companyId: z.number().int().positive().optional(),
    status: z.enum(["all", "up_to_date", "pending", "awaiting_result", "pending_send", "sent", "rejected"]).default("all"),
    search: z.string().max(120).optional(),
  }).default({ status: "all" })).query(async ({ ctx, input }) => {
    requireAccess(ctx);
    await ensureEsocialTables();
    const db = await getDb();
    if (!db) return [];
    const companyId = companyOf(ctx, input.companyId);
    const search = String(input.search || "").trim();
    const like = `%${search}%`;
    if (input.status === "pending") {
      const pendingResult: any = await db.execute(drzSql`SELECT NULL id,u.id collaborator_id,u.name collaborator_name,u.cpf,u.employee_registration,u.position,
        b.name branch_name,s.name sector_name,NULL exam_code,NULL exam_date,NULL laboratory_name,'missing' result_status,NULL next_due_date,NULL transmission_status,
        'Nenhum exame toxicológico vigente foi localizado para este motorista.' error_message
        FROM users u
        LEFT JOIN branches b ON b.id=u.branch_id AND b.company_id=u.company_id
        LEFT JOIN sectors s ON s.id=u.sector_id AND s.company_id=u.company_id
        WHERE u.company_id=${companyId} AND u.is_active=1 AND LOWER(COALESCE(u.position,'')) LIKE '%motorista%'
          AND (${search}='' OR u.name LIKE ${like} OR u.cpf LIKE ${like} OR u.employee_registration LIKE ${like})
          AND NOT EXISTS (SELECT 1 FROM occupational_s2221_exams x WHERE x.company_id=u.company_id AND x.collaborator_id=u.id AND x.archived_at IS NULL AND x.next_due_date>=CURDATE())
        ORDER BY u.name LIMIT 500`);
      return rowsOf(pendingResult);
    }
    const statusClause: Record<string, string> = {
      up_to_date: " AND x.next_due_date>=CURDATE() AND x.result_status IN ('negative','positive','inconclusive')",
      awaiting_result: " AND x.result_status='pending'",
      pending_send: " AND t.status IN ('pendente_integracao','necessita_correcao','pronto_para_envio')",
      sent: " AND t.status IN ('enviado','processando','aceito')",
      rejected: " AND t.status='rejeitado'",
    };
    const whereStatus = statusClause[input.status] || "";
    const result: any = await db.execute(drzSql.raw(`SELECT x.*,u.name collaborator_name,u.cpf,u.employee_registration,u.position,
      b.name branch_name,s.name sector_name,t.status transmission_status,t.protocol,t.receipt,t.error_message,t.due_date,t.last_attempt_at,t.last_response_at,t.response_json,
      DATEDIFF(x.next_due_date,CURDATE()) days_to_due
      FROM occupational_s2221_exams x
      JOIN users u ON u.id=x.collaborator_id AND u.company_id=x.company_id
      LEFT JOIN branches b ON b.id=u.branch_id AND b.company_id=u.company_id
      LEFT JOIN sectors s ON s.id=u.sector_id AND s.company_id=u.company_id
      LEFT JOIN occupational_esocial_transmissions t ON t.id=x.transmission_id AND t.company_id=x.company_id
      WHERE x.company_id=${companyId} AND x.archived_at IS NULL${whereStatus}
        ${search ? `AND (u.name LIKE ${JSON.stringify(like)} OR u.cpf LIKE ${JSON.stringify(like)} OR x.exam_code LIKE ${JSON.stringify(like)})` : ""}
      ORDER BY x.exam_date DESC,x.id DESC LIMIT 500`));
    return rowsOf(result);
  }),

  saveS2221: protectedProcedure.input(z.object({
    companyId: z.number().int().positive().optional(),
    id: z.number().int().positive().optional(),
    collaboratorId: z.number().int().positive(),
    examType: z.enum(["pre_admission", "periodic", "dismissal", "other"]),
    examDate: z.string().date(),
    admissionDate: z.string().date().nullable().optional(),
    laboratoryName: z.string().min(2).max(220),
    laboratoryCnpj: z.string().min(14).max(20),
    examCode: z.string().min(11).max(11),
    resultStatus: z.enum(["pending", "negative", "positive", "inconclusive"]),
    doctorName: z.string().min(2).max(220),
    doctorCrm: z.string().min(2).max(30),
    doctorUf: z.string().length(2),
    notes: z.string().max(10000).optional(),
  })).mutation(async ({ ctx, input }) => {
    requireAccess(ctx);
    await ensureEsocialTables();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const companyId = companyOf(ctx, input.companyId);
    const employeeResult: any = await db.execute(drzSql`SELECT id,name,cpf,employee_registration FROM users WHERE id=${input.collaboratorId} AND company_id=${companyId} AND is_active=1 LIMIT 1`);
    const employerResult: any = await db.execute(drzSql`SELECT c.cnpj,COALESCE(i.environment,'restricted') environment FROM companies c LEFT JOIN esocial_company_integrations i ON i.company_id=c.id WHERE c.id=${companyId} LIMIT 1`);
    const employee = rowsOf(employeeResult)[0];
    const employer = rowsOf(employerResult)[0] || {};
    const issues = s2221Validation(input, employee, employer);
    const payload = buildS2221Payload(input, employee || {}, employer);
    const status = issues.length ? "necessita_correcao" : "pronto_para_envio";
    const payloadJson = JSON.stringify(payload);
    const due = nextDueDate(input.examDate, input.examType);
    const eventDue = transmissionDueDate(input.examDate, input.examType, input.admissionDate);
    let examId = Number(input.id || 0);
    let transmissionId = 0;
    if (examId) {
      const existing: any = await db.execute(drzSql`SELECT transmission_id FROM occupational_s2221_exams WHERE id=${examId} AND company_id=${companyId} AND archived_at IS NULL LIMIT 1`);
      const row = rowsOf(existing)[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      transmissionId = Number(row.transmission_id || 0);
      await db.execute(drzSql`UPDATE occupational_s2221_exams SET collaborator_id=${input.collaboratorId},exam_type=${input.examType},exam_date=${input.examDate},admission_date=${input.admissionDate || null},next_due_date=${due},laboratory_name=${input.laboratoryName.trim()},laboratory_cnpj=${digits(input.laboratoryCnpj)},exam_code=${input.examCode.trim().toUpperCase()},result_status=${input.resultStatus},doctor_name=${input.doctorName.trim()},doctor_crm=${input.doctorCrm.trim()},doctor_uf=${input.doctorUf.toUpperCase()},notes=${input.notes || null},updated_by=${Number(ctx.user.id)} WHERE id=${examId} AND company_id=${companyId}`);
    } else {
      const inserted: any = await db.execute(drzSql`INSERT INTO occupational_s2221_exams (company_id,collaborator_id,exam_type,exam_date,admission_date,next_due_date,laboratory_name,laboratory_cnpj,exam_code,result_status,doctor_name,doctor_crm,doctor_uf,notes,created_by,updated_by) VALUES (${companyId},${input.collaboratorId},${input.examType},${input.examDate},${input.admissionDate || null},${due},${input.laboratoryName.trim()},${digits(input.laboratoryCnpj)},${input.examCode.trim().toUpperCase()},${input.resultStatus},${input.doctorName.trim()},${input.doctorCrm.trim()},${input.doctorUf.toUpperCase()},${input.notes || null},${Number(ctx.user.id)},${Number(ctx.user.id)})`);
      examId = Number((inserted as any)?.[0]?.insertId || (inserted as any)?.insertId || 0);
    }
    if (transmissionId) {
      await db.execute(drzSql`UPDATE occupational_esocial_transmissions SET collaborator_id=${input.collaboratorId},event_date=${input.examDate},due_date=${eventDue},status=${status},payload_json=${payloadJson},correction_guidance=${issues.map(item => `${item.field}: ${item.action}`).join("\n") || null},updated_at=NOW() WHERE id=${transmissionId} AND company_id=${companyId}`);
    } else {
      const transmission: any = await db.execute(drzSql`INSERT INTO occupational_esocial_transmissions (company_id,entity_type,entity_id,collaborator_id,event_code,layout_version,status,event_date,due_date,payload_json,correction_guidance,requested_by) VALUES (${companyId},'s2221',${examId},${input.collaboratorId},'S-2221','S-1.3 NT 06/2026',${status},${input.examDate},${eventDue},${payloadJson},${issues.map(item => `${item.field}: ${item.action}`).join("\n") || null},${Number(ctx.user.id)})`);
      transmissionId = Number((transmission as any)?.[0]?.insertId || (transmission as any)?.insertId || 0);
      await db.execute(drzSql`UPDATE occupational_s2221_exams SET transmission_id=${transmissionId} WHERE id=${examId} AND company_id=${companyId}`);
    }
    await db.execute(drzSql`INSERT INTO esocial_transmission_history (transmission_id,company_id,previous_status,new_status,detail,created_by) VALUES (${transmissionId},${companyId},NULL,${status},${`S-2221 salvo. Prazo de transmissão calculado: ${eventDue}. Resultado clínico mantido apenas no controle interno.`},${Number(ctx.user.id)})`);
    return { ok: true, id: examId, transmissionId, status, issues, transmissionDueDate: eventDue };
  }),

  archiveS2221: protectedProcedure.input(z.object({ id: z.number().int().positive(), companyId: z.number().int().positive().optional(), reason: z.string().min(5).max(1000) })).mutation(async ({ ctx, input }) => {
    requireAccess(ctx);
    await ensureEsocialTables();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const companyId = companyOf(ctx, input.companyId);
    const result: any = await db.execute(drzSql`SELECT transmission_id FROM occupational_s2221_exams WHERE id=${input.id} AND company_id=${companyId} AND archived_at IS NULL LIMIT 1`);
    const row = rowsOf(result)[0];
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    await db.execute(drzSql`UPDATE occupational_s2221_exams SET archived_at=NOW(),notes=CONCAT_WS('\n',notes,${`Arquivado: ${input.reason}`}),updated_by=${Number(ctx.user.id)} WHERE id=${input.id} AND company_id=${companyId}`);
    if (row.transmission_id) await db.execute(drzSql`INSERT INTO esocial_transmission_history (transmission_id,company_id,previous_status,new_status,detail,created_by) SELECT id,company_id,status,status,${`Registro S-2221 arquivado: ${input.reason}`},${Number(ctx.user.id)} FROM occupational_esocial_transmissions WHERE id=${Number(row.transmission_id)} AND company_id=${companyId}`);
    return { ok: true };
  }),

  eventDetails: protectedProcedure.input(z.object({ id: z.number().int().positive(), companyId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
    requireAccess(ctx);
    await ensureEsocialTables();
    const db = await getDb();
    if (!db) return null;
    const companyId = companyOf(ctx, input.companyId);
    const result: any = await db.execute(drzSql`SELECT t.*,c.name company_name,c.cnpj company_cnpj,
      COALESCE(t.collaborator_id,cat.collaborator_id) resolved_collaborator_id,u.name collaborator_name,u.cpf collaborator_cpf,u.employee_registration,
      cat.validation_status,cat.validation_json FROM occupational_esocial_transmissions t JOIN companies c ON c.id=t.company_id
      LEFT JOIN occupational_cat_records cat ON t.entity_type='cat' AND cat.id=t.entity_id AND cat.company_id=t.company_id
      LEFT JOIN users u ON u.id=COALESCE(t.collaborator_id,cat.collaborator_id) AND u.company_id=t.company_id
      WHERE t.id=${input.id} AND t.company_id=${companyId} LIMIT 1`);
    const row = rowsOf(result)[0];
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    const history: any = await db.execute(drzSql`SELECT h.*,u.name user_name FROM esocial_transmission_history h LEFT JOIN users u ON u.id=h.created_by WHERE h.transmission_id=${input.id} AND h.company_id=${companyId} ORDER BY h.id DESC`);
    return { ...row, issues: validationIssues(row), payload: parseJson(row.payload_json), response: parseJson(row.response_json), history: rowsOf(history) };
  }),

  validateEvent: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    requireAccess(ctx);
    await ensureEsocialTables();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const companyId = companyOf(ctx);
    const result: any = await db.execute(drzSql`SELECT t.*,c.cnpj company_cnpj,cat.collaborator_id,cat.validation_json,u.cpf collaborator_cpf,u.employee_registration
      FROM occupational_esocial_transmissions t JOIN companies c ON c.id=t.company_id
      LEFT JOIN occupational_cat_records cat ON t.entity_type='cat' AND cat.id=t.entity_id
      LEFT JOIN users u ON u.id=COALESCE(t.collaborator_id,cat.collaborator_id)
      WHERE t.id=${input.id} AND t.company_id=${companyId} LIMIT 1`);
    const row = rowsOf(result)[0];
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    const issues = validationIssues(row);
    const previous = String(row.status || "pendente_integracao");
    const next = issues.length ? "necessita_correcao" : "pronto_para_envio";
    const guidance = issues.map(item => `${item.field}: ${item.action}`).join("\n") || null;
    await db.execute(drzSql`UPDATE occupational_esocial_transmissions SET status=${next},correction_guidance=${guidance} WHERE id=${input.id} AND company_id=${companyId}`);
    await db.execute(drzSql`INSERT INTO esocial_transmission_history (transmission_id,company_id,previous_status,new_status,detail,created_by) VALUES (${input.id},${companyId},${previous},${next},${issues.length ? `${issues.length} pendência(s) identificada(s).` : "Validação cadastral concluída; evento pronto para a futura camada de transmissão."},${Number(ctx.user.id)})`);
    return { ok: true, status: next, issues };
  }),

  prepareRetry: protectedProcedure.input(z.object({ id: z.number().int().positive(), note: z.string().min(5).max(2000) })).mutation(async ({ ctx, input }) => {
    requireAccess(ctx);
    await ensureEsocialTables();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const companyId = companyOf(ctx);
    const result: any = await db.execute(drzSql`SELECT status FROM occupational_esocial_transmissions WHERE id=${input.id} AND company_id=${companyId} LIMIT 1`);
    const row = rowsOf(result)[0];
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    if (!["rejeitado", "necessita_correcao"].includes(String(row.status))) throw new TRPCError({ code: "BAD_REQUEST", message: "Somente eventos rejeitados ou com correção podem ser preparados novamente." });
    await db.execute(drzSql`UPDATE occupational_esocial_transmissions SET status='pendente_integracao',attempt_count=attempt_count+1,last_attempt_at=NOW(),correction_guidance=${input.note} WHERE id=${input.id} AND company_id=${companyId}`);
    await db.execute(drzSql`INSERT INTO esocial_transmission_history (transmission_id,company_id,previous_status,new_status,detail,created_by) VALUES (${input.id},${companyId},${String(row.status)},'pendente_integracao',${input.note},${Number(ctx.user.id)})`);
    return { ok: true };
  }),
});
