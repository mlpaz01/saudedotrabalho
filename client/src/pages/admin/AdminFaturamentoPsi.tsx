import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DollarSign, Clock, FileText, Printer } from "lucide-react";

/**
 * R5-P12 #12 — Relatório de Faturamento Psicológico (CRM · Financeiro).
 * Valor/hora por psicólogo, tempo mínimo faturável (no-show) e relatório mensal
 * com base oficial para conferência e pagamento.
 */
const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const STATUS_LABEL: Record<string, string> = {
  pending: "Agendada", confirmed: "Confirmada", in_progress: "Em andamento", completed: "Realizada",
  cancelled: "Cancelada", rescheduled: "Reagendada", no_show: "Não compareceu",
  no_show_collaborator: "Não compareceu (colab.)", no_show_professional: "Não compareceu (psic.)",
  cancelled_by_collaborator: "Cancelada pelo colaborador", cancelled_by_professional: "Cancelada pelo psicólogo",
  cancelled_by_company: "Cancelada pela empresa",
};
const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function AdminFaturamentoPsi() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [professionalId, setProfessionalId] = useState<number | "">("");

  const profsQ = (trpc.billing as any).listProfessionalsWithRate.useQuery();
  const cfgQ = (trpc.billing as any).getConfig.useQuery();
  const profs = (profsQ.data ?? []) as any[];

  const setRateMut = (trpc.billing as any).setHourlyRate.useMutation({
    onSuccess: () => { profsQ.refetch(); toast.success("Valor/hora atualizado."); }, onError: (e: any) => toast.error(e.message),
  });
  const setCfgMut = (trpc.billing as any).setConfig.useMutation({
    onSuccess: () => { cfgQ.refetch(); toast.success("Tempo mínimo salvo."); }, onError: (e: any) => toast.error(e.message),
  });

  const reportQ = (trpc.billing as any).monthlyReport.useQuery(
    { year, month, professionalId: professionalId ? Number(professionalId) : undefined },
    { enabled: true }
  );
  const report = reportQ.data ?? { items: [], totals: {} };

  const [rateDraft, setRateDraft] = useState<Record<number, string>>({});
  const [minMin, setMinMin] = useState<string>("");

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-primary flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            <DollarSign size={26} /> Relatório de Faturamento Psicológico
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Base oficial para conferência, pagamento e auditoria dos atendimentos.</p>
        </header>

        {/* Config — valor/hora + tempo mínimo faturável */}
        <section className="bg-white border rounded-xl p-5 space-y-4">
          <h2 className="font-bold text-base flex items-center gap-2"><Clock size={18} /> Parâmetros</h2>
          <div className="flex items-end gap-2 flex-wrap">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Tempo mínimo faturável no no-show (min)</label>
              <Input type="number" className="w-48" placeholder={String(cfgQ.data?.minBillableMinutes ?? 15)}
                value={minMin} onChange={e => setMinMin(e.target.value)} />
            </div>
            <Button variant="outline" onClick={() => { const n = Number(minMin); if (n >= 0) setCfgMut.mutate({ minBillableMinutes: n }); }}>Salvar</Button>
            <span className="text-xs text-slate-500">Atual: <b>{cfgQ.data?.minBillableMinutes ?? 15} min</b> — no-show com espera ≥ esse tempo é faturável.</span>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-600 mb-1">Valor/hora por psicólogo</div>
            <div className="space-y-2">
              {profs.map((p: any) => (
                <div key={p.id} className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm w-56 truncate">{p.name}{p.specialty ? ` — ${p.specialty}` : ""}</span>
                  <span className="text-xs text-slate-400">atual {fmtBRL(p.hourlyRate)}</span>
                  <Input type="number" step="0.01" className="w-32" placeholder="R$/hora"
                    value={rateDraft[p.id] ?? ""} onChange={e => setRateDraft({ ...rateDraft, [p.id]: e.target.value })} />
                  <Button size="sm" variant="outline" onClick={() => {
                    const v = Number(rateDraft[p.id]); if (v >= 0) setRateMut.mutate({ professionalId: p.id, hourlyRate: v });
                  }}>Salvar</Button>
                </div>
              ))}
              {profs.length === 0 && <p className="text-xs text-slate-400">Nenhum profissional cadastrado.</p>}
            </div>
          </div>
        </section>

        {/* Relatório mensal */}
        <section className="bg-white border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-bold text-base flex items-center gap-2"><FileText size={18} /> Relatório mensal</h2>
            <div className="flex gap-2 items-end flex-wrap">
              <select value={month} onChange={e => setMonth(Number(e.target.value))} className="border rounded px-2 py-1.5 text-sm">
                {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <Input type="number" className="w-24" value={year} onChange={e => setYear(Number(e.target.value))} />
              <select value={professionalId} onChange={e => setProfessionalId(e.target.value ? Number(e.target.value) : "")} className="border rounded px-2 py-1.5 text-sm">
                <option value="">Todos os psicólogos</option>
                {profs.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1"><Printer size={14} /> Imprimir</Button>
            </div>
          </div>

          {/* Totais */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { l: "Realizadas", v: report.totals?.realizadas ?? 0 },
              { l: "Faltas (no-show)", v: report.totals?.faltas ?? 0 },
              { l: "Cancelamentos", v: report.totals?.cancelamentos ?? 0 },
              { l: "Horas faturáveis", v: report.totals?.horasFaturaveis ?? 0 },
              { l: "Valor total", v: fmtBRL(report.totals?.valorTotal ?? 0), highlight: true },
            ].map((t, i) => (
              <div key={i} className={`border rounded-lg p-3 ${t.highlight ? "bg-emerald-50 border-emerald-200" : ""}`}>
                <div className="text-[10px] uppercase text-slate-500">{t.l}</div>
                <div className={`text-lg font-bold ${t.highlight ? "text-emerald-700" : "text-slate-800"}`}>{t.v}</div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-1.5 pr-2">Empresa</th><th className="py-1.5 pr-2">Colaborador</th><th className="py-1.5 pr-2">Psicólogo</th>
                  <th className="py-1.5 pr-2">Data/hora</th><th className="py-1.5 pr-2">Início</th><th className="py-1.5 pr-2">Fim</th>
                  <th className="py-1.5 pr-2">Min</th><th className="py-1.5 pr-2">Situação</th><th className="py-1.5 pr-2">R$/h</th><th className="py-1.5 pr-2">Faturável</th>
                </tr>
              </thead>
              <tbody>
                {(report.items ?? []).map((r: any) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-2">{r.company ?? "—"}</td>
                    <td className="py-1.5 pr-2">{r.collaborator ?? "—"}</td>
                    <td className="py-1.5 pr-2">{r.professional ?? "—"}</td>
                    <td className="py-1.5 pr-2">{r.scheduledAt ? new Date(r.scheduledAt).toLocaleString("pt-BR") : "—"}</td>
                    <td className="py-1.5 pr-2">{r.startedAt ? new Date(r.startedAt).toLocaleTimeString("pt-BR").slice(0,5) : "—"}</td>
                    <td className="py-1.5 pr-2">{r.endedAt ? new Date(r.endedAt).toLocaleTimeString("pt-BR").slice(0,5) : "—"}</td>
                    <td className="py-1.5 pr-2">{r.effectiveMinutes || "—"}</td>
                    <td className="py-1.5 pr-2">{STATUS_LABEL[r.status] ?? r.status}</td>
                    <td className="py-1.5 pr-2">{fmtBRL(r.hourlyRate)}</td>
                    <td className="py-1.5 pr-2 font-semibold">{r.billable ? fmtBRL(r.valorFaturavel) : "—"}</td>
                  </tr>
                ))}
                {(report.items ?? []).length === 0 && (
                  <tr><td colSpan={10} className="py-6 text-center text-slate-400">Nenhum atendimento no período.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
