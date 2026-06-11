import { orChat } from "./openrouter";

export type ActivityTheme = "breathing" | "meditation" | "stretching" | "reflection" | "focus" | "energy";
export type ActivityTone = "calm" | "energizing" | "reflective";

export interface GeneratedActivity {
  title: string;
  description: string;
  type: string;
  category: string;
  durationMinutes: number;
  tone: string;
  coverImageQuery: string;
  content: {
    intro?: string;
    steps?: Array<{ duration?: number; text: string; image?: string }>;
    breathingPattern?: { inhale: number; hold?: number; exhale: number; holdOut?: number; cycles?: number };
    closing?: string;
    videoSearchQuery?: string;
  };
}

const THEME_INSTRUCTIONS: Record<ActivityTheme, string> = {
  breathing: "Create a guided breathing exercise with a specific pattern (e.g., 4-7-8, box breathing, alternate nostril). Include breathingPattern with inhale/hold/exhale/holdOut seconds and cycles count. Steps should walk through preparation, the breathing cycles, and gentle closure.",
  meditation: "Create a short guided meditation script. Steps should be 30-90 second prompts (visualization, body scan, intention-setting). Set videoSearchQuery for optional video accompaniment.",
  stretching: "Create a simple sequence of desk stretches or chair yoga moves. Each step describes a posture with hold time. Include images query suggestions.",
  reflection: "Create reflective prompts for journaling or quiet thinking. Each step is a question or theme to ponder for 1-2 minutes.",
  focus: "Create a focus reset routine combining breathing + intention setting + sensory grounding (5-4-3-2-1).",
  energy: "Create an energizing micro-break: breath of fire, light movement, posture reset, hydration reminder."
};

const TONE_INSTRUCTIONS: Record<ActivityTone, string> = {
  calm: "Use a soothing, slow-paced tone. Words like 'gently', 'softly', 'with kindness'.",
  energizing: "Use an upbeat, motivating tone. Words like 'alive', 'awake', 'ready'.",
  reflective: "Use a thoughtful, inviting tone. Open questions, gentle curiosity."
};

export async function generateActivity(opts: {
  theme: ActivityTheme;
  durationMinutes: number;
  tone: ActivityTone;
  apiKey: string;
  customPrompt?: string;
}): Promise<GeneratedActivity> {
  const { theme, durationMinutes, tone, apiKey, customPrompt } = opts;

  const sys = `You are a workplace wellness expert. Always respond with valid JSON only.`;
  const user = `Create a workplace decompression activity in Brazilian Portuguese.
Theme: ${theme}
Duration: ${durationMinutes} minutes
Tone: ${tone}
${customPrompt ? `Additional guidance: ${customPrompt}` : ""}

${THEME_INSTRUCTIONS[theme]}
${TONE_INSTRUCTIONS[tone]}

Return JSON in this EXACT format:
{
  "title": "Activity title in Portuguese (max 60 chars)",
  "description": "1-2 line description in Portuguese",
  "type": "${theme}",
  "category": "${theme}",
  "durationMinutes": ${durationMinutes},
  "tone": "${tone}",
  "coverImageQuery": "english keywords for unsplash (calm, peaceful, breath, etc)",
  "content": {
    "intro": "Welcoming message (1-2 sentences) in Portuguese",
    "steps": [
      { "duration": 30, "text": "Step instruction in Portuguese" }
    ],
    "breathingPattern": { "inhale": 4, "hold": 7, "exhale": 8, "cycles": 4 },
    "closing": "Gentle closing message in Portuguese",
    "videoSearchQuery": "optional english keywords if a video would help"
  }
}

Rules:
- All visible text in Brazilian Portuguese
- coverImageQuery and videoSearchQuery in English
- Adjust step count based on duration (~30-60s per step)
- For non-breathing themes, omit breathingPattern
- Make it actionable and short`;

  const raw = await orChat([
    { role: "system", content: sys },
    { role: "user", content: user }
  ], apiKey, true);
  const clean = raw.replace(/```json/g, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(clean);
  return parsed as GeneratedActivity;
}
