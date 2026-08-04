import { sql as drzSql } from "drizzle-orm";
import { getDb } from "../db";
import { ensureWhiteLabelTables } from "./whiteLabel";

function rowsOf(result: any): any[] {
  return Array.isArray(result?.[0]) ? result[0] : Array.isArray(result) ? result : [];
}

export async function getWhiteLabelPartnerIdForCompany(companyId: number): Promise<number | null> {
  if (!Number.isFinite(companyId) || companyId <= 0) return null;
  await ensureWhiteLabelTables();
  const db = await getDb();
  if (!db) return null;
  const result: any = await db.execute(drzSql`
    SELECT l.partner_id
    FROM white_label_company_links l
    JOIN white_label_partners w ON w.id=l.partner_id
    WHERE l.company_id=${companyId} AND l.is_active=1 AND w.status <> 'canceled'
    LIMIT 1`);
  const row = rowsOf(result)[0];
  return row?.partner_id ? Number(row.partner_id) : null;
}

export async function whiteLabelPartnerOwnsCompany(partnerId: number, companyId: number): Promise<boolean> {
  if (!Number.isFinite(partnerId) || partnerId <= 0 || !Number.isFinite(companyId) || companyId <= 0) return false;
  await ensureWhiteLabelTables();
  const db = await getDb();
  if (!db) return false;
  const result: any = await db.execute(drzSql`
    SELECT 1 AS owned
    FROM white_label_company_links
    WHERE partner_id=${partnerId} AND company_id=${companyId} AND is_active=1
    LIMIT 1`);
  return rowsOf(result).length === 1;
}

