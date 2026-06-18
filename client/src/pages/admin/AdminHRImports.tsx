import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2, Loader2, Database } from "lucide-react";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Kind = "absenteismo" | "atestados" | "acidentes" | "turnover" | "disciplinares";

const KIND_LABELS: Record<Kind, string> = {
  absenteismo: "Absenteísmo",
  atestados: "Atestados Médicos",
  acidentes: "Acidentes de Trabalho",
  turnover: "Turnover",
  disciplinares: "Indicadores Disciplinares",
};

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // Simple CSV parser — accepts comma or semicolon separator
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const sep = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, j) => { row[h] = cells[j] ?? ""; });
    rows.push(row);
  }
  return { headers, rows };
}

function downloadCSV(filename: string, headers: string[], exampleRow: string[]) {
  const csv = [headers.join(","), exampleRow.join(",")].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

export default function AdminHRImports() {
  const [kind, setKind] = useState<Kind>("absenteismo");
  const [preview, setPreview] = useState<{ headers: string[]; rows: any[] }>({ headers: [], rows: [] });
  const fileRef = useRef<HTMLInputElement>(null);

  const templatesQ = trpc.hr360.templates.useQuery();
  const overviewQ = trpc.hr360.overview.useQuery();
  const importMut = trpc.hr360.importRows.useMutation({
    onSuccess: (r) => {
      toast.success(`Importados: ${r.inserted}. Ignorados: ${r.skipped}.`);
      if (r.errors.length > 0) toast.error(r.errors.slice(0, 3).join(" | "));
      setPreview({ headers: [], rows: [] });
      if (fileRef.current) fileRef.current.value = "";
      overviewQ.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const tplData = templatesQ.data?.[kind];

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const parsed = parseCSV(text);
      setPreview(parsed);
    };
    reader.readAsText(file, "utf-8");
  }

  function doImport() {
    if (preview.rows.length === 0) { toast.error("Carregue um CSV primeiro."); return; }
    importMut.mutate({ kind, rows: preview.rows.slice(0, 5000) });
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-4 max-w-5xl mx-auto">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            <Database size={22} /> Importação de Dados — Visão 360
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Importe CSVs de Absenteísmo, Atestados, Acidentes, Turnover e Indicadores Disciplinares.
            Os dados enriquecem a Visão 360 dos colaboradores. Use o e-mail como chave para vínculo automático.
          </p>
        </div>

        {overviewQ.data && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
              <div key={k} className="border rounded-lg p-3 bg-white">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{KIND_LABELS[k]}</p>
                <p className="text-xl font-bold text-slate-800">{overviewQ.data[k as keyof typeof overviewQ.data] ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">registros</p>
              </div>
            ))}
          </div>
        )}

        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Tipo de dado</label>
                <Select value={kind} onValueChange={(v) => { setKind(v as Kind); setPreview({ headers: [], rows: [] }); if (fileRef.current) fileRef.current.value = ""; }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
                      <SelectItem key={k} value={k}>{KIND_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {tplData && (
                <div className="flex items-end">
                  <Button variant="outline" onClick={() => downloadCSV(`template_${kind}.csv`, tplData.headers, tplData.example)} className="gap-2">
                    <Download size={14} /> Baixar template CSV
                  </Button>
                </div>
              )}
            </div>

            {tplData && (
              <div className="text-[11px] text-muted-foreground border rounded p-2 bg-slate-50">
                <strong>Cabeçalho esperado:</strong> {tplData.headers.join(", ")}
                <br />
                <strong>Modelo simplificado:</strong> obrigatórios são apenas <code>email</code> + data + tipo. Os demais campos (filial, setor, cargo) são preenchidos automaticamente a partir do cadastro do colaborador quando o e-mail for encontrado.
              </div>
            )}

            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <FileSpreadsheet size={28} className="mx-auto text-slate-400 mb-2" />
              <p className="text-sm text-muted-foreground mb-3">Carregue um arquivo CSV (separador <code>,</code> ou <code>;</code>)</p>
              <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="text-sm" />
            </div>

            {preview.rows.length > 0 && (
              <>
                <p className="text-sm text-slate-700"><strong>{preview.rows.length}</strong> linha(s) detectada(s). Pré-visualização (5 primeiras):</p>
                <div className="border rounded overflow-x-auto">
                  <table className="text-xs w-full">
                    <thead className="bg-slate-50">
                      <tr>{preview.headers.map((h) => <th key={h} className="px-2 py-1 text-left font-medium">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {preview.rows.slice(0, 5).map((r, i) => (
                        <tr key={i} className="border-t">
                          {preview.headers.map((h) => <td key={h} className="px-2 py-1">{r[h] ?? ""}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button onClick={doImport} disabled={importMut.isPending} className="gap-2">
                  {importMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  Importar {preview.rows.length} registro(s)
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
