import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSearch,
  FileText,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type PcmsoWorkspaceProps = {
  programs: any[];
  pgrs: any[];
  exams: any[];
  selectedId: number | null;
  select: (id: number) => void;
  data: any;
  onNew: () => void;
  onEdit: () => void;
  onAnnex: () => void;
  onDownload: (kind: "pcmso_annex" | "pcmso_version", id: number) => void;
  onImport: (id: number) => void;
  onDecision: (payload: any) => void;
  onGenerateAi: () => void;
  onAudit: () => void;
  onAnalyticalReport: (payload: {
    periodStart: string;
    periodEnd: string;
  }) => void;
  onReviewAnalytical: (payload: any) => void;
  onPgrReview: (payload: {
    gseName?: string;
    riskName?: string;
    description: string;
  }) => void;
  onSign: () => void;
  onArchive: () => void;
  onPdf: () => void;
  busy: boolean;
};

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="font-semibold text-slate-950">{title}</h2>
          {description ? (
            <p className="mt-1 max-w-4xl text-xs text-slate-500">
              {description}
            </p>
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
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "warning" | "success";
}) {
  const color =
    tone === "warning"
      ? "border-amber-300 bg-amber-50 text-amber-950"
      : tone === "success"
        ? "border-emerald-300 bg-emerald-50 text-emerald-950"
        : "border-slate-200 bg-slate-50 text-slate-950";
  return (
    <div className={`min-h-20 border p-3 ${color}`}>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-bold">{value}</div>
    </div>
  );
}

function statusLabel(value: string) {
  return (
    {
      rascunho: "Rascunho",
      em_revisao: "Em revisão",
      vigente: "Vigente",
      arquivado: "Arquivado",
      aprovado: "Aprovado",
    }[value] ||
    value ||
    "Não informado"
  );
}

function today(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export default function PcmsoWorkspace({
  programs,
  pgrs,
  exams,
  selectedId,
  select,
  data,
  onNew,
  onEdit,
  onAnnex,
  onDownload,
  onImport,
  onDecision,
  onGenerateAi,
  onAudit,
  onAnalyticalReport,
  onReviewAnalytical,
  onPgrReview,
  onSign,
  onArchive,
  onPdf,
  busy,
}: PcmsoWorkspaceProps) {
  const [pgrId, setPgrId] = useState(0);
  const [showReference, setShowReference] = useState(false);
  const [periodStart, setPeriodStart] = useState(today(-365));
  const [periodEnd, setPeriodEnd] = useState(today());
  const [reviewReason, setReviewReason] = useState("");
  const [programStatus, setProgramStatus] = useState<
    "andamento" | "rascunho" | "arquivado" | "todos"
  >("andamento");
  const program = data?.program;
  const monitoring = (data?.monitoring || []) as any[];
  const groups = useMemo(() => {
    const result = new Map<string, any[]>();
    monitoring.forEach(row => {
      const key = row.gse_name || "GSE não identificado";
      result.set(key, [...(result.get(key) || []), row]);
    });
    return [...result.entries()];
  }, [monitoring]);
  const pending = monitoring.filter(
    row => row.monitoring_kind === "nao_definido"
  ).length;
  const latestAudit = data?.audits?.[0];
  const visiblePrograms = programs.filter(row => {
    if (programStatus === "todos") return true;
    if (programStatus === "andamento")
      return ["vigente", "em_revisao"].includes(row.status);
    return row.status === programStatus;
  });

  return (
    <div className="space-y-4">
      <Section
        title="Programas PCMSO"
        description="O médico elabora, valida, assina e publica. O PGR fornece a base de riscos sem substituir a decisão clínica."
        action={
          <Button size="sm" onClick={onNew}>
            <Plus className="mr-1" size={14} /> Novo PCMSO
          </Button>
        }
      >
        <div className="mb-3 flex flex-wrap gap-2">
          {(
            [
              ["andamento", "Em andamento"],
              ["rascunho", "Rascunhos"],
              ["arquivado", "Arquivados"],
              ["todos", "Todos"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={programStatus === value ? "default" : "outline"}
              onClick={() => setProgramStatus(value)}
            >
              {label} (
              {
                programs.filter(
                  row =>
                    value === "todos" ||
                    (value === "andamento"
                      ? ["vigente", "em_revisao"].includes(row.status)
                      : row.status === value)
                ).length
              }
              )
            </Button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {visiblePrograms.map(row => (
            <button
              className={`min-w-64 border px-3 py-2 text-left text-sm ${
                selectedId === Number(row.id)
                  ? "border-teal-600 bg-teal-50"
                  : "bg-white hover:border-slate-400"
              }`}
              key={row.id}
              onClick={() => select(Number(row.id))}
              type="button"
            >
              <b className="block line-clamp-2">{row.title}</b>
              <span className="mt-1 block text-xs text-slate-500">
                {statusLabel(row.status)} · versão {row.current_version || 0}
              </span>
            </button>
          ))}
          {!visiblePrograms.length ? (
            <p className="text-sm text-slate-500">
              Nenhum PCMSO nesta situação.
            </p>
          ) : null}
        </div>
      </Section>

      {program ? (
        <>
          {Number(program.review_required) ? (
            <div className="flex gap-3 border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              <AlertTriangle className="mt-0.5 shrink-0" size={18} />
              <div>
                <b>O PGR foi alterado depois da última importação.</b>
                <p className="mt-1">
                  Reimporte o PGR e revise os vínculos médicos antes de emitir
                  uma nova versão do PCMSO.
                </p>
              </div>
            </div>
          ) : null}

          <Section
            title={program.title}
            description={`Vigência: ${program.valid_from || "-"} a ${program.valid_until || "-"} · Responsável: ${program.doctor_name || "não definido"} ${program.doctor_crm || ""}`}
            action={
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={onEdit}>
                  Editar conteúdo
                </Button>
                <Button size="sm" variant="outline" onClick={onAnnex}>
                  Anexar documento
                </Button>
                <Button size="sm" disabled={busy} onClick={onPdf}>
                  <Download className="mr-1" size={14} /> Gerar PDF
                </Button>
              </div>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <Metric label="Situação" value={statusLabel(program.status)} />
              <Metric
                label="Integração com PGR"
                value={`${Number(program.integration_score || 0)}%`}
                tone={
                  Number(program.integration_score) >= 100
                    ? "success"
                    : "warning"
                }
              />
              <Metric
                label="Auditoria assistida"
                value={`${Number(program.ai_audit_score || 0)}%`}
                tone={
                  Number(program.ai_audit_score) >= 80 ? "success" : "warning"
                }
              />
              <Metric label="Riscos importados" value={monitoring.length} />
              <Metric
                label="Decisões pendentes"
                value={pending}
                tone={pending ? "warning" : "success"}
              />
              <Metric label="Versão" value={program.current_version || 0} />
            </div>

            <div className="mt-4 border-t pt-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <select
                  className="h-10 border bg-white px-3 text-sm"
                  value={pgrId}
                  onChange={event => setPgrId(Number(event.target.value))}
                >
                  <option value={0}>Selecione o PGR de referência</option>
                  {pgrs.map(row => (
                    <option value={row.id} key={row.id}>
                      {row.title} · {statusLabel(row.status)}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  disabled={!pgrId || busy}
                  onClick={() => onImport(pgrId)}
                >
                  <RefreshCw className="mr-1" size={14} /> Importar ou atualizar
                  PGR
                </Button>
              </div>
              {data?.referenceSummary ? (
                <div className="mt-3 border bg-slate-50">
                  <button
                    className="flex w-full items-center justify-between p-3 text-left text-sm font-semibold"
                    onClick={() => setShowReference(value => !value)}
                    type="button"
                  >
                    Referência importada do PGR
                    <ChevronDown
                      className={showReference ? "rotate-180" : ""}
                      size={16}
                    />
                  </button>
                  {showReference ? (
                    <div className="grid gap-3 border-t p-3 text-sm md:grid-cols-4">
                      <div>
                        <span className="text-xs text-slate-500">PGR</span>
                        <b className="block">{program.pgr_title || "-"}</b>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500">GSEs</span>
                        <b className="block">{groups.length}</b>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500">Riscos</span>
                        <b className="block">{monitoring.length}</b>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500">
                          Última sincronização
                        </span>
                        <b className="block">
                          {program.pgr_synced_at
                            ? new Date(program.pgr_synced_at).toLocaleString(
                                "pt-BR"
                              )
                            : "Ainda não realizada"}
                        </b>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </Section>

          <Section
            title="Elaboração inteligente"
            description="A IA organiza o texto e sugere monitoramentos com base no PGR. Toda recomendação permanece pendente até validação expressa do médico responsável."
            action={
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={onGenerateAi}
                >
                  <Sparkles className="mr-1" size={14} /> Elaborar com IA
                </Button>
                <Button variant="outline" disabled={busy} onClick={onAudit}>
                  <FileSearch className="mr-1" size={14} /> Auditar consistência
                </Button>
              </div>
            }
          >
            {latestAudit ? (
              <div className="grid gap-3 md:grid-cols-[120px_1fr]">
                <div className="border bg-slate-50 p-3 text-center">
                  <div className="text-2xl font-bold text-teal-800">
                    {latestAudit.score}%
                  </div>
                  <div className="text-xs text-slate-500">última auditoria</div>
                </div>
                <div className="text-sm text-slate-600">
                  {latestAudit.ai_commentary ||
                    "Auditoria estrutural registrada. Consulte as pendências antes da assinatura."}
                  <p className="mt-2 text-xs font-medium text-amber-800">
                    A auditoria assistida não substitui revisão médica,
                    julgamento profissional ou validação jurídica.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Ainda não há auditoria registrada para esta versão.
              </p>
            )}
          </Section>

          <Section
            title="Matriz médica por GSE"
            description="Risco identificado no PGR → possível agravo → controle médico → periodicidade. Não há prescrição automática."
          >
            <div className="space-y-5">
              {groups.map(([gseName, rows]) => (
                <div className="border" key={gseName}>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-4 py-3">
                    <div>
                      <div className="text-xs font-semibold uppercase text-teal-700">
                        GSE
                      </div>
                      <h3 className="font-semibold">{gseName}</h3>
                    </div>
                    <Badge variant="outline" className="rounded-sm">
                      {rows.length} risco(s)
                    </Badge>
                  </div>
                  <div className="divide-y">
                    {rows.map(row => (
                      <MonitoringRow
                        key={row.id}
                        row={row}
                        exams={exams}
                        save={onDecision}
                      />
                    ))}
                  </div>
                </div>
              ))}
              {!groups.length ? (
                <div className="border border-dashed p-8 text-center text-sm text-slate-500">
                  Importe um PGR para iniciar a análise médica por GSE.
                </div>
              ) : null}
            </div>
          </Section>

          <Section
            title="Relatório analítico do PCMSO"
            description="Consolidação epidemiológica e ocupacional para revisão e aprovação do médico, preservando a confidencialidade clínica."
          >
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <label className="text-xs font-semibold text-slate-700">
                Início do período
                <Input
                  className="mt-1"
                  type="date"
                  value={periodStart}
                  onChange={event => setPeriodStart(event.target.value)}
                />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Fim do período
                <Input
                  className="mt-1"
                  type="date"
                  value={periodEnd}
                  onChange={event => setPeriodEnd(event.target.value)}
                />
              </label>
              <Button
                className="self-end"
                disabled={busy || !periodStart || !periodEnd}
                onClick={() => onAnalyticalReport({ periodStart, periodEnd })}
              >
                <FileText className="mr-1" size={14} /> Gerar relatório
              </Button>
            </div>
            <div className="mt-4 divide-y border">
              {(data?.analyticalReports || []).map((report: any) => (
                <div
                  className="grid gap-3 p-3 md:grid-cols-[1fr_auto]"
                  key={report.id}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <b className="text-sm">
                        {report.period_start} a {report.period_end}
                      </b>
                      <Badge variant="outline" className="rounded-sm">
                        {statusLabel(report.status)}
                      </Badge>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                      {report.narrative}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-xs text-slate-500">
                      Recomendações: {report.recommendations}
                    </p>
                  </div>
                  {report.status !== "aprovado" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        onReviewAnalytical({
                          id: Number(report.id),
                          narrative: report.narrative || "",
                          recommendations: report.recommendations || "",
                          status: "aprovado",
                        })
                      }
                    >
                      <CheckCircle2 className="mr-1" size={14} /> Aprovar
                    </Button>
                  ) : null}
                </div>
              ))}
              {!data?.analyticalReports?.length ? (
                <p className="p-4 text-sm text-slate-500">
                  Nenhum relatório analítico gerado.
                </p>
              ) : null}
            </div>
          </Section>

          <Section
            title="Integração com o PGR"
            description="Quando a análise médica indicar necessidade de reavaliação do risco, registre uma solicitação rastreável para o SESMT."
          >
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <Textarea
                value={reviewReason}
                onChange={event => setReviewReason(event.target.value)}
                placeholder="Descreva a divergência, tendência epidemiológica ou condição que exige reavaliação no PGR."
              />
              <Button
                className="self-end"
                variant="outline"
                disabled={reviewReason.trim().length < 10}
                onClick={() => {
                  onPgrReview({ description: reviewReason.trim() });
                  setReviewReason("");
                }}
              >
                <Send className="mr-1" size={14} /> Solicitar revisão
              </Button>
            </div>
            {(data?.reviewRequests || []).length ? (
              <div className="mt-4 divide-y border text-sm">
                {data.reviewRequests.map((request: any) => (
                  <div
                    className="grid gap-1 p-3 md:grid-cols-[1fr_auto]"
                    key={request.id}
                  >
                    <span>{request.description}</span>
                    <Badge variant="outline" className="w-fit rounded-sm">
                      {request.status || "aberta"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : null}
          </Section>

          <Section
            title="Documentos, assinatura e histórico"
            description="Anexos, versões, assinatura eletrônica e arquivamento preservam a rastreabilidade do programa."
            action={
              <div className="flex flex-wrap gap-2">
                {program.status !== "vigente" ? (
                  <Button disabled={busy} onClick={onSign}>
                    <ShieldCheck className="mr-1" size={14} /> Assinar e
                    publicar
                  </Button>
                ) : null}
                {program.status !== "arquivado" ? (
                  <Button disabled={busy} variant="outline" onClick={onArchive}>
                    <Archive className="mr-1" size={14} /> Arquivar
                  </Button>
                ) : null}
              </div>
            }
          >
            <div className="grid gap-6 md:grid-cols-2">
              <DocumentList
                empty="Nenhum anexo arquivado."
                rows={data?.annexes || []}
                render={row =>
                  `Anexo ${row.annex_number} · ${row.title || row.file_name}`
                }
                onOpen={row => onDownload("pcmso_annex", Number(row.id))}
              />
              <DocumentList
                empty="Nenhuma versão gerada."
                rows={data?.versions || []}
                render={row =>
                  `Versão ${row.version_number} · ${new Date(row.generated_at).toLocaleString("pt-BR")}`
                }
                onOpen={row => onDownload("pcmso_version", Number(row.id))}
              />
            </div>
          </Section>
        </>
      ) : null}
    </div>
  );
}

function DocumentList({
  rows,
  render,
  onOpen,
  empty,
}: {
  rows: any[];
  render: (row: any) => string;
  onOpen: (row: any) => void;
  empty: string;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">Arquivos</h3>
      <div className="divide-y border">
        {rows.map(row => (
          <button
            className="flex w-full items-center justify-between gap-3 p-3 text-left text-sm hover:bg-slate-50"
            key={row.id}
            onClick={() => onOpen(row)}
            type="button"
          >
            <span>{render(row)}</span>
            <Download className="shrink-0" size={14} />
          </button>
        ))}
        {!rows.length ? (
          <p className="p-3 text-sm text-slate-500">{empty}</p>
        ) : null}
      </div>
    </div>
  );
}

function MonitoringRow({
  row,
  exams,
  save,
}: {
  row: any;
  exams: any[];
  save: (payload: any) => void;
}) {
  const [kind, setKind] = useState(row.monitoring_kind || "nao_definido");
  const [name, setName] = useState(row.monitoring_name || "");
  const [examId, setExamId] = useState(Number(row.exam_id || 0));
  const [periodicity, setPeriodicity] = useState(row.periodicity || "");
  const [aggravations, setAggravations] = useState(
    row.possible_aggravations || ""
  );
  const [observations, setObservations] = useState(row.observations || "");
  const suggestionAvailable =
    row.suggestion_status === "revisar" &&
    Boolean(row.suggested_monitoring_kind);
  const decisionSaved =
    Boolean(row.decision_at) && row.monitoring_kind !== "nao_definido";

  useEffect(() => {
    setKind(row.monitoring_kind || "nao_definido");
    setName(row.monitoring_name || row.exam_name || "");
    setExamId(Number(row.exam_id || 0));
    setPeriodicity(row.periodicity || "");
    setAggravations(row.possible_aggravations || "");
    setObservations(row.observations || "");
  }, [row]);

  const submit = (suggestionStatus = "editada") =>
    save({
      id: Number(row.id),
      monitoringKind: kind,
      examId: kind === "exame_complementar" ? examId || null : null,
      monitoringName: name || undefined,
      possibleAggravations: aggravations || undefined,
      periodicity: periodicity || undefined,
      observations: observations || undefined,
      aiRationale: row.ai_rationale || undefined,
      suggestionStatus,
    });

  const acceptSuggestion = () => {
    const nextKind = row.suggested_monitoring_kind || "nao_definido";
    const nextName = row.suggested_monitoring_name || "";
    const nextPeriodicity = row.suggested_periodicity || "";
    setKind(nextKind);
    setName(nextName);
    setPeriodicity(nextPeriodicity);
    save({
      id: Number(row.id),
      monitoringKind: nextKind,
      examId: null,
      monitoringName: nextName || undefined,
      possibleAggravations: aggravations || undefined,
      periodicity: nextPeriodicity || undefined,
      observations: observations || undefined,
      aiRationale: row.ai_rationale || undefined,
      suggestionStatus: "aprovada",
    });
  };

  return (
    <div className="grid gap-4 p-4 xl:grid-cols-[1.05fr_1fr_1.15fr]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <b className="text-sm text-slate-950">{row.risk_name}</b>
          <Badge variant="outline" className="rounded-sm">
            {row.risk_classification || "Sem classificação"}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {row.risk_type || "Tipo não informado"}
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">
          {row.technical_detail ||
            "O PGR não possui detalhamento técnico para este risco."}
        </p>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-700">
          Possíveis agravos à saúde
          <Textarea
            className="mt-1 min-h-20"
            value={aggravations}
            onChange={event => setAggravations(event.target.value)}
            placeholder="Registre os possíveis agravos considerados pelo médico."
          />
        </label>
        {suggestionAvailable ? (
          <div className="mt-3 border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950">
            <div className="flex items-center gap-2 font-semibold">
              <Sparkles size={14} /> Sugestão assistida
            </div>
            <p className="mt-1">
              {row.suggested_monitoring_name || "Sem monitoramento sugerido"} ·{" "}
              {row.suggested_periodicity || "periodicidade a definir"}
            </p>
            <p className="mt-1 text-sky-800">{row.ai_rationale}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={acceptSuggestion}>
                Aceitar sugestão
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => submit("ignorada")}
              >
                Ignorar
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-2">
        {decisionSaved ? (
          <div className="flex items-center gap-2 border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
            <CheckCircle2 size={14} /> Decisão salva:{" "}
            {row.exam_name || row.monitoring_name || "controle definido"}
          </div>
        ) : null}
        <label className="text-xs font-semibold text-slate-700">
          Decisão médica
          <select
            className="mt-1 h-9 w-full border bg-white px-2 text-sm"
            value={kind}
            onChange={event => setKind(event.target.value)}
          >
            <option value="nao_definido">Pendente de decisão</option>
            <option value="avaliacao_clinica">Avaliação clínica</option>
            <option value="exame_complementar">Exame complementar</option>
            <option value="nao_aplicavel">
              Sem controle adicional aplicável
            </option>
          </select>
        </label>
        {kind !== "nao_definido" && kind !== "nao_aplicavel" ? (
          kind === "exame_complementar" ? (
            <label className="text-xs font-semibold text-slate-700">
              Exame do Catálogo Mestre
              <select
                className="mt-1 h-10 w-full border bg-white px-2 text-sm"
                value={examId}
                onChange={event => {
                  const selectedId = Number(event.target.value);
                  const selected = exams.find(
                    exam => Number(exam.id) === selectedId
                  );
                  setExamId(selectedId);
                  setName(selected?.name || "");
                  if (selected?.default_periodicity)
                    setPeriodicity(selected.default_periodicity);
                }}
              >
                <option value={0}>Pesquisar e selecionar exame...</option>
                {exams
                  .filter(
                    exam =>
                      Number(exam.is_active) &&
                      exam.exam_type === "complementar"
                  )
                  .map(exam => (
                    <option key={exam.id} value={exam.id}>
                      {exam.name} ·{" "}
                      {exam.default_periodicity || "periodicidade médica"}
                    </option>
                  ))}
              </select>
            </label>
          ) : (
            <div className="border border-sky-200 bg-sky-50 p-2 text-xs text-sky-900">
              Avaliação clínica ocupacional vinculada automaticamente ao
              Catálogo Mestre.
            </div>
          )
        ) : null}
        <label className="text-xs font-semibold text-slate-700">
          Periodicidade
          <Input
            className="mt-1"
            value={periodicity}
            onChange={event => setPeriodicity(event.target.value)}
            placeholder="Ex.: admissional e anual, conforme avaliação médica"
          />
        </label>
        <label className="text-xs font-semibold text-slate-700">
          Observação e critério
          <Textarea
            className="mt-1 min-h-16"
            value={observations}
            onChange={event => setObservations(event.target.value)}
          />
        </label>
        <Button
          disabled={kind === "exame_complementar" && !examId}
          onClick={() => submit("editada")}
        >
          <CheckCircle2 className="mr-1" size={14} /> Salvar decisão médica
        </Button>
      </div>
    </div>
  );
}
