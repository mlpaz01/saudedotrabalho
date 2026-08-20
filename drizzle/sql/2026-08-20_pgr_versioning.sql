ALTER TABLE pgr_documents ADD COLUMN IF NOT EXISTS revision_root_id INT NULL;
ALTER TABLE pgr_documents ADD COLUMN IF NOT EXISTS revision_parent_id INT NULL;
ALTER TABLE pgr_documents ADD COLUMN IF NOT EXISTS revision_number INT NOT NULL DEFAULT 0;
ALTER TABLE pgr_documents ADD COLUMN IF NOT EXISTS exercise_year INT NULL;
ALTER TABLE pgr_documents ADD COLUMN IF NOT EXISTS is_current_version TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE pgr_documents ADD COLUMN IF NOT EXISTS revision_reason VARCHAR(500) NULL;
ALTER TABLE pgr_documents ADD COLUMN IF NOT EXISTS revision_summary_json LONGTEXT NULL;
ALTER TABLE pgr_documents ADD COLUMN IF NOT EXISTS version_created_at DATETIME NULL;

UPDATE pgr_documents SET revision_root_id=id WHERE revision_root_id IS NULL;
UPDATE pgr_documents
SET exercise_year=COALESCE(YEAR(vigencia_inicio),YEAR(created_at),YEAR(CURDATE()))
WHERE exercise_year IS NULL;

CREATE TABLE IF NOT EXISTS pgr_version_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  revision_root_id INT NOT NULL,
  pgr_id INT NOT NULL,
  source_pgr_id INT NULL,
  revision_number INT NOT NULL,
  event_type VARCHAR(60) NOT NULL,
  reason VARCHAR(500) NULL,
  changes_json LONGTEXT NULL,
  performed_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pgr_version_family (company_id,revision_root_id,revision_number),
  INDEX idx_pgr_version_document (pgr_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pcmso_pgr_revision_alerts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  pcmso_id INT NOT NULL,
  previous_pgr_id INT NOT NULL,
  new_pgr_id INT NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'pendente',
  changes_json LONGTEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  analyzed_at DATETIME NULL,
  analyzed_by INT NULL,
  UNIQUE KEY uq_pcmso_pgr_revision_alert (pcmso_id,new_pgr_id),
  INDEX idx_pcmso_pgr_revision_pending (company_id,status,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
