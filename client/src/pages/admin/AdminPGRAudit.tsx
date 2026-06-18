import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ShieldCheck, AlertTriangle, AlertOctagon, Info, CheckCircle2, Sparkles, Loader2, ListChecks } from "lucide-react";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const SEV: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  alta:   { icon: AlertOctagon,  color: "#b83225", bg: "rgba(184,50,37,.10)", label: "Crítico" },
  media:  { icon: AlertTriangle, color: "#a07a10", bg: "rgba(160,122,16,.10)", label: "Atenção" },
  baixa:  { icon: Info,          color: "#1A6FBD", bg: "rgba(26,111,189,.10)", label: "Aviso" },
};

export default function AdminPGRAudit() {
  const [pgrId, setPgrId] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const pgrList = trpc.pgr.list.useQuery();
  const auditMut = trpc.pgr.auditPgr.useMutation({
    onSuccess: (r) => { setResult(r); setRunning(false); },
    onError: (e) => { toast.error(e?.message ?? "Falha na auditoria"); setRunning(false); },
  });

  function runAudit() {
    if (!pgrId) { toast.error("Selecione um PGR antes."); return; }
    setRunning(true); setResult(null);
    auditMut.mutate({ pgrId: Number(pgrId) });
  }

  const list = pgrList.data ?? [];
  const findings: any[] = result?.findings ?? [];
  const grouped: Record<string, any[]> = {};
  for (const f of findings) {
    const cat = f.category ?? "Outros";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(f);
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-4 max-w-5xl mx-auto">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Link href="/admin/pgr" className="hover:underline flex items-center gap-1"><ArrowLeft size={14} /> Voltar ao Gerador de PGR</Link>
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            <ShieldCheck size={22} /> Auditoria Inteligente do PGR
          </h1>
          <div className="flex items-center gap-2 min-w-[320px]">
            <Select value={pgrId} onValueChange={setPgrId}>
              <SelectTrigger><SelectValue placeholder="Selecione um PGR..." /></SelectTrigger>
              <SelectContent>
                {list.map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.title}{p.razaoSocial ? ` — ${p.razaoSocial}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={runAudit} disabled={!pgrId || running} className="gap-2 whitespace-nowrap">
              {running ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {running ? "Auditando..." : "Auditar"}
            </Button>
          </div>
        </div>

        {!result && !running && (
          <div className="text-center py-16 text-slate-400">
            <ListChecks size={40} className="mx-auto mb-3 opacity-30" />
            <p>Selecione um PGR e clique em "Auditar" para executar a verificação inteligente.</p>
            <p className="text-xs mt-2">A auditoria verifica inventário, matriz e plano de ação com base na NR-01.</p>
          </div>
        )}

        {running && (
          <div className="text-center py-12 text-slate-400">
            <Loader2 size={32} className="mx-auto mb-3 animate-spin" />
            <p>Executando auditoria e gerando síntese...</p>
          </div>
        )}

        {result && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div style={{ background: "#fff", border: "1px solid rgba(14,44,70,.08)", borderRadius: 12, padding: 14 }}>
                <p style={{ margin: 0, fontSize: 11, color: "#789", fontWeight: 600, textTransform: "uppercase" }}>Total</p>
                <p style={{ margin: 0, fontSize: 24, color: "#0E2C46", fontWeight: 800 }}>{result.total}</p>
              </div>
              {(["alta", "media", "baixa"] as const).map(k => {
                const s = SEV[k]; const Icon = s.icon;
                return (
                  <div key={k} style={{ background: "#fff", border: "1px solid rgba(14,44,70,.08)", borderRadius: 12, padding: 14, display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: s.bg, color: s.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 11, color: "#789", fontWeight: 600, textTransform: "uppercase" }}>{s.label}</p>
                      <p style={{ margin: 0, fontSize: 22, color: s.color, fontWeight: 800 }}>{(result.bySeverity ?? {})[k] ?? 0}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {result.summary && (
              <div style={{ background: "linear-gradient(135deg, #f5f3ff, #f0f7f4)", border: "1px solid rgba(26,138,130,.20)", borderRadius: 14, padding: 18 }}>
                <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#0E2C46", display: "flex", alignItems: "center", gap: 6 }}>
                  <Sparkles size={16} /> Síntese da Auditoria (IA)
                </h3>
                <p style={{ margin: 0, fontSize: 13.5, color: "#334", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{result.summary}</p>
              </div>
            )}

            {findings.length === 0 ? (
              <div className="text-center py-12 text-emerald-600">
                <CheckCircle2 size={36} className="mx-auto mb-3" />
                <p className="font-semibold">Nenhuma não conformidade automática encontrada.</p>
                <p className="text-xs text-slate-500 mt-1">Recomenda-se revisão humana adicional para itens qualitativos.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(grouped).map(([cat, items]) => (
                  <div key={cat} style={{ background: "#fff", border: "1px solid rgba(14,44,70,.08)", borderRadius: 12 }}>
                    <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(14,44,70,.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <strong style={{ color: "#0E2C46", fontSize: 14 }}>{cat}</strong>
                      <span style={{ fontSize: 11, color: "#789", background: "rgba(14,44,70,.05)", padding: "2px 8px", borderRadius: 12 }}>{items.length}</span>
                    </div>
                    <div>
                      {items.map((f, i) => {
                        const s = SEV[f.severity] ?? SEV.baixa;
                        const Icon = s.icon;
                        return (
                          <div key={i} style={{ display: "flex", gap: 10, padding: "12px 16px", borderTop: i === 0 ? "none" : "1px solid rgba(14,44,70,.04)" }}>
                            <div style={{ color: s.color, flexShrink: 0, marginTop: 2 }}><Icon size={16} /></div>
                            <div style={{ flex: 1 }}>
                              <p style={{ margin: 0, fontSize: 13, color: "#0E2C46", fontWeight: 600 }}>{f.message}</p>
                              {f.fix && <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "#789" }}>💡 {f.fix}</p>}
                              <code style={{ fontSize: 10, color: "#aaa", marginTop: 2, display: "inline-block" }}>{f.code}</code>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
