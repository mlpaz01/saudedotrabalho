import path from "path";

function resolveConfiguredPath(value: string | undefined, fallback: string) {
  if (!value?.trim()) return fallback;
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

export function getUploadRoot() {
  return resolveConfiguredPath(
    process.env.UPLOAD_DIR,
    path.join(process.cwd(), "uploads")
  );
}

export function getPublicPdfRoot() {
  return resolveConfiguredPath(
    process.env.PUBLIC_PDF_DIR,
    path.join(process.cwd(), "public", "pdfs")
  );
}
