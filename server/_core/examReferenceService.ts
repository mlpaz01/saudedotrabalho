import { sql as drzSql } from "drizzle-orm";
import {
  evaluateExamParameters,
  type ExamParameterInput,
  type ExamReferenceRule,
} from "./examReferenceEngine";

function rowsOf(result: any): any[] {
  return Array.isArray(result?.[0])
    ? result[0]
    : Array.isArray(result)
      ? result
      : [];
}

async function ensureColumn(
  db: any,
  table: string,
  column: string,
  definition: string
) {
  const found: any = await db.execute(
    drzSql`SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${table} AND COLUMN_NAME=${column} LIMIT 1`
  );
  if (rowsOf(found).length) return;
  await db.execute(
    drzSql.raw(
      `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`
    )
  );
}

export async function ensureExamScreeningSchema(db: any) {
  await ensureColumn(db, "users", "sex", "VARCHAR(30) NULL");
  await ensureColumn(db, "users", "birth_date", "DATE NULL");
  await ensureColumn(
    db,
    "occupational_exam_results",
    "method_name",
    "VARCHAR(255) NULL"
  );
  await ensureColumn(
    db,
    "occupational_exam_results",
    "automated_screening_status",
    "VARCHAR(40) NOT NULL DEFAULT 'nao_classificado'"
  );
  await ensureColumn(
    db,
    "occupational_exam_results",
    "automated_screening_json",
    "LONGTEXT NULL"
  );
  await ensureColumn(
    db,
    "occupational_exam_results",
    "automated_screened_at",
    "DATETIME NULL"
  );
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS occupational_exam_reference_rules (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    exam_id INT NOT NULL,
    parameter_name VARCHAR(255) NOT NULL,
    aliases_json LONGTEXT,
    sex_scope VARCHAR(30) NOT NULL DEFAULT 'todos',
    age_min_years DECIMAL(6,2) NULL,
    age_max_years DECIMAL(6,2) NULL,
    method_pattern VARCHAR(255) NULL,
    laboratory_pattern VARCHAR(255) NULL,
    unit VARCHAR(80) NULL,
    lower_bound DECIMAL(20,6) NULL,
    upper_bound DECIMAL(20,6) NULL,
    critical_lower_bound DECIMAL(20,6) NULL,
    critical_upper_bound DECIMAL(20,6) NULL,
    qualitative_normal_json LONGTEXT,
    qualitative_altered_json LONGTEXT,
    notes TEXT,
    effective_from DATE NULL,
    effective_until DATE NULL,
    version INT NOT NULL DEFAULT 1,
    supersedes_rule_id BIGINT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_exam_reference_active (company_id,exam_id,is_active,effective_from,effective_until),
    INDEX idx_exam_reference_parameter (company_id,exam_id,parameter_name),
    INDEX idx_exam_reference_history (supersedes_rule_id,version)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

function safeParameters(value: unknown): ExamParameterInput[] {
  if (Array.isArray(value)) return value as ExamParameterInput[];
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function ageInYears(birthDate: unknown, at: unknown) {
  if (!birthDate) return null;
  const birth = new Date(String(birthDate));
  const reference = new Date(String(at || new Date()));
  if (Number.isNaN(birth.getTime()) || Number.isNaN(reference.getTime()))
    return null;
  return (reference.getTime() - birth.getTime()) / 31_556_952_000;
}

async function notifyDoctors(
  db: any,
  row: any,
  status: string,
  summary: string
) {
  if (!["alterado", "critico"].includes(status)) return;
  try {
    const doctorsResult: any = await db.execute(
      drzSql`SELECT id FROM users WHERE company_id=${Number(row.company_id)} AND role='medico' AND is_active=1`
    );
    for (const doctor of rowsOf(doctorsResult)) {
      const dedup = `exam-screening:${row.id}:${status}:u${doctor.id}`;
      const priority = status === "critico" ? "alta" : "media";
      await db.execute(drzSql`INSERT INTO notifications
        (user_id,company_id,type,priority,title,body,link,icon,dedup_key)
        VALUES (${Number(doctor.id)},${Number(row.company_id)},'exam_screening',${priority},${status === "critico" ? "Resultado com parâmetro crítico" : "Resultado com possível alteração"},${`${row.collaborator_name} · ${row.exam_name}. ${summary}`},'/operacao-ocupacional?tab=resultados','microscope',${dedup})
        ON DUPLICATE KEY UPDATE body=VALUES(body),priority=VALUES(priority),read_at=NULL`);
    }
  } catch (error) {
    console.warn(
      "[exam-screening] notificação médica não gerada:",
      (error as Error).message
    );
  }
}

export async function evaluateAndStoreExamResult(
  db: any,
  companyId: number,
  resultId: number,
  actorUserId?: number
) {
  await ensureExamScreeningSchema(db);
  const result: any =
    await db.execute(drzSql`SELECT r.*,u.name collaborator_name,u.sex,u.birth_date,
      e.name exam_name,e.default_unit,e.reference_guidance
    FROM occupational_exam_results r
    JOIN users u ON u.id=r.collaborator_id AND u.company_id=r.company_id
    JOIN pcmso_exam_catalog_v2 e ON e.id=r.exam_id AND e.company_id=r.company_id
    WHERE r.id=${resultId} AND r.company_id=${companyId} LIMIT 1`);
  const row = rowsOf(result)[0];
  if (!row) return null;
  const ruleResult: any =
    await db.execute(drzSql`SELECT * FROM occupational_exam_reference_rules
    WHERE company_id=${companyId} AND exam_id=${Number(row.exam_id)} AND is_active=1
      AND (effective_from IS NULL OR effective_from<=DATE(${row.performed_at}))
      AND (effective_until IS NULL OR effective_until>=DATE(${row.performed_at}))
    ORDER BY version DESC,id DESC`);
  const rules = rowsOf(ruleResult) as ExamReferenceRule[];
  let parameters = safeParameters(row.parameters_json);
  if (!parameters.length && String(row.result_summary || "").trim()) {
    parameters = [
      {
        name: row.exam_name,
        value: String(row.result_summary),
        unit: row.default_unit || null,
        reference: row.reference_text || null,
      },
    ];
  }
  const screening = evaluateExamParameters(parameters, rules, {
    sex: row.sex,
    ageYears: ageInYears(row.birth_date, row.performed_at),
    methodName: row.method_name,
    laboratoryName: row.laboratory_name,
  });
  await db.execute(drzSql`UPDATE occupational_exam_results
    SET automated_screening_status=${screening.status},automated_screening_json=${JSON.stringify(screening)},automated_screened_at=NOW()
    WHERE id=${resultId} AND company_id=${companyId}`);
  if (actorUserId) {
    try {
      await db.execute(drzSql`INSERT INTO occupational_audit_log
        (company_id,actor_user_id,action,entity_type,entity_id,collaborator_id,details_json)
        VALUES (${companyId},${actorUserId},'exam_result_screened','exam_result',${resultId},${Number(row.collaborator_id)},${JSON.stringify(
          {
            screeningStatus: screening.status,
            medicalPriority: screening.medicalPriority,
            evaluatedParameters: screening.evaluatedParameters,
            unmatchedParameters: screening.unmatchedParameters,
            engineVersion: screening.engineVersion,
          }
        )})`);
    } catch (error) {
      console.warn(
        "[exam-screening] auditoria não registrada:",
        (error as Error).message
      );
    }
  }
  await notifyDoctors(db, row, screening.status, screening.summary);
  return screening;
}

export async function reprocessPendingExamResults(
  db: any,
  companyId: number,
  examId: number,
  actorUserId: number
) {
  await ensureExamScreeningSchema(db);
  const result: any =
    await db.execute(drzSql`SELECT id FROM occupational_exam_results
    WHERE company_id=${companyId} AND exam_id=${examId} AND reviewed_at IS NULL
    ORDER BY performed_at DESC,id DESC LIMIT 2000`);
  let processed = 0;
  for (const row of rowsOf(result)) {
    await evaluateAndStoreExamResult(
      db,
      companyId,
      Number(row.id),
      actorUserId
    );
    processed++;
  }
  return processed;
}
