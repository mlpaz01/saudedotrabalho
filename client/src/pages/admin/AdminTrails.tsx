import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Route, BookOpen, GripVertical, X, ToggleLeft, ToggleRight, HelpCircle, ClipboardCheck, ClipboardList, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type TrailForm = { title: string; description: string; objective: string; thumbnailUrl: string; isSequential: boolean; };
const empty: TrailForm = { title: "", description: "", objective: "", thumbnailUrl: "", isSequential: false };

type ItemType = "module" | "quiz" | "exam" | "survey";

function ItemIcon({ type }: { type: ItemType }) {
  if (type === "quiz") return <HelpCircle size={16} className="text-purple-600" />;
  if (type === "exam") return <ClipboardCheck size={16} className="text-orange-600" />;
  if (type === "survey") return <ClipboardList size={16} className="text-blue-600" />;
  return <BookOpen size={16} className="text-green-600" />;
}

export default function AdminTrails() {
  const trailsQ = trpc.trails.list.useQuery();
  const modulesQ = trpc.admin.listModules.useQuery();
  const surveysQ = trpc.surveys.list.useQuery();
  const utils = trpc.useUtils();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<TrailForm>(empty);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const createMut = trpc.trails.create.useMutation({
    onSuccess: () => { toast.success("Trilha criada!"); utils.trails.list.invalidate(); setDialogOpen(false); setForm(empty); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.trails.update.useMutation({
    onSuccess: () => { toast.success("Trilha atualizada!"); utils.trails.list.invalidate(); setDialogOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.trails.delete.useMutation({
    onSuccess: () => { toast.success("Trilha removida!"); utils.trails.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const addModMut = trpc.trails.addModule.useMutation({
    onSuccess: () => { utils.trails.getModules.invalidate(); toast.success("Item adicionado!"); },
    onError: (e) => toast.error(e.message),
  });
  const removeItemMut = trpc.trails.removeItem.useMutation({
    onSuccess: () => { utils.trails.getModules.invalidate(); toast.success("Item removido!"); },
    onError: (e) => toast.error(e.message),
  });

  const trails = trailsQ.data ?? [];
  const allModules = modulesQ.data ?? [];
  const surveys = surveysQ.data ?? [];

  function openCreate() { setEditId(null); setForm(empty); setDialogOpen(true); }
  function openEdit(t: any) {
    setEditId(t.id);
    setForm({ title: t.title, description: t.description ?? "", objective: t.objective ?? "", thumbnailUrl: t.thumbnailUrl ?? "", isSequential: !!t.isSequential });
    setDialogOpen(true);
  }
  function handleSave() {
    const payload = { ...form, isSequential: form.isSequential ? 1 : 0 };
    if (editId) updateMut.mutate({ id: editId, ...payload });
    else createMut.mutate(payload);
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between">
          <div className="relative pl-4">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary to-transparent" />
            <h1 className="text-3xl font-bold text-primary" style={{ fontFamily: "'Playfair Display', serif" }}>Trilhas de Aprendizagem</h1>
            <p className="text-muted-foreground text-sm mt-1">Agrupe modulos, quizzes, provas e pesquisas em jornadas estruturadas</p>
          </div>
          <Button onClick={openCreate} className="gap-2"><Plus size={16} /> Nova Trilha</Button>
        </div>

        {trailsQ.isLoading && <div className="text-center py-12 text-muted-foreground">Carregando trilhas...</div>}

        {!trailsQ.isLoading && trails.length === 0 && (
          <div className="bg-white rounded-xl border border-border p-12 text-center">
            <Route size={40} className="mx-auto text-muted-foreground/40 mb-4" />
            <p className="font-semibold text-muted-foreground">Nenhuma trilha criada ainda</p>
            <p className="text-sm text-muted-foreground mt-1">Crie sua primeira trilha de aprendizagem para estruturar a jornada dos colaboradores.</p>
            <Button onClick={openCreate} className="mt-4 gap-2"><Plus size={16} /> Criar Primeira Trilha</Button>
          </div>
        )}

        <div className="space-y-4">
          {trails.map((trail: any) => (
            <TrailCard key={trail.id} trail={trail} allModules={allModules} surveys={surveys}
              expanded={expandedId === trail.id} onToggleExpand={() => setExpandedId(expandedId === trail.id ? null : trail.id)}
              onEdit={() => openEdit(trail)} onDelete={() => setDeleteId(trail.id)}
              onAddItem={(payload: any) => addModMut.mutate({ trailId: trail.id, ...payload })}
              onRemoveItem={(itemId: number) => removeItemMut.mutate({ id: itemId })}
            />
          ))}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editId ? "Editar Trilha" : "Nova Trilha"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Titulo *</label>
                <Input value={form.title} onChange={(e) => setForm(f=>({...f,title:e.target.value}))} placeholder="Ex: Trilha de Saude Mental" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Descricao</label>
                <Textarea value={form.description} onChange={(e) => setForm(f=>({...f,description:e.target.value}))} rows={2} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Objetivo</label>
                <Textarea value={form.objective} onChange={(e) => setForm(f=>({...f,objective:e.target.value}))} rows={2} placeholder="O que o colaborador vai aprender..." />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">URL da Imagem de Capa</label>
                <Input value={form.thumbnailUrl} onChange={(e) => setForm(f=>({...f,thumbnailUrl:e.target.value}))} placeholder="https://..." />
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setForm(f=>({...f,isSequential:!f.isSequential}))} className="flex items-center gap-2 text-sm">
                  {form.isSequential ? <ToggleRight size={24} className="text-primary" /> : <ToggleLeft size={24} className="text-muted-foreground" />}
                  <span className="font-medium">Ordem obrigatoria</span>
                </button>
                <span className="text-xs text-muted-foreground">O aluno deve completar itens na sequencia</span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
                {editId ? "Salvar" : "Criar Trilha"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover trilha?</AlertDialogTitle>
              <AlertDialogDescription>Esta acao nao pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => { if (deleteId) { deleteMut.mutate({ id: deleteId }); setDeleteId(null); } }} className="bg-destructive text-white">Remover</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}

function TrailCard({ trail, allModules, surveys, expanded, onToggleExpand, onEdit, onDelete, onAddItem, onRemoveItem }: any) {
  const trailModsQ = trpc.trails.getModules.useQuery({ trailId: trail.id }, { enabled: expanded });
  const items = trailModsQ.data ?? [];
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addType, setAddType] = useState<ItemType | null>(null);

  // form state for each type
  const [selectedModuleId, setSelectedModuleId] = useState<number>(0);
  const [quizAuto, setQuizAuto] = useState(true);
  const [examMinScore, setExamMinScore] = useState<number>(70);
  const [selectedSurveyId, setSelectedSurveyId] = useState<number>(0);

  const usedModuleIds = items.filter((i: any) => i.itemType === "module" || !i.itemType).map((m: any) => m.moduleId).filter((x: any) => x);

  function commitAdd() {
    const orderIndex = items.length;
    if (addType === "module") {
      if (!selectedModuleId) return;
      onAddItem({ moduleId: selectedModuleId, orderIndex, itemType: "module" });
      setSelectedModuleId(0);
    } else if (addType === "quiz") {
      // basedOnModuleId = the previous module item
      const prevModule = [...items].reverse().find((i: any) => (i.itemType ?? "module") === "module");
      onAddItem({
        moduleId: null,
        orderIndex,
        itemType: "quiz",
        quizConfig: { autoGenerate: quizAuto, basedOnModuleId: prevModule?.moduleId ?? null },
      });
    } else if (addType === "exam") {
      onAddItem({
        moduleId: null,
        orderIndex,
        itemType: "exam",
        quizConfig: { minScore: Number(examMinScore) || 70 },
      });
    } else if (addType === "survey") {
      if (!selectedSurveyId) return;
      onAddItem({ moduleId: null, orderIndex, itemType: "survey", surveyId: selectedSurveyId });
      setSelectedSurveyId(0);
    }
    setAddType(null);
    setAddMenuOpen(false);
  }

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Route size={20} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-foreground truncate">{trail.title}</p>
            {trail.isSequential ? <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Sequencial</span> : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Livre</span>}
            {trail.isActive ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Ativa</span> : <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Inativa</span>}
          </div>
          {trail.description && <p className="text-sm text-muted-foreground truncate mt-0.5">{trail.description}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button size="sm" variant="ghost" onClick={onToggleExpand}><BookOpen size={16} /></Button>
          <Button size="sm" variant="ghost" onClick={onEdit}><Pencil size={16} /></Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="text-destructive hover:text-destructive"><Trash2 size={16} /></Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border p-4 space-y-3 bg-muted/20">
          <p className="text-sm font-medium">Itens nesta trilha ({items.length})</p>
          {trailModsQ.isLoading && <div className="text-sm text-muted-foreground">Carregando...</div>}
          {items.map((it: any, idx: number) => {
            const type = (it.itemType ?? "module") as ItemType;
            const mod = type === "module" ? allModules.find((m: any) => m.id === it.moduleId) : null;
            const survey = type === "survey" ? surveys.find((s: any) => s.id === it.surveyId) : null;
            const cfg = it.quizConfig || {};
            let label = "";
            if (type === "module") label = `Curso: ${mod?.title ?? `#${it.moduleId}`}`;
            else if (type === "quiz") label = `Quiz Inteligente${cfg.autoGenerate ? " (auto)" : ""}`;
            else if (type === "exam") label = `Prova Final (${cfg.minScore ?? 70}%)`;
            else if (type === "survey") label = `Pesquisa: ${survey?.title ?? `#${it.surveyId}`}`;
            return (
              <div key={it.id} className="flex items-center gap-3 bg-white rounded-lg border border-border p-3">
                <GripVertical size={16} className="text-muted-foreground flex-shrink-0" />
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">{idx+1}</span>
                <ItemIcon type={type} />
                <span className="text-sm font-medium flex-1 truncate">{label}</span>
                <button onClick={() => onRemoveItem(it.id)} className="text-muted-foreground hover:text-destructive"><X size={16} /></button>
              </div>
            );
          })}

          {/* Add item area */}
          <div className="mt-3 relative">
            {!addType && (
              <Button size="sm" variant="outline" className="gap-1" onClick={() => setAddMenuOpen(o => !o)}>
                <Plus size={14} /> Adicionar item <ChevronDown size={14} />
              </Button>
            )}
            {addMenuOpen && !addType && (
              <div className="absolute left-0 mt-1 z-10 bg-white border border-border rounded-lg shadow-lg w-64 py-1">
                <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-sm text-left" onClick={() => { setAddType("module"); setAddMenuOpen(false); }}>
                  <BookOpen size={16} className="text-green-600" /> Adicionar Curso
                </button>
                <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-sm text-left" onClick={() => { setAddType("quiz"); setAddMenuOpen(false); }}>
                  <HelpCircle size={16} className="text-purple-600" /> Adicionar Quiz Inteligente
                </button>
                <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-sm text-left" onClick={() => { setAddType("exam"); setAddMenuOpen(false); }}>
                  <ClipboardCheck size={16} className="text-orange-600" /> Adicionar Prova Final
                </button>
                <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-sm text-left" onClick={() => { setAddType("survey"); setAddMenuOpen(false); }}>
                  <ClipboardList size={16} className="text-blue-600" /> Adicionar Pesquisa
                </button>
              </div>
            )}

            {addType === "module" && (
              <div className="flex gap-2 items-center bg-white border border-border rounded-lg p-3">
                <BookOpen size={16} className="text-green-600" />
                <select className="flex-1 text-sm border border-border rounded px-2 py-1" value={selectedModuleId} onChange={e => setSelectedModuleId(Number(e.target.value))}>
                  <option value={0}>Selecione um curso...</option>
                  {allModules.filter((m: any) => !usedModuleIds.includes(m.id)).map((m: any) => (
                    <option key={m.id} value={m.id}>{m.title}</option>
                  ))}
                </select>
                <Button size="sm" disabled={!selectedModuleId} onClick={commitAdd}>Adicionar</Button>
                <Button size="sm" variant="ghost" onClick={() => setAddType(null)}>Cancelar</Button>
              </div>
            )}

            {addType === "quiz" && (
              <div className="bg-white border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <HelpCircle size={16} className="text-purple-600" /> Quiz Inteligente
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={quizAuto} onChange={e => setQuizAuto(e.target.checked)} />
                  Gerar questões baseado no curso anterior
                </label>
                <p className="text-xs text-muted-foreground">Questões serão geradas automaticamente a partir do conteúdo do curso anterior.</p>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setAddType(null)}>Cancelar</Button>
                  <Button size="sm" onClick={commitAdd}>Adicionar</Button>
                </div>
              </div>
            )}

            {addType === "exam" && (
              <div className="bg-white border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ClipboardCheck size={16} className="text-orange-600" /> Prova Final
                </div>
                <label className="flex items-center gap-2 text-sm">
                  Nota mínima (%):
                  <input type="number" min={0} max={100} value={examMinScore} onChange={e => setExamMinScore(Number(e.target.value))} className="border border-border rounded px-2 py-1 w-20 text-sm" />
                </label>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setAddType(null)}>Cancelar</Button>
                  <Button size="sm" onClick={commitAdd}>Adicionar</Button>
                </div>
              </div>
            )}

            {addType === "survey" && (
              <div className="bg-white border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ClipboardList size={16} className="text-blue-600" /> Pesquisa
                </div>
                <select className="w-full text-sm border border-border rounded px-2 py-1" value={selectedSurveyId} onChange={e => setSelectedSurveyId(Number(e.target.value))}>
                  <option value={0}>Selecione uma pesquisa...</option>
                  {surveys.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setAddType(null)}>Cancelar</Button>
                  <Button size="sm" disabled={!selectedSurveyId} onClick={commitAdd}>Adicionar</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
