import { useState } from "react";
import { useLocation } from "wouter";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ShieldAlert, ArrowLeft, Loader2, ChevronRight, Calculator, FileText, FileBarChart,
  CalendarRange, Trash2, Pencil, BarChart3, ListChecks, ClipboardCheck, Download, Wand2,
  Upload, CheckCircle2, AlertTriangle, BookOpen, AlertCircle, Clock,
} from "lucide-react";

type TabId = "overview" | "matrix" | "plan" | "schedule" | "reports" | "cursos";

const RISK_COLORS: Record<string, string> = {
  baixo:   "bg-emerald-100 text-emerald-700 border-emerald-400",
  medio:   "bg-amber-100 text-amber-800 border-amber-500",
  alto:    "bg-orange-200 text-orange-900 border-orange-500",
  critico: "bg-rose-200 text-rose-900 border-rose-600 font-bold",
};
const RISK_LABEL: Record<string, string> = {
  baixo: "Baixo", medio: "Médio", alto: "Alto", critico: "Crítico",
};
const PRIORITY_RANK: Record<string, number> = { critico: 4, alto: 3, medio: 2, baixo: 1 };
const GRAVITY_OPTIONS = [
  { v: "baixa",   label: "Baixa (escore 0-1)" },
  { v: "media",   label: "Média (escore 1-2)" },
  { v: "alta",    label: "Alta (escore 2-3)" },
  { v: "critica", label: "Crítica (escore 3-4)" },
];
const PROB_OPTIONS = [
  { v: "baixa",   label: "Baixa" },
  { v: "media",   label: "Média" },
  { v: "alta",    label: "Alta" },
  { v: "critica", label: "Crítica" },
];

function monthsBetween(start: Date, count: number): string[] {
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return result;
}
function monthLabel(iso: string): string {
  const [y, m] = iso.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString("pt-BR", { month: "short", year: "2-digit" });
}

export default function AdminRiskAssessmentDetail({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<TabId>("overview");
  const [editing, setEditing] = useState<any | null>(null);
  const [editPlan, setEditPlan] = useState<any | null>(null);
  const [deletePlan, setDeletePlan] = useState<any | null>(null);
  const [pdfLink, setPdfLink] = useState<{ label: string; url: string } | null>(null);
  const [showImport, setShowImport] = useState(false);

  const detailQ = trpc.riskAssessment.getAssessment.useQuery({ id });
  const [coursesEnabled, setCoursesEnabled] = useState(false);
  const coursesQ = trpc.riskCorrelation.getRecommendedCourses.useQuery(
    { assessmentId: id },
    { enabled: coursesEnabled }
  );
  const calcMut = trpc.riskAssessment.calculateMatrix.useMutation({
    onSuccess: (d: any) => { toast.success(`Matriz recalculada — ${d.updated} fatores`); detailQ.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro no cálculo"),
  });
  const upInv = trpc.riskAssessment.updateInventoryItem.useMutation({
    onSuccess: () => { toast.success("Salvo"); detailQ.refetch(); setEditing(null); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });
  const genPlanMut = trpc.riskAssessment.generateActionPlan.useMutation({
    onSuccess: (d: any) => { toast.success(`Plano de ação gerado — ${d.created} ações`); detailQ.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao gerar plano"),
  });
  const upPlan = trpc.riskAssessment.updateActionPlanItem.useMutation({
    onSuccess: () => { toast.success("Ação atualizada"); detailQ.refetch(); setEditPlan(null); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const delPlan = trpc.riskAssessment.deleteActionPlanItem.useMutation({
    onSuccess: () => { toast.success("Ação removida"); detailQ.refetch(); setDeletePlan(null); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const genLaudo = trpc.riskAssessment.generateLaudoPDF.useMutation({
    onSuccess: (d: any) => { setPdfLink({ label: "Laudo Técnico", url: d.url }); toast.success("Laudo gerado!"); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao gerar PDF"),
  });
  const genInv = trpc.riskAssessment.generateInventoryPDF.useMutation({
    onSuccess: (d: any) => { setPdfLink({ label: "Inventário + Matriz", url: d.url }); toast.success("Inventário gerado!"); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao gerar PDF"),
  });
  const genCron = trpc.riskAssessment.generateCronogramaPDF.useMutation({
    onSuccess: (d: any) => { setPdfLink({ label: "Cronograma 12 meses", url: d.url }); toast.success("Cronograma gerado!"); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao gerar PDF"),
  });
  const genAEP = trpc.riskAssessment.generateAEPPDF.useMutation({
    onSuccess: (d: any) => { setPdfLink({ label: "Laudo AEP", url: d.url }); toast.success("Laudo AEP gerado!"); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao gerar PDF"),
  });

  if (detailQ.isLoading) {
    return <AppLayout><div className="p-6 flex items-center justify-center min-h-[60vh]"><Loader2 className="animate-spin" /></div></AppLayout>;
  }
  if (!detailQ.data) {
    return <AppLayout><div className="p-6">Avaliação não encontrada.</div></AppLayout>;
  }

  const { assessment, inventory, actionPlan, stats } = detailQ.data as any;
  const a = assessment;
  const inv = inventory as any[];
  const plan = (actionPlan as any[]).slice().sort((x, y) => (PRIORITY_RANK[y.priority] ?? 0) - (PRIORITY_RANK[x.priority] ?? 0));
  const startDate = a.start_date ? new Date(a.start_date) : new Date();
  const monthCols = monthsBetween(startDate, 12);

  const TABS: { id: TabId; label: string; Icon: any }[] = [
    { id: "overview", label: "Visão geral", Icon: BarChart3 },
    { id: "matrix",   label: "Inventário + Matriz", Icon: ShieldAlert },
    { id: "plan",     label: "Plano de Ação", Icon: ListChecks },
    { id: "schedule", label: "Cronograma 12 meses", Icon: CalendarRange },
    { id: "reports",  label: "Relatórios PDF", Icon: FileText },
    { id: "cursos",   label: "Cursos Vinculados", Icon: BookOpen },
  ];

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        <button onClick={() => setLocation("/admin/analise-risco")} className="text-sm text-slate-500 hover:text-slate-800 inline-flex items-center gap-1">
          <ArrowLeft size={14} /> Voltar à lista
        </button>

        <div className="relative pl-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-rose-500 to-transparent rounded-full" />
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            <ShieldAlert className="text-rose-500" /> {a.cycle_name}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {a.company_name}
            {a.sector_name ? ` · ${a.sector_name}` : a.branch_name ? ` · ${a.branch_name}` : " · empresa toda"}
            {a.responsible_technician ? ` · Resp. Téc. ${a.responsible_technician}` : ""}
          </p>
        </div>

        <div className="bg-white rounded-xl border p-1 inline-flex flex-wrap gap-1">
          {TABS.map((t) => {
            const I = t.Icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-3 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2 transition-colors ${tab === t.id ? "bg-rose-50 text-rose-700" : "text-slate-600 hover:bg-slate-100"}`}>
                <I size={15} /> {t.label}
              </button>
            );
          })}
        </div>

        {tab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border rounded-xl p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wide">DRPS - Respostas</div>
              <div className="text-3xl font-bold text-blue-700 mt-1">{stats.drpsResponses}</div>
              <div className="text-xs text-slate-600 mt-1">Pessoas que responderam o diagnóstico quantitativo.</div>
            </div>
            <div className="bg-white border rounded-xl p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wide">AEP - Respostas</div>
              <div className="text-3xl font-bold text-purple-700 mt-1">{stats.aepResponses}</div>
              <div className="text-xs text-slate-600 mt-1">Lideranças que responderam a análise qualitativa.</div>
            </div>
            <div className="bg-white border rounded-xl p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wide">Inventário</div>
              <div className="text-3xl font-bold text-rose-700 mt-1">{inv.filter((i: any) => i.risco_final !== "baixo").length} / {inv.length}</div>
              <div className="text-xs text-slate-600 mt-1">Fatores com risco médio ou superior.</div>
            </div>
            <div className="bg-white border rounded-xl p-4 md:col-span-3">
              <div className="text-sm font-semibold text-slate-800 mb-2">Resumo do ciclo</div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <div><dt className="inline text-slate-500">Status: </dt><dd className="inline text-slate-800">{a.status}</dd></div>
                <div><dt className="inline text-slate-500">Início: </dt><dd className="inline text-slate-800">{a.start_date ? new Date(a.start_date).toLocaleDateString("pt-BR") : "-"}</dd></div>
                <div><dt className="inline text-slate-500">Fim previsto: </dt><dd className="inline text-slate-800">{a.end_date ? new Date(a.end_date).toLocaleDateString("pt-BR") : "-"}</dd></div>
                <div><dt className="inline text-slate-500">Resp. técnico: </dt><dd className="inline text-slate-800">{a.responsible_technician ?? "-"}</dd></div>
                <div><dt className="inline text-slate-500">DRPS survey id: </dt><dd className="inline text-slate-800">#{a.drps_survey_id}</dd></div>
                <div><dt className="inline text-slate-500">AEP survey id: </dt><dd className="inline text-slate-800">#{a.aep_survey_id}</dd></div>
              </dl>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setLocation(`/admin/pesquisas/${a.drps_survey_id}/editar`)}>Abrir DRPS</Button>
                <Button size="sm" variant="outline" onClick={() => setLocation(`/admin/pesquisas/${a.aep_survey_id}/editar`)}>Abrir AEP</Button>
                <Button size="sm" variant="outline" onClick={() => setLocation(`/admin/campanhas`)}>Enviar por campanha</Button>
                <Button size="sm" className="gap-2" onClick={() => setShowImport(true)}><Upload size={14} /> Importar respostas (planilha)</Button>
              </div>
            </div>
          </div>
        )}

        {tab === "matrix" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-slate-600 max-w-2xl">
                Ajuste manualmente <strong>gravidade</strong> (calculado pelo DRPS) e <strong>probabilidade</strong>
                (deve ser ajustada após analisar as respostas qualitativas do AEP). O risco final é recomputado automaticamente.
              </p>
              <Button onClick={() => calcMut.mutate({ assessmentId: a.id })} disabled={calcMut.isPending} className="gap-2">
                {calcMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Calculator size={14} />}
                Calcular automaticamente do DRPS
              </Button>
            </div>

            <div className="bg-white border rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-2">#</th>
                    <th className="text-left px-3 py-2">Fator de Risco</th>
                    <th className="text-left px-3 py-2">Gravidade</th>
                    <th className="text-left px-3 py-2">Probabilidade</th>
                    <th className="text-left px-3 py-2">Risco Final</th>
                    <th className="text-left px-3 py-2">DRPS</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {[...inv].sort((a: any, b: any) => (PRIORITY_RANK[b.risco_final] ?? 0) - (PRIORITY_RANK[a.risco_final] ?? 0)).map((it: any) => {
                    const cls = RISK_COLORS[it.risco_final] ?? RISK_COLORS.baixo;
                    return (
                      <tr key={it.id} className="border-t hover:bg-slate-50/60">
                        <td className="px-3 py-2 text-slate-500">{it.axis_order}</td>
                        <td className="px-3 py-2 font-medium text-slate-900">{it.factor_name}</td>
                        <td className="px-3 py-2 capitalize">{it.gravidade}</td>
                        <td className="px-3 py-2 capitalize">{it.probabilidade}</td>
                        <td className="px-3 py-2">
                          <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded border ${cls}`}>{RISK_LABEL[it.risco_final] ?? it.risco_final}</span>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500">
                          {it.drps_responses_count > 0 ? `${it.drps_responses_count} resp · média ${Number(it.drps_score_avg ?? 0).toFixed(2)}` : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button variant="ghost" size="sm" onClick={() => setEditing(it)}><Pencil size={14} /></Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>{editing?.factor_name}</DialogTitle>
                  <DialogDescription>Ajuste gravidade, probabilidade e observações.</DialogDescription>
                </DialogHeader>
                {editing && (
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    upInv.mutate({
                      itemId: editing.id,
                      gravidade: editing.gravidade,
                      probabilidade: editing.probabilidade,
                      fontesGeradoras: editing.fontes_geradoras ?? undefined,
                      medidasExistentes: editing.medidas_existentes ?? undefined,
                      notes: editing.notes ?? undefined,
                    });
                  }} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Gravidade</Label>
                        <Select value={editing.gravidade} onValueChange={(v) => setEditing({ ...editing, gravidade: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {GRAVITY_OPTIONS.map((o) => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Probabilidade</Label>
                        <Select value={editing.probabilidade} onValueChange={(v) => setEditing({ ...editing, probabilidade: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PROB_OPTIONS.map((o) => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Fontes geradoras</Label>
                      <Textarea value={editing.fontes_geradoras ?? ""} onChange={(e) => setEditing({ ...editing, fontes_geradoras: e.target.value })} rows={3} />
                    </div>
                    <div>
                      <Label>Medidas existentes</Label>
                      <Textarea value={editing.medidas_existentes ?? ""} onChange={(e) => setEditing({ ...editing, medidas_existentes: e.target.value })} rows={2} />
                    </div>
                    <div>
                      <Label>Notas internas</Label>
                      <Textarea value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={2} />
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                      <Button type="submit" disabled={upInv.isPending}>
                        {upInv.isPending && <Loader2 size={14} className="animate-spin" />}
                        Salvar
                      </Button>
                    </DialogFooter>
                  </form>
                )}
              </DialogContent>
            </Dialog>
          </div>
        )}

        {tab === "plan" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-slate-600">Ações preventivas vinculadas aos fatores de risco. Cada ação aponta para um programa preventivo da biblioteca.</p>
              <Button onClick={() => genPlanMut.mutate({ assessmentId: a.id })} disabled={genPlanMut.isPending} className="gap-2">
                {genPlanMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                Gerar automaticamente
              </Button>
            </div>

            {plan.length === 0 ? (
              <div className="bg-white border rounded-xl p-8 text-center text-slate-500 text-sm">
                Nenhuma ação ainda. Recalcule a matriz e clique em "Gerar automaticamente" para popular o plano com base nos riscos identificados.
              </div>
            ) : (
              <div className="space-y-2">
                {plan.map((p: any) => (
                  <div key={p.id} className={`border rounded-xl p-4 flex gap-3 items-start ${p.end_date && new Date(p.end_date) < new Date() && !["concluido","cancelado"].includes(p.status) ? "bg-rose-50 border-rose-300" : "bg-white"}`}>
                    <div className={`w-1.5 self-stretch rounded ${
                      p.priority === "critico" ? "bg-rose-500" :
                      p.priority === "alto" ? "bg-orange-500" :
                      p.priority === "medio" ? "bg-amber-500" : "bg-emerald-500"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-500 uppercase">{p.factor_name}</div>
                      <div className="text-sm font-semibold text-slate-900 mt-0.5">{p.action_description}</div>
                      <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span>Responsável: {p.responsible_party ?? "—"}</span>
                        <span>Prioridade: <span className="font-semibold capitalize">{p.priority}</span></span>
                        <span>Status: {p.status}</span>
                        {p.end_date && (
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            Prazo: {new Date(p.end_date).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                        {p.program_title && <span>Programa: {p.program_title}</span>}
                      </div>
                      {(() => {
                        const isOverdue = p.end_date && new Date(p.end_date) < new Date() && !["concluido","cancelado"].includes(p.status);
                        return isOverdue ? (
                          <div className="mt-1.5 flex items-center gap-1 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded px-2 py-0.5 w-fit">
                            <AlertCircle size={11} />
                            Prazo vencido — ação requer atenção imediata
                          </div>
                        ) : null;
                      })()}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditPlan(p)}><Pencil size={14} /></Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeletePlan(p)}><Trash2 size={14} className="text-rose-600" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Dialog open={!!editPlan} onOpenChange={(o) => !o && setEditPlan(null)}>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>Editar ação preventiva</DialogTitle>
                </DialogHeader>
                {editPlan && (
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    upPlan.mutate({
                      itemId: editPlan.id,
                      actionDescription: editPlan.action_description,
                      responsibleParty: editPlan.responsible_party ?? undefined,
                      priority: editPlan.priority,
                      status: editPlan.status,
                      notes: editPlan.notes ?? undefined,
                      fiveW2hWhy: editPlan.five_w2h_why ?? undefined,
                      fiveW2hWhere: editPlan.five_w2h_where ?? undefined,
                      fiveW2hHow: editPlan.five_w2h_how ?? undefined,
                      fiveW2hCost: editPlan.five_w2h_cost ?? undefined,
                    });
                  }} className="space-y-3">
                    <div>
                      <Label>Descrição da ação</Label>
                      <Textarea value={editPlan.action_description}
                        onChange={(e) => setEditPlan({ ...editPlan, action_description: e.target.value })} rows={3} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Responsável</Label>
                        <Input value={editPlan.responsible_party ?? ""}
                          onChange={(e) => setEditPlan({ ...editPlan, responsible_party: e.target.value })} />
                      </div>
                      <div>
                        <Label>Prioridade</Label>
                        <Select value={editPlan.priority} onValueChange={(v) => setEditPlan({ ...editPlan, priority: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="baixo">Baixo</SelectItem>
                            <SelectItem value="medio">Médio</SelectItem>
                            <SelectItem value="alto">Alto</SelectItem>
                            <SelectItem value="critico">Crítico</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select value={editPlan.status} onValueChange={(v) => setEditPlan({ ...editPlan, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="programado">Programado</SelectItem>
                          <SelectItem value="em_andamento">Em andamento</SelectItem>
                          <SelectItem value="concluido">Concluído</SelectItem>
                          <SelectItem value="cancelado">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Notas</Label>
                      <Textarea value={editPlan.notes ?? ""} onChange={(e) => setEditPlan({ ...editPlan, notes: e.target.value })} rows={2} />
                    </div>
                    <div className="border-t pt-3">
                      <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">5W2H — Detalhamento da Ação</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                          <Label className="text-xs">Por quê? (Why)</Label>
                          <Textarea value={editPlan.five_w2h_why ?? ""} onChange={(e) => setEditPlan({ ...editPlan, five_w2h_why: e.target.value })} rows={2} placeholder="Justificativa / causa raiz" />
                        </div>
                        <div>
                          <Label className="text-xs">Onde? (Where)</Label>
                          <Input value={editPlan.five_w2h_where ?? ""} onChange={(e) => setEditPlan({ ...editPlan, five_w2h_where: e.target.value })} placeholder="Local / setor" />
                        </div>
                        <div>
                          <Label className="text-xs">Custo (How Much)</Label>
                          <Input value={editPlan.five_w2h_cost ?? ""} onChange={(e) => setEditPlan({ ...editPlan, five_w2h_cost: e.target.value })} placeholder="R$ ou 'sem custo'" />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Como? (How)</Label>
                          <Textarea value={editPlan.five_w2h_how ?? ""} onChange={(e) => setEditPlan({ ...editPlan, five_w2h_how: e.target.value })} rows={2} placeholder="Método / procedimento de implementação" />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setEditPlan(null)}>Cancelar</Button>
                      <Button type="submit" disabled={upPlan.isPending}>Salvar</Button>
                    </DialogFooter>
                  </form>
                )}
              </DialogContent>
            </Dialog>

            <AlertDialog open={!!deletePlan} onOpenChange={(o) => !o && setDeletePlan(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover ação?</AlertDialogTitle>
                  <AlertDialogDescription>Esta ação será apagada permanentemente.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deletePlan && delPlan.mutate({ itemId: deletePlan.id })}>Remover</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {tab === "schedule" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Cronograma 12 meses a partir da data de início da avaliação ({startDate.toLocaleDateString("pt-BR")}). Clique nas células para marcar/desmarcar.</p>
            {plan.length === 0 ? (
              <div className="bg-white border rounded-xl p-8 text-center text-slate-500 text-sm">
                Gere o plano de ação primeiro para visualizar o cronograma.
              </div>
            ) : (
              <div className="bg-white border rounded-xl overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="text-left px-3 py-2 sticky left-0 bg-slate-50 z-10 min-w-[260px]">Programa / Ação</th>
                      {monthCols.map((m) => (
                        <th key={m} className="px-2 py-2 text-center whitespace-nowrap">{monthLabel(m)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {plan.map((p: any) => {
                      const progress = (p.monthly_progress ?? {}) as Record<string, boolean>;
                      return (
                        <tr key={p.id} className="border-t hover:bg-slate-50/60">
                          <td className="px-3 py-2 sticky left-0 bg-white z-10">
                            <div className="font-medium text-slate-900">{p.program_title ?? p.action_description}</div>
                            <div className="text-[10px] text-slate-500">{p.factor_name}</div>
                          </td>
                          {monthCols.map((m) => {
                            const active = !!progress[m];
                            return (
                              <td key={m} className="text-center px-1 py-1">
                                <button
                                  onClick={() => {
                                    const next = { ...progress, [m]: !active };
                                    upPlan.mutate({ itemId: p.id, monthlyProgress: next });
                                  }}
                                  className={`w-4 h-4 rounded-full mx-auto block border ${active ? "bg-rose-500 border-rose-600" : "bg-white border-slate-300 hover:border-rose-400"}`}
                                  title={monthLabel(m)}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "reports" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Gere os relatórios oficiais em PDF. Cada relatório leva alguns segundos para ser produzido.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white border rounded-xl p-5">
                <FileText className="text-rose-500 mb-2" />
                <div className="font-semibold text-slate-900">Laudo Técnico NR-01</div>
                <p className="text-xs text-slate-500 mt-1">Documento completo (~14 seções) com fundamentação, metodologia, matriz, plano e responsabilidade técnica.</p>
                <Button className="mt-3 w-full gap-2" onClick={() => genLaudo.mutate({ assessmentId: a.id })} disabled={genLaudo.isPending}>
                  {genLaudo.isPending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Gerar Laudo
                </Button>
              </div>
              <div className="bg-white border rounded-xl p-5">
                <FileBarChart className="text-rose-500 mb-2" />
                <div className="font-semibold text-slate-900">Inventário + Matriz de Risco</div>
                <p className="text-xs text-slate-500 mt-1">Tabela única com os 13 fatores, gravidade, probabilidade e cor da matriz.</p>
                <Button className="mt-3 w-full gap-2" onClick={() => genInv.mutate({ assessmentId: a.id })} disabled={genInv.isPending}>
                  {genInv.isPending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Gerar Inventário
                </Button>
              </div>
              <div className="bg-white border rounded-xl p-5">
                <CalendarRange className="text-rose-500 mb-2" />
                <div className="font-semibold text-slate-900">Cronograma 12 meses</div>
                <p className="text-xs text-slate-500 mt-1">Visual com pontos por mês para cada programa preventivo do plano de ação.</p>
                <Button className="mt-3 w-full gap-2" onClick={() => genCron.mutate({ assessmentId: a.id })} disabled={genCron.isPending}>
                  {genCron.isPending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Gerar Cronograma
                </Button>
              </div>
              <div className="bg-white border rounded-xl p-5">
                <ClipboardCheck className="text-rose-500 mb-2" />
                <div className="font-semibold text-slate-900">Laudo AEP (Ergonômica Preliminar)</div>
                <p className="text-xs text-slate-500 mt-1">Laudo qualitativo da Análise Ergonômica Preliminar do setor: achados abertos + indicadores Likert, conforme NR-17 e NR-01.</p>
                <Button className="mt-3 w-full gap-2" onClick={() => genAEP.mutate({ assessmentId: a.id })} disabled={genAEP.isPending}>
                  {genAEP.isPending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Gerar Laudo AEP
                </Button>
              </div>
            </div>

            {pdfLink && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-emerald-900">PDF pronto: {pdfLink.label}</div>
                  <div className="text-xs text-emerald-700 truncate">{pdfLink.url}</div>
                </div>
                <a href={pdfLink.url} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="gap-2"><Download size={14} /> Abrir PDF</Button>
                </a>
              </div>
            )}
          </div>
        )}

        {tab === "cursos" && (() => {
          if (!coursesEnabled) setCoursesEnabled(true);
          return (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Cursos preventivos recomendados com base nos fatores de risco avaliados como alto ou crítico.
              </p>
              {coursesQ.isLoading && (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin text-rose-500" />
                </div>
              )}
              {!coursesQ.isLoading && coursesQ.data && coursesQ.data.length === 0 && (
                <div className="bg-white rounded-xl border p-8 text-center">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                  <p className="font-medium text-slate-600">Nenhum curso vinculado a fatores de risco críticos ou altos.</p>
                  <p className="text-xs mt-2 text-slate-400">
                    Configure vínculos em <strong>Análise de Risco → Correlação Risco-Ação</strong>.
                  </p>
                </div>
              )}
              {coursesQ.data && coursesQ.data.length > 0 && (
                <div className="bg-white rounded-xl border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Fator de Risco</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Nível</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Curso Recomendado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(coursesQ.data as any[]).map((row: any, i: number) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                          <td className="px-4 py-3 font-medium text-slate-700">{row.factorName}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${RISK_COLORS[row.riskLevel] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                              {RISK_LABEL[row.riskLevel] ?? row.riskLevel}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <a href={`/plataforma/cursos/${row.moduleId}`} target="_blank" rel="noopener noreferrer"
                              className="text-rose-600 hover:underline font-medium flex items-center gap-1.5">
                              <BookOpen size={13} />
                              {row.moduleTitle}
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}

        <ImportResponsesDialog
          open={showImport}
          onOpenChange={setShowImport}
          assessment={a}
          onDone={() => detailQ.refetch()}
        />
      </div>
    </AppLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Importador de respostas de planilha (Google Forms / Excel exportado em CSV)
// ─────────────────────────────────────────────────────────────────────────────
function stripAccentsLower(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === "," || ch === ";" || ch === "\t") { out.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}
function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map((l) => splitCsvLine(l));
  return { headers, rows };
}

const IGNORE = "__ignore__";

function ImportResponsesDialog({
  open, onOpenChange, assessment, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  assessment: any;
  onDone: () => void;
}) {
  const [target, setTarget] = useState<"drps" | "aep">("drps");
  const [likertScale, setLikertScale] = useState<"0-4" | "1-5">("0-4");
  const [raw, setRaw] = useState("");
  const [mapping, setMapping] = useState<Record<number, string>>({}); // questionId → header (or IGNORE)
  const [result, setResult] = useState<any | null>(null);

  const surveyId = target === "drps" ? assessment.drps_survey_id : assessment.aep_survey_id;
  const surveyQ = trpc.surveys.get.useQuery({ id: surveyId }, { enabled: open && !!surveyId });
  const questions: any[] = (surveyQ.data?.questions ?? []) as any[];

  const parsed = raw.trim() ? parseCSV(raw) : { headers: [], rows: [] };
  const headers = parsed.headers;

  // Auto-mapeamento: por similaridade de texto, com fallback posicional (pula 1ª coluna = carimbo de data/hora)
  function autoMap() {
    const used = new Set<string>();
    const next: Record<number, string> = {};
    const normHeaders = headers.map((h) => ({ raw: h, norm: stripAccentsLower(h) }));
    // detecta colunas de metadados comuns do Forms para não mapear
    const metaIdx = new Set<number>();
    normHeaders.forEach((h, i) => {
      if (/(carimbo de data|timestamp|hora|endereco de e|email|nome|pontuacao|score)/.test(h.norm)) metaIdx.add(i);
    });
    questions.forEach((q, qi) => {
      const qn = stripAccentsLower(String(q.questionText || ""));
      let best = "";
      // match por conteúdo
      for (const h of normHeaders) {
        if (used.has(h.raw)) continue;
        if (h.norm && (h.norm === qn || h.norm.includes(qn.slice(0, 24)) || qn.includes(h.norm.slice(0, 24)))) { best = h.raw; break; }
      }
      // fallback posicional: questão i → coluna não-meta de índice equivalente
      if (!best) {
        const dataCols = headers.map((h, i) => ({ h, i })).filter((c) => !metaIdx.has(c.i));
        const cand = dataCols[qi];
        if (cand && !used.has(cand.h)) best = cand.h;
      }
      if (best) { used.add(best); next[q.id] = best; }
      else next[q.id] = IGNORE;
    });
    setMapping(next);
  }

  // auto-mapeia quando perguntas/planilha mudam
  const sig = `${surveyId}|${headers.join("|")}|${questions.map((q) => q.id).join(",")}`;
  const [lastSig, setLastSig] = useState("");
  if (open && questions.length > 0 && headers.length > 0 && sig !== lastSig) {
    setLastSig(sig);
    autoMap();
  }

  const importMut = trpc.riskAssessment.importResponses.useMutation({
    onSuccess: (d: any) => {
      setResult(d);
      if (!d.dryRun) {
        toast.success(`Importadas ${d.summary.responses} respostas (${d.summary.answersInserted} itens).`);
        onDone();
      } else {
        toast.info(`Pré-visualização: ${d.summary.responses} respostas válidas, ${d.summary.skipped} ignoradas.`);
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao importar"),
  });

  function buildResponses() {
    const headerIdx: Record<string, number> = {};
    headers.forEach((h, i) => { headerIdx[h] = i; });
    const responses: { answers: { questionId: number; value: string }[] }[] = [];
    for (const row of parsed.rows) {
      const answers: { questionId: number; value: string }[] = [];
      for (const q of questions) {
        const col = mapping[q.id];
        if (!col || col === IGNORE) continue;
        const idx = headerIdx[col];
        if (idx == null) continue;
        const val = (row[idx] ?? "").trim();
        if (val !== "") answers.push({ questionId: q.id, value: val });
      }
      if (answers.length > 0) responses.push({ answers });
    }
    return responses;
  }

  function submit(dryRun: boolean) {
    const responses = buildResponses();
    if (responses.length === 0) { toast.error("Nenhuma resposta detectada. Verifique o mapeamento e os dados."); return; }
    importMut.mutate({ assessmentId: assessment.id, target, likertScale, dryRun, responses });
  }

  const mappedCount = questions.filter((q) => mapping[q.id] && mapping[q.id] !== IGNORE).length;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setRaw(""); setResult(null); setLastSig(""); } }}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Upload size={18} /> Importar respostas de planilha</DialogTitle>
          <DialogDescription>
            Cole o conteúdo CSV exportado do Google Forms / Excel. Cada linha é um respondente; a primeira linha são os cabeçalhos.
            Respostas Likert são convertidas automaticamente para a escala 0–4 da matriz.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Destino</Label>
              <Select value={target} onValueChange={(v) => { setTarget(v as any); setLastSig(""); setResult(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="drps">DRPS — Diagnóstico (quantitativo)</SelectItem>
                  <SelectItem value="aep">AEP — Análise Ergonômica (qualitativo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Escala Likert da planilha</Label>
              <Select value={likertScale} onValueChange={(v) => setLikertScale(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0-4">0 a 4 (ou rótulos de texto)</SelectItem>
                  <SelectItem value="1-5">1 a 5 (converte para 0–4)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Conteúdo CSV</Label>
            <Textarea
              value={raw}
              onChange={(e) => { setRaw(e.target.value); setLastSig(""); setResult(null); }}
              rows={6}
              placeholder={"Carimbo de data/hora,Pergunta 1,Pergunta 2,...\n01/01/2026 10:00,Concordo,4,..."}
              className="font-mono text-xs"
            />
            <div className="mt-2">
              <input
                type="file"
                accept=".csv,.tsv,text/csv,text/plain"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) { const txt = await f.text(); setRaw(txt); setLastSig(""); setResult(null); }
                }}
                className="text-xs"
              />
            </div>
          </div>

          {surveyQ.isLoading && <div className="text-sm text-slate-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando perguntas…</div>}

          {headers.length > 0 && questions.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 flex items-center justify-between">
                <span>Mapeamento pergunta → coluna ({mappedCount}/{questions.length} mapeadas · {parsed.rows.length} linhas)</span>
                <Button size="sm" variant="ghost" onClick={autoMap}>Auto-mapear</Button>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y">
                {questions.map((q) => (
                  <div key={q.id} className="px-3 py-2 grid grid-cols-2 gap-2 items-center text-sm">
                    <div className="text-slate-700 truncate" title={q.questionText}>
                      <span className="text-[10px] uppercase text-slate-400 mr-1">{q.questionType}</span>{q.questionText}
                    </div>
                    <Select value={mapping[q.id] ?? IGNORE} onValueChange={(v) => setMapping((m) => ({ ...m, [q.id]: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={IGNORE}>(ignorar)</SelectItem>
                        {headers.map((h, i) => <SelectItem key={i} value={h}>{h || `Coluna ${i + 1}`}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result && (
            <div className={`rounded-lg p-3 text-sm flex items-start gap-2 ${result.dryRun ? "bg-blue-50 text-blue-900" : "bg-emerald-50 text-emerald-900"}`}>
              {result.dryRun ? <AlertTriangle size={16} className="mt-0.5" /> : <CheckCircle2 size={16} className="mt-0.5" />}
              <div>
                <div className="font-semibold">{result.dryRun ? "Pré-visualização" : "Importação concluída"}</div>
                <div className="text-xs mt-1">
                  {result.summary.responses} respostas · {result.summary.answersInserted} itens · {result.summary.likertNormalized} Likert normalizados
                  {result.summary.skipped > 0 ? ` · ${result.summary.skipped} linhas vazias ignoradas` : ""}
                </div>
                {!result.dryRun && target === "drps" && (
                  <div className="text-xs mt-1">Agora abra a aba <strong>Inventário + Matriz</strong> e clique em “Calcular automaticamente do DRPS”.</div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => submit(true)} disabled={importMut.isPending || mappedCount === 0}>
            {importMut.isPending ? <Loader2 size={14} className="animate-spin" /> : null} Pré-visualizar
          </Button>
          <Button onClick={() => submit(false)} disabled={importMut.isPending || mappedCount === 0} className="gap-2">
            {importMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

