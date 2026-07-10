import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Activity, ChevronRight, TrendingDown, TrendingUp, Minus, AlertTriangle, BarChart3, Users, Building2 } from "lucide-react";

/**
 * Bruno R5-P6 #1 — Dashboard dos Ciclos Psicossociais (PRIORIDADE MÁXIMA).
 *
 * Painel macro consolidado do ciclo psicossocial — produto principal da plataforma.
 * Permite drill-down empresa → filial → setor → colaborador e comparação entre ciclos.
 */

const SEV_COLOR: Record<string, string> = {
  baixo: "#10b981", baixa: "#10b981",
  medio: "#f59e0b", media: "#f59e0b",
  alto: "#ea580c",  alta: "#ea580c",
  critico: "#dc2626", critica: "#dc2626",
};
const SEV_LABEL: Record<string, string> = {
  baixo: "Baixo", baixa: "Baixo",
  medio: "Médio", media: "Médio",
  alto: "Alto",   alta: "Alto",
  critico: "Crítico", critica: "Crítico",
};

export default function AdminCyclesDashboard() {
  const [cycleId, setCycleId] = useState<number | undefined>(undefined);
  const [compareId, setCompareId] = useState<number | undefined>(undefined);
  const q = trpc.riskCorrelation.cycleDashboard.useQuery(cycleId ? { cycleId } : undefined);
  const data = q.data as any;
  // effectiveCycleId: usa seleção do usuário ou o ciclo atual da API (sem exigir clique no dropdown principal)
  const effectiveCycleId = cycleId ?? (data?.cycle as any)?.id;
  const cmpQ = trpc.riskCorrelation.cycleCompare.useQuery(
    { aId: compareId ?? 0, bId: effectiveCycleId ?? 0 },
    { enabled: !!compareId && !!effectiveCycleId }
  );
  const cmp = cmpQ.data as any;

  if (q.isLoading || !data) return <AppLayout><div className="p-8 text-slate-400 text-sm">Carregando dashboard de ciclos...</div></AppLayout>;
  const cycles = (data.cycles ?? []) as any[];
  const cycle = data.cycle as any;
  const ranFiliais = (data.rankingFiliais ?? []) as any[];
  const ranSetores = (data.rankingSetores ?? []) as any[];
  const topRiscos  = (data.topRiscos ?? []) as any[];
  const dist = data.distribuicao || { baixo:0, medio:0, alto:0, critico:0 };
  const distTotal = dist.baixo + dist.medio + dist.alto + dist.critico || 1;

  const healthColor = data.healthPercent >= 70 ? "#10b981" : data.healthPercent >= 50 ? "#f59e0b" : "#dc2626";

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <header className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
              <Activity size={22} className="text-rose-600" /> Dashboard dos Ciclos Psicossociais
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Resultado consolidado dos riscos psicossociais por filial, setor e fator. Drill-down até o colaborador.
            </p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <label className="text-xs font-semibold text-slate-700">Ciclo:</label>
            <select value={cycleId ?? cycle?.id ?? ""} onChange={(e) => setCycleId(Number(e.target.value) || undefined)} className="border rounded px-2 py-1 text-sm bg-white min-w-[200px]">
              {cycles.map((c: any) => <option key={c.id} value={c.id}>{c.name} {c.status ? `(${c.status})` : ""}</option>)}
            </select>
            <label className="text-xs font-semibold text-slate-700 ml-2">Comparar com:</label>
            <select value={compareId ?? ""} onChange={(e) => setCompareId(Number(e.target.value) || undefined)} className="border rounded px-2 py-1 text-sm bg-white min-w-[180px]">
              <option value="">— nenhum —</option>
              {cycles.filter((c: any) => c.id !== (cycleId ?? cycle?.id)).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </header>

        {/* KPI Hero — % saúde psicossocial */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border-2 rounded-xl p-5 col-span-2" style={{ borderColor: healthColor }}>
            <div className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">% Saúde Psicossocial — {cycle?.name || "—"}</div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-extrabold" style={{ color: healthColor }}>{data.healthPercent}%</span>
              <span className="text-sm text-slate-500">({dist.baixo + dist.medio} de {distTotal} riscos em níveis aceitáveis)</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 mt-3">
              <div className="h-3 rounded-full transition-all" style={{ width: `${data.healthPercent}%`, background: healthColor }}/>
            </div>
          </div>
          {(["baixo","medio","alto","critico"] as const).map(k => (
            <div key={k} className="bg-white border rounded-xl p-4">
              <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: SEV_COLOR[k] }}>{SEV_LABEL[k]}</div>
              <div className="text-3xl font-bold mt-1">{dist[k]}</div>
              <div className="text-xs text-slate-500">{Math.round((dist[k]/distTotal)*100)}% do inventário</div>
            </div>
          ))}
        </div>

        {/* Comparação entre ciclos */}
        {compareId && cmp && (
          <section className="bg-white border-2 border-indigo-200 rounded-xl p-5">
            <h2 className="font-bold text-lg mb-3 flex items-center gap-2 text-indigo-900">
              <BarChart3 size={18}/> Comparação: {cycles.find((c:any)=>c.id===compareId)?.name} → {cycle?.name}
            </h2>
            <p className="text-xs text-slate-500 mb-3">
              Severidade média por fator (escala 0=baixo → 4=crítico). Variação geral da empresa: <b className={cmp.healthDelta < 0 ? "text-emerald-700" : cmp.healthDelta > 0 ? "text-rose-700" : "text-slate-700"}>
                {cmp.healthDelta < 0 ? `melhorou ${Math.abs(cmp.healthDelta)}` : cmp.healthDelta > 0 ? `piorou ${cmp.healthDelta}` : "estável"}
              </b>
            </p>
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr><th className="p-2 text-left">Fator</th><th className="p-2">Ciclo A</th><th className="p-2">Ciclo B</th><th className="p-2">Variação</th></tr>
              </thead>
              <tbody>
                {(cmp.fatores || []).map((f: any) => {
                  const Icon = f.direction === "piorou" ? TrendingUp : f.direction === "melhorou" ? TrendingDown : Minus;
                  const color = f.direction === "piorou" ? "text-rose-700" : f.direction === "melhorou" ? "text-emerald-700" : "text-slate-500";
                  return (
                    <tr key={f.factorId} className="border-t">
                      <td className="p-2 font-medium">{f.factorName}</td>
                      <td className="p-2 text-center">{f.avgA}</td>
                      <td className="p-2 text-center">{f.avgB}</td>
                      <td className={`p-2 text-center font-bold flex items-center justify-center gap-1 ${color}`}>
                        <Icon size={14}/> {f.delta > 0 ? `+${f.delta}` : f.delta}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {/* Top riscos */}
        <section className="bg-white border rounded-xl p-5">
          <h2 className="font-bold text-lg mb-3 flex items-center gap-2"><AlertTriangle size={18} className="text-amber-600"/> Top Fatores de Risco</h2>
          <div className="space-y-2">
            {topRiscos.map((r: any) => (
              <div key={r.factorId} className="flex items-center gap-3">
                <span className="text-sm font-medium flex-1">{r.factorName}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-3">
                  <div className="h-3 rounded-full bg-rose-500" style={{ width: `${r.total > 0 ? (r.altoCritico / r.total) * 100 : 0}%` }}/>
                </div>
                <span className="text-xs font-mono text-slate-600 w-20 text-right">{r.altoCritico} de {r.total}</span>
              </div>
            ))}
            {topRiscos.length === 0 && <p className="text-xs text-slate-500">Sem dados de risco no ciclo selecionado.</p>}
          </div>
        </section>

        {/* Ranking Filiais */}
        {ranFiliais.length > 0 && (
          <section className="bg-white border rounded-xl p-5">
            <h2 className="font-bold text-lg mb-3 flex items-center gap-2"><Building2 size={18} className="text-blue-600"/> Ranking de Filiais (por saúde psicossocial)</h2>
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr><th className="p-2 text-left">Filial</th><th className="p-2">Saúde %</th><th className="p-2">Baixo</th><th className="p-2">Médio</th><th className="p-2">Alto</th><th className="p-2">Crítico</th></tr></thead>
              <tbody>
                {ranFiliais.map((b: any, i: number) => (
                  <tr key={b.id} className="border-t">
                    <td className="p-2 font-medium">#{i+1} {b.name}</td>
                    <td className="p-2 text-center font-bold" style={{ color: b.healthPercent >= 70 ? "#10b981" : b.healthPercent >= 50 ? "#f59e0b" : "#dc2626" }}>{b.healthPercent}%</td>
                    <td className="p-2 text-center text-emerald-700">{b.baixo}</td>
                    <td className="p-2 text-center text-amber-700">{b.medio}</td>
                    <td className="p-2 text-center text-orange-700">{b.alto}</td>
                    <td className="p-2 text-center text-rose-700">{b.critico}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Ranking Setores + drill-down */}
        <section className="bg-white border rounded-xl p-5">
          <h2 className="font-bold text-lg mb-3 flex items-center gap-2"><Users size={18} className="text-purple-600"/> Setores que mais precisam de atenção</h2>
          <p className="text-xs text-slate-500 mb-3">Ordenados do pior (menor % saúde) ao melhor. Clique para ver os fatores e colaboradores.</p>
          <div className="space-y-3">
            {ranSetores.map((s: any) => <SectorDrill key={s.id} sector={s} cycleName={cycle?.name} cycleId={effectiveCycleId}/>)}
            {ranSetores.length === 0 && <p className="text-xs text-slate-500">Sem setores avaliados nesse ciclo.</p>}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

function SectorDrill({ sector, cycleName, cycleId }: { sector: any; cycleName?: string; cycleId?: number }) {
  const [open, setOpen] = useState(false);
  const detailQ = trpc.riskCorrelation.sectorCollaboratorDetails.useQuery(
    { sectorId: sector.id, cycleId },
    { enabled: open }
  );
  const detail = detailQ.data as any;
  const collaborators = (detail?.collaborators ?? []) as any[];

  return (
    <div className="border rounded-lg">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 text-left">
        <ChevronRight size={16} className={`transition-transform ${open ? "rotate-90" : ""}`}/>
        <span className="font-semibold flex-1">{sector.name} {sector.branchName ? <span className="text-xs text-slate-500">· {sector.branchName}</span> : null}</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: sector.healthPercent >= 70 ? "#d1fae5" : sector.healthPercent >= 50 ? "#fef3c7" : "#fee2e2", color: sector.healthPercent >= 70 ? "#065f46" : sector.healthPercent >= 50 ? "#92400e" : "#7f1d1d" }}>
          {sector.healthPercent}% saúde
        </span>
        <span className="text-xs text-slate-500">{sector.alto + sector.critico} risco(s) alto/crítico</span>
      </button>
      {open && (
        <div className="p-3 border-t bg-slate-50/50 space-y-3">
          {/* Fatores */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Fatores avaliados neste setor</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {(sector.factors || []).map((f: any, i: number) => {
                const lvl = String(f.level || "").toLowerCase();
                const c = SEV_COLOR[lvl] || "#94a3b8";
                return (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: c }}/>
                    <span className="flex-1">{f.factorName}</span>
                    <span className="text-xs font-semibold" style={{ color: c }}>{SEV_LABEL[lvl] || f.level}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Colaboradores com indicadores */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
              Colaboradores deste setor
              {detail?.priorityCount > 0 && <span className="ml-1 font-normal text-slate-400">({detail.priorityCount} curso(s) prioritário(s) do ciclo)</span>}
            </h4>
            {detailQ.isLoading && <p className="text-xs text-slate-400 py-1">Carregando...</p>}
            {!detailQ.isLoading && collaborators.length === 0 && (
              <p className="text-xs text-slate-400 py-1">Nenhum colaborador cadastrado neste setor.</p>
            )}
            {collaborators.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-1.5 text-left">Colaborador</th>
                      <th className="p-1.5 text-center">Exposição do setor</th>
                      <th className="p-1.5 text-center">Cursos prioritários</th>
                      <th className="p-1.5 text-center">Consulta psi</th>
                      <th className="p-1.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {collaborators.map((u: any) => {
                      const pct = detail?.priorityCount > 0
                        ? Math.round((u.coursesCompleted / detail.priorityCount) * 100)
                        : null;
                      const healthColor = sector.healthPercent >= 70 ? "#10b981" : sector.healthPercent >= 50 ? "#f59e0b" : "#dc2626";
                      return (
                        <tr key={u.id} className="border-t hover:bg-slate-50">
                          <td className="p-1.5 font-medium">{u.name || u.email}</td>
                          <td className="p-1.5 text-center">
                            <span className="font-bold" style={{ color: healthColor }}>{sector.healthPercent}%</span>
                          </td>
                          <td className="p-1.5 text-center">
                            {detail?.priorityCount > 0
                              ? <span className={`font-bold ${pct === 100 ? "text-emerald-700" : pct === 0 ? "text-rose-600" : "text-amber-700"}`}>
                                  {u.coursesCompleted}/{detail.priorityCount} ({pct}%)
                                </span>
                              : <span className="text-slate-400">—</span>
                            }
                          </td>
                          <td className="p-1.5 text-center">
                            {u.hasAppointment
                              ? <span className="text-emerald-700 font-bold">✓ Agendada</span>
                              : <span className="text-slate-400">—</span>
                            }
                          </td>
                          <td className="p-1.5 text-right">
                            <Link href={`/admin/colaboradores/${u.id}`} className="text-sky-600 hover:underline text-[10px]">Ver perfil →</Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
