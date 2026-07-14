import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { Clock, AlertOctagon, CheckCircle2, AlertTriangle } from "lucide-react";

/**
 * Bruno R5-P6 #6 — Dashboard de Prazos do Plano de Ação.
 * RH: visão completa. Chefia: só seu(s) setor(es). Cursos vencidos, próximos do vencimento,
 * % executado, % pendente, cronograma.
 */
export default function AdminPlanoAcaoPrazos() {
  const { user } = useAuth();
  const isChefia = user?.role === "chefia";
  const q = trpc.riskCorrelation.coursesPlanoAcao.useQuery();
  const data = q.data as any;

  if (q.isLoading || !data) return <AppLayout><div className="p-8 text-slate-400 text-sm">Carregando…</div></AppLayout>;
  const prio = (data.prioritarios ?? []) as any[];
  const vencidos = prio.filter(p => p.isOverdue);
  const proximos = prio.filter(p => !p.isOverdue && p.daysLeft !== null && p.daysLeft <= 15);
  const noPrazo = prio.filter(p => !p.isOverdue && (p.daysLeft === null || p.daysLeft > 15));
  const totalRiscos = prio.length;
  const pctVencidos = totalRiscos ? Math.round((vencidos.length / totalRiscos) * 100) : 0;
  const pctNoPrazo = totalRiscos ? Math.round((noPrazo.length / totalRiscos) * 100) : 0;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <header>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            <Clock size={22} className="text-amber-600"/> Prazos do Plano de Ação
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cursos obrigatórios decorrentes do último ciclo psicossocial — fonte fiscalizável (NR-01).
            {isChefia ? " Visão limitada ao seu setor." : " Visão completa da empresa."}
          </p>
          {data.cycleInfo && <p className="text-xs text-slate-500 mt-1">Ciclo de referência: <b>{data.cycleInfo.name}</b> ({data.cycleInfo.status})</p>}
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-rose-800 text-xs uppercase font-bold"><AlertOctagon size={14}/> Vencidos</div>
            <div className="text-3xl font-extrabold text-rose-700 mt-1">{vencidos.length}</div>
            <div className="text-xs text-rose-600">{pctVencidos}% do plano</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-amber-800 text-xs uppercase font-bold"><AlertTriangle size={14}/> Vencem em ≤15d</div>
            <div className="text-3xl font-extrabold text-amber-700 mt-1">{proximos.length}</div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-emerald-800 text-xs uppercase font-bold"><CheckCircle2 size={14}/> No prazo</div>
            <div className="text-3xl font-extrabold text-emerald-700 mt-1">{noPrazo.length}</div>
            <div className="text-xs text-emerald-600">{pctNoPrazo}% do plano</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-slate-700 text-xs uppercase font-bold"><Clock size={14}/> Total no Plano</div>
            <div className="text-3xl font-extrabold text-slate-800 mt-1">{totalRiscos}</div>
          </div>
        </div>

        {vencidos.length > 0 && (
          <section className="bg-white border-2 border-rose-200 rounded-xl p-4">
            <h2 className="font-bold text-base text-rose-900 mb-2 flex items-center gap-2">
              <AlertOctagon size={18}/> Cursos prioritários VENCIDOS (atenção urgente)
            </h2>
            <PlanoTable rows={vencidos} mostraVencimento/>
          </section>
        )}
        {proximos.length > 0 && (
          <section className="bg-white border-2 border-amber-200 rounded-xl p-4">
            <h2 className="font-bold text-base text-amber-900 mb-2 flex items-center gap-2">
              <AlertTriangle size={18}/> Vencimento próximo (≤ 15 dias)
            </h2>
            <PlanoTable rows={proximos} mostraVencimento/>
          </section>
        )}
        {noPrazo.length > 0 && (
          <section className="bg-white border rounded-xl p-4">
            <h2 className="font-bold text-base text-slate-800 mb-2 flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-600"/> No prazo
            </h2>
            <PlanoTable rows={noPrazo} mostraVencimento/>
          </section>
        )}

        {prio.length === 0 && (
          <div className="bg-white border rounded-xl p-8 text-center">
            <CheckCircle2 size={36} className="text-emerald-500 mx-auto mb-2"/>
            <p className="text-sm font-semibold">Nenhum curso prioritário neste momento.</p>
            <p className="text-xs text-slate-500 mt-1">A configuração da aba <Link href="/admin/fatores" className="text-sky-600 hover:underline">13 Fatores NR-01</Link> define o que vira prioritário a partir do ciclo psicossocial.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function PlanoTable({ rows, mostraVencimento }: { rows: any[]; mostraVencimento?: boolean }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50 text-xs">
        <tr>
          <th className="p-2 text-left">Curso</th>
          <th className="p-2 text-left">Fator que originou</th>
          <th className="p-2">Crit.</th>
          <th className="p-2">Ciclo</th>
          {mostraVencimento && <th className="p-2">Prazo</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((c: any, i: number) => (
          <tr key={i} className="border-t">
            <td className="p-2 font-medium">{c.moduleTitle}</td>
            <td className="p-2 text-slate-700">{c.factorName}</td>
            <td className="p-2 text-center">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                String(c.criticidadeConfigurada).toLowerCase().includes("crit") ? "bg-rose-100 text-rose-800" :
                String(c.criticidadeConfigurada).toLowerCase().includes("alt")  ? "bg-orange-100 text-orange-800" :
                String(c.criticidadeConfigurada).toLowerCase().includes("med")  ? "bg-amber-100 text-amber-800" :
                "bg-emerald-100 text-emerald-800"
              }`}>{String(c.criticidadeConfigurada).toUpperCase()}</span>
            </td>
            <td className="p-2 text-xs text-slate-600">{c.cycleName}</td>
            {mostraVencimento && (
              <td className="p-2 text-center text-xs">
                {c.deadline ? new Date(c.deadline).toLocaleDateString("pt-BR") : "—"}
                {c.daysLeft !== null && (
                  <div className={`mt-0.5 font-bold ${c.isOverdue ? "text-rose-700" : c.daysLeft <= 15 ? "text-amber-700" : "text-emerald-700"}`}>
                    {c.isOverdue ? `${Math.abs(c.daysLeft)}d vencido` : `${c.daysLeft}d restantes`}
                  </div>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
