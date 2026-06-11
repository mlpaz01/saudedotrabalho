import { useState } from "react";
import { Link } from "wouter";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, ClipboardList, Play, Square, BarChart3, Pencil, Trash2,
  Sparkles as SparklesIcon, Search,
} from "lucide-react";

/* ─── Shared CSS ─────────────────────────────────────────── */
const SHARED_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Lora:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
.ucg-page{background:#F4F6F9;min-height:100vh;font-family:'Plus Jakarta Sans',system-ui,sans-serif}
.ucg-wrap{padding:24px 30px 44px;max-width:1680px;margin:0 auto}
.ucg-header{margin-bottom:18px}
.ucg-title{font-family:'Lora',Georgia,serif;font-size:27px;font-weight:700;color:#0E2C46;letter-spacing:-.01em;line-height:1.15}
.ucg-subtitle{font-size:13px;color:#62707D;margin-top:6px;font-weight:500;line-height:1.5}
.ucg-toolbar{display:flex;align-items:center;gap:10px;margin-bottom:20px;flex-wrap:wrap}
.ucg-search-wrap{position:relative;flex:1;min-width:180px;max-width:340px}
.ucg-search-icon{position:absolute;left:11px;top:50%;transform:translateY(-50%);width:14px;height:14px;color:#94a3b8;stroke:currentColor;fill:none;stroke-width:2;pointer-events:none}
.ucg-search{width:100%;padding:9px 12px 9px 32px;border:1.5px solid #E0E6ED;border-radius:11px;font-size:13px;font-family:inherit;background:#fff;outline:none;color:#1C2A36;transition:border-color .15s,box-shadow .15s}
.ucg-search:focus{border-color:#2EA56A;box-shadow:0 0 0 3px rgba(46,165,106,.1)}
.ucg-search::placeholder{color:#94a3b8}
.ucg-filters{display:flex;gap:6px;flex-wrap:wrap}
.ucg-pill{padding:7px 15px;border-radius:999px;font-size:12.5px;font-weight:600;cursor:pointer;border:1.5px solid #E0E6ED;background:#fff;color:#62707D;transition:all .15s;white-space:nowrap;display:inline-flex;align-items:center;gap:6px;font-family:inherit}
.ucg-pill:hover{border-color:#0E2C46;color:#0E2C46}
.ucg-pill.active{background:#0E2C46;color:#fff;border-color:#0E2C46}
.ucg-pill svg{width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2}
.ucg-cnt{font-size:10.5px;font-weight:700;padding:1px 6px;border-radius:20px;background:rgba(255,255,255,.22)}
.ucg-pill:not(.active) .ucg-cnt{background:rgba(14,44,70,.09);color:#0E2C46}
.ucg-actions{margin-left:auto;display:flex;gap:8px;align-items:center}
.ucg-btn-primary{display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:10px;font-size:13px;font-weight:700;background:linear-gradient(135deg,#2EA56A,#1a7a46);color:#fff;border:none;cursor:pointer;box-shadow:0 3px 12px rgba(46,165,106,.25);transition:all .15s;font-family:inherit;white-space:nowrap}
.ucg-btn-primary:hover{transform:translateY(-1px);box-shadow:0 5px 16px rgba(46,165,106,.35)}
.ucg-btn-primary svg{width:15px;height:15px;stroke:#fff;fill:none;stroke-width:2}
.ucg-btn-ghost{display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:10px;font-size:13px;font-weight:600;background:#fff;color:#0E2C46;border:1.5px solid #E0E6ED;cursor:pointer;transition:all .15s;font-family:inherit;white-space:nowrap}
.ucg-btn-ghost:hover{border-color:#0E2C46}
.ucg-btn-ghost svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2}
.ucg-btn-ai{display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:10px;font-size:13px;font-weight:700;background:linear-gradient(135deg,#f59e0b,#ea580c);color:#fff;border:none;cursor:pointer;box-shadow:0 3px 12px rgba(234,88,12,.22);transition:all .15s;font-family:inherit;white-space:nowrap;text-decoration:none}
.ucg-btn-ai:hover{transform:translateY(-1px);box-shadow:0 5px 16px rgba(234,88,12,.32)}
.ucg-btn-ai svg{width:15px;height:15px;stroke:#fff;fill:none;stroke-width:2}
.ucg-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
@media(max-width:1280px){.ucg-grid{grid-template-columns:repeat(3,1fr)}}
@media(max-width:900px){.ucg-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.ucg-grid{grid-template-columns:1fr}}
.ucg-card{background:#fff;border:1.5px solid #E9EDF2;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;transition:box-shadow .18s,transform .18s,border-color .18s}
.ucg-card:hover{box-shadow:0 8px 28px -8px rgba(14,44,70,.14);transform:translateY(-2px);border-color:#D4DCE6}
.ucg-thumb{position:relative;aspect-ratio:16/9;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.ucg-thumb-icon{width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,.22);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center}
.ucg-thumb-icon svg{width:24px;height:24px;stroke:#fff;fill:none;stroke-width:1.8}
.ucg-body{padding:13px 15px 15px;flex:1;display:flex;flex-direction:column;gap:7px}
.ucg-cat{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;width:fit-content;white-space:nowrap}
.ucg-cat svg{width:11px;height:11px;stroke:currentColor;fill:none;stroke-width:2}
.ucg-card-title{font-size:13.5px;font-weight:700;color:#0E2C46;line-height:1.35;letter-spacing:-.01em}
.ucg-card-desc{font-size:12px;color:#62707D;line-height:1.5;flex:1;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ucg-meta{display:flex;align-items:center;gap:10px;font-size:11px;color:#92A0AC;font-weight:500;flex-wrap:wrap;margin-top:1px}
.ucg-meta-item{display:flex;align-items:center;gap:3px}
.ucg-meta-item svg{width:11px;height:11px;stroke:currentColor;fill:none;stroke-width:2;flex-shrink:0}
.ucg-footer{display:flex;gap:6px;margin-top:8px;padding-top:9px;border-top:1px solid #EFF2F6}
.ucg-fb{flex:1;padding:7px 8px;border-radius:9px;font-size:12px;font-weight:600;border:none;cursor:pointer;transition:all .14s;display:flex;align-items:center;justify-content:center;gap:4px;font-family:inherit}
.ucg-fb svg{width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2}
.ucg-fp{background:#0E2C46;color:#fff}
.ucg-fp:hover{background:#123451}
.ucg-fg{background:#F4F6F9;color:#0E2C46}
.ucg-fg:hover{background:#E9EDF2}
.ucg-fd{background:rgba(225,86,72,.1);color:#c0392b}
.ucg-fd:hover{background:rgba(225,86,72,.16)}
.ucg-empty{grid-column:1/-1;text-align:center;padding:56px 20px;color:#92A0AC}
.ucg-empty svg{width:36px;height:36px;margin:0 auto 10px;display:block;opacity:.28;stroke:currentColor;fill:none;stroke-width:1.5}
.ucg-empty p{font-size:14px;font-weight:600;color:#62707D}
.ucg-empty small{font-size:12px;margin-top:4px;display:block}
.ucg-skel{background:linear-gradient(90deg,#E9EDF2 0%,#F4F6F9 50%,#E9EDF2 100%);background-size:200% 100%;animation:shimmer 1.3s infinite;border-radius:8px}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.ucg-status-badge{position:absolute;top:9px;right:9px;font-size:9.5px;font-weight:700;padding:3px 8px;border-radius:6px}
.ucg-sb-active{background:rgba(46,165,106,.88);color:#fff}
.ucg-sb-inactive{background:rgba(100,116,139,.82);color:#fff}
.ucg-sb-draft{background:rgba(232,178,62,.9);color:#fff}
.ucg-sb-review{background:rgba(59,130,196,.9);color:#fff}
.ucg-sb-approved{background:rgba(139,111,207,.9);color:#fff}
`;

/* ─── Survey category helper ─────────────────────────────── */
function surveyCategory(category: string): { label: string; bg: string; color: string; grad: string } {
  const c = (category || "").toLowerCase();
  if (c.includes("psico") || c.includes("drps") || c.includes("nr-01") || c.includes("nr01"))
    return { label: "DRPS", bg: "rgba(29,78,216,.12)", color: "#1D4ED8", grad: "linear-gradient(135deg,#1e3a8a,#3B82F6)" };
  if (c.includes("aep") || c.includes("ergon"))
    return { label: "AEP", bg: "rgba(124,58,237,.12)", color: "#7C3AED", grad: "linear-gradient(135deg,#4c1d95,#A855F7)" };
  if (c.includes("clima") || c.includes("satisf") || c.includes("engaj"))
    return { label: "Clima", bg: "rgba(5,150,105,.12)", color: "#059669", grad: "linear-gradient(135deg,#064e3b,#10B981)" };
  if (c.includes("burnout") || c.includes("estresse") || c.includes("esgot"))
    return { label: "Burnout", bg: "rgba(217,119,6,.12)", color: "#D97706", grad: "linear-gradient(135deg,#78350f,#F59E0B)" };
  if (c.includes("assédio") || c.includes("assedio") || c.includes("sexual") || c.includes("moral"))
    return { label: "Assédio", bg: "rgba(220,38,38,.12)", color: "#DC2626", grad: "linear-gradient(135deg,#7f1d1d,#EF4444)" };
  return { label: "Outros", bg: "rgba(100,116,139,.12)", color: "#475569", grad: "linear-gradient(135deg,#334155,#475569)" };
}

function surveyFilterKey(category: string): string {
  return surveyCategory(category).label;
}

/* ─── Status helpers ─────────────────────────────────────── */
function statusBadgeClass(status: string): string {
  if (status === "active") return "ucg-sb-active";
  if (status === "closed") return "ucg-sb-review";
  return "ucg-sb-draft";
}

function statusLabel(status: string): string {
  if (status === "active") return "Ativa";
  if (status === "closed") return "Encerrada";
  return "Rascunho";
}

/* ─── Skeleton cards ─────────────────────────────────────── */
function SkeletonCards() {
  return (
    <>
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="ucg-card">
          <div className="ucg-skel" style={{ aspectRatio: "16/9" }} />
          <div className="ucg-body" style={{ gap: 8 }}>
            <div className="ucg-skel" style={{ height: 18, width: "40%" }} />
            <div className="ucg-skel" style={{ height: 16, width: "80%" }} />
            <div className="ucg-skel" style={{ height: 13, width: "60%" }} />
          </div>
        </div>
      ))}
    </>
  );
}

/* ─── Main component ─────────────────────────────────────── */
export default function AdminSurveys() {
  const listQ = trpc.surveys.list.useQuery();
  const templatesQ = trpc.surveys.listTemplates.useQuery();
  const utils = trpc.useUtils();

  /* Mutations */
  const createMut = trpc.surveys.create.useMutation({
    onSuccess: () => {
      utils.surveys.list.invalidate();
      setNewOpen(false);
      setForm({ title: "", description: "", category: "customizado", isAnonymous: true });
      toast.success("Pesquisa criada!");
    },
    onError: (e) => toast.error(e.message),
  });
  const fromTplMut = trpc.surveys.createFromTemplate.useMutation({
    onSuccess: () => {
      utils.surveys.list.invalidate();
      setChoiceOpen(false);
      toast.success("Pesquisa criada a partir do template!");
    },
    onError: (e) => toast.error(e.message),
  });
  const launchMut = trpc.surveys.launch.useMutation({
    onSuccess: () => { utils.surveys.list.invalidate(); toast.success("Pesquisa lançada!"); },
    onError: (e) => toast.error(e.message),
  });
  const closeMut = trpc.surveys.close.useMutation({
    onSuccess: () => { utils.surveys.list.invalidate(); toast.success("Pesquisa encerrada."); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.surveys.delete.useMutation({
    onSuccess: () => {
      utils.surveys.list.invalidate();
      setDeleteSurveyId(null);
      toast.success("Pesquisa removida.");
    },
    onError: (e) => toast.error(e.message),
  });

  /* UI state */
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "customizado", isAnonymous: true });
  const [deleteSurveyId, setDeleteSurveyId] = useState<number | null>(null);
  const [deleteSurveyTitle, setDeleteSurveyTitle] = useState("");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("Todas");
  const [statusFilter, setStatusFilter] = useState("Todos");

  const surveys = listQ.data ?? [];
  const templates = templatesQ.data ?? [];

  /* Derived counts */
  const catCounts: Record<string, number> = { Todas: surveys.length };
  surveys.forEach((s: any) => {
    const key = surveyFilterKey(s.category ?? "");
    catCounts[key] = (catCounts[key] ?? 0) + 1;
  });

  const statusCounts = {
    Todos: surveys.length,
    Ativas: surveys.filter((s: any) => s.status === "active").length,
    Encerradas: surveys.filter((s: any) => s.status === "closed").length,
    "Em campo": surveys.filter((s: any) => s.status === "active").length,
  };

  /* Filtered list */
  const filtered = surveys.filter((s: any) => {
    const matchSearch = !search ||
      (s.title ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (s.description ?? "").toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "Todas" || surveyFilterKey(s.category ?? "") === catFilter;
    const matchStatus =
      statusFilter === "Todos" ? true :
      statusFilter === "Ativas" ? s.status === "active" :
      statusFilter === "Encerradas" ? s.status === "closed" :
      statusFilter === "Em campo" ? s.status === "active" :
      true;
    return matchSearch && matchCat && matchStatus;
  });

  const CAT_PILLS = ["Todas", "DRPS", "AEP", "Clima", "Burnout", "Assédio", "Outros"];
  const STATUS_PILLS = ["Todos", "Ativas", "Encerradas", "Em campo"];

  return (
    <AppLayout>
      {/* Inject shared CSS */}
      <style dangerouslySetInnerHTML={{ __html: SHARED_CSS }} />

      <div className="ucg-page">
        <div className="ucg-wrap">

          {/* Header */}
          <div className="ucg-header">
            <h1 className="ucg-title">Pesquisas</h1>
            <p className="ucg-subtitle">Aplique pesquisas de clima, risco e bem-estar na sua empresa</p>
          </div>

          {/* Toolbar */}
          <div className="ucg-toolbar">
            {/* Search */}
            <div className="ucg-search-wrap">
              <svg className="ucg-search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input
                className="ucg-search"
                placeholder="Buscar pesquisa..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Category pills */}
            <div className="ucg-filters">
              {CAT_PILLS.map(pill => (
                <button
                  key={pill}
                  className={`ucg-pill${catFilter === pill ? " active" : ""}`}
                  onClick={() => setCatFilter(pill)}
                >
                  {pill}
                  <span className="ucg-cnt">{catCounts[pill] ?? 0}</span>
                </button>
              ))}
            </div>

            {/* Status pills */}
            <div className="ucg-filters">
              {STATUS_PILLS.map(pill => (
                <button
                  key={pill}
                  className={`ucg-pill${statusFilter === pill ? " active" : ""}`}
                  onClick={() => setStatusFilter(pill)}
                >
                  {pill}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="ucg-actions">
              <Link href="/admin/pesquisas/estudio">
                <a className="ucg-btn-ai">
                  <SparklesIcon size={15} />
                  Criar com IA
                </a>
              </Link>
              <button className="ucg-btn-primary" onClick={() => setChoiceOpen(true)}>
                <Plus size={15} />
                Nova pesquisa
              </button>
            </div>
          </div>

          {/* Grid */}
          <div className="ucg-grid">
            {listQ.isLoading && <SkeletonCards />}

            {!listQ.isLoading && filtered.length === 0 && (
              <div className="ucg-empty">
                <ClipboardList />
                <p>{search || catFilter !== "Todas" || statusFilter !== "Todos" ? "Nenhuma pesquisa encontrada" : "Nenhuma pesquisa ainda"}</p>
                <small>
                  {search || catFilter !== "Todas" || statusFilter !== "Todos"
                    ? "Tente ajustar os filtros ou a busca."
                    : "Use um template ou crie uma pesquisa do zero."}
                </small>
              </div>
            )}

            {!listQ.isLoading && filtered.map((s: any) => {
              const cat = surveyCategory(s.category ?? "");
              const qCount = s.questions?.length ?? s.questionsCount ?? 0;
              return (
                <div key={s.id} className="ucg-card">
                  {/* Thumb */}
                  <div className="ucg-thumb" style={{ background: cat.grad }}>
                    <div className="ucg-thumb-icon">
                      <ClipboardList size={24} style={{ stroke: "#fff", fill: "none", strokeWidth: 1.8 }} />
                    </div>
                    <span className={`ucg-status-badge ${statusBadgeClass(s.status)}`}>
                      {statusLabel(s.status)}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="ucg-body">
                    <span className="ucg-cat" style={{ background: cat.bg, color: cat.color }}>
                      {cat.label}
                    </span>
                    <div className="ucg-card-title">{s.title}</div>
                    {s.description && (
                      <div className="ucg-card-desc">{s.description}</div>
                    )}
                    <div className="ucg-meta">
                      {qCount > 0 && (
                        <span className="ucg-meta-item">
                          <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>
                          {qCount} {qCount === 1 ? "pergunta" : "perguntas"}
                        </span>
                      )}
                      <span className="ucg-meta-item">
                        <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                        {s.isAnonymous ? "Anônima" : "Identificada"}
                      </span>
                    </div>

                    {/* Footer */}
                    <div className="ucg-footer">
                      {/* Primary action */}
                      {s.status === "draft" && (
                        <button
                          className="ucg-fb ucg-fp"
                          onClick={() => launchMut.mutate({ id: s.id })}
                          disabled={launchMut.isPending}
                        >
                          <Play size={12} />
                          Lançar
                        </button>
                      )}
                      {s.status === "active" && (
                        <Link href={`/admin/pesquisas/${s.id}/resultados`}>
                          <a className="ucg-fb ucg-fp" style={{ textDecoration: "none" }}>
                            <BarChart3 size={12} />
                            Ver resultados
                          </a>
                        </Link>
                      )}
                      {s.status === "closed" && (
                        <Link href={`/admin/pesquisas/${s.id}/resultados`}>
                          <a className="ucg-fb ucg-fp" style={{ textDecoration: "none" }}>
                            <BarChart3 size={12} />
                            Resultados
                          </a>
                        </Link>
                      )}

                      {/* Edit */}
                      <Link href={`/admin/pesquisas/${s.id}/editar`}>
                        <a className="ucg-fb ucg-fg" style={{ textDecoration: "none" }}>
                          <Pencil size={12} />
                          Editar
                        </a>
                      </Link>

                      {/* Close / Reopen */}
                      {s.status === "active" && (
                        <button
                          className="ucg-fb ucg-fg"
                          onClick={() => closeMut.mutate({ id: s.id })}
                          disabled={closeMut.isPending}
                          title="Encerrar pesquisa"
                        >
                          <Square size={12} />
                        </button>
                      )}
                      {s.status === "closed" && (
                        <button
                          className="ucg-fb ucg-fg"
                          onClick={() => launchMut.mutate({ id: s.id })}
                          disabled={launchMut.isPending}
                          title="Reabrir pesquisa"
                        >
                          <Play size={12} />
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        className="ucg-fb ucg-fd"
                        style={{ flex: "none", padding: "7px 10px" }}
                        onClick={() => { setDeleteSurveyId(s.id); setDeleteSurveyTitle(s.title); }}
                        title="Excluir"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Choice dialog ─────────────────────────────────── */}
      <Dialog open={choiceOpen} onOpenChange={setChoiceOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Como deseja começar?</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => { setChoiceOpen(false); setNewOpen(true); }}
              className="border border-border rounded-xl p-4 text-left hover:border-primary hover:bg-primary/5 transition-all"
            >
              <Plus size={20} className="text-primary mb-2" />
              <p className="font-semibold">Começar do zero</p>
              <p className="text-sm text-muted-foreground">Crie uma pesquisa em branco e adicione suas próprias perguntas.</p>
            </button>
            <div className="border border-border rounded-xl p-4">
              <p className="font-semibold mb-2">Usar template</p>
              <div className="space-y-1.5">
                {templates.map((t: any) => {
                  const tcat = surveyCategory(t.category ?? "");
                  return (
                    <button
                      key={t.id}
                      onClick={() => fromTplMut.mutate({ templateId: t.id })}
                      disabled={fromTplMut.isPending}
                      className="w-full flex items-center gap-2 text-left text-sm px-2 py-1.5 rounded hover:bg-muted"
                    >
                      <span
                        style={{ width: 8, height: 8, borderRadius: "50%", background: tcat.color, flexShrink: 0, display: "inline-block" }}
                      />
                      {t.title}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── New blank dialog ──────────────────────────────── */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova pesquisa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Título *</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Descrição</label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Categoria</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="customizado">Customizada</option>
                <option value="clima">Clima organizacional</option>
                <option value="psicossocial">Riscos psicossociais (DRPS)</option>
                <option value="burnout">Burnout / Estresse</option>
                <option value="assedio">Assédio</option>
                <option value="aep">Ergonomia (AEP)</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.isAnonymous}
                onChange={e => setForm(f => ({ ...f, isAnonymous: e.target.checked }))}
              />
              Respostas anônimas
            </label>
          </div>
          <DialogFooter>
            <button className="ucg-btn-ghost" onClick={() => setNewOpen(false)}>Cancelar</button>
            <button
              className="ucg-btn-primary"
              disabled={createMut.isPending}
              onClick={() => {
                if (!form.title.trim()) { toast.error("Título obrigatório"); return; }
                createMut.mutate(form);
              }}
            >
              Criar pesquisa
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ───────────────────────────── */}
      <AlertDialog open={deleteSurveyId !== null} onOpenChange={open => !open && setDeleteSurveyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pesquisa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a pesquisa <strong>"{deleteSurveyTitle}"</strong>?
              Esta ação é <strong>irreversível</strong>. Todas as respostas e estatísticas serão perdidas permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (deleteSurveyId !== null) {
                  deleteMut.mutate({ id: deleteSurveyId });
                }
              }}
            >
              Sim, excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
