import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, BookOpen, Video, Award, ChevronDown,
  ChevronUp, Eye, EyeOff, GripVertical, X, Check, Search,
  MoreVertical, Sparkles, Clock, Code2
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
.ucg-lesson-panel{grid-column:1/-1;background:#fff;border:1.5px solid #E9EDF2;border-radius:16px;overflow:hidden;margin-top:-4px}
.ucg-lesson-panel-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #EFF2F6;background:#F8FAFC}
.ucg-lesson-panel-title{font-size:13px;font-weight:700;color:#0E2C46;display:flex;align-items:center;gap:8px}
.ucg-lesson-item{display:flex;align-items:center;gap:12px;padding:11px 18px;border-bottom:1px solid #EFF2F6}
.ucg-lesson-item:last-child{border-bottom:none}
.ucg-lesson-num{width:26px;height:26px;border-radius:8px;background:rgba(14,44,70,.08);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#0E2C46;flex-shrink:0}
.ucg-filters-row{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
`;

/* ─── Types ─────────────────────────────────────────────── */
type ModuleForm = {
  title: string; description: string; durationMinutes: string;
  orderIndex: string; isActive: boolean;
  certTitle: string; certBody: string; certSignerName: string; certSignerRole: string;
};
type LessonForm = {
  title: string; description: string; videoUrl: string;
  durationMinutes: string; orderIndex: string; isActive: boolean;
};

const emptyModuleForm: ModuleForm = {
  title: "", description: "", durationMinutes: "0", orderIndex: "0", isActive: true,
  certTitle: "Certificado de Conclusão",
  certBody: "Certificamos que o(a) participante concluiu com êxito o módulo de treinamento em saúde mental e bem-estar corporativo.",
  certSignerName: "", certSignerRole: "",
};
const emptyLessonForm: LessonForm = {
  title: "", description: "", videoUrl: "", durationMinutes: "0", orderIndex: "0", isActive: true,
};

/* ─── Category helpers (unified pattern) ────────────────── */
function courseCategory(title: string): { label: string; bg: string; color: string; grad: string } {
  const t = (title || '').toLowerCase();
  if (t.includes('nr-01') || t.includes('nr01') || t.includes('risco') || t.includes('pgr') || t.includes('gro')) return { label: 'NR-01', bg: 'rgba(46,165,106,.12)', color: '#228A57', grad: 'linear-gradient(135deg,#0E2C46,#2EA56A)' };
  if (t.includes('mental') || t.includes('burnout') || t.includes('estresse') || t.includes('psico') || t.includes('bem-estar')) return { label: 'Saúde Mental', bg: 'rgba(124,58,237,.12)', color: '#7C3AED', grad: 'linear-gradient(135deg,#1a7a6e,#6b21a8)' };
  if (t.includes('segurança') || t.includes('acidente') || t.includes('epi') || t.includes('epc') || t.includes('prevenção')) return { label: 'Segurança', bg: 'rgba(217,119,6,.12)', color: '#D97706', grad: 'linear-gradient(135deg,#0E2C46,#E8B23E)' };
  if (t.includes('liderança') || t.includes('gestão') || t.includes('comunicação') || t.includes('assertiva')) return { label: 'Liderança', bg: 'rgba(30,111,168,.12)', color: '#1e6fa8', grad: 'linear-gradient(135deg,#0E2C46,#1e6fa8)' };
  if (t.includes('ergonomia') || t.includes('postura') || t.includes('lombar')) return { label: 'Ergonomia', bg: 'rgba(14,116,144,.12)', color: '#0e7490', grad: 'linear-gradient(135deg,#0E2C46,#1a5c7a)' };
  if (t.includes('diversidade') || t.includes('inclusão') || t.includes('assédio')) return { label: 'Compliance', bg: 'rgba(239,68,68,.12)', color: '#DC2626', grad: 'linear-gradient(135deg,#7f1d1d,#EF4444)' };
  return { label: 'Outros', bg: 'rgba(100,116,139,.12)', color: '#475569', grad: 'linear-gradient(135deg,#334155,#475569)' };
}
function courseFilterKey(title: string): string { return courseCategory(title).label; }

/* ─── Status badge helper ────────────────────────────────── */
function statusBadge(mod: any): { label: string; cls: string } {
  const ps = (mod as any).publishStatus ?? "published";
  if (ps === "draft") return { label: "Rascunho", cls: "ucg-sb-draft" };
  if (ps === "review") return { label: "Em revisão", cls: "ucg-sb-review" };
  if (ps === "approved") return { label: "Aprovado", cls: "ucg-sb-approved" };
  if (!mod.isActive) return { label: "Inativo", cls: "ucg-sb-inactive" };
  return { label: "Ativo", cls: "ucg-sb-active" };
}

/* ─── Kebab menu ─────────────────────────────────────────── */
function KebabMenu({ onEdit, onEditContent, onDelete, onToggle, isActive }: {
  onEdit: () => void; onEditContent: () => void; onDelete: () => void; onToggle: () => void; isActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        className="ucg-fb ucg-fg"
        style={{ flex: "none", width: 32, padding: "7px 6px" }}
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        title="Mais ações"
      >
        <MoreVertical size={13} style={{ stroke: "currentColor", fill: "none", strokeWidth: 2 }} />
      </button>
      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 999 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: "absolute", right: 0, bottom: "calc(100% + 6px)", zIndex: 1000,
            background: "#fff", border: "1.5px solid #E0E6ED", borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,.12)", minWidth: 160, overflow: "hidden",
          }}>
            <button
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 14px", fontSize: 13, fontWeight: 600, color: "#0E2C46", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
              onClick={e => { e.stopPropagation(); onEdit(); setOpen(false); }}
            >
              <Pencil size={13} /> Editar informacoes
            </button>
            <button
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 14px", fontSize: 13, fontWeight: 600, color: "#0E2C46", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
              onClick={e => { e.stopPropagation(); onEditContent(); setOpen(false); }}
            >
              <Code2 size={13} /> Alterar conteudo
            </button>
            <button
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 14px", fontSize: 13, fontWeight: 600, color: "#0E2C46", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
              onClick={e => { e.stopPropagation(); onToggle(); setOpen(false); }}
            >
              {isActive ? <EyeOff size={13} /> : <Eye size={13} />}
              {isActive ? "Desativar" : "Ativar"}
            </button>
            <div style={{ borderTop: "1px solid #EFF2F6" }} />
            <button
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 14px", fontSize: 13, fontWeight: 600, color: "#b83225", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
              onClick={e => { e.stopPropagation(); onDelete(); setOpen(false); }}
            >
              <Trash2 size={13} /> Excluir
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────── */
export default function AdminModules() {
  const [, navigate] = useLocation();
  const modulesQuery = trpc.admin.listModules.useQuery();
  const utils = trpc.useUtils();

  /* Module state */
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<number | null>(null);
  const [moduleForm, setModuleForm] = useState<ModuleForm>(emptyModuleForm);
  const [deleteModuleId, setDeleteModuleId] = useState<number | null>(null);

  /* Lesson / expand state */
  const [expandedModuleId, setExpandedModuleId] = useState<number | null>(null);
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);
  const [lessonDialogModuleId, setLessonDialogModuleId] = useState<number | null>(null);
  const [editingLessonId, setEditingLessonId] = useState<number | null>(null);
  const [lessonForm, setLessonForm] = useState<LessonForm>(emptyLessonForm);
  const [deleteLessonId, setDeleteLessonId] = useState<number | null>(null);
  const [previewCert, setPreviewCert] = useState(false);

  /* Filter / search state */
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("Todos");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "draft">("all");

  /* Mutations */
  const createModuleMutation = trpc.admin.createModule.useMutation({
    onSuccess: () => {
      toast.success("Módulo criado!"); utils.admin.listModules.invalidate(); utils.modules.list.invalidate();
      setModuleDialogOpen(false); setModuleForm(emptyModuleForm);
    },
    onError: (e) => toast.error(e.message),
  });
  const updateModuleMutation = trpc.admin.updateModuleAdmin.useMutation({
    onSuccess: () => {
      toast.success("Módulo atualizado!"); utils.admin.listModules.invalidate(); utils.modules.list.invalidate();
      setModuleDialogOpen(false); setEditingModuleId(null); setModuleForm(emptyModuleForm);
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteModuleMutation = trpc.admin.deleteModule.useMutation({
    onSuccess: () => {
      toast.success("Módulo excluído."); utils.admin.listModules.invalidate(); utils.modules.list.invalidate();
      setDeleteModuleId(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const toggleModuleMutation = trpc.admin.updateModuleAdmin.useMutation({
    onSuccess: () => { utils.admin.listModules.invalidate(); utils.modules.list.invalidate(); },
  });

  const lessonsQuery = trpc.admin.listLessons.useQuery(
    { moduleId: expandedModuleId! },
    { enabled: expandedModuleId !== null }
  );
  const createLessonMutation = trpc.admin.createLesson.useMutation({
    onSuccess: () => {
      toast.success("Aula adicionada!"); utils.admin.listLessons.invalidate({ moduleId: lessonDialogModuleId! });
      setLessonDialogOpen(false); setLessonForm(emptyLessonForm); setEditingLessonId(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const updateLessonMutation = trpc.admin.updateLesson.useMutation({
    onSuccess: () => {
      toast.success("Aula atualizada!"); utils.admin.listLessons.invalidate({ moduleId: lessonDialogModuleId! });
      setLessonDialogOpen(false); setLessonForm(emptyLessonForm); setEditingLessonId(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteLessonMutation = trpc.admin.deleteLesson.useMutation({
    onSuccess: () => {
      toast.success("Aula removida."); utils.admin.listLessons.invalidate({ moduleId: expandedModuleId! });
      setDeleteLessonId(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const toggleLessonMutation = trpc.admin.updateLesson.useMutation({
    onSuccess: () => utils.admin.listLessons.invalidate({ moduleId: expandedModuleId! }),
  });

  const modules = modulesQuery.data ?? [];

  /* Handlers */
  function openCreateModule() {
    setEditingModuleId(null); setModuleForm(emptyModuleForm); setModuleDialogOpen(true);
  }
  function openEditModule(mod: typeof modules[0]) {
    setEditingModuleId(mod.id);
    setModuleForm({
      title: mod.title, description: mod.description ?? "",
      durationMinutes: String(mod.durationMinutes ?? 0), orderIndex: String(mod.orderIndex),
      isActive: mod.isActive,
      certTitle: (mod as any).certTitle ?? "Certificado de Conclusão",
      certBody: (mod as any).certBody ?? "Certificamos que o(a) participante concluiu com êxito o módulo de treinamento em saúde mental e bem-estar corporativo.",
      certSignerName: (mod as any).certSignerName ?? "",
      certSignerRole: (mod as any).certSignerRole ?? "",
    });
    setModuleDialogOpen(true);
  }
  function handleSaveModule() {
    const payload = {
      title: moduleForm.title, description: moduleForm.description || undefined,
      durationMinutes: parseInt(moduleForm.durationMinutes) || 0,
      orderIndex: parseInt(moduleForm.orderIndex) || 0, isActive: moduleForm.isActive,
      certTitle: moduleForm.certTitle || undefined, certBody: moduleForm.certBody || undefined,
      certSignerName: moduleForm.certSignerName || undefined, certSignerRole: moduleForm.certSignerRole || undefined,
    };
    if (editingModuleId !== null) updateModuleMutation.mutate({ id: editingModuleId, ...payload });
    else createModuleMutation.mutate(payload);
  }

  function openCreateLesson(moduleId: number) {
    setLessonDialogModuleId(moduleId); setEditingLessonId(null);
    setLessonForm(emptyLessonForm); setLessonDialogOpen(true);
  }
  function openEditLesson(lesson: NonNullable<typeof lessonsQuery.data>[0]) {
    setLessonDialogModuleId(lesson.moduleId); setEditingLessonId(lesson.id);
    setLessonForm({
      title: lesson.title, description: lesson.description ?? "",
      videoUrl: lesson.videoUrl ?? "", durationMinutes: String(lesson.durationMinutes ?? 0),
      orderIndex: String(lesson.orderIndex), isActive: lesson.isActive,
    });
    setLessonDialogOpen(true);
  }
  function handleSaveLesson() {
    const payload = {
      title: lessonForm.title, description: lessonForm.description || undefined,
      videoUrl: lessonForm.videoUrl || undefined,
      durationMinutes: parseInt(lessonForm.durationMinutes) || 0,
      orderIndex: parseInt(lessonForm.orderIndex) || 0, isActive: lessonForm.isActive,
    };
    if (editingLessonId !== null) updateLessonMutation.mutate({ id: editingLessonId, ...payload });
    else if (lessonDialogModuleId) createLessonMutation.mutate({ moduleId: lessonDialogModuleId, ...payload });
  }

  const isSavingModule = createModuleMutation.isPending || updateModuleMutation.isPending;
  const isSavingLesson = createLessonMutation.isPending || updateLessonMutation.isPending;

  /* Category filter keys */
  const CAT_PILLS = ["Todos", "NR-01", "Saúde Mental", "Segurança", "Liderança", "Ergonomia", "Compliance", "Outros"];
  const STATUS_PILLS: { key: typeof statusFilter; label: string }[] = [
    { key: "all", label: "Todos os status" },
    { key: "active", label: "Ativos" },
    { key: "inactive", label: "Inativos" },
    { key: "draft", label: "Rascunhos" },
  ];

  /* Filtered list */
  const filtered = modules.filter(mod => {
    const ps = (mod as any).publishStatus ?? "published";
    const matchSearch = !search || mod.title.toLowerCase().includes(search.toLowerCase()) || (mod.description ?? "").toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "Todos" || courseFilterKey(mod.title) === catFilter;
    const matchStatus =
      statusFilter === "all" ? true :
      statusFilter === "active" ? mod.isActive && ps !== "draft" :
      statusFilter === "inactive" ? !mod.isActive :
      statusFilter === "draft" ? ps === "draft" : true;
    return matchSearch && matchCat && matchStatus;
  });

  /* Category counts */
  const catCounts: Record<string, number> = { Todos: modules.length };
  for (const m of modules) {
    const k = courseFilterKey(m.title);
    catCounts[k] = (catCounts[k] ?? 0) + 1;
  }
  const statusCounts = {
    all: modules.length,
    active: modules.filter(m => m.isActive && ((m as any).publishStatus ?? "published") !== "draft").length,
    inactive: modules.filter(m => !m.isActive).length,
    draft: modules.filter(m => ((m as any).publishStatus ?? "published") === "draft").length,
  };

  return (
    <AppLayout>
      <style dangerouslySetInnerHTML={{ __html: SHARED_CSS }} />

      <div className="ucg-page">
        <div className="ucg-wrap">
          {/* Header */}
          <div className="ucg-header">
            <h1 className="ucg-title">Gestão de Cursos</h1>
            <p className="ucg-subtitle">Crie, edite e publique cursos preventivos para sua empresa</p>
          </div>

          {/* Toolbar */}
          <div className="ucg-toolbar">
            <div className="ucg-search-wrap">
              <svg className="ucg-search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                className="ucg-search"
                placeholder="Buscar cursos..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="ucg-actions">
              <button className="ucg-btn-ghost" onClick={openCreateModule}>
                <Plus size={14} /> Novo curso
              </button>
              <button
                className="ucg-btn-primary"
                onClick={() => navigate("/admin/ai-studio")}
              >
                <Sparkles size={14} /> Estúdio de Criação
              </button>
            </div>
          </div>

          {/* Category filter pills — row 1 */}
          <div className="ucg-filters-row">
            {CAT_PILLS.map(cat => (
              <button
                key={cat}
                className={`ucg-pill${catFilter === cat ? " active" : ""}`}
                onClick={() => setCatFilter(cat)}
              >
                {cat}
                <span className="ucg-cnt">{catCounts[cat] ?? 0}</span>
              </button>
            ))}
          </div>

          {/* Status filter pills — row 2 */}
          <div className="ucg-filters-row" style={{ marginBottom: 20 }}>
            {STATUS_PILLS.map(p => (
              <button
                key={p.key}
                className={`ucg-pill${statusFilter === p.key ? " active" : ""}`}
                onClick={() => setStatusFilter(p.key)}
              >
                {p.label}
                <span className="ucg-cnt">{statusCounts[p.key]}</span>
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="ucg-grid">
            {modulesQuery.isLoading ? (
              [1,2,3,4].map(i => (
                <div key={i} className="ucg-card" style={{ cursor: "default" }}>
                  <div className="ucg-skel" style={{ aspectRatio: "16/9" }} />
                  <div className="ucg-body" style={{ gap: 10 }}>
                    <div className="ucg-skel" style={{ height: 14, borderRadius: 6 }} />
                    <div className="ucg-skel" style={{ height: 12, borderRadius: 6, width: "70%" }} />
                    <div className="ucg-skel" style={{ height: 10, borderRadius: 6, width: "40%" }} />
                  </div>
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="ucg-empty">
                <BookOpen />
                <p>{search || catFilter !== "Todos" || statusFilter !== "all" ? "Nenhum curso encontrado." : "Nenhum módulo cadastrado."}</p>
                <small>{search || catFilter !== "Todos" || statusFilter !== "all" ? "Tente ajustar os filtros." : "Clique em \"Novo curso\" para começar."}</small>
              </div>
            ) : (
              filtered.map(mod => {
                const isExpanded = expandedModuleId === mod.id;
                const sb = statusBadge(mod);
                const cat = courseCategory(mod.title);
                const lessons = isExpanded ? (lessonsQuery.data ?? []) : [];
                return (
                  <>
                    <div
                      key={mod.id}
                      className="ucg-card"
                      style={{ opacity: !mod.isActive && ((mod as any).publishStatus ?? "published") !== "draft" ? 0.75 : 1 }}
                    >
                      {/* Thumb */}
                      <div className="ucg-thumb" style={{ background: cat.grad }}>
                        <div className="ucg-thumb-icon">
                          <BookOpen size={24} style={{ stroke: "#fff", fill: "none", strokeWidth: 1.8 }} />
                        </div>
                        <span className={`ucg-status-badge ${sb.cls}`}>{sb.label}</span>
                      </div>

                      {/* Body */}
                      <div className="ucg-body">
                        <span className="ucg-cat" style={{ background: cat.bg, color: cat.color }}>{cat.label}</span>
                        <p className="ucg-card-title">{mod.title}</p>
                        {mod.description && <p className="ucg-card-desc">{mod.description}</p>}
                        <div className="ucg-meta">
                          {mod.durationMinutes ? (
                            <span className="ucg-meta-item">
                              <Clock size={11} />
                              {mod.durationMinutes} min
                            </span>
                          ) : null}
                          {((mod as any).certSignerName || (mod as any).certTitle) && (
                            <span className="ucg-meta-item" style={{ color: "#a07a10" }}>
                              <Award size={11} />
                              Certificado
                            </span>
                          )}
                        </div>

                        {/* Footer */}
                        <div className="ucg-footer" onClick={e => e.stopPropagation()}>
                          <button
                            className="ucg-fb ucg-fp"
                            onClick={e => { e.stopPropagation(); setExpandedModuleId(isExpanded ? null : mod.id); }}
                          >
                            <Video size={12} />
                            Ver aulas
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                          <button
                            className="ucg-fb ucg-fg"
                            onClick={e => { e.stopPropagation(); openEditModule(mod); }}
                          >
                            <Pencil size={12} />
                            Editar
                          </button>
                          <KebabMenu
                            isActive={mod.isActive}
                            onEdit={() => openEditModule(mod)}
                            onEditContent={() => navigate(`/admin/cursos/${mod.id}/editar`)}
                            onDelete={() => setDeleteModuleId(mod.id)}
                            onToggle={() => toggleModuleMutation.mutate({ id: mod.id, isActive: !mod.isActive })}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Expanded lesson panel — spans full grid row */}
                    {isExpanded && (
                      <div key={`lessons-${mod.id}`} className="ucg-lesson-panel">
                        <div className="ucg-lesson-panel-header">
                          <span className="ucg-lesson-panel-title">
                            <Video size={14} style={{ color: "#2EA56A" }} />
                            Aulas — {mod.title}
                            <span style={{ fontWeight: 500, color: "#92A0AC", fontSize: 12 }}>
                              {lessonsQuery.isLoading ? "(carregando...)" : `(${lessons.length} aula${lessons.length !== 1 ? "s" : ""})`}
                            </span>
                          </span>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button className="ucg-btn-primary" style={{ padding: "7px 14px", fontSize: 12 }}
                              onClick={() => openCreateLesson(mod.id)}>
                              <Plus size={13} /> Adicionar Aula
                            </button>
                            <button className="ucg-btn-ghost" style={{ padding: "7px 12px", fontSize: 12 }}
                              onClick={() => setExpandedModuleId(null)}>
                              <X size={13} />
                            </button>
                          </div>
                        </div>

                        {lessons.length === 0 && !lessonsQuery.isLoading ? (
                          <div style={{ textAlign: "center", padding: "32px 20px", color: "#92A0AC", fontSize: 13 }}>
                            <Video size={24} style={{ margin: "0 auto 10px", opacity: .35 }} />
                            <p>Nenhuma aula cadastrada. Clique em "Adicionar Aula" para começar.</p>
                          </div>
                        ) : (
                          lessons.map(lesson => (
                            <div key={lesson.id} className="ucg-lesson-item" style={{ opacity: !lesson.isActive ? 0.6 : 1 }}>
                              <GripVertical size={14} style={{ color: "#C8D1DA", flexShrink: 0 }} />
                              <div className="ucg-lesson-num">{lesson.orderIndex + 1}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <p style={{ fontSize: 13, fontWeight: 600, color: "#0E2C46", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lesson.title}</p>
                                  {!lesson.isActive && <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 6, background: "rgba(184,50,37,.12)", color: "#b83225", fontWeight: 700 }}>Inativa</span>}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "#92A0AC", marginTop: 2 }}>
                                  {lesson.durationMinutes ? <span>{lesson.durationMinutes} min</span> : null}
                                  {lesson.videoUrl ? (
                                    <span style={{ color: "#228A57", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                                      <Check size={11} /> Vídeo configurado
                                    </span>
                                  ) : (
                                    <span style={{ color: "#a07a10" }}>Sem vídeo</span>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                                <button
                                  style={{ width: 30, height: 30, borderRadius: 8, background: "#F4F6F9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#62707D" }}
                                  onClick={() => toggleLessonMutation.mutate({ id: lesson.id, isActive: !lesson.isActive })}
                                  title={lesson.isActive ? "Desativar" : "Ativar"}
                                >
                                  {lesson.isActive ? <Eye size={13} /> : <EyeOff size={13} />}
                                </button>
                                <button
                                  style={{ width: 30, height: 30, borderRadius: 8, background: "#F4F6F9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#0E2C46" }}
                                  onClick={() => openEditLesson(lesson)}
                                  title="Editar"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(184,50,37,.08)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#b83225" }}
                                  onClick={() => setDeleteLessonId(lesson.id)}
                                  title="Excluir"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Module Dialog ── */}
      <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Lora', Georgia, serif" }}>
              {editingModuleId !== null ? "Editar Módulo" : "Novo Módulo"}
            </DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="info">
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1 gap-2"><BookOpen size={14} /> Informações</TabsTrigger>
              <TabsTrigger value="cert" className="flex-1 gap-2"><Award size={14} /> Certificado</TabsTrigger>
            </TabsList>
            <TabsContent value="info" className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Título do Módulo *</label>
                <Input placeholder="Ex: Gestão do Estresse e Prevenção ao Burnout"
                  value={moduleForm.title} onChange={e => setModuleForm({ ...moduleForm, title: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Descrição</label>
                <Textarea placeholder="Descreva o conteúdo e objetivos deste módulo..."
                  value={moduleForm.description} onChange={e => setModuleForm({ ...moduleForm, description: e.target.value })} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Duração (minutos)</label>
                  <Input type="number" min="0" value={moduleForm.durationMinutes}
                    onChange={e => setModuleForm({ ...moduleForm, durationMinutes: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Ordem de exibição</label>
                  <Input type="number" min="0" value={moduleForm.orderIndex}
                    onChange={e => setModuleForm({ ...moduleForm, orderIndex: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="moduleActive" checked={moduleForm.isActive}
                  onChange={e => setModuleForm({ ...moduleForm, isActive: e.target.checked })} className="w-4 h-4 accent-primary" />
                <label htmlFor="moduleActive" className="text-sm cursor-pointer">Módulo ativo (visível para os funcionários)</label>
              </div>
            </TabsContent>
            <TabsContent value="cert" className="space-y-4 pt-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                Configure o certificado emitido ao concluir 100% deste módulo. O nome do funcionário é adicionado automaticamente.
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Título do Certificado</label>
                <Input placeholder="Certificado de Conclusão" value={moduleForm.certTitle}
                  onChange={e => setModuleForm({ ...moduleForm, certTitle: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Texto do Certificado</label>
                <Textarea placeholder="Certificamos que o(a) participante concluiu com êxito..."
                  value={moduleForm.certBody} onChange={e => setModuleForm({ ...moduleForm, certBody: e.target.value })} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Nome do Responsável</label>
                  <Input placeholder="Ex: Dra. Ana Paula Silva" value={moduleForm.certSignerName}
                    onChange={e => setModuleForm({ ...moduleForm, certSignerName: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Cargo / Função</label>
                  <Input placeholder="Ex: Coordenadora de RH" value={moduleForm.certSignerRole}
                    onChange={e => setModuleForm({ ...moduleForm, certSignerRole: e.target.value })} />
                </div>
              </div>
              <Button variant="outline" className="gap-2 w-full" onClick={() => setPreviewCert(true)}>
                <Eye size={14} /> Pré-visualizar Certificado
              </Button>
            </TabsContent>
          </Tabs>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setModuleDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveModule} disabled={isSavingModule || !moduleForm.title.trim()}
              className="bg-primary text-primary-foreground">
              {isSavingModule ? "Salvando..." : editingModuleId !== null ? "Salvar Alterações" : "Criar Módulo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Lesson Dialog ── */}
      <Dialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Lora', Georgia, serif" }}>
              {editingLessonId !== null ? "Editar Aula" : "Nova Aula"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Título da Aula *</label>
              <Input placeholder="Ex: Introdução à Gestão do Estresse"
                value={lessonForm.title} onChange={e => setLessonForm({ ...lessonForm, title: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Descrição</label>
              <Textarea placeholder="Descreva o conteúdo desta aula..."
                value={lessonForm.description} onChange={e => setLessonForm({ ...lessonForm, description: e.target.value })} rows={2} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">URL do Vídeo</label>
              <Input placeholder="https://youtu.be/... ou https://vimeo.com/..."
                value={lessonForm.videoUrl} onChange={e => setLessonForm({ ...lessonForm, videoUrl: e.target.value })} />
              <p className="text-xs text-muted-foreground mt-1">Suporta YouTube, Vimeo ou link direto (.mp4, .webm)</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Duração (min)</label>
                <Input type="number" min="0" value={lessonForm.durationMinutes}
                  onChange={e => setLessonForm({ ...lessonForm, durationMinutes: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Ordem</label>
                <Input type="number" min="0" value={lessonForm.orderIndex}
                  onChange={e => setLessonForm({ ...lessonForm, orderIndex: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="lessonActive" checked={lessonForm.isActive}
                onChange={e => setLessonForm({ ...lessonForm, isActive: e.target.checked })} className="w-4 h-4 accent-primary" />
              <label htmlFor="lessonActive" className="text-sm cursor-pointer">Aula ativa (visível para os funcionários)</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLessonDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveLesson} disabled={isSavingLesson || !lessonForm.title.trim()}
              className="bg-primary text-primary-foreground">
              {isSavingLesson ? "Salvando..." : editingLessonId !== null ? "Salvar Aula" : "Adicionar Aula"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Module ── */}
      <AlertDialog open={deleteModuleId !== null} onOpenChange={open => !open && setDeleteModuleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Módulo</AlertDialogTitle>
            <AlertDialogDescription>Esta ação é irreversível. O módulo, todas as suas aulas e o progresso dos funcionários serão excluídos permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteModuleId !== null && deleteModuleMutation.mutate({ id: deleteModuleId })}>
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete Lesson ── */}
      <AlertDialog open={deleteLessonId !== null} onOpenChange={open => !open && setDeleteLessonId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Aula</AlertDialogTitle>
            <AlertDialogDescription>Esta aula será removida permanentemente do módulo.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteLessonId !== null && deleteLessonMutation.mutate({ id: deleteLessonId })}>
              Excluir Aula
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Certificate Preview ── */}
      {previewCert && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setPreviewCert(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="relative p-10 text-center"
              style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #f0f7f4 50%, #e8f4f8 100%)" }}>
              <div className="absolute inset-4 border-2 border-[#1e3a5f] rounded-lg pointer-events-none" />
              <div className="absolute inset-6 border border-[#2d7a5f] rounded-lg pointer-events-none" />
              <div className="relative z-10 space-y-4">
                <div>
                  <img src="/logo.jpeg" alt="Logo" className="w-14 h-14 object-contain mx-auto mb-2" />
                  <p className="text-[#1e3a5f] font-bold text-lg tracking-widest uppercase" style={{ fontFamily: "'Lora', Georgia, serif" }}>
                    Saúde do Trabalho
                  </p>
                </div>
                <div className="border-t border-[#1e3a5f]/20 pt-4">
                  <p className="text-[#1e3a5f] font-bold text-2xl" style={{ fontFamily: "'Lora', Georgia, serif" }}>
                    {moduleForm.certTitle || "Certificado de Conclusão"}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-gray-500 text-sm">Certificamos que</p>
                  <p className="text-[#1e3a5f] font-bold text-xl border-b-2 border-[#2d7a5f] inline-block pb-1" style={{ fontFamily: "'Lora', Georgia, serif" }}>
                    Nome do Funcionário
                  </p>
                  <p className="text-gray-500 text-sm mt-2">
                    {moduleForm.certBody || "concluiu com êxito o módulo de treinamento."}
                  </p>
                  <p className="text-[#2d7a5f] font-semibold text-base" style={{ fontFamily: "'Lora', Georgia, serif" }}>
                    {moduleForm.title || "Nome do Módulo"}
                  </p>
                </div>
                {moduleForm.certSignerName && (
                  <div className="border-t border-[#1e3a5f]/20 pt-4 mt-4">
                    <p className="text-[#1e3a5f] font-semibold text-sm">{moduleForm.certSignerName}</p>
                    {moduleForm.certSignerRole && <p className="text-gray-500 text-xs">{moduleForm.certSignerRole}</p>}
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-border flex justify-end">
              <Button variant="outline" onClick={() => setPreviewCert(false)}>
                <X size={14} className="mr-2" /> Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
