import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownUp,
  Building2,
  CheckCircle2,
  CreditCard,
  Palette,
  Plus,
  RefreshCw,
  Save,
  Shield,
  Sparkles,
  Wallet,
} from "lucide-react";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numberFmt = new Intl.NumberFormat("pt-BR");

function n(value: any) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: any) {
  return currency.format(n(value));
}

function percent(value: any) {
  return `${n(value).toFixed(1).replace(".", ",")}%`;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-lg border bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="block text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full rounded-lg border px-3 py-2 text-sm ${props.className || ""}`} />;
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`w-full rounded-lg border px-3 py-2 text-sm bg-white ${props.className || ""}`} />;
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`w-full rounded-lg border px-3 py-2 text-sm ${props.className || ""}`} />;
}

const emptyPartner = {
  legalName: "",
  tradeName: "",
  document: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  planCode: "start_white_label",
  status: "active",
  monthlyPrice: 397,
  setupPrice: 1800,
  brandName: "",
  logoUrl: "",
  primaryColor: "#0097a7",
  secondaryColor: "#fbbf24",
  customDomain: "",
  supportLevel: "N2 para parceiro",
  hideSdtBrand: true,
  allowPartnerBranding: true,
  notes: "",
};

export default function SuperAdminWhiteLabel() {
  const [tab, setTab] = useState<"dashboard" | "partners" | "pricing" | "ai" | "clients">("dashboard");
  const overview = (trpc.superAdmin as any).whiteLabelOverview.useQuery();
  const plans = (trpc.superAdmin as any).whiteLabelListPlans.useQuery();
  const packages = (trpc.superAdmin as any).whiteLabelListAiPackages.useQuery();
  const partners = (trpc.superAdmin as any).whiteLabelListPartners.useQuery();
  const companies = (trpc.superAdmin as any).whiteLabelListCompanies.useQuery();
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const selectedPartner = (trpc.superAdmin as any).whiteLabelGetPartner.useQuery(
    { id: selectedPartnerId || 0 },
    { enabled: !!selectedPartnerId },
  );

  const refreshAll = () => {
    overview.refetch();
    plans.refetch();
    packages.refetch();
    partners.refetch();
    companies.refetch();
    selectedPartner.refetch();
  };

  useEffect(() => {
    const first = partners.data?.[0]?.id;
    if (!selectedPartnerId && first) setSelectedPartnerId(Number(first));
  }, [partners.data, selectedPartnerId]);

  const totals = overview.data?.totals || {};
  const selectedSummary = useMemo(
    () => (partners.data || []).find((p: any) => Number(p.id) === Number(selectedPartnerId)),
    [partners.data, selectedPartnerId],
  );

  return (
    <AppLayout>
      <div className="p-6 space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
              <Shield size={24} /> White Label
            </h1>
            <p className="text-sm text-slate-600">
              Controle de parceiros, marca, planos, clientes vinculados e franquia de IA.
            </p>
          </div>
          <button onClick={refreshAll} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm hover:bg-slate-50">
            <RefreshCw size={15} /> Atualizar
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            ["dashboard", "Painel", Shield],
            ["partners", "Parceiros", Building2],
            ["pricing", "Planos e precos", CreditCard],
            ["ai", "Creditos de IA", Sparkles],
            ["clients", "Clientes/CNPJs", Palette],
          ].map(([key, label, Icon]: any) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                tab === key ? "bg-primary text-white border-primary" : "bg-white hover:bg-slate-50"
              }`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {tab === "dashboard" && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <Metric label="Parceiros ativos" value={numberFmt.format(n(totals.activePartners))} />
              <Metric label="Receita mensal white label" value={money(totals.monthlyRevenue)} />
              <Metric label="CNPJs vinculados" value={numberFmt.format(n(totals.linkedCompanies))} />
              <Metric label="Colaboradores ativos" value={numberFmt.format(n(totals.activeEmployees))} />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Metric label="IA consumida no mes" value={numberFmt.format(n(totals.aiConsumed))} hint="creditos registrados" />
              <Metric label="Custo estimado de IA" value={money(totals.aiCost)} />
              <Metric label="Receita em creditos IA" value={money(totals.aiRevenue)} />
            </div>
            <Card>
              <h2 className="font-semibold mb-3">Parceiros</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="p-2">Parceiro</th>
                      <th className="p-2">Plano</th>
                      <th className="p-2">Mensalidade</th>
                      <th className="p-2">CNPJs</th>
                      <th className="p-2">Colaboradores</th>
                      <th className="p-2">IA usada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(partners.data || []).map((p: any) => (
                      <tr key={p.id} className="border-t">
                        <td className="p-2 font-medium">{p.trade_name || p.legal_name}</td>
                        <td className="p-2">{p.plan_label || p.plan_code}</td>
                        <td className="p-2">{money(p.monthly_price)}</td>
                        <td className="p-2">{n(p.linked_companies)} / {n(p.included_cnpjs)}</td>
                        <td className="p-2">{numberFmt.format(n(p.active_employees))} / {numberFmt.format(n(p.included_employees))}</td>
                        <td className="p-2">{numberFmt.format(n(p.consumed_credits_current_period))} / {numberFmt.format(n(p.credit_limit_monthly))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {tab === "partners" && (
          <PartnersTab
            plans={plans.data || []}
            partners={partners.data || []}
            selectedPartnerId={selectedPartnerId}
            setSelectedPartnerId={setSelectedPartnerId}
            selectedSummary={selectedSummary}
            selectedDetail={selectedPartner.data}
            onDone={refreshAll}
          />
        )}

        {tab === "pricing" && <PricingTab plans={plans.data || []} onDone={refreshAll} />}
        {tab === "ai" && (
          <AiTab
            packages={packages.data || []}
            partners={partners.data || []}
            selectedPartnerId={selectedPartnerId}
            setSelectedPartnerId={setSelectedPartnerId}
            selectedDetail={selectedPartner.data}
            onDone={refreshAll}
          />
        )}
        {tab === "clients" && (
          <ClientsTab
            companies={companies.data || []}
            partners={partners.data || []}
            selectedPartnerId={selectedPartnerId}
            setSelectedPartnerId={setSelectedPartnerId}
            onDone={refreshAll}
          />
        )}
      </div>
    </AppLayout>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </Card>
  );
}

function PartnersTab({ plans, partners, selectedPartnerId, setSelectedPartnerId, selectedSummary, selectedDetail, onDone }: any) {
  const save = (trpc.superAdmin as any).whiteLabelUpsertPartner.useMutation({
    onSuccess: () => {
      toast.success("Parceiro salvo.");
      onDone();
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar parceiro."),
  });

  const [form, setForm] = useState<any>(emptyPartner);

  useEffect(() => {
    const p = selectedDetail?.partner || selectedSummary;
    if (!p) return;
    setForm({
      id: Number(p.id),
      legalName: p.legal_name || "",
      tradeName: p.trade_name || "",
      document: p.document || "",
      contactName: p.contact_name || "",
      contactEmail: p.contact_email || "",
      contactPhone: p.contact_phone || "",
      planCode: p.plan_code || "start_white_label",
      status: p.status || "active",
      monthlyPrice: n(p.monthly_price),
      setupPrice: n(p.setup_price),
      brandName: p.brand_name || "",
      logoUrl: p.logo_url || "",
      primaryColor: p.primary_color || "#0097a7",
      secondaryColor: p.secondary_color || "#fbbf24",
      customDomain: p.custom_domain || "",
      supportLevel: p.support_level || "N2 para parceiro",
      hideSdtBrand: Number(p.hide_sdt_brand ?? 1) === 1,
      allowPartnerBranding: Number(p.allow_partner_branding ?? 1) === 1,
      notes: p.notes || "",
    });
  }, [selectedDetail, selectedSummary]);

  const applyPlan = (code: string) => {
    const p = plans.find((x: any) => x.code === code);
    setForm((f: any) => ({
      ...f,
      planCode: code,
      monthlyPrice: n(p?.monthly_price ?? f.monthlyPrice),
      setupPrice: n(p?.setup_price ?? f.setupPrice),
      changeType: n(f.id) ? (n(p?.monthly_price) > n(f.monthlyPrice) ? "upgrade" : "downgrade") : "manual",
    }));
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Parceiros</h2>
          <button onClick={() => { setSelectedPartnerId(null); setForm(emptyPartner); }} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs">
            <Plus size={13} /> Novo
          </button>
        </div>
        <div className="space-y-2 max-h-[640px] overflow-auto pr-1">
          {partners.map((p: any) => (
            <button
              key={p.id}
              onClick={() => setSelectedPartnerId(Number(p.id))}
              className={`w-full rounded-lg border p-3 text-left text-sm ${Number(selectedPartnerId) === Number(p.id) ? "border-primary bg-primary/5" : "bg-white hover:bg-slate-50"}`}
            >
              <div className="font-semibold">{p.trade_name || p.legal_name}</div>
              <div className="text-xs text-slate-500">{p.plan_label || p.plan_code} | {money(p.monthly_price)}</div>
            </button>
          ))}
        </div>
      </Card>

      <div className="space-y-4">
        <Card>
          <h2 className="font-semibold mb-3">Cadastro e proposta comercial</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Razao social"><Input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} /></Field>
            <Field label="Nome comercial"><Input value={form.tradeName} onChange={(e) => setForm({ ...form, tradeName: e.target.value })} /></Field>
            <Field label="CNPJ/CPF"><Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} /></Field>
            <Field label="Responsavel"><Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></Field>
            <Field label="E-mail"><Input value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></Field>
            <Field label="Telefone"><Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></Field>
            <Field label="Plano">
              <Select value={form.planCode} onChange={(e) => applyPlan(e.target.value)}>
                {plans.map((p: any) => <option key={p.code} value={p.code}>{p.label}</option>)}
              </Select>
            </Field>
            <Field label="Mensalidade negociada"><Input type="number" value={form.monthlyPrice} onChange={(e) => setForm({ ...form, monthlyPrice: n(e.target.value) })} /></Field>
            <Field label="Setup negociado"><Input type="number" value={form.setupPrice} onChange={(e) => setForm({ ...form, setupPrice: n(e.target.value) })} /></Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Ativo</option>
                <option value="trial">Piloto</option>
                <option value="paused">Pausado</option>
                <option value="canceled">Cancelado</option>
              </Select>
            </Field>
            <Field label="Tipo da mudanca"><Select value={form.changeType || "manual"} onChange={(e) => setForm({ ...form, changeType: e.target.value })}><option value="manual">Manual</option><option value="upgrade">Upgrade</option><option value="downgrade">Downgrade</option></Select></Field>
            <Field label="Suporte incluido"><Input value={form.supportLevel} onChange={(e) => setForm({ ...form, supportLevel: e.target.value })} /></Field>
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Palette size={16} /> Marca do parceiro</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Nome da marca"><Input value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })} /></Field>
            <Field label="URL da logo"><Input value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} /></Field>
            <Field label="Dominio customizado"><Input value={form.customDomain} onChange={(e) => setForm({ ...form, customDomain: e.target.value })} placeholder="portal.parceiro.com.br" /></Field>
            <Field label="Cor principal"><Input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} /></Field>
            <Field label="Cor secundaria"><Input type="color" value={form.secondaryColor} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} /></Field>
            <div className="flex items-end gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.hideSdtBrand} onChange={(e) => setForm({ ...form, hideSdtBrand: e.target.checked })} /> Ocultar Saude do Trabalho</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.allowPartnerBranding} onChange={(e) => setForm({ ...form, allowPartnerBranding: e.target.checked })} /> Marca propria</label>
            </div>
          </div>
          <div className="mt-3">
            <Field label="Observacoes"><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => save.mutate(form)}
              disabled={save.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Save size={15} /> Salvar parceiro
            </button>
          </div>
        </Card>

        {selectedDetail?.wallet && (
          <Card>
            <h2 className="font-semibold mb-3">Franquia atual de IA</h2>
            <div className="grid gap-3 md:grid-cols-4 text-sm">
              <MetricMini label="Franquia mensal" value={numberFmt.format(n(selectedDetail.wallet.included_credits_monthly))} />
              <MetricMini label="Saldo comprado" value={numberFmt.format(n(selectedDetail.wallet.purchased_credits_balance))} />
              <MetricMini label="Consumido no mes" value={numberFmt.format(n(selectedDetail.wallet.consumed_credits_current_period))} />
              <MetricMini label="Limite configurado" value={numberFmt.format(n(selectedDetail.wallet.credit_limit_monthly))} />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border bg-slate-50 p-3"><div className="text-xs text-slate-500">{label}</div><div className="font-bold">{value}</div></div>;
}

function PricingTab({ plans, onDone }: any) {
  const save = (trpc.superAdmin as any).whiteLabelUpsertPlan.useMutation({
    onSuccess: () => { toast.success("Plano atualizado."); onDone(); },
    onError: (e: any) => toast.error(e?.message || "Erro ao atualizar plano."),
  });
  const [editing, setEditing] = useState<any>(null);

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-semibold mb-3">Tabela comercial white label</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((p: any) => (
            <button key={p.code} onClick={() => setEditing({
              code: p.code, label: p.label, monthlyPrice: n(p.monthly_price), setupPrice: n(p.setup_price),
              includedCnpjs: n(p.included_cnpjs), includedEmployees: n(p.included_employees),
              includedStorageGb: n(p.included_storage_gb), includedAiCredits: n(p.included_ai_credits),
              isActive: Number(p.is_active ?? 1) === 1, sortOrder: n(p.sort_order),
            })} className="rounded-lg border bg-white p-4 text-left hover:bg-slate-50">
              <div className="font-semibold text-primary">{p.label}</div>
              <div className="mt-2 text-2xl font-bold">{money(p.monthly_price)}/mes</div>
              <div className="text-sm text-slate-500">Setup {money(p.setup_price)}</div>
              <div className="mt-3 text-xs text-slate-600">{p.included_cnpjs} CNPJs | {numberFmt.format(n(p.included_employees))} colaboradores | {p.included_storage_gb} GB | {numberFmt.format(n(p.included_ai_credits))} creditos IA</div>
            </button>
          ))}
        </div>
      </Card>
      {editing && (
        <Card>
          <h2 className="font-semibold mb-3">Editar plano</h2>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Codigo"><Input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} /></Field>
            <Field label="Nome"><Input value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} /></Field>
            <Field label="Mensalidade"><Input type="number" value={editing.monthlyPrice} onChange={(e) => setEditing({ ...editing, monthlyPrice: n(e.target.value) })} /></Field>
            <Field label="Setup"><Input type="number" value={editing.setupPrice} onChange={(e) => setEditing({ ...editing, setupPrice: n(e.target.value) })} /></Field>
            <Field label="CNPJs incluidos"><Input type="number" value={editing.includedCnpjs} onChange={(e) => setEditing({ ...editing, includedCnpjs: n(e.target.value) })} /></Field>
            <Field label="Colaboradores incluidos"><Input type="number" value={editing.includedEmployees} onChange={(e) => setEditing({ ...editing, includedEmployees: n(e.target.value) })} /></Field>
            <Field label="Storage GB"><Input type="number" value={editing.includedStorageGb} onChange={(e) => setEditing({ ...editing, includedStorageGb: n(e.target.value) })} /></Field>
            <Field label="Creditos IA/mes"><Input type="number" value={editing.includedAiCredits} onChange={(e) => setEditing({ ...editing, includedAiCredits: n(e.target.value) })} /></Field>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={editing.isActive} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} /> Plano ativo</label>
            <button onClick={() => save.mutate(editing)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"><Save size={15} /> Salvar plano</button>
          </div>
        </Card>
      )}
    </div>
  );
}

function AiTab({ packages, partners, selectedPartnerId, setSelectedPartnerId, selectedDetail, onDone }: any) {
  const savePackage = (trpc.superAdmin as any).whiteLabelUpsertAiPackage.useMutation({
    onSuccess: () => { toast.success("Pacote de IA atualizado."); onDone(); },
    onError: (e: any) => toast.error(e?.message || "Erro ao atualizar pacote."),
  });
  const createOrder = (trpc.superAdmin as any).whiteLabelCreateAiCreditOrder.useMutation({
    onSuccess: (r: any) => { toast.success(r?.message || "Pedido criado."); onDone(); },
    onError: (e: any) => toast.error(e?.message || "Erro ao criar pedido."),
  });
  const markPaid = (trpc.superAdmin as any).whiteLabelMarkAiOrderPaid.useMutation({
    onSuccess: () => { toast.success("Pagamento baixado e creditos liberados."); onDone(); },
    onError: (e: any) => toast.error(e?.message || "Erro ao baixar pagamento."),
  });
  const adjust = (trpc.superAdmin as any).whiteLabelAdjustAiCredits.useMutation({
    onSuccess: () => { toast.success("Saldo ajustado."); onDone(); },
    onError: (e: any) => toast.error(e?.message || "Erro ao ajustar saldo."),
  });
  const [editing, setEditing] = useState<any>(null);
  const [order, setOrder] = useState<any>({ packageId: "", paymentMethod: "pix", paymentProvider: "manual" });
  const [manualCredits, setManualCredits] = useState(0);

  const selectedPackage = packages.find((p: any) => Number(p.id) === Number(order.packageId));
  const margin = selectedPackage ? ((n(selectedPackage.sale_price) - n(selectedPackage.estimated_cost)) / Math.max(1, n(selectedPackage.sale_price))) * 100 : 0;

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-semibold mb-3 flex items-center gap-2"><Sparkles size={16} /> Pacotes de IA para revenda</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {packages.map((p: any) => (
            <button key={p.id} onClick={() => setEditing({
              id: n(p.id), code: p.code, label: p.label, credits: n(p.credits), salePrice: n(p.sale_price),
              estimatedCost: n(p.estimated_cost), isActive: Number(p.is_active ?? 1) === 1, sortOrder: n(p.sort_order),
            })} className="rounded-lg border bg-white p-4 text-left hover:bg-slate-50">
              <div className="font-semibold text-primary">{p.label}</div>
              <div className="mt-2 text-2xl font-bold">{money(p.sale_price)}</div>
              <div className="text-sm text-slate-500">Custo estimado {money(p.estimated_cost)}</div>
              <div className="mt-2 text-xs text-emerald-700">Margem {percent(p.margin_pct)}</div>
            </button>
          ))}
        </div>
      </Card>

      {editing && (
        <Card>
          <h2 className="font-semibold mb-3">Editar pacote de creditos</h2>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Codigo"><Input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} /></Field>
            <Field label="Nome"><Input value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} /></Field>
            <Field label="Creditos"><Input type="number" value={editing.credits} onChange={(e) => setEditing({ ...editing, credits: n(e.target.value) })} /></Field>
            <Field label="Preco de venda"><Input type="number" value={editing.salePrice} onChange={(e) => setEditing({ ...editing, salePrice: n(e.target.value) })} /></Field>
            <Field label="Custo estimado"><Input type="number" value={editing.estimatedCost} onChange={(e) => setEditing({ ...editing, estimatedCost: n(e.target.value) })} /></Field>
            <Field label="Ordem"><Input type="number" value={editing.sortOrder} onChange={(e) => setEditing({ ...editing, sortOrder: n(e.target.value) })} /></Field>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={editing.isActive} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} /> Pacote ativo</label>
            <button onClick={() => savePackage.mutate(editing)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"><Save size={15} /> Salvar pacote</button>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Wallet size={16} /> Pedido de creditos</h2>
          <div className="grid gap-3">
            <Field label="Parceiro">
              <Select value={selectedPartnerId || ""} onChange={(e) => setSelectedPartnerId(Number(e.target.value))}>
                <option value="">Selecione</option>
                {partners.map((p: any) => <option key={p.id} value={p.id}>{p.trade_name || p.legal_name}</option>)}
              </Select>
            </Field>
            <Field label="Pacote">
              <Select value={order.packageId} onChange={(e) => setOrder({ ...order, packageId: e.target.value })}>
                <option value="">Selecione</option>
                {packages.map((p: any) => <option key={p.id} value={p.id}>{p.label} - {money(p.sale_price)}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <MetricMini label="Creditos" value={numberFmt.format(n(selectedPackage?.credits))} />
              <MetricMini label="Valor" value={money(selectedPackage?.sale_price)} />
              <MetricMini label="Margem" value={percent(margin)} />
            </div>
            <Field label="Forma de pagamento">
              <Select value={order.paymentMethod} onChange={(e) => setOrder({ ...order, paymentMethod: e.target.value })}>
                <option value="pix">Pix</option>
                <option value="card">Cartao</option>
                <option value="manual">Manual</option>
              </Select>
            </Field>
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              O pedido ja fica registrado. Pix/cartao automatico exigem escolha do provedor e credenciais; ate la, a baixa manual libera os creditos com rastreabilidade.
            </p>
            <button
              disabled={!selectedPartnerId || !order.packageId}
              onClick={() => createOrder.mutate({ partnerId: selectedPartnerId, packageId: Number(order.packageId), paymentMethod: order.paymentMethod, paymentProvider: order.paymentProvider })}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              <CreditCard size={15} /> Criar pedido
            </button>
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold mb-3">Carteira do parceiro</h2>
          {selectedDetail?.wallet ? (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <MetricMini label="Franquia mensal" value={numberFmt.format(n(selectedDetail.wallet.included_credits_monthly))} />
                <MetricMini label="Saldo extra" value={numberFmt.format(n(selectedDetail.wallet.purchased_credits_balance))} />
                <MetricMini label="Consumido" value={numberFmt.format(n(selectedDetail.wallet.consumed_credits_current_period))} />
                <MetricMini label="Custo estimado" value={money(selectedDetail.wallet.estimated_cost_current_period)} />
              </div>
              <div className="flex gap-2">
                <Input type="number" value={manualCredits} onChange={(e) => setManualCredits(n(e.target.value))} placeholder="Creditos manuais" />
                <button onClick={() => adjust.mutate({ partnerId: selectedPartnerId, credits: manualCredits, note: "Ajuste manual pelo Super Admin" })} className="rounded-lg border px-3 py-2 text-sm">Ajustar</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-2">Pedido</th><th className="p-2">Creditos</th><th className="p-2">Valor</th><th className="p-2">Status</th><th className="p-2"></th></tr></thead>
                  <tbody>
                    {(selectedDetail.orders || []).map((o: any) => (
                      <tr key={o.id} className="border-t">
                        <td className="p-2">#{o.id}</td>
                        <td className="p-2">{numberFmt.format(n(o.credits))}</td>
                        <td className="p-2">{money(o.amount)}</td>
                        <td className="p-2">{o.status}</td>
                        <td className="p-2 text-right">{o.status !== "paid" ? <button onClick={() => markPaid.mutate({ orderId: Number(o.id) })} className="rounded-lg border px-2 py-1 text-xs">Baixar</button> : <CheckCircle2 size={16} className="text-emerald-600" />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : <p className="text-sm text-slate-500">Selecione um parceiro para ver a carteira.</p>}
        </Card>
      </div>
    </div>
  );
}

function ClientsTab({ companies, partners, selectedPartnerId, setSelectedPartnerId, onDone }: any) {
  const link = (trpc.superAdmin as any).whiteLabelLinkCompany.useMutation({
    onSuccess: () => { toast.success("Cliente vinculado ao parceiro."); onDone(); },
    onError: (e: any) => toast.error(e?.message || "Erro ao vincular cliente."),
  });
  const unlink = (trpc.superAdmin as any).whiteLabelUnlinkCompany.useMutation({
    onSuccess: () => { toast.success("Cliente removido do white label."); onDone(); },
    onError: (e: any) => toast.error(e?.message || "Erro ao remover vinculo."),
  });

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-semibold mb-3 flex items-center gap-2"><Building2 size={16} /> Vinculo de clientes/CNPJs</h2>
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <Field label="Parceiro de destino">
            <Select value={selectedPartnerId || ""} onChange={(e) => setSelectedPartnerId(Number(e.target.value))}>
              <option value="">Selecione</option>
              {partners.map((p: any) => <option key={p.id} value={p.id}>{p.trade_name || p.legal_name}</option>)}
            </Select>
          </Field>
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            Cada CNPJ fica em apenas um white label ativo por vez, mantendo isolamento por empresa.
          </div>
        </div>
      </Card>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="p-2">Empresa</th>
                <th className="p-2">CNPJ</th>
                <th className="p-2">Colaboradores ativos</th>
                <th className="p-2">Parceiro atual</th>
                <th className="p-2 text-right">Acao</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c: any) => (
                <tr key={c.id} className="border-t">
                  <td className="p-2 font-medium">{c.name}</td>
                  <td className="p-2">{c.cnpj || "-"}</td>
                  <td className="p-2">{numberFmt.format(n(c.active_employees))}</td>
                  <td className="p-2">{c.partner_name || "Sem white label"}</td>
                  <td className="p-2 text-right">
                    {c.partner_id ? (
                      <button onClick={() => unlink.mutate({ companyId: Number(c.id) })} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs"><ArrowDownUp size={12} /> Remover</button>
                    ) : (
                      <button disabled={!selectedPartnerId} onClick={() => link.mutate({ partnerId: selectedPartnerId, companyId: Number(c.id) })} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs disabled:opacity-50"><Plus size={12} /> Vincular</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
