import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Trash2, BookOpen, ShieldAlert } from "lucide-react";

const CATEGORIES = [
  { value: "saude_mental", label: "Saúde Mental" },
  { value: "nr01_psicossocial", label: "NR-01 — Psicossocial" },
  { value: "lideranca", label: "Liderança" },
  { value: "comunicacao", label: "Comunicação" },
  { value: "assedio", label: "Prevenção ao Assédio" },
  { value: "burnout", label: "Burnout" },
  { value: "ergonomia", label: "Ergonomia (NR-17)" },
  { value: "geral", label: "Geral" },
];

const CRITICALITY_LABEL: Record<string, { label: string; cls: string }> = {
  baixa: { label: "Baixa", cls: "bg-emerald-100 text-emerald-700" },
  media: { label: "Média", cls: "bg-amber-100 text-amber-700" },
  alta: { label: "Alta", cls: "bg-orange-100 text-orange-700" },
  critica: { label: "Crítica", cls: "bg-rose-100 text-rose-700" },
};

export default function AdminFatores() {
  const factorsQ = trpc.riskCorrelation.listFactorsWithLinks.useQuery();
  const coursesQ = trpc.riskCorrelation.listAvailableCourses.useQuery();
  const [search, setSearch] = useState("");
  const [openFactorId, setOpenFactorId] = useState<number | null>(null);

  const linkMut = trpc.riskCorrelation.linkCourseToFactor.useMutation({
    onSuccess: () => { toast.success("Curso vinculado ao fator."); factorsQ.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao vincular"),
  });
  const unlinkMut = trpc.riskCorrelation.unlinkCourseFromFactor.useMutation({
    onSuccess: () => { toast.success("Vínculo removido."); factorsQ.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao desvincular"),
  });
  const updateCatMut = trpc.riskCorrelation.updateCourseCategory.useMutation({
    onSuccess: () => { toast.success("Categoria atualizada."); coursesQ.refetch(); factorsQ.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar"),
  });

  const factors = (factorsQ.data ?? []) as any[];
  const courses = (coursesQ.data ?? []) as any[];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
              Fatores Psicossociais (NR-01)
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Estrutura fixa dos 13 fatores. Vincule cursos e programas preventivos a cada fator —
              o plano de ação consome automaticamente esses conteúdos.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border shadow-sm">
          <div className="p-4 border-b border-border flex items-center gap-3">
            <ShieldAlert size={18} className="text-rose-600" />
            <h2 className="font-semibold">Os 13 Fatores</h2>
            <span className="text-xs text-muted-foreground ml-auto">{factors.length} fatores cadastrados</span>
          </div>
          <div className="divide-y divide-border">
            {factors.map((f: any) => {
              const linked = f.linkedCourses ?? [];
              const isOpen = openFactorId === f.id;
              return (
                <div key={f.id} className="p-4">
                  <div className="flex items-start justify-between gap-3 cursor-pointer" onClick={() => setOpenFactorId(isOpen ? null : f.id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">{f.axisOrder}</span>
                        <h3 className="font-semibold text-slate-900">{f.name}</h3>
                        <span className="text-xs font-mono text-muted-foreground">[{f.code}]</span>
                      </div>
                      {f.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{f.description}</p>}
                      <div className="flex items-center gap-3 mt-2 text-xs">
                        <span className="text-muted-foreground">
                          <BookOpen size={12} className="inline mr-1" />
                          {linked.length} curso(s) vinculado(s)
                        </span>
                        {f.programTitle && <span className="text-emerald-700">Programa: {f.programTitle}</span>}
                      </div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600">{isOpen ? "Recolher" : "Expandir"}</span>
                  </div>

                  {isOpen && (
                    <div className="mt-4 pl-6 border-l-2 border-rose-200 space-y-3">
                      {linked.length > 0 ? (
                        <table className="w-full text-xs border border-border">
                          <thead className="bg-slate-50">
                            <tr><th className="px-2 py-1 text-left">Curso</th><th className="px-2 py-1">Categoria</th><th className="px-2 py-1">Criticidade</th><th className="px-2 py-1">Tipo</th><th className="px-2 py-1"></th></tr>
                          </thead>
                          <tbody>
                            {linked.map((l: any) => {
                              const crit = CRITICALITY_LABEL[l.criticality] ?? CRITICALITY_LABEL.media;
                              return (
                                <tr key={l.module_id} className="border-t border-border">
                                  <td className="px-2 py-1">{l.moduleTitle}</td>
                                  <td className="px-2 py-1 text-center">
                                    <select
                                      defaultValue={l.moduleCategory ?? ""}
                                      onChange={(e) => updateCatMut.mutate({ moduleId: l.module_id, category: e.target.value })}
                                      className="text-xs px-1 py-0.5 border border-border rounded bg-white"
                                    >
                                      {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                    </select>
                                  </td>
                                  <td className="px-2 py-1 text-center"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${crit.cls}`}>{crit.label}</span></td>
                                  <td className="px-2 py-1 text-center text-muted-foreground">{l.is_auto_linked ? "Auto" : "Manual"}</td>
                                  <td className="px-2 py-1 text-center">
                                    <button
                                      onClick={() => { if (confirm("Remover vínculo?")) unlinkMut.mutate({ factorId: f.id, moduleId: l.module_id }); }}
                                      className="text-rose-600 hover:text-rose-800"
                                      title="Desvincular"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Nenhum curso vinculado a este fator.</p>
                      )}

                      <LinkCoursePicker
                        factorId={f.id}
                        courses={courses.filter((c: any) => !linked.find((l: any) => l.module_id === c.id))}
                        onLink={(moduleId, criticality) => linkMut.mutate({ factorId: f.id, moduleId, criticality })}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border shadow-sm">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold">Todos os cursos — Reclassificação rápida</h2>
            <p className="text-xs text-muted-foreground mt-1">Use para mover um curso entre categorias (ex.: Saúde Mental → NR-01 Psicossocial).</p>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar curso..." className="mt-2 max-w-md" />
          </div>
          <div className="divide-y divide-border max-h-96 overflow-y-auto">
            {courses
              .filter((c: any) => !search || (c.title ?? "").toLowerCase().includes(search.toLowerCase()))
              .map((c: any) => (
                <div key={c.id} className="px-4 py-2 flex items-center gap-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.title}</div>
                    <div className="text-xs text-muted-foreground">
                      Atual: <span className="font-mono">{c.templateCategory ?? "—"}</span>
                      {c.isMandatory ? <span className="ml-2 text-rose-600">Obrigatório</span> : null}
                    </div>
                  </div>
                  <select
                    defaultValue={c.templateCategory ?? ""}
                    onChange={(e) => updateCatMut.mutate({ moduleId: c.id, category: e.target.value })}
                    className="text-xs px-2 py-1 border border-border rounded bg-white"
                  >
                    <option value="">— Sem categoria —</option>
                    {CATEGORIES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
              ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function LinkCoursePicker({ factorId, courses, onLink }: { factorId: number; courses: any[]; onLink: (id: number, crit: 'baixa'|'media'|'alta'|'critica') => void }) {
  const [moduleId, setModuleId] = useState<string>("");
  const [crit, setCrit] = useState<"baixa"|"media"|"alta"|"critica">("media");
  return (
    <div className="flex items-center gap-2 pt-2 border-t border-border">
      <select value={moduleId} onChange={(e) => setModuleId(e.target.value)} className="flex-1 text-xs px-2 py-1 border border-border rounded bg-white">
        <option value="">Selecione um curso para vincular...</option>
        {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
      </select>
      <select value={crit} onChange={(e) => setCrit(e.target.value as any)} className="text-xs px-2 py-1 border border-border rounded bg-white">
        <option value="baixa">Baixa</option>
        <option value="media">Média</option>
        <option value="alta">Alta</option>
        <option value="critica">Crítica</option>
      </select>
      <Button
        size="sm"
        onClick={() => { if (moduleId) { onLink(Number(moduleId), crit); setModuleId(""); } }}
        disabled={!moduleId}
        className="text-xs"
      >
        <Plus size={12} className="mr-1" /> Vincular
      </Button>
    </div>
  );
}
