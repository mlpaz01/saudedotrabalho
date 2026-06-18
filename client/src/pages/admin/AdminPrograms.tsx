import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  BookOpen, Layers, Plus, Pencil, Trash2, ChevronDown, ChevronRight,
  ShieldAlert, ArrowUp, ArrowDown, X, Save, Check,
} from "lucide-react";

export default function AdminPrograms() {
  const programsQ = trpc.riskAssessment.listPrograms.useQuery();
  const factorsQ = trpc.riskAssessment.listFactors.useQuery();
  const coursesQ = trpc.riskAssessment.listAvailableCourses.useQuery();

  const [openProgramId, setOpenProgramId] = useState<number | null>(null);
  const [editingProgram, setEditingProgram] = useState<any | null>(null);
  const [showNew, setShowNew] = useState(false);

  const upsertMut = trpc.riskAssessment.upsertProgram.useMutation({
    onSuccess: () => {
      toast.success("Programa salvo.");
      programsQ.refetch();
      setEditingProgram(null);
      setShowNew(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });
  const deleteMut = trpc.riskAssessment.deleteProgram.useMutation({
    onSuccess: () => { toast.success("Programa arquivado."); programsQ.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const addModMut = trpc.riskAssessment.addModuleToProgram.useMutation({
    onSuccess: () => { toast.success("Módulo adicionado."); programsQ.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const rmModMut = trpc.riskAssessment.removeModuleFromProgram.useMutation({
    onSuccess: () => { toast.success("Módulo removido."); programsQ.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const reorderMut = trpc.riskAssessment.reorderProgramModules.useMutation({
    onSuccess: () => programsQ.refetch(),
    onError: (e: any) => toast.error(e?.message ?? "Erro ao reordenar"),
  });

  const programs = (programsQ.data ?? []) as any[];
  const factors = (factorsQ.data ?? []) as any[];
  const courses = (coursesQ.data ?? []) as any[];

  const active = programs.filter((p: any) => p.is_active);
  const archived = programs.filter((p: any) => !p.is_active);

  function moveModule(programId: number, modules: any[], from: number, to: number) {
    if (to < 0 || to >= modules.length) return;
    const ids = modules.map((m: any) => m.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    reorderMut.mutate({ program_id: programId, module_ids: ids });
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
              Programas de Treinamento
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Trilhas vinculadas aos 13 Fatores Psicossociais. A área "Meus Cursos" do colaborador consome essa estrutura automaticamente — programas vinculados a fatores com risco no setor dele viram <b>Prioritários</b>.
            </p>
          </div>
          <Button size="sm" onClick={() => { setEditingProgram(null); setShowNew(true); }}>
            <Plus size={14} className="mr-1" /> Novo programa
          </Button>
        </div>

        {showNew && (
          <ProgramForm
            initial={null}
            factors={factors}
            onSubmit={(data: any) => upsertMut.mutate(data)}
            onCancel={() => setShowNew(false)}
            loading={upsertMut.isPending}
          />
        )}

        <div className="bg-white rounded-xl border border-border">
          <div className="p-4 border-b border-border flex items-center gap-3">
            <Layers size={18} className="text-primary" />
            <h2 className="font-semibold">Programas ativos ({active.length})</h2>
          </div>
          <div className="divide-y divide-border">
            {active.length === 0 && (
              <p className="p-6 text-sm text-muted-foreground italic">Nenhum programa ativo. Clique em "Novo programa" para criar.</p>
            )}
            {active.map((p: any) => {
              const isOpen = openProgramId === p.id;
              return (
                <div key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      onClick={() => setOpenProgramId(isOpen ? null : p.id)}
                      className="flex-1 text-left flex items-start gap-3"
                    >
                      <div className="w-9 h-9 rounded-lg text-white font-bold text-sm flex items-center justify-center flex-shrink-0" style={{ background: p.color || "#0E2C46" }}>
                        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-slate-900">{p.name_aluno}</h3>
                          <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{p.code}</span>
                          {p.is_obligatory ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Obrigatório</span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Opcional</span>
                          )}
                        </div>
                        {p.name_tecnico && <p className="text-xs text-muted-foreground mt-0.5">{p.name_tecnico}</p>}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span><BookOpen size={11} className="inline mr-0.5" /> {p.modules?.length ?? 0} módulo(s)</span>
                          <span><ShieldAlert size={11} className="inline mr-0.5" /> {p.factors?.length ?? 0} fator(es) vinculado(s)</span>
                          {p.factors && p.factors.length > 0 && (
                            <span className="text-slate-500 truncate">{p.factors.map((f: any) => f.code).join(", ")}</span>
                          )}
                        </div>
                      </div>
                    </button>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => { setShowNew(false); setEditingProgram(p); }} className="text-slate-400 hover:text-primary p-1" title="Editar">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => { if (confirm(`Arquivar o programa "${p.name_aluno}"?`)) deleteMut.mutate({ id: p.id }); }} className="text-slate-400 hover:text-rose-600 p-1" title="Arquivar">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {editingProgram?.id === p.id && (
                    <div className="mt-4 ml-12">
                      <ProgramForm
                        initial={p}
                        factors={factors}
                        onSubmit={(data: any) => upsertMut.mutate(data)}
                        onCancel={() => setEditingProgram(null)}
                        loading={upsertMut.isPending}
                      />
                    </div>
                  )}

                  {isOpen && editingProgram?.id !== p.id && (
                    <div className="mt-4 ml-12 space-y-3">
                      <div>
                        <h4 className="text-xs font-semibold text-slate-700 mb-2">Módulos da trilha ({p.modules?.length ?? 0})</h4>
                        {p.modules?.length > 0 ? (
                          <ol className="space-y-1.5">
                            {p.modules.map((m: any, idx: number) => (
                              <li key={m.id} className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded">
                                <span className="text-xs font-bold text-slate-500 w-5 text-center">{idx + 1}</span>
                                <span className="text-sm flex-1">{m.title}</span>
                                {m.is_mandatory ? <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">Obrigatório</span> : null}
                                <button
                                  onClick={() => moveModule(p.id, p.modules, idx, idx - 1)}
                                  disabled={idx === 0 || reorderMut.isPending}
                                  className="text-slate-400 hover:text-primary disabled:opacity-30"
                                  title="Subir"
                                >
                                  <ArrowUp size={12} />
                                </button>
                                <button
                                  onClick={() => moveModule(p.id, p.modules, idx, idx + 1)}
                                  disabled={idx === p.modules.length - 1 || reorderMut.isPending}
                                  className="text-slate-400 hover:text-primary disabled:opacity-30"
                                  title="Descer"
                                >
                                  <ArrowDown size={12} />
                                </button>
                                <button
                                  onClick={() => { if (confirm("Remover este módulo da trilha?")) rmModMut.mutate({ program_id: p.id, module_id: m.id }); }}
                                  className="text-rose-600 hover:text-rose-800"
                                  title="Remover"
                                >
                                  <X size={12} />
                                </button>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Nenhum módulo na trilha.</p>
                        )}
                      </div>

                      <AddModulePicker
                        program={p}
                        courses={courses.filter((c: any) => !(p.modules ?? []).find((m: any) => m.id === c.id))}
                        onAdd={(moduleId: number) => addModMut.mutate({ program_id: p.id, module_id: moduleId })}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {archived.length > 0 && (
          <details className="bg-white rounded-xl border border-border">
            <summary className="p-4 cursor-pointer text-sm font-semibold text-muted-foreground">
              Programas arquivados ({archived.length})
            </summary>
            <div className="divide-y divide-border">
              {archived.map((p: any) => (
                <div key={p.id} className="p-3 flex items-center gap-2 text-sm opacity-60">
                  <Layers size={14} />
                  <span className="flex-1">{p.name_aluno}</span>
                  <button
                    onClick={() => upsertMut.mutate({ ...p, is_active: true, factor_ids: (p.factors ?? []).map((f: any) => f.id) })}
                    className="text-xs px-2 py-1 border border-slate-300 rounded hover:bg-slate-50"
                  >
                    Restaurar
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </AppLayout>
  );
}

function ProgramForm({ initial, factors, onSubmit, onCancel, loading }: any) {
  const [form, setForm] = useState({
    id: initial?.id,
    code: initial?.code ?? "",
    name_aluno: initial?.name_aluno ?? "",
    name_tecnico: initial?.name_tecnico ?? "",
    description: initial?.description ?? "",
    color: initial?.color ?? "#0E2C46",
    is_obligatory: initial?.is_obligatory ?? true,
    is_active: initial?.is_active ?? true,
    order_index: initial?.order_index ?? 0,
    factor_ids: (initial?.factors ?? []).map((f: any) => f.id) as number[],
  });

  function toggleFactor(fid: number) {
    setForm(f => ({
      ...f,
      factor_ids: f.factor_ids.includes(fid) ? f.factor_ids.filter(x => x !== fid) : [...f.factor_ids, fid],
    }));
  }

  return (
    <div className="bg-slate-50 border border-border rounded-lg p-4 space-y-3">
      <h3 className="font-semibold text-sm">{initial ? "Editar programa" : "Novo programa"}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label className="text-xs text-muted-foreground">Nome para o colaborador *</label>
          <Input value={form.name_aluno} onChange={e => setForm({ ...form, name_aluno: e.target.value })} placeholder="Ex: Programa de Gestão da Sobrecarga Mental" className="text-sm" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Código único *</label>
          <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} placeholder="prog_sobrecarga" className="text-sm font-mono" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Nome técnico (interno)</label>
          <Input value={form.name_tecnico} onChange={e => setForm({ ...form, name_tecnico: e.target.value })} placeholder="Tratamento: Excesso de demandas..." className="text-sm" />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-muted-foreground">Descrição</label>
          <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Breve contexto do programa" className="text-sm" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Cor identificadora</label>
          <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="w-full h-9 border border-border rounded" />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs text-muted-foreground">Tipo</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, is_obligatory: true })}
              className={`text-xs px-3 py-1.5 rounded border ${form.is_obligatory ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 text-slate-700"}`}
            >
              Obrigatório
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, is_obligatory: false })}
              className={`text-xs px-3 py-1.5 rounded border ${!form.is_obligatory ? "bg-amber-600 text-white border-amber-600" : "border-slate-300 text-slate-700"}`}
            >
              Opcional
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Fatores psicossociais vinculados</label>
        <p className="text-[10px] text-muted-foreground mt-0.5 mb-2">Quando o colaborador tiver risco alto/crítico em algum desses fatores, este programa aparece como <b>Prioritário</b> para ele.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5">
          {factors.map((f: any) => {
            const sel = form.factor_ids.includes(f.id);
            return (
              <label key={f.id} className={`flex items-start gap-2 p-2 border rounded cursor-pointer text-xs ${sel ? "bg-emerald-50 border-emerald-300" : "bg-white border-slate-200 hover:bg-slate-50"}`}>
                <input type="checkbox" checked={sel} onChange={() => toggleFactor(f.id)} className="mt-0.5" />
                <span className="flex-1">
                  <span className="font-medium block">{f.name}</span>
                  <span className="text-[10px] font-mono text-slate-400">[{f.code}]</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button
          size="sm"
          onClick={() => onSubmit(form)}
          disabled={loading || !form.code.trim() || !form.name_aluno.trim()}
        >
          <Save size={12} className="mr-1" /> {loading ? "Salvando..." : initial ? "Atualizar" : "Criar programa"}
        </Button>
      </div>
    </div>
  );
}

function AddModulePicker({ program, courses, onAdd }: any) {
  const [moduleId, setModuleId] = useState<string>("");
  return (
    <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
      <select value={moduleId} onChange={e => setModuleId(e.target.value)} className="flex-1 text-xs px-2 py-1 border border-slate-200 rounded bg-white">
        <option value="">Selecionar curso para adicionar à trilha...</option>
        {courses.map((c: any) => (
          <option key={c.id} value={c.id}>{c.title}{c.isMandatory ? " (obrigatório)" : ""}</option>
        ))}
      </select>
      <Button
        size="sm"
        onClick={() => { if (moduleId) { onAdd(Number(moduleId)); setModuleId(""); } }}
        disabled={!moduleId}
        className="text-xs"
      >
        <Plus size={12} className="mr-1" /> Adicionar
      </Button>
    </div>
  );
}
