// Shared lenient JSON parser. Gemini sometimes wraps in ``` or emits
// raw newlines inside strings; this rescues those payloads.
export function parseLenientJson(text: string): any {
  let j = text.trim();
  if (j.startsWith("```")) j = j.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(j); }
  catch {
    let out = ""; let inStr = false; let esc = false;
    for (let i = 0; i < j.length; i++) {
      const ch = j[i];
      if (esc) { out += ch; esc = false; continue; }
      if (ch === "\\") { out += ch; esc = true; continue; }
      if (ch === '"') { inStr = !inStr; out += ch; continue; }
      if (inStr) {
        const c = ch.charCodeAt(0);
        if (c === 0x0a) { out += "\\n"; continue; }
        if (c === 0x0d) { out += "\\r"; continue; }
        if (c === 0x09) { out += "\\t"; continue; }
        if (c < 0x20) { out += " "; continue; }
      }
      out += ch;
    }
    return JSON.parse(out);
  }
}
