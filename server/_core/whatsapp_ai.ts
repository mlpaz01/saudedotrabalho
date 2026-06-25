/**
 * SP10 — Assistente IA conversacional via WhatsApp.
 *
 * Stack:
 *  - GROQ Llama 3.3 70b (mesma chave que já uso pra IA do GSE)
 *  - Function calling (tools): consultar dados do colaborador, registrar
 *    protocolo, encaminhar pra psicólogo, criar denúncia
 *  - Guard "acolhe + encaminha" pra sinais de saúde mental — nunca terapia
 *    automatizada
 *  - Knowledge base inline com NR-01 / processos da plataforma (resumo)
 *
 * Tools disponíveis:
 *  - get_my_trainings: lista treinos pendentes/concluídos do user
 *  - get_my_surveys: pesquisas pendentes
 *  - get_my_certificates: certificados emitidos
 *  - get_my_history: contadores agregados
 *  - create_protocol: registra solicitação em protocolos (item #17)
 *  - request_psi_appointment: encaminha agendamento (entra no flow psi)
 *  - file_complaint: encaminha pra fluxo denúncia
 */
import { getDb } from "../db";
import { sql as drzSql } from "drizzle-orm";

const SYSTEM_PROMPT = `Você é a assistente virtual da Plataforma Saúde do Trabalho, falando com colaboradores pelo WhatsApp.

REGRAS DURAS:
- Linguagem: PT-BR informal-respeitosa, frases curtas. Sem jargão técnico salvo se perguntado.
- NUNCA invente dados. Se não souber, use uma tool ou diga "não tenho essa informação aqui — peça pro RH da sua empresa".
- Sinais de sofrimento intenso (ideação suicida, autolesão, "não aguento mais"): NÃO converse a fundo. Responda com acolhimento curto + encaminhamento direto: "Sinto muito que você esteja se sentindo assim. Vou te conectar com um psicólogo agora." e use a tool request_psi_appointment.
- NÃO faça diagnóstico, NÃO prescreva, NÃO indique terapia automática. Você é acolhimento+orientação, nunca substitui profissional.
- NR-01 / Risco Psicossocial / NR-XX: explique em linguagem simples baseado no conhecimento abaixo. Quando não souber, encaminha pro RH.
- Toda solicitação de ação (agendar, denunciar, falar com RH) deve usar uma tool. Não prometa coisas que você não fez.

CONHECIMENTO BASE:
- NR-01 (Portaria MTP 1.419/2024): Norma Regulamentadora que exige que empresas façam Gerenciamento de Riscos Ocupacionais (GRO), incluindo riscos psicossociais. PGR = Programa de Gerenciamento de Riscos.
- Riscos psicossociais: estresse, sobrecarga, conflitos, assédio, falta de autonomia, falta de reconhecimento.
- DRPS = Diagnóstico de Riscos Psicossociais (pesquisa).
- AEP = Análise Ergonômica Preliminar.
- Plataforma Saúde do Trabalho: portal web + WhatsApp (você). Áreas: cursos, pesquisas, biblioteca preventiva, canal de denúncia, agendamento psicológico.
- Sigilo: respostas de pesquisa e atendimentos psicológicos são confidenciais. Denúncia pode ser anônima (não vinculada ao seu telefone/cadastro).
- Lei 14.457/2022: prevenção a assédio sexual e violência no trabalho.

FORMATO:
- Use *negrito* sparingly (markdown do WhatsApp).
- Emojis pontuais (1-2 por resposta), nunca poluído.
- Sempre encerra oferecendo próxima ação concreta (ex: "Posso te ajudar com mais alguma coisa?", ou usa uma tool).
- Limite cada resposta a 4-6 linhas. Se for muito longo, divida em mensagens (o caller manda separado).`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_my_trainings",
      description: "Retorna lista de treinamentos pendentes e concluídos do colaborador",
      parameters: { type: "object", properties: { status: { type: "string", enum: ["pending", "done", "all"], default: "pending" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_surveys",
      description: "Retorna pesquisas pendentes do colaborador",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_certificates",
      description: "Retorna certificados emitidos do colaborador",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_history",
      description: "Retorna contadores agregados de participação do colaborador (cursos iniciados/concluídos, pesquisas respondidas, certificados)",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "create_protocol",
      description: "Cria um protocolo de solicitação no formato ST-AAAA-NNNNNN. Use quando o colaborador pedir algo formal (reembolso, mudança de turno, equipamento, qualquer pedido pro RH).",
      parameters: {
        type: "object",
        required: ["categoria", "descricao"],
        properties: {
          categoria: { type: "string", enum: ["rh", "sst", "psicologia", "outros"] },
          descricao: { type: "string", description: "Resumo do pedido em 1-2 frases" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "request_psi_appointment",
      description: "Encaminha o colaborador pro fluxo de agendamento psicológico. Use SEMPRE que detectar sinais de sofrimento mental ou pedido explícito de conversa com psicólogo.",
      parameters: { type: "object", properties: { motivo: { type: "string", description: "Motivo opcional do encaminhamento (pra contexto interno)" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "file_complaint",
      description: "Encaminha pro fluxo de denúncia. Use quando o colaborador relatar assédio, violação ou comportamento inadequado.",
      parameters: { type: "object", properties: {} },
    },
  },
];

type AiContext = {
  userId: number | null;
  companyId: number | null;
  userName?: string | null;
};

/**
 * Roda uma rodada de conversa IA. Retorna o texto a enviar + flag indicando
 * se a IA quer ativar um fluxo (psi/denuncia) — caller deve respeitar.
 */
export async function askAi(userMessage: string, ctx: AiContext, history: Array<{ role: string; content: string }> = []): Promise<{
  reply: string;
  switchFlow?: "psi" | "denuncia";
  protocol?: { code: string; categoria: string };
}> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { reply: "Estou em modo manutenção 🛠️. Use as opções do menu (digite 0)." };
  }
  const messages: any[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.slice(-10),
    { role: "user", content: userMessage },
  ];

  try {
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages, tools: TOOLS, tool_choice: "auto",
        temperature: 0.4, max_tokens: 600,
      }),
    });
    if (!resp.ok) {
      const err = await resp.text().catch(() => "");
      console.warn("[whatsapp_ai] groq error", err.slice(0, 200));
      return { reply: "Não consegui processar agora. Tente o menu (digite 0)." };
    }
    const data = await resp.json();
    const choice = data?.choices?.[0]?.message;
    if (choice?.tool_calls?.length) {
      // Roda ferramentas em sequência (1ª chamada por vez, simples)
      const tc = choice.tool_calls[0];
      const fnName = tc.function?.name;
      const args = (() => { try { return JSON.parse(tc.function?.arguments ?? "{}"); } catch { return {}; } })();
      const toolResult = await executeTool(fnName, args, ctx);
      // 2ª passada: passa tool_result pro LLM gerar reply final
      messages.push(choice);
      messages.push({ role: "tool", tool_call_id: tc.id, name: fnName, content: JSON.stringify(toolResult.payload) });
      const resp2 = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages, temperature: 0.4, max_tokens: 500 }),
      });
      const data2 = await resp2.json();
      const reply2 = data2?.choices?.[0]?.message?.content ?? "OK.";
      return { reply: String(reply2), switchFlow: toolResult.switchFlow, protocol: toolResult.protocol };
    }
    return { reply: String(choice?.content ?? "Não entendi, mas estou aqui. Pode reformular?") };
  } catch (err: any) {
    console.warn("[whatsapp_ai] exception", err?.message);
    return { reply: "Não consegui processar agora. Digite 0 pra ver o menu." };
  }
}

async function executeTool(name: string, args: any, ctx: AiContext): Promise<{ payload: any; switchFlow?: "psi" | "denuncia"; protocol?: any }> {
  const db = await getDb();
  if (!db) return { payload: { error: "DB unavailable" } };

  if (name === "get_my_trainings") {
    if (!ctx.userId) return { payload: { error: "user not identified" } };
    const r: any = await db.execute(drzSql`
      SELECT m.title, COALESCE(p.isCompleted, 0) AS done
      FROM modules m
      LEFT JOIN user_progress p ON p.moduleId=m.id AND p.userId=${ctx.userId}
      WHERE m.isActive=1 LIMIT 20`);
    const list = ((r as any)[0] ?? []).map((x: any) => ({ titulo: x.title, concluido: !!Number(x.done) }));
    const pend = list.filter((x: any) => !x.concluido);
    return { payload: { pendentes: pend.length, concluidos: list.length - pend.length, lista_pendentes: pend.slice(0, 8) } };
  }
  if (name === "get_my_surveys") {
    if (!ctx.userId || !ctx.companyId) return { payload: { error: "no context" } };
    const r: any = await db.execute(drzSql`
      SELECT s.id, s.title FROM surveys s WHERE s.company_id=${ctx.companyId} AND s.status='active'
      AND NOT EXISTS (SELECT 1 FROM survey_responses sr WHERE sr.survey_id=s.id AND sr.user_id=${ctx.userId})
      LIMIT 10`);
    const list = ((r as any)[0] ?? []).map((x: any) => ({ id: Number(x.id), titulo: x.title }));
    return { payload: { pendentes: list.length, pesquisas: list } };
  }
  if (name === "get_my_certificates") {
    if (!ctx.userId) return { payload: { error: "user not identified" } };
    const r: any = await db.execute(drzSql`
      SELECT c.certificateCode AS codigo, m.title AS curso, c.issuedAt AS emitidoEm
      FROM certificates c LEFT JOIN modules m ON m.id=c.moduleId
      WHERE c.userId=${ctx.userId} ORDER BY c.issuedAt DESC LIMIT 10`);
    return { payload: { certificados: (r as any)[0] ?? [] } };
  }
  if (name === "get_my_history") {
    if (!ctx.userId) return { payload: { error: "user not identified" } };
    const [[a]]: any = await db.execute(drzSql`SELECT COUNT(*) AS c FROM user_progress WHERE userId=${ctx.userId}`);
    const [[b]]: any = await db.execute(drzSql`SELECT COUNT(*) AS c FROM user_progress WHERE userId=${ctx.userId} AND isCompleted=1`);
    const [[c]]: any = await db.execute(drzSql`SELECT COUNT(*) AS c FROM survey_responses WHERE user_id=${ctx.userId}`);
    const [[d]]: any = await db.execute(drzSql`SELECT COUNT(*) AS c FROM certificates WHERE userId=${ctx.userId}`);
    return { payload: { cursos_iniciados: Number(a?.c ?? 0), cursos_concluidos: Number(b?.c ?? 0), pesquisas_respondidas: Number(c?.c ?? 0), certificados: Number(d?.c ?? 0) } };
  }
  if (name === "create_protocol") {
    // SP10 — item #17: protocolo automático
    try {
      await db.execute(drzSql`CREATE TABLE IF NOT EXISTS protocols (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(40) NOT NULL UNIQUE,
        company_id INT NULL, user_id INT NULL,
        categoria VARCHAR(40), descricao TEXT,
        status VARCHAR(40) DEFAULT 'aberto', source VARCHAR(40) DEFAULT 'whatsapp',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_p_user (user_id), INDEX idx_p_company (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    } catch (_) {}
    const ano = new Date().getUTCFullYear();
    const [[seq]]: any = await db.execute(drzSql`SELECT COUNT(*) AS c FROM protocols WHERE YEAR(created_at)=${ano}`);
    const num = String(Number(seq?.c ?? 0) + 1).padStart(6, "0");
    const code = `ST-${ano}-${num}`;
    await db.execute(drzSql`
      INSERT INTO protocols (code, company_id, user_id, categoria, descricao)
      VALUES (${code}, ${ctx.companyId}, ${ctx.userId}, ${args.categoria ?? "outros"}, ${String(args.descricao ?? "")})`);
    return { payload: { ok: true, protocolo: code }, protocol: { code, categoria: args.categoria ?? "outros" } };
  }
  if (name === "request_psi_appointment") {
    return { payload: { ok: true, message: "Encaminhado pro fluxo de agendamento psicológico" }, switchFlow: "psi" };
  }
  if (name === "file_complaint") {
    return { payload: { ok: true, message: "Encaminhado pro fluxo de denúncia" }, switchFlow: "denuncia" };
  }
  return { payload: { error: `tool desconhecida: ${name}` } };
}
