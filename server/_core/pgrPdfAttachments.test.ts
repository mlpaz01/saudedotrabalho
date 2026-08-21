import fs from "fs/promises";
import path from "path";
import { afterAll, describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { appendPdfAttachments } from "./pgr_pdf";
import { getUploadRoot } from "./runtimePaths";

const testDir = path.join(getUploadRoot(), "pgr_attachment_test");

afterAll(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
});

describe("PDF final do PGR com anexos oficiais", () => {
  it("incorpora todas as paginas dos oito anexos, alem das capas", async () => {
    await fs.mkdir(testDir, { recursive: true });
    const base = await PDFDocument.create();
    base.addPage();
    const basePath = path.join(testDir, "pgr-base.pdf");
    await fs.writeFile(basePath, await base.save());

    const types = [
      "Relatório Psicossocial", "AEP", "Conformidade NR-01", "Conformidade Metodológica",
      "Legitimidade do Canal de Denúncias", "LGPD", "Lei 14.457/2022", "Relatório da CIPA",
    ];
    const attachments = [];
    for (let index = 0; index < types.length; index++) {
      const source = await PDFDocument.create();
      source.addPage();
      source.addPage();
      const fileName = `anexo-${index + 1}.pdf`;
      await fs.writeFile(path.join(testDir, fileName), await source.save());
      attachments.push({
        fileUrl: `pgr_attachment_test/${fileName}`,
        mimeType: "application/pdf",
        titulo: `Documento integral ${index + 1}`,
        tipo: types[index],
      });
    }

    const result = await appendPdfAttachments(basePath, attachments, { strict: true });
    const generated = await PDFDocument.load(await fs.readFile(basePath));

    expect(result.appended).toBe(8);
    expect(result.skipped).toBe(0);
    expect(result.pagesAppended).toBe(16);
    expect(generated.getPageCount()).toBe(25); // 1 base + 8 capas + 16 paginas dos anexos
  });

  it("impede a publicacao silenciosa quando um anexo nao pode ser lido", async () => {
    const base = await PDFDocument.create();
    base.addPage();
    const basePath = path.join(testDir, "pgr-incompleto.pdf");
    await fs.writeFile(basePath, await base.save());
    await expect(appendPdfAttachments(basePath, [{
      fileUrl: "pgr_attachment_test/inexistente.pdf",
      mimeType: "application/pdf",
      titulo: "Anexo ausente",
      tipo: "AEP",
    }], { strict: true })).rejects.toThrow("incorporar integralmente");
  });
});
