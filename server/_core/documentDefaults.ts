import { sql as drzSql } from "drizzle-orm";

export type DefaultDocumentType =
  | "pgr"
  | "psico"
  | "aep"
  | "ltcat"
  | "pcmso"
  | "insalubridade"
  | "periculosidade";

function rowsOf(result: any): any[] {
  return Array.isArray(result?.[0])
    ? result[0]
    : Array.isArray(result)
      ? result
      : [];
}

export async function loadDocumentDefaults(
  db: any,
  companyId: number,
  docType: DefaultDocumentType
) {
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS default_texts_v2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    scope ENUM('company','global') NOT NULL,
    company_id INT NULL,
    company_id_key INT GENERATED ALWAYS AS (IFNULL(company_id, 0)) STORED,
    doc_type VARCHAR(40) NOT NULL,
    texto_introducao MEDIUMTEXT,
    texto_conclusao MEDIUMTEXT,
    apply_to_future TINYINT(1) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by_user_id INT NULL,
    UNIQUE KEY uq_scope_v3 (scope, company_id_key, doc_type),
    INDEX idx_doc (doc_type, scope)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const companyResult: any = await db.execute(
    drzSql`SELECT texto_introducao,texto_conclusao FROM default_texts_v2 WHERE scope='company' AND company_id=${companyId} AND doc_type=${docType} ORDER BY updated_at DESC LIMIT 1`
  );
  const companyRow = rowsOf(companyResult)[0];
  if (companyRow) return companyRow;
  const globalResult: any = await db.execute(
    drzSql`SELECT texto_introducao,texto_conclusao FROM default_texts_v2 WHERE scope='global' AND company_id IS NULL AND doc_type=${docType} ORDER BY updated_at DESC LIMIT 1`
  );
  return rowsOf(globalResult)[0] || null;
}
