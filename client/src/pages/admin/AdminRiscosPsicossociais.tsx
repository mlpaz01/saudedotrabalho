import { useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ShieldAlert, AlertTriangle, ShieldCheck, Activity, TrendingDown,
  TrendingUp, Minus, RotateCcw, Users, Building2, Layers, Brain,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip as RTooltip, Legend, Cell,
} from "recharts";

/**
 * Dashboard de Riscos Psicossociais (item 23).
 *
 * Classifica cada colaborador em faixas de risco a partir do seu indice de
 * bem-estar mais recente (wellbeing_index, 0-100, maior = melhor):
 *   - Sem risco         score >= 80
 *   - Sinal precoce      60 <= score < 80   (sinal precoce de burnout)
 *   - Risco moderado     40 <= score < 60
 *   - Risco elevado      score < 40         (intervencao urgente)
 *   - Sem dados          colaborador ainda sem indice calculado
 *
 * Fonte de dados: tRPC analytics.psychosocialDashboard, alimentado pelo
 * wellbeing_index, que por sua vez e calculado das respostas de pesquisas
 * (DRPS/AEP/burnout/assedio/clima) via computeWellbeingFromSurveys no db.ts.
 */

const BANDS = [
  { key: "sem_risco", label: "Sem risco", color: "#16a34a", icon: ShieldCheck },
  { key: "sinal_precoce", label: "Sinal precoce de burnout", color: "#eab308", icon: Activity },
  { key: "risco_moderado", label: "Risco moderado", color: "#f97316", icon: AlertTriangle },
  { key: "risco_elevado", label: "Risco elevado", color: "#dc2626", icon: ShieldAlert },
  { key: "sem_dados", label: "Sem dados", color: "#94a3b8", icon: Users },
] as const;

const BAND_LABEL: Record<string, string> = Object.fromEntries(BANDS.map((b) => [b.key, b.label]));
const BAND_COLOR: Record<string, string> = Object.fromEntries(BANDS.map((b) => [b.key, b.color]));

function fmtMonth(d?: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
}

function TrendIcon({ trend }: { trend?: string | null }) {
  if (trend === "subindo") return <TrendingUp size={14} className="text-emerald-600" />;
  if (trend === "caindo") return <TrendingDown size={14} className="text-red-600" />;
  return <Minus size={14} className="text-slate-400" />;
}

export default function AdminRiscosPsicossociais() {
  const [branchId, setBranchId] = useState<number | undefined>(undefined);
  const [sectorId, setSectorId] = useState<number | undefined>(undefined);

  const filterOpts = trpc.analytics.filterOptions.useQuery();
  const input = useMemo(() => ({ branchId, sectorId }), [branchId, sectorId]);
  const dash = trpc.analytics.psychosocialDashboard.useQuery(input);
  const utils = trpc.useUtils();

  const recompute = trpc.analytics.recomputeWellbeing.useMutation({
    onSuccess: (r: any) => {
      toast.success(`Indice recalculado: ${r?.snapshotted ?? 0}/${r?.processed ?? 0} colaboradores com dados de pesquisa.`);
      utils.analytics.psychosocialDashboard.invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao recalcular o indice."),
  });

  const data = dash.data;
  const bands = data?.bands as any;
  const total = data?.total ?? 0;

  const sectorsForBranch = useMemo(() => {
    const all = filterOpts.data?.sectors ?? [];
    return branchId ? all.filter((s: any) => s.branchId === branchId) : all;
  }, [filterOpts.data, branchId]);

  const evolutionData = (data?.evolution ?? []).map((e: any) => ({
    month: fmtMonth(e.month),
    avgScore: e.avgScore,
    elevado: e.elevado,
    moderado: e.moderado,
  }));

  const sectorBars = (data?.bySector ?? []).slice(0, 12).map((s: any) => ({
    name: s.name,
    "Risco elevado": s.risco_elevado,
    "Risco moderado": s.risco_moderado,
    "Sinal precoce": s.sinal_precoce,
    "Sem risco": s.sem_risco,
    riskPct: s.riskPct,
  }));

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center text-white shadow">
              <Brain size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Dashboard de Riscos Psicossociais</h1>
              <p className="text-sm text-slate-500">Classificacao dos colaboradores por faixa de risco a partir do indice de bem-estar.</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={recompute.isPending}
            onClick={() => recompute.mutate({})}
          >
            <RotateCcw size={14} className={recompute.isPending ? "animate-spin mr-2" : "mr-2"} />
            {recompute.isPending ? "Recalculando..." : "Recalcular indice"}
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center bg-white rounded-xl border border-slate-200 p-3">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-slate-400" />
            <select
              className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
              value={branchId ?? ""}
              onChange={(e) => { const v = e.target.value ? Number(e.target.value) : undefined; setBranchId(v); setSectorId(undefined); }}
            >
              <option value="">Todas as filiais</option>
              {(filterOpts.data?.branches ?? []).map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-slate-400" />
            <select
              className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
              value={sectorId ?? ""}
              onChange={(e) => setSectorId(e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">Todos os setores</option>
              {sectorsForBranch.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="ml-auto text-sm text-slate-500 flex items-center gap-1.5">
            <Users size={15} /> {total} colaboradores no escopo
          </div>
        </div>

        {dash.isLoading ? (
          <div className="text-center py-16 text-slate-400">Carregando indicadores...</div>
        ) : (
          <>
            {/* KPI cards per band */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {BANDS.map((b) => {
                const Icon = b.icon;
                const count = Number(bands?.[b.key] ?? 0);
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={b.key} className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">{b.label}</span>
                      <Icon size={16} style={{ color: b.color }} />
                    </div>
                    <div className="text-2xl font-bold" style={{ color: b.color }}>{count}</div>
                    <div className="text-xs text-slate-400">{pct}% do total</div>
                  </div>
                );
              })}
            </div>

            {/* Evolution */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Evolucao organizacional do bem-estar (6 meses)</h2>
              {evolutionData.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">Sem snapshots historicos. Use "Recalcular indice" apos respostas de pesquisas.</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={evolutionData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <RTooltip />
                    <Legend />
                    <Area type="monotone" dataKey="avgScore" name="Indice medio" stroke="#6366f1" fill="url(#gScore)" strokeWidth={2} />
                    <Area type="monotone" dataKey="elevado" name="Risco elevado (qtd)" stroke="#dc2626" fill="#dc2626" fillOpacity={0.08} strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* By sector */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Distribuicao de risco por setor</h2>
              {sectorBars.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">Sem dados por setor no escopo selecionado.</div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(220, sectorBars.length * 34)}>
                  <BarChart data={sectorBars} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                    <RTooltip />
                    <Legend />
                    <Bar dataKey="Risco elevado" stackId="a" fill={BAND_COLOR.risco_elevado} />
                    <Bar dataKey="Risco moderado" stackId="a" fill={BAND_COLOR.risco_moderado} />
                    <Bar dataKey="Sinal precoce" stackId="a" fill={BAND_COLOR.sinal_precoce} />
                    <Bar dataKey="Sem risco" stackId="a" fill={BAND_COLOR.sem_risco} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* By branch table */}
            {(data?.byBranch ?? []).length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h2 className="text-sm font-semibold text-slate-700 mb-3">Resumo por filial</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                        <th className="py-2 pr-3">Filial</th>
                        <th className="py-2 px-2 text-center">Total</th>
                        <th className="py-2 px-2 text-center text-emerald-600">Sem risco</th>
                        <th className="py-2 px-2 text-center text-yellow-600">Sinal precoce</th>
                        <th className="py-2 px-2 text-center text-orange-600">Moderado</th>
                        <th className="py-2 px-2 text-center text-red-600">Elevado</th>
                        <th className="py-2 px-2 text-center">% em risco</th>
                        <th className="py-2 px-2 text-center">Indice medio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.byBranch ?? []).map((b: any) => (
                        <tr key={String(b.id)} className="border-b border-slate-50">
                          <td className="py-2 pr-3 font-medium text-slate-700">{b.name}</td>
                          <td className="py-2 px-2 text-center">{b.total}</td>
                          <td className="py-2 px-2 text-center">{b.sem_risco}</td>
                          <td className="py-2 px-2 text-center">{b.sinal_precoce}</td>
                          <td className="py-2 px-2 text-center">{b.risco_moderado}</td>
                          <td className="py-2 px-2 text-center font-semibold">{b.risco_elevado}</td>
                          <td className="py-2 px-2 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs ${b.riskPct >= 40 ? "bg-red-100 text-red-700" : b.riskPct >= 20 ? "bg-orange-100 text-orange-700" : "bg-emerald-100 text-emerald-700"}`}>{b.riskPct}%</span>
                          </td>
                          <td className="py-2 px-2 text-center">{b.avgScore ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Top at-risk collaborators */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="text-sm font-semibold text-slate-700 mb-1">Colaboradores que requerem atencao</h2>
              <p className="text-xs text-slate-400 mb-3">Ordenados pelo menor indice de bem-estar. Acesse a Visao 360 para o plano de cuidado.</p>
              {(data?.topRisk ?? []).length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">Nenhum colaborador em faixa de atencao no escopo. </div>
              ) : (
                <div className="space-y-1.5">
                  {(data?.topRisk ?? []).map((c: any) => (
                    <a
                      key={c.userId}
                      href={`/admin/colaboradores/${c.userId}`}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-slate-50 border border-slate-100"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: BAND_COLOR[c.band] }}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-700 truncate">{c.name}</div>
                          <div className="text-xs text-slate-400 truncate">{[c.branch, c.sector].filter(Boolean).join(" · ") || "—"}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${BAND_COLOR[c.band]}1a`, color: BAND_COLOR[c.band] }}>
                          {BAND_LABEL[c.band]}
                        </span>
                        <TrendIcon trend={c.trend} />
                        <span className="text-base font-bold w-8 text-right" style={{ color: BAND_COLOR[c.band] }}>
                          {c.score ?? "—"}
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Methodology footnote */}
            <div className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3 leading-relaxed">
              <strong className="text-slate-500">Metodologia:</strong> cada colaborador e classificado pelo seu indice de bem-estar mais recente (0-100, maior = melhor),
              derivado das respostas a pesquisas DRPS/NR-01, burnout, assedio, clima e AEP. Faixas: <b>Sem risco</b> ≥ 80; <b>Sinal precoce de burnout</b> 60-79;
              <b> Risco moderado</b> 40-59; <b>Risco elevado</b> &lt; 40. Pesquisas anonimas alimentam o indice via agregado do setor/filial do colaborador.
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
