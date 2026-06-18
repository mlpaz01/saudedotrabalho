import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

type Row = {
  matricula: string;
  tipo_exame?: string;
  data_realizacao: string;
  resultado?: string;
  validade?: string;
  medico?: string;
  crm?: string;
  notas?: string;
};

function parseCSV(text: string): Row[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const split = (l: string) => {
    const out: string[] = [];
    let cur = "", inQ = false;
    for (let i=0;i<l.length;i++){
      const ch = l[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if ((ch === "," || ch === ";") && !inQ) { out.push(cur); cur = ""; continue; }
      cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const header = split(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, "_"));
  const rows: Row[] = [];
  for (let i=1;i<lines.length;i++){
    const cols = split(lines[i]);
    const obj: any = {};
    header.forEach((h, idx) => { obj[h] = cols[idx] ?? ""; });
    rows.push(obj);
  }
  return rows;
}

export default function AdminImportarASO() {
  const [, navigate] = useLocation();
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const mut = trpc.ehs.importAsos.useMutation();

  const onFile = async (f: File) => {
    setFileName(f.name);
    const text = await f.text();
    const parsed = parseCSV(text);
    setRows(parsed);
    toast.success(`${parsed.length} linhas detectadas`);
  };

  const doImport = async () => {
    if (rows.length === 0) { toast.error("Nenhuma linha para importar"); return; }
    try {
      const out = await mut.mutateAsync({ rows: rows as any, dryRun: false });
      toast.success(`Importação concluída: ${out.summary.inserted} inseridos, ${out.summary.skipped} ignorados`);
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? e));
    }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <button onClick={() => history.back()} className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground"><ArrowLeft size={14}/> Voltar</button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText size={22}/> Importar ASOs realizados</h1>
          <p className="text-sm text-muted-foreground mt-1">CSV com colunas: matricula, tipo_exame, data_realizacao, resultado, validade, medico, crm, notas</p>
        </div>

        <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Arquivo CSV</span>
            <input type="file" accept=".csv,text/csv" className="block mt-2"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
            {fileName && <p className="text-xs text-muted-foreground mt-2">{fileName}</p>}
          </label>

          {rows.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Pré-visualização ({rows.length} linhas)</h3>
              <div className="overflow-x-auto border rounded">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>{Object.keys(rows[0]).map((k) => <th key={k} className="py-1 px-2 text-left font-medium">{k}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.slice(0,10).map((r, i) => (
                      <tr key={i} className="border-t">
                        {Object.values(r).map((v: any, j) => <td key={j} className="py-1 px-2">{v}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 10 && <p className="text-xs text-muted-foreground mt-2">+ {rows.length - 10} linhas adicionais</p>}
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={doImport} disabled={rows.length === 0 || mut.isPending}>
              <Upload size={14} className="mr-1"/> Importar {rows.length > 0 ? `${rows.length} ASO(s)` : ""}
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
