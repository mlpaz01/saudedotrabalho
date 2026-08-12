import { useEffect, useRef, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageSquareText,
  ShieldCheck,
  UserRound,
} from "lucide-react";

const api = (trpc as any).dds;

export default function Dds() {
  const listQ = api.mySessions.useQuery();
  const sessions = (listQ.data ?? []) as any[];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const openedAt = useRef(Date.now());
  const detailQ = api.mySession.useQuery(
    { id: selectedId ?? 0 },
    { enabled: Boolean(selectedId) }
  );
  const acknowledgeMut = api.acknowledge.useMutation({
    onSuccess: async (result: any) => {
      toast.success(
        `Participacao confirmada. Codigo ${result.acknowledgmentCode}`
      );
      await Promise.all([listQ.refetch(), detailQ.refetch()]);
    },
    onError: (error: any) =>
      toast.error(
        error?.message ?? "Nao foi possivel confirmar a participacao."
      ),
  });

  useEffect(() => {
    if (selectedId) openedAt.current = Date.now();
    setConfirmed(false);
  }, [selectedId]);

  const pending = sessions.filter(item => item.status === "pendente").length;
  const completed = sessions.filter(item => item.status === "concluido").length;
  const detail = detailQ.data as any;

  function acknowledge() {
    if (!selectedId || !confirmed)
      return toast.error("Confirme que leu e compreendeu o conteudo.");
    const attendanceSeconds = Math.max(
      1,
      Math.floor((Date.now() - openedAt.current) / 1000)
    );
    acknowledgeMut.mutate({
      id: selectedId,
      attendanceSeconds,
      confirmed: true,
    });
  }

  return (
    <AppLayout>
      <main className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <MessageSquareText className="text-teal-600" size={25} /> Meu DDS
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Dialogos de seguranca disponibilizados pela empresa.
          </p>
        </header>

        <section className="grid grid-cols-2 gap-3 sm:max-w-xl">
          <div className="border-l-4 border-amber-500 bg-white p-4">
            <span className="text-xs text-slate-500">Pendentes</span>
            <strong className="block text-2xl text-slate-900">{pending}</strong>
          </div>
          <div className="border-l-4 border-emerald-500 bg-white p-4">
            <span className="text-xs text-slate-500">Concluidos</span>
            <strong className="block text-2xl text-slate-900">
              {completed}
            </strong>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[310px_minmax(0,1fr)]">
          <aside className="space-y-2 border-r border-slate-200 pr-0 lg:pr-5">
            {listQ.isLoading && (
              <div className="flex justify-center p-5">
                <Loader2 className="animate-spin text-slate-400" />
              </div>
            )}
            {!listQ.isLoading && sessions.length === 0 && (
              <p className="border border-dashed border-slate-300 p-5 text-sm text-slate-500">
                Nenhum DDS foi disponibilizado para voce.
              </p>
            )}
            {sessions.map(item => (
              <button
                key={item.id}
                onClick={() => setSelectedId(Number(item.id))}
                className={`w-full border-l-4 p-3 text-left ${selectedId === Number(item.id) ? "border-teal-600 bg-teal-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}
              >
                <span className="block font-semibold text-slate-900">
                  {item.title}
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  {datePt(item.session_date)} · {item.duration_minutes} min
                </span>
                <span
                  className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${item.status === "concluido" ? "text-emerald-700" : "text-amber-700"}`}
                >
                  {item.status === "concluido" ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    <Clock3 size={14} />
                  )}
                  {item.status === "concluido" ? "Concluido" : "Pendente"}
                </span>
              </button>
            ))}
          </aside>

          <section className="min-w-0">
            {!selectedId && (
              <div className="border border-dashed border-slate-300 p-8 text-center text-slate-500">
                <MessageSquareText className="mx-auto mb-2" size={30} />
                <p>Selecione um DDS para abrir o conteudo.</p>
              </div>
            )}
            {selectedId && detailQ.isLoading && (
              <div className="flex justify-center p-10">
                <Loader2 className="animate-spin text-slate-400" />
              </div>
            )}
            {detail && (
              <article className="space-y-5">
                <div className="border-b border-slate-200 pb-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs text-slate-500">
                      {detail.protocol_code}
                    </span>
                    {detail.assignment_status === "concluido" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                        <CheckCircle2 size={14} /> Participacao confirmada
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {detail.title}
                  </h2>
                  <p className="mt-1 text-sm font-medium text-teal-700">
                    {detail.theme || "Dialogo de seguranca"}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays size={15} /> {datePt(detail.session_date)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 size={15} /> {detail.duration_minutes} minutos
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <UserRound size={15} />{" "}
                      {detail.facilitator_name || "Responsavel nao informado"}
                    </span>
                  </div>
                </div>

                {detail.objective && (
                  <section>
                    <h3 className="mb-2 text-sm font-bold uppercase text-slate-500">
                      Objetivo
                    </h3>
                    <p className="whitespace-pre-wrap text-slate-700">
                      {detail.objective}
                    </p>
                  </section>
                )}
                <section>
                  <h3 className="mb-2 text-sm font-bold uppercase text-slate-500">
                    Conteudo
                  </h3>
                  <div className="whitespace-pre-wrap border-l-4 border-teal-600 pl-4 leading-7 text-slate-800">
                    {detail.content}
                  </div>
                </section>

                {detail.assignment_status === "concluido" ? (
                  <div className="border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                    <p className="flex items-center gap-2 font-bold">
                      <ShieldCheck size={18} /> Evidencia registrada
                    </p>
                    <p className="mt-1">
                      Codigo de confirmacao:{" "}
                      <b className="font-mono">{detail.acknowledgment_code}</b>
                    </p>
                    <p>Data: {dateTimePt(detail.acknowledged_at)}</p>
                  </div>
                ) : (
                  <div className="border-t border-slate-200 pt-5">
                    <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={event => setConfirmed(event.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-teal-700"
                      />
                      <span>
                        Confirmo que li e compreendi o conteudo deste DDS e
                        estou ciente das orientacoes apresentadas.
                      </span>
                    </label>
                    <button
                      onClick={acknowledge}
                      disabled={!confirmed || acknowledgeMut.isPending}
                      className="mt-4 inline-flex items-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {acknowledgeMut.isPending ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <CheckCircle2 size={16} />
                      )}{" "}
                      Confirmar participacao
                    </button>
                  </div>
                )}
              </article>
            )}
          </section>
        </div>
      </main>
    </AppLayout>
  );
}

function datePt(value: unknown) {
  if (!value) return "-";
  const text = String(value);
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  const date = new Date(text);
  return Number.isNaN(date.getTime())
    ? text
    : date.toLocaleDateString("pt-BR");
}

function dateTimePt(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString("pt-BR");
}
