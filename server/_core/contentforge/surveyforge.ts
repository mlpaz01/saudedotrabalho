import { orChat } from "./openrouter";

export type SurveyType = "climate" | "burnout" | "psychosocial" | "harassment" | "knowledge" | "custom";

export interface GeneratedSurvey {
  title: string;
  description: string;
  category: string;
  questions: Array<{
    text: string;
    type: "likert" | "multiple_choice" | "text";
    options?: string[];
    correctIndex?: number;
  }>;
}

const TYPE_INSTRUCTIONS: Record<SurveyType, string> = {
  climate: "Use likert scale for ALL questions (5-point agreement scale, labels shown elsewhere). Cover: leadership support, workload, recognition, growth opportunities, relationships, communication. DO NOT include the scale labels (1=, 2=, etc.) inside the question text — only the question itself.",
  burnout: "Use likert scale for ALL questions (5-point frequency scale, labels shown elsewhere). Cover MBI dimensions: emotional exhaustion, depersonalization, personal accomplishment. DO NOT include the scale labels (1=Nunca, 2=Raramente, etc.) inside the question text — only the question itself.",
  psychosocial: "Use likert scale for ALL questions (5-point frequency scale, labels shown elsewhere). Cover NR-01 psychosocial risks: workload, autonomy, social support, recognition, role clarity, work-life balance. DO NOT include the scale labels (1=Nunca, 2=Raramente, etc.) inside the question text — only the question itself.",
  harassment: "Use mostly likert (5-point frequency, labels shown elsewhere) plus a final open text question. Cover witnessed/experienced moral and sexual harassment. DO NOT include the scale labels (1=Nunca, 2=Raramente, etc.) inside the question text — only the question itself.",
  knowledge: "Use multiple_choice with EXACTLY 4 options and ONE correctIndex per question. CRITICAL: distribute correctIndex UNIFORMLY across 0, 1, 2, 3 — do NOT concentrate correct answers in the first or second option. Vary the position randomly. Include a brief explanation in the question text if helpful.",
  custom: "Choose the most appropriate question_type per question (likert, multiple_choice, or text)."
};

export async function generateSurvey(opts: {
  topic: string;
  type: SurveyType;
  questionCount: number;
  apiKey: string;
}): Promise<GeneratedSurvey> {
  const { topic, type, questionCount, apiKey } = opts;
  const typeInstr = TYPE_INSTRUCTIONS[type] || TYPE_INSTRUCTIONS.custom;

  const sys = `You are an expert occupational psychologist designing surveys. Always respond with valid JSON only.`;
  const user = `Create a workplace survey in Brazilian Portuguese.
Topic: "${topic}"
Survey type: ${type}
Number of questions: ${questionCount}

${typeInstr}

Return JSON in this EXACT format:
{
  "title": "Survey title in Portuguese",
  "description": "1-2 line description in Portuguese explaining the purpose",
  "category": "${type}",
  "questions": [
    {
      "text": "Question text in Portuguese",
      "type": "likert" | "multiple_choice" | "text",
      "options": ["option A","option B","option C","option D"],
      "correctIndex": 0
    }
  ]
}

Rules:
- For likert questions: omit options (we use a standard 5-point scale)
- For multiple_choice: exactly 4 options + correctIndex (0-3)
- For text: omit options and correctIndex
- Generate EXACTLY ${questionCount} questions
- All text in Brazilian Portuguese, professional but accessible tone`;

  const raw = await orChat([
    { role: "system", content: sys },
    { role: "user", content: user }
  ], apiKey, true);
  const clean = raw.replace(/```json/g, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(clean);

  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error("LLM returned no questions");
  }

  // Anti-bias: for knowledge quizzes, redistribute correctIndex if too concentrated
  if (type === "knowledge") {
    redistributeCorrectAnswers(parsed.questions);
  }

  return parsed as GeneratedSurvey;
}

function redistributeCorrectAnswers(questions: any[]) {
  const mc = questions.filter(q => q.type === "multiple_choice" && Array.isArray(q.options) && q.options.length >= 2);
  if (mc.length < 3) return;

  // Count current distribution
  const optionCount = Math.max(...mc.map(q => q.options.length));
  const counts: number[] = new Array(optionCount).fill(0);
  mc.forEach(q => {
    const idx = Number(q.correctIndex ?? 0);
    if (idx >= 0 && idx < optionCount) counts[idx]++;
  });

  const maxCount = Math.max(...counts);
  const bias = maxCount / mc.length;

  // If more than 40% concentrated on a single index, shuffle each question's options
  if (bias > 0.4) {
    console.log(`[surveyforge] anti-bias triggered: ${(bias * 100).toFixed(0)}% in same position. Shuffling.`);
    mc.forEach(q => {
      const oldIdx = Number(q.correctIndex ?? 0);
      const correctOpt = q.options[oldIdx];
      // Fisher-Yates shuffle
      const opts = [...q.options];
      for (let i = opts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [opts[i], opts[j]] = [opts[j], opts[i]];
      }
      q.options = opts;
      q.correctIndex = opts.indexOf(correctOpt);
    });
  }
}
