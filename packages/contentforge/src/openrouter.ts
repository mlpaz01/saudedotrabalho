// OpenRouter fallback provider — free-tier models, OpenAI-compatible API
// Used as last resort when Groq (daily TPD) and Gemini (20 req/day) are exhausted

const OR_BASE = "https://openrouter.ai/api/v1";
const TIMEOUT_MS = 90_000;

// Free models verified from OpenRouter API — sorted by quality/context
const FREE_MODELS = [
  "openrouter/free",                          // Auto-routes to best available free model
  "deepseek/deepseek-v4-flash:free",          // DeepSeek V4 Flash — 1M ctx, very fast
  "meta-llama/llama-3.3-70b-instruct:free",   // Llama 3.3 70B — reliable fallback
  "qwen/qwen3-coder:free",                    // Qwen3 Coder 480B — strong reasoning
  "nvidia/nemotron-3-super-120b-a12b:free",   // NVIDIA Nemotron 120B — 1M ctx
  "google/gemma-4-31b-it:free",               // Gemma 4 31B
  "moonshotai/kimi-k2.6:free",                // Kimi K2.6
];

async function orChat(
  msgs: Array<{ role: string; content: string }>,
  apiKey: string,
  jsonMode = false
): Promise<string> {
  for (const model of FREE_MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const body: any = {
        model,
        messages: msgs,
        temperature: 0.4,
        max_tokens: 4096,
      };
      if (jsonMode) body.response_format = { type: "json_object" };

      const res = await fetch(`${OR_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": "https://saudedotrabalho.com.br",
          "X-Title": "Saude do Trabalho LMS",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 429) {
        // Rate limited on this model — wait 2s then try next
        console.log(`[OpenRouter] 429 on ${model}, waiting 2s then trying next...`);
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      if (res.status === 503) {
        console.log(`[OpenRouter] 503 on ${model}, trying next model...`);
        continue;
      }
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        console.log(`[OpenRouter] ${res.status} on ${model}: ${err.slice(0, 150)}, trying next...`);
        continue;
      }
      const data = await res.json() as any;
      const content = data.choices?.[0]?.message?.content || "";
      if (!content) { console.log(`[OpenRouter] empty response from ${model}, trying next...`); continue; }
      console.log(`[OpenRouter] OK with ${model}`);
      return content;
    } catch (e: any) {
      clearTimeout(timer);
      console.log(`[OpenRouter] error on ${model}: ${String(e?.message || e).slice(0, 100)}, trying next...`);
      continue;
    }
  }
  throw new Error("OpenRouter: all free models failed or unavailable");
}

// ── Plan a course ────────────────────────────────────────────────────────────
export async function orPlanCourse(
  topic: string, durationMin: number, difficulty: string, apiKey: string
): Promise<any> {
  const numUnits = Math.max(2, Math.min(5, Math.round(durationMin / 15)));
  const lessonsPerUnit = 3;
  const sys = `You are an expert instructional designer. Always respond with valid JSON only, no markdown.`;
  const user = `Create a structured course plan in Brazilian Portuguese.
Topic: "${topic}"
Duration: ${durationMin} minutes
Level: ${difficulty}
Units: ${numUnits} (each with exactly ${lessonsPerUnit} lessons)

Return JSON in this EXACT format:
{
  "title": "Course title",
  "description": "2-3 line description",
  "coverImageQuery": "english keywords for unsplash",
  "units": [
    {
      "title": "Unit title",
      "description": "one line",
      "icon": "book",
      "lessonTitles": ["Lesson 1 title", "Lesson 2 title", "Lesson 3 title"]
    }
  ]
}`;

  const raw = await orChat([{ role: "system", content: sys }, { role: "user", content: user }], apiKey, true);
  const clean = raw.replace(/\`\`\`json
?/g, "").replace(/\`\`\`
?/g, "").trim();
  return JSON.parse(clean);
}


export async function orGenerateLesson(
  courseTitle: string, lessonTitle: string, previousTitles: string[], apiKey: string
): Promise<any[]> {
  const sys = `You are an expert course creator. Always respond with valid JSON only.`;
  const prev = previousTitles.length > 0 ? `Previous lessons covered: ${previousTitles.join(", ")}.` : "";
  const user = `Create lesson content in Brazilian Portuguese for:
Course: "${courseTitle}"
Lesson: "${lessonTitle}"
${prev}

Return a JSON array of 4-6 blocks. Each block has "type" and "content".
Types: concept ({"type":"concept","content":{"title":"...","body":"...","keyPoints":["..."]}}),
       example ({"type":"example","content":{"scenario":"...","explanation":"..."}}),
       multiple_choice ({"type":"multiple_choice","content":{"question":"...","options":["..."],"correctIndex":0,"explanation":"..."}}),
       reflection ({"type":"reflection","content":{"prompt":"..."}})`;

  const raw = await orChat([{ role: "system", content: sys }, { role: "user", content: user }], apiKey, true);
  const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(clean);
  return Array.isArray(parsed) ? parsed : parsed.blocks || [];
}

// ── Generate exam ────────────────────────────────────────────────────────────
export async function orGenerateExam(
  courseTitle: string, lessons: string[], apiKey: string
): Promise<any[]> {
  const sys = `You are an expert at creating educational assessments. Always respond with valid JSON only, no markdown.`;
  const user = `Create a final exam in Brazilian Portuguese for course: "${courseTitle}"
Topics: ${lessons.slice(0, 8).join(", ")}

Return a JSON array of 5 multiple choice questions using EXACTLY this format:
[{"question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"correctIndex":0,"explanation":"..."}]

IMPORTANT: use "correctIndex" (integer 0-3), not "correct".`;

  const raw = await orChat([{ role: "system", content: sys }, { role: "user", content: user }], apiKey, true);
  const clean = raw.replace(/\`\`\`json
?/g, "").replace(/\`\`\`
?/g, "").trim();
  const parsed = JSON.parse(clean);
  const arr = Array.isArray(parsed) ? parsed : parsed.questions || [];
  // Normalize: some models return "correct" instead of "correctIndex"
  return arr.map((q: any) => ({ ...q, correctIndex: q.correctIndex ?? q.correct ?? 0 }));
}