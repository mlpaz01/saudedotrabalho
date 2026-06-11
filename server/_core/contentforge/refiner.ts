import { GoogleGenerativeAI } from "@google/generative-ai";
import { GenerateOptions, MultipleChoiceBlock, BlockContent } from "./types";
import { parseLenientJson } from "./jsonparse";

export async function generateFinalExam(
  opts: GenerateOptions,
  courseTitle: string,
  lessons: Array<{ title: string; blocks: BlockContent[] }>,
): Promise<MultipleChoiceBlock[]> {
  const genAI = new GoogleGenerativeAI(opts.llmApiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json", temperature: 0.4, maxOutputTokens: 2048 },
  });

  // Extract concrete content + key facts from each lesson to ground questions in actual material
  const lessonSummaries = lessons.map((l, i) => {
    const concepts = l.blocks
      .filter(b => b.type === "concept" || b.type === "example")
      .map(b => {
        if (b.type === "concept") return `- ${(b.data as any).title}: ${(b.data as any).body}`;
        if (b.type === "example") return `- Exemplo: ${(b.data as any).scenario} | Licao: ${(b.data as any).takeaway}`;
        return "";
      })
      .filter(Boolean)
      .slice(0, 4)
      .join("\n");
    return `AULA ${i + 1}: ${l.title}\n${concepts || "(sem conceitos extraidos)"}`;
  }).join("\n\n");

  const prompt = `Voce eh um avaliador especialista em Saude do Trabalho brasileiro. Crie EXATAMENTE 10 questoes de multipla escolha para a PROVA FINAL do curso "${courseTitle}".

CONTEUDO ENSINADO NO CURSO (use EXCLUSIVAMENTE este material para gerar perguntas):

${lessonSummaries}

REGRAS:
- Cada questao deve testar conhecimento ESPECIFICO ensinado nas aulas acima
- NUNCA pergunte algo que nao foi mencionado no conteudo
- Use a terminologia EXATA das aulas (NRs citadas, termos tecnicos usados)
- Cada questao com 4 opcoes plausiveis, apenas 1 correta
- Distribua as 10 questoes entre TODAS as aulas (pelo menos 1 por aula quando possivel)
- A "explanation" deve citar o conceito da aula que justifica a resposta
- Linguagem pt-BR profissional mas acessivel

Retorne APENAS JSON valido:
[
  { "question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "..." }
]`;

  const r = await model.generateContent(prompt);
  return parseLenientJson(r.response.text());
}
