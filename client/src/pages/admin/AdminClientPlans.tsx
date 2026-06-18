import { useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Building2, Search, CheckCircle2, Plus, Sparkles, Server, Headphones,
  History, Save, Zap, Layers, Gauge, Trash2, ChevronRight,
} from "lucide-react";

const fmtBRL = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n || 0);
const PKG_ICON: Record<string, any> = {
  ia: Sparkles, saude_mental: Headphones, analytics: Gauge, capacidade: Server, conteudo: Layers,
};
const PKG_LABEL: Record<string, string> = {
  ia: "Estúdio de IA", saude_mental: "Saúde Mental Online", analytics: "Analytics+",
  capacidade: "Capacidade", conteudo: "Conteúdo",
};
const PKG_COLOR: Record<string, string> = {
  ia: "bg-purple-50 text-purple-700 border-purple-200",
  saude_mental: "bg-cyan-50 text-cyan-700 border-cyan-200",
  analytics: "bg-emerald-50 text-emerald-700 border-emerald-200",
  capacidade: "bg-orange-50 text-orange-700 border-orange-200",
  conteudo: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function AdminClientPlans() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [showAddonModal, setShowAddonModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const clientsQ = trpc.clientPlans.listClients.useQuery();
  const plansQ = trpc.clientPlans.listAvailablePlans.useQuery();
  const vertentesQ = trpc.clientPlans.listAvailableVertentes.useQuery();
  const addonsQ = trpc.clientPlans.listAvailableAddons.useQuery();

  const subQ = trpc.clientPlans.getClientSubscription.useQuery(
    { companyId: selectedId ?? 0 },
    { enabled: !!selectedId }
  );

  const histQ = trpc.clientPlans.getSubscriptionHistory.useQuery(
    { companyId: selectedId ?? 0, limit: 30 },
    { enabled: !!selectedId && showHistory }
  );

  // Estado local das mudanças pendentes
  const [draftPlan, setDraftPlan] = useState<string>("");
  const [draftVertentes, setDraftVertentes] = useState<string[]>([]);
  const [draftAddons, setDraftAddons] = useState<{ code: string; quantity: number }[]>([]);
  const [reason, setReason] = useState("");

  // Sync com dados do servidor
  useMemo(() => {
    if (subQ.data) {
      setDraftPlan(String(subQ.data.company.plan ?? ""));
      setDraftVertentes((subQ.data.vertentes ?? []).map((v: any) => v.vertente_code));
      setDraftAddons((subQ.data.addons ?? []).map((a: any) => ({ code: a.addon_code, quantity: Number(a.quantity ?? 1) })));
    }
  }, [subQ.data]);

  const updateMut = trpc.clientPlans.updateClientSubscription.useMutation({
    onSuccess: (r: any) => {
      toast.success(`Alterações aplicadas. Novo valor: ${fmtBRL(r.totalMonthly)}/mês`);
      clientsQ.refetch();
      subQ.refetch();
      setReason("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const clients = (clientsQ.data ?? []) as any[];
  const plans = (plansQ.data ?? []) as any[];
  const vertentes = (vertentesQ.data ?? []) as any[];
  const addons = (addonsQ.data ?? []) as any[];

  const filteredClients = clients.filter((c: any) =>
    !search || (c.name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  // Cálculos do draft (preview do total)
  const draftTotals = useMemo(() => {
    const plan = plans.find((p: any) => p.code === draftPlan);
    const planPrice = Number(plan?.monthly_price ?? 0);
    const vertentesPrice = draftVertentes.reduce((s: number, vc: string) => {
      const v = vertentes.find((x: any) => x.code === vc);
      return s + Number(v?.monthly_price ?? 0);
    }, 0);
    const addonsPrice = draftAddons.reduce((s: number, da) => {
      const a = addons.find((x: any) => x.code === da.code);
      return s + Number(a?.monthly_price ?? 0) * (da.quantity || 1);
    }, 0);
    return { planPrice, vertentesPrice, addonsPrice, total: planPrice + vertentesPrice + addonsPrice };
  }, [draftPlan, draftVertentes, draftAddons, plans, vertentes, addons]);

  const sub = subQ.data;
  const hasChanges = sub && (
    sub.company.plan !== draftPlan ||
    JSON.stringify(sub.vertentes.map((v: any) => v.vertente_code).sort()) !== JSON.stringify([...draftVertentes].sort()) ||
    JSON.stringify(sub.addons.map((a: any) => ({ code: a.addon_code, q: Number(a.quantity ?? 1) })).sort((x: any, y: any) => x.code.localeCompare(y.code))) !==
    JSON.stringify(draftAddons.map(a => ({ code: a.code, q: a.quantity })).sort((x, y) => x.code.localeCompare(y.code)))
  );

  function toggleVertente(code: string) {
    setDraftVertentes(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  }
  function removeAddon(code: string) {
    setDraftAddons(prev => prev.filter(a => a.code !== code));
  }
  function addAddon(code: string, quantity = 1) {
    setDraftAddons(prev => {
      const exists = prev.find(a => a.code === code);
      if (exists) return prev.map(a => a.code === code ? { ...a, quantity: a.quantity + quantity } : a);
      return [...prev, { code, quantity }];
    });
    setShowAddonModal(false);
  }
  async function handleSave() {
    if (!selectedId) return;
    await updateMut.mutateAsync({
      companyId: selectedId,
      planCode: draftPlan,
      vertentes: draftVertentes,
      addons: draftAddons,
      reason: reason || undefined,
    });
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Gestão Comercial — Clientes & Planos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão executiva por cliente. Faça upgrade de plano, adicione vertentes do Saúde Integral e contrate add-ons sem fragmentar a venda. Todas as mudanças geram audit log e recalculam o MRR.
          </p>
        </div>

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-3">
            <div className="bg-slate-50 rounded-xl p-3 sticky top-4">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2 flex items-center gap-1">
                <Building2 size={12} /> Clientes ({clients.length})
              </div>
              <div className="relative mb-2">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="text-xs h-8 pl-7" />
              </div>
              <div className="space-y-1 max-h-[600px] overflow-y-auto">
                {filteredClients.map((c: any) => {
                  const selected = c.id === selectedId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={`w-full text-left px-3 py-2 rounded-md transition-colors ${selected ? "bg-blue-50 border-l-2 border-blue-600" : "hover:bg-white"}`}
                    >
                      <div className={`text-sm font-medium ${selected ? "text-blue-700" : ""}`}>{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {planLabel(c.plan)} · {c.active_users || 0} colab.
                        {c.vertentes && <> · {String(c.vertentes).split(",").join(" ")}</>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="col-span-12 md:col-span-9 space-y-3">
            {!selectedId ? (
              <div className="bg-white rounded-xl border border-border p-10 text-center text-muted-foreground">
                <Building2 size={32} className="mx-auto mb-2 opacity-40" />
                <p>Selecione um cliente na lista ao lado para gerenciar plano, vertentes e add-ons.</p>
              </div>
            ) : !sub ? (
              <div className="bg-white rounded-xl border border-border p-10 text-center text-muted-foreground">
                Carregando dados do cliente...
              </div>
            ) : (
              <>
                <ClientHeader sub={sub} fmtBRL={fmtBRL} />

                <div className="bg-white rounded-xl border border-border p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm flex items-center gap-1"><Layers size={14} /> Plano</h3>
                    <span className="text-xs text-muted-foreground">3 opções disponíveis</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {plans.map((p: any) => {
                      const sel = draftPlan === p.code;
                      return (
                        <button
                          key={p.code}
                          onClick={() => setDraftPlan(p.code)}
                          className={`text-left p-3 rounded-lg border-2 transition-all ${sel ? "border-blue-600 bg-blue-50" : "border-border hover:border-blue-300 bg-white"}`}
                        >
                          <div className={`text-[10px] font-semibold ${sel ? "text-blue-700" : "text-muted-foreground"}`}>{String(p.order_index).padStart(2, "0")}{sel ? " · SELECIONADO" : ""}</div>
                          <div className="text-sm font-bold mt-0.5">{p.label}</div>
                          <div className="text-[11px] text-muted-foreground line-clamp-2 mt-1">{p.description}</div>
                          <div className="text-xs mt-2 font-medium">
                            {Number(p.monthly_price) > 0 ? `${fmtBRL(Number(p.monthly_price))}/mês` : "Define-se pelas vertentes"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-border p-5">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-sm flex items-center gap-1"><Sparkles size={14} /> Vertentes do Saúde Integral</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Adicione vertentes sem subir de plano. Cada uma é cobrada separadamente. Governança & Auditoria é incluída em qualquer vertente.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {vertentes.map((v: any) => {
                      const sel = draftVertentes.includes(v.code);
                      return (
                        <div key={v.code} className={`p-3 rounded-lg border-2 transition-all ${sel ? "border-emerald-500 bg-emerald-50" : "border-border bg-white"}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold" style={{ color: sel ? v.color : v.color }}>{v.code} · {v.name}</div>
                              <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{v.description}</div>
                            </div>
                            <Toggle checked={sel} onChange={() => toggleVertente(v.code)} color={v.color} />
                          </div>
                          <div className={`text-xs mt-2 font-medium ${sel ? "text-emerald-700" : "text-muted-foreground"}`}>
                            {sel ? "Ativo · " : "+ "}{fmtBRL(Number(v.monthly_price))}/mês
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-border p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm flex items-center gap-1"><Zap size={14} /> Add-ons contratados</h3>
                    <Button size="sm" onClick={() => setShowAddonModal(true)} className="text-xs">
                      <Plus size={12} className="mr-1" /> Adicionar extra
                    </Button>
                  </div>
                  {draftAddons.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Nenhum add-on contratado.</p>
                  ) : (
                    <div className="space-y-2">
                      {draftAddons.map(da => {
                        const ad = addons.find((a: any) => a.code === da.code);
                        if (!ad) return null;
                        const Icon = PKG_ICON[ad.package] ?? Zap;
                        return (
                          <div key={da.code} className="flex items-center justify-between p-2 border border-border rounded-md">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center justify-center w-7 h-7 rounded ${PKG_COLOR[ad.package] ?? "bg-slate-100 text-slate-700"}`}>
                                <Icon size={14} />
                              </span>
                              <div>
                                <div className="text-xs font-medium">{ad.name}{ad.quantifiable && da.quantity > 1 ? ` × ${da.quantity}` : ""}</div>
                                <div className="text-[10px] text-muted-foreground">{PKG_LABEL[ad.package]} · {fmtBRL(Number(ad.monthly_price) * da.quantity)}/mês</div>
                              </div>
                            </div>
                            <button onClick={() => removeAddon(da.code)} className="text-xs text-rose-600 hover:text-rose-800">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl border border-border p-5">
                  <h3 className="font-semibold text-sm flex items-center gap-1 mb-3"><Gauge size={14} /> Capacidade e uso</h3>
                  <CapacityGrid sub={sub} />
                </div>

                <div className="bg-white rounded-xl border border-border p-5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Custo mensal consolidado</div>
                      <div className="text-2xl font-bold">
                        {fmtBRL(draftTotals.total)}<span className="text-xs text-muted-foreground font-normal"> / mês</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Plano {fmtBRL(draftTotals.planPrice)} · Vertentes {fmtBRL(draftTotals.vertentesPrice)} · Add-ons {fmtBRL(draftTotals.addonsPrice)}
                      </div>
                      {hasChanges && Number(sub.totals.totalMonthly) !== draftTotals.total && (
                        <div className={`text-xs mt-1 font-semibold ${draftTotals.total > sub.totals.totalMonthly ? "text-emerald-700" : "text-rose-700"}`}>
                          Diferença: {fmtBRL(draftTotals.total - sub.totals.totalMonthly)} ({draftTotals.total > sub.totals.totalMonthly ? "+" : ""}{Math.round((draftTotals.total / Math.max(sub.totals.totalMonthly, 1) - 1) * 100)}%)
                        </div>
                      )}
                    </div>
                    <div className="flex items-end gap-2 flex-wrap">
                      <Button variant="outline" size="sm" onClick={() => setShowHistory(true)} className="text-xs">
                        <History size={12} className="mr-1" /> Histórico
                      </Button>
                      <Button size="sm" disabled={!hasChanges || updateMut.isPending} onClick={handleSave} className="text-xs">
                        <Save size={12} className="mr-1" /> {updateMut.isPending ? "Salvando..." : "Salvar alterações"}
                      </Button>
                    </div>
                  </div>
                  {hasChanges && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <label className="text-xs font-medium text-muted-foreground">Motivo da mudança (recomendado)</label>
                      <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: cliente solicitou upgrade após reunião comercial..." className="text-xs mt-1" />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {showAddonModal && (
          <AddonModal
            addons={addons}
            existing={draftAddons}
            onAdd={addAddon}
            onClose={() => setShowAddonModal(false)}
          />
        )}
        {showHistory && (
          <HistoryModal
            history={histQ.data ?? []}
            loading={histQ.isLoading}
            onClose={() => setShowHistory(false)}
          />
        )}
      </div>
    </AppLayout>
  );
}

function planLabel(code: string) {
  if (code === "nr01_inteligente") return "NR-01 Inteligente";
  if (code === "saude_integral") return "Saúde Integral";
  if (code === "corporate") return "Corporate";
  return code || "—";
}

function ClientHeader({ sub, fmtBRL }: any) {
  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-lg font-bold">{sub.company.name}</div>
          <div className="text-xs text-muted-foreground">CNPJ {sub.company.cnpj || "—"}</div>
          <div className="flex flex-wrap gap-1 mt-2">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
              <CheckCircle2 size={10} className="inline mr-0.5" /> {sub.company.subscription_status || "active"}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {sub.capacity.totalCap} colaboradores no plano
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Plano atual</div>
          <div className="text-2xl font-bold text-blue-700">{sub.plan?.label || planLabel(sub.company.plan)}</div>
          <div className="text-xs text-muted-foreground">{fmtBRL(Number(sub.totals.totalMonthly))} / mês</div>
        </div>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, color }: { checked: boolean; onChange: () => void; color?: string }) {
  return (
    <button
      onClick={onChange}
      className="relative inline-block w-8 h-4 rounded-full transition-colors border"
      style={{ background: checked ? (color || "#1D9E75") : "#e5e7eb", borderColor: checked ? (color || "#1D9E75") : "#cbd5e1" }}
    >
      <span
        className="absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all"
        style={{ left: checked ? "16px" : "2px" }}
      />
    </button>
  );
}

function CapacityGrid({ sub }: any) {
  const usedColab = Number(sub.company.active_users ?? 0);
  const totalColab = sub.capacity.totalCap || sub.company.max_employees || 100;
  const pct = Math.min(100, Math.round((usedColab / totalColab) * 100));
  const colabColor = pct > 90 ? "#dc2626" : pct > 75 ? "#f59e0b" : "#1D9E75";
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Gauge2 label="Colaboradores" used={usedColab} total={totalColab} color={colabColor} />
      <Gauge2 label="Filiais" used={1} total={5} color="#1D9E75" />
      <Gauge2 label="Ciclos no ano" used={0} total={Infinity} color="#94a3b8" />
      <Gauge2 label="Armazenamento" used={0} total={10} unit="GB" color="#1D9E75" />
    </div>
  );
}

function Gauge2({ label, used, total, color, unit }: any) {
  const isInf = total === Infinity;
  const pct = isInf ? 100 : Math.min(100, Math.round((used / Math.max(total, 1)) * 100));
  return (
    <div>
      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
        <span>{label}</span>
        <span>{used}{unit ? ` ${unit}` : ""} / {isInf ? "∞" : `${total}${unit ? ` ${unit}` : ""}`}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded overflow-hidden">
        <div className="h-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function AddonModal({ addons, existing, onAdd, onClose }: any) {
  const grouped: Record<string, any[]> = {};
  for (const a of addons) {
    if (existing.find((e: any) => e.code === a.code)) continue;
    if (!grouped[a.package]) grouped[a.package] = [];
    grouped[a.package].push(a);
  }
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-border max-w-2xl w-full max-h-[80vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">Adicionar add-on</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">×</button>
        </div>
        {Object.entries(grouped).map(([pkg, items]) => {
          const Icon = PKG_ICON[pkg] ?? Zap;
          return (
            <div key={pkg} className="mb-4">
              <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <Icon size={12} /> {PKG_LABEL[pkg]}
              </div>
              <div className="space-y-1">
                {items.map((a: any) => (
                  <div key={a.code} className="flex items-center justify-between p-2 border border-border rounded hover:bg-slate-50">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium">{a.name}</div>
                      <div className="text-[10px] text-muted-foreground">{a.description}</div>
                    </div>
                    <div className="text-xs text-muted-foreground mr-3">{fmtBRL(Number(a.monthly_price))}/mês</div>
                    <Button size="sm" onClick={() => onAdd(a.code, 1)} className="text-[11px] h-7">
                      <Plus size={10} className="mr-1" /> Adicionar
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HistoryModal({ history, loading, onClose }: any) {
  const labels: Record<string, string> = {
    plan_upgrade: "Upgrade de plano",
    plan_downgrade: "Downgrade de plano",
    subscription_update: "Atualização de assinatura",
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-border max-w-2xl w-full max-h-[80vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold flex items-center gap-1"><History size={16} /> Histórico de mudanças</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">×</button>
        </div>
        {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> :
          history.length === 0 ? <p className="text-sm text-muted-foreground italic">Sem mudanças registradas.</p> :
          <div className="space-y-2">
            {history.map((h: any) => (
              <div key={h.id} className="border border-border rounded p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">{labels[h.action] ?? h.action}</div>
                  <span className="text-[10px] text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Por {h.user_email ?? "—"}
                  {h.reason && ` · ${h.reason}`}
                </div>
                <div className="text-xs mt-1">
                  De {fmtBRL(Number(h.monthly_total_before))} para <span className="font-medium">{fmtBRL(Number(h.monthly_total_after))}</span>
                </div>
              </div>
            ))}
          </div>
        }
      </div>
    </div>
  );
}
