import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import {
  LineChart as LineChartIcon, TrendingUp, Users, Award, BookOpen, ClipboardList,
  ShieldAlert, Layers, Filter, Plus, Trash2, Share2, RefreshCw, X, Sparkles,
  BarChart3, ArrowUpRight, ArrowDownRight, Target, Flame, Eye, ChevronRight,
  ArrowUp, ArrowDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart
} from "recharts";

type TabKey = "overview" | "courses" | "surveys" | "engagement" | "risk" | "saved";

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "overview", label: "Visão Geral", icon: BarChart3 },
  { key: "courses", label: "Cursos", icon: BookOpen },
  { key: "surveys", label: "Pesquisas", icon: ClipboardList },
  { key: "engagement", label: "Engajamento", icon: TrendingUp },
  { key: "risk", label: "Risco Psicossocial", icon: ShieldAlert },
  { key: "saved", label: "Minhas Análises", icon: Sparkles },
];

const COLORS = {
  primary: "#0B2138",
  primaryLight: "#1e3a5f",
  good: "#10b981",
  warn: "#f59e0b",
  bad: "#ef4444",
  critical: "#991b1b",
  neutral: "#94a3b8",
  accent: "#8b5cf6",
};

const PALETTE = ["#0B2138", "#1e3a5f", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

const PERIOD_OPTIONS: { value: number | undefined; label: string }[] = [
  { value: 7, label: "Últimos 7 dias" },
  { value: 30, label: "Últimos 30 dias" },
  { value: 90, label: "Últimos 90 dias" },
  { value: 365, label: "Últimos 365 dias" },
  { value: undefined, label: "Todo o período" },
];

/* ==================== SHARED UI ==================== */
function KpiCard({ label, value, sub, icon: Icon, color = COLORS.primary, delta }: any) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon size={18} style={{ color }} />
        </div>
        {delta !== undefined && (
          <div className={`text-xs flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-medium ${delta >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            {delta >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {Math.abs(delta)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground mt-3">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted-foreground/70 mt-1">{sub}</p>}
    </div>
  );
}

function EmptyState({ icon: Icon, title, hint }: { icon: any; title: string; hint: string }) {
  return (
    <div className="bg-muted/30 border border-dashed border-border rounded-xl p-8 text-center">
      <Icon size={32} className="mx-auto text-muted-foreground/60 mb-3" />
      <p className="font-medium text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground mt-1">{hint}</p>
    </div>
  );
}

function SectionCard({ title, subtitle, children, action }: any) {
  return (
    <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-border p-3 flex flex-wrap items-center gap-2 shadow-sm">
      <Filter size={14} className="text-muted-foreground ml-1" />
      {children}
    </div>
  );
}

function FilterSelect({ value, onChange, options, placeholder }: { value: string | number | undefined; onChange: (v: any) => void; options: { value: any; label: string }[]; placeholder: string }) {
  return (
    <select
      value={value === undefined ? "" : value}
      onChange={(e) => onChange(e.target.value === "" ? undefined : isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value))}
      className="px-2 py-1.5 bg-white border border-border rounded text-xs outline-none cursor-pointer hover:border-primary/50"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={String(o.value)} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function SortableTh({ label, sortKey, currentSort, onSort, align = "left" }: { label: string; sortKey: string; currentSort: { key: string; dir: "asc" | "desc" }; onSort: (k: string) => void; align?: "left" | "right" }) {
  const active = currentSort.key === sortKey;
  return (
    <th className={`py-2 px-3 text-xs uppercase text-muted-foreground font-medium cursor-pointer select-none hover:text-foreground text-${align}`} onClick={() => onSort(sortKey)}>
      <span className={`inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""}`}>
        {label}
        {active ? (currentSort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <span className="opacity-30"><ArrowDown size={11} /></span>}
      </span>
    </th>
  );
}

function useSort<T extends Record<string, any>>(data: T[], initialKey: string, initialDir: "asc" | "desc" = "desc"): { sorted: T[]; sort: { key: string; dir: "asc" | "desc" }; toggleSort: (k: string) => void } {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: initialKey, dir: initialDir });
  const sorted = useMemo(() => {
    if (!data || data.length === 0) return data;
    const arr = [...data];
    arr.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return sort.dir === "asc" ? av - bv : bv - av;
      const sa = String(av).toLowerCase();
      const sb = String(bv).toLowerCase();
      return sort.dir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
    return arr;
  }, [data, sort]);
  const toggleSort = (k: string) => {
    setSort((s) => s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "desc" });
  };
  return { sorted, sort, toggleSort };
}

/* ==================== DRILL BREADCRUMB ==================== */
function DrillBreadcrumb({ drill, onClear, branches, sectors }: { drill: DrillState; onClear: (level: "branch" | "sector") => void; branches?: any[]; sectors?: any[] }) {
  const branchName = drill.branchId ? branches?.find((b) => b.id === drill.branchId)?.name : null;
  const sectorName = drill.sectorId ? sectors?.find((s) => s.id === drill.sectorId)?.name : null;
  if (!branchName && !sectorName) return null;
  return (
    <div className="flex items-center gap-2 text-xs bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 flex-wrap">
      <span className="text-muted-foreground">Filtrando:</span>
      <button onClick={() => { onClear("branch"); }} className="font-medium text-primary hover:underline">Toda Empresa</button>
      {branchName && (
        <>
          <ChevronRight size={12} className="text-muted-foreground" />
          <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-full border border-primary/30">
            <span>📍 {branchName}</span>
            <button onClick={() => onClear("sector")} className="text-muted-foreground hover:text-foreground"><X size={10} /></button>
          </span>
        </>
      )}
      {sectorName && (
        <>
          <ChevronRight size={12} className="text-muted-foreground" />
          <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-full border border-primary/30">
            <span>🏷️ {sectorName}</span>
            <button onClick={() => onClear("sector")} className="text-muted-foreground hover:text-foreground"><X size={10} /></button>
          </span>
        </>
      )}
    </div>
  );
}

interface DrillState {
  branchId?: number;
  sectorId?: number;
  userId?: number;
}

/* ==================== USER DRAWER ==================== */
function UserDrawer({ userId, onClose }: { userId: number; onClose: () => void }) {
  const q = trpc.lessons.userDetails.useQuery({ userId });
  const d = q.data as any;
  const u = d?.user;
  const courses: any[] = d?.courses ?? [];
  const surveys: any[] = d?.surveys ?? [];
  const certs: any[] = d?.certificates ?? [];
  const completed = courses.filter((c: any) => c.isCompleted).length;
  const inProgress = courses.filter((c: any) => !c.isCompleted && c.percentWatched > 0).length;
  const avgPercent = courses.length > 0 ? Math.round(courses.reduce((s: number, c: any) => s + (c.percentWatched ?? 0), 0) / courses.length) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={onClose}>
      <div className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-border flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{u?.name ?? "Carregando..."}</h3>
            <p className="text-xs text-muted-foreground">{u?.email}</p>
            {u?.cargo && <p className="text-xs text-muted-foreground mt-0.5">{u.cargo}</p>}
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando detalhes...</p>
          ) : !u ? (
            <EmptyState icon={Users} title="Usuário não encontrado" hint="" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Cursos concluídos</p>
                  <p className="text-xl font-bold text-foreground">{completed}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Em andamento</p>
                  <p className="text-xl font-bold text-foreground">{inProgress}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">% médio</p>
                  <p className="text-xl font-bold text-foreground">{avgPercent}%</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Certificados</p>
                  <p className="text-xl font-bold text-foreground">{certs.length}</p>
                </div>
              </div>
              {courses.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Cursos ({courses.length})</p>
                  <div className="space-y-2">
                    {courses.slice(0, 15).map((c: any, i: number) => (
                      <div key={i} className="text-sm py-2 border-b border-border/50 last:border-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-foreground truncate flex-1">{c.moduleTitle}</p>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${c.isCompleted ? 'bg-emerald-50 text-emerald-700' : c.percentWatched >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'}`}>{c.percentWatched}%</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{c.lastWatchedAt ? `Último acesso: ${new Date(c.lastWatchedAt).toLocaleDateString('pt-BR')}` : 'Nunca acessado'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {surveys.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Pesquisas ({surveys.length})</p>
                  <div className="space-y-2">
                    {surveys.slice(0, 10).map((s: any, i: number) => (
                      <div key={i} className="text-sm py-2 border-b border-border/50 last:border-0">
                        <p className="font-medium text-foreground truncate">{s.surveyTitle}</p>
                        <p className="text-xs text-muted-foreground">{s.submittedAt ? new Date(s.submittedAt).toLocaleDateString('pt-BR') : '-'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ==================== OVERVIEW TAB ==================== */
function OverviewTab({ filters }: { filters: any }) {
  // overview accepts { from, to, branchId, sectorId }
  const overviewInput = useMemo(() => ({ branchId: filters.branchId, sectorId: filters.sectorId }), [filters.branchId, filters.sectorId]);
  const q = trpc.analytics.overview.useQuery(overviewInput);
  const data = q.data;

  const riskPie = data ? [
    { name: "Baixo", value: data.riskOverview.baixo, color: COLORS.good },
    { name: "Médio", value: data.riskOverview.medio, color: COLORS.warn },
    { name: "Alto", value: data.riskOverview.alto, color: COLORS.bad },
    { name: "Crítico", value: data.riskOverview.critico, color: COLORS.critical },
  ].filter(d => d.value > 0) : [];

  if (q.isLoading) return <div className="text-muted-foreground text-sm">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total de Colaboradores" value={data?.totalUsers ?? 0} icon={Users} color={COLORS.primary} />
        <KpiCard label="Ativos (30 dias)" value={data?.activeUsers ?? 0} sub={`${data && data.totalUsers > 0 ? Math.round((data.activeUsers/data.totalUsers)*100) : 0}% do total`} icon={TrendingUp} color={COLORS.good} />
        <KpiCard label="Cursos Concluídos" value={data?.modulesCompleted ?? 0} icon={BookOpen} color={COLORS.accent} />
        <KpiCard label="Certificados Emitidos" value={data?.certificatesIssued ?? 0} icon={Award} color={COLORS.warn} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Pesquisas Ativas" value={data?.activeSurveys ?? 0} icon={ClipboardList} color="#06b6d4" />
        <KpiCard label="Respostas de Pesquisas" value={data?.totalResponses ?? 0} icon={Target} color="#ec4899" />
        <KpiCard label="Taxa de Resposta" value={`${data?.surveyResponseRate ?? 0}%`} icon={Target} color={COLORS.good} />
        <KpiCard label="Engajamento Médio" value={`${data?.avgEngagement ?? 0}%`} sub="% médio assistido" icon={Flame} color={COLORS.bad} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <SectionCard title="Distribuição de Riscos Psicossociais" subtitle="Itens de inventário por nível">
          {riskPie.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={riskPie} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="value">
                  {riskPie.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={28} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={ShieldAlert} title="Sem avaliações de risco ainda" hint="Aplique seu primeiro DRPS+AEP em /admin/analise-risco para ver dados aqui" />
          )}
        </SectionCard>
        <SectionCard title="Saúde Geral do Programa" subtitle="Indicadores-chave de performance">
          <div className="space-y-4">
            <ProgressBar label="Engajamento médio" value={data?.avgEngagement ?? 0} color={COLORS.primary} />
            <ProgressBar label="Taxa de resposta pesquisas" value={data?.surveyResponseRate ?? 0} color={COLORS.good} />
            <ProgressBar label="Usuários ativos" value={data && data.totalUsers > 0 ? Math.round((data.activeUsers/data.totalUsers)*100) : 0} color={COLORS.warn} />
            <ProgressBar label="% concluídos / iniciados" value={data && data.totalUsers > 0 ? Math.min(100, Math.round((data.modulesCompleted / Math.max(1, data.totalUsers))*100)) : 0} color={COLORS.accent} />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function ProgressBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{value}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, value)}%`, background: color }} />
      </div>
    </div>
  );
}

/* ==================== COURSES TAB ==================== */
function CoursesTab({ filters, drill, setDrill, filterOpts }: { filters: any; drill: DrillState; setDrill: (d: DrillState) => void; filterOpts: any }) {
  const [moduleId, setModuleId] = useState<number | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [dimension, setDimension] = useState<"branch" | "sector" | "role">(drill.branchId ? "sector" : "branch");

  // courseFunnel only accepts branchId/sectorId per backend signature
  const funnelInput = useMemo(() => ({ branchId: filters.branchId, sectorId: filters.sectorId }), [filters.branchId, filters.sectorId]);
  const funnelQ = trpc.analytics.courseFunnel.useQuery(funnelInput);
  const compQ = trpc.analytics.completionByDimension.useQuery({ dimension, branchId: drill.branchId, sectorId: drill.sectorId });
  const topQ = trpc.analytics.topPerformers.useQuery({ limit: 20, branchId: drill.branchId, sectorId: drill.sectorId });
  const botQ = trpc.analytics.bottomPerformers.useQuery({ limit: 20, branchId: drill.branchId, sectorId: drill.sectorId });
  const modulesQ = trpc.modules.list.useQuery();

  let funnelData = funnelQ.data ?? [];
  if (moduleId) funnelData = funnelData.filter((f: any) => f.moduleId === moduleId);
  const compData = compQ.data ?? [];

  const top = useSort(topQ.data ?? [], "modulesCompleted", "desc");
  const bot = useSort(botQ.data ?? [], "modulesCompleted", "asc");

  // When in branch, dimension auto = sector; when in sector, dimension auto = user (-> list)
  const effectiveDimension: "branch" | "sector" | "role" = drill.sectorId ? "sector" : drill.branchId ? "sector" : dimension;
  const chartTitle = drill.sectorId
    ? `Conclusão por Colaborador (Setor ${filterOpts?.sectors?.find((s: any) => s.id === drill.sectorId)?.name ?? ''})`
    : drill.branchId
      ? `Conclusão por Setor (Filial ${filterOpts?.branches?.find((b: any) => b.id === drill.branchId)?.name ?? ''})`
      : `Conclusão por ${effectiveDimension === "branch" ? "Filial" : effectiveDimension === "sector" ? "Setor" : "Cargo"}`;

  return (
    <div className="space-y-6">
      <FilterBar>
        <FilterSelect value={moduleId} onChange={(v) => setModuleId(v as any)} options={(modulesQ.data ?? []).map((m: any) => ({ value: m.id, label: m.title }))} placeholder="Todos os cursos" />
        <FilterSelect
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as any)}
          options={[
            { value: "not_started", label: "Não iniciados" },
            { value: "in_progress", label: "Em andamento" },
            { value: "completed", label: "Concluídos" },
          ]}
          placeholder="Qualquer status"
        />
        {!drill.branchId && (
          <FilterSelect
            value={dimension}
            onChange={(v) => setDimension((v as any) || "branch")}
            options={[
              { value: "branch", label: "Filial" },
              { value: "sector", label: "Setor" },
              { value: "role", label: "Cargo" },
            ]}
            placeholder="Filial"
          />
        )}
      </FilterBar>

      <SectionCard title="Funil de Conclusão por Curso" subtitle="Quantos colaboradores avançam em cada estágio (top 12 por iniciados)">
        {funnelData.length > 0 ? (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={funnelData} margin={{ top: 5, right: 10, left: -10, bottom: 70 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="title" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} height={70} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="started" name="Iniciados" fill={COLORS.neutral} />
              <Bar dataKey="qtr" name="≥25%" fill="#cbd5e1" />
              <Bar dataKey="half" name="≥50%" fill={COLORS.accent} />
              <Bar dataKey="threeQtr" name="≥75%" fill={COLORS.primaryLight} />
              <Bar dataKey="completed" name="Concluídos" fill={COLORS.good} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState icon={BookOpen} title="Sem dados de cursos ainda" hint="Quando colaboradores começarem a fazer cursos, você verá métricas aqui" />
        )}
      </SectionCard>

      <SectionCard title={chartTitle} subtitle="Clique em uma barra para drill-down · % médio assistido">
        {compData.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(280, compData.length * 32)}>
            <BarChart data={compData} layout="vertical" margin={{ top: 5, right: 20, left: 100, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} domain={[0,100]} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
              <Tooltip />
              <Bar
                dataKey="avgPercent"
                name="% médio"
                fill={drill.branchId ? COLORS.accent : COLORS.primary}
                radius={[0,4,4,0]}
                cursor="pointer"
                onClick={(d: any) => {
                  if (effectiveDimension === "branch" && d?.id) {
                    setDrill({ ...drill, branchId: d.id });
                  } else if (effectiveDimension === "sector" && d?.id) {
                    setDrill({ ...drill, sectorId: d.id });
                  }
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState icon={Layers} title="Sem dados de conclusão" hint="Cadastre filiais/setores e atribua colaboradores" />
        )}
      </SectionCard>

      <div className="grid md:grid-cols-2 gap-6">
        <SectionCard title="🏆 Top Performers" subtitle="Colaboradores com mais cursos concluídos (clique no nome para detalhe)">
          <UserTable users={top.sorted} sort={top.sort} toggleSort={top.toggleSort} onUserClick={(uid) => setDrill({ ...drill, userId: uid })} highlight="good" />
        </SectionCard>
        <SectionCard title="⚠️ Precisam de Cobrança" subtitle="Bottom performers - candidatos para campanhas">
          <UserTable users={bot.sorted} sort={bot.sort} toggleSort={bot.toggleSort} onUserClick={(uid) => setDrill({ ...drill, userId: uid })} highlight="bad" />
        </SectionCard>
      </div>
    </div>
  );
}

function UserTable({ users, sort, toggleSort, onUserClick, highlight }: { users: any[]; sort: any; toggleSort: (k: string) => void; onUserClick: (uid: number) => void; highlight: "good" | "bad" }) {
  if (!users.length) return <EmptyState icon={Users} title="Sem dados" hint="Quando houver progresso, aparecerão aqui" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <SortableTh label="Nome" sortKey="name" currentSort={sort} onSort={toggleSort} />
            <SortableTh label="Concluídos" sortKey="modulesCompleted" currentSort={sort} onSort={toggleSort} align="right" />
            <SortableTh label="% médio" sortKey="avgPercent" currentSort={sort} onSort={toggleSort} align="right" />
            <SortableTh label="Setor" sortKey="sectorName" currentSort={sort} onSort={toggleSort} align="right" />
          </tr>
        </thead>
        <tbody>
          {users.map((u: any) => (
            <tr key={u.id} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer" onClick={() => onUserClick(u.id)}>
              <td className="py-2 px-3">
                <p className="font-medium text-foreground truncate">{u.name || u.email}</p>
                <p className="text-xs text-muted-foreground truncate">{u.sectorName || 'Sem setor'} {u.branchName ? ` · ${u.branchName}` : ''}</p>
              </td>
              <td className="py-2 px-3 text-right font-semibold">{u.modulesCompleted}</td>
              <td className="py-2 px-3 text-right">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${highlight === 'good' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{u.avgPercent}%</span>
              </td>
              <td className="py-2 px-3 text-right text-xs text-muted-foreground truncate max-w-[100px]">{u.sectorName ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ==================== SURVEYS TAB ==================== */
function SurveysTab({ filters }: { filters: any }) {
  const [surveyType, setSurveyType] = useState<string | undefined>(undefined);
  const ratesQ = trpc.analytics.surveyResponseRate.useQuery();
  const trendQ = trpc.analytics.surveyTrendOverTime.useQuery({ days: 30 });
  const [selectedSurvey, setSelectedSurvey] = useState<number | null>(null);
  const likertQ = trpc.analytics.surveyLikertDistribution.useQuery(
    { surveyId: selectedSurvey ?? 0 },
    { enabled: selectedSurvey !== null }
  );

  let rates = ratesQ.data ?? [];
  if (surveyType) rates = rates.filter((s: any) => (s.category ?? "").toLowerCase().includes(surveyType.toLowerCase()));
  const sortedRates = useSort(rates, "rate", "desc");
  const trend = trendQ.data ?? [];

  return (
    <div className="space-y-6">
      <FilterBar>
        <FilterSelect
          value={surveyType}
          onChange={(v) => setSurveyType(v as any)}
          options={[
            { value: "drps", label: "DRPS" },
            { value: "aep", label: "AEP" },
            { value: "custom", label: "Custom" },
          ]}
          placeholder="Todos os tipos"
        />
      </FilterBar>

      <SectionCard title="Taxa de Resposta por Pesquisa" subtitle="Clique no cabeçalho para ordenar">
        {sortedRates.sorted.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <SortableTh label="Pesquisa" sortKey="title" currentSort={sortedRates.sort} onSort={sortedRates.toggleSort} />
                  <SortableTh label="Categoria" sortKey="category" currentSort={sortedRates.sort} onSort={sortedRates.toggleSort} />
                  <SortableTh label="Respostas" sortKey="responses" currentSort={sortedRates.sort} onSort={sortedRates.toggleSort} align="right" />
                  <SortableTh label="Taxa" sortKey="rate" currentSort={sortedRates.sort} onSort={sortedRates.toggleSort} align="right" />
                  <SortableTh label="Status" sortKey="status" currentSort={sortedRates.sort} onSort={sortedRates.toggleSort} align="right" />
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {sortedRates.sorted.map((s: any) => (
                  <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedSurvey(s.id)}>
                    <td className="py-2.5 px-3 font-medium text-foreground">{s.title}</td>
                    <td className="py-2.5 px-3 text-muted-foreground text-xs">{s.category ?? '-'}</td>
                    <td className="py-2.5 px-3 text-right">{s.responses}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.rate >= 60 ? 'bg-emerald-50 text-emerald-700' : s.rate >= 30 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'}`}>
                        {s.rate}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-xs text-muted-foreground capitalize">{s.status}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="text-xs text-primary hover:underline inline-flex items-center gap-1"><Eye size={12} /> Detalhes</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={ClipboardList} title="Sem pesquisas ainda" hint="Crie uma pesquisa em /admin/pesquisas para começar" />
        )}
      </SectionCard>

      <SectionCard title="Evolução das Respostas (últimos 30 dias)" subtitle="Volume diário de respostas">
        {trend.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="responses" stroke={COLORS.primary} fill={COLORS.primary} fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState icon={TrendingUp} title="Sem respostas no período" hint="As respostas dos últimos 30 dias aparecerão aqui" />
        )}
      </SectionCard>

      {selectedSurvey !== null && (
        <SectionCard
          title="Distribuição das Respostas Likert"
          subtitle="Média e contagem por opção (1=discordo totalmente → 5=concordo totalmente)"
          action={<button onClick={() => setSelectedSurvey(null)} className="text-xs text-muted-foreground hover:text-foreground"><X size={14} /></button>}
        >
          {likertQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (likertQ.data?.length ?? 0) > 0 ? (
            <div className="space-y-3">
              {likertQ.data!.map(q => (
                <div key={q.id} className="border-b border-border/50 last:border-0 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-foreground flex-1">{q.questionText}</p>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">média</p>
                      <p className="text-lg font-bold" style={{ color: q.avgScore && q.avgScore >= 4 ? COLORS.good : q.avgScore && q.avgScore >= 3 ? COLORS.warn : COLORS.bad }}>
                        {q.avgScore ?? '-'}
                      </p>
                    </div>
                  </div>
                  {q.totalAnswers > 0 && (
                    <div className="mt-2 flex gap-0.5">
                      {q.distribution.map((cnt, i) => {
                        const pct = q.totalAnswers > 0 ? (cnt / q.totalAnswers) * 100 : 0;
                        const bgs = [COLORS.bad, "#fb923c", COLORS.warn, "#84cc16", COLORS.good];
                        return (
                          <div key={i} className="flex-1 group relative">
                            <div className="h-6 rounded" style={{ width: '100%', background: bgs[i], opacity: 0.85 }} title={`${i+1}: ${cnt} resp (${Math.round(pct)}%)`}>
                            </div>
                            <p className="text-xs text-center text-muted-foreground mt-1">{cnt}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={ClipboardList} title="Sem respostas para essa pesquisa" hint="Quando colaboradores responderem, aparecerá aqui" />
          )}
        </SectionCard>
      )}
    </div>
  );
}

/* ==================== ENGAGEMENT TAB ==================== */
function EngagementTab({ filters, drill, setDrill }: { filters: any; drill: DrillState; setDrill: (d: DrillState) => void }) {
  const heatmapQ = trpc.analytics.sectorModuleHeatmap.useQuery();
  const lbQ = trpc.analytics.userLeaderboard.useQuery({ limit: 30, branchId: drill.branchId, sectorId: drill.sectorId });
  const campQ = trpc.analytics.campaignEffectiveness.useQuery();

  const hm = heatmapQ.data;
  const lbSort = useSort(lbQ.data ?? [], "engagementScore", "desc");

  return (
    <div className="space-y-6">
      <SectionCard title="Heatmap Setor × Curso" subtitle="% médio assistido · clique em uma célula para drill setor">
        {hm && hm.sectors.length > 0 && hm.modules.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="text-left p-2 sticky left-0 bg-white">Setor / Curso</th>
                  {hm.modules.map(m => (
                    <th key={m.id} className="p-1 min-w-[60px] text-[10px] text-muted-foreground" title={m.title}>
                      <div className="rotate-[-30deg] origin-left h-12 truncate" style={{ width: 60 }}>{m.title.length > 12 ? m.title.slice(0,12)+'…' : m.title}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hm.sectors.map(s => (
                  <tr key={s.id}>
                    <td
                      className="p-2 font-medium sticky left-0 bg-white whitespace-nowrap cursor-pointer hover:text-primary"
                      onClick={() => setDrill({ ...drill, sectorId: s.id })}
                    >
                      {s.name}
                    </td>
                    {hm.modules.map(m => {
                      const cell = hm.cells.find(c => c.sectorId === s.id && c.moduleId === m.id);
                      const v = cell?.avgPercent ?? null;
                      const bg = v === null ? '#f3f4f6' : v >= 75 ? '#10b981' : v >= 50 ? '#84cc16' : v >= 25 ? '#f59e0b' : '#ef4444';
                      const txt = v === null ? '#9ca3af' : v >= 50 ? 'white' : '#111';
                      return (
                        <td key={m.id} className="p-1 text-center">
                          <div
                            className="rounded text-[10px] font-medium py-1 cursor-pointer hover:opacity-80"
                            style={{ background: bg, color: txt }}
                            title={cell ? `${v}% (${cell.completed}/${cell.totalUsers})` : 'Sem dados'}
                            onClick={() => setDrill({ ...drill, sectorId: s.id })}
                          >
                            {v === null ? '-' : `${v}%`}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Layers} title="Sem dados de heatmap" hint="Cadastre setores e atribua colaboradores aos cursos" />
        )}
      </SectionCard>

      <div className="grid md:grid-cols-2 gap-6">
        <SectionCard title="🥇 Leaderboard de Engajamento" subtitle="Clique no nome para ver o perfil detalhado">
          {lbSort.sorted.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <SortableTh label="Colaborador" sortKey="name" currentSort={lbSort.sort} onSort={lbSort.toggleSort} />
                    <SortableTh label="Pts" sortKey="engagementScore" currentSort={lbSort.sort} onSort={lbSort.toggleSort} align="right" />
                    <SortableTh label="Cursos" sortKey="modulesCompleted" currentSort={lbSort.sort} onSort={lbSort.toggleSort} align="right" />
                    <SortableTh label="Pesquisas" sortKey="surveyResp" currentSort={lbSort.sort} onSort={lbSort.toggleSort} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {lbSort.sorted.map((u: any, i: number) => (
                    <tr key={u.id} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer" onClick={() => setDrill({ ...drill, userId: u.id })}>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${i===0?'bg-yellow-100 text-yellow-700':i===1?'bg-gray-100 text-gray-700':i===2?'bg-orange-100 text-orange-700':'bg-muted text-muted-foreground'}`}>{i+1}</span>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{u.name || u.email}</p>
                            <p className="text-xs text-muted-foreground truncate">{u.sectorName || 'Sem setor'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-primary">{u.engagementScore}</td>
                      <td className="py-2 px-3 text-right">{u.modulesCompleted}</td>
                      <td className="py-2 px-3 text-right">{u.surveyResp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={Flame} title="Leaderboard vazio" hint="Quando colaboradores começarem a engajar, eles aparecerão aqui" />
          )}
        </SectionCard>

        <SectionCard title="Efetividade de Campanhas" subtitle="Conclusões após envio de email">
          {(campQ.data?.length ?? 0) > 0 ? (
            <div className="space-y-2">
              {campQ.data!.map(c => (
                <div key={c.id} className="p-3 rounded-lg border border-border/50 hover:bg-muted/20">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.campaignType} · {c.sentCount} enviados</p>
                    </div>
                    <span className={`text-xs font-bold ml-2 shrink-0 ${c.conversionRate >= 30 ? 'text-emerald-600' : c.conversionRate >= 10 ? 'text-amber-600' : 'text-red-500'}`}>
                      {c.conversionRate}%
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 bg-muted rounded overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${Math.min(100, c.conversionRate)}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{c.completedAfterCampaign} concluíram depois</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={ClipboardList} title="Sem campanhas" hint="Crie campanhas em /admin/campanhas" />
          )}
        </SectionCard>
      </div>
    </div>
  );
}

/* ==================== RISK TAB ==================== */
function RiskTab({ filters, drill, setDrill }: { filters: any; drill: DrillState; setDrill: (d: DrillState) => void }) {
  const matrixQ = trpc.analytics.riskMatrixByCompany.useQuery();
  const topQ = trpc.analytics.topCriticalFactors.useQuery();
  const evoQ = trpc.analytics.riskEvolution.useQuery();

  const m = matrixQ.data;
  const factorsSort = useSort(topQ.data ?? [], "occurrences", "desc");
  const sectorsSort = useSort(m?.bySector ?? [], "critico", "desc");

  const pieData = m ? [
    { name: "Baixo", value: m.byLevel.find(l => l.level === 'baixo')?.count ?? 0, color: COLORS.good },
    { name: "Médio", value: m.byLevel.find(l => l.level === 'medio')?.count ?? 0, color: COLORS.warn },
    { name: "Alto", value: m.byLevel.find(l => l.level === 'alto')?.count ?? 0, color: COLORS.bad },
    { name: "Crítico", value: m.byLevel.find(l => l.level === 'critico')?.count ?? 0, color: COLORS.critical },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Avaliações Realizadas" value={m?.totalAssessments ?? 0} icon={ShieldAlert} color={COLORS.primary} />
        <KpiCard label="Itens no Inventário" value={m?.totalItems ?? 0} icon={Layers} color={COLORS.accent} />
        <KpiCard label="Riscos Críticos" value={m?.byLevel.find(l => l.level === 'critico')?.count ?? 0} icon={Flame} color={COLORS.critical} />
        <KpiCard label="Riscos Altos" value={m?.byLevel.find(l => l.level === 'alto')?.count ?? 0} icon={ShieldAlert} color={COLORS.bad} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <SectionCard title="Distribuição por Nível" subtitle="Todos os itens consolidados">
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={95} paddingAngle={2} dataKey="value" label={(d: any) => `${d.name}: ${d.value}`}>
                  {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={ShieldAlert} title="Sem matriz consolidada" hint="Aplique seu primeiro DRPS em /admin/analise-risco" />
          )}
        </SectionCard>

        <SectionCard title="🔥 Fatores Mais Críticos" subtitle="Clique no cabeçalho para ordenar">
          {factorsSort.sorted.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <SortableTh label="Fator" sortKey="name" currentSort={factorsSort.sort} onSort={factorsSort.toggleSort} />
                    <SortableTh label="Ocorrências" sortKey="occurrences" currentSort={factorsSort.sort} onSort={factorsSort.toggleSort} align="right" />
                    <SortableTh label="Score DRPS" sortKey="avgDrpsScore" currentSort={factorsSort.sort} onSort={factorsSort.toggleSort} align="right" />
                    <SortableTh label="Crít" sortKey="critico" currentSort={factorsSort.sort} onSort={factorsSort.toggleSort} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {factorsSort.sorted.map((f: any, i: number) => (
                    <tr key={f.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold flex items-center justify-center shrink-0">{i+1}</span>
                          <span className="font-medium text-foreground truncate">{f.name}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right">{f.occurrences}</td>
                      <td className="py-2 px-3 text-right">{f.avgDrpsScore}</td>
                      <td className="py-2 px-3 text-right">
                        {f.critico > 0 && <span className="text-xs font-bold bg-red-50 text-red-700 px-2 py-0.5 rounded-full">{f.critico}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={Flame} title="Sem fatores avaliados" hint="Complete avaliações DRPS para ver os fatores mais críticos" />
          )}
        </SectionCard>
      </div>

      <SectionCard title="Matriz por Setor" subtitle="Clique em um setor para drill-down (até 13 fatores)">
        {sectorsSort.sorted.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sectorsSort.sorted} margin={{ top: 5, right: 10, left: 0, bottom: 70 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} height={80} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="baixo" stackId="r" fill={COLORS.good} name="Baixo" cursor="pointer" onClick={(d: any) => d?.id && setDrill({ ...drill, sectorId: d.id })} />
                <Bar dataKey="medio" stackId="r" fill={COLORS.warn} name="Médio" cursor="pointer" onClick={(d: any) => d?.id && setDrill({ ...drill, sectorId: d.id })} />
                <Bar dataKey="alto" stackId="r" fill={COLORS.bad} name="Alto" cursor="pointer" onClick={(d: any) => d?.id && setDrill({ ...drill, sectorId: d.id })} />
                <Bar dataKey="critico" stackId="r" fill={COLORS.critical} name="Crítico" cursor="pointer" onClick={(d: any) => d?.id && setDrill({ ...drill, sectorId: d.id })} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <SortableTh label="Setor" sortKey="name" currentSort={sectorsSort.sort} onSort={sectorsSort.toggleSort} />
                    <SortableTh label="Crítico" sortKey="critico" currentSort={sectorsSort.sort} onSort={sectorsSort.toggleSort} align="right" />
                    <SortableTh label="Alto" sortKey="alto" currentSort={sectorsSort.sort} onSort={sectorsSort.toggleSort} align="right" />
                    <SortableTh label="Médio" sortKey="medio" currentSort={sectorsSort.sort} onSort={sectorsSort.toggleSort} align="right" />
                    <SortableTh label="Baixo" sortKey="baixo" currentSort={sectorsSort.sort} onSort={sectorsSort.toggleSort} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {sectorsSort.sorted.map((s: any) => (
                    <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer" onClick={() => setDrill({ ...drill, sectorId: s.id })}>
                      <td className="py-1.5 px-3 font-medium">{s.name}</td>
                      <td className="py-1.5 px-3 text-right text-red-700 font-bold">{s.critico}</td>
                      <td className="py-1.5 px-3 text-right text-amber-700">{s.alto}</td>
                      <td className="py-1.5 px-3 text-right text-yellow-700">{s.medio}</td>
                      <td className="py-1.5 px-3 text-right text-emerald-700">{s.baixo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EmptyState icon={Layers} title="Sem setores avaliados" hint="Aplique avaliações por setor para ver a comparação" />
        )}
      </SectionCard>

      <SectionCard title="Evolução do Risco entre Ciclos" subtitle="% de itens críticos+altos por ciclo de avaliação">
        {(evoQ.data?.length ?? 0) > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={evoQ.data!}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="cycleName" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="criticalRatio" name="% críticos+altos" stroke={COLORS.bad} strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState icon={TrendingUp} title="Apenas 1 ou nenhum ciclo de avaliação" hint="Para ver evolução, complete múltiplos ciclos DRPS ao longo do tempo" />
        )}
      </SectionCard>
    </div>
  );
}

/* ==================== SAVED ANALYSES TAB ==================== */
const METRIC_OPTIONS = [
  { value: 'course_completion', label: '% de conclusão de curso' },
  { value: 'modules_completed', label: 'Cursos concluídos (contagem)' },
  { value: 'survey_response', label: 'Pesquisas respondidas (contagem)' },
  { value: 'certificates', label: 'Certificados emitidos' },
  { value: 'active_users', label: 'Usuários ativos (30d)' },
  { value: 'risk_avg', label: 'Risco médio (score DRPS)' },
  { value: 'risk_critical_count', label: 'Riscos críticos+altos (contagem)' },
];
const DIMENSION_OPTIONS = [
  { value: 'branch', label: 'Filial' },
  { value: 'sector', label: 'Setor' },
  { value: 'role', label: 'Cargo' },
  { value: 'module', label: 'Curso' },
  { value: 'risk_factor', label: 'Fator de risco' },
  { value: 'period', label: 'Período (mês)' },
];
const CHART_OPTIONS = [
  { value: 'bar', label: 'Barra' },
  { value: 'line', label: 'Linha' },
  { value: 'pie', label: 'Pizza' },
  { value: 'table', label: 'Tabela' },
];

function SavedTab() {
  const utils = trpc.useUtils();
  const listQ = trpc.analytics.listAnalyses.useQuery();
  const filtersQ = trpc.analytics.filterOptions.useQuery();
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [filterScope, setFilterScope] = useState<"all" | "mine" | "shared">("all");
  const [filterChartType, setFilterChartType] = useState<string | undefined>(undefined);
  const [draft, setDraft] = useState({
    name: '', description: '',
    metric: 'course_completion', dimension: 'sector',
    chartType: 'bar', isShared: false,
    branchId: undefined as number | undefined,
    sectorId: undefined as number | undefined,
  });

  const saveMut = trpc.analytics.saveAnalysis.useMutation({
    onSuccess: () => { toast.success("Análise salva"); utils.analytics.listAnalyses.invalidate(); resetBuilder(); },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });
  const updateMut = trpc.analytics.updateAnalysis.useMutation({
    onSuccess: () => { toast.success("Análise atualizada"); utils.analytics.listAnalyses.invalidate(); resetBuilder(); },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });
  const delMut = trpc.analytics.deleteAnalysis.useMutation({
    onSuccess: () => { toast.success("Análise excluída"); utils.analytics.listAnalyses.invalidate(); },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  function resetBuilder() {
    setShowBuilder(false); setEditingId(null);
    setDraft({ name: '', description: '', metric: 'course_completion', dimension: 'sector', chartType: 'bar', isShared: false, branchId: undefined, sectorId: undefined });
  }

  function startEdit(a: any) {
    setEditingId(a.id);
    setDraft({
      name: a.name, description: a.description ?? '',
      metric: a.metric, dimension: a.dimension,
      chartType: a.chartType, isShared: a.isShared,
      branchId: a.filters?.branchId, sectorId: a.filters?.sectorId,
    });
    setShowBuilder(true);
  }

  function handleSave() {
    if (!draft.name.trim()) { toast.error("Nome obrigatório"); return; }
    const payload = {
      name: draft.name.trim(),
      description: draft.description || undefined,
      metric: draft.metric,
      dimension: draft.dimension,
      filters: { branchId: draft.branchId, sectorId: draft.sectorId },
      chartType: draft.chartType,
      isShared: draft.isShared,
    };
    if (editingId !== null) updateMut.mutate({ id: editingId, ...payload });
    else saveMut.mutate(payload);
  }

  let list = listQ.data ?? [];
  if (filterScope === "mine") list = list.filter((a: any) => a.isOwner);
  else if (filterScope === "shared") list = list.filter((a: any) => a.isShared);
  if (filterChartType) list = list.filter((a: any) => a.chartType === filterChartType);
  const listSort = useSort(list, "lastRunAt", "desc");
  const filterOpts = filtersQ.data;

  return (
    <div className="space-y-6">
      <FilterBar>
        <FilterSelect value={filterScope === "all" ? undefined : filterScope} onChange={(v) => setFilterScope((v as any) || "all")} options={[
          { value: "mine", label: "Apenas minhas" },
          { value: "shared", label: "Compartilhadas" },
        ]} placeholder="Todas" />
        <FilterSelect value={filterChartType} onChange={(v) => setFilterChartType(v as any)} options={CHART_OPTIONS} placeholder="Qualquer tipo" />
        <FilterSelect value={listSort.sort.key} onChange={(v) => v && listSort.toggleSort(v as string)} options={[
          { value: "lastRunAt", label: "Última execução" },
          { value: "createdAt", label: "Criada em" },
          { value: "name", label: "Nome" },
        ]} placeholder="Ordenar por..." />
      </FilterBar>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Minhas Análises</h2>
          <p className="text-xs text-muted-foreground">Análises personalizadas salvas. Compartilhadas com sua equipe aparecem para todos os admins da empresa.</p>
        </div>
        <Button onClick={() => { resetBuilder(); setShowBuilder(true); }} className="flex items-center gap-2">
          <Plus size={16} /> Nova análise
        </Button>
      </div>

      {showBuilder && (
        <SectionCard title={editingId ? "Editar Análise" : "Nova Análise"} action={<button onClick={resetBuilder} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>}>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Nome*</label>
              <input value={draft.name} onChange={e => setDraft({...draft, name: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm" placeholder="Ex: Conclusão por setor — TI" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Descrição</label>
              <input value={draft.description} onChange={e => setDraft({...draft, description: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm" placeholder="Opcional" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Métrica principal*</label>
              <select value={draft.metric} onChange={e => setDraft({...draft, metric: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                {METRIC_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Dimensão de cruzamento*</label>
              <select value={draft.dimension} onChange={e => setDraft({...draft, dimension: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                {DIMENSION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Filtro: Filial</label>
              <select value={draft.branchId ?? ''} onChange={e => setDraft({...draft, branchId: e.target.value ? Number(e.target.value) : undefined})} className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                <option value="">Todas as filiais</option>
                {filterOpts?.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Filtro: Setor</label>
              <select value={draft.sectorId ?? ''} onChange={e => setDraft({...draft, sectorId: e.target.value ? Number(e.target.value) : undefined})} className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                <option value="">Todos os setores</option>
                {filterOpts?.sectors.filter(s => !draft.branchId || s.branchId === draft.branchId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Tipo de gráfico</label>
              <select value={draft.chartType} onChange={e => setDraft({...draft, chartType: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                {CHART_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 mt-6">
              <input id="shared" type="checkbox" checked={draft.isShared} onChange={e => setDraft({...draft, isShared: e.target.checked})} className="rounded" />
              <label htmlFor="shared" className="text-sm">Compartilhar com a equipe</label>
            </div>
          </div>
          <div className="mt-4 flex gap-2 justify-end">
            <Button variant="outline" onClick={resetBuilder}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMut.isPending || updateMut.isPending}>
              {editingId ? "Salvar alterações" : "Salvar análise"}
            </Button>
          </div>
        </SectionCard>
      )}

      {listSort.sorted.length === 0 ? (
        <EmptyState icon={Sparkles} title="Nenhuma análise" hint="Clique em 'Nova análise' para criar sua primeira análise customizada" />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {listSort.sorted.map((a: any) => (
            <div key={a.id} className="bg-white rounded-xl border border-border p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col">
              <div className="flex items-start justify-between mb-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-foreground truncate">{a.name}</h3>
                  {a.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{a.description}</p>}
                </div>
                {a.isShared && <Share2 size={14} className="text-primary shrink-0 ml-2" />}
              </div>
              <div className="flex flex-wrap gap-1 mt-2 mb-3">
                <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">{METRIC_OPTIONS.find(m => m.value === a.metric)?.label ?? a.metric}</span>
                <span className="text-xs px-2 py-0.5 bg-secondary/20 text-foreground rounded-full">por {DIMENSION_OPTIONS.find(d => d.value === a.dimension)?.label ?? a.dimension}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {a.authorName ? `por ${a.authorName} · ` : ''}{a.lastRunAt ? `Última execução: ${new Date(a.lastRunAt).toLocaleDateString('pt-BR')}` : 'Nunca executada'}
              </p>
              <div className="mt-auto flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setViewingId(a.id)} className="flex-1 flex items-center gap-1">
                  <Eye size={13} /> Executar
                </Button>
                {a.isOwner && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => startEdit(a)} title="Editar">
                      <Filter size={13} />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { if (confirm(`Excluir "${a.name}"?`)) delMut.mutate({ id: a.id }); }} title="Excluir">
                      <Trash2 size={13} className="text-red-500" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewingId !== null && (
        <AnalysisRunner id={viewingId} onClose={() => setViewingId(null)} />
      )}
    </div>
  );
}

function AnalysisRunner({ id, onClose }: { id: number; onClose: () => void }) {
  const q = trpc.analytics.runAnalysis.useQuery({ id });
  const utils = trpc.useUtils();
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-border flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{q.data?.config.name ?? 'Carregando...'}</h3>
            {q.data?.config.description && <p className="text-xs text-muted-foreground mt-0.5">{q.data.config.description}</p>}
            {q.data?.generatedAt && <p className="text-xs text-muted-foreground mt-1">Gerado em {new Date(q.data.generatedAt).toLocaleString('pt-BR')}</p>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => utils.analytics.runAnalysis.invalidate({ id })}>
              <RefreshCw size={13} className="mr-1" /> Recalcular
            </Button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1"><X size={20} /></button>
          </div>
        </div>
        <div className="p-5">
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Calculando...</p>
          ) : (q.data?.data.length ?? 0) === 0 ? (
            <EmptyState icon={BarChart3} title="Sem dados para esses critérios" hint="Tente ajustar os filtros ou aguarde a coleta de mais dados" />
          ) : (
            <RenderChart data={q.data!.data} chartType={q.data!.config.chartType} />
          )}
        </div>
      </div>
    </div>
  );
}

function RenderChart({ data, chartType }: { data: any[]; chartType: string }) {
  if (chartType === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={400}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={70} outerRadius={140} paddingAngle={2} dataKey="value" label={(d: any) => `${d.name}: ${d.value}`}>
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }
  if (chartType === 'line') {
    return (
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={70} interval={0} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke={COLORS.primary} strokeWidth={2} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }
  if (chartType === 'table') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border"><th className="text-left py-2 px-3">Dimensão</th><th className="text-right py-2 px-3">Valor</th></tr></thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-muted/30"><td className="py-2 px-3">{d.name}</td><td className="py-2 px-3 text-right font-medium">{d.value}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={80} interval={0} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="value" fill={COLORS.primary} radius={[4,4,0,0]}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ==================== MAIN PAGE ==================== */
export default function AdminAnalytics() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [drill, setDrillState] = useState<DrillState>({});
  const [period, setPeriod] = useState<number | undefined>(30);

  const filtersQ = trpc.analytics.filterOptions.useQuery();
  const filterOpts = filtersQ.data;

  const filters = useMemo(() => ({
    branchId: drill.branchId,
    sectorId: drill.sectorId,
    days: period,
  }), [drill.branchId, drill.sectorId, period]);

  const setDrill = (d: DrillState) => setDrillState(d);
  const clearDrill = (level: "branch" | "sector") => {
    if (level === "branch") setDrillState({});
    else setDrillState({ branchId: drill.branchId });
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="relative pl-4">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary to-transparent" />
            <h1 className="text-3xl font-bold text-primary flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
              <LineChartIcon className="text-primary" /> Análises
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Visão analítica completa em tempo real · {new Date().toLocaleDateString('pt-BR')}</p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <FilterSelect
              value={period}
              onChange={(v) => setPeriod(v as any)}
              options={PERIOD_OPTIONS.filter(p => p.value !== undefined).map(p => ({ value: p.value!, label: p.label }))}
              placeholder="Todo o período"
            />
            <FilterSelect
              value={drill.branchId}
              onChange={(v) => setDrillState({ ...drill, branchId: v as any, sectorId: undefined })}
              options={(filterOpts?.branches ?? []).map((b: any) => ({ value: b.id, label: b.name }))}
              placeholder="Todas as filiais"
            />
            <FilterSelect
              value={drill.sectorId}
              onChange={(v) => setDrillState({ ...drill, sectorId: v as any })}
              options={(filterOpts?.sectors ?? []).filter((s: any) => !drill.branchId || s.branchId === drill.branchId).map((s: any) => ({ value: s.id, label: s.name }))}
              placeholder="Todos os setores"
            />
            {(drill.branchId || drill.sectorId) && (
              <button onClick={() => setDrillState({})} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2">
                <X size={12} /> limpar
              </button>
            )}
          </div>
        </div>

        {/* Drill breadcrumb */}
        <DrillBreadcrumb drill={drill} onClear={clearDrill} branches={filterOpts?.branches} sectors={filterOpts?.sectors} />

        {/* Tabs */}
        <div className="border-b border-border overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {TABS.map(t => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-4 py-2.5 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                  <Icon size={15} /> {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="transition-opacity duration-200">
          {tab === 'overview' && <OverviewTab filters={filters} />}
          {tab === 'courses' && <CoursesTab filters={filters} drill={drill} setDrill={setDrill} filterOpts={filterOpts} />}
          {tab === 'surveys' && <SurveysTab filters={filters} />}
          {tab === 'engagement' && <EngagementTab filters={filters} drill={drill} setDrill={setDrill} />}
          {tab === 'risk' && <RiskTab filters={filters} drill={drill} setDrill={setDrill} />}
          {tab === 'saved' && <SavedTab />}
        </div>

        {/* User drawer */}
        {drill.userId && (
          <UserDrawer userId={drill.userId} onClose={() => setDrillState({ ...drill, userId: undefined })} />
        )}
      </div>
    </AppLayout>
  );
}
