import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Layers, ChevronDown, ChevronRight, Building2, Wrench, AlertCircle, ListTree, Calendar, Target } from "lucide-react";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";

const LVL_COLOR: Record<string, { color: string; bg: string; label: string }> = {
  baixo:    { color: "#2EA56A", bg: "rgba(46,165,106,.10)",  label: "Baixo" },
  medio:    { color: "#a07a10", bg: "rgba(160,122,16,.10)",  label: "Médio" },
  alto:     { color: "#d8761d", bg: "rgba(216,118,29,.12)",  label: "Alto" },
  critico:  { color: "#b83225", bg: "rgba(184,50,37,.12)",  label: "Crítico" },
  "crítico":{ color: "#b83225", bg: "rgba(184,50,37,.12)",  label: "Crítico" },
};
function lvlMeta(v: string) {
  const k = String(v ?? "").toLowerCase();
  return LVL_COLOR[k] ?? { color: "#666", bg: "rgba(102,102,102,.08)", label: v ?? "-" };
}

const STATUS_COLOR: Record<string, string> = {
  programado: "#1A6FBD", em_andamento: "#a07a10", concluido: "#2EA56A",
  vencido: "#b83225", pendente: "#666",
};
const PRIO_COLOR: Record<string, string> = {
  baixa: "#2EA56A", media: "#a07a10", alta: "#d8761d", critica: "#b83225",
};

type Tab = "inventario" | "matriz" | "plano" | "cronograma";

export default function AdminRiskConsolidated() {
  const [tab, setTab] = useState<Tab>("inventario");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const q = trpc.riskAssessment.getConsolidatedView.useQuery({});

  function toggle(key: string) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const branches: any[] = (q.data?.branches ?? []) as any[];

  return (
    <AppLayout>
      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Link href="/admin/analise-risco" className="hover:underline flex items-center gap-1"><ArrowLeft size={14} /> Voltar à Análise de Risco</Link>
        </div>

        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            <Layers size={22} /> Análise de Risco — Visão por Filial e Setor
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Os dados de Inventário, Matriz, Plano de Ação e Cronograma são apresentados separadamente por filial e setor, conforme NR-01.
            O Laudo Técnico PDF mantém todos juntos num único documento.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 border-b border-border">
          {([
            { id: "inventario", label: "Inventário", icon: <ListTree size={14} /> },
            { id: "matriz", label: "Matriz de Riscos", icon: <Target size={14} /> },
            { id: "plano", label: "Plano de Ação", icon: <AlertCircle size={14} /> },
            { id: "cronograma", label: "Cronograma 12 meses", icon: <Calendar size={14} /> },
          ] as Array<{ id: Tab; label: string; icon: any }>).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
                tab === t.id ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {q.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

        {!q.isLoading && branches.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <Layers size={40} className="mx-auto mb-3 opacity-30" />
            <p>Nenhum ciclo de Análise de Risco cadastrado nesta empresa.</p>
          </div>
        )}

        {!q.isLoading && branches.length > 0 && (
          <div className="space-y-3">
            {branches.map((b: any) => {
              const bKey = `b${b.branchId ?? "n"}`;
              const bOpen = expanded.has(bKey) || branches.length === 1;
              return (
                <div key={bKey} className="bg-white border border-border rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggle(bKey)}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/30"
                  >
                    {bOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <Building2 size={16} className="text-slate-500" />
                    <strong className="text-slate-800">{b.branchName}</strong>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {b.sectors.length} setor(es)
                    </span>
                  </button>

                  {bOpen && (
                    <div className="border-t border-border divide-y divide-border">
                      {b.sectors.map((s: any) => {
                        const sKey = `${bKey}_s${s.sectorId ?? "n"}`;
                        const sOpen = expanded.has(sKey) || b.sectors.length === 1;
                        return (
                          <div key={sKey}>
                            <button
                              onClick={() => toggle(sKey)}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/20 pl-10"
                            >
                              {sOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              <Wrench size={14} className="text-slate-400" />
                              <span className="font-medium text-slate-700 text-sm">{s.sectorName}</span>
                              <span className="ml-auto text-[11px] text-muted-foreground">
                                {s.assessments.length} ciclo(s)
                              </span>
                            </button>

                            {sOpen && (
                              <div className="px-6 pb-4 space-y-4">
                                {s.assessments.map((a: any) => (
                                  <div key={a.id} className="border border-border rounded-lg overflow-hidden">
                                    <div className="px-3 py-2 bg-muted/30 text-xs text-slate-700 flex items-center justify-between">
                                      <span>
                                        <strong>{a.cycleName}</strong> · status: {a.status}
                                      </span>
                                      <Link href={`/admin/analise-risco/${a.id}`} className="text-primary text-[11px] hover:underline">Abrir ciclo →</Link>
                                    </div>

                                    {tab === "inventario" && (
                                      <InventoryTable items={a.inventory} />
                                    )}
                                    {tab === "matriz" && (
                                      <MatrixTable items={a.inventory} />
                                    )}
                                    {tab === "plano" && (
                                      <PlanTable items={a.actionPlan} />
                                    )}
                                    {tab === "cronograma" && (
                                      <CronogramaTable items={a.actionPlan} />
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function InventoryTable({ items }: { items: any[] }) {
  if (!items || items.length === 0) return <p className="px-3 py-3 text-xs text-muted-foreground italic">Inventário vazio.</p>;
  return (
    <table className="w-full text-xs">
      <thead className="bg-slate-50">
        <tr>
          <th className="text-left px-2 py-1.5 font-medium">Fator</th>
          <th className="text-left px-2 py-1.5 font-medium">Fontes geradoras</th>
          <th className="text-left px-2 py-1.5 font-medium">Medidas existentes</th>
          <th className="text-left px-2 py-1.5 font-medium">Risco final</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it: any) => {
          const m = lvlMeta(it.risco_final);
          return (
            <tr key={it.id} className="border-t">
              <td className="px-2 py-1.5 align-top">
                <div className="font-medium">{it.factor_name}</div>
                <div className="text-[10px] text-muted-foreground">{it.factor_code}</div>
              </td>
              <td className="px-2 py-1.5 align-top max-w-xs">{it.fontes_geradoras || "—"}</td>
              <td className="px-2 py-1.5 align-top max-w-xs">{it.medidas_existentes || "—"}</td>
              <td className="px-2 py-1.5 align-top">
                <span style={{ background: m.bg, color: m.color, padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{m.label}</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function MatrixTable({ items }: { items: any[] }) {
  if (!items || items.length === 0) return <p className="px-3 py-3 text-xs text-muted-foreground italic">Sem dados de matriz.</p>;
  return (
    <table className="w-full text-xs">
      <thead className="bg-slate-50">
        <tr>
          <th className="text-left px-2 py-1.5 font-medium">Fator</th>
          <th className="text-left px-2 py-1.5 font-medium">Gravidade</th>
          <th className="text-left px-2 py-1.5 font-medium">Probabilidade</th>
          <th className="text-left px-2 py-1.5 font-medium">Classificação Final</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it: any) => {
          const m = lvlMeta(it.risco_final);
          return (
            <tr key={it.id} className="border-t">
              <td className="px-2 py-1.5">{it.factor_name}</td>
              <td className="px-2 py-1.5">{it.gravidade}</td>
              <td className="px-2 py-1.5">{it.probabilidade}</td>
              <td className="px-2 py-1.5">
                <span style={{ background: m.bg, color: m.color, padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{m.label}</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function PlanTable({ items }: { items: any[] }) {
  if (!items || items.length === 0) return <p className="px-3 py-3 text-xs text-muted-foreground italic">Sem ações no plano.</p>;
  return (
    <table className="w-full text-xs">
      <thead className="bg-slate-50">
        <tr>
          <th className="text-left px-2 py-1.5 font-medium">Fator</th>
          <th className="text-left px-2 py-1.5 font-medium">Ação</th>
          <th className="text-left px-2 py-1.5 font-medium">Responsável</th>
          <th className="text-left px-2 py-1.5 font-medium">Prazo</th>
          <th className="text-left px-2 py-1.5 font-medium">Prioridade</th>
          <th className="text-left px-2 py-1.5 font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it: any) => (
          <tr key={it.id} className="border-t">
            <td className="px-2 py-1.5">{it.factor_name}</td>
            <td className="px-2 py-1.5 max-w-md">{it.action_description}</td>
            <td className="px-2 py-1.5">{it.responsible_party || "—"}</td>
            <td className="px-2 py-1.5">{it.end_date ? new Date(it.end_date).toLocaleDateString("pt-BR") : "—"}</td>
            <td className="px-2 py-1.5">
              <span style={{ color: PRIO_COLOR[String(it.priority ?? "").toLowerCase()] ?? "#666", fontWeight: 700, fontSize: 10, textTransform: "uppercase" }}>{it.priority}</span>
            </td>
            <td className="px-2 py-1.5">
              <span style={{ color: STATUS_COLOR[String(it.status ?? "").toLowerCase()] ?? "#666", fontWeight: 600 }}>{it.status}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CronogramaTable({ items }: { items: any[] }) {
  if (!items || items.length === 0) return <p className="px-3 py-3 text-xs text-muted-foreground italic">Sem ações no cronograma.</p>;
  const months = Array.from({ length: 12 }, (_, i) => i);
  const today = new Date();
  const baseMonth = today.getMonth();
  const baseYear = today.getFullYear();
  function monthLabel(i: number) {
    const d = new Date(baseYear, baseMonth + i, 1);
    return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
  }
  function isMonthInRange(it: any, mIdx: number) {
    if (!it.start_date || !it.end_date) return false;
    const target = new Date(baseYear, baseMonth + mIdx, 1);
    const st = new Date(it.start_date);
    const en = new Date(it.end_date);
    return st <= new Date(target.getFullYear(), target.getMonth() + 1, 0) && en >= target;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-left px-2 py-1.5 font-medium">Ação</th>
            {months.map((i) => <th key={i} className="px-1 py-1.5 font-medium text-center">{monthLabel(i)}</th>)}
          </tr>
        </thead>
        <tbody>
          {items.map((it: any) => (
            <tr key={it.id} className="border-t">
              <td className="px-2 py-1.5 max-w-[220px] truncate">{it.action_description}</td>
              {months.map((mIdx) => {
                const active = isMonthInRange(it, mIdx);
                return (
                  <td key={mIdx} className="px-1 py-1.5 text-center">
                    {active && <span style={{ display: "inline-block", width: 18, height: 6, background: PRIO_COLOR[String(it.priority ?? "media").toLowerCase()] ?? "#666", borderRadius: 3 }} />}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
