import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { TRPCError } from "@trpc/server";
import { sql as drzSql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import { activeEmployeeSql } from "./activeEmployees";
import { protectedProcedure, router } from "./trpc";

let tablesReady = false;

const MANAGER_ROLES = new Set([
  "admin",
  "rh",
  "sesmt",
  "company_admin",
  "admin_global",
  "super_admin",
]);

function rowsOf(result: any): any[] {
  if (Array.isArray(result?.[0])) return result[0];
  if (Array.isArray(result)) return result;
  return [];
}

function companyIdOf(ctx: any) {
  const companyId = Number(ctx.user?.companyId || 0);
  if (!companyId)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Empresa nao identificada.",
    });
  return companyId;
}

function requireManager(ctx: any) {
  if (!MANAGER_ROLES.has(String(ctx.user?.role || "")))
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "A gestao do DDS e restrita ao RH, SESMT e administradores autorizados.",
    });
}

function protocolCode() {
  const year = new Date().getFullYear();
  return `DDS-${year}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function requestMeta(ctx: any) {
  const fwd = ctx.req?.headers?.["x-forwarded-for"];
  const ip =
    (Array.isArray(fwd) ? fwd[0] : String(fwd || "").split(",")[0]).trim() ||
    ctx.req?.ip ||
    ctx.req?.socket?.remoteAddress ||
    "";
  return {
    ip: String(ip).slice(0, 45),
    userAgent: String(ctx.req?.headers?.["user-agent"] || "").slice(0, 500),
  };
}

async function ensureTables(db: any) {
  if (tablesReady) return;
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS dds_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    protocol_code VARCHAR(32) NOT NULL,
    title VARCHAR(255) NOT NULL,
    theme VARCHAR(180) NULL,
    objective TEXT NULL,
    content MEDIUMTEXT NOT NULL,
    session_date DATE NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 10,
    facilitator_name VARCHAR(255) NULL,
    branch_id INT NULL,
    sector_id INT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'rascunho',
    created_by INT NOT NULL,
    published_at DATETIME NULL,
    closed_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_dds_protocol (protocol_code),
    INDEX idx_dds_company (company_id, session_date, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS dds_assignments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id BIGINT NOT NULL,
    company_id INT NOT NULL,
    collaborator_id INT NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'pendente',
    attendance_seconds INT NOT NULL DEFAULT 0,
    acknowledgment_code VARCHAR(40) NULL,
    acknowledged_at DATETIME NULL,
    acknowledgment_ip VARCHAR(45) NULL,
    user_agent VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_dds_assignment (session_id, collaborator_id),
    INDEX idx_dds_assignment_user (company_id, collaborator_id, status),
    INDEX idx_dds_assignment_session (session_id, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS dds_audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    session_id BIGINT NOT NULL,
    actor_user_id INT NOT NULL,
    action VARCHAR(80) NOT NULL,
    details_json LONGTEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_dds_audit (company_id, session_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  tablesReady = true;
}

async function audit(
  db: any,
  companyId: number,
  sessionId: number,
  actorId: number,
  action: string,
  details: unknown = null
) {
  await db.execute(drzSql`INSERT INTO dds_audit_log
    (company_id, session_id, actor_user_id, action, details_json)
    VALUES (${companyId}, ${sessionId}, ${actorId}, ${action}, ${details ? JSON.stringify(details) : null})`);
}

function esc(value: unknown) {
  return String(value ?? "").replace(
    /[<>&"]/g,
    char => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[char]!
  );
}

function formatDate(value: unknown) {
  if (!value) return "-";
  const text = String(value);
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  const date = new Date(text);
  return Number.isNaN(date.getTime())
    ? text
    : date.toLocaleDateString("pt-BR");
}

async function generateDdsReport(
  db: any,
  companyId: number,
  sessionId: number
) {
  const [[session]]: any =
    await db.execute(drzSql`SELECT d.*, b.name branch_name, s.name sector_name,
      c.name company_name, c.cnpj company_cnpj
    FROM dds_sessions d
    JOIN companies c ON c.id=d.company_id
    LEFT JOIN branches b ON b.id=d.branch_id
    LEFT JOIN sectors s ON s.id=d.sector_id
    WHERE d.id=${sessionId} AND d.company_id=${companyId} LIMIT 1`);
  if (!session)
    throw new TRPCError({ code: "NOT_FOUND", message: "DDS nao encontrado." });
  const participants = rowsOf(
    await db.execute(drzSql`SELECT u.name, u.cpf, u.position, b.name branch_name, s.name sector_name,
        a.status, a.attendance_seconds, a.acknowledgment_code, a.acknowledged_at
      FROM dds_assignments a
      JOIN users u ON u.id=a.collaborator_id
      LEFT JOIN branches b ON b.id=u.branch_id
      LEFT JOIN sectors s ON s.id=u.sector_id
      WHERE a.session_id=${sessionId} AND a.company_id=${companyId}
      ORDER BY b.name, s.name, u.name`)
  );
  const completed = participants.filter(
    (item: any) => item.status === "concluido"
  ).length;
  const participantRows = participants
    .map(
      (item: any) =>
        `<tr><td>${esc(item.name)}</td><td>${esc(item.branch_name || "-")}</td><td>${esc(item.sector_name || "-")}</td><td>${esc(item.position || "-")}</td><td>${item.status === "concluido" ? "Concluido" : "Pendente"}</td><td>${esc(item.acknowledgment_code || "-")}</td><td>${esc(item.acknowledged_at ? formatDate(item.acknowledged_at) : "-")}</td></tr>`
    )
    .join("");
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
    @page{size:A4;margin:16mm}body{font-family:Arial,sans-serif;color:#172b3f;font-size:10pt;line-height:1.45}
    h1{font-size:22pt;color:#0e2c46;margin:0}h2{font-size:13pt;color:#0e2c46;border-bottom:2px solid #0796a5;padding-bottom:4px;margin-top:18px}
    .meta{color:#64748b;margin:4px 0 16px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.card{border:1px solid #d9e2e8;padding:10px}.card b{font-size:16pt;color:#087f8c}.content{white-space:pre-wrap;border-left:4px solid #f3ad16;padding-left:12px}
    table{width:100%;border-collapse:collapse;font-size:8pt}th,td{border:1px solid #d9e2e8;padding:5px;text-align:left}th{background:#e9f5f6}.note{background:#f8fafc;border:1px solid #d9e2e8;padding:9px;margin-top:14px}
  </style></head><body><h1>Relatorio de Evidencias do DDS Online</h1>
  <div class="meta"><b>${esc(session.company_name)}</b> · CNPJ ${esc(session.company_cnpj || "-")} · Protocolo ${esc(session.protocol_code)}</div>
  <div class="cards"><div class="card">Convidados<br><b>${participants.length}</b></div><div class="card">Concluidos<br><b>${completed}</b></div><div class="card">Participacao<br><b>${participants.length ? Math.round((completed / participants.length) * 100) : 0}%</b></div></div>
  <h2>1. Identificacao</h2><p><b>Titulo:</b> ${esc(session.title)}<br><b>Tema:</b> ${esc(session.theme || "-")}<br><b>Data:</b> ${esc(formatDate(session.session_date))}<br><b>Duracao prevista:</b> ${esc(session.duration_minutes)} minutos<br><b>Facilitador:</b> ${esc(session.facilitator_name || "-")}<br><b>Publico:</b> ${esc(session.branch_name || "Todas as filiais")} / ${esc(session.sector_name || "Todos os setores")}</p>
  <h2>2. Objetivo</h2><div class="content">${esc(session.objective || "-")}</div><h2>3. Conteudo apresentado</h2><div class="content">${esc(session.content)}</div>
  <h2>4. Evidencias individuais</h2><table><thead><tr><th>Colaborador</th><th>Filial</th><th>Setor</th><th>Cargo</th><th>Status</th><th>Confirmacao</th><th>Data</th></tr></thead><tbody>${participantRows || '<tr><td colspan="7">Nenhum participante vinculado.</td></tr>'}</tbody></table>
  <div class="note">A confirmacao eletrônica comprova o acesso e o aceite individual ao conteúdo registrado. O DDS não substitui treinamentos legalmente obrigatórios quando a norma aplicável exigir conteúdo, carga horária, instrutor ou certificação específicos.</div>
  </body></html>`;
  const puppeteer = (await import("puppeteer")).default;
  const outDir = path.join(process.cwd(), "uploads", "dds");
  await fs.mkdir(outDir, { recursive: true });
  const fileName = `dds_${sessionId}_${Date.now()}.pdf`;
  const browser = await puppeteer.launch({
    executablePath:
      process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium-browser",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    await page.pdf({
      path: path.join(outDir, fileName),
      format: "A4",
      printBackground: true,
    });
  } finally {
    await browser.close();
  }
  return {
    url: `/uploads/dds/${fileName}`,
    total: participants.length,
    completed,
  };
}

const sessionInput = z.object({
  id: z.number().int().optional(),
  title: z.string().min(3).max(255),
  theme: z.string().max(180).optional(),
  objective: z.string().max(5000).optional(),
  content: z.string().min(20).max(50000),
  sessionDate: z.string().min(10).max(10),
  durationMinutes: z.number().int().min(1).max(240).default(10),
  facilitatorName: z.string().max(255).optional(),
  branchId: z.number().int().nullable().optional(),
  sectorId: z.number().int().nullable().optional(),
});

export const ddsRouter = router({
  filters: protectedProcedure.query(async ({ ctx }) => {
    requireManager(ctx);
    const companyId = companyIdOf(ctx);
    const db = await getDb();
    if (!db) return { branches: [], sectors: [] };
    const [branches, sectors] = await Promise.all([
      db.execute(
        drzSql`SELECT id,name FROM branches WHERE company_id=${companyId} AND is_active=1 ORDER BY name`
      ),
      db.execute(
        drzSql`SELECT id,name,branch_id FROM sectors WHERE company_id=${companyId} AND is_active=1 ORDER BY name`
      ),
    ]);
    return { branches: rowsOf(branches), sectors: rowsOf(sectors) };
  }),

  listAdmin: protectedProcedure.query(async ({ ctx }) => {
    requireManager(ctx);
    const companyId = companyIdOf(ctx);
    const db = await getDb();
    if (!db) return [];
    await ensureTables(db);
    return rowsOf(
      await db.execute(drzSql`SELECT d.*, b.name branch_name, s.name sector_name,
        COUNT(a.id) assigned_count,
        SUM(CASE WHEN a.status='concluido' THEN 1 ELSE 0 END) completed_count
      FROM dds_sessions d
      LEFT JOIN branches b ON b.id=d.branch_id
      LEFT JOIN sectors s ON s.id=d.sector_id
      LEFT JOIN dds_assignments a ON a.session_id=d.id
      WHERE d.company_id=${companyId}
      GROUP BY d.id ORDER BY d.session_date DESC,d.id DESC`)
    );
  }),

  upsert: protectedProcedure
    .input(sessionInput)
    .mutation(async ({ ctx, input }) => {
      requireManager(ctx);
      const companyId = companyIdOf(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await ensureTables(db);
      if (input.id) {
        const existing = rowsOf(
          await db.execute(
            drzSql`SELECT id,status FROM dds_sessions WHERE id=${input.id} AND company_id=${companyId} LIMIT 1`
          )
        )[0];
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        if (existing.status === "encerrado")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "DDS encerrado nao pode ser editado.",
          });
        await db.execute(
          drzSql`UPDATE dds_sessions SET title=${input.title},theme=${input.theme || null},objective=${input.objective || null},content=${input.content},session_date=${input.sessionDate},duration_minutes=${input.durationMinutes},facilitator_name=${input.facilitatorName || null},branch_id=${input.branchId ?? null},sector_id=${input.sectorId ?? null} WHERE id=${input.id} AND company_id=${companyId}`
        );
        await audit(
          db,
          companyId,
          input.id,
          Number(ctx.user.id),
          "dds_atualizado"
        );
        return { ok: true, id: input.id, protocolCode: null };
      }
      const code = protocolCode();
      const result: any = await db.execute(drzSql`INSERT INTO dds_sessions
      (company_id,protocol_code,title,theme,objective,content,session_date,duration_minutes,facilitator_name,branch_id,sector_id,created_by)
      VALUES (${companyId},${code},${input.title},${input.theme || null},${input.objective || null},${input.content},${input.sessionDate},${input.durationMinutes},${input.facilitatorName || null},${input.branchId ?? null},${input.sectorId ?? null},${ctx.user.id})`);
      const id = Number(
        (result as any)?.[0]?.insertId || (result as any)?.insertId || 0
      );
      await audit(db, companyId, id, Number(ctx.user.id), "dds_criado", {
        protocolCode: code,
      });
      return { ok: true, id, protocolCode: code };
    }),

  publish: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      requireManager(ctx);
      const companyId = companyIdOf(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await ensureTables(db);
      const session = rowsOf(
        await db.execute(
          drzSql`SELECT * FROM dds_sessions WHERE id=${input.id} AND company_id=${companyId} LIMIT 1`
        )
      )[0];
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      if (session.status === "encerrado")
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "DDS ja encerrado.",
        });
      const branchFilter = session.branch_id
        ? ` AND u.branch_id=${Number(session.branch_id)}`
        : "";
      const sectorFilter = session.sector_id
        ? ` AND u.sector_id=${Number(session.sector_id)}`
        : "";
      await db.execute(
        drzSql.raw(`INSERT IGNORE INTO dds_assignments (session_id,company_id,collaborator_id)
      SELECT ${Number(input.id)},${companyId},u.id FROM users u
      WHERE u.company_id=${companyId} AND ${activeEmployeeSql("u")}${branchFilter}${sectorFilter}`)
      );
      await db.execute(
        drzSql`UPDATE dds_sessions SET status='publicado',published_at=COALESCE(published_at,NOW()) WHERE id=${input.id} AND company_id=${companyId}`
      );
      const assigned = rowsOf(
        await db.execute(
          drzSql`SELECT COUNT(*) total FROM dds_assignments WHERE session_id=${input.id} AND company_id=${companyId}`
        )
      )[0];
      await audit(
        db,
        companyId,
        input.id,
        Number(ctx.user.id),
        "dds_publicado",
        { assigned: Number(assigned?.total || 0) }
      );
      return { ok: true, assigned: Number(assigned?.total || 0) };
    }),

  close: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      requireManager(ctx);
      const companyId = companyIdOf(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await ensureTables(db);
      await db.execute(
        drzSql`UPDATE dds_sessions SET status='encerrado',closed_at=NOW() WHERE id=${input.id} AND company_id=${companyId}`
      );
      await audit(
        db,
        companyId,
        input.id,
        Number(ctx.user.id),
        "dds_encerrado"
      );
      return { ok: true };
    }),

  detailAdmin: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      requireManager(ctx);
      const companyId = companyIdOf(ctx);
      const db = await getDb();
      if (!db) return null;
      await ensureTables(db);
      const session = rowsOf(
        await db.execute(
          drzSql`SELECT d.*,b.name branch_name,s.name sector_name FROM dds_sessions d LEFT JOIN branches b ON b.id=d.branch_id LEFT JOIN sectors s ON s.id=d.sector_id WHERE d.id=${input.id} AND d.company_id=${companyId} LIMIT 1`
        )
      )[0];
      if (!session) return null;
      const participants = rowsOf(
        await db.execute(
          drzSql`SELECT a.*,u.name,u.cpf,u.position,b.name branch_name,s.name sector_name FROM dds_assignments a JOIN users u ON u.id=a.collaborator_id LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN sectors s ON s.id=u.sector_id WHERE a.session_id=${input.id} AND a.company_id=${companyId} ORDER BY b.name,s.name,u.name`
        )
      );
      const auditLog = rowsOf(
        await db.execute(
          drzSql`SELECT l.*,u.name actor_name FROM dds_audit_log l LEFT JOIN users u ON u.id=l.actor_user_id WHERE l.session_id=${input.id} AND l.company_id=${companyId} ORDER BY l.created_at`
        )
      );
      return { session, participants, audit: auditLog };
    }),

  reportPdf: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      requireManager(ctx);
      const companyId = companyIdOf(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await ensureTables(db);
      const result = await generateDdsReport(db, companyId, input.id);
      await audit(
        db,
        companyId,
        input.id,
        Number(ctx.user.id),
        "relatorio_dds_gerado",
        result
      );
      return result;
    }),

  mySessions: protectedProcedure.query(async ({ ctx }) => {
    const companyId = companyIdOf(ctx);
    const db = await getDb();
    if (!db) return [];
    await ensureTables(db);
    return rowsOf(
      await db.execute(
        drzSql`SELECT d.id,d.protocol_code,d.title,d.theme,d.objective,d.session_date,d.duration_minutes,d.facilitator_name,d.status session_status,a.status,a.attendance_seconds,a.acknowledgment_code,a.acknowledged_at FROM dds_assignments a JOIN dds_sessions d ON d.id=a.session_id WHERE a.company_id=${companyId} AND a.collaborator_id=${ctx.user.id} AND d.status IN ('publicado','encerrado') ORDER BY (a.status='pendente') DESC,d.session_date DESC,d.id DESC`
      )
    );
  }),

  mySession: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const companyId = companyIdOf(ctx);
      const db = await getDb();
      if (!db) return null;
      await ensureTables(db);
      return (
        rowsOf(
          await db.execute(
            drzSql`SELECT d.*,a.status assignment_status,a.attendance_seconds,a.acknowledgment_code,a.acknowledged_at FROM dds_assignments a JOIN dds_sessions d ON d.id=a.session_id WHERE d.id=${input.id} AND a.company_id=${companyId} AND a.collaborator_id=${ctx.user.id} LIMIT 1`
          )
        )[0] || null
      );
    }),

  acknowledge: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        attendanceSeconds: z.number().int().min(0).max(86400),
        confirmed: z.literal(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const companyId = companyIdOf(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await ensureTables(db);
      const assignment = rowsOf(
        await db.execute(
          drzSql`SELECT a.id,a.status,d.status session_status FROM dds_assignments a JOIN dds_sessions d ON d.id=a.session_id WHERE a.session_id=${input.id} AND a.company_id=${companyId} AND a.collaborator_id=${ctx.user.id} LIMIT 1`
        )
      )[0];
      if (!assignment) throw new TRPCError({ code: "NOT_FOUND" });
      if (assignment.status === "concluido")
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "DDS ja confirmado.",
        });
      if (assignment.session_status !== "publicado")
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "DDS nao esta aberto para confirmacao.",
        });
      const code = `DDS-CNF-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
      const meta = requestMeta(ctx);
      await db.execute(
        drzSql`UPDATE dds_assignments SET status='concluido',attendance_seconds=${input.attendanceSeconds},acknowledgment_code=${code},acknowledged_at=NOW(),acknowledgment_ip=${meta.ip || null},user_agent=${meta.userAgent || null} WHERE id=${assignment.id}`
      );
      await audit(
        db,
        companyId,
        input.id,
        Number(ctx.user.id),
        "participacao_confirmada",
        { acknowledgmentCode: code, attendanceSeconds: input.attendanceSeconds }
      );
      return { ok: true, acknowledgmentCode: code };
    }),
});
