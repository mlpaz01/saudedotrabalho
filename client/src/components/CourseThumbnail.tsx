/**
 * CourseThumbnail — thumbnail editorial gerado deterministicamente a partir do título + categoria.
 * Se houver imageUrl explícita, ela tem prioridade.
 * Mesmo curso = mesmo visual sempre (hash determinístico do título).
 */

type Palette = { bg: string; accent: string; soft: string; cat: string };

const PALETTES: Record<string, Palette> = {
  nr01:               { bg: "#1e3a5f", accent: "#2d7a5f", soft: "#94d8b8", cat: "NR-01" },
  nr01_psicossocial:  { bg: "#1e3a5f", accent: "#2d7a5f", soft: "#94d8b8", cat: "NR-01" },
  saude_mental:       { bg: "#5b21b6", accent: "#a78bfa", soft: "#e9d5ff", cat: "SAÚDE MENTAL" },
  lideranca:          { bg: "#0d9488", accent: "#5eead4", soft: "#a7f3d0", cat: "LIDERANÇA" },
  comunicacao:        { bg: "#0e7490", accent: "#67e8f9", soft: "#a5f3fc", cat: "COMUNICAÇÃO" },
  assedio:            { bg: "#9f1239", accent: "#fb7185", soft: "#fecdd3", cat: "PREV. ASSÉDIO" },
  burnout:            { bg: "#a16207", accent: "#facc15", soft: "#fef08a", cat: "BURNOUT" },
  ergonomia:          { bg: "#166534", accent: "#86efac", soft: "#bbf7d0", cat: "ERGONOMIA" },
  geral:              { bg: "#475569", accent: "#94a3b8", soft: "#cbd5e1", cat: "GERAL" },
  outros:             { bg: "#9a3412", accent: "#fb923c", soft: "#fed7aa", cat: "OUTROS" },
};

const LABEL_TO_CODE: Record<string, string> = {
  "nr-01": "nr01",
  "nr01": "nr01",
  "saúde mental": "saude_mental",
  "saude mental": "saude_mental",
  "liderança": "lideranca",
  "lideranca": "lideranca",
  "comunicação": "comunicacao",
  "comunicacao": "comunicacao",
  "segurança": "nr01",
  "seguranca": "nr01",
  "compliance": "assedio",
  "prevenção ao assédio": "assedio",
  "assédio": "assedio",
  "assedio": "assedio",
  "burnout": "burnout",
  "ergonomia": "ergonomia",
  "geral": "geral",
  "outros": "outros",
  "nr01_psicossocial": "nr01",
};

const FALLBACK_PALETTES: Palette[] = [
  { bg: "#1e3a5f", accent: "#2d7a5f", soft: "#94d8b8", cat: "GERAL" },
  { bg: "#5b21b6", accent: "#a78bfa", soft: "#e9d5ff", cat: "GERAL" },
  { bg: "#0d9488", accent: "#5eead4", soft: "#a7f3d0", cat: "GERAL" },
  { bg: "#9a3412", accent: "#fb923c", soft: "#fed7aa", cat: "GERAL" },
  { bg: "#0e7490", accent: "#67e8f9", soft: "#a5f3fc", cat: "GERAL" },
  { bg: "#a16207", accent: "#facc15", soft: "#fef08a", cat: "GERAL" },
  { bg: "#9f1239", accent: "#fb7185", soft: "#fecdd3", cat: "GERAL" },
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function getPalette(category?: string | null, title?: string | null): Palette {
  if (category) {
    const norm = category.toLowerCase().trim();
    const code = LABEL_TO_CODE[norm] ?? norm;
    if (PALETTES[code]) return PALETTES[code];
  }
  // Auto-detecta via keywords no título
  const t = (title ?? "").toLowerCase();
  if (/(ass[eé]dio|moral|violência|denúncia)/.test(t)) return PALETTES.assedio;
  if (/(sa[uú]de mental|psicológic|emocion|bem-estar)/.test(t)) return PALETTES.saude_mental;
  if (/(burnout|sobrecarga|exaust)/.test(t)) return PALETTES.burnout;
  if (/(lideran|gestão de equipe|chefia|gerenci)/.test(t)) return PALETTES.lideranca;
  if (/(comunica|escuta|feedback)/.test(t)) return PALETTES.comunicacao;
  if (/(ergonom|postura|trabalho remoto)/.test(t)) return PALETTES.ergonomia;
  if (/(nr-?0?1|psicossoci|risco)/.test(t)) return PALETTES.nr01;
  // fallback determinístico
  return FALLBACK_PALETTES[hashString(title ?? "x") % FALLBACK_PALETTES.length];
}

function getInitials(title: string): string {
  const stop = new Set(["de", "da", "do", "dos", "das", "e", "em", "na", "no", "o", "a", "para", "com", "ao", "à", "as", "os", "um", "uma"]);
  const words = (title ?? "")
    .split(/\s+/)
    .map(w => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(w => w.length > 1 && !stop.has(w.toLowerCase()));
  if (words.length === 0) return (title ?? "?").slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function splitTitleForCover(title: string): { line1: string; line2: string } {
  const words = (title ?? "").split(/\s+/);
  if (words.length === 0) return { line1: "", line2: "" };
  if (words.length === 1) return { line1: words[0], line2: "" };
  // tenta dividir o mais balanceado possível mantendo até ~14 chars por linha
  let best = { line1: words[0], line2: words.slice(1).join(" ") };
  for (let i = 1; i < words.length; i++) {
    const l1 = words.slice(0, i).join(" ");
    const l2 = words.slice(i).join(" ");
    if (l1.length <= 16 && l2.length <= 16) {
      if (Math.abs(l1.length - l2.length) < Math.abs(best.line1.length - best.line2.length)) {
        best = { line1: l1, line2: l2 };
      }
    }
  }
  // se ainda muito longo, trunca a segunda linha
  if (best.line2.length > 18) best.line2 = best.line2.slice(0, 16) + "…";
  return best;
}

export interface CourseThumbnailProps {
  title: string;
  category?: string | null;
  imageUrl?: string | null;
  variant?: "editorial" | "compact";
  className?: string;
  style?: React.CSSProperties;
}

/**
 * - variant="editorial" (default): card grande, ideal para grid ou cabeçalho.
 * - variant="compact": miniatura quadrada com iniciais — ideal para linhas de lista.
 */
export function CourseThumbnail({ title, category, imageUrl, variant = "editorial", className, style }: CourseThumbnailProps) {
  if (imageUrl) {
    return (
      <div
        className={className}
        style={{ background: `#1e3a5f center/cover no-repeat url(${imageUrl})`, ...style }}
        aria-label={title}
        role="img"
      />
    );
  }
  const p = getPalette(category, title);
  if (variant === "compact") {
    const initials = getInitials(title);
    return (
      <div
        className={className}
        style={{
          background: p.bg,
          color: "#fff",
          fontFamily: "Georgia, serif",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          ...style,
        }}
        aria-label={title}
        role="img"
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: p.accent }} />
        <span style={{ fontSize: "0.95em" }}>{initials}</span>
      </div>
    );
  }
  // editorial
  const { line1, line2 } = splitTitleForCover(title);
  return (
    <div
      className={className}
      style={{
        background: p.bg,
        color: "#fff",
        position: "relative",
        padding: "14px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        ...style,
      }}
      aria-label={title}
      role="img"
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: p.accent }} />
      <div style={{ fontSize: 9, letterSpacing: 3, fontWeight: 700, color: p.soft, fontFamily: "Helvetica, Arial, sans-serif" }}>
        {p.cat}
      </div>
      <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, fontSize: 16, lineHeight: 1.1 }}>
        <div>{line1}</div>
        {line2 ? <div>{line2}</div> : null}
        <div style={{ width: 28, height: 2, background: p.accent, marginTop: 8 }} />
      </div>
    </div>
  );
}
