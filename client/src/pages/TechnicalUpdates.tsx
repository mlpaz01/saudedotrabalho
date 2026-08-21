import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, ClipboardList, FileHeart, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";

const labels: Record<string, string> = {
  pendente: "Pendente",
  aguardando_medico: "Aguardando médico",
  em_analise_medica: "Em análise médica",
  aguardando_sesmt: "Ação do SESMT",
  sem_alteracao: "Sem alteração médica",
  concluido: "Concluído",
};

export default function TechnicalUpdates() {
  const query = trpc.technicalCommunication.list.useQuery();
  const acknowledge = trpc.technicalCommunication.acknowledge.useMutation({
    onSuccess: () => { query.refetch(); toast.success("Atualização concluída com rastreabilidade preservada."); },
    onError: error => toast.error(error.message),
  });
  const rows = (query.data || []) as any[];
  const pending = rows.filter(row => !["concluido", "sem_alteracao"].includes(String(row.status))).length;

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-teal-700"><Send size={15} /> Comunicação técnica</div>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Atualizações SESMT x Médico</h1>
            <p className="mt-1 text-sm text-slate-500">Revisão do PGR, impacto médico, exames definidos e próximo passo operacional.</p>
          </div>
          <Badge className="rounded-sm bg-amber-100 text-amber-900">{pending} pendência(s)</Badge>
        </header>

        <div className="grid gap-3 md:grid-cols-3">
          <Metric label="Atualizações" value={rows.length} />
          <Metric label="Aguardando médico" value={rows.filter(row => ["pendente","aguardando_medico","em_analise_medica"].includes(row.status)).length} />
          <Metric label="Ação do SESMT" value={rows.filter(row => row.status === "aguardando_sesmt").length} alert />
        </div>

        <section className="border bg-white">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div><h2 className="font-semibold">Linha do tempo técnica</h2><p className="mt-1 text-xs text-slate-500">O PCMSO emitido nunca é alterado retroativamente.</p></div>
            <Button size="icon" variant="ghost" title="Atualizar" onClick={() => query.refetch()}><RefreshCw size={16} /></Button>
          </div>
          <div className="divide-y">
            {rows.map(row => {
              const summary = row.changes?.summary || {};
              const response = row.medicalResponse || {};
              return (
                <article key={row.id} className="space-y-4 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><b>{row.new_pgr_title}</b><Badge variant="outline">Revisão {String(row.new_pgr_revision || 0).padStart(2,"0")}</Badge><Badge className="rounded-sm bg-slate-100 text-slate-800">{labels[row.status] || row.status}</Badge></div>
                      <p className="mt-1 text-xs text-slate-500">PCMSO: {row.result_pcmso_title || row.pcmso_title} · Motivo: {row.revision_reason || "revisão técnica"}</p>
                    </div>
                    {row.status === "aguardando_sesmt" ? <AlertTriangle className="text-amber-600" size={20} /> : row.status === "concluido" ? <CheckCircle2 className="text-emerald-600" size={20} /> : <FileHeart className="text-teal-700" size={20} />}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-4">
                    <Small label="Novos riscos" value={summary.added || 0} />
                    <Small label="Riscos alterados" value={summary.modified || 0} />
                    <Small label="Riscos excluídos" value={summary.removed || 0} />
                    <Small label="Trabalhadores afetados" value={summary.affectedWorkers || response.summary?.workers || 0} />
                  </div>

                  {response.exams?.length ? (
                    <div className="overflow-x-auto border">
                      <table className="w-full min-w-[760px] text-xs"><thead className="bg-slate-50"><tr><th className="p-2 text-left">GSE</th><th className="p-2 text-left">Risco</th><th className="p-2 text-left">Exame/avaliação</th><th className="p-2 text-left">Periodicidade</th></tr></thead><tbody>
                        {response.exams.map((exam: any, index: number) => <tr className="border-t" key={`${exam.riskName}-${exam.examName}-${index}`}><td className="p-2">{exam.masterGseCode || exam.gseName}</td><td className="p-2">{exam.riskName}</td><td className="p-2 font-medium">{exam.examName}</td><td className="p-2">{exam.periodicity || "-"}</td></tr>)}
                      </tbody></table>
                    </div>
                  ) : null}

                  {response.workers?.length ? <p className="text-xs text-slate-600"><b>{response.workers.length} trabalhador(es):</b> {response.workers.slice(0,12).map((worker: any) => worker.name).join(", ")}{response.workers.length > 12 ? "..." : ""}</p> : null}

                  {row.status === "aguardando_sesmt" ? (
                    <div className="flex flex-wrap justify-end gap-2">
                      <a href={`/admin/saude-ocupacional?tab=requisicoes&pcmsoId=${row.result_pcmso_id || ""}`}><Button variant="outline"><ClipboardList size={14} className="mr-1" /> Conferir e gerar requisições</Button></a>
                      <Button disabled={acknowledge.isPending} onClick={() => { if (window.confirm("Confirmar que o SESMT analisou esta atualização e executou o próximo passo aplicável?")) acknowledge.mutate({ id: Number(row.id) }); }}><CheckCircle2 size={14} className="mr-1" /> Marcar concluído</Button>
                    </div>
                  ) : null}
                </article>
              );
            })}
            {!rows.length ? <div className="p-10 text-center text-sm text-slate-500">Nenhuma atualização técnica registrada.</div> : null}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

function Metric({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return <div className={`border p-4 ${alert && value ? "border-amber-300 bg-amber-50" : "bg-white"}`}><div className="text-xs text-slate-500">{label}</div><div className="mt-2 text-2xl font-bold">{value}</div></div>;
}

function Small({ label, value }: { label: string; value: number }) {
  return <div className="border bg-slate-50 p-2"><div className="text-[11px] text-slate-500">{label}</div><b>{value}</b></div>;
}
