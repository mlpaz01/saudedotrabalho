import { useState } from "react";
import { useLocation } from "wouter";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, ClipboardCheck, ShieldCheck, Trash2, Ban, Loader2, UserPlus } from "lucide-react";

// P18 #9/#19 — leitura rápida do dispositivo a partir do user-agent bruto (auditoria AEP).
function deviceLabel(ua?: string | null): string {
  if (!ua) return "—";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? "Android (celular)" : "Android (tablet)";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Linux/i.test(ua)) return "Linux";
  return "Outro";
}

// P17 #3 — Bruno (CAMED, empresa piloto): a AEP é destinada a chefia/liderança, mas
// colaboradores comuns respondiam sem controle e não havia como saber quem respondeu
// sem abrir perfil por perfil. Esta tela resolve rastreabilidade + exceção + invalidação.
export default function AdminAepGestao({ assessmentId }: { assessmentId: number }) {
  const [, setLocation] = useLocation();
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantUserId, setGrantUserId] = useState("");
  const [grantNote, setGrantNote] = useState("");
  const [invalidateTarget, setInvalidateTarget] = useState<{ responseId: number; name: string } | null>(null);
  const [invalidateReason, setInvalidateReason] = useState("");

  const respondentsQ = trpc.riskAssessment.aep.listRespondents.useQuery({ assessmentId });
  const exceptionsQ = trpc.riskAssessment.aep.listExceptions.useQuery({ assessmentId });

  const grantMut = trpc.riskAssessment.aep.grantException.useMutation({
    onSuccess: () => { toast.success("Exceção concedida."); setGrantOpen(false); setGrantUserId(""); setGrantNote(""); exceptionsQ.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao conceder exceção"),
  });
  const revokeMut = trpc.riskAssessment.aep.revokeException.useMutation({
    onSuccess: () => { toast.success("Exceção revogada."); exceptionsQ.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao revogar exceção"),
  });
  const invalidateMut = trpc.riskAssessment.aep.invalidateResponse.useMutation({
    onSuccess: () => { toast.success("Resposta desconsiderada."); setInvalidateTarget(null); setInvalidateReason(""); respondentsQ.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao desconsiderar resposta"),
  });

  const respondents = (respondentsQ.data ?? []) as any[];
  const exceptions = (exceptionsQ.data ?? []) as any[];
  const eligibleRoles = ["chefia", "admin", "rh", "sesmt", "psicologo", "admin_global", "company_admin", "super_admin"];

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-5">
        <div>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs -ml-2 mb-2"
            onClick={() => setLocation(`/admin/analise-risco/${assessmentId}`)}>
            <ArrowLeft size={14} /> Voltar para o ciclo
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck size={22} className="text-purple-600" /> Gestão da AEP
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            A Análise Ergonômica Preliminar é destinada a colaboradores com função de chefia/liderança.
            Aqui você acompanha quem respondeu, concede exceções controladas e desconsidera respostas indevidas.
          </p>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">Respondentes ({respondents.length})</h2>
          </div>
          {respondentsQ.isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-400" size={22} /></div>
          ) : respondents.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Ninguém respondeu a AEP ainda.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="p-2">Nome</th><th className="p-2">Cargo</th><th className="p-2">Perfil</th>
                  <th className="p-2">Setor</th><th className="p-2">Respondeu em</th><th className="p-2">IP</th><th className="p-2">Dispositivo</th><th className="p-2">Status</th><th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {respondents.map((r) => {
                  const suspicious = !eligibleRoles.includes(String(r.role));
                  return (
                    <tr key={r.responseId} className={`border-t ${suspicious && r.status !== "invalid" ? "bg-amber-50" : ""}`}>
                      <td className="p-2 font-medium">{r.name ?? <span className="italic text-slate-400">Anônimo</span>}</td>
                      <td className="p-2">{r.position ?? "—"}</td>
                      <td className="p-2 capitalize">
                        {r.role}
                        {suspicious && r.status !== "invalid" && (
                          <span className="ml-1.5 text-[10px] uppercase bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">sem função de chefia</span>
                        )}
                      </td>
                      <td className="p-2">{r.sectorName ?? "—"}</td>
                      <td className="p-2">{r.respondedAt ? new Date(r.respondedAt).toLocaleString("pt-BR") : "—"}</td>
                      <td className="p-2 font-mono text-xs">{r.ipAddress ?? "—"}</td>
                      <td className="p-2 text-xs" title={r.userAgent ?? ""}>{deviceLabel(r.userAgent)}</td>
                      <td className="p-2">
                        {r.status === "invalid" ? (
                          <span className="text-[10px] uppercase bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full">Desconsiderada</span>
                        ) : (
                          <span className="text-[10px] uppercase bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Válida</span>
                        )}
                      </td>
                      <td className="p-2">
                        {r.status !== "invalid" && (
                          <button onClick={() => setInvalidateTarget({ responseId: r.responseId, name: r.name ?? "este respondente" })}
                            className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700">
                            <Ban size={12} /> Desconsiderar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm flex items-center gap-2"><ShieldCheck size={16} className="text-emerald-600" /> Exceções concedidas</h2>
            <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
              <Button size="sm" className="gap-1.5" onClick={() => setGrantOpen(true)}><UserPlus size={14} /> Conceder exceção</Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Conceder exceção de acesso à AEP</DialogTitle>
                  <DialogDescription>
                    Use quando a empresa não tem supervisor/gestor formal e um colaborador
                    precisa responder a AEP no lugar da chefia.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>ID do colaborador</Label>
                    <Input value={grantUserId} onChange={(e) => setGrantUserId(e.target.value)} placeholder="Ex.: 56046" />
                  </div>
                  <div>
                    <Label>Justificativa</Label>
                    <Textarea value={grantNote} onChange={(e) => setGrantNote(e.target.value)} rows={3}
                      placeholder="Ex.: empresa sem supervisor formal; colaboradora acumula função de liderança." />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setGrantOpen(false)}>Cancelar</Button>
                  <Button disabled={grantMut.isPending || !grantUserId || !grantNote}
                    onClick={() => grantMut.mutate({ assessmentId, userId: Number(grantUserId), note: grantNote })}>
                    {grantMut.isPending && <Loader2 className="animate-spin mr-1.5" size={14} />} Conceder
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {exceptions.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">Nenhuma exceção concedida.</p>
          ) : (
            <div className="space-y-2">
              {exceptions.map((e: any) => (
                <div key={e.id} className="flex items-center justify-between border rounded-lg p-3 text-sm">
                  <div>
                    <b>{e.name}</b> <span className="text-xs text-slate-500">({e.position ?? "—"})</span>
                    <p className="text-xs text-slate-500 mt-0.5">{e.note}</p>
                  </div>
                  <button onClick={() => { if (confirm("Revogar esta exceção?")) revokeMut.mutate({ id: e.id }); }}
                    className="text-rose-500 hover:opacity-70"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!invalidateTarget} onOpenChange={(o) => !o && setInvalidateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desconsiderar resposta</DialogTitle>
            <DialogDescription>
              A resposta de {invalidateTarget?.name} deixará de contar na AEP, na Matriz de Riscos
              e nos relatórios técnicos. Esta ação é auditável.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Justificativa</Label>
            <Textarea value={invalidateReason} onChange={(e) => setInvalidateReason(e.target.value)} rows={3}
              placeholder="Ex.: colaborador sem função de chefia respondeu por engano." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvalidateTarget(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={invalidateMut.isPending || !invalidateReason}
              onClick={() => invalidateTarget && invalidateMut.mutate({ responseId: invalidateTarget.responseId, justification: invalidateReason })}>
              {invalidateMut.isPending && <Loader2 className="animate-spin mr-1.5" size={14} />} Desconsiderar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
