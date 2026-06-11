import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Users, ShieldAlert, ClipboardList, BookOpen, AlertTriangle } from "lucide-react";

const RISK_COLORS: Record<string, string> = {
  baixo: "bg-emerald-100 text-emerald-800 border-emerald-200",
  medio: "bg-amber-100 text-amber-800 border-amber-200",
  alto: "bg-orange-100 text-orange-800 border-orange-200",
  critico: "bg-rose-100 text-rose-800 border-rose-200",
};

const PRIORITY_COLORS: Record<string, string> = {
  baixa: "bg-emerald-100 text-emerald-800",
  media: "bg-amber-100 text-amber-800",
  alta: "bg-orange-100 text-orange-800",
  critica: "bg-rose-100 text-rose-800",
};

function riskLabel(level: string) {
  const map: Record<string, string> = {
    baixo: "Baixo",
    medio: "Médio",
    alto: "Alto",
    critico: "Crítico",
  };
  return map[level] ?? level;
}

export default function AdminChefia() {
  const { data, isLoading } = trpc.dashboard.chefiaDashboard.useQuery();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const sectorName = data?.sectorName ?? "Meu setor";
  const teamSize = data?.teamSize ?? 0;
  const actionPlanItems = data?.actionPlanItems ?? [];
  const riskSummary = data?.riskSummary ?? [];
  const trainingRate = data?.trainingRate ?? 0;

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel da Chefia — {sectorName}</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão consolidada do seu setor</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Team size */}
          <div className="rounded-xl border bg-card p-5 flex items-center gap-4 shadow-sm">
            <div className="p-3 rounded-lg bg-blue-100 text-blue-700">
              <Users size={22} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Colaboradores</p>
              <p className="text-3xl font-bold text-foreground">{teamSize}</p>
            </div>
          </div>

          {/* Training rate */}
          <div className="rounded-xl border bg-card p-5 flex items-center gap-4 shadow-sm">
            <div className="p-3 rounded-lg bg-violet-100 text-violet-700">
              <BookOpen size={22} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Conclusão de Cursos</p>
              <p className="text-3xl font-bold text-foreground">{trainingRate}%</p>
            </div>
          </div>

          {/* Action plan pending */}
          <div className="rounded-xl border bg-card p-5 flex items-center gap-4 shadow-sm">
            <div className="p-3 rounded-lg bg-amber-100 text-amber-700">
              <ClipboardList size={22} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Ações em Aberto</p>
              <p className="text-3xl font-bold text-foreground">{actionPlanItems.length}</p>
            </div>
          </div>
        </div>

        {/* Risk summary */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b">
            <ShieldAlert size={18} className="text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Resumo de Riscos — {sectorName}</h2>
          </div>
          <div className="p-5">
            {riskSummary.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma avaliação de risco registrada para este setor.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {riskSummary.map((r) => (
                  <div
                    key={r.level}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium ${RISK_COLORS[r.level] ?? "bg-gray-100 text-gray-800 border-gray-200"}`}
                  >
                    <span>{riskLabel(r.level)}</span>
                    <span className="text-lg font-bold">{r.count}</span>
                    <span className="text-xs opacity-70">item{r.count !== 1 ? "s" : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action plan items */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b">
            <ClipboardList size={18} className="text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Plano de Ação — Itens Pendentes</h2>
          </div>
          <div className="p-5">
            {actionPlanItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item de plano de ação pendente para este setor.</p>
            ) : (
              <div className="space-y-3">
                {actionPlanItems.map((item) => (
                  <div key={item.id} className="rounded-lg border bg-background p-4 flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{item.actionDescription}</p>
                      <p className="text-xs text-muted-foreground mt-1">Fator: {item.factorName}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${PRIORITY_COLORS[item.priority] ?? "bg-gray-100 text-gray-800"}`}>
                        {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
                      </span>
                      {item.endDate && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                          Prazo: {item.endDate}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full capitalize">
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Restricted access notice */}
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <p className="text-sm">
            Visão restrita ao seu setor. Dados individuais de colaboradores são acessíveis apenas para RH e Psicologia.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
