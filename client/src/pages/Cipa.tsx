import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { ShieldCheck, Vote, Loader2, Users, Maximize, Minimize, LogOut, CheckCircle2, Printer, User as UserIcon, BookOpen, FileText, ExternalLink, Award } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

/**
 * P15 #4 / P18 GRANDE — CIPA para o colaborador: eleição ativa descoberta
 * automaticamente, votação em CARDS de candidato (foto/cargo/chapa/proposta),
 * comprovante de participação e modo urna presencial (tela cheia, dispositivo
 * compartilhado — cada eleitor efetua login e logout na urna).
 */
export default function Cipa() {
  const membersQ = (trpc.cipa as any).listMembers.useQuery();
  const members = (membersQ.data ?? []) as any[];
  const [kiosk, setKiosk] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  async function toggleKiosk() {
    if (!kiosk) {
      try { await containerRef.current?.requestFullscreen?.(); } catch {}
      setKiosk(true);
    } else {
      try { if (document.fullscreenElement) await document.exitFullscreen(); } catch {}
      setKiosk(false);
    }
  }

  const body = (
    <div ref={containerRef} className={kiosk ? "fixed inset-0 z-[100] bg-slate-50 overflow-y-auto" : ""}>
      <div className={kiosk ? "max-w-2xl mx-auto p-8 space-y-5" : "max-w-3xl mx-auto p-6 space-y-5"}>
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck size={22} className="text-emerald-600" /> CIPA</h1>
            <p className="text-sm text-muted-foreground mt-1">Comissão Interna de Prevenção de Acidentes — eleições e integrantes atuais.</p>
          </div>
          <button onClick={toggleKiosk} className="shrink-0 px-3 py-1.5 border rounded text-xs font-semibold flex items-center gap-1.5 text-slate-600 hover:bg-slate-100">
            {kiosk ? <><Minimize size={13} /> Sair do modo urna</> : <><Maximize size={13} /> Modo urna (tela cheia)</>}
          </button>
        </header>

        {!kiosk && (
          <section className="bg-white border rounded-xl p-5">
            <h2 className="font-bold text-lg mb-3 flex items-center gap-2"><Users size={18} className="text-emerald-600" /> Integrantes atuais</h2>
            {members.length === 0 && <p className="text-sm text-slate-400">Nenhuma comissão ativa no momento.</p>}
            <div className="grid sm:grid-cols-2 gap-2">
              {members.map((m: any) => (
                <div key={m.id} className="border rounded-lg p-3 text-sm">
                  <b>{m.name}</b>
                  <span className="ml-2 text-[10px] uppercase bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">{m.role}</span>
                  <div className="text-xs text-slate-500 mt-0.5">Mandato até {m.mandate_end?.slice(0, 10) ?? "—"}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {!kiosk && <CipaLearningSection />}

        <VotingSection kiosk={kiosk} onExitKiosk={() => setKiosk(false)} />
      </div>
    </div>
  );

  if (kiosk) return body; // tela cheia — sem AppLayout (sem menu/nav)
  return <AppLayout>{body}</AppLayout>;
}

function CipaLearningSection() {
  const q = (trpc.cipaTraining as any).learningForEmployee.useQuery();
  const markMut = (trpc.cipaTraining as any).markProgress.useMutation({ onSuccess: () => q.refetch() });
  const data = q.data as any;
  const summary = data?.summary ?? { total: 0, completed: 0, required: 0, pendingRequired: 0, certificates: 0 };
  const items = [...((data?.courses ?? []) as any[]), ...((data?.resources ?? []) as any[])];
  if (q.isLoading || summary.total === 0) return null;
  function mark(item: any, completed = false) {
    if (item.contentType !== "course") {
      markMut.mutate({ contentId: item.id, percentWatched: completed ? 100 : Math.max(item.percent || 0, 10), timeSpentSeconds: completed ? 60 : 15, completed });
    }
  }
  return (
    <section className="bg-white border rounded-xl p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-bold text-lg mb-1 flex items-center gap-2"><BookOpen size={18} className="text-emerald-600" /> Capacitação da CIPA</h2>
          <p className="text-sm text-slate-500">Cursos, materiais e evidências de treinamento liberados pela empresa.</p>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <Metric label="Conteúdos" value={summary.total} />
          <Metric label="Concluídos" value={summary.completed} />
          <Metric label="Obrig." value={summary.required} />
          <Metric label="Cert." value={summary.certificates} />
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-3 mt-4">
        {items.map((it: any) => (
          <div key={it.id} className="border rounded-lg p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-sm flex items-center gap-1.5">
                  {it.contentType === "course" ? <BookOpen size={14} className="text-emerald-600" /> : <FileText size={14} className="text-sky-600" />}
                  {it.title}
                </div>
                {it.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{it.description}</p>}
              </div>
              {it.isCompleted ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Concluído</span> : <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">Pendente</span>}
            </div>
            <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-emerald-600" style={{ width: `${Math.max(0, Math.min(100, Math.round(it.percent || 0)))}%` }} /></div>
            <div className="mt-3 flex flex-wrap gap-2">
              {it.contentType === "course" && it.moduleId && <a href={`/cursos/${it.moduleId}`} className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs font-semibold">Iniciar curso</a>}
              {it.contentType !== "course" && (it.url || it.fileUrl) && <a href={it.url || it.fileUrl} target="_blank" rel="noreferrer" onClick={() => mark(it)} className="px-3 py-1.5 rounded border text-xs font-semibold inline-flex items-center gap-1"><ExternalLink size={12} /> Abrir</a>}
              {it.contentType !== "course" && !it.isCompleted && <button onClick={() => mark(it, true)} className="px-3 py-1.5 rounded border text-xs font-semibold">Marcar concluído</button>}
              {it.certificate?.url && <a href={it.certificate.url} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded border text-xs font-semibold inline-flex items-center gap-1"><Award size={12} /> Certificado</a>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded border bg-slate-50 px-2 py-1"><div className="font-bold text-slate-800">{value}</div><div className="text-slate-500">{label}</div></div>;
}

function VotingSection({ kiosk, onExitKiosk }: { kiosk: boolean; onExitKiosk: () => void }) {
  const activeQ = (trpc.cipa as any).activeElection.useQuery();
  const election = activeQ.data as any;

  return (
    <section className="bg-amber-50 border border-amber-200 rounded-xl p-5">
      <h2 className="font-bold text-lg mb-2 flex items-center gap-2"><Vote size={18} className="text-amber-600" /> Votação da CIPA</h2>
      {activeQ.isLoading ? (
        <p className="text-sm text-slate-400">Carregando…</p>
      ) : !election ? (
        <p className="text-sm text-amber-800">Nenhuma eleição da CIPA em andamento no momento.</p>
      ) : (
        <VotingBox electionId={election.id} status={election.status} kiosk={kiosk} onExitKiosk={onExitKiosk} />
      )}
    </section>
  );
}

function VotingBox({ electionId, status, kiosk, onExitKiosk }: { electionId: number; status: string; kiosk: boolean; onExitKiosk: () => void }) {
  const statusQ = (trpc.cipa as any).myVotingStatus.useQuery({ electionId });
  const candQ = (trpc.cipa as any).listCandidates.useQuery({ electionId });
  const resultsQ = (trpc.cipa as any).results.useQuery({ electionId });
  const voteMut = (trpc.cipa as any).castVote.useMutation({
    onSuccess: () => { statusQ.refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao votar"),
  });
  const candidates = (candQ.data ?? []) as any[];
  const results = resultsQ.data as any;
  const [confirming, setConfirming] = useState<any>(null);

  if (results?.released) {
    const chartData = results.candidates.map((c: any) => ({ name: c.name, votos: c.votes, pct: c.pct }));
    return (
      <div className="bg-white border rounded-lg p-4">
        <p className="text-sm font-semibold text-slate-700 mb-2">Resultado da eleição — {results.totalVoters} participante(s)</p>
        <div style={{ width: "100%", height: Math.max(140, chartData.length * 42) }}>
          <ResponsiveContainer>
            <BarChart data={chartData} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
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

  if (voteMut.data?.receiptCode || statusQ.data?.alreadyVoted) {
    const code = voteMut.data?.receiptCode ?? statusQ.data?.receiptCode;
    return (
      <div className="bg-white border rounded-lg p-6 text-center space-y-3">
        <CheckCircle2 size={40} className="text-emerald-500 mx-auto" />
        <p className="text-sm font-semibold text-emerald-700">Seu voto foi registrado com sigilo garantido. Obrigado por participar!</p>
        {code && (
          <div className="bg-slate-50 border rounded-lg py-3 px-4 inline-block">
            <p className="text-[10px] uppercase text-slate-400 tracking-wide">Comprovante de participação</p>
            <p className="text-lg font-mono font-bold text-slate-700">{code}</p>
            <p className="text-[10px] text-slate-400 mt-1">Este código comprova que você votou — não revela em quem.</p>
          </div>
        )}
        <div className="flex justify-center gap-2 pt-2">
          {code && <button onClick={() => window.print()} className="px-3 py-1.5 border rounded text-xs font-semibold flex items-center gap-1"><Printer size={12} /> Imprimir</button>}
          {kiosk && <ExitForNextVoter onExitKiosk={onExitKiosk} />}
        </div>
      </div>
    );
  }

  if (status === "inscricoes_abertas") {
    return <p className="text-sm text-amber-800">As inscrições de candidatos estão abertas. A votação ainda não começou — procure o RH/SESMT para se candidatar.</p>;
  }

  if (candidates.length === 0) {
    return <p className="text-sm text-slate-500">Nenhum candidato cadastrado ainda.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-amber-700 bg-amber-100 border border-amber-200 rounded p-2">
        Seu voto é sigiloso — o sistema registra apenas que você participou, nunca em quem você votou.
      </p>
      <div className={`grid ${kiosk ? "grid-cols-1 sm:grid-cols-2" : "sm:grid-cols-2"} gap-3`}>
        {candidates.map((c: any) => (
          <button key={c.id} onClick={() => setConfirming(c)} className="text-left bg-white border-2 border-transparent hover:border-amber-400 rounded-xl p-4 shadow-sm transition flex gap-3 items-start">
            {c.photo_url ? (
              <img src={c.photo_url} alt={c.name} className="w-16 h-16 rounded-lg object-cover shrink-0 bg-slate-100" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><UserIcon size={26} className="text-slate-300" /></div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <b className="text-sm">{c.name}</b>
                {c.chapa && <span className="text-[10px] uppercase bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">Chapa {c.chapa}</span>}
              </div>
              {c.cargo && <p className="text-xs text-slate-500">{c.cargo}</p>}
              {c.pitch && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{c.pitch}</p>}
            </div>
          </button>
        ))}
      </div>
      {confirming && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4" onClick={() => setConfirming(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 text-center space-y-3" onClick={e => e.stopPropagation()}>
            {confirming.photo_url
              ? <img src={confirming.photo_url} alt={confirming.name} className="w-20 h-20 rounded-lg object-cover mx-auto bg-slate-100" />
              : <div className="w-20 h-20 rounded-lg bg-slate-100 flex items-center justify-center mx-auto"><UserIcon size={32} className="text-slate-300" /></div>}
            <p className="font-bold">{confirming.name}</p>
            {confirming.cargo && <p className="text-xs text-slate-500">{confirming.cargo}</p>}
            <p className="text-sm text-slate-600">Confirmar voto neste candidato? <b>Não será possível alterar depois.</b></p>
            <div className="flex gap-2 justify-center pt-2">
              <button onClick={() => setConfirming(null)} className="px-4 py-2 border rounded text-sm">Cancelar</button>
              <button
                onClick={() => { voteMut.mutate({ electionId, candidateId: confirming.id }); setConfirming(null); }}
                disabled={voteMut.isPending}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded text-sm font-semibold flex items-center gap-1"
              >
                {voteMut.isPending ? <Loader2 size={13} className="animate-spin" /> : null} Confirmar voto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// P18 GRANDE — na urna presencial, o dispositivo é compartilhado: cada eleitor
// precisa fazer LOGOUT após votar pra o próximo poder logar com sua própria conta.
function ExitForNextVoter({ onExitKiosk }: { onExitKiosk: () => void }) {
  const logoutMut = trpc.auth.logout.useMutation({
    onSuccess: () => { onExitKiosk(); window.location.href = "/plataforma/login"; },
  });
  return (
    <button onClick={() => logoutMut.mutate()} disabled={logoutMut.isPending} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded text-xs font-semibold flex items-center gap-1">
      {logoutMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />} Concluir e liberar urna
    </button>
  );
}
