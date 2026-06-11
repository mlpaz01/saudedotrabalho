#!/usr/bin/env python3
"""
Patch script: adds listGheGse, saveGheGse, listEpcEpi, saveEpcEpi,
listPgrRevisions, savePgrRevision, deletePgrRevision to pgr router,
and suggestModuleForFactor to riskAssessment router.
"""
import sys

FILE = "/var/www/saudedotrabalho/server/routers.ts"

with open(FILE, "r", encoding="utf-8") as f:
    content = f.read()

# Check if already patched
if "listGheGse:" in content:
    print("Already patched")
    sys.exit(0)

NEW_PGR_PROCS = r"""
    listGheGse: adminOrRhProcedure
      .input(z.object({ pgrId: z.number().int() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const r: any = await db.execute(drzSql`SELECT * FROM pgr_ghe_gse WHERE pgr_document_id = ${input.pgrId} ORDER BY id ASC`);
        return (r as any)[0] ?? [];
      }),

    saveGheGse: adminOrRhProcedure
      .input(z.object({
        pgrId: z.number().int(),
        items: z.array(z.object({
          nome: z.string(),
          tipo: z.string().default("GHE"),
          setor: z.string().default(""),
          funcao: z.string().default(""),
          atividade: z.string().default(""),
          qtdExpostos: z.number().int().default(0),
          jornada: z.string().default(""),
          ambienteOperacional: z.string().default(""),
          exposicaoSimilar: z.string().default(""),
        }))
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        await db.execute(drzSql`DELETE FROM pgr_ghe_gse WHERE pgr_document_id = ${input.pgrId}`);
        for (const item of input.items) {
          await db.execute(drzSql`INSERT INTO pgr_ghe_gse (pgr_document_id, nome, tipo, setor, funcao, atividade, qtd_expostos, jornada, ambiente_operacional, exposicao_similar) VALUES (${input.pgrId}, ${item.nome}, ${item.tipo}, ${item.setor}, ${item.funcao}, ${item.atividade}, ${item.qtdExpostos}, ${item.jornada}, ${item.ambienteOperacional}, ${item.exposicaoSimilar})`);
        }
        return { ok: true };
      }),

    listEpcEpi: adminOrRhProcedure
      .input(z.object({ pgrId: z.number().int() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const r: any = await db.execute(drzSql`SELECT * FROM pgr_epc_epi WHERE pgr_document_id = ${input.pgrId} ORDER BY tipo ASC, id ASC`);
        return (r as any)[0] ?? [];
      }),

    saveEpcEpi: adminOrRhProcedure
      .input(z.object({
        pgrId: z.number().int(),
        items: z.array(z.object({
          tipo: z.string(),
          descricao: z.string(),
          numeroCa: z.string().default(""),
          riscoVinculado: z.string().default(""),
          periodicidadeTroca: z.string().default(""),
          nivelProtecao: z.string().default(""),
          statusItem: z.string().default("obrigatorio"),
          observacoes: z.string().default(""),
        }))
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        await db.execute(drzSql`DELETE FROM pgr_epc_epi WHERE pgr_document_id = ${input.pgrId}`);
        for (const item of input.items) {
          await db.execute(drzSql`INSERT INTO pgr_epc_epi (pgr_document_id, tipo, descricao, numero_ca, risco_vinculado, periodicidade_troca, nivel_protecao, status_item, observacoes) VALUES (${input.pgrId}, ${item.tipo}, ${item.descricao}, ${item.numeroCa}, ${item.riscoVinculado}, ${item.periodicidadeTroca}, ${item.nivelProtecao}, ${item.statusItem}, ${item.observacoes})`);
        }
        return { ok: true };
      }),

    listPgrRevisions: adminOrRhProcedure
      .input(z.object({ pgrId: z.number().int() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const r: any = await db.execute(drzSql`SELECT * FROM pgr_revision_history WHERE pgr_document_id = ${input.pgrId} ORDER BY id ASC`);
        return (r as any)[0] ?? [];
      }),

    savePgrRevision: adminOrRhProcedure
      .input(z.object({
        pgrId: z.number().int(),
        versao: z.string(),
        dataRevisao: z.string().nullable().optional(),
        responsavel: z.string().default(""),
        alteracaoRealizada: z.string().default(""),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        await db.execute(drzSql`INSERT INTO pgr_revision_history (pgr_document_id, versao, data_revisao, responsavel, alteracao_realizada) VALUES (${input.pgrId}, ${input.versao}, ${input.dataRevisao ?? null}, ${input.responsavel}, ${input.alteracaoRealizada})`);
        return { ok: true };
      }),

    deletePgrRevision: adminOrRhProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        await db.execute(drzSql`DELETE FROM pgr_revision_history WHERE id = ${input.id}`);
        return { ok: true };
      }),
"""

NEW_RISK_PROC_BEFORE = """    suggestModuleForFactor: adminOrRhProcedure
      .input(z.object({ factorName: z.string() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
        const cid = Number((ctx.user as any).companyId) || 0;
        const r: any = await db.execute(drzSql`SELECT id, title FROM modules WHERE (company_id = ${cid} OR company_id IS NULL) AND publish_status = 'published' ORDER BY title ASC LIMIT 50`);
        const modules: any[] = (r as any)[0] ?? [];
        const keywords = input.factorName.toLowerCase().split(/[\\s,;-]+/).filter((w: string) => w.length > 3);
        if (!keywords.length) return modules.slice(0, 5);
        return modules.filter((m: any) => {
          const text = (String(m.title || '')).toLowerCase();
          return keywords.some((k: string) => text.includes(k));
        }).slice(0, 5);
      }),

"""

# ── Patch 1: Insert PGR procedures before pgr router closing ──────────────
scheduling_pos = content.find("  scheduling: router({")
if scheduling_pos == -1:
    print("ERROR: Could not find 'scheduling: router({' in file")
    sys.exit(1)

# Find "  })," just before scheduling_pos (looking backwards)
region = content[:scheduling_pos]
pgr_close_pos = region.rfind("  }),\n")
if pgr_close_pos == -1:
    print("ERROR: Could not find pgr router closing before scheduling")
    sys.exit(1)

insert_pos = pgr_close_pos
content = content[:insert_pos] + NEW_PGR_PROCS + content[insert_pos:]
print(f"PGR procedures inserted at position {insert_pos}")

# ── Patch 2: Insert suggestModuleForFactor before allActionItems ──────────
ALLACTION_ANCHOR = "    allActionItems: adminOrRhProcedure"
allaction_pos = content.find(ALLACTION_ANCHOR)
if allaction_pos == -1:
    print("ERROR: Could not find 'allActionItems: adminOrRhProcedure'")
    sys.exit(1)

content = content[:allaction_pos] + NEW_RISK_PROC_BEFORE + content[allaction_pos:]
print(f"suggestModuleForFactor inserted before allActionItems at position {allaction_pos}")

# ── Write back ────────────────────────────────────────────────────────────
with open(FILE, "w", encoding="utf-8") as f:
    f.write(content)

print("Patch applied successfully!")

# ── Verify ────────────────────────────────────────────────────────────────
with open(FILE, "r", encoding="utf-8") as f:
    verify = f.read()

checks = ["listGheGse:", "saveGheGse:", "listEpcEpi:", "saveEpcEpi:",
          "listPgrRevisions:", "savePgrRevision:", "deletePgrRevision:",
          "suggestModuleForFactor:"]
for chk in checks:
    if chk in verify:
        print(f"  OK: {chk} found")
    else:
        print(f"  MISSING: {chk} NOT found!")
        sys.exit(1)

print("All checks passed.")
