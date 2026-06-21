-- Sprint 1 GSE-first: tabelas relacionais (parallel-write com o JSON legado em pgr_documents)

CREATE TABLE IF NOT EXISTS pgr_gse (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  pgr_id INT NOT NULL,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT NULL,
  num_trabalhadores INT DEFAULT 0,
  num_homens INT DEFAULT 0,
  num_mulheres INT DEFAULT 0,
  ai_suggested TINYINT(1) NOT NULL DEFAULT 0,
  migrated_from_legacy TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pgr (pgr_id),
  CONSTRAINT fk_pgr_gse_doc FOREIGN KEY (pgr_id) REFERENCES pgr_documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pgr_gse_cargos (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  gse_id INT NOT NULL,
  cargo VARCHAR(120) NOT NULL,
  INDEX idx_gse (gse_id),
  CONSTRAINT fk_gse_cargos FOREIGN KEY (gse_id) REFERENCES pgr_gse(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pgr_gse_setores (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  gse_id INT NOT NULL,
  sector_id INT NOT NULL,
  INDEX idx_gse (gse_id),
  INDEX idx_sector (sector_id),
  CONSTRAINT fk_gse_setores FOREIGN KEY (gse_id) REFERENCES pgr_gse(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pgr_gse_riscos (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  gse_id INT NOT NULL,
  tipo VARCHAR(40) NOT NULL,
  agente VARCHAR(255) NOT NULL,
  fonte_geradora TEXT NULL,
  possivel_dano TEXT NULL,
  tipo_exposicao VARCHAR(40) NULL,
  severidade VARCHAR(30) DEFAULT 'baixa',
  probabilidade VARCHAR(30) DEFAULT 'baixa',
  risco_final VARCHAR(30) DEFAULT 'baixo',
  from_assessment_id INT NULL,
  from_factor_id INT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_gse (gse_id),
  CONSTRAINT fk_gse_riscos FOREIGN KEY (gse_id) REFERENCES pgr_gse(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pgr_gse_epc (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  gse_id INT NOT NULL,
  descricao TEXT NOT NULL,
  aplicacao TEXT NULL,
  INDEX idx_gse (gse_id),
  CONSTRAINT fk_gse_epc FOREIGN KEY (gse_id) REFERENCES pgr_gse(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pgr_gse_epi (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  gse_id INT NOT NULL,
  descricao TEXT NOT NULL,
  ca VARCHAR(30) NULL,
  aplicacao TEXT NULL,
  validade VARCHAR(60) NULL,
  INDEX idx_gse (gse_id),
  CONSTRAINT fk_gse_epi FOREIGN KEY (gse_id) REFERENCES pgr_gse(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pgr_gse_acoes (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  gse_id INT NOT NULL,
  what TEXT NOT NULL,
  why TEXT NULL,
  where_loc TEXT NULL,
  when_start VARCHAR(30) NULL,
  when_end VARCHAR(30) NULL,
  who VARCHAR(255) NULL,
  how TEXT NULL,
  how_much VARCHAR(100) NULL,
  priority VARCHAR(30) DEFAULT 'media',
  status VARCHAR(30) DEFAULT 'programado',
  gse_risco_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_gse (gse_id),
  CONSTRAINT fk_gse_acoes FOREIGN KEY (gse_id) REFERENCES pgr_gse(id) ON DELETE CASCADE,
  CONSTRAINT fk_gse_acoes_risco FOREIGN KEY (gse_risco_id) REFERENCES pgr_gse_riscos(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pgr_gse_evidencias (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  gse_id INT NOT NULL,
  tipo VARCHAR(30) NOT NULL,
  titulo VARCHAR(255) NULL,
  descricao TEXT NULL,
  file_url VARCHAR(1024) NULL,
  gse_risco_id INT NULL,
  gse_acao_id INT NULL,
  uploaded_by_user_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_gse (gse_id),
  CONSTRAINT fk_gse_ev FOREIGN KEY (gse_id) REFERENCES pgr_gse(id) ON DELETE CASCADE,
  CONSTRAINT fk_gse_ev_risco FOREIGN KEY (gse_risco_id) REFERENCES pgr_gse_riscos(id) ON DELETE SET NULL,
  CONSTRAINT fk_gse_ev_acao FOREIGN KEY (gse_acao_id) REFERENCES pgr_gse_acoes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pgr_gse_treinamentos (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  gse_id INT NOT NULL,
  nr_code VARCHAR(20) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  carga_horaria INT NULL,
  obrigatorio TINYINT(1) NOT NULL DEFAULT 1,
  INDEX idx_gse (gse_id),
  CONSTRAINT fk_gse_trein FOREIGN KEY (gse_id) REFERENCES pgr_gse(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
