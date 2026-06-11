import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";

export default function SuperAdminClients() {
  const list = trpc.superAdmin.listCompanies.useQuery();
  const create = trpc.superAdmin.createCompany.useMutation({
    onSuccess: () => { toast.success("Cliente criado"); list.refetch(); setShowNew(false); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.superAdmin.updateCompany.useMutation({
    onSuccess: () => { toast.success("Cliente atualizado"); list.refetch(); setEditing(null); },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.superAdmin.deleteCompany.useMutation({
    onSuccess: () => { toast.success("Cliente removido"); list.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ name: "", cnpj: "", plan: "essencial", subscriptionStatus: "trial", mrr: 0, maxEmployees: 50 });
  const resetForm = () => setForm({ name: "", cnpj: "", plan: "essencial", subscriptionStatus: "trial", mrr: 0, maxEmployees: 50 });

  function impersonate(c: any) {
    localStorage.setItem("impersonatedCompanyId", String(c.id));
    toast.success(`Acessando como ${c.name}`);
    window.location.href = "/plataforma/dashboard";
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Clientes</h1>
          <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium">
            <Plus size={16} /> Novo cliente
          </button>
        </div>

        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                <th className="p-3 text-left">Nome</th>
                <th className="p-3 text-left">CNPJ</th>
                <th className="p-3 text-left">Plano</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">MRR</th>
                <th className="p-3 text-right">Colab.</th>
                <th className="p-3 text-right">Limite</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(list.data ?? []).map((c: any) => (
                <tr key={c.id} className="border-t">
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3">{c.cnpj ?? "-"}</td>
                  <td className="p-3 capitalize">{c.plan ?? "essencial"}</td>
                  <td className="p-3">{c.subscriptionStatus ?? "trial"}</td>
                  <td className="p-3 text-right">R$ {Number(c.mrr ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                  <td className="p-3 text-right">{c.employeesCount ?? 0}</td>
                  <td className="p-3 text-right">{c.maxEmployees ?? 50}</td>
                  <td className="p-3 text-right">
                    <button onClick={() => impersonate(c)} className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 mr-2">Acessar como</button>
                    <button onClick={() => setEditing(c)} className="p-1 hover:bg-muted rounded"><Pencil size={14} /></button>
                    <button onClick={() => confirm("Remover cliente?") && del.mutate({ id: c.id })} className="p-1 hover:bg-red-100 text-red-600 rounded"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {(list.data ?? []).length === 0 && (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhum cliente.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {(showNew || editing) && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-3">
              <h2 className="text-lg font-bold">{editing ? "Editar cliente" : "Novo cliente"}</h2>
              {!editing && (
                <>
                  <label className="block text-sm">Nome
                    <input className="w-full mt-1 border rounded p-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </label>
                  <label className="block text-sm">CNPJ
                    <input className="w-full mt-1 border rounded p-2" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
                  </label>
                </>
              )}
              <label className="block text-sm">Plano
                <select className="w-full mt-1 border rounded p-2" value={editing?.plan ?? form.plan}
                  onChange={(e) => editing ? setEditing({ ...editing, plan: e.target.value }) : setForm({ ...form, plan: e.target.value })}>
                  <option value="essencial">Essencial</option>
                  <option value="profissional">Profissional</option>
                  <option value="empresarial">Empresarial</option>
                </select>
              </label>
              <label className="block text-sm">Status
                <select className="w-full mt-1 border rounded p-2" value={editing?.subscriptionStatus ?? form.subscriptionStatus}
                  onChange={(e) => editing ? setEditing({ ...editing, subscriptionStatus: e.target.value }) : setForm({ ...form, subscriptionStatus: e.target.value })}>
                  <option value="trial">Trial</option>
                  <option value="active">Ativo</option>
                  <option value="past_due">Inadimplente</option>
                  <option value="canceled">Cancelado</option>
                </select>
              </label>
              <label className="block text-sm">MRR (R$)
                <input type="number" className="w-full mt-1 border rounded p-2" value={editing?.mrr ?? form.mrr}
                  onChange={(e) => editing ? setEditing({ ...editing, mrr: e.target.value }) : setForm({ ...form, mrr: Number(e.target.value) })} />
              </label>
              <label className="block text-sm">Limite de colaboradores
                <input type="number" className="w-full mt-1 border rounded p-2" value={editing?.maxEmployees ?? form.maxEmployees}
                  onChange={(e) => editing ? setEditing({ ...editing, maxEmployees: Number(e.target.value) }) : setForm({ ...form, maxEmployees: Number(e.target.value) })} />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => { setShowNew(false); setEditing(null); }} className="px-4 py-2 text-sm rounded border">Cancelar</button>
                <button
                  onClick={() => {
                    if (editing) {
                      update.mutate({ id: editing.id, plan: editing.plan, subscriptionStatus: editing.subscriptionStatus, mrr: Number(editing.mrr), maxEmployees: Number(editing.maxEmployees) });
                    } else {
                      create.mutate({ ...form, mrr: Number(form.mrr) });
                    }
                  }}
                  className="px-4 py-2 text-sm rounded bg-primary text-white">Salvar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
