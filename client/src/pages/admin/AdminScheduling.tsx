import { useState } from "react";
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
  XCircle, AlertCircle, Video, PhoneCall,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const STATUS_BADGE: Record<string, { label: string; cls: string; icon: any }> = {
  pending:   { label: "Pendente",   cls: "bg-amber-100 text-amber-700",   icon: AlertCircle },
  confirmed: { label: "Confirmado", cls: "bg-blue-100 text-blue-700",     icon: CheckCircle },
  completed: { label: "Concluído",  cls: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  cancelled: { label: "Cancelado",  cls: "bg-red-100 text-red-700",       icon: XCircle },
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
  const [tab, setTab] = useState<"appointments" | "professionals">("appointments");
  const [showProfDialog, setShowProfDialog] = useState(false);
  const [editingProf, setEditingProf] = useState<any>(null);
  const [showAvailDialog, setShowAvailDialog] = useState(false);
  const [selectedProf, setSelectedProf] = useState<any>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [editingAppt, setEditingAppt] = useState<any>(null);

  const profQuery = trpc.scheduling.listProfessionals.useQuery({});
  const apptQuery = trpc.scheduling.listAppointments.useQuery({});
  const saveProfMut = trpc.scheduling.saveProfessional.useMutation({ onSuccess: () => { profQuery.refetch(); setShowProfDialog(false); toast.success("Profissional salvo."); } });
  const deleteProfMut = trpc.scheduling.deleteProfessional.useMutation({ onSuccess: () => profQuery.refetch() });
  const updateStatusMut = trpc.scheduling.updateAppointmentStatus.useMutation({ onSuccess: () => { apptQuery.refetch(); setShowStatusDialog(false); toast.success("Status atualizado."); } });

  // Professional form state
  const [profForm, setProfForm] = useState({ name: "", email: "", specialty: "", bio: "" });

  function openAddProf() { setEditingProf(null); setProfForm({ name: "", email: "", specialty: "", bio: "" }); setShowProfDialog(true); }
  function openEditProf(p: any) { setEditingProf(p); setProfForm({ name: p.name, email: p.email ?? "", specialty: p.specialty ?? "", bio: p.bio ?? "" }); setShowProfDialog(true); }
  function saveProf() {
    if (!profForm.name.trim()) { toast.error("Nome obrigatório"); return; }
    saveProfMut.mutate({ id: editingProf?.id, ...profForm });
  }

  // Availability state
  const [availSlots, setAvailSlots] = useState<{dayOfWeek:number; startTime:string; endTime:string; slotDurationMinutes:number}[]>([]);
  const availQuery = trpc.scheduling.getAvailability.useQuery(
    { professionalId: selectedProf?.id ?? 0 },
    { enabled: !!selectedProf, onSuccess: (d) => setAvailSlots(d) }
  );
  const saveAvailMut = trpc.scheduling.saveAvailability.useMutation({ onSuccess: () => { toast.success("Disponibilidade salva."); setShowAvailDialog(false); } });

  function openAvail(p: any) { setSelectedProf(p); setShowAvailDialog(true); }
  function addSlot() { setAvailSlots(prev => [...prev, { dayOfWeek: 1, startTime: "08:00", endTime: "17:00", slotDurationMinutes: 30 }]); }
  function removeSlot(i: number) { setAvailSlots(prev => prev.filter((_, j) => j !== i)); }
  function updateSlot(i: number, field: string, val: any) {
    setAvailSlots(prev => prev.map((s, j) => j === i ? { ...s, [field]: val } : s));
  }
  function saveAvail() {
    if (!selectedProf) return;
    saveAvailMut.mutate({ professionalId: selectedProf.id, slots: availSlots });
  }

  // Status dialog
  const [statusForm, setStatusForm] = useState({ status: "confirmed" as any, meetingUrl: "", cancelReason: "" });
  function openStatus(a: any) { setEditingAppt(a); setStatusForm({ status: a.status, meetingUrl: a.meetingUrl ?? "", cancelReason: "" }); setShowStatusDialog(true); }
  function saveStatus() {
    if (!editingAppt) return;
    updateStatusMut.mutate({ id: editingAppt.id, status: statusForm.status, meetingUrl: statusForm.meetingUrl || undefined, cancelReason: statusForm.cancelReason || undefined });
  }

  const profs = profQuery.data ?? [];
  const allAppts = apptQuery.data ?? [];
  const myProf = isPsicologo ? profs.find((p) => p.email === user?.email) : null;
  const appts = isPsicologo
    ? allAppts.filter((a) => myProf ? a.professionalName === myProf.name : false)
    : allAppts;

  return (
    <AppLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Calendar size={22} /> Agenda de Acolhimento</h1>
            <p className="text-sm text-slate-500 mt-0.5">Gerencie profissionais, disponibilidade e agendamentos</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200 pb-0">
          {[
            { id: "appointments", label: isPsicologo ? "Minha Agenda" : "Agendamentos" },
            ...(!isPsicologo ? [{ id: "professionals", label: "Profissionais" }] : []),
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
            {apptQuery.isLoading && <p className="text-slate-400 text-sm">Carregando...</p>}
            {!apptQuery.isLoading && appts.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <Calendar size={40} className="mx-auto mb-3 opacity-30" />
                <p>Nenhum agendamento ainda.</p>
                <p className="text-xs mt-1">Colaboradores poderão agendar pelo painel de bem-estar.</p>
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
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={a.status} />
                    <Button size="sm" variant="outline" onClick={() => openStatus(a)}>Atualizar</Button>
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
      </div>

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
            <p className="text-xs text-slate-500">Defina os dias e horários em que este profissional atende. O sistema gerará os slots automaticamente.</p>
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
            <div>
              <label className="text-sm font-medium text-slate-700">Status</label>
              <select
                value={statusForm.status}
                onChange={e => setStatusForm(f => ({ ...f, status: e.target.value as any }))}
                className="w-full border border-slate-200 rounded px-3 py-1.5 text-sm mt-1"
              >
                <option value="pending">Pendente</option>
                <option value="confirmed">Confirmado</option>
                <option value="completed">Concluído</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
            {statusForm.status === "confirmed" && (
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
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setShowStatusDialog(false)}>Cancelar</Button>
              <Button onClick={saveStatus} disabled={updateStatusMut.isPending}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
