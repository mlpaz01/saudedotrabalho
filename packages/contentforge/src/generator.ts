import { GoogleGenerativeAI } from "@google/generative-ai";
import { GenerateOptions, BlockContent } from "./types";
import { parseLenientJson } from "./jsonparse";

export interface LessonContext {
  courseTitle: string;
  unitTitle: string;
  lessonTitle: string;
  previousLessonTitles: string[];
}

export async function generateLessonBlocks(
  opts: GenerateOptions,
  ctx: LessonContext,
): Promise<{ blocks: BlockContent[]; estimatedMinutes: number }> {
  const genAI = new GoogleGenerativeAI(opts.llmApiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
  });

  const sequenceHint = [
    "concept (introduzir conceito)",
    "example (exemplo do dia-a-dia)",
    "quick_check (verificacao rapida 1 pergunta)",
    "concept (aprofundar OU novo subtopico)",
    "true_false (afirmacao pratica)",
    "fill_blank OR drag_order OR match_pairs (escolha 1, interativo)",
    "scenario_choice (voce decide)",
    "multiple_choice (consolidacao)",
  ].join("\n");

  const system = `Voce e um instructional designer especialista em microaprendizagem estilo Duolingo.

Crie uma MICROAULA de ~3 minutos com 6 a 8 BLOCOS interativos, seguindo este padrao pedagogico (varie sutilmente):
${sequenceHint}

REGRAS PEDAGOGICAS:
- Cada bloco e curto (50-100 palavras max em texto)
- Concept: explicacao clara, exemplo concreto, NAO usar markdown
- Example: situacao real (eletricista numa subestacao, motorista carregando palete...)
- Quizzes: pergunta especifica baseada NO CONTEUDO dos blocos anteriores DESTA aula
- True/false: afirmacao pratica, NAO pegadinha gramatical
- Fill_blank: lacunas que testam compreensao, com banco de palavras pre-definido
- Scenario_choice: 3 opcoes, cada uma com consequencia realista. UMA e claramente melhor.
- TODA explicacao apos resposta correta deve REFORCAR o aprendizado, nao so dizer "correto"

Retorne APENAS JSON valido:
{
  "estimatedMinutes": 3,
  "blocks": [
    { "type": "concept", "data": { "title": "...", "body": "...", "imageQuery": "..." } },
    { "type": "example", "data": { "scenario": "...", "takeaway": "...", "imageQuery": "..." } },
    { "type": "quick_check", "data": { "question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "..." } },
    { "type": "true_false", "data": { "statement": "...", "answer": true, "explanation": "..." } },
    { "type": "fill_blank", "data": { "template": "A ____ trata de altura.", "correctAnswers": ["NR-35"], "wordBank": ["NR-10","NR-35","NR-06","NR-12"], "explanation": "..." } },
    { "type": "drag_order", "data": { "instruction": "Ordene...", "items": ["X","Y","Z"], "correctOrder": ["X","Y","Z"], "explanation": "..." } },
    { "type": "match_pairs", "data": { "instruction": "Associe...", "leftItems": ["NR-10","NR-35"], "rightItems": ["Eletricidade","Altura"], "correctPairs": [[0,0],[1,1]], "explanation": "..." } },
    { "type": "scenario_choice", "data": { "scenario": "...", "question": "...", "choices": [
        { "text": "...", "outcome": "...", "isBest": false },
        { "text": "...", "outcome": "...", "isBest": true },
        { "text": "...", "outcome": "...", "isBest": false }
      ]}},
    { "type": "multiple_choice", "data": { "question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "..." } }
  ]
}

REGRAS:
- Minimo 6, maximo 8 blocos
- Sempre 1+ concept no inicio
- Sempre 1+ multiple_choice ou quick_check ao final
- Linguagem acessivel (publico: ${opts.audience})
- pt-BR brasileiro coloquial mas profissional
- imageQuery em ingles para Unsplash`;

  const userMsg = `Curso: "${ctx.courseTitle}"
Unidade: "${ctx.unitTitle}"
Aula atual (a criar): "${ctx.lessonTitle}"
Aulas anteriores desta unidade: ${ctx.previousLessonTitles.join(" / ") || "(esta e a primeira)"}

Crie os blocos desta aula.`;

  const r = await model.generateContent([{ text: system }, { text: userMsg }]);
  return parseLenientJson(r.response.text());
}
