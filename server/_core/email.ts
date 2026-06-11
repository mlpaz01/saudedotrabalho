// server/_core/email.ts — SMTP sender with preview fallback
import nodemailer, { Transporter } from "nodemailer";

export interface EmailMessage {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
}

let transporter: Transporter | null = null;
let transporterInitialized = false;

function getTransporter(): Transporter | null {
  if (transporterInitialized) return transporter;
  transporterInitialized = true;
  const host = process.env.SMTP_HOST;
  const portRaw = process.env.SMTP_PORT || "587";
  const port = parseInt(portRaw, 10) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    transporter = null;
    return null;
  }
  try {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  } catch (e) {
    console.warn("[email] failed to create transporter:", e);
    transporter = null;
  }
  return transporter;
}

export async function sendEmail(
  msg: EmailMessage
): Promise<{ ok: boolean; preview: boolean; error?: string }> {
  const t = getTransporter();
  const from = process.env.SMTP_FROM || "no-reply@saudedotrabalho.com";
  if (!t) {
    // Preview mode: log to console without sending
    console.log("[EMAIL PREVIEW]", {
      from,
      to: msg.to,
      toName: msg.toName,
      subject: msg.subject,
      bodySnippet: msg.html.slice(0, 240),
    });
    return { ok: true, preview: true };
  }
  try {
    await t.sendMail({
      from,
      to: msg.toName ? `"${msg.toName}" <${msg.to}>` : msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text || msg.html.replace(/<[^>]+>/g, ""),
    });
    return { ok: true, preview: false };
  } catch (e: any) {
    return { ok: false, preview: false, error: e?.message || String(e) };
  }
}

/** Replace {{name}}-style placeholders. Unknown keys are kept as-is for visibility. */
export function fillTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = vars[k];
    return v === undefined || v === null ? `{{${k}}}` : String(v);
  });
}

/** Convert plain-text body (with line breaks) into safe HTML. */
export function plainToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const linked = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#1e3a5f;text-decoration:underline">$1</a>'
  );
  const paragraphs = linked
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px 0">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1f2937;max-width:640px">${paragraphs}</div>`;
}
