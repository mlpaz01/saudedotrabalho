import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Archive, Award, BellRing, CheckCircle2, Clock3, Download, GraduationCap, LockKeyhole, Pencil, Plus, RefreshCw, Send, Users } from "lucide-react";
import { toast } from "sonner";

type Audience = { allEmployees?: boolean; branchIds?: number[]; sectorIds?: number[]; positions?: string[]; gseIds?: number[]; userIds?: number[] };

const statusLabel: Record<string, string> = {
  pendente: "Pendente", em_andamento: "Em andamento", concluido: "Concluido", vencido: "Vencido",
  rascunho: "Rascunho", ativo: "Ativo", arquivado: "Arquivado",
};

const emptyForm = () => ({
  id: 0, moduleId: 0, name: "", description: "", workloadMinutes: 0, validityMonths: 12,
  recurrenceMonths: 12, startDate: new Date().toISOString().slice(0, 10), dueDate: "",
  isMandatory: true, certificateRequired: true, status: "ativo" as const,
  audience: { allEmployees: true, branchIds: [], sectorIds: [], positions: [], gseIds: [], userIds: [] } as Audience,
});

function dateValue(value: any) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toISOString().slice(0, 10);
}

function fmtDate(value: any) {
  const iso = dateValue(value);
  return iso ? iso.split("-").reverse().join("/") : "-";
}

function exportCsv(rows: any[]) {
  const fields = ["Funcionario", "CPF/Matricula", "Filial", "Setor", "Cargo", "Treinamento", "Prazo", "Situacao", "Conclusao", "Validade"];
  const data = rows.map(row => [row.user_name, row.cpf || row.employee_registration, row.branch_name, row.sector_name, row.position,
    row.program_name, dateValue(row.due_date), statusLabel[row.status] || row.status, dateValue(row.completed_at), dateValue(row.valid_until)]);
  const csv = [fields, ...data].map(line => line.map(value => `"${String(value || "").replaceAll('"', '""')}"`).join(";")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob); link.download = `treinamentos-obrigatorios-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
  URL.revokeObjectURL(link.href);
}

export default function MandatoryTraining() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isGlobal = ["admin_global", "super_admin"].includes(String(user?.role || ""));
  const [selectedCompanyId, setSelectedCompanyId] = useState(0);
  const companyInput = selectedCompanyId ? { companyId: selectedCompanyId } : undefined;
  const accessQ = trpc.mandatoryTraining.moduleAccess.useQuery(companyInput);
  const access = accessQ.data;
  const canManage = Boolean(access?.canManage);
  const canViewTeam = Boolean(access?.canViewTeam);
  const [tab, setTab] = useState(canViewTeam ? "painel" : "meus");
  const defaultTabSet = useRef(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!access || defaultTabSet.current) return;
    setTab(access.canViewTeam ? "painel" : "meus");
    defaultTabSet.current = true;
  }, [access]);

  const programsQ = trpc.mandatoryTraining.listPrograms.useQuery(companyInput, { enabled: Boolean(access?.enabled && canViewTeam) });
  const teamQ = trpc.mandatoryTraining.teamAssignments.useQuery(companyInput, { enabled: Boolean(access?.enabled && canViewTeam) });
  const mineQ = trpc.mandatoryTraining.myAssignments.useQuery(undefined, { enabled: Boolean(access?.enabled && !isGlobal) });
  const optionsQ = trpc.mandatoryTraining.setupOptions.useQuery(companyInput, { enabled: Boolean(access?.enabled && canManage) });
  const refresh = () => { programsQ.refetch(); teamQ.refetch(); mineQ.refetch(); };

  const toggle = trpc.mandatoryTraining.setEnabled.useMutation({
    onSuccess: () => { accessQ.refetch(); toast.success("Modulo habilitado para a empresa."); }, onError: error => toast.error(error.message),
  });
  const save = trpc.mandatoryTraining.upsertProgram.useMutation({
    onSuccess: result => { setShowForm(false); setForm(emptyForm()); refresh(); toast.success(`Treinamento salvo para ${result.assignments} colaborador(es).`); },
    onError: error => toast.error(error.message),
  });
  const archive = trpc.mandatoryTraining.archiveProgram.useMutation({
    onSuccess: () => { refresh(); toast.success("Treinamento arquivado com historico preservado."); }, onError: error => toast.error(error.message),
  });
  const reminders = trpc.mandatoryTraining.sendReminders.useMutation({
    onSuccess: result => toast.success(`${result.internal + result.email + result.whatsapp} comunicacao(oes) processada(s).`),
    onError: error => toast.error(error.message),
  });
  const startAssignment = trpc.mandatoryTraining.startAssignment.useMutation({
    onSuccess: result => navigate(`/cursos/${result.moduleId}`),
    onError: error => toast.error(error.message),
  });

  const programs = (programsQ.data || []) as any[];
  const team = (teamQ.data || []) as any[];
  const mine = (mineQ.data || []) as any[];
  const filteredTeam = useMemo(() => team.filter(row => `${row.user_name} ${row.program_name} ${row.branch_name} ${row.sector_name}`.toLowerCase().includes(search.toLowerCase())), [team, search]);
  const totals = { total: team.length, completed: team.filter(row => row.status === "concluido").length,
    pending: team.filter(row => ["pendente", "em_andamento"].includes(row.status)).length,
    overdue: team.filter(row => row.status === "vencido").length };

  function openEdit(row?: any) {
    if (!row) { setForm(emptyForm()); setShowForm(true); return; }
    setForm({ id: Number(row.id), moduleId: Number(row.module_id), name: String(row.name || ""), description: String(row.description || ""),
      workloadMinutes: Number(row.workload_minutes || 0), validityMonths: Number(row.validity_months || 0), recurrenceMonths: Number(row.recurrence_months || 0),
      startDate: dateValue(row.start_date), dueDate: dateValue(row.due_date), isMandatory: Boolean(Number(row.is_mandatory)),
      certificateRequired: Boolean(Number(row.certificate_required)), status: row.status || "ativo", audience: row.audience || { allEmployees: true } });
    setShowForm(true);
  }

  function submit() {
    if (!form.moduleId || !form.name.trim() || !form.dueDate) { toast.error("Selecione o curso e informe nome e prazo."); return; }
    save.mutate({ companyId: selectedCompanyId || undefined, id: form.id || undefined, moduleId: form.moduleId, name: form.name.trim(), description: form.description || undefined,
      workloadMinutes: Number(form.workloadMinutes || 0), validityMonths: form.validityMonths || null, recurrenceMonths: form.recurrenceMonths || null,
      startDate: form.startDate || null, dueDate: form.dueDate, isMandatory: form.isMandatory, certificateRequired: form.certificateRequired,
      audience: form.audience, status: form.status });
  }

  if (accessQ.isLoading) return <AppLayout><div className="p-10 text-sm text-slate-500">Carregando centro de treinamentos...</div></AppLayout>;
  if (access?.companySelectionRequired) {
    return <AppLayout><div className="mx-auto max-w-3xl p-6"><div className="border bg-white p-8"><GraduationCap className="text-teal-700" size={34}/><h1 className="mt-4 text-xl font-bold">Treinamentos Obrigatorios</h1>
      <p className="mt-2 text-sm text-slate-500">Selecione a empresa que deseja configurar e acompanhar.</p>
      <select className="mt-5 w-full border bg-white px-3 py-2 text-sm" value={selectedCompanyId} onChange={event => setSelectedCompanyId(Number(event.target.value))}>
        <option value={0}>Selecione uma empresa</option>{(access.companies || []).map((company: any) => <option key={company.id} value={company.id}>{company.name}{company.cnpj ? ` · ${company.cnpj}` : ""}</option>)}
      </select>
    </div></div></AppLayout>;
  }
  if (!access?.enabled) {
    const canEnable = ["super_admin", "admin_global", "company_admin"].includes(String(user?.role || ""));
    return <AppLayout><div className="mx-auto max-w-3xl p-6"><div className="border bg-white p-8 text-center">
      <LockKeyhole className="mx-auto text-slate-400" size={38} /><h1 className="mt-4 text-xl font-bold">Treinamentos Obrigatorios</h1>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">Centro corporativo para cursos obrigatorios, certificados, reciclagens, prazos e acompanhamento por equipe.</p>
      {canEnable ? <Button className="mt-5" disabled={toggle.isPending} onClick={() => toggle.mutate({ companyId: selectedCompanyId || undefined, enabled: true })}>Habilitar para esta empresa</Button> :
        <Badge className="mt-5 rounded-sm bg-slate-100 text-slate-700">Modulo adicional nao habilitado</Badge>}
    </div></div></AppLayout>;
  }

  const tabs = canViewTeam ? [["painel", "Painel"], ["programas", "Treinamentos"], ["equipe", "Equipe"], ...(!isGlobal ? [["meus", "Meus treinamentos"]] : [])] : [["meus", "Meus treinamentos"]];
  return <AppLayout><div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase text-teal-700"><GraduationCap size={15}/> Centro corporativo</div>
      <h1 className="mt-1 text-2xl font-bold">Treinamentos Obrigatorios</h1><p className="mt-1 text-sm text-slate-500">Obrigatoriedade, prazo, certificado, validade e reciclagem em um unico fluxo.</p></div>
      <div className="flex flex-wrap gap-2">{isGlobal ? <select className="border bg-white px-3 py-2 text-sm" value={selectedCompanyId} onChange={event => setSelectedCompanyId(Number(event.target.value))}>{(access.companies || []).map((company: any) => <option key={company.id} value={company.id}>{company.name}</option>)}</select> : null}<Button variant="outline" size="icon" title="Atualizar" onClick={refresh}><RefreshCw size={16}/></Button>{canManage ? <Button onClick={() => openEdit()}><Plus size={16} className="mr-1"/> Novo treinamento</Button> : null}</div></header>

    <div className="flex gap-1 overflow-x-auto border-b">{tabs.map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${tab === key ? "border-teal-700 text-teal-800" : "border-transparent text-slate-500"}`}>{label}</button>)}</div>

    {tab === "painel" ? <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Obrigatorios" value={totals.total} icon={<GraduationCap size={17}/>}/><Metric label="Concluidos" value={totals.completed} icon={<CheckCircle2 size={17}/>} tone="green"/><Metric label="Pendentes" value={totals.pending} icon={<Clock3 size={17}/>} tone="amber"/><Metric label="Vencidos" value={totals.overdue} icon={<AlertTriangle size={17}/>} tone="red"/></div>
      <div className="border bg-white p-4"><h2 className="font-semibold">Proximos passos</h2><div className="mt-3 grid gap-2 md:grid-cols-3"><Action title="Configurar publico" text="Filial, setor, cargo, GSE ou colaboradores especificos."/><Action title="Acompanhar conclusao" text="Progresso e certificados sincronizados com os cursos do Studio."/><Action title="Cobrar pendencias" text="Alertas internos, e-mail e WhatsApp com historico de envio."/></div></div></> : null}

    {tab === "programas" ? <section className="border bg-white"><div className="flex items-center justify-between border-b p-4"><div><h2 className="font-semibold">Programas ativos</h2><p className="text-xs text-slate-500">O curso nasce no Studio e recebe aqui as regras corporativas.</p></div><Button variant="outline" disabled={reminders.isPending} onClick={() => reminders.mutate({ companyId: selectedCompanyId || undefined, channels: ["interno", "email"] })}><BellRing size={15} className="mr-1"/> Enviar lembretes</Button></div>
      <div className="divide-y">{programs.map(row => <article key={row.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center"><div><div className="flex flex-wrap items-center gap-2"><b>{row.name}</b><Badge variant="outline">{statusLabel[row.status] || row.status}</Badge></div><p className="mt-1 text-xs text-slate-500">Curso: {row.module_title} · Prazo {fmtDate(row.due_date)} · {row.validity_months || 0} meses de validade</p><div className="mt-3 flex flex-wrap gap-2 text-xs"><Badge className="rounded-sm bg-slate-100 text-slate-700">{row.assigned_count || 0} atribuidos</Badge><Badge className="rounded-sm bg-emerald-100 text-emerald-800">{row.completed_count || 0} concluidos</Badge><Badge className="rounded-sm bg-amber-100 text-amber-800">{row.pending_count || 0} pendentes</Badge><Badge className="rounded-sm bg-rose-100 text-rose-800">{row.overdue_count || 0} vencidos</Badge></div></div>
        {canManage ? <div className="flex gap-1"><Button size="icon" variant="ghost" title="Editar" onClick={() => openEdit(row)}><Pencil size={15}/></Button><Button size="icon" variant="ghost" title="Enviar lembrete" onClick={() => reminders.mutate({ companyId: selectedCompanyId || undefined, programId: Number(row.id), channels: ["interno", "email"] })}><Send size={15}/></Button><Button size="icon" variant="ghost" title="Arquivar" onClick={() => { if (confirm("Arquivar este treinamento mantendo todo o historico?")) archive.mutate({ id: Number(row.id), companyId: selectedCompanyId || undefined }); }}><Archive size={15}/></Button></div> : null}</article>)}{!programs.length ? <Empty text="Nenhum treinamento configurado."/> : null}</div></section> : null}

    {tab === "equipe" ? <section className="border bg-white"><div className="flex flex-wrap items-center justify-between gap-2 border-b p-4"><Input className="max-w-sm" placeholder="Buscar colaborador, curso, filial ou setor" value={search} onChange={event => setSearch(event.target.value)}/><Button variant="outline" onClick={() => exportCsv(filteredTeam)}><Download size={15} className="mr-1"/> Exportar CSV</Button></div><div className="overflow-x-auto"><table className="w-full min-w-[940px] text-sm"><thead className="bg-slate-50 text-xs"><tr><Th>Colaborador</Th><Th>Filial / setor</Th><Th>Treinamento</Th><Th>Prazo</Th><Th>Situacao</Th><Th>Certificado</Th></tr></thead><tbody>{filteredTeam.map(row => <tr className="border-t" key={row.id}><Td><b>{row.user_name}</b><div className="text-xs text-slate-500">{row.position || row.cpf || row.employee_registration || "-"}</div></Td><Td>{row.branch_name || "-"}<div className="text-xs text-slate-500">{row.sector_name || "-"}</div></Td><Td>{row.program_name}</Td><Td>{fmtDate(row.due_date)}</Td><Td><Status value={row.status}/></Td><Td>{row.certificate_url ? <a className="text-teal-700 underline" href={row.certificate_url} target="_blank">Visualizar</a> : "-"}</Td></tr>)}</tbody></table>{!filteredTeam.length ? <Empty text="Nenhum colaborador encontrado."/> : null}</div></section> : null}

    {tab === "meus" ? <section className="grid gap-3 md:grid-cols-2">{mine.map(row => <article className="border bg-white p-4" key={row.id}><div className="flex items-start justify-between gap-3"><div><Status value={row.status}/><h2 className="mt-2 font-semibold">{row.name}</h2><p className="mt-1 text-xs text-slate-500">Ciclo {row.cycle_number || 1} · prazo {fmtDate(row.due_date)} · {Math.round(Number(row.workload_minutes || 0) / 60)}h · validade {row.validity_months || 0} meses</p></div><GraduationCap className="text-teal-700" size={22}/></div><p className="mt-3 text-sm text-slate-600">{row.description || "Treinamento corporativo obrigatorio."}</p><div className="mt-4 flex flex-wrap gap-2">{row.status === "concluido" ? <Link href={`/cursos/${row.module_id}`}><Button>Revisar curso</Button></Link> : <Button disabled={startAssignment.isPending} onClick={() => startAssignment.mutate({ assignmentId: Number(row.id) })}>{Number(row.cycle_number || 1) > 1 ? "Iniciar reciclagem" : "Acessar curso"}</Button>}{row.certificate_url ? <a href={row.certificate_url} target="_blank"><Button variant="outline"><Award size={15} className="mr-1"/> Certificado</Button></a> : null}</div></article>)}{!mine.length ? <div className="md:col-span-2"><Empty text="Voce nao possui treinamento obrigatorio pendente."/></div> : null}</section> : null}

    <Dialog open={showForm} onOpenChange={setShowForm}><DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{form.id ? "Editar treinamento" : "Novo treinamento obrigatorio"}</DialogTitle></DialogHeader>
      <div className="grid gap-4 md:grid-cols-2"><Field label="Curso do Studio"><select className="w-full border bg-white px-3 py-2 text-sm" value={form.moduleId} onChange={event => { const id = Number(event.target.value); const course = (optionsQ.data?.courses || []).find((item: any) => Number(item.id) === id); setForm(old => ({ ...old, moduleId: id, name: old.name || course?.title || "", workloadMinutes: old.workloadMinutes || Number(course?.durationMinutes || 0) })); }}><option value={0}>Selecione</option>{(optionsQ.data?.courses || []).map((course: any) => <option value={course.id} key={course.id}>{course.title}</option>)}</select></Field><Field label="Nome"><Input value={form.name} onChange={e => setForm(old => ({ ...old, name: e.target.value }))}/></Field>
        <Field label="Data de inicio"><Input type="date" value={form.startDate} onChange={e => setForm(old => ({ ...old, startDate: e.target.value }))}/></Field><Field label="Prazo para conclusao"><Input type="date" value={form.dueDate} onChange={e => setForm(old => ({ ...old, dueDate: e.target.value }))}/></Field>
        <Field label="Carga horaria (minutos)"><Input type="number" min={0} value={form.workloadMinutes} onChange={e => setForm(old => ({ ...old, workloadMinutes: Number(e.target.value) }))}/></Field><Field label="Validade do certificado (meses)"><Input type="number" min={0} value={form.validityMonths} onChange={e => setForm(old => ({ ...old, validityMonths: Number(e.target.value) }))}/></Field>
        <Field label="Reciclagem (meses)"><Input type="number" min={0} value={form.recurrenceMonths} onChange={e => setForm(old => ({ ...old, recurrenceMonths: Number(e.target.value) }))}/></Field><Field label="Situacao"><select className="w-full border bg-white px-3 py-2 text-sm" value={form.status} onChange={e => setForm(old => ({ ...old, status: e.target.value as any }))}><option value="rascunho">Rascunho</option><option value="ativo">Ativo</option><option value="arquivado">Arquivado</option></select></Field>
        <div className="md:col-span-2"><Label>Descricao</Label><Textarea className="mt-1" value={form.description} onChange={e => setForm(old => ({ ...old, description: e.target.value }))}/></div>
        <div className="md:col-span-2 border p-4"><div className="flex items-center justify-between"><div><b className="text-sm">Publico-alvo</b><p className="text-xs text-slate-500">Os criterios selecionados sao combinados para incluir os colaboradores correspondentes.</p></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form.audience.allEmployees)} onChange={e => setForm(old => ({ ...old, audience: { ...old.audience, allEmployees: e.target.checked } }))}/> Todos</label></div>
          {!form.audience.allEmployees ? <div className="mt-4 grid gap-4 md:grid-cols-2"><CheckGroup title="Filiais" rows={optionsQ.data?.branches || []} selected={form.audience.branchIds || []} onChange={values => setForm(old => ({ ...old, audience: { ...old.audience, branchIds: values } }))}/><CheckGroup title="Setores" rows={optionsQ.data?.sectors || []} selected={form.audience.sectorIds || []} onChange={values => setForm(old => ({ ...old, audience: { ...old.audience, sectorIds: values } }))}/><CheckTextGroup title="Cargos / funcoes" rows={optionsQ.data?.positions || []} selected={form.audience.positions || []} onChange={values => setForm(old => ({ ...old, audience: { ...old.audience, positions: values } }))}/><CheckGroup title="GSE" rows={(optionsQ.data?.gses || []).map((row: any) => ({ ...row, name: `${row.code || ""} ${row.name}` }))} selected={form.audience.gseIds || []} onChange={values => setForm(old => ({ ...old, audience: { ...old.audience, gseIds: values } }))}/><CheckGroup title="Colaboradores especificos" rows={optionsQ.data?.users || []} selected={form.audience.userIds || []} onChange={values => setForm(old => ({ ...old, audience: { ...old.audience, userIds: values } }))}/></div> : null}
        </div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isMandatory} onChange={e => setForm(old => ({ ...old, isMandatory: e.target.checked }))}/> Obrigatorio</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.certificateRequired} onChange={e => setForm(old => ({ ...old, certificateRequired: e.target.checked }))}/> Certificado obrigatorio</label></div>
      <DialogFooter><Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button><Button disabled={save.isPending} onClick={submit}>Salvar e atribuir</Button></DialogFooter></DialogContent></Dialog>
  </div></AppLayout>;
}

function Metric({ label, value, icon, tone = "slate" }: { label: string; value: number; icon: React.ReactNode; tone?: string }) { const color: any = { slate: "text-slate-700", green: "text-emerald-700", amber: "text-amber-700", red: "text-rose-700" }; return <div className="border bg-white p-4"><div className={`flex items-center gap-2 text-xs ${color[tone]}`}>{icon}{label}</div><div className="mt-2 text-2xl font-bold">{value}</div></div>; }
function Action({ title, text }: { title: string; text: string }) { return <div className="border bg-slate-50 p-3"><b className="text-sm">{title}</b><p className="mt-1 text-xs text-slate-500">{text}</p></div>; }
function Status({ value }: { value: string }) { const cls = value === "concluido" ? "bg-emerald-100 text-emerald-800" : value === "vencido" ? "bg-rose-100 text-rose-800" : value === "em_andamento" ? "bg-sky-100 text-sky-800" : "bg-amber-100 text-amber-800"; return <Badge className={`rounded-sm ${cls}`}>{statusLabel[value] || value}</Badge>; }
function Empty({ text }: { text: string }) { return <div className="p-10 text-center text-sm text-slate-500"><Users className="mx-auto mb-2 opacity-30"/>{text}</div>; }
function Th({ children }: { children: React.ReactNode }) { return <th className="p-3 text-left font-semibold">{children}</th>; }
function Td({ children }: { children: React.ReactNode }) { return <td className="p-3 align-top">{children}</td>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><Label>{label}</Label><div className="mt-1">{children}</div></div>; }
function CheckGroup({ title, rows, selected, onChange }: { title: string; rows: any[]; selected: number[]; onChange: (values: number[]) => void }) { return <div><div className="mb-2 text-xs font-semibold">{title}</div><div className="max-h-36 space-y-1 overflow-auto border p-2">{rows.map(row => { const id = Number(row.id); return <label className="flex items-center gap-2 text-xs" key={id}><input type="checkbox" checked={selected.includes(id)} onChange={e => onChange(e.target.checked ? [...selected, id] : selected.filter(value => value !== id))}/><span>{row.name || row.title}</span></label>; })}{!rows.length ? <span className="text-xs text-slate-400">Sem opcoes cadastradas.</span> : null}</div></div>; }
function CheckTextGroup({ title, rows, selected, onChange }: { title: string; rows: string[]; selected: string[]; onChange: (values: string[]) => void }) { return <div><div className="mb-2 text-xs font-semibold">{title}</div><div className="max-h-36 space-y-1 overflow-auto border p-2">{rows.map(value => <label className="flex items-center gap-2 text-xs" key={value}><input type="checkbox" checked={selected.includes(value)} onChange={e => onChange(e.target.checked ? [...selected, value] : selected.filter(item => item !== value))}/><span>{value}</span></label>)}{!rows.length ? <span className="text-xs text-slate-400">Sem cargos cadastrados.</span> : null}</div></div>; }
