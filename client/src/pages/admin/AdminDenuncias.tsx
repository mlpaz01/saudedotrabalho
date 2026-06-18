import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Shield, Filter, BarChart3, Settings, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const CATEGORY_LABELS: Record<string, string> = {
  assedio_moral: "Assédio Moral", assedio_sexual: "Assédio Sexual",
  discriminacao: "Discriminação", corrupcao: "Corrupção", fraude: "Fraude",
  desvio_conduta: "Desvio de Conduta", seguranca: "Segurança/SST", ambiental: "Ambiental", outros: "Outros",
};
const SEVERITY_BADGE: Record<string, string> = {
  baixa: "bg-slate-100 text-slate-700",
  media: "bg-amber-100 text-amber-800",
  alta: "bg-orange-100 text-orange-800",
  critica: "bg-rose-100 text-rose-800",
};
const STATUS_LABELS: Record<string, string> = {
  received: "Recebida", under_analysis: "Em análise", investigating: "Investigando",
  concluded_substantiated: "Procedente", concluded_unsubstantiated: "Improcedente", archived: "Arquivada",
};
const ROLE_OPTIONS = [
  { v: "admin", l: "Administrador" },
  { v: "company_admin", l: "Admin da Empresa" },
  { v: "rh", l: "RH" },
  { v: "sesmt", l: "SESMT" },
  { v: "chefia", l: "Chefia" },
];

function slaInfo(r: any) {
  if (!r.sla_due_date) return { label: "-", cls: "text-slate-400" };
  const due = new Date(r.sla_due_date);
  const concluded = ["concluded_substantiated", "concluded_unsubstantiated", "archived"].includes(r.status);
  const fmt = due.toLocaleDateString("pt-BR");
  if (concluded) return { label: fmt, cls: "text-slate-500" };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { label: `${fmt} (vencido)`, cls: "text-rose-700 font-semibold" };
  if (diff <= 3) return { label: `${fmt} (${diff}d)`, cls: "text-amber-700 font-semibold" };
  return { label: `${fmt} (${diff}d)`, cls: "text-emerald-700" };
}

function RoutingPanel({ companyId }: { companyId: number }) {
  const utils = trpc.useUtils();
  const routing = trpc.denuncia.getRouting.useQuery({ companyId });
  const [roles, setRoles] = useState<string[]>([]);
  const [notifyEmail, setNotifyEmail] = useState("");

  useEffect(() => {
    if (routing.data) {
      setRoles(Array.isArray(routing.data.routeToRoles) ? routing.data.routeToRoles : []);
      setNotifyEmail(routing.data.notifyEmail || "");
    }
  }, [routing.data]);

  const save = trpc.denuncia.saveRouting.useMutation({
    onSuccess: () => { toast.success("Roteamento salvo."); utils.denuncia.getRouting.invalidate({ companyId }); },
    onError: (e) => toast.error(e.message),
  });

  const toggle = (v: string) => setRoles(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);

  return (
    <div className="bg-white rounded-lg border p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-1"><Settings size={18} className="text-blue-700" />
        <h2 className="text-lg font-semibold">Configurar roteamento</h2></div>
      <p className="text-sm text-muted-foreground mb-5">Defina quais perfis e e-mails recebem notificação a cada nova denúncia registrada.</p>

      <Label className="mb-2 block">Perfis que recebem denúncias</Label>
      <div className="grid grid-cols-2 gap-2 mb-5">
        {ROLE_OPTIONS.map(r => (
          <label key={r.v} className="flex items-center gap-2 text-sm border rounded-md px-3 py-2 cursor-pointer hover:bg-slate-50">
            <input type="checkbox" checked={roles.includes(r.v)} onChange={() => toggle(r.v)} />
            {r.l}
          </label>
        ))}
      </div>

      <Label htmlFor="notifyEmail">E-mail adicional de notificação (opcional)</Label>
      <Input id="notifyEmail" type="email" className="mb-5 mt-1" placeholder="compliance@empresa.com"
        value={notifyEmail} onChange={e => setNotifyEmail(e.target.value)} />

      <Button disabled={save.isPending} onClick={() => save.mutate({ companyId, routeToRoles: roles, routeToUserIds: [], notifyEmail: notifyEmail.trim() || null })}>
        <Save size={16} className="mr-2" /> {save.isPending ? "Salvando…" : "Salvar roteamento"}
      </Button>
    </div>
  );
}

export default function AdminDenuncias() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"list" | "routing">("list");
  const [status, setStatus] = useState<string>("");
  const [category, setCategory] = useState<string>("");

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

  const list = trpc.denuncia.listReports.useQuery({
    companyId: companyId ?? undefined,
    status: status || undefined,
    category: category || undefined,
  });

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Shield className="text-blue-700" size={28} />
            <h1 className="text-2xl font-bold">Canal de Denúncia</h1>
          </div>
          <Link href="/admin/denuncias/indicadores">
            <Button variant="outline"><BarChart3 size={16} className="mr-2" /> Indicadores</Button>
          </Link>
        </div>

        {(isMultiCompany || !(user as any)?.companyId) && (
          <div className="mb-4">
            <Label className="text-xs text-muted-foreground">Empresa</Label>
            <select className="block mt-1 border rounded h-9 px-2 text-sm min-w-[260px]"
              value={companyId ?? ""} onChange={e => setCompanyId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Todas as empresas</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        <div className="flex gap-1 mb-5 border-b">
          <button onClick={() => setTab("list")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "list" ? "border-blue-600 text-blue-700" : "border-transparent text-muted-foreground"}`}>Denúncias</button>
          <button onClick={() => setTab("routing")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "routing" ? "border-blue-600 text-blue-700" : "border-transparent text-muted-foreground"}`}>Configurar roteamento</button>
        </div>

        {tab === "list" && (
          <>
            <div className="bg-white rounded-lg border p-4 mb-4 flex gap-3 items-center flex-wrap">
              <Filter size={16} className="text-muted-foreground" />
              <select className="border rounded h-9 px-2 text-sm" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="">Todos status</option>
                {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select className="border rounded h-9 px-2 text-sm" value={category} onChange={e => setCategory(e.target.value)}>
                <option value="">Todas categorias</option>
                {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>

            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left">
                    <th className="px-3 py-2">Protocolo</th>
                    <th className="px-3 py-2">Categoria</th>
                    <th className="px-3 py-2">Gravidade</th>
                    <th className="px-3 py-2">Anônimo</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Aberta em</th>
                    <th className="px-3 py-2">Prazo SLA</th>
                  </tr>
                </thead>
                <tbody>
                  {list.isLoading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>}
                  {list.data && list.data.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhuma denúncia encontrada.</td></tr>}
                  {(list.data || []).map((r: any) => {
                    const sla = slaInfo(r);
                    return (
                      <tr key={r.id} className="border-t hover:bg-slate-50 cursor-pointer">
                        <td className="px-3 py-2">
                          <Link href={`/admin/denuncias/${r.id}`} className="text-blue-700 hover:underline font-mono">{r.protocol_code}</Link>
                        </td>
                        <td className="px-3 py-2">{CATEGORY_LABELS[r.category] || r.category}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${SEVERITY_BADGE[r.severity] || ""}`}>{r.severity}</span>
                        </td>
                        <td className="px-3 py-2">{r.is_anonymous ? "Sim" : "Não"}</td>
                        <td className="px-3 py-2">{STATUS_LABELS[r.status] || r.status}</td>
                        <td className="px-3 py-2">{r.created_at ? new Date(r.created_at).toLocaleString("pt-BR") : "-"}</td>
                        <td className={`px-3 py-2 ${sla.cls}`}>{sla.label}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "routing" && (
          companyId ? <RoutingPanel companyId={companyId} /> :
          <div className="bg-white rounded-lg border p-6 text-sm text-muted-foreground max-w-2xl">
            Selecione uma empresa acima para configurar o roteamento de denúncias.
          </div>
        )}
      </div>
    </AppLayout>
  );
}
