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

/**
 * Bruno R4 #1 — Template HTML rico de boas-vindas.
 * Usado no importCollaborators (e em qualquer cadastro novo de colaborador).
 * Contém: cabeçalho com gradient, mensagem, lista de benefícios, CTA destacado, footer LGPD.
 */
export function buildWelcomeEmail(opts: { name: string; companyName: string; link: string; base: string }): string {
  const firstName = (opts.name || "").trim().split(/\s+/)[0] || "Bem-vindo(a)";
  const PRIMARY = "#1e3a5f", ACCENT = "#0ea5e9";
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Bem-vindo(a) à Plataforma Saúde do Trabalho</title>
<style>
  body { margin: 0; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; background: #f1f5f9; color: #1f2937; }
  .wrap { max-width: 640px; margin: 0 auto; background: #ffffff; }
  .header { background: linear-gradient(135deg, ${PRIMARY} 0%, ${ACCENT} 100%); color: white; padding: 40px 30px; text-align: center; }
  .header h1 { margin: 0; font-size: 26px; font-weight: 700; }
  .header p { margin: 6px 0 0; font-size: 14px; opacity: 0.9; }
  .ill { background: linear-gradient(135deg, ${PRIMARY}10 0%, ${ACCENT}15 100%); padding: 0; text-align: center; }
  .ill img { max-width: 100%; display: block; margin: 0 auto; }
  .content { padding: 30px; }
  .greeting { font-size: 18px; font-weight: 600; color: ${PRIMARY}; margin-bottom: 6px; }
  .lead { font-size: 15px; line-height: 1.55; color: #334155; margin-bottom: 20px; }
  .cta-box { background: ${PRIMARY}08; border-left: 4px solid ${ACCENT}; padding: 16px 18px; border-radius: 8px; margin: 18px 0; }
  .cta-btn { display: inline-block; background: ${ACCENT}; color: white !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 15px; margin-top: 10px; }
  .benefits { background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0; }
  .benefits h3 { margin: 0 0 12px; color: ${PRIMARY}; font-size: 15px; }
  .benefits ul { margin: 0; padding-left: 0; list-style: none; }
  .benefits li { padding: 6px 0; font-size: 13.5px; color: #334155; padding-left: 22px; position: relative; }
  .benefits li:before { content: "✓"; position: absolute; left: 0; color: #10b981; font-weight: bold; }
  .footer { background: #f8fafc; padding: 20px 30px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
  .footer a { color: ${ACCENT}; text-decoration: none; }
</style></head><body>
<div class="wrap">
  <div class="header">
    <h1>Bem-vindo(a) à Plataforma<br>Saúde do Trabalho</h1>
    <p>${escapeHtml(opts.companyName)}</p>
  </div>
  <!-- Bruno R5-P3 #4 — SVG inline (sem dependência de arquivo PNG externo que dava 404). -->
  <div class="ill" style="background: linear-gradient(135deg, ${PRIMARY}15, ${ACCENT}20); padding: 26px 30px; text-align: center;">
    <svg width="100%" height="120" viewBox="0 0 640 200" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;display:block;margin:0 auto;">
      <defs>
        <linearGradient id="g1" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${PRIMARY}" />
          <stop offset="100%" stop-color="${ACCENT}" />
        </linearGradient>
      </defs>
      <circle cx="170" cy="100" r="62" fill="url(#g1)" opacity="0.95"/>
      <path d="M170 65 L170 135 M135 100 L205 100" stroke="white" stroke-width="9" stroke-linecap="round"/>
      <text x="260" y="92" font-family="'Segoe UI', Arial, sans-serif" font-size="26" font-weight="800" fill="${PRIMARY}">Bem-vindo(a) à</text>
      <text x="260" y="124" font-family="'Segoe UI', Arial, sans-serif" font-size="22" font-weight="700" fill="${ACCENT}">Saúde do Trabalho</text>
      <text x="260" y="152" font-family="'Segoe UI', Arial, sans-serif" font-size="13" fill="#64748b">SST · NR-01 · Riscos Psicossociais · Treinamentos</text>
    </svg>
  </div>
  <div class="content">
    <p class="greeting">Olá, ${escapeHtml(firstName)}!</p>
    <p class="lead">
      Você foi cadastrado(a) na <b>Plataforma Saúde do Trabalho</b> pela empresa <b>${escapeHtml(opts.companyName)}</b>.
      Estamos felizes em ter você conosco. Para começar a usar, ative seu acesso e defina sua senha clicando no botão abaixo:
    </p>

    <div class="cta-box" style="text-align: center;">
      <p style="margin: 0 0 8px; font-size: 13px; color: #334155;"><b>Ativar meu acesso</b> — este link expira em 7 dias.</p>
      <a href="${escapeHtml(opts.link)}" class="cta-btn">Criar minha senha agora →</a>
      <p style="margin: 12px 0 0; font-size: 11px; color: #94a3b8;">
        Ou copie e cole no navegador:<br>
        <span style="word-break: break-all;">${escapeHtml(opts.link)}</span>
      </p>
    </div>

    <div class="benefits">
      <h3>O que você pode fazer na plataforma:</h3>
      <ul>
        <li>Gestão integrada de Saúde Ocupacional e SST</li>
        <li>Responder pesquisas de riscos psicossociais (NR-01)</li>
        <li>Participar de campanhas e programas preventivos</li>
        <li>Realizar treinamentos obrigatórios e baixar certificados</li>
        <li>Acessar o canal de denúncias com sigilo total</li>
        <li>Acompanhar seus exames e documentos ocupacionais</li>
        <li>Tudo 100% online, em qualquer dispositivo</li>
      </ul>
    </div>

    <p style="font-size: 13px; color: #64748b; margin: 16px 0 0;">
      Dúvidas? Procure o RH da sua empresa ou responda este e-mail.
    </p>
  </div>
  <div class="footer">
    Você está recebendo este e-mail porque seu cadastro foi criado na Plataforma Saúde do Trabalho.<br>
    Em caso de dúvidas sobre o tratamento dos seus dados (LGPD), procure o DPO de sua empresa.<br>
    <br>
    <b>Saúde do Trabalho</b> — <a href="${escapeHtml(opts.base)}">${opts.base.replace(/^https?:\/\//, "")}</a>
  </div>
</div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

/** Centraliza a base URL pra links em e-mail (sempre apontar pra prod). */
export function getEmailLinkBaseUrl(): string {
  // Bruno R5-P5/Fase3 #5 — Links nos e-mails devem SEMPRE apontar pro ambiente
  // de produção (mesmo que o servidor que envia esteja em dev).
  // Override via env PUBLIC_EMAIL_BASE_URL; fallback final = saudedotrabalho.com
  return process.env.PUBLIC_EMAIL_BASE_URL
    || process.env.PUBLIC_BASE_URL_PROD
    || "https://saudedotrabalho.com";
}

/*
 * Bruno R5 #10 — Template HTML rico para confirmação de agendamento.
 * Inclui dados do encontro, link da reunião (Meet/Teams) em destaque + orientações.
 */
export function buildAppointmentEmail(opts: {
  audience: "collaborator" | "professional" | "admin";
  collaboratorName: string;
  professionalName: string;
  professionalSpecialty?: string | null;
  date: string;        // "2026-06-26"
  time: string;        // "14:00"
  durationMin: number;
  meetingUrl?: string | null;
  notes?: string | null;
  companyName?: string;
  base: string;        // app base URL
}): string {
  const PRIMARY = "#1e3a5f", ACCENT = "#10b981";
  const dt = (() => { try { const d = new Date(`${opts.date}T${opts.time}:00`); return d.toLocaleString("pt-BR", { weekday:"long", day:"2-digit", month:"long", year:"numeric", hour:"2-digit", minute:"2-digit" }); } catch { return `${opts.date} às ${opts.time}`; } })();
  const headline =
    opts.audience === "collaborator" ? `Olá, ${escapeHtml(opts.collaboratorName.split(" ")[0])}` :
    opts.audience === "professional" ? `Olá, ${escapeHtml(opts.professionalName.split(" ")[0])}` :
                                       `Novo agendamento`;
  const lead =
    opts.audience === "collaborator" ? `Sua conversa de acolhimento foi <b>confirmada</b>.` :
    opts.audience === "professional" ? `Você tem um <b>novo atendimento</b> agendado.` :
                                       `Um novo atendimento foi registrado na plataforma.`;
  const meetingBox = opts.meetingUrl
    ? `<div style="background:${ACCENT}10; border:1px solid ${ACCENT}40; border-radius:10px; padding:18px; margin:14px 0; text-align:center;">
         <p style="margin:0 0 8px; font-size:13px; color:${PRIMARY}; font-weight:700;">🎥 Link da reunião</p>
         <a href="${escapeHtml(opts.meetingUrl)}" style="display:inline-block; background:${ACCENT}; color:white; padding:10px 22px; border-radius:8px; text-decoration:none; font-weight:700; font-size:14px;">Entrar na reunião →</a>
         <p style="margin:10px 0 0; font-size:11px; color:#64748b; word-break:break-all;">${escapeHtml(opts.meetingUrl)}</p>
       </div>`
    : `<p style="font-size:13px; color:#64748b; margin:12px 0;"><i>O link da reunião será enviado em breve pelo profissional.</i></p>`;
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Agendamento confirmado</title></head>
<body style="margin:0; font-family:'Segoe UI', Arial, sans-serif; background:#f1f5f9; color:#1f2937;">
  <div style="max-width:600px; margin:0 auto; background:white;">
    <div style="background:linear-gradient(135deg, ${PRIMARY} 0%, #0ea5e9 100%); color:white; padding:30px; text-align:center;">
      <div style="font-size:22pt; font-weight:700; margin-bottom:4px;">Agendamento Confirmado</div>
      <div style="font-size:12pt; opacity:0.9;">${escapeHtml(opts.companyName || "Plataforma Saúde do Trabalho")}</div>
    </div>
    <div style="padding:28px;">
      <p style="font-size:16pt; color:${PRIMARY}; margin:0 0 6px;">${headline}!</p>
      <p style="font-size:14px; line-height:1.5; margin:0 0 18px;">${lead}</p>
      <table style="width:100%; border-collapse:collapse; margin:6px 0 14px; background:#f8fafc; border-radius:10px;">
        <tr><td style="padding:10px 14px; font-size:12px; color:#64748b; text-transform:uppercase; letter-spacing:1px;">Data e hora</td><td style="padding:10px 14px; font-size:14px; font-weight:700;">${escapeHtml(dt)}</td></tr>
        <tr><td style="padding:10px 14px; font-size:12px; color:#64748b; text-transform:uppercase; letter-spacing:1px; border-top:1px solid #e2e8f0;">Duração</td><td style="padding:10px 14px; font-size:14px; border-top:1px solid #e2e8f0;">${opts.durationMin} minutos</td></tr>
        <tr><td style="padding:10px 14px; font-size:12px; color:#64748b; text-transform:uppercase; letter-spacing:1px; border-top:1px solid #e2e8f0;">Profissional</td><td style="padding:10px 14px; font-size:14px; border-top:1px solid #e2e8f0;">${escapeHtml(opts.professionalName)}${opts.professionalSpecialty ? ` · ${escapeHtml(opts.professionalSpecialty)}` : ""}</td></tr>
        ${opts.audience !== "collaborator" ? `<tr><td style="padding:10px 14px; font-size:12px; color:#64748b; text-transform:uppercase; letter-spacing:1px; border-top:1px solid #e2e8f0;">Colaborador</td><td style="padding:10px 14px; font-size:14px; border-top:1px solid #e2e8f0;">${escapeHtml(opts.collaboratorName)}</td></tr>` : ""}
        ${opts.notes ? `<tr><td style="padding:10px 14px; font-size:12px; color:#64748b; text-transform:uppercase; letter-spacing:1px; border-top:1px solid #e2e8f0;">Observações</td><td style="padding:10px 14px; font-size:13px; border-top:1px solid #e2e8f0;">${escapeHtml(opts.notes)}</td></tr>` : ""}
      </table>
      ${meetingBox}
      <p style="font-size:12px; color:#64748b; margin:18px 0 0;">
        Acesse a plataforma em <a href="${escapeHtml(opts.base)}" style="color:#0ea5e9;">${escapeHtml(opts.base.replace(/^https?:\/\//, ""))}</a> para visualizar, reagendar ou cancelar.
      </p>
    </div>
    <div style="background:#f8fafc; padding:16px 28px; font-size:11px; color:#94a3b8; text-align:center; border-top:1px solid #e2e8f0;">
      <b>Saúde do Trabalho</b> — Atendimento conduzido com sigilo e ética profissional (LGPD + Código de Ética).
    </div>
  </div>
</body></html>`;
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
