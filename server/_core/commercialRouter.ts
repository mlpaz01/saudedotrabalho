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

const DEFAULT_PILLARS = [
  ["business_intelligence", "Business Intelligence e Visão 360°", "Diretoria"],
  ["sesmt_intelligence", "Centro de Inteligência SESMT", "SESMT"],
  ["occupational_health", "Saúde Ocupacional e Conformidade", "Saúde Ocupacional"],
  ["annual_health_report", "Relatório Analítico Anual de Saúde Ocupacional", "Saúde Ocupacional"],
  ["safety_engineering", "Engenharia de Segurança e Inteligência SST", "Engenharia"],
  ["esocial", "eSocial - SST Digital", "Integrações"],
  ["cipa_sipat", "CIPA, SIPAT e Segurança Comportamental", "Prevenção"],
  ["learning", "Gestão de Treinamentos e Aprendizagem", "Aprendizagem"],
  ["engagement", "Campanhas, Comunicação e Engajamento", "Comunicação"],
  ["governance", "Governança, Compliance e Controles Internos", "Governança"],
  ["technology", "Tecnologia, Inteligência Artificial e OCR", "Tecnologia"],
  ["integrations", "Integrações e Ecossistema Digital", "Integrações"],
  ["reports", "Relatórios, Indicadores e Auditoria", "Indicadores"],
  ["executive_report", "Relatório Executivo de SST", "Diretoria"],
  ["integrated_intelligence", "Inteligência Integrada - PGR x PCMSO x SESMT", "Integração Técnica"],
  ["multi_company", "Arquitetura Multiempresa e White Label", "Arquitetura"],
  ["strategic_differentials", "Diferenciais Estratégicos da Plataforma", "Estratégia"],
] as const;

const FEATURE_PILLAR: Record<string, string> = {
  drps: "integrated_intelligence", aep: "integrated_intelligence", campaigns: "engagement",
  whatsapp: "engagement", profiles: "strategic_differentials", corporate_minutes: "governance",
  ethics_channel: "governance", pgr: "safety_engineering", pcmso: "occupational_health",
  medical_center: "occupational_health", exam_requests: "occupational_health", cat: "esocial",
  ppp: "esocial", vaccination: "occupational_health", compliance: "governance",
  epi_epc: "sesmt_intelligence", occupational_leave: "occupational_health", first_aid: "sesmt_intelligence",
  cipa: "cipa_sipat", sipat: "cipa_sipat", dds: "cipa_sipat", courses: "learning",
  certificates: "learning", preventive: "learning", ai_studio: "technology", ai: "technology",
  ocr: "technology", survey_editor: "technology", integrations: "integrations", reports: "reports",
};

const DEFAULT_ADDONS = [
  ["esocial", "Integração eSocial", "Integração, validação, protocolos e retornos do eSocial"],
  ["totvs", "Integração TOTVS RM", "Conector corporativo sob projeto e homologação"],
  ["api", "API Corporativa", "Acesso controlado a APIs e webhooks"],
  ["white_label", "White Label", "Marca, domínio e ambiente comercial próprios"],
  ["multi_cnpj", "CNPJs adicionais", "Expansão da franquia multiempresa"],
  ["ai_credits", "Créditos adicionais de IA", "Franquia adicional para recursos de inteligência artificial"],
  ["ocr_credits", "Créditos adicionais de OCR", "Franquia adicional para leitura de documentos"],
  ["storage", "Armazenamento adicional", "Espaço adicional para documentos e evidências"],
] as const;

const DEFAULT_BANDS = [
  ["1-10", 1, 10], ["11-30", 11, 30], ["31-100", 31, 100],
  ["101-300", 101, 300], ["301-500", 301, 500],
  ["501-1000", 501, 1000], ["1001+", 1001, 999999],
] as const;

export const COMMERCIAL_STATUS_PROBABILITY: Record<string, number> = {
  novo_lead: 10, em_contato: 20, reuniao_agendada: 30, reuniao_realizada: 40,
  proposta_em_elaboracao: 50, proposta_enviada: 60, negociacao: 70,
  aguardando_retorno: 70, follow_up: 70, aprovada: 90,
  contrato_em_assinatura: 95, convertida: 100, perdida: 0, pausada: 10,
};

const DEFAULT_FEATURES = [
  ["Gestão e Comunicação", "drps", "DRPS", "Avaliação digital dos riscos psicossociais"],
  ["Gestão e Comunicação", "aep", "AEP", "Avaliação ergonômica preliminar"],
  ["Gestão e Comunicação", "campaigns", "Campanhas por E-mail", "Comunicação segmentada com colaboradores"],
  ["Gestão e Comunicação", "whatsapp", "WhatsApp", "Comunicação oficial quando a integração estiver disponível"],
  ["Gestão e Comunicação", "profiles", "Áreas por Perfil", "Experiências próprias para RH, SESMT, liderança e colaboradores"],
  ["Gestão e Comunicação", "corporate_minutes", "Atas Corporativas", "Reuniões, decisões, assinaturas, evidências e planos de ação"],
  ["Gestão e Comunicação", "ethics_channel", "Canal de Ética e Denúncias", "Relatos protegidos, acompanhamento e rastreabilidade"],
  ["Conformidade e Saúde", "pgr", "Gestão do PGR", "Inventário, plano de ação, evidências e documentos"],
  ["Conformidade e Saúde", "pcmso", "PCMSO Integrado", "Programa médico conectado ao PGR, GSEs e exames"],
  ["Conformidade e Saúde", "medical_center", "Central Médica", "Prontuário ocupacional, atendimentos e histórico clínico restrito"],
  ["Conformidade e Saúde", "exam_requests", "Exames, Requisições e ASO", "Planejamento por GSE, requisições e acompanhamento ocupacional"],
  ["Conformidade e Saúde", "cat", "CAT Digital", "Comunicação de acidente com conferência e preparação eSocial"],
  ["Conformidade e Saúde", "ppp", "PPP e Histórico Laboral", "Linha do tempo ocupacional integrada ao PGR, LTCAT e exames"],
  ["Conformidade e Saúde", "vaccination", "Vacinação Corporativa", "Campanhas, doses, comprovantes e alertas"],
  ["Conformidade e Saúde", "compliance", "Central de Conformidade", "Indicadores e pendências rastreáveis"],
  ["Conformidade e Saúde", "epi_epc", "Gestão de EPI/EPC", "Controle digital de equipamentos, entregas e recibos"],
  ["Conformidade e Saúde", "occupational_leave", "Atestados e Afastamentos", "Fluxo de validação, absenteísmo e retorno"],
  ["Conformidade e Saúde", "first_aid", "Primeiros Socorros", "Kits, aprendizagem e evidências"],
  ["Conformidade e Saúde", "cipa", "Gestão da CIPA", "Eleições, atas, reuniões e capacitação"],
  ["Conformidade e Saúde", "sipat", "SIPAT Digital", "Programação, conteúdo e participação"],
  ["Conformidade e Saúde", "dds", "DDS Online", "Diálogo diário de segurança com presença, aceite e protocolo"],
  ["Conteúdo e Aprendizagem", "courses", "Biblioteca de Cursos", "Treinamentos, trilhas e conteúdos digitais"],
  ["Conteúdo e Aprendizagem", "certificates", "Certificados", "Emissão automática e validação"],
  ["Conteúdo e Aprendizagem", "preventive", "Saúde Preventiva", "Campanhas e biblioteca preventiva"],
  ["Conteúdo e Aprendizagem", "ai_studio", "Estúdio de Conteúdo com IA", "Cursos e pesquisas estruturados com apoio de inteligência artificial"],
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

async function ensureColumn(db: any, table: string, name: string, definition: string) {
  try {
    await db.execute(drzSql.raw(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`));
  } catch {}
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
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS commercial_pillars (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_type VARCHAR(20) NOT NULL,
    owner_id INT NOT NULL DEFAULT 0,
    code VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(160),
    description TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_commercial_pillar (owner_type,owner_id,code),
    INDEX idx_commercial_pillar_scope (owner_type,owner_id,is_active,sort_order)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS commercial_addons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_type VARCHAR(20) NOT NULL,
    owner_id INT NOT NULL DEFAULT 0,
    code VARCHAR(100) NOT NULL,
    name VARCHAR(180) NOT NULL,
    description TEXT,
    billing_mode VARCHAR(30) NOT NULL DEFAULT 'fixed',
    unit_price DECIMAL(12,4) NOT NULL DEFAULT 0,
    setup_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    unit_label VARCHAR(80),
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_commercial_addon (owner_type,owner_id,code),
    INDEX idx_commercial_addon_scope (owner_type,owner_id,is_active,sort_order)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS commercial_pricing_bands (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_type VARCHAR(20) NOT NULL,
    owner_id INT NOT NULL DEFAULT 0,
    label VARCHAR(80) NOT NULL,
    min_employees INT NOT NULL,
    max_employees INT NOT NULL,
    minimum_monthly DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount_pct DECIMAL(6,2) NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_commercial_band (owner_type,owner_id,label),
    INDEX idx_commercial_band_scope (owner_type,owner_id,is_active,sort_order)
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
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS commercial_proposal_activities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_type VARCHAR(20) NOT NULL,
    owner_id INT NOT NULL DEFAULT 0,
    proposal_id INT NOT NULL,
    activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    contact_type VARCHAR(60) NOT NULL DEFAULT 'outro',
    old_status VARCHAR(60),
    new_status VARCHAR(60),
    description TEXT,
    next_step TEXT,
    next_contact_date DATE,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_commercial_activity (owner_type,owner_id,proposal_id,activity_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await ensureColumn(db, "commercial_feature_catalog", "pillar_code", "VARCHAR(100) NULL");
  await ensureColumn(db, "commercial_feature_catalog", "subtitle", "VARCHAR(255) NULL");
  await ensureColumn(db, "commercial_feature_catalog", "module_name", "VARCHAR(180) NULL");
  await ensureColumn(db, "commercial_feature_catalog", "limitations_text", "TEXT NULL");
  await ensureColumn(db, "commercial_feature_catalog", "is_addon_eligible", "TINYINT(1) NOT NULL DEFAULT 0");
  await ensureColumn(db, "commercial_plan_features", "access_level", "VARCHAR(30) NOT NULL DEFAULT 'included'");
  await ensureColumn(db, "commercial_plan_features", "limitations_text", "TEXT NULL");
  await ensureColumn(db, "commercial_plan_catalog", "storage_gb", "DECIMAL(12,2) NULL");
  await ensureColumn(db, "commercial_plan_catalog", "ai_credits", "BIGINT NULL");
  await ensureColumn(db, "commercial_plan_catalog", "ocr_credits", "BIGINT NULL");
  await ensureColumn(db, "commercial_plan_catalog", "minimum_monthly", "DECIMAL(12,2) NOT NULL DEFAULT 0");
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
    "presented_plan_ids_json JSON NULL",
    "plan_overrides_json JSON NULL",
    "recommended_plan_id INT NULL",
    "selected_plan_id INT NULL",
    "implementation_days INT NULL",
    "payment_terms_text TEXT NULL",
    "conditions_text TEXT NULL",
    "next_steps_text TEXT NULL",
    "discount_value DECIMAL(12,2) NOT NULL DEFAULT 0",
    "city_state VARCHAR(180) NULL",
    "commercial_owner_name VARCHAR(180) NULL",
    "first_contact_date DATE NULL",
    "meeting_date DATE NULL",
    "proposal_sent_date DATE NULL",
    "next_contact_date DATE NULL",
    "probability_pct DECIMAL(6,2) NOT NULL DEFAULT 10",
    "loss_reason VARCHAR(180) NULL",
    "selected_addons_json JSON NULL",
    "technical_annex_url VARCHAR(500) NULL",
    "proposal_number VARCHAR(80) NULL",
    "proposal_version INT NOT NULL DEFAULT 1",
  ]) {
    try { await db.execute(drzSql.raw(`ALTER TABLE commercial_proposals ADD COLUMN ${col}`)); } catch {}
  }
  try { await db.execute(drzSql`ALTER TABLE commercial_proposals MODIFY status VARCHAR(60) NOT NULL DEFAULT 'novo_lead'`); } catch {}
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

const seedScopeInFlight = new Map<string, Promise<void>>();

async function seedScopeUnlocked(scope: CommercialScope) {
  await ensureCommercialTables();
  const db = await getDb(); if (!db) return;
  for (let i = 0; i < DEFAULT_PILLARS.length; i++) {
    const [code, name, category] = DEFAULT_PILLARS[i];
    await db.execute(drzSql`INSERT INTO commercial_pillars
      (owner_type,owner_id,code,name,category,sort_order)
      VALUES (${scope.ownerType},${scope.ownerId},${code},${name},${category},${i + 1})
      ON DUPLICATE KEY UPDATE name=VALUES(name),category=VALUES(category),sort_order=VALUES(sort_order)`);
  }
  for (let i = 0; i < DEFAULT_ADDONS.length; i++) {
    const [code, name, description] = DEFAULT_ADDONS[i];
    await db.execute(drzSql`INSERT INTO commercial_addons
      (owner_type,owner_id,code,name,description,sort_order)
      VALUES (${scope.ownerType},${scope.ownerId},${code},${name},${description},${i + 1})
      ON DUPLICATE KEY UPDATE code=VALUES(code)`);
  }
  for (let i = 0; i < DEFAULT_BANDS.length; i++) {
    const [label, min, max] = DEFAULT_BANDS[i];
    await db.execute(drzSql`INSERT INTO commercial_pricing_bands
      (owner_type,owner_id,label,min_employees,max_employees,sort_order)
      VALUES (${scope.ownerType},${scope.ownerId},${label},${min},${max},${i + 1})
      ON DUPLICATE KEY UPDATE label=VALUES(label)`);
  }
  for (let i = 0; i < DEFAULT_FEATURES.length; i++) {
    const [category, code, name, description] = DEFAULT_FEATURES[i];
    await db.execute(drzSql`INSERT INTO commercial_feature_catalog
      (owner_type, owner_id, category, code, name, description, pillar_code, module_name, sort_order)
      VALUES (${scope.ownerType}, ${scope.ownerId}, ${category}, ${code}, ${name}, ${description}, ${FEATURE_PILLAR[code] || "strategic_differentials"}, ${category}, ${i + 1})
      ON DUPLICATE KEY UPDATE code=VALUES(code)`);
    await db.execute(drzSql`UPDATE commercial_feature_catalog SET pillar_code=${FEATURE_PILLAR[code] || "strategic_differentials"},module_name=COALESCE(module_name,category) WHERE owner_type=${scope.ownerType} AND owner_id=${scope.ownerId} AND code=${code} AND pillar_code IS NULL`);
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
  const officialPlans = [
    ["Essential", "Psicossocial e NR-01", 7.9, ["drps", "aep", "reports"]],
    ["Professional", "Gestão Preventiva de SST", 12.9, ["drps", "aep", "pgr", "epi_epc", "cipa", "sipat", "dds", "courses", "certificates", "reports"]],
    ["Business", "Saúde Ocupacional e SST Integrado", 19.9, ["drps", "aep", "pgr", "pcmso", "medical_center", "exam_requests", "cat", "ppp", "vaccination", "compliance", "epi_epc", "occupational_leave", "first_aid", "cipa", "sipat", "dds", "courses", "certificates", "preventive", "reports"]],
    ["Enterprise", "Gestão Corporativa Integrada", 29.9, DEFAULT_FEATURES.map(item => item[1])],
  ] as const;
  for (let i = 0; i < officialPlans.length; i++) {
    const [name, description, employeePrice, featureCodes] = officialPlans[i];
    const existing: any = await db.execute(drzSql`SELECT id FROM commercial_plan_catalog WHERE owner_type=${scope.ownerType} AND owner_id=${scope.ownerId} AND name=${name} ORDER BY is_active DESC,updated_at DESC,id DESC LIMIT 1`);
    let planId = Number(rowsOf(existing)[0]?.id || 0);
    if (!planId) {
      const inserted: any = await db.execute(drzSql`INSERT INTO commercial_plan_catalog
        (owner_type,owner_id,name,description,billing_mode,fixed_monthly_price,price_per_employee,setup_price,services_text,is_active,sort_order)
        VALUES (${scope.ownerType},${scope.ownerId},${name},${description},'per_employee',0,${employeePrice},0,'Implantação e suporte conforme condições comerciais configuradas.',1,${i + 1})`);
      planId = Number((inserted as any)[0]?.insertId || 0);
    }
    const featureResult: any = await db.execute(drzSql`SELECT id,code FROM commercial_feature_catalog WHERE owner_type=${scope.ownerType} AND owner_id=${scope.ownerId} AND is_active=1`);
    for (const feature of rowsOf(featureResult)) {
      if ((featureCodes as readonly string[]).includes(String(feature.code)))
        await db.execute(drzSql`INSERT IGNORE INTO commercial_plan_features (plan_id,feature_id,access_level) VALUES (${planId},${Number(feature.id)},'included')`);
    }

    // Multiple tRPC queries can open the CRM together. Consolidate any plans
    // created by an older concurrent seed without deleting their history.
    const duplicatesResult: any = await db.execute(drzSql`SELECT id FROM commercial_plan_catalog
      WHERE owner_type=${scope.ownerType} AND owner_id=${scope.ownerId} AND name=${name} AND id<>${planId}`);
    for (const duplicate of rowsOf(duplicatesResult)) {
      const duplicateId = Number(duplicate.id);
      await db.execute(drzSql`INSERT IGNORE INTO commercial_plan_features (plan_id,feature_id,access_level,limitations_text)
        SELECT ${planId},feature_id,access_level,limitations_text FROM commercial_plan_features WHERE plan_id=${duplicateId}`);
      await db.execute(drzSql`UPDATE commercial_proposals SET commercial_plan_id=${planId} WHERE commercial_plan_id=${duplicateId}`);
      await db.execute(drzSql`UPDATE commercial_proposals SET selected_plan_id=${planId} WHERE selected_plan_id=${duplicateId}`);
      await db.execute(drzSql`UPDATE commercial_proposals SET recommended_plan_id=${planId} WHERE recommended_plan_id=${duplicateId}`);
      await db.execute(drzSql`UPDATE commercial_plan_catalog SET is_active=0 WHERE id=${duplicateId}`);
    }
    await db.execute(drzSql`UPDATE commercial_plan_catalog SET is_active=1 WHERE id=${planId}`);
  }
  await db.execute(drzSql`UPDATE commercial_plan_catalog SET is_active=0 WHERE owner_type=${scope.ownerType} AND owner_id=${scope.ownerId} AND name IN ('Enterprise Start','Enterprise Business','Enterprise Premium','Plano Essencial','Plano Profissional','Plano Completo')`);

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
  const fullPlansResult: any = await db.execute(drzSql`SELECT id FROM commercial_plan_catalog WHERE owner_type=${scope.ownerType} AND owner_id=${scope.ownerId} AND name='Enterprise'`);
  const activeFeaturesResult: any = await db.execute(drzSql`SELECT id FROM commercial_feature_catalog WHERE owner_type=${scope.ownerType} AND owner_id=${scope.ownerId} AND is_active=1`);
  for (const plan of rowsOf(fullPlansResult))
    for (const feature of rowsOf(activeFeaturesResult))
      await db.execute(drzSql`INSERT IGNORE INTO commercial_plan_features (plan_id,feature_id) VALUES (${Number(plan.id)},${Number(feature.id)})`);
}

async function seedScope(scope: CommercialScope) {
  const key = `${scope.ownerType}:${scope.ownerId}`;
  const current = seedScopeInFlight.get(key);
  if (current) return current;

  const seed = seedScopeUnlocked(scope).finally(() => seedScopeInFlight.delete(key));
  seedScopeInFlight.set(key, seed);
  return seed;
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
  storageGb: z.number().min(0).nullable().optional(), aiCredits: z.number().int().min(0).nullable().optional(), ocrCredits: z.number().int().min(0).nullable().optional(),
  minimumMonthly: z.number().min(0).default(0),
  isActive: z.boolean().default(true), sortOrder: z.number().int().min(0).default(0),
});

const proposalInput = z.object({
  id: z.number().int().positive().optional(), proposalTitle: z.string().min(2).max(255), companyName: z.string().min(2).max(255), tradeName: z.string().max(255).optional(),
  cnpj: z.string().max(30).optional(), contactName: z.string().max(180).optional(), contactRole: z.string().max(120).optional(), contactEmail: z.string().max(180).optional(),
  contactPhone: z.string().max(60).optional(), employees: z.number().int().min(0).default(0), planId: z.number().int().positive().nullable().optional(),
  presentedPlans: z.array(z.object({ planId: z.number().int().positive(), monthlyValue: z.number().min(0), setupValue: z.number().min(0), employees: z.number().int().min(0), featureIds: z.array(z.number().int().positive()).default([]), optionalFeatureIds: z.array(z.number().int().positive()).default([]), limitsText: z.string().max(5000).optional() })).min(1).max(12),
  recommendedPlanId: z.number().int().positive().nullable().optional(), selectedPlanId: z.number().int().positive().nullable().optional(),
  selectedFeatureIds: z.array(z.number().int().positive()).default([]), presentationText: z.string().max(20000).optional(), objectiveText: z.string().max(20000).optional(),
  setupValue: z.number().min(0).default(0), monthlyValue: z.number().min(0).default(0), discountValue: z.number().min(0).default(0), discountPct: z.number().min(0).max(100).default(0),
  services: z.array(z.object({ name: z.string().min(1), value: z.number().min(0).default(0), description: z.string().optional() })).default([]),
  conditionsText: z.string().max(20000).optional(), nextStepsText: z.string().max(20000).optional(), validityDays: z.number().int().min(1).max(365).default(15),
  implementationDays: z.number().int().min(0).max(730).nullable().optional(), paymentTermsText: z.string().max(10000).optional(),
  cityState: z.string().max(180).optional(), commercialOwnerName: z.string().max(180).optional(),
  firstContactDate: z.string().nullable().optional(), meetingDate: z.string().nullable().optional(), proposalSentDate: z.string().nullable().optional(), nextContactDate: z.string().nullable().optional(),
  lossReason: z.string().max(180).optional(), selectedAddonIds: z.array(z.number().int().positive()).default([]),
  status: z.enum(["lead", "novo_lead", "em_contato", "reuniao_agendada", "reuniao_realizada", "proposta_em_elaboracao", "negociacao", "proposta_enviada", "aguardando_retorno", "follow_up", "aprovada", "contrato_em_assinatura", "reprovada", "perdida", "pausada", "convertida"]).default("novo_lead"), notes: z.string().max(20000).optional(),
});

export function probabilityForCommercialStatus(status: string) {
  const legacy: Record<string, number> = { lead: 10, negociacao: 70, proposta_enviada: 60, aguardando_retorno: 70, aprovada: 90, reprovada: 0, convertida: 100 };
  return COMMERCIAL_STATUS_PROBABILITY[status] ?? legacy[status] ?? 10;
}

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
      const file = path.join(process.cwd(), url.replace(/^\/+/, ""));
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
  const presentedIds: number[] = (() => { try { return JSON.parse(p.presented_plan_ids_json || "[]").map(Number); } catch { return []; } })();
  const overrides: any[] = (() => { try { return JSON.parse(p.plan_overrides_json || "[]"); } catch { return []; } })();
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
  const allPlans = rowsOf(allPlansResult);
  const plans = (presentedIds.length ? allPlans.filter((plan: any) => presentedIds.includes(Number(plan.id))) : allPlans).map((plan: any) => {
    const override = overrides.find((item: any) => Number(item.planId) === Number(plan.id)) || {};
    const employees = Number(override.employees ?? p.qtd_colaboradores ?? 0);
    const isLegacySelectedPlan = Number(p.commercial_plan_id) === Number(plan.id) && Number(p.valor_mensal || 0) > 0;
    const monthly = override.monthlyValue != null
      ? Number(override.monthlyValue)
      : isLegacySelectedPlan
        ? Number(p.valor_mensal)
        : Number(plan.fixed_monthly_price || 0) + Number(plan.price_per_employee || 0) * employees;
    const planSetup = override.setupValue != null
      ? Number(override.setupValue)
      : isLegacySelectedPlan && Number(p.setup_value || 0) > 0
        ? Number(p.setup_value)
        : Number(plan.setup_price || 0);
    return { ...plan, proposalMonthly: monthly, proposalSetup: planSetup, proposalEmployees: employees, proposalFeatureIds: Array.isArray(override.featureIds) ? override.featureIds.map(Number) : String(plan.feature_ids || "").split(",").filter(Boolean).map(Number), proposalOptionalFeatureIds: Array.isArray(override.optionalFeatureIds) ? override.optionalFeatureIds.map(Number) : [], proposalLimits: override.limitsText || "" };
  });
  const matrixFeatures = features;
  const matrix = plans.length ? `<section><h2>Matriz comparativa dos planos</h2><p class="small">✓ Incluído &nbsp;&nbsp; — Não incluído &nbsp;&nbsp; * Adicional/opcional. A recomendação comercial não representa contratação.</p><table><thead><tr><th>Funcionalidade</th>${plans.map((x: any) => `<th>${esc(x.name)}${Number(p.recommended_plan_id) === Number(x.id) ? `<br><span class="recommended">★ Recomendado</span>` : ""}${Number(p.selected_plan_id) === Number(x.id) ? `<br><span class="contracted">Selecionado</span>` : ""}</th>`).join("")}</tr></thead><tbody>${matrixFeatures.map((f) => `<tr><td><span class="small">${esc(f.category)}</span><br>${esc(f.name)}</td>${plans.map((pl: any) => `<td class="center">${pl.proposalFeatureIds.includes(Number(f.id)) ? "✓ Incluído" : pl.proposalOptionalFeatureIds.includes(Number(f.id)) ? "* Adicional" : "— Não incluído"}</td>`).join("")}</tr>`).join("")}</tbody></table></section>` : "";
  const investmentOptions = plans.map((plan: any) => { const employees = Number(plan.proposalEmployees || p.qtd_colaboradores || 0); const perEmployee = employees ? plan.proposalMonthly / employees : 0; return `<div class="plan-option ${Number(p.recommended_plan_id) === Number(plan.id) ? "is-recommended" : ""}"><div class="plan-label">${Number(p.selected_plan_id) === Number(plan.id) ? "PLANO SELECIONADO" : Number(p.recommended_plan_id) === Number(plan.id) ? "PLANO RECOMENDADO" : "PLANO DISPONÍVEL"}</div><h3>${esc(plan.name)}</h3><p>${esc(plan.description || "")}</p><div class="price">${money(plan.proposalMonthly)}<span> / mês</span></div><p><b>Implantação:</b> ${money(plan.proposalSetup)}<br><b>Colaboradores considerados:</b> ${employees.toLocaleString("pt-BR")}${plan.employee_limit ? `<br><b>Limite do plano:</b> ${Number(plan.employee_limit).toLocaleString("pt-BR")} colaboradores` : ""}${plan.cnpj_limit ? `<br><b>Limite:</b> ${Number(plan.cnpj_limit).toLocaleString("pt-BR")} CNPJ(s)` : ""}${plan.proposalLimits ? `<br>${esc(plan.proposalLimits)}` : ""}</p>${employees ? `<p class="small">${money(perEmployee)} por colaborador/mês · ${money(perEmployee / 30)} por colaborador/dia</p>` : ""}</div>`; }).join("");
  const chosenPlan = plans.find((plan:any)=>Number(plan.id)===Number(p.selected_plan_id)) || plans.find((plan:any)=>Number(plan.id)===Number(p.recommended_plan_id)) || plans[0];
  const principalFeatures = chosenPlan ? features.filter((feature:any)=>chosenPlan.proposalFeatureIds.includes(Number(feature.id))).slice(0,14) : [];
  const addonIds:number[]=(()=>{try{return JSON.parse(p.selected_addons_json||"[]").map(Number)}catch{return[]}})();
  const addonResult:any=addonIds.length?await db.execute(drzSql.raw(`SELECT name,description,unit_price,setup_price FROM commercial_addons WHERE id IN (${addonIds.join(",")}) AND owner_type='${scope.ownerType}' AND owner_id=${scope.ownerId}`)):null;
  const selectedAddons=rowsOf(addonResult);
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
    @page{size:A4;margin:18mm 16mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#243447;margin:0;font-size:10.5pt;line-height:1.5}.cover{height:250mm;display:flex;flex-direction:column;justify-content:space-between;page-break-after:always;background:${primary};color:#fff;margin:-18mm -16mm;padding:28mm 22mm}.cover img{max-width:210px;max-height:90px;object-fit:contain;object-position:left center}.eyebrow{font-size:10pt;text-transform:uppercase;letter-spacing:1.5px;color:${secondary};font-weight:700}.cover h1{font-size:36pt;line-height:1.08;margin:24mm 0 8mm}.cover .client{font-size:19pt}.cover .meta{border-top:1px solid rgba(255,255,255,.35);padding-top:8mm}h2{font-size:18pt;color:${primary};border-bottom:3px solid ${secondary};padding-bottom:3mm;margin:10mm 0 5mm;break-after:avoid}h3{color:${primary};font-size:13pt}.lead{font-size:13pt;color:#475569}.feature-grid{display:grid;grid-template-columns:1fr 1fr;gap:4mm}.feature{border:1px solid #dbe5ea;padding:4mm;border-radius:6px;min-height:24mm;break-inside:avoid}.feature b{display:block;color:${primary};font-size:11pt}.feature span{display:block;color:#64748b;font-size:9pt;margin-top:2mm}.investment{background:#f3f7f9;border-left:5px solid ${secondary};padding:6mm;margin:6mm 0}.price{font-size:24pt;color:${primary};font-weight:800}.price span{font-size:11pt}.small{font-size:8.5pt;color:#64748b}table{width:100%;border-collapse:collapse;font-size:8.5pt}thead{display:table-header-group}tr{break-inside:avoid}th{background:${primary};color:white;text-align:left;padding:2.5mm}td{border-bottom:1px solid #dbe5ea;padding:2.5mm}.center{text-align:center}.footer{margin-top:14mm;border-top:1px solid #dbe5ea;padding-top:5mm;color:#64748b}.page-break{break-before:page;height:0}.recommended{color:#ffe082;font-size:8pt}.contracted{color:#b7f7cf;font-size:8pt}.plan-options{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}.plan-option{border:1px solid #dbe5ea;padding:5mm;break-inside:avoid}.plan-option.is-recommended{border:2px solid ${secondary}}.plan-label{font-size:7.5pt;font-weight:700;color:${secondary}}
  </style></head><body>
  <div class="cover"><div>${logo ? `<img src="${logo}">` : `<div style="font-size:22pt;font-weight:800">${esc(brand.brand_name)}</div>`}</div><div><div class="eyebrow">Proposta comercial</div><h1>${esc(p.proposal_title || "Solução integrada em Saúde e Segurança do Trabalho")}</h1><div class="client">Preparada para ${esc(p.razao_social)}</div></div><div class="meta">Validade: ${Number(p.validade_dias || 15)} dias<br>Emissão: ${new Date().toLocaleDateString("pt-BR")}</div></div>
  <section><div class="eyebrow">Apresentação</div><h2>${esc(brand.brand_name || "Nossa plataforma")}</h2><p class="lead">${esc(p.presentation_text || brand.presentation_text || "")}</p><h3>Objetivo da proposta</h3><p>${esc(p.objective_text || brand.objective_text || "")}</p><p><b>Cliente:</b> ${esc(p.razao_social)}${p.cnpj ? ` | <b>CNPJ:</b> ${esc(p.cnpj)}` : ""}<br><b>Responsável:</b> ${esc(p.responsavel || "A definir")} | <b>Colaboradores:</b> ${Number(p.qtd_colaboradores || 0).toLocaleString("pt-BR")}</p></section>
  <section><div class="eyebrow">Escopo comercial</div><h2>${chosenPlan ? esc(chosenPlan.name) : "Solução proposta"}</h2><p>${chosenPlan ? esc(chosenPlan.description || "") : "Escopo personalizado conforme premissas desta proposta."}</p><div class="feature-grid">${principalFeatures.map((f:any)=>`<div class="feature"><b>${esc(f.name)}</b><span>${esc(f.description||"")}</span></div>`).join("") || `<p>As funcionalidades serão detalhadas no Anexo Técnico.</p>`}</div><p class="small">O catálogo completo, os 17 pilares e a matriz de disponibilidade por plano são apresentados no documento separado “Anexo Técnico - Catálogo de Funcionalidades”.</p></section>
  <section><h2>Investimento personalizado</h2><div class="plan-options">${investmentOptions}</div>${selectedAddons.length?`<div class="investment"><h3>Add-ons selecionados</h3>${selectedAddons.map((a:any)=>`<p><b>${esc(a.name)}:</b> ${money(a.unit_price)} ${a.setup_price?` + setup ${money(a.setup_price)}`:""}<br><span class="small">${esc(a.description||"")}</span></p>`).join("")}</div>`:""}${services.length ? `<div class="investment"><h3>Serviços e custos adicionais</h3>${services.map((s: any) => `<p><b>${esc(s.name)}:</b> ${money(s.value)} ${esc(s.description || "")}</p>`).join("")}</div>` : ""}${discount ? `<p><b>Desconto comercial condicionado:</b> ${money(discount)}</p>` : ""}</section>
  <section><h2>Condições comerciais</h2><p>${esc(p.conditions_text || brand.commercial_terms || "")}</p>${p.payment_terms_text ? `<h3>Condições de pagamento</h3><p>${esc(p.payment_terms_text)}</p>` : ""}${p.implementation_days ? `<p><b>Prazo estimado de implantação:</b> ${Number(p.implementation_days)} dias.</p>` : ""}<h2>Próximos passos</h2><p>${esc(p.next_steps_text || brand.next_steps_text || "")}</p></section>
  <div class="footer"><b>${esc(brand.contact_name || brand.brand_name || "Contato comercial")}</b><br>${esc(brand.contact_email || "")} ${brand.contact_phone ? ` | ${esc(brand.contact_phone)}` : ""}<br>${esc(brand.website || "")}</div>
  </body></html>`;
  const puppeteer = (await import("puppeteer")).default;
  const outDir = path.join(process.cwd(), "uploads", "proposals");
  fs.mkdirSync(outDir, { recursive: true });
  const version = p.pdf_url ? Number(p.proposal_version || 1) + 1 : Number(p.proposal_version || 1);
  const filename = `proposta_${scope.ownerType}_${scope.ownerId}_${proposalId}_v${version}_${Date.now()}.pdf`;
  const outPath = path.join(outDir, filename);
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  try { const page = await browser.newPage(); await page.setContent(html, { waitUntil: "load", timeout: 30000 }); await page.pdf({ path: outPath, format: "A4", printBackground: true }); } finally { await browser.close(); }
  const url = `/uploads/proposals/${filename}`;
  await db.execute(drzSql`UPDATE commercial_proposals SET pdf_url=${url},proposal_version=${version} WHERE id=${proposalId} AND commercial_owner_type=${scope.ownerType} AND commercial_owner_id=${scope.ownerId}`);
  return url;
}

async function createTechnicalAnnexPdf(scope: CommercialScope, proposalId: number) {
  const db=await getDb();if(!db)throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
  const proposalResult:any=await db.execute(drzSql.raw(`SELECT * FROM commercial_proposals WHERE id=${proposalId} AND ${scopeSql(scope)} LIMIT 1`));
  const proposal=rowsOf(proposalResult)[0];if(!proposal)throw new TRPCError({code:"NOT_FOUND",message:"Proposta não encontrada."});
  const [brandResult,pillarsResult,featuresResult,plansResult]:any[]=await Promise.all([
    db.execute(drzSql`SELECT * FROM commercial_brand_settings WHERE owner_type=${scope.ownerType} AND owner_id=${scope.ownerId} LIMIT 1`),
    db.execute(drzSql`SELECT * FROM commercial_pillars WHERE owner_type=${scope.ownerType} AND owner_id=${scope.ownerId} AND is_active=1 ORDER BY sort_order,id`),
    db.execute(drzSql`SELECT * FROM commercial_feature_catalog WHERE owner_type=${scope.ownerType} AND owner_id=${scope.ownerId} AND is_active=1 ORDER BY sort_order,id`),
    db.execute(drzSql`SELECT p.*,GROUP_CONCAT(pf.feature_id) feature_ids FROM commercial_plan_catalog p LEFT JOIN commercial_plan_features pf ON pf.plan_id=p.id WHERE p.owner_type=${scope.ownerType} AND p.owner_id=${scope.ownerId} AND p.is_active=1 GROUP BY p.id ORDER BY p.sort_order,p.id`),
  ]);
  const brand=rowsOf(brandResult)[0]||{};const pillars=rowsOf(pillarsResult);const features=rowsOf(featuresResult);const plans=rowsOf(plansResult).map((p:any)=>({...p,featureIds:String(p.feature_ids||"").split(",").filter(Boolean).map(Number)}));
  const primary=/^#[0-9a-f]{6}$/i.test(brand.primary_color||"")?brand.primary_color:"#0E2C46";const secondary=/^#[0-9a-f]{6}$/i.test(brand.secondary_color||"")?brand.secondary_color:"#0096A6";const logo=await logoDataUri(brand.logo_url);
  const pillarSections=pillars.map((pillar:any,index:number)=>{const items=features.filter((feature:any)=>String(feature.pillar_code||"strategic_differentials")===String(pillar.code));return `<section><div class="number">${String(index+1).padStart(2,"0")}</div><h2>${esc(pillar.name)}</h2><p class="category">${esc(pillar.category||"")}</p>${items.length?items.map((item:any)=>`<div class="feature"><div><b>${esc(item.name)}</b><span>${esc(item.module_name||item.category||"")}</span></div><p>${esc(item.description||"")}${item.limitations_text?`<br><i>Limitações: ${esc(item.limitations_text)}</i>`:""}</p></div>`).join(""):`<p class="empty">Pilar disponível para parametrização comercial deste ambiente.</p>`}</section>`}).join("");
  const matrix=`<section class="page"><h2>Matriz de disponibilidade por plano</h2><p class="legend">✓ Incluído &nbsp; — Não incluído. Add-ons e condições especiais devem constar expressamente na proposta comercial.</p><table><thead><tr><th>Funcionalidade</th>${plans.map((plan:any)=>`<th>${esc(plan.name)}</th>`).join("")}</tr></thead><tbody>${features.map((feature:any)=>`<tr><td><small>${esc(feature.pillar_code||"")}</small><br>${esc(feature.name)}</td>${plans.map((plan:any)=>`<td class="center">${plan.featureIds.includes(Number(feature.id))?"✓":"—"}</td>`).join("")}</tr>`).join("")}</tbody></table></section>`;
  const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>@page{size:A4;margin:16mm 15mm}*{box-sizing:border-box}body{font-family:Arial;color:#263746;font-size:9.5pt;line-height:1.45;margin:0}.cover{height:260mm;margin:-16mm -15mm;padding:27mm 22mm;background:${primary};color:#fff;display:flex;flex-direction:column;justify-content:space-between;page-break-after:always}.cover img{max-width:210px;max-height:85px;object-fit:contain;object-position:left}.cover h1{font-size:31pt;line-height:1.08;margin:0}.cover p{font-size:13pt}.meta{border-top:1px solid rgba(255,255,255,.35);padding-top:7mm}section{position:relative;margin-bottom:9mm;break-inside:auto}h2{font-size:16pt;color:${primary};border-bottom:3px solid ${secondary};padding:0 0 2mm 13mm;margin:0 0 4mm;break-after:avoid}.number{position:absolute;left:0;top:0;color:${secondary};font-weight:800}.category{margin:-2mm 0 4mm 13mm;color:#64748b}.feature{display:grid;grid-template-columns:42mm 1fr;gap:5mm;border-bottom:1px solid #dfe7eb;padding:3mm 0;break-inside:avoid}.feature b{display:block;color:${primary}}.feature span,.feature p,small{color:#64748b;font-size:8.5pt}.feature p{margin:0}.empty{padding:4mm;background:#f3f7f9}.page{break-before:page}table{width:100%;border-collapse:collapse;font-size:7.8pt}thead{display:table-header-group}tr{break-inside:avoid}th{background:${primary};color:#fff;padding:2mm;text-align:left}td{border-bottom:1px solid #dfe7eb;padding:2mm}.center{text-align:center;font-weight:700}.legend{color:#64748b}.notice{border-left:4px solid ${secondary};background:#f3f7f9;padding:5mm;margin-top:8mm}</style></head><body><div class="cover"><div>${logo?`<img src="${logo}">`:`<b style="font-size:22pt">${esc(brand.brand_name)}</b>`}</div><div><p>ANEXO TÉCNICO</p><h1>Catálogo de Funcionalidades</h1><p>17 pilares da Plataforma Saúde do Trabalho</p></div><div class="meta"><b>Proposta:</b> ${esc(proposal.proposal_number||proposal.id)}<br><b>Cliente:</b> ${esc(proposal.razao_social)}<br><b>Versão:</b> ${Number(proposal.proposal_version||1)} · ${new Date().toLocaleDateString("pt-BR")}</div></div>${pillarSections}${matrix}<div class="notice"><b>Regra de disponibilidade</b><br>Este catálogo técnico apresenta o universo de recursos da plataforma. A disponibilidade efetiva depende do plano, dos add-ons e das condições formalizadas na proposta e no contrato. Recursos de integração dependem de configuração, credenciais e homologação dos sistemas envolvidos.</div></body></html>`;
  const puppeteer=(await import("puppeteer")).default;const outDir=path.join(process.cwd(),"uploads","proposals");fs.mkdirSync(outDir,{recursive:true});const filename=`anexo_tecnico_${scope.ownerType}_${scope.ownerId}_${proposalId}_v${Number(proposal.proposal_version||1)}_${Date.now()}.pdf`;const outPath=path.join(outDir,filename);const browser=await puppeteer.launch({headless:true,executablePath:process.env.PUPPETEER_EXECUTABLE_PATH||undefined,args:["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage"]});try{const page=await browser.newPage();await page.setContent(html,{waitUntil:"load",timeout:30000});await page.pdf({path:outPath,format:"A4",printBackground:true});}finally{await browser.close();}const url=`/uploads/proposals/${filename}`;await db.execute(drzSql`UPDATE commercial_proposals SET technical_annex_url=${url} WHERE id=${proposalId} AND commercial_owner_type=${scope.ownerType} AND commercial_owner_id=${scope.ownerId}`);return url;
}

export const commercialRouter = router({
  context: commercialProcedure.query(async ({ ctx }) => {
    const scope = (ctx as any).commercialScope as CommercialScope;
    const db = await getDb(); if (!db) return null;
    const brand: any = await db.execute(drzSql`SELECT * FROM commercial_brand_settings WHERE owner_type=${scope.ownerType} AND owner_id=${scope.ownerId} LIMIT 1`);
    const metrics: any = await db.execute(drzSql.raw(`SELECT COUNT(*) AS proposals, COALESCE(SUM(CASE WHEN status IN ('aprovada','convertida','contrato_em_assinatura') THEN valor_mensal ELSE 0 END),0) AS approved_mrr, SUM(CASE WHEN status NOT IN ('convertida','perdida','reprovada') THEN 1 ELSE 0 END) AS open_pipeline,COALESCE(SUM(CASE WHEN status NOT IN ('convertida','perdida','reprovada') THEN valor_total*probability_pct/100 ELSE 0 END),0) weighted_pipeline,SUM(CASE WHEN next_contact_date<CURDATE() AND status NOT IN ('convertida','perdida','reprovada') THEN 1 ELSE 0 END) followups_late,SUM(CASE WHEN next_contact_date=CURDATE() AND status NOT IN ('convertida','perdida','reprovada') THEN 1 ELSE 0 END) followups_today FROM commercial_proposals WHERE ${scopeSql(scope)}`));
    const finance: any = await db.execute(drzSql`SELECT COALESCE(SUM(CASE WHEN status='recebido' THEN amount ELSE 0 END),0) AS received, COALESCE(SUM(CASE WHEN status IN ('pendente','atrasado') THEN amount ELSE 0 END),0) AS pending FROM commercial_receivables_v2 WHERE owner_type=${scope.ownerType} AND owner_id=${scope.ownerId}`);
    return { scope, brand: rowsOf(brand)[0], metrics: rowsOf(metrics)[0], finance: rowsOf(finance)[0] };
  }),
  saveSettings: commercialProcedure.input(z.object({ brandName: z.string().min(2), legalName: z.string().optional(), logoUrl: z.string().optional(), primaryColor: z.string(), secondaryColor: z.string(), presentationText: z.string().optional(), objectiveText: z.string().optional(), contactName: z.string().optional(), contactEmail: z.string().optional(), contactPhone: z.string().optional(), website: z.string().optional(), commercialTerms: z.string().optional(), nextStepsText: z.string().optional() })).mutation(async ({ ctx, input }) => {
    const s = (ctx as any).commercialScope as CommercialScope; const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.execute(drzSql`UPDATE commercial_brand_settings SET brand_name=${input.brandName}, legal_name=${input.legalName || null}, logo_url=${input.logoUrl || null}, primary_color=${input.primaryColor}, secondary_color=${input.secondaryColor}, presentation_text=${input.presentationText || null}, objective_text=${input.objectiveText || null}, contact_name=${input.contactName || null}, contact_email=${input.contactEmail || null}, contact_phone=${input.contactPhone || null}, website=${input.website || null}, commercial_terms=${input.commercialTerms || null}, next_steps_text=${input.nextStepsText || null}, updated_by=${ctx.user.id} WHERE owner_type=${s.ownerType} AND owner_id=${s.ownerId}`);
    return { ok: true };
  }),
  listCatalogStructure: commercialProcedure.query(async ({ ctx }) => {
    const s=(ctx as any).commercialScope as CommercialScope; const db=await getDb(); if(!db)return {pillars:[],addons:[],bands:[]};
    const [p,a,b]:any[]=await Promise.all([
      db.execute(drzSql`SELECT * FROM commercial_pillars WHERE owner_type=${s.ownerType} AND owner_id=${s.ownerId} AND is_active=1 ORDER BY sort_order,id`),
      db.execute(drzSql`SELECT * FROM commercial_addons WHERE owner_type=${s.ownerType} AND owner_id=${s.ownerId} ORDER BY sort_order,id`),
      db.execute(drzSql`SELECT * FROM commercial_pricing_bands WHERE owner_type=${s.ownerType} AND owner_id=${s.ownerId} ORDER BY sort_order,id`),
    ]);
    return {pillars:rowsOf(p),addons:rowsOf(a),bands:rowsOf(b)};
  }),
  upsertAddon: commercialProcedure.input(z.object({id:z.number().int().positive().optional(),code:z.string().min(2).max(100),name:z.string().min(2).max(180),description:z.string().max(5000).optional(),billingMode:z.enum(["fixed","per_unit","per_employee","per_cnpj"]).default("fixed"),unitPrice:z.number().min(0).default(0),setupPrice:z.number().min(0).default(0),unitLabel:z.string().max(80).optional(),isActive:z.boolean().default(true),sortOrder:z.number().int().min(0).default(0)})).mutation(async({ctx,input})=>{
    const s=(ctx as any).commercialScope as CommercialScope;const db=await getDb();if(!db)throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
    if(input.id) await db.execute(drzSql`UPDATE commercial_addons SET code=${input.code},name=${input.name},description=${input.description||null},billing_mode=${input.billingMode},unit_price=${input.unitPrice},setup_price=${input.setupPrice},unit_label=${input.unitLabel||null},is_active=${input.isActive?1:0},sort_order=${input.sortOrder} WHERE id=${input.id} AND owner_type=${s.ownerType} AND owner_id=${s.ownerId}`);
    else await db.execute(drzSql`INSERT INTO commercial_addons(owner_type,owner_id,code,name,description,billing_mode,unit_price,setup_price,unit_label,is_active,sort_order) VALUES(${s.ownerType},${s.ownerId},${input.code},${input.name},${input.description||null},${input.billingMode},${input.unitPrice},${input.setupPrice},${input.unitLabel||null},${input.isActive?1:0},${input.sortOrder})`);
    return{ok:true};
  }),
  savePricingBands: commercialProcedure.input(z.array(z.object({id:z.number().int().positive().optional(),label:z.string().min(2).max(80),minEmployees:z.number().int().min(1),maxEmployees:z.number().int().min(1),minimumMonthly:z.number().min(0),discountPct:z.number().min(0).max(100),sortOrder:z.number().int().min(0)})).min(1).max(30)).mutation(async({ctx,input})=>{
    const s=(ctx as any).commercialScope as CommercialScope;const db=await getDb();if(!db)throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
    for(const band of input){if(band.maxEmployees<band.minEmployees)throw new TRPCError({code:"BAD_REQUEST",message:`Faixa ${band.label} possui limite final menor que o inicial.`});await db.execute(drzSql`INSERT INTO commercial_pricing_bands(owner_type,owner_id,label,min_employees,max_employees,minimum_monthly,discount_pct,sort_order,is_active) VALUES(${s.ownerType},${s.ownerId},${band.label},${band.minEmployees},${band.maxEmployees},${band.minimumMonthly},${band.discountPct},${band.sortOrder},1) ON DUPLICATE KEY UPDATE min_employees=VALUES(min_employees),max_employees=VALUES(max_employees),minimum_monthly=VALUES(minimum_monthly),discount_pct=VALUES(discount_pct),sort_order=VALUES(sort_order),is_active=1`);}
    return{ok:true};
  }),
  listFeatures: commercialProcedure.query(async ({ ctx }) => { const s = (ctx as any).commercialScope as CommercialScope; const db = await getDb(); if (!db) return []; const r: any = await db.execute(drzSql`SELECT f.*,p.name pillar_name,p.sort_order pillar_sort FROM commercial_feature_catalog f LEFT JOIN commercial_pillars p ON p.owner_type=f.owner_type AND p.owner_id=f.owner_id AND p.code=f.pillar_code WHERE f.owner_type=${s.ownerType} AND f.owner_id=${s.ownerId} ORDER BY COALESCE(p.sort_order,999),f.category,f.sort_order,f.name`); return rowsOf(r); }),
  upsertFeature: commercialProcedure.input(z.object({ id: z.number().int().positive().optional(), category: z.string().min(2), code: z.string().min(2), name: z.string().min(2), description: z.string().optional(), pillarCode:z.string().max(100).optional(), moduleName:z.string().max(180).optional(), limitationsText:z.string().max(5000).optional(), isAddonEligible:z.boolean().default(false), isActive: z.boolean().default(true), sortOrder: z.number().int().default(0) })).mutation(async ({ ctx, input }) => {
    const s = (ctx as any).commercialScope as CommercialScope; const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    if (input.id) await db.execute(drzSql`UPDATE commercial_feature_catalog SET category=${input.category}, code=${input.code}, name=${input.name}, description=${input.description || null},pillar_code=${input.pillarCode||null},module_name=${input.moduleName||null},limitations_text=${input.limitationsText||null},is_addon_eligible=${input.isAddonEligible?1:0}, is_active=${input.isActive ? 1 : 0}, sort_order=${input.sortOrder} WHERE id=${input.id} AND owner_type=${s.ownerType} AND owner_id=${s.ownerId}`);
    else await db.execute(drzSql`INSERT INTO commercial_feature_catalog (owner_type, owner_id, category, code, name, description,pillar_code,module_name,limitations_text,is_addon_eligible,is_active, sort_order) VALUES (${s.ownerType}, ${s.ownerId}, ${input.category}, ${input.code}, ${input.name}, ${input.description || null},${input.pillarCode||null},${input.moduleName||null},${input.limitationsText||null},${input.isAddonEligible?1:0},${input.isActive ? 1 : 0}, ${input.sortOrder})`);
    return { ok: true };
  }),
  listPlans: commercialProcedure.query(async ({ ctx }) => { const s = (ctx as any).commercialScope as CommercialScope; const db = await getDb(); if (!db) return []; const r: any = await db.execute(drzSql`SELECT p.*, GROUP_CONCAT(pf.feature_id) AS feature_ids FROM commercial_plan_catalog p LEFT JOIN commercial_plan_features pf ON pf.plan_id=p.id WHERE p.owner_type=${s.ownerType} AND p.owner_id=${s.ownerId} AND p.is_active=1 GROUP BY p.id ORDER BY p.sort_order, p.id`); return rowsOf(r).map((x) => ({ ...x, featureIds: String(x.feature_ids || "").split(",").filter(Boolean).map(Number) })); }),
  upsertPlan: commercialProcedure.input(planInput).mutation(async ({ ctx, input }) => {
    const s = (ctx as any).commercialScope as CommercialScope; const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" }); let id = input.id || 0;
    if (id) { const owned: any = await db.execute(drzSql`SELECT id FROM commercial_plan_catalog WHERE id=${id} AND owner_type=${s.ownerType} AND owner_id=${s.ownerId}`); if (!rowsOf(owned).length) throw new TRPCError({ code: "FORBIDDEN" }); await db.execute(drzSql`UPDATE commercial_plan_catalog SET name=${input.name}, description=${input.description || null}, billing_mode=${input.billingMode}, fixed_monthly_price=${input.fixedMonthlyPrice}, price_per_employee=${input.pricePerEmployee}, setup_price=${input.setupPrice}, employee_limit=${input.employeeLimit ?? null}, cnpj_limit=${input.cnpjLimit ?? null},storage_gb=${input.storageGb??null},ai_credits=${input.aiCredits??null},ocr_credits=${input.ocrCredits??null},minimum_monthly=${input.minimumMonthly}, services_text=${input.servicesText || null}, is_active=${input.isActive ? 1 : 0}, sort_order=${input.sortOrder} WHERE id=${id}`); }
    else { const r: any = await db.execute(drzSql`INSERT INTO commercial_plan_catalog (owner_type, owner_id, name, description, billing_mode, fixed_monthly_price, price_per_employee, setup_price, employee_limit, cnpj_limit,storage_gb,ai_credits,ocr_credits,minimum_monthly,services_text, is_active, sort_order) VALUES (${s.ownerType}, ${s.ownerId}, ${input.name}, ${input.description || null}, ${input.billingMode}, ${input.fixedMonthlyPrice}, ${input.pricePerEmployee}, ${input.setupPrice}, ${input.employeeLimit ?? null}, ${input.cnpjLimit ?? null},${input.storageGb??null},${input.aiCredits??null},${input.ocrCredits??null},${input.minimumMonthly},${input.servicesText || null}, ${input.isActive ? 1 : 0}, ${input.sortOrder})`); id = Number((Array.isArray(r) ? r[0] : r)?.insertId || 0); }
    await db.execute(drzSql`DELETE FROM commercial_plan_features WHERE plan_id=${id}`); for (const featureId of input.featureIds) { const owned: any = await db.execute(drzSql`SELECT id FROM commercial_feature_catalog WHERE id=${featureId} AND owner_type=${s.ownerType} AND owner_id=${s.ownerId}`); if (rowsOf(owned).length) await db.execute(drzSql`INSERT INTO commercial_plan_features (plan_id, feature_id) VALUES (${id}, ${featureId})`); }
    return { ok: true, id };
  }),
  listProposals: commercialProcedure.query(async ({ ctx }) => { const s = (ctx as any).commercialScope as CommercialScope; const db = await getDb(); if (!db) return []; const r: any = await db.execute(drzSql.raw(`SELECT p.*, pl.name AS plan_name FROM commercial_proposals p LEFT JOIN commercial_plan_catalog pl ON pl.id=p.commercial_plan_id WHERE ${scopeSql(s, "p")} ORDER BY p.updated_at DESC, p.id DESC LIMIT 500`)); return rowsOf(r); }),
  upsertProposal: commercialProcedure.input(proposalInput).mutation(async ({ ctx, input }) => {
    const s = (ctx as any).commercialScope as CommercialScope; const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const presentedIds = [...new Set(input.presentedPlans.map(item => item.planId))];
    const planIdsToValidate = [...new Set([...presentedIds, input.recommendedPlanId || 0, input.selectedPlanId || 0].filter(Boolean))];
    if (planIdsToValidate.length) {
      const owned: any = await db.execute(drzSql.raw(`SELECT id FROM commercial_plan_catalog WHERE id IN (${planIdsToValidate.join(",")}) AND owner_type='${s.ownerType}' AND owner_id=${s.ownerId}`));
      if (rowsOf(owned).length !== planIdsToValidate.length) throw new TRPCError({ code: "FORBIDDEN", message: "Existe plano fora deste ambiente comercial." });
    }
    if (input.recommendedPlanId && !presentedIds.includes(input.recommendedPlanId)) throw new TRPCError({ code: "BAD_REQUEST", message: "O plano recomendado precisa estar entre os planos apresentados." });
    if (input.selectedPlanId && !presentedIds.includes(input.selectedPlanId)) throw new TRPCError({ code: "BAD_REQUEST", message: "O plano selecionado precisa estar entre os planos apresentados." });
    if (input.selectedAddonIds.length) {
      const addonIds=[...new Set(input.selectedAddonIds)];
      const ownedAddons:any=await db.execute(drzSql.raw(`SELECT id FROM commercial_addons WHERE id IN (${addonIds.join(",")}) AND owner_type='${s.ownerType}' AND owner_id=${s.ownerId} AND is_active=1`));
      if(rowsOf(ownedAddons).length!==addonIds.length)throw new TRPCError({code:"FORBIDDEN",message:"Existe add-on fora deste ambiente comercial."});
    }
    const selectedPlan = input.presentedPlans.find(item => item.planId === input.selectedPlanId);
    const recurring = Number(selectedPlan?.monthlyValue || 0);
    const selectedSetup = Number(selectedPlan?.setupValue || 0);
    const annual = recurring * 12;
    const selected = JSON.stringify(input.selectedFeatureIds);
    const services = JSON.stringify(input.services);
    const presented = JSON.stringify(presentedIds);
    const overrides = JSON.stringify(input.presentedPlans);
    const selectedAddons = JSON.stringify(input.selectedAddonIds);
    const probability = probabilityForCommercialStatus(input.status);
    let id = input.id || 0;
    let previousStatus: string | null = null;
    if (id) { const owned: any = await db.execute(drzSql`SELECT id,status FROM commercial_proposals WHERE id=${id} AND commercial_owner_type=${s.ownerType} AND commercial_owner_id=${s.ownerId}`); if (!rowsOf(owned).length) throw new TRPCError({ code: "FORBIDDEN" }); previousStatus=String(rowsOf(owned)[0].status||""); await db.execute(drzSql`UPDATE commercial_proposals SET proposal_title=${input.proposalTitle}, razao_social=${input.companyName}, nome_fantasia=${input.tradeName || input.companyName}, cnpj=${input.cnpj || null}, responsavel=${input.contactName || null}, cargo=${input.contactRole || null}, email=${input.contactEmail || null}, telefone=${input.contactPhone || null}, qtd_colaboradores=${input.employees}, commercial_plan_id=${input.selectedPlanId ?? null},selected_plan_id=${input.selectedPlanId ?? null},recommended_plan_id=${input.recommendedPlanId ?? null},presented_plan_ids_json=${presented},plan_overrides_json=${overrides}, selected_features_json=${selected}, presentation_text=${input.presentationText || null}, objective_text=${input.objectiveText || null}, setup_value=${selectedSetup}, valor_mensal=${recurring}, valor_anual=${annual}, valor_total=${annual + selectedSetup - input.discountValue}, discount_value=${input.discountValue}, desconto_pct=${input.discountPct}, services_json=${services}, conditions_text=${input.conditionsText || null},payment_terms_text=${input.paymentTermsText || null},implementation_days=${input.implementationDays ?? null}, next_steps_text=${input.nextStepsText || null}, validade_dias=${input.validityDays}, status=${input.status}, observacoes=${input.notes || null} WHERE id=${id}`); }
    else { const r: any = await db.execute(drzSql`INSERT INTO commercial_proposals (commercial_owner_type, commercial_owner_id, white_label_partner_id, proposal_title, razao_social, nome_fantasia, cnpj, responsavel, cargo, email, telefone, qtd_colaboradores, commercial_plan_id,selected_plan_id,recommended_plan_id,presented_plan_ids_json,plan_overrides_json, selected_features_json, presentation_text, objective_text, setup_value, valor_mensal, valor_anual, valor_total, discount_value, desconto_pct, services_json, conditions_text,payment_terms_text,implementation_days, next_steps_text, validade_dias, status, observacoes, created_by_user_id) VALUES (${s.ownerType}, ${s.ownerId}, ${s.ownerType === "white_label" ? s.ownerId : null}, ${input.proposalTitle}, ${input.companyName}, ${input.tradeName || input.companyName}, ${input.cnpj || null}, ${input.contactName || null}, ${input.contactRole || null}, ${input.contactEmail || null}, ${input.contactPhone || null}, ${input.employees}, ${input.selectedPlanId ?? null},${input.selectedPlanId ?? null},${input.recommendedPlanId ?? null},${presented},${overrides}, ${selected}, ${input.presentationText || null}, ${input.objectiveText || null}, ${selectedSetup}, ${recurring}, ${annual}, ${annual + selectedSetup - input.discountValue}, ${input.discountValue}, ${input.discountPct}, ${services}, ${input.conditionsText || null},${input.paymentTermsText || null},${input.implementationDays ?? null}, ${input.nextStepsText || null}, ${input.validityDays}, ${input.status}, ${input.notes || null}, ${ctx.user.id})`); id = Number((Array.isArray(r) ? r[0] : r)?.insertId || 0); }
    const proposalNumber=`PROP-${new Date().getFullYear()}-${String(id).padStart(6,"0")}`;
    await db.execute(drzSql`UPDATE commercial_proposals SET city_state=${input.cityState||null},commercial_owner_name=${input.commercialOwnerName||null},first_contact_date=${input.firstContactDate||null},meeting_date=${input.meetingDate||null},proposal_sent_date=${input.proposalSentDate||null},next_contact_date=${input.nextContactDate||null},probability_pct=${probability},loss_reason=${input.lossReason||null},selected_addons_json=${selectedAddons},proposal_number=COALESCE(proposal_number,${proposalNumber}) WHERE id=${id} AND commercial_owner_type=${s.ownerType} AND commercial_owner_id=${s.ownerId}`);
    if(!previousStatus||previousStatus!==input.status)await db.execute(drzSql`INSERT INTO commercial_proposal_activities(owner_type,owner_id,proposal_id,contact_type,old_status,new_status,description,next_contact_date,created_by) VALUES(${s.ownerType},${s.ownerId},${id},'outro',${previousStatus},${input.status},${previousStatus?"Status comercial atualizado":"Proposta criada"},${input.nextContactDate||null},${Number(ctx.user.id)})`);
    return { ok: true, id, proposalNumber, probability };
  }),
  generatePdf: commercialProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => ({ url: await createProposalPdf((ctx as any).commercialScope, input.id) })),
  generateTechnicalAnnex: commercialProcedure.input(z.object({id:z.number().int().positive()})).mutation(async({ctx,input})=>({url:await createTechnicalAnnexPdf((ctx as any).commercialScope,input.id)})),
  listActivities: commercialProcedure.input(z.object({proposalId:z.number().int().positive()})).query(async({ctx,input})=>{const s=(ctx as any).commercialScope as CommercialScope;const db=await getDb();if(!db)return[];const r:any=await db.execute(drzSql`SELECT a.*,u.name created_by_name FROM commercial_proposal_activities a LEFT JOIN users u ON u.id=a.created_by WHERE a.owner_type=${s.ownerType} AND a.owner_id=${s.ownerId} AND a.proposal_id=${input.proposalId} ORDER BY a.activity_at DESC,a.id DESC`);return rowsOf(r);}),
  addActivity: commercialProcedure.input(z.object({proposalId:z.number().int().positive(),contactType:z.enum(["ligacao","whatsapp","email","reuniao","videoconferencia","visita","outro"]),description:z.string().min(2).max(20000),newStatus:z.string().max(60).optional(),nextStep:z.string().max(5000).optional(),nextContactDate:z.string().nullable().optional()})).mutation(async({ctx,input})=>{const s=(ctx as any).commercialScope as CommercialScope;const db=await getDb();if(!db)throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});const result:any=await db.execute(drzSql.raw(`SELECT id,status FROM commercial_proposals WHERE id=${input.proposalId} AND ${scopeSql(s)} LIMIT 1`));const proposal=rowsOf(result)[0];if(!proposal)throw new TRPCError({code:"NOT_FOUND"});const newStatus=input.newStatus||String(proposal.status);const probability=probabilityForCommercialStatus(newStatus);await db.execute(drzSql`INSERT INTO commercial_proposal_activities(owner_type,owner_id,proposal_id,contact_type,old_status,new_status,description,next_step,next_contact_date,created_by) VALUES(${s.ownerType},${s.ownerId},${input.proposalId},${input.contactType},${proposal.status},${newStatus},${input.description},${input.nextStep||null},${input.nextContactDate||null},${Number(ctx.user.id)})`);await db.execute(drzSql`UPDATE commercial_proposals SET status=${newStatus},probability_pct=${probability},next_contact_date=${input.nextContactDate||null} WHERE id=${input.proposalId} AND commercial_owner_type=${s.ownerType} AND commercial_owner_id=${s.ownerId}`);return{ok:true,probability};}),
  sendProposal: commercialProcedure.input(z.object({ id: z.number().int().positive(), message: z.string().max(5000).optional() })).mutation(async ({ ctx, input }) => {
    const s=(ctx as any).commercialScope as CommercialScope; const db=await getDb(); if(!db)throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
    const r:any=await db.execute(drzSql.raw(`SELECT p.*, b.brand_name FROM commercial_proposals p JOIN commercial_brand_settings b ON b.owner_type=p.commercial_owner_type AND b.owner_id=p.commercial_owner_id WHERE p.id=${input.id} AND ${scopeSql(s,"p")} LIMIT 1`));
    const p=rowsOf(r)[0]; if(!p)throw new TRPCError({code:"NOT_FOUND"}); if(!p.email)throw new TRPCError({code:"BAD_REQUEST",message:"Informe o e-mail do responsável antes de enviar."});
    const pdfUrl=p.pdf_url || await createProposalPdf(s,input.id);const annexUrl=p.technical_annex_url || await createTechnicalAnnexPdf(s,input.id);const link=`${getEmailLinkBaseUrl()}${pdfUrl}`;const annexLink=`${getEmailLinkBaseUrl()}${annexUrl}`;
    const sent=await sendEmail({to:p.email,toName:p.responsavel||undefined,subject:`Proposta comercial - ${p.brand_name}`,html:`<p>Olá, ${esc(p.responsavel||"tudo bem")}.</p><p>${esc(input.message||"Preparamos uma proposta comercial personalizada para sua organização.")}</p><p><a href="${esc(link)}">Visualizar proposta comercial</a><br><a href="${esc(annexLink)}">Visualizar Anexo Técnico - Catálogo de Funcionalidades</a></p><p>Atenciosamente,<br><b>${esc(p.brand_name)}</b></p>`});
    if(!sent.ok)throw new TRPCError({code:"INTERNAL_SERVER_ERROR",message:sent.error||"Falha no envio."}); await db.execute(drzSql`UPDATE commercial_proposals SET status='proposta_enviada', pdf_url=${pdfUrl} WHERE id=${input.id}`); return{ok:true,preview:sent.preview,url:pdfUrl};
  }),
  approveProposal: commercialProcedure.input(z.object({ id: z.number().int().positive(), createFinancialSchedule: z.boolean().default(true) })).mutation(async ({ ctx, input }) => {
    const s = (ctx as any).commercialScope as CommercialScope; const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" }); const r: any = await db.execute(drzSql.raw(`SELECT p.*, pl.name AS plan_name FROM commercial_proposals p LEFT JOIN commercial_plan_catalog pl ON pl.id=p.commercial_plan_id WHERE p.id=${input.id} AND ${scopeSql(s, "p")} LIMIT 1`)); const p = rowsOf(r)[0]; if (!p) throw new TRPCError({ code: "NOT_FOUND" });
    if (!p.selected_plan_id || !p.commercial_plan_id) throw new TRPCError({ code: "BAD_REQUEST", message: "Defina explicitamente o plano contratado antes de aprovar a proposta." });
    await db.execute(drzSql`UPDATE commercial_proposals SET status='aprovada' WHERE id=${input.id}`);
    if (input.createFinancialSchedule) { const ex: any = await db.execute(drzSql`SELECT id FROM commercial_contracts_v2 WHERE proposal_id=${input.id} AND owner_type=${s.ownerType} AND owner_id=${s.ownerId}`); if (!rowsOf(ex).length) { const today = new Date().toISOString().slice(0,10); const c: any = await db.execute(drzSql`INSERT INTO commercial_contracts_v2 (owner_type, owner_id, proposal_id, company_name, cnpj, plan_name, setup_value, monthly_value, start_date) VALUES (${s.ownerType}, ${s.ownerId}, ${input.id}, ${p.razao_social}, ${p.cnpj || null}, ${p.plan_name || null}, ${Number(p.setup_value || 0)}, ${Number(p.valor_mensal || 0)}, ${today})`); const contractId = Number((Array.isArray(c) ? c[0] : c)?.insertId || 0); if (Number(p.setup_value || 0) > 0) await db.execute(drzSql`INSERT INTO commercial_receivables_v2 (owner_type, owner_id, contract_id, proposal_id, company_name, reference_month, kind, amount, due_date) VALUES (${s.ownerType}, ${s.ownerId}, ${contractId}, ${input.id}, ${p.razao_social}, ${today.slice(0,7)}, 'setup', ${Number(p.setup_value)}, ${today})`); for (let i=0;i<12;i++){ const d=new Date(); d.setMonth(d.getMonth()+i); const due=d.toISOString().slice(0,10); await db.execute(drzSql`INSERT INTO commercial_receivables_v2 (owner_type, owner_id, contract_id, proposal_id, company_name, reference_month, kind, amount, due_date) VALUES (${s.ownerType}, ${s.ownerId}, ${contractId}, ${input.id}, ${p.razao_social}, ${due.slice(0,7)}, 'mensalidade', ${Number(p.valor_mensal || 0)}, ${due})`); } } }
    return { ok: true };
  }),
  finance: commercialProcedure.query(async ({ ctx }) => { const s=(ctx as any).commercialScope as CommercialScope; const db=await getDb(); if(!db)return {contracts:[],receivables:[]}; await db.execute(drzSql`UPDATE commercial_receivables_v2 SET status='atrasado' WHERE owner_type=${s.ownerType} AND owner_id=${s.ownerId} AND status='pendente' AND due_date<CURDATE()`); const c:any=await db.execute(drzSql`SELECT * FROM commercial_contracts_v2 WHERE owner_type=${s.ownerType} AND owner_id=${s.ownerId} ORDER BY id DESC`); const r:any=await db.execute(drzSql`SELECT * FROM commercial_receivables_v2 WHERE owner_type=${s.ownerType} AND owner_id=${s.ownerId} ORDER BY due_date DESC,id DESC LIMIT 1000`); return {contracts:rowsOf(c),receivables:rowsOf(r)}; }),
  updateReceivable: commercialProcedure.input(z.object({ id:z.number().int().positive(), status:z.enum(["pendente","recebido","atrasado","cancelado"]), paymentMethod:z.string().max(40).optional() })).mutation(async({ctx,input})=>{const s=(ctx as any).commercialScope as CommercialScope;const db=await getDb();if(!db)throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});await db.execute(drzSql`UPDATE commercial_receivables_v2 SET status=${input.status}, payment_method=${input.paymentMethod||null}, paid_at=${input.status==="recebido"?new Date():null} WHERE id=${input.id} AND owner_type=${s.ownerType} AND owner_id=${s.ownerId}`);return{ok:true};}),
});
