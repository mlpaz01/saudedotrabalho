import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Eye,
  FileHeart,
  FlaskConical,
  History,
  RefreshCw,
  Send,
  ShieldAlert,
  Stethoscope,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

const eventStatusLabels: Record<string, string> = {
  nova: "Nova atualização",
  visualizada: "Visualizada",
  requer_analise: "Requer análise",
  em_analise: "Em análise",
  ajuste_realizado: "Ajuste realizado",
  concluida: "Concluída",
};

const revisionStatusLabels: Record<string, string> = {
  pendente: "Pendente",
  aguardando_medico: "Aguardando médico",
  em_analise_medica: "Em análise médica",
  aguardando_sesmt: "Ação do SESMT",
  sem_alteracao: "Sem alteração médica",
  concluido: "Concluído",
};

const fieldLabels: Record<string, string> = {
  agente: "Risco/agente", tipo: "Tipo", fonte_geradora: "Fonte ou causa",
  possivel_dano: "Possível dano", tipo_exposicao: "Exposição", severidade: "Severidade",
  probabilidade: "Probabilidade", risco_final: "Classificação", name: "Exame",
  exam_type: "Tipo de exame", default_periodicity: "Periodicidade",
  monitoring_name: "Exame ou avaliação", monitoring_kind: "Controle médico",
  periodicity: "Periodicidade definida", applicability: "Aplicabilidade",
  observations: "Observações", is_active: "Ativo",
  collaborator: "Colaborador", cpf: "CPF", matricula: "Matrícula",
  filial: "Filial", setor: "Setor", cargo: "Cargo", exame: "Exame",
  dataExame: "Data do exame", dataLancamento: "Data de lançamento",
  clinica: "Clínica/credenciado", cnpjClinica: "CNPJ da clínica",
  resultado: "Resultado", classificacao: "Classificação",
  prioridadeMedica: "Prioridade médica",
};

type FeedFilter = "pending" | "history" | "all";

export default function TechnicalUpdates() {
  const [filter, setFilter] = useState<FeedFilter>("pending");
  const feedQuery = trpc.technicalCommunication.feed.useQuery();
  const revisionsQuery = trpc.technicalCommunication.list.useQuery();
  const updateStatus = trpc.technicalCommunication.updateEventStatus.useMutation({
    onSuccess: () => { feedQuery.refetch(); toast.success("Situação da atualização registrada."); },
    onError: error => toast.error(error.message),
  });
  const acknowledge = trpc.technicalCommunication.acknowledge.useMutation({
    onSuccess: () => { revisionsQuery.refetch(); toast.success("Atualização concluída com rastreabilidade preservada."); },
    onError: error => toast.error(error.message),
  });
  const feed = feedQuery.data as any;
  const events = (feed?.events || []) as any[];
  const revisions = (revisionsQuery.data || []) as any[];
  const visibleEvents = useMemo(() => events.filter(event => {
    if (filter === "pending") return !["ajuste_realizado", "concluida"].includes(event.status);
    if (filter === "history") return ["ajuste_realizado", "concluida"].includes(event.status);
    return true;
  }), [events, filter]);
  const refresh = () => { feedQuery.refetch(); revisionsQuery.refetch(); };

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-teal-700"><Send size={15} /> Comunicação técnica</div>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Atualizações SESMT x Médico</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">Acompanhe o que mudou, quem alterou e qual providência técnica é esperada do outro profissional.</p>
          </div>
          <div className="flex items-center gap-2">
            {Number(feed?.newCount || 0) > 0 ? <Badge className="rounded-sm bg-red-600 px-3 py-1 text-white">{feed.newCount} nova(s)</Badge> : null}
            <Button size="icon" variant="outline" title="Atualizar" onClick={refresh}><RefreshCw size={16} /></Button>
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Novas atualizações" value={Number(feed?.newCount || 0)} tone="danger" icon={<AlertCircle size={18} />} />
          <Metric label="Pendências técnicas" value={Number(feed?.pendingCount || 0)} tone="warning" icon={<ClipboardCheck size={18} />} />
          <Metric label="Alterações de risco" value={events.filter(event => String(event.change_type).startsWith("risk_")).length} icon={<ShieldAlert size={18} />} />
          <Metric label="Exames e decisões" value={events.filter(event => String(event.change_type).includes("exam") || String(event.change_type).includes("monitoring")).length} icon={<Stethoscope size={18} />} />
        </div>

        <section className="border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div><h2 className="font-semibold text-slate-950">Bússola de atualizações</h2><p className="mt-1 text-xs text-slate-500">Alterações relevantes nunca são aplicadas silenciosamente para o outro perfil.</p></div>
            <div className="flex border border-slate-200 p-1">
              <FilterButton active={filter === "pending"} onClick={() => setFilter("pending")}>Pendentes</FilterButton>
              <FilterButton active={filter === "history"} onClick={() => setFilter("history")}>Histórico</FilterButton>
              <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>Todas</FilterButton>
            </div>
          </div>
          <div className="divide-y divide-slate-200">
            {visibleEvents.map(event => <TechnicalEvent key={event.id} event={event} busy={updateStatus.isPending} onStatus={status => updateStatus.mutate({ id: Number(event.id), status } as any)} />)}
            {!visibleEvents.length ? <div className="p-10 text-center text-sm text-slate-500">Nenhuma atualização neste filtro.</div> : null}
          </div>
        </section>

        <section className="border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-2"><History size={17} className="text-teal-700" /><h2 className="font-semibold">Revisões PGR x PCMSO</h2></div>
            <p className="mt-1 text-xs text-slate-500">Fluxo documental de revisões e impacto médico, preservado junto à nova trilha operacional.</p>
          </div>
          <div className="divide-y divide-slate-200">
            {revisions.map(row => <RevisionEvent key={row.id} row={row} busy={acknowledge.isPending} onAcknowledge={() => acknowledge.mutate({ id: Number(row.id) })} />)}
            {!revisions.length ? <div className="p-8 text-center text-sm text-slate-500">Nenhuma revisão documental registrada.</div> : null}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

function TechnicalEvent({ event, busy, onStatus }: { event: any; busy: boolean; onStatus: (status: any) => void }) {
  const isNew = event.status === "nova";
  const changes = Object.entries(event.changes || {}) as Array<[string, any]>;
  const context = event.context || {};
  const EventIcon = String(event.change_type).startsWith("risk_") ? ShieldAlert : String(event.change_type).includes("exam") ? FlaskConical : Stethoscope;
  return (
    <article className={`space-y-4 p-4 md:p-5 ${isNew ? "border-l-4 border-l-red-600 bg-red-50/40" : "border-l-4 border-l-transparent"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center border ${isNew ? "border-red-200 bg-red-100 text-red-700" : "border-teal-200 bg-teal-50 text-teal-700"}`}><EventIcon size={18} /></div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {isNew ? <Badge className="rounded-sm bg-red-600 text-white">Nova atualização</Badge> : null}
              <Badge variant="outline" className="rounded-sm">{eventStatusLabels[event.status] || event.status}</Badge>
              <span className="text-xs font-medium uppercase text-slate-500">{event.origin_role} para {event.target_role}</span>
            </div>
            <h3 className="mt-2 font-semibold text-slate-950">{event.title}</h3><p className="mt-1 text-sm text-slate-700">{event.summary}</p>
          </div>
        </div>
        <div className="text-right text-xs text-slate-500"><div>{formatDate(event.created_at)}</div><div className="mt-1">Por {event.created_by_name || event.created_by_email || "usuário técnico"}</div></div>
      </div>

      {(context.pgrTitle || context.gseName || context.riskName || context.category) ? <div className="flex flex-wrap gap-x-5 gap-y-1 border-y border-slate-200 py-2 text-xs text-slate-600">
        {context.pgrTitle ? <span><b>PGR:</b> {context.pgrTitle}</span> : null}{context.gseName ? <span><b>GSE:</b> {context.gseName}</span> : null}{context.riskName ? <span><b>Risco:</b> {context.riskName}</span> : null}{context.category ? <span><b>Categoria:</b> {context.category}</span> : null}
      </div> : null}

      {changes.length ? <div><div className="mb-2 text-xs font-semibold uppercase text-slate-500">O que mudou</div><div className="overflow-x-auto border border-slate-200"><table className="w-full min-w-[680px] text-xs">
        <thead className="bg-slate-50 text-slate-600"><tr><th className="p-2 text-left">Informação</th><th className="p-2 text-left">Antes</th><th className="p-2 text-center"></th><th className="p-2 text-left">Agora</th></tr></thead>
        <tbody>{changes.slice(0, 12).map(([field, change]) => <tr className="border-t border-slate-200" key={field}><td className="p-2 font-medium">{fieldLabels[field] || field.replaceAll("_", " ")}</td><td className="p-2 text-slate-500">{displayValue(change.before)}</td><td className="p-2 text-center text-slate-400"><ArrowRight size={14} className="inline" /></td><td className="p-2 font-medium text-slate-900">{displayValue(change.after)}</td></tr>)}</tbody>
      </table></div></div> : null}

      {event.action_expected ? <div className="border-l-2 border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-950"><b>Providência esperada:</b> {event.action_expected}</div> : null}
      <div className="flex flex-wrap justify-end gap-2">
        {event.status === "nova" ? <Button size="sm" variant="outline" disabled={busy} onClick={() => onStatus("visualizada")}><Eye size={14} className="mr-1" /> Marcar visualizada</Button> : null}
        {["nova", "visualizada"].includes(event.status) ? <Button size="sm" variant="outline" disabled={busy} onClick={() => onStatus("requer_analise")}><AlertCircle size={14} className="mr-1" /> Requer análise</Button> : null}
        {["nova", "visualizada", "requer_analise"].includes(event.status) ? <Button size="sm" disabled={busy} onClick={() => onStatus("em_analise")}><ClipboardCheck size={14} className="mr-1" /> Iniciar análise</Button> : null}
        {event.status === "em_analise" ? <Button size="sm" disabled={busy} onClick={() => onStatus("ajuste_realizado")}><CheckCircle2 size={14} className="mr-1" /> Ajuste realizado</Button> : null}
        {event.status === "ajuste_realizado" ? <Button size="sm" disabled={busy} onClick={() => onStatus("concluida")}><CheckCircle2 size={14} className="mr-1" /> Concluir</Button> : null}
      </div>
    </article>
  );
}

function RevisionEvent({ row, busy, onAcknowledge }: { row: any; busy: boolean; onAcknowledge: () => void }) {
  const summary = row.changes?.summary || {};
  const response = row.medicalResponse || {};
  return <article className="space-y-3 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><b>{row.new_pgr_title}</b><Badge variant="outline" className="rounded-sm">Revisão {String(row.new_pgr_revision || 0).padStart(2, "0")}</Badge><Badge className="rounded-sm bg-slate-100 text-slate-800">{revisionStatusLabels[row.status] || row.status}</Badge></div><p className="mt-1 text-xs text-slate-500">{row.company_name ? `${row.company_name} · ` : ""}PCMSO: {row.result_pcmso_title || row.pcmso_title} · Motivo: {row.revision_reason || "revisão técnica"}</p></div>{row.status === "aguardando_sesmt" ? <AlertCircle className="text-amber-600" size={20} /> : row.status === "concluido" ? <CheckCircle2 className="text-emerald-600" size={20} /> : <FileHeart className="text-teal-700" size={20} />}</div>
    <div className="grid gap-2 sm:grid-cols-4"><Small label="Novos riscos" value={summary.added || 0} /><Small label="Riscos alterados" value={summary.modified || 0} /><Small label="Riscos excluídos" value={summary.removed || 0} /><Small label="Trabalhadores afetados" value={summary.affectedWorkers || response.summary?.workers || 0} /></div>
    {row.status === "aguardando_sesmt" ? <div className="flex flex-wrap justify-end gap-2"><a href={`/plataforma/admin/saude-ocupacional?tab=requisicoes&pcmsoId=${row.result_pcmso_id || ""}`}><Button variant="outline"><ClipboardList size={14} className="mr-1" /> Conferir requisições</Button></a><Button disabled={busy} onClick={onAcknowledge}><CheckCircle2 size={14} className="mr-1" /> Marcar concluído</Button></div> : null}
  </article>;
}

function Metric({ label, value, tone = "neutral", icon }: { label: string; value: number; tone?: "neutral" | "danger" | "warning"; icon: ReactNode }) {
  const toneClass = tone === "danger" && value ? "border-red-300 bg-red-50 text-red-900" : tone === "warning" && value ? "border-amber-300 bg-amber-50 text-amber-950" : "border-slate-200 bg-white text-slate-950";
  return <div className={`border p-4 ${toneClass}`}><div className="flex items-center justify-between text-xs"><span>{label}</span>{icon}</div><div className="mt-2 text-2xl font-bold">{value}</div></div>;
}
function Small({ label, value }: { label: string; value: number }) { return <div className="border border-slate-200 bg-slate-50 p-2"><div className="text-[11px] text-slate-500">{label}</div><b>{value}</b></div>; }
function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) { return <button type="button" onClick={onClick} className={`px-3 py-1.5 text-xs font-medium ${active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}>{children}</button>; }
function formatDate(value: string) { if (!value) return "-"; return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }
function displayValue(value: unknown) { if (value === null || value === undefined || value === "") return "Não informado"; if (typeof value === "boolean") return value ? "Sim" : "Não"; if (typeof value === "object") return JSON.stringify(value); return String(value); }
