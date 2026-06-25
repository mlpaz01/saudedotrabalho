/**
 * SP7 — State machine para conversas WhatsApp.
 *
 * Cada mensagem entrante passa por handleIncomingMessage(phone, body) e o
 * resultado é a próxima resposta a enviar. Estado persistido em
 * whatsapp_sessions.state (JSON).
 *
 * Flows implementados nesta sprint:
 *  - init (primeira interação): pede aceite LGPD
 *  - menu (item #9): 0-9 opções
 *  - opt-out: registra e responde encerramento
 *
 * Outros flows (pesquisa, biblioteca, denúncia, psi, IA) entram nas Sprints 9-10.
 */
import { getSession, setSessionState, sendWhatsappText, isOptOutMessage, registerOptOut, SessionState } from "./whatsapp";
import {
  startSurveyFlow, handleSurveyStep,
  startLibraryFlow, handleLibraryStep,
  startDenunciaFlow, handleDenunciaStep,
  startPsiFlow, handlePsiStep,
} from "./whatsapp_flows";

const MENU_TEXT =
`*Plataforma Saúde do Trabalho*
Olá! Em que posso ajudar?

*1* — Meus treinamentos pendentes
*2* — Pesquisas pendentes
*3* — Meus certificados
*4* — Biblioteca preventiva
*5* — Canal de denúncias
*6* — Solicitar atendimento psicológico
*7* — Falar com RH
*8* — Atualizar meu cadastro
*9* — Consultar histórico

Digite o número da opção. Em qualquer momento, envie *SAIR* para parar de receber mensagens.`;

const LGPD_TEXT =
`Olá! Você está em contato com a *Plataforma Saúde do Trabalho*.

Suas mensagens são tratadas conforme a *LGPD (Lei 13.709/2018)* e o conteúdo
poderá alimentar indicadores anônimos de gestão de riscos psicossociais (NR-01).

*Digite 1* para concordar e iniciar.
*Digite SAIR* para encerrar.`;

const FOOTER_SAIR = "\n\n_Envie SAIR pra parar de receber mensagens._";

export async function handleIncomingMessage(phoneE164: string, bodyRaw: string | null): Promise<{ reply: string | null }> {
  const body = (bodyRaw ?? "").trim();
  const session = await getSession(phoneE164);

  // 1. Opt-out — bloqueia qualquer outra interação
  if (body && isOptOutMessage(body)) {
    await registerOptOut(phoneE164, "user_keyword");
    return { reply: "Você foi removido(a) da nossa lista de contatos. Não enviaremos mais mensagens. Caso mude de ideia, fale com o RH da sua empresa." };
  }

  const s = session.state || { step: "init" };

  // 2. Primeira interação ou LGPD pendente
  if (s.step === "init" || (!s.lgpdAccepted && s.step !== "menu")) {
    if (s.step === "init") {
      await setSessionState(phoneE164, { step: "lgpd_pending" });
      return { reply: LGPD_TEXT };
    }
    // Estado lgpd_pending: espera "1"
    if (body === "1") {
      await setSessionState(phoneE164, { step: "menu", lgpdAccepted: true });
      return { reply: MENU_TEXT };
    }
    return { reply: "Por favor, *digite 1* para concordar com a LGPD e continuar. Digite SAIR para encerrar." };
  }

  // SP9 — Flows ativos: roteia direto pro handler do flow
  if (s.flow && s.step !== "menu") {
    if (s.flow.startsWith("survey:")) {
      const r = await handleSurveyStep(session, body); await setSessionState(phoneE164, r.nextState); return { reply: r.reply };
    }
    if (s.flow.startsWith("library")) {
      const r = await handleLibraryStep(session, body); await setSessionState(phoneE164, r.nextState); return { reply: r.reply };
    }
    if (s.flow === "denuncia") {
      const r = await handleDenunciaStep(session, body); await setSessionState(phoneE164, r.nextState); return { reply: r.reply };
    }
    if (s.flow === "psi") {
      const r = await handlePsiStep(session, body); await setSessionState(phoneE164, r.nextState); return { reply: r.reply };
    }
  }

  // 3. Menu principal
  if (s.step === "menu" || body === "0") {
    const opt = body;
    switch (opt) {
      case "1": return { reply: await formatPendingTrainings(session) };
      case "2": {
        // Lista pesquisas pendentes e oferece iniciar a primeira
        const list = await listPendingSurveysForUser(session);
        if (list.length === 0) return { reply: "✅ Nenhuma pesquisa pendente." + FOOTER_SAIR };
        // Inicia a primeira automaticamente
        const r = await startSurveyFlow(list[0].id, session); await setSessionState(phoneE164, r.nextState); return { reply: r.reply };
      }
      case "3": return { reply: await formatMyCertificates(session) };
      case "4": {
        const r = await startLibraryFlow(session); await setSessionState(phoneE164, r.nextState); return { reply: r.reply };
      }
      case "5": {
        const r = startDenunciaFlow(); await setSessionState(phoneE164, r.nextState); return { reply: r.reply };
      }
      case "6": {
        const r = await startPsiFlow(session); await setSessionState(phoneE164, r.nextState); return { reply: r.reply };
      }
      case "7": return { reply: "📧 *Falar com RH*\n\nEntre em contato com o RH da sua empresa pelos canais internos." + FOOTER_SAIR };
      case "8": return { reply: "✏️ *Atualizar cadastro*\n\nVocê pode atualizar seus dados em https://saudedotrabalho.com/perfil" + FOOTER_SAIR };
      case "9": return { reply: await formatMyHistory(session) };
      case "0": case "menu": case "MENU":
        await setSessionState(phoneE164, { step: "menu", lgpdAccepted: true });
        return { reply: MENU_TEXT };
      default:
        // SP10 — texto livre vira IA conversacional. Detectamos números de menu acima;
        // qualquer outra coisa cai aqui e a IA responde com contexto + tools.
        if (body.length >= 2) {
          const { askAi } = await import("./whatsapp_ai");
          const ai = await askAi(body, { userId: session.userId, companyId: session.companyId });
          // Se a IA quer mudar pra um fluxo (psi/denuncia), inicia o flow
          if (ai.switchFlow === "psi") {
            const { startPsiFlow } = await import("./whatsapp_flows");
            const r = await startPsiFlow(session); await setSessionState(phoneE164, r.nextState);
            return { reply: ai.reply + "\n\n———\n\n" + r.reply };
          }
          if (ai.switchFlow === "denuncia") {
            const { startDenunciaFlow } = await import("./whatsapp_flows");
            const r = startDenunciaFlow(); await setSessionState(phoneE164, r.nextState);
            return { reply: ai.reply + "\n\n———\n\n" + r.reply };
          }
          return { reply: ai.reply + FOOTER_SAIR };
        }
        return { reply: "Não entendi. " + MENU_TEXT };
    }
  }

  // 4. Fallback: volta pro menu
  await setSessionState(phoneE164, { step: "menu", lgpdAccepted: true });
  return { reply: MENU_TEXT };
}

async function listPendingSurveysForUser(session: any): Promise<Array<{ id: number; title: string }>> {
  if (!session.userId || !session.companyId) return [];
  const { getDb } = await import("../db");
  const { sql: drzSql } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) return [];
  const r: any = await db.execute(drzSql`
    SELECT s.id, s.title FROM surveys s
    WHERE s.company_id=${session.companyId} AND s.status='active'
      AND NOT EXISTS (SELECT 1 FROM survey_responses sr WHERE sr.survey_id=s.id AND sr.user_id=${session.userId})
    LIMIT 5`);
  return (((r as any)[0]) ?? []).map((x: any) => ({ id: Number(x.id), title: String(x.title) }));
}

// ─── Helpers de consulta de dados do colaborador ──────────────────────────
// Versão básica sprint 7; será expandida na sprint 10 (IA com tools).
async function formatPendingTrainings(session: any): Promise<string> {
  if (!session.userId) return "Não conseguimos identificar seu cadastro. Procure o RH da sua empresa.";
  const { getDb } = await import("../db");
  const { sql: drzSql } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) return "Sistema temporariamente indisponível.";
  const r: any = await db.execute(drzSql`
    SELECT m.title FROM modules m
    LEFT JOIN user_progress p ON p.moduleId=m.id AND p.userId=${session.userId}
    WHERE m.isActive=1 AND (p.isCompleted IS NULL OR p.isCompleted=0)
    LIMIT 10`);
  const rows = (r as any)[0] ?? [];
  if (rows.length === 0) return "🎉 Você está em dia com todos os treinamentos obrigatórios!" + FOOTER_SAIR;
  const lista = rows.map((x: any, i: number) => `${i + 1}. ${x.title}`).join("\n");
  return `📚 *Treinamentos pendentes (${rows.length})*\n\n${lista}\n\nAcesse https://saudedotrabalho.com/cursos para iniciar.` + FOOTER_SAIR;
}

async function formatPendingSurveys(session: any): Promise<string> {
  if (!session.userId) return "Não conseguimos identificar seu cadastro. Procure o RH da sua empresa.";
  const { getDb } = await import("../db");
  const { sql: drzSql } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) return "Sistema temporariamente indisponível.";
  const r: any = await db.execute(drzSql`
    SELECT s.id, s.title FROM surveys s
    WHERE s.company_id=${session.companyId} AND s.status='active'
      AND NOT EXISTS (SELECT 1 FROM survey_responses sr WHERE sr.survey_id=s.id AND sr.user_id=${session.userId})
    LIMIT 10`);
  const rows = (r as any)[0] ?? [];
  if (rows.length === 0) return "✅ Nenhuma pesquisa pendente." + FOOTER_SAIR;
  const lista = rows.map((x: any, i: number) => `${i + 1}. ${x.title}`).join("\n");
  return `📋 *Pesquisas pendentes (${rows.length})*\n\n${lista}\n\nA resposta via WhatsApp estará disponível em breve. Por enquanto: https://saudedotrabalho.com/pesquisas` + FOOTER_SAIR;
}

async function formatMyCertificates(session: any): Promise<string> {
  if (!session.userId) return "Não conseguimos identificar seu cadastro.";
  const { getDb } = await import("../db");
  const { sql: drzSql } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) return "Sistema temporariamente indisponível.";
  const r: any = await db.execute(drzSql`
    SELECT c.certificateCode, m.title, c.issuedAt FROM certificates c
    LEFT JOIN modules m ON m.id=c.moduleId
    WHERE c.userId=${session.userId} ORDER BY c.issuedAt DESC LIMIT 10`);
  const rows = (r as any)[0] ?? [];
  if (rows.length === 0) return "Você ainda não tem certificados emitidos." + FOOTER_SAIR;
  const lista = rows.map((x: any) => `• ${x.title} — código *${x.certificateCode}*`).join("\n");
  return `🏆 *Seus certificados (${rows.length})*\n\n${lista}\n\nVerificar autenticidade: https://saudedotrabalho.com/verificar/CODIGO` + FOOTER_SAIR;
}

async function formatMyHistory(session: any): Promise<string> {
  if (!session.userId) return "Não conseguimos identificar seu cadastro.";
  const { getDb } = await import("../db");
  const { sql: drzSql } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) return "Sistema temporariamente indisponível.";
  const [cur]: any = await db.execute(drzSql`SELECT COUNT(*) AS c FROM user_progress WHERE userId=${session.userId}`);
  const [done]: any = await db.execute(drzSql`SELECT COUNT(*) AS c FROM user_progress WHERE userId=${session.userId} AND isCompleted=1`);
  const [surv]: any = await db.execute(drzSql`SELECT COUNT(*) AS c FROM survey_responses WHERE user_id=${session.userId}`);
  const [cert]: any = await db.execute(drzSql`SELECT COUNT(*) AS c FROM certificates WHERE userId=${session.userId}`);
  return `📊 *Seu histórico*\n\n• Cursos iniciados: ${(cur as any)[0]?.c ?? 0}\n• Cursos concluídos: ${(done as any)[0]?.c ?? 0}\n• Pesquisas respondidas: ${(surv as any)[0]?.c ?? 0}\n• Certificados: ${(cert as any)[0]?.c ?? 0}` + FOOTER_SAIR;
}
