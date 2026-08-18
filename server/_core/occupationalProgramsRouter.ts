import { TRPCError } from "@trpc/server";
import { sql as drzSql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import {
  activeEmployeeSql,
  ensureActiveEmployeeColumns,
} from "./activeEmployees";
import {
  ensureOccupationalTables,
  savePrivateFile,
} from "./occupationalLifecycleRouter";
import { protectedProcedure, router } from "./trpc";

let tablesReady = false;

function rowsOf(result: any): any[] {
  return Array.isArray(result?.[0])
    ? result[0]
    : Array.isArray(result)
      ? result
      : [];
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

function requireManager(ctx: any) {
  if (
    ![
      "rh",
      "sesmt",
      "medico",
      "admin",
      "company_admin",
      "admin_global",
      "super_admin",
    ].includes(String(ctx.user?.role || ""))
  )
    throw new TRPCError({ code: "FORBIDDEN" });
}

async function audit(
  db: any,
  ctx: any,
  action: string,
  entityType: string,
  entityId: number,
  collaboratorId?: number | null,
  before?: any,
  after?: any
) {
  await db.execute(drzSql`INSERT INTO occupational_program_audit_log
    (company_id,actor_user_id,action,entity_type,entity_id,collaborator_id,before_json,after_json)
    VALUES (${companyOf(ctx)},${Number(ctx.user.id)},${action},${entityType},${entityId},${collaboratorId || null},${before ? JSON.stringify(before) : null},${after ? JSON.stringify(after) : null})`);
}

function quotaRate(total: number) {
  if (total < 100) return 0;
  if (total <= 200) return 0.02;
  if (total <= 500) return 0.03;
  if (total <= 1000) return 0.04;
  return 0.05;
}

export async function ensureOccupationalProgramTables() {
  if (tablesReady) return;
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  await ensureActiveEmployeeColumns(db);
  await ensureOccupationalTables();
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS occupational_pcd_cases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    collaborator_id INT NOT NULL,
    declared_type VARCHAR(80) NOT NULL DEFAULT 'pcd',
    disability_type VARCHAR(120),
    description MEDIUMTEXT,
    status VARCHAR(40) NOT NULL DEFAULT 'pendente',
    validation_conclusion MEDIUMTEXT,
    complementary_assessment MEDIUMTEXT,
    quota_eligible TINYINT(1) NOT NULL DEFAULT 0,
    reviewed_by INT NULL,
    reviewed_at DATETIME NULL,
    next_review_date DATE NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_pcd_worker (company_id,collaborator_id),
    INDEX idx_pcd_status (company_id,status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS occupational_pcd_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    case_id INT NOT NULL,
    document_type VARCHAR(100) NOT NULL,
    document_date DATE NULL,
    professional_name VARCHAR(255),
    professional_registration VARCHAR(120),
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(120),
    private_path VARCHAR(700) NOT NULL,
    document_status VARCHAR(40) NOT NULL DEFAULT 'pendente',
    notes MEDIUMTEXT,
    uploaded_by INT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pcd_documents (company_id,case_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS occupational_pca_cases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    collaborator_id INT NOT NULL,
    gse_id INT NULL,
    source_result_id INT NULL,
    source_exam_id INT NULL,
    detected_at DATETIME NOT NULL,
    finding_summary MEDIUMTEXT,
    comparison_summary MEDIUMTEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'triagem_pendente',
    medical_review_required TINYINT(1) NOT NULL DEFAULT 1,
    repeat_exam_required TINYINT(1) NOT NULL DEFAULT 0,
    ent_referral_required TINYINT(1) NOT NULL DEFAULT 0,
    occupational_nexus_review VARCHAR(40) NOT NULL DEFAULT 'nao_avaliado',
    cat_review_status VARCHAR(40) NOT NULL DEFAULT 'nao_avaliado',
    medical_conclusion MEDIUMTEXT,
    next_action VARCHAR(500),
    due_date DATE NULL,
    reviewed_by INT NULL,
    reviewed_at DATETIME NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_pca_source_result (company_id,source_result_id),
    INDEX idx_pca_status (company_id,status,due_date),
    INDEX idx_pca_worker (company_id,collaborator_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS occupational_pca_actions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    case_id INT NOT NULL,
    action_type VARCHAR(80) NOT NULL,
    description MEDIUMTEXT NOT NULL,
    scheduled_for DATETIME NULL,
    completed_at DATETIME NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'pendente',
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pca_actions (company_id,case_id,status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS occupational_program_audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    actor_user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id INT NOT NULL,
    collaborator_id INT NULL,
    before_json LONGTEXT,
    after_json LONGTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_program_audit (company_id,entity_type,entity_id,created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  tablesReady = true;
}

const pcdStatus = z.enum([
  "pendente",
  "em_analise",
  "validado",
  "nao_validado",
  "necessita_complementacao",
]);

const pcaStatus = z.enum([
  "triagem_pendente",
  "convocacao_pendente",
  "avaliacao_medica",
  "encaminhado",
  "repeticao_pendente",
  "acompanhamento",
  "concluido",
]);

export const occupationalProgramsRouter = router({
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    requireManager(ctx);
    await ensureOccupationalProgramTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) return null;
    const [employeesResult, pcdResult, pcaResult, exposedResult] =
      await Promise.all([
        db.execute(
          drzSql.raw(
            `SELECT COUNT(*) total FROM users u WHERE u.company_id=${companyId} AND ${activeEmployeeSql("u")}`
          )
        ),
        db.execute(
          drzSql`SELECT COUNT(*) declared,SUM(status='validado') validated,SUM(status='validado' AND quota_eligible=1) quota_validated,SUM(status IN ('pendente','em_analise','necessita_complementacao')) pending FROM occupational_pcd_cases WHERE company_id=${companyId}`
        ),
        db.execute(
          drzSql`SELECT COUNT(*) total,SUM(status<>'concluido') open_cases,SUM(repeat_exam_required=1 AND status<>'concluido') repeats,SUM(ent_referral_required=1 AND status<>'concluido') referrals,SUM(cat_review_status='avaliar') cat_review FROM occupational_pca_cases WHERE company_id=${companyId}`
        ),
        db.execute(
          drzSql`SELECT COUNT(DISTINCT h.collaborator_id) total FROM occupational_gse_worker_history h JOIN pgr_gse pg ON pg.master_gse_id=h.gse_id JOIN pgr_gse_riscos r ON r.gse_id=pg.id JOIN users u ON u.id=h.collaborator_id AND u.company_id=h.company_id WHERE h.company_id=${companyId} AND h.is_current=1 AND ${drzSql.raw(activeEmployeeSql("u"))} AND (LOWER(r.agente) LIKE '%ruído%' OR LOWER(r.agente) LIKE '%ruido%' OR LOWER(r.tipo) LIKE '%físico%' OR LOWER(r.tipo) LIKE '%fisico%')`
        ),
      ]);
    const employees = Number(rowsOf(employeesResult)[0]?.total || 0);
    const pcd = rowsOf(pcdResult)[0] || {};
    const pca = rowsOf(pcaResult)[0] || {};
    const rate = quotaRate(employees);
    const required = rate ? Math.ceil(employees * rate) : 0;
    const validated = Number(pcd.quota_validated || 0);
    return {
      employees,
      pcd: {
        declared: Number(pcd.declared || 0),
        validated: Number(pcd.validated || 0),
        quotaValidated: validated,
        pending: Number(pcd.pending || 0),
        quotaRate: rate,
        estimatedRequired: required,
        estimatedGap: Math.max(0, required - validated),
      },
      pca: {
        total: Number(pca.total || 0),
        openCases: Number(pca.open_cases || 0),
        repeats: Number(pca.repeats || 0),
        referrals: Number(pca.referrals || 0),
        catReview: Number(pca.cat_review || 0),
        exposedWorkers: Number(rowsOf(exposedResult)[0]?.total || 0),
      },
    };
  }),

  listWorkers: protectedProcedure
    .input(z.object({ search: z.string().max(120).optional() }).optional())
    .query(async ({ ctx, input }) => {
      requireManager(ctx);
      await ensureOccupationalProgramTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) return [];
      const search = `%${String(input?.search || "").trim()}%`;
      const result: any = await db.execute(
        drzSql`SELECT u.id,u.name,u.cpf,u.employee_registration,u.position,b.name branch_name,s.name sector_name FROM users u LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN sectors s ON s.id=u.sector_id WHERE u.company_id=${companyId} AND ${drzSql.raw(activeEmployeeSql("u"))} AND (${!input?.search} OR u.name LIKE ${search} OR u.cpf LIKE ${search} OR u.employee_registration LIKE ${search}) ORDER BY u.name LIMIT 500`
      );
      return rowsOf(result);
    }),

  listPcdCases: protectedProcedure.query(async ({ ctx }) => {
    requireManager(ctx);
    await ensureOccupationalProgramTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) return [];
    const result: any = await db.execute(
      drzSql`SELECT p.*,u.name collaborator_name,u.cpf,u.employee_registration,u.position,b.name branch_name,s.name sector_name,reviewer.name reviewer_name,(SELECT COUNT(*) FROM occupational_pcd_documents d WHERE d.case_id=p.id AND d.company_id=p.company_id) documents_count FROM occupational_pcd_cases p JOIN users u ON u.id=p.collaborator_id AND u.company_id=p.company_id LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN sectors s ON s.id=u.sector_id LEFT JOIN users reviewer ON reviewer.id=p.reviewed_by WHERE p.company_id=${companyId} ORDER BY FIELD(p.status,'pendente','em_analise','necessita_complementacao','validado','nao_validado'),p.updated_at DESC`
    );
    return rowsOf(result);
  }),

  upsertPcdCase: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        collaboratorId: z.number().int().positive(),
        declaredType: z.enum(["pcd", "reabilitado_inss"]).default("pcd"),
        disabilityType: z.string().max(120).optional(),
        description: z.string().max(100000).optional(),
        status: pcdStatus.default("pendente"),
        validationConclusion: z.string().max(100000).optional(),
        complementaryAssessment: z.string().max(100000).optional(),
        quotaEligible: z.boolean().default(false),
        nextReviewDate: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireManager(ctx);
      await ensureOccupationalProgramTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const worker: any = await db.execute(
        drzSql`SELECT id FROM users WHERE id=${input.collaboratorId} AND company_id=${companyId} LIMIT 1`
      );
      if (!rowsOf(worker).length) throw new TRPCError({ code: "NOT_FOUND" });
      let id = Number(input.id || 0);
      let before: any = null;
      if (id) {
        const current: any = await db.execute(
          drzSql`SELECT * FROM occupational_pcd_cases WHERE id=${id} AND company_id=${companyId} LIMIT 1`
        );
        before = rowsOf(current)[0];
        if (!before) throw new TRPCError({ code: "NOT_FOUND" });
        await db.execute(
          drzSql`UPDATE occupational_pcd_cases SET collaborator_id=${input.collaboratorId},declared_type=${input.declaredType},disability_type=${input.disabilityType || null},description=${input.description || null},status=${input.status},validation_conclusion=${input.validationConclusion || null},complementary_assessment=${input.complementaryAssessment || null},quota_eligible=${input.quotaEligible ? 1 : 0},next_review_date=${input.nextReviewDate || null},reviewed_by=${input.status === "pendente" ? null : Number(ctx.user.id)},reviewed_at=${input.status === "pendente" ? null : new Date()} WHERE id=${id} AND company_id=${companyId}`
        );
      } else {
        const inserted: any = await db.execute(
          drzSql`INSERT INTO occupational_pcd_cases (company_id,collaborator_id,declared_type,disability_type,description,status,validation_conclusion,complementary_assessment,quota_eligible,next_review_date,reviewed_by,reviewed_at,created_by) VALUES (${companyId},${input.collaboratorId},${input.declaredType},${input.disabilityType || null},${input.description || null},${input.status},${input.validationConclusion || null},${input.complementaryAssessment || null},${input.quotaEligible ? 1 : 0},${input.nextReviewDate || null},${input.status === "pendente" ? null : Number(ctx.user.id)},${input.status === "pendente" ? null : new Date()},${Number(ctx.user.id)})`
        );
        id = Number((inserted as any)[0]?.insertId || 0);
      }
      await audit(
        db,
        ctx,
        input.id ? "pcd_case_updated" : "pcd_case_created",
        "pcd_case",
        id,
        input.collaboratorId,
        before,
        input
      );
      return { ok: true, id };
    }),

  uploadPcdDocument: protectedProcedure
    .input(
      z.object({
        caseId: z.number().int().positive(),
        documentType: z.string().min(2).max(100),
        documentDate: z.string().nullable().optional(),
        professionalName: z.string().max(255).optional(),
        professionalRegistration: z.string().max(120).optional(),
        documentStatus: z.enum(["pendente", "aprovado", "nao_validado"]),
        notes: z.string().max(100000).optional(),
        fileName: z.string().min(1).max(255),
        fileBase64: z.string().min(20),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireManager(ctx);
      await ensureOccupationalProgramTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const own: any = await db.execute(
        drzSql`SELECT id,collaborator_id FROM occupational_pcd_cases WHERE id=${input.caseId} AND company_id=${companyId} LIMIT 1`
      );
      const current = rowsOf(own)[0];
      if (!current) throw new TRPCError({ code: "NOT_FOUND" });
      const file = savePrivateFile(
        companyId,
        `pcd/caso_${input.caseId}`,
        input.fileName,
        input.fileBase64
      );
      const mimeType =
        String(input.fileBase64).match(/^data:([^;]+);base64,/)?.[1] ||
        "application/octet-stream";
      const inserted: any = await db.execute(
        drzSql`INSERT INTO occupational_pcd_documents (company_id,case_id,document_type,document_date,professional_name,professional_registration,file_name,mime_type,private_path,document_status,notes,uploaded_by) VALUES (${companyId},${input.caseId},${input.documentType},${input.documentDate || null},${input.professionalName || null},${input.professionalRegistration || null},${input.fileName},${mimeType},${file},${input.documentStatus},${input.notes || null},${Number(ctx.user.id)})`
      );
      const id = Number((inserted as any)[0]?.insertId || 0);
      await audit(
        db,
        ctx,
        "pcd_document_uploaded",
        "pcd_document",
        id,
        Number(current.collaborator_id),
        null,
        { caseId: input.caseId, documentType: input.documentType }
      );
      return { ok: true, id };
    }),

  listPcdDocuments: protectedProcedure
    .input(z.object({ caseId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      requireManager(ctx);
      await ensureOccupationalProgramTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) return [];
      const result: any = await db.execute(
        drzSql`SELECT d.id,d.document_type,d.document_date,d.professional_name,d.professional_registration,d.file_name,d.mime_type,d.document_status,d.notes,d.uploaded_at,u.name uploaded_by_name FROM occupational_pcd_documents d LEFT JOIN users u ON u.id=d.uploaded_by WHERE d.case_id=${input.caseId} AND d.company_id=${companyId} ORDER BY d.uploaded_at DESC,d.id DESC`
      );
      return rowsOf(result);
    }),

  syncPcaCandidates: protectedProcedure.mutation(async ({ ctx }) => {
    requireManager(ctx);
    await ensureOccupationalProgramTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const result: any =
      await db.execute(drzSql`INSERT IGNORE INTO occupational_pca_cases
      (company_id,collaborator_id,gse_id,source_result_id,source_exam_id,detected_at,finding_summary,comparison_summary,status,created_by)
      SELECT r.company_id,r.collaborator_id,h.gse_id,r.id,r.exam_id,r.performed_at,
        CONCAT('Resultado classificado como ',COALESCE(r.classification,'não informado'),'. ',COALESCE(r.result_summary,'')),
        r.reference_text,'triagem_pendente',${Number(ctx.user.id)}
      FROM occupational_exam_results r
      JOIN pcmso_exam_catalog_v2 e ON e.id=r.exam_id AND e.company_id=r.company_id
      LEFT JOIN occupational_gse_worker_history h ON h.company_id=r.company_id AND h.collaborator_id=r.collaborator_id AND h.is_current=1
      WHERE r.company_id=${companyId}
        AND (LOWER(e.name) LIKE '%audiometr%' OR LOWER(e.category) LIKE '%audiometr%')
        AND COALESCE(r.classification,'pendente_revisao') NOT IN ('normal','apto','realizada')`);
    const inserted = Number((result as any)[0]?.affectedRows || 0);
    return { ok: true, inserted };
  }),

  listPcaCases: protectedProcedure.query(async ({ ctx }) => {
    requireManager(ctx);
    await ensureOccupationalProgramTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) return [];
    const result: any = await db.execute(
      drzSql`SELECT p.*,u.name collaborator_name,u.cpf,u.employee_registration,u.position,b.name branch_name,s.name sector_name,g.code gse_code,g.name gse_name,e.name exam_name,r.performed_at exam_date,r.classification result_classification,(SELECT COUNT(*) FROM occupational_pca_actions a WHERE a.case_id=p.id AND a.company_id=p.company_id AND a.status='pendente') pending_actions FROM occupational_pca_cases p JOIN users u ON u.id=p.collaborator_id AND u.company_id=p.company_id LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN sectors s ON s.id=u.sector_id LEFT JOIN occupational_gse_master g ON g.id=p.gse_id LEFT JOIN pcmso_exam_catalog_v2 e ON e.id=p.source_exam_id LEFT JOIN occupational_exam_results r ON r.id=p.source_result_id WHERE p.company_id=${companyId} ORDER BY FIELD(p.status,'triagem_pendente','convocacao_pendente','avaliacao_medica','encaminhado','repeticao_pendente','acompanhamento','concluido'),p.detected_at DESC`
    );
    return rowsOf(result);
  }),

  updatePcaCase: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: pcaStatus,
        findingSummary: z.string().max(100000).optional(),
        comparisonSummary: z.string().max(100000).optional(),
        repeatExamRequired: z.boolean().default(false),
        entReferralRequired: z.boolean().default(false),
        occupationalNexusReview: z.enum([
          "nao_avaliado",
          "investigar",
          "descartado",
          "confirmado_pelo_medico",
        ]),
        catReviewStatus: z.enum([
          "nao_avaliado",
          "avaliar",
          "nao_indicada",
          "indicada_pelo_medico",
        ]),
        medicalConclusion: z.string().max(100000).optional(),
        nextAction: z.string().max(500).optional(),
        dueDate: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireManager(ctx);
      await ensureOccupationalProgramTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const current: any = await db.execute(
        drzSql`SELECT * FROM occupational_pca_cases WHERE id=${input.id} AND company_id=${companyId} LIMIT 1`
      );
      const before = rowsOf(current)[0];
      if (!before) throw new TRPCError({ code: "NOT_FOUND" });
      await db.execute(
        drzSql`UPDATE occupational_pca_cases SET status=${input.status},finding_summary=${input.findingSummary || null},comparison_summary=${input.comparisonSummary || null},repeat_exam_required=${input.repeatExamRequired ? 1 : 0},ent_referral_required=${input.entReferralRequired ? 1 : 0},occupational_nexus_review=${input.occupationalNexusReview},cat_review_status=${input.catReviewStatus},medical_conclusion=${input.medicalConclusion || null},next_action=${input.nextAction || null},due_date=${input.dueDate || null},reviewed_by=${Number(ctx.user.id)},reviewed_at=NOW() WHERE id=${input.id} AND company_id=${companyId}`
      );
      await audit(
        db,
        ctx,
        "pca_case_updated",
        "pca_case",
        input.id,
        Number(before.collaborator_id),
        before,
        input
      );
      return { ok: true };
    }),

  addPcaAction: protectedProcedure
    .input(
      z.object({
        caseId: z.number().int().positive(),
        actionType: z.enum([
          "convocacao",
          "avaliacao_medica",
          "encaminhamento_otorrino",
          "repeticao_audiometria",
          "acompanhamento",
          "outro",
        ]),
        description: z.string().min(3).max(100000),
        scheduledFor: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireManager(ctx);
      await ensureOccupationalProgramTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const own: any = await db.execute(
        drzSql`SELECT id,collaborator_id FROM occupational_pca_cases WHERE id=${input.caseId} AND company_id=${companyId} LIMIT 1`
      );
      const current = rowsOf(own)[0];
      if (!current) throw new TRPCError({ code: "NOT_FOUND" });
      const inserted: any = await db.execute(
        drzSql`INSERT INTO occupational_pca_actions (company_id,case_id,action_type,description,scheduled_for,created_by) VALUES (${companyId},${input.caseId},${input.actionType},${input.description},${input.scheduledFor ? new Date(input.scheduledFor) : null},${Number(ctx.user.id)})`
      );
      const id = Number((inserted as any)[0]?.insertId || 0);
      await audit(
        db,
        ctx,
        "pca_action_created",
        "pca_action",
        id,
        Number(current.collaborator_id),
        null,
        input
      );
      return { ok: true, id };
    }),
});
