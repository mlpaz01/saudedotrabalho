/**
 * PGR — Programa de Gerenciamento de Riscos — PDF generation.
 * Modelo "Logo + dados do cliente, texto nosso": o texto técnico/normativo (NR-01)
 * é padrão da consultoria; os dados de identificação, GHE, inventário, responsável
 * técnico e logomarca são fornecidos pelo cliente e interpolados no documento.
 *
 * Segue o mesmo padrão de renderização do risk_pdf.ts (puppeteer + HTML/CSS).
 */
import puppeteer from "puppeteer";
import path from "path";
import fs from "fs/promises";

const UPLOAD_DIR = "/var/www/saudedotrabalho/uploads/pgr_pdfs";

const PRIMARY = "#1e3a5f";
const ACCENT = "#0ea5e9";

function esc(s: unknown): string {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

/** Quebra texto multilinha em parágrafos preservando \n. */
function multiline(s: unknown): string {
  if (s == null) return "";
  return esc(s).replace(/\n/g, "<br>");
}

/**
 * Converte texto plano (Markdown-light) editado pelo SESMT em HTML para o PDF.
 * Suporta:
 *  - Parágrafos separados por linha em branco
 *  - Listas com "- " ou "* " no início da linha
 *  - Cabeçalhos: linhas em MAIÚSCULAS com 6+ chars viram <h3>
 *  - **negrito** vira <b>
 * Sempre escapa HTML antes de aplicar substituições.
 */
function renderUserText(s: unknown): string {
  if (s == null || String(s).trim() === "") return "";
  const txt = esc(s);
  const blocks = txt.split(/\n\s*\n/);
  const html: string[] = [];
  for (const raw of blocks) {
    const lines = raw.split("\n").map((l) => l.replace(/\s+$/, ""));
    const isListBlock = lines.every((l) => /^[-*]\s+/.test(l));
    if (isListBlock) {
      html.push("<ul>" + lines.map((l) => `<li>${l.replace(/^[-*]\s+/, "")}</li>`).join("") + "</ul>");
      continue;
    }
    // bloco que é uma linha só em MAIÚSCULAS — vira cabeçalho h3
    if (lines.length === 1 && /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9\s\-–—.()/]{6,}$/.test(lines[0]) && /[A-ZÁ-Ú]/.test(lines[0])) {
      html.push(`<h3 style="font-size:11.5pt;margin-top:6mm">${lines[0]}</h3>`);
      continue;
    }
    // parágrafo com <br> internos. Aplica **negrito** depois de escapar.
    const para = lines.join("<br>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
    html.push(`<p>${para}</p>`);
  }
  return html.join("\n");
}

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return String(d); }
}

// ── Matriz de Risco NR-1 (item 1.5.7.3): NR = Probabilidade × Severidade ──────
const SEVERIDADES = [
  { key: "insignificante", label: "Insignificante", peso: 1 },
  { key: "menor", label: "Menor", peso: 2 },
  { key: "moderada", label: "Moderada", peso: 4 },
  { key: "maior", label: "Maior", peso: 8 },
  { key: "catastrofica", label: "Catastrófica", peso: 16 },
];
const PROBABILIDADES = [
  { key: "raro", label: "Raro", peso: 1 },
  { key: "improvavel", label: "Improvável", peso: 2 },
  { key: "possivel", label: "Possível", peso: 3 },
  { key: "provavel", label: "Provável", peso: 4 },
  { key: "certo", label: "Certo", peso: 5 },
];

function sevPeso(s: unknown): number {
  const found = SEVERIDADES.find((x) => x.key === String(s).toLowerCase());
  if (found) return found.peso;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
function probPeso(p: unknown): number {
  const found = PROBABILIDADES.find((x) => x.key === String(p).toLowerCase());
  if (found) return found.peso;
  const n = Number(p);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function zonaDecisao(nr: number): { zona: string; tratamento: string; color: string } {
  if (nr <= 4) return { zona: "Tolerável", tratamento: "Manter controles existentes", color: "#16a34a" };
  if (nr <= 8) return { zona: "Significativo", tratamento: "Avaliar necessidade de novos controles", color: "#ca8a04" };
  if (nr <= 16) return { zona: "Sério", tratamento: "Implementar novos controles", color: "#ea580c" };
  return { zona: "Intolerável", tratamento: "Paralisar atividade", color: "#b91c1c" };
}

export type GheRow = { funcao: string; descricao?: string | null; num?: number | string | null };
export type RevisaoRow = { revisao: string; motivo: string; data?: string | null };
export type InventarioRow = {
  fator: string;
  tipoRisco?: string | null;
  postoTrabalho?: string | null;
  setor?: string | null;
  funcoes?: string | null;
  dataReconhecimento?: string | null;
  agravos?: string | null;
  causas?: string | null;
  controles?: string | null;
  eficaciaControles?: string | null;
  populacao?: string | null;
  exposicao?: string | null;
  freqExposicao?: string | null;
  areaImpacto?: string | null;
  tipoAvaliacao?: string | null;
  probabilidade?: string | number | null;
  severidade?: string | number | null;
  acoes?: string | null;
  responsavel?: string | null;
  prazo?: string | null;
  freqMonitoramento?: string | null;
  legRef?: string | null;
  observacoes?: string | null;
  epc?: string | null;
  epi?: string | null;
};

export type PgrData = {
  id: number;
  title?: string | null;
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  cnpj?: string | null;
  endereco?: string | null;
  atividadePrincipal?: string | null;
  grauRisco?: string | null;
  contato?: string | null;
  email?: string | null;
  numFuncionarios?: string | null;
  objetoContrato?: string | null;
  horariosTrabalho?: string | null;
  regimeTrabalho?: string | null;
  obra?: string | null;
  vigenciaInicio?: string | null;
  vigenciaFim?: string | null;
  contratanteAtivo?: boolean;
  contratanteRazao?: string | null;
  contratanteCnpj?: string | null;
  contratanteEndereco?: string | null;
  contratanteAtividade?: string | null;
  contratanteGrauRisco?: string | null;
  contratanteContato?: string | null;
  contratanteEmail?: string | null;
  respTecnicoNome?: string | null;
  respTecnicoRegistro?: string | null;
  respTecnicoProfissao?: string | null;
  respTecnicoArt?: string | null;
  respTecnicoEmpresa?: string | null;
  respTecnicoAssinaturaUrl?: string | null;
  respTecnicoValidadeAte?: string | null;
  logoUrl?: string | null;
  gheFuncoes?: GheRow[] | null;
  revisoes?: RevisaoRow[] | null;
  inventario?: InventarioRow[] | null;
  gseGrupos?: GseRow[] | null;
  epcItens?: EpcRow[] | null;
  epiItens?: EpiRow[] | null;
  caracterizacaoSetores?: any[] | null;
  cronogramaPreventivo?: any[] | null;
  hierarquiaControle?: any[] | null;
  naoConformidades?: any[] | null;
  treinamentosNr?: any[] | null;
  // Sprint 1 PGR Inteligente: quando preenchido, o PDF usa a estrutura GSE-first
  // (tabelas relacionais) em vez do JSON legado. Os dois NUNCA aparecem juntos.
  gseGroups?: PgrGseGroup[] | null;
  // Sprint 1.7-A: textos personalizáveis vindos do SESMT (com fallback ao texto
  // fixo padrão da consultoria quando vazios).
  textoIntroducao?: string | null;
  textoConclusao?: string | null;
};

export type PgrGseGroup = {
  id: number;
  nome: string;
  descricao?: string | null;
  numTrabalhadores?: number | null;
  numHomens?: number | null;
  numMulheres?: number | null;
  aiSuggested?: boolean;
  migratedFromLegacy?: boolean;
  cargos: string[];
  setores: { id: number; name: string; branchName?: string | null }[];
  riscos: {
    tipo: string; agente: string; fonteGeradora?: string | null; possivelDano?: string | null;
    tipoExposicao?: string | null; severidade: string; probabilidade: string; riscoFinal: string;
    notes?: string | null;
  }[];
  epc: { descricao: string; aplicacao?: string | null }[];
  epi: { descricao: string; ca?: string | null; aplicacao?: string | null; validade?: string | null }[];
  acoes: {
    what: string; why?: string | null; where?: string | null; whenStart?: string | null;
    whenEnd?: string | null; who?: string | null; how?: string | null; howMuch?: string | null;
    priority: string; status: string;
  }[];
  evidencias: { tipo: string; titulo?: string | null; descricao?: string | null; fileUrl?: string | null }[];
  treinamentos: { nrCode: string; nome: string; cargaHoraria?: number | null; obrigatorio: boolean }[];
};

export type GseRow = { grupo: string; funcoes?: string | null; atividades?: string | null; num?: string | number | null; sexoM?: string | null; sexoF?: string | null; horario?: string | null; local?: string | null; };
export type EpcRow = { descricao: string; aplicacao?: string | null };
export type EpiRow = { descricao: string; ca?: string | null; aplicacao?: string | null; validade?: string | null; periodicidade?: string | null; fichaEntrega?: string | null; };

const BASE_CSS = `
  @page { size: A4; margin: 20mm 16mm 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Inter','Helvetica',sans-serif; color:#1f2937; line-height:1.5; font-size:10pt; margin:0; }
  h1,h2,h3,h4 { font-family:'Playfair Display',Georgia,serif; color:${PRIMARY}; margin-top:0; }
  h2 { font-size:15pt; border-bottom:2px solid ${ACCENT}; padding-bottom:4px; margin-top:10mm; }
  h3 { font-size:12pt; margin-top:7mm; color:${PRIMARY}; }
  h4 { font-size:10.5pt; margin-top:5mm; color:#334155; }
  p { margin:5px 0; text-align:justify; }
  ul { margin:5px 0; padding-left:18px; }
  li { margin:3px 0; text-align:justify; }
  table { width:100%; border-collapse:collapse; margin:8px 0 14px; font-size:8.8pt; }
  th { background:${PRIMARY}; color:#fff; padding:5px 6px; text-align:left; font-weight:600; font-size:8.5pt; }
  td { padding:5px 6px; border:1px solid #e5e7eb; vertical-align:top; }
  tr:nth-child(even) td { background:#f8fafc; }
  .cover { display:flex; flex-direction:column; justify-content:center; align-items:center; height:250mm; text-align:center; }
  .cover img.logo { max-height:38mm; max-width:80mm; margin-bottom:16mm; object-fit:contain; }
  .cover .kicker { font-size:13pt; letter-spacing:4px; color:${ACCENT}; font-weight:700; margin-bottom:6mm; }
  .cover .title { font-family:'Playfair Display',Georgia,serif; font-size:30pt; color:${PRIMARY}; line-height:1.15; margin-bottom:10mm; }
  .cover .company { font-size:17pt; font-weight:700; color:#1f2937; margin-bottom:4mm; }
  .cover .sub { font-size:11pt; color:#475569; margin:2px 0; }
  .cover .validity { margin-top:18mm; font-size:12pt; color:${PRIMARY}; font-weight:600; }
  .page-break { page-break-after:always; }
  .section { page-break-inside:avoid; }
  .running { position:running(header); }
  .id-table td:first-child { width:32%; font-weight:600; color:#334155; background:#f1f5f9; }
  .matrix-cell { text-align:center; font-weight:700; color:#fff; }
  .legend td { text-align:center; font-weight:600; }
  .signature { margin-top:26mm; text-align:center; page-break-inside:avoid; }
  .signature .line { border-bottom:1px solid #1f2937; width:72mm; margin:0 auto 4mm; }
  small.muted { color:#64748b; font-size:8pt; }
  .footer-note { margin-top:12mm; font-size:8pt; color:#64748b; text-align:center; border-top:1px solid #e5e7eb; padding-top:6px; }
  .strip { background:${PRIMARY}; color:#fff; padding:8px 12px; border-radius:4px; margin-bottom:6mm; }
  .strip .t { font-weight:700; font-size:11pt; }
  .strip .s { font-size:8.5pt; opacity:.9; }
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

// ── Blocos de texto técnico fixo (padrão da consultoria, base NR-01) ──────────
function parteI(d: PgrData): string {
  const emp = esc(d.nomeFantasia || d.razaoSocial || "a empresa");
  return `
  <h2>1. PARTE I — DISPOSIÇÃO GERAL</h2>

  <h3>1.1 Introdução</h3>
  <p>O Documento Base do Programa de Gerenciamento de Riscos (PGR) insere-se no contexto da política de
  gestão de <b>${emp}</b>, buscando a melhoria contínua do ambiente de trabalho e a preservação da saúde
  dos seus colaboradores e contratados. Está estruturado conforme disposto na NR-01, Portaria 3.214 de
  08 de junho de 1978, com redação atualizada pela Portaria 6.730 de 12 de março de 2020.</p>

  <h3>1.2 Objetivo</h3>
  <p>O Programa de Gerenciamento de Riscos — PGR — visa estabelecer as disposições gerais, o campo de
  aplicação, os termos e as definições comuns às Normas Regulamentadoras (NR) relativas à segurança e
  saúde no trabalho. Este Documento Base tem o objetivo de estabelecer as diretrizes para o
  Gerenciamento de Riscos Ocupacionais (GRO) e as medidas de prevenção em Segurança e Saúde no
  Trabalho (SST).</p>

  <h3>1.3 Termos e Definições</h3>
  <ul>
    <li><b>Risco ocupacional:</b> combinação da probabilidade de ocorrer lesão ou agravo à saúde causados
    por um evento perigoso, exposição a agente nocivo ou exigência da atividade de trabalho, e da
    severidade dessa lesão ou agravo à saúde.</li>
    <li><b>Agente físico:</b> qualquer forma de energia que, em função de sua natureza, intensidade e
    exposição, seja capaz de causar lesão ou agravo à saúde (ruído, vibrações, pressões anormais,
    temperaturas extremas, radiações ionizantes e não ionizantes).</li>
    <li><b>Agente químico:</b> substância química, isolada ou em mistura, que em função de sua natureza,
    concentração e exposição seja capaz de causar lesão ou agravo à saúde do trabalhador.</li>
    <li><b>Agente biológico:</b> microrganismos, parasitas ou materiais originados de organismos que, em
    função de sua natureza e do tipo de exposição, sejam capazes de causar lesão ou agravo à saúde.</li>
    <li><b>Limite de Tolerância (LT):</b> concentração ou intensidade máxima ou mínima, relacionada à
    natureza e ao tempo de exposição ao agente, que não causará dano à saúde do trabalhador durante a
    sua vida laboral (NR-15).</li>
    <li><b>Nível de Ação:</b> valor acima do qual devem ser iniciadas ações preventivas (monitoramento
    periódico, informação aos trabalhadores e controle médico), de forma a minimizar a probabilidade de
    que as exposições ultrapassem os limites estabelecidos.</li>
    <li><b>Grupos Homogêneos / Similares de Exposição (GHE/GSE):</b> grupos de trabalhadores que
    experimentam exposição semelhante, de forma que o resultado da avaliação de qualquer membro seja
    representativo do grupo como um todo.</li>
  </ul>

  <h3>1.4 Responsabilidades</h3>
  <p><b>${emp}</b>, cumpridora de requisitos legais, implanta por meio deste Documento Base o seu PGR,
  conforme preconiza a Lei nº 6.514/1977 e a Portaria nº 6.730/2020 (NR-01). A reavaliação deste PGR é de
  responsabilidade da Empresa, que se compromete a dar continuidade ao programa, implementando e
  assegurando o cumprimento das medidas de controle necessárias, de acordo com o cronograma de ações
  estabelecido, bem como seu monitoramento contínuo.</p>
  <h4>Empregador</h4>
  <ul>
    <li>Assumir responsabilidade pelas medidas técnicas e operacionais exigidas no presente documento (NR-01);</li>
    <li>Esclarecer que os resultados e recomendações constituem parecer técnico e científico das condições
    de Segurança, Higiene e Medicina do Trabalho constatadas durante a avaliação.</li>
  </ul>
  <h4>Diretoria</h4>
  <ul><li>Estabelecer, implementar e assegurar recursos para o cumprimento do PGR conforme a legislação.</li></ul>
  <h4>Coordenador Geral do GRO</h4>
  <ul>
    <li>Coordenar a implantação e o desenvolvimento do GRO previsto neste PGR;</li>
    <li>Rever informações sobre o controle do programa e delegar responsabilidade e autoridade;</li>
    <li>Elaborar os orçamentos anuais do Programa, alocando os recursos financeiros necessários.</li>
  </ul>
  <h4>Supervisores e Líderes</h4>
  <ul>
    <li>Supervisionar os trabalhadores para assegurar o cumprimento dos procedimentos corretos de trabalho;</li>
    <li>Assegurar que equipamentos e máquinas estejam em perfeito estado de funcionamento;</li>
    <li>Comunicar informações sobre os riscos ambientais e procedimentos de controle adotados;</li>
    <li>Colaborar com a CIPA na investigação de acidentes ou doenças e na adoção de medidas preventivas.</li>
  </ul>
  <h4>Empregados</h4>
  <ul>
    <li>Colaborar e participar da implantação do PGR, com permanente vigilância das condições de segurança e saúde;</li>
    <li>Seguir as orientações recebidas nos treinamentos previstos e cumprir as normas de SST;</li>
    <li>Comunicar ao responsável imediato as condições inseguras que possam implicar riscos à saúde;</li>
    <li>Utilizar obrigatoriamente o Equipamento de Proteção Individual (EPI) onde sinalizado e quando necessário.</li>
  </ul>
  <h4>CIPA — Comissão Interna de Prevenção de Acidentes</h4>
  <ul>
    <li>Acompanhar e avaliar o desempenho deste programa e zelar pelo cumprimento das medidas preventivas e corretivas;</li>
    <li>Manter cópia atualizada do Relatório Anual de Atividades e desenvolver o Mapa de Risco (NR-05).</li>
  </ul>

  <h3>1.5 Documentos Complementares</h3>
  <ul>
    <li>Matriz de Riscos do PGR;</li>
    <li>Inventário de Riscos do PGR;</li>
    <li>Plano de Ação no Gerenciamento de Riscos.</li>
  </ul>

  <h3>1.6 Estratégia e Metodologia de Ação</h3>
  <p>O presente programa foi elaborado com base na <b>Antecipação</b>, <b>Reconhecimento</b> e
  <b>Avaliação</b> dos riscos ambientais existentes nas atividades dos empregados, considerando os
  diversos locais de trabalho. Esses dados foram levantados por profissionais habilitados e inseridos no
  Inventário de Riscos deste PGR. O controle desses riscos foi inserido para o gerenciamento na Planilha
  de Ação (Plano de Gerenciamento de Riscos). A metodologia aplicada segue a legislação atualizada das
  Normas Regulamentadoras do Ministério do Trabalho e Emprego e, na ausência de limites na NR-15,
  utilizam-se critérios técnicos da ACGIH (TLV-TWA, TLV-STEL e TLV-C).</p>`;
}

function parteII(d: PgrData): string {
  // Matriz P×S
  const headerSev = SEVERIDADES.map((s) => `<th class="matrix-cell">${s.label}<br><small>(${s.peso})</small></th>`).join("");
  const matrixRows = PROBABILIDADES.map((p) => {
    const cells = SEVERIDADES.map((s) => {
      const nr = p.peso * s.peso;
      const z = zonaDecisao(nr);
      return `<td class="matrix-cell" style="background:${z.color}">${nr}</td>`;
    }).join("");
    return `<tr><th style="background:${PRIMARY}">${p.label} (${p.peso})</th>${cells}</tr>`;
  }).join("");

  return `
  <h2>2. PARTE II — ANTECIPAÇÃO, RECONHECIMENTO E AVALIAÇÃO DOS RISCOS</h2>

  <h3>2.1 Antecipação</h3>
  <p>A antecipação visa identificar riscos potenciais. As informações consideradas para a elaboração ou
  revisão do PGR originam-se de projetos de novas instalações, modificações de projetos e manipulação de
  novos produtos químicos, prevendo, sempre que possível, medidas de redução e controle já na fase de
  projeto, bem como os recursos necessários para o monitoramento das exposições.</p>

  <h3>2.2 Reconhecimento dos Riscos Ambientais</h3>
  <p>O reconhecimento é realizado por meio de inspeções e auditorias nas diversas áreas e locais da
  empresa, consolidando as constatações técnicas, considerando a percepção dos trabalhadores sobre o
  processo produtivo, os registros da CIPA e demais subsídios técnicos. Visa o registro e a avaliação das
  possíveis interferências na saúde e integridade física do trabalhador em razão da exposição aos riscos
  ambientais da área e das atividades realizadas no posto de trabalho.</p>

  <h3>2.3 Avaliação dos Riscos Ambientais</h3>
  <p>A avaliação é realizada após a antecipação e o reconhecimento do agente, da fonte geradora, do GHE/GSE,
  da função e atividade, das medidas de controle existentes e das propostas. Apenas o resultado das
  avaliações é inserido no Inventário de Riscos (NR-09.4.3).</p>

  <h3>2.4 Matriz de Risco do PGR</h3>
  <p>A classificação de risco é obtida pela interação entre <b>Probabilidade (P)</b> e <b>Severidade (S)</b>,
  conforme a Matriz de Risco da NR-01 (item 1.5.7.3): <b>Nível de Risco (NR) = P × S</b>.</p>
  <table>
    <tr><th style="background:${ACCENT}">P ↓ / S →</th>${headerSev}</tr>
    ${matrixRows}
  </table>
  <table class="legend">
    <tr><th>Nível de Risco (NR)</th><th>Zona de Decisão</th><th>Tratamento no Plano de Ação</th></tr>
    <tr><td style="background:#16a34a;color:#fff">NR ≤ 4</td><td>Tolerável</td><td>Manter controles existentes</td></tr>
    <tr><td style="background:#ca8a04;color:#fff">4 &lt; NR ≤ 8</td><td>Significativo</td><td>Avaliar necessidade de novos controles</td></tr>
    <tr><td style="background:#ea580c;color:#fff">8 &lt; NR ≤ 16</td><td>Sério</td><td>Implementar novos controles</td></tr>
    <tr><td style="background:#b91c1c;color:#fff">NR &gt; 16</td><td>Intolerável</td><td>Paralisar atividade</td></tr>
  </table>`;
}

function parteIII(): string {
  return `
  <h2>3. PARTE III — AVALIAÇÃO QUANTITATIVA DOS RISCOS</h2>
  <h3>3.1 Objetivos e Critérios</h3>
  <p>As determinações quantitativas dimensionam a exposição dos trabalhadores e subsidiam o equacionamento
  das medidas de controle. Serão priorizadas as atividades com grau de exposição alto e muito alto, com
  contato direto com agentes mais agressivos e com limites de exposição para curta duração (STEL) e valor
  teto (VT). A quantificação deve ser feita com equipamentos calibrados e metodologias validadas.</p>
  <h4>3.1.1 Agentes Químicos</h4>
  <p>Os métodos de coleta e determinação analítica baseiam-se, sempre que possível, nas NHO da
  FUNDACENTRO, NIOSH ou OSHA, com número de amostragens representativo para tratamento estatístico.</p>
  <h4>3.1.2 Agentes Físicos (Ruído e Vibração)</h4>
  <p>O ruído é avaliado por dosímetro e medidor de pressão sonora, adotando-se os limites do Quadro Anexo I
  da NR-15 e os procedimentos da NHO-01 da FUNDACENTRO. A vibração é avaliada por medidores integradores e
  transdutores triaxiais; na ausência de limites na NR-15/ISO 5349, utilizam-se os limites da ACGIH.</p>
  <h4>3.1.3 Agentes Biológicos e Ergonômicos</h4>
  <p>Os agentes biológicos compreendem microrganismos presentes no ambiente capazes de produzir doenças.
  Os fatores ergonômicos abrangem esforço físico intenso, levantamento e transporte manual de peso,
  exigência de postura inadequada, monotonia e repetitividade.</p>

  <h3>3.2 Medidas de Controle</h3>
  <p>As medidas de controle devem ser adotadas para eliminar, minimizar ou controlar os riscos sempre que
  identificado risco potencial ou evidente à saúde, quando os resultados quantitativos excederem os limites
  da norma de referência ou quando o controle médico caracterizar nexo entre danos à saúde e a situação de
  trabalho.</p>
  <h3>3.3 Priorização das Medidas de Controle</h3>
  <p>Sempre que possível, priorizam-se medidas de caráter coletivo, obedecendo à hierarquia: eliminação ou
  redução da utilização/formação de agentes prejudiciais; prevenção da liberação ou disseminação dos
  agentes; redução dos níveis ou concentração no ambiente. O uso de EPI é adotado quando as medidas
  coletivas não puderem ser implementadas de imediato, desde que tecnicamente adequado ao risco.</p>
  <h3>3.4 Registro, Monitoramento e Divulgação</h3>
  <p>O histórico das atualizações do PGR é mantido por período mínimo de 20 anos (NR-1.5.7.3.3.1). O
  Documento Base é apresentado à CIPA e anexado ao livro de atas. O PGR é revisado sempre que houver
  alteração nas instalações ou, no mínimo, anualmente. Os dados são divulgados por treinamentos, reuniões
  setoriais, reuniões de CIPA, boletins internos e integração de novos empregados.</p>`;
}

const TIPO_RISCO_ORDER = ["Físico","Químico","Biológico","Ergonômico","Acidente","Psicossocial","Outro"];

function inventarioTable(d: PgrData): string {
  const items = d.inventario ?? [];
  if (items.length === 0) {
    return `<p><i>Inventário de riscos ainda não preenchido. Inclua os fatores de risco identificados
    (perigo, agravos, fontes/causas, controles existentes, população exposta, probabilidade e severidade)
    na tela de edição do PGR.</i></p>`;
  }

  // Group by tipoRisco for organized presentation (NR-01 standard)
  const groups = new Map<string, InventarioRow[]>();
  for (const it of items) {
    const tipo = it.tipoRisco || "Outro";
    if (!groups.has(tipo)) groups.set(tipo, []);
    groups.get(tipo)!.push(it);
  }
  // Sort groups by canonical order
  const sortedGroups: [string, InventarioRow[]][] = [];
  for (const tipo of TIPO_RISCO_ORDER) {
    if (groups.has(tipo)) sortedGroups.push([tipo, groups.get(tipo)!]);
  }
  for (const [tipo, rows] of groups) {
    if (!TIPO_RISCO_ORDER.includes(tipo)) sortedGroups.push([tipo, rows]);
  }

  let counter = 0;
  let html = "";
  for (const [tipo, groupItems] of sortedGroups) {
    html += `<h4 style="margin-top:10px;color:#1e3a5f">▸ Grupo: ${esc(tipo)}</h4>`;
    const rows = groupItems.map((it) => {
      counter++;
      const p = probPeso(it.probabilidade);
      const s = sevPeso(it.severidade);
      const nr = p * s;
      const z = zonaDecisao(nr);
      return `<tr>
        <td style="text-align:center">${counter}</td>
        <td><b>${esc(it.fator)}</b>${it.postoTrabalho ? `<br><small style="color:#64748b">Posto: ${esc(it.postoTrabalho)}</small>` : ""}${it.funcoes ? `<br><small style="color:#64748b">Funções: ${esc(it.funcoes)}</small>` : ""}</td>
        <td>${esc(it.agravos || "—")}</td>
        <td>${esc(it.causas || "—")}</td>
        <td>${esc(it.controles || "—")}${it.eficaciaControles ? ` <span style="color:#64748b;font-size:7.5pt">(${esc(it.eficaciaControles)})</span>` : ""}</td>
        <td>${esc(it.populacao || it.areaImpacto || "—")}</td>
        <td style="text-align:center">${esc(it.tipoAvaliacao || "Qualitativa")}</td>
        <td style="text-align:center">${p}</td>
        <td style="text-align:center">${s}</td>
        <td class="matrix-cell" style="background:${z.color};text-align:center">${nr}</td>
        <td style="text-align:center;color:${z.color};font-weight:700">${z.zona}</td>
        <td>${esc(it.acoes || z.tratamento)}${it.responsavel ? `<br><small style="color:#64748b">Resp: ${esc(it.responsavel)}</small>` : ""}${it.prazo ? `<br><small style="color:#64748b">Prazo: ${esc(it.prazo)}</small>` : ""}</td>
      </tr>`;
    }).join("");
    html += `<table>
      <tr>
        <th style="width:28px">#</th><th>Fator / Posto / Funções</th><th>Agravos</th><th>Causas / Fontes</th>
        <th>Controle (Eficácia)</th><th>Pop. Exposta / Área</th><th>Avaliação</th>
        <th>P</th><th>S</th><th>NR</th><th>Zona</th><th>Ações / Responsável / Prazo</th>
      </tr>
      ${rows}
    </table>`;
  }
  return html;
}

function gseEpcEpiSection(d: PgrData): string {
  const gse = d.gseGrupos ?? [];
  const epc = d.epcItens ?? [];
  const epi = d.epiItens ?? [];
  let out = "";

  if (gse.length > 0) {
    const rows = gse.map((g, i) => `<tr>
      <td>${i+1}</td><td><b>${esc(g.grupo)}</b></td>
      <td>${esc(g.funcoes || "—")}</td>
      <td>${esc(g.atividades || "—")}</td>
      <td style="text-align:center">${esc(g.num ?? "—")}</td>
      <td>${esc(g.local || "—")}</td>
      <td>${esc(g.horario || "—")}</td>
    </tr>`).join("");
    out += `<h3>Grupos Similares de Exposição (GSE)</h3>
    <table><tr><th>#</th><th>Grupo</th><th>Funções</th><th>Atividades</th><th>Nº Trab.</th><th>Local</th><th>Horário</th></tr>${rows}</table>`;
  }

  if (epc.length > 0) {
    const rows = epc.map((e, i) => `<tr><td>${i+1}</td><td><b>${esc(e.descricao)}</b></td><td>${esc(e.aplicacao || "—")}</td></tr>`).join("");
    out += `<h3>EPC — Equipamentos de Proteção Coletiva</h3>
    <table><tr><th>#</th><th>Equipamento</th><th>Aplicação / Local</th></tr>${rows}</table>`;
  }

  if (epi.length > 0) {
    const rows = epi.map((e, i) => `<tr>
      <td>${i+1}</td><td><b>${esc(e.descricao)}</b></td>
      <td>${esc(e.ca || "—")}</td><td>${esc(e.aplicacao || "—")}</td>
      <td>${esc(e.validade || "—")}</td><td>${esc(e.periodicidade || "—")}</td>
    </tr>`).join("");
    out += `<h3>EPI — Equipamentos de Proteção Individual</h3>
    <table><tr><th>#</th><th>EPI</th><th>CA</th><th>Aplicação</th><th>Validade CA</th><th>Troca (meses)</th></tr>${rows}</table>`;
  }

  return out;
}

function identificacao(d: PgrData): string {
  const contratante = d.contratanteAtivo ? `
    <h3>Identificação da Empresa Contratante</h3>
    <table class="id-table">
      <tr><td>Razão Social</td><td>${esc(d.contratanteRazao)}</td></tr>
      <tr><td>CNPJ</td><td>${esc(d.contratanteCnpj)}</td></tr>
      <tr><td>Endereço</td><td>${esc(d.contratanteEndereco)}</td></tr>
      <tr><td>Atividade Principal (CNAE)</td><td>${esc(d.contratanteAtividade)}</td></tr>
      <tr><td>Grau de Risco</td><td>${esc(d.contratanteGrauRisco)}</td></tr>
      <tr><td>Contato</td><td>${esc(d.contratanteContato)}</td></tr>
      <tr><td>E-mail</td><td>${esc(d.contratanteEmail)}</td></tr>
    </table>` : "";

  return `
  <h2>Identificação da Empresa</h2>
  <h3>Identificação da Empresa Contratada</h3>
  <table class="id-table">
    <tr><td>Razão Social</td><td>${esc(d.razaoSocial)}</td></tr>
    <tr><td>Nome Fantasia</td><td>${esc(d.nomeFantasia)}</td></tr>
    <tr><td>CNPJ</td><td>${esc(d.cnpj)}</td></tr>
    <tr><td>Endereço</td><td>${multiline(d.endereco)}</td></tr>
    <tr><td>Atividade Principal (CNAE)</td><td>${esc(d.atividadePrincipal)}</td></tr>
    <tr><td>Grau de Risco</td><td>${esc(d.grauRisco)}</td></tr>
    <tr><td>Contato</td><td>${esc(d.contato)}</td></tr>
    <tr><td>E-mail</td><td>${esc(d.email)}</td></tr>
    <tr><td>Nº de Funcionários</td><td>${esc(d.numFuncionarios)}</td></tr>
    <tr><td>Objeto do Contrato</td><td>${multiline(d.objetoContrato)}</td></tr>
    <tr><td>Horários de Trabalho</td><td>${multiline(d.horariosTrabalho)}</td></tr>
    <tr><td>Vigência do Programa</td><td>${fmtDate(d.vigenciaInicio)} a ${fmtDate(d.vigenciaFim)}</td></tr>
  </table>
  ${contratante}`;
}

function regimeEGhe(d: PgrData): string {
  const ghe = d.gheFuncoes ?? [];
  const gheRows = ghe.length
    ? ghe.map((g) => `<tr><td><b>${esc(g.funcao)}</b></td><td>${esc(g.descricao || "—")}</td><td style="text-align:center">${esc(g.num ?? "—")}</td></tr>`).join("")
    : `<tr><td colspan="3"><i>Nenhuma função/GHE cadastrada.</i></td></tr>`;
  return `
  <h2>Regime de Trabalho</h2>
  <p>${d.regimeTrabalho ? multiline(d.regimeTrabalho) : "Regime de trabalho conforme contrato e jornada definida pela empresa."}</p>
  <h3>Grupos Homogêneos / Similares de Exposição (GHE / GSE)</h3>
  <table>
    <tr><th style="width:26%">Função</th><th>Descrição da Função</th><th style="width:10%">Nº</th></tr>
    ${gheRows}
  </table>`;
}

function revisaoTable(d: PgrData): string {
  const revs = (d.revisoes && d.revisoes.length) ? d.revisoes : [{ revisao: "00", motivo: "Emissão inicial", data: d.vigenciaInicio ?? null }];
  const rows = revs.map((r) => `<tr><td style="text-align:center">${esc(r.revisao)}</td><td>${esc(r.motivo)}</td><td style="text-align:center">${fmtDate(r.data)}</td></tr>`).join("");
  return `
  <h2>Histórico de Revisões</h2>
  <table>
    <tr><th style="width:14%">Revisão</th><th>Motivo da Revisão</th><th style="width:22%">Data</th></tr>
    ${rows}
  </table>`;
}


// ─── Fixed text blocks (Item 9) ──────────────────────────────────────────────
function textoFixoGRO(): string {
  return `
  <h2>Gestao Operacional do GRO</h2>
  <p>O Gerenciamento de Riscos Ocupacionais (GRO) e realizado de forma continua, preventiva e integrada, contemplando identificacao, classificacao, avaliacao, monitoramento e controle dos riscos ocupacionais existentes nos ambientes e processos de trabalho.</p>
  <p>A gestao operacional do presente PGR ocorre atraves de inspecoes periodicas, acompanhamento tecnico dos setores, atualizacao continua do inventario de riscos e implementacao das medidas preventivas necessarias.</p>
  <h3>GHE/GSE — Grupos Homogeneos e/ou Similares de Exposicao</h3>
  <p>Os Grupos Homogeneos e/ou Similares de Exposicao (GHE/GSE) foram definidos considerando funcoes exercidas, atividades executadas, similaridade operacional, ambiente de trabalho, jornada e agentes de risco existentes.</p>
  <h3>Medidas de Controle — EPC e EPI</h3>
  <p>As medidas de controle adotadas priorizam a hierarquia preventiva prevista na NR-01, contemplando inicialmente medidas de eliminacao, substituicao, controles de engenharia, medidas administrativas e complementarmente EPC e EPI.</p>
  <h3>Inventario de Riscos</h3>
  <p>O Inventario de Riscos contempla identificacao dos perigos existentes, fontes geradoras, possiveis agravos a saude, trabalhadores expostos e classificacao do risco ocupacional.</p>
  <h3>Gestao dos Riscos Psicossociais</h3>
  <p>Em conformidade com a NR-01, o presente PGR contempla identificacao, avaliacao e gerenciamento dos fatores de riscos psicossociais relacionados a organizacao do trabalho.</p>
  <h3>Plano de Acao Preventivo</h3>
  <p>O Plano de Acao Preventivo constitui ferramenta de gerenciamento continuo das medidas corretivas e preventivas necessarias para controle dos riscos ocupacionais identificados.</p>
  <h3>Monitoramento e Indicadores</h3>
  <p>O monitoramento continuo do PGR ocorre atraves de indicadores tecnicos e gerenciais relacionados a Seguranca e Saude no Trabalho.</p>
  <h3>Evidencias e Rastreabilidade</h3>
  <p>Todas as acoes preventivas, treinamentos, inspecoes e medidas corretivas permanecem registradas atraves de mecanismos de rastreabilidade documental e digital.</p>
  <h3>Integracao com PCMSO</h3>
  <p>Os riscos ocupacionais identificados encontram-se integrados ao Programa de Controle Medico de Saude Ocupacional (PCMSO).</p>
  <h3>Controle de Revisoes</h3>
  <p>O presente PGR permanece sujeito a revisao periodica sempre que houver alteracoes operacionais, estruturais ou normativas.</p>
  <h3>Gestao Digital e Rastreabilidade Sistemica</h3>
  <p>A gestao documental e operacional do presente PGR ocorre atraves de plataforma digital integrada de gerenciamento ocupacional.</p>`;
}

// ─── New section renderers ────────────────────────────────────────────────────
function caracterizacaoSetoresSection(d: PgrData): string {
  const items = (d.caracterizacaoSetores ?? []) as any[];
  if (items.length === 0) return "";
  const rows = items.map((cs: any, i: number) => `
    <tr>
      <td><b>${esc(cs.setor ?? "—")}</b></td>
      <td style="text-align:center">${esc(cs.numColaboradores ?? "—")}</td>
      <td>${esc(cs.turno ?? "—")}</td>
      <td>${esc(cs.maquinas ?? "—")}</td>
      <td>${esc(cs.produtos ?? "—")}</td>
      <td>${esc(cs.epis ?? "—")}</td>
    </tr>
    ${cs.fluxoAtividades ? `<tr><td colspan="6" style="background:#f8fafc"><small><b>Fluxo:</b> ${esc(cs.fluxoAtividades)}</small></td></tr>` : ""}
  `).join("");
  return `
  <h2>Caracterizacao Operacional dos Setores</h2>
  <p>Descricao das atividades, maquinas, produtos e EPIs de cada setor conforme item 8.3 da NR-01.</p>
  <table>
    <tr><th>Setor</th><th>Colaboradores</th><th>Turno</th><th>Maquinas/Equipamentos</th><th>Produtos/Materiais</th><th>EPIs</th></tr>
    ${rows}
  </table>`;
}

function cronogramaSection(d: PgrData): string {
  const items = (d.cronogramaPreventivo ?? []) as any[];
  if (items.length === 0) return "";
  const rows = items.map((cr: any) => `
    <tr>
      <td>${esc(cr.atividade ?? "—")}</td>
      <td>${esc(cr.tipo ?? "—")}</td>
      <td>${esc(cr.responsavel ?? "—")}</td>
      <td>${esc(cr.periodicidade ?? "—")}</td>
      <td style="text-align:center">${cr.dataExecucao ? fmtDate(cr.dataExecucao) : "—"}</td>
      <td><span style="font-size:7pt;padding:1px 4px;border-radius:3px;background:${cr.status==="Concluido"?"#dcfce7":cr.status==="Atrasado"?"#fee2e2":"#fef9c3"}">${esc(cr.status ?? "Pendente")}</span></td>
    </tr>
  `).join("");
  return `
  <h2>Cronograma Preventivo</h2>
  <p>Inspecoes, treinamentos, campanhas de saude e auditorias com datas e responsaveis.</p>
  <table>
    <tr><th>Atividade</th><th>Tipo</th><th>Responsavel</th><th>Periodicidade</th><th>Data</th><th>Status</th></tr>
    ${rows}
  </table>
  <p style="font-size:7.5pt"><i>As acoes preventivas previstas neste PGR encontram-se organizadas atraves de cronograma anual de implementacao.</i></p>`;
}

function hierarquiaControleSection(d: PgrData): string {
  const items = (d.hierarquiaControle ?? []) as any[];
  if (items.length === 0) return "";
  const rows = items.map((hr: any) => `
    <tr>
      <td><b>${esc(hr.risco ?? "—")}</b></td>
      <td>${esc(hr.eliminacao ?? "—")}</td>
      <td>${esc(hr.substituicao ?? "—")}</td>
      <td>${esc(hr.engenharia ?? "—")}</td>
      <td>${esc(hr.administrativo ?? "—")}</td>
      <td>${esc(hr.epc ?? "—")}</td>
      <td>${esc(hr.epi ?? "—")}</td>
      <td>${esc(hr.responsavel ?? "—")}</td>
      <td style="text-align:center">${hr.prazo ? fmtDate(hr.prazo) : "—"}</td>
    </tr>
  `).join("");
  return `
  <h2>Hierarquia de Controle</h2>
  <p>As medidas preventivas definidas neste PGR observam a hierarquia de controle prevista nas Normas Regulamentadoras: eliminacao &gt; substituicao &gt; engenharia &gt; administrativo &gt; EPC &gt; EPI.</p>
  <table>
    <tr><th>Risco</th><th>1.Eliminacao</th><th>2.Substituicao</th><th>3.Engenharia</th><th>4.Administrativo</th><th>5.EPC</th><th>6.EPI</th><th>Responsavel</th><th>Prazo</th></tr>
    ${rows}
  </table>`;
}

function naoConformidadesSection(d: PgrData): string {
  const items = (d.naoConformidades ?? []) as any[];
  if (items.length === 0) return "";
  const rows = items.map((nc: any) => `
    <tr>
      <td>${esc(nc.descricao ?? "—")}</td>
      <td>${esc(nc.setor ?? "—")}</td>
      <td style="text-align:center">${nc.dataIdentificacao ? fmtDate(nc.dataIdentificacao) : "—"}</td>
      <td>${esc(nc.tipo ?? "—")}</td>
      <td style="text-align:center"><span style="font-size:7pt;padding:1px 4px;border-radius:3px;background:${nc.gravidade==="critica"?"#fecaca":nc.gravidade==="alta"?"#fed7aa":nc.gravidade==="media"?"#fef9c3":"#dcfce7"}">${esc(nc.gravidade ?? "—")}</span></td>
      <td>${esc(nc.acaoCorretiva ?? "—")}</td>
      <td>${esc(nc.responsavel ?? "—")}</td>
      <td style="text-align:center">${nc.prazo ? fmtDate(nc.prazo) : "—"}</td>
    </tr>
  `).join("");
  return `
  <h2>Nao Conformidades</h2>
  <p>Desvios identificados, acoes corretivas, responsaveis e prazos de encerramento.</p>
  <table>
    <tr><th>Descricao</th><th>Setor</th><th>Identificado</th><th>Tipo</th><th>Gravidade</th><th>Acao Corretiva</th><th>Responsavel</th><th>Prazo</th></tr>
    ${rows}
  </table>`;
}

function treinamentosNrSection(d: PgrData): string {
  const items = (d.treinamentosNr ?? []) as any[];
  if (items.length === 0) return "";
  const rows = items.map((tr: any) => `
    <tr>
      <td><b>${esc(tr.nr ?? "—")}</b></td>
      <td>${esc(tr.treinamento ?? "—")}</td>
      <td style="text-align:center">${esc(tr.cargaHoraria ?? "—")}h</td>
      <td>${esc(tr.periodicidade ?? "—")}</td>
      <td>${esc(tr.publicoAlvo ?? "—")}</td>
      <td>${esc(tr.responsavel ?? "—")}</td>
      <td style="text-align:center">${tr.dataRealizada ? fmtDate(tr.dataRealizada) : "—"}</td>
      <td style="text-align:center">${tr.dataVencimento ? fmtDate(tr.dataVencimento) : "—"}</td>
    </tr>
  `).join("");
  return `
  <h2>Treinamentos Obrigatorios por NR</h2>
  <p>Os trabalhadores expostos aos riscos ocupacionais identificados deverao receber treinamentos compativeis com as atividades executadas, conforme normas regulamentadoras aplicaveis.</p>
  <table>
    <tr><th>NR</th><th>Treinamento</th><th>C.H.</th><th>Periodicidade</th><th>Publico-Alvo</th><th>Responsavel</th><th>Realizado</th><th>Vencimento</th></tr>
    ${rows}
  </table>`;
}

// Renderiza a seção "Grupos Similares de Exposição (GSE) — Modelo NR-01" a partir
// das tabelas relacionais novas (Sprint 1 PGR Inteligente). Cada GSE vira sub-seção
// com cargos / setores / riscos / EPC / EPI / ações 5W2H / treinamentos / evidências.
function gseGroupsSection(d: PgrData): string {
  const groups = d.gseGroups ?? [];
  if (groups.length === 0) return "";

  const tipoLabel: Record<string, string> = {
    fisico: "Físico", quimico: "Químico", biologico: "Biológico",
    ergonomico: "Ergonômico", acidente: "Acidente", psicossocial: "Psicossocial",
  };
  const sevColor = (n: string) => {
    const v = String(n || "").toLowerCase();
    if (v === "critica" || v === "critico") return "#b91c1c";
    if (v === "alta"    || v === "alto")    return "#ea580c";
    if (v === "media"   || v === "medio")   return "#ca8a04";
    return "#16a34a";
  };

  const groupHtml = groups.map((g, idx) => {
    const riscosRows = g.riscos.map((r) => `
      <tr>
        <td><b>${esc(tipoLabel[r.tipo] || r.tipo)}</b></td>
        <td>${esc(r.agente)}</td>
        <td>${esc(r.fonteGeradora || "—")}</td>
        <td>${esc(r.possivelDano || "—")}</td>
        <td>${esc(r.tipoExposicao || "—")}</td>
        <td style="text-align:center;color:#fff;background:${sevColor(r.severidade)};font-size:7.5pt;padding:2px 4px;border-radius:3px">${esc(r.severidade)}</td>
        <td style="text-align:center;color:#fff;background:${sevColor(r.probabilidade)};font-size:7.5pt;padding:2px 4px;border-radius:3px">${esc(r.probabilidade)}</td>
        <td style="text-align:center;color:#fff;background:${sevColor(r.riscoFinal)};font-size:7.5pt;padding:2px 4px;border-radius:3px"><b>${esc(r.riscoFinal)}</b></td>
      </tr>`).join("");

    const epcRows = g.epc.map((x) => `<tr><td>${esc(x.descricao)}</td><td>${esc(x.aplicacao || "—")}</td></tr>`).join("");
    const epiRows = g.epi.map((x) => `<tr><td>${esc(x.descricao)}</td><td style="text-align:center">${esc(x.ca || "—")}</td><td>${esc(x.aplicacao || "—")}</td><td style="text-align:center">${esc(x.validade || "—")}</td></tr>`).join("");

    const acoesRows = g.acoes.map((a) => `
      <tr>
        <td><b>${esc(a.what)}</b>${a.why ? `<br><small class="muted">${esc(a.why)}</small>` : ""}</td>
        <td>${esc(a.where || "—")}</td>
        <td>${esc(a.who || "—")}</td>
        <td style="text-align:center">${esc(a.whenStart || "—")} → ${esc(a.whenEnd || "—")}</td>
        <td>${esc(a.how || "—")}</td>
        <td style="text-align:center">${esc(a.howMuch || "—")}</td>
        <td style="text-align:center;color:#fff;background:${sevColor(a.priority)};font-size:7.5pt;padding:2px 4px;border-radius:3px">${esc(a.priority)}</td>
        <td style="text-align:center">${esc(a.status)}</td>
      </tr>`).join("");

    const treinRows = g.treinamentos.map((t) =>
      `<tr><td><b>${esc(t.nrCode)}</b></td><td>${esc(t.nome)}</td><td style="text-align:center">${t.cargaHoraria ?? "—"}h</td><td style="text-align:center">${t.obrigatorio ? "Sim" : "Não"}</td></tr>`).join("");

    const evidRows = g.evidencias.map((e) =>
      `<tr><td>${esc(e.tipo)}</td><td>${esc(e.titulo || "—")}</td><td>${esc(e.descricao || "—")}</td><td>${e.fileUrl ? `<a href="${esc(e.fileUrl)}">link</a>` : "—"}</td></tr>`).join("");

    return `
    <h3>GSE ${String(idx + 1).padStart(2, "0")} — ${esc(g.nome)}
      ${g.aiSuggested ? `<span style="font-size:7pt;background:#ede9fe;color:#6d28d9;padding:1px 4px;border-radius:3px;margin-left:6px">IA</span>` : ""}
      ${g.migratedFromLegacy ? `<span style="font-size:7pt;background:#fef3c7;color:#92400e;padding:1px 4px;border-radius:3px;margin-left:6px">migrado</span>` : ""}
    </h3>
    ${g.descricao ? `<p>${esc(g.descricao)}</p>` : ""}
    <table style="font-size:9pt">
      <tr><th style="width:30%">Item</th><th>Descrição</th></tr>
      <tr><td>Cargos</td><td>${g.cargos.length ? g.cargos.map(esc).join(", ") : "<i>nenhum</i>"}</td></tr>
      <tr><td>Setores</td><td>${g.setores.length ? g.setores.map((s) => esc(s.name) + (s.branchName ? ` <small class="muted">(${esc(s.branchName)})</small>` : "")).join(", ") : "<i>nenhum vinculado</i>"}</td></tr>
      <tr><td>Trabalhadores expostos</td><td>${g.numTrabalhadores ?? 0}${g.numHomens != null || g.numMulheres != null ? ` (H: ${g.numHomens ?? 0} · M: ${g.numMulheres ?? 0})` : ""}</td></tr>
    </table>

    ${riscosRows ? `
    <h4>Inventário de riscos do GSE</h4>
    <table style="font-size:8.5pt">
      <tr><th>Tipo</th><th>Agente</th><th>Fonte geradora</th><th>Possível dano</th><th>Tipo exposição</th><th>Sev.</th><th>Prob.</th><th>Risco</th></tr>
      ${riscosRows}
    </table>` : `<p><small class="muted"><i>Nenhum risco inventariado neste GSE.</i></small></p>`}

    ${epcRows ? `<h4>EPC — Equipamentos de Proteção Coletiva</h4>
    <table style="font-size:9pt"><tr><th>Descrição</th><th>Aplicação</th></tr>${epcRows}</table>` : ""}

    ${epiRows ? `<h4>EPI — Equipamentos de Proteção Individual</h4>
    <table style="font-size:9pt"><tr><th>Descrição</th><th>CA</th><th>Aplicação</th><th>Validade</th></tr>${epiRows}</table>` : ""}

    ${acoesRows ? `<h4>Plano de Ação (5W2H)</h4>
    <table style="font-size:8pt">
      <tr><th>O que (Why)</th><th>Onde</th><th>Quem</th><th>Quando</th><th>Como</th><th>Quanto</th><th>Pri.</th><th>Status</th></tr>
      ${acoesRows}
    </table>` : ""}

    ${treinRows ? `<h4>Treinamentos obrigatórios</h4>
    <table style="font-size:9pt"><tr><th>NR</th><th>Treinamento</th><th>C.H.</th><th>Obrigatório</th></tr>${treinRows}</table>` : ""}

    ${evidRows ? `<h4>Evidências</h4>
    <table style="font-size:9pt"><tr><th>Tipo</th><th>Título</th><th>Descrição</th><th>Arquivo</th></tr>${evidRows}</table>` : ""}
    `;
  }).join('<div style="margin:6mm 0;border-top:1px dashed #cbd5e1"></div>');

  return `
  <h2>Grupos Similares de Exposição (GSE) — Modelo NR-01</h2>
  <p>A análise de riscos deste PGR é estruturada por <b>Grupos Similares de Exposição (GSE)</b>,
  conforme a NR-01. Cada GSE concentra cargos, setores, inventário de riscos, EPC, EPI, plano de ação
  (5W2H), treinamentos obrigatórios e evidências documentais.</p>
  ${groupHtml}`;
}

// ─── Sumário (TOC) ───────────────────────────────────────────────────────────
// Lista as seções que de fato serão renderizadas, na MESMA ordem do corpo,
// numerando dinamicamente. Sem números de página (PDF gerado a partir de HTML
// sem paginação determinística), mas com ancoragem semântica clara.
function renderSumarioPgr(d: PgrData): string {
  const usaCustom = !!(d.textoIntroducao && d.textoIntroducao.trim());
  const items: string[] = [];
  items.push("Identificação da Empresa");
  items.push("Regime de Trabalho");
  items.push("Histórico de Revisões");
  if (d.gseGroups && d.gseGroups.length > 0) {
    items.push(`Grupos Similares de Exposição (GSE) — ${d.gseGroups.length} grupo(s)`);
  }
  if (usaCustom) {
    items.push("Introdução");
    items.push("Inventário de Riscos do PGR");
  } else {
    items.push("PARTE I — Disposição Geral");
    items.push("PARTE II — Antecipação, Reconhecimento e Avaliação dos Riscos");
    items.push("PARTE III — Avaliação Quantitativa dos Riscos");
    items.push("PARTE IV — Inventário de Riscos do PGR");
    items.push("Gestão Operacional do GRO");
  }
  if (caracterizacaoSetoresSection(d)) items.push("Caracterização Operacional dos Setores");
  if (cronogramaSection(d)) items.push("Cronograma Preventivo");
  if (hierarquiaControleSection(d)) items.push("Hierarquia de Controle");
  if (naoConformidadesSection(d)) items.push("Não Conformidades");
  if (treinamentosNrSection(d)) items.push("Treinamentos Obrigatórios por NR");
  if (d.textoConclusao && d.textoConclusao.trim()) items.push("Conclusão Técnica");
  items.push("Responsabilidade Técnica");

  const rows = items.map((label, i) => `
    <tr>
      <td style="width:8mm;text-align:right;color:${ACCENT};font-weight:700">${i + 1}.</td>
      <td style="padding-left:4mm">${esc(label)}</td>
    </tr>`).join("");

  return `
  <div class="section" style="page-break-inside:avoid">
    <h2>Sumário</h2>
    <p class="muted" style="font-size:9pt;margin-top:-4px">
      Conteúdo do relatório na ordem em que aparece a seguir.
    </p>
    <table style="border:none;margin-top:8mm">
      <colgroup><col style="width:8mm"><col></colgroup>
      <tbody>${rows}</tbody>
    </table>
    <style>
      .section table tr td { border:none !important; padding:2.5mm 2mm; }
    </style>
  </div>`;
}

export async function generatePGRPDF(d: PgrData): Promise<string> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const outPath = path.join(UPLOAD_DIR, `pgr_${d.id}.pdf`);
  const now = new Date();
  const respTec = d.respTecnicoNome
    ? `${esc(d.respTecnicoNome)}${d.respTecnicoRegistro ? ` — ${esc(d.respTecnicoRegistro)}` : ""}`
    : "Responsável Técnico (a definir)";
  const empresaNome = esc(d.razaoSocial || d.nomeFantasia || "Empresa");
  const logoTag = d.logoUrl ? `<img class="logo" src="${esc(d.logoUrl)}" alt="logo">` : `<div class="kicker">SAÚDE DO TRABALHO • CONSULTORIA</div>`;

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
  <style>${BASE_CSS}</style></head><body>

  <div class="cover">
    ${logoTag}
    <div class="title">PGR</div>
    <div class="kicker" style="letter-spacing:2px;margin-bottom:12mm">Programa de Gerenciamento de Riscos — NR-01</div>
    <div class="company">${empresaNome}</div>
    ${d.endereco ? `<div class="sub">${multiline(d.endereco)}</div>` : ""}
    ${d.obra ? `<div class="sub"><b>Obra:</b> ${multiline(d.obra)}</div>` : ""}
    <div class="validity">Vigência: ${fmtDate(d.vigenciaInicio)} a ${fmtDate(d.vigenciaFim)}</div>
  </div>
  <div class="page-break"></div>

  ${renderSumarioPgr(d)}
  <div class="page-break"></div>

  <div class="section">${identificacao(d)}</div>
  <div class="page-break"></div>

  <div class="section">${regimeEGhe(d)}</div>
  <div class="section">${revisaoTable(d)}</div>
  <div class="page-break"></div>

  ${(d.gseGroups && d.gseGroups.length > 0) ? `<div class="section">${gseGroupsSection(d)}</div><div class="page-break"></div>` : ""}

  ${d.textoIntroducao && d.textoIntroducao.trim()
    ? `<div class="section">
         <h2>1. Introdução</h2>
${renderUserText(d.textoIntroducao)}
       </div>
       <div class="page-break"></div>

       <h2>2. Inventário de Riscos do PGR</h2>
       <p><small class="muted">Antecipação, Reconhecimento e Avaliação dos Riscos — NR-01, item 1.5.7.3.</small></p>
       ${inventarioTable(d)}
       ${gseEpcEpiSection(d)}
       <div class="page-break"></div>`
    : `<div class="section">${parteI(d)}</div>
       <div class="page-break"></div>

       <div class="section">${parteII(d)}</div>
       <div class="page-break"></div>

       <div class="section">${parteIII()}</div>
       <div class="page-break"></div>

       <h2>4. PARTE IV — INVENTÁRIO DE RISCOS DO PGR</h2>
       <p><small class="muted">Antecipação, Reconhecimento e Avaliação dos Riscos — NR-01, item 1.5.7.3.</small></p>
       ${inventarioTable(d)}
       ${gseEpcEpiSection(d)}

       <div class="section">${textoFixoGRO()}</div>
       <div class="page-break"></div>`}

  ${caracterizacaoSetoresSection(d) ? `<div class="section">${caracterizacaoSetoresSection(d)}</div><div class="page-break"></div>` : ""}

  ${cronogramaSection(d) ? `<div class="section">${cronogramaSection(d)}</div><div class="page-break"></div>` : ""}

  ${hierarquiaControleSection(d) ? `<div class="section">${hierarquiaControleSection(d)}</div><div class="page-break"></div>` : ""}

  ${naoConformidadesSection(d) ? `<div class="section">${naoConformidadesSection(d)}</div><div class="page-break"></div>` : ""}

  ${treinamentosNrSection(d) ? `<div class="section">${treinamentosNrSection(d)}</div><div class="page-break"></div>` : ""}

  ${d.textoConclusao && d.textoConclusao.trim()
    ? `<div class="section">
         <h2>Conclusão Técnica</h2>
${renderUserText(d.textoConclusao)}
       </div>
       <div class="page-break"></div>`
    : ""}

  <h2>5. Responsabilidade Técnica</h2>
  <p>Este Programa de Gerenciamento de Riscos foi elaborado sob responsabilidade técnica de
  <b>${respTec}</b>, em conformidade com as disposições da NR-01 (Portaria MTP nº 1.419/2024).</p>
  <table>
    <tr><th style="width:35%">Item</th><th>Dados do Responsável Técnico</th></tr>
    <tr><td>Nome</td><td><b>${esc(d.respTecnicoNome || "—")}</b></td></tr>
    <tr><td>Registro profissional</td><td>${esc(d.respTecnicoRegistro || "—")}</td></tr>
    ${d.respTecnicoProfissao ? `<tr><td>Profissão / Especialidade</td><td>${esc(d.respTecnicoProfissao)}</td></tr>` : ""}
    ${d.respTecnicoArt ? `<tr><td>ART / RRT</td><td>${esc(d.respTecnicoArt)}</td></tr>` : ""}
    ${d.respTecnicoEmpresa ? `<tr><td>Empresa elaboradora</td><td>${esc(d.respTecnicoEmpresa)}</td></tr>` : ""}
    ${d.respTecnicoValidadeAte ? `<tr><td>Validade da responsabilidade técnica</td><td>${fmtDate(d.respTecnicoValidadeAte)}</td></tr>` : ""}
    <tr><td>Data de emissão</td><td>${esc(now.toLocaleDateString("pt-BR"))}</td></tr>
  </table>
  <div class="signature">
    ${d.respTecnicoAssinaturaUrl ? `<img src="${esc(d.respTecnicoAssinaturaUrl)}" alt="Assinatura" style="max-height:60px;display:block;margin:0 auto 8px;">` : '<div class="line"></div>'}
    <div style="text-align:center">${respTec}<br><small class="muted">Responsável Técnico</small></div>
  </div>

  <div class="footer-note">Emitido em ${esc(now.toLocaleDateString("pt-BR"))}</div>
  </body></html>`;

  await renderPDF(html, outPath);
  return `/uploads/pgr_pdfs/pgr_${d.id}.pdf`;
}

/**
 * Sprint 1.7-B item 2 — Concatena os anexos (PDFs e imagens) ao final do PGR.
 *
 * Lê o PDF base do disco, adiciona uma página-capa "ANEXOS", e concatena cada
 * arquivo anexado: PDFs são copiados página-por-página, imagens são embed em
 * uma nova página A4. Falhas de leitura/parse de um anexo individual NÃO derrubam
 * o PGR — só pula o arquivo problemático.
 *
 * @param pdfDiskPath caminho absoluto do PGR base em disco
 * @param attachments lista vinda da BD (pgr_attachments) com fileUrl + mimeType + titulo
 */
export async function appendPdfAttachments(
  pdfDiskPath: string,
  attachments: Array<{ fileUrl: string | null; mimeType: string | null; titulo: string; tipo?: string }>
): Promise<{ appended: number; skipped: number }> {
  const valid = attachments.filter(a => !!a.fileUrl);
  if (valid.length === 0) return { appended: 0, skipped: 0 };

  let PDFLib: any;
  try {
    PDFLib = await import("pdf-lib");
  } catch {
    console.warn("[pgr_pdf] pdf-lib não instalado; anexos não serão concatenados.");
    return { appended: 0, skipped: valid.length };
  }
  const { PDFDocument, StandardFonts, rgb, PageSizes } = PDFLib;

  const baseBytes = await fs.readFile(pdfDiskPath);
  const base = await PDFDocument.load(baseBytes);
  const font = await base.embedFont(StandardFonts.Helvetica);
  const fontBold = await base.embedFont(StandardFonts.HelveticaBold);

  // Capa "ANEXOS"
  const cover = base.addPage(PageSizes.A4);
  const cw = cover.getWidth(), ch = cover.getHeight();
  cover.drawRectangle({ x: 0, y: ch - 30, width: cw, height: 30, color: rgb(0.118, 0.227, 0.373) }); // PRIMARY
  cover.drawText("ANEXOS", { x: cw / 2 - 80, y: ch / 2 + 60, size: 48, font: fontBold, color: rgb(0.118, 0.227, 0.373) });
  cover.drawText(`${valid.length} documento(s) anexado(s) a este PGR`, {
    x: 70, y: ch / 2 + 20, size: 12, font, color: rgb(0.3, 0.3, 0.3),
  });
  let yList = ch / 2 - 30;
  for (let i = 0; i < valid.length && yList > 60; i++) {
    const a = valid[i];
    cover.drawText(`${i + 1}.`, { x: 60, y: yList, size: 11, font: fontBold, color: rgb(0.04, 0.65, 0.91) });
    cover.drawText(safeAscii(a.titulo).slice(0, 80), { x: 80, y: yList, size: 11, font, color: rgb(0.1, 0.1, 0.1) });
    if (a.tipo) cover.drawText(`(${safeAscii(a.tipo)})`, { x: 80 + Math.min(a.titulo.length, 80) * 5.5 + 6, y: yList, size: 9, font, color: rgb(0.45, 0.45, 0.45) });
    yList -= 18;
  }

  let appended = 0, skipped = 0;
  for (const a of valid) {
    try {
      const localPath = resolveLocalPath(a.fileUrl!);
      const buf = await fs.readFile(localPath);
      const mime = (a.mimeType ?? "").toLowerCase();
      if (mime.includes("pdf") || localPath.toLowerCase().endsWith(".pdf")) {
        const src = await PDFDocument.load(buf, { ignoreEncryption: true });
        const pages = await base.copyPages(src, src.getPageIndices());
        for (const p of pages) base.addPage(p);
        appended++;
      } else if (mime.includes("png") || mime.includes("jpg") || mime.includes("jpeg") || /\.(png|jpe?g)$/i.test(localPath)) {
        const img = (mime.includes("png") || /\.png$/i.test(localPath))
          ? await base.embedPng(buf)
          : await base.embedJpg(buf);
        const page = base.addPage(PageSizes.A4);
        const W = page.getWidth(), H = page.getHeight();
        const margin = 36;
        const maxW = W - 2 * margin, maxH = H - 2 * margin - 40;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = img.width * scale, h = img.height * scale;
        page.drawText(safeAscii(a.titulo).slice(0, 90), {
          x: margin, y: H - margin, size: 10, font: fontBold, color: rgb(0.118, 0.227, 0.373),
        });
        page.drawImage(img, { x: (W - w) / 2, y: (H - h) / 2 - 10, width: w, height: h });
        appended++;
      } else {
        skipped++;
      }
    } catch (err: any) {
      console.warn(`[pgr_pdf] anexo "${a.titulo}" falhou:`, err?.message ?? err);
      skipped++;
    }
  }

  const out = await base.save();
  await fs.writeFile(pdfDiskPath, out);
  return { appended, skipped };
}

// pdf-lib WinAnsi não suporta vários caracteres unicode (acentos exóticos, emojis).
// Reduz para ASCII tolerável; aspectos visuais bonitos ficam no HTML do PGR principal.
function safeAscii(s: string): string {
  return (s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E]/g, "?");
}

function resolveLocalPath(fileUrl: string): string {
  if (fileUrl.startsWith("/")) return path.join("/var/www/saudedotrabalho", fileUrl);
  if (/^https?:\/\//.test(fileUrl)) {
    // URLs externas não suportadas — tenta extrair pathname assumindo mesma origem
    try {
      const u = new URL(fileUrl);
      return path.join("/var/www/saudedotrabalho", u.pathname);
    } catch { return fileUrl; }
  }
  return path.join("/var/www/saudedotrabalho", fileUrl);
}
