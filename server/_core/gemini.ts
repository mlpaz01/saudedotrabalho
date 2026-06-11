import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export function isGeminiAvailable() { return !!apiKey && !!genAI; }

export type GeneratedCourse = {
  title: string;
  description: string;
  imageQuery: string;
  durationMinutes: number;
  lessons: Array<{
    title: string;
    content: string;
    imageQuery: string;
    durationMinutes: number;
    quiz: Array<{ question: string; options: string[]; correctIndex: number; explanation: string }>;
  }>;
  finalExam: Array<{ question: string; options: string[]; correctIndex: number; explanation: string }>;
};

export async function generateCourseWithGemini(opts: {
  prompt: string;
  level: string;
  durationMinutes: number;
  language: string;
  includeQuiz: boolean;
  numLessons?: number;
}): Promise<GeneratedCourse> {
  if (!genAI) throw new Error("GEMINI_API_KEY nao configurada");
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json", temperature: 0.7, maxOutputTokens: 32768 },
  });

  const numLessons = opts.numLessons ?? Math.floor(Math.random() * 3) + 5; // 5-7
  const perLessonMinutes = Math.max(5, Math.floor(opts.durationMinutes / numLessons));

  const systemPrompt = `Voce e um especialista em Saude e Seguranca do Trabalho brasileiro, com profundo conhecimento das Normas Regulamentadoras (NRs) do Ministerio do Trabalho, ergonomia, saude mental ocupacional, e legislacao trabalhista brasileira. Voce cria conteudo educacional autentico, tecnico, atualizado e didatico em portugues brasileiro.

Gere um curso completo de SST baseado no pedido do usuario. Responda APENAS com JSON valido seguindo EXATAMENTE este schema:

{
  "title": "Titulo profissional do curso",
  "description": "Descricao de 2-3 linhas",
  "imageQuery": "english keywords for unsplash search, ex: industrial safety helmet workers",
  "durationMinutes": ${opts.durationMinutes},
  "lessons": [
    {
      "title": "Titulo da aula",
      "content": "Conteudo completo da aula em PT-BR, entre 1000 e 1500 palavras. Use paragrafos bem estruturados separados por quebra dupla. Inclua: definicoes tecnicas precisas, base legal (citar NR especifica, decretos, leis), exemplos praticos do cotidiano brasileiro, dados estatisticos quando aplicavel, procedimentos passo a passo, lista de EPIs/EPCs quando relevante, casos reais ou hipoteticos. NAO use marcadores markdown como ##, **, etc. Use texto corrido.",
      "imageQuery": "english keywords for image",
      "durationMinutes": ${perLessonMinutes},
      "quiz": [
        { "question": "Pergunta clara e tecnica", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "Explicacao detalhada" }
      ]
    }
  ],
  "finalExam": [
    { "question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "..." }
  ]
}

Requisitos OBRIGATORIOS:
- Exatamente ${numLessons} aulas
- Exatamente 5 questoes por aula no campo quiz
- Exatamente 15 questoes no finalExam
- Nivel: ${opts.level} (adaptar profundidade tecnica)
- Idioma: ${opts.language}
- Conteudo TECNICO e ATUAL (legislacao brasileira em vigor 2024/2025)
- Base legal sempre citada (NRs aplicaveis, Lei 8.213, CLT, etc.)
- NUNCA inventar normas que nao existem
- Nao usar markdown nos campos de conteudo
- JSON valido sem texto antes ou depois`;

  const userPrompt = `Crie um curso sobre: ${opts.prompt}`;

  const result = await model.generateContent([
    { text: systemPrompt },
    { text: userPrompt },
  ]);
  const text = result.response.text();

  let json = text.trim();
  if (json.startsWith("```")) {
    json = json.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  }
  // Sanitize: escape control chars inside string literals that Gemini sometimes returns raw
  try {
    return JSON.parse(json);
  } catch (firstErr) {
    // Fix common issues: unescaped control chars inside strings
    const sanitized = sanitizeJsonString(json);
    try {
      return JSON.parse(sanitized);
    } catch (secondErr) {
      console.error("[gemini] JSON parse failed even after sanitize:", String(secondErr).substring(0,200));
      console.error("[gemini] First 500 chars of raw response:", json.substring(0,500));
      throw firstErr;
    }
  }
}

function sanitizeJsonString(input: string): string {
  // Walk the string char by char; while inside a string literal, escape control chars
  let out = "";
  let inStr = false;
  let escape = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (escape) { out += ch; escape = false; continue; }
    if (ch === "\\") { out += ch; escape = true; continue; }
    if (ch === '"') { inStr = !inStr; out += ch; continue; }
    if (inStr) {
      const code = ch.charCodeAt(0);
      if (code === 0x0a) { out += "\\n"; continue; }
      if (code === 0x0d) { out += "\\r"; continue; }
      if (code === 0x09) { out += "\\t"; continue; }
      if (code < 0x20) { out += " "; continue; }
    }
    out += ch;
  }
  return out;
}
