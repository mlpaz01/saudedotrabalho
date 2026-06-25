/**
 * SP7 — Foundation WhatsApp Business API (Meta Cloud API).
 *
 * Stack:
 *   - Meta Cloud API direto (Graph v18+)
 *   - Webhook em /api/whatsapp/webhook (GET verify + POST receive)
 *   - State machine pra navegar menus
 *   - LGPD opt-in/opt-out
 *
 * Modo "preview": se META_WA_TOKEN não estiver no .env, todos os envios
 * são logados sem ir pra Meta. Mesma estratégia do SMTP (helper sendEmail).
 */
import { getDb } from "../db";
import { sql as drzSql } from "drizzle-orm";

const GRAPH_VERSION = "v18.0";

export interface WhatsappEnv {
  token: string | undefined;
  phoneNumberId: string | undefined;
  verifyToken: string | undefined;
  appSecret: string | undefined;
  isPreview: boolean;
}

export function getWhatsappEnv(): WhatsappEnv {
  const token = process.env.META_WA_TOKEN;
  const phoneNumberId = process.env.META_WA_PHONE_ID;
  const verifyToken = process.env.META_WA_VERIFY_TOKEN || "saude_do_trabalho_webhook_2026";
  const appSecret = process.env.META_WA_APP_SECRET;
  return { token, phoneNumberId, verifyToken, appSecret, isPreview: !token || !phoneNumberId };
}

// ─── DDL idempotente ───────────────────────────────────────────────────────
let _ddlDone = false;
export async function ensureWhatsappTables() {
  if (_ddlDone) return;
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(drzSql`CREATE TABLE IF NOT EXISTS whatsapp_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      phone_e164 VARCHAR(20) NOT NULL,
      user_id INT NULL,
      company_id INT NULL,
      state JSON NULL,
      current_flow VARCHAR(60) NULL,
      last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_phone (phone_e164),
      INDEX idx_session_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await db.execute(drzSql`CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      phone_e164 VARCHAR(20) NOT NULL,
      direction ENUM('in','out') NOT NULL,
      msg_type VARCHAR(30) NULL,
      body TEXT NULL,
      media_id VARCHAR(120) NULL,
      mime_type VARCHAR(80) NULL,
      template_name VARCHAR(120) NULL,
      meta_msg_id VARCHAR(120) NULL,
      status VARCHAR(30) NULL,
      error_msg TEXT NULL,
      ctx_user_id INT NULL,
      ctx_company_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_msg_phone (phone_e164, created_at),
      INDEX idx_msg_meta (meta_msg_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await db.execute(drzSql`CREATE TABLE IF NOT EXISTS whatsapp_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL UNIQUE,
      category VARCHAR(40) NULL,
      language VARCHAR(10) DEFAULT 'pt_BR',
      status VARCHAR(30) DEFAULT 'pending',
      body TEXT NULL,
      header TEXT NULL,
      footer TEXT NULL,
      buttons JSON NULL,
      submitted_at TIMESTAMP NULL,
      approved_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await db.execute(drzSql`CREATE TABLE IF NOT EXISTS whatsapp_optouts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      phone_e164 VARCHAR(20) NOT NULL UNIQUE,
      reason VARCHAR(120) NULL,
      opted_out_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_opt_phone (phone_e164)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    // ALTER users (idempotente) — campo whatsapp
    try { await db.execute(drzSql`ALTER TABLE users ADD COLUMN whatsapp_e164 VARCHAR(20) NULL`); } catch (_) {}
    try { await db.execute(drzSql`ALTER TABLE users ADD INDEX idx_users_whatsapp (whatsapp_e164)`); } catch (_) {}
    _ddlDone = true;
  } catch (err) {
    console.warn("[whatsapp] DDL falhou:", (err as any)?.message);
  }
}

// ─── Normalização de número ────────────────────────────────────────────────
// Aceita "(11) 98765-4321", "11987654321", "+5511987654321" → "+5511987654321"
export function normalizeE164BR(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = String(input).replace(/\D/g, "");
  if (!s) return null;
  // Se já começa com 55 e tem 12-13 dígitos, ok
  if (s.startsWith("55") && (s.length === 12 || s.length === 13)) return `+${s}`;
  // Se tem 10-11 dígitos, presume Brasil
  if (s.length === 10 || s.length === 11) return `+55${s}`;
  // Se já tem 13 dígitos sem 55, presume e prefixa
  if (s.length === 13 && !s.startsWith("55")) return `+${s}`;
  // Caso contrário, devolve com + prefixado (internacional)
  return `+${s}`;
}

// ─── Envio: texto simples (livre, só dentro de janela de 24h) ─────────────
export async function sendWhatsappText(toE164: string, body: string, ctx?: { userId?: number; companyId?: number }) {
  const env = getWhatsappEnv();
  const db = await getDb();
  await ensureWhatsappTables();

  // Bloqueia opt-out
  if (db) {
    const r: any = await db.execute(drzSql`SELECT id FROM whatsapp_optouts WHERE phone_e164=${toE164} LIMIT 1`);
    if ((r as any)[0]?.[0]) {
      console.warn(`[whatsapp] envio bloqueado: ${toE164} optou por sair`);
      return { ok: false, blocked: "optout" as const };
    }
  }

  if (env.isPreview) {
    console.log("[whatsapp PREVIEW]", { to: toE164, body: body.slice(0, 200) });
    if (db) {
      try {
        await db.execute(drzSql`INSERT INTO whatsapp_messages (phone_e164, direction, msg_type, body, status, ctx_user_id, ctx_company_id)
          VALUES (${toE164}, 'out', 'text', ${body}, 'preview', ${ctx?.userId ?? null}, ${ctx?.companyId ?? null})`);
      } catch (_) {}
    }
    return { ok: true, preview: true };
  }

  try {
    const resp = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${env.phoneNumberId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.token}` },
      body: JSON.stringify({ messaging_product: "whatsapp", to: toE164.replace("+", ""), type: "text", text: { body } }),
    });
    const data: any = await resp.json();
    const metaId = data?.messages?.[0]?.id ?? null;
    if (db) {
      await db.execute(drzSql`INSERT INTO whatsapp_messages (phone_e164, direction, msg_type, body, status, meta_msg_id, error_msg, ctx_user_id, ctx_company_id)
        VALUES (${toE164}, 'out', 'text', ${body}, ${resp.ok ? "sent" : "failed"}, ${metaId}, ${resp.ok ? null : JSON.stringify(data?.error ?? data)}, ${ctx?.userId ?? null}, ${ctx?.companyId ?? null})`);
    }
    return { ok: resp.ok, metaId, error: resp.ok ? null : data?.error };
  } catch (err: any) {
    console.warn("[whatsapp] erro envio:", err?.message);
    if (db) {
      try {
        await db.execute(drzSql`INSERT INTO whatsapp_messages (phone_e164, direction, msg_type, body, status, error_msg, ctx_user_id, ctx_company_id)
          VALUES (${toE164}, 'out', 'text', ${body}, 'error', ${String(err?.message ?? err)}, ${ctx?.userId ?? null}, ${ctx?.companyId ?? null})`);
      } catch (_) {}
    }
    return { ok: false, error: String(err?.message ?? err) };
  }
}

// ─── Envio: template (HSM, único modo válido fora da janela de 24h) ──────
export async function sendWhatsappTemplate(toE164: string, templateName: string, language: string = "pt_BR", bodyParams: string[] = [], ctx?: { userId?: number; companyId?: number }) {
  const env = getWhatsappEnv();
  const db = await getDb();
  await ensureWhatsappTables();

  if (db) {
    const r: any = await db.execute(drzSql`SELECT id FROM whatsapp_optouts WHERE phone_e164=${toE164} LIMIT 1`);
    if ((r as any)[0]?.[0]) return { ok: false, blocked: "optout" as const };
  }

  if (env.isPreview) {
    console.log("[whatsapp PREVIEW template]", { to: toE164, templateName, language, bodyParams });
    if (db) {
      try {
        await db.execute(drzSql`INSERT INTO whatsapp_messages (phone_e164, direction, msg_type, template_name, body, status, ctx_user_id, ctx_company_id)
          VALUES (${toE164}, 'out', 'template', ${templateName}, ${JSON.stringify(bodyParams)}, 'preview', ${ctx?.userId ?? null}, ${ctx?.companyId ?? null})`);
      } catch (_) {}
    }
    return { ok: true, preview: true };
  }

  try {
    const components: any[] = [];
    if (bodyParams.length) {
      components.push({ type: "body", parameters: bodyParams.map(p => ({ type: "text", text: String(p) })) });
    }
    const resp = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${env.phoneNumberId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.token}` },
      body: JSON.stringify({
        messaging_product: "whatsapp", to: toE164.replace("+", ""), type: "template",
        template: { name: templateName, language: { code: language }, components },
      }),
    });
    const data: any = await resp.json();
    const metaId = data?.messages?.[0]?.id ?? null;
    if (db) {
      await db.execute(drzSql`INSERT INTO whatsapp_messages (phone_e164, direction, msg_type, template_name, body, status, meta_msg_id, error_msg, ctx_user_id, ctx_company_id)
        VALUES (${toE164}, 'out', 'template', ${templateName}, ${JSON.stringify(bodyParams)}, ${resp.ok ? "sent" : "failed"}, ${metaId}, ${resp.ok ? null : JSON.stringify(data?.error ?? data)}, ${ctx?.userId ?? null}, ${ctx?.companyId ?? null})`);
    }
    return { ok: resp.ok, metaId, error: resp.ok ? null : data?.error };
  } catch (err: any) {
    console.warn("[whatsapp] erro template:", err?.message);
    return { ok: false, error: String(err?.message ?? err) };
  }
}

// ─── Opt-out ──────────────────────────────────────────────────────────────
const OPTOUT_KEYWORDS = ["sair", "cancelar", "stop", "parar", "remover", "descadastrar"];
export function isOptOutMessage(text: string): boolean {
  const t = (text || "").trim().toLowerCase();
  return OPTOUT_KEYWORDS.some(k => t === k || t.startsWith(k + " "));
}

export async function registerOptOut(phoneE164: string, reason: string = "user_keyword") {
  const db = await getDb();
  if (!db) return;
  await ensureWhatsappTables();
  await db.execute(drzSql`INSERT IGNORE INTO whatsapp_optouts (phone_e164, reason) VALUES (${phoneE164}, ${reason})`);
}

export async function isOptedOut(phoneE164: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await ensureWhatsappTables();
  const r: any = await db.execute(drzSql`SELECT id FROM whatsapp_optouts WHERE phone_e164=${phoneE164} LIMIT 1`);
  return !!((r as any)[0]?.[0]);
}

// ─── Session state (state machine) ────────────────────────────────────────
export type SessionState = {
  step: string;                  // ex: "menu", "lgpd_pending", "survey_q3"
  flow?: string;                 // ex: "survey:42", "denuncia", "psi_book"
  data?: Record<string, any>;    // contexto livre (respostas até agora, surveyId, etc)
  lgpdAccepted?: boolean;
};

export async function getSession(phoneE164: string): Promise<{ id: number; userId: number | null; companyId: number | null; state: SessionState }> {
  const db = await getDb();
  await ensureWhatsappTables();
  // Match user pelo número
  let userId: number | null = null;
  let companyId: number | null = null;
  if (db) {
    const u: any = await db.execute(drzSql`SELECT id, company_id FROM users WHERE whatsapp_e164=${phoneE164} LIMIT 1`);
    const ur = (u as any)[0]?.[0];
    if (ur) { userId = Number(ur.id); companyId = ur.company_id ? Number(ur.company_id) : null; }
  }
  if (db) {
    const r: any = await db.execute(drzSql`SELECT id, user_id, company_id, state FROM whatsapp_sessions WHERE phone_e164=${phoneE164} LIMIT 1`);
    const row = (r as any)[0]?.[0];
    if (row) {
      let state: SessionState = { step: "init" };
      try { state = row.state ? (typeof row.state === "string" ? JSON.parse(row.state) : row.state) : { step: "init" }; } catch (_) {}
      return { id: Number(row.id), userId: row.user_id ?? userId, companyId: row.company_id ?? companyId, state };
    }
    // Cria
    const ins: any = await db.execute(drzSql`
      INSERT INTO whatsapp_sessions (phone_e164, user_id, company_id, state)
      VALUES (${phoneE164}, ${userId}, ${companyId}, ${JSON.stringify({ step: "init" })})`);
    return { id: Number((ins as any)[0]?.insertId ?? 0), userId, companyId, state: { step: "init" } };
  }
  return { id: 0, userId, companyId, state: { step: "init" } };
}

export async function setSessionState(phoneE164: string, state: SessionState) {
  const db = await getDb();
  if (!db) return;
  await db.execute(drzSql`UPDATE whatsapp_sessions SET state=${JSON.stringify(state)}, current_flow=${state.flow ?? null} WHERE phone_e164=${phoneE164}`);
}

// ─── Persiste mensagem entrante ──────────────────────────────────────────
export async function logIncomingMessage(phoneE164: string, msgType: string, body: string | null, metaMsgId: string | null, mediaId: string | null, mimeType: string | null) {
  const db = await getDb();
  if (!db) return;
  await ensureWhatsappTables();
  await db.execute(drzSql`
    INSERT INTO whatsapp_messages (phone_e164, direction, msg_type, body, meta_msg_id, media_id, mime_type, status)
    VALUES (${phoneE164}, 'in', ${msgType}, ${body}, ${metaMsgId}, ${mediaId}, ${mimeType}, 'received')`);
}
