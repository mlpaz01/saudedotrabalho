import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Clock, Save, Trash2, Loader2, Building2 } from "lucide-react";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

type DayRule = { weekday: number; hourStart: number; hourEnd: number; enabled: boolean };

export default function SuperAdminAccessHours() {
  const companiesQ = trpc.superAdmin.listCompanies.useQuery();
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [days, setDays] = useState<DayRule[]>([]);
  const [hasRules, setHasRules] = useState(false);

  const hoursQ = trpc.superAdmin.listCompanyAccessHours.useQuery(
    { companyId: companyId ?? 0 },
    { enabled: !!companyId }
  );

  useEffect(() => {
    if (hoursQ.data) {
      setDays(hoursQ.data.rows);
      setHasRules(hoursQ.data.hasRules);
    }
  }, [hoursQ.data]);

  const saveMut = trpc.superAdmin.saveCompanyAccessHours.useMutation({
    onSuccess: () => { toast.success("Regras salvas. Vão valer no próximo login."); hoursQ.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });
  const clearMut = trpc.superAdmin.clearCompanyAccessHours.useMutation({
    onSuccess: () => { toast.success("Restrições removidas. Empresa volta a ter acesso 24/7."); hoursQ.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao limpar"),
  });

  function update(idx: number, patch: Partial<DayRule>) {
    setDays(prev => prev.map((d, i) => i === idx ? { ...d, ...patch } : d));
  }
  function applyWeekday(start: number, end: number) {
    setDays(prev => prev.map(d => d.weekday >= 1 && d.weekday <= 5
      ? { ...d, hourStart: start, hourEnd: end, enabled: true }
      : { ...d, enabled: false }));
  }

  const companies = (companiesQ.data ?? []) as any[];
  const selectedName = companies.find((c: any) => c.id === companyId)?.name ?? "";

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Clock size={22} className="text-blue-600" />
            Horários autorizados por empresa
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define a janela de acesso (login) por empresa cliente. Fora dela, o login retorna 403 com mensagem explicativa.
            <br />
            Super admins / admin globais <b>sempre passam</b>. Empresas sem regras = livre 24/7.
          </p>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <label className="text-sm font-semibold flex items-center gap-2 mb-2">
            <Building2 size={16} /> Empresa
          </label>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm"
            value={companyId ?? ""}
            onChange={(e) => setCompanyId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— selecione uma empresa —</option>
            {companies.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {companyId && (
          <div className="bg-white border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="font-semibold">{selectedName}</h2>
                <p className="text-xs text-muted-foreground">
                  {hasRules ? "Regras salvas — abaixo está o estado atual." : "Sem regras: acesso atualmente liberado 24/7. Configure abaixo."}
                </p>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" onClick={() => applyWeekday(8, 18)}>Padrão: seg–sex 08–18</Button>
                <Button size="sm" variant="outline" onClick={() => applyWeekday(7, 19)}>seg–sex 07–19</Button>
                <Button size="sm" variant="outline" onClick={() => setDays(prev => prev.map(d => ({ ...d, enabled: true })))}>Tudo aberto</Button>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-2 py-2 w-32">Dia</th>
                  <th className="px-2 py-2 w-24">Aberto?</th>
                  <th className="px-2 py-2">Início</th>
                  <th className="px-2 py-2">Fim</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d, i) => (
                  <tr key={d.weekday} className="border-t">
                    <td className="px-2 py-2 font-medium">{WEEKDAYS[d.weekday]}</td>
                    <td className="px-2 py-2">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={d.enabled}
                          onChange={(e) => update(i, { enabled: e.target.checked })}
                        />
                        <span className={d.enabled ? "text-emerald-700" : "text-slate-400"}>
                          {d.enabled ? "sim" : "fechado"}
                        </span>
                      </label>
                    </td>
                    <td className="px-2 py-2">
                      <select
                        className="border rounded px-2 py-1"
                        value={d.hourStart}
                        disabled={!d.enabled}
                        onChange={(e) => update(i, { hourStart: Number(e.target.value) })}
                      >
                        {Array.from({ length: 24 }, (_, h) => (
                          <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <select
                        className="border rounded px-2 py-1"
                        value={d.hourEnd}
                        disabled={!d.enabled}
                        onChange={(e) => update(i, { hourEnd: Number(e.target.value) })}
                      >
                        {Array.from({ length: 24 }, (_, h) => h + 1).map((h) => (
                          <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-between pt-3 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm("Remover TODAS as regras desta empresa? Ela voltará a ter acesso 24/7.")) {
                    clearMut.mutate({ companyId });
                  }
                }}
                disabled={!hasRules || clearMut.isPending}
                className="text-rose-600 border-rose-200 hover:bg-rose-50"
              >
                {clearMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Remover restrições
              </Button>
              <Button
                onClick={() => saveMut.mutate({ companyId, days })}
                disabled={saveMut.isPending}
                className="gap-1"
              >
                {saveMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar regras
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
