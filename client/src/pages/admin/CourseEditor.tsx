import { useState, useRef, useEffect } from "react";
import { useParams } from "wouter";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { BlockRenderer } from "@/components/missao/blocks";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, Save, ImageIcon, Pencil, Trash2, Plus,
  Loader2, Sparkles, BookOpen, X, Check, MessageSquare, HelpCircle,
  PlayCircle, RefreshCw, Eye
} from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────
const BLOCK_TYPES = [
  { value: "concept", label: "Conceito", icon: BookOpen },
  { value: "example", label: "Exemplo", icon: Sparkles },
  { value: "multiple_choice", label: "Quiz", icon: HelpCircle },
  { value: "reflection", label: "Reflexão", icon: MessageSquare },
  { value: "video", label: "Vídeo", icon: PlayCircle },
];

function typeLabel(t: string) {
  return BLOCK_TYPES.find(b => b.value === t)?.label ?? t;
}

// ── Visual preview of each block (matches student view) ────────────────────
function BlockPreview({ block }: { block: any }) {
  const data = block.content || {};
  switch (block.type) {
    case "concept":
      return (
        <div className="flex flex-col items-center text-center w-full max-w-md mx-auto">
          {data.imageUrl && (
            <img src={data.imageUrl} alt="" className="w-40 h-40 sm:w-56 sm:h-56 object-cover rounded-3xl mb-6 shadow-md" />
          )}
          <h2 className="text-2xl font-extrabold mb-3 text-foreground">{data.title || "Conceito"}</h2>
          <p className="text-base text-muted-foreground leading-relaxed whitespace-pre-wrap">{data.body || "(sem conteúdo)"}</p>
        </div>
      );
    case "example":
      return (
        <div className="flex flex-col items-center w-full max-w-md mx-auto">
          {data.imageUrl && (
            <img src={data.imageUrl} alt="" className="w-40 h-40 sm:w-56 sm:h-56 object-cover rounded-3xl mb-4 shadow-md" />
          )}
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 mb-4 w-full">
            <p className="text-sm font-bold uppercase tracking-wider text-amber-700 mb-2">Exemplo</p>
            <p className="text-base text-foreground leading-relaxed">{data.scenario || "(sem cenário)"}</p>
          </div>
          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4 mb-4 w-full">
            <p className="text-sm font-bold uppercase tracking-wider text-emerald-700 mb-1">O que isso ensina</p>
            <p className="text-base text-foreground">{data.takeaway || "(sem aprendizado)"}</p>
          </div>
        </div>
      );
    case "multiple_choice":
      return (
        <div className="w-full max-w-md mx-auto">
          <h2 className="text-xl font-extrabold mb-6 text-foreground">{data.question || "Pergunta?"}</h2>
          <div className="space-y-3">
            {(data.options ?? []).map((opt: string, i: number) => {
              const isCorrect = i === data.correctIndex;
              return (
                <div
                  key={i}
                  className={`w-full text-left rounded-2xl p-4 text-base font-medium border-2 ${
                    isCorrect ? "border-emerald-500 bg-emerald-50" : "border-border bg-white"
                  }`}
                >
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-muted text-xs font-bold mr-3">
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                  {isCorrect && <Check size={14} className="inline ml-2 text-emerald-600" />}
                </div>
              );
            })}
          </div>
          {data.explanation && (
            <p className="mt-4 text-sm text-muted-foreground italic">💡 {data.explanation}</p>
          )}
        </div>
      );
    case "reflection":
      return (
        <div className="w-full max-w-md mx-auto bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-6 text-center">
          <MessageSquare size={32} className="mx-auto text-indigo-500 mb-3" />
          <p className="text-lg font-semibold text-indigo-900">{data.prompt || "(sem pergunta)"}</p>
        </div>
      );
    case "video":
      return (
        <div className="w-full max-w-md mx-auto">
          <div className="bg-slate-900 rounded-2xl p-8 text-center text-white">
            <PlayCircle size={48} className="mx-auto mb-3 opacity-70" />
            <p className="text-sm font-medium">{data.title || "Vídeo"}</p>
            <p className="text-xs opacity-60 mt-1 truncate">{data.url || "(sem URL)"}</p>
          </div>
        </div>
      );
    default:
      return <p className="text-sm text-muted-foreground">Bloco tipo desconhecido: {block.type}</p>;
  }
}

// ── Edit panel (modal-like inline) ─────────────────────────────────────────
function EditPanel({ block, onClose, onSaved }: {
  block: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [content, setContent] = useState<any>(block.content || {});
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenImg, setRegenImg] = useState(false);
  const [imgQuery, setImgQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const updateMut = trpc.courseEditor.updateBlock.useMutation();
  const uploadMut = trpc.courseEditor.uploadBlockImage.useMutation();
  const regenMut = trpc.courseEditor.regenerateBlock.useMutation();
  const regenImgMut = trpc.courseEditor.regenerateImage.useMutation();

  async function handleSave() {
    setSaving(true);
    try {
      await updateMut.mutateAsync({ blockId: block.id, content });
      toast.success("Salvo!");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      try {
        const r = await uploadMut.mutateAsync({ blockId: block.id, imageBase64: base64, mimeType: file.type });
        setContent((c: any) => ({ ...c, imageUrl: r.url }));
        toast.success("Imagem trocada!");
      } catch (e: any) {
        toast.error(e.message || "Erro ao enviar");
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleRegen() {
    if (!confirm("Regerar conteúdo deste bloco via IA? O texto atual será substituído.")) return;
    setRegenerating(true);
    try {
      const r = await regenMut.mutateAsync({ blockId: block.id });
      setContent(r.content);
      toast.success("Conteúdo regerado!");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Erro ao regerar");
    } finally {
      setRegenerating(false);
    }
  }

  async function handleRegenImage() {
    if (!imgQuery.trim()) { toast.error("Digite o que buscar"); return; }
    setRegenImg(true);
    try {
      const r = await regenImgMut.mutateAsync({ blockId: block.id, query: imgQuery });
      setContent((c: any) => ({ ...c, imageUrl: r.imageUrl }));
      setImgQuery("");
      toast.success("Imagem trocada!");
    } catch (e: any) {
      toast.error(e.message || "Erro");
    } finally {
      setRegenImg(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full my-8 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold flex items-center gap-2">
            <Pencil size={16} /> Editar {typeLabel(block.type)}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg"><X size={16} /></button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Image section (for blocks that support images) */}
          {(block.type === "concept" || block.type === "example") && (
            <div className="space-y-2 pb-4 border-b">
              <label className="text-xs font-semibold">Imagem</label>
              {content.imageUrl ? (
                <img src={content.imageUrl} alt="" className="w-full max-w-xs rounded-xl border" />
              ) : (
                <div className="w-full max-w-xs h-40 rounded-xl border border-dashed flex items-center justify-center text-muted-foreground">
                  <ImageIcon size={32} />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} className="gap-1 text-xs">
                  <ImageIcon size={12} /> Enviar do PC
                </Button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Buscar imagem (ex: trabalhador segurança)"
                  value={imgQuery}
                  onChange={e => setImgQuery(e.target.value)}
                  className="text-xs h-9"
                />
                <Button size="sm" variant="outline" onClick={handleRegenImage} disabled={regenImg} className="gap-1 text-xs whitespace-nowrap">
                  {regenImg ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  Buscar
                </Button>
              </div>
            </div>
          )}

          {/* Type-specific fields */}
          {block.type === "concept" && (
            <>
              <div>
                <label className="text-xs font-semibold mb-1 block">Título</label>
                <Input value={content.title ?? ""} onChange={e => setContent((c: any) => ({ ...c, title: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">Conteúdo</label>
                <Textarea rows={6} value={content.body ?? ""} onChange={e => setContent((c: any) => ({ ...c, body: e.target.value }))} />
              </div>
            </>
          )}

          {block.type === "example" && (
            <>
              <div>
                <label className="text-xs font-semibold mb-1 block">Cenário</label>
                <Textarea rows={4} value={content.scenario ?? ""} onChange={e => setContent((c: any) => ({ ...c, scenario: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">Aprendizado</label>
                <Textarea rows={3} value={content.takeaway ?? ""} onChange={e => setContent((c: any) => ({ ...c, takeaway: e.target.value }))} />
              </div>
            </>
          )}

          {block.type === "multiple_choice" && (
            <>
              <div>
                <label className="text-xs font-semibold mb-1 block">Pergunta</label>
                <Textarea rows={2} value={content.question ?? ""} onChange={e => setContent((c: any) => ({ ...c, question: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">Opções (a correta fica marcada)</label>
                <div className="space-y-2">
                  {(content.options ?? ["", "", "", ""]).map((opt: string, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correctIdx"
                        checked={content.correctIndex === i}
                        onChange={() => setContent((c: any) => ({ ...c, correctIndex: i }))}
                        className="w-4 h-4 accent-emerald-600"
                      />
                      <span className="w-6 text-xs font-bold text-muted-foreground">{String.fromCharCode(65 + i)}</span>
                      <Input
                        value={opt}
                        onChange={e => {
                          const opts = [...(content.options ?? [])];
                          opts[i] = e.target.value;
                          setContent((c: any) => ({ ...c, options: opts }));
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const opts = [...(content.options ?? [])];
                          opts.splice(i, 1);
                          setContent((c: any) => ({
                            ...c,
                            options: opts,
                            correctIndex: c.correctIndex === i ? 0 : c.correctIndex > i ? c.correctIndex - 1 : c.correctIndex,
                          }));
                        }}
                        className="text-rose-500 hover:bg-rose-50 p-1 rounded"
                        title="Remover opção"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setContent((c: any) => ({ ...c, options: [...(c.options ?? []), ""] }))}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <Plus size={12} /> Adicionar opção
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">Explicação (opcional)</label>
                <Textarea rows={2} value={content.explanation ?? ""} onChange={e => setContent((c: any) => ({ ...c, explanation: e.target.value }))} />
              </div>
            </>
          )}

          {block.type === "reflection" && (
            <div>
              <label className="text-xs font-semibold mb-1 block">Pergunta de reflexão</label>
              <Textarea rows={3} value={content.prompt ?? ""} onChange={e => setContent((c: any) => ({ ...c, prompt: e.target.value }))} />
            </div>
          )}

          {block.type === "video" && (
            <>
              <div>
                <label className="text-xs font-semibold mb-1 block">URL (YouTube/Vimeo)</label>
                <Input value={content.url ?? ""} onChange={e => setContent((c: any) => ({ ...c, url: e.target.value }))} placeholder="https://youtube.com/..." />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">Título</label>
                <Input value={content.title ?? ""} onChange={e => setContent((c: any) => ({ ...c, title: e.target.value }))} />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 p-4 border-t bg-muted/30">
          {(block.type === "concept" || block.type === "example" || block.type === "multiple_choice" || block.type === "reflection") && (
            <Button size="sm" variant="outline" onClick={handleRegen} disabled={regenerating} className="gap-1 text-xs">
              {regenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Regerar com IA
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Add block dropdown ─────────────────────────────────────────────────────
function AddBlockButton({ lessonId, afterBlockId, onAdded }: {
  lessonId: number;
  afterBlockId?: number;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const addMut = trpc.courseEditor.addBlock.useMutation();

  async function add(type: string) {
    try {
      await addMut.mutateAsync({ lessonId, type, afterBlockId });
      toast.success("Bloco adicionado!");
      onAdded();
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Erro");
    }
  }

  return (
    <div className="flex justify-center my-3 relative">
      <button
        onClick={() => setOpen(!open)}
        className="opacity-30 hover:opacity-100 transition-opacity text-xs flex items-center gap-1 bg-white border border-dashed border-border rounded-full px-3 py-1 hover:border-primary hover:text-primary"
      >
        <Plus size={12} /> Adicionar bloco aqui
      </button>
      {open && (
        <div className="absolute top-full mt-1 bg-white border border-border rounded-xl shadow-lg p-2 z-10 min-w-[160px]">
          {BLOCK_TYPES.map(bt => {
            const Icon = bt.icon;
            return (
              <button
                key={bt.value}
                onClick={() => add(bt.value)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted rounded-lg text-left"
              >
                <Icon size={12} /> {bt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ── Preview player: replicates student player experience ─────────────────
function PreviewPlayer({ lesson }: { lesson: any }) {
  const [idx, setIdx] = useState(0);
  const blocks = lesson.blocks ?? [];
  const total = blocks.length;
  const block = blocks[idx];

  // Reset when lesson changes
  useEffect(() => { setIdx(0); }, [lesson.id]);

  if (total === 0) {
    return (
      <div className="bg-white rounded-2xl border-2 border-dashed p-12 text-center text-sm text-muted-foreground">
        Esta aula não tem blocos. Volte ao modo Editar para adicionar.
      </div>
    );
  }

  function next() {
    if (idx + 1 < total) setIdx(idx + 1);
    else {
      // Loop back or stay - just show a completion state briefly
      setIdx(0);
    }
  }

  return (
    <div className="bg-white rounded-3xl border border-border shadow-sm overflow-hidden">
      <div className="p-6 sm:p-8">
        {/* Mini progress bar (matches student player) */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span className="truncate max-w-[60%]">{lesson.title}</span>
            <span>{idx + 1}/{total}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
              style={{ width: `${Math.round((idx / total) * 100)}%` }}
            />
          </div>
        </div>

        {/* Block - rendered with the REAL student renderer */}
        <div className="flex items-start justify-center py-2 min-h-[400px]">
          <BlockRenderer
            key={`${lesson.id}-${idx}`}
            type={block.type}
            data={block.content || {}}
            onAnswer={() => next()}
          />
        </div>
      </div>

      {/* Preview-only navigation footer */}
      <div className="bg-muted/30 border-t border-border px-4 py-3 flex items-center justify-between text-xs text-muted-foreground">
        <button
          onClick={() => setIdx(Math.max(0, idx - 1))}
          disabled={idx === 0}
          className="px-3 py-1 rounded hover:bg-muted disabled:opacity-30"
        >
          ← Bloco anterior
        </button>
        <span>Modo pré-visualização · Bloco {idx + 1} de {total}</span>
        <button
          onClick={() => setIdx(Math.min(total - 1, idx + 1))}
          disabled={idx >= total - 1}
          className="px-3 py-1 rounded hover:bg-muted disabled:opacity-30"
        >
          Próximo bloco →
        </button>
      </div>
    </div>
  );
}

// ── Single block card with preview + edit/delete overlay ───────────────────
function BlockCard({ block, lessonId, onChanged, previewMode }: {
  block: any;
  lessonId: number;
  onChanged: () => void;
  previewMode: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const deleteMut = trpc.courseEditor.deleteBlock.useMutation();

  async function del() {
    if (!confirm(`Tem certeza que deseja excluir este bloco "${typeLabel(block.type)}"? Esta ação é IRREVERSÍVEL.`)) return;
    try {
      await deleteMut.mutateAsync({ blockId: block.id });
      toast.success("Bloco excluído");
      onChanged();
    } catch (e: any) {
      toast.error(e.message || "Erro");
    }
  }

  return (
    <>
      <div className={`group relative ${previewMode ? "py-8" : "bg-white border border-border rounded-2xl p-6 hover:border-primary/30 hover:shadow-sm transition-all"}`}>
        {/* Type badge - only in edit mode */}
        {!previewMode && (
          <div className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
            {typeLabel(block.type)}
          </div>
        )}

        {/* Action overlay (visible on hover) - hidden in preview */}
        {!previewMode && (
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 bg-white border border-border rounded-lg hover:bg-primary hover:text-white hover:border-primary shadow-sm"
              title="Editar"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={del}
              className="p-1.5 bg-white border border-border rounded-lg hover:bg-rose-500 hover:text-white hover:border-rose-500 shadow-sm"
              title="Excluir"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}

        {/* Preview */}
        <div className={previewMode ? "" : "pt-4"}>
          <BlockPreview block={block} />
        </div>
      </div>

      {editing && (
        <EditPanel
          block={block}
          onClose={() => setEditing(false)}
          onSaved={onChanged}
        />
      )}
    </>
  );
}

// ── Main CourseEditor ──────────────────────────────────────────────────────
export default function CourseEditor() {
  const params = useParams<{ id: string }>();
  const moduleId = Number(params.id);

  const blocksQ = trpc.courseEditor.getBlocks.useQuery({ moduleId }, { enabled: !!moduleId });
  const moduleQ = trpc.courseEditor.getModuleMeta.useQuery({ moduleId }, { enabled: !!moduleId });
  const utils = trpc.useUtils();

  const units = (blocksQ.data ?? []) as any[];
  // Flatten all lessons across units, in order
  const allLessons: any[] = [];
  units.forEach(u => (u.lessons ?? []).forEach((l: any) => allLessons.push({ ...l, unitTitle: u.title })));

  const [activeIdx, setActiveIdx] = useState(0);
  const [previewMode, setPreviewMode] = useState(false);
  const activeLesson = allLessons[activeIdx];

  function refresh() {
    utils.courseEditor.getBlocks.invalidate({ moduleId });
  }

  // Keep activeIdx valid after delete/add
  useEffect(() => {
    if (activeIdx >= allLessons.length && allLessons.length > 0) {
      setActiveIdx(allLessons.length - 1);
    }
  }, [allLessons.length, activeIdx]);

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-6xl mx-auto p-6 space-y-4">

          {/* Header */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Eye size={12} /> Editor visual de conteúdo
              </div>
              <h1 className="text-2xl font-bold text-primary" style={{ fontFamily: "'Playfair Display', serif" }}>
                {moduleQ.data?.title || "Editor de Conteúdo"}
              </h1>
              {moduleQ.data?.description && (
                <p className="text-sm text-muted-foreground max-w-2xl mt-1">{moduleQ.data.description}</p>
              )}
            </div>
            <div className="inline-flex rounded-xl bg-muted p-1 gap-1">
              <button
                onClick={() => setPreviewMode(false)}
                className={"px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 " + (!previewMode ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                <Pencil size={12} /> Editar
              </button>
              <button
                onClick={() => setPreviewMode(true)}
                className={"px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 " + (previewMode ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                <Eye size={12} /> Pré-visualizar
              </button>
            </div>
          </div>

          {blocksQ.isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="animate-spin text-primary" />
            </div>
          )}

          {!blocksQ.isLoading && allLessons.length === 0 && (
            <div className="bg-white rounded-2xl border p-12 text-center">
              <BookOpen size={40} className="mx-auto text-muted-foreground opacity-40 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma aula encontrada neste curso.</p>
            </div>
          )}

          {allLessons.length > 0 && activeLesson && (
            <>
              {/* Lesson navigator */}
              <div className="bg-white rounded-2xl border p-3 flex items-center gap-2">
                <button
                  onClick={() => setActiveIdx(Math.max(0, activeIdx - 1))}
                  disabled={activeIdx === 0}
                  className="p-2 rounded-lg hover:bg-muted disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                </button>
                <select
                  value={activeIdx}
                  onChange={e => setActiveIdx(Number(e.target.value))}
                  className="flex-1 px-3 py-2 rounded-lg bg-muted/30 text-sm font-medium border-0 focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {allLessons.map((l, i) => (
                    <option key={l.id} value={i}>
                      Aula {i + 1}/{allLessons.length} — {l.title}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setActiveIdx(Math.min(allLessons.length - 1, activeIdx + 1))}
                  disabled={activeIdx >= allLessons.length - 1}
                  className="p-2 rounded-lg hover:bg-muted disabled:opacity-30"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Active lesson info */}
              <div className="text-center py-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{activeLesson.unitTitle}</p>
                <h2 className="text-xl font-bold text-foreground">{activeLesson.title}</h2>
                {!previewMode && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {activeLesson.blocks?.length ?? 0} {(activeLesson.blocks?.length ?? 0) === 1 ? "bloco" : "blocos"}
                  </p>
                )}
              </div>

              {/* Render either Preview Player or Edit list */}
              {previewMode ? (
                <PreviewPlayer lesson={activeLesson} />
              ) : (
                <div className="space-y-2">
                  <AddBlockButton lessonId={activeLesson.id} onAdded={refresh} />
                  {(activeLesson.blocks ?? []).map((block: any) => (
                    <div key={block.id}>
                      <BlockCard block={block} lessonId={activeLesson.id} onChanged={refresh} previewMode={false} />
                      <AddBlockButton lessonId={activeLesson.id} afterBlockId={block.id} onAdded={refresh} />
                    </div>
                  ))}
                  {(activeLesson.blocks ?? []).length === 0 && (
                    <div className="bg-white rounded-2xl border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
                      Aula vazia — clique em "Adicionar bloco" acima para começar.
                    </div>
                  )}
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </AppLayout>
  );
}
