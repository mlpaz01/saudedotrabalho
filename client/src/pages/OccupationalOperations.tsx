import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertTriangle,
  ClipboardCheck,
  ClipboardList,
  Download,
  FileClock,
  FileHeart,
  FilePlus2,
  History,
  Microscope,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Stethoscope,
  UserRoundCheck,
} from "lucide-react";
import { toast } from "sonner";

type Tab = "painel" | "requisicoes" | "resultados" | "catalogo" | "prestadores" | "anamnese" | "cat_os" | "auditoria";

const tabs: Array<{ id: Tab; label: string; icon: any }> = [
  { id: "painel", label: "Painel", icon: Activity },
  { id: "requisicoes", label: "Requisições", icon: FileClock },
  { id: "resultados", label: "Resultados", icon: Microscope },
  { id: "catalogo", label: "Catálogo de exames", icon: ClipboardList },
  { id: "prestadores", label: "Prestadores", icon: ShieldCheck },
  { id: "anamnese", label: "Anamnese e ASO", icon: Stethoscope },
  { id: "cat_os", label: "CAT e Ordem de Serviço", icon: ClipboardCheck },
  { id: "auditoria", label: "Auditoria", icon: History },
];

const admissionQuestions = [
  "Possui alguma doença diagnosticada?",
  "Possui doença crônica?",
  "Faz tratamento médico atualmente?",
  "Utiliza medicamentos regularmente?",
  "Possui alergias conhecidas?",
  "Já foi internado anteriormente?",
  "Já realizou cirurgias?",
  "Já sofreu acidentes importantes?",
  "Já teve doença relacionada ao trabalho?",
  "Já recebeu benefício previdenciário?",
  "Já ficou afastado do trabalho por motivo de saúde?",
  "Possui histórico de problemas respiratórios?",
  "Possui histórico cardiovascular?",
  "Possui histórico osteomuscular?",
  "Possui alterações auditivas?",
  "Possui alterações visuais?",
  "Possui problemas neurológicos?",
  "Possui acompanhamento psicológico ou psiquiátrico?",
  "Faz uso de tabaco?",
  "Consome bebidas alcoólicas?",
  "Pratica atividade física?",
  "Como considera sua qualidade do sono?",
  "Possui doenças importantes na família?",
  "Já teve exposição ocupacional relevante em empregos anteriores?",
  "Já utilizou EPI em empregos anteriores?",
  "Já trabalhou exposto a ruído?",
  "Já trabalhou exposto a produtos químicos?",
  "Já trabalhou em altura, espaço confinado ou outra atividade crítica?",
  "Possui alguma limitação importante para informar ao médico?",
  "Deseja relatar alguma outra condição de saúde?",
];

const periodicQuestions = [
  "Houve alteração importante na saúde desde o último exame?",
  "Está realizando algum tratamento?",
  "Houve início de algum medicamento?",
  "Houve internação desde o último exame?",
  "Houve cirurgia?",
  "Teve afastamento do trabalho?",
  "Teve acidente de trabalho?",
  "Teve doença relacionada ao trabalho?",
  "Apresenta dores frequentes?",
  "Apresenta sintomas musculoesqueléticos?",
  "Apresenta zumbido?",
  "Apresenta dificuldade auditiva?",
  "Apresenta alteração visual?",
  "Apresenta falta de ar?",
  "Apresenta tosse persistente?",
  "Apresenta tonturas?",
  "Apresenta desmaios?",
  "Apresenta palpitações?",
  "Apresenta alteração do sono?",
  "Apresenta cansaço excessivo?",
  "Apresenta sintomas relacionados ao estresse?",
  "Houve mudança na exposição ocupacional?",
  "Está utilizando os EPIs previstos?",
  "Houve dificuldade no uso dos EPIs?",
  "Houve mudança de função ou atividade?",
  "Houve mudança de setor?",
  "Está exposto aos mesmos riscos do último exame?",
  "Pratica atividade física?",
  "Houve mudança importante nos hábitos de saúde?",
  "Existe alguma queixa relacionada ao trabalho?",
];

const contextualQuestions: Record<string, string[]> = {
  retorno: ["Qual foi o motivo do afastamento?", "Qual foi o período do afastamento?", "Houve benefício previdenciário?", "Foi apresentado laudo ou alta médica?", "Existe tratamento em andamento?", "Utiliza medicamentos?", "Há restrições ou limitações atuais?", "Consegue retornar às atividades anteriores?", "Há necessidade de adaptação?", "Como percebe sua capacidade para o retorno?", "Os riscos do GSE atual foram reavaliados?", "Há necessidade de acompanhamento?"],
  mudanca_risco: ["Qual era a função anterior?", "Qual é a nova função?", "Qual era o setor anterior?", "Qual é o novo setor?", "Quais eram os riscos anteriores?", "Quais são os novos riscos?", "Existem atividades críticas?", "Há treinamentos pendentes?", "Os EPIs foram definidos?", "A exposição é diferente?", "Há sintomas relacionados à nova exposição?", "São necessários exames adicionais?"],
  demissional: ["Qual é o estado de saúde atual?", "Existem queixas atuais?", "Houve doenças recentes?", "Houve afastamentos?", "Houve acidentes?", "Existe suspeita de doença ocupacional?", "Há tratamento ou medicação em andamento?", "Houve mudança de função?", "Quais foram as exposições relevantes?", "Os EPIs foram utilizados?", "Há queixas relacionadas ao trabalho?", "Existem exames recentes?", "É necessária investigação adicional?", "Há condição clínica para encerramento?"],
};

function Panel({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="border bg-white"><div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3"><div><h2 className="font-semibold text-slate-950">{title}</h2>{subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}</div>{action}</div><div className="p-4">{children}</div></section>;
}

function Metric({ label, value, warning }: { label: string; value: string | number; warning?: boolean }) {
  return <div className={`border p-4 ${warning ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-950">{value}</p></div>;
}

function downloadData(dataBase64: string, fileName: string) {
  const anchor = document.createElement("a");
  anchor.href = dataBase64;
  anchor.download = fileName;
  anchor.click();
}

function dateOnly(value: any) {
  if (!value) return "-";
  const text = String(value).slice(0, 10);
  return text.split("-").reverse().join("/");
}

function statusTone(status: string) {
  const value = String(status || "");
  if (["realizada", "normal", "apto", "emitido", "enviado"].includes(value)) return "bg-emerald-100 text-emerald-800";
  if (["alterado", "vencida", "inapto", "falhou"].includes(value)) return "bg-red-100 text-red-800";
  if (["pendente", "pendente_revisao", "enviada", "rascunho"].includes(value)) return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

export default function OccupationalOperations() {
  const { user } = useAuth();
  const isDoctor = user?.role === "medico";
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<Tab>("painel");
  const [workerQuery, setWorkerQuery] = useState("");
  const [orderOpen, setOrderOpen] = useState(false);
  const [pcmsoOrderOpen, setPcmsoOrderOpen] = useState(false);
  const [selectedPopulation, setSelectedPopulation] = useState<Array<{ collaboratorId: number; monitoringId: number }>>([]);
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [resultOpen, setResultOpen] = useState(false);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [examOpen, setExamOpen] = useState(false);
  const [providerOpen, setProviderOpen] = useState(false);
  const [reissue, setReissue] = useState<any>(null);
  const [review, setReview] = useState<any>(null);
  const [clinicalWorkerId, setClinicalWorkerId] = useState(0);
  const [catOpen, setCatOpen] = useState(false);
  const [osOpen, setOsOpen] = useState(false);

  const dashboardQ = trpc.occupationalLifecycle.dashboard.useQuery();
  const workersQ = trpc.occupationalLifecycle.listWorkers.useQuery({ query: workerQuery || undefined });
  const examsQ = trpc.occupationalLifecycle.listExamCatalog.useQuery();
  const providersQ = trpc.occupationalLifecycle.listProviders.useQuery();
  const ordersQ = trpc.occupationalLifecycle.listExamOrders.useQuery();
  const populationQ = trpc.occupationalLifecycle.listExamPopulation.useQuery();
  const resultsQ = trpc.occupationalLifecycle.listExamResults.useQuery();
  const asosQ = trpc.occupationalLifecycle.listAsos.useQuery();
  const catsQ = trpc.occupationalLifecycle.listCats.useQuery();
  const workOrdersQ = trpc.occupationalLifecycle.listWorkOrders.useQuery();
  const auditQ = trpc.occupationalLifecycle.auditTrail.useQuery(undefined, { enabled: tab === "auditoria" });
  const clinicalQ = trpc.occupationalLifecycle.getAnamnesisContext.useQuery({ collaboratorId: clinicalWorkerId || 0 }, { enabled: isDoctor && Boolean(clinicalWorkerId) });
  const asoValidationQ = trpc.occupationalLifecycle.validateAso.useQuery({ collaboratorId: clinicalWorkerId || 0 }, { enabled: isDoctor && Boolean(clinicalWorkerId) });

  const refresh = async () => {
    await Promise.all([
      utils.occupationalLifecycle.dashboard.invalidate(),
      utils.occupationalLifecycle.listExamOrders.invalidate(),
      utils.occupationalLifecycle.listExamPopulation.invalidate(),
      utils.occupationalLifecycle.listExamResults.invalidate(),
      utils.occupationalLifecycle.listExamCatalog.invalidate(),
      utils.occupationalLifecycle.listProviders.invalidate(),
      utils.occupationalLifecycle.listAsos.invalidate(),
      utils.occupationalLifecycle.listCats.invalidate(),
      utils.occupationalLifecycle.listWorkOrders.invalidate(),
      utils.occupationalLifecycle.getAnamnesisContext.invalidate(),
      utils.occupationalLifecycle.validateAso.invalidate(),
    ]);
  };

  const orderCreate = trpc.occupationalLifecycle.createExamOrders.useMutation({ onSuccess: async result => { await refresh(); setOrderOpen(false); toast.success(`${result.created} requisição(ões) gerada(s).`); }, onError: error => toast.error(error.message) });
  const pcmsoOrderCreate = trpc.occupationalLifecycle.createExamOrdersFromPcmso.useMutation({ onSuccess: async result => { await refresh(); setPcmsoOrderOpen(false); setSelectedPopulation([]); toast.success(`${result.created} requisição(ões) gerada(s) pelo PCMSO${result.skipped ? `; ${result.skipped} já possuíam requisição válida` : ""}.`); }, onError: error => toast.error(error.message) });
  const reissueOrder = trpc.occupationalLifecycle.reissueExamOrder.useMutation({ onSuccess: async result => { await refresh(); setReissue(null); toast.success(`${result.label} emitida sem apagar o documento original.`); }, onError: error => toast.error(error.message) });
  const generateOrderPdf = trpc.occupationalLifecycle.generateExamOrderPdf.useMutation({ onSuccess: result => { downloadData(result.dataBase64, result.fileName); toast.success("PDF gerado e arquivado."); }, onError: error => toast.error(error.message) });
  const generateGroupedPdf = trpc.occupationalLifecycle.generateGroupedExamOrderPdf.useMutation({ onSuccess: result => { downloadData(result.dataBase64, result.fileName); toast.success(`${result.total} requisições reunidas no PDF.`); }, onError: error => toast.error(error.message) });
  const emailOrder = trpc.occupationalLifecycle.sendExamOrderEmail.useMutation({ onSuccess: result => { refresh(); toast.success(result.preview ? "Envio registrado em modo de prévia." : "Requisição enviada por e-mail."); }, onError: error => toast.error(error.message) });
  const resultCreate = trpc.occupationalLifecycle.recordExamResult.useMutation({ onSuccess: async () => { await refresh(); setResultOpen(false); toast.success("Resultado recebido e enviado para revisão médica."); }, onError: error => toast.error(error.message) });
  const ocrAnalyze = trpc.occupationalLifecycle.analyzeExamDocumentsOcr.useMutation({ onError: error => toast.error(error.message) });
  const ocrResultCreate = trpc.occupationalLifecycle.recordExamResult.useMutation({ onError: error => toast.error(error.message) });
  const resultReview = trpc.occupationalLifecycle.reviewExamResult.useMutation({ onSuccess: async () => { await refresh(); setReview(null); toast.success("Resultado revisado pelo médico."); }, onError: error => toast.error(error.message) });
  const resultDocument = trpc.occupationalLifecycle.getExamResultDocument.useMutation({ onSuccess: result => downloadData(result.dataBase64, result.fileName), onError: error => toast.error(error.message) });
  const examSave = trpc.occupationalLifecycle.upsertExamCatalog.useMutation({ onSuccess: async () => { await refresh(); setExamOpen(false); toast.success("Exame salvo no catálogo central."); }, onError: error => toast.error(error.message) });
  const providerSave = trpc.occupationalLifecycle.upsertProvider.useMutation({ onSuccess: async () => { await refresh(); setProviderOpen(false); toast.success("Prestador salvo."); }, onError: error => toast.error(error.message) });
  const anamnesisSave = trpc.occupationalLifecycle.saveAnamnesis.useMutation({ onSuccess: async () => { await refresh(); toast.success("Anamnese registrada no prontuário ocupacional."); }, onError: error => toast.error(error.message) });
  const asoIssue = trpc.occupationalLifecycle.issueAso.useMutation({ onSuccess: async result => { await refresh(); downloadData(result.dataBase64, result.fileName); toast.success("ASO emitido e arquivado. A assinatura certificada permanece pendente."); }, onError: error => toast.error(error.message) });
  const catCreate = trpc.occupationalLifecycle.createCat.useMutation({ onSuccess: async result => { await refresh(); setCatOpen(false); toast.success(`CAT registrada. Evento ${result.esocialEvent} preparado para futura integração.`); }, onError: error => toast.error(error.message) });
  const osCreate = trpc.occupationalLifecycle.createWorkOrder.useMutation({ onSuccess: async result => { await refresh(); setOsOpen(false); toast.success(`${result.created} Ordem(ns) de Serviço criada(s).`); }, onError: error => toast.error(error.message) });

  const workers = (workersQ.data || []) as any[];
  const exams = (examsQ.data || []) as any[];
  const providers = (providersQ.data || []) as any[];
  const orders = (ordersQ.data || []) as any[];
  const examPopulation = (populationQ.data || []) as any[];
  const results = (resultsQ.data || []) as any[];
  const dashboard = dashboardQ.data as any;

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1540px] space-y-5 p-4 md:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-teal-700"><ShieldCheck size={15} /> Fluxo ocupacional integrado</div>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">GSE, PCMSO, Exames e ASO</h1>
            <p className="mt-1 max-w-4xl text-sm text-slate-500">Da parametrização do trabalhador ao resultado, decisão médica, documento versionado e conformidade.</p>
          </div>
          <Badge className={`rounded-sm ${isDoctor ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"}`}>{isDoctor ? "Visão clínica - Médico" : "Visão operacional - SESMT"}</Badge>
        </header>

        <div className="flex gap-1 overflow-x-auto border-b pb-1">
          {tabs.filter(item => isDoctor || item.id !== "anamnese").map(item => { const Icon = item.icon; return <button key={item.id} onClick={() => setTab(item.id)} className={`flex h-9 shrink-0 items-center gap-2 border-b-2 px-3 text-xs font-semibold ${tab === item.id ? "border-teal-600 text-teal-800" : "border-transparent text-slate-500"}`}><Icon size={14} />{item.label}</button>; })}
        </div>

        {tab === "painel" && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <Metric label="Cobertura GSE" value={`${Number(dashboard?.gse_coverage || 0)}%`} warning={Number(dashboard?.workers_without_gse || 0) > 0} />
              <Metric label="Sem GSE" value={Number(dashboard?.workers_without_gse || 0)} warning={Number(dashboard?.workers_without_gse || 0) > 0} />
              <Metric label="Requisições pendentes" value={Number(dashboard?.pending_orders || 0)} warning={Number(dashboard?.pending_orders || 0) > 0} />
              <Metric label="Resultados a revisar" value={Number(dashboard?.pending_results || 0)} warning={Number(dashboard?.pending_results || 0) > 0} />
              <Metric label="ASOs emitidos" value={Number(dashboard?.issued_asos || 0)} />
              <Metric label="CATs sem envio" value={Number(dashboard?.pending_cats || 0)} warning={Number(dashboard?.pending_cats || 0) > 0} />
            </div>
            <Panel title="Arquitetura operacional" subtitle="Nenhum dado clínico é redigitado quando pode ser derivado de uma parametrização existente.">
              <div className="grid gap-2 text-center text-sm md:grid-cols-5">
                {["Trabalhador + GSE", "PGR + riscos", "PCMSO + exames", "Resultado + atendimento", "ASO + conformidade"].map((label, index) => <div key={label} className="flex items-center gap-2"><div className="flex-1 border bg-slate-50 px-3 py-5 font-semibold text-slate-800">{label}</div>{index < 4 && <span className="hidden text-teal-600 md:inline">→</span>}</div>)}
              </div>
              <div className="mt-4 border-l-4 border-amber-400 bg-amber-50 p-3 text-sm text-amber-950">Resultados, anamnese, conclusão de aptidão e justificativas médicas permanecem restritos ao perfil Médico. O SESMT acompanha logística, documentos, prazos e situação operacional.</div>
            </Panel>
          </>
        )}

        {tab === "requisicoes" && (
          <div className="space-y-4">
            {!isDoctor && <Panel title="População prevista no PCMSO" subtitle="A lista é derivada automaticamente do GSE mestre e dos exames complementares aprovados pelo Médico.">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div className="text-sm text-slate-600"><b>{examPopulation.length}</b> vínculo(s) trabalhador/exame encontrados · <b>{examPopulation.filter(row => row.operational_status === "requisicao_pendente").length}</b> aguardam requisição</div><Button disabled={!selectedPopulation.length} onClick={() => setPcmsoOrderOpen(true)}><FilePlus2 size={14} className="mr-2" /> Gerar pelo PCMSO ({selectedPopulation.length})</Button></div>
              <div className="max-h-72 overflow-auto border"><table className="w-full min-w-[1000px] text-sm"><thead className="sticky top-0 bg-slate-50 text-xs text-slate-600"><tr><th className="w-10 p-2"><input type="checkbox" checked={Boolean(examPopulation.length) && selectedPopulation.length === examPopulation.filter(row => row.operational_status === "requisicao_pendente").length} onChange={event => setSelectedPopulation(event.target.checked ? examPopulation.filter(row => row.operational_status === "requisicao_pendente").map(row => ({ collaboratorId: Number(row.collaborator_id), monitoringId: Number(row.monitoring_id) })) : [])} /></th><th className="p-2 text-left">Trabalhador</th><th className="p-2 text-left">GSE</th><th className="p-2 text-left">PCMSO</th><th className="p-2 text-left">Exame</th><th className="p-2 text-left">Periodicidade</th><th className="p-2 text-left">Situação</th></tr></thead><tbody>{examPopulation.map(row => { const key = `${row.collaborator_id}:${row.monitoring_id}`; const checked = selectedPopulation.some(item => `${item.collaboratorId}:${item.monitoringId}` === key); const available = row.operational_status === "requisicao_pendente"; return <tr key={key} className="border-t"><td className="p-2 text-center"><input type="checkbox" disabled={!available} checked={checked} onChange={() => setSelectedPopulation(current => checked ? current.filter(item => `${item.collaboratorId}:${item.monitoringId}` !== key) : [...current, { collaboratorId: Number(row.collaborator_id), monitoringId: Number(row.monitoring_id) }])} /></td><td className="p-2 font-medium">{row.collaborator_name}<br /><span className="text-xs text-slate-500">{row.position || "Sem cargo"}</span></td><td className="p-2">{row.gse_code} · {row.gse_name}</td><td className="p-2">{row.pcmso_title}</td><td className="p-2 font-medium">{row.exam_name}</td><td className="p-2">{row.periodicity || "Definida pelo médico"}</td><td className="p-2"><Badge className={`rounded-sm ${statusTone(row.operational_status)}`}>{String(row.operational_status).replaceAll("_", " ")}</Badge></td></tr>; })}</tbody></table>{!examPopulation.length && <p className="p-6 text-center text-sm text-slate-500">Nenhum exame complementar aprovado em PCMSO vigente foi encontrado para a população atual.</p>}</div>
            </Panel>}
            <Panel title="Requisições de exames ocupacionais" subtitle="Cada emissão possui número, validade, prestador, local e histórico próprios." action={!isDoctor && <div className="flex gap-2"><Button variant="outline" disabled={!selectedOrders.length} onClick={() => generateGroupedPdf.mutate({ ids: selectedOrders })}><Download size={14} className="mr-2" /> PDF agrupado ({selectedOrders.length})</Button><Button variant="outline" onClick={() => setOrderOpen(true)}><Plus size={14} className="mr-2" /> Exceção manual</Button></div>}>
              <div className="overflow-auto border"><table className="w-full min-w-[1220px] text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="w-10 p-2"><input type="checkbox" checked={Boolean(orders.length) && selectedOrders.length === orders.length} onChange={event => setSelectedOrders(event.target.checked ? orders.map(row => Number(row.id)) : [])} /></th><th className="p-2 text-left">Requisição</th><th className="p-2 text-left">Trabalhador</th><th className="p-2 text-left">GSE</th><th className="p-2 text-left">Exame</th><th className="p-2 text-left">Prestador</th><th className="p-2 text-left">Validade</th><th className="p-2 text-left">Situação</th><th className="p-2 text-right">Ações</th></tr></thead><tbody>{orders.map(row => <tr key={row.id} className="border-t"><td className="p-2 text-center"><input type="checkbox" checked={selectedOrders.includes(Number(row.id))} onChange={() => setSelectedOrders(current => current.includes(Number(row.id)) ? current.filter(id => id !== Number(row.id)) : [...current, Number(row.id)])} /></td><td className="p-2"><span className="font-semibold">{row.order_number}</span><br /><span className="text-xs text-slate-500">{row.version_label}</span></td><td className="p-2">{row.collaborator_name}<br /><span className="text-xs text-slate-500">{row.cpf || row.employee_registration || "-"}</span></td><td className="p-2">{row.gse_code || "-"}<br /><span className="text-xs text-slate-500">{row.gse_name || "Sem GSE"}</span></td><td className="p-2 font-medium">{row.exam_name}</td><td className="p-2">{row.provider_trade_name || row.provider_legal_name || "A definir"}</td><td className="p-2">{dateOnly(row.valid_until)}</td><td className="p-2"><Badge className={`rounded-sm ${statusTone(row.status)}`}>{row.status}</Badge></td><td className="p-2"><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" title="Gerar PDF" onClick={() => generateOrderPdf.mutate({ id: Number(row.id) })}><Download size={15} /></Button>{!isDoctor && <><Button size="icon" variant="ghost" title="Enviar por e-mail" onClick={() => emailOrder.mutate({ id: Number(row.id) })}><Send size={15} /></Button><Button size="sm" variant="outline" onClick={() => setReissue(row)}>Emitir nova via</Button></>}</div></td></tr>)}</tbody></table>{!orders.length && <p className="p-8 text-center text-sm text-slate-500">Nenhuma requisição emitida.</p>}</div>
            </Panel>
          </div>
        )}

        {tab === "resultados" && (
          <Panel title="Resultados de exames" subtitle={isDoctor ? "Referências do próprio laudo orientam a revisão. A plataforma não produz diagnóstico nem aptidão automática." : "O SESMT recebe e vincula o documento. Conteúdo clínico detalhado fica restrito ao Médico."} action={<div className="flex gap-2"><Button variant="outline" onClick={() => setOcrOpen(true)}><Microscope size={14} className="mr-2" /> Importar lote OCR</Button><Button onClick={() => setResultOpen(true)}><FilePlus2 size={14} className="mr-2" /> Lançar resultado</Button></div>}>
            <div className="overflow-auto border"><table className="w-full min-w-[1050px] text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="p-2 text-left">Trabalhador</th><th className="p-2 text-left">Exame</th><th className="p-2 text-left">Data</th><th className="p-2 text-left">Origem</th><th className="p-2 text-left">Identidade</th><th className="p-2 text-left">Classificação</th><th className="p-2 text-left">Resumo</th>{isDoctor && <th className="p-2"></th>}</tr></thead><tbody>{results.map(row => <tr key={row.id} className="border-t"><td className="p-2 font-medium">{row.collaborator_name}</td><td className="p-2">{row.exam_name}</td><td className="p-2">{new Date(row.performed_at).toLocaleDateString("pt-BR")}</td><td className="p-2">{row.source}</td><td className="p-2">{row.identity_status}</td><td className="p-2"><Badge className={`rounded-sm ${statusTone(row.classification)}`}>{row.classification.replaceAll("_", " ")}</Badge></td><td className="max-w-md p-2 text-xs text-slate-600">{row.result_summary || "Documento recebido"}</td>{isDoctor && <td className="p-2 text-right"><Button size="sm" variant="outline" onClick={() => setReview(row)}>Revisar</Button></td>}</tr>)}</tbody></table></div>
          </Panel>
        )}

        {tab === "catalogo" && (
          <Panel title="Catálogo central de exames ocupacionais" subtitle="Fonte única para PCMSO, requisições, resultados, ASO e relatório analítico." action={isDoctor && <Button onClick={() => setExamOpen(true)}><Plus size={14} className="mr-2" /> Novo exame</Button>}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{exams.map(row => <div key={row.id} className="border p-3"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold text-slate-900">{row.name}</p><p className="text-xs text-slate-500">{row.category || "Sem categoria"} · {row.exam_type}</p></div><Badge className={`rounded-sm ${Number(row.is_active) ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{Number(row.is_active) ? "ativo" : "inativo"}</Badge></div><p className="mt-3 text-sm text-slate-600">{row.description || "Sem descrição."}</p><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500"><span>Resultado: {row.result_type}</span><span>Periodicidade: {row.default_periodicity || "médica"}</span></div></div>)}</div>
          </Panel>
        )}

        {tab === "prestadores" && (
          <Panel title="Prestadores de Saúde Ocupacional" subtitle="Credenciamento, exames realizados, atendimento in loco e validade documental." action={!isDoctor && <Button onClick={() => setProviderOpen(true)}><Plus size={14} className="mr-2" /> Novo prestador</Button>}>
            <div className="overflow-auto border"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="p-2 text-left">Prestador</th><th className="p-2 text-left">CNPJ</th><th className="p-2 text-left">Contato</th><th className="p-2 text-left">Modalidade</th><th className="p-2 text-left">Credenciamento</th><th className="p-2 text-left">Validade</th></tr></thead><tbody>{providers.map(row => <tr key={row.id} className="border-t"><td className="p-2 font-medium">{row.trade_name || row.legal_name}<br /><span className="text-xs text-slate-500">{row.legal_name}</span></td><td className="p-2">{row.cnpj || "-"}</td><td className="p-2">{row.email || "-"}<br /><span className="text-xs text-slate-500">{row.phone || "-"}</span></td><td className="p-2">{Number(row.in_company_service) ? "In loco e endereço" : "Endereço do prestador"}</td><td className="p-2"><Badge className={`rounded-sm ${statusTone(row.credential_status)}`}>{row.credential_status}</Badge></td><td className="p-2">{dateOnly(row.credential_valid_until)}</td></tr>)}</tbody></table></div>
          </Panel>
        )}

        {tab === "anamnese" && isDoctor && (
          <ClinicalWorkspace
            workers={workers}
            workerId={clinicalWorkerId}
            setWorkerId={setClinicalWorkerId}
            context={clinicalQ.data as any}
            validation={asoValidationQ.data as any}
            saveAnamnesis={(payload: any) => anamnesisSave.mutate(payload)}
            issueAso={(payload: any) => asoIssue.mutate(payload)}
            busy={anamnesisSave.isPending || asoIssue.isPending}
            asos={(asosQ.data || []) as any[]}
          />
        )}

        {tab === "cat_os" && (
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="Comunicação de Acidente de Trabalho" subtitle="Registro estruturado preparado para o evento S-2210. A transmissão depende da futura integração eSocial." action={!isDoctor && <Button onClick={() => setCatOpen(true)}><Plus size={14} className="mr-2" /> Abrir CAT</Button>}>
              <div className="space-y-2">{((catsQ.data || []) as any[]).slice(0, 20).map(row => <div key={row.id} className="flex items-center justify-between gap-3 border p-3"><div><p className="font-semibold text-slate-900">{row.collaborator_name}</p><p className="text-xs text-slate-500">{new Date(row.event_at).toLocaleString("pt-BR")} · {row.accident_type || "Tipo não definido"}</p></div><Badge className={`rounded-sm ${statusTone(row.esocial_status)}`}>{row.esocial_status}</Badge></div>)}</div>
            </Panel>
            <Panel title="Ordens de Serviço" subtitle="Riscos, medidas, EPI, EPC, treinamentos, ciência e vigência vinculados ao trabalhador e ao GSE." action={!isDoctor && <Button onClick={() => setOsOpen(true)}><Plus size={14} className="mr-2" /> Gerar em lote</Button>}>
              <div className="space-y-2">{((workOrdersQ.data || []) as any[]).slice(0, 20).map(row => <div key={row.id} className="flex items-center justify-between gap-3 border p-3"><div><p className="font-semibold text-slate-900">{row.title}</p><p className="text-xs text-slate-500">{row.collaborator_name} · {row.gse_code || "Sem GSE"}</p></div><Badge className={`rounded-sm ${statusTone(row.acknowledgement_status)}`}>{row.acknowledgement_status}</Badge></div>)}</div>
            </Panel>
          </div>
        )}

        {tab === "auditoria" && (
          <Panel title="Trilha de auditoria ocupacional" subtitle="Reconstrução de atribuições, requisições, resultados, decisões médicas e documentos.">
            <div className="overflow-auto border"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="p-2 text-left">Data</th><th className="p-2 text-left">Usuário</th><th className="p-2 text-left">Ação</th><th className="p-2 text-left">Entidade</th><th className="p-2 text-left">Trabalhador</th></tr></thead><tbody>{((auditQ.data || []) as any[]).map(row => <tr key={row.id} className="border-t"><td className="p-2">{new Date(row.created_at).toLocaleString("pt-BR")}</td><td className="p-2">{row.actor_name || `Usuário ${row.actor_user_id}`}</td><td className="p-2 font-medium">{row.action}</td><td className="p-2">{row.entity_type} #{row.entity_id || "-"}</td><td className="p-2">{row.collaborator_name || "-"}</td></tr>)}</tbody></table></div>
          </Panel>
        )}

        <OrderDialog open={orderOpen} close={() => setOrderOpen(false)} workers={workers} exams={exams} providers={providers} busy={orderCreate.isPending} save={(payload: any) => orderCreate.mutate(payload)} />
        <PcmsoOrderDialog open={pcmsoOrderOpen} close={() => setPcmsoOrderOpen(false)} items={selectedPopulation} population={examPopulation} providers={providers} busy={pcmsoOrderCreate.isPending} save={(payload: any) => pcmsoOrderCreate.mutate(payload)} />
        <ReissueDialog row={reissue} close={() => setReissue(null)} providers={providers} busy={reissueOrder.isPending} save={(payload: any) => reissueOrder.mutate(payload)} />
        <ResultDialog open={resultOpen} close={() => setResultOpen(false)} workers={workers} exams={exams} orders={orders} busy={resultCreate.isPending} save={(payload: any) => resultCreate.mutate(payload)} />
        <OcrBatchDialog open={ocrOpen} close={() => setOcrOpen(false)} analyzing={ocrAnalyze.isPending} saving={ocrResultCreate.isPending} analyze={(documents: any[]) => ocrAnalyze.mutateAsync({ documents })} save={async (rows: any[]) => { for (const row of rows) await ocrResultCreate.mutateAsync(row); await refresh(); setOcrOpen(false); toast.success(`${rows.length} resultado(s) importado(s) e encaminhado(s) para revisão médica.`); }} />
        <ReviewDialog row={review} close={() => setReview(null)} busy={resultReview.isPending || resultDocument.isPending} viewDocument={() => review && resultDocument.mutate({ id: Number(review.id) })} save={(payload: any) => resultReview.mutate(payload)} />
        <ExamDialog open={examOpen} close={() => setExamOpen(false)} busy={examSave.isPending} save={(payload: any) => examSave.mutate(payload)} />
        <ProviderDialog open={providerOpen} close={() => setProviderOpen(false)} busy={providerSave.isPending} save={(payload: any) => providerSave.mutate(payload)} />
        <CatDialog open={catOpen} close={() => setCatOpen(false)} workers={workers} busy={catCreate.isPending} save={(payload: any) => catCreate.mutate(payload)} />
        <WorkOrderDialog open={osOpen} close={() => setOsOpen(false)} workers={workers} busy={osCreate.isPending} save={(payload: any) => osCreate.mutate(payload)} />
      </div>
    </AppLayout>
  );
}

function WorkerMultiSelect({ workers, selected, setSelected }: { workers: any[]; selected: number[]; setSelected: (ids: number[]) => void }) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => workers.filter(row => [row.name, row.cpf, row.position, row.gse_name].some(value => String(value || "").toLowerCase().includes(search.toLowerCase()))), [workers, search]);
  return <div className="space-y-2"><div className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={15} /><Input className="pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar trabalhador" /></div><div className="max-h-56 overflow-auto border">{filtered.map(row => <label key={row.id} className="flex items-center gap-3 border-b p-2 text-sm"><input type="checkbox" checked={selected.includes(Number(row.id))} onChange={() => setSelected(selected.includes(Number(row.id)) ? selected.filter(id => id !== Number(row.id)) : [...selected, Number(row.id)])} /><span className="flex-1"><b>{row.name}</b><br /><span className="text-xs text-slate-500">{row.gse_code || "Sem GSE"} · {row.position || "Sem cargo"}</span></span></label>)}</div><div className="flex justify-between text-xs"><button className="font-semibold text-teal-700" onClick={() => setSelected(filtered.map(row => Number(row.id)))}>Selecionar encontrados</button><span>{selected.length} selecionado(s)</span></div></div>;
}

function PcmsoOrderDialog({ open, close, items, population, providers, busy, save }: any) {
  const [providerId, setProviderId] = useState(0);
  const [mode, setMode] = useState("prestador");
  const [location, setLocation] = useState("");
  const [valid, setValid] = useState("");
  const [orientations, setOrientations] = useState("");
  const selectedRows = population.filter((row: any) => items.some((item: any) => Number(item.collaboratorId) === Number(row.collaborator_id) && Number(item.monitoringId) === Number(row.monitoring_id)));
  return <Dialog open={open} onOpenChange={value => !value && close()}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Gerar requisições previstas no PCMSO</DialogTitle></DialogHeader><div className="border-l-4 border-teal-500 bg-teal-50 p-3 text-sm">Os exames não podem ser alterados nesta etapa: foram definidos pelo Médico no PCMSO vigente. O SESMT configura somente a logística de realização.</div><div className="grid gap-4 md:grid-cols-2"><div className="max-h-72 overflow-auto border">{selectedRows.map((row: any) => <div key={`${row.collaborator_id}:${row.monitoring_id}`} className="border-b p-3 text-sm"><b>{row.collaborator_name}</b><br /><span className="text-xs text-slate-500">{row.exam_name} · {row.gse_code}</span></div>)}</div><div className="grid content-start gap-3"><label className="text-xs font-semibold">Prestador<select className="mt-1 h-10 w-full border bg-white px-3 text-sm" value={providerId} onChange={event => setProviderId(Number(event.target.value))}><option value={0}>A definir</option>{providers.map((row: any) => <option key={row.id} value={row.id}>{row.trade_name || row.legal_name}</option>)}</select></label><label className="text-xs font-semibold">Modalidade<select className="mt-1 h-10 w-full border bg-white px-3 text-sm" value={mode} onChange={event => setMode(event.target.value)}><option value="prestador">Endereço do prestador</option><option value="in_loco">In loco</option><option value="outro">Outro endereço</option></select></label><label className="text-xs font-semibold">Local<Input className="mt-1" value={location} onChange={event => setLocation(event.target.value)} /></label><label className="text-xs font-semibold">Validade da requisição<Input className="mt-1" type="date" value={valid} onChange={event => setValid(event.target.value)} /></label><label className="text-xs font-semibold">Orientações<Textarea className="mt-1" value={orientations} onChange={event => setOrientations(event.target.value)} /></label></div></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={close}>Cancelar</Button><Button disabled={busy || !items.length || !valid} onClick={() => save({ items, providerId: providerId || null, serviceMode: mode, serviceLocation: location || undefined, validUntil: valid, orientations: orientations || undefined })}>{busy ? "Gerando..." : `Gerar ${items.length} requisição(ões)`}</Button></div></DialogContent></Dialog>;
}

function OrderDialog({ open, close, workers, exams, providers, busy, save }: any) {
  const [selected, setSelected] = useState<number[]>([]); const [examId, setExamId] = useState(0); const [providerId, setProviderId] = useState(0); const [mode, setMode] = useState("prestador"); const [location, setLocation] = useState(""); const [valid, setValid] = useState(""); const [orientations, setOrientations] = useState("");
  return <Dialog open={open} onOpenChange={value => !value && close()}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>Gerar requisições em lote</DialogTitle></DialogHeader><div className="grid gap-4 md:grid-cols-2"><WorkerMultiSelect workers={workers} selected={selected} setSelected={setSelected} /><div className="grid content-start gap-3"><label className="text-xs font-semibold">Exame<select className="mt-1 h-10 w-full border bg-white px-3 text-sm" value={examId} onChange={event => setExamId(Number(event.target.value))}><option value={0}>Selecione</option>{exams.filter((row: any) => Number(row.is_active)).map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label className="text-xs font-semibold">Prestador<select className="mt-1 h-10 w-full border bg-white px-3 text-sm" value={providerId} onChange={event => setProviderId(Number(event.target.value))}><option value={0}>A definir</option>{providers.map((row: any) => <option key={row.id} value={row.id}>{row.trade_name || row.legal_name}</option>)}</select></label><label className="text-xs font-semibold">Modalidade<select className="mt-1 h-10 w-full border bg-white px-3 text-sm" value={mode} onChange={event => setMode(event.target.value)}><option value="prestador">Endereço do prestador</option><option value="in_loco">In loco</option><option value="outro">Outro endereço</option></select></label><label className="text-xs font-semibold">Local<Input className="mt-1" value={location} onChange={event => setLocation(event.target.value)} /></label><label className="text-xs font-semibold">Validade<Input className="mt-1" type="date" value={valid} onChange={event => setValid(event.target.value)} /></label><label className="text-xs font-semibold">Orientações<Textarea className="mt-1" value={orientations} onChange={event => setOrientations(event.target.value)} /></label></div></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={close}>Cancelar</Button><Button disabled={busy || !selected.length || !examId || !valid} onClick={() => save({ collaboratorIds: selected, examId, providerId: providerId || null, serviceMode: mode, serviceLocation: location || undefined, validUntil: valid, orientations: orientations || undefined })}>{busy ? "Gerando..." : `Gerar ${selected.length} requisição(ões)`}</Button></div></DialogContent></Dialog>;
}

function ReissueDialog({ row, close, providers, busy, save }: any) {
  const [valid, setValid] = useState(""); const [providerId, setProviderId] = useState(0); const [mode, setMode] = useState("prestador"); const [location, setLocation] = useState(""); const [reason, setReason] = useState("vencida"); const [justification, setJustification] = useState("");
  return <Dialog open={Boolean(row)} onOpenChange={value => !value && close()}><DialogContent><DialogHeader><DialogTitle>Emitir nova via da requisição</DialogTitle></DialogHeader><div className="border-l-4 border-teal-500 bg-teal-50 p-3 text-sm">A requisição {row?.order_number} será preservada. A nova emissão receberá outro número, validade, prestador e histórico.</div><div className="grid gap-3"><label className="text-xs font-semibold">Nova validade<Input className="mt-1" type="date" value={valid} onChange={event => setValid(event.target.value)} /></label><label className="text-xs font-semibold">Novo prestador<select className="mt-1 h-10 w-full border bg-white px-3 text-sm" value={providerId} onChange={event => setProviderId(Number(event.target.value))}><option value={0}>A definir</option>{providers.map((item: any) => <option key={item.id} value={item.id}>{item.trade_name || item.legal_name}</option>)}</select></label><label className="text-xs font-semibold">Modalidade<select className="mt-1 h-10 w-full border bg-white px-3 text-sm" value={mode} onChange={event => setMode(event.target.value)}><option value="prestador">Prestador</option><option value="in_loco">In loco</option><option value="outro">Outro</option></select></label><label className="text-xs font-semibold">Novo local<Input className="mt-1" value={location} onChange={event => setLocation(event.target.value)} /></label><label className="text-xs font-semibold">Motivo<select className="mt-1 h-10 w-full border bg-white px-3 text-sm" value={reason} onChange={event => setReason(event.target.value)}><option value="nao_realizou">Funcionário não realizou</option><option value="perda">Perda da requisição</option><option value="vencida">Requisição vencida</option><option value="alteracao_prestador">Alteração do prestador</option><option value="alteracao_local">Alteração do local</option><option value="alteracao_programacao">Alteração da programação</option><option value="solicitacao_sesmt">Solicitação do SESMT</option><option value="outro">Outro</option></select></label><label className="text-xs font-semibold">Justificativa<Textarea className="mt-1" value={justification} onChange={event => setJustification(event.target.value)} /></label></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={close}>Cancelar</Button><Button disabled={!row || !valid || busy || (reason === "outro" && !justification.trim())} onClick={() => save({ id: Number(row.id), validUntil: valid, providerId: providerId || null, serviceMode: mode, serviceLocation: location || undefined, reason, justification: justification || undefined })}>{busy ? "Emitindo..." : "Emitir nova via"}</Button></div></DialogContent></Dialog>;
}

function ResultDialog({ open, close, workers, exams, orders, busy, save }: any) {
  const [workerId, setWorkerId] = useState(0); const [examId, setExamId] = useState(0); const [orderId, setOrderId] = useState(0); const [performedAt, setPerformedAt] = useState(""); const [lab, setLab] = useState(""); const [type, setType] = useState("qualitativo"); const [summary, setSummary] = useState(""); const [reference, setReference] = useState(""); const [source, setSource] = useState("manual"); const [identity, setIdentity] = useState("confirmado"); const [file, setFile] = useState<{ data: string; name: string } | null>(null);
  const readFile = (selected?: File) => { if (!selected) return; const reader = new FileReader(); reader.onload = () => setFile({ data: String(reader.result), name: selected.name }); reader.readAsDataURL(selected); };
  return <Dialog open={open} onOpenChange={value => !value && close()}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Lançar resultado de exame</DialogTitle></DialogHeader><div className="grid gap-3 md:grid-cols-2"><label className="text-xs font-semibold">Trabalhador<select className="mt-1 h-10 w-full border bg-white px-3 text-sm" value={workerId} onChange={event => setWorkerId(Number(event.target.value))}><option value={0}>Selecione</option>{workers.map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label className="text-xs font-semibold">Exame<select className="mt-1 h-10 w-full border bg-white px-3 text-sm" value={examId} onChange={event => setExamId(Number(event.target.value))}><option value={0}>Selecione</option>{exams.map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label className="text-xs font-semibold">Requisição vinculada<select className="mt-1 h-10 w-full border bg-white px-3 text-sm" value={orderId} onChange={event => setOrderId(Number(event.target.value))}><option value={0}>Sem requisição</option>{orders.filter((row: any) => !workerId || Number(row.collaborator_id) === workerId).map((row: any) => <option key={row.id} value={row.id}>{row.order_number} - {row.exam_name}</option>)}</select></label><label className="text-xs font-semibold">Data do exame<Input className="mt-1" type="datetime-local" value={performedAt} onChange={event => setPerformedAt(event.target.value)} /></label><label className="text-xs font-semibold">Laboratório / prestador<Input className="mt-1" value={lab} onChange={event => setLab(event.target.value)} /></label><label className="text-xs font-semibold">Tipo de resultado<select className="mt-1 h-10 w-full border bg-white px-3 text-sm" value={type} onChange={event => setType(event.target.value)}><option value="qualitativo">Qualitativo</option><option value="quantitativo">Quantitativo</option><option value="misto">Misto</option></select></label><label className="md:col-span-2 text-xs font-semibold">Resumo transcrito do laudo<Textarea className="mt-1" value={summary} onChange={event => setSummary(event.target.value)} /></label><label className="md:col-span-2 text-xs font-semibold">Referência informada no próprio laudo<Textarea className="mt-1" value={reference} onChange={event => setReference(event.target.value)} /></label><label className="text-xs font-semibold">Origem<select className="mt-1 h-10 w-full border bg-white px-3 text-sm" value={source} onChange={event => setSource(event.target.value)}><option value="manual">Manual</option><option value="ocr">OCR assistido</option><option value="integracao">Integração</option></select></label><label className="text-xs font-semibold">Validação de identidade<select className="mt-1 h-10 w-full border bg-white px-3 text-sm" value={identity} onChange={event => setIdentity(event.target.value)}><option value="confirmado">Confirmado</option><option value="divergencia">Divergência</option><option value="ambiguo">Ambíguo</option><option value="nao_identificado">Não identificado</option></select></label><label className="md:col-span-2 text-xs font-semibold">Documento original<Input className="mt-1" type="file" accept="application/pdf,image/*" onChange={event => readFile(event.target.files?.[0])} /></label></div><div className="border-l-4 border-amber-400 bg-amber-50 p-3 text-xs text-amber-950">OCR é assistivo. Em ambiguidade, a plataforma não associa automaticamente o documento. Todo resultado entra como pendente de revisão médica.</div><div className="flex justify-end gap-2"><Button variant="outline" onClick={close}>Cancelar</Button><Button disabled={busy || !workerId || !examId || !performedAt} onClick={() => save({ orderId: orderId || null, collaboratorId: workerId, examId, performedAt: new Date(performedAt).toISOString(), laboratoryName: lab || undefined, resultType: type, resultSummary: summary || undefined, parameters: [], referenceText: reference || undefined, source, identityStatus: identity, fileBase64: file?.data, fileName: file?.name })}>{busy ? "Salvando..." : "Enviar para revisão"}</Button></div></DialogContent></Dialog>;
}

function OcrBatchDialog({ open, close, analyzing, saving, analyze, save }: any) {
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<number, { workerId: number; examId: number; include: boolean }>>({});
  const [converting, setConverting] = useState("");
  useEffect(() => {
    const next: Record<number, { workerId: number; examId: number; include: boolean }> = {};
    rows.forEach((row, index) => { next[index] = { workerId: row.identityStatus === "confirmado" ? Number(row.workerCandidates?.[0]?.id || 0) : 0, examId: Number(row.examCandidates?.[0]?.id || 0), include: true }; });
    setMapping(next);
  }, [rows]);
  const fileToData = (file: File) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
  const pdfToImages = async (file: File) => {
    const pdfjsLib: any = await import("pdfjs-dist");
    const workerUrlBase = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrlBase + "?ct=1";
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const images: Array<{ fileName: string; mimeType: "image/jpeg"; fileBase64: string }> = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      setConverting(`${file.name}: página ${pageNumber}/${pdf.numPages}`);
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width; canvas.height = viewport.height;
      const context = canvas.getContext("2d");
      if (!context) continue;
      await page.render({ canvasContext: context, viewport }).promise;
      images.push({ fileName: `${file.name} - página ${pageNumber}`, mimeType: "image/jpeg", fileBase64: canvas.toDataURL("image/jpeg", 0.92) });
    }
    return images;
  };
  const run = async () => {
    const documents: any[] = [];
    try {
      for (const file of files) {
        if (file.type === "application/pdf") documents.push(...await pdfToImages(file));
        else if (["image/png", "image/jpeg"].includes(file.type)) documents.push({ fileName: file.name, mimeType: file.type, fileBase64: await fileToData(file) });
      }
      if (!documents.length) return toast.error("Selecione PDF, JPG ou PNG.");
      if (documents.length > 20) return toast.error("O lote pode conter até 20 páginas por processamento.");
      setRows(await analyze(documents));
    } finally { setConverting(""); }
  };
  const confirm = async () => {
    const payload = rows.map((row, index) => ({ row, map: mapping[index] })).filter(item => item.map?.include && item.map.workerId && item.map.examId).map(({ row, map }) => ({ collaboratorId: map.workerId, examId: map.examId, performedAt: row.fields?.performedDate ? `${row.fields.performedDate}T12:00:00.000Z` : new Date().toISOString(), laboratoryName: row.fields?.laboratoryName || undefined, resultType: ["qualitativo", "quantitativo", "misto"].includes(row.fields?.resultType) ? row.fields.resultType : "misto", resultSummary: row.fields?.resultSummary || undefined, parameters: Array.isArray(row.fields?.parameters) ? row.fields.parameters : [], referenceText: row.fields?.referenceText || undefined, source: "ocr", identityStatus: row.identityStatus, fileBase64: row.fileBase64, fileName: row.fileName }));
    if (!payload.length) return toast.error("Confirme o trabalhador e o exame de pelo menos um documento.");
    await save(payload);
  };
  return <Dialog open={open} onOpenChange={value => { if (!value) { setFiles([]); setRows([]); close(); } }}><DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto"><DialogHeader><DialogTitle>Importação OCR de resultados</DialogTitle></DialogHeader><div className="border-l-4 border-amber-400 bg-amber-50 p-3 text-sm">A leitura é assistiva. A plataforma não diagnostica nem escolhe trabalhadores em caso de ambiguidade. Cada vínculo deve ser conferido antes da importação.</div>{!rows.length ? <div className="space-y-4"><Input type="file" multiple accept="application/pdf,image/png,image/jpeg" onChange={event => setFiles(Array.from(event.target.files || []))} /><p className="text-sm text-slate-500">{files.length} arquivo(s) selecionado(s). PDFs são convertidos em imagens de alta resolução no navegador.</p><Button disabled={analyzing || Boolean(converting) || !files.length} onClick={run}>{analyzing || converting ? `Analisando ${converting}` : "Ler documentos com IA/OCR"}</Button></div> : <div className="space-y-3">{rows.map((row, index) => <div key={`${row.fileName}:${index}`} className="grid gap-3 border p-3 md:grid-cols-[32px_1fr_1fr_1fr]"><input type="checkbox" checked={mapping[index]?.include ?? true} onChange={event => setMapping(current => ({ ...current, [index]: { ...current[index], include: event.target.checked } }))} /><div><b>{row.fileName}</b><p className="mt-1 text-xs text-slate-500">Documento: {row.fields?.employeeName || "nome não identificado"}<br />Exame: {row.fields?.examName || "não identificado"}<br />Data: {row.fields?.performedDate || "não identificada"}</p>{row.warnings?.map((warning: string) => <p key={warning} className="mt-1 text-xs text-amber-700">{warning}</p>)}</div><label className="text-xs font-semibold">Trabalhador<select className="mt-1 h-10 w-full border bg-white px-2 text-sm" value={mapping[index]?.workerId || 0} onChange={event => setMapping(current => ({ ...current, [index]: { ...current[index], workerId: Number(event.target.value) } }))}><option value={0}>Confirmar manualmente</option>{row.workerCandidates?.map((candidate: any) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.cpf || candidate.employee_registration || "sem identificador"}</option>)}</select><span className={`mt-1 block ${row.identityStatus === "confirmado" ? "text-emerald-700" : "text-amber-700"}`}>{row.identityStatus.replaceAll("_", " ")}</span></label><label className="text-xs font-semibold">Exame<select className="mt-1 h-10 w-full border bg-white px-2 text-sm" value={mapping[index]?.examId || 0} onChange={event => setMapping(current => ({ ...current, [index]: { ...current[index], examId: Number(event.target.value) } }))}><option value={0}>Confirmar exame</option>{row.examCandidates?.map((candidate: any) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select><span className="mt-1 block text-slate-500">Referência preservada do laudo</span></label></div>)}</div>}<div className="flex justify-end gap-2"><Button variant="outline" onClick={close}>Cancelar</Button>{rows.length > 0 && <Button disabled={saving} onClick={confirm}>{saving ? "Importando..." : "Confirmar e encaminhar à revisão médica"}</Button>}</div></DialogContent></Dialog>;
}

function ReviewDialog({ row, close, busy, save, viewDocument }: any) {
  const [classification, setClassification] = useState("normal");
  const [notes, setNotes] = useState("");
  return (
    <Dialog open={Boolean(row)} onOpenChange={value => !value && close()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Revisão médica do resultado</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="border p-3 text-sm">
            <b>{row?.collaborator_name}</b><br />
            {row?.exam_name} · {row?.laboratory_name || "Prestador não informado"}
            <p className="mt-2 text-slate-600">{row?.result_summary || "Sem resumo"}</p>
            <p className="mt-2 text-xs text-slate-500">Referência do laudo: {row?.reference_text || "não informada"}</p>
            {row?.document_private_path && <Button className="mt-3" size="sm" variant="outline" disabled={busy} onClick={viewDocument}><Download size={14} className="mr-2" /> Abrir documento original</Button>}
          </div>
          <label className="text-xs font-semibold">Classificação<select className="mt-1 h-10 w-full border bg-white px-3 text-sm" value={classification} onChange={event => setClassification(event.target.value)}><option value="normal">Normal conforme referência</option><option value="alterado">Fora da referência informada</option><option value="inconclusivo">Inconclusivo</option><option value="insatisfatorio">Insatisfatório</option><option value="nao_realizado">Não realizado</option></select></label>
          <label className="text-xs font-semibold">Análise / conduta médica<Textarea className="mt-1" value={notes} onChange={event => setNotes(event.target.value)} /></label>
          <div className="border-l-4 border-teal-500 bg-teal-50 p-3 text-xs">A classificação compara o resultado à referência do laudo. Não equivale a diagnóstico nem define aptidão automaticamente.</div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={close}>Cancelar</Button><Button disabled={!row || busy} onClick={() => save({ id: Number(row.id), classification, medicalNotes: notes || undefined })}>{busy ? "Salvando..." : "Concluir revisão"}</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExamDialog({ open, close, busy, save }: any) { const [name, setName] = useState(""); const [examType, setExamType] = useState("complementar"); const [category, setCategory] = useState(""); const [description, setDescription] = useState(""); const [periodicity, setPeriodicity] = useState(""); const [resultType, setResultType] = useState("qualitativo"); const [unit, setUnit] = useState(""); const [reference, setReference] = useState(""); return <Dialog open={open} onOpenChange={value => !value && close()}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Novo exame no catálogo central</DialogTitle></DialogHeader><div className="grid gap-3 md:grid-cols-2"><label className="text-xs font-semibold">Nome<Input className="mt-1" value={name} onChange={event => setName(event.target.value)} /></label><label className="text-xs font-semibold">Categoria<Input className="mt-1" value={category} onChange={event => setCategory(event.target.value)} placeholder="Audiometria, Laboratorial..." /></label><label className="text-xs font-semibold">Tipo<select className="mt-1 h-10 w-full border bg-white px-3 text-sm" value={examType} onChange={event => setExamType(event.target.value)}><option value="clinico">Clínico</option><option value="complementar">Complementar</option></select></label><label className="text-xs font-semibold">Resultado<select className="mt-1 h-10 w-full border bg-white px-3 text-sm" value={resultType} onChange={event => setResultType(event.target.value)}><option value="qualitativo">Qualitativo</option><option value="quantitativo">Quantitativo</option><option value="misto">Misto</option></select></label><label className="text-xs font-semibold">Periodicidade padrão<Input className="mt-1" value={periodicity} onChange={event => setPeriodicity(event.target.value)} placeholder="A definir pelo médico" /></label><label className="text-xs font-semibold">Unidade padrão<Input className="mt-1" value={unit} onChange={event => setUnit(event.target.value)} /></label><label className="md:col-span-2 text-xs font-semibold">Descrição<Textarea className="mt-1" value={description} onChange={event => setDescription(event.target.value)} /></label><label className="md:col-span-2 text-xs font-semibold">Orientação sobre referências<Textarea className="mt-1" value={reference} onChange={event => setReference(event.target.value)} placeholder="Priorizar sempre os valores de referência do laboratório e método informados no laudo." /></label></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={close}>Cancelar</Button><Button disabled={busy || !name.trim()} onClick={() => save({ name, examType, category: category || undefined, description: description || undefined, defaultPeriodicity: periodicity || undefined, resultType, defaultUnit: unit || undefined, referenceGuidance: reference || undefined, isActive: true })}>{busy ? "Salvando..." : "Salvar exame"}</Button></div></DialogContent></Dialog>; }

function ProviderDialog({ open, close, busy, save }: any) { const [legal, setLegal] = useState(""); const [trade, setTrade] = useState(""); const [cnpj, setCnpj] = useState(""); const [address, setAddress] = useState(""); const [phone, setPhone] = useState(""); const [email, setEmail] = useState(""); const [inLoco, setInLoco] = useState(false); const [valid, setValid] = useState(""); const [exams, setExams] = useState(""); return <Dialog open={open} onOpenChange={value => !value && close()}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Novo prestador credenciado</DialogTitle></DialogHeader><div className="grid gap-3 md:grid-cols-2"><label className="text-xs font-semibold">Razão social<Input className="mt-1" value={legal} onChange={event => setLegal(event.target.value)} /></label><label className="text-xs font-semibold">Nome fantasia<Input className="mt-1" value={trade} onChange={event => setTrade(event.target.value)} /></label><label className="text-xs font-semibold">CNPJ<Input className="mt-1" value={cnpj} onChange={event => setCnpj(event.target.value)} /></label><label className="text-xs font-semibold">Telefone<Input className="mt-1" value={phone} onChange={event => setPhone(event.target.value)} /></label><label className="text-xs font-semibold">E-mail<Input className="mt-1" value={email} onChange={event => setEmail(event.target.value)} /></label><label className="text-xs font-semibold">Validade do credenciamento<Input className="mt-1" type="date" value={valid} onChange={event => setValid(event.target.value)} /></label><label className="md:col-span-2 text-xs font-semibold">Endereço<Textarea className="mt-1" value={address} onChange={event => setAddress(event.target.value)} /></label><label className="md:col-span-2 text-xs font-semibold">Exames realizados, separados por vírgula<Input className="mt-1" value={exams} onChange={event => setExams(event.target.value)} /></label><label className="md:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={inLoco} onChange={event => setInLoco(event.target.checked)} /> Realiza atendimento in loco</label></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={close}>Cancelar</Button><Button disabled={busy || !legal.trim()} onClick={() => save({ legalName: legal, tradeName: trade || undefined, cnpj: cnpj || undefined, address: address || undefined, phone: phone || undefined, email, inCompanyService: inLoco, exams: exams.split(",").map((item: string) => item.trim()).filter(Boolean), specialties: [], credentialStatus: "ativo", credentialValidUntil: valid || null })}>{busy ? "Salvando..." : "Salvar prestador"}</Button></div></DialogContent></Dialog>; }

function ClinicalWorkspace({ workers, workerId, setWorkerId, context, validation, saveAnamnesis, issueAso, busy, asos }: any) {
  const [type, setType] = useState("periodico"); const [answers, setAnswers] = useState<Record<string, string>>({}); const [fitness, setFitness] = useState("apto"); const [aptitudes, setAptitudes] = useState(""); const [justification, setJustification] = useState("");
  const questions = type === "admissional" ? admissionQuestions : type === "periodico" ? periodicQuestions : contextualQuestions[type] || [];
  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]"><Panel title="Anamnese ocupacional" subtitle="Questionário contextualizado pelo tipo de exame e pelo histórico ocupacional."><div className="mb-4 grid gap-3 md:grid-cols-2"><label className="text-xs font-semibold">Trabalhador<select className="mt-1 h-10 w-full border bg-white px-3 text-sm" value={workerId} onChange={event => setWorkerId(Number(event.target.value))}><option value={0}>Selecione</option>{workers.map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label className="text-xs font-semibold">Tipo<select className="mt-1 h-10 w-full border bg-white px-3 text-sm" value={type} onChange={event => { setType(event.target.value); setAnswers({}); }}><option value="admissional">Admissional</option><option value="periodico">Periódico</option><option value="retorno">Retorno ao trabalho</option><option value="mudanca_risco">Mudança de riscos</option><option value="demissional">Demissional</option></select></label></div>{context?.worker && <div className="mb-4 border-l-4 border-teal-500 bg-teal-50 p-3 text-sm"><b>{context.worker.name}</b><br />GSE: {context.worker.gse_code || "-"} - {context.worker.gse_name || "Sem GSE"}<br />Cargo: {context.worker.position || "-"} · Setor: {context.worker.sector_name || "-"}</div>}<div className="max-h-[560px] space-y-2 overflow-auto border p-3">{questions.map((question, index) => <label key={question} className="block border-b pb-3 text-sm"><span className="font-medium text-slate-800">{index + 1}. {question}</span><Input className="mt-2" value={answers[String(index + 1)] || ""} onChange={event => setAnswers(current => ({ ...current, [String(index + 1)]: event.target.value }))} placeholder="Resposta e detalhes clínicos" /></label>)}</div><div className="mt-4 flex justify-end gap-2"><Button variant="outline" disabled={!workerId || busy} onClick={() => saveAnamnesis({ collaboratorId: workerId, anamnesisType: type, answers, status: "rascunho" })}>Salvar rascunho</Button><Button disabled={!workerId || busy} onClick={() => saveAnamnesis({ collaboratorId: workerId, anamnesisType: type, answers, status: "concluida" })}>Concluir anamnese</Button></div></Panel><div className="space-y-4"><Panel title="Contexto ocupacional" subtitle="Derivado do cadastro, GSE, PGR e PCMSO.">{!workerId ? <p className="text-sm text-slate-500">Selecione o trabalhador.</p> : <div className="space-y-3 text-xs"><div><b>Riscos e controles médicos</b>{(context?.risks || []).map((row: any) => <div key={`${row.risk_name}:${row.exam_name}`} className="mt-2 border p-2"><span className="font-semibold">{row.risk_name}</span><br />{row.risk_classification || "sem classificação"} · {row.exam_name || row.monitoring_name || row.monitoring_kind}</div>)}</div><div><b>Exames solicitados</b><p className="mt-1 text-slate-600">{(context?.orders || []).map((row: any) => `${row.exam_name} (${row.status})`).join(", ") || "Nenhum"}</p></div><div><b>Resultados</b><p className="mt-1 text-slate-600">{(context?.results || []).map((row: any) => `${row.exam_name} (${row.classification})`).join(", ") || "Nenhum"}</p></div></div>}</Panel><Panel title="Validação antes do ASO" subtitle="Pendências orientam a decisão; não substituem o julgamento médico.">{!workerId ? <p className="text-sm text-slate-500">Selecione o trabalhador.</p> : <div className="space-y-3"><div className={`border p-3 ${validation?.ready ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}><p className="font-semibold">{validation?.ready ? "Requisitos encontrados" : "Pendências identificadas"}</p><p className="mt-1 text-xs">Exames ausentes: {validation?.missingExams?.map((row: any) => row.name).join(", ") || "nenhum"}<br />Resultados sem revisão: {Number(validation?.pendingMedicalReview || 0)}</p></div><label className="text-xs font-semibold">Conclusão<select className="mt-1 h-10 w-full border bg-white px-3 text-sm" value={fitness} onChange={event => setFitness(event.target.value)}><option value="apto">Apto</option><option value="inapto">Inapto</option></select></label><label className="text-xs font-semibold">Aptidões específicas<Input className="mt-1" value={aptitudes} onChange={event => setAptitudes(event.target.value)} placeholder="Altura, espaço confinado..." /></label>{!validation?.ready && <label className="text-xs font-semibold">Justificativa médica obrigatória<Textarea className="mt-1" value={justification} onChange={event => setJustification(event.target.value)} /></label>}<Button className="w-full" disabled={busy || (!validation?.ready && !justification.trim())} onClick={() => issueAso({ collaboratorId: workerId, asoType: type, fitnessStatus: fitness, specificAptitudes: aptitudes.split(",").map(item => item.trim()).filter(Boolean), pendingJustification: justification || undefined })}><FileHeart size={15} className="mr-2" /> Emitir ASO</Button></div>}</Panel><Panel title="ASOs do trabalhador">{asos.filter((row: any) => Number(row.collaborator_id) === workerId).slice(0, 8).map((row: any) => <div key={row.id} className="mb-2 border p-2 text-sm"><div className="flex justify-between"><b>{row.aso_type}</b><Badge className={`rounded-sm ${statusTone(row.fitness_status)}`}>{row.fitness_status}</Badge></div><p className="mt-1 text-xs text-slate-500">{new Date(row.issued_at).toLocaleString("pt-BR")}</p></div>)}</Panel></div></div>;
}

function CatDialog({ open, close, workers, busy, save }: any) { const [workerId, setWorkerId] = useState(0); const [at, setAt] = useState(""); const [type, setType] = useState(""); const [location, setLocation] = useState(""); const [description, setDescription] = useState(""); const [agent, setAgent] = useState(""); const [body, setBody] = useState(""); const [injury, setInjury] = useState(""); const [leave, setLeave] = useState(false); return <Dialog open={open} onOpenChange={value => !value && close()}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Abertura de CAT</DialogTitle></DialogHeader><div className="grid gap-3 md:grid-cols-2"><label className="text-xs font-semibold">Trabalhador<select className="mt-1 h-10 w-full border bg-white px-3 text-sm" value={workerId} onChange={event => setWorkerId(Number(event.target.value))}><option value={0}>Selecione</option>{workers.map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label className="text-xs font-semibold">Data e hora<Input className="mt-1" type="datetime-local" value={at} onChange={event => setAt(event.target.value)} /></label><label className="text-xs font-semibold">Tipo de acidente<Input className="mt-1" value={type} onChange={event => setType(event.target.value)} /></label><label className="text-xs font-semibold">Local<Input className="mt-1" value={location} onChange={event => setLocation(event.target.value)} /></label><label className="md:col-span-2 text-xs font-semibold">Descrição<Textarea className="mt-1" value={description} onChange={event => setDescription(event.target.value)} /></label><label className="text-xs font-semibold">Agente causador<Input className="mt-1" value={agent} onChange={event => setAgent(event.target.value)} /></label><label className="text-xs font-semibold">Parte do corpo<Input className="mt-1" value={body} onChange={event => setBody(event.target.value)} /></label><label className="text-xs font-semibold">Natureza da lesão<Input className="mt-1" value={injury} onChange={event => setInjury(event.target.value)} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={leave} onChange={event => setLeave(event.target.checked)} /> Houve afastamento</label></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={close}>Cancelar</Button><Button disabled={busy || !workerId || !at || description.length < 5} onClick={() => save({ collaboratorId: workerId, eventAt: new Date(at).toISOString(), location: location || undefined, accidentType: type || undefined, description, causativeAgent: agent || undefined, bodyPart: body || undefined, injuryNature: injury || undefined, leaveRequired: leave, witnesses: [] })}>{busy ? "Salvando..." : "Registrar CAT"}</Button></div></DialogContent></Dialog>; }

function WorkOrderDialog({ open, close, workers, busy, save }: any) { const [selected, setSelected] = useState<number[]>([]); const [title, setTitle] = useState(""); const [activity, setActivity] = useState(""); const [risks, setRisks] = useState(""); const [measures, setMeasures] = useState(""); const [epis, setEpis] = useState(""); const [epcs, setEpcs] = useState(""); const [trainings, setTrainings] = useState(""); const split = (value: string) => value.split("\n").map(item => item.trim()).filter(Boolean); return <Dialog open={open} onOpenChange={value => !value && close()}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>Gerar Ordem de Serviço em lote</DialogTitle></DialogHeader><div className="grid gap-4 md:grid-cols-2"><WorkerMultiSelect workers={workers} selected={selected} setSelected={setSelected} /><div className="grid gap-2"><label className="text-xs font-semibold">Título<Input className="mt-1" value={title} onChange={event => setTitle(event.target.value)} /></label><label className="text-xs font-semibold">Atividade<Textarea className="mt-1" value={activity} onChange={event => setActivity(event.target.value)} /></label><label className="text-xs font-semibold">Riscos, um por linha<Textarea className="mt-1" value={risks} onChange={event => setRisks(event.target.value)} /></label><label className="text-xs font-semibold">Medidas preventivas, uma por linha<Textarea className="mt-1" value={measures} onChange={event => setMeasures(event.target.value)} /></label><label className="text-xs font-semibold">EPI / EPC / treinamentos<Input className="mt-1" value={[epis, epcs, trainings].filter(Boolean).join(" | ")} onChange={event => { setEpis(event.target.value); setEpcs(""); setTrainings(""); }} placeholder="Informe os controles previstos" /></label></div></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={close}>Cancelar</Button><Button disabled={busy || !selected.length || !title.trim()} onClick={() => save({ collaboratorIds: selected, title, activity: activity || undefined, risks: split(risks), preventiveMeasures: split(measures), epis: split(epis), epcs: split(epcs), trainings: split(trainings), validFrom: null, validUntil: null })}>{busy ? "Gerando..." : `Gerar ${selected.length} ordem(ns)`}</Button></div></DialogContent></Dialog>; }
