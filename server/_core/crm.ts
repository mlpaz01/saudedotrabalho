/**
 * SP13 — Módulo CRM / Financeiro / Contratos (Bruno round 3 grande pacote).
 *
 * Tabelas:
 *  - commercial_proposals    — propostas comerciais com cálculo automático
 *  - crm_pipeline_logs       — histórico de mudanças de status
 *  - commercial_partners     — parceiros (Humberto, Valéria etc) + % comissão
 *  - client_partner_links    — vínculo empresa↔parceiro pra cálculo de comissão
 *  - financial_receivables   — recebimentos (mensalidade/anuidade)
 *  - financial_commissions   — comissões calculadas automaticamente
 *  - contracts               — repositório de contratos (PDF + metadata)
 *  - contract_versions       — aditivos / versões
 *
 * Roda em modo "foundation MVP": cadastros + cálculos + PDFs básicos.
 * Integrações fiscais e bancárias ficam pra fases futuras (item #14, #15 do escopo).
 */
import { getDb } from "../db";
import { sql as drzSql } from "drizzle-orm";

let _ddlDone = false;
export async function ensureCrmTables() {
  if (_ddlDone) return;
  const db = await getDb();
  if (!db) return;
  try {
    // Propostas
    await db.execute(drzSql`CREATE TABLE IF NOT EXISTS commercial_proposals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      razao_social VARCHAR(255), nome_fantasia VARCHAR(255),
      cnpj VARCHAR(20), responsavel VARCHAR(160), cargo VARCHAR(120),
      email VARCHAR(160), telefone VARCHAR(40), segmento VARCHAR(120),
      qtd_colaboradores INT DEFAULT 0,
      plano VARCHAR(60) DEFAULT 'starter',
      valor_mensal DECIMAL(12,2) DEFAULT 0,
      valor_anual DECIMAL(12,2) DEFAULT 0,
      desconto_pct DECIMAL(5,2) DEFAULT 0,
      valor_total DECIMAL(12,2) DEFAULT 0,
      validade_dias INT DEFAULT 15,
      status ENUM('lead','negociacao','proposta_enviada','aguardando_retorno','aprovada','reprovada','convertida') DEFAULT 'lead',
      partner_id INT NULL,
      observacoes TEXT,
      pdf_url VARCHAR(500),
      converted_company_id INT NULL,
      created_by_user_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_p_status (status), INDEX idx_p_partner (partner_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    // Histórico de status
    await db.execute(drzSql`CREATE TABLE IF NOT EXISTS crm_pipeline_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      proposal_id INT NOT NULL,
      old_status VARCHAR(40), new_status VARCHAR(40),
      note TEXT, user_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_log_prop (proposal_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    // Parceiros
    await db.execute(drzSql`CREATE TABLE IF NOT EXISTS commercial_partners (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(200) NOT NULL, cpf_cnpj VARCHAR(20),
      email VARCHAR(160), telefone VARCHAR(40),
      tipo_parceria VARCHAR(60) DEFAULT 'indicador',
      comissao_pct DECIMAL(5,2) DEFAULT 10,
      comissao_fixa DECIMAL(12,2) DEFAULT 0,
      data_inicio DATE NULL,
      is_active TINYINT(1) DEFAULT 1,
      observacoes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_partner_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    // Vínculo cliente↔parceiro
    await db.execute(drzSql`CREATE TABLE IF NOT EXISTS client_partner_links (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL, partner_id INT NOT NULL,
      comissao_pct DECIMAL(5,2),
      data_inicio DATE, data_fim DATE NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_cp (company_id, partner_id),
      INDEX idx_cp_company (company_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    // Recebimentos
    await db.execute(drzSql`CREATE TABLE IF NOT EXISTS financial_receivables (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL, plano VARCHAR(60),
      valor DECIMAL(12,2) NOT NULL,
      vencimento DATE, pagamento DATE NULL,
      forma_pagamento VARCHAR(40),
      status ENUM('pendente','recebido','em_atraso','cancelado') DEFAULT 'pendente',
      nota_fiscal VARCHAR(80) NULL,
      observacoes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_r_status (status), INDEX idx_r_company (company_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    // Comissões calculadas
    await db.execute(drzSql`CREATE TABLE IF NOT EXISTS financial_commissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      receivable_id INT NOT NULL, partner_id INT NOT NULL,
      valor_bruto DECIMAL(12,2), comissao_pct DECIMAL(5,2),
      valor_comissao DECIMAL(12,2),
      status ENUM('pendente','pago') DEFAULT 'pendente',
      pago_em DATE NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_recpart (receivable_id, partner_id),
      INDEX idx_com_partner (partner_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    // Contratos
    await db.execute(drzSql`CREATE TABLE IF NOT EXISTS contracts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(255), tipo VARCHAR(60),
      partner_id INT NULL, company_id INT NULL,
      assinatura DATE, vigencia_inicio DATE, vigencia_fim DATE,
      status VARCHAR(40) DEFAULT 'ativo',
      arquivo_url VARCHAR(500),
      observacoes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_c_partner (partner_id), INDEX idx_c_company (company_id), INDEX idx_c_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await db.execute(drzSql`CREATE TABLE IF NOT EXISTS contract_versions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      contract_id INT NOT NULL, versao INT, descricao VARCHAR(255),
      arquivo_url VARCHAR(500), data_aditivo DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_cv_contract (contract_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    _ddlDone = true;
  } catch (err) {
    console.warn("[crm] DDL falhou:", (err as any)?.message);
  }
}

// ─── Cálculo de valores da proposta ──────────────────────────────────────
// Tabela parametrizada (poderia ir pra DB no futuro, agora hardcoded MVP)
const PLANOS = {
  starter:    { base: 6,  min: 350,  desc_anual: 0.10 },
  business:   { base: 10, min: 750,  desc_anual: 0.12 },
  enterprise: { base: 14, min: 1500, desc_anual: 0.15 },
};

export function calcularValores(plano: string, qtdColaboradores: number, descontoExtra = 0) {
  const p = (PLANOS as any)[plano] ?? PLANOS.starter;
  const mensal = Math.max(p.min, p.base * qtdColaboradores);
  const mensalComDesc = mensal * (1 - descontoExtra / 100);
  const anualBruto = mensalComDesc * 12;
  const descontoAnual = p.desc_anual;
  const anualLiquido = anualBruto * (1 - descontoAnual);
  const economiaAnual = anualBruto - anualLiquido;
  return {
    valor_mensal: Math.round(mensalComDesc * 100) / 100,
    valor_anual: Math.round(anualLiquido * 100) / 100,
    valor_total: Math.round(anualLiquido * 100) / 100,
    economia_anual: Math.round(economiaAnual * 100) / 100,
    desconto_anual_pct: Math.round(descontoAnual * 1000) / 10,
  };
}

// ─── Geração de PDF da proposta ──────────────────────────────────────────
export async function generateProposalPDF(proposalId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const r: any = await db.execute(drzSql`SELECT * FROM commercial_proposals WHERE id=${proposalId}`);
  const p = (r as any)[0]?.[0];
  if (!p) throw new Error("Proposta não encontrada");

  const path = await import("path");
  const fs = await import("fs/promises");
  const puppeteer = (await import("puppeteer")).default;

  const outDir = "/var/www/saudedotrabalho/uploads/proposals";
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `proposal_${proposalId}.pdf`);

  const fmtMoney = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const validade = new Date(); validade.setDate(validade.getDate() + Number(p.validade_dias ?? 15));
  const validadeStr = validade.toLocaleDateString("pt-BR");

  const PRIMARY = "#1e3a5f", ACCENT = "#0ea5e9";

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; color: #1e293b; }
  @page { size: A4; margin: 16mm; }
  .cover { background: linear-gradient(135deg, ${PRIMARY} 0%, ${ACCENT} 100%); color: white; padding: 60px 40px; min-height: 240mm; page-break-after: always; }
  .cover h1 { font-family: 'Playfair Display', serif; font-size: 42pt; line-height: 1.1; margin-top: 30mm; }
  .cover .kicker { font-size: 11pt; letter-spacing: 3px; text-transform: uppercase; opacity: 0.85; }
  .cover .sub { font-size: 13pt; margin-top: 10mm; opacity: 0.9; line-height: 1.5; }
  .cover .footer { margin-top: 60mm; font-size: 10pt; opacity: 0.85; }
  .page-content { padding: 14mm 12mm; }
  h2 { font-family: 'Playfair Display', serif; font-size: 18pt; color: ${PRIMARY}; margin: 18px 0 10px; border-bottom: 3px solid ${ACCENT}; padding-bottom: 6px; }
  h3 { font-size: 11pt; color: ${PRIMARY}; margin: 14px 0 6px; }
  p, li { font-size: 10pt; line-height: 1.55; color: #334155; }
  ul { margin-left: 18px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10pt; }
  th { background: #f1f5f9; padding: 8px; text-align: left; color: ${PRIMARY}; font-weight: 700; }
  td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
  .pill { display: inline-block; padding: 6px 14px; background: ${ACCENT}; color: white; border-radius: 999px; font-weight: 700; font-size: 9pt; }
  .price-box { background: linear-gradient(135deg, ${PRIMARY} 0%, ${ACCENT} 100%); color: white; padding: 24px; border-radius: 14px; margin: 14px 0; }
  .price-box .label { font-size: 9pt; opacity: 0.85; text-transform: uppercase; letter-spacing: 1.5px; }
  .price-box .v { font-size: 24pt; font-weight: 800; font-family: 'Playfair Display', serif; }
  .price-box .v-sub { font-size: 9pt; opacity: 0.85; margin-top: 4px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .ok { color: #10b981; font-weight: 700; }
  ol li { margin-bottom: 4px; }
</style></head><body>

<div class="cover">
  <div class="kicker">Proposta Comercial</div>
  <h1>Saúde do Trabalho</h1>
  <p class="sub">Plataforma integrada de SST, NR-01, Riscos Psicossociais,<br>Treinamentos e Compliance.</p>
  <div class="footer">
    Apresentada a: <b>${escape(p.razao_social ?? "")}</b><br>
    Data de emissão: ${today}<br>
    Validade: até ${validadeStr}
  </div>
</div>

<div class="page-content">
  <h2>1. Identificação do Cliente</h2>
  <table>
    <tr><td><b>Razão Social</b></td><td>${escape(p.razao_social)}</td></tr>
    <tr><td><b>Nome Fantasia</b></td><td>${escape(p.nome_fantasia ?? "—")}</td></tr>
    <tr><td><b>CNPJ</b></td><td>${escape(p.cnpj ?? "—")}</td></tr>
    <tr><td><b>Responsável</b></td><td>${escape(p.responsavel ?? "—")}${p.cargo ? " ("+escape(p.cargo)+")" : ""}</td></tr>
    <tr><td><b>E-mail</b></td><td>${escape(p.email ?? "—")}</td></tr>
    <tr><td><b>Telefone</b></td><td>${escape(p.telefone ?? "—")}</td></tr>
    <tr><td><b>Segmento</b></td><td>${escape(p.segmento ?? "—")}</td></tr>
    <tr><td><b>Colaboradores</b></td><td>${p.qtd_colaboradores ?? 0}</td></tr>
  </table>

  <h2>2. A Plataforma</h2>
  <p>Solução SaaS completa para gestão de Saúde e Segurança do Trabalho, em conformidade com NR-01 (Portaria MTP 1.419/2024).</p>
  <div class="grid2" style="margin-top: 10px;">
    <ul>
      <li>Gestão de SST + PGR + PCMSO</li>
      <li>Riscos Psicossociais (DRPS + AEP)</li>
      <li>Burnout (MBI simplificada)</li>
      <li>Campanhas Preventivas</li>
      <li>Treinamentos + Certificados</li>
      <li>Gestão Documental</li>
      <li>Dashboard Gerencial</li>
      <li>Indicadores Estratégicos</li>
    </ul>
    <ul>
      <li>Canal de Denúncias (Lei 14.457)</li>
      <li>LGPD + Segurança da Informação</li>
      <li>Assistente Inteligente com IA</li>
      <li>WhatsApp Business integrado</li>
      <li>Multi-empresa, multi-filial, multi-setor</li>
      <li>API e Webhooks</li>
      <li>SMTP por empresa</li>
      <li>Suporte técnico</li>
    </ul>
  </div>

  <h2>3. Benefícios</h2>
  <ul>
    <li><span class="ok">✓</span> Conformidade com a NR-01 e demais NRs aplicáveis</li>
    <li><span class="ok">✓</span> Redução de passivos trabalhistas via rastreabilidade documental</li>
    <li><span class="ok">✓</span> Gestão integrada e centralizada de SST</li>
    <li><span class="ok">✓</span> Controle preventivo de riscos psicossociais</li>
    <li><span class="ok">✓</span> Indicadores em tempo real e dashboards gerenciais</li>
    <li><span class="ok">✓</span> Apoio à tomada de decisão estratégica</li>
    <li><span class="ok">✓</span> Governança corporativa e compliance</li>
  </ul>

  <h2>4. Investimento</h2>
  <div class="grid2">
    <div class="price-box">
      <div class="label">Mensal</div>
      <div class="v">${fmtMoney(p.valor_mensal)}</div>
      <div class="v-sub">Plano <b>${String(p.plano ?? "starter").toUpperCase()}</b> · ${p.qtd_colaboradores ?? 0} colaboradores</div>
    </div>
    <div class="price-box" style="background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%);">
      <div class="label">Anual <span class="pill" style="background: white; color: #065f46; margin-left: 8px;">economia</span></div>
      <div class="v">${fmtMoney(p.valor_anual)}</div>
      <div class="v-sub">Pagamento anual antecipado com desconto integrado</div>
    </div>
  </div>
  ${p.observacoes ? `<h3>Observações Comerciais</h3><p>${escape(p.observacoes)}</p>` : ""}

  <h2>5. Próximos Passos</h2>
  <ol>
    <li>Aprovação desta proposta</li>
    <li>Assinatura do contrato</li>
    <li>Implantação da plataforma</li>
    <li>Importação dos colaboradores</li>
    <li>Parametrização inicial (PGR, ciclos, campanhas)</li>
    <li>Treinamento dos usuários-chave</li>
    <li>Início da operação assistida</li>
  </ol>

  <p style="margin-top: 28px; font-size: 9pt; color: #64748b; text-align: center;">
    Esta proposta tem validade até <b>${validadeStr}</b>. Saúde do Trabalho — ${today}.
  </p>
</div>
</body></html>`;

  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium-browser",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({ path: outPath, format: "A4", printBackground: true });
  } finally {
    await browser.close();
  }

  const url = `/uploads/proposals/proposal_${proposalId}.pdf`;
  await db.execute(drzSql`UPDATE commercial_proposals SET pdf_url=${url} WHERE id=${proposalId}`);
  return url;
}

function escape(s: unknown): string {
  return String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string));
}
