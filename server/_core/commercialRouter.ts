import { TRPCError } from "@trpc/server";
import { sql as drzSql } from "drizzle-orm";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { getDb } from "../db";
import { protectedProcedure, router } from "./trpc";
import { getWhiteLabelPartnerIdForCompany } from "./whiteLabelAccess";
import { getEmailLinkBaseUrl, sendEmail } from "./email";
import { ensureCrmTables } from "./crm";

type CommercialScope = { ownerType: "global" | "white_label"; ownerId: number };

const DEFAULT_FEATURES = [
  ["Gestão e Comunicação", "drps", "DRPS", "Avaliação digital dos riscos psicossociais"],
  ["Gestão e Comunicação", "aep", "AEP", "Avaliação ergonômica preliminar"],
  ["Gestão e Comunicação", "campaigns", "Campanhas por E-mail", "Comunicação segmentada com colaboradores"],
  ["Gestão e Comunicação", "whatsapp", "WhatsApp", "Comunicação oficial quando a integração estiver disponível"],
  ["Gestão e Comunicação", "profiles", "Áreas por Perfil", "Experiências próprias para RH, SESMT, liderança e colaboradores"],
  ["Conformidade e Saúde", "pgr", "Gestão do PGR", "Inventário, plano de ação, evidências e documentos"],
  ["Conformidade e Saúde", "compliance", "Central de Conformidade", "Indicadores e pendências rastreáveis"],
  ["Conformidade e Saúde", "epi_epc", "Gestão de EPI/EPC", "Controle digital de equipamentos, entregas e recibos"],
  ["Conformidade e Saúde", "occupational_leave", "Atestados e Afastamentos", "Fluxo de validação, absenteísmo e retorno"],
  ["Conformidade e Saúde", "first_aid", "Primeiros Socorros", "Kits, aprendizagem e evidências"],
  ["Conformidade e Saúde", "cipa", "Gestão da CIPA", "Eleições, atas, reuniões e capacitação"],
  ["Conformidade e Saúde", "sipat", "SIPAT Digital", "Programação, conteúdo e participação"],
  ["Conteúdo e Aprendizagem", "courses", "Biblioteca de Cursos", "Treinamentos, trilhas e conteúdos digitais"],
  ["Conteúdo e Aprendizagem", "certificates", "Certificados", "Emissão automática e validação"],
  ["Conteúdo e Aprendizagem", "preventive", "Saúde Preventiva", "Campanhas e biblioteca preventiva"],
  ["Tecnologia e Operações", "ai", "Inteligência Artificial", "Assistentes para conteúdo, análises e documentos"],
  ["Tecnologia e Operações", "ocr", "OCR", "Leitura assistida de questionários e documentos"],
  ["Tecnologia e Operações", "survey_editor", "Editor Livre", "Criação de questionários personalizados"],
  ["Tecnologia e Operações", "integrations", "Integrações e APIs", "Preparação para integração com sistemas corporativos"],
  ["Tecnologia e Operações", "reports", "Dashboards e Relatórios", "Indicadores gerenciais, PDF e planilhas"],
] as const;

let tablesReady = false;

function rowsOf(result: any): any[] {
  return Array.isArray(result?.[0]) ? result[0] : Array.isArray(result) ? result : [];
}

async function ensureCommercialTables() {
  if (tablesReady) return;
  await ensureCrmTables();
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS commercial_brand_settings (
    owner_type VARCHAR(20) NOT NULL,
    owner_id INT NOT NULL DEFAULT 0,
    brand_name VARCHAR(180) NOT NULL,
    legal_name VARCHAR(255),
    logo_url VARCHAR(1024),
    primary_color VARCHAR(20) DEFAULT '#0E2C46',
    secondary_color VARCHAR(20) DEFAULT '#0096A6',
    presentation_text TEXT,
    objective_text TEXT,
    contact_name VARCHAR(180),
    contact_email VARCHAR(180),
    contact_phone VARCHAR(60),
    website VARCHAR(255),
    commercial_terms TEXT,
    next_steps_text TEXT,
    updated_by INT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (owner_type, owner_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS commercial_feature_catalog (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_type VARCHAR(20) NOT NULL,
    owner_id INT NOT NULL DEFAULT 0,
    category VARCHAR(120) NOT NULL,
    code VARCHAR(100) NOT NULL,
    name VARCHAR(180) NOT NULL,
    description TEXT,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_commercial_feature (owner_type, owner_id, code),
    INDEX idx_commercial_feature_scope (owner_type, owner_id, is_active, sort_order)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS commercial_plan_catalog (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_type VARCHAR(20) NOT NULL,
    owner_id INT NOT NULL DEFAULT 0,
    name VARCHAR(180) NOT NULL,
    description TEXT,
    billing_mode VARCHAR(30) NOT NULL DEFAULT 'fixed',
    fixed_monthly_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    price_per_employee DECIMAL(12,4) NOT NULL DEFAULT 0,
    setup_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    employee_limit INT NULL,
    cnpj_limit INT NULL,
    services_text TEXT,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_commercial_plan_scope (owner_type, owner_id, is_active, sort_order)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS commercial_plan_features (
    plan_id INT NOT NULL,
    feature_id INT NOT NULL,
    PRIMARY KEY (plan_id, feature_id),
    INDEX idx_commercial_plan_feature (feature_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS commercial_contracts_v2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_type VARCHAR(20) NOT NULL,
    owner_id INT NOT NULL DEFAULT 0,
    proposal_id INT NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    cnpj VARCHAR(30),
    plan_name VARCHAR(180),
    setup_value DECIMAL(12,2) DEFAULT 0,
    monthly_value DECIMAL(12,2) DEFAULT 0,
    start_date DATE,
    end_date DATE NULL,
    status VARCHAR(40) DEFAULT 'ativo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_contract_v2_scope (owner_type, owner_id, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS commercial_receivables_v2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_type VARCHAR(20) NOT NULL,
    owner_id INT NOT NULL DEFAULT 0,
    contract_id INT NOT NULL,
    proposal_id INT NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    reference_month VARCHAR(7),
    kind VARCHAR(30) DEFAULT 'mensalidade',
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    due_date DATE,
    paid_at DATETIME NULL,
    payment_method VARCHAR(40),
    status VARCHAR(30) DEFAULT 'pendente',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_receivable_v2_scope (owner_type, owner_id, status, due_date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  for (const col of [
    "commercial_owner_type VARCHAR(20) NOT NULL DEFAULT 'global'",
    "commercial_owner_id INT NOT NULL DEFAULT 0",
    "commercial_plan_id INT NULL",
    "proposal_title VARCHAR(255) NULL",
    "presentation_text TEXT NULL",
    "objective_text TEXT NULL",
    "selected_features_json JSON NULL",
    "services_json JSON NULL",
    "conditions_text TEXT NULL",
    "next_steps_text TEXT NULL",
    "discount_value DECIMAL(12,2) NOT NULL DEFAULT 0",
  ]) {
    try { await db.execute(drzSql.raw(`ALTER TABLE commercial_proposals ADD COLUMN ${col}`)); } catch {}
  }
  try { await db.execute(drzSql`CREATE INDEX idx_proposal_commercial_owner ON commercial_proposals(commercial_owner_type, commercial_owner_id, status, updated_at)`); } catch {}
  await db.execute(drzSql`UPDATE commercial_proposals SET commercial_owner_type='white_label', commercial_owner_id=white_label_partner_id WHERE white_label_partner_id IS NOT NULL AND white_label_partner_id>0 AND (commercial_owner_type='global' OR commercial_owner_id=0)`);
  tablesReady = true;
}

async function getScope(user: any): Promise<CommercialScope> {
  if (String(user?.role) === "super_admin") return { ownerType: "global", ownerId: 0 };
  if (String(user?.role) !== "company_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito ao SuperAdmin Global ou ao SuperAdmin da rede." });
  }
  const partnerId = Number(user?._whiteLabelPartnerId || 0)
    || await getWhiteLabelPartnerIdForCompany(Number(user?._originalCompanyId || user?.companyId || 0));
  if (!partnerId) throw new TRPCError({ code: "FORBIDDEN", message: "Rede White Label não identificada." });
  return { ownerType: "white_label", ownerId: partnerId };
}

async function seedScope(scope: CommercialScope) {
  await ensureCommercialTables();
  const db = await getDb(); if (!db) return;
  const existing: any = await db.execute(drzSql`SELECT COUNT(*) AS c FROM commercial_feature_catalog WHERE owner_type=${scope.ownerType} AND owner_id=${scope.ownerId}`);
  if (Number(rowsOf(existing)[0]?.c || 0) === 0) {
    for (let i = 0; i < DEFAULT_FEATURES.length; i++) {
      const [category, code, name, description] = DEFAULT_FEATURES[i];
      await db.execute(drzSql`INSERT INTO commercial_feature_catalog
        (owner_type, owner_id, category, code, name, description, sort_order)
        VALUES (${scope.ownerType}, ${scope.ownerId}, ${category}, ${code}, ${name}, ${description}, ${i + 1})`);
    }
  }
  const settings: any = await db.execute(drzSql`SELECT owner_id FROM commercial_brand_settings WHERE owner_type=${scope.ownerType} AND owner_id=${scope.ownerId}`);
  if (!rowsOf(settings).length) {
    if (scope.ownerType === "white_label") {
      const p: any = await db.execute(drzSql`SELECT legal_name, brand_name, logo_url, primary_color, secondary_color, contact_name, contact_email, contact_phone, custom_domain FROM white_label_partners WHERE id=${scope.ownerId} LIMIT 1`);
      const row = rowsOf(p)[0] || {};
      await db.execute(drzSql`INSERT INTO commercial_brand_settings
        (owner_type, owner_id, brand_name, legal_name, logo_url, primary_color, secondary_color, contact_email, contact_phone, website, presentation_text, objective_text, commercial_terms, next_steps_text)
        VALUES (${scope.ownerType}, ${scope.ownerId}, ${row.brand_name || row.legal_name || "Rede White Label"}, ${row.legal_name || null}, ${row.logo_url || null}, ${row.primary_color || "#0E2C46"}, ${row.secondary_color || "#0096A6"}, ${row.contact_email || null}, ${row.contact_phone || null}, ${row.custom_domain || null}, ${"Tecnologia e inteligência para uma gestão integrada de saúde e segurança do trabalho."}, ${"Apresentar uma solução aderente à realidade da organização, com implantação acompanhada e resultados mensuráveis."}, ${"Valores em reais. Condições, prazos e escopo sujeitos à aprovação comercial e formalização contratual."}, ${"Aprovação da proposta, alinhamento da implantação, assinatura contratual e início do projeto."})`);
    } else {
      await db.execute(drzSql`INSERT INTO commercial_brand_settings
        (owner_type, owner_id, brand_name, legal_name, logo_url, primary_color, secondary_color, contact_email, website, presentation_text, objective_text, commercial_terms, next_steps_text)
        VALUES ('global', 0, 'Saúde do Trabalho', 'Saúde do Trabalho', '/plataforma/logo-full.png', '#0E2C46', '#0096A6', 'contato@saudedotrabalho.com', 'saudedotrabalho.com', ${"Uma plataforma integrada para prevenção, conformidade, saúde ocupacional e desenvolvimento contínuo das pessoas."}, ${"Entregar uma operação digital, rastreável e simples para RH, SESMT, lideranças e colaboradores."}, ${"Valores em reais. Condições, prazos e escopo sujeitos à aprovação comercial e formalização contratual."}, ${"Aprovação da proposta, alinhamento da implantação, assinatura contratual e início do projeto."})`);
    }
  }
  const plans: any = await db.execute(drzSql`SELECT COUNT(*) AS c FROM commercial_plan_catalog WHERE owner_type=${scope.ownerType} AND owner_id=${scope.ownerId}`);
  if (Number(rowsOf(plans)[0]?.c || 0) === 0) {
    const defaults = scope.ownerType === "global"
      ? [["Enterprise Start", 2900, 2900], ["Enterprise Business", 6900, 6900], ["Enterprise Premium", 10500, 10500]]
      : [["Plano Essencial", 997, 1800], ["Plano Profissional", 1997, 3000], ["Plano Completo", 3797, 5400]];
    for (let i = 0; i < defaults.length; i++) {
      const [name, monthly, setup] = defaults[i] as [string, number, number];
      const ins: any = await db.execute(drzSql`INSERT INTO commercial_plan_catalog
        (owner_type, owner_id, name, description, fixed_monthly_price, setup_price, services_text, sort_order)
        VALUES (${scope.ownerType}, ${scope.ownerId}, ${name}, ${"Plano comercial configurável"}, ${monthly}, ${setup}, ${"Implantação assistida, treinamento inicial e suporte conforme escopo contratado."}, ${i + 1})`);
      const planId = Number((Array.isArray(ins) ? ins[0] : ins)?.insertId || 0);
      if (planId) {
        const features: any = await db.execute(drzSql`SELECT id FROM commercial_feature_catalog WHERE owner_type=${scope.ownerType} AND owner_id=${scope.ownerId} ORDER BY sort_order LIMIT ${i === 0 ? 8 : i === 1 ? 15 : 99}`);
        for (const f of rowsOf(features)) await db.execute(drzSql`INSERT IGNORE INTO commercial_plan_features (plan_id, feature_id) VALUES (${planId}, ${Number(f.id)})`);
      }
    }
  }

  // Corrige somente o defeito conhecido do seed padrão: Profissional e Completo
  // com conjuntos idênticos. Planos personalizados com outros nomes não são tocados.
  const defaultsResult: any = await db.execute(drzSql`SELECT p.id,p.name,GROUP_CONCAT(pf.feature_id ORDER BY pf.feature_id) feature_ids
    FROM commercial_plan_catalog p LEFT JOIN commercial_plan_features pf ON pf.plan_id=p.id
    WHERE p.owner_type=${scope.ownerType} AND p.owner_id=${scope.ownerId}
      AND p.name IN ('Plano Profissional','Plano Completo')
    GROUP BY p.id,p.name`);
  const defaultPlans = rowsOf(defaultsResult);
  const professional = defaultPlans.find((row: any) => row.name === "Plano Profissional");
  const complete = defaultPlans.find((row: any) => row.name === "Plano Completo");
  if (professional && complete && professional.feature_ids && professional.feature_ids === complete.feature_ids) {
    const featureResult: any = await db.execute(drzSql`SELECT id FROM commercial_feature_catalog WHERE owner_type=${scope.ownerType} AND owner_id=${scope.ownerId} AND is_active=1 ORDER BY sort_order,id`);
    const featureIds = rowsOf(featureResult).map((row: any) => Number(row.id));
    if (featureIds.length >= 15) {
      await db.execute(drzSql`DELETE FROM commercial_plan_features WHERE plan_id IN (${Number(professional.id)},${Number(complete.id)})`);
      for (const featureId of featureIds.slice(0, 8)) await db.execute(drzSql`INSERT IGNORE INTO commercial_plan_features (plan_id,feature_id) VALUES (${Number(professional.id)},${featureId})`);
      for (const featureId of featureIds.slice(0, 15)) await db.execute(drzSql`INSERT IGNORE INTO commercial_plan_features (plan_id,feature_id) VALUES (${Number(complete.id)},${featureId})`);
    }
  }
}

const commercialProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const scope = await getScope(ctx.user);
  await seedScope(scope);
  return next({ ctx: { ...ctx, commercialScope: scope } });
});

const planInput = z.object({
  id: z.number().int().positive().optional(), name: z.string().min(2).max(180), description: z.string().max(5000).optional(),
  billingMode: z.enum(["fixed", "per_employee", "hybrid"]).default("fixed"), fixedMonthlyPrice: z.number().min(0).default(0),
  pricePerEmployee: z.number().min(0).default(0), setupPrice: z.number().min(0).default(0), employeeLimit: z.number().int().min(0).nullable().optional(),
  cnpjLimit: z.number().int().min(0).nullable().optional(), servicesText: z.string().max(10000).optional(), featureIds: z.array(z.number().int().positive()).default([]),
  isActive: z.boolean().default(true), sortOrder: z.number().int().min(0).default(0),
});

const proposalInput = z.object({
  id: z.number().int().positive().optional(), proposalTitle: z.string().min(2).max(255), companyName: z.string().min(2).max(255), tradeName: z.string().max(255).optional(),
  cnpj: z.string().max(30).optional(), contactName: z.string().max(180).optional(), contactRole: z.string().max(120).optional(), contactEmail: z.string().max(180).optional(),
  contactPhone: z.string().max(60).optional(), employees: z.number().int().min(0).default(0), planId: z.number().int().positive().nullable().optional(),
  selectedFeatureIds: z.array(z.number().int().positive()).default([]), presentationText: z.string().max(20000).optional(), objectiveText: z.string().max(20000).optional(),
  setupValue: z.number().min(0).default(0), monthlyValue: z.number().min(0).default(0), discountValue: z.number().min(0).default(0), discountPct: z.number().min(0).max(100).default(0),
  services: z.array(z.object({ name: z.string().min(1), value: z.number().min(0).default(0), description: z.string().optional() })).default([]),
  conditionsText: z.string().max(20000).optional(), nextStepsText: z.string().max(20000).optional(), validityDays: z.number().int().min(1).max(365).default(15),
  status: z.enum(["lead", "negociacao", "proposta_enviada", "aguardando_retorno", "aprovada", "reprovada", "convertida"]).default("lead"), notes: z.string().max(20000).optional(),
});

export function scopeSql(scope: CommercialScope, alias = "") {
  const p = alias ? `${alias}.` : "";
  return `${p}commercial_owner_type='${scope.ownerType}' AND ${p}commercial_owner_id=${scope.ownerId}`;
}

function esc(value: any) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}

function money(value: any) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function logoDataUri(url?: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    if (url.startsWith("/uploads/")) {
      const file = path.join("/var/www/saudedotrabalho", url);
      if (fs.existsSync(file)) return `data:image/${path.extname(file).slice(1) || "png"};base64,${fs.readFileSync(file).toString("base64")}`;
    }
    if (url.startsWith("/plataforma/")) {
      const file = path.join(process.cwd(), "client", "public", url.replace("/plataforma/", ""));
      if (fs.existsSync(file)) return `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
    }
    if (/^https?:\/\//i.test(url)) {
      const response = await fetch(url);
      if (response.ok) return `data:${response.headers.get("content-type") || "image/png"};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
    }
  } catch {}
  return null;
}

async function createProposalPdf(scope: CommercialScope, proposalId: number) {
  const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const proposalResult: any = await db.execute(drzSql.raw(`SELECT p.*, pl.name AS plan_name, pl.description AS plan_description, pl.services_text AS plan_services
    FROM commercial_proposals p LEFT JOIN commercial_plan_catalog pl ON pl.id=p.commercial_plan_id
    WHERE p.id=${proposalId} AND ${scopeSql(scope, "p")} LIMIT 1`));
  const p = rowsOf(proposalResult)[0];
  if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Proposta não encontrada." });
  const brandResult: any = await db.execute(drzSql`SELECT * FROM commercial_brand_settings WHERE owner_type=${scope.ownerType} AND owner_id=${scope.ownerId} LIMIT 1`);
  const brand = rowsOf(brandResult)[0] || {};
  const allFeaturesResult: any = await db.execute(drzSql`SELECT id,category,name,description FROM commercial_feature_catalog WHERE owner_type=${scope.ownerType} AND owner_id=${scope.ownerId} AND is_active=1 ORDER BY category,sort_order,id`);
  const features = rowsOf(allFeaturesResult);
  const grouped = new Map<string, any[]>();
  for (const f of features) grouped.set(String(f.category), [...(grouped.get(String(f.category)) || []), f]);
  const services = (() => { try { return JSON.parse(p.services_json || "[]"); } catch { return []; } })();
  const primary = /^#[0-9a-f]{6}$/i.test(brand.primary_color || "") ? brand.primary_color : "#0E2C46";
  const secondary = /^#[0-9a-f]{6}$/i.test(brand.secondary_color || "") ? brand.secondary_color : "#0096A6";
  const logo = await logoDataUri(brand.logo_url);
  const monthly = Number(p.valor_mensal || 0);
  const setup = Number(p.setup_value || 0);
  const discount = Number(p.discount_value || 0);
  const servicesTotal = services.reduce((sum: number, item: any) => sum + Number(item.value || 0), 0);
  const total = Math.max(0, setup + monthly + servicesTotal - discount);
  const categoryHtml = [...grouped.entries()].map(([category, items]) => `<section><h2>${esc(category)}</h2><div class="feature-grid">${items.map((f) => `<div class="feature"><b>${esc(f.name)}</b><span>${esc(f.description || "Disponível no ecossistema da plataforma")}</span></div>`).join("")}</div></section>`).join("");
  const allPlansResult: any = await db.execute(drzSql`SELECT pl.*, GROUP_CONCAT(pf.feature_id) AS feature_ids FROM commercial_plan_catalog pl LEFT JOIN commercial_plan_features pf ON pf.plan_id=pl.id WHERE pl.owner_type=${scope.ownerType} AND pl.owner_id=${scope.ownerId} AND pl.is_active=1 GROUP BY pl.id ORDER BY pl.sort_order, pl.id`);
  const plans = rowsOf(allPlansResult);
  const matrixFeatures = features;
  const matrix = plans.length ? `<section><h2>Matriz de planos</h2><p class="small">A matriz comercial cadastrada é a fonte única de verdade para o CRM e para este documento.</p><table><thead><tr><th>Funcionalidade</th>${plans.map((x) => `<th>${esc(x.name)}</th>`).join("")}</tr></thead><tbody>${matrixFeatures.map((f) => `<tr><td><span class="small">${esc(f.category)}</span><br>${esc(f.name)}</td>${plans.map((pl) => `<td class="center">${String(pl.feature_ids || "").split(",").includes(String(f.id)) ? "Incluído" : "-"}</td>`).join("")}</tr>`).join("")}</tbody></table></section>` : "";
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
    @page{size:A4;margin:18mm 16mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#243447;margin:0;font-size:10.5pt;line-height:1.5}.cover{height:250mm;display:flex;flex-direction:column;justify-content:space-between;page-break-after:always;background:${primary};color:#fff;margin:-18mm -16mm;padding:28mm 22mm}.cover img{max-width:210px;max-height:90px;object-fit:contain;object-position:left center}.eyebrow{font-size:10pt;text-transform:uppercase;letter-spacing:1.5px;color:${secondary};font-weight:700}.cover h1{font-size:36pt;line-height:1.08;margin:24mm 0 8mm}.cover .client{font-size:19pt}.cover .meta{border-top:1px solid rgba(255,255,255,.35);padding-top:8mm}h2{font-size:18pt;color:${primary};border-bottom:3px solid ${secondary};padding-bottom:3mm;margin:10mm 0 5mm}h3{color:${primary};font-size:13pt}.lead{font-size:13pt;color:#475569}.feature-grid{display:grid;grid-template-columns:1fr 1fr;gap:4mm}.feature{border:1px solid #dbe5ea;padding:4mm;border-radius:6px;min-height:24mm}.feature b{display:block;color:${primary};font-size:11pt}.feature span{display:block;color:#64748b;font-size:9pt;margin-top:2mm}.investment{background:#f3f7f9;border-left:5px solid ${secondary};padding:6mm;margin:6mm 0}.price{font-size:24pt;color:${primary};font-weight:800}.small{font-size:8.5pt;color:#64748b}table{width:100%;border-collapse:collapse;font-size:8.5pt}th{background:${primary};color:white;text-align:left;padding:2.5mm}td{border-bottom:1px solid #dbe5ea;padding:2.5mm}.center{text-align:center}.footer{margin-top:14mm;border-top:1px solid #dbe5ea;padding-top:5mm;color:#64748b}.page-break{page-break-before:always}section{break-inside:avoid}
  </style></head><body>
  <div class="cover"><div>${logo ? `<img src="${logo}">` : `<div style="font-size:22pt;font-weight:800">${esc(brand.brand_name)}</div>`}</div><div><div class="eyebrow">Proposta comercial</div><h1>${esc(p.proposal_title || "Solução integrada em Saúde e Segurança do Trabalho")}</h1><div class="client">Preparada para ${esc(p.razao_social)}</div></div><div class="meta">Validade: ${Number(p.validade_dias || 15)} dias<br>Emissão: ${new Date().toLocaleDateString("pt-BR")}</div></div>
  <section><div class="eyebrow">Apresentação</div><h2>${esc(brand.brand_name || "Nossa plataforma")}</h2><p class="lead">${esc(p.presentation_text || brand.presentation_text || "")}</p><h3>Objetivo da proposta</h3><p>${esc(p.objective_text || brand.objective_text || "")}</p><p><b>Cliente:</b> ${esc(p.razao_social)}${p.cnpj ? ` | <b>CNPJ:</b> ${esc(p.cnpj)}` : ""}<br><b>Responsável:</b> ${esc(p.responsavel || "A definir")} | <b>Colaboradores:</b> ${Number(p.qtd_colaboradores || 0).toLocaleString("pt-BR")}</p></section>
  <section><div class="eyebrow">Ecossistema completo</div><h2>Todas as funcionalidades disponíveis</h2><p>Conheça o universo completo da plataforma. A matriz seguinte demonstra com transparência o que está incluído em cada plano comercial.</p></section>
  ${categoryHtml || `<section><h2>Funcionalidades disponíveis</h2><p>O catálogo comercial ainda não possui funcionalidades ativas.</p></section>`}
  <div class="page-break"></div>${matrix}
  <section><h2>Investimento personalizado</h2><div class="investment"><div class="small">PLANO SELECIONADO</div><h3>${esc(p.plan_name || "Plano personalizado")}</h3><p>${esc(p.plan_description || "")}</p><div class="price">${money(monthly)}<span style="font-size:11pt"> / mês</span></div>${setup ? `<p><b>Implantação:</b> ${money(setup)}</p>` : ""}${discount ? `<p><b>Desconto comercial:</b> ${money(discount)}</p>` : ""}${services.map((s: any) => `<p><b>${esc(s.name)}:</b> ${money(s.value)} ${esc(s.description || "")}</p>`).join("")}<p><b>Investimento inicial estimado:</b> ${money(total)}</p></div><p>${Number(p.qtd_colaboradores || 0) > 0 ? `O investimento recorrente corresponde a aproximadamente <b>${money(monthly / Number(p.qtd_colaboradores))} por colaborador/mês</b> e ${money(monthly / Number(p.qtd_colaboradores) / 30)} por colaborador/dia.` : ""}</p></section>
  <section><h2>Condições comerciais</h2><p>${esc(p.conditions_text || brand.commercial_terms || "")}</p><h2>Próximos passos</h2><p>${esc(p.next_steps_text || brand.next_steps_text || "")}</p></section>
  <div class="footer"><b>${esc(brand.contact_name || brand.brand_name || "Contato comercial")}</b><br>${esc(brand.contact_email || "")} ${brand.contact_phone ? ` | ${esc(brand.contact_phone)}` : ""}<br>${esc(brand.website || "")}</div>
  </body></html>`;
  const puppeteer = (await import("puppeteer")).default;
  const outDir = process.env.NODE_ENV === "production" ? "/var/www/saudedotrabalho/uploads/proposals" : path.join(process.cwd(), "uploads", "proposals");
  fs.mkdirSync(outDir, { recursive: true });
  const filename = `proposta_${scope.ownerType}_${scope.ownerId}_${proposalId}_${Date.now()}.pdf`;
  const outPath = path.join(outDir, filename);
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  try { const page = await browser.newPage(); await page.setContent(html, { waitUntil: "load", timeout: 30000 }); await page.pdf({ path: outPath, format: "A4", printBackground: true }); } finally { await browser.close(); }
  const url = `/uploads/proposals/${filename}`;
  await db.execute(drzSql`UPDATE commercial_proposals SET pdf_url=${url} WHERE id=${proposalId} AND commercial_owner_type=${scope.ownerType} AND commercial_owner_id=${scope.ownerId}`);
  return url;
}

export const commercialRouter = router({
  context: commercialProcedure.query(async ({ ctx }) => {
    const scope = (ctx as any).commercialScope as CommercialScope;
    const db = await getDb(); if (!db) return null;
    const brand: any = await db.execute(drzSql`SELECT * FROM commercial_brand_settings WHERE owner_type=${scope.ownerType} AND owner_id=${scope.ownerId} LIMIT 1`);
    const metrics: any = await db.execute(drzSql.raw(`SELECT COUNT(*) AS proposals, COALESCE(SUM(CASE WHEN status IN ('aprovada','convertida') THEN valor_mensal ELSE 0 END),0) AS approved_mrr, COUNT(CASE WHEN status IN ('lead','negociacao','proposta_enviada','aguardando_retorno') THEN 1 END) AS open_pipeline FROM commercial_proposals WHERE ${scopeSql(scope)}`));
    const finance: any = await db.execute(drzSql`SELECT COALESCE(SUM(CASE WHEN status='recebido' THEN amount ELSE 0 END),0) AS received, COALESCE(SUM(CASE WHEN status IN ('pendente','atrasado') THEN amount ELSE 0 END),0) AS pending FROM commercial_receivables_v2 WHERE owner_type=${scope.ownerType} AND owner_id=${scope.ownerId}`);
    return { scope, brand: rowsOf(brand)[0], metrics: rowsOf(metrics)[0], finance: rowsOf(finance)[0] };
  }),
  saveSettings: commercialProcedure.input(z.object({ brandName: z.string().min(2), legalName: z.string().optional(), logoUrl: z.string().optional(), primaryColor: z.string(), secondaryColor: z.string(), presentationText: z.string().optional(), objectiveText: z.string().optional(), contactName: z.string().optional(), contactEmail: z.string().optional(), contactPhone: z.string().optional(), website: z.string().optional(), commercialTerms: z.string().optional(), nextStepsText: z.string().optional() })).mutation(async ({ ctx, input }) => {
    const s = (ctx as any).commercialScope as CommercialScope; const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.execute(drzSql`UPDATE commercial_brand_settings SET brand_name=${input.brandName}, legal_name=${input.legalName || null}, logo_url=${input.logoUrl || null}, primary_color=${input.primaryColor}, secondary_color=${input.secondaryColor}, presentation_text=${input.presentationText || null}, objective_text=${input.objectiveText || null}, contact_name=${input.contactName || null}, contact_email=${input.contactEmail || null}, contact_phone=${input.contactPhone || null}, website=${input.website || null}, commercial_terms=${input.commercialTerms || null}, next_steps_text=${input.nextStepsText || null}, updated_by=${ctx.user.id} WHERE owner_type=${s.ownerType} AND owner_id=${s.ownerId}`);
    return { ok: true };
  }),
  listFeatures: commercialProcedure.query(async ({ ctx }) => { const s = (ctx as any).commercialScope as CommercialScope; const db = await getDb(); if (!db) return []; const r: any = await db.execute(drzSql`SELECT * FROM commercial_feature_catalog WHERE owner_type=${s.ownerType} AND owner_id=${s.ownerId} ORDER BY category, sort_order, name`); return rowsOf(r); }),
  upsertFeature: commercialProcedure.input(z.object({ id: z.number().int().positive().optional(), category: z.string().min(2), code: z.string().min(2), name: z.string().min(2), description: z.string().optional(), isActive: z.boolean().default(true), sortOrder: z.number().int().default(0) })).mutation(async ({ ctx, input }) => {
    const s = (ctx as any).commercialScope as CommercialScope; const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    if (input.id) await db.execute(drzSql`UPDATE commercial_feature_catalog SET category=${input.category}, code=${input.code}, name=${input.name}, description=${input.description || null}, is_active=${input.isActive ? 1 : 0}, sort_order=${input.sortOrder} WHERE id=${input.id} AND owner_type=${s.ownerType} AND owner_id=${s.ownerId}`);
    else await db.execute(drzSql`INSERT INTO commercial_feature_catalog (owner_type, owner_id, category, code, name, description, is_active, sort_order) VALUES (${s.ownerType}, ${s.ownerId}, ${input.category}, ${input.code}, ${input.name}, ${input.description || null}, ${input.isActive ? 1 : 0}, ${input.sortOrder})`);
    return { ok: true };
  }),
  listPlans: commercialProcedure.query(async ({ ctx }) => { const s = (ctx as any).commercialScope as CommercialScope; const db = await getDb(); if (!db) return []; const r: any = await db.execute(drzSql`SELECT p.*, GROUP_CONCAT(pf.feature_id) AS feature_ids FROM commercial_plan_catalog p LEFT JOIN commercial_plan_features pf ON pf.plan_id=p.id WHERE p.owner_type=${s.ownerType} AND p.owner_id=${s.ownerId} GROUP BY p.id ORDER BY p.sort_order, p.id`); return rowsOf(r).map((x) => ({ ...x, featureIds: String(x.feature_ids || "").split(",").filter(Boolean).map(Number) })); }),
  upsertPlan: commercialProcedure.input(planInput).mutation(async ({ ctx, input }) => {
    const s = (ctx as any).commercialScope as CommercialScope; const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" }); let id = input.id || 0;
    if (id) { const owned: any = await db.execute(drzSql`SELECT id FROM commercial_plan_catalog WHERE id=${id} AND owner_type=${s.ownerType} AND owner_id=${s.ownerId}`); if (!rowsOf(owned).length) throw new TRPCError({ code: "FORBIDDEN" }); await db.execute(drzSql`UPDATE commercial_plan_catalog SET name=${input.name}, description=${input.description || null}, billing_mode=${input.billingMode}, fixed_monthly_price=${input.fixedMonthlyPrice}, price_per_employee=${input.pricePerEmployee}, setup_price=${input.setupPrice}, employee_limit=${input.employeeLimit ?? null}, cnpj_limit=${input.cnpjLimit ?? null}, services_text=${input.servicesText || null}, is_active=${input.isActive ? 1 : 0}, sort_order=${input.sortOrder} WHERE id=${id}`); }
    else { const r: any = await db.execute(drzSql`INSERT INTO commercial_plan_catalog (owner_type, owner_id, name, description, billing_mode, fixed_monthly_price, price_per_employee, setup_price, employee_limit, cnpj_limit, services_text, is_active, sort_order) VALUES (${s.ownerType}, ${s.ownerId}, ${input.name}, ${input.description || null}, ${input.billingMode}, ${input.fixedMonthlyPrice}, ${input.pricePerEmployee}, ${input.setupPrice}, ${input.employeeLimit ?? null}, ${input.cnpjLimit ?? null}, ${input.servicesText || null}, ${input.isActive ? 1 : 0}, ${input.sortOrder})`); id = Number((Array.isArray(r) ? r[0] : r)?.insertId || 0); }
    await db.execute(drzSql`DELETE FROM commercial_plan_features WHERE plan_id=${id}`); for (const featureId of input.featureIds) { const owned: any = await db.execute(drzSql`SELECT id FROM commercial_feature_catalog WHERE id=${featureId} AND owner_type=${s.ownerType} AND owner_id=${s.ownerId}`); if (rowsOf(owned).length) await db.execute(drzSql`INSERT INTO commercial_plan_features (plan_id, feature_id) VALUES (${id}, ${featureId})`); }
    return { ok: true, id };
  }),
  listProposals: commercialProcedure.query(async ({ ctx }) => { const s = (ctx as any).commercialScope as CommercialScope; const db = await getDb(); if (!db) return []; const r: any = await db.execute(drzSql.raw(`SELECT p.*, pl.name AS plan_name FROM commercial_proposals p LEFT JOIN commercial_plan_catalog pl ON pl.id=p.commercial_plan_id WHERE ${scopeSql(s, "p")} ORDER BY p.updated_at DESC, p.id DESC LIMIT 500`)); return rowsOf(r); }),
  upsertProposal: commercialProcedure.input(proposalInput).mutation(async ({ ctx, input }) => {
    const s = (ctx as any).commercialScope as CommercialScope; const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    if (input.planId) { const owned: any = await db.execute(drzSql`SELECT id FROM commercial_plan_catalog WHERE id=${input.planId} AND owner_type=${s.ownerType} AND owner_id=${s.ownerId}`); if (!rowsOf(owned).length) throw new TRPCError({ code: "FORBIDDEN", message: "Plano fora do ambiente comercial." }); }
    const annual = input.monthlyValue * 12; const selected = JSON.stringify(input.selectedFeatureIds); const services = JSON.stringify(input.services); let id = input.id || 0;
    if (id) { const owned: any = await db.execute(drzSql`SELECT id FROM commercial_proposals WHERE id=${id} AND commercial_owner_type=${s.ownerType} AND commercial_owner_id=${s.ownerId}`); if (!rowsOf(owned).length) throw new TRPCError({ code: "FORBIDDEN" }); await db.execute(drzSql`UPDATE commercial_proposals SET proposal_title=${input.proposalTitle}, razao_social=${input.companyName}, nome_fantasia=${input.tradeName || input.companyName}, cnpj=${input.cnpj || null}, responsavel=${input.contactName || null}, cargo=${input.contactRole || null}, email=${input.contactEmail || null}, telefone=${input.contactPhone || null}, qtd_colaboradores=${input.employees}, commercial_plan_id=${input.planId ?? null}, selected_features_json=${selected}, presentation_text=${input.presentationText || null}, objective_text=${input.objectiveText || null}, setup_value=${input.setupValue}, valor_mensal=${input.monthlyValue}, valor_anual=${annual}, valor_total=${annual + input.setupValue - input.discountValue}, discount_value=${input.discountValue}, desconto_pct=${input.discountPct}, services_json=${services}, conditions_text=${input.conditionsText || null}, next_steps_text=${input.nextStepsText || null}, validade_dias=${input.validityDays}, status=${input.status}, observacoes=${input.notes || null} WHERE id=${id}`); }
    else { const r: any = await db.execute(drzSql`INSERT INTO commercial_proposals (commercial_owner_type, commercial_owner_id, white_label_partner_id, proposal_title, razao_social, nome_fantasia, cnpj, responsavel, cargo, email, telefone, qtd_colaboradores, commercial_plan_id, selected_features_json, presentation_text, objective_text, setup_value, valor_mensal, valor_anual, valor_total, discount_value, desconto_pct, services_json, conditions_text, next_steps_text, validade_dias, status, observacoes, created_by_user_id) VALUES (${s.ownerType}, ${s.ownerId}, ${s.ownerType === "white_label" ? s.ownerId : null}, ${input.proposalTitle}, ${input.companyName}, ${input.tradeName || input.companyName}, ${input.cnpj || null}, ${input.contactName || null}, ${input.contactRole || null}, ${input.contactEmail || null}, ${input.contactPhone || null}, ${input.employees}, ${input.planId ?? null}, ${selected}, ${input.presentationText || null}, ${input.objectiveText || null}, ${input.setupValue}, ${input.monthlyValue}, ${annual}, ${annual + input.setupValue - input.discountValue}, ${input.discountValue}, ${input.discountPct}, ${services}, ${input.conditionsText || null}, ${input.nextStepsText || null}, ${input.validityDays}, ${input.status}, ${input.notes || null}, ${ctx.user.id})`); id = Number((Array.isArray(r) ? r[0] : r)?.insertId || 0); }
    return { ok: true, id };
  }),
  generatePdf: commercialProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => ({ url: await createProposalPdf((ctx as any).commercialScope, input.id) })),
  sendProposal: commercialProcedure.input(z.object({ id: z.number().int().positive(), message: z.string().max(5000).optional() })).mutation(async ({ ctx, input }) => {
    const s=(ctx as any).commercialScope as CommercialScope; const db=await getDb(); if(!db)throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
    const r:any=await db.execute(drzSql.raw(`SELECT p.*, b.brand_name FROM commercial_proposals p JOIN commercial_brand_settings b ON b.owner_type=p.commercial_owner_type AND b.owner_id=p.commercial_owner_id WHERE p.id=${input.id} AND ${scopeSql(s,"p")} LIMIT 1`));
    const p=rowsOf(r)[0]; if(!p)throw new TRPCError({code:"NOT_FOUND"}); if(!p.email)throw new TRPCError({code:"BAD_REQUEST",message:"Informe o e-mail do responsável antes de enviar."});
    const pdfUrl=p.pdf_url || await createProposalPdf(s,input.id); const link=`${getEmailLinkBaseUrl()}${pdfUrl}`;
    const sent=await sendEmail({to:p.email,toName:p.responsavel||undefined,subject:`Proposta comercial - ${p.brand_name}`,html:`<p>Olá, ${esc(p.responsavel||"tudo bem")}.</p><p>${esc(input.message||"Preparamos uma proposta comercial personalizada para sua organização.")}</p><p><a href="${esc(link)}">Visualizar proposta em PDF</a></p><p>Atenciosamente,<br><b>${esc(p.brand_name)}</b></p>`});
    if(!sent.ok)throw new TRPCError({code:"INTERNAL_SERVER_ERROR",message:sent.error||"Falha no envio."}); await db.execute(drzSql`UPDATE commercial_proposals SET status='proposta_enviada', pdf_url=${pdfUrl} WHERE id=${input.id}`); return{ok:true,preview:sent.preview,url:pdfUrl};
  }),
  approveProposal: commercialProcedure.input(z.object({ id: z.number().int().positive(), createFinancialSchedule: z.boolean().default(true) })).mutation(async ({ ctx, input }) => {
    const s = (ctx as any).commercialScope as CommercialScope; const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" }); const r: any = await db.execute(drzSql.raw(`SELECT p.*, pl.name AS plan_name FROM commercial_proposals p LEFT JOIN commercial_plan_catalog pl ON pl.id=p.commercial_plan_id WHERE p.id=${input.id} AND ${scopeSql(s, "p")} LIMIT 1`)); const p = rowsOf(r)[0]; if (!p) throw new TRPCError({ code: "NOT_FOUND" }); await db.execute(drzSql`UPDATE commercial_proposals SET status='aprovada' WHERE id=${input.id}`);
    if (input.createFinancialSchedule) { const ex: any = await db.execute(drzSql`SELECT id FROM commercial_contracts_v2 WHERE proposal_id=${input.id} AND owner_type=${s.ownerType} AND owner_id=${s.ownerId}`); if (!rowsOf(ex).length) { const today = new Date().toISOString().slice(0,10); const c: any = await db.execute(drzSql`INSERT INTO commercial_contracts_v2 (owner_type, owner_id, proposal_id, company_name, cnpj, plan_name, setup_value, monthly_value, start_date) VALUES (${s.ownerType}, ${s.ownerId}, ${input.id}, ${p.razao_social}, ${p.cnpj || null}, ${p.plan_name || null}, ${Number(p.setup_value || 0)}, ${Number(p.valor_mensal || 0)}, ${today})`); const contractId = Number((Array.isArray(c) ? c[0] : c)?.insertId || 0); if (Number(p.setup_value || 0) > 0) await db.execute(drzSql`INSERT INTO commercial_receivables_v2 (owner_type, owner_id, contract_id, proposal_id, company_name, reference_month, kind, amount, due_date) VALUES (${s.ownerType}, ${s.ownerId}, ${contractId}, ${input.id}, ${p.razao_social}, ${today.slice(0,7)}, 'setup', ${Number(p.setup_value)}, ${today})`); for (let i=0;i<12;i++){ const d=new Date(); d.setMonth(d.getMonth()+i); const due=d.toISOString().slice(0,10); await db.execute(drzSql`INSERT INTO commercial_receivables_v2 (owner_type, owner_id, contract_id, proposal_id, company_name, reference_month, kind, amount, due_date) VALUES (${s.ownerType}, ${s.ownerId}, ${contractId}, ${input.id}, ${p.razao_social}, ${due.slice(0,7)}, 'mensalidade', ${Number(p.valor_mensal || 0)}, ${due})`); } } }
    return { ok: true };
  }),
  finance: commercialProcedure.query(async ({ ctx }) => { const s=(ctx as any).commercialScope as CommercialScope; const db=await getDb(); if(!db)return {contracts:[],receivables:[]}; await db.execute(drzSql`UPDATE commercial_receivables_v2 SET status='atrasado' WHERE owner_type=${s.ownerType} AND owner_id=${s.ownerId} AND status='pendente' AND due_date<CURDATE()`); const c:any=await db.execute(drzSql`SELECT * FROM commercial_contracts_v2 WHERE owner_type=${s.ownerType} AND owner_id=${s.ownerId} ORDER BY id DESC`); const r:any=await db.execute(drzSql`SELECT * FROM commercial_receivables_v2 WHERE owner_type=${s.ownerType} AND owner_id=${s.ownerId} ORDER BY due_date DESC,id DESC LIMIT 1000`); return {contracts:rowsOf(c),receivables:rowsOf(r)}; }),
  updateReceivable: commercialProcedure.input(z.object({ id:z.number().int().positive(), status:z.enum(["pendente","recebido","atrasado","cancelado"]), paymentMethod:z.string().max(40).optional() })).mutation(async({ctx,input})=>{const s=(ctx as any).commercialScope as CommercialScope;const db=await getDb();if(!db)throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});await db.execute(drzSql`UPDATE commercial_receivables_v2 SET status=${input.status}, payment_method=${input.paymentMethod||null}, paid_at=${input.status==="recebido"?new Date():null} WHERE id=${input.id} AND owner_type=${s.ownerType} AND owner_id=${s.ownerId}`);return{ok:true};}),
});
