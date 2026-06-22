import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  FileText, Image as ImageIcon, Video, Megaphone, BookOpen, BarChart3, FileQuestion,
  Trash2, Upload, CalendarDays, Plus, ChevronDown, ChevronRight, Pencil, Sparkles, ClipboardList, Brain,
  Globe, Lock,
} from "lucide-react";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const TYPES = [
  { value: "cartaz", label: "Cartaz", Icon: ImageIcon },
  { value: "banner", label: "Banner", Icon: ImageIcon },
  { value: "ebook", label: "E-book", Icon: BookOpen },
  { value: "apresentacao", label: "Apresentação", Icon: BarChart3 },
  { value: "pesquisa_rapida", label: "Pesquisa rápida", Icon: FileQuestion },
  { value: "dds", label: "DDS", Icon: Megaphone },
  { value: "material_lider", label: "Material líderes", Icon: FileText },
  { value: "material_rh", label: "Material RH", Icon: FileText },
  { value: "video", label: "Vídeo", Icon: Video },
  { value: "template_comunicacao", label: "Template comunicação", Icon: Megaphone },
  { value: "infografico", label: "Infográfico", Icon: BarChart3 },
  { value: "outro", label: "Outro", Icon: FileText },
];

const LINK_TYPES = [
  { value: "course", label: "Curso", Icon: BookOpen, cls: "bg-blue-100 text-blue-700" },
  { value: "module", label: "Módulo do Studio", Icon: Sparkles, cls: "bg-purple-100 text-purple-700" },
  { value: "survey", label: "Pesquisa", Icon: ClipboardList, cls: "bg-emerald-100 text-emerald-700" },
  { value: "quiz", label: "Quiz", Icon: FileQuestion, cls: "bg-amber-100 text-amber-700" },
  { value: "form", label: "Formulário", Icon: FileText, cls: "bg-cyan-100 text-cyan-700" },
  { value: "trail", label: "Trilha", Icon: BookOpen, cls: "bg-indigo-100 text-indigo-700" },
  { value: "automated_campaign", label: "Campanha automatizada", Icon: Megaphone, cls: "bg-rose-100 text-rose-700" },
  { value: "tool", label: "Ferramenta de diagnóstico", Icon: Brain, cls: "bg-violet-100 text-violet-700" },
  { value: "other", label: "Outro", Icon: FileText, cls: "bg-slate-100 text-slate-700" },
];

const AUDIENCES = [
  { value: "todos", label: "Todos" },
  { value: "colaboradores", label: "Colaboradores" },
  { value: "lideres", label: "Líderes" },
  { value: "rh", label: "RH" },
  { value: "sesmt", label: "SESMT" },
];

export default function AdminBibliotecaPreventiva() {
  const { user } = useAuth();
  // Super Admin/admin global pode criar e editar TEMPLATES GLOBAIS (acervo padrão
  // da plataforma, visível para todas as empresas). Demais perfis só criam para
  // a própria empresa e leem (sem editar) os templates globais.
  const isGlobal = user?.role === "admin_global" || user?.role === "super_admin";

  const [openMonth, setOpenMonth] = useState<number | null>(1);
  const [openCampaignId, setOpenCampaignId] = useState<number | null>(null);
  const [showNewCampaign, setShowNewCampaign] = useState<number | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);

  const campaignsQ = trpc.preventiveLibrary.listCampaigns.useQuery();
  const summaryQ = trpc.preventiveLibrary.listCampaignSummary.useQuery();

  const upsertMut = trpc.preventiveLibrary.upsertCampaign.useMutation({
    onSuccess: () => {
      toast.success("Campanha salva.");
      campaignsQ.refetch();
      setShowNewCampaign(null);
      setEditingCampaign(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });
  const deleteMut = trpc.preventiveLibrary.deleteCampaign.useMutation({
    onSuccess: () => { toast.success("Campanha arquivada."); campaignsQ.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const campaigns = (campaignsQ.data ?? []) as any[];
  const summary = (summaryQ.data ?? []) as any[];

  function summaryFor(campaignId: number) {
    const lines = summary.filter((s: any) => s.campaign_id === campaignId && s.material_type !== "none");
    const total = lines.reduce((acc: number, s: any) => acc + Number(s.cnt), 0);
    return { total, lines };
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Biblioteca de Saúde Preventiva
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cada mês é um agrupador. Dentro do mês podem existir múltiplas campanhas (Janeiro Branco, Janeiro Roxo, Janeiro Verde...).
            Cada campanha aceita <b>materiais estáticos</b> (cartazes, PDFs, e-books, vídeos) e <b>conteúdo interativo da plataforma</b> (cursos, pesquisas, quizzes, trilhas) — para gerar indicadores reais de engajamento.
          </p>

          {/* Banner explicativo do conceito de template (varia por role) */}
          {isGlobal ? (
            <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-xs flex items-start gap-2">
              <Globe size={16} className="text-indigo-700 shrink-0 mt-0.5" />
              <div className="text-indigo-900">
                <b>Modo Super Admin — Biblioteca-mestre.</b> As campanhas que você criar aqui ficam disponíveis automaticamente como <b>acervo padrão</b> para TODAS as empresas da plataforma (badge "Padrão da plataforma"). Cada empresa pode usar como está; a personalização individual virá na Fase 2 (clonagem).
              </div>
            </div>
          ) : (
            <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs flex items-start gap-2">
              <Sparkles size={14} className="text-indigo-600 shrink-0 mt-0.5" />
              <div className="text-slate-700">
                Campanhas marcadas com <b className="text-indigo-700">Padrão da plataforma</b> vêm da biblioteca-mestre (Super Admin) e estão disponíveis para sua empresa. Você não pode editá-las, mas pode criar suas próprias campanhas para complementar.
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {MONTH_NAMES.map((mName, idx) => {
            const month = idx + 1;
            const monthCampaigns = campaigns.filter((c: any) => c.month_number === month);
            const isOpen = openMonth === month;
            const totalMonth = monthCampaigns.reduce((acc: number, c: any) => acc + summaryFor(c.id).total, 0);
            return (
              <div key={month} className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
                <div
                  onClick={() => { setOpenMonth(isOpen ? null : month); setOpenCampaignId(null); }}
                  className="px-5 py-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  {isOpen ? <ChevronDown size={18} className="text-slate-500" /> : <ChevronRight size={18} className="text-slate-500" />}
                  <CalendarDays size={18} className="text-primary" />
                  <h2 className="font-semibold flex-1">{month.toString().padStart(2, "0")} — {mName}</h2>
                  <span className="text-xs text-muted-foreground">{monthCampaigns.length} campanha(s) · {totalMonth} material(is)</span>
                </div>
                {isOpen && (
                  <div className="border-t border-border bg-slate-50/40 p-4 space-y-3">
                    {monthCampaigns.length === 0 && showNewCampaign !== month && (
                      <p className="text-sm text-muted-foreground italic">Nenhuma campanha cadastrada neste mês ainda.</p>
                    )}
                    {monthCampaigns.map((c: any) => {
                      const isCampOpen = openCampaignId === c.id;
                      const sf = summaryFor(c.id);
                      const isTemplate = !!c.is_template;
                      // Não-Super-Admin não pode editar/excluir templates (backend rejeita 403,
                      // UI bloqueia antes pra feedback claro).
                      const canEdit = isGlobal || !isTemplate;
                      return (
                        <div key={c.id}
                             className={`border rounded-lg overflow-hidden ${isTemplate ? "bg-indigo-50/40" : "bg-white"}`}
                             style={{ borderColor: c.color || (isTemplate ? "#a5b4fc" : "#cbd5e1") }}>
                          <div className="px-4 py-2 flex items-center gap-3 cursor-pointer hover:bg-slate-50" onClick={() => setOpenCampaignId(isCampOpen ? null : c.id)}>
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: c.color || "#cbd5e1" }} />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
                                {c.name}
                                {isTemplate && (
                                  <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200">
                                    <Globe size={10} /> Padrão da plataforma
                                  </span>
                                )}
                              </div>
                              {c.theme && <div className="text-xs text-muted-foreground">{c.theme}</div>}
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">{sf.total} material(is)</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!canEdit) { toast.info("Templates da plataforma só podem ser editados pelo Super Admin."); return; }
                                setEditingCampaign(c); setShowNewCampaign(month);
                              }}
                              className={`p-1 ${canEdit ? "text-slate-400 hover:text-primary" : "text-slate-300 cursor-not-allowed"}`}
                              title={canEdit ? "Editar" : "Somente Super Admin pode editar templates"}
                            >
                              {canEdit ? <Pencil size={13} /> : <Lock size={13} />}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!canEdit) { toast.info("Templates da plataforma só podem ser removidos pelo Super Admin."); return; }
                                if (confirm(`Arquivar a campanha "${c.name}"?`)) deleteMut.mutate({ id: c.id });
                              }}
                              className={`p-1 ${canEdit ? "text-slate-400 hover:text-rose-600" : "text-slate-300 cursor-not-allowed"}`}
                              title={canEdit ? "Arquivar" : "Somente Super Admin pode arquivar templates"}
                            >
                              {canEdit ? <Trash2 size={13} /> : <Lock size={13} />}
                            </button>
                          </div>
                          {isCampOpen && (
                            <div className="border-t border-border p-4">
                              <CampaignContent campaign={c} onRefetchSummary={() => summaryQ.refetch()} />
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {showNewCampaign === month ? (
                      <CampaignForm
                        month={month}
                        initial={editingCampaign}
                        isGlobal={isGlobal}
                        onSubmit={(data) => upsertMut.mutate(data)}
                        onCancel={() => { setShowNewCampaign(null); setEditingCampaign(null); }}
                        loading={upsertMut.isPending}
                      />
                    ) : (
                      <button
                        onClick={() => { setEditingCampaign(null); setShowNewCampaign(month); }}
                        className="w-full text-sm border border-dashed border-slate-300 rounded-lg py-2 text-slate-600 hover:bg-white hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus size={14} /> Adicionar campanha em {mName}
                      </button>
                    )}
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

function CampaignForm({ month, initial, isGlobal, onSubmit, onCancel, loading }: any) {
  const [form, setForm] = useState({
    id: initial?.id,
    monthNumber: month,
    code: initial?.code ?? "",
    name: initial?.name ?? "",
    theme: initial?.theme ?? "",
    color: initial?.color ?? "#3b82f6",
    description: initial?.description ?? "",
    // Super Admin: default true (cria como template global por padrão).
    // Demais: ignorado pelo backend.
    isTemplate: initial ? !!initial.is_template : !!isGlobal,
  });
  return (
    <div className={`border border-border rounded-lg p-4 space-y-3 ${form.isTemplate && isGlobal ? "bg-indigo-50/60" : "bg-white"}`}>
      <h3 className="font-semibold text-sm flex items-center gap-2">
        {initial ? "Editar campanha" : "Nova campanha"}
        {form.isTemplate && isGlobal && (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200">
            <Globe size={10} /> Template Global
          </span>
        )}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Nome *</label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ex.: Janeiro Roxo" className="text-sm" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Código único *</label>
          <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} placeholder="ex.: janeiro_roxo" className="text-sm font-mono" />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-muted-foreground">Tema / Causa</label>
          <Input value={form.theme} onChange={(e) => setForm({ ...form, theme: e.target.value })} placeholder="ex.: Conscientização Hanseníase" className="text-sm" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Cor identificadora</label>
          <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-full h-9 border border-border rounded" />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-muted-foreground">Descrição</label>
          <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Breve contexto da campanha" className="text-sm" />
        </div>
      </div>

      {/* Toggle Template Global — só Super Admin vê. Quando ativo, cria como acervo
          padrão da plataforma (visível pra todas as empresas). */}
      {isGlobal && (
        <label className="flex items-start gap-2 bg-indigo-50/40 border border-indigo-200 rounded-md p-2 cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={form.isTemplate}
            onChange={(e) => setForm({ ...form, isTemplate: e.target.checked })}
            className="mt-0.5"
          />
          <span className="flex-1">
            <b className="text-indigo-900">Salvar como Template Global (Padrão da plataforma)</b>
            <br />
            <span className="text-indigo-700">
              Quando marcado, esta campanha fica disponível para TODAS as empresas. Desmarque para
              criar uma campanha vinculada a uma empresa específica.
            </span>
          </span>
        </label>
      )}

      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" onClick={() => onSubmit(form)} disabled={loading || !form.name.trim() || !form.code.trim()}>
          {loading ? "Salvando..." : initial ? "Atualizar" : (form.isTemplate && isGlobal ? "Criar template" : "Criar campanha")}
        </Button>
      </div>
    </div>
  );
}

function CampaignContent({ campaign, onRefetchSummary }: { campaign: any; onRefetchSummary: () => void }) {
  const [tab, setTab] = useState<"materials" | "links">("materials");
  return (
    <div>
      <div className="flex gap-1 mb-3 border-b border-border">
        <button onClick={() => setTab("materials")} className={`px-3 py-1.5 text-xs font-medium border-b-2 ${tab === "materials" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
          📎 Materiais estáticos
        </button>
        <button onClick={() => setTab("links")} className={`px-3 py-1.5 text-xs font-medium border-b-2 ${tab === "links" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
          ⚡ Conteúdo interativo da plataforma
        </button>
      </div>
      {tab === "materials" ? <MaterialsPanel campaign={campaign} onRefetchSummary={onRefetchSummary} /> : <LinksPanel campaign={campaign} />}
    </div>
  );
}

function MaterialsPanel({ campaign, onRefetchSummary }: any) {
  const matsQ = trpc.preventiveLibrary.listMaterials.useQuery({ campaignId: campaign.id });
  const [form, setForm] = useState({ materialType: "cartaz" as any, title: "", description: "", targetAudience: "todos" as any });
  const uploadMut = trpc.preventiveLibrary.uploadMaterial.useMutation({
    onSuccess: () => {
      toast.success("Material adicionado.");
      matsQ.refetch();
      onRefetchSummary();
      setForm({ materialType: "cartaz" as any, title: "", description: "", targetAudience: "todos" as any });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro no upload"),
  });
  const deleteMut = trpc.preventiveLibrary.deleteMaterial.useMutation({
    onSuccess: () => { toast.success("Removido."); matsQ.refetch(); onRefetchSummary(); },
  });

  async function handleFile(f: File) {
    if (!form.title.trim()) { toast.error("Informe o título antes de subir."); return; }
    if (f.size > 20 * 1024 * 1024) { toast.error("Arquivo acima de 20MB."); return; }
    const b64 = await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result || ""));
      fr.onerror = () => rej(fr.error);
      fr.readAsDataURL(f);
    });
    uploadMut.mutate({
      campaignId: campaign.id,
      materialType: form.materialType,
      title: form.title,
      description: form.description || undefined,
      fileName: f.name,
      fileBase64: b64,
      mimeType: f.type || "application/octet-stream",
      targetAudience: form.targetAudience,
    });
  }

  const mats = (matsQ.data ?? []) as any[];

  return (
    <div className="space-y-4">
      <div className="bg-slate-50 border border-border rounded p-3 space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Tipo</label>
            <select value={form.materialType} onChange={(e) => setForm({ ...form, materialType: e.target.value as any })} className="w-full text-xs px-2 py-1 border border-border rounded bg-white">
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Público</label>
            <select value={form.targetAudience} onChange={(e) => setForm({ ...form, targetAudience: e.target.value as any })} className="w-full text-xs px-2 py-1 border border-border rounded bg-white">
              {AUDIENCES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">Título *</label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="ex.: Cartaz - Saúde Mental" className="text-xs" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">Descrição</label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Breve descrição" className="text-xs" />
          </div>
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded">
          <Upload size={12} />
          <span>{uploadMut.isPending ? "Enviando..." : "Escolher arquivo"}</span>
          <input type="file" className="hidden" disabled={uploadMut.isPending || !form.title.trim()} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
        </label>
        <span className="text-[10px] text-muted-foreground ml-2">Máx 20MB</span>
      </div>

      {mats.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Nenhum material estático ainda.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {mats.map((m: any) => {
            const typeInfo = TYPES.find(t => t.value === m.material_type);
            const Icon = typeInfo?.Icon ?? FileText;
            return (
              <div key={m.id} className="flex items-start gap-2 p-2 border border-border rounded bg-white">
                <Icon size={16} className="text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-xs">{m.title}</span>
                    <span className="text-[9px] font-mono bg-slate-100 text-slate-600 px-1 rounded">{typeInfo?.label}</span>
                    <span className="text-[9px] bg-blue-50 text-blue-700 px-1 rounded">{AUDIENCES.find(a => a.value === m.target_audience)?.label}</span>
                  </div>
                  {m.description && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{m.description}</p>}
                  <a href={m.file_url} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline">Abrir</a>
                </div>
                <button onClick={() => { if (confirm("Remover?")) deleteMut.mutate({ id: m.id }); }} className="text-rose-600 hover:text-rose-800">
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LinksPanel({ campaign }: { campaign: any }) {
  const linksQ = trpc.preventiveLibrary.listCampaignLinks.useQuery({ campaignId: campaign.id });
  const [linkType, setLinkType] = useState<string>("course");
  const [refId, setRefId] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [audience, setAudience] = useState<"todos"|"lideres"|"rh"|"sesmt"|"colaboradores">("todos");

  const availQ = trpc.preventiveLibrary.listAvailableForLink.useQuery({ linkType: linkType as any }, { enabled: !!linkType });
  const addMut = trpc.preventiveLibrary.addCampaignLink.useMutation({
    onSuccess: (r: any) => {
      if (r.alreadyLinked) toast.info("Esse conteúdo já estava vinculado.");
      else toast.success("Conteúdo vinculado à campanha.");
      linksQ.refetch();
      setRefId(""); setTitle(""); setNotes("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const rmMut = trpc.preventiveLibrary.removeCampaignLink.useMutation({
    onSuccess: () => { toast.success("Vínculo removido."); linksQ.refetch(); },
  });

  const available = (availQ.data ?? []) as any[];
  const links = (linksQ.data ?? []) as any[];

  function handleAdd() {
    if (!refId) { toast.error("Selecione um item"); return; }
    const item = available.find((a: any) => a.id === Number(refId));
    addMut.mutate({
      campaignId: campaign.id,
      linkType: linkType as any,
      refId: Number(refId),
      title: title || item?.title || "Sem título",
      notes: notes || undefined,
      targetAudience: audience,
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-slate-50 border border-border rounded p-3 space-y-2">
        <p className="text-xs font-medium text-slate-700">Vincular conteúdo interativo (gera indicadores reais)</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Tipo</label>
            <select value={linkType} onChange={(e) => { setLinkType(e.target.value); setRefId(""); }} className="w-full text-xs px-2 py-1 border border-border rounded bg-white">
              {LINK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Público</label>
            <select value={audience} onChange={(e) => setAudience(e.target.value as any)} className="w-full text-xs px-2 py-1 border border-border rounded bg-white">
              {AUDIENCES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">Item disponível na plataforma *</label>
            <select value={refId} onChange={(e) => { setRefId(e.target.value); const it = available.find((a: any) => a.id === Number(e.target.value)); if (it) setTitle(it.title); }} className="w-full text-xs px-2 py-1 border border-border rounded bg-white">
              <option value="">— selecione —</option>
              {available.map((a: any) => <option key={a.id} value={a.id}>{a.title}{a.category ? ` (${a.category})` : ""}</option>)}
            </select>
            {linkType && !availQ.isLoading && available.length === 0 && (
              <p className="text-[10px] text-amber-700 mt-1">Nenhum item desse tipo disponível ainda. Cadastre na área correspondente primeiro.</p>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">Título exibido na campanha</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mantém ou ajusta o título" className="text-xs" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">Observações</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contexto, instruções, etc." className="text-xs" />
          </div>
        </div>
        <Button size="sm" onClick={handleAdd} disabled={addMut.isPending || !refId}>
          <Plus size={12} className="mr-1" /> {addMut.isPending ? "Vinculando..." : "Vincular"}
        </Button>
      </div>

      {links.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Nenhum conteúdo interativo vinculado a esta campanha.</p>
      ) : (
        <div className="space-y-2">
          {links.map((l: any) => {
            const meta = LINK_TYPES.find(t => t.value === l.link_type) ?? LINK_TYPES[LINK_TYPES.length - 1];
            const Icon = meta.Icon;
            return (
              <div key={l.id} className="flex items-start gap-2 p-2 border border-border rounded bg-white">
                <Icon size={16} className="text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-xs">{l.title}</span>
                    <span className={`text-[9px] px-1 rounded font-medium ${meta.cls}`}>{meta.label}</span>
                    <span className="text-[9px] bg-blue-50 text-blue-700 px-1 rounded">{AUDIENCES.find(a => a.value === l.target_audience)?.label}</span>
                    <span className="text-[9px] font-mono text-slate-400">ref #{l.ref_id}</span>
                  </div>
                  {l.notes && <p className="text-[11px] text-muted-foreground mt-0.5">{l.notes}</p>}
                </div>
                <button onClick={() => { if (confirm("Desvincular?")) rmMut.mutate({ id: l.id }); }} className="text-rose-600 hover:text-rose-800">
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
