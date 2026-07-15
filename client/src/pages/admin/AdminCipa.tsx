import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Users, Vote, Calendar, Plus, Save, Trash2, Loader2, ShieldCheck, BarChart3, User as UserIcon, Camera, Radio, FileText, Upload, Pencil, BookOpen } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

/**
 * P15 #4 — Gestão da CIPA (Comissão Interna de Prevenção de Acidentes).
 * Eleições com voto secreto + evidência de participação, apuração automática,
 * gestão de mandato, reuniões/atas e indicadores.
 */
export default function AdminCipa() {
  const { user } = useAuth();
  // Configurar eleição é responsabilidade do RH — Integrante da CIPA não tem essa aba.
  const canManageElections = ["admin", "rh", "admin_global", "company_admin", "super_admin", "sesmt"].includes(user?.role ?? "");
  const [tab, setTab] = useState<"eleicoes" | "membros" | "reunioes" | "indicadores" | "capacitacao">(canManageElections ? "eleicoes" : "reunioes");

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <header>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck size={22} className="text-emerald-600" /> CIPA — Comissão Interna de Prevenção de Acidentes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Eleições, mandato, reuniões e indicadores da comissão.</p>
        </header>

        <div className="flex gap-1 border-b">
          {([
            ...(canManageElections ? [["eleicoes", "Eleições", Vote]] as const : []),
            ["membros", "Integrantes", Users],
            ["reunioes", "Reuniões & Atas", Calendar],
            ["capacitacao", "Capacitação", BookOpen],
            ["indicadores", "Indicadores", BarChart3],
          ] as const).map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k as any)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              <span className="inline-flex items-center gap-1.5"><Icon size={14} /> {label}</span>
            </button>
          ))}
        </div>

        {tab === "eleicoes" && <ElectionsTab />}
        {tab === "membros" && <MembersTab />}
        {tab === "reunioes" && <MeetingsTab />}
        {tab === "capacitacao" && <TrainingTab />}
        {tab === "indicadores" && <IndicatorsTab />}
      </div>
    </AppLayout>
  );
}

function ElectionsTab() {
  const listQ = (trpc.cipa as any).listElections.useQuery();
  const elections = (listQ.data ?? []) as any[];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = elections.find(e => e.id === selectedId) ?? null;

  const upsertMut = (trpc.cipa as any).upsertElection.useMutation({
    onSuccess: () => { toast.success("Eleição salva."); listQ.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const apurarMut = (trpc.cipa as any).apurar.useMutation({
    onSuccess: (r: any) => { toast.success(`Apurada: ${r.titulares} titulares, ${r.suplentes} suplentes.`); listQ.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const [form, setForm] = useState({
    name: "", seatsTitular: 3, seatsSuplente: 3, mandateMonths: 12,
    inscriptionStart: "", inscriptionEnd: "", votingStart: "", votingEnd: "", tieBreakNote: "",
  });

  function loadElection(e: any) {
    setSelectedId(e.id);
    setForm({
      name: e.name, seatsTitular: e.seats_titular, seatsSuplente: e.seats_suplente, mandateMonths: e.mandate_months,
      inscriptionStart: e.inscription_start?.slice(0, 10) ?? "", inscriptionEnd: e.inscription_end?.slice(0, 10) ?? "",
      votingStart: e.voting_start?.slice(0, 10) ?? "", votingEnd: e.voting_end?.slice(0, 10) ?? "",
      tieBreakNote: e.tie_break_note ?? "",
    });
  }

  function save(status?: string) {
    upsertMut.mutate({ id: selectedId ?? undefined, ...form, status });
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex gap-3 items-end">
        <select value={selectedId ?? ""} onChange={e => { const el = elections.find(x => x.id === Number(e.target.value)); if (el) loadElection(el); }}
          className="border rounded px-3 py-2 text-sm bg-white min-w-[280px]">
          <option value="">— selecione uma eleição —</option>
          {elections.map(e => <option key={e.id} value={e.id}>{e.name} ({e.status})</option>)}
        </select>
        <button onClick={() => { setSelectedId(null); setForm({ name: "", seatsTitular: 3, seatsSuplente: 3, mandateMonths: 12, inscriptionStart: "", inscriptionEnd: "", votingStart: "", votingEnd: "", tieBreakNote: "" }); }}
          className="px-3 py-2 border border-emerald-500 text-emerald-600 hover:bg-emerald-50 rounded text-sm flex items-center gap-1">
          <Plus size={14} /> Nova eleição
        </button>
      </div>

      <div className="bg-white border rounded-xl p-5 space-y-3">
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <L l="Nome da eleição"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Eleição CIPA 2027" className="w-full border rounded px-2 py-1.5" /></L>
          <L l="Mandato (meses)"><input type="number" min={1} value={form.mandateMonths} onChange={e => setForm({ ...form, mandateMonths: Number(e.target.value || 12) })} className="w-full border rounded px-2 py-1.5" /></L>
          <L l="Vagas titulares"><input type="number" min={1} value={form.seatsTitular} onChange={e => setForm({ ...form, seatsTitular: Number(e.target.value || 1) })} className="w-full border rounded px-2 py-1.5" /></L>
          <L l="Vagas suplentes"><input type="number" min={0} value={form.seatsSuplente} onChange={e => setForm({ ...form, seatsSuplente: Number(e.target.value || 0) })} className="w-full border rounded px-2 py-1.5" /></L>
          <L l="Inscrições — início"><input type="date" value={form.inscriptionStart} onChange={e => setForm({ ...form, inscriptionStart: e.target.value })} className="w-full border rounded px-2 py-1.5" /></L>
          <L l="Inscrições — fim"><input type="date" value={form.inscriptionEnd} onChange={e => setForm({ ...form, inscriptionEnd: e.target.value })} className="w-full border rounded px-2 py-1.5" /></L>
          <L l="Votação — início"><input type="date" value={form.votingStart} onChange={e => setForm({ ...form, votingStart: e.target.value })} className="w-full border rounded px-2 py-1.5" /></L>
          <L l="Votação — fim"><input type="date" value={form.votingEnd} onChange={e => setForm({ ...form, votingEnd: e.target.value })} className="w-full border rounded px-2 py-1.5" /></L>
          <div className="sm:col-span-2"><L l="Critério de desempate"><input value={form.tieBreakNote} onChange={e => setForm({ ...form, tieBreakNote: e.target.value })} placeholder="Ex.: maior tempo de empresa" className="w-full border rounded px-2 py-1.5" /></L></div>
        </div>
        <div className="flex justify-between items-center pt-2 border-t">
          <span className="text-xs text-slate-500">Status atual: <b>{selected?.status ?? "rascunho (nova)"}</b></span>
          <div className="flex gap-2">
            <button onClick={() => save()} disabled={upsertMut.isPending} className="px-3 py-1.5 border rounded text-sm font-semibold flex items-center gap-1"><Save size={13} /> Salvar</button>
            {selected && selected.status === "rascunho" && <button onClick={() => save("inscricoes_abertas")} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-semibold">Abrir inscrições</button>}
            {selected && ["rascunho", "inscricoes_abertas"].includes(selected.status) && <button onClick={() => save("votacao_aberta")} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-sm font-semibold">Abrir votação</button>}
            {selected && selected.status === "votacao_aberta" && (
              <button onClick={() => { if (confirm("Apurar a eleição? Isso encerra a votação e define os eleitos.")) apurarMut.mutate({ electionId: selected.id }); }} disabled={apurarMut.isPending} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm font-semibold flex items-center gap-1">
                {apurarMut.isPending ? <Loader2 size={13} className="animate-spin" /> : null} Apurar eleição
              </button>
            )}
          </div>
        </div>
      </div>

      {selected && selected.status === "votacao_aberta" && <LiveParticipationPanel electionId={selected.id} />}
      {selected && <CandidatesPanel electionId={selected.id} />}
      {selected && ["apurada", "encerrada"].includes(selected.status) && <ResultsPanel electionId={selected.id} />}
    </div>
  );
}

// P18 GRANDE — monitoramento AO VIVO da votação: só turnout (não revela em quem
// votaram, preservando o sigilo até a apuração). Atualiza sozinho a cada 10s.
function LiveParticipationPanel({ electionId }: { electionId: number }) {
  const q = (trpc.cipa as any).liveParticipation.useQuery({ electionId }, { refetchInterval: 10_000 });
  const d = q.data as any;
  if (!d) return null;
  return (
    <div className="bg-white border rounded-xl p-5">
      <h3 className="font-bold mb-3 flex items-center gap-2"><Radio size={16} className="text-rose-500 animate-pulse" /> Apuração ao vivo — participação</h3>
      <div className="flex items-center gap-4">
        <div className="text-3xl font-bold text-emerald-600">{d.pct}%</div>
        <div className="flex-1">
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, d.pct)}%` }} />
          </div>
          <p className="text-xs text-slate-500 mt-1">{d.totalVotaram} de {d.totalElegiveis} colaborador(es) já votaram</p>
        </div>
      </div>
      <p className="text-[10px] text-slate-400 mt-2">Por sigilo, os votos por candidato só ficam visíveis após a apuração.</p>
    </div>
  );
}

function CandidatesPanel({ electionId }: { electionId: number }) {
  const q = (trpc.cipa as any).listCandidates.useQuery({ electionId });
  const cands = (q.data ?? []) as any[];
  const upMut = (trpc.cipa as any).upsertCandidate.useMutation({ onSuccess: () => { q.refetch(); toast.success("Candidato salvo."); setOpen(false); setEditing(null); } });
  const delMut = (trpc.cipa as any).removeCandidate.useMutation({ onSuccess: () => q.refetch() });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  return (
    <div className="bg-white border rounded-xl p-5">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold">Candidatos</h3>
        <button onClick={() => { setEditing(null); setOpen(true); }} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm font-semibold flex items-center gap-1"><Plus size={13} /> Novo candidato</button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
        {cands.map((c: any) => (
          <div key={c.id} className="border rounded-xl p-3 flex gap-3">
            {c.photo_url ? (
              <img src={c.photo_url} alt={c.name} className="w-14 h-14 rounded-lg object-cover shrink-0 bg-slate-100" />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><UserIcon size={22} className="text-slate-300" /></div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 flex-wrap">
                <b className="text-sm">{c.name}</b>
                {c.chapa && <span className="text-[10px] uppercase bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">Chapa {c.chapa}</span>}
              </div>
              {c.cargo && <p className="text-xs text-slate-500">{c.cargo}</p>}
              {c.sector_name && <p className="text-[10px] text-slate-400">{c.sector_name}</p>}
              <div className="flex gap-2 mt-1">
                <button onClick={() => { setEditing(c); setOpen(true); }} className="text-[11px] text-blue-600 hover:underline">Editar</button>
                <button onClick={() => { if (confirm("Remover candidato?")) delMut.mutate({ id: c.id }); }} className="text-[11px] text-rose-500 hover:underline">Remover</button>
              </div>
            </div>
          </div>
        ))}
        {cands.length === 0 && <p className="text-sm text-slate-400 col-span-full">Nenhum candidato cadastrado.</p>}
      </div>
      {open && <CandidateForm electionId={electionId} initial={editing} onClose={() => { setOpen(false); setEditing(null); }} onSubmit={(d: any) => upMut.mutate(d)} />}
    </div>
  );
}

function CandidateForm({ electionId, initial, onClose, onSubmit }: any) {
  const uploadMut = (trpc.cipa as any).uploadCandidatePhoto.useMutation();
  const [f, setF] = useState({
    id: initial?.id, electionId, name: initial?.name ?? "", cargo: initial?.cargo ?? "",
    chapa: initial?.chapa ?? "", pitch: initial?.pitch ?? "", photoUrl: initial?.photo_url ?? "",
  });
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (file.size > 200_000) return toast.error("Imagem muito grande (máx. 200KB).");
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const r: any = await uploadMut.mutateAsync({ imageBase64: reader.result as string });
        setF(prev => ({ ...prev, photoUrl: r.url }));
      } catch (e: any) { toast.error(e?.message ?? "Erro no upload"); }
      setUploading(false);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-3 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">{initial ? "Editar" : "Novo"} candidato</h3>
        <div className="flex items-center gap-3">
          {f.photoUrl ? (
            <img src={f.photoUrl} alt="" className="w-16 h-16 rounded-lg object-cover bg-slate-100" />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center"><UserIcon size={24} className="text-slate-300" /></div>
          )}
          <label className="px-3 py-1.5 border rounded text-xs font-semibold flex items-center gap-1 cursor-pointer hover:bg-slate-50">
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />} {f.photoUrl ? "Trocar foto" : "Enviar foto"}
            <input type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) handleFile(file); }} />
          </label>
        </div>
        <L l="Nome *"><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className="w-full border rounded px-2 py-1.5" /></L>
        <div className="grid grid-cols-2 gap-3">
          <L l="Cargo"><input value={f.cargo} onChange={e => setF({ ...f, cargo: e.target.value })} placeholder="Ex.: Operador de produção" className="w-full border rounded px-2 py-1.5" /></L>
          <L l="Chapa"><input value={f.chapa} onChange={e => setF({ ...f, chapa: e.target.value })} placeholder="Ex.: 1" className="w-full border rounded px-2 py-1.5" /></L>
        </div>
        <L l="Proposta"><textarea value={f.pitch} onChange={e => setF({ ...f, pitch: e.target.value })} rows={3} className="w-full border rounded px-2 py-1.5" /></L>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <button onClick={onClose} className="px-3 py-1.5 border rounded text-sm">Cancelar</button>
          <button onClick={() => { if (!f.name.trim()) return toast.error("Nome obrigatório"); onSubmit(f); }} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm font-semibold flex items-center gap-1"><Save size={13} /> Salvar</button>
        </div>
      </div>
    </div>
  );
}

function ResultsPanel({ electionId }: { electionId: number }) {
  const q = (trpc.cipa as any).results.useQuery({ electionId });
  const d = q.data as any;
  if (!d || !d.released) return null;
  const chartData = d.candidates.map((c: any) => ({ name: c.name, votos: c.votes, pct: c.pct }));
  return (
    <div className="bg-white border rounded-xl p-5">
      <h3 className="font-bold mb-2">Resultado da apuração</h3>
      <p className="text-xs text-slate-500 mb-3">{d.totalVoters} votantes · {d.totalVotes} votos apurados</p>
      <div style={{ width: "100%", height: Math.max(140, chartData.length * 42) }}>
        <ResponsiveContainer>
          <BarChart data={chartData} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: any, n: any, p: any) => [`${v} votos (${p.payload.pct}%)`, ""]} />
            <Bar dataKey="votos" radius={[0, 4, 4, 0]}>
              {chartData.map((_: any, i: number) => <Cell key={i} fill={i < 3 ? "#10b981" : "#94a3b8"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function MembersTab() {
  const q = (trpc.cipa as any).listMembers.useQuery();
  const members = (q.data ?? []) as any[];
  const endMut = (trpc.cipa as any).encerrarMandatoMembro.useMutation({ onSuccess: () => { q.refetch(); toast.success("Mandato encerrado."); } });
  const linkMut = (trpc.cipa as any).linkMemberToUser.useMutation({ onSuccess: () => { q.refetch(); toast.success("Acesso concedido (perfil Integrante da CIPA)."); }, onError: (e: any) => toast.error(e?.message ?? "Erro") });
  const [linking, setLinking] = useState<number | null>(null);
  const [userId, setUserId] = useState("");
  return (
    <div className="mt-4 bg-white border rounded-xl p-5">
      <h3 className="font-bold mb-3">Integrantes ativos</h3>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left"><tr><th className="p-2">Nome</th><th className="p-2">Papel</th><th className="p-2">Mandato até</th><th className="p-2">Acesso</th><th className="p-2"></th></tr></thead>
        <tbody>
          {members.map((m: any) => (
            <tr key={m.id} className="border-t">
              <td className="p-2">{m.name}</td>
              <td className="p-2 capitalize">{m.role}</td>
              <td className="p-2">{m.mandate_end?.slice(0, 10) ?? "—"}</td>
              <td className="p-2">
                {m.user_id ? <span className="text-emerald-700 text-xs">✓ vinculado</span> : (
                  linking === m.id ? (
                    <div className="flex gap-1">
                      <input value={userId} onChange={e => setUserId(e.target.value)} placeholder="ID do usuário" className="border rounded px-1.5 py-1 text-xs w-24" />
                      <button onClick={() => { if (userId) linkMut.mutate({ memberId: m.id, userId: Number(userId) }); setLinking(null); setUserId(""); }} className="text-xs text-blue-600">Salvar</button>
                    </div>
                  ) : <button onClick={() => setLinking(m.id)} className="text-xs text-blue-600 hover:underline">Vincular usuário</button>
                )}
              </td>
              <td className="p-2"><button onClick={() => { if (confirm("Encerrar mandato deste integrante?")) endMut.mutate({ memberId: m.id }); }} className="text-rose-500 text-xs hover:underline">Encerrar</button></td>
            </tr>
          ))}
          {members.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-400">Nenhum integrante ativo. Apure uma eleição para popular a comissão.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function MeetingsTab() {
  const q = (trpc.cipa as any).listMeetings.useQuery();
  const meetings = (q.data ?? []) as any[];
  const emptyForm = { id: undefined as number | undefined, meetingDate: "", title: "", participantsText: "", pauta: "", ataText: "", actionPlanText: "" };
  const [form, setForm] = useState(emptyForm);
  const [attachKind, setAttachKind] = useState<Record<number, string>>({});
  const upMut = (trpc.cipa as any).upsertMeeting.useMutation({
    onSuccess: () => {
      q.refetch();
      toast.success(form.id ? "Reunião atualizada." : "Reunião registrada.");
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar reunião."),
  });
  const delMut = (trpc.cipa as any).removeMeeting.useMutation({
    onSuccess: () => { q.refetch(); toast.success("Reunião excluída."); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir reunião."),
  });
  const pdfMut = (trpc.cipa as any).generateMeetingPdf.useMutation({
    onSuccess: (r: any) => {
      if (r?.url) window.open(r.url, "_blank");
      toast.success("PDF da reunião gerado.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao gerar PDF."),
  });
  const attachMut = (trpc.cipa as any).addMeetingAttachment.useMutation({
    onSuccess: () => { q.refetch(); toast.success("Anexo registrado."); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao anexar arquivo."),
  });

  function loadMeeting(m: any) {
    setForm({
      id: m.id,
      meetingDate: m.meeting_date?.slice(0, 10) ?? "",
      title: m.title ?? "",
      participantsText: m.participants_text ?? "",
      pauta: m.pauta ?? "",
      ataText: m.ata_text ?? "",
      actionPlanText: m.action_plan_text ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function readFile(file: File, cb: (dataUrl: string) => void) {
    const reader = new FileReader();
    reader.onload = () => cb(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="bg-white border rounded-xl p-5 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold mb-1">{form.id ? "Editar reunião" : "Nova reunião"}</h3>
          {form.id && <button onClick={() => setForm(emptyForm)} className="text-xs text-slate-500 hover:text-slate-700">Cancelar edição</button>}
        </div>
        <div className="grid sm:grid-cols-2 gap-2 text-sm">
          <L l="Data"><input type="date" value={form.meetingDate} onChange={e => setForm({ ...form, meetingDate: e.target.value })} className="w-full border rounded px-2 py-1.5" /></L>
          <L l="Título"><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full border rounded px-2 py-1.5" /></L>
          <L l="Participantes"><input value={form.participantsText} onChange={e => setForm({ ...form, participantsText: e.target.value })} className="w-full border rounded px-2 py-1.5" /></L>
          <L l="Pauta"><input value={form.pauta} onChange={e => setForm({ ...form, pauta: e.target.value })} className="w-full border rounded px-2 py-1.5" /></L>
        </div>
        <L l="Ata e deliberações"><textarea value={form.ataText} onChange={e => setForm({ ...form, ataText: e.target.value })} rows={4} className="w-full border rounded px-2 py-1.5" /></L>
        <L l="Plano de ação da reunião"><textarea value={form.actionPlanText} onChange={e => setForm({ ...form, actionPlanText: e.target.value })} rows={3} className="w-full border rounded px-2 py-1.5" /></L>
        <div className="flex justify-end">
          <button onClick={() => { if (!form.meetingDate || !form.title) return toast.error("Data e título obrigatórios"); upMut.mutate(form); }} disabled={upMut.isPending} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded text-sm font-semibold flex items-center gap-1">
            {upMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} {form.id ? "Salvar alterações" : "Registrar reunião"}
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {meetings.map((m: any) => {
          const attachments = (m.attachments ?? []) as any[];
          return (
            <div key={m.id} className="bg-white border rounded-lg p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <b className="text-sm">{m.title}</b>
                  <p className="text-xs text-slate-500">{m.meeting_date?.slice(0, 10)} · {attachments.length} anexo(s)</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => loadMeeting(m)} className="px-2.5 py-1 border rounded text-xs font-semibold flex items-center gap-1 hover:bg-slate-50"><Pencil size={12} /> Editar</button>
                  <button onClick={() => pdfMut.mutate({ id: m.id })} disabled={pdfMut.isPending} className="px-2.5 py-1 border rounded text-xs font-semibold flex items-center gap-1 hover:bg-slate-50"><FileText size={12} /> PDF</button>
                  <button onClick={() => { if (confirm("Excluir esta reunião e seus anexos?")) delMut.mutate({ id: m.id }); }} disabled={delMut.isPending} className="px-2.5 py-1 border border-rose-200 text-rose-600 rounded text-xs font-semibold flex items-center gap-1 hover:bg-rose-50"><Trash2 size={12} /> Excluir</button>
                </div>
              </div>
              {m.pauta && <p className="text-xs text-slate-500"><b>Pauta:</b> {m.pauta}</p>}
              {m.ata_text && <p className="text-xs text-slate-600 whitespace-pre-wrap">{m.ata_text}</p>}
              {m.action_plan_text && <p className="text-xs text-emerald-700 whitespace-pre-wrap"><b>Plano de ação:</b> {m.action_plan_text}</p>}
              <div className="border-t pt-3 space-y-2">
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <select value={attachKind[m.id] ?? "documento"} onChange={e => setAttachKind(prev => ({ ...prev, [m.id]: e.target.value }))} className="border rounded px-2 py-1.5 text-xs bg-white">
                    <option value="lista_presenca">Lista de presença</option>
                    <option value="fotografia">Fotografia</option>
                    <option value="evidencia">Evidência</option>
                    <option value="plano_acao">Plano de ação</option>
                    <option value="documento">Documento</option>
                  </select>
                  <label className="px-2.5 py-1.5 border rounded text-xs font-semibold flex items-center gap-1 cursor-pointer hover:bg-slate-50 w-fit">
                    {attachMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} Anexar arquivo
                    <input type="file" className="hidden" onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 8_000_000) return toast.error("Arquivo maior que 8MB.");
                      readFile(file, fileBase64 => attachMut.mutate({ meetingId: m.id, kind: attachKind[m.id] ?? "documento", title: file.name, fileName: file.name, mimeType: file.type, fileBase64 }));
                      e.currentTarget.value = "";
                    }} />
                  </label>
                </div>
                {attachments.length > 0 && (
                  <div className="grid sm:grid-cols-2 gap-2">
                    {attachments.map((a: any) => (
                      <a key={a.id} href={a.file_url} target="_blank" rel="noreferrer" className="text-xs border rounded px-2 py-1.5 hover:bg-slate-50 flex items-center gap-2 min-w-0">
                        <FileText size={12} className="shrink-0 text-emerald-600" />
                        <span className="truncate">{a.title || a.file_name || a.kind}</span>
                        <span className="text-[10px] text-slate-400 ml-auto">{a.kind}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {meetings.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Nenhuma reunião registrada.</p>}
      </div>
    </div>
  );
}

function LegacyMeetingsTab() {
  const q = (trpc.cipa as any).listMeetings.useQuery();
  const meetings = (q.data ?? []) as any[];
  const upMut = (trpc.cipa as any).upsertMeeting.useMutation({ onSuccess: () => { q.refetch(); toast.success("Reunião registrada."); setForm({ meetingDate: "", title: "", participantsText: "", pauta: "", ataText: "" }); } });
  const [form, setForm] = useState({ meetingDate: "", title: "", participantsText: "", pauta: "", ataText: "" });
  return (
    <div className="mt-4 space-y-4">
      <div className="bg-white border rounded-xl p-5 space-y-2">
        <h3 className="font-bold mb-1">Nova reunião</h3>
        <div className="grid sm:grid-cols-2 gap-2 text-sm">
          <L l="Data"><input type="date" value={form.meetingDate} onChange={e => setForm({ ...form, meetingDate: e.target.value })} className="w-full border rounded px-2 py-1.5" /></L>
          <L l="Título"><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full border rounded px-2 py-1.5" /></L>
          <L l="Participantes"><input value={form.participantsText} onChange={e => setForm({ ...form, participantsText: e.target.value })} className="w-full border rounded px-2 py-1.5" /></L>
          <L l="Pauta"><input value={form.pauta} onChange={e => setForm({ ...form, pauta: e.target.value })} className="w-full border rounded px-2 py-1.5" /></L>
        </div>
        <L l="Ata (assuntos discutidos, decisões, plano de ação)"><textarea value={form.ataText} onChange={e => setForm({ ...form, ataText: e.target.value })} rows={4} className="w-full border rounded px-2 py-1.5" /></L>
        <div className="flex justify-end"><button onClick={() => { if (!form.meetingDate || !form.title) return toast.error("Data e título obrigatórios"); upMut.mutate(form); }} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm font-semibold flex items-center gap-1"><Save size={13} /> Registrar reunião</button></div>
      </div>
      <div className="space-y-2">
        {meetings.map((m: any) => (
          <div key={m.id} className="bg-white border rounded-lg p-3">
            <div className="flex justify-between"><b className="text-sm">{m.title}</b><span className="text-xs text-slate-500">{m.meeting_date?.slice(0, 10)}</span></div>
            {m.ata_text && <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{m.ata_text}</p>}
          </div>
        ))}
        {meetings.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Nenhuma reunião registrada.</p>}
      </div>
    </div>
  );
}

function TrainingTab() {
  const q = (trpc.cipaTraining as any).listAdmin.useQuery();
  const coursesQ = (trpc.cipaTraining as any).courseOptions.useQuery();
  const items = (q.data ?? []) as any[];
  const courses = (coursesQ.data ?? []) as any[];
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ id: undefined as number | undefined, contentType: "course", moduleId: "", title: "", description: "", url: "", fileName: "", provider: "", isRequired: true, orderIndex: 0 });
  const upMut = (trpc.cipaTraining as any).upsert.useMutation({ onSuccess: () => { q.refetch(); toast.success("Conteúdo salvo."); setEditing(null); reset(); }, onError: (e: any) => toast.error(e?.message ?? "Erro") });
  const delMut = (trpc.cipaTraining as any).remove.useMutation({ onSuccess: () => { q.refetch(); toast.success("Conteúdo removido."); } });
  function reset() { setForm({ id: undefined, contentType: "course", moduleId: "", title: "", description: "", url: "", fileName: "", provider: "", isRequired: true, orderIndex: 0 }); }
  function edit(it: any) {
    setEditing(it);
    setForm({ id: it.id, contentType: it.contentType, moduleId: it.moduleId ? String(it.moduleId) : "", title: it.title ?? "", description: it.description ?? "", url: it.url ?? it.fileUrl ?? "", fileName: it.fileName ?? "", provider: it.provider ?? "", isRequired: !!it.isRequired, orderIndex: Number(it.orderIndex ?? 0) });
  }
  function save() {
    const selected = courses.find((c: any) => Number(c.id) === Number(form.moduleId));
    upMut.mutate({
      id: form.id,
      contentType: form.contentType,
      moduleId: form.contentType === "course" && form.moduleId ? Number(form.moduleId) : undefined,
      title: form.contentType === "course" && !form.title.trim() && selected ? selected.title : form.title.trim(),
      description: form.description.trim() || undefined,
      url: form.contentType !== "course" ? form.url.trim() || undefined : undefined,
      fileName: form.fileName.trim() || undefined,
      provider: form.provider.trim() || undefined,
      isRequired: form.isRequired,
      orderIndex: Number(form.orderIndex || 0),
    });
  }
  return (
    <div className="mt-4 grid lg:grid-cols-[360px_1fr] gap-4">
      <div className="bg-white border rounded-xl p-5 space-y-3">
        <h3 className="font-bold flex items-center gap-2"><BookOpen size={16} /> {editing ? "Editar conteúdo" : "Novo conteúdo"}</h3>
        <L l="Tipo">
          <select value={form.contentType} onChange={e => setForm({ ...form, contentType: e.target.value, moduleId: "" })} className="w-full border rounded px-2 py-1.5 text-sm">
            <option value="course">Curso da plataforma</option>
            <option value="material">Material complementar</option>
            <option value="video">Vídeo externo</option>
            <option value="link">Link externo</option>
          </select>
        </L>
        {form.contentType === "course" ? (
          <L l="Curso">
            <select value={form.moduleId} onChange={e => { const c = courses.find((x: any) => Number(x.id) === Number(e.target.value)); setForm({ ...form, moduleId: e.target.value, title: c?.title ?? form.title }); }} className="w-full border rounded px-2 py-1.5 text-sm">
              <option value="">Selecione...</option>
              {courses.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </L>
        ) : (
          <L l="URL"><input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://..." className="w-full border rounded px-2 py-1.5 text-sm" /></L>
        )}
        <L l="Título"><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" /></L>
        <L l="Descrição"><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full border rounded px-2 py-1.5 text-sm" /></L>
        {form.contentType !== "course" && <div className="grid grid-cols-2 gap-2"><L l="Arquivo"><input value={form.fileName} onChange={e => setForm({ ...form, fileName: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" /></L><L l="Provedor"><input value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" /></L></div>}
        <div className="grid grid-cols-2 gap-2">
          <L l="Ordem"><input type="number" value={form.orderIndex} onChange={e => setForm({ ...form, orderIndex: Number(e.target.value || 0) })} className="w-full border rounded px-2 py-1.5 text-sm" /></L>
          <label className="text-sm flex items-center gap-2 mt-6"><input type="checkbox" checked={form.isRequired} onChange={e => setForm({ ...form, isRequired: e.target.checked })} /> Obrigatório</label>
        </div>
        <div className="flex justify-end gap-2 border-t pt-3">
          {editing && <button onClick={() => { setEditing(null); reset(); }} className="px-3 py-1.5 border rounded text-sm">Cancelar</button>}
          <button onClick={save} disabled={upMut.isPending} className="px-3 py-1.5 bg-emerald-600 text-white rounded text-sm font-semibold flex items-center gap-1"><Save size={13} /> Salvar</button>
        </div>
      </div>
      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="text-left p-3">Conteúdo</th><th className="p-3">Tipo</th><th className="p-3">Obrig.</th><th className="p-3">Concluídos</th><th className="p-3">Cert.</th><th className="p-3"></th></tr></thead>
          <tbody>
            {items.map((it: any) => (
              <tr key={it.id} className="border-t">
                <td className="p-3"><div className="font-medium">{it.title}</div>{it.moduleTitle && <div className="text-xs text-emerald-700">Curso: {it.moduleTitle}</div>}{it.description && <div className="text-xs text-slate-500 line-clamp-1">{it.description}</div>}</td>
                <td className="p-3 text-center">{it.contentType}</td>
                <td className="p-3 text-center">{it.isRequired ? "Sim" : "Não"}</td>
                <td className="p-3 text-center">{it.completedCount}</td>
                <td className="p-3 text-center">{it.certificatesCount}</td>
                <td className="p-3 text-right"><button onClick={() => edit(it)} className="text-xs text-blue-600 mr-3">Editar</button><button onClick={() => { if (confirm("Remover conteúdo?")) delMut.mutate({ id: it.id }); }} className="text-xs text-rose-600">Remover</button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-sm text-slate-400">Nenhum conteúdo cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IndicatorsTab() {
  const q = (trpc.cipa as any).dashboard.useQuery();
  const d = q.data as any;
  if (!d) return <p className="text-sm text-slate-400 mt-4">Carregando…</p>;
  return (
    <div className="grid sm:grid-cols-3 gap-3 mt-4">
      <div className="border rounded-lg p-4 bg-slate-50"><div className="text-xs uppercase text-slate-500 font-semibold">Reuniões realizadas</div><div className="text-2xl font-bold mt-1">{d.reunioesRealizadas}</div></div>
      <div className="border rounded-lg p-4 bg-slate-50"><div className="text-xs uppercase text-slate-500 font-semibold">Integrantes ativos</div><div className="text-2xl font-bold mt-1">{d.integrantesAtivos}</div></div>
      <div className="border rounded-lg p-4 bg-slate-50"><div className="text-xs uppercase text-slate-500 font-semibold">Dias p/ fim do mandato</div><div className="text-2xl font-bold mt-1">{d.diasParaFimMandato ?? "—"}</div></div>
    </div>
  );
}

function L({ l, children }: any) {
  return <div><label className="text-xs font-semibold text-slate-700 block mb-1">{l}</label>{children}</div>;
}
