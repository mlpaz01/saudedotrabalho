import { TRPCError } from "@trpc/server";
import { sql as drzSql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import type { KnowledgeArticle } from "./knowledgeCatalog";
import { manualCatalogSeed } from "./manualCatalogSeed";
import { protectedProcedure, router } from "./trpc";

let ready = false;
function rowsOf(result: any): any[] {
  return Array.isArray(result?.[0]) ? result[0] : [];
}
async function ensureColumn(
  db: any,
  column: string,
  definition: string
) {
  const result: any = await db.execute(
    drzSql`SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='knowledge_custom_articles_v2' AND COLUMN_NAME=${column} LIMIT 1`
  );
  if (rowsOf(result).length) return;
  await db.execute(
    drzSql.raw(
      `ALTER TABLE knowledge_custom_articles_v2 ADD COLUMN \`${column}\` ${definition}`
    )
  );
}

async function seedManualCatalog(db: any, actorId = 1) {
  let inserted = 0;
  for (const article of manualCatalogSeed) {
    const existing: any = await db.execute(
      drzSql`SELECT id FROM knowledge_custom_articles_v2 WHERE slug=${article.slug} LIMIT 1`
    );
    if (rowsOf(existing).length) continue;
    await db.execute(drzSql`INSERT INTO knowledge_custom_articles_v2
      (slug,title,summary,module_name,route_path,roles_json,keywords_json,what_is,purpose,access_path,steps_json,cautions_json,faq_json,problems_json,screenshots_json,video_url,is_active,sort_order,workflow_status,audit_status,audit_notes,source_name,source_row,source_published_flag,created_by,updated_by)
      VALUES (${article.slug},${article.title},${article.summary},${article.module},${article.route},${JSON.stringify(article.roles)},${JSON.stringify(article.keywords)},${article.whatIs},${article.purpose},${article.accessPath},${JSON.stringify(article.steps)},${JSON.stringify(article.cautions)},'[]','[]','[]',NULL,0,${article.sortOrder},'em_validacao',${article.auditStatus},${article.auditNotes || null},${article.sourceName},${article.sourceRow},${article.sourcePublishedFlag},${actorId},${actorId})`);
    inserted++;
  }
  return inserted;
}
async function ensureTable() {
  if (ready) return;
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS knowledge_custom_articles_v2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(160) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    summary TEXT,
    module_name VARCHAR(120) NOT NULL,
    route_path VARCHAR(255),
    roles_json LONGTEXT,
    keywords_json LONGTEXT,
    what_is MEDIUMTEXT,
    purpose MEDIUMTEXT,
    access_path TEXT,
    steps_json LONGTEXT,
    cautions_json LONGTEXT,
    faq_json LONGTEXT,
    problems_json LONGTEXT,
    screenshots_json LONGTEXT,
    video_url VARCHAR(1000),
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_by INT NOT NULL,
    updated_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_knowledge_custom_active (is_active, sort_order)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await ensureColumn(
    db,
    "workflow_status",
    "VARCHAR(30) NOT NULL DEFAULT 'publicado'"
  );
  await ensureColumn(
    db,
    "audit_status",
    "VARCHAR(30) NOT NULL DEFAULT 'nao_auditado'"
  );
  await ensureColumn(db, "audit_notes", "MEDIUMTEXT NULL");
  await ensureColumn(db, "source_name", "VARCHAR(500) NULL");
  await ensureColumn(db, "source_row", "INT NULL");
  await ensureColumn(db, "source_published_flag", "VARCHAR(30) NULL");
  await ensureColumn(db, "reviewed_by", "INT NULL");
  await ensureColumn(db, "reviewed_at", "DATETIME NULL");
  await seedManualCatalog(db);
  ready = true;
}
function requireSuper(ctx: any) {
  if (String(ctx.user?.role) !== "super_admin")
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Configuração restrita ao SuperAdmin.",
    });
}
function parse(value: any, fallback: any) {
  try {
    return JSON.parse(value || "");
  } catch {
    return fallback;
  }
}
function mapRow(row: any): KnowledgeArticle & {
  id: number;
  isActive: boolean;
  sortOrder: number;
  workflowStatus: string;
  auditStatus: string;
  auditNotes: string;
  sourceName: string | null;
  sourceRow: number | null;
  reviewedAt: string | null;
} {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    title: String(row.title),
    summary: String(row.summary || ""),
    module: String(row.module_name),
    route: String(row.route_path || "/manual"),
    roles: parse(row.roles_json, ["user"]),
    keywords: parse(row.keywords_json, []),
    whatIs: String(row.what_is || ""),
    purpose: String(row.purpose || ""),
    accessPath: String(row.access_path || ""),
    steps: parse(row.steps_json, []),
    cautions: parse(row.cautions_json, []),
    faq: parse(row.faq_json, []),
    problems: parse(row.problems_json, []),
    screenshots: parse(row.screenshots_json, []),
    videoUrl: row.video_url || null,
    updatedAt: new Date(row.updated_at || Date.now())
      .toISOString()
      .slice(0, 10),
    isActive: !!row.is_active,
    sortOrder: Number(row.sort_order || 0),
    workflowStatus: String(row.workflow_status || "publicado"),
    auditStatus: String(row.audit_status || "nao_auditado"),
    auditNotes: String(row.audit_notes || ""),
    sourceName: row.source_name || null,
    sourceRow: row.source_row ? Number(row.source_row) : null,
    reviewedAt: row.reviewed_at
      ? new Date(row.reviewed_at).toISOString()
      : null,
  };
}
export async function loadCustomKnowledgeArticles(includeInactive = false) {
  await ensureTable();
  const db = await getDb();
  if (!db) return [];
  const result: any = includeInactive
    ? await db.execute(
        drzSql`SELECT * FROM knowledge_custom_articles_v2 ORDER BY sort_order,title`
      )
    : await db.execute(
        drzSql`SELECT * FROM knowledge_custom_articles_v2 WHERE is_active=1 AND workflow_status='publicado' ORDER BY sort_order,title`
      );
  return rowsOf(result).map(mapRow);
}

export async function publishAutomaticKnowledgeArticles(
  articles: Array<{
    slug: string;
    title: string;
    summary: string;
    module: string;
    route: string;
    roles: string[];
    keywords: string[];
    whatIs: string;
    purpose: string;
    accessPath: string;
    steps: string[];
    cautions: string[];
  }>,
  actorId = 1
) {
  await ensureTable();
  const db = await getDb();
  if (!db) return { created: 0, updated: 0 };
  let created = 0;
  let updated = 0;
  for (const article of articles) {
    const current: any = await db.execute(
      drzSql`SELECT id FROM knowledge_custom_articles_v2 WHERE slug=${article.slug} LIMIT 1`
    );
    const roles = JSON.stringify(article.roles);
    const keywords = JSON.stringify(article.keywords);
    const steps = JSON.stringify(article.steps);
    const cautions = JSON.stringify(article.cautions);
    const sourceName = "Manifesto oficial da plataforma";
    if (rowsOf(current).length) {
      await db.execute(drzSql`UPDATE knowledge_custom_articles_v2 SET
        title=${article.title},summary=${article.summary},module_name=${article.module},route_path=${article.route},
        roles_json=${roles},keywords_json=${keywords},what_is=${article.whatIs},purpose=${article.purpose},
        access_path=${article.accessPath},steps_json=${steps},cautions_json=${cautions},is_active=1,
        workflow_status='publicado',audit_status='estrutura_ok',audit_notes='Publicado automaticamente a partir do manifesto versionado.',
        source_name=${sourceName},source_published_flag='automatico',updated_by=${actorId},reviewed_by=${actorId},reviewed_at=NOW()
        WHERE slug=${article.slug}`);
      updated++;
    } else {
      await db.execute(drzSql`INSERT INTO knowledge_custom_articles_v2
        (slug,title,summary,module_name,route_path,roles_json,keywords_json,what_is,purpose,access_path,steps_json,cautions_json,faq_json,problems_json,screenshots_json,video_url,is_active,sort_order,workflow_status,audit_status,audit_notes,source_name,source_published_flag,created_by,updated_by,reviewed_by,reviewed_at)
        VALUES (${article.slug},${article.title},${article.summary},${article.module},${article.route},${roles},${keywords},${article.whatIs},${article.purpose},${article.accessPath},${steps},${cautions},'[]','[]','[]',NULL,1,0,'publicado','estrutura_ok','Publicado automaticamente a partir do manifesto versionado.',${sourceName},'automatico',${actorId},${actorId},${actorId},NOW())`);
      created++;
    }
  }
  return { created, updated };
}

const inputSchema = z.object({
  id: z.number().int().positive().optional(),
  slug: z
    .string()
    .min(2)
    .max(160)
    .regex(/^[a-z0-9-]+$/),
  title: z.string().min(3).max(255),
  summary: z.string().max(10000).default(""),
  module: z.string().min(2).max(120),
  route: z.string().max(255).default("/manual"),
  roles: z
    .array(
      z.enum([
        "user",
        "chefia",
        "cipa",
        "sesmt",
        "rh",
        "admin",
        "company_admin",
        "admin_global",
        "super_admin",
        "psicologo",
        "medico",
      ])
    )
    .min(1),
  keywords: z.array(z.string().max(100)).max(100).default([]),
  whatIs: z.string().max(100000).default(""),
  purpose: z.string().max(100000).default(""),
  accessPath: z.string().max(2000).default(""),
  steps: z.array(z.string().max(10000)).max(100).default([]),
  cautions: z.array(z.string().max(10000)).max(100).default([]),
  faq: z
    .array(
      z.object({
        question: z.string().max(1000),
        answer: z.string().max(20000),
      })
    )
    .max(100)
    .default([]),
  problems: z
    .array(
      z.object({
        problem: z.string().max(2000),
        solution: z.string().max(20000),
      })
    )
    .max(100)
    .default([]),
  screenshots: z
    .array(
      z.object({
        url: z.string().max(1000),
        alt: z.string().max(500),
        caption: z.string().max(1000).optional(),
      })
    )
    .max(50)
    .default([]),
  videoUrl: z.string().url().max(1000).nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  workflowStatus: z
    .enum(["rascunho", "em_validacao", "aprovado", "publicado", "arquivado"])
    .default("rascunho"),
  auditStatus: z
    .enum(["nao_auditado", "revisar", "estrutura_ok", "aprovado"])
    .default("nao_auditado"),
  auditNotes: z.string().max(100000).default(""),
  sourceName: z.string().max(500).nullable().optional(),
  sourceRow: z.number().int().positive().nullable().optional(),
});

function deterministicAudit(article: any) {
  const notes: string[] = [];
  if (!String(article.route_path || "").startsWith("/"))
    notes.push("Rota inválida ou ausente.");
  if (!parse(article.roles_json, []).length)
    notes.push("Nenhum perfil autorizado.");
  if (String(article.summary || "").startsWith("Guia prático: utilização"))
    notes.push("Resumo genérico; revisar contra a funcionalidade real.");
  if (String(article.what_is || "").trim().length < 40)
    notes.push("A seção 'O que é?' precisa de aprofundamento.");
  if (String(article.purpose || "").trim().length < 40)
    notes.push("A seção 'Para que serve?' precisa de aprofundamento.");
  if (parse(article.steps_json, []).length < 3)
    notes.push("Passo a passo insuficiente.");
  if (!parse(article.cautions_json, []).length)
    notes.push("Cuidados não informados.");
  return {
    auditStatus: notes.length ? "revisar" : "estrutura_ok",
    notes,
  };
}

export const guidanceRouter = router({
  listAdmin: protectedProcedure.query(async ({ ctx }) => {
    requireSuper(ctx);
    return loadCustomKnowledgeArticles(true);
  }),
  catalogStats: protectedProcedure.query(async ({ ctx }) => {
    requireSuper(ctx);
    await ensureTable();
    const db = await getDb();
    if (!db) return null;
    const result: any = await db.execute(drzSql`SELECT
      COUNT(*) total,
      SUM(workflow_status='rascunho') rascunho,
      SUM(workflow_status='em_validacao') em_validacao,
      SUM(workflow_status='aprovado') aprovado,
      SUM(workflow_status='publicado') publicado,
      SUM(workflow_status='arquivado') arquivado,
      SUM(audit_status='revisar') revisar,
      SUM(audit_status IN ('estrutura_ok','aprovado')) auditados
      FROM knowledge_custom_articles_v2`);
    return rowsOf(result)[0] || {};
  }),
  importCatalog: protectedProcedure.mutation(async ({ ctx }) => {
    requireSuper(ctx);
    await ensureTable();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const inserted = await seedManualCatalog(db, Number(ctx.user.id));
    return { ok: true, inserted, totalSource: manualCatalogSeed.length };
  }),
  auditCatalog: protectedProcedure.mutation(async ({ ctx }) => {
    requireSuper(ctx);
    await ensureTable();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const result: any = await db.execute(
      drzSql`SELECT * FROM knowledge_custom_articles_v2 ORDER BY id`
    );
    let review = 0;
    let structurallyOk = 0;
    for (const article of rowsOf(result)) {
      const audit = deterministicAudit(article);
      if (audit.auditStatus === "revisar") review++;
      else structurallyOk++;
      await db.execute(
        drzSql`UPDATE knowledge_custom_articles_v2 SET audit_status=${audit.auditStatus},audit_notes=${audit.notes.join("\n") || null},reviewed_by=${Number(ctx.user.id)},reviewed_at=NOW() WHERE id=${Number(article.id)}`
      );
    }
    return { ok: true, reviewed: review, structurallyOk };
  }),
  changeStatus: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum([
          "rascunho",
          "em_validacao",
          "aprovado",
          "publicado",
          "arquivado",
        ]),
        confirmation: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireSuper(ctx);
      await ensureTable();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const found: any = await db.execute(
        drzSql`SELECT audit_status FROM knowledge_custom_articles_v2 WHERE id=${input.id} LIMIT 1`
      );
      const row = rowsOf(found)[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      if (
        input.status === "publicado" &&
        !input.confirmation
      )
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Confirme explicitamente a publicação do artigo.",
        });
      await db.execute(
        drzSql`UPDATE knowledge_custom_articles_v2 SET workflow_status=${input.status},is_active=${input.status === "publicado" ? 1 : 0},updated_by=${Number(ctx.user.id)},reviewed_by=${Number(ctx.user.id)},reviewed_at=NOW() WHERE id=${input.id}`
      );
      return { ok: true, auditStatus: row.audit_status };
    }),
  upsert: protectedProcedure
    .input(inputSchema)
    .mutation(async ({ ctx, input }) => {
      requireSuper(ctx);
      await ensureTable();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let id = input.id || 0;
      if (input.workflowStatus === "publicado") {
        if (!id)
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Salve o artigo e utilize a acao explicita de aprovar e publicar.",
          });
        const currentResult: any = await db.execute(
          drzSql`SELECT workflow_status FROM knowledge_custom_articles_v2 WHERE id=${id} LIMIT 1`
        );
        const current = rowsOf(currentResult)[0];
        if (!current) throw new TRPCError({ code: "NOT_FOUND" });
        if (current.workflow_status !== "publicado")
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Utilize a acao explicita de aprovar e publicar para liberar o artigo.",
          });
      }
      const values = {
        roles: JSON.stringify(input.roles),
        keywords: JSON.stringify(input.keywords),
        steps: JSON.stringify(input.steps),
        cautions: JSON.stringify(input.cautions),
        faq: JSON.stringify(input.faq),
        problems: JSON.stringify(input.problems),
        screenshots: JSON.stringify(input.screenshots),
      };
      if (id)
        await db.execute(
          drzSql`UPDATE knowledge_custom_articles_v2 SET slug=${input.slug},title=${input.title},summary=${input.summary},module_name=${input.module},route_path=${input.route},roles_json=${values.roles},keywords_json=${values.keywords},what_is=${input.whatIs},purpose=${input.purpose},access_path=${input.accessPath},steps_json=${values.steps},cautions_json=${values.cautions},faq_json=${values.faq},problems_json=${values.problems},screenshots_json=${values.screenshots},video_url=${input.videoUrl || null},is_active=${input.workflowStatus === "publicado" && input.isActive ? 1 : 0},sort_order=${input.sortOrder},workflow_status=${input.workflowStatus},audit_status=${input.auditStatus},audit_notes=${input.auditNotes || null},source_name=${input.sourceName || null},source_row=${input.sourceRow || null},updated_by=${Number(ctx.user.id)},reviewed_by=${Number(ctx.user.id)},reviewed_at=NOW() WHERE id=${id}`
        );
      else {
        const result: any = await db.execute(
          drzSql`INSERT INTO knowledge_custom_articles_v2 (slug,title,summary,module_name,route_path,roles_json,keywords_json,what_is,purpose,access_path,steps_json,cautions_json,faq_json,problems_json,screenshots_json,video_url,is_active,sort_order,workflow_status,audit_status,audit_notes,source_name,source_row,created_by,updated_by,reviewed_by,reviewed_at) VALUES (${input.slug},${input.title},${input.summary},${input.module},${input.route},${values.roles},${values.keywords},${input.whatIs},${input.purpose},${input.accessPath},${values.steps},${values.cautions},${values.faq},${values.problems},${values.screenshots},${input.videoUrl || null},${input.workflowStatus === "publicado" && input.isActive ? 1 : 0},${input.sortOrder},${input.workflowStatus},${input.auditStatus},${input.auditNotes || null},${input.sourceName || null},${input.sourceRow || null},${Number(ctx.user.id)},${Number(ctx.user.id)},${Number(ctx.user.id)},NOW())`
        );
        id = Number((result as any)[0]?.insertId || 0);
      }
      return { ok: true, id };
    }),
  remove: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireSuper(ctx);
      await ensureTable();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.execute(
        drzSql`DELETE FROM knowledge_custom_articles_v2 WHERE id=${input.id}`
      );
      return { ok: true };
    }),
});
