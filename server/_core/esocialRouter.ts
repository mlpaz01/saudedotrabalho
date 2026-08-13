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
  await ensureColumn(db, "occupational_esocial_transmissions", "collaborator_id", "INT NULL");
  await ensureColumn(db, "occupational_esocial_transmissions", "event_date", "DATE NULL");
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
