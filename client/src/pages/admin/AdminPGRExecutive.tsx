import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, BarChart3, AlertCircle, Shield, FileWarning, CheckCircle2, Clock, Layers, ShieldAlert } from "lucide-react";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const COLORS = {
  baixo: { bg: "rgba(46,165,106,.10)", color: "#2EA56A" },
  medio: { bg: "rgba(160,122,16,.10)", color: "#a07a10" },
  alto: { bg: "rgba(216,118,29,.12)", color: "#d8761d" },
  critico: { bg: "rgba(184,50,37,.12)", color: "#b83225" },
  pendente: { bg: "rgba(120,120,120,.10)", color: "#666" },
  em_andamento: { bg: "rgba(40,110,189,.10)", color: "#1A6FBD" },
  concluido: { bg: "rgba(46,165,106,.10)", color: "#2EA56A" },
  vencido: { bg: "rgba(184,50,37,.12)", color: "#b83225" },
};

function MetricCard({ icon, label, value, color }: { icon: any; label: string; value: number | string; color?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid rgba(14,44,70,.08)", borderRadius: 12, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(14,44,70,.06)", color: color ?? "#0E2C46", display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
      <div>
        <p style={{ margin: 0, fontSize: 11, color: "#789", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</p>
        <p style={{ margin: 0, fontSize: 22, color: "#0E2C46", fontWeight: 800 }}>{value}</p>
      </div>
    </div>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: "#334", fontWeight: 600 }}>{label}</span>
        <span style={{ color: "#789" }}>{value}</span>
      </div>
      <div style={{ height: 8, background: "rgba(0,0,0,.05)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${Math.max(2, pct)}%`, height: "100%", background: color, transition: "width .25s" }} />
      </div>
    </div>
  );
}

export default function AdminPGRExecutive() {
  const [pgrId, setPgrId] = useState<string>("");
  const pgrList = trpc.pgr.list.useQuery();
  const overview = trpc.pgr.executiveOverview.useQuery({ pgrId: Number(pgrId) }, { enabled: !!pgrId });

  const list = pgrList.data ?? [];
  const data = overview.data;

  const matrixTotal = data ? (data.matrix.baixo + data.matrix.medio + data.matrix.alto + data.matrix.critico) : 0;
  const matrixMax = data ? Math.max(1, data.matrix.baixo, data.matrix.medio, data.matrix.alto, data.matrix.critico) : 1;
  const planTotal = data ? (data.actionPlan.pendente + data.actionPlan.em_andamento + data.actionPlan.concluido + data.actionPlan.vencido) : 0;
  const planMax = data ? Math.max(1, data.actionPlan.pendente, data.actionPlan.em_andamento, data.actionPlan.concluido, data.actionPlan.vencido) : 1;

  return (
    <AppLayout>
      <div className="p-6 space-y-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Link href="/admin/pgr" className="hover:underline flex items-center gap-1"><ArrowLeft size={14} /> Voltar ao Gerador de PGR</Link>
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2"><BarChart3 size={22} /> Dashboard Executivo do PGR</h1>
          <div className="min-w-[280px]">
            <Select value={pgrId} onValueChange={setPgrId}>
              <SelectTrigger><SelectValue placeholder="Selecione um PGR..." /></SelectTrigger>
              <SelectContent>
                {list.map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.title}{p.razaoSocial ? ` — ${p.razaoSocial}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!pgrId && (
          <div className="text-center py-16 text-slate-400">
            <BarChart3 size={40} className="mx-auto mb-3 opacity-30" />
            <p>Selecione um PGR para visualizar os indicadores.</p>
          </div>
        )}

        {pgrId && overview.isLoading && <p className="text-sm text-slate-400">Carregando indicadores…</p>}

        {pgrId && data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard icon={<Layers size={20} />} label="GHE / GSE" value={data.inventory.totalGheGse} />
              <MetricCard icon={<Shield size={20} />} label="Trabalhadores Expostos" value={data.inventory.trabalhadoresExpostos} />
              <MetricCard icon={<ShieldAlert size={20} />} label="EPC / EPI Cadastrados" value={`${data.inventory.epc} / ${data.inventory.epi}`} />
              <MetricCard icon={<AlertCircle size={20} />} label="Riscos Críticos + Altos" value={data.matrix.critico + data.matrix.alto} color="#b83225" />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div style={{ background: "#fff", border: "1px solid rgba(14,44,70,.08)", borderRadius: 14, padding: 18 }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#0E2C46", display: "flex", alignItems: "center", gap: 8 }}>
                  <FileWarning size={16} /> Matriz de Riscos
                </h3>
                <Bar label="Críticos" value={data.matrix.critico} max={matrixMax} color={COLORS.critico.color} />
                <Bar label="Altos" value={data.matrix.alto} max={matrixMax} color={COLORS.alto.color} />
                <Bar label="Médios" value={data.matrix.medio} max={matrixMax} color={COLORS.medio.color} />
                <Bar label="Baixos" value={data.matrix.baixo} max={matrixMax} color={COLORS.baixo.color} />
                <p style={{ fontSize: 11, color: "#789", marginTop: 8 }}>Total: {matrixTotal} fatores classificados</p>
              </div>

              <div style={{ background: "#fff", border: "1px solid rgba(14,44,70,.08)", borderRadius: 14, padding: 18 }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#0E2C46", display: "flex", alignItems: "center", gap: 8 }}>
                  <Clock size={16} /> Plano de Ação
                </h3>
                <Bar label="Vencidas" value={data.actionPlan.vencido} max={planMax} color={COLORS.vencido.color} />
                <Bar label="Pendentes" value={data.actionPlan.pendente} max={planMax} color={COLORS.pendente.color} />
                <Bar label="Em andamento" value={data.actionPlan.em_andamento} max={planMax} color={COLORS.em_andamento.color} />
                <Bar label="Concluídas" value={data.actionPlan.concluido} max={planMax} color={COLORS.concluido.color} />
                <p style={{ fontSize: 11, color: "#789", marginTop: 8 }}>Total: {planTotal} ações no plano</p>
              </div>
            </div>

            {(data.actionPlan.vencido > 0 || data.matrix.critico > 0) && (
              <div style={{ background: "rgba(184,50,37,.06)", border: "1px solid rgba(184,50,37,.20)", borderRadius: 12, padding: 14, fontSize: 13, color: "#b83225", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <strong>Atenção:</strong>
                  {data.matrix.critico > 0 && <span> {data.matrix.critico} fator(es) com risco <strong>crítico</strong> na matriz.</span>}
                  {data.actionPlan.vencido > 0 && <span> {data.actionPlan.vencido} ação(ões) <strong>vencida(s)</strong> no plano.</span>}
                </div>
              </div>
            )}

            {planTotal === 0 && matrixTotal === 0 && (
              <div className="text-center py-8 text-slate-400 text-sm">
                <CheckCircle2 size={28} className="mx-auto mb-2 opacity-30" />
                <p>Sem dados consolidados ainda. Inicie um ciclo de Análise de Risco para popular os indicadores.</p>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
