import { trpc } from "@/lib/trpc";
import { Loader2, FileText, AlertTriangle, ShieldAlert, Package, ClipboardList, CheckCircle2, Clock, Send, FolderOpen, Activity, Stethoscope } from "lucide-react";

const TIPO_COLORS: Record<string, string> = {
  "Físico":      "bg-orange-100 text-orange-700 border-orange-200",
  "Químico":     "bg-yellow-100 text-yellow-700 border-yellow-200",
  "Biológico":   "bg-green-100 text-green-700 border-green-200",
  "Ergonômico":  "bg-blue-100 text-blue-700 border-blue-200",
  "Acidente":    "bg-red-100 text-red-700 border-red-200",
  "Psicossocial":"bg-purple-100 text-purple-700 border-purple-200",
  "Outro":       "bg-slate-100 text-slate-600 border-slate-200",
};

const STATUS_LABEL: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  rascunho:   { label: "Rascunho",   cls: "bg-slate-100 text-slate-600",   icon: <FileText size={12}/> },
  em_revisao: { label: "Em Revisão", cls: "bg-yellow-100 text-yellow-700", icon: <Clock size={12}/> },
  aprovado:   { label: "Aprovado",   cls: "bg-blue-100 text-blue-700",     icon: <Send size={12}/> },
  publicado:  { label: "Publicado",  cls: "bg-green-100 text-green-700",   icon: <CheckCircle2 size={12}/> },
};

function KpiCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div className="bg-white border rounded-xl p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${color ?? "bg-primary/10 text-primary"}`}>{icon}</div>
      <div>
        <div className="text-2xl font-bold leading-tight">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export default function AdminPGRDashboard() {
  const dashQ = trpc.pgr.dashboard.useQuery(undefined, { refetchOnWindowFocus: false });

  if (dashQ.isLoading) return (
    <div className="flex justify-center py-16"><Loader2 className="animate-spin text-muted-foreground" size={28}/></div>
  );
  if (!dashQ.data) return (
    <div className="text-center py-10 text-muted-foreground">Sem dados disponíveis.</div>
  );

  const d = dashQ.data as any;
  const statusEntries = Object.entries(d.statusCounts as Record<string,number>).filter(([, v]) => v > 0);
  const typeEntries = Object.entries(d.factorsByType as Record<string,number>).sort((a, b) => b[1] - a[1]);
  const maxTypeVal = Math.max(...typeEntries.map(([, v]) => v as number), 1);

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<FileText size={20}/>} label="Documentos PGR" value={d.totalPGRs} color="bg-blue-100 text-blue-700"/>
        <KpiCard icon={<ClipboardList size={20}/>} label="Fatores de Risco" value={d.totalFactors} color="bg-orange-100 text-orange-700"/>
        <KpiCard icon={<AlertTriangle size={20}/>} label="Ações Vencidas" value={d.pendingActions.length} color={d.pendingActions.length > 0 ? "bg-rose-100 text-rose-700" : "bg-green-100 text-green-700"}/>
        <KpiCard icon={<Package size={20}/>} label="EPIs c/ CA Vencido" value={d.expiredEPIs.length} color={d.expiredEPIs.length > 0 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}/>
      </div>

      {/* PCMSO + extra KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white border rounded-xl p-4 text-center">
          <div className="text-3xl font-bold">{d.totalGSE}</div>
          <div className="text-xs text-muted-foreground mt-1">Grupos GSE/GHE</div>
        </div>
        <div className="bg-white border rounded-xl p-4 text-center">
          <div className="text-3xl font-bold">{d.totalEPC}</div>
          <div className="text-xs text-muted-foreground mt-1">Medidas EPC</div>
        </div>
        <div className="bg-white border rounded-xl p-4 text-center">
          <div className="text-3xl font-bold">{d.totalEPI}</div>
          <div className="text-xs text-muted-foreground mt-1">EPIs Cadastrados</div>
        </div>
        <div className="bg-white border rounded-xl p-4 text-center">
          <div className="text-3xl font-bold">{d.pcmsoTotal ?? 0}</div>
          <div className="text-xs text-muted-foreground mt-1">Exames PCMSO</div>
        </div>
        <div className={`border rounded-xl p-4 text-center ${(d.pcmsoPendente ?? 0) > 0 ? "bg-amber-50 border-amber-200" : "bg-white"}`}>
          <div className={`text-3xl font-bold ${(d.pcmsoPendente ?? 0) > 0 ? "text-amber-700" : ""}`}>{d.pcmsoPendente ?? 0}</div>
          <div className="text-xs text-muted-foreground mt-1">PCMSO Pendentes</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Status distribution */}
        <div className="bg-white border rounded-xl p-5">
          <h3 className="font-semibold mb-4 text-sm text-foreground">Status dos Documentos</h3>
          {statusEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground"><FolderOpen size={28} className="mx-auto mb-2 opacity-30"/><p className="text-sm">Nenhum PGR cadastrado</p></div>
          ) : (
            <div className="space-y-2">
              {statusEntries.map(([st, cnt]) => {
                const info = STATUS_LABEL[st] ?? STATUS_LABEL.rascunho;
                const pct = Math.round((cnt / d.totalPGRs) * 100);
                return (
                  <div key={st}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${info.cls}`}>{info.icon}{info.label}</span>
                      <span className="text-muted-foreground">{cnt} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary/70 rounded-full" style={{ width: `${pct}%` }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Risk factors by type */}
        <div className="bg-white border rounded-xl p-5">
          <h3 className="font-semibold mb-4 text-sm text-foreground">Fatores por Tipo de Risco</h3>
          {typeEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground"><ShieldAlert size={28} className="mx-auto mb-2 opacity-30"/><p className="text-sm">Nenhum fator mapeado</p></div>
          ) : (
            <div className="space-y-2">
              {typeEntries.map(([tipo, cnt]) => {
                const pct = Math.round((cnt as number / maxTypeVal) * 100);
                const cls = TIPO_COLORS[tipo] ?? TIPO_COLORS["Outro"];
                return (
                  <div key={tipo}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full border font-medium ${cls}`}>{tipo}</span>
                      <span className="text-muted-foreground">{cnt as number}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-orange-400 opacity-60" style={{ width: `${pct}%` }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sector criticality */}
      {d.sectorCriticality && d.sectorCriticality.length > 0 && (
        <div className="bg-white border rounded-xl p-5">
          <h3 className="font-semibold mb-3 text-sm text-foreground flex items-center gap-2"><Activity size={15}/>Setores Mais Críticos</h3>
          <div className="space-y-2">
            {d.sectorCriticality.map((s: any) => {
              const maxRisk = d.sectorCriticality[0]?.risk ?? 1;
              const pct = maxRisk > 0 ? Math.round((s.risk / maxRisk) * 100) : 0;
              return (
                <div key={s.setor}>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-medium truncate max-w-[200px]">{s.setor}</span>
                    <div className="flex gap-3 text-muted-foreground shrink-0">
                      {s.critico > 0 && <span className="text-rose-600 font-medium">{s.critico} crítico{s.critico > 1 ? "s" : ""}</span>}
                      {s.alto > 0 && <span className="text-orange-600 font-medium">{s.alto} alto{s.alto > 1 ? "s" : ""}</span>}
                      <span>{s.total} total</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-rose-400" style={{ width: `${pct}%` }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Overdue actions */}
      {d.pendingActions.length > 0 && (
        <div className="bg-white border rounded-xl p-5">
          <h3 className="font-semibold mb-3 text-sm text-rose-700 flex items-center gap-2"><AlertTriangle size={15}/>Ações de Controle Vencidas ({d.pendingActions.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="text-left py-2 pr-3 font-medium">PGR</th>
                  <th className="text-left py-2 pr-3 font-medium">Fator</th>
                  <th className="text-left py-2 pr-3 font-medium">Tipo</th>
                  <th className="text-left py-2 pr-3 font-medium">Responsável</th>
                  <th className="text-left py-2 pr-3 font-medium">Prazo</th>
                  <th className="text-right py-2 font-medium">Atraso</th>
                </tr>
              </thead>
              <tbody>
                {d.pendingActions.map((a: any, i: number) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="py-2 pr-3 font-medium max-w-[140px] truncate">{a.pgrTitulo}</td>
                    <td className="py-2 pr-3 max-w-[160px] truncate">{a.fator}</td>
                    <td className="py-2 pr-3">
                      <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${TIPO_COLORS[a.tipoRisco] ?? TIPO_COLORS["Outro"]}`}>{a.tipoRisco}</span>
                    </td>
                    <td className="py-2 pr-3 max-w-[120px] truncate">{a.responsavel}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{a.prazo}</td>
                    <td className="py-2 text-right text-rose-600 font-medium">{a.daysOverdue}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expired EPIs */}
      {d.expiredEPIs.length > 0 && (
        <div className="bg-white border rounded-xl p-5">
          <h3 className="font-semibold mb-3 text-sm text-amber-700 flex items-center gap-2"><Package size={15}/>EPIs com CA Vencido ({d.expiredEPIs.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="text-left py-2 pr-3 font-medium">PGR</th>
                  <th className="text-left py-2 pr-3 font-medium">EPI</th>
                  <th className="text-left py-2 pr-3 font-medium">Nº CA</th>
                  <th className="text-left py-2 pr-3 font-medium">Validade</th>
                  <th className="text-right py-2 font-medium">Vencido há</th>
                </tr>
              </thead>
              <tbody>
                {d.expiredEPIs.map((e: any, i: number) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="py-2 pr-3 font-medium max-w-[140px] truncate">{e.pgrTitulo}</td>
                    <td className="py-2 pr-3 max-w-[180px] truncate">{e.descricao}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{e.ca || "—"}</td>
                    <td className="py-2 pr-3 text-amber-700">{e.validade}</td>
                    <td className="py-2 text-right text-amber-700 font-medium">{e.daysExpired}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {d.pendingActions.length === 0 && d.expiredEPIs.length === 0 && d.totalPGRs > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center gap-3">
          <CheckCircle2 size={20} className="text-green-600 shrink-0"/>
          <div>
            <div className="font-medium text-green-800">Tudo em dia!</div>
            <div className="text-sm text-green-700">Nenhuma ação vencida e nenhum EPI com CA vencido encontrado.</div>
          </div>
        </div>
      )}
    </div>
  );
}
