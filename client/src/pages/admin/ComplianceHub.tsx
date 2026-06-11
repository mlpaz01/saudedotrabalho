import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ShieldCheck, ChevronDown, ChevronRight, FileText, Shield, Database, FileWarning } from "lucide-react";

const STATUS_META: Record<string, { dot: string; label: string; bar: string }> = {
  completed: { dot: "bg-green-500", label: "Completo", bar: "bg-green-500" },
  in_progress: { dot: "bg-yellow-500", label: "Em progresso", bar: "bg-yellow-500" },
  expired: { dot: "bg-red-500", label: "Vencido / crítico", bar: "bg-red-500" },
  not_started: { dot: "bg-gray-300", label: "Não iniciado", bar: "bg-gray-300" },
};

const CATEGORY_META: Record<string, { icon: any; label: string }> = {
  NR: { icon: Shield, label: "Normas Regulamentadoras" },
  LGPD: { icon: Database, label: "Proteção de Dados" },
  eSocial: { icon: FileWarning, label: "eSocial" },
};

export default function ComplianceHub() {
  const statusQ = trpc.compliance.status.useQuery();
  const scoreQ = trpc.compliance.score.useQuery();
  const utils = trpc.useUtils();
  const updateMut = trpc.compliance.update.useMutation({
    onSuccess: () => { utils.compliance.status.invalidate(); utils.compliance.score.invalidate(); toast.success("Status atualizado!"); },
    onError: (e) => toast.error(e.message),
  });

  const [expanded, setExpanded] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<number, { status: string; completionPercent: number; notes: string; evidenceUrl: string }>>({});

  const items = statusQ.data ?? [];
  const score = scoreQ.data ?? 0;

  const grouped: Record<string, any[]> = {};
  for (const it of items) {
    const k = it.category || "Outros";
    (grouped[k] = grouped[k] || []).push(it);
  }

  function getDraft(it: any) {
    return draft[it.id] ?? { status: it.status, completionPercent: it.completionPercent, notes: it.notes ?? "", evidenceUrl: it.evidenceUrl ?? "" };
  }
  function setDraftField(itemId: number, base: any, field: string, value: any) {
    setDraft((d) => ({ ...d, [itemId]: { ...getDraft(base), [field]: value } }));
  }
  function save(it: any) {
    const d = getDraft(it);
    updateMut.mutate({ itemId: it.id, status: d.status, completionPercent: Number(d.completionPercent), notes: d.notes, evidenceUrl: d.evidenceUrl });
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="relative pl-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-transparent rounded-full" />
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="text-primary" size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-primary" style={{ fontFamily: "'Playfair Display', serif" }}>Hub de Conformidade</h1>
              <p className="text-muted-foreground text-sm">Acompanhe o status de NRs, LGPD e eSocial da sua empresa</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-sm text-muted-foreground">Score de conformidade geral</p>
              <p className="text-4xl font-bold text-primary mt-1">{score}%</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Sua empresa está <strong className={score >= 70 ? "text-green-600" : score >= 40 ? "text-yellow-600" : "text-red-600"}>{score}% pronta</strong>
            </p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div className={`h-full transition-all ${score >= 70 ? "bg-green-500" : score >= 40 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${score}%` }} />
          </div>
        </div>

        {statusQ.isLoading && <div className="text-center py-12 text-muted-foreground">Carregando...</div>}

        {Object.entries(grouped).map(([cat, list]) => {
          const meta = CATEGORY_META[cat] ?? { icon: Shield, label: cat };
          const Icon = meta.icon;
          return (
            <div key={cat} className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-muted/30 border-b border-border flex items-center gap-2">
                <Icon size={18} className="text-primary" />
                <h2 className="font-semibold text-primary">{meta.label}</h2>
              </div>
              <div className="divide-y divide-border">
                {list.map((it: any) => {
                  const sm = STATUS_META[it.status] ?? STATUS_META.not_started;
                  const isOpen = expanded === it.id;
                  const d = getDraft(it);
                  return (
                    <div key={it.id}>
                      <button onClick={() => setExpanded(isOpen ? null : it.id)} className="w-full px-6 py-4 flex items-center gap-4 hover:bg-muted/20 transition-colors">
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${sm.dot}`} />
                        <div className="flex-1 text-left min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{it.code}</span>
                            <span className="text-sm text-foreground truncate">{it.name}</span>
                          </div>
                          {it.completionPercent > 0 && (
                            <div className="w-32 h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                              <div className={`h-full ${sm.bar}`} style={{ width: `${it.completionPercent}%` }} />
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground hidden md:inline">{sm.label}</span>
                        {isOpen ? <ChevronDown size={18} className="text-muted-foreground flex-shrink-0" /> : <ChevronRight size={18} className="text-muted-foreground flex-shrink-0" />}
                      </button>
                      {isOpen && (
                        <div className="px-6 py-4 bg-muted/10 space-y-4">
                          {it.description && <p className="text-sm text-muted-foreground">{it.description}</p>}
                          {it.legalBasis && <p className="text-xs text-muted-foreground italic">Base legal: {it.legalBasis}</p>}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-semibold mb-1 block">Status</label>
                              <select value={d.status} onChange={(e) => setDraftField(it.id, it, "status", e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white">
                                <option value="not_started">Não iniciado</option>
                                <option value="in_progress">Em progresso</option>
                                <option value="completed">Completo</option>
                                <option value="expired">Vencido / crítico</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-semibold mb-1 block">% concluído</label>
                              <Input type="number" min={0} max={100} value={d.completionPercent} onChange={(e) => setDraftField(it.id, it, "completionPercent", Number(e.target.value))} />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-semibold mb-1 block">Anotações</label>
                            <Textarea rows={2} value={d.notes} onChange={(e) => setDraftField(it.id, it, "notes", e.target.value)} placeholder="Detalhes do andamento, próximos passos, responsáveis..." />
                          </div>
                          <div>
                            <label className="text-xs font-semibold mb-1 block flex items-center gap-1"><FileText size={12} /> URL de evidência</label>
                            <Input value={d.evidenceUrl} onChange={(e) => setDraftField(it.id, it, "evidenceUrl", e.target.value)} placeholder="Link para documento, PDF, política..." />
                          </div>
                          <div className="flex gap-2 pt-2">
                            <Button onClick={() => save(it)} disabled={updateMut.isPending}>Salvar</Button>
                            <Button variant="outline" onClick={() => toast.info("Geração de relatório em desenvolvimento.")}>Gerar relatório para fiscal</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
