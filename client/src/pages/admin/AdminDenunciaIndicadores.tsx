import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { ArrowLeft, BarChart3, Clock, CheckCircle2, FolderOpen, AlertTriangle } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  assedio_moral: "Assédio Moral", assedio_sexual: "Assédio Sexual",
  discriminacao: "Discriminação", corrupcao: "Corrupção", fraude: "Fraude",
  desvio_conduta: "Desvio de Conduta", seguranca: "Segurança/SST", ambiental: "Ambiental", outros: "Outros",
};
const STATUS_LABELS: Record<string, string> = {
  received: "Recebida", under_analysis: "Em análise", investigating: "Investigando",
  concluded_substantiated: "Procedente", concluded_unsubstantiated: "Improcedente", archived: "Arquivada",
};

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1"><span className="text-slate-700">{label}</span><span className="font-semibold">{value}</span></div>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string | number; tone: string }) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className={`flex items-center gap-2 text-sm ${tone}`}>{icon}{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

export default function AdminDenunciaIndicadores() {
  const { user } = useAuth();
  const tree = trpc.admin.hierarchyTree.useQuery();
  const companies = useMemo(
    () => (tree.data ?? []).map((c: any) => ({ id: c.company.id, name: c.company.name })),
    [tree.data]
  );
  const [companyId, setCompanyId] = useState<number | null>(null);
  useEffect(() => {
    if (companyId == null) {
      if ((user as any)?.companyId) setCompanyId((user as any).companyId);
      else if (companies.length === 1) setCompanyId(companies[0].id);
    }
  }, [user, companies, companyId]);
  const isMultiCompany = companies.length > 1;

  const stats = trpc.denuncia.dashboardStats.useQuery({ companyId: companyId ?? undefined });
  const d = stats.data;

  const maxPeriod = Math.max(1, ...((d?.byPeriod || []).map((x: any) => Number(x.total))));
  const maxCat = Math.max(1, ...((d?.byCategory || []).map((x: any) => Number(x.total))));
  const maxSector = Math.max(1, ...((d?.bySector || []).map((x: any) => Number(x.total))));
  const maxStatus = Math.max(1, ...((d?.byStatus || []).map((x: any) => Number(x.total))));

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <BarChart3 className="text-blue-700" size={28} />
            <h1 className="text-2xl font-bold">Indicadores do Canal de Denúncia</h1>
          </div>
          <Link href="/admin/denuncias">
            <button className="text-sm text-blue-700 hover:underline flex items-center gap-1"><ArrowLeft size={15} /> Voltar às denúncias</button>
          </Link>
        </div>

        {(isMultiCompany || !(user as any)?.companyId) && (
          <div className="mb-5">
            <select className="border rounded h-9 px-2 text-sm min-w-[260px]"
              value={companyId ?? ""} onChange={e => setCompanyId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Todas as empresas</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        {stats.isLoading && <div className="text-muted-foreground">Carregando indicadores…</div>}

        {d && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Kpi icon={<FolderOpen size={16} />} label="Total de denúncias" value={d.total} tone="text-slate-600" />
              <Kpi icon={<AlertTriangle size={16} />} label="Abertas" value={d.open} tone="text-amber-700" />
              <Kpi icon={<CheckCircle2 size={16} />} label="Concluídas" value={d.concluded} tone="text-emerald-700" />
              <Kpi icon={<Clock size={16} />} label="Tempo médio (dias)" value={Math.round(d.avgResolutionDays || 0)} tone="text-blue-700" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg border p-5">
                <h2 className="font-semibold mb-4">Por período (últimos 12 meses)</h2>
                {(d.byPeriod || []).length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
                {(d.byPeriod || []).map((x: any) => (
                  <Bar key={x.period} label={x.period} value={Number(x.total)} max={maxPeriod} color="bg-blue-500" />
                ))}
              </div>

              <div className="bg-white rounded-lg border p-5">
                <h2 className="font-semibold mb-4">Categorias recorrentes</h2>
                {(d.byCategory || []).length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
                {(d.byCategory || []).map((x: any) => (
                  <Bar key={x.category} label={CATEGORY_LABELS[x.category] || x.category} value={Number(x.total)} max={maxCat} color="bg-indigo-500" />
                ))}
              </div>

              <div className="bg-white rounded-lg border p-5">
                <h2 className="font-semibold mb-4">Setores com maior incidência</h2>
                {(d.bySector || []).length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
                {(d.bySector || []).map((x: any, i: number) => (
                  <Bar key={i} label={x.sector} value={Number(x.total)} max={maxSector} color="bg-rose-500" />
                ))}
              </div>

              <div className="bg-white rounded-lg border p-5">
                <h2 className="font-semibold mb-4">Abertas vs. concluídas (por status)</h2>
                {(d.byStatus || []).length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
                {(d.byStatus || []).map((x: any) => (
                  <Bar key={x.status} label={STATUS_LABELS[x.status] || x.status} value={Number(x.total)} max={maxStatus} color="bg-emerald-500" />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
