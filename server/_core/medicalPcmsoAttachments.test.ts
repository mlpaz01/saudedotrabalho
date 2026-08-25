import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { appendPcmsoAttachments } from "./medicalRouter";

const testDir = path.join(os.tmpdir(), "saude-pcmso-attachment-test");

afterAll(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
});

describe("PDF final do PCMSO com anexos estruturados", () => {
  it("incorpora integralmente todas as páginas depois da capa do anexo", async () => {
    await fs.mkdir(testDir, { recursive: true });
    const base = await PDFDocument.create();
    base.addPage();
    const source = await PDFDocument.create();
    source.addPage();
    source.addPage();
    source.addPage();
    const annexPath = path.join(testDir, "anexo-tres-paginas.pdf");
    await fs.writeFile(annexPath, await source.save());

    const result = await appendPcmsoAttachments(await base.save(), [{
      annex_number: 1,
      title: "Documento técnico integral",
      file_name: "anexo-tres-paginas.pdf",
      mime_type: "application/pdf",
      private_path: annexPath,
    }]);
    const finalDocument = await PDFDocument.load(result.bytes);

    expect(result.appendedPages).toBe(4);
    expect(finalDocument.getPageCount()).toBe(5); // base + capa + 3 páginas
  });

  it("interrompe a geração quando o arquivo estruturado está ausente", async () => {
    const base = await PDFDocument.create();
    base.addPage();
    await expect(appendPcmsoAttachments(await base.save(), [{
      annex_number: 2,
      file_name: "ausente.pdf",
      mime_type: "application/pdf",
      private_path: path.join(testDir, "ausente.pdf"),
    }])).rejects.toThrow("não está disponível");
  });
});
