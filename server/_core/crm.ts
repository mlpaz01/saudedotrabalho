/**
 * SP13 — Módulo CRM / Financeiro / Contratos.
 * Bruno R5 #2/#3/#4 — Tabela parametrizada de FAIXAS, 24 features no PDF, design premium.
 */
import { getDb } from "../db";
import { sql as drzSql } from "drizzle-orm";

let _ddlDone = false;
export async function ensureCrmTables() {
  if (_ddlDone) return;
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(drzSql`CREATE TABLE IF NOT EXISTS commercial_proposals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      razao_social VARCHAR(255), nome_fantasia VARCHAR(255),
      cnpj VARCHAR(20), responsavel VARCHAR(160), cargo VARCHAR(120),
      email VARCHAR(160), telefone VARCHAR(40), segmento VARCHAR(120),
      qtd_colaboradores INT DEFAULT 0,
      plano VARCHAR(60) DEFAULT 'auto',
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
    for (const col of [
      "proposal_model VARCHAR(30) NULL DEFAULT 'enterprise'",
      "enterprise_package VARCHAR(40) NULL",
      "setup_mode VARCHAR(30) NULL DEFAULT 'none'",
      "setup_value DECIMAL(12,2) NULL DEFAULT 0",
      "setup_installments INT NULL DEFAULT 0",
      "white_label_plan VARCHAR(60) NULL",
    ]) {
      try { await db.execute(drzSql.raw(`ALTER TABLE commercial_proposals ADD COLUMN ${col}`)); } catch (_) {}
    }
    await db.execute(drzSql`CREATE TABLE IF NOT EXISTS crm_pipeline_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      proposal_id INT NOT NULL,
      old_status VARCHAR(40), new_status VARCHAR(40),
      note TEXT, user_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_log_prop (proposal_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
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
    await db.execute(drzSql`CREATE TABLE IF NOT EXISTS client_partner_links (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL, partner_id INT NOT NULL,
      comissao_pct DECIMAL(5,2),
      data_inicio DATE, data_fim DATE NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_cp (company_id, partner_id),
      INDEX idx_cp_company (company_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
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
    // P14 #4 — dados bancários/PIX do intermediário (commercial_partners já existe; só complementa).
    // P14 #5 — user_id (login do Intermediador na plataforma) + parent_partner_id (hierarquia
    // Intermediador Principal → subordinados).
    for (const col of [
      "banco VARCHAR(120) NULL", "agencia VARCHAR(20) NULL", "conta VARCHAR(30) NULL", "pix_key VARCHAR(160) NULL",
      "user_id INT NULL", "parent_partner_id INT NULL",
    ]) {
      try { await db.execute(drzSql.raw(`ALTER TABLE commercial_partners ADD COLUMN ${col}`)); } catch (_) {}
    }
    // P14 #5 — CRM de Prospecção do Intermediador.
    await db.execute(drzSql`CREATE TABLE IF NOT EXISTS prospects (
      id INT AUTO_INCREMENT PRIMARY KEY,
      partner_id INT NOT NULL,
      empresa_nome VARCHAR(255) NOT NULL, cnpj VARCHAR(20),
      contato_nome VARCHAR(160), contato_email VARCHAR(160), contato_telefone VARCHAR(40),
      estagio ENUM('lead_identificado','primeiro_contato','apresentacao_realizada','proposta_enviada',
                    'negociacao','contrato_em_elaboracao','cliente_fechado','negociacao_perdida')
        DEFAULT 'lead_identificado',
      probabilidade_pct DECIMAL(5,2) DEFAULT 10,
      observacoes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_pros_partner (partner_id), INDEX idx_pros_estagio (estagio)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await db.execute(drzSql`CREATE TABLE IF NOT EXISTS prospect_interactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      prospect_id INT NOT NULL,
      tipo VARCHAR(60) NOT NULL DEFAULT 'contato',
      descricao TEXT,
      created_by_user_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_pi_prospect (prospect_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    // P14 #4 — até 3 intermediários por contrato, cada um com % de comissão e contrato digitalizado próprio.
    await db.execute(drzSql`CREATE TABLE IF NOT EXISTS contract_partners (
      id INT AUTO_INCREMENT PRIMARY KEY,
      contract_id INT NOT NULL, partner_id INT NOT NULL,
      comissao_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
      status ENUM('ativo','inativo') DEFAULT 'ativo',
      arquivo_url VARCHAR(500) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_contract_partner (contract_id, partner_id),
      INDEX idx_cp2_contract (contract_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    _ddlDone = true;
  } catch (err) {
    console.warn("[crm] DDL falhou:", (err as any)?.message);
  }
}

// ─── Bruno R5 #2 + R5-P3 #6 — FAIXAS PARAMETRIZADAS por nº de colaboradores ────
// Valor MENSAL fixo por faixa (anual = mensal × 12). Persistido em `pricing_faixas`
// — Super Admin pode editar pela UI. Fallback no array abaixo se a tabela vazia.
export const FAIXAS_DEFAULT = [
  { faixa: "1-30",     min: 1,    max: 30,    valor_mensal: 3500,  ordem: 1 },
  { faixa: "31-100",   min: 31,   max: 100,   valor_mensal: 7500,  ordem: 2 },
  { faixa: "101-300",  min: 101,  max: 300,   valor_mensal: 10500, ordem: 3 },
  { faixa: "301-500",  min: 301,  max: 500,   valor_mensal: 14000, ordem: 4 },
  { faixa: "501-999",  min: 501,  max: 999,   valor_mensal: 22000, ordem: 5 },
  { faixa: "1000+",    min: 1000, max: 99999, valor_mensal: 35000, ordem: 6 },
];

// Compat com R5 (FAIXAS_COLABORADORES.valor_anual). valor_anual = mensal × 12.
export const FAIXAS_COLABORADORES = FAIXAS_DEFAULT.map(f => ({ ...f, valor_anual: f.valor_mensal * 12 }));

let _faixasCache: typeof FAIXAS_COLABORADORES | null = null;
let _faixasCacheAt = 0;
const FAIXAS_TTL_MS = 30_000;

export async function ensureFaixasTable() {
  const db = await getDb(); if (!db) return;
  try {
    await db.execute(drzSql`CREATE TABLE IF NOT EXISTS pricing_faixas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      faixa VARCHAR(40) NOT NULL,
      min_colab INT NOT NULL,
      max_colab INT NOT NULL,
      valor_mensal DECIMAL(12,2) NOT NULL,
      ordem INT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_ordem (ordem)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    const [r]: any = await db.execute(drzSql`SELECT COUNT(*) AS cnt FROM pricing_faixas`);
    const cnt = Number(r?.[0]?.cnt ?? 0);
    if (cnt === 0) {
      for (const f of FAIXAS_DEFAULT) {
        await db.execute(drzSql`INSERT INTO pricing_faixas (faixa, min_colab, max_colab, valor_mensal, ordem) VALUES (${f.faixa}, ${f.min}, ${f.max}, ${f.valor_mensal}, ${f.ordem})`);
      }
    }
  } catch (e) { console.warn("[crm] ensureFaixasTable:", (e as any)?.message); }
}

export async function loadFaixas(): Promise<typeof FAIXAS_COLABORADORES> {
  const now = Date.now();
  if (_faixasCache && now - _faixasCacheAt < FAIXAS_TTL_MS) return _faixasCache;
  await ensureFaixasTable();
  const db = await getDb(); if (!db) return FAIXAS_COLABORADORES;
  try {
    const r: any = await db.execute(drzSql`SELECT faixa, min_colab AS min, max_colab AS max, valor_mensal, ordem FROM pricing_faixas ORDER BY ordem ASC`);
    const rows = ((r as any)[0] ?? []) as any[];
    if (rows.length === 0) return FAIXAS_COLABORADORES;
    _faixasCache = rows.map((x: any) => ({
      faixa: String(x.faixa), min: Number(x.min), max: Number(x.max),
      valor_mensal: Number(x.valor_mensal), valor_anual: Number(x.valor_mensal) * 12,
      ordem: Number(x.ordem),
    }));
    _faixasCacheAt = now;
    return _faixasCache;
  } catch { return FAIXAS_COLABORADORES; }
}

export function invalidateFaixasCache() { _faixasCache = null; _faixasCacheAt = 0; }

export function faixaParaQtd(qtd: number, faixas?: typeof FAIXAS_COLABORADORES) {
  const list = faixas ?? FAIXAS_COLABORADORES;
  const q = Math.max(1, Math.floor(qtd || 0));
  return list.find(f => q >= f.min && q <= f.max) || list[list.length - 1];
}

export const ENTERPRISE_PROPOSAL_RANGES = [
  { key: "1-30", min: 1, max: 30, referenceQty: 30, corporate: null, prices: { enterprise_start: 2900, enterprise_business: 3200, enterprise_premium: 3500 } },
  { key: "31-100", min: 31, max: 100, referenceQty: 100, corporate: null, prices: { enterprise_start: 6300, enterprise_business: 6900, enterprise_premium: 7500 } },
  { key: "101-300", min: 101, max: 300, referenceQty: 300, corporate: null, prices: { enterprise_start: 8900, enterprise_business: 9700, enterprise_premium: 10500 } },
  { key: "301-500", min: 301, max: 500, referenceQty: 500, corporate: null, prices: { enterprise_start: 12000, enterprise_business: 13000, enterprise_premium: 14000 } },
  { key: "501-999", min: 501, max: 999, referenceQty: null, corporate: 22000, prices: { enterprise_start: 16000, enterprise_business: 17000, enterprise_premium: 19000 } },
  { key: "1000+", min: 1000, max: 999999, referenceQty: null, corporate: null, prices: { enterprise_start: 29000, enterprise_business: 32000, enterprise_premium: 35000 } },
] as const;

export const ENTERPRISE_PACKAGES = {
  enterprise_start: { label: "Enterprise Start", summary: "Modulos essenciais para gestao psicossocial, treinamentos e areas operacionais." },
  enterprise_business: { label: "Enterprise Business", summary: "Start mais conformidade, CIPA, comunicacao ampliada e gestao documental." },
  enterprise_premium: { label: "Enterprise Premium", summary: "Plataforma completa, com IA, OCR, integracoes, APIs e suporte prioritario." },
} as const;

export const WHITE_LABEL_PLANS = {
  start_white_label: { label: "Start White Label", monthly: 397, setup: 1800, cnpjs: "1 CNPJ", employees: "ate 100 colaboradores ativos", storage: "5 GB", aiCredits: "10.000 creditos de IA/mes" },
  partner_pro: { label: "Partner Pro", monthly: 797, setup: 3000, cnpjs: "ate 5 CNPJs", employees: "500 colaboradores ativos", storage: "10 GB", aiCredits: "25.000 creditos de IA/mes" },
  carteira: { label: "Carteira", monthly: 1597, setup: 5400, cnpjs: "ate 20 CNPJs", employees: "2.000 colaboradores ativos", storage: "40 GB", aiCredits: "100.000 creditos de IA/mes" },
  enterprise_light: { label: "Enterprise Light", monthly: 3797, setup: 9600, cnpjs: "ate 50 CNPJs", employees: "5.000 colaboradores ativos", storage: "100 GB", aiCredits: "250.000 creditos de IA/mes" },
} as const;

export const ENTERPRISE_FEATURE_MATRIX = [
  { item: "DRPS, AEP, Inventario Psicossocial e Plano de Acao", start: true, business: true, premium: true },
  { item: "Dashboards, trilhas, certificados e biblioteca de cursos", start: true, business: true, premium: true },
  { item: "Areas RH, SESMT, Lideranca, Colaborador e Psicologo", start: true, business: true, premium: true },
  { item: "Gestao de campanhas e comunicacao por e-mail", start: true, business: true, premium: true },
  { item: "Canal de Denuncias", start: false, business: true, premium: true },
  { item: "WhatsApp, CIPA, CIPAT e Biblioteca Preventiva", start: false, business: true, premium: true },
  { item: "Central de Conformidade, paineis executivos e gestao documental", start: false, business: true, premium: true },
  { item: "IA, OCR e editor livre de questionarios", start: false, business: false, premium: true },
  { item: "Atas Corporativas e Primeiros Socorros", start: false, business: false, premium: true },
  { item: "APIs, Integracao TOTVS/RM e integracoes futuras", start: false, business: false, premium: true },
  { item: "Atualizacoes automaticas e suporte prioritario", start: false, business: false, premium: true },
] as const;

export type ProposalModel = "enterprise" | "white_label";
export type EnterprisePackageKey = keyof typeof ENTERPRISE_PACKAGES;
export type WhiteLabelPlanKey = keyof typeof WHITE_LABEL_PLANS;

export function rangeForEnterprise(qtd: number) {
  const q = Math.max(1, Math.floor(qtd || 0));
  return ENTERPRISE_PROPOSAL_RANGES.find((r) => q >= r.min && q <= r.max) ?? ENTERPRISE_PROPOSAL_RANGES[ENTERPRISE_PROPOSAL_RANGES.length - 1];
}

export function calculateCommercialProposalValues(input: {
  proposalModel?: string | null;
  qtdColaboradores?: number | null;
  enterprisePackage?: string | null;
  whiteLabelPlan?: string | null;
  descontoExtraPct?: number | null;
  setupMode?: string | null;
  setupValue?: number | null;
  setupInstallments?: number | null;
}) {
  const model: ProposalModel = input.proposalModel === "white_label" ? "white_label" : "enterprise";
  const discount = Math.max(0, Math.min(90, Number(input.descontoExtraPct || 0)));
  const setupMode = String(input.setupMode || "none");
  const setupValue = Math.max(0, Number(input.setupValue || 0));
  const setupInstallments = Math.max(0, Math.floor(Number(input.setupInstallments || 0)));

  if (model === "white_label") {
    const planKey = (String(input.whiteLabelPlan || "start_white_label") in WHITE_LABEL_PLANS ? String(input.whiteLabelPlan || "start_white_label") : "start_white_label") as WhiteLabelPlanKey;
    const plan = WHITE_LABEL_PLANS[planKey];
    const monthly = plan.monthly * (1 - discount / 100);
    return {
      proposal_model: model,
      plano: planKey,
      enterprise_package: null,
      white_label_plan: planKey,
      label: plan.label,
      faixa: "White Label",
      valor_mensal: Math.round(monthly * 100) / 100,
      valor_anual: Math.round(monthly * 12 * 100) / 100,
      valor_total: Math.round(monthly * 12 * 100) / 100,
      setup_mode: setupMode === "none" ? "single" : setupMode,
      setup_value: setupValue > 0 ? setupValue : plan.setup,
      setup_installments: setupMode === "installments" ? Math.max(1, setupInstallments || 1) : 0,
      per_collaborator_month: null,
      per_collaborator_day: null,
      plan,
    };
  }

  const pkgKey = (String(input.enterprisePackage || "enterprise_premium") in ENTERPRISE_PACKAGES ? String(input.enterprisePackage || "enterprise_premium") : "enterprise_premium") as EnterprisePackageKey;
  const range = rangeForEnterprise(Number(input.qtdColaboradores || 0));
  const base = Number(range.prices[pkgKey]);
  const monthly = base * (1 - discount / 100);
  const qty = Math.max(1, Number(input.qtdColaboradores || range.referenceQty || range.min));
  const divisor = range.referenceQty || qty;
  return {
    proposal_model: model,
    plano: pkgKey,
    enterprise_package: pkgKey,
    white_label_plan: null,
    label: ENTERPRISE_PACKAGES[pkgKey].label,
    faixa: range.key,
    valor_mensal: Math.round(monthly * 100) / 100,
    valor_anual: Math.round(monthly * 12 * 100) / 100,
    valor_total: Math.round(monthly * 12 * 100) / 100,
    setup_mode: setupMode,
    setup_value: setupMode === "none" ? 0 : setupValue,
    setup_installments: setupMode === "installments" ? Math.max(1, setupInstallments || 1) : 0,
    per_collaborator_month: Math.round((monthly / Math.max(1, divisor)) * 100) / 100,
    per_collaborator_day: Math.round((monthly / Math.max(1, divisor) / 30) * 100) / 100,
    range,
    package: ENTERPRISE_PACKAGES[pkgKey],
  };
}

// Planos legacy (mantidos pra compat com propostas antigas no DB).
const PLANOS = {
  starter:    { base: 6,  min: 350,  desc_anual: 0.10 },
  business:   { base: 10, min: 750,  desc_anual: 0.12 },
  enterprise: { base: 14, min: 1500, desc_anual: 0.15 },
};

export async function calcularValoresAsync(plano: string, qtdColaboradores: number, descontoExtra = 0) {
  const planoNorm = String(plano || "auto").toLowerCase();
  if (planoNorm === "auto" || !PLANOS[planoNorm as keyof typeof PLANOS]) {
    const faixas = await loadFaixas();
    const f = faixaParaQtd(qtdColaboradores, faixas);
    const mensalBase = f.valor_mensal;
    const mensalComDesc = mensalBase * (1 - (descontoExtra || 0) / 100);
    const anualComDesc = mensalComDesc * 12;
    return {
      valor_mensal: Math.round(mensalComDesc * 100) / 100,
      valor_anual: Math.round(anualComDesc * 100) / 100,
      valor_total: Math.round(anualComDesc * 100) / 100,
      economia_anual: 0,
      desconto_anual_pct: 0,
      faixa: f.faixa,
    };
  }
  return calcularValores(plano, qtdColaboradores, descontoExtra);
}

export function calcularValores(plano: string, qtdColaboradores: number, descontoExtra = 0) {
  // Mantido síncrono para compat. Usa cache em memória (último load) ou DEFAULT.
  const planoNorm = String(plano || "auto").toLowerCase();
  if (planoNorm === "auto" || !PLANOS[planoNorm as keyof typeof PLANOS]) {
    const faixasSync = _faixasCache ?? FAIXAS_COLABORADORES;
    const f = faixaParaQtd(qtdColaboradores, faixasSync);
    const mensalBase = f.valor_mensal;
    const mensalComDesc = mensalBase * (1 - (descontoExtra || 0) / 100);
    const anualComDesc = mensalComDesc * 12;
    return {
      valor_mensal: Math.round(mensalComDesc * 100) / 100,
      valor_anual: Math.round(anualComDesc * 100) / 100,
      valor_total: Math.round(anualComDesc * 100) / 100,
      economia_anual: 0,
      desconto_anual_pct: 0,
      faixa: f.faixa,
    };
  }
  // Legacy: por colaborador
  const p = (PLANOS as any)[planoNorm];
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
    faixa: null,
  };
}

// Bruno R5-P3 #7 — Lista de 20 features alinhada exatamente à descrição enviada pelo Bruno.
export const FEATURES_24 = [
  { grupo: "Gestão de Riscos e SST", itens: [
    { icon: "🛡️", titulo: "Gestão completa dos riscos psicossociais", desc: "Pesquisa DRPS, segmentação por setor, plano de ação preventivo" },
    { icon: "📋", titulo: "Integração com o PGR e GRO", desc: "PGR e Gerenciamento de Riscos Ocupacionais integrados" },
    { icon: "🔍", titulo: "Inventários, Matrizes de Risco e Relatórios Técnicos", desc: "Inventário por GSE, matriz qualitativa e relatórios oficiais" },
    { icon: "🖥️", titulo: "Dashboard executivo em tempo real", desc: "Indicadores estratégicos consolidados para decisão C-Level" },
  ]},
  { grupo: "Conformidade e Governança", itens: [
    { icon: "⚖️", titulo: "Gestão de Conformidade", desc: "Acompanhamento de NR-01, Lei 14.457, LGPD e demais normas" },
    { icon: "📁", titulo: "Dossiê Digital para Fiscalizações e Auditorias", desc: "Repositório completo com evidências e logs de execução" },
    { icon: "🔔", titulo: "Canal de Denúncias", desc: "Lei 14.457/2022 — sigilo total, protocolo de tratativa, anonimato opcional" },
    { icon: "🌐", titulo: "Visão 360º dos colaboradores", desc: "Histórico unificado de SST, treinamentos, exames e ocorrências" },
  ]},
  { grupo: "Operacional", itens: [
    { icon: "📥", titulo: "Importação em massa de colaboradores e estrutura organizacional", desc: "CSV/Excel para colaboradores, setores, filiais e cargos" },
    { icon: "🔐", titulo: "Controle de acesso por perfis", desc: "RBAC granular — Colaborador, RH, SESMT, Chefia, Super Admin" },
    { icon: "🌍", titulo: "Acesso online para todos os colaboradores", desc: "Multi-dispositivo (web e mobile), 100% nuvem" },
  ]},
  { grupo: "Educação Corporativa", itens: [
    { icon: "🎓", titulo: "Universidade Corporativa Integrada", desc: "Biblioteca de cursos, módulos e trilhas obrigatórias" },
    { icon: "🤖", titulo: "Gerador Inteligente de Cursos", desc: "Crie curso completo a partir de um tema — texto + imagens + quiz" },
    { icon: "📜", titulo: "Emissão automática de certificados", desc: "Certificados com QR-code de validação pública" },
  ]},
  { grupo: "Comunicação e Engajamento", itens: [
    { icon: "💬", titulo: "Facilitador de Comunicação Corporativa", desc: "E-mail, WhatsApp Business e push no app — todos integrados" },
    { icon: "📚", titulo: "Biblioteca Preventiva Digital", desc: "Material institucional pronto e personalizável" },
    { icon: "📅", titulo: "Gestão das Campanhas de Saúde Preventiva", desc: "SIPAT, Outubro Rosa, Novembro Azul, Setembro Amarelo, Janeiro Branco" },
    { icon: "📰", titulo: "Disponibilização automática de conteúdos preventivos", desc: "Posts e notícias preventivas prontas por tema/mês" },
  ]},
  { grupo: "Cuidado Humano", itens: [
    { icon: "💚", titulo: "Atendimento especializado com psicóloga", desc: "Agenda integrada com Meet/Teams + sigilo clínico + e-mails automáticos" },
    { icon: "🌿", titulo: "Sala de Descompressão", desc: "Conteúdo de bem-estar, mindfulness e gestão emocional" },
  ]},
];

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

  // Bruno R5 #4 — Hero image: mulher do login (welcome-hero.png).
  // Embute como base64 pra não depender de fetch externo durante render do puppeteer.
  let heroBase64 = "";
  try {
    const heroPath = "/var/www/saudedotrabalho/dist/public/welcome-hero.png";
    const buf = await fs.readFile(heroPath);
    heroBase64 = `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    try {
      const heroPath2 = "/var/www/saudedotrabalho/client/public/welcome-hero.png";
      const buf = await fs.readFile(heroPath2);
      heroBase64 = `data:image/png;base64,${buf.toString("base64")}`;
    } catch {
      heroBase64 = "";
    }
  }

  // Logo embutido (mesmo padrão).
  let logoBase64 = "";
  try {
    for (const lp of ["/var/www/saudedotrabalho/dist/public/logo.png", "/var/www/saudedotrabalho/client/public/logo.png", "/var/www/saudedotrabalho/dist/public/favicon.png"]) {
      try { const buf = await fs.readFile(lp); logoBase64 = `data:image/png;base64,${buf.toString("base64")}`; break; } catch {}
    }
  } catch {}

  const fmtMoney = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const validade = new Date(); validade.setDate(validade.getDate() + Number(p.validade_dias ?? 15));
  const validadeStr = validade.toLocaleDateString("pt-BR");

  const PRIMARY = "#1e3a5f";
  const ACCENT = "#0ea5e9";
  const ACCENT2 = "#10b981";

  // Re-calcula valores caso o DB esteja desatualizado (faixa correta).
  // Bruno R5-P3 #6 — usa faixas atuais do DB (não as default).
  const proposalModel = String(p.proposal_model || (p.white_label_plan ? "white_label" : "enterprise"));
  const commercial = calculateCommercialProposalValues({
    proposalModel,
    qtdColaboradores: Number(p.qtd_colaboradores || 0),
    enterprisePackage: p.enterprise_package || p.plano,
    whiteLabelPlan: p.white_label_plan || p.plano,
    descontoExtraPct: Number(p.desconto_pct || 0),
    setupMode: p.setup_mode || "none",
    setupValue: Number(p.setup_value || 0),
    setupInstallments: Number(p.setup_installments || 0),
  });
  const valorMensal = Number(p.valor_mensal) > 0 ? Number(p.valor_mensal) : commercial.valor_mensal;
  const valorAnual = Number(p.valor_anual) > 0 ? Number(p.valor_anual) : commercial.valor_anual;
  const faixaTxt = commercial.faixa || (p.qtd_colaboradores ? `${p.qtd_colaboradores} colaboradores` : "");
  const packageLabel = commercial.label || String(p.plano || "Plano");
  const setupMode = String(p.setup_mode || commercial.setup_mode || "none");
  const setupValue = Number(p.setup_value || commercial.setup_value || 0);
  const setupInstallments = Number(p.setup_installments || commercial.setup_installments || 0);
  const setupText = setupMode === "installments" && setupValue > 0
    ? `${setupInstallments || 1} parcelas de ${fmtMoney(setupValue)}`
    : setupMode === "single" && setupValue > 0
      ? `Setup unico de ${fmtMoney(setupValue)}`
      : proposalModel === "white_label" && setupValue > 0
        ? `Setup de ${fmtMoney(setupValue)}`
        : "Sem setup";
  const collabMonth = Number(commercial.per_collaborator_month || 0);
  const collabDay = Number(commercial.per_collaborator_day || 0);
  const commercialText = proposalModel === "white_label"
    ? "Modelo para consultorias, assessorias, clinicas e parceiros com gestao independente de carteira, marca propria e limites operacionais por plano."
    : `O investimento apresentado corresponde a aproximadamente ${collabMonth ? fmtMoney(collabMonth) : "valor calculado"} por colaborador/mes${collabDay ? `, ou cerca de ${fmtMoney(collabDay)} por colaborador/dia` : ""}, considerando a quantidade de colaboradores cadastrada na empresa.`;

  const enterpriseFeatureRows = ENTERPRISE_FEATURE_MATRIX.map((f) => `
    <tr>
      <td>${escape(f.item)}</td>
      <td style="text-align:center">${f.start ? "Sim" : "-"}</td>
      <td style="text-align:center">${f.business ? "Sim" : "-"}</td>
      <td style="text-align:center">${f.premium ? "Sim" : "-"}</td>
    </tr>
  `).join("");
  const enterpriseRangesHtml = ENTERPRISE_PROPOSAL_RANGES.map((r) => {
    const atual = Number(p.qtd_colaboradores || 0) >= r.min && Number(p.qtd_colaboradores || 0) <= r.max;
    return `<tr class="${atual ? "atual" : ""}"><td>${escape(r.key)}</td><td style="text-align:right">${fmtMoney(r.prices.enterprise_start)}</td><td style="text-align:right">${fmtMoney(r.prices.enterprise_business)}</td><td style="text-align:right">${fmtMoney(r.prices.enterprise_premium)}</td><td style="text-align:right">${r.corporate ? fmtMoney(r.corporate) : "-"}</td></tr>`;
  }).join("");
  const whiteLabelRows = Object.entries(WHITE_LABEL_PLANS).map(([key, plan]) => `
    <tr class="${String(commercial.white_label_plan || "") === key ? "atual" : ""}">
      <td><b>${escape(plan.label)}</b></td>
      <td style="text-align:right">${fmtMoney(plan.monthly)}/mes</td>
      <td style="text-align:right">${fmtMoney(plan.setup)}</td>
      <td>${escape(plan.cnpjs)}<br>${escape(plan.employees)}</td>
      <td>${escape(plan.storage)}<br>${escape(plan.aiCredits)}</td>
    </tr>
  `).join("");
  const proposalSpecificHtml = proposalModel === "white_label" ? `
    <h3>Modelo Consultoria / White Label</h3>
    <p>${commercialText}</p>
    <div class="faixa-tabela">
      <div class="titulo">Plano selecionado: ${escape(packageLabel)}</div>
      <table>
        <thead><tr><th>Plano</th><th style="text-align:right">Mensalidade</th><th style="text-align:right">Setup</th><th>Limites</th><th>Recursos</th></tr></thead>
        <tbody>${whiteLabelRows}</tbody>
      </table>
    </div>
    <p style="margin-top:8px">A proposta pode receber modulos adicionais, creditos extras de IA, integracoes, treinamento, suporte ampliado e customizacoes comerciais conforme contrato.</p>
  ` : `
    <h3>Modelo Empresa - Contratacao Direta</h3>
    <p>${commercialText}</p>
    <div class="faixa-tabela">
      <div class="titulo">Pacote selecionado: ${escape(packageLabel)}</div>
      <table>
        <thead><tr><th>Colaboradores</th><th style="text-align:right">Start</th><th style="text-align:right">Business</th><th style="text-align:right">Premium</th><th style="text-align:right">Corporate oficial</th></tr></thead>
        <tbody>${enterpriseRangesHtml}</tbody>
      </table>
    </div>
    <div class="faixa-tabela">
      <div class="titulo">Comparativo de funcionalidades por pacote</div>
      <table>
        <thead><tr><th>Funcionalidade</th><th>Start</th><th>Business</th><th>Premium</th></tr></thead>
        <tbody>${enterpriseFeatureRows}</tbody>
      </table>
    </div>
  `;
  const faixasAtuais = ENTERPRISE_PROPOSAL_RANGES.map((r) => ({
    min: r.min,
    max: r.max,
    valor_mensal: r.prices[(commercial.enterprise_package || "enterprise_premium") as EnterprisePackageKey] || r.prices.enterprise_premium,
  }));

  const featuresHtml = FEATURES_24.map(g => `
    <div class="feat-grupo">
      <h3 class="feat-grupo-titulo">${escape(g.grupo)}</h3>
      <div class="feat-grid">
        ${g.itens.map(it => `
          <div class="feat-card">
            <div class="feat-icon">${it.icon}</div>
            <div class="feat-body">
              <div class="feat-titulo">${escape(it.titulo)}</div>
              <div class="feat-desc">${escape(it.desc)}</div>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `).join("");

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: A4; margin: 0; }
  .page { padding: 16mm 14mm; page-break-after: always; }
  .page:last-child { page-break-after: auto; }

  /* CAPA — Bruno R5-P4 — fundo BRANCO p/ economizar tinta na impressão.
     Identidade visual mantida com barra lateral fina + textos em PRIMARY. */
  .cover { background: #ffffff; color: ${PRIMARY}; padding: 0; min-height: 297mm; position: relative; overflow: hidden; page-break-after: always; }
  /* Barra lateral fina (4mm) — o único elemento colorido, gasta pouca tinta */
  .cover:before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4mm; background: linear-gradient(180deg, ${PRIMARY} 0%, ${ACCENT} 100%); }
  .cover-top { padding: 22mm 16mm 0 22mm; display: flex; align-items: center; gap: 16px; }
  .cover-top .logo { width: 84px; height: 84px; background: white; border: 2px solid ${PRIMARY}20; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 28pt; font-weight: 800; color: ${PRIMARY}; padding: 6px; }
  .cover-top .logo img { width: 100%; height: 100%; object-fit: contain; border-radius: 10px; }
  .cover-top .brand { font-size: 18pt; font-weight: 700; letter-spacing: 0.5px; color: ${PRIMARY}; }
  .cover-hero { padding: 26mm 16mm 0 22mm; display: flex; align-items: center; gap: 24px; }
  .cover-hero-text { flex: 1.4; }
  .cover-hero-img { flex: 1; text-align: center; }
  .cover-hero-img img { max-width: 100%; max-height: 95mm; border-radius: 12px; background: #f8fafc; padding: 8px; border: 1px solid #e2e8f0; }
  .cover-kicker { font-size: 10pt; letter-spacing: 4px; text-transform: uppercase; color: ${ACCENT}; margin-bottom: 12px; font-weight: 700; }
  .cover h1 { font-size: 36pt; line-height: 1.05; font-weight: 800; margin-bottom: 14px; color: ${PRIMARY}; }
  .cover .tagline { font-size: 13pt; line-height: 1.5; max-width: 92%; color: #475569; font-weight: 400; }
  .cover-card { margin: 20mm 16mm 0 22mm; background: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid ${ACCENT}; border-radius: 6px; padding: 18px 22px; }
  .cover-card .row { display: flex; gap: 28px; flex-wrap: wrap; }
  .cover-card .row .lab { font-size: 9pt; letter-spacing: 2px; text-transform: uppercase; color: #64748b; font-weight: 600; }
  .cover-card .row .val { font-size: 13pt; font-weight: 700; margin-top: 4px; color: ${PRIMARY}; }
  .cover-footer { position: absolute; bottom: 14mm; left: 22mm; right: 16mm; font-size: 10pt; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 8mm; }
  .cover-footer span { color: ${PRIMARY}; }
  .cover-footer b { font-size: 11pt; color: ${PRIMARY}; }
  .cover-footer a { color: ${ACCENT}; text-decoration: none; font-weight: 600; }
  /* Topo: badge "Proposta nº" — borda fina, sem fill (economia de tinta) */
  .cover-pnum { position: absolute; top: 14mm; right: 16mm; background: white; border: 1.5px solid ${PRIMARY}; padding: 6px 14px; border-radius: 999px; font-size: 9.5pt; font-weight: 700; letter-spacing: 1.5px; color: ${PRIMARY}; }

  /* CONTEÚDO */
  h2 { font-size: 17pt; color: ${PRIMARY}; margin: 0 0 4px; font-weight: 800; }
  h2 .num { display: inline-block; width: 28px; height: 28px; border-radius: 8px; background: ${ACCENT}; color: white; font-size: 11pt; text-align: center; line-height: 28px; margin-right: 10px; vertical-align: middle; }
  .h2-sub { font-size: 10pt; color: #64748b; margin: 0 0 14px 38px; }
  h3 { font-size: 11pt; color: ${PRIMARY}; margin: 14px 0 8px; font-weight: 700; }
  p, li, td { font-size: 10pt; line-height: 1.55; color: #334155; }

  table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 10pt; }
  th { background: ${PRIMARY}; color: white; padding: 10px; text-align: left; font-weight: 600; font-size: 9.5pt; }
  td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f8fafc; }

  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; margin-top: 6px; }
  .info-row { padding: 8px 0; border-bottom: 1px dashed #e2e8f0; }
  .info-row .l { font-size: 8.5pt; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
  .info-row .v { font-size: 10.5pt; font-weight: 600; color: #0f172a; }

  /* FEATURES — Bruno R5-P4 #3 — orphans/widows + display block forte pra grupo não cortar */
  .feat-grupo { margin-bottom: 12px; break-inside: avoid; page-break-inside: avoid; -webkit-column-break-inside: avoid; orphans: 3; widows: 3; display: block; }
  .feat-grupo-titulo { font-size: 9.5pt; color: ${ACCENT}; text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid ${ACCENT}33; padding-bottom: 4px; margin-bottom: 8px; font-weight: 700; }
  .feat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .feat-card { display: flex; gap: 10px; background: #f8fafc; border-left: 3px solid ${ACCENT}; padding: 10px 12px; border-radius: 6px; break-inside: avoid; page-break-inside: avoid; }
  .feat-icon { font-size: 16pt; line-height: 1; flex-shrink: 0; }
  .feat-titulo { font-size: 10pt; font-weight: 700; color: ${PRIMARY}; }
  .feat-desc { font-size: 8.5pt; color: #475569; line-height: 1.35; margin-top: 2px; }

  /* INVESTIMENTO */
  .price-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 8px 0 14px; }
  .price-card { padding: 22px; border-radius: 14px; color: white; }
  .price-mensal { background: linear-gradient(135deg, ${PRIMARY} 0%, ${ACCENT} 100%); }
  .price-anual { background: linear-gradient(135deg, ${ACCENT2} 0%, #14b8a6 100%); }
  .price-card .lab { font-size: 8.5pt; opacity: 0.85; letter-spacing: 2px; text-transform: uppercase; }
  .price-card .val { font-size: 26pt; font-weight: 800; line-height: 1.1; margin: 6px 0 4px; }
  .price-card .sub { font-size: 9pt; opacity: 0.85; }
  .price-card .pill { display: inline-block; background: white; color: ${PRIMARY}; padding: 2px 10px; border-radius: 999px; font-size: 8pt; font-weight: 700; margin-left: 6px; }
  .faixa-tabela { background: #f8fafc; border-radius: 10px; padding: 14px 18px; margin-top: 10px; font-size: 9.5pt; }
  .faixa-tabela .titulo { font-weight: 700; color: ${PRIMARY}; margin-bottom: 6px; font-size: 10pt; }
  .faixa-tabela table { margin: 4px 0; font-size: 9pt; }
  .faixa-tabela th { background: transparent; color: ${PRIMARY}; padding: 4px 8px; border-bottom: 2px solid ${PRIMARY}; }
  .faixa-tabela td { padding: 4px 8px; border-bottom: 1px solid #e2e8f0; background: transparent; }
  .faixa-tabela tr.atual td { background: ${ACCENT}15; font-weight: 700; }

  /* PRÓXIMOS PASSOS */
  ol.steps { counter-reset: stp; list-style: none; padding: 0; }
  ol.steps li { counter-increment: stp; padding-left: 36px; position: relative; margin-bottom: 8px; font-size: 10pt; line-height: 1.4; }
  ol.steps li:before { content: counter(stp); position: absolute; left: 0; top: -2px; width: 26px; height: 26px; background: ${ACCENT}; color: white; border-radius: 50%; text-align: center; line-height: 26px; font-weight: 700; font-size: 11pt; }

  /* RODAPÉ FINAL */
  .footer { margin-top: 18mm; padding-top: 14px; border-top: 2px solid ${PRIMARY}; text-align: center; font-size: 9pt; color: #64748b; }
  .footer b { color: ${PRIMARY}; }
</style></head><body>

<!-- CAPA — Bruno R5-P5 #2 — Removido badge "PROPOSTA Nº" da capa (sob solicitação comercial). -->
<div class="cover">
  <div class="cover-top">
    <div class="logo">${logoBase64 ? `<img src="${logoBase64}" alt="ST"/>` : "ST"}</div>
    <div class="brand">Saúde do Trabalho</div>
  </div>
  <div class="cover-hero">
    <div class="cover-hero-text">
      <div class="cover-kicker">Proposta Comercial</div>
      <h1>Saúde<br>e Compliance<br>num só lugar.</h1>
      <p class="tagline">Plataforma integrada para gestão de SST, NR-01, Riscos Psicossociais, Treinamentos e Compliance — pronta pra escalar com sua operação.</p>
    </div>
    ${heroBase64 ? `<div class="cover-hero-img"><img src="${heroBase64}" alt="Plataforma"/></div>` : ""}
  </div>
  <div class="cover-card">
    <div class="row">
      <div><div class="lab">Apresentada a</div><div class="val">${escape(p.razao_social || "—")}</div></div>
      <div><div class="lab">Responsável</div><div class="val">${escape(p.responsavel || "—")}</div></div>
      <div><div class="lab">Emitida em</div><div class="val">${today}</div></div>
      <div><div class="lab">Validade</div><div class="val">${validadeStr}</div></div>
    </div>
  </div>
  <!-- Bruno R5-P5 #2 — Rodapé só com link institucional (nº removido). -->
  <div class="cover-footer" style="justify-content: center;">
    <a href="https://saudedotrabalho.com">saudedotrabalho.com</a>
  </div>
</div>

<!-- IDENTIFICAÇÃO -->
<div class="page">
  <h2><span class="num">1</span>Identificação do Cliente</h2>
  <p class="h2-sub">Dados cadastrais para emissão de contrato e nota fiscal.</p>
  <div class="info-grid">
    <div class="info-row"><div class="l">Razão Social</div><div class="v">${escape(p.razao_social || "—")}</div></div>
    <div class="info-row"><div class="l">Nome Fantasia</div><div class="v">${escape(p.nome_fantasia || "—")}</div></div>
    <div class="info-row"><div class="l">CNPJ</div><div class="v">${escape(p.cnpj || "—")}</div></div>
    <div class="info-row"><div class="l">Segmento</div><div class="v">${escape(p.segmento || "—")}</div></div>
    <div class="info-row"><div class="l">Responsável</div><div class="v">${escape(p.responsavel || "—")}${p.cargo ? " · "+escape(p.cargo) : ""}</div></div>
    <div class="info-row"><div class="l">Telefone</div><div class="v">${escape(p.telefone || "—")}</div></div>
    <div class="info-row"><div class="l">E-mail</div><div class="v">${escape(p.email || "—")}</div></div>
    <div class="info-row"><div class="l">Nº de Colaboradores</div><div class="v">${p.qtd_colaboradores ?? 0}${faixaTxt ? ` (faixa ${faixaTxt})` : ""}</div></div>
  </div>

  <h2 style="margin-top: 18mm;"><span class="num">2</span>A Plataforma</h2>
  <p class="h2-sub">SaaS completo para SST, em conformidade com NR-01 (Portaria MTP 1.419/2024), Lei 14.457/2022 (canal de denúncias) e LGPD.</p>

  ${proposalSpecificHtml}

  ${featuresHtml}
</div>

<!-- INVESTIMENTO -->
<div class="page">
  <h2><span class="num">3</span>Investimento</h2>
  <p class="h2-sub">${escape(packageLabel)} - ${escape(setupText)}.</p>

  <!-- Bruno R5-P5 #2 — Removido valor anual TOTAL. Mostra só MENSAL.
       (Cliente focava no anual, gerava impressão negativa logo de cara.) -->
  <div class="price-grid" style="grid-template-columns: 1fr;">
    <div class="price-card price-mensal" style="text-align: center; padding: 30px;">
      <div class="lab">Investimento Mensal</div>
      <div class="val" style="font-size: 38pt; margin: 10px 0 6px;">${fmtMoney(valorMensal)}</div>
      <div class="sub" style="font-size: 11pt;">${escape(packageLabel)} - Faixa <b>${faixaTxt || "-"}</b> - ${escape(setupText)}</div>
      <div class="sub" style="font-size: 9pt; margin-top: 4px;">Referencia anual: ${fmtMoney(valorAnual)}</div>
    </div>
  </div>

  <div class="faixa-tabela">
    <div class="titulo">Tabela de investimento mensal por faixa de colaboradores</div>
    <table>
      <thead><tr><th>Colaboradores</th><th style="text-align:right">Investimento mensal</th></tr></thead>
      <tbody>
        ${faixasAtuais.map(f => {
          const atual = Number(p.qtd_colaboradores || 0) >= f.min && Number(p.qtd_colaboradores || 0) <= f.max;
          return `<tr class="${atual ? "atual" : ""}"><td>${f.min === f.max ? f.min : (f.max >= 99999 ? `${f.min}+` : `${f.min} a ${f.max}`)}</td><td style="text-align:right">${fmtMoney(f.valor_mensal)}</td></tr>`;
        }).join("")}
      </tbody>
    </table>
    <div style="font-size: 8.5pt; color: #64748b; margin-top: 6px;">Valores promocionais — válidos enquanto durar a proposta. A linha em destaque é a faixa contratada nesta proposta.</div>
  </div>

  ${p.observacoes ? `<h3>Observações Comerciais</h3><p>${escape(p.observacoes)}</p>` : ""}

  <h2 style="margin-top: 14mm;"><span class="num">4</span>Próximos Passos</h2>
  <p class="h2-sub">Cronograma típico até a operação assistida — em média 7 dias úteis.</p>
  <ol class="steps">
    <li><b>Aprovação desta proposta</b> — formalize o aceite por e-mail ou assinatura digital.</li>
    <li><b>Assinatura do contrato</b> — modelo padrão SaaS com vigência anual renovável.</li>
    <li><b>Onboarding técnico</b> — criação da empresa, branding e SMTP corporativo.</li>
    <li><b>Importação dos colaboradores</b> — CSV de colaboradores, setores e filiais.</li>
    <li><b>Parametrização inicial</b> — PGR, ciclos psicossociais, biblioteca e campanhas.</li>
    <li><b>Treinamento dos usuários-chave</b> — SESMT, RH, Chefias e Super Admin.</li>
    <li><b>Início da operação assistida</b> — acompanhamento por 30 dias.</li>
  </ol>

  <div class="footer">
    Esta proposta tem validade até <b>${validadeStr}</b>.<br>
    <b>Saúde do Trabalho</b> · ${today} · saudedotrabalho.com
  </div>
</div>

</body></html>`;

  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium-browser",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", req => {
      const u = req.url();
      if (u.startsWith("https://fonts.googleapis") || u.startsWith("https://fonts.gstatic")) {
        req.abort();
      } else {
        req.continue();
      }
    });
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.pdf({ path: outPath, format: "A4", printBackground: true });
  } catch (err: any) {
    console.error("[crm] generateProposalPDF failed:", err?.message);
    throw err;
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
