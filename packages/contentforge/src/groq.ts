/**

 * groq.ts — ContentForge provider using Groq API (free, 14k req/day)

 * Model: llama-3.3-70b-versatile — excellent Portuguese + JSON output

 */

import { parseLenientJson } from "./jsonparse";



const GROQ_BASE = "https://api.groq.com/openai/v1";

const GROQ_MODEL = "llama-3.3-70b-versatile";

const TIMEOUT_MS = 60_000;



export function isGroqError(e: any): boolean {

  const msg = String(e?.message || e);

  return msg.includes("429") || msg.includes("quota") || msg.includes("rate_limit") || msg.includes("RESOURCE_EXHAUSTED");

}



async function groqChat(msgs: Array<{role: string; content: string}>, apiKey: string, jsonMode = false): Promise<string> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const body: any = { model: GROQ_MODEL, messages: msgs, temperature: 0.4, max_tokens: 4096 };
      if (jsonMode) body.response_format = { type: "json_object" };
      const res = await fetch(`${GROQ_BASE}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.status === 429) {
        const retryAfter = res.headers.get('retry-after') || '';
        const errText = await res.text().catch(() => '');
        console.log(`[Groq] 429 body: ${errText.slice(0, 200)}`);
        const mBody = errText.match(/try again in ([\d.]+)s/i) || errText.match(/"([\d.]+)"\s*seconds/i);
        const hdrSecs = retryAfter ? parseFloat(retryAfter) : NaN;
        const bodySecs = mBody ? parseFloat(mBody[1]) : NaN;
        const bestSecs = !isNaN(hdrSecs) ? hdrSecs : !isNaN(bodySecs) ? bodySecs : NaN;
        // If suggested wait > 60s it's a daily limit — fail fast so we fall back to next provider
        if (!isNaN(bestSecs) && bestSecs > 60) {
          console.log(`[Groq] 429 daily limit (wait ${Math.round(bestSecs)}s) — failing fast to next provider`);
          throw new Error(`Groq daily limit reached, retry in ${Math.round(bestSecs)}s`);
        }
        // For short waits (TPM), wait once then retry. For anything else, fail fast.
        if (!isNaN(bestSecs) && bestSecs <= 10) {
          console.log(`[Groq] 429 TPM — waiting ${Math.round(bestSecs)}s then retry`);
          await new Promise(r => setTimeout(r, Math.ceil(bestSecs * 1000) + 200));
          continue;
        }
        console.log(`[Groq] 429 — failing fast to next provider`);
        throw new Error(`Groq rate limited (${!isNaN(bestSecs) ? Math.round(bestSecs)+'s' : 'unknown wait'})`);
      }
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`Groq HTTP ${res.status}: ${err.slice(0, 300)}`);
      }
      const data = await res.json() as any;
      return data.choices?.[0]?.message?.content || "";
    } catch (e: any) {
      clearTimeout(timer);
      throw e; // fail fast — agent.ts handles fallback to next provider
    }
  }
  throw new Error("Groq: max retries exceeded");
}




function extractJson(text: string): string {

  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  const arrIdx = text.indexOf("[");

  const objIdx = text.indexOf("{");

  if (arrIdx >= 0 && (objIdx < 0 || arrIdx < objIdx)) {

    const end = text.lastIndexOf("]");

    return end >= 0 ? text.slice(arrIdx, end + 1) : text.slice(arrIdx);

  }

  if (objIdx >= 0) {

    const end = text.lastIndexOf("}");

    return end >= 0 ? text.slice(objIdx, end + 1) : text.slice(objIdx);

  }

  return text;

}



export async function groqPlanCourse(topic: string, duration: number, difficulty: string, apiKey: string): Promise<any> {

  const numUnits = duration <= 30 ? 2 : duration <= 60 ? 3 : 4;

  const lessonsPerUnit = Math.max(2, Math.round(duration / numUnits / 8));



  const raw = await groqChat([

    { role: "system", content: "Voce eh especialista senior em Saude e Seguranca do Trabalho (SST) brasileiro e designer instrucional. Responda APENAS com JSON valido." },

    { role: "user", content: `Crie plano de curso SST sobre: "${topic}". Nivel: ${difficulty}. Duracao: ${duration} min. ${numUnits} unidades com ${lessonsPerUnit} aulas cada.



JSON com esta estrutura exata:

{

  "title": "titulo do curso",

  "description": "descricao em 2 frases com a NR aplicavel",

  "coverImageQuery": "professional safety workplace english keywords",

  "units": [

    { "title": "unidade", "description": "descricao", "icon": "shield", "lessonTitles": ["aula 1", "aula 2"] }

  ]

}` },

  ], apiKey, true);



  const parsed = parseLenientJson(extractJson(raw));

  parsed._useGroq = true;

  parsed._groqKey = apiKey;

  if (!parsed.units) parsed.units = [];

  parsed.units = parsed.units.map((u: any) => ({

    title: u.title || "Unidade",

    description: u.description || "",

    icon: u.icon || "shield",

    lessonTitles: Array.isArray(u.lessonTitles) ? u.lessonTitles : ["Aula 1"],

  }));

  return parsed;

}



export async function groqGenerateLesson(courseTitle: string, lessonTitle: string, previousTitles: string[], apiKey: string): Promise<any[]> {

  const prev = previousTitles.slice(-3).join(", ");



  const raw = await groqChat([

    { role: "system", content: "Voce eh especialista em SST e educador instrucional brasileiro. Crie conteudo didatico no estilo Duolingo: engajante, pratico, com exemplos reais. Responda APENAS com array JSON valido." },

    { role: "user", content: `Crie 6 blocos para a aula "${lessonTitle}" do curso "${courseTitle}".${prev ? ` Nao repetir: ${prev}.` : ""}



Array JSON com sequencia pedagogica:

[

  {"type":"concept","data":{"title":"conceito-chave","body":"explicacao tecnica 3-4 frases com terminologia NR","imageQuery":"professional safety english keywords"}},

  {"type":"example","data":{"scenario":"situacao real detalhada de risco/boas praticas no trabalho brasileiro","takeaway":"licao pratica para o dia a dia","imageQuery":"workplace scenario english"}},

  {"type":"multiple_choice","data":{"question":"pergunta tecnica especifica?","options":["correta","errada1","errada2","errada3"],"correctIndex":0,"explanation":"por que esta correta citando a NR"}},

  {"type":"true_false","data":{"statement":"afirmacao tecnica sobre o tema","isTrue":true,"explanation":"justificativa tecnica"}},

  {"type":"fill_blank","data":{"sentence":"A ___ deve ser verificada antes de iniciar o trabalho.","blanks":["resposta"],"wordBank":["resposta","errada1","errada2","errada3"]}},

  {"type":"reflection","data":{"prompt":"pergunta reflexiva conectando conteudo com realidade do trabalhador"}}

]` },

  ], apiKey, false);



  const parsed = parseLenientJson(extractJson(raw));

  return Array.isArray(parsed) ? parsed : (parsed.blocks || []);

}



export async function groqGenerateExam(courseTitle: string, lessons: Array<{title: string; blocks: any[]}>, apiKey: string): Promise<any[]> {

  const summaries = lessons.slice(0, 8).map((l, i) => {

    const c = l.blocks.filter(b => b.type === "concept").map(b => `- ${b.data?.title}: ${String(b.data?.body || "").slice(0, 100)}`).slice(0, 2).join("\n");

    return `Aula ${i+1}: ${l.title}\n${c}`;

  }).join("\n\n");



  const raw = await groqChat([

    { role: "system", content: "Voce eh avaliador especialista em SST brasileiro. Crie questoes tecnicas e precisas. Responda APENAS com array JSON valido." },

    { role: "user", content: `Prova final com 10 questoes de multipla escolha para o curso "${courseTitle}".



CONTEUDO DO CURSO:

${summaries}



Array JSON com 10 questoes:

[{"question":"pergunta tecnica?","options":["correta","errada1","errada2","errada3"],"correctIndex":0,"explanation":"justificativa citando NR"}]` },

  ], apiKey, false);



  const parsed = parseLenientJson(extractJson(raw));

  return Array.isArray(parsed) ? parsed : [];

}

