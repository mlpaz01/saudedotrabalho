import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

const MODULE_ID = Number(process.env.ISO_MODULE_ID || 176);
const COURSE_SLUG = "iso9001-2015-amd1-2024-interpretacao";
const IMAGE_VARIANT = process.env.IMAGE_VARIANT || "lessons-notext";
const IMAGE_DIR = path.join(process.cwd(), "uploads", "images", COURSE_SLUG, IMAGE_VARIANT);
const IMAGE_URL_PREFIX = `/uploads/images/${COURSE_SLUG}/${IMAGE_VARIANT}`;
const OPENROUTER_IMAGE_MODEL = "google/gemini-2.5-flash-image";

type LessonRow = {
  id: number;
  title: string;
  description: string | null;
  orderIndex: number;
  unitTitle: string;
};

function connectionConfig() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const host = process.env.DB_HOST || "localhost";
  const user = process.env.DB_USER;
  const password = process.env.DB_PASS || process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;
  if (!user || !database) throw new Error("Configure DATABASE_URL ou DB_USER/DB_PASS/DB_NAME.");
  return { host, user, password, database, multipleStatements: false };
}

function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 70);
}

function fallbackImageUrl(prompt: string, seed: number) {
  const encoded = encodeURIComponent(`premium corporate e-learning illustration, ${prompt}, realistic professional quality management, absolutely no text, no words, no letters, no logos, no signage`);
  return `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=576&seed=${seed}&nologo=true`;
}

async function openrouterImage(prompt: string, filename: string): Promise<string | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.warn("[images] OPENROUTER_API_KEY ausente; usando fallback:", filename);
    return null;
  }
  await fs.mkdir(IMAGE_DIR, { recursive: true });
  const outPath = path.join(IMAGE_DIR, filename);
  const outUrl = `${IMAGE_URL_PREFIX}/${filename}`;
  if (process.env.FORCE_IMAGES !== "1") {
    try {
      await fs.access(outPath);
      return outUrl;
    } catch {
      // generate
    }
  }

  const res = await fetch("https://openrouter.ai/api/v1/images", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
      "HTTP-Referer": "https://saudedotrabalho.com",
      "X-Title": "Saude do Trabalho ISO 9001 Lesson Images",
    },
    body: JSON.stringify({
      model: OPENROUTER_IMAGE_MODEL,
      prompt,
      aspect_ratio: "16:9",
      resolution: "1K",
      output_format: "png",
      provider: { order: ["google-ai-studio"], allow_fallbacks: true },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.warn(`[images] OpenRouter falhou ${res.status}: ${detail.slice(0, 220)}`);
    return null;
  }
  const data: any = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) {
    console.warn("[images] OpenRouter nao retornou b64_json:", filename);
    return null;
  }
  await fs.writeFile(outPath, Buffer.from(b64, "base64"));
  console.log(`[images] ${filename} gerada via ${OPENROUTER_IMAGE_MODEL}`);
  return outUrl;
}

function lessonPrompt(lesson: LessonRow) {
  const visualThemes = [
    "quality management classroom with process flow cards represented only by blank geometric shapes",
    "professional training scene with people discussing a clean process map made of unlabeled colored blocks",
    "modern office workshop with abstract risk matrix using plain color squares and no characters",
    "corporate team reviewing customer journey represented by icons and blank sticky notes",
    "quality control workspace with measurement tools, calibration equipment and blank labels",
    "supply chain meeting with packages, checklists shown as empty shapes and supplier evaluation icons",
    "operational control scene with factory and service workflow represented by arrows without words",
    "performance dashboard room with abstract charts only, no numbers and no labels",
    "continuous improvement workshop with root cause diagram shown as blank lines and circles",
    "management review meeting with executives, abstract charts and empty document sheets",
  ];
  const theme = visualThemes[(Number(lesson.orderIndex || 1) - 1) % visualThemes.length];
  return [
    theme,
    "Brazilian corporate quality management training environment",
    "ISO 9001 interpretation represented through abstract icons, process thinking, evidence and improvement",
    "premium realistic e-learning visual, varied camera angle, modern workplace, diverse adults",
    "clean composition with empty screens, blank papers and abstract symbols only",
    "STRICTLY NO TEXT anywhere in the image",
    "no words, no letters, no numbers, no captions, no titles, no subtitles, no signage, no UI text, no logo, no watermark",
  ].join(", ");
}

async function updateLessonBlocks(conn: mysql.Connection, lessonId: number, imageUrl: string) {
  const [blocks] = await conn.execute<any[]>(
    "SELECT id, block_type, content FROM lesson_blocks WHERE lesson_id=? AND block_type IN ('concept','example')",
    [lessonId],
  );
  for (const block of blocks) {
    let content: any = {};
    try {
      content = typeof block.content === "string" ? JSON.parse(block.content) : block.content;
    } catch {
      content = {};
    }
    content.imageUrl = imageUrl;
    delete content.imageQuery;
    await conn.execute("UPDATE lesson_blocks SET content=? WHERE id=?", [JSON.stringify(content), block.id]);
  }
}

async function main() {
  const conn = await mysql.createConnection(connectionConfig() as any);
  try {
    const [lessons] = await conn.execute<LessonRow[] & any[]>(
      `SELECT l.id, l.title, l.description, l.orderIndex, u.title AS unitTitle
       FROM lessons l
       LEFT JOIN units u ON u.id = l.unit_id
       WHERE l.moduleId=?
       ORDER BY l.orderIndex ASC`,
      [MODULE_ID],
    );
    if (!lessons.length) throw new Error(`Nenhuma aula encontrada para o modulo ${MODULE_ID}.`);

    let updated = 0;
    for (const lesson of lessons) {
      const filename = `${String(lesson.orderIndex).padStart(2, "0")}-${slugify(lesson.title)}.png`;
      const prompt = lessonPrompt(lesson);
      const imageUrl = await openrouterImage(prompt, filename) || fallbackImageUrl(prompt, 12000 + Number(lesson.orderIndex));
      await conn.execute("UPDATE lessons SET image_url=? WHERE id=?", [imageUrl, lesson.id]);
      await updateLessonBlocks(conn, lesson.id, imageUrl);
      updated++;
      console.log(`[db] aula ${lesson.orderIndex}/${lessons.length} atualizada: ${lesson.id} -> ${imageUrl}`);
    }

    console.log(JSON.stringify({ ok: true, moduleId: MODULE_ID, lessons: lessons.length, updated, imageModel: OPENROUTER_IMAGE_MODEL }, null, 2));
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
