import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Briefcase, FileText, Users as UsersIcon, DollarSign, FilePlus2, Loader2, Save, Send, Copy, CheckCircle2, Calendar, Plus, Trash2 } from "lucide-react";

/**
 * SP13 — Super Admin CRM: Propostas + Parceiros + Financeiro + Contratos + Dashboard.
 *
 * Tela única com abas pra todo o ciclo comercial:
 *  1. Dashboard (KPIs)
 *  2. Propostas (cadastrar, calcular, gerar PDF, mover no pipeline, converter em cliente)
 *  3. Parceiros (Humberto, Valéria etc com % comissão)
 *  4. Financeiro (recebimentos + marcar pago + comissão auto)
 *  5. Contratos (upload + vigência + aditivos)
 */
type Tab = "dashboard" | "propostas" | "parceiros" | "financeiro" | "contratos";

const STATUS_OPTS = [
  { v: "lead",                label: "🔵 Lead",                cls: "bg-blue-100 text-blue-700" },
  { v: "negociacao",          label: "🟡 Em negociação",       cls: "bg-amber-100 text-amber-700" },
  { v: "proposta_enviada",    label: "🟣 Proposta enviada",    cls: "bg-purple-100 text-purple-700" },
  { v: "aguardando_retorno",  label: "🟠 Aguardando retorno",  cls: "bg-orange-100 text-orange-700" },
  { v: "aprovada",            label: "🟢 Aprovada",            cls: "bg-emerald-100 text-emerald-700" },
  { v: "reprovada",           label: "🔴 Reprovada",           cls: "bg-rose-100 text-rose-700" },
  { v: "convertida",          label: "⭐ Convertida em cliente", cls: "bg-yellow-100 text-yellow-800" },
];

export default function SuperAdminCrm() {
  const [tab, setTab] = useState<Tab>("dashboard");

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6 space-y-4">
        <header>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase size={22} className="text-blue-600" />
            CRM Comercial · Financeiro · Contratos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ciclo completo: lead → proposta → cliente → recebimento → comissão. Ambiente exclusivo Super Admin.
          </p>
        </header>

        <div className="flex gap-1 border-b">
          {([
            ["dashboard", "Dashboard", DollarSign],
            ["propostas", "Propostas", FileText],
            ["parceiros", "Parceiros", UsersIcon],
            ["financeiro", "Financeiro", DollarSign],
            ["contratos", "Contratos", FilePlus2],
          ] as const).map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k as Tab)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              <span className="inline-flex items-center gap-1.5"><Icon size={14} /> {label}</span>
            </button>
          ))}
        </div>

        {tab === "dashboard"   && <DashboardTab />}
        {tab === "propostas"   && <PropostasTab />}
        {tab === "parceiros"   && <ParceirosTab />}
        {tab === "financeiro"  && <FinanceiroTab />}
        {tab === "contratos"   && <ContratosTab />}
      </div>
    </AppLayout>
  );
}

function DashboardTab() {
  const q = trpc.superAdmin.crmDashboard.useQuery();
  const d = q.data as any;
  if (q.isLoading || !d) return <div className="p-8 text-center"><Loader2 className="animate-spin" /></div>;
  const cards = [
    { label: "Receita do mês", value: brl(d.receitaMes), c: "bg-emerald-50 text-emerald-800 border-emerald-200" },
    { label: "Receita do ano", value: brl(d.receitaAno), c: "bg-blue-50 text-blue-800 border-blue-200" },
    { label: "MRR (Receita Recorrente)", value: brl(d.mrr), c: "bg-purple-50 text-purple-800 border-purple-200" },
    { label: "Clientes ativos", value: d.clientesAtivos, c: "bg-slate-50 text-slate-800 border-slate-200" },
    { label: "Inadimplentes", value: d.inadimplentes, c: "bg-rose-50 text-rose-800 border-rose-200" },
    { label: "Pipeline aberto", value: d.pipeline, c: "bg-amber-50 text-amber-800 border-amber-200" },
  ];
  return (
    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
      {cards.map(c => (
        <div key={c.label} className={`border rounded-xl p-4 ${c.c}`}>
          <div className="text-xs uppercase tracking-wider font-semibold opacity-80">{c.label}</div>
          <div className="text-2xl font-bold mt-1">{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function PropostasTab() {
  const listQ = trpc.superAdmin.crmListProposals.useQuery({});
  const partnersQ = trpc.superAdmin.crmListPartners.useQuery();
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const upsertMut = trpc.superAdmin.crmUpsertProposal.useMutation({
    onSuccess: (r: any) => { toast.success("Proposta salva."); listQ.refetch(); setOpenNew(false); setEditing(null); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const statusMut = trpc.superAdmin.crmChangeStatus.useMutation({
    onSuccess: () => { toast.success("Status atualizado."); listQ.refetch(); },
  });
  const pdfMut = trpc.superAdmin.crmGeneratePdf.useMutation({
    onSuccess: (r: any) => { toast.success("PDF gerado."); window.open("/plataforma" + r.url.replace("/plataforma",""), "_blank"); },
    onError: (e: any) => toast.error(e?.message ?? "Erro PDF"),
  });
  const convertMut = trpc.superAdmin.crmConvertToClient.useMutation({
    onSuccess: (r: any) => { toast.success(`Cliente criado (id ${r.companyId}) + ${r.monthly} parcelas`); listQ.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const list = (listQ.data ?? []) as any[];
  return (
    <div className="space-y-3 mt-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setOpenNew(true); }} className="gap-1"><Plus size={14} /> Nova proposta</Button>
      </div>
      {list.length === 0 && !listQ.isLoading && <p className="text-sm text-slate-500 py-8 text-center">Nenhuma proposta ainda. Clique em "Nova proposta".</p>}
      <div className="grid gap-2">
        {list.map(p => {
          const st = STATUS_OPTS.find(s => s.v === p.status) ?? STATUS_OPTS[0];
          return (
            <div key={p.id} className="bg-white border rounded-lg p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{p.razao_social}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {p.qtd_colaboradores} colab · {brl(p.valor_mensal)}/mês · {brl(p.valor_anual)}/ano
                    {p.partner_name ? ` · parceiro: ${p.partner_name}` : ""}
                  </div>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-3 text-xs">
                <select value={p.status} onChange={e => statusMut.mutate({ id: p.id, newStatus: e.target.value as any })}
                  className="border rounded px-2 py-1 text-xs">
                  {STATUS_OPTS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
                <Button size="sm" variant="outline" onClick={() => { setEditing(p); setOpenNew(true); }}>Editar</Button>
                <Button size="sm" variant="outline" onClick={() => pdfMut.mutate({ id: p.id })} disabled={pdfMut.isPending}>
                  <FileText size={12} /> PDF
                </Button>
                {p.pdf_url && <a href={"/plataforma" + p.pdf_url.replace("/plataforma","")} target="_blank" className="text-blue-600 self-center text-xs hover:underline">↗ abrir</a>}
                {p.status === "aprovada" && !p.converted_company_id && (
                  <Button size="sm" onClick={() => convertMut.mutate({ id: p.id })} className="bg-emerald-600 hover:bg-emerald-700">
                    <CheckCircle2 size={12} /> Converter em cliente
                  </Button>
                )}
                {p.converted_company_id && <span className="text-xs text-emerald-700 self-center">⭐ Cliente #{p.converted_company_id}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {openNew && (
        <ProposalForm
          initial={editing}
          partners={(partnersQ.data ?? []) as any[]}
          onClose={() => { setOpenNew(false); setEditing(null); }}
          onSubmit={(data) => upsertMut.mutate(data)}
          loading={upsertMut.isPending}
        />
      )}
    </div>
  );
}

function ProposalForm({ initial, partners, onClose, onSubmit, loading }: any) {
  const [f, setF] = useState({
    id: initial?.id,
    razaoSocial: initial?.razao_social ?? "",
    nomeFantasia: initial?.nome_fantasia ?? "",
    cnpj: initial?.cnpj ?? "",
    responsavel: initial?.responsavel ?? "",
    cargo: initial?.cargo ?? "",
    email: initial?.email ?? "",
    telefone: initial?.telefone ?? "",
    segmento: initial?.segmento ?? "",
    qtdColaboradores: Number(initial?.qtd_colaboradores ?? 50),
    plano: (initial?.plano ?? "business") as "starter"|"business"|"enterprise",
    descontoExtraPct: Number(initial?.desconto_pct ?? 0),
    validadeDias: Number(initial?.validade_dias ?? 15),
    partnerId: initial?.partner_id ?? null,
    observacoes: initial?.observacoes ?? "",
  });
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-5 space-y-3 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">{initial ? "Editar" : "Nova"} proposta comercial</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <L l="Razão Social *"><Input v={f.razaoSocial} on={v => setF({...f, razaoSocial: v})}/></L>
          <L l="Nome Fantasia"><Input v={f.nomeFantasia} on={v => setF({...f, nomeFantasia: v})}/></L>
          <L l="CNPJ"><Input v={f.cnpj} on={v => setF({...f, cnpj: v})}/></L>
          <L l="Segmento"><Input v={f.segmento} on={v => setF({...f, segmento: v})}/></L>
          <L l="Responsável"><Input v={f.responsavel} on={v => setF({...f, responsavel: v})}/></L>
          <L l="Cargo"><Input v={f.cargo} on={v => setF({...f, cargo: v})}/></L>
          <L l="E-mail"><Input v={f.email} on={v => setF({...f, email: v})}/></L>
          <L l="Telefone"><Input v={f.telefone} on={v => setF({...f, telefone: v})}/></L>
          <L l="Colaboradores">
            <input type="number" min={1} value={f.qtdColaboradores} onChange={e => setF({...f, qtdColaboradores: Number(e.target.value || 0)})} className="w-full border rounded px-2 py-1.5"/>
          </L>
          <L l="Plano">
            <select value={f.plano} onChange={e => setF({...f, plano: e.target.value as any})} className="w-full border rounded px-2 py-1.5">
              <option value="starter">Starter (R$ 6/colab, min R$ 350)</option>
              <option value="business">Business (R$ 10/colab, min R$ 750)</option>
              <option value="enterprise">Enterprise (R$ 14/colab, min R$ 1500)</option>
            </select>
          </L>
          <L l="Desconto extra (%)">
            <input type="number" min={0} max={50} value={f.descontoExtraPct} onChange={e => setF({...f, descontoExtraPct: Number(e.target.value || 0)})} className="w-full border rounded px-2 py-1.5"/>
          </L>
          <L l="Validade (dias)">
            <input type="number" min={1} value={f.validadeDias} onChange={e => setF({...f, validadeDias: Number(e.target.value || 15)})} className="w-full border rounded px-2 py-1.5"/>
          </L>
          <L l="Parceiro indicador">
            <select value={f.partnerId ?? ""} onChange={e => setF({...f, partnerId: e.target.value ? Number(e.target.value) : null})} className="w-full border rounded px-2 py-1.5">
              <option value="">— nenhum —</option>
              {partners.map((p: any) => <option key={p.id} value={p.id}>{p.nome} ({p.comissao_pct}%)</option>)}
            </select>
          </L>
          <div className="col-span-2">
            <L l="Observações">
              <textarea value={f.observacoes} onChange={e => setF({...f, observacoes: e.target.value})} className="w-full border rounded px-2 py-1.5 min-h-[60px]"/>
            </L>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSubmit(f)} disabled={loading} className="gap-1">
            {loading ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}

function ParceirosTab() {
  const listQ = trpc.superAdmin.crmListPartners.useQuery();
  const upsertMut = trpc.superAdmin.crmUpsertPartner.useMutation({
    onSuccess: () => { toast.success("Parceiro salvo."); listQ.refetch(); setEditing(null); setOpen(false); },
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const list = (listQ.data ?? []) as any[];
  return (
    <div className="space-y-3 mt-4">
      <div className="flex justify-end"><Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-1"><Plus size={14}/> Novo parceiro</Button></div>
      <div className="grid sm:grid-cols-2 gap-3">
        {list.map(p => (
          <div key={p.id} className="bg-white border rounded-lg p-3 flex items-start justify-between">
            <div>
              <div className="font-medium">{p.nome}{!p.is_active && <span className="ml-2 text-[10px] bg-slate-200 px-2 py-0.5 rounded-full">inativo</span>}</div>
              <div className="text-xs text-slate-500">{p.email ?? "—"} · {p.telefone ?? "—"}</div>
              <div className="text-xs mt-1">
                <span className="text-emerald-700 font-semibold">{p.comissao_pct}% comissão</span>
                {Number(p.comissao_fixa) > 0 && <span className="ml-2 text-slate-600">+ {brl(p.comissao_fixa)} fixo</span>}
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}>Editar</Button>
          </div>
        ))}
        {list.length === 0 && !listQ.isLoading && <p className="text-sm text-slate-500 py-4 text-center col-span-2">Nenhum parceiro cadastrado. Exemplos: Humberto, Valéria.</p>}
      </div>
      {open && <PartnerForm initial={editing} onClose={() => { setOpen(false); setEditing(null); }} onSubmit={(d: any) => upsertMut.mutate(d)} loading={upsertMut.isPending}/>}
    </div>
  );
}

function PartnerForm({ initial, onClose, onSubmit, loading }: any) {
  const [f, setF] = useState({
    id: initial?.id,
    nome: initial?.nome ?? "",
    cpfCnpj: initial?.cpf_cnpj ?? "",
    email: initial?.email ?? "",
    telefone: initial?.telefone ?? "",
    tipoParceria: initial?.tipo_parceria ?? "indicador",
    comissaoPct: Number(initial?.comissao_pct ?? 10),
    comissaoFixa: Number(initial?.comissao_fixa ?? 0),
    dataInicio: initial?.data_inicio?.slice(0,10) ?? new Date().toISOString().slice(0,10),
    isActive: initial?.is_active === undefined ? true : !!initial.is_active,
    observacoes: initial?.observacoes ?? "",
  });
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">{initial ? "Editar" : "Novo"} parceiro</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <L l="Nome *"><Input v={f.nome} on={v => setF({...f, nome: v})}/></L>
          <L l="CPF/CNPJ"><Input v={f.cpfCnpj} on={v => setF({...f, cpfCnpj: v})}/></L>
          <L l="E-mail"><Input v={f.email} on={v => setF({...f, email: v})}/></L>
          <L l="Telefone"><Input v={f.telefone} on={v => setF({...f, telefone: v})}/></L>
          <L l="Tipo">
            <select value={f.tipoParceria} onChange={e => setF({...f, tipoParceria: e.target.value})} className="w-full border rounded px-2 py-1.5">
              <option value="indicador">Indicador</option>
              <option value="revenda">Revenda</option>
              <option value="white_label">White Label</option>
            </select>
          </L>
          <L l="Comissão %">
            <input type="number" step="0.1" value={f.comissaoPct} onChange={e => setF({...f, comissaoPct: Number(e.target.value || 0)})} className="w-full border rounded px-2 py-1.5"/>
          </L>
          <L l="Comissão fixa (R$)">
            <input type="number" step="0.01" value={f.comissaoFixa} onChange={e => setF({...f, comissaoFixa: Number(e.target.value || 0)})} className="w-full border rounded px-2 py-1.5"/>
          </L>
          <L l="Data início">
            <input type="date" value={f.dataInicio} onChange={e => setF({...f, dataInicio: e.target.value})} className="w-full border rounded px-2 py-1.5"/>
          </L>
          <L l="Status">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={f.isActive} onChange={e => setF({...f, isActive: e.target.checked})}/> Ativo</label>
          </L>
          <div className="col-span-2">
            <L l="Observações"><textarea value={f.observacoes} onChange={e => setF({...f, observacoes: e.target.value})} className="w-full border rounded px-2 py-1.5 min-h-[60px]"/></L>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSubmit(f)} disabled={loading}>{loading ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Salvar</Button>
        </div>
      </div>
    </div>
  );
}

function FinanceiroTab() {
  const [status, setStatus] = useState<string>("");
  const listQ = trpc.superAdmin.crmListReceivables.useQuery(status ? { status } : {});
  const recvMut = trpc.superAdmin.crmMarkReceived.useMutation({
    onSuccess: () => { toast.success("Recebimento confirmado + comissão calculada."); listQ.refetch(); },
  });
  const list = (listQ.data ?? []) as any[];
  return (
    <div className="space-y-3 mt-4">
      <div className="flex gap-2 items-center">
        <select value={status} onChange={e => setStatus(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
          <option value="">Todos status</option>
          <option value="pendente">Pendente</option>
          <option value="recebido">Recebido</option>
          <option value="em_atraso">Em atraso</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <span className="text-xs text-slate-500">{list.length} recebimento(s)</span>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left">
          <tr><th className="px-2 py-2">Empresa</th><th className="px-2 py-2">Vencimento</th><th className="px-2 py-2">Valor</th><th className="px-2 py-2">Status</th><th className="px-2 py-2 w-32">Ação</th></tr>
        </thead>
        <tbody>
          {list.map(r => (
            <tr key={r.id} className="border-t">
              <td className="px-2 py-2">{r.company_name ?? `#${r.company_id}`}</td>
              <td className="px-2 py-2">{r.vencimento?.slice(0,10) ?? "—"}</td>
              <td className="px-2 py-2 font-semibold">{brl(r.valor)}</td>
              <td className="px-2 py-2">
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${r.status === "recebido" ? "bg-emerald-100 text-emerald-700" : r.status === "em_atraso" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"}`}>
                  {r.status}
                </span>
              </td>
              <td className="px-2 py-2">
                {r.status === "pendente" && <Button size="sm" onClick={() => recvMut.mutate({ id: r.id })} disabled={recvMut.isPending}>Marcar pago</Button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.length === 0 && !listQ.isLoading && <p className="text-sm text-slate-500 py-4 text-center">Sem recebimentos cadastrados. Eles aparecem quando você converte uma proposta em cliente.</p>}
    </div>
  );
}

function ContratosTab() {
  const listQ = trpc.superAdmin.crmListContracts.useQuery();
  const partnersQ = trpc.superAdmin.crmListPartners.useQuery();
  const upsertMut = trpc.superAdmin.crmUpsertContract.useMutation({
    onSuccess: () => { toast.success("Contrato salvo."); listQ.refetch(); setOpen(false); setEditing(null); },
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const list = (listQ.data ?? []) as any[];
  return (
    <div className="space-y-3 mt-4">
      <div className="flex justify-end"><Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-1"><Plus size={14}/> Novo contrato</Button></div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left">
          <tr><th className="px-2 py-2">Nome</th><th className="px-2 py-2">Tipo</th><th className="px-2 py-2">Vinculado a</th><th className="px-2 py-2">Vigência</th><th className="px-2 py-2">Arquivo</th></tr>
        </thead>
        <tbody>
          {list.map(c => (
            <tr key={c.id} className="border-t">
              <td className="px-2 py-2 font-medium">{c.nome}</td>
              <td className="px-2 py-2 text-xs">{c.tipo ?? "—"}</td>
              <td className="px-2 py-2 text-xs">{c.partner_name ?? c.company_name ?? "—"}</td>
              <td className="px-2 py-2 text-xs">{c.vigencia_inicio?.slice(0,10) ?? "—"} a {c.vigencia_fim?.slice(0,10) ?? "—"}</td>
              <td className="px-2 py-2 text-xs">
                {c.arquivo_url ? <a href={"/plataforma" + c.arquivo_url.replace("/plataforma","")} target="_blank" className="text-blue-600 hover:underline">↗ baixar</a> : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.length === 0 && !listQ.isLoading && <p className="text-sm text-slate-500 py-4 text-center">Sem contratos. Exemplo imediato: Contrato Humberto.</p>}
      {open && <ContractForm initial={editing} partners={(partnersQ.data ?? []) as any[]} onClose={() => { setOpen(false); setEditing(null); }} onSubmit={(d: any) => upsertMut.mutate(d)} loading={upsertMut.isPending}/>}
    </div>
  );
}

function ContractForm({ initial, partners, onClose, onSubmit, loading }: any) {
  const [f, setF] = useState({
    id: initial?.id,
    nome: initial?.nome ?? "",
    tipo: initial?.tipo ?? "parceiro",
    partnerId: initial?.partner_id ?? null,
    companyId: initial?.company_id ?? null,
    assinatura: initial?.assinatura?.slice(0,10) ?? "",
    vigenciaInicio: initial?.vigencia_inicio?.slice(0,10) ?? "",
    vigenciaFim: initial?.vigencia_fim?.slice(0,10) ?? "",
    status: initial?.status ?? "ativo",
    arquivoBase64: "",
    arquivoNome: "",
    observacoes: initial?.observacoes ?? "",
  });
  async function pickFile(file: File) {
    const b64 = await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result || ""));
      fr.onerror = () => rej(fr.error);
      fr.readAsDataURL(file);
    });
    setF({ ...f, arquivoBase64: b64, arquivoNome: file.name });
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-xl w-full p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">{initial ? "Editar" : "Novo"} contrato</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <L l="Nome *"><Input v={f.nome} on={v => setF({...f, nome: v})}/></L>
          <L l="Tipo">
            <select value={f.tipo} onChange={e => setF({...f, tipo: e.target.value})} className="w-full border rounded px-2 py-1.5">
              <option value="parceiro">Parceiro</option><option value="comercial">Comercial</option><option value="prestacao_servico">Prestação de Serviço</option><option value="cliente">Cliente</option><option value="aditivo">Aditivo</option>
            </select>
          </L>
          <L l="Parceiro vinculado">
            <select value={f.partnerId ?? ""} onChange={e => setF({...f, partnerId: e.target.value ? Number(e.target.value) : null})} className="w-full border rounded px-2 py-1.5">
              <option value="">—</option>
              {partners.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </L>
          <L l="Empresa cliente (id)">
            <input type="number" value={f.companyId ?? ""} onChange={e => setF({...f, companyId: e.target.value ? Number(e.target.value) : null})} className="w-full border rounded px-2 py-1.5" placeholder="opcional"/>
          </L>
          <L l="Data assinatura"><input type="date" value={f.assinatura} onChange={e => setF({...f, assinatura: e.target.value})} className="w-full border rounded px-2 py-1.5"/></L>
          <L l="Status">
            <select value={f.status} onChange={e => setF({...f, status: e.target.value})} className="w-full border rounded px-2 py-1.5">
              <option value="ativo">Ativo</option><option value="encerrado">Encerrado</option><option value="rescindido">Rescindido</option>
            </select>
          </L>
          <L l="Vigência início"><input type="date" value={f.vigenciaInicio} onChange={e => setF({...f, vigenciaInicio: e.target.value})} className="w-full border rounded px-2 py-1.5"/></L>
          <L l="Vigência fim"><input type="date" value={f.vigenciaFim} onChange={e => setF({...f, vigenciaFim: e.target.value})} className="w-full border rounded px-2 py-1.5"/></L>
          <div className="col-span-2">
            <L l="Arquivo PDF do contrato">
              <input type="file" accept="application/pdf" onChange={e => { const fi = e.target.files?.[0]; if (fi) pickFile(fi); }} className="w-full text-xs"/>
              {f.arquivoNome && <span className="text-[10px] text-emerald-700">selecionado: {f.arquivoNome}</span>}
            </L>
          </div>
          <div className="col-span-2">
            <L l="Observações"><textarea value={f.observacoes} onChange={e => setF({...f, observacoes: e.target.value})} className="w-full border rounded px-2 py-1.5 min-h-[60px]"/></L>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSubmit(f)} disabled={loading}>{loading ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Salvar</Button>
        </div>
      </div>
    </div>
  );
}

// helpers de UI
function L({ l, children }: any) {
  return <div><label className="text-xs font-semibold text-slate-700 block mb-1">{l}</label>{children}</div>;
}
function Input({ v, on }: any) { return <input type="text" value={v} onChange={e => on(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm"/>; }
function brl(v: any) { return `R$ ${Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
