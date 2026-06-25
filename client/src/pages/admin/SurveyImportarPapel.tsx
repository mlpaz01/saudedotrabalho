import { useState } from "react";
import { useParams } from "wouter";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Upload, Save, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * SP6 EXTRA — Lançamento em lote de respostas em papel (após impressão+resposta manual).
 *
 * URL: /admin/pesquisas/importar/:surveyId
 *
 * Fluxo (sem OCR puro — OMR sem template treinado é pouco confiável):
 *  1. Operador escolhe o setor das folhas que está digitando.
 *  2. (Opcional) Sobe foto de cada folha pra arquivamento visual.
 *  3. Marca as opções de cada questão num form compacto (~5 cliques por folha).
 *  4. Botão "Salvar este lote" envia tudo de uma vez.
 *
 * Roadmap: integrar OCR/Vision API depois pra auto-preencher as opções
 * (Tesseract puro não resolve marcação a caneta; precisa de OpenAI Vision).
 */
export default function SurveyImportarPapel() {
  const params = useParams() as { surveyId: string };
  const surveyId = Number(params.surveyId);
  const [sectorId, setSectorId] = useState<number | null>(null);

  // Carrega survey + setores
  const surveyQ = trpc.compliance.surveyPrintable.useQuery({ surveyId });
  const treeQ = trpc.lessons.hierarchyTree.useQuery();

  const sectors: any[] = (() => {
    const tree = (treeQ.data ?? []) as any[];
    const out: any[] = [];
    for (const c of tree) for (const b of (c.branches ?? [])) for (const s of (b.sectors ?? [])) {
      if (s.sector?.id) out.push({ id: s.sector.id, name: s.sector.name, branch: b.branch?.name });
    }
    return out;
  })();

  // Cada respondente é um Map<questionId, answer>. Iniciamos com 1.
  const [folhas, setFolhas] = useState<Record<number, string>[]>([{}]);

  const submitMut = trpc.compliance.bulkInsertAnonymousResponses.useMutation({
    onSuccess: (r: any) => { toast.success(`${r.inserted} resposta(s) lançada(s)!`); setFolhas([{}]); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  function addFolha() { setFolhas(prev => [...prev, {}]); }
  function removeFolha(idx: number) { setFolhas(prev => prev.filter((_, i) => i !== idx)); }
  function setAnswer(idx: number, qid: number, val: string) {
    setFolhas(prev => prev.map((f, i) => i === idx ? { ...f, [qid]: val } : f));
  }

  function submit() {
    const completas = folhas.filter(f => Object.keys(f).length > 0);
    if (completas.length === 0) { toast.error("Nenhuma folha respondida."); return; }
    if (!sectorId) { toast.error("Selecione o setor."); return; }
    submitMut.mutate({ surveyId, sectorId, responses: completas.map(f => Object.fromEntries(Object.entries(f).map(([k,v]) => [k, String(v)]))) });
  }

  if (surveyQ.isLoading || !surveyQ.data) return <AppLayout><div className="p-6"><Loader2 className="animate-spin" /></div></AppLayout>;
  const sv = surveyQ.data;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Upload size={20} className="text-blue-600" />
            Lançamento em lote — {sv.survey.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Use esta tela para transcrever respostas de pesquisas feitas em papel (colaboradores que não usam a plataforma).
            As respostas ficam <b>anônimas</b> mas vinculadas ao setor selecionado, alimentando os indicadores normalmente.
          </p>
        </div>

        <div className="bg-white border rounded-lg p-4 grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700">Setor das folhas</label>
            <select className="w-full mt-1 border rounded-md px-2 py-1.5 text-sm" value={sectorId ?? ""} onChange={e => setSectorId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">— selecione —</option>
              {sectors.map(s => <option key={s.id} value={s.id}>{s.name}{s.branch ? ` (${s.branch})` : ""}</option>)}
            </select>
          </div>
          <div>
            <a href={`/plataforma/admin/pesquisas/imprimir/${surveyId}${sectorId ? `?setor=${sectorId}` : ""}`} target="_blank" className="text-xs text-blue-600 hover:underline">
              → Imprimir formulário em branco {sectorId ? "(com setor)" : "(sem setor)"}
            </a>
          </div>
        </div>

        <div className="space-y-3">
          {folhas.map((folha, idx) => (
            <div key={idx} className="bg-white border-2 border-blue-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-blue-700">Folha #{idx + 1}</span>
                {folhas.length > 1 && (
                  <button onClick={() => removeFolha(idx)} className="text-rose-500 hover:text-rose-700 text-xs"><Trash2 size={12} /></button>
                )}
              </div>
              <div className="space-y-2">
                {(sv.questions ?? []).map((q: any, qi: number) => {
                  const type = String(q.question_type || "text").toLowerCase();
                  let opts: string[] = [];
                  try { const p = q.options ? JSON.parse(q.options) : null; opts = Array.isArray(p) ? p : []; } catch (_) {}
                  if (opts.length === 0 && (type.includes("likert") || type.includes("scale"))) {
                    opts = ["1", "2", "3", "4", "5"];
                  }
                  return (
                    <div key={q.id} className="grid sm:grid-cols-[1fr_auto] gap-2 items-center py-1.5 border-b border-slate-100">
                      <span className="text-xs text-slate-700"><b>Q{qi + 1}.</b> {q.question_text}</span>
                      {opts.length > 0 ? (
                        <div className="flex gap-1 flex-wrap">
                          {opts.map((o, oi) => {
                            const val = String(oi + 1);
                            const isSelected = folha[q.id] === val;
                            return (
                              <button
                                key={oi}
                                onClick={() => setAnswer(idx, q.id, val)}
                                className={`text-xs px-2.5 py-1 rounded-full border min-w-[36px] transition-colors ${isSelected ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-300 hover:border-blue-400"}`}
                                title={o}
                              >
                                {val}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={folha[q.id] ?? ""}
                          onChange={e => setAnswer(idx, q.id, e.target.value)}
                          className="border rounded px-2 py-1 text-xs min-w-[200px]"
                          placeholder="resposta livre"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <Button variant="outline" size="sm" onClick={addFolha} className="gap-1">
            <Plus size={14} /> Adicionar próxima folha
          </Button>
          <Button onClick={submit} disabled={submitMut.isPending} className="gap-1">
            {submitMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar {folhas.length} folha(s) e atualizar indicadores
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
