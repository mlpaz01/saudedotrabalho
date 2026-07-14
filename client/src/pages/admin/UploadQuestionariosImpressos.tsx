import { useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, CheckCircle2, ShieldCheck, ClipboardList, Hash, QrCode, AlertCircle, HelpCircle } from "lucide-react";

/**
 * R5-P13 — Indicador de OCR com tooltip explicando a regra de cálculo.
 * Torna o painel de leitura automática auto-explicativo para o RH.
 */
function OcrMetric({ label, value, help, color = "" }: { label: string; value: React.ReactNode; help: string; color?: string }) {
  return (
    <div title={help} className="cursor-help">
      <span className="text-slate-400 flex items-center gap-1">{label}<HelpCircle size={11} className="text-slate-300" /></span>
      <b className={color}>{value}</b>
    </div>
  );
}

/** Bloco completo do relatório de OCR, agrupado por nível (documentos × qualidade × estatísticas). */
function OcrReport({ r, compact = false }: { r: any; compact?: boolean }) {
  // Compat: lotes antigos só têm sucesso/rasura/invalidas/naoProcessados.
  const lidos = r.lidos ?? r.sucesso ?? 0;
  const emBranco = r.emBranco ?? null;
  const multipla = r.multipla ?? null;
  const naoInterp = r.naoInterpretadas ?? null;
  const respostasValidas = r.respostasValidas ?? 0;
  const rasura = r.rasura ?? 0;
  const discursivas = r.discursivasIgnoradas ?? 0;
  const aprovDoc = r.aproveitamentoDocumentos ?? null;
  const legacyInvalidas = r.invalidas ?? 0;
  const detalhado = emBranco !== null; // relatório novo
  // R5-P13 #6 — "Aproveitamento da leitura (OCR)" mede só a QUALIDADE da leitura:
  // válidas + rasura + múltipla são marcações que o OCR interpretou corretamente
  // (rasura/múltipla são estados corretamente identificados, só não viram resposta).
  // "Em branco" NÃO entra nessa conta — não é falha de leitura, é o colaborador não
  // ter assinalado (ou a questão não estar naquela página). Só "não interpretadas" pesa.
  const qualidadeDenom = respostasValidas + rasura + (multipla ?? 0) + (naoInterp ?? 0);
  const qualidadeLeitura = detalhado
    ? (qualidadeDenom > 0 ? Math.round(((respostasValidas + rasura + (multipla ?? 0)) / qualidadeDenom) * 100) : 100)
    : null;
  // Estatística descritiva (não é indicador de falha): proporção de questões respondidas.
  const totalProcessado = respostasValidas + (emBranco ?? 0) + rasura + (multipla ?? 0) + (naoInterp ?? 0);
  const proporcaoRespondida = totalProcessado > 0 ? Math.round((respostasValidas / totalProcessado) * 100) : 0;
  return (
    <div className={compact ? "text-[11px]" : "text-xs"}>
      <div className="flex items-center gap-1 text-slate-500 font-semibold mb-1">Questionários (documentos)</div>
      <div className={`grid ${compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3"} gap-2 mb-3`}>
        <OcrMetric label="Páginas recebidas" value={r.recebidos ?? 0} help={`Total de imagens/páginas enviadas neste lote${r.paginasPorQuestionario ? ` (${r.paginasPorQuestionario} página(s) por questionário)` : ""}.`} />
        {r.questionarios != null && <OcrMetric label="Questionários" value={r.questionarios} help="Questionários montados a partir das páginas (páginas do mesmo questionário são mescladas em uma resposta)." />}
        <OcrMetric label="Lidos com sucesso" value={lidos} color="text-emerald-700" help="Questionários em que o OCR capturou ao menos uma resposta objetiva válida." />
        <OcrMetric label="Não processados" value={r.naoProcessados ?? 0} color="text-rose-700" help="Páginas com falha técnica de leitura: imagem ilegível, muito escura/torta ou erro do motor de OCR. NÃO inclui rasuras (isso é por questão)." />
        {aprovDoc !== null && <OcrMetric label="Aproveitamento de questionários" value={`${aprovDoc}%`} help="Lidos com sucesso ÷ Questionários × 100. Mostra quantos questionários entraram no sistema." />}
      </div>

      {detalhado ? (
        <>
          {/* R5-P13 #6 — qualidade da leitura (falhas reais do OCR), separado das estatísticas do questionário */}
          <div className="flex items-center gap-1 text-slate-500 font-semibold mb-1">Qualidade da leitura (OCR)</div>
          <div className={`grid ${compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3"} gap-2 mb-3`}>
            <OcrMetric label="Aproveitamento da leitura" value={`${qualidadeLeitura}%`} color="text-emerald-700" help="Mede só a qualidade do OCR: (válidas + rasura + múltipla) ÷ (válidas + rasura + múltipla + não interpretadas) × 100. Questões em branco NÃO entram nesta conta — branco não é falha de leitura." />
            <OcrMetric label="Rasura" value={rasura} color="text-amber-700" help="Questão com rasura/emenda: identificada corretamente pelo OCR e desconsiderada. As demais questões do mesmo questionário seguem válidas." />
            <OcrMetric label="Múltipla marcação" value={multipla} color="text-orange-700" help="Colaborador marcou mais de uma alternativa: identificado corretamente pelo OCR e desconsiderada." />
            <OcrMetric label="Não interpretadas" value={naoInterp} color="text-rose-700" help="Única falha real de qualidade: o OCR não conseguiu identificar com segurança qual alternativa foi marcada." />
          </div>

          {/* Estatísticas descritivas do preenchimento — não são indicador de falha do OCR */}
          <div className="flex items-center gap-1 text-slate-500 font-semibold mb-1">Estatísticas do questionário</div>
          <div className={`grid ${compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3"} gap-2`}>
            <OcrMetric label="Respostas válidas" value={respostasValidas} color="text-emerald-700" help="Marcações objetivas (Likert/múltipla escolha) reconhecidas e gravadas." />
            <OcrMetric label="Em branco" value={emBranco} color="text-slate-600" help="Questão objetiva sem nenhuma alternativa assinalada — pode ser o colaborador ter deixado em branco, ou a questão não constar nas páginas enviadas para este lote. NÃO é falha do OCR." />
            <OcrMetric label="Proporção respondida" value={`${proporcaoRespondida}%`} help="Respostas válidas ÷ total de questões objetivas processadas × 100. Estatística do preenchimento do questionário, não da qualidade da leitura." />
          </div>
        </>
      ) : (
        <div className={`grid ${compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3"} gap-2`}>
          <OcrMetric label="Respostas válidas" value={respostasValidas || "—"} color="text-emerald-700" help="Marcações objetivas (Likert/múltipla escolha) reconhecidas e gravadas." />
          <OcrMetric label="Inválidas" value={legacyInvalidas} color="text-orange-700" help="Lote antigo: soma de em branco + múltipla marcação + não interpretadas." />
          <OcrMetric label="Rasura" value={rasura} color="text-amber-700" help="Questão com rasura/emenda: desconsiderada. As demais questões do mesmo questionário seguem válidas." />
          <OcrMetric label="Aproveitamento de respostas" value={`${r.aproveitamento ?? 0}%`} help="Lote antigo (formato anterior): respostas válidas ÷ questões processadas × 100." />
        </div>
      )}

      {discursivas > 0 && (
        <div className="mt-2 text-[11px] text-slate-500 flex items-start gap-1">
          <AlertCircle size={12} className="text-sky-500 shrink-0 mt-0.5" />
          <span><b>{discursivas}</b> campo(s) discursivo(s) (texto livre) não são lidos pela leitura automática — precisam de transcrição manual e por isso <b>não contam como inválidos</b>.</span>
        </div>
      )}
    </div>
  );
}

/**
 * R5-P11 #3 — Upload de Questionários Impressos (nova metodologia).
 *
 * Substitui o fluxo antigo (etiqueta/termo individuais por questionário).
 * 1 termo + 1 recibo POR LOTE. Tudo enviado de uma vez:
 *   Etapa 1 — Identificação do lote (ciclo, pesquisa, setor, data, qtd, unidade)
 *   Etapa 2 — Termo de Confidencialidade (responsável: nome/CPF/cargo + aceite)
 *   Etapa 3 — Upload dos arquivos digitalizados (PDF/JPG/PNG, múltiplos)
 *   Etapa 4 — Recibo de Confidencialidade (PDF imprimível com QR code)
 *
 * OCR/leitura automática das respostas: marcado como ocrStatus='pending'
 * pra processamento offline subsequente (job ou ação manual posterior).
 */

function gerarReciboPDF(args: {
  code: string;
  empresa: string;
  cycleName: string;
  surveyTitle: string;
  setor: string;
  unit: string;
  qtd: number;
  responsavel: { nome: string; cpf: string; cargo: string };
  signedAt: string;
}) {
  const dt = new Date(args.signedAt);
  const data = dt.toLocaleDateString("pt-BR");
  const hora = dt.toLocaleTimeString("pt-BR");
  const qrPayload = JSON.stringify({
    codigo: args.code, empresa: args.empresa, ciclo: args.cycleName,
    pesquisa: args.surveyTitle, qtd: args.qtd, em: dt.toISOString(),
  });
  const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(qrPayload)}&size=180&margin=2`;
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Recibo de Confidencialidade — ${args.code}</title>
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
  <p class="sub">Lote de questionários psicossociais em papel — NR-01 / Lei 14.457 / LGPD</p>
  <div class="grid">
    <div class="field"><b>Empresa</b>${args.empresa || "—"}</div>
    <div class="field"><b>Ciclo Psicossocial</b>${args.cycleName || "—"}</div>
    <div class="field"><b>Pesquisa</b>${args.surveyTitle || "—"}</div>
    <div class="field"><b>Setor</b>${args.setor || "—"}</div>
    <div class="field"><b>Unidade</b>${args.unit || "—"}</div>
    <div class="field"><b>Quantidade no lote</b>${args.qtd}</div>
    <div class="field"><b>Responsável pela digitalização</b>${args.responsavel.nome}</div>
    <div class="field"><b>CPF</b>${args.responsavel.cpf}</div>
    <div class="field"><b>Cargo</b>${args.responsavel.cargo}</div>
    <div class="field"><b>Data e hora do envio</b>${data} ${hora}</div>
  </div>
  <div class="box">
    <div class="qrwrap">
      <img src="${qrUrl}" alt="QR de rastreabilidade" style="width:150px;height:150px;border:1px solid #fff;background:#fff;flex-shrink:0" />
      <div>
        <p style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 4px">Código único de rastreabilidade</p>
        <p class="codigo">${args.code}</p>
        <p style="font-size:10px;color:#94a3b8;margin:6px 0 0">Fixe este recibo na frente do envelope lacrado com os questionários físicos.</p>
      </div>
    </div>
  </div>
  <p class="declaracao">
    Eu, <b>${args.responsavel.nome}</b>, CPF <b>${args.responsavel.cpf}</b>, no exercício do cargo de
    <b>${args.responsavel.cargo}</b>, declaro que realizei a digitalização de ${args.qtd} questionário(s)
    psicossocial(is) em papel deste lote; comprometo-me a manter os questionários físicos armazenados
    em envelope lacrado, identificado com o código <b>${args.code}</b>, e a tratar as respostas como dados
    sensíveis de natureza sigilosa, abrindo o envelope apenas mediante necessidade administrativa formal
    ou determinação judicial. Estou ciente das responsabilidades previstas na Lei nº 13.709/2018 (LGPD),
    na NR-01 e demais legislações aplicáveis.
  </p>
  <p class="footer">Saúde do Trabalho · Recibo gerado eletronicamente — guarde com o envelope lacrado.</p>
  <script>window.onload=()=>setTimeout(()=>window.print(),300);</script>
</body></html>`;
  const win = window.open("", "_blank");
  if (!win) { alert("Permita pop-ups para imprimir o recibo."); return; }
  win.document.write(html); win.document.close();
}

const TERMO_TEXTO = `Declaro, sob minha responsabilidade pessoal, que:

(a) realizei a digitalização dos questionários psicossociais em papel deste lote;
(b) manterei os questionários físicos armazenados em envelope lacrado, identificado pelo código único gerado neste recibo;
(c) trato as respostas dos colaboradores como dados sensíveis de natureza sigilosa;
(d) somente abrirei o envelope mediante necessidade administrativa formal ou determinação judicial competente;
(e) estou ciente das responsabilidades previstas na Lei nº 13.709/2018 (LGPD), na NR-01 e demais legislações aplicáveis.`;

// R5-P12 #5 — status de processamento do lote (5 estados pedidos pelo Bruno + "aguardando").
const OCR_STATUS: Record<string, { label: string; cls: string }> = {
  aguardando: { label: "Aguardando leitura", cls: "bg-slate-100 text-slate-700" },
  em_processamento: { label: "Em processamento", cls: "bg-blue-100 text-blue-700" },
  processado_sucesso: { label: "Processado com sucesso", cls: "bg-emerald-100 text-emerald-700" },
  processado_parcial: { label: "Processado parcialmente", cls: "bg-amber-100 text-amber-800" },
  processado_inconsistencias: { label: "Processado com inconsistências", cls: "bg-orange-100 text-orange-800" },
  erro: { label: "Erro no processamento", cls: "bg-rose-100 text-rose-700" },
  // compat legado
  pending: { label: "Aguardando leitura", cls: "bg-slate-100 text-slate-700" },
};

export default function UploadQuestionariosImpressos() {
  // R5-P12 #5 — dois modos: criar novo lote (wizard) ou ver histórico.
  const [view, setView] = useState<"novo" | "historico">("novo");
  // Etapas: 1=Lote, 2=Termo, 3=Upload, 4=Recibo
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [batchName, setBatchName] = useState("");
  const [cycleId, setCycleId] = useState<number | "">("");
  const [surveyId, setSurveyId] = useState<number | "">("");
  const [sectorId, setSectorId] = useState<number | "">("");
  const [applicationDate, setApplicationDate] = useState(new Date().toISOString().slice(0, 10));
  const [unit, setUnit] = useState("");
  const [quantity, setQuantity] = useState<number>(1);

  const [respNome, setRespNome] = useState("");
  const [respCpf, setRespCpf] = useState("");
  const [respCargo, setRespCargo] = useState("");
  const [termoAceito, setTermoAceito] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const [batchResult, setBatchResult] = useState<any>(null);

  // tRPC queries — usa procedures já existentes (mesmo padrão do SurveyImportarPapel).
  const cyclesQ = (trpc as any).riskCorrelation.cycleDashboard.useQuery();
  const surveysQ = (trpc as any).surveys.list.useQuery();
  const treeQ = trpc.lessons.hierarchyTree.useQuery();

  const cycles = ((cyclesQ.data as any)?.cycles ?? []) as any[];
  const surveys = (surveysQ.data ?? []) as any[];
  const sectors = (() => {
    const tree = (treeQ.data ?? []) as any[];
    const out: any[] = [];
    for (const c of tree) for (const b of (c.branches ?? [])) for (const s of (b.sectors ?? [])) {
      if (s.sector?.id) out.push({ id: s.sector.id, name: s.sector.name });
    }
    return out;
  })();

  // R5-P12 #5 — histórico de lotes recebidos.
  const batchesQ = (trpc.compliance as any).listPrintedBatches.useQuery(undefined, { enabled: view === "historico" });
  const batches = (batchesQ.data ?? []) as any[];

  const createBatch = (trpc.compliance as any).createPrintedBatch.useMutation({
    onSuccess: (r: any) => {
      setBatchResult(r);
      setStep(4);
      toast.success(`Lote registrado — código ${r.code}`);
      batchesQ.refetch?.();
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  // R5-P12 #6/#7/#8 — leitura automática (OCR) via Vision.
  const [ocrResult, setOcrResult] = useState<any>(null);
  // R5-P13 — quantas páginas compõem UM questionário (ex.: DRPS de 40 questões = ~5 páginas).
  const [pagesPerQ, setPagesPerQ] = useState(1);
  // R5-P13 #5 — conversão de PDF para imagens acontece no navegador (sem depender do servidor).
  const [convertendoPdf, setConvertendoPdf] = useState<string | null>(null);
  const ocrMut = (trpc.compliance as any).processBatchOcr.useMutation({
    onSuccess: (r: any) => { setOcrResult(r.report); toast.success("Leitura automática concluída."); batchesQ.refetch?.(); },
    onError: (e: any) => toast.error(`OCR: ${e.message}`),
  });
  function fileToBase64(f: File): Promise<string> {
    return new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(String(rd.result)); rd.onerror = rej; rd.readAsDataURL(f); });
  }
  // R5-P13 #5 — converte cada página do PDF em uma imagem JPEG de alta resolução
  // (essencial para o OCR enxergar marcas finas de caneta), na ordem das páginas.
  async function pdfFileToImages(f: File): Promise<string[]> {
    const pdfjsLib: any = await import("pdfjs-dist");
    const workerUrlBase = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    // Cache-buster fixo: navegadores que buscaram este .mjs antes de o servidor
    // corrigir o Content-Type (ct=1) tinham a resposta antiga (application/octet-stream)
    // presa em cache "immutable" por até 1 ano. Um sufixo novo força uma entrada de cache
    // nova e nunca mais precisa mudar, já que o servidor está correto desde então.
    const workerUrl = workerUrlBase + "?ct=1";
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
    const buf = await f.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const out: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      setConvertendoPdf(`Convertendo ${f.name} — página ${i}/${pdf.numPages}…`);
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport }).promise;
      out.push(canvas.toDataURL("image/jpeg", 0.92));
    }
    return out;
  }
  async function processarOcr() {
    if (!batchResult?.batchId || files.length === 0) { toast.error("Sem arquivos para ler."); return; }
    const validFiles = files.filter(f => f.type.startsWith("image/") || f.type === "application/pdf");
    if (validFiles.length === 0) { toast.error("Envie PDF, JPG ou PNG para a leitura automática."); return; }
    try {
      const images: string[] = [];
      for (const f of validFiles) {
        if (f.type === "application/pdf") images.push(...(await pdfFileToImages(f)));
        else images.push(await fileToBase64(f));
      }
      ocrMut.mutate({ batchId: batchResult.batchId, images, pagesPerQuestionnaire: Math.max(1, pagesPerQ) });
    } catch (e: any) {
      toast.error(`Falha ao processar arquivo: ${e?.message ?? "erro desconhecido"}`);
    } finally {
      setConvertendoPdf(null);
    }
  }

  const canNextStep1 = useMemo(() =>
    // R5-P13 — setor é obrigatório: todas as respostas do lote são vinculadas a ele.
    !!cycleId && !!surveyId && !!sectorId && !!applicationDate && quantity > 0,
    [cycleId, surveyId, sectorId, applicationDate, quantity]);
  const canNextStep2 = useMemo(() =>
    respNome.trim().length >= 2 && respCpf.replace(/\D/g, "").length >= 11
    && respCargo.trim().length >= 2 && termoAceito,
    [respNome, respCpf, respCargo, termoAceito]);
  const canSubmit = step === 3 && files.length > 0;

  function onPickFiles(ev: React.ChangeEvent<HTMLInputElement>) {
    const arr = Array.from(ev.target.files ?? []);
    setFiles(prev => [...prev, ...arr]);
  }
  function removeFile(i: number) {
    setFiles(prev => prev.filter((_, j) => j !== i));
  }

  function submitBatch() {
    if (!canSubmit) return;
    createBatch.mutate({
      batchName: batchName.trim() || undefined,
      cycleId: Number(cycleId),
      surveyId: Number(surveyId),
      sectorId: sectorId ? Number(sectorId) : undefined,
      applicationDate,
      unit: unit || undefined,
      quantity,
      filesCount: files.length,
      responsavel: { nome: respNome.trim(), cpf: respCpf.trim(), cargo: respCargo.trim() },
      termoAceito: true as const,
    });
  }

  function imprimirRecibo() {
    if (!batchResult) return;
    const sv = surveys.find((s: any) => s.id === Number(surveyId));
    const cy = cycles.find((c: any) => c.id === Number(cycleId));
    const sec = sectors.find((s: any) => s.id === Number(sectorId));
    gerarReciboPDF({
      code: batchResult.code,
      empresa: sv?.companyName || "",
      cycleName: cy?.name || "",
      surveyTitle: sv?.title || "",
      setor: sec?.name || "",
      unit: unit,
      qtd: quantity,
      responsavel: { nome: respNome, cpf: respCpf, cargo: respCargo },
      signedAt: batchResult.signedAt,
    });
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-primary flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            <Upload size={26} /> Upload de Questionários Impressos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Toda a responsabilidade jurídica concentrada em <b>um único termo</b> e <b>um único recibo</b> por lote.
          </p>
        </header>

        {/* R5-P12 #5 — alternância Novo lote / Lotes recebidos */}
        <div className="flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setView("novo")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${view === "novo" ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >Novo lote</button>
          <button
            onClick={() => setView("historico")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${view === "historico" ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >Lotes recebidos</button>
        </div>

        {/* ═══ HISTÓRICO ═══ */}
        {view === "historico" && (
          <section className="bg-white border rounded-xl p-5">
            <h2 className="font-bold text-base flex items-center gap-2 mb-3"><ClipboardList size={18} /> Lotes recebidos</h2>
            {batchesQ.isLoading && <p className="text-sm text-slate-400">Carregando…</p>}
            {!batchesQ.isLoading && batches.length === 0 && (
              <p className="text-sm text-slate-500 py-6 text-center">Nenhum lote enviado ainda.</p>
            )}
            <div className="space-y-2">
              {batches.map((b: any) => {
                const st = OCR_STATUS[b.ocrStatus] ?? OCR_STATUS.aguardando;
                return (
                  <div key={b.id} className="border border-slate-200 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="font-semibold text-sm text-slate-800">
                          {b.batchName || b.surveyTitle || "Lote de questionários"}
                          <span className="ml-2 font-mono text-xs text-slate-400">{b.code}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {b.surveyTitle ? `${b.surveyTitle} · ` : ""}{b.sectorName ? `Setor ${b.sectorName} · ` : ""}
                          {b.unit ? `${b.unit} · ` : ""}Aplicação {b.applicationDate ? new Date(b.applicationDate).toLocaleDateString("pt-BR") : "—"}
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
                      <div><span className="text-slate-400 block">Enviado em</span><b>{b.createdAt ? new Date(b.createdAt).toLocaleString("pt-BR") : "—"}</b></div>
                      <div><span className="text-slate-400 block">Responsável</span><b>{b.responsavel?.nome ?? "—"}</b></div>
                      <div><span className="text-slate-400 block">Arquivos enviados</span><b>{b.filesCount ?? 0}</b></div>
                      <div><span className="text-slate-400 block">Questionários / lidos</span><b>{b.quantity} / {b.ocrResponsesCount ?? 0}</b></div>
                    </div>
                    {/* R5-P12 #6 / R5-P13 — relatório da leitura automática (agrupado + tooltips) */}
                    {b.ocrReport && (
                      <div className="mt-2 pt-2 border-t">
                        <OcrReport r={b.ocrReport} compact />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Stepper */}
        {view === "novo" && (
        <div className="flex items-center justify-between bg-white border rounded-xl p-3 text-xs">
          {[
            { n: 1, label: "1. Lote" },
            { n: 2, label: "2. Termo" },
            { n: 3, label: "3. Upload" },
            { n: 4, label: "4. Recibo" },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold ${step >= s.n ? "bg-primary text-white" : "bg-slate-200 text-slate-500"}`}>{s.n}</div>
              <span className={step >= s.n ? "text-slate-800 font-semibold" : "text-slate-400"}>{s.label}</span>
              {i < 3 && <div className={`flex-1 h-0.5 ${step > s.n ? "bg-primary" : "bg-slate-200"}`} />}
            </div>
          ))}
        </div>
        )}

        {/* Etapa 1 — Identificação do lote */}
        {view === "novo" && step === 1 && (
          <section className="bg-white border rounded-xl p-5 space-y-3">
            <h2 className="font-bold text-base flex items-center gap-2"><ClipboardList size={18} /> Identificação do Lote</h2>
            <p className="text-xs text-muted-foreground">As informações abaixo vinculam este lote ao ciclo psicossocial — sem isso as respostas não alimentam o seu PGR.</p>
            {/* R5-P12 #9 — reforço da orientação de preenchimento pro RH */}
            <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded p-2">
              Antes de digitalizar: confirme que os questionários foram preenchidos com <b>uma alternativa por pergunta</b> e <b>sem rasuras</b>.
              Respostas rasuradas ou com múltiplas marcações são desconsideradas pela leitura automática — as demais permanecem válidas.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm md:col-span-2">
                <span className="block text-xs font-semibold text-slate-600 mb-1">Nome do lote (opcional)</span>
                <Input value={batchName} onChange={e => setBatchName(e.target.value)} placeholder="Ex.: DRPS Matriz — Turma A" />
              </label>
              <label className="text-sm">
                <span className="block text-xs font-semibold text-slate-600 mb-1">Ciclo Psicossocial *</span>
                <select value={cycleId} onChange={e => setCycleId(e.target.value ? Number(e.target.value) : "")} className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm">
                  <option value="">— Selecione —</option>
                  {cycles.map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.status ? ` (${c.status})` : ""}</option>)}
                </select>
              </label>
              <label className="text-sm">
                <span className="block text-xs font-semibold text-slate-600 mb-1">Pesquisa *</span>
                <select value={surveyId} onChange={e => setSurveyId(e.target.value ? Number(e.target.value) : "")} className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm">
                  <option value="">— Selecione —</option>
                  {surveys.map((s: any) => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
              </label>
              <label className="text-sm md:col-span-2">
                <span className="block text-xs font-semibold text-slate-600 mb-1">Setor * (obrigatório)</span>
                <select value={sectorId} onChange={e => setSectorId(e.target.value ? Number(e.target.value) : "")} className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm">
                  <option value="">— Selecione —</option>
                  {sectors.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Selecione o setor correspondente aos questionários deste lote. Todos os questionários enviados devem pertencer ao mesmo setor.
                </p>
                {/* R5-P13 — a resposta é vinculada ao setor selecionado aqui, não ao que o
                    colaborador escreveu à mão no papel (que serve só para conferência do RH). */}
                <div className="mt-2 flex items-start gap-2 text-[11px] text-sky-700 bg-sky-50 border border-sky-200 rounded-lg p-2.5">
                  <AlertCircle size={13} className="text-sky-500 shrink-0 mt-0.5" />
                  <span>
                    <b>Importante:</b> cada lote deve conter questionários de apenas um único setor. As respostas dos colaboradores são anônimas e serão vinculadas <b>automaticamente</b> ao setor selecionado nesta tela — o campo "Setor" preenchido à mão no papel serve apenas para conferência do RH. Caso existam questionários de outros setores, crie um novo lote de importação.
                  </span>
                </div>
              </label>
              <label className="text-sm">
                <span className="block text-xs font-semibold text-slate-600 mb-1">Unidade / Filial (opcional)</span>
                <Input value={unit} onChange={e => setUnit(e.target.value)} placeholder="Ex.: Matriz, Filial SP…" />
              </label>
              <label className="text-sm">
                <span className="block text-xs font-semibold text-slate-600 mb-1">Data da aplicação *</span>
                <Input type="date" value={applicationDate} onChange={e => setApplicationDate(e.target.value)} />
              </label>
              <label className="text-sm">
                <span className="block text-xs font-semibold text-slate-600 mb-1">Quantidade de questionários no lote *</span>
                <Input type="number" min={1} value={quantity} onChange={e => setQuantity(Number(e.target.value) || 1)} />
              </label>
            </div>

            <div className="flex justify-end pt-2">
              <Button disabled={!canNextStep1} onClick={() => setStep(2)}>Próximo</Button>
            </div>
          </section>
        )}

        {/* Etapa 2 — Termo de Confidencialidade */}
        {view === "novo" && step === 2 && (
          <section className="bg-white border rounded-xl p-5 space-y-3">
            <h2 className="font-bold text-base flex items-center gap-2"><ShieldCheck size={18} /> Termo de Confidencialidade do Lote</h2>
            <p className="text-xs text-muted-foreground">Este termo se aplica ao lote inteiro. Não há termo por pesquisa.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="text-sm">
                <span className="block text-xs font-semibold text-slate-600 mb-1">Nome completo *</span>
                <Input value={respNome} onChange={e => setRespNome(e.target.value)} />
              </label>
              <label className="text-sm">
                <span className="block text-xs font-semibold text-slate-600 mb-1">CPF *</span>
                <Input value={respCpf} onChange={e => setRespCpf(e.target.value)} placeholder="000.000.000-00" />
              </label>
              <label className="text-sm">
                <span className="block text-xs font-semibold text-slate-600 mb-1">Cargo *</span>
                <Input value={respCargo} onChange={e => setRespCargo(e.target.value)} placeholder="Analista de RH" />
              </label>
            </div>

            <Textarea value={TERMO_TEXTO} readOnly rows={9} className="text-xs leading-relaxed bg-slate-50" />

            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={termoAceito} onChange={e => setTermoAceito(e.target.checked)} className="mt-1" />
              <span className="text-sm text-slate-700">
                Li, concordo e assino eletronicamente o termo acima.
                <span className="block text-xs text-slate-500">Sua assinatura fica registrada com data, hora e usuário.</span>
              </span>
            </label>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
              <Button disabled={!canNextStep2} onClick={() => setStep(3)}>Próximo</Button>
            </div>
          </section>
        )}

        {/* Etapa 3 — Upload dos arquivos */}
        {view === "novo" && step === 3 && (
          <section className="bg-white border rounded-xl p-5 space-y-3">
            <h2 className="font-bold text-base flex items-center gap-2"><FileText size={18} /> Upload dos questionários digitalizados</h2>
            <p className="text-xs text-muted-foreground">Aceita PDF, JPG e PNG. Adicione todos os arquivos do lote antes de enviar.</p>

            <label className="block border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-primary cursor-pointer">
              <Upload size={28} className="mx-auto text-slate-400 mb-2" />
              <span className="text-sm text-slate-600">Clique ou arraste arquivos</span>
              <input type="file" multiple accept="application/pdf,image/png,image/jpeg" className="hidden" onChange={onPickFiles} />
            </label>

            {files.length > 0 && (
              <ul className="space-y-1 text-sm">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between border rounded px-2 py-1">
                    <span className="truncate">{f.name} <span className="text-xs text-slate-400">({Math.round(f.size/1024)} KB)</span></span>
                    <button onClick={() => removeFile(i)} className="text-rose-500 text-xs hover:underline">Remover</button>
                  </li>
                ))}
              </ul>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800 flex gap-2 items-start">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <p>O OCR/leitura automática das respostas roda em segundo plano e não bloqueia o envio. Você pode acompanhar o status do lote em <b>"Lotes recebidos"</b>.</p>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
              <Button disabled={!canSubmit || createBatch.isPending} onClick={submitBatch}>
                {createBatch.isPending ? "Registrando lote..." : "Confirmar e gerar Recibo"}
              </Button>
            </div>
          </section>
        )}

        {/* Etapa 4 — Recibo */}
        {view === "novo" && step === 4 && batchResult && (
          <section className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 size={24} className="text-emerald-700" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-emerald-900">Lote registrado!</h2>
                <p className="text-xs text-emerald-800">Imprima o recibo abaixo e fixe na frente do envelope lacrado.</p>
              </div>
            </div>

            <div className="bg-white border border-emerald-300 rounded-lg p-4 flex items-center gap-4">
              <QrCode size={36} className="text-emerald-700" />
              <div className="flex-1">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Código de rastreabilidade</p>
                <p className="font-mono text-lg font-bold text-slate-800">{batchResult.code}</p>
                <p className="text-xs text-slate-500">Assinado por {respNome} · CPF {respCpf} · {new Date(batchResult.signedAt).toLocaleString("pt-BR")}</p>
              </div>
              <Hash size={16} className="text-slate-300" />
            </div>

            {/* R5-P13 — questionário multipágina: informa quantas páginas formam UM questionário */}
            <div className="flex items-center gap-2 mb-2 text-xs bg-sky-50 border border-sky-200 rounded-lg p-2.5">
              <AlertCircle size={14} className="text-sky-500 shrink-0" />
              <label className="flex items-center gap-2 flex-wrap">
                <span>Este questionário ocupa</span>
                <input type="number" min={1} max={20} value={pagesPerQ}
                  onChange={e => setPagesPerQ(Math.max(1, Number(e.target.value) || 1))}
                  className="w-16 border rounded px-2 py-1 text-center" />
                <span>página(s) impressa(s).</span>
              </label>
              <span className="text-slate-500">Ex.: o DRPS de 40 questões costuma ter ~5 páginas. As páginas de cada questionário são <b>mescladas</b> em uma única resposta — evita contar 1 pessoa como vários respondentes.</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={imprimirRecibo} className="gap-2 bg-emerald-700 hover:bg-emerald-800 text-white">
                <FileText size={14} /> Imprimir Recibo de Confidencialidade
              </Button>
              {/* R5-P12 #6 — leitura automática (OCR) */}
              <Button onClick={processarOcr} disabled={ocrMut.isPending || !!convertendoPdf} variant="outline" className="gap-2">
                {convertendoPdf ? "Convertendo PDF..." : ocrMut.isPending ? "Lendo..." : "Processar leitura automática (OCR)"}
              </Button>
              <Button variant="outline" onClick={() => { setStep(1); setBatchResult(null); setFiles([]); setOcrResult(null); setRespNome(""); setRespCpf(""); setRespCargo(""); setTermoAceito(false); setQuantity(1); }}>
                Novo lote
              </Button>
            </div>
            {convertendoPdf && <p className="text-xs text-sky-600 mt-1">{convertendoPdf}</p>}

            {/* R5-P12 #6 / R5-P13 — relatório de aproveitamento da leitura (agrupado + tooltips) */}
            {ocrResult && (
              <div className="mt-4 bg-white border rounded-lg p-4">
                <div className="font-semibold text-sm mb-2">Retorno da leitura automática</div>
                <OcrReport r={ocrResult} />
              </div>
            )}
          </section>
        )}
      </div>
    </AppLayout>
  );
}
