import puppeteer from "puppeteer";
import path from "path";
import fs from "fs/promises";

const UPLOAD_DIR = "/var/www/saudedotrabalho/uploads/pdf";

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

export async function generateLessonPDF(opts: {
  lessonId: number;
  moduleTitle: string;
  lessonTitle: string;
  content: string;
  companyName?: string;
  primaryColor?: string;
}): Promise<string> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const outPath = path.join(UPLOAD_DIR, `lesson_${opts.lessonId}.pdf`);
  const primary = opts.primaryColor || "#1e3a5f";

  const paragraphs = (opts.content || "")
    .split(/\n\n+/)
    .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
    .join("\n");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @page { margin: 25mm 20mm; }
    body { font-family: 'Helvetica', sans-serif; color: #222; line-height: 1.6; font-size: 11pt; }
    .header { border-bottom: 3px solid ${primary}; padding-bottom: 10px; margin-bottom: 20px; }
    .header h1 { color: ${primary}; margin: 0; font-size: 22pt; font-family: Georgia, serif; }
    .header .meta { color: #777; font-size: 10pt; margin-top: 5px; }
    h2 { color: ${primary}; font-size: 16pt; margin-top: 20px; font-family: Georgia, serif; }
    p { margin: 10px 0; text-align: justify; }
    .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; color: #999; font-size: 9pt; border-top: 1px solid #eee; padding-top: 5px; }
  </style></head><body>
    <div class="header">
      <h1>${escapeHtml(opts.lessonTitle)}</h1>
      <div class="meta">${escapeHtml(opts.moduleTitle)}${opts.companyName ? " &middot; " + escapeHtml(opts.companyName) : ""}</div>
    </div>
    <div class="content">${paragraphs}</div>
    <div class="footer">Material gerado pela plataforma Saude do Trabalho</div>
  </body></html>`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    executablePath: "/usr/bin/chromium-browser",
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({ path: outPath, format: "A4", printBackground: true });
  } finally {
    await browser.close();
  }

  return `/uploads/pdf/lesson_${opts.lessonId}.pdf`;
}
