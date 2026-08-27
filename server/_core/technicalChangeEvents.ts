import { sql as drzSql } from "drizzle-orm";

export const TECHNICAL_EVENT_STATUSES = [
  "nova",
  "visualizada",
  "requer_analise",
  "em_analise",
  "ajuste_realizado",
  "concluida",
] as const;

export type TechnicalEventStatus = (typeof TECHNICAL_EVENT_STATUSES)[number];
export type TechnicalTargetRole = "sesmt" | "medico";

let tablesReady = false;

export function technicalTargetRole(originRole: string): TechnicalTargetRole {
  return String(originRole || "").toLowerCase() === "medico" ? "sesmt" : "medico";
}

export function technicalChangedFields(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
) {
  const previous = before || {};
  const current = after || {};
  const keys = new Set([...Object.keys(previous), ...Object.keys(current)]);
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  for (const key of keys) {
    const beforeValue = previous[key] ?? null;
    const afterValue = current[key] ?? null;
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changes[key] = { before: beforeValue, after: afterValue };
    }
  }
  return changes;
}

export async function ensureTechnicalChangeEventTables(db: any) {
  if (tablesReady) return;
  await db.execute(drzSql.raw(`CREATE TABLE IF NOT EXISTS technical_change_events (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    origin_role VARCHAR(40) NOT NULL,
    target_role VARCHAR(40) NOT NULL,
    change_type VARCHAR(80) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id BIGINT NULL,
    title VARCHAR(255) NOT NULL,
    summary TEXT NOT NULL,
    action_expected TEXT NULL,
    before_json LONGTEXT NULL,
    after_json LONGTEXT NULL,
    changes_json LONGTEXT NULL,
    context_json LONGTEXT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'nova',
    created_by INT NULL,
    viewed_at DATETIME NULL,
    viewed_by INT NULL,
    analysis_started_at DATETIME NULL,
    analysis_started_by INT NULL,
    resolved_at DATETIME NULL,
    resolved_by INT NULL,
    resolution_notes TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_technical_events_target (company_id,target_role,status,created_at),
    INDEX idx_technical_events_entity (company_id,entity_type,entity_id),
    CONSTRAINT fk_technical_events_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`));
  tablesReady = true;
}

export async function recordTechnicalChangeEvent(
  db: any,
  input: {
    companyId: number;
    originRole: string;
    targetRole?: TechnicalTargetRole;
    changeType: string;
    entityType: string;
    entityId?: number | null;
    title: string;
    summary: string;
    actionExpected?: string | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    context?: Record<string, unknown> | null;
    createdBy?: number | null;
  },
) {
  await ensureTechnicalChangeEventTables(db);
  const targetRole = input.targetRole || technicalTargetRole(input.originRole);
  const before = input.before || null;
  const after = input.after || null;
  const changes = technicalChangedFields(before, after);
  const result: any = await db.execute(drzSql`INSERT INTO technical_change_events
    (company_id,origin_role,target_role,change_type,entity_type,entity_id,title,summary,action_expected,before_json,after_json,changes_json,context_json,created_by)
    VALUES (${input.companyId},${input.originRole || "sistema"},${targetRole},${input.changeType},${input.entityType},${input.entityId || null},${input.title},${input.summary},${input.actionExpected || null},${before ? JSON.stringify(before) : null},${after ? JSON.stringify(after) : null},${JSON.stringify(changes)},${input.context ? JSON.stringify(input.context) : null},${input.createdBy || null})`);
  return Number((result as any)[0]?.insertId || 0);
}
