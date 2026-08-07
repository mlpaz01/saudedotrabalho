import { TRPCError } from "@trpc/server";
import { sql as drzSql } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { getDb } from "../db";
import { protectedProcedure, router } from "./trpc";

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

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS medical_professional_profiles (
    user_id INT PRIMARY KEY,
    company_id INT NOT NULL,
    crm VARCHAR(80),
    crm_state VARCHAR(10),
    specialty VARCHAR(180),
    signature_private_path VARCHAR(600),
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
    requireDoctor(ctx);
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
      drzSql`SELECT p.crm,p.crm_state,p.specialty,u.name FROM users u LEFT JOIN medical_professional_profiles p ON p.user_id=u.id WHERE u.id=${Number(ctx.user.id)} LIMIT 1`
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
      await db.execute(drzSql`INSERT INTO medical_professional_profiles (user_id,company_id,crm,crm_state,specialty,signature_private_path)
      VALUES (${Number(ctx.user.id)},${companyId},${input.crm},${input.crmState},${input.specialty || null},${signature})
      ON DUPLICATE KEY UPDATE crm=VALUES(crm),crm_state=VALUES(crm_state),specialty=VALUES(specialty),signature_private_path=COALESCE(VALUES(signature_private_path),signature_private_path)`);
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
        drzSql`SELECT * FROM pcmso_programs_v2 WHERE id=${input.id} AND company_id=${companyId} LIMIT 1`
      );
      const monitoring: any = await db.execute(
        drzSql`SELECT m.*,e.name exam_name FROM pcmso_risk_monitoring_v2 m LEFT JOIN pcmso_exam_catalog_v2 e ON e.id=m.exam_id WHERE m.pcmso_id=${input.id} AND m.company_id=${companyId} ORDER BY m.gse_name,m.risk_name`
      );
      const annexes: any = await db.execute(
        drzSql`SELECT id,annex_number,title,file_name,mime_type,sort_order,created_at FROM pcmso_attachments_v2 WHERE pcmso_id=${input.id} AND company_id=${companyId} ORDER BY annex_number,sort_order,id`
      );
      const versions: any = await db.execute(
        drzSql`SELECT id,version_number,generated_by,generated_at FROM pcmso_versions_v2 WHERE pcmso_id=${input.id} AND company_id=${companyId} ORDER BY version_number DESC`
      );
      return {
        program: rowsOf(program)[0] || null,
        monitoring: rowsOf(monitoring),
        annexes: rowsOf(annexes),
        versions: rowsOf(versions),
      };
    }),

  upsertProgram: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        pgrId: z.number().int().positive().nullable().optional(),
        title: z.string().min(3).max(255),
        status: z
          .enum(["rascunho", "em_revisao", "vigente", "arquivado"])
          .default("rascunho"),
        validFrom: dateInput.nullable().optional(),
        validUntil: dateInput.nullable().optional(),
        introduction: z.string().max(100000).optional(),
        objective: z.string().max(100000).optional(),
        methodology: z.string().max(100000).optional(),
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
        drzSql`SELECT u.name,p.crm,p.crm_state,p.signature_private_path FROM users u LEFT JOIN medical_professional_profiles p ON p.user_id=u.id WHERE u.id=${Number(ctx.user.id)} LIMIT 1`
      );
      const doctor = rowsOf(profile)[0] || {};
      if (!doctor.crm)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cadastre CRM e UF no perfil médico antes de criar o PCMSO.",
        });
      let id = input.id || 0;
      if (id) {
        const own: any = await db.execute(
          drzSql`SELECT id,status FROM pcmso_programs_v2 WHERE id=${id} AND company_id=${companyId} LIMIT 1`
        );
        if (!rowsOf(own).length) throw new TRPCError({ code: "NOT_FOUND" });
        await db.execute(
          drzSql`UPDATE pcmso_programs_v2 SET pgr_id=${input.pgrId || null},title=${input.title},status=${input.status},valid_from=${input.validFrom || null},valid_until=${input.validUntil || null},introduction=${input.introduction || null},objective=${input.objective || null},methodology=${input.methodology || null},chapters_json=${JSON.stringify(input.chapters)},header_text=${input.headerText || null},footer_text=${input.footerText || null},doctor_user_id=${Number(ctx.user.id)},doctor_name=${doctor.name},doctor_crm=${`${doctor.crm}/${doctor.crm_state}`},doctor_signature_private_path=${doctor.signature_private_path || null} WHERE id=${id} AND company_id=${companyId}`
        );
        await audit(db, ctx, "pcmso_updated", "pcmso", id, null, {
          status: input.status,
        });
      } else {
        const result: any =
          await db.execute(drzSql`INSERT INTO pcmso_programs_v2 (company_id,pgr_id,title,status,valid_from,valid_until,introduction,objective,methodology,chapters_json,header_text,footer_text,doctor_user_id,doctor_name,doctor_crm,doctor_signature_private_path,created_by)
        VALUES (${companyId},${input.pgrId || null},${input.title},${input.status},${input.validFrom || null},${input.validUntil || null},${input.introduction || null},${input.objective || null},${input.methodology || null},${JSON.stringify(input.chapters)},${input.headerText || null},${input.footerText || null},${Number(ctx.user.id)},${doctor.name},${`${doctor.crm}/${doctor.crm_state}`},${doctor.signature_private_path || null},${Number(ctx.user.id)})`);
        id = Number((result as any)[0]?.insertId || 0);
        await audit(db, ctx, "pcmso_created", "pcmso", id);
      }
      return { ok: true, id };
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
        await db.execute(drzSql`SELECT g.id gse_id,g.nome gse_name,r.id risk_id,r.nome risk_name,r.tipo risk_type,r.classificacao risk_classification,d.descricao_tecnica technical_detail
      FROM pgr_gse g JOIN pgr_documents p ON p.id=g.pgr_id LEFT JOIN pgr_gse_riscos r ON r.gse_id=g.id LEFT JOIN pgr_gse_riscos_detalhe d ON d.risco_id=r.id
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
        const result: any =
          await db.execute(drzSql`INSERT IGNORE INTO pcmso_risk_monitoring_v2 (company_id,pcmso_id,pgr_id,pgr_gse_id,pgr_risk_id,branch_name,sector_name,gse_name,risk_name,risk_type,risk_classification,technical_detail,monitoring_kind)
        VALUES (${companyId},${input.pcmsoId},${input.pgrId},${row.gse_id || null},${row.risk_id || null},${row.branch_name || null},${row.sector_name || null},${row.gse_name || "Sem GSE"},${row.risk_name},${row.risk_type || null},${row.risk_classification || null},${row.technical_detail || null},'nao_definido')`);
        imported += Number((result as any)[0]?.affectedRows || 0);
      }
      await db.execute(
        drzSql`UPDATE pcmso_programs_v2 SET pgr_id=${input.pgrId} WHERE id=${input.pcmsoId} AND company_id=${companyId}`
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
    requireDoctor(ctx);
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
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireDoctor(ctx);
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let id = input.id || 0;
      if (id)
        await db.execute(
          drzSql`UPDATE pcmso_exam_catalog_v2 SET name=${input.name},exam_type=${input.examType},description=${input.description || null},default_periodicity=${input.defaultPeriodicity || null},is_active=${input.isActive ? 1 : 0} WHERE id=${id} AND company_id=${companyId}`
        );
      else {
        const result: any = await db.execute(
          drzSql`INSERT INTO pcmso_exam_catalog_v2 (company_id,name,exam_type,description,default_periodicity,is_active,created_by) VALUES (${companyId},${input.name},${input.examType},${input.description || null},${input.defaultPeriodicity || null},${input.isActive ? 1 : 0},${Number(ctx.user.id)})`
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireDoctor(ctx);
      await ensureTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (input.monitoringKind === "exame_complementar" && !input.examId)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selecione o exame complementar.",
        });
      await db.execute(
        drzSql`UPDATE pcmso_risk_monitoring_v2 SET monitoring_kind=${input.monitoringKind},exam_id=${input.examId || null},monitoring_name=${input.monitoringName || null},periodicity=${input.periodicity || null},applicability=${input.applicability || null},observations=${input.observations || null},decision_by=${Number(ctx.user.id)},decision_at=NOW() WHERE id=${input.id} AND company_id=${companyId}`
      );
      await audit(
        db,
        ctx,
        "risk_monitoring_decided",
        "pcmso_risk_monitoring",
        input.id,
        null,
        { monitoringKind: input.monitoringKind, examId: input.examId || null }
      );
      return { ok: true };
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
        drzSql`SELECT p.*,c.name company_name,c.cnpj,c.address FROM pcmso_programs_v2 p JOIN companies c ON c.id=p.company_id WHERE p.id=${input.id} AND p.company_id=${companyId} LIMIT 1`
      );
      const program = rowsOf(programResult)[0];
      if (!program) throw new TRPCError({ code: "NOT_FOUND" });
      const monitoringResult: any = await db.execute(
        drzSql`SELECT m.*,e.name exam_name FROM pcmso_risk_monitoring_v2 m LEFT JOIN pcmso_exam_catalog_v2 e ON e.id=m.exam_id WHERE m.pcmso_id=${input.id} AND m.company_id=${companyId} ORDER BY m.gse_name,m.risk_name`
      );
      const annexesResult: any = await db.execute(
        drzSql`SELECT annex_number,title,file_name FROM pcmso_attachments_v2 WHERE pcmso_id=${input.id} AND company_id=${companyId} ORDER BY annex_number,sort_order,id`
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
      let chapters: any[] = [];
      try {
        chapters = JSON.parse(program.chapters_json || "[]");
      } catch {}
      const rows = monitoring
        .map(
          (row: any) =>
            `<tr><td>${esc(row.gse_name || "-")}</td><td><b>${esc(row.risk_name)}</b><br><span>${esc(row.technical_detail || "Sem detalhamento no PGR")}</span></td><td>${esc(row.risk_classification || "-")}</td><td>${esc(row.monitoring_kind.replaceAll("_", " "))}<br><b>${esc(row.exam_name || row.monitoring_name || "-")}</b><br>${esc(row.periodicity || "-")}</td><td>${esc(row.observations || "-")}</td></tr>`
        )
        .join("");
      const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>@page{size:A4;margin:20mm 16mm}body{font-family:Arial,sans-serif;color:#172b3a;font-size:10pt;line-height:1.45}h1{font-size:25pt;color:#0e2c46}h2{margin-top:10mm;color:#0e2c46;border-bottom:2px solid #0096a6;padding-bottom:2mm}table{width:100%;border-collapse:collapse;font-size:8pt}th,td{border:1px solid #d7e1e8;padding:2mm;vertical-align:top}th{background:#0e2c46;color:#fff}.cover{height:240mm;display:flex;flex-direction:column;justify-content:center;text-align:center;page-break-after:always}.meta{color:#607486}.signature{margin-top:18mm;text-align:center}.signature-line{border-top:1px solid #172b3a;width:75mm;margin:0 auto 2mm}.page-break{page-break-before:always}</style></head><body><section class="cover"><h1>${esc(program.title)}</h1><h2>${esc(program.company_name)}</h2><p>CNPJ: ${esc(program.cnpj || "-")}<br>Vigência: ${esc(program.valid_from || "-")} a ${esc(program.valid_until || "-")}</p><p class="meta">Programa de Controle Médico de Saúde Ocupacional</p></section><h2>1. Identificação</h2><p><b>Empresa:</b> ${esc(program.company_name)}<br><b>CNPJ:</b> ${esc(program.cnpj || "-")}<br><b>Endereço:</b> ${esc(program.address || "-")}<br><b>Médico responsável:</b> ${esc(program.doctor_name)} - ${esc(program.doctor_crm)}</p><h2>2. Introdução</h2><p>${esc(program.introduction || "")}</p><h2>3. Objetivo</h2><p>${esc(program.objective || "")}</p><h2>4. Metodologia</h2><p>${esc(program.methodology || "")}</p>${chapters.map((chapter, index) => `<h2>${index + 5}. ${esc(chapter.title)}</h2><p>${esc(chapter.content)}</p>`).join("")}<div class="page-break"></div><h2>Monitoramento por GSE e risco</h2><table><thead><tr><th>GSE</th><th>Risco e detalhamento</th><th>Classificação</th><th>Monitoramento</th><th>Observações</th></tr></thead><tbody>${rows || '<tr><td colspan="5">Nenhum risco importado.</td></tr>'}</tbody></table><h2>Anexos associados</h2><ol>${annexes.map((item: any) => `<li>Anexo ${item.annex_number}: ${esc(item.title || item.file_name)}</li>`).join("") || "<li>Nenhum anexo associado.</li>"}</ol><div class="signature"><div class="signature-line"></div><b>${esc(program.doctor_name)}</b><br>${esc(program.doctor_crm)}</div></body></html>`;
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
    requireDoctor(ctx);
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
      requireDoctor(ctx);
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
    requireDoctor(ctx);
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
      requireDoctor(ctx);
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
    requireDoctor(ctx);
    await ensureTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) return [];
    const result: any = await db.execute(
      drzSql`SELECT c.*,v.name vaccine_name,p.name partner_name,b.name branch_name,s.name sector_name FROM medical_vaccine_campaigns_v2 c JOIN medical_vaccines_v2 v ON v.id=c.vaccine_id LEFT JOIN medical_vaccine_partners_v2 p ON p.id=c.partner_id LEFT JOIN branches b ON b.id=c.branch_id LEFT JOIN sectors s ON s.id=c.sector_id WHERE c.company_id=${companyId} ORDER BY c.campaign_at DESC`
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
      requireDoctor(ctx);
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
      requireDoctor(ctx);
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
      return {
        patient: rowsOf(patient)[0],
        documents: rowsOf(docs),
        integrations: {
          certificates: rowsOf(certificates),
          epiEpc: rowsOf(epi),
          leaves: rowsOf(leaves),
          vaccinations: rowsOf(vaccinations),
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
        requireDoctor(ctx);
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
