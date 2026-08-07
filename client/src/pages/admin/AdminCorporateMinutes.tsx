import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, FileText, Mail, Paperclip, Plus, Printer, Save, Search, Trash2 } from "lucide-react";

type MeetingForm = {
  id?: number;
  title: string;
  meetingDate: string;
  meetingType: string;
  participantsText: string;
  description: string;
  decisionsText: string;
  status: "rascunho" | "registrada" | "em_acompanhamento" | "concluida";
};

const emptyForm = (): MeetingForm => ({
  title: "",
  meetingDate: new Date().toISOString().slice(0, 10),
  meetingType: "Reuniao geral",
  participantsText: "",
  description: "",
  decisionsText: "",
  status: "registrada",
});

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AdminCorporateMinutes() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todos");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<MeetingForm>(emptyForm());
  const [actionText, setActionText] = useState("");
  const [actionResponsible, setActionResponsible] = useState("");
  const [actionDue, setActionDue] = useState("");
  const [shareEmails, setShareEmails] = useState("");

  const listQ = (trpc.corporateMinutes as any).list.useQuery({ search, status });
  const dashQ = (trpc.corporateMinutes as any).dashboard.useQuery();
  const detailQ = (trpc.corporateMinutes as any).get.useQuery({ id: selectedId ?? 0 }, { enabled: !!selectedId });
  const detail = detailQ.data as any;
  const meetings = (listQ.data ?? []) as any[];

  useEffect(() => {
    if (!detail) return;
    setForm({
      id: detail.id,
      title: detail.title ?? "",
      meetingDate: String(detail.meeting_date ?? "").slice(0, 10),
      meetingType: detail.meeting_type ?? "",
      participantsText: detail.participants_text ?? "",
      description: detail.description ?? "",
      decisionsText: detail.decisions_text ?? "",
      status: detail.status ?? "registrada",
    });
  }, [detail]);

  const upsert = (trpc.corporateMinutes as any).upsert.useMutation({
    onSuccess: (r: any) => {
      toast.success("Ata salva.");
      setSelectedId(r.id);
      listQ.refetch();
      detailQ.refetch();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar ata."),
  });
  const remove = (trpc.corporateMinutes as any).remove.useMutation({
    onSuccess: () => {
      toast.success("Ata removida.");
      setSelectedId(null);
      setForm(emptyForm());
      listQ.refetch();
      dashQ.refetch();
    },
  });
  const upsertAction = (trpc.corporateMinutes as any).upsertAction.useMutation({
    onSuccess: () => {
      setActionText("");
      setActionResponsible("");
      setActionDue("");
      detailQ.refetch();
      dashQ.refetch();
      toast.success("Acao registrada.");
    },
  });
  const removeAction = (trpc.corporateMinutes as any).removeAction.useMutation({ onSuccess: () => detailQ.refetch() });
  const addAttachment = (trpc.corporateMinutes as any).addAttachment.useMutation({
    onSuccess: () => {
      detailQ.refetch();
      dashQ.refetch();
      toast.success("Anexo enviado.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro no anexo."),
  });
  const removeAttachment = (trpc.corporateMinutes as any).removeAttachment.useMutation({ onSuccess: () => detailQ.refetch() });
  const generatePdf = (trpc.corporateMinutes as any).generatePdf.useMutation({
    onSuccess: (r: any) => {
      toast.success("PDF gerado.");
      if (r?.url) window.open(r.url, "_blank");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao gerar PDF."),
  });
  const share = (trpc.corporateMinutes as any).shareByEmail.useMutation({
    onSuccess: (r: any) => toast.success(`Compartilhado com ${r.sent} destinatario(s).`),
    onError: (e: any) => toast.error(e.message ?? "Erro ao compartilhar."),
  });

  const cards = useMemo(() => {
    const d = dashQ.data as any;
    return [
      ["Atas", d?.meetings ?? 0],
      ["Acoes pendentes", d?.pendingActions ?? 0],
      ["Acoes vencidas", d?.overdueActions ?? 0],
      ["Anexos", d?.attachments ?? 0],
    ];
  }, [dashQ.data]);

  function saveMeeting() {
    if (!form.title.trim()) return toast.error("Informe o titulo da ata.");
    upsert.mutate({
      id: form.id,
      title: form.title,
      meetingDate: form.meetingDate,
      meetingType: form.meetingType || undefined,
      participantsText: form.participantsText || undefined,
      description: form.description || undefined,
      decisionsText: form.decisionsText || undefined,
      status: form.status,
    });
  }

  async function uploadFile(file: File, kind: string) {
    if (!selectedId) return toast.error("Salve ou selecione uma ata antes de anexar.");
    const fileBase64 = await readAsDataUrl(file);
    addAttachment.mutate({ meetingId: selectedId, kind, fileName: file.name, mimeType: file.type, fileBase64 });
  }

  function selectMeeting(m: any) {
    setSelectedId(Number(m.id));
  }

  function newMeeting() {
    setSelectedId(null);
    setForm(emptyForm());
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6 space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><FileText size={22} className="text-blue-700" /> Atas Corporativas</h1>
            <p className="text-sm text-muted-foreground">Registro, evidencias, plano de acao, PDF e compartilhamento de reunioes corporativas.</p>
          </div>
          <Button onClick={newMeeting} className="gap-2"><Plus size={16} /> Nova ata</Button>
        </header>

        <div className="grid sm:grid-cols-4 gap-3">
          {cards.map(([label, value]) => (
            <div key={label} className="border bg-white rounded-lg p-4">
              <div className="text-xs text-slate-500">{label}</div>
              <div className="text-2xl font-bold">{String(value)}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-[360px_1fr] gap-4">
          <aside className="bg-white border rounded-lg overflow-hidden">
            <div className="p-3 border-b space-y-2">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar ata" className="pl-9" />
              </div>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border rounded px-2 py-2 text-sm bg-white">
                <option value="todos">Todos os status</option>
                <option value="rascunho">Rascunho</option>
                <option value="registrada">Registrada</option>
                <option value="em_acompanhamento">Em acompanhamento</option>
                <option value="concluida">Concluida</option>
              </select>
            </div>
            <div className="max-h-[720px] overflow-y-auto">
              {meetings.map((m) => (
                <button key={m.id} onClick={() => selectMeeting(m)} className={`w-full text-left p-3 border-b hover:bg-slate-50 ${selectedId === Number(m.id) ? "bg-blue-50" : ""}`}>
                  <div className="font-semibold text-sm line-clamp-1">{m.title}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-1 mt-1"><CalendarDays size={12} /> {String(m.meeting_date ?? "").slice(0, 10)}</div>
                  <div className="text-[11px] text-slate-500 mt-1">{m.actions_count ?? 0} acao(oes) · {m.attachments_count ?? 0} anexo(s)</div>
                  {Number(m.overdue_count ?? 0) > 0 && <div className="text-[11px] text-rose-600 font-semibold mt-1">{m.overdue_count} acao(oes) vencida(s)</div>}
                </button>
              ))}
              {meetings.length === 0 && <div className="p-5 text-sm text-slate-500">Nenhuma ata encontrada.</div>}
            </div>
          </aside>

          <main className="space-y-4">
            <section className="bg-white border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold">{form.id ? "Editar ata" : "Nova ata"}</h2>
                <div className="flex gap-2">
                  {form.id && <Button variant="outline" size="sm" onClick={() => generatePdf.mutate({ id: form.id })} className="gap-1"><Printer size={14} /> PDF</Button>}
                  {form.id && <Button variant="outline" size="sm" onClick={() => { if (confirm("Remover ata?")) remove.mutate({ id: form.id }); }} className="gap-1 text-rose-600"><Trash2 size={14} /> Excluir</Button>}
                  <Button size="sm" onClick={saveMeeting} className="gap-1"><Save size={14} /> Salvar</Button>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-3">
                <label className="md:col-span-2 text-sm font-medium">Titulo
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Reuniao de acompanhamento do plano de acao" />
                </label>
                <label className="text-sm font-medium">Data
                  <Input type="date" value={form.meetingDate} onChange={(e) => setForm({ ...form, meetingDate: e.target.value })} />
                </label>
                <label className="text-sm font-medium">Tipo
                  <Input value={form.meetingType} onChange={(e) => setForm({ ...form, meetingType: e.target.value })} placeholder="RH, SESMT, Diretoria..." />
                </label>
                <label className="text-sm font-medium">Status
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as MeetingForm["status"] })} className="w-full border rounded px-2 py-2 bg-white">
                    <option value="rascunho">Rascunho</option>
                    <option value="registrada">Registrada</option>
                    <option value="em_acompanhamento">Em acompanhamento</option>
                    <option value="concluida">Concluida</option>
                  </select>
                </label>
                <label className="text-sm font-medium">Compartilhar por e-mail
                  <div className="flex gap-2">
                    <Input value={shareEmails} onChange={(e) => setShareEmails(e.target.value)} placeholder="email1@empresa.com; email2@empresa.com" />
                    <Button type="button" variant="outline" disabled={!form.id} onClick={() => share.mutate({ id: form.id, emails: shareEmails.split(/[;,]/).map((x) => x.trim()).filter(Boolean) })}><Mail size={14} /></Button>
                  </div>
                </label>
              </div>

              <label className="text-sm font-medium block">Participantes
                <Textarea value={form.participantsText} onChange={(e) => setForm({ ...form, participantsText: e.target.value })} rows={3} placeholder="Nome, cargo, area..." />
              </label>
              <label className="text-sm font-medium block">Descricao da reuniao
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} />
              </label>
              <label className="text-sm font-medium block">Decisoes e deliberacoes
                <Textarea value={form.decisionsText} onChange={(e) => setForm({ ...form, decisionsText: e.target.value })} rows={4} />
              </label>
            </section>

            {form.id && (
              <section className="grid lg:grid-cols-2 gap-4">
                <div className="bg-white border rounded-lg p-4 space-y-3">
                  <h3 className="font-bold">Plano de acao</h3>
                  <div className="grid gap-2">
                    <Textarea value={actionText} onChange={(e) => setActionText(e.target.value)} rows={2} placeholder="Acao, decisao ou pendencia" />
                    <div className="grid sm:grid-cols-[1fr_150px_auto] gap-2">
                      <Input value={actionResponsible} onChange={(e) => setActionResponsible(e.target.value)} placeholder="Responsavel" />
                      <Input type="date" value={actionDue} onChange={(e) => setActionDue(e.target.value)} />
                      <Button onClick={() => upsertAction.mutate({ meetingId: form.id, description: actionText, responsibleName: actionResponsible, dueDate: actionDue || undefined })}>Adicionar</Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {(detail?.actions ?? []).map((a: any) => (
                      <div key={a.id} className="border rounded p-3 text-sm">
                        <div className="flex justify-between gap-2">
                          <b>{a.description}</b>
                          <button onClick={() => removeAction.mutate({ id: a.id })} className="text-rose-600"><Trash2 size={14} /></button>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">{a.responsible_name || "Sem responsavel"} · {a.due_date ? String(a.due_date).slice(0, 10) : "Sem prazo"} · {a.status}</div>
                        {a.status !== "concluida" && <Button variant="outline" size="sm" className="mt-2" onClick={() => upsertAction.mutate({ id: a.id, meetingId: form.id, description: a.description, responsibleName: a.responsible_name || "", dueDate: a.due_date ? String(a.due_date).slice(0, 10) : undefined, status: "concluida" })}>Marcar concluida</Button>}
                      </div>
                    ))}
                    {(detail?.actions ?? []).length === 0 && <p className="text-sm text-slate-500">Nenhuma acao registrada.</p>}
                  </div>
                </div>

                <div className="bg-white border rounded-lg p-4 space-y-3">
                  <h3 className="font-bold">Anexos e evidencias</h3>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {["ata_assinada", "lista_presenca", "fotografia", "evidencia", "plano_acao", "documento"].map((kind) => (
                      <label key={kind} className="border rounded px-3 py-2 text-sm flex items-center gap-2 cursor-pointer hover:bg-slate-50">
                        <Paperclip size={14} /> {kind === "ata_assinada" ? "Ata impressa com assinaturas" : kind.replaceAll("_", " ")}
                        <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f, kind); e.currentTarget.value = ""; }} />
                      </label>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {(detail?.attachments ?? []).map((a: any) => (
                      <div key={a.id} className="border rounded p-3 text-sm flex items-center justify-between gap-3">
                        <a href={a.file_url} target="_blank" className="min-w-0 hover:underline">
                          <b className="block truncate">{a.title || a.file_name}</b>
                          <span className="text-xs text-slate-500">{a.kind} · {a.mime_type}</span>
                        </a>
                        <button onClick={() => removeAttachment.mutate({ id: a.id })} className="text-rose-600"><Trash2 size={14} /></button>
                      </div>
                    ))}
                    {(detail?.attachments ?? []).length === 0 && <p className="text-sm text-slate-500">Nenhum anexo registrado.</p>}
                  </div>
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    </AppLayout>
  );
}
