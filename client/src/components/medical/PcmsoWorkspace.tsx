import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSearch,
  FileText,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
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
  onDeleteMonitoring: (id: number) => void;
  onGenerateAi: () => void;
  onAudit: () => void;
  onAnalyticalReport: (payload: {
    periodStart: string;
    periodEnd: string;
  }) => void;
  onReviewAnalytical: (payload: any) => void;
  onDiscardAnalytical: (payload: { id: number; reason: string }) => void;
  onPgrReview: (payload: {
    gseName?: string;
    riskName?: string;
    description: string;
  }) => void;
  onSign: () => void;
  onSave: () => void;
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
      descartado: "Descartado",
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
  onDeleteMonitoring,
  onGenerateAi,
  onAudit,
  onAnalyticalReport,
  onReviewAnalytical,
  onDiscardAnalytical,
  onPgrReview,
  onSign,
  onSave,
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
  const historical = Boolean(
    program && Number(program.is_current_version) !== 1
  );
  const locked = Boolean(
    program &&
      (historical || ["vigente", "arquivado"].includes(String(program.status)))
  );
  const monitoring = (data?.monitoring || []) as any[];
  const groups = useMemo(() => {
    const risks = new Map<string, any[]>();
    monitoring.forEach(row => {
      const key = String(row.source_monitoring_id || row.id);
      risks.set(key, [...(risks.get(key) || []), row]);
    });
    const result = new Map<
      string,
      Array<{ source: any; rows: any[]; items: any[] }>
    >();
    risks.forEach(rows => {
      const source = rows.find(row => Number(row.is_primary)) || rows[0];
      const item = {
        source,
        rows,
        items: rows.filter(row => row.monitoring_kind !== "nao_definido"),
      };
      const gseKey = source.gse_name || "GSE não identificado";
      result.set(gseKey, [...(result.get(gseKey) || []), item]);
    });
    return [...result.entries()];
  }, [monitoring]);
  const riskCount = groups.reduce(
    (total, [, risks]) => total + risks.length,
    0
  );
  const pending = groups.reduce(
    (total, [, risks]) =>
      total + risks.filter(risk => !risk.items.length).length,
    0
  );
  const latestAudit = data?.audits?.[0];
  const visiblePrograms = programs.filter(row => {
    if (programStatus === "todos") return true;
    if (programStatus === "andamento")
      return (
        Number(row.is_current_version) === 1 &&
        ["rascunho", "vigente", "em_revisao"].includes(row.status)
      );
    return row.status === programStatus;
  });

  useEffect(() => {
    const linked = Number(program?.pgr_id || 0);
    if (linked && pgrs.some(row => Number(row.id) === linked)) {
      setPgrId(linked);
      return;
    }
    if (!pgrId && pgrs.length) setPgrId(Number(pgrs[0].id));
  }, [program?.id, program?.pgr_id, pgrs, pgrId]);

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
                      ? Number(row.is_current_version) === 1 &&
                        ["vigente", "em_revisao"].includes(row.status)
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
                {statusLabel(row.status)} ·{" "}
                {Number(row.revision_number || 0)
                  ? `revisão ${String(row.revision_number).padStart(2, "0")}`
                  : "emissão original"}
                {Number(row.is_current_version) === 1
                  ? " · atual"
                  : " · histórico"}
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
          {locked ? (
            <div className="flex gap-3 border border-slate-300 bg-slate-50 p-4 text-sm text-slate-800">
              <Archive className="mt-0.5 shrink-0" size={18} />
              <div>
                <b>Documento preservado em modo de consulta.</b>
                <p className="mt-1">
                  PCMSOs vigentes e versões históricas não são alterados
                  retroativamente. Use o fluxo de revisão quando houver mudança
                  do PGR.
                </p>
              </div>
            </div>
          ) : null}
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
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onEdit}
                  disabled={locked}
                >
                  Editar conteúdo
                </Button>
                <Button size="sm" disabled={busy || locked} onClick={onSave}>
                  <Save className="mr-1" size={14} /> Salvar PCMSO
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onAnnex}
                  disabled={locked}
                >
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
              <Metric label="Riscos importados" value={riskCount} />
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
                      PGR vigente · {row.title}
                      {row.exercise_year ? ` · ${row.exercise_year}` : ""}
                      {Number(row.revision_number || 0)
                        ? ` · revisão ${String(row.revision_number).padStart(2, "0")}`
                        : ""}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  disabled={!pgrId || busy || locked}
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
                        <b className="block">{riskCount}</b>
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
                  disabled={busy || locked}
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
              {groups.map(([gseName, risks]) => (
                <div className="border" key={gseName}>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-4 py-3">
                    <div>
                      <div className="text-xs font-semibold uppercase text-teal-700">
                        GSE
                      </div>
                      <h3 className="font-semibold">{gseName}</h3>
                    </div>
                    <Badge variant="outline" className="rounded-sm">
                      {risks.length} risco(s)
                    </Badge>
                  </div>
                  <div className="divide-y">
                    {risks.map(risk => (
                      <RiskMonitoringRow
                        key={risk.source.id}
                        risk={risk}
                        exams={exams}
                        save={onDecision}
                        remove={onDeleteMonitoring}
                        readOnly={locked}
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
                disabled={
                  busy || !periodStart || !periodEnd || periodEnd < periodStart
                }
                onClick={() => onAnalyticalReport({ periodStart, periodEnd })}
              >
                <FileText className="mr-1" size={14} /> Gerar relatório
              </Button>
            </div>
            {periodStart && periodEnd && periodEnd < periodStart ? (
              <p className="mt-2 text-xs font-medium text-rose-700">
                A data final deve ser igual ou posterior à data inicial.
              </p>
            ) : null}
            <div className="mt-4 divide-y border">
              {(data?.analyticalReports || []).map((report: any) => (
                <div
                  className={`grid gap-3 p-3 md:grid-cols-[1fr_auto] ${report.status === "descartado" ? "bg-slate-50 opacity-70" : ""}`}
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
                    {report.metrics?.exams ? (
                      <p className="mt-2 text-xs font-medium text-teal-800">
                        {Number(report.metrics.exams.plannedAssignments || 0)}{" "}
                        procedimento(s) previsto(s) ·{" "}
                        {Number(report.metrics.exams.workers || 0)}{" "}
                        trabalhador(es) ·{" "}
                        {Number(report.metrics.exams.performed || 0)}{" "}
                        resultado(s)
                      </p>
                    ) : null}
                    {report.status === "descartado" ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Versão descartada:{" "}
                        {report.discard_reason ||
                          "motivo registrado na auditoria"}
                        .
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2">
                    {!["aprovado", "descartado"].includes(report.status) ? (
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
                    {report.status !== "descartado" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-rose-700"
                        onClick={() => {
                          const reason = window.prompt(
                            "Confirme o descarte informando o motivo. O histórico de auditoria será preservado."
                          );
                          if (reason && reason.trim().length >= 10)
                            onDiscardAnalytical({
                              id: Number(report.id),
                              reason: reason.trim(),
                            });
                        }}
                      >
                        <Trash2 className="mr-1" size={14} /> Descartar
                      </Button>
                    ) : null}
                  </div>
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
                {!locked && program.status !== "vigente" ? (
                  <Button disabled={busy} onClick={onSign}>
                    <ShieldCheck className="mr-1" size={14} /> Assinar e
                    publicar
                  </Button>
                ) : null}
                {!historical && program.status !== "arquivado" ? (
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

function RiskMonitoringRow({
  risk,
  exams,
  save,
  remove,
  readOnly = false,
}: {
  risk: { source: any; rows: any[]; items: any[] };
  exams: any[];
  save: (payload: any) => void;
  remove: (id: number) => void;
  readOnly?: boolean;
}) {
  const { source, items } = risk;
  const [aggravations, setAggravations] = useState(
    source.possible_aggravations || ""
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedExam, setSelectedExam] = useState("");
  const [periodicity, setPeriodicity] = useState("");
  const [observations, setObservations] = useState("");
  const [usingSuggestion, setUsingSuggestion] = useState(false);
  const suggestionAvailable =
    source.suggestion_status === "revisar" &&
    Boolean(source.suggested_monitoring_kind);
  const activeExams = exams.filter(exam => Number(exam.is_active));

  useEffect(() => {
    setAggravations(source.possible_aggravations || "");
  }, [source.id, source.possible_aggravations]);

  const resetEditor = () => {
    setEditorOpen(false);
    setEditingId(null);
    setSelectedExam("");
    setPeriodicity("");
    setObservations("");
    setUsingSuggestion(false);
  };

  const openNew = () => {
    setEditingId(items.length ? null : Number(source.id));
    setSelectedExam("");
    setPeriodicity("");
    setObservations("");
    setUsingSuggestion(false);
    setEditorOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingId(Number(item.id));
    setSelectedExam(
      item.monitoring_kind === "nao_aplicavel"
        ? "__not_applicable"
        : item.exam_id
          ? String(item.exam_id)
          : "__clinical"
    );
    setPeriodicity(item.periodicity || "");
    setObservations(item.observations || "");
    setUsingSuggestion(item.suggestion_status === "aprovada");
    setEditorOpen(true);
  };

  const useSuggestion = () => {
    const suggestedName = String(source.suggested_monitoring_name || "")
      .trim()
      .toLocaleLowerCase("pt-BR");
    const matchingExam = activeExams.find(
      exam =>
        String(exam.name || "")
          .trim()
          .toLocaleLowerCase("pt-BR") === suggestedName
    );
    setEditingId(items.length ? null : Number(source.id));
    setSelectedExam(
      matchingExam
        ? String(matchingExam.id)
        : source.suggested_monitoring_kind === "avaliacao_clinica"
          ? "__clinical"
          : ""
    );
    setPeriodicity(source.suggested_periodicity || "");
    setObservations("");
    setUsingSuggestion(true);
    setEditorOpen(true);
  };

  const submit = () => {
    const selected = activeExams.find(
      exam => Number(exam.id) === Number(selectedExam)
    );
    const monitoringKind =
      selectedExam === "__not_applicable"
        ? "nao_aplicavel"
        : selectedExam === "__clinical" || selected?.exam_type === "clinico"
          ? "avaliacao_clinica"
          : "exame_complementar";
    save({
      ...(editingId ? { id: editingId } : { sourceId: Number(source.id) }),
      monitoringKind,
      examId: selected ? Number(selected.id) : null,
      monitoringName: selected?.name || undefined,
      possibleAggravations: aggravations || undefined,
      periodicity: periodicity || undefined,
      observations: observations || undefined,
      aiRationale: usingSuggestion
        ? source.ai_rationale || undefined
        : undefined,
      suggestionStatus: usingSuggestion ? "aprovada" : "editada",
    });
    resetEditor();
  };

  const selectedCatalogExam = activeExams.find(
    exam => Number(exam.id) === Number(selectedExam)
  );
  const canSave = Boolean(
    selectedExam && (selectedExam.startsWith("__") || selectedCatalogExam)
  );

  return (
    <div className="grid gap-4 p-4 xl:grid-cols-[1fr_1fr_1.25fr]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <b className="text-sm text-slate-950">{source.risk_name}</b>
          <Badge variant="outline" className="rounded-sm">
            {source.risk_classification || "Sem classificação"}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {source.risk_type || "Tipo não informado"}
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">
          {source.technical_detail ||
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
            disabled={readOnly}
          />
        </label>
        {suggestionAvailable ? (
          <div className="mt-3 border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950">
            <div className="flex items-center gap-2 font-semibold">
              <Sparkles size={14} /> Sugestão assistida
            </div>
            <p className="mt-1">
              {source.suggested_monitoring_name || "Sem monitoramento sugerido"}{" "}
              · {source.suggested_periodicity || "periodicidade a definir"}
            </p>
            <p className="mt-1 text-sky-800">{source.ai_rationale}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={useSuggestion} disabled={readOnly}>
                Usar na inclusão
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={readOnly}
                onClick={() =>
                  save({
                    id: Number(source.id),
                    monitoringKind: "nao_definido",
                    suggestionStatus: "ignorada",
                  })
                }
              >
                Ignorar
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-950">
              Exames e avaliações
            </h4>
            <p className="text-xs text-slate-500">
              {items.length
                ? `${items.length} procedimento(s) definido(s)`
                : "Nenhum procedimento definido"}
            </p>
          </div>
          <Button size="sm" onClick={openNew} disabled={readOnly}>
            <Plus className="mr-1" size={14} /> Adicionar exame/avaliação
          </Button>
        </div>

        <div className="divide-y border">
          {items.map(item => (
            <div
              className="grid min-h-16 grid-cols-[1fr_auto] items-center gap-3 p-3"
              key={item.id}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-sm text-slate-900">
                    {item.exam_name ||
                      item.monitoring_name ||
                      "Controle definido"}
                  </b>
                  <Badge variant="outline" className="rounded-sm text-[10px]">
                    {item.monitoring_kind === "avaliacao_clinica"
                      ? "Avaliação clínica"
                      : item.monitoring_kind === "nao_aplicavel"
                        ? "Não aplicável"
                        : "Exame complementar"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {item.periodicity || "Periodicidade definida pelo médico"}
                  {item.observations ? ` · ${item.observations}` : ""}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  aria-label="Editar exame/avaliação"
                  size="icon"
                  title="Editar exame/avaliação"
                  variant="ghost"
                  disabled={readOnly}
                  onClick={() => openEdit(item)}
                >
                  <Pencil size={15} />
                </Button>
                <Button
                  aria-label="Excluir exame/avaliação"
                  className="text-rose-700"
                  size="icon"
                  title="Excluir exame/avaliação"
                  variant="ghost"
                  disabled={readOnly}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Excluir este exame/avaliação do risco? O histórico da ação será preservado."
                      )
                    )
                      remove(Number(item.id));
                  }}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            </div>
          ))}
          {!items.length ? (
            <div className="p-4 text-center text-sm text-amber-800">
              Pendente de decisão médica.
            </div>
          ) : null}
        </div>

        {editorOpen ? (
          <div className="mt-3 border border-teal-300 bg-teal-50/40 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <b className="text-sm text-slate-950">
                {editingId && items.some(item => Number(item.id) === editingId)
                  ? "Editar exame/avaliação"
                  : "Adicionar exame/avaliação"}
              </b>
              <Button size="sm" variant="ghost" onClick={resetEditor}>
                Cancelar
              </Button>
            </div>
            <div className="grid gap-3">
              <label className="text-xs font-semibold text-slate-700">
                Exame ou avaliação
                <select
                  className="mt-1 h-10 w-full border bg-white px-2 text-sm"
                  value={selectedExam}
                  onChange={event => {
                    const value = event.target.value;
                    const selected = activeExams.find(
                      exam => Number(exam.id) === Number(value)
                    );
                    setSelectedExam(value);
                    if (selected?.default_periodicity)
                      setPeriodicity(selected.default_periodicity);
                  }}
                >
                  <option value="">Selecione no Catálogo Mestre...</option>
                  <option value="__clinical">
                    Avaliação clínica ocupacional
                  </option>
                  {activeExams.map(exam => (
                    <option key={exam.id} value={exam.id}>
                      {exam.name} ·{" "}
                      {exam.exam_type === "clinico"
                        ? "avaliação clínica"
                        : "exame complementar"}
                    </option>
                  ))}
                  <option value="__not_applicable">
                    Sem exame/avaliação adicional aplicável
                  </option>
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Periodicidade
                <Input
                  className="mt-1"
                  value={periodicity}
                  onChange={event => setPeriodicity(event.target.value)}
                  placeholder="Ex.: anual"
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
              <Button disabled={!canSave} onClick={submit}>
                <Save className="mr-1" size={14} /> Salvar exame/avaliação
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
