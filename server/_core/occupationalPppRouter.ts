import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { TRPCError } from "@trpc/server";
import { sql as drzSql } from "drizzle-orm";
import ExcelJS from "exceljs";
import { z } from "zod";
import { getDb } from "../db";
import { protectedProcedure, router } from "./trpc";
import {
  LABOR_EVENT_TYPES,
  LABOR_HISTORY_COLUMNS,
  LaborHistoryRow,
  laborHistoryHash,
  normalizeCpf,
  normalizeHistoryText,
  validateLaborHistoryRow,
} from "./occupationalPpp";

let tablesReady = false;

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

function companyOf(ctx: any) {
  const companyId = Number(ctx.user?.companyId || 0);
  if (!companyId)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Empresa nao identificada.",
    });
  return companyId;
}

const pppRoles = [
  "sesmt",
  "admin",
  "company_admin",
  "admin_global",
  "super_admin",
];

function requirePppAccess(ctx: any) {
  if (!pppRoles.includes(roleOf(ctx)))
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "O PPP e o historico laboral sao restritos ao SESMT e administradores autorizados.",
    });
}

export async function ensurePppTables() {
  if (tablesReady) return;
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS occupational_labor_import_batches (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    total_rows INT NOT NULL DEFAULT 0,
    imported_rows INT NOT NULL DEFAULT 0,
    rejected_rows INT NOT NULL DEFAULT 0,
    duplicate_rows INT NOT NULL DEFAULT 0,
    warnings_json LONGTEXT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'processando',
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    INDEX idx_labor_batch_company (company_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS occupational_labor_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    collaborator_id INT NOT NULL,
    import_batch_id BIGINT NULL,
    event_type VARCHAR(40) NOT NULL DEFAULT 'periodo_laboral',
    valid_from DATE NOT NULL,
    valid_until DATE NULL,
    branch_name VARCHAR(255) NULL,
    sector_name VARCHAR(255) NULL,
    position_name VARCHAR(255) NULL,
    gse_code VARCHAR(80) NULL,
    gse_name VARCHAR(255) NULL,
    activity_description MEDIUMTEXT NULL,
    risk_type VARCHAR(120) NULL,
    risk_agent_code VARCHAR(80) NULL,
    risk_agent VARCHAR(500) NULL,
    intensity_concentration VARCHAR(255) NULL,
    evaluation_technique MEDIUMTEXT NULL,
    epc_effective TINYINT(1) NULL,
    epi_effective TINYINT(1) NULL,
    epi_ca VARCHAR(255) NULL,
    exam_name VARCHAR(255) NULL,
    exam_date DATE NULL,
    fitness_status VARCHAR(80) NULL,
    source_document VARCHAR(500) NULL,
    notes MEDIUMTEXT NULL,
    origin VARCHAR(40) NOT NULL DEFAULT 'manual',
    source_row INT NULL,
    source_hash CHAR(64) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'valido',
    invalidated_by INT NULL,
    invalidated_at DATETIME NULL,
    invalidation_reason VARCHAR(500) NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_labor_history_hash (company_id, source_hash),
    INDEX idx_labor_history_worker (company_id, collaborator_id, valid_from),
    INDEX idx_labor_history_status (company_id, status, valid_from),
    INDEX idx_labor_history_batch (import_batch_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS occupational_ppp_documents (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    collaborator_id INT NOT NULL,
    version_number INT NOT NULL DEFAULT 1,
    reference_date DATE NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'espelho_consolidado',
    legal_responsible_name VARCHAR(255) NOT NULL,
    legal_responsible_cpf VARCHAR(20) NOT NULL,
    legal_responsible_role VARCHAR(180) NULL,
    environmental_responsible_name VARCHAR(255) NULL,
    environmental_responsible_registration VARCHAR(120) NULL,
    source_snapshot_json LONGTEXT NOT NULL,
    notes MEDIUMTEXT NULL,
    pdf_private_path VARCHAR(900) NOT NULL,
    generated_by INT NOT NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ppp_document_worker (company_id, collaborator_id, generated_at),
    UNIQUE KEY uq_ppp_document_version (company_id, collaborator_id, version_number)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

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
  tablesReady = true;
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

function esc(value: unknown) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    char =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ] || char
  );
}

function formatDate(value: unknown) {
  const text = String(value || "").slice(0, 10);
  if (!text) return "-";
  const parts = text.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : text;
}

function privateRoot(companyId: number) {
  const root =
    process.env.NODE_ENV === "production"
      ? "/var/www/saudedotrabalho/private/occupational"
      : path.join(process.cwd(), "private", "occupational");
  const target = path.join(root, String(companyId), "ppp");
  fs.mkdirSync(target, { recursive: true });
  return target;
}

async function renderPdf(companyId: number, name: string, html: string) {
  const target = path.join(privateRoot(companyId), name);
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

function decodeFile(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Arquivo de importacao invalido.",
    });
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > 15 * 1024 * 1024)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A planilha deve possuir no maximo 15 MB.",
    });
  return buffer;
}

async function readSpreadsheet(fileName: string, dataUrl: string) {
  const buffer = decodeFile(dataUrl);
  const workbook = new ExcelJS.Workbook();
  let worksheet: ExcelJS.Worksheet | undefined;
  if (fileName.toLowerCase().endsWith(".csv")) {
    worksheet = await workbook.csv.read(Readable.from(buffer));
  } else {
    await workbook.xlsx.load(buffer as any);
    worksheet = workbook.worksheets[0];
  }
  if (!worksheet || worksheet.rowCount < 2)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A planilha nao possui linhas de historico para importar.",
    });
  const headers: string[] = [];
  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, column) => {
    headers[column] = normalizeHistoryText(cell.value);
  });
  const rows: Array<{ sourceRow: number; values: Record<string, unknown> }> =
    [];
  worksheet.eachRow({ includeEmpty: false }, (excelRow, rowNumber) => {
    if (rowNumber === 1) return;
    const values: Record<string, unknown> = {};
    let hasValue = false;
    headers.forEach((header, column) => {
      if (!header) return;
      const value = excelRow.getCell(column).value;
      values[header] = value;
      if (normalizeHistoryText(value)) hasValue = true;
    });
    if (hasValue) rows.push({ sourceRow: rowNumber, values });
  });
  if (rows.length > 5000)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Importe no maximo 5.000 linhas por arquivo.",
    });
  return rows;
}

async function listCompanyWorkers(db: any, companyId: number) {
  const result: any = await db.execute(
    drzSql`SELECT u.id,u.name,u.cpf,u.employee_registration,u.position,b.name branch_name,s.name sector_name
      FROM users u LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN sectors s ON s.id=u.sector_id
      WHERE u.company_id=${companyId} AND COALESCE(u.counts_as_employee,1)=1
      ORDER BY u.name`
  );
  return rowsOf(result);
}

function matchWorker(row: LaborHistoryRow, workers: any[]) {
  const cpfMatch = row.cpf
    ? workers.find(worker => normalizeCpf(worker.cpf) === row.cpf)
    : null;
  const registration = row.registration.trim().toLowerCase();
  const registrationMatch = registration
    ? workers.find(
        worker =>
          String(worker.employee_registration || "")
            .trim()
            .toLowerCase() === registration
      )
    : null;
  if (
    cpfMatch &&
    registrationMatch &&
    Number(cpfMatch.id) !== Number(registrationMatch.id)
  )
    return {
      worker: null,
      error: "CPF e matricula apontam para colaboradores diferentes.",
    };
  const worker = cpfMatch || registrationMatch || null;
  return {
    worker,
    error: worker
      ? null
      : "Colaborador nao localizado nesta empresa por CPF ou matricula.",
  };
}

async function prepareImport(
  db: any,
  companyId: number,
  fileName: string,
  fileData: string
) {
  const [rawRows, workers, existingResult] = await Promise.all([
    readSpreadsheet(fileName, fileData),
    listCompanyWorkers(db, companyId),
    db.execute(
      drzSql`SELECT source_hash FROM occupational_labor_history WHERE company_id=${companyId}`
    ),
  ]);
  const existing = new Set(
    rowsOf(existingResult).map(row => String(row.source_hash))
  );
  const seenInFile = new Set<string>();
  return rawRows.map(item => {
    const validation = validateLaborHistoryRow(item.values, item.sourceRow);
    const match = matchWorker(validation.row, workers);
    const errors = [
      ...validation.errors,
      ...(match.error ? [match.error] : []),
    ];
    const hash = match.worker
      ? laborHistoryHash(companyId, Number(match.worker.id), validation.row)
      : "";
    const duplicate = Boolean(
      hash && (existing.has(hash) || seenInFile.has(hash))
    );
    if (hash) seenInFile.add(hash);
    return {
      sourceRow: item.sourceRow,
      collaboratorId: Number(match.worker?.id || 0),
      collaboratorName: String(match.worker?.name || "Nao localizado"),
      row: validation.row,
      errors,
      warnings: validation.warnings,
      hash,
      duplicate,
      valid: !errors.length && !duplicate,
    };
  });
}

async function latestLtcat(db: any, companyId: number) {
  try {
    const result: any = await db.execute(
      drzSql`SELECT id,title,status,responsible_name,responsible_profession,responsible_registration,valid_from,valid_until
        FROM technical_documents_v2 WHERE company_id=${companyId} AND document_type='ltcat'
        ORDER BY (status='vigente') DESC,updated_at DESC LIMIT 1`
    );
    return rowsOf(result)[0] || null;
  } catch {
    return null;
  }
}

async function nativeRiskHistory(
  db: any,
  companyId: number,
  collaboratorId: number
) {
  try {
    const result: any = await db.execute(
      drzSql`SELECT h.valid_from,h.valid_until,h.is_current,g.code gse_code,g.name gse_name,
        r.tipo risk_type,r.agente risk_agent,r.fonte_geradora,r.tipo_exposicao,
        d.intensidade,d.concentracao,d.unidade,d.tempo_exposicao,d.frequencia_exposicao,
        d.metodologia evaluation_technique,d.resultado_medicao,d.norma_referencia
        FROM occupational_gse_worker_history h
        JOIN occupational_gse_master g ON g.id=h.gse_id AND g.company_id=h.company_id
        LEFT JOIN occupational_gse_pgr_links l ON l.gse_id=h.gse_id AND l.company_id=h.company_id
        LEFT JOIN pgr_gse_riscos r ON r.gse_id=l.pgr_gse_id
        LEFT JOIN pgr_gse_riscos_detalhe d ON d.risco_id=r.id
        WHERE h.company_id=${companyId} AND h.collaborator_id=${collaboratorId}
        ORDER BY h.valid_from,r.tipo,r.agente`
    );
    return rowsOf(result);
  } catch {
    return [];
  }
}

function yesNo(value: unknown) {
  return value == null ? "Nao informado" : Number(value) ? "Sim" : "Nao";
}

function eventLabel(value: unknown) {
  const labels: Record<string, string> = {
    admissao: "Admissao",
    periodo_laboral: "Periodo laboral",
    mudanca_funcao: "Mudanca de funcao",
    transferencia: "Transferencia",
    exposicao: "Exposicao",
    exame: "Exame ocupacional",
    afastamento: "Afastamento",
    desligamento: "Desligamento",
    outro: "Outro",
    gse: "Vinculo com GSE",
    aso: "ASO",
    resultado_exame: "Exame registrado",
    cat: "CAT",
  };
  return (
    labels[String(value || "")] ||
    String(value || "Evento").replaceAll("_", " ")
  );
}

export const occupationalPppRouter = router({
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    requirePppAccess(ctx);
    await ensurePppTables();
    const db = await getDb();
    const companyId = companyOf(ctx);
    if (!db) return null;
    const [history, documents, batches, employees] = await Promise.all([
      db.execute(
        drzSql`SELECT COUNT(*) events,COUNT(DISTINCT collaborator_id) workers,SUM(status='invalidado') invalidated
          FROM occupational_labor_history WHERE company_id=${companyId}`
      ),
      db.execute(
        drzSql`SELECT COUNT(*) total,COUNT(DISTINCT collaborator_id) workers FROM occupational_ppp_documents WHERE company_id=${companyId}`
      ),
      db.execute(
        drzSql`SELECT COUNT(*) total,COALESCE(SUM(rejected_rows),0) rejected FROM occupational_labor_import_batches WHERE company_id=${companyId}`
      ),
      db.execute(
        drzSql`SELECT COUNT(*) total FROM users WHERE company_id=${companyId} AND COALESCE(counts_as_employee,1)=1`
      ),
    ]);
    return {
      historyEvents: Number(rowsOf(history)[0]?.events || 0),
      workersWithHistory: Number(rowsOf(history)[0]?.workers || 0),
      invalidatedEvents: Number(rowsOf(history)[0]?.invalidated || 0),
      generatedPpps: Number(rowsOf(documents)[0]?.total || 0),
      workersWithPpp: Number(rowsOf(documents)[0]?.workers || 0),
      importBatches: Number(rowsOf(batches)[0]?.total || 0),
      rejectedRows: Number(rowsOf(batches)[0]?.rejected || 0),
      employees: Number(rowsOf(employees)[0]?.total || 0),
    };
  }),

  listWorkers: protectedProcedure.query(async ({ ctx }) => {
    requirePppAccess(ctx);
    await ensurePppTables();
    const db = await getDb();
    if (!db) return [];
    return listCompanyWorkers(db, companyOf(ctx));
  }),

  getImportTemplate: protectedProcedure.mutation(async ({ ctx }) => {
    requirePppAccess(ctx);
    await ensurePppTables();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Plataforma Saude do Trabalho";
    const sheet = workbook.addWorksheet("Historico Laboral", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    sheet.columns = LABOR_HISTORY_COLUMNS.map((header, index) => ({
      header,
      key: `c${index}`,
      width: index < 5 ? 18 : index < 12 ? 24 : 20,
    }));
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0A8190" },
    };
    sheet.addRow([
      "52998224725",
      "MAT-001",
      "01/02/2018",
      "31/12/2022",
      "Periodo laboral",
      "Matriz",
      "Producao",
      "Operador de Maquinas",
      "GSE-001",
      "Operacao Industrial",
      "Operacao e acompanhamento de equipamentos",
      "Fisico",
      "02.01.001",
      "Ruido continuo ou intermitente",
      "86 dB(A)",
      "NHO-01 / dosimetria",
      "Sim",
      "Sim",
      "12345",
      "Audiometria",
      "10/02/2022",
      "Apto",
      "LTCAT 2022",
      "Linha ficticia: excluir antes da importacao real",
    ]);
    for (let row = 2; row <= 500; row++) {
      sheet.getCell(row, 5).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${LABOR_EVENT_TYPES.join(",")}"`],
      };
      for (const column of [17, 18])
        sheet.getCell(row, column).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: ['"Sim,Nao"'],
        };
    }
    sheet.autoFilter = { from: "A1", to: "X1" };
    const instructions = workbook.addWorksheet("Instrucoes");
    instructions.columns = [{ width: 32 }, { width: 110 }];
    instructions.addRows([
      [
        "Objetivo",
        "Importar periodos e eventos anteriores a implantacao da plataforma para formar a linha do tempo laboral e apoiar a consolidacao do PPP.",
      ],
      [
        "Identificacao",
        "Informe CPF ou matricula. Se ambos forem informados, devem pertencer ao mesmo colaborador da empresa.",
      ],
      [
        "Granularidade",
        "Use uma linha para cada periodo, agente de risco ou exame que precise ser preservado separadamente.",
      ],
      [
        "Datas",
        "Use DD/MM/AAAA. Data Inicio e obrigatoria. Data Fim pode ficar vazia para periodo ainda vigente.",
      ],
      [
        "Agentes",
        "Quando houver exposicao previdenciaria, informe o codigo oficial aplicavel da Tabela 24 do eSocial. A plataforma nao inventa nem presume codigos.",
      ],
      [
        "EPI e EPC",
        "Informe a eficacia conforme o documento tecnico de origem. Nao use a planilha para substituir LTCAT, PGR, comprovantes ou registros de entrega.",
      ],
      [
        "Conferencia",
        "A importacao possui pre-visualizacao. Linhas invalidas nao sao gravadas; duplicidades sao bloqueadas pelo hash do registro.",
      ],
      [
        "PPP eletronico",
        "Para periodos a partir de 01/01/2023, o PPP oficial e formado pelas informacoes de SST enviadas ao eSocial. O PDF da plataforma e um espelho consolidado para conferencia enquanto nao houver transmissao oficial integrada.",
      ],
    ]);
    instructions.getColumn(2).alignment = { wrapText: true, vertical: "top" };
    const buffer = await workbook.xlsx.writeBuffer();
    await audit(db, ctx, "ppp_import_template_downloaded", "labor_history");
    return {
      fileName: "modelo_importacao_historico_laboral_ppp.xlsx",
      dataBase64: `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${Buffer.from(buffer).toString("base64")}`,
    };
  }),

  previewImport: protectedProcedure
    .input(
      z.object({
        fileName: z.string().min(1).max(255),
        fileData: z.string().min(20).max(25_000_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requirePppAccess(ctx);
      await ensurePppTables();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const prepared = await prepareImport(
        db,
        companyOf(ctx),
        input.fileName,
        input.fileData
      );
      return {
        total: prepared.length,
        valid: prepared.filter(row => row.valid).length,
        invalid: prepared.filter(row => row.errors.length).length,
        duplicates: prepared.filter(row => row.duplicate).length,
        rows: prepared.slice(0, 500).map(item => ({
          sourceRow: item.sourceRow,
          collaboratorId: item.collaboratorId,
          collaboratorName: item.collaboratorName,
          validFrom: item.row.validFrom,
          validUntil: item.row.validUntil,
          eventType: item.row.eventType,
          positionName: item.row.positionName,
          gseName: item.row.gseName,
          riskAgent: item.row.riskAgent,
          examName: item.row.examName,
          errors: item.errors,
          warnings: item.warnings,
          duplicate: item.duplicate,
          valid: item.valid,
        })),
        truncated: prepared.length > 500,
      };
    }),

  confirmImport: protectedProcedure
    .input(
      z.object({
        fileName: z.string().min(1).max(255),
        fileData: z.string().min(20).max(25_000_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requirePppAccess(ctx);
      await ensurePppTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const prepared = await prepareImport(
        db,
        companyId,
        input.fileName,
        input.fileData
      );
      const batchResult: any = await db.execute(
        drzSql`INSERT INTO occupational_labor_import_batches
          (company_id,file_name,total_rows,created_by)
          VALUES (${companyId},${input.fileName},${prepared.length},${Number(ctx.user.id)})`
      );
      const batchId = Number((batchResult as any)[0]?.insertId || 0);
      let imported = 0;
      let failed = 0;
      const rejected = prepared.filter(item => item.errors.length);
      const duplicates = prepared.filter(item => item.duplicate);
      for (const item of prepared.filter(item => item.valid)) {
        const row = item.row;
        try {
          await db.execute(drzSql`INSERT INTO occupational_labor_history
            (company_id,collaborator_id,import_batch_id,event_type,valid_from,valid_until,branch_name,sector_name,position_name,gse_code,gse_name,activity_description,risk_type,risk_agent_code,risk_agent,intensity_concentration,evaluation_technique,epc_effective,epi_effective,epi_ca,exam_name,exam_date,fitness_status,source_document,notes,origin,source_row,source_hash,created_by)
            VALUES (${companyId},${item.collaboratorId},${batchId},${row.eventType},${row.validFrom},${row.validUntil},${row.branchName || null},${row.sectorName || null},${row.positionName || null},${row.gseCode || null},${row.gseName || null},${row.activityDescription || null},${row.riskType || null},${row.riskAgentCode || null},${row.riskAgent || null},${row.intensityConcentration || null},${row.evaluationTechnique || null},${row.epcEffective},${row.epiEffective},${row.epiCa || null},${row.examName || null},${row.examDate},${row.fitnessStatus || null},${row.sourceDocument || null},${row.notes || null},'excel',${row.sourceRow},${item.hash},${Number(ctx.user.id)})`);
          imported++;
        } catch {
          failed++;
        }
      }
      const rejectedCount = rejected.length + failed;
      const warnings = prepared
        .filter(item => item.warnings.length || item.errors.length)
        .slice(0, 1000)
        .map(item => ({
          row: item.sourceRow,
          errors: item.errors,
          warnings: item.warnings,
        }));
      await db.execute(drzSql`UPDATE occupational_labor_import_batches SET
        imported_rows=${imported},rejected_rows=${rejectedCount},duplicate_rows=${duplicates.length},
        warnings_json=${JSON.stringify(warnings)},status='concluido',completed_at=NOW()
        WHERE id=${batchId} AND company_id=${companyId}`);
      await audit(
        db,
        ctx,
        "labor_history_imported",
        "labor_import_batch",
        batchId,
        null,
        {
          fileName: input.fileName,
          total: prepared.length,
          imported,
          rejected: rejectedCount,
          duplicates: duplicates.length,
        }
      );
      return {
        ok: true,
        batchId,
        total: prepared.length,
        imported,
        rejected: rejectedCount,
        duplicates: duplicates.length,
      };
    }),

  createManualEvent: protectedProcedure
    .input(
      z.object({
        collaboratorId: z.number().int().positive(),
        eventType: z.enum(LABOR_EVENT_TYPES),
        validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        validUntil: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable()
          .optional(),
        branchName: z.string().max(255).optional(),
        sectorName: z.string().max(255).optional(),
        positionName: z.string().max(255).optional(),
        gseCode: z.string().max(80).optional(),
        gseName: z.string().max(255).optional(),
        activityDescription: z.string().max(20000).optional(),
        riskType: z.string().max(120).optional(),
        riskAgentCode: z.string().max(80).optional(),
        riskAgent: z.string().max(500).optional(),
        intensityConcentration: z.string().max(255).optional(),
        evaluationTechnique: z.string().max(20000).optional(),
        epcEffective: z.boolean().nullable().optional(),
        epiEffective: z.boolean().nullable().optional(),
        epiCa: z.string().max(255).optional(),
        examName: z.string().max(255).optional(),
        examDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable()
          .optional(),
        fitnessStatus: z.string().max(80).optional(),
        sourceDocument: z.string().max(500).optional(),
        notes: z.string().max(20000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requirePppAccess(ctx);
      await ensurePppTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const workerResult: any = await db.execute(
        drzSql`SELECT id,name,cpf,employee_registration FROM users WHERE id=${input.collaboratorId} AND company_id=${companyId} LIMIT 1`
      );
      const worker = rowsOf(workerResult)[0];
      if (!worker)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Colaborador nao encontrado.",
        });
      const row: LaborHistoryRow = {
        sourceRow: 0,
        cpf: normalizeCpf(worker.cpf),
        registration: String(worker.employee_registration || ""),
        validFrom: input.validFrom,
        validUntil: input.validUntil || null,
        eventType: input.eventType,
        branchName: input.branchName || "",
        sectorName: input.sectorName || "",
        positionName: input.positionName || "",
        gseCode: input.gseCode || "",
        gseName: input.gseName || "",
        activityDescription: input.activityDescription || "",
        riskType: input.riskType || "",
        riskAgentCode: input.riskAgentCode || "",
        riskAgent: input.riskAgent || "",
        intensityConcentration: input.intensityConcentration || "",
        evaluationTechnique: input.evaluationTechnique || "",
        epcEffective: input.epcEffective ?? null,
        epiEffective: input.epiEffective ?? null,
        epiCa: input.epiCa || "",
        examName: input.examName || "",
        examDate: input.examDate || null,
        fitnessStatus: input.fitnessStatus || "",
        sourceDocument: input.sourceDocument || "",
        notes: input.notes || "",
      };
      if (row.validUntil && row.validUntil < row.validFrom)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Data final anterior a data inicial.",
        });
      const hash = laborHistoryHash(companyId, input.collaboratorId, row);
      try {
        const result: any =
          await db.execute(drzSql`INSERT INTO occupational_labor_history
          (company_id,collaborator_id,event_type,valid_from,valid_until,branch_name,sector_name,position_name,gse_code,gse_name,activity_description,risk_type,risk_agent_code,risk_agent,intensity_concentration,evaluation_technique,epc_effective,epi_effective,epi_ca,exam_name,exam_date,fitness_status,source_document,notes,origin,source_hash,created_by)
          VALUES (${companyId},${input.collaboratorId},${row.eventType},${row.validFrom},${row.validUntil},${row.branchName || null},${row.sectorName || null},${row.positionName || null},${row.gseCode || null},${row.gseName || null},${row.activityDescription || null},${row.riskType || null},${row.riskAgentCode || null},${row.riskAgent || null},${row.intensityConcentration || null},${row.evaluationTechnique || null},${row.epcEffective},${row.epiEffective},${row.epiCa || null},${row.examName || null},${row.examDate},${row.fitnessStatus || null},${row.sourceDocument || null},${row.notes || null},'manual',${hash},${Number(ctx.user.id)})`);
        const id = Number((result as any)[0]?.insertId || 0);
        await audit(
          db,
          ctx,
          "labor_history_event_created",
          "labor_history",
          id,
          input.collaboratorId
        );
        return { ok: true, id };
      } catch {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Este evento ja existe no historico laboral do colaborador.",
        });
      }
    }),

  invalidateEvent: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        reason: z.string().min(5).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requirePppAccess(ctx);
      await ensurePppTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const own: any = await db.execute(
        drzSql`SELECT id,collaborator_id,status FROM occupational_labor_history WHERE id=${input.id} AND company_id=${companyId} LIMIT 1`
      );
      const row = rowsOf(own)[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      if (row.status === "invalidado")
        throw new TRPCError({
          code: "CONFLICT",
          message: "O evento ja esta invalidado.",
        });
      await db.execute(drzSql`UPDATE occupational_labor_history SET
        status='invalidado',invalidated_by=${Number(ctx.user.id)},invalidated_at=NOW(),invalidation_reason=${input.reason}
        WHERE id=${input.id} AND company_id=${companyId}`);
      await audit(
        db,
        ctx,
        "labor_history_event_invalidated",
        "labor_history",
        input.id,
        Number(row.collaborator_id),
        {
          reason: input.reason,
        }
      );
      return { ok: true };
    }),

  listTimeline: protectedProcedure
    .input(z.object({ collaboratorId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      requirePppAccess(ctx);
      await ensurePppTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) return null;
      const [workerResult, imported, gse, exams, asos, cats] =
        await Promise.all([
          db.execute(
            drzSql`SELECT u.id,u.name,u.cpf,u.employee_registration,u.position,b.name branch_name,s.name sector_name
            FROM users u LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN sectors s ON s.id=u.sector_id
            WHERE u.id=${input.collaboratorId} AND u.company_id=${companyId} LIMIT 1`
          ),
          db.execute(
            drzSql`SELECT * FROM occupational_labor_history WHERE company_id=${companyId} AND collaborator_id=${input.collaboratorId} ORDER BY valid_from DESC,id DESC`
          ),
          db.execute(
            drzSql`SELECT h.id,h.valid_from,h.valid_until,h.is_current,h.reason,h.origin,g.code gse_code,g.name gse_name
            FROM occupational_gse_worker_history h JOIN occupational_gse_master g ON g.id=h.gse_id
            WHERE h.company_id=${companyId} AND h.collaborator_id=${input.collaboratorId} ORDER BY h.valid_from DESC`
          ),
          db.execute(
            drzSql`SELECT r.id,r.performed_at,r.classification,e.name exam_name
            FROM occupational_exam_results r JOIN pcmso_exam_catalog_v2 e ON e.id=r.exam_id
            WHERE r.company_id=${companyId} AND r.collaborator_id=${input.collaboratorId} ORDER BY r.performed_at DESC`
          ),
          db.execute(
            drzSql`SELECT id,aso_type,fitness_status,status,issued_at FROM occupational_asos
            WHERE company_id=${companyId} AND collaborator_id=${input.collaboratorId} ORDER BY issued_at DESC`
          ),
          db.execute(
            drzSql`SELECT id,event_at,accident_type,status FROM occupational_cat_records
            WHERE company_id=${companyId} AND collaborator_id=${input.collaboratorId} ORDER BY event_at DESC`
          ),
        ]);
      const worker = rowsOf(workerResult)[0];
      if (!worker)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Colaborador nao encontrado.",
        });
      const events = [
        ...rowsOf(imported).map(row => ({
          id: `historico-${row.id}`,
          recordId: Number(row.id),
          date: String(row.valid_from),
          endDate: row.valid_until ? String(row.valid_until) : null,
          type: row.event_type,
          label: eventLabel(row.event_type),
          title:
            row.position_name ||
            row.risk_agent ||
            row.exam_name ||
            row.gse_name ||
            eventLabel(row.event_type),
          description: [
            row.branch_name,
            row.sector_name,
            row.gse_name,
            row.risk_agent,
            row.exam_name,
          ]
            .filter(Boolean)
            .join(" | "),
          origin: row.origin,
          status: row.status,
          sourceDocument: row.source_document,
          notes: row.notes,
          canInvalidate: row.status === "valido",
        })),
        ...rowsOf(gse).map(row => ({
          id: `gse-${row.id}`,
          date: String(row.valid_from),
          endDate: row.valid_until ? String(row.valid_until) : null,
          type: "gse",
          label: eventLabel("gse"),
          title: `${row.gse_code} - ${row.gse_name}`,
          description: row.reason,
          origin: `plataforma:${row.origin}`,
          status: row.is_current ? "atual" : "encerrado",
          canInvalidate: false,
        })),
        ...rowsOf(exams).map(row => ({
          id: `exame-${row.id}`,
          date: String(row.performed_at),
          endDate: null,
          type: "resultado_exame",
          label: eventLabel("resultado_exame"),
          title: row.exam_name,
          description: row.classification,
          origin: "plataforma",
          status: "registrado",
          canInvalidate: false,
        })),
        ...rowsOf(asos).map(row => ({
          id: `aso-${row.id}`,
          date: String(row.issued_at),
          endDate: null,
          type: "aso",
          label: eventLabel("aso"),
          title: `ASO ${String(row.aso_type || "").replaceAll("_", " ")}`,
          description: `Aptidao: ${row.fitness_status || "nao informada"}`,
          origin: "plataforma",
          status: row.status,
          canInvalidate: false,
        })),
        ...rowsOf(cats).map(row => ({
          id: `cat-${row.id}`,
          date: String(row.event_at),
          endDate: null,
          type: "cat",
          label: eventLabel("cat"),
          title: row.accident_type || "Comunicacao de acidente",
          description: "Registro ocupacional vinculado ao colaborador",
          origin: "plataforma",
          status: row.status,
          canInvalidate: false,
        })),
      ].sort((a, b) => String(b.date).localeCompare(String(a.date)));
      await audit(
        db,
        ctx,
        "labor_timeline_viewed",
        "labor_timeline",
        null,
        input.collaboratorId
      );
      return { worker, events };
    }),

  listDocuments: protectedProcedure
    .input(z.object({ collaboratorId: z.number().int().positive().optional() }))
    .query(async ({ ctx, input }) => {
      requirePppAccess(ctx);
      await ensurePppTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) return [];
      const result: any = input.collaboratorId
        ? await db.execute(
            drzSql`SELECT d.id,d.collaborator_id,d.version_number,d.reference_date,d.status,d.legal_responsible_name,d.generated_at,u.name collaborator_name,u.cpf,u.employee_registration
              FROM occupational_ppp_documents d JOIN users u ON u.id=d.collaborator_id
              WHERE d.company_id=${companyId} AND d.collaborator_id=${input.collaboratorId}
              ORDER BY d.generated_at DESC`
          )
        : await db.execute(
            drzSql`SELECT d.id,d.collaborator_id,d.version_number,d.reference_date,d.status,d.legal_responsible_name,d.generated_at,u.name collaborator_name,u.cpf,u.employee_registration
              FROM occupational_ppp_documents d JOIN users u ON u.id=d.collaborator_id
              WHERE d.company_id=${companyId} ORDER BY d.generated_at DESC LIMIT 1000`
          );
      return rowsOf(result);
    }),

  generatePpp: protectedProcedure
    .input(
      z.object({
        collaboratorId: z.number().int().positive(),
        referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        legalResponsibleName: z.string().min(3).max(255),
        legalResponsibleCpf: z.string().min(11).max(20),
        legalResponsibleRole: z.string().max(180).optional(),
        notes: z.string().max(20000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requirePppAccess(ctx);
      await ensurePppTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [
        workerResult,
        companyResult,
        importedResult,
        asoResult,
        ltcat,
        nativeRisks,
      ] = await Promise.all([
        db.execute(
          drzSql`SELECT u.id,u.name,u.cpf,u.employee_registration,u.position,b.name branch_name,s.name sector_name
              FROM users u LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN sectors s ON s.id=u.sector_id
              WHERE u.id=${input.collaboratorId} AND u.company_id=${companyId} LIMIT 1`
        ),
        db.execute(
          drzSql`SELECT id,name,cnpj,address FROM companies WHERE id=${companyId} LIMIT 1`
        ),
        db.execute(
          drzSql`SELECT * FROM occupational_labor_history
              WHERE company_id=${companyId} AND collaborator_id=${input.collaboratorId} AND status='valido' AND valid_from<=${input.referenceDate}
              ORDER BY valid_from,id`
        ),
        db.execute(
          drzSql`SELECT id,aso_type,fitness_status,issued_at,doctor_crm FROM occupational_asos
              WHERE company_id=${companyId} AND collaborator_id=${input.collaboratorId} AND DATE(issued_at)<=${input.referenceDate}
              ORDER BY issued_at`
        ),
        latestLtcat(db, companyId),
        nativeRiskHistory(db, companyId, input.collaboratorId),
      ]);
      const worker = rowsOf(workerResult)[0];
      const company = rowsOf(companyResult)[0];
      if (!worker || !company)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Empresa ou colaborador nao encontrado.",
        });
      if (normalizeCpf(input.legalResponsibleCpf).length !== 11)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Informe um CPF com 11 digitos para o representante legal ou preposto.",
        });
      const imported = rowsOf(importedResult);
      const asos = rowsOf(asoResult);
      const versionResult: any = await db.execute(
        drzSql`SELECT COALESCE(MAX(version_number),0)+1 next_version FROM occupational_ppp_documents
          WHERE company_id=${companyId} AND collaborator_id=${input.collaboratorId}`
      );
      const version = Number(rowsOf(versionResult)[0]?.next_version || 1);
      const periodsHtml = imported.length
        ? imported
            .map(
              row =>
                `<tr><td>${formatDate(row.valid_from)} a ${row.valid_until ? formatDate(row.valid_until) : "atual"}</td><td>${esc(row.branch_name || "-")}<br>${esc(row.sector_name || "-")}</td><td>${esc(row.position_name || "-")}</td><td>${esc([row.gse_code, row.gse_name].filter(Boolean).join(" - ") || "-")}</td><td>${esc(row.activity_description || eventLabel(row.event_type))}</td><td>${esc(row.source_document || row.origin)}</td></tr>`
            )
            .join("")
        : '<tr><td colspan="6">Nenhum periodo historico importado. Os vinculos nativos aparecem nos registros ambientais abaixo.</td></tr>';
      const importedRisks = imported.filter(row => row.risk_agent);
      const referenceDate = String(input.referenceDate).slice(0, 10);
      const nativeRisksAtReference = nativeRisks.filter(row => {
        const start = String(row.valid_from || "").slice(0, 10);
        const end = String(row.valid_until || "").slice(0, 10);
        return (
          (!start || start <= referenceDate) && (!end || end >= referenceDate)
        );
      });
      const environmentalRows = [
        ...importedRisks.map(row => ({
          period: `${formatDate(row.valid_from)} a ${row.valid_until ? formatDate(row.valid_until) : "atual"}`,
          gse: [row.gse_code, row.gse_name].filter(Boolean).join(" - "),
          type: row.risk_type,
          code: row.risk_agent_code,
          agent: row.risk_agent,
          intensity: row.intensity_concentration,
          technique: row.evaluation_technique,
          epc: yesNo(row.epc_effective),
          epi: yesNo(row.epi_effective),
          ca: row.epi_ca,
          source: row.source_document || "Importacao historica",
        })),
        ...nativeRisksAtReference
          .filter(row => row.risk_agent)
          .map(row => ({
            period: `${formatDate(row.valid_from)} a ${row.valid_until ? formatDate(row.valid_until) : row.is_current ? "atual" : "-"}`,
            gse: [row.gse_code, row.gse_name].filter(Boolean).join(" - "),
            type: row.risk_type,
            code: "",
            agent: row.risk_agent,
            intensity: [row.intensidade, row.concentracao, row.unidade]
              .filter(Boolean)
              .join(" "),
            technique: row.evaluation_technique || row.norma_referencia,
            epc: "Consultar PGR/LTCAT",
            epi: "Consultar PGR/LTCAT",
            ca: "",
            source: ltcat?.title || "PGR/GSE da plataforma",
          })),
      ];
      const environmentalHtml = environmentalRows.length
        ? environmentalRows
            .map(
              row =>
                `<tr><td>${esc(row.period)}</td><td>${esc(row.gse || "-")}</td><td>${esc(row.type || "-")}</td><td>${esc(row.code || "-")}<br><b>${esc(row.agent)}</b></td><td>${esc(row.intensity || "-")}</td><td>${esc(row.technique || "-")}</td><td>EPC: ${esc(row.epc)}<br>EPI: ${esc(row.epi)}${row.ca ? `<br>CA: ${esc(row.ca)}` : ""}</td><td>${esc(row.source)}</td></tr>`
            )
            .join("")
        : '<tr><td colspan="8">Nenhum agente registrado. Antes da emissao oficial, conferir a existencia do codigo de ausencia de fator de risco ou dos agentes aplicaveis no eSocial.</td></tr>';
      const exams = [
        ...imported
          .filter(row => row.exam_name)
          .map(row => ({
            date: row.exam_date || row.valid_from,
            name: row.exam_name,
            fitness: row.fitness_status,
            source: row.source_document || "Importacao historica",
          })),
        ...asos.map(row => ({
          date: row.issued_at,
          name: `ASO ${String(row.aso_type || "").replaceAll("_", " ")}`,
          fitness: row.fitness_status,
          source: `Plataforma${row.doctor_crm ? ` - ${row.doctor_crm}` : ""}`,
        })),
      ];
      const examsHtml = exams.length
        ? exams
            .map(
              row =>
                `<tr><td>${formatDate(row.date)}</td><td>${esc(row.name)}</td><td>${esc(row.fitness || "Nao informado")}</td><td>${esc(row.source)}</td></tr>`
            )
            .join("")
        : '<tr><td colspan="4">Nenhum registro de monitoramento ocupacional localizado.</td></tr>';
      const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
        @page{size:A4;margin:15mm 12mm}body{font-family:Arial,sans-serif;color:#173047;font-size:8.2pt;line-height:1.35}h1{font-size:20pt;color:#0e2c46;margin:0}h2{font-size:11.5pt;color:#0e2c46;border-bottom:2px solid #0895a5;padding-bottom:1.5mm;margin-top:7mm}h3{font-size:9.5pt;color:#0e2c46}table{width:100%;border-collapse:collapse;margin:2mm 0 5mm;font-size:6.7pt}th,td{border:1px solid #cbd8df;padding:1.6mm;vertical-align:top}th{background:#0e2c46;color:#fff}.cover{height:245mm;display:flex;flex-direction:column;justify-content:center;text-align:center;page-break-after:always}.tag{display:inline-block;background:#e5f5f6;color:#087583;padding:2mm 4mm;font-weight:bold}.notice{background:#fff8dd;border-left:4px solid #d3a000;padding:3mm;margin:4mm 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:2mm 7mm}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:15mm;margin-top:18mm}.line{border-top:1px solid #173047;padding-top:2mm;text-align:center}.footer{font-size:6.5pt;color:#647789;margin-top:8mm;border-top:1px solid #d7e1e7;padding-top:2mm}</style></head><body>
        <section class="cover"><h1>PPP</h1><h2>Perfil Profissiografico Previdenciario</h2><p><b>${esc(company.name)}</b><br>${esc(worker.name)}</p><p class="tag">Espelho consolidado para conferencia - versao ${version}</p><p>Data de referencia: ${formatDate(input.referenceDate)}</p></section>
        <div class="notice"><b>Natureza deste documento:</b> espelho consolidado produzido com dados importados e registros da plataforma. Para periodos a partir de 01/01/2023, o PPP oficial e disponibilizado eletronicamente a partir dos eventos de SST transmitidos ao eSocial. Este arquivo nao substitui protocolo, recibo ou documento oficial do eSocial/INSS.</div>
        <h2>1. Identificacao do empregador e do trabalhador</h2><div class="grid"><div><b>Empresa:</b> ${esc(company.name)}</div><div><b>CNPJ:</b> ${esc(company.cnpj || "-")}</div><div><b>Endereco:</b> ${esc(company.address || "-")}</div><div><b>Trabalhador:</b> ${esc(worker.name)}</div><div><b>CPF:</b> ${esc(worker.cpf || "-")}</div><div><b>Matricula:</b> ${esc(worker.employee_registration || "-")}</div><div><b>Cargo atual:</b> ${esc(worker.position || "-")}</div><div><b>Lotacao atual:</b> ${esc([worker.branch_name, worker.sector_name].filter(Boolean).join(" / ") || "-")}</div></div>
        <h2>2. Historico laboral anterior importado</h2><table><thead><tr><th>Periodo</th><th>Filial / Setor</th><th>Cargo / Funcao</th><th>GSE / GHE</th><th>Atividade / Evento</th><th>Fonte</th></tr></thead><tbody>${periodsHtml}</tbody></table>
        <h2>3. Registros ambientais e exposicoes</h2><table><thead><tr><th>Periodo</th><th>GSE/GHE</th><th>Tipo</th><th>Codigo / Agente</th><th>Intensidade</th><th>Tecnica</th><th>Protecao</th><th>Fonte</th></tr></thead><tbody>${environmentalHtml}</tbody></table>
        <h2>4. Monitoramento ocupacional consolidado</h2><table><thead><tr><th>Data</th><th>Registro</th><th>Aptidao/Situacao</th><th>Origem</th></tr></thead><tbody>${examsHtml}</tbody></table>
        <h2>5. Demonstracoes ambientais e responsaveis</h2><div class="grid"><div><b>LTCAT de referencia:</b> ${esc(ltcat?.title || "Nao vinculado")}</div><div><b>Vigencia:</b> ${ltcat ? `${formatDate(ltcat.valid_from)} a ${formatDate(ltcat.valid_until)}` : "-"}</div><div><b>Responsavel pelos registros ambientais:</b> ${esc(ltcat?.responsible_name || "Nao informado")}</div><div><b>Registro profissional:</b> ${esc(ltcat?.responsible_registration || "-")}</div><div><b>Representante legal/preposto:</b> ${esc(input.legalResponsibleName)}</div><div><b>CPF:</b> ${esc(normalizeCpf(input.legalResponsibleCpf))}</div><div><b>Cargo:</b> ${esc(input.legalResponsibleRole || "-")}</div><div><b>Emissao:</b> ${formatDate(new Date().toISOString().slice(0, 10))}</div></div>
        ${input.notes ? `<h2>6. Observacoes de consolidacao</h2><p>${esc(input.notes)}</p>` : ""}
        <div class="signatures"><div class="line"><b>${esc(input.legalResponsibleName)}</b><br>${esc(input.legalResponsibleRole || "Representante legal ou preposto")}</div><div class="line"><b>${esc(ltcat?.responsible_name || "Responsavel pelos registros ambientais")}</b><br>${esc(ltcat?.responsible_registration || "Registro profissional")}</div></div>
        <div class="footer">Gerado pela Plataforma Saude do Trabalho em ${esc(new Date().toLocaleString("pt-BR"))}. Fontes: historico laboral importado, GSE/PGR, LTCAT e registros ocupacionais disponiveis na data de referencia. Toda emissao deve ser conferida pelo responsavel autorizado.</div>
      </body></html>`;
      const fileName = `ppp_${input.collaboratorId}_v${version}_${Date.now()}.pdf`;
      const target = await renderPdf(companyId, fileName, html);
      const snapshot = {
        worker,
        company,
        imported,
        nativeRisks: nativeRisksAtReference,
        asos,
        ltcat,
        referenceDate: input.referenceDate,
        generatedAt: new Date().toISOString(),
      };
      const documentResult: any = await db.execute(
        drzSql`INSERT INTO occupational_ppp_documents
          (company_id,collaborator_id,version_number,reference_date,status,legal_responsible_name,legal_responsible_cpf,legal_responsible_role,environmental_responsible_name,environmental_responsible_registration,source_snapshot_json,notes,pdf_private_path,generated_by)
          VALUES (${companyId},${input.collaboratorId},${version},${input.referenceDate},'espelho_consolidado',${input.legalResponsibleName},${normalizeCpf(input.legalResponsibleCpf)},${input.legalResponsibleRole || null},${ltcat?.responsible_name || null},${ltcat?.responsible_registration || null},${JSON.stringify(snapshot)},${input.notes || null},${target},${Number(ctx.user.id)})`
      );
      const id = Number((documentResult as any)[0]?.insertId || 0);
      await audit(
        db,
        ctx,
        "ppp_consolidated_generated",
        "ppp_document",
        id,
        input.collaboratorId,
        {
          version,
          referenceDate: input.referenceDate,
          importedPeriods: imported.length,
          environmentalRecords: environmentalRows.length,
          monitoringRecords: exams.length,
        }
      );
      return {
        ok: true,
        id,
        version,
        fileName,
        dataBase64: `data:application/pdf;base64,${fs.readFileSync(target).toString("base64")}`,
      };
    }),

  getDocument: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requirePppAccess(ctx);
      await ensurePppTables();
      const db = await getDb();
      const companyId = companyOf(ctx);
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result: any = await db.execute(
        drzSql`SELECT id,collaborator_id,version_number,pdf_private_path FROM occupational_ppp_documents WHERE id=${input.id} AND company_id=${companyId} LIMIT 1`
      );
      const row = rowsOf(result)[0];
      if (!row || !fs.existsSync(String(row.pdf_private_path || "")))
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Documento PPP nao localizado.",
        });
      await audit(
        db,
        ctx,
        "ppp_document_downloaded",
        "ppp_document",
        input.id,
        Number(row.collaborator_id)
      );
      return {
        fileName: `ppp_${row.collaborator_id}_v${row.version_number}.pdf`,
        dataBase64: `data:application/pdf;base64,${fs.readFileSync(row.pdf_private_path).toString("base64")}`,
      };
    }),

  listImports: protectedProcedure.query(async ({ ctx }) => {
    requirePppAccess(ctx);
    await ensurePppTables();
    const db = await getDb();
    if (!db) return [];
    const result: any = await db.execute(
      drzSql`SELECT id,file_name,total_rows,imported_rows,rejected_rows,duplicate_rows,status,created_at,completed_at
        FROM occupational_labor_import_batches WHERE company_id=${companyOf(ctx)} ORDER BY created_at DESC LIMIT 200`
    );
    return rowsOf(result);
  }),

  auditTrail: protectedProcedure.query(async ({ ctx }) => {
    requirePppAccess(ctx);
    await ensurePppTables();
    const db = await getDb();
    if (!db) return [];
    const result: any = await db.execute(
      drzSql`SELECT a.id,a.action,a.entity_type,a.entity_id,a.collaborator_id,a.details_json,a.created_at,u.name actor_name
        FROM occupational_audit_log a LEFT JOIN users u ON u.id=a.actor_user_id
        WHERE a.company_id=${companyOf(ctx)} AND a.entity_type IN ('labor_history','labor_import_batch','labor_timeline','ppp_document')
        ORDER BY a.created_at DESC LIMIT 500`
    );
    return rowsOf(result).map(row => ({
      ...row,
      details: (() => {
        try {
          return JSON.parse(row.details_json || "{}");
        } catch {
          return {};
        }
      })(),
    }));
  }),
});
