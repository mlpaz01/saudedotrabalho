import { useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  BarChart3,
  Download,
  FileCheck2,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";

function downloadDataUri(dataUri: string, fileName: string) {
  const link = document.createElement("a");
  link.href = dataUri;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function dateValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default function AdminPcmsoAnalyticalReports() {
  const now = new Date();
  const [pcmsoId, setPcmsoId] = useState<number>(0);
  const [periodStart, setPeriodStart] = useState(`${now.getFullYear()}-01-01`);
  const [periodEnd, setPeriodEnd] = useState(dateValue(now));
  const workspace = (trpc.medical as any).analyticalReportWorkspace.useQuery();
  const generate = (trpc.medical as any).generateAnalyticalReport.useMutation({
    onSuccess: () => {
      toast.success("Relatório analítico preliminar gerado.");
      workspace.refetch();
    },
    onError: (error: any) =>
      toast.error(error?.message || "Não foi possível gerar o relatório."),
  });
  const pdf = (trpc.medical as any).generateAnalyticalReportPdf.useMutation({
    onSuccess: (result: any) => {
      downloadDataUri(result.dataBase64, result.fileName);
      toast.success("PDF gerado e arquivado.");
      workspace.refetch();
    },
    onError: (error: any) =>
      toast.error(error?.message || "Não foi possível gerar o PDF."),
  });
  const discard = (trpc.medical as any).discardAnalyticalReport.useMutation({
    onSuccess: () => {
      toast.success("Versão descartada. O histórico de auditoria foi preservado.");
      workspace.refetch();
    },
    onError: (error: any) =>
      toast.error(error?.message || "Não foi possível descartar o relatório."),
  });

  const programs = (workspace.data?.programs || []) as any[];
  const reports = (workspace.data?.reports || []) as any[];
  const selectedProgramId = pcmsoId || Number(programs[0]?.id || 0);
  const activeReports = reports.filter(row => row.status !== "descartado");
  const totals = useMemo(
    () => ({
      reports: activeReports.length,
      workers: activeReports.reduce(
        (sum, row) => sum + Number(row.metrics?.exams?.workers || 0),
        0
      ),
      pending: activeReports.reduce(
        (sum, row) => sum + Number(row.metrics?.orders?.pending || 0),
        0
      ),
    }),
    [activeReports]
  );

  return (
    <AppLayout>
      <main className="mx-auto max-w-7xl space-y-5 p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
              <FileCheck2 className="text-teal-600" size={24} />
              Relatório Analítico Anual do PCMSO
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Documento independente que consolida PGR, GSE, população,
              procedimentos previstos, resultados, ASOs, afastamentos e
              acompanhamentos do período.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => workspace.refetch()}
            disabled={workspace.isFetching}
            title="Atualizar dados"
          >
            <RefreshCw
              size={15}
              className={workspace.isFetching ? "animate-spin" : ""}
            />
            Atualizar
          </Button>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          {[
            ["Relatórios válidos", totals.reports],
            ["Trabalhadores consolidados", totals.workers],
            ["Requisições pendentes", totals.pending],
          ].map(([label, value]) => (
            <div key={label} className="border bg-white p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">
                {label}
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </section>

        <section className="border bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 size={18} className="text-teal-600" />
            <h2 className="font-semibold">Gerar consolidação por período</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
            <label className="text-sm font-medium">
              PCMSO
              <select
                value={selectedProgramId || ""}
                onChange={event => setPcmsoId(Number(event.target.value))}
                className="mt-1 w-full border px-3 py-2"
              >
                {!programs.length && <option value="">Nenhum PCMSO</option>}
                {programs.map(program => (
                  <option key={program.id} value={program.id}>
                    {program.title} · {program.status}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Data inicial
              <Input
                className="mt-1"
                type="date"
                value={periodStart}
                onChange={event => setPeriodStart(event.target.value)}
              />
            </label>
            <label className="text-sm font-medium">
              Data final
              <Input
                className="mt-1"
                type="date"
                value={periodEnd}
                onChange={event => setPeriodEnd(event.target.value)}
              />
            </label>
            <Button
              disabled={
                !selectedProgramId ||
                !periodStart ||
                !periodEnd ||
                generate.isPending
              }
              onClick={() =>
                generate.mutate({
                  pcmsoId: selectedProgramId,
                  periodStart,
                  periodEnd,
                })
              }
            >
              {generate.isPending ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <BarChart3 size={15} />
              )}
              Gerar relatório
            </Button>
          </div>
          <p className="mt-3 text-xs text-amber-700">
            A geração cria uma consolidação preliminar. Aprovação e conclusão
            médica permanecem sob responsabilidade do médico vinculado ao PCMSO.
          </p>
        </section>

        <section className="overflow-hidden border bg-white">
          <div className="border-b bg-slate-50 px-5 py-3">
            <h2 className="font-semibold">Histórico dos relatórios</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500">
                  <th className="p-3">PCMSO / PGR</th>
                  <th className="p-3">Período</th>
                  <th className="p-3 text-center">Trabalhadores</th>
                  <th className="p-3 text-center">Previstos</th>
                  <th className="p-3 text-center">Realizados</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Documento</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(report => (
                  <tr key={report.id} className="border-t align-top">
                    <td className="p-3">
                      <b>{report.pcmso_title}</b>
                      <small className="block text-slate-500">
                        {report.pgr_title || "PGR não identificado"}
                      </small>
                    </td>
                    <td className="p-3">
                      {new Date(report.period_start).toLocaleDateString(
                        "pt-BR"
                      )}{" "}
                      a{" "}
                      {new Date(report.period_end).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="p-3 text-center">
                      {Number(report.metrics?.exams?.workers || 0)}
                    </td>
                    <td className="p-3 text-center">
                      {Number(report.metrics?.exams?.plannedAssignments || 0)}
                    </td>
                    <td className="p-3 text-center">
                      {Number(report.metrics?.exams?.performed || 0)}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold ${
                          report.status === "aprovado"
                            ? "bg-emerald-50 text-emerald-700"
                            : report.status === "descartado"
                              ? "bg-slate-100 text-slate-500"
                              : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {String(report.status).replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {report.status !== "descartado" && (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pdf.isPending}
                            onClick={() => pdf.mutate({ id: Number(report.id) })}
                          >
                            {pdf.isPending ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Download size={14} />
                            )}
                            PDF
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            title="Descartar esta versão"
                            disabled={discard.isPending}
                            onClick={() => {
                              const reason = window.prompt(
                                "Informe o motivo do descarte desta versão:"
                              );
                              if (reason && reason.trim().length >= 10)
                                discard.mutate({
                                  id: Number(report.id),
                                  reason: reason.trim(),
                                });
                              else if (reason !== null)
                                toast.error("Informe um motivo com pelo menos 10 caracteres.");
                            }}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {!reports.length && !workspace.isLoading && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-500">
                      Nenhum relatório gerado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </AppLayout>
  );
}
