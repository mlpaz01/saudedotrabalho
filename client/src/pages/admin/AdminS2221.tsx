import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Archive, CheckCircle2, FlaskConical, Plus, RefreshCw, Search, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Filter = "all" | "up_to_date" | "pending" | "awaiting_result" | "pending_send" | "sent" | "rejected";

const emptyForm = {
  id: undefined as number | undefined,
  collaboratorId: 0,
  examType: "periodic",
  examDate: "",
  admissionDate: "",
  laboratoryName: "",
  laboratoryCnpj: "",
  examCode: "",
  resultStatus: "pending",
  doctorName: "",
  doctorCrm: "",
  doctorUf: "",
  notes: "",
};

const transmissionLabels: Record<string, string> = {
  pendente_integracao: "Pendente de integração",
  necessita_correcao: "Necessita correção",
  pronto_para_envio: "Pronto para envio",
  enviado: "Enviado",
  processando: "Processando",
  aceito: "Aceito",
  rejeitado: "Rejeitado",
};

const resultLabels: Record<string, string> = {
  pending: "Aguardando resultado",
  negative: "Resultado negativo",
  positive: "Resultado positivo",
  inconclusive: "Inconclusivo",
};

function asDate(value: unknown) {
  if (!value) return "—";
  const raw = String(value).slice(0, 10);
  const [year, month, day] = raw.split("-");
  return year && month && day ? `${day}/${month}/${year}` : raw;
}

export default function AdminS2221() {
  const context = (trpc.esocial as any).context.useQuery();
  const companies = (trpc.esocial as any).companies.useQuery(undefined, { enabled: !!context.data?.global });
  const [companyId, setCompanyId] = useState<number | undefined>(undefined);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!context.data?.global) return;
    if (companyId || !companies.data?.length) return;
    setCompanyId(Number(companies.data[0].id));
  }, [companies.data, companyId, context.data?.global]);

  const queryCompanyId = context.data?.global ? companyId : undefined;
  const enabled = !context.data?.global || !!companyId;
  const summary = (trpc.esocial as any).s2221Summary.useQuery({ companyId: queryCompanyId }, { enabled });
  const records = (trpc.esocial as any).s2221List.useQuery({ companyId: queryCompanyId, status: filter, search }, { enabled });
  const employees = (trpc.esocial as any).s2221Employees.useQuery({ companyId: queryCompanyId, search: employeeSearch }, { enabled: enabled && formOpen });

  const refresh = () => { summary.refetch(); records.refetch(); employees.refetch(); };
  const save = (trpc.esocial as any).saveS2221.useMutation({
    onSuccess: (result: any) => {
      if (result.issues?.length) toast.warning(`Registro salvo com ${result.issues.length} pendência(s) para o eSocial.`);
      else toast.success("Exame S-2221 salvo e validado.");
      setFormOpen(false);
      setForm(emptyForm);
      refresh();
    },
    onError: (error: any) => toast.error(error.message || "Não foi possível salvar o exame."),
  });
  const archive = (trpc.esocial as any).archiveS2221.useMutation({
    onSuccess: () => { toast.success("Registro arquivado com rastreabilidade."); refresh(); },
    onError: (error: any) => toast.error(error.message || "Não foi possível arquivar."),
  });

  const cards = useMemo(() => [
    { key: "all" as Filter, label: "Motoristas profissionais", value: summary.data?.total_drivers || 0, tone: "text-slate-900" },
    { key: "up_to_date" as Filter, label: "Exames em dia", value: summary.data?.up_to_date || 0, tone: "text-emerald-700" },
    { key: "pending" as Filter, label: "Pendentes", value: summary.data?.pending || 0, tone: "text-orange-700" },
    { key: "awaiting_result" as Filter, label: "Aguardando resultado", value: summary.data?.awaiting_result || 0, tone: "text-amber-700" },
    { key: "pending_send" as Filter, label: "Pendentes de envio", value: summary.data?.pending_send || 0, tone: "text-cyan-700" },
    { key: "sent" as Filter, label: "Enviados", value: summary.data?.sent || 0, tone: "text-blue-700" },
    { key: "rejected" as Filter, label: "Erros/rejeições", value: summary.data?.rejected || 0, tone: "text-red-700" },
  ], [summary.data]);

  const openEdit = (row: any) => {
    setForm({
      id: row.id ? Number(row.id) : undefined, collaboratorId: Number(row.collaborator_id), examType: row.exam_type || "periodic",
      examDate: String(row.exam_date || "").slice(0, 10), admissionDate: String(row.admission_date || "").slice(0, 10),
      laboratoryName: row.laboratory_name || "", laboratoryCnpj: row.laboratory_cnpj || "", examCode: row.exam_code || "",
      resultStatus: row.result_status || "pending", doctorName: row.doctor_name || "", doctorCrm: row.doctor_crm || "",
      doctorUf: row.doctor_uf || "", notes: row.notes || "",
    });
    setEmployeeSearch(row.collaborator_name || "");
    setFormOpen(true);
  };

  const submit = () => {
    save.mutate({
      ...form,
      companyId: queryCompanyId,
      examType: form.examType as "pre_admission" | "periodic" | "dismissal" | "other",
      resultStatus: form.resultStatus as "pending" | "negative" | "positive" | "inconclusive",
      admissionDate: form.admissionDate || null,
      notes: form.notes || undefined,
      examCode: form.examCode.trim().toUpperCase(),
      doctorUf: form.doctorUf.trim().toUpperCase(),
    });
  };

  return <AppLayout>
    <div className="p-4 md:p-6 space-y-5">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2"><Truck size={24} /> S-2221 · Exame Toxicológico</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão do exame do motorista profissional empregado, conferência e acompanhamento do evento no eSocial.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {context.data?.global && <select value={companyId || ""} onChange={event => setCompanyId(Number(event.target.value))} className="h-10 min-w-64 rounded-md border bg-white px-3 text-sm"><option value="">Selecione a empresa</option>{(companies.data || []).map((company: any) => <option key={company.id} value={company.id}>{company.name}</option>)}</select>}
          <button onClick={refresh} className="h-10 w-10 inline-flex items-center justify-center rounded-md border bg-white" title="Atualizar"><RefreshCw size={17} /></button>
          <button onClick={() => { setForm(emptyForm); setEmployeeSearch(""); setFormOpen(true); }} className="h-10 inline-flex items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-white"><Plus size={17} /> Novo exame</button>
        </div>
      </header>

      <section className="border-l-4 border-cyan-600 bg-cyan-50 px-4 py-3 text-sm text-cyan-950">
        <b>Leiaute S-1.3 NT 06/2026.</b> O código oficial contém duas letras e nove números. O resultado clínico é controlado internamente com acesso restrito e não compõe o payload atual do S-2221.
      </section>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        {cards.map(card => <button key={card.key} onClick={() => setFilter(card.key)} className={`border bg-white p-4 text-left min-h-24 ${filter === card.key ? "ring-2 ring-primary" : "hover:bg-slate-50"}`}><div className="text-xs text-muted-foreground">{card.label}</div><div className={`text-2xl font-bold mt-2 ${card.tone}`}>{card.value}</div></button>)}
      </div>

      <section className="border bg-white">
        <div className="p-4 border-b flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div><h2 className="font-semibold">Exames e eventos relacionados</h2><p className="text-xs text-muted-foreground">Clique nos indicadores para filtrar a relação.</p></div>
          <label className="relative"><Search size={16} className="absolute left-3 top-2.5 text-muted-foreground"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Funcionário, CPF ou código" className="h-9 w-full md:w-72 rounded-md border pl-9 pr-3 text-sm" /></label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left"><tr><th className="p-3">Funcionário</th><th className="p-3">Exame</th><th className="p-3">Resultado</th><th className="p-3">Próximo controle</th><th className="p-3">eSocial</th><th className="p-3 text-right">Ações</th></tr></thead>
            <tbody>
              {(records.data || []).map((row: any) => <tr key={`${row.id || "pending"}-${row.collaborator_id}`} className="border-t">
                <td className="p-3"><div className="font-medium">{row.collaborator_name}</div><div className="text-xs text-muted-foreground">{row.cpf || "CPF pendente"} · {row.employee_registration || "Matrícula pendente"}</div><div className="text-xs text-muted-foreground">{row.branch_name || "Sem filial"} / {row.sector_name || "Sem setor"}</div></td>
                <td className="p-3"><div>{row.exam_code || "Sem exame vigente"}</div><div className="text-xs text-muted-foreground">{row.exam_date ? `${asDate(row.exam_date)} · ${row.laboratory_name || "Laboratório pendente"}` : "Cadastro necessário"}</div></td>
                <td className="p-3">{resultLabels[row.result_status] || row.result_status}</td>
                <td className="p-3">{asDate(row.next_due_date)}{Number(row.days_to_due) < 0 && <div className="text-xs text-red-700">Vencido</div>}</td>
                <td className="p-3"><span className={`inline-flex items-center gap-1 text-xs font-semibold ${row.transmission_status === "aceito" ? "text-emerald-700" : row.transmission_status === "rejeitado" ? "text-red-700" : "text-slate-700"}`}>{row.transmission_status === "aceito" ? <CheckCircle2 size={14}/> : row.transmission_status === "rejeitado" ? <AlertTriangle size={14}/> : null}{transmissionLabels[row.transmission_status] || "Pendente"}</span>{row.due_date && <div className="text-xs text-muted-foreground mt-1">Prazo: {asDate(row.due_date)}</div>}{row.last_attempt_at && <div className="text-xs text-muted-foreground">Última tentativa: {new Date(row.last_attempt_at).toLocaleString("pt-BR")}</div>}{row.protocol && <div className="text-xs text-muted-foreground">Protocolo: {row.protocol}</div>}{row.receipt && <div className="text-xs text-muted-foreground">Recibo: {row.receipt}</div>}{row.error_message && <div className="text-xs text-red-700 mt-1 max-w-72">{row.error_message}</div>}</td>
                <td className="p-3 text-right whitespace-nowrap"><button onClick={() => openEdit(row)} className="px-3 py-2 rounded-md border hover:bg-slate-50">{row.id ? "Editar" : "Cadastrar exame"}</button>{row.id ? <button onClick={() => { const reason = window.prompt("Motivo do arquivamento:"); if (reason) archive.mutate({ id: Number(row.id), companyId: queryCompanyId, reason }); }} className="ml-2 h-9 w-9 inline-flex items-center justify-center rounded-md border text-slate-600" title="Arquivar"><Archive size={15}/></button> : null}</td>
              </tr>)}
              {!records.isLoading && !records.data?.length && <tr><td colSpan={6} className="p-10 text-center text-muted-foreground"><FlaskConical size={28} className="mx-auto mb-2"/>Nenhum exame encontrado neste filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {formOpen && <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={() => setFormOpen(false)}>
        <aside className="h-full w-full max-w-2xl overflow-y-auto bg-white p-5" onClick={event => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-3"><div><div className="text-xs text-muted-foreground">Evento ocupacional</div><h2 className="text-xl font-bold">{form.id ? "Editar" : "Novo"} exame S-2221</h2></div><button onClick={() => setFormOpen(false)} className="px-3 py-2 rounded-md border">Fechar</button></div>
          <div className="mt-5 grid md:grid-cols-2 gap-4">
            <label className="text-sm md:col-span-2">Pesquisar funcionário<input value={employeeSearch} onChange={event => setEmployeeSearch(event.target.value)} placeholder="Nome, CPF ou matrícula" className="mt-1 h-10 w-full rounded-md border px-3" /></label>
            <label className="text-sm md:col-span-2">Funcionário<select value={form.collaboratorId || ""} onChange={event => setForm({ ...form, collaboratorId: Number(event.target.value) })} className="mt-1 h-10 w-full rounded-md border bg-white px-3"><option value="">Selecione</option>{(employees.data || []).map((employee: any) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.cpf || "CPF pendente"} · {employee.position || "Sem cargo"}</option>)}</select></label>
            <label className="text-sm">Tipo<select value={form.examType} onChange={event => setForm({ ...form, examType: event.target.value })} className="mt-1 h-10 w-full rounded-md border bg-white px-3"><option value="pre_admission">Pré-admissional</option><option value="periodic">Periódico</option><option value="dismissal">Demissional</option><option value="other">Outro</option></select></label>
            <label className="text-sm">Data da realização/coleta<input type="date" value={form.examDate} onChange={event => setForm({ ...form, examDate: event.target.value })} className="mt-1 h-10 w-full rounded-md border px-3" /></label>
            {form.examType === "pre_admission" && <label className="text-sm">Data de admissão<input type="date" value={form.admissionDate} onChange={event => setForm({ ...form, admissionDate: event.target.value })} className="mt-1 h-10 w-full rounded-md border px-3" /></label>}
            <label className="text-sm">Código do exame<input value={form.examCode} maxLength={11} onChange={event => setForm({ ...form, examCode: event.target.value.toUpperCase() })} placeholder="AA999999999" className="mt-1 h-10 w-full rounded-md border px-3 font-mono"/><span className="text-xs text-muted-foreground">2 letras + 9 números</span></label>
            <label className="text-sm">Laboratório<input value={form.laboratoryName} onChange={event => setForm({ ...form, laboratoryName: event.target.value })} className="mt-1 h-10 w-full rounded-md border px-3" /></label>
            <label className="text-sm">CNPJ do laboratório<input value={form.laboratoryCnpj} onChange={event => setForm({ ...form, laboratoryCnpj: event.target.value })} className="mt-1 h-10 w-full rounded-md border px-3" /></label>
            <label className="text-sm">Resultado interno<select value={form.resultStatus} onChange={event => setForm({ ...form, resultStatus: event.target.value })} className="mt-1 h-10 w-full rounded-md border bg-white px-3"><option value="pending">Aguardando resultado</option><option value="negative">Negativo</option><option value="positive">Positivo</option><option value="inconclusive">Inconclusivo</option></select></label>
            <label className="text-sm">Médico responsável<input value={form.doctorName} onChange={event => setForm({ ...form, doctorName: event.target.value })} className="mt-1 h-10 w-full rounded-md border px-3" /></label>
            <label className="text-sm">CRM<input value={form.doctorCrm} onChange={event => setForm({ ...form, doctorCrm: event.target.value })} className="mt-1 h-10 w-full rounded-md border px-3" /></label>
            <label className="text-sm">UF do CRM<input value={form.doctorUf} maxLength={2} onChange={event => setForm({ ...form, doctorUf: event.target.value.toUpperCase() })} className="mt-1 h-10 w-full rounded-md border px-3 uppercase" /></label>
            <label className="text-sm md:col-span-2">Observações internas<textarea value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} rows={4} className="mt-1 w-full rounded-md border p-3" /></label>
          </div>
          <div className="mt-5 border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-950"><b>Confidencialidade:</b> o resultado fica no controle ocupacional interno. O payload oficial contém os dados de identificação do exame e do médico, sem o resultado clínico.</div>
          <div className="mt-5 flex justify-end gap-2"><button onClick={() => setFormOpen(false)} className="px-4 py-2 rounded-md border">Cancelar</button><button disabled={save.isPending || !form.collaboratorId || !form.examDate} onClick={submit} className="px-4 py-2 rounded-md bg-primary text-white disabled:opacity-50">Salvar e validar</button></div>
        </aside>
      </div>}
    </div>
  </AppLayout>;
}
