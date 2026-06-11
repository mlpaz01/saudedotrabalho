import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Building2, DollarSign, Users, TrendingDown, Plus } from "lucide-react";

function StatusBadge({ status }: { status?: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "Ativo", cls: "bg-green-100 text-green-700" },
    trial: { label: "Trial", cls: "bg-yellow-100 text-yellow-700" },
    past_due: { label: "Inadimplente", cls: "bg-red-100 text-red-700" },
    canceled: { label: "Cancelado", cls: "bg-gray-200 text-gray-700" },
  };
  const s = map[status ?? "trial"] ?? map.trial;
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>;
}

export default function SuperAdminDashboard() {
  const overview = trpc.superAdmin.overview.useQuery();
  const companies = trpc.superAdmin.listCompanies.useQuery();

  const o = overview.data;
  const list = companies.data ?? [];

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary">Painel Super Admin</h1>
            <p className="text-sm text-muted-foreground">Visão consolidada de toda a plataforma</p>
          </div>
          <Link href="/super-admin/clientes">
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90">
              <Plus size={16} /> Adicionar cliente
            </button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 border">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase"><Building2 size={14} /> Clientes ativos</div>
            <div className="text-3xl font-bold text-primary mt-2">{o?.activeCompanies ?? 0}</div>
            <div className="text-xs text-muted-foreground">de {o?.totalCompanies ?? 0} total</div>
          </div>
          <div className="bg-white rounded-lg p-4 border">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase"><DollarSign size={14} /> MRR Total</div>
            <div className="text-3xl font-bold text-primary mt-2">R$ {(o?.totalMrr ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="bg-white rounded-lg p-4 border">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase"><Users size={14} /> Colaboradores</div>
            <div className="text-3xl font-bold text-primary mt-2">{o?.totalEmployees ?? 0}</div>
          </div>
          <div className="bg-white rounded-lg p-4 border">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase"><TrendingDown size={14} /> Churn 30d</div>
            <div className="text-3xl font-bold text-primary mt-2">{o?.churn30d ?? 0}</div>
          </div>
        </div>

        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b font-medium">Clientes</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Empresa</th>
                  <th className="text-left p-3">Plano</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Colaboradores</th>
                  <th className="text-right p-3">Conteúdos</th>
                  <th className="text-right p-3">MRR</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c: any) => (
                  <tr key={c.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 font-medium">{c.name}</td>
                    <td className="p-3 capitalize">{c.plan ?? "essencial"}</td>
                    <td className="p-3"><StatusBadge status={c.subscriptionStatus} /></td>
                    <td className="p-3 text-right">{c.employeesCount ?? 0}</td>
                    <td className="p-3 text-right">{c.enrolledContentCount ?? 0}</td>
                    <td className="p-3 text-right">R$ {Number(c.mrr ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum cliente ainda.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
