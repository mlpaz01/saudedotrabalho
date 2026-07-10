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
type Tab = "dashboard" | "propostas" | "faixas" | "parceiros" | "financeiro" | "contratos" | "comissoes";

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
            ["faixas", "Faixas de Preço", DollarSign],
            ["parceiros", "Parceiros", UsersIcon],
            ["financeiro", "Financeiro", DollarSign],
            ["contratos", "Contratos", FilePlus2],
            ["comissoes", "Comissões · Intermediários", UsersIcon],
          ] as const).map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k as Tab)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              <span className="inline-flex items-center gap-1.5"><Icon size={14} /> {label}</span>
            </button>
          ))}
        </div>

        {tab === "dashboard"   && <DashboardTab />}
        {tab === "propostas"   && <PropostasTab />}
        {tab === "faixas"      && <FaixasTab />}
        {tab === "parceiros"   && <ParceirosTab />}
        {tab === "financeiro"  && <FinanceiroTab />}
        {tab === "contratos"   && <ContratosTab />}
        {tab === "comissoes"   && <CommissionsTab />}
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
    // Bruno R5-P3 vídeo bug — /uploads/... é servido na raiz (nginx + express.static),
    // não em /plataforma/uploads. Abrir direto na URL devolvida pelo backend.
    onSuccess: (r: any) => { toast.success("PDF gerado."); listQ.refetch(); window.open(r.url, "_blank"); },
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
                  <FileText size={12} /> {p.pdf_url ? "Regerar PDF" : "Gerar PDF"}
                </Button>
                {/* Bruno R5-P3 vídeo bug — URL servida direto em /uploads/... (nginx).
                    Se ainda não houver PDF, o botão "abrir" dispara generate e abre no sucesso. */}
                {p.pdf_url ? (
                  <a href={p.pdf_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 self-center text-xs hover:underline">↗ abrir PDF</a>
                ) : (
                  <button onClick={() => pdfMut.mutate({ id: p.id })} className="text-blue-600 self-center text-xs hover:underline" disabled={pdfMut.isPending}>
                    {pdfMut.isPending ? "gerando..." : "↗ gerar e abrir"}
                  </button>
                )}
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
    // Bruno R5 #2 — Default agora é "auto" (tabela parametrizada por faixa de colaboradores).
    plano: (initial?.plano ?? "auto") as "auto"|"starter"|"business"|"enterprise",
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
              <option value="auto">Automático por faixa de colaboradores (recomendado)</option>
              <option value="starter">Legacy Starter (R$ 6/colab, min R$ 350)</option>
              <option value="business">Legacy Business (R$ 10/colab, min R$ 750)</option>
              <option value="enterprise">Legacy Enterprise (R$ 14/colab, min R$ 1500)</option>
            </select>
            {f.plano === "auto" && (
              <p className="text-[11px] text-slate-600 mt-1">
                Valor anual fixo: 1–30 = R$ 3.500 · 31–100 = R$ 7.500 · 101–300 = R$ 10.500 · 301–500 = R$ 14.000 · 501–999 = R$ 22.000 · 1000+ = R$ 35.000
              </p>
            )}
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
      {open && <PartnerForm initial={editing} allPartners={list} onClose={() => { setOpen(false); setEditing(null); }} onSubmit={(d: any) => upsertMut.mutate(d)} loading={upsertMut.isPending}/>}
    </div>
  );
}

function PartnerForm({ initial, allPartners = [], onClose, onSubmit, loading }: any) {
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
    // P14 #4 — dados bancários / PIX
    banco: initial?.banco ?? "",
    agencia: initial?.agencia ?? "",
    conta: initial?.conta ?? "",
    pixKey: initial?.pix_key ?? "",
    // P14 #5 — perfil Intermediador: vínculo de login + hierarquia
    userId: initial?.user_id ?? null,
    parentPartnerId: initial?.parent_partner_id ?? null,
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
          <div className="col-span-2 border-t pt-2 mt-1">
            <p className="text-xs font-semibold text-slate-600 mb-1">Dados bancários / PIX</p>
          </div>
          <L l="Banco"><Input v={f.banco} on={v => setF({...f, banco: v})}/></L>
          <L l="Agência"><Input v={f.agencia} on={v => setF({...f, agencia: v})}/></L>
          <L l="Conta"><Input v={f.conta} on={v => setF({...f, conta: v})}/></L>
          <L l="Chave PIX"><Input v={f.pixKey} on={v => setF({...f, pixKey: v})}/></L>
          <div className="col-span-2 border-t pt-2 mt-1">
            <p className="text-xs font-semibold text-slate-600 mb-1">Perfil "Intermediador" (P14 #5)</p>
          </div>
          <L l="ID do usuário na plataforma">
            <input type="number" value={f.userId ?? ""} onChange={e => setF({...f, userId: e.target.value ? Number(e.target.value) : null})} className="w-full border rounded px-2 py-1.5" placeholder="vincula login + define role=intermediador"/>
          </L>
          <L l="Intermediador principal (supervisor)">
            <select value={f.parentPartnerId ?? ""} onChange={e => setF({...f, parentPartnerId: e.target.value ? Number(e.target.value) : null})} className="w-full border rounded px-2 py-1.5">
              <option value="">— nenhum (é principal) —</option>
              {allPartners.filter((p: any) => p.id !== f.id).map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
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
  const [partnersOf, setPartnersOf] = useState<any>(null);
  const list = (listQ.data ?? []) as any[];
  return (
    <div className="space-y-3 mt-4">
      <div className="flex justify-end"><Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-1"><Plus size={14}/> Novo contrato</Button></div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left">
          <tr><th className="px-2 py-2">Nome</th><th className="px-2 py-2">Tipo</th><th className="px-2 py-2">Vinculado a</th><th className="px-2 py-2">Vigência</th><th className="px-2 py-2">Arquivo</th><th className="px-2 py-2">Intermediários</th></tr>
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
              <td className="px-2 py-2 text-xs">
                <Button size="sm" variant="outline" onClick={() => setPartnersOf(c)}>Gerenciar (até 3)</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.length === 0 && !listQ.isLoading && <p className="text-sm text-slate-500 py-4 text-center">Sem contratos. Exemplo imediato: Contrato Humberto.</p>}
      {open && <ContractForm initial={editing} partners={(partnersQ.data ?? []) as any[]} onClose={() => { setOpen(false); setEditing(null); }} onSubmit={(d: any) => upsertMut.mutate(d)} loading={upsertMut.isPending}/>}
      {partnersOf && (
        <ContractPartnersModal
          contract={partnersOf}
          allPartners={(partnersQ.data ?? []) as any[]}
          onClose={() => setPartnersOf(null)}
        />
      )}
    </div>
  );
}

// P14 #4 — até 3 intermediários por contrato, com % de comissão + contrato digitalizado
// próprio de cada um + simulação financeira automática (valor contratado → tributos →
// valor líquido → comissão de cada intermediário → resultado líquido da empresa).
function ContractPartnersModal({ contract, allPartners, onClose }: any) {
  const listQ = trpc.superAdmin.crmListContractPartners.useQuery({ contractId: contract.id });
  const utils = trpc.useUtils();
  const setMut = trpc.superAdmin.crmSetContractPartners.useMutation({
    onSuccess: () => { toast.success("Intermediários do contrato salvos."); utils.superAdmin.crmListContractPartners.invalidate({ contractId: contract.id }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const [rows, setRows] = useState<{ partnerId: number | null; comissaoPct: number; status: "ativo"|"inativo"; arquivoBase64?: string; arquivoNome?: string }[]>([]);
  const data = listQ.data as any[] | undefined;
  if (data && rows.length === 0 && data.length > 0) {
    setRows(data.map((r: any) => ({ partnerId: r.partner_id, comissaoPct: Number(r.comissao_pct), status: r.status, arquivoNome: r.arquivo_url ? r.arquivo_url.split("/").pop() : undefined })));
  }

  // Simulador: valor contratado → tributos → líquido → comissões → resultado da empresa.
  const [valorContratado, setValorContratado] = useState(0);
  const [tributosPct, setTributosPct] = useState(0);
  const valorLiquido = valorContratado * (1 - tributosPct / 100);
  const comissoes = rows.filter(r => r.partnerId).map(r => {
    const nome = allPartners.find((p: any) => p.id === r.partnerId)?.nome ?? `#${r.partnerId}`;
    const valor = valorLiquido * (r.comissaoPct / 100);
    return { nome, pct: r.comissaoPct, valor };
  });
  const totalComissoes = comissoes.reduce((s, c) => s + c.valor, 0);
  const resultadoEmpresa = valorLiquido - totalComissoes;

  function addRow() { if (rows.length < 3) setRows(prev => [...prev, { partnerId: null, comissaoPct: 10, status: "ativo" }]); }
  function updateRow(i: number, patch: any) { setRows(prev => prev.map((r, j) => j === i ? { ...r, ...patch } : r)); }
  function removeRow(i: number) { setRows(prev => prev.filter((_, j) => j !== i)); }
  async function pickFile(i: number, file: File) {
    const b64 = await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result || ""));
      fr.onerror = () => rej(fr.error);
      fr.readAsDataURL(file);
    });
    updateRow(i, { arquivoBase64: b64, arquivoNome: file.name });
  }
  function save() {
    const valid = rows.filter(r => r.partnerId);
    setMut.mutate({
      contractId: contract.id,
      partners: valid.map(r => ({ partnerId: r.partnerId as number, comissaoPct: r.comissaoPct, status: r.status, arquivoBase64: r.arquivoBase64, arquivoNome: r.arquivoNome })),
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">Intermediários — {contract.nome}</h3>

        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="border rounded-lg p-3 grid grid-cols-3 gap-2 items-end text-sm">
              <L l={`Intermediário ${i + 1}`}>
                <select value={r.partnerId ?? ""} onChange={e => updateRow(i, { partnerId: e.target.value ? Number(e.target.value) : null })} className="w-full border rounded px-2 py-1.5">
                  <option value="">— selecione —</option>
                  {allPartners.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </L>
              <L l="% Comissão">
                <input type="number" step="0.1" min={0} max={100} value={r.comissaoPct} onChange={e => updateRow(i, { comissaoPct: Number(e.target.value || 0) })} className="w-full border rounded px-2 py-1.5"/>
              </L>
              <L l="Status">
                <select value={r.status} onChange={e => updateRow(i, { status: e.target.value })} className="w-full border rounded px-2 py-1.5">
                  <option value="ativo">Ativo</option><option value="inativo">Inativo</option>
                </select>
              </L>
              <div className="col-span-2">
                <L l="Contrato digitalizado (deste intermediário)">
                  <input type="file" accept="application/pdf,image/*" onChange={e => { const fi = e.target.files?.[0]; if (fi) pickFile(i, fi); }} className="w-full text-xs"/>
                  {r.arquivoNome && <span className="text-[10px] text-emerald-700">arquivo: {r.arquivoNome}</span>}
                </L>
              </div>
              <div className="flex justify-end">
                <button onClick={() => removeRow(i)} className="text-rose-600 text-xs hover:underline">Remover</button>
              </div>
            </div>
          ))}
          {rows.length < 3 && (
            <Button variant="outline" size="sm" onClick={addRow} className="gap-1"><Plus size={13}/> Adicionar intermediário ({rows.length}/3)</Button>
          )}
        </div>

        <div className="bg-slate-50 border rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-slate-600">Simulação financeira</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <L l="Valor contratado (R$)"><input type="number" step="0.01" value={valorContratado} onChange={e => setValorContratado(Number(e.target.value || 0))} className="w-full border rounded px-2 py-1.5"/></L>
            <L l="Tributos incidentes (%)"><input type="number" step="0.1" value={tributosPct} onChange={e => setTributosPct(Number(e.target.value || 0))} className="w-full border rounded px-2 py-1.5"/></L>
          </div>
          <div className="text-xs space-y-1 pt-1">
            <div className="flex justify-between"><span>Valor bruto (contratado)</span><b>{brl(valorContratado)}</b></div>
            <div className="flex justify-between text-rose-700"><span>Tributos ({tributosPct}%)</span><b>-{brl(valorContratado - valorLiquido)}</b></div>
            <div className="flex justify-between border-t pt-1"><span>Valor líquido</span><b>{brl(valorLiquido)}</b></div>
            {comissoes.map((c, i) => (
              <div key={i} className="flex justify-between text-amber-700"><span>Comissão {c.nome} ({c.pct}%)</span><b>-{brl(c.valor)}</b></div>
            ))}
            <div className="flex justify-between border-t pt-1 text-emerald-700"><span>Resultado líquido da empresa</span><b>{brl(resultadoEmpresa)}</b></div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={save} disabled={setMut.isPending}>{setMut.isPending ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Salvar intermediários</Button>
        </div>
      </div>
    </div>
  );
}

// P14 #4 — Calendário financeiro de comissões: previsto, pago, pendente, histórico.
function CommissionsTab() {
  const [status, setStatus] = useState<string>("");
  const listQ = trpc.superAdmin.crmListCommissions.useQuery(status ? { status } : {});
  const payMut = trpc.superAdmin.crmMarkCommissionPaid.useMutation({
    onSuccess: () => { toast.success("Comissão marcada como paga."); listQ.refetch(); },
  });
  const list = (listQ.data ?? []) as any[];
  const totalPendente = list.filter(c => c.status === "pendente").reduce((s, c) => s + Number(c.valor_comissao || 0), 0);
  function imprimirRecibo(c: any) {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>Recibo de comissão</title></head><body style="font-family:sans-serif;padding:40px">
      <h2>Recibo de Comissão — Intermediário</h2>
      <p><b>Intermediário:</b> ${c.partner_name}</p>
      <p><b>Cliente:</b> ${c.company_name ?? `#${c.company_id}`}</p>
      <p><b>Valor bruto:</b> ${brl(c.valor_bruto)}</p>
      <p><b>Comissão (${c.comissao_pct}%):</b> ${brl(c.valor_comissao)}</p>
      <p><b>Status:</b> ${c.status}${c.pago_em ? ` — pago em ${String(c.pago_em).slice(0,10)}` : ""}</p>
      <hr/><p style="font-size:12px;color:#666">Documento gerado automaticamente pela plataforma Saúde do Trabalho.</p>
      <script>window.print()</script>
    </body></html>`);
    win.document.close();
  }
  return (
    <div className="space-y-3 mt-4">
      <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs flex justify-between items-center">
        <span>Consolidado de comissões previstas/pagas de todos os intermediários vinculados aos clientes.</span>
        <b className="text-amber-800">Pendente: {brl(totalPendente)}</b>
      </div>
      <div className="flex gap-2 items-center">
        <select value={status} onChange={e => setStatus(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
          <option value="">Todos status</option>
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
        </select>
        <span className="text-xs text-slate-500">{list.length} comissão(ões)</span>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left">
          <tr><th className="px-2 py-2">Intermediário</th><th className="px-2 py-2">Cliente</th><th className="px-2 py-2">Prazo previsto</th><th className="px-2 py-2">Valor comissão</th><th className="px-2 py-2">Status</th><th className="px-2 py-2 w-40">Ação</th></tr>
        </thead>
        <tbody>
          {list.map(c => (
            <tr key={c.id} className="border-t">
              <td className="px-2 py-2">{c.partner_name}</td>
              <td className="px-2 py-2 text-xs">{c.company_name ?? `#${c.company_id}`}</td>
              <td className="px-2 py-2 text-xs">{c.vencimento?.slice(0,10) ?? "—"}</td>
              <td className="px-2 py-2 font-semibold">{brl(c.valor_comissao)}</td>
              <td className="px-2 py-2">
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${c.status === "pago" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>{c.status}</span>
              </td>
              <td className="px-2 py-2 flex gap-2">
                {c.status === "pendente" && <Button size="sm" onClick={() => payMut.mutate({ id: c.id })} disabled={payMut.isPending}>Marcar pago</Button>}
                <Button size="sm" variant="outline" onClick={() => imprimirRecibo(c)}>Recibo</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.length === 0 && !listQ.isLoading && <p className="text-sm text-slate-500 py-4 text-center">Sem comissões geradas ainda. Elas aparecem quando um recebimento com intermediário vinculado é marcado como recebido.</p>}
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

// Bruno R5-P3 #6 — Aba pra editar faixas de preço (Super Admin).
function FaixasTab() {
  const utils = trpc.useUtils();
  const q = trpc.superAdmin.crmListPricingFaixas.useQuery();
  const saveMut = trpc.superAdmin.crmUpsertPricingFaixas.useMutation({
    onSuccess: () => { toast.success("Faixas atualizadas."); utils.superAdmin.crmListPricingFaixas.invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const [rows, setRows] = useState<any[]>([]);
  const data = q.data as any[] | undefined;
  // Carrega na 1ª resposta
  if (data && rows.length === 0) setRows(data.map((f: any, i: number) => ({ ...f, ordem: i + 1 })));

  function update(i: number, k: string, v: any) {
    setRows(prev => prev.map((r, j) => j === i ? { ...r, [k]: v } : r));
  }
  function add() {
    setRows(prev => [...prev, { faixa: "Nova", min: 1, max: 100, valor_mensal: 1000, ordem: prev.length + 1 }]);
  }
  function remove(i: number) {
    setRows(prev => prev.filter((_, j) => j !== i).map((r, j) => ({ ...r, ordem: j + 1 })));
  }
  function save() {
    const payload = rows.map((r, i) => ({
      faixa: String(r.faixa), min: Number(r.min), max: Number(r.max),
      valor_mensal: Number(r.valor_mensal), ordem: i + 1,
    }));
    saveMut.mutate({ faixas: payload });
  }

  return (
    <div className="space-y-3 mt-4">
      <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs">
        <b>Tabela de investimentos por nº de colaboradores.</b> Os valores aqui são usados em todas as propostas com plano "Automático por faixa" e exibidos no PDF. Edite e clique em Salvar.
      </div>
      <table className="w-full text-sm bg-white border rounded">
        <thead className="bg-slate-50 text-xs">
          <tr>
            <th className="p-2 text-left">Label</th>
            <th className="p-2 text-left">Min colab</th>
            <th className="p-2 text-left">Max colab</th>
            <th className="p-2 text-left">Valor MENSAL (R$)</th>
            <th className="p-2 text-left">Valor anual (calc)</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              <td className="p-2"><input value={r.faixa} onChange={e => update(i, "faixa", e.target.value)} className="border rounded px-2 py-1 w-full"/></td>
              <td className="p-2"><input type="number" value={r.min} onChange={e => update(i, "min", Number(e.target.value))} className="border rounded px-2 py-1 w-24"/></td>
              <td className="p-2"><input type="number" value={r.max} onChange={e => update(i, "max", Number(e.target.value))} className="border rounded px-2 py-1 w-24"/></td>
              <td className="p-2"><input type="number" step="0.01" value={r.valor_mensal} onChange={e => update(i, "valor_mensal", Number(e.target.value))} className="border rounded px-2 py-1 w-32"/></td>
              <td className="p-2 text-slate-600 text-xs">{brl(Number(r.valor_mensal) * 12)}</td>
              <td className="p-2"><button onClick={() => remove(i)} className="text-rose-600 hover:opacity-70"><Trash2 size={14}/></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-between">
        <Button variant="outline" onClick={add} className="gap-1"><Plus size={14}/> Adicionar faixa</Button>
        <Button onClick={save} disabled={saveMut.isPending} className="gap-1">{saveMut.isPending ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Salvar tabela</Button>
      </div>
    </div>
  );
}
