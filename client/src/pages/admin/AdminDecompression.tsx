import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Category helper ──────────────────────────────────────────────────
function decompCategory(type: string): { label: string; bg: string; color: string; grad: string } {
  const t = (type || "").toLowerCase();
  if (t.includes("breath") || t.includes("respir"))
    return { label: "Respiração", bg: "rgba(2,132,199,.12)", color: "#0284C7", grad: "linear-gradient(135deg,#0c4a6e,#38BDF8)" };
  if (t.includes("medit"))
    return { label: "Meditação", bg: "rgba(124,58,237,.12)", color: "#7C3AED", grad: "linear-gradient(135deg,#4c1d95,#A78BFA)" };
  if (t.includes("yoga") || t.includes("stretch") || t.includes("along"))
    return { label: "Yoga", bg: "rgba(5,150,105,.12)", color: "#059669", grad: "linear-gradient(135deg,#064e3b,#34D399)" };
  if (t.includes("reflex") || t.includes("journal") || t.includes("escrita"))
    return { label: "Reflexão", bg: "rgba(217,119,6,.12)", color: "#D97706", grad: "linear-gradient(135deg,#78350f,#FCD34D)" };
  if (t.includes("focus") || t.includes("foco") || t.includes("concentr"))
    return { label: "Foco", bg: "rgba(99,102,241,.12)", color: "#4338CA", grad: "linear-gradient(135deg,#1e1b4b,#818CF8)" };
  return { label: "Outros", bg: "rgba(100,116,139,.12)", color: "#475569", grad: "linear-gradient(135deg,#334155,#475569)" };
}

// ── CSS ──────────────────────────────────────────────────────────────
const CSS = `
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
`;

// ── Types ─────────────────────────────────────────────────────────────
type Category = "yoga" | "meditacao" | "respiracao" | "outro";

type VideoForm = {
  title: string;
  category: Category;
  videoUrl: string;
  thumbnailUrl: string;
  durationMinutes: string;
  description: string;
  isActive: boolean;
  orderIndex: string;
};

const emptyForm: VideoForm = {
  title: "",
  category: "yoga",
  videoUrl: "",
  thumbnailUrl: "",
  durationMinutes: "0",
  description: "",
  isActive: true,
  orderIndex: "0",
};

const FILTER_PILLS = ["Todas", "Respiração", "Meditação", "Yoga", "Reflexão", "Foco", "Outros"];

export default function AdminDecompression() {
  const videosQuery = trpc.admin.listDecompressionVideos.useQuery();
  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("Todas");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<VideoForm>(emptyForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const createMutation = trpc.admin.createDecompressionVideo.useMutation({
    onSuccess: () => {
      toast.success("Vídeo adicionado com sucesso!");
      utils.admin.listDecompressionVideos.invalidate();
      utils.decompression.list.invalidate();
      setDialogOpen(false);
      setForm(emptyForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.admin.updateDecompressionVideo.useMutation({
    onSuccess: () => {
      toast.success("Vídeo atualizado com sucesso!");
      utils.admin.listDecompressionVideos.invalidate();
      utils.decompression.list.invalidate();
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.admin.deleteDecompressionVideo.useMutation({
    onSuccess: () => {
      toast.success("Vídeo removido.");
      utils.admin.listDecompressionVideos.invalidate();
      utils.decompression.list.invalidate();
      setDeleteConfirmId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleActiveMutation = trpc.admin.updateDecompressionVideo.useMutation({
    onSuccess: () => {
      utils.admin.listDecompressionVideos.invalidate();
      utils.decompression.list.invalidate();
    },
  });

  const videos = videosQuery.data ?? [];

  // filter counts
  const pillCounts: Record<string, number> = { Todas: videos.length };
  for (const v of videos) {
    const lbl = decompCategory(v.category).label;
    pillCounts[lbl] = (pillCounts[lbl] ?? 0) + 1;
  }

  const filtered = videos.filter((v) => {
    const matchSearch =
      !search ||
      v.title.toLowerCase().includes(search.toLowerCase()) ||
      (v.description ?? "").toLowerCase().includes(search.toLowerCase());
    const lbl = decompCategory(v.category).label;
    const matchFilter = activeFilter === "Todas" || lbl === activeFilter;
    return matchSearch && matchFilter;
  });

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(v: typeof videos[0]) {
    setEditingId(v.id);
    setForm({
      title: v.title,
      category: v.category as Category,
      videoUrl: v.videoUrl ?? "",
      thumbnailUrl: v.thumbnailUrl ?? "",
      durationMinutes: String(v.durationMinutes ?? 0),
      description: v.description ?? "",
      isActive: v.isActive,
      orderIndex: String(v.orderIndex),
    });
    setDialogOpen(true);
  }

  function handleSave() {
    const payload = {
      title: form.title,
      category: form.category,
      videoUrl: form.videoUrl || undefined,
      thumbnailUrl: form.thumbnailUrl || undefined,
      durationMinutes: parseInt(form.durationMinutes) || 0,
      description: form.description || undefined,
      isActive: form.isActive,
      orderIndex: parseInt(form.orderIndex) || 0,
    };
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── SVG helpers ───────────────────────────────────────────────────
  const IconSearch = `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
  const IconPlus = `<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
  const IconLeaf = `<svg viewBox="0 0 24 24"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`;
  const IconClock = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
  const IconEye = `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const IconPencil = `<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  const IconTrash = `<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;

  return (
    <AppLayout>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ucg-page">
        <div className="ucg-wrap">
          {/* Header */}
          <div className="ucg-header">
            <h1 className="ucg-title">Área de Descompressão</h1>
            <p className="ucg-subtitle">Gerencie atividades de bem-estar e relaxamento para seus colaboradores</p>
          </div>

          {/* Toolbar */}
          <div className="ucg-toolbar">
            <div className="ucg-search-wrap">
              <span className="ucg-search-icon" dangerouslySetInnerHTML={{ __html: IconSearch }} />
              <input
                className="ucg-search"
                placeholder="Buscar atividades..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="ucg-filters">
              {FILTER_PILLS.map((pill) => (
                <button
                  key={pill}
                  className={`ucg-pill${activeFilter === pill ? " active" : ""}`}
                  onClick={() => setActiveFilter(pill)}
                >
                  {pill}
                  {pillCounts[pill] !== undefined && (
                    <span className="ucg-cnt">{pillCounts[pill]}</span>
                  )}
                </button>
              ))}
            </div>
            <div className="ucg-actions">
              <button className="ucg-btn-primary" onClick={openCreate}>
                <span dangerouslySetInnerHTML={{ __html: IconPlus }} />
                Nova Atividade
              </button>
            </div>
          </div>

          {/* Grid */}
          <div className="ucg-grid">
            {videosQuery.isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="ucg-card">
                  <div className="ucg-thumb ucg-skel" style={{ aspectRatio: "16/9" }} />
                  <div className="ucg-body" style={{ gap: 8 }}>
                    <div className="ucg-skel" style={{ height: 16, width: "40%", borderRadius: 8 }} />
                    <div className="ucg-skel" style={{ height: 14, width: "80%" }} />
                    <div className="ucg-skel" style={{ height: 12, width: "60%" }} />
                  </div>
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="ucg-empty">
                <span dangerouslySetInnerHTML={{ __html: IconLeaf }} />
                <p>{search || activeFilter !== "Todas" ? "Nenhuma atividade encontrada" : "Nenhuma atividade cadastrada ainda"}</p>
                <small>{search || activeFilter !== "Todas" ? "Tente ajustar os filtros" : "Clique em \"Nova Atividade\" para começar"}</small>
              </div>
            ) : (
              filtered.map((v) => {
                const cat = decompCategory(v.category);
                return (
                  <div key={v.id} className="ucg-card" style={{ opacity: v.isActive ? 1 : 0.65 }}>
                    {/* Thumb */}
                    <div className="ucg-thumb" style={{ background: cat.grad }}>
                      {v.thumbnailUrl ? (
                        <img src={v.thumbnailUrl} alt={v.title} style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
                      ) : (
                        <div className="ucg-thumb-icon">
                          <span dangerouslySetInnerHTML={{ __html: IconLeaf }} />
                        </div>
                      )}
                      <span className={`ucg-status-badge ${v.isActive ? "ucg-sb-active" : "ucg-sb-inactive"}`}>
                        {v.isActive ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    {/* Body */}
                    <div className="ucg-body">
                      <span className="ucg-cat" style={{ background: cat.bg, color: cat.color }}>
                        {cat.label}
                      </span>
                      <p className="ucg-card-title">{v.title}</p>
                      {v.description && <p className="ucg-card-desc">{v.description}</p>}
                      <div className="ucg-meta">
                        {v.durationMinutes ? (
                          <span className="ucg-meta-item">
                            <span dangerouslySetInnerHTML={{ __html: IconClock }} />
                            {v.durationMinutes} min
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {/* Footer */}
                    <div className="ucg-footer">
                      <button
                        className="ucg-fb ucg-fg"
                        title={v.isActive ? "Desativar" : "Ativar"}
                        onClick={() => toggleActiveMutation.mutate({ id: v.id, isActive: !v.isActive })}
                      >
                        <span dangerouslySetInnerHTML={{ __html: IconEye }} />
                        {v.isActive ? "Desativar" : "Ativar"}
                      </button>
                      <button className="ucg-fb ucg-fp" onClick={() => openEdit(v)}>
                        <span dangerouslySetInnerHTML={{ __html: IconPencil }} />
                        Editar
                      </button>
                      <button className="ucg-fb ucg-fd" style={{ flex: "0 0 auto", padding: "7px 10px" }} onClick={() => setDeleteConfirmId(v.id)}>
                        <span dangerouslySetInnerHTML={{ __html: IconTrash }} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Lora', Georgia, serif" }}>
              {editingId !== null ? "Editar Atividade" : "Nova Atividade"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Título *</label>
              <Input
                placeholder="Ex: Yoga para Iniciantes"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Categoria *</label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as Category })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="respiracao">Respiração</SelectItem>
                  <SelectItem value="meditacao">Meditação</SelectItem>
                  <SelectItem value="yoga">Yoga</SelectItem>
                  <SelectItem value="outro">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">URL do Vídeo</label>
              <Input
                placeholder="https://youtu.be/... ou https://vimeo.com/..."
                value={form.videoUrl}
                onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">Suporta YouTube, Vimeo ou link direto de vídeo</p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">URL da Miniatura</label>
              <Input
                placeholder="https://..."
                value={form.thumbnailUrl}
                onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Duração (minutos)</label>
              <Input
                type="number"
                min="0"
                placeholder="15"
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Descrição</label>
              <Textarea
                placeholder="Breve descrição do conteúdo..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Ordem de exibição</label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={form.orderIndex}
                onChange={(e) => setForm({ ...form, orderIndex: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="w-4 h-4 accent-primary"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-foreground">
                Ativo (visível para colaboradores)
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={!form.title || isSaving}
              className="bg-primary text-primary-foreground"
            >
              {isSaving ? "Salvando..." : editingId !== null ? "Salvar Alterações" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover atividade?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteConfirmId !== null && deleteMutation.mutate({ id: deleteConfirmId })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Removendo..." : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
