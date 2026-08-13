import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Building2, CheckCircle2, FileCheck2, RefreshCw, RotateCw, Save, Send, Settings2, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const statusLabels: Record<string, string> = {
  pendente_integracao: "Pendente de integração",
  necessita_correcao: "Necessita correção",
  pronto_para_envio: "Pronto para envio",
  enviado: "Enviado",
  processando: "Processando",
  aceito: "Aceito",
  rejeitado: "Rejeitado",
};

const statusClasses: Record<string, string> = {
  aceito: "bg-emerald-100 text-emerald-800",
  pronto_para_envio: "bg-cyan-100 text-cyan-800",
  enviado: "bg-blue-100 text-blue-800",
  processando: "bg-amber-100 text-amber-800",
  necessita_correcao: "bg-orange-100 text-orange-800",
  rejeitado: "bg-red-100 text-red-800",
  pendente_integracao: "bg-slate-100 text-slate-700",
};

const integrationLabels: Record<string, string> = {
  not_configured: "Não configurada",
  configuration_pending: "Configuração pendente",
  ready_for_tests: "Pronta para testes",
  active: "Ativa",
  blocked: "Bloqueada",
};

function dateTime(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("pt-BR");
}

export default function ESocialCenter() {
  const context = (trpc.esocial as any).context.useQuery();
  const companies = (trpc.esocial as any).companies.useQuery(undefined, { enabled: !!context.data });
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [view, setView] = useState<"events" | "configuration">("events");
  const [status, setStatus] = useState("");
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  useEffect(() => {
    if (companyId || !companies.data?.length) return;
    const preferred = Number(context.data?.companyId || 0);
    const row = companies.data.find((item: any) => Number(item.id) === preferred) || companies.data[0];
    setCompanyId(Number(row.id));
  }, [companies.data, companyId, context.data?.companyId]);

  const configuration = (trpc.esocial as any).getConfiguration.useQuery(
    { companyId: companyId || undefined },
    { enabled: !!companyId },
  );
  const summary = (trpc.esocial as any).summary.useQuery(
    { companyId: companyId || undefined },
    { enabled: !!companyId },
  );
  const events = (trpc.esocial as any).events.useQuery(
    { companyId: companyId || undefined, status: status || undefined, limit: 250 },
    { enabled: !!companyId },
  );
  const details = (trpc.esocial as any).eventDetails.useQuery(
    { id: selectedEventId || 0, companyId: companyId || undefined },
    { enabled: !!selectedEventId && !!companyId },
  );

  const selectedCompany = useMemo(() => companies.data?.find((item: any) => Number(item.id) === companyId), [companies.data, companyId]);
  const [config, setConfig] = useState({ environment: "restricted", status: "not_configured", employerRegistrationType: "1", employerRegistrationNumber: "", certificateAlias: "", certificateValidUntil: "", proxyCompanyCnpj: "", notes: "" });

  useEffect(() => {
    const row = configuration.data;
    if (!row) return;
    setConfig({
      environment: row.environment || "restricted",
      status: row.status || "not_configured",
      employerRegistrationType: row.employer_registration_type || "1",
      employerRegistrationNumber: row.employer_registration_number || row.cnpj || "",
      certificateAlias: row.certificate_alias || "",
      certificateValidUntil: row.certificate_valid_until ? String(row.certificate_valid_until).slice(0, 10) : "",
      proxyCompanyCnpj: row.proxy_company_cnpj || "",
      notes: row.notes || "",
    });
  }, [configuration.data]);

  const refresh = () => { companies.refetch(); configuration.refetch(); summary.refetch(); events.refetch(); if (selectedEventId) details.refetch(); };
  const saveConfig = (trpc.esocial as any).saveConfiguration.useMutation({
    onSuccess: () => { toast.success("Configuração do eSocial salva."); refresh(); },
    onError: (error: any) => toast.error(error.message || "Não foi possível salvar."),
  });
  const validate = (trpc.esocial as any).validateEvent.useMutation({
    onSuccess: (result: any) => { toast[result.issues?.length ? "warning" : "success"](result.issues?.length ? `${result.issues.length} pendência(s) encontrada(s).` : "Evento validado e pronto para a futura transmissão."); refresh(); },
    onError: (error: any) => toast.error(error.message || "Falha na validação."),
  });
  const retry = (trpc.esocial as any).prepareRetry.useMutation({
    onSuccess: () => { toast.success("Evento devolvido para conferência e nova validação."); refresh(); },
    onError: (error: any) => toast.error(error.message || "Não foi possível preparar o reenvio."),
  });

  const cards = [
    ["Prontos", Number(summary.data?.ready_count || 0), "text-cyan-700"],
    ["Pendências", Number(summary.data?.pending_count || 0), "text-orange-700"],
    ["Em processamento", Number(summary.data?.processing_count || 0), "text-amber-700"],
    ["Aceitos", Number(summary.data?.accepted_count || 0), "text-emerald-700"],
    ["Rejeitados", Number(summary.data?.rejected_count || 0), "text-red-700"],
  ];

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-5">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary flex items-center gap-2"><FileCheck2 size={24} /> Central eSocial</h1>
            <p className="text-sm text-muted-foreground mt-1">Configuração, validação, recibos, críticas e histórico dos eventos ocupacionais.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {context.data?.global && (
              <select value={companyId || ""} onChange={event => { setCompanyId(Number(event.target.value)); setSelectedEventId(null); }} className="h-10 rounded-md border bg-white px-3 text-sm min-w-64" aria-label="Empresa">
                {(companies.data || []).map((company: any) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            )}
            <button onClick={refresh} className="h-10 w-10 inline-flex items-center justify-center rounded-md border bg-white hover:bg-slate-50" title="Atualizar"><RefreshCw size={17} /></button>
          </div>
        </header>

        <section className="border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <div className="font-semibold flex items-center gap-2"><AlertTriangle size={17} /> Camada oficial de transmissão ainda não habilitada</div>
          <p className="mt-1">A central já valida e organiza os eventos. O envio ao ambiente governamental só será liberado depois da configuração técnica, certificado e homologação no ambiente de produção restrita.</p>
        </section>

        <div className="flex gap-1 rounded-md border bg-white p-1 w-fit">
          <button onClick={() => setView("events")} className={`px-3 py-2 text-sm rounded ${view === "events" ? "bg-primary text-white" : "hover:bg-slate-50"}`}><span className="inline-flex items-center gap-2"><Send size={15} /> Eventos</span></button>
          <button onClick={() => setView("configuration")} className={`px-3 py-2 text-sm rounded ${view === "configuration" ? "bg-primary text-white" : "hover:bg-slate-50"}`}><span className="inline-flex items-center gap-2"><Settings2 size={15} /> Configuração</span></button>
        </div>

        {view === "events" ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {cards.map(([label, value, color]) => <div key={String(label)} className="border bg-white p-4"><div className="text-xs text-muted-foreground">{label}</div><div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div></div>)}
            </div>
            <section className="border bg-white">
              <div className="p-4 border-b flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div><h2 className="font-semibold">Eventos da empresa</h2><p className="text-xs text-muted-foreground">{selectedCompany?.name || configuration.data?.company_name || "Empresa"} · Layout S-1.3 NT 06/2026</p></div>
                <select value={status} onChange={event => setStatus(event.target.value)} className="h-9 rounded-md border px-3 text-sm bg-white" aria-label="Filtrar por status">
                  <option value="">Todos os status</option>
                  {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left"><tr><th className="p-3">Evento</th><th className="p-3">Colaborador</th><th className="p-3">Atualização</th><th className="p-3">Status</th><th className="p-3">Protocolo/recibo</th><th className="p-3 text-right">Ação</th></tr></thead>
                  <tbody>
                    {(events.data || []).map((row: any) => <tr key={row.id} className="border-t">
                      <td className="p-3"><div className="font-medium">{row.event_code}</div><div className="text-xs text-muted-foreground">{row.entity_type} #{row.entity_id}</div></td>
                      <td className="p-3"><div>{row.collaborator_name || "Não identificado"}</div><div className="text-xs text-muted-foreground">{row.collaborator_cpf || "CPF pendente"}</div></td>
                      <td className="p-3">{dateTime(row.updated_at)}</td>
                      <td className="p-3"><span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${statusClasses[row.status] || statusClasses.pendente_integracao}`}>{statusLabels[row.status] || row.status}</span>{row.issues?.length > 0 && <div className="text-xs text-red-700 mt-1">{row.issues.length} pendência(s)</div>}</td>
                      <td className="p-3"><div>{row.protocol || "—"}</div><div className="text-xs text-muted-foreground">{row.receipt || "Sem recibo"}</div></td>
                      <td className="p-3 text-right"><button onClick={() => setSelectedEventId(Number(row.id))} className="px-3 py-2 border rounded-md hover:bg-slate-50">Conferir</button></td>
                    </tr>)}
                    {!events.isLoading && !events.data?.length && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum evento encontrado para este filtro.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <section className="border bg-white p-5 space-y-5 max-w-5xl">
            <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold flex items-center gap-2"><Building2 size={17} /> Conexão da empresa</h2><p className="text-sm text-muted-foreground">{configuration.data?.company_name || selectedCompany?.name}</p></div><span className="text-xs font-semibold rounded-full bg-slate-100 px-3 py-1">{integrationLabels[config.status] || config.status}</span></div>
            <div className="grid md:grid-cols-2 gap-4">
              <label className="text-sm">Ambiente<select value={config.environment} disabled={!context.data?.global} onChange={event => setConfig({ ...config, environment: event.target.value })} className="mt-1 w-full h-10 border rounded-md px-3 bg-white"><option value="restricted">Produção restrita (testes)</option><option value="production">Produção</option></select></label>
              <label className="text-sm">Situação<select value={config.status} disabled={!context.data?.global} onChange={event => setConfig({ ...config, status: event.target.value })} className="mt-1 w-full h-10 border rounded-md px-3 bg-white"><option value="not_configured">Não configurada</option><option value="configuration_pending">Configuração pendente</option><option value="ready_for_tests">Pronta para testes</option><option value="active">Ativa</option><option value="blocked">Bloqueada</option></select></label>
              <label className="text-sm">Tipo de inscrição<select value={config.employerRegistrationType} disabled={!context.data?.global} onChange={event => setConfig({ ...config, employerRegistrationType: event.target.value })} className="mt-1 w-full h-10 border rounded-md px-3 bg-white"><option value="1">CNPJ</option><option value="2">CPF</option></select></label>
              <label className="text-sm">Número de inscrição<input value={config.employerRegistrationNumber} disabled={!context.data?.global} onChange={event => setConfig({ ...config, employerRegistrationNumber: event.target.value })} className="mt-1 w-full h-10 border rounded-md px-3" /></label>
              <label className="text-sm">Identificação do certificado<input value={config.certificateAlias} disabled={!context.data?.global} onChange={event => setConfig({ ...config, certificateAlias: event.target.value })} placeholder="Alias seguro, sem armazenar a chave no formulário" className="mt-1 w-full h-10 border rounded-md px-3" /></label>
              <label className="text-sm">Validade do certificado<input type="date" value={config.certificateValidUntil} disabled={!context.data?.global} onChange={event => setConfig({ ...config, certificateValidUntil: event.target.value })} className="mt-1 w-full h-10 border rounded-md px-3" /></label>
              <label className="text-sm md:col-span-2">CNPJ do procurador, quando aplicável<input value={config.proxyCompanyCnpj} disabled={!context.data?.global} onChange={event => setConfig({ ...config, proxyCompanyCnpj: event.target.value })} className="mt-1 w-full h-10 border rounded-md px-3" /></label>
              <label className="text-sm md:col-span-2">Observações<textarea value={config.notes} disabled={!context.data?.global} onChange={event => setConfig({ ...config, notes: event.target.value })} rows={4} className="mt-1 w-full border rounded-md p-3" /></label>
            </div>
            {context.data?.global ? <div className="flex justify-end"><button disabled={!companyId || saveConfig.isPending} onClick={() => companyId && saveConfig.mutate({ companyId, ...config, employerRegistrationType: config.employerRegistrationType || undefined, employerRegistrationNumber: config.employerRegistrationNumber || undefined, certificateAlias: config.certificateAlias || undefined, certificateValidUntil: config.certificateValidUntil || undefined, proxyCompanyCnpj: config.proxyCompanyCnpj || undefined, notes: config.notes || undefined })} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-white disabled:opacity-50"><Save size={16} /> Salvar configuração</button></div> : <p className="text-sm text-muted-foreground">A configuração técnica é mantida pelo SuperAdmin Global. O SESMT possui visão de acompanhamento e das críticas dos eventos.</p>}
          </section>
        )}

        {selectedEventId && details.data && (
          <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={() => setSelectedEventId(null)}>
            <aside className="h-full w-full max-w-2xl bg-white overflow-y-auto p-5 space-y-5" onClick={event => event.stopPropagation()}>
              <div className="flex items-start justify-between"><div><div className="text-xs text-muted-foreground">Evento #{details.data.id}</div><h2 className="text-xl font-bold">{details.data.event_code} · {details.data.collaborator_name || "Colaborador não identificado"}</h2></div><button onClick={() => setSelectedEventId(null)} className="px-3 py-2 border rounded-md">Fechar</button></div>
              <div className="grid grid-cols-2 gap-3 text-sm"><div><b>Status</b><br />{statusLabels[details.data.status] || details.data.status}</div><div><b>Layout</b><br />{details.data.layout_version}</div><div><b>Protocolo</b><br />{details.data.protocol || "Não emitido"}</div><div><b>Recibo</b><br />{details.data.receipt || "Não emitido"}</div></div>
              <section><h3 className="font-semibold flex items-center gap-2"><ShieldAlert size={17} /> Conferência cadastral</h3><div className="mt-2 space-y-2">{details.data.issues?.length ? details.data.issues.map((issue: any, index: number) => <div key={index} className="border-l-4 border-orange-500 bg-orange-50 p-3 text-sm"><b>{issue.field}</b><div>{issue.message}</div><div className="text-orange-900 mt-1">Onde corrigir: {issue.action}</div></div>) : <div className="bg-emerald-50 text-emerald-900 p-3 text-sm flex items-center gap-2"><CheckCircle2 size={17} /> Nenhuma pendência cadastral conhecida.</div>}</div></section>
              <div className="flex flex-wrap gap-2"><button disabled={validate.isPending} onClick={() => validate.mutate({ id: selectedEventId })} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-white"><FileCheck2 size={16} /> Validar novamente</button>{["rejeitado", "necessita_correcao"].includes(details.data.status) && <button disabled={retry.isPending} onClick={() => { const note = window.prompt("Descreva a correção realizada antes da nova validação:"); if (note) retry.mutate({ id: selectedEventId, note }); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-md border"><RotateCw size={16} /> Preparar nova tentativa</button>}</div>
              <section><h3 className="font-semibold">Histórico</h3><div className="mt-2 divide-y border">{(details.data.history || []).map((item: any) => <div key={item.id} className="p-3 text-sm"><div className="font-medium">{statusLabels[item.previous_status] || item.previous_status || "Criação"} → {statusLabels[item.new_status] || item.new_status}</div><div>{item.detail}</div><div className="text-xs text-muted-foreground mt-1">{dateTime(item.created_at)} · {item.user_name || "Sistema"}</div></div>)}{!details.data.history?.length && <div className="p-4 text-sm text-muted-foreground">Ainda não há movimentações registradas.</div>}</div></section>
            </aside>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
