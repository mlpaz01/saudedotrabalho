import crypto from "crypto";
import fs from "fs";
import path from "path";
import { TRPCError } from "@trpc/server";
import { sql as drzSql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import { protectedProcedure, router } from "./trpc";
import { orChat } from "./contentforge/openrouter";
import {
  auditTechnicalDocument,
  buildTechnicalDocumentDraft,
  buildTechnicalDocumentTitle,
  technicalDocumentLabel,
  type TechnicalDocumentType,
} from "./technicalDocumentIntelligence";
import { loadDocumentDefaults } from "./documentDefaults";
import { ensurePgrVersioningTables } from "./pgrVersioning";

let tablesReady = false;

function rowsOf(result: any): any[] {
  return Array.isArray(result?.[0])
    ? result[0]
    : Array.isArray(result)
      ? result
      : [];
}

function parseJson(value: unknown, fallback: any = null) {
  if (value && typeof value === "object") return value;
  try {
    return JSON.parse(String(value || ""));
  } catch {
    return fallback;
  }
}

function roleOf(ctx: any) {
  return String(ctx.user?.role || "");
}

function companyOf(ctx: any) {
  const id = Number(ctx.user?.companyId || 0);
  if (!id)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Empresa não identificada.",
    });
  return id;
}

const readers = [
  "sesmt",
  "medico",
  "admin",
  "company_admin",
  "admin_global",
  "super_admin",
];
const editors = [
  "sesmt",
  "admin",
  "company_admin",
  "admin_global",
  "super_admin",
];

function requireRead(ctx: any) {
  if (!readers.includes(roleOf(ctx)))
    throw new TRPCError({ code: "FORBIDDEN" });
}

function requireEdit(ctx: any) {
  if (!editors.includes(roleOf(ctx)))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "A edição dos laudos técnicos é restrita ao SESMT.",
    });
}

async function ensureTables() {
  if (tablesReady) return;
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS technical_documents_v2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    document_type VARCHAR(30) NOT NULL,
    pgr_id INT NULL,
    title VARCHAR(500) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'rascunho',
    valid_from DATE NULL,
    valid_until DATE NULL,
    scope_json LONGTEXT NULL,
    objective MEDIUMTEXT NULL,
    legal_basis MEDIUMTEXT NULL,
    methodology MEDIUMTEXT NULL,
    chapters_json LONGTEXT NULL,
    conclusion MEDIUMTEXT NULL,
    responsible_name VARCHAR(255) NULL,
    responsible_profession VARCHAR(180) NULL,
    responsible_registration VARCHAR(120) NULL,
    responsible_art VARCHAR(180) NULL,
    responsible_signature_url VARCHAR(700) NULL,
    pgr_synced_at DATETIME NULL,
    pgr_source_updated_at DATETIME NULL,
    review_required TINYINT(1) NOT NULL DEFAULT 0,
    compliance_score INT NOT NULL DEFAULT 0,
    pending_count INT NOT NULL DEFAULT 0,
    current_version INT NOT NULL DEFAULT 1,
    signature_hash VARCHAR(128) NULL,
    signed_at DATETIME NULL,
    archived_at DATETIME NULL,
    pdf_private_path VARCHAR(900) NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_td_company_type (company_id, document_type),
    INDEX idx_td_pgr (pgr_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  try {
    await db.execute(
      drzSql`ALTER TABLE technical_documents_v2 ADD COLUMN responsible_signature_url VARCHAR(700) NULL AFTER responsible_art`
    );
  } catch {}
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS technical_document_risks_v2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    document_id INT NOT NULL,
    pgr_id INT NOT NULL,
    pgr_gse_id INT NULL,
    pgr_risk_id INT NULL,
    gse_name VARCHAR(255) NULL,
    risk_type VARCHAR(120) NULL,
    risk_name VARCHAR(500) NULL,
    source VARCHAR(500) NULL,
    possible_damage MEDIUMTEXT NULL,
    risk_classification VARCHAR(120) NULL,
    technical_detail MEDIUMTEXT NULL,
    evaluation_kind VARCHAR(40) NOT NULL DEFAULT 'a_definir',
    methodology MEDIUMTEXT NULL,
    measurement_result MEDIUMTEXT NULL,
    tolerance_reference MEDIUMTEXT NULL,
    exposure_characterization MEDIUMTEXT NULL,
    control_assessment MEDIUMTEXT NULL,
    technical_conclusion MEDIUMTEXT NULL,
    decision_status VARCHAR(30) NOT NULL DEFAULT 'pendente',
    reviewed_by INT NULL,
    reviewed_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_td_risk_source (document_id, pgr_gse_id, pgr_risk_id),
    INDEX idx_td_risk_document (document_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS technical_document_attachments_v2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    document_id INT NOT NULL,
    title VARCHAR(255) NULL,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(120) NOT NULL,
    private_path VARCHAR(900) NOT NULL,
    uploaded_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_td_attachment_document (document_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS technical_document_versions_v2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    document_id INT NOT NULL,
    version_number INT NOT NULL,
    pdf_private_path VARCHAR(900) NOT NULL,
    signature_hash VARCHAR(128) NULL,
    generated_by INT NOT NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_td_version (document_id, version_number)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS technical_document_audits_v2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    document_id INT NOT NULL,
    score INT NOT NULL,
    result_json LONGTEXT NOT NULL,
    commentary MEDIUMTEXT NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_td_audit_document (document_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS technical_document_shares_v2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    document_id INT NOT NULL,
    target_role VARCHAR(40) NOT NULL,
    expires_at DATETIME NULL,
    revoked_at DATETIME NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_td_share_document (document_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS technical_document_events_v2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    document_id INT NOT NULL,
    actor_user_id INT NOT NULL,
    action VARCHAR(120) NOT NULL,
    details_json LONGTEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_td_event_document (document_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  tablesReady = true;
}

async function event(
  db: any,
  ctx: any,
  documentId: number,
  action: string,
  details?: any
) {
  await db.execute(drzSql`INSERT INTO technical_document_events_v2
    (company_id,document_id,actor_user_id,action,details_json)
    VALUES (${companyOf(ctx)},${documentId},${Number(ctx.user.id)},${action},${details ? JSON.stringify(details) : null})`);
}

function privateRoot(companyId: number) {
  const base =
    process.env.NODE_ENV === "production"
      ? "/var/www/saudedotrabalho/private/technical_documents"
      : path.join(process.cwd(), "private", "technical_documents");
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

function signatureDataUri(storedPath: unknown) {
  const value = String(storedPath || "").trim();
  if (!value) return "";
  const candidates = [
    value,
    value.startsWith("/uploads/")
      ? path.join(process.cwd(), value.replace(/^\/+/, ""))
      : "",
  ].filter(Boolean);
  const filePath = candidates.find(candidate => fs.existsSync(candidate));
  if (!filePath) return "";
  const extension = path.extname(filePath).toLowerCase();
  const mime =
    extension === ".png"
      ? "image/png"
      : extension === ".webp"
        ? "image/webp"
        : "image/jpeg";
  return `data:${mime};base64,${fs.readFileSync(filePath).toString("base64")}`;
}

const typeSchema = z.enum(["ltcat", "insalubridade", "periculosidade"]);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function ownedDocument(db: any, companyId: number, id: number) {
  const result: any = await db.execute(
    drzSql`SELECT d.*,p.title pgr_title,p.updated_at pgr_updated_at,c.name company_name,c.cnpj,c.address
      FROM technical_documents_v2 d
      JOIN companies c ON c.id=d.company_id
      LEFT JOIN pgr_documents p ON p.id=d.pgr_id
      WHERE d.id=${id} AND d.company_id=${companyId} LIMIT 1`
  );
  const document = rowsOf(result)[0];
  if (!document) throw new TRPCError({ code: "NOT_FOUND" });
  if (
    document.pgr_updated_at &&
    document.pgr_synced_at &&
    new Date(document.pgr_updated_at).getTime() >
      new Date(document.pgr_synced_at).getTime()
  ) {
    document.review_required = 1;
    await db.execute(
      drzSql`UPDATE technical_documents_v2 SET review_required=1 WHERE id=${id} AND company_id=${companyId}`
    );
  }
  return document;
}

export const technicalDocumentsRouter = router({
  complianceSummary: protectedProcedure.query(async ({ ctx }) => {
    if (
      ![
        "rh",
        "sesmt",
        "admin",
        "company_admin",
        "admin_global",
        "super_admin",
        "medico",
      ].includes(roleOf(ctx))
    )
      throw new TRPCError({ code: "FORBIDDEN" });
    await ensureTables();
    const db = await getDb();
    if (!db) return null;
    await ensurePgrVersioningTables(db);
    const companyId = companyOf(ctx);
    const [
      documentsResult,
      documentsByTypeResult,
      pcmsoResult,
      pcmsoAuditResult,
      technicalAuditsResult,
      pgrRevisionAlertsResult,
    ] = await Promise.all([
      db.execute(drzSql`SELECT
        COUNT(*) total,
        SUM(status='vigente') vigente,
        SUM(status='em_revisao') em_revisao,
        SUM(review_required=1) revisar_pgr,
        AVG(compliance_score) score,
        SUM(document_type='ltcat') ltcat,
        SUM(document_type='insalubridade') insalubridade,
        SUM(document_type='periculosidade') periculosidade
        FROM technical_documents_v2 WHERE company_id=${companyId}`),
      db.execute(drzSql`SELECT
        document_type,
        COUNT(*) total,
        SUM(status='vigente') vigente,
        SUM(status='em_revisao') em_revisao,
        SUM(review_required=1) revisar_pgr,
        AVG(compliance_score) score,
        SUM(pending_count) pendencias
        FROM technical_documents_v2
        WHERE company_id=${companyId}
        GROUP BY document_type`),
      db.execute(drzSql`SELECT
        COUNT(*) total,
        SUM(status='vigente') vigente,
        SUM(status='em_revisao') em_revisao,
        SUM(review_required=1) revisar_pgr,
        AVG(ai_audit_score) score,
        SUM(pending_count) pendencias
        FROM pcmso_programs_v2 WHERE company_id=${companyId}`),
      db.execute(drzSql`SELECT a.result_json,p.title
        FROM pcmso_ai_audits_v2 a
        JOIN pcmso_programs_v2 p ON p.id=a.pcmso_id AND p.company_id=a.company_id
        WHERE a.company_id=${companyId}
        ORDER BY a.created_at DESC,a.id DESC LIMIT 1`),
      db.execute(drzSql`SELECT a.result_json,d.title,d.document_type
        FROM technical_document_audits_v2 a
        JOIN technical_documents_v2 d ON d.id=a.document_id AND d.company_id=a.company_id
        WHERE a.company_id=${companyId}
        ORDER BY a.created_at DESC,a.id DESC LIMIT 50`),
      db.execute(drzSql`SELECT
        COUNT(*) total_open,
        SUM(status IN ('pendente','aguardando_medico','em_analise_medica')) medical_pending,
        SUM(status='aguardando_sesmt') sesmt_pending,
        SUM(status='sem_alteracao') reviewed_without_change
        FROM pcmso_pgr_revision_alerts
        WHERE company_id=${companyId} AND status<>'concluido'`),
    ]);
    const latestTechnicalAudits: Record<string, any> = {};
    for (const row of rowsOf(technicalAuditsResult)) {
      if (latestTechnicalAudits[row.document_type]) continue;
      latestTechnicalAudits[row.document_type] = {
        title: row.title,
        ...parseJson(row.result_json, {}),
      };
    }
    const pcmsoAudit = rowsOf(pcmsoAuditResult)[0];
    return {
      documents: rowsOf(documentsResult)[0] || {},
      documentsByType: rowsOf(documentsByTypeResult),
      pcmso: rowsOf(pcmsoResult)[0] || {},
      pgrRevisionAlerts: rowsOf(pgrRevisionAlertsResult)[0] || {},
      checklists: {
        pcmso: pcmsoAudit
          ? {
              title: pcmsoAudit.title,
              ...parseJson(pcmsoAudit.result_json, {}),
            }
          : null,
        technical: latestTechnicalAudits,
      },
    };
  }),

  summary: protectedProcedure.query(async ({ ctx }) => {
    requireRead(ctx);
    await ensureTables();
    const db = await getDb();
    if (!db) return null;
    const companyId = companyOf(ctx);
    const result: any = await db.execute(drzSql`SELECT
      COUNT(*) total,
      SUM(document_type='ltcat') ltcat,
      SUM(document_type='insalubridade') insalubridade,
      SUM(document_type='periculosidade') periculosidade,
      SUM(status='vigente') vigente,
      SUM(status='em_revisao') em_revisao,
      SUM(review_required=1) revisar_pgr,
      AVG(compliance_score) conformidade
      FROM technical_documents_v2 WHERE company_id=${companyId}`);
    return rowsOf(result)[0] || {};
  }),

  listPgrs: protectedProcedure.query(async ({ ctx }) => {
    requireRead(ctx);
    const db = await getDb();
    if (!db) return [];
    await ensurePgrVersioningTables(db);
    const result: any = await db.execute(
      drzSql`SELECT id,title,status,branch_id,pdf_url,updated_at,
        exercise_year,revision_root_id,revision_parent_id,revision_number,is_current_version,revision_reason
        FROM pgr_documents WHERE company_id=${companyOf(ctx)} ORDER BY updated_at DESC,id DESC LIMIT 200`
    );
    return rowsOf(result);
  }),

  list: protectedProcedure
    .input(z.object({ type: typeSchema.optional() }).optional())
    .query(async ({ ctx, input }) => {
      requireRead(ctx);
      await ensureTables();
      const db = await getDb();
      if (!db) return [];
      const companyId = companyOf(ctx);
      const result: any = input?.type
        ? await db.execute(
            drzSql`SELECT d.*,p.title pgr_title,p.updated_at pgr_updated_at FROM technical_documents_v2 d LEFT JOIN pgr_documents p ON p.id=d.pgr_id WHERE d.company_id=${companyId} AND d.document_type=${input.type} ORDER BY d.updated_at DESC,d.id DESC`
          )
        : await db.execute(
            drzSql`SELECT d.*,p.title pgr_title,p.updated_at pgr_updated_at FROM technical_documents_v2 d LEFT JOIN pgr_documents p ON p.id=d.pgr_id WHERE d.company_id=${companyId} ORDER BY d.updated_at DESC,d.id DESC`
          );
      return rowsOf(result).map(row => ({
        ...row,
        review_required:
          Number(row.review_required || 0) ||
          (row.pgr_updated_at && row.pgr_synced_at
            ? Number(
                new Date(row.pgr_updated_at).getTime() >
                  new Date(row.pgr_synced_at).getTime()
              )
            : 0),
        readOnly: roleOf(ctx) === "medico",
      }));
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      requireRead(ctx);
      await ensureTables();
      const db = await getDb();
      if (!db) return null;
      const companyId = companyOf(ctx);
      const document = await ownedDocument(db, companyId, input.id);
      const [risks, attachments, versions, audits, shares, events] =
        await Promise.all([
          db.execute(
            drzSql`SELECT * FROM technical_document_risks_v2 WHERE document_id=${input.id} AND company_id=${companyId} ORDER BY gse_name,risk_name,id`
          ),
          db.execute(
            drzSql`SELECT id,title,file_name,mime_type,created_at FROM technical_document_attachments_v2 WHERE document_id=${input.id} AND company_id=${companyId} ORDER BY id DESC`
          ),
          db.execute(
            drzSql`SELECT id,version_number,signature_hash,generated_at FROM technical_document_versions_v2 WHERE document_id=${input.id} AND company_id=${companyId} ORDER BY version_number DESC`
          ),
          db.execute(
            drzSql`SELECT id,score,result_json,commentary,created_at FROM technical_document_audits_v2 WHERE document_id=${input.id} AND company_id=${companyId} ORDER BY id DESC LIMIT 30`
          ),
          db.execute(
            drzSql`SELECT id,target_role,expires_at,revoked_at,created_at FROM technical_document_shares_v2 WHERE document_id=${input.id} AND company_id=${companyId} ORDER BY id DESC`
          ),
          db.execute(
            drzSql`SELECT e.*,u.name actor_name FROM technical_document_events_v2 e LEFT JOIN users u ON u.id=e.actor_user_id WHERE e.document_id=${input.id} AND e.company_id=${companyId} ORDER BY e.id DESC LIMIT 100`
          ),
        ]);
      return {
        document,
        risks: rowsOf(risks),
        attachments: rowsOf(attachments),
        versions: rowsOf(versions),
        audits: rowsOf(audits),
        shares: rowsOf(shares),
        events: rowsOf(events),
        readOnly: roleOf(ctx) === "medico",
      };
    }),

  upsert: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        type: typeSchema,
        pgrId: z.number().int().positive().nullable().optional(),
        title: z.string().max(500).optional(),
        validFrom: dateSchema.nullable().optional(),
        validUntil: dateSchema.nullable().optional(),
        objective: z.string().max(100000).optional(),
        legalBasis: z.string().max(100000).optional(),
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
        conclusion: z.string().max(100000).optional(),
        responsibleName: z.string().max(255).optional(),
        responsibleProfession: z.string().max(180).optional(),
        responsibleRegistration: z.string().max(120).optional(),
        responsibleArt: z.string().max(180).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireEdit(ctx);
      await ensureTables();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const companyId = companyOf(ctx);
      const companyResult: any = await db.execute(
        drzSql`SELECT name FROM companies WHERE id=${companyId} LIMIT 1`
      );
      const responsibleResult: any = await db.execute(
        drzSql`SELECT name,profession,registration,art,signature_url FROM responsible_technicians WHERE company_id=${companyId} ORDER BY (registration=${input.responsibleRegistration || ""}) DESC,is_default DESC,id ASC LIMIT 1`
      );
      const responsible = rowsOf(responsibleResult)[0] || {};
      const responsibleName = input.responsibleName || responsible.name || null;
      const responsibleProfession =
        input.responsibleProfession || responsible.profession || null;
      const responsibleRegistration =
        input.responsibleRegistration || responsible.registration || null;
      const responsibleArt = input.responsibleArt || responsible.art || null;
      const responsibleSignatureUrl = responsible.signature_url || null;
      const title =
        String(input.title || "").trim() ||
        buildTechnicalDocumentTitle({
          type: input.type,
          companyName: rowsOf(companyResult)[0]?.name,
          year: input.validFrom
            ? Number(input.validFrom.slice(0, 4))
            : new Date().getFullYear(),
        });
      const defaults = input.id
        ? null
        : await loadDocumentDefaults(db, companyId, input.type);
      const objective = input.objective || defaults?.texto_introducao || null;
      const conclusion = input.conclusion || defaults?.texto_conclusao || null;
      let id = Number(input.id || 0);
      if (id) {
        await ownedDocument(db, companyId, id);
        await db.execute(drzSql`UPDATE technical_documents_v2 SET
          pgr_id=${input.pgrId || null},title=${title},valid_from=${input.validFrom || null},valid_until=${input.validUntil || null},objective=${objective},legal_basis=${input.legalBasis || null},methodology=${input.methodology || null},chapters_json=${JSON.stringify(input.chapters)},conclusion=${conclusion},responsible_name=${responsibleName},responsible_profession=${responsibleProfession},responsible_registration=${responsibleRegistration},responsible_art=${responsibleArt},responsible_signature_url=${responsibleSignatureUrl}
          WHERE id=${id} AND company_id=${companyId}`);
        await event(db, ctx, id, "document_updated");
      } else {
        const inserted: any =
          await db.execute(drzSql`INSERT INTO technical_documents_v2
          (company_id,document_type,pgr_id,title,valid_from,valid_until,objective,legal_basis,methodology,chapters_json,conclusion,responsible_name,responsible_profession,responsible_registration,responsible_art,responsible_signature_url,created_by)
          VALUES (${companyId},${input.type},${input.pgrId || null},${title},${input.validFrom || null},${input.validUntil || null},${objective},${input.legalBasis || null},${input.methodology || null},${JSON.stringify(input.chapters)},${conclusion},${responsibleName},${responsibleProfession},${responsibleRegistration},${responsibleArt},${responsibleSignatureUrl},${Number(ctx.user.id)})`);
        id = Number((inserted as any)[0]?.insertId || 0);
        await event(db, ctx, id, "document_created", { type: input.type });
      }
      return { ok: true, id, title };
    }),

  importPgr: protectedProcedure
    .input(
      z.object({
        documentId: z.number().int().positive(),
        pgrId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireEdit(ctx);
      await ensureTables();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const companyId = companyOf(ctx);
      await ownedDocument(db, companyId, input.documentId);
      const pgrResult: any = await db.execute(
        drzSql`SELECT id,title,updated_at FROM pgr_documents WHERE id=${input.pgrId} AND company_id=${companyId} LIMIT 1`
      );
      const pgr = rowsOf(pgrResult)[0];
      if (!pgr)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "PGR não encontrado.",
        });
      const risksResult: any = await db.execute(drzSql`SELECT
        g.id gse_id,g.nome gse_name,r.id risk_id,r.tipo risk_type,r.agente risk_name,
        r.fonte_geradora source,r.possivel_dano possible_damage,r.risco_final risk_classification,
        CONCAT_WS('\n',d.metodologia,d.resultado_medicao,d.criterio_ia,d.justificativa_ia) technical_detail,
        d.metodologia,d.resultado_medicao,d.limite_tolerancia,d.norma_referencia,d.tempo_exposicao,
        d.frequencia_exposicao,d.via_exposicao,d.avaliacao_eficacia_controles
        FROM pgr_gse g
        JOIN pgr_documents p ON p.id=g.pgr_id
        LEFT JOIN pgr_gse_riscos r ON r.gse_id=g.id
        LEFT JOIN pgr_gse_riscos_detalhe d ON d.risco_id=r.id
        WHERE g.pgr_id=${input.pgrId} AND p.company_id=${companyId}
        ORDER BY g.nome,r.id`);
      const risks = rowsOf(risksResult).filter(row => row.risk_id);
      for (const row of risks) {
        const exposure = [
          row.tempo_exposicao,
          row.frequencia_exposicao,
          row.via_exposicao,
        ]
          .filter(Boolean)
          .join(" · ");
        const tolerance = [row.limite_tolerancia, row.norma_referencia]
          .filter(Boolean)
          .join(" · ");
        await db.execute(drzSql`INSERT INTO technical_document_risks_v2
          (company_id,document_id,pgr_id,pgr_gse_id,pgr_risk_id,gse_name,risk_type,risk_name,source,possible_damage,risk_classification,technical_detail,methodology,measurement_result,tolerance_reference,exposure_characterization,control_assessment)
          VALUES (${companyId},${input.documentId},${input.pgrId},${row.gse_id},${row.risk_id},${row.gse_name},${row.risk_type},${row.risk_name},${row.source || null},${row.possible_damage || null},${row.risk_classification || null},${row.technical_detail || null},${row.metodologia || null},${row.resultado_medicao || null},${tolerance || null},${exposure || null},${row.avaliacao_eficacia_controles || null})
          ON DUPLICATE KEY UPDATE gse_name=VALUES(gse_name),risk_type=VALUES(risk_type),risk_name=VALUES(risk_name),source=VALUES(source),possible_damage=VALUES(possible_damage),risk_classification=VALUES(risk_classification),technical_detail=VALUES(technical_detail),methodology=COALESCE(methodology,VALUES(methodology)),measurement_result=COALESCE(measurement_result,VALUES(measurement_result)),tolerance_reference=COALESCE(tolerance_reference,VALUES(tolerance_reference)),exposure_characterization=COALESCE(exposure_characterization,VALUES(exposure_characterization)),control_assessment=COALESCE(control_assessment,VALUES(control_assessment))`);
      }
      await db.execute(
        drzSql`UPDATE technical_documents_v2 SET pgr_id=${input.pgrId},pgr_synced_at=NOW(),pgr_source_updated_at=${pgr.updated_at},review_required=0,status='em_revisao' WHERE id=${input.documentId} AND company_id=${companyId}`
      );
      await event(db, ctx, input.documentId, "pgr_imported", {
        pgrId: input.pgrId,
        risks: risks.length,
      });
      return { ok: true, imported: risks.length };
    }),

  generateWithAi: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireEdit(ctx);
      await ensureTables();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const companyId = companyOf(ctx);
      const document = await ownedDocument(db, companyId, input.id);
      const risksResult: any = await db.execute(
        drzSql`SELECT * FROM technical_document_risks_v2 WHERE document_id=${input.id} AND company_id=${companyId} ORDER BY gse_name,risk_name`
      );
      const risks = rowsOf(risksResult);
      if (!risks.length)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Importe o PGR antes de gerar o documento.",
        });
      let draft = buildTechnicalDocumentDraft({
        type: document.document_type as TechnicalDocumentType,
        companyName: document.company_name,
        pgrTitle: document.pgr_title,
        riskRows: risks,
      });
      let usedAi = false;
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (apiKey) {
        try {
          const compactRisks = risks.slice(0, 150).map(row => ({
            gse: row.gse_name,
            risco: row.risk_name,
            tipo: row.risk_type,
            fonte: row.source,
            dano: row.possible_damage,
            detalhe: String(row.technical_detail || "").slice(0, 700),
          }));
          const raw = await orChat(
            [
              {
                role: "system",
                content:
                  "Você auxilia a estruturar laudos ocupacionais brasileiros. Responda apenas JSON com objective, legalBasis, methodology, chapters[{title,content}] e conclusion. Nunca invente medições, limites, exposição, enquadramento, caracterização ou conclusão pericial. Marque lacunas para validação do responsável técnico. Preserve o PGR como fonte e deixe clara a necessidade de inspeção e evidências.",
              },
              {
                role: "user",
                content: JSON.stringify({
                  tipo: technicalDocumentLabel(document.document_type),
                  empresa: document.company_name,
                  pgr: document.pgr_title,
                  riscos: compactRisks,
                }),
              },
            ],
            apiKey,
            true
          );
          const parsed = JSON.parse(
            raw
              .trim()
              .replace(/^```json\s*/i, "")
              .replace(/```$/i, "")
          );
          if (
            typeof parsed.objective === "string" &&
            typeof parsed.legalBasis === "string" &&
            typeof parsed.methodology === "string" &&
            Array.isArray(parsed.chapters) &&
            typeof parsed.conclusion === "string"
          ) {
            draft = {
              objective: parsed.objective,
              legalBasis: parsed.legalBasis,
              methodology: parsed.methodology,
              chapters: parsed.chapters.slice(0, 40),
              conclusion: parsed.conclusion,
            };
            usedAi = true;
          }
        } catch (error: any) {
          console.warn(
            "[Laudos técnicos] OpenRouter indisponível; usando estrutura segura:",
            String(error?.message || error).slice(0, 180)
          );
        }
      }
      await db.execute(
        drzSql`UPDATE technical_documents_v2 SET objective=${draft.objective},legal_basis=${draft.legalBasis},methodology=${draft.methodology},chapters_json=${JSON.stringify(draft.chapters)},conclusion=${draft.conclusion},status='em_revisao' WHERE id=${input.id} AND company_id=${companyId}`
      );
      await event(db, ctx, input.id, "ai_draft_generated", { usedAi });
      return { ok: true, usedAi };
    }),

  decideRisk: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        evaluationKind: z.enum([
          "qualitativa",
          "quantitativa",
          "nao_aplicavel",
        ]),
        methodology: z.string().max(100000).optional(),
        measurementResult: z.string().max(100000).optional(),
        toleranceReference: z.string().max(100000).optional(),
        exposureCharacterization: z.string().max(100000).optional(),
        controlAssessment: z.string().max(100000).optional(),
        technicalConclusion: z.string().min(10).max(100000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireEdit(ctx);
      await ensureTables();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const companyId = companyOf(ctx);
      const own: any = await db.execute(
        drzSql`SELECT document_id FROM technical_document_risks_v2 WHERE id=${input.id} AND company_id=${companyId} LIMIT 1`
      );
      const row = rowsOf(own)[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      await db.execute(
        drzSql`UPDATE technical_document_risks_v2 SET evaluation_kind=${input.evaluationKind},methodology=${input.methodology || null},measurement_result=${input.measurementResult || null},tolerance_reference=${input.toleranceReference || null},exposure_characterization=${input.exposureCharacterization || null},control_assessment=${input.controlAssessment || null},technical_conclusion=${input.technicalConclusion},decision_status='validado',reviewed_by=${Number(ctx.user.id)},reviewed_at=NOW() WHERE id=${input.id} AND company_id=${companyId}`
      );
      await event(db, ctx, Number(row.document_id), "risk_decision_validated", {
        riskId: input.id,
      });
      return { ok: true };
    }),

  audit: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireEdit(ctx);
      await ensureTables();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const companyId = companyOf(ctx);
      const document = await ownedDocument(db, companyId, input.id);
      const [risksResult, attachmentsResult] = await Promise.all([
        db.execute(
          drzSql`SELECT * FROM technical_document_risks_v2 WHERE document_id=${input.id} AND company_id=${companyId}`
        ),
        db.execute(
          drzSql`SELECT COUNT(*) total FROM technical_document_attachments_v2 WHERE document_id=${input.id} AND company_id=${companyId}`
        ),
      ]);
      const result = auditTechnicalDocument({
        document,
        risks: rowsOf(risksResult),
        attachmentCount: Number(rowsOf(attachmentsResult)[0]?.total || 0),
      });
      const commentary = `${result.pending.length} pendência(s), sendo ${result.criticalPending.length} crítica(s). A validação final pertence ao responsável técnico.`;
      await db.execute(
        drzSql`INSERT INTO technical_document_audits_v2 (company_id,document_id,score,result_json,commentary,created_by) VALUES (${companyId},${input.id},${result.score},${JSON.stringify(result)},${commentary},${Number(ctx.user.id)})`
      );
      await db.execute(
        drzSql`UPDATE technical_documents_v2 SET compliance_score=${result.score},pending_count=${result.pending.length} WHERE id=${input.id} AND company_id=${companyId}`
      );
      await event(db, ctx, input.id, "document_audited", {
        score: result.score,
      });
      return { ...result, commentary };
    }),

  addAttachment: protectedProcedure
    .input(
      z.object({
        documentId: z.number().int().positive(),
        title: z.string().max(255).optional(),
        fileName: z.string().min(1).max(255),
        fileBase64: z.string().min(20).max(20_000_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireEdit(ctx);
      await ensureTables();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const companyId = companyOf(ctx);
      await ownedDocument(db, companyId, input.documentId);
      const file = savePrivateFile(
        companyId,
        `document_${input.documentId}`,
        input.fileName,
        input.fileBase64
      );
      const inserted: any = await db.execute(
        drzSql`INSERT INTO technical_document_attachments_v2 (company_id,document_id,title,file_name,mime_type,private_path,uploaded_by) VALUES (${companyId},${input.documentId},${input.title || null},${input.fileName},${file.mimeType},${file.target},${Number(ctx.user.id)})`
      );
      const id = Number((inserted as any)[0]?.insertId || 0);
      await event(db, ctx, input.documentId, "attachment_uploaded", { id });
      return { ok: true, id };
    }),

  share: protectedProcedure
    .input(
      z.object({
        documentId: z.number().int().positive(),
        targetRole: z.enum(["medico", "rh", "company_admin"]),
        expiresAt: z.string().max(40).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireEdit(ctx);
      await ensureTables();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const companyId = companyOf(ctx);
      await ownedDocument(db, companyId, input.documentId);
      await db.execute(
        drzSql`INSERT INTO technical_document_shares_v2 (company_id,document_id,target_role,expires_at,created_by) VALUES (${companyId},${input.documentId},${input.targetRole},${input.expiresAt || null},${Number(ctx.user.id)})`
      );
      await event(db, ctx, input.documentId, "controlled_share_created", {
        targetRole: input.targetRole,
      });
      return { ok: true };
    }),

  sign: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        confirmation: z.literal(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireEdit(ctx);
      await ensureTables();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const companyId = companyOf(ctx);
      const document = await ownedDocument(db, companyId, input.id);
      const risksResult: any = await db.execute(
        drzSql`SELECT * FROM technical_document_risks_v2 WHERE document_id=${input.id} AND company_id=${companyId}`
      );
      const attachmentsResult: any = await db.execute(
        drzSql`SELECT COUNT(*) total FROM technical_document_attachments_v2 WHERE document_id=${input.id} AND company_id=${companyId}`
      );
      const auditResult = auditTechnicalDocument({
        document,
        risks: rowsOf(risksResult),
        attachmentCount: Number(rowsOf(attachmentsResult)[0]?.total || 0),
      });
      if (auditResult.criticalPending.length)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Existem ${auditResult.criticalPending.length} pendência(s) crítica(s). Audite e revise o documento antes de assinar.`,
        });
      const hash = crypto
        .createHash("sha256")
        .update(
          JSON.stringify({
            id: input.id,
            companyId,
            userId: ctx.user.id,
            at: new Date().toISOString(),
            version: document.current_version,
          })
        )
        .digest("hex");
      await db.execute(
        drzSql`UPDATE technical_documents_v2 SET status='vigente',signature_hash=${hash},signed_at=NOW(),compliance_score=${auditResult.score},pending_count=${auditResult.pending.length} WHERE id=${input.id} AND company_id=${companyId}`
      );
      await event(db, ctx, input.id, "document_signed", { hash });
      return { ok: true, signatureHash: hash };
    }),

  archive: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireEdit(ctx);
      await ensureTables();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const companyId = companyOf(ctx);
      await ownedDocument(db, companyId, input.id);
      await db.execute(
        drzSql`UPDATE technical_documents_v2 SET status='arquivado',archived_at=NOW() WHERE id=${input.id} AND company_id=${companyId}`
      );
      await event(db, ctx, input.id, "document_archived");
      return { ok: true };
    }),

  generatePdf: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireEdit(ctx);
      await ensureTables();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const companyId = companyOf(ctx);
      const document = await ownedDocument(db, companyId, input.id);
      const risksResult: any = await db.execute(
        drzSql`SELECT * FROM technical_document_risks_v2 WHERE document_id=${input.id} AND company_id=${companyId} ORDER BY gse_name,risk_name`
      );
      const risks = rowsOf(risksResult);
      if (risks.some(row => row.decision_status !== "validado"))
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Todos os riscos precisam de decisão técnica antes da geração do PDF.",
        });
      let chapters: any[] = [];
      try {
        chapters = JSON.parse(document.chapters_json || "[]");
      } catch {}
      const groups = new Map<string, any[]>();
      risks.forEach(row => {
        const key = row.gse_name || "Sem GSE";
        groups.set(key, [...(groups.get(key) || []), row]);
      });
      const riskHtml = [...groups.entries()]
        .map(
          ([gse, items]) =>
            `<h3>${esc(gse)}</h3><table><thead><tr><th>Agente/condição</th><th>Caracterização</th><th>Avaliação</th><th>Conclusão técnica</th></tr></thead><tbody>${items
              .map(
                row =>
                  `<tr><td><b>${esc(row.risk_name)}</b><br>${esc(row.risk_type || "-")}<br>Fonte: ${esc(row.source || "-")}</td><td>${esc(row.exposure_characterization || row.technical_detail || "-")}</td><td>${esc(row.evaluation_kind)}<br>${esc(row.methodology || "-")}<br>${esc(row.measurement_result || "-")}<br>${esc(row.tolerance_reference || "-")}</td><td>${esc(row.technical_conclusion || "-")}<br><small>Controles: ${esc(row.control_assessment || "-")}</small></td></tr>`
              )
              .join("")}</tbody></table>`
        )
        .join("");
      const signatureImage = signatureDataUri(
        document.responsible_signature_url
      );
      const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>@page{size:A4;margin:18mm 15mm}body{font-family:Arial,sans-serif;color:#172b3a;font-size:10pt;line-height:1.45}h1{font-size:24pt;color:#0e2c46}h2{margin-top:9mm;color:#0e2c46;border-bottom:2px solid #0096a6;padding-bottom:2mm}h3{margin-top:7mm;color:#0e2c46}table{width:100%;border-collapse:collapse;font-size:7.6pt;margin:3mm 0 7mm}th,td{border:1px solid #d7e1e8;padding:2mm;vertical-align:top}th{background:#0e2c46;color:#fff}.cover{height:240mm;display:flex;flex-direction:column;justify-content:center;text-align:center;page-break-after:always}.meta{color:#607486}.signature{margin-top:18mm;text-align:center}.signature img{display:block;max-width:65mm;max-height:24mm;object-fit:contain;margin:0 auto 1mm}.signature-line{border-top:1px solid #172b3a;width:80mm;margin:0 auto 2mm}.notice{border-left:3px solid #eab308;padding:3mm;background:#fffbeb;font-size:8.5pt}</style></head><body><section class="cover"><h1>${esc(document.title)}</h1><h2>${esc(document.company_name)}</h2><p>CNPJ: ${esc(document.cnpj || "-")}<br>Vigência: ${esc(document.valid_from || "-")} a ${esc(document.valid_until || "-")}</p><p class="meta">Documento técnico vinculado ao ${esc(document.pgr_title || "PGR não informado")}</p></section><h2>1. Identificação e objetivo</h2><p><b>Empresa:</b> ${esc(document.company_name)}<br><b>CNPJ:</b> ${esc(document.cnpj || "-")}<br><b>Endereço:</b> ${esc(document.address || "-")}<br><b>Responsável técnico:</b> ${esc(document.responsible_name || "-")} · ${esc(document.responsible_profession || "-")} · ${esc(document.responsible_registration || "-")}</p><p>${esc(document.objective || "")}</p><h2>2. Fundamentação legal e técnica</h2><p>${esc(document.legal_basis || "")}</p><h2>3. Metodologia</h2><p>${esc(document.methodology || "")}</p>${chapters.map((chapter, index) => `<h2>${index + 4}. ${esc(chapter.title)}</h2><p>${esc(chapter.content)}</p>`).join("")}<h2>Caracterização e avaliação por GSE</h2>${riskHtml}<h2>Conclusão técnica</h2><p>${esc(document.conclusion || "")}</p><div class="notice">Este documento reflete o escopo e os dados validados na versão indicada. Alterações no PGR, processos, ambientes ou controles podem exigir revisão técnica.</div><div class="signature">${signatureImage ? `<img src="${signatureImage}" alt="Assinatura do responsável técnico">` : ""}<div class="signature-line"></div><b>${esc(document.responsible_name || "Responsável técnico")}</b><br>${esc(document.responsible_registration || "Registro não informado")}<br>Hash: ${esc(document.signature_hash || "Documento ainda não assinado")}</div></body></html>`;
      const puppeteer = (await import("puppeteer")).default;
      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox"],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "load" });
      const pdf = await page.pdf({ format: "A4", printBackground: true });
      await browser.close();
      const version = Number(document.current_version || 1);
      const dir = path.join(privateRoot(companyId), `document_${input.id}`);
      fs.mkdirSync(dir, { recursive: true });
      const target = path.join(dir, `v${version}_${Date.now()}.pdf`);
      fs.writeFileSync(target, pdf);
      await db.execute(
        drzSql`INSERT INTO technical_document_versions_v2 (company_id,document_id,version_number,pdf_private_path,signature_hash,generated_by) VALUES (${companyId},${input.id},${version},${target},${document.signature_hash || null},${Number(ctx.user.id)})`
      );
      await db.execute(
        drzSql`UPDATE technical_documents_v2 SET pdf_private_path=${target},current_version=current_version+1 WHERE id=${input.id} AND company_id=${companyId}`
      );
      await event(db, ctx, input.id, "pdf_generated", { version });
      return {
        fileName: `${String(document.document_type).toUpperCase()}_v${version}.pdf`,
        dataBase64: `data:application/pdf;base64,${Buffer.from(pdf).toString("base64")}`,
        version,
      };
    }),

  download: protectedProcedure
    .input(
      z.object({
        kind: z.enum(["attachment", "version"]),
        id: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      requireRead(ctx);
      await ensureTables();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const companyId = companyOf(ctx);
      const result: any =
        input.kind === "attachment"
          ? await db.execute(
              drzSql`SELECT file_name,private_path,mime_type FROM technical_document_attachments_v2 WHERE id=${input.id} AND company_id=${companyId} LIMIT 1`
            )
          : await db.execute(
              drzSql`SELECT CONCAT('laudo_v',version_number,'.pdf') file_name,pdf_private_path private_path,'application/pdf' mime_type FROM technical_document_versions_v2 WHERE id=${input.id} AND company_id=${companyId} LIMIT 1`
            );
      const file = rowsOf(result)[0];
      if (!file || !fs.existsSync(file.private_path))
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Arquivo não encontrado.",
        });
      return {
        fileName: file.file_name,
        dataBase64: `data:${file.mime_type};base64,${fs.readFileSync(file.private_path).toString("base64")}`,
      };
    }),
});
