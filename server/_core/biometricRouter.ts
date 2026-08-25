import { createHash, randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { sql as drzSql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import { protectedProcedure, router } from "./trpc";

const GLOBAL_ROLES = ["super_admin", "admin_global"];
const COMPANY_ROLES = ["sesmt", "admin", "rh", "company_admin", ...GLOBAL_ROLES];
let ready = false;

function rowsOf(result: any): any[] {
  return Array.isArray(result?.[0]) ? result[0] : Array.isArray(result) ? result : [];
}

function requireAccess(ctx: any) {
  if (!COMPANY_ROLES.includes(String(ctx.user?.role || ""))) throw new TRPCError({ code: "FORBIDDEN" });
}

function isGlobal(ctx: any) {
  return GLOBAL_ROLES.includes(String(ctx.user?.role || ""));
}

function companyOf(ctx: any, requested?: number) {
  if (isGlobal(ctx) && requested) return Number(requested);
  const companyId = Number(ctx.user?.companyId || 0);
  if (!companyId) throw new TRPCError({ code: "BAD_REQUEST", message: "Empresa não identificada." });
  return companyId;
}

async function ensureTables() {
  if (ready) return;
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS biometric_company_settings (
    company_id INT PRIMARY KEY,
    enabled TINYINT(1) NOT NULL DEFAULT 0,
    legal_basis VARCHAR(220) NULL,
    purposes_json JSON NULL,
    retention_days INT NOT NULL DEFAULT 1825,
    policy_version VARCHAR(80) NULL,
    controller_name VARCHAR(220) NULL,
    dpo_contact VARCHAR(220) NULL,
    reviewed_by INT NULL,
    reviewed_at DATETIME NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS biometric_devices (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    identifier VARCHAR(120) NOT NULL,
    name VARCHAR(180) NOT NULL,
    serial_number VARCHAR(180) NULL,
    provider VARCHAR(120) NULL,
    branch_id INT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    allowed_roles_json JSON NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_biometric_device (company_id, identifier),
    INDEX idx_biometric_device_company (company_id, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS biometric_enrollments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    collaborator_id INT NOT NULL,
    provider_template_ref VARCHAR(255) NOT NULL,
    template_hash CHAR(64) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    purpose VARCHAR(220) NOT NULL,
    legal_basis VARCHAR(220) NOT NULL,
    authorized_by INT NULL,
    enrolled_by INT NOT NULL,
    device_id BIGINT NULL,
    enrolled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at DATETIME NULL,
    revocation_reason TEXT NULL,
    retention_until DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_biometric_enrollment_employee (company_id, collaborator_id, status),
    INDEX idx_biometric_enrollment_device (device_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS biometric_evidence (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    collaborator_id INT NOT NULL,
    enrollment_id BIGINT NOT NULL,
    device_id BIGINT NULL,
    process_type VARCHAR(40) NOT NULL,
    process_reference VARCHAR(180) NOT NULL,
    action_label VARCHAR(180) NOT NULL,
    evidence_hash CHAR(64) NOT NULL,
    confirmation_text TEXT NOT NULL,
    occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    operator_user_id INT NOT NULL,
    metadata_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_biometric_evidence_employee (company_id, collaborator_id, occurred_at),
    INDEX idx_biometric_evidence_process (company_id, process_type, process_reference)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS biometric_audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    actor_user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(60) NOT NULL,
    entity_id BIGINT NULL,
    detail_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_biometric_audit_company (company_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  ready = true;
}

async function audit(db: any, companyId: number, actorId: number, action: string, entityType: string, entityId: number | null, detail: any) {
  await db.execute(drzSql`INSERT INTO biometric_audit_log (company_id,actor_user_id,action,entity_type,entity_id,detail_json) VALUES (${companyId},${actorId},${action},${entityType},${entityId},${JSON.stringify(detail || {})})`);
}

export const biometricRouter = router({
  context: protectedProcedure.query(async ({ ctx }) => {
    requireAccess(ctx);
    await ensureTables();
    const db = await getDb();
    const companyId = Number(ctx.user?.companyId || 0);
    let companies: any[] = [];
    if (isGlobal(ctx) && db) {
      const result: any = await db.execute(drzSql`SELECT id,name,cnpj FROM companies WHERE is_active=1 ORDER BY name`);
      companies = rowsOf(result);
    }
    return { global: isGlobal(ctx), companyId, companies };
  }),

  dashboard: protectedProcedure.input(z.object({ companyId: z.number().int().positive().optional() }).default({})).query(async ({ ctx, input }) => {
    requireAccess(ctx);
    await ensureTables();
    const db = await getDb();
    if (!db) return null;
    const companyId = companyOf(ctx, input.companyId);
    const settingsResult: any = await db.execute(drzSql`SELECT * FROM biometric_company_settings WHERE company_id=${companyId} LIMIT 1`);
    const countsResult: any = await db.execute(drzSql`SELECT
      (SELECT COUNT(*) FROM biometric_devices WHERE company_id=${companyId} AND status='active') active_devices,
      (SELECT COUNT(*) FROM biometric_enrollments WHERE company_id=${companyId} AND status='active') active_enrollments,
      (SELECT COUNT(*) FROM biometric_evidence WHERE company_id=${companyId}) evidences,
      (SELECT COUNT(*) FROM biometric_enrollments WHERE company_id=${companyId} AND retention_until<CURDATE() AND status='active') retention_reviews`);
    return { settings: rowsOf(settingsResult)[0] || null, counts: rowsOf(countsResult)[0] || {} };
  }),

  saveSettings: protectedProcedure.input(z.object({
    companyId: z.number().int().positive().optional(), enabled: z.boolean(), legalBasis: z.string().min(3).max(220),
    purposes: z.array(z.string().min(2).max(80)).min(1), retentionDays: z.number().int().min(1).max(36500),
    policyVersion: z.string().min(1).max(80), controllerName: z.string().min(2).max(220), dpoContact: z.string().min(3).max(220),
  })).mutation(async ({ ctx, input }) => {
    requireAccess(ctx);
    await ensureTables();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const companyId = companyOf(ctx, input.companyId);
    const currentResult: any = await db.execute(drzSql`SELECT enabled FROM biometric_company_settings WHERE company_id=${companyId} LIMIT 1`);
    const currentEnabled = Boolean(Number(rowsOf(currentResult)[0]?.enabled || 0));
    if (!isGlobal(ctx) && input.enabled !== currentEnabled) {
      throw new TRPCError({ code: "FORBIDDEN", message: "A ativação do módulo PLUS é realizada pelo SuperAdmin conforme a contratação da empresa." });
    }
    await db.execute(drzSql`INSERT INTO biometric_company_settings (company_id,enabled,legal_basis,purposes_json,retention_days,policy_version,controller_name,dpo_contact,reviewed_by,reviewed_at) VALUES (${companyId},${input.enabled ? 1 : 0},${input.legalBasis},${JSON.stringify(input.purposes)},${input.retentionDays},${input.policyVersion},${input.controllerName},${input.dpoContact},${Number(ctx.user.id)},NOW()) ON DUPLICATE KEY UPDATE enabled=VALUES(enabled),legal_basis=VALUES(legal_basis),purposes_json=VALUES(purposes_json),retention_days=VALUES(retention_days),policy_version=VALUES(policy_version),controller_name=VALUES(controller_name),dpo_contact=VALUES(dpo_contact),reviewed_by=VALUES(reviewed_by),reviewed_at=NOW()`);
    await audit(db, companyId, Number(ctx.user.id), "settings_updated", "settings", companyId, { enabled: input.enabled, policyVersion: input.policyVersion, purposes: input.purposes });
    return { ok: true };
  }),

  employees: protectedProcedure.input(z.object({ companyId: z.number().int().positive().optional(), search: z.string().max(120).optional() }).default({})).query(async ({ ctx, input }) => {
    requireAccess(ctx);
    await ensureTables();
    const db = await getDb();
    if (!db) return [];
    const companyId = companyOf(ctx, input.companyId);
    const search = String(input.search || "").trim();
    const like = `%${search}%`;
    const result: any = await db.execute(drzSql`SELECT u.id,u.name,u.cpf,u.employee_registration,u.position,b.name branch_name,s.name sector_name FROM users u LEFT JOIN branches b ON b.id=u.branch_id AND b.company_id=u.company_id LEFT JOIN sectors s ON s.id=u.sector_id AND s.company_id=u.company_id WHERE u.company_id=${companyId} AND u.is_active=1 AND (${search}='' OR u.name LIKE ${like} OR u.cpf LIKE ${like} OR u.employee_registration LIKE ${like}) ORDER BY u.name LIMIT 300`);
    return rowsOf(result);
  }),

  branches: protectedProcedure.input(z.object({ companyId: z.number().int().positive().optional() }).default({})).query(async ({ ctx, input }) => {
    requireAccess(ctx);
    await ensureTables();
    const db = await getDb();
    if (!db) return [];
    const companyId = companyOf(ctx, input.companyId);
    const result: any = await db.execute(drzSql`SELECT id,name FROM branches WHERE company_id=${companyId} AND is_active=1 ORDER BY name`);
    return rowsOf(result);
  }),

  devices: protectedProcedure.input(z.object({ companyId: z.number().int().positive().optional() }).default({})).query(async ({ ctx, input }) => {
    requireAccess(ctx);
    await ensureTables();
    const db = await getDb();
    if (!db) return [];
    const companyId = companyOf(ctx, input.companyId);
    const result: any = await db.execute(drzSql`SELECT d.*,b.name branch_name,u.name created_by_name FROM biometric_devices d LEFT JOIN branches b ON b.id=d.branch_id AND b.company_id=d.company_id LEFT JOIN users u ON u.id=d.created_by WHERE d.company_id=${companyId} ORDER BY d.status='active' DESC,d.name`);
    return rowsOf(result);
  }),

  saveDevice: protectedProcedure.input(z.object({
    companyId: z.number().int().positive().optional(), id: z.number().int().positive().optional(), identifier: z.string().min(2).max(120),
    name: z.string().min(2).max(180), serialNumber: z.string().max(180).optional(), provider: z.string().max(120).optional(),
    branchId: z.number().int().positive().nullable().optional(), status: z.enum(["active", "inactive", "maintenance"]), allowedRoles: z.array(z.string().max(40)).default([]),
  })).mutation(async ({ ctx, input }) => {
    requireAccess(ctx);
    await ensureTables();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const companyId = companyOf(ctx, input.companyId);
    if (input.branchId) {
      const branchResult: any = await db.execute(drzSql`SELECT id FROM branches WHERE id=${input.branchId} AND company_id=${companyId} AND is_active=1 LIMIT 1`);
      if (!rowsOf(branchResult)[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "Unidade não localizada nesta empresa." });
    }
    let id = Number(input.id || 0);
    if (id) await db.execute(drzSql`UPDATE biometric_devices SET identifier=${input.identifier},name=${input.name},serial_number=${input.serialNumber || null},provider=${input.provider || null},branch_id=${input.branchId || null},status=${input.status},allowed_roles_json=${JSON.stringify(input.allowedRoles)} WHERE id=${id} AND company_id=${companyId}`);
    else {
      const result: any = await db.execute(drzSql`INSERT INTO biometric_devices (company_id,identifier,name,serial_number,provider,branch_id,status,allowed_roles_json,created_by) VALUES (${companyId},${input.identifier},${input.name},${input.serialNumber || null},${input.provider || null},${input.branchId || null},${input.status},${JSON.stringify(input.allowedRoles)},${Number(ctx.user.id)})`);
      id = Number(result?.[0]?.insertId || result?.insertId || 0);
    }
    await audit(db, companyId, Number(ctx.user.id), input.id ? "device_updated" : "device_created", "device", id, { identifier: input.identifier, status: input.status });
    return { ok: true, id };
  }),

  enrollments: protectedProcedure.input(z.object({ companyId: z.number().int().positive().optional(), search: z.string().max(120).optional() }).default({})).query(async ({ ctx, input }) => {
    requireAccess(ctx);
    await ensureTables();
    const db = await getDb();
    if (!db) return [];
    const companyId = companyOf(ctx, input.companyId);
    const search = String(input.search || "").trim();
    const like = `%${search}%`;
    const result: any = await db.execute(drzSql`SELECT e.*,u.name collaborator_name,u.cpf,u.employee_registration,d.name device_name,enroller.name enrolled_by_name FROM biometric_enrollments e JOIN users u ON u.id=e.collaborator_id AND u.company_id=e.company_id LEFT JOIN biometric_devices d ON d.id=e.device_id LEFT JOIN users enroller ON enroller.id=e.enrolled_by WHERE e.company_id=${companyId} AND (${search}='' OR u.name LIKE ${like} OR u.cpf LIKE ${like}) ORDER BY e.enrolled_at DESC LIMIT 500`);
    return rowsOf(result);
  }),

  createEnrollment: protectedProcedure.input(z.object({
    companyId: z.number().int().positive().optional(), collaboratorId: z.number().int().positive(), deviceId: z.number().int().positive().optional(),
    providerTemplateRef: z.string().min(8).max(255).optional(), purpose: z.string().min(3).max(220), legalBasis: z.string().min(3).max(220), retentionUntil: z.string().date().optional(),
  })).mutation(async ({ ctx, input }) => {
    requireAccess(ctx);
    await ensureTables();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const companyId = companyOf(ctx, input.companyId);
    const settingsResult: any = await db.execute(drzSql`SELECT enabled,legal_basis FROM biometric_company_settings WHERE company_id=${companyId} LIMIT 1`);
    const settings = rowsOf(settingsResult)[0];
    if (!settings?.enabled) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "O módulo PLUS de biometria ainda não está habilitado para esta empresa." });
    const employeeResult: any = await db.execute(drzSql`SELECT id FROM users WHERE id=${input.collaboratorId} AND company_id=${companyId} AND is_active=1 LIMIT 1`);
    if (!rowsOf(employeeResult)[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Colaborador não localizado." });
    if (input.deviceId) {
      const deviceResult: any = await db.execute(drzSql`SELECT id FROM biometric_devices WHERE id=${input.deviceId} AND company_id=${companyId} AND status='active' LIMIT 1`);
      if (!rowsOf(deviceResult)[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "Equipamento ativo não localizado nesta empresa." });
    }
    const providerRef = input.providerTemplateRef || `provider://${randomUUID()}`;
    const templateHash = createHash("sha256").update(`${companyId}:${input.collaboratorId}:${providerRef}`).digest("hex");
    const result: any = await db.execute(drzSql`INSERT INTO biometric_enrollments (company_id,collaborator_id,provider_template_ref,template_hash,purpose,legal_basis,authorized_by,enrolled_by,device_id,retention_until) VALUES (${companyId},${input.collaboratorId},${providerRef},${templateHash},${input.purpose},${input.legalBasis},${Number(ctx.user.id)},${Number(ctx.user.id)},${input.deviceId || null},${input.retentionUntil || null})`);
    const id = Number(result?.[0]?.insertId || result?.insertId || 0);
    await audit(db, companyId, Number(ctx.user.id), "enrollment_created", "enrollment", id, { collaboratorId: input.collaboratorId, purpose: input.purpose, deviceId: input.deviceId || null, rawBiometricStored: false });
    return { ok: true, id, templateHash, rawBiometricStored: false };
  }),

  revokeEnrollment: protectedProcedure.input(z.object({ companyId: z.number().int().positive().optional(), id: z.number().int().positive(), reason: z.string().min(5).max(2000) })).mutation(async ({ ctx, input }) => {
    requireAccess(ctx);
    await ensureTables();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const companyId = companyOf(ctx, input.companyId);
    await db.execute(drzSql`UPDATE biometric_enrollments SET status='revoked',revoked_at=NOW(),revocation_reason=${input.reason} WHERE id=${input.id} AND company_id=${companyId} AND status='active'`);
    await audit(db, companyId, Number(ctx.user.id), "enrollment_revoked", "enrollment", input.id, { reason: input.reason });
    return { ok: true };
  }),

  evidence: protectedProcedure.input(z.object({ companyId: z.number().int().positive().optional(), processType: z.string().max(40).optional() }).default({})).query(async ({ ctx, input }) => {
    requireAccess(ctx);
    await ensureTables();
    const db = await getDb();
    if (!db) return [];
    const companyId = companyOf(ctx, input.companyId);
    const processType = String(input.processType || "");
    const result: any = await db.execute(drzSql`SELECT e.*,u.name collaborator_name,d.name device_name,o.name operator_name FROM biometric_evidence e JOIN users u ON u.id=e.collaborator_id AND u.company_id=e.company_id LEFT JOIN biometric_devices d ON d.id=e.device_id LEFT JOIN users o ON o.id=e.operator_user_id WHERE e.company_id=${companyId} AND (${processType}='' OR e.process_type=${processType}) ORDER BY e.occurred_at DESC LIMIT 1000`);
    return rowsOf(result);
  }),

  registerEvidence: protectedProcedure.input(z.object({
    companyId: z.number().int().positive().optional(), enrollmentId: z.number().int().positive(), processType: z.enum(["epi", "epc", "aso", "dds", "work_order", "training", "document", "term", "other"]),
    processReference: z.string().min(1).max(180), actionLabel: z.string().min(2).max(180), confirmationText: z.string().min(10).max(10000), metadata: z.record(z.string(), z.unknown()).optional(),
  })).mutation(async ({ ctx, input }) => {
    requireAccess(ctx);
    await ensureTables();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const companyId = companyOf(ctx, input.companyId);
    const result: any = await db.execute(drzSql`SELECT e.id,e.collaborator_id,e.device_id,e.template_hash,d.allowed_roles_json FROM biometric_enrollments e LEFT JOIN biometric_devices d ON d.id=e.device_id AND d.company_id=e.company_id WHERE e.id=${input.enrollmentId} AND e.company_id=${companyId} AND e.status='active' LIMIT 1`);
    const enrollment = rowsOf(result)[0];
    if (!enrollment) throw new TRPCError({ code: "NOT_FOUND", message: "Biometria ativa não localizada." });
    let allowedRoles: string[] = [];
    try { allowedRoles = Array.isArray(enrollment.allowed_roles_json) ? enrollment.allowed_roles_json : JSON.parse(enrollment.allowed_roles_json || "[]"); } catch { allowedRoles = []; }
    if (allowedRoles.length && !allowedRoles.includes(String(ctx.user.role))) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Seu perfil não está autorizado a operar este equipamento biométrico." });
    }
    const occurredAt = new Date().toISOString();
    const evidenceHash = createHash("sha256").update([companyId, enrollment.collaborator_id, input.processType, input.processReference, input.confirmationText, occurredAt, enrollment.template_hash].join("|")).digest("hex");
    const inserted: any = await db.execute(drzSql`INSERT INTO biometric_evidence (company_id,collaborator_id,enrollment_id,device_id,process_type,process_reference,action_label,evidence_hash,confirmation_text,operator_user_id,metadata_json) VALUES (${companyId},${Number(enrollment.collaborator_id)},${input.enrollmentId},${enrollment.device_id || null},${input.processType},${input.processReference},${input.actionLabel},${evidenceHash},${input.confirmationText},${Number(ctx.user.id)},${JSON.stringify(input.metadata || {})})`);
    const id = Number(inserted?.[0]?.insertId || inserted?.insertId || 0);
    await audit(db, companyId, Number(ctx.user.id), "evidence_registered", "evidence", id, { processType: input.processType, processReference: input.processReference, evidenceHash });
    return { ok: true, id, evidenceHash };
  }),
});
