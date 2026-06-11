import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { BarChart3, Download, Users, Award, TrendingUp, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from "recharts";

const COLORS = [
  "oklch(0.28 0.08 240)",
  "oklch(0.45 0.12 162)",
  "oklch(0.88 0.04 290)",
  "oklch(0.92 0.03 15)",
  "oklch(0.65 0.15 50)",
];

export default function AdminReports() {
  const statsQuery = trpc.admin.stats.useQuery();
  const sectorQuery = trpc.admin.sectorEngagement.useQuery();
  const stats = statsQuery.data;
  const sectors = sectorQuery.data ?? [];
  const moduleStats: { title: string; completedCount: number; startedCount: number }[] = [];

  const pieData = [
    { name: "Ativos", value: Number(stats?.activeUsers ?? 0) },
    { name: "Inativos", value: Math.max(0, Number(stats?.totalUsers ?? 0) - Number(stats?.activeUsers ?? 0)) },
  ];

  const barData = moduleStats.slice(0, 11).map((m: { title: string; completedCount: number; startedCount: number }) => ({
    name: m.title.length > 18 ? m.title.substring(0, 18) + "…" : m.title,
    concluídos: Number(m.completedCount),
    iniciados: Number(m.startedCount),
  }));

  const exportCSV = () => {
    const rows = [
      ["Setor", "Total", "Ativos", "Taxa de Adesão"],
      ...sectors.map((s) => [
        s.sector ?? "Sem setor",
        s.total,
        s.active,
        s.total > 0 ? `${Math.round((Number(s.active) / Number(s.total)) * 100)}%` : "0%",
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_saude_trabalho_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="relative pl-4">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary to-transparent" />
            <h1 className="text-3xl font-bold text-primary" style={{ fontFamily: "'Playfair Display', serif" }}>
              Relatórios
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Análise de engajamento e progresso da plataforma</p>
          </div>
          <Button variant="outline" onClick={exportCSV} className="flex items-center gap-2 shrink-0">
            <Download size={16} /> Exportar CSV
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total de Usuários", value: stats?.totalUsers ?? "—", icon: <Users size={18} className="text-primary" />, bg: "bg-primary/10" },
            { label: "Usuários Ativos", value: stats?.activeUsers ?? "—", icon: <TrendingUp size={18} className="text-secondary" />, bg: "bg-secondary/10" },
            { label: "Cursos Concluídos", value: stats?.completedModules ?? "—", icon: <BookOpen size={18} className="text-purple-600" />, bg: "bg-purple-50" },
            { label: "Certificados Emitidos", value: stats?.totalCertificates ?? "—", icon: <Award size={18} className="text-amber-600" />, bg: "bg-amber-50" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-xl border border-border p-4 shadow-sm">
              <div className={`w-9 h-9 ${kpi.bg} rounded-lg flex items-center justify-center mb-3`}>{kpi.icon}</div>
              <p className="text-2xl font-bold text-foreground">
                {statsQuery.isLoading ? <span className="animate-pulse bg-muted rounded w-10 h-6 inline-block" /> : kpi.value}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 size={16} className="text-primary" /> Usuários Ativos vs Inativos
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-6 mt-2">
              {pieData.map((d, i) => (
                <span key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-3 h-3 rounded-sm inline-block" style={{ background: COLORS[i] }} />
                  {d.name}: {d.value}
                </span>
              ))}
            </div>
          </div>

          {/* Module completion */}
          <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <BookOpen size={16} className="text-primary" /> Conclusão por Curso
            </h2>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} margin={{ top: 5, right: 10, left: -20, bottom: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-40} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="iniciados" name="Iniciados" fill="oklch(0.88 0.04 290)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="concluídos" name="Concluídos" fill="oklch(0.45 0.12 162)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                Nenhum dado disponível ainda
              </div>
            )}
          </div>
        </div>

        {/* Sector Table */}
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Engajamento por Setor</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Setor</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Ativos</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Taxa</th>
                  <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Barra</th>
                </tr>
              </thead>
              <tbody>
                {sectors.map((s, i) => {
                  const rate = s.total > 0 ? Math.round((Number(s.active) / Number(s.total)) * 100) : 0;
                  return (
                    <tr key={i} className="border-t border-border hover:bg-muted/30">
                      <td className="px-5 py-3 font-medium text-foreground">{s.sector ?? "Sem setor"}</td>
                      <td className="px-5 py-3 text-right text-muted-foreground">{s.total}</td>
                      <td className="px-5 py-3 text-right text-muted-foreground">{s.active}</td>
                      <td className="px-5 py-3 text-right">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${rate >= 60 ? "bg-secondary/10 text-secondary" : rate >= 30 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600"}`}>
                          {rate}%
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="h-1.5 bg-muted rounded-full w-24 overflow-hidden">
                          <div className="progress-bar h-full" style={{ width: `${rate}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
