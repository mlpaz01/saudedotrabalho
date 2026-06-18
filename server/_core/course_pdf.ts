// course_pdf.ts — Apostila do curso em PDF (#3 Bruno)
// Consolida módulo (modules) + lições (lessons) + blocos textuais (lesson_blocks)
// num único documento por capítulos.

import { promises as fs } from "fs";
import path from "path";
import { renderPDF } from "./risk_pdf";

const UPLOAD_DIR = "/var/www/saudedotrabalho/uploads/course_handbooks";
const PRIMARY = "#1e3a5f";
const ACCENT = "#2d7a5f";

function esc(s: any): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function blockToHtml(block: any): string {
  let raw = block.content;
  if (typeof raw === "string") {
    try { raw = JSON.parse(raw); } catch { raw = { text: raw }; }
  }
  const data = raw ?? {};
  const type = String(block.block_type || "").toLowerCase();

  // Tipos textuais
  if (type === "concept" || type === "intro" || type === "text" || type === "summary") {
    const title = data.title ? `<h3>${esc(data.title)}</h3>` : "";
    const body = data.body || data.content || data.text || "";
    return `${title}<p>${esc(body).replace(/\n/g, "<br>")}</p>`;
  }
  if (type === "quote" || type === "highlight") {
    return `<blockquote>${esc(data.text || data.body || "")}</blockquote>`;
  }
  if (type === "tip" || type === "warning") {
    const cls = type === "warning" ? "warn" : "tip";
    const ic = type === "warning" ? "⚠" : "💡";
    return `<div class="callout ${cls}"><b>${ic} ${esc(data.title || (type === "warning" ? "Atenção" : "Dica"))}</b><p>${esc(data.body || data.text || "")}</p></div>`;
  }
  if (type === "list" || type === "checklist") {
    const items = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
    return `<ul>${items.map((it: any) => `<li>${esc(typeof it === "string" ? it : (it.text || it.label || ""))}</li>`).join("")}</ul>`;
  }
  if (type === "quiz" || type === "question" || type === "reflection") {
    const q = data.question || data.title || "";
    const opts = Array.isArray(data.options) ? data.options : [];
    const block_q = `<div class="quiz-box"><b>Pergunta para reflexão:</b> ${esc(q)}</div>`;
    const block_opts = opts.length
      ? `<ul>${opts.map((o: any) => `<li>${esc(typeof o === "string" ? o : (o.text || o.label || ""))}</li>`).join("")}</ul>`
      : "";
    return block_q + block_opts;
  }
  if (type === "key_points" || type === "takeaways") {
    const pts = Array.isArray(data.points) ? data.points : (Array.isArray(data.items) ? data.items : []);
    return `<div class="takeaways"><b>Pontos-chave</b><ul>${pts.map((p: any) => `<li>${esc(typeof p === "string" ? p : (p.text || ""))}</li>`).join("")}</ul></div>`;
  }
  if (type === "image") {
    const cap = data.caption ? `<small class="muted">${esc(data.caption)}</small>` : "";
    return data.url ? `<div class="image-block"><img src="${esc(data.url)}" alt="" style="max-width:100%;"/>${cap}</div>` : cap;
  }
  if (type === "video") {
    return `<div class="callout video"><b>🎬 Vídeo:</b> ${esc(data.title || "")}<br><small>${esc(data.url || "(conteúdo em vídeo — disponível na plataforma online)")}</small></div>`;
  }
  // fallback: tenta extrair texto útil
  const fallback = data.title || data.body || data.text || data.description || "";
  return fallback ? `<p>${esc(String(fallback))}</p>` : "";
}

export async function generateCourseHandbookPDF(module: any, lessons: any[]): Promise<string> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const outPath = path.join(UPLOAD_DIR, `apostila_curso_${module.id}.pdf`);
  const now = new Date();

  const css = `
    @page { size: A4; margin: 22mm 18mm 22mm 18mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Inter', 'Helvetica', sans-serif; color: #1f2937; line-height: 1.6; font-size: 11pt; margin: 0; }
    h1, h2, h3 { font-family: 'Playfair Display', Georgia, serif; color: ${PRIMARY}; page-break-after: avoid; }
    h1 { font-size: 26pt; margin: 0 0 6mm; }
    h2 { font-size: 18pt; border-bottom: 2px solid ${ACCENT}; padding-bottom: 4px; margin-top: 14mm; }
    h3 { font-size: 13pt; margin-top: 8mm; }
    p { margin: 6px 0; text-align: justify; orphans: 3; widows: 3; }
    ul, ol { margin: 6px 0 10px 6mm; }
    li { margin: 3px 0; }
    blockquote { border-left: 4px solid ${ACCENT}; background: #f0f7f4; padding: 8px 14px; margin: 10px 0; font-style: italic; color: #1f2937; }
    .cover { text-align: center; padding-top: 50mm; }
    .cover .logo { letter-spacing: 4px; color: ${ACCENT}; font-weight: 700; font-size: 11pt; }
    .cover .title { font-family: 'Playfair Display', Georgia, serif; font-size: 30pt; color: ${PRIMARY}; margin: 18mm 0 8mm; line-height: 1.15; }
    .cover .subtitle { font-size: 13pt; color: #475569; font-style: italic; }
    .cover .meta { margin-top: 35mm; font-size: 11pt; color: #475569; }
    .toc { padding-left: 0; list-style: none; }
    .toc li { padding: 4px 0; border-bottom: 1px dotted #cbd5e1; }
    .toc li b { color: ${PRIMARY}; margin-right: 8px; }
    .callout { border-left: 4px solid #cbd5e1; background: #f8fafc; padding: 8px 12px; margin: 10px 0; page-break-inside: avoid; }
    .callout.tip { border-color: #3b82f6; background: #eff6ff; }
    .callout.warn { border-color: #ea580c; background: #fff7ed; }
    .callout.video { border-color: #7c3aed; background: #f5f3ff; }
    .takeaways { border: 1px solid ${ACCENT}; background: #f0f7f4; padding: 8px 12px; margin: 10px 0; border-radius: 4px; page-break-inside: avoid; }
    .quiz-box { background: #fef3c7; border-left: 4px solid #ca8a04; padding: 8px 12px; margin: 10px 0; page-break-inside: avoid; }
    .image-block { margin: 8px 0; text-align: center; page-break-inside: avoid; }
    .lesson-header { background: ${PRIMARY}; color: #fff; padding: 8px 14px; margin: 14mm 0 6mm; border-radius: 4px; page-break-after: avoid; }
    .lesson-header .num { opacity: .75; font-size: 9pt; letter-spacing: 1px; }
    .lesson-header .ti { font-family: 'Playfair Display', Georgia, serif; font-size: 16pt; }
    .footer-note { margin-top: 20mm; padding-top: 6mm; border-top: 1px solid #e5e7eb; font-size: 8.5pt; color: #64748b; text-align: center; }
    small.muted { color: #64748b; font-size: 8.5pt; }
    .page-break { page-break-after: always; }
  `;

  const totalDuration = lessons.reduce((acc: number, l: any) => acc + Number(l.durationMinutes || l.estimated_minutes || 0), 0);

  const cover = `
    <div class="cover">
      <div class="logo">SAÚDE DO TRABALHO</div>
      <div class="title">${esc(module.title)}</div>
      <div class="subtitle">${esc(module.description || "Apostila de apoio ao curso")}</div>
      <div class="meta">
        <div><b>Apostila do Curso</b></div>
        <div>${lessons.length} aula(s) · ${totalDuration} min estimados</div>
        <div>Emitida em ${now.toLocaleDateString("pt-BR")}</div>
      </div>
    </div>
    <div class="page-break"></div>
  `;

  const toc = `
    <h2>Sumário</h2>
    <ol class="toc">
      ${lessons.map((l, i) => `<li><b>Capítulo ${i + 1}</b> ${esc(l.title)}</li>`).join("")}
    </ol>
    <div class="page-break"></div>
  `;

  // Capítulos = lições
  const chapters = lessons.map((l: any, idx: number) => {
    const blocks = Array.isArray(l._blocks) ? l._blocks : [];
    const bodyHtml = blocks.map((b: any) => blockToHtml(b)).filter(Boolean).join("\n");
    const intro = l.description ? `<p><i>${esc(l.description)}</i></p>` : "";
    const fallback = bodyHtml.trim().length === 0 && l.content
      ? `<p>${esc(l.content).replace(/\n/g, "<br>")}</p>`
      : "";
    const realBody = bodyHtml || fallback || `<p><i>Esta lição é composta apenas por conteúdo interativo (vídeo, jogo ou prática) disponível na plataforma online.</i></p>`;
    return `
      <div class="lesson-header">
        <div class="num">CAPÍTULO ${String(idx + 1).padStart(2, "0")}</div>
        <div class="ti">${esc(l.title)}</div>
      </div>
      ${intro}
      ${realBody}
    `;
  }).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
    <style>${css}</style></head><body>
    ${cover}
    ${toc}
    ${chapters}
    <div class="footer-note">
      Apostila gerada pela plataforma Saúde do Trabalho · ${esc(now.toLocaleDateString("pt-BR"))}<br>
      Este documento é um material de apoio. O acesso completo ao curso, incluindo vídeos, jogos e quizzes, ocorre na plataforma online.
    </div>
    </body></html>`;

  await renderPDF(html, outPath);
  return `/uploads/course_handbooks/apostila_curso_${module.id}.pdf`;
}
