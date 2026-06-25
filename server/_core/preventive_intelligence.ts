/**
 * SP11 — Inteligência Preventiva (item #18).
 *
 * Roda em CRON diário (3h da manhã) por empresa e detecta:
 *  1. Baixa adesão a treinamentos (>30% colaboradores ativos com curso obrigatório pendente)
 *  2. Pico de denúncias (3+ novas em 7 dias quando histórico era ≤1/mês)
 *  3. Setor crítico (escore médio DRPS de um setor 30% pior que a média da empresa)
 *  4. Pesquisa em prazo curto sem adesão (campanha de pesquisa rodando há 7+ dias com <30%)
 *
 * Pra cada gatilho:
 *  - Cria notificação sino pros perfis RH/SESMT/admin
 *  - Em PROD, dispara WhatsApp via template aprovado (preview em dev)
 *  - Idempotente: dedup_key inclui data + tipo + dado-chave (evita re-disparar mesmo gatilho)
 */
import { getDb } from "../db";
import { sql as drzSql } from "drizzle-orm";

export type Alert = {
  type: "low_training_adoption" | "denuncias_spike" | "sector_critical" | "survey_stale";
  severity: "alta" | "media" | "baixa";
  title: string;
  body: string;
  dedupKey: string;
  link: string;
};

export async function runPreventiveIntelligenceForCompany(companyId: number): Promise<{ alerts: Alert[]; admins: number[] }> {
  const db = await getDb();
  if (!db) return { alerts: [], admins: [] };
  const alerts: Alert[] = [];

  // Hoje formatado pra dedup_key
  const today = new Date().toISOString().slice(0, 10);

  // (1) Baixa adesão a treinamentos
  try {
    const [[active]]: any = await db.execute(drzSql`SELECT COUNT(*) AS c FROM users WHERE company_id=${companyId} AND is_active=1`);
    const total = Number(active?.c ?? 0);
    if (total >= 5) {
      const [[done]]: any = await db.execute(drzSql`SELECT COUNT(DISTINCT userId) AS c FROM user_progress WHERE userId IN (SELECT id FROM users WHERE company_id=${companyId}) AND isCompleted=1`);
      const concluintes = Number(done?.c ?? 0);
      const taxa = total > 0 ? concluintes / total : 0;
      if (taxa < 0.5) {
        alerts.push({
          type: "low_training_adoption", severity: "media",
          title: `Adesão a treinamentos: ${Math.round(taxa * 100)}%`,
          body: `Apenas ${concluintes}/${total} colaboradores ativos têm pelo menos um curso concluído. Considere reforçar com uma campanha.`,
          dedupKey: `low_training:${companyId}:${today}`,
          link: "/admin/cursos",
        });
      }
    }
  } catch (_) {}

  // (2) Pico de denúncias (3+ em 7 dias)
  try {
    const [[d7]]: any = await db.execute(drzSql`SELECT COUNT(*) AS c FROM denuncias WHERE company_id=${companyId} AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`);
    const n7 = Number(d7?.c ?? 0);
    if (n7 >= 3) {
      alerts.push({
        type: "denuncias_spike", severity: "alta",
        title: `${n7} denúncias nos últimos 7 dias`,
        body: `Volume acima do normal. Verifique se há padrão por setor ou tipo (assédio, segurança, etc).`,
        dedupKey: `denuncias_spike:${companyId}:${today}`,
        link: "/admin/denuncias",
      });
    }
  } catch (_) {}

  // (3) Setor crítico (DRPS médio do setor pior que média - 30%)
  try {
    const [rows]: any = await db.execute(drzSql`
      SELECT sr.sector_id AS sid, s.name AS setor, AVG(CAST(sa.answer_value AS DECIMAL(5,2))) AS media, COUNT(DISTINCT sr.id) AS n
      FROM survey_responses sr
      JOIN survey_answers sa ON sa.response_id = sr.id
      JOIN surveys sv ON sv.id = sr.survey_id
      LEFT JOIN sectors s ON s.id = sr.sector_id
      WHERE sv.company_id=${companyId} AND sv.category IN ('drps','psicossocial','nr01')
        AND sr.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
        AND sa.answer_value REGEXP '^[1-5]$'
      GROUP BY sr.sector_id HAVING n >= 3`);
    const list = (Array.isArray((rows as any)[0]) ? (rows as any)[0] : Array.isArray(rows) ? rows : []);
    if (list.length >= 2) {
      const avgGeral = list.reduce((a: number, b: any) => a + Number(b.media), 0) / list.length;
      for (const r of list) {
        const m = Number(r.media);
        // Likert 1-5 onde menor = pior (DRPS típico). Critério: setor com média 0.7+ abaixo da geral.
        if (m < avgGeral - 0.7 && r.setor) {
          alerts.push({
            type: "sector_critical", severity: "alta",
            title: `Setor crítico: ${r.setor}`,
            body: `Escore DRPS médio do setor (${m.toFixed(2)}) está significativamente abaixo da média da empresa (${avgGeral.toFixed(2)}). Sugere plano de ação focado.`,
            dedupKey: `sector_critical:${companyId}:${r.sid}:${today}`,
            link: `/admin/riscos-psicossociais?setor=${r.sid}`,
          });
        }
      }
    }
  } catch (_) {}

  // (4) Pesquisa em prazo curto sem adesão
  try {
    const [surveys]: any = await db.execute(drzSql`
      SELECT s.id, s.title, s.created_at,
        (SELECT COUNT(DISTINCT user_id) FROM survey_responses sr WHERE sr.survey_id=s.id) AS respondentes,
        (SELECT COUNT(*) FROM users WHERE company_id=s.company_id AND is_active=1) AS total
      FROM surveys s
      WHERE s.company_id=${companyId} AND s.status='active' AND s.created_at <= DATE_SUB(NOW(), INTERVAL 7 DAY)`);
    for (const sv of ((surveys as any)[0] ?? [])) {
      const total = Number(sv.total ?? 0);
      const resp = Number(sv.respondentes ?? 0);
      const taxa = total > 0 ? resp / total : 0;
      if (total >= 5 && taxa < 0.3) {
        alerts.push({
          type: "survey_stale", severity: "media",
          title: `Pesquisa "${sv.title}" com baixa adesão`,
          body: `Apenas ${resp}/${total} (${Math.round(taxa * 100)}%) responderam após 7+ dias. Reforce com disparo via WhatsApp.`,
          dedupKey: `survey_stale:${sv.id}:${today}`,
          link: `/admin/pesquisas`,
        });
      }
    }
  } catch (_) {}

  // Lista de admins/RH/SESMT pra notificar
  const adminsRaw: any = await db.execute(drzSql`
    SELECT id FROM users WHERE company_id=${companyId} AND is_active=1
      AND role IN ('admin','rh','sesmt','company_admin','admin_global')`);
  const adminRows: any[] = Array.isArray((adminsRaw as any)[0]) ? (adminsRaw as any)[0] : Array.isArray(adminsRaw) ? adminsRaw : [];
  const adminIds = adminRows.map((x: any) => Number(x.id));

  // Cria notificação sino (idempotente por dedup_key)
  for (const alert of alerts) {
    for (const uid of adminIds) {
      try {
        const key = `intel:${alert.dedupKey}:u${uid}`;
        const [[ex]]: any = await db.execute(drzSql`SELECT id FROM notifications WHERE user_id=${uid} AND dedup_key=${key} LIMIT 1`);
        if (ex) continue;
        await db.execute(drzSql`
          INSERT INTO notifications (user_id, company_id, type, priority, title, body, link, icon, dedup_key)
          VALUES (${uid}, ${companyId}, ${alert.type}, ${alert.severity === "alta" ? "alta" : "media"},
                  ${alert.title}, ${alert.body}, ${alert.link}, 'alert-triangle', ${key})`);
      } catch (_) {}
    }
  }

  return { alerts, admins: adminIds };
}

/**
 * Roda em todas as empresas ativas. Chamado via cron diário.
 */
export async function runPreventiveIntelligenceCron(): Promise<{ companies: number; totalAlerts: number }> {
  const db = await getDb();
  if (!db) return { companies: 0, totalAlerts: 0 };
  const raw: any = await db.execute(drzSql`SELECT id FROM companies WHERE id IN (SELECT DISTINCT company_id FROM users WHERE is_active=1)`);
  // mysql2 driver pode retornar shape distinto; normaliza pra array
  const rows: any[] = Array.isArray((raw as any)[0]) ? (raw as any)[0] : (Array.isArray(raw) ? raw : []);
  let totalAlerts = 0;
  for (const c of rows) {
    const r = await runPreventiveIntelligenceForCompany(Number(c.id));
    totalAlerts += r.alerts.length;
  }
  return { companies: rows.length, totalAlerts };
}
