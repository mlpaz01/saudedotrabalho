import { TRPCError } from "@trpc/server";
import { sql as drzSql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import type { KnowledgeArticle } from "./knowledgeCatalog";
import { protectedProcedure, router } from "./trpc";

let ready = false;
function rowsOf(result: any): any[] {
  return Array.isArray(result?.[0]) ? result[0] : [];
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
function mapRow(
  row: any
): KnowledgeArticle & { id: number; isActive: boolean; sortOrder: number } {
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
        drzSql`SELECT * FROM knowledge_custom_articles_v2 WHERE is_active=1 ORDER BY sort_order,title`
      );
  return rowsOf(result).map(mapRow);
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
});

export const guidanceRouter = router({
  listAdmin: protectedProcedure.query(async ({ ctx }) => {
    requireSuper(ctx);
    return loadCustomKnowledgeArticles(true);
  }),
  upsert: protectedProcedure
    .input(inputSchema)
    .mutation(async ({ ctx, input }) => {
      requireSuper(ctx);
      await ensureTable();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let id = input.id || 0;
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
          drzSql`UPDATE knowledge_custom_articles_v2 SET slug=${input.slug},title=${input.title},summary=${input.summary},module_name=${input.module},route_path=${input.route},roles_json=${values.roles},keywords_json=${values.keywords},what_is=${input.whatIs},purpose=${input.purpose},access_path=${input.accessPath},steps_json=${values.steps},cautions_json=${values.cautions},faq_json=${values.faq},problems_json=${values.problems},screenshots_json=${values.screenshots},video_url=${input.videoUrl || null},is_active=${input.isActive ? 1 : 0},sort_order=${input.sortOrder},updated_by=${Number(ctx.user.id)} WHERE id=${id}`
        );
      else {
        const result: any = await db.execute(
          drzSql`INSERT INTO knowledge_custom_articles_v2 (slug,title,summary,module_name,route_path,roles_json,keywords_json,what_is,purpose,access_path,steps_json,cautions_json,faq_json,problems_json,screenshots_json,video_url,is_active,sort_order,created_by,updated_by) VALUES (${input.slug},${input.title},${input.summary},${input.module},${input.route},${values.roles},${values.keywords},${input.whatIs},${input.purpose},${input.accessPath},${values.steps},${values.cautions},${values.faq},${values.problems},${values.screenshots},${input.videoUrl || null},${input.isActive ? 1 : 0},${input.sortOrder},${Number(ctx.user.id)},${Number(ctx.user.id)})`
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
