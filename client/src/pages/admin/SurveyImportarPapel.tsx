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
// R5-P9 #7: helper pra gerar Recibo de Confidencialidade em PDF (impressão direta) com QR code.
function gerarReciboConfidencialidade(args: {
  empresa: string; ciclo: string; setor: string; responsavel: string; cpf: string; cargo: string;
  qtd: number; codigo: string;
}) {
  const now = new Date();
  const data = now.toLocaleDateString("pt-BR");
  const hora = now.toLocaleTimeString("pt-BR");
  const qrPayload = JSON.stringify({ codigo: args.codigo, empresa: args.empresa, ciclo: args.ciclo, qtd: args.qtd, em: now.toISOString() });
  const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(qrPayload)}&size=160&margin=2`;
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Recibo de Confidencialidade — ${args.codigo}</title>
<style>
  body { font-family: Inter, Arial, sans-serif; padding: 32px 40px; color: #1e293b; max-width: 820px; margin: 0 auto; }
  h1 { font-size: 18px; margin: 0 0 6px; color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 8px; }
  .sub { font-size: 11px; color: #64748b; margin-bottom: 18px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin: 14px 0; }
  .field { font-size: 12px; }
  .field b { display: block; color: #475569; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 2px; }
  .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px 18px; background: #f8fafc; }
  .qrwrap { display: flex; gap: 18px; align-items: center; }
  .declaracao { font-size: 11px; line-height: 1.5; color: #334155; margin: 16px 0 8px; text-align: justify; }
  .codigo { font-family: monospace; font-size: 14px; font-weight: 700; letter-spacing: 1px; color: #1e3a5f; }
  .footer { font-size: 10px; color: #94a3b8; text-align: center; margin-top: 24px; padding-top: 10px; border-top: 1px solid #e2e8f0; }
  @page { size: A4; margin: 0; }
  @media print { body { margin: 0; padding: 20mm; } }
</style></head><body>
  <h1>Recibo de Confidencialidade</h1>
  <p class="sub">Documento de rastreabilidade — Pesquisas Psicossociais em Papel (NR-01 / Lei 14.457 / LGPD)</p>
  <div class="grid">
    <div class="field"><b>Empresa</b>${args.empresa || "—"}</div>
    <div class="field"><b>Ciclo / Pesquisa</b>${args.ciclo || "—"}</div>
    <div class="field"><b>Setor</b>${args.setor || "—"}</div>
    <div class="field"><b>Quantidade de questionários</b>${args.qtd}</div>
    <div class="field"><b>Responsável pela digitalização</b>${args.responsavel}</div>
    <div class="field"><b>CPF</b>${args.cpf}</div>
    <div class="field"><b>Cargo</b>${args.cargo}</div>
    <div class="field"><b>Data e hora</b>${data} ${hora}</div>
  </div>
  <div class="box">
    <div class="qrwrap">
      <img src="${qrUrl}" alt="QR de rastreabilidade" style="width:140px;height:140px;border:1px solid #fff;background:#fff;flex-shrink:0" />
      <div>
        <p style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 4px">Código único de rastreabilidade</p>
        <p class="codigo">${args.codigo}</p>
        <p style="font-size:10px;color:#94a3b8;margin:6px 0 0">Apresente este código para validar a autenticidade do envelope.</p>
      </div>
    </div>
  </div>
  <p class="declaracao">
    Eu, <b>${args.responsavel}</b>, CPF <b>${args.cpf}</b>, no exercício do cargo de <b>${args.cargo}</b>,
    declaro que realizei a digitalização de ${args.qtd} questionário(s) psicossocial(is) em papel referentes ao
    ciclo <b>${args.ciclo}</b> e ao setor <b>${args.setor}</b>; comprometo-me a manter os questionários físicos
    armazenados em envelope lacrado, identificado com o código acima, e a tratar as respostas como dados sensíveis
    de natureza sigilosa, abrindo o envelope apenas mediante necessidade administrativa formal ou determinação judicial.
    Estou ciente das responsabilidades previstas na Lei nº 13.709/2018 (LGPD), na NR-01 e demais legislações aplicáveis.
  </p>
  <p class="footer">Saúde do Trabalho · Recibo gerado eletronicamente · Imprima e fixe na parte externa do envelope lacrado.</p>
  <script>window.onload=()=>setTimeout(()=>window.print(),300);</script>
</body></html>`;
  const win = window.open("", "_blank");
  if (!win) { alert("Permita pop-ups para imprimir o recibo."); return; }
  win.document.write(html); win.document.close();
}

export default function SurveyImportarPapel() {
  const params = useParams() as { surveyId: string };
  const surveyId = Number(params.surveyId);
  const [sectorId, setSectorId] = useState<number | null>(null);

  // R5-P9 #7: Termo de Confidencialidade eletrônico — bloqueia o submit até ser aceito.
  const [termoAceito, setTermoAceito] = useState(false);
  const [respResp, setRespResp] = useState({ nome: "", cpf: "", cargo: "" });

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
    // R5-P9 #7: precisa aceitar termo e preencher dados do responsável antes de gravar
    if (!termoAceito || !respResp.nome.trim() || !respResp.cpf.trim() || !respResp.cargo.trim()) {
      toast.error("Aceite o Termo de Confidencialidade e preencha nome/CPF/cargo do responsável.");
      return;
    }
    submitMut.mutate({ surveyId, sectorId, responses: completas.map(f => Object.fromEntries(Object.entries(f).map(([k,v]) => [k, String(v)]))) });
  }

  // R5-P9 #7: gera código único por upload e abre o recibo em PDF imprimível.
  function emitirRecibo() {
    const completas = folhas.filter(f => Object.keys(f).length > 0);
    if (completas.length === 0) { toast.error("Nenhuma folha respondida."); return; }
    if (!respResp.nome.trim() || !respResp.cpf.trim() || !respResp.cargo.trim()) {
      toast.error("Preencha nome, CPF e cargo do responsável."); return;
    }
    const sectorName = sectors.find(s => s.id === sectorId)?.name ?? "—";
    // Código único humano-legível: SDT-yymmddhhmm-XXXX
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${String(now.getFullYear()).slice(2)}${pad(now.getMonth()+1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    const codigo = `SDT-${stamp}-${rand}`;
    gerarReciboConfidencialidade({
      empresa: (surveyQ.data as any)?.survey?.company_name ?? "—",
      ciclo: sv.survey.title,
      setor: sectorName,
      responsavel: respResp.nome,
      cpf: respResp.cpf,
      cargo: respResp.cargo,
      qtd: completas.length,
      codigo,
    });
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

        {/* R5-P9 #7: Termo de Confidencialidade + responsável + recibo (LGPD / NR-01) */}
        <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-bold text-amber-900 flex items-center gap-2">🛡️ Termo de Confidencialidade — obrigatório por LGPD</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">Nome do responsável</label>
              <input value={respResp.nome} onChange={e => setRespResp(r => ({ ...r, nome: e.target.value }))} className="w-full mt-1 border rounded px-2 py-1.5 text-sm" placeholder="Nome completo" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">CPF</label>
              <input value={respResp.cpf} onChange={e => setRespResp(r => ({ ...r, cpf: e.target.value }))} className="w-full mt-1 border rounded px-2 py-1.5 text-sm" placeholder="000.000.000-00" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Cargo</label>
              <input value={respResp.cargo} onChange={e => setRespResp(r => ({ ...r, cargo: e.target.value }))} className="w-full mt-1 border rounded px-2 py-1.5 text-sm" placeholder="ex.: Analista de RH" />
            </div>
          </div>
          <p className="text-xs text-amber-900 leading-relaxed">
            Ao marcar, declaro que: <b>(i)</b> realizei a digitalização dos questionários físicos;
            <b> (ii)</b> mantenho os originais em <b>envelope lacrado</b>, identificado pelo código gerado neste recibo;
            <b> (iii)</b> as respostas serão tratadas como dados sigilosos (LGPD); <b>(iv)</b> o envelope só poderá ser aberto
            mediante necessidade administrativa formal ou determinação judicial; <b>(v)</b> estou ciente das responsabilidades
            previstas na Lei nº 13.709/2018, NR-01 e demais legislações aplicáveis.
          </p>
          <label className="flex items-center gap-2 text-sm font-medium text-amber-900">
            <input type="checkbox" checked={termoAceito} onChange={e => setTermoAceito(e.target.checked)} className="w-4 h-4" />
            Li, aceito e me responsabilizo
          </label>
          <Button variant="outline" size="sm" onClick={emitirRecibo} disabled={!respResp.nome.trim() || !respResp.cpf.trim() || !respResp.cargo.trim()} className="gap-1">
            🖨 Gerar Recibo de Confidencialidade (PDF para impressão)
          </Button>
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <Button variant="outline" size="sm" onClick={addFolha} className="gap-1">
            <Plus size={14} /> Adicionar próxima folha
          </Button>
          <Button onClick={submit} disabled={submitMut.isPending || !termoAceito} className="gap-1">
            {submitMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar {folhas.length} folha(s) e atualizar indicadores
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
