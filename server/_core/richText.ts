import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "blockquote",
  "h2",
  "h3",
  "h4",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "span",
  "a",
  "img",
];

const HTML_TAG_PATTERN =
  /<\/?(?:p|br|strong|b|em|i|u|ul|ol|li|blockquote|h[2-4]|table|thead|tbody|tr|th|td|span|a|img)\b[^>]*>/i;

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    char =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ] || char
  );
}

function plainTextToParagraphs(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map(paragraph => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function sanitizeRichText(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (!HTML_TAG_PATTERN.test(raw)) return plainTextToParagraphs(raw);
  return sanitizeHtml(raw, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "title", "target"],
      img: ["src", "alt", "width", "height"],
      th: ["colspan", "rowspan", "style"],
      td: ["colspan", "rowspan", "style"],
      table: ["style"],
      p: ["style"],
      span: ["style"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
    allowedStyles: {
      "*": {
        "text-align": [/^left$/, /^right$/, /^center$/, /^justify$/],
      },
      table: {
        width: [/^\d+(?:\.\d+)?%$/],
        "border-collapse": [/^collapse$/],
        margin: [/^[\d.]+(?:px|em|rem)\s+[\d.]+(?:px|em|rem)$/],
      },
      th: {
        "text-align": [/^left$/, /^right$/, /^center$/],
        "font-weight": [/^\d{3}$/, /^bold$/],
      },
      td: {
        "text-align": [/^left$/, /^right$/, /^center$/],
      },
    },
    allowedClasses: {},
    disallowedTagsMode: "discard",
    enforceHtmlBoundary: true,
  }).trim();
}

export const MAX_DOCUMENT_RICH_TEXT_BYTES = 15_000_000;

export function normalizeDocumentRichText(value: unknown) {
  const normalized = sanitizeRichText(value);
  if (Buffer.byteLength(normalized, "utf8") > MAX_DOCUMENT_RICH_TEXT_BYTES) {
    throw new Error(
      "O texto formatado excede o limite técnico de 15 MB. Remova imagens incorporadas ou conteúdo duplicado e tente novamente."
    );
  }
  return normalized;
}

export function richTextToPlainText(value: unknown) {
  return sanitizeHtml(String(value || ""), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+/g, " ")
    .trim();
}
