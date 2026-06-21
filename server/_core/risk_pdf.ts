/**
 * Risk Assessment PDF generation — Phase 5
 * Generates LAUDO TÉCNICO, INVENTÁRIO+MATRIZ, CRONOGRAMA per assessment.
 */
import puppeteer from "puppeteer";
import path from "path";
import fs from "fs/promises";

const UPLOAD_DIR = "/var/www/saudedotrabalho/uploads/risk_pdfs";

function esc(s: unknown): string {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function classToColor(level: string): string {
  switch ((level || "").toLowerCase()) {
    case "critico":
    case "critica": return "#b91c1c";
    case "alto":
    case "alta": return "#ea580c";
    case "medio":
    case "media": return "#ca8a04";
    case "baixo":
    case "baixa": return "#16a34a";
    default: return "#94a3b8";
  }
}

function classToLabel(level: string): string {
  const m: Record<string, string> = {
    critico: "Crítico", critica: "Crítica",
    alto: "Alto", alta: "Alta",
    medio: "Médio", media: "Média",
    baixo: "Baixo", baixa: "Baixa",
  };
  return m[(level || "").toLowerCase()] || level || "—";
}

const PRIMARY = "#1e3a5f";
const ACCENT = "#0ea5e9";

const BASE_CSS = `
  @page { size: A4; margin: 22mm 18mm 22mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Inter', 'Helvetica', sans-serif; color: #1f2937; line-height: 1.55; font-size: 10.5pt; margin: 0; }
  h1,h2,h3,h4 { font-family: 'Playfair Display', Georgia, serif; color: ${PRIMARY}; margin-top: 0; }
  h1 { font-size: 22pt; margin-bottom: 6mm; }
  h2 { font-size: 16pt; border-bottom: 2px solid ${ACCENT}; padding-bottom: 4px; margin-top: 12mm; }
  h3 { font-size: 12pt; margin-top: 8mm; color: ${PRIMARY}; }
  p { margin: 6px 0; text-align: justify; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; font-size: 9.5pt; }
  th { background: ${PRIMARY}; color: #fff; padding: 6px 8px; text-align: left; font-weight: 600; font-size: 9pt; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 8.5pt; font-weight: 600; color: #fff; }
  .cover { display: flex; flex-direction: column; justify-content: center; align-items: center; height: 240mm; text-align: center; }
  .cover .logo { font-size: 14pt; color: ${ACCENT}; letter-spacing: 3px; margin-bottom: 30mm; font-weight: 700; }
  .cover .title { font-family: 'Playfair Display', Georgia, serif; font-size: 32pt; color: ${PRIMARY}; line-height: 1.2; margin-bottom: 14mm; }
  .cover .subtitle { font-size: 14pt; color: #475569; font-style: italic; margin-bottom: 30mm; }
  .cover .meta { font-size: 12pt; color: #1f2937; }
  .cover .meta div { margin: 3px 0; }
  .toc { padding-left: 0; list-style: none; }
  .toc li { padding: 4px 0; border-bottom: 1px dotted #cbd5e1; }
  .toc li b { color: ${PRIMARY}; margin-right: 8px; }
  .section { page-break-inside: avoid; }
  .page-break { page-break-after: always; }
  .signature { margin-top: 30mm; }
  .signature .line { border-bottom: 1px solid #1f2937; width: 70mm; margin: 30mm auto 4mm; }
  .matrix-cell { width: 22mm; text-align: center; padding: 8px 2px; font-weight: 600; color: #fff; font-size: 9pt; }
  .month-dot { display: inline-block; width: 14px; height: 14px; border-radius: 50%; background: #16a34a; }
  .month-empty { display: inline-block; width: 14px; height: 14px; border-radius: 50%; background: #e5e7eb; }
  small.muted { color: #64748b; font-size: 8.5pt; }
  .header-strip { background: ${PRIMARY}; color: #fff; padding: 10px 14px; margin-bottom: 10mm; border-radius: 4px; }
  .header-strip .name { font-size: 11pt; font-weight: 700; }
  .header-strip .meta { font-size: 9pt; opacity: 0.9; }
  .footer-note { margin-top: 14mm; font-size: 8.5pt; color: #64748b; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 6px; }
`;

async function renderPDF(html: string, outPath: string): Promise<void> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    executablePath: "/usr/bin/chromium-browser",
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({ path: outPath, format: "A4", printBackground: true, displayHeaderFooter: false });
  } finally {
    await browser.close();
  }
}

export type AssessmentData = {
  id: number;
  cycleName: string;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  responsibleTechnician?: string | null;
  notes?: string | null;
  companyName: string;
  companyCnpj?: string | null;
  branchName?: string | null;
  sectorName?: string | null;
  drpsResponses: number;
  aepResponses: number;
};

export type InventoryRow = {
  factorCode: string;
  factorName: string;
  description?: string | null;
  gravidade: string;
  probabilidade: string;
  riscoFinal: string;
  fontesGeradoras?: string | null;
  medidasExistentes?: string | null;
  drpsScoreAvg?: number | null;
  drpsResponsesCount?: number;
};

export type ActionPlanRow = {
  factorCode: string;
  factorName: string;
  actionDescription: string;
  responsibleParty?: string | null;
  priority: string;
  status: string;
  monthlyProgress?: Record<string, boolean> | null;
  startDate?: string | null;
  endDate?: string | null;
};

export type SectorGroup = {
  sectorId: number;
  sectorName: string;
  assessment: AssessmentData;
  inventory: InventoryRow[];
  actions: ActionPlanRow[];
};

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  try {
    const x = new Date(d);
    return x.toLocaleDateString("pt-BR");
  } catch { return String(d); }
}

function monthLabel(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[(m - 1) % 12]}/${String(y).slice(2)}`;
}

function next12Months(startIso?: string | null): string[] {
  const now = startIso ? new Date(startIso) : new Date();
  const out: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const m = String(d.getMonth() + 1).padStart(2, "0");
    out.push(`${d.getFullYear()}-${m}`);
  }
  return out;
}

// ── 1. LAUDO TÉCNICO (19 seções — NR-01 + ISO 45003) ─────────────────────────
export async function generateRiskLaudoPDF(
  a: AssessmentData,
  inventory: InventoryRow[],
  actions: ActionPlanRow[],
  sectorGroups?: SectorGroup[]
): Promise<string> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const outPath = path.join(UPLOAD_DIR, `laudo_${a.id}.pdf`);
  const now = new Date();
  const mesAno = `${now.toLocaleDateString("pt-BR", { month: "long" })} / ${now.getFullYear()}`;

  // ── Dynamic analysis helpers
  const criticalFactors = inventory.filter(it => ["critico","critica"].includes((it.riscoFinal||"").toLowerCase()));
  const highFactors     = inventory.filter(it => ["alto","alta"].includes((it.riscoFinal||"").toLowerCase()));
  const mediumFactors   = inventory.filter(it => ["medio","media"].includes((it.riscoFinal||"").toLowerCase()));
  const lowFactors      = inventory.filter(it => ["baixo","baixa"].includes((it.riscoFinal||"").toLowerCase()));
  const protectiveFactors = lowFactors.slice(0, 5);

  const allFontes = inventory
    .filter(it => it.fontesGeradoras && String(it.fontesGeradoras).trim())
    .flatMap(it => String(it.fontesGeradoras).split(/[;,\n]/).map((f:string) => f.trim()).filter(Boolean))
    .slice(0, 8);

  const allMedidas = inventory
    .filter(it => it.medidasExistentes && String(it.medidasExistentes).trim())
    .flatMap(it => String(it.medidasExistentes).split(/[;,\n]/).map((m:string) => m.trim()).filter(Boolean))
    .slice(0, 6);

  const matrixRows = inventory.map((it) => `
    <tr>
      <td>${esc(it.factorName)}</td>
      <td>${esc(it.description || "—")}</td>
      <td class="matrix-cell" style="background:${classToColor(it.gravidade)}">${classToLabel(it.gravidade)}</td>
      <td class="matrix-cell" style="background:${classToColor(it.probabilidade)}">${classToLabel(it.probabilidade)}</td>
      <td class="matrix-cell" style="background:${classToColor(it.riscoFinal)}">${classToLabel(it.riscoFinal)}</td>
      <td style="text-align:center">${it.drpsScoreAvg != null ? Number(it.drpsScoreAvg).toFixed(2) : "—"}</td>
    </tr>`).join("");

  const actionRows = actions.map((ac) => `
    <tr>
      <td>${esc(ac.factorName)}</td>
      <td>${esc(ac.actionDescription)}</td>
      <td>${esc(ac.responsibleParty || "Consultoria Saúde do Trabalho")}</td>
      <td><span class="badge" style="background:${classToColor(ac.priority)}">${classToLabel(ac.priority)}</span></td>
      <td>${esc(fmtDate(ac.startDate))} → ${esc(fmtDate(ac.endDate))}</td>
    </tr>`).join("");

  // Dynamic synthesis narrative
  let synthesisParagraph = "";
  if (criticalFactors.length > 0) {
    synthesisParagraph += `<p>A avaliação identificou <b>${criticalFactors.length} fator(es) com classificação CRÍTICA</b>, exigindo intervenção imediata: ${criticalFactors.map(f => `<b>${esc(f.factorName)}</b>`).join(", ")}. Estes fatores indicam exposição sistêmica que pode comprometer a saúde psicológica dos trabalhadores e gerar passivos trabalhistas.</p>`;
  }
  if (highFactors.length > 0) {
    synthesisParagraph += `<p>Adicionalmente, <b>${highFactors.length} fator(es) com risco ALTO</b> demandam ação preventiva estruturada: ${highFactors.map(f => `<b>${esc(f.factorName)}</b>`).join(", ")}.</p>`;
  }
  if (mediumFactors.length > 0) {
    synthesisParagraph += `<p>${mediumFactors.length} fator(es) apresentam risco MÉDIO (${mediumFactors.map(f => `<b>${esc(f.factorName)}</b>`).join(", ")}), requerendo monitoramento e ações de melhoria contínua.</p>`;
  }
  if (protectiveFactors.length > 0) {
    synthesisParagraph += `<p>Como <b>fatores protetivos organizacionais</b>, destacam-se: ${protectiveFactors.map(f => `<b>${esc(f.factorName)}</b>`).join(", ")}. Estes elementos devem ser preservados e fortalecidos.</p>`;
  }
  if (!synthesisParagraph) {
    synthesisParagraph = "<p>O inventário de riscos não apresentou fatores classificados como alto ou crítico neste ciclo avaliativo.</p>";
  }

  const sectorScope = a.sectorName
    ? `setor <b>${esc(a.sectorName)}</b>${a.branchName ? `, filial <b>${esc(a.branchName)}</b>` : ""}`
    : a.branchName ? `filial <b>${esc(a.branchName)}</b>` : "todos os setores avaliados";

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
  <style>${BASE_CSS}
    .info-box{background:#f0f9ff;border-left:4px solid #0ea5e9;padding:8px 12px;margin:8px 0;border-radius:0 6px 6px 0;font-size:9.5pt;}
    .legal-box{background:#fef3c7;border-left:4px solid #d97706;padding:8px 12px;margin:8px 0;border-radius:0 6px 6px 0;font-size:9pt;font-style:italic;}
    .step-flow{display:flex;flex-wrap:wrap;gap:4px;margin:8px 0;}
    .step{background:#1e3a5f;color:#fff;padding:4px 10px;border-radius:12px;font-size:8.5pt;}
    .arrow{color:#1e3a5f;font-size:14pt;line-height:1;padding:0 2px;}
  </style>
  </head><body>

  <div class="cover">
    <div class="logo">SAÚDE DO TRABALHO • CONSULTORIA</div>
    <div class="title">Laudo Técnico de Avaliação de Riscos Psicossociais</div>
    <div class="subtitle">Metodologia Integrada DRPS + AEP · NR-01 (Portaria MTP 1.419/2024) · ISO 45003:2021</div>
    <div class="meta">
      <div><b>Empresa:</b> ${esc(a.companyName)}</div>
      ${a.companyCnpj ? `<div><b>CNPJ:</b> ${esc(a.companyCnpj)}</div>` : ""}
      ${a.branchName ? `<div><b>Filial:</b> ${esc(a.branchName)}</div>` : ""}
      ${a.sectorName ? `<div><b>Setor:</b> ${esc(a.sectorName)}</div>` : ""}
      <div><b>Ciclo:</b> ${esc(a.cycleName)}</div>
      <div><b>Período:</b> ${esc(fmtDate(a.startDate))} a ${esc(fmtDate(a.endDate))}</div>
      <div><b>Emissão:</b> ${esc(mesAno)}</div>
    </div>
  </div>
  <div class="page-break"></div>

  <h2>Sumário</h2>
  <ol class="toc">
    <li><b>1.</b> Introdução Técnica</li>
    <li><b>2.</b> Objetivo</li>
    <li><b>3.</b> Fundamentação Normativa</li>
    <li><b>4.</b> Metodologia Integrada DRPS + AEP</li>
    <li><b>5.</b> Critérios Técnicos de Avaliação</li>
    <li><b>6.</b> Fluxo Metodológico</li>
    <li><b>7.</b> Caracterização dos Setores Avaliados</li>
    <li><b>8.</b> Principais Fatores Psicossociais Identificados</li>
    <li><b>9.</b> Principais Fontes Geradoras</li>
    <li><b>10.</b> Principais Medidas Preventivas Existentes</li>
    <li><b>11.</b> Indicadores Organizacionais</li>
    <li><b>12.</b> Síntese Técnica Integrada</li>
    <li><b>13.</b> Matriz de Risco Psicossocial</li>
    <li><b>14.</b> Plano de Ação Preventivo</li>
    <li><b>15.</b> Monitoramento e Reavaliação</li>
    <li><b>16.</b> Conclusão Técnica</li>
    <li><b>17.</b> Responsabilidade Técnica</li>
    <li><b>18.</b> Encerramento</li>
    <li><b>19.</b> Referências Bibliográficas</li>
  </ol>
  <div class="page-break"></div>

  <h2>1. Introdução Técnica</h2>
  <p>O presente Laudo Técnico apresenta os resultados da avaliação de riscos psicossociais conduzida em
  <b>${esc(a.companyName)}</b>, ${sectorScope}, referente ao ciclo avaliativo <b>${esc(a.cycleName)}</b>.</p>
  <div class="legal-box">A presente análise possui caráter organizacional e preventivo, não se caracterizando
  como avaliação clínica individual.</div>

  <h2>2. Objetivo</h2>
  <p>Identificar, classificar e propor medidas preventivas para os fatores de risco psicossocial preconizados
  pela literatura técnica internacional (Karasek, Siegrist, ISO 45003), promovendo a saúde mental e bem-estar
  dos trabalhadores e fortalecendo a conformidade legal da organização com as exigências da NR-01.</p>
  <p>O objetivo da plataforma não é apenas gerar documentos, mas manter processo contínuo de monitoramento,
  implementação, rastreabilidade e gestão preventiva dos riscos ocupacionais e psicossociais.</p>

  <h2>3. Fundamentação Normativa</h2>
  <p>• NR-01 e Anexo III — Fatores de riscos psicossociais (Portaria MTP nº 1.419/2024);</p>
  <p>• ISO 45003:2021 — Psychological health and safety at work;</p>
  <p>• CLT — responsabilidade do empregador pela saúde do trabalhador;</p>
  <p>• Resolução CFP nº 010/2000 — Avaliação psicológica organizacional;</p>
  <p>• Política Nacional de Saúde Mental do Trabalhador (Portaria MS nº 3.120/1998).</p>

  <h2>4. Metodologia Integrada DRPS + AEP</h2>
  <div class="info-box">A avaliação quantitativa foi realizada por meio do DRPS — Diagnóstico de Riscos
  Psicossociais, instrumento técnico de rastreamento organizacional coletivo, aplicado em formato digital e
  anônimo aos trabalhadores.</div>
  <p>O DRPS foi estruturado em escala do tipo Likert, com classificação de respostas variando de 0 a 4,
  permitindo mensuração padronizada da percepção de exposição aos fatores psicossociais. Foram coletadas
  <b>${a.drpsResponses} resposta(s)</b> ao instrumento DRPS neste ciclo.</p>
  <div class="info-box">De forma complementar, foi aplicada a AEP — Análise Ergonômica Preliminar Qualitativa,
  também em formato digital, respondida pelas lideranças ou representantes designados de cada setor avaliado.
  A AEP qualitativa foi estruturada para aprofundamento organizacional dos fatores identificados no DRPS.</div>
  <p>Foram coletadas <b>${a.aepResponses} resposta(s)</b> ao instrumento AEP.</p>

  <h2>5. Critérios Técnicos de Avaliação</h2>
  <table>
    <tr><th>Nível de risco</th><th>Score DRPS médio</th><th>Ação recomendada</th></tr>
    <tr><td class="matrix-cell" style="background:#16a34a">Baixo</td><td>0,0 a 1,0</td><td>Monitoramento anual</td></tr>
    <tr><td class="matrix-cell" style="background:#ca8a04">Médio</td><td>1,1 a 2,0</td><td>Monitoramento semestral + plano de melhoria</td></tr>
    <tr><td class="matrix-cell" style="background:#ea580c">Alto</td><td>2,1 a 3,0</td><td>Intervenção preventiva estruturada</td></tr>
    <tr><td class="matrix-cell" style="background:#b91c1c">Crítico</td><td>3,1 a 4,0</td><td>Intervenção imediata + vencimento curto</td></tr>
  </table>

  <h2>6. Fluxo Metodológico</h2>
  <div class="info-box">A metodologia aplicada permite rastreabilidade técnica do processo de avaliação,
  mantendo integração entre: identificação dos perigos psicossociais; análise quantitativa; análise qualitativa;
  definição da probabilidade; classificação dos riscos; inventário; matriz de risco; plano de ação preventivo;
  monitoramento contínuo das medidas implementadas.</div>
  <div class="step-flow">
    <span class="step">DRPS</span><span class="arrow">→</span>
    <span class="step">AEP</span><span class="arrow">→</span>
    <span class="step">Inventário</span><span class="arrow">→</span>
    <span class="step">Matriz de Risco</span><span class="arrow">→</span>
    <span class="step">Plano de Ação</span><span class="arrow">→</span>
    <span class="step">Vencimentos</span><span class="arrow">→</span>
    <span class="step">Alertas</span><span class="arrow">→</span>
    <span class="step">Dashboard</span><span class="arrow">→</span>
    <span class="step">Rastreabilidade</span>
  </div>

  <h2>7. Caracterização dos Setores Avaliados</h2>
  ${sectorGroups && sectorGroups.length > 0 ? `
  <p>Esta avaliação consolidada abrange <b>${sectorGroups.length} setor(es)</b>. Abaixo a caracterização individual de cada setor avaliado.</p>
  ${sectorGroups.map((sg, idx) => `
  <h3 style="margin-top:12px;font-size:11pt;color:#1e3a5f;">${idx+1}. Setor: ${esc(sg.sectorName)}</h3>
  <table>
    <tr><th style="width:35%">Item</th><th>Descrição</th></tr>
    <tr><td>Empresa</td><td>${esc(a.companyName)}</td></tr>
    ${a.companyCnpj ? `<tr><td>CNPJ</td><td>${esc(a.companyCnpj)}</td></tr>` : ""}
    ${a.branchName ? `<tr><td>Filial</td><td>${esc(a.branchName)}</td></tr>` : ""}
    <tr><td>Setor avaliado</td><td>${esc(sg.sectorName)}</td></tr>
    <tr><td>Ciclo avaliativo</td><td>${esc(a.cycleName)}</td></tr>
    <tr><td>Período</td><td>${esc(fmtDate(sg.assessment.startDate || a.startDate))} a ${esc(fmtDate(sg.assessment.endDate || a.endDate))}</td></tr>
    <tr><td>Respostas DRPS</td><td>${sg.assessment.drpsResponses}</td></tr>
    <tr><td>Respostas AEP</td><td>${sg.assessment.aepResponses}</td></tr>
    <tr><td>Responsável técnico</td><td>${esc(a.responsibleTechnician || "Marise Paiva — CRP 55-33301")}</td></tr>
  </table>`).join("")}
  ` : `
  <table>
    <tr><th style="width:35%">Item</th><th>Descrição</th></tr>
    <tr><td>Empresa</td><td>${esc(a.companyName)}</td></tr>
    ${a.companyCnpj ? `<tr><td>CNPJ</td><td>${esc(a.companyCnpj)}</td></tr>` : ""}
    ${a.branchName ? `<tr><td>Filial</td><td>${esc(a.branchName)}</td></tr>` : ""}
    ${a.sectorName ? `<tr><td>Setor avaliado</td><td>${esc(a.sectorName)}</td></tr>` : `<tr><td>Escopo</td><td>Todos os setores</td></tr>`}
    <tr><td>Ciclo avaliativo</td><td>${esc(a.cycleName)}</td></tr>
    <tr><td>Período</td><td>${esc(fmtDate(a.startDate))} a ${esc(fmtDate(a.endDate))}</td></tr>
    <tr><td>Respostas DRPS</td><td>${a.drpsResponses}</td></tr>
    <tr><td>Respostas AEP</td><td>${a.aepResponses}</td></tr>
    <tr><td>Responsável técnico</td><td>${esc(a.responsibleTechnician || "Marise Paiva — CRP 55-33301")}</td></tr>
  </table>`}

  <h2>8. Principais Fatores Psicossociais Identificados</h2>
  ${sectorGroups && sectorGroups.length > 0 ? sectorGroups.map((sg, idx) => {
    const sgRows = sg.inventory.map((it) => `
      <tr>
        <td>${esc(it.factorName)}</td>
        <td>${esc(it.description || "—")}</td>
        <td class="matrix-cell" style="background:${classToColor(it.gravidade)}">${classToLabel(it.gravidade)}</td>
        <td class="matrix-cell" style="background:${classToColor(it.probabilidade)}">${classToLabel(it.probabilidade)}</td>
        <td class="matrix-cell" style="background:${classToColor(it.riscoFinal)}">${classToLabel(it.riscoFinal)}</td>
        <td style="text-align:center">${it.drpsScoreAvg != null ? Number(it.drpsScoreAvg).toFixed(2) : "—"}</td>
      </tr>`).join("");
    return `<h3 style="margin-top:12px;font-size:11pt;color:#1e3a5f;">${idx+1}. Setor: ${esc(sg.sectorName)}</h3>
    <table>
      <tr><th>Fator de Risco Psicossocial</th><th>Descrição / Eixo avaliado</th><th>Grav.</th><th>Prob.</th><th>Risco Final</th><th>DRPS</th></tr>
      ${sgRows || "<tr><td colspan='6' style='text-align:center;color:#888'>Nenhum fator registrado para este setor.</td></tr>"}
    </table>`;
  }).join("") : `
  <table>
    <tr><th>Fator de Risco Psicossocial</th><th>Descrição / Eixo avaliado</th><th>Grav.</th><th>Prob.</th><th>Risco Final</th><th>DRPS</th></tr>
    ${matrixRows}
  </table>`}

  <h2>9. Principais Fontes Geradoras</h2>
  ${allFontes.length > 0
    ? `<ul>${allFontes.map(f => `<li>${esc(f)}</li>`).join("")}</ul>`
    : `<p>Com base na análise integrada DRPS + AEP, as principais fontes geradoras identificadas neste ciclo avaliativo estão relacionadas às condições organizacionais do trabalho, incluindo: (a) organização e divisão do trabalho; (b) estilo de gestão e liderança; (c) comunicação organizacional; (d) condições e ambiente de trabalho; (e) relações socioprofissionais. O detalhamento por fator de risco consta na seção 8 e no Inventário de Riscos Psicossociais vinculado a este ciclo.</p>`
  }
  <p>Os dados obtidos subsidiam tecnicamente a elaboração do inventário de riscos psicossociais, da matriz de
  risco e do plano de ação preventivo integrado ao Programa de Gerenciamento de Riscos (PGR), conforme
  exigido pela NR-01 (Portaria MTP nº 1.419/2024) e pela ISO 45003:2021.</p>

  <h2>10. Principais Medidas Preventivas Existentes</h2>
  ${allMedidas.length > 0
    ? `<ul>${allMedidas.map(m => `<li>${esc(m)}</li>`).join("")}</ul>`
    : `<p>As medidas preventivas institucionais identificadas neste ciclo incluem: (a) canais de comunicação internos disponíveis; (b) políticas de saúde e segurança do trabalho; (c) programas de qualidade de vida e bem-estar (quando existentes); (d) estrutura de suporte psicológico e/ou assistencial; (e) práticas de gestão participativa. As medidas corretivas e preventivas adicionais a serem implementadas constam no Plano de Ação Preventivo (seção 14).</p>`
  }

  <h2>11. Indicadores Organizacionais</h2>
  <table>
    <tr><th>Indicador</th><th>Situação</th></tr>
    <tr><td>Fatores críticos identificados</td><td><b>${criticalFactors.length}</b></td></tr>
    <tr><td>Fatores com risco alto</td><td><b>${highFactors.length}</b></td></tr>
    <tr><td>Fatores com risco médio</td><td><b>${mediumFactors.length}</b></td></tr>
    <tr><td>Fatores com risco baixo (protetivos)</td><td><b>${lowFactors.length}</b></td></tr>
    <tr><td>Total respondentes DRPS</td><td><b>${a.drpsResponses}</b></td></tr>
    <tr><td>Total respondentes AEP</td><td><b>${a.aepResponses}</b></td></tr>
    <tr><td>Ações preventivas planejadas</td><td><b>${actions.length}</b></td></tr>
  </table>

  <h2>12. Síntese Técnica Integrada</h2>
  ${synthesisParagraph}
  <p>A análise integrada DRPS + AEP permite não apenas identificar os fatores de maior impacto, mas também
  contextualizar as fontes geradoras e as condições organizacionais que os potencializam, fortalecendo a
  efetividade das medidas preventivas propostas.</p>

  <h2>13. Matriz de Risco Psicossocial</h2>
  <p>A classificação final dos riscos psicossociais foi realizada por meio do cruzamento entre gravidade e
  probabilidade, utilizando matriz de risco compatível com os princípios da NR-01 e do Gerenciamento de
  Riscos Ocupacionais.</p>
  <table>
    <tr><th>Prob. ↓ / Grav. →</th><th>Baixa</th><th>Média</th><th>Alta</th><th>Crítica</th></tr>
    <tr><td><b>Baixa</b></td><td class="matrix-cell" style="background:#16a34a">Baixo</td><td class="matrix-cell" style="background:#16a34a">Baixo</td><td class="matrix-cell" style="background:#ca8a04">Médio</td><td class="matrix-cell" style="background:#ea580c">Alto</td></tr>
    <tr><td><b>Média</b></td><td class="matrix-cell" style="background:#16a34a">Baixo</td><td class="matrix-cell" style="background:#ca8a04">Médio</td><td class="matrix-cell" style="background:#ea580c">Alto</td><td class="matrix-cell" style="background:#b91c1c">Crítico</td></tr>
    <tr><td><b>Alta</b></td><td class="matrix-cell" style="background:#ca8a04">Médio</td><td class="matrix-cell" style="background:#ea580c">Alto</td><td class="matrix-cell" style="background:#b91c1c">Crítico</td><td class="matrix-cell" style="background:#b91c1c">Crítico</td></tr>
    <tr><td><b>Crítica</b></td><td class="matrix-cell" style="background:#ea580c">Alto</td><td class="matrix-cell" style="background:#b91c1c">Crítico</td><td class="matrix-cell" style="background:#b91c1c">Crítico</td><td class="matrix-cell" style="background:#b91c1c">Crítico</td></tr>
  </table>

  <h2>14. Plano de Ação Preventivo</h2>
  ${sectorGroups && sectorGroups.length > 0 ? `
  <p>O plano de ação preventivo está organizado por setor avaliado, em conformidade com as exigências da NR-01.</p>
  ${sectorGroups.map((sg, idx) => {
    const sgActRows = sg.actions.map((ac) => `
      <tr>
        <td>${esc(ac.factorName)}</td>
        <td>${esc(ac.actionDescription)}</td>
        <td>${esc(ac.responsibleParty || "Consultoria Saúde do Trabalho")}</td>
        <td><span class="badge" style="background:${classToColor(ac.priority)}">${classToLabel(ac.priority)}</span></td>
        <td>${esc(fmtDate(ac.startDate))} → ${esc(fmtDate(ac.endDate))}</td>
      </tr>`).join("");
    return `<h3 style="margin-top:12px;font-size:11pt;color:#1e3a5f;">${idx+1}. Setor: ${esc(sg.sectorName)}</h3>
    ${sgActRows ? `<table>
      <tr><th>Fator</th><th>Ação preventiva</th><th>Responsável</th><th>Prioridade</th><th>Período</th></tr>
      ${sgActRows}
    </table>` : "<p><i>Nenhuma ação definida para este setor.</i></p>"}`;
  }).join("")}
  ` : `${actionRows ? `
  <p>Os dados obtidos subsidiam tecnicamente a elaboração do inventário de riscos psicossociais, da matriz de
  risco e do plano de ação preventivo integrado ao Programa de Gerenciamento de Riscos (PGR).</p>
  <table>
    <tr><th>Fator</th><th>Ação preventiva</th><th>Responsável</th><th>Prioridade</th><th>Período</th></tr>
    ${actionRows}
  </table>` : "<p><i>Plano de ação a ser definido após análise dos resultados pela equipe técnica.</i></p>"}`}

  <h2>15. Monitoramento e Reavaliação</h2>
  <div class="info-box">A presente avaliação possui caráter contínuo e preventivo, devendo integrar processo
  permanente de monitoramento organizacional dos fatores psicossociais relacionados ao trabalho.</div>
  <table>
    <tr><th>Nível de risco</th><th>Frequência de reavaliação</th></tr>
    <tr><td>Crítico</td><td>Reavaliação em até 3 meses após intervenção</td></tr>
    <tr><td>Alto</td><td>Monitoramento trimestral</td></tr>
    <tr><td>Médio</td><td>Monitoramento semestral</td></tr>
    <tr><td>Baixo</td><td>Monitoramento anual</td></tr>
  </table>

  <h2>16. Conclusão Técnica</h2>
  <p>O presente ciclo avaliativo evidencia o panorama atual dos fatores psicossociais relacionados ao trabalho
  em <b>${esc(a.companyName)}</b>. A implementação das medidas preventivas propostas no plano de ação, somada
  ao monitoramento sistemático e à rastreabilidade contínua, permitirá à organização elevar seu nível de
  maturidade em saúde mental no trabalho e atender plenamente às exigências legais vigentes.</p>

  <h2>17. Responsabilidade Técnica</h2>
  <p>Este laudo foi elaborado sob responsabilidade técnica de
  <b>${esc(a.responsibleTechnician || "Marise Paiva — CRP 55-33301")}</b>,
  profissional habilitada conforme legislação vigente, em conformidade com as disposições da NR-01 (Portaria MTP nº 1.419/2024) e da ISO 45003:2021.</p>
  <table>
    <tr><th style="width:35%">Item</th><th>Dados do Responsável Técnico</th></tr>
    <tr><td>Nome</td><td><b>${esc(a.responsibleTechnician || "Marise Paiva")}</b></td></tr>
    <tr><td>Profissão / Registro</td><td>${esc((a as any).responsibleRegistration || "Psicóloga Organizacional — CRP 55-33301")}</td></tr>
    ${(a as any).responsibleProfession ? `<tr><td>Especialidade</td><td>${esc((a as any).responsibleProfession)}</td></tr>` : ""}
    ${(a as any).responsibleArt ? `<tr><td>ART / RRT</td><td>${esc((a as any).responsibleArt)}</td></tr>` : ""}
    ${(a as any).responsibleCompany ? `<tr><td>Empresa elaboradora</td><td>${esc((a as any).responsibleCompany)}</td></tr>` : ""}
    ${(a as any).responsibleValidUntil ? `<tr><td>Validade</td><td>${esc(fmtDate((a as any).responsibleValidUntil))}</td></tr>` : ""}
    <tr><td>Data de emissão</td><td>${esc(mesAno)}</td></tr>
  </table>
  <div class="signature">
    ${(a as any).responsibleSignatureUrl ? `<img src="${esc((a as any).responsibleSignatureUrl)}" alt="Assinatura" style="max-height:60px;display:block;margin:0 auto 8px;">` : '<div class="line"></div>'}
    <div style="text-align:center">${esc(a.responsibleTechnician || "Marise Paiva — CRP 55-33301")}<br>
    <small class="muted">Responsável Técnica</small></div>
  </div>

    <h2>18. Encerramento</h2>
  <p>O presente documento é de uso interno e destina-se exclusivamente à gestão preventiva dos riscos
  psicossociais. Todas as informações foram coletadas de forma anônima e coletiva, garantindo a
  confidencialidade individual dos respondentes.</p>

  <h2>19. Referências Bibliográficas</h2>
  <p>BRASIL. Ministério do Trabalho e Previdência. <i>Portaria MTP nº 1.419/2024. NR-01.</i><br>
  ISO 45003:2021. <i>Occupational health and safety management — Psychological health and safety at work.</i><br>
  KARASEK, R. (1979). Job demands, job decision latitude, and mental strain.<br>
  SIEGRIST, J. (1996). Adverse health effects of high-effort/low-reward conditions.<br>
  LEKA, S.; COX, T. (2008). <i>PRIMA-EF — Guidance on the European Framework.</i> WHO.<br>
  COX, T.; GRIFFITHS, A. (1995). The assessment of psychosocial hazards at work.<br>
  CFP. Resolução nº 010/2000. Brasília: Conselho Federal de Psicologia.</p>

  <div class="footer-note">Documento gerado pela plataforma Saúde do Trabalho — ${esc(now.toLocaleDateString("pt-BR"))} | Ciclo: ${esc(a.cycleName)}</div>
  </body></html>`;

  await renderPDF(html, outPath);
  return `/uploads/risk_pdfs/laudo_${a.id}.pdf`;
}

// ── 2. INVENTÁRIO + MATRIZ ───────────────────────────────────────────────────
export async function generateInventoryPDF(
  a: AssessmentData,
  inventory: InventoryRow[]
): Promise<string> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const outPath = path.join(UPLOAD_DIR, `inventario_${a.id}.pdf`);

  const rows = inventory.map((it, i) => {
    const fonte = (it.fontesGeradoras && String(it.fontesGeradoras).trim())
      ? it.fontesGeradoras
      : (it.description && String(it.description).trim() ? it.description : "—");
    const medidas = (it.medidasExistentes && String(it.medidasExistentes).trim())
      ? it.medidasExistentes
      : "A definir conforme plano de ação";
    return `
    <tr>
      <td>${i + 1}</td>
      <td><b>${esc(it.factorName)}</b></td>
      <td>${esc(fonte)}</td>
      <td>${esc(medidas)}</td>
      <td class="matrix-cell" style="background:${classToColor(it.gravidade)}">${classToLabel(it.gravidade)}</td>
      <td class="matrix-cell" style="background:${classToColor(it.probabilidade)}">${classToLabel(it.probabilidade)}</td>
      <td class="matrix-cell" style="background:${classToColor(it.riscoFinal)}">${classToLabel(it.riscoFinal)}</td>
      <td style="text-align:center">${it.drpsScoreAvg != null ? Number(it.drpsScoreAvg).toFixed(2) : "—"}</td>
    </tr>`;
  }).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
  <style>${BASE_CSS}
    @page { size: A4 landscape; margin: 14mm; }
  </style></head><body>
  <div class="header-strip">
    <div class="name">${esc(a.companyName)}</div>
    <div class="meta">Inventário de Riscos Psicossociais — ${esc(a.cycleName)}</div>
    <div class="meta">Setor avaliado: <b>${esc(a.sectorName || "Não especificado")}</b></div>
  </div>
  <h2 style="margin-top:0">Inventário + Matriz de Classificação por Setor</h2>
  <table>
    <tr>
      <th style="width:4%">#</th>
      <th style="width:22%">Fator de risco</th>
      <th style="width:22%">Fontes geradoras</th>
      <th style="width:22%">Medidas existentes</th>
      <th>Grav.</th><th>Prob.</th><th>Risco</th>
      <th style="width:8%">DRPS</th>
    </tr>
    ${rows}
  </table>
  <p><small class="muted">Escala DRPS: 0 (sem risco) a 4 (risco extremo) — média ponderada por fator.</small></p>
  <div class="footer-note">${esc(a.responsibleTechnician || "Marise Paiva — CRP 55-33301")} • Plataforma Saúde do Trabalho</div>
  </body></html>`;

  await renderPDF(html, outPath);
  return `/uploads/risk_pdfs/inventario_${a.id}.pdf`;
}

// ── 3. CRONOGRAMA 12 MESES ───────────────────────────────────────────────────
export async function generateCronogramaPDF(
  a: AssessmentData,
  actions: ActionPlanRow[]
): Promise<string> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const outPath = path.join(UPLOAD_DIR, `cronograma_${a.id}.pdf`);

  const months = next12Months(a.startDate || null);
  const headers = months.map((m) => `<th style="text-align:center;width:6%">${esc(monthLabel(m))}</th>`).join("");

  const rows = actions.map((ac) => {
    const cells = months.map((m) => {
      const filled = ac.monthlyProgress && (ac.monthlyProgress as any)[m];
      return `<td style="text-align:center">${filled ? `<span class="month-dot"></span>` : `<span class="month-empty"></span>`}</td>`;
    }).join("");
    return `<tr>
      <td><b>${esc(ac.factorName)}</b><br><small class="muted">${esc(ac.actionDescription)}</small></td>
      <td><span class="badge" style="background:${classToColor(ac.priority)}">${classToLabel(ac.priority)}</span></td>
      ${cells}
    </tr>`;
  }).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
  <style>${BASE_CSS}
    @page { size: A4 landscape; margin: 14mm; }
  </style></head><body>
  <div class="header-strip">
    <div class="name">${esc(a.companyName)}${a.sectorName ? ` — ${esc(a.sectorName)}` : ""}</div>
    <div class="meta">Cronograma 12 meses — ${esc(a.cycleName)}</div>
  </div>
  <h2 style="margin-top:0">Cronograma de Implementação — 12 meses</h2>
  ${actions.length === 0 ? `<p><i>Nenhuma ação cadastrada ainda.</i></p>` : `
  <table>
    <tr>
      <th style="width:28%">Programa Preventivo</th>
      <th style="width:9%">Prioridade</th>
      ${headers}
    </tr>
    ${rows}
  </table>`}
  <p><small class="muted">Marcadores verdes indicam meses programados para execução do programa preventivo.</small></p>
  <div class="footer-note">${esc(a.responsibleTechnician || "Marise Paiva — CRP 55-33301")} • Plataforma Saúde do Trabalho</div>
  </body></html>`;

  await renderPDF(html, outPath);
  return `/uploads/risk_pdfs/cronograma_${a.id}.pdf`;
}

// ── 4. LAUDO AEP STANDALONE (Análise Ergonômica Preliminar) ──────────────────
export type AEPItem = {
  orderIndex: number;
  type: string;                 // "text" | "likert" | outros
  questionText: string;
  textAnswers?: string[];       // respostas qualitativas (não-likert)
  likertAvg?: number | null;    // média numérica (likert)
  likertCount?: number;         // nº de respondentes que responderam o item
  likertMax?: number;           // limite superior observado da escala (para barra)
};

export type AEPSectorGroup = {
  sectorId: number;
  sectorName: string;
  aepResponses: number;
  items: AEPItem[];
};

export async function generateAEPLaudoPDF(
  a: AssessmentData,
  items: AEPItem[],
  sectorGroups?: AEPSectorGroup[]
): Promise<string> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const outPath = path.join(UPLOAD_DIR, `laudo_aep_${a.id}.pdf`);
  const now = new Date();
  const mesAno = `${now.toLocaleDateString("pt-BR", { month: "long" })} / ${now.getFullYear()}`;

  // Monta os blocos qualitativos e a tabela Likert para um conjunto de itens (todo o ciclo
  // ou de um único setor). Usado tanto no modo consolidado quanto no detalhamento por setor.
  function aepParts(its: AEPItem[]) {
    const ordered = [...its].sort((x, y) => x.orderIndex - y.orderIndex);
    const qualit = ordered.filter((i) => i.type !== "likert");
    const likert = ordered.filter((i) => i.type === "likert");
    const sMax = Math.max(4, ...likert.map((i) => i.likertMax || 0));
    const qual = qualit.length
      ? qualit.map((i) => `
        <div class="aep-qa">
          <div class="aep-q">${esc(i.questionText)}</div>
          ${(i.textAnswers && i.textAnswers.length)
            ? i.textAnswers.map((t) => `<div class="aep-a">${esc(t)}</div>`).join("")
            : `<div class="aep-a muted"><i>Sem resposta registrada.</i></div>`}
        </div>`).join("")
      : `<p><i>Nenhuma questão qualitativa registrada.</i></p>`;
    const rows = likert.length
      ? likert.map((i) => {
          const avg = i.likertAvg;
          const pct = avg != null && sMax > 0 ? Math.max(0, Math.min(100, (avg / sMax) * 100)) : 0;
          return `
          <tr>
            <td>${esc(i.questionText)}</td>
            <td style="text-align:center">${avg != null ? avg.toFixed(2) : "—"}</td>
            <td>
              <div class="bar-track"><div class="bar-fill" style="width:${pct.toFixed(0)}%"></div></div>
            </td>
            <td style="text-align:center">${i.likertCount ?? 0}</td>
          </tr>`;
        }).join("")
      : "";
    const likertTable = rows ? `<table>
      <tr><th style="width:55%">Afirmação avaliada</th><th style="width:10%">Média</th><th>Intensidade</th><th style="width:10%">Nº resp.</th></tr>
      ${rows}
    </table>
    <p><small class="muted">Escala 0–${sMax}. A barra indica a intensidade média da resposta; a leitura de risco
    depende do enunciado (afirmações positivas: média alta é favorável; afirmações de sobrecarga: média alta indica
    atenção).</small></p>` : `<p><i>Nenhum indicador quantitativo registrado.</i></p>`;
    return { qual, likertTable, scaleMax: sMax };
  }

  const hasSectors = !!(sectorGroups && sectorGroups.length > 0);
  const main = aepParts(items);
  const qualBlocks = main.qual;
  const scaleMax = main.scaleMax;

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
  <style>${BASE_CSS}
    .aep-qa { page-break-inside: avoid; margin: 0 0 5mm; padding-bottom: 4mm; border-bottom: 1px dotted #cbd5e1; }
    .aep-q { font-weight: 600; color: ${PRIMARY}; margin-bottom: 3px; }
    .aep-a { background: #f8fafc; border-left: 3px solid ${ACCENT}; padding: 5px 9px; margin: 3px 0; border-radius: 0 4px 4px 0; }
    .aep-a.muted { color: #64748b; border-left-color: #cbd5e1; }
    .bar-track { background: #e5e7eb; border-radius: 6px; height: 9px; width: 100%; }
    .bar-fill { background: ${ACCENT}; height: 9px; border-radius: 6px; }
  </style>
  </head><body>

  <div class="cover">
    <div class="logo">SAÚDE DO TRABALHO • CONSULTORIA</div>
    <div class="title">Laudo de Análise Ergonômica Preliminar (AEP)</div>
    <div class="subtitle">Apreciação ergonômica conforme NR-17 e NR-01</div>
    <div class="meta">
      <div><b>Empresa:</b> ${esc(a.companyName)}</div>
      ${a.companyCnpj ? `<div><b>CNPJ:</b> ${esc(a.companyCnpj)}</div>` : ""}
      ${a.branchName ? `<div><b>Filial:</b> ${esc(a.branchName)}</div>` : ""}
      <div><b>Setor avaliado:</b> ${esc(a.sectorName || "Não especificado")}</div>
      <div><b>Ciclo:</b> ${esc(a.cycleName)}</div>
      <div><b>Mês/Ano:</b> ${esc(mesAno)}</div>
    </div>
  </div>
  <div class="page-break"></div>

  <h2>Conteúdo do Relatório</h2>
  <ol class="toc">
    <li><b>1.</b> Introdução</li>
    <li><b>2.</b> Objetivo</li>
    <li><b>3.</b> Fundamentação Legal e Normativa</li>
    <li><b>4.</b> Metodologia Aplicada</li>
    ${hasSectors ? `<li><b>5.</b> Detalhamento por Setor Avaliado (achados + indicadores de cada setor)</li>` : `<li><b>5.</b> Caracterização do Setor Avaliado</li>
    <li><b>6.</b> Achados Qualitativos</li>
    <li><b>7.</b> Indicadores Quantitativos (escala Likert)</li>`}
    <li><b>8.</b> Conclusão e Encaminhamentos</li>
    <li><b>9.</b> Responsabilidade Técnica e Assinatura</li>
    <li><b>10.</b> Referências</li>
  </ol>

  <h2>1. Introdução</h2>
  <p>Este documento apresenta a <b>Análise Ergonômica Preliminar (AEP)</b> do setor
  <b>${esc(a.sectorName || "—")}</b> de <b>${esc(a.companyName)}</b>. A AEP é uma etapa de apreciação
  inicial que identifica, de forma qualitativa e exploratória, as condições de trabalho, a organização das
  atividades e potenciais fontes de risco ergonômico e psicossocial, orientando a necessidade (ou não) de uma
  Análise Ergonômica do Trabalho (AET) aprofundada.</p>

  <h2>2. Objetivo</h2>
  <p>Levantar de forma preliminar os aspectos organizacionais, cognitivos e ambientais do trabalho no setor
  avaliado, subsidiando o diagnóstico de riscos psicossociais (DRPS) e a definição de medidas preventivas
  ergonômicas e de gestão.</p>

  <h2>3. Fundamentação Legal e Normativa</h2>
  <p>Norma Regulamentadora nº 17 (NR-17 — Ergonomia); Norma Regulamentadora nº 1 (NR-01) e Anexo sobre fatores
  psicossociais; Portaria MTP nº 1.419/2024; ISO 45003:2021 (saúde e segurança psicológica no trabalho).</p>

  <h2>4. Metodologia Aplicada</h2>
  <p>A AEP foi conduzida por meio de questionário estruturado misto, combinando questões abertas (qualitativas)
  sobre processos, organização e percepções, e questões em escala Likert sobre demandas, suporte e ritmo de
  trabalho. As respostas foram consolidadas pela equipe técnica. As médias quantitativas devem ser interpretadas
  considerando o enunciado de cada questão (afirmações favoráveis e desfavoráveis), servindo como indicadores de
  atenção, não como classificação isolada de risco.</p>

  ${hasSectors ? `
  <h2>5. Detalhamento por Setor Avaliado</h2>
  <p>Esta Análise Ergonômica Preliminar abrange <b>${sectorGroups!.length} setor(es)</b>. Cada setor é
  detalhado individualmente abaixo, com seus próprios achados qualitativos e indicadores quantitativos,
  sem mistura de respostas entre setores.</p>
  <table>
    <tr><th style="width:35%">Item</th><th>Descrição</th></tr>
    <tr><td>Empresa</td><td>${esc(a.companyName)}</td></tr>
    ${a.branchName ? `<tr><td>Filial</td><td>${esc(a.branchName)}</td></tr>` : ""}
    <tr><td>Ciclo</td><td>${esc(a.cycleName)}</td></tr>
    <tr><td>Setores avaliados</td><td>${sectorGroups!.map((sg) => esc(sg.sectorName)).join(", ")}</td></tr>
    <tr><td>Respostas AEP coletadas</td><td>${a.aepResponses}</td></tr>
  </table>
  ${sectorGroups!.map((sg, idx) => {
    const p = aepParts(sg.items);
    return `
    <h3 style="margin-top:14px;font-size:11pt;color:${PRIMARY};">${idx + 1}. Setor: ${esc(sg.sectorName)} — ${sg.aepResponses} resposta(s)</h3>
    <p style="font-weight:600;margin:6px 0 2px;">Achados Qualitativos</p>
    ${p.qual}
    <p style="font-weight:600;margin:8px 0 2px;">Indicadores Quantitativos</p>
    ${p.likertTable}`;
  }).join("")}
  ` : `
  <h2>5. Caracterização do Setor Avaliado</h2>
  <table>
    <tr><th style="width:35%">Item</th><th>Descrição</th></tr>
    <tr><td>Empresa</td><td>${esc(a.companyName)}</td></tr>
    ${a.branchName ? `<tr><td>Filial</td><td>${esc(a.branchName)}</td></tr>` : ""}
    <tr><td>Setor</td><td>${esc(a.sectorName || "Não especificado")}</td></tr>
    <tr><td>Ciclo</td><td>${esc(a.cycleName)}</td></tr>
    <tr><td>Respostas AEP coletadas</td><td>${a.aepResponses}</td></tr>
  </table>

  <h2>6. Achados Qualitativos</h2>
  ${qualBlocks}

  <h2>7. Indicadores Quantitativos</h2>
  ${main.likertTable}
  `}

  <h2>8. Conclusão e Encaminhamentos</h2>
  <p>A presente Análise Ergonômica Preliminar consolida a percepção inicial sobre as condições de trabalho do
  setor avaliado e integra-se ao Diagnóstico de Riscos Psicossociais (DRPS) do mesmo ciclo. Recomenda-se que os
  achados aqui descritos sejam considerados na construção do inventário de riscos, do plano de ação e do
  cronograma de medidas preventivas, e que, havendo indicativos relevantes, seja conduzida Análise Ergonômica do
  Trabalho (AET) específica.</p>

  <h2>9. Responsabilidade Técnica e Assinatura</h2>
  <p>Esta análise foi elaborada sob responsabilidade técnica de
  <b>${esc(a.responsibleTechnician || "Marise Paiva — CRP 55-33301")}</b>, profissional habilitada conforme
  legislação vigente.</p>
  <div class="signature">
    <div class="line"></div>
    <div style="text-align:center">${esc(a.responsibleTechnician || "Marise Paiva — CRP 55-33301")}<br>
    <small class="muted">Responsável Técnica</small></div>
  </div>

  <h2>10. Referências</h2>
  <p>BRASIL. Ministério do Trabalho e Previdência. NR-17 — Ergonomia.<br>
  BRASIL. Portaria MTP nº 1.419/2024. NR-01.<br>
  ISO 45003:2021 — Occupational health and safety management — Psychological health and safety at work.</p>

  <div class="footer-note">Documento gerado pela plataforma Saúde do Trabalho — ${esc(now.toLocaleDateString("pt-BR"))}</div>
  </body></html>`;

  await renderPDF(html, outPath);
  return `/uploads/risk_pdfs/laudo_aep_${a.id}.pdf`;
}

