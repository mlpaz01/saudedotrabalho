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
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Download,
  FileClock,
  FileHeart,
  FilePlus2,
  History,
  Microscope,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRoundCheck,
} from "lucide-react";
import { toast } from "sonner";

type Tab =
  | "painel"
  | "requisicoes"
  | "resultados"
  | "catalogo"
  | "prestadores"
  | "anamnese"
  | "dossie"
  | "indicadores"
  | "cat_os"
  | "auditoria";

const tabs: Array<{ id: Tab; label: string; icon: any }> = [
  { id: "painel", label: "Painel", icon: Activity },
  { id: "requisicoes", label: "Requisições", icon: FileClock },
  { id: "resultados", label: "Resultados", icon: Microscope },
  { id: "catalogo", label: "Catálogo de exames", icon: ClipboardList },
  { id: "prestadores", label: "Prestadores", icon: ShieldCheck },
  { id: "anamnese", label: "Anamnese e ASO", icon: Stethoscope },
  { id: "dossie", label: "Dossiê ocupacional", icon: UserRoundCheck },
  { id: "indicadores", label: "Indicadores", icon: Activity },
  { id: "cat_os", label: "CAT e Ordem de Serviço", icon: ClipboardCheck },
  { id: "auditoria", label: "Auditoria", icon: History },
];

function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="font-semibold text-slate-950">{title}</h2>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Metric({
  label,
  value,
  warning,
}: {
  label: string;
  value: string | number;
  warning?: boolean;
}) {
  return (
    <div
      className={`border p-4 ${warning ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}
    >
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
    </div>
  );
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
  if (["realizada", "normal", "apto", "emitido", "enviado"].includes(value))
    return "bg-emerald-100 text-emerald-800";
  if (["alterado", "vencida", "inapto", "falhou"].includes(value))
    return "bg-red-100 text-red-800";
  if (["pendente", "pendente_revisao", "enviada", "rascunho"].includes(value))
    return "bg-amber-100 text-amber-800";
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
  const [selectedPopulation, setSelectedPopulation] = useState<
    Array<{ collaboratorId: number; monitoringId: number }>
  >([]);
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [resultOpen, setResultOpen] = useState(false);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [examOpen, setExamOpen] = useState(false);
  const [examEditing, setExamEditing] = useState<any>(null);
  const [providerOpen, setProviderOpen] = useState(false);
  const [providerEditing, setProviderEditing] = useState<any>(null);
  const [reissue, setReissue] = useState<any>(null);
  const [review, setReview] = useState<any>(null);
  const [clinicalWorkerId, setClinicalWorkerId] = useState(0);
  const [dossierWorkerId, setDossierWorkerId] = useState(0);
  const [populationFilters, setPopulationFilters] = useState({
    branch: "",
    sector: "",
    gse: "",
    exam: "",
    status: "todos",
    search: "",
  });
  const [catOpen, setCatOpen] = useState(false);
  const [osOpen, setOsOpen] = useState(false);

  const dashboardQ = trpc.occupationalLifecycle.dashboard.useQuery();
  const workersQ = trpc.occupationalLifecycle.listWorkers.useQuery({
    query: workerQuery || undefined,
  });
  const examsQ = trpc.occupationalLifecycle.listExamCatalog.useQuery();
  const providersQ = trpc.occupationalLifecycle.listProviders.useQuery();
  const ordersQ = trpc.occupationalLifecycle.listExamOrders.useQuery();
  const populationQ = trpc.occupationalLifecycle.listExamPopulation.useQuery();
  const resultsQ = trpc.occupationalLifecycle.listExamResults.useQuery();
  const asosQ = trpc.occupationalLifecycle.listAsos.useQuery();
  const catsQ = trpc.occupationalLifecycle.listCats.useQuery();
  const workOrdersQ = trpc.occupationalLifecycle.listWorkOrders.useQuery();
  const auditQ = trpc.occupationalLifecycle.auditTrail.useQuery(undefined, {
    enabled: tab === "auditoria",
  });
  const indicatorsQ =
    trpc.occupationalLifecycle.occupationalIndicators.useQuery(undefined, {
      enabled: tab === "indicadores" || tab === "painel",
    });
  const dossierQ = trpc.occupationalLifecycle.getOccupationalDossier.useQuery(
    { collaboratorId: dossierWorkerId || 0 },
    { enabled: tab === "dossie" && Boolean(dossierWorkerId) }
  );
  const clinicalQ = trpc.occupationalLifecycle.getAnamnesisContext.useQuery(
    { collaboratorId: clinicalWorkerId || 0 },
    { enabled: isDoctor && Boolean(clinicalWorkerId) }
  );
  const asoValidationQ = trpc.occupationalLifecycle.validateAso.useQuery(
    { collaboratorId: clinicalWorkerId || 0 },
    { enabled: isDoctor && Boolean(clinicalWorkerId) }
  );

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
      utils.occupationalLifecycle.occupationalIndicators.invalidate(),
      utils.occupationalLifecycle.getOccupationalDossier.invalidate(),
      utils.occupationalLifecycle.getAnamnesisContext.invalidate(),
      utils.occupationalLifecycle.validateAso.invalidate(),
    ]);
  };

  const orderCreate = trpc.occupationalLifecycle.createExamOrders.useMutation({
    onSuccess: async result => {
      await refresh();
      setOrderOpen(false);
      toast.success(
        `${result.created} requisição(ões) gerada(s)${result.skipped ? `; ${result.skipped} item(ns) não foram emitidos pela regra anual` : ""}.`
      );
    },
    onError: error => toast.error(error.message),
  });
  const pcmsoOrderCreate =
    trpc.occupationalLifecycle.createExamOrdersFromPcmso.useMutation({
      onSuccess: async result => {
        await refresh();
        setPcmsoOrderOpen(false);
        setSelectedPopulation([]);
        toast.success(
          `${result.created} requisição(ões) gerada(s) pelo PCMSO${result.skipped ? `; ${result.skipped} item(ns) não foram gerados após a validação anual` : ""}.`
        );
      },
      onError: error => toast.error(error.message),
    });
  const reissueOrder = trpc.occupationalLifecycle.reissueExamOrder.useMutation({
    onSuccess: async result => {
      await refresh();
      setReissue(null);
      toast.success(`${result.label} emitida sem apagar o documento original.`);
    },
    onError: error => toast.error(error.message),
  });
  const generateOrderPdf =
    trpc.occupationalLifecycle.generateExamOrderPdf.useMutation({
      onSuccess: result => {
        downloadData(result.dataBase64, result.fileName);
        toast.success("PDF gerado e arquivado.");
      },
      onError: error => toast.error(error.message),
    });
  const generateGroupedPdf =
    trpc.occupationalLifecycle.generateGroupedExamOrderPdf.useMutation({
      onSuccess: result => {
        downloadData(result.dataBase64, result.fileName);
        toast.success(`${result.total} requisições reunidas no PDF.`);
      },
      onError: error => toast.error(error.message),
    });
  const emailOrder = trpc.occupationalLifecycle.sendExamOrderEmail.useMutation({
    onSuccess: result => {
      refresh();
      toast.success(
        result.preview
          ? "Envio registrado em modo de prévia."
          : "Requisição enviada por e-mail."
      );
    },
    onError: error => toast.error(error.message),
  });
  const resultCreate = trpc.occupationalLifecycle.recordExamResult.useMutation({
    onSuccess: async () => {
      await refresh();
      setResultOpen(false);
      toast.success("Resultado recebido e enviado para revisão médica.");
    },
    onError: error => toast.error(error.message),
  });
  const ocrAnalyze =
    trpc.occupationalLifecycle.analyzeExamDocumentsOcr.useMutation({
      onError: error => toast.error(error.message),
    });
  const ocrResultCreate =
    trpc.occupationalLifecycle.recordExamResult.useMutation({
      onError: error => toast.error(error.message),
    });
  const resultReview = trpc.occupationalLifecycle.reviewExamResult.useMutation({
    onSuccess: async () => {
      await refresh();
      setReview(null);
      toast.success("Resultado revisado pelo médico.");
    },
    onError: error => toast.error(error.message),
  });
  const resultDocument =
    trpc.occupationalLifecycle.getExamResultDocument.useMutation({
      onSuccess: result => downloadData(result.dataBase64, result.fileName),
      onError: error => toast.error(error.message),
    });
  const examSave = trpc.occupationalLifecycle.upsertExamCatalog.useMutation({
    onSuccess: async () => {
      await refresh();
      setExamOpen(false);
      setExamEditing(null);
      toast.success("Exame salvo no catálogo central.");
    },
    onError: error => toast.error(error.message),
  });
  const providerSave = trpc.occupationalLifecycle.upsertProvider.useMutation({
    onSuccess: async () => {
      await refresh();
      setProviderOpen(false);
      toast.success("Prestador salvo.");
    },
    onError: error => toast.error(error.message),
  });
  const providerActive =
    trpc.occupationalLifecycle.setProviderActive.useMutation({
      onSuccess: async () => {
        await refresh();
        toast.success("Situação do prestador atualizada.");
      },
      onError: error => toast.error(error.message),
    });
  const providerRemove = trpc.occupationalLifecycle.removeProvider.useMutation({
    onSuccess: async result => {
      await refresh();
      toast.success(
        result.mode === "soft_delete"
          ? "Prestador inativado; o histórico foi preservado."
          : "Prestador excluído."
      );
    },
    onError: error => toast.error(error.message),
  });
  const anamnesisSave = trpc.occupationalLifecycle.saveAnamnesis.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("Anamnese registrada no prontuário ocupacional.");
    },
    onError: error => toast.error(error.message),
  });
  const asoIssue = trpc.occupationalLifecycle.issueAso.useMutation({
    onSuccess: async result => {
      await refresh();
      downloadData(result.dataBase64, result.fileName);
      toast.success(
        "ASO emitido e arquivado. A assinatura certificada permanece pendente."
      );
    },
    onError: error => toast.error(error.message),
  });
  const asoDocument = trpc.occupationalLifecycle.getAsoPdf.useMutation({
    onSuccess: result => downloadData(result.dataBase64, result.fileName),
    onError: error => toast.error(error.message),
  });
  const catCreate = trpc.occupationalLifecycle.createCat.useMutation({
    onSuccess: async result => {
      await refresh();
      setCatOpen(false);
      toast.success(
        result.transmission === "bloqueado_dados_vinculo"
          ? "Documento interno da CAT registrado. A transmissão ao eSocial está bloqueada até completar os dados do vínculo."
          : `CAT registrada. Evento ${result.esocialEvent} preparado para futura integração.`
      );
    },
    onError: error => {
      const raw = String(error.message || "");
      const safeMessage =
        /failed query|insert into|select\s|parameters?:/i.test(raw)
          ? "Não foi possível registrar a CAT. Revise os dados destacados ou informe o suporte usando a referência CAT-GRAVACAO."
          : raw || "Não foi possível registrar a CAT.";
      toast.error(safeMessage);
    },
  });
  const catPdf = trpc.occupationalLifecycle.generateCatPdf.useMutation({
    onSuccess: result => downloadData(result.dataBase64, result.fileName),
    onError: error => toast.error(error.message),
  });
  const programmingPdf =
    trpc.occupationalLifecycle.generateOccupationalProgrammingPdf.useMutation({
      onSuccess: result => {
        downloadData(result.dataBase64, result.fileName);
        toast.success(`Programação gerada com ${result.total} registro(s).`);
      },
      onError: error => toast.error(error.message),
    });
  const osCreate = trpc.occupationalLifecycle.createWorkOrder.useMutation({
    onSuccess: async result => {
      await refresh();
      setOsOpen(false);
      toast.success(`${result.created} Ordem(ns) de Serviço criada(s).`);
    },
    onError: error => toast.error(error.message),
  });

  const workers = (workersQ.data || []) as any[];
  const exams = (examsQ.data || []) as any[];
  const providers = (providersQ.data || []) as any[];
  const orders = (ordersQ.data || []) as any[];
  const examPopulation = (populationQ.data || []) as any[];
  const filteredPopulation = useMemo(
    () =>
      examPopulation.filter(row => {
        const search = populationFilters.search.toLowerCase();
        return (
          (!populationFilters.branch ||
            String(row.branch_id) === populationFilters.branch) &&
          (!populationFilters.sector ||
            String(row.sector_id) === populationFilters.sector) &&
          (!populationFilters.gse ||
            String(row.gse_id) === populationFilters.gse) &&
          (!populationFilters.exam ||
            String(row.exam_id) === populationFilters.exam) &&
          (populationFilters.status === "todos" ||
            row.operational_status === populationFilters.status) &&
          (!search ||
            [
              row.collaborator_name,
              row.cpf,
              row.position,
              row.branch_name,
              row.sector_name,
              row.gse_name,
              row.exam_name,
            ].some(value =>
              String(value || "")
                .toLowerCase()
                .includes(search)
            ))
        );
      }),
    [examPopulation, populationFilters]
  );
  const populationBranches = useMemo(
    () => [
      ...new Map(
        examPopulation
          .filter(row => row.branch_id)
          .map(row => [
            String(row.branch_id),
            { id: row.branch_id, name: row.branch_name },
          ])
      ).values(),
    ],
    [examPopulation]
  );
  const populationSectors = useMemo(
    () => [
      ...new Map(
        examPopulation
          .filter(row => row.sector_id)
          .map(row => [
            String(row.sector_id),
            { id: row.sector_id, name: row.sector_name },
          ])
      ).values(),
    ],
    [examPopulation]
  );
  const populationGses = useMemo(
    () => [
      ...new Map(
        examPopulation.map(row => [
          String(row.gse_id),
          { id: row.gse_id, name: `${row.gse_code} · ${row.gse_name}` },
        ])
      ).values(),
    ],
    [examPopulation]
  );
  const results = (resultsQ.data || []) as any[];
  const dashboard = dashboardQ.data as any;

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1540px] space-y-5 p-4 md:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-teal-700">
              <ShieldCheck size={15} /> Fluxo ocupacional integrado
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">
              GSE, PCMSO, Exames e ASO
            </h1>
            <p className="mt-1 max-w-4xl text-sm text-slate-500">
              Da parametrização do trabalhador ao resultado, decisão médica,
              documento versionado e conformidade.
            </p>
          </div>
          <Badge
            className={`rounded-sm ${isDoctor ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"}`}
          >
            {isDoctor ? "Visão clínica - Médico" : "Visão operacional - SESMT"}
          </Badge>
        </header>

        <div className="flex gap-1 overflow-x-auto border-b pb-1">
          {tabs
            .filter(item => isDoctor || item.id !== "anamnese")
            .map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`flex h-9 shrink-0 items-center gap-2 border-b-2 px-3 text-xs font-semibold ${tab === item.id ? "border-teal-600 text-teal-800" : "border-transparent text-slate-500"}`}
                >
                  <Icon size={14} />
                  {item.label}
                </button>
              );
            })}
        </div>

        {tab === "painel" && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <Metric
                label="Cobertura GSE"
                value={`${Number(dashboard?.gse_coverage || 0)}%`}
                warning={Number(dashboard?.workers_without_gse || 0) > 0}
              />
              <Metric
                label="Sem GSE"
                value={Number(dashboard?.workers_without_gse || 0)}
                warning={Number(dashboard?.workers_without_gse || 0) > 0}
              />
              <Metric
                label="Requisições pendentes"
                value={Number(dashboard?.pending_orders || 0)}
                warning={Number(dashboard?.pending_orders || 0) > 0}
              />
              <Metric
                label="Resultados a revisar"
                value={Number(dashboard?.pending_results || 0)}
                warning={Number(dashboard?.pending_results || 0) > 0}
              />
              <Metric
                label="ASOs emitidos"
                value={Number(dashboard?.issued_asos || 0)}
              />
              <Metric
                label="CATs sem envio"
                value={Number(dashboard?.pending_cats || 0)}
                warning={Number(dashboard?.pending_cats || 0) > 0}
              />
            </div>
            <Panel
              title="Arquitetura operacional"
              subtitle="Nenhum dado clínico é redigitado quando pode ser derivado de uma parametrização existente."
            >
              <div className="grid gap-2 text-center text-sm md:grid-cols-5">
                {[
                  "Trabalhador + GSE",
                  "PGR + riscos",
                  "PCMSO + exames",
                  "Resultado + atendimento",
                  "ASO + conformidade",
                ].map((label, index) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="flex-1 border bg-slate-50 px-3 py-5 font-semibold text-slate-800">
                      {label}
                    </div>
                    {index < 4 && (
                      <span className="hidden text-teal-600 md:inline">→</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 border-l-4 border-amber-400 bg-amber-50 p-3 text-sm text-amber-950">
                Resultados, anamnese, conclusão de aptidão e justificativas
                médicas permanecem restritos ao perfil Médico. O SESMT acompanha
                logística, documentos, prazos e situação operacional.
              </div>
            </Panel>
          </>
        )}

        {tab === "requisicoes" && (
          <div className="space-y-4">
            <Panel
                title="Programação ocupacional"
                subtitle="População derivada de colaborador ativo, GSE atual, PGR, PCMSO vigente e matriz médica. Consultas clínicas são procedimentos independentes."
              >
                <div className="mb-3 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
                  <Input
                    value={populationFilters.search}
                    onChange={event =>
                      setPopulationFilters(current => ({
                        ...current,
                        search: event.target.value,
                      }))
                    }
                    placeholder="Buscar trabalhador"
                  />
                  <select
                    className="h-10 border bg-white px-2 text-sm"
                    value={populationFilters.branch}
                    onChange={event =>
                      setPopulationFilters(current => ({
                        ...current,
                        branch: event.target.value,
                      }))
                    }
                  >
                    <option value="">Todas as filiais</option>
                    {populationBranches.map((row: any) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-10 border bg-white px-2 text-sm"
                    value={populationFilters.sector}
                    onChange={event =>
                      setPopulationFilters(current => ({
                        ...current,
                        sector: event.target.value,
                      }))
                    }
                  >
                    <option value="">Todos os setores</option>
                    {populationSectors.map((row: any) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-10 border bg-white px-2 text-sm"
                    value={populationFilters.gse}
                    onChange={event =>
                      setPopulationFilters(current => ({
                        ...current,
                        gse: event.target.value,
                      }))
                    }
                  >
                    <option value="">Todos os GSEs</option>
                    {populationGses.map((row: any) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-10 border bg-white px-2 text-sm"
                    value={populationFilters.exam}
                    onChange={event =>
                      setPopulationFilters(current => ({
                        ...current,
                        exam: event.target.value,
                      }))
                    }
                  >
                    <option value="">Todos os procedimentos</option>
                    {exams
                      .filter(row => Number(row.is_active))
                      .map(row => (
                        <option key={row.id} value={row.id}>
                          {row.name}
                        </option>
                      ))}
                  </select>
                  <select
                    className="h-10 border bg-white px-2 text-sm"
                    value={populationFilters.status}
                    onChange={event =>
                      setPopulationFilters(current => ({
                        ...current,
                        status: event.target.value,
                      }))
                    }
                  >
                    <option value="todos">Todas as situações</option>
                    <option value="requisicao_pendente">
                      Requisição pendente
                    </option>
                    <option value="pendente">Pendente</option>
                    <option value="enviada">Enviada</option>
                    <option value="realizada">Realizada</option>
                    <option value="vencida">Vencida</option>
                    <option value="resultado_recebido">
                      Resultado recebido
                    </option>
                  </select>
                </div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-slate-600">
                    <b>{filteredPopulation.length}</b> de{" "}
                    {examPopulation.length} vínculo(s) ·{" "}
                    <b>
                      {
                        filteredPopulation.filter(
                          row =>
                            row.operational_status === "requisicao_pendente"
                        ).length
                      }
                    </b>{" "}
                    aguardam requisição
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      disabled={programmingPdf.isPending}
                      onClick={() =>
                        programmingPdf.mutate({
                          branchId: populationFilters.branch
                            ? Number(populationFilters.branch)
                            : undefined,
                          sectorId: populationFilters.sector
                            ? Number(populationFilters.sector)
                            : undefined,
                          gseId: populationFilters.gse
                            ? Number(populationFilters.gse)
                            : undefined,
                          examId: populationFilters.exam
                            ? Number(populationFilters.exam)
                            : undefined,
                          status: populationFilters.status as any,
                        })
                      }
                    >
                      <Download size={14} className="mr-2" /> Relatório PDF
                    </Button>
                    <Button
                      disabled={!selectedPopulation.length}
                      onClick={() => setPcmsoOrderOpen(true)}
                    >
                      <FilePlus2 size={14} className="mr-2" /> Gerar pelo PCMSO
                      ({selectedPopulation.length})
                    </Button>
                  </div>
                </div>
                <div className="max-h-96 overflow-auto border">
                  <table className="w-full min-w-[1250px] text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-xs text-slate-600">
                      <tr>
                        <th className="w-10 p-2">
                          <input
                            type="checkbox"
                            checked={
                              Boolean(filteredPopulation.length) &&
                              selectedPopulation.length === filteredPopulation.length
                            }
                            onChange={event =>
                              setSelectedPopulation(
                                event.target.checked
                                  ? filteredPopulation.map(row => ({
                                        collaboratorId: Number(
                                          row.collaborator_id
                                        ),
                                        monitoringId: Number(row.monitoring_id),
                                      }))
                                  : []
                              )
                            }
                          />
                        </th>
                        <th className="p-2 text-left">Trabalhador</th>
                        <th className="p-2 text-left">Filial / setor</th>
                        <th className="p-2 text-left">GSE</th>
                        <th className="p-2 text-left">PGR / PCMSO</th>
                        <th className="p-2 text-left">Procedimento</th>
                        <th className="p-2 text-left">Prestadores aptos</th>
                        <th className="p-2 text-left">Periodicidade</th>
                        <th className="p-2 text-left">Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPopulation.map(row => {
                        const key = `${row.collaborator_id}:${row.monitoring_id}`;
                        const checked = selectedPopulation.some(
                          item =>
                            `${item.collaboratorId}:${item.monitoringId}` ===
                            key
                        );
                        return (
                          <tr key={key} className="border-t">
                            <td className="p-2 text-center">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setSelectedPopulation(current =>
                                    checked
                                      ? current.filter(
                                          item =>
                                            `${item.collaboratorId}:${item.monitoringId}` !==
                                            key
                                        )
                                      : [
                                          ...current,
                                          {
                                            collaboratorId: Number(
                                              row.collaborator_id
                                            ),
                                            monitoringId: Number(
                                              row.monitoring_id
                                            ),
                                          },
                                        ]
                                  )
                                }
                              />
                            </td>
                            <td className="p-2 font-medium">
                              {row.collaborator_name}
                              <br />
                              <span className="text-xs text-slate-500">
                                {row.position || "Sem cargo"}
                              </span>
                            </td>
                            <td className="p-2">
                              {row.branch_name || "-"}
                              <br />
                              <span className="text-xs text-slate-500">
                                {row.sector_name || "-"}
                              </span>
                            </td>
                            <td className="p-2">
                              {row.gse_code} · {row.gse_name}
                            </td>
                            <td className="p-2">
                              {row.pgr_title || "PGR não identificado"}
                              <br />
                              <span className="text-xs text-slate-500">
                                {row.pcmso_title}
                              </span>
                            </td>
                            <td className="p-2">
                              <Badge
                                className={`mb-1 rounded-sm ${row.procedure_kind === "consulta_clinica" ? "bg-sky-100 text-sky-800" : "bg-violet-100 text-violet-800"}`}
                              >
                                {row.procedure_kind === "consulta_clinica"
                                  ? "Consulta clínica"
                                  : "Exame complementar"}
                              </Badge>
                              <br />
                              <b>{row.exam_name}</b>
                            </td>
                            <td className="p-2 text-xs">
                              {row.recommendedProviders?.join(", ") ||
                                "A definir"}
                            </td>
                            <td className="p-2">
                              {row.periodicity || "Definida pelo médico"}
                            </td>
                            <td className="p-2">
                              <Badge
                                className={`rounded-sm ${statusTone(row.operational_status)}`}
                              >
                                {String(row.operational_status).replaceAll(
                                  "_",
                                  " "
                                )}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!filteredPopulation.length && (
                    <p className="p-6 text-center text-sm text-slate-500">
                      Nenhum procedimento ocupacional encontrado para os filtros
                      informados.
                    </p>
                  )}
                </div>
              </Panel>
            <Panel
              title="Requisições de exames ocupacionais"
              subtitle="Cada emissão possui número, validade, prestador, local e histórico próprios."
              action={
                <div className="flex gap-2">
                    <Button
                      variant="outline"
                      disabled={!selectedOrders.length}
                      onClick={() =>
                        generateGroupedPdf.mutate({ ids: selectedOrders })
                      }
                    >
                      <Download size={14} className="mr-2" /> PDF agrupado (
                      {selectedOrders.length})
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setOrderOpen(true)}
                    >
                      <Plus size={14} className="mr-2" /> Exceção manual
                    </Button>
                  </div>
              }
            >
              <div className="overflow-auto border">
                <table className="w-full min-w-[1220px] text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-600">
                    <tr>
                      <th className="w-10 p-2">
                        <input
                          type="checkbox"
                          checked={
                            Boolean(orders.length) &&
                            selectedOrders.length === orders.length
                          }
                          onChange={event =>
                            setSelectedOrders(
                              event.target.checked
                                ? orders.map(row => Number(row.id))
                                : []
                            )
                          }
                        />
                      </th>
                      <th className="p-2 text-left">Requisição</th>
                      <th className="p-2 text-left">Trabalhador</th>
                      <th className="p-2 text-left">GSE</th>
                      <th className="p-2 text-left">Exame</th>
                      <th className="p-2 text-left">Prestador</th>
                      <th className="p-2 text-left">Validade</th>
                      <th className="p-2 text-left">Situação</th>
                      <th className="p-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(row => (
                      <tr key={row.id} className="border-t">
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={selectedOrders.includes(Number(row.id))}
                            onChange={() =>
                              setSelectedOrders(current =>
                                current.includes(Number(row.id))
                                  ? current.filter(id => id !== Number(row.id))
                                  : [...current, Number(row.id)]
                              )
                            }
                          />
                        </td>
                        <td className="p-2">
                          <span className="font-semibold">
                            {row.order_number}
                          </span>
                          <br />
                          <span className="text-xs text-slate-500">
                            {row.version_label} · Exercício {row.exercise_year || "-"}
                          </span>
                        </td>
                        <td className="p-2">
                          {row.collaborator_name}
                          <br />
                          <span className="text-xs text-slate-500">
                            {row.cpf || row.employee_registration || "-"}
                          </span>
                        </td>
                        <td className="p-2">
                          {row.gse_code || "-"}
                          <br />
                          <span className="text-xs text-slate-500">
                            {row.gse_name || "Sem GSE"}
                          </span>
                        </td>
                        <td className="p-2 font-medium">
                          {row.exam_name}
                          {row.request_type === "repeticao" && (
                            <>
                              <br />
                              <Badge className="mt-1 rounded-sm bg-amber-100 text-amber-900">
                                Repetição
                              </Badge>
                            </>
                          )}
                        </td>
                        <td className="p-2">
                          {row.provider_trade_name ||
                            row.provider_legal_name ||
                            "A definir"}
                        </td>
                        <td className="p-2">{dateOnly(row.valid_until)}</td>
                        <td className="p-2">
                          <Badge
                            className={`rounded-sm ${statusTone(row.status)}`}
                          >
                            {row.status}
                          </Badge>
                        </td>
                        <td className="p-2">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Gerar PDF"
                              onClick={() =>
                                generateOrderPdf.mutate({ id: Number(row.id) })
                              }
                            >
                              <Download size={15} />
                            </Button>
                            {!isDoctor && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  title="Enviar por e-mail"
                                  onClick={() =>
                                    emailOrder.mutate({ id: Number(row.id) })
                                  }
                                >
                                  <Send size={15} />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setReissue(row)}
                                >
                                  Emitir nova via
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!orders.length && (
                  <p className="p-8 text-center text-sm text-slate-500">
                    Nenhuma requisição emitida.
                  </p>
                )}
              </div>
            </Panel>
          </div>
        )}

        {tab === "resultados" && (
          <Panel
            title="Resultados de exames"
            subtitle={
              isDoctor
                ? "Referências do próprio laudo orientam a revisão. A plataforma não produz diagnóstico nem aptidão automática."
                : "O SESMT recebe e vincula o documento. Conteúdo clínico detalhado fica restrito ao Médico."
            }
            action={
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOcrOpen(true)}>
                  <Microscope size={14} className="mr-2" /> Importar lote OCR
                </Button>
                <Button onClick={() => setResultOpen(true)}>
                  <FilePlus2 size={14} className="mr-2" /> Lançar resultado
                </Button>
              </div>
            }
          >
            <div className="overflow-auto border">
              <table className="w-full min-w-[1050px] text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="p-2 text-left">Trabalhador</th>
                    <th className="p-2 text-left">Exame</th>
                    <th className="p-2 text-left">Data</th>
                    <th className="p-2 text-left">Origem</th>
                    <th className="p-2 text-left">Identidade</th>
                    <th className="p-2 text-left">Classificação</th>
                    <th className="p-2 text-left">Resumo</th>
                    {isDoctor && <th className="p-2"></th>}
                  </tr>
                </thead>
                <tbody>
                  {results.map(row => (
                    <tr key={row.id} className="border-t">
                      <td className="p-2 font-medium">
                        {row.collaborator_name}
                      </td>
                      <td className="p-2">{row.exam_name}</td>
                      <td className="p-2">
                        {new Date(row.performed_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="p-2">{row.source}</td>
                      <td className="p-2">{row.identity_status}</td>
                      <td className="p-2">
                        <Badge
                          className={`rounded-sm ${statusTone(row.classification)}`}
                        >
                          {row.classification.replaceAll("_", " ")}
                        </Badge>
                      </td>
                      <td className="max-w-md p-2 text-xs text-slate-600">
                        {row.result_summary || "Documento recebido"}
                      </td>
                      {isDoctor && (
                        <td className="p-2 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setReview(row)}
                          >
                            Revisar
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {tab === "catalogo" && (
          <Panel
            title="Catálogo central de exames ocupacionais"
            subtitle="Fonte única para PCMSO, requisições, resultados, ASO e relatório analítico."
            action={
              <Button
                onClick={() => {
                  setExamEditing(null);
                  setExamOpen(true);
                }}
              >
                <Plus size={14} className="mr-2" /> Novo exame
              </Button>
            }
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {exams.map(row => (
                <div key={row.id} className="border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{row.name}</p>
                      <p className="text-xs text-slate-500">
                        {row.category || "Sem categoria"} · {row.exam_type}
                      </p>
                    </div>
                    <Badge
                      className={`rounded-sm ${Number(row.is_active) ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}
                    >
                      {Number(row.is_active) ? "ativo" : "inativo"}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    {row.description || "Sem descrição."}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                    <span>Resultado: {row.result_type}</span>
                    <span>
                      Periodicidade: {row.default_periodicity || "médica"}
                    </span>
                  </div>
                  <Button
                    className="mt-3 w-full"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setExamEditing(row);
                      setExamOpen(true);
                    }}
                  >
                    Editar exame
                  </Button>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {tab === "prestadores" && (
          <Panel
            title="Prestadores de Saúde Ocupacional"
            subtitle="Cadastro mestre com vínculo aos exames do catálogo, credenciamento, atendimento in loco e preservação do histórico."
            action={
              !isDoctor && (
                <Button
                  onClick={() => {
                    setProviderEditing(null);
                    setProviderOpen(true);
                  }}
                >
                  <Plus size={14} className="mr-2" /> Novo prestador
                </Button>
              )
            }
          >
            <div className="overflow-auto border">
              <table className="w-full min-w-[1180px] text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="p-2 text-left">Prestador</th>
                    <th className="p-2 text-left">CNPJ</th>
                    <th className="p-2 text-left">Município/UF</th>
                    <th className="p-2 text-left">Contato</th>
                    <th className="p-2 text-left">Exames vinculados</th>
                    <th className="p-2 text-left">Credenciamento</th>
                    <th className="p-2 text-left">Histórico</th>
                    {!isDoctor && <th className="p-2 text-right">Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {providers.map(row => (
                    <tr
                      key={row.id}
                      className={`border-t ${Number(row.is_active) ? "" : "bg-slate-50 text-slate-500"}`}
                    >
                      <td className="p-2 font-medium">
                        {row.trade_name || row.legal_name}
                        <br />
                        <span className="text-xs text-slate-500">
                          {row.legal_name}
                        </span>
                      </td>
                      <td className="p-2">{row.cnpj || "-"}</td>
                      <td className="p-2">
                        {[row.municipality, row.uf].filter(Boolean).join("/") ||
                          "-"}
                      </td>
                      <td className="p-2">
                        {row.email || "-"}
                        <br />
                        <span className="text-xs text-slate-500">
                          {row.phone || "-"}
                        </span>
                      </td>
                      <td className="max-w-sm p-2 text-xs">
                        {row.examNames?.join(", ") || "Nenhum exame vinculado"}
                      </td>
                      <td className="p-2">
                        <Badge
                          className={`rounded-sm ${Number(row.is_active) ? statusTone(row.credential_status) : "bg-slate-200 text-slate-700"}`}
                        >
                          {Number(row.is_active)
                            ? row.credential_status
                            : "inativo"}
                        </Badge>
                        <br />
                        <span className="text-xs">
                          até {dateOnly(row.credential_valid_until)}
                        </span>
                      </td>
                      <td className="p-2">
                        {Number(row.history_count || 0)} requisição(ões)
                      </td>
                      {!isDoctor && (
                        <td className="p-2">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setProviderEditing(row);
                                setProviderOpen(true);
                              }}
                            >
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                providerActive.mutate({
                                  id: Number(row.id),
                                  active: !Number(row.is_active),
                                })
                              }
                            >
                              {Number(row.is_active) ? "Inativar" : "Reativar"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-700"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    row.canDelete
                                      ? "Excluir este prestador?"
                                      : "Este prestador possui histórico e será apenas inativado. Continuar?"
                                  )
                                )
                                  providerRemove.mutate({ id: Number(row.id) });
                              }}
                            >
                              Excluir
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
            downloadAso={(id: number) => asoDocument.mutate({ id })}
            busy={anamnesisSave.isPending || asoIssue.isPending}
            asos={(asosQ.data || []) as any[]}
          />
        )}

        {tab === "dossie" && (
          <div className="space-y-4">
            <Panel
              title="Dossiê ocupacional individual"
              subtitle="Visão longitudinal de vínculo, GSE, PGR, PCMSO, requisições, comunicações e documentos. O SESMT não recebe conteúdo clínico desnecessário."
            >
              <label className="block max-w-xl text-xs font-semibold">
                Trabalhador
                <select
                  className="mt-1 h-10 w-full border bg-white px-3 text-sm"
                  value={dossierWorkerId}
                  onChange={event =>
                    setDossierWorkerId(Number(event.target.value))
                  }
                >
                  <option value={0}>Selecione um trabalhador</option>
                  {workers.map(row => (
                    <option key={row.id} value={row.id}>
                      {row.name} ·{" "}
                      {row.cpf ||
                        row.employee_registration ||
                        "sem identificador"}
                    </option>
                  ))}
                </select>
              </label>
            </Panel>
            {dossierQ.data && (
              <>
                <Panel
                  title={(dossierQ.data as any).worker?.name || "Trabalhador"}
                  subtitle={`${(dossierQ.data as any).worker?.branch_name || "Sem filial"} · ${(dossierQ.data as any).worker?.sector_name || "Sem setor"} · ${(dossierQ.data as any).worker?.position || "Sem cargo"}`}
                >
                  <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                    <Metric
                      label="Histórico de GSE"
                      value={(dossierQ.data as any).gseHistory?.length || 0}
                    />
                    <Metric
                      label="Requisições"
                      value={(dossierQ.data as any).orders?.length || 0}
                    />
                    <Metric
                      label="ASOs"
                      value={(dossierQ.data as any).asos?.length || 0}
                    />
                    <Metric
                      label="CATs"
                      value={(dossierQ.data as any).cats?.length || 0}
                    />
                    <Metric
                      label="Histórico laboral"
                      value={(dossierQ.data as any).laborHistory?.length || 0}
                    />
                    <Metric
                      label="PPPs gerados"
                      value={(dossierQ.data as any).pppDocuments?.length || 0}
                    />
                  </div>
                </Panel>
                <div className="grid gap-4 xl:grid-cols-2">
                  <Panel title="GSE, PGR e PCMSO">
                    <div className="space-y-2 text-sm">
                      {(dossierQ.data as any).gseHistory?.map(
                        (row: any, index: number) => (
                          <div
                            key={`${row.gse_id}:${index}`}
                            className="border p-3"
                          >
                            <b>
                              {row.gse_code} · {row.gse_name}
                            </b>
                            <br />
                            <span className="text-xs text-slate-500">
                              {dateOnly(row.valid_from)} até{" "}
                              {row.is_current
                                ? "atual"
                                : dateOnly(row.valid_until)}{" "}
                              · {row.reason}
                            </span>
                          </div>
                        )
                      )}
                      {(dossierQ.data as any).programs?.map((row: any) => (
                        <div
                          key={row.id}
                          className="border border-teal-200 bg-teal-50 p-3"
                        >
                          <b>{row.pcmso_title || row.title}</b>
                          <br />
                          <span className="text-xs">
                            PGR: {row.pgr_title || "não identificado"} ·{" "}
                            {row.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Panel>
                  <Panel title="Riscos e monitoramento">
                    <div className="max-h-80 space-y-2 overflow-auto">
                      {(dossierQ.data as any).risks?.map(
                        (row: any, index: number) => (
                          <div
                            key={`${row.risk_name}:${index}`}
                            className="border p-3 text-sm"
                          >
                            <b>{row.risk_name}</b>
                            <br />
                            <span className="text-xs text-slate-500">
                              {row.risk_classification || "sem classificação"} ·{" "}
                              {row.exam_name ||
                                row.monitoring_name ||
                                row.monitoring_kind}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </Panel>
                  <Panel title="Requisições e comunicações">
                    <div className="max-h-80 space-y-2 overflow-auto">
                      {(dossierQ.data as any).orders?.map((row: any) => (
                        <div key={row.id} className="border p-3 text-sm">
                          <div className="flex justify-between">
                            <b>{row.order_number}</b>
                            <Badge
                              className={`rounded-sm ${statusTone(row.status)}`}
                            >
                              {row.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500">
                            {row.exam_name} ·{" "}
                            {row.provider_name || "prestador a definir"} ·
                            válida até {dateOnly(row.valid_until)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </Panel>
                  <Panel title="Resultados, ASO e CAT">
                    <div className="max-h-80 space-y-2 overflow-auto">
                      {(dossierQ.data as any).results?.map((row: any) => (
                        <div key={`r${row.id}`} className="border p-3 text-sm">
                          <b>{row.exam_name}</b> · {dateOnly(row.performed_at)}
                          <br />
                          <span className="text-xs text-slate-500">
                            {row.classification}
                          </span>
                        </div>
                      ))}
                      {(dossierQ.data as any).asos?.map((row: any) => (
                        <div key={`a${row.id}`} className="border p-3 text-sm">
                          <b>ASO {row.aso_type}</b> · {dateOnly(row.issued_at)}
                          <br />
                          <span className="text-xs text-slate-500">
                            {row.fitness_status} · {row.signature_status}
                          </span>
                        </div>
                      ))}
                      {(dossierQ.data as any).cats?.map((row: any) => (
                        <div key={`c${row.id}`} className="border p-3 text-sm">
                          <b>CAT {row.accident_type || "sem tipo"}</b> ·{" "}
                          {dateOnly(row.event_at)}
                          <br />
                          <span className="text-xs text-slate-500">
                            eSocial: {row.esocial_status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Panel>
                  <Panel title="Histórico laboral e PPP">
                    <div className="max-h-80 space-y-2 overflow-auto">
                      {(dossierQ.data as any).laborHistory?.map((row: any) => (
                        <div key={`h${row.id}`} className="border p-3 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <b>{String(row.event_type || "evento").replaceAll("_", " ")}</b>
                            <Badge
                              className={`rounded-sm ${row.status === "valido" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}
                            >
                              {row.status}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {dateOnly(row.valid_from)} até {row.valid_until ? dateOnly(row.valid_until) : "atual"}
                            {row.position_name ? ` · ${row.position_name}` : ""}
                            {row.gse_name ? ` · ${row.gse_name}` : ""}
                          </p>
                          <p className="mt-1 text-xs">
                            {row.risk_agent || row.exam_name || row.source_document || `Origem: ${row.origin}`}
                          </p>
                        </div>
                      ))}
                      {(dossierQ.data as any).pppDocuments?.map((row: any) => (
                        <div
                          key={`p${row.id}`}
                          className="border border-teal-200 bg-teal-50 p-3 text-sm"
                        >
                          <b>PPP consolidado · versão {row.version_number}</b>
                          <p className="mt-1 text-xs text-slate-600">
                            Referência {dateOnly(row.reference_date)} · responsável {row.legal_responsible_name}
                          </p>
                        </div>
                      ))}
                      {!(dossierQ.data as any).laborHistory?.length &&
                      !(dossierQ.data as any).pppDocuments?.length ? (
                        <p className="text-sm text-slate-500">
                          Nenhum histórico anterior ou PPP consolidado localizado.
                        </p>
                      ) : null}
                    </div>
                  </Panel>
                </div>
              </>
            )}
          </div>
        )}

        {tab === "indicadores" &&
          (() => {
            const indicators = indicatorsQ.data as any;
            return (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <Metric
                    label="Colaboradores ativos"
                    value={Number(indicators?.active_workers || 0)}
                  />
                  <Metric
                    label="Cobertura GSE"
                    value={`${Number(indicators?.gseCoverage || 0)}%`}
                    warning={Number(indicators?.gseCoverage || 0) < 100}
                  />
                  <Metric
                    label="Requisições abertas"
                    value={Number(indicators?.orders_open || 0)}
                    warning={Number(indicators?.orders_open || 0) > 0}
                  />
                  <Metric
                    label="Revisão de resultados"
                    value={`${Number(indicators?.resultReviewRate || 0)}%`}
                  />
                  <Metric
                    label="Prestadores ativos"
                    value={Number(indicators?.active_providers || 0)}
                    warning={!Number(indicators?.active_providers || 0)}
                  />
                </div>
                <Panel
                  title="Conformidade ocupacional integrada"
                  subtitle="O indicador abre a origem da pendência sem expor detalhes clínicos."
                >
                  <div className="grid gap-3 md:grid-cols-4">
                    {Object.entries(indicators?.conformity || {}).map(
                      ([key, value]: any) => (
                        <div key={key} className="border p-4">
                          <p className="text-xs font-semibold uppercase text-slate-500">
                            {key}
                          </p>
                          <Badge
                            className={`mt-2 rounded-sm ${value === "conforme" ? "bg-emerald-100 text-emerald-800" : value === "atencao" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}
                          >
                            {String(value).replaceAll("_", " ")}
                          </Badge>
                        </div>
                      )
                    )}
                  </div>
                </Panel>
                <Panel
                  title="Distribuição operacional por filial"
                  subtitle="Somente grupos com pelo menos cinco trabalhadores são exibidos nesta visão consolidada."
                >
                  <div className="overflow-auto border">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="p-2 text-left">Filial</th>
                          <th className="p-2 text-right">Trabalhadores</th>
                          <th className="p-2 text-right">Requisições</th>
                          <th className="p-2 text-right">ASOs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(indicators?.branches || []).map((row: any) => (
                          <tr key={row.branch_name} className="border-t">
                            <td className="p-2">{row.branch_name}</td>
                            <td className="p-2 text-right">{row.workers}</td>
                            <td className="p-2 text-right">{row.orders}</td>
                            <td className="p-2 text-right">{row.asos}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    {indicators?.privacyRule}
                  </p>
                </Panel>
              </div>
            );
          })()}

        {tab === "cat_os" && (
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel
              title="Comunicação de Acidente de Trabalho"
              subtitle="Registro estruturado preparado para o evento S-2210. A transmissão depende da futura integração eSocial."
              action={
                !isDoctor && (
                  <Button onClick={() => setCatOpen(true)}>
                    <Plus size={14} className="mr-2" /> Abrir CAT
                  </Button>
                )
              }
            >
              <div className="space-y-2">
                {((catsQ.data || []) as any[]).slice(0, 20).map(row => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between gap-3 border p-3"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {row.collaborator_name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(row.event_at).toLocaleString("pt-BR")} ·{" "}
                        {row.accident_type || "Tipo não definido"}
                        <br />
                        S-2210 · {row.esocial_version || "S-1.3 NT 06/2026"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={`rounded-sm ${statusTone(row.esocial_status)}`}
                      >
                        {row.esocial_status}
                      </Badge>
                      <Button
                        size="icon"
                        variant="outline"
                        title="Gerar PDF interno da CAT"
                        onClick={() => catPdf.mutate({ id: Number(row.id) })}
                      >
                        <Download size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel
              title="Ordens de Serviço"
              subtitle="Riscos, medidas, EPI, EPC, treinamentos, ciência e vigência vinculados ao trabalhador e ao GSE."
              action={
                !isDoctor && (
                  <Button onClick={() => setOsOpen(true)}>
                    <Plus size={14} className="mr-2" /> Gerar em lote
                  </Button>
                )
              }
            >
              <div className="space-y-2">
                {((workOrdersQ.data || []) as any[]).slice(0, 20).map(row => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between gap-3 border p-3"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {row.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        {row.collaborator_name} · {row.gse_code || "Sem GSE"}
                      </p>
                    </div>
                    <Badge
                      className={`rounded-sm ${statusTone(row.acknowledgement_status)}`}
                    >
                      {row.acknowledgement_status}
                    </Badge>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}

        {tab === "auditoria" && (
          <Panel
            title="Trilha de auditoria ocupacional"
            subtitle="Reconstrução de atribuições, requisições, resultados, decisões médicas e documentos."
          >
            <div className="overflow-auto border">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="p-2 text-left">Data</th>
                    <th className="p-2 text-left">Usuário</th>
                    <th className="p-2 text-left">Ação</th>
                    <th className="p-2 text-left">Entidade</th>
                    <th className="p-2 text-left">Trabalhador</th>
                  </tr>
                </thead>
                <tbody>
                  {((auditQ.data || []) as any[]).map(row => (
                    <tr key={row.id} className="border-t">
                      <td className="p-2">
                        {new Date(row.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="p-2">
                        {row.actor_name || `Usuário ${row.actor_user_id}`}
                      </td>
                      <td className="p-2 font-medium">{row.action}</td>
                      <td className="p-2">
                        {row.entity_type} #{row.entity_id || "-"}
                      </td>
                      <td className="p-2">{row.collaborator_name || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        <OrderDialog
          open={orderOpen}
          close={() => setOrderOpen(false)}
          workers={workers}
          exams={exams}
          providers={providers}
          busy={orderCreate.isPending}
          save={(payload: any) => orderCreate.mutate(payload)}
        />
        <PcmsoOrderDialog
          open={pcmsoOrderOpen}
          close={() => setPcmsoOrderOpen(false)}
          items={selectedPopulation}
          population={examPopulation}
          providers={providers}
          busy={pcmsoOrderCreate.isPending}
          save={(payload: any) => pcmsoOrderCreate.mutate(payload)}
        />
        <ReissueDialog
          row={reissue}
          close={() => setReissue(null)}
          providers={providers}
          busy={reissueOrder.isPending}
          save={(payload: any) => reissueOrder.mutate(payload)}
        />
        <ResultDialog
          open={resultOpen}
          close={() => setResultOpen(false)}
          workers={workers}
          exams={exams}
          orders={orders}
          busy={resultCreate.isPending}
          save={(payload: any) => resultCreate.mutate(payload)}
        />
        <OcrBatchDialog
          open={ocrOpen}
          close={() => setOcrOpen(false)}
          workers={workers}
          exams={exams}
          providers={providers}
          analyzing={ocrAnalyze.isPending}
          saving={ocrResultCreate.isPending}
          analyze={(documents: any[]) => ocrAnalyze.mutateAsync({ documents })}
          save={async (rows: any[]) => {
            for (const row of rows) await ocrResultCreate.mutateAsync(row);
            await refresh();
            setOcrOpen(false);
            toast.success(
              `${rows.length} resultado(s) importado(s) e encaminhado(s) para revisão médica.`
            );
          }}
        />
        <ReviewDialog
          row={review}
          close={() => setReview(null)}
          busy={resultReview.isPending || resultDocument.isPending}
          viewDocument={() =>
            review && resultDocument.mutate({ id: Number(review.id) })
          }
          save={(payload: any) => resultReview.mutate(payload)}
        />
        <ExamDialog
          open={examOpen}
          close={() => {
            setExamOpen(false);
            setExamEditing(null);
          }}
          row={examEditing}
          busy={examSave.isPending}
          save={(payload: any) => examSave.mutate(payload)}
        />
        <ProviderDialog
          open={providerOpen}
          close={() => {
            setProviderOpen(false);
            setProviderEditing(null);
          }}
          row={providerEditing}
          exams={exams}
          busy={providerSave.isPending}
          save={(payload: any) => providerSave.mutate(payload)}
        />
        <CatDialog
          open={catOpen}
          close={() => setCatOpen(false)}
          workers={workers}
          busy={catCreate.isPending}
          save={(payload: any) => catCreate.mutate(payload)}
        />
        <WorkOrderDialog
          open={osOpen}
          close={() => setOsOpen(false)}
          workers={workers}
          busy={osCreate.isPending}
          save={(payload: any) => osCreate.mutate(payload)}
        />
      </div>
    </AppLayout>
  );
}

function WorkerMultiSelect({
  workers,
  selected,
  setSelected,
}: {
  workers: any[];
  selected: number[];
  setSelected: (ids: number[]) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () =>
      workers.filter(row =>
        [row.name, row.cpf, row.position, row.gse_name].some(value =>
          String(value || "")
            .toLowerCase()
            .includes(search.toLowerCase())
        )
      ),
    [workers, search]
  );
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-3 text-slate-400" size={15} />
        <Input
          className="pl-9"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Buscar trabalhador"
        />
      </div>
      <div className="max-h-56 overflow-auto border">
        {filtered.map(row => (
          <label
            key={row.id}
            className="flex items-center gap-3 border-b p-2 text-sm"
          >
            <input
              type="checkbox"
              checked={selected.includes(Number(row.id))}
              onChange={() =>
                setSelected(
                  selected.includes(Number(row.id))
                    ? selected.filter(id => id !== Number(row.id))
                    : [...selected, Number(row.id)]
                )
              }
            />
            <span className="flex-1">
              <b>{row.name}</b>
              <br />
              <span className="text-xs text-slate-500">
                {row.gse_code || "Sem GSE"} · {row.position || "Sem cargo"}
              </span>
            </span>
          </label>
        ))}
      </div>
      <div className="flex justify-between text-xs">
        <button
          className="font-semibold text-teal-700"
          onClick={() => setSelected(filtered.map(row => Number(row.id)))}
        >
          Selecionar encontrados
        </button>
        <span>{selected.length} selecionado(s)</span>
      </div>
    </div>
  );
}

function PcmsoOrderDialog({
  open,
  close,
  items,
  population,
  providers,
  busy,
  save,
}: any) {
  const currentYear = new Date().getFullYear();
  const [providerId, setProviderId] = useState(0);
  const [mode, setMode] = useState("prestador");
  const [location, setLocation] = useState("");
  const [valid, setValid] = useState("");
  const [orientations, setOrientations] = useState("");
  const [exerciseYear, setExerciseYear] = useState(currentYear);
  const [repeatByKey, setRepeatByKey] = useState<
    Record<string, { enabled: boolean; justification: string }>
  >({});
  const [analysisDirty, setAnalysisDirty] = useState(true);
  const preview =
    trpc.occupationalLifecycle.previewExamOrdersFromPcmso.useMutation({
      onSuccess: () => setAnalysisDirty(false),
      onError: error => toast.error(error.message),
    });
  const selectionKey = items
    .map((item: any) => `${item.collaboratorId}:${item.monitoringId}`)
    .sort()
    .join("|");
  useEffect(() => {
    if (!open) return;
    setRepeatByKey({});
    setAnalysisDirty(true);
    preview.reset();
  }, [open, selectionKey]);
  const selectedRows = population.filter((row: any) =>
    items.some(
      (item: any) =>
        Number(item.collaboratorId) === Number(row.collaborator_id) &&
        Number(item.monitoringId) === Number(row.monitoring_id)
    )
  );
  const selectedExamIds = [
    ...new Set(selectedRows.map((row: any) => Number(row.exam_id))),
  ];
  const eligibleProviders = providers.filter(
    (row: any) =>
      Number(row.is_active) &&
      selectedExamIds.every(examId => row.examIds?.includes(examId))
  );
  const requestItems = items.map((item: any) => {
    const key = `${item.collaboratorId}:${item.monitoringId}`;
    const repeat = repeatByKey[key];
    return {
      ...item,
      requestType: repeat?.enabled ? "repeticao" : "normal",
      justification: repeat?.enabled ? repeat.justification : undefined,
    };
  });
  const previewRows = (preview.data?.rows || []) as any[];
  const itemsToGenerate = previewRows
    .filter(row => row.shouldGenerate)
    .map(row => {
      const key = `${row.collaboratorId}:${row.monitoringId}`;
      const repeat = repeatByKey[key];
      return {
        collaboratorId: Number(row.collaboratorId),
        monitoringId: Number(row.monitoringId),
        requestType: repeat?.enabled ? "repeticao" : "normal",
        justification: repeat?.enabled ? repeat.justification : undefined,
      };
    });

  const analyze = () => {
    if (exerciseYear < 2000 || exerciseYear > 2100) {
      toast.error("Informe um exercício válido.");
      return;
    }
    preview.mutate({ exerciseYear, items: requestItems });
  };

  const updateRepeat = (
    key: string,
    patch: Partial<{ enabled: boolean; justification: string }>
  ) => {
    setRepeatByKey(current => ({
      ...current,
      [key]: {
        enabled: current[key]?.enabled || false,
        justification: current[key]?.justification || "",
        ...patch,
      },
    }));
    setAnalysisDirty(true);
  };

  return (
    <Dialog open={open} onOpenChange={value => !value && close()}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerar requisições previstas no PCMSO</DialogTitle>
        </DialogHeader>
        <div className="border-l-4 border-teal-500 bg-teal-50 p-3 text-sm">
          O PCMSO define os procedimentos. Antes da emissão, a plataforma cruza
          trabalhador, exame, exercício e resultado. Uma requisição anterior sem
          resultado não encerra a obrigação.
        </div>
        <div className="grid gap-3 border bg-slate-50 p-3 md:grid-cols-[180px_1fr_auto] md:items-end">
          <label className="text-xs font-semibold">
            Exercício obrigatório
            <Input
              className="mt-1 bg-white"
              type="number"
              min={2000}
              max={2100}
              value={exerciseYear}
              onChange={event => {
                setExerciseYear(Number(event.target.value));
                setAnalysisDirty(true);
              }}
            />
          </label>
          <p className="text-xs text-slate-600">
            A conferência é individual por trabalhador e exame. Resultados já
            registrados no exercício bloqueiam uma emissão normal.
          </p>
          <Button variant="outline" disabled={preview.isPending} onClick={analyze}>
            {preview.isPending ? "Analisando..." : "Analisar exercício"}
          </Button>
        </div>
        {preview.data && (
          <div className="grid gap-2 sm:grid-cols-3">
            <Metric label="Analisados" value={preview.data.summary.analyzed} />
            <Metric label="Serão gerados" value={preview.data.summary.toGenerate} />
            <Metric
              label="Não serão gerados"
              value={preview.data.summary.notGenerated}
              warning={preview.data.summary.notGenerated > 0}
            />
          </div>
        )}
        {previewRows.length > 0 && (
          <div className="max-h-80 overflow-auto border">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className="p-2 text-left">Trabalhador</th>
                  <th className="p-2 text-left">Exame</th>
                  <th className="p-2 text-left">Situação no exercício</th>
                  <th className="p-2 text-left">Ação</th>
                  <th className="p-2 text-left">Repetição justificada</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map(row => {
                  const key = `${row.collaboratorId}:${row.monitoringId}`;
                  const repeat = repeatByKey[key] || {
                    enabled: false,
                    justification: "",
                  };
                  const hasResult = Number(row.resultCount || 0) > 0;
                  return (
                    <tr key={key} className="border-t align-top">
                      <td className="p-2 font-medium">
                        {row.collaborator_name || `Colaborador ${row.collaboratorId}`}
                      </td>
                      <td className="p-2">{row.exam_name || "Procedimento"}</td>
                      <td className="p-2">
                        <Badge
                          className={`rounded-sm ${row.shouldGenerate ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}
                        >
                          {String(row.status || "").replaceAll("_", " ")}
                        </Badge>
                        <p className="mt-1 max-w-md text-xs text-slate-600">
                          {row.reason}
                        </p>
                      </td>
                      <td className="p-2 font-semibold">
                        {row.shouldGenerate ? "Gerar" : "Não gerar"}
                      </td>
                      <td className="p-2">
                        {hasResult ? (
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-xs font-semibold">
                              <input
                                type="checkbox"
                                checked={repeat.enabled}
                                onChange={event =>
                                  updateRepeat(key, { enabled: event.target.checked })
                                }
                              />
                              Solicitar repetição
                            </label>
                            {repeat.enabled && (
                              <Textarea
                                className="min-h-16"
                                placeholder="Justificativa obrigatória (mínimo de 10 caracteres)"
                                value={repeat.justification}
                                onChange={event =>
                                  updateRepeat(key, {
                                    justification: event.target.value,
                                  })
                                }
                              />
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Não se aplica</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {analysisDirty && preview.data && (
          <p className="border-l-4 border-amber-400 bg-amber-50 p-3 text-xs text-amber-900">
            A seleção foi alterada. Clique em “Analisar exercício” novamente antes
            de gerar as requisições.
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="max-h-72 overflow-auto border">
            {selectedRows.map((row: any) => (
              <div
                key={`${row.collaborator_id}:${row.monitoring_id}`}
                className="border-b p-3 text-sm"
              >
                <b>{row.collaborator_name}</b>
                <br />
                <span className="text-xs text-slate-500">
                  {row.procedure_kind === "consulta_clinica"
                    ? "Consulta clínica"
                    : row.exam_name}{" "}
                  · {row.gse_code}
                </span>
              </div>
            ))}
          </div>
          <div className="grid content-start gap-3">
            <label className="text-xs font-semibold">
              Prestador apto
              <select
                className="mt-1 h-10 w-full border bg-white px-3 text-sm"
                value={providerId}
                onChange={event => setProviderId(Number(event.target.value))}
              >
                <option value={0}>A definir</option>
                {eligibleProviders.map((row: any) => (
                  <option key={row.id} value={row.id}>
                    {row.trade_name || row.legal_name}
                  </option>
                ))}
              </select>
            </label>
            {!eligibleProviders.length && (
              <p className="text-xs text-amber-700">
                Nenhum prestador ativo está vinculado a todos os procedimentos
                selecionados. Cadastre os vínculos ou gere com prestador a
                definir.
              </p>
            )}
            <label className="text-xs font-semibold">
              Modalidade
              <select
                className="mt-1 h-10 w-full border bg-white px-3 text-sm"
                value={mode}
                onChange={event => setMode(event.target.value)}
              >
                <option value="prestador">Endereço do prestador</option>
                <option value="in_loco">In loco</option>
                <option value="outro">Outro endereço</option>
              </select>
            </label>
            <label className="text-xs font-semibold">
              Local
              <Input
                className="mt-1"
                value={location}
                onChange={event => setLocation(event.target.value)}
              />
            </label>
            <label className="text-xs font-semibold">
              Validade da requisição
              <Input
                className="mt-1"
                type="date"
                value={valid}
                onChange={event => setValid(event.target.value)}
              />
            </label>
            <label className="text-xs font-semibold">
              Orientações
              <Textarea
                className="mt-1"
                value={orientations}
                onChange={event => setOrientations(event.target.value)}
              />
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={close}>
            Cancelar
          </Button>
          <Button
            disabled={
              busy ||
              analysisDirty ||
              !preview.data ||
              !itemsToGenerate.length ||
              !valid
            }
            onClick={() =>
              save({
                items: itemsToGenerate,
                exerciseYear,
                providerId: providerId || null,
                serviceMode: mode,
                serviceLocation: location || undefined,
                validUntil: valid,
                orientations: orientations || undefined,
              })
            }
          >
            {busy
              ? "Gerando..."
              : `Gerar ${itemsToGenerate.length} requisição(ões)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OrderDialog({
  open,
  close,
  workers,
  exams,
  providers,
  busy,
  save,
}: any) {
  const [selected, setSelected] = useState<number[]>([]);
  const [examId, setExamId] = useState(0);
  const [providerId, setProviderId] = useState(0);
  const [mode, setMode] = useState("prestador");
  const [location, setLocation] = useState("");
  const [valid, setValid] = useState("");
  const [orientations, setOrientations] = useState("");
  const [exerciseYear, setExerciseYear] = useState(new Date().getFullYear());
  const [requestType, setRequestType] = useState("normal");
  const [justification, setJustification] = useState("");
  const eligibleProviders = providers.filter(
    (row: any) =>
      Number(row.is_active) && (!examId || row.examIds?.includes(examId))
  );
  return (
    <Dialog open={open} onOpenChange={value => !value && close()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Gerar requisições em lote</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <WorkerMultiSelect
            workers={workers}
            selected={selected}
            setSelected={setSelected}
          />
          <div className="grid content-start gap-3">
            <label className="text-xs font-semibold">
              Exercício
              <Input
                className="mt-1"
                type="number"
                min={2000}
                max={2100}
                value={exerciseYear}
                onChange={event => setExerciseYear(Number(event.target.value))}
              />
            </label>
            <label className="text-xs font-semibold">
              Tipo da solicitação
              <select
                className="mt-1 h-10 w-full border bg-white px-3 text-sm"
                value={requestType}
                onChange={event => setRequestType(event.target.value)}
              >
                <option value="normal">Requisição normal</option>
                <option value="repeticao">Repetição de exame</option>
              </select>
            </label>
            {requestType === "repeticao" && (
              <label className="text-xs font-semibold">
                Justificativa da repetição
                <Textarea
                  className="mt-1"
                  value={justification}
                  onChange={event => setJustification(event.target.value)}
                  placeholder="Obrigatória, com pelo menos 10 caracteres"
                />
              </label>
            )}
            <label className="text-xs font-semibold">
              Procedimento do catálogo mestre
              <select
                className="mt-1 h-10 w-full border bg-white px-3 text-sm"
                value={examId}
                onChange={event => {
                  setExamId(Number(event.target.value));
                  setProviderId(0);
                }}
              >
                <option value={0}>Selecione</option>
                {exams
                  .filter((row: any) => Number(row.is_active))
                  .map((row: any) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-xs font-semibold">
              Prestador apto
              <select
                className="mt-1 h-10 w-full border bg-white px-3 text-sm"
                value={providerId}
                onChange={event => setProviderId(Number(event.target.value))}
              >
                <option value={0}>A definir</option>
                {eligibleProviders.map((row: any) => (
                  <option key={row.id} value={row.id}>
                    {row.trade_name || row.legal_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold">
              Modalidade
              <select
                className="mt-1 h-10 w-full border bg-white px-3 text-sm"
                value={mode}
                onChange={event => setMode(event.target.value)}
              >
                <option value="prestador">Endereço do prestador</option>
                <option value="in_loco">In loco</option>
                <option value="outro">Outro endereço</option>
              </select>
            </label>
            <label className="text-xs font-semibold">
              Local
              <Input
                className="mt-1"
                value={location}
                onChange={event => setLocation(event.target.value)}
              />
            </label>
            <label className="text-xs font-semibold">
              Validade
              <Input
                className="mt-1"
                type="date"
                value={valid}
                onChange={event => setValid(event.target.value)}
              />
            </label>
            <label className="text-xs font-semibold">
              Orientações
              <Textarea
                className="mt-1"
                value={orientations}
                onChange={event => setOrientations(event.target.value)}
              />
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={close}>
            Cancelar
          </Button>
          <Button
            disabled={
              busy ||
              !selected.length ||
              !examId ||
              !valid ||
              exerciseYear < 2000 ||
              exerciseYear > 2100 ||
              (requestType === "repeticao" && justification.trim().length < 10)
            }
            onClick={() =>
              save({
                collaboratorIds: selected,
                examId,
                exerciseYear,
                requestType,
                justification:
                  requestType === "repeticao" ? justification : undefined,
                providerId: providerId || null,
                serviceMode: mode,
                serviceLocation: location || undefined,
                validUntil: valid,
                orientations: orientations || undefined,
              })
            }
          >
            {busy ? "Gerando..." : `Gerar ${selected.length} requisição(ões)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReissueDialog({ row, close, providers, busy, save }: any) {
  const [valid, setValid] = useState("");
  const [providerId, setProviderId] = useState(0);
  const [mode, setMode] = useState("prestador");
  const [location, setLocation] = useState("");
  const [reason, setReason] = useState("vencida");
  const [justification, setJustification] = useState("");
  return (
    <Dialog open={Boolean(row)} onOpenChange={value => !value && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Emitir nova via da requisição</DialogTitle>
        </DialogHeader>
        <div className="border-l-4 border-teal-500 bg-teal-50 p-3 text-sm">
          A requisição {row?.order_number} será preservada. A nova emissão
          receberá outro número, validade, prestador e histórico.
        </div>
        <div className="grid gap-3">
          <label className="text-xs font-semibold">
            Nova validade
            <Input
              className="mt-1"
              type="date"
              value={valid}
              onChange={event => setValid(event.target.value)}
            />
          </label>
          <label className="text-xs font-semibold">
            Novo prestador
            <select
              className="mt-1 h-10 w-full border bg-white px-3 text-sm"
              value={providerId}
              onChange={event => setProviderId(Number(event.target.value))}
            >
              <option value={0}>A definir</option>
              {providers.map((item: any) => (
                <option key={item.id} value={item.id}>
                  {item.trade_name || item.legal_name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold">
            Modalidade
            <select
              className="mt-1 h-10 w-full border bg-white px-3 text-sm"
              value={mode}
              onChange={event => setMode(event.target.value)}
            >
              <option value="prestador">Prestador</option>
              <option value="in_loco">In loco</option>
              <option value="outro">Outro</option>
            </select>
          </label>
          <label className="text-xs font-semibold">
            Novo local
            <Input
              className="mt-1"
              value={location}
              onChange={event => setLocation(event.target.value)}
            />
          </label>
          <label className="text-xs font-semibold">
            Motivo
            <select
              className="mt-1 h-10 w-full border bg-white px-3 text-sm"
              value={reason}
              onChange={event => setReason(event.target.value)}
            >
              <option value="nao_realizou">Funcionário não realizou</option>
              <option value="perda">Perda da requisição</option>
              <option value="vencida">Requisição vencida</option>
              <option value="alteracao_prestador">
                Alteração do prestador
              </option>
              <option value="alteracao_local">Alteração do local</option>
              <option value="alteracao_programacao">
                Alteração da programação
              </option>
              <option value="solicitacao_sesmt">Solicitação do SESMT</option>
              <option value="outro">Outro</option>
            </select>
          </label>
          <label className="text-xs font-semibold">
            Justificativa
            <Textarea
              className="mt-1"
              value={justification}
              onChange={event => setJustification(event.target.value)}
            />
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={close}>
            Cancelar
          </Button>
          <Button
            disabled={
              !row ||
              !valid ||
              busy ||
              (reason === "outro" && !justification.trim())
            }
            onClick={() =>
              save({
                id: Number(row.id),
                validUntil: valid,
                providerId: providerId || null,
                serviceMode: mode,
                serviceLocation: location || undefined,
                reason,
                justification: justification || undefined,
              })
            }
          >
            {busy ? "Emitindo..." : "Emitir nova via"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResultDialog({
  open,
  close,
  workers,
  exams,
  orders,
  busy,
  save,
}: any) {
  const [workerId, setWorkerId] = useState(0);
  const [examId, setExamId] = useState(0);
  const [orderId, setOrderId] = useState(0);
  const [performedAt, setPerformedAt] = useState("");
  const [lab, setLab] = useState("");
  const [type, setType] = useState("qualitativo");
  const [summary, setSummary] = useState("");
  const [reference, setReference] = useState("");
  const [source, setSource] = useState("manual");
  const [identity, setIdentity] = useState("confirmado");
  const [file, setFile] = useState<{ data: string; name: string } | null>(null);
  const readFile = (selected?: File) => {
    if (!selected) return;
    const reader = new FileReader();
    reader.onload = () =>
      setFile({ data: String(reader.result), name: selected.name });
    reader.readAsDataURL(selected);
  };
  return (
    <Dialog open={open} onOpenChange={value => !value && close()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Lançar resultado de exame</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold">
            Trabalhador
            <select
              className="mt-1 h-10 w-full border bg-white px-3 text-sm"
              value={workerId}
              onChange={event => setWorkerId(Number(event.target.value))}
            >
              <option value={0}>Selecione</option>
              {workers.map((row: any) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold">
            Exame
            <select
              className="mt-1 h-10 w-full border bg-white px-3 text-sm"
              value={examId}
              onChange={event => setExamId(Number(event.target.value))}
            >
              <option value={0}>Selecione</option>
              {exams.map((row: any) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold">
            Requisição vinculada
            <select
              className="mt-1 h-10 w-full border bg-white px-3 text-sm"
              value={orderId}
              onChange={event => setOrderId(Number(event.target.value))}
            >
              <option value={0}>Sem requisição</option>
              {orders
                .filter(
                  (row: any) =>
                    !workerId || Number(row.collaborator_id) === workerId
                )
                .map((row: any) => (
                  <option key={row.id} value={row.id}>
                    {row.order_number} - {row.exam_name}
                  </option>
                ))}
            </select>
          </label>
          <label className="text-xs font-semibold">
            Data do exame
            <Input
              className="mt-1"
              type="datetime-local"
              value={performedAt}
              onChange={event => setPerformedAt(event.target.value)}
            />
          </label>
          <label className="text-xs font-semibold">
            Laboratório / prestador
            <Input
              className="mt-1"
              value={lab}
              onChange={event => setLab(event.target.value)}
            />
          </label>
          <label className="text-xs font-semibold">
            Tipo de resultado
            <select
              className="mt-1 h-10 w-full border bg-white px-3 text-sm"
              value={type}
              onChange={event => setType(event.target.value)}
            >
              <option value="qualitativo">Qualitativo</option>
              <option value="quantitativo">Quantitativo</option>
              <option value="misto">Misto</option>
            </select>
          </label>
          <label className="md:col-span-2 text-xs font-semibold">
            Resumo transcrito do laudo
            <Textarea
              className="mt-1"
              value={summary}
              onChange={event => setSummary(event.target.value)}
            />
          </label>
          <label className="md:col-span-2 text-xs font-semibold">
            Referência informada no próprio laudo
            <Textarea
              className="mt-1"
              value={reference}
              onChange={event => setReference(event.target.value)}
            />
          </label>
          <label className="text-xs font-semibold">
            Origem
            <select
              className="mt-1 h-10 w-full border bg-white px-3 text-sm"
              value={source}
              onChange={event => setSource(event.target.value)}
            >
              <option value="manual">Manual</option>
              <option value="ocr">OCR assistido</option>
              <option value="integracao">Integração</option>
            </select>
          </label>
          <label className="text-xs font-semibold">
            Validação de identidade
            <select
              className="mt-1 h-10 w-full border bg-white px-3 text-sm"
              value={identity}
              onChange={event => setIdentity(event.target.value)}
            >
              <option value="confirmado">Confirmado</option>
              <option value="divergencia">Divergência</option>
              <option value="ambiguo">Ambíguo</option>
              <option value="nao_identificado">Não identificado</option>
            </select>
          </label>
          <label className="md:col-span-2 text-xs font-semibold">
            Documento original
            <Input
              className="mt-1"
              type="file"
              accept="application/pdf,image/*"
              onChange={event => readFile(event.target.files?.[0])}
            />
          </label>
        </div>
        <div className="border-l-4 border-amber-400 bg-amber-50 p-3 text-xs text-amber-950">
          OCR é assistivo. Em ambiguidade, a plataforma não associa
          automaticamente o documento. Todo resultado entra como pendente de
          revisão médica.
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={close}>
            Cancelar
          </Button>
          <Button
            disabled={busy || !workerId || !examId || !performedAt}
            onClick={() =>
              save({
                orderId: orderId || null,
                collaboratorId: workerId,
                examId,
                performedAt: new Date(performedAt).toISOString(),
                laboratoryName: lab || undefined,
                resultType: type,
                resultSummary: summary || undefined,
                parameters: [],
                referenceText: reference || undefined,
                source,
                identityStatus: identity,
                fileBase64: file?.data,
                fileName: file?.name,
              })
            }
          >
            {busy ? "Salvando..." : "Enviar para revisão"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OcrBatchDialog({
  open,
  close,
  workers,
  exams,
  providers,
  analyzing,
  saving,
  analyze,
  save,
}: any) {
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [mapping, setMapping] = useState<
    Record<
      number,
      {
        workerId: number;
        examId: number;
        providerId: number;
        performedDate: string;
        include: boolean;
      }
    >
  >({});
  const [converting, setConverting] = useState("");
  useEffect(() => {
    const next: Record<
      number,
      {
        workerId: number;
        examId: number;
        providerId: number;
        performedDate: string;
        include: boolean;
      }
    > = {};
    rows.forEach((row, index) => {
      next[index] = {
        workerId:
          row.identityStatus === "confirmado"
            ? Number(row.workerCandidates?.[0]?.id || 0)
            : 0,
        examId: Number(row.examCandidates?.[0]?.id || 0),
        providerId: 0,
        performedDate: row.fields?.performedDate || "",
        include: true,
      };
    });
    setMapping(next);
  }, [rows]);
  const fileToData = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  const pdfToImages = async (file: File) => {
    const pdfjsLib: any = await import("pdfjs-dist");
    const workerUrlBase = (
      await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
    ).default;
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrlBase + "?ct=1";
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() })
      .promise;
    const images: Array<{
      fileName: string;
      mimeType: "image/jpeg";
      fileBase64: string;
    }> = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      setConverting(`${file.name}: página ${pageNumber}/${pdf.numPages}`);
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext("2d");
      if (!context) continue;
      await page.render({ canvasContext: context, viewport }).promise;
      images.push({
        fileName: `${file.name} - página ${pageNumber}`,
        mimeType: "image/jpeg",
        fileBase64: canvas.toDataURL("image/jpeg", 0.92),
      });
    }
    return images;
  };
  const run = async () => {
    const documents: any[] = [];
    try {
      for (const file of files) {
        if (file.type === "application/pdf")
          documents.push(...(await pdfToImages(file)));
        else if (["image/png", "image/jpeg"].includes(file.type))
          documents.push({
            fileName: file.name,
            mimeType: file.type,
            fileBase64: await fileToData(file),
          });
      }
      if (!documents.length) return toast.error("Selecione PDF, JPG ou PNG.");
      if (documents.length > 20)
        return toast.error(
          "O lote pode conter até 20 páginas por processamento."
        );
      setRows(await analyze(documents));
    } finally {
      setConverting("");
    }
  };
  const confirm = async () => {
    const payload = rows
      .map((row, index) => ({ row, map: mapping[index] }))
      .filter(
        item =>
          item.map?.include &&
          item.map.workerId &&
          item.map.examId &&
          item.map.performedDate
      )
      .map(({ row, map }) => ({
        collaboratorId: map.workerId,
        examId: map.examId,
        performedAt: `${map.performedDate}T12:00:00.000Z`,
        laboratoryName:
          providers.find(
            (provider: any) => Number(provider.id) === map.providerId
          )?.trade_name ||
          providers.find(
            (provider: any) => Number(provider.id) === map.providerId
          )?.legal_name ||
          row.fields?.laboratoryName ||
          undefined,
        resultType: ["qualitativo", "quantitativo", "misto"].includes(
          row.fields?.resultType
        )
          ? row.fields.resultType
          : "misto",
        resultSummary: row.fields?.resultSummary || undefined,
        parameters: Array.isArray(row.fields?.parameters)
          ? row.fields.parameters
          : [],
        referenceText: row.fields?.referenceText || undefined,
        source: "ocr",
        identityStatus: row.identityStatus,
        fileBase64: row.fileBase64,
        fileName: row.fileName,
      }));
    if (!payload.length)
      return toast.error(
        "Confirme o trabalhador e o exame de pelo menos um documento."
      );
    await save(payload);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={value => {
        if (!value) {
          setFiles([]);
          setRows([]);
          close();
        }
      }}
    >
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importação OCR de resultados</DialogTitle>
        </DialogHeader>
        <div className="border-l-4 border-amber-400 bg-amber-50 p-3 text-sm">
          A leitura é assistiva. O arquivo original é preservado e nenhum
          vínculo é criado sem confirmação. Revise trabalhador, exame, data e
          prestador, principalmente quando a confiança estiver baixa.
        </div>
        {!rows.length ? (
          <div className="space-y-4">
            <Input
              type="file"
              multiple
              accept="application/pdf,image/png,image/jpeg"
              onChange={event => setFiles(Array.from(event.target.files || []))}
            />
            <p className="text-sm text-slate-500">
              {files.length} arquivo(s) selecionado(s). PDFs são convertidos em
              imagens de alta resolução no navegador.
            </p>
            <Button
              disabled={analyzing || Boolean(converting) || !files.length}
              onClick={run}
            >
              {analyzing || converting
                ? `Analisando ${converting}`
                : "Ler documentos com IA/OCR"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row, index) => {
              const workerOptions = [
                ...new Map(
                  [...(row.workerCandidates || []), ...workers].map(
                    (item: any) => [Number(item.id), item]
                  )
                ).values(),
              ];
              const examOptions = [
                ...new Map(
                  [
                    ...(row.examCandidates || []),
                    ...exams.filter((item: any) => Number(item.is_active)),
                  ].map((item: any) => [Number(item.id), item])
                ).values(),
              ];
              const confidence = row.confidence || {};
              return (
                <div
                  key={`${row.fileName}:${index}`}
                  className="grid gap-3 border p-3 lg:grid-cols-[32px_1.1fr_1fr_1fr]"
                >
                  <input
                    type="checkbox"
                    checked={mapping[index]?.include ?? true}
                    onChange={event =>
                      setMapping(current => ({
                        ...current,
                        [index]: {
                          ...current[index],
                          include: event.target.checked,
                        },
                      }))
                    }
                  />
                  <div>
                    <b>{row.fileName}</b>
                    <p className="mt-1 text-xs text-slate-500">
                      Nome lido:{" "}
                      {row.fields?.employeeName || "não identificado"} (
                      {Math.round(Number(confidence.employeeName || 0) * 100)}%)
                      <br />
                      Exame lido: {row.fields?.examName || "não identificado"} (
                      {Math.round(Number(confidence.examName || 0) * 100)}%)
                      <br />
                      Data lida:{" "}
                      {row.fields?.performedDate || "não identificada"} (
                      {Math.round(Number(confidence.performedDate || 0) * 100)}
                      %)
                    </p>
                    {row.warnings?.map((warning: string) => (
                      <p key={warning} className="mt-1 text-xs text-amber-700">
                        {warning}
                      </p>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">
                      Trabalhador
                      <select
                        className="mt-1 h-10 w-full border bg-white px-2 text-sm"
                        value={mapping[index]?.workerId || 0}
                        onChange={event =>
                          setMapping(current => ({
                            ...current,
                            [index]: {
                              ...current[index],
                              workerId: Number(event.target.value),
                              include: current[index]?.include ?? true,
                            },
                          }))
                        }
                      >
                        <option value={0}>Confirmar manualmente</option>
                        {workerOptions.map((candidate: any) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.name} ·{" "}
                            {candidate.cpf ||
                              candidate.employee_registration ||
                              "sem identificador"}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold">
                      Data confirmada
                      <Input
                        className="mt-1"
                        type="date"
                        value={mapping[index]?.performedDate || ""}
                        onChange={event =>
                          setMapping(current => ({
                            ...current,
                            [index]: {
                              ...current[index],
                              performedDate: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                    <span
                      className={`block text-xs ${row.identityStatus === "confirmado" ? "text-emerald-700" : "text-amber-700"}`}
                    >
                      {row.identityStatus.replaceAll("_", " ")}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">
                      Exame
                      <select
                        className="mt-1 h-10 w-full border bg-white px-2 text-sm"
                        value={mapping[index]?.examId || 0}
                        onChange={event =>
                          setMapping(current => ({
                            ...current,
                            [index]: {
                              ...current[index],
                              examId: Number(event.target.value),
                            },
                          }))
                        }
                      >
                        <option value={0}>Confirmar exame</option>
                        {examOptions.map((candidate: any) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold">
                      Prestador
                      <select
                        className="mt-1 h-10 w-full border bg-white px-2 text-sm"
                        value={mapping[index]?.providerId || 0}
                        onChange={event =>
                          setMapping(current => ({
                            ...current,
                            [index]: {
                              ...current[index],
                              providerId: Number(event.target.value),
                            },
                          }))
                        }
                      >
                        <option value={0}>
                          {row.fields?.laboratoryName || "Confirmar prestador"}
                        </option>
                        {providers
                          .filter((item: any) => Number(item.is_active))
                          .map((provider: any) => (
                            <option key={provider.id} value={provider.id}>
                              {provider.trade_name || provider.legal_name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <span className="block text-xs text-slate-500">
                      Referência do laudo preservada
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={close}>
            Cancelar
          </Button>
          {rows.length > 0 && (
            <Button disabled={saving} onClick={confirm}>
              {saving
                ? "Importando..."
                : "Confirmar e encaminhar à revisão médica"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReviewDialog({ row, close, busy, save, viewDocument }: any) {
  const [classification, setClassification] = useState("normal");
  const [notes, setNotes] = useState("");
  return (
    <Dialog open={Boolean(row)} onOpenChange={value => !value && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revisão médica do resultado</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="border p-3 text-sm">
            <b>{row?.collaborator_name}</b>
            <br />
            {row?.exam_name} ·{" "}
            {row?.laboratory_name || "Prestador não informado"}
            <p className="mt-2 text-slate-600">
              {row?.result_summary || "Sem resumo"}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Referência do laudo: {row?.reference_text || "não informada"}
            </p>
            {row?.document_private_path && (
              <Button
                className="mt-3"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={viewDocument}
              >
                <Download size={14} className="mr-2" /> Abrir documento original
              </Button>
            )}
          </div>
          <label className="text-xs font-semibold">
            Classificação
            <select
              className="mt-1 h-10 w-full border bg-white px-3 text-sm"
              value={classification}
              onChange={event => setClassification(event.target.value)}
            >
              <option value="normal">Normal conforme referência</option>
              <option value="alterado">Fora da referência informada</option>
              <option value="inconclusivo">Inconclusivo</option>
              <option value="insatisfatorio">Insatisfatório</option>
              <option value="nao_realizado">Não realizado</option>
            </select>
          </label>
          <label className="text-xs font-semibold">
            Análise / conduta médica
            <Textarea
              className="mt-1"
              value={notes}
              onChange={event => setNotes(event.target.value)}
            />
          </label>
          <div className="border-l-4 border-teal-500 bg-teal-50 p-3 text-xs">
            A classificação compara o resultado à referência do laudo. Não
            equivale a diagnóstico nem define aptidão automaticamente.
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button
              disabled={!row || busy}
              onClick={() =>
                save({
                  id: Number(row.id),
                  classification,
                  medicalNotes: notes || undefined,
                })
              }
            >
              {busy ? "Salvando..." : "Concluir revisão"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExamDialog({ open, close, row, busy, save }: any) {
  const [form, setForm] = useState<any>({
    name: "",
    examType: "complementar",
    category: "",
    description: "",
    defaultPeriodicity: "",
    resultType: "qualitativo",
    defaultUnit: "",
    referenceGuidance: "",
    isActive: true,
  });
  useEffect(() => {
    if (!open) return;
    setForm({
      id: row?.id ? Number(row.id) : undefined,
      name: row?.name || "",
      examType: row?.exam_type || "complementar",
      category: row?.category || "",
      description: row?.description || "",
      defaultPeriodicity: row?.default_periodicity || "",
      resultType: row?.result_type || "qualitativo",
      defaultUnit: row?.default_unit || "",
      referenceGuidance: row?.reference_guidance || "",
      isActive: row ? Boolean(Number(row.is_active)) : true,
    });
  }, [open, row]);
  const set = (key: string, value: any) =>
    setForm((current: any) => ({ ...current, [key]: value }));
  return (
    <Dialog open={open} onOpenChange={value => !value && close()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {row
              ? "Editar exame do Catálogo Mestre"
              : "Novo exame no Catálogo Mestre"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold">
            Nome
            <Input
              className="mt-1"
              value={form.name}
              onChange={event => set("name", event.target.value)}
            />
          </label>
          <label className="text-xs font-semibold">
            Categoria
            <Input
              className="mt-1"
              value={form.category}
              onChange={event => set("category", event.target.value)}
              placeholder="Audiometria, Laboratorial..."
            />
          </label>
          <label className="text-xs font-semibold">
            Tipo
            <select
              className="mt-1 h-10 w-full border bg-white px-3 text-sm"
              value={form.examType}
              onChange={event => set("examType", event.target.value)}
            >
              <option value="clinico">Clínico</option>
              <option value="complementar">Complementar</option>
            </select>
          </label>
          <label className="text-xs font-semibold">
            Resultado
            <select
              className="mt-1 h-10 w-full border bg-white px-3 text-sm"
              value={form.resultType}
              onChange={event => set("resultType", event.target.value)}
            >
              <option value="qualitativo">Qualitativo</option>
              <option value="quantitativo">Quantitativo</option>
              <option value="misto">Misto</option>
            </select>
          </label>
          <label className="text-xs font-semibold">
            Periodicidade padrão
            <Input
              className="mt-1"
              value={form.defaultPeriodicity}
              onChange={event => set("defaultPeriodicity", event.target.value)}
              placeholder="Ex.: periódico a cada 12 meses"
            />
          </label>
          <label className="text-xs font-semibold">
            Unidade padrão
            <Input
              className="mt-1"
              value={form.defaultUnit}
              onChange={event => set("defaultUnit", event.target.value)}
            />
          </label>
          <label className="md:col-span-2 text-xs font-semibold">
            Descrição
            <Textarea
              className="mt-1"
              value={form.description}
              onChange={event => set("description", event.target.value)}
            />
          </label>
          <label className="md:col-span-2 text-xs font-semibold">
            Orientação sobre referências
            <Textarea
              className="mt-1"
              value={form.referenceGuidance}
              onChange={event => set("referenceGuidance", event.target.value)}
              placeholder="Priorizar os valores de referência do laboratório e método informados no laudo."
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={event => set("isActive", event.target.checked)}
            />{" "}
            Exame ativo e disponível no PCMSO
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={close}>
            Cancelar
          </Button>
          <Button
            disabled={busy || !form.name.trim()}
            onClick={() =>
              save({
                ...form,
                category: form.category || undefined,
                description: form.description || undefined,
                defaultPeriodicity: form.defaultPeriodicity || undefined,
                defaultUnit: form.defaultUnit || undefined,
                referenceGuidance: form.referenceGuidance || undefined,
              })
            }
          >
            {busy ? "Salvando..." : "Salvar exame"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProviderDialog({ open, close, row, exams, busy, save }: any) {
  const [form, setForm] = useState<any>({
    legalName: "",
    tradeName: "",
    cnpj: "",
    address: "",
    municipality: "",
    uf: "",
    phone: "",
    email: "",
    contactName: "",
    inCompanyService: false,
    examIds: [],
    services: "",
    specialties: "",
    credentialStatus: "ativo",
    credentialValidUntil: "",
    notes: "",
  });
  useEffect(() => {
    if (!open) return;
    setForm(
      row
        ? {
            id: Number(row.id),
            legalName: row.legal_name || "",
            tradeName: row.trade_name || "",
            cnpj: row.cnpj || "",
            address: row.address || "",
            municipality: row.municipality || "",
            uf: row.uf || "",
            phone: row.phone || "",
            email: row.email || "",
            contactName: row.contact_name || "",
            inCompanyService: Boolean(Number(row.in_company_service)),
            examIds: row.examIds || [],
            services: (() => {
              try {
                return JSON.parse(row.services_json || "[]").join(", ");
              } catch {
                return "";
              }
            })(),
            specialties: (() => {
              try {
                return JSON.parse(row.specialties_json || "[]").join(", ");
              } catch {
                return "";
              }
            })(),
            credentialStatus: row.credential_status || "ativo",
            credentialValidUntil: String(
              row.credential_valid_until || ""
            ).slice(0, 10),
            notes: row.notes || "",
          }
        : {
            legalName: "",
            tradeName: "",
            cnpj: "",
            address: "",
            municipality: "",
            uf: "",
            phone: "",
            email: "",
            contactName: "",
            inCompanyService: false,
            examIds: [],
            services: "",
            specialties: "",
            credentialStatus: "ativo",
            credentialValidUntil: "",
            notes: "",
          }
    );
  }, [open, row]);
  const set = (key: string, value: any) =>
    setForm((current: any) => ({ ...current, [key]: value }));
  const split = (value: string) =>
    value
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);
  return (
    <Dialog open={open} onOpenChange={value => !value && close()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {row ? "Editar prestador" : "Novo prestador credenciado"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs font-semibold">
            Razão social
            <Input
              className="mt-1"
              value={form.legalName}
              onChange={event => set("legalName", event.target.value)}
            />
          </label>
          <label className="text-xs font-semibold">
            Nome fantasia
            <Input
              className="mt-1"
              value={form.tradeName}
              onChange={event => set("tradeName", event.target.value)}
            />
          </label>
          <label className="text-xs font-semibold">
            CNPJ
            <Input
              className="mt-1"
              value={form.cnpj}
              onChange={event => set("cnpj", event.target.value)}
            />
          </label>
          <label className="text-xs font-semibold">
            Contato responsável
            <Input
              className="mt-1"
              value={form.contactName}
              onChange={event => set("contactName", event.target.value)}
            />
          </label>
          <label className="text-xs font-semibold">
            Telefone
            <Input
              className="mt-1"
              value={form.phone}
              onChange={event => set("phone", event.target.value)}
            />
          </label>
          <label className="text-xs font-semibold">
            E-mail
            <Input
              className="mt-1"
              value={form.email}
              onChange={event => set("email", event.target.value)}
            />
          </label>
          <label className="lg:col-span-2 text-xs font-semibold">
            Endereço
            <Textarea
              className="mt-1"
              value={form.address}
              onChange={event => set("address", event.target.value)}
            />
          </label>
          <div className="grid grid-cols-[1fr_80px] gap-2">
            <label className="text-xs font-semibold">
              Município
              <Input
                className="mt-1"
                value={form.municipality}
                onChange={event => set("municipality", event.target.value)}
              />
            </label>
            <label className="text-xs font-semibold">
              UF
              <Input
                className="mt-1 uppercase"
                maxLength={2}
                value={form.uf}
                onChange={event => set("uf", event.target.value.toUpperCase())}
              />
            </label>
          </div>
          <label className="text-xs font-semibold">
            Situação
            <select
              className="mt-1 h-10 w-full border bg-white px-3 text-sm"
              value={form.credentialStatus}
              onChange={event => set("credentialStatus", event.target.value)}
            >
              <option value="ativo">Ativo</option>
              <option value="em_revisao">Em revisão</option>
              <option value="suspenso">Suspenso</option>
              <option value="vencido">Vencido</option>
            </select>
          </label>
          <label className="text-xs font-semibold">
            Validade do credenciamento
            <Input
              className="mt-1"
              type="date"
              value={form.credentialValidUntil}
              onChange={event =>
                set("credentialValidUntil", event.target.value)
              }
            />
          </label>
          <label className="flex items-center gap-2 pt-6 text-sm">
            <input
              type="checkbox"
              checked={form.inCompanyService}
              onChange={event => set("inCompanyService", event.target.checked)}
            />{" "}
            Realiza atendimento in loco
          </label>
          <label className="md:col-span-2 text-xs font-semibold">
            Serviços, separados por vírgula
            <Input
              className="mt-1"
              value={form.services}
              onChange={event => set("services", event.target.value)}
              placeholder="Consulta clínica, coleta, unidade móvel"
            />
          </label>
          <label className="text-xs font-semibold">
            Especialidades
            <Input
              className="mt-1"
              value={form.specialties}
              onChange={event => set("specialties", event.target.value)}
            />
          </label>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold">
            Exames realizados (catálogo mestre)
          </p>
          <div className="grid max-h-56 gap-2 overflow-auto border p-3 md:grid-cols-2 lg:grid-cols-3">
            {exams
              .filter((exam: any) => Number(exam.is_active))
              .map((exam: any) => (
                <label key={exam.id} className="flex items-start gap-2 text-sm">
                  <input
                    className="mt-1"
                    type="checkbox"
                    checked={form.examIds.includes(Number(exam.id))}
                    onChange={() =>
                      set(
                        "examIds",
                        form.examIds.includes(Number(exam.id))
                          ? form.examIds.filter(
                              (id: number) => id !== Number(exam.id)
                            )
                          : [...form.examIds, Number(exam.id)]
                      )
                    }
                  />
                  <span>
                    {exam.name}
                    <br />
                    <span className="text-xs text-slate-500">
                      {exam.exam_type}
                    </span>
                  </span>
                </label>
              ))}
          </div>
        </div>
        <label className="block text-xs font-semibold">
          Observações
          <Textarea
            className="mt-1"
            value={form.notes}
            onChange={event => set("notes", event.target.value)}
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={close}>
            Cancelar
          </Button>
          <Button
            disabled={busy || form.legalName.trim().length < 2}
            onClick={() =>
              save({
                ...form,
                tradeName: form.tradeName || undefined,
                cnpj: form.cnpj || undefined,
                address: form.address || undefined,
                municipality: form.municipality || undefined,
                uf: form.uf || undefined,
                phone: form.phone || undefined,
                email: form.email || "",
                contactName: form.contactName || undefined,
                services: split(form.services),
                specialties: split(form.specialties),
                credentialValidUntil: form.credentialValidUntil || null,
                notes: form.notes || undefined,
              })
            }
          >
            {busy ? "Salvando..." : "Salvar prestador"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ClinicalWorkspace({
  workers,
  workerId,
  setWorkerId,
  context,
  validation,
  saveAnamnesis,
  issueAso,
  downloadAso,
  busy,
  asos,
}: any) {
  const [type, setType] = useState("periodico");
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [vitals, setVitals] = useState<any>({
    weightKg: "",
    heightCm: "",
    systolicPressure: "",
    diastolicPressure: "",
    heartRate: "",
    respiratoryRate: "",
    temperatureC: "",
    oxygenSaturation: "",
  });
  const [fitness, setFitness] = useState("apto");
  const [aptitudes, setAptitudes] = useState("");
  const [justification, setJustification] = useState("");
  const questionsQ = trpc.occupationalLifecycle.listAnamnesisQuestions.useQuery(
    { anamnesisType: type as any }
  );
  const questions = (questionsQ.data || []) as any[];
  const bmi =
    Number(vitals.weightKg) && Number(vitals.heightCm)
      ? (
          Number(vitals.weightKg) / Math.pow(Number(vitals.heightCm) / 100, 2)
        ).toFixed(2)
      : "-";
  const vitalPayload = Object.fromEntries(
    Object.entries(vitals).map(([key, value]) => [
      key,
      value === "" ? null : Number(value),
    ])
  );
  const setAnswer = (code: string, value: any) =>
    setAnswers(current => ({ ...current, [code]: value }));
  const missingRequired = questions.some(
    question =>
      Number(question.is_required) &&
      !String(answers[question.question_code] ?? "").trim()
  );
  const responseField = (question: any) => {
    const code = String(question.question_code);
    if (["sim_nao", "sim_nao_detalhe"].includes(question.response_type))
      return (
        <div className="mt-2 grid gap-2 md:grid-cols-[180px_1fr]">
          <select
            className="h-10 border bg-white px-3 text-sm"
            value={answers[code] || ""}
            onChange={event => setAnswer(code, event.target.value)}
          >
            <option value="">Selecione</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
            <option value="nao_sabe">Não sabe informar</option>
          </select>
          {question.response_type === "sim_nao_detalhe" && (
            <Input
              value={answers[`${code}_detalhe`] || ""}
              onChange={event =>
                setAnswer(`${code}_detalhe`, event.target.value)
              }
              placeholder="Detalhes clínicos, quando aplicável"
            />
          )}
        </div>
      );
    if (question.response_type === "escala_1_5")
      return (
        <select
          className="mt-2 h-10 w-full border bg-white px-3 text-sm"
          value={answers[code] || ""}
          onChange={event => setAnswer(code, event.target.value)}
        >
          <option value="">Selecione</option>
          {[1, 2, 3, 4, 5].map(value => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      );
    if (question.response_type === "texto_longo")
      return (
        <Textarea
          className="mt-2"
          value={answers[code] || ""}
          onChange={event => setAnswer(code, event.target.value)}
        />
      );
    return (
      <Input
        className="mt-2"
        type={
          question.response_type === "numero"
            ? "number"
            : question.response_type === "data"
              ? "date"
              : "text"
        }
        value={answers[code] || ""}
        onChange={event => setAnswer(code, event.target.value)}
      />
    );
  };
  const save = (status: "rascunho" | "concluida") =>
    saveAnamnesis({
      collaboratorId: workerId,
      anamnesisType: type,
      answers,
      vitalSigns: vitalPayload,
      status,
    });
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
      <Panel
        title="Anamnese ocupacional estruturada"
        subtitle="Perguntas configuráveis pelo SuperAdmin, sinais vitais e contexto ocupacional preservados em versão histórica."
      >
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold">
            Trabalhador
            <select
              className="mt-1 h-10 w-full border bg-white px-3 text-sm"
              value={workerId}
              onChange={event => setWorkerId(Number(event.target.value))}
            >
              <option value={0}>Selecione</option>
              {workers.map((row: any) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold">
            Tipo
            <select
              className="mt-1 h-10 w-full border bg-white px-3 text-sm"
              value={type}
              onChange={event => {
                setType(event.target.value);
                setAnswers({});
              }}
            >
              <option value="admissional">Admissional</option>
              <option value="periodico">Periódico</option>
              <option value="retorno">Retorno ao trabalho</option>
              <option value="mudanca_risco">Mudança de riscos</option>
              <option value="demissional">Demissional</option>
              <option value="monitoracao_pontual">Monitoração pontual</option>
            </select>
          </label>
        </div>
        {context?.worker && (
          <div className="mb-4 border-l-4 border-teal-500 bg-teal-50 p-3 text-sm">
            <b>{context.worker.name}</b>
            <br />
            GSE: {context.worker.gse_code || "-"} -{" "}
            {context.worker.gse_name || "Sem GSE"}
            <br />
            PGR: {context.program?.pgr_title || "não identificado"}
            <br />
            PCMSO: {context.program?.pcmso_title || "não identificado"}
          </div>
        )}
        <div className="mb-4 border p-3">
          <p className="mb-3 text-xs font-semibold uppercase text-slate-500">
            Sinais vitais
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["weightKg", "Peso (kg)"],
              ["heightCm", "Altura (cm)"],
              ["systolicPressure", "PA sistólica"],
              ["diastolicPressure", "PA diastólica"],
              ["heartRate", "Frequência cardíaca"],
              ["respiratoryRate", "Frequência respiratória"],
              ["temperatureC", "Temperatura (°C)"],
              ["oxygenSaturation", "Saturação O₂ (%)"],
            ].map(([key, label]) => (
              <label key={key} className="text-xs font-semibold">
                {label}
                <Input
                  className="mt-1"
                  type="number"
                  step="0.1"
                  value={vitals[key]}
                  onChange={event =>
                    setVitals((current: any) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>
          <p className="mt-3 text-sm">
            <b>IMC calculado:</b> {bmi}
          </p>
        </div>
        <div className="max-h-[600px] space-y-2 overflow-auto border p-3">
          {questions.map((question, index) => (
            <div key={question.id} className="border-b pb-3 text-sm">
              <p className="text-xs font-semibold uppercase text-teal-700">
                {question.group_name}
              </p>
              <p className="mt-1 font-medium text-slate-800">
                {index + 1}. {question.question_text}
                {Number(question.is_required) ? " *" : ""}
              </p>
              {responseField(question)}
            </div>
          ))}
          {!questions.length && (
            <p className="p-6 text-center text-sm text-slate-500">
              Carregando questionário configurável...
            </p>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="outline"
            disabled={!workerId || busy}
            onClick={() => save("rascunho")}
          >
            Salvar rascunho
          </Button>
          <Button
            disabled={!workerId || busy || missingRequired}
            onClick={() => save("concluida")}
          >
            Concluir anamnese
          </Button>
        </div>
      </Panel>
      <div className="space-y-4">
        <Panel
          title="Contexto ocupacional"
          subtitle="Derivado do cadastro, GSE, PGR e PCMSO."
        >
          {!workerId ? (
            <p className="text-sm text-slate-500">Selecione o trabalhador.</p>
          ) : (
            <div className="space-y-3 text-xs">
              <div>
                <b>Riscos e controles médicos</b>
                {(context?.risks || []).map((row: any) => (
                  <div
                    key={`${row.risk_name}:${row.exam_name}`}
                    className="mt-2 border p-2"
                  >
                    <span className="font-semibold">{row.risk_name}</span>
                    <br />
                    {row.risk_classification || "sem classificação"} ·{" "}
                    {row.exam_name ||
                      row.monitoring_name ||
                      row.monitoring_kind}
                  </div>
                ))}
              </div>
              <div>
                <b>Procedimentos solicitados</b>
                <p className="mt-1 text-slate-600">
                  {(context?.orders || [])
                    .map((row: any) => `${row.exam_name} (${row.status})`)
                    .join(", ") || "Nenhum"}
                </p>
              </div>
              <div>
                <b>Resultados</b>
                <p className="mt-1 text-slate-600">
                  {(context?.results || [])
                    .map(
                      (row: any) => `${row.exam_name} (${row.classification})`
                    )
                    .join(", ") || "Nenhum"}
                </p>
              </div>
            </div>
          )}
        </Panel>
        <Panel
          title="Validação antes do ASO"
          subtitle="Pendências orientam a decisão; não substituem o julgamento médico."
        >
          {!workerId ? (
            <p className="text-sm text-slate-500">Selecione o trabalhador.</p>
          ) : (
            <div className="space-y-3">
              <div
                className={`border p-3 ${validation?.ready ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}
              >
                <p className="font-semibold">
                  {validation?.ready
                    ? "Requisitos encontrados"
                    : "Pendências identificadas"}
                </p>
                <p className="mt-1 text-xs">
                  Procedimentos ausentes:{" "}
                  {validation?.missingExams
                    ?.map((row: any) => row.name)
                    .join(", ") || "nenhum"}
                  <br />
                  Resultados sem revisão:{" "}
                  {Number(validation?.pendingMedicalReview || 0)}
                </p>
              </div>
              <label className="text-xs font-semibold">
                Conclusão
                <select
                  className="mt-1 h-10 w-full border bg-white px-3 text-sm"
                  value={fitness}
                  onChange={event => setFitness(event.target.value)}
                >
                  <option value="apto">Apto</option>
                  <option value="inapto">Inapto</option>
                </select>
              </label>
              <label className="text-xs font-semibold">
                Aptidões específicas
                <Input
                  className="mt-1"
                  value={aptitudes}
                  onChange={event => setAptitudes(event.target.value)}
                  placeholder="Altura, espaço confinado..."
                />
              </label>
              {!validation?.ready && (
                <label className="text-xs font-semibold">
                  Justificativa médica obrigatória
                  <Textarea
                    className="mt-1"
                    value={justification}
                    onChange={event => setJustification(event.target.value)}
                  />
                </label>
              )}
              <Button
                className="w-full"
                disabled={busy || (!validation?.ready && !justification.trim())}
                onClick={() =>
                  issueAso({
                    collaboratorId: workerId,
                    asoType: type,
                    fitnessStatus: fitness,
                    specificAptitudes: aptitudes
                      .split(",")
                      .map(item => item.trim())
                      .filter(Boolean),
                    pendingJustification: justification || undefined,
                  })
                }
              >
                <FileHeart size={15} className="mr-2" /> Emitir ASO histórico
              </Button>
            </div>
          )}
        </Panel>
        <Panel title="ASOs do trabalhador">
          {asos
            .filter((row: any) => Number(row.collaborator_id) === workerId)
            .slice(0, 8)
            .map((row: any) => (
              <div key={row.id} className="mb-2 border p-2 text-sm">
                <div className="flex justify-between gap-2">
                  <div>
                    <b>{row.aso_type}</b>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(row.issued_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge
                      className={`rounded-sm ${statusTone(row.fitness_status)}`}
                    >
                      {row.fitness_status}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Baixar PDF histórico"
                      onClick={() => downloadAso(Number(row.id))}
                    >
                      <Download size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
        </Panel>
      </div>
    </div>
  );
}

function CatCodePicker({
  kind,
  label,
  code,
  description,
  onSelect,
}: {
  kind:
    | "causative_agent"
    | "generating_situation"
    | "body_part"
    | "injury_nature";
  label: string;
  code: string;
  description: string;
  onSelect: (item: any) => void;
}) {
  const [query, setQuery] = useState("");
  const codesQ = trpc.occupationalLifecycle.searchCatCodes.useQuery({
    kind,
    query,
    limit: 60,
  });
  const rows = (codesQ.data?.rows || []) as any[];
  return (
    <div className="border bg-slate-50 p-3">
      <label className="text-xs font-semibold">{label}</label>
      <Input
        className="mt-1 bg-white"
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder="Pesquisar por código ou descrição"
      />
      <select
        className="mt-2 h-10 w-full border bg-white px-2 text-xs"
        value={code}
        onChange={event => {
          const item = rows.find(row => row.code === event.target.value);
          if (item) onSelect(item);
        }}
      >
        <option value="">Selecione na tabela oficial...</option>
        {code && !rows.some(row => row.code === code) ? (
          <option value={code}>
            {code} - {description}
          </option>
        ) : null}
        {rows.map(row => (
          <option key={row.code} value={row.code}>
            {row.code} - {row.description}
          </option>
        ))}
      </select>
      {code ? (
        <p className="mt-2 text-xs text-slate-600">
          <b>{code}</b> - {description}
        </p>
      ) : null}
    </div>
  );
}

function CatDialog({ open, close, workers, busy, save }: any) {
  const initial = {
    collaboratorId: 0,
    eventAt: "",
    emitterType: "empregador",
    catType: "inicial",
    initiative: "empregador",
    registrationSource: "plataforma",
    employerRegistrationType: "cnpj",
    employerRegistrationNumber: "",
    employerCnae: "",
    accidentType: "tipico",
    hoursWorkedBeforeAccident: "",
    lastWorkedDate: "",
    locationType: "1",
    location: "",
    locationNumber: "",
    locationComplement: "",
    neighborhood: "",
    postalCode: "",
    foreignPostalCode: "",
    locationDetail: "",
    locationRegistration: "",
    eventCity: "",
    eventCityCode: "",
    eventUf: "",
    eventCountry: "Brasil",
    eventCountryCode: "105",
    originReceipt: "",
    description: "",
    causativeAgentCode: "",
    causativeAgent: "",
    generatingSituationCode: "",
    generatingSituation: "",
    bodyPartCode: "",
    bodyPart: "",
    laterality: "nao_aplicavel",
    injuryNatureCode: "",
    injuryNature: "",
    leaveRequired: false,
    policeReport: false,
    deathOccurred: false,
    deathDate: "",
    medicalAttendanceAt: "",
    hospitalization: false,
    treatmentDays: "",
    diagnosis: "",
    cid: "",
    doctorName: "",
    doctorCouncil: "CRM",
    doctorUf: "",
    doctorRegistration: "",
    medicalNotes: "",
  };
  const [form, setForm] = useState<any>(initial);
  const [aiMessage, setAiMessage] = useState("");
  const [review, setReview] = useState<any>(null);
  useEffect(() => {
    if (open) {
      setForm(initial);
      setAiMessage("");
      setReview(null);
    }
  }, [open]);
  const set = (key: string, value: any) => {
    setReview(null);
    setForm((current: any) => ({ ...current, [key]: value }));
  };
  const ai = trpc.occupationalLifecycle.suggestCatCodes.useMutation({
    onSuccess: result => {
      const next: any = { ...form };
      const fields: any = {
        causative_agent: ["causativeAgentCode", "causativeAgent"],
        generating_situation: [
          "generatingSituationCode",
          "generatingSituation",
        ],
        body_part: ["bodyPartCode", "bodyPart"],
        injury_nature: ["injuryNatureCode", "injuryNature"],
      };
      (result.suggestions || []).forEach((suggestion: any) => {
        if (suggestion.selected) {
          const [codeField, descriptionField] = fields[suggestion.kind];
          next[codeField] = suggestion.selected.code;
          next[descriptionField] = suggestion.selected.description;
        }
      });
      setForm(next);
      setReview(null);
      setAiMessage(result.advisory);
      const selectedCount = (result.suggestions || []).filter(
        (suggestion: any) => suggestion.selected
      ).length;
      if (selectedCount)
        toast.success(
          `${selectedCount} sugestão(ões) segura(s) localizada(s). Revise antes de confirmar.`
        );
      else
        toast.warning(
          "A IA não encontrou correspondência segura. Pesquise os códigos manualmente."
        );
    },
    onError: () =>
      toast.error(
        "Não foi possível analisar o relato agora. Utilize a pesquisa manual das tabelas."
      ),
  });
  const buildPayload = () => ({
    ...form,
    collaboratorId: Number(form.collaboratorId),
    eventAt: form.eventAt,
    lastWorkedDate: form.lastWorkedDate || null,
    deathDate: form.deathDate || null,
    medicalAttendanceAt: form.medicalAttendanceAt || undefined,
    treatmentDays:
      form.treatmentDays === "" ? null : Number(form.treatmentDays),
    eventUf: form.eventUf || undefined,
    doctorUf: form.doctorUf || undefined,
    witnesses: [],
    confirmationAccepted: false,
  });
  const validation = trpc.occupationalLifecycle.validateCat.useMutation({
    onSuccess: result => setReview(result),
    onError: error => {
      const raw = String(error.message || "");
      toast.error(
        /failed query|insert into|select\s|parameters?:/i.test(raw)
          ? "Não foi possível conferir a CAT. Revise os dados e tente novamente."
          : raw || "Não foi possível conferir a CAT."
      );
    },
  });
  const submit = () => save({ ...buildPayload(), confirmationAccepted: true });

  if (review) {
    const status = review.status as "ready" | "review" | "blocked";
    const internalOnly = !review.esocialReady;
    const statusConfig = {
      ready: {
        title: "CAT validada - pronta para salvar",
        text: "Os campos obrigatórios e os códigos selecionados passaram pela conferência.",
        className: "border-emerald-300 bg-emerald-50 text-emerald-950",
      },
      review: {
        title: "CAT com alertas - confirme as informações",
        text: "Não há bloqueios obrigatórios, mas existem pontos que exigem decisão do responsável.",
        className: "border-amber-300 bg-amber-50 text-amber-950",
      },
      blocked: {
        title: "CAT não pode ser salva",
        text: "Corrija as inconsistências obrigatórias antes de registrar a comunicação.",
        className: "border-red-300 bg-red-50 text-red-950",
      },
    }[status];
    const summary = review.summary || {};
    const summaryItems = [
      ["Agente causador", summary.causativeAgent],
      ["Situação geradora", summary.generatingSituation],
      ["Parte do corpo", summary.bodyPart],
      ["Natureza da lesão", summary.injuryNature],
    ];
    return (
      <Dialog open={open} onOpenChange={value => !value && close()}>
        <DialogContent className="max-h-[94vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conferência inteligente da CAT</DialogTitle>
          </DialogHeader>
          <div className={`border p-4 ${statusConfig.className}`}>
            <div className="flex items-start gap-3">
              {status === "ready" ? (
                <CheckCircle2 className="mt-0.5 shrink-0" size={20} />
              ) : (
                <AlertTriangle className="mt-0.5 shrink-0" size={20} />
              )}
              <div>
                <h3 className="font-semibold">{statusConfig.title}</h3>
                <p className="mt-1 text-sm">{statusConfig.text}</p>
                <p className="mt-2 text-xs">
                  {review.errors} bloqueio(s) · {review.warnings} alerta(s) ·
                  Base: {review.source}
                </p>
              </div>
            </div>
          </div>

          {status !== "blocked" ? (
            <div
              className={`border-l-4 p-3 text-sm ${
                internalOnly
                  ? "border-amber-500 bg-amber-50 text-amber-950"
                  : "border-emerald-500 bg-emerald-50 text-emerald-950"
              }`}
            >
              <b>
                {internalOnly
                  ? "Modo: documento interno, sem transmissão ao eSocial"
                  : "Modo: dados do vínculo aptos para preparação do S-2210"}
              </b>
              <p className="mt-1 text-xs">
                {internalOnly
                  ? "A ausência da matrícula não impede o registro interno. O envio ao eSocial continuará bloqueado até o cadastro da matrícula real ou, futuramente, da categoria aplicável ao TSVE sem matrícula."
                  : "A matrícula informada ainda deverá corresponder ao vínculo existente no eSocial quando a integração oficial for ativada."}
              </p>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            {summaryItems.map(([label, item]: any) => (
              <div key={label} className="border p-3">
                <div className="text-xs font-semibold text-slate-500">
                  {label}
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-950">
                  {item?.code || "Código não selecionado"}
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  {item?.description || "Sem descrição"}
                  {item?.laterality ? ` · ${item.laterality}` : ""}
                </div>
              </div>
            ))}
          </div>

          <div className="border">
            <div className="border-b bg-slate-50 px-4 py-3">
              <h3 className="text-sm font-semibold">Resultado da validação</h3>
            </div>
            {review.issues?.length ? (
              <div className="divide-y">
                {review.issues.map((issue: any, index: number) => (
                  <div key={`${issue.code}-${index}`} className="p-3">
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                          issue.severity === "error"
                            ? "bg-red-500"
                            : "bg-amber-500"
                        }`}
                      />
                      <div>
                        <p className="text-sm font-medium">{issue.message}</p>
                        {issue.suggestion ? (
                          <p className="mt-1 text-xs text-slate-600">
                            {issue.suggestion}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-4 text-sm text-emerald-800">
                Nenhuma inconsistência identificada na conferência atual.
              </p>
            )}
          </div>

          <div className="border-l-4 border-sky-400 bg-sky-50 p-3 text-xs text-sky-950">
            As sugestões da IA são auxiliares. A confirmação final permanece sob
            responsabilidade do profissional que registra a CAT. Este registro não
            será transmitido automaticamente ao eSocial.
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setReview(null)}>
              Voltar e corrigir
            </Button>
            <Button disabled={!review.canSave || busy} onClick={submit}>
              {busy
                ? "Salvando..."
                : internalOnly
                  ? "Confirmar e registrar documento interno"
                  : "Confirmar e registrar CAT"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Dialog open={open} onOpenChange={value => !value && close()}>
      <DialogContent className="max-h-[94vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Comunicação de Acidente de Trabalho - CAT</DialogTitle>
        </DialogHeader>
        <div className="border-l-4 border-amber-400 bg-amber-50 p-3 text-sm">
          O cadastro prepara o evento S-2210 no leiaute eSocial S-1.3/NT
          06/2026. Os códigos são validados nas tabelas oficiais internas. A
          transmissão permanece pendente até a futura integração oficial.
        </div>
        <fieldset className="grid gap-3 border p-3 md:grid-cols-2 lg:grid-cols-4">
          <legend className="px-2 text-sm font-semibold">
            Identificação e comunicação
          </legend>
          <label className="text-xs font-semibold lg:col-span-2">
            Trabalhador
            <select
              className="mt-1 h-10 w-full border bg-white px-3 text-sm"
              value={form.collaboratorId}
              onChange={event =>
                set("collaboratorId", Number(event.target.value))
              }
            >
              <option value={0}>Selecione</option>
              {workers.map((row: any) => (
                <option key={row.id} value={row.id}>
                  {row.name} ·{" "}
                  {row.cpf || row.employee_registration || "sem identificador"}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold">
            Data e hora
            <Input
              className="mt-1"
              type="datetime-local"
              value={form.eventAt}
              onChange={event => set("eventAt", event.target.value)}
            />
          </label>
          <label className="text-xs font-semibold">
            Tipo de CAT
            <select
              className="mt-1 h-10 w-full border bg-white px-3 text-sm"
              value={form.catType}
              onChange={event => set("catType", event.target.value)}
            >
              <option value="inicial">Inicial</option>
              <option value="reabertura">Reabertura</option>
              <option value="comunicacao_obito">Comunicação de óbito</option>
            </select>
          </label>
          {form.catType !== "inicial" ? (
            <label className="text-xs font-semibold lg:col-span-2">
              Recibo da CAT de origem
              <Input
                className="mt-1"
                value={form.originReceipt}
                onChange={event => set("originReceipt", event.target.value)}
                placeholder="Obrigatório para reabertura ou comunicação de óbito"
              />
            </label>
          ) : null}
          <label className="text-xs font-semibold">
            Emitente
            <select
              className="mt-1 h-10 w-full border bg-white px-3 text-sm"
              value={form.emitterType}
              onChange={event => set("emitterType", event.target.value)}
            >
              <option value="empregador">Empregador</option>
              <option value="sindicato">Sindicato</option>
              <option value="medico">Médico</option>
              <option value="dependente">Dependente</option>
              <option value="autoridade_publica">Autoridade pública</option>
            </select>
          </label>
          <label className="text-xs font-semibold">
            Iniciativa
            <select
              className="mt-1 h-10 w-full border bg-white px-3 text-sm"
              value={form.initiative}
              onChange={event => set("initiative", event.target.value)}
            >
              <option value="empregador">Empregador</option>
              <option value="ordem_judicial">Ordem judicial</option>
              <option value="determinacao_fiscal">Determinação fiscal</option>
              <option value="outros">Outros</option>
            </select>
          </label>
          <label className="text-xs font-semibold">
            CNAE
            <Input
              className="mt-1"
              value={form.employerCnae}
              onChange={event => set("employerCnae", event.target.value)}
            />
          </label>
          <label className="text-xs font-semibold">
            CNPJ/inscrição do empregador
            <Input
              className="mt-1"
              value={form.employerRegistrationNumber}
              onChange={event =>
                set("employerRegistrationNumber", event.target.value)
              }
              placeholder="Se vazio, utiliza o cadastro da empresa"
            />
          </label>
          <label className="text-xs font-semibold">
            Tipo de acidente
            <select
              className="mt-1 h-10 w-full border bg-white px-3 text-sm"
              value={form.accidentType}
              onChange={event => set("accidentType", event.target.value)}
            >
              <option value="tipico">Típico</option>
              <option value="trajeto">Trajeto</option>
              <option value="doenca_ocupacional">Doença ocupacional</option>
            </select>
          </label>
        </fieldset>
        <fieldset className="space-y-3 border p-3">
          <legend className="px-2 text-sm font-semibold">
            Ocorrência e classificação
          </legend>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-semibold">
              Horas trabalhadas
              <Input
                className="mt-1"
                value={form.hoursWorkedBeforeAccident}
                onChange={event =>
                  set("hoursWorkedBeforeAccident", event.target.value)
                }
              />
            </label>
            <label className="text-xs font-semibold">
              Último dia trabalhado
              <Input
                className="mt-1"
                type="date"
                value={form.lastWorkedDate}
                onChange={event => set("lastWorkedDate", event.target.value)}
              />
            </label>
            <label className="text-xs font-semibold">
              Tipo de local
              <select
                className="mt-1 h-10 w-full border bg-white px-3 text-sm"
                value={form.locationType}
                onChange={event => set("locationType", event.target.value)}
              >
                <option value="1">
                  Estabelecimento do empregador no Brasil
                </option>
                <option value="2">
                  Estabelecimento do empregador no exterior
                </option>
                <option value="3">Estabelecimento de terceiros</option>
                <option value="4">Via pública</option>
                <option value="5">Área rural</option>
                <option value="6">Embarcação</option>
                <option value="9">Outros</option>
              </select>
            </label>
            <label className="text-xs font-semibold">
              Logradouro/local
              <Input
                className="mt-1"
                value={form.location}
                onChange={event => set("location", event.target.value)}
              />
            </label>
            <label className="text-xs font-semibold">
              Número
              <Input
                className="mt-1"
                value={form.locationNumber}
                onChange={event => set("locationNumber", event.target.value)}
                placeholder="S/N quando não houver"
              />
            </label>
            <label className="text-xs font-semibold">
              Complemento
              <Input
                className="mt-1"
                value={form.locationComplement}
                onChange={event =>
                  set("locationComplement", event.target.value)
                }
              />
            </label>
            <label className="text-xs font-semibold">
              Bairro
              <Input
                className="mt-1"
                value={form.neighborhood}
                onChange={event => set("neighborhood", event.target.value)}
              />
            </label>
            <label className="text-xs font-semibold">
              CEP
              <Input
                className="mt-1"
                value={form.postalCode}
                onChange={event => set("postalCode", event.target.value)}
                placeholder="Somente números"
              />
            </label>
            <label className="text-xs font-semibold md:col-span-2">
              Detalhamento do local
              <Input
                className="mt-1"
                value={form.locationDetail}
                onChange={event => set("locationDetail", event.target.value)}
              />
            </label>
            <label className="text-xs font-semibold">
              Município
              <Input
                className="mt-1"
                value={form.eventCity}
                onChange={event => set("eventCity", event.target.value)}
              />
            </label>
            <label className="text-xs font-semibold">
              Código IBGE do município
              <Input
                className="mt-1"
                maxLength={7}
                value={form.eventCityCode}
                onChange={event => set("eventCityCode", event.target.value)}
                placeholder="7 dígitos"
              />
            </label>
            <label className="text-xs font-semibold">
              UF
              <Input
                className="mt-1 uppercase"
                maxLength={2}
                value={form.eventUf}
                onChange={event =>
                  set("eventUf", event.target.value.toUpperCase())
                }
              />
            </label>
            {form.locationType === "3" ? (
              <label className="text-xs font-semibold">
                Inscrição do estabelecimento terceiro
                <Input
                  className="mt-1"
                  value={form.locationRegistration}
                  onChange={event =>
                    set("locationRegistration", event.target.value)
                  }
                />
              </label>
            ) : null}
            {form.locationType === "2" ? (
              <>
                <label className="text-xs font-semibold">
                  Código do país
                  <Input
                    className="mt-1"
                    maxLength={3}
                    value={form.eventCountryCode}
                    onChange={event =>
                      set("eventCountryCode", event.target.value)
                    }
                  />
                </label>
                <label className="text-xs font-semibold">
                  Código postal no exterior
                  <Input
                    className="mt-1"
                    value={form.foreignPostalCode}
                    onChange={event =>
                      set("foreignPostalCode", event.target.value)
                    }
                  />
                </label>
              </>
            ) : null}
          </div>
          <label className="block text-xs font-semibold">
            Descreva o acidente ocorrido
            <Textarea
              className="mt-1 min-h-24"
              value={form.description}
              onChange={event => set("description", event.target.value)}
              placeholder="Relate a atividade, o evento, o agente envolvido, a parte do corpo e a lesão observada."
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={ai.isPending || form.description.trim().length < 10}
              onClick={() => ai.mutate({ description: form.description })}
            >
              <Sparkles size={14} className="mr-2" />
              {ai.isPending
                ? "Analisando tabelas..."
                : "Sugerir códigos com IA"}
            </Button>
            <span className="text-xs text-slate-500">
              A IA só pode escolher códigos existentes nas tabelas oficiais.
            </span>
          </div>
          {aiMessage ? (
            <div className="border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
              {aiMessage}
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <CatCodePicker
              kind="causative_agent"
              label="Agente causador - Tabela 14"
              code={form.causativeAgentCode}
              description={form.causativeAgent}
              onSelect={item =>
                setForm((current: any) => ({
                  ...current,
                  causativeAgentCode: item.code,
                  causativeAgent: item.description,
                }))
              }
            />
            <CatCodePicker
              kind="generating_situation"
              label="Situação geradora - Tabela 15"
              code={form.generatingSituationCode}
              description={form.generatingSituation}
              onSelect={item =>
                setForm((current: any) => ({
                  ...current,
                  generatingSituationCode: item.code,
                  generatingSituation: item.description,
                }))
              }
            />
            <CatCodePicker
              kind="body_part"
              label="Parte do corpo - Tabela 13"
              code={form.bodyPartCode}
              description={form.bodyPart}
              onSelect={item =>
                setForm((current: any) => ({
                  ...current,
                  bodyPartCode: item.code,
                  bodyPart: item.description,
                }))
              }
            />
            <CatCodePicker
              kind="injury_nature"
              label="Natureza da lesão - Tabela 17"
              code={form.injuryNatureCode}
              description={form.injuryNature}
              onSelect={item =>
                setForm((current: any) => ({
                  ...current,
                  injuryNatureCode: item.code,
                  injuryNature: item.description,
                }))
              }
            />
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="text-xs font-semibold">
              Lateralidade
              <select
                className="mt-1 h-10 w-full border bg-white px-3 text-sm"
                value={form.laterality}
                onChange={event => set("laterality", event.target.value)}
              >
                <option value="nao_aplicavel">Não aplicável</option>
                <option value="esquerda">Esquerda</option>
                <option value="direita">Direita</option>
                <option value="ambos">Ambos</option>
              </select>
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input
                type="checkbox"
                checked={form.leaveRequired}
                onChange={event => set("leaveRequired", event.target.checked)}
              />{" "}
              Houve afastamento
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input
                type="checkbox"
                checked={form.policeReport}
                onChange={event => set("policeReport", event.target.checked)}
              />{" "}
              Boletim policial
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input
                type="checkbox"
                checked={form.deathOccurred}
                onChange={event => set("deathOccurred", event.target.checked)}
              />{" "}
              Houve óbito
            </label>
            {form.deathOccurred || form.catType === "comunicacao_obito" ? (
              <label className="text-xs font-semibold">
                Data do óbito
                <Input
                  className="mt-1"
                  type="date"
                  value={form.deathDate}
                  onChange={event => set("deathDate", event.target.value)}
                />
              </label>
            ) : null}
          </div>
        </fieldset>
        <fieldset className="grid gap-3 border p-3 md:grid-cols-2 lg:grid-cols-4">
          <legend className="px-2 text-sm font-semibold">
            Atendimento médico
          </legend>
          <label className="text-xs font-semibold">
            Data e hora
            <Input
              className="mt-1"
              type="datetime-local"
              value={form.medicalAttendanceAt}
              onChange={event => set("medicalAttendanceAt", event.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 pt-6 text-sm">
            <input
              type="checkbox"
              checked={form.hospitalization}
              onChange={event => set("hospitalization", event.target.checked)}
            />{" "}
            Houve internação
          </label>
          <label className="text-xs font-semibold">
            Dias de tratamento
            <Input
              className="mt-1"
              type="number"
              value={form.treatmentDays}
              onChange={event => set("treatmentDays", event.target.value)}
            />
          </label>
          <label className="text-xs font-semibold">
            CID
            <Input
              className="mt-1"
              value={form.cid}
              onChange={event => set("cid", event.target.value)}
            />
          </label>
          <label className="text-xs font-semibold lg:col-span-2">
            Diagnóstico informado
            <Input
              className="mt-1"
              value={form.diagnosis}
              onChange={event => set("diagnosis", event.target.value)}
            />
          </label>
          <label className="text-xs font-semibold">
            Profissional
            <Input
              className="mt-1"
              value={form.doctorName}
              onChange={event => set("doctorName", event.target.value)}
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs font-semibold">
              Conselho
              <select
                className="mt-1 h-10 w-full border bg-white px-2 text-sm"
                value={form.doctorCouncil}
                onChange={event => set("doctorCouncil", event.target.value)}
              >
                <option value="CRM">CRM</option>
                <option value="CRO">CRO</option>
                <option value="RMS">RMS</option>
              </select>
            </label>
            <label className="text-xs font-semibold">
              Registro
              <Input
                className="mt-1"
                value={form.doctorRegistration}
                onChange={event =>
                  set("doctorRegistration", event.target.value)
                }
              />
            </label>
            <label className="text-xs font-semibold">
              UF
              <Input
                className="mt-1 uppercase"
                maxLength={2}
                value={form.doctorUf}
                onChange={event =>
                  set("doctorUf", event.target.value.toUpperCase())
                }
              />
            </label>
          </div>
          <label className="text-xs font-semibold lg:col-span-4">
            Observações médicas
            <Textarea
              className="mt-1"
              value={form.medicalNotes}
              onChange={event => set("medicalNotes", event.target.value)}
            />
          </label>
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={close}>
            Cancelar
          </Button>
          <Button
            disabled={
              validation.isPending ||
              !form.collaboratorId ||
              !form.eventAt ||
              form.description.trim().length < 10
            }
            onClick={() => validation.mutate(buildPayload())}
          >
            <ShieldCheck size={14} className="mr-2" />
            {validation.isPending
              ? "Conferindo dados..."
              : "Conferir CAT antes de salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WorkOrderDialog({ open, close, workers, busy, save }: any) {
  const [selected, setSelected] = useState<number[]>([]);
  const [title, setTitle] = useState("");
  const [activity, setActivity] = useState("");
  const [risks, setRisks] = useState("");
  const [measures, setMeasures] = useState("");
  const [epis, setEpis] = useState("");
  const [epcs, setEpcs] = useState("");
  const [trainings, setTrainings] = useState("");
  const split = (value: string) =>
    value
      .split("\n")
      .map(item => item.trim())
      .filter(Boolean);
  return (
    <Dialog open={open} onOpenChange={value => !value && close()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Gerar Ordem de Serviço em lote</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <WorkerMultiSelect
            workers={workers}
            selected={selected}
            setSelected={setSelected}
          />
          <div className="grid gap-2">
            <label className="text-xs font-semibold">
              Título
              <Input
                className="mt-1"
                value={title}
                onChange={event => setTitle(event.target.value)}
              />
            </label>
            <label className="text-xs font-semibold">
              Atividade
              <Textarea
                className="mt-1"
                value={activity}
                onChange={event => setActivity(event.target.value)}
              />
            </label>
            <label className="text-xs font-semibold">
              Riscos, um por linha
              <Textarea
                className="mt-1"
                value={risks}
                onChange={event => setRisks(event.target.value)}
              />
            </label>
            <label className="text-xs font-semibold">
              Medidas preventivas, uma por linha
              <Textarea
                className="mt-1"
                value={measures}
                onChange={event => setMeasures(event.target.value)}
              />
            </label>
            <label className="text-xs font-semibold">
              EPI / EPC / treinamentos
              <Input
                className="mt-1"
                value={[epis, epcs, trainings].filter(Boolean).join(" | ")}
                onChange={event => {
                  setEpis(event.target.value);
                  setEpcs("");
                  setTrainings("");
                }}
                placeholder="Informe os controles previstos"
              />
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={close}>
            Cancelar
          </Button>
          <Button
            disabled={busy || !selected.length || !title.trim()}
            onClick={() =>
              save({
                collaboratorIds: selected,
                title,
                activity: activity || undefined,
                risks: split(risks),
                preventiveMeasures: split(measures),
                epis: split(epis),
                epcs: split(epcs),
                trainings: split(trainings),
                validFrom: null,
                validUntil: null,
              })
            }
          >
            {busy ? "Gerando..." : `Gerar ${selected.length} ordem(ns)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
