import crypto from "crypto";
import fs from "fs";
import path from "path";
import { TRPCError } from "@trpc/server";
import { sql as drzSql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import {
  activeEmployeeSql,
  ensureActiveEmployeeColumns,
} from "./activeEmployees";
import { sendEmail } from "./email";
import { orChat } from "./contentforge/openrouter";
import esocialCatCodesData from "./data/esocialCatCodes.json";
import {
  calculateOccupationalBmi,
  evaluateAsoReadiness,
  nextReissueVersion,
  normalizeGseCode,
  orderLabel,
} from "./occupationalLifecycle";
import { classifyExamPlanning } from "./occupationalExamPlanning";
import { protectedProcedure, router } from "./trpc";

let occupationalTablesReady = false;

type CatCodeKind =
  | "causative_agent"
  | "generating_situation"
  | "body_part"
  | "injury_nature";
type CatCode = {
  kind: CatCodeKind;
  table: string;
  code: string;
  description: string;
  application?: string | null;
  sourceVersion: string;
};
const esocialCatCodes = esocialCatCodesData as CatCode[];

function catCandidates(kind: CatCodeKind, query: string, limit = 30) {
  const normalized = normalizeMatch(query);
  return esocialCatCodes
    .filter(item => item.kind === kind)
    .map(item => ({
      ...item,
      score: normalized
        ? Math.max(
            matchScore(query, item.description),
            item.code.includes(normalized) ? 1 : 0
          )
        : 0,
    }))
    .filter(
      item =>
        !normalized ||
        item.score > 0 ||
        normalizeMatch(item.description).includes(normalized)
    )
    .sort(
      (a, b) =>
        b.score - a.score || a.description.localeCompare(b.description, "pt-BR")
    )
    .slice(0, limit)
    .map(({ score: _score, ...item }) => item);
}

function rowsOf(result: any): any[] {
  return Array.isArray(result?.[0])
    ? result[0]
    : Array.isArray(result)
      ? result
      : [];
}

function roleOf(ctx: any) {
  return String(ctx.user?.role || "");
}

function normalizeMatch(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function matchScore(source: unknown, candidate: unknown) {
  const left = normalizeMatch(source);
  const right = normalizeMatch(candidate);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.82;
  const a = new Set(left.split(" ").filter(token => token.length > 1));
  const b = new Set(right.split(" ").filter(token => token.length > 1));
  const shared = [...a].filter(token => b.has(token)).length;
  return shared / Math.max(a.size, b.size, 1);
}

function companyOf(ctx: any) {
  const companyId = Number(ctx.user?.companyId || 0);
  if (!companyId)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Empresa não identificada.",
    });
  return companyId;
}

const operationalRoles = [
  "medico",
  "sesmt",
  "admin",
  "company_admin",
  "admin_global",
  "super_admin",
];

const sesmtRoles = [
  "sesmt",
  "admin",
  "company_admin",
  "admin_global",
  "super_admin",
];

function requireOperational(ctx: any) {
  if (!operationalRoles.includes(roleOf(ctx)))
    throw new TRPCError({ code: "FORBIDDEN" });
}

function requireSesmt(ctx: any) {
  if (!sesmtRoles.includes(roleOf(ctx)))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Operação restrita ao SESMT ou à administração autorizada.",
    });
}

function requireDoctor(ctx: any) {
  if (roleOf(ctx) !== "medico")
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Decisão clínica restrita ao perfil Médico.",
    });
}

function requireExamCatalogManager(ctx: any) {
  if (![...sesmtRoles, "medico"].includes(roleOf(ctx)))
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "A gestão do Catálogo de Exames exige perfil Médico, SESMT ou administrador autorizado.",
    });
}

const ownedEntityTables = {
  user: "users",
  branch: "branches",
  sector: "sectors",
  gse: "occupational_gse_master",
  exam: "pcmso_exam_catalog_v2",
  provider: "occupational_health_providers",
  pcmso: "pcmso_programs_v2",
  examOrder: "occupational_exam_orders",
  vaccineCampaign: "medical_vaccine_campaigns_v2",
} as const;

async function requireOwnedEntity(
  db: any,
  companyId: number,
  entity: keyof typeof ownedEntityTables,
  id: number | null | undefined,
  label: string
) {
  if (!id) return;
  const table = ownedEntityTables[entity];
  const result: any = await db.execute(
    drzSql.raw(
      `SELECT id FROM \`${table}\` WHERE id=${Number(id)} AND company_id=${Number(companyId)} LIMIT 1`
    )
  );
  if (!rowsOf(result).length)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `${label} não encontrado(a) nesta empresa.`,
    });
}

async function requireProviderSupportsExam(
  db: any,
  companyId: number,
  providerId: number | null | undefined,
  examId: number
) {
  if (!providerId) return;
  const result: any = await db.execute(
    drzSql`SELECT pe.id FROM occupational_provider_exams pe JOIN occupational_health_providers p ON p.id=pe.provider_id AND p.company_id=pe.company_id AND p.is_active=1 WHERE pe.company_id=${companyId} AND pe.provider_id=${providerId} AND pe.exam_id=${examId} AND pe.is_active=1 LIMIT 1`
  );
  if (!rowsOf(result).length)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "O prestador selecionado não está ativo ou não está vinculado ao procedimento do catálogo mestre.",
    });
}

async function resolveCurrentPcmso(
  db: any,
  companyId: number,
  preferredId?: number | null
) {
  const result: any = await db.execute(
    preferredId
      ? drzSql`SELECT id FROM pcmso_programs_v2 WHERE id=${preferredId} AND company_id=${companyId} AND status='vigente' AND (valid_from IS NULL OR valid_from<=CURDATE()) AND (valid_until IS NULL OR valid_until>=CURDATE()) LIMIT 1`
      : drzSql`SELECT id FROM pcmso_programs_v2 WHERE company_id=${companyId} AND status='vigente' AND (valid_from IS NULL OR valid_from<=CURDATE()) AND (valid_until IS NULL OR valid_until>=CURDATE()) ORDER BY updated_at DESC LIMIT 1`
  );
  return Number(rowsOf(result)[0]?.id || 0);
}

async function loadAsoProcedureState(
  db: any,
  companyId: number,
  collaboratorId: number,
  pcmsoId: number,
  clinicalExamId: number
) {
  const [expectedResult, completedResult]: any[] = await Promise.all([
    db.execute(drzSql`SELECT DISTINCT
      CASE WHEN m.monitoring_kind='avaliacao_clinica' THEN ${clinicalExamId} ELSE m.exam_id END exam_id,
      e.name
      FROM occupational_gse_worker_history h
      JOIN pcmso_risk_monitoring_v2 m ON m.company_id=h.company_id AND m.master_gse_id=h.gse_id
        AND m.pcmso_id=${pcmsoId}
        AND m.monitoring_kind IN ('avaliacao_clinica','exame_complementar')
        AND (m.monitoring_kind='avaliacao_clinica' OR m.exam_id IS NOT NULL)
        AND m.suggestion_status IN ('aprovada','editada')
      JOIN pcmso_exam_catalog_v2 e ON e.company_id=h.company_id
        AND e.id=(CASE WHEN m.monitoring_kind='avaliacao_clinica' THEN ${clinicalExamId} ELSE m.exam_id END)
        AND e.is_active=1
      WHERE h.company_id=${companyId} AND h.collaborator_id=${collaboratorId} AND h.is_current=1`),
    db.execute(drzSql`SELECT r.exam_id,e.name,r.classification,r.performed_at,r.reviewed_at
      FROM occupational_exam_results r
      JOIN pcmso_exam_catalog_v2 e ON e.id=r.exam_id AND e.company_id=r.company_id
      WHERE r.company_id=${companyId} AND r.collaborator_id=${collaboratorId}
      ORDER BY r.performed_at DESC,r.id DESC`),
  ]);
  const expected = rowsOf(expectedResult);
  const expectedIds = new Set(expected.map((row: any) => Number(row.exam_id)));
  const completed = rowsOf(completedResult).filter((row: any) =>
    expectedIds.has(Number(row.exam_id))
  );
  const pendingMedicalReview = completed.filter(
    (row: any) => !row.reviewed_at
  ).length;
  const evaluation = evaluateAsoReadiness({
    expectedExamIds: [...expectedIds],
    completedExamIds: [
      ...new Set(completed.map((row: any) => Number(row.exam_id))),
    ],
    pendingMedicalReview,
  });
  return { expected, completed, evaluation };
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

export async function ensureOccupationalTables() {
  if (occupationalTablesReady) return;
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  await ensureActiveEmployeeColumns(db);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS occupational_gse_master (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    code VARCHAR(60) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'ativo',
    technical_notes MEDIUMTEXT,
    responsible_user_id INT NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_occ_gse_code (company_id, code),
    INDEX idx_occ_gse_company (company_id, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS occupational_gse_scope (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    gse_id INT NOT NULL,
    branch_id INT NULL,
    sector_id INT NULL,
    position_name VARCHAR(180) NULL,
    cost_center VARCHAR(180) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_occ_gse_scope (company_id, gse_id),
    INDEX idx_occ_gse_structure (company_id, branch_id, sector_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS occupational_gse_worker_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    collaborator_id INT NOT NULL,
    gse_id INT NOT NULL,
    valid_from DATETIME NOT NULL,
    valid_until DATETIME NULL,
    is_current TINYINT(1) NOT NULL DEFAULT 1,
    reason VARCHAR(255) NOT NULL,
    origin VARCHAR(80) NOT NULL DEFAULT 'manual',
    structure_snapshot_json LONGTEXT,
    assigned_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_occ_gse_worker_current (company_id, collaborator_id, is_current),
    INDEX idx_occ_gse_history (company_id, gse_id, valid_from)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS occupational_gse_pgr_links (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    gse_id INT NOT NULL,
    pgr_id INT NOT NULL,
    pgr_gse_id INT NOT NULL,
    linked_by INT NOT NULL,
    linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_occ_gse_pgr (gse_id, pgr_id),
    UNIQUE KEY uq_occ_pgr_context (pgr_gse_id),
    INDEX idx_occ_gse_pgr_company (company_id, pgr_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS occupational_gse_movement_alerts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    collaborator_id INT NOT NULL,
    current_gse_id INT NOT NULL,
    previous_structure_json LONGTEXT,
    current_structure_json LONGTEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'pendente',
    resolution VARCHAR(80) NULL,
    notes TEXT,
    resolved_by INT NULL,
    resolved_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_occ_movement_company (company_id, status, created_at),
    INDEX idx_occ_movement_worker (collaborator_id, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS occupational_health_providers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    legal_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    cnpj VARCHAR(30),
    address TEXT,
    phone VARCHAR(80),
    email VARCHAR(320),
    contact_name VARCHAR(255),
    in_company_service TINYINT(1) NOT NULL DEFAULT 0,
    exams_json LONGTEXT,
    specialties_json LONGTEXT,
    credential_status VARCHAR(40) NOT NULL DEFAULT 'ativo',
    credential_valid_until DATE NULL,
    documents_json LONGTEXT,
    notes TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_occ_provider_company (company_id, credential_status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await ensureColumn(
    db,
    "occupational_health_providers",
    "municipality",
    "VARCHAR(180) NULL"
  );
  await ensureColumn(
    db,
    "occupational_health_providers",
    "uf",
    "VARCHAR(2) NULL"
  );
  await ensureColumn(
    db,
    "occupational_health_providers",
    "services_json",
    "LONGTEXT NULL"
  );
  await ensureColumn(
    db,
    "occupational_health_providers",
    "is_active",
    "TINYINT(1) NOT NULL DEFAULT 1"
  );

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS occupational_provider_exams (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    provider_id INT NOT NULL,
    exam_id INT NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_occ_provider_exam (company_id, provider_id, exam_id),
    INDEX idx_occ_provider_exam_catalog (company_id, exam_id, is_active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS occupational_exam_orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    order_number VARCHAR(80) NOT NULL,
    parent_order_id BIGINT NULL,
    version_number INT NOT NULL DEFAULT 1,
    collaborator_id INT NOT NULL,
    gse_id INT NULL,
    pcmso_id INT NULL,
    monitoring_id INT NULL,
    exam_id INT NOT NULL,
    provider_id INT NULL,
    service_mode VARCHAR(40) NOT NULL DEFAULT 'prestador',
    service_location TEXT,
    issue_date DATE NOT NULL,
    valid_until DATE NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'pendente',
    reissue_reason VARCHAR(180) NULL,
    reissue_justification TEXT,
    orientations TEXT,
    pdf_private_path VARCHAR(700),
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_occ_order_number (company_id, order_number),
    INDEX idx_occ_order_worker (company_id, collaborator_id, status),
    INDEX idx_occ_order_exam (company_id, exam_id, valid_until),
    INDEX idx_occ_order_parent (parent_order_id, version_number)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await ensureColumn(
    db,
    "occupational_exam_orders",
    "procedure_kind",
    "VARCHAR(40) NOT NULL DEFAULT 'exame_complementar'"
  );
  await ensureColumn(
    db,
    "occupational_exam_orders",
    "exercise_year",
    "INT NULL"
  );
  await ensureColumn(
    db,
    "occupational_exam_orders",
    "request_type",
    "VARCHAR(30) NOT NULL DEFAULT 'normal'"
  );
  await ensureColumn(
    db,
    "occupational_exam_orders",
    "repeat_justification",
    "TEXT NULL"
  );

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS occupational_exam_order_communications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    order_id BIGINT NOT NULL,
    channel VARCHAR(30) NOT NULL,
    recipient VARCHAR(320),
    status VARCHAR(40) NOT NULL,
    provider_message TEXT,
    sent_by INT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_occ_order_comm (company_id, order_id, sent_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS occupational_exam_results (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    order_id BIGINT NULL,
    collaborator_id INT NOT NULL,
    exam_id INT NOT NULL,
    performed_at DATETIME NOT NULL,
    laboratory_name VARCHAR(255),
    result_type VARCHAR(30) NOT NULL DEFAULT 'qualitativo',
    result_summary TEXT,
    parameters_json LONGTEXT,
    reference_text MEDIUMTEXT,
    classification VARCHAR(50) NOT NULL DEFAULT 'pendente_revisao',
    source VARCHAR(30) NOT NULL DEFAULT 'manual',
    identity_status VARCHAR(40) NOT NULL DEFAULT 'confirmado',
    document_private_path VARCHAR(700),
    medical_notes MEDIUMTEXT,
    reviewed_by INT NULL,
    reviewed_at DATETIME NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_occ_result_worker (company_id, collaborator_id, performed_at),
    INDEX idx_occ_result_review (company_id, classification, reviewed_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS occupational_anamneses (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    collaborator_id INT NOT NULL,
    encounter_id INT NULL,
    anamnesis_type VARCHAR(50) NOT NULL,
    answers_json LONGTEXT NOT NULL,
    occupational_context_json LONGTEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'rascunho',
    signature_hash VARCHAR(128),
    doctor_user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_occ_anamnesis_worker (company_id, collaborator_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await ensureColumn(
    db,
    "occupational_anamneses",
    "vital_signs_json",
    "LONGTEXT NULL"
  );
  await ensureColumn(db, "occupational_anamneses", "bmi", "DECIMAL(7,2) NULL");
  await ensureColumn(
    db,
    "occupational_anamneses",
    "questionnaire_version",
    "VARCHAR(40) NULL"
  );

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS occupational_anamnesis_questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL DEFAULT 0,
    question_code VARCHAR(100) NOT NULL,
    anamnesis_type VARCHAR(50) NOT NULL DEFAULT 'todos',
    group_name VARCHAR(120) NOT NULL,
    question_text VARCHAR(1000) NOT NULL,
    response_type VARCHAR(40) NOT NULL DEFAULT 'texto',
    options_json LONGTEXT,
    is_required TINYINT(1) NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_by INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_occ_anamnesis_question (company_id, anamnesis_type, question_code),
    INDEX idx_occ_anamnesis_questions (company_id, anamnesis_type, is_active, sort_order)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS occupational_asos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    collaborator_id INT NOT NULL,
    encounter_id INT NULL,
    pcmso_id INT NULL,
    gse_id INT NULL,
    aso_type VARCHAR(50) NOT NULL,
    fitness_status VARCHAR(40) NOT NULL,
    specific_aptitudes_json LONGTEXT,
    risk_snapshot_json LONGTEXT,
    exam_snapshot_json LONGTEXT,
    pending_justification MEDIUMTEXT,
    doctor_user_id INT NOT NULL,
    doctor_crm VARCHAR(80),
    status VARCHAR(40) NOT NULL DEFAULT 'emitido_pendente_assinatura',
    signature_status VARCHAR(40) NOT NULL DEFAULT 'pendente_integracao',
    signature_hash VARCHAR(128),
    pdf_private_path VARCHAR(700),
    issued_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_occ_aso_worker (company_id, collaborator_id, issued_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await ensureColumn(
    db,
    "occupational_asos",
    "signature_status",
    "VARCHAR(40) NOT NULL DEFAULT 'pendente_integracao'"
  );
  await ensureColumn(db, "occupational_asos", "anamnesis_id", "BIGINT NULL");
  await db.execute(
    drzSql`UPDATE occupational_asos SET status='finalizado' WHERE pdf_private_path IS NOT NULL AND status='emitido_pendente_assinatura'`
  );

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS occupational_cat_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    collaborator_id INT NOT NULL,
    event_at DATETIME NOT NULL,
    location_text TEXT,
    accident_type VARCHAR(100),
    description MEDIUMTEXT NOT NULL,
    causative_agent TEXT,
    body_part VARCHAR(180),
    injury_nature VARCHAR(180),
    leave_required TINYINT(1) NOT NULL DEFAULT 0,
    witnesses_json LONGTEXT,
    documents_json LONGTEXT,
    status VARCHAR(40) NOT NULL DEFAULT 'rascunho',
    esocial_status VARCHAR(40) NOT NULL DEFAULT 'nao_enviado',
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_occ_cat_company (company_id, status, event_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  const catColumns: Array<[string, string]> = [
    ["emitter_type", "VARCHAR(40) NULL"],
    ["cat_type", "VARCHAR(40) NULL"],
    ["initiative", "VARCHAR(60) NULL"],
    ["registration_source", "VARCHAR(60) NULL"],
    ["cat_number", "VARCHAR(100) NULL"],
    ["origin_receipt", "VARCHAR(120) NULL"],
    ["employer_registration_type", "VARCHAR(40) NULL"],
    ["employer_registration_number", "VARCHAR(40) NULL"],
    ["employer_cnae", "VARCHAR(20) NULL"],
    ["hours_worked_before_accident", "VARCHAR(30) NULL"],
    ["last_worked_date", "DATE NULL"],
    ["location_type", "VARCHAR(80) NULL"],
    ["location_detail", "TEXT NULL"],
    ["location_registration", "VARCHAR(80) NULL"],
    ["event_city", "VARCHAR(180) NULL"],
    ["event_uf", "VARCHAR(2) NULL"],
    ["event_country", "VARCHAR(100) NULL"],
    ["body_part_code", "VARCHAR(30) NULL"],
    ["laterality", "VARCHAR(30) NULL"],
    ["causative_agent_code", "VARCHAR(30) NULL"],
    ["generating_situation_code", "VARCHAR(30) NULL"],
    ["generating_situation", "TEXT NULL"],
    ["police_report", "TINYINT(1) NOT NULL DEFAULT 0"],
    ["death_occurred", "TINYINT(1) NOT NULL DEFAULT 0"],
    ["death_date", "DATE NULL"],
    ["medical_attendance_at", "DATETIME NULL"],
    ["hospitalization", "TINYINT(1) NOT NULL DEFAULT 0"],
    ["treatment_days", "INT NULL"],
    ["injury_nature_code", "VARCHAR(30) NULL"],
    ["diagnosis", "TEXT NULL"],
    ["cid", "VARCHAR(20) NULL"],
    ["doctor_name", "VARCHAR(255) NULL"],
    ["doctor_council", "VARCHAR(20) NULL"],
    ["doctor_uf", "VARCHAR(2) NULL"],
    ["doctor_registration", "VARCHAR(40) NULL"],
    ["medical_notes", "MEDIUMTEXT NULL"],
    ["esocial_version", "VARCHAR(60) NULL"],
    ["esocial_event_json", "LONGTEXT NULL"],
    ["pdf_private_path", "VARCHAR(700) NULL"],
  ];
  for (const [column, definition] of catColumns)
    await ensureColumn(db, "occupational_cat_records", column, definition);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS occupational_esocial_transmissions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    entity_type VARCHAR(40) NOT NULL,
    entity_id BIGINT NOT NULL,
    event_code VARCHAR(20) NOT NULL,
    layout_version VARCHAR(60) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'pendente_integracao',
    protocol VARCHAR(120) NULL,
    receipt VARCHAR(120) NULL,
    error_message MEDIUMTEXT NULL,
    payload_json LONGTEXT,
    response_json LONGTEXT,
    requested_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_occ_esocial_entity (company_id, entity_type, entity_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS occupational_work_orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    collaborator_id INT NOT NULL,
    gse_id INT NULL,
    title VARCHAR(255) NOT NULL,
    activity_text MEDIUMTEXT,
    risks_json LONGTEXT,
    preventive_measures_json LONGTEXT,
    epi_json LONGTEXT,
    epc_json LONGTEXT,
    trainings_json LONGTEXT,
    valid_from DATE NULL,
    valid_until DATE NULL,
    acknowledgement_status VARCHAR(40) NOT NULL DEFAULT 'pendente',
    signature_private_path VARCHAR(700),
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_occ_os_worker (company_id, collaborator_id, acknowledgement_status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS medical_vaccine_campaign_participants_v2 (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    campaign_id INT NOT NULL,
    collaborator_id INT NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'convocado',
    absence_reason VARCHAR(120),
    notification_status VARCHAR(40) NOT NULL DEFAULT 'nao_enviada',
    receipt_private_path VARCHAR(700),
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_vaccine_campaign_worker (campaign_id, collaborator_id),
    INDEX idx_vaccine_participant_company (company_id, campaign_id, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await ensureColumn(
    db,
    "medical_vaccine_campaign_participants_v2",
    "notification_sent_at",
    "DATETIME NULL"
  );
  await ensureColumn(
    db,
    "medical_vaccine_campaign_participants_v2",
    "vaccinated_at",
    "DATETIME NULL"
  );
  await ensureColumn(
    db,
    "medical_vaccine_campaign_participants_v2",
    "lot",
    "VARCHAR(120) NULL"
  );
  await ensureColumn(
    db,
    "medical_vaccine_campaign_participants_v2",
    "applied_by",
    "VARCHAR(255) NULL"
  );

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS occupational_audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    actor_user_id INT NOT NULL,
    action VARCHAR(120) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id BIGINT NULL,
    collaborator_id INT NULL,
    details_json LONGTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_occ_audit_company (company_id, created_at),
    INDEX idx_occ_audit_worker (collaborator_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS pcmso_exam_catalog_v2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    exam_type VARCHAR(30) NOT NULL DEFAULT 'complementar',
    description TEXT,
    default_periodicity VARCHAR(120),
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_pcmso_exam_company_name (company_id, name),
    INDEX idx_pcmso_exam_company (company_id, is_active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await ensureColumn(
    db,
    "pcmso_exam_catalog_v2",
    "category",
    "VARCHAR(80) NULL"
  );
  await ensureColumn(
    db,
    "pcmso_exam_catalog_v2",
    "result_type",
    "VARCHAR(30) NOT NULL DEFAULT 'qualitativo'"
  );
  await ensureColumn(
    db,
    "pcmso_exam_catalog_v2",
    "default_unit",
    "VARCHAR(80) NULL"
  );
  await ensureColumn(
    db,
    "pcmso_exam_catalog_v2",
    "reference_guidance",
    "MEDIUMTEXT NULL"
  );
  await ensureColumn(db, "pgr_gse", "master_gse_id", "INT NULL");
  const defaultQuestions = [
    [
      "hist_doenca",
      "todos",
      "Histórico de saúde",
      "Possui doença diagnosticada ou condição crônica?",
      "sim_nao_detalhe",
      10,
    ],
    [
      "tratamento_atual",
      "todos",
      "Histórico de saúde",
      "Realiza tratamento ou utiliza medicamento atualmente?",
      "sim_nao_detalhe",
      20,
    ],
    [
      "alergias",
      "todos",
      "Histórico de saúde",
      "Possui alergias conhecidas?",
      "sim_nao_detalhe",
      30,
    ],
    [
      "cirurgias",
      "admissional",
      "Antecedentes",
      "Já realizou cirurgias ou internações relevantes?",
      "sim_nao_detalhe",
      40,
    ],
    [
      "afastamentos",
      "todos",
      "Histórico ocupacional",
      "Já esteve afastado do trabalho por motivo de saúde?",
      "sim_nao_detalhe",
      50,
    ],
    [
      "acidente_trabalho",
      "todos",
      "Histórico ocupacional",
      "Já sofreu acidente ou doença relacionada ao trabalho?",
      "sim_nao_detalhe",
      60,
    ],
    [
      "exposicao_anterior",
      "admissional",
      "Histórico ocupacional",
      "Descreva exposições ocupacionais relevantes em empregos anteriores.",
      "texto_longo",
      70,
    ],
    [
      "epi_anterior",
      "admissional",
      "Histórico ocupacional",
      "Utilizou EPI em atividades anteriores?",
      "sim_nao_detalhe",
      80,
    ],
    [
      "queixa_atual",
      "todos",
      "Avaliação atual",
      "Existe queixa de saúde atual ou relacionada ao trabalho?",
      "sim_nao_detalhe",
      90,
    ],
    [
      "sono",
      "todos",
      "Hábitos e bem-estar",
      "Como considera a qualidade do sono?",
      "escala_1_5",
      100,
    ],
    [
      "tabagismo",
      "todos",
      "Hábitos e bem-estar",
      "Faz uso de tabaco?",
      "sim_nao_detalhe",
      110,
    ],
    [
      "alcool",
      "todos",
      "Hábitos e bem-estar",
      "Consome bebidas alcoólicas?",
      "sim_nao_detalhe",
      120,
    ],
    [
      "atividade_fisica",
      "todos",
      "Hábitos e bem-estar",
      "Pratica atividade física regularmente?",
      "sim_nao_detalhe",
      130,
    ],
    [
      "mudanca_saude",
      "periodico",
      "Evolução clínica",
      "Houve alteração importante na saúde desde o último exame?",
      "sim_nao_detalhe",
      140,
    ],
    [
      "mudanca_exposicao",
      "periodico",
      "Evolução ocupacional",
      "Houve mudança de função, setor ou exposição ocupacional?",
      "sim_nao_detalhe",
      150,
    ],
    [
      "motivo_afastamento",
      "retorno",
      "Retorno ao trabalho",
      "Qual foi o motivo e o período do afastamento?",
      "texto_longo",
      160,
    ],
    [
      "restricoes_retorno",
      "retorno",
      "Retorno ao trabalho",
      "Há restrições, limitações ou necessidade de adaptação para o retorno?",
      "sim_nao_detalhe",
      170,
    ],
    [
      "funcao_anterior",
      "mudanca_risco",
      "Mudança de risco",
      "Informe função, setor e riscos anteriores.",
      "texto_longo",
      180,
    ],
    [
      "nova_funcao",
      "mudanca_risco",
      "Mudança de risco",
      "Informe nova função, setor e riscos previstos.",
      "texto_longo",
      190,
    ],
    [
      "estado_demissional",
      "demissional",
      "Avaliação demissional",
      "Como está seu estado de saúde atual e existem queixas relacionadas ao trabalho?",
      "texto_longo",
      200,
    ],
    [
      "observacoes",
      "todos",
      "Observações",
      "Deseja relatar outra condição ou informação relevante ao médico?",
      "texto_longo",
      999,
    ],
  ];
  for (const question of defaultQuestions) {
    await db.execute(drzSql`INSERT IGNORE INTO occupational_anamnesis_questions
      (company_id,question_code,anamnesis_type,group_name,question_text,response_type,sort_order,created_by)
      VALUES (0,${question[0]},${question[1]},${question[2]},${question[3]},${question[4]},${question[5]},0)`);
  }
  occupationalTablesReady = true;
}

export async function ensureClinicalConsultationExam(
  db: any,
  companyId: number,
  actorId: number
) {
  const existing: any = await db.execute(
    drzSql`SELECT id FROM pcmso_exam_catalog_v2
      WHERE company_id=${companyId} AND is_active=1 AND (
        name='Consulta clínica ocupacional'
        OR (exam_type='clinico' AND (LOWER(name) LIKE '%consulta%' OR LOWER(name) LIKE '%avalia%cl%nic%'))
      )
      ORDER BY (name='Consulta clínica ocupacional') DESC,id
      LIMIT 1`
  );
  const found = Number(rowsOf(existing)[0]?.id || 0);
  if (found) return found;
  const result: any = await db.execute(drzSql`INSERT INTO pcmso_exam_catalog_v2
    (company_id,name,exam_type,category,description,default_periodicity,result_type,reference_guidance,is_active,created_by)
    VALUES (${companyId},'Consulta clínica ocupacional','clinico','Avaliação clínica','Procedimento clínico ocupacional independente, utilizado quando a matriz médica define avaliação clínica sem exame complementar.','Conforme decisão médica','qualitativo','Conclusão exclusiva do médico examinador, com registro em anamnese, consulta e ASO.',1,${actorId})`);
  return Number((result as any)[0]?.insertId || 0);
}

function catEsocialPayload(input: any, company: any, worker: any) {
  return {
    layout: "eSocial S-1.3 - NT 06/2026",
    event: "S-2210",
    transmissionStatus: "pendente_integracao",
    employer: {
      registrationType: input.employerRegistrationType || "cnpj",
      registrationNumber:
        input.employerRegistrationNumber || company?.cnpj || null,
      cnae: input.employerCnae || null,
    },
    worker: {
      id: Number(worker?.id || input.collaboratorId),
      cpf: worker?.cpf || null,
      name: worker?.name || null,
      registration: worker?.employee_registration || null,
    },
    cat: {
      type: input.catType,
      initiative: input.initiative,
      emitterType: input.emitterType,
      eventAt: input.eventAt,
      accidentType: input.accidentType || null,
      hoursWorkedBeforeAccident: input.hoursWorkedBeforeAccident || null,
      lastWorkedDate: input.lastWorkedDate || null,
      location: {
        type: input.locationType || null,
        description: input.location || null,
        detail: input.locationDetail || null,
        city: input.eventCity || null,
        uf: input.eventUf || null,
        country: input.eventCountry || "Brasil",
      },
      causativeAgent: {
        code: input.causativeAgentCode || null,
        description: input.causativeAgent || null,
      },
      generatingSituation: {
        code: input.generatingSituationCode || null,
        description: input.generatingSituation || null,
      },
      bodyPart: {
        code: input.bodyPartCode || null,
        description: input.bodyPart || null,
        laterality: input.laterality || null,
      },
      injury: {
        code: input.injuryNatureCode || null,
        description: input.injuryNature || null,
      },
      leaveRequired: Boolean(input.leaveRequired),
      death: {
        occurred: Boolean(input.deathOccurred),
        date: input.deathDate || null,
      },
      policeReport: Boolean(input.policeReport),
      medical: {
        attendanceAt: input.medicalAttendanceAt || null,
        hospitalization: Boolean(input.hospitalization),
        treatmentDays: input.treatmentDays ?? null,
        diagnosis: input.diagnosis || null,
        cid: input.cid || null,
        professional: {
          name: input.doctorName || null,
          council: input.doctorCouncil || null,
          uf: input.doctorUf || null,
          registration: input.doctorRegistration || null,
        },
      },
    },
  };
}

async function audit(
  db: any,
  ctx: any,
  action: string,
  entityType: string,
  entityId?: number | null,
  collaboratorId?: number | null,
  details?: any
) {
  await db.execute(drzSql`INSERT INTO occupational_audit_log
    (company_id,actor_user_id,action,entity_type,entity_id,collaborator_id,details_json)
    VALUES (${companyOf(ctx)},${Number(ctx.user.id)},${action},${entityType},${entityId || null},${collaboratorId || null},${details ? JSON.stringify(details) : null})`);
}

function privateRoot(companyId: number) {
  const root =
    process.env.NODE_ENV === "production"
      ? "/var/www/saudedotrabalho/private/occupational"
      : path.join(process.cwd(), "private", "occupational");
  const target = path.join(root, String(companyId));
  fs.mkdirSync(target, { recursive: true });
  return target;
}

function savePrivateFile(
  companyId: number,
  folder: string,
  fileName: string,
  dataUrl: string
) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/s);
  if (!match)
    throw new TRPCError({ code: "BAD_REQUEST", message: "Arquivo inválido." });
  const safe = path
    .basename(fileName || "documento.bin")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
  const dir = path.join(privateRoot(companyId), folder);
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(
    dir,
    `${Date.now()}_${crypto.randomBytes(5).toString("hex")}_${safe}`
  );
  fs.writeFileSync(target, Buffer.from(match[2], "base64"));
  return target;
}

function esc(value: any) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    char =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ] || char
  );
}

function privateImageDataUri(storedPath: unknown) {
  const value = String(storedPath || "").trim();
  if (!value) return "";
  const candidates = [
    value,
    value.startsWith("/uploads/")
      ? path.join(process.cwd(), value.replace(/^\/+/, ""))
      : "",
  ].filter(Boolean);
  const filePath = candidates.find(candidate => fs.existsSync(candidate));
  if (!filePath) return "";
  const extension = path.extname(filePath).toLowerCase();
  const mime =
    extension === ".png"
      ? "image/png"
      : extension === ".webp"
        ? "image/webp"
        : "image/jpeg";
  return `data:${mime};base64,${fs.readFileSync(filePath).toString("base64")}`;
}

async function renderPdf(
  companyId: number,
  folder: string,
  name: string,
  html: string
) {
  const dir = path.join(privateRoot(companyId), folder);
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, name);
  const puppeteer = (await import("puppeteer")).default;
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    await page.pdf({ path: target, format: "A4", printBackground: true });
  } finally {
    await browser.close();
  }
  return target;
}

async function detectMovements(db: any, companyId: number) {
  const result: any = await db.execute(
    drzSql.raw(`SELECT h.collaborator_id,h.gse_id,h.structure_snapshot_json,u.branch_id,u.sector_id,u.position
    FROM occupational_gse_worker_history h JOIN users u ON u.id=h.collaborator_id
    WHERE h.company_id=${companyId} AND h.is_current=1 AND u.company_id=${companyId} AND ${activeEmployeeSql("u")}`)
  );
  let created = 0;
  for (const row of rowsOf(result)) {
    let previous: any = {};
    try {
      previous = JSON.parse(row.structure_snapshot_json || "{}");
    } catch {}
    const current = {
      branchId: Number(row.branch_id || 0) || null,
      sectorId: Number(row.sector_id || 0) || null,
      position: String(row.position || ""),
    };
    if (
      Number(previous.branchId || 0) === Number(current.branchId || 0) &&
      Number(previous.sectorId || 0) === Number(current.sectorId || 0) &&
      String(previous.position || "") === current.position
    )
      continue;
    const exists: any = await db.execute(
      drzSql`SELECT id FROM occupational_gse_movement_alerts WHERE company_id=${companyId} AND collaborator_id=${Number(row.collaborator_id)} AND status='pendente' LIMIT 1`
    );
    if (rowsOf(exists).length) continue;
    await db.execute(drzSql`INSERT INTO occupational_gse_movement_alerts
      (company_id,collaborator_id,current_gse_id,previous_structure_json,current_structure_json)
      VALUES (${companyId},${Number(row.collaborator_id)},${Number(row.gse_id)},${JSON.stringify(previous)},${JSON.stringify(current)})`);
    created++;
  }
  return created;
}

const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function loadPcmsoOrderSource(
  db: any,
  companyId: number,
  collaboratorId: number,
  monitoringId: number,
  clinicalExamId: number
) {
  const result: any = await db.execute(
    drzSql`SELECT u.id collaborator_id,u.name collaborator_name,u.cpf,u.employee_registration,
      h.gse_id,g.code gse_code,g.name gse_name,m.id monitoring_id,m.pcmso_id,
      m.monitoring_kind,CASE WHEN m.monitoring_kind='avaliacao_clinica' THEN ${clinicalExamId} ELSE m.exam_id END exam_id,
      e.name exam_name,p.title pcmso_title,p.status pcmso_status
    FROM users u
    JOIN occupational_gse_worker_history h ON h.collaborator_id=u.id AND h.company_id=u.company_id AND h.is_current=1
    JOIN occupational_gse_master g ON g.id=h.gse_id AND g.company_id=u.company_id
    JOIN pcmso_risk_monitoring_v2 m ON m.id=${monitoringId} AND m.company_id=u.company_id
      AND m.monitoring_kind IN ('avaliacao_clinica','exame_complementar')
      AND (m.monitoring_kind='avaliacao_clinica' OR m.exam_id IS NOT NULL)
      AND m.suggestion_status IN ('aprovada','editada')
    LEFT JOIN occupational_gse_pgr_links l ON l.company_id=m.company_id AND l.pgr_gse_id=m.pgr_gse_id
    JOIN pcmso_programs_v2 p ON p.id=m.pcmso_id AND p.company_id=u.company_id
      AND p.status IN ('em_revisao','vigente') AND (p.saved_at IS NOT NULL OR p.status='vigente')
    JOIN pcmso_exam_catalog_v2 e ON e.id=(CASE WHEN m.monitoring_kind='avaliacao_clinica' THEN ${clinicalExamId} ELSE m.exam_id END)
      AND e.company_id=u.company_id AND e.is_active=1
    WHERE u.id=${collaboratorId} AND u.company_id=${companyId} AND ${drzSql.raw(activeEmployeeSql("u"))}
      AND COALESCE(m.master_gse_id,l.gse_id)=h.gse_id
    LIMIT 1`
  );
  return rowsOf(result)[0] || null;
}

async function loadExamEvidence(
  db: any,
  companyId: number,
  source: any,
  exerciseYear: number
) {
  const currentResult: any = await db.execute(
    drzSql`SELECT COUNT(*) total,MAX(performed_at) latest_result_at
      FROM occupational_exam_results
      WHERE company_id=${companyId} AND collaborator_id=${Number(source.collaborator_id)}
        AND exam_id=${Number(source.exam_id)} AND YEAR(performed_at)=${exerciseYear}`
  );
  let resultCount = Number(rowsOf(currentResult)[0]?.total || 0);
  let latestResultAt = rowsOf(currentResult)[0]?.latest_result_at || null;
  if (source.monitoring_kind === "avaliacao_clinica") {
    const legacyResult: any = await db.execute(
      drzSql`SELECT COUNT(*) total,MAX(performed_at) latest_result_at
        FROM medical_occupational_exams_v2
        WHERE company_id=${companyId} AND collaborator_id=${Number(source.collaborator_id)}
          AND pcmso_id=${Number(source.pcmso_id)} AND YEAR(performed_at)=${exerciseYear}`
    );
    const legacy = rowsOf(legacyResult)[0] || {};
    resultCount += Number(legacy.total || 0);
    latestResultAt = latestResultAt || legacy.latest_result_at || null;
  }
  const requestResult: any = await db.execute(
    drzSql`SELECT COUNT(*) total,MAX(issue_date) latest_request_at
      FROM occupational_exam_orders
      WHERE company_id=${companyId} AND collaborator_id=${Number(source.collaborator_id)}
        AND exam_id=${Number(source.exam_id)}
        AND (exercise_year=${exerciseYear} OR (exercise_year IS NULL AND YEAR(issue_date)=${exerciseYear}))
        AND status<>'cancelada'`
  );
  const requests = rowsOf(requestResult)[0] || {};
  return {
    resultCount,
    latestResultAt,
    requestCount: Number(requests.total || 0),
    latestRequestAt: requests.latest_request_at || null,
  };
}

export const occupationalLifecycleRouter = router({
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    requireOperational(ctx);
    await ensureOccupationalTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) return null;
    await detectMovements(db, companyId);
    const result: any = await db.execute(
      drzSql.raw(`SELECT
      (SELECT COUNT(*) FROM occupational_gse_master WHERE company_id=${companyId} AND status='ativo') gses,
      (SELECT COUNT(*) FROM users u WHERE u.company_id=${companyId} AND ${activeEmployeeSql("u")}) active_workers,
      (SELECT COUNT(DISTINCT h.collaborator_id) FROM occupational_gse_worker_history h JOIN users ug ON ug.id=h.collaborator_id AND ug.company_id=h.company_id WHERE h.company_id=${companyId} AND h.is_current=1 AND ${activeEmployeeSql("ug")}) workers_with_gse,
      (SELECT COUNT(*) FROM occupational_gse_movement_alerts WHERE company_id=${companyId} AND status='pendente') movement_alerts,
      (SELECT COUNT(*) FROM occupational_exam_orders WHERE company_id=${companyId} AND status IN ('pendente','enviada','vencida')) pending_orders,
      (SELECT COUNT(*) FROM occupational_exam_results WHERE company_id=${companyId} AND reviewed_at IS NULL) pending_results,
      (SELECT COUNT(*) FROM occupational_asos WHERE company_id=${companyId} AND status IN ('emitido','emitido_pendente_assinatura','assinado')) issued_asos,
      (SELECT COUNT(*) FROM occupational_cat_records WHERE company_id=${companyId} AND esocial_status<>'enviado') pending_cats`)
    );
    const row = rowsOf(result)[0] || {};
    const active = Number(row.active_workers || 0);
    const assigned = Number(row.workers_with_gse || 0);
    return {
      ...row,
      workers_without_gse: Math.max(0, active - assigned),
      gse_coverage: active ? Math.round((assigned / active) * 100) : 100,
    };
  }),

  listGses: protectedProcedure.query(async ({ ctx }) => {
    requireOperational(ctx);
    await ensureOccupationalTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) return [];
    const result: any = await db.execute(drzSql`SELECT g.*,
      (SELECT COUNT(*) FROM occupational_gse_worker_history h WHERE h.gse_id=g.id AND h.is_current=1) worker_count,
      (SELECT COUNT(*) FROM occupational_gse_scope s WHERE s.gse_id=g.id) scope_count,
      (SELECT COUNT(*) FROM occupational_gse_pgr_links l WHERE l.gse_id=g.id) pgr_count
      FROM occupational_gse_master g WHERE g.company_id=${companyId} ORDER BY g.status='ativo' DESC,g.code,g.name`);
    return rowsOf(result);
  }),

  getGse: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      requireOperational(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) return null;
      const [gse, scope, workers, pgrs, history] = await Promise.all([
        db.execute(
          drzSql`SELECT * FROM occupational_gse_master WHERE id=${input.id} AND company_id=${companyId} LIMIT 1`
        ),
        db.execute(
          drzSql`SELECT s.*,b.name branch_name,se.name sector_name FROM occupational_gse_scope s LEFT JOIN branches b ON b.id=s.branch_id LEFT JOIN sectors se ON se.id=s.sector_id WHERE s.gse_id=${input.id} AND s.company_id=${companyId} ORDER BY b.name,se.name,s.position_name`
        ),
        db.execute(
          drzSql`SELECT h.id,h.valid_from,h.reason,h.origin,u.id collaborator_id,u.name,u.cpf,u.employee_registration,u.position,b.name branch_name,s.name sector_name FROM occupational_gse_worker_history h JOIN users u ON u.id=h.collaborator_id LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN sectors s ON s.id=u.sector_id WHERE h.gse_id=${input.id} AND h.company_id=${companyId} AND h.is_current=1 ORDER BY u.name`
        ),
        db.execute(
          drzSql`SELECT l.*,p.title pgr_title,pg.nome pgr_gse_name FROM occupational_gse_pgr_links l JOIN pgr_documents p ON p.id=l.pgr_id JOIN pgr_gse pg ON pg.id=l.pgr_gse_id WHERE l.gse_id=${input.id} AND l.company_id=${companyId} ORDER BY p.updated_at DESC`
        ),
        db.execute(
          drzSql`SELECT h.*,u.name collaborator_name FROM occupational_gse_worker_history h JOIN users u ON u.id=h.collaborator_id WHERE h.gse_id=${input.id} AND h.company_id=${companyId} ORDER BY h.valid_from DESC LIMIT 300`
        ),
      ]);
      return {
        gse: rowsOf(gse)[0] || null,
        scope: rowsOf(scope),
        workers: rowsOf(workers),
        pgrs: rowsOf(pgrs),
        history: rowsOf(history),
      };
    }),

  upsertGse: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        code: z.string().min(2).max(60),
        name: z.string().min(2).max(255),
        description: z.string().max(10000).optional(),
        status: z.enum(["ativo", "inativo", "em_revisao"]).default("ativo"),
        technicalNotes: z.string().max(50000).optional(),
        scope: z
          .array(
            z.object({
              branchId: z.number().int().positive().nullable().optional(),
              sectorId: z.number().int().positive().nullable().optional(),
              positionName: z.string().max(180).nullable().optional(),
              costCenter: z.string().max(180).nullable().optional(),
            })
          )
          .max(300)
          .default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireSesmt(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const code = normalizeGseCode(input.code);
      if (!code)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Código inválido.",
        });
      let id = Number(input.id || 0);
      if (id) {
        await requireOwnedEntity(db, companyId, "gse", id, "GSE mestre");
        await db.execute(
          drzSql`UPDATE occupational_gse_master SET code=${code},name=${input.name},description=${input.description || null},status=${input.status},technical_notes=${input.technicalNotes || null},responsible_user_id=${Number(ctx.user.id)} WHERE id=${id} AND company_id=${companyId}`
        );
      } else {
        const result: any =
          await db.execute(drzSql`INSERT INTO occupational_gse_master
          (company_id,code,name,description,status,technical_notes,responsible_user_id,created_by)
          VALUES (${companyId},${code},${input.name},${input.description || null},${input.status},${input.technicalNotes || null},${Number(ctx.user.id)},${Number(ctx.user.id)})`);
        id = Number((result as any)[0]?.insertId || 0);
      }
      await db.execute(
        drzSql`DELETE FROM occupational_gse_scope WHERE gse_id=${id} AND company_id=${companyId}`
      );
      for (const item of input.scope) {
        await requireOwnedEntity(
          db,
          companyId,
          "branch",
          item.branchId,
          "Filial"
        );
        await requireOwnedEntity(
          db,
          companyId,
          "sector",
          item.sectorId,
          "Setor"
        );
        await db.execute(drzSql`INSERT INTO occupational_gse_scope
          (company_id,gse_id,branch_id,sector_id,position_name,cost_center)
          VALUES (${companyId},${id},${item.branchId || null},${item.sectorId || null},${item.positionName || null},${item.costCenter || null})`);
      }
      await audit(
        db,
        ctx,
        input.id ? "gse_updated" : "gse_created",
        "gse_master",
        id,
        null,
        { code, scope: input.scope.length }
      );
      return { ok: true, id, code };
    }),

  listStructure: protectedProcedure.query(async ({ ctx }) => {
    requireOperational(ctx);
    await ensureOccupationalTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) return { branches: [], sectors: [], pgrs: [] };
    const [branches, sectors, pgrs] = await Promise.all([
      db.execute(
        drzSql`SELECT id,name FROM branches WHERE company_id=${companyId} ORDER BY name`
      ),
      db.execute(
        drzSql`SELECT id,name,branch_id FROM sectors WHERE company_id=${companyId} ORDER BY name`
      ),
      db.execute(
        drzSql`SELECT id,title,status,branch_id,updated_at FROM pgr_documents WHERE company_id=${companyId} ORDER BY updated_at DESC`
      ),
    ]);
    return {
      branches: rowsOf(branches),
      sectors: rowsOf(sectors),
      pgrs: rowsOf(pgrs),
    };
  }),

  listWorkers: protectedProcedure
    .input(
      z
        .object({
          branchId: z.number().int().positive().optional(),
          sectorId: z.number().int().positive().optional(),
          position: z.string().max(180).optional(),
          query: z.string().max(180).optional(),
          onlyWithoutGse: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      requireOperational(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) return [];
      const result: any = await db.execute(
        drzSql.raw(`SELECT u.id,u.name,u.email,u.cpf,u.employee_registration,u.position,u.branch_id,u.sector_id,b.name branch_name,s.name sector_name,h.gse_id,g.code gse_code,g.name gse_name
        FROM users u LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN sectors s ON s.id=u.sector_id
        LEFT JOIN occupational_gse_worker_history h ON h.collaborator_id=u.id AND h.company_id=u.company_id AND h.is_current=1
        LEFT JOIN occupational_gse_master g ON g.id=h.gse_id
        WHERE u.company_id=${companyId} AND ${activeEmployeeSql("u")} ORDER BY u.name LIMIT 3000`)
      );
      const query = String(input?.query || "")
        .trim()
        .toLowerCase();
      return rowsOf(result).filter((row: any) => {
        if (input?.branchId && Number(row.branch_id) !== input.branchId)
          return false;
        if (input?.sectorId && Number(row.sector_id) !== input.sectorId)
          return false;
        if (
          input?.position &&
          !String(row.position || "")
            .toLowerCase()
            .includes(input.position.toLowerCase())
        )
          return false;
        if (input?.onlyWithoutGse && row.gse_id) return false;
        if (
          query &&
          ![row.name, row.cpf, row.employee_registration, row.position].some(
            value =>
              String(value || "")
                .toLowerCase()
                .includes(query)
          )
        )
          return false;
        return true;
      });
    }),

  assignWorkers: protectedProcedure
    .input(
      z.object({
        gseId: z.number().int().positive(),
        collaboratorIds: z.array(z.number().int().positive()).min(1).max(3000),
        reason: z.string().min(2).max(255),
        origin: z
          .enum(["manual", "importacao", "api", "totvs", "validacao_sesmt"])
          .default("manual"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireSesmt(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const gse: any = await db.execute(
        drzSql`SELECT id FROM occupational_gse_master WHERE id=${input.gseId} AND company_id=${companyId} LIMIT 1`
      );
      if (!rowsOf(gse).length) throw new TRPCError({ code: "NOT_FOUND" });
      let assigned = 0;
      for (const collaboratorId of [...new Set(input.collaboratorIds)]) {
        const worker: any = await db.execute(
          drzSql`SELECT id,branch_id,sector_id,position FROM users WHERE id=${collaboratorId} AND company_id=${companyId} LIMIT 1`
        );
        const row = rowsOf(worker)[0];
        if (!row) continue;
        await db.execute(
          drzSql`UPDATE occupational_gse_worker_history SET is_current=0,valid_until=NOW() WHERE company_id=${companyId} AND collaborator_id=${collaboratorId} AND is_current=1`
        );
        const snapshot = JSON.stringify({
          branchId: row.branch_id || null,
          sectorId: row.sector_id || null,
          position: row.position || "",
        });
        await db.execute(drzSql`INSERT INTO occupational_gse_worker_history
          (company_id,collaborator_id,gse_id,valid_from,is_current,reason,origin,structure_snapshot_json,assigned_by)
          VALUES (${companyId},${collaboratorId},${input.gseId},NOW(),1,${input.reason},${input.origin},${snapshot},${Number(ctx.user.id)})`);
        await audit(
          db,
          ctx,
          "worker_assigned_to_gse",
          "gse_worker",
          input.gseId,
          collaboratorId,
          { reason: input.reason, origin: input.origin }
        );
        assigned++;
      }
      await db.execute(drzSql`UPDATE pgr_gse pg
        JOIN occupational_gse_pgr_links l ON l.pgr_gse_id=pg.id AND l.company_id=${companyId}
        SET pg.num_trabalhadores=(SELECT COUNT(*) FROM occupational_gse_worker_history h WHERE h.company_id=${companyId} AND h.gse_id=l.gse_id AND h.is_current=1)
        WHERE l.gse_id=${input.gseId}`);
      return { ok: true, assigned };
    }),

  migratePgrGses: protectedProcedure.mutation(async ({ ctx }) => {
    requireSesmt(ctx);
    await ensureOccupationalTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const result: any = await db.execute(
      drzSql`SELECT g.id,g.pgr_id,g.nome,g.descricao,g.master_gse_id,p.title FROM pgr_gse g JOIN pgr_documents p ON p.id=g.pgr_id WHERE p.company_id=${companyId} ORDER BY g.id`
    );
    let created = 0;
    let linked = 0;
    for (const row of rowsOf(result)) {
      let masterId = Number(row.master_gse_id || 0);
      if (!masterId) {
        const existing: any = await db.execute(
          drzSql`SELECT id FROM occupational_gse_master WHERE company_id=${companyId} AND LOWER(name)=LOWER(${row.nome}) LIMIT 1`
        );
        masterId = Number(rowsOf(existing)[0]?.id || 0);
      }
      if (!masterId) {
        const code = normalizeGseCode(`GSE-${row.id}`);
        const insert: any =
          await db.execute(drzSql`INSERT INTO occupational_gse_master
          (company_id,code,name,description,status,technical_notes,responsible_user_id,created_by)
          VALUES (${companyId},${code},${row.nome},${row.descricao || null},'em_revisao','Migrado do contexto de PGR sem exclusão do histórico original.',${Number(ctx.user.id)},${Number(ctx.user.id)})`);
        masterId = Number((insert as any)[0]?.insertId || 0);
        created++;
      }
      await db.execute(
        drzSql`UPDATE pgr_gse SET master_gse_id=${masterId} WHERE id=${Number(row.id)}`
      );
      await db.execute(drzSql`INSERT IGNORE INTO occupational_gse_pgr_links
        (company_id,gse_id,pgr_id,pgr_gse_id,linked_by)
        VALUES (${companyId},${masterId},${Number(row.pgr_id)},${Number(row.id)},${Number(ctx.user.id)})`);
      linked++;
    }
    await audit(db, ctx, "pgr_gses_migrated", "gse_master", null, null, {
      created,
      linked,
    });
    return { ok: true, created, linked };
  }),

  linkPgr: protectedProcedure
    .input(
      z.object({
        gseId: z.number().int().positive(),
        pgrId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireSesmt(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [gseResult, pgrResult] = await Promise.all([
        db.execute(
          drzSql`SELECT * FROM occupational_gse_master WHERE id=${input.gseId} AND company_id=${companyId} LIMIT 1`
        ),
        db.execute(
          drzSql`SELECT id FROM pgr_documents WHERE id=${input.pgrId} AND company_id=${companyId} LIMIT 1`
        ),
      ]);
      const gse = rowsOf(gseResult)[0];
      if (!gse || !rowsOf(pgrResult).length)
        throw new TRPCError({ code: "NOT_FOUND" });
      const existing: any = await db.execute(
        drzSql`SELECT pgr_gse_id FROM occupational_gse_pgr_links WHERE gse_id=${input.gseId} AND pgr_id=${input.pgrId} LIMIT 1`
      );
      const population: any = await db.execute(
        drzSql`SELECT COUNT(*) total FROM occupational_gse_worker_history WHERE company_id=${companyId} AND gse_id=${input.gseId} AND is_current=1`
      );
      const workerCount = Number(rowsOf(population)[0]?.total || 0);
      if (rowsOf(existing).length) {
        const pgrGseId = Number(rowsOf(existing)[0].pgr_gse_id);
        await db.execute(
          drzSql`UPDATE pgr_gse SET num_trabalhadores=${workerCount} WHERE id=${pgrGseId}`
        );
        return { ok: true, pgrGseId, existed: true };
      }
      const inserted: any = await db.execute(drzSql`INSERT INTO pgr_gse
        (pgr_id,nome,descricao,num_trabalhadores,ai_suggested,migrated_from_legacy,master_gse_id)
        VALUES (${input.pgrId},${gse.name},${gse.description || null},${workerCount},0,0,${input.gseId})`);
      const pgrGseId = Number((inserted as any)[0]?.insertId || 0);
      await db.execute(drzSql`INSERT INTO occupational_gse_pgr_links
        (company_id,gse_id,pgr_id,pgr_gse_id,linked_by)
        VALUES (${companyId},${input.gseId},${input.pgrId},${pgrGseId},${Number(ctx.user.id)})`);
      await audit(
        db,
        ctx,
        "gse_linked_to_pgr",
        "gse_pgr_link",
        pgrGseId,
        null,
        { gseId: input.gseId, pgrId: input.pgrId }
      );
      return { ok: true, pgrGseId, existed: false };
    }),

  listMovementAlerts: protectedProcedure.query(async ({ ctx }) => {
    requireOperational(ctx);
    await ensureOccupationalTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) return [];
    await detectMovements(db, companyId);
    const result: any = await db.execute(
      drzSql`SELECT a.*,u.name collaborator_name,u.position,g.code gse_code,g.name gse_name,b.name branch_name,s.name sector_name FROM occupational_gse_movement_alerts a JOIN users u ON u.id=a.collaborator_id JOIN occupational_gse_master g ON g.id=a.current_gse_id LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN sectors s ON s.id=u.sector_id WHERE a.company_id=${companyId} ORDER BY a.status='pendente' DESC,a.created_at DESC LIMIT 300`
    );
    return rowsOf(result);
  }),

  resolveMovementAlert: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        resolution: z.enum([
          "manter_gse",
          "alterar_gse",
          "analisar_posteriormente",
        ]),
        newGseId: z.number().int().positive().optional(),
        notes: z.string().max(5000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireSesmt(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result: any = await db.execute(
        drzSql`SELECT * FROM occupational_gse_movement_alerts WHERE id=${input.id} AND company_id=${companyId} LIMIT 1`
      );
      const alert = rowsOf(result)[0];
      if (!alert) throw new TRPCError({ code: "NOT_FOUND" });
      if (input.resolution === "alterar_gse" && !input.newGseId)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selecione o novo GSE.",
        });
      if (input.resolution === "alterar_gse" && input.newGseId) {
        await requireOwnedEntity(
          db,
          companyId,
          "gse",
          input.newGseId,
          "Novo GSE"
        );
        const worker: any = await db.execute(
          drzSql`SELECT branch_id,sector_id,position FROM users WHERE id=${Number(alert.collaborator_id)} AND company_id=${companyId} LIMIT 1`
        );
        const row = rowsOf(worker)[0] || {};
        await db.execute(
          drzSql`UPDATE occupational_gse_worker_history SET is_current=0,valid_until=NOW() WHERE company_id=${companyId} AND collaborator_id=${Number(alert.collaborator_id)} AND is_current=1`
        );
        await db.execute(drzSql`INSERT INTO occupational_gse_worker_history
          (company_id,collaborator_id,gse_id,valid_from,is_current,reason,origin,structure_snapshot_json,assigned_by)
          VALUES (${companyId},${Number(alert.collaborator_id)},${input.newGseId},NOW(),1,'Movimentação organizacional validada','validacao_sesmt',${JSON.stringify({ branchId: row.branch_id || null, sectorId: row.sector_id || null, position: row.position || "" })},${Number(ctx.user.id)})`);
      } else if (input.resolution === "manter_gse") {
        const current = alert.current_structure_json || "{}";
        await db.execute(
          drzSql`UPDATE occupational_gse_worker_history SET structure_snapshot_json=${current} WHERE company_id=${companyId} AND collaborator_id=${Number(alert.collaborator_id)} AND is_current=1`
        );
      }
      const status =
        input.resolution === "analisar_posteriormente" ? "adiado" : "resolvido";
      await db.execute(
        drzSql`UPDATE occupational_gse_movement_alerts SET status=${status},resolution=${input.resolution},notes=${input.notes || null},resolved_by=${Number(ctx.user.id)},resolved_at=NOW() WHERE id=${input.id} AND company_id=${companyId}`
      );
      await audit(
        db,
        ctx,
        "movement_alert_resolved",
        "gse_movement",
        input.id,
        Number(alert.collaborator_id),
        { resolution: input.resolution, newGseId: input.newGseId || null }
      );
      return { ok: true };
    }),

  listExamCatalog: protectedProcedure.query(async ({ ctx }) => {
    requireOperational(ctx);
    await ensureOccupationalTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) return [];
    const result: any = await db.execute(
      drzSql`SELECT * FROM pcmso_exam_catalog_v2 WHERE company_id=${companyId} ORDER BY is_active DESC,category,name`
    );
    return rowsOf(result);
  }),

  upsertExamCatalog: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        name: z.string().min(2).max(255),
        examType: z.enum(["clinico", "complementar"]),
        category: z.string().max(80).optional(),
        description: z.string().max(10000).optional(),
        defaultPeriodicity: z.string().max(120).optional(),
        resultType: z
          .enum(["qualitativo", "quantitativo", "misto"])
          .default("qualitativo"),
        defaultUnit: z.string().max(80).optional(),
        referenceGuidance: z.string().max(20000).optional(),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireExamCatalogManager(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let id = Number(input.id || 0);
      if (id) {
        await requireOwnedEntity(db, companyId, "exam", id, "Exame");
        await db.execute(
          drzSql`UPDATE pcmso_exam_catalog_v2 SET name=${input.name},exam_type=${input.examType},category=${input.category || null},description=${input.description || null},default_periodicity=${input.defaultPeriodicity || null},result_type=${input.resultType},default_unit=${input.defaultUnit || null},reference_guidance=${input.referenceGuidance || null},is_active=${input.isActive ? 1 : 0} WHERE id=${id} AND company_id=${companyId}`
        );
      } else {
        const result: any =
          await db.execute(drzSql`INSERT INTO pcmso_exam_catalog_v2
          (company_id,name,exam_type,category,description,default_periodicity,result_type,default_unit,reference_guidance,is_active,created_by)
          VALUES (${companyId},${input.name},${input.examType},${input.category || null},${input.description || null},${input.defaultPeriodicity || null},${input.resultType},${input.defaultUnit || null},${input.referenceGuidance || null},${input.isActive ? 1 : 0},${Number(ctx.user.id)})`);
        id = Number((result as any)[0]?.insertId || 0);
      }
      await audit(
        db,
        ctx,
        input.id ? "exam_catalog_updated" : "exam_catalog_created",
        "exam_catalog",
        id
      );
      return { ok: true, id };
    }),

  listProviders: protectedProcedure.query(async ({ ctx }) => {
    requireOperational(ctx);
    await ensureOccupationalTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) return [];
    const result: any = await db.execute(drzSql`SELECT p.*,
      (SELECT GROUP_CONCAT(pe.exam_id ORDER BY pe.exam_id) FROM occupational_provider_exams pe WHERE pe.company_id=p.company_id AND pe.provider_id=p.id AND pe.is_active=1) exam_ids,
      (SELECT GROUP_CONCAT(e.name ORDER BY e.name SEPARATOR '||') FROM occupational_provider_exams pe JOIN pcmso_exam_catalog_v2 e ON e.id=pe.exam_id AND e.company_id=pe.company_id WHERE pe.company_id=p.company_id AND pe.provider_id=p.id AND pe.is_active=1) exam_names,
      (SELECT COUNT(*) FROM occupational_exam_orders o WHERE o.company_id=p.company_id AND o.provider_id=p.id) history_count
      FROM occupational_health_providers p WHERE p.company_id=${companyId}
      ORDER BY p.is_active DESC,p.credential_status='ativo' DESC,p.trade_name,p.legal_name`);
    return rowsOf(result).map((row: any) => ({
      ...row,
      examIds: String(row.exam_ids || "")
        .split(",")
        .filter(Boolean)
        .map(Number),
      examNames: String(row.exam_names || "")
        .split("||")
        .filter(Boolean),
      canDelete: Number(row.history_count || 0) === 0,
    }));
  }),

  upsertProvider: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        legalName: z.string().min(2).max(255),
        tradeName: z.string().max(255).optional(),
        cnpj: z.string().max(30).optional(),
        address: z.string().max(5000).optional(),
        municipality: z.string().max(180).optional(),
        uf: z.string().max(2).optional(),
        phone: z.string().max(80).optional(),
        email: z.string().email().max(320).optional().or(z.literal("")),
        contactName: z.string().max(255).optional(),
        inCompanyService: z.boolean().default(false),
        examIds: z.array(z.number().int().positive()).max(200).default([]),
        services: z.array(z.string().max(255)).max(100).default([]),
        specialties: z.array(z.string().max(255)).max(100).default([]),
        credentialStatus: z
          .enum(["ativo", "em_revisao", "suspenso", "vencido"])
          .default("ativo"),
        credentialValidUntil: dateInput.nullable().optional(),
        notes: z.string().max(10000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireSesmt(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let id = Number(input.id || 0);
      for (const examId of [...new Set(input.examIds)])
        await requireOwnedEntity(db, companyId, "exam", examId, "Exame");
      if (id) {
        await requireOwnedEntity(db, companyId, "provider", id, "Prestador");
        await db.execute(
          drzSql`UPDATE occupational_health_providers SET legal_name=${input.legalName},trade_name=${input.tradeName || null},cnpj=${input.cnpj || null},address=${input.address || null},municipality=${input.municipality || null},uf=${input.uf?.toUpperCase() || null},phone=${input.phone || null},email=${input.email || null},contact_name=${input.contactName || null},in_company_service=${input.inCompanyService ? 1 : 0},exams_json=${JSON.stringify([])},services_json=${JSON.stringify(input.services)},specialties_json=${JSON.stringify(input.specialties)},credential_status=${input.credentialStatus},credential_valid_until=${input.credentialValidUntil || null},notes=${input.notes || null} WHERE id=${id} AND company_id=${companyId}`
        );
      } else {
        const result: any =
          await db.execute(drzSql`INSERT INTO occupational_health_providers
          (company_id,legal_name,trade_name,cnpj,address,municipality,uf,phone,email,contact_name,in_company_service,exams_json,services_json,specialties_json,credential_status,credential_valid_until,notes,created_by)
          VALUES (${companyId},${input.legalName},${input.tradeName || null},${input.cnpj || null},${input.address || null},${input.municipality || null},${input.uf?.toUpperCase() || null},${input.phone || null},${input.email || null},${input.contactName || null},${input.inCompanyService ? 1 : 0},${JSON.stringify([])},${JSON.stringify(input.services)},${JSON.stringify(input.specialties)},${input.credentialStatus},${input.credentialValidUntil || null},${input.notes || null},${Number(ctx.user.id)})`);
        id = Number((result as any)[0]?.insertId || 0);
      }
      await db.execute(
        drzSql`UPDATE occupational_provider_exams SET is_active=0 WHERE company_id=${companyId} AND provider_id=${id}`
      );
      for (const examId of [...new Set(input.examIds)])
        await db.execute(drzSql`INSERT INTO occupational_provider_exams (company_id,provider_id,exam_id,is_active,created_by)
          VALUES (${companyId},${id},${examId},1,${Number(ctx.user.id)})
          ON DUPLICATE KEY UPDATE is_active=1,updated_at=NOW()`);
      await audit(
        db,
        ctx,
        input.id ? "provider_updated" : "provider_created",
        "health_provider",
        id
      );
      return { ok: true, id };
    }),

  setProviderActive: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      requireSesmt(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await requireOwnedEntity(
        db,
        companyId,
        "provider",
        input.id,
        "Prestador"
      );
      await db.execute(
        drzSql`UPDATE occupational_health_providers SET is_active=${input.active ? 1 : 0},credential_status=${input.active ? "ativo" : "suspenso"} WHERE id=${input.id} AND company_id=${companyId}`
      );
      await audit(
        db,
        ctx,
        input.active ? "provider_reactivated" : "provider_deactivated",
        "health_provider",
        input.id
      );
      return { ok: true };
    }),

  removeProvider: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireSesmt(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await requireOwnedEntity(
        db,
        companyId,
        "provider",
        input.id,
        "Prestador"
      );
      const history: any = await db.execute(
        drzSql`SELECT COUNT(*) total FROM occupational_exam_orders WHERE company_id=${companyId} AND provider_id=${input.id}`
      );
      if (Number(rowsOf(history)[0]?.total || 0)) {
        await db.execute(
          drzSql`UPDATE occupational_health_providers SET is_active=0,credential_status='suspenso' WHERE id=${input.id} AND company_id=${companyId}`
        );
        await audit(
          db,
          ctx,
          "provider_soft_deleted",
          "health_provider",
          input.id,
          null,
          { reason: "historico_preservado" }
        );
        return { ok: true, mode: "soft_delete" as const };
      }
      await db.execute(
        drzSql`DELETE FROM occupational_provider_exams WHERE company_id=${companyId} AND provider_id=${input.id}`
      );
      await db.execute(
        drzSql`DELETE FROM occupational_health_providers WHERE company_id=${companyId} AND id=${input.id}`
      );
      await audit(db, ctx, "provider_deleted", "health_provider", input.id);
      return { ok: true, mode: "deleted" as const };
    }),

  listExamOrders: protectedProcedure.query(async ({ ctx }) => {
    requireOperational(ctx);
    await ensureOccupationalTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) return [];
    await db.execute(
      drzSql`UPDATE occupational_exam_orders SET status='vencida' WHERE company_id=${companyId} AND valid_until<CURDATE() AND status IN ('pendente','enviada')`
    );
    const result: any =
      await db.execute(drzSql`SELECT o.*,u.name collaborator_name,u.cpf,u.employee_registration,u.position,b.name branch_name,s.name sector_name,g.code gse_code,g.name gse_name,e.name exam_name,p.trade_name provider_trade_name,p.legal_name provider_legal_name
      FROM occupational_exam_orders o JOIN users u ON u.id=o.collaborator_id LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN sectors s ON s.id=u.sector_id LEFT JOIN occupational_gse_master g ON g.id=o.gse_id JOIN pcmso_exam_catalog_v2 e ON e.id=o.exam_id LEFT JOIN occupational_health_providers p ON p.id=o.provider_id WHERE o.company_id=${companyId} ORDER BY o.created_at DESC LIMIT 1500`);
    return rowsOf(result).map((row: any) => ({
      ...row,
      version_label: orderLabel(Number(row.version_number || 1)),
    }));
  }),

  listExamPopulation: protectedProcedure.query(async ({ ctx }) => {
    requireOperational(ctx);
    await ensureOccupationalTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) return [];
    const clinicalExamId = await ensureClinicalConsultationExam(
      db,
      companyId,
      Number(ctx.user.id)
    );
    const result: any = await db.execute(
      drzSql.raw(`SELECT u.id collaborator_id,u.name collaborator_name,u.cpf,u.employee_registration,u.position,
      u.branch_id,u.sector_id,
      b.name branch_name,s.name sector_name,h.gse_id,g.code gse_code,g.name gse_name,
      m.id monitoring_id,m.pcmso_id,CASE WHEN m.monitoring_kind='avaliacao_clinica' THEN ${clinicalExamId} ELSE m.exam_id END exam_id,
      m.monitoring_kind,m.periodicity,m.applicability,e.name exam_name,p.title pcmso_title,p.pgr_id,pg.title pgr_title,
      (SELECT GROUP_CONCAT(DISTINCT COALESCE(hp.trade_name,hp.legal_name) ORDER BY COALESCE(hp.trade_name,hp.legal_name) SEPARATOR '||') FROM occupational_provider_exams pe JOIN occupational_health_providers hp ON hp.id=pe.provider_id AND hp.company_id=pe.company_id AND hp.is_active=1 WHERE pe.company_id=u.company_id AND pe.exam_id=(CASE WHEN m.monitoring_kind='avaliacao_clinica' THEN ${clinicalExamId} ELSE m.exam_id END) AND pe.is_active=1) recommended_providers,
      (SELECT o.status FROM occupational_exam_orders o WHERE o.company_id=u.company_id AND o.collaborator_id=u.id AND o.exam_id=(CASE WHEN m.monitoring_kind='avaliacao_clinica' THEN ${clinicalExamId} ELSE m.exam_id END) AND o.pcmso_id=m.pcmso_id ORDER BY o.version_number DESC,o.created_at DESC LIMIT 1) latest_order_status,
      (SELECT o.id FROM occupational_exam_orders o WHERE o.company_id=u.company_id AND o.collaborator_id=u.id AND o.exam_id=(CASE WHEN m.monitoring_kind='avaliacao_clinica' THEN ${clinicalExamId} ELSE m.exam_id END) AND o.pcmso_id=m.pcmso_id ORDER BY o.version_number DESC,o.created_at DESC LIMIT 1) latest_order_id,
      (SELECT MAX(r.performed_at) FROM occupational_exam_results r WHERE r.company_id=u.company_id AND r.collaborator_id=u.id AND r.exam_id=(CASE WHEN m.monitoring_kind='avaliacao_clinica' THEN ${clinicalExamId} ELSE m.exam_id END)) latest_result_at
      FROM users u
      JOIN occupational_gse_worker_history h ON h.collaborator_id=u.id AND h.company_id=u.company_id AND h.is_current=1
      JOIN occupational_gse_master g ON g.id=h.gse_id AND g.company_id=u.company_id
      JOIN pcmso_risk_monitoring_v2 m ON m.company_id=u.company_id AND m.monitoring_kind IN ('avaliacao_clinica','exame_complementar') AND (m.monitoring_kind='avaliacao_clinica' OR m.exam_id IS NOT NULL) AND m.suggestion_status IN ('aprovada','editada')
      LEFT JOIN occupational_gse_pgr_links l ON l.company_id=m.company_id AND l.pgr_gse_id=m.pgr_gse_id
      JOIN pcmso_programs_v2 p ON p.id=m.pcmso_id AND p.company_id=u.company_id AND p.status IN ('em_revisao','vigente') AND (p.saved_at IS NOT NULL OR p.status='vigente') AND (p.valid_from IS NULL OR p.valid_from<=CURDATE()) AND (p.valid_until IS NULL OR p.valid_until>=CURDATE())
      LEFT JOIN pgr_documents pg ON pg.id=p.pgr_id AND pg.company_id=u.company_id
      JOIN pcmso_exam_catalog_v2 e ON e.id=(CASE WHEN m.monitoring_kind='avaliacao_clinica' THEN ${clinicalExamId} ELSE m.exam_id END) AND e.company_id=u.company_id AND e.is_active=1
      LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN sectors s ON s.id=u.sector_id
      WHERE u.company_id=${companyId} AND ${activeEmployeeSql("u")} AND COALESCE(m.master_gse_id,l.gse_id)=h.gse_id
      ORDER BY e.name,u.name`)
    );
    const unique = new Map<string, any>();
    for (const row of rowsOf(result)) {
      const key = `${row.collaborator_id}:${row.pcmso_id}:${row.exam_id}`;
      if (!unique.has(key)) unique.set(key, row);
    }
    return [...unique.values()].map((row: any) => ({
      ...row,
      procedure_kind:
        row.monitoring_kind === "avaliacao_clinica"
          ? "consulta_clinica"
          : "exame_complementar",
      recommendedProviders: String(row.recommended_providers || "")
        .split("||")
        .filter(Boolean),
      operational_status: row.latest_result_at
        ? "resultado_recebido"
        : row.latest_order_status || "requisicao_pendente",
    }));
  }),

  previewExamOrdersFromPcmso: protectedProcedure
    .input(
      z.object({
        exerciseYear: z.number().int().min(2000).max(2100),
        items: z
          .array(
            z.object({
              collaboratorId: z.number().int().positive(),
              monitoringId: z.number().int().positive(),
              requestType: z.enum(["normal", "repeticao"]).default("normal"),
              justification: z.string().max(5000).optional(),
            })
          )
          .min(1)
          .max(3000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireOperational(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const clinicalExamId = await ensureClinicalConsultationExam(
        db,
        companyId,
        Number(ctx.user.id)
      );
      const rows: any[] = [];
      const seen = new Set<string>();
      for (const item of input.items) {
        const key = `${item.collaboratorId}:${item.monitoringId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const source = await loadPcmsoOrderSource(
          db,
          companyId,
          item.collaboratorId,
          item.monitoringId,
          clinicalExamId
        );
        if (!source) {
          const decision = classifyExamPlanning({
            sourceAvailable: false,
            resultCount: 0,
            requestCount: 0,
          });
          rows.push({
            collaboratorId: item.collaboratorId,
            monitoringId: item.monitoringId,
            ...decision,
          });
          continue;
        }
        const evidence = await loadExamEvidence(
          db,
          companyId,
          source,
          input.exerciseYear
        );
        const decision = classifyExamPlanning({
          sourceAvailable: true,
          resultCount: evidence.resultCount,
          requestCount: evidence.requestCount,
          requestKind: item.requestType,
          justification: item.justification,
        });
        rows.push({
          ...source,
          collaboratorId: Number(source.collaborator_id),
          monitoringId: Number(source.monitoring_id),
          examId: Number(source.exam_id),
          exerciseYear: input.exerciseYear,
          ...evidence,
          ...decision,
          justification: item.justification || "",
        });
      }
      const summary = rows.reduce(
        (acc, row) => {
          acc.analyzed++;
          if (row.shouldGenerate) acc.toGenerate++;
          else acc.notGenerated++;
          acc.byStatus[row.status] = (acc.byStatus[row.status] || 0) + 1;
          return acc;
        },
        {
          analyzed: 0,
          toGenerate: 0,
          notGenerated: 0,
          byStatus: {} as Record<string, number>,
        }
      );
      return { exerciseYear: input.exerciseYear, rows, summary };
    }),

  createExamOrdersFromPcmso: protectedProcedure
    .input(
      z.object({
        items: z
          .array(
            z.object({
              collaboratorId: z.number().int().positive(),
              monitoringId: z.number().int().positive(),
              requestType: z.enum(["normal", "repeticao"]).default("normal"),
              justification: z.string().max(5000).optional(),
            })
          )
          .min(1)
          .max(3000),
        exerciseYear: z.number().int().min(2000).max(2100),
        providerId: z.number().int().positive().nullable().optional(),
        serviceMode: z
          .enum(["prestador", "in_loco", "outro"])
          .default("prestador"),
        serviceLocation: z.string().max(5000).optional(),
        validUntil: dateInput,
        orientations: z.string().max(10000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireOperational(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const clinicalExamId = await ensureClinicalConsultationExam(
        db,
        companyId,
        Number(ctx.user.id)
      );
      await requireOwnedEntity(
        db,
        companyId,
        "provider",
        input.providerId,
        "Prestador"
      );
      let created = 0;
      let skipped = 0;
      const skippedByReason: Record<string, number> = {};
      const ids: number[] = [];
      for (const item of input.items) {
        const source = await loadPcmsoOrderSource(
          db,
          companyId,
          item.collaboratorId,
          item.monitoringId,
          clinicalExamId
        );
        if (!source) {
          skipped++;
          skippedByReason.fora_do_pcmso =
            (skippedByReason.fora_do_pcmso || 0) + 1;
          continue;
        }
        await requireProviderSupportsExam(
          db,
          companyId,
          input.providerId,
          Number(source.exam_id)
        );
        const evidence = await loadExamEvidence(
          db,
          companyId,
          source,
          input.exerciseYear
        );
        const decision = classifyExamPlanning({
          sourceAvailable: true,
          resultCount: evidence.resultCount,
          requestCount: evidence.requestCount,
          requestKind: item.requestType,
          justification: item.justification,
        });
        if (!decision.shouldGenerate) {
          skipped++;
          skippedByReason[decision.status] =
            (skippedByReason[decision.status] || 0) + 1;
          continue;
        }
        const number = `REQ-${input.exerciseYear}-${String(Date.now()).slice(-8)}-${String(item.collaboratorId).padStart(5, "0")}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
        const inserted: any =
          await db.execute(drzSql`INSERT INTO occupational_exam_orders
          (company_id,order_number,version_number,collaborator_id,gse_id,pcmso_id,monitoring_id,exam_id,procedure_kind,exercise_year,request_type,repeat_justification,provider_id,service_mode,service_location,issue_date,valid_until,status,orientations,created_by)
          VALUES (${companyId},${number},1,${item.collaboratorId},${Number(source.gse_id)},${Number(source.pcmso_id)},${Number(source.monitoring_id)},${Number(source.exam_id)},${source.monitoring_kind === "avaliacao_clinica" ? "consulta_clinica" : "exame_complementar"},${input.exerciseYear},${decision.requestKind},${decision.requestKind === "repeticao" ? item.justification || null : null},${input.providerId || null},${input.serviceMode},${input.serviceLocation || null},CURDATE(),${input.validUntil},'pendente',${input.orientations || null},${Number(ctx.user.id)})`);
        const id = Number((inserted as any)[0]?.insertId || 0);
        ids.push(id);
        created++;
        await audit(
          db,
          ctx,
          "pcmso_exam_order_created",
          "exam_order",
          id,
          item.collaboratorId,
          {
            monitoringId: item.monitoringId,
            examId: Number(source.exam_id),
            pcmsoId: Number(source.pcmso_id),
            exerciseYear: input.exerciseYear,
            requestType: decision.requestKind,
            justification:
              decision.requestKind === "repeticao"
                ? item.justification || null
                : null,
            procedureKind:
              source.monitoring_kind === "avaliacao_clinica"
                ? "consulta_clinica"
                : "exame_complementar",
          }
        );
      }
      return { ok: true, created, skipped, skippedByReason, ids };
    }),

  createExamOrders: protectedProcedure
    .input(
      z.object({
        collaboratorIds: z.array(z.number().int().positive()).min(1).max(3000),
        examId: z.number().int().positive(),
        exerciseYear: z.number().int().min(2000).max(2100),
        requestType: z.enum(["normal", "repeticao"]).default("normal"),
        justification: z.string().max(5000).optional(),
        pcmsoId: z.number().int().positive().nullable().optional(),
        providerId: z.number().int().positive().nullable().optional(),
        serviceMode: z
          .enum(["prestador", "in_loco", "outro"])
          .default("prestador"),
        serviceLocation: z.string().max(5000).optional(),
        validUntil: dateInput,
        orientations: z.string().max(10000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireOperational(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await requireOwnedEntity(db, companyId, "exam", input.examId, "Exame");
      await requireOwnedEntity(
        db,
        companyId,
        "provider",
        input.providerId,
        "Prestador"
      );
      await requireProviderSupportsExam(
        db,
        companyId,
        input.providerId,
        input.examId
      );
      await requireOwnedEntity(db, companyId, "pcmso", input.pcmsoId, "PCMSO");
      let created = 0;
      let skipped = 0;
      const skippedByReason: Record<string, number> = {};
      const ids: number[] = [];
      for (const collaboratorId of [...new Set(input.collaboratorIds)]) {
        const worker: any = await db.execute(
          drzSql`SELECT u.id,h.gse_id FROM users u LEFT JOIN occupational_gse_worker_history h ON h.collaborator_id=u.id AND h.company_id=u.company_id AND h.is_current=1 WHERE u.id=${collaboratorId} AND u.company_id=${companyId} LIMIT 1`
        );
        const row = rowsOf(worker)[0];
        if (!row) continue;
        const resultEvidence: any = await db.execute(
          drzSql`SELECT COUNT(*) total FROM occupational_exam_results WHERE company_id=${companyId} AND collaborator_id=${collaboratorId} AND exam_id=${input.examId} AND YEAR(performed_at)=${input.exerciseYear}`
        );
        const requestEvidence: any = await db.execute(
          drzSql`SELECT COUNT(*) total FROM occupational_exam_orders WHERE company_id=${companyId} AND collaborator_id=${collaboratorId} AND exam_id=${input.examId} AND (exercise_year=${input.exerciseYear} OR (exercise_year IS NULL AND YEAR(issue_date)=${input.exerciseYear})) AND status<>'cancelada'`
        );
        const decision = classifyExamPlanning({
          sourceAvailable: true,
          resultCount: Number(rowsOf(resultEvidence)[0]?.total || 0),
          requestCount: Number(rowsOf(requestEvidence)[0]?.total || 0),
          requestKind: input.requestType,
          justification: input.justification,
        });
        if (!decision.shouldGenerate) {
          skipped++;
          skippedByReason[decision.status] =
            (skippedByReason[decision.status] || 0) + 1;
          continue;
        }
        const number = `REQ-${input.exerciseYear}-${String(Date.now()).slice(-8)}-${String(collaboratorId).padStart(5, "0")}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
        const result: any =
          await db.execute(drzSql`INSERT INTO occupational_exam_orders
          (company_id,order_number,version_number,collaborator_id,gse_id,pcmso_id,exam_id,exercise_year,request_type,repeat_justification,provider_id,service_mode,service_location,issue_date,valid_until,status,orientations,created_by)
          VALUES (${companyId},${number},1,${collaboratorId},${row.gse_id || null},${input.pcmsoId || null},${input.examId},${input.exerciseYear},${decision.requestKind},${decision.requestKind === "repeticao" ? input.justification || null : null},${input.providerId || null},${input.serviceMode},${input.serviceLocation || null},CURDATE(),${input.validUntil},'pendente',${input.orientations || null},${Number(ctx.user.id)})`);
        const id = Number((result as any)[0]?.insertId || 0);
        ids.push(id);
        await audit(
          db,
          ctx,
          "exam_order_created",
          "exam_order",
          id,
          collaboratorId,
          {
            examId: input.examId,
            providerId: input.providerId || null,
            exerciseYear: input.exerciseYear,
            requestType: decision.requestKind,
            justification:
              decision.requestKind === "repeticao"
                ? input.justification || null
                : null,
          }
        );
        created++;
      }
      return { ok: true, created, skipped, skippedByReason, ids };
    }),

  reissueExamOrder: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        validUntil: dateInput,
        providerId: z.number().int().positive().nullable().optional(),
        serviceMode: z.enum(["prestador", "in_loco", "outro"]),
        serviceLocation: z.string().max(5000).optional(),
        reason: z.enum([
          "nao_realizou",
          "perda",
          "vencida",
          "alteracao_prestador",
          "alteracao_local",
          "alteracao_programacao",
          "solicitacao_sesmt",
          "outro",
        ]),
        justification: z.string().max(10000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireSesmt(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await requireOwnedEntity(
        db,
        companyId,
        "provider",
        input.providerId,
        "Prestador"
      );
      const originalResult: any = await db.execute(
        drzSql`SELECT * FROM occupational_exam_orders WHERE id=${input.id} AND company_id=${companyId} LIMIT 1`
      );
      const original = rowsOf(originalResult)[0];
      if (!original) throw new TRPCError({ code: "NOT_FOUND" });
      await requireProviderSupportsExam(
        db,
        companyId,
        input.providerId,
        Number(original.exam_id)
      );
      const rootId = Number(original.parent_order_id || original.id);
      const versionsResult: any = await db.execute(
        drzSql`SELECT version_number FROM occupational_exam_orders WHERE company_id=${companyId} AND (id=${rootId} OR parent_order_id=${rootId})`
      );
      const version = nextReissueVersion(
        rowsOf(versionsResult).map((row: any) => Number(row.version_number))
      );
      const number = `REQ-${new Date().getFullYear()}-${String(Date.now()).slice(-10)}-${version}`;
      const inserted: any =
        await db.execute(drzSql`INSERT INTO occupational_exam_orders
        (company_id,order_number,parent_order_id,version_number,collaborator_id,gse_id,pcmso_id,monitoring_id,exam_id,procedure_kind,exercise_year,request_type,repeat_justification,provider_id,service_mode,service_location,issue_date,valid_until,status,reissue_reason,reissue_justification,orientations,created_by)
        VALUES (${companyId},${number},${rootId},${version},${Number(original.collaborator_id)},${original.gse_id || null},${original.pcmso_id || null},${original.monitoring_id || null},${Number(original.exam_id)},${original.procedure_kind || "exame_complementar"},${original.exercise_year || new Date(original.issue_date).getFullYear()},${original.request_type || "normal"},${original.repeat_justification || null},${input.providerId || null},${input.serviceMode},${input.serviceLocation || null},CURDATE(),${input.validUntil},'pendente',${input.reason},${input.justification || null},${original.orientations || null},${Number(ctx.user.id)})`);
      const id = Number((inserted as any)[0]?.insertId || 0);
      await db.execute(
        drzSql`UPDATE occupational_exam_orders SET status='substituida' WHERE id=${input.id} AND company_id=${companyId}`
      );
      await audit(
        db,
        ctx,
        "exam_order_reissued",
        "exam_order",
        id,
        Number(original.collaborator_id),
        { originalId: input.id, version, reason: input.reason }
      );
      return { ok: true, id, version, label: orderLabel(version) };
    }),

  generateExamOrderPdf: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireOperational(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result: any =
        await db.execute(drzSql`SELECT o.*,u.name collaborator_name,u.cpf,u.employee_registration,u.position,b.name branch_name,s.name sector_name,c.name company_name,c.cnpj,g.code gse_code,g.name gse_name,e.name exam_name,p.trade_name provider_trade_name,p.legal_name provider_legal_name,p.address provider_address,pc.doctor_name,pc.doctor_crm,pc.doctor_signature_private_path
        FROM occupational_exam_orders o JOIN users u ON u.id=o.collaborator_id JOIN companies c ON c.id=o.company_id LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN sectors s ON s.id=u.sector_id LEFT JOIN occupational_gse_master g ON g.id=o.gse_id JOIN pcmso_exam_catalog_v2 e ON e.id=o.exam_id LEFT JOIN occupational_health_providers p ON p.id=o.provider_id LEFT JOIN pcmso_programs_v2 pc ON pc.id=o.pcmso_id WHERE o.id=${input.id} AND o.company_id=${companyId} LIMIT 1`);
      const row = rowsOf(result)[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      const version = Number(row.version_number || 1);
      const signatureImage = privateImageDataUri(
        row.doctor_signature_private_path
      );
      const requestDetails =
        row.request_type === "repeticao"
          ? `<p><b>Tipo da solicitação:</b> REPETIÇÃO DE EXAME<br><b>Justificativa:</b> ${esc(row.repeat_justification || "Não informada")}</p>`
          : `<p><b>Tipo da solicitação:</b> Requisição normal</p>`;
      const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>@page{size:A4;margin:18mm}body{font-family:Arial;color:#173047;font-size:10pt;line-height:1.45}header{border-bottom:4px solid #0895a5;padding-bottom:8mm;margin-bottom:10mm}h1{font-size:20pt;margin:0;color:#0e2c46}h2{font-size:12pt;color:#0e2c46;margin-top:8mm}.grid{display:grid;grid-template-columns:1fr 1fr;gap:3mm 8mm}.box{border:1px solid #d8e2e8;padding:4mm;margin-top:5mm}.tag{display:inline-block;background:#e6f7f8;color:#087583;padding:2mm 3mm;font-weight:bold}.sign{margin-top:18mm;text-align:center}.sign img{display:block;max-width:65mm;max-height:24mm;object-fit:contain;margin:0 auto 1mm}.line{border-top:1px solid #173047;width:85mm;margin:auto}</style></head><body><header><h1>REQUISIÇÃO DE EXAME OCUPACIONAL${version > 1 ? ` - ${esc(orderLabel(version).toUpperCase())}` : ""}</h1><p><b>${esc(row.company_name)}</b><br>CNPJ: ${esc(row.cnpj || "-")}</p></header><span class="tag">${esc(row.order_number)} · Exercício ${esc(row.exercise_year || new Date(row.issue_date).getFullYear())} · válida até ${esc(row.valid_until)}</span><h2>Trabalhador</h2><div class="grid"><div><b>Nome:</b> ${esc(row.collaborator_name)}</div><div><b>CPF:</b> ${esc(row.cpf || "-")}</div><div><b>Matrícula:</b> ${esc(row.employee_registration || "-")}</div><div><b>Cargo:</b> ${esc(row.position || "-")}</div><div><b>Filial:</b> ${esc(row.branch_name || "-")}</div><div><b>Setor:</b> ${esc(row.sector_name || "-")}</div><div><b>GSE:</b> ${esc([row.gse_code, row.gse_name].filter(Boolean).join(" - ") || "-")}</div></div><div class="box"><h2>Exame solicitado</h2><p style="font-size:16pt"><b>${esc(row.exam_name)}</b></p>${requestDetails}<p><b>Prestador:</b> ${esc(row.provider_trade_name || row.provider_legal_name || "A definir")}<br><b>Local:</b> ${esc(row.service_location || row.provider_address || "A definir")}<br><b>Orientações:</b> ${esc(row.orientations || "Seguir as orientações do prestador.")}</p></div>${version > 1 ? `<p><b>Documento versionado:</b> esta é a ${esc(orderLabel(version))} da requisição ${esc(row.parent_order_id)}. A versão anterior permanece no histórico.</p>` : ""}<div class="sign">${signatureImage ? `<img src="${signatureImage}" alt="Assinatura do médico responsável">` : ""}<div class="line"></div><b>${esc(row.doctor_name || "Responsável pelo PCMSO")}</b><br>${esc(row.doctor_crm || "CRM não informado")}</div></body></html>`;
      const fileName = `requisicao_${String(row.order_number).replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
      const target = await renderPdf(companyId, "exam-orders", fileName, html);
      await db.execute(
        drzSql`UPDATE occupational_exam_orders SET pdf_private_path=${target} WHERE id=${input.id} AND company_id=${companyId}`
      );
      await audit(
        db,
        ctx,
        "exam_order_pdf_generated",
        "exam_order",
        input.id,
        Number(row.collaborator_id)
      );
      return {
        fileName,
        dataBase64: `data:application/pdf;base64,${fs.readFileSync(target).toString("base64")}`,
      };
    }),

  generateGroupedExamOrderPdf: protectedProcedure
    .input(
      z.object({ ids: z.array(z.number().int().positive()).min(1).max(500) })
    )
    .mutation(async ({ ctx, input }) => {
      requireOperational(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const ids = [...new Set(input.ids)].join(",");
      const result: any = await db.execute(
        drzSql.raw(`SELECT o.*,u.name collaborator_name,u.cpf,u.employee_registration,u.position,b.name branch_name,s.name sector_name,c.name company_name,c.cnpj,g.code gse_code,g.name gse_name,e.name exam_name,p.trade_name provider_trade_name,p.legal_name provider_legal_name,p.address provider_address,pc.doctor_name,pc.doctor_crm,pc.doctor_signature_private_path
        FROM occupational_exam_orders o JOIN users u ON u.id=o.collaborator_id JOIN companies c ON c.id=o.company_id LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN sectors s ON s.id=u.sector_id LEFT JOIN occupational_gse_master g ON g.id=o.gse_id JOIN pcmso_exam_catalog_v2 e ON e.id=o.exam_id LEFT JOIN occupational_health_providers p ON p.id=o.provider_id LEFT JOIN pcmso_programs_v2 pc ON pc.id=o.pcmso_id
        WHERE o.company_id=${companyId} AND o.id IN (${ids}) ORDER BY e.name,u.name`)
      );
      const rows = rowsOf(result);
      if (!rows.length) throw new TRPCError({ code: "NOT_FOUND" });
      const pages = rows
        .map((row: any) => {
          const signatureImage = privateImageDataUri(
            row.doctor_signature_private_path
          );
          const requestDetails =
            row.request_type === "repeticao"
              ? `<br><b>Tipo:</b> REPETIÇÃO DE EXAME<br><b>Justificativa:</b> ${esc(row.repeat_justification || "Não informada")}`
              : `<br><b>Tipo:</b> Requisição normal`;
          return `<section class="page"><header><h1>REQUISIÇÃO DE EXAME OCUPACIONAL</h1><p><b>${esc(row.company_name)}</b> · CNPJ ${esc(row.cnpj || "-")}</p></header><p class="tag">${esc(row.order_number)} · ${esc(orderLabel(Number(row.version_number || 1)))} · Exercício ${esc(row.exercise_year || new Date(row.issue_date).getFullYear())} · válida até ${esc(row.valid_until)}</p><h2>${esc(row.exam_name)}</h2><div class="grid"><div><b>Trabalhador:</b> ${esc(row.collaborator_name)}</div><div><b>CPF:</b> ${esc(row.cpf || "-")}</div><div><b>Matrícula:</b> ${esc(row.employee_registration || "-")}</div><div><b>Cargo:</b> ${esc(row.position || "-")}</div><div><b>Filial:</b> ${esc(row.branch_name || "-")}</div><div><b>Setor:</b> ${esc(row.sector_name || "-")}</div><div><b>GSE:</b> ${esc([row.gse_code, row.gse_name].filter(Boolean).join(" - ") || "-")}</div></div><div class="box"><b>Prestador:</b> ${esc(row.provider_trade_name || row.provider_legal_name || "A definir")}<br><b>Local:</b> ${esc(row.service_location || row.provider_address || "A definir")}<br><b>Orientações:</b> ${esc(row.orientations || "Seguir as orientações do prestador.")}${requestDetails}</div><div class="sign">${signatureImage ? `<img src="${signatureImage}" alt="Assinatura do médico responsável">` : ""}<div></div><b>${esc(row.doctor_name || "Responsável pelo PCMSO")}</b><br>${esc(row.doctor_crm || "CRM não informado")}</div></section>`;
        })
        .join("");
      const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>@page{size:A4;margin:15mm}body{font-family:Arial;color:#173047;font-size:10pt}.page{break-after:page;min-height:255mm}.page:last-child{break-after:auto}header{border-bottom:4px solid #0895a5;padding-bottom:5mm}h1{font-size:18pt;margin:0}h2{font-size:16pt;margin-top:10mm}.tag{background:#e6f7f8;padding:3mm;font-weight:bold}.grid{display:grid;grid-template-columns:1fr 1fr;gap:4mm 8mm}.box{border:1px solid #d8e2e8;padding:5mm;margin-top:8mm}.sign{margin-top:20mm;text-align:center}.sign img{display:block;max-width:65mm;max-height:24mm;object-fit:contain;margin:0 auto 1mm}.sign div{border-top:1px solid #173047;width:85mm;margin:auto}</style></head><body>${pages}</body></html>`;
      const examSlug = String(rows[0].exam_name || "exames")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .toLowerCase();
      const fileName = `requisicoes_${examSlug}_${Date.now()}.pdf`;
      const target = await renderPdf(
        companyId,
        "exam-orders-grouped",
        fileName,
        html
      );
      await audit(
        db,
        ctx,
        "exam_orders_grouped_pdf_generated",
        "exam_order_batch",
        null,
        null,
        { ids: input.ids, fileName }
      );
      return {
        fileName,
        total: rows.length,
        dataBase64: `data:application/pdf;base64,${fs.readFileSync(target).toString("base64")}`,
      };
    }),

  sendExamOrderEmail: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireSesmt(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result: any = await db.execute(
        drzSql`SELECT o.id,o.order_number,o.valid_until,o.service_location,o.pdf_private_path,u.id collaborator_id,u.name,u.email,e.name exam_name,p.trade_name,p.legal_name FROM occupational_exam_orders o JOIN users u ON u.id=o.collaborator_id JOIN pcmso_exam_catalog_v2 e ON e.id=o.exam_id LEFT JOIN occupational_health_providers p ON p.id=o.provider_id WHERE o.id=${input.id} AND o.company_id=${companyId} LIMIT 1`
      );
      const row = rowsOf(result)[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      if (!row.email)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Colaborador sem e-mail cadastrado.",
        });
      const sent = await sendEmail({
        to: row.email,
        toName: row.name,
        subject: `Requisição de exame ocupacional - ${row.exam_name}`,
        html: `<p>Olá, ${esc(row.name)}.</p><p>Sua requisição para o exame <b>${esc(row.exam_name)}</b> está disponível na plataforma.</p><p><b>Validade:</b> ${esc(row.valid_until)}<br><b>Local:</b> ${esc(row.service_location || row.trade_name || row.legal_name || "consulte o SESMT")}</p><p>Acesse a plataforma para consultar o documento de forma segura.</p>`,
      });
      const status = sent.ok
        ? sent.preview
          ? "preview"
          : "enviado"
        : "falhou";
      await db.execute(drzSql`INSERT INTO occupational_exam_order_communications
        (company_id,order_id,channel,recipient,status,provider_message,sent_by)
        VALUES (${companyId},${input.id},'email',${row.email},${status},${sent.error || null},${Number(ctx.user.id)})`);
      if (sent.ok)
        await db.execute(
          drzSql`UPDATE occupational_exam_orders SET status='enviada' WHERE id=${input.id} AND company_id=${companyId} AND status='pendente'`
        );
      await audit(
        db,
        ctx,
        "exam_order_email",
        "exam_order",
        input.id,
        Number(row.collaborator_id),
        { status }
      );
      return { ok: sent.ok, preview: sent.preview, status, error: sent.error };
    }),

  listExamResults: protectedProcedure.query(async ({ ctx }) => {
    requireOperational(ctx);
    await ensureOccupationalTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) return [];
    const result: any = await db.execute(
      drzSql`SELECT r.*,u.name collaborator_name,u.cpf,e.name exam_name,o.order_number FROM occupational_exam_results r JOIN users u ON u.id=r.collaborator_id JOIN pcmso_exam_catalog_v2 e ON e.id=r.exam_id LEFT JOIN occupational_exam_orders o ON o.id=r.order_id WHERE r.company_id=${companyId} ORDER BY r.performed_at DESC LIMIT 1500`
    );
    const isDoctor = roleOf(ctx) === "medico";
    return rowsOf(result).map((row: any) =>
      isDoctor
        ? row
        : {
            ...row,
            parameters_json: null,
            reference_text: null,
            medical_notes: null,
            document_private_path: null,
            classification: row.reviewed_at ? "revisado" : "pendente_revisao",
            result_summary: row.reviewed_at
              ? "Resultado revisado pelo médico"
              : "Documento recebido - aguardando revisão médica",
          }
    );
  }),

  getExamResultDocument: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireDoctor(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result: any = await db.execute(
        drzSql`SELECT document_private_path FROM occupational_exam_results WHERE id=${input.id} AND company_id=${companyId} LIMIT 1`
      );
      const documentPath = String(
        rowsOf(result)[0]?.document_private_path || ""
      );
      const root = path.resolve(privateRoot(companyId));
      const resolved = path.resolve(documentPath);
      if (
        !documentPath ||
        !resolved.startsWith(`${root}${path.sep}`) ||
        !fs.existsSync(resolved)
      )
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Documento original não encontrado.",
        });
      const extension = path.extname(resolved).toLowerCase();
      const mime =
        extension === ".pdf"
          ? "application/pdf"
          : extension === ".png"
            ? "image/png"
            : extension === ".jpg" || extension === ".jpeg"
              ? "image/jpeg"
              : "application/octet-stream";
      return {
        fileName: path.basename(resolved),
        dataBase64: `data:${mime};base64,${fs.readFileSync(resolved).toString("base64")}`,
      };
    }),

  analyzeExamDocumentsOcr: protectedProcedure
    .input(
      z.object({
        documents: z
          .array(
            z.object({
              fileName: z.string().max(255),
              mimeType: z.enum(["image/png", "image/jpeg"]),
              fileBase64: z.string().max(8_000_000),
            })
          )
          .min(1)
          .max(20),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireOperational(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const apiKey = String(process.env.OPENROUTER_API_KEY || "").trim();
      if (!apiKey)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "OPENROUTER_API_KEY não configurada neste ambiente.",
        });
      const workers = rowsOf(
        await db.execute(
          drzSql.raw(
            `SELECT u.id,u.name,u.cpf,u.employee_registration,u.position,b.name branch_name,s.name sector_name FROM users u LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN sectors s ON s.id=u.sector_id WHERE u.company_id=${companyId} AND ${activeEmployeeSql("u")} ORDER BY u.name LIMIT 5000`
          )
        )
      );
      const exams = rowsOf(
        await db.execute(
          drzSql`SELECT id,name,category,result_type FROM pcmso_exam_catalog_v2 WHERE company_id=${companyId} AND is_active=1 ORDER BY name`
        )
      );
      const output: any[] = [];
      for (const document of input.documents) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 90000);
          const response = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
                "HTTP-Referer": "https://saudedotrabalho.com",
                "X-Title": "Saude do Trabalho - OCR Exames Ocupacionais",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                temperature: 0,
                max_tokens: 2500,
                response_format: { type: "json_object" },
                messages: [
                  {
                    role: "user",
                    content: [
                      {
                        type: "text",
                        text: "Leia este laudo de exame ocupacional brasileiro somente como apoio de digitação. Não conclua diagnóstico, autenticidade nem aptidão. Retorne JSON com fields: employeeName, cpf, employeeRegistration, examName, performedDate (YYYY-MM-DD), laboratoryName, resultType (qualitativo, quantitativo ou misto), resultSummary, referenceText; parameters como array de {name,value,unit,reference}; confidence de 0 a 1 por campo; warnings como array. Use null quando não estiver legível e preserve a referência informada no próprio laudo.",
                      },
                      {
                        type: "image_url",
                        image_url: { url: document.fileBase64, detail: "high" },
                      },
                    ],
                  },
                ],
              }),
              signal: controller.signal,
            }
          );
          clearTimeout(timer);
          if (!response.ok)
            throw new Error(
              `OpenRouter ${response.status}: ${(await response.text()).slice(0, 160)}`
            );
          const data: any = await response.json();
          const raw = String(data.choices?.[0]?.message?.content || "")
            .replace(/```json|```/g, "")
            .trim();
          const parsed = JSON.parse(raw);
          const fields = parsed.fields || {};
          const cpf = String(fields.cpf || "").replace(/\D/g, "");
          const registration = normalizeMatch(fields.employeeRegistration);
          const workerCandidates = workers
            .map((worker: any) => {
              const workerCpf = String(worker.cpf || "").replace(/\D/g, "");
              const cpfExact = Boolean(cpf && workerCpf && cpf === workerCpf);
              const registrationExact = Boolean(
                registration &&
                  normalizeMatch(worker.employee_registration) === registration
              );
              return {
                ...worker,
                score:
                  cpfExact || registrationExact
                    ? 1
                    : matchScore(fields.employeeName, worker.name),
                cpfExact,
                registrationExact,
              };
            })
            .filter((worker: any) => worker.score >= 0.4)
            .sort((a: any, b: any) => b.score - a.score)
            .slice(0, 5);
          const examCandidates = exams
            .map((exam: any) => ({
              ...exam,
              score: matchScore(fields.examName, exam.name),
            }))
            .filter((exam: any) => exam.score >= 0.35)
            .sort((a: any, b: any) => b.score - a.score)
            .slice(0, 5);
          const confirmedWorkers = workerCandidates.filter(
            (worker: any) =>
              worker.cpfExact || worker.registrationExact || worker.score === 1
          );
          output.push({
            fileName: document.fileName,
            mimeType: document.mimeType,
            fileBase64: document.fileBase64,
            fields,
            confidence: parsed.confidence || {},
            warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
            workerCandidates,
            examCandidates,
            identityStatus:
              confirmedWorkers.length === 1
                ? "confirmado"
                : workerCandidates.length
                  ? "ambiguo"
                  : "nao_identificado",
          });
        } catch (error: any) {
          output.push({
            fileName: document.fileName,
            mimeType: document.mimeType,
            fileBase64: document.fileBase64,
            fields: {},
            confidence: {},
            warnings: [`Falha na leitura: ${String(error?.message || "erro")}`],
            workerCandidates: [],
            examCandidates: [],
            identityStatus: "nao_identificado",
          });
        }
      }
      await audit(
        db,
        ctx,
        "exam_ocr_batch_analyzed",
        "exam_result_batch",
        null,
        null,
        {
          documents: output.length,
          ambiguous: output.filter(item => item.identityStatus !== "confirmado")
            .length,
        }
      );
      return output;
    }),

  recordExamResult: protectedProcedure
    .input(
      z.object({
        orderId: z.number().int().positive().nullable().optional(),
        collaboratorId: z.number().int().positive(),
        examId: z.number().int().positive(),
        performedAt: z.string().min(10).max(40),
        laboratoryName: z.string().max(255).optional(),
        resultType: z.enum(["qualitativo", "quantitativo", "misto"]),
        resultSummary: z.string().max(20000).optional(),
        parameters: z
          .array(
            z.object({
              name: z.string().max(255),
              value: z.string().max(255),
              unit: z.string().max(80).optional(),
              reference: z.string().max(500).optional(),
            })
          )
          .max(300)
          .default([]),
        referenceText: z.string().max(50000).optional(),
        source: z.enum(["manual", "ocr", "integracao"]).default("manual"),
        identityStatus: z
          .enum(["confirmado", "divergencia", "ambiguo", "nao_identificado"])
          .default("confirmado"),
        fileBase64: z.string().max(16_000_000).optional(),
        fileName: z.string().max(255).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireOperational(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const worker: any = await db.execute(
        drzSql`SELECT id FROM users WHERE id=${input.collaboratorId} AND company_id=${companyId} LIMIT 1`
      );
      if (!rowsOf(worker).length) throw new TRPCError({ code: "NOT_FOUND" });
      await requireOwnedEntity(db, companyId, "exam", input.examId, "Exame");
      if (input.orderId) {
        const orderResult: any = await db.execute(
          drzSql`SELECT collaborator_id,exam_id FROM occupational_exam_orders WHERE id=${input.orderId} AND company_id=${companyId} LIMIT 1`
        );
        const order = rowsOf(orderResult)[0];
        if (!order)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Requisição não encontrada nesta empresa.",
          });
        if (
          Number(order.collaborator_id) !== input.collaboratorId ||
          Number(order.exam_id) !== input.examId
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "A requisição não corresponde ao colaborador e ao exame informados.",
          });
      }
      const documentPath = input.fileBase64
        ? savePrivateFile(
            companyId,
            "exam-results",
            input.fileName || "resultado.pdf",
            input.fileBase64
          )
        : null;
      const classification = "pendente_revisao";
      const result: any =
        await db.execute(drzSql`INSERT INTO occupational_exam_results
        (company_id,order_id,collaborator_id,exam_id,performed_at,laboratory_name,result_type,result_summary,parameters_json,reference_text,classification,source,identity_status,document_private_path,created_by)
        VALUES (${companyId},${input.orderId || null},${input.collaboratorId},${input.examId},${input.performedAt},${input.laboratoryName || null},${input.resultType},${input.resultSummary || null},${JSON.stringify(input.parameters)},${input.referenceText || null},${classification},${input.source},${input.identityStatus},${documentPath},${Number(ctx.user.id)})`);
      const id = Number((result as any)[0]?.insertId || 0);
      if (input.orderId)
        await db.execute(
          drzSql`UPDATE occupational_exam_orders SET status='realizada' WHERE id=${input.orderId} AND company_id=${companyId}`
        );
      await audit(
        db,
        ctx,
        "exam_result_received",
        "exam_result",
        id,
        input.collaboratorId,
        { source: input.source, identityStatus: input.identityStatus }
      );
      return { ok: true, id, classification };
    }),

  reviewExamResult: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        classification: z.enum([
          "normal",
          "alterado",
          "inconclusivo",
          "insatisfatorio",
          "nao_realizado",
        ]),
        medicalNotes: z.string().max(50000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireDoctor(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.execute(
        drzSql`UPDATE occupational_exam_results SET classification=${input.classification},medical_notes=${input.medicalNotes || null},reviewed_by=${Number(ctx.user.id)},reviewed_at=NOW() WHERE id=${input.id} AND company_id=${companyId}`
      );
      const row: any = await db.execute(
        drzSql`SELECT collaborator_id FROM occupational_exam_results WHERE id=${input.id} AND company_id=${companyId} LIMIT 1`
      );
      await audit(
        db,
        ctx,
        "exam_result_reviewed",
        "exam_result",
        input.id,
        Number(rowsOf(row)[0]?.collaborator_id || 0),
        { classification: input.classification }
      );
      return { ok: true };
    }),

  getAnamnesisContext: protectedProcedure
    .input(z.object({ collaboratorId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      requireDoctor(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) return null;
      const [worker, results, orders, anamneses, risks, program] =
        await Promise.all([
          db.execute(
            drzSql`SELECT u.id,u.name,u.cpf,u.position,b.name branch_name,s.name sector_name,g.id gse_id,g.code gse_code,g.name gse_name FROM users u LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN sectors s ON s.id=u.sector_id LEFT JOIN occupational_gse_worker_history h ON h.collaborator_id=u.id AND h.company_id=u.company_id AND h.is_current=1 LEFT JOIN occupational_gse_master g ON g.id=h.gse_id WHERE u.id=${input.collaboratorId} AND u.company_id=${companyId} LIMIT 1`
          ),
          db.execute(
            drzSql`SELECT r.id,r.performed_at,r.classification,e.name exam_name FROM occupational_exam_results r JOIN pcmso_exam_catalog_v2 e ON e.id=r.exam_id WHERE r.company_id=${companyId} AND r.collaborator_id=${input.collaboratorId} ORDER BY r.performed_at DESC LIMIT 50`
          ),
          db.execute(
            drzSql`SELECT o.id,o.status,o.valid_until,e.id exam_id,e.name exam_name FROM occupational_exam_orders o JOIN pcmso_exam_catalog_v2 e ON e.id=o.exam_id WHERE o.company_id=${companyId} AND o.collaborator_id=${input.collaboratorId} ORDER BY o.created_at DESC LIMIT 100`
          ),
          db.execute(
            drzSql`SELECT id,anamnesis_type,status,created_at,updated_at FROM occupational_anamneses WHERE company_id=${companyId} AND collaborator_id=${input.collaboratorId} ORDER BY created_at DESC LIMIT 30`
          ),
          db.execute(
            drzSql`SELECT DISTINCT m.risk_name,m.risk_type,m.risk_classification,m.monitoring_kind,m.monitoring_name,m.periodicity,e.name exam_name FROM users u JOIN occupational_gse_worker_history h ON h.collaborator_id=u.id AND h.company_id=u.company_id AND h.is_current=1 JOIN pcmso_risk_monitoring_v2 m ON m.company_id=u.company_id AND m.master_gse_id=h.gse_id LEFT JOIN pcmso_exam_catalog_v2 e ON e.id=m.exam_id WHERE u.id=${input.collaboratorId} AND u.company_id=${companyId} ORDER BY m.risk_name`
          ),
          db.execute(
            drzSql`SELECT p.id pcmso_id,p.title pcmso_title,p.valid_from,p.valid_until,p.doctor_name,p.doctor_crm,pg.id pgr_id,pg.title pgr_title FROM pcmso_programs_v2 p LEFT JOIN pgr_documents pg ON pg.id=p.pgr_id AND pg.company_id=p.company_id WHERE p.company_id=${companyId} AND p.status='vigente' AND (p.valid_from IS NULL OR p.valid_from<=CURDATE()) AND (p.valid_until IS NULL OR p.valid_until>=CURDATE()) ORDER BY p.updated_at DESC LIMIT 1`
          ),
        ]);
      return {
        worker: rowsOf(worker)[0] || null,
        results: rowsOf(results),
        orders: rowsOf(orders),
        anamneses: rowsOf(anamneses),
        risks: rowsOf(risks),
        program: rowsOf(program)[0] || null,
      };
    }),

  listAnamnesisQuestions: protectedProcedure
    .input(
      z.object({
        anamnesisType: z.enum([
          "admissional",
          "periodico",
          "retorno",
          "mudanca_risco",
          "demissional",
          "monitoracao_pontual",
        ]),
      })
    )
    .query(async ({ ctx, input }) => {
      requireDoctor(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) return [];
      const result: any =
        await db.execute(drzSql`SELECT * FROM occupational_anamnesis_questions
        WHERE company_id IN (0,${companyId}) AND anamnesis_type IN ('todos',${input.anamnesisType}) AND is_active=1
        ORDER BY (company_id=${companyId}) DESC,sort_order,id`);
      const unique = new Map<string, any>();
      for (const row of rowsOf(result))
        if (!unique.has(String(row.question_code)))
          unique.set(String(row.question_code), row);
      return [...unique.values()].sort(
        (a, b) => Number(a.sort_order) - Number(b.sort_order)
      );
    }),

  listAnamnesisQuestionConfig: protectedProcedure.query(async ({ ctx }) => {
    if (!["admin_global", "super_admin"].includes(roleOf(ctx)))
      throw new TRPCError({ code: "FORBIDDEN" });
    await ensureOccupationalTables();
    const db = await getDb();
    if (!db) return [];
    return rowsOf(
      await db.execute(
        drzSql`SELECT * FROM occupational_anamnesis_questions WHERE company_id=0 ORDER BY anamnesis_type,sort_order,id`
      )
    );
  }),

  upsertAnamnesisQuestion: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        questionCode: z.string().min(2).max(100),
        anamnesisType: z.enum([
          "todos",
          "admissional",
          "periodico",
          "retorno",
          "mudanca_risco",
          "demissional",
          "monitoracao_pontual",
        ]),
        groupName: z.string().min(2).max(120),
        questionText: z.string().min(5).max(1000),
        responseType: z.enum([
          "texto",
          "texto_longo",
          "sim_nao",
          "sim_nao_detalhe",
          "numero",
          "data",
          "escala_1_5",
          "selecao",
        ]),
        options: z.array(z.string().max(255)).max(50).default([]),
        isRequired: z.boolean().default(false),
        sortOrder: z.number().int().min(0).max(100000).default(0),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!["admin_global", "super_admin"].includes(roleOf(ctx)))
        throw new TRPCError({ code: "FORBIDDEN" });
      await ensureOccupationalTables();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let id = Number(input.id || 0);
      if (id) {
        await db.execute(
          drzSql`UPDATE occupational_anamnesis_questions SET question_code=${input.questionCode},anamnesis_type=${input.anamnesisType},group_name=${input.groupName},question_text=${input.questionText},response_type=${input.responseType},options_json=${JSON.stringify(input.options)},is_required=${input.isRequired ? 1 : 0},sort_order=${input.sortOrder},is_active=${input.isActive ? 1 : 0} WHERE id=${id} AND company_id=0`
        );
      } else {
        const result: any = await db.execute(
          drzSql`INSERT INTO occupational_anamnesis_questions (company_id,question_code,anamnesis_type,group_name,question_text,response_type,options_json,is_required,sort_order,is_active,created_by) VALUES (0,${input.questionCode},${input.anamnesisType},${input.groupName},${input.questionText},${input.responseType},${JSON.stringify(input.options)},${input.isRequired ? 1 : 0},${input.sortOrder},${input.isActive ? 1 : 0},${Number(ctx.user.id)})`
        );
        id = Number((result as any)[0]?.insertId || 0);
      }
      return { ok: true, id };
    }),

  saveAnamnesis: protectedProcedure
    .input(
      z.object({
        collaboratorId: z.number().int().positive(),
        encounterId: z.number().int().positive().nullable().optional(),
        anamnesisType: z.enum([
          "admissional",
          "periodico",
          "retorno",
          "mudanca_risco",
          "demissional",
          "monitoracao_pontual",
        ]),
        answers: z.record(
          z.string(),
          z.union([z.string(), z.boolean(), z.number(), z.null()])
        ),
        vitalSigns: z
          .object({
            weightKg: z.number().min(1).max(500).nullable().optional(),
            heightCm: z.number().min(50).max(250).nullable().optional(),
            systolicPressure: z
              .number()
              .int()
              .min(40)
              .max(300)
              .nullable()
              .optional(),
            diastolicPressure: z
              .number()
              .int()
              .min(20)
              .max(200)
              .nullable()
              .optional(),
            heartRate: z.number().int().min(20).max(250).nullable().optional(),
            respiratoryRate: z
              .number()
              .int()
              .min(5)
              .max(100)
              .nullable()
              .optional(),
            temperatureC: z.number().min(30).max(45).nullable().optional(),
            oxygenSaturation: z.number().min(50).max(100).nullable().optional(),
          })
          .optional(),
        status: z.enum(["rascunho", "concluida"]).default("rascunho"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireDoctor(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [contextResult, questionResult]: any[] = await Promise.all([
        db.execute(
          drzSql`SELECT u.position,u.branch_id,u.sector_id,g.id gse_id,g.code,g.name FROM users u LEFT JOIN occupational_gse_worker_history h ON h.collaborator_id=u.id AND h.company_id=u.company_id AND h.is_current=1 LEFT JOIN occupational_gse_master g ON g.id=h.gse_id WHERE u.id=${input.collaboratorId} AND u.company_id=${companyId} LIMIT 1`
        ),
        db.execute(
          drzSql`SELECT id,company_id,question_code,anamnesis_type,group_name,question_text,response_type,options_json,is_required,sort_order FROM occupational_anamnesis_questions WHERE company_id IN (0,${companyId}) AND anamnesis_type IN ('todos',${input.anamnesisType}) AND is_active=1 ORDER BY (company_id=${companyId}) DESC,sort_order,id`
        ),
      ]);
      if (!rowsOf(contextResult).length)
        throw new TRPCError({ code: "NOT_FOUND" });
      const questionMap = new Map<string, any>();
      for (const row of rowsOf(questionResult))
        if (!questionMap.has(String(row.question_code)))
          questionMap.set(String(row.question_code), row);
      const questionSnapshot = [...questionMap.values()].sort(
        (a, b) => Number(a.sort_order) - Number(b.sort_order)
      );
      const questionnaireVersion = crypto
        .createHash("sha256")
        .update(JSON.stringify(questionSnapshot))
        .digest("hex")
        .slice(0, 24);
      const occupationalContext = {
        worker: rowsOf(contextResult)[0],
        questions: questionSnapshot,
      };
      const signature =
        input.status === "concluida"
          ? crypto
              .createHash("sha256")
              .update(
                `${companyId}:${input.collaboratorId}:${Date.now()}:${Number(ctx.user.id)}`
              )
              .digest("hex")
          : null;
      const bmi = calculateOccupationalBmi(
        input.vitalSigns?.weightKg,
        input.vitalSigns?.heightCm
      );
      const result: any =
        await db.execute(drzSql`INSERT INTO occupational_anamneses
        (company_id,collaborator_id,encounter_id,anamnesis_type,answers_json,vital_signs_json,bmi,questionnaire_version,occupational_context_json,status,signature_hash,doctor_user_id)
        VALUES (${companyId},${input.collaboratorId},${input.encounterId || null},${input.anamnesisType},${JSON.stringify(input.answers)},${JSON.stringify(input.vitalSigns || {})},${bmi},${questionnaireVersion},${JSON.stringify(occupationalContext)},${input.status},${signature},${Number(ctx.user.id)})`);
      const id = Number((result as any)[0]?.insertId || 0);
      await audit(
        db,
        ctx,
        "anamnesis_saved",
        "anamnesis",
        id,
        input.collaboratorId,
        { type: input.anamnesisType, status: input.status }
      );
      return { ok: true, id, signatureHash: signature, bmi };
    }),

  validateAso: protectedProcedure
    .input(z.object({ collaboratorId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      requireDoctor(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) return null;
      await requireOwnedEntity(
        db,
        companyId,
        "user",
        input.collaboratorId,
        "Colaborador"
      );
      const pcmsoId = await resolveCurrentPcmso(db, companyId);
      if (!pcmsoId)
        return {
          ready: false,
          missingExamIds: [],
          pendingMedicalReview: 0,
          blockingReasons: ["pcmso_vigente_ausente"],
          missingExams: [],
          pcmsoId: null,
        };
      const clinicalExamId = await ensureClinicalConsultationExam(
        db,
        companyId,
        Number(ctx.user.id)
      );
      const [procedureState, anamnesisResult] = await Promise.all([
        loadAsoProcedureState(
          db,
          companyId,
          input.collaboratorId,
          pcmsoId,
          clinicalExamId
        ),
        db.execute(
          drzSql`SELECT COUNT(*) total FROM occupational_anamneses WHERE company_id=${companyId} AND collaborator_id=${input.collaboratorId} AND status='concluida'`
        ),
      ]);
      const missingNames = procedureState.expected.filter((row: any) =>
        procedureState.evaluation.missingExamIds.includes(Number(row.exam_id))
      );
      return {
        ...procedureState.evaluation,
        missingExams: missingNames,
        pcmsoId,
        completedAnamneses: Number(rowsOf(anamnesisResult)[0]?.total || 0),
      };
    }),

  issueAso: protectedProcedure
    .input(
      z.object({
        collaboratorId: z.number().int().positive(),
        encounterId: z.number().int().positive().nullable().optional(),
        pcmsoId: z.number().int().positive().nullable().optional(),
        asoType: z.enum([
          "admissional",
          "periodico",
          "retorno",
          "mudanca_risco",
          "demissional",
          "monitoracao_pontual",
        ]),
        fitnessStatus: z.enum(["apto", "inapto"]),
        specificAptitudes: z.array(z.string().max(255)).max(100).default([]),
        pendingJustification: z.string().max(50000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireDoctor(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await requireOwnedEntity(db, companyId, "pcmso", input.pcmsoId, "PCMSO");
      const [workerResult, profileResult, companyResult] = await Promise.all([
        db.execute(
          drzSql`SELECT u.*,b.name branch_name,s.name sector_name,g.id gse_id,g.code gse_code,g.name gse_name FROM users u LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN sectors s ON s.id=u.sector_id LEFT JOIN occupational_gse_worker_history h ON h.collaborator_id=u.id AND h.company_id=u.company_id AND h.is_current=1 LEFT JOIN occupational_gse_master g ON g.id=h.gse_id WHERE u.id=${input.collaboratorId} AND u.company_id=${companyId} LIMIT 1`
        ),
        db.execute(
          drzSql`SELECT p.crm,p.crm_state,u.name FROM users u LEFT JOIN medical_professional_profiles p ON p.user_id=u.id WHERE u.id=${Number(ctx.user.id)} LIMIT 1`
        ),
        db.execute(
          drzSql`SELECT name,cnpj,address FROM companies WHERE id=${companyId} LIMIT 1`
        ),
      ]);
      const worker = rowsOf(workerResult)[0];
      const profile = rowsOf(profileResult)[0] || {};
      const company = rowsOf(companyResult)[0] || {};
      if (!worker) throw new TRPCError({ code: "NOT_FOUND" });
      if (!String(profile.crm || "").trim())
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cadastre o CRM do médico antes de emitir o ASO.",
        });
      const resolvedPcmsoId = await resolveCurrentPcmso(
        db,
        companyId,
        input.pcmsoId
      );
      if (!resolvedPcmsoId)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Não há PCMSO vigente para vincular a emissão do ASO.",
        });
      const clinicalExamId = await ensureClinicalConsultationExam(
        db,
        companyId,
        Number(ctx.user.id)
      );
      const [procedureState, anamnesisResult, riskResult, pcmsoResult]: any[] =
        await Promise.all([
          loadAsoProcedureState(
            db,
            companyId,
            input.collaboratorId,
            resolvedPcmsoId,
            clinicalExamId
          ),
          db.execute(
            drzSql`SELECT id FROM occupational_anamneses WHERE company_id=${companyId} AND collaborator_id=${input.collaboratorId} AND anamnesis_type=${input.asoType} AND status='concluida' ORDER BY created_at DESC LIMIT 1`
          ),
          db.execute(
            drzSql`SELECT DISTINCT m.risk_name,m.risk_type,m.risk_classification,m.monitoring_kind,m.monitoring_name,e.name exam_name FROM pcmso_risk_monitoring_v2 m LEFT JOIN pcmso_exam_catalog_v2 e ON e.id=m.exam_id AND e.company_id=m.company_id WHERE m.company_id=${companyId} AND m.pcmso_id=${resolvedPcmsoId} AND m.master_gse_id=${worker.gse_id || 0} ORDER BY m.risk_name`
          ),
          db.execute(
            drzSql`SELECT p.title,p.valid_from,p.valid_until,p.doctor_name,p.doctor_crm,pg.title pgr_title FROM pcmso_programs_v2 p LEFT JOIN pgr_documents pg ON pg.id=p.pgr_id AND pg.company_id=p.company_id WHERE p.id=${resolvedPcmsoId} AND p.company_id=${companyId} LIMIT 1`
          ),
        ]);
      if (!rowsOf(anamnesisResult).length)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Conclua a anamnese correspondente antes de emitir o ASO.",
        });
      const completedRows = procedureState.completed;
      const evaluation = procedureState.evaluation;
      if (!evaluation.ready && !String(input.pendingJustification || "").trim())
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Há exames pendentes ou resultados sem revisão. Registre a justificativa médica para prosseguir ou mantenha o atendimento em aberto.",
        });
      const signature = crypto
        .createHash("sha256")
        .update(
          `${companyId}:${input.collaboratorId}:${input.asoType}:${Date.now()}:${Number(ctx.user.id)}`
        )
        .digest("hex");
      const risks = rowsOf(riskResult);
      const program = rowsOf(pcmsoResult)[0] || {};
      const riskSnapshot = JSON.stringify({
        gseId: worker.gse_id || null,
        gseCode: worker.gse_code || null,
        gseName: worker.gse_name || null,
        pgrTitle: program.pgr_title || null,
        pcmsoTitle: program.title || null,
        risks,
      });
      const examSnapshot = JSON.stringify({
        expected: procedureState.expected,
        completed: completedRows,
        validation: evaluation,
        issuedAt: new Date().toISOString(),
      });
      const anamnesisId = Number(rowsOf(anamnesisResult)[0]?.id || 0);
      const inserted: any =
        await db.execute(drzSql`INSERT INTO occupational_asos
        (company_id,collaborator_id,encounter_id,pcmso_id,gse_id,anamnesis_id,aso_type,fitness_status,specific_aptitudes_json,risk_snapshot_json,exam_snapshot_json,pending_justification,doctor_user_id,doctor_crm,status,signature_hash,issued_at)
        VALUES (${companyId},${input.collaboratorId},${input.encounterId || null},${resolvedPcmsoId},${worker.gse_id || null},${anamnesisId || null},${input.asoType},${input.fitnessStatus},${JSON.stringify(input.specificAptitudes)},${riskSnapshot},${examSnapshot},${input.pendingJustification || null},${Number(ctx.user.id)},${[profile.crm, profile.crm_state].filter(Boolean).join("/") || null},'emitido_pendente_assinatura',${signature},NOW())`);
      const id = Number((inserted as any)[0]?.insertId || 0);
      const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>@page{size:A4;margin:15mm}body{font-family:Arial;color:#173047;font-size:9.5pt;line-height:1.42}h1{color:#0e2c46;border-bottom:4px solid #0895a5;padding-bottom:4mm;margin:0 0 5mm}h2{font-size:12pt;color:#0e2c46;margin:5mm 0 2mm}.grid{display:grid;grid-template-columns:1fr 1fr;gap:2.5mm 8mm}.box{border:1px solid #d8e2e8;padding:3.5mm;margin:4mm 0}.result{font-size:15pt;font-weight:700;color:${input.fitnessStatus === "apto" ? "#087f5b" : "#b42318"}}.sign{margin-top:13mm;text-align:center}.line{border-top:1px solid #173047;width:85mm;margin:auto}.notice{background:#fff8dd;border-left:3px solid #d8a900;padding:3mm}.footer{margin-top:6mm;border-top:1px solid #d8e2e8;padding-top:2mm;font-size:7.5pt;color:#607487}</style></head><body>
        <h1>ATESTADO DE SAÚDE OCUPACIONAL - ASO</h1>
        <div class="box"><div class="grid"><div><b>Empresa:</b> ${esc(company.name || "-")}</div><div><b>CNPJ:</b> ${esc(company.cnpj || "-")}</div><div><b>PCMSO:</b> ${esc(program.title || "-")}</div><div><b>PGR de referência:</b> ${esc(program.pgr_title || "-")}</div></div></div>
        <h2>Identificação do trabalhador</h2><div class="grid"><div><b>Nome:</b> ${esc(worker.name)}</div><div><b>CPF:</b> ${esc(worker.cpf || "-")}</div><div><b>Matrícula:</b> ${esc(worker.employee_registration || "-")}</div><div><b>Cargo/Função:</b> ${esc(worker.position || "-")}</div><div><b>Setor:</b> ${esc(worker.sector_name || "-")}</div><div><b>Filial:</b> ${esc(worker.branch_name || "-")}</div><div><b>GSE:</b> ${esc([worker.gse_code, worker.gse_name].filter(Boolean).join(" - ") || "-")}</div><div><b>Data de emissão:</b> ${esc(new Date().toLocaleDateString("pt-BR"))}</div></div>
        <h2>Riscos ocupacionais que exigem controle médico</h2><ul>${risks.map((row: any) => `<li><b>${esc(row.risk_name)}</b> - ${esc(row.risk_type || "natureza não informada")} - ${esc(row.risk_classification || "classificação não informada")}</li>`).join("") || "<li>Ausência de riscos específicos registrados no contexto ocupacional vigente.</li>"}</ul>
        <h2>Procedimentos realizados</h2><ul>${completedRows.map((row: any) => `<li>${esc(row.name)} - realizado em ${esc(new Date(row.performed_at).toLocaleDateString("pt-BR"))}</li>`).join("") || "<li>Avaliação clínica ocupacional conforme registro médico.</li>"}</ul>
        <div class="box"><b>Tipo de exame ocupacional:</b> ${esc(input.asoType.replaceAll("_", " "))}<br><b>Conclusão:</b> <span class="result">${esc(input.fitnessStatus.toUpperCase())}</span><br><b>Aptidões específicas:</b> ${esc(input.specificAptitudes.join(", ") || "Não informadas")}</div>
        ${input.pendingJustification ? `<div class="notice"><b>Registro médico diante de pendências documentais:</b><br>${esc(input.pendingJustification)}</div>` : ""}
        <div class="sign"><div class="line"></div><b>${esc(profile.name || "Médico examinador")}</b><br>${esc([profile.crm, profile.crm_state].filter(Boolean).join("/") || "CRM não informado")}<br>Assinatura eletrônica/certificada: pendente de integração</div>
        <div class="footer">Documento ocupacional histórico e imutável após a emissão. Hash de integridade: ${esc(signature)}. A plataforma registra dados e evidências; a decisão de aptidão é exclusiva do médico examinador.</div></body></html>`;
      const target = await renderPdf(companyId, "aso", `aso_${id}.pdf`, html);
      await db.execute(
        drzSql`UPDATE occupational_asos SET pdf_private_path=${target},status='finalizado' WHERE id=${id} AND company_id=${companyId}`
      );
      await audit(db, ctx, "aso_issued", "aso", id, input.collaboratorId, {
        type: input.asoType,
        fitness: input.fitnessStatus,
        pendingOverride: !evaluation.ready,
      });
      return {
        ok: true,
        id,
        signatureHash: signature,
        fileName: `aso_${id}.pdf`,
        dataBase64: `data:application/pdf;base64,${fs.readFileSync(target).toString("base64")}`,
      };
    }),

  listAsos: protectedProcedure.query(async ({ ctx }) => {
    requireOperational(ctx);
    await ensureOccupationalTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) return [];
    const result: any = await db.execute(
      drzSql`SELECT a.id,a.collaborator_id,a.aso_type,a.fitness_status,a.status,a.issued_at,a.signature_hash,u.name collaborator_name,g.code gse_code,g.name gse_name FROM occupational_asos a JOIN users u ON u.id=a.collaborator_id LEFT JOIN occupational_gse_master g ON g.id=a.gse_id WHERE a.company_id=${companyId} ORDER BY a.issued_at DESC LIMIT 1000`
    );
    return rowsOf(result);
  }),

  getAsoPdf: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireOperational(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result: any = await db.execute(
        drzSql`SELECT pdf_private_path,collaborator_id FROM occupational_asos WHERE id=${input.id} AND company_id=${companyId} LIMIT 1`
      );
      const row = rowsOf(result)[0];
      const documentPath = String(row?.pdf_private_path || "");
      const root = path.resolve(privateRoot(companyId));
      const resolved = path.resolve(documentPath);
      if (
        !documentPath ||
        !resolved.startsWith(`${root}${path.sep}`) ||
        !fs.existsSync(resolved)
      )
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "PDF histórico do ASO não encontrado.",
        });
      await audit(
        db,
        ctx,
        "aso_pdf_viewed",
        "aso",
        input.id,
        Number(row.collaborator_id)
      );
      return {
        fileName: path.basename(resolved),
        dataBase64: `data:application/pdf;base64,${fs.readFileSync(resolved).toString("base64")}`,
      };
    }),

  listCats: protectedProcedure.query(async ({ ctx }) => {
    requireOperational(ctx);
    await ensureOccupationalTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) return [];
    const result: any = await db.execute(
      drzSql`SELECT c.*,u.name collaborator_name,u.cpf FROM occupational_cat_records c JOIN users u ON u.id=c.collaborator_id WHERE c.company_id=${companyId} ORDER BY c.event_at DESC LIMIT 1000`
    );
    return rowsOf(result);
  }),

  searchCatCodes: protectedProcedure
    .input(
      z.object({
        kind: z.enum([
          "causative_agent",
          "generating_situation",
          "body_part",
          "injury_nature",
        ]),
        query: z.string().max(180).default(""),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(({ ctx, input }) => {
      requireOperational(ctx);
      const rows = catCandidates(input.kind, input.query, input.limit);
      return {
        rows: rows.length
          ? rows
          : esocialCatCodes
              .filter(item => item.kind === input.kind)
              .slice(0, input.limit),
        source: "Tabelas 13, 14, 15 e 17 do eSocial S-1.3 NT 06/2026",
      };
    }),

  suggestCatCodes: protectedProcedure
    .input(z.object({ description: z.string().min(10).max(10000) }))
    .mutation(async ({ ctx, input }) => {
      requireSesmt(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const expanded = `${input.description} queda escorregamento impacto piso máquina equipamento braço perna mão pé tronco lesão contusão fratura corte`;
      const candidates = Object.fromEntries(
        (
          [
            "causative_agent",
            "generating_situation",
            "body_part",
            "injury_nature",
          ] as CatCodeKind[]
        ).map(kind => {
          const ranked = catCandidates(
            kind,
            expanded,
            kind === "causative_agent" ? 60 : 45
          );
          return [
            kind,
            (ranked.length
              ? ranked
              : esocialCatCodes.filter(item => item.kind === kind).slice(0, 60)
            ).map(item => ({ code: item.code, description: item.description })),
          ];
        })
      );
      let selected: Record<string, string> = {};
      const apiKey = process.env.OPENROUTER_API_KEY || "";
      if (apiKey) {
        try {
          const raw = await orChat(
            [
              {
                role: "system",
                content:
                  "Você auxilia o preenchimento de CAT no Brasil. Escolha somente códigos presentes nas listas fornecidas. Não invente código. Responda apenas JSON com as chaves causative_agent, generating_situation, body_part e injury_nature. Se não houver correspondência segura, use string vazia.",
              },
              {
                role: "user",
                content: JSON.stringify({
                  accidentDescription: input.description,
                  officialCandidates: candidates,
                }),
              },
            ],
            apiKey,
            true
          );
          selected = JSON.parse(
            raw
              .trim()
              .replace(/^```json\s*/i, "")
              .replace(/```$/i, "")
          );
        } catch (error: any) {
          console.warn(
            "[CAT] sugestão assistida indisponível; usando similaridade local:",
            String(error?.message || error).slice(0, 180)
          );
        }
      }
      const suggestions = (Object.keys(candidates) as CatCodeKind[]).map(
        kind => {
          const allowed = candidates[kind] as Array<{
            code: string;
            description: string;
          }>;
          const requestedCode = String(selected[kind] || "");
          const choice =
            allowed.find(item => item.code === requestedCode) ||
            allowed[0] ||
            null;
          return { kind, selected: choice, alternatives: allowed.slice(0, 5) };
        }
      );
      await audit(db, ctx, "cat_codes_suggested_by_ai", "cat", null, null, {
        sourceVersion: "eSocial S-1.3 NT 06/2026",
        validatedAgainstOfficialCatalog: true,
      });
      return {
        suggestions,
        advisory:
          "As sugestões são auxiliares e devem ser validadas pelo responsável pelo preenchimento da CAT.",
        source: "Tabelas oficiais 13, 14, 15 e 17 do eSocial S-1.3 NT 06/2026",
      };
    }),

  createCat: protectedProcedure
    .input(
      z.object({
        collaboratorId: z.number().int().positive(),
        eventAt: z.string().min(10).max(40),
        emitterType: z
          .enum([
            "empregador",
            "sindicato",
            "medico",
            "dependente",
            "autoridade_publica",
          ])
          .default("empregador"),
        catType: z
          .enum(["inicial", "reabertura", "comunicacao_obito"])
          .default("inicial"),
        initiative: z
          .enum([
            "empregador",
            "ordem_judicial",
            "determinacao_fiscal",
            "outros",
          ])
          .default("empregador"),
        registrationSource: z
          .enum(["plataforma", "importacao", "integracao"])
          .default("plataforma"),
        catNumber: z.string().max(100).optional(),
        originReceipt: z.string().max(120).optional(),
        employerRegistrationType: z
          .enum(["cnpj", "cpf", "caepf", "cno"])
          .default("cnpj"),
        employerRegistrationNumber: z.string().max(40).optional(),
        employerCnae: z.string().max(20).optional(),
        location: z.string().max(5000).optional(),
        accidentType: z.string().max(100).optional(),
        hoursWorkedBeforeAccident: z.string().max(30).optional(),
        lastWorkedDate: dateInput.optional().nullable(),
        locationType: z.string().max(80).optional(),
        locationDetail: z.string().max(5000).optional(),
        locationRegistration: z.string().max(80).optional(),
        eventCity: z.string().max(180).optional(),
        eventUf: z.string().max(2).optional(),
        eventCountry: z.string().max(100).default("Brasil"),
        description: z.string().min(5).max(50000),
        causativeAgent: z.string().max(10000).optional(),
        causativeAgentCode: z.string().max(30).optional(),
        generatingSituationCode: z.string().max(30).optional(),
        generatingSituation: z.string().max(10000).optional(),
        bodyPart: z.string().max(180).optional(),
        bodyPartCode: z.string().max(30).optional(),
        laterality: z
          .enum(["nao_aplicavel", "esquerda", "direita", "ambos"])
          .default("nao_aplicavel"),
        injuryNature: z.string().max(180).optional(),
        injuryNatureCode: z.string().max(30).optional(),
        leaveRequired: z.boolean().default(false),
        policeReport: z.boolean().default(false),
        deathOccurred: z.boolean().default(false),
        deathDate: dateInput.optional().nullable(),
        medicalAttendanceAt: z.string().max(40).optional(),
        hospitalization: z.boolean().default(false),
        treatmentDays: z.number().int().min(0).max(9999).optional().nullable(),
        diagnosis: z.string().max(20000).optional(),
        cid: z.string().max(20).optional(),
        doctorName: z.string().max(255).optional(),
        doctorCouncil: z.string().max(20).optional(),
        doctorUf: z.string().max(2).optional(),
        doctorRegistration: z.string().max(40).optional(),
        medicalNotes: z.string().max(50000).optional(),
        witnesses: z.array(z.string().max(255)).max(50).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireSesmt(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await requireOwnedEntity(
        db,
        companyId,
        "user",
        input.collaboratorId,
        "Colaborador"
      );
      const [workerResult, companyResult]: any[] = await Promise.all([
        db.execute(
          drzSql`SELECT u.id,u.name,u.cpf,u.employee_registration,u.position,b.name branch_name,s.name sector_name FROM users u LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN sectors s ON s.id=u.sector_id WHERE u.id=${input.collaboratorId} AND u.company_id=${companyId} LIMIT 1`
        ),
        db.execute(
          drzSql`SELECT name,cnpj,address FROM companies WHERE id=${companyId} LIMIT 1`
        ),
      ]);
      const worker = rowsOf(workerResult)[0] || {};
      const company = rowsOf(companyResult)[0] || {};
      const resolveOfficialCode = (kind: CatCodeKind, code?: string) => {
        if (!code) return null;
        const item = esocialCatCodes.find(
          row => row.kind === kind && row.code === String(code)
        );
        if (!item)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `O código ${code} não pertence à tabela oficial ${kind} do eSocial S-1.3 NT 06/2026.`,
          });
        return item;
      };
      const officialAgent = resolveOfficialCode(
        "causative_agent",
        input.causativeAgentCode
      );
      const officialSituation = resolveOfficialCode(
        "generating_situation",
        input.generatingSituationCode
      );
      const officialBodyPart = resolveOfficialCode(
        "body_part",
        input.bodyPartCode
      );
      const officialInjury = resolveOfficialCode(
        "injury_nature",
        input.injuryNatureCode
      );
      const validatedInput = {
        ...input,
        causativeAgent: officialAgent?.description || input.causativeAgent,
        generatingSituation:
          officialSituation?.description || input.generatingSituation,
        bodyPart: officialBodyPart?.description || input.bodyPart,
        injuryNature: officialInjury?.description || input.injuryNature,
      };
      const esocialPayload = catEsocialPayload(validatedInput, company, worker);
      const result: any =
        await db.execute(drzSql`INSERT INTO occupational_cat_records
        (company_id,collaborator_id,event_at,emitter_type,cat_type,initiative,registration_source,cat_number,origin_receipt,employer_registration_type,employer_registration_number,employer_cnae,location_text,accident_type,hours_worked_before_accident,last_worked_date,location_type,location_detail,location_registration,event_city,event_uf,event_country,description,causative_agent,causative_agent_code,generating_situation_code,generating_situation,body_part,body_part_code,laterality,injury_nature,injury_nature_code,leave_required,police_report,death_occurred,death_date,medical_attendance_at,hospitalization,treatment_days,diagnosis,cid,doctor_name,doctor_council,doctor_uf,doctor_registration,medical_notes,witnesses_json,status,esocial_status,esocial_version,esocial_event_json,created_by)
        VALUES (${companyId},${input.collaboratorId},${input.eventAt},${input.emitterType},${input.catType},${input.initiative},${input.registrationSource},${input.catNumber || null},${input.originReceipt || null},${input.employerRegistrationType},${input.employerRegistrationNumber || company.cnpj || null},${input.employerCnae || null},${input.location || null},${input.accidentType || null},${input.hoursWorkedBeforeAccident || null},${input.lastWorkedDate || null},${input.locationType || null},${input.locationDetail || null},${input.locationRegistration || null},${input.eventCity || null},${input.eventUf?.toUpperCase() || null},${input.eventCountry},${input.description},${validatedInput.causativeAgent || null},${input.causativeAgentCode || null},${input.generatingSituationCode || null},${validatedInput.generatingSituation || null},${validatedInput.bodyPart || null},${input.bodyPartCode || null},${input.laterality},${validatedInput.injuryNature || null},${input.injuryNatureCode || null},${input.leaveRequired ? 1 : 0},${input.policeReport ? 1 : 0},${input.deathOccurred ? 1 : 0},${input.deathDate || null},${input.medicalAttendanceAt || null},${input.hospitalization ? 1 : 0},${input.treatmentDays ?? null},${input.diagnosis || null},${input.cid || null},${input.doctorName || null},${input.doctorCouncil || null},${input.doctorUf?.toUpperCase() || null},${input.doctorRegistration || null},${input.medicalNotes || null},${JSON.stringify(input.witnesses)},'rascunho','pendente_integracao','eSocial S-1.3 - NT 06/2026',${JSON.stringify(esocialPayload)},${Number(ctx.user.id)})`);
      const id = Number((result as any)[0]?.insertId || 0);
      await db.execute(
        drzSql`INSERT INTO occupational_esocial_transmissions (company_id,entity_type,entity_id,event_code,layout_version,status,payload_json,requested_by) VALUES (${companyId},'cat',${id},'S-2210','S-1.3 NT 06/2026','pendente_integracao',${JSON.stringify(esocialPayload)},${Number(ctx.user.id)})`
      );
      await audit(db, ctx, "cat_created", "cat", id, input.collaboratorId, {
        event: "S-2210",
        layout: "S-1.3 NT 06/2026",
        transmission: "pendente_integracao",
      });
      return {
        ok: true,
        id,
        esocialEvent: "S-2210",
        transmission: "pendente_integracao",
        layout: "S-1.3 NT 06/2026",
      };
    }),

  generateCatPdf: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireOperational(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result: any = await db.execute(
        drzSql`SELECT c.*,u.name collaborator_name,u.cpf,u.employee_registration,u.position,b.name branch_name,s.name sector_name,co.name company_name,co.cnpj company_cnpj,co.address company_address FROM occupational_cat_records c JOIN users u ON u.id=c.collaborator_id LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN sectors s ON s.id=u.sector_id JOIN companies co ON co.id=c.company_id WHERE c.id=${input.id} AND c.company_id=${companyId} LIMIT 1`
      );
      const row = rowsOf(result)[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>@page{size:A4;margin:13mm}body{font-family:Arial;color:#173047;font-size:8.8pt;line-height:1.35}h1{font-size:17pt;border-bottom:4px solid #0895a5;padding-bottom:3mm}h2{font-size:11pt;color:#0e2c46;margin:4mm 0 2mm}.grid{display:grid;grid-template-columns:1fr 1fr;gap:2mm 7mm}.box{border:1px solid #cedbe3;padding:3mm;margin:3mm 0}.warn{background:#fff8dd;border-left:3px solid #d8a900;padding:3mm}.footer{font-size:7pt;color:#647789;border-top:1px solid #d7e1e7;margin-top:5mm;padding-top:2mm}</style></head><body><h1>COMUNICAÇÃO DE ACIDENTE DE TRABALHO - CAT</h1><div class="warn"><b>Registro interno gerado pela plataforma.</b> Evento S-2210 preparado no leiaute ${esc(row.esocial_version || "S-1.3 NT 06/2026")}. Situação de transmissão: ${esc(row.esocial_status || "pendente de integração")}. Este PDF não substitui protocolo/recibo oficial do eSocial.</div><h2>1. Empregador</h2><div class="grid"><div><b>Empresa:</b> ${esc(row.company_name)}</div><div><b>CNPJ:</b> ${esc(row.company_cnpj || "-")}</div><div><b>Inscrição:</b> ${esc(row.employer_registration_type || "cnpj")} ${esc(row.employer_registration_number || "-")}</div><div><b>CNAE:</b> ${esc(row.employer_cnae || "-")}</div></div><h2>2. Trabalhador</h2><div class="grid"><div><b>Nome:</b> ${esc(row.collaborator_name)}</div><div><b>CPF:</b> ${esc(row.cpf || "-")}</div><div><b>Matrícula:</b> ${esc(row.employee_registration || "-")}</div><div><b>Cargo:</b> ${esc(row.position || "-")}</div><div><b>Filial:</b> ${esc(row.branch_name || "-")}</div><div><b>Setor:</b> ${esc(row.sector_name || "-")}</div></div><h2>3. Comunicação</h2><div class="grid"><div><b>Tipo CAT:</b> ${esc(row.cat_type || "inicial")}</div><div><b>Emitente:</b> ${esc(row.emitter_type || "empregador")}</div><div><b>Iniciativa:</b> ${esc(row.initiative || "empregador")}</div><div><b>Origem:</b> ${esc(row.registration_source || "plataforma")}</div><div><b>Número/recibo anterior:</b> ${esc(row.cat_number || row.origin_receipt || "-")}</div><div><b>Data/hora:</b> ${esc(new Date(row.event_at).toLocaleString("pt-BR"))}</div></div><h2>4. Acidente</h2><div class="box"><b>Tipo:</b> ${esc(row.accident_type || "-")}<br><b>Descrição:</b> ${esc(row.description)}<br><b>Local:</b> ${esc(row.location_text || "-")} ${esc(row.location_detail || "")}<br><b>Município/UF:</b> ${esc(row.event_city || "-")} / ${esc(row.event_uf || "-")}<br><b>Horas trabalhadas:</b> ${esc(row.hours_worked_before_accident || "-")}<br><b>Agente causador:</b> ${esc(row.causative_agent_code || "-")} - ${esc(row.causative_agent || "-")}<br><b>Situação geradora:</b> ${esc(row.generating_situation_code || "-")}<br><b>Parte do corpo:</b> ${esc(row.body_part_code || "-")} - ${esc(row.body_part || "-")} (${esc(row.laterality || "-")})<br><b>Natureza da lesão:</b> ${esc(row.injury_nature_code || "-")} - ${esc(row.injury_nature || "-")}<br><b>Afastamento:</b> ${Number(row.leave_required) ? "Sim" : "Não"} &nbsp; <b>Boletim policial:</b> ${Number(row.police_report) ? "Sim" : "Não"}</div><h2>5. Atendimento médico</h2><div class="grid"><div><b>Data/hora:</b> ${row.medical_attendance_at ? esc(new Date(row.medical_attendance_at).toLocaleString("pt-BR")) : "-"}</div><div><b>Internação:</b> ${Number(row.hospitalization) ? "Sim" : "Não"}</div><div><b>Dias tratamento:</b> ${esc(row.treatment_days ?? "-")}</div><div><b>CID:</b> ${esc(row.cid || "-")}</div><div><b>Profissional:</b> ${esc(row.doctor_name || "-")}</div><div><b>Registro:</b> ${esc([row.doctor_council, row.doctor_registration, row.doctor_uf].filter(Boolean).join(" ") || "-")}</div></div><div class="footer">Documento emitido em ${esc(new Date().toLocaleString("pt-BR"))}. A transmissão ao eSocial permanece bloqueada até integração oficial, certificado e validação técnica do payload.</div></body></html>`;
      const fileName = `cat_${input.id}.pdf`;
      const target = await renderPdf(companyId, "cat", fileName, html);
      await db.execute(
        drzSql`UPDATE occupational_cat_records SET pdf_private_path=${target} WHERE id=${input.id} AND company_id=${companyId}`
      );
      await audit(
        db,
        ctx,
        "cat_pdf_generated",
        "cat",
        input.id,
        Number(row.collaborator_id)
      );
      return {
        fileName,
        dataBase64: `data:application/pdf;base64,${fs.readFileSync(target).toString("base64")}`,
      };
    }),

  listWorkOrders: protectedProcedure.query(async ({ ctx }) => {
    requireOperational(ctx);
    await ensureOccupationalTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) return [];
    const result: any = await db.execute(
      drzSql`SELECT o.*,u.name collaborator_name,g.code gse_code,g.name gse_name FROM occupational_work_orders o JOIN users u ON u.id=o.collaborator_id LEFT JOIN occupational_gse_master g ON g.id=o.gse_id WHERE o.company_id=${companyId} ORDER BY o.created_at DESC LIMIT 1000`
    );
    return rowsOf(result);
  }),

  createWorkOrder: protectedProcedure
    .input(
      z.object({
        collaboratorIds: z.array(z.number().int().positive()).min(1).max(3000),
        title: z.string().min(2).max(255),
        activity: z.string().max(50000).optional(),
        risks: z.array(z.string().max(1000)).max(300).default([]),
        preventiveMeasures: z.array(z.string().max(1000)).max(300).default([]),
        epis: z.array(z.string().max(1000)).max(300).default([]),
        epcs: z.array(z.string().max(1000)).max(300).default([]),
        trainings: z.array(z.string().max(1000)).max(300).default([]),
        validFrom: dateInput.nullable().optional(),
        validUntil: dateInput.nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireSesmt(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let created = 0;
      for (const collaboratorId of [...new Set(input.collaboratorIds)]) {
        await requireOwnedEntity(
          db,
          companyId,
          "user",
          collaboratorId,
          "Colaborador"
        );
        const gseResult: any = await db.execute(
          drzSql`SELECT gse_id FROM occupational_gse_worker_history WHERE company_id=${companyId} AND collaborator_id=${collaboratorId} AND is_current=1 LIMIT 1`
        );
        const result: any =
          await db.execute(drzSql`INSERT INTO occupational_work_orders
          (company_id,collaborator_id,gse_id,title,activity_text,risks_json,preventive_measures_json,epi_json,epc_json,trainings_json,valid_from,valid_until,acknowledgement_status,created_by)
          VALUES (${companyId},${collaboratorId},${rowsOf(gseResult)[0]?.gse_id || null},${input.title},${input.activity || null},${JSON.stringify(input.risks)},${JSON.stringify(input.preventiveMeasures)},${JSON.stringify(input.epis)},${JSON.stringify(input.epcs)},${JSON.stringify(input.trainings)},${input.validFrom || null},${input.validUntil || null},'pendente',${Number(ctx.user.id)})`);
        const id = Number((result as any)[0]?.insertId || 0);
        await audit(
          db,
          ctx,
          "work_order_created",
          "work_order",
          id,
          collaboratorId
        );
        created++;
      }
      return { ok: true, created };
    }),

  setVaccineCampaignPopulation: protectedProcedure
    .input(
      z.object({
        campaignId: z.number().int().positive(),
        collaboratorIds: z.array(z.number().int().positive()).min(1).max(5000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireSesmt(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await requireOwnedEntity(
        db,
        companyId,
        "vaccineCampaign",
        input.campaignId,
        "Campanha de vacinação"
      );
      let selected = 0;
      for (const collaboratorId of [...new Set(input.collaboratorIds)]) {
        await requireOwnedEntity(
          db,
          companyId,
          "user",
          collaboratorId,
          "Colaborador"
        );
        await db.execute(drzSql`INSERT IGNORE INTO medical_vaccine_campaign_participants_v2
          (company_id,campaign_id,collaborator_id,status,created_by)
          VALUES (${companyId},${input.campaignId},${collaboratorId},'convocado',${Number(ctx.user.id)})`);
        selected++;
      }
      await audit(
        db,
        ctx,
        "vaccine_population_selected",
        "vaccine_campaign",
        input.campaignId,
        null,
        { selected }
      );
      return { ok: true, selected };
    }),

  listVaccineCampaignPopulation: protectedProcedure
    .input(z.object({ campaignId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      requireOperational(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) return [];
      const result: any = await db.execute(
        drzSql`SELECT p.*,u.name collaborator_name,u.cpf,u.position,b.name branch_name,s.name sector_name FROM medical_vaccine_campaign_participants_v2 p JOIN users u ON u.id=p.collaborator_id LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN sectors s ON s.id=u.sector_id WHERE p.company_id=${companyId} AND p.campaign_id=${input.campaignId} ORDER BY u.name`
      );
      return rowsOf(result);
    }),

  updateVaccinationAttendance: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum([
          "convocado",
          "vacinado",
          "ausente",
          "recusou",
          "afastado",
          "ferias",
          "outro",
        ]),
        absenceReason: z.string().max(120).optional(),
        vaccinationDate: z.string().max(40).optional(),
        lot: z.string().max(120).optional(),
        appliedBy: z.string().max(255).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireSesmt(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.execute(
        drzSql`UPDATE medical_vaccine_campaign_participants_v2 SET status=${input.status},absence_reason=${input.absenceReason || null},vaccinated_at=${input.status === "vacinado" ? input.vaccinationDate || new Date().toISOString().slice(0, 19).replace("T", " ") : null},lot=${input.lot || null},applied_by=${input.appliedBy || null} WHERE id=${input.id} AND company_id=${companyId}`
      );
      await audit(
        db,
        ctx,
        "vaccine_attendance_updated",
        "vaccine_participant",
        input.id,
        null,
        { status: input.status }
      );
      return { ok: true };
    }),

  sendVaccineCampaignEmails: protectedProcedure
    .input(
      z.object({
        campaignId: z.number().int().positive(),
        participantIds: z.array(z.number().int().positive()).min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireSesmt(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const ids = [...new Set(input.participantIds)].join(",");
      const result: any = await db.execute(
        drzSql.raw(
          `SELECT p.id,u.id collaborator_id,u.name,u.email,c.name campaign_name,c.campaign_at,c.location,v.name vaccine_name FROM medical_vaccine_campaign_participants_v2 p JOIN users u ON u.id=p.collaborator_id JOIN medical_vaccine_campaigns_v2 c ON c.id=p.campaign_id JOIN medical_vaccines_v2 v ON v.id=c.vaccine_id WHERE p.company_id=${companyId} AND p.campaign_id=${input.campaignId} AND p.id IN (${ids})`
        )
      );
      let sent = 0,
        failed = 0,
        preview = 0;
      for (const row of rowsOf(result)) {
        if (!row.email) {
          failed++;
          await db.execute(
            drzSql`UPDATE medical_vaccine_campaign_participants_v2 SET notification_status='sem_email' WHERE id=${Number(row.id)} AND company_id=${companyId}`
          );
          continue;
        }
        const response = await sendEmail({
          to: row.email,
          toName: row.name,
          subject: `Convocação - ${row.campaign_name}`,
          html: `<p>Olá, ${esc(row.name)}.</p><p>Você foi convocado(a) para a campanha <b>${esc(row.campaign_name)}</b>.</p><p><b>Vacina:</b> ${esc(row.vaccine_name)}<br><b>Data:</b> ${esc(new Date(row.campaign_at).toLocaleString("pt-BR"))}<br><b>Local:</b> ${esc(row.location || "a confirmar")}</p><p>Consulte a plataforma para acompanhar a convocação e o comprovante.</p>`,
        });
        const status = response.ok
          ? response.preview
            ? "preview"
            : "enviada"
          : "falhou";
        await db.execute(
          drzSql`UPDATE medical_vaccine_campaign_participants_v2 SET notification_status=${status},notification_sent_at=NOW() WHERE id=${Number(row.id)} AND company_id=${companyId}`
        );
        if (response.ok) {
          sent++;
          if (response.preview) preview++;
        } else failed++;
      }
      await audit(
        db,
        ctx,
        "vaccine_campaign_emails_sent",
        "vaccine_campaign",
        input.campaignId,
        null,
        { sent, failed, preview }
      );
      return { ok: failed === 0, sent, failed, preview };
    }),

  generateVaccineCampaignProofs: protectedProcedure
    .input(
      z.object({
        campaignId: z.number().int().positive(),
        participantIds: z.array(z.number().int().positive()).min(1).max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireSesmt(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const ids = [...new Set(input.participantIds)].join(",");
      const result: any = await db.execute(
        drzSql.raw(
          `SELECT p.id,u.name,u.cpf,u.employee_registration,u.position,b.name branch_name,s.name sector_name,c.name campaign_name,c.campaign_at,c.location,v.name vaccine_name,v.manufacturer,co.name company_name,co.cnpj FROM medical_vaccine_campaign_participants_v2 p JOIN users u ON u.id=p.collaborator_id LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN sectors s ON s.id=u.sector_id JOIN medical_vaccine_campaigns_v2 c ON c.id=p.campaign_id JOIN medical_vaccines_v2 v ON v.id=c.vaccine_id JOIN companies co ON co.id=p.company_id WHERE p.company_id=${companyId} AND p.campaign_id=${input.campaignId} AND p.id IN (${ids}) ORDER BY b.name,s.name,u.name`
        )
      );
      const rows = rowsOf(result);
      if (!rows.length) throw new TRPCError({ code: "NOT_FOUND" });
      const pages = rows
        .map(
          (row: any) =>
            `<section class="page"><header><h1>COMPROVANTE DE VACINAÇÃO</h1><p><b>${esc(row.company_name)}</b> · CNPJ ${esc(row.cnpj || "-")}</p></header><h2>${esc(row.campaign_name)}</h2><div class="grid"><div><b>Colaborador:</b> ${esc(row.name)}</div><div><b>CPF:</b> ${esc(row.cpf || "-")}</div><div><b>Matrícula:</b> ${esc(row.employee_registration || "-")}</div><div><b>Cargo:</b> ${esc(row.position || "-")}</div><div><b>Filial:</b> ${esc(row.branch_name || "-")}</div><div><b>Setor:</b> ${esc(row.sector_name || "-")}</div><div><b>Vacina:</b> ${esc(row.vaccine_name)}</div><div><b>Fabricante:</b> ${esc(row.manufacturer || "-")}</div><div><b>Data prevista:</b> ${esc(new Date(row.campaign_at).toLocaleDateString("pt-BR"))}</div><div><b>Local:</b> ${esc(row.location || "-")}</div></div><div class="fill"><p>Confirmação da aplicação: ( ) Sim &nbsp; ( ) Não</p><p>Data efetiva: ____________________ &nbsp; Lote: ____________________</p><p>Responsável pela aplicação: _________________________________________________</p></div><div class="sign"><div></div>Assinatura / validação</div></section>`
        )
        .join("");
      const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>@page{size:A4;margin:18mm}body{font-family:Arial;color:#173047;font-size:10pt}.page{min-height:250mm;break-after:page}.page:last-child{break-after:auto}header{border-bottom:4px solid #0895a5}h1{font-size:20pt}.grid{display:grid;grid-template-columns:1fr 1fr;gap:5mm 8mm;margin-top:10mm}.fill{border:1px solid #cad7df;padding:6mm;margin-top:12mm;line-height:2}.sign{margin-top:25mm;text-align:center}.sign div{border-top:1px solid #173047;width:90mm;margin:auto}</style></head><body>${pages}</body></html>`;
      const fileName = `comprovantes_vacinacao_${input.campaignId}_${Date.now()}.pdf`;
      const target = await renderPdf(
        companyId,
        "vaccination-campaigns",
        fileName,
        html
      );
      for (const row of rows)
        await db.execute(
          drzSql`UPDATE medical_vaccine_campaign_participants_v2 SET receipt_private_path=${target} WHERE company_id=${companyId} AND campaign_id=${input.campaignId} AND id=${Number(row.id)}`
        );
      await audit(
        db,
        ctx,
        "vaccine_campaign_proofs_generated",
        "vaccine_campaign",
        input.campaignId,
        null,
        { participants: rows.length, fileName }
      );
      return {
        fileName,
        total: rows.length,
        dataBase64: `data:application/pdf;base64,${fs.readFileSync(target).toString("base64")}`,
      };
    }),

  generateOccupationalProgrammingPdf: protectedProcedure
    .input(
      z.object({
        branchId: z.number().int().positive().optional(),
        sectorId: z.number().int().positive().optional(),
        gseId: z.number().int().positive().optional(),
        examId: z.number().int().positive().optional(),
        status: z
          .enum([
            "todos",
            "requisicao_pendente",
            "pendente",
            "enviada",
            "realizada",
            "vencida",
            "resultado_recebido",
          ])
          .default("todos"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireOperational(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const clinicalExamId = await ensureClinicalConsultationExam(
        db,
        companyId,
        Number(ctx.user.id)
      );
      const result: any = await db.execute(
        drzSql.raw(
          `SELECT u.id collaborator_id,u.name collaborator_name,u.cpf,u.employee_registration,u.position,u.branch_id,u.sector_id,b.name branch_name,s.name sector_name,h.gse_id,g.code gse_code,g.name gse_name,m.id monitoring_id,m.pcmso_id,m.monitoring_kind,m.periodicity,CASE WHEN m.monitoring_kind='avaliacao_clinica' THEN ${clinicalExamId} ELSE m.exam_id END exam_id,e.name exam_name,p.title pcmso_title,pg.title pgr_title,(SELECT o.status FROM occupational_exam_orders o WHERE o.company_id=u.company_id AND o.collaborator_id=u.id AND o.exam_id=(CASE WHEN m.monitoring_kind='avaliacao_clinica' THEN ${clinicalExamId} ELSE m.exam_id END) AND o.pcmso_id=m.pcmso_id ORDER BY o.version_number DESC,o.created_at DESC LIMIT 1) latest_order_status,(SELECT MAX(r.performed_at) FROM occupational_exam_results r WHERE r.company_id=u.company_id AND r.collaborator_id=u.id AND r.exam_id=(CASE WHEN m.monitoring_kind='avaliacao_clinica' THEN ${clinicalExamId} ELSE m.exam_id END)) latest_result_at FROM users u JOIN occupational_gse_worker_history h ON h.collaborator_id=u.id AND h.company_id=u.company_id AND h.is_current=1 JOIN occupational_gse_master g ON g.id=h.gse_id AND g.company_id=u.company_id JOIN pcmso_risk_monitoring_v2 m ON m.company_id=u.company_id AND m.master_gse_id=h.gse_id AND m.monitoring_kind IN ('avaliacao_clinica','exame_complementar') AND (m.monitoring_kind='avaliacao_clinica' OR m.exam_id IS NOT NULL) AND m.suggestion_status IN ('aprovada','editada') JOIN pcmso_programs_v2 p ON p.id=m.pcmso_id AND p.company_id=u.company_id AND p.status='vigente' AND (p.valid_from IS NULL OR p.valid_from<=CURDATE()) AND (p.valid_until IS NULL OR p.valid_until>=CURDATE()) LEFT JOIN pgr_documents pg ON pg.id=p.pgr_id AND pg.company_id=u.company_id JOIN pcmso_exam_catalog_v2 e ON e.id=(CASE WHEN m.monitoring_kind='avaliacao_clinica' THEN ${clinicalExamId} ELSE m.exam_id END) AND e.company_id=u.company_id AND e.is_active=1 LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN sectors s ON s.id=u.sector_id WHERE u.company_id=${companyId} AND ${activeEmployeeSql("u")} ORDER BY b.name,s.name,g.code,e.name,u.name`
        )
      );
      const dedup = new Map<string, any>();
      for (const row of rowsOf(result)) {
        const key = `${row.collaborator_id}:${row.pcmso_id}:${row.exam_id}`;
        if (!dedup.has(key)) dedup.set(key, row);
      }
      let rows = [...dedup.values()].map((row: any) => ({
        ...row,
        operational_status: row.latest_result_at
          ? "resultado_recebido"
          : row.latest_order_status || "requisicao_pendente",
      }));
      rows = rows.filter(
        (row: any) =>
          (!input.branchId || Number(row.branch_id) === input.branchId) &&
          (!input.sectorId || Number(row.sector_id) === input.sectorId) &&
          (!input.gseId || Number(row.gse_id) === input.gseId) &&
          (!input.examId || Number(row.exam_id) === input.examId) &&
          (input.status === "todos" || row.operational_status === input.status)
      );
      const company =
        rowsOf(
          await db.execute(
            drzSql`SELECT name,cnpj FROM companies WHERE id=${companyId} LIMIT 1`
          )
        )[0] || {};
      const body = rows
        .map(
          (row: any) =>
            `<tr><td>${esc(row.collaborator_name)}</td><td>${esc(row.cpf || row.employee_registration || "-")}</td><td>${esc(row.branch_name || "-")}</td><td>${esc(row.sector_name || "-")}</td><td>${esc(row.gse_code || "-")}</td><td>${esc(row.pcmso_title || "-")}</td><td>${esc(row.monitoring_kind === "avaliacao_clinica" ? "Consulta clínica" : row.exam_name)}</td><td>${esc(row.periodicity || "Definição médica")}</td><td>${esc(row.operational_status.replaceAll("_", " "))}</td></tr>`
        )
        .join("");
      const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial;color:#173047;font-size:7.5pt}h1{font-size:17pt;border-bottom:4px solid #0895a5;padding-bottom:3mm}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccd8e0;padding:2mm;text-align:left;vertical-align:top}th{background:#0e2c46;color:#fff}.meta{display:flex;justify-content:space-between;margin-bottom:4mm}.empty{text-align:center;padding:12mm}</style></head><body><h1>PROGRAMAÇÃO OCUPACIONAL</h1><div class="meta"><span><b>${esc(company.name)}</b> · CNPJ ${esc(company.cnpj || "-")}</span><span>Gerado em ${esc(new Date().toLocaleString("pt-BR"))}</span></div><p>População esperada derivada de trabalhador ativo + GSE atual + PGR + PCMSO vigente + matriz médica. Consultas clínicas aparecem como procedimento independente.</p><table><thead><tr><th>Trabalhador</th><th>Identificador</th><th>Filial</th><th>Setor</th><th>GSE</th><th>PCMSO</th><th>Procedimento</th><th>Periodicidade</th><th>Situação</th></tr></thead><tbody>${body || `<tr><td colspan="9" class="empty">Nenhum registro encontrado para os filtros informados.</td></tr>`}</tbody></table></body></html>`;
      const fileName = `programacao_ocupacional_${Date.now()}.pdf`;
      const target = await renderPdf(companyId, "programming", fileName, html);
      await audit(
        db,
        ctx,
        "occupational_programming_pdf_generated",
        "occupational_programming",
        null,
        null,
        { filters: input, total: rows.length }
      );
      return {
        fileName,
        total: rows.length,
        dataBase64: `data:application/pdf;base64,${fs.readFileSync(target).toString("base64")}`,
      };
    }),

  getOccupationalDossier: protectedProcedure
    .input(z.object({ collaboratorId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      requireOperational(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) return null;
      await requireOwnedEntity(
        db,
        companyId,
        "user",
        input.collaboratorId,
        "Colaborador"
      );
      const isDoctor = roleOf(ctx) === "medico";
      const [
        worker,
        gseHistory,
        programs,
        risks,
        orders,
        communications,
        results,
        asos,
        cats,
      ] = await Promise.all([
        db.execute(
          drzSql`SELECT u.id,u.name,u.cpf,u.employee_registration,u.position,u.email,u.whatsapp_e164 whatsapp,b.name branch_name,s.name sector_name FROM users u LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN sectors s ON s.id=u.sector_id WHERE u.id=${input.collaboratorId} AND u.company_id=${companyId} LIMIT 1`
        ),
        db.execute(
          drzSql`SELECT h.valid_from,h.valid_until,h.is_current,h.reason,h.origin,g.id gse_id,g.code gse_code,g.name gse_name FROM occupational_gse_worker_history h JOIN occupational_gse_master g ON g.id=h.gse_id WHERE h.company_id=${companyId} AND h.collaborator_id=${input.collaboratorId} ORDER BY h.valid_from DESC`
        ),
        db.execute(
          drzSql`SELECT DISTINCT p.id,p.title,p.status,p.valid_from,p.valid_until,pg.title pgr_title FROM pcmso_programs_v2 p LEFT JOIN pgr_documents pg ON pg.id=p.pgr_id AND pg.company_id=p.company_id JOIN pcmso_risk_monitoring_v2 m ON m.pcmso_id=p.id AND m.company_id=p.company_id JOIN occupational_gse_worker_history h ON h.gse_id=m.master_gse_id AND h.company_id=m.company_id AND h.collaborator_id=${input.collaboratorId} WHERE p.company_id=${companyId} ORDER BY p.updated_at DESC`
        ),
        db.execute(
          drzSql`SELECT DISTINCT m.risk_name,m.risk_type,m.risk_classification,m.monitoring_kind,m.monitoring_name,m.periodicity,e.name exam_name FROM pcmso_risk_monitoring_v2 m JOIN occupational_gse_worker_history h ON h.gse_id=m.master_gse_id AND h.company_id=m.company_id AND h.collaborator_id=${input.collaboratorId} LEFT JOIN pcmso_exam_catalog_v2 e ON e.id=m.exam_id WHERE m.company_id=${companyId} ORDER BY m.gse_name,m.risk_name`
        ),
        db.execute(
          drzSql`SELECT o.id,o.order_number,o.version_number,o.procedure_kind,o.issue_date,o.valid_until,o.status,e.name exam_name,p.trade_name provider_name FROM occupational_exam_orders o JOIN pcmso_exam_catalog_v2 e ON e.id=o.exam_id LEFT JOIN occupational_health_providers p ON p.id=o.provider_id WHERE o.company_id=${companyId} AND o.collaborator_id=${input.collaboratorId} ORDER BY o.created_at DESC`
        ),
        db.execute(
          drzSql`SELECT c.order_id,c.channel,c.recipient,c.status,c.sent_at FROM occupational_exam_order_communications c JOIN occupational_exam_orders o ON o.id=c.order_id AND o.company_id=c.company_id WHERE c.company_id=${companyId} AND o.collaborator_id=${input.collaboratorId} ORDER BY c.sent_at DESC`
        ),
        db.execute(
          drzSql`SELECT r.id,r.performed_at,r.reviewed_at,r.classification,e.name exam_name FROM occupational_exam_results r JOIN pcmso_exam_catalog_v2 e ON e.id=r.exam_id WHERE r.company_id=${companyId} AND r.collaborator_id=${input.collaboratorId} ORDER BY r.performed_at DESC`
        ),
        db.execute(
          drzSql`SELECT id,aso_type,fitness_status,status,signature_status,issued_at FROM occupational_asos WHERE company_id=${companyId} AND collaborator_id=${input.collaboratorId} ORDER BY issued_at DESC`
        ),
        db.execute(
          drzSql`SELECT id,event_at,accident_type,status,esocial_status FROM occupational_cat_records WHERE company_id=${companyId} AND collaborator_id=${input.collaboratorId} ORDER BY event_at DESC`
        ),
      ]);
      await audit(
        db,
        ctx,
        "occupational_dossier_viewed",
        "occupational_dossier",
        input.collaboratorId,
        input.collaboratorId
      );
      return {
        worker: rowsOf(worker)[0] || null,
        gseHistory: rowsOf(gseHistory),
        programs: rowsOf(programs),
        risks: rowsOf(risks),
        orders: rowsOf(orders),
        communications: rowsOf(communications),
        results: rowsOf(results).map((row: any) =>
          isDoctor
            ? row
            : {
                ...row,
                classification: row.reviewed_at
                  ? "revisado"
                  : "pendente_revisao",
              }
        ),
        asos: rowsOf(asos),
        cats: rowsOf(cats),
      };
    }),

  occupationalConformity: protectedProcedure
    .input(
      z.object({
        year: z
          .number()
          .int()
          .min(2020)
          .max(2100)
          .default(new Date().getFullYear()),
        branchId: z.number().int().positive().optional(),
        sectorId: z.number().int().positive().optional(),
        gseId: z.number().int().positive().optional(),
        position: z.string().max(255).optional(),
        examId: z.number().int().positive().optional(),
        status: z.enum(["todos", "pendente", "concluido"]).default("todos"),
      })
    )
    .query(async ({ ctx, input }) => {
      requireOperational(ctx);
      await ensureOccupationalTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) return null;
      const start = `${input.year}-01-01`;
      const end = `${input.year}-12-31`;
      const baseResult: any = await db.execute(
        drzSql.raw(`SELECT
        u.id collaborator_id,u.name collaborator_name,u.cpf,u.employee_registration,u.position,u.branch_id,u.sector_id,
        b.name branch_name,s.name sector_name,h.gse_id,g.code gse_code,g.name gse_name,
        p.id pcmso_id,p.title pcmso_title,m.id monitoring_id,m.monitoring_kind,m.exam_id,e.name exam_name,
        (SELECT MAX(r.performed_at) FROM occupational_exam_results r
          WHERE r.company_id=u.company_id AND r.collaborator_id=u.id AND r.exam_id=m.exam_id
            AND r.performed_at>='${start}' AND r.performed_at<'${input.year + 1}-01-01') latest_result_at,
        (SELECT o.status FROM occupational_exam_orders o
          WHERE o.company_id=u.company_id AND o.collaborator_id=u.id AND o.pcmso_id=p.id AND o.exam_id=m.exam_id
          ORDER BY o.created_at DESC,o.id DESC LIMIT 1) latest_order_status,
        (SELECT a.id FROM occupational_asos a
          JOIN occupational_anamneses an ON an.id=a.anamnesis_id AND an.company_id=a.company_id AND an.status='concluida'
          WHERE a.company_id=u.company_id AND a.collaborator_id=u.id AND a.pcmso_id=p.id
            AND a.status='finalizado' AND a.aso_type<>'monitoracao_pontual'
            AND a.issued_at>='${start}' AND a.issued_at<'${input.year + 1}-01-01'
          ORDER BY a.issued_at DESC,a.id DESC LIMIT 1) finalized_aso_id
        FROM users u
        JOIN occupational_gse_worker_history h ON h.company_id=u.company_id AND h.collaborator_id=u.id AND h.is_current=1
        JOIN occupational_gse_master g ON g.id=h.gse_id AND g.company_id=h.company_id
        JOIN pcmso_risk_monitoring_v2 m ON m.company_id=u.company_id AND m.master_gse_id=h.gse_id
          AND m.suggestion_status IN ('aprovada','editada')
          AND m.monitoring_kind IN ('avaliacao_clinica','exame_complementar')
        JOIN pcmso_programs_v2 p ON p.id=m.pcmso_id AND p.company_id=m.company_id AND p.status='vigente'
          AND (p.valid_from IS NULL OR p.valid_from<='${end}') AND (p.valid_until IS NULL OR p.valid_until>='${start}')
        LEFT JOIN pcmso_exam_catalog_v2 e ON e.id=m.exam_id AND e.company_id=m.company_id
        LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN sectors s ON s.id=u.sector_id
        WHERE u.company_id=${companyId} AND ${activeEmployeeSql("u")}
        ORDER BY b.name,s.name,g.code,u.name,e.name`)
      );
      const base = rowsOf(baseResult).filter(
        (row: any) =>
          (!input.branchId || Number(row.branch_id) === input.branchId) &&
          (!input.sectorId || Number(row.sector_id) === input.sectorId) &&
          (!input.gseId || Number(row.gse_id) === input.gseId) &&
          (!input.position ||
            normalizeMatch(row.position).includes(
              normalizeMatch(input.position)
            ))
      );
      const complementaryMap = new Map<string, any>();
      const clinicalMap = new Map<string, any>();
      for (const row of base) {
        if (row.monitoring_kind === "exame_complementar" && row.exam_id) {
          const key = `${row.collaborator_id}:${row.pcmso_id}:${row.exam_id}`;
          if (!complementaryMap.has(key))
            complementaryMap.set(key, {
              ...row,
              status: row.latest_result_at ? "concluido" : "pendente",
              pendingReason: row.latest_order_status
                ? `Exame sem resultado (${row.latest_order_status})`
                : "Requisição de exame ainda não gerada",
            });
        }
        const clinicalKey = `${row.collaborator_id}:${row.pcmso_id}`;
        if (!clinicalMap.has(clinicalKey))
          clinicalMap.set(clinicalKey, {
            ...row,
            exam_id: null,
            exam_name: "Avaliação clínica + anamnese + ASO",
            status: row.finalized_aso_id ? "concluido" : "pendente",
            pendingReason:
              "Anamnese concluída e ASO finalizado ainda não encontrados no exercício",
          });
      }
      const filterStatus = (row: any) =>
        input.status === "todos" || row.status === input.status;
      const complementary = [...complementaryMap.values()].filter(
        row =>
          (!input.examId || Number(row.exam_id) === input.examId) &&
          filterStatus(row)
      );
      const clinical = [...clinicalMap.values()].filter(
        row => !input.examId && filterStatus(row)
      );
      const compExpected = [...complementaryMap.values()].length;
      const compCompleted = [...complementaryMap.values()].filter(
        row => row.status === "concluido"
      ).length;
      const clinicalExpected = clinicalMap.size;
      const clinicalCompleted = [...clinicalMap.values()].filter(
        row => row.status === "concluido"
      ).length;
      return {
        year: input.year,
        summary: {
          complementaryExpected: compExpected,
          complementaryCompleted: compCompleted,
          complementaryPending: compExpected - compCompleted,
          complementaryRate: compExpected
            ? Math.round((compCompleted / compExpected) * 100)
            : 100,
          clinicalExpected,
          clinicalCompleted,
          clinicalPending: clinicalExpected - clinicalCompleted,
          clinicalRate: clinicalExpected
            ? Math.round((clinicalCompleted / clinicalExpected) * 100)
            : 100,
        },
        complementary,
        clinical,
        complementaryDefaulters: complementary.filter(
          row => row.status === "pendente"
        ),
        clinicalAsoDefaulters: clinical.filter(
          row => row.status === "pendente"
        ),
        filters: {
          branches: [
            ...new Map(
              base
                .filter(row => row.branch_id)
                .map(row => [
                  Number(row.branch_id),
                  { id: Number(row.branch_id), name: row.branch_name },
                ])
            ).values(),
          ],
          sectors: [
            ...new Map(
              base
                .filter(row => row.sector_id)
                .map(row => [
                  Number(row.sector_id),
                  { id: Number(row.sector_id), name: row.sector_name },
                ])
            ).values(),
          ],
          gses: [
            ...new Map(
              base.map(row => [
                Number(row.gse_id),
                {
                  id: Number(row.gse_id),
                  name: `${row.gse_code || ""} ${row.gse_name || ""}`.trim(),
                },
              ])
            ).values(),
          ],
          positions: [
            ...new Set(
              base.map(row => String(row.position || "")).filter(Boolean)
            ),
          ].sort(),
          exams: [
            ...new Map(
              [...complementaryMap.values()].map(row => [
                Number(row.exam_id),
                { id: Number(row.exam_id), name: row.exam_name },
              ])
            ).values(),
          ],
        },
        note: "Monitorações pontuais são históricas e não entram na meta anual de exames periódicos.",
      };
    }),

  occupationalIndicators: protectedProcedure.query(async ({ ctx }) => {
    requireOperational(ctx);
    await ensureOccupationalTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) return null;
    const summary: any = await db.execute(
      drzSql.raw(`SELECT
      (SELECT COUNT(*) FROM users u WHERE u.company_id=${companyId} AND ${activeEmployeeSql("u")}) active_workers,
      (SELECT COUNT(DISTINCT collaborator_id) FROM occupational_gse_worker_history WHERE company_id=${companyId} AND is_current=1) workers_with_gse,
      (SELECT COUNT(*) FROM occupational_exam_orders WHERE company_id=${companyId}) orders_total,
      (SELECT COUNT(*) FROM occupational_exam_orders WHERE company_id=${companyId} AND status IN ('pendente','enviada','vencida')) orders_open,
      (SELECT COUNT(*) FROM occupational_exam_results WHERE company_id=${companyId}) results_total,
      (SELECT COUNT(*) FROM occupational_exam_results WHERE company_id=${companyId} AND reviewed_at IS NOT NULL) results_reviewed,
      (SELECT COUNT(*) FROM occupational_asos WHERE company_id=${companyId}) asos_total,
      (SELECT COUNT(*) FROM occupational_cat_records WHERE company_id=${companyId}) cats_total,
      (SELECT COUNT(*) FROM occupational_health_providers WHERE company_id=${companyId} AND is_active=1) active_providers`)
    );
    const branches: any = await db.execute(
      drzSql.raw(
        `SELECT COALESCE(b.name,'Sem filial') branch_name,COUNT(DISTINCT u.id) workers,COUNT(DISTINCT o.id) orders,COUNT(DISTINCT a.id) asos FROM users u LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN occupational_exam_orders o ON o.collaborator_id=u.id AND o.company_id=u.company_id LEFT JOIN occupational_asos a ON a.collaborator_id=u.id AND a.company_id=u.company_id WHERE u.company_id=${companyId} AND ${activeEmployeeSql("u")} GROUP BY b.id,b.name HAVING COUNT(DISTINCT u.id)>=5 ORDER BY workers DESC`
      )
    );
    const bmi: any = await db.execute(
      drzSql`SELECT CASE WHEN bmi<18.5 THEN 'abaixo' WHEN bmi<25 THEN 'adequado' WHEN bmi<30 THEN 'sobrepeso' ELSE 'obesidade' END faixa,COUNT(*) total FROM occupational_anamneses WHERE company_id=${companyId} AND bmi IS NOT NULL GROUP BY faixa HAVING COUNT(*)>=5`
    );
    const row = rowsOf(summary)[0] || {};
    const active = Number(row.active_workers || 0);
    const assigned = Number(row.workers_with_gse || 0);
    const reviewed = Number(row.results_reviewed || 0);
    const resultsTotal = Number(row.results_total || 0);
    return {
      ...row,
      gseCoverage: active
        ? Math.min(100, Math.round((assigned / active) * 100))
        : 100,
      resultReviewRate: resultsTotal
        ? Math.round((reviewed / resultsTotal) * 100)
        : 100,
      branches: rowsOf(branches),
      sensitiveAggregates: rowsOf(bmi),
      privacyRule:
        "Indicadores clínicos sensíveis são agregados somente em grupos com pelo menos 5 registros.",
      conformity: {
        gse: active === assigned ? "conforme" : "atencao",
        providers: Number(row.active_providers || 0)
          ? "conforme"
          : "nao_conforme",
        orders: Number(row.orders_open || 0) ? "atencao" : "conforme",
        results: resultsTotal === reviewed ? "conforme" : "atencao",
      },
    };
  }),

  auditTrail: protectedProcedure.query(async ({ ctx }) => {
    requireOperational(ctx);
    await ensureOccupationalTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) return [];
    const result: any = await db.execute(
      drzSql`SELECT a.*,u.name actor_name,c.name collaborator_name FROM occupational_audit_log a LEFT JOIN users u ON u.id=a.actor_user_id LEFT JOIN users c ON c.id=a.collaborator_id WHERE a.company_id=${companyId} ORDER BY a.created_at DESC LIMIT 500`
    );
    return rowsOf(result);
  }),
});
