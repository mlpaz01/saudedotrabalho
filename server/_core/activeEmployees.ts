export const DEFAULT_EMPLOYEE_ROLES = [
  "user",
  "chefia",
  "cipa",
  "sesmt",
  "admin",
  "company_admin",
] as const;

let activeEmployeeColumnsReady = false;

export async function ensureActiveEmployeeColumns(db: any): Promise<void> {
  if (activeEmployeeColumnsReady) return;
  try { await db.execute(sql.raw("ALTER TABLE users ADD COLUMN counts_as_employee TINYINT(1) NULL")); } catch {}
  try { await db.execute(sql.raw("CREATE INDEX idx_users_company_active_employee ON users(company_id, is_active, employment_status, counts_as_employee, role)")); } catch {}
  activeEmployeeColumnsReady = true;
}

const DEFAULT_ROLE_SET = new Set<string>(DEFAULT_EMPLOYEE_ROLES);

export type ActiveEmployeeRecord = {
  is_active?: number | boolean | null;
  isActive?: number | boolean | null;
  employment_status?: string | null;
  employmentStatus?: string | null;
  counts_as_employee?: number | boolean | null;
  countsAsEmployee?: number | boolean | null;
  role?: string | null;
};

export function activeEmployeeSql(alias = "u"): string {
  const roles = DEFAULT_EMPLOYEE_ROLES.map((role) => `'${role}'`).join(",");
  return [
    `${alias}.is_active=1`,
    `COALESCE(${alias}.employment_status,'active')='active'`,
    `(COALESCE(${alias}.counts_as_employee, CASE WHEN ${alias}.role IN (${roles}) THEN 1 ELSE 0 END)=1)`,
  ].join(" AND ");
}

export function defaultCountsAsEmployee(role: unknown): boolean {
  return DEFAULT_ROLE_SET.has(String(role ?? "").trim().toLowerCase());
}

export function isActiveEmployee(record: ActiveEmployeeRecord): boolean {
  const activeValue = record.is_active ?? record.isActive ?? 0;
  if (!(activeValue === true || Number(activeValue) === 1)) return false;

  const status = String(record.employment_status ?? record.employmentStatus ?? "active").toLowerCase();
  if (status !== "active") return false;

  const explicit = record.counts_as_employee ?? record.countsAsEmployee;
  if (explicit !== null && explicit !== undefined) {
    return explicit === true || Number(explicit) === 1;
  }
  return defaultCountsAsEmployee(record.role);
}
import { sql } from "drizzle-orm";
