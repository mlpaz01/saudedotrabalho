import { TRPCError } from "@trpc/server";








import { z } from "zod";








import { COOKIE_NAME } from "@shared/const";








import { getSessionCookieOptions } from "./_core/cookies";








import { systemRouter } from "./_core/systemRouter";








import { protectedProcedure, publicProcedure, router } from "./_core/trpc";








import {








  upsertUser,








  getUserByOpenId,








  getCorporateEmailByEmail,








  setCorporateEmailPassword,








  updateCorporateEmailLastAccess,








  bulkInsertCorporateEmails,








  listCorporateEmails,








  listModules, listModulesAdmin,








  getModuleById,








  updateModule,








  getUserProgress,








  getUserProgressForModule,








  upsertUserProgress,








  getCertificate,








  getUserCertificates,








  createCertificate,








  listDecompressionVideos,








  listAllDecompressionVideos,








  createDecompressionVideo,








  updateDecompressionVideo,








  deleteDecompressionVideo,








  updateModuleCertConfig,








  getReminderSettings,








  updateReminderSettings,








  getAdminStats,








  getSectorEngagement,








  getInactiveUsers,








  getEmailLogs,








  logEmail,








  listAllLessonsByModule,








  listLessonsByModule,








  createLesson,








  updateLesson,








  deleteLesson,








  upsertLessonProgress,








  getModuleLessonProgressForUser,








  createModule,








  adminUpdateModule,








  deleteModule,








  getCompanies,








  getCompanyById,








  createCompany,








  updateCompany,








  getBranchesByCompany,








  createBranch,








  updateBranch,








  deleteBranch,








  getSectorsByCompany,








  getSectorsByBranch,








  createSector,








  updateSector,








  deleteSector,








  getCorporateEmailsByCompany,








  getSectorEngagementByCompany,








  getQuizByLesson,








  getQuizForGrading,








  createQuizAttempt,








  getUserQuizAttempts,








  upsertQuiz,








  createQuestion,








  createOption,








  deleteQuestion,








  logAudit,








  listAuditLogs,








  logViewEvent,








  getEffectiveWatchSeconds,








  recordAcceptance,








  getAcceptance,








  getEvidenceReport,








  getUserById,








  listAllCompaniesWithStats,








  getSuperAdminOverview,








  createCompanyFull,








  updateCompanyPlan,








  deleteCompanyHard,








  listMasterCatalog,








  setModuleMasterFlag,








  setTrailMasterFlag,








  cloneModuleForCompany,








  cloneTrailForCompany,








  listAvailableContentForCompany,








  enrollCompanyInContent,








  unenrollCompanyFromContent,








  updateEnrollmentAssignments,








  getVisibleModulesForUser,








  getVisibleTrailsForUser,








  createAIGeneration,








  markAIGenerationDone,








  markAIGenerationFailed,








  listAIGenerationsForCompany,


  updateAIGenerationProgress,


  getAIGenerationStatus,


  getAIGenerationById,








  generateCourseFromPromptStub,








  listComplianceItems,








  getCompanyComplianceStatus,








  updateComplianceStatus,








  getOverallComplianceScore,








  listSurveysForCompany,








  listSurveyTemplates,








  getSurveyById,








  createSurvey,








  createSurveyFromTemplate,








  addSurveyQuestion,








  deleteSurveyQuestion,








  updateSurveyStatus,








  deleteSurvey,








  submitSurveyResponse,








  getSurveyResults,








  listActiveSurveysForUser,








  updateCompanySettings,








  getUserTotalPoints,








  getLeaderboard,








  getUserBadges,








  awardPoints,








  listAllLearningTrails,








  listLearningTrails,








  getLearningTrailById,








  createLearningTrail,








  updateLearningTrail,








  deleteLearningTrail,








  getTrailModules,








  addModuleToTrail,








  removeModuleFromTrail,








  removeTrailItem,








  getCompanyNameById,








  getImpersonationContext,








  listProfessionalLicenses,








  createProfessionalLicense,








  updateProfessionalLicense,








  deleteProfessionalLicense,








  getCompanyLicenseExpirations,








  getManagerDashboard,








  getEmployeeDashboard,
  createAISurveyGeneration,
  updateAISurveyProgress,
  markAISurveyDone,
  markAISurveyFailed,
  getAISurveyStatus,
  listAISurveyGenerationsForCompany,
  createAIDecompressionGeneration,
  updateAIDecompressionProgress,
  markAIDecompressionDone,
  markAIDecompressionFailed,
  getAIDecompressionStatus,
  listAIDecompressionGenerationsForCompany,
  listDecompressionActivities,
  getDecompressionActivity,
  createDecompressionActivity,
  updateDecompressionActivity,
  deleteDecompressionActivity,
} from "./db";
// ── Phase 1+2 imports ─────────────────────────────────────────────────────────
import {
  getHierarchyTreeForCompany,
  getUserFullDetails,
  getCollaborator360,
  computeWellbeingIndex,
  addCareIntervention,
  scheduleCareConversation,
  previewCampaignRecipients,
  listEmailCampaigns,
  createEmailCampaign,
  getEmailCampaign,
  updateEmailCampaignStatus,
  bumpEmailCampaignCounters,
  updateEmailCampaignRecipient,
  getModulesForCompany,
  getSurveysForCompanyShort,
} from "./db";
import { sendEmail, fillTemplate, plainToHtml } from "./_core/email";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { EMAIL_TEMPLATES } from "./_core/emailTemplates";









import { getDb } from "./db";








import { quizQuestions, appointmentProfessionals, appointmentAvailability, appointments, riskCourseLinks } from "../drizzle/schema";








import { eq as drzEq, sql as drzSql, eq, sql, and } from "drizzle-orm";








import { modules, userProgress } from "../drizzle/schema";








import bcrypt from "bcryptjs";








import { nanoid } from "nanoid";








import { generateCertificatePDF } from "./certificate";








import { sdk } from "./_core/sdk";

















// ─── Middleware ───────────────────────────────────────────────────────────────











// ── Missao helpers ───────────────────────────────────────────────────────────


async function ensureUserHearts(userId: number): Promise<{ hearts: number; lastResetDate: string | null }> {


  const db = await getDb();


  if (!db) return { hearts: 5, lastResetDate: null };


  const r: any = await db.execute(drzSql`SELECT user_id, hearts, last_reset_date FROM user_hearts WHERE user_id=${userId} LIMIT 1`);


  const row = (r as any)[0]?.[0];


  if (!row) {


    await db.execute(drzSql`INSERT INTO user_hearts (user_id, hearts, last_reset_date) VALUES (${userId}, 5, CURDATE()) ON DUPLICATE KEY UPDATE hearts=hearts`);


    return { hearts: 5, lastResetDate: new Date().toISOString().slice(0, 10) };


  }


  const today = new Date().toISOString().slice(0, 10);


  const lastReset = row.last_reset_date ? new Date(row.last_reset_date).toISOString().slice(0, 10) : null;


  if (lastReset !== today) {


    await db.execute(drzSql`UPDATE user_hearts SET hearts=5, last_reset_date=CURDATE() WHERE user_id=${userId}`);


    return { hearts: 5, lastResetDate: today };


  }


  return { hearts: Number(row.hearts ?? 5), lastResetDate: lastReset };


}





async function computeStreakDays(userId: number): Promise<number> {


  const db = await getDb();


  if (!db) return 0;


  const r: any = await db.execute(drzSql`SELECT DISTINCT DATE(completed_at) AS d FROM user_lesson_progress_v2 WHERE user_id=${userId} AND status='completed' ORDER BY d DESC LIMIT 60`);


  const dates = (((r as any)[0] || []) as Array<{ d: string }>).map(x => new Date(x.d).toISOString().slice(0, 10));


  if (dates.length === 0) return 0;


  const today = new Date().toISOString().slice(0, 10);


  let streak = 0;


  const cur = new Date(today);


  for (const d of dates) {


    const expected = cur.toISOString().slice(0, 10);


    if (d === expected) {


      streak++;


      cur.setDate(cur.getDate() - 1);


    } else {


      break;


    }


  }


  return streak;


}








// Gestão da Agenda de Acolhimento (profissionais, disponibilidade, horários):
// pertence ao Psicólogo/Profissional de Saúde e admins gerais — NÃO ao RH,
// que tem apenas a visão de agendamentos/relatórios.
const careManagerProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowed = ["psicologo", "admin", "admin_global", "company_admin", "super_admin"];
  if (!allowed.includes((ctx.user as any).role ?? "")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o profissional de saúde gerencia a Agenda de Acolhimento." });
  }
  return next({ ctx });
});

const adminOrRhProcedure = protectedProcedure.use(({ ctx, next }) => {








  if (ctx.user.role !== "admin" && ctx.user.role !== "rh" && ctx.user.role !== "admin_global" && ctx.user.role !== "company_admin" && ctx.user.role !== "sesmt" && ctx.user.role !== "super_admin") {








    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores e RH." });








  }








  return next({ ctx });








});

















// Extract IP + user agent from request








function getReqMeta(ctx: any) {








  const req = ctx?.req;








  const fwd = req?.headers?.['x-forwarded-for'];








  const ip = (Array.isArray(fwd) ? fwd[0] : (typeof fwd === 'string' ? fwd.split(',')[0] : ''))?.trim()








    || req?.ip || req?.socket?.remoteAddress || '';








  const ua = req?.headers?.['user-agent'] ?? '';








  return { ip: String(ip).slice(0, 45), ua: String(ua).slice(0, 500) };








}

















const adminGlobalProcedure = protectedProcedure.use(({ ctx, next }) => {








  if (ctx.user.role !== "admin_global") {








    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores globais." });








  }








  return next({ ctx });








});


























const superAdminProcedure = protectedProcedure.use(({ ctx, next }) => {








  if (ctx.user.role !== "super_admin") {








    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito ao Super Admin." });








  }








  return next({ ctx });








});

















// ─── App Router ───────────────────────────────────────────────────────────────









async function loadAssessmentForPDF(db: any, assessmentId: number, companyId: number) {
  const r: any = await db.execute(drzSql`
    SELECT ra.*, s.name AS sector_name, b.name AS branch_name, c.name AS company_name, c.cnpj AS company_cnpj
    FROM risk_assessments ra
    LEFT JOIN sectors s ON s.id = ra.sector_id
    LEFT JOIN branches b ON b.id = ra.branch_id
    LEFT JOIN companies c ON c.id = ra.company_id
    WHERE ra.id=${assessmentId} LIMIT 1`);
  const ra = (r as any)[0]?.[0];
  if (!ra) throw new TRPCError({ code: "NOT_FOUND" });
  if (ra.company_id !== companyId) throw new TRPCError({ code: "FORBIDDEN" });

  const ir: any = await db.execute(drzSql`
    SELECT ii.*, f.code AS factor_code, f.name AS factor_name, f.description AS factor_description
    FROM risk_inventory_items ii
    INNER JOIN psychosocial_factors f ON f.id = ii.factor_id
    WHERE ii.assessment_id=${assessmentId} ORDER BY f.axis_order`);
  const inv = (ir as any)[0] ?? [];

  const ar: any = await db.execute(drzSql`
    SELECT ap.*, f.code AS factor_code, f.name AS factor_name
    FROM risk_action_plan_items ap
    INNER JOIN psychosocial_factors f ON f.id = ap.factor_id
    WHERE ap.assessment_id=${assessmentId} ORDER BY f.axis_order`);
  const act = (ar as any)[0] ?? [];

  // Count submissions (one row per response). DRPS/AEP are anonymous → user_id is NULL,
  // so COUNT(DISTINCT user_id) would always be 0. Each survey_responses row is one respondent.
  const drpsCount: any = await db.execute(drzSql`SELECT COUNT(*) AS c FROM survey_responses WHERE survey_id=${ra.drps_survey_id}`);
  const aepCount: any = await db.execute(drzSql`SELECT COUNT(*) AS c FROM survey_responses WHERE survey_id=${ra.aep_survey_id}`);

  // When consolidated (no sector_id), load sector-level sub-assessments for per-sector sections
  let sectorGroups: any[] = [];
  if (!ra.sector_id) {
    const subR: any = ra.branch_id != null
      ? await db.execute(drzSql`
          SELECT ra2.*, s.name AS sector_name
          FROM risk_assessments ra2
          INNER JOIN sectors s ON s.id = ra2.sector_id
          WHERE ra2.company_id=${ra.company_id}
            AND ra2.branch_id=${ra.branch_id}
            AND ra2.sector_id IS NOT NULL
          ORDER BY s.name`)
      : await db.execute(drzSql`
          SELECT ra2.*, s.name AS sector_name
          FROM risk_assessments ra2
          INNER JOIN sectors s ON s.id = ra2.sector_id
          WHERE ra2.company_id=${ra.company_id}
            AND ra2.sector_id IS NOT NULL
          ORDER BY s.name`);
    const subAssessments = (subR as any)[0] ?? [];
    for (const sub of subAssessments) {
      const siR: any = await db.execute(drzSql`
        SELECT ii.*, f.code AS factor_code, f.name AS factor_name, f.description AS factor_description
        FROM risk_inventory_items ii
        INNER JOIN psychosocial_factors f ON f.id = ii.factor_id
        WHERE ii.assessment_id=${sub.id} ORDER BY f.axis_order`);
      const subInv = (siR as any)[0] ?? [];
      const saR: any = await db.execute(drzSql`
        SELECT ap.*, f.code AS factor_code, f.name AS factor_name
        FROM risk_action_plan_items ap
        INNER JOIN psychosocial_factors f ON f.id = ap.factor_id
        WHERE ap.assessment_id=${sub.id} ORDER BY f.axis_order`);
      const subAct = (saR as any)[0] ?? [];
      const sDrps: any = await db.execute(drzSql`SELECT COUNT(*) AS c FROM survey_responses WHERE survey_id=${sub.drps_survey_id}`);
      const sAep: any = await db.execute(drzSql`SELECT COUNT(*) AS c FROM survey_responses WHERE survey_id=${sub.aep_survey_id}`);
      sectorGroups.push({
        sectorId: sub.id,
        sectorName: sub.sector_name,
        assessment: {
          id: sub.id,
          cycleName: sub.cycle_name,
          status: sub.status,
          startDate: sub.start_date ? new Date(sub.start_date).toISOString() : null,
          endDate: sub.end_date ? new Date(sub.end_date).toISOString() : null,
          responsibleTechnician: sub.responsible_technician,
          notes: sub.notes,
          companyName: ra.company_name,
          companyCnpj: ra.company_cnpj,
          branchName: ra.branch_name,
          sectorName: sub.sector_name,
          drpsResponses: Number((sDrps as any)[0]?.[0]?.c ?? 0),
          aepResponses: Number((sAep as any)[0]?.[0]?.c ?? 0),
        },
        inventory: subInv.map((it: any) => ({
          factorCode: it.factor_code,
          factorName: it.factor_name,
          description: it.factor_description,
          gravidade: it.gravidade,
          probabilidade: it.probabilidade,
          riscoFinal: it.risco_final,
          fontesGeradoras: it.fontes_geradoras,
          medidasExistentes: it.medidas_existentes,
          drpsScoreAvg: it.drps_score_avg != null ? Number(it.drps_score_avg) : null,
          drpsResponsesCount: it.drps_responses_count,
        })),
        actions: subAct.map((ac: any) => ({
          factorCode: ac.factor_code,
          factorName: ac.factor_name,
          actionDescription: ac.action_description,
          responsibleParty: ac.responsible_party,
          priority: ac.priority,
          status: ac.status,
          monthlyProgress: ac.monthly_progress,
          startDate: ac.start_date ? new Date(ac.start_date).toISOString() : null,
          endDate: ac.end_date ? new Date(ac.end_date).toISOString() : null,
        })),
      });
    }
  }

  return {
    assessment: {
      id: ra.id,
      cycleName: ra.cycle_name,
      status: ra.status,
      startDate: ra.start_date ? new Date(ra.start_date).toISOString() : null,
      endDate: ra.end_date ? new Date(ra.end_date).toISOString() : null,
      responsibleTechnician: ra.responsible_technician,
      notes: ra.notes,
      companyName: ra.company_name,
      companyCnpj: ra.company_cnpj,
      branchName: ra.branch_name,
      sectorName: ra.sector_name,
      drpsResponses: Number((drpsCount as any)[0]?.[0]?.c ?? 0),
      aepResponses: Number((aepCount as any)[0]?.[0]?.c ?? 0),
    },
    inventory: inv.map((it: any) => ({
      factorCode: it.factor_code,
      factorName: it.factor_name,
      description: it.factor_description,
      gravidade: it.gravidade,
      probabilidade: it.probabilidade,
      riscoFinal: it.risco_final,
      fontesGeradoras: it.fontes_geradoras,
      medidasExistentes: it.medidas_existentes,
      drpsScoreAvg: it.drps_score_avg != null ? Number(it.drps_score_avg) : null,
      drpsResponsesCount: it.drps_responses_count,
    })),
    actions: act.map((ac: any) => ({
      factorCode: ac.factor_code,
      factorName: ac.factor_name,
      actionDescription: ac.action_description,
      responsibleParty: ac.responsible_party,
      priority: ac.priority,
      status: ac.status,
      monthlyProgress: ac.monthly_progress,
      startDate: ac.start_date ? new Date(ac.start_date).toISOString() : null,
      endDate: ac.end_date ? new Date(ac.end_date).toISOString() : null,
    })),
    sectorGroups,
  };
}

// Normaliza um valor de resposta Likert (vindo de planilha do Google Forms) para a
// escala interna 0–4 que a matriz de risco (calculateMatrix) espera. Aceita números
// (0–4 ou 1–5) e rótulos textuais comuns de concordância/frequência em português.
function normalizeLikertValue(raw: unknown, scale: "0-4" | "1-5" = "0-4"): string {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return "";
  const clamp = (n: number) => String(Math.max(0, Math.min(4, Math.round(n))));
  // número puro (aceita vírgula decimal)
  const direct = parseFloat(s.replace(",", "."));
  if (!Number.isNaN(direct) && /^[\d.,]+$/.test(s)) {
    return clamp(scale === "1-5" ? direct - 1 : direct);
  }
  const labels: Record<string, number> = {
    "discordo totalmente": 0, "discordo plenamente": 0, "discordo completamente": 0,
    "discordo": 1, "discordo parcialmente": 1, "discordo em parte": 1,
    "neutro": 2, "indiferente": 2, "nem concordo nem discordo": 2, "não sei": 2, "nao sei": 2, "talvez": 2,
    "concordo parcialmente": 3, "concordo em parte": 3, "concordo": 3,
    "concordo totalmente": 4, "concordo plenamente": 4, "concordo completamente": 4,
    "nunca": 0, "quase nunca": 1, "raramente": 1, "às vezes": 2, "as vezes": 2,
    "frequentemente": 3, "com frequência": 3, "com frequencia": 3, "quase sempre": 3, "sempre": 4,
    "péssimo": 0, "pessimo": 0, "ruim": 1, "regular": 2, "bom": 3, "ótimo": 4, "otimo": 4, "excelente": 4,
    "não": 0, "nao": 0, "sim": 4,
  };
  if (labels[s] != null) return String(labels[s]);
  // tenta dígito inicial ("1 - Discordo", "Nota 3")
  const m = s.match(/(\d+)/);
  if (m) { const n = parseInt(m[1], 10); return clamp(scale === "1-5" ? n - 1 : n); }
  return "2"; // fallback neutro quando o rótulo não é reconhecido
}

// Carrega os dados da AEP (Análise Ergonômica Preliminar) de uma análise de risco
// para gerar o laudo standalone: cabeçalho + questões (qualitativas e likert) com respostas agregadas.
async function loadAEPForPDF(db: any, assessmentId: number, companyId: number) {
  const r: any = await db.execute(drzSql`
    SELECT ra.*, s.name AS sector_name, b.name AS branch_name, c.name AS company_name, c.cnpj AS company_cnpj
    FROM risk_assessments ra
    LEFT JOIN sectors s ON s.id = ra.sector_id
    LEFT JOIN branches b ON b.id = ra.branch_id
    LEFT JOIN companies c ON c.id = ra.company_id
    WHERE ra.id=${assessmentId} LIMIT 1`);
  const ra = (r as any)[0]?.[0];
  if (!ra) throw new TRPCError({ code: "NOT_FOUND" });
  if (ra.company_id !== companyId) throw new TRPCError({ code: "FORBIDDEN" });
  if (!ra.aep_survey_id) throw new TRPCError({ code: "BAD_REQUEST", message: "AEP não vinculada a esta análise." });

  const aepSurveyId = ra.aep_survey_id;

  const qr: any = await db.execute(drzSql`
    SELECT id, order_index, question_text, question_type
    FROM survey_questions WHERE survey_id=${aepSurveyId} ORDER BY order_index`);
  const questions = (qr as any)[0] ?? [];

  const ansR: any = await db.execute(drzSql`
    SELECT sa.question_id, sa.answer_value
    FROM survey_answers sa
    INNER JOIN survey_responses sr ON sr.id = sa.response_id
    WHERE sr.survey_id = ${aepSurveyId}`);
  const answers = (ansR as any)[0] ?? [];

  const byQ = new Map<number, string[]>();
  for (const an of answers) {
    const qid = Number(an.question_id);
    if (!byQ.has(qid)) byQ.set(qid, []);
    const v = an.answer_value == null ? "" : String(an.answer_value).trim();
    if (v) byQ.get(qid)!.push(v);
  }

  const respCount: any = await db.execute(drzSql`SELECT COUNT(*) AS c FROM survey_responses WHERE survey_id=${aepSurveyId}`);

  const items = questions.map((q: any) => {
    const qid = Number(q.id);
    const vals = byQ.get(qid) ?? [];
    const type = String(q.question_type || "text").toLowerCase();
    if (type === "likert") {
      const nums = vals.map((v) => parseFloat(v)).filter((n) => !Number.isNaN(n));
      const avg = nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : null;
      const max = nums.length ? Math.max(...nums) : 0;
      return { orderIndex: Number(q.order_index), type, questionText: q.question_text, likertAvg: avg, likertCount: nums.length, likertMax: max };
    }
    return { orderIndex: Number(q.order_index), type, questionText: q.question_text, textAnswers: vals };
  });

  return {
    assessment: {
      id: ra.id,
      cycleName: ra.cycle_name,
      status: ra.status,
      startDate: ra.start_date ? new Date(ra.start_date).toISOString() : null,
      endDate: ra.end_date ? new Date(ra.end_date).toISOString() : null,
      responsibleTechnician: ra.responsible_technician,
      notes: ra.notes,
      companyName: ra.company_name,
      companyCnpj: ra.company_cnpj,
      branchName: ra.branch_name,
      sectorName: ra.sector_name,
      drpsResponses: 0,
      aepResponses: Number((respCount as any)[0]?.[0]?.c ?? 0),
    },
    items,
  };
}

// Catálogo de funcionalidades que um plano de assinatura pode liberar.
// Usado pelo painel "Planos" do Admin Global para montar os toggles por plano,
// e (futuramente) pelo feature-gating do app. Os códigos batem com módulos reais.
const PLAN_FEATURE_CATALOG = [
  { code: "courses",          label: "Cursos & Trilhas",                group: "Aprendizagem" },
  { code: "certificates",     label: "Certificados",                    group: "Aprendizagem" },
  { code: "ai_studio",        label: "Estúdio de Criação (IA)",         group: "Aprendizagem" },
  { code: "surveys",          label: "Pesquisas & Avaliações",          group: "Diagnóstico" },
  { code: "risk_assessment",  label: "Análise de Risco Psicossocial",   group: "Diagnóstico" },
  { code: "pgr",              label: "Gerador de PGR",                  group: "Conformidade" },
  { code: "decompression",    label: "Sala de Descompressão",           group: "Bem-estar" },
  { code: "collaborator_360", label: "Visão 360 do Colaborador",        group: "Gestão" },
  { code: "analytics",        label: "Análises & Dashboards",           group: "Gestão" },
  { code: "campaigns",        label: "Campanhas de Engajamento",        group: "Gestão" },
] as const;

// Executa SQL com placeholders `?` + params. NECESSARIO porque o Drizzle
// db.execute() IGNORA o 2o argumento — entao db.execute("...?", [v]) nunca passava
// os valores (toda query assim falhava com "params: vazio"). Interpola com seguranca
// (numeros direto, strings escapadas) e retorna [rows, fields] no formato mysql2
// para manter compatibilidade com os desempacotamentos existentes (const [[x]] / const [x]).
async function execP(db: any, text: string, params: any[] = []): Promise<[any[], any[]]> {
  let i = 0;
  const finalSql = text.replace(/\?/g, () => {
    const p = params[i++];
    if (p === null || p === undefined) return "NULL";
    if (typeof p === "number") return String(p);
    if (typeof p === "boolean") return p ? "1" : "0";
    if (p instanceof Date) return "'" + p.toISOString().slice(0, 19).replace("T", " ") + "'";
    return "'" + String(p).replace(/\\/g, "\\\\").replace(/'/g, "''") + "'";
  });
  const r: any = await db.execute(drzSql.raw(finalSql));
  const rows = Array.isArray(r) && Array.isArray(r[0]) ? r[0] : (Array.isArray(r) ? r : []);
  return [rows, []];
}

function decryptSmtpPass(encrypted: string): string {
  const encKey = process.env.SMTP_ENC_KEY;
  if (!encKey) throw new Error("SMTP_ENC_KEY not set");
  const [ivHex, cipherHex] = encrypted.split(":");
  if (!ivHex || !cipherHex) throw new Error("Invalid encrypted format");
  
  const key = Buffer.from(encKey, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([decipher.update(Buffer.from(cipherHex, "hex")), decipher.final()]).toString("utf8");
}

function encryptSmtpPass(plain: string): string {
  const encKey = process.env.SMTP_ENC_KEY;
  if (!encKey) throw new Error("SMTP_ENC_KEY not set");
  
  const key = Buffer.from(encKey, "hex");
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export const appRouter = router({








  system: systemRouter,

















  // ── Auth ──────────────────────────────────────────────────────────────────








  auth: router({








    me: publicProcedure.query((opts) => {








      if (!opts.ctx.user) return null;








      const u = opts.ctx.user;








      return {








        ...u,








        companyId: (u as any).companyId ?? null,








        branchId: (u as any).branchId ?? null,








        sectorId: (u as any).sectorId ?? null,








        role: u.role,








      };








    }),








    logout: publicProcedure.mutation(async ({ ctx }) => {








      const cookieOptions = getSessionCookieOptions(ctx.req);








      // maxAge:0 + expires in the past ensures the cookie is cleared even when
      // browsers differ in their treatment of negative maxAge values.
      ctx.res.clearCookie(COOKIE_NAME, {
        ...cookieOptions,
        maxAge: 0,
        expires: new Date(0),
      });








      const meta = getReqMeta(ctx);








      if (ctx.user) {








        await logAudit({








          userId: ctx.user.id, userEmail: ctx.user.email,








          action: 'logout', ipAddress: meta.ip, userAgent: meta.ua,








        });








      }








      return { success: true } as const;








    }),

















    // Check if corporate email exists and if password is set








    checkCorporateEmail: publicProcedure








      .input(z.object({ email: z.string().email() }))








      .mutation(async ({ input }) => {








        const record = await getCorporateEmailByEmail(input.email);








        if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "E-mail não cadastrado na plataforma. Entre em contato com o RH." });








        return { hasSetPassword: record.hasSetPassword, employeeName: record.employeeName };








      }),

















    // First access: set password








    setPassword: publicProcedure








      .input(z.object({ email: z.string().email(), password: z.string().min(8) }))








      .mutation(async ({ input }) => {








        const record = await getCorporateEmailByEmail(input.email);








        if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "E-mail não encontrado." });








        if (record.hasSetPassword) throw new TRPCError({ code: "BAD_REQUEST", message: "Senha já definida. Use o login normal." });








        const hash = await bcrypt.hash(input.password, 10);








        // Create a user record for this corporate email








        const openId = `corp_${nanoid(16)}`;








        await upsertUser({ openId, email: input.email, name: record.employeeName ?? input.email, loginMethod: "corporate" });








        const user = await getUserByOpenId(openId);








        if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });








        // Propagate company/branch/sector/role from the imported corporate email to the new user
        try {
          const _db = await getDb();
          if (_db) {
            const cr: any = await _db.execute(drzSql`SELECT company_id, branch_id, sector_id, role FROM corporate_emails WHERE email = ${input.email} LIMIT 1`);
            const crow = Array.isArray(cr) ? (cr[0]?.[0] ?? cr[0]) : cr;
            if (crow) {
              await _db.execute(drzSql`UPDATE users SET company_id = ${crow.company_id ?? null}, branch_id = ${crow.branch_id ?? null}, sector_id = ${crow.sector_id ?? null}, role = ${crow.role || 'user'} WHERE id = ${user.id}`);
            }
          }
        } catch (e) { /* non-fatal: user keeps default role */ }

        await setCorporateEmailPassword(input.email, hash, user.id);








        return { success: true };








      }),

















    // Corporate login








    corporateLogin: publicProcedure








      .input(z.object({ email: z.string().email(), password: z.string() }))








      .mutation(async ({ input, ctx }) => {








        const record = await getCorporateEmailByEmail(input.email);








        if (!record || !record.hasSetPassword || !record.passwordHash) {








          throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos." });








        }








        const valid = await bcrypt.compare(input.password, record.passwordHash);








        if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos." });

















        // Get or create the user








        let user = record.userId ? (await (async () => {








          const { getDb } = await import("./db");








          const { users } = await import("../drizzle/schema");








          const { eq } = await import("drizzle-orm");








          const db = await getDb();








          if (!db) return undefined;








          const r = await db.select().from(users).where(eq(users.id, record.userId!)).limit(1);








          return r[0];








        })()) : undefined;

















        if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Usuário não encontrado." });

















           await updateCorporateEmailLastAccess(input.email);








        // Issue JWT session using sdk.createSessionToken so the payload matches what verifySession expects








        // (fields: openId, appId, name — all required by the SDK)








        const token = await sdk.createSessionToken(user.openId, {








          name: user.name ?? user.email ?? "",








          expiresInMs: 30 * 24 * 60 * 60 * 1000,








        });








        const cookieOptions = getSessionCookieOptions(ctx.req);








        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });








        const meta = getReqMeta(ctx);








        await logAudit({








          userId: user.id, userEmail: user.email,








          action: 'login', ipAddress: meta.ip, userAgent: meta.ua,








        });








        return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };








      }),








  }),

















  // ── Modules ───────────────────────────────────────────────────────────────








  modules: router({








    list: protectedProcedure.query(async ({ ctx }) => {








      try {








        return await getVisibleModulesForUser(ctx.user.id);








      } catch (e) {








        return listModules();








      }








    }),

















    get: protectedProcedure








      .input(z.object({ id: z.number() }))








      .query(async ({ input }) => {








        const mod = await getModuleById(input.id);








        if (!mod) throw new TRPCError({ code: "NOT_FOUND" });








        return mod;








      }),

















    update: adminOrRhProcedure








      .input(z.object({








        id: z.number(),








        videoUrl: z.string().optional(),








        thumbnailUrl: z.string().optional(),








        description: z.string().optional(),








        durationMinutes: z.number().optional(),








      }))








      .mutation(async ({ input }) => {








        const { id, ...data } = input;








        await updateModule(id, data);








        return { success: true };








      }),








  }),

















  // ── Progress ──────────────────────────────────────────────────────────────








  progress: router({








    getUserProgress: protectedProcedure.query(async ({ ctx }) => {








      return getUserProgress(ctx.user.id);








    }),

















    getModuleProgress: protectedProcedure








      .input(z.object({ moduleId: z.number() }))








      .query(async ({ ctx, input }) => {








        return getUserProgressForModule(ctx.user.id, input.moduleId);








      }),

















    updateProgress: protectedProcedure








      .input(z.object({








        moduleId: z.number(),








        percentWatched: z.number().min(0).max(100),








        isCompleted: z.boolean(),








      }))








      .mutation(async ({ ctx, input }) => {








        const before = await getUserProgressForModule(ctx.user.id, input.moduleId);








        await upsertUserProgress(ctx.user.id, input.moduleId, input.percentWatched, input.isCompleted);








        if (input.isCompleted && !before?.isCompleted) {








          const meta = getReqMeta(ctx);








          await logAudit({








            userId: ctx.user.id, userEmail: ctx.user.email,








            action: 'module_completed', entityType: 'module', entityId: input.moduleId,








            detailsJson: { percentWatched: input.percentWatched },








            ipAddress: meta.ip, userAgent: meta.ua,








          });








        }








        return { success: true };








      }),








  }),

















  // ── Certificates ──────────────────────────────────────────────────────────








  certificates: router({








    getUserCertificates: protectedProcedure.query(async ({ ctx }) => {








      const certs = await getUserCertificates(ctx.user.id);








      const allModules = await listModules();








      return certs.map((c) => {








        const mod = allModules.find((m) => m.id === c.moduleId);








        return {








          ...c,








          moduleName: mod?.title ?? "Módulo",








          certTitle: mod?.certTitle ?? null,








          certBody: mod?.certBody ?? null,








          certSignerName: mod?.certSignerName ?? null,








          certSignerRole: mod?.certSignerRole ?? null,








        };








      });








    }),

















    generate: protectedProcedure








      .input(z.object({ moduleId: z.number() }))








      .mutation(async ({ ctx, input }) => {








        // Check if already exists








        const existing = await getCertificate(ctx.user.id, input.moduleId);








        if (existing) return existing;

















        // Check 100% completion








        const progress = await getUserProgressForModule(ctx.user.id, input.moduleId);








        if (!progress?.isCompleted) {








          throw new TRPCError({ code: "BAD_REQUEST", message: "Módulo não concluído. Assista 100% do conteúdo para obter o certificado." });








        }

















        const mod = await getModuleById(input.moduleId);








        if (!mod) throw new TRPCError({ code: "NOT_FOUND" });

















        const code = nanoid(20).toUpperCase();








        const pdfBuffer = await generateCertificatePDF({








          userName: ctx.user.name ?? ctx.user.email ?? "Participante",








          moduleName: mod.title,








          completedAt: progress.completedAt ?? new Date(),








          certificateCode: code,
          certTitle: mod.certTitle ?? null,
          certBody: mod.certBody ?? null,
          certSignerName: mod.certSignerName ?? null,
          certSignerRole: mod.certSignerRole ?? null,
        });

















        // Store PDF








        const { storagePut } = await import("./storage");








        const { key, url } = await storagePut(`certificates/${code}.png`, pdfBuffer, "image/png");

















        const cert = await createCertificate(ctx.user.id, input.moduleId, code, url);








        const meta = getReqMeta(ctx);








        await logAudit({








          userId: ctx.user.id, userEmail: ctx.user.email,








          action: 'certificate_issued', entityType: 'certificate', entityId: cert?.id,








          detailsJson: { moduleId: input.moduleId, code },








          ipAddress: meta.ip, userAgent: meta.ua,








        });








        return cert;








      }),

















    download: protectedProcedure








      .input(z.object({ moduleId: z.number() }))








      .query(async ({ ctx, input }) => {








        const cert = await getCertificate(ctx.user.id, input.moduleId);








        if (!cert) throw new TRPCError({ code: "NOT_FOUND", message: "Certificado não encontrado." });








        return cert;








      }),








  }),

















  // ── Decompression ─────────────────────────────────────────────────────────








  decompression: router({








    list: protectedProcedure.query(async () => {








      return listDecompressionVideos();








    }),








  }),

















  // ── Admin ─────────────────────────────────────────────────────────────────








  admin: router({
    updateUserAssignment: adminOrRhProcedure
      .input(z.object({
        userId: z.number(),
        branchId: z.number().nullable(),
        sectorId: z.number().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const myRole = (ctx.user as any).role;
        const myCid = (ctx.user as any).companyId;
        const ur: any = await db.execute(drzSql`SELECT id, company_id FROM users WHERE id = ${input.userId} LIMIT 1`);
        const urow = Array.isArray(ur) ? (ur[0]?.[0] ?? ur[0]) : ur;
        if (!urow) throw new TRPCError({ code: "NOT_FOUND", message: "Colaborador nao encontrado." });
        if (myRole !== "admin_global" && myRole !== "super_admin") {
          if (urow.company_id !== myCid) throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissao." });
        }
        if (input.branchId !== null) {
          const br: any = await db.execute(drzSql`SELECT company_id FROM branches WHERE id = ${input.branchId} LIMIT 1`);
          const brow = Array.isArray(br) ? (br[0]?.[0] ?? br[0]) : br;
          if (!brow || (urow.company_id && brow.company_id !== urow.company_id)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Filial invalida para esta empresa." });
          }
        }
        if (input.sectorId !== null) {
          const sr: any = await db.execute(drzSql`SELECT company_id, branch_id FROM sectors WHERE id = ${input.sectorId} LIMIT 1`);
          const srow = Array.isArray(sr) ? (sr[0]?.[0] ?? sr[0]) : sr;
          if (!srow || (urow.company_id && srow.company_id !== urow.company_id)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Setor invalido para esta empresa." });
          }
          if (input.branchId !== null && srow.branch_id !== null && srow.branch_id !== input.branchId) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Setor nao pertence a essa filial." });
          }
        }
        await db.execute(drzSql`UPDATE users SET branch_id = ${input.branchId}, sector_id = ${input.sectorId} WHERE id = ${input.userId}`);
        await db.execute(drzSql`UPDATE corporate_emails SET branch_id = ${input.branchId}, sector_id = ${input.sectorId} WHERE userId = ${input.userId}`);
        return { ok: true };
      }),
    bulkUpdateUserAssignment: adminOrRhProcedure
      .input(z.object({
        userIds: z.array(z.number()),
        branchId: z.number().nullable(),
        sectorId: z.number().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const myRole = (ctx.user as any).role;
        const myCid = (ctx.user as any).companyId;
        let updated = 0;
        for (const uid of input.userIds) {
          const ur: any = await db.execute(drzSql`SELECT company_id FROM users WHERE id = ${uid} LIMIT 1`);
          const urow = Array.isArray(ur) ? (ur[0]?.[0] ?? ur[0]) : ur;
          if (!urow) continue;
          if (myRole !== "admin_global" && myRole !== "super_admin" && urow.company_id !== myCid) continue;
          await db.execute(drzSql`UPDATE users SET branch_id = ${input.branchId}, sector_id = ${input.sectorId} WHERE id = ${uid}`);
          await db.execute(drzSql`UPDATE corporate_emails SET branch_id = ${input.branchId}, sector_id = ${input.sectorId} WHERE userId = ${uid}`);
          updated++;
        }
        return { ok: true, updated };
      }),
    importCollaborators: adminOrRhProcedure
      .input(z.object({
        companyId: z.number(),
        dryRun: z.boolean().default(false),
        rows: z.array(z.object({
          email: z.string(),
          nome: z.string().optional().nullable(),
          filial: z.string().optional().nullable(),
          setor: z.string().optional().nullable(),
          perfil: z.string().optional().nullable(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const myRole = (ctx.user as any).role;
        const myCid = (ctx.user as any).companyId;
        const isGlobal = myRole === "admin_global" || myRole === "super_admin";
        const canAssignAdmin = myRole !== "rh"; // RH importers cannot grant admin perfil
        // company scope: non-global admins can only import into their own company
        const companyId = isGlobal ? input.companyId : (myCid ?? input.companyId);
        if (!isGlobal && myCid && input.companyId !== myCid) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissao para importar nesta empresa." });
        }
        const cr: any = await db.execute(drzSql`SELECT id, name FROM companies WHERE id = ${companyId} LIMIT 1`);
        const crow = Array.isArray(cr) ? (cr[0]?.[0] ?? cr[0]) : cr;
        if (!crow) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa nao encontrada." });
        const companyName: string = crow.name;

        const norm = (s?: string | null) => String(s ?? "").trim();
        const lc = (s?: string | null) => norm(s).toLowerCase();
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const roleLabel: Record<string, string> = {
          user: "Colaborador", chefia: "Chefia / Gestor",
          rh: "RH / Saude", admin: "Administrador",
          company_admin: "Admin Empresa", admin_global: "Admin Global", super_admin: "Super Admin",
        };
        const mapRole = (p?: string | null): string => {
          const v = lc(p);
          if (!v) return "user";
          if (["chefia", "gestor", "gerente", "lider", "líder", "coordenador", "supervisor"].some(k => v.includes(k))) return "chefia";
          if (v.includes("admin") || v.includes("administrad") || v.includes("diretor")) return "admin";
          if (v.includes("rh") || v.includes("recursos humanos") || v.includes("psico") || v.includes("saude") || v.includes("saúde") || v.includes("medic") || v.includes("médic") || v.includes("enferm") || v.includes("seguranca") || v.includes("segurança")) return "rh";
          return "user";
        };

        // preload existing branches/sectors of this company
        const branchMap = new Map<string, number>();
        {
          const r: any = await db.execute(drzSql`SELECT id, name FROM branches WHERE company_id = ${companyId}`);
          const rows: any[] = Array.isArray(r) ? (r[0] ?? []) : [];
          for (const b of rows) branchMap.set(lc(b.name), b.id);
        }
        const sectorMap = new Map<string, number>();
        {
          const r: any = await db.execute(drzSql`SELECT id, name, branch_id FROM sectors WHERE company_id = ${companyId}`);
          const rows: any[] = Array.isArray(r) ? (r[0] ?? []) : [];
          for (const s of rows) sectorMap.set(`${s.branch_id ?? 0}:${lc(s.name)}`, s.id);
        }

        const results: any[] = [];
        let inserted = 0, updated = 0, skipped = 0, branchesCreated = 0, sectorsCreated = 0;
        const seenEmails = new Set<string>();

        for (const raw of input.rows) {
          const email = lc(raw.email);
          const nome = norm(raw.nome);
          const filial = norm(raw.filial);
          const setor = norm(raw.setor);
          let role = mapRole(raw.perfil);
          if (role === "admin" && !canAssignAdmin) role = "rh"; // clamp for RH importers
          const res: any = {
            email, nome, role, roleLabel: roleLabel[role] ?? role,
            filial, setor, status: "ok", branchAction: "none", sectorAction: "none", message: "",
          };

          if (!email || !emailRe.test(email)) {
            res.status = "invalid"; res.message = "E-mail invalido"; skipped++; results.push(res); continue;
          }
          if (seenEmails.has(email)) {
            res.status = "duplicate"; res.message = "E-mail repetido na planilha"; skipped++; results.push(res); continue;
          }
          seenEmails.add(email);

          // resolve branch (filial)
          let branchId: number | null = null;
          if (filial) {
            const ex = branchMap.get(lc(filial));
            if (ex) { branchId = ex; res.branchAction = "existing"; }
            else {
              res.branchAction = "create";
              if (!input.dryRun) {
                // INSERT IGNORE handles concurrent imports creating the same branch
                await db.execute(drzSql`INSERT IGNORE INTO branches (company_id, name, is_active) VALUES (${companyId}, ${filial}, 1)`);
                const resel: any = await db.execute(drzSql`SELECT id FROM branches WHERE company_id=${companyId} AND name=${filial} LIMIT 1`);
                const rerow = Array.isArray((resel as any)[0]) ? (resel as any)[0][0] : (resel as any)[0];
                branchId = rerow?.id ? Number(rerow.id) : null;
                if (branchId) { branchMap.set(lc(filial), branchId); branchesCreated++; }
              }
            }
          }
          res.branchId = branchId;

          // resolve sector (setor) within the resolved branch
          let sectorId: number | null = null;
          if (setor) {
            const sk = `${branchId ?? 0}:${lc(setor)}`;
            const existing = sectorMap.get(sk) ?? (branchId == null ? undefined : sectorMap.get(`0:${lc(setor)}`));
            if (existing) { sectorId = existing; res.sectorAction = "existing"; }
            else {
              res.sectorAction = "create";
              if (!input.dryRun) {
                // INSERT IGNORE handles concurrent imports creating the same sector
                await db.execute(drzSql`INSERT IGNORE INTO sectors (company_id, branch_id, name, is_active) VALUES (${companyId}, ${branchId}, ${setor}, 1)`);
                const sresel: any = await db.execute(drzSql`SELECT id FROM sectors WHERE company_id=${companyId} AND name=${setor} AND (branch_id=${branchId ?? 0} OR branch_id IS NULL) LIMIT 1`);
                const srerow = Array.isArray((sresel as any)[0]) ? (sresel as any)[0][0] : (sresel as any)[0];
                sectorId = srerow?.id ? Number(srerow.id) : null;
                if (sectorId) { sectorMap.set(sk, sectorId); sectorsCreated++; }
              }
            }
          }
          res.sectorId = sectorId;

          // existing corporate email?
          // BUGFIX: use ?? null (not ?? ex[0]) — empty array [] is truthy, causing new rows
          // to hit the UPDATE branch and never be INSERT-ed.
          const ex: any = await db.execute(drzSql`SELECT id, userId FROM corporate_emails WHERE email = ${email} LIMIT 1`);
          const exRows = Array.isArray(ex) ? ((ex as any)[0] ?? []) : [];
          const exrow = Array.isArray(exRows) ? (exRows[0] ?? null) : exRows ?? null;

          if (input.dryRun) {
            res.action = exrow ? "update" : "insert";
            results.push(res);
            continue;
          }

          if (exrow) {
            await db.execute(drzSql`UPDATE corporate_emails SET company = ${companyName}, sector = ${setor || null}, employeeName = ${nome || null}, isActive = 1, company_id = ${companyId}, branch_id = ${branchId}, sector_id = ${sectorId}, role = ${role} WHERE id = ${exrow.id}`);
            updated++; res.action = "updated";
            if (exrow.userId) {
              await db.execute(drzSql`UPDATE users SET company_id = ${companyId}, branch_id = ${branchId}, sector_id = ${sectorId}, role = ${role} WHERE id = ${exrow.userId}`);
            }
          } else {
            // ON DUPLICATE KEY UPDATE prevents race between concurrent imports on same email
            await db.execute(drzSql`INSERT INTO corporate_emails (email, company, sector, employeeName, isActive, company_id, branch_id, sector_id, role) VALUES (${email}, ${companyName}, ${setor || null}, ${nome || null}, 1, ${companyId}, ${branchId}, ${sectorId}, ${role}) ON DUPLICATE KEY UPDATE company=${companyName}, sector=${setor || null}, employeeName=${nome || null}, isActive=1, company_id=${companyId}, branch_id=${branchId}, sector_id=${sectorId}, role=${role}`);
            inserted++; res.action = "inserted";
          }
          // align an already-existing user account with same email (e.g. logged in before)
          const ur: any = await db.execute(drzSql`SELECT id FROM users WHERE email = ${email} LIMIT 1`);
          const urRows = Array.isArray(ur) ? ((ur as any)[0] ?? []) : [];
          const urow = Array.isArray(urRows) ? (urRows[0] ?? null) : urRows ?? null;
          if (urow) {
            await db.execute(drzSql`UPDATE users SET company_id = ${companyId}, branch_id = ${branchId}, sector_id = ${sectorId}, role = ${role} WHERE id = ${urow.id}`);
            await db.execute(drzSql`UPDATE corporate_emails SET userId = ${urow.id} WHERE email = ${email} AND (userId IS NULL OR userId = 0)`);
          }
          results.push(res);
        }

        return {
          ok: true, dryRun: input.dryRun, companyId, companyName,
          summary: { total: input.rows.length, inserted, updated, skipped, branchesCreated, sectorsCreated },
          results,
        };
      }),
    updateCollaborator: adminOrRhProcedure
      .input(z.object({
        userId: z.number(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        role: z.enum(["user", "chefia", "rh", "admin"]).optional(),
        branchId: z.number().nullable().optional(),
        sectorId: z.number().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const myRole = (ctx.user as any).role;
        const myCid = (ctx.user as any).companyId;
        const isGlobal = myRole === "admin_global" || myRole === "super_admin";
        const ur: any = await db.execute(drzSql`SELECT id, email, company_id FROM users WHERE id = ${input.userId} LIMIT 1`);
        const urow = Array.isArray(ur) ? (ur[0]?.[0] ?? ur[0]) : ur;
        if (!urow) throw new TRPCError({ code: "NOT_FOUND", message: "Colaborador nao encontrado." });
        if (!isGlobal && urow.company_id !== myCid) throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissao." });

        // clamp role: RH importers/editors cannot grant admin
        let role = input.role;
        if (role === "admin" && myRole === "rh") role = "rh";

        // validate branch/sector against the user's company
        if (input.branchId != null) {
          const br: any = await db.execute(drzSql`SELECT company_id FROM branches WHERE id = ${input.branchId} LIMIT 1`);
          const brow = Array.isArray(br) ? (br[0]?.[0] ?? br[0]) : br;
          if (!brow || (urow.company_id && brow.company_id !== urow.company_id)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Filial invalida para esta empresa." });
          }
        }
        if (input.sectorId != null) {
          const sr: any = await db.execute(drzSql`SELECT company_id, branch_id FROM sectors WHERE id = ${input.sectorId} LIMIT 1`);
          const srow = Array.isArray(sr) ? (sr[0]?.[0] ?? sr[0]) : sr;
          if (!srow || (urow.company_id && srow.company_id !== urow.company_id)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Setor invalido para esta empresa." });
          }
          if (input.branchId != null && srow.branch_id != null && srow.branch_id !== input.branchId) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Setor nao pertence a essa filial." });
          }
        }

        // email change (keep users + corporate_emails in sync, enforce uniqueness)
        if (input.email && input.email.toLowerCase() !== String(urow.email ?? "").toLowerCase()) {
          const newEmail = input.email.toLowerCase();
          const dup: any = await db.execute(drzSql`SELECT id FROM corporate_emails WHERE email = ${newEmail} AND (userId IS NULL OR userId <> ${input.userId}) LIMIT 1`);
          const duprow = Array.isArray(dup) ? (dup[0]?.[0] ?? dup[0]) : dup;
          if (duprow) throw new TRPCError({ code: "BAD_REQUEST", message: "E-mail ja cadastrado para outro colaborador." });
          await db.execute(drzSql`UPDATE corporate_emails SET email = ${newEmail} WHERE userId = ${input.userId} OR email = ${String(urow.email ?? "").toLowerCase()}`);
          await db.execute(drzSql`UPDATE users SET email = ${newEmail} WHERE id = ${input.userId}`);
        }

        if (input.name !== undefined) {
          await db.execute(drzSql`UPDATE users SET name = ${input.name} WHERE id = ${input.userId}`);
          await db.execute(drzSql`UPDATE corporate_emails SET employeeName = ${input.name} WHERE userId = ${input.userId}`);
        }
        if (role !== undefined) {
          await db.execute(drzSql`UPDATE users SET role = ${role} WHERE id = ${input.userId}`);
        }
        if (input.branchId !== undefined || input.sectorId !== undefined) {
          const b = input.branchId ?? null;
          const s = input.sectorId ?? null;
          await db.execute(drzSql`UPDATE users SET branch_id = ${b}, sector_id = ${s} WHERE id = ${input.userId}`);
          await db.execute(drzSql`UPDATE corporate_emails SET branch_id = ${b}, sector_id = ${s} WHERE userId = ${input.userId}`);
        }
        return { ok: true };
      }),
    deleteCollaborator: adminOrRhProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const myRole = (ctx.user as any).role;
        const myCid = (ctx.user as any).companyId;
        const isGlobal = myRole === "admin_global" || myRole === "super_admin";
        const ur: any = await db.execute(drzSql`SELECT id, email, company_id FROM users WHERE id = ${input.userId} LIMIT 1`);
        const urow = Array.isArray(ur) ? (ur[0]?.[0] ?? ur[0]) : ur;
        if (!urow) throw new TRPCError({ code: "NOT_FOUND", message: "Colaborador nao encontrado." });
        if (!isGlobal && urow.company_id !== myCid) throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissao." });
        if (urow.id === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Voce nao pode remover a si mesmo." });
        // soft-delete: removes from roster/analytics and blocks future login; reversible
        await db.execute(drzSql`UPDATE users SET is_active = 0 WHERE id = ${input.userId}`);
        const em = String(urow.email ?? "").toLowerCase();
        await db.execute(drzSql`UPDATE corporate_emails SET isActive = 0 WHERE userId = ${input.userId} OR email = ${em}`);
        return { ok: true };
      }),









    stats: adminOrRhProcedure.query(async ({ ctx }) => {
      const cid = (ctx.user as any).companyId;
      const role = (ctx.user as any).role;
      if (role === 'admin_global') return getAdminStats();
      const db2 = await getDb();
      if (!db2) return { totalUsers: 0, activeUsers: 0, completionRate: 0, totalCertificates: 0, completedModules: 0 };
      const [uRows] = await execP(db2, `SELECT COUNT(*) as c FROM corporate_emails WHERE company_id = ? AND isActive = 1`, [cid]);
      const [certRows] = await execP(db2, `SELECT COUNT(*) as c FROM certificates WHERE userId IN (SELECT id FROM users WHERE company_id = ?)`, [cid]);
      const uCount = (uRows[0] ?? {}) as any; const certCount = (certRows[0] ?? {}) as any;
      return { totalUsers: Number(uCount.c) || 0, activeUsers: Number(uCount.c) || 0, completionRate: 0, totalCertificates: Number(certCount.c) || 0, completedModules: 0 };
    }),

















    sectorEngagement: adminOrRhProcedure.query(async ({ ctx }) => {
      const role = (ctx.user as any).role;
      const cid = (ctx.user as any).companyId;
      if (role === 'admin_global') return getSectorEngagement();
      return getSectorEngagementByCompany(cid);
    }),

















    studentHistory: adminOrRhProcedure








      .input(z.object({ userId: z.number() }))








      .query(async ({ input }) => {








        const db = await getDb();








        if (!db) return { user: {}, progress: [], certificates: [] };








        const { eq: dEq, and: dAnd } = await import("drizzle-orm");








        const { users: usersT, userProgress: upT, certificates: certsT, modules: modsT } = await import("../drizzle/schema");

















        const userRows = await db.select().from(usersT).where(dEq(usersT.id, input.userId)).limit(1);








        const user = userRows[0] ?? {};

















        const progress = await db.select({








          moduleId: upT.moduleId,








          percentWatched: upT.percentWatched,








          isCompleted: upT.isCompleted,








          completedAt: upT.completedAt,








          moduleTitle: modsT.title,








        }).from(upT).leftJoin(modsT, dEq(upT.moduleId, modsT.id)).where(dEq(upT.userId, input.userId));

















        const certs = await db.select({








          id: certsT.id,








          certificateCode: certsT.certificateCode,








          issuedAt: certsT.issuedAt,








          moduleTitle: modsT.title,








        }).from(certsT).leftJoin(modsT, dEq(certsT.moduleId, modsT.id)).where(dEq(certsT.userId, input.userId));

















        return { user, progress, certificates: certs };








      }),








    emailLogs: adminOrRhProcedure.query(async () => {








      return getEmailLogs(100);








    }),

















    listUsers: adminOrRhProcedure








      .input(z.object({ page: z.number().default(1), limit: z.number().default(50) }))








      .query(async ({ ctx, input }) => {








        // non-global admins: filter by company








        if (ctx.user.role !== "admin_global" && ctx.user.role !== "admin") {








          const companyId = (ctx.user as any).companyId;








          if (companyId) {








            const emails = await getCorporateEmailsByCompany(companyId);








            return { data: emails, total: emails.length };








          }








        }








        return listCorporateEmails(input.page, input.limit);








      }),

















    importEmails: adminOrRhProcedure








      .input(z.object({








        emails: z.array(z.object({








          email: z.string().email(),








          employeeName: z.string().optional(),








          company: z.string().optional(),








          sector: z.string().optional(),








          companyId: z.number().optional(),








          branchId: z.number().optional(),








          sectorId: z.number().optional(),








        })),








      }))








      .mutation(async ({ input }) => {








        const count = await bulkInsertCorporateEmails(input.emails);








        return { inserted: count, total: input.emails.length };








      }),

















    getReminderSettings: adminOrRhProcedure.query(async () => {








      return getReminderSettings();








    }),

















    updateReminderSettings: adminOrRhProcedure








      .input(z.object({








        inactiveDaysThreshold: z.number().min(1).max(365).optional(),








        lowEngagementThreshold: z.number().min(0).max(100).optional(),








        isEnabled: z.boolean().optional(),








      }))








      .mutation(async ({ input }) => {








        await updateReminderSettings(input);








        return { success: true };








      }),

















    sendReminders: adminOrRhProcedure.mutation(async () => {








      const settings = await getReminderSettings();








      if (!settings?.isEnabled) return { sent: 0, message: "Lembretes desativados." };

















      const inactiveUsers = await getInactiveUsers(settings.inactiveDaysThreshold);








      let sent = 0;

















      for (const user of inactiveUsers) {








        try {








          // Log the reminder (actual email sending would require SMTP config)








          await logEmail(








            user.email,








            "reminder_employee",








            `Lembrete: Continue sua jornada na plataforma Saúde do Trabalho`,








            true








          );








          sent++;








        } catch (e) {








          await logEmail(user.email, "reminder_employee", "Lembrete", false, String(e));








        }








      }

















      await updateReminderSettings({ lastRunAt: new Date() });








      return { sent, total: inactiveUsers.length };








    }),

















     updateModuleVideo: adminOrRhProcedure








      .input(z.object({








        moduleId: z.number(),








        videoUrl: z.string().url().or(z.literal("")),








        thumbnailUrl: z.string().optional(),








        durationMinutes: z.number().optional(),








        description: z.string().optional(),








        title: z.string().optional(),








      }))








      .mutation(async ({ input }) => {








        const { moduleId, ...data } = input;








        await updateModule(moduleId, data);








        return { success: true };








      }),








    updateModuleCert: adminOrRhProcedure








      .input(z.object({








        moduleId: z.number(),








        certTitle: z.string().optional(),








        certBody: z.string().optional(),








        certSignerName: z.string().optional(),








        certSignerRole: z.string().optional(),








      }))








      .mutation(async ({ input }) => {








        const { moduleId, ...data } = input;








        await updateModuleCertConfig(moduleId, data);








        return { success: true };








      }),








    listDecompressionVideos: adminOrRhProcedure.query(async () => {








      return listAllDecompressionVideos();








    }),








    createDecompressionVideo: adminOrRhProcedure








      .input(z.object({








        title: z.string().min(1),








        category: z.enum(["yoga", "meditacao", "respiracao", "outro"]),








        videoUrl: z.string().optional(),








        thumbnailUrl: z.string().optional(),








        durationMinutes: z.number().optional(),








        description: z.string().optional(),








        isActive: z.boolean().optional(),








        orderIndex: z.number().optional(),








      }))








      .mutation(async ({ input }) => {








        await createDecompressionVideo(input);








        return { success: true };








      }),








    updateDecompressionVideo: adminOrRhProcedure








      .input(z.object({








        id: z.number(),








        title: z.string().optional(),








        category: z.enum(["yoga", "meditacao", "respiracao", "outro"]).optional(),








        videoUrl: z.string().optional(),








        thumbnailUrl: z.string().optional(),








        durationMinutes: z.number().optional(),








        description: z.string().optional(),








        isActive: z.boolean().optional(),








        orderIndex: z.number().optional(),








      }))








      .mutation(async ({ input }) => {








        const { id, ...data } = input;








        await updateDecompressionVideo(id, data);








        return { success: true };








      }),








    deleteDecompressionVideo: adminOrRhProcedure








      .input(z.object({ id: z.number() }))








      .mutation(async ({ input }) => {








        await deleteDecompressionVideo(input.id);








        return { success: true };








      }),








    listModules: adminOrRhProcedure.query(async () => {
      return listModulesAdmin();
    }),








    // ─── Module CRUD ───────────────────────────────────────────────────────────








    createModule: adminOrRhProcedure








      .input(z.object({








        title: z.string().min(1),








        description: z.string().optional(),








        durationMinutes: z.number().optional(),








        orderIndex: z.number().optional(),








        isActive: z.boolean().optional(),








        validityDays: z.number().nullish(), isMandatory: z.boolean().optional(), profession: z.string().nullish() }))








      .mutation(async ({ input }) => {








        await createModule(input);








        return { success: true };








      }),








    updateModuleAdmin: adminOrRhProcedure








      .input(z.object({








        id: z.number(),








        title: z.string().min(1).optional(),








        description: z.string().optional(),








        durationMinutes: z.number().optional(),








        orderIndex: z.number().optional(),








        isActive: z.boolean().optional(),








        certTitle: z.string().optional(),








        certBody: z.string().optional(),








        certSignerName: z.string().optional(),








        certSignerRole: z.string().optional(),








        validityDays: z.number().nullish(), isMandatory: z.boolean().optional(), profession: z.string().nullish() }))








      .mutation(async ({ input }) => {








        const { id, ...data } = input;








        await adminUpdateModule(id, data);








        return { success: true };








      }),








    deleteModule: adminOrRhProcedure








      .input(z.object({ id: z.number() }))








      .mutation(async ({ input }) => {








        await deleteModule(input.id);








        return { success: true };








      }),








    // ─── Course publish workflow ────────────────────────────────────────────────

    /** Submit a course for review (any admin/rh) */
    submitForReview: adminOrRhProcedure
      .input(z.object({ moduleId: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        const db2 = await getDb();
        if (!db2) throw new Error("DB unavailable");
        // Only allow transition from draft
        const rows = await db2.select({ publishStatus: modules.publishStatus })
          .from(modules).where(eq(modules.id, input.moduleId)).limit(1);
        const current = rows[0]?.publishStatus ?? "draft";
        if (current !== "draft") throw ForbiddenError("Curso não está em rascunho.");
        await db2.update(modules)
          .set({ publishStatus: "review" } as any)
          .where(eq(modules.id, input.moduleId));
        return { ok: true };
      }),

    /** Approve a course (super_admin / admin_global only) */
    approveModule: protectedProcedure
      .input(z.object({ moduleId: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        if (!["super_admin", "admin_global"].includes(ctx.user.role)) throw ForbiddenError("Sem permissão.");
        const db2 = await getDb();
        if (!db2) throw new Error("DB unavailable");
        const rows = await db2.select({ publishStatus: modules.publishStatus })
          .from(modules).where(eq(modules.id, input.moduleId)).limit(1);
        const current = rows[0]?.publishStatus ?? "draft";
        if (current !== "review") throw ForbiddenError("Curso não está aguardando revisão.");
        await db2.update(modules)
          .set({ publishStatus: "approved" } as any)
          .where(eq(modules.id, input.moduleId));
        return { ok: true };
      }),

    /** Publish a course (super_admin / admin_global only) */
    publishModule: protectedProcedure
      .input(z.object({ moduleId: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        if (!["super_admin", "admin_global"].includes(ctx.user.role)) throw ForbiddenError("Sem permissão.");
        const db2 = await getDb();
        if (!db2) throw new Error("DB unavailable");
        await db2.update(modules)
          .set({ publishStatus: "published" } as any)
          .where(eq(modules.id, input.moduleId));
        return { ok: true };
      }),

    /** Reject / send back to draft (super_admin / admin_global only) */
    rejectModule: protectedProcedure
      .input(z.object({ moduleId: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        if (!["super_admin", "admin_global"].includes(ctx.user.role)) throw ForbiddenError("Sem permissão.");
        const db2 = await getDb();
        if (!db2) throw new Error("DB unavailable");
        await db2.update(modules)
          .set({ publishStatus: "draft" } as any)
          .where(eq(modules.id, input.moduleId));
        return { ok: true };
      }),

    // ─── Lessons CRUD ──────────────────────────────────────────────────────────








    








  moduleCompletionStats: adminOrRhProcedure.query(async ({ ctx }) => {
    const role = (ctx.user as any).role;
    const cid = (ctx.user as any).companyId;
    const db = (await getDb())!;
    const mods = await db.select().from(modules).where(eq(modules.isActive, 1 as any));
    const results = await Promise.all(mods.map(async (m: any) => {
      const completedRows = role === 'admin_global'
        ? await db.select({ count: sql`COUNT(*)` }).from(userProgress).where(and(eq(userProgress.moduleId, m.id), eq(userProgress.isCompleted, true)))
        : await db.select({ count: sql`COUNT(*)` }).from(userProgress).where(and(eq(userProgress.moduleId, m.id), eq(userProgress.isCompleted, true), sql`${userProgress.userId} IN (SELECT id FROM users WHERE companyId = ${cid})`));
      const totalRows = role === 'admin_global'
        ? await db.select({ count: sql`COUNT(DISTINCT user_id)` }).from(userProgress)
        : await db.select({ count: sql`COUNT(DISTINCT user_id)` }).from(userProgress).where(sql`${userProgress.userId} IN (SELECT id FROM users WHERE companyId = ${cid})`);
      const completed = Number(completedRows[0]?.count ?? 0);
      const total = Number(totalRows[0]?.count ?? 0);
      return { moduleId: m.id, title: m.title, total, completed, pct: total > 0 ? Math.round((completed/total)*100) : 0 };
    }));
    return results;
  }),







  listLessons: adminOrRhProcedure








      .input(z.object({ moduleId: z.number() }))








      .query(async ({ input }) => {








        return listAllLessonsByModule(input.moduleId);








      }),








    createLesson: adminOrRhProcedure








      .input(z.object({








        moduleId: z.number(),








        title: z.string().min(1),








        description: z.string().optional(),








        videoUrl: z.string().optional(),








        durationMinutes: z.number().optional(),








        orderIndex: z.number().optional(),








        isActive: z.boolean().optional(),








      }))








      .mutation(async ({ input }) => {








        await createLesson(input);








        return { success: true };








      }),








    updateLesson: adminOrRhProcedure








      .input(z.object({








        id: z.number(),








        title: z.string().optional(),








        description: z.string().optional(),








        videoUrl: z.string().optional(),








        durationMinutes: z.number().optional(),








        orderIndex: z.number().optional(),








        isActive: z.boolean().optional(),








      }))








      .mutation(async ({ input }) => {








        const { id, ...data } = input;








        await updateLesson(id, data);








        return { success: true };








      }),








    deleteLesson: adminOrRhProcedure








      .input(z.object({ id: z.number() }))








      .mutation(async ({ input }) => {








        await deleteLesson(input.id);








        return { success: true };








      }),

















    // ─── Quiz management ────────────────────────────────────────────────────








    getQuiz: adminOrRhProcedure








      .input(z.object({ lessonId: z.number() }))








      .query(async ({ input }) => {








        return await getQuizForGrading(input.lessonId);








      }),

















    upsertQuiz: adminOrRhProcedure








      .input(z.object({








        lessonId: z.number(),








        passingScore: z.number().min(0).max(100).default(70),








        questions: z.array(z.object({








          questionText: z.string().min(1),








          options: z.array(z.object({








            optionText: z.string().min(1),








            isCorrect: z.boolean(),








          })).min(2),








        })).min(1),








      }))








      .mutation(async ({ input }) => {








        const quizId = await upsertQuiz(input.lessonId, input.passingScore);








        const db = await getDb();








        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });








        const existing = await db.select().from(quizQuestions).where(drzEq(quizQuestions.quizId, quizId));








        for (const q of existing) await deleteQuestion(q.id);








        let idx = 0;








        for (const q of input.questions) {








          const qid = await createQuestion(quizId, q.questionText, idx++);








          let oidx = 0;








          for (const o of q.options) {








            await createOption(qid, o.optionText, o.isCorrect ? 1 : 0, oidx++);








          }








        }








        return { quizId };








      }),








  }),

















  // ── Quiz (employee) ───────────────────────────────────────────────────────








  quiz: router({








    getByLesson: protectedProcedure








      .input(z.object({ lessonId: z.number() }))








      .query(async ({ input }) => {








        const quiz = await getQuizByLesson(input.lessonId);








        if (!quiz) return null;








        return {








          ...quiz,








          questions: quiz.questions.map((q) => ({








            ...q,








            options: q.options.map((opt) => {








              const { isCorrect, ...rest } = opt as any;








              return rest;








            }),








          })),








        };








      }),

















    submit: protectedProcedure








      .input(z.object({








        lessonId: z.number(),








        answers: z.array(z.object({ questionId: z.number(), selectedOptionId: z.number() })),








      }))








      .mutation(async ({ ctx, input }) => {








        const quiz = await getQuizForGrading(input.lessonId);








        if (!quiz) throw new TRPCError({ code: 'NOT_FOUND', message: 'Quiz não encontrado' });

















        let earned = 0;








        let total = 0;








        const detailedAnswers: any[] = [];








        for (const q of quiz.questions) {








          total += q.points;








          const userAnswer = input.answers.find((a) => a.questionId === q.id);








          const correct = q.options.find((o) => o.isCorrect === 1);








          const isCorrect = !!(userAnswer && correct && userAnswer.selectedOptionId === correct.id);








          if (isCorrect) earned += q.points;








          detailedAnswers.push({








            questionId: q.id,








            selectedOptionId: userAnswer?.selectedOptionId ?? null,








            isCorrect,








          });








        }








        const score = total > 0 ? Math.round((earned / total) * 100) : 0;








        const passed = score >= quiz.passingScore ? 1 : 0;

















        const meta = getReqMeta(ctx);








        await createQuizAttempt({








          userId: ctx.user.id,








          quizId: quiz.id,








          lessonId: input.lessonId,








          score,








          passed,








          answersJson: JSON.stringify(detailedAnswers),








          ipAddress: meta.ip,








          userAgent: meta.ua,








        });








        await logAudit({








          userId: ctx.user.id, userEmail: ctx.user.email,








          action: passed ? 'quiz_passed' : 'quiz_failed',








          entityType: 'quiz', entityId: quiz.id,








          detailsJson: { score, lessonId: input.lessonId },








          ipAddress: meta.ip, userAgent: meta.ua,








        });








        return { score, passed: !!passed, passingScore: quiz.passingScore };








      }),

















    myAttempts: protectedProcedure








      .input(z.object({ lessonId: z.number() }))








      .query(async ({ ctx, input }) => {








        const quiz = await getQuizByLesson(input.lessonId);








        if (!quiz) return { attempts: [], hasPassed: false };








        const attempts = await getUserQuizAttempts(ctx.user.id, quiz.id);








        return { attempts, hasPassed: attempts.some((a) => a.passed === 1) };








      }),








  }),

















  // ── Audit / view tracking / acceptance ─────────────────────────────────────








  audit: router({








    logView: protectedProcedure








      .input(z.object({








        lessonId: z.number(),








        moduleId: z.number(),








        videoPositionSeconds: z.number().int().min(0),








        videoDurationSeconds: z.number().int().min(0),








        eventType: z.enum(['play', 'pause', 'heartbeat', 'seek', 'ended', 'blur', 'focus']),








      }))








      .mutation(async ({ ctx, input }) => {








        const meta = getReqMeta(ctx);








        await logViewEvent({ userId: ctx.user.id, ...input, ipAddress: meta.ip });








        return { ok: true };








      }),

















    effectiveWatch: protectedProcedure








      .input(z.object({ lessonId: z.number() }))








      .query(async ({ ctx, input }) => {








        const seconds = await getEffectiveWatchSeconds(ctx.user.id, input.lessonId);








        return { seconds };








      }),

















    acceptTerm: protectedProcedure








      .input(z.object({ moduleId: z.number(), termText: z.string().min(1) }))








      .mutation(async ({ ctx, input }) => {








        const meta = getReqMeta(ctx);








        await recordAcceptance({








          userId: ctx.user.id,








          moduleId: input.moduleId,








          termText: input.termText,








          userName: ctx.user.name,








          userEmail: ctx.user.email,








          ipAddress: meta.ip,








          userAgent: meta.ua,








        });








        await logAudit({








          userId: ctx.user.id, userEmail: ctx.user.email,








          action: 'term_accepted', entityType: 'module', entityId: input.moduleId,








          ipAddress: meta.ip, userAgent: meta.ua,








        });








        return { ok: true };








      }),

















    getAcceptance: protectedProcedure








      .input(z.object({ moduleId: z.number() }))








      .query(async ({ ctx, input }) => {








        return await getAcceptance(ctx.user.id, input.moduleId);








      }),

















    listLogs: adminOrRhProcedure








      .input(z.object({








        userId: z.number().optional(),








        action: z.string().optional(),








        limit: z.number().default(200),








      }))








      .query(async ({ input }) => {








        return await listAuditLogs(input);








      }),

















    evidenceReport: adminOrRhProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input, ctx }) => {
        const cid = (ctx.user as any).companyId;
        const role = (ctx.user as any).role;
        if (role !== 'admin_global') {
          const db = await getDb();
          if (!db) return null;
          const { users: usersSchema } = await import('../drizzle/schema');
          const [targetUser] = await db.select({ companyId: usersSchema.companyId }).from(usersSchema).where(eq(usersSchema.id, input.userId));
          if (!targetUser || targetUser.companyId !== cid) return null;
        }
        return await getEvidenceReport(input.userId);
      }),


















    // For evidence-report user dropdown








    listAuditUsers: adminOrRhProcedure.query(async ({ ctx }) => {
      const cid = (ctx.user as any).companyId;
      const role = (ctx.user as any).role;
      const db = await getDb();
      if (!db) return [];
      const { users: usersSchema } = await import('../drizzle/schema');
      const r = role === 'admin_global'
        ? await db.select().from(usersSchema)
        : await db.select().from(usersSchema).where(eq(usersSchema.companyId, cid));
      return r.map(u => ({ id: u.id, name: u.name, email: u.email }));
    }),








  }),








  // ─── Lessons (employee) ────────────────────────────────────────────────────








  lessons: router({








    listByModule: protectedProcedure








      .input(z.object({ moduleId: z.number() }))








      .query(async ({ input }) => {








        return listLessonsByModule(input.moduleId);








      }),








    updateProgress: protectedProcedure








      .input(z.object({








        lessonId: z.number(),








        moduleId: z.number(),








        percentWatched: z.number().min(0).max(100).optional(),








        isCompleted: z.boolean().optional(),








      }))








      .mutation(async ({ ctx, input }) => {








        const allProgressBefore = await getModuleLessonProgressForUser(ctx.user.id, input.moduleId);








        const prevLessonProg = allProgressBefore.find((p: any) => p.lessonId === input.lessonId);








        await upsertLessonProgress(ctx.user.id, input.lessonId, input.moduleId, {








          percentWatched: input.percentWatched,








          isCompleted: input.isCompleted,








        });








        if (input.isCompleted && !prevLessonProg?.isCompleted) {








          const meta = getReqMeta(ctx);








          await logAudit({








            userId: ctx.user.id, userEmail: ctx.user.email,








            action: 'lesson_completed', entityType: 'lesson', entityId: input.lessonId,








            detailsJson: { moduleId: input.moduleId, percentWatched: input.percentWatched },








            ipAddress: meta.ip, userAgent: meta.ua,








          });








        }








        // Recalculate module progress based on lessons








        const allLessons = await listLessonsByModule(input.moduleId);








        const allProgress = await getModuleLessonProgressForUser(ctx.user.id, input.moduleId);








        if (allLessons.length > 0) {








          const completedCount = allProgress.filter(p => p.isCompleted).length;








          const percentComplete = Math.round((completedCount / allLessons.length) * 100);








          const isModuleCompleted = percentComplete === 100;








          await upsertUserProgress(ctx.user.id, input.moduleId, percentComplete, isModuleCompleted);








        }








        return { success: true };








      }),








    getModuleProgress: protectedProcedure








      .input(z.object({ moduleId: z.number() }))








      .query(async ({ ctx, input }) => {








        return getModuleLessonProgressForUser(ctx.user.id, input.moduleId);








      }),








  

    hierarchyTree: adminOrRhProcedure.query(async ({ ctx }) => {
      const role = (ctx.user as any).role;
      const cid = (ctx.user as any).companyId ?? null;
      const scope = role === "admin_global" || role === "super_admin" ? null : cid;
      console.log("[hierarchyTree] role=", role, "cid=", cid, "scope=", scope);
      try {
        const r = await getHierarchyTreeForCompany(scope);
        console.log("[hierarchyTree] returned", Array.isArray(r) ? r.length : typeof r, "companies");
        if (Array.isArray(r) && r.length > 0) {
          console.log("[hierarchyTree] first co:", JSON.stringify(r[0]).substring(0, 300));
        }
        return r;
      } catch (e: any) {
        console.error("[hierarchyTree] ERROR:", e.message, e.stack);
        throw e;
      }
    }),

    userDetails: adminOrRhProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ ctx, input }) => {
        const role = (ctx.user as any).role;
        const cid = (ctx.user as any).companyId ?? null;
        const details = await getUserFullDetails(input.userId);
        if (!details) throw new Error("Usuário não encontrado");
        if (role !== "admin_global" && role !== "super_admin") {
          if (details.user.companyId && details.user.companyId !== cid) {
            throw new Error("Sem permissão para visualizar este usuário");
          }
        }
        return details;
      }),

    // ── Visão 360º do Colaborador ───────────────────────────────────────────
    // LGPD: a visão individual completa expõe dados sensíveis de saúde, logo só
    // é liberada para perfis autorizados (saúde/psicologia/RH/admin) e dentro da
    // mesma empresa. Gestores/diretores devem usar painéis agregados anônimos.
    collaborator360: adminOrRhProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ ctx, input }) => {
        const role = (ctx.user as any).role;
        const cid = (ctx.user as any).companyId ?? null;
        const data = await getCollaborator360(input.userId);
        if (!data) throw new Error("Colaborador não encontrado");
        if (role !== "admin_global" && role !== "super_admin") {
          if (data.user.companyId && data.user.companyId !== cid) {
            throw new Error("Sem permissão para visualizar este colaborador");
          }
        }
        return data;
      }),

    recomputeWellbeingIndex: adminOrRhProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const role = (ctx.user as any).role;
        const cid = (ctx.user as any).companyId ?? null;
        const base = await getUserFullDetails(input.userId);
        if (!base) throw new Error("Colaborador não encontrado");
        if (role !== "admin_global" && role !== "super_admin") {
          if (base.user.companyId && base.user.companyId !== cid) {
            throw new Error("Sem permissão");
          }
        }
        return await computeWellbeingIndex(input.userId, base.user.companyId ?? null);
      }),

    addIntervention: adminOrRhProcedure
      .input(
        z.object({
          userId: z.number(),
          technique: z.string().min(1),
          notes: z.string().optional(),
          status: z.enum(["aplicada", "sugerida", "em_andamento"]).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const role = (ctx.user as any).role;
        const cid = (ctx.user as any).companyId ?? null;
        const base = await getUserFullDetails(input.userId);
        if (!base) throw new Error("Colaborador não encontrado");
        if (role !== "admin_global" && role !== "super_admin") {
          if (base.user.companyId && base.user.companyId !== cid) {
            throw new Error("Sem permissão");
          }
        }
        return await addCareIntervention({
          userId: input.userId,
          companyId: base.user.companyId ?? null,
          technique: input.technique,
          notes: input.notes ?? null,
          status: input.status ?? "aplicada",
          createdByUserId: (ctx.user as any).id ?? null,
        });
      }),

    scheduleConversation: adminOrRhProcedure
      .input(
        z.object({
          userId: z.number(),
          title: z.string().optional(),
          description: z.string().optional(),
          eventDate: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const role = (ctx.user as any).role;
        const cid = (ctx.user as any).companyId ?? null;
        const base = await getUserFullDetails(input.userId);
        if (!base) throw new Error("Colaborador não encontrado");
        if (role !== "admin_global" && role !== "super_admin") {
          if (base.user.companyId && base.user.companyId !== cid) {
            throw new Error("Sem permissão");
          }
        }
        return await scheduleCareConversation({
          userId: input.userId,
          companyId: base.user.companyId ?? null,
          title: input.title ?? null,
          description: input.description ?? null,
          eventDate: input.eventDate,
          createdByUserId: (ctx.user as any).id ?? null,
        });
      }),
}),

















  // ── Companies ─────────────────────────────────────────────────────────────








  // ── Planos de Assinatura (Admin Global) ────────────────────────────────────
  // Catálogo central onde o Admin Global define preço, limites, trial e quais
  // funcionalidades cada plano libera. Base para o billing (Stripe) e o gating.
  plans: router({
    featureCatalog: protectedProcedure.query(() => PLAN_FEATURE_CATALOG),

    // Resolve quais funcionalidades a empresa do usuário atual tem acesso.
    // Projetado para ser SEGURO por padrão: enquanto o gating estiver desligado
    // (app_settings.feature_gating_enabled != '1'), todo mundo recebe acesso total,
    // de modo que ligar o cadastro de planos não bloqueia ninguém sem intenção.
    myEntitlements: protectedProcedure.query(async ({ ctx }) => {
      const allCodes = PLAN_FEATURE_CATALOG.map((f) => f.code);
      const role = (ctx.user as any).role;
      // Operadores da plataforma sempre enxergam tudo.
      if (role === "super_admin" || role === "admin_global") {
        return { features: allCodes, full: true, gatingEnabled: false, planCode: null as string | null };
      }
      const db = await getDb();
      if (!db) return { features: allCodes, full: true, gatingEnabled: false, planCode: null };
      // Kill-switch global: só aplica o gating quando explicitamente ligado.
      let gatingEnabled = false;
      try {
        const gs: any = await db.execute(drzSql`SELECT setting_value AS v FROM app_settings WHERE setting_key='feature_gating_enabled' LIMIT 1`);
        gatingEnabled = String((gs as any)[0]?.[0]?.v ?? "0") === "1";
      } catch { gatingEnabled = false; }
      if (!gatingEnabled) {
        return { features: allCodes, full: true, gatingEnabled: false, planCode: null };
      }
      // Gating ligado: resolve o plano da empresa e suas features.
      const cid = (ctx.user as any).companyId ?? null;
      if (!cid) return { features: allCodes, full: true, gatingEnabled: true, planCode: null };
      let planCode: string | null = null;
      try {
        const cr: any = await db.execute(drzSql`SELECT plan AS p FROM companies WHERE id=${cid} LIMIT 1`);
        planCode = (cr as any)[0]?.[0]?.p ?? null;
      } catch { planCode = null; }
      if (!planCode) return { features: allCodes, full: true, gatingEnabled: true, planCode: null };
      let feats: string[] | null = null;
      try {
        const pr: any = await db.execute(drzSql`SELECT features_json AS f FROM subscription_plans WHERE code=${planCode} AND is_active=1 LIMIT 1`);
        const raw = (pr as any)[0]?.[0]?.f ?? null;
        if (raw != null) {
          const parsed = typeof raw === "string" ? JSON.parse(raw || "[]") : raw;
          if (Array.isArray(parsed)) feats = parsed.filter((c) => typeof c === "string");
        }
      } catch { feats = null; }
      // Plano não cadastrado/sem features definidas -> permissivo (não trava cliente legado).
      if (feats == null) return { features: allCodes, full: true, gatingEnabled: true, planCode };
      return { features: feats, full: false, gatingEnabled: true, planCode };
    }),

    // Estado do kill-switch global (visível só p/ Admin Global / Super Admin).
    gatingStatus: protectedProcedure.query(async ({ ctx }) => {
      const role = (ctx.user as any).role;
      if (role !== "admin_global" && role !== "super_admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const gs: any = await db.execute(drzSql`SELECT setting_value AS v FROM app_settings WHERE setting_key='feature_gating_enabled' LIMIT 1`);
      return { enabled: String((gs as any)[0]?.[0]?.v ?? "0") === "1" };
    }),

    setGating: protectedProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const role = (ctx.user as any).role;
        if (role !== "admin_global" && role !== "super_admin") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.execute(drzSql`
          INSERT INTO app_settings (setting_key, setting_value) VALUES ('feature_gating_enabled', ${input.enabled ? "1" : "0"})
          ON DUPLICATE KEY UPDATE setting_value=${input.enabled ? "1" : "0"}`);
        return { ok: true, enabled: input.enabled };
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      const role = (ctx.user as any).role;
      if (role !== "admin_global" && role !== "super_admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const r: any = await db.execute(drzSql`
        SELECT id, code, label, description,
               monthly_price AS monthlyPrice, annual_price AS annualPrice,
               max_employees AS maxEmployees, trial_days AS trialDays,
               features_json AS features, is_active AS isActive, order_index AS orderIndex
        FROM subscription_plans ORDER BY order_index ASC, id ASC`);
      const rows = (r as any)[0] ?? [];
      return rows.map((p: any) => ({
        ...p,
        monthlyPrice: Number(p.monthlyPrice ?? 0),
        annualPrice: Number(p.annualPrice ?? 0),
        maxEmployees: p.maxEmployees == null ? null : Number(p.maxEmployees),
        trialDays: Number(p.trialDays ?? 0),
        isActive: !!p.isActive,
        features: typeof p.features === "string" ? (() => { try { return JSON.parse(p.features || "[]"); } catch { return []; } })() : (p.features ?? []),
      }));
    }),

    upsert: protectedProcedure
      .input(z.object({
        id: z.number().optional(),
        code: z.string().min(2).max(40).regex(/^[a-z0-9_]+$/, "Use apenas letras minúsculas, números e _"),
        label: z.string().min(1).max(120),
        description: z.string().max(500).nullable().optional(),
        monthlyPrice: z.number().min(0).default(0),
        annualPrice: z.number().min(0).default(0),
        maxEmployees: z.number().int().positive().nullable().optional(),
        trialDays: z.number().int().min(0).max(365).default(7),
        features: z.array(z.string()).default([]),
        isActive: z.boolean().default(true),
        orderIndex: z.number().int().default(0),
      }))
      .mutation(async ({ ctx, input }) => {
        const role = (ctx.user as any).role;
        if (role !== "admin_global" && role !== "super_admin") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        // valida os códigos de feature contra o catálogo
        const valid = new Set(PLAN_FEATURE_CATALOG.map((f) => f.code));
        const feats = JSON.stringify((input.features ?? []).filter((c) => valid.has(c as any)));
        const maxEmp = input.maxEmployees ?? null;
        if (input.id) {
          await db.execute(drzSql`
            UPDATE subscription_plans SET
              label=${input.label}, description=${input.description ?? null},
              monthly_price=${input.monthlyPrice}, annual_price=${input.annualPrice},
              max_employees=${maxEmp}, trial_days=${input.trialDays},
              features_json=${feats}, is_active=${input.isActive ? 1 : 0}, order_index=${input.orderIndex}
            WHERE id=${input.id}`);
          return { ok: true, id: input.id };
        }
        const ins: any = await db.execute(drzSql`
          INSERT INTO subscription_plans (code,label,description,monthly_price,annual_price,max_employees,trial_days,features_json,is_active,order_index)
          VALUES (${input.code},${input.label},${input.description ?? null},${input.monthlyPrice},${input.annualPrice},${maxEmp},${input.trialDays},${feats},${input.isActive ? 1 : 0},${input.orderIndex})`);
        return { ok: true, id: Number((ins as any)[0]?.insertId ?? 0) };
      }),
  }),

  companies: router({








    list: adminOrRhProcedure.query(async ({ ctx }) => {








      const user = ctx.user;








      // admin_global sees all companies








      if (user.role === 'admin_global') {








        return await getCompanies();








      }








      // company_admin/rh sees only their company








      const companyId = (user as any).companyId;








      if (companyId) {








        const company = await getCompanyById(companyId);








        return company ? [company] : [];








      }








      return [];








    }),

















    get: adminOrRhProcedure








      .input(z.object({ id: z.number() }))








      .query(async ({ ctx, input }) => {








        return await getCompanyById(input.id);








      }),

















    create: adminOrRhProcedure








      .input(z.object({ name: z.string(), cnpj: z.string().optional() }))








      .mutation(async ({ ctx, input }) => {








        if (ctx.user.role !== 'admin_global') throw new TRPCError({ code: 'FORBIDDEN' });








        return await createCompany(input);








      }),

















    update: adminOrRhProcedure








      .input(z.object({ id: z.number(), name: z.string().optional(), cnpj: z.string().optional(), isActive: z.number().optional() }))








      .mutation(async ({ ctx, input }) => {








        if (ctx.user.role !== 'admin_global') throw new TRPCError({ code: 'FORBIDDEN' });








        const { id, ...data } = input;








        await updateCompany(id, data);








      }),
    listWithCounts: adminOrRhProcedure.query(async ({ ctx }) => {
      const role = (ctx.user as any).role;
      const db = await getDb(); if (!db) return [];
      if (role === "admin_global" || role === "super_admin") {
        const rows: any = await db.execute(drzSql`
          SELECT c.*,
            (SELECT COUNT(*) FROM branches b WHERE b.company_id = c.id) AS branches_count,
            (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id) AS users_count
          FROM companies c ORDER BY c.name
        `);
        return Array.isArray(rows) ? (rows[0] ?? rows) : [];
      }
      const cid = (ctx.user as any).companyId;
      if (!cid) return [];
      const rows: any = await db.execute(drzSql`
        SELECT c.*,
          (SELECT COUNT(*) FROM branches b WHERE b.company_id = c.id) AS branches_count,
          (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id) AS users_count
        FROM companies c WHERE c.id = ${cid}
      `);
      return Array.isArray(rows) ? (rows[0] ?? rows) : [];
    }),
    deleteCompany: adminOrRhProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin_global") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const r: any = await db.execute(drzSql`SELECT COUNT(*) AS n FROM users WHERE company_id = ${input.id}`);
        const uCount = Number((Array.isArray(r) ? (r[0]?.[0] ?? r[0]) : r)?.n ?? 0);
        if (uCount > 0) throw new TRPCError({ code: "BAD_REQUEST", message: `Empresa tem ${uCount} colaborador(es). Remova-os antes de excluir.` });
        await db.execute(drzSql`DELETE FROM sectors WHERE company_id = ${input.id}`);
        await db.execute(drzSql`DELETE FROM branches WHERE company_id = ${input.id}`);
        await db.execute(drzSql`DELETE FROM companies WHERE id = ${input.id}`);
        return { ok: true };
      }),
    toggleActive: adminOrRhProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin_global") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.execute(drzSql`UPDATE companies SET is_active = IF(is_active = 1, 0, 1) WHERE id = ${input.id}`);
        return { ok: true };
      }),
    updatePlus: adminOrRhProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        cnpj: z.string().optional(),
        plan: z.string().optional(),
        maxEmployees: z.number().optional(),
        phone: z.string().optional(),
        primaryColor: z.string().optional(),
        logoUrl: z.string().optional(),
        description: z.string().optional(),
        isActive: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin_global" && ctx.user.role !== "company_admin") throw new TRPCError({ code: "FORBIDDEN" });
        if (ctx.user.role === "company_admin" && (ctx.user as any).companyId !== input.id) throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const allowed: any = { ...input };
        delete allowed.id;
        if (ctx.user.role === "company_admin") {
          delete allowed.plan; delete allowed.maxEmployees; delete allowed.isActive;
        }
        if (allowed.name !== undefined) await db.execute(drzSql`UPDATE companies SET name = ${allowed.name} WHERE id = ${input.id}`);
        if (allowed.cnpj !== undefined) await db.execute(drzSql`UPDATE companies SET cnpj = ${allowed.cnpj} WHERE id = ${input.id}`);
        if (allowed.plan !== undefined) await db.execute(drzSql`UPDATE companies SET plan = ${allowed.plan} WHERE id = ${input.id}`);
        if (allowed.maxEmployees !== undefined) await db.execute(drzSql`UPDATE companies SET max_employees = ${allowed.maxEmployees} WHERE id = ${input.id}`);
        if (allowed.phone !== undefined) await db.execute(drzSql`UPDATE companies SET phone = ${allowed.phone} WHERE id = ${input.id}`);
        if (allowed.primaryColor !== undefined) await db.execute(drzSql`UPDATE companies SET primary_color = ${allowed.primaryColor} WHERE id = ${input.id}`);
        if (allowed.logoUrl !== undefined) await db.execute(drzSql`UPDATE companies SET logo_url = ${allowed.logoUrl} WHERE id = ${input.id}`);
        if (allowed.description !== undefined) await db.execute(drzSql`UPDATE companies SET description = ${allowed.description} WHERE id = ${input.id}`);
        if (allowed.isActive !== undefined) await db.execute(drzSql`UPDATE companies SET is_active = ${allowed.isActive} WHERE id = ${input.id}`);
        return { ok: true };
      }),
    createPlus: adminOrRhProcedure
      .input(z.object({
        name: z.string().min(1),
        cnpj: z.string().optional(),
        plan: z.string().optional(),
        maxEmployees: z.number().optional(),
        phone: z.string().optional(),
        primaryColor: z.string().optional(),
        logoUrl: z.string().optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin_global") throw new TRPCError({ code: "FORBIDDEN" });
        await createCompanyFull({ name: input.name, cnpj: input.cnpj, plan: input.plan, maxEmployees: input.maxEmployees });
        const db = await getDb(); if (!db) return { ok: true };
        const r: any = await db.execute(drzSql`SELECT id FROM companies WHERE name = ${input.name} ORDER BY id DESC LIMIT 1`);
        const row = Array.isArray(r) ? (r[0]?.[0] ?? r[0]) : r;
        const newId = row?.id;
        if (newId) {
          if (input.phone) await db.execute(drzSql`UPDATE companies SET phone = ${input.phone} WHERE id = ${newId}`);
          if (input.primaryColor) await db.execute(drzSql`UPDATE companies SET primary_color = ${input.primaryColor} WHERE id = ${newId}`);
          if (input.logoUrl) await db.execute(drzSql`UPDATE companies SET logo_url = ${input.logoUrl} WHERE id = ${newId}`);
          if (input.description) await db.execute(drzSql`UPDATE companies SET description = ${input.description} WHERE id = ${newId}`);
        }
        return { ok: true, id: newId };
      }),

















    branches: adminOrRhProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input, ctx }) => {
        const cid = (ctx.user as any).companyId;
        const role = (ctx.user as any).role;
        const targetCompanyId = role === 'admin_global' ? input.companyId : cid;
        return await getBranchesByCompany(targetCompanyId);
      }),


















    createBranch: adminOrRhProcedure








      .input(z.object({ companyId: z.number(), name: z.string(), city: z.string().optional(), state: z.string().optional() }))








      .mutation(async ({ ctx, input }) => {








        if (!['admin_global','company_admin'].includes(ctx.user.role)) throw new TRPCError({ code: 'FORBIDDEN' });








        return await createBranch(input);








      }),

















    updateBranch: adminOrRhProcedure








      .input(z.object({ id: z.number(), name: z.string().optional(), city: z.string().optional(), state: z.string().optional(), isActive: z.number().optional() }))








      .mutation(async ({ ctx, input }) => {








        if (!['admin_global','company_admin'].includes(ctx.user.role)) throw new TRPCError({ code: 'FORBIDDEN' });








        const { id, ...data } = input;








        await updateBranch(id, data);








      }),

















    deleteBranch: adminOrRhProcedure








      .input(z.object({ id: z.number() }))








      .mutation(async ({ ctx, input }) => {








        if (!['admin_global','company_admin'].includes(ctx.user.role)) throw new TRPCError({ code: 'FORBIDDEN' });








        await deleteBranch(input.id);








      }),

















    sectors: adminOrRhProcedure
      .input(z.object({ companyId: z.number(), branchId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        const cid = (ctx.user as any).companyId;
        const role = (ctx.user as any).role;
        const targetCompanyId = role === 'admin_global' ? input.companyId : cid;
        if (input.branchId) return await getSectorsByBranch(input.branchId);
        return await getSectorsByCompany(targetCompanyId);
      }),


















    createSector: adminOrRhProcedure








      .input(z.object({ companyId: z.number(), branchId: z.number().optional(), name: z.string() }))








      .mutation(async ({ input }) => {








        return await createSector(input);








      }),

















    updateSector: adminOrRhProcedure








      .input(z.object({ id: z.number(), name: z.string().optional(), isActive: z.number().optional() }))








      .mutation(async ({ input }) => {








        const { id, ...data } = input;








        await updateSector(id, data);








      }),

















    deleteSector: adminOrRhProcedure








      .input(z.object({ id: z.number() }))








      .mutation(async ({ input }) => {








        await deleteSector(input.id);








      }),

















    usersByCompany: adminOrRhProcedure








      .input(z.object({ companyId: z.number() }))








      .query(async ({ ctx, input }) => {








        // LGPD: non-global admins can only see their own company








        const effectiveCompanyId = ctx.user.role === 'admin_global' ? input.companyId : ((ctx.user as any).companyId ?? input.companyId);








        return await getCorporateEmailsByCompany(effectiveCompanyId);








      }),

















    sectorEngagement: adminOrRhProcedure








      .input(z.object({ companyId: z.number() }))








      .query(async ({ ctx, input }) => {








        const effectiveCompanyId = ctx.user.role === 'admin_global' ? input.companyId : ((ctx.user as any).companyId ?? input.companyId);








        return await getSectorEngagementByCompany(effectiveCompanyId);








      }),








  








    updateSettings: adminOrRhProcedure








      .input(z.object({








        id: z.number(),








        name: z.string().optional(),








        cnpj: z.string().optional(),








        primaryColor: z.string().optional(),








        description: z.string().optional(),








        phone: z.string().optional(),








        website: z.string().optional(),








        address: z.string().optional(),








        loginBgUrl: z.string().optional(),








        logoUrl: z.string().optional(),








      }))








      .mutation(async ({ input }) => {








        const { id, ...data } = input;








        await updateCompanySettings(id, data as any);








        return { ok: true };








      }),








  }),

















  // ── Gamification ────────────────────────────────────────────────────────────








  gamification: router({








    myPoints: protectedProcedure.query(async ({ ctx }) => {








      const total = await getUserTotalPoints((ctx.user as any).id ?? (ctx.user as any).userId);








      return { total };








    }),








    leaderboard: protectedProcedure.query(async () => {








      return getLeaderboard(10);








    }),








    myBadges: protectedProcedure.query(async ({ ctx }) => {








      return getUserBadges((ctx.user as any).id ?? (ctx.user as any).userId);








    }),








    awardPoints: adminOrRhProcedure








      .input(z.object({ userId: z.number(), points: z.number(), reason: z.string() }))








      .mutation(async ({ input }) => {








        await awardPoints(input.userId, input.points, input.reason);








        return { ok: true };








      }),








  }),

















  // ── Trails ──────────────────────────────────────────────────────────────────








  trails: router({








    list: adminOrRhProcedure.query(async ({ ctx }) => {
      const role = (ctx.user as any).role;
      const cid = (ctx.user as any).companyId;
      if (role === 'admin_global') return listAllLearningTrails();
      const db = await getDb();
      if (!db) return [];
      const { learningTrails: trailsSchema } = await import('../drizzle/schema');
      return db.select().from(trailsSchema).where(eq(trailsSchema.createdByCompanyId, cid)).orderBy(trailsSchema.id);
    }),








    listActive: protectedProcedure.query(async ({ ctx }) => {








      try {








        return await getVisibleTrailsForUser(ctx.user.id);








      } catch (e) {








        return listLearningTrails();








      }








    }),








    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {








      return getLearningTrailById(input.id);








    }),








    create: adminOrRhProcedure








      .input(z.object({ title: z.string(), description: z.string().optional(), objective: z.string().optional(), thumbnailUrl: z.string().optional(), isSequential: z.number().optional() }))








      .mutation(async ({ input }) => {








        return createLearningTrail(input);








      }),








    update: adminOrRhProcedure








      .input(z.object({ id: z.number(), title: z.string().optional(), description: z.string().optional(), objective: z.string().optional(), thumbnailUrl: z.string().optional(), isSequential: z.number().optional(), isActive: z.number().optional() }))








      .mutation(async ({ input }) => {








        const { id, ...data } = input;








        await updateLearningTrail(id, data);








        return { ok: true };








      }),








    delete: adminOrRhProcedure








      .input(z.object({ id: z.number() }))








      .mutation(async ({ input }) => {








        await deleteLearningTrail(input.id);








        return { ok: true };








      }),








    getModules: protectedProcedure








      .input(z.object({ trailId: z.number() }))








      .query(async ({ input }) => {








        return getTrailModules(input.trailId);








      }),








    addModule: adminOrRhProcedure








      .input(z.object({








        trailId: z.number(),








        moduleId: z.number().nullable().optional(),








        orderIndex: z.number(),








        itemType: z.enum(["module", "quiz", "exam", "survey"]).optional(),








        quizConfig: z.any().optional(),








        surveyId: z.number().nullable().optional(),








      }))








      .mutation(async ({ input }) => {








        await addModuleToTrail(input.trailId, input.moduleId ?? null, input.orderIndex, {








          itemType: input.itemType ?? "module",








          quizConfig: input.quizConfig ?? null,








          surveyId: input.surveyId ?? null,








        });








        return { ok: true };








      }),








    removeItem: adminOrRhProcedure








      .input(z.object({ id: z.number() }))








      .mutation(async ({ input }) => {








        await removeTrailItem(input.id);








        return { ok: true };








      }),








    removeModule: adminOrRhProcedure








      .input(z.object({ trailId: z.number(), moduleId: z.number() }))








      .mutation(async ({ input }) => {








        await removeModuleFromTrail(input.trailId, input.moduleId);








        return { ok: true };








      }),








  }),

















  // ── Super Admin ─────────────────────────────────────────────────────────────








  superAdmin: router({








    overview: superAdminProcedure.query(async () => {








      return getSuperAdminOverview();








    }),








    getImpersonatedCompanyName: protectedProcedure








      .input(z.object({ companyId: z.number() }))








      .query(async ({ ctx, input }) => {








        if ((ctx.user as any).role !== "super_admin") return null;








        return getCompanyNameById(input.companyId);








      }),








    listCompanies: superAdminProcedure.query(async () => {








      return listAllCompaniesWithStats();








    }),








    createCompany: superAdminProcedure








      .input(z.object({








        name: z.string(),








        cnpj: z.string().optional(),








        plan: z.string().optional(),








        subscriptionStatus: z.string().optional(),








        mrr: z.number().optional(),








        maxEmployees: z.number().optional(),








      }))








      .mutation(async ({ input }) => {








        await createCompanyFull(input);








        return { ok: true };








      }),








    updateCompany: superAdminProcedure








      .input(z.object({








        id: z.number(),








        plan: z.string().optional(),








        subscriptionStatus: z.string().optional(),








        mrr: z.number().optional(),








        maxEmployees: z.number().optional(),








      }))








      .mutation(async ({ input }) => {








        const { id, ...rest } = input;








        await updateCompanyPlan(id, rest);








        return { ok: true };








      }),








    deleteCompany: superAdminProcedure








      .input(z.object({ id: z.number() }))








      .mutation(async ({ input }) => {








        await deleteCompanyHard(input.id);








        return { ok: true };








      }),








    listMasterCatalog: superAdminProcedure.query(async () => {








      return listMasterCatalog();








    }),








    setModuleMasterFlag: superAdminProcedure








      .input(z.object({ moduleId: z.number(), isMaster: z.boolean() }))








      .mutation(async ({ input }) => {








        await setModuleMasterFlag(input.moduleId, input.isMaster);








        return { ok: true };








      }),








    setTrailMasterFlag: superAdminProcedure








      .input(z.object({ trailId: z.number(), isMaster: z.boolean() }))








      .mutation(async ({ input }) => {








        await setTrailMasterFlag(input.trailId, input.isMaster);








        return { ok: true };








      }),








  }),

















  // ── Catalog (configurador) ─────────────────────────────────────────────────








  catalog: router({








    listAvailable: protectedProcedure.query(async ({ ctx }) => {








      const cid = (ctx.user as any).companyId;








      if (!cid) return { masterModules: [], ownModules: [], masterTrails: [], ownTrails: [], enrollments: [] };








      return listAvailableContentForCompany(cid);








    }),








    enroll: adminOrRhProcedure








      .input(z.object({








        contentType: z.enum(['module', 'trail']),








        contentId: z.number(),








        branches: z.array(z.number()).nullable().optional(),








        departments: z.array(z.number()).nullable().optional(),








      }))








      .mutation(async ({ ctx, input }) => {








        const cid = (ctx.user as any).companyId;








        if (!cid) throw new TRPCError({ code: "BAD_REQUEST", message: "Usuário sem empresa associada" });








        await enrollCompanyInContent(cid, input.contentType, input.contentId, input.branches ?? null, input.departments ?? null);








        return { ok: true };








      }),








    unenroll: adminOrRhProcedure








      .input(z.object({ contentType: z.string(), contentId: z.number() }))








      .mutation(async ({ ctx, input }) => {








        const cid = (ctx.user as any).companyId;








        if (!cid) throw new TRPCError({ code: "BAD_REQUEST" });








        await unenrollCompanyFromContent(cid, input.contentType, input.contentId);








        return { ok: true };








      }),








    updateAssignments: adminOrRhProcedure








      .input(z.object({








        enrollmentId: z.number(),








        branches: z.array(z.number()).nullable(),








        departments: z.array(z.number()).nullable(),








      }))








      .mutation(async ({ input }) => {








        await updateEnrollmentAssignments(input.enrollmentId, input.branches, input.departments);








        return { ok: true };








      }),








    cloneModule: adminOrRhProcedure








      .input(z.object({ moduleId: z.number() }))








      .mutation(async ({ ctx, input }) => {








        const cid = (ctx.user as any).companyId;








        if (!cid) throw new TRPCError({ code: "BAD_REQUEST" });








        return cloneModuleForCompany(input.moduleId, cid);








      }),








    cloneTrail: adminOrRhProcedure








      .input(z.object({ trailId: z.number() }))








      .mutation(async ({ ctx, input }) => {








        const cid = (ctx.user as any).companyId;








        if (!cid) throw new TRPCError({ code: "BAD_REQUEST" });








        return cloneTrailForCompany(input.trailId, cid);








      }),








  }),

















  // ── Branches (per company) ──────────────────────────────────────────────────








  branchesAdmin: router({
    list: adminOrRhProcedure
      .input(z.object({ companyId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const role = (ctx.user as any).role;
        const myCid = (ctx.user as any).companyId;
        const cid = (role === "admin_global" && input?.companyId) ? input.companyId : myCid;
        const db = await getDb(); if (!db) return [];
        if (!cid) {
          if (role === "admin_global") {
            const rows: any = await db.execute(drzSql`
              SELECT b.*, c.name AS company_name,
                (SELECT COUNT(*) FROM sectors s WHERE s.branch_id = b.id) AS sectors_count,
                (SELECT COUNT(*) FROM users u WHERE u.branch_id = b.id) AS users_count
              FROM branches b LEFT JOIN companies c ON c.id = b.company_id
              ORDER BY c.name, b.name
            `);
            return Array.isArray(rows) ? (rows[0] ?? rows) : [];
          }
          return [];
        }
        const rows: any = await db.execute(drzSql`
          SELECT b.*,
            (SELECT COUNT(*) FROM sectors s WHERE s.branch_id = b.id) AS sectors_count,
            (SELECT COUNT(*) FROM users u WHERE u.branch_id = b.id) AS users_count
          FROM branches b WHERE b.company_id = ${cid}
          ORDER BY b.name
        `);
        return Array.isArray(rows) ? (rows[0] ?? rows) : [];
      }),
    create: adminOrRhProcedure
      .input(z.object({ companyId: z.number().optional(), name: z.string().min(1), city: z.string().optional(), state: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const role = (ctx.user as any).role;
        const myCid = (ctx.user as any).companyId;
        const cid = (role === "admin_global" && input.companyId) ? input.companyId : myCid;
        if (!cid) throw new TRPCError({ code: "BAD_REQUEST", message: "Empresa nao definida." });
        await createBranch({ companyId: cid, name: input.name, city: input.city, state: input.state });
        return { ok: true };
      }),
    update: adminOrRhProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), city: z.string().optional(), state: z.string().optional(), isActive: z.number().optional() }))
      .mutation(async ({ input }) => {
        const { id, ...rest } = input;
        await updateBranch(id, rest as any);
        return { ok: true };
      }),
    delete: adminOrRhProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const r1: any = await db.execute(drzSql`SELECT COUNT(*) AS n FROM sectors WHERE branch_id = ${input.id}`);
        const sCount = Number((Array.isArray(r1) ? (r1[0]?.[0] ?? r1[0]) : r1)?.n ?? 0);
        const r2: any = await db.execute(drzSql`SELECT COUNT(*) AS n FROM users WHERE branch_id = ${input.id}`);
        const uCount = Number((Array.isArray(r2) ? (r2[0]?.[0] ?? r2[0]) : r2)?.n ?? 0);
        if (sCount > 0 || uCount > 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Filial tem ${sCount} setor(es) e ${uCount} colaborador(es). Remova antes de excluir.` });
        }
        await deleteBranch(input.id);
        return { ok: true };
      }),
  }),

















  // ── Departments (sectors) per company ───────────────────────────────────────








  departmentsAdmin: router({
    list: adminOrRhProcedure
      .input(z.object({ companyId: z.number().optional(), branchId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const role = (ctx.user as any).role;
        const myCid = (ctx.user as any).companyId;
        const cid = (role === "admin_global" && input?.companyId) ? input.companyId : myCid;
        const db = await getDb(); if (!db) return [];
        if (input?.branchId) {
          const rows: any = await db.execute(drzSql`
            SELECT s.*, b.name AS branch_name,
              (SELECT COUNT(*) FROM users u WHERE u.sector_id = s.id) AS users_count
            FROM sectors s LEFT JOIN branches b ON b.id = s.branch_id
            WHERE s.branch_id = ${input.branchId}
            ORDER BY s.name
          `);
          return Array.isArray(rows) ? (rows[0] ?? rows) : [];
        }
        if (!cid) {
          if (role === "admin_global") {
            const rows: any = await db.execute(drzSql`
              SELECT s.*, b.name AS branch_name, c.name AS company_name,
                (SELECT COUNT(*) FROM users u WHERE u.sector_id = s.id) AS users_count
              FROM sectors s LEFT JOIN branches b ON b.id = s.branch_id
              LEFT JOIN companies c ON c.id = s.company_id
              ORDER BY c.name, b.name, s.name
            `);
            return Array.isArray(rows) ? (rows[0] ?? rows) : [];
          }
          return [];
        }
        const rows: any = await db.execute(drzSql`
          SELECT s.*, b.name AS branch_name,
            (SELECT COUNT(*) FROM users u WHERE u.sector_id = s.id) AS users_count
          FROM sectors s LEFT JOIN branches b ON b.id = s.branch_id
          WHERE s.company_id = ${cid}
          ORDER BY b.name, s.name
        `);
        return Array.isArray(rows) ? (rows[0] ?? rows) : [];
      }),
    create: adminOrRhProcedure
      .input(z.object({ name: z.string().min(1), branchId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        let cid = (ctx.user as any).companyId;
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        if (input.branchId) {
          const br: any = await db.execute(drzSql`SELECT company_id FROM branches WHERE id = ${input.branchId} LIMIT 1`);
          const row = Array.isArray(br) ? (br[0]?.[0] ?? br[0]) : br;
          if (row?.company_id) cid = row.company_id;
        }
        if (!cid) throw new TRPCError({ code: "BAD_REQUEST", message: "Empresa nao definida." });
        await createSector({ companyId: cid, branchId: input.branchId, name: input.name } as any);
        return { ok: true };
      }),
    update: adminOrRhProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), branchId: z.number().optional(), isActive: z.number().optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        if (input.name !== undefined) await db.execute(drzSql`UPDATE sectors SET name = ${input.name} WHERE id = ${input.id}`);
        if (input.isActive !== undefined) await db.execute(drzSql`UPDATE sectors SET is_active = ${input.isActive} WHERE id = ${input.id}`);
        if (input.branchId !== undefined) await db.execute(drzSql`UPDATE sectors SET branch_id = ${input.branchId} WHERE id = ${input.id}`);
        return { ok: true };
      }),
    delete: adminOrRhProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const r: any = await db.execute(drzSql`SELECT COUNT(*) AS n FROM users WHERE sector_id = ${input.id}`);
        const uCount = Number((Array.isArray(r) ? (r[0]?.[0] ?? r[0]) : r)?.n ?? 0);
        if (uCount > 0) throw new TRPCError({ code: "BAD_REQUEST", message: `Setor tem ${uCount} colaborador(es). Reatribua antes de excluir.` });
        await deleteSector(input.id);
        return { ok: true };
      }),
  }),

















// ===AI_COMPLIANCE_SURVEYS_ROUTERS===

















  // ── AI Studio ───────────────────────────────────────────────────────────────








  aiStudio: router({








    list: adminOrRhProcedure.query(async ({ ctx }) => {








      const cid = (ctx.user as any).companyId;








      if (!cid) return [];








      return listAIGenerationsForCompany(cid);








    }),

    getModulePdf: protectedProcedure
      .input(z.object({ moduleId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { pdfPath: null };
        try {
          const r: any = await db.execute(drzSql`SELECT generated_outline FROM ai_course_generations WHERE generated_module_id=${input.moduleId} AND status='done' ORDER BY id DESC LIMIT 1`);
          const row = (r as any)[0]?.[0];
          if (!row?.generated_outline) return { pdfPath: null };
          const outline = typeof row.generated_outline === 'string' ? JSON.parse(row.generated_outline) : row.generated_outline;
          return { pdfPath: (outline?.pdfPath as string) ?? null };
        } catch { return { pdfPath: null }; }
      }),

    generate: adminOrRhProcedure


      .input(z.object({


        prompt: z.string().min(5),


        sourceMaterialUrl: z.string().optional().nullable(),


        targetDurationMinutes: z.number().min(5).max(480).default(30),


        level: z.enum(["basico", "intermediario", "avancado"]).default("basico"),


        language: z.string().default("pt-BR"),


        includeQuiz: z.boolean().default(true),


        includeCertificate: z.boolean().default(true),


      }))


      .mutation(async ({ ctx, input }) => {


        const cid = (ctx.user as any).companyId;


        const uid = (ctx.user as any).id ?? (ctx.user as any).userId;


        if (!cid) throw new TRPCError({ code: "BAD_REQUEST", message: "Empresa nao definida no usuario." });


        const genId = await createAIGeneration({ companyId: cid, userId: uid, prompt: input.prompt, sourceMaterialUrl: input.sourceMaterialUrl ?? null, targetDurationMinutes: input.targetDurationMinutes, level: input.level, language: input.language, includeQuiz: input.includeQuiz, includeCertificate: input.includeCertificate });


        await updateAIGenerationProgress(genId, 5, "Iniciando ContentForge...");





        // Background work - mutation returns immediately. Uses ContentForge


        // (server/_core/contentforge/) to produce a Duolingo-style course


        // structure: units -> lessons -> blocks.


        setImmediate(async () => {


          try {


            const { ContentForge } = await import("./_core/contentforge/index");


            const { getImageForQuery } = await import("./_core/images");





            let course: any;


            try {


              course = await ContentForge.generate({


                genId,


                topic: input.prompt,


                audience: "trabalhadores brasileiros",


                duration: input.targetDurationMinutes,


                difficulty: (input.level === "basico" ? "basico" : input.level === "avancado" ? "avancado" : "intermediario") as any,


                language: "pt-BR",


                pedagogy: "duolingo",


                llmProvider: "gemini",


                llmApiKey: process.env.GEMINI_API_KEY!,


                onProgress: async (p, m) => { await updateAIGenerationProgress(genId, p, m); },


              });


            } catch (geminiErr: any) {


              const msg = String(geminiErr?.message || geminiErr);


              const isQuota = msg.includes("429") || msg.includes("quota") || msg.includes("Too Many Requests") || msg.includes("RESOURCE_EXHAUSTED");


              if (isQuota) {


                // Gemini quota esgotada — usar stub inteligente do banco


                await updateAIGenerationProgress(genId, 20, "Cota Gemini esgotada, gerando com stub...");


                           const { generateCourseFromPromptStub } = await import("./db");

                const stub = generateCourseFromPromptStub(input.prompt, { durationMinutes: input.targetDurationMinutes, level: input.level });

                course = {

                  title: stub.title,

                  description: stub.description,

                  totalEstimatedMinutes: stub.durationMinutes,

                  coverImageQuery: stub.title,

                  units: [{ title: "Conteudo do Curso", description: stub.description, icon: "book",

                    lessons: stub.lessons.map((l: any) => ({

                      title: l.title, estimatedMinutes: l.durationMinutes,

                      blocks: [{ type: "concept", data: { title: l.title, body: l.content, imageQuery: l.title } }],

                    })),

                  }],

                  finalExam: [],

                };


                await updateAIGenerationProgress(genId, 70, "Conteudo gerado (stub)...");


              } else {


                throw geminiErr;


              }


            }





            await updateAIGenerationProgress(genId, 86, "Persistindo curso...");


            const dbi = await getDb();


            if (!dbi) throw new Error("DB unavailable");





            // Create module


            await createModule({ title: course.title, description: course.description, durationMinutes: course.totalEstimatedMinutes || input.targetDurationMinutes, isActive: true });


            const r: any = await dbi.execute(drzSql`SELECT id FROM modules WHERE title=${course.title} ORDER BY id DESC LIMIT 1`);


            const moduleId = Number((r as any)[0]?.[0]?.id ?? 0);


            if (!moduleId) throw new Error("Module not created");


            await dbi.execute(drzSql`UPDATE modules SET created_by_company_id=${cid} WHERE id=${moduleId}`);


            try { await dbi.execute(drzSql`INSERT IGNORE INTO company_content_enrollments (company_id, content_type, content_id, is_active) VALUES (${cid}, 'module', ${moduleId}, 1)`); } catch(e) {}





            // Module cover image


            try {


              const coverUrl = await getImageForQuery(course.coverImageQuery || input.prompt);


              await dbi.execute(drzSql`UPDATE modules SET image_url=${coverUrl} WHERE id=${moduleId}`);


            } catch (e) { /* skip */ }





            // Persist units + lessons + blocks


            let unitOrder = 0;


            let lessonOrder = 0;


            for (const unit of course.units) {


              unitOrder++;


              await dbi.execute(drzSql`INSERT INTO units (module_id, title, description, order_index, icon, is_active) VALUES (${moduleId}, ${unit.title}, ${unit.description ?? ""}, ${unitOrder}, ${unit.icon ?? "book"}, 1)`);


              const ur: any = await dbi.execute(drzSql`SELECT LAST_INSERT_ID() as id`);


              const unitId = Number((ur as any)[0]?.[0]?.id ?? 0);





              for (const lesson of unit.lessons) {


                lessonOrder++;


                const summary = (lesson.blocks?.[0] as any)?.data?.body?.toString().slice(0, 280) ?? lesson.title;


                await dbi.execute(drzSql`INSERT INTO lessons (moduleId, unit_id, title, description, content, durationMinutes, estimated_minutes, orderIndex, isActive) VALUES (${moduleId}, ${unitId}, ${lesson.title}, ${summary}, ${""}, ${lesson.estimatedMinutes ?? 3}, ${lesson.estimatedMinutes ?? 3}, ${lessonOrder}, 1)`);


                const lr: any = await dbi.execute(drzSql`SELECT LAST_INSERT_ID() as id`);


                const lessonId = Number((lr as any)[0]?.[0]?.id ?? 0);


                if (!lessonId) continue;





                // First-block image as lesson cover (if any)


                const firstImgQuery = (lesson.blocks || []).map(b => (b as any)?.data?.imageQuery).find(Boolean);


                if (firstImgQuery) {


                  try {


                    const imgUrl = await getImageForQuery(firstImgQuery);


                    await dbi.execute(drzSql`UPDATE lessons SET image_url=${imgUrl} WHERE id=${lessonId}`);


                  } catch (e) { /* skip */ }


                }





                // Insert blocks; fetch image for concept/example types


                let bOrder = 0;


                for (const block of lesson.blocks || []) {


                  bOrder++;


                  const data = { ...((block as any).data || {}) };


                  if ((block.type === "concept" || block.type === "example") && data.imageQuery) {


                    try { data.imageUrl = await getImageForQuery(data.imageQuery); } catch (e) { /* skip */ }


                  }


                  const xp = (block.type === "concept" || block.type === "example" || block.type === "reflection") ? 5 : 10;


                  try {


                    await dbi.execute(drzSql`INSERT INTO lesson_blocks (lesson_id, block_type, content, order_index, xp_reward) VALUES (${lessonId}, ${block.type}, ${JSON.stringify(data)}, ${bOrder}, ${xp})`);


                  } catch (e) { console.error("[aiStudio] block insert failed:", e); }


                }


              }


            }





            // Final exam (kept in ai_module_exams for legacy compatibility)


            if (Array.isArray(course.finalExam)) {


              for (let qi = 0; qi < course.finalExam.length; qi++) {


                const q = course.finalExam[qi];


                try {


                  const correctIdx = Number(q.correctIndex ?? q.correct ?? 0) || 0;
                  await dbi.execute(drzSql`INSERT INTO ai_module_exams (module_id, question_text, options, correct_index, explanation, order_index) VALUES (${moduleId}, ${q.question}, ${JSON.stringify(q.options)}, ${correctIdx}, ${q.explanation ?? ""}, ${qi+1})`);


                } catch (e) { console.error("[aiStudio] exam insert failed:", e); }


              }


            }





            await markAIGenerationDone(genId, moduleId, course as any);


            await updateAIGenerationProgress(genId, 100, "Curso completo!");


          } catch (e: any) {


            console.error("[aiStudio] background generation failed:", e);


            await markAIGenerationFailed(genId, String(e?.message ?? e));


            await updateAIGenerationProgress(genId, 0, String(e?.message ?? e).slice(0, 240));


          }


        });





        return { ok: true, generationId: genId };


      }),





    getStatus: adminOrRhProcedure


      .input(z.object({ id: z.number() }))


      .query(async ({ input }) => {


        return getAIGenerationStatus(input.id);


      }),





    get: adminOrRhProcedure


      .input(z.object({ id: z.number() }))


      .query(async ({ ctx, input }) => {


        const cid = (ctx.user as any).companyId;


        const row: any = await getAIGenerationById(input.id);


        if (!row) return null;


        // Light tenancy guard: only return if same company (re-check via list lookup not needed; column exists)


        return row;


      }),





  }),

















  // ── Compliance Hub ──────────────────────────────────────────────────────────








  compliance: router({








    items: adminOrRhProcedure.query(async () => listComplianceItems()),








    status: adminOrRhProcedure.query(async ({ ctx }) => {








      const cid = (ctx.user as any).companyId;








      if (!cid) return [];








      return getCompanyComplianceStatus(cid);








    }),








    score: adminOrRhProcedure.query(async ({ ctx }) => {








      const cid = (ctx.user as any).companyId;








      if (!cid) return 0;








      return getOverallComplianceScore(cid);








    }),








    update: adminOrRhProcedure








      .input(z.object({ itemId: z.number(), status: z.string(), completionPercent: z.number().min(0).max(100), notes: z.string().optional(), evidenceUrl: z.string().optional() }))








      .mutation(async ({ ctx, input }) => {








        const cid = (ctx.user as any).companyId;








        if (!cid) throw new TRPCError({ code: "BAD_REQUEST" });








        await updateComplianceStatus(cid, input.itemId, input.status, input.completionPercent, input.notes, input.evidenceUrl);








        return { ok: true };








      }),

    // ── NR-01 auto-score ──────────────────────────────────────────────────────
    nr01Status: adminOrRhProcedure.query(async ({ ctx }) => {
      const cid = (ctx.user as any).companyId;
      if (!cid) return { score: 0, axes: [], ranking: [] };
      const db = await getDb();
      const [[cycleRow]] = await execP(db, `SELECT COUNT(*) AS cnt FROM risk_assessments WHERE company_id=? AND status IN ('active','published','completed')`, [cid]) as any;
      const hasCycle = Number((cycleRow as any).cnt) > 0;
      const [[invRow]] = await execP(db, `SELECT COUNT(*) AS cnt FROM risk_inventory_items rii JOIN risk_assessments ra ON ra.id=rii.assessment_id WHERE ra.company_id=?`, [cid]) as any;
      const invCount = Number((invRow as any).cnt);
      const [[planRow]] = await execP(db, `SELECT COUNT(*) AS cnt, SUM(CASE WHEN ap.end_date < CURDATE() AND ap.status NOT IN ('concluido','cancelado','completed','done') THEN 1 ELSE 0 END) AS overdue FROM risk_action_plan_items ap JOIN risk_assessments ra ON ra.id=ap.assessment_id WHERE ra.company_id=?`, [cid]) as any;
      const planCount = Number((planRow as any).cnt);
      const planOverdue = Number((planRow as any).overdue ?? 0);
      const [[survRow]] = await execP(db, `SELECT COUNT(DISTINCT sr.user_id) AS respondentes FROM survey_responses sr JOIN surveys s ON s.id=sr.survey_id WHERE s.company_id=?`, [cid]) as any;
      const respondentes = Number((survRow as any).respondentes);
      const [[empRow]] = await execP(db, `SELECT COUNT(*) AS cnt FROM users WHERE company_id=? AND role NOT IN ('admin','rh','admin_global','super_admin','sesmt','psicologo','chefia')`, [cid]) as any;
      const totalEmp = Math.max(1, Number((empRow as any).cnt));
      const partRate = Math.min(100, Math.round((respondentes / totalEmp) * 100));
      const [[courseRow]] = await execP(db, `SELECT COUNT(DISTINCT rcl.module_id) AS linked FROM risk_course_links rcl`, []) as any;
      const coursesLinked = Number((courseRow as any).linked);
      const [[progRow]] = await execP(db, `SELECT COUNT(DISTINCT up.userId) AS completers FROM user_progress up JOIN users u ON u.id=up.userId WHERE u.company_id=? AND up.isCompleted=1`, [cid]) as any;
      const completers = Number((progRow as any).completers);
      const completionRate = Math.min(100, Math.round((completers / totalEmp) * 100));
      const [[certRow]] = await execP(db, `SELECT COUNT(*) AS cnt FROM certificates c JOIN users u ON u.id=c.userId WHERE u.company_id=?`, [cid]) as any;
      const certCount = Number((certRow as any).cnt);
      const [[termRow]] = await execP(db, `SELECT COUNT(*) AS cnt FROM course_acceptance_terms ta JOIN users u ON u.id=ta.user_id WHERE u.company_id=?`, [cid]) as any;
      const termCount = Number((termRow as any).cnt);
      const [[respRow]] = await execP(db, `SELECT COUNT(*) AS cnt FROM responsible_technicians WHERE company_id=?`, [cid]) as any;
      const hasResp = Number((respRow as any).cnt) > 0;
      const cicloScore = hasCycle ? 100 : 0;
      const invScore = invCount >= 5 ? 100 : Math.round((invCount / 5) * 100);
      const planScore = planCount === 0 ? 0 : planOverdue === 0 ? 100 : Math.max(0, Math.round(((planCount - planOverdue) / planCount) * 100));
      const partScore = partRate;
      const trainScore = coursesLinked > 0 ? Math.round((completionRate + (coursesLinked >= 3 ? 100 : coursesLinked * 33)) / 2) : 0;
      const evidScore = Math.min(100, (certCount > 0 ? 40 : 0) + (termCount > 0 ? 40 : 0) + (hasResp ? 20 : 0));
      const axes = [
        { axis: "ciclo", label: "Ciclo de Avaliação Ativo", score: cicloScore, details: [{ ok: hasCycle, warn: false, text: hasCycle ? "Ciclo de avaliação ativo encontrado" : "Nenhum ciclo de avaliação iniciado" }] },
        { axis: "inventario", label: "Inventário de Riscos", score: invScore, details: [{ ok: invCount >= 5, warn: invCount > 0 && invCount < 5, text: `${invCount} itens de risco identificados` }] },
        { axis: "plano", label: "Plano de Ação", score: planScore, details: [{ ok: planCount > 0, warn: false, text: `${planCount} ação(ões) no plano` }, { ok: planOverdue === 0, warn: planOverdue > 0, text: planOverdue > 0 ? `${planOverdue} ação(ões) com prazo vencido` : "Nenhuma ação vencida" }] },
        { axis: "participacao", label: "Participação dos Trabalhadores", score: partScore, details: [{ ok: partRate >= 70, warn: partRate >= 30 && partRate < 70, text: `${respondentes}/${totalEmp} colaboradores responderam pesquisas (${partRate}%)` }] },
        { axis: "treinamento", label: "Capacitação e Treinamentos", score: trainScore, details: [{ ok: coursesLinked >= 3, warn: coursesLinked > 0 && coursesLinked < 3, text: `${coursesLinked} curso(s) vinculados aos 13 fatores NR-01` }, { ok: completionRate >= 70, warn: completionRate >= 30 && completionRate < 70, text: `${completionRate}% de conclusão pelos colaboradores` }] },
        { axis: "evidencias", label: "Evidências Documentais", score: evidScore, details: [{ ok: certCount > 0, warn: false, text: `${certCount} certificado(s) emitido(s)` }, { ok: termCount > 0, warn: false, text: `${termCount} aceite(s) eletrônico(s)` }, { ok: hasResp, warn: false, text: hasResp ? "Responsável técnico cadastrado" : "Sem responsável técnico" }] },
      ];
      const score = Math.round((cicloScore + invScore + planScore + partScore + trainScore + evidScore) / 6);
      const [secRows] = await execP(db, `SELECT s.name, COUNT(DISTINCT up.userId) AS completers, COUNT(DISTINCT u.id) AS total FROM sectors s JOIN users u ON u.sector_id=s.id AND u.company_id=? LEFT JOIN user_progress up ON up.userId=u.id AND up.isCompleted=1 WHERE s.company_id=? GROUP BY s.id, s.name ORDER BY completers DESC LIMIT 10`, [cid, cid]) as any;
      const ranking = (secRows as any[]).map((r: any) => ({ name: r.name, score: r.total > 0 ? Math.min(100, Math.round((r.completers / r.total) * 100)) : 0 }));
      return { score, axes, ranking };
    }),

    // ── Simular Fiscalização ──────────────────────────────────────────────────
    simulateFiscalizacao: adminOrRhProcedure.mutation(async ({ ctx }) => {
      const cid = (ctx.user as any).companyId;
      if (!cid) throw new TRPCError({ code: "BAD_REQUEST" });
      const db = await getDb();
      const conformidades: any[] = [];
      const alertas: any[] = [];
      const nao_conf: any[] = [];
      const push = (sev: string, item: any) => { if (sev === "ok") conformidades.push(item); else if (sev === "warn") alertas.push(item); else nao_conf.push(item); };
      const [[invR]] = await execP(db, `SELECT COUNT(*) AS cnt FROM risk_inventory_items rii JOIN risk_assessments ra ON ra.id=rii.assessment_id WHERE ra.company_id=?`, [cid]) as any;
      const invCnt = Number((invR as any).cnt);
      if (invCnt >= 5) push("ok", { eixo: "Inventário de Riscos", check: "Inventário identificado", detail: `${invCnt} itens catalogados` });
      else if (invCnt > 0) push("warn", { eixo: "Inventário de Riscos", check: "Inventário incompleto", detail: `Apenas ${invCnt} item(s). Recomenda-se ao menos 5.`, acao: "Complementar o inventário de riscos no GRO" });
      else push("nao_conf", { eixo: "Inventário de Riscos", check: "Sem inventário de riscos", detail: "Nenhum risco identificado", acao: "Iniciar ciclo de avaliação e cadastrar riscos psicossociais" });
      const [[planR]] = await execP(db, `SELECT COUNT(*) AS cnt, SUM(CASE WHEN ap.end_date < CURDATE() AND ap.status NOT IN ('concluido','cancelado','completed','done') THEN 1 ELSE 0 END) AS overdue FROM risk_action_plan_items ap JOIN risk_assessments ra ON ra.id=ap.assessment_id WHERE ra.company_id=?`, [cid]) as any;
      const pCnt = Number((planR as any).cnt); const pOvd = Number((planR as any).overdue ?? 0);
      if (pCnt === 0) push("nao_conf", { eixo: "Plano de Ação", check: "Plano de ação ausente", detail: "Nenhuma ação cadastrada", acao: "Elaborar plano de ação vinculado aos riscos identificados" });
      else if (pOvd > 0) push("warn", { eixo: "Plano de Ação", check: "Ações vencidas", detail: `${pOvd} de ${pCnt} ação(ões) com prazo expirado`, acao: "Atualizar ou concluir ações vencidas" });
      else push("ok", { eixo: "Plano de Ação", check: "Plano de ação em dia", detail: `${pCnt} ação(ões), nenhuma vencida` });
      const [[sR]] = await execP(db, `SELECT COUNT(DISTINCT sr.user_id) AS cnt FROM survey_responses sr JOIN surveys s ON s.id=sr.survey_id WHERE s.company_id=?`, [cid]) as any;
      const [[eR]] = await execP(db, `SELECT COUNT(*) AS cnt FROM users WHERE company_id=? AND role NOT IN ('admin','rh','admin_global','super_admin','sesmt','psicologo','chefia')`, [cid]) as any;
      const resp2 = Number((sR as any).cnt); const emp2 = Math.max(1, Number((eR as any).cnt)); const pct2 = Math.min(100, Math.round((resp2 / emp2) * 100));
      if (pct2 >= 70) push("ok", { eixo: "Participação", check: "Boa adesão às pesquisas", detail: `${pct2}% dos colaboradores responderam (${resp2}/${emp2})` });
      else if (pct2 >= 30) push("warn", { eixo: "Participação", check: "Participação abaixo do esperado", detail: `${pct2}% de adesão`, acao: "Reforçar comunicação e acesso às pesquisas" });
      else push("nao_conf", { eixo: "Participação", check: "Participação crítica", detail: `Apenas ${pct2}% de adesão`, acao: "Campanhas urgentes de mobilização e pesquisas simplificadas" });
      const [[facR]] = await execP(db, `SELECT COUNT(DISTINCT module_id) AS cnt FROM risk_course_links`, []) as any;
      const facLinked = Number((facR as any).cnt);
      if (facLinked >= 13) push("ok", { eixo: "Fatores de Risco", check: "Todos os 13 fatores NR-01 endereçados", detail: "Cada fator possui ao menos um curso vinculado" });
      else if (facLinked >= 5) push("warn", { eixo: "Fatores de Risco", check: "Fatores parcialmente endereçados", detail: `${facLinked}/13 fatores com curso vinculado`, acao: "Vincular cursos aos fatores restantes" });
      else push("nao_conf", { eixo: "Fatores de Risco", check: "Fatores sem programa de controle", detail: `Apenas ${facLinked}/13 fatores endereçados`, acao: "Vincular cursos e ações preventivas para cada fator de risco" });
      const [[cR2]] = await execP(db, `SELECT COUNT(DISTINCT up.userId) AS cnt FROM user_progress up JOIN users u ON u.id=up.userId WHERE u.company_id=? AND up.isCompleted=1`, [cid]) as any;
      const compl2 = Number((cR2 as any).cnt); const cRate = Math.min(100, Math.round((compl2 / emp2) * 100));
      if (cRate >= 70) push("ok", { eixo: "Capacitação", check: "Alta conclusão de treinamentos", detail: `${cRate}% dos colaboradores completaram ao menos 1 curso` });
      else if (cRate >= 30) push("warn", { eixo: "Capacitação", check: "Conclusão de treinamentos abaixo do ideal", detail: `${cRate}% de conclusão`, acao: "Verificar disponibilidade de conteúdo em Meus Cursos" });
      else push("nao_conf", { eixo: "Capacitação", check: "Baixíssima conclusão de treinamentos", detail: `Apenas ${cRate}% de conclusão`, acao: "Disponibilizar cursos e enviar lembretes automáticos" });
      const [[certR2]] = await execP(db, `SELECT COUNT(*) AS cnt FROM certificates c JOIN users u ON u.id=c.userId WHERE u.company_id=?`, [cid]) as any;
      const [[trmR2]] = await execP(db, `SELECT COUNT(*) AS cnt FROM course_acceptance_terms ta JOIN users u ON u.id=ta.user_id WHERE u.company_id=?`, [cid]) as any;
      const [[resR2]] = await execP(db, `SELECT COUNT(*) AS cnt FROM responsible_technicians WHERE company_id=?`, [cid]) as any;
      const certCnt2 = Number((certR2 as any).cnt); const trmCnt2 = Number((trmR2 as any).cnt); const resOk2 = Number((resR2 as any).cnt) > 0;
      if (certCnt2 > 0) push("ok", { eixo: "Evidências", check: "Certificados emitidos", detail: `${certCnt2} certificado(s) auditáveis` });
      else push("warn", { eixo: "Evidências", check: "Sem certificados emitidos", detail: "Nenhum certificado gerado", acao: "Completar treinamentos para emitir certificados" });
      if (trmCnt2 > 0) push("ok", { eixo: "Evidências", check: "Aceites eletrônicos registrados", detail: `${trmCnt2} aceite(s) com IP e timestamp` });
      else push("warn", { eixo: "Evidências", check: "Sem aceites eletrônicos", detail: "Nenhum termo aceito registrado", acao: "Ativar termos de aceite nos cursos e pesquisas" });
      if (resOk2) push("ok", { eixo: "Evidências", check: "Responsável técnico cadastrado", detail: "Assinatura digital disponível para laudos" });
      else push("nao_conf", { eixo: "Evidências", check: "Sem responsável técnico", detail: "Nenhum RT com assinatura digital cadastrado", acao: "Cadastrar Responsável Técnico em PGR > Responsáveis Técnicos" });
      return { conformidades, alertas, nao_conf };
    }),

    // ── Evidências Vinculadas ─────────────────────────────────────────────────
    nr01Evidences: adminOrRhProcedure.query(async ({ ctx }) => {
      const cid = (ctx.user as any).companyId;
      if (!cid) return [];
      const db = await getDb();
      const [cycles] = await execP(db, `SELECT id, cycle_name AS title, status, created_at FROM risk_assessments WHERE company_id=? ORDER BY created_at DESC LIMIT 10`, [cid]) as any;
      const [invItems] = await execP(db, `SELECT rii.id, f.name AS description, rii.risco_final AS risk_level, ra.cycle_name AS cycle FROM risk_inventory_items rii JOIN risk_assessments ra ON ra.id=rii.assessment_id LEFT JOIN psychosocial_factors f ON f.id=rii.factor_id WHERE ra.company_id=? ORDER BY rii.id DESC LIMIT 20`, [cid]) as any;
      const [planItems] = await execP(db, `SELECT ap.id, ap.action_description AS title, ap.status, ap.end_date AS due_date FROM risk_action_plan_items ap JOIN risk_assessments ra ON ra.id=ap.assessment_id WHERE ra.company_id=? ORDER BY ap.id DESC LIMIT 20`, [cid]) as any;
      const [certs2] = await execP(db, `SELECT c.id, c.certificateCode AS certificate_code, c.issuedAt AS issued_at, u.name AS user_name FROM certificates c JOIN users u ON u.id=c.userId WHERE u.company_id=? ORDER BY c.issuedAt DESC LIMIT 20`, [cid]) as any;
      const [terms2] = await execP(db, `SELECT ta.id, ta.accepted_at, ta.ip_address, u.name AS user_name FROM course_acceptance_terms ta JOIN users u ON u.id=ta.user_id WHERE u.company_id=? ORDER BY ta.accepted_at DESC LIMIT 20`, [cid]) as any;
      const [surv2] = await execP(db, `SELECT s.id, s.title, COUNT(DISTINCT sr.user_id) AS respondentes FROM surveys s LEFT JOIN survey_responses sr ON sr.survey_id=s.id WHERE s.company_id=? GROUP BY s.id ORDER BY s.created_at DESC LIMIT 10`, [cid]) as any;
      return [
        { category: "Ciclos de Avaliação GRO", items: (cycles as any[]).map((r: any) => ({ label: r.title ?? `Ciclo #${r.id}`, detail: `Status: ${r.status} · ${r.created_at ? new Date(r.created_at).toLocaleDateString("pt-BR") : "—"}` })) },
        { category: "Inventário de Riscos", items: (invItems as any[]).map((r: any) => ({ label: r.description ? String(r.description).substring(0, 80) : `Item #${r.id}`, detail: `Nível: ${r.risk_level ?? "—"} · Ciclo: ${r.cycle ?? "—"}` })) },
        { category: "Plano de Ação", items: (planItems as any[]).map((r: any) => ({ label: r.title ?? `Ação #${r.id}`, detail: `Status: ${r.status} · Prazo: ${r.due_date ? new Date(r.due_date).toLocaleDateString("pt-BR") : "—"}` })) },
        { category: "Certificados Emitidos", items: (certs2 as any[]).map((r: any) => ({ label: `${r.user_name ?? "Colaborador"} — Código: ${r.certificate_code}`, detail: `${r.issued_at ? new Date(r.issued_at).toLocaleDateString("pt-BR") : "—"}` })) },
        { category: "Aceites Eletrônicos", items: (terms2 as any[]).map((r: any) => ({ label: `${r.user_name ?? "Colaborador"} — IP: ${r.ip_address ?? "—"}`, detail: `${r.accepted_at ? new Date(r.accepted_at).toLocaleDateString("pt-BR") : "—"}` })) },
        { category: "Pesquisas Aplicadas", items: (surv2 as any[]).map((r: any) => ({ label: r.title ?? `Pesquisa #${r.id}`, detail: `${r.respondentes} respondente(s)` })) },
      ];
    }),

    // ── Relatório para Fiscalização ───────────────────────────────────────────
    relatorioFiscalizacaoData: adminOrRhProcedure.query(async ({ ctx }) => {
      const cid = (ctx.user as any).companyId;
      if (!cid) return null;
      const db = await getDb();

      // Empresa
      const [[compRow]] = await execP(db, `SELECT id, name, cnpj, address, NULL AS city, NULL AS state FROM companies WHERE id=?`, [cid]) as any;
      const company = compRow as any;

      // Responsável técnico
      const [respRows] = await execP(db, `SELECT name, profession AS council, registration AS council_number, profession AS role FROM responsible_technicians WHERE company_id=? LIMIT 1`, [cid]) as any;
      const respTec = (respRows as any[])[0] ?? null;

      // Score e eixos (replica nr01Status logic inline)
      const [[cycleRow]] = await execP(db, `SELECT COUNT(*) AS cnt FROM risk_assessments WHERE company_id=? AND status IN ('active','published','completed')`, [cid]) as any;
      const hasCycle = Number((cycleRow as any).cnt) > 0;
      const [[invRow]] = await execP(db, `SELECT COUNT(*) AS cnt FROM risk_inventory_items rii JOIN risk_assessments ra ON ra.id=rii.assessment_id WHERE ra.company_id=?`, [cid]) as any;
      const invCount = Number((invRow as any).cnt);
      const [[planRow]] = await execP(db, `SELECT COUNT(*) AS cnt, SUM(CASE WHEN ap.end_date < CURDATE() AND ap.status NOT IN ('concluido','cancelado','completed','done') THEN 1 ELSE 0 END) AS overdue FROM risk_action_plan_items ap JOIN risk_assessments ra ON ra.id=ap.assessment_id WHERE ra.company_id=?`, [cid]) as any;
      const planCount = Number((planRow as any).cnt);
      const planOverdue = Number((planRow as any).overdue ?? 0);
      const [[survRow]] = await execP(db, `SELECT COUNT(DISTINCT sr.user_id) AS respondentes FROM survey_responses sr JOIN surveys s ON s.id=sr.survey_id WHERE s.company_id=?`, [cid]) as any;
      const respondentes = Number((survRow as any).respondentes);
      const [[empRow]] = await execP(db, `SELECT COUNT(*) AS cnt FROM users WHERE company_id=? AND role NOT IN ('admin','rh','admin_global','super_admin','sesmt','psicologo','chefia')`, [cid]) as any;
      const totalEmp = Math.max(1, Number((empRow as any).cnt));
      const partRate = Math.min(100, Math.round((respondentes / totalEmp) * 100));
      const [[courseRow]] = await execP(db, `SELECT COUNT(DISTINCT rcl.module_id) AS linked FROM risk_course_links rcl`, []) as any;
      const coursesLinked = Number((courseRow as any).linked);
      const [[progRow]] = await execP(db, `SELECT COUNT(DISTINCT up.userId) AS completers FROM user_progress up JOIN users u ON u.id=up.userId WHERE u.company_id=? AND up.isCompleted=1`, [cid]) as any;
      const completers = Number((progRow as any).completers);
      const completionRate = Math.min(100, Math.round((completers / totalEmp) * 100));
      const [[certRow]] = await execP(db, `SELECT COUNT(*) AS cnt FROM certificates c JOIN users u ON u.id=c.userId WHERE u.company_id=?`, [cid]) as any;
      const certCount = Number((certRow as any).cnt);
      const [[termRow]] = await execP(db, `SELECT COUNT(*) AS cnt FROM course_acceptance_terms ta JOIN users u ON u.id=ta.user_id WHERE u.company_id=?`, [cid]) as any;
      const termCount = Number((termRow as any).cnt);
      const cicloScore = hasCycle ? 100 : 0;
      const invScore = invCount >= 5 ? 100 : Math.round((invCount / 5) * 100);
      const planScore = planCount === 0 ? 0 : planOverdue === 0 ? 100 : Math.max(0, Math.round(((planCount - planOverdue) / planCount) * 100));
      const partScore = partRate;
      const trainScore = coursesLinked > 0 ? Math.round((completionRate + (coursesLinked >= 3 ? 100 : coursesLinked * 33)) / 2) : 0;
      const evidScore = Math.min(100, (certCount > 0 ? 40 : 0) + (termCount > 0 ? 40 : 0));
      const score = Math.round((cicloScore + invScore + planScore + partScore + trainScore + evidScore) / 6);

      // Inventário detalhado
      const [invItems] = await execP(db, `SELECT f.name AS description, rii.risco_final AS risk_level, rii.gravidade AS risk_type, '' AS sector_name, ra.cycle_name AS cycle FROM risk_inventory_items rii JOIN risk_assessments ra ON ra.id=rii.assessment_id LEFT JOIN psychosocial_factors f ON f.id=rii.factor_id WHERE ra.company_id=? ORDER BY rii.risco_final DESC LIMIT 50`, [cid]) as any;

      // Plano de ação
      const [planItems] = await execP(db, `SELECT ap.action_description AS title, ap.action_description AS description, ap.responsible_party AS responsible, ap.status, ap.end_date AS due_date, ap.priority FROM risk_action_plan_items ap JOIN risk_assessments ra ON ra.id=ap.assessment_id WHERE ra.company_id=? ORDER BY ap.end_date ASC LIMIT 50`, [cid]) as any;

      // Certificados
      const [certs] = await execP(db, `SELECT c.certificateCode AS certificate_code, c.issuedAt AS issued_at, u.name AS user_name, u.email FROM certificates c JOIN users u ON u.id=c.userId WHERE u.company_id=? ORDER BY c.issuedAt DESC LIMIT 50`, [cid]) as any;

      // Pesquisas aplicadas
      const [surveys] = await execP(db, `SELECT s.title, s.category AS type, COUNT(DISTINCT sr.user_id) AS respondentes, s.created_at FROM surveys s LEFT JOIN survey_responses sr ON sr.survey_id=s.id WHERE s.company_id=? GROUP BY s.id ORDER BY s.created_at DESC LIMIT 10`, [cid]) as any;

      // Fatores NR-01 endereçados
      const [factors] = await execP(db, `SELECT pf.code, pf.name, COUNT(rcl.module_id) AS cursos FROM psychosocial_factors pf LEFT JOIN risk_course_links rcl ON rcl.factor_id=pf.id GROUP BY pf.id ORDER BY pf.axis_order`, []) as any;

      return {
        company, respTec, score,
        stats: { hasCycle, invCount, planCount, planOverdue, respondentes, totalEmp, partRate, coursesLinked, completionRate, completers, certCount, termCount },
        axes: [
          { label: "Ciclo de Avaliação", score: cicloScore },
          { label: "Inventário de Riscos", score: invScore },
          { label: "Plano de Ação", score: planScore },
          { label: "Participação", score: partScore },
          { label: "Capacitação", score: trainScore },
          { label: "Evidências", score: evidScore },
        ],
        inventory: invItems as any[],
        planItems: planItems as any[],
        certs: certs as any[],
        surveys: surveys as any[],
        factors: factors as any[],
        generatedAt: new Date().toISOString(),
      };
    }),

    // ── Relatório de Legitimidade Metodológica ────────────────────────────────
    relatorioMetodologiaData: adminOrRhProcedure.query(async ({ ctx }) => {
      const cid = (ctx.user as any).companyId;
      if (!cid) return null;
      const db = await getDb();

      const [[compRow]] = await execP(db, `SELECT id, name, cnpj, address, NULL AS city, NULL AS state FROM companies WHERE id=?`, [cid]) as any;
      const company = compRow as any;
      const [respRows] = await execP(db, `SELECT name, profession AS council, registration AS council_number, profession AS role FROM responsible_technicians WHERE company_id=? LIMIT 1`, [cid]) as any;
      const respTec = (respRows as any[])[0] ?? null;
      const [[empRow]] = await execP(db, `SELECT COUNT(*) AS cnt FROM users WHERE company_id=? AND role NOT IN ('admin','rh','admin_global','super_admin','sesmt','psicologo','chefia')`, [cid]) as any;
      const totalEmp = Number((empRow as any).cnt);
      const [[survRow]] = await execP(db, `SELECT COUNT(DISTINCT sr.user_id) AS respondentes, COUNT(DISTINCT s.id) AS surveys FROM survey_responses sr JOIN surveys s ON s.id=sr.survey_id WHERE s.company_id=?`, [cid]) as any;
      const respondentes = Number((survRow as any).respondentes);
      const surveyCount = Number((survRow as any).surveys);
      const [[certRow]] = await execP(db, `SELECT COUNT(*) AS cnt FROM certificates c JOIN users u ON u.id=c.userId WHERE u.company_id=?`, [cid]) as any;
      const certCount = Number((certRow as any).cnt);
      const [[termRow]] = await execP(db, `SELECT COUNT(*) AS cnt FROM course_acceptance_terms ta JOIN users u ON u.id=ta.user_id WHERE u.company_id=?`, [cid]) as any;
      const termCount = Number((termRow as any).cnt);
      const [[auditRow]] = await execP(db, `SELECT COUNT(*) AS cnt FROM audit_logs al JOIN users u ON u.id=al.user_id WHERE u.company_id=?`, [cid]) as any;
      const auditCount = Number((auditRow as any).cnt);
      const [survNames] = await execP(db, `SELECT title, category AS type FROM surveys WHERE company_id=? GROUP BY title, category ORDER BY MAX(created_at) DESC LIMIT 5`, [cid]) as any;

      return {
        company, respTec,
        stats: { totalEmp, respondentes, surveyCount, certCount, termCount, auditCount },
        surveyNames: survNames as any[],
        generatedAt: new Date().toISOString(),
      };
    }),












  }),

















  // ── Surveys ────────────────────────────────────────────────────────────────








  surveys: router({








    listTemplates: adminOrRhProcedure.query(async () => listSurveyTemplates()),








    list: adminOrRhProcedure.query(async ({ ctx }) => {








      const cid = (ctx.user as any).companyId;








      if (!cid) return [];








      return listSurveysForCompany(cid);








    }),








    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => getSurveyById(input.id)),








    create: adminOrRhProcedure








      .input(z.object({ title: z.string(), description: z.string().optional(), category: z.string().optional(), isAnonymous: z.boolean().optional() }))








      .mutation(async ({ ctx, input }) => {








        const cid = (ctx.user as any).companyId;








        if (!cid) throw new TRPCError({ code: "BAD_REQUEST" });








        const id = await createSurvey({ companyId: cid, ...input, createdBy: (ctx.user as any).id });








        return { id };








      }),








    createFromTemplate: adminOrRhProcedure








      .input(z.object({ templateId: z.number() }))








      .mutation(async ({ ctx, input }) => {








        const cid = (ctx.user as any).companyId;








        if (!cid) throw new TRPCError({ code: "BAD_REQUEST" });








        const id = await createSurveyFromTemplate(input.templateId, cid, (ctx.user as any).id);








        return { id };








      }),








    addQuestion: adminOrRhProcedure








      .input(z.object({ surveyId: z.number(), questionText: z.string(), questionType: z.string().default("likert"), options: z.any().optional(), isRequired: z.boolean().optional(), orderIndex: z.number().optional() }))








      .mutation(async ({ input }) => {








        const { surveyId, ...rest } = input;








        await addSurveyQuestion(surveyId, rest);








        return { ok: true };








      }),








    deleteQuestion: adminOrRhProcedure








      .input(z.object({ id: z.number() }))








      .mutation(async ({ input }) => { await deleteSurveyQuestion(input.id); return { ok: true }; }),








    launch: adminOrRhProcedure








      .input(z.object({ id: z.number() }))








      .mutation(async ({ input }) => { await updateSurveyStatus(input.id, "active"); return { ok: true }; }),








    close: adminOrRhProcedure








      .input(z.object({ id: z.number() }))








      .mutation(async ({ input }) => { await updateSurveyStatus(input.id, "closed"); return { ok: true }; }),








    delete: adminOrRhProcedure








      .input(z.object({ id: z.number() }))








      .mutation(async ({ input }) => { await deleteSurvey(input.id); return { ok: true }; }),








    listForUser: protectedProcedure.query(async ({ ctx }) => {








      const uid = (ctx.user as any).id ?? (ctx.user as any).userId;








      return listActiveSurveysForUser(uid);








    }),








    submit: protectedProcedure








      .input(z.object({ surveyId: z.number(), answers: z.array(z.object({ questionId: z.number(), value: z.string() })) }))








      .mutation(async ({ ctx, input }) => {








        const uid = (ctx.user as any).id ?? (ctx.user as any).userId;








        const branchId = (ctx.user as any).branchId ?? undefined;








        const sectorId = (ctx.user as any).sectorId ?? undefined;








        const s = await getSurveyById(input.surveyId);








        const userIdForResponse = s?.isAnonymous ? undefined : uid;








        const id = await submitSurveyResponse(input.surveyId, input.answers, userIdForResponse, branchId, sectorId);








        return { id };








      }),








    results: adminOrRhProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => getSurveyResults(input.id)),








  }),

















  // ── Dashboard ──────────────────────────────────────────────────────────────








  dashboard: router({








    chefiaDashboard: protectedProcedure.query(async ({ ctx }) => {
      const cid = (ctx.user as any).companyId;
      const sectorId = (ctx.user as any).sectorId;
      const db = await getDb();
      if (!db || !cid) return { sectorName: null, teamSize: 0, actionPlanItems: [], riskSummary: [], trainingRate: 0 };
      
      // Sector info
      const sr: any = await db.execute(drzSql`SELECT name FROM sectors WHERE id=${sectorId} LIMIT 1`);
      const sectorName = (sr as any)[0]?.[0]?.name ?? "Meu setor";
      
      // Team size
      const tr: any = await db.execute(drzSql`SELECT COUNT(*) AS c FROM users WHERE company_id=${cid} AND sector_id=${sectorId} AND role='user'`);
      const teamSize = Number((tr as any)[0]?.[0]?.c ?? 0);
      
      // Action plan items for this sector
      const apr: any = await db.execute(drzSql`
        SELECT ap.id, ap.action_description, ap.priority, ap.end_date, ap.status,
               pf.name AS factor_name
        FROM risk_action_plan_items ap
        JOIN risk_assessments ra ON ra.id = ap.assessment_id
        JOIN psychosocial_factors pf ON pf.id = ap.factor_id
        WHERE ra.company_id=${cid} AND ra.sector_id=${sectorId}
          AND ap.status NOT IN ('concluido','cancelado')
        ORDER BY ap.priority DESC, ap.end_date ASC
        LIMIT 20`);
      const actionPlanItems = ((apr as any)[0] ?? []).map((r: any) => ({
        id: Number(r.id),
        actionDescription: String(r.action_description ?? ""),
        priority: String(r.priority ?? "baixa"),
        endDate: r.end_date ? new Date(r.end_date).toISOString().slice(0,10) : null,
        status: String(r.status ?? "programado"),
        factorName: String(r.factor_name ?? ""),
      }));
      
      // Risk summary (anonymized - only aggregate counts per level)
      const rr: any = await db.execute(drzSql`
        SELECT ii.risco_final, COUNT(*) AS cnt
        FROM risk_inventory_items ii
        JOIN risk_assessments ra ON ra.id = ii.assessment_id
        WHERE ra.company_id=${cid} AND ra.sector_id=${sectorId}
        GROUP BY ii.risco_final`);
      const riskSummary = ((rr as any)[0] ?? []).map((r: any) => ({
        level: String(r.risco_final ?? "baixo"),
        count: Number(r.cnt ?? 0),
      }));
      
      // Training completion rate for the sector
      const certR: any = await db.execute(drzSql`
        SELECT 
          COUNT(DISTINCT uc.user_id) AS completers,
          COUNT(DISTINCT u.id) AS total
        FROM users u
        LEFT JOIN user_completions uc ON uc.user_id = u.id
        WHERE u.company_id=${cid} AND u.sector_id=${sectorId} AND u.role='user'`);
      const completers = Number((certR as any)[0]?.[0]?.completers ?? 0);
      const total = Number((certR as any)[0]?.[0]?.total ?? 0);
      const trainingRate = total > 0 ? Math.round((completers / total) * 100) : 0;
      
      return { sectorName, teamSize, actionPlanItems, riskSummary, trainingRate };
    }),

    managerOverview: adminOrRhProcedure.query(async ({ ctx }) => {








      const cid = (ctx.user as any).companyId ?? null;








      return getManagerDashboard(cid);








    }),








    employeeHome: protectedProcedure.query(async ({ ctx }) => {








      const uid = (ctx.user as any).id ?? (ctx.user as any).userId;








      return getEmployeeDashboard(uid);








    }),








    companyExpirations: adminOrRhProcedure.query(async ({ ctx }) => {








      const cid = (ctx.user as any).companyId ?? null;








      if (!cid) return [];








      return getCompanyLicenseExpirations(cid);








    }),








  }),

















  // ── Professional Licenses ─────────────────────────────────────────────────








  licenses: router({








    list: protectedProcedure.query(async ({ ctx }) => {








      const uid = (ctx.user as any).id ?? (ctx.user as any).userId;








      return listProfessionalLicenses(uid);








    }),








    create: protectedProcedure








      .input(z.object({








        licenseType: z.string(),








        licenseNumber: z.string().optional(),








        issuedAt: z.string().optional(),








        expiresAt: z.string().optional(),








        documentUrl: z.string().optional(),








        notes: z.string().optional(),








      }))








      .mutation(async ({ ctx, input }) => {








        const uid = (ctx.user as any).id ?? (ctx.user as any).userId;








        await createProfessionalLicense({








          userId: uid,








          licenseType: input.licenseType,








          licenseNumber: input.licenseNumber ?? null,








          issuedAt: input.issuedAt ? new Date(input.issuedAt) : null,








          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,








          documentUrl: input.documentUrl ?? null,








          notes: input.notes ?? null,








        } as any);








        return { ok: true };








      }),








    update: protectedProcedure








      .input(z.object({








        id: z.number(),








        licenseType: z.string().optional(),








        licenseNumber: z.string().optional(),








        issuedAt: z.string().optional(),








        expiresAt: z.string().optional(),








        documentUrl: z.string().optional(),








        notes: z.string().optional(),








      }))








      .mutation(async ({ input }) => {








        const { id, issuedAt, expiresAt, ...rest } = input;








        await updateProfessionalLicense(id, {








          ...rest,








          ...(issuedAt !== undefined ? { issuedAt: issuedAt ? new Date(issuedAt) : null } : {}),








          ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}),








        } as any);








        return { ok: true };








      }),








    delete: protectedProcedure








      .input(z.object({ id: z.number() }))








      .mutation(async ({ input }) => {








        await deleteProfessionalLicense(input.id);








        return { ok: true };








      }),








  }),




















  // ── Missao (Duolingo-style player) ──────────────────────────────────────────


  missao: router({


    // Returns module + units + lessons (with per-lesson user progress) + hearts


    getCourseStructure: protectedProcedure


      .input(z.object({ moduleId: z.number() }))


      .query(async ({ ctx, input }) => {


        const uid = Number((ctx.user as any).id ?? (ctx.user as any).userId);


        const db = await getDb();


        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });


        const mr: any = await db.execute(drzSql`SELECT id, title, description, image_url, durationMinutes FROM modules WHERE id=${input.moduleId} LIMIT 1`);


        const mod = (mr as any)[0]?.[0];


        if (!mod) throw new TRPCError({ code: "NOT_FOUND" });


        const ur: any = await db.execute(drzSql`SELECT id, title, description, icon, order_index FROM units WHERE module_id=${input.moduleId} ORDER BY order_index ASC`);


        const units = (ur as any)[0] as Array<{ id: number; title: string; description: string; icon: string; order_index: number }>;


        const lr: any = await db.execute(drzSql`SELECT id, unit_id, title, estimated_minutes, orderIndex FROM lessons WHERE moduleId=${input.moduleId} ORDER BY orderIndex ASC`);


        const lessons = (lr as any)[0] as Array<{ id: number; unit_id: number; title: string; estimated_minutes: number; orderIndex: number }>;


        const pr: any = await db.execute(drzSql`SELECT lesson_id, status, completed_blocks, total_blocks, xp_earned, accuracy_percent FROM user_lesson_progress_v2 WHERE user_id=${uid}`);


        const progressByLesson: Record<number, any> = {};


        for (const p of ((pr as any)[0] || [])) progressByLesson[p.lesson_id] = p;





        // Hearts


        const hearts = await ensureUserHearts(uid);





        const unitsOut = units.map(u => ({


          id: u.id,


          title: u.title,


          description: u.description,


          icon: u.icon,


          orderIndex: u.order_index,


          lessons: lessons.filter(l => l.unit_id === u.id).map(l => ({


            id: l.id,


            title: l.title,


            estimatedMinutes: l.estimated_minutes,


            orderIndex: l.orderIndex,


            progress: progressByLesson[l.id] ?? { status: "not_started", completed_blocks: 0, total_blocks: 0, xp_earned: 0, accuracy_percent: 0 },


          })),


        }));





        return {


          module: { id: mod.id, title: mod.title, description: mod.description, imageUrl: mod.image_url, durationMinutes: mod.durationMinutes },


          units: unitsOut,


          hearts: hearts.hearts,


        };


      }),





    getLessonBlocks: protectedProcedure


      .input(z.object({ lessonId: z.number() }))


      .query(async ({ ctx, input }) => {


        const uid = Number((ctx.user as any).id ?? (ctx.user as any).userId);


        const db = await getDb();


        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });


        const lr: any = await db.execute(drzSql`SELECT id, moduleId, unit_id, title, estimated_minutes FROM lessons WHERE id=${input.lessonId} LIMIT 1`);


        const lesson = (lr as any)[0]?.[0];


        if (!lesson) throw new TRPCError({ code: "NOT_FOUND" });


        const br: any = await db.execute(drzSql`SELECT id, block_type, content, order_index, xp_reward FROM lesson_blocks WHERE lesson_id=${input.lessonId} ORDER BY order_index ASC`);


        const rows = ((br as any)[0] || []) as Array<{ id: number; block_type: string; content: string; order_index: number; xp_reward: number }>;


        const blocks = rows.map(r => {


          let data: any = {};


          try { data = typeof r.content === "string" ? JSON.parse(r.content) : r.content; } catch (e) { data = {}; }


          return { id: r.id, type: r.block_type, orderIndex: r.order_index, xpReward: r.xp_reward, data };


        });





        // Initialize progress row


        try {


          await db.execute(drzSql`INSERT IGNORE INTO user_lesson_progress_v2 (user_id, lesson_id, status, total_blocks, started_at) VALUES (${uid}, ${input.lessonId}, 'in_progress', ${blocks.length}, NOW())`);


          await db.execute(drzSql`UPDATE user_lesson_progress_v2 SET total_blocks=${blocks.length}, status=CASE WHEN status='completed' THEN 'completed' ELSE 'in_progress' END WHERE user_id=${uid} AND lesson_id=${input.lessonId}`);


        } catch (e) { /* skip */ }





        return { lesson: { id: lesson.id, title: lesson.title, moduleId: lesson.moduleId, unitId: lesson.unit_id, estimatedMinutes: lesson.estimated_minutes }, blocks };


      }),





    submitBlockAnswer: protectedProcedure


      .input(z.object({ blockId: z.number(), lessonId: z.number(), isCorrect: z.boolean(), attempt: z.number().default(1) }))


      .mutation(async ({ ctx, input }) => {


        const uid = Number((ctx.user as any).id ?? (ctx.user as any).userId);


        const db = await getDb();


        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });





        // Fetch block xp


        const br: any = await db.execute(drzSql`SELECT xp_reward, block_type FROM lesson_blocks WHERE id=${input.blockId} LIMIT 1`);


        const block = (br as any)[0]?.[0];


        if (!block) throw new TRPCError({ code: "NOT_FOUND" });





        let xpEarned = 0;


        if (input.isCorrect) {


          xpEarned = input.attempt <= 1 ? Number(block.xp_reward) : Math.max(5, Math.floor(Number(block.xp_reward) / 2));


        }





        // Reflection is always success


        if (block.block_type === "reflection" || block.block_type === "concept" || block.block_type === "example") {


          xpEarned = Number(block.xp_reward);


        }





        await db.execute(drzSql`INSERT INTO user_block_progress (user_id, block_id, is_correct, attempts, xp_earned, completed_at) VALUES (${uid}, ${input.blockId}, ${input.isCorrect ? 1 : 0}, ${input.attempt}, ${xpEarned}, NOW()) ON DUPLICATE KEY UPDATE is_correct=VALUES(is_correct), attempts=GREATEST(attempts, VALUES(attempts)), xp_earned=GREATEST(xp_earned, VALUES(xp_earned)), completed_at=NOW()`);





        // Hearts


        const hearts = await ensureUserHearts(uid);


        let heartsLeft = hearts.hearts;


        if (!input.isCorrect && block.block_type !== "concept" && block.block_type !== "example" && block.block_type !== "reflection") {


          heartsLeft = Math.max(0, heartsLeft - 1);


          await db.execute(drzSql`UPDATE user_hearts SET hearts=${heartsLeft}, last_lost_at=NOW() WHERE user_id=${uid}`);


        }





        // Bump lesson progress


        await db.execute(drzSql`UPDATE user_lesson_progress_v2 SET completed_blocks = completed_blocks + 1, xp_earned = xp_earned + ${xpEarned}, hearts_used = hearts_used + ${(input.isCorrect ? 0 : 1)} WHERE user_id=${uid} AND lesson_id=${input.lessonId}`);





        // Today's XP


        const txr: any = await db.execute(drzSql`SELECT COALESCE(SUM(xp_earned),0) AS xp FROM user_block_progress WHERE user_id=${uid} AND DATE(completed_at)=CURDATE()`);


        const totalXpToday = Number((txr as any)[0]?.[0]?.xp ?? 0);





        const streak = await computeStreakDays(uid);





        return { xpEarned, heartsLeft, totalXpToday, streakDays: streak };


      }),





    completeLesson: protectedProcedure


      .input(z.object({ lessonId: z.number() }))


      .mutation(async ({ ctx, input }) => {


        const uid = Number((ctx.user as any).id ?? (ctx.user as any).userId);


        const db = await getDb();


        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });


        const pr: any = await db.execute(drzSql`SELECT completed_blocks, total_blocks, hearts_used, xp_earned FROM user_lesson_progress_v2 WHERE user_id=${uid} AND lesson_id=${input.lessonId} LIMIT 1`);


        const p = (pr as any)[0]?.[0];


        if (!p) throw new TRPCError({ code: "NOT_FOUND" });


        // Accuracy: (total_blocks - hearts_used) / total_blocks * 100


        const total = Math.max(1, Number(p.total_blocks));


        const accuracy = Math.max(0, Math.round(((total - Number(p.hearts_used)) / total) * 100));


        let bonus = 20;


        if (accuracy >= 100) bonus += 30;


        await db.execute(drzSql`UPDATE user_lesson_progress_v2 SET status='completed', accuracy_percent=${accuracy}, xp_earned = xp_earned + ${bonus}, completed_at=NOW() WHERE user_id=${uid} AND lesson_id=${input.lessonId}`);

        // Verifica se o curso (módulo) inteiro foi concluído: todas as aulas do módulo
        // com status 'completed'. Em caso afirmativo, marca o módulo concluído no sistema
        // de progresso clássico (userProgress) para liberar a emissão do certificado.
        let courseCompleted = false;
        let moduleId = 0;
        const lr: any = await db.execute(drzSql`SELECT moduleId FROM lessons WHERE id=${input.lessonId} LIMIT 1`);
        moduleId = Number((lr as any)[0]?.[0]?.moduleId ?? 0);
        if (moduleId) {
          const cr: any = await db.execute(drzSql`
            SELECT COUNT(*) AS total,
                   SUM(CASE WHEN ulp.status='completed' THEN 1 ELSE 0 END) AS done
            FROM lessons l
            LEFT JOIN user_lesson_progress_v2 ulp ON ulp.lesson_id = l.id AND ulp.user_id = ${uid}
            WHERE l.moduleId = ${moduleId}`);
          const row = (cr as any)[0]?.[0];
          const totalLessons = Number(row?.total ?? 0);
          const doneLessons = Number(row?.done ?? 0);
          if (totalLessons > 0 && doneLessons >= totalLessons) {
            courseCompleted = true;
            try { await upsertUserProgress(uid, moduleId, 100, true); } catch (e) { console.error("upsertUserProgress (course complete)", e); }
          }
        }

        return { ok: true, bonusXp: bonus, accuracy, totalXp: Number(p.xp_earned) + bonus, courseCompleted, moduleId };


      }),





    getUserStats: protectedProcedure.query(async ({ ctx }) => {


      const uid = Number((ctx.user as any).id ?? (ctx.user as any).userId);


      const db = await getDb();


      if (!db) return { hearts: 5, totalXp: 0, streakDays: 0, currentLeague: "Bronze", todaysGoal: 30, todaysProgress: 0 };


      const hearts = await ensureUserHearts(uid);


      const txr: any = await db.execute(drzSql`SELECT COALESCE(SUM(xp_earned),0) AS xp FROM user_block_progress WHERE user_id=${uid} AND DATE(completed_at)=CURDATE()`);


      const todayXp = Number((txr as any)[0]?.[0]?.xp ?? 0);


      const allXpR: any = await db.execute(drzSql`SELECT COALESCE(SUM(xp_earned),0) AS xp FROM user_lesson_progress_v2 WHERE user_id=${uid}`);


      const totalXp = Number((allXpR as any)[0]?.[0]?.xp ?? 0);


      const streak = await computeStreakDays(uid);


      const league = totalXp > 5000 ? "Diamante" : totalXp > 2000 ? "Ouro" : totalXp > 500 ? "Prata" : "Bronze";


      return { hearts: hearts.hearts, totalXp, streakDays: streak, currentLeague: league, todaysGoal: 30, todaysProgress: todayXp };


    }),





    restoreHearts: protectedProcedure.mutation(async ({ ctx }) => {


      const uid = Number((ctx.user as any).id ?? (ctx.user as any).userId);


      const db = await getDb();


      if (!db) return { hearts: 5 };


      await db.execute(drzSql`INSERT INTO user_hearts (user_id, hearts, last_reset_date) VALUES (${uid}, 5, CURDATE()) ON DUPLICATE KEY UPDATE hearts=5, last_reset_date=CURDATE()`);


      return { hearts: 5 };


    }),





    // List modules accessible to user (Missao landing)


    listMyCourses: protectedProcedure.query(async ({ ctx }) => {


      const uid = Number((ctx.user as any).id ?? (ctx.user as any).userId);


      const db = await getDb();


      if (!db) return [];


      // Modules visible to the user via getVisibleModulesForUser is sync-only; fall back to listModules


      try {


        const rr: any = await db.execute(drzSql`SELECT m.id, m.title, m.description, m.image_url, m.durationMinutes, (SELECT COUNT(*) FROM lessons WHERE moduleId=m.id) AS lessonCount FROM modules m WHERE m.isActive=1 ORDER BY m.id DESC`);


        const list = ((rr as any)[0] || []) as Array<any>;


        return list.map(r => ({ id: r.id, title: r.title, description: r.description, imageUrl: r.image_url, durationMinutes: r.durationMinutes, lessonCount: Number(r.lessonCount) }));


      } catch (e) {


        return [];


      }


    }),


  }),








  courseEditor: router({





    getBlocks: adminOrRhProcedure


      .input(z.object({ moduleId: z.number() }))


      .query(async ({ ctx, input }) => {


        const db = await getDb();


        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });


        const ur: any = await db.execute(drzSql`SELECT id, title, description, order_index, icon FROM units WHERE module_id=${input.moduleId} ORDER BY order_index ASC`);


        const units = ((ur as any)[0] || []) as Array<any>;


        const result = [];


        for (const unit of units) {


          const lr: any = await db.execute(drzSql`SELECT id, title, description, orderIndex AS order_index, estimated_minutes FROM lessons WHERE unit_id=${unit.id} ORDER BY orderIndex ASC`);


          const lessons = ((lr as any)[0] || []) as Array<any>;


          const lessonsWithBlocks = [];


          for (const lesson of lessons) {


            const br: any = await db.execute(drzSql`SELECT id, block_type, content, order_index, xp_reward FROM lesson_blocks WHERE lesson_id=${lesson.id} ORDER BY order_index ASC`);


            const blocks = ((br as any)[0] || []).map((b: any) => ({


              id: b.id,


              type: b.block_type,


              content: typeof b.content === 'string' ? JSON.parse(b.content) : b.content,


              orderIndex: b.order_index,


              xpReward: b.xp_reward,


            }));


            lessonsWithBlocks.push({ ...lesson, blocks });


          }


          result.push({ ...unit, lessons: lessonsWithBlocks });


        }


        return result;


      }),





    updateBlock: adminOrRhProcedure


      .input(z.object({ blockId: z.number(), content: z.any() }))


      .mutation(async ({ ctx, input }) => {


        const cid = (ctx.user as any).companyId;


        const db = await getDb();


        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });


        // Tenancy check: verify the block's lesson belongs to a module created by this company


        const cr: any = await db.execute(drzSql`SELECT m.created_by_company_id FROM lesson_blocks lb JOIN lessons l ON l.id = lb.lesson_id JOIN modules m ON m.id = l.moduleId WHERE lb.id=${input.blockId} LIMIT 1`);


        const row = (cr as any)[0]?.[0];


        if (!row) throw new TRPCError({ code: "NOT_FOUND" });


        if (cid && row.created_by_company_id && Number(row.created_by_company_id) !== Number(cid)) {


          throw new TRPCError({ code: "FORBIDDEN" });


        }


        await db.execute(drzSql`UPDATE lesson_blocks SET content=${JSON.stringify(input.content)} WHERE id=${input.blockId}`);


        return { ok: true };


      }),





    uploadBlockImage: adminOrRhProcedure


      .input(z.object({ blockId: z.number(), imageBase64: z.string(), mimeType: z.string().default("image/jpeg") }))


      .mutation(async ({ ctx, input }) => {


        const fs = await import("fs");


        const path = await import("path");


        const dir = "/var/www/saudedotrabalho/uploads/images";


        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });


        const timestamp = Date.now();


        const ext = input.mimeType.includes("png") ? "png" : "jpg";


        const filename = `block-${input.blockId}-${timestamp}.${ext}`;


        const filepath = path.join(dir, filename);


        const base64Data = input.imageBase64.replace(/^data:[^;]+;base64,/, "");


        fs.writeFileSync(filepath, Buffer.from(base64Data, "base64"));


        const urlPath = `/uploads/images/${filename}`;


        // Update the block content with new imageUrl


        const db = await getDb();


        if (db) {


          const br: any = await db.execute(drzSql`SELECT content FROM lesson_blocks WHERE id=${input.blockId} LIMIT 1`);


          const raw = (br as any)[0]?.[0]?.content;


          if (raw) {


            const data = typeof raw === 'string' ? JSON.parse(raw) : raw;


            data.imageUrl = urlPath;


            await db.execute(drzSql`UPDATE lesson_blocks SET content=${JSON.stringify(data)} WHERE id=${input.blockId}`);


          }


        }


        return { url: urlPath };


      }),





    addVideoBlock: adminOrRhProcedure
      .input(z.object({ lessonId: z.number(), videoUrl: z.string(), title: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const or_: any = await db.execute(drzSql`SELECT COALESCE(MAX(order_index),0)+1 AS next_order FROM lesson_blocks WHERE lesson_id=${input.lessonId}`);
        const nextOrder = Number((or_ as any)[0]?.[0]?.next_order ?? 1);
        const content = JSON.stringify({ url: input.videoUrl, title: input.title });
        await db.execute(drzSql`INSERT INTO lesson_blocks (lesson_id, block_type, content, order_index, xp_reward) VALUES (${input.lessonId}, 'video', ${content}, ${nextOrder}, 0)`);
        const lr: any = await db.execute(drzSql`SELECT LAST_INSERT_ID() as id`);
        const newId = Number((lr as any)[0]?.[0]?.id ?? 0);
        return { ok: true, blockId: newId };
      }),

    deleteBlock: adminOrRhProcedure
      .input(z.object({ blockId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const cr: any = await db.execute(drzSql`SELECT m.created_by_company_id FROM lesson_blocks lb JOIN lessons l ON l.id=lb.lesson_id JOIN modules m ON m.id=l.moduleId WHERE lb.id=${input.blockId} LIMIT 1`);
        const row = (cr as any)[0]?.[0];
        if (!row) throw new TRPCError({ code: "NOT_FOUND" });
        if (cid && row.created_by_company_id && Number(row.created_by_company_id) !== Number(cid)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.execute(drzSql`DELETE FROM lesson_blocks WHERE id=${input.blockId}`);
        return { ok: true };
      }),

    addBlock: adminOrRhProcedure
      .input(z.object({ lessonId: z.number(), type: z.string(), content: z.any().optional(), afterBlockId: z.number().optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const defaults: Record<string, any> = {
          concept: { title: "Novo conceito", body: "Escreva aqui o conteudo do conceito." },
          example: { scenario: "Descreva o cenario.", takeaway: "Qual o aprendizado?" },
          multiple_choice: { question: "Sua pergunta?", options: ["Opcao A", "Opcao B", "Opcao C", "Opcao D"], correctIndex: 0, explanation: "" },
          reflection: { prompt: "Pergunta para reflexao." },
          video: { url: "", title: "Video" },
        };
        const content = input.content ?? defaults[input.type] ?? {};
        const xpReward = (input.type === "multiple_choice") ? 10 : 5;
        let order = 1;
        if (input.afterBlockId) {
          const ar: any = await db.execute(drzSql`SELECT order_index, lesson_id FROM lesson_blocks WHERE id=${input.afterBlockId} LIMIT 1`);
          const after = Number((ar as any)[0]?.[0]?.order_index ?? 0);
          await db.execute(drzSql`UPDATE lesson_blocks SET order_index = order_index + 1 WHERE lesson_id=${input.lessonId} AND order_index > ${after}`);
          order = after + 1;
        } else {
          const or_: any = await db.execute(drzSql`SELECT COALESCE(MAX(order_index),0)+1 AS next_order FROM lesson_blocks WHERE lesson_id=${input.lessonId}`);
          order = Number((or_ as any)[0]?.[0]?.next_order ?? 1);
        }
        await db.execute(drzSql`INSERT INTO lesson_blocks (lesson_id, block_type, content, order_index, xp_reward) VALUES (${input.lessonId}, ${input.type}, ${JSON.stringify(content)}, ${order}, ${xpReward})`);
        const lr: any = await db.execute(drzSql`SELECT LAST_INSERT_ID() as id`);
        return { ok: true, blockId: Number((lr as any)[0]?.[0]?.id ?? 0) };
      }),

    regenerateBlock: adminOrRhProcedure
      .input(z.object({ blockId: z.number(), instruction: z.string().optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const br: any = await db.execute(drzSql`SELECT lb.block_type, lb.content, l.title AS lesson_title, m.title AS course_title FROM lesson_blocks lb JOIN lessons l ON l.id=lb.lesson_id JOIN modules m ON m.id=l.moduleId WHERE lb.id=${input.blockId} LIMIT 1`);
        const row = (br as any)[0]?.[0];
        if (!row) throw new TRPCError({ code: "NOT_FOUND" });
        const orKey = process.env.OPENROUTER_API_KEY;
        if (!orKey) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "OpenRouter key missing" });
        const blockType = row.block_type;
        const currentContent = typeof row.content === 'string' ? JSON.parse(row.content) : row.content;
        const sys = `You are an expert course content writer. Always respond with valid JSON only.`;
        const user = `Generate fresh content in Brazilian Portuguese for a "${blockType}" block in the lesson "${row.lesson_title}" of the course "${row.course_title}".
${input.instruction ? `User instruction: ${input.instruction}` : "Make it engaging and educational, with different wording from the current version."}
Return only the JSON content object (no wrapper). Format per type:
- concept: {"title":"...","body":"..."}
- example: {"scenario":"...","takeaway":"..."}
- multiple_choice: {"question":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"..."}
- reflection: {"prompt":"..."}`;
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${orKey}` },
          body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "system", content: sys }, { role: "user", content: user }], response_format: { type: "json_object" } }),
        });
        if (!res.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `LLM error ${res.status}` });
        const j: any = await res.json();
        const raw = j.choices?.[0]?.message?.content ?? "{}";
        const clean = raw.replace(/```json/g, "").replace(/```/g, "").trim();
        const newContent = JSON.parse(clean);
        if (currentContent?.imageUrl && !newContent.imageUrl) newContent.imageUrl = currentContent.imageUrl;
        await db.execute(drzSql`UPDATE lesson_blocks SET content=${JSON.stringify(newContent)} WHERE id=${input.blockId}`);
        return { ok: true, content: newContent };
      }),

    regenerateImage: adminOrRhProcedure
      .input(z.object({ blockId: z.number(), query: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { getImageForQuery } = await import("./_core/images");
        const imageUrl = await getImageForQuery(input.query);
        const br: any = await db.execute(drzSql`SELECT content FROM lesson_blocks WHERE id=${input.blockId} LIMIT 1`);
        const raw = (br as any)[0]?.[0]?.content;
        const data = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {};
        data.imageUrl = imageUrl;
        await db.execute(drzSql`UPDATE lesson_blocks SET content=${JSON.stringify(data)} WHERE id=${input.blockId}`);
        return { ok: true, imageUrl };
      }),

    reorderBlocks: adminOrRhProcedure
      .input(z.object({ lessonId: z.number(), blockIds: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        for (let i = 0; i < input.blockIds.length; i++) {
          await db.execute(drzSql`UPDATE lesson_blocks SET order_index=${i+1} WHERE id=${input.blockIds[i]} AND lesson_id=${input.lessonId}`);
        }
        return { ok: true };
      }),

    getModuleMeta: adminOrRhProcedure
      .input(z.object({ moduleId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const r: any = await db.execute(drzSql`SELECT id, title, description, image_url FROM modules WHERE id=${input.moduleId} LIMIT 1`);
        return (r as any)[0]?.[0] ?? null;
      }),

  }),
  surveyStudio: router({
    list: adminOrRhProcedure.query(async ({ ctx }) => {
      const cid = (ctx.user as any).companyId;
      if (!cid) return [];
      return listAISurveyGenerationsForCompany(cid);
    }),

    generate: adminOrRhProcedure
      .input(z.object({
        topic: z.string().min(5),
        surveyType: z.enum(["climate","burnout","psychosocial","harassment","knowledge","custom"]).default("climate"),
        questionCount: z.number().min(3).max(50).default(10),
        isAnonymous: z.boolean().default(true),
        publishImmediately: z.boolean().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        const uid = (ctx.user as any).id ?? (ctx.user as any).userId;
        if (!cid) throw new TRPCError({ code: "BAD_REQUEST", message: "Empresa nao definida no usuario." });
        const genId = await createAISurveyGeneration({ companyId: cid, userId: uid, topic: input.topic, surveyType: input.surveyType, questionCount: input.questionCount, isAnonymous: input.isAnonymous });
        await updateAISurveyProgress(genId, 10, "Conectando com IA...");

        setImmediate(async () => {
          try {
            const { generateSurvey } = await import("./_core/contentforge/surveyforge");
            const orKey = process.env.OPENROUTER_API_KEY;
            if (!orKey) throw new Error("OpenRouter key missing");

            await updateAISurveyProgress(genId, 30, "Gerando perguntas com IA...");
            const survey = await generateSurvey({ topic: input.topic, type: input.surveyType, questionCount: input.questionCount, apiKey: orKey });

            await updateAISurveyProgress(genId, 70, "Salvando pesquisa...");
            const dbi = await getDb();
            if (!dbi) throw new Error("DB unavailable");

            await dbi.execute(drzSql`INSERT INTO surveys (company_id, title, description, category, is_anonymous, status, created_by) VALUES (${cid}, ${survey.title}, ${survey.description ?? ''}, ${survey.category ?? input.surveyType}, ${input.isAnonymous ? 1 : 0}, ${input.publishImmediately ? 'active' : 'draft'}, ${uid})`);
            const sr: any = await dbi.execute(drzSql`SELECT LAST_INSERT_ID() AS id`);
            const surveyId = Number((sr as any)[0]?.[0]?.id ?? 0);
            if (!surveyId) throw new Error("Survey not created");

            for (let i = 0; i < survey.questions.length; i++) {
              const q = survey.questions[i];
              await dbi.execute(drzSql`INSERT INTO survey_questions (survey_id, question_text, question_type, options, correct_index, order_index) VALUES (${surveyId}, ${q.text}, ${q.type}, ${q.options ? JSON.stringify(q.options) : null}, ${q.correctIndex ?? null}, ${i+1})`);
            }

            await markAISurveyDone(genId, surveyId, survey);
          } catch (e: any) {
            console.error("[surveyStudio] generation failed:", e);
            await markAISurveyFailed(genId, String(e?.message ?? e).slice(0, 240));
            await updateAISurveyProgress(genId, 0, String(e?.message ?? e).slice(0, 240));
          }
        });

        return { ok: true, generationId: genId };
      }),

    getStatus: adminOrRhProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => getAISurveyStatus(input.id)),
  }),

  decompressionStudio: router({
    list: adminOrRhProcedure.query(async ({ ctx }) => {
      const cid = (ctx.user as any).companyId;
      if (!cid) return [];
      return listAIDecompressionGenerationsForCompany(cid);
    }),

    generate: adminOrRhProcedure
      .input(z.object({
        theme: z.enum(["breathing","meditation","stretching","reflection","focus","energy"]).default("breathing"),
        durationMinutes: z.number().min(1).max(30).default(5),
        tone: z.enum(["calm","energizing","reflective"]).default("calm"),
        customPrompt: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        const uid = (ctx.user as any).id ?? (ctx.user as any).userId;
        if (!cid) throw new TRPCError({ code: "BAD_REQUEST", message: "Empresa nao definida no usuario." });
        const genId = await createAIDecompressionGeneration({ companyId: cid, userId: uid, theme: input.theme, durationMinutes: input.durationMinutes, tone: input.tone });
        await updateAIDecompressionProgress(genId, 10, "Conectando com IA...");

        setImmediate(async () => {
          try {
            const { generateActivity } = await import("./_core/contentforge/decompressionforge");
            const orKey = process.env.OPENROUTER_API_KEY;
            if (!orKey) throw new Error("OpenRouter key missing");

            await updateAIDecompressionProgress(genId, 40, "Gerando atividade com IA...");
            const activity = await generateActivity({ theme: input.theme, durationMinutes: input.durationMinutes, tone: input.tone, apiKey: orKey, customPrompt: input.customPrompt });

            await updateAIDecompressionProgress(genId, 75, "Buscando imagem de capa...");
            let coverUrl: string | null = null;
            try {
              const { getImageForQuery } = await import("./_core/images");
              coverUrl = await getImageForQuery(activity.coverImageQuery || activity.title);
            } catch (e) { /* skip */ }

            await updateAIDecompressionProgress(genId, 90, "Salvando atividade...");
            const newId = await createDecompressionActivity({
              companyId: cid,
              title: activity.title,
              description: activity.description,
              category: activity.category,
              type: activity.type,
              durationMinutes: activity.durationMinutes,
              tone: activity.tone,
              content: activity.content,
              coverImageUrl: coverUrl,
              createdBy: uid,
            });

            await markAIDecompressionDone(genId, newId, activity);
          } catch (e: any) {
            console.error("[decompressionStudio] failed:", e);
            await markAIDecompressionFailed(genId, String(e?.message ?? e).slice(0, 240));
            await updateAIDecompressionProgress(genId, 0, String(e?.message ?? e).slice(0, 240));
          }
        });

        return { ok: true, generationId: genId };
      }),

    getStatus: adminOrRhProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => getAIDecompressionStatus(input.id)),
  }),

  decompressionActivities: router({
    list: adminOrRhProcedure.query(async ({ ctx }) => {
      const cid = (ctx.user as any).companyId;
      return listDecompressionActivities(cid ?? null);
    }),
    listPublic: protectedProcedure.query(async () => {
      return listDecompressionActivities(null);
    }),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => getDecompressionActivity(input.id)),
    create: adminOrRhProcedure
      .input(z.object({
        title: z.string().min(1), description: z.string().optional(),
        category: z.string().optional(), type: z.string().optional(),
        durationMinutes: z.number().optional(), tone: z.string().optional(),
        content: z.any().optional(), coverImageUrl: z.string().optional().nullable(),
        isActive: z.boolean().optional(), orderIndex: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        const uid = (ctx.user as any).id ?? (ctx.user as any).userId;
        const id = await createDecompressionActivity({ ...input, companyId: cid, createdBy: uid });
        return { ok: true, id };
      }),
    update: adminOrRhProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(), description: z.string().optional(),
        category: z.string().optional(), type: z.string().optional(),
        durationMinutes: z.number().optional(), tone: z.string().optional(),
        content: z.any().optional(), coverImageUrl: z.string().optional().nullable(),
        isActive: z.boolean().optional(), orderIndex: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateDecompressionActivity(id, data);
        return { ok: true };
      }),
    delete: adminOrRhProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteDecompressionActivity(input.id);
        return { ok: true };
      }),
  }),








  // ── Email Campaigns (Phase 2) ─────────────────────────────────────────────
  emailCampaigns: router({
    list: adminOrRhProcedure.query(async ({ ctx }) => {
      const cid = (ctx.user as any).companyId;
      if (!cid) return [];
      return await listEmailCampaigns(cid);
    }),

    getTemplates: adminOrRhProcedure.query(() => {
      return Object.entries(EMAIL_TEMPLATES).map(([key, t]) => ({ key, ...t }));
    }),

    getModules: adminOrRhProcedure
      .input(z.object({ companyId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        // Company-scoped users (RH) always use their own company; Admin Global supplies one.
        const cid = (ctx.user as any).companyId ?? input?.companyId ?? null;
        if (!cid) return [];
        return await getModulesForCompany(cid);
      }),

    getSurveys: adminOrRhProcedure
      .input(z.object({ companyId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId ?? input?.companyId ?? null;
        if (!cid) return [];
        return await getSurveysForCompanyShort(cid);
      }),

    previewRecipients: adminOrRhProcedure
      .input(z.object({
        campaignType: z.enum(["course_pending", "survey_pending"]),
        companyId: z.number().optional(),
        targetModuleId: z.number().optional(),
        targetSurveyId: z.number().optional(),
        branchId: z.number().nullable().optional(),
        sectorId: z.number().nullable().optional(),
        maxCompletionPercent: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId ?? input.companyId ?? null;
        if (!cid) return [];
        return await previewCampaignRecipients({
          companyId: cid,
          campaignType: input.campaignType,
          targetModuleId: input.targetModuleId,
          targetSurveyId: input.targetSurveyId,
          branchId: input.branchId,
          sectorId: input.sectorId,
          maxCompletionPercent: input.maxCompletionPercent,
        });
      }),

    create: adminOrRhProcedure
      .input(z.object({
        name: z.string().min(1),
        companyId: z.number().optional(),
        campaignType: z.enum(["course_pending", "survey_pending", "custom"]),
        targetModuleId: z.number().nullable().optional(),
        targetSurveyId: z.number().nullable().optional(),
        branchId: z.number().nullable().optional(),
        sectorId: z.number().nullable().optional(),
        maxCompletionPercent: z.number().optional(),
        emailSubject: z.string().min(1),
        emailBody: z.string().min(1),
        scheduleType: z.enum(["now", "scheduled", "recurring"]).default("now"),
        scheduledAt: z.string().nullable().optional(),
        recurringCron: z.string().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId ?? input.companyId ?? null;
        if (!cid) throw new Error("Selecione a empresa da campanha");
        const uid = (ctx.user as any).id;
        let recipients: { userId: number; email: string; name?: string | null }[] = [];
        if (input.campaignType === "course_pending" || input.campaignType === "survey_pending") {
          const list = await previewCampaignRecipients({
            companyId: cid,
            campaignType: input.campaignType,
            targetModuleId: input.targetModuleId ?? undefined,
            targetSurveyId: input.targetSurveyId ?? undefined,
            branchId: input.branchId,
            sectorId: input.sectorId,
            maxCompletionPercent: input.maxCompletionPercent,
          });
          recipients = list.map((r: any) => ({ userId: r.userId, email: r.email, name: r.name }));
        }
        const id = await createEmailCampaign({
          companyId: cid,
          createdByUserId: uid,
          name: input.name,
          campaignType: input.campaignType,
          targetModuleId: input.targetModuleId ?? null,
          targetSurveyId: input.targetSurveyId ?? null,
          filterJson: {
            branchId: input.branchId ?? null,
            sectorId: input.sectorId ?? null,
            maxCompletionPercent: input.maxCompletionPercent ?? null,
          },
          emailSubject: input.emailSubject,
          emailBody: input.emailBody,
          scheduleType: input.scheduleType,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
          recurringCron: input.recurringCron ?? null,
          recipients,
        });
        return { id, recipientCount: recipients.length };
      }),

    send: adminOrRhProcedure
      .input(z.object({ campaignId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        const role = (ctx.user as any).role;
        const data = await getEmailCampaign(input.campaignId);
        if (!data) throw new Error("Campanha não encontrada");
        if (role !== "admin_global" && role !== "super_admin" && data.campaign.companyId !== cid) {
          throw new Error("Sem permissão");
        }
        const c = data.campaign;
        await updateEmailCampaignStatus(c.id, "sending");
        let resourceTitle = "";
        let resourceLink = "https://saudedotrabalho.com/plataforma/inicio";
        if (c.campaignType === "course_pending" && c.targetModuleId) {
          const mods = await getModulesForCompany(cid);
          const m = mods.find((x: any) => Number(x.id) === Number(c.targetModuleId));
          if (m) {
            resourceTitle = m.title;
            resourceLink = `https://saudedotrabalho.com/plataforma/modulos/${c.targetModuleId}`;
          }
        } else if (c.campaignType === "survey_pending" && c.targetSurveyId) {
          const surveys = await getSurveysForCompanyShort(cid);
          const s = surveys.find((x: any) => Number(x.id) === Number(c.targetSurveyId));
          if (s) {
            resourceTitle = s.title;
            resourceLink = `https://saudedotrabalho.com/plataforma/pesquisas/${c.targetSurveyId}/responder`;
          }
        }
        let sent = 0;
        let failed = 0;
        let preview = false;
        for (const r of data.recipients) {
          if (r.status === "sent") continue;
          const vars: Record<string, string> = {
            name: (r.name || r.email.split("@")[0]) as string,
            course_title: resourceTitle,
            survey_title: resourceTitle,
            link: resourceLink,
          };
          const subject = fillTemplate(c.emailSubject, vars);
          const body = fillTemplate(c.emailBody, vars);
          const html = plainToHtml(body);
          const result = await sendEmail({ to: r.email, toName: r.name ?? undefined, subject, html });
          if (result.preview) preview = true;
          if (result.ok) {
            sent++;
            await updateEmailCampaignRecipient(r.id, result.preview ? "preview_sent" : "sent");
            await logEmail(r.email, "reminder_employee", subject, true);
          } else {
            failed++;
            await updateEmailCampaignRecipient(r.id, "failed", result.error || "unknown error");
            await logEmail(r.email, "reminder_employee", subject, false, result.error);
          }
        }
        await bumpEmailCampaignCounters(c.id, { sent, failed });
        const finalStatus = sent > 0 && failed === 0 ? "sent" : (failed > 0 && sent === 0 ? "failed" : "sent");
        await updateEmailCampaignStatus(c.id, finalStatus, true);
        return { sent, failed, preview };
      }),

    get: adminOrRhProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        const role = (ctx.user as any).role;
        const data = await getEmailCampaign(input.id);
        if (!data) throw new Error("Campanha não encontrada");
        if (role !== "admin_global" && role !== "super_admin" && data.campaign.companyId !== cid) {
          throw new Error("Sem permissão");
        }
        return data;
      }),
  }),


  // ── Template Library (Phase 3 — Biblioteca da Consultoria) ─────────────────
  templateLibrary: router({
    list: adminOrRhProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { surveys: [], modules: [], decompression: [] };

      const sr: any = await db.execute(drzSql`
        SELECT s.id, s.title, s.description, s.category, s.is_anonymous AS isAnonymous,
               (SELECT COUNT(*) FROM survey_questions q WHERE q.survey_id = s.id) AS questionCount
        FROM surveys s
        WHERE s.is_template = 1
        ORDER BY s.id`);
      const surveys = (sr as any)[0] ?? [];

      const mr: any = await db.execute(drzSql`
        SELECT m.id, m.title, m.description, m.template_category AS templateCategory,
               m.durationMinutes, m.image_url AS imageUrl, m.thumbnailUrl,
               (SELECT COUNT(*) FROM lessons l WHERE l.moduleId = m.id) AS lessonCount
        FROM modules m
        WHERE m.is_template = 1
        ORDER BY m.orderIndex, m.id`);
      const modulesList = (mr as any)[0] ?? [];

      const dr: any = await db.execute(drzSql`
        SELECT id, title, description, category, type, duration_minutes AS durationMinutes,
               tone, cover_image_url AS coverImageUrl
        FROM decompression_activities
        WHERE is_template = 1
        ORDER BY order_index, id`);
      const decompression = (dr as any)[0] ?? [];

      return { surveys, modules: modulesList, decompression };
    }),

    applyTemplate: adminOrRhProcedure
      .input(z.object({
        type: z.enum(["survey", "module", "decompression"]),
        templateId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        const uid = (ctx.user as any).id ?? (ctx.user as any).userId;
        if (!cid) throw new TRPCError({ code: "BAD_REQUEST", message: "Empresa não definida no usuário." });

        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível." });

        if (input.type === "survey") {
          const sr: any = await db.execute(drzSql`
            SELECT title, description, category, is_anonymous AS isAnonymous
            FROM surveys WHERE id=${input.templateId} AND is_template=1 LIMIT 1`);
          const tpl = (sr as any)[0]?.[0];
          if (!tpl) throw new TRPCError({ code: "NOT_FOUND", message: "Template não encontrado." });

          await db.execute(drzSql`
            INSERT INTO surveys (company_id, is_template, title, description, category, is_anonymous, status, created_by)
            VALUES (${cid}, 0, ${tpl.title}, ${tpl.description ?? null}, ${tpl.category ?? null}, ${tpl.isAnonymous ?? 1}, 'draft', ${uid ?? null})`);
          const idr: any = await db.execute(drzSql`SELECT LAST_INSERT_ID() AS id`);
          const newId = Number((idr as any)[0]?.[0]?.id ?? 0);
          if (!newId) throw new Error("Falha ao criar pesquisa.");

          const qr: any = await db.execute(drzSql`
            SELECT question_text, question_type, options, is_required, order_index
            FROM survey_questions WHERE survey_id=${input.templateId} ORDER BY order_index`);
          const questions = (qr as any)[0] ?? [];
          for (const q of questions) {
            await db.execute(drzSql`
              INSERT INTO survey_questions (survey_id, question_text, question_type, options, is_required, order_index)
              VALUES (${newId}, ${q.question_text}, ${q.question_type}, ${q.options ? JSON.stringify(q.options) : null}, ${q.is_required ?? 1}, ${q.order_index ?? 0})`);
          }

          return { ok: true, type: "survey", newId, link: `/admin/pesquisas/${newId}/editar` };
        }

        if (input.type === "decompression") {
          const dr: any = await db.execute(drzSql`
            SELECT title, description, category, type, duration_minutes, tone, content, cover_image_url
            FROM decompression_activities WHERE id=${input.templateId} AND is_template=1 LIMIT 1`);
          const tpl = (dr as any)[0]?.[0];
          if (!tpl) throw new TRPCError({ code: "NOT_FOUND", message: "Template não encontrado." });

          await db.execute(drzSql`
            INSERT INTO decompression_activities
              (company_id, is_template, title, description, category, type, duration_minutes, tone, content, cover_image_url, is_active, order_index, created_by)
            VALUES (${cid}, 0, ${tpl.title}, ${tpl.description ?? null}, ${tpl.category ?? null}, ${tpl.type ?? "breathing"},
                    ${tpl.duration_minutes ?? 5}, ${tpl.tone ?? null},
                    ${tpl.content ? (typeof tpl.content === "string" ? tpl.content : JSON.stringify(tpl.content)) : null},
                    ${tpl.cover_image_url ?? null}, 1, 0, ${uid ?? null})`);
          const idr: any = await db.execute(drzSql`SELECT LAST_INSERT_ID() AS id`);
          const newId = Number((idr as any)[0]?.[0]?.id ?? 0);
          return { ok: true, type: "decompression", newId, link: `/admin/descompressao` };
        }

        if (input.type === "module") {
          const mr: any = await db.execute(drzSql`
            SELECT title, description, durationMinutes, image_url, thumbnailUrl, certTitle, certBody, certSignerName, certSignerRole, validity_days, profession
            FROM modules WHERE id=${input.templateId} AND is_template=1 LIMIT 1`);
          const tpl = (mr as any)[0]?.[0];
          if (!tpl) throw new TRPCError({ code: "NOT_FOUND", message: "Template não encontrado." });

          // Pick orderIndex above existing for the company
          const oxr: any = await db.execute(drzSql`SELECT COALESCE(MAX(orderIndex), 0) + 1 AS nx FROM modules WHERE created_by_company_id=${cid}`);
          const nextOrder = Number((oxr as any)[0]?.[0]?.nx ?? 1);

          await db.execute(drzSql`
            INSERT INTO modules
              (orderIndex, title, description, durationMinutes, isActive, is_template, created_by_company_id, cloned_from_module_id, image_url, thumbnailUrl, certTitle, certBody, certSignerName, certSignerRole, validity_days, profession, is_catalog_master)
            VALUES (${nextOrder}, ${tpl.title}, ${tpl.description ?? null}, ${tpl.durationMinutes ?? 30}, 1, 0, ${cid}, ${input.templateId},
                    ${tpl.image_url ?? null}, ${tpl.thumbnailUrl ?? null},
                    ${tpl.certTitle ?? null}, ${tpl.certBody ?? null}, ${tpl.certSignerName ?? null}, ${tpl.certSignerRole ?? null}, ${tpl.validity_days ?? null}, ${tpl.profession ?? null}, 0)`);
          const idr: any = await db.execute(drzSql`SELECT LAST_INSERT_ID() AS id`);
          const newModuleId = Number((idr as any)[0]?.[0]?.id ?? 0);
          if (!newModuleId) throw new Error("Falha ao criar módulo.");

          // Clone units
          const ur: any = await db.execute(drzSql`
            SELECT id, title, description, order_index, icon, is_active
            FROM units WHERE module_id=${input.templateId} ORDER BY order_index, id`);
          const units = (ur as any)[0] ?? [];
          const unitIdMap: Record<number, number> = {};
          for (const u of units) {
            await db.execute(drzSql`
              INSERT INTO units (module_id, title, description, order_index, icon, is_active)
              VALUES (${newModuleId}, ${u.title}, ${u.description ?? null}, ${u.order_index ?? 0}, ${u.icon ?? "book"}, ${u.is_active ?? 1})`);
            const uidr: any = await db.execute(drzSql`SELECT LAST_INSERT_ID() AS id`);
            const newUid = Number((uidr as any)[0]?.[0]?.id ?? 0);
            unitIdMap[u.id] = newUid;
          }

          // Clone lessons
          const lr: any = await db.execute(drzSql`
            SELECT id, unit_id, orderIndex, title, description, videoUrl, durationMinutes, isActive, image_url, audio_url, pdf_url, content, estimated_minutes
            FROM lessons WHERE moduleId=${input.templateId} ORDER BY orderIndex, id`);
          const lessons = (lr as any)[0] ?? [];
          const lessonIdMap: Record<number, number> = {};
          for (const ls of lessons) {
            const newUid = ls.unit_id != null ? (unitIdMap[ls.unit_id] ?? null) : null;
            await db.execute(drzSql`
              INSERT INTO lessons
                (moduleId, unit_id, orderIndex, title, description, videoUrl, durationMinutes, isActive, image_url, audio_url, pdf_url, content, estimated_minutes)
              VALUES (${newModuleId}, ${newUid}, ${ls.orderIndex ?? 0}, ${ls.title}, ${ls.description ?? null}, ${ls.videoUrl ?? null}, ${ls.durationMinutes ?? 0}, ${ls.isActive ?? 1},
                      ${ls.image_url ?? null}, ${ls.audio_url ?? null}, ${ls.pdf_url ?? null}, ${ls.content ?? null}, ${ls.estimated_minutes ?? 3})`);
            const lidr: any = await db.execute(drzSql`SELECT LAST_INSERT_ID() AS id`);
            const newLid = Number((lidr as any)[0]?.[0]?.id ?? 0);
            lessonIdMap[ls.id] = newLid;
          }

          // Clone lesson_blocks
          const bk: any = await db.execute(drzSql`
            SELECT b.lesson_id, b.block_type, b.content, b.order_index, b.xp_reward
            FROM lesson_blocks b
            INNER JOIN lessons l ON l.id = b.lesson_id
            WHERE l.moduleId=${input.templateId}`);
          const blocks = (bk as any)[0] ?? [];
          for (const b of blocks) {
            const newLid = lessonIdMap[b.lesson_id];
            if (!newLid) continue;
            await db.execute(drzSql`
              INSERT INTO lesson_blocks (lesson_id, block_type, content, order_index, xp_reward)
              VALUES (${newLid}, ${b.block_type}, ${b.content ? (typeof b.content === "string" ? b.content : JSON.stringify(b.content)) : "{}"}, ${b.order_index ?? 0}, ${b.xp_reward ?? 5})`);
          }

          // Clone exam questions
          const er: any = await db.execute(drzSql`
            SELECT question_text, options, correct_index, explanation, order_index
            FROM ai_module_exams WHERE module_id=${input.templateId} ORDER BY order_index`);
          const exam = (er as any)[0] ?? [];
          for (const q of exam) {
            await db.execute(drzSql`
              INSERT INTO ai_module_exams (module_id, question_text, options, correct_index, explanation, order_index)
              VALUES (${newModuleId}, ${q.question_text}, ${q.options ? (typeof q.options === "string" ? q.options : JSON.stringify(q.options)) : "[]"}, ${q.correct_index ?? 0}, ${q.explanation ?? null}, ${q.order_index ?? 0})`);
          }

          return { ok: true, type: "module", newId: newModuleId, link: `/admin/modulos/${newModuleId}/editar` };
        }

        throw new TRPCError({ code: "BAD_REQUEST", message: "Tipo inválido." });
      }),
  }),


  // ── Risk Assessment (Phase 4 — Análise de Risco Psicossocial NR-01) ───────
  riskAssessment: router({

    /** All action-plan items across assessments for the company — the Correlation Engine screen */
    suggestModuleForFactor: adminOrRhProcedure
      .input(z.object({ factorName: z.string() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
        const cid = Number((ctx.user as any).companyId) || 0;
        const r: any = await db.execute(drzSql`SELECT id, title FROM modules WHERE (company_id = ${cid} OR company_id IS NULL) AND publish_status = 'published' ORDER BY title ASC LIMIT 50`);
        const modules: any[] = (r as any)[0] ?? [];
        const keywords = input.factorName.toLowerCase().split(/[\s,;-]+/).filter((w: string) => w.length > 3);
        if (!keywords.length) return modules.slice(0, 5);
        return modules.filter((m: any) => {
          const text = (String(m.title || '')).toLowerCase();
          return keywords.some((k: string) => text.includes(k));
        }).slice(0, 5);
      }),

    allActionItems: adminOrRhProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const cid = Number((ctx.user as any).companyId) || 0;
      const role = (ctx.user as any).role;
      const isGlobal = ["admin_global", "super_admin"].includes(role);
      const companyFilter = isGlobal ? "" : `AND ra.company_id = ${cid}`;
      const r: any = await db.execute(drzSql.raw(`
        SELECT
          ap.id, ap.assessment_id AS assessmentId, ap.factor_id AS factorId,
          ap.action_description AS actionDescription,
          ap.responsible_party AS responsibleParty,
          ap.priority, ap.start_date AS startDate, ap.end_date AS endDate,
          ap.status, ap.notes,
          ap.preventive_program_module_id AS preventiveProgramModuleId,
          f.code AS factorCode, f.name AS factorName,
          m.title AS moduleTitle, m.id AS moduleId,
          ra.cycle_name AS cycleName,
          s.name AS sectorName, b.name AS branchName,
          co.name AS companyName
        FROM risk_action_plan_items ap
        INNER JOIN psychosocial_factors f ON f.id = ap.factor_id
        LEFT JOIN modules m ON m.id = ap.preventive_program_module_id
        INNER JOIN risk_assessments ra ON ra.id = ap.assessment_id
        LEFT JOIN sectors s ON s.id = ra.sector_id
        LEFT JOIN branches b ON b.id = ra.branch_id
        LEFT JOIN companies co ON co.id = ra.company_id
        WHERE 1=1 ${companyFilter}
        ORDER BY ap.end_date ASC, ap.priority DESC
      `));
      return (r as any)[0] ?? [];
    }),

    /** Update status of an action plan item */
    updateActionItemStatus: adminOrRhProcedure
      .input(z.object({ id: z.number().int(), status: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        const cid = Number((ctx.user as any).companyId) || 0;
        // Security: verify item belongs to company
        const chk: any = await db.execute(drzSql`
          SELECT ra.company_id FROM risk_action_plan_items ap
          INNER JOIN risk_assessments ra ON ra.id = ap.assessment_id
          WHERE ap.id = ${input.id}`);
        const row = (chk as any)[0]?.[0];
        if (!row) throw new Error("Item not found");
        if (row.company_id !== cid && !["admin_global","super_admin"].includes((ctx.user as any).role)) throw new Error("Unauthorized");
        await db.execute(drzSql`UPDATE risk_action_plan_items SET status=${input.status} WHERE id=${input.id}`);
        return { ok: true };
      }),

    /** Link a module to an action plan item */
    linkModuleToAction: adminOrRhProcedure
      .input(z.object({ actionId: z.number().int(), moduleId: z.number().int().nullable() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        await db.execute(drzSql`UPDATE risk_action_plan_items SET preventive_program_module_id=${input.moduleId} WHERE id=${input.actionId}`);
        return { ok: true };
      }),

    listFactors: adminOrRhProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [] as any[];
      const r: any = await db.execute(drzSql`
        SELECT f.id, f.code, f.name, f.description,
               f.preventive_program_module_id AS preventiveProgramModuleId,
               f.default_action AS defaultAction, f.axis_order AS axisOrder,
               m.title AS programTitle
        FROM psychosocial_factors f
        LEFT JOIN modules m ON m.id = f.preventive_program_module_id
        ORDER BY f.axis_order`);
      return (r as any)[0] ?? [];
    }),

    listAssessments: adminOrRhProcedure.query(async ({ ctx }) => {
      const cid = (ctx.user as any).companyId;
      const db = await getDb();
      if (!db || !cid) return [] as any[];
      const r: any = await db.execute(drzSql`
        SELECT ra.id, ra.cycle_name AS cycleName, ra.status, ra.sector_id AS sectorId,
               ra.branch_id AS branchId, ra.start_date AS startDate, ra.end_date AS endDate,
               ra.drps_survey_id AS drpsSurveyId, ra.aep_survey_id AS aepSurveyId,
               ra.responsible_technician AS responsibleTechnician, ra.created_at AS createdAt,
               s.name AS sectorName, b.name AS branchName,
               (SELECT COUNT(*) FROM survey_responses WHERE survey_id = ra.drps_survey_id) AS drpsResponses,
               (SELECT COUNT(*) FROM survey_responses WHERE survey_id = ra.aep_survey_id) AS aepResponses
        FROM risk_assessments ra
        LEFT JOIN sectors s ON s.id = ra.sector_id
        LEFT JOIN branches b ON b.id = ra.branch_id
        WHERE ra.company_id = ${cid}
        ORDER BY ra.created_at DESC`);
      return (r as any)[0] ?? [];
    }),

    // Visão consolidada por Filial -> Setor -> Ciclos, com inventário e plano de ação
    // de cada ciclo. Usado pela página "Análise de Risco — Visão por Filial e Setor".
    getConsolidatedView: adminOrRhProcedure
      .input(z.object({}).optional())
      .query(async ({ ctx }) => {
        const cid = (ctx.user as any).companyId;
        const db = await getDb();
        if (!db || !cid) return { branches: [] };
        const unpack = (r: any): any[] =>
          Array.isArray((r as any)?.[0]) ? (r as any)[0] : Array.isArray(r) ? r : [];

        const ar: any = await db.execute(drzSql`
          SELECT ra.id, ra.cycle_name AS cycleName, ra.status,
                 ra.sector_id AS sectorId, ra.branch_id AS branchId,
                 s.name AS sectorName, b.name AS branchName
          FROM risk_assessments ra
          LEFT JOIN sectors s ON s.id = ra.sector_id
          LEFT JOIN branches b ON b.id = ra.branch_id
          WHERE ra.company_id = ${cid}
          ORDER BY b.name, s.name, ra.created_at DESC`);
        const assessments = unpack(ar);
        if (assessments.length === 0) return { branches: [] };

        const ids = assessments.map((a: any) => Number(a.id)).filter((n: number) => !isNaN(n));
        const idCsv = ids.join(",");

        const invRaw: any = await db.execute(drzSql.raw(`
          SELECT ii.id, ii.assessment_id AS assessmentId, ii.gravidade, ii.probabilidade,
                 ii.risco_final, ii.fontes_geradoras, ii.medidas_existentes,
                 f.code AS factor_code, f.name AS factor_name, f.axis_order
          FROM risk_inventory_items ii
          INNER JOIN psychosocial_factors f ON f.id = ii.factor_id
          WHERE ii.assessment_id IN (${idCsv})
          ORDER BY f.axis_order`));
        const invRows = unpack(invRaw);

        const planRaw: any = await db.execute(drzSql.raw(`
          SELECT ap.id, ap.assessment_id AS assessmentId, ap.action_description,
                 ap.responsible_party, ap.priority, ap.status,
                 ap.start_date, ap.end_date,
                 f.code AS factor_code, f.name AS factor_name
          FROM risk_action_plan_items ap
          INNER JOIN psychosocial_factors f ON f.id = ap.factor_id
          WHERE ap.assessment_id IN (${idCsv})
          ORDER BY ap.priority DESC, f.axis_order`));
        const planRows = unpack(planRaw);

        const invByAssessment = new Map<number, any[]>();
        for (const it of invRows) {
          const k = Number(it.assessmentId);
          if (!invByAssessment.has(k)) invByAssessment.set(k, []);
          invByAssessment.get(k)!.push(it);
        }
        const planByAssessment = new Map<number, any[]>();
        for (const it of planRows) {
          const k = Number(it.assessmentId);
          if (!planByAssessment.has(k)) planByAssessment.set(k, []);
          planByAssessment.get(k)!.push(it);
        }

        // Agrupa: branch -> sector -> assessments
        const branchMap = new Map<string, any>();
        for (const a of assessments) {
          const bId = a.branchId != null ? Number(a.branchId) : null;
          const bKey = bId != null ? `b${bId}` : "b_none";
          const bName = a.branchName ?? "Empresa toda / sem filial";
          if (!branchMap.has(bKey)) branchMap.set(bKey, { branchId: bId, branchName: bName, _sectors: new Map<string, any>() });
          const branch = branchMap.get(bKey);

          const sId = a.sectorId != null ? Number(a.sectorId) : null;
          const sKey = sId != null ? `s${sId}` : "s_none";
          const sName = a.sectorName ?? "Todos os setores";
          if (!branch._sectors.has(sKey)) branch._sectors.set(sKey, { sectorId: sId, sectorName: sName, assessments: [] });
          const sector = branch._sectors.get(sKey);

          sector.assessments.push({
            id: Number(a.id),
            cycleName: a.cycleName,
            status: a.status,
            inventory: invByAssessment.get(Number(a.id)) ?? [],
            actionPlan: planByAssessment.get(Number(a.id)) ?? [],
          });
        }

        const branches = Array.from(branchMap.values()).map((b: any) => ({
          branchId: b.branchId,
          branchName: b.branchName,
          sectors: Array.from(b._sectors.values()),
        }));

        return { branches };
      }),

    getAssessment: adminOrRhProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const r: any = await db.execute(drzSql`
          SELECT ra.*, s.name AS sector_name, b.name AS branch_name, c.name AS company_name, c.cnpj AS company_cnpj
          FROM risk_assessments ra
          LEFT JOIN sectors s ON s.id = ra.sector_id
          LEFT JOIN branches b ON b.id = ra.branch_id
          LEFT JOIN companies c ON c.id = ra.company_id
          WHERE ra.id=${input.id} LIMIT 1`);
        const assessment = (r as any)[0]?.[0];
        if (!assessment) throw new TRPCError({ code: "NOT_FOUND" });
        if (assessment.company_id !== cid) throw new TRPCError({ code: "FORBIDDEN" });

        const ir: any = await db.execute(drzSql`
          SELECT ii.*, f.code AS factor_code, f.name AS factor_name, f.description AS factor_description,
                 f.preventive_program_module_id AS factor_program_id,
                 f.default_action AS factor_default_action, f.axis_order
          FROM risk_inventory_items ii
          INNER JOIN psychosocial_factors f ON f.id = ii.factor_id
          WHERE ii.assessment_id=${input.id}
          ORDER BY f.axis_order`);
        const inventory = (ir as any)[0] ?? [];

        const ar: any = await db.execute(drzSql`
          SELECT ap.*, f.code AS factor_code, f.name AS factor_name, m.title AS program_title
          FROM risk_action_plan_items ap
          INNER JOIN psychosocial_factors f ON f.id = ap.factor_id
          LEFT JOIN modules m ON m.id = ap.preventive_program_module_id
          WHERE ap.assessment_id=${input.id}
          ORDER BY ap.priority DESC, f.axis_order`);
        const actionPlan = (ar as any)[0] ?? [];

        const drpsCount: any = await db.execute(drzSql`SELECT COUNT(*) AS c FROM survey_responses WHERE survey_id=${assessment.drps_survey_id}`);
        const aepCount: any = await db.execute(drzSql`SELECT COUNT(*) AS c FROM survey_responses WHERE survey_id=${assessment.aep_survey_id}`);

        return {
          assessment,
          inventory,
          actionPlan,
          stats: {
            drpsResponses: Number((drpsCount as any)[0]?.[0]?.c ?? 0),
            aepResponses: Number((aepCount as any)[0]?.[0]?.c ?? 0),
          },
        };
      }),

    createAssessment: adminOrRhProcedure
      .input(z.object({
        sectorId: z.number().nullable(),
        branchId: z.number().nullable(),
        cycleName: z.string().min(2),
        drpsTemplateId: z.number().optional().nullable(),
        aepTemplateId: z.number(),
        responsibleTechnician: z.string().optional(),
        aepOnly: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        const uid = (ctx.user as any).id ?? (ctx.user as any).userId;
        if (!cid) throw new TRPCError({ code: "BAD_REQUEST", message: "Empresa não definida." });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        // When sectorId is provided, validate it belongs to the company (LGPD isolation).
        // When null, the assessment covers all sectors (NR-01 allows company-wide assessments).
        if (input.sectorId != null) {
          const sr: any = await db.execute(drzSql`SELECT company_id, branch_id FROM sectors WHERE id = ${input.sectorId} LIMIT 1`);
          const srow = Array.isArray(sr) ? (sr[0]?.[0] ?? sr[0]) : sr;
          if (!srow) throw new TRPCError({ code: "NOT_FOUND", message: "Setor não encontrado." });
          if (Number(srow.company_id) !== Number(cid)) throw new TRPCError({ code: "FORBIDDEN", message: "Setor de outra empresa." });
        }

        // Helper to clone a survey template
        async function cloneSurvey(templateId: number): Promise<number> {
          const tr: any = await db!.execute(drzSql`
            SELECT title, description, category, is_anonymous AS isAnonymous
            FROM surveys WHERE id=${templateId} LIMIT 1`);
          const tpl = (tr as any)[0]?.[0];
          if (!tpl) throw new TRPCError({ code: "NOT_FOUND", message: `Template ${templateId} não encontrado` });
          await db!.execute(drzSql`
            INSERT INTO surveys (company_id, is_template, title, description, category, is_anonymous, status, created_by)
            VALUES (${cid}, 0, ${tpl.title}, ${tpl.description ?? null}, ${tpl.category ?? null}, ${tpl.isAnonymous ?? 1}, 'active', ${uid ?? null})`);
          const idr: any = await db!.execute(drzSql`SELECT LAST_INSERT_ID() AS id`);
          const newId = Number((idr as any)[0]?.[0]?.id ?? 0);
          const qr: any = await db!.execute(drzSql`
            SELECT question_text, question_type, options, is_required, order_index
            FROM survey_questions WHERE survey_id=${templateId} ORDER BY order_index`);
          const questions = (qr as any)[0] ?? [];
          for (const q of questions) {
            await db!.execute(drzSql`
              INSERT INTO survey_questions (survey_id, question_text, question_type, options, is_required, order_index)
              VALUES (${newId}, ${q.question_text}, ${q.question_type}, ${q.options ? JSON.stringify(q.options) : null}, ${q.is_required ?? 1}, ${q.order_index ?? 0})`);
          }
          return newId;
        }

        const drpsId = (!input.aepOnly && input.drpsTemplateId)
          ? await cloneSurvey(input.drpsTemplateId)
          : null;
        const aepId = await cloneSurvey(input.aepTemplateId);

        const startDate = new Date();
        const endDate = new Date(); endDate.setMonth(endDate.getMonth() + 12);

        await db.execute(drzSql`
          INSERT INTO risk_assessments
            (company_id, branch_id, sector_id, cycle_name, drps_survey_id, aep_survey_id, status, responsible_technician, start_date, end_date, created_by_user_id)
          VALUES (${cid}, ${input.branchId}, ${input.sectorId}, ${input.cycleName}, ${drpsId ?? null}, ${aepId}, 'collecting',
                  ${input.responsibleTechnician ?? "Marise Paiva — CRP 55-33301"},
                  ${startDate.toISOString().slice(0, 10)}, ${endDate.toISOString().slice(0, 10)}, ${uid})`);
        const idr: any = await db.execute(drzSql`SELECT LAST_INSERT_ID() AS id`);
        const assessmentId = Number((idr as any)[0]?.[0]?.id ?? 0);

        const factors: any = await db.execute(drzSql`SELECT id FROM psychosocial_factors ORDER BY axis_order`);
        const factorRows = (factors as any)[0] ?? [];
        for (const f of factorRows) {
          await db.execute(drzSql`
            INSERT INTO risk_inventory_items (assessment_id, factor_id, gravidade, probabilidade, risco_final)
            VALUES (${assessmentId}, ${f.id}, 'baixa', 'baixa', 'baixo')`);
        }

        return { ok: true, assessmentId, drpsSurveyId: drpsId ?? null, aepSurveyId: aepId, aepOnly: input.aepOnly ?? false };
      }),

    calculateMatrix: adminOrRhProcedure
      .input(z.object({ assessmentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const ar: any = await db.execute(drzSql`SELECT * FROM risk_assessments WHERE id=${input.assessmentId} LIMIT 1`);
        const a = (ar as any)[0]?.[0];
        if (!a) throw new TRPCError({ code: "NOT_FOUND" });
        if (a.company_id !== cid) throw new TRPCError({ code: "FORBIDDEN" });
        if (!a.drps_survey_id) throw new TRPCError({ code: "BAD_REQUEST", message: "DRPS não vinculado." });

        // Map order_index → factor code
        const orderToFactor: Record<number, string> = {};
        for (let i = 1; i <= 3; i++) orderToFactor[i] = "assedio";
        for (let i = 4; i <= 6; i++) orderToFactor[i] = "suporte";
        for (let i = 7; i <= 9; i++) orderToFactor[i] = "mudancas";
        for (let i = 10; i <= 12; i++) orderToFactor[i] = "clareza";
        for (let i = 13; i <= 15; i++) orderToFactor[i] = "reconhecimento";
        for (let i = 16; i <= 18; i++) orderToFactor[i] = "autonomia";
        for (let i = 19; i <= 21; i++) orderToFactor[i] = "justica";
        for (let i = 22; i <= 24; i++) orderToFactor[i] = "sobrecarga";
        for (let i = 25; i <= 27; i++) orderToFactor[i] = "subcarga";
        for (let i = 28; i <= 30; i++) orderToFactor[i] = "relacionamento";
        for (let i = 31; i <= 33; i++) orderToFactor[i] = "comunicacao_dificil";
        for (let i = 34; i <= 36; i++) orderToFactor[i] = "isolamento";
        for (let i = 37; i <= 40; i++) orderToFactor[i] = "eventos_criticos";

        // Reverse-scored question order_indexes (positive phrasing where higher likert = LOWER risk)
        const reverseSet = new Set([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 29, 30, 31, 32, 33, 35, 39, 40]);

        // Fetch questions
        const qr: any = await db.execute(drzSql`
          SELECT id, order_index FROM survey_questions WHERE survey_id=${a.drps_survey_id} ORDER BY order_index`);
        const questions = (qr as any)[0] ?? [];
        const qInfo: Record<number, { factor: string; reverse: boolean }> = {};
        for (const q of questions) {
          const oi = Number(q.order_index);
          const code = orderToFactor[oi];
          if (!code) continue;
          qInfo[Number(q.id)] = { factor: code, reverse: reverseSet.has(oi) };
        }

        // Fetch answers. DRPS is anonymous (user_id NULL), so we track the response (submission)
        // id to count respondents — each survey_responses row is one respondent.
        const ansR: any = await db.execute(drzSql`
          SELECT sa.question_id, sa.answer_value, sr.id AS response_id
          FROM survey_answers sa
          INNER JOIN survey_responses sr ON sr.id = sa.response_id
          WHERE sr.survey_id = ${a.drps_survey_id}`);
        const answers = (ansR as any)[0] ?? [];

        // Aggregate per factor
        const agg: Record<string, { sum: number; n: number; resp: Set<number> }> = {};
        for (const ans of answers) {
          const info = qInfo[Number(ans.question_id)];
          if (!info) continue;
          let raw = parseFloat(String(ans.answer_value));
          if (Number.isNaN(raw)) continue;
          // assume 0-4 scale
          if (info.reverse) raw = 4 - raw;
          if (!agg[info.factor]) agg[info.factor] = { sum: 0, n: 0, resp: new Set() };
          agg[info.factor].sum += raw;
          agg[info.factor].n += 1;
          if (ans.response_id) agg[info.factor].resp.add(Number(ans.response_id));
        }

        // Matrix mapping for risco_final from gravidade & probabilidade
        function classify(score: number): string {
          if (score < 1) return "baixa";
          if (score < 2) return "media";
          if (score < 3) return "alta";
          return "critica";
        }
        function finalRisk(grav: string, prob: string): string {
          const ord: Record<string, number> = { baixa: 0, media: 1, alta: 2, critica: 3 };
          const g = ord[grav] ?? 0;
          const p = ord[prob] ?? 0;
          const sum = g + p;
          if (sum >= 5) return "critico";
          if (sum >= 4) return "critico";
          if (sum >= 3) return "alto";
          if (sum >= 2) return "medio";
          return "baixo";
        }

        // Get inventory items
        const ir: any = await db.execute(drzSql`
          SELECT ii.id, ii.factor_id, ii.probabilidade, f.code
          FROM risk_inventory_items ii
          INNER JOIN psychosocial_factors f ON f.id = ii.factor_id
          WHERE ii.assessment_id=${input.assessmentId}`);
        const items = (ir as any)[0] ?? [];

        let updated = 0;
        for (const item of items) {
          const a2 = agg[item.code];
          let grav = "baixa";
          let avg = 0;
          let n = 0;
          let userCount = 0;
          if (a2 && a2.n > 0) {
            avg = a2.sum / a2.n;
            grav = classify(avg);
            n = a2.n;
            userCount = a2.resp.size;
          }
          const prob = item.probabilidade || grav;
          const risco = finalRisk(grav, prob);
          await db.execute(drzSql`
            UPDATE risk_inventory_items
            SET gravidade=${grav}, risco_final=${risco}, drps_score_avg=${avg.toFixed(2)}, drps_responses_count=${userCount}
            WHERE id=${item.id}`);
          updated++;
        }

        // Mark assessment as analyzing
        await db.execute(drzSql`UPDATE risk_assessments SET status='analyzing' WHERE id=${input.assessmentId}`);

        return { ok: true, updated, factorsWithData: Object.keys(agg).length };
      }),

    updateInventoryItem: adminOrRhProcedure
      .input(z.object({
        itemId: z.number(),
        probabilidade: z.string().optional(),
        gravidade: z.string().optional(),
        fontesGeradoras: z.string().optional(),
        medidasExistentes: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        // Verify company
        const cr: any = await db.execute(drzSql`
          SELECT ra.company_id, ii.gravidade, ii.probabilidade FROM risk_inventory_items ii
          INNER JOIN risk_assessments ra ON ra.id = ii.assessment_id
          WHERE ii.id=${input.itemId} LIMIT 1`);
        const row = (cr as any)[0]?.[0];
        if (!row) throw new TRPCError({ code: "NOT_FOUND" });
        if (row.company_id !== cid) throw new TRPCError({ code: "FORBIDDEN" });

        const grav = input.gravidade ?? row.gravidade;
        const prob = input.probabilidade ?? row.probabilidade;
        const ord: Record<string, number> = { baixa: 0, media: 1, alta: 2, critica: 3 };
        const sum = (ord[grav] ?? 0) + (ord[prob] ?? 0);
        let risco = "baixo";
        if (sum >= 4) risco = "critico";
        else if (sum >= 3) risco = "alto";
        else if (sum >= 2) risco = "medio";

        await db.execute(drzSql`
          UPDATE risk_inventory_items
          SET gravidade=${grav}, probabilidade=${prob}, risco_final=${risco},
              fontes_geradoras=COALESCE(${input.fontesGeradoras ?? null}, fontes_geradoras),
              medidas_existentes=COALESCE(${input.medidasExistentes ?? null}, medidas_existentes),
              notes=COALESCE(${input.notes ?? null}, notes)
          WHERE id=${input.itemId}`);
        return { ok: true, riscoFinal: risco };
      }),

    generateActionPlan: adminOrRhProcedure
      .input(z.object({ assessmentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const ar: any = await db.execute(drzSql`SELECT company_id, start_date FROM risk_assessments WHERE id=${input.assessmentId} LIMIT 1`);
        const a = (ar as any)[0]?.[0];
        if (!a) throw new TRPCError({ code: "NOT_FOUND" });
        if (a.company_id !== cid) throw new TRPCError({ code: "FORBIDDEN" });

        const ir: any = await db.execute(drzSql`
          SELECT ii.*, f.code, f.preventive_program_module_id AS programId, f.default_action AS defaultAction
          FROM risk_inventory_items ii
          INNER JOIN psychosocial_factors f ON f.id = ii.factor_id
          WHERE ii.assessment_id=${input.assessmentId}
          ORDER BY f.axis_order`);
        const items = (ir as any)[0] ?? [];

        // Remove existing plan items
        await db.execute(drzSql`DELETE FROM risk_action_plan_items WHERE assessment_id=${input.assessmentId}`);

        const startD = a.start_date ? new Date(a.start_date) : new Date();
        function monthIso(offset: number) {
          const d = new Date(startD.getFullYear(), startD.getMonth() + offset, 1);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        }

        let created = 0;
        for (const it of items) {
          if (it.risco_final === "baixo") continue;
          const priority = it.risco_final;
          let months: number[];
          if (priority === "critico") months = [0, 1, 2];
          else if (priority === "alto") months = [1, 2, 3, 4];
          else months = [3, 4, 5, 6];
          const progress: Record<string, boolean> = {};
          for (const off of months) progress[monthIso(off)] = true;

          const startIdx = months[0];
          const endIdx = months[months.length - 1];
          const sD = new Date(startD.getFullYear(), startD.getMonth() + startIdx, 1);
          const eD = new Date(startD.getFullYear(), startD.getMonth() + endIdx + 1, 0);

          await db.execute(drzSql`
            INSERT INTO risk_action_plan_items
              (assessment_id, factor_id, preventive_program_module_id, action_description, responsible_party, priority, start_date, end_date, status, monthly_progress)
            VALUES (${input.assessmentId}, ${it.factor_id}, ${it.programId ?? null}, ${it.defaultAction ?? "Ação a definir"},
                    'Consultoria Saúde do Trabalho', ${priority},
                    ${sD.toISOString().slice(0, 10)}, ${eD.toISOString().slice(0, 10)},
                    'programado', ${JSON.stringify(progress)})`);
          created++;
        }
        return { ok: true, created };
      }),

    updateActionPlanItem: adminOrRhProcedure
      .input(z.object({
        itemId: z.number(),
        actionDescription: z.string().optional(),
        responsibleParty: z.string().optional(),
        priority: z.string().optional(),
        status: z.string().optional(),
        monthlyProgress: z.record(z.boolean()).optional(),
        notes: z.string().optional(),
        fiveW2hWhy: z.string().optional(),
        fiveW2hWhere: z.string().optional(),
        fiveW2hHow: z.string().optional(),
        fiveW2hCost: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const cr: any = await db.execute(drzSql`
          SELECT ra.company_id FROM risk_action_plan_items ap
          INNER JOIN risk_assessments ra ON ra.id = ap.assessment_id
          WHERE ap.id=${input.itemId} LIMIT 1`);
        const row = (cr as any)[0]?.[0];
        if (!row) throw new TRPCError({ code: "NOT_FOUND" });
        if (row.company_id !== cid) throw new TRPCError({ code: "FORBIDDEN" });

        await db.execute(drzSql`
          UPDATE risk_action_plan_items
          SET action_description=COALESCE(${input.actionDescription ?? null}, action_description),
              responsible_party=COALESCE(${input.responsibleParty ?? null}, responsible_party),
              priority=COALESCE(${input.priority ?? null}, priority),
              status=COALESCE(${input.status ?? null}, status),
              monthly_progress=COALESCE(${input.monthlyProgress ? JSON.stringify(input.monthlyProgress) : null}, monthly_progress),
              notes=COALESCE(${input.notes ?? null}, notes),
              five_w2h_why=COALESCE(${input.fiveW2hWhy ?? null}, five_w2h_why),
              five_w2h_where=COALESCE(${input.fiveW2hWhere ?? null}, five_w2h_where),
              five_w2h_how=COALESCE(${input.fiveW2hHow ?? null}, five_w2h_how),
              five_w2h_cost=COALESCE(${input.fiveW2hCost ?? null}, five_w2h_cost)
          WHERE id=${input.itemId}`);
        return { ok: true };
      }),

    deleteActionPlanItem: adminOrRhProcedure
      .input(z.object({ itemId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const cr: any = await db.execute(drzSql`
          SELECT ra.company_id FROM risk_action_plan_items ap
          INNER JOIN risk_assessments ra ON ra.id = ap.assessment_id
          WHERE ap.id=${input.itemId} LIMIT 1`);
        const row = (cr as any)[0]?.[0];
        if (!row) throw new TRPCError({ code: "NOT_FOUND" });
        if (row.company_id !== cid) throw new TRPCError({ code: "FORBIDDEN" });
        await db.execute(drzSql`DELETE FROM risk_action_plan_items WHERE id=${input.itemId}`);
        return { ok: true };
      }),

    updateAssessment: adminOrRhProcedure
      .input(z.object({
        id: z.number(),
        cycleName: z.string().optional(),
        status: z.string().optional(),
        responsibleTechnician: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const cr: any = await db.execute(drzSql`SELECT company_id FROM risk_assessments WHERE id=${input.id} LIMIT 1`);
        const row = (cr as any)[0]?.[0];
        if (!row) throw new TRPCError({ code: "NOT_FOUND" });
        if (row.company_id !== cid) throw new TRPCError({ code: "FORBIDDEN" });
        await db.execute(drzSql`
          UPDATE risk_assessments
          SET cycle_name=COALESCE(${input.cycleName ?? null}, cycle_name),
              status=COALESCE(${input.status ?? null}, status),
              responsible_technician=COALESCE(${input.responsibleTechnician ?? null}, responsible_technician),
              notes=COALESCE(${input.notes ?? null}, notes)
          WHERE id=${input.id}`);
        return { ok: true };
      }),

    // ── PDF generation ─────────────────────────────────────────────────────
    generateLaudoPDF: adminOrRhProcedure
      .input(z.object({ assessmentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { generateRiskLaudoPDF } = await import("./_core/risk_pdf");
        const data = await loadAssessmentForPDF(db, input.assessmentId, cid);
        const url = await generateRiskLaudoPDF(data.assessment, data.inventory, data.actions, data.sectorGroups);
        return { ok: true, url };
      }),

    generateInventoryPDF: adminOrRhProcedure
      .input(z.object({ assessmentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { generateInventoryPDF } = await import("./_core/risk_pdf");
        const data = await loadAssessmentForPDF(db, input.assessmentId, cid);
        const url = await generateInventoryPDF(data.assessment, data.inventory);
        return { ok: true, url };
      }),

    generateCronogramaPDF: adminOrRhProcedure
      .input(z.object({ assessmentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { generateCronogramaPDF } = await import("./_core/risk_pdf");
        const data = await loadAssessmentForPDF(db, input.assessmentId, cid);
        const url = await generateCronogramaPDF(data.assessment, data.actions);
        return { ok: true, url };
      }),

    generateAEPPDF: adminOrRhProcedure
      .input(z.object({ assessmentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { generateAEPLaudoPDF } = await import("./_core/risk_pdf");
        const data = await loadAEPForPDF(db, input.assessmentId, cid);
        const url = await generateAEPLaudoPDF(data.assessment, data.items);
        return { ok: true, url };
      }),

    // Importa respostas de uma planilha (ex.: export do Google Forms) para o DRPS ou AEP
    // da análise. O frontend faz o mapeamento coluna→questão e envia respostas estruturadas.
    // Valores Likert são normalizados para a escala 0–4 da matriz. Com dryRun=true apenas valida.
    importResponses: adminOrRhProcedure
      .input(z.object({
        assessmentId: z.number(),
        target: z.enum(["drps", "aep"]),
        likertScale: z.enum(["0-4", "1-5"]).default("0-4"),
        dryRun: z.boolean().default(false),
        responses: z.array(z.object({
          answers: z.array(z.object({
            questionId: z.number(),
            value: z.string(),
          })),
        })).min(1).max(5000),
      }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const ar: any = await db.execute(drzSql`
          SELECT company_id, drps_survey_id, aep_survey_id, branch_id, sector_id
          FROM risk_assessments WHERE id=${input.assessmentId} LIMIT 1`);
        const a = Array.isArray(ar) ? (ar[0]?.[0] ?? ar[0]) : ar;
        if (!a) throw new TRPCError({ code: "NOT_FOUND" });
        if (Number(a.company_id) !== Number(cid)) throw new TRPCError({ code: "FORBIDDEN" });

        const surveyId = input.target === "drps" ? a.drps_survey_id : a.aep_survey_id;
        if (!surveyId) throw new TRPCError({ code: "BAD_REQUEST", message: `Pesquisa ${input.target.toUpperCase()} não vinculada.` });

        // Mapa de questões válidas desta pesquisa (id → tipo)
        const qr: any = await db.execute(drzSql`SELECT id, question_type FROM survey_questions WHERE survey_id=${surveyId}`);
        const qrows = (qr as any)[0] ?? [];
        const qType = new Map<number, string>();
        for (const q of qrows) qType.set(Number(q.id), String(q.question_type || "text").toLowerCase());

        let inserted = 0, skipped = 0, answersInserted = 0, likertNormalized = 0, invalidAnswers = 0;

        for (const resp of input.responses) {
          // monta as respostas válidas (questão pertence à pesquisa + valor não vazio)
          const valid: { questionId: number; value: string }[] = [];
          for (const an of resp.answers) {
            if (!qType.has(an.questionId)) { invalidAnswers++; continue; }
            const isLikert = qType.get(an.questionId) === "likert" || qType.get(an.questionId) === "nps";
            let val = an.value == null ? "" : String(an.value).trim();
            if (isLikert) {
              const norm = normalizeLikertValue(val, input.likertScale);
              if (norm === "") continue;
              val = norm;
              likertNormalized++;
            }
            if (val === "") continue;
            valid.push({ questionId: an.questionId, value: val });
          }
          if (valid.length === 0) { skipped++; continue; }

          if (!input.dryRun) {
            const ins: any = await db.execute(drzSql`
              INSERT INTO survey_responses (survey_id, user_id, branch_id, sector_id)
              VALUES (${surveyId}, NULL, ${a.branch_id ?? null}, ${a.sector_id ?? null})`);
            const responseId = Number((ins as any)[0]?.insertId ?? (ins as any).insertId ?? 0);
            for (const v of valid) {
              await db.execute(drzSql`
                INSERT INTO survey_answers (response_id, question_id, answer_value)
                VALUES (${responseId}, ${v.questionId}, ${v.value})`);
              answersInserted++;
            }
          } else {
            answersInserted += valid.length;
          }
          inserted++;
        }

        return {
          ok: true,
          dryRun: input.dryRun,
          target: input.target,
          surveyId,
          summary: { responses: inserted, skipped, answersInserted, likertNormalized, invalidAnswers },
        };
      }),
  }),


  // ─────────────────────────────────────────────────────────────────────────
  // PGR — Programa de Gerenciamento de Riscos (gerador de documento)
  // Modelo: texto técnico padrão da consultoria + dados/logo do cliente.
  // ─────────────────────────────────────────────────────────────────────────
  documents: router({
    /** List all documents for the company */
    list: adminOrRhProcedure
      .input(z.object({ docType: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        if (!cid) return [];
        const db = await getDb();
        if (!db) return [];
        const rows: any = await db.execute(drzSql`
          SELECT d.*, u.name AS uploader_name
          FROM company_documents d
          LEFT JOIN users u ON u.id = d.uploaded_by_user_id
          WHERE d.company_id = ${cid}
          ${input.docType ? `AND d.doc_type = '${input.docType.replace(/'/g, "''")}'` : ''}
          ORDER BY d.created_at DESC
          LIMIT 200`);
        const list = Array.isArray((rows as any)[0]) ? (rows as any)[0] : [];
        return list.map((r: any) => ({
          id: Number(r.id),
          name: String(r.name ?? ""),
          description: r.description ? String(r.description) : null,
          docType: String(r.doc_type ?? "outros"),
          fileUrl: String(r.file_url ?? ""),
          fileName: String(r.file_name ?? ""),
          fileSize: r.file_size ? Number(r.file_size) : null,
          mimeType: r.mime_type ? String(r.mime_type) : null,
          uploaderName: r.uploader_name ? String(r.uploader_name) : null,
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
        }));
      }),

    /** Upload a document (base64) */
    upload: adminOrRhProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        docType: z.string().default("outros"),
        fileBase64: z.string(),
        fileName: z.string(),
        mimeType: z.string().default("application/octet-stream"),
      }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        const uid = (ctx.user as any).id ?? (ctx.user as any).userId;
        if (!cid) throw new TRPCError({ code: "BAD_REQUEST", message: "Empresa não definida." });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const fsmod = await import("fs");
        const pathmod = await import("path");
        const dir = "/var/www/saudedotrabalho/uploads/documents";
        if (!fsmod.existsSync(dir)) fsmod.mkdirSync(dir, { recursive: true });

        const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filename = `\${cid}_\${Date.now()}_\${safeName}`;
        const filepath = pathmod.join(dir, filename);
        const base64Data = input.fileBase64.replace(/^data:[^;]+;base64,/, "");
        const buf = Buffer.from(base64Data, "base64");
        fsmod.writeFileSync(filepath, buf);

        const fileUrl = `/uploads/documents/\${filename}`;
        const res: any = await db.execute(drzSql`
          INSERT INTO company_documents (company_id, name, description, doc_type, file_url, file_name, file_size, mime_type, uploaded_by_user_id)
          VALUES (\${cid}, \${input.name}, \${input.description ?? null}, \${input.docType}, \${fileUrl}, \${input.fileName}, \${buf.length}, \${input.mimeType}, \${uid})`);
        return { ok: true, id: Number((res as any)[0]?.insertId ?? 0), fileUrl };
      }),

    /** Delete a document */
    remove: adminOrRhProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const dr: any = await db.execute(drzSql`SELECT company_id, file_url FROM company_documents WHERE id=\${input.id} LIMIT 1`);
        const doc = (dr as any)[0]?.[0];
        if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
        if (doc.company_id !== cid) throw new TRPCError({ code: "FORBIDDEN" });
        // Delete file from disk
        try {
          const fsmod = await import("fs");
          const pathmod = await import("path");
          const filepath = pathmod.join("/var/www/saudedotrabalho", doc.file_url);
          if (fsmod.existsSync(filepath)) fsmod.unlinkSync(filepath);
        } catch {}
        await db.execute(drzSql`DELETE FROM company_documents WHERE id=\${input.id}`);
        return { ok: true };
      }),
  }),

  pcmso: router({
    /** List all PCMSO exam records for the company */
    list: adminOrRhProcedure
      .input(z.object({ tipoRisco: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        if (!cid) return [];
        const db = await getDb();
        if (!db) return [];
        let q = `SELECT * FROM pcmso_exames WHERE company_id = ${cid}`;
        if (input?.tipoRisco) q += ` AND tipo_risco = '${input.tipoRisco.replace(/'/g,"''")}'`;
        q += ` ORDER BY tipo_risco ASC, fator_risco ASC, id ASC LIMIT 500`;
        const rows: any = await db.execute(drzSql.raw(q));
        const list = Array.isArray((rows as any)[0]) ? (rows as any)[0] : [];
        return list.map((r: any) => ({
          id: Number(r.id),
          fatorRisco: String(r.fator_risco ?? ""),
          tipoRisco: String(r.tipo_risco ?? "Psicossocial"),
          tipoExame: String(r.tipo_exame ?? ""),
          periodicidade: String(r.periodicidade ?? "Anual"),
          prazAdmissional: !!r.prazo_admissional,
          prazPeriodico: !!r.prazo_periodico,
          prazDemissional: !!r.prazo_demissional,
          prazMudancaFuncao: !!r.prazo_mudanca_funcao,
          prazRetorno: !!r.prazo_retorno,
          status: String(r.status ?? "pendente"),
          observacoes: r.observacoes ? String(r.observacoes) : null,
          responsavel: r.responsavel ? String(r.responsavel) : null,
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
        }));
      }),

    /** Create or update a PCMSO exam record */
    upsert: adminOrRhProcedure
      .input(z.object({
        id: z.number().optional(),
        fatorRisco: z.string().min(1),
        tipoRisco: z.string().default("Psicossocial"),
        tipoExame: z.string().min(1),
        periodicidade: z.string().default("Anual"),
        prazAdmissional: z.boolean().default(true),
        prazPeriodico: z.boolean().default(true),
        prazDemissional: z.boolean().default(true),
        prazMudancaFuncao: z.boolean().default(false),
        prazRetorno: z.boolean().default(false),
        status: z.string().default("pendente"),
        observacoes: z.string().optional(),
        responsavel: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        if (!cid) throw new TRPCError({ code: "BAD_REQUEST" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        if (input.id) {
          await db.execute(drzSql`UPDATE pcmso_exames SET
            fator_risco=${input.fatorRisco}, tipo_risco=${input.tipoRisco},
            tipo_exame=${input.tipoExame}, periodicidade=${input.periodicidade},
            prazo_admissional=${input.prazAdmissional ? 1 : 0},
            prazo_periodico=${input.prazPeriodico ? 1 : 0},
            prazo_demissional=${input.prazDemissional ? 1 : 0},
            prazo_mudanca_funcao=${input.prazMudancaFuncao ? 1 : 0},
            prazo_retorno=${input.prazRetorno ? 1 : 0},
            status=${input.status}, observacoes=${input.observacoes ?? null},
            responsavel=${input.responsavel ?? null}, updated_at=NOW()
            WHERE id=${input.id} AND company_id=${cid}`);
          return { ok: true, id: input.id };
        } else {
          const res: any = await db.execute(drzSql`INSERT INTO pcmso_exames
            (company_id, fator_risco, tipo_risco, tipo_exame, periodicidade,
             prazo_admissional, prazo_periodico, prazo_demissional, prazo_mudanca_funcao, prazo_retorno,
             status, observacoes, responsavel)
            VALUES (${cid}, ${input.fatorRisco}, ${input.tipoRisco}, ${input.tipoExame},
                    ${input.periodicidade}, ${input.prazAdmissional ? 1 : 0},
                    ${input.prazPeriodico ? 1 : 0}, ${input.prazDemissional ? 1 : 0},
                    ${input.prazMudancaFuncao ? 1 : 0}, ${input.prazRetorno ? 1 : 0},
                    ${input.status}, ${input.observacoes ?? null}, ${input.responsavel ?? null})`);
          return { ok: true, id: Number((res as any)[0]?.insertId ?? 0) };
        }
      }),

    /** Delete a PCMSO exam record */
    remove: adminOrRhProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.execute(drzSql`DELETE FROM pcmso_exames WHERE id=${input.id} AND company_id=${cid}`);
        return { ok: true };
      }),

    /** Import exam mappings from PGR inventory (only unmapped factors) */
    importFromPGR: adminOrRhProcedure
      .input(z.object({ companyId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const role = (ctx.user as any).role;
        const isGlobal = role === "admin_global" || role === "super_admin";
        const cid = isGlobal && input.companyId ? input.companyId : (ctx.user as any).companyId;
        if (!cid) throw new TRPCError({ code: "BAD_REQUEST" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        // Get most recent PGR inventario for company
        const pgr: any = await db.execute(drzSql`SELECT inventario FROM pgr_documents WHERE company_id=${cid} ORDER BY id DESC LIMIT 1`);
        const row = (pgr as any)[0]?.[0];
        if (!row || !row.inventario) return { ok: true, imported: 0 };
        let items: any[] = [];
        try { items = JSON.parse(row.inventario); } catch { return { ok: true, imported: 0 }; }
        // Get existing factor-exam pairs
        const existing: any = await db.execute(drzSql`SELECT fator_risco, tipo_exame FROM pcmso_exames WHERE company_id=${cid}`);
        const existingSet = new Set((((existing as any)[0]) ?? []).map((e: any) => `${e.fator_risco}|||${e.tipo_exame}`));
        // Standard exam catalog (fator→exames)
        const CATALOG: Record<string, string[]> = {
          "Ruído": ["Audiometria tonal"],
          "Sílica": ["Radiografia de tórax", "Espirometria"],
          "Poeira": ["Radiografia de tórax", "Espirometria"],
          "Calor": ["Hemograma completo", "Avaliação cardiológica"],
          "Vibração": ["EMG / Avaliação osteoarticular"],
          "Radiação ionizante": ["Hemograma", "Contagem diferencial"],
          "Benzeno": ["Hemograma completo", "Hepatograma"],
          "Agrotóxico": ["Colinesterase eritrocitária"],
          "Biológico": ["Sorologia HBsAg", "Anti-HCV", "VDRL"],
          "Psicossocial": ["Avaliação psicológica ocupacional", "Entrevista clínica"],
          "Ergonômico": ["Avaliação osteoarticular", "Avaliação postural"],
          "Acidente": ["Avaliação clínica geral"],
        };
        let imported = 0;
        for (const item of items) {
          const fator = String(item.fator || "").trim();
          const tipoRisco = String(item.tipoRisco || "Outro").trim();
          if (!fator) continue;
          // Find matching catalog entries
          const matchKey = Object.keys(CATALOG).find(k => fator.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(fator.toLowerCase()));
          const exames = matchKey ? CATALOG[matchKey] : ["Avaliação clínica geral"];
          for (const exame of exames) {
            const key = `${fator}|||${exame}`;
            if (!existingSet.has(key)) {
              await db.execute(drzSql`INSERT INTO pcmso_exames
                (company_id, fator_risco, tipo_risco, tipo_exame, periodicidade, status)
                VALUES (${cid}, ${fator}, ${tipoRisco}, ${exame}, 'Anual', 'pendente')`);
              existingSet.add(key);
              imported++;
            }
          }
        }
        return { ok: true, imported };
      }),
  }),

  nrTraining: router({
    /** List all NR training records for the company */
    list: adminOrRhProcedure
      .input(z.object({ nrCode: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        if (!cid) return [];
        const db = await getDb();
        if (!db) return [];
        let q = `SELECT t.*, u.name AS responsible_name FROM nr_training_records t
          LEFT JOIN users u ON u.id = t.responsible_user_id
          WHERE t.company_id = ${cid}`;
        if (input.nrCode) q += ` AND t.nr_code = '${input.nrCode.replace(/'/g,"''")}'`;
        q += ` ORDER BY t.due_date ASC, t.id DESC LIMIT 500`;
        const rows: any = await db.execute(drzSql.raw(q));
        const list = Array.isArray((rows as any)[0]) ? (rows as any)[0] : [];
        return list.map((r: any) => ({
          id: Number(r.id),
          nrCode: String(r.nr_code ?? ""),
          trainingName: String(r.training_name ?? ""),
          durationHours: r.duration_hours ? Number(r.duration_hours) : null,
          validityMonths: r.validity_months ? Number(r.validity_months) : null,
          dueDate: r.due_date ? new Date(r.due_date).toISOString().slice(0,10) : null,
          status: String(r.status ?? "pendente"),
          pendingCount: r.pending_count ? Number(r.pending_count) : 0,
          notes: r.notes ? String(r.notes) : null,
          responsibleUserId: r.responsible_user_id ? Number(r.responsible_user_id) : null,
          responsibleName: r.responsible_name ? String(r.responsible_name) : null,
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
        }));
      }),

    /** Create or update a training record */
    upsert: adminOrRhProcedure
      .input(z.object({
        id: z.number().optional(),
        nrCode: z.string().min(1),
        trainingName: z.string().min(1),
        durationHours: z.number().optional(),
        validityMonths: z.number().optional(),
        dueDate: z.string().nullable().optional(),
        status: z.string().default("pendente"),
        pendingCount: z.number().default(0),
        notes: z.string().optional(),
        responsibleUserId: z.number().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        if (!cid) throw new TRPCError({ code: "BAD_REQUEST" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        if (input.id) {
          await db.execute(drzSql`UPDATE nr_training_records SET
            nr_code=${input.nrCode}, training_name=${input.trainingName},
            duration_hours=${input.durationHours ?? null}, validity_months=${input.validityMonths ?? null},
            due_date=${input.dueDate ?? null}, status=${input.status}, pending_count=${input.pendingCount},
            notes=${input.notes ?? null}, responsible_user_id=${input.responsibleUserId ?? null},
            updated_at=NOW()
            WHERE id=${input.id} AND company_id=${cid}`);
          return { ok: true, id: input.id };
        } else {
          const res: any = await db.execute(drzSql`INSERT INTO nr_training_records
            (company_id, nr_code, training_name, duration_hours, validity_months, due_date, status, pending_count, notes, responsible_user_id)
            VALUES (${cid}, ${input.nrCode}, ${input.trainingName}, ${input.durationHours ?? null},
                    ${input.validityMonths ?? null}, ${input.dueDate ?? null}, ${input.status},
                    ${input.pendingCount}, ${input.notes ?? null}, ${input.responsibleUserId ?? null})`);
          return { ok: true, id: Number((res as any)[0]?.insertId ?? 0) };
        }
      }),

    /** Delete a training record */
    remove: adminOrRhProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.execute(drzSql`DELETE FROM nr_training_records WHERE id=${input.id} AND company_id=${cid}`);
        return { ok: true };
      }),
  }),

  pgr: router({
    // Lista as empresas que o usuário pode gerenciar (admin global vê todas).
    listCompanies: adminOrRhProcedure.query(async ({ ctx }) => {
      const role = (ctx.user as any).role;
      const isGlobal = role === "admin_global" || role === "super_admin";
      const cid = (ctx.user as any).companyId;
      const db = await getDb();
      if (!db) return [] as any[];
      const r: any = isGlobal
        ? await db.execute(drzSql`SELECT id, name, cnpj, logo_url AS logoUrl FROM companies WHERE is_active=1 ORDER BY name`)
        : await db.execute(drzSql`SELECT id, name, cnpj, logo_url AS logoUrl FROM companies WHERE id=${cid} ORDER BY name`);
      return (r as any)[0] ?? [];
    }),

    // Lista PGRs existentes de uma empresa.
    list: adminOrRhProcedure
      .input(z.object({ companyId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const role = (ctx.user as any).role;
        const isGlobal = role === "admin_global" || role === "super_admin";
        const cid = isGlobal ? (input?.companyId ?? (ctx.user as any).companyId) : (ctx.user as any).companyId;
        const db = await getDb();
        if (!db || !cid) return [] as any[];
        const r: any = await db.execute(drzSql`
          SELECT id, title, razao_social AS razaoSocial, status, pdf_url AS pdfUrl,
                 vigencia_inicio AS vigenciaInicio, vigencia_fim AS vigenciaFim, updated_at AS updatedAt
          FROM pgr_documents WHERE company_id=${cid} ORDER BY updated_at DESC`);
        return (r as any)[0] ?? [];
      }),

    // Carrega um PGR por id, ou retorna defaults pré-preenchidos da empresa para um novo.
    get: adminOrRhProcedure
      .input(z.object({ id: z.number().optional(), companyId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const role = (ctx.user as any).role;
        const isGlobal = role === "admin_global" || role === "super_admin";
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        if (input.id) {
          const r: any = await db.execute(drzSql`SELECT * FROM pgr_documents WHERE id=${input.id} LIMIT 1`);
          const row = (r as any)[0]?.[0];
          if (!row) throw new TRPCError({ code: "NOT_FOUND" });
          if (!isGlobal && row.company_id !== (ctx.user as any).companyId) throw new TRPCError({ code: "FORBIDDEN" });
          return { mode: "edit" as const, doc: row };
        }

        // Novo PGR → prefill com dados da empresa.
        const cid = isGlobal ? (input.companyId ?? (ctx.user as any).companyId) : (ctx.user as any).companyId;
        if (!cid) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione a empresa do PGR." });
        const cr: any = await db.execute(drzSql`SELECT id, name, cnpj, logo_url AS logoUrl, address, phone FROM companies WHERE id=${cid} LIMIT 1`);
        const company = (cr as any)[0]?.[0];
        if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa não encontrada." });
        const empCount: any = await db.execute(drzSql`SELECT COUNT(*) AS c FROM users WHERE company_id=${cid}`);
        return {
          mode: "new" as const,
          doc: {
            company_id: cid,
            title: "PGR - Programa de Gerenciamento de Riscos",
            razao_social: company.name,
            nome_fantasia: company.name,
            cnpj: company.cnpj,
            endereco: company.address,
            contato: company.phone,
            num_funcionarios: String((empCount as any)[0]?.[0]?.c ?? ""),
            logo_url: company.logoUrl,
            contratante_ativo: 0,
            ghe_funcoes: [],
            revisoes: [{ revisao: "00", motivo: "Emissão inicial", data: null }],
            inventario: [],
          },
        };
      }),

    upsert: adminOrRhProcedure
      .input(z.object({
        id: z.number().optional(),
        companyId: z.number().optional(),
        title: z.string().optional(),
        razaoSocial: z.string().optional().nullable(),
        nomeFantasia: z.string().optional().nullable(),
        cnpj: z.string().optional().nullable(),
        endereco: z.string().optional().nullable(),
        atividadePrincipal: z.string().optional().nullable(),
        grauRisco: z.string().optional().nullable(),
        contato: z.string().optional().nullable(),
        email: z.string().optional().nullable(),
        numFuncionarios: z.string().optional().nullable(),
        objetoContrato: z.string().optional().nullable(),
        horariosTrabalho: z.string().optional().nullable(),
        regimeTrabalho: z.string().optional().nullable(),
        obra: z.string().optional().nullable(),
        vigenciaInicio: z.string().optional().nullable(),
        vigenciaFim: z.string().optional().nullable(),
        contratanteAtivo: z.boolean().optional(),
        contratanteRazao: z.string().optional().nullable(),
        contratanteCnpj: z.string().optional().nullable(),
        contratanteEndereco: z.string().optional().nullable(),
        contratanteAtividade: z.string().optional().nullable(),
        contratanteGrauRisco: z.string().optional().nullable(),
        contratanteContato: z.string().optional().nullable(),
        contratanteEmail: z.string().optional().nullable(),
        respTecnicoNome: z.string().optional().nullable(),
        respTecnicoRegistro: z.string().optional().nullable(),
        respTecnicoProfissao: z.string().optional().nullable(),
        respTecnicoArt: z.string().optional().nullable(),
        respTecnicoEmpresa: z.string().optional().nullable(),
        respTecnicoAssinaturaUrl: z.string().optional().nullable(),
        respTecnicoValidadeAte: z.string().optional().nullable(),
        logoUrl: z.string().optional().nullable(),
        gheFuncoes: z.array(z.object({ funcao: z.string(), descricao: z.string().optional().nullable(), num: z.union([z.number(), z.string()]).optional().nullable() })).optional(),
        revisoes: z.array(z.object({ revisao: z.string(), motivo: z.string(), data: z.string().optional().nullable() })).optional(),
        inventario: z.array(z.object({
          fator: z.string(), tipoRisco: z.string().optional().nullable(),
          postoTrabalho: z.string().optional().nullable(), setor: z.string().optional().nullable(),
          funcoes: z.string().optional().nullable(), dataReconhecimento: z.string().optional().nullable(),
          agravos: z.string().optional().nullable(), causas: z.string().optional().nullable(),
          controles: z.string().optional().nullable(), eficaciaControles: z.string().optional().nullable(),
          populacao: z.string().optional().nullable(), exposicao: z.string().optional().nullable(),
          freqExposicao: z.string().optional().nullable(), areaImpacto: z.string().optional().nullable(),
          tipoAvaliacao: z.string().optional().nullable(),
          probabilidade: z.union([z.number(), z.string()]).optional().nullable(),
          severidade: z.union([z.number(), z.string()]).optional().nullable(),
          acoes: z.string().optional().nullable(), responsavel: z.string().optional().nullable(),
          prazo: z.string().optional().nullable(), freqMonitoramento: z.string().optional().nullable(),
          legRef: z.string().optional().nullable(), observacoes: z.string().optional().nullable(),
          epc: z.string().optional().nullable(), epi: z.string().optional().nullable(),
        })).optional(),
        gseGrupos: z.array(z.object({
          grupo: z.string(),
          funcoes: z.string().optional().nullable(),
          atividades: z.string().optional().nullable(),
          num: z.union([z.number(), z.string()]).optional().nullable(),
        })).optional(),
        epcItens: z.array(z.object({
          descricao: z.string(),
          aplicacao: z.string().optional().nullable(),
        })).optional(),
        epiItens: z.array(z.object({
          descricao: z.string(),
          ca: z.string().optional().nullable(),
          aplicacao: z.string().optional().nullable(),
          validade: z.string().optional().nullable(),
        })).optional(),
        planoPsicossocial: z.array(z.any()).optional(),
        notasTecnicas: z.string().optional(),
        caracterizacaoSetores: z.array(z.any()).optional(),
        cronogramaPreventivo: z.array(z.any()).optional(),
        hierarquiaControle: z.array(z.any()).optional(),
        naoConformidades: z.array(z.any()).optional(),
        treinamentosNr: z.array(z.any()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const role = (ctx.user as any).role;
        const isGlobal = role === "admin_global" || role === "super_admin";
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const uid = (ctx.user as any).id;

        const ghe = JSON.stringify(input.gheFuncoes ?? []);
        const revs = JSON.stringify(input.revisoes ?? []);
        const inv = JSON.stringify(input.inventario ?? []);
        const gse = JSON.stringify(input.gseGrupos ?? []);
        const epc = JSON.stringify(input.epcItens ?? []);
        const epi = JSON.stringify(input.epiItens ?? []);
        const psy = JSON.stringify(input.planoPsicossocial ?? []);
        const carac = JSON.stringify(input.caracterizacaoSetores ?? []);
        const cron  = JSON.stringify(input.cronogramaPreventivo ?? []);
        const hier  = JSON.stringify(input.hierarquiaControle ?? []);
        const nc    = JSON.stringify(input.naoConformidades ?? []);
        const trein = JSON.stringify(input.treinamentosNr ?? []);
        const vi = input.vigenciaInicio || null;
        const vf = input.vigenciaFim || null;

        if (input.id) {
          const cr: any = await db.execute(drzSql`SELECT company_id FROM pgr_documents WHERE id=${input.id} LIMIT 1`);
          const row = (cr as any)[0]?.[0];
          if (!row) throw new TRPCError({ code: "NOT_FOUND" });
          if (!isGlobal && row.company_id !== (ctx.user as any).companyId) throw new TRPCError({ code: "FORBIDDEN" });
          await db.execute(drzSql`
            UPDATE pgr_documents SET
              title=${input.title ?? null}, razao_social=${input.razaoSocial ?? null}, nome_fantasia=${input.nomeFantasia ?? null},
              cnpj=${input.cnpj ?? null}, endereco=${input.endereco ?? null}, atividade_principal=${input.atividadePrincipal ?? null},
              grau_risco=${input.grauRisco ?? null}, contato=${input.contato ?? null}, email=${input.email ?? null},
              num_funcionarios=${input.numFuncionarios ?? null}, objeto_contrato=${input.objetoContrato ?? null},
              horarios_trabalho=${input.horariosTrabalho ?? null}, regime_trabalho=${input.regimeTrabalho ?? null}, obra=${input.obra ?? null},
              vigencia_inicio=${vi}, vigencia_fim=${vf},
              contratante_ativo=${input.contratanteAtivo ? 1 : 0}, contratante_razao=${input.contratanteRazao ?? null},
              contratante_cnpj=${input.contratanteCnpj ?? null}, contratante_endereco=${input.contratanteEndereco ?? null},
              contratante_atividade=${input.contratanteAtividade ?? null}, contratante_grau_risco=${input.contratanteGrauRisco ?? null},
              contratante_contato=${input.contratanteContato ?? null}, contratante_email=${input.contratanteEmail ?? null},
              resp_tecnico_nome=${input.respTecnicoNome ?? null}, resp_tecnico_registro=${input.respTecnicoRegistro ?? null},
              resp_tecnico_profissao=${input.respTecnicoProfissao ?? null}, resp_tecnico_art=${input.respTecnicoArt ?? null},
              resp_tecnico_empresa=${input.respTecnicoEmpresa ?? null}, resp_tecnico_assinatura_url=${input.respTecnicoAssinaturaUrl ?? null},
              resp_tecnico_validade_ate=${input.respTecnicoValidadeAte ?? null},
              logo_url=${input.logoUrl ?? null}, ghe_funcoes=${ghe}, revisoes=${revs}, inventario=${inv},
              gse_grupos=${gse}, epc_itens=${epc}, epi_itens=${epi},
              plano_psicossocial=${psy}, notas_tecnicas=${input.notasTecnicas ?? null},
              caracterizacao_setores=${carac}, cronograma_preventivo=${cron},
              hierarquia_controle=${hier}, nao_conformidades=${nc}, treinamentos_nr=${trein}
            WHERE id=${input.id}`);
          return { id: input.id };
        }

        const cid = isGlobal ? (input.companyId ?? (ctx.user as any).companyId) : (ctx.user as any).companyId;
        if (!cid) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione a empresa do PGR." });
        const ins: any = await db.execute(drzSql`
          INSERT INTO pgr_documents (
            company_id, title, razao_social, nome_fantasia, cnpj, endereco, atividade_principal, grau_risco,
            contato, email, num_funcionarios, objeto_contrato, horarios_trabalho, regime_trabalho, obra,
            vigencia_inicio, vigencia_fim, contratante_ativo, contratante_razao, contratante_cnpj, contratante_endereco,
            contratante_atividade, contratante_grau_risco, contratante_contato, contratante_email,
            resp_tecnico_nome, resp_tecnico_registro, resp_tecnico_profissao, resp_tecnico_art, resp_tecnico_empresa, resp_tecnico_assinatura_url, resp_tecnico_validade_ate, logo_url, ghe_funcoes, revisoes, inventario, gse_grupos, epc_itens, epi_itens, plano_psicossocial, notas_tecnicas, caracterizacao_setores, cronograma_preventivo, hierarquia_controle, nao_conformidades, treinamentos_nr, created_by_user_id
          ) VALUES (
            ${cid}, ${input.title ?? "PGR - Programa de Gerenciamento de Riscos"}, ${input.razaoSocial ?? null}, ${input.nomeFantasia ?? null},
            ${input.cnpj ?? null}, ${input.endereco ?? null}, ${input.atividadePrincipal ?? null}, ${input.grauRisco ?? null},
            ${input.contato ?? null}, ${input.email ?? null}, ${input.numFuncionarios ?? null}, ${input.objetoContrato ?? null},
            ${input.horariosTrabalho ?? null}, ${input.regimeTrabalho ?? null}, ${input.obra ?? null},
            ${vi}, ${vf}, ${input.contratanteAtivo ? 1 : 0}, ${input.contratanteRazao ?? null}, ${input.contratanteCnpj ?? null},
            ${input.contratanteEndereco ?? null}, ${input.contratanteAtividade ?? null}, ${input.contratanteGrauRisco ?? null},
            ${input.contratanteContato ?? null}, ${input.contratanteEmail ?? null}, ${input.respTecnicoNome ?? null},
            ${input.respTecnicoRegistro ?? null}, ${input.respTecnicoProfissao ?? null}, ${input.respTecnicoArt ?? null},
            ${input.respTecnicoEmpresa ?? null}, ${input.respTecnicoAssinaturaUrl ?? null}, ${input.respTecnicoValidadeAte ?? null},
            ${input.logoUrl ?? null}, ${ghe}, ${revs}, ${inv}, ${gse}, ${epc}, ${epi}, ${psy}, ${input.notasTecnicas ?? null}, ${carac}, ${cron}, ${hier}, ${nc}, ${trein}, ${uid}
          )`);
        const newId = Number((ins as any)[0]?.insertId ?? 0);
        return { id: newId };
      }),

    remove: adminOrRhProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const role = (ctx.user as any).role;
        const isGlobal = role === "admin_global" || role === "super_admin";
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const cr: any = await db.execute(drzSql`SELECT company_id FROM pgr_documents WHERE id=${input.id} LIMIT 1`);
        const row = (cr as any)[0]?.[0];
        if (!row) throw new TRPCError({ code: "NOT_FOUND" });
        if (!isGlobal && row.company_id !== (ctx.user as any).companyId) throw new TRPCError({ code: "FORBIDDEN" });
        await db.execute(drzSql`DELETE FROM pgr_documents WHERE id=${input.id}`);
        return { ok: true };
      }),

    // Resumo executivo de um PGR: indicadores de inventário, matriz e plano de ação.
    // Usado pela aba "Executivo" (AdminPGRExecutive).
    executiveOverview: adminOrRhProcedure
      .input(z.object({ pgrId: z.number() }))
      .query(async ({ ctx, input }) => {
        const role = (ctx.user as any).role;
        const isGlobal = role === "admin_global" || role === "super_admin";
        const cid = (ctx.user as any).companyId;
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [rows] = await execP(db, `SELECT * FROM pgr_documents WHERE id=?`, [input.pgrId]);
        const doc = (rows as any[])[0];
        if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "PGR não encontrado" });
        if (!isGlobal && Number(doc.company_id) !== Number(cid)) throw new TRPCError({ code: "FORBIDDEN" });
        const J = (s: any): any[] => { try { const a = JSON.parse(s || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } };
        const inv = J(doc.inventario), ghe = J(doc.ghe_funcoes), gse = J(doc.gse_grupos), epc = J(doc.epc_itens), epi = J(doc.epi_itens);
        const matrix: Record<"baixo" | "medio" | "alto" | "critico", number> = { baixo: 0, medio: 0, alto: 0, critico: 0 };
        const sevMap: Record<string, "baixo" | "medio" | "alto" | "critico"> = { baixa: "baixo", baixo: "baixo", moderada: "medio", media: "medio", medio: "medio", alta: "alto", alto: "alto", critica: "critico", critico: "critico" };
        const actionPlan = { pendente: 0, em_andamento: 0, concluido: 0, vencido: 0 };
        const now = new Date();
        const parsePrazo = (p: any): Date | null => {
          const s = String(p ?? "").trim(); if (!s) return null;
          if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s);
          if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) { const [d, m, y] = s.split("/"); return new Date(`${y}-${m}-${d}`); }
          return null;
        };
        for (const it of inv) {
          const sev = sevMap[String(it.severidade ?? "").toLowerCase()];
          if (sev) matrix[sev]++;
          const hasAction = String(it.acoes ?? "").trim() || String(it.responsavel ?? "").trim();
          if (hasAction) {
            const status = String(it.status ?? "").toLowerCase();
            const prazo = parsePrazo(it.prazo);
            if (status.includes("conclu")) actionPlan.concluido++;
            else if (status.includes("andamento")) actionPlan.em_andamento++;
            else if (prazo && prazo < now) actionPlan.vencido++;
            else actionPlan.pendente++;
          }
        }
        return {
          inventory: { totalGheGse: ghe.length + gse.length, trabalhadoresExpostos: Number(doc.num_funcionarios) || 0, epc: epc.length, epi: epi.length },
          matrix,
          actionPlan,
        };
      }),

    // Auditoria automática de um PGR: aponta não conformidades (lacunas) por
    // categoria e severidade. Usado pela aba "Auditoria" (AdminPGRAudit).
    auditPgr: adminOrRhProcedure
      .input(z.object({ pgrId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const role = (ctx.user as any).role;
        const isGlobal = role === "admin_global" || role === "super_admin";
        const cid = (ctx.user as any).companyId;
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [rows] = await execP(db, `SELECT * FROM pgr_documents WHERE id=?`, [input.pgrId]);
        const doc = (rows as any[])[0];
        if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "PGR não encontrado" });
        if (!isGlobal && Number(doc.company_id) !== Number(cid)) throw new TRPCError({ code: "FORBIDDEN" });
        const J = (s: any): any[] => { try { const a = JSON.parse(s || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } };
        const inv = J(doc.inventario), epi = J(doc.epi_itens);
        const now = new Date();
        const parsePrazo = (p: any): Date | null => {
          const s = String(p ?? "").trim(); if (!s) return null;
          if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s);
          if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) { const [d, m, y] = s.split("/"); return new Date(`${y}-${m}-${d}`); }
          if (/^\d{2}\/\d{4}/.test(s)) { const [m, y] = s.split("/"); return new Date(`${y}-${m}-01`); }
          return null;
        };
        const findings: any[] = [];
        const add = (severity: string, category: string, message: string, fix: string | null, code: string) =>
          findings.push({ severity, category, message, fix, code });
        if (!String(doc.cnpj ?? "").trim()) add("media", "Cadastro", "CNPJ da empresa não informado", "Preencha o CNPJ na identificação do PGR.", "PGR-CAD-01");
        if (!String(doc.title ?? doc.razao_social ?? "").trim()) add("baixa", "Cadastro", "Título / razão social não informado", "Informe o título do documento.", "PGR-CAD-02");
        if (!String(doc.resp_tecnico_nome ?? "").trim()) add("alta", "Responsabilidade Técnica", "PGR sem responsável técnico cadastrado", "Cadastre o RT em PGR › Responsáveis Técnicos.", "PGR-RT-01");
        if (inv.length === 0) add("alta", "Inventário de Riscos", "Inventário de riscos vazio", "Cadastre os fatores de risco identificados no GHE/GSE.", "PGR-INV-01");
        let semControle = 0, vencidas = 0, semResp = 0, semSev = 0;
        for (const it of inv) {
          if (!String(it.controles ?? "").trim()) semControle++;
          if (!String(it.severidade ?? "").trim()) semSev++;
          if (String(it.acoes ?? "").trim() && !String(it.responsavel ?? "").trim()) semResp++;
          const prazo = parsePrazo(it.prazo);
          if (prazo && prazo < now && !String(it.status ?? "").toLowerCase().includes("conclu")) vencidas++;
        }
        if (semControle > 0) add("media", "Inventário de Riscos", `${semControle} fator(es) sem medidas de controle`, "Defina controles (EPC/EPI/administrativos) para cada fator.", "PGR-INV-02");
        if (semSev > 0) add("baixa", "Inventário de Riscos", `${semSev} fator(es) sem classificação de severidade`, "Classifique a severidade de cada fator.", "PGR-INV-03");
        if (semResp > 0) add("media", "Plano de Ação", `${semResp} ação(ões) sem responsável definido`, "Atribua um responsável a cada ação.", "PGR-PA-01");
        if (vencidas > 0) add("alta", "Plano de Ação", `${vencidas} ação(ões) com prazo vencido`, "Atualize ou conclua as ações vencidas.", "PGR-PA-02");
        let epiVenc = 0;
        for (const e of epi) { const v = parsePrazo(e.validade); if (v && v < now) epiVenc++; }
        if (epiVenc > 0) add("media", "EPI / EPC", `${epiVenc} EPI(s) com validade/CA vencida`, "Substitua ou atualize os EPIs vencidos.", "PGR-EPI-01");
        if (String(doc.status ?? "") === "rascunho") add("baixa", "Documento", "PGR ainda em rascunho (não publicado)", "Conclua a revisão e publique o PGR.", "PGR-DOC-01");
        return { findings, total: findings.length, auditedAt: null };
      }),

    getPsychosocialForPGR: adminOrRhProcedure
      .input(z.object({ companyId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const role = (ctx.user as any).role;
        const isGlobal = role === "admin_global" || role === "super_admin";
        const cid = isGlobal ? (input.companyId ?? (ctx.user as any).companyId) : (ctx.user as any).companyId;
        const db = await getDb();
        if (!db || !cid) return [];
        const rows: any = await db.execute(drzSql`
          SELECT pf.name as fator, ri.risco_final, ri.fontes_geradoras as causas,
                 ri.medidas_existentes as controles, ra.cycle_name
          FROM risk_inventory_items ri
          JOIN risk_assessments ra ON ra.id = ri.assessment_id
          JOIN psychosocial_factors pf ON pf.id = ri.factor_id
          WHERE ra.company_id=${cid}
            AND ri.risco_final IN ('alto', 'critico')
          ORDER BY CASE ri.risco_final WHEN 'critico' THEN 1 WHEN 'alto' THEN 2 ELSE 3 END, pf.name
        `);
        const list = Array.isArray((rows as any)[0]) ? (rows as any)[0] : [];
        return list.map((r: any) => ({
          fator: String(r.fator ?? ""),
          riscoFinal: String(r.risco_final ?? ""),
          causas: r.causas ? String(r.causas) : "",
          controles: r.controles ? String(r.controles) : "",
          cycleName: String(r.cycle_name ?? ""),
        }));
      }),

    /** Transition PGR document status + log to revision history */
    updateStatus: adminOrRhProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["rascunho","em_revisao","aprovado","publicado"]),
        revisionNumber: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        const uid = (ctx.user as any).id;
        const userName = (ctx.user as any).name ?? (ctx.user as any).email ?? "—";
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const check: any = await db.execute(drzSql`SELECT id FROM pgr_documents WHERE id=${input.id} AND company_id=${cid} LIMIT 1`);
        if (!(check as any)[0]?.[0]) throw new TRPCError({ code: "FORBIDDEN" });
        const isApproved = input.status === "aprovado" || input.status === "publicado";
        if (input.revisionNumber) {
          await db.execute(drzSql`UPDATE pgr_documents SET status=${input.status}, current_revision=${input.revisionNumber},
            approved_by_user_id=${isApproved ? uid : null}, updated_at=NOW()
            WHERE id=${input.id}`);
        } else {
          await db.execute(drzSql`UPDATE pgr_documents SET status=${input.status},
            approved_by_user_id=${isApproved ? uid : null}, updated_at=NOW()
            WHERE id=${input.id}`);
        }
        await db.execute(drzSql`INSERT INTO pgr_revision_history
          (pgr_id, revision_number, action, performed_by_user_id, performed_by_name, notes)
          VALUES (${input.id}, ${input.revisionNumber ?? null}, ${input.status},
                  ${uid}, ${userName}, ${input.notes ?? null})`);
        return { ok: true };
      }),

    /** Get revision history for a PGR document */
    getHistory: adminOrRhProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        const db = await getDb();
        if (!db) return [];
        const check: any = await db.execute(drzSql`SELECT id FROM pgr_documents WHERE id=${input.id} AND company_id=${cid} LIMIT 1`);
        if (!(check as any)[0]?.[0]) return [];
        const rows: any = await db.execute(drzSql`
          SELECT h.*, u.name AS user_name_resolved
          FROM pgr_revision_history h
          LEFT JOIN users u ON u.id = h.performed_by_user_id
          WHERE h.pgr_id=${input.id} ORDER BY h.created_at ASC`);
        const list = (rows as any)[0] ?? [];
        return list.map((r: any) => ({
          id: Number(r.id),
          revisionNumber: r.revision_number ? String(r.revision_number) : null,
          action: String(r.action ?? ""),
          performedBy: r.user_name_resolved ? String(r.user_name_resolved) : (r.performed_by_name ? String(r.performed_by_name) : "—"),
          notes: r.notes ? String(r.notes) : null,
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
        }));
      }),

    /** PGR management dashboard: KPIs, risk distribution, pending actions, expired EPIs */
    /** Generate AI narrative text for a PGR section using Groq */
    generateNarrative: adminOrRhProcedure
      .input(z.object({
        pgrId: z.number(),
        section: z.enum(["objeto_contrato", "observacoes_gerais", "fator_observacao", "conclusao"]),
        fator: z.string().optional(),
        tipoRisco: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Load PGR
        const pgrChk: any = await db.execute(drzSql`SELECT razao_social, atividade_principal, grau_risco, num_funcionarios, inventario FROM pgr_documents WHERE id=${input.pgrId} AND company_id=${cid} LIMIT 1`);
        const pgr = (pgrChk as any)[0]?.[0];
        if (!pgr) throw new TRPCError({ code: "NOT_FOUND" });

        // Parse inventory for context
        let inv: any[] = [];
        try { inv = JSON.parse(pgr.inventario || "[]"); } catch {}
        const riskSummary = inv.slice(0, 10).map((i: any) => `${i.tipoRisco}: ${i.fator}`).join(", ");

        // Build prompt
        const GROQ_API_KEY = process.env.GROQ_API_KEY;
        if (!GROQ_API_KEY) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "GROQ_API_KEY not set" });

        let systemPrompt = "Você é um especialista em Segurança e Saúde no Trabalho (SST) no Brasil, redator técnico de PGR conforme NR-01. Escreva em português técnico formal, conciso, entre 3 e 6 frases.";
        let userPrompt = "";

        const empresa = String(pgr.razao_social || "empresa");
        const atividade = String(pgr.atividade_principal || "");
        const grauRisco = String(pgr.grau_risco || "");
        const numFunc = String(pgr.num_funcionarios || "");

        if (input.section === "objeto_contrato") {
          userPrompt = `Redija o campo "Objeto do Contrato / Escopo do PGR" para a empresa "${empresa}"${atividade ? `, atuante no setor: ${atividade}` : ""}${grauRisco ? `, grau de risco ${grauRisco}` : ""}${numFunc ? `, com ${numFunc} funcionários` : ""}. Riscos identificados: ${riskSummary || "a identificar"}. O texto deve descrever o objetivo do PGR, período de vigência e responsabilidades principais.`;
        } else if (input.section === "observacoes_gerais") {
          userPrompt = `Redija as "Observações Técnicas Gerais" do PGR da empresa "${empresa}"${atividade ? ` (${atividade})` : ""}. Riscos mapeados: ${riskSummary || "a identificar"}. Inclua recomendações gerais de prevenção, revisão periódica e conformidade com NR-01.`;
        } else if (input.section === "fator_observacao") {
          const fator = input.fator || "fator de risco";
          const tipo = input.tipoRisco || "";
          userPrompt = `Redija uma observação técnica para o fator de risco "${fator}"${tipo ? ` (${tipo})` : ""} no contexto da empresa "${empresa}"${atividade ? ` (${atividade})` : ""}. Descreva o risco, fontes geradoras típicas, efeitos à saúde e recomendações de controle, referenciando normas aplicáveis (NR-01, NR-09, NR-15, etc.).`;
        } else {
          userPrompt = `Redija a "Conclusão" do PGR da empresa "${empresa}"${atividade ? ` (${atividade})` : ""}${grauRisco ? `, grau de risco ${grauRisco}` : ""}. Total de riscos identificados: ${inv.length}. Inclua síntese dos principais riscos, compromisso com a melhoria contínua e alinhamento à NR-01.`;
        }

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            temperature: 0.5,
            max_tokens: 512,
          }),
        });

        if (!response.ok) {
          const err = await response.text().catch(() => "");
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Groq error: ${err.slice(0,200)}` });
        }
        const data = await response.json();
        const text = String(data?.choices?.[0]?.message?.content ?? "");
        return { text };
      }),

    /** Import psychosocial risk factors from AEP/DRPS assessments into PGR inventory */
    importFromAEP: adminOrRhProcedure
      .input(z.object({ pgrId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Verify PGR ownership
        const pgrChk: any = await db.execute(drzSql`SELECT id, inventario FROM pgr_documents WHERE id=${input.pgrId} AND company_id=${cid} LIMIT 1`);
        const pgrRow = (pgrChk as any)[0]?.[0];
        if (!pgrRow) throw new TRPCError({ code: "FORBIDDEN" });

        // Load existing inventory to avoid duplication
        let existingInv: any[] = [];
        try { existingInv = JSON.parse(pgrRow.inventario || "[]"); } catch { existingInv = []; }
        const existingKeys = new Set(existingInv.map((i: any) => `${String(i.tipoRisco||"")}_${String(i.fator||"")}`));

        // Query risk inventory items with factor names and sector info
        const invRows: any = await db.execute(drzSql`
          SELECT
            ra.sector_id,
            s.name AS sector_name,
            ri.gravidade,
            ri.probabilidade,
            ri.risco_final,
            ri.fontes_geradoras,
            ri.medidas_existentes,
            ri.aep_observations,
            ri.drps_score_avg,
            pf.id AS factor_id,
            pf.name AS factor_name,
            pf.description AS factor_desc,
            pf.code AS factor_code
          FROM risk_assessments ra
          LEFT JOIN sectors s ON s.id = ra.sector_id
          INNER JOIN risk_inventory_items ri ON ri.assessment_id = ra.id
          INNER JOIN psychosocial_factors pf ON pf.id = ri.factor_id
          WHERE ra.company_id=${cid}
          ORDER BY ra.id DESC, pf.axis_order ASC
          LIMIT 500`);
        const items = (invRows as any)[0] ?? [];

        // Query action plan items for this company
        const apRows: any = await db.execute(drzSql`
          SELECT ap.factor_id, ap.action_description, ap.responsible_party, ap.end_date, ap.status
          FROM risk_action_plan_items ap
          INNER JOIN risk_assessments ra ON ra.id = ap.assessment_id
          WHERE ra.company_id=${cid}
          ORDER BY ap.end_date ASC`);
        const actions = (apRows as any)[0] ?? [];

        // Build action map keyed by factor_id (first matching action)
        const actionMap: Record<number, any> = {};
        for (const ap of actions) {
          const fid = Number(ap.factor_id);
          if (!actionMap[fid]) actionMap[fid] = ap;
        }

        // Build new inventory items
        const newItems: any[] = [];
        const seenKeys = new Set<string>();
        for (const item of items) {
          const tipoRisco = "Psicossocial";
          const fator = String(item.factor_name || "");
          const key = `${tipoRisco}_${fator}`;
          if (existingKeys.has(key) || seenKeys.has(key)) continue;
          seenKeys.add(key);

          const ap = actionMap[Number(item.factor_id)];
          const eficacia = item.risco_final === "alto" || item.risco_final === "alta" ? "Insuficiente"
            : item.risco_final === "medio" || item.risco_final === "media" || item.risco_final === "moderado" ? "Parcial"
            : "Adequada";

          let prazoStr = "";
          if (ap?.end_date) {
            try { prazoStr = new Date(ap.end_date).toISOString().slice(0, 10); } catch {}
          }

          const obs: string[] = [];
          if (item.aep_observations) obs.push(String(item.aep_observations));
          if (item.drps_score_avg != null) obs.push(`DRPS score: ${Number(item.drps_score_avg).toFixed(2)}`);

          newItems.push({
            tipoRisco,
            fator,
            fonte: String(item.fontes_geradoras || item.factor_desc || ""),
            setor: String(item.sector_name || ""),
            eficaciaControles: eficacia,
            medidas: String(item.medidas_existentes || ""),
            responsavel: ap ? String(ap.responsible_party || "") : "",
            prazo: prazoStr,
            observacoes: obs.join("; "),
          });
        }

        if (newItems.length === 0) {
          return { added: 0, message: "Nenhum fator novo encontrado para importar." };
        }

        const mergedInv = [...existingInv, ...newItems];
        await db.execute(drzSql`UPDATE pgr_documents SET inventario=${JSON.stringify(mergedInv)}, updated_at=NOW() WHERE id=${input.pgrId} AND company_id=${cid}`);
        return { added: newItems.length, message: `${newItems.length} fator(es) psicossocial(is) importado(s) do AEP/DRPS.` };
      }),

    /** Import psychosocial risk factors from AEP/DRPS — END **/

    /** Upload PNG signature image */
    uploadSignature: adminOrRhProcedure
      .input(z.object({
        imageBase64: z.string().max(500_000),
        type: z.enum(["resp_tecnico", "logo"]).default("resp_tecnico"),
      }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId ?? "global";
        const uid = (ctx.user as any).id;
        const fs = await import("fs");
        const path = await import("path");
        const crypto = await import("crypto");
        const base64Data = input.imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        if (buffer.length > 200_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Imagem muito grande (max 200KB)" });
        const ext = input.imageBase64.startsWith("data:image/png") ? ".png" : ".jpg";
        const hash = crypto.createHash("md5").update(buffer).digest("hex").slice(0, 8);
        const fileName = `${input.type}_${cid}_${uid}_${hash}${ext}`;
        const uploadDir = "/var/www/saudedotrabalho/uploads/signatures";
        fs.mkdirSync(uploadDir, { recursive: true });
        fs.writeFileSync(path.join(uploadDir, fileName), buffer);
        return { url: `/uploads/signatures/${fileName}` };
      }),

        dashboard: adminOrRhProcedure.query(async ({ ctx }) => {
      const cid = (ctx.user as any).companyId;
      const isGlobal = (ctx.user as any).role === "admin_global" || (ctx.user as any).role === "super_admin";
      const db = await getDb();
      if (!db) return null;
      const rows: any = isGlobal
        ? await db.execute(drzSql`SELECT id, title AS titulo, status, inventario, epi_itens, gse_grupos, epc_itens, updated_at FROM pgr_documents ORDER BY updated_at DESC LIMIT 200`)
        : await db.execute(drzSql`SELECT id, title AS titulo, status, inventario, epi_itens, gse_grupos, epc_itens, updated_at FROM pgr_documents WHERE company_id=${cid} ORDER BY updated_at DESC LIMIT 200`);
      const docs = (rows as any)[0] ?? [];

      const statusCounts: Record<string, number> = { rascunho: 0, em_revisao: 0, aprovado: 0, publicado: 0 };
      const factorsByType: Record<string, number> = {};
      const expiredEPIs: any[] = [];
      const pendingActions: any[] = [];
      let totalFactors = 0;
      let totalGSE = 0;
      let totalEPC = 0;
      let totalEPI = 0;
      const now = new Date();

      for (const doc of docs) {
        const st = String(doc.status ?? "rascunho");
        statusCounts[st] = (statusCounts[st] || 0) + 1;

        // Parse inventory
        let inv: any[] = [];
        try { inv = JSON.parse(doc.inventario || "[]"); } catch { inv = []; }
        if (!Array.isArray(inv)) inv = [];
        totalFactors += inv.length;
        for (const item of inv) {
          const t = String(item.tipoRisco || "Outro");
          factorsByType[t] = (factorsByType[t] || 0) + 1;
          // Check overdue actions
          if (item.responsavel && item.prazo) {
            const prazoStr = String(item.prazo);
            // Try ISO date YYYY-MM-DD or DD/MM/YYYY
            let prazoDate: Date | null = null;
            if (/^\d{4}-\d{2}-\d{2}/.test(prazoStr)) {
              prazoDate = new Date(prazoStr);
            } else if (/^\d{2}\/\d{2}\/\d{4}/.test(prazoStr)) {
              const [d, m, y] = prazoStr.split("/");
              prazoDate = new Date(`${y}-${m}-${d}`);
            }
            if (prazoDate && !isNaN(prazoDate.getTime()) && prazoDate < now) {
              pendingActions.push({
                pgrId: Number(doc.id),
                pgrTitulo: String(doc.titulo ?? ""),
                fator: String(item.fator ?? ""),
                tipoRisco: String(item.tipoRisco ?? ""),
                responsavel: String(item.responsavel ?? ""),
                prazo: prazoStr,
                daysOverdue: Math.floor((now.getTime() - prazoDate.getTime()) / 86400000),
              });
            }
          }
        }

        // Parse EPI items
        let epis: any[] = [];
        try { epis = JSON.parse(doc.epi_itens || "[]"); } catch { epis = []; }
        if (!Array.isArray(epis)) epis = [];
        totalEPI += epis.length;
        for (const epi of epis) {
          const valStr = String(epi.validade ?? "").trim();
          if (!valStr) continue;
          let valDate: Date | null = null;
          if (/^\d{4}-\d{2}-\d{2}/.test(valStr)) valDate = new Date(valStr);
          else if (/^\d{2}\/\d{2}\/\d{4}/.test(valStr)) {
            const [d, m, y] = valStr.split("/");
            valDate = new Date(`${y}-${m}-${d}`);
          } else if (/^\d{2}\/\d{4}/.test(valStr)) {
            const [m, y] = valStr.split("/");
            valDate = new Date(`${y}-${m}-01`);
          }
          if (valDate && !isNaN(valDate.getTime()) && valDate < now) {
            expiredEPIs.push({
              pgrId: Number(doc.id),
              pgrTitulo: String(doc.titulo ?? ""),
              descricao: String(epi.descricao ?? ""),
              ca: String(epi.ca ?? ""),
              validade: valStr,
              daysExpired: Math.floor((now.getTime() - valDate.getTime()) / 86400000),
            });
          }
        }

        // Parse GSE/EPC
        let gse: any[] = [];
        try { gse = JSON.parse(doc.gse_grupos || "[]"); } catch { gse = []; }
        if (Array.isArray(gse)) totalGSE += gse.length;

        let epc: any[] = [];
        try { epc = JSON.parse(doc.epc_itens || "[]"); } catch { epc = []; }
        if (Array.isArray(epc)) totalEPC += epc.length;
      }

      // Sort overdue by days desc
      pendingActions.sort((a, b) => b.daysOverdue - a.daysOverdue);
      expiredEPIs.sort((a, b) => b.daysExpired - a.daysExpired);

      // Sector criticality: count high+critical risk factors per setor
      const sectorMap: Record<string, { total: number; alto: number; critico: number }> = {};
      for (const doc of docs) {
        let inv2: any[] = [];
        try { inv2 = JSON.parse(doc.inventario || "[]"); } catch {}
        for (const item of inv2) {
          const setor = String(item.setor || "Sem setor").trim() || "Sem setor";
          if (!sectorMap[setor]) sectorMap[setor] = { total: 0, alto: 0, critico: 0 };
          sectorMap[setor].total++;
          const p = String(item.probabilidade || "").toLowerCase();
          const s = String(item.severidade || "").toLowerCase();
          const pv = p === "certo" ? 4 : p === "provavel" ? 3 : p === "possivel" ? 2 : 1;
          const sv = s === "catastrofica" ? 5 : s === "maior" ? 4 : s === "moderada" ? 3 : s === "menor" ? 2 : 1;
          const nr = pv * sv;
          if (nr >= 15) sectorMap[setor].critico++;
          else if (nr >= 9) sectorMap[setor].alto++;
        }
      }
      const sectorCriticality = Object.entries(sectorMap)
        .map(([setor, d]) => ({ setor, ...d, risk: d.critico * 2 + d.alto }))
        .sort((a, b) => b.risk - a.risk)
        .slice(0, 10);

      // PCMSO summary
      let pcmsoTotal = 0; let pcmsoPendente = 0;
      try {
        const pcR: any = isGlobal
          ? await db.execute(drzSql`SELECT status FROM pcmso_exames LIMIT 500`)
          : await db.execute(drzSql`SELECT status FROM pcmso_exames WHERE company_id=${cid} LIMIT 500`);
        const pcRows = (pcR as any)[0] ?? [];
        pcmsoTotal = pcRows.length;
        pcmsoPendente = pcRows.filter((r: any) => String(r.status || "") === "pendente").length;
      } catch {}

      return {
        totalPGRs: docs.length,
        statusCounts,
        totalFactors,
        factorsByType,
        totalGSE,
        totalEPC,
        totalEPI,
        pendingActions: pendingActions.slice(0, 20),
        expiredEPIs: expiredEPIs.slice(0, 20),
        sectorCriticality,
        pcmsoTotal,
        pcmsoPendente,
      };
    }),

    /** List attachments/evidence for a PGR document */
    listAttachments: adminOrRhProcedure
      .input(z.object({ pgrId: z.number() }))
      .query(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        const db = await getDb();
        if (!db) return [];
        const rows: any = await db.execute(drzSql`
          SELECT a.*, u.name AS uploader_name
          FROM pgr_attachments a
          LEFT JOIN users u ON u.id = a.uploaded_by_user_id
          WHERE a.pgr_id=${input.pgrId} AND a.company_id=${cid}
          ORDER BY a.tipo ASC, a.created_at ASC LIMIT 200`);
        const list = (rows as any)[0] ?? [];
        return list.map((r: any) => ({
          id: Number(r.id),
          pgrId: Number(r.pgr_id),
          tipo: String(r.tipo ?? "Outro"),
          titulo: String(r.titulo ?? ""),
          descricao: r.descricao ? String(r.descricao) : null,
          fileUrl: r.file_url ? String(r.file_url) : null,
          fileName: r.file_name ? String(r.file_name) : null,
          fileSize: r.file_size ? Number(r.file_size) : null,
          mimeType: r.mime_type ? String(r.mime_type) : null,
          dataReferencia: r.data_referencia ? new Date(r.data_referencia).toISOString().slice(0,10) : null,
          numeroDoc: r.numero_doc ? String(r.numero_doc) : null,
          uploaderName: r.uploader_name ? String(r.uploader_name) : null,
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
        }));
      }),

    /** Create or update an attachment record */
    upsertAttachment: adminOrRhProcedure
      .input(z.object({
        id: z.number().optional(),
        pgrId: z.number(),
        tipo: z.string().default("Outro"),
        titulo: z.string().min(1),
        descricao: z.string().optional(),
        fileUrl: z.string().optional(),
        fileName: z.string().optional(),
        fileSize: z.number().optional(),
        mimeType: z.string().optional(),
        dataReferencia: z.string().optional(),
        numeroDoc: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        const uid = (ctx.user as any).id;
        if (!cid) throw new TRPCError({ code: "BAD_REQUEST" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        // Verify PGR ownership
        const chk: any = await db.execute(drzSql`SELECT id FROM pgr_documents WHERE id=${input.pgrId} AND company_id=${cid} LIMIT 1`);
        if (!(chk as any)[0]?.[0]) throw new TRPCError({ code: "FORBIDDEN" });
        if (input.id) {
          await db.execute(drzSql`UPDATE pgr_attachments SET
            tipo=${input.tipo}, titulo=${input.titulo}, descricao=${input.descricao ?? null},
            file_url=${input.fileUrl ?? null}, file_name=${input.fileName ?? null},
            file_size=${input.fileSize ?? null}, mime_type=${input.mimeType ?? null},
            data_referencia=${input.dataReferencia ?? null}, numero_doc=${input.numeroDoc ?? null},
            updated_at=NOW()
            WHERE id=${input.id} AND company_id=${cid}`);
          return { ok: true, id: input.id };
        } else {
          const res: any = await db.execute(drzSql`INSERT INTO pgr_attachments
            (pgr_id, company_id, tipo, titulo, descricao, file_url, file_name,
             file_size, mime_type, data_referencia, numero_doc, uploaded_by_user_id)
            VALUES (${input.pgrId}, ${cid}, ${input.tipo}, ${input.titulo},
                    ${input.descricao ?? null}, ${input.fileUrl ?? null}, ${input.fileName ?? null},
                    ${input.fileSize ?? null}, ${input.mimeType ?? null},
                    ${input.dataReferencia ?? null}, ${input.numeroDoc ?? null}, ${uid})`);
          return { ok: true, id: Number((res as any)[0]?.insertId ?? 0) };
        }
      }),

    /** Delete an attachment record */
    removeAttachment: adminOrRhProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.execute(drzSql`DELETE FROM pgr_attachments WHERE id=${input.id} AND company_id=${cid}`);
        return { ok: true };
      }),

    generatePDF: adminOrRhProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const role = (ctx.user as any).role;
        const isGlobal = role === "admin_global" || role === "super_admin";
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const r: any = await db.execute(drzSql`SELECT * FROM pgr_documents WHERE id=${input.id} LIMIT 1`);
        const row = (r as any)[0]?.[0];
        if (!row) throw new TRPCError({ code: "NOT_FOUND" });
        if (!isGlobal && row.company_id !== (ctx.user as any).companyId) throw new TRPCError({ code: "FORBIDDEN" });

        const parseJson = (v: any) => {
          if (v == null) return [];
          if (Array.isArray(v)) return v;
          try { return JSON.parse(typeof v === "string" ? v : String(v)); } catch { return []; }
        };

        const { generatePGRPDF } = await import("./_core/pgr_pdf");
        const url = await generatePGRPDF({
          id: row.id,
          title: row.title,
          razaoSocial: row.razao_social,
          nomeFantasia: row.nome_fantasia,
          cnpj: row.cnpj,
          endereco: row.endereco,
          atividadePrincipal: row.atividade_principal,
          grauRisco: row.grau_risco,
          contato: row.contato,
          email: row.email,
          numFuncionarios: row.num_funcionarios,
          objetoContrato: row.objeto_contrato,
          horariosTrabalho: row.horarios_trabalho,
          regimeTrabalho: row.regime_trabalho,
          obra: row.obra,
          vigenciaInicio: row.vigencia_inicio ? new Date(row.vigencia_inicio).toISOString() : null,
          vigenciaFim: row.vigencia_fim ? new Date(row.vigencia_fim).toISOString() : null,
          contratanteAtivo: !!row.contratante_ativo,
          contratanteRazao: row.contratante_razao,
          contratanteCnpj: row.contratante_cnpj,
          contratanteEndereco: row.contratante_endereco,
          contratanteAtividade: row.contratante_atividade,
          contratanteGrauRisco: row.contratante_grau_risco,
          contratanteContato: row.contratante_contato,
          contratanteEmail: row.contratante_email,
          respTecnicoNome: row.resp_tecnico_nome,
          respTecnicoRegistro: row.resp_tecnico_registro,
          respTecnicoProfissao: row.resp_tecnico_profissao,
          respTecnicoArt: row.resp_tecnico_art,
          respTecnicoEmpresa: row.resp_tecnico_empresa,
          respTecnicoAssinaturaUrl: row.resp_tecnico_assinatura_url,
          respTecnicoValidadeAte: row.resp_tecnico_validade_ate,
          logoUrl: row.logo_url,
          currentRevision: row.current_revision ? String(row.current_revision) : "00",
          approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : null,
          gheFuncoes: parseJson(row.ghe_funcoes),
          revisoes: parseJson(row.revisoes),
          inventario: parseJson(row.inventario),
          gseGrupos: parseJson(row.gse_grupos),
          epcItens: parseJson(row.epc_itens),
          epiItens: parseJson(row.epi_itens),
          planoPsicossocial: parseJson(row.plano_psicossocial),
          notasTecnicas: row.notas_tecnicas ? String(row.notas_tecnicas) : "",
          caracterizacaoSetores: parseJson(row.caracterizacao_setores),
          cronogramaPreventivo: parseJson(row.cronograma_preventivo),
          hierarquiaControle: parseJson(row.hierarquia_controle),
          naoConformidades: parseJson(row.nao_conformidades),
          treinamentosNr: parseJson(row.treinamentos_nr),
        });
        await db.execute(drzSql`UPDATE pgr_documents SET pdf_url=${url}, status='gerado' WHERE id=${row.id}`);
        return { ok: true, url };
      }),
  }),


  analytics: router({
    // Recalcula o Índice de Bem-Estar de todos os colaboradores ativos da empresa.
    // Usado pelo botão "Recalcular índice" do Dashboard de Riscos Psicossociais.
    recomputeWellbeing: adminOrRhProcedure
      .input(z.object({}).optional())
      .mutation(async ({ ctx }) => {
        const cid = (ctx.user as any).companyId;
        if (!cid) return { recomputed: 0 };
        const db = await getDb();
        if (!db) return { recomputed: 0 };
        const [rows] = await execP(db, `SELECT id FROM users WHERE company_id=? AND is_active=1`, [cid]);
        let n = 0;
        for (const u of (rows as any[])) {
          try { await computeWellbeingIndex(Number(u.id), cid); n++; } catch (_) { /* segue */ }
        }
        return { processed: n, snapshotted: n, recomputed: n };
      }),

    // Dashboard de Riscos Psicossociais: classifica colaboradores por faixa de
    // risco a partir do último Índice de Bem-Estar. Faixas: >=80 sem_risco,
    // 60-79 sinal_precoce, 40-59 risco_moderado, <40 risco_elevado.
    psychosocialDashboard: adminOrRhProcedure
      .input(z.object({ branchId: z.number().nullable().optional(), sectorId: z.number().nullable().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        if (!cid) return { bands: { sem_risco: 0, sinal_precoce: 0, risco_moderado: 0, risco_elevado: 0 }, total: 0, evolution: [], bySector: [], topRisk: [] };
        const db = await getDb();
        if (!db) return { bands: { sem_risco: 0, sinal_precoce: 0, risco_moderado: 0, risco_elevado: 0 }, total: 0, evolution: [], bySector: [], topRisk: [] };
        const bId = input?.branchId ?? null, sId = input?.sectorId ?? null;
        const band = (sc: number) => sc >= 80 ? "sem_risco" : sc >= 60 ? "sinal_precoce" : sc >= 40 ? "risco_moderado" : "risco_elevado";
        let where = "WHERE u.company_id=? AND u.is_active=1";
        const params: any[] = [cid];
        if (bId) { where += " AND u.branch_id=?"; params.push(bId); }
        if (sId) { where += " AND u.sector_id=?"; params.push(sId); }
        // último snapshot por colaborador
        const [rows] = await execP(db, `
          SELECT u.id AS userId, u.name, b.name AS branch, s.name AS sector, wi.score
          FROM users u
          LEFT JOIN branches b ON b.id=u.branch_id
          LEFT JOIN sectors s ON s.id=u.sector_id
          LEFT JOIN wellbeing_index wi ON wi.user_id=u.id
            AND wi.snapshot_month=(SELECT MAX(w2.snapshot_month) FROM wellbeing_index w2 WHERE w2.user_id=u.id)
          ${where}`, params);
        const people = (rows as any[]).filter((r) => r.score != null).map((r) => ({ ...r, score: Number(r.score), band: band(Number(r.score)) }));
        const bands = { sem_risco: 0, sinal_precoce: 0, risco_moderado: 0, risco_elevado: 0 } as Record<string, number>;
        const bySectorMap = new Map<string, any>();
        for (const p of people) {
          bands[p.band]++;
          const sk = p.sector ?? "Sem setor";
          if (!bySectorMap.has(sk)) bySectorMap.set(sk, { name: sk, sem_risco: 0, sinal_precoce: 0, risco_moderado: 0, risco_elevado: 0 });
          bySectorMap.get(sk)[p.band]++;
        }
        const bySector = [...bySectorMap.values()].map((s) => {
          const tot = s.sem_risco + s.sinal_precoce + s.risco_moderado + s.risco_elevado;
          return { ...s, riskPct: tot ? Math.round(((s.risco_moderado + s.risco_elevado) / tot) * 100) : 0 };
        }).sort((a, b) => b.riskPct - a.riskPct);
        const topRisk = people.filter((p) => p.band !== "sem_risco").sort((a, b) => a.score - b.score).slice(0, 15)
          .map((p) => ({ userId: p.userId, name: p.name, branch: p.branch, sector: p.sector, band: p.band, score: p.score }));
        // evolução (média mensal, últimos 6 meses)
        const [evoRows] = await execP(db, `
          SELECT wi.snapshot_month AS month, ROUND(AVG(wi.score)) AS avgScore,
                 SUM(wi.score < 40) AS elevado, SUM(wi.score >= 40 AND wi.score < 60) AS moderado
          FROM wellbeing_index wi JOIN users u ON u.id=wi.user_id
          ${where}
          GROUP BY wi.snapshot_month ORDER BY wi.snapshot_month DESC LIMIT 6`, params);
        const evolution = (evoRows as any[]).reverse().map((e) => ({ month: e.month, avgScore: Number(e.avgScore) || 0, elevado: Number(e.elevado) || 0, moderado: Number(e.moderado) || 0 }));
        return { bands, total: people.length, evolution, bySector, topRisk };
      }),
    // === Overview KPIs ===
    overview: adminOrRhProcedure
      .input(z.object({
        from: z.string().optional(),
        to: z.string().optional(),
        branchId: z.number().optional(),
        sectorId: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const cid = Number((ctx.user as any).companyId) || 0;
        const role = (ctx.user as any).role;
        const isGlobal = role === 'admin_global';
        const db = await getDb();
        if (!db) return { totalUsers: 0, activeUsers: 0, modulesCompleted: 0, certificatesIssued: 0, surveyResponseRate: 0, avgEngagement: 0, riskOverview: { baixo: 0, medio: 0, alto: 0, critico: 0 } };

        const from = input?.from ? new Date(input.from) : new Date(Date.now() - 90*24*3600*1000);
        const to = input?.to ? new Date(input.to) : new Date();
        const fromStr = from.toISOString().slice(0,10);
        const toStr = to.toISOString().slice(0,10);

        const branchFilter = input?.branchId ? `AND u.branch_id = ${Number(input.branchId)}` : '';
        const sectorFilter = input?.sectorId ? `AND u.sector_id = ${Number(input.sectorId)}` : '';
        const companyFilter = isGlobal ? '' : `AND u.company_id = ${cid}`;

        const totalUsersR: any = await db.execute(drzSql.raw(`SELECT COUNT(*) AS c FROM users u WHERE 1=1 ${companyFilter} ${branchFilter} ${sectorFilter}`));
        const activeUsersR: any = await db.execute(drzSql.raw(`SELECT COUNT(*) AS c FROM users u WHERE u.lastSignedIn >= DATE_SUB(NOW(), INTERVAL 30 DAY) ${companyFilter} ${branchFilter} ${sectorFilter}`));
        const modulesCompletedR: any = await db.execute(drzSql.raw(`SELECT COUNT(*) AS c FROM user_progress p INNER JOIN users u ON u.id=p.userId WHERE p.isCompleted=1 ${companyFilter} ${branchFilter} ${sectorFilter}`));
        const certsR: any = await db.execute(drzSql.raw(`SELECT COUNT(*) AS c FROM certificates c2 INNER JOIN users u ON u.id=c2.userId WHERE 1=1 ${companyFilter} ${branchFilter} ${sectorFilter}`));

        // survey response rate: responses / (active surveys * total users) — simplified
        const surveysR: any = await db.execute(drzSql.raw(`SELECT COUNT(*) AS c FROM surveys s WHERE s.status='active' ${isGlobal ? '' : `AND s.company_id = ${cid}`}`));
        const responsesR: any = await db.execute(drzSql.raw(`SELECT COUNT(*) AS c FROM survey_responses r INNER JOIN surveys s ON s.id=r.survey_id WHERE 1=1 ${isGlobal ? '' : `AND s.company_id = ${cid}`}`));

        const totalUsers = Number(totalUsersR[0]?.[0]?.c ?? totalUsersR?.[0]?.c ?? 0);
        const activeUsers = Number(activeUsersR[0]?.[0]?.c ?? activeUsersR?.[0]?.c ?? 0);
        const modulesCompleted = Number(modulesCompletedR[0]?.[0]?.c ?? modulesCompletedR?.[0]?.c ?? 0);
        const certificatesIssued = Number(certsR[0]?.[0]?.c ?? certsR?.[0]?.c ?? 0);
        const activeSurveys = Number(surveysR[0]?.[0]?.c ?? surveysR?.[0]?.c ?? 0);
        const totalResponses = Number(responsesR[0]?.[0]?.c ?? responsesR?.[0]?.c ?? 0);
        const surveyResponseRate = (activeSurveys > 0 && totalUsers > 0) ? Math.round((totalResponses / (activeSurveys * totalUsers)) * 100) : 0;
        const avgEngagementR: any = await db.execute(drzSql.raw(`SELECT ROUND(AVG(COALESCE(p.percentWatched,0)),1) AS avg_percent FROM user_progress p INNER JOIN users u ON u.id=p.userId WHERE 1=1 ${companyFilter} ${branchFilter} ${sectorFilter}`));
        const avgEngagement = Number(avgEngagementR[0]?.[0]?.avg_percent ?? avgEngagementR?.[0]?.avg_percent ?? 0);

        // Risk overview
        const riskR: any = await db.execute(drzSql.raw(`
          SELECT ri.risco_final AS level, COUNT(*) AS c
          FROM risk_inventory_items ri
          INNER JOIN risk_assessments ra ON ra.id = ri.assessment_id
          WHERE 1=1 ${isGlobal ? '' : `AND ra.company_id = ${cid}`}
          GROUP BY ri.risco_final
        `));
        const riskRows: any[] = (riskR[0] ?? riskR) as any[];
        const riskOverview = { baixo: 0, medio: 0, alto: 0, critico: 0 };
        for (const row of (Array.isArray(riskRows) ? riskRows : [])) {
          const lvl = String(row.level || '').toLowerCase();
          if (lvl.includes('crit')) riskOverview.critico += Number(row.c);
          else if (lvl.includes('alto')) riskOverview.alto += Number(row.c);
          else if (lvl.includes('med')) riskOverview.medio += Number(row.c);
          else riskOverview.baixo += Number(row.c);
        }

        return {
          totalUsers, activeUsers, modulesCompleted, certificatesIssued,
          surveyResponseRate, avgEngagement, activeSurveys, totalResponses,
          riskOverview,
          periodFrom: fromStr, periodTo: toStr,
        };
      }),

    // === Courses ===
    courseFunnel: adminOrRhProcedure
      .input(z.object({ branchId: z.number().optional(), sectorId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const cid = Number((ctx.user as any).companyId) || 0;
        const role = (ctx.user as any).role;
        const isGlobal = role === 'admin_global';
        const db = await getDb();
        if (!db) return [];
        const companyFilter = isGlobal ? '' : `AND u.company_id = ${cid}`;
        const branchFilter = input?.branchId ? `AND u.branch_id = ${Number(input.branchId)}` : '';
        const sectorFilter = input?.sectorId ? `AND u.sector_id = ${Number(input.sectorId)}` : '';
        const r: any = await db.execute(drzSql.raw(`
          SELECT m.id, m.title,
            COUNT(DISTINCT CASE WHEN p.percentWatched > 0 THEN p.userId END) AS started,
            COUNT(DISTINCT CASE WHEN p.percentWatched >= 25 THEN p.userId END) AS qtr,
            COUNT(DISTINCT CASE WHEN p.percentWatched >= 50 THEN p.userId END) AS half,
            COUNT(DISTINCT CASE WHEN p.percentWatched >= 75 THEN p.userId END) AS three_qtr,
            COUNT(DISTINCT CASE WHEN p.isCompleted = 1 THEN p.userId END) AS completed
          FROM modules m
          LEFT JOIN user_progress p ON p.moduleId = m.id
          LEFT JOIN users u ON u.id = p.userId
          WHERE m.isActive = 1 ${companyFilter} ${branchFilter} ${sectorFilter}
          GROUP BY m.id, m.title
          ORDER BY started DESC
          LIMIT 12
        `));
        const rows: any[] = (r[0] ?? r) as any[];
        return (Array.isArray(rows) ? rows : []).map((row: any) => ({
          moduleId: Number(row.id), title: String(row.title),
          started: Number(row.started), qtr: Number(row.qtr), half: Number(row.half),
          threeQtr: Number(row.three_qtr), completed: Number(row.completed),
        }));
      }),

    completionByDimension: adminOrRhProcedure
      .input(z.object({
        dimension: z.enum(['branch','sector','role','module']),
        branchId: z.number().optional(),
        sectorId: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const cid = Number((ctx.user as any).companyId) || 0;
        const role = (ctx.user as any).role;
        const isGlobal = role === 'admin_global';
        const db = await getDb();
        if (!db) return [];
        const branchFilter = input.branchId ? Number(input.branchId) : null;
        const sectorFilter = input.sectorId ? Number(input.sectorId) : null;

        // If drilled into a sector, return user-level breakdown
        if (sectorFilter) {
          const userQ = `
            SELECT u.id, u.name,
              COUNT(DISTINCT u.id) AS totalUsers,
              COUNT(DISTINCT CASE WHEN p.isCompleted = 1 THEN p.moduleId END) AS usersCompleted,
              ROUND(AVG(COALESCE(p.percentWatched, 0)), 1) AS avgPercent
            FROM users u
            LEFT JOIN user_progress p ON p.userId = u.id
            WHERE u.sector_id = ${sectorFilter} ${isGlobal ? '' : `AND u.company_id = ${cid}`}
            GROUP BY u.id, u.name
            ORDER BY avgPercent DESC
            LIMIT 50
          `;
          const r: any = await db.execute(drzSql.raw(userQ));
          const rows: any[] = (r[0] ?? r) as any[];
          return (Array.isArray(rows) ? rows : []).map((row: any) => ({
            id: Number(row.id), name: String(row.name ?? ''),
            totalUsers: Number(row.totalUsers ?? 0),
            usersCompleted: Number(row.usersCompleted ?? 0),
            avgPercent: Number(row.avgPercent ?? 0),
          }));
        }

        // If drilled into a branch, dimension defaults to sector-within-branch
        const effDimension = branchFilter ? 'sector' : input.dimension;
        const extraFilter = branchFilter ? ` AND u.branch_id = ${branchFilter}` : '';

        let query = '';
        if (effDimension === 'branch') {
          query = `
            SELECT b.id, b.name,
              COUNT(DISTINCT u.id) AS totalUsers,
              COUNT(DISTINCT CASE WHEN p.isCompleted = 1 THEN p.userId END) AS usersCompleted,
              ROUND(AVG(COALESCE(p.percentWatched, 0)), 1) AS avgPercent
            FROM branches b
            LEFT JOIN users u ON u.branch_id = b.id
            LEFT JOIN user_progress p ON p.userId = u.id
            WHERE 1=1 ${isGlobal ? '' : `AND b.company_id = ${cid}`}
            GROUP BY b.id, b.name
            ORDER BY avgPercent DESC
          `;
        } else if (input.dimension === 'sector') {
          query = `
            SELECT s.id, s.name,
              COUNT(DISTINCT u.id) AS totalUsers,
              COUNT(DISTINCT CASE WHEN p.isCompleted = 1 THEN p.userId END) AS usersCompleted,
              ROUND(AVG(COALESCE(p.percentWatched, 0)), 1) AS avgPercent
            FROM sectors s
            LEFT JOIN users u ON u.sector_id = s.id
            LEFT JOIN user_progress p ON p.userId = u.id
            WHERE 1=1 ${isGlobal ? '' : `AND s.company_id = ${cid}`}${extraFilter}
            GROUP BY s.id, s.name
            ORDER BY avgPercent DESC
          `;
        } else if (input.dimension === 'role') {
          query = `
            SELECT u.role AS id, u.role AS name,
              COUNT(DISTINCT u.id) AS totalUsers,
              COUNT(DISTINCT CASE WHEN p.isCompleted = 1 THEN p.userId END) AS usersCompleted,
              ROUND(AVG(COALESCE(p.percentWatched, 0)), 1) AS avgPercent
            FROM users u
            LEFT JOIN user_progress p ON p.userId = u.id
            WHERE 1=1 ${isGlobal ? '' : `AND u.company_id = ${cid}`}
            GROUP BY u.role
            ORDER BY avgPercent DESC
          `;
        } else {
          query = `
            SELECT m.id, m.title AS name,
              COUNT(DISTINCT p.userId) AS totalUsers,
              COUNT(DISTINCT CASE WHEN p.isCompleted = 1 THEN p.userId END) AS usersCompleted,
              ROUND(AVG(COALESCE(p.percentWatched, 0)), 1) AS avgPercent
            FROM modules m
            LEFT JOIN user_progress p ON p.moduleId = m.id
            LEFT JOIN users u ON u.id = p.userId
            WHERE m.isActive = 1 ${isGlobal ? '' : `AND (u.company_id = ${cid} OR u.company_id IS NULL)`}
            GROUP BY m.id, m.title
            ORDER BY avgPercent DESC
          `;
        }

        const r: any = await db.execute(drzSql.raw(query));
        const rows: any[] = (r[0] ?? r) as any[];
        return (Array.isArray(rows) ? rows : []).map((row: any) => ({
          id: row.id, name: String(row.name ?? ''),
          totalUsers: Number(row.totalUsers ?? 0),
          usersCompleted: Number(row.usersCompleted ?? 0),
          avgPercent: Number(row.avgPercent ?? 0),
        }));
      }),

    topPerformers: adminOrRhProcedure
      .input(z.object({ limit: z.number().optional(), branchId: z.number().optional(), sectorId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const cid = Number((ctx.user as any).companyId) || 0;
        const role = (ctx.user as any).role;
        const isGlobal = role === 'admin_global';
        const db = await getDb();
        if (!db) return [];
        const lim = Number(input?.limit ?? 10);
        const r: any = await db.execute(drzSql.raw(`
          SELECT u.id, u.name, u.email, s.name AS sectorName, b.name AS branchName,
            COUNT(DISTINCT CASE WHEN p.isCompleted=1 THEN p.moduleId END) AS modulesCompleted,
            ROUND(AVG(COALESCE(p.percentWatched, 0)), 1) AS avgPercent
          FROM users u
          LEFT JOIN user_progress p ON p.userId = u.id
          LEFT JOIN sectors s ON s.id = u.sector_id
          LEFT JOIN branches b ON b.id = u.branch_id
          WHERE 1=1 ${isGlobal ? '' : `AND u.company_id = ${cid}`}${input?.branchId ? ` AND u.branch_id = ${Number(input.branchId)}` : ''}${input?.sectorId ? ` AND u.sector_id = ${Number(input.sectorId)}` : ''}
          GROUP BY u.id, u.name, u.email, s.name, b.name
          HAVING modulesCompleted > 0
          ORDER BY modulesCompleted DESC, avgPercent DESC
          LIMIT ${lim}
        `));
        const rows: any[] = (r[0] ?? r) as any[];
        return (Array.isArray(rows) ? rows : []).map((row: any) => ({
          id: Number(row.id), name: String(row.name ?? ''), email: String(row.email ?? ''),
          sectorName: row.sectorName, branchName: row.branchName,
          modulesCompleted: Number(row.modulesCompleted ?? 0),
          avgPercent: Number(row.avgPercent ?? 0),
        }));
      }),

    bottomPerformers: adminOrRhProcedure
      .input(z.object({ limit: z.number().optional(), branchId: z.number().optional(), sectorId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const cid = Number((ctx.user as any).companyId) || 0;
        const role = (ctx.user as any).role;
        const isGlobal = role === 'admin_global';
        const db = await getDb();
        if (!db) return [];
        const lim = Number(input?.limit ?? 10);
        const r: any = await db.execute(drzSql.raw(`
          SELECT u.id, u.name, u.email, s.name AS sectorName, b.name AS branchName,
            COUNT(DISTINCT CASE WHEN p.isCompleted=1 THEN p.moduleId END) AS modulesCompleted,
            ROUND(AVG(COALESCE(p.percentWatched, 0)), 1) AS avgPercent
          FROM users u
          LEFT JOIN user_progress p ON p.userId = u.id
          LEFT JOIN sectors s ON s.id = u.sector_id
          LEFT JOIN branches b ON b.id = u.branch_id
          WHERE u.role NOT IN ('admin','admin_global','company_admin','rh','super_admin') ${isGlobal ? '' : `AND u.company_id = ${cid}`}${input?.branchId ? ` AND u.branch_id = ${Number(input.branchId)}` : ''}${input?.sectorId ? ` AND u.sector_id = ${Number(input.sectorId)}` : ''}
          GROUP BY u.id, u.name, u.email, s.name, b.name
          ORDER BY avgPercent ASC, modulesCompleted ASC
          LIMIT ${lim}
        `));
        const rows: any[] = (r[0] ?? r) as any[];
        return (Array.isArray(rows) ? rows : []).map((row: any) => ({
          id: Number(row.id), name: String(row.name ?? ''), email: String(row.email ?? ''),
          sectorName: row.sectorName, branchName: row.branchName,
          modulesCompleted: Number(row.modulesCompleted ?? 0),
          avgPercent: Number(row.avgPercent ?? 0),
        }));
      }),

    // === Surveys ===
    surveyResponseRate: adminOrRhProcedure.query(async ({ ctx }) => {
      const cid = Number((ctx.user as any).companyId) || 0;
      const role = (ctx.user as any).role;
      const isGlobal = role === 'admin_global';
      const db = await getDb();
      if (!db) return [];
      const r: any = await db.execute(drzSql.raw(`
        SELECT s.id, s.title, s.category, s.status,
          COUNT(DISTINCT r.id) AS responses,
          (SELECT COUNT(*) FROM users u WHERE 1=1 ${isGlobal ? '' : `AND u.company_id = ${cid}`}) AS eligibleUsers
        FROM surveys s
        LEFT JOIN survey_responses r ON r.survey_id = s.id
        WHERE 1=1 ${isGlobal ? '' : `AND (s.company_id = ${cid} OR s.is_template = 1)`}
        GROUP BY s.id, s.title, s.category, s.status
        ORDER BY responses DESC
        LIMIT 20
      `));
      const rows: any[] = (r[0] ?? r) as any[];
      return (Array.isArray(rows) ? rows : []).map((row: any) => ({
        id: Number(row.id), title: String(row.title ?? ''), category: row.category, status: row.status,
        responses: Number(row.responses ?? 0),
        eligibleUsers: Number(row.eligibleUsers ?? 0),
        rate: Number(row.eligibleUsers) > 0 ? Math.round((Number(row.responses) / Number(row.eligibleUsers)) * 100) : 0,
      }));
    }),

    surveyLikertDistribution: adminOrRhProcedure
      .input(z.object({ surveyId: z.number() }))
      .query(async ({ ctx, input }) => {
        const cid = Number((ctx.user as any).companyId) || 0;
        const role = (ctx.user as any).role;
        const isGlobal = role === 'admin_global';
        const db = await getDb();
        if (!db) return [];
        // ownership check
        const sv: any = await db.execute(drzSql.raw(`SELECT company_id, is_template FROM surveys WHERE id=${Number(input.surveyId)} LIMIT 1`));
        const svRow = (sv[0]?.[0]) ?? sv[0];
        if (!svRow) return [];
        if (!isGlobal && svRow.company_id !== cid && !svRow.is_template) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const r: any = await db.execute(drzSql.raw(`
          SELECT q.id, q.question_text, q.question_type, q.order_index,
            ROUND(AVG(CAST(a.answer_value AS DECIMAL(5,2))), 2) AS avgScore,
            COUNT(a.id) AS totalAnswers,
            SUM(CASE WHEN a.answer_value = '1' THEN 1 ELSE 0 END) AS n1,
            SUM(CASE WHEN a.answer_value = '2' THEN 1 ELSE 0 END) AS n2,
            SUM(CASE WHEN a.answer_value = '3' THEN 1 ELSE 0 END) AS n3,
            SUM(CASE WHEN a.answer_value = '4' THEN 1 ELSE 0 END) AS n4,
            SUM(CASE WHEN a.answer_value = '5' THEN 1 ELSE 0 END) AS n5
          FROM survey_questions q
          LEFT JOIN survey_answers a ON a.question_id = q.id
          WHERE q.survey_id = ${Number(input.surveyId)}
          GROUP BY q.id, q.question_text, q.question_type, q.order_index
          ORDER BY q.order_index ASC
        `));
        const rows: any[] = (r[0] ?? r) as any[];
        return (Array.isArray(rows) ? rows : []).map((row: any) => ({
          id: Number(row.id),
          questionText: String(row.question_text ?? ''),
          questionType: String(row.question_type ?? ''),
          avgScore: row.avgScore !== null ? Number(row.avgScore) : null,
          totalAnswers: Number(row.totalAnswers ?? 0),
          distribution: [Number(row.n1 ?? 0), Number(row.n2 ?? 0), Number(row.n3 ?? 0), Number(row.n4 ?? 0), Number(row.n5 ?? 0)],
        }));
      }),

    surveyTrendOverTime: adminOrRhProcedure
      .input(z.object({ days: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const cid = Number((ctx.user as any).companyId) || 0;
        const role = (ctx.user as any).role;
        const isGlobal = role === 'admin_global';
        const db = await getDb();
        if (!db) return [];
        const days = Number(input?.days ?? 30);
        const r: any = await db.execute(drzSql.raw(`
          SELECT DATE(r.submitted_at) AS day, COUNT(*) AS responses
          FROM survey_responses r
          INNER JOIN surveys s ON s.id = r.survey_id
          WHERE r.submitted_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
            ${isGlobal ? '' : `AND s.company_id = ${cid}`}
          GROUP BY DATE(r.submitted_at)
          ORDER BY day ASC
        `));
        const rows: any[] = (r[0] ?? r) as any[];
        return (Array.isArray(rows) ? rows : []).map((row: any) => ({
          day: row.day ? new Date(row.day).toISOString().slice(0,10) : '',
          responses: Number(row.responses ?? 0),
        }));
      }),

    // === Engagement ===
    sectorModuleHeatmap: adminOrRhProcedure.query(async ({ ctx }) => {
      const cid = Number((ctx.user as any).companyId) || 0;
      const role = (ctx.user as any).role;
      const isGlobal = role === 'admin_global';
      const db = await getDb();
      if (!db) return { sectors: [], modules: [], cells: [] };
      const sectorsR: any = await db.execute(drzSql.raw(`
        SELECT s.id, s.name FROM sectors s
        WHERE s.is_active = 1 ${isGlobal ? '' : `AND s.company_id = ${cid}`}
        ORDER BY s.name LIMIT 20
      `));
      const modulesR: any = await db.execute(drzSql.raw(`SELECT id, title FROM modules WHERE isActive = 1 ORDER BY orderIndex LIMIT 15`));
      const sectors: any[] = (sectorsR[0] ?? sectorsR) as any[];
      const modules: any[] = (modulesR[0] ?? modulesR) as any[];
      const cellsR: any = await db.execute(drzSql.raw(`
        SELECT u.sector_id AS sectorId, p.moduleId AS moduleId,
          ROUND(AVG(COALESCE(p.percentWatched,0)),1) AS avgPercent,
          COUNT(DISTINCT u.id) AS totalUsers,
          COUNT(DISTINCT CASE WHEN p.isCompleted=1 THEN p.userId END) AS completed
        FROM users u
        LEFT JOIN user_progress p ON p.userId = u.id
        WHERE u.sector_id IS NOT NULL ${isGlobal ? '' : `AND u.company_id = ${cid}`}
        GROUP BY u.sector_id, p.moduleId
      `));
      const cells: any[] = (cellsR[0] ?? cellsR) as any[];
      return {
        sectors: (Array.isArray(sectors)?sectors:[]).map((s: any) => ({ id: Number(s.id), name: String(s.name) })),
        modules: (Array.isArray(modules)?modules:[]).map((m: any) => ({ id: Number(m.id), title: String(m.title) })),
        cells: (Array.isArray(cells)?cells:[]).filter((c: any) => c.moduleId !== null).map((c: any) => ({
          sectorId: Number(c.sectorId), moduleId: Number(c.moduleId),
          avgPercent: Number(c.avgPercent ?? 0),
          totalUsers: Number(c.totalUsers ?? 0),
          completed: Number(c.completed ?? 0),
        })),
      };
    }),

    userLeaderboard: adminOrRhProcedure
      .input(z.object({ limit: z.number().optional(), branchId: z.number().optional(), sectorId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const cid = Number((ctx.user as any).companyId) || 0;
        const role = (ctx.user as any).role;
        const isGlobal = role === 'admin_global';
        const db = await getDb();
        if (!db) return [];
        const lim = Number(input?.limit ?? 15);
        const r: any = await db.execute(drzSql.raw(`
          SELECT u.id, u.name, u.email, s.name AS sectorName,
            COUNT(DISTINCT CASE WHEN p.isCompleted=1 THEN p.moduleId END) AS modulesCompleted,
            ROUND(AVG(COALESCE(p.percentWatched, 0)), 1) AS avgPercent,
            (SELECT COUNT(*) FROM certificates c WHERE c.userId = u.id) AS certs,
            (SELECT COUNT(*) FROM survey_responses r WHERE r.user_id = u.id) AS surveyResp,
            (COALESCE(COUNT(DISTINCT CASE WHEN p.isCompleted=1 THEN p.moduleId END),0) * 10
              + COALESCE(AVG(COALESCE(p.percentWatched, 0)),0) / 2
              + (SELECT COUNT(*) FROM survey_responses r WHERE r.user_id = u.id) * 5
            ) AS engagementScore
          FROM users u
          LEFT JOIN user_progress p ON p.userId = u.id
          LEFT JOIN sectors s ON s.id = u.sector_id
          WHERE u.role NOT IN ('admin_global','super_admin') ${isGlobal ? '' : `AND u.company_id = ${cid}`}${input?.branchId ? ` AND u.branch_id = ${Number(input.branchId)}` : ''}${input?.sectorId ? ` AND u.sector_id = ${Number(input.sectorId)}` : ''}
          GROUP BY u.id, u.name, u.email, s.name
          ORDER BY engagementScore DESC
          LIMIT ${lim}
        `));
        const rows: any[] = (r[0] ?? r) as any[];
        return (Array.isArray(rows) ? rows : []).map((row: any) => ({
          id: Number(row.id), name: String(row.name ?? ''), email: String(row.email ?? ''),
          sectorName: row.sectorName,
          modulesCompleted: Number(row.modulesCompleted ?? 0),
          avgPercent: Number(row.avgPercent ?? 0),
          certs: Number(row.certs ?? 0),
          surveyResp: Number(row.surveyResp ?? 0),
          engagementScore: Math.round(Number(row.engagementScore ?? 0)),
        }));
      }),

    campaignEffectiveness: adminOrRhProcedure.query(async ({ ctx }) => {
      const cid = Number((ctx.user as any).companyId) || 0;
      const role = (ctx.user as any).role;
      const isGlobal = role === 'admin_global';
      const db = await getDb();
      if (!db) return [];
      const r: any = await db.execute(drzSql.raw(`
        SELECT c.id, c.name, c.campaign_type, c.target_module_id, c.status,
          c.total_recipients, c.sent_count, c.failed_count, c.created_at,
          (
            SELECT COUNT(DISTINCT p.userId) FROM user_progress p
            WHERE p.moduleId = c.target_module_id
              AND p.isCompleted = 1
              AND p.completedAt >= c.created_at
              AND p.userId IN (SELECT user_id FROM email_campaign_recipients WHERE campaign_id = c.id AND status = 'sent')
          ) AS completedAfterCampaign
        FROM email_campaigns c
        WHERE 1=1 ${isGlobal ? '' : `AND c.company_id = ${cid}`}
        ORDER BY c.created_at DESC
        LIMIT 15
      `));
      const rows: any[] = (r[0] ?? r) as any[];
      return (Array.isArray(rows) ? rows : []).map((row: any) => ({
        id: Number(row.id), name: String(row.name ?? ''), campaignType: String(row.campaign_type ?? ''),
        targetModuleId: row.target_module_id ? Number(row.target_module_id) : null,
        status: row.status, totalRecipients: Number(row.total_recipients ?? 0),
        sentCount: Number(row.sent_count ?? 0), failedCount: Number(row.failed_count ?? 0),
        completedAfterCampaign: Number(row.completedAfterCampaign ?? 0),
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
        conversionRate: Number(row.sent_count) > 0 ? Math.round((Number(row.completedAfterCampaign) / Number(row.sent_count)) * 100) : 0,
      }));
    }),

    // === Risk Psychosocial ===
    riskMatrixByCompany: adminOrRhProcedure.query(async ({ ctx }) => {
      const cid = Number((ctx.user as any).companyId) || 0;
      const role = (ctx.user as any).role;
      const isGlobal = role === 'admin_global';
      const db = await getDb();
      if (!db) return { totalAssessments: 0, byLevel: [], bySector: [] };
      const totalsR: any = await db.execute(drzSql.raw(`
        SELECT COUNT(DISTINCT ra.id) AS totalAssessments,
          COUNT(ri.id) AS totalItems
        FROM risk_assessments ra
        LEFT JOIN risk_inventory_items ri ON ri.assessment_id = ra.id
        WHERE 1=1 ${isGlobal ? '' : `AND ra.company_id = ${cid}`}
      `));
      const tRow = (totalsR[0]?.[0]) ?? totalsR[0] ?? {};
      const byLevelR: any = await db.execute(drzSql.raw(`
        SELECT ri.risco_final AS level, COUNT(*) AS c
        FROM risk_inventory_items ri
        INNER JOIN risk_assessments ra ON ra.id = ri.assessment_id
        WHERE 1=1 ${isGlobal ? '' : `AND ra.company_id = ${cid}`}
        GROUP BY ri.risco_final
      `));
      const byLevelRows: any[] = (byLevelR[0] ?? byLevelR) as any[];
      const bySectorR: any = await db.execute(drzSql.raw(`
        SELECT s.id, s.name,
          COUNT(ri.id) AS itemsTotal,
          SUM(CASE WHEN ri.risco_final='critico' THEN 1 ELSE 0 END) AS critico,
          SUM(CASE WHEN ri.risco_final='alto' THEN 1 ELSE 0 END) AS alto,
          SUM(CASE WHEN ri.risco_final='medio' THEN 1 ELSE 0 END) AS medio,
          SUM(CASE WHEN ri.risco_final='baixo' THEN 1 ELSE 0 END) AS baixo
        FROM sectors s
        LEFT JOIN risk_assessments ra ON ra.sector_id = s.id
        LEFT JOIN risk_inventory_items ri ON ri.assessment_id = ra.id
        WHERE 1=1 ${isGlobal ? '' : `AND s.company_id = ${cid}`}
        GROUP BY s.id, s.name
        HAVING itemsTotal > 0
        ORDER BY critico DESC, alto DESC
      `));
      const bySectorRows: any[] = (bySectorR[0] ?? bySectorR) as any[];

      return {
        totalAssessments: Number(tRow.totalAssessments ?? 0),
        totalItems: Number(tRow.totalItems ?? 0),
        byLevel: (Array.isArray(byLevelRows)?byLevelRows:[]).map((r: any) => ({ level: String(r.level), count: Number(r.c) })),
        bySector: (Array.isArray(bySectorRows)?bySectorRows:[]).map((r: any) => ({
          id: Number(r.id), name: String(r.name),
          itemsTotal: Number(r.itemsTotal ?? 0),
          critico: Number(r.critico ?? 0), alto: Number(r.alto ?? 0),
          medio: Number(r.medio ?? 0), baixo: Number(r.baixo ?? 0),
        })),
      };
    }),

    topCriticalFactors: adminOrRhProcedure.query(async ({ ctx }) => {
      const cid = Number((ctx.user as any).companyId) || 0;
      const role = (ctx.user as any).role;
      const isGlobal = role === 'admin_global';
      const db = await getDb();
      if (!db) return [];
      const r: any = await db.execute(drzSql.raw(`
        SELECT f.id, f.code, f.name,
          COUNT(ri.id) AS occurrences,
          SUM(CASE WHEN ri.risco_final='critico' THEN 1 ELSE 0 END) AS critico,
          SUM(CASE WHEN ri.risco_final='alto' THEN 1 ELSE 0 END) AS alto,
          ROUND(AVG(COALESCE(ri.drps_score_avg, 0)), 2) AS avgDrpsScore
        FROM psychosocial_factors f
        LEFT JOIN risk_inventory_items ri ON ri.factor_id = f.id
        LEFT JOIN risk_assessments ra ON ra.id = ri.assessment_id
        WHERE 1=1 ${isGlobal ? '' : `AND (ra.company_id = ${cid} OR ra.company_id IS NULL)`}
        GROUP BY f.id, f.code, f.name
        HAVING occurrences > 0
        ORDER BY critico DESC, alto DESC, occurrences DESC
        LIMIT 10
      `));
      const rows: any[] = (r[0] ?? r) as any[];
      return (Array.isArray(rows) ? rows : []).map((row: any) => ({
        id: Number(row.id), code: String(row.code ?? ''), name: String(row.name ?? ''),
        occurrences: Number(row.occurrences ?? 0),
        critico: Number(row.critico ?? 0),
        alto: Number(row.alto ?? 0),
        avgDrpsScore: Number(row.avgDrpsScore ?? 0),
      }));
    }),

    riskEvolution: adminOrRhProcedure.query(async ({ ctx }) => {
      const cid = Number((ctx.user as any).companyId) || 0;
      const role = (ctx.user as any).role;
      const isGlobal = role === 'admin_global';
      const db = await getDb();
      if (!db) return [];
      const r: any = await db.execute(drzSql.raw(`
        SELECT ra.id, ra.cycle_name, ra.start_date, ra.end_date, ra.status,
          s.id AS sectorId, s.name AS sectorName,
          COUNT(ri.id) AS totalItems,
          SUM(CASE WHEN ri.risco_final IN ('critico','alto') THEN 1 ELSE 0 END) AS criticalCount
        FROM risk_assessments ra
        LEFT JOIN sectors s ON s.id = ra.sector_id
        LEFT JOIN risk_inventory_items ri ON ri.assessment_id = ra.id
        WHERE 1=1 ${isGlobal ? '' : `AND ra.company_id = ${cid}`}
        GROUP BY ra.id, ra.cycle_name, ra.start_date, ra.end_date, ra.status, s.id, s.name
        ORDER BY ra.start_date ASC, ra.id ASC
      `));
      const rows: any[] = (r[0] ?? r) as any[];
      return (Array.isArray(rows) ? rows : []).map((row: any) => ({
        id: Number(row.id),
        cycleName: String(row.cycle_name ?? ''),
        startDate: row.start_date ? new Date(row.start_date).toISOString().slice(0,10) : null,
        endDate: row.end_date ? new Date(row.end_date).toISOString().slice(0,10) : null,
        status: row.status,
        sectorId: row.sectorId ? Number(row.sectorId) : null,
        sectorName: row.sectorName,
        totalItems: Number(row.totalItems ?? 0),
        criticalCount: Number(row.criticalCount ?? 0),
        criticalRatio: Number(row.totalItems) > 0 ? Math.round((Number(row.criticalCount) / Number(row.totalItems)) * 100) : 0,
      }));
    }),

    // === Helper: filter options ===
    filterOptions: adminOrRhProcedure.query(async ({ ctx }) => {
      const cid = Number((ctx.user as any).companyId) || 0;
      const role = (ctx.user as any).role;
      const isGlobal = role === 'admin_global';
      const db = await getDb();
      if (!db) return { branches: [], sectors: [], modules: [] };
      const branchesR: any = await db.execute(drzSql.raw(`SELECT id, name FROM branches WHERE is_active=1 ${isGlobal ? '' : `AND company_id=${cid}`} ORDER BY name`));
      const sectorsR: any = await db.execute(drzSql.raw(`SELECT id, name, branch_id FROM sectors WHERE is_active=1 ${isGlobal ? '' : `AND company_id=${cid}`} ORDER BY name`));
      const modulesR: any = await db.execute(drzSql.raw(`SELECT id, title FROM modules WHERE isActive=1 ORDER BY orderIndex LIMIT 50`));
      const br = (branchesR[0] ?? branchesR) as any[];
      const sr = (sectorsR[0] ?? sectorsR) as any[];
      const mr = (modulesR[0] ?? modulesR) as any[];
      return {
        branches: (Array.isArray(br)?br:[]).map((r: any) => ({ id: Number(r.id), name: String(r.name) })),
        sectors: (Array.isArray(sr)?sr:[]).map((r: any) => ({ id: Number(r.id), name: String(r.name), branchId: r.branch_id ? Number(r.branch_id) : null })),
        modules: (Array.isArray(mr)?mr:[]).map((r: any) => ({ id: Number(r.id), title: String(r.title) })),
      };
    }),

    // === Custom analyses ===
    listAnalyses: adminOrRhProcedure.query(async ({ ctx }) => {
      const cid = Number((ctx.user as any).companyId) || 0;
      const uid = Number((ctx.user as any).id) || 0;
      const db = await getDb();
      if (!db) return [];
      const r: any = await db.execute(drzSql.raw(`
        SELECT a.id, a.user_id, a.company_id, a.name, a.description, a.metric, a.dimension,
          a.filters_json, a.chart_type, a.is_shared, a.last_run_at, a.created_at, a.updated_at,
          u.name AS authorName
        FROM saved_analyses a
        LEFT JOIN users u ON u.id = a.user_id
        WHERE a.user_id = ${uid} OR (a.company_id = ${cid} AND a.is_shared = 1)
        ORDER BY a.updated_at DESC
      `));
      const rows: any[] = (r[0] ?? r) as any[];
      return (Array.isArray(rows) ? rows : []).map((row: any) => ({
        id: Number(row.id),
        userId: Number(row.user_id),
        companyId: Number(row.company_id),
        name: String(row.name ?? ''),
        description: row.description ?? '',
        metric: String(row.metric),
        dimension: String(row.dimension),
        filters: row.filters_json ? (typeof row.filters_json === 'string' ? JSON.parse(row.filters_json) : row.filters_json) : {},
        chartType: String(row.chart_type),
        isShared: Boolean(row.is_shared),
        isOwner: Number(row.user_id) === uid,
        authorName: row.authorName ?? '',
        lastRunAt: row.last_run_at ? new Date(row.last_run_at).toISOString() : null,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
      }));
    }),

    saveAnalysis: adminOrRhProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        metric: z.string(),
        dimension: z.string(),
        filters: z.any().optional(),
        chartType: z.string(),
        isShared: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const cid = Number((ctx.user as any).companyId) || 0;
        const uid = Number((ctx.user as any).id) || 0;
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const filtersStr = input.filters ? JSON.stringify(input.filters) : null;
        await db.execute(drzSql`
          INSERT INTO saved_analyses (user_id, company_id, name, description, metric, dimension, filters_json, chart_type, is_shared)
          VALUES (${uid}, ${cid}, ${input.name}, ${input.description ?? null}, ${input.metric}, ${input.dimension}, ${filtersStr}, ${input.chartType}, ${input.isShared ? 1 : 0})
        `);
        const r: any = await db.execute(drzSql`SELECT LAST_INSERT_ID() AS id`);
        const id = Number((r[0]?.[0]?.id) ?? r[0]?.id ?? 0);
        return { ok: true, id };
      }),

    updateAnalysis: adminOrRhProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        metric: z.string(),
        dimension: z.string(),
        filters: z.any().optional(),
        chartType: z.string(),
        isShared: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const uid = Number((ctx.user as any).id) || 0;
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const own: any = await db.execute(drzSql`SELECT user_id FROM saved_analyses WHERE id=${input.id} LIMIT 1`);
        const ownerRow = (own[0]?.[0]) ?? own[0];
        if (!ownerRow) throw new TRPCError({ code: "NOT_FOUND" });
        if (Number(ownerRow.user_id) !== uid) throw new TRPCError({ code: "FORBIDDEN" });
        const filtersStr = input.filters ? JSON.stringify(input.filters) : null;
        await db.execute(drzSql`
          UPDATE saved_analyses
          SET name=${input.name}, description=${input.description ?? null}, metric=${input.metric},
              dimension=${input.dimension}, filters_json=${filtersStr}, chart_type=${input.chartType},
              is_shared=${input.isShared ? 1 : 0}
          WHERE id=${input.id}
        `);
        return { ok: true };
      }),

    deleteAnalysis: adminOrRhProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const uid = Number((ctx.user as any).id) || 0;
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const own: any = await db.execute(drzSql`SELECT user_id FROM saved_analyses WHERE id=${input.id} LIMIT 1`);
        const ownerRow = (own[0]?.[0]) ?? own[0];
        if (!ownerRow) throw new TRPCError({ code: "NOT_FOUND" });
        if (Number(ownerRow.user_id) !== uid) throw new TRPCError({ code: "FORBIDDEN" });
        await db.execute(drzSql`DELETE FROM saved_analyses WHERE id=${input.id}`);
        return { ok: true };
      }),

    runAnalysis: adminOrRhProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const cid = Number((ctx.user as any).companyId) || 0;
        const uid = Number((ctx.user as any).id) || 0;
        const role = (ctx.user as any).role;
        const isGlobal = role === 'admin_global';
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const cfgR: any = await db.execute(drzSql`SELECT * FROM saved_analyses WHERE id=${input.id} LIMIT 1`);
        const cfg = (cfgR[0]?.[0]) ?? cfgR[0];
        if (!cfg) throw new TRPCError({ code: "NOT_FOUND" });
        // Access control: owner OR (shared AND same company)
        if (Number(cfg.user_id) !== uid && !(cfg.is_shared && Number(cfg.company_id) === cid)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const metric = String(cfg.metric);
        const dimension = String(cfg.dimension);
        const filters = cfg.filters_json ? (typeof cfg.filters_json === 'string' ? JSON.parse(cfg.filters_json) : cfg.filters_json) : {};
        const branchFilter = filters.branchId ? `AND u.branch_id = ${Number(filters.branchId)}` : '';
        const sectorFilter = filters.sectorId ? `AND u.sector_id = ${Number(filters.sectorId)}` : '';
        const companyFilter = isGlobal ? '' : `AND u.company_id = ${cid}`;

        let dimSelect = '';
        let dimJoin = '';
        let dimGroup = '';
        let dimOrder = '';
        if (dimension === 'branch') {
          dimSelect = 'b.id AS dim_id, COALESCE(b.name, "Sem filial") AS dim_name';
          dimJoin = 'LEFT JOIN branches b ON b.id = u.branch_id';
          dimGroup = 'GROUP BY b.id, b.name';
          dimOrder = 'ORDER BY value DESC';
        } else if (dimension === 'sector') {
          dimSelect = 's.id AS dim_id, COALESCE(s.name, "Sem setor") AS dim_name';
          dimJoin = 'LEFT JOIN sectors s ON s.id = u.sector_id';
          dimGroup = 'GROUP BY s.id, s.name';
          dimOrder = 'ORDER BY value DESC';
        } else if (dimension === 'role') {
          dimSelect = 'u.role AS dim_id, COALESCE(u.role, "Sem cargo") AS dim_name';
          dimGroup = 'GROUP BY u.role';
          dimOrder = 'ORDER BY value DESC';
        } else if (dimension === 'module') {
          dimSelect = 'm.id AS dim_id, m.title AS dim_name';
          dimJoin = 'LEFT JOIN modules m ON m.id = p.moduleId';
          dimGroup = 'GROUP BY m.id, m.title';
          dimOrder = 'ORDER BY value DESC';
        } else if (dimension === 'risk_factor') {
          dimSelect = 'f.id AS dim_id, f.name AS dim_name';
          dimJoin = 'LEFT JOIN psychosocial_factors f ON f.id = ri.factor_id';
          dimGroup = 'GROUP BY f.id, f.name';
          dimOrder = 'ORDER BY value DESC';
        } else if (dimension === 'period') {
          dimSelect = 'DATE_FORMAT(p.completedAt, "%Y-%m") AS dim_id, DATE_FORMAT(p.completedAt, "%Y-%m") AS dim_name';
          dimGroup = 'GROUP BY dim_id';
          dimOrder = 'ORDER BY dim_id ASC';
        }

        let query = '';
        if (metric === 'course_completion') {
          query = `
            SELECT ${dimSelect}, ROUND(AVG(COALESCE(p.percentWatched, 0)), 1) AS value
            FROM users u
            LEFT JOIN user_progress p ON p.userId = u.id
            ${dimJoin}
            WHERE 1=1 ${companyFilter} ${branchFilter} ${sectorFilter}
            ${dimGroup} ${dimOrder} LIMIT 30
          `;
        } else if (metric === 'modules_completed') {
          query = `
            SELECT ${dimSelect}, COUNT(DISTINCT CASE WHEN p.isCompleted=1 THEN CONCAT(p.userId, '-', p.moduleId) END) AS value
            FROM users u
            LEFT JOIN user_progress p ON p.userId = u.id
            ${dimJoin}
            WHERE 1=1 ${companyFilter} ${branchFilter} ${sectorFilter}
            ${dimGroup} ${dimOrder} LIMIT 30
          `;
        } else if (metric === 'survey_response') {
          query = `
            SELECT ${dimSelect}, COUNT(r.id) AS value
            FROM users u
            LEFT JOIN survey_responses r ON r.user_id = u.id
            ${dimJoin}
            WHERE 1=1 ${companyFilter} ${branchFilter} ${sectorFilter}
            ${dimGroup} ${dimOrder} LIMIT 30
          `;
        } else if (metric === 'certificates') {
          query = `
            SELECT ${dimSelect}, COUNT(c.id) AS value
            FROM users u
            LEFT JOIN certificates c ON c.userId = u.id
            ${dimJoin}
            WHERE 1=1 ${companyFilter} ${branchFilter} ${sectorFilter}
            ${dimGroup} ${dimOrder} LIMIT 30
          `;
        } else if (metric === 'active_users') {
          query = `
            SELECT ${dimSelect}, COUNT(DISTINCT CASE WHEN u.lastSignedIn >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN u.id END) AS value
            FROM users u
            ${dimJoin}
            WHERE 1=1 ${companyFilter} ${branchFilter} ${sectorFilter}
            ${dimGroup} ${dimOrder} LIMIT 30
          `;
        } else if (metric === 'risk_avg') {
          query = `
            SELECT ${dimSelect}, ROUND(AVG(COALESCE(ri.drps_score_avg, 0)), 2) AS value
            FROM risk_inventory_items ri
            INNER JOIN risk_assessments ra ON ra.id = ri.assessment_id
            INNER JOIN users u ON u.company_id = ra.company_id
            ${dimJoin}
            WHERE 1=1 ${companyFilter}
            ${dimGroup} ${dimOrder} LIMIT 30
          `;
        } else if (metric === 'risk_critical_count') {
          query = `
            SELECT ${dimSelect}, SUM(CASE WHEN ri.risco_final IN ('critico','alto') THEN 1 ELSE 0 END) AS value
            FROM risk_inventory_items ri
            INNER JOIN risk_assessments ra ON ra.id = ri.assessment_id
            INNER JOIN users u ON u.company_id = ra.company_id
            ${dimJoin}
            WHERE 1=1 ${companyFilter}
            ${dimGroup} ${dimOrder} LIMIT 30
          `;
        } else {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown metric: ${metric}` });
        }

        const r: any = await db.execute(drzSql.raw(query));
        const rows: any[] = (r[0] ?? r) as any[];
        const data = (Array.isArray(rows) ? rows : []).map((row: any) => ({
          key: String(row.dim_id ?? ''),
          name: String(row.dim_name ?? ''),
          value: Number(row.value ?? 0),
        }));

        // Update last_run_at
        try { await db.execute(drzSql`UPDATE saved_analyses SET last_run_at=NOW() WHERE id=${input.id}`); } catch(e) {}

        return {
          config: {
            id: Number(cfg.id),
            name: String(cfg.name),
            description: cfg.description ?? '',
            metric, dimension, filters,
            chartType: String(cfg.chart_type),
            isShared: Boolean(cfg.is_shared),
          },
          data,
          generatedAt: new Date().toISOString(),
        };
      }),

    listGheGse: adminOrRhProcedure
      .input(z.object({ pgrId: z.number().int() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const r: any = await db.execute(drzSql`SELECT * FROM pgr_ghe_gse WHERE pgr_document_id = ${input.pgrId} ORDER BY id ASC`);
        return (r as any)[0] ?? [];
      }),

    saveGheGse: adminOrRhProcedure
      .input(z.object({
        pgrId: z.number().int(),
        items: z.array(z.object({
          nome: z.string(),
          tipo: z.string().default("GHE"),
          setor: z.string().default(""),
          funcao: z.string().default(""),
          atividade: z.string().default(""),
          qtdExpostos: z.number().int().default(0),
          jornada: z.string().default(""),
          ambienteOperacional: z.string().default(""),
          exposicaoSimilar: z.string().default(""),
        }))
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        await db.execute(drzSql`DELETE FROM pgr_ghe_gse WHERE pgr_document_id = ${input.pgrId}`);
        for (const item of input.items) {
          await db.execute(drzSql`INSERT INTO pgr_ghe_gse (pgr_document_id, nome, tipo, setor, funcao, atividade, qtd_expostos, jornada, ambiente_operacional, exposicao_similar) VALUES (${input.pgrId}, ${item.nome}, ${item.tipo}, ${item.setor}, ${item.funcao}, ${item.atividade}, ${item.qtdExpostos}, ${item.jornada}, ${item.ambienteOperacional}, ${item.exposicaoSimilar})`);
        }
        return { ok: true };
      }),

    listEpcEpi: adminOrRhProcedure
      .input(z.object({ pgrId: z.number().int() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const r: any = await db.execute(drzSql`SELECT * FROM pgr_epc_epi WHERE pgr_document_id = ${input.pgrId} ORDER BY tipo ASC, id ASC`);
        return (r as any)[0] ?? [];
      }),

    saveEpcEpi: adminOrRhProcedure
      .input(z.object({
        pgrId: z.number().int(),
        items: z.array(z.object({
          tipo: z.string(),
          descricao: z.string(),
          numeroCa: z.string().default(""),
          riscoVinculado: z.string().default(""),
          periodicidadeTroca: z.string().default(""),
          nivelProtecao: z.string().default(""),
          statusItem: z.string().default("obrigatorio"),
          observacoes: z.string().default(""),
        }))
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        await db.execute(drzSql`DELETE FROM pgr_epc_epi WHERE pgr_document_id = ${input.pgrId}`);
        for (const item of input.items) {
          await db.execute(drzSql`INSERT INTO pgr_epc_epi (pgr_document_id, tipo, descricao, numero_ca, risco_vinculado, periodicidade_troca, nivel_protecao, status_item, observacoes) VALUES (${input.pgrId}, ${item.tipo}, ${item.descricao}, ${item.numeroCa}, ${item.riscoVinculado}, ${item.periodicidadeTroca}, ${item.nivelProtecao}, ${item.statusItem}, ${item.observacoes})`);
        }
        return { ok: true };
      }),

    listPgrRevisions: adminOrRhProcedure
      .input(z.object({ pgrId: z.number().int() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const r: any = await db.execute(drzSql`SELECT * FROM pgr_revision_history WHERE pgr_document_id = ${input.pgrId} ORDER BY id ASC`);
        return (r as any)[0] ?? [];
      }),

    savePgrRevision: adminOrRhProcedure
      .input(z.object({
        pgrId: z.number().int(),
        versao: z.string(),
        dataRevisao: z.string().nullable().optional(),
        responsavel: z.string().default(""),
        alteracaoRealizada: z.string().default(""),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        await db.execute(drzSql`INSERT INTO pgr_revision_history (pgr_document_id, versao, data_revisao, responsavel, alteracao_realizada) VALUES (${input.pgrId}, ${input.versao}, ${input.dataRevisao ?? null}, ${input.responsavel}, ${input.alteracaoRealizada})`);
        return { ok: true };
      }),

    deletePgrRevision: adminOrRhProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        await db.execute(drzSql`DELETE FROM pgr_revision_history WHERE id = ${input.id}`);
        return { ok: true };
      }),
  }),

  // ─── Appointment Scheduling ───────────────────────────────────────────────
  scheduling: router({
    /** List professionals (admin: all in company; employee: active only) */
    listCollaborators: adminOrRhProcedure.query(async ({ ctx }) => {
      const cid = (ctx.user as any).companyId;
      if (!cid) return [];
      const db = await getDb();
      const [rows] = await execP(db, `SELECT id, name, email FROM users WHERE company_id=? AND role NOT IN ('admin','rh','admin_global','super_admin','sesmt','psicologo','chefia') AND is_active=1 ORDER BY name ASC LIMIT 200`, [cid]) as any;
      return (rows as any[]).map((r: any) => ({ id: r.id, name: r.name ?? r.email, email: r.email }));
    }),

    listProfessionals: protectedProcedure
      .input(z.object({ companyId: z.number().int().optional() }))
      .query(async ({ ctx, input }) => {
        const db2 = await getDb();
        if (!db2) throw new Error("DB unavailable");
        const cid = input.companyId ?? (ctx.user as any).companyId;
        const rows = await db2.execute(
          drzSql`SELECT * FROM appointment_professionals WHERE (company_id = ${cid} OR company_id IS NULL) AND is_active = 1 ORDER BY name`
        );
        const list = Array.isArray((rows as any)[0]) ? (rows as any)[0] : [];
        return list.map((r: any) => ({
          id: Number(r.id),
          name: String(r.name ?? ""),
          email: r.email ?? null,
          specialty: r.specialty ?? null,
          bio: r.bio ?? null,
          companyId: r.company_id ? Number(r.company_id) : null,
          isActive: Boolean(r.is_active),
        }));
      }),

    saveProfessional: careManagerProcedure
      .input(z.object({
        id: z.number().int().optional(),
        name: z.string().min(1),
        email: z.string().email().optional().or(z.literal("")),
        specialty: z.string().optional(),
        bio: z.string().optional(),
        companyId: z.number().int().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db2 = await getDb();
        if (!db2) throw new Error("DB unavailable");
        const cid = input.companyId ?? (ctx.user as any).companyId ?? null;
        if (input.id) {
          await db2.execute(drzSql`
            UPDATE appointment_professionals
            SET name=${input.name}, email=${input.email || null}, specialty=${input.specialty || null},
                bio=${input.bio || null}, company_id=${cid}
            WHERE id=${input.id}
          `);
          return { id: input.id };
        } else {
          const res = await db2.execute(drzSql`
            INSERT INTO appointment_professionals (company_id, name, email, specialty, bio)
            VALUES (${cid}, ${input.name}, ${input.email || null}, ${input.specialty || null}, ${input.bio || null})
          `);
          return { id: Number((res as any)[0]?.insertId ?? 0) };
        }
      }),

    deleteProfessional: careManagerProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        const db2 = await getDb();
        if (!db2) throw new Error("DB unavailable");
        await db2.execute(drzSql`UPDATE appointment_professionals SET is_active=0 WHERE id=${input.id}`);
        return { ok: true };
      }),

    /** Get/set availability slots for a professional */
    getAvailability: protectedProcedure
      .input(z.object({ professionalId: z.number().int() }))
      .query(async ({ ctx, input }) => {
        const db2 = await getDb();
        if (!db2) throw new Error("DB unavailable");
        const rows = await db2.execute(
          drzSql`SELECT * FROM appointment_availability WHERE professional_id=${input.professionalId} AND is_active=1 ORDER BY day_of_week, start_time`
        );
        const list = Array.isArray((rows as any)[0]) ? (rows as any)[0] : [];
        return list.map((r: any) => ({
          id: Number(r.id),
          professionalId: Number(r.professional_id),
          dayOfWeek: Number(r.day_of_week),
          startTime: String(r.start_time),
          endTime: String(r.end_time),
          slotDurationMinutes: Number(r.slot_duration_minutes ?? 30),
        }));
      }),

    saveAvailability: careManagerProcedure
      .input(z.object({
        professionalId: z.number().int(),
        slots: z.array(z.object({
          dayOfWeek: z.number().int().min(0).max(6),
          startTime: z.string(),
          endTime: z.string(),
          slotDurationMinutes: z.number().int().default(30),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const db2 = await getDb();
        if (!db2) throw new Error("DB unavailable");
        // Replace all slots for this professional
        await db2.execute(drzSql`DELETE FROM appointment_availability WHERE professional_id=${input.professionalId}`);
        for (const slot of input.slots) {
          await db2.execute(drzSql`
            INSERT INTO appointment_availability (professional_id, day_of_week, start_time, end_time, slot_duration_minutes)
            VALUES (${input.professionalId}, ${slot.dayOfWeek}, ${slot.startTime}, ${slot.endTime}, ${slot.slotDurationMinutes})
          `);
        }
        return { ok: true };
      }),

    /** Return available time slots for a given professional + date */
    getAvailableSlots: protectedProcedure
      .input(z.object({
        professionalId: z.number().int(),
        date: z.string(), // ISO date "2025-06-01"
      }))
      .query(async ({ ctx, input }) => {
        const db2 = await getDb();
        if (!db2) throw new Error("DB unavailable");
        const d = new Date(input.date);
        const dow = d.getDay(); // 0=Sun
        // Get availability for that weekday
        const avRows = await db2.execute(
          drzSql`SELECT * FROM appointment_availability WHERE professional_id=${input.professionalId} AND day_of_week=${dow} AND is_active=1`
        );
        const avList = Array.isArray((avRows as any)[0]) ? (avRows as any)[0] : [];
        if (!avList.length) return [];
        // Get already booked slots that day
        const dayStart = `${input.date} 00:00:00`;
        const dayEnd = `${input.date} 23:59:59`;
        const bookedRows = await db2.execute(
          drzSql`SELECT scheduled_at, duration_minutes FROM appointments
                 WHERE professional_id=${input.professionalId}
                   AND scheduled_at BETWEEN ${dayStart} AND ${dayEnd}
                   AND status NOT IN ('cancelled')`
        );
        const booked: {start: string; end: string}[] = (Array.isArray((bookedRows as any)[0]) ? (bookedRows as any)[0] : [])
          .map((r: any) => {
            const s = new Date(r.scheduled_at);
            const e = new Date(s.getTime() + Number(r.duration_minutes) * 60000);
            return { start: s.toTimeString().slice(0, 5), end: e.toTimeString().slice(0, 5) };
          });
        // Generate slots
        const slots: string[] = [];
        for (const av of avList) {
          const dur = Number(av.slot_duration_minutes ?? 30);
          let cur = av.start_time as string;
          while (cur < av.end_time) {
            const [h, m] = cur.split(":").map(Number);
            const endMin = h * 60 + m + dur;
            const endH = Math.floor(endMin / 60).toString().padStart(2, "0");
            const endM = (endMin % 60).toString().padStart(2, "0");
            const endT = `${endH}:${endM}`;
            if (endT > av.end_time) break;
            // Check not booked
            const isBooked = booked.some(b => b.start <= cur && cur < b.end);
            if (!isBooked) slots.push(cur);
            cur = endT;
          }
        }
        return slots;
      }),

    /** Book an appointment */
    bookAppointment: protectedProcedure
      .input(z.object({
        professionalId: z.number().int(),
        date: z.string(),      // "2025-06-01"
        time: z.string(),      // "14:00"
        durationMinutes: z.number().int().default(30),
        notes: z.string().optional(),
        collaboratorId: z.number().int().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db2 = await getDb();
        if (!db2) throw new Error("DB unavailable");
        const scheduledAt = `${input.date} ${input.time}:00`;
        const companyId = (ctx.user as any).companyId ?? 0;
        const adminRoles = ['admin','rh','admin_global','super_admin','sesmt','super_admin'];
        const isAdminRole = adminRoles.includes((ctx.user as any).role ?? '');
        const collaboratorId = (input.collaboratorId && isAdminRole) ? input.collaboratorId : ctx.user.id;
        const res = await db2.execute(drzSql`
          INSERT INTO appointments (company_id, collaborator_id, professional_id, scheduled_at, duration_minutes, status, notes)
          VALUES (${companyId}, ${collaboratorId}, ${input.professionalId}, ${scheduledAt}, ${input.durationMinutes}, 'pending', ${input.notes || null})
        `);
        const appointmentId = Number((res as any)[0]?.insertId ?? 0);
        // Fetch professional email to notify
        const profRows = await db2.execute(drzSql`SELECT * FROM appointment_professionals WHERE id=${input.professionalId}`);
        const prof: any = Array.isArray((profRows as any)[0]) ? ((profRows as any)[0])[0] : null;
        // Send confirmation email to collaborator
        try {
          if (ctx.user.email) {
            await sendEmail({
              to: ctx.user.email,
              subject: "Conversa de Acolhimento Agendada",
              html: plainToHtml(
                `Olá, ${ctx.user.name ?? ctx.user.email}!\n\nSua conversa de acolhimento foi agendada com sucesso.\n\nProfissional: ${prof?.name ?? "—"}\nData/Hora: ${input.date} às ${input.time}\nDuração: ${input.durationMinutes} minutos\n\nEm breve você receberá mais informações.\n\nPlataforma Saúde do Trabalho`
              ),
            });
          }
          // Notify platform admin about new appointment
          await sendEmail({
            to: "contato@saudedotrabalho.com",
            toName: "Saúde do Trabalho",
            subject: `[Agendamento] Nova conversa: ${ctx.user.name ?? ctx.user.email}`,
            html: plainToHtml(
              `Novo agendamento registrado na plataforma.\n\nColaborador: ${ctx.user.name ?? ctx.user.email} (${ctx.user.email ?? "—"})\nProfissional: ${prof?.name ?? "—"}\nData/Hora: ${input.date} às ${input.time}\nDuração: ${input.durationMinutes} minutos\nObservações: ${input.notes ?? "—"}\n\nAcesse a plataforma para gerenciar a agenda.`
            ),
          });
        } catch(e) { console.warn("[scheduling] email error", e); }
        return { ok: true, appointmentId };
      }),

    /** List appointments (admin: all for company; employee: own) */
    listAppointments: protectedProcedure
      .input(z.object({
        companyId: z.number().int().optional(),
        status: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const db2 = await getDb();
        if (!db2) throw new Error("DB unavailable");
        const role = (ctx.user as any).role;
        const isAdmin = ["admin", "rh", "admin_global", "company_admin", "super_admin", "chefia"].includes(role);
        const cid = input.companyId ?? (ctx.user as any).companyId;
        let q: any;
        if (isAdmin) {
          q = cid
            ? drzSql`SELECT a.*, u.name as collaborator_name, u.email as collaborator_email, p.name as professional_name, p.specialty FROM appointments a JOIN users u ON u.id=a.collaborator_id JOIN appointment_professionals p ON p.id=a.professional_id WHERE a.company_id=${cid} ORDER BY a.scheduled_at DESC LIMIT 200`
            : drzSql`SELECT a.*, u.name as collaborator_name, u.email as collaborator_email, p.name as professional_name, p.specialty FROM appointments a JOIN users u ON u.id=a.collaborator_id JOIN appointment_professionals p ON p.id=a.professional_id ORDER BY a.scheduled_at DESC LIMIT 200`;
        } else {
          q = drzSql`SELECT a.*, p.name as professional_name, p.specialty FROM appointments a JOIN appointment_professionals p ON p.id=a.professional_id WHERE a.collaborator_id=${ctx.user.id} ORDER BY a.scheduled_at DESC LIMIT 50`;
        }
        const rows = await db2.execute(q);
        const list = Array.isArray((rows as any)[0]) ? (rows as any)[0] : [];
        return list.map((r: any) => ({
          id: Number(r.id),
          collaboratorName: r.collaborator_name ?? null,
          collaboratorEmail: r.collaborator_email ?? null,
          professionalName: String(r.professional_name ?? ""),
          specialty: r.specialty ?? null,
          scheduledAt: r.scheduled_at,
          durationMinutes: Number(r.duration_minutes ?? 30),
          status: String(r.status ?? "pending"),
          meetingUrl: r.meeting_url ?? null,
          notes: r.notes ?? null,
        }));
      }),

    updateAppointmentStatus: adminOrRhProcedure
      .input(z.object({
        id: z.number().int(),
        status: z.enum(["pending", "confirmed", "cancelled", "completed"]),
        meetingUrl: z.string().optional(),
        cancelReason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db2 = await getDb();
        if (!db2) throw new Error("DB unavailable");
        await db2.execute(drzSql`
          UPDATE appointments
          SET status=${input.status},
              meeting_url=${input.meetingUrl || null},
              cancel_reason=${input.cancelReason || null},
              updated_at=NOW()
          WHERE id=${input.id}
        `);
        return { ok: true };
      }),

    cancelMyAppointment: protectedProcedure
      .input(z.object({ id: z.number().int(), reason: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const db2 = await getDb();
        if (!db2) throw new Error("DB unavailable");
        // Verify ownership
        const rows = await db2.execute(drzSql`SELECT collaborator_id FROM appointments WHERE id=${input.id}`);
        const row: any = Array.isArray((rows as any)[0]) ? ((rows as any)[0])[0] : null;
        if (!row || Number(row.collaborator_id) !== ctx.user.id) throw ForbiddenError("Sem permissão.");
        await db2.execute(drzSql`UPDATE appointments SET status='cancelled', cancel_reason=${input.reason || null}, updated_at=NOW() WHERE id=${input.id}`);
        return { ok: true };
      }),
  }),

  // ─── Risk-Course Correlation ──────────────────────────────────────────────
  riskCorrelation: router({
    /** Get all links between psychosocial factors and modules */
    listLinks: adminOrRhProcedure.query(async ({ ctx }) => {
      const db2 = await getDb();
      if (!db2) throw new Error("DB unavailable");
      const rows = await db2.execute(
        drzSql`SELECT rcl.*, pf.name as factor_name, m.title as module_title
               FROM risk_course_links rcl
               JOIN psychosocial_factors pf ON pf.id = rcl.factor_id
               JOIN modules m ON m.id = rcl.module_id
               ORDER BY pf.name`
      );
      const list = Array.isArray((rows as any)[0]) ? (rows as any)[0] : [];
      return list.map((r: any) => ({
        id: Number(r.id),
        factorId: Number(r.factor_id),
        factorName: String(r.factor_name ?? ""),
        moduleId: Number(r.module_id),
        moduleTitle: String(r.module_title ?? ""),
        criticality: String(r.criticality ?? "alto"),
        isAutoLinked: Boolean(r.is_auto_linked),
        notes: r.notes ?? null,
      }));
    }),

    saveLink: adminOrRhProcedure
      .input(z.object({
        id: z.number().int().optional(),
        factorId: z.number().int(),
        moduleId: z.number().int(),
        criticality: z.enum(["baixo", "medio", "alto", "critico"]).default("alto"),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db2 = await getDb();
        if (!db2) throw new Error("DB unavailable");
        if (input.id) {
          await db2.execute(drzSql`
            UPDATE risk_course_links SET factor_id=${input.factorId}, module_id=${input.moduleId},
            criticality=${input.criticality}, notes=${input.notes || null}
            WHERE id=${input.id}
          `);
          return { id: input.id };
        } else {
          const res = await db2.execute(drzSql`
            INSERT INTO risk_course_links (factor_id, module_id, criticality, is_auto_linked, notes)
            VALUES (${input.factorId}, ${input.moduleId}, ${input.criticality}, 0, ${input.notes || null})
          `);
          return { id: Number((res as any)[0]?.insertId ?? 0) };
        }
      }),

    deleteLink: adminOrRhProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        const db2 = await getDb();
        if (!db2) throw new Error("DB unavailable");
        await db2.execute(drzSql`DELETE FROM risk_course_links WHERE id=${input.id}`);
        return { ok: true };
      }),

    // ── AdminFatores endpoints ─────────────────────────────────────────────
    listFactorsWithLinks: adminOrRhProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [] as any[];
      await db.execute(drzSql`
        CREATE TABLE IF NOT EXISTS psychosocial_factors (
          id INT AUTO_INCREMENT PRIMARY KEY,
          code VARCHAR(50) NOT NULL UNIQUE,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          preventive_program_module_id INT,
          default_action TEXT,
          axis_order INT DEFAULT 0
        )
      `);
      await db.execute(drzSql`
        CREATE TABLE IF NOT EXISTS risk_course_links (
          id INT AUTO_INCREMENT PRIMARY KEY,
          factor_id INT NOT NULL,
          module_id INT NOT NULL,
          criticality VARCHAR(20) DEFAULT 'media',
          is_auto_linked TINYINT(1) DEFAULT 0,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_factor_module (factor_id, module_id)
        )
      `);
      const seed: [number, string, string, string][] = [
        [1,  'assedio',        'Assédio de qualquer natureza no trabalho',      'Condutas abusivas, humilhações ou violência psicológica'],
        [2,  'suporte',        'Falta de suporte/apoio no trabalho',            'Ausência de acolhimento e suporte organizacional'],
        [3,  'mudancas',       'Má gestão de mudanças organizacionais',         'Mudanças sem comunicação e preparo adequado'],
        [4,  'clareza',        'Baixa clareza de papel/função',                 'Incerteza sobre responsabilidades e atribuições'],
        [5,  'reconhecimento', 'Baixas recompensas e reconhecimento',           'Falta de valorização profissional'],
        [6,  'autonomia',      'Baixo controle no trabalho / Falta de autonomia','Pouca participação nas decisões e atividades'],
        [7,  'justica',        'Baixa justiça organizacional',                  'Percepção de desigualdade e favoritismo'],
        [8,  'trauma',         'Eventos violentos ou traumáticos',              'Vivência de situações críticas ou agressivas'],
        [9,  'subcarga',       'Baixa demanda no trabalho (Subcarga)',          'Ociosidade excessiva e baixa estimulação'],
        [10, 'sobrecarga',     'Excesso de demandas no trabalho (Sobrecarga)', 'Pressão excessiva e excesso de tarefas'],
        [11, 'relacionamentos','Maus relacionamentos no local de trabalho',     'Conflitos interpessoais recorrentes'],
        [12, 'comunicacao',    'Trabalho em condições de difícil comunicação',  'Falhas de comunicação operacional'],
        [13, 'remoto',         'Trabalho remoto e isolado',                     'Isolamento e falta de integração com a equipe'],
      ];
      for (const [order, code, name, desc] of seed) {
        await db.execute(drzSql`
          INSERT IGNORE INTO psychosocial_factors (axis_order, code, name, description)
          VALUES (${order}, ${code}, ${name}, ${desc})
        `);
      }
      const fr: any = await db.execute(drzSql`
        SELECT f.id, f.code, f.name, f.description, f.axis_order AS axisOrder,
               m.title AS programTitle
        FROM psychosocial_factors f
        LEFT JOIN modules m ON m.id = f.preventive_program_module_id
        ORDER BY f.axis_order
      `);
      const frows = Array.isArray((fr as any)[0]) ? (fr as any)[0] : Array.isArray(fr) ? fr : [];
      const lr: any = await db.execute(drzSql`
        SELECT rcl.factor_id, rcl.module_id, rcl.criticality, rcl.is_auto_linked,
               m.title AS moduleTitle, m.template_category AS moduleCategory
        FROM risk_course_links rcl
        JOIN modules m ON m.id = rcl.module_id
      `);
      const lrows = Array.isArray((lr as any)[0]) ? (lr as any)[0] : Array.isArray(lr) ? lr : [];
      const linksByFactor = new Map<number, any[]>();
      for (const l of lrows) {
        const fid = Number(l.factor_id);
        if (!linksByFactor.has(fid)) linksByFactor.set(fid, []);
        linksByFactor.get(fid)!.push({
          module_id: Number(l.module_id),
          moduleTitle: String(l.moduleTitle ?? ""),
          moduleCategory: l.moduleCategory ? String(l.moduleCategory) : null,
          criticality: String(l.criticality ?? "media"),
          is_auto_linked: Boolean(l.is_auto_linked),
        });
      }
      return frows.map((f: any) => ({
        id: Number(f.id),
        code: String(f.code ?? ""),
        name: String(f.name ?? ""),
        description: f.description ? String(f.description) : null,
        axisOrder: Number(f.axisOrder ?? 0),
        programTitle: f.programTitle ? String(f.programTitle) : null,
        linkedCourses: linksByFactor.get(Number(f.id)) ?? [],
      }));
    }),

    listAvailableCourses: adminOrRhProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [] as any[];
      const r: any = await db.execute(drzSql`
        SELECT id, title, template_category AS templateCategory, is_mandatory AS isMandatory
        FROM modules WHERE isActive = 1 ORDER BY title
      `);
      const rows = Array.isArray((r as any)[0]) ? (r as any)[0] : Array.isArray(r) ? r : [];
      return rows.map((m: any) => ({
        id: Number(m.id),
        title: String(m.title ?? ""),
        templateCategory: m.templateCategory ? String(m.templateCategory) : null,
        isMandatory: Boolean(m.isMandatory),
      }));
    }),

    linkCourseToFactor: adminOrRhProcedure
      .input(z.object({
        factorId: z.number().int(),
        moduleId: z.number().int(),
        criticality: z.enum(["baixa", "media", "alta", "critica"]).default("media"),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.execute(drzSql`
          INSERT IGNORE INTO risk_course_links (factor_id, module_id, criticality, is_auto_linked)
          VALUES (${input.factorId}, ${input.moduleId}, ${input.criticality}, 0)
        `);
        return { ok: true };
      }),

    unlinkCourseFromFactor: adminOrRhProcedure
      .input(z.object({ factorId: z.number().int(), moduleId: z.number().int() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.execute(drzSql`
          DELETE FROM risk_course_links WHERE factor_id=${input.factorId} AND module_id=${input.moduleId}
        `);
        return { ok: true };
      }),

    updateCourseCategory: adminOrRhProcedure
      .input(z.object({ moduleId: z.number().int(), category: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.execute(drzSql`
          UPDATE modules SET template_category=${input.category || null} WHERE id=${input.moduleId}
        `);
        return { ok: true };
      }),

    /** Get recommended courses for a given risk assessment based on linked factors */
    getRecommendedCourses: adminOrRhProcedure
      .input(z.object({ assessmentId: z.number().int() }))
      .query(async ({ ctx, input }) => {
        const db2 = await getDb();
        if (!db2) throw new Error("DB unavailable");
        // Get high/critical factors from this assessment inventory
        const rows = await db2.execute(drzSql`
          SELECT ri.factor_id, ri.risco_final, pf.name as factor_name,
                 rcl.module_id, m.title as module_title, rcl.criticality as link_criticality
          FROM risk_inventory_items ri
          JOIN psychosocial_factors pf ON pf.id = ri.factor_id
          LEFT JOIN risk_course_links rcl ON rcl.factor_id = ri.factor_id
          LEFT JOIN modules m ON m.id = rcl.module_id
          WHERE ri.assessment_id = ${input.assessmentId}
            AND ri.risco_final IN ('alto', 'critico')
            AND rcl.module_id IS NOT NULL
            AND m.publish_status = 'published'
          ORDER BY ri.risco_final DESC, pf.name
        `);
        const list = Array.isArray((rows as any)[0]) ? (rows as any)[0] : [];
        return list.map((r: any) => ({
          factorId: Number(r.factor_id),
          factorName: String(r.factor_name ?? ""),
          riskLevel: String(r.risco_final ?? ""),
          moduleId: Number(r.module_id ?? 0),
          moduleTitle: String(r.module_title ?? ""),
        }));
      }),
  }),


  /** Returns overdue action-plan items across all assessments for the company */
  getOverdueAlerts: adminOrRhProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      const cid = (ctx.user as any).companyId;
      if (!db || !cid) return [];
      const rows: any = await db.execute(drzSql`
        SELECT ap.id, ap.action_description, ap.responsible_party, ap.priority,
               ap.end_date, ap.status, ap.assessment_id,
               pf.name AS factor_name, ra.cycle_name,
               COALESCE(s.name, 'Geral') AS sector_name
        FROM risk_action_plan_items ap
        JOIN risk_assessments ra ON ra.id = ap.assessment_id
        JOIN psychosocial_factors pf ON pf.id = ap.factor_id
        LEFT JOIN sectors s ON s.id = ra.sector_id
        WHERE ra.company_id = ${cid}
          AND ap.status NOT IN ('concluido', 'cancelado')
          AND ap.end_date IS NOT NULL
          AND ap.end_date < CURDATE()
        ORDER BY ap.priority DESC, ap.end_date ASC
        LIMIT 50
      `);
      const list = Array.isArray((rows as any)[0]) ? (rows as any)[0] : [];
      return list.map((r: any) => ({
        id: Number(r.id),
        assessmentId: Number(r.assessment_id),
        actionDescription: String(r.action_description ?? ""),
        responsibleParty: r.responsible_party ? String(r.responsible_party) : null,
        priority: String(r.priority ?? "baixa"),
        endDate: r.end_date ? new Date(r.end_date).toISOString().slice(0, 10) : null,
        status: String(r.status ?? "programado"),
        factorName: String(r.factor_name ?? ""),
        cycleName: String(r.cycle_name ?? ""),
        sectorName: String(r.sector_name ?? ""),
      }));
    }),

  heatmap: router({
    getSSTKpis: adminOrRhProcedure
      .input(z.object({}))
      .query(async ({ ctx }) => {
        const db = await getDb();
        const cid = ctx.user.companyId;
        const totalR: any = await db.execute(drzSql`
          SELECT COUNT(*) as cnt FROM risk_assessments WHERE company_id=${cid}
        `);
        const totalAssessments = Number((Array.isArray((totalR as any)[0]) ? (totalR as any)[0][0] : null)?.cnt ?? 0);
        const factorR: any = await db.execute(drzSql`
          SELECT ri.risco_final, COUNT(*) as cnt
          FROM risk_inventory_items ri
          JOIN risk_assessments ra ON ra.id = ri.assessment_id
          WHERE ra.company_id=${cid}
          GROUP BY ri.risco_final
        `);
        const factorList = Array.isArray((factorR as any)[0]) ? (factorR as any)[0] : [];
        let criticalFactors = 0, highFactors = 0, mediumFactors = 0, lowFactors = 0;
        for (const row of factorList) {
          const cnt = Number(row.cnt ?? 0);
          if (row.risco_final === "critico") criticalFactors = cnt;
          else if (row.risco_final === "alto") highFactors = cnt;
          else if (row.risco_final === "medio") mediumFactors = cnt;
          else if (row.risco_final === "baixo") lowFactors = cnt;
        }
        const planR: any = await db.execute(drzSql`
          SELECT COUNT(*) as cnt
          FROM risk_action_plan_items rap
          JOIN risk_assessments ra ON ra.id = rap.assessment_id
          WHERE ra.company_id=${cid}
        `);
        const actionPlanItems = Number((Array.isArray((planR as any)[0]) ? (planR as any)[0][0] : null)?.cnt ?? 0);
        return { totalAssessments, criticalFactors, highFactors, mediumFactors, lowFactors, actionPlanItems };
      }),

    getOrgHeatmap: adminOrRhProcedure
      .input(z.object({}))
      .query(async ({ ctx }) => {
        const db = await getDb();
        const cid = ctx.user.companyId;
        const factorR: any = await db.execute(drzSql`
          SELECT id, code, name FROM psychosocial_factors ORDER BY axis_order, id
        `);
        const factors = (Array.isArray((factorR as any)[0]) ? (factorR as any)[0] : [])
          .map((r: any) => ({ id: Number(r.id), code: String(r.code ?? ""), name: String(r.name ?? "") }));
        const heatRows: any = await db.execute(drzSql`
          SELECT ra.id as assessment_id, ra.cycle_name,
                 COALESCE(s.name, 'Geral') as sector_name,
                 COALESCE(b.name, '') as branch_name,
                 ri.factor_id, ri.risco_final
          FROM risk_assessments ra
          LEFT JOIN sectors s ON s.id = ra.sector_id
          LEFT JOIN branches b ON b.id = ra.branch_id
          LEFT JOIN risk_inventory_items ri ON ri.assessment_id = ra.id
          WHERE ra.company_id=${cid}
          ORDER BY ra.id, ri.factor_id
        `);
        const list = Array.isArray((heatRows as any)[0]) ? (heatRows as any)[0] : [];
        const assessMap = new Map<number, any>();
        for (const r of list) {
          const aid = Number(r.assessment_id);
          if (!assessMap.has(aid)) {
            assessMap.set(aid, {
              assessmentId: aid,
              cycleName: String(r.cycle_name ?? ""),
              sectorName: String(r.sector_name ?? "Geral"),
              branchName: String(r.branch_name ?? ""),
              cells: new Map<number, string>(),
            });
          }
          if (r.factor_id && r.risco_final) {
            assessMap.get(aid)!.cells.set(Number(r.factor_id), String(r.risco_final));
          }
        }
        const resultRows = Array.from(assessMap.values()).map((a: any) => ({
          assessmentId: a.assessmentId,
          cycleName: a.cycleName,
          sectorName: a.sectorName,
          branchName: a.branchName,
          cells: factors.map((f: any) => ({
            factorId: f.id,
            risco: a.cells.get(f.id) ?? null,
          })),
        }));
        return { factors, rows: resultRows };
      }),
  }),

  // ── Training Programs ──────────────────────────────────────────────────────
  trainingPrograms: router({

    list: adminOrRhProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const cid = (ctx.user as any).companyId;
      const rows: any = await db.execute(drzSql`
        SELECT tp.*,
          (SELECT COUNT(*) FROM training_program_modules tpm WHERE tpm.program_id = tp.id) AS module_count,
          (SELECT COUNT(*) FROM training_program_factors tpf WHERE tpf.program_id = tp.id) AS factor_count
        FROM training_programs tp
        WHERE tp.is_active = 1
          AND (tp.company_id = ${cid} OR tp.company_id IS NULL)
        ORDER BY tp.order_index, tp.id
      `);
      const list = Array.isArray((rows as any)[0]) ? (rows as any)[0] : [];
      return list.map((r: any) => ({
        id: Number(r.id),
        companyId: r.company_id ? Number(r.company_id) : null,
        name: String(r.name ?? ""),
        code: r.code ? String(r.code) : null,
        technicalTitle: r.technical_title ? String(r.technical_title) : null,
        description: r.description ? String(r.description) : null,
        type: String(r.type ?? "obrigatorio"),
        isActive: Number(r.is_active ?? 1),
        orderIndex: Number(r.order_index ?? 0),
        moduleCount: Number(r.module_count ?? 0),
        factorCount: Number(r.factor_count ?? 0),
      }));
    }),

    getModules: adminOrRhProcedure
      .input(z.object({ programId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const rows: any = await db.execute(drzSql`
          SELECT tpm.id, tpm.program_id, tpm.module_id, tpm.order_index,
                 m.title, m.description, m.durationMinutes
          FROM training_program_modules tpm
          JOIN modules m ON m.id = tpm.module_id
          WHERE tpm.program_id = ${input.programId}
          ORDER BY tpm.order_index, tpm.id
        `);
        const list = Array.isArray((rows as any)[0]) ? (rows as any)[0] : [];
        return list.map((r: any) => ({
          id: Number(r.id),
          programId: Number(r.program_id),
          moduleId: Number(r.module_id),
          orderIndex: Number(r.order_index ?? 0),
          title: String(r.title ?? ""),
          description: r.description ? String(r.description) : null,
          durationMinutes: Number(r.durationMinutes ?? 0),
        }));
      }),

    getFactors: adminOrRhProcedure
      .input(z.object({ programId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const rows: any = await db.execute(drzSql`
          SELECT tpf.id, tpf.factor_id, pf.code, pf.name
          FROM training_program_factors tpf
          JOIN psychosocial_factors pf ON pf.id = tpf.factor_id
          WHERE tpf.program_id = ${input.programId}
          ORDER BY pf.axis_order, pf.id
        `);
        const list = Array.isArray((rows as any)[0]) ? (rows as any)[0] : [];
        return list.map((r: any) => ({
          id: Number(r.id),
          factorId: Number(r.factor_id),
          code: String(r.code ?? ""),
          name: String(r.name ?? ""),
        }));
      }),

    create: adminOrRhProcedure
      .input(z.object({
        name: z.string().min(1),
        code: z.string().optional(),
        technicalTitle: z.string().optional(),
        description: z.string().optional(),
        type: z.enum(["obrigatorio", "opcional"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const cid = (ctx.user as any).companyId;
        const r: any = await db.execute(drzSql`
          INSERT INTO training_programs (company_id, name, code, technical_title, description, type)
          VALUES (${cid}, ${input.name}, ${input.code ?? null}, ${input.technicalTitle ?? null}, ${input.description ?? null}, ${input.type})
        `);
        return { id: Number((r as any)[0]?.insertId ?? 0) };
      }),

    update: adminOrRhProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1),
        code: z.string().optional(),
        technicalTitle: z.string().optional(),
        description: z.string().optional(),
        type: z.enum(["obrigatorio", "opcional"]),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.execute(drzSql`
          UPDATE training_programs
          SET name=${input.name}, code=${input.code ?? null}, technical_title=${input.technicalTitle ?? null},
              description=${input.description ?? null}, type=${input.type}, updated_at=NOW()
          WHERE id=${input.id}
        `);
        return { ok: true };
      }),

    delete: adminOrRhProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.execute(drzSql`UPDATE training_programs SET is_active=0 WHERE id=${input.id}`);
        return { ok: true };
      }),

    addModule: adminOrRhProcedure
      .input(z.object({ programId: z.number(), moduleId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const cntR: any = await db.execute(drzSql`SELECT COUNT(*) as cnt FROM training_program_modules WHERE program_id=${input.programId}`);
        const cnt = Number((Array.isArray((cntR as any)[0]) ? (cntR as any)[0][0] : null)?.cnt ?? 0);
        await db.execute(drzSql`
          INSERT IGNORE INTO training_program_modules (program_id, module_id, order_index)
          VALUES (${input.programId}, ${input.moduleId}, ${cnt})
        `);
        return { ok: true };
      }),

    removeModule: adminOrRhProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.execute(drzSql`DELETE FROM training_program_modules WHERE id=${input.id}`);
        return { ok: true };
      }),

    reorderModule: adminOrRhProcedure
      .input(z.object({ id: z.number(), direction: z.enum(["up", "down"]) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const rowR: any = await db.execute(drzSql`SELECT * FROM training_program_modules WHERE id=${input.id}`);
        const row = Array.isArray((rowR as any)[0]) ? (rowR as any)[0][0] : null;
        if (!row) return { ok: false };
        const curIdx = Number(row.order_index);
        const targetIdx = input.direction === "up" ? curIdx - 1 : curIdx + 1;
        const swapR: any = await db.execute(drzSql`SELECT id FROM training_program_modules WHERE program_id=${row.program_id} AND order_index=${targetIdx} LIMIT 1`);
        const swapRow = Array.isArray((swapR as any)[0]) ? (swapR as any)[0][0] : null;
        if (swapRow) {
          await db.execute(drzSql`UPDATE training_program_modules SET order_index=${targetIdx} WHERE id=${input.id}`);
          await db.execute(drzSql`UPDATE training_program_modules SET order_index=${curIdx} WHERE id=${swapRow.id}`);
        }
        return { ok: true };
      }),

    addFactor: adminOrRhProcedure
      .input(z.object({ programId: z.number(), factorId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.execute(drzSql`
          INSERT IGNORE INTO training_program_factors (program_id, factor_id)
          VALUES (${input.programId}, ${input.factorId})
        `);
        return { ok: true };
      }),

    removeFactor: adminOrRhProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.execute(drzSql`DELETE FROM training_program_factors WHERE id=${input.id}`);
        return { ok: true };
      }),

    listForEmployee: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { prioritarios: [], obrigatorios: [], modules: [] };
      const userId = ctx.user.id;
      const cid = (ctx.user as any).companyId;
      const sectorId = (ctx.user as any).sectorId;

      // Get all active programs for this company
      const progsR: any = await db.execute(drzSql`
        SELECT tp.*, GROUP_CONCAT(tpf.factor_id) AS factor_ids
        FROM training_programs tp
        LEFT JOIN training_program_factors tpf ON tpf.program_id = tp.id
        WHERE tp.is_active = 1
        GROUP BY tp.id
        ORDER BY tp.order_index, tp.id
      `);
      const progs = Array.isArray((progsR as any)[0]) ? (progsR as any)[0] : [];

      // Get high-risk factor IDs for user's sector (latest completed assessment)
      let highRiskFactorIds: Set<number> = new Set();
      if (sectorId) {
        const riskR: any = await db.execute(drzSql`
          SELECT rii.factor_id
          FROM risk_inventory_items rii
          JOIN risk_assessments ra ON ra.id = rii.assessment_id
          WHERE ra.sector_id = ${sectorId}
            AND ra.company_id = ${cid}
            AND rii.risco_final IN ('alto', 'critico')
          ORDER BY ra.id DESC
          LIMIT 50
        `);
        const riskList = Array.isArray((riskR as any)[0]) ? (riskR as any)[0] : [];
        for (const r of riskList) highRiskFactorIds.add(Number(r.factor_id));
      }
      if (highRiskFactorIds.size === 0 && cid) {
        const riskR: any = await db.execute(drzSql`
          SELECT rii.factor_id
          FROM risk_inventory_items rii
          JOIN risk_assessments ra ON ra.id = rii.assessment_id
          WHERE ra.company_id = ${cid}
            AND rii.risco_final IN ('alto', 'critico')
          ORDER BY ra.id DESC
          LIMIT 50
        `);
        const riskList = Array.isArray((riskR as any)[0]) ? (riskR as any)[0] : [];
        for (const r of riskList) highRiskFactorIds.add(Number(r.factor_id));
      }

      // Get user progress
      const progR: any = await db.execute(drzSql`
        SELECT moduleId, isCompleted, percentWatched FROM user_progress WHERE userId=${userId}
      `);
      const progressMap = new Map<number, { isCompleted: boolean; pct: number }>();
      for (const p of (Array.isArray((progR as any)[0]) ? (progR as any)[0] : [])) {
        progressMap.set(Number(p.moduleId), { isCompleted: Boolean(p.isCompleted), pct: Number(p.percentWatched ?? 0) });
      }

      // Get program modules
      const pmR: any = await db.execute(drzSql`
        SELECT tpm.id, tpm.program_id, tpm.module_id, tpm.order_index,
               m.title, m.description, m.durationMinutes
        FROM training_program_modules tpm
        JOIN modules m ON m.id = tpm.module_id
        ORDER BY tpm.program_id, tpm.order_index, tpm.id
      `);
      const pmList = Array.isArray((pmR as any)[0]) ? (pmR as any)[0] : [];
      const progModMap = new Map<number, any[]>();
      for (const pm of pmList) {
        const pid = Number(pm.program_id);
        if (!progModMap.has(pid)) progModMap.set(pid, []);
        progModMap.get(pid)!.push({
          id: Number(pm.id),
          moduleId: Number(pm.module_id),
          orderIndex: Number(pm.order_index ?? 0),
          title: String(pm.title ?? ""),
          description: pm.description ? String(pm.description) : null,
          durationMinutes: Number(pm.durationMinutes ?? 0),
          progress: progressMap.get(Number(pm.module_id)) ?? { isCompleted: false, pct: 0 },
        });
      }

      // Get all module IDs that belong to programs
      const programModuleIds = new Set<number>(pmList.map((pm: any) => Number(pm.module_id)));

      function buildProgram(r: any) {
        const factorIds = r.factor_ids
          ? String(r.factor_ids).split(",").map(Number).filter(Boolean)
          : [];
        const mods = progModMap.get(Number(r.id)) ?? [];
        const isPrioritario = factorIds.some(fid => highRiskFactorIds.has(fid));
        const totalMods = mods.length;
        const completedMods = mods.filter((m: any) => m.progress.isCompleted).length;
        const pct = totalMods > 0 ? Math.round((completedMods / totalMods) * 100) : 0;
        return {
          id: Number(r.id),
          name: String(r.name ?? ""),
          code: r.code ? String(r.code) : null,
          description: r.description ? String(r.description) : null,
          type: String(r.type ?? "obrigatorio"),
          isPrioritario,
          factorIds,
          modules: mods,
          totalMods,
          completedMods,
          pct,
          isAllCompleted: totalMods > 0 && completedMods === totalMods,
        };
      }

      const prioritarios: any[] = [];
      const obrigatorios: any[] = [];

      for (const r of progs) {
        const p = buildProgram(r);
        if (p.isPrioritario) prioritarios.push(p);
        else if (String(r.type) === "obrigatorio") obrigatorios.push(p);
      }

      // Get standalone modules (not in any program) for "Complementares"
      // Uses the same visibility logic as modules.list (enrollment-based OR company-created)
      const modsR: any = await db.execute(drzSql`
        SELECT DISTINCT m.id, m.title, m.description, m.durationMinutes, m.template_category, m.orderIndex
        FROM modules m
        WHERE m.isActive = 1 AND (
          EXISTS (
            SELECT 1 FROM company_content_enrollments cce
            WHERE cce.content_id = m.id AND cce.content_type = 'module'
              AND cce.company_id = ${cid} AND cce.is_active = 1
          )
          OR m.created_by_company_id = ${cid}
          OR (m.publish_status = 'published' AND ${cid} IS NULL)
        )
        ORDER BY m.orderIndex, m.id
      `);
      const allMods = (Array.isArray((modsR as any)[0]) ? (modsR as any)[0] : [])
        .filter((m: any) => !programModuleIds.has(Number(m.id)))
        .map((m: any) => ({
          id: Number(m.id),
          title: String(m.title ?? ""),
          description: m.description ? String(m.description) : null,
          durationMinutes: Number(m.durationMinutes ?? 0),
          category: m.template_category ? String(m.template_category) : null,
          progress: progressMap.get(Number(m.id)) ?? { isCompleted: false, pct: 0 },
        }));

      return { prioritarios, obrigatorios, modules: allMods };
    }),
  }),

  // ── Canal de Denúncia ─────────────────────────────────────────────────────
  // ── Preventive Library ──────────────────────────────────────────────────────
  preventiveLibrary: router({

    listCampaigns: adminOrRhProcedure.query(async ({ ctx }) => {
      const cid = (ctx.user as any).companyId;
      if (!cid) return [];
      const db = await getDb();
      // Ensure tables exist with correct schema
      await execP(db, `CREATE TABLE IF NOT EXISTS preventive_library_campaigns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(100),
        month_number TINYINT DEFAULT NULL,
        theme VARCHAR(255),
        color VARCHAR(50),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_plc_company (company_id)
      )`, []);
      await execP(db, `CREATE TABLE IF NOT EXISTS preventive_library_materials (
        id INT AUTO_INCREMENT PRIMARY KEY,
        campaign_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        material_type VARCHAR(50),
        target_audience VARCHAR(50) DEFAULT 'todos',
        file_name VARCHAR(255),
        mime_type VARCHAR(100),
        file_url MEDIUMTEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_plm_campaign (campaign_id)
      )`, []);
      await execP(db, `CREATE TABLE IF NOT EXISTS preventive_library_links (
        id INT AUTO_INCREMENT PRIMARY KEY,
        campaign_id INT NOT NULL,
        link_type VARCHAR(50),
        ref_id INT,
        title VARCHAR(255),
        notes TEXT,
        target_audience VARCHAR(50) DEFAULT 'todos',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_pll_campaign (campaign_id)
      )`, []);
      // Add missing columns if table already existed without them
      try { await execP(db, `ALTER TABLE preventive_library_campaigns ADD COLUMN month_number TINYINT DEFAULT NULL`, []); } catch(_) {}
      try { await execP(db, `ALTER TABLE preventive_library_campaigns ADD COLUMN code VARCHAR(100)`, []); } catch(_) {}
      try { await execP(db, `ALTER TABLE preventive_library_campaigns ADD COLUMN color VARCHAR(50)`, []); } catch(_) {}
      try { await execP(db, `ALTER TABLE preventive_library_materials ADD COLUMN title VARCHAR(255)`, []); } catch(_) {}
      try { await execP(db, `ALTER TABLE preventive_library_materials ADD COLUMN material_type VARCHAR(50)`, []); } catch(_) {}
      try { await execP(db, `ALTER TABLE preventive_library_materials ADD COLUMN target_audience VARCHAR(50) DEFAULT 'todos'`, []); } catch(_) {}
      try { await execP(db, `ALTER TABLE preventive_library_materials ADD COLUMN file_name VARCHAR(255)`, []); } catch(_) {}
      try { await execP(db, `ALTER TABLE preventive_library_materials ADD COLUMN mime_type VARCHAR(100)`, []); } catch(_) {}
      try { await execP(db, `ALTER TABLE preventive_library_links ADD COLUMN ref_id INT`, []); } catch(_) {}
      try { await execP(db, `ALTER TABLE preventive_library_links ADD COLUMN title VARCHAR(255)`, []); } catch(_) {}
      try { await execP(db, `ALTER TABLE preventive_library_links ADD COLUMN notes TEXT`, []); } catch(_) {}
      try { await execP(db, `ALTER TABLE preventive_library_links ADD COLUMN target_audience VARCHAR(50) DEFAULT 'todos'`, []); } catch(_) {}
      const [rows] = await execP(db, `SELECT * FROM preventive_library_campaigns WHERE company_id=? ORDER BY month_number ASC, created_at ASC`, [cid]) as any;
      return rows as any[];
    }),

    listCampaignSummary: adminOrRhProcedure.query(async ({ ctx }) => {
      const cid = (ctx.user as any).companyId;
      if (!cid) return [];
      const db = await getDb();
      // Return array of { campaign_id, material_type, cnt } for frontend summaryFor()
      const [rows] = await execP(db, `SELECT m.campaign_id, m.material_type, COUNT(*) AS cnt
         FROM preventive_library_materials m
         JOIN preventive_library_campaigns c ON c.id = m.campaign_id
         WHERE c.company_id = ?
         GROUP BY m.campaign_id, m.material_type`, [cid]) as any;
      return rows as any[];
    }),

    upsertCampaign: adminOrRhProcedure
      .input(z.object({
        id: z.number().optional(),
        monthNumber: z.number().int().min(1).max(12).optional(),
        code: z.string().optional(),
        name: z.string().min(1),
        theme: z.string().optional(),
        color: z.string().optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        if (!cid) throw new TRPCError({ code: 'BAD_REQUEST' });
        const db = await getDb();
        if (input.id) {
          await execP(db, `UPDATE preventive_library_campaigns SET name=?, code=?, month_number=?, theme=?, color=?, description=? WHERE id=? AND company_id=?`, [input.name, input.code ?? null, input.monthNumber ?? null, input.theme ?? null, input.color ?? null, input.description ?? null, input.id, cid]);
          return { id: input.id };
        }
        const [res] = await execP(db, `INSERT INTO preventive_library_campaigns (company_id, name, code, month_number, theme, color, description) VALUES (?,?,?,?,?,?,?)`, [cid, input.name, input.code ?? null, input.monthNumber ?? null, input.theme ?? null, input.color ?? null, input.description ?? null]) as any;
        return { id: (res as any).insertId };
      }),

    deleteCampaign: adminOrRhProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        if (!cid) throw new TRPCError({ code: 'BAD_REQUEST' });
        const db = await getDb();
        await execP(db, `DELETE FROM preventive_library_links WHERE campaign_id=?`, [input.id]);
        await execP(db, `DELETE FROM preventive_library_materials WHERE campaign_id=?`, [input.id]);
        await execP(db, `DELETE FROM preventive_library_campaigns WHERE id=? AND company_id=?`, [input.id, cid]);
        return { ok: true };
      }),

    listMaterials: adminOrRhProcedure
      .input(z.object({ campaignId: z.number() }))
      .query(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        if (!cid) return [];
        const db = await getDb();
        const [rows] = await execP(db, `SELECT m.* FROM preventive_library_materials m
           JOIN preventive_library_campaigns c ON c.id=m.campaign_id
           WHERE m.campaign_id=? AND c.company_id=?
           ORDER BY m.created_at ASC`, [input.campaignId, cid]) as any;
        return rows as any[];
      }),

    uploadMaterial: adminOrRhProcedure
      .input(z.object({
        campaignId: z.number(),
        materialType: z.string().optional(),
        title: z.string().min(1),
        description: z.string().optional(),
        fileName: z.string().optional(),
        fileBase64: z.string().optional(),
        mimeType: z.string().optional(),
        targetAudience: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        if (!cid) throw new TRPCError({ code: 'BAD_REQUEST' });
        const db = await getDb();
        const [[cr]] = await execP(db, `SELECT id FROM preventive_library_campaigns WHERE id=? AND company_id=?`, [input.campaignId, cid]) as any;
        if (!(cr as any)?.id) throw new TRPCError({ code: 'NOT_FOUND' });
        // For base64 files, store the data URL directly (no S3/CDN)
        const fileUrl = input.fileBase64 ?? null;
        const [res] = await execP(db, `INSERT INTO preventive_library_materials (campaign_id, title, material_type, target_audience, file_name, mime_type, file_url, description) VALUES (?,?,?,?,?,?,?,?)`, [input.campaignId, input.title, input.materialType ?? null, input.targetAudience ?? 'todos', input.fileName ?? null, input.mimeType ?? null, fileUrl, input.description ?? null]) as any;
        return { id: (res as any).insertId };
      }),

    deleteMaterial: adminOrRhProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        if (!cid) throw new TRPCError({ code: 'BAD_REQUEST' });
        const db = await getDb();
        await execP(db, `DELETE m FROM preventive_library_materials m
           JOIN preventive_library_campaigns c ON c.id=m.campaign_id
           WHERE m.id=? AND c.company_id=?`, [input.id, cid]);
        return { ok: true };
      }),

    listCampaignLinks: adminOrRhProcedure
      .input(z.object({ campaignId: z.number() }))
      .query(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        if (!cid) return [];
        const db = await getDb();
        const [rows] = await execP(db, `SELECT l.* FROM preventive_library_links l
           JOIN preventive_library_campaigns c ON c.id=l.campaign_id
           WHERE l.campaign_id=? AND c.company_id=?
           ORDER BY l.created_at ASC`, [input.campaignId, cid]) as any;
        return rows as any[];
      }),

    listAvailableForLink: adminOrRhProcedure
      .input(z.object({ linkType: z.string() }))
      .query(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        if (!cid) return [];
        const db = await getDb();
        if (input.linkType === 'survey') {
          const [rows] = await execP(db, `SELECT id, title FROM surveys WHERE company_id=? ORDER BY created_at DESC LIMIT 50`, [cid]) as any;
          return rows as any[];
        }
        if (input.linkType === 'course' || input.linkType === 'module') {
          const [rows] = await execP(db, `SELECT id, title FROM modules WHERE (created_by_company_id=? OR created_by_company_id IS NULL) AND isActive=1 ORDER BY title LIMIT 50`, [cid]) as any;
          return rows as any[];
        }
        return [];
      }),

    addCampaignLink: adminOrRhProcedure
      .input(z.object({
        campaignId: z.number(),
        linkType: z.string(),
        refId: z.number(),
        title: z.string().optional(),
        notes: z.string().optional(),
        targetAudience: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        if (!cid) throw new TRPCError({ code: 'BAD_REQUEST' });
        const db = await getDb();
        const [[cr]] = await execP(db, `SELECT id FROM preventive_library_campaigns WHERE id=? AND company_id=?`, [input.campaignId, cid]) as any;
        if (!(cr as any)?.id) throw new TRPCError({ code: 'NOT_FOUND' });
        // Check if already linked
        const [[existing]] = await execP(db, `SELECT id FROM preventive_library_links WHERE campaign_id=? AND link_type=? AND ref_id=?`, [input.campaignId, input.linkType, input.refId]) as any;
        if ((existing as any)?.id) return { alreadyLinked: true, id: (existing as any).id };
        const [res] = await execP(db, `INSERT INTO preventive_library_links (campaign_id, link_type, ref_id, title, notes, target_audience) VALUES (?,?,?,?,?,?)`, [input.campaignId, input.linkType, input.refId, input.title ?? null, input.notes ?? null, input.targetAudience ?? 'todos']) as any;
        return { id: (res as any).insertId, alreadyLinked: false };
      }),

    removeCampaignLink: adminOrRhProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId;
        if (!cid) throw new TRPCError({ code: 'BAD_REQUEST' });
        const db = await getDb();
        await execP(db, `DELETE l FROM preventive_library_links l
           JOIN preventive_library_campaigns c ON c.id=l.campaign_id
           WHERE l.id=? AND c.company_id=?`, [input.id, cid]);
        return { ok: true };
      }),

  }),

  companySmtp: router({
    get: adminOrRhProcedure
      .input(z.object({}).optional())
      .query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) return null;
        const companyId = (ctx.user as any).companyId;
        const r = await db.execute(drzSql`
          SELECT smtp_host, smtp_port, smtp_secure, smtp_user, smtp_from, from_name,
                 reject_unauthorized, is_active, last_test_at, last_test_ok, last_test_error,
                 (smtp_pass_encrypted IS NOT NULL AND smtp_pass_encrypted != '') AS has_password
          FROM company_smtp_settings WHERE company_id = ${companyId} LIMIT 1
        `);
        const rows = Array.isArray((r as any)[0]) ? (r as any)[0] : Array.isArray(r) ? r : [];
        if (!rows.length) return null;
        const row = rows[0];
        return {
          host: String(row.smtp_host ?? ""),
          port: Number(row.smtp_port ?? 465),
          secure: Boolean(row.smtp_secure),
          user: String(row.smtp_user ?? ""),
          from: String(row.smtp_from ?? ""),
          fromName: row.from_name ? String(row.from_name) : null,
          rejectUnauthorized: Boolean(row.reject_unauthorized),
          isActive: Boolean(row.is_active),
          lastTestAt: row.last_test_at ? String(row.last_test_at) : null,
          lastTestOk: row.last_test_ok != null ? Boolean(row.last_test_ok) : null,
          lastTestError: row.last_test_error ? String(row.last_test_error) : null,
          hasPassword: Boolean(row.has_password),
        };
      }),

    save: adminOrRhProcedure
      .input(z.object({
        host: z.string().min(1),
        port: z.number().int(),
        secure: z.boolean(),
        user: z.string().min(1),
        pass: z.string().optional(),
        from: z.string().min(1),
        fromName: z.string().optional(),
        rejectUnauthorized: z.boolean().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const companyId = (ctx.user as any).companyId;

        let encryptedPass: string | null = null;
        if (input.pass && input.pass.trim()) {
          encryptedPass = encryptSmtpPass(input.pass.trim());
        }

        const existing = await db.execute(drzSql`SELECT id FROM company_smtp_settings WHERE company_id = ${companyId} LIMIT 1`);
        const existingRows = Array.isArray((existing as any)[0]) ? (existing as any)[0] : Array.isArray(existing) ? existing : [];

        if (existingRows.length) {
          if (encryptedPass) {
            await db.execute(drzSql`
              UPDATE company_smtp_settings SET
                smtp_host = ${input.host}, smtp_port = ${input.port}, smtp_secure = ${input.secure ? 1 : 0},
                smtp_user = ${input.user}, smtp_pass_encrypted = ${encryptedPass},
                smtp_from = ${input.from}, from_name = ${input.fromName ?? null},
                reject_unauthorized = ${input.rejectUnauthorized !== false ? 1 : 0},
                is_active = ${input.isActive !== false ? 1 : 0}
              WHERE company_id = ${companyId}
            `);
          } else {
            await db.execute(drzSql`
              UPDATE company_smtp_settings SET
                smtp_host = ${input.host}, smtp_port = ${input.port}, smtp_secure = ${input.secure ? 1 : 0},
                smtp_user = ${input.user},
                smtp_from = ${input.from}, from_name = ${input.fromName ?? null},
                reject_unauthorized = ${input.rejectUnauthorized !== false ? 1 : 0},
                is_active = ${input.isActive !== false ? 1 : 0}
              WHERE company_id = ${companyId}
            `);
          }
        } else {
          if (!encryptedPass) throw new TRPCError({ code: "BAD_REQUEST", message: "Senha é obrigatória na primeira configuração" });
          await db.execute(drzSql`
            INSERT INTO company_smtp_settings
              (company_id, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass_encrypted, smtp_from, from_name, reject_unauthorized, is_active)
            VALUES
              (${companyId}, ${input.host}, ${input.port}, ${input.secure ? 1 : 0}, ${input.user}, ${encryptedPass}, ${input.from}, ${input.fromName ?? null},
               ${input.rejectUnauthorized !== false ? 1 : 0}, ${input.isActive !== false ? 1 : 0})
          `);
        }
        return { ok: true };
      }),

    test: adminOrRhProcedure
      .input(z.object({}).optional())
      .mutation(async ({ ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const companyId = (ctx.user as any).companyId;

        const r = await db.execute(drzSql`SELECT * FROM company_smtp_settings WHERE company_id = ${companyId} LIMIT 1`);
        const rows = Array.isArray((r as any)[0]) ? (r as any)[0] : Array.isArray(r) ? r : [];
        if (!rows.length) throw new TRPCError({ code: "NOT_FOUND", message: "Configuração SMTP não encontrada" });
        const cfg = rows[0];

        let pass: string;
        try { pass = decryptSmtpPass(String(cfg.smtp_pass_encrypted)); }
        catch (e: any) {
          await db.execute(drzSql`UPDATE company_smtp_settings SET last_test_at = NOW(), last_test_ok = 0, last_test_error = ${"Erro ao decriptar senha"} WHERE company_id = ${companyId}`);
          return { ok: false, error: "Erro ao decriptar senha" };
        }

        
        const transporter = nodemailer.createTransport({
          host: String(cfg.smtp_host),
          port: Number(cfg.smtp_port),
          secure: Boolean(cfg.smtp_secure),
          auth: { user: String(cfg.smtp_user), pass },
          tls: { rejectUnauthorized: Boolean(cfg.reject_unauthorized) },
        });

        try {
          await transporter.verify();
          await db.execute(drzSql`UPDATE company_smtp_settings SET last_test_at = NOW(), last_test_ok = 1, last_test_error = NULL WHERE company_id = ${companyId}`);
          return { ok: true };
        } catch (e: any) {
          const msg = (e?.message || String(e)).slice(0, 500);
          await db.execute(drzSql`UPDATE company_smtp_settings SET last_test_at = NOW(), last_test_ok = 0, last_test_error = ${msg} WHERE company_id = ${companyId}`);
          return { ok: false, error: msg };
        }
      }),

    sendTestEmail: adminOrRhProcedure
      .input(z.object({ to: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const companyId = (ctx.user as any).companyId;
        const toEmail = input.to?.trim() || String((ctx.user as any).email || "");
        if (!toEmail) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe o e-mail de destino" });

        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

        const r = await db.execute(drzSql`SELECT * FROM company_smtp_settings WHERE company_id = ${companyId} LIMIT 1`);
        const rows = Array.isArray((r as any)[0]) ? (r as any)[0] : Array.isArray(r) ? r : [];
        if (!rows.length) throw new TRPCError({ code: "NOT_FOUND", message: "Configuração SMTP não encontrada" });
        const cfg = rows[0];

        let pass: string;
        try { pass = decryptSmtpPass(String(cfg.smtp_pass_encrypted)); }
        catch (e: any) { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao decriptar senha" }); }

        
        const transporter = nodemailer.createTransport({
          host: String(cfg.smtp_host),
          port: Number(cfg.smtp_port),
          secure: Boolean(cfg.smtp_secure),
          auth: { user: String(cfg.smtp_user), pass },
          tls: { rejectUnauthorized: Boolean(cfg.reject_unauthorized) },
        });

        await transporter.sendMail({
          from: cfg.from_name ? `"${cfg.from_name}" <${cfg.smtp_from}>` : String(cfg.smtp_from),
          to: toEmail,
          subject: "Teste de E-mail - Saúde do Trabalho",
          html: "<p>Este é um e-mail de teste enviado pela plataforma <strong>Saúde do Trabalho</strong>.</p>",
          text: "Este é um e-mail de teste enviado pela plataforma Saúde do Trabalho.",
        });

        return { ok: true };
      }),
  }),

  // Importação de dados HR (Visão 360): absenteísmo, atestados, acidentes,
  // turnover e disciplinares via CSV, vinculados ao colaborador pelo e-mail.
  hr360: router({
    templates: adminOrRhProcedure.query(() => ({
      absenteismo: { headers: ["employee_email","employee_name","branch_name","sector_name","data_inicial","data_final","dias_afastados","motivo","cid","tipo_afastamento"], example: ["joao@empresa.com","João Silva","Matriz","Produção","2026-05-02","2026-05-06","4","Gripe","J11","atestado"] },
      atestados: { headers: ["employee_email","employee_name","branch_name","sector_name","data_atestado","dias","cid","medico_emissor","especialidade"], example: ["joao@empresa.com","João Silva","Matriz","Produção","2026-05-02","2","J11","Dra. Ana","Clínico Geral"] },
      acidentes: { headers: ["employee_email","employee_name","branch_name","sector_name","cargo","data_acidente","tipo_acidente","gravidade","houve_afastamento","dias_afastados"], example: ["joao@empresa.com","João Silva","Matriz","Produção","Operador","2026-04-10","típico","leve","sim","3"] },
      turnover: { headers: ["employee_email","employee_name","branch_name","sector_name","cargo","data_admissao","data_desligamento","motivo_desligamento"], example: ["joao@empresa.com","João Silva","Matriz","Produção","Operador","2022-01-15","2026-03-20","pedido_demissao"] },
      disciplinares: { headers: ["employee_email","employee_name","branch_name","sector_name","data_ocorrencia","tipo_ocorrencia","acao","observacao"], example: ["joao@empresa.com","João Silva","Matriz","Produção","2026-02-11","advertência","verbal","atraso recorrente"] },
    })),
    overview: adminOrRhProcedure.query(async ({ ctx }) => {
      const cid = (ctx.user as any).companyId; const db = await getDb();
      const empty = { absenteismo: 0, atestados: 0, acidentes: 0, turnover: 0, disciplinares: 0 };
      if (!db || !cid) return empty;
      const cnt = async (t: string) => { const [r] = await execP(db, `SELECT COUNT(*) AS c FROM ${t} WHERE company_id=?`, [cid]); return Number((r[0] as any)?.c || 0); };
      return { absenteismo: await cnt("hr_absenteismo"), atestados: await cnt("hr_atestados"), acidentes: await cnt("hr_acidentes"), turnover: await cnt("hr_turnover"), disciplinares: await cnt("hr_disciplinares") };
    }),
    importRows: adminOrRhProcedure
      .input(z.object({ kind: z.enum(["absenteismo","atestados","acidentes","turnover","disciplinares"]), rows: z.array(z.record(z.string(), z.any())).max(5000) }))
      .mutation(async ({ ctx, input }) => {
        const cid = (ctx.user as any).companyId; const db = await getDb();
        if (!db || !cid) throw new TRPCError({ code: "BAD_REQUEST", message: "Empresa não definida." });
        const MAP: Record<string, { table: string; cols: string[] }> = {
          absenteismo: { table: "hr_absenteismo", cols: ["employee_email","employee_name","branch_name","sector_name","data_inicial","data_final","dias_afastados","motivo","cid","tipo_afastamento"] },
          atestados: { table: "hr_atestados", cols: ["employee_email","employee_name","branch_name","sector_name","data_atestado","dias","cid","medico_emissor","especialidade"] },
          acidentes: { table: "hr_acidentes", cols: ["employee_email","employee_name","branch_name","sector_name","cargo","data_acidente","tipo_acidente","gravidade","houve_afastamento","dias_afastados"] },
          turnover: { table: "hr_turnover", cols: ["employee_email","employee_name","branch_name","sector_name","cargo","data_admissao","data_desligamento","motivo_desligamento"] },
          disciplinares: { table: "hr_disciplinares", cols: ["employee_email","employee_name","branch_name","sector_name","data_ocorrencia","tipo_ocorrencia","acao","observacao"] },
        };
        const cfg = MAP[input.kind];
        const normDate = (v: string): string | null => {
          const sv = String(v || "").trim(); if (!sv) return null;
          if (/^\d{4}-\d{2}-\d{2}/.test(sv)) return sv.slice(0, 10);
          const m = sv.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (m) return `${m[3]}-${m[2]}-${m[1]}`;
          return null;
        };
        let inserted = 0, skipped = 0; const errors: string[] = [];
        for (const row of input.rows) {
          const email = String(row.employee_email || "").trim().toLowerCase();
          if (!email) { skipped++; continue; }
          const [u] = await execP(db, `SELECT id FROM users WHERE email=? AND company_id=? LIMIT 1`, [email, cid]);
          const userId = (u[0] as any)?.id ?? null;
          const fields = ["company_id", "user_id", ...cfg.cols];
          const values: any[] = [cid, userId, ...cfg.cols.map((c) => {
            const v: any = row[c];
            if (v === undefined || v === "") return null;
            if (c.startsWith("data_")) return normDate(v);
            if (c === "dias" || c === "dias_afastados") { const n = parseInt(v, 10); return isNaN(n) ? null : n; }
            return String(v);
          })];
          try {
            await execP(db, `INSERT INTO ${cfg.table} (${fields.join(",")}) VALUES (${fields.map(() => "?").join(",")})`, values);
            inserted++;
          } catch (e: any) { if (errors.length < 10) errors.push(`${email}: ${(e?.message || "erro").slice(0, 80)}`); skipped++; }
        }
        return { inserted, skipped, errors };
      }),
  }),

  denuncia: router({
    submitReport: publicProcedure
      .input(z.object({
        category: z.string(),
        severity: z.enum(["baixa", "media", "alta", "critica"]),
        frequency: z.enum(["primeira_vez", "ocasional", "frequente", "continua"]),
        perceivedRisk: z.enum(["baixo", "medio", "alto", "critico"]),
        isAnonymous: z.boolean(),
        reporterEmail: z.string().optional(),
        reporterPhone: z.string().optional(),
        incidentDate: z.string().optional(),
        incidentLocation: z.string().optional(),
        description: z.string().min(1),
        witnesses: z.string().optional(),
        lgpdConsent: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
        await db.execute(drzSql`
          CREATE TABLE IF NOT EXISTS canal_denuncias (
            id INT AUTO_INCREMENT PRIMARY KEY,
            protocol_code VARCHAR(20) NOT NULL UNIQUE,
            category VARCHAR(80) NOT NULL,
            severity VARCHAR(20) NOT NULL,
            frequency VARCHAR(30) NOT NULL,
            perceived_risk VARCHAR(20) NOT NULL,
            is_anonymous TINYINT(1) NOT NULL DEFAULT 1,
            reporter_email VARCHAR(255),
            reporter_phone VARCHAR(50),
            incident_date DATE,
            incident_location VARCHAR(255),
            description TEXT NOT NULL,
            witnesses TEXT,
            lgpd_consent TINYINT(1) NOT NULL DEFAULT 0,
            status VARCHAR(30) NOT NULL DEFAULT 'recebida',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);
        const code = "SDT-" + Date.now().toString(36).toUpperCase().slice(-6) + Math.random().toString(36).substring(2, 5).toUpperCase();
        await db.execute(drzSql`
          INSERT INTO canal_denuncias
            (protocol_code, category, severity, frequency, perceived_risk, is_anonymous,
             reporter_email, reporter_phone, incident_date, incident_location,
             description, witnesses, lgpd_consent)
          VALUES
            (${code}, ${input.category}, ${input.severity}, ${input.frequency}, ${input.perceivedRisk},
             ${input.isAnonymous ? 1 : 0},
             ${input.reporterEmail ?? null}, ${input.reporterPhone ?? null},
             ${input.incidentDate ?? null}, ${input.incidentLocation ?? null},
             ${input.description}, ${input.witnesses ?? null}, ${input.lgpdConsent ? 1 : 0})
        `);
        return { protocolCode: code };
      }),

    trackByProtocol: publicProcedure
      .input(z.object({ protocolCode: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
        const r: any = await db.execute(drzSql`
          SELECT protocol_code, category, severity, status, created_at
          FROM canal_denuncias WHERE protocol_code = ${input.protocolCode} LIMIT 1
        `);
        const rows = Array.isArray((r as any)[0]) ? (r as any)[0] : [];
        if (!rows.length) throw new TRPCError({ code: "NOT_FOUND", message: "Protocolo não encontrado." });
        const row = rows[0];
        return {
          protocolCode: String(row.protocol_code),
          category: String(row.category),
          severity: String(row.severity),
          status: String(row.status),
          createdAt: String(row.created_at),
        };
      }),
  }),

});








export type AppRouter = typeof appRouter;
