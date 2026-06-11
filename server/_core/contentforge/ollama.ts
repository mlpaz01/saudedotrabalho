import { parseLenientJson } from "./jsonparse";

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:7b";
const TIMEOUT_MS = 180_000;

async function ollamaGenJson(prompt: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        format: "json",          // force Ollama to output valid JSON
        options: { temperature: 0.1, num_predict: 4096 },
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${await res.text().catch(() => "")}`);
    const data = await res.json() as any;
    const raw: string = data.response || "";
    if (!raw.trim()) throw new Error("Ollama returned empty response");
    // Try direct parse first (format:json should guarantee valid JSON)
    try { return JSON.parse(raw); } catch { return parseLenientJson(raw); }
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

export async function ollamaPlanCourse(
  topic: string,
  duration: number,
  difficulty: string,
): Promise<{ title: string; description: string; units: Array<{ title: string; description: string; icon: string; lessonTitles: string[] }> }> {
  const numUnits = duration <= 30 ? 2 : duration <= 60 ? 3 : 4;
  const lessonsPerUnit = Math.max(2, Math.round(duration / numUnits / 8));

  const result = await ollamaGenJson(
    `Crie um plano de curso de treinamento profissional sobre o tema: "${topic}".
Nivel: ${difficulty}. Duracao: ${duration} minutos. Numero de unidades: ${numUnits}. Aulas por unidade: ${lessonsPerUnit}.
Idioma: portugues brasileiro. Foco em normas regulamentadoras (NRs) e seguranca do trabalho.
Retorne um objeto JSON com esta estrutura exata:
{
  "title": "titulo do curso em portugues",
  "description": "descricao em 1 frase",
  "coverImageQuery": "safety worker workplace",
  "units": [
    {
      "title": "titulo da unidade",
      "description": "descricao curta",
      "icon": "shield",
      "lessonTitles": ["titulo aula 1", "titulo aula 2"]
    }
  ]
}`
  );

  if (!result.units) result.units = [];
  result.units = result.units.map((u: any) => ({
    title: u.title || "Unidade",
    description: u.description || "",
    icon: u.icon || "shield",
    lessonTitles: Array.isArray(u.lessonTitles) ? u.lessonTitles :
                  Array.isArray(u.lessons) ? u.lessons.map((l: any) => typeof l === "string" ? l : l.title) :
                  ["Aula 1", "Aula 2"],
  }));
  (result as any)._useOllama = true;
  return result;
}

export async function ollamaGenerateLesson(
  courseTitle: string,
  lessonTitle: string,
  previousTitles: string[],
): Promise<any[]> {
  const prev = previousTitles.slice(-2).join(", ");
  const result = await ollamaGenJson(
    `Crie conteudo didatico para a aula "${lessonTitle}" do curso "${courseTitle}".
${prev ? `Aulas anteriores (nao repetir): ${prev}.` : ""}
Retorne um array JSON com exatamente 4 objetos de blocos de conteudo:
[
  {"type":"concept","data":{"title":"titulo do conceito","body":"explicacao de 3 frases sobre o tema","imageQuery":"safety worker"}},
  {"type":"example","data":{"scenario":"situacao real de trabalho","takeaway":"licao aprendida","imageQuery":"workplace safety"}},
  {"type":"multiple_choice","data":{"question":"pergunta de multipla escolha?","options":["opcao A","opcao B","opcao C","opcao D"],"correctIndex":0,"explanation":"por que A esta correta"}},
  {"type":"reflection","data":{"prompt":"pergunta reflexiva para o trabalhador pensar"}}
]`
  );

  if (Array.isArray(result)) return result;
  if (result.blocks && Array.isArray(result.blocks)) return result.blocks;
  // wrap if single object
  return [{ type: "concept", data: { title: lessonTitle, body: JSON.stringify(result).slice(0,200), imageQuery: courseTitle } }];
}

export async function ollamaGenerateExam(
  courseTitle: string,
  lessons: Array<{ title: string; blocks: any[] }>,
): Promise<any[]> {
  const topics = lessons.slice(0, 6).map(l => l.title).join(", ");

  const result = await ollamaGenJson(
    `Crie 5 questoes de multipla escolha para a prova final do curso "${courseTitle}".
Temas abordados: ${topics}.
Retorne um array JSON:
[
  {"question":"pergunta?","options":["A","B","C","D"],"correctIndex":0,"explanation":"justificativa da resposta correta"}
]`
  );

  return Array.isArray(result) ? result : [];
}
