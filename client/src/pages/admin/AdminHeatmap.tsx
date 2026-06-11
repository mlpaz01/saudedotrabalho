import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import {
  Activity, AlertTriangle, CheckCircle2, Layers, ShieldAlert, TrendingUp,
} from "lucide-react";

const RISCO_BG: Record<string, string> = {
  critico: "bg-rose-600",
  alto:    "bg-orange-400",
  medio:   "bg-amber-300",
  baixo:   "bg-emerald-400",
};
const RISCO_LABEL: Record<string, string> = {
  critico: "Crítico",
  alto:    "Alto",
  medio:   "Médio",
  baixo:   "Baixo",
};

function KpiCard({
  label, value, sub, Icon, color,
}: {
  label: string; value: number | string; sub?: string;
  Icon: React.ComponentType<{ className?: string }>; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${color} shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-sm font-medium text-slate-600">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function AdminHeatmap() {
  const kpisQ   = trpc.heatmap.getSSTKpis.useQuery({});
  const heatQ   = trpc.heatmap.getOrgHeatmap.useQuery({});

  const kpis    = kpisQ.data;
  const heatmap = heatQ.data;
  const loading = kpisQ.isLoading || heatQ.isLoading;

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-screen-xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Activity className="w-6 h-6 text-rose-600" />
            Dashboard SST — Heatmap Organizacional
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Visão consolidada dos fatores de risco psicossocial por setor da empresa
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* KPI Cards */}
        {!loading && kpis && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Avaliações realizadas"
              value={kpis.totalAssessments}
              sub="ciclos de análise"
              Icon={Layers}
              color="bg-blue-500"
            />
            <KpiCard
              label="Fatores críticos"
              value={kpis.criticalFactors}
              sub="risco final = crítico"
              Icon={ShieldAlert}
              color="bg-rose-600"
            />
            <KpiCard
              label="Fatores altos"
              value={kpis.highFactors}
              sub="risco final = alto"
              Icon={AlertTriangle}
              color="bg-orange-500"
            />
            <KpiCard
              label="Ações de prevenção"
              value={kpis.actionPlanItems}
              sub="planos cadastrados"
              Icon={CheckCircle2}
              color="bg-emerald-600"
            />
          </div>
        )}

        {/* Heatmap */}
        {!loading && heatmap && heatmap.rows.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
              <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-rose-500" />
                Mapa de Calor por Setor × Fator de Risco
              </h2>
              {/* Legend */}
              <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                {(["critico", "alto", "medio", "baixo"] as const).map(k => (
                  <span key={k} className="flex items-center gap-1.5">
                    <span className={`w-3 h-3 rounded-sm inline-block ${RISCO_BG[k]}`} />
                    {RISCO_LABEL[k]}
                  </span>
                ))}
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm inline-block bg-slate-100 border border-slate-200" />
                  Não avaliado
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 min-w-[200px] sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                      Setor / Ciclo
                    </th>
                    {heatmap.factors.map(f => (
                      <th
                        key={f.id}
                        className="px-2 py-2 font-medium text-slate-600 text-center min-w-[68px] max-w-[80px]"
                        title={f.name}
                      >
                        <span className="block truncate text-[10px]">{f.code}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmap.rows.map((row, i) => (
                    <tr
                      key={row.assessmentId}
                      className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}
                    >
                      <td className="px-4 py-2.5 sticky left-0 bg-inherit z-10 border-r border-slate-200">
                        <p className="font-medium text-slate-700 truncate max-w-[180px]">
                          {row.sectorName || "Empresa (geral)"}
                        </p>
                        <p className="text-slate-400 text-[10px] truncate max-w-[180px]">
                          {row.cycleName}
                          {row.branchName ? ` · ${row.branchName}` : ""}
                        </p>
                      </td>
                      {heatmap.factors.map(f => {
                        const cell = row.cells.find(c => c.factorId === f.id);
                        const risco = cell?.risco ?? null;
                        return (
                          <td key={f.id} className="px-1 py-1.5 text-center">
                            {risco ? (
                              <span
                                className={`inline-flex items-center justify-center w-full h-6 rounded text-[10px] font-bold text-white ${RISCO_BG[risco] ?? "bg-slate-400"}`}
                                title={`${f.name}: ${RISCO_LABEL[risco] ?? risco}`}
                              >
                                {(RISCO_LABEL[risco] ?? risco).slice(0, 2)}
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center justify-center w-full h-6 rounded bg-slate-100 border border-slate-200"
                                title={`${f.name}: não avaliado`}
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Cada coluna representa um fator psicossocial (código). Passe o mouse sobre a célula para ver o nome
                completo e o nível de risco. Células em branco indicam fator não avaliado naquele ciclo.
              </p>
            </div>
          </div>
        )}

        {/* Factors legend */}
        {!loading && heatmap && heatmap.factors.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              Legenda dos Fatores Psicossociais
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {heatmap.factors.map(f => (
                <div key={f.id} className="flex items-start gap-2 text-xs text-slate-600">
                  <span className="font-bold text-rose-600 min-w-[40px]">{f.code}</span>
                  <span className="text-slate-500">{f.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && heatmap && heatmap.rows.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 text-center">
            <Layers className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 font-semibold text-lg">Nenhuma avaliação de risco encontrada</p>
            <p className="text-slate-400 text-sm mt-2">
              Crie ciclos de Análise de Risco Psicossocial para visualizar o heatmap organizacional.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
