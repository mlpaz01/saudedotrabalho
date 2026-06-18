import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronRight,
  ArrowUp, ArrowDown, X, BookOpen, Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Lora:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
.pg-page{background:#F4F6F9;min-height:100vh;font-family:'Plus Jakarta Sans',system-ui,sans-serif}
.pg-wrap{padding:24px 30px 56px;max-width:1100px;margin:0 auto}
.pg-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;gap:12px;flex-wrap:wrap}
.pg-title{font-family:'Lora',Georgia,serif;font-size:26px;font-weight:700;color:#0E2C46;letter-spacing:-.01em}
.pg-subtitle{font-size:13px;color:#62707D;margin-top:4px}
.pg-section-head{display:flex;align-items:center;gap:10px;padding:12px 16px;background:#0E2C46;border-radius:12px;margin-bottom:12px}
.pg-section-title{font-size:14px;font-weight:700;color:#fff}
.pg-section-count{font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:rgba(255,255,255,.18);color:#fff}
.pg-list{display:flex;flex-direction:column;gap:8px;margin-bottom:32px}
.pg-row{background:#fff;border:1.5px solid #E9EDF2;border-radius:12px;overflow:hidden;transition:box-shadow .18s}
.pg-row:hover{box-shadow:0 4px 14px -4px rgba(14,44,70,.12)}
.pg-row-head{display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;user-select:none}
.pg-row-num{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;flex-shrink:0;color:#fff}
.pg-row-info{flex:1;min-width:0}
.pg-row-name{font-size:14px;font-weight:700;color:#0E2C46;margin:0 0 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pg-row-meta{font-size:11.5px;color:#62707D;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.pg-badge{font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:6px;white-space:nowrap}
.pg-badge-obrig{background:rgba(37,99,235,.12);color:#2563EB}
.pg-badge-opcio{background:rgba(217,119,6,.12);color:#D97706}
.pg-row-actions{display:flex;gap:6px;flex-shrink:0}
.pg-icon-btn{border:none;background:transparent;cursor:pointer;padding:6px;border-radius:8px;color:#62707D;display:flex;align-items:center;transition:background .14s,color .14s}
.pg-icon-btn:hover{background:#F4F6F9;color:#0E2C46}
.pg-icon-btn.danger:hover{background:#FEE2E2;color:#DC2626}
.pg-expanded{border-top:1.5px solid #EFF2F6;padding:12px 16px;background:#FAFBFC;display:flex;flex-direction:column;gap:6px}
.pg-mod-row{display:flex;align-items:center;gap:10px;padding:8px 12px;background:#fff;border:1.5px solid #E9EDF2;border-radius:9px}
.pg-mod-num{font-size:12px;font-weight:700;color:#62707D;min-width:18px}
.pg-mod-title{flex:1;font-size:13px;font-weight:600;color:#0E2C46;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pg-mod-dur{font-size:11px;color:#92A0AC}
.pg-factor-chip{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:999px;background:rgba(46,165,106,.1);color:#228A57;border:1px solid rgba(46,165,106,.2)}
.pg-empty-mods{font-size:12.5px;color:#92A0AC;padding:12px;text-align:center;font-style:italic}
.pg-add-area{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
.pg-add-select{flex:1;min-width:160px;padding:7px 10px;border:1.5px solid #E0E6ED;border-radius:9px;font-size:13px;font-family:inherit;background:#fff;color:#0E2C46;outline:none}
.pg-factors-area{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.pg-section-sep{font-size:11px;font-weight:700;color:#62707D;text-transform:uppercase;letter-spacing:.06em;margin:8px 0 4px}
`;

type ProgramForm = {
  name: string;
  code: string;
  technicalTitle: string;
  description: string;
  type: "obrigatorio" | "opcional";
};

const emptyForm = (): ProgramForm => ({
  name: "", code: "", technicalTitle: "", description: "", type: "obrigatorio",
});

export default function AdminProgramas() {
  const utils = trpc.useUtils();
  const programsQ = trpc.trainingPrograms.list.useQuery();
  const modulesQ = trpc.admin.listModules.useQuery();
  const factorsQ = trpc.pgr.listFactors.useQuery();

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ProgramForm>(emptyForm());
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [addModuleMap, setAddModuleMap] = useState<Record<number, number>>({});
  const [addFactorMap, setAddFactorMap] = useState<Record<number, number>>({});

  const programs = programsQ.data ?? [];
  const allModules = (modulesQ.data ?? []) as any[];
  const allFactors = (factorsQ.data ?? []) as any[];

  const createMut = trpc.trainingPrograms.create.useMutation({
    onSuccess: () => { toast.success("Programa criado!"); utils.trainingPrograms.list.invalidate(); setDialogOpen(false); setForm(emptyForm()); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.trainingPrograms.update.useMutation({
    onSuccess: () => { toast.success("Programa atualizado!"); utils.trainingPrograms.list.invalidate(); setDialogOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.trainingPrograms.delete.useMutation({
    onSuccess: () => { toast.success("Programa removido!"); utils.trainingPrograms.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const addModMut = trpc.trainingPrograms.addModule.useMutation({
    onSuccess: () => { toast.success("Módulo adicionado!"); utils.trainingPrograms.getModules.invalidate(); utils.trainingPrograms.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const removeModMut = trpc.trainingPrograms.removeModule.useMutation({
    onSuccess: () => { utils.trainingPrograms.getModules.invalidate(); utils.trainingPrograms.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const reorderModMut = trpc.trainingPrograms.reorderModule.useMutation({
    onSuccess: () => { utils.trainingPrograms.getModules.invalidate(); },
  });
  const addFactorMut = trpc.trainingPrograms.addFactor.useMutation({
    onSuccess: () => { toast.success("Fator vinculado!"); utils.trainingPrograms.getFactors.invalidate(); utils.trainingPrograms.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const removeFactorMut = trpc.trainingPrograms.removeFactor.useMutation({
    onSuccess: () => { utils.trainingPrograms.getFactors.invalidate(); utils.trainingPrograms.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  function openCreate() {
    setEditId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(p: any) {
    setEditId(p.id);
    setForm({ name: p.name, code: p.code ?? "", technicalTitle: p.technicalTitle ?? "", description: p.description ?? "", type: p.type as "obrigatorio" | "opcional" });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.name.trim()) return;
    const payload = { name: form.name.trim(), code: form.code || undefined, technicalTitle: form.technicalTitle || undefined, description: form.description || undefined, type: form.type };
    if (editId) updateMut.mutate({ id: editId, ...payload });
    else createMut.mutate(payload);
  }

  const obrig = programs.filter(p => p.type === "obrigatorio");
  const opcio = programs.filter(p => p.type === "opcional");

  const typeColors: Record<string, string> = { obrigatorio: "#2563EB", opcional: "#D97706" };

  return (
    <AppLayout>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="pg-page">
        <div className="pg-wrap">
          <div className="pg-header">
            <div>
              <div className="pg-title">Programas de Treinamento</div>
              <div className="pg-subtitle">Trilhas vinculadas aos 13 Fatores Psicossociais</div>
            </div>
            <Button onClick={openCreate} style={{ background: "#0E2C46", color: "#fff", borderRadius: 10, fontWeight: 700 }}>
              <Plus size={16} className="mr-2" /> Novo programa
            </Button>
          </div>

          {/* Obrigatórios */}
          {obrig.length > 0 && (
            <>
              <div className="pg-section-head">
                <span className="pg-section-title">Programas Obrigatórios</span>
                <span className="pg-section-count">{obrig.length}</span>
              </div>
              <div className="pg-list">
                {obrig.map((p, i) => (
                  <ProgramRow
                    key={p.id}
                    p={p}
                    index={i + 1}
                    color="#2563EB"
                    expanded={expandedId === p.id}
                    onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
                    onEdit={() => openEdit(p)}
                    onDelete={() => setDeleteId(p.id)}
                    allModules={allModules}
                    allFactors={allFactors}
                    addModuleVal={addModuleMap[p.id] ?? 0}
                    onAddModuleChange={(v) => setAddModuleMap(m => ({ ...m, [p.id]: v }))}
                    onAddModule={() => {
                      const mid = addModuleMap[p.id];
                      if (mid) { addModMut.mutate({ programId: p.id, moduleId: mid }); setAddModuleMap(m => ({ ...m, [p.id]: 0 })); }
                    }}
                    onRemoveModule={(id) => removeModMut.mutate({ id })}
                    onReorder={(id, dir) => reorderModMut.mutate({ id, direction: dir })}
                    addFactorVal={addFactorMap[p.id] ?? 0}
                    onAddFactorChange={(v) => setAddFactorMap(f => ({ ...f, [p.id]: v }))}
                    onAddFactor={() => {
                      const fid = addFactorMap[p.id];
                      if (fid) { addFactorMut.mutate({ programId: p.id, factorId: fid }); setAddFactorMap(f => ({ ...f, [p.id]: 0 })); }
                    }}
                    onRemoveFactor={(id) => removeFactorMut.mutate({ id })}
                  />
                ))}
              </div>
            </>
          )}

          {/* Opcionais */}
          {opcio.length > 0 && (
            <>
              <div className="pg-section-head" style={{ background: "#92400E" }}>
                <span className="pg-section-title">Cursos Complementares</span>
                <span className="pg-section-count">{opcio.length}</span>
              </div>
              <div className="pg-list">
                {opcio.map((p, i) => (
                  <ProgramRow
                    key={p.id}
                    p={p}
                    index={i + 1}
                    color="#D97706"
                    expanded={expandedId === p.id}
                    onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
                    onEdit={() => openEdit(p)}
                    onDelete={() => setDeleteId(p.id)}
                    allModules={allModules}
                    allFactors={allFactors}
                    addModuleVal={addModuleMap[p.id] ?? 0}
                    onAddModuleChange={(v) => setAddModuleMap(m => ({ ...m, [p.id]: v }))}
                    onAddModule={() => {
                      const mid = addModuleMap[p.id];
                      if (mid) { addModMut.mutate({ programId: p.id, moduleId: mid }); setAddModuleMap(m => ({ ...m, [p.id]: 0 })); }
                    }}
                    onRemoveModule={(id) => removeModMut.mutate({ id })}
                    onReorder={(id, dir) => reorderModMut.mutate({ id, direction: dir })}
                    addFactorVal={addFactorMap[p.id] ?? 0}
                    onAddFactorChange={(v) => setAddFactorMap(f => ({ ...f, [p.id]: v }))}
                    onAddFactor={() => {
                      const fid = addFactorMap[p.id];
                      if (fid) { addFactorMut.mutate({ programId: p.id, factorId: fid }); setAddFactorMap(f => ({ ...f, [p.id]: 0 })); }
                    }}
                    onRemoveFactor={(id) => removeFactorMut.mutate({ id })}
                  />
                ))}
              </div>
            </>
          )}

          {programs.length === 0 && !programsQ.isLoading && (
            <div style={{ textAlign: "center", padding: "64px 20px", color: "#92A0AC" }}>
              <BookOpen size={36} style={{ margin: "0 auto 12px", opacity: .3, display: "block" }} />
              <p style={{ fontSize: 14, fontWeight: 600 }}>Nenhum programa cadastrado ainda.</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>Crie o primeiro programa clicando em "Novo programa".</p>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent style={{ maxWidth: 520 }}>
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Programa" : "Novo Programa"}</DialogTitle>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#62707D", display: "block", marginBottom: 4 }}>Nome (visível ao colaborador) *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ex: Programa de Gestão da Sobrecarga Mental" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#62707D", display: "block", marginBottom: 4 }}>Código técnico</label>
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="prog_sobrecarga" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#62707D", display: "block", marginBottom: 4 }}>Tipo</label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value as "obrigatorio" | "opcional" }))}
                  style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #E0E6ED", borderRadius: 9, fontSize: 13, fontFamily: "inherit", background: "#fff", color: "#0E2C46" }}
                >
                  <option value="obrigatorio">Obrigatório</option>
                  <option value="opcional">Opcional</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#62707D", display: "block", marginBottom: 4 }}>Título técnico (admin)</label>
              <Input value={form.technicalTitle} onChange={e => setForm(f => ({ ...f, technicalTitle: e.target.value }))} placeholder="ex: Tratamento: Excesso de demandas" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#62707D", display: "block", marginBottom: 4 }}>Descrição</label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descreva o objetivo do programa..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.name.trim()} style={{ background: "#0E2C46", color: "#fff" }}>
              {editId ? "Salvar" : "Criar programa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover programa?</AlertDialogTitle>
            <AlertDialogDescription>O programa será desativado. Os módulos e cursos não serão excluídos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) { deleteMut.mutate({ id: deleteId }); setDeleteId(null); } }} style={{ background: "#DC2626" }}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

function ProgramRow({
  p, index, color, expanded, onToggle, onEdit, onDelete,
  allModules, allFactors,
  addModuleVal, onAddModuleChange, onAddModule,
  onRemoveModule, onReorder,
  addFactorVal, onAddFactorChange, onAddFactor, onRemoveFactor,
}: any) {
  const modsQ = trpc.trainingPrograms.getModules.useQuery({ programId: p.id }, { enabled: expanded });
  const factsQ = trpc.trainingPrograms.getFactors.useQuery({ programId: p.id }, { enabled: expanded });
  const mods = modsQ.data ?? [];
  const facts = factsQ.data ?? [];

  const existingModIds = new Set(mods.map((m: any) => m.moduleId));
  const availableMods = (allModules as any[]).filter((m: any) => !existingModIds.has(m.id));

  const existingFactIds = new Set(facts.map((f: any) => f.factorId));
  const availableFacts = (allFactors as any[]).filter((f: any) => !existingFactIds.has(f.id));

  return (
    <div className="pg-row">
      <div className="pg-row-head" onClick={onToggle}>
        <div className="pg-row-num" style={{ background: color }}>{index}</div>
        <div className="pg-row-info">
          <div className="pg-row-name">{p.name}</div>
          <div className="pg-row-meta">
            {p.code && <span style={{ fontFamily: "monospace", fontSize: 11, color: "#94a3b8" }}>{p.code}</span>}
            <span className={`pg-badge ${p.type === "obrigatorio" ? "pg-badge-obrig" : "pg-badge-opcio"}`}>
              {p.type === "obrigatorio" ? "Obrigatório" : "Opcional"}
            </span>
            <span>{p.moduleCount} módulo{p.moduleCount !== 1 ? "s" : ""}</span>
            <span>{p.factorCount} fator{p.factorCount !== 1 ? "es" : ""}</span>
          </div>
        </div>
        <div className="pg-row-actions" onClick={e => e.stopPropagation()}>
          <button className="pg-icon-btn" onClick={onEdit} title="Editar"><Pencil size={14} /></button>
          <button className="pg-icon-btn danger" onClick={onDelete} title="Remover"><Trash2 size={14} /></button>
        </div>
        {expanded ? <ChevronDown size={16} style={{ color: "#62707D", flexShrink: 0 }} /> : <ChevronRight size={16} style={{ color: "#62707D", flexShrink: 0 }} />}
      </div>

      {expanded && (
        <div className="pg-expanded">
          {/* Modules section */}
          <div className="pg-section-sep">Módulos</div>
          {mods.length === 0 && <div className="pg-empty-mods">Este programa ainda não possui módulos. Adicione abaixo.</div>}
          {mods.map((m: any, i: number) => (
            <div key={m.id} className="pg-mod-row">
              <span className="pg-mod-num">{i + 1}</span>
              <span className="pg-mod-title" title={m.title}>{m.title}</span>
              {m.durationMinutes > 0 && <span className="pg-mod-dur">{m.durationMinutes} min</span>}
              <button className="pg-icon-btn" onClick={() => onReorder(m.id, "up")} disabled={i === 0} style={{ opacity: i === 0 ? .3 : 1 }}><ArrowUp size={13} /></button>
              <button className="pg-icon-btn" onClick={() => onReorder(m.id, "down")} disabled={i === mods.length - 1} style={{ opacity: i === mods.length - 1 ? .3 : 1 }}><ArrowDown size={13} /></button>
              <button className="pg-icon-btn danger" onClick={() => onRemoveModule(m.id)}><X size={13} /></button>
            </div>
          ))}
          {availableMods.length > 0 && (
            <div className="pg-add-area">
              <select
                className="pg-add-select"
                value={addModuleVal || ""}
                onChange={e => onAddModuleChange(Number(e.target.value))}
              >
                <option value="">Selecionar módulo...</option>
                {availableMods.map((m: any) => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
              <Button size="sm" onClick={onAddModule} disabled={!addModuleVal} style={{ background: "#0E2C46", color: "#fff", borderRadius: 9 }}>
                <Plus size={13} className="mr-1" /> Adicionar
              </Button>
            </div>
          )}

          {/* Factors section */}
          <div className="pg-section-sep" style={{ marginTop: 12 }}>Fatores psicossociais vinculados</div>
          <div className="pg-factors-area">
            {facts.map((f: any) => (
              <span key={f.id} className="pg-factor-chip">
                <Link2 size={11} />
                {f.code}: {f.name}
                <button style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, color: "inherit", display: "flex", alignItems: "center" }} onClick={() => onRemoveFactor(f.id)}>
                  <X size={11} />
                </button>
              </span>
            ))}
            {facts.length === 0 && <span style={{ fontSize: 12, color: "#92A0AC", fontStyle: "italic" }}>Nenhum fator vinculado. Programas sem fatores nunca são Prioritários.</span>}
          </div>
          {availableFacts.length > 0 && (
            <div className="pg-add-area">
              <select
                className="pg-add-select"
                value={addFactorVal || ""}
                onChange={e => onAddFactorChange(Number(e.target.value))}
              >
                <option value="">Vincular fator psicossocial...</option>
                {availableFacts.map((f: any) => <option key={f.id} value={f.id}>{f.code}: {f.name}</option>)}
              </select>
              <Button size="sm" onClick={onAddFactor} disabled={!addFactorVal} style={{ background: "#228A57", color: "#fff", borderRadius: 9 }}>
                <Link2 size={13} className="mr-1" /> Vincular
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
