import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { CreditCard, Loader2, Save, CheckCircle2, Users, CalendarClock, Sparkles } from "lucide-react";

type PlanRow = {
  id: number;
  code: string;
  label: string;
  description: string | null;
  monthlyPrice: number;
  annualPrice: number;
  maxEmployees: number | null;
  trialDays: number;
  features: string[];
  isActive: boolean;
  orderIndex: number;
};

const BRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function AdminPlans() {
  const listQ = trpc.plans.list.useQuery();
  const catalogQ = trpc.plans.featureCatalog.useQuery();
  const upsert = trpc.plans.upsert.useMutation({
    onSuccess: () => { toast.success("Plano salvo"); listQ.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar plano"),
  });
  const gatingQ = trpc.plans.gatingStatus.useQuery();
  const setGating = trpc.plans.setGating.useMutation({
    onSuccess: (r) => { toast.success(r.enabled ? "Controle de acesso ativado" : "Controle de acesso desativado"); gatingQ.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao alterar controle de acesso"),
  });

  const [drafts, setDrafts] = useState<Record<number, PlanRow>>({});

  useEffect(() => {
    if (listQ.data) {
      const map: Record<number, PlanRow> = {};
      for (const p of listQ.data as PlanRow[]) map[p.id] = { ...p };
      setDrafts(map);
    }
  }, [listQ.data]);

  const catalog = (catalogQ.data ?? []) as { code: string; label: string; group: string }[];
  const groups = Array.from(new Set(catalog.map((c) => c.group)));

  function update(id: number, patch: Partial<PlanRow>) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  }
  function toggleFeature(id: number, code: string) {
    setDrafts((d) => {
      const cur = d[id];
      const has = cur.features.includes(code);
      return { ...d, [id]: { ...cur, features: has ? cur.features.filter((f) => f !== code) : [...cur.features, code] } };
    });
  }
  function save(p: PlanRow) {
    upsert.mutate({
      id: p.id,
      code: p.code,
      label: p.label,
      description: p.description ?? null,
      monthlyPrice: Number(p.monthlyPrice) || 0,
      annualPrice: Number(p.annualPrice) || 0,
      maxEmployees: p.maxEmployees == null ? null : Number(p.maxEmployees),
      trialDays: Number(p.trialDays) || 0,
      features: p.features,
      isActive: p.isActive,
      orderIndex: p.orderIndex,
    });
  }

  const plans = Object.values(drafts).sort((a, b) => a.orderIndex - b.orderIndex || a.id - b.id);

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="relative pl-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-transparent rounded-full" />
          <h1 className="text-3xl font-bold text-primary flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            <CreditCard className="text-indigo-500" size={26} /> Planos & Assinaturas
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            Defina preços, limites, período de teste e quais funcionalidades cada plano libera.
            Estes planos alimentarão a cobrança (Stripe) e o controle de acesso por funcionalidade.
          </p>
        </div>

        {/* Kill-switch global do controle de acesso por plano */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-slate-800 flex items-center gap-2">
              <CheckCircle2 size={16} className={gatingQ.data?.enabled ? "text-emerald-500" : "text-slate-300"} />
              Controle de acesso por plano
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Quando ligado, cada empresa só enxerga as funcionalidades incluídas no seu plano.
              Mantenha desligado durante a configuração — assim ninguém perde acesso sem querer.
              Empresas sem plano cadastrado continuam com acesso total.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 pt-1">
            <span className={`text-xs font-medium ${gatingQ.data?.enabled ? "text-emerald-600" : "text-slate-400"}`}>
              {gatingQ.data?.enabled ? "Ativo" : "Desligado"}
            </span>
            <Switch
              checked={!!gatingQ.data?.enabled}
              disabled={gatingQ.isLoading || setGating.isPending}
              onCheckedChange={(v) => setGating.mutate({ enabled: v })}
            />
          </div>
        </div>

        {listQ.isLoading && (
          <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin" /></div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {plans.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">{p.code}</p>
                  <input
                    value={p.label}
                    onChange={(e) => update(p.id, { label: e.target.value })}
                    className="bg-transparent text-white font-bold text-lg outline-none border-b border-transparent focus:border-white/50 w-full"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Switch checked={p.isActive} onCheckedChange={(v) => update(p.id, { isActive: v })} />
                </div>
              </div>

              <div className="p-5 space-y-4 flex-1">
                <div>
                  <Label className="text-xs">Descrição</Label>
                  <Textarea value={p.description ?? ""} rows={2} className="resize-none text-sm"
                    onChange={(e) => update(p.id, { description: e.target.value })} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs flex items-center gap-1"><Sparkles size={11} /> Preço mensal (R$)</Label>
                    <Input type="number" min="0" step="0.01" value={p.monthlyPrice}
                      onChange={(e) => update(p.id, { monthlyPrice: parseFloat(e.target.value) })} />
                    <p className="text-[10px] text-muted-foreground mt-0.5">{BRL(Number(p.monthlyPrice) || 0)}/mês</p>
                  </div>
                  <div>
                    <Label className="text-xs">Preço anual (R$)</Label>
                    <Input type="number" min="0" step="0.01" value={p.annualPrice}
                      onChange={(e) => update(p.id, { annualPrice: parseFloat(e.target.value) })} />
                    <p className="text-[10px] text-muted-foreground mt-0.5">{BRL(Number(p.annualPrice) || 0)}/ano</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs flex items-center gap-1"><Users size={11} /> Máx. colaboradores</Label>
                    <Input type="number" min="1" placeholder="Ilimitado"
                      value={p.maxEmployees ?? ""}
                      onChange={(e) => update(p.id, { maxEmployees: e.target.value === "" ? null : Number(e.target.value) })} />
                    <p className="text-[10px] text-muted-foreground mt-0.5">{p.maxEmployees == null ? "Ilimitado" : `Até ${p.maxEmployees}`}</p>
                  </div>
                  <div>
                    <Label className="text-xs flex items-center gap-1"><CalendarClock size={11} /> Trial (dias)</Label>
                    <Input type="number" min="0" max="365" value={p.trialDays}
                      onChange={(e) => update(p.id, { trialDays: Number(e.target.value) })} />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Funcionalidades incluídas</Label>
                  <div className="mt-1.5 space-y-2">
                    {groups.map((g) => (
                      <div key={g}>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{g}</p>
                        <div className="space-y-1">
                          {catalog.filter((c) => c.group === g).map((c) => {
                            const on = p.features.includes(c.code);
                            return (
                              <button key={c.code} type="button" onClick={() => toggleFeature(p.id, c.code)}
                                className={`w-full flex items-center gap-2 text-left text-sm px-2 py-1.5 rounded-lg border transition-colors ${on ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"}`}>
                                <CheckCircle2 size={14} className={on ? "text-emerald-500" : "text-slate-300"} />
                                {c.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 p-4">
                <Button className="w-full gap-2" disabled={upsert.isPending} onClick={() => save(p)}>
                  {upsert.isPending ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                  Salvar plano
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

