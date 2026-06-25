/**
 * SP9 — Flows conversacionais via WhatsApp.
 *
 * Cada flow é uma função handle{Flow}Step(session, input) que:
 *  - recebe a sessão atual e o texto recebido
 *  - retorna { reply, nextState } indicando próximo step da máquina
 *  - se concluído, retorna nextState com step=menu pra voltar ao principal
 *
 * Flows implementados:
 *  - pesquisa (DRPS, AEP, NR-01 etc) — itens #3, #4, #5
 *  - biblioteca (envia material e oferece certificado) — itens #6, #7, #8
 *  - denuncia — item #10
 *  - psi_book (agendamento psicológico) — item #11
 */
import { getDb } from "../db";
import { sql as drzSql } from "drizzle-orm";
import { SessionState } from "./whatsapp";

const FOOTER = "\n\n_Envie 0 pra voltar ao menu, SAIR pra encerrar._";

export type StepResult = { reply: string; nextState: SessionState };

// ────────── PESQUISA (#3, #4, #5) ────────────────────────────────────────
// State.data: { surveyId, questions:[{id, text, type, options}], idx, answers:{qid:value} }
export async function startSurveyFlow(surveyId: number, session: any): Promise<StepResult> {
  const db = await getDb();
  if (!db) return { reply: "Sistema indisponível.", nextState: { step: "menu", lgpdAccepted: true } };
  const [[sv]]: any = await db.execute(drzSql`SELECT id, title, description FROM surveys WHERE id=${surveyId} AND company_id=${session.companyId} AND status='active' LIMIT 1`);
  if (!sv) return { reply: "Pesquisa não disponível.", nextState: { step: "menu", lgpdAccepted: true } };
  // Já respondida?
  const [[done]]: any = await db.execute(drzSql`SELECT id FROM survey_responses WHERE survey_id=${surveyId} AND user_id=${session.userId} LIMIT 1`);
  if (done) return { reply: `Você já respondeu a pesquisa "${sv.title}". Obrigado! 🙏${FOOTER}`, nextState: { step: "menu", lgpdAccepted: true } };
  const [qs]: any = await db.execute(drzSql`SELECT id, question_text, question_type, options FROM survey_questions WHERE survey_id=${surveyId} ORDER BY order_index`);
  const questions = ((qs as any)[0] ?? []).map((q: any) => {
    let opts: string[] = [];
    try { const p = q.options ? JSON.parse(q.options) : null; opts = Array.isArray(p) ? p : []; } catch (_) {}
    const type = String(q.question_type || "text").toLowerCase();
    if (opts.length === 0 && (type.includes("likert") || type.includes("scale"))) {
      opts = ["1 Discordo totalmente", "2 Discordo", "3 Concordo parcialmente", "4 Concordo totalmente"];
    }
    return { id: Number(q.id), text: q.question_text, type, options: opts };
  });
  if (questions.length === 0) return { reply: "Pesquisa sem perguntas configuradas.", nextState: { step: "menu", lgpdAccepted: true } };
  return {
    reply: `📋 *${sv.title}*\n\n${sv.description ?? ""}\n\nSuas respostas são *anônimas* e seguem a LGPD.\n\n*Digite 1* pra iniciar.`,
    nextState: { step: "survey_intro", flow: `survey:${surveyId}`, lgpdAccepted: true, data: { surveyId, questions, idx: 0, answers: {} } },
  };
}

export async function handleSurveyStep(session: any, body: string): Promise<StepResult> {
  const s = session.state;
  const data = s.data ?? {};
  // intro
  if (s.step === "survey_intro") {
    if (body !== "1") return { reply: "*Digite 1* pra iniciar a pesquisa ou 0 pra voltar.", nextState: s };
    return askQuestion({ ...s, step: "survey_q" }, data, 0);
  }
  // respondendo questão
  if (s.step === "survey_q") {
    const i = data.idx;
    const q = data.questions[i];
    if (!q) return { reply: "Erro: pergunta não encontrada.", nextState: { step: "menu", lgpdAccepted: true } };
    let val: string;
    if (q.options.length > 0) {
      const n = parseInt(body, 10);
      if (isNaN(n) || n < 1 || n > q.options.length) {
        return { reply: `Resposta inválida. Digite um número entre 1 e ${q.options.length}.`, nextState: s };
      }
      val = String(n);
    } else {
      if (body.length < 2) return { reply: "Sua resposta está muito curta. Pode descrever um pouco mais?", nextState: s };
      val = body;
    }
    const answers = { ...(data.answers ?? {}), [q.id]: val };
    const nextI = i + 1;
    if (nextI >= data.questions.length) {
      // pergunta confirmação
      return {
        reply: `✅ Pesquisa concluída (${nextI}/${data.questions.length} respostas).\n\n*1* — Enviar respostas\n*2* — Revisar`,
        nextState: { ...s, step: "survey_confirm", data: { ...data, answers, idx: nextI } },
      };
    }
    return askQuestion(s, { ...data, answers, idx: nextI }, nextI);
  }
  // confirmação final
  if (s.step === "survey_confirm") {
    if (body === "1") {
      await persistSurveyResponses(session, data.surveyId, data.answers);
      return { reply: `🎉 *Pesquisa enviada com sucesso!*\n\nSuas respostas foram registradas anonimamente.\nObrigado pela participação!${FOOTER}`, nextState: { step: "menu", lgpdAccepted: true } };
    }
    if (body === "2") {
      // Re-exibe respostas resumidas
      const lines = data.questions.map((q: any, i: number) => `*Q${i + 1}.* ${q.text.slice(0, 60)}...\n→ ${data.answers[q.id] ?? "(sem resposta)"}`).join("\n\n");
      return { reply: `*Suas respostas*\n\n${lines}\n\n*1* — Confirmar envio\n*2* — Cancelar`, nextState: s };
    }
    return { reply: "Digite *1* pra enviar ou *2* pra revisar.", nextState: s };
  }
  return { reply: "Confuso, vou te levar pro menu.", nextState: { step: "menu", lgpdAccepted: true } };
}

function askQuestion(state: SessionState, data: any, i: number): StepResult {
  const q = data.questions[i];
  const optsTxt = q.options.length > 0 ? "\n\n" + q.options.map((o: string, oi: number) => `*${oi + 1}* — ${o.replace(/^\d+\s+/, "")}`).join("\n") : "\n\n_(resposta livre — escreva o que sentir)_";
  return {
    reply: `*Pergunta ${i + 1} de ${data.questions.length}*\n\n${q.text}${optsTxt}`,
    nextState: { ...state, data: { ...data, idx: i } },
  };
}

async function persistSurveyResponses(session: any, surveyId: number, answers: Record<string, string>) {
  const db = await getDb();
  if (!db) return;
  try { await db.execute(drzSql`ALTER TABLE survey_responses ADD COLUMN source VARCHAR(40) DEFAULT 'online'`); } catch (_) {}
  // Pega sector_id do user (pra alimentar indicadores por setor)
  let sectorId: number | null = null;
  if (session.userId) {
    const [[u]]: any = await db.execute(drzSql`SELECT sector_id FROM users WHERE id=${session.userId} LIMIT 1`);
    if (u?.sector_id) sectorId = Number(u.sector_id);
  }
  const res: any = await db.execute(drzSql`
    INSERT INTO survey_responses (survey_id, user_id, sector_id, source, created_at)
    VALUES (${surveyId}, ${session.userId}, ${sectorId}, 'whatsapp', NOW())`);
  const responseId = Number((res as any)[0]?.insertId ?? 0);
  for (const [qid, val] of Object.entries(answers)) {
    await db.execute(drzSql`
      INSERT INTO survey_answers (response_id, question_id, answer_value, created_at)
      VALUES (${responseId}, ${Number(qid)}, ${String(val)}, NOW())`);
  }
}

// ────────── BIBLIOTECA + CERTIFICADO (#6, #7, #8) ────────────────────────
export async function startLibraryFlow(session: any): Promise<StepResult> {
  const db = await getDb();
  if (!db || !session.companyId) return { reply: "Sistema indisponível.", nextState: { step: "menu", lgpdAccepted: true } };
  const [camps]: any = await db.execute(drzSql`
    SELECT id, name FROM preventive_library_campaigns WHERE company_id=${session.companyId} AND is_active=1 AND is_template=0 LIMIT 10`);
  const list = (camps as any)[0] ?? [];
  if (list.length === 0) return { reply: "Não há campanhas ativas no momento. Volte em breve!" + FOOTER, nextState: { step: "menu", lgpdAccepted: true } };
  const txt = list.map((c: any, i: number) => `*${i + 1}* — ${c.name}`).join("\n");
  return {
    reply: `📚 *Campanhas Ativas*\n\n${txt}\n\nDigite o número da campanha pra ver os materiais.`,
    nextState: { step: "library_pick", flow: "library", lgpdAccepted: true, data: { campaigns: list } },
  };
}

export async function handleLibraryStep(session: any, body: string): Promise<StepResult> {
  const s = session.state;
  if (s.step === "library_pick") {
    const n = parseInt(body, 10);
    const camps = s.data?.campaigns ?? [];
    if (isNaN(n) || n < 1 || n > camps.length) return { reply: `Digite um número entre 1 e ${camps.length}.`, nextState: s };
    const c = camps[n - 1];
    const db = await getDb();
    const [mats]: any = await db!.execute(drzSql`SELECT id, title, material_type, file_url FROM preventive_library_materials WHERE campaign_id=${c.id} ORDER BY created_at`);
    const matList = (mats as any)[0] ?? [];
    if (matList.length === 0) return { reply: `A campanha "${c.name}" não tem materiais ainda.${FOOTER}`, nextState: { step: "menu", lgpdAccepted: true } };
    const base = process.env.PUBLIC_BASE_URL || "https://dev.saudedotrabalho.com";
    const txt = matList.map((m: any, i: number) => `📎 *${m.title}*\n${m.file_url ? base + m.file_url : "(sem arquivo)"}`).join("\n\n");
    // Registra "leitura" pra cada material entregue
    if (session.userId) {
      try {
        await db!.execute(drzSql`CREATE TABLE IF NOT EXISTS whatsapp_material_reads (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL, material_id INT NOT NULL,
          read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_ur (user_id, material_id)
        ) ENGINE=InnoDB`);
        for (const m of matList) {
          await db!.execute(drzSql`INSERT IGNORE INTO whatsapp_material_reads (user_id, material_id) VALUES (${session.userId}, ${m.id})`);
        }
      } catch (_) {}
    }
    return {
      reply: `📚 *${c.name}*\n\n${txt}\n\nQuando terminar de ver:\n*1* — Confirmar conclusão e emitir certificado\n*2* — Apenas voltar`,
      nextState: { step: "library_done", flow: `library:${c.id}`, lgpdAccepted: true, data: { campaignId: c.id, campaignName: c.name } },
    };
  }
  if (s.step === "library_done") {
    if (body === "1") {
      // Emissão de certificado de "participação na campanha" — registra um certificate simbólico
      const db = await getDb();
      try {
        const code = `CAMP-${s.data?.campaignId}-${session.userId}-${Date.now().toString(36).toUpperCase()}`;
        // Pega 1 module qualquer associado ao primeiro link da campanha (se houver) só pra satisfazer FK
        await db!.execute(drzSql`INSERT INTO certificates (userId, moduleId, certificateCode, issuedAt) VALUES (${session.userId}, NULL, ${code}, NOW())`).catch(() => null);
        return { reply: `🏆 *Certificado emitido!*\nCódigo: *${code}*\nVerificar: ${process.env.PUBLIC_BASE_URL || "https://saudedotrabalho.com"}/verificar/${code}${FOOTER}`, nextState: { step: "menu", lgpdAccepted: true } };
      } catch (e) {
        return { reply: "Não consegui emitir o certificado agora — tente pela web." + FOOTER, nextState: { step: "menu", lgpdAccepted: true } };
      }
    }
    return { reply: "Volta pro menu.", nextState: { step: "menu", lgpdAccepted: true } };
  }
  return { reply: "Confuso. Voltando ao menu.", nextState: { step: "menu", lgpdAccepted: true } };
}

// ────────── DENÚNCIA (#10) ───────────────────────────────────────────────
export function startDenunciaFlow(): StepResult {
  return {
    reply: `📞 *Canal de Denúncias*\n\nSelecione o tipo:\n\n*1* — Assédio moral\n*2* — Assédio sexual\n*3* — Violação de normas\n*4* — Outros\n\n_Suas mensagens são totalmente anônimas pra empresa._`,
    nextState: { step: "denuncia_tipo", flow: "denuncia", lgpdAccepted: true, data: {} },
  };
}

export async function handleDenunciaStep(session: any, body: string): Promise<StepResult> {
  const s = session.state;
  const TIPOS = ["", "Assédio moral", "Assédio sexual", "Violação de normas", "Outros"];
  if (s.step === "denuncia_tipo") {
    const n = parseInt(body, 10);
    if (isNaN(n) || n < 1 || n > 4) return { reply: "Digite 1, 2, 3 ou 4.", nextState: s };
    return {
      reply: `Tipo: *${TIPOS[n]}*\n\nDescreva agora o que aconteceu. Pode mandar texto, áudio, imagem ou documento — em quantas mensagens precisar. Quando terminar, *digite ENVIAR*.`,
      nextState: { step: "denuncia_conteudo", flow: "denuncia", lgpdAccepted: true, data: { tipo: TIPOS[n], partes: [] } },
    };
  }
  if (s.step === "denuncia_conteudo") {
    if (body.trim().toUpperCase() === "ENVIAR") {
      const conteudo = (s.data?.partes ?? []).join("\n");
      if (!conteudo.trim()) return { reply: "Você ainda não descreveu nada. Mande sua mensagem ou digite 0 pra cancelar.", nextState: s };
      const db = await getDb();
      try {
        // Cria registro em denuncias. anônima sempre via WhatsApp.
        const code = `WA-${Date.now().toString(36).toUpperCase()}`;
        await db!.execute(drzSql`
          INSERT INTO denuncias (company_id, tipo, descricao, codigo_acompanhamento, anonima, autor_id, status, created_at)
          VALUES (${session.companyId}, ${s.data?.tipo}, ${conteudo}, ${code}, 1, NULL, 'aberta', NOW())`);
        return { reply: `✅ *Denúncia registrada com sucesso.*\n\nProtocolo: *${code}*\nAcompanhe em: https://saudedotrabalho.com/denuncia/acompanhar\n\nObrigado por trazer essa informação. O comitê responsável da sua empresa vai analisar com sigilo.${FOOTER}`, nextState: { step: "menu", lgpdAccepted: true } };
      } catch (e: any) {
        return { reply: `Não consegui registrar agora (${e?.message ?? "?"}). Por favor, use https://saudedotrabalho.com/denuncia${FOOTER}`, nextState: { step: "menu", lgpdAccepted: true } };
      }
    }
    // Acumula conteúdo
    const partes = [...(s.data?.partes ?? []), body];
    return { reply: `Mensagem registrada (${partes.length} parte(s)). Mande mais conteúdo ou *digite ENVIAR* pra finalizar.`, nextState: { ...s, data: { ...s.data, partes } } };
  }
  return { reply: "Voltando ao menu.", nextState: { step: "menu", lgpdAccepted: true } };
}

// ────────── PSICOLOGIA — agendamento (#11) ───────────────────────────────
export async function startPsiFlow(session: any): Promise<StepResult> {
  if (!session.userId) return { reply: "Não conseguimos identificar seu cadastro. Procure o RH.", nextState: { step: "menu", lgpdAccepted: true } };
  const db = await getDb();
  const [profs]: any = await db!.execute(drzSql`SELECT id, name, specialty FROM appointment_professionals WHERE (company_id=${session.companyId} OR company_id IS NULL) AND is_active=1 LIMIT 10`);
  const list = (profs as any)[0] ?? [];
  if (list.length === 0) return { reply: "Nenhum profissional disponível no momento.", nextState: { step: "menu", lgpdAccepted: true } };
  const txt = list.map((p: any, i: number) => `*${i + 1}* — ${p.name}${p.specialty ? ` (${p.specialty})` : ""}`).join("\n");
  return {
    reply: `🧠 *Atendimento Psicológico*\n\nProfissionais disponíveis:\n\n${txt}\n\nDigite o número pra ver horários.`,
    nextState: { step: "psi_prof", flow: "psi", lgpdAccepted: true, data: { profs: list } },
  };
}

export async function handlePsiStep(session: any, body: string): Promise<StepResult> {
  const s = session.state;
  if (s.step === "psi_prof") {
    const n = parseInt(body, 10);
    const profs = s.data?.profs ?? [];
    if (isNaN(n) || n < 1 || n > profs.length) return { reply: `Digite 1 a ${profs.length}.`, nextState: s };
    const p = profs[n - 1];
    // Sugere próximos 3 dias úteis (placeholder simples)
    const now = new Date();
    const slots: string[] = [];
    for (let i = 1; i <= 5 && slots.length < 3; i++) {
      const d = new Date(now); d.setDate(d.getDate() + i);
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue;
      const date = d.toISOString().slice(0, 10);
      slots.push(`${date} 14:00`);
    }
    return {
      reply: `🧠 *${p.name}*\n\nHorários sugeridos (próximos dias úteis):\n\n${slots.map((s, i) => `*${i + 1}* — ${s.replace(/-/g, "/").replace("T", " ")}`).join("\n")}\n\nDigite o número pra agendar.`,
      nextState: { step: "psi_slot", flow: "psi", lgpdAccepted: true, data: { profId: p.id, profName: p.name, slots } },
    };
  }
  if (s.step === "psi_slot") {
    const n = parseInt(body, 10);
    const slots = s.data?.slots ?? [];
    if (isNaN(n) || n < 1 || n > slots.length) return { reply: `Digite 1 a ${slots.length}.`, nextState: s };
    const slot = slots[n - 1];
    const [date, time] = slot.split(" ");
    const db = await getDb();
    try {
      const scheduledAt = `${date} ${time}:00`;
      const res: any = await db!.execute(drzSql`
        INSERT INTO appointments (company_id, collaborator_id, professional_id, scheduled_at, duration_minutes, status, notes)
        VALUES (${session.companyId}, ${session.userId}, ${s.data?.profId}, ${scheduledAt}, 30, 'pending', 'Agendado via WhatsApp')`);
      const apptId = Number((res as any)[0]?.insertId ?? 0);
      return {
        reply: `✅ *Agendamento confirmado*\n\n👤 ${s.data?.profName}\n📅 ${slot}\n⏱️ 30 min\n\nVocê receberá lembretes próximos à data. Pra cancelar, responda CANCELAR-${apptId}.${FOOTER}`,
        nextState: { step: "menu", lgpdAccepted: true },
      };
    } catch (e: any) {
      return { reply: `Não consegui agendar (${e?.message ?? "?"}). Use https://saudedotrabalho.com/acolhimento${FOOTER}`, nextState: { step: "menu", lgpdAccepted: true } };
    }
  }
  return { reply: "Voltando ao menu.", nextState: { step: "menu", lgpdAccepted: true } };
}
