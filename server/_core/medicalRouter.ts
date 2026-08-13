import { TRPCError } from "@trpc/server";
import { sql as drzSql } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { getDb } from "../db";
import { orChat } from "./contentforge/openrouter";
import {
  auditPcmso,
  buildPcmsoDraft,
  buildPcmsoTitle,
  suggestMedicalResponse,
} from "./pcmsoIntelligence";
import { protectedProcedure, router } from "./trpc";
import {
  ensureClinicalConsultationExam,
  ensureOccupationalTables,
} from "./occupationalLifecycleRouter";
import { loadDocumentDefaults } from "./documentDefaults";
import { richTextToPlainText, sanitizeRichText } from "./richText";

let tablesReady = false;

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
  const companyId = Number(ctx.user?.companyId || 0);
  if (!companyId)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Empresa não identificada.",
    });
  return companyId;
}

function requireDoctor(ctx: any) {
  if (roleOf(ctx) !== "medico") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acesso clínico restrito ao perfil Médico.",
    });
  }
}

function requireExamCatalogManager(ctx: any) {
  if (
    ![
      "medico",
      "sesmt",
      "admin",
      "company_admin",
      "admin_global",
      "super_admin",
    ].includes(roleOf(ctx))
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "A gestão do Catálogo de Exames exige perfil Médico, SESMT ou administrador autorizado.",
    });
  }
}

function requirePcmsoRead(ctx: any) {
  if (
    ![
      "medico",
      "sesmt",
      "admin",
      "company_admin",
      "admin_global",
      "super_admin",
    ].includes(roleOf(ctx))
  )
    throw new TRPCError({ code: "FORBIDDEN" });
}

function requireVaccinationRead(ctx: any) {
  if (
    ![
      "medico",
      "sesmt",
      "admin",
      "company_admin",
      "admin_global",
      "super_admin",
    ].includes(roleOf(ctx))
  )
    throw new TRPCError({ code: "FORBIDDEN" });
}

function requireVaccinationManager(ctx: any) {
  if (
    ![
      "sesmt",
      "admin",
      "company_admin",
      "admin_global",
      "super_admin",
    ].includes(roleOf(ctx))
  )
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "A gestão operacional da vacinação é responsabilidade do SESMT.",
    });
}

async function ensureColumn(
  db: any,
  table: string,
  column: string,
  definition: string
) {
  const found: any = await db.execute(
    drzSql`SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${table} AND COLUMN_NAME=${column} LIMIT 1`
  );
  if (rowsOf(found).length) return;
  await db.execute(
    drzSql.raw(
      `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`
    )
  );
}

function requireDossierAccess(ctx: any) {
  if (
    ![
      "medico",
      "rh",
      "admin",
      "company_admin",
      "admin_global",
      "super_admin",
      "sesmt",
    ].includes(roleOf(ctx))
  ) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}

async function ensureTables() {
  if (tablesReady) return;
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

  await ensureOccupationalTables();

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS medical_professional_profiles (
    user_id INT PRIMARY KEY,
    company_id INT NOT NULL,
    crm VARCHAR(80),
    crm_state VARCHAR(10),
    specialty VARCHAR(180),
    signature_private_path VARCHAR(600),
    stamp_private_path VARCHAR(600),
    authorize_signature_use TINYINT(1) NOT NULL DEFAULT 0,
    authorize_pcmso_signature TINYINT(1) NOT NULL DEFAULT 0,
    authorize_exam_request_signature TINYINT(1) NOT NULL DEFAULT 0,
    authorization_updated_at DATETIME NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_med_profile_company (company_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS pcmso_programs_v2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    pgr_id INT NULL,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'rascunho',
    valid_from DATE NULL,
    valid_until DATE NULL,
    introduction MEDIUMTEXT,
    objective MEDIUMTEXT,
    methodology MEDIUMTEXT,
    chapters_json LONGTEXT,
    header_text TEXT,
    footer_text TEXT,
    doctor_user_id INT NOT NULL,
    doctor_name VARCHAR(255),
    doctor_crm VARCHAR(80),
    doctor_signature_private_path VARCHAR(600),
    doctor_stamp_private_path VARCHAR(600),
    current_version INT NOT NULL DEFAULT 1,
    pdf_private_path VARCHAR(600),
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_pcmso_v2_company (company_id, status),
    INDEX idx_pcmso_v2_pgr (pgr_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS pcmso_exam_catalog_v2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    exam_type VARCHAR(30) NOT NULL DEFAULT 'complementar',
    description TEXT,
    default_periodicity VARCHAR(120),
    periodicity_rules_json LONGTEXT,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_pcmso_exam_company_name (company_id, name),
    INDEX idx_pcmso_exam_company (company_id, is_active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS pcmso_risk_monitoring_v2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    pcmso_id INT NOT NULL,
    pgr_id INT NULL,
    pgr_gse_id INT NULL,
    pgr_risk_id INT NULL,
    branch_name VARCHAR(255),
    sector_name VARCHAR(255),
    gse_name VARCHAR(255),
    risk_name VARCHAR(500) NOT NULL,
    risk_type VARCHAR(120),
    risk_classification VARCHAR(120),
    technical_detail MEDIUMTEXT,
    monitoring_kind VARCHAR(40) NOT NULL DEFAULT 'nao_definido',
    exam_id INT NULL,
    monitoring_name VARCHAR(255),
    periodicity VARCHAR(120),
    applicability VARCHAR(120),
    observations TEXT,
    decision_by INT NULL,
    decision_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_pcmso_risk_source (pcmso_id, pgr_gse_id, pgr_risk_id),
    INDEX idx_pcmso_monitor_company (company_id, pcmso_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS pcmso_attachments_v2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    pcmso_id INT NOT NULL,
    annex_number INT NOT NULL,
    title VARCHAR(255),
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(120) NOT NULL,
    private_path VARCHAR(600) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    uploaded_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pcmso_annex (company_id, pcmso_id, annex_number)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS pcmso_versions_v2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    pcmso_id INT NOT NULL,
    version_number INT NOT NULL,
    pdf_private_path VARCHAR(600) NOT NULL,
    generated_by INT NOT NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_pcmso_version (pcmso_id, version_number),
    INDEX idx_pcmso_version_company (company_id, pcmso_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS medical_encounters_v2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    collaborator_id INT NOT NULL,
    doctor_user_id INT NOT NULL,
    encounter_at DATETIME NOT NULL,
    encounter_type VARCHAR(80) NOT NULL,
    reason TEXT,
    clinical_notes MEDIUMTEXT,
    conduct MEDIUMTEXT,
    guidance MEDIUMTEXT,
    signature_hash VARCHAR(128),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_encounter_patient (company_id, collaborator_id, encounter_at),
    INDEX idx_encounter_doctor (doctor_user_id, encounter_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS medical_referrals_v2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    collaborator_id INT NOT NULL,
    encounter_id INT NULL,
    doctor_user_id INT NOT NULL,
    referral_date DATE NOT NULL,
    destination_type VARCHAR(80) NOT NULL,
    destination_name VARCHAR(255),
    reason TEXT,
    guidance TEXT,
    observations TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_referral_patient (company_id, collaborator_id, referral_date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS medical_certificates_v2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    collaborator_id INT NOT NULL,
    encounter_id INT NULL,
    doctor_user_id INT NOT NULL,
    issue_date DATE NOT NULL,
    start_at DATETIME NOT NULL,
    end_at DATETIME NOT NULL,
    total_days DECIMAL(8,2) NOT NULL DEFAULT 0,
    total_hours DECIMAL(8,2) NOT NULL DEFAULT 0,
    return_date DATE NULL,
    administrative_summary TEXT,
    clinical_private_notes MEDIUMTEXT,
    signature_hash VARCHAR(128),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_med_certificate_patient (company_id, collaborator_id, issue_date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS medical_medications_v2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    collaborator_id INT NOT NULL,
    encounter_id INT NULL,
    doctor_user_id INT NOT NULL,
    medication VARCHAR(255) NOT NULL,
    quantity VARCHAR(120),
    administered_at DATETIME NOT NULL,
    guidance TEXT,
    observations TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_medication_patient (company_id, collaborator_id, administered_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS medical_anamneses_v2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    collaborator_id INT NOT NULL,
    encounter_id INT NULL,
    doctor_user_id INT NOT NULL,
    occupational_history MEDIUMTEXT,
    complaints MEDIUMTEXT,
    personal_history MEDIUMTEXT,
    habits MEDIUMTEXT,
    clinical_assessment MEDIUMTEXT,
    occupational_notes MEDIUMTEXT,
    signature_hash VARCHAR(128),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_anamnesis_patient (company_id, collaborator_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS medical_occupational_exams_v2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    collaborator_id INT NOT NULL,
    pcmso_id INT NULL,
    doctor_user_id INT NOT NULL,
    exam_kind VARCHAR(50) NOT NULL,
    performed_at DATETIME NOT NULL,
    clinical_findings MEDIUMTEXT,
    conclusion MEDIUMTEXT,
    fitness_status VARCHAR(40),
    restrictions_text MEDIUMTEXT,
    document_private_path VARCHAR(600),
    signature_hash VARCHAR(128),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_occupational_exam_patient (company_id, collaborator_id, performed_at),
    INDEX idx_occupational_exam_pcmso (pcmso_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS medical_vaccines_v2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    manufacturer VARCHAR(255),
    vaccine_type VARCHAR(120),
    indication TEXT,
    dose_count INT NOT NULL DEFAULT 1,
    interval_days INT NULL,
    notes TEXT,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_vaccine_company (company_id, is_active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS medical_vaccine_partners_v2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    cnpj VARCHAR(30),
    contact_name VARCHAR(255),
    phone VARCHAR(80),
    email VARCHAR(255),
    address TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_vaccine_partner_company (company_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS medical_vaccine_campaigns_v2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    vaccine_id INT NOT NULL,
    partner_id INT NULL,
    name VARCHAR(255) NOT NULL,
    campaign_at DATETIME NOT NULL,
    location VARCHAR(255),
    audience_text TEXT,
    branch_id INT NULL,
    sector_id INT NULL,
    estimated_quantity INT NULL,
    additional_info TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'planejada',
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_vaccine_campaign_company (company_id, campaign_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS medical_vaccination_records_v2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    collaborator_id INT NOT NULL,
    vaccine_id INT NOT NULL,
    campaign_id INT NULL,
    vaccination_date DATE NOT NULL,
    dose_number INT NOT NULL DEFAULT 1,
    lot VARCHAR(120),
    manufacturer VARCHAR(255),
    location VARCHAR(255),
    applied_by VARCHAR(255),
    next_dose_date DATE NULL,
    observations TEXT,
    receipt_private_path VARCHAR(600),
    recorded_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_vaccination_patient (company_id, collaborator_id, vaccination_date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS employee_dossier_documents_v2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    collaborator_id INT NOT NULL,
    category VARCHAR(80) NOT NULL,
    title VARCHAR(255) NOT NULL,
    source_module VARCHAR(80) NOT NULL DEFAULT 'external',
    source_record_id INT NULL,
    file_name VARCHAR(255),
    mime_type VARCHAR(120),
    private_path VARCHAR(600),
    uploaded_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_dossier_source (company_id, collaborator_id, source_module, source_record_id),
    INDEX idx_dossier_patient (company_id, collaborator_id, category)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS medical_audit_log_v2 (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    actor_user_id INT NOT NULL,
    action VARCHAR(120) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id INT NULL,
    collaborator_id INT NULL,
    details_json LONGTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_medical_audit_company (company_id, created_at),
    INDEX idx_medical_audit_patient (collaborator_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS pcmso_ai_audits_v2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    pcmso_id INT NOT NULL,
    score INT NOT NULL,
    result_json LONGTEXT NOT NULL,
    ai_commentary MEDIUMTEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pcmso_audit_program (company_id, pcmso_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS pcmso_analytical_reports_v2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    pcmso_id INT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    metrics_json LONGTEXT NOT NULL,
    narrative MEDIUMTEXT,
    recommendations MEDIUMTEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'rascunho',
    reviewed_by INT NULL,
    reviewed_at DATETIME NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pcmso_report_program (company_id, pcmso_id, period_end)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS pcmso_pgr_review_requests_v2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    pcmso_id INT NOT NULL,
    pgr_id INT NOT NULL,
    gse_name VARCHAR(255),
    risk_name VARCHAR(500),
    description MEDIUMTEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'aberta',
    requested_by INT NOT NULL,
    resolved_by INT NULL,
    resolved_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pcmso_pgr_review (company_id, pgr_id, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await ensureColumn(db, "pcmso_programs_v2", "guidelines", "MEDIUMTEXT NULL");
  await ensureColumn(
    db,
    "pcmso_programs_v2",
    "surveillance_methodology",
    "MEDIUMTEXT NULL"
  );
  await ensureColumn(
    db,
    "pcmso_programs_v2",
    "conduct_criteria",
    "MEDIUMTEXT NULL"
  );
  await ensureColumn(
    db,
    "pcmso_programs_v2",
    "critical_activities",
    "MEDIUMTEXT NULL"
  );
  await ensureColumn(
    db,
    "pcmso_programs_v2",
    "immunization_methodology",
    "MEDIUMTEXT NULL"
  );
  await ensureColumn(db, "pcmso_programs_v2", "conclusion", "MEDIUMTEXT NULL");
  await ensureColumn(
    db,
    "pcmso_exam_catalog_v2",
    "periodicity_rules_json",
    "LONGTEXT NULL"
  );
  await ensureColumn(
    db,
    "pcmso_programs_v2",
    "template_driven",
    "TINYINT(1) NOT NULL DEFAULT 0"
  );
  await ensureColumn(
    db,
    "pcmso_programs_v2",
    "doctor_stamp_private_path",
    "VARCHAR(600) NULL"
  );
  await ensureColumn(
    db,
    "pcmso_programs_v2",
    "doctor_request_signature_private_path",
    "VARCHAR(600) NULL"
  );
  await ensureColumn(
    db,
    "pcmso_programs_v2",
    "doctor_request_stamp_private_path",
    "VARCHAR(600) NULL"
  );
  await ensureColumn(
    db,
    "medical_professional_profiles",
    "stamp_private_path",
    "VARCHAR(600) NULL"
  );
  await ensureColumn(
    db,
    "medical_professional_profiles",
    "authorize_signature_use",
    "TINYINT(1) NOT NULL DEFAULT 0"
  );
  await ensureColumn(
    db,
    "medical_professional_profiles",
    "authorize_pcmso_signature",
    "TINYINT(1) NOT NULL DEFAULT 0"
  );
  await ensureColumn(
    db,
    "medical_professional_profiles",
    "authorize_exam_request_signature",
    "TINYINT(1) NOT NULL DEFAULT 0"
  );
  await ensureColumn(
    db,
    "medical_professional_profiles",
    "authorization_updated_at",
    "DATETIME NULL"
  );
  await ensureColumn(
    db,
    "pcmso_programs_v2",
    "integration_score",
    "INT NOT NULL DEFAULT 0"
  );
  await ensureColumn(
    db,
    "pcmso_programs_v2",
    "ai_audit_score",
    "INT NOT NULL DEFAULT 0"
  );
  await ensureColumn(
    db,
    "pcmso_programs_v2",
    "pending_count",
    "INT NOT NULL DEFAULT 0"
  );
  await ensureColumn(db, "pcmso_programs_v2", "pgr_synced_at", "DATETIME NULL");
  await ensureColumn(
    db,
    "pcmso_programs_v2",
    "pgr_source_updated_at",
    "DATETIME NULL"
  );
  await ensureColumn(
    db,
    "pcmso_programs_v2",
    "review_required",
    "TINYINT(1) NOT NULL DEFAULT 0"
  );
  await ensureColumn(db, "pcmso_programs_v2", "signed_at", "DATETIME NULL");
  await ensureColumn(
    db,
    "pcmso_programs_v2",
    "signature_hash",
    "VARCHAR(128) NULL"
  );
  await ensureColumn(db, "pcmso_programs_v2", "archived_at", "DATETIME NULL");
  await ensureColumn(db, "pcmso_programs_v2", "saved_at", "DATETIME NULL");
  await ensureColumn(db, "pcmso_programs_v2", "saved_by", "INT NULL");
  await ensureColumn(
    db,
    "pcmso_analytical_reports_v2",
    "discarded_at",
    "DATETIME NULL"
  );
  await ensureColumn(
    db,
    "pcmso_analytical_reports_v2",
    "discarded_by",
    "INT NULL"
  );
  await ensureColumn(
    db,
    "pcmso_analytical_reports_v2",
    "discard_reason",
    "TEXT NULL"
  );
  await ensureColumn(
    db,
    "pcmso_risk_monitoring_v2",
    "possible_aggravations",
    "MEDIUMTEXT NULL"
  );
  await ensureColumn(
    db,
    "pcmso_risk_monitoring_v2",
    "suggested_monitoring_kind",
    "VARCHAR(40) NULL"
  );
  await ensureColumn(
    db,
    "pcmso_risk_monitoring_v2",
    "suggested_monitoring_name",
    "VARCHAR(500) NULL"
  );
  await ensureColumn(
    db,
    "pcmso_risk_monitoring_v2",
    "suggested_periodicity",
    "VARCHAR(255) NULL"
  );
  await ensureColumn(
    db,
    "pcmso_risk_monitoring_v2",
    "ai_rationale",
    "MEDIUMTEXT NULL"
  );
  await ensureColumn(
    db,
    "pcmso_risk_monitoring_v2",
    "suggestion_status",
    "VARCHAR(30) NOT NULL DEFAULT 'revisar'"
  );
  await ensureColumn(
    db,
    "pcmso_risk_monitoring_v2",
    "ai_generated_at",
    "DATETIME NULL"
  );
  await ensureColumn(
    db,
    "pcmso_risk_monitoring_v2",
    "master_gse_id",
    "INT NULL"
  );
  await ensureColumn(
    db,
    "pcmso_risk_monitoring_v2",
    "master_gse_code",
    "VARCHAR(60) NULL"
  );

  tablesReady = true;
}

async function audit(
  db: any,
  ctx: any,
  action: string,
  entityType: string,
  entityId?: number | null,
  collaboratorId?: number | null,
  details?: any
) {
  await db.execute(drzSql`INSERT INTO medical_audit_log_v2
    (company_id, actor_user_id, action, entity_type, entity_id, collaborator_id, details_json)
    VALUES (${companyOf(ctx)}, ${Number(ctx.user.id)}, ${action}, ${entityType}, ${entityId || null}, ${collaboratorId || null}, ${details ? JSON.stringify(details) : null})`);
}

function privateRoot(companyId: number) {
  const base =
    process.env.NODE_ENV === "production"
      ? "/var/www/saudedotrabalho/private/medical"
      : path.join(process.cwd(), "private", "medical");
  const dir = path.join(base, String(companyId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function savePrivateFile(
  companyId: number,
  folder: string,
  fileName: string,
  dataUrl: string
) {
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/s);
  if (!match)
    throw new TRPCError({ code: "BAD_REQUEST", message: "Arquivo inválido." });
  const safe = path
    .basename(fileName || "documento.bin")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
  const dir = path.join(privateRoot(companyId), folder);
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(
    dir,
    `${Date.now()}_${crypto.randomBytes(5).toString("hex")}_${safe}`
  );
  fs.writeFileSync(target, Buffer.from(match[2], "base64"));
  return { target, mimeType: match[1] };
}

function esc(value: any) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    char =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ] || char
  );
}

const PCMSO_RICH_TEXT_FIELDS = [
  "introduction",
  "objective",
  "field_of_application",
  "guidelines",
  "methodology",
  "conduct_criteria",
  "surveillance_methodology",
  "critical_activities",
  "immunization_methodology",
  "conclusion",
] as const;

function sanitizePcmsoProgram(program: any) {
  if (!program) return program;
  const safe = { ...program };
  for (const field of PCMSO_RICH_TEXT_FIELDS) {
    safe[field] = sanitizeRichText(safe[field]);
  }
  try {
    const chapters = JSON.parse(safe.chapters_json || "[]");
    safe.chapters_json = JSON.stringify(
      Array.isArray(chapters)
        ? chapters.map((chapter: any) => ({
            title: richTextToPlainText(chapter?.title),
            content: sanitizeRichText(chapter?.content),
          }))
        : []
    );
  } catch {
    safe.chapters_json = "[]";
  }
  return safe;
}

function privateImageDataUri(filePath: unknown) {
  const target = String(filePath || "").trim();
  if (!target || !fs.existsSync(target)) return "";
  const extension = path.extname(target).toLowerCase();
  const mime =
    extension === ".jpg" || extension === ".jpeg"
      ? "image/jpeg"
      : extension === ".webp"
        ? "image/webp"
        : "image/png";
  return `data:${mime};base64,${fs.readFileSync(target).toString("base64")}`;
}

function buildPcmsoPdfHtml(input: {
  program: any;
  monitoring: any[];
  annexes: any[];
  analyticalReport?: any;
}) {
  const { program, monitoring, annexes, analyticalReport } = input;
  const signatureImage = privateImageDataUri(
    program.doctor_signature_private_path
  );
  const stampImage = privateImageDataUri(program.doctor_stamp_private_path);
  let chapters: any[] = [];
  try {
    chapters = JSON.parse(program.chapters_json || "[]");
  } catch {}
  const groups = new Map<string, any[]>();
  monitoring.forEach(row => {
    const key = row.gse_name || "GSE não identificado";
    groups.set(key, [...(groups.get(key) || []), row]);
  });
  const matrix = [...groups.entries()]
    .map(
      ([gse, rows]) =>
        `<h3>${esc([rows[0]?.master_gse_code, gse].filter(Boolean).join(" - "))} · População atual: ${esc(rows[0]?.population_count || 0)} trabalhador(es)</h3><table><thead><tr><th>Risco ocupacional</th><th>Possíveis agravos</th><th>Controle médico validado</th><th>Periodicidade</th><th>Critério/observação</th></tr></thead><tbody>${rows
          .map(
            row =>
              `<tr><td><b>${esc(row.risk_name)}</b><br>${esc(row.risk_type || "-")}<br><small>${esc(row.risk_classification || "-")}</small>${row.technical_detail ? `<br><small><b>Detalhamento do PGR:</b> ${esc(row.technical_detail)}</small>` : ""}</td><td>${esc(row.possible_aggravations || "Não registrado")}</td><td>${esc(String(row.monitoring_kind || "").replaceAll("_", " "))}<br><b>${esc(row.monitoring_name || row.exam_name || "-")}</b></td><td>${esc(row.periodicity || "Definida conforme avaliação médica")}</td><td>${esc(row.observations || "-")}</td></tr>`
          )
          .join("")}</tbody></table>`
    )
    .join("");
  const legacySummary = [
    "Apresentação",
    "Objetivo",
    "Campo de aplicação",
    "Base normativa",
    "Diretrizes",
    "Responsabilidades",
    "Metodologia",
    "Integração PGR/PCMSO",
    "Caracterização dos GSEs",
    "Planejamento médico e exames",
    "Critérios de interpretação e conduta",
    "Vigilância da saúde",
    "Imunização",
    "Relatório analítico",
    "Conclusão",
    "Responsabilidade técnica",
    "Anexos",
  ];
  const examTypes = [
    "Admissional",
    "Periódico",
    "Retorno ao trabalho",
    "Mudança de risco ocupacional",
    "Demissional",
  ];
  const customChapters = chapters.filter(
    chapter =>
      !/^conclus[aã]o$/i.test(richTextToPlainText(chapter?.title || "").trim())
  );
  const templateDriven = Boolean(Number(program.template_driven));
  const summaryItems = templateDriven
    ? [
        "Conteúdo técnico padronizado (itens 1 a 14)",
        ...customChapters.map(chapter => richTextToPlainText(chapter.title)),
        "15. Detalhamento dos GSEs e integração com o PGR",
        "16. Conclusão",
        "Anexos associados",
      ]
    : legacySummary;
  const pgrReference = `<div class="notice"><b>PGR de referência:</b> ${esc(program.pgr_title || "Não informado")}<br><b>Responsável técnico do PGR:</b> ${esc(program.pgr_responsible_name || "Não informado")} ${program.pgr_responsible_registration ? `· ${esc(program.pgr_responsible_registration)}` : ""}</div>`;
  const templateBody = `
    <section class="document-content technical-template">${sanitizeRichText(program.introduction || "")}</section>
    ${customChapters.map(chapter => `<h2>${esc(richTextToPlainText(chapter.title))}</h2><div class="document-content">${sanitizeRichText(chapter.content)}</div>`).join("")}
    <h2>15. Detalhamento dos GSEs e integração com o PGR</h2>${pgrReference}${matrix || "<p>Nenhum risco importado.</p>"}
    <h2>16. Conclusão</h2><div class="document-content">${sanitizeRichText(program.conclusion || "O programa deverá ser acompanhado continuamente e revisto quando houver alterações relevantes no PGR, nos processos, nos riscos ou no perfil de saúde consolidado dos trabalhadores.")}</div>`;
  const legacyBody = `
    <h2>1. Apresentação</h2><div class="document-content">${sanitizeRichText(program.introduction || "O PCMSO estabelece o acompanhamento médico ocupacional integrado aos riscos identificados no PGR.")}</div>
    <h2>2. Objetivo</h2><div class="document-content">${sanitizeRichText(program.objective || "Proteger e preservar a saúde dos trabalhadores em relação aos riscos ocupacionais.")}</div>
    <h2>3. Campo de aplicação</h2><div class="document-content">${sanitizeRichText(program.field_of_application || `Aplica-se à população trabalhadora vinculada aos ${groups.size} GSE(s) mestres desta organização, conectados ao PGR e ao PCMSO vigentes.`)}</div>
    <h2>4. Base normativa</h2><p>NR-07 - Programa de Controle Médico de Saúde Ocupacional, NR-01 - Gerenciamento de Riscos Ocupacionais e demais referências legais e técnicas aplicáveis ao escopo.</p>
    <h2>5. Diretrizes do PCMSO</h2><div class="document-content">${sanitizeRichText(program.guidelines || "Rastrear e detectar precocemente agravos relacionados ao trabalho, definir ações de vigilância, subsidiar medidas preventivas e manter documentação médica ocupacional sob confidencialidade.")}</div>
    <h2>6. Responsabilidades</h2><p><b>Organização:</b> garantir elaboração e implementação do programa, custear os procedimentos e fornecer informações atualizadas do PGR.<br><b>Médico responsável:</b> definir critérios médicos, validar o planejamento, analisar resultados consolidados e assinar o programa.<br><b>SESMT:</b> manter o PGR e apoiar os controles operacionais.</p>
    <h2>7. Metodologia de elaboração</h2><div class="document-content">${sanitizeRichText(program.methodology || "Os GSEs mestres e sua população foram relacionados ao PGR. Os riscos ocupacionais foram submetidos à análise médica para definição dos controles e periodicidades.")}</div>
    <h2>8. Integração entre PGR e PCMSO</h2>${pgrReference}
    <h2>9. Caracterização dos GSEs e planejamento médico</h2>${matrix || "<p>Nenhum risco importado.</p>"}
    <h2>10. Exames médicos ocupacionais</h2><ol>${examTypes.map(item => `<li>${item}</li>`).join("")}</ol>
    <h2>11. Critérios de interpretação e conduta</h2><div class="document-content">${sanitizeRichText(program.conduct_criteria || "Os achados devem ser interpretados pelo médico considerando história ocupacional, exposição, resultados anteriores e condições individuais.")}</div>
    <h2>12. Vigilância ativa e passiva</h2><div class="document-content">${sanitizeRichText(program.surveillance_methodology || "A vigilância considera atendimentos, queixas, atestados, exames ocupacionais e análise epidemiológica.")}</div>
    <h2>13. Atividades críticas</h2><div class="document-content">${sanitizeRichText(program.critical_activities || "A aptidão para atividades críticas deve ser avaliada individualmente pelo médico.")}</div>
    <h2>14. Imunização</h2><div class="document-content">${sanitizeRichText(program.immunization_methodology || "Quando aplicável, o histórico de imunização integra a vigilância ocupacional.")}</div>
    <h2>15. Relatório analítico</h2>${analyticalReport ? `<div class="document-content">${sanitizeRichText(analyticalReport.narrative)}</div><div class="document-content">${sanitizeRichText(analyticalReport.recommendations)}</div>` : "<p>Componente anual em elaboração.</p>"}
    ${customChapters.map((chapter, index) => `<h2>${16 + index}. ${esc(richTextToPlainText(chapter.title))}</h2><div class="document-content">${sanitizeRichText(chapter.content)}</div>`).join("")}
    <h2>Conclusão</h2><div class="document-content">${sanitizeRichText(program.conclusion || "O programa deverá ser acompanhado continuamente e revisto quando houver alterações relevantes.")}</div>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
  @page{size:A4;margin:18mm 15mm}body{font-family:Arial,sans-serif;color:#172b3a;font-size:10pt;line-height:1.45}h1{font-size:25pt;color:#0e2c46}h2{margin-top:9mm;color:#0e2c46;border-bottom:2px solid #0096a6;padding-bottom:2mm}h3{margin-top:6mm;color:#0e2c46}table{width:100%;border-collapse:collapse;font-size:7.7pt;margin:3mm 0 6mm}th,td{border:1px solid #d7e1e8;padding:2mm;vertical-align:top}th{background:#0e2c46;color:#fff}.cover{height:240mm;display:flex;flex-direction:column;justify-content:center;text-align:center;page-break-after:always}.meta{color:#607486}.signature{margin-top:18mm;text-align:center}.signature img{display:block;max-width:70mm;max-height:24mm;object-fit:contain;margin:0 auto 2mm}.signature-line{border-top:1px solid #172b3a;width:80mm;margin:0 auto 2mm}.notice{border-left:3px solid #eab308;padding:3mm;background:#fffbeb;font-size:8.5pt}.toc{columns:2}.page-break{page-break-before:always}p{white-space:pre-wrap}.document-content ul,.document-content ol{padding-left:7mm}.document-content li{margin:1.2mm 0}.document-content li>p{margin:0}.document-content img{max-width:100%;height:auto}</style></head><body>
  <section class="cover"><h1>${esc(program.title)}</h1><h2>${esc(program.company_name)}</h2><p>CNPJ: ${esc(program.cnpj || "-")}<br>Vigência: ${esc(program.valid_from || "-")} a ${esc(program.valid_until || "-")}</p><p class="meta">Programa de Controle Médico de Saúde Ocupacional</p></section>
  <h2>Controle do documento</h2><table><tbody><tr><td><b>Versão</b></td><td>${esc(program.current_version || 1)}</td><td><b>Situação</b></td><td>${esc(program.status)}</td></tr><tr><td><b>PGR de referência</b></td><td>${esc(program.pgr_title || "-")}</td><td><b>Sincronização</b></td><td>${esc(program.pgr_synced_at || "-")}</td></tr></tbody></table>
  <h2>Identificação da organização</h2><p><b>Empresa:</b> ${esc(program.company_name)}<br><b>CNPJ:</b> ${esc(program.cnpj || "-")}<br><b>Endereço:</b> ${esc(program.address || "-")}<br><b>Médico responsável:</b> ${esc(program.doctor_name || "-")} · ${esc(program.doctor_crm || "-")}</p>
  <h2>Sumário</h2><ol class="toc">${summaryItems.map(item => `<li>${esc(item)}</li>`).join("")}</ol>
  ${templateDriven ? templateBody : legacyBody}
  <h2>Anexos associados</h2><ol>${annexes.map(item => `<li>Anexo ${item.annex_number}: ${esc(item.title || item.file_name)}</li>`).join("") || "<li>Nenhum anexo associado.</li>"}</ol>
  <div class="signature">${signatureImage ? `<img src="${signatureImage}" alt="Assinatura do médico responsável">` : ""}${stampImage ? `<img src="${stampImage}" alt="Carimbo do médico responsável">` : ""}<div class="signature-line"></div><b>${esc(program.doctor_name || "Médico responsável")}</b><br>${esc(program.doctor_crm || "CRM não informado")}<br>Registro de autoria e integridade: ${esc(program.signature_hash || "documento ainda não confirmado")}</div>
  </body></html>`;
}

const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dateTimeInput = z.string().min(10).max(40);

export const medicalRouter = router({
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    requireDoctor(ctx);
    await ensureTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) return null;
    const [programs, encounters, pendingLeaves, vaccines] = await Promise.all([
      db.execute(
        drzSql`SELECT COUNT(*) total, SUM(status='vigente') active FROM pcmso_programs_v2 WHERE company_id=${companyId}`
      ),
      db.execute(
        drzSql`SELECT COUNT(*) total FROM medical_encounters_v2 WHERE company_id=${companyId} AND encounter_at>=DATE_FORMAT(CURDATE(),'%Y-%m-01')`
      ),
      db.execute(
        drzSql`SELECT COUNT(*) total FROM occupational_leave_cases WHERE company_id=${companyId} AND status IN ('pendente','em_analise')`
      ),
      db.execute(
        drzSql`SELECT COUNT(*) total, SUM(next_dose_date IS NOT NULL AND next_dose_date<=DATE_ADD(CURDATE(), INTERVAL 30 DAY)) due FROM medical_vaccination_records_v2 WHERE company_id=${companyId}`
      ),
    ]);
    return {
      pcmsoTotal: Number(rowsOf(programs)[0]?.total || 0),
      pcmsoActive: Number(rowsOf(programs)[0]?.active || 0),
      encountersMonth: Number(rowsOf(encounters)[0]?.total || 0),
      pendingLeaves: Number(rowsOf(pendingLeaves)[0]?.total || 0),
      vaccinationRecords: Number(rowsOf(vaccines)[0]?.total || 0),
      vaccineDosesDue: Number(rowsOf(vaccines)[0]?.due || 0),
    };
  }),

  listCollaborators: protectedProcedure.query(async ({ ctx }) => {
    requireDossierAccess(ctx);
    await ensureTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) return [];
    const result: any =
      await db.execute(drzSql`SELECT u.id,u.name,u.cpf,u.position,u.employment_status,b.name branch_name,s.name sector_name
      FROM users u LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN sectors s ON s.id=u.sector_id
      WHERE u.company_id=${companyId} AND u.role NOT IN ('super_admin','admin_global') ORDER BY u.name LIMIT 5000`);
    return rowsOf(result);
  }),

  getDoctorProfile: protectedProcedure.query(async ({ ctx }) => {
    requireDoctor(ctx);
    await ensureTables();
    const db = await getDb();
    if (!db) return null;
    const result: any = await db.execute(
      drzSql`SELECT p.crm,p.crm_state,p.specialty,(p.signature_private_path IS NOT NULL) has_signature,(p.stamp_private_path IS NOT NULL) has_stamp,p.authorize_signature_use,p.authorize_pcmso_signature,p.authorize_exam_request_signature,p.authorization_updated_at,u.name FROM users u LEFT JOIN medical_professional_profiles p ON p.user_id=u.id WHERE u.id=${Number(ctx.user.id)} LIMIT 1`
    );
    return rowsOf(result)[0] || null;
  }),

  saveDoctorProfile: protectedProcedure
    .input(
      z.object({
        crm: z.string().min(2).max(80),
        crmState: z.string().min(2).max(10),
        specialty: z.string().max(180).optional(),
        signatureBase64: z.string().max(8_000_000).optional(),
        signatureFileName: z.string().max(255).optional(),
        stampBase64: z.string().max(8_000_000).optional(),
        stampFileName: z.string().max(255).optional(),
        authorizeSignatureUse: z.boolean().default(false),
        authorizePcmsoSignature: z.boolean().default(false),
        authorizeExamRequestSignature: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireDoctor(ctx);
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let signature: string | null = null;
      if (input.signatureBase64)
        signature = savePrivateFile(
          companyId,
          "signatures",
          input.signatureFileName || "assinatura.png",
          input.signatureBase64
        ).target;
      let stamp: string | null = null;
      if (input.stampBase64)
        stamp = savePrivateFile(
          companyId,
          "stamps",
          input.stampFileName || "carimbo.png",
          input.stampBase64
        ).target;
      const allowAny = input.authorizeSignatureUse ? 1 : 0;
      const allowPcmso = allowAny && input.authorizePcmsoSignature ? 1 : 0;
      const allowRequests =
        allowAny && input.authorizeExamRequestSignature ? 1 : 0;
      await db.execute(drzSql`INSERT INTO medical_professional_profiles (user_id,company_id,crm,crm_state,specialty,signature_private_path,stamp_private_path,authorize_signature_use,authorize_pcmso_signature,authorize_exam_request_signature,authorization_updated_at)
      VALUES (${Number(ctx.user.id)},${companyId},${input.crm},${input.crmState},${input.specialty || null},${signature},${stamp},${allowAny},${allowPcmso},${allowRequests},NOW())
      ON DUPLICATE KEY UPDATE crm=VALUES(crm),crm_state=VALUES(crm_state),specialty=VALUES(specialty),signature_private_path=COALESCE(VALUES(signature_private_path),signature_private_path),stamp_private_path=COALESCE(VALUES(stamp_private_path),stamp_private_path),authorize_signature_use=VALUES(authorize_signature_use),authorize_pcmso_signature=VALUES(authorize_pcmso_signature),authorize_exam_request_signature=VALUES(authorize_exam_request_signature),authorization_updated_at=NOW()`);
      await audit(
        db,
        ctx,
        "doctor_profile_updated",
        "medical_professional_profile",
        Number(ctx.user.id)
      );
      return { ok: true };
    }),

  listPgrs: protectedProcedure.query(async ({ ctx }) => {
    requireDoctor(ctx);
    await ensureTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) return [];
    const result: any = await db.execute(
      drzSql`SELECT id,title,status,branch_id,updated_at FROM pgr_documents WHERE company_id=${companyId} ORDER BY updated_at DESC,id DESC LIMIT 200`
    );
    return rowsOf(result);
  }),

  getPcmsoDefaultText: protectedProcedure.query(async ({ ctx }) => {
    requireDoctor(ctx);
    await ensureTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) return { introduction: "", conclusion: "" };
    const defaults = await loadDocumentDefaults(db, companyId, "pcmso");
    return {
      introduction: sanitizeRichText(defaults?.texto_introducao),
      conclusion: sanitizeRichText(defaults?.texto_conclusao),
    };
  }),

  listPrograms: protectedProcedure.query(async ({ ctx }) => {
    requireDoctor(ctx);
    await ensureTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) return [];
    const result: any = await db.execute(
      drzSql`SELECT p.*,g.title pgr_title FROM pcmso_programs_v2 p LEFT JOIN pgr_documents g ON g.id=p.pgr_id WHERE p.company_id=${companyId} ORDER BY p.updated_at DESC,p.id DESC`
    );
    return rowsOf(result);
  }),

  getProgram: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      requireDoctor(ctx);
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) return null;
      const program: any = await db.execute(
        drzSql`SELECT p.*,g.title pgr_title,g.updated_at pgr_updated_at FROM pcmso_programs_v2 p LEFT JOIN pgr_documents g ON g.id=p.pgr_id WHERE p.id=${input.id} AND p.company_id=${companyId} LIMIT 1`
      );
      let programRow = rowsOf(program)[0] || null;
      if (
        programRow?.pgr_updated_at &&
        programRow?.pgr_synced_at &&
        new Date(programRow.pgr_updated_at).getTime() >
          new Date(programRow.pgr_synced_at).getTime() &&
        !Number(programRow.review_required)
      ) {
        await db.execute(
          drzSql`UPDATE pcmso_programs_v2 SET review_required=1 WHERE id=${input.id} AND company_id=${companyId}`
        );
        programRow.review_required = 1;
      }
      programRow = sanitizePcmsoProgram(programRow);
      const monitoring: any = await db.execute(
        drzSql`SELECT m.*,e.name exam_name FROM pcmso_risk_monitoring_v2 m LEFT JOIN pcmso_exam_catalog_v2 e ON e.id=m.exam_id WHERE m.pcmso_id=${input.id} AND m.company_id=${companyId} ORDER BY m.gse_name,m.risk_name`
      );
      const annexes: any = await db.execute(
        drzSql`SELECT id,annex_number,title,file_name,mime_type,sort_order,created_at FROM pcmso_attachments_v2 WHERE pcmso_id=${input.id} AND company_id=${companyId} ORDER BY annex_number,sort_order,id`
      );
      const versions: any = await db.execute(
        drzSql`SELECT id,version_number,generated_by,generated_at FROM pcmso_versions_v2 WHERE pcmso_id=${input.id} AND company_id=${companyId} ORDER BY version_number DESC`
      );
      const audits: any = await db.execute(
        drzSql`SELECT id,score,result_json,ai_commentary,created_at FROM pcmso_ai_audits_v2 WHERE pcmso_id=${input.id} AND company_id=${companyId} ORDER BY id DESC LIMIT 10`
      );
      const reports: any = await db.execute(
        drzSql`SELECT id,period_start,period_end,metrics_json,narrative,recommendations,status,reviewed_at,created_at,discarded_at,discarded_by,discard_reason FROM pcmso_analytical_reports_v2 WHERE pcmso_id=${input.id} AND company_id=${companyId} ORDER BY period_end DESC,id DESC`
      );
      const reviewRequests: any = await db.execute(
        drzSql`SELECT id,gse_name,risk_name,description,status,created_at,resolved_at FROM pcmso_pgr_review_requests_v2 WHERE pcmso_id=${input.id} AND company_id=${companyId} ORDER BY id DESC`
      );
      const referenceSummary: any = await db.execute(
        drzSql`SELECT COUNT(DISTINCT g.id) gses,COUNT(DISTINCT r.id) risks,COUNT(DISTINCT gs.sector_id) sectors FROM pgr_gse g LEFT JOIN pgr_gse_riscos r ON r.gse_id=g.id LEFT JOIN pgr_gse_setores gs ON gs.gse_id=g.id WHERE g.pgr_id=${programRow?.pgr_id || 0}`
      );
      return {
        program: programRow,
        monitoring: rowsOf(monitoring),
        annexes: rowsOf(annexes),
        versions: rowsOf(versions),
        audits: rowsOf(audits).map((row: any) => ({
          ...row,
          result: (() => {
            try {
              return JSON.parse(row.result_json || "{}");
            } catch {
              return {};
            }
          })(),
        })),
        analyticalReports: rowsOf(reports).map((row: any) => ({
          ...row,
          metrics: (() => {
            try {
              return JSON.parse(row.metrics_json || "{}");
            } catch {
              return {};
            }
          })(),
        })),
        reviewRequests: rowsOf(reviewRequests),
        referenceSummary: rowsOf(referenceSummary)[0] || {
          gses: 0,
          risks: 0,
          sectors: 0,
        },
      };
    }),

  upsertProgram: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        pgrId: z.number().int().positive().nullable().optional(),
        title: z.string().max(255).optional().default(""),
        status: z
          .enum(["rascunho", "em_revisao", "vigente", "arquivado"])
          .default("rascunho"),
        validFrom: dateInput.nullable().optional(),
        validUntil: dateInput.nullable().optional(),
        introduction: z.string().max(100000).optional(),
        objective: z.string().max(100000).optional(),
        methodology: z.string().max(100000).optional(),
        conclusion: z.string().max(4_000_000).optional(),
        useStandardTemplate: z.boolean().default(true),
        chapters: z
          .array(
            z.object({
              title: z.string().max(255),
              content: z.string().max(100000),
            })
          )
          .max(80)
          .default([]),
        headerText: z.string().max(5000).optional(),
        footerText: z.string().max(5000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireDoctor(ctx);
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const profile: any = await db.execute(
        drzSql`SELECT u.name,p.crm,p.crm_state,p.signature_private_path,p.stamp_private_path,p.authorize_signature_use,p.authorize_pcmso_signature,p.authorize_exam_request_signature FROM users u LEFT JOIN medical_professional_profiles p ON p.user_id=u.id WHERE u.id=${Number(ctx.user.id)} LIMIT 1`
      );
      const doctor = rowsOf(profile)[0] || {};
      if (!doctor.crm)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cadastre CRM e UF no perfil médico antes de criar o PCMSO.",
        });
      const companyResult: any = await db.execute(
        drzSql`SELECT c.name,COALESCE(b.name,'') branch_name FROM companies c LEFT JOIN pgr_documents p ON p.id=${input.pgrId || 0} AND p.company_id=c.id LEFT JOIN branches b ON b.id=p.branch_id WHERE c.id=${companyId} LIMIT 1`
      );
      const company = rowsOf(companyResult)[0] || {};
      const title =
        String(input.title || "").trim() ||
        buildPcmsoTitle({
          companyName: company.name,
          branchName: company.branch_name,
          validFrom: input.validFrom,
        });
      const defaults = input.id
        ? null
        : await loadDocumentDefaults(db, companyId, "pcmso");
      const introduction =
        sanitizeRichText(input.introduction || defaults?.texto_introducao) ||
        null;
      const objective = sanitizeRichText(input.objective) || null;
      const methodology = sanitizeRichText(input.methodology) || null;
      const conclusion =
        sanitizeRichText(input.conclusion || defaults?.texto_conclusao) || null;
      const safeStatus =
        input.status === "vigente" ? "em_revisao" : input.status;
      const requestedChapters = input.chapters.map(chapter => ({
        title: richTextToPlainText(chapter.title).slice(0, 255),
        content: sanitizeRichText(chapter.content),
      }));
      const chapters = requestedChapters.filter(
        chapter => !/^conclus[aã]o$/i.test(chapter.title.trim())
      );
      const allowPcmsoSignature =
        Number(doctor.authorize_signature_use) === 1 &&
        Number(doctor.authorize_pcmso_signature) === 1;
      const allowRequestSignature =
        Number(doctor.authorize_signature_use) === 1 &&
        Number(doctor.authorize_exam_request_signature) === 1;
      let id = input.id || 0;
      if (id) {
        const own: any = await db.execute(
          drzSql`SELECT id,status FROM pcmso_programs_v2 WHERE id=${id} AND company_id=${companyId} LIMIT 1`
        );
        if (!rowsOf(own).length) throw new TRPCError({ code: "NOT_FOUND" });
        await db.execute(
          drzSql`UPDATE pcmso_programs_v2 SET pgr_id=${input.pgrId || null},title=${title},status=${safeStatus},valid_from=${input.validFrom || null},valid_until=${input.validUntil || null},introduction=${introduction},objective=${objective},methodology=${methodology},conclusion=${conclusion},template_driven=${input.useStandardTemplate ? 1 : 0},chapters_json=${JSON.stringify(chapters)},header_text=${input.headerText || null},footer_text=${input.footerText || null},doctor_user_id=${Number(ctx.user.id)},doctor_name=${doctor.name},doctor_crm=${`${doctor.crm}/${doctor.crm_state}`},doctor_signature_private_path=${allowPcmsoSignature ? doctor.signature_private_path || null : null},doctor_stamp_private_path=${allowPcmsoSignature ? doctor.stamp_private_path || null : null},doctor_request_signature_private_path=${allowRequestSignature ? doctor.signature_private_path || null : null},doctor_request_stamp_private_path=${allowRequestSignature ? doctor.stamp_private_path || null : null},saved_at=NOW(),saved_by=${Number(ctx.user.id)} WHERE id=${id} AND company_id=${companyId}`
        );
        await audit(db, ctx, "pcmso_updated", "pcmso", id, null, {
          status: safeStatus,
        });
      } else {
        const result: any =
          await db.execute(drzSql`INSERT INTO pcmso_programs_v2 (company_id,pgr_id,title,status,valid_from,valid_until,introduction,objective,methodology,conclusion,template_driven,chapters_json,header_text,footer_text,doctor_user_id,doctor_name,doctor_crm,doctor_signature_private_path,doctor_stamp_private_path,doctor_request_signature_private_path,doctor_request_stamp_private_path,created_by)
        VALUES (${companyId},${input.pgrId || null},${title},${safeStatus},${input.validFrom || null},${input.validUntil || null},${introduction},${objective},${methodology},${conclusion},${input.useStandardTemplate ? 1 : 0},${JSON.stringify(chapters)},${input.headerText || null},${input.footerText || null},${Number(ctx.user.id)},${doctor.name},${`${doctor.crm}/${doctor.crm_state}`},${allowPcmsoSignature ? doctor.signature_private_path || null : null},${allowPcmsoSignature ? doctor.stamp_private_path || null : null},${allowRequestSignature ? doctor.signature_private_path || null : null},${allowRequestSignature ? doctor.stamp_private_path || null : null},${Number(ctx.user.id)})`);
        id = Number((result as any)[0]?.insertId || 0);
        await db.execute(
          drzSql`UPDATE pcmso_programs_v2 SET saved_at=NOW(),saved_by=${Number(ctx.user.id)} WHERE id=${id} AND company_id=${companyId}`
        );
        await audit(db, ctx, "pcmso_created", "pcmso", id);
      }
      return { ok: true, id, title };
    }),

  savePcmso: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireDoctor(ctx);
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const own: any = await db.execute(
        drzSql`SELECT id,status FROM pcmso_programs_v2 WHERE id=${input.id} AND company_id=${companyId} LIMIT 1`
      );
      const program = rowsOf(own)[0];
      if (!program) throw new TRPCError({ code: "NOT_FOUND" });
      if (program.status === "arquivado")
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "O PCMSO arquivado deve ser reaberto antes de novas alterações.",
        });
      const nextStatus =
        program.status === "rascunho" ? "em_revisao" : program.status;
      await db.execute(
        drzSql`UPDATE pcmso_programs_v2 SET status=${nextStatus},saved_at=NOW(),saved_by=${Number(ctx.user.id)} WHERE id=${input.id} AND company_id=${companyId}`
      );
      await audit(db, ctx, "pcmso_saved", "pcmso", input.id, null, {
        status: nextStatus,
        independentFromPublication: true,
      });
      return { ok: true, status: nextStatus };
    }),

  importPgr: protectedProcedure
    .input(
      z.object({
        pcmsoId: z.number().int().positive(),
        pgrId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireDoctor(ctx);
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const pcmso: any = await db.execute(
        drzSql`SELECT id FROM pcmso_programs_v2 WHERE id=${input.pcmsoId} AND company_id=${companyId} LIMIT 1`
      );
      const pgr: any = await db.execute(
        drzSql`SELECT id,title,inventario FROM pgr_documents WHERE id=${input.pgrId} AND company_id=${companyId} LIMIT 1`
      );
      if (!rowsOf(pcmso).length || !rowsOf(pgr).length)
        throw new TRPCError({ code: "NOT_FOUND" });

      const sourceRows: any[] = [];
      const normalized: any =
        await db.execute(drzSql`SELECT g.id gse_id,COALESCE(m.id,g.master_gse_id) master_gse_id,m.code master_gse_code,COALESCE(m.name,g.nome) gse_name,r.id risk_id,r.agente risk_name,r.tipo risk_type,r.risco_final risk_classification,CONCAT_WS('\n',d.metodologia,d.resultado_medicao,d.criterio_ia,d.justificativa_ia) technical_detail
      FROM pgr_gse g JOIN pgr_documents p ON p.id=g.pgr_id LEFT JOIN occupational_gse_master m ON m.id=g.master_gse_id AND m.company_id=p.company_id LEFT JOIN pgr_gse_riscos r ON r.gse_id=g.id LEFT JOIN pgr_gse_riscos_detalhe d ON d.risco_id=r.id
      WHERE p.id=${input.pgrId} AND p.company_id=${companyId}`);
      for (const row of rowsOf(normalized))
        if (row.risk_name) sourceRows.push(row);
      if (!sourceRows.length) {
        try {
          const inventory = JSON.parse(rowsOf(pgr)[0]?.inventario || "[]");
          for (let index = 0; index < inventory.length; index++) {
            const item = inventory[index] || {};
            sourceRows.push({
              gse_id: null,
              gse_name: item.gse || item.ghe || item.setor || "Sem GSE",
              risk_id: -(index + 1),
              risk_name:
                item.fator || item.risco || item.perigo || "Risco sem título",
              risk_type: item.tipoRisco || item.tipo || null,
              risk_classification: item.classificacao || item.nivel || null,
              technical_detail: item.detalhamento || item.descricao || null,
              branch_name: item.filial || null,
              sector_name: item.setor || null,
            });
          }
        } catch {}
      }
      let imported = 0;
      for (const row of sourceRows) {
        const suggestion = suggestMedicalResponse(row);
        const result: any =
          await db.execute(drzSql`INSERT INTO pcmso_risk_monitoring_v2 (company_id,pcmso_id,pgr_id,pgr_gse_id,pgr_risk_id,master_gse_id,master_gse_code,branch_name,sector_name,gse_name,risk_name,risk_type,risk_classification,technical_detail,monitoring_kind,possible_aggravations,suggested_monitoring_kind,suggested_monitoring_name,suggested_periodicity,ai_rationale,suggestion_status,ai_generated_at)
        VALUES (${companyId},${input.pcmsoId},${input.pgrId},${row.gse_id || null},${row.risk_id || null},${row.master_gse_id || null},${row.master_gse_code || null},${row.branch_name || null},${row.sector_name || null},${row.gse_name || "Sem GSE"},${row.risk_name},${row.risk_type || null},${row.risk_classification || null},${row.technical_detail || null},'nao_definido',${suggestion.possibleAggravations},${suggestion.monitoringKind},${suggestion.monitoringName},${suggestion.periodicity},${suggestion.rationale},'revisar',NOW())
        ON DUPLICATE KEY UPDATE pgr_id=VALUES(pgr_id),master_gse_id=VALUES(master_gse_id),master_gse_code=VALUES(master_gse_code),branch_name=VALUES(branch_name),sector_name=VALUES(sector_name),gse_name=VALUES(gse_name),risk_name=VALUES(risk_name),risk_type=VALUES(risk_type),risk_classification=VALUES(risk_classification),technical_detail=VALUES(technical_detail),possible_aggravations=COALESCE(possible_aggravations,VALUES(possible_aggravations)),suggested_monitoring_kind=VALUES(suggested_monitoring_kind),suggested_monitoring_name=VALUES(suggested_monitoring_name),suggested_periodicity=VALUES(suggested_periodicity),ai_rationale=VALUES(ai_rationale),ai_generated_at=NOW()`);
        imported += Number((result as any)[0]?.affectedRows || 0);
      }
      await db.execute(
        drzSql`UPDATE pcmso_programs_v2 p JOIN pgr_documents g ON g.id=${input.pgrId} SET p.pgr_id=${input.pgrId},p.pgr_synced_at=NOW(),p.pgr_source_updated_at=g.updated_at,p.review_required=0,p.integration_score=100 WHERE p.id=${input.pcmsoId} AND p.company_id=${companyId}`
      );
      await audit(
        db,
        ctx,
        "pgr_imported_to_pcmso",
        "pcmso",
        input.pcmsoId,
        null,
        { pgrId: input.pgrId, imported }
      );
      return { ok: true, imported };
    }),

  listExams: protectedProcedure.query(async ({ ctx }) => {
    requireExamCatalogManager(ctx);
    await ensureTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) return [];
    const result: any = await db.execute(
      drzSql`SELECT * FROM pcmso_exam_catalog_v2 WHERE company_id=${companyId} ORDER BY is_active DESC,name`
    );
    return rowsOf(result);
  }),

  upsertExam: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        name: z.string().min(2).max(255),
        examType: z.enum(["clinico", "complementar"]),
        description: z.string().max(10000).optional(),
        defaultPeriodicity: z.string().max(120).optional(),
        periodicityRules: z
          .array(
            z.object({
              appointmentType: z.enum([
                "admissional",
                "periodico",
                "demissional",
                "retorno_trabalho",
                "mudanca_risco_funcao",
                "outro",
              ]),
              periodicity: z.enum([
                "no_atendimento",
                "6_meses",
                "anual",
                "bienal",
                "personalizada",
              ]),
              intervalMonths: z.number().int().min(1).max(120).nullable().optional(),
              notes: z.string().max(1000).optional(),
            })
          )
          .max(30)
          .default([]),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireExamCatalogManager(ctx);
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let id = input.id || 0;
      const periodicityLabels: Record<string, string> = {
        no_atendimento: "No atendimento",
        "6_meses": "6 meses",
        anual: "Anual",
        bienal: "Bienal",
        personalizada: "Conforme configuração específica",
      };
      const preferredRule =
        input.periodicityRules.find(rule => rule.appointmentType === "periodico") ||
        input.periodicityRules[0];
      const defaultPeriodicity =
        input.defaultPeriodicity ||
        (preferredRule
          ? preferredRule.periodicity === "personalizada" &&
            preferredRule.intervalMonths
            ? `${preferredRule.intervalMonths} meses`
            : periodicityLabels[preferredRule.periodicity]
          : undefined);
      const periodicityRulesJson = JSON.stringify(input.periodicityRules);
      if (id)
        await db.execute(
          drzSql`UPDATE pcmso_exam_catalog_v2 SET name=${input.name},exam_type=${input.examType},description=${input.description || null},default_periodicity=${defaultPeriodicity || null},periodicity_rules_json=${periodicityRulesJson},is_active=${input.isActive ? 1 : 0} WHERE id=${id} AND company_id=${companyId}`
        );
      else {
        const result: any = await db.execute(
          drzSql`INSERT INTO pcmso_exam_catalog_v2 (company_id,name,exam_type,description,default_periodicity,periodicity_rules_json,is_active,created_by) VALUES (${companyId},${input.name},${input.examType},${input.description || null},${defaultPeriodicity || null},${periodicityRulesJson},${input.isActive ? 1 : 0},${Number(ctx.user.id)})`
        );
        id = Number((result as any)[0]?.insertId || 0);
      }
      await audit(
        db,
        ctx,
        input.id ? "exam_updated" : "exam_created",
        "pcmso_exam",
        id
      );
      return { ok: true, id };
    }),

  decideMonitoring: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        monitoringKind: z.enum([
          "nao_definido",
          "avaliacao_clinica",
          "exame_complementar",
          "nao_aplicavel",
        ]),
        examId: z.number().int().positive().nullable().optional(),
        monitoringName: z.string().max(255).optional(),
        periodicity: z.string().max(120).optional(),
        applicability: z.string().max(120).optional(),
        observations: z.string().max(10000).optional(),
        possibleAggravations: z.string().max(50000).optional(),
        aiRationale: z.string().max(50000).optional(),
        suggestionStatus: z
          .enum(["revisar", "aprovada", "editada", "ignorada"])
          .default("editada"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireDoctor(ctx);
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let examId = input.examId || null;
      let monitoringName = input.monitoringName || null;
      let periodicity = input.periodicity || null;
      if (input.monitoringKind === "avaliacao_clinica") {
        examId = await ensureClinicalConsultationExam(
          db,
          companyId,
          Number(ctx.user.id)
        );
        monitoringName = "Consulta clínica ocupacional";
      }
      if (input.monitoringKind === "exame_complementar") {
        if (!examId)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Selecione um exame do Catálogo Mestre.",
          });
        const examResult: any = await db.execute(
          drzSql`SELECT id,name,default_periodicity,is_active FROM pcmso_exam_catalog_v2 WHERE id=${examId} AND company_id=${companyId} LIMIT 1`
        );
        const exam = rowsOf(examResult)[0];
        if (!exam || !Number(exam.is_active))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "O exame selecionado não pertence ao Catálogo Mestre ativo desta empresa.",
          });
        monitoringName = exam.name;
        periodicity = periodicity || exam.default_periodicity || null;
      }
      if (["nao_definido", "nao_aplicavel"].includes(input.monitoringKind)) {
        examId = null;
        monitoringName =
          input.monitoringKind === "nao_aplicavel" ? "Não aplicável" : null;
      }
      if (input.suggestionStatus === "ignorada") {
        await db.execute(
          drzSql`UPDATE pcmso_risk_monitoring_v2 SET suggested_monitoring_kind=NULL,suggested_monitoring_name=NULL,suggested_periodicity=NULL,ai_rationale=NULL,suggestion_status='ignorada',decision_by=${Number(ctx.user.id)},decision_at=NOW() WHERE id=${input.id} AND company_id=${companyId}`
        );
        await audit(
          db,
          ctx,
          "risk_monitoring_ai_suggestion_ignored",
          "pcmso_risk_monitoring",
          input.id
        );
        return { ok: true, ignored: true };
      }
      await db.execute(
        drzSql`UPDATE pcmso_risk_monitoring_v2 SET monitoring_kind=${input.monitoringKind},exam_id=${examId},monitoring_name=${monitoringName},periodicity=${periodicity},applicability=${input.applicability || null},observations=${input.observations || null},possible_aggravations=COALESCE(${input.possibleAggravations || null},possible_aggravations),ai_rationale=COALESCE(${input.aiRationale || null},ai_rationale),suggestion_status=${input.suggestionStatus},decision_by=${Number(ctx.user.id)},decision_at=NOW() WHERE id=${input.id} AND company_id=${companyId}`
      );
      await audit(
        db,
        ctx,
        "risk_monitoring_decided",
        "pcmso_risk_monitoring",
        input.id,
        null,
        { monitoringKind: input.monitoringKind, examId }
      );
      return { ok: true, examId, monitoringName, periodicity };
    }),

  generatePcmsoWithAi: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireDoctor(ctx);
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const programResult: any = await db.execute(
        drzSql`SELECT p.*,c.name company_name,g.title pgr_title FROM pcmso_programs_v2 p JOIN companies c ON c.id=p.company_id LEFT JOIN pgr_documents g ON g.id=p.pgr_id WHERE p.id=${input.id} AND p.company_id=${companyId} LIMIT 1`
      );
      const program = rowsOf(programResult)[0];
      if (!program) throw new TRPCError({ code: "NOT_FOUND" });
      const monitoringResult: any = await db.execute(
        drzSql`SELECT * FROM pcmso_risk_monitoring_v2 WHERE pcmso_id=${input.id} AND company_id=${companyId} ORDER BY gse_name,risk_name`
      );
      const monitoring = rowsOf(monitoringResult);
      if (!program.pgr_id || !monitoring.length)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Selecione e importe o PGR antes de gerar o PCMSO com IA.",
        });
      let draft = buildPcmsoDraft({
        companyName: program.company_name,
        pgrTitle: program.pgr_title,
        riskRows: monitoring,
      });
      let usedAi = false;
      const apiKey = String(process.env.OPENROUTER_API_KEY || "").trim();
      if (apiKey) {
        try {
          const compactRisks = monitoring.slice(0, 120).map((row: any) => ({
            gse: row.gse_name,
            risco: row.risk_name,
            tipo: row.risk_type,
            classificacao: row.risk_classification,
            detalhe: String(row.technical_detail || "").slice(0, 800),
          }));
          const raw = await orChat(
            [
              {
                role: "system",
                content:
                  "Você é assistente técnico de Medicina do Trabalho no Brasil. Estruture um PCMSO conforme NR-07 a partir do PGR fornecido. Não prescreva automaticamente, não invente medições, exames, normas, datas ou fatos. Toda sugestão exige validação do médico. Responda apenas JSON válido com introduction, objective, methodology e chapters (array de title/content). Inclua campo de aplicação, base normativa, diretrizes, responsabilidades, cinco exames ocupacionais, vigilância ativa/passiva, atividades críticas, critérios de interpretação e conduta, imunização quando aplicável, relatório analítico e conclusão.",
              },
              {
                role: "user",
                content: JSON.stringify({
                  empresa: program.company_name,
                  pgr: program.pgr_title,
                  riscos: compactRisks,
                }),
              },
            ],
            apiKey,
            true
          );
          const cleanJson = raw
            .trim()
            .replace(/^```json\s*/i, "")
            .replace(/```$/i, "");
          const ai = JSON.parse(cleanJson);
          if (
            typeof ai.introduction === "string" &&
            typeof ai.objective === "string" &&
            typeof ai.methodology === "string" &&
            Array.isArray(ai.chapters)
          ) {
            draft = {
              introduction: ai.introduction,
              objective: ai.objective,
              methodology: ai.methodology,
              chapters: ai.chapters
                .filter(
                  (item: any) =>
                    typeof item?.title === "string" &&
                    typeof item?.content === "string"
                )
                .slice(0, 30),
            };
            usedAi = true;
          }
        } catch (error: any) {
          console.warn(
            "[PCMSO] geração OpenRouter indisponível; usando estrutura segura:",
            String(error?.message || error).slice(0, 180)
          );
        }
      }
      const chapterText = (title: string) =>
        draft.chapters.find((item: any) =>
          String(item.title || "")
            .toLowerCase()
            .includes(title)
        )?.content || null;
      await db.execute(
        drzSql`UPDATE pcmso_programs_v2 SET introduction=${draft.introduction},objective=${draft.objective},methodology=${draft.methodology},chapters_json=${JSON.stringify(draft.chapters)},guidelines=${chapterText("diretr")},surveillance_methodology=${chapterText("vigil")},conduct_criteria=${chapterText("conduta")},critical_activities=${chapterText("atividades cr")},immunization_methodology=${chapterText("imuniza")},conclusion=${chapterText("conclus")},status='em_revisao' WHERE id=${input.id} AND company_id=${companyId}`
      );
      for (const row of monitoring) {
        const suggestion = suggestMedicalResponse(row);
        await db.execute(
          drzSql`UPDATE pcmso_risk_monitoring_v2 SET possible_aggravations=COALESCE(possible_aggravations,${suggestion.possibleAggravations}),suggested_monitoring_kind=${suggestion.monitoringKind},suggested_monitoring_name=${suggestion.monitoringName},suggested_periodicity=${suggestion.periodicity},ai_rationale=${suggestion.rationale},ai_generated_at=NOW() WHERE id=${Number(row.id)} AND company_id=${companyId} AND suggestion_status IN ('revisar','ignorada')`
        );
      }
      await audit(
        db,
        ctx,
        "pcmso_ai_draft_generated",
        "pcmso",
        input.id,
        null,
        {
          usedAi,
          risks: monitoring.length,
        }
      );
      return { ok: true, usedAi, risks: monitoring.length };
    }),

  auditPcmso: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireDoctor(ctx);
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const programResult: any = await db.execute(
        drzSql`SELECT p.*,c.address company_address FROM pcmso_programs_v2 p JOIN companies c ON c.id=p.company_id WHERE p.id=${input.id} AND p.company_id=${companyId} LIMIT 1`
      );
      const program = rowsOf(programResult)[0];
      if (!program) throw new TRPCError({ code: "NOT_FOUND" });
      if (!program.valid_from || !program.valid_until)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Informe o início e o fim da vigência antes de assinar o PCMSO.",
        });
      if (String(program.valid_until) < String(program.valid_from))
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "A data final da vigência deve ser posterior à data inicial.",
        });
      if (!String(program.company_address || "").trim())
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Complete o endereço da empresa antes da emissão definitiva.",
        });
      if (
        !String(program.doctor_name || "").trim() ||
        !String(program.doctor_crm || "").trim()
      )
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Complete a identificação e o CRM do médico responsável.",
        });
      const monitoringResult: any = await db.execute(
        drzSql`SELECT * FROM pcmso_risk_monitoring_v2 WHERE pcmso_id=${input.id} AND company_id=${companyId}`
      );
      const countsResult: any = await db.execute(
        drzSql`SELECT (SELECT COUNT(*) FROM pcmso_attachments_v2 WHERE pcmso_id=${input.id} AND company_id=${companyId}) annexes,(SELECT COUNT(*) FROM pcmso_analytical_reports_v2 WHERE pcmso_id=${input.id} AND company_id=${companyId} AND status<>'descartado') reports`
      );
      const counts = rowsOf(countsResult)[0] || {};
      const result = auditPcmso({
        program,
        monitoring: rowsOf(monitoringResult),
        annexCount: Number(counts.annexes || 0),
        analyticalReportCount: Number(counts.reports || 0),
      });
      const aiCommentary = `${result.pending.length} pendência(s) exigem revisão humana. A auditoria verifica completude e coerência estrutural, sem certificar conformidade legal.`;
      await db.execute(
        drzSql`INSERT INTO pcmso_ai_audits_v2 (company_id,pcmso_id,score,result_json,ai_commentary,created_by) VALUES (${companyId},${input.id},${result.score},${JSON.stringify(result)},${aiCommentary},${Number(ctx.user.id)})`
      );
      await db.execute(
        drzSql`UPDATE pcmso_programs_v2 SET ai_audit_score=${result.score},pending_count=${result.pending.length} WHERE id=${input.id} AND company_id=${companyId}`
      );
      await audit(db, ctx, "pcmso_audited", "pcmso", input.id, null, {
        score: result.score,
        pending: result.pending.length,
      });
      return { ...result, aiCommentary };
    }),

  generateAnalyticalReport: protectedProcedure
    .input(
      z.object({
        pcmsoId: z.number().int().positive(),
        periodStart: dateInput,
        periodEnd: dateInput,
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireDoctor(ctx);
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (input.periodEnd < input.periodStart)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A data final deve ser igual ou posterior à data inicial.",
        });
      const own: any = await db.execute(
        drzSql`SELECT id,title FROM pcmso_programs_v2 WHERE id=${input.pcmsoId} AND company_id=${companyId} LIMIT 1`
      );
      if (!rowsOf(own).length) throw new TRPCError({ code: "NOT_FOUND" });
      const populationResult: any = await db.execute(
        drzSql`SELECT
          COUNT(DISTINCT h.collaborator_id) workers,
          COUNT(DISTINCT COALESCE(m.master_gse_id,l.gse_id)) gses,
          COUNT(DISTINCT CASE WHEN m.monitoring_kind='avaliacao_clinica' THEN 'clinico' ELSE CONCAT('exame-',m.exam_id) END) exam_types,
          COUNT(DISTINCT CONCAT(h.collaborator_id,':',CASE WHEN m.monitoring_kind='avaliacao_clinica' THEN 'clinico' ELSE CONCAT('exame-',m.exam_id) END)) planned_assignments
        FROM pcmso_risk_monitoring_v2 m
        LEFT JOIN occupational_gse_pgr_links l ON l.company_id=m.company_id AND l.pgr_gse_id=m.pgr_gse_id
        JOIN occupational_gse_worker_history h ON h.company_id=m.company_id AND h.gse_id=COALESCE(m.master_gse_id,l.gse_id) AND h.is_current=1
        JOIN users u ON u.id=h.collaborator_id AND u.company_id=h.company_id AND u.is_active=1
        WHERE m.company_id=${companyId} AND m.pcmso_id=${input.pcmsoId}
          AND m.monitoring_kind IN ('avaliacao_clinica','exame_complementar')
          AND (m.monitoring_kind='avaliacao_clinica' OR m.exam_id IS NOT NULL)
          AND m.suggestion_status IN ('aprovada','editada')`
      );
      const currentResults: any = await db.execute(
        drzSql`SELECT COUNT(*) total,COUNT(DISTINCT x.collaborator_id) workers,SUM(x.altered) altered FROM (
          SELECT DISTINCT r.id,r.collaborator_id,
            CASE WHEN r.classification NOT IN ('normal','apto','realizada','pendente_revisao') THEN 1 ELSE 0 END altered
          FROM occupational_exam_results r
          JOIN occupational_gse_worker_history h ON h.company_id=r.company_id AND h.collaborator_id=r.collaborator_id AND h.is_current=1
          JOIN pcmso_risk_monitoring_v2 m ON m.company_id=r.company_id AND m.pcmso_id=${input.pcmsoId} AND m.exam_id=r.exam_id
          LEFT JOIN occupational_gse_pgr_links l ON l.company_id=m.company_id AND l.pgr_gse_id=m.pgr_gse_id
          WHERE r.company_id=${companyId} AND DATE(r.performed_at) BETWEEN ${input.periodStart} AND ${input.periodEnd}
            AND COALESCE(m.master_gse_id,l.gse_id)=h.gse_id
        ) x`
      );
      const legacyResults: any = await db.execute(
        drzSql`SELECT COUNT(*) total,SUM(COALESCE(fitness_status,'') NOT IN ('apto','normal')) altered,COUNT(DISTINCT collaborator_id) workers FROM medical_occupational_exams_v2 WHERE company_id=${companyId} AND pcmso_id=${input.pcmsoId} AND DATE(performed_at) BETWEEN ${input.periodStart} AND ${input.periodEnd}`
      );
      const kindsResult: any = await db.execute(
        drzSql`SELECT e.name exam_kind,COUNT(DISTINCT r.id) total
          FROM occupational_exam_results r
          JOIN pcmso_exam_catalog_v2 e ON e.id=r.exam_id AND e.company_id=r.company_id
          JOIN occupational_gse_worker_history h ON h.company_id=r.company_id AND h.collaborator_id=r.collaborator_id AND h.is_current=1
          JOIN pcmso_risk_monitoring_v2 m ON m.company_id=r.company_id AND m.pcmso_id=${input.pcmsoId} AND m.exam_id=r.exam_id
          LEFT JOIN occupational_gse_pgr_links l ON l.company_id=m.company_id AND l.pgr_gse_id=m.pgr_gse_id
          WHERE r.company_id=${companyId} AND DATE(r.performed_at) BETWEEN ${input.periodStart} AND ${input.periodEnd}
            AND COALESCE(m.master_gse_id,l.gse_id)=h.gse_id
          GROUP BY e.id,e.name`
      );
      const encountersResult: any = await db.execute(
        drzSql`SELECT COUNT(*) total FROM medical_encounters_v2 WHERE company_id=${companyId} AND DATE(encounter_at) BETWEEN ${input.periodStart} AND ${input.periodEnd}`
      );
      const certificatesResult: any = await db.execute(
        drzSql`SELECT COUNT(*) total,SUM(total_days) days_lost,SUM(total_hours) hours_lost FROM medical_certificates_v2 WHERE company_id=${companyId} AND issue_date BETWEEN ${input.periodStart} AND ${input.periodEnd}`
      );
      const monitoringResult: any = await db.execute(
        drzSql`SELECT COUNT(*) total,SUM(monitoring_kind='nao_definido') pending FROM pcmso_risk_monitoring_v2 WHERE company_id=${companyId} AND pcmso_id=${input.pcmsoId}`
      );
      const population = rowsOf(populationResult)[0] || {};
      const current = rowsOf(currentResults)[0] || {};
      const legacy = rowsOf(legacyResults)[0] || {};
      const metrics = {
        exams: {
          total: Number(population.planned_assignments || 0),
          plannedAssignments: Number(population.planned_assignments || 0),
          examTypes: Number(population.exam_types || 0),
          workers: Number(population.workers || 0),
          gses: Number(population.gses || 0),
          performed: Number(current.total || 0)
            ? Number(current.total || 0)
            : Number(legacy.total || 0),
          altered: Number(current.total || 0)
            ? Number(current.altered || 0)
            : Number(legacy.altered || 0),
          resultWorkers: Number(current.total || 0)
            ? Number(current.workers || 0)
            : Number(legacy.workers || 0),
        },
        examKinds: rowsOf(kindsResult),
        encounters: rowsOf(encountersResult)[0] || {},
        certificates: rowsOf(certificatesResult)[0] || {},
        monitoring: rowsOf(monitoringResult)[0] || {},
      };
      const narrative = `No período de ${input.periodStart} a ${input.periodEnd}, o PCMSO previa ${Number(metrics.exams.plannedAssignments || 0)} procedimento(s) ocupacional(is), de ${Number(metrics.exams.examTypes || 0)} tipo(s), para ${Number(metrics.exams.workers || 0)} trabalhador(es) vinculados a ${Number(metrics.exams.gses || 0)} GSE(s). Foram registrados ${Number(metrics.exams.performed || 0)} resultado(s), ${Number(metrics.encounters.total || 0)} atendimento(s) e ${Number(metrics.certificates.total || 0)} atestado(s). Foram contabilizados ${Number(metrics.certificates.days_lost || 0)} dia(s) e ${Number(metrics.certificates.hours_lost || 0)} hora(s) de afastamento. Os dados devem ser interpretados pelo médico responsável em conjunto com o PGR, o perfil epidemiológico e a qualidade dos registros disponíveis.`;
      const recommendations = Number(metrics.monitoring.pending || 0)
        ? `Revisar ${Number(metrics.monitoring.pending)} risco(s) ainda sem decisão médica e avaliar tendências antes da apresentação ao SESMT/CIPA.`
        : "Manter o acompanhamento periódico, comparar a evolução com o período anterior e comunicar ao PGR alterações relevantes identificadas na análise médica consolidada.";
      const inserted: any = await db.execute(
        drzSql`INSERT INTO pcmso_analytical_reports_v2 (company_id,pcmso_id,period_start,period_end,metrics_json,narrative,recommendations,status,created_by) VALUES (${companyId},${input.pcmsoId},${input.periodStart},${input.periodEnd},${JSON.stringify(metrics)},${narrative},${recommendations},'em_revisao',${Number(ctx.user.id)})`
      );
      const id = Number((inserted as any)[0]?.insertId || 0);
      await audit(
        db,
        ctx,
        "pcmso_analytical_report_generated",
        "pcmso_report",
        id,
        null,
        {
          pcmsoId: input.pcmsoId,
        }
      );
      return { ok: true, id, metrics, narrative, recommendations };
    }),

  reviewAnalyticalReport: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        narrative: z.string().max(100000),
        recommendations: z.string().max(100000),
        status: z.enum(["em_revisao", "aprovado"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireDoctor(ctx);
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.execute(
        drzSql`UPDATE pcmso_analytical_reports_v2 SET narrative=${input.narrative},recommendations=${input.recommendations},status=${input.status},reviewed_by=${Number(ctx.user.id)},reviewed_at=NOW() WHERE id=${input.id} AND company_id=${companyId} AND status<>'descartado'`
      );
      await audit(
        db,
        ctx,
        "pcmso_analytical_report_reviewed",
        "pcmso_report",
        input.id,
        null,
        {
          status: input.status,
        }
      );
      return { ok: true };
    }),

  discardAnalyticalReport: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        reason: z.string().min(10).max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireDoctor(ctx);
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const own: any = await db.execute(
        drzSql`SELECT id,pcmso_id,status FROM pcmso_analytical_reports_v2 WHERE id=${input.id} AND company_id=${companyId} LIMIT 1`
      );
      const report = rowsOf(own)[0];
      if (!report) throw new TRPCError({ code: "NOT_FOUND" });
      if (report.status === "descartado") return { ok: true };
      await db.execute(
        drzSql`UPDATE pcmso_analytical_reports_v2 SET status='descartado',discarded_at=NOW(),discarded_by=${Number(ctx.user.id)},discard_reason=${input.reason} WHERE id=${input.id} AND company_id=${companyId}`
      );
      await audit(
        db,
        ctx,
        "pcmso_analytical_report_discarded",
        "pcmso_report",
        input.id,
        null,
        { pcmsoId: Number(report.pcmso_id), reason: input.reason }
      );
      return { ok: true };
    }),

  requestPgrReview: protectedProcedure
    .input(
      z.object({
        pcmsoId: z.number().int().positive(),
        gseName: z.string().max(255).optional(),
        riskName: z.string().max(500).optional(),
        description: z.string().min(10).max(100000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireDoctor(ctx);
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const own: any = await db.execute(
        drzSql`SELECT pgr_id FROM pcmso_programs_v2 WHERE id=${input.pcmsoId} AND company_id=${companyId} LIMIT 1`
      );
      const program = rowsOf(own)[0];
      if (!program?.pgr_id)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "O PCMSO não possui PGR de referência.",
        });
      const inserted: any = await db.execute(
        drzSql`INSERT INTO pcmso_pgr_review_requests_v2 (company_id,pcmso_id,pgr_id,gse_name,risk_name,description,requested_by) VALUES (${companyId},${input.pcmsoId},${program.pgr_id},${input.gseName || null},${input.riskName || null},${input.description},${Number(ctx.user.id)})`
      );
      const id = Number((inserted as any)[0]?.insertId || 0);
      await audit(
        db,
        ctx,
        "pgr_review_requested",
        "pgr_review_request",
        id,
        null,
        {
          pcmsoId: input.pcmsoId,
        }
      );
      return { ok: true, id };
    }),

  signAndPublishPcmso: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        confirmation: z.literal(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireDoctor(ctx);
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const programResult: any = await db.execute(
        drzSql`SELECT * FROM pcmso_programs_v2 WHERE id=${input.id} AND company_id=${companyId} LIMIT 1`
      );
      const program = rowsOf(programResult)[0];
      if (!program) throw new TRPCError({ code: "NOT_FOUND" });
      const pendingResult: any = await db.execute(
        drzSql`SELECT COUNT(*) pending FROM pcmso_risk_monitoring_v2 WHERE pcmso_id=${input.id} AND company_id=${companyId} AND monitoring_kind='nao_definido'`
      );
      const reportResult: any = await db.execute(
        drzSql`SELECT COUNT(*) total FROM pcmso_analytical_reports_v2 WHERE pcmso_id=${input.id} AND company_id=${companyId} AND status='aprovado'`
      );
      if (Number(rowsOf(pendingResult)[0]?.pending || 0))
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Revise todos os riscos antes de assinar o PCMSO.",
        });
      if (!Number(rowsOf(reportResult)[0]?.total || 0))
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Aprove ao menos um relatório analítico antes da assinatura.",
        });
      if (Number(program.ai_audit_score || 0) < 70)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Execute a auditoria e corrija as pendências críticas antes da assinatura.",
        });
      const signatureHash = crypto
        .createHash("sha256")
        .update(
          `${companyId}:${input.id}:${ctx.user.id}:${Date.now()}:${program.current_version}`
        )
        .digest("hex");
      await db.execute(
        drzSql`UPDATE pcmso_programs_v2 SET status='vigente',signed_at=NOW(),signature_hash=${signatureHash},review_required=0 WHERE id=${input.id} AND company_id=${companyId}`
      );
      await audit(db, ctx, "pcmso_signed_published", "pcmso", input.id, null, {
        signatureHash,
      });
      return { ok: true, signatureHash };
    }),

  archivePcmso: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireDoctor(ctx);
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.execute(
        drzSql`UPDATE pcmso_programs_v2 SET status='arquivado',archived_at=NOW() WHERE id=${input.id} AND company_id=${companyId}`
      );
      await audit(db, ctx, "pcmso_archived", "pcmso", input.id);
      return { ok: true };
    }),

  listSharedPcmso: protectedProcedure.query(async ({ ctx }) => {
    requirePcmsoRead(ctx);
    await ensureTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) return [];
    const result: any = await db.execute(
      drzSql`SELECT p.id,p.title,p.status,p.valid_from,p.valid_until,p.doctor_name,p.doctor_crm,p.current_version,p.signed_at,p.updated_at,
        (SELECT v.id FROM pcmso_versions_v2 v WHERE v.pcmso_id=p.id AND v.company_id=p.company_id ORDER BY v.version_number DESC LIMIT 1) latest_version_id
        FROM pcmso_programs_v2 p WHERE p.company_id=${companyId} ORDER BY (p.status='vigente') DESC,p.updated_at DESC`
    );
    return rowsOf(result);
  }),

  addAnnex: protectedProcedure
    .input(
      z.object({
        pcmsoId: z.number().int().positive(),
        annexNumber: z.number().int().min(1).max(8),
        title: z.string().max(255).optional(),
        fileName: z.string().min(1).max(255),
        fileBase64: z.string().min(20).max(20_000_000),
        sortOrder: z.number().int().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireDoctor(ctx);
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const own: any = await db.execute(
        drzSql`SELECT id FROM pcmso_programs_v2 WHERE id=${input.pcmsoId} AND company_id=${companyId} LIMIT 1`
      );
      if (!rowsOf(own).length) throw new TRPCError({ code: "NOT_FOUND" });
      const file = savePrivateFile(
        companyId,
        `pcmso_${input.pcmsoId}`,
        input.fileName,
        input.fileBase64
      );
      const result: any = await db.execute(
        drzSql`INSERT INTO pcmso_attachments_v2 (company_id,pcmso_id,annex_number,title,file_name,mime_type,private_path,sort_order,uploaded_by) VALUES (${companyId},${input.pcmsoId},${input.annexNumber},${input.title || null},${input.fileName},${file.mimeType},${file.target},${input.sortOrder},${Number(ctx.user.id)})`
      );
      const id = Number((result as any)[0]?.insertId || 0);
      await audit(db, ctx, "pcmso_annex_uploaded", "pcmso_annex", id, null, {
        pcmsoId: input.pcmsoId,
        annexNumber: input.annexNumber,
      });
      return { ok: true, id };
    }),

  generatePcmsoPdf: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireDoctor(ctx);
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const programResult: any = await db.execute(
        drzSql`SELECT p.*,c.name company_name,c.cnpj,c.address,g.title pgr_title,rt.name pgr_responsible_name,rt.registration pgr_responsible_registration FROM pcmso_programs_v2 p JOIN companies c ON c.id=p.company_id LEFT JOIN pgr_documents g ON g.id=p.pgr_id LEFT JOIN responsible_technicians rt ON rt.company_id=p.company_id AND (rt.is_default_pgr=1 OR rt.is_default=1) WHERE p.id=${input.id} AND p.company_id=${companyId} ORDER BY rt.is_default_pgr DESC,rt.is_default DESC LIMIT 1`
      );
      const program = rowsOf(programResult)[0];
      if (!program) throw new TRPCError({ code: "NOT_FOUND" });
      const monitoringResult: any = await db.execute(
        drzSql`SELECT m.*,e.name exam_name,(SELECT COUNT(*) FROM occupational_gse_worker_history h WHERE h.company_id=m.company_id AND h.gse_id=m.master_gse_id AND h.is_current=1) population_count FROM pcmso_risk_monitoring_v2 m LEFT JOIN pcmso_exam_catalog_v2 e ON e.id=m.exam_id WHERE m.pcmso_id=${input.id} AND m.company_id=${companyId} ORDER BY m.gse_name,m.risk_name`
      );
      const annexesResult: any = await db.execute(
        drzSql`SELECT annex_number,title,file_name FROM pcmso_attachments_v2 WHERE pcmso_id=${input.id} AND company_id=${companyId} ORDER BY annex_number,sort_order,id`
      );
      const analyticalResult: any = await db.execute(
        drzSql`SELECT * FROM pcmso_analytical_reports_v2 WHERE pcmso_id=${input.id} AND company_id=${companyId} AND status='aprovado' ORDER BY period_end DESC,id DESC LIMIT 1`
      );
      const monitoring = rowsOf(monitoringResult);
      const annexes = rowsOf(annexesResult);
      const undecided = monitoring.filter(
        (row: any) => row.monitoring_kind === "nao_definido"
      ).length;
      if (undecided)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Existem ${undecided} risco(s) sem decisão médica de monitoramento.`,
        });
      const html = buildPcmsoPdfHtml({
        program,
        monitoring,
        annexes,
        analyticalReport: rowsOf(analyticalResult)[0],
      });
      const puppeteer = (await import("puppeteer")).default;
      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox"],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "load" });
      const pdf = await page.pdf({ format: "A4", printBackground: true });
      await browser.close();
      const version = Number(program.current_version || 1);
      const dir = path.join(privateRoot(companyId), `pcmso_${input.id}`);
      fs.mkdirSync(dir, { recursive: true });
      const target = path.join(dir, `pcmso_v${version}_${Date.now()}.pdf`);
      fs.writeFileSync(target, pdf);
      await db.execute(
        drzSql`INSERT INTO pcmso_versions_v2 (company_id,pcmso_id,version_number,pdf_private_path,generated_by) VALUES (${companyId},${input.id},${version},${target},${Number(ctx.user.id)})`
      );
      await db.execute(
        drzSql`UPDATE pcmso_programs_v2 SET pdf_private_path=${target},current_version=current_version+1 WHERE id=${input.id} AND company_id=${companyId}`
      );
      await audit(db, ctx, "pcmso_pdf_generated", "pcmso", input.id, null, {
        version,
      });
      return {
        fileName: `PCMSO_${version}.pdf`,
        mimeType: "application/pdf",
        dataBase64: `data:application/pdf;base64,${Buffer.from(pdf).toString("base64")}`,
        version,
      };
    }),

  getPatientRecord: protectedProcedure
    .input(z.object({ collaboratorId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      requireDoctor(ctx);
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) return null;
      const patient: any = await db.execute(
        drzSql`SELECT u.id,u.name,u.cpf,u.position,u.employment_status,b.name branch_name,s.name sector_name FROM users u LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN sectors s ON s.id=u.sector_id WHERE u.id=${input.collaboratorId} AND u.company_id=${companyId} LIMIT 1`
      );
      if (!rowsOf(patient).length) throw new TRPCError({ code: "NOT_FOUND" });
      const [encounters, referrals, certificates, medications, vaccines] =
        await Promise.all([
          db.execute(
            drzSql`SELECT * FROM medical_encounters_v2 WHERE company_id=${companyId} AND collaborator_id=${input.collaboratorId} ORDER BY encounter_at DESC,id DESC`
          ),
          db.execute(
            drzSql`SELECT * FROM medical_referrals_v2 WHERE company_id=${companyId} AND collaborator_id=${input.collaboratorId} ORDER BY referral_date DESC,id DESC`
          ),
          db.execute(
            drzSql`SELECT * FROM medical_certificates_v2 WHERE company_id=${companyId} AND collaborator_id=${input.collaboratorId} ORDER BY issue_date DESC,id DESC`
          ),
          db.execute(
            drzSql`SELECT * FROM medical_medications_v2 WHERE company_id=${companyId} AND collaborator_id=${input.collaboratorId} ORDER BY administered_at DESC,id DESC`
          ),
          db.execute(
            drzSql`SELECT r.*,v.name vaccine_name FROM medical_vaccination_records_v2 r JOIN medical_vaccines_v2 v ON v.id=r.vaccine_id WHERE r.company_id=${companyId} AND r.collaborator_id=${input.collaboratorId} ORDER BY vaccination_date DESC,id DESC`
          ),
        ]);
      await audit(
        db,
        ctx,
        "medical_record_viewed",
        "collaborator_medical_record",
        input.collaboratorId,
        input.collaboratorId
      );
      return {
        patient: rowsOf(patient)[0],
        encounters: rowsOf(encounters),
        referrals: rowsOf(referrals),
        certificates: rowsOf(certificates),
        medications: rowsOf(medications),
        vaccinations: rowsOf(vaccines),
      };
    }),

  createEncounter: protectedProcedure
    .input(
      z.object({
        collaboratorId: z.number().int().positive(),
        encounterAt: dateTimeInput,
        encounterType: z.string().min(2).max(80),
        reason: z.string().max(20000).optional(),
        clinicalNotes: z.string().max(100000).optional(),
        conduct: z.string().max(100000).optional(),
        guidance: z.string().max(100000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireDoctor(ctx);
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const signature = crypto
        .createHash("sha256")
        .update(JSON.stringify(input) + String(ctx.user.id) + Date.now())
        .digest("hex");
      const result: any = await db.execute(
        drzSql`INSERT INTO medical_encounters_v2 (company_id,collaborator_id,doctor_user_id,encounter_at,encounter_type,reason,clinical_notes,conduct,guidance,signature_hash) VALUES (${companyId},${input.collaboratorId},${Number(ctx.user.id)},${new Date(input.encounterAt)},${input.encounterType},${input.reason || null},${input.clinicalNotes || null},${input.conduct || null},${input.guidance || null},${signature})`
      );
      const id = Number((result as any)[0]?.insertId || 0);
      await audit(
        db,
        ctx,
        "medical_encounter_created",
        "medical_encounter",
        id,
        input.collaboratorId
      );
      return { ok: true, id, signature };
    }),

  createReferral: protectedProcedure
    .input(
      z.object({
        collaboratorId: z.number().int().positive(),
        encounterId: z.number().int().positive().nullable().optional(),
        referralDate: dateInput,
        destinationType: z.enum([
          "emergencia",
          "pronto_atendimento",
          "especialista",
          "clinica",
          "laboratorio",
          "servico_externo",
        ]),
        destinationName: z.string().max(255).optional(),
        reason: z.string().max(20000).optional(),
        guidance: z.string().max(20000).optional(),
        observations: z.string().max(20000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireDoctor(ctx);
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result: any = await db.execute(
        drzSql`INSERT INTO medical_referrals_v2 (company_id,collaborator_id,encounter_id,doctor_user_id,referral_date,destination_type,destination_name,reason,guidance,observations) VALUES (${companyId},${input.collaboratorId},${input.encounterId || null},${Number(ctx.user.id)},${input.referralDate},${input.destinationType},${input.destinationName || null},${input.reason || null},${input.guidance || null},${input.observations || null})`
      );
      const id = Number((result as any)[0]?.insertId || 0);
      await audit(
        db,
        ctx,
        "medical_referral_created",
        "medical_referral",
        id,
        input.collaboratorId
      );
      return { ok: true, id };
    }),

  createCertificate: protectedProcedure
    .input(
      z.object({
        collaboratorId: z.number().int().positive(),
        encounterId: z.number().int().positive().nullable().optional(),
        issueDate: dateInput,
        startAt: dateTimeInput,
        endAt: dateTimeInput,
        totalDays: z.number().min(0).max(9999).default(0),
        totalHours: z.number().min(0).max(99999).default(0),
        returnDate: dateInput.nullable().optional(),
        administrativeSummary: z.string().max(20000).optional(),
        clinicalPrivateNotes: z.string().max(100000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireDoctor(ctx);
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const signature = crypto
        .createHash("sha256")
        .update(JSON.stringify(input) + String(ctx.user.id) + Date.now())
        .digest("hex");
      const result: any = await db.execute(
        drzSql`INSERT INTO medical_certificates_v2 (company_id,collaborator_id,encounter_id,doctor_user_id,issue_date,start_at,end_at,total_days,total_hours,return_date,administrative_summary,clinical_private_notes,signature_hash) VALUES (${companyId},${input.collaboratorId},${input.encounterId || null},${Number(ctx.user.id)},${input.issueDate},${new Date(input.startAt)},${new Date(input.endAt)},${input.totalDays},${input.totalHours},${input.returnDate || null},${input.administrativeSummary || null},${input.clinicalPrivateNotes || null},${signature})`
      );
      const id = Number((result as any)[0]?.insertId || 0);
      await audit(
        db,
        ctx,
        "medical_certificate_created",
        "medical_certificate",
        id,
        input.collaboratorId
      );
      return { ok: true, id, signature };
    }),

  recordMedication: protectedProcedure
    .input(
      z.object({
        collaboratorId: z.number().int().positive(),
        encounterId: z.number().int().positive().nullable().optional(),
        medication: z.string().min(2).max(255),
        quantity: z.string().max(120).optional(),
        administeredAt: dateTimeInput,
        guidance: z.string().max(20000).optional(),
        observations: z.string().max(20000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireDoctor(ctx);
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result: any = await db.execute(
        drzSql`INSERT INTO medical_medications_v2 (company_id,collaborator_id,encounter_id,doctor_user_id,medication,quantity,administered_at,guidance,observations) VALUES (${companyId},${input.collaboratorId},${input.encounterId || null},${Number(ctx.user.id)},${input.medication},${input.quantity || null},${new Date(input.administeredAt)},${input.guidance || null},${input.observations || null})`
      );
      const id = Number((result as any)[0]?.insertId || 0);
      await audit(
        db,
        ctx,
        "medication_recorded",
        "medical_medication",
        id,
        input.collaboratorId
      );
      return { ok: true, id };
    }),

  listVaccines: protectedProcedure.query(async ({ ctx }) => {
    requireVaccinationRead(ctx);
    await ensureTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) return [];
    const result: any = await db.execute(
      drzSql`SELECT * FROM medical_vaccines_v2 WHERE company_id=${companyId} ORDER BY is_active DESC,name`
    );
    return rowsOf(result);
  }),

  upsertVaccine: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        name: z.string().min(2).max(255),
        manufacturer: z.string().max(255).optional(),
        vaccineType: z.string().max(120).optional(),
        indication: z.string().max(20000).optional(),
        doseCount: z.number().int().min(1).max(20).default(1),
        intervalDays: z.number().int().min(0).max(5000).nullable().optional(),
        notes: z.string().max(20000).optional(),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireVaccinationManager(ctx);
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let id = input.id || 0;
      if (id)
        await db.execute(
          drzSql`UPDATE medical_vaccines_v2 SET name=${input.name},manufacturer=${input.manufacturer || null},vaccine_type=${input.vaccineType || null},indication=${input.indication || null},dose_count=${input.doseCount},interval_days=${input.intervalDays ?? null},notes=${input.notes || null},is_active=${input.isActive ? 1 : 0} WHERE id=${id} AND company_id=${companyId}`
        );
      else {
        const result: any = await db.execute(
          drzSql`INSERT INTO medical_vaccines_v2 (company_id,name,manufacturer,vaccine_type,indication,dose_count,interval_days,notes,is_active,created_by) VALUES (${companyId},${input.name},${input.manufacturer || null},${input.vaccineType || null},${input.indication || null},${input.doseCount},${input.intervalDays ?? null},${input.notes || null},${input.isActive ? 1 : 0},${Number(ctx.user.id)})`
        );
        id = Number((result as any)[0]?.insertId || 0);
      }
      await audit(
        db,
        ctx,
        input.id ? "vaccine_updated" : "vaccine_created",
        "vaccine",
        id
      );
      return { ok: true, id };
    }),

  listVaccinePartners: protectedProcedure.query(async ({ ctx }) => {
    requireVaccinationRead(ctx);
    await ensureTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) return [];
    const result: any = await db.execute(
      drzSql`SELECT * FROM medical_vaccine_partners_v2 WHERE company_id=${companyId} ORDER BY name`
    );
    return rowsOf(result);
  }),

  upsertVaccinePartner: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        name: z.string().min(2).max(255),
        cnpj: z.string().max(30).optional(),
        contactName: z.string().max(255).optional(),
        phone: z.string().max(80).optional(),
        email: z.string().email().max(255).or(z.literal("")).optional(),
        address: z.string().max(20000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireVaccinationManager(ctx);
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let id = input.id || 0;
      if (id) {
        await db.execute(
          drzSql`UPDATE medical_vaccine_partners_v2 SET name=${input.name},cnpj=${input.cnpj || null},contact_name=${input.contactName || null},phone=${input.phone || null},email=${input.email || null},address=${input.address || null} WHERE id=${id} AND company_id=${companyId}`
        );
      } else {
        const result: any = await db.execute(
          drzSql`INSERT INTO medical_vaccine_partners_v2 (company_id,name,cnpj,contact_name,phone,email,address,created_by) VALUES (${companyId},${input.name},${input.cnpj || null},${input.contactName || null},${input.phone || null},${input.email || null},${input.address || null},${Number(ctx.user.id)})`
        );
        id = Number((result as any)[0]?.insertId || 0);
      }
      await audit(
        db,
        ctx,
        input.id ? "vaccine_partner_updated" : "vaccine_partner_created",
        "vaccine_partner",
        id
      );
      return { ok: true, id };
    }),

  listVaccineCampaigns: protectedProcedure.query(async ({ ctx }) => {
    requireVaccinationRead(ctx);
    await ensureTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) return [];
    const result: any = await db.execute(
      drzSql`SELECT c.*,v.name vaccine_name,p.name partner_name,b.name branch_name,s.name sector_name FROM medical_vaccine_campaigns_v2 c JOIN medical_vaccines_v2 v ON v.id=c.vaccine_id LEFT JOIN medical_vaccine_partners_v2 p ON p.id=c.partner_id LEFT JOIN branches b ON b.id=c.branch_id LEFT JOIN sectors s ON s.id=c.sector_id WHERE c.company_id=${companyId} ORDER BY c.campaign_at DESC`
    );
    return rowsOf(result);
  }),

  listVaccinationRecords: protectedProcedure.query(async ({ ctx }) => {
    requireVaccinationRead(ctx);
    await ensureTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) return [];
    const result: any = await db.execute(
      drzSql`SELECT r.*,u.name collaborator_name,u.cpf,v.name vaccine_name,c.name campaign_name
        FROM medical_vaccination_records_v2 r
        JOIN users u ON u.id=r.collaborator_id AND u.company_id=r.company_id
        JOIN medical_vaccines_v2 v ON v.id=r.vaccine_id AND v.company_id=r.company_id
        LEFT JOIN medical_vaccine_campaigns_v2 c ON c.id=r.campaign_id
        WHERE r.company_id=${companyId}
        ORDER BY r.vaccination_date DESC,r.id DESC LIMIT 5000`
    );
    return rowsOf(result);
  }),

  createVaccineCampaign: protectedProcedure
    .input(
      z.object({
        vaccineId: z.number().int().positive(),
        partnerId: z.number().int().positive().nullable().optional(),
        name: z.string().min(2).max(255),
        campaignAt: dateTimeInput,
        location: z.string().max(255).optional(),
        audienceText: z.string().max(20000).optional(),
        branchId: z.number().int().positive().nullable().optional(),
        sectorId: z.number().int().positive().nullable().optional(),
        estimatedQuantity: z.number().int().min(0).nullable().optional(),
        additionalInfo: z.string().max(20000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireVaccinationManager(ctx);
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result: any = await db.execute(
        drzSql`INSERT INTO medical_vaccine_campaigns_v2 (company_id,vaccine_id,partner_id,name,campaign_at,location,audience_text,branch_id,sector_id,estimated_quantity,additional_info,created_by) VALUES (${companyId},${input.vaccineId},${input.partnerId || null},${input.name},${new Date(input.campaignAt)},${input.location || null},${input.audienceText || null},${input.branchId || null},${input.sectorId || null},${input.estimatedQuantity ?? null},${input.additionalInfo || null},${Number(ctx.user.id)})`
      );
      const id = Number((result as any)[0]?.insertId || 0);
      await audit(db, ctx, "vaccine_campaign_created", "vaccine_campaign", id);
      return { ok: true, id };
    }),

  recordVaccination: protectedProcedure
    .input(
      z.object({
        collaboratorId: z.number().int().positive(),
        vaccineId: z.number().int().positive(),
        campaignId: z.number().int().positive().nullable().optional(),
        vaccinationDate: dateInput,
        doseNumber: z.number().int().min(1).max(20).default(1),
        lot: z.string().max(120).optional(),
        manufacturer: z.string().max(255).optional(),
        location: z.string().max(255).optional(),
        appliedBy: z.string().max(255).optional(),
        nextDoseDate: dateInput.nullable().optional(),
        observations: z.string().max(20000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireVaccinationManager(ctx);
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result: any = await db.execute(
        drzSql`INSERT INTO medical_vaccination_records_v2 (company_id,collaborator_id,vaccine_id,campaign_id,vaccination_date,dose_number,lot,manufacturer,location,applied_by,next_dose_date,observations,recorded_by) VALUES (${companyId},${input.collaboratorId},${input.vaccineId},${input.campaignId || null},${input.vaccinationDate},${input.doseNumber},${input.lot || null},${input.manufacturer || null},${input.location || null},${input.appliedBy || null},${input.nextDoseDate || null},${input.observations || null},${Number(ctx.user.id)})`
      );
      const id = Number((result as any)[0]?.insertId || 0);
      const receiptData: any = await db.execute(
        drzSql`SELECT c.name company_name,c.cnpj,u.name collaborator_name,u.cpf,v.name vaccine_name,COALESCE(${input.manufacturer || null},v.manufacturer) manufacturer FROM companies c JOIN users u ON u.company_id=c.id JOIN medical_vaccines_v2 v ON v.company_id=c.id WHERE c.id=${companyId} AND u.id=${input.collaboratorId} AND v.id=${input.vaccineId} LIMIT 1`
      );
      const receipt = rowsOf(receiptData)[0] || {};
      const receiptHtml = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>@page{size:A4;margin:22mm}body{font-family:Arial,sans-serif;color:#173044}h1{font-size:23pt;color:#0e2c46;border-bottom:4px solid #0096a6;padding-bottom:8mm}.box{border:1px solid #cad7df;padding:8mm;margin-top:8mm}.row{margin:3mm 0}.label{font-size:8pt;text-transform:uppercase;color:#617381}.value{font-size:12pt;font-weight:bold}.footer{margin-top:20mm;border-top:1px solid #173044;padding-top:4mm;text-align:center;font-size:9pt}</style></head><body><h1>Comprovante de Vacinação</h1><p>${esc(receipt.company_name)} · CNPJ ${esc(receipt.cnpj || "-")}</p><div class="box"><div class="row"><div class="label">Colaborador</div><div class="value">${esc(receipt.collaborator_name)}</div><div>${esc(receipt.cpf || "CPF não informado")}</div></div><div class="row"><div class="label">Vacina</div><div class="value">${esc(receipt.vaccine_name)}</div></div><div class="row"><div class="label">Dose e data</div><div class="value">Dose ${input.doseNumber} · ${esc(input.vaccinationDate)}</div></div><div class="row"><div class="label">Lote / fabricante</div><div class="value">${esc(input.lot || "Não informado")} · ${esc(receipt.manufacturer || "Não informado")}</div></div><div class="row"><div class="label">Local / aplicador</div><div class="value">${esc(input.location || "Não informado")} · ${esc(input.appliedBy || "Não informado")}</div></div>${input.nextDoseDate ? `<div class="row"><div class="label">Próxima dose</div><div class="value">${esc(input.nextDoseDate)}</div></div>` : ""}</div><div class="footer">Registro ${id} · Emitido pela plataforma em ${esc(new Date().toLocaleString("pt-BR"))}</div></body></html>`;
      let receiptPath: string | null = null;
      try {
        const puppeteer = (await import("puppeteer")).default;
        const browser = await puppeteer.launch({
          headless: true,
          args: ["--no-sandbox"],
        });
        const page = await browser.newPage();
        await page.setContent(receiptHtml, { waitUntil: "load" });
        const pdf = await page.pdf({ format: "A4", printBackground: true });
        await browser.close();
        const directory = path.join(
          privateRoot(companyId),
          `vaccination_${input.collaboratorId}`
        );
        fs.mkdirSync(directory, { recursive: true });
        receiptPath = path.join(directory, `comprovante_vacinacao_${id}.pdf`);
        fs.writeFileSync(receiptPath, pdf);
        await db.execute(
          drzSql`UPDATE medical_vaccination_records_v2 SET receipt_private_path=${receiptPath} WHERE id=${id} AND company_id=${companyId}`
        );
      } catch (error) {
        console.error("[medical] vaccination receipt generation failed", error);
      }
      await db.execute(
        drzSql`INSERT IGNORE INTO employee_dossier_documents_v2 (company_id,collaborator_id,category,title,source_module,source_record_id,file_name,mime_type,private_path,uploaded_by) VALUES (${companyId},${input.collaboratorId},'vacinacao',${`Comprovante de vacinação - ${input.vaccinationDate}`},'vaccination',${id},${receiptPath ? `comprovante_vacinacao_${id}.pdf` : null},${receiptPath ? "application/pdf" : null},${receiptPath},${Number(ctx.user.id)})`
      );
      await audit(
        db,
        ctx,
        "vaccination_recorded",
        "vaccination",
        id,
        input.collaboratorId
      );
      return { ok: true, id, receiptGenerated: !!receiptPath };
    }),

  myVaccinations: protectedProcedure.query(async ({ ctx }) => {
    await ensureTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) return [];
    const result: any = await db.execute(
      drzSql`SELECT r.id,r.vaccination_date,r.dose_number,r.lot,r.manufacturer,r.location,r.next_dose_date,r.observations,(r.receipt_private_path IS NOT NULL) has_receipt,v.name vaccine_name,v.dose_count FROM medical_vaccination_records_v2 r JOIN medical_vaccines_v2 v ON v.id=r.vaccine_id WHERE r.company_id=${companyId} AND r.collaborator_id=${Number(ctx.user.id)} ORDER BY r.vaccination_date DESC,r.id DESC`
    );
    return rowsOf(result);
  }),

  getDossier: protectedProcedure
    .input(z.object({ collaboratorId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      requireDossierAccess(ctx);
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) return null;
      const patient: any = await db.execute(
        drzSql`SELECT u.id,u.name,u.cpf,u.position,u.employment_status,b.name branch_name,s.name sector_name FROM users u LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN sectors s ON s.id=u.sector_id WHERE u.id=${input.collaboratorId} AND u.company_id=${companyId} LIMIT 1`
      );
      if (!rowsOf(patient).length) throw new TRPCError({ code: "NOT_FOUND" });
      const docs: any = await db.execute(
        drzSql`SELECT id,category,title,source_module,source_record_id,file_name,mime_type,created_at FROM employee_dossier_documents_v2 WHERE company_id=${companyId} AND collaborator_id=${input.collaboratorId} AND source_module='external' ORDER BY created_at DESC,id DESC`
      );
      const certificates: any = await db
        .execute(
          drzSql`SELECT c.id,m.title,c.certificateCode reference,c.issuedAt created_at FROM certificates c LEFT JOIN modules m ON m.id=c.moduleId WHERE c.userId=${input.collaboratorId} ORDER BY c.issuedAt DESC LIMIT 500`
        )
        .catch(() => [[]]);
      const epi: any = await db
        .execute(
          drzSql`SELECT d.id,a.description title,d.delivery_date created_at,d.signature_status status FROM epi_epc_deliveries d JOIN epi_epc_assets a ON a.id=d.asset_id WHERE d.company_id=${companyId} AND d.collaborator_id=${input.collaboratorId} ORDER BY d.delivery_date DESC LIMIT 500`
        )
        .catch(() => [[]]);
      const leaves: any = await db
        .execute(
          drzSql`SELECT id,document_type title,start_date created_at,status FROM occupational_leave_cases WHERE company_id=${companyId} AND collaborator_id=${input.collaboratorId} ORDER BY start_date DESC LIMIT 500`
        )
        .catch(() => [[]]);
      const vaccinations: any = await db
        .execute(
          drzSql`SELECT r.id,v.name title,r.vaccination_date created_at,r.dose_number FROM medical_vaccination_records_v2 r JOIN medical_vaccines_v2 v ON v.id=r.vaccine_id WHERE r.company_id=${companyId} AND r.collaborator_id=${input.collaboratorId} ORDER BY r.vaccination_date DESC`
        )
        .catch(() => [[]]);
      const gseHistory: any = await db
        .execute(
          drzSql`SELECT h.id,g.code title,h.valid_from created_at,h.valid_until,h.reason,h.origin,h.is_current FROM occupational_gse_worker_history h JOIN occupational_gse_master g ON g.id=h.gse_id WHERE h.company_id=${companyId} AND h.collaborator_id=${input.collaboratorId} ORDER BY h.valid_from DESC`
        )
        .catch(() => [[]]);
      const examOrders: any = await db
        .execute(
          drzSql`SELECT o.id,CONCAT(e.name,' - ',o.order_number) title,o.issue_date created_at,o.status,o.valid_until,o.version_number FROM occupational_exam_orders o JOIN pcmso_exam_catalog_v2 e ON e.id=o.exam_id WHERE o.company_id=${companyId} AND o.collaborator_id=${input.collaboratorId} ORDER BY o.created_at DESC LIMIT 500`
        )
        .catch(() => [[]]);
      const asos: any = await db
        .execute(
          drzSql`SELECT id,CONCAT('ASO ',REPLACE(aso_type,'_',' ')) title,issued_at created_at,status FROM occupational_asos WHERE company_id=${companyId} AND collaborator_id=${input.collaboratorId} ORDER BY issued_at DESC LIMIT 200`
        )
        .catch(() => [[]]);
      const cats: any = await db
        .execute(
          drzSql`SELECT id,CONCAT('CAT - ',COALESCE(accident_type,'acidente/incidente')) title,event_at created_at,status,esocial_status FROM occupational_cat_records WHERE company_id=${companyId} AND collaborator_id=${input.collaboratorId} ORDER BY event_at DESC LIMIT 200`
        )
        .catch(() => [[]]);
      const progress: any = await db
        .execute(
          drzSql`SELECT COUNT(*) total,SUM(isCompleted=1) completed,SUM(isCompleted=0) pending FROM user_progress WHERE userId=${input.collaboratorId}`
        )
        .catch(() => [[]]);
      const pendingEpi: any = await db
        .execute(
          drzSql`SELECT COUNT(*) total FROM epi_epc_deliveries WHERE company_id=${companyId} AND collaborator_id=${input.collaboratorId} AND signature_status NOT IN ('signed','assinado','comprovado')`
        )
        .catch(() => [[]]);
      const relatedTechnical: any = await db
        .execute(
          drzSql`SELECT COUNT(DISTINCT d.id) total
          FROM technical_documents_v2 d
          JOIN technical_document_risks_v2 r ON r.document_id=d.id AND r.company_id=d.company_id
          JOIN pgr_gse_setores gs ON gs.gse_id=r.pgr_gse_id
          JOIN users u ON u.id=${input.collaboratorId} AND u.company_id=d.company_id AND u.sector_id=gs.sector_id
          WHERE d.company_id=${companyId}`
        )
        .catch(() => [[]]);
      const progressRow = rowsOf(progress)[0] || {};
      const pendingEpiCount = Number(rowsOf(pendingEpi)[0]?.total || 0);
      const technicalCount = Number(rowsOf(relatedTechnical)[0]?.total || 0);
      const documentCount = rowsOf(docs).length;
      const certificateCount = rowsOf(certificates).length;
      const epiCount = rowsOf(epi).length;
      const leaveRows = rowsOf(leaves);
      const vaccinationRows = rowsOf(vaccinations);
      const gseRows = rowsOf(gseHistory);
      const orderRows = rowsOf(examOrders);
      const asoRows = rowsOf(asos);
      const catRows = rowsOf(cats);
      const pendingLeaves = leaveRows.filter(row =>
        ["pendente", "em_analise", "retorno_pendente"].includes(
          String(row.status || "")
        )
      ).length;
      const upcomingVaccines = vaccinationRows.filter(row => {
        if (!row.next_dose_date) return false;
        const days =
          (new Date(row.next_dose_date).getTime() - Date.now()) / 86_400_000;
        return days >= 0 && days <= 30;
      }).length;
      const shortcuts = [
        {
          key: "overview",
          label: "Visão 360",
          description: "Resumo funcional e histórico integrado",
          href: `/admin/colaboradores/${input.collaboratorId}`,
          count: null,
          priority: 1,
          status: "normal",
        },
        {
          key: "leaves",
          label: "Atestados e afastamentos",
          description: "Ausências, validações e retorno ao trabalho",
          href: `/admin/atestados-afastamentos?collaboratorId=${input.collaboratorId}`,
          count: leaveRows.length,
          priority: pendingLeaves ? 2 : 7,
          status: pendingLeaves ? "attention" : "normal",
        },
        {
          key: "epi",
          label: "EPI / EPC",
          description: "Entregas, recibos, trocas e pendências",
          href: `/admin/gestao-epi-epc?collaboratorId=${input.collaboratorId}`,
          count: epiCount,
          priority: pendingEpiCount ? 3 : 8,
          status: pendingEpiCount ? "attention" : "normal",
        },
        {
          key: "courses",
          label: "Cursos e certificados",
          description: "Progresso, conclusões e evidências",
          href: `/admin/usuarios/${input.collaboratorId}/historico`,
          count: Number(progressRow.pending || 0),
          priority: Number(progressRow.pending || 0) ? 4 : 9,
          status: Number(progressRow.pending || 0) ? "attention" : "normal",
        },
        {
          key: "vaccination",
          label: "Vacinação",
          description: "Doses, próximas aplicações e comprovantes",
          href: `/admin/vacinacao?collaboratorId=${input.collaboratorId}`,
          count: vaccinationRows.length,
          priority: upcomingVaccines ? 5 : 10,
          status: upcomingVaccines ? "attention" : "normal",
        },
        {
          key: "occupational",
          label: "Vida ocupacional",
          description: "GSE, requisições, ASO e CAT sem conteúdo clínico",
          href: `/admin/saude-ocupacional?collaboratorId=${input.collaboratorId}`,
          count: orderRows.length + asoRows.length + catRows.length,
          priority: 6,
          status: orderRows.some(row =>
            ["pendente", "vencida"].includes(String(row.status))
          )
            ? "attention"
            : "normal",
        },
        {
          key: "technical",
          label: "Documentos técnicos relacionados",
          description: "PGR, GSE e laudos aplicáveis ao setor",
          href: `/admin/documentos-tecnicos?collaboratorId=${input.collaboratorId}`,
          count: technicalCount,
          priority: 11,
          status: "normal",
        },
        {
          key: "documents",
          label: "Arquivo documental",
          description: "Documentos externos arquivados no dossiê",
          href: `/admin/colaboradores/${input.collaboratorId}/dossie#documentos`,
          count: documentCount,
          priority: 12,
          status: "normal",
        },
      ].sort((a, b) => a.priority - b.priority);
      return {
        patient: rowsOf(patient)[0],
        documents: rowsOf(docs),
        summary: {
          documents: documentCount,
          certificates: certificateCount,
          epiDeliveries: epiCount,
          epiPendingSignature: pendingEpiCount,
          leaves: leaveRows.length,
          pendingLeaves,
          vaccinations: vaccinationRows.length,
          upcomingVaccines,
          courses: Number(progressRow.total || 0),
          completedCourses: Number(progressRow.completed || 0),
          technicalDocuments: technicalCount,
          gseHistory: gseRows.length,
          examOrders: orderRows.length,
          asos: asoRows.length,
          cats: catRows.length,
        },
        shortcuts,
        integrations: {
          certificates: rowsOf(certificates),
          epiEpc: rowsOf(epi),
          leaves: rowsOf(leaves),
          vaccinations: rowsOf(vaccinations),
          gseHistory: gseRows,
          examOrders: orderRows,
          asos: asoRows,
          cats: catRows,
        },
      };
    }),

  addDossierDocument: protectedProcedure
    .input(
      z.object({
        collaboratorId: z.number().int().positive(),
        category: z.enum([
          "atestados",
          "epi_epc",
          "vacinacao",
          "treinamentos",
          "certificados",
          "qualificacoes",
          "exames",
          "documentos_externos",
          "outros",
        ]),
        title: z.string().min(2).max(255),
        fileName: z.string().min(1).max(255),
        fileBase64: z.string().min(20).max(20_000_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireDossierAccess(ctx);
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const own: any = await db.execute(
        drzSql`SELECT id FROM users WHERE id=${input.collaboratorId} AND company_id=${companyId} LIMIT 1`
      );
      if (!rowsOf(own).length) throw new TRPCError({ code: "NOT_FOUND" });
      const file = savePrivateFile(
        companyId,
        `dossier_${input.collaboratorId}`,
        input.fileName,
        input.fileBase64
      );
      const result: any = await db.execute(
        drzSql`INSERT INTO employee_dossier_documents_v2 (company_id,collaborator_id,category,title,source_module,file_name,mime_type,private_path,uploaded_by) VALUES (${companyId},${input.collaboratorId},${input.category},${input.title},'external',${input.fileName},${file.mimeType},${file.target},${Number(ctx.user.id)})`
      );
      const id = Number((result as any)[0]?.insertId || 0);
      await audit(
        db,
        ctx,
        "dossier_document_uploaded",
        "dossier_document",
        id,
        input.collaboratorId,
        { category: input.category }
      );
      return { ok: true, id };
    }),

  downloadPrivate: protectedProcedure
    .input(
      z.object({
        kind: z.enum([
          "pcmso_annex",
          "pcmso_version",
          "dossier",
          "vaccination_receipt",
        ]),
        id: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let query: any;
      if (input.kind === "pcmso_annex" || input.kind === "pcmso_version")
        requirePcmsoRead(ctx);
      else if (input.kind === "dossier") requireDossierAccess(ctx);
      if (input.kind === "pcmso_annex")
        query = await db.execute(
          drzSql`SELECT private_path path,file_name,mime_type FROM pcmso_attachments_v2 WHERE id=${input.id} AND company_id=${companyId} LIMIT 1`
        );
      else if (input.kind === "pcmso_version")
        query = await db.execute(
          drzSql`SELECT pdf_private_path path,CONCAT('PCMSO_v',version_number,'.pdf') file_name,'application/pdf' mime_type FROM pcmso_versions_v2 WHERE id=${input.id} AND company_id=${companyId} LIMIT 1`
        );
      else if (input.kind === "dossier")
        query = await db.execute(
          drzSql`SELECT private_path path,file_name,mime_type FROM employee_dossier_documents_v2 WHERE id=${input.id} AND company_id=${companyId} LIMIT 1`
        );
      else {
        const privileged = [
          "medico",
          "rh",
          "admin",
          "company_admin",
          "admin_global",
          "super_admin",
          "sesmt",
        ].includes(roleOf(ctx));
        query = await db.execute(
          privileged
            ? drzSql`SELECT receipt_private_path path,CONCAT('comprovante_vacinacao_',id,'.pdf') file_name,'application/pdf' mime_type FROM medical_vaccination_records_v2 WHERE id=${input.id} AND company_id=${companyId} LIMIT 1`
            : drzSql`SELECT receipt_private_path path,CONCAT('comprovante_vacinacao_',id,'.pdf') file_name,'application/pdf' mime_type FROM medical_vaccination_records_v2 WHERE id=${input.id} AND company_id=${companyId} AND collaborator_id=${Number(ctx.user.id)} LIMIT 1`
        );
      }
      const file = rowsOf(query)[0];
      if (!file?.path || !fs.existsSync(file.path))
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Arquivo não localizado.",
        });
      return {
        fileName: file.file_name,
        mimeType: file.mime_type,
        dataBase64: `data:${file.mime_type};base64,${fs.readFileSync(file.path).toString("base64")}`,
      };
    }),

  auditTrail: protectedProcedure
    .input(
      z.object({
        collaboratorId: z.number().int().positive().optional(),
        limit: z.number().int().min(1).max(500).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      requireDoctor(ctx);
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) return [];
      const result: any = input.collaboratorId
        ? await db.execute(
            drzSql`SELECT a.id,a.action,a.entity_type,a.entity_id,a.collaborator_id,a.created_at,u.name actor_name FROM medical_audit_log_v2 a JOIN users u ON u.id=a.actor_user_id WHERE a.company_id=${companyId} AND a.collaborator_id=${input.collaboratorId} ORDER BY a.created_at DESC LIMIT ${input.limit}`
          )
        : await db.execute(
            drzSql`SELECT a.id,a.action,a.entity_type,a.entity_id,a.collaborator_id,a.created_at,u.name actor_name FROM medical_audit_log_v2 a JOIN users u ON u.id=a.actor_user_id WHERE a.company_id=${companyId} ORDER BY a.created_at DESC LIMIT ${input.limit}`
          );
      return rowsOf(result);
    }),
});
