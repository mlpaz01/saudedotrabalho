/**
 * getImageForQuery — returns a URL for an image matching the query.
 * Uses Pollinations.ai (free AI image gen) as primary,
 * Unsplash as secondary, Picsum as last resort.
 */

function pollinationsUrl(query: string, seed?: number): string {
  const encoded = encodeURIComponent(
    `professional occupational safety workplace ${query}, photorealistic, high quality, 4k`
  );
  const s = seed ?? Math.abs(query.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % 9999;
  return `https://image.pollinations.ai/prompt/${encoded}?width=800&height=450&seed=${s}&nologo=true`;
}

async function unsplashUrl(query: string): Promise<string | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  try {
    const r = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&client_id=${key}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) return null;
    const d = await r.json() as any;
    return d?.urls?.regular ?? null;
  } catch { return null; }
}

export async function getImageForQuery(query: string): Promise<string> {
  // Pollinations is instant (URL-based), use it as primary
  // Try Unsplash first for photo-realistic results, fall back to Pollinations
  try {
    const url = await unsplashUrl(query);
    if (url) return url;
  } catch { /* ignore */ }
  // Pollinations.ai — deterministic AI image from prompt
  return pollinationsUrl(query);
}
