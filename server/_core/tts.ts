import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
const pexec = promisify(exec);

const UPLOAD_DIR = "/var/www/saudedotrabalho/uploads/audio";

export async function generateNarrationMP3(
  text: string,
  lessonId: number,
  voice: "antonio" | "francisca" = "antonio"
): Promise<string> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const voiceName = voice === "antonio" ? "pt-BR-AntonioNeural" : "pt-BR-FranciscaNeural";
  const outPath = path.join(UPLOAD_DIR, `lesson_${lessonId}.mp3`);

  const txtPath = `/tmp/tts_${lessonId}_${Date.now()}.txt`;
  const cleanText = (text || "")
    .replace(/[*_#`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 8000);
  await fs.writeFile(txtPath, cleanText, "utf-8");

  try {
    await pexec(`edge-tts --voice ${voiceName} --file "${txtPath}" --write-media "${outPath}"`, { timeout: 180000 });
  } finally {
    await fs.unlink(txtPath).catch(() => {});
  }

  return `/uploads/audio/lesson_${lessonId}.mp3`;
}
