import { useState } from "react";
import { useLocation } from "wouter";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ShieldAlert, Plus, Calendar, Building2, Users, ChevronRight, Loader2, FileSearch, ClipboardCheck,
  Download, Archive, RefreshCcw, Eye, EyeOff,
} from "lucide-react";

// ─── CSV template data ────────────────────────────────────────────────────────
const DRPS_TEMPLATE =
  "e-mail;nome;setor;Q1_prazos_realistas;Q2_autonomia;Q3_apoio_gestor;Q4_apoio_colegas;" +
  "Q5_reconhecimento;Q6_desconexao;Q7_clareza_papeis;Q8_desenvolvimento;Q9_opiniao_ouvida;" +
  "Q10_ambiente_respeitoso;Q11_carga_equilibrada;Q12_seguranca_psicologica\n" +
  "# Escala: 1=Nunca  2=Raramente  3=As vezes  4=Frequentemente  5=Sempre\n" +
  "joao.silva@empresa.com;João Silva;Produção;4;3;5;4;3;2;4;3;3;5;3;4\n" +
  "maria.souza@empresa.com;Maria Souza;RH;5;5;5;5;4;4;5;4;5;5;4;5\n";

const AEP_TEMPLATE =
  "e-mail_lideranca;nome;setor;processo_principal;sistemas_utilizados;" +
  "num_colaboradores;opera_com_metas;pressao_constante;conflitos_frequentes;" +
  "comunicacao_clara;suporte_psicologico_disponivel\n" +
  "# AEP - preenchido pelo lider/gestor do setor\n" +
  "# pressao_constante / conflitos_frequentes: 1=Nunca  2=Raramente  3=As vezes  4=Frequentemente  5=Sempre\n" +
  "joao.gestor@empresa.com;João Gestor;Produção;Montagem de peças;ERP SAP;12;Sim;3;2;4;Sim\n";

function downloadCsv(content: string, filename: string) {
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  planning:   { label: "Planejamento",          cls: "bg-slate-100 text-slate-700" },
  collecting: { label: "Coletando respostas",   cls: "bg-blue-100 text-blue-700" },
  analyzing:  { label: "Em análise",            cls: "bg-amber-100 text-amber-700" },
  completed:  { label: "Concluído",             cls: "bg-emerald-100 text-emerald-700" },
  monitoring: { label: "Em monitoramento",      cls: "bg-purple-100 text-purple-700" },
  archived:   { label: "Arquivado",             cls: "bg-gray-100 text-gray-500" },
};

export default function AdminRiskAssessments() {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState({
    cycleName: "",
    branchId: undefined as number | undefined,
    sectorId: undefined as number | undefined,
    drpsTemplateId: undefined as number | undefined,
    aepTemplateId: undefined as number | undefined,
    responsibleTechnician: "Marise Paiva — CRP 55-33301",
    aepOnly: false,
  });

  const listQ = trpc.riskAssessment.listAssessments.useQuery();
  const branchesQ = trpc.branchesAdmin.list.useQuery();
  const sectorsQ = trpc.departmentsAdmin.list.useQuery(form.branchId ? { branchId: form.branchId } : undefined);
  const libraryQ = trpc.templateLibrary.list.useQuery();

  const updateMut = trpc.riskAssessment.updateAssessment.useMutation({
    onSuccess: () => { listQ.refetch(); toast.success("Ciclo atualizado."); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar"),
  });

  const createMut = trpc.riskAssessment.createAssessment.useMutation({
    onSuccess: (data: any) => {
      toast.success("Avaliação criada com sucesso");
      setOpen(false);
      listQ.refetch();
      if (data?.assessmentId) setLocation(`/admin/analise-risco/${data.assessmentId}`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar avaliação"),
  });

  const surveyTemplates = (libraryQ.data?.surveys ?? []) as any[];
  const drpsTemplates = surveyTemplates.filter((s) => s.category === "psicossocial");
  const aepTemplates = surveyTemplates.filter((s) => s.category === "aep");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cycleName || (!form.aepOnly && !form.drpsTemplateId) || !form.aepTemplateId) {
      toast.error("Preencha nome do ciclo e selecione os templates" + (form.aepOnly ? " AEP." : " DRPS e AEP."));
      return;
    }
    // sectorId = undefined means "all sectors" (valid per NR-01 for company-wide assessments)
    createMut.mutate({
      cycleName: form.cycleName,
      branchId: form.branchId ?? null,
      sectorId: form.sectorId ?? null,
      drpsTemplateId: form.aepOnly ? undefined : form.drpsTemplateId,
      aepTemplateId: form.aepTemplateId,
      responsibleTechnician: form.responsibleTechnician || undefined,
      aepOnly: form.aepOnly,
    });
  }

  const allAssessments = (listQ.data ?? []) as any[];
  const assessments = showArchived
    ? allAssessments.filter((a) => a.status === "archived")
    : allAssessments.filter((a) => a.status !== "archived");

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="relative pl-4">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-rose-500 to-transparent rounded-full" />
            <h1 className="text-3xl font-bold text-primary flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
              <ShieldAlert className="text-rose-500" size={26} /> Análise de Risco Psicossocial NR-01
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
              Conduza avaliações estruturadas por setor: DRPS quantitativo + AEP qualitativo,
              matriz de risco automática, plano de ação preventivo e cronograma 12 meses.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs"
              onClick={() => downloadCsv(DRPS_TEMPLATE, "modelo-drps.csv")}>
              <Download size={13} /> Template DRPS
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs"
              onClick={() => downloadCsv(AEP_TEMPLATE, "modelo-aep.csv")}>
              <Download size={13} /> Template AEP
            </Button>
            <Button variant="outline" size="sm"
              className={`gap-1.5 text-xs ${showArchived ? "bg-gray-100 text-gray-700" : "text-gray-500"}`}
              onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? <Eye size={13} /> : <EyeOff size={13} />}
              {showArchived ? "Ocultar arquivados" : "Ver arquivados"}
            </Button>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus size={16} /> Nova avaliação</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nova avaliação de risco psicossocial</DialogTitle>
                <DialogDescription>
                  Defina o setor, o ciclo e os templates. Os instrumentos serão clonados
                  para sua empresa automaticamente.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <Label>Nome do ciclo</Label>
                  <Input value={form.cycleName}
                    onChange={(e) => setForm((f) => ({ ...f, cycleName: e.target.value }))}
                    placeholder="Ex: Ciclo 1 / 2026 — Setor Administrativo" required />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Filial (opcional)</Label>
                    <Select value={form.branchId?.toString() ?? "none"} onValueChange={(v) => setForm((f) => ({ ...f, branchId: v === "none" ? undefined : Number(v), sectorId: undefined }))}>
                      <SelectTrigger><SelectValue placeholder="Todas as filiais" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Todas as filiais</SelectItem>
                        {(branchesQ.data ?? []).map((b: any) => (
                          <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Setor</Label>
                    <Select value={form.sectorId != null ? form.sectorId.toString() : "__all__"} onValueChange={(v) => setForm((f) => ({ ...f, sectorId: (v && v !== "__all__") ? Number(v) : undefined }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Todos os setores (empresa geral)</SelectItem>
                        {(sectorsQ.data ?? []).map((s: any) => (
                          <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* AEP-only toggle */}
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <input
                    type="checkbox"
                    id="aepOnlyChk"
                    checked={form.aepOnly}
                    onChange={(e) => setForm((f) => ({ ...f, aepOnly: e.target.checked, drpsTemplateId: undefined }))}
                    className="rounded"
                  />
                  <label htmlFor="aepOnlyChk" className="text-sm font-medium text-amber-800 cursor-pointer">
                    Apenas AEP — análise ergonômica sem DRPS quantitativo
                  </label>
                </div>

                <div className={form.aepOnly ? "" : "grid grid-cols-2 gap-3"}>
                  {!form.aepOnly && (
                    <div>
                      <Label>Template DRPS (quantitativo)</Label>
                      <Select value={form.drpsTemplateId?.toString()} onValueChange={(v) => setForm((f) => ({ ...f, drpsTemplateId: Number(v) }))}>
                        <SelectTrigger><SelectValue placeholder="Selecionar DRPS" /></SelectTrigger>
                        <SelectContent>
                          {drpsTemplates.map((t) => (
                            <SelectItem key={t.id} value={String(t.id)}>{t.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className={form.aepOnly ? "w-full" : ""}>
                    <Label>Template AEP (qualitativo)</Label>
                    <Select value={form.aepTemplateId?.toString()} onValueChange={(v) => setForm((f) => ({ ...f, aepTemplateId: Number(v) }))}>
                      <SelectTrigger><SelectValue placeholder="Selecionar AEP" /></SelectTrigger>
                      <SelectContent>
                        {aepTemplates.map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>{t.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Responsável Técnico</Label>
                  <Input value={form.responsibleTechnician}
                    onChange={(e) => setForm((f) => ({ ...f, responsibleTechnician: e.target.value }))} />
                </div>

                <DialogFooter>
                  <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createMut.isPending}>
                    {createMut.isPending && <Loader2 className="animate-spin" size={14} />}
                    Criar avaliação
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </div>{/* flex gap-2 */}
        </div>

        {listQ.isLoading && (
          <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin" /></div>
        )}

        {!listQ.isLoading && assessments.length === 0 && (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center">
            <ShieldAlert className="mx-auto text-slate-400 mb-3" size={48} />
            <h3 className="text-lg font-semibold text-slate-700">Nenhuma avaliação cadastrada ainda</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Clique em "Nova avaliação" acima para abrir o primeiro ciclo. Você poderá rodá-lo
              em um setor específico ou empresa toda.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assessments.map((a: any) => {
            const badge = STATUS_BADGE[a.status] ?? STATUS_BADGE.planning;
            const rate = a.drpsResponses > 0
              ? `${a.drpsResponses} pessoa(s) responderam DRPS`
              : "Aguardando respostas DRPS";
            return (
              <div key={a.id}
                onClick={() => setLocation(`/admin/analise-risco/${a.id}`)}
                className="cursor-pointer group bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-rose-300 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-slate-900 group-hover:text-rose-700 transition-colors line-clamp-1">{a.cycleName}</h3>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                      {a.branchName && <span className="inline-flex items-center gap-1"><Building2 size={12} /> {a.branchName}</span>}
                      {a.sectorName && <span className="inline-flex items-center gap-1"><Users size={12} /> {a.sectorName}</span>}
                      {!a.sectorName && !a.branchName && <span className="italic">Empresa toda</span>}
                    </p>
                  </div>
                  <ChevronRight className="text-slate-400 group-hover:text-rose-600 group-hover:translate-x-1 transition-all" size={18} />
                </div>

                <div className="flex items-center gap-2 mt-3 flex-wrap justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                    {a.responsibleTechnician && (
                      <span className="text-xs text-slate-500">{a.responsibleTechnician}</span>
                    )}
                  </div>
                  {a.status === "archived" ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); updateMut.mutate({ id: a.id, status: "completed" }); }}
                      className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 px-2 py-1 rounded hover:bg-emerald-50 transition-colors"
                    >
                      <RefreshCcw size={12} /> Reabrir
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); updateMut.mutate({ id: a.id, status: "archived" }); }}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                    >
                      <Archive size={12} /> Arquivar
                    </button>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-blue-50 px-2 py-1.5 rounded">
                    <div className="text-blue-600 font-medium flex items-center gap-1"><FileSearch size={12} /> DRPS</div>
                    <div className="text-slate-700 mt-0.5">{rate}</div>
                  </div>
                  <div className="bg-purple-50 px-2 py-1.5 rounded">
                    <div className="text-purple-600 font-medium flex items-center gap-1"><ClipboardCheck size={12} /> AEP</div>
                    <div className="text-slate-700 mt-0.5">{a.aepResponses} liderança(s)</div>
                  </div>
                </div>

                {a.startDate && (
                  <div className="mt-3 text-xs text-slate-500 flex items-center gap-1">
                    <Calendar size={12} /> Iniciado em {new Date(a.startDate).toLocaleDateString("pt-BR")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}


