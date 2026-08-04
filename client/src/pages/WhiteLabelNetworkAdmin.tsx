import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Activity, Building2, ChevronRight, FileText, History, Plus, Settings2,
  ShieldCheck, Sparkles, Users,
} from "lucide-react";

type Tab = "painel" | "empresas" | "usuarios" | "crm" | "configuracoes" | "auditoria";

const STATUS_LABELS: Record<string, string> = {
  lead: "Lead",
  negociacao: "Negociação",
  proposta_enviada: "Proposta enviada",
  aguardando_retorno: "Aguardando retorno",
  aprovada: "Aprovada",
  reprovada: "Reprovada",
  convertida: "Convertida",
};

const ROLE_LABELS: Record<string, string> = {
  company_admin: "SuperAdmin da rede",
  admin: "Administrador local",
  rh: "RH",
  sesmt: "SESMT",
  psicologo: "Psicóloga(o)",
  chefia: "Gestor/Chefia",
  cipa: "CIPA",
  user: "Colaborador",
};

const emptyCompany = { name: "", cnpj: "", maxEmployees: 50, plan: "essencial" };
const emptyProposal = {
  companyName: "", cnpj: "", contactName: "", email: "", phone: "",
  employees: 0, monthlyValue: 0, status: "lead", notes: "",
};

function money(value: unknown) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Metric({ label, value, icon }: { label: string; value: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="border bg-white rounded-lg p-4 min-h-[96px]">
      <div className="flex items-center justify-between text-muted-foreground text-xs">
        <span>{label}</span><span className="text-primary">{icon}</span>
      </div>
      <div className="mt-3 text-2xl font-bold text-primary">{value}</div>
    </div>
  );
}

export default function WhiteLabelNetworkAdmin() {
  const [tab, setTab] = useState<Tab>("painel");
  const [showCompany, setShowCompany] = useState(false);
  const [companyForm, setCompanyForm] = useState(emptyCompany);
  const [editingCompany, setEditingCompany] = useState<any | null>(null);
  const [showProposal, setShowProposal] = useState(false);
  const [proposalForm, setProposalForm] = useState<any>(emptyProposal);
  const [userCompanyFilter, setUserCompanyFilter] = useState<number | undefined>();

  const context = (trpc.whiteLabelNetwork as any).context.useQuery();
  const companies = (trpc.whiteLabelNetwork as any).listCompanies.useQuery();
  const users = (trpc.whiteLabelNetwork as any).listUsers.useQuery(
    userCompanyFilter ? { companyId: userCompanyFilter } : undefined,
  );
  const proposals = (trpc.whiteLabelNetwork as any).listProposals.useQuery();
  const audit = (trpc.whiteLabelNetwork as any).listAudit.useQuery(undefined, { enabled: tab === "auditoria" });

  const createCompany = (trpc.whiteLabelNetwork as any).createCompany.useMutation({
    onSuccess: () => {
      toast.success("Empresa criada na rede HASA.");
      companies.refetch(); context.refetch(); setShowCompany(false); setCompanyForm(emptyCompany);
    },
    onError: (e: any) => toast.error(e.message),
  });
  const updateCompany = (trpc.whiteLabelNetwork as any).updateCompany.useMutation({
    onSuccess: () => {
      toast.success("Empresa atualizada.");
      companies.refetch(); setEditingCompany(null);
    },
    onError: (e: any) => toast.error(e.message),
  });
  const saveProposal = (trpc.whiteLabelNetwork as any).upsertProposal.useMutation({
    onSuccess: () => {
      toast.success("Proposta salva.");
      proposals.refetch(); context.refetch(); setShowProposal(false); setProposalForm(emptyProposal);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const ctx = context.data as any;
  const companyRows = (companies.data ?? []) as any[];
  const userRows = (users.data ?? []) as any[];
  const proposalRows = (proposals.data ?? []) as any[];
  const selectedCompany = useMemo(
    () => companyRows.find((c) => Number(c.id) === Number(ctx?.selectedCompanyId)),
    [companyRows, ctx?.selectedCompanyId],
  );

  function administerCompany(company: any) {
    localStorage.setItem("impersonatedCompanyId", String(company.id));
    localStorage.removeItem("delegatedRole");
    window.location.href = "/plataforma/dashboard";
  }

  const tabs: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
    { key: "painel", label: "Painel da rede", icon: <Activity size={15} /> },
    { key: "empresas", label: "Empresas", icon: <Building2 size={15} /> },
    { key: "usuarios", label: "Usuários", icon: <Users size={15} /> },
    { key: "crm", label: "CRM e propostas", icon: <FileText size={15} /> },
    { key: "configuracoes", label: "Configurações", icon: <Settings2 size={15} /> },
    { key: "auditoria", label: "Auditoria", icon: <History size={15} /> },
  ];

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase text-primary">SuperAdmin da rede</div>
            <h1 className="text-2xl font-bold text-slate-900">{ctx?.partner?.brand_name || "Administração White Label"}</h1>
          </div>
          <div className="text-sm border rounded-lg bg-white px-3 py-2">
            Empresa operacional: <strong>{selectedCompany?.name || "Carregando"}</strong>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map((item) => (
            <button key={item.key} onClick={() => setTab(item.key)}
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-2 text-sm ${tab === item.key ? "bg-primary text-white border-primary" : "bg-white text-slate-700"}`}>
              {item.icon}{item.label}
            </button>
          ))}
        </div>

        {tab === "painel" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Metric label="Empresas da rede" value={ctx?.metrics?.companies ?? 0} icon={<Building2 size={17} />} />
              <Metric label="Colaboradores ativos" value={ctx?.metrics?.active_employees ?? 0} icon={<Users size={17} />} />
              <Metric label="Propostas" value={ctx?.proposals?.total ?? 0} icon={<FileText size={17} />} />
              <Metric label="MRR aprovado" value={money(ctx?.proposals?.won_mrr)} icon={<ShieldCheck size={17} />} />
            </div>
            <section className="border-t pt-4">
              <h2 className="font-semibold text-lg mb-3">Empresas da rede</h2>
              <CompanyTable rows={companyRows.slice(0, 8)} onAdminister={administerCompany} onEdit={setEditingCompany} />
            </section>
          </div>
        )}

        {tab === "empresas" && (
          <section className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-lg">Empresas e CNPJs</h2>
              <Button onClick={() => setShowCompany(true)}><Plus size={16} /> Nova empresa</Button>
            </div>
            <CompanyTable rows={companyRows} onAdminister={administerCompany} onEdit={setEditingCompany} />
          </section>
        )}

        {tab === "usuarios" && (
          <section className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <h2 className="font-semibold text-lg">Usuários da rede</h2>
              <select className="border rounded-lg px-3 py-2 text-sm bg-white" value={userCompanyFilter ?? ""}
                onChange={(e) => setUserCompanyFilter(e.target.value ? Number(e.target.value) : undefined)}>
                <option value="">Todas as empresas</option>
                {companyRows.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="border rounded-lg overflow-x-auto bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50"><tr>
                  <th className="text-left p-3">Nome</th><th className="text-left p-3">Empresa</th>
                  <th className="text-left p-3">Papel</th><th className="text-left p-3">Setor</th><th className="text-left p-3">Status</th>
                </tr></thead>
                <tbody>{userRows.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="p-3"><div className="font-medium">{u.name}</div><div className="text-xs text-muted-foreground">{u.email}</div></td>
                    <td className="p-3">{u.company_name}</td><td className="p-3">{ROLE_LABELS[u.role] || u.role}</td>
                    <td className="p-3">{u.sector_name || "-"}</td>
                    <td className="p-3">{Number(u.is_active) === 1 && u.employment_status === "active" ? "Ativo" : "Inativo"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "crm" && (
          <section className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-lg">CRM e propostas</h2>
              <Button onClick={() => { setProposalForm(emptyProposal); setShowProposal(true); }}><Plus size={16} /> Nova proposta</Button>
            </div>
            <div className="border rounded-lg overflow-x-auto bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50"><tr>
                  <th className="text-left p-3">Empresa</th><th className="text-left p-3">Contato</th>
                  <th className="text-right p-3">Colaboradores</th><th className="text-right p-3">Mensalidade</th>
                  <th className="text-left p-3">Status</th><th className="p-3"></th>
                </tr></thead>
                <tbody>{proposalRows.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-3 font-medium">{p.nome_fantasia || p.razao_social}</td>
                    <td className="p-3"><div>{p.responsavel || "-"}</div><div className="text-xs text-muted-foreground">{p.email || ""}</div></td>
                    <td className="p-3 text-right">{p.qtd_colaboradores || 0}</td><td className="p-3 text-right">{money(p.valor_mensal)}</td>
                    <td className="p-3">{STATUS_LABELS[p.status] || p.status}</td>
                    <td className="p-3 text-right"><button className="text-primary font-medium" onClick={() => {
                      setProposalForm({ id: p.id, companyName: p.nome_fantasia || p.razao_social, cnpj: p.cnpj || "", contactName: p.responsavel || "", email: p.email || "", phone: p.telefone || "", employees: Number(p.qtd_colaboradores || 0), monthlyValue: Number(p.valor_mensal || 0), status: p.status, notes: p.observacoes || "" });
                      setShowProposal(true);
                    }}>Editar</button></td>
                  </tr>
                ))}
                {proposalRows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhuma proposta cadastrada.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "configuracoes" && (
          <section className="space-y-5">
            <h2 className="font-semibold text-lg">Configurações da rede</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="border rounded-lg bg-white p-4 space-y-2">
                <h3 className="font-semibold">Identidade e plano</h3>
                <div className="text-sm">Marca: <strong>{ctx?.partner?.brand_name}</strong></div>
                <div className="text-sm">Domínio: <strong>{ctx?.partner?.custom_domain || "Não configurado"}</strong></div>
                <div className="text-sm">Plano: <strong>{ctx?.partner?.plan_label || ctx?.partner?.plan_code}</strong></div>
                <div className="text-sm">Franquia: <strong>{ctx?.partner?.included_cnpjs || 0} CNPJs · {ctx?.partner?.included_employees || 0} colaboradores</strong></div>
              </div>
              <div className="border rounded-lg bg-white p-4 space-y-2">
                <h3 className="font-semibold flex items-center gap-2"><Sparkles size={16} /> Inteligência artificial</h3>
                <div className="text-sm">Créditos incluídos: <strong>{Number(ctx?.wallet?.included_credits_monthly || ctx?.partner?.included_ai_credits || 0).toLocaleString("pt-BR")}</strong></div>
                <div className="text-sm">Créditos adquiridos: <strong>{Number(ctx?.wallet?.purchased_credits_balance || 0).toLocaleString("pt-BR")}</strong></div>
                <div className="text-sm">Consumo do período: <strong>{Number(ctx?.wallet?.consumed_credits_current_period || 0).toLocaleString("pt-BR")}</strong></div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Link href="/admin/configurador"><Button variant="outline"><Settings2 size={16} /> Configurador da empresa atual</Button></Link>
              <Link href="/admin/usuarios"><Button variant="outline"><Users size={16} /> Colaboradores da empresa atual</Button></Link>
              <Link href="/admin/cursos"><Button variant="outline"><FileText size={16} /> Cursos e módulos</Button></Link>
              <Link href="/admin/configuracoes/smtp"><Button variant="outline">E-mail e SMTP</Button></Link>
            </div>
          </section>
        )}

        {tab === "auditoria" && (
          <section className="space-y-3">
            <h2 className="font-semibold text-lg">Auditoria da rede</h2>
            <div className="border rounded-lg overflow-x-auto bg-white">
              <table className="w-full text-sm"><thead className="bg-slate-50"><tr>
                <th className="text-left p-3">Data</th><th className="text-left p-3">Ação</th>
                <th className="text-left p-3">Empresa</th><th className="text-left p-3">Usuário</th>
              </tr></thead><tbody>{((audit.data ?? []) as any[]).map((a) => (
                <tr key={a.id} className="border-t"><td className="p-3 whitespace-nowrap">{new Date(a.created_at).toLocaleString("pt-BR")}</td>
                  <td className="p-3">{a.action}</td><td className="p-3">{a.company_name || "Rede"}</td><td className="p-3">{a.user_name || a.user_email || "Sistema"}</td></tr>
              ))}</tbody></table>
            </div>
          </section>
        )}
      </div>

      {showCompany && <CompanyModal value={companyForm} onChange={setCompanyForm} title="Nova empresa"
        onClose={() => setShowCompany(false)} onSave={() => createCompany.mutate(companyForm)} />}
      {editingCompany && <CompanyEditModal value={editingCompany} onChange={setEditingCompany}
        onClose={() => setEditingCompany(null)} onSave={() => updateCompany.mutate({
          companyId: Number(editingCompany.id), name: editingCompany.name,
          maxEmployees: Number(editingCompany.max_employees || 50), plan: editingCompany.plan || "essencial",
          accessMethod: editingCompany.access_method || "email",
          communicationChannel: editingCompany.communication_channel || "email",
          isActive: Number(editingCompany.is_active) === 1,
        })} />}
      {showProposal && <ProposalModal value={proposalForm} onChange={setProposalForm}
        onClose={() => setShowProposal(false)} onSave={() => saveProposal.mutate({
          ...proposalForm, cnpj: proposalForm.cnpj || null, contactName: proposalForm.contactName || null,
          email: proposalForm.email || null, phone: proposalForm.phone || null, notes: proposalForm.notes || null,
          employees: Number(proposalForm.employees || 0), monthlyValue: Number(proposalForm.monthlyValue || 0),
        })} />}
    </AppLayout>
  );
}

function CompanyTable({ rows, onAdminister, onEdit }: { rows: any[]; onAdminister: (c: any) => void; onEdit: (c: any) => void }) {
  return <div className="border rounded-lg overflow-x-auto bg-white"><table className="w-full text-sm">
    <thead className="bg-slate-50"><tr><th className="text-left p-3">Empresa</th><th className="text-left p-3">Plano</th>
      <th className="text-right p-3">Colaboradores</th><th className="text-right p-3">Filiais</th><th className="text-left p-3">Acesso</th><th className="p-3"></th></tr></thead>
    <tbody>{rows.map((c) => <tr key={c.id} className="border-t"><td className="p-3"><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.cnpj || "Sem CNPJ"}</div></td>
      <td className="p-3 capitalize">{c.plan || "essencial"}</td><td className="p-3 text-right">{c.active_employees || 0} / {c.max_employees || 0}</td>
      <td className="p-3 text-right">{c.branches_count || 0}</td><td className="p-3">{c.access_method || "email"}</td>
      <td className="p-3"><div className="flex justify-end gap-2"><button className="text-sm border rounded-lg px-2 py-1" onClick={() => onEdit(c)}>Editar</button>
        <button className="text-sm bg-primary text-white rounded-lg px-2 py-1 inline-flex items-center gap-1" onClick={() => onAdminister(c)}>Administrar <ChevronRight size={13} /></button></div></td></tr>)}</tbody>
  </table></div>;
}

function ModalShell({ title, children, onClose, onSave }: any) {
  return <div className="fixed inset-0 z-[100] bg-black/45 flex items-center justify-center p-4" onClick={onClose}>
    <div className="bg-white rounded-lg w-full max-w-xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
      <h2 className="text-lg font-semibold mb-4">{title}</h2>{children}
      <div className="flex justify-end gap-2 mt-5"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={onSave}>Salvar</Button></div>
    </div>
  </div>;
}

function CompanyModal({ value, onChange, title, onClose, onSave }: any) {
  return <ModalShell title={title} onClose={onClose} onSave={onSave}><div className="grid gap-3">
    <Field label="Razão social"><Input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} /></Field>
    <Field label="CNPJ"><Input value={value.cnpj} onChange={(e) => onChange({ ...value, cnpj: e.target.value })} /></Field>
    <Field label="Limite de colaboradores"><Input type="number" value={value.maxEmployees} onChange={(e) => onChange({ ...value, maxEmployees: Number(e.target.value) })} /></Field>
    <Field label="Plano"><select className="w-full border rounded-lg px-3 py-2" value={value.plan} onChange={(e) => onChange({ ...value, plan: e.target.value })}><option value="essencial">Essencial</option><option value="profissional">Profissional</option><option value="empresarial">Empresarial</option><option value="premium">Premium</option></select></Field>
  </div></ModalShell>;
}

function CompanyEditModal({ value, onChange, onClose, onSave }: any) {
  return <ModalShell title="Editar empresa" onClose={onClose} onSave={onSave}><div className="grid gap-3 md:grid-cols-2">
    <div className="md:col-span-2"><Field label="Razão social"><Input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} /></Field></div>
    <Field label="Limite de colaboradores"><Input type="number" value={value.max_employees || 50} onChange={(e) => onChange({ ...value, max_employees: Number(e.target.value) })} /></Field>
    <Field label="Plano"><select className="w-full border rounded-lg px-3 py-2" value={value.plan || "essencial"} onChange={(e) => onChange({ ...value, plan: e.target.value })}><option value="essencial">Essencial</option><option value="profissional">Profissional</option><option value="empresarial">Empresarial</option><option value="premium">Premium</option></select></Field>
    <Field label="Método de acesso"><select className="w-full border rounded-lg px-3 py-2" value={value.access_method || "email"} onChange={(e) => onChange({ ...value, access_method: e.target.value })}><option value="email">E-mail</option><option value="cpf">CPF</option><option value="both">E-mail ou CPF</option><option value="whatsapp">WhatsApp</option></select></Field>
    <Field label="Canal de comunicação"><select className="w-full border rounded-lg px-3 py-2" value={value.communication_channel || "email"} onChange={(e) => onChange({ ...value, communication_channel: e.target.value })}><option value="email">E-mail</option><option value="whatsapp">WhatsApp</option><option value="both">E-mail e WhatsApp</option></select></Field>
    <label className="md:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={Number(value.is_active) === 1} onChange={(e) => onChange({ ...value, is_active: e.target.checked ? 1 : 0 })} /> Empresa ativa</label>
  </div></ModalShell>;
}

function ProposalModal({ value, onChange, onClose, onSave }: any) {
  return <ModalShell title={value.id ? "Editar proposta" : "Nova proposta"} onClose={onClose} onSave={onSave}><div className="grid gap-3 md:grid-cols-2">
    <div className="md:col-span-2"><Field label="Empresa"><Input value={value.companyName} onChange={(e) => onChange({ ...value, companyName: e.target.value })} /></Field></div>
    <Field label="CNPJ"><Input value={value.cnpj} onChange={(e) => onChange({ ...value, cnpj: e.target.value })} /></Field>
    <Field label="Contato"><Input value={value.contactName} onChange={(e) => onChange({ ...value, contactName: e.target.value })} /></Field>
    <Field label="E-mail"><Input type="email" value={value.email} onChange={(e) => onChange({ ...value, email: e.target.value })} /></Field>
    <Field label="Telefone"><Input value={value.phone} onChange={(e) => onChange({ ...value, phone: e.target.value })} /></Field>
    <Field label="Colaboradores"><Input type="number" value={value.employees} onChange={(e) => onChange({ ...value, employees: Number(e.target.value) })} /></Field>
    <Field label="Mensalidade"><Input type="number" value={value.monthlyValue} onChange={(e) => onChange({ ...value, monthlyValue: Number(e.target.value) })} /></Field>
    <Field label="Status"><select className="w-full border rounded-lg px-3 py-2" value={value.status} onChange={(e) => onChange({ ...value, status: e.target.value })}>{Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
    <div className="md:col-span-2"><Field label="Observações"><textarea className="w-full border rounded-lg px-3 py-2 min-h-24" value={value.notes} onChange={(e) => onChange({ ...value, notes: e.target.value })} /></Field></div>
  </div></ModalShell>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm"><span className="block mb-1 font-medium">{label}</span>{children}</label>;
}

