import { sql as drzSql } from "drizzle-orm";

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
    drzSql.raw(
      `SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='${table}' AND column_name='${column}' LIMIT 1`
    )
  );
  if (!rowsOf(found).length) {
    await db.execute(
      drzSql.raw(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`)
    );
  }
}

let ensurePromise: Promise<void> | null = null;

export async function ensurePgrVersioningTables(db: any) {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await ensureColumn(db, "pgr_documents", "revision_root_id", "INT NULL");
      await ensureColumn(db, "pgr_documents", "revision_parent_id", "INT NULL");
      await ensureColumn(
        db,
        "pgr_documents",
        "revision_number",
        "INT NOT NULL DEFAULT 0"
      );
      await ensureColumn(db, "pgr_documents", "exercise_year", "INT NULL");
      await ensureColumn(
        db,
        "pgr_documents",
        "is_current_version",
        "TINYINT(1) NOT NULL DEFAULT 1"
      );
      await ensureColumn(
        db,
        "pgr_documents",
        "revision_reason",
        "VARCHAR(500) NULL"
      );
      await ensureColumn(
        db,
        "pgr_documents",
        "revision_summary_json",
        "LONGTEXT NULL"
      );
      await ensureColumn(
        db,
        "pgr_documents",
        "version_created_at",
        "DATETIME NULL"
      );

      await db.execute(drzSql`CREATE TABLE IF NOT EXISTS pgr_version_events (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

      await db.execute(drzSql`CREATE TABLE IF NOT EXISTS pcmso_pgr_revision_alerts (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      await ensureColumn(db, "pcmso_pgr_revision_alerts", "result_pcmso_id", "INT NULL");
      await ensureColumn(db, "pcmso_pgr_revision_alerts", "medical_response_json", "LONGTEXT NULL");
      await ensureColumn(db, "pcmso_pgr_revision_alerts", "sent_for_medical_at", "DATETIME NULL");
      await ensureColumn(db, "pcmso_pgr_revision_alerts", "sent_for_medical_by", "INT NULL");
      await ensureColumn(db, "pcmso_pgr_revision_alerts", "medical_completed_at", "DATETIME NULL");
      await ensureColumn(db, "pcmso_pgr_revision_alerts", "medical_completed_by", "INT NULL");
      await ensureColumn(db, "pcmso_pgr_revision_alerts", "sesmt_acknowledged_at", "DATETIME NULL");
      await ensureColumn(db, "pcmso_pgr_revision_alerts", "sesmt_acknowledged_by", "INT NULL");
      await ensureColumn(db, "pcmso_pgr_revision_alerts", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

      await db.execute(drzSql`UPDATE pgr_documents
        SET revision_root_id=id
        WHERE revision_root_id IS NULL`);
      await db.execute(drzSql`UPDATE pgr_documents
        SET exercise_year=COALESCE(YEAR(vigencia_inicio),YEAR(created_at),YEAR(CURDATE()))
        WHERE exercise_year IS NULL`);
    })().catch(error => {
      ensurePromise = null;
      throw error;
    });
  }
  await ensurePromise;
}

export async function initializePgrVersion(
  db: any,
  pgrId: number,
  exerciseYear?: number | null
) {
  await ensurePgrVersioningTables(db);
  await db.execute(drzSql`UPDATE pgr_documents
    SET revision_root_id=COALESCE(revision_root_id,id),
        exercise_year=COALESCE(${exerciseYear || null},exercise_year,YEAR(vigencia_inicio),YEAR(created_at),YEAR(CURDATE())),
        version_created_at=COALESCE(version_created_at,created_at,NOW())
    WHERE id=${pgrId}`);
}

async function copyGseContext(
  tx: any,
  sourceGseId: number,
  targetPgrId: number,
  userId: number
) {
  const sourceResult: any = await tx.execute(
    drzSql`SELECT * FROM pgr_gse WHERE id=${sourceGseId} LIMIT 1`
  );
  const source = rowsOf(sourceResult)[0];
  if (!source) return null;

  const inserted: any = await tx.execute(drzSql`INSERT INTO pgr_gse
    (pgr_id,nome,descricao,num_trabalhadores,num_homens,num_mulheres,ai_suggested,migrated_from_legacy,master_gse_id)
    VALUES (${targetPgrId},${source.nome},${source.descricao || null},${Number(source.num_trabalhadores || 0)},${Number(source.num_homens || 0)},${Number(source.num_mulheres || 0)},${Number(source.ai_suggested || 0)},${Number(source.migrated_from_legacy || 0)},${source.master_gse_id || null})`);
  const targetGseId = Number((inserted as any)[0]?.insertId || 0);
  if (!targetGseId) throw new Error("Falha ao copiar contexto do GSE.");

  await tx.execute(drzSql`INSERT INTO pgr_gse_cargos (gse_id,cargo)
    SELECT ${targetGseId},cargo FROM pgr_gse_cargos WHERE gse_id=${sourceGseId}`);
  await tx.execute(drzSql`INSERT INTO pgr_gse_setores (gse_id,sector_id)
    SELECT ${targetGseId},sector_id FROM pgr_gse_setores WHERE gse_id=${sourceGseId}`);
  await tx.execute(drzSql`INSERT INTO pgr_gse_epc (gse_id,descricao,aplicacao)
    SELECT ${targetGseId},descricao,aplicacao FROM pgr_gse_epc WHERE gse_id=${sourceGseId}`);
  await tx.execute(drzSql`INSERT INTO pgr_gse_epi (gse_id,descricao,ca,aplicacao,validade)
    SELECT ${targetGseId},descricao,ca,aplicacao,validade FROM pgr_gse_epi WHERE gse_id=${sourceGseId}`);
  await tx.execute(drzSql`INSERT INTO pgr_gse_treinamentos (gse_id,nr_code,nome,carga_horaria,obrigatorio)
    SELECT ${targetGseId},nr_code,nome,carga_horaria,obrigatorio FROM pgr_gse_treinamentos WHERE gse_id=${sourceGseId}`);

  const riskMap = new Map<number, number>();
  const riskResult: any = await tx.execute(
    drzSql`SELECT * FROM pgr_gse_riscos WHERE gse_id=${sourceGseId} ORDER BY id`
  );
  for (const risk of rowsOf(riskResult)) {
    const riskInsert: any = await tx.execute(drzSql`INSERT INTO pgr_gse_riscos
      (gse_id,tipo,agente,fonte_geradora,possivel_dano,tipo_exposicao,severidade,probabilidade,risco_final,from_assessment_id,from_factor_id,notes)
      VALUES (${targetGseId},${risk.tipo},${risk.agente},${risk.fonte_geradora || null},${risk.possivel_dano || null},${risk.tipo_exposicao || null},${risk.severidade || null},${risk.probabilidade || null},${risk.risco_final || null},${risk.from_assessment_id || null},${risk.from_factor_id || null},${risk.notes || null})`);
    const targetRiskId = Number((riskInsert as any)[0]?.insertId || 0);
    riskMap.set(Number(risk.id), targetRiskId);
    try {
      await tx.execute(drzSql`INSERT INTO pgr_gse_riscos_detalhe
        (risco_id,intensidade,concentracao,unidade,tempo_exposicao,frequencia_exposicao,via_exposicao,limite_tolerancia,norma_referencia,situacao_limite,avaliacao_quantitativa,data_medicao,proxima_medicao,resultado_medicao,laboratorio,instrumento,metodologia,criterio_ia,justificativa_ia,hierarquia_controles,periodicidade_reavaliacao,avaliacao_eficacia_controles,risco_residual_severidade,risco_residual_probabilidade,risco_residual_final,ai_generated)
        SELECT ${targetRiskId},intensidade,concentracao,unidade,tempo_exposicao,frequencia_exposicao,via_exposicao,limite_tolerancia,norma_referencia,situacao_limite,avaliacao_quantitativa,data_medicao,proxima_medicao,resultado_medicao,laboratorio,instrumento,metodologia,criterio_ia,justificativa_ia,hierarquia_controles,periodicidade_reavaliacao,avaliacao_eficacia_controles,risco_residual_severidade,risco_residual_probabilidade,risco_residual_final,ai_generated
        FROM pgr_gse_riscos_detalhe WHERE risco_id=${Number(risk.id)}`);
    } catch (_) {
      // O detalhamento é opcional em instalações antigas.
    }
  }

  const actionMap = new Map<number, number>();
  const actionResult: any = await tx.execute(
    drzSql`SELECT * FROM pgr_gse_acoes WHERE gse_id=${sourceGseId} ORDER BY id`
  );
  for (const action of rowsOf(actionResult)) {
    const actionInsert: any = await tx.execute(drzSql`INSERT INTO pgr_gse_acoes
      (gse_id,what,why,where_loc,when_start,when_end,who,how,how_much,priority,status,gse_risco_id)
      VALUES (${targetGseId},${action.what},${action.why || null},${action.where_loc || null},${action.when_start || null},${action.when_end || null},${action.who || null},${action.how || null},${action.how_much || null},${action.priority || null},${action.status || null},${riskMap.get(Number(action.gse_risco_id)) || null})`);
    actionMap.set(
      Number(action.id),
      Number((actionInsert as any)[0]?.insertId || 0)
    );
  }

  const evidenceResult: any = await tx.execute(
    drzSql`SELECT * FROM pgr_gse_evidencias WHERE gse_id=${sourceGseId} ORDER BY id`
  );
  for (const evidence of rowsOf(evidenceResult)) {
    await tx.execute(drzSql`INSERT INTO pgr_gse_evidencias
      (gse_id,tipo,titulo,descricao,file_url,gse_risco_id,gse_acao_id,uploaded_by_user_id)
      VALUES (${targetGseId},${evidence.tipo},${evidence.titulo || null},${evidence.descricao || null},${evidence.file_url || null},${riskMap.get(Number(evidence.gse_risco_id)) || null},${actionMap.get(Number(evidence.gse_acao_id)) || null},${evidence.uploaded_by_user_id || userId})`);
  }

  if (source.master_gse_id) {
    await tx.execute(drzSql`INSERT IGNORE INTO occupational_gse_pgr_links
      (company_id,gse_id,pgr_id,pgr_gse_id,linked_by)
      SELECT p.company_id,${Number(source.master_gse_id)},${targetPgrId},${targetGseId},${userId}
      FROM pgr_documents p WHERE p.id=${targetPgrId}`);
  }
  return { targetGseId, sourceGseId };
}

export async function clonePgrAsRevision(options: {
  db: any;
  sourcePgrId: number;
  companyId: number;
  userId: number;
  reason: string;
  changes?: Record<string, unknown> | null;
}) {
  const { db, sourcePgrId, companyId, userId, reason } = options;
  await ensurePgrVersioningTables(db);
  const changeJson = JSON.stringify(options.changes || {});

  return db.transaction(async (tx: any) => {
    const sourceResult: any = await tx.execute(
      drzSql`SELECT * FROM pgr_documents WHERE id=${sourcePgrId} AND company_id=${companyId} LIMIT 1 FOR UPDATE`
    );
    const source = rowsOf(sourceResult)[0];
    if (!source) throw new Error("PGR não encontrado.");
    if (Number(source.is_current_version) !== 1)
      throw new Error("Somente a versão vigente do PGR pode originar uma revisão.");
    const rootId = Number(source.revision_root_id || source.id);
    const familyResult: any = await tx.execute(
      drzSql`SELECT COALESCE(MAX(revision_number),0) max_revision FROM pgr_documents WHERE company_id=${companyId} AND revision_root_id=${rootId}`
    );
    const nextRevision = Number(rowsOf(familyResult)[0]?.max_revision || 0) + 1;
    const exerciseYear = Number(
      source.exercise_year ||
        (source.vigencia_inicio
          ? new Date(source.vigencia_inicio).getFullYear()
          : new Date().getFullYear())
    );
    const revisionLabel = String(nextRevision).padStart(2, "0");

    const inserted: any = await tx.execute(drzSql`INSERT INTO pgr_documents (
      company_id,branch_id,title,razao_social,nome_fantasia,cnpj,endereco,atividade_principal,grau_risco,
      contato,email,num_funcionarios,objeto_contrato,horarios_trabalho,regime_trabalho,obra,
      vigencia_inicio,vigencia_fim,contratante_ativo,contratante_razao,contratante_cnpj,contratante_endereco,
      contratante_atividade,contratante_grau_risco,contratante_contato,contratante_email,
      resp_tecnico_nome,resp_tecnico_registro,resp_tecnico_profissao,resp_tecnico_art,resp_tecnico_empresa,
      resp_tecnico_assinatura_url,resp_tecnico_validade_ate,logo_url,ghe_funcoes,revisoes,inventario,gse_grupos,
      epc_itens,epi_itens,plano_psicossocial,notas_tecnicas,texto_introducao,texto_conclusao,sumario_custom,
      caracterizacao_setores,cronograma_preventivo,hierarquia_controle,nao_conformidades,treinamentos_nr,
      status,current_revision,created_by_user_id,revision_root_id,revision_parent_id,revision_number,exercise_year,
      is_current_version,revision_reason,revision_summary_json,version_created_at
    ) SELECT
      company_id,branch_id,title,razao_social,nome_fantasia,cnpj,endereco,atividade_principal,grau_risco,
      contato,email,num_funcionarios,objeto_contrato,horarios_trabalho,regime_trabalho,obra,
      vigencia_inicio,vigencia_fim,contratante_ativo,contratante_razao,contratante_cnpj,contratante_endereco,
      contratante_atividade,contratante_grau_risco,contratante_contato,contratante_email,
      resp_tecnico_nome,resp_tecnico_registro,resp_tecnico_profissao,resp_tecnico_art,resp_tecnico_empresa,
      resp_tecnico_assinatura_url,resp_tecnico_validade_ate,logo_url,ghe_funcoes,revisoes,inventario,gse_grupos,
      epc_itens,epi_itens,plano_psicossocial,notas_tecnicas,texto_introducao,texto_conclusao,sumario_custom,
      caracterizacao_setores,cronograma_preventivo,hierarquia_controle,nao_conformidades,treinamentos_nr,
      'rascunho',${revisionLabel},${userId},${rootId},id,${nextRevision},${exerciseYear},1,${reason},${changeJson},NOW()
    FROM pgr_documents WHERE id=${sourcePgrId} AND company_id=${companyId}`);
    const newPgrId = Number((inserted as any)[0]?.insertId || 0);
    if (!newPgrId) throw new Error("Não foi possível criar a revisão do PGR.");

    await tx.execute(drzSql`UPDATE pgr_documents
      SET is_current_version=CASE WHEN id=${newPgrId} THEN 1 ELSE 0 END
      WHERE company_id=${companyId} AND revision_root_id=${rootId}`);

    const gseResult: any = await tx.execute(
      drzSql`SELECT id FROM pgr_gse WHERE pgr_id=${sourcePgrId} ORDER BY id`
    );
    for (const gse of rowsOf(gseResult)) {
      await copyGseContext(tx, Number(gse.id), newPgrId, userId);
    }

    await tx.execute(drzSql`INSERT INTO pgr_version_events
      (company_id,revision_root_id,pgr_id,source_pgr_id,revision_number,event_type,reason,changes_json,performed_by)
      VALUES (${companyId},${rootId},${newPgrId},${sourcePgrId},${nextRevision},'revision_created',${reason},${changeJson},${userId})`);

    return { id: newPgrId, rootId, revisionNumber: nextRevision };
  });
}

export async function createPgrRevisionAlerts(
  db: any,
  companyId: number,
  newPgrId: number
) {
  await ensurePgrVersioningTables(db);
  const documentResult: any = await db.execute(drzSql`SELECT revision_summary_json,revision_parent_id
    FROM pgr_documents
    WHERE id=${newPgrId} AND company_id=${companyId} AND is_current_version=1 AND status='publicado'
    LIMIT 1`);
  const document = rowsOf(documentResult)[0];
  if (!document) return { created: 0 };

  try {
    const pcmsoResult: any = await db.execute(drzSql`SELECT pc.id,pc.pgr_id
      FROM pcmso_programs_v2 pc
      JOIN pgr_documents previousp ON previousp.id=pc.pgr_id AND previousp.company_id=pc.company_id
      JOIN pgr_documents newp ON newp.id=${newPgrId} AND newp.company_id=pc.company_id
        AND COALESCE(newp.revision_root_id,newp.id)=COALESCE(previousp.revision_root_id,previousp.id)
      WHERE pc.company_id=${companyId} AND pc.is_current_version=1
        AND pc.status NOT IN ('arquivado','cancelado')`);
    let created = 0;
    for (const pcmso of rowsOf(pcmsoResult)) {
      const impact = await buildPgrRevisionImpact(
        db,
        companyId,
        Number(pcmso.pgr_id || document.revision_parent_id),
        newPgrId
      );
      let declaredChanges: any = {};
      try { declaredChanges = JSON.parse(document.revision_summary_json || "{}"); } catch {}
      const inserted: any = await db.execute(drzSql`INSERT IGNORE INTO pcmso_pgr_revision_alerts
        (company_id,pcmso_id,previous_pgr_id,new_pgr_id,status,changes_json,sent_for_medical_at)
        VALUES (${companyId},${Number(pcmso.id)},${Number(pcmso.pgr_id)},${newPgrId},'aguardando_medico',
          ${JSON.stringify({ ...impact, declaredChanges })},NOW())`);
      created += Number((inserted as any)[0]?.affectedRows || 0);
    }
    return { created };
  } catch (error) {
    console.warn("[pgr.versioning] alerta PCMSO não criado", error);
    return { created: 0 };
  }
}

export async function buildPgrRevisionImpact(
  db: any,
  companyId: number,
  previousPgrId: number,
  newPgrId: number
) {
  const loadRisks = async (pgrId: number) => {
    const result: any = await db.execute(drzSql`SELECT g.id pgr_gse_id,g.master_gse_id,g.nome gse_name,
        r.id risk_id,r.tipo risk_type,r.agente risk_name,r.fonte_geradora,r.possivel_dano,
        r.tipo_exposicao,r.severidade,r.probabilidade,r.risco_final,r.notes,
        CONCAT_WS('\n',d.metodologia,d.resultado_medicao,d.criterio_ia,d.justificativa_ia) technical_detail
      FROM pgr_gse g JOIN pgr_documents p ON p.id=g.pgr_id AND p.company_id=${companyId}
      JOIN pgr_gse_riscos r ON r.gse_id=g.id
      LEFT JOIN pgr_gse_riscos_detalhe d ON d.risco_id=r.id
      WHERE g.pgr_id=${pgrId} ORDER BY g.id,r.id`);
    return rowsOf(result);
  };
  const canonical = (value: unknown) => String(value || "").trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
  const key = (row: any) => [
    Number(row.master_gse_id || 0) || canonical(row.gse_name),
    canonical(row.risk_type),
    canonical(row.risk_name),
  ].join("|");
  const fingerprint = (row: any) => [
    row.fonte_geradora,row.possivel_dano,row.tipo_exposicao,row.severidade,row.probabilidade,
    row.risco_final,row.notes,row.technical_detail,
  ].map(canonical).join("|");
  const [previous, current] = await Promise.all([loadRisks(previousPgrId), loadRisks(newPgrId)]);
  const previousMap = new Map(previous.map(row => [key(row), row]));
  const currentMap = new Map(current.map(row => [key(row), row]));
  const added = current.filter(row => !previousMap.has(key(row)));
  const removed = previous.filter(row => !currentMap.has(key(row)));
  const modified = current.filter(row => {
    const old = previousMap.get(key(row));
    return old && fingerprint(old) !== fingerprint(row);
  });
  const affectedMasterGseIds = [...new Set([...added, ...removed, ...modified]
    .map(row => Number(row.master_gse_id || 0)).filter(Boolean))];
  let workers: any[] = [];
  if (affectedMasterGseIds.length) {
    const workerResult: any = await db.execute(drzSql.raw(`SELECT DISTINCT u.id,u.name,u.cpf,u.position,
        h.gse_id,m.code gse_code,m.name gse_name,b.name branch_name,s.name sector_name
      FROM occupational_gse_worker_history h
      JOIN users u ON u.id=h.collaborator_id AND u.company_id=h.company_id
      LEFT JOIN occupational_gse_master m ON m.id=h.gse_id AND m.company_id=h.company_id
      LEFT JOIN branches b ON b.id=u.branch_id
      LEFT JOIN sectors s ON s.id=u.sector_id
      WHERE h.company_id=${Number(companyId)} AND h.is_current=1 AND h.gse_id IN (${affectedMasterGseIds.join(",")})
      ORDER BY u.name`));
    workers = rowsOf(workerResult).map(row => ({
      id: Number(row.id), name: row.name, cpf: row.cpf, position: row.position,
      gseId: Number(row.gse_id), gseCode: row.gse_code, gseName: row.gse_name,
      branchName: row.branch_name, sectorName: row.sector_name,
    }));
  }
  const compact = (row: any) => ({
    pgrGseId: Number(row.pgr_gse_id), masterGseId: row.master_gse_id ? Number(row.master_gse_id) : null,
    gseName: row.gse_name, riskId: Number(row.risk_id), riskName: row.risk_name,
    riskType: row.risk_type, classification: row.risco_final,
  });
  return {
    previousPgrId,
    newPgrId,
    addedRisks: added.map(compact),
    removedRisks: removed.map(compact),
    modifiedRisks: modified.map(compact),
    affectedGseIds: affectedMasterGseIds,
    affectedWorkers: workers,
    summary: {
      added: added.length,
      removed: removed.length,
      modified: modified.length,
      affectedGses: affectedMasterGseIds.length,
      affectedWorkers: workers.length,
    },
  };
}

export async function findReusableGseConfiguration(
  db: any,
  companyId: number,
  targetPgrId: number,
  targetPgrGseId: number
) {
  await ensurePgrVersioningTables(db);
  const result: any = await db.execute(drzSql`SELECT previous_gse.*,previous_pgr.title pgr_title,
      previous_pgr.exercise_year,previous_pgr.revision_number,previous_pgr.id source_pgr_id,
      (SELECT COUNT(*) FROM pgr_gse_riscos r WHERE r.gse_id=previous_gse.id) risk_count
    FROM pgr_gse target
    JOIN pgr_documents current_pgr ON current_pgr.id=target.pgr_id AND current_pgr.company_id=${companyId}
    JOIN pgr_gse previous_gse ON previous_gse.master_gse_id=target.master_gse_id AND previous_gse.id<>target.id
    JOIN pgr_documents previous_pgr ON previous_pgr.id=previous_gse.pgr_id AND previous_pgr.company_id=current_pgr.company_id
    WHERE target.id=${targetPgrGseId} AND target.pgr_id=${targetPgrId}
      AND target.master_gse_id IS NOT NULL
      AND previous_pgr.id<>current_pgr.id
      AND EXISTS (SELECT 1 FROM pgr_gse_riscos r WHERE r.gse_id=previous_gse.id)
    ORDER BY previous_pgr.exercise_year DESC,previous_pgr.is_current_version DESC,previous_pgr.revision_number DESC,previous_pgr.updated_at DESC
    LIMIT 1`);
  return rowsOf(result)[0] || null;
}

export async function recoverGseConfiguration(options: {
  db: any;
  companyId: number;
  userId: number;
  targetPgrId: number;
  targetPgrGseId: number;
  sourcePgrGseId: number;
}) {
  const { db, companyId, userId, targetPgrId, targetPgrGseId, sourcePgrGseId } =
    options;
  await ensurePgrVersioningTables(db);
  return db.transaction(async (tx: any) => {
    const ownershipResult: any = await tx.execute(drzSql`SELECT target.id,target.master_gse_id
      FROM pgr_gse target JOIN pgr_documents p ON p.id=target.pgr_id
      WHERE target.id=${targetPgrGseId} AND target.pgr_id=${targetPgrId} AND p.company_id=${companyId} LIMIT 1 FOR UPDATE`);
    const target = rowsOf(ownershipResult)[0];
    if (!target) throw new Error("GSE atual não encontrado.");
    const sourceResult: any = await tx.execute(drzSql`SELECT source.id,source.master_gse_id
      FROM pgr_gse source JOIN pgr_documents p ON p.id=source.pgr_id
      WHERE source.id=${sourcePgrGseId} AND p.company_id=${companyId} LIMIT 1`);
    const source = rowsOf(sourceResult)[0];
    if (
      !source ||
      !target.master_gse_id ||
      Number(source.master_gse_id) !== Number(target.master_gse_id)
    ) {
      throw new Error("A configuração anterior não pertence ao mesmo GSE mestre.");
    }
    const existingResult: any = await tx.execute(
      drzSql`SELECT COUNT(*) total FROM pgr_gse_riscos WHERE gse_id=${targetPgrGseId}`
    );
    if (Number(rowsOf(existingResult)[0]?.total || 0) > 0) {
      throw new Error(
        "Este GSE já possui riscos no PGR atual. A recuperação foi interrompida para evitar duplicidade."
      );
    }

    const cloned = await copyGseContext(tx, sourcePgrGseId, targetPgrId, userId);
    if (!cloned) throw new Error("Configuração anterior não encontrada.");
    const copiedGseId = Number(cloned.targetGseId);

    await tx.execute(drzSql`UPDATE pgr_gse_riscos SET gse_id=${targetPgrGseId} WHERE gse_id=${copiedGseId}`);
    await tx.execute(drzSql`UPDATE pgr_gse_epc SET gse_id=${targetPgrGseId} WHERE gse_id=${copiedGseId}`);
    await tx.execute(drzSql`UPDATE pgr_gse_epi SET gse_id=${targetPgrGseId} WHERE gse_id=${copiedGseId}`);
    await tx.execute(drzSql`UPDATE pgr_gse_acoes SET gse_id=${targetPgrGseId} WHERE gse_id=${copiedGseId}`);
    await tx.execute(drzSql`UPDATE pgr_gse_evidencias SET gse_id=${targetPgrGseId} WHERE gse_id=${copiedGseId}`);
    await tx.execute(drzSql`UPDATE pgr_gse_treinamentos SET gse_id=${targetPgrGseId} WHERE gse_id=${copiedGseId}`);
    await tx.execute(drzSql`DELETE FROM occupational_gse_pgr_links WHERE pgr_gse_id=${copiedGseId}`);
    await tx.execute(drzSql`DELETE FROM pgr_gse_cargos WHERE gse_id=${copiedGseId}`);
    await tx.execute(drzSql`DELETE FROM pgr_gse_setores WHERE gse_id=${copiedGseId}`);
    await tx.execute(drzSql`DELETE FROM pgr_gse WHERE id=${copiedGseId}`);
    await tx.execute(drzSql`UPDATE pgr_gse SET ai_suggested=0,updated_at=NOW() WHERE id=${targetPgrGseId}`);

    await tx.execute(drzSql`INSERT INTO pgr_version_events
      (company_id,revision_root_id,pgr_id,source_pgr_id,revision_number,event_type,reason,changes_json,performed_by)
      SELECT ${companyId},COALESCE(revision_root_id,id),id,${sourcePgrGseId},revision_number,'gse_configuration_recovered','Configuração técnica recuperada de PGR anterior',${JSON.stringify({ targetPgrGseId, sourcePgrGseId })},${userId}
      FROM pgr_documents WHERE id=${targetPgrId}`);
    return { ok: true, copiedFrom: sourcePgrGseId };
  });
}
