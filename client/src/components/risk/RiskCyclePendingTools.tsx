import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Download,
  FileSearch,
  Loader2,
  LockKeyhole,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Filters = { branchId?: number; sectorId?: number; position?: string };
const emptyFilters: Filters = {};
const formatTimestamp = (value: unknown) =>
  value ? new Date(String(value)).toLocaleString("pt-BR") : "-";

function FilterFields({
  filters,
  setFilters,
  sectors,
  positions = [],
}: {
  filters: Filters;
  setFilters: (next: Filters) => void;
  sectors: any[];
  positions?: string[];
}) {
  const branches = useMemo(
    () =>
      Array.from(
        new Map(
          sectors
            .filter(item => item.branchId)
            .map(item => [
              Number(item.branchId),
              item.branchName || `Filial ${item.branchId}`,
            ])
        ).entries()
      ),
    [sectors]
  );
  const visibleSectors = filters.branchId
    ? sectors.filter(item => Number(item.branchId) === filters.branchId)
    : sectors;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="text-xs font-medium text-slate-700">
        Filial
        <select
          className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm"
          value={filters.branchId ?? ""}
          onChange={event =>
            setFilters({
              ...filters,
              branchId: event.target.value
                ? Number(event.target.value)
                : undefined,
              sectorId: undefined,
            })
          }
        >
          <option value="">Todas</option>
          {branches.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium text-slate-700">
        Setor
        <select
          className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm"
          value={filters.sectorId ?? ""}
          onChange={event =>
            setFilters({
              ...filters,
              sectorId: event.target.value
                ? Number(event.target.value)
                : undefined,
            })
          }
        >
          <option value="">Todos</option>
          {visibleSectors.map(item => (
            <option key={item.sectorId} value={item.sectorId}>
              {item.sectorName}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium text-slate-700">
        Cargo
        <select
          className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm"
          value={filters.position ?? ""}
          onChange={event =>
            setFilters({
              ...filters,
              position: event.target.value || undefined,
            })
          }
        >
          <option value="">Todos</option>
          {positions.map(position => (
            <option key={position} value={position}>
              {position}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function RiskCyclePendingTools({
  assessmentId,
  sectors,
  onSent,
}: {
  assessmentId: number;
  sectors: any[];
  onSent?: () => void;
}) {
  const [drpsOpen, setDrpsOpen] = useState(false);
  const [aepOpen, setAepOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [reportFilters, setReportFilters] = useState<
    Filters & {
      aepStatus: "todos" | "pendente" | "concluido";
      dateFrom?: string;
      dateTo?: string;
    }
  >({ aepStatus: "todos" });

  const participationQ = (
    trpc.riskAssessment as any
  ).drpsParticipation.useQuery(
    { assessmentId, targetPercent: 90 },
    { enabled: drpsOpen }
  );
  const participation = participationQ.data as any;

  const targetsQ = (
    trpc.riskAssessment as any
  ).pendingSurveyTargets.useQuery(
    { assessmentId, target: "aep", ...filters },
    { enabled: aepOpen }
  );
  const targets = (targetsQ.data ?? []) as any[];
  const selected = targets.filter(row => !excluded.has(Number(row.userId)));
  const positions = useMemo(
    () =>
      Array.from(
        new Set(targets.map(row => String(row.position || "")).filter(Boolean))
      ).sort(),
    [targets]
  );
  useEffect(
    () => setExcluded(new Set()),
    [filters.branchId, filters.sectorId, filters.position]
  );

  const send = (
    trpc.riskAssessment as any
  ).sendPendingSurveyReminder.useMutation({
    onSuccess: (result: any) => {
      toast.success(
        result.sent
          ? `Comunicação enviada para ${result.sent} destinatário(s).`
          : "Nenhum destinatário disponível."
      );
      setDrpsOpen(false);
      setAepOpen(false);
      onSent?.();
    },
    onError: (error: any) =>
      toast.error(error?.message || "Não foi possível enviar a comunicação."),
  });

  const reportQ = (trpc.riskAssessment as any).pendingReport.useQuery(
    {
      assessmentId,
      ...reportFilters,
      drpsStatus: "todos",
      situation: "todos",
    },
    { enabled: reportOpen }
  );
  const report = (reportQ.data ?? []) as any[];
  const reportPositions = useMemo(
    () =>
      Array.from(
        new Set(report.map(row => String(row.position || "")).filter(Boolean))
      ).sort(),
    [report]
  );

  function downloadCsv() {
    const headers = [
      "Funcionário",
      "Identificador",
      "Ciclo",
      "Filial",
      "Setor",
      "Cargo",
      "Status AEP",
      "Data de envio",
      "Data de preenchimento",
      "Situação",
    ];
    const rows = report.map(row => [
      row.name,
      row.identifier,
      row.cycleName,
      row.branchName || "",
      row.sectorName || "",
      row.position || "",
      row.aepStatus,
      row.aepSentAt || "",
      row.aepCompletedAt || "",
      row.situation,
    ]);
    const quote = (value: unknown) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv =
      "\uFEFF" +
      [headers, ...rows].map(row => row.map(quote).join(";")).join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `pendencias_aep_ciclo_${assessmentId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="gap-1"
        onClick={() => setDrpsOpen(true)}
      >
        <BarChart3 size={13} /> Participação DRPS
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="gap-1"
        onClick={() => {
          setFilters(emptyFilters);
          setAepOpen(true);
        }}
      >
        <AlertTriangle size={13} /> Cobrar AEP
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="gap-1"
        onClick={() => setReportOpen(true)}
      >
        <FileSearch size={13} /> Pendências AEP
      </Button>

      <Dialog open={drpsOpen} onOpenChange={setDrpsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LockKeyhole size={18} /> Participação anônima no DRPS
            </DialogTitle>
            <DialogDescription>
              A plataforma não identifica respondentes ou não respondentes. O
              acompanhamento é exclusivamente agregado.
            </DialogDescription>
          </DialogHeader>
          {participationQ.isLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  ["Elegíveis", participation?.eligible ?? 0],
                  ["Respostas", participation?.responses ?? 0],
                  ["Participação", `${participation?.participationPercent ?? 0}%`],
                  ["Meta", `${participation?.targetPercent ?? 90}%`],
                  ["Faltam para a meta", participation?.responsesToTarget ?? 0],
                ].map(([label, value]) => (
                  <div key={String(label)} className="border bg-slate-50 p-3">
                    <div className="text-xl font-bold text-primary">{value}</div>
                    <div className="mt-1 text-xs text-slate-500">{label}</div>
                  </div>
                ))}
              </div>
              <div className="border-l-4 border-emerald-500 bg-emerald-50 p-3 text-sm text-emerald-950">
                O lembrete será enviado para todo o público elegível com e-mail
                cadastrado ({participation?.reachable ?? 0} destinatários), sem
                comparar a lista com as respostas recebidas.
              </div>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDrpsOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={
                !participation?.reachable ||
                participationQ.isLoading ||
                send.isPending
              }
              onClick={() =>
                send.mutate({
                  assessmentId,
                  target: "drps",
                  expectedRecipients: Number(participation?.reachable || 0),
                  confirmAudience: true,
                })
              }
            >
              {send.isPending ? (
                <Loader2 className="mr-2 animate-spin" size={15} />
              ) : (
                <Send className="mr-2" size={15} />
              )}
              Enviar lembrete geral
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={aepOpen} onOpenChange={setAepOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Cobrança segmentada da AEP</DialogTitle>
            <DialogDescription>
              A AEP permite acompanhamento individual. Filtre, selecione e
              confira o público antes de enviar.
            </DialogDescription>
          </DialogHeader>
          <FilterFields
            filters={filters}
            setFilters={setFilters}
            sectors={sectors}
            positions={positions}
          />
          <div className="border bg-slate-50 px-3 py-2 text-sm font-semibold">
            {selected.length} gestor(es) serão cobrados.
          </div>
          <div className="max-h-72 overflow-auto border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b">
                  <th className="w-10 p-2">
                    <input
                      type="checkbox"
                      checked={
                        targets.length > 0 && selected.length === targets.length
                      }
                      onChange={event =>
                        setExcluded(
                          event.target.checked
                            ? new Set()
                            : new Set(targets.map(row => Number(row.userId)))
                        )
                      }
                    />
                  </th>
                  <th className="p-2 text-left">Gestor</th>
                  <th className="p-2 text-left">Filial / Setor</th>
                  <th className="p-2 text-left">Cargo</th>
                </tr>
              </thead>
              <tbody>
                {targets.map(row => (
                  <tr key={row.userId} className="border-b last:border-0">
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={!excluded.has(Number(row.userId))}
                        onChange={event =>
                          setExcluded(old => {
                            const next = new Set(old);
                            event.target.checked
                              ? next.delete(Number(row.userId))
                              : next.add(Number(row.userId));
                            return next;
                          })
                        }
                      />
                    </td>
                    <td className="p-2">
                      <b>{row.name}</b>
                      <div className="text-xs text-slate-500">{row.email}</div>
                    </td>
                    <td className="p-2">
                      {row.branchName || "-"} / {row.sectorName || "-"}
                    </td>
                    <td className="p-2">{row.position || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!targetsQ.isLoading && !targets.length && (
              <p className="p-6 text-center text-sm text-slate-500">
                Nenhuma pendência de AEP encontrada.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAepOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!selected.length || send.isPending}
              onClick={() =>
                send.mutate({
                  assessmentId,
                  target: "aep",
                  ...filters,
                  userIds: selected.map(row => Number(row.userId)),
                  expectedRecipients: selected.length,
                  confirmAudience: true,
                })
              }
            >
              {send.isPending ? (
                <Loader2 className="mr-2 animate-spin" size={15} />
              ) : (
                <Send className="mr-2" size={15} />
              )}
              Enviar cobrança
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Relatório individual de pendências AEP</DialogTitle>
            <DialogDescription>
              O DRPS não integra este relatório porque suas respostas são
              anônimas. A identificação individual é restrita à AEP.
            </DialogDescription>
          </DialogHeader>
          <FilterFields
            filters={reportFilters}
            setFilters={next => setReportFilters({ ...reportFilters, ...next })}
            sectors={sectors}
            positions={reportPositions}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <select
              className="border px-2 py-2 text-sm"
              value={reportFilters.aepStatus}
              onChange={event =>
                setReportFilters({
                  ...reportFilters,
                  aepStatus: event.target.value as any,
                })
              }
            >
              <option value="todos">AEP: todos</option>
              <option value="pendente">AEP pendente</option>
              <option value="concluido">AEP concluída</option>
            </select>
            <Input
              type="date"
              value={reportFilters.dateFrom || ""}
              onChange={event =>
                setReportFilters({
                  ...reportFilters,
                  dateFrom: event.target.value || undefined,
                })
              }
              aria-label="Período inicial"
            />
            <Input
              type="date"
              value={reportFilters.dateTo || ""}
              onChange={event =>
                setReportFilters({
                  ...reportFilters,
                  dateTo: event.target.value || undefined,
                })
              }
              aria-label="Período final"
            />
          </div>
          <div className="max-h-[48vh] overflow-auto border">
            <table className="w-full min-w-[900px] text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b">
                  <th className="p-2 text-left">Funcionário</th>
                  <th className="p-2 text-left">Identificador</th>
                  <th className="p-2 text-left">Filial / Setor</th>
                  <th className="p-2 text-left">Cargo</th>
                  <th className="p-2 text-left">AEP</th>
                  <th className="p-2">Situação</th>
                </tr>
              </thead>
              <tbody>
                {report.map(row => (
                  <tr key={row.userId} className="border-b">
                    <td className="p-2 font-medium">{row.name}</td>
                    <td className="p-2">{row.identifier}</td>
                    <td className="p-2">
                      {row.branchName || "-"} / {row.sectorName || "-"}
                    </td>
                    <td className="p-2">{row.position || "-"}</td>
                    <td className="p-2">
                      <b>{row.aepStatus}</b>
                      <div className="text-[10px] text-slate-500">
                        Envio: {formatTimestamp(row.aepSentAt)}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Preenchimento: {formatTimestamp(row.aepCompletedAt)}
                      </div>
                    </td>
                    <td className="p-2 text-center font-semibold">
                      {row.situation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!reportQ.isLoading && !report.length && (
              <p className="p-6 text-center text-sm text-slate-500">
                Nenhum registro encontrado.
              </p>
            )}
          </div>
          <DialogFooter>
            <div className="mr-auto text-sm text-slate-600">
              {report.length} registro(s)
            </div>
            <Button variant="outline" onClick={() => setReportOpen(false)}>
              Fechar
            </Button>
            <Button onClick={downloadCsv} disabled={!report.length}>
              <Download className="mr-2" size={15} /> Exportar CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
