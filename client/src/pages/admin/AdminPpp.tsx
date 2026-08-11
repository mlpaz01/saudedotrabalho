import { useMemo, useState } from "react";
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
  AlertTriangle,
  CheckCircle2,
  Download,
  FileBadge2,
  FileSpreadsheet,
  FileText,
  History,
  IdCard,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

type Tab = "painel" | "linha_tempo" | "importacao" | "documentos" | "auditoria";

const tabs: Array<{ id: Tab; label: string; icon: any }> = [
  { id: "painel", label: "Painel", icon: ShieldCheck },
  { id: "linha_tempo", label: "Linha do tempo", icon: History },
  { id: "importacao", label: "Importacao historica", icon: FileSpreadsheet },
  { id: "documentos", label: "PPPs gerados", icon: FileBadge2 },
  { id: "auditoria", label: "Auditoria", icon: FileText },
];

const eventTypeOptions = [
  ["admissao", "Admissao"],
  ["periodo_laboral", "Periodo laboral"],
  ["mudanca_funcao", "Mudanca de funcao"],
  ["transferencia", "Transferencia"],
  ["exposicao", "Exposicao"],
  ["exame", "Exame ocupacional"],
  ["afastamento", "Afastamento"],
  ["desligamento", "Desligamento"],
  ["outro", "Outro"],
] as const;

function downloadData(dataBase64: string, fileName: string) {
  const anchor = document.createElement("a");
  anchor.href = dataBase64;
  anchor.download = fileName;
  anchor.click();
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function dateOnly(value: unknown) {
  const text = String(value || "").slice(0, 10);
  if (!text) return "-";
  const parts = text.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : text;
}

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
          {subtitle ? (
            <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
          ) : null}
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
  value: number | string;
  warning?: boolean;
}) {
  return (
    <div
      className={`border p-4 ${warning ? "border-amber-200 bg-amber-50" : "bg-white"}`}
    >
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

function WorkerSelect({
  workers,
  value,
  onChange,
}: {
  workers: any[];
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block min-w-72 text-xs font-semibold text-slate-700">
      Colaborador
      <select
        className="mt-1 h-10 w-full border bg-white px-3 text-sm"
        value={value}
        onChange={event => onChange(Number(event.target.value))}
      >
        <option value={0}>Selecione um colaborador</option>
        {workers.map(row => (
          <option value={row.id} key={row.id}>
            {row.name} -{" "}
            {row.cpf || row.employee_registration || "sem identificador"}
          </option>
        ))}
      </select>
    </label>
  );
}

const emptyManual = {
  eventType: "periodo_laboral",
  validFrom: "",
  validUntil: "",
  branchName: "",
  sectorName: "",
  positionName: "",
  gseCode: "",
  gseName: "",
  activityDescription: "",
  riskType: "",
  riskAgentCode: "",
  riskAgent: "",
  intensityConcentration: "",
  evaluationTechnique: "",
  epcEffective: "",
  epiEffective: "",
  epiCa: "",
  examName: "",
  examDate: "",
  fitnessStatus: "",
  sourceDocument: "",
  notes: "",
};

export default function AdminPpp() {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<Tab>("painel");
  const [workerId, setWorkerId] = useState(0);
  const [fileName, setFileName] = useState("");
  const [fileData, setFileData] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState<any>(emptyManual);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generate, setGenerate] = useState({
    referenceDate: new Date().toISOString().slice(0, 10),
    legalResponsibleName: "",
    legalResponsibleCpf: "",
    legalResponsibleRole: "",
    notes: "",
  });

  const dashboardQ = trpc.occupationalPpp.dashboard.useQuery();
  const workersQ = trpc.occupationalPpp.listWorkers.useQuery();
  const timelineQ = trpc.occupationalPpp.listTimeline.useQuery(
    { collaboratorId: workerId || 1 },
    { enabled: Boolean(workerId) }
  );
  const documentsQ = trpc.occupationalPpp.listDocuments.useQuery({});
  const importsQ = trpc.occupationalPpp.listImports.useQuery(undefined, {
    enabled: tab === "importacao",
  });
  const auditQ = trpc.occupationalPpp.auditTrail.useQuery(undefined, {
    enabled: tab === "auditoria",
  });

  const invalidateAll = () =>
    Promise.all([
      utils.occupationalPpp.dashboard.invalidate(),
      utils.occupationalPpp.listTimeline.invalidate(),
      utils.occupationalPpp.listDocuments.invalidate(),
      utils.occupationalPpp.listImports.invalidate(),
      utils.occupationalPpp.auditTrail.invalidate(),
    ]);

  const template = trpc.occupationalPpp.getImportTemplate.useMutation({
    onSuccess: result => downloadData(result.dataBase64, result.fileName),
    onError: error => toast.error(error.message),
  });
  const previewImport = trpc.occupationalPpp.previewImport.useMutation({
    onSuccess: result => setPreview(result),
    onError: error => toast.error(error.message),
  });
  const confirmImport = trpc.occupationalPpp.confirmImport.useMutation({
    onSuccess: async result => {
      toast.success(
        `${result.imported} linha(s) importada(s); ${result.duplicates} duplicada(s); ${result.rejected} rejeitada(s).`
      );
      setPreview(null);
      setFileData("");
      setFileName("");
      await invalidateAll();
    },
    onError: error => toast.error(error.message),
  });
  const createEvent = trpc.occupationalPpp.createManualEvent.useMutation({
    onSuccess: async () => {
      toast.success("Evento incluido na linha do tempo laboral.");
      setManualOpen(false);
      setManual(emptyManual);
      await invalidateAll();
    },
    onError: error => toast.error(error.message),
  });
  const invalidateEvent = trpc.occupationalPpp.invalidateEvent.useMutation({
    onSuccess: async () => {
      toast.success("Evento invalidado com rastreabilidade preservada.");
      await invalidateAll();
    },
    onError: error => toast.error(error.message),
  });
  const generatePpp = trpc.occupationalPpp.generatePpp.useMutation({
    onSuccess: async result => {
      downloadData(result.dataBase64, result.fileName);
      toast.success(`Espelho PPP versao ${result.version} gerado.`);
      setGenerateOpen(false);
      await invalidateAll();
    },
    onError: error => toast.error(error.message),
  });
  const getDocument = trpc.occupationalPpp.getDocument.useMutation({
    onSuccess: result => downloadData(result.dataBase64, result.fileName),
    onError: error => toast.error(error.message),
  });

  const workers = (workersQ.data || []) as any[];
  const dashboard = dashboardQ.data as any;
  const selectedWorker = workers.find(row => Number(row.id) === workerId);
  const timeline = (timelineQ.data as any)?.events || [];
  const validPreviewRows = useMemo(
    () => (preview?.rows || []).filter((row: any) => row.valid),
    [preview]
  );

  async function selectFile(file?: File) {
    if (!file) return;
    if (!/\.(xlsx|csv)$/i.test(file.name)) {
      toast.error("Selecione uma planilha XLSX ou CSV.");
      return;
    }
    setFileName(file.name);
    setFileData(await fileToDataUrl(file));
    setPreview(null);
  }

  function submitManual() {
    if (!workerId || !manual.validFrom) {
      toast.error("Selecione o colaborador e informe a data inicial.");
      return;
    }
    createEvent.mutate({
      collaboratorId: workerId,
      eventType: manual.eventType,
      validFrom: manual.validFrom,
      validUntil: manual.validUntil || null,
      branchName: manual.branchName || undefined,
      sectorName: manual.sectorName || undefined,
      positionName: manual.positionName || undefined,
      gseCode: manual.gseCode || undefined,
      gseName: manual.gseName || undefined,
      activityDescription: manual.activityDescription || undefined,
      riskType: manual.riskType || undefined,
      riskAgentCode: manual.riskAgentCode || undefined,
      riskAgent: manual.riskAgent || undefined,
      intensityConcentration: manual.intensityConcentration || undefined,
      evaluationTechnique: manual.evaluationTechnique || undefined,
      epcEffective:
        manual.epcEffective === "" ? null : manual.epcEffective === "sim",
      epiEffective:
        manual.epiEffective === "" ? null : manual.epiEffective === "sim",
      epiCa: manual.epiCa || undefined,
      examName: manual.examName || undefined,
      examDate: manual.examDate || null,
      fitnessStatus: manual.fitnessStatus || undefined,
      sourceDocument: manual.sourceDocument || undefined,
      notes: manual.notes || undefined,
    });
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1540px] space-y-5 p-4 md:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-teal-700">
              <IdCard size={15} /> Previdenciario e ocupacional
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">
              PPP e Historico Laboral
            </h1>
            <p className="mt-1 max-w-4xl text-sm text-slate-500">
              Consolide o passado importado e os eventos atuais de GSE, PGR,
              LTCAT, PCMSO e exames em uma linha do tempo auditavel.
            </p>
          </div>
          <Badge className="rounded-sm bg-teal-100 text-teal-800">
            Acesso SESMT
          </Badge>
        </header>

        <div className="border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-xs text-amber-950">
          Para periodos a partir de 01/01/2023, o PPP oficial e formado pelos
          eventos SST enviados ao eSocial. A plataforma gera um espelho
          consolidado para conferencia e preserva a origem de cada informacao.
        </div>

        <div className="flex gap-1 overflow-x-auto border-b pb-1">
          {tabs.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`flex h-9 shrink-0 items-center gap-2 border-b-2 px-3 text-xs font-semibold ${tab === item.id ? "border-teal-600 text-teal-800" : "border-transparent text-slate-500"}`}
              >
                <Icon size={14} /> {item.label}
              </button>
            );
          })}
        </div>

        {tab === "painel" ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <Metric label="Colaboradores" value={dashboard?.employees || 0} />
              <Metric
                label="Com historico importado"
                value={dashboard?.workersWithHistory || 0}
              />
              <Metric
                label="Eventos historicos"
                value={dashboard?.historyEvents || 0}
              />
              <Metric
                label="PPPs gerados"
                value={dashboard?.generatedPpps || 0}
              />
              <Metric
                label="Lotes importados"
                value={dashboard?.importBatches || 0}
              />
              <Metric
                label="Linhas rejeitadas"
                value={dashboard?.rejectedRows || 0}
                warning={Boolean(dashboard?.rejectedRows)}
              />
            </div>
            <Panel
              title="Fluxo de consolidacao"
              subtitle="A fonte original permanece identificada em todas as etapas."
            >
              <div className="grid gap-3 md:grid-cols-5">
                {[
                  "Importar passado",
                  "Conferir periodos",
                  "Integrar eventos atuais",
                  "Validar responsaveis",
                  "Gerar espelho PPP",
                ].map((label, index) => (
                  <div className="border p-3" key={label}>
                    <span className="text-xs font-bold text-teal-700">
                      ETAPA {index + 1}
                    </span>
                    <p className="mt-1 text-sm font-semibold">{label}</p>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Controles de seguranca e consistencia">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="flex gap-3 border-l-2 border-teal-500 pl-3">
                  <CheckCircle2 className="mt-0.5 text-teal-700" size={18} />
                  <p className="text-sm">
                    Isolamento por empresa e identificacao por CPF ou matricula.
                  </p>
                </div>
                <div className="flex gap-3 border-l-2 border-teal-500 pl-3">
                  <CheckCircle2 className="mt-0.5 text-teal-700" size={18} />
                  <p className="text-sm">
                    Previa antes da gravacao e bloqueio de registros duplicados.
                  </p>
                </div>
                <div className="flex gap-3 border-l-2 border-teal-500 pl-3">
                  <CheckCircle2 className="mt-0.5 text-teal-700" size={18} />
                  <p className="text-sm">
                    Invalidacao justificada sem apagar o historico de auditoria.
                  </p>
                </div>
              </div>
            </Panel>
          </div>
        ) : null}

        {tab === "linha_tempo" ? (
          <div className="space-y-4">
            <Panel
              title="Linha do Tempo Laboral do Colaborador"
              subtitle="Eventos importados e registros nativos sao apresentados em ordem cronologica."
              action={
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!workerId}
                    onClick={() => setManualOpen(true)}
                  >
                    <Plus size={14} className="mr-1" /> Evento historico
                  </Button>
                  <Button
                    size="sm"
                    disabled={!workerId}
                    onClick={() => setGenerateOpen(true)}
                  >
                    <FileBadge2 size={14} className="mr-1" /> Gerar espelho PPP
                  </Button>
                </div>
              }
            >
              <WorkerSelect
                workers={workers}
                value={workerId}
                onChange={setWorkerId}
              />
            </Panel>
            {selectedWorker ? (
              <Panel
                title={selectedWorker.name}
                subtitle={`${selectedWorker.branch_name || "Sem filial"} | ${selectedWorker.sector_name || "Sem setor"} | ${selectedWorker.position || "Sem cargo"}`}
              >
                {timelineQ.isLoading ? (
                  <p className="text-sm text-slate-500">
                    Carregando historico...
                  </p>
                ) : timeline.length ? (
                  <div className="relative ml-2 border-l border-slate-300 pl-6">
                    {timeline.map((event: any) => (
                      <article
                        className={`relative mb-4 border p-3 ${event.status === "invalidado" ? "bg-slate-50 opacity-60" : "bg-white"}`}
                        key={event.id}
                      >
                        <span className="absolute -left-[31px] top-4 h-3 w-3 rounded-full border-2 border-white bg-teal-600" />
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <b className="text-sm">{event.title}</b>
                              <Badge
                                variant="outline"
                                className="rounded-sm text-[10px]"
                              >
                                {event.label}
                              </Badge>
                              <Badge
                                variant="outline"
                                className="rounded-sm text-[10px]"
                              >
                                {event.origin}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              {dateOnly(event.date)}
                              {event.endDate
                                ? ` ate ${dateOnly(event.endDate)}`
                                : ""}{" "}
                              |{" "}
                              {event.description ||
                                "Sem descricao complementar"}
                            </p>
                            {event.sourceDocument ? (
                              <p className="mt-1 text-xs">
                                Fonte: {event.sourceDocument}
                              </p>
                            ) : null}
                            {event.notes ? (
                              <p className="mt-1 text-xs text-slate-600">
                                {event.notes}
                              </p>
                            ) : null}
                          </div>
                          {event.canInvalidate ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Invalidar evento"
                              onClick={() => {
                                const reason = window.prompt(
                                  "Informe o motivo da invalidacao:"
                                );
                                if (reason && reason.trim().length >= 5)
                                  invalidateEvent.mutate({
                                    id: event.recordId,
                                    reason: reason.trim(),
                                  });
                              }}
                            >
                              <Trash2 size={15} className="text-rose-700" />
                            </Button>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    Nenhum evento laboral localizado para este colaborador.
                  </p>
                )}
              </Panel>
            ) : null}
          </div>
        ) : null}

        {tab === "importacao" ? (
          <div className="space-y-4">
            <Panel
              title="Importar historico anterior"
              subtitle="Use o modelo padrao para trazer periodos, cargos, GSE/GHE, exposicoes, exames e fontes documentais."
              action={
                <Button
                  size="sm"
                  variant="outline"
                  disabled={template.isPending}
                  onClick={() => template.mutate()}
                >
                  <Download size={14} className="mr-1" /> Baixar modelo Excel
                </Button>
              }
            >
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                <label className="text-xs font-semibold text-slate-700">
                  Planilha XLSX ou CSV
                  <Input
                    className="mt-1"
                    type="file"
                    accept=".xlsx,.csv"
                    onChange={event => selectFile(event.target.files?.[0])}
                  />
                </label>
                <Button
                  disabled={!fileData || previewImport.isPending}
                  onClick={() => previewImport.mutate({ fileName, fileData })}
                >
                  <Upload size={15} className="mr-1" />
                  {previewImport.isPending
                    ? "Analisando..."
                    : "Visualizar antes de importar"}
                </Button>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Nenhum dado e gravado durante a pre-visualizacao. Limite de
                5.000 linhas e 15 MB por arquivo.
              </p>
            </Panel>

            {preview ? (
              <Panel
                title="Conferencia da importacao"
                subtitle={
                  preview.truncated
                    ? "A tabela mostra as primeiras 500 linhas; o resumo considera o arquivo completo."
                    : undefined
                }
                action={
                  <Button
                    disabled={!preview.valid || confirmImport.isPending}
                    onClick={() => confirmImport.mutate({ fileName, fileData })}
                  >
                    <CheckCircle2 size={15} className="mr-1" />
                    {confirmImport.isPending
                      ? "Importando..."
                      : `Confirmar ${preview.valid} linha(s)`}
                  </Button>
                }
              >
                <div className="mb-4 grid gap-3 sm:grid-cols-4">
                  <Metric label="Total" value={preview.total} />
                  <Metric label="Validas" value={preview.valid} />
                  <Metric
                    label="Invalidas"
                    value={preview.invalid}
                    warning={preview.invalid > 0}
                  />
                  <Metric
                    label="Duplicadas"
                    value={preview.duplicates}
                    warning={preview.duplicates > 0}
                  />
                </div>
                <div className="max-h-[520px] overflow-auto border">
                  <table className="w-full min-w-[1000px] text-xs">
                    <thead className="sticky top-0 bg-slate-100 text-left">
                      <tr>
                        <th className="p-2">Linha</th>
                        <th className="p-2">Colaborador</th>
                        <th className="p-2">Periodo</th>
                        <th className="p-2">Evento</th>
                        <th className="p-2">Cargo / GSE</th>
                        <th className="p-2">Risco / Exame</th>
                        <th className="p-2">Validacao</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row: any) => (
                        <tr className="border-t align-top" key={row.sourceRow}>
                          <td className="p-2">{row.sourceRow}</td>
                          <td className="p-2 font-semibold">
                            {row.collaboratorName}
                          </td>
                          <td className="p-2">
                            {dateOnly(row.validFrom)}
                            {row.validUntil
                              ? ` a ${dateOnly(row.validUntil)}`
                              : ""}
                          </td>
                          <td className="p-2">
                            {row.eventType.replaceAll("_", " ")}
                          </td>
                          <td className="p-2">
                            {row.positionName || "-"}
                            <br />
                            <span className="text-slate-500">
                              {row.gseName || "-"}
                            </span>
                          </td>
                          <td className="p-2">
                            {row.riskAgent || "-"}
                            <br />
                            <span className="text-slate-500">
                              {row.examName || "-"}
                            </span>
                          </td>
                          <td className="p-2">
                            {row.valid ? (
                              <span className="font-semibold text-emerald-700">
                                Pronta
                              </span>
                            ) : row.duplicate ? (
                              <span className="font-semibold text-amber-700">
                                Duplicada
                              </span>
                            ) : (
                              <span className="font-semibold text-rose-700">
                                Revisar
                              </span>
                            )}
                            {[
                              ...(row.errors || []),
                              ...(row.warnings || []),
                            ].map((message: string) => (
                              <p className="mt-1 max-w-80" key={message}>
                                {message}
                              </p>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!validPreviewRows.length ? (
                  <div className="mt-3 flex items-center gap-2 text-xs text-amber-800">
                    <AlertTriangle size={15} /> Corrija a planilha antes de
                    confirmar a importacao.
                  </div>
                ) : null}
              </Panel>
            ) : null}

            <Panel title="Historico de lotes importados">
              <div className="overflow-auto">
                <table className="w-full min-w-[760px] text-xs">
                  <thead className="bg-slate-100 text-left">
                    <tr>
                      <th className="p-2">Arquivo</th>
                      <th className="p-2">Data</th>
                      <th className="p-2">Total</th>
                      <th className="p-2">Importadas</th>
                      <th className="p-2">Rejeitadas</th>
                      <th className="p-2">Duplicadas</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {((importsQ.data || []) as any[]).map(row => (
                      <tr className="border-t" key={row.id}>
                        <td className="p-2 font-semibold">{row.file_name}</td>
                        <td className="p-2">
                          {new Date(row.created_at).toLocaleString("pt-BR")}
                        </td>
                        <td className="p-2">{row.total_rows}</td>
                        <td className="p-2 text-emerald-700">
                          {row.imported_rows}
                        </td>
                        <td className="p-2 text-rose-700">
                          {row.rejected_rows}
                        </td>
                        <td className="p-2 text-amber-700">
                          {row.duplicate_rows}
                        </td>
                        <td className="p-2">{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        ) : null}

        {tab === "documentos" ? (
          <Panel
            title="Documentos PPP consolidados"
            subtitle="Cada geracao cria uma nova versao e preserva o retrato das fontes utilizadas."
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => documentsQ.refetch()}
              >
                <RefreshCw size={14} className="mr-1" /> Atualizar
              </Button>
            }
          >
            <div className="overflow-auto">
              <table className="w-full min-w-[850px] text-xs">
                <thead className="bg-slate-100 text-left">
                  <tr>
                    <th className="p-2">Colaborador</th>
                    <th className="p-2">Identificador</th>
                    <th className="p-2">Versao</th>
                    <th className="p-2">Referencia</th>
                    <th className="p-2">Responsavel</th>
                    <th className="p-2">Gerado em</th>
                    <th className="p-2 text-right">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {((documentsQ.data || []) as any[]).map(row => (
                    <tr className="border-t" key={row.id}>
                      <td className="p-2 font-semibold">
                        {row.collaborator_name}
                      </td>
                      <td className="p-2">
                        {row.cpf || row.employee_registration || "-"}
                      </td>
                      <td className="p-2">v{row.version_number}</td>
                      <td className="p-2">{dateOnly(row.reference_date)}</td>
                      <td className="p-2">{row.legal_responsible_name}</td>
                      <td className="p-2">
                        {new Date(row.generated_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="p-2 text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Baixar PDF"
                          onClick={() => getDocument.mutate({ id: row.id })}
                        >
                          <Download size={15} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!documentsQ.data?.length ? (
                <p className="p-5 text-center text-sm text-slate-500">
                  Nenhum PPP consolidado gerado.
                </p>
              ) : null}
            </div>
          </Panel>
        ) : null}

        {tab === "auditoria" ? (
          <Panel
            title="Trilha de auditoria"
            subtitle="Importacoes, consultas, invalidacoes, geracoes e downloads do PPP."
          >
            <div className="max-h-[650px] overflow-auto">
              <table className="w-full min-w-[850px] text-xs">
                <thead className="sticky top-0 bg-slate-100 text-left">
                  <tr>
                    <th className="p-2">Data</th>
                    <th className="p-2">Usuario</th>
                    <th className="p-2">Acao</th>
                    <th className="p-2">Entidade</th>
                    <th className="p-2">Colaborador</th>
                    <th className="p-2">Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {((auditQ.data || []) as any[]).map(row => (
                    <tr className="border-t align-top" key={row.id}>
                      <td className="p-2">
                        {new Date(row.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="p-2 font-semibold">
                        {row.actor_name || "Sistema"}
                      </td>
                      <td className="p-2">{row.action}</td>
                      <td className="p-2">
                        {row.entity_type} #{row.entity_id || "-"}
                      </td>
                      <td className="p-2">{row.collaborator_id || "-"}</td>
                      <td className="max-w-md p-2 font-mono text-[10px]">
                        {Object.keys(row.details || {}).length
                          ? JSON.stringify(row.details)
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        ) : null}
      </div>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo evento historico</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-500">
            {selectedWorker?.name || "Selecione um colaborador"}. O registro
            manual permanecera identificado e auditado.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-xs font-semibold">
              Tipo de evento
              <select
                className="mt-1 h-10 w-full border bg-white px-3"
                value={manual.eventType}
                onChange={event =>
                  setManual({ ...manual, eventType: event.target.value })
                }
              >
                {eventTypeOptions.map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold">
              Data inicial
              <Input
                className="mt-1"
                type="date"
                value={manual.validFrom}
                onChange={event =>
                  setManual({ ...manual, validFrom: event.target.value })
                }
              />
            </label>
            <label className="text-xs font-semibold">
              Data final
              <Input
                className="mt-1"
                type="date"
                value={manual.validUntil}
                onChange={event =>
                  setManual({ ...manual, validUntil: event.target.value })
                }
              />
            </label>
            <label className="text-xs font-semibold">
              Filial
              <Input
                className="mt-1"
                value={manual.branchName}
                onChange={event =>
                  setManual({ ...manual, branchName: event.target.value })
                }
              />
            </label>
            <label className="text-xs font-semibold">
              Setor
              <Input
                className="mt-1"
                value={manual.sectorName}
                onChange={event =>
                  setManual({ ...manual, sectorName: event.target.value })
                }
              />
            </label>
            <label className="text-xs font-semibold">
              Cargo / Funcao
              <Input
                className="mt-1"
                value={manual.positionName}
                onChange={event =>
                  setManual({ ...manual, positionName: event.target.value })
                }
              />
            </label>
            <label className="text-xs font-semibold">
              Codigo GSE/GHE
              <Input
                className="mt-1"
                value={manual.gseCode}
                onChange={event =>
                  setManual({ ...manual, gseCode: event.target.value })
                }
              />
            </label>
            <label className="text-xs font-semibold md:col-span-2">
              GSE/GHE
              <Input
                className="mt-1"
                value={manual.gseName}
                onChange={event =>
                  setManual({ ...manual, gseName: event.target.value })
                }
              />
            </label>
            <label className="text-xs font-semibold md:col-span-3">
              Descricao das atividades
              <Textarea
                className="mt-1"
                value={manual.activityDescription}
                onChange={event =>
                  setManual({
                    ...manual,
                    activityDescription: event.target.value,
                  })
                }
              />
            </label>
            <label className="text-xs font-semibold">
              Tipo de risco
              <Input
                className="mt-1"
                value={manual.riskType}
                onChange={event =>
                  setManual({ ...manual, riskType: event.target.value })
                }
              />
            </label>
            <label className="text-xs font-semibold">
              Codigo agente eSocial
              <Input
                className="mt-1"
                value={manual.riskAgentCode}
                onChange={event =>
                  setManual({ ...manual, riskAgentCode: event.target.value })
                }
              />
            </label>
            <label className="text-xs font-semibold">
              Agente / Exposicao
              <Input
                className="mt-1"
                value={manual.riskAgent}
                onChange={event =>
                  setManual({ ...manual, riskAgent: event.target.value })
                }
              />
            </label>
            <label className="text-xs font-semibold">
              Intensidade / Concentracao
              <Input
                className="mt-1"
                value={manual.intensityConcentration}
                onChange={event =>
                  setManual({
                    ...manual,
                    intensityConcentration: event.target.value,
                  })
                }
              />
            </label>
            <label className="text-xs font-semibold md:col-span-2">
              Tecnica utilizada
              <Input
                className="mt-1"
                value={manual.evaluationTechnique}
                onChange={event =>
                  setManual({
                    ...manual,
                    evaluationTechnique: event.target.value,
                  })
                }
              />
            </label>
            <label className="text-xs font-semibold">
              EPC eficaz
              <select
                className="mt-1 h-10 w-full border bg-white px-3"
                value={manual.epcEffective}
                onChange={event =>
                  setManual({ ...manual, epcEffective: event.target.value })
                }
              >
                <option value="">Nao informado</option>
                <option value="sim">Sim</option>
                <option value="nao">Nao</option>
              </select>
            </label>
            <label className="text-xs font-semibold">
              EPI eficaz
              <select
                className="mt-1 h-10 w-full border bg-white px-3"
                value={manual.epiEffective}
                onChange={event =>
                  setManual({ ...manual, epiEffective: event.target.value })
                }
              >
                <option value="">Nao informado</option>
                <option value="sim">Sim</option>
                <option value="nao">Nao</option>
              </select>
            </label>
            <label className="text-xs font-semibold">
              CA do EPI
              <Input
                className="mt-1"
                value={manual.epiCa}
                onChange={event =>
                  setManual({ ...manual, epiCa: event.target.value })
                }
              />
            </label>
            <label className="text-xs font-semibold">
              Exame
              <Input
                className="mt-1"
                value={manual.examName}
                onChange={event =>
                  setManual({ ...manual, examName: event.target.value })
                }
              />
            </label>
            <label className="text-xs font-semibold">
              Data do exame
              <Input
                className="mt-1"
                type="date"
                value={manual.examDate}
                onChange={event =>
                  setManual({ ...manual, examDate: event.target.value })
                }
              />
            </label>
            <label className="text-xs font-semibold">
              Aptidao
              <Input
                className="mt-1"
                value={manual.fitnessStatus}
                onChange={event =>
                  setManual({ ...manual, fitnessStatus: event.target.value })
                }
              />
            </label>
            <label className="text-xs font-semibold md:col-span-3">
              Documento de origem
              <Input
                className="mt-1"
                value={manual.sourceDocument}
                onChange={event =>
                  setManual({ ...manual, sourceDocument: event.target.value })
                }
                placeholder="Ex.: LTCAT 2022, ficha funcional, ASO arquivado"
              />
            </label>
            <label className="text-xs font-semibold md:col-span-3">
              Observacoes
              <Textarea
                className="mt-1"
                value={manual.notes}
                onChange={event =>
                  setManual({ ...manual, notes: event.target.value })
                }
              />
            </label>
          </div>
          <Button disabled={createEvent.isPending} onClick={submitManual}>
            {createEvent.isPending ? "Salvando..." : "Salvar evento historico"}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerar espelho consolidado do PPP</DialogTitle>
          </DialogHeader>
          <div className="border-l-4 border-amber-500 bg-amber-50 p-3 text-xs">
            O PDF sera versionado e guardara uma fotografia das fontes
            utilizadas. Ele nao substitui o PPP eletronico oficial do
            eSocial/INSS.
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold">
              Colaborador
              <Input
                className="mt-1"
                value={selectedWorker?.name || ""}
                disabled
              />
            </label>
            <label className="text-xs font-semibold">
              Data de referencia
              <Input
                className="mt-1"
                type="date"
                value={generate.referenceDate}
                onChange={event =>
                  setGenerate({
                    ...generate,
                    referenceDate: event.target.value,
                  })
                }
              />
            </label>
            <label className="text-xs font-semibold">
              Representante legal / preposto
              <Input
                className="mt-1"
                value={generate.legalResponsibleName}
                onChange={event =>
                  setGenerate({
                    ...generate,
                    legalResponsibleName: event.target.value,
                  })
                }
              />
            </label>
            <label className="text-xs font-semibold">
              CPF do responsavel
              <Input
                className="mt-1"
                value={generate.legalResponsibleCpf}
                onChange={event =>
                  setGenerate({
                    ...generate,
                    legalResponsibleCpf: event.target.value,
                  })
                }
              />
            </label>
            <label className="text-xs font-semibold md:col-span-2">
              Cargo do responsavel
              <Input
                className="mt-1"
                value={generate.legalResponsibleRole}
                onChange={event =>
                  setGenerate({
                    ...generate,
                    legalResponsibleRole: event.target.value,
                  })
                }
              />
            </label>
            <label className="text-xs font-semibold md:col-span-2">
              Observacoes de consolidacao
              <Textarea
                className="mt-1"
                value={generate.notes}
                onChange={event =>
                  setGenerate({ ...generate, notes: event.target.value })
                }
              />
            </label>
          </div>
          <Button
            disabled={
              !workerId ||
              !generate.legalResponsibleName ||
              !generate.legalResponsibleCpf ||
              generatePpp.isPending
            }
            onClick={() =>
              generatePpp.mutate({
                collaboratorId: workerId,
                referenceDate: generate.referenceDate,
                legalResponsibleName: generate.legalResponsibleName,
                legalResponsibleCpf: generate.legalResponsibleCpf,
                legalResponsibleRole:
                  generate.legalResponsibleRole || undefined,
                notes: generate.notes || undefined,
              })
            }
          >
            {generatePpp.isPending
              ? "Gerando documento..."
              : "Gerar e baixar PDF"}
          </Button>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
