import { GoogleGenerativeAI } from "@google/generative-ai";
import { GenerateOptions } from "./types";
import { parseLenientJson } from "./jsonparse";

export interface CourseOutline {
  title: string;
  description: string;
  coverImageQuery: string;
  units: Array<{ title: string; description: string; icon: string; lessonTitles: string[] }>;
}

export async function plan(opts: GenerateOptions): Promise<CourseOutline> {
  const genAI = new GoogleGenerativeAI(opts.llmApiKey);
  const numUnits = opts.numUnits ?? (opts.duration <= 30 ? 3 : opts.duration <= 60 ? 4 : 5);
  const lessonsPerUnit = 3;

  const system = `Voce e um designer instrucional especialista em microlearning estilo Duolingo, focado em Saude e Seguranca do Trabalho brasileiro.

Sua tarefa: planejar a estrutura ALTO NIVEL de um curso DIVIDIDO EM UNIDADES e AULAS curtas (1-3 min cada).

Principios:
- Cada UNIDADE agrupa aulas de um mesmo tema/competencia
- Cada AULA e uma microexperiencia (1-3 min) com objetivo claro e mensuravel
- Progressao didatica: do fundamental ao aplicado
- Foco em SITUACOES PRATICAS do dia-a-dia brasileiro, nao teoria abstrata
- Base legal sempre presente (NRs aplicaveis, leis brasileiras)

Retorne APENAS JSON valido neste formato exato:
{
  "title": "Titulo profissional do curso",
  "description": "Descricao 2-3 linhas focada em beneficio pratico",
  "coverImageQuery": "english keywords for unsplash",
  "units": [
    {
      "title": "Titulo curto da unidade",
      "description": "1 linha sobre o que sera aprendido",
      "icon": "shield | hardhat | book | brain | heart | alert | flame | electrical | hammer | warning",
      "lessonTitles": ["Titulo aula 1", "Titulo aula 2", "Titulo aula 3"]
    }
  ]
}

Requisitos OBRIGATORIOS:
- EXATAMENTE ${numUnits} unidades
- EXATAMENTE ${lessonsPerUnit} aulas por unidade
- Aulas com titulos ESPECIFICOS (nao genericos)
- Idioma: pt-BR
- Dificuldade: ${opts.difficulty}`;

  const userMsg = `Planeje um curso sobre: ${opts.topic}\n\nPublico-alvo: ${opts.audience}\nDuracao total estimada: ${opts.duration} minutos`;

  // Try gemini-2.5-flash first, fall back to flash
  const tryModel = async (modelName: string) => {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json", temperature: 0.5 },
    });
    const r = await model.generateContent([{ text: system }, { text: userMsg }]);
    return parseLenientJson(r.response.text());
  };

  try { return await tryModel("gemini-2.5-flash"); }
  catch (e) {
    console.warn("[ContentForge] 2.5-pro failed, falling back to 2.5-flash:", (e as Error)?.message);
    return await tryModel("gemini-2.5-flash");
  }
}
