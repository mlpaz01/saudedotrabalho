import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CheckCircle2, Clock, AlertTriangle, FileDown, Download } from "lucide-react";

const TIPO_RISCO_OPTIONS = ["Físico","Químico","Biológico","Ergonômico","Acidente","Psicossocial","Outro"];
const PERIODICIDADE_OPTIONS = ["Admissional","Semestral","Anual","Bienal","Quando necessário"];
const STATUS_OPTIONS = ["pendente","em_dia","vencido"];

const EXAM_CATALOG: Record<string, { exame: string; periodicidade: string }[]> = {
  "Físico": [
    { exame: "Audiometria tonal (Ruído)", periodicidade: "Anual" },
    { exame: "Avaliação vestibular (Vibração)", periodicidade: "Anual" },
    { exame: "Avaliação cardiológica (Calor/Frio)", periodicidade: "Anual" },
  ],
  "Químico": [
    { exame: "Hemograma completo (Benzeno)", periodicidade: "Semestral" },
    { exame: "Colinesterase eritrocitária (Agrotóxico)", periodicidade: "Semestral" },
    { exame: "Hepatograma (Solventes)", periodicidade: "Anual" },
    { exame: "Espirometria (Sílica/Poeira)", periodicidade: "Anual" },
    { exame: "Radiografia de tórax (Sílica/Asbestos)", periodicidade: "Bienal" },
  ],
  "Biológico": [
    { exame: "Sorologia HBsAg / Anti-HBs", periodicidade: "Anual" },
    { exame: "Anti-HCV / VDRL", periodicidade: "Anual" },
    { exame: "PPD (Tuberculose)", periodicidade: "Anual" },
  ],
  "Ergonômico": [
    { exame: "Avaliação osteoarticular / DORT", periodicidade: "Anual" },
    { exame: "Avaliação postural", periodicidade: "Anual" },
    { exame: "Avaliação oftalmológica (telas)", periodicidade: "Anual" },
  ],
  "Acidente": [
    { exame: "Avaliação clínica geral", periodicidade: "Anual" },
    { exame: "Acuidade visual", periodicidade: "Anual" },
  ],
  "Psicossocial": [
    { exame: "Avaliação psicológica ocupacional", periodicidade: "Anual" },
    { exame: "Entrevista clínica (bem-estar mental)", periodicidade: "Anual" },
  ],
};

type PcmsoRow = {
  id: number; fatorRisco: string; tipoRisco: string; tipoExame: string;
  periodicidade: string; prazAdmissional: boolean; prazPeriodico: boolean;
  prazDemissional: boolean; prazMudancaFuncao: boolean; prazRetorno: boolean;
  status: string; observacoes?: string | null; responsavel?: string | null;
};

function emptyForm(): Omit<PcmsoRow,"id"> {
  return {
    fatorRisco: "", tipoRisco: "Psicossocial", tipoExame: "", periodicidade: "Anual",
    prazAdmissional: true, prazPeriodico: true, prazDemissional: true,
    prazMudancaFuncao: false, prazRetorno: false,
    status: "pendente", observacoes: "", responsavel: "",
  };
}

function statusBadge(s: string) {
  if (s === "em_dia") return <Badge className="bg-green-100 text-green-700 border-green-200 gap-1"><CheckCircle2 size={12}/>Em dia</Badge>;
  if (s === "vencido") return <Badge className="bg-red-100 text-red-700 border-red-200 gap-1"><AlertTriangle size={12}/>Vencido</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 gap-1"><Clock size={12}/>Pendente</Badge>;
}

export default function AdminPCMSO() {
  const [filter, setFilter] = useState("");
  const [filterTipo, setFilterTipo] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<Omit<PcmsoRow,"id"> & { id?: number }>(emptyForm());

  const listQ = trpc.pcmso.list.useQuery({ tipoRisco: filterTipo !== "all" ? filterTipo : undefined });
  const items = (listQ.data ?? []) as PcmsoRow[];

  const upsertM = trpc.pcmso.upsert.useMutation({ onSuccess: () => { listQ.refetch(); setDialogOpen(false); toast.success("Salvo com sucesso"); } });
  const removeM = trpc.pcmso.remove.useMutation({ onSuccess: () => { listQ.refetch(); setDeleteId(null); toast.success("Excluído"); } });
  const importM = trpc.pcmso.importFromPGR.useMutation({
    onSuccess: (r) => { listQ.refetch(); toast.success(`${(r as any).imported} exame(s) importado(s) do último PGR`); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = items.filter(it => {
    const q = filter.toLowerCase();
    return !q || it.fatorRisco.toLowerCase().includes(q) || it.tipoExame.toLowerCase().includes(q);
  });

  // Group by tipoRisco
  const groups = new Map<string, PcmsoRow[]>();
  for (const it of filtered) {
    const k = it.tipoRisco || "Outro";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(it);
  }

  const kpiTotal = items.length;
  const kpiEmDia = items.filter(i => i.status === "em_dia").length;
  const kpiVencido = items.filter(i => i.status === "vencido").length;
  const kpiPendente = items.filter(i => i.status === "pendente").length;

  function openNew() { setForm(emptyForm()); setDialogOpen(true); }
  function openEdit(it: PcmsoRow) { setForm({ ...it }); setDialogOpen(true); }
  function setF(k: string, v: any) { setForm(f => ({ ...f, [k]: v })); }

  function addFromCatalog(tipoRisco: string) {
    const entries = EXAM_CATALOG[tipoRisco] ?? [];
    for (const e of entries) {
      const key = `${e.exame}`;
      if (!items.find(i => i.tipoExame === key)) {
        upsertM.mutate({
          fatorRisco: tipoRisco, tipoRisco,
          tipoExame: e.exame, periodicidade: e.periodicidade,
          prazAdmissional: true, prazPeriodico: true, prazDemissional: true,
          prazMudancaFuncao: false, prazRetorno: false, status: "pendente",
        });
      }
    }
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">PCMSO — Programa de Controle Médico</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Mapeamento Risco → Exames Médicos Ocupacionais (NR-07)</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="gap-1" onClick={() => importM.mutate({})} disabled={importM.isPending}>
              <Download size={14}/>{importM.isPending ? "Importando..." : "Importar do PGR"}
            </Button>
            <Button size="sm" className="gap-1" onClick={openNew}>
              <Plus size={14}/>Adicionar exame
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total de mapeamentos", value: kpiTotal, color: "text-slate-600", bg: "bg-slate-50" },
            { label: "Em dia", value: kpiEmDia, color: "text-green-600", bg: "bg-green-50" },
            { label: "Pendentes", value: kpiPendente, color: "text-yellow-600", bg: "bg-yellow-50" },
            { label: "Vencidos", value: kpiVencido, color: "text-red-600", bg: "bg-red-50" },
          ].map(k => (
            <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
              <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Catalog shortcuts */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
          <p className="text-sm font-medium text-blue-800">Adicionar do catálogo padrão NR-07 por tipo de risco:</p>
          <div className="flex flex-wrap gap-2">
            {TIPO_RISCO_OPTIONS.filter(t => EXAM_CATALOG[t]).map(t => (
              <Button key={t} size="sm" variant="outline" className="text-xs border-blue-300 text-blue-700"
                onClick={() => addFromCatalog(t)}>+ {t}</Button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <Input placeholder="Buscar fator ou exame..." value={filter} onChange={e => setFilter(e.target.value)} className="max-w-xs"/>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Tipo de risco" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {TIPO_RISCO_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Table grouped by tipo */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileDown size={40} className="mx-auto mb-3 opacity-30"/>
            <p>Nenhum mapeamento cadastrado. Clique em "Importar do PGR" ou "Adicionar exame".</p>
          </div>
        ) : (
          Array.from(groups.entries()).map(([tipo, rows]) => (
            <div key={tipo} className="bg-white border rounded-xl overflow-hidden">
              <div className="bg-slate-50 border-b px-4 py-2 font-semibold text-sm text-slate-700">
                {tipo} <span className="text-muted-foreground font-normal">({rows.length})</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50/50 text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left">Fator de Risco</th>
                    <th className="px-3 py-2 text-left">Exame</th>
                    <th className="px-3 py-2 text-left">Periodicidade</th>
                    <th className="px-3 py-2 text-center">Adm</th>
                    <th className="px-3 py-2 text-center">Per</th>
                    <th className="px-3 py-2 text-center">Dem</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(it => (
                    <tr key={it.id} className="border-b last:border-0 hover:bg-slate-50/50">
                      <td className="px-3 py-2 font-medium">{it.fatorRisco}</td>
                      <td className="px-3 py-2">{it.tipoExame}</td>
                      <td className="px-3 py-2 text-muted-foreground">{it.periodicidade}</td>
                      <td className="px-3 py-2 text-center">{it.prazAdmissional ? "✓" : "—"}</td>
                      <td className="px-3 py-2 text-center">{it.prazPeriodico ? "✓" : "—"}</td>
                      <td className="px-3 py-2 text-center">{it.prazDemissional ? "✓" : "—"}</td>
                      <td className="px-3 py-2">{statusBadge(it.status)}</td>
                      <td className="px-3 py-2 text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(it)}><Pencil size={14}/></Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteId(it.id)}><Trash2 size={14} className="text-rose-500"/></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>

      {/* Upsert dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Editar mapeamento" : "Novo mapeamento"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Fator de Risco</Label>
                <Input placeholder="ex.: Ruído, Benzeno, Psicossocial" value={form.fatorRisco} onChange={e => setF("fatorRisco", e.target.value)}/>
              </div>
              <div>
                <Label className="text-xs">Tipo de Risco</Label>
                <Select value={form.tipoRisco} onValueChange={v => setF("tipoRisco", v)}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>{TIPO_RISCO_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Exame Médico</Label>
              <Input placeholder="ex.: Audiometria tonal, Hemograma completo" value={form.tipoExame} onChange={e => setF("tipoExame", e.target.value)}/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Periodicidade</Label>
                <Select value={form.periodicidade} onValueChange={v => setF("periodicidade", v)}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>{PERIODICIDADE_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => setF("status", v)}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em_dia">Em dia</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs mb-2 block">Momentos de aplicação:</Label>
              <div className="flex flex-wrap gap-4">
                {[
                  ["prazAdmissional","Admissional"],
                  ["prazPeriodico","Periódico"],
                  ["prazDemissional","Demissional"],
                  ["prazMudancaFuncao","Mudança de função"],
                  ["prazRetorno","Retorno ao trabalho"],
                ].map(([k, label]) => (
                  <div key={k} className="flex items-center gap-2">
                    <Checkbox checked={!!(form as any)[k]} onCheckedChange={v => setF(k, !!v)} id={`chk-${k}`}/>
                    <label htmlFor={`chk-${k}`} className="text-sm cursor-pointer">{label}</label>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Responsável pelo exame</Label>
              <Input placeholder="Médico do Trabalho / SESMT" value={form.responsavel ?? ""} onChange={e => setF("responsavel", e.target.value)}/>
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea placeholder="Critérios específicos, referência à NR aplicável..." rows={2} value={form.observacoes ?? ""} onChange={e => setF("observacoes", e.target.value)}/>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button disabled={upsertM.isPending || !form.fatorRisco || !form.tipoExame}
                onClick={() => upsertM.mutate({ ...form, fatorRisco: form.fatorRisco, tipoExame: form.tipoExame })}>
                {upsertM.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir mapeamento?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground"
              onClick={() => deleteId && removeM.mutate({ id: deleteId })}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
