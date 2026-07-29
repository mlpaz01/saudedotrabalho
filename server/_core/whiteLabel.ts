import { sql as drzSql } from "drizzle-orm";
import { getDb } from "../db";

const ACTIVE_EMPLOYEE_ROLES = ["user", "chefia", "cipa", "sesmt", "admin", "company_admin"];

export const WHITE_LABEL_PLAN_DEFAULTS = [
  {
    code: "start_white_label",
    label: "Start White Label",
    monthlyPrice: 397,
    setupPrice: 1800,
    includedCnpjs: 1,
    includedEmployees: 100,
    includedStorageGb: 5,
    includedAiCredits: 10000,
    sortOrder: 1,
  },
  {
    code: "partner_pro",
    label: "Partner Pro",
    monthlyPrice: 797,
    setupPrice: 3000,
    includedCnpjs: 5,
    includedEmployees: 500,
    includedStorageGb: 10,
    includedAiCredits: 25000,
    sortOrder: 2,
  },
  {
    code: "carteira",
    label: "Carteira",
    monthlyPrice: 1597,
    setupPrice: 5400,
    includedCnpjs: 20,
    includedEmployees: 2000,
    includedStorageGb: 40,
    includedAiCredits: 100000,
    sortOrder: 3,
  },
  {
    code: "enterprise_light",
    label: "Enterprise Light",
    monthlyPrice: 3797,
    setupPrice: 9600,
    includedCnpjs: 50,
    includedEmployees: 5000,
    includedStorageGb: 100,
    includedAiCredits: 250000,
    sortOrder: 4,
  },
] as const;

export const WHITE_LABEL_AI_PACKAGE_DEFAULTS = [
  { code: "ai_10k", label: "10 mil creditos", credits: 10000, salePrice: 59, estimatedCost: 24, sortOrder: 1 },
  { code: "ai_50k", label: "50 mil creditos", credits: 50000, salePrice: 239, estimatedCost: 98, sortOrder: 2 },
  { code: "ai_200k", label: "200 mil creditos", credits: 200000, salePrice: 839, estimatedCost: 345, sortOrder: 3 },
  { code: "ai_1m", label: "1 milhao de creditos", credits: 1000000, salePrice: 3588, estimatedCost: 1470, sortOrder: 4 },
] as const;

function rowsOf<T = any>(result: any): T[] {
  return (Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result) as T[];
}

function currentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

export async function ensureWhiteLabelTables() {
  const db = await getDb();
  if (!db) return;

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS white_label_plan_catalog (
    code VARCHAR(60) PRIMARY KEY,
    label VARCHAR(120) NOT NULL,
    monthly_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    setup_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    included_cnpjs INT NOT NULL DEFAULT 0,
    included_employees INT NOT NULL DEFAULT 0,
    included_storage_gb INT NOT NULL DEFAULT 0,
    included_ai_credits INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS white_label_ai_packages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(60) NOT NULL,
    label VARCHAR(120) NOT NULL,
    credits INT NOT NULL DEFAULT 0,
    sale_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    estimated_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_wl_ai_package_code (code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS white_label_partners (
    id INT AUTO_INCREMENT PRIMARY KEY,
    legal_name VARCHAR(220) NOT NULL,
    trade_name VARCHAR(220),
    document VARCHAR(30),
    contact_name VARCHAR(160),
    contact_email VARCHAR(180),
    contact_phone VARCHAR(60),
    plan_code VARCHAR(60) NOT NULL DEFAULT 'start_white_label',
    status VARCHAR(40) NOT NULL DEFAULT 'active',
    monthly_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    setup_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    brand_name VARCHAR(180),
    logo_url VARCHAR(500),
    primary_color VARCHAR(24) DEFAULT '#0097a7',
    secondary_color VARCHAR(24) DEFAULT '#fbbf24',
    custom_domain VARCHAR(220),
    support_level VARCHAR(80) DEFAULT 'N2 para parceiro',
    hide_sdt_brand TINYINT(1) NOT NULL DEFAULT 1,
    allow_partner_branding TINYINT(1) NOT NULL DEFAULT 1,
    notes TEXT,
    created_by_user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_wl_partner_plan (plan_code),
    INDEX idx_wl_partner_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS white_label_company_links (
    id INT AUTO_INCREMENT PRIMARY KEY,
    partner_id INT NOT NULL,
    company_id INT NOT NULL,
    client_label VARCHAR(220),
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_wl_company (company_id),
    INDEX idx_wl_link_partner (partner_id, is_active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS white_label_ai_wallets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    partner_id INT NOT NULL,
    current_period VARCHAR(7) NOT NULL,
    included_credits_monthly INT NOT NULL DEFAULT 0,
    purchased_credits_balance INT NOT NULL DEFAULT 0,
    consumed_credits_current_period INT NOT NULL DEFAULT 0,
    credit_limit_monthly INT NOT NULL DEFAULT 0,
    estimated_cost_current_period DECIMAL(12,2) NOT NULL DEFAULT 0,
    gross_revenue_current_period DECIMAL(12,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_wl_wallet_partner (partner_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS white_label_ai_ledger (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    partner_id INT NOT NULL,
    company_id INT NULL,
    user_id INT NULL,
    module_area VARCHAR(80) NOT NULL,
    provider VARCHAR(80),
    model VARCHAR(160),
    prompt_tokens INT NOT NULL DEFAULT 0,
    completion_tokens INT NOT NULL DEFAULT 0,
    total_tokens INT NOT NULL DEFAULT 0,
    credits_used INT NOT NULL DEFAULT 0,
    estimated_cost_brl DECIMAL(12,6) NOT NULL DEFAULT 0,
    gross_revenue_brl DECIMAL(12,6) NOT NULL DEFAULT 0,
    metadata_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_wl_ledger_partner_period (partner_id, created_at),
    INDEX idx_wl_ledger_company (company_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS white_label_ai_credit_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    partner_id INT NOT NULL,
    package_id INT NULL,
    credits INT NOT NULL DEFAULT 0,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    estimated_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    margin_pct DECIMAL(6,2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(40) NOT NULL DEFAULT 'pix',
    payment_provider VARCHAR(40) NOT NULL DEFAULT 'manual',
    status VARCHAR(40) NOT NULL DEFAULT 'pending_payment',
    checkout_url VARCHAR(500),
    pix_copy_paste TEXT,
    provider_order_id VARCHAR(120),
    created_by_user_id INT,
    paid_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_wl_order_partner (partner_id, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS white_label_plan_change_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    partner_id INT NOT NULL,
    old_plan_code VARCHAR(60),
    new_plan_code VARCHAR(60),
    old_monthly_price DECIMAL(12,2),
    new_monthly_price DECIMAL(12,2),
    change_type VARCHAR(40) NOT NULL DEFAULT 'manual',
    note TEXT,
    changed_by_user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_wl_plan_log_partner (partner_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS white_label_audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    partner_id INT NULL,
    company_id INT NULL,
    action VARCHAR(120) NOT NULL,
    details_json JSON NULL,
    user_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_wl_audit_partner (partner_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  try {
    await db.execute(drzSql`ALTER TABLE companies ADD COLUMN white_label_partner_id INT NULL`);
  } catch (_) {}

  for (const p of WHITE_LABEL_PLAN_DEFAULTS) {
    await db.execute(drzSql`INSERT IGNORE INTO white_label_plan_catalog
      (code, label, monthly_price, setup_price, included_cnpjs, included_employees, included_storage_gb, included_ai_credits, is_active, sort_order)
      VALUES (${p.code}, ${p.label}, ${p.monthlyPrice}, ${p.setupPrice}, ${p.includedCnpjs}, ${p.includedEmployees}, ${p.includedStorageGb}, ${p.includedAiCredits}, 1, ${p.sortOrder})`);
  }

  for (const p of WHITE_LABEL_AI_PACKAGE_DEFAULTS) {
    await db.execute(drzSql`INSERT IGNORE INTO white_label_ai_packages
      (code, label, credits, sale_price, estimated_cost, is_active, sort_order)
      VALUES (${p.code}, ${p.label}, ${p.credits}, ${p.salePrice}, ${p.estimatedCost}, 1, ${p.sortOrder})`);
  }
}

export async function listWhiteLabelPlans() {
  await ensureWhiteLabelTables();
  const db = await getDb();
  if (!db) return WHITE_LABEL_PLAN_DEFAULTS;
  const r: any = await db.execute(drzSql`SELECT * FROM white_label_plan_catalog ORDER BY sort_order ASC, monthly_price ASC`);
  return rowsOf(r);
}

export async function upsertWhiteLabelPlan(input: any) {
  await ensureWhiteLabelTables();
  const db = await getDb();
  if (!db) return;
  await db.execute(drzSql`INSERT INTO white_label_plan_catalog
    (code, label, monthly_price, setup_price, included_cnpjs, included_employees, included_storage_gb, included_ai_credits, is_active, sort_order)
    VALUES (${input.code}, ${input.label}, ${input.monthlyPrice}, ${input.setupPrice}, ${input.includedCnpjs}, ${input.includedEmployees}, ${input.includedStorageGb}, ${input.includedAiCredits}, ${input.isActive ? 1 : 0}, ${input.sortOrder})
    ON DUPLICATE KEY UPDATE
      label=VALUES(label), monthly_price=VALUES(monthly_price), setup_price=VALUES(setup_price),
      included_cnpjs=VALUES(included_cnpjs), included_employees=VALUES(included_employees),
      included_storage_gb=VALUES(included_storage_gb), included_ai_credits=VALUES(included_ai_credits),
      is_active=VALUES(is_active), sort_order=VALUES(sort_order)`);
}

export async function listWhiteLabelAiPackages() {
  await ensureWhiteLabelTables();
  const db = await getDb();
  if (!db) return WHITE_LABEL_AI_PACKAGE_DEFAULTS;
  const r: any = await db.execute(drzSql`SELECT *,
    CASE WHEN sale_price > 0 THEN ROUND(((sale_price - estimated_cost) / sale_price) * 100, 2) ELSE 0 END AS margin_pct
    FROM white_label_ai_packages ORDER BY sort_order ASC, credits ASC`);
  return rowsOf(r);
}

export async function upsertWhiteLabelAiPackage(input: any) {
  await ensureWhiteLabelTables();
  const db = await getDb();
  if (!db) return;
  const id = Number(input.id || 0);
  if (id > 0) {
    await db.execute(drzSql`UPDATE white_label_ai_packages SET
      code=${input.code}, label=${input.label}, credits=${input.credits}, sale_price=${input.salePrice},
      estimated_cost=${input.estimatedCost}, is_active=${input.isActive ? 1 : 0}, sort_order=${input.sortOrder}
      WHERE id=${id}`);
    return;
  }
  await db.execute(drzSql`INSERT INTO white_label_ai_packages
    (code, label, credits, sale_price, estimated_cost, is_active, sort_order)
    VALUES (${input.code}, ${input.label}, ${input.credits}, ${input.salePrice}, ${input.estimatedCost}, ${input.isActive ? 1 : 0}, ${input.sortOrder})
    ON DUPLICATE KEY UPDATE label=VALUES(label), credits=VALUES(credits), sale_price=VALUES(sale_price),
      estimated_cost=VALUES(estimated_cost), is_active=VALUES(is_active), sort_order=VALUES(sort_order)`);
}

async function ensurePartnerWallet(partnerId: number) {
  const db = await getDb();
  if (!db) return;
  const period = currentPeriod();
  const r: any = await db.execute(drzSql`SELECT p.included_ai_credits
    FROM white_label_partners w
    LEFT JOIN white_label_plan_catalog p ON p.code=w.plan_code
    WHERE w.id=${partnerId} LIMIT 1`);
  const row = rowsOf<any>(r)[0] || {};
  const included = Number(row.included_ai_credits || 0);
  await db.execute(drzSql`INSERT INTO white_label_ai_wallets
    (partner_id, current_period, included_credits_monthly, credit_limit_monthly)
    VALUES (${partnerId}, ${period}, ${included}, ${included})
    ON DUPLICATE KEY UPDATE
      current_period=IF(current_period=${period}, current_period, ${period}),
      included_credits_monthly=${included},
      credit_limit_monthly=GREATEST(credit_limit_monthly, ${included})`);
}

export async function listWhiteLabelPartners() {
  await ensureWhiteLabelTables();
  const db = await getDb();
  if (!db) return [];
  const r: any = await db.execute(drzSql.raw(`
    SELECT w.*, p.label AS plan_label, p.included_cnpjs, p.included_employees, p.included_storage_gb, p.included_ai_credits,
      COALESCE(wallet.purchased_credits_balance, 0) AS purchased_credits_balance,
      COALESCE(wallet.consumed_credits_current_period, 0) AS consumed_credits_current_period,
      COALESCE(wallet.credit_limit_monthly, p.included_ai_credits, 0) AS credit_limit_monthly,
      COALESCE(wallet.estimated_cost_current_period, 0) AS estimated_cost_current_period,
      COALESCE(wallet.gross_revenue_current_period, 0) AS gross_revenue_current_period,
      COUNT(DISTINCT l.company_id) AS linked_companies,
      COUNT(DISTINCT CASE
        WHEN u.is_active=1 AND COALESCE(u.employment_status,'active')='active'
          AND u.role IN (${ACTIVE_EMPLOYEE_ROLES.map((x) => `'${x}'`).join(",")})
        THEN u.id END) AS active_employees
    FROM white_label_partners w
    LEFT JOIN white_label_plan_catalog p ON p.code=w.plan_code
    LEFT JOIN white_label_ai_wallets wallet ON wallet.partner_id=w.id
    LEFT JOIN white_label_company_links l ON l.partner_id=w.id AND l.is_active=1
    LEFT JOIN users u ON u.company_id=l.company_id
    GROUP BY w.id
    ORDER BY w.status='active' DESC, w.legal_name ASC`));
  const rows = rowsOf<any>(r);
  for (const row of rows) await ensurePartnerWallet(Number(row.id));
  return rows;
}

export async function getWhiteLabelPartner(id: number) {
  await ensureWhiteLabelTables();
  await ensurePartnerWallet(id);
  const db = await getDb();
  if (!db) return null;
  const partnerR: any = await db.execute(drzSql`SELECT w.*, p.label AS plan_label, p.included_cnpjs, p.included_employees, p.included_storage_gb, p.included_ai_credits
    FROM white_label_partners w LEFT JOIN white_label_plan_catalog p ON p.code=w.plan_code WHERE w.id=${id} LIMIT 1`);
  const partner = rowsOf<any>(partnerR)[0];
  if (!partner) return null;
  const companiesR: any = await db.execute(drzSql`SELECT l.*, c.name, c.cnpj, c.logo_url, c.primary_color,
      (SELECT COUNT(*) FROM users u WHERE u.company_id=c.id AND u.is_active=1 AND COALESCE(u.employment_status,'active')='active') AS active_employees
    FROM white_label_company_links l
    JOIN companies c ON c.id=l.company_id
    WHERE l.partner_id=${id}
    ORDER BY l.is_active DESC, c.name ASC`);
  const walletR: any = await db.execute(drzSql`SELECT * FROM white_label_ai_wallets WHERE partner_id=${id} LIMIT 1`);
  const ordersR: any = await db.execute(drzSql`SELECT o.*, p.label AS package_label
    FROM white_label_ai_credit_orders o LEFT JOIN white_label_ai_packages p ON p.id=o.package_id
    WHERE o.partner_id=${id} ORDER BY o.id DESC LIMIT 30`);
  const logsR: any = await db.execute(drzSql`SELECT * FROM white_label_plan_change_logs WHERE partner_id=${id} ORDER BY id DESC LIMIT 20`);
  return {
    partner,
    companies: rowsOf(companiesR),
    wallet: rowsOf(walletR)[0] || null,
    orders: rowsOf(ordersR),
    planLogs: rowsOf(logsR),
  };
}

export async function upsertWhiteLabelPartner(input: any, userId?: number) {
  await ensureWhiteLabelTables();
  const db = await getDb();
  if (!db) return { id: 0 };

  const planR: any = await db.execute(drzSql`SELECT * FROM white_label_plan_catalog WHERE code=${input.planCode} LIMIT 1`);
  const plan = rowsOf<any>(planR)[0];
  const monthlyPrice = Number(input.monthlyPrice ?? plan?.monthly_price ?? 0);
  const setupPrice = Number(input.setupPrice ?? plan?.setup_price ?? 0);
  const id = Number(input.id || 0);

  if (id > 0) {
    const oldR: any = await db.execute(drzSql`SELECT plan_code, monthly_price FROM white_label_partners WHERE id=${id} LIMIT 1`);
    const old = rowsOf<any>(oldR)[0] || {};
    await db.execute(drzSql`UPDATE white_label_partners SET
      legal_name=${input.legalName}, trade_name=${input.tradeName ?? null}, document=${input.document ?? null},
      contact_name=${input.contactName ?? null}, contact_email=${input.contactEmail ?? null}, contact_phone=${input.contactPhone ?? null},
      plan_code=${input.planCode}, status=${input.status ?? "active"}, monthly_price=${monthlyPrice}, setup_price=${setupPrice},
      brand_name=${input.brandName ?? input.tradeName ?? input.legalName}, logo_url=${input.logoUrl ?? null},
      primary_color=${input.primaryColor ?? "#0097a7"}, secondary_color=${input.secondaryColor ?? "#fbbf24"},
      custom_domain=${input.customDomain ?? null}, support_level=${input.supportLevel ?? "N2 para parceiro"},
      hide_sdt_brand=${input.hideSdtBrand === false ? 0 : 1}, allow_partner_branding=${input.allowPartnerBranding === false ? 0 : 1},
      notes=${input.notes ?? null}
      WHERE id=${id}`);
    if (String(old.plan_code || "") !== String(input.planCode)) {
      await db.execute(drzSql`INSERT INTO white_label_plan_change_logs
        (partner_id, old_plan_code, new_plan_code, old_monthly_price, new_monthly_price, change_type, note, changed_by_user_id)
        VALUES (${id}, ${old.plan_code ?? null}, ${input.planCode}, ${old.monthly_price ?? null}, ${monthlyPrice}, ${input.changeType ?? "manual"}, ${input.changeNote ?? null}, ${userId ?? null})`);
    }
    await ensurePartnerWallet(id);
    return { id };
  }

  const res: any = await db.execute(drzSql`INSERT INTO white_label_partners
    (legal_name, trade_name, document, contact_name, contact_email, contact_phone, plan_code, status,
      monthly_price, setup_price, brand_name, logo_url, primary_color, secondary_color, custom_domain,
      support_level, hide_sdt_brand, allow_partner_branding, notes, created_by_user_id)
    VALUES (${input.legalName}, ${input.tradeName ?? null}, ${input.document ?? null}, ${input.contactName ?? null},
      ${input.contactEmail ?? null}, ${input.contactPhone ?? null}, ${input.planCode}, ${input.status ?? "active"},
      ${monthlyPrice}, ${setupPrice}, ${input.brandName ?? input.tradeName ?? input.legalName}, ${input.logoUrl ?? null},
      ${input.primaryColor ?? "#0097a7"}, ${input.secondaryColor ?? "#fbbf24"}, ${input.customDomain ?? null},
      ${input.supportLevel ?? "N2 para parceiro"}, ${input.hideSdtBrand === false ? 0 : 1},
      ${input.allowPartnerBranding === false ? 0 : 1}, ${input.notes ?? null}, ${userId ?? null})`);
  const insertId = Number((res as any)?.[0]?.insertId || (res as any)?.insertId || 0);
  await ensurePartnerWallet(insertId);
  return { id: insertId };
}

export async function listCompaniesForWhiteLabel() {
  await ensureWhiteLabelTables();
  const db = await getDb();
  if (!db) return [];
  const r: any = await db.execute(drzSql.raw(`
    SELECT c.id, c.name, c.cnpj, c.logo_url, c.primary_color, COALESCE(c.is_active,1) AS is_active,
      l.partner_id, w.legal_name AS partner_name,
      COUNT(DISTINCT CASE WHEN u.is_active=1 AND COALESCE(u.employment_status,'active')='active' THEN u.id END) AS active_employees
    FROM companies c
    LEFT JOIN white_label_company_links l ON l.company_id=c.id AND l.is_active=1
    LEFT JOIN white_label_partners w ON w.id=l.partner_id
    LEFT JOIN users u ON u.company_id=c.id
    GROUP BY c.id
    ORDER BY w.legal_name IS NULL DESC, c.name ASC`));
  return rowsOf(r);
}

export async function linkCompanyToWhiteLabel(partnerId: number, companyId: number, clientLabel?: string) {
  await ensureWhiteLabelTables();
  const db = await getDb();
  if (!db) return;
  await db.execute(drzSql`INSERT INTO white_label_company_links (partner_id, company_id, client_label, is_active)
    VALUES (${partnerId}, ${companyId}, ${clientLabel ?? null}, 1)
    ON DUPLICATE KEY UPDATE partner_id=VALUES(partner_id), client_label=VALUES(client_label), is_active=1`);
  try {
    await db.execute(drzSql`UPDATE companies SET white_label_partner_id=${partnerId} WHERE id=${companyId}`);
  } catch (_) {}
}

export async function unlinkCompanyFromWhiteLabel(companyId: number) {
  await ensureWhiteLabelTables();
  const db = await getDb();
  if (!db) return;
  await db.execute(drzSql`UPDATE white_label_company_links SET is_active=0 WHERE company_id=${companyId}`);
  try {
    await db.execute(drzSql`UPDATE companies SET white_label_partner_id=NULL WHERE id=${companyId}`);
  } catch (_) {}
}

export async function adjustWhiteLabelAiCredits(partnerId: number, credits: number, note: string | undefined, userId?: number) {
  await ensureWhiteLabelTables();
  await ensurePartnerWallet(partnerId);
  const db = await getDb();
  if (!db) return;
  await db.execute(drzSql`UPDATE white_label_ai_wallets
    SET purchased_credits_balance=GREATEST(0, purchased_credits_balance + ${credits})
    WHERE partner_id=${partnerId}`);
  await db.execute(drzSql`INSERT INTO white_label_audit_logs (partner_id, action, details_json, user_id)
    VALUES (${partnerId}, 'ai_credit_adjustment', ${JSON.stringify({ credits, note: note || "" })}, ${userId ?? null})`);
}

export async function createWhiteLabelAiCreditOrder(input: any, userId?: number) {
  await ensureWhiteLabelTables();
  const db = await getDb();
  if (!db) return { id: 0, status: "pending_payment" };
  let pkg: any = null;
  if (input.packageId) {
    const pr: any = await db.execute(drzSql`SELECT * FROM white_label_ai_packages WHERE id=${input.packageId} LIMIT 1`);
    pkg = rowsOf<any>(pr)[0];
  }
  const credits = Number(input.credits ?? pkg?.credits ?? 0);
  const amount = Number(input.amount ?? pkg?.sale_price ?? 0);
  const estimatedCost = Number(input.estimatedCost ?? pkg?.estimated_cost ?? 0);
  const marginPct = amount > 0 ? Number((((amount - estimatedCost) / amount) * 100).toFixed(2)) : 0;
  const provider = String(input.paymentProvider || "manual");
  const status = provider === "manual" ? "pending_payment" : "pending_provider";

  const res: any = await db.execute(drzSql`INSERT INTO white_label_ai_credit_orders
    (partner_id, package_id, credits, amount, estimated_cost, margin_pct, payment_method, payment_provider, status, created_by_user_id)
    VALUES (${input.partnerId}, ${input.packageId ?? null}, ${credits}, ${amount}, ${estimatedCost}, ${marginPct},
      ${input.paymentMethod || "pix"}, ${provider}, ${status}, ${userId ?? null})`);
  const id = Number((res as any)?.[0]?.insertId || (res as any)?.insertId || 0);
  return {
    id,
    status,
    message: provider === "manual"
      ? "Pedido criado para baixa manual. Para Pix/cartao automaticos, configurar provedor de pagamento."
      : "Pedido criado aguardando integracao com provedor de pagamento.",
  };
}

export async function markWhiteLabelAiOrderPaid(orderId: number, userId?: number) {
  await ensureWhiteLabelTables();
  const db = await getDb();
  if (!db) return;
  const r: any = await db.execute(drzSql`SELECT * FROM white_label_ai_credit_orders WHERE id=${orderId} LIMIT 1`);
  const order = rowsOf<any>(r)[0];
  if (!order) return;
  await ensurePartnerWallet(Number(order.partner_id));
  await db.execute(drzSql`UPDATE white_label_ai_credit_orders SET status='paid', paid_at=NOW() WHERE id=${orderId}`);
  await db.execute(drzSql`UPDATE white_label_ai_wallets
    SET purchased_credits_balance=purchased_credits_balance + ${Number(order.credits || 0)},
        gross_revenue_current_period=gross_revenue_current_period + ${Number(order.amount || 0)}
    WHERE partner_id=${Number(order.partner_id)}`);
  await db.execute(drzSql`INSERT INTO white_label_audit_logs (partner_id, action, details_json, user_id)
    VALUES (${Number(order.partner_id)}, 'ai_credit_order_paid', ${JSON.stringify({ orderId, credits: Number(order.credits || 0), amount: Number(order.amount || 0) })}, ${userId ?? null})`);
}

export async function getWhiteLabelOverview() {
  await ensureWhiteLabelTables();
  const db = await getDb();
  if (!db) return { partners: [], totals: {} };
  const partners = await listWhiteLabelPartners();
  const ordersR: any = await db.execute(drzSql`SELECT * FROM white_label_ai_credit_orders ORDER BY id DESC LIMIT 20`);
  const totals = partners.reduce((acc: any, p: any) => {
    acc.partners += 1;
    if (String(p.status) === "active") acc.activePartners += 1;
    acc.monthlyRevenue += Number(p.monthly_price || 0);
    acc.linkedCompanies += Number(p.linked_companies || 0);
    acc.activeEmployees += Number(p.active_employees || 0);
    acc.aiConsumed += Number(p.consumed_credits_current_period || 0);
    acc.aiCost += Number(p.estimated_cost_current_period || 0);
    acc.aiRevenue += Number(p.gross_revenue_current_period || 0);
    return acc;
  }, { partners: 0, activePartners: 0, monthlyRevenue: 0, linkedCompanies: 0, activeEmployees: 0, aiConsumed: 0, aiCost: 0, aiRevenue: 0 });
  return { partners, orders: rowsOf(ordersR), totals };
}
