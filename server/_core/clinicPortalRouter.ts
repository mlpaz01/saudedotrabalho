import fs from "fs";
import path from "path";
import { TRPCError } from "@trpc/server";
import { sql as drzSql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import {
  ensureOccupationalTables,
  esc,
  privateDocumentPayload,
  renderPdf,
  savePrivateFile,
} from "./occupationalLifecycleRouter";
import {
  canTransitionClinicOrder,
  clinicOrderStatuses,
  summarizeClinicBilling,
  type ClinicOrderStatus,
} from "./clinicPortal";
import { protectedProcedure, router } from "./trpc";

let clinicTablesReady = false;

function rowsOf(result: any): any[] {
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0];
  if (Array.isArray(result)) return result;
  return [];
}

async function ensureClinicTables() {
  await ensureOccupationalTables();
  if (clinicTablesReady) return;
  const db = await getDb();
  if (!db) return;
  await db.execute(drzSql`CREATE TABLE IF NOT EXISTS occupational_provider_order_progress (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    provider_id INT NOT NULL,
    order_id BIGINT NOT NULL,
    workflow_status VARCHAR(40) NOT NULL DEFAULT 'recebida',
    scheduled_at DATETIME NULL,
    performed_at DATETIME NULL,
    professional_name VARCHAR(255) NULL,
    professional_registry_type VARCHAR(40) NULL,
    professional_registry_number VARCHAR(100) NULL,
    notes TEXT NULL,
    amount DECIMAL(12,2) NULL,
    proof_private_path VARCHAR(700) NULL,
    proof_original_name VARCHAR(255) NULL,
    proof_uploaded_by INT NULL,
    proof_uploaded_at DATETIME NULL,
    result_id BIGINT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_occ_provider_progress_order (company_id, provider_id, order_id),
    INDEX idx_occ_provider_progress_status (company_id, provider_id, workflow_status),
    INDEX idx_occ_provider_progress_period (company_id, provider_id, performed_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  clinicTablesReady = true;
}

async function clinicContext(ctx: any) {
  if (ctx.user?.role !== "clinica")
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acesso exclusivo da clínica credenciada.",
    });
  await ensureClinicTables();
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const result: any = await db.execute(
    drzSql`SELECT pu.company_id,pu.provider_id,p.legal_name,p.trade_name,p.cnpj,p.email,p.phone,p.contact_name
    FROM occupational_provider_users pu
    JOIN occupational_health_providers p ON p.id=pu.provider_id AND p.company_id=pu.company_id
    WHERE pu.user_id=${Number(ctx.user.id)} AND pu.is_active=1 AND p.is_active=1 AND p.credential_status='ativo'
    ORDER BY pu.id DESC`
  );
  const clinics = rowsOf(result);
  if (!clinics.length)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "O acesso não está vinculado a uma clínica credenciada ativa.",
    });
  return { db, clinic: clinics[0], clinics, userId: Number(ctx.user.id) };
}

async function assignedOrder(db: any, userId: number, orderId: number) {
  const result: any = await db.execute(
    drzSql`SELECT o.*,u.name collaborator_name,u.cpf,u.employee_registration,u.position,
      b.name branch_name,s.name sector_name,e.name exam_name,e.result_type exam_result_type,
      p.legal_name provider_legal_name,p.trade_name provider_trade_name,p.cnpj provider_cnpj,
      c.name company_name,c.cnpj company_cnpj
    FROM occupational_exam_orders o
    JOIN users u ON u.id=o.collaborator_id AND u.company_id=o.company_id
    JOIN companies c ON c.id=o.company_id
    JOIN pcmso_exam_catalog_v2 e ON e.id=o.exam_id AND e.company_id=o.company_id
    JOIN occupational_health_providers p ON p.id=o.provider_id AND p.company_id=o.company_id
    JOIN occupational_provider_users pu ON pu.provider_id=o.provider_id AND pu.company_id=o.company_id AND pu.user_id=${userId} AND pu.is_active=1
    LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN sectors s ON s.id=u.sector_id
    WHERE o.id=${orderId} AND p.is_active=1 AND p.credential_status='ativo' LIMIT 1`
  );
  const row = rowsOf(result)[0];
  if (!row)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Requisição não encaminhada para esta clínica.",
    });
  return row;
}

async function clinicAudit(
  db: any,
  ctx: any,
  companyId: number,
  action: string,
  entityType: string,
  entityId?: number | null,
  collaboratorId?: number | null,
  details?: any
) {
  await db.execute(drzSql`INSERT INTO occupational_audit_log
    (company_id,actor_user_id,action,entity_type,entity_id,collaborator_id,details_json)
    VALUES (${companyId},${Number(ctx.user.id)},${action},${entityType},${entityId || null},${collaboratorId || null},${details ? JSON.stringify(details) : null})`);
}

async function progressForOrder(
  db: any,
  companyId: number,
  providerId: number,
  orderId: number
) {
  await db.execute(
    drzSql`INSERT INTO occupational_provider_order_progress (company_id,provider_id,order_id,workflow_status)
    VALUES (${companyId},${providerId},${orderId},'recebida')
    ON DUPLICATE KEY UPDATE order_id=VALUES(order_id)`
  );
  const result: any = await db.execute(
    drzSql`SELECT * FROM occupational_provider_order_progress WHERE company_id=${companyId} AND provider_id=${providerId} AND order_id=${orderId} LIMIT 1`
  );
  return rowsOf(result)[0];
}

function requireSupportedFile(dataUrl: string, fileName: string) {
  const match = dataUrl.match(
    /^data:(application\/pdf|image\/png|image\/jpeg);base64,/
  );
  if (!match)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Envie um arquivo PDF, PNG ou JPG válido.",
    });
  if (Buffer.byteLength(dataUrl, "utf8") > 20_000_000)
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: "O arquivo deve ter no máximo 15 MB.",
    });
  if (!fileName.trim())
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Nome do arquivo não informado.",
    });
}

function requestHtml(row: any) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
  @page{size:A4;margin:17mm}body{font-family:Arial,sans-serif;color:#173047;font-size:10pt;line-height:1.5}h1{font-size:18pt;border-bottom:4px solid #0795a5;padding-bottom:5mm}.box{border:1px solid #d6e1e7;padding:5mm;margin:5mm 0}.tag{font-weight:700;color:#087583}.signature{margin-top:14mm;display:grid;grid-template-columns:1fr 1fr;gap:12mm}.line{border-top:1px solid #173047;margin-top:18mm;padding-top:2mm;text-align:center}.notice{font-size:8.5pt;color:#546573}</style></head><body>
  <h1>REQUISIÇÃO DE EXAME OCUPACIONAL</h1><p><b>${esc(row.company_name)}</b><br>CNPJ: ${esc(row.company_cnpj || "-")}</p>
  <div class="box"><b>Trabalhador:</b> ${esc(row.collaborator_name)}<br><b>CPF:</b> ${esc(row.cpf || "-")}<br><b>Matrícula:</b> ${esc(row.employee_registration || "-")}<br><b>Cargo:</b> ${esc(row.position || "-")}<br><b>Filial / setor:</b> ${esc([row.branch_name, row.sector_name].filter(Boolean).join(" / ") || "-")}</div>
  <div class="box"><p class="tag">${esc(row.order_number)}</p><b>Exame:</b> ${esc(row.exam_name)}<br><b>Clínica:</b> ${esc(row.provider_trade_name || row.provider_legal_name)}<br><b>Local:</b> ${esc(row.service_location || "A definir")}<br><b>Emissão:</b> ${esc(row.issue_date)}<br><b>Validade:</b> ${esc(row.valid_until || "Não informada")}<p><b>Orientações:</b><br>${esc(row.orientations || "Seguir as orientações do prestador.")}</p></div>
  <h2>Confirmação do atendimento pelo credenciado</h2><div class="box"><b>Data da realização:</b> ____/____/________ &nbsp;&nbsp; <b>Horário:</b> ____:____<br><br><b>Profissional responsável:</b> ______________________________________________<br><br><b>Conselho/registro:</b> ______________________________________________</div>
  <div class="signature"><div class="line">Assinatura e carimbo do credenciado</div><div class="line">Ciência do trabalhador</div></div>
  <p class="notice">A via assinada deve ser anexada à mesma requisição no Portal da Clínica Credenciada. O documento digital original e a versão comprobatória permanecem vinculados ao atendimento e à trilha de auditoria.</p></body></html>`;
}

const statusSchema = z.enum(clinicOrderStatuses);

export const clinicPortalRouter = router({
  profile: protectedProcedure.query(async ({ ctx }) => {
    const { clinic, clinics } = await clinicContext(ctx);
    return { ...clinic, linkedCompanies: clinics.length };
  }),

  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const { db, userId } = await clinicContext(ctx);
    const result: any = await db.execute(
      drzSql`SELECT COUNT(*) total,
      SUM(CASE WHEN COALESCE(pp.workflow_status,'recebida') IN ('recebida','agendamento_pendente') THEN 1 ELSE 0 END) scheduling_pending,
      SUM(CASE WHEN COALESCE(pp.workflow_status,'recebida')='agendada' THEN 1 ELSE 0 END) scheduled,
      SUM(CASE WHEN COALESCE(pp.workflow_status,'recebida') IN ('atendimento_realizado','resultado_pendente') THEN 1 ELSE 0 END) result_pending,
      SUM(CASE WHEN COALESCE(pp.workflow_status,'recebida') IN ('resultado_enviado','concluida') THEN 1 ELSE 0 END) finished,
      SUM(CASE WHEN pp.performed_at IS NOT NULL AND pp.proof_private_path IS NULL THEN 1 ELSE 0 END) proof_pending
      FROM occupational_provider_users pu
      JOIN occupational_exam_orders o ON o.company_id=pu.company_id AND o.provider_id=pu.provider_id
      LEFT JOIN occupational_provider_order_progress pp ON pp.order_id=o.id AND pp.company_id=o.company_id AND pp.provider_id=o.provider_id
      WHERE pu.user_id=${userId} AND pu.is_active=1 AND o.status<>'substituida'`
    );
    return rowsOf(result)[0] || {};
  }),

  listOrders: protectedProcedure
    .input(
      z
        .object({
          search: z.string().max(120).optional(),
          status: statusSchema.optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const { db, userId } = await clinicContext(ctx);
      const result: any = await db.execute(
        drzSql`SELECT o.id,o.order_number,o.issue_date,o.valid_until,o.status order_status,o.service_location,o.orientations,
        c.name company_name,c.cnpj company_cnpj,u.name collaborator_name,u.cpf,u.employee_registration,u.position,b.name branch_name,s.name sector_name,
        e.name exam_name,COALESCE(pp.workflow_status,'recebida') workflow_status,pp.scheduled_at,pp.performed_at,
        pp.professional_name,pp.professional_registry_type,pp.professional_registry_number,pp.notes,pp.amount,
        pp.proof_private_path,pp.proof_uploaded_at,pp.result_id,pp.updated_at
        FROM occupational_provider_users pu
        JOIN occupational_exam_orders o ON o.company_id=pu.company_id AND o.provider_id=pu.provider_id
        JOIN companies c ON c.id=o.company_id
        JOIN users u ON u.id=o.collaborator_id AND u.company_id=o.company_id
        JOIN pcmso_exam_catalog_v2 e ON e.id=o.exam_id AND e.company_id=o.company_id
        LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN sectors s ON s.id=u.sector_id
        LEFT JOIN occupational_provider_order_progress pp ON pp.order_id=o.id AND pp.company_id=o.company_id AND pp.provider_id=o.provider_id
        WHERE pu.user_id=${userId} AND pu.is_active=1 AND o.status<>'substituida'
        ORDER BY COALESCE(pp.performed_at,pp.scheduled_at,o.created_at) DESC,o.id DESC LIMIT 1500`
      );
      const search = String(input?.search || "")
        .trim()
        .toLocaleLowerCase("pt-BR");
      return rowsOf(result).filter((row: any) => {
        const status = row.workflow_status || "recebida";
        if (input?.status && status !== input.status) return false;
        if (!search) return true;
        return [
          row.order_number,
          row.collaborator_name,
          row.cpf,
          row.employee_registration,
          row.exam_name,
        ].some(value =>
          String(value || "")
            .toLocaleLowerCase("pt-BR")
            .includes(search)
        );
      });
    }),

  updateOrder: protectedProcedure
    .input(
      z.object({
        orderId: z.number().int().positive(),
        status: statusSchema,
        scheduledAt: z.string().max(40).nullable().optional(),
        performedAt: z.string().max(40).nullable().optional(),
        professionalName: z.string().max(255).optional(),
        registryType: z.string().max(40).optional(),
        registryNumber: z.string().max(100).optional(),
        notes: z.string().max(10000).optional(),
        amount: z.number().min(0).max(10_000_000).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db, userId } = await clinicContext(ctx);
      const order = await assignedOrder(db, userId, input.orderId);
      const companyId = Number(order.company_id);
      const providerId = Number(order.provider_id);
      const progress = await progressForOrder(
        db,
        companyId,
        providerId,
        input.orderId
      );
      const current = String(
        progress.workflow_status || "recebida"
      ) as ClinicOrderStatus;
      if (!canTransitionClinicOrder(current, input.status))
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Esta mudança de status não respeita a sequência do atendimento.",
        });
      if (
        [
          "atendimento_realizado",
          "resultado_pendente",
          "resultado_enviado",
          "concluida",
        ].includes(input.status) &&
        !input.performedAt &&
        !progress.performed_at
      )
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Informe a data e hora da realização.",
        });
      if (
        ["resultado_enviado", "concluida"].includes(input.status) &&
        !progress.result_id
      )
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Envie o resultado antes de avançar para esta etapa.",
        });
      await db.execute(
        drzSql`UPDATE occupational_provider_order_progress SET workflow_status=${input.status},
        scheduled_at=COALESCE(${input.scheduledAt || null},scheduled_at),performed_at=COALESCE(${input.performedAt || null},performed_at),
        professional_name=COALESCE(${input.professionalName || null},professional_name),
        professional_registry_type=COALESCE(${input.registryType || null},professional_registry_type),
        professional_registry_number=COALESCE(${input.registryNumber || null},professional_registry_number),
        notes=${input.notes || null},amount=${input.amount ?? null}
        WHERE company_id=${companyId} AND provider_id=${providerId} AND order_id=${input.orderId}`
      );
      await clinicAudit(
        db,
        ctx,
        companyId,
        "clinic_order_status_updated",
        "exam_order",
        input.orderId,
        Number(order.collaborator_id),
        { from: current, to: input.status }
      );
      return { ok: true };
    }),

  getRequestPdf: protectedProcedure
    .input(z.object({ orderId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { db, userId } = await clinicContext(ctx);
      const row = await assignedOrder(db, userId, input.orderId);
      const companyId = Number(row.company_id);
      const file = await renderPdf(
        companyId,
        "provider-orders",
        `requisicao_credenciado_${input.orderId}.pdf`,
        requestHtml(row)
      );
      await clinicAudit(
        db,
        ctx,
        companyId,
        "clinic_request_printed",
        "exam_order",
        input.orderId,
        Number(row.collaborator_id)
      );
      return {
        fileName: path.basename(file),
        dataBase64: `data:application/pdf;base64,${fs.readFileSync(file).toString("base64")}`,
      };
    }),

  uploadSignedProof: protectedProcedure
    .input(
      z.object({
        orderId: z.number().int().positive(),
        fileName: z.string().max(255),
        fileBase64: z.string().max(20_000_000),
        performedAt: z.string().min(10).max(40),
        professionalName: z.string().min(2).max(255),
        registryType: z.string().min(2).max(40),
        registryNumber: z.string().min(2).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db, userId } = await clinicContext(ctx);
      const order = await assignedOrder(db, userId, input.orderId);
      const companyId = Number(order.company_id);
      const providerId = Number(order.provider_id);
      requireSupportedFile(input.fileBase64, input.fileName);
      await progressForOrder(db, companyId, providerId, input.orderId);
      const stored = savePrivateFile(
        companyId,
        `provider-proofs/${providerId}`,
        input.fileName,
        input.fileBase64
      );
      await db.execute(
        drzSql`UPDATE occupational_provider_order_progress SET proof_private_path=${stored},proof_original_name=${input.fileName},
        proof_uploaded_by=${Number(ctx.user.id)},proof_uploaded_at=NOW(),performed_at=${input.performedAt},
        professional_name=${input.professionalName},professional_registry_type=${input.registryType},professional_registry_number=${input.registryNumber},
        workflow_status=CASE WHEN workflow_status IN ('recebida','agendamento_pendente','agendada') THEN 'atendimento_realizado' ELSE workflow_status END
        WHERE company_id=${companyId} AND provider_id=${providerId} AND order_id=${input.orderId}`
      );
      await clinicAudit(
        db,
        ctx,
        companyId,
        "clinic_signed_proof_uploaded",
        "exam_order",
        input.orderId,
        Number(order.collaborator_id),
        { fileName: input.fileName }
      );
      return { ok: true };
    }),

  downloadSignedProof: protectedProcedure
    .input(z.object({ orderId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { db, userId } = await clinicContext(ctx);
      const order = await assignedOrder(db, userId, input.orderId);
      const companyId = Number(order.company_id);
      const providerId = Number(order.provider_id);
      const result: any = await db.execute(
        drzSql`SELECT proof_private_path FROM occupational_provider_order_progress WHERE company_id=${companyId} AND provider_id=${providerId} AND order_id=${input.orderId} LIMIT 1`
      );
      const payload = privateDocumentPayload(
        companyId,
        rowsOf(result)[0]?.proof_private_path
      );
      await clinicAudit(
        db,
        ctx,
        companyId,
        "clinic_signed_proof_downloaded",
        "exam_order",
        input.orderId
      );
      return { fileName: payload.fileName, dataBase64: payload.dataBase64 };
    }),

  analyzeResultOcr: protectedProcedure
    .input(
      z.object({
        orderId: z.number().int().positive(),
        fileName: z.string().max(255),
        mimeType: z.enum(["image/png", "image/jpeg"]),
        fileBase64: z.string().max(8_000_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db, userId } = await clinicContext(ctx);
      const order = await assignedOrder(db, userId, input.orderId);
      const companyId = Number(order.company_id);
      const apiKey = String(process.env.OPENROUTER_API_KEY || "").trim();
      if (!apiKey)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "OCR não configurado neste ambiente.",
        });
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": "https://saudedotrabalho.com",
            "X-Title": "Saude do Trabalho - Portal Clinica",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            temperature: 0,
            max_tokens: 1800,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Leia este resultado somente como apoio de digitacao. O exame esperado e ${order.exam_name}. Retorne JSON com performedDate (YYYY-MM-DD), resultType (qualitativo, quantitativo ou misto), resultSummary, referenceText, parameters [{name,value,unit,reference}], confidence e warnings. Nao conclua diagnostico, autenticidade ou aptidao.`,
                  },
                  {
                    type: "image_url",
                    image_url: { url: input.fileBase64, detail: "high" },
                  },
                ],
              },
            ],
          }),
        }
      );
      if (!response.ok)
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: "Não foi possível analisar o documento agora.",
        });
      const data: any = await response.json();
      const parsed = JSON.parse(
        String(data.choices?.[0]?.message?.content || "{}")
          .replace(/```json|```/g, "")
          .trim()
      );
      await clinicAudit(
        db,
        ctx,
        companyId,
        "clinic_result_ocr_analyzed",
        "exam_order",
        input.orderId,
        Number(order.collaborator_id)
      );
      return parsed;
    }),

  submitResult: protectedProcedure
    .input(
      z.object({
        orderId: z.number().int().positive(),
        performedAt: z.string().min(10).max(40),
        resultType: z.enum(["qualitativo", "quantitativo", "misto"]),
        resultSummary: z.string().max(20000).optional(),
        referenceText: z.string().max(50000).optional(),
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
        fileName: z.string().max(255).optional(),
        fileBase64: z.string().max(20_000_000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db, userId } = await clinicContext(ctx);
      const order = await assignedOrder(db, userId, input.orderId);
      const companyId = Number(order.company_id);
      const providerId = Number(order.provider_id);
      const clinicName = order.provider_trade_name || order.provider_legal_name;
      let documentPath: string | null = null;
      if (input.fileBase64) {
        requireSupportedFile(
          input.fileBase64,
          input.fileName || "resultado.pdf"
        );
        documentPath = savePrivateFile(
          companyId,
          "exam-results",
          input.fileName || "resultado.pdf",
          input.fileBase64
        );
      }
      const existingResult: any = await db.execute(
        drzSql`SELECT id,document_private_path FROM occupational_exam_results WHERE company_id=${companyId} AND order_id=${input.orderId} ORDER BY id DESC LIMIT 1`
      );
      const existing = rowsOf(existingResult)[0];
      let resultId = Number(existing?.id || 0);
      if (resultId) {
        await db.execute(
          drzSql`UPDATE occupational_exam_results SET performed_at=${input.performedAt},laboratory_name=${clinicName},result_type=${input.resultType},result_summary=${input.resultSummary || null},parameters_json=${JSON.stringify(input.parameters)},reference_text=${input.referenceText || null},classification='pendente_revisao',source='clinica',identity_status='confirmado',document_private_path=COALESCE(${documentPath},document_private_path),reviewed_by=NULL,reviewed_at=NULL,updated_at=NOW() WHERE id=${resultId} AND company_id=${companyId}`
        );
      } else {
        const created: any = await db.execute(
          drzSql`INSERT INTO occupational_exam_results (company_id,order_id,collaborator_id,exam_id,performed_at,laboratory_name,result_type,result_summary,parameters_json,reference_text,classification,source,identity_status,document_private_path,created_by)
          VALUES (${companyId},${input.orderId},${Number(order.collaborator_id)},${Number(order.exam_id)},${input.performedAt},${clinicName},${input.resultType},${input.resultSummary || null},${JSON.stringify(input.parameters)},${input.referenceText || null},'pendente_revisao','clinica','confirmado',${documentPath},${Number(ctx.user.id)})`
        );
        resultId = Number((created as any)[0]?.insertId || 0);
      }
      await progressForOrder(db, companyId, providerId, input.orderId);
      await db.execute(
        drzSql`UPDATE occupational_provider_order_progress SET result_id=${resultId},performed_at=${input.performedAt},workflow_status=IF(workflow_status='concluida','concluida','resultado_enviado') WHERE company_id=${companyId} AND provider_id=${providerId} AND order_id=${input.orderId}`
      );
      await db.execute(
        drzSql`UPDATE occupational_exam_orders SET status='realizada' WHERE id=${input.orderId} AND company_id=${companyId}`
      );
      if (documentPath)
        await db.execute(drzSql`INSERT INTO notifications (user_id,company_id,type,priority,title,body,link,icon,dedup_key)
          VALUES (${Number(order.collaborator_id)},${companyId},'documento_ocupacional','media','Novo resultado de exame','Seu resultado de ${order.exam_name} foi disponibilizado pela clínica.','/documentos-ocupacionais','file-text',${`clinic-result:${resultId}`})
          ON DUPLICATE KEY UPDATE read_at=NULL,created_at=NOW()`);
      await clinicAudit(
        db,
        ctx,
        companyId,
        existing ? "clinic_result_updated" : "clinic_result_submitted",
        "exam_result",
        resultId,
        Number(order.collaborator_id),
        { orderId: input.orderId }
      );
      return { ok: true, resultId };
    }),

  billing: protectedProcedure
    .input(
      z.object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db, userId } = await clinicContext(ctx);
      if (input.from > input.to)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Período inválido.",
        });
      const result: any = await db.execute(
        drzSql`SELECT o.id order_id,o.order_number,c.name company_name,c.cnpj company_cnpj,u.name collaborator_name,u.cpf,
        e.name exam_name,pp.performed_at,pp.workflow_status,pp.amount,pp.proof_private_path,pp.proof_uploaded_at,
        pp.professional_name,pp.professional_registry_type,pp.professional_registry_number
        FROM occupational_provider_users pu
        JOIN occupational_provider_order_progress pp ON pp.company_id=pu.company_id AND pp.provider_id=pu.provider_id
        JOIN occupational_exam_orders o ON o.id=pp.order_id AND o.company_id=pp.company_id AND o.provider_id=pp.provider_id
        JOIN companies c ON c.id=o.company_id JOIN users u ON u.id=o.collaborator_id AND u.company_id=o.company_id
        JOIN pcmso_exam_catalog_v2 e ON e.id=o.exam_id AND e.company_id=o.company_id
        WHERE pu.user_id=${userId} AND pu.is_active=1 AND pp.performed_at>=${`${input.from} 00:00:00`} AND pp.performed_at<=${`${input.to} 23:59:59`}
        ORDER BY pp.performed_at,o.order_number`
      );
      const rows = rowsOf(result);
      return { rows, summary: summarizeClinicBilling(rows) };
    }),

  generateBillingPdf: protectedProcedure
    .input(
      z.object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db, clinic, clinics, userId } = await clinicContext(ctx);
      const companyId = Number(clinics[0].company_id);
      const result: any = await db.execute(
        drzSql`SELECT o.id order_id,o.order_number,c.name company_name,c.cnpj company_cnpj,u.name collaborator_name,u.cpf,e.name exam_name,pp.performed_at,pp.workflow_status,pp.amount,pp.proof_private_path
        FROM occupational_provider_users pu
        JOIN occupational_provider_order_progress pp ON pp.company_id=pu.company_id AND pp.provider_id=pu.provider_id
        JOIN occupational_exam_orders o ON o.id=pp.order_id AND o.company_id=pp.company_id AND o.provider_id=pp.provider_id
        JOIN companies c ON c.id=o.company_id JOIN users u ON u.id=o.collaborator_id AND u.company_id=o.company_id JOIN pcmso_exam_catalog_v2 e ON e.id=o.exam_id AND e.company_id=o.company_id
        WHERE pu.user_id=${userId} AND pu.is_active=1 AND pp.performed_at>=${`${input.from} 00:00:00`} AND pp.performed_at<=${`${input.to} 23:59:59`} ORDER BY pp.performed_at,o.order_number`
      );
      const rows = rowsOf(result);
      const summary = summarizeClinicBilling(rows);
      const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial;color:#173047;font-size:9pt}h1{border-bottom:4px solid #0795a5;padding-bottom:4mm}.meta{margin:5mm 0}.cards{display:flex;gap:4mm}.card{border:1px solid #d6e1e7;padding:3mm;min-width:35mm}table{width:100%;border-collapse:collapse;margin-top:5mm}th,td{border:1px solid #d6e1e7;padding:2.3mm;text-align:left}th{background:#087f8d;color:white}.ok{color:#087a55;font-weight:bold}.pending{color:#b26a00;font-weight:bold}</style></head><body><h1>DEMONSTRATIVO DE ATENDIMENTOS</h1><div class="meta"><b>${esc(clinic.trade_name || clinic.legal_name)}</b><br>CNPJ: ${esc(clinic.cnpj || "-")}<br>Período: ${esc(input.from)} a ${esc(input.to)}</div><div class="cards"><div class="card"><b>Atendimentos</b><br>${summary.attendances}</div><div class="card"><b>Exames</b><br>${summary.attendances}</div><div class="card"><b>Comprovados</b><br>${summary.withProof}</div><div class="card"><b>Valor total</b><br>R$ ${summary.total.toFixed(2).replace(".", ",")}</div></div><table><thead><tr><th>Requisição</th><th>Empresa</th><th>Funcionário / CPF</th><th>Exame</th><th>Realização</th><th>Valor</th><th>Comprovante</th></tr></thead><tbody>${
        rows
          .map(
            (row: any) =>
              `<tr><td>${esc(row.order_number)}</td><td>${esc(row.company_name)}<br>${esc(row.company_cnpj || "-")}</td><td>${esc(row.collaborator_name)}<br>${esc(row.cpf || "-")}</td><td>${esc(row.exam_name)}</td><td>${esc(row.performed_at)}</td><td>R$ ${Number(
                row.amount || 0
              )
                .toFixed(2)
                .replace(
                  ".",
                  ","
                )}</td><td class="${row.proof_private_path ? "ok" : "pending"}">${row.proof_private_path ? "Anexado" : "Pendente"}</td></tr>`
          )
          .join("") ||
        `<tr><td colspan="7">Nenhum atendimento no período.</td></tr>`
      }</tbody></table><p>Documento gerado pela plataforma com base nas requisições direcionadas à clínica. Os comprovantes assinados permanecem vinculados individualmente a cada atendimento.</p></body></html>`;
      const file = await renderPdf(
        companyId,
        "provider-billing",
        `demonstrativo_clinica_${userId}_${input.from}_${input.to}.pdf`,
        html
      );
      await clinicAudit(
        db,
        ctx,
        companyId,
        "clinic_billing_pdf_generated",
        "clinic_user",
        userId,
        null,
        {
          from: input.from,
          to: input.to,
          attendances: summary.attendances,
          total: summary.total,
          linkedCompanies: clinics.length,
        }
      );
      return {
        fileName: path.basename(file),
        dataBase64: `data:application/pdf;base64,${fs.readFileSync(file).toString("base64")}`,
      };
    }),
});
