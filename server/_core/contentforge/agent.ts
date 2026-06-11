import { plan } from "./planner";

import { generateLessonBlocks } from "./generator";

import { generateFinalExam } from "./refiner";

import { orPlanCourse, orGenerateLesson, orGenerateExam } from "./openrouter";

import { groqPlanCourse, groqGenerateLesson, groqGenerateExam, isGroqError } from "./groq";

import { Course, GenerateOptions } from "./types";

import * as fs from "fs";

import * as path from "path";



function getGroqKey(): string | null {
  return process.env.GROQ_API_KEY || null;
}

function getOrKey(): string | null {
  return process.env.OPENROUTER_API_KEY || null;
}



function isQuotaError(e: any): boolean {
  const msg = String(e?.message || e);
  return msg.includes("429") || msg.includes("quota") || msg.includes("Too Many Requests") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("daily limit") || msg.includes("rate limited");
}

// Quick preflight: try a tiny Groq call to see if it works; returns false if daily limit
async function groqAvailable(key: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: "hi" }], max_tokens: 1 }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 429) {
      const txt = await res.text().catch(() => "");
      // Daily limit — not just TPM
      if (txt.includes("tokens per day") || txt.includes("TPD")) return false;
    }
    return res.status !== 429;
  } catch { return false; }
}



const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));



function buildCourseHtml(course: Course, genId: string | number): string {

  const now = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  let body = `

    <div class="cover">

      <div class="cover-inner">

        <div class="cover-logo">Saude do Trabalho</div>

        <h1 class="cover-title">${escHtml(course.title)}</h1>

        <p class="cover-date">Gerado em ${now}</p>

      </div>

    </div>

    <div class="page-break"></div>

  `;

  for (const unit of course.units) {

    body += `<div class="unit-heading"><span class="unit-icon">${escHtml(unit.icon ?? "📚")}</span> ${escHtml(unit.title)}</div>`;

    for (const lesson of unit.lessons) {

      body += `<h2 class="lesson-title">${escHtml(lesson.title)}</h2>`;

      for (const block of lesson.blocks) {

        const d: any = (block as any).data ?? {};

        if (block.type === "concept") {

          body += `<div class="concept-block"><div class="concept-title">${escHtml(d.title ?? "")}</div><div class="concept-body">${escHtml(d.body ?? "")}</div></div>`;

        } else if (block.type === "example") {

          body += `<div class="example-callout"><div class="callout-label">Exemplo</div><div class="callout-scenario">${escHtml(d.scenario ?? "")}</div><div class="callout-takeaway"><strong>Aprendizado:</strong> ${escHtml(d.takeaway ?? "")}</div></div>`;

        }

      }

    }

  }

  return `<!DOCTYPE html>

<html lang="pt-BR">

<head>

<meta charset="UTF-8"/>

<style>

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #222; background: #fff; font-size: 13px; line-height: 1.6; }

  .cover { background: #1a5276; color: #fff; min-height: 100vh; display: flex; align-items: center; justify-content: center; text-align: center; padding: 40px; }

  .cover-logo { font-size: 14px; letter-spacing: 3px; text-transform: uppercase; opacity: 0.7; margin-bottom: 32px; }

  .cover-title { font-size: 32px; font-weight: 700; line-height: 1.3; margin-bottom: 24px; }

  .cover-date { font-size: 13px; opacity: 0.6; }

  .page-break { page-break-after: always; }

  .unit-heading { background: #1a5276; color: #fff; padding: 12px 20px; font-size: 16px; font-weight: 700; margin: 32px 0 16px 0; border-radius: 6px; }

  .unit-icon { margin-right: 8px; }

  .lesson-title { font-size: 15px; font-weight: 700; color: #1a5276; border-bottom: 2px solid #1a5276; padding-bottom: 6px; margin: 24px 0 12px 0; }

  .concept-block { background: #f8f9fa; border-left: 4px solid #1a5276; padding: 14px 18px; margin: 12px 0; border-radius: 0 6px 6px 0; }

  .concept-title { font-weight: 700; font-size: 13px; color: #1a5276; margin-bottom: 6px; }

  .concept-body { color: #333; }

  .example-callout { background: #eaf4fb; border: 1px solid #aed6f1; padding: 14px 18px; margin: 12px 0; border-radius: 6px; }

  .callout-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #1a5276; margin-bottom: 6px; letter-spacing: 1px; }

  .callout-scenario { color: #333; margin-bottom: 8px; }

  .callout-takeaway { color: #1a5276; font-size: 12px; }

  @page { margin: 20mm 18mm; @bottom-center { content: counter(page); font-size: 11px; color: #aaa; } }

</style>

</head>

<body>

${body}

</body>

</html>`;

}



function escHtml(s: string): string {

  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

}



async function generatePDF(html: string, outPath: string): Promise<void> {

  const puppeteer = await import("puppeteer");

  const browser = await puppeteer.default.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium-browser", args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });

  try {

    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: "networkidle0" });

    await page.pdf({ path: outPath, format: "A4", printBackground: true, margin: { top: "20mm", bottom: "20mm", left: "18mm", right: "18mm" }, displayHeaderFooter: true, footerTemplate: '<div style="font-size:10px;color:#aaa;text-align:center;width:100%;padding-right:18mm;">Pagina <span class="pageNumber"></span> de <span class="totalPages"></span></div>', headerTemplate: '<span></span>' });

  } finally { await browser.close(); }

}



export async function generate(opts: GenerateOptions & { genId?: string | number }): Promise<Course & { pdfPath?: string }> {

  const log = async (p: number, m: string) => opts.onProgress?.(p, m);

  // ── PLAN ─────────────────────────────────────────────────────────────────

  await log(5, "Planejando estrutura do curso...");


  let outline: any;

  // Provider order: OpenRouter (free) first, Groq (100k/day), Gemini (20/day) last
  const orKey = getOrKey();
  const groqKey = getGroqKey();

  // 1. OpenRouter
  if (orKey) {
    try {
      outline = await orPlanCourse(opts.topic, opts.duration || 60, opts.difficulty || "intermediario", orKey);
      (outline as any)._useOpenRouter = true;
      console.log("[ContentForge] plan: using OpenRouter");
    } catch (orErr) {
      console.error("[ContentForge] OpenRouter plan failed, trying Groq...", String(orErr).slice(0, 120));
      outline = null;
    }
  }

  // 2. Groq
  if (!outline && groqKey) {
    try {
      outline = await groqPlanCourse(opts.topic, opts.duration || 60, opts.difficulty || "intermediario", groqKey);
      (outline as any)._useGroq = true;
      console.log("[ContentForge] plan: using Groq");
    } catch (groqErr) {
      console.error("[ContentForge] Groq plan failed, trying Gemini...", String(groqErr).slice(0, 120));
      outline = null;
    }
  }

  // 3. Gemini
  if (!outline) {
    try {
      outline = await plan(opts);
      console.log("[ContentForge] plan: using Gemini");
    } catch (geminiErr) {
      console.error("[ContentForge] Gemini plan failed:", String(geminiErr).slice(0, 120));
      outline = null;
    }
  }

  if (!outline) throw new Error("Todos os provedores de IA falharam ao planejar o curso. Tente novamente.");

  await log(10, "Estrutura criada! Gerando conteudo das aulas...");
  // Store partial outline immediately so UI can show structure preview
  if (opts.genId) {
    try {
      const { getDb, _rawSql } = await import("../../db");
      const dbi = await getDb();
      if (dbi) await dbi.execute(_rawSql`UPDATE ai_course_generations SET generated_outline=${JSON.stringify({ title: outline.title, description: outline.description, units: outline.units })} WHERE id=${opts.genId}`);
    } catch (_) {}
  }

  // -- LESSONS --
  const course: Course = {
    title: outline.title,
    description: outline.description ?? "",
    units: [],
  };

  const allLessonTitles: string[] = [];
  for (const unit of (outline.units ?? [])) {
    for (const lt of (unit.lessonTitles ?? [])) allLessonTitles.push(lt);
  }
  const totalLessons = allLessonTitles.length || 1;
  let lessonsDone = 0;
  const previousTitles: string[] = [];

  for (const unit of (outline.units ?? [])) {
    const courseUnit: Course["units"][0] = {
      title: unit.title,
      icon: unit.icon ?? "book",
      lessons: [],
    };

    for (const lessonTitle of (unit.lessonTitles ?? [])) {
      lessonsDone++;
      const lessonPct = 10 + Math.round((lessonsDone / totalLessons) * 60);
      await log(lessonPct, `Criando aula ${lessonsDone}/${totalLessons}: "${lessonTitle}"`);

      let blocks: any[] = [];

      // 1. OpenRouter
      if (orKey) {
        try {
          blocks = await orGenerateLesson(outline.title, lessonTitle, [...previousTitles], orKey);
          console.log(`[ContentForge] lesson ${lessonsDone}: OpenRouter OK`);
        } catch (orErr) {
          console.error(`[ContentForge] OpenRouter lesson failed: ${lessonTitle}`, String(orErr).slice(0, 120));
          blocks = [];
        }
      }

      // 2. Groq
      if (!blocks.length && groqKey) {
        try {
          blocks = await groqGenerateLesson(outline.title, lessonTitle, [...previousTitles], groqKey);
          console.log(`[ContentForge] lesson ${lessonsDone}: Groq OK`);
        } catch (groqErr) {
          console.error(`[ContentForge] Groq lesson failed: ${lessonTitle}`, String(groqErr).slice(0, 150));
          blocks = [];
        }
      }

      // 3. Gemini
      if (!blocks.length) {
        try {
          const result = await generateLessonBlocks(opts, {
            courseTitle: outline.title,
            unitTitle: unit.title,
            lessonTitle,
            lessonIndex: lessonsDone - 1,
            previousTitles: [...previousTitles],
          });
          blocks = result ?? [];
          if (blocks.length) console.log(`[ContentForge] lesson ${lessonsDone}: Gemini OK`);
        } catch (geminiErr) {
          console.error(`[ContentForge] Gemini lesson failed: ${lessonTitle}`, String(geminiErr).slice(0, 100));
          blocks = [];
        }
      }

      if (!blocks.length) {
        console.error(`[ContentForge] all providers failed for lesson: ${lessonTitle}`);
      }

      courseUnit.lessons.push({ title: lessonTitle, blocks });
      previousTitles.push(lessonTitle);
    }

    course.units.push(courseUnit);
  }

  // -- EXAM --
  await log(72, "Gerando avaliacao final...");
  let examQuestions: any[] = [];

  if (orKey) {
    try {
      examQuestions = await orGenerateExam(outline.title, previousTitles, orKey);
      console.log("[ContentForge] exam: OpenRouter OK");
    } catch (orErr) { console.error("[ContentForge] OpenRouter exam failed:", String(orErr).slice(0, 100)); }
  }

  if (!examQuestions.length && groqKey) {
    try {
      examQuestions = await groqGenerateExam(outline.title, previousTitles.map(t => ({ title: t, blocks: [] })), groqKey);
      console.log("[ContentForge] exam: Groq OK");
    } catch (groqErr) { console.error("[ContentForge] Groq exam failed:", groqErr); }
  }

  if (!examQuestions.length) {
    try {
      examQuestions = await generateFinalExam(opts, outline.title, previousTitles.map(t => ({ title: t, blocks: [] })));
      if (examQuestions?.length) console.log("[ContentForge] exam: Gemini OK");
    } catch (e) { console.error("[ContentForge] final exam skipped:", e); }
  }

  (course as any).finalExam = examQuestions ?? [];

  // -- PDF --
  await log(82, "Gerando PDF do curso...");
  let pdfPath: string | undefined;
  try {
    const html = buildCourseHtml(course, opts.genId ?? "");
    const pdfDir = path.join(process.cwd(), "public", "pdfs");
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
    const pdfFile = path.join(pdfDir, `course-${opts.genId ?? Date.now()}.pdf`);
    await generatePDF(html, pdfFile);
    pdfPath = `/pdfs/course-${opts.genId ?? Date.now()}.pdf`;
    console.log("[ContentForge] PDF generated:", pdfPath);
  } catch (pdfErr) {
    console.error("[ContentForge] PDF generation failed (non-fatal):", String(pdfErr).slice(0, 150));
  }

  await log(100, "Curso completo!");
  return { ...course, pdfPath };
}

export const ContentForge = { generate };
