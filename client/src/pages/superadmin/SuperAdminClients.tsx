import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Shield, History } from "lucide-react";

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

  // P15 #6 — Administração Delegada substituindo a antiga impersonação simples.
  // O SuperAdmin escolhe o perfil que quer assumir na empresa cliente e informa
  // uma justificativa (auditada no servidor). Vazio = volta ao SuperAdmin normal.
  const [delegateFor, setDelegateFor] = useState<any | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const logMut = trpc.superAdmin.logDelegatedAction.useMutation();

  return (
    <AppLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Clientes</h1>
          <div className="flex gap-2">
            <button onClick={() => setShowLogs(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm">
              <History size={14} /> Auditoria de acessos delegados
            </button>
            <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium">
              <Plus size={16} /> Novo cliente
            </button>
          </div>
        </div>
        {typeof window !== "undefined" && localStorage.getItem("impersonatedCompanyId") && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm flex justify-between items-center">
            <div><b className="text-amber-900">Sessão delegada ativa</b> — empresa {localStorage.getItem("impersonatedCompanyId")} · perfil {localStorage.getItem("delegatedRole") ?? "super_admin"}. Todas as ações estão sendo auditadas.</div>
            <button onClick={() => { localStorage.removeItem("impersonatedCompanyId"); localStorage.removeItem("delegatedRole"); window.location.reload(); }} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-semibold">Encerrar sessão delegada</button>
          </div>
        )}

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
                    <button onClick={() => setDelegateFor(c)} className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 mr-2 inline-flex items-center gap-1"><Shield size={11} /> Administrar como</button>
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

        {delegateFor && (
          <DelegateModal client={delegateFor} onClose={() => setDelegateFor(null)}
            onConfirm={(role, justification) => {
              logMut.mutate({ companyId: delegateFor.id, delegatedRole: role, action: "start_session", justification },
                { onSuccess: () => {
                  localStorage.setItem("impersonatedCompanyId", String(delegateFor.id));
                  if (role !== "super_admin") localStorage.setItem("delegatedRole", role); else localStorage.removeItem("delegatedRole");
                  toast.success(`Sessão delegada iniciada em ${delegateFor.name} como ${role}. Auditada.`);
                  window.location.href = "/plataforma/dashboard";
                }, onError: (e: any) => toast.error(e?.message ?? "Erro") });
            }}
          />
        )}
        {showLogs && <DelegatedLogsModal onClose={() => setShowLogs(false)} />}

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

// P15 #6 — Modal para escolher o perfil delegado + justificativa obrigatória.
function DelegateModal({ client, onClose, onConfirm }: any) {
  const [role, setRole] = useState("rh");
  const [just, setJust] = useState("");
  const roles = [
    { v: "rh", l: "RH — administrar ciclos, campanhas, pesquisas, cursos" },
    { v: "sesmt", l: "SESMT — PGR e GSE" },
    { v: "psicologo", l: "Psicólogo — agenda e evolução (restrito)" },
    { v: "chefia", l: "Chefia — visão de setor/filial" },
    { v: "company_admin", l: "Admin da empresa — acesso amplo" },
    { v: "cipa", l: "Integrante da CIPA — reuniões e atas" },
    { v: "super_admin", l: "Somente escopo (sem trocar perfil) — visualização" },
  ];
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 max-w-lg w-full space-y-3" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold flex items-center gap-2"><Shield size={18} className="text-primary" /> Administração Delegada — {client.name}</h2>
        <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800">
          Todas as ações executadas nesta sessão delegada serão auditadas (operador, data/hora, IP, ação, perfil assumido).
          Não é permitido acessar dados clínicos sob sigilo profissional.
        </div>
        <label className="block text-sm">Perfil a assumir na empresa
          <select value={role} onChange={e => setRole(e.target.value)} className="w-full mt-1 border rounded p-2">
            {roles.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
          </select>
        </label>
        <label className="block text-sm">Justificativa (obrigatória)
          <textarea value={just} onChange={e => setJust(e.target.value)} rows={3} className="w-full mt-1 border rounded p-2" placeholder="Ex.: Suporte técnico, cliente sem RH interno solicitou apoio na abertura do ciclo psicossocial." />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded border">Cancelar</button>
          <button onClick={() => { if (!just.trim()) return toast.error("Justificativa obrigatória"); onConfirm(role, just.trim()); }}
            className="px-4 py-2 text-sm rounded bg-primary text-white">Iniciar sessão delegada</button>
        </div>
      </div>
    </div>
  );
}

// P15 #6 — Auditoria consolidada de todos os acessos delegados.
function DelegatedLogsModal({ onClose }: any) {
  const q = trpc.superAdmin.listDelegatedLogs.useQuery({});
  const rows = (q.data ?? []) as any[];
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full space-y-3 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold flex items-center gap-2"><History size={18} className="text-primary" /> Auditoria de acessos delegados</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-slate-50"><tr>
            <th className="text-left p-2">Data</th><th className="text-left p-2">Operador</th><th className="p-2">Empresa</th><th className="p-2">Perfil</th><th className="text-left p-2">Ação</th><th className="p-2">IP</th><th className="text-left p-2">Justificativa</th>
          </tr></thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id} className="border-t">
                <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                <td className="p-2">{r.operator_email}</td>
                <td className="p-2 text-center">#{r.company_id}</td>
                <td className="p-2 text-center">{r.delegated_role}</td>
                <td className="p-2">{r.action}</td>
                <td className="p-2 text-slate-500 text-[10px]">{r.ip_address ?? "—"}</td>
                <td className="p-2 text-slate-500">{r.justification ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-400">Nenhum acesso delegado registrado ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
