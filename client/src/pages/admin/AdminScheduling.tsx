import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Calendar, Clock, User, Plus, Pencil, Trash2, CheckCircle,
  XCircle, AlertCircle, Video, PhoneCall, FileText,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { ETHICAL_ALERT_TEMPLATES, ETHICAL_ALERT_DISCLAIMER } from "@shared/const";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const STATUS_BADGE: Record<string, { label: string; cls: string; icon: any }> = {
  pending:     { label: "Agendado",      cls: "bg-amber-100 text-amber-700",   icon: AlertCircle },
  confirmed:   { label: "Confirmado",    cls: "bg-blue-100 text-blue-700",     icon: CheckCircle },
  // R5-P9 #15: status "Em andamento" adicionado (pedido literal do Bruno)
  in_progress: { label: "Em andamento",  cls: "bg-indigo-100 text-indigo-700", icon: Clock },
  completed:   { label: "Realizado",     cls: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  cancelled:   { label: "Cancelado",     cls: "bg-red-100 text-red-700",       icon: XCircle },
  no_show:     { label: "Não compareceu",cls: "bg-orange-100 text-orange-700", icon: AlertCircle },
  rescheduled: { label: "Reagendado",    cls: "bg-purple-100 text-purple-700", icon: Clock },
  // R5-P12 #12 — status auditáveis detalhados
  no_show_collaborator: { label: "Não compareceu (colab.)", cls: "bg-orange-100 text-orange-700", icon: AlertCircle },
  no_show_professional: { label: "Não compareceu (psic.)",  cls: "bg-orange-100 text-orange-700", icon: AlertCircle },
  cancelled_by_collaborator: { label: "Cancelada pelo colaborador", cls: "bg-red-100 text-red-700", icon: XCircle },
  cancelled_by_professional: { label: "Cancelada pelo psicólogo",   cls: "bg-red-100 text-red-700", icon: XCircle },
  cancelled_by_company:      { label: "Cancelada pela empresa",     cls: "bg-red-100 text-red-700", icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_BADGE[status] ?? STATUS_BADGE.pending;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>
      <Icon size={11} />{s.label}
    </span>
  );
}

export default function AdminScheduling() {
  const { user } = useAuth();
  const isPsicologo = user?.role === "psicologo";
  const isAdminRole = ["admin", "rh", "admin_global", "super_admin", "sesmt"].includes(user?.role ?? "");
  const isGlobalAdmin = ["admin_global", "super_admin"].includes(user?.role ?? "");
  // SP3 #5 — RH só vê indicadores + cria nova consulta. Não pode mexer em status/finalizar/reagendar.
  // Psicólogo e admin (e admin_global/super_admin) mantêm controle integral.
  const isRhOnly = user?.role === "rh";
  const canEditAppointment = !isRhOnly; // psicólogo + admin + admin_global + super_admin
  // Gestão de profissionais/disponibilidade pertence ao Psicólogo/Profissional de Saúde
  // (e admins gerais). O RH fica apenas com a visão de agendamentos/relatórios.
  const canManageProfessionals = ["psicologo", "admin", "admin_global", "company_admin", "super_admin"].includes(user?.role ?? "");

  // Apenas psicólogo + admins veem (e escrevem) as observações profissionais (LGPD).
  const canSeeOutcome = ["psicologo", "admin", "admin_global", "company_admin", "super_admin"].includes(user?.role ?? "");
  const isSuperAdmin = user?.role === "super_admin";
  // P14 #2 — Evolução Clínica: acesso restrito à psicóloga responsável + Super Admin (auditoria).
  const canSeeClinicalEvolution = isPsicologo || isSuperAdmin;
  const [tab, setTab] = useState<"appointments" | "professionals" | "indicators">("appointments");
  const [showProfDialog, setShowProfDialog] = useState(false);
  const [editingProf, setEditingProf] = useState<any>(null);
  const [showAvailDialog, setShowAvailDialog] = useState(false);
  const [selectedProf, setSelectedProf] = useState<any>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [editingAppt, setEditingAppt] = useState<any>(null);
  const [showBookDialog, setShowBookDialog] = useState(false);
  // P14 #2 — Evolução Clínica (prontuário evolutivo)
  const [showEvoDialog, setShowEvoDialog] = useState(false);
  const [evoTarget, setEvoTarget] = useState<any>(null);
  const [evoFrom, setEvoFrom] = useState("");
  const [evoTo, setEvoTo] = useState("");
  const [newEvoNote, setNewEvoNote] = useState("");
  // P14 #3 — Alerta ético Psicologia → RH
  const [showEthicalDialog, setShowEthicalDialog] = useState(false);
  const [ethicalTarget, setEthicalTarget] = useState<any>(null);
  const [ethicalTemplateKey, setEthicalTemplateKey] = useState(ETHICAL_ALERT_TEMPLATES[0]?.key ?? "");

  const profQuery = trpc.scheduling.listProfessionals.useQuery({});
  const companiesQ = trpc.pgr.listCompanies.useQuery(undefined, { enabled: isGlobalAdmin });
  // R5-P11 #11 — psicólogo logado: cadastro próprio (cria on-demand se faltar).
  const myProfQuery = (trpc.scheduling as any).myProfessional.useQuery(undefined, { enabled: isPsicologo });
  const apptQuery = trpc.scheduling.listAppointments.useQuery({});
  const collaboratorsQuery = trpc.scheduling.listCollaborators.useQuery(undefined, { enabled: isAdminRole });

  const saveProfMut = trpc.scheduling.saveProfessional.useMutation({
    onSuccess: (r: any) => {
      profQuery.refetch();
      setShowProfDialog(false);
      if (r?.emailWarning) toast.warning(r.emailWarning);
      else if (r?.emailSent) toast.success("Profissional salvo e convite enviado.");
      else toast.success("Profissional salvo.");
    },
  });
  const deleteProfMut = trpc.scheduling.deleteProfessional.useMutation({ onSuccess: () => profQuery.refetch() });
  const updateStatusMut = trpc.scheduling.updateAppointmentStatus.useMutation({
    onSuccess: () => { apptQuery.refetch(); setShowStatusDialog(false); toast.success("Status atualizado."); },
  });
  const bookMut = trpc.scheduling.bookAppointment.useMutation({
    onSuccess: () => { apptQuery.refetch(); setShowBookDialog(false); toast.success("Consulta agendada com sucesso!"); },
    onError: (e) => toast.error(e.message),
  });
  // R5-P12 #12 — controle operacional da consulta (iniciar / encerrar / não compareceu)
  const startMut = (trpc.scheduling as any).startConsultation.useMutation({
    onSuccess: () => { apptQuery.refetch(); toast.success("Consulta iniciada."); }, onError: (e: any) => toast.error(e.message),
  });
  const endMut = (trpc.scheduling as any).endConsultation.useMutation({
    onSuccess: (r: any) => { apptQuery.refetch(); toast.success(`Consulta encerrada (${r?.effectiveMinutes ?? "?"} min).`); }, onError: (e: any) => toast.error(e.message),
  });
  const noShowMut = (trpc.scheduling as any).markNoShow.useMutation({
    onSuccess: (r: any) => { apptQuery.refetch(); toast.success(`Registrado. Espera ${r?.waitMinutes} min — ${r?.billable ? "faturável" : "não faturável"}.`); }, onError: (e: any) => toast.error(e.message),
  });
  function registrarNoShow(a: any) {
    const mins = Number(prompt("Quantos minutos você permaneceu disponível aguardando o colaborador?", "20"));
    if (!mins || mins <= 0) return;
    const end = new Date();
    const start = new Date(end.getTime() - mins * 60000);
    noShowMut.mutate({ id: a.id, waitStart: start.toISOString(), waitEnd: end.toISOString() });
  }

  // P14 #2 — Evolução Clínica (prontuário evolutivo)
  function openEvolution(a: any) { setEvoTarget(a); setEvoFrom(""); setEvoTo(""); setNewEvoNote(""); setShowEvoDialog(true); }
  const evoQuery = (trpc.scheduling as any).listClinicalEvolutions.useQuery(
    { collaboratorEmail: evoTarget?.collaboratorEmail ?? "", from: evoFrom || undefined, to: evoTo || undefined },
    { enabled: showEvoDialog && !!evoTarget?.collaboratorEmail }
  );
  const addEvoMut = (trpc.scheduling as any).addClinicalEvolution.useMutation({
    onSuccess: () => { setNewEvoNote(""); evoQuery.refetch(); toast.success("Evolução registrada."); },
    onError: (e: any) => toast.error(e.message),
  });
  function saveEvolution() {
    if (!evoTarget?.collaboratorEmail || !newEvoNote.trim()) return;
    addEvoMut.mutate({ collaboratorEmail: evoTarget.collaboratorEmail, appointmentId: evoTarget.id, note: newEvoNote.trim() });
  }

  // P14 #3 — Alerta ético Psicologia → RH
  function openEthicalAlert(a: any) { setEthicalTarget(a); setEthicalTemplateKey(ETHICAL_ALERT_TEMPLATES[0]?.key ?? ""); setShowEthicalDialog(true); }
  const sendEthicalMut = (trpc.scheduling as any).sendEthicalAlert.useMutation({
    onSuccess: (r: any) => { setShowEthicalDialog(false); toast.success(`Alerta enviado ao RH (${r?.recipients ?? 0} destinatário(s)).`); },
    onError: (e: any) => toast.error(e.message),
  });
  function sendEthicalAlert() {
    if (!ethicalTarget?.collaboratorEmail || !ethicalTemplateKey) return;
    sendEthicalMut.mutate({ collaboratorEmail: ethicalTarget.collaboratorEmail, templateKey: ethicalTemplateKey });
  }

  // Professional form state
  const [profForm, setProfForm] = useState({ name: "", email: "", cpf: "", specialty: "", bio: "", companyIds: [] as number[] });

  function openAddProf() { setEditingProf(null); setProfForm({ name: "", email: "", cpf: "", specialty: "", bio: "", companyIds: [] }); setShowProfDialog(true); }
  function openEditProf(p: any) { setEditingProf(p); setProfForm({ name: p.name, email: p.email ?? "", cpf: p.cpf ?? "", specialty: p.specialty ?? "", bio: p.bio ?? "", companyIds: p.companyIds ?? [] }); setShowProfDialog(true); }
  function saveProf() {
    if (!profForm.name.trim()) { toast.error("Nome obrigatório"); return; }
    if (!editingProf && !profForm.email.trim()) { toast.error("E-mail obrigatorio para gerar login."); return; }
    if (isGlobalAdmin && profForm.companyIds.length === 0) { toast.error("Selecione ao menos uma empresa."); return; }
    saveProfMut.mutate({ id: editingProf?.id, ...profForm });
  }

  // Availability state
  const [availSlots, setAvailSlots] = useState<{dayOfWeek:number; startTime:string; endTime:string; slotDurationMinutes:number}[]>([]);
  const availQuery = trpc.scheduling.getAvailability.useQuery(
    { professionalId: selectedProf?.id ?? 0 },
    { enabled: !!selectedProf, onSuccess: (d: any) => setAvailSlots(d) }
  );
  const saveAvailMut = trpc.scheduling.saveAvailability.useMutation({
    onSuccess: () => { toast.success("Disponibilidade salva."); setShowAvailDialog(false); },
  });

  // VÍDEO V5 — link de reunião (Meet/Teams) próprio do profissional, salvo junto da disponibilidade.
  const [meetLink, setMeetLink] = useState("");
  function openAvail(p: any) { setSelectedProf(p); setMeetLink(p?.meetingUrlTemplate ?? p?.meeting_url_template ?? ""); setShowAvailDialog(true); }
  function addSlot() { setAvailSlots(prev => [...prev, { dayOfWeek: 1, startTime: "08:00", endTime: "17:00", slotDurationMinutes: 30 }]); }
  function removeSlot(i: number) { setAvailSlots(prev => prev.filter((_, j) => j !== i)); }
  function updateSlot(i: number, field: string, val: any) {
    setAvailSlots(prev => prev.map((s, j) => j === i ? { ...s, [field]: val } : s));
  }
  function saveAvail() {
    if (!selectedProf) return;
    saveAvailMut.mutate({ professionalId: selectedProf.id, slots: availSlots });
    // Persiste o link de reunião padrão (template) sem bloquear o save de disponibilidade.
    saveProfMut.mutate({
      id: selectedProf.id, name: selectedProf.name, email: selectedProf.email ?? "",
      cpf: selectedProf.cpf ?? "", specialty: selectedProf.specialty ?? "", bio: selectedProf.bio ?? "",
      meetingUrlTemplate: meetLink || undefined,
    });
  }

  // Status dialog
  const [statusForm, setStatusForm] = useState({ status: "confirmed" as any, meetingUrl: "", cancelReason: "", outcomeNotes: "" });
  function openStatus(a: any) {
    setEditingAppt(a);
    setStatusForm({
      status: a.status,
      meetingUrl: a.meetingUrl ?? "",
      cancelReason: a.cancelReason ?? "",
      outcomeNotes: canSeeOutcome ? (a.outcomeNotes ?? "") : "",
    });
    setShowStatusDialog(true);
  }
  // VÍDEO V5 — gera um laudo/relatório imprimível do atendimento (restrito ao profissional/admin).
  function imprimirLaudo() {
    if (!editingAppt) return;
    const a: any = editingAppt;
    const statusLabel = STATUS_BADGE[statusForm.status]?.label ?? statusForm.status;
    const dt = a.scheduledAt ? new Date(a.scheduledAt).toLocaleString("pt-BR") : "—";
    const win = window.open("", "_blank");
    if (!win) { toast.error("Permita pop-ups para gerar o relatório."); return; }
    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Relatório de Atendimento Psicológico</title>
<style>
  body{font-family:Inter,Arial,sans-serif;color:#1e293b;max-width:760px;margin:0 auto;padding:32px 40px}
  h1{font-size:18px;color:#1e3a5f;border-bottom:2px solid #1e3a5f;padding-bottom:8px;margin:0 0 4px}
  .sub{font-size:11px;color:#64748b;margin-bottom:18px}
  .row{font-size:13px;margin:6px 0}.row b{color:#475569}
  .box{border:1px solid #cbd5e1;border-radius:8px;padding:14px 18px;margin-top:14px;background:#f8fafc}
  .sig{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#b91c1c;font-weight:700}
  .ev{white-space:pre-wrap;font-size:13px;line-height:1.6;margin-top:6px}
  .ft{font-size:10px;color:#94a3b8;text-align:center;margin-top:28px;padding-top:10px;border-top:1px solid #e2e8f0}
  @page{size:A4;margin:0}@media print{body{padding:20mm}}
</style></head><body>
  <h1>Relatório de Atendimento Psicológico</h1>
  <p class="sub">Documento sigiloso — uso restrito ao profissional de saúde (LGPD / sigilo profissional)</p>
  <div class="row"><b>Colaborador:</b> ${a.collaboratorName ?? "—"} ${a.collaboratorEmail ? `(${a.collaboratorEmail})` : ""}</div>
  <div class="row"><b>Profissional:</b> ${a.professionalName ?? "—"}</div>
  <div class="row"><b>Data/hora:</b> ${dt} · ${a.durationMinutes ?? 30} min</div>
  <div class="row"><b>Situação:</b> ${statusLabel}</div>
  ${a.meetingUrl ? `<div class="row"><b>Link da reunião:</b> ${a.meetingUrl}</div>` : ""}
  <div class="box">
    <div class="sig">Evolução / observações clínicas (sigiloso)</div>
    <div class="ev">${(statusForm.outcomeNotes || "—").replace(/</g, "&lt;")}</div>
  </div>
  <div class="ft">Saúde do Trabalho · Relatório gerado eletronicamente · Documento confidencial</div>
  <script>window.onload=()=>setTimeout(()=>window.print(),300);</script>
</body></html>`);
    win.document.close();
  }

  function saveStatus() {
    if (!editingAppt) return;
    updateStatusMut.mutate({
      id: editingAppt.id,
      status: statusForm.status,
      meetingUrl: statusForm.meetingUrl || undefined,
      cancelReason: statusForm.cancelReason || undefined,
      // Só envia outcomeNotes se este perfil pode escrever (psicólogo/admin).
      outcomeNotes: canSeeOutcome ? (statusForm.outcomeNotes || undefined) : undefined,
    });
  }

  // Indicadores básicos do programa (acessível a RH/psicólogo/admins; SEM outcome_notes).
  const indicatorsQ = trpc.scheduling.indicators.useQuery(undefined, { enabled: tab === "indicators" });
  const ind = indicatorsQ.data as any;

  // Book for employee form
  const [bookForm, setBookForm] = useState({
    collaboratorId: 0,
    professionalId: 0,
    date: "",
    time: "09:00",
    durationMinutes: 30,
    notes: "",
  });

  function openBook() {
    setBookForm({ collaboratorId: 0, professionalId: 0, date: "", time: "09:00", durationMinutes: 30, notes: "" });
    setShowBookDialog(true);
  }

  function saveBook() {
    if (!bookForm.collaboratorId) { toast.error("Selecione o funcionário"); return; }
    if (!bookForm.professionalId) { toast.error("Selecione o profissional"); return; }
    if (!bookForm.date) { toast.error("Informe a data"); return; }
    bookMut.mutate({
      professionalId: bookForm.professionalId,
      date: bookForm.date,
      time: bookForm.time,
      durationMinutes: bookForm.durationMinutes,
      notes: bookForm.notes || undefined,
      collaboratorId: bookForm.collaboratorId,
    });
  }

  const profs = profQuery.data ?? [];
  const companies = (companiesQ.data ?? []) as any[];
  const allAppts = apptQuery.data ?? [];
  const collaborators = collaboratorsQuery.data ?? [];
  // R5-P11 #11 — myProf vem da nova proc dedicada (cria cadastro se faltar);
  // fallback antigo (match por email) só pra retrocompat.
  const myProf = isPsicologo
    ? (myProfQuery.data ?? profs.find((p) => p.email === user?.email) ?? null)
    : null;
  const baseAppts = isPsicologo && myProf
    ? allAppts.filter((a: any) => Number(a.professionalId) === Number(myProf.id) || a.professionalName === myProf.name)
    : allAppts;
  // R5-P9 #15: filtros rápidos de período + busca por nome + filtro por status.
  const [periodFilter, setPeriodFilter] = useState<"hoje"|"semana"|"mes"|"todos">("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const appts = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endToday = new Date(startToday.getTime() + 24*60*60*1000);
    const dayOfWeek = startToday.getDay();
    const startWeek = new Date(startToday.getTime() - dayOfWeek*24*60*60*1000);
    const endWeek = new Date(startWeek.getTime() + 7*24*60*60*1000);
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endMonth = new Date(now.getFullYear(), now.getMonth()+1, 1);
    const q = search.trim().toLowerCase();
    return baseAppts.filter((a: any) => {
      if (statusFilter !== "todos" && a.status !== statusFilter) return false;
      if (q) {
        const hay = `${a.collaboratorName ?? ""} ${a.collaboratorEmail ?? ""} ${a.professionalName ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (periodFilter === "todos") return true;
      const at = a.scheduledAt ? new Date(a.scheduledAt) : null;
      if (!at) return false;
      if (periodFilter === "hoje") return at >= startToday && at < endToday;
      if (periodFilter === "semana") return at >= startWeek && at < endWeek;
      if (periodFilter === "mes") return at >= startMonth && at < endMonth;
      return true;
    });
  }, [baseAppts, periodFilter, statusFilter, search]);

  return (
    <AppLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Calendar size={22} /> {isPsicologo ? "Gestão de Atendimentos Psicológicos" : "Agenda de Acolhimento"}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {isPsicologo
                ? "Sua agenda, disponibilidade, status, evolução clínica e indicadores."
                : "Gerencie profissionais, disponibilidade e agendamentos"}
            </p>
          </div>
          {isAdminRole && tab === "appointments" && (
            <Button size="sm" onClick={openBook} className="gap-1">
              <Plus size={14} /> Nova Consulta
            </Button>
          )}
          {/* R5-P11 #11 — atalho direto pro psicólogo configurar a própria agenda */}
          {isPsicologo && myProf && (
            <Button size="sm" variant="outline" onClick={() => openAvail(myProf)} className="gap-1">
              <Clock size={14} /> Minha Disponibilidade
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200 pb-0">
          {[
            { id: "appointments", label: isPsicologo ? "Minha Agenda" : "Agendamentos" },
            ...(canManageProfessionals ? [{ id: "professionals", label: "Profissionais" }] : []),
            { id: "indicators", label: "Indicadores" },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.id ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >{t.label}</button>
          ))}
        </div>

        {/* ── Appointments Tab ── */}
        {tab === "appointments" && (
          <div className="space-y-3">
            {/* R5-P9 #15: filtros de período + status + busca */}
            <div className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2">
              <span className="text-xs font-semibold text-slate-500 ml-1">Período:</span>
              {[
                { v: "hoje" as const, l: "Hoje" },
                { v: "semana" as const, l: "Semana" },
                { v: "mes" as const, l: "Mês" },
                { v: "todos" as const, l: "Todos" },
              ].map(opt => (
                <button
                  key={opt.v}
                  onClick={() => setPeriodFilter(opt.v)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${periodFilter === opt.v ? "bg-primary text-white" : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"}`}
                >{opt.l}</button>
              ))}
              <span className="text-xs font-semibold text-slate-500 ml-3">Status:</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded px-2 py-1 bg-white"
              >
                <option value="todos">Todos</option>
                {Object.entries(STATUS_BADGE).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <input
                type="search"
                placeholder="Buscar colaborador ou profissional..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="text-xs border border-slate-200 rounded px-2 py-1 flex-1 min-w-[200px] bg-white"
              />
              <span className="text-xs text-slate-500 ml-auto">{appts.length} resultado(s)</span>
            </div>
            {apptQuery.isLoading && <p className="text-slate-400 text-sm">Carregando...</p>}
            {!apptQuery.isLoading && appts.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <Calendar size={40} className="mx-auto mb-3 opacity-30" />
                <p>Nenhum agendamento ainda.</p>
                {isAdminRole && <p className="text-xs mt-1">Use "Nova Consulta" para agendar para um funcionário.</p>}
              </div>
            )}
            <div className="grid gap-3">
              {appts.map(a => (
                <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-slate-400" />
                      <span className="font-medium text-slate-800">{(a as any).collaboratorName ?? "—"}</span>
                      <span className="text-slate-400 text-xs">{(a as any).collaboratorEmail}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <PhoneCall size={13} className="text-slate-400" />
                      <span>{a.professionalName}</span>
                      {a.specialty && <Badge variant="outline" className="text-xs px-1.5 py-0">{a.specialty}</Badge>}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Clock size={13} />
                      <span>{a.scheduledAt ? new Date(a.scheduledAt).toLocaleString("pt-BR") : "—"}</span>
                      <span className="text-slate-300">·</span>
                      <span>{a.durationMinutes} min</span>
                    </div>
                    {a.meetingUrl && (
                      <a href={a.meetingUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                        <Video size={11} /> Link da reunião
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <StatusBadge status={a.status} />
                    {/* R5-P12 #12 — controle operacional do psicólogo */}
                    {isPsicologo && ["pending", "confirmed"].includes(a.status) && (
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => startMut.mutate({ id: a.id })}>Iniciar</Button>
                    )}
                    {isPsicologo && a.status === "in_progress" && (
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => endMut.mutate({ id: a.id })}>Encerrar</Button>
                    )}
                    {isPsicologo && ["pending", "confirmed", "in_progress"].includes(a.status) && (
                      <Button size="sm" variant="outline" className="text-orange-700 border-orange-300" onClick={() => registrarNoShow(a)}>Não compareceu</Button>
                    )}
                    {canSeeClinicalEvolution && (
                      <Button size="sm" variant="outline" className="text-violet-700 border-violet-200" onClick={() => openEvolution(a)}>Evolução Clínica</Button>
                    )}
                    {isPsicologo && (
                      <Button size="sm" variant="outline" className="text-amber-700 border-amber-200" onClick={() => openEthicalAlert(a)}>Alerta ao RH</Button>
                    )}
                    {canEditAppointment && (
                      <Button size="sm" variant="outline" onClick={() => openStatus(a)}>Atualizar</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Professionals Tab ── */}
        {tab === "professionals" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={openAddProf} className="gap-1"><Plus size={14} /> Novo Profissional</Button>
            </div>
            {profs.length === 0 && !profQuery.isLoading && (
              <div className="text-center py-16 text-slate-400">
                <User size={40} className="mx-auto mb-3 opacity-30" />
                <p>Nenhum profissional cadastrado.</p>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {profs.map(p => (
                <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-800">{p.name}</p>
                      {p.specialty && <p className="text-xs text-primary">{p.specialty}</p>}
                      {p.email && <p className="text-xs text-slate-500">{p.email}</p>}
                      {p.cpf && <p className="text-xs text-slate-500">CPF: {p.cpf}</p>}
                      {p.companyNames?.length > 0 && <p className="text-xs text-emerald-700 mt-1">Empresas: {p.companyNames.join(", ")}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openAvail(p)} title="Disponibilidade" className="p-1.5 rounded hover:bg-slate-100 text-slate-500"><Clock size={14} /></button>
                      <button onClick={() => openEditProf(p)} title="Editar" className="p-1.5 rounded hover:bg-slate-100 text-slate-500"><Pencil size={14} /></button>
                      <button onClick={() => { if (confirm("Remover profissional?")) deleteProfMut.mutate({ id: p.id }); }} title="Remover" className="p-1.5 rounded hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  {p.bio && <p className="text-xs text-slate-500 line-clamp-2">{p.bio}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Indicators Tab ── */}
        {tab === "indicators" && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Indicadores do programa de acolhimento. RH e gestão veem agregados (não há acesso a observações profissionais — LGPD).
            </p>
            {indicatorsQ.isLoading && <p className="text-slate-400 text-sm">Carregando indicadores...</p>}
            {ind && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Total de atendimentos</div>
                    <div className="text-2xl font-bold text-slate-800 mt-1">{ind.total ?? 0}</div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Comparecimento</div>
                    <div className="text-2xl font-bold text-emerald-700 mt-1">{ind.attendanceRate ?? 0}%</div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Não compareceu</div>
                    <div className="text-2xl font-bold text-orange-700 mt-1">{ind.noShowRate ?? 0}%</div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Cancelamentos</div>
                    <div className="text-2xl font-bold text-rose-700 mt-1">{ind.cancelRate ?? 0}%</div>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <h3 className="font-semibold text-slate-800 text-sm mb-2">Distribuição por status</h3>
                  <div className="space-y-1">
                    {Object.entries(ind.byStatus ?? {}).map(([k, v]: any) => {
                      const meta = STATUS_BADGE[k] ?? { label: k, cls: "bg-slate-100 text-slate-700" } as any;
                      return (
                        <div key={k} className="flex items-center gap-2 text-sm">
                          <span className={`inline-block w-32 text-xs px-2 py-0.5 rounded ${meta.cls}`}>{meta.label}</span>
                          <span className="text-slate-700">{v}</span>
                        </div>
                      );
                    })}
                    {Object.keys(ind.byStatus ?? {}).length === 0 && <p className="text-xs text-slate-400">Sem dados ainda.</p>}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <h3 className="font-semibold text-slate-800 text-sm mb-2">Evolução mensal (12 meses)</h3>
                  <div className="space-y-1">
                    {((ind.byMonth as any[]) ?? []).map((m: any) => (
                      <div key={m.month} className="flex items-center gap-2 text-sm">
                        <span className="w-20 text-xs text-slate-500">{m.month}</span>
                        <span className="text-slate-700">{m.total} agendado(s)</span>
                        <span className="text-emerald-700 text-xs">· {m.completed} realizado(s)</span>
                      </div>
                    ))}
                    {((ind.byMonth as any[]) ?? []).length === 0 && <p className="text-xs text-slate-400">Sem dados nos últimos 12 meses.</p>}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Nova Consulta Dialog (RH agenda para funcionário) ── */}
      <Dialog open={showBookDialog} onOpenChange={setShowBookDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Agendar Consulta para Funcionário</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium text-slate-700">Funcionário *</label>
              <select
                value={bookForm.collaboratorId}
                onChange={e => setBookForm(f => ({ ...f, collaboratorId: Number(e.target.value) }))}
                className="w-full border border-slate-200 rounded px-3 py-1.5 text-sm mt-1"
              >
                <option value={0}>Selecione o funcionário...</option>
                {collaborators.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name || c.email}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Profissional *</label>
              <select
                value={bookForm.professionalId}
                onChange={e => setBookForm(f => ({ ...f, professionalId: Number(e.target.value) }))}
                className="w-full border border-slate-200 rounded px-3 py-1.5 text-sm mt-1"
              >
                <option value={0}>Selecione o profissional...</option>
                {profs.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}{p.specialty ? ` — ${p.specialty}` : ""}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium text-slate-700">Data *</label>
                <Input type="date" value={bookForm.date} onChange={e => setBookForm(f => ({ ...f, date: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Horário</label>
                <Input type="time" value={bookForm.time} onChange={e => setBookForm(f => ({ ...f, time: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Duração</label>
              <select
                value={bookForm.durationMinutes}
                onChange={e => setBookForm(f => ({ ...f, durationMinutes: Number(e.target.value) }))}
                className="w-full border border-slate-200 rounded px-3 py-1.5 text-sm mt-1"
              >
                {[20, 30, 45, 60].map(d => <option key={d} value={d}>{d} minutos</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Observações</label>
              <Textarea
                value={bookForm.notes}
                onChange={e => setBookForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Motivo do agendamento, orientações..."
                className="mt-1"
              />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setShowBookDialog(false)}>Cancelar</Button>
              <Button onClick={saveBook} disabled={bookMut.isPending}>
                {bookMut.isPending ? "Agendando..." : "Confirmar Agendamento"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Professional Dialog */}
      <Dialog open={showProfDialog} onOpenChange={setShowProfDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingProf ? "Editar Profissional" : "Novo Profissional"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium text-slate-700">Nome *</label>
              <Input value={profForm.name} onChange={e => setProfForm(f => ({ ...f, name: e.target.value }))} placeholder="Dra. Maria Silva" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">E-mail</label>
              <Input value={profForm.email} onChange={e => setProfForm(f => ({ ...f, email: e.target.value }))} placeholder="profissional@empresa.com" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">CPF</label>
              <Input value={profForm.cpf} onChange={e => setProfForm(f => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" />
            </div>
            {isGlobalAdmin && (
              <div>
                <label className="text-sm font-medium text-slate-700">Empresas vinculadas *</label>
                <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-slate-200 bg-white p-2 space-y-1">
                  {companies.length === 0 && <p className="text-xs text-slate-400 px-1 py-2">Nenhuma empresa disponivel.</p>}
                  {companies.map((c: any) => {
                    const checked = profForm.companyIds.includes(Number(c.id));
                    return (
                      <label key={c.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => setProfForm(f => ({
                            ...f,
                            companyIds: e.target.checked
                              ? Array.from(new Set([...f.companyIds, Number(c.id)]))
                              : f.companyIds.filter(id => id !== Number(c.id)),
                          }))}
                        />
                        <span>{c.name}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">O profissional e os colaboradores enxergam apenas as empresas vinculadas aqui.</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-slate-700">Especialidade</label>
              <Input value={profForm.specialty} onChange={e => setProfForm(f => ({ ...f, specialty: e.target.value }))} placeholder="Psicóloga Organizacional" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Bio / Apresentação</label>
              <Textarea value={profForm.bio} onChange={e => setProfForm(f => ({ ...f, bio: e.target.value }))} rows={3} />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setShowProfDialog(false)}>Cancelar</Button>
              <Button onClick={saveProf} disabled={saveProfMut.isPending}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Availability Dialog */}
      <Dialog open={showAvailDialog} onOpenChange={setShowAvailDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Disponibilidade — {selectedProf?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {/* VÍDEO V5 — link de reunião padrão (Meet/Teams) do profissional */}
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                <Video size={13} /> Meu link de reunião (Google Meet / Teams)
              </label>
              <Input
                value={meetLink}
                onChange={e => setMeetLink(e.target.value)}
                placeholder="https://meet.google.com/sua-sala-fixa"
                className="mt-1"
              />
              <p className="text-[11px] text-slate-500 mt-1">Usado automaticamente ao confirmar uma consulta online. Salvo junto da disponibilidade.</p>
            </div>
            <p className="text-xs text-slate-500">Defina os dias e horários em que você atende.</p>
            {availSlots.map((s, i) => (
              <div key={i} className="border border-slate-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Slot {i + 1}</span>
                  <button onClick={() => removeSlot(i)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-500">Dia da semana</label>
                    <select
                      value={s.dayOfWeek}
                      onChange={e => updateSlot(i, "dayOfWeek", Number(e.target.value))}
                      className="w-full border border-slate-200 rounded px-2 py-1 text-sm"
                    >
                      {DAYS.map((d, j) => <option key={j} value={j}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Duração do slot</label>
                    <select
                      value={s.slotDurationMinutes}
                      onChange={e => updateSlot(i, "slotDurationMinutes", Number(e.target.value))}
                      className="w-full border border-slate-200 rounded px-2 py-1 text-sm"
                    >
                      {[20, 30, 45, 60].map(d => <option key={d} value={d}>{d} min</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Início</label>
                    <Input type="time" value={s.startTime} onChange={e => updateSlot(i, "startTime", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Término</label>
                    <Input type="time" value={s.endTime} onChange={e => updateSlot(i, "endTime", e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addSlot} className="gap-1 w-full"><Plus size={13} /> Adicionar horário</Button>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setShowAvailDialog(false)}>Cancelar</Button>
              <Button onClick={saveAvail} disabled={saveAvailMut.isPending}>Salvar disponibilidade</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Atualizar Agendamento</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {/* R5-P10 #11 — mini-histórico do colaborador (não revela observações clínicas) */}
            {editingAppt && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
                <div className="font-semibold text-slate-700">
                  {(editingAppt as any).collaboratorName ?? "Colaborador"}
                </div>
                <div className="text-slate-500">{(editingAppt as any).collaboratorEmail}</div>
                <div className="text-slate-500">
                  Atendimentos com você:{" "}
                  <b>
                    {
                      baseAppts.filter(
                        (a: any) =>
                          a.id !== editingAppt.id &&
                          a.collaboratorEmail === (editingAppt as any).collaboratorEmail
                      ).length
                    }
                  </b>{" "}
                  · Profissional: <b>{editingAppt.professionalName}</b>
                </div>
                <div className="text-slate-500">
                  Agendado para:{" "}
                  <b>
                    {editingAppt.scheduledAt
                      ? new Date(editingAppt.scheduledAt).toLocaleString("pt-BR")
                      : "—"}
                  </b>{" "}
                  · {editingAppt.durationMinutes} min
                </div>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-slate-700">Status</label>
              <select
                value={statusForm.status}
                onChange={e => setStatusForm(f => ({ ...f, status: e.target.value as any }))}
                className="w-full border border-slate-200 rounded px-3 py-1.5 text-sm mt-1"
              >
                <option value="pending">Agendado</option>
                <option value="confirmed">Confirmado</option>
                <option value="in_progress">Em andamento</option>
                <option value="completed">Realizado</option>
                <option value="cancelled">Cancelado</option>
                <option value="no_show">Não compareceu</option>
                <option value="rescheduled">Reagendado</option>
              </select>
            </div>
            {(statusForm.status === "confirmed" || statusForm.status === "rescheduled") && (
              <div>
                <label className="text-sm font-medium text-slate-700">Link da reunião (Google Meet / Teams)</label>
                <Input value={statusForm.meetingUrl} onChange={e => setStatusForm(f => ({ ...f, meetingUrl: e.target.value }))} placeholder="https://meet.google.com/..." />
              </div>
            )}
            {statusForm.status === "cancelled" && (
              <div>
                <label className="text-sm font-medium text-slate-700">Motivo do cancelamento</label>
                <Textarea value={statusForm.cancelReason} onChange={e => setStatusForm(f => ({ ...f, cancelReason: e.target.value }))} rows={2} />
              </div>
            )}
            {canSeeOutcome && (
              <div className="border-t border-slate-200 pt-3">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                  Observações Profissionais
                  <span className="text-[10px] font-semibold uppercase bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">sigiloso</span>
                </label>
                <p className="text-xs text-slate-500 mt-0.5 mb-1">Visível apenas para o profissional de saúde e admins gerais — NÃO é exibido ao RH, à chefia ou ao colaborador.</p>
                <Textarea
                  value={statusForm.outcomeNotes}
                  onChange={e => setStatusForm(f => ({ ...f, outcomeNotes: e.target.value }))}
                  rows={4}
                  placeholder="Anotações clínicas/administrativas restritas ao profissional."
                />
              </div>
            )}
            <div className="flex gap-2 justify-between pt-1">
              {/* VÍDEO V5 — gerar relatório/laudo do atendimento (só quem vê o sigiloso) */}
              {canSeeOutcome ? (
                <Button variant="outline" type="button" onClick={() => imprimirLaudo()} className="gap-1">
                  <FileText size={14} /> Gerar relatório
                </Button>
              ) : <span />}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowStatusDialog(false)}>Cancelar</Button>
                <Button onClick={saveStatus} disabled={updateStatusMut.isPending}>Salvar</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* P14 #2 — Evolução Clínica (prontuário evolutivo) */}
      <Dialog open={showEvoDialog} onOpenChange={setShowEvoDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Evolução Clínica — {evoTarget?.collaboratorName ?? "Colaborador"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-xs text-rose-700">
              Conteúdo sigiloso — visível apenas para a psicóloga responsável por este colaborador e para o Super Admin (auditoria). Protegido pelo Código de Ética do Psicólogo e pela LGPD.
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs font-medium text-slate-600">De</label>
                <Input type="date" value={evoFrom} onChange={e => setEvoFrom(e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-slate-600">Até</label>
                <Input type="date" value={evoTo} onChange={e => setEvoTo(e.target.value)} />
              </div>
            </div>
            {isPsicologo && (
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-2">
                <label className="text-sm font-medium text-slate-700">Nova evolução</label>
                <Textarea
                  value={newEvoNote}
                  onChange={e => setNewEvoNote(e.target.value)}
                  rows={3}
                  placeholder="Registre a evolução do atendimento. Fica salvo automaticamente no histórico cronológico do colaborador."
                />
                <div className="flex justify-end">
                  <Button size="sm" onClick={saveEvolution} disabled={addEvoMut.isPending || !newEvoNote.trim()}>Registrar evolução</Button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase">Histórico cronológico</p>
              {evoQuery.isLoading && <p className="text-sm text-slate-400">Carregando…</p>}
              {!evoQuery.isLoading && (evoQuery.data ?? []).length === 0 && (
                <p className="text-sm text-slate-400">Nenhuma evolução registrada neste período.</p>
              )}
              {(evoQuery.data ?? []).map((e: any) => (
                <div key={e.id} className="border border-slate-200 rounded-lg p-3">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs font-medium text-slate-500">
                      {e.createdAt ? new Date(e.createdAt).toLocaleString("pt-BR") : "—"}
                    </span>
                    {e.createdByName && <span className="text-[11px] text-slate-400">{e.createdByName}</span>}
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{e.note}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-1">
              <Button variant="outline" onClick={() => setShowEvoDialog(false)}>Fechar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* P14 #3 — Alerta ético Psicologia → RH (sem sigilo clínico) */}
      <Dialog open={showEthicalDialog} onOpenChange={setShowEthicalDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Alerta ao RH — {ethicalTarget?.collaboratorName ?? "Colaborador"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800">
              {ETHICAL_ALERT_DISCLAIMER}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Modelo de recomendação</label>
              <select
                value={ethicalTemplateKey}
                onChange={e => setEthicalTemplateKey(e.target.value)}
                className="w-full border border-slate-200 rounded px-3 py-1.5 text-sm mt-1"
              >
                {ETHICAL_ALERT_TEMPLATES.map(t => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-2 border-l-2 border-slate-200 pl-2">
                {ETHICAL_ALERT_TEMPLATES.find(t => t.key === ethicalTemplateKey)?.body}
              </p>
            </div>
            <p className="text-xs text-slate-500">
              O RH da empresa do colaborador receberá uma notificação e um e-mail com este texto. Não é possível editar ou adicionar texto livre — apenas escolher um dos modelos pré-aprovados.
            </p>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setShowEthicalDialog(false)}>Cancelar</Button>
              <Button onClick={sendEthicalAlert} disabled={sendEthicalMut.isPending}>Enviar ao RH</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
