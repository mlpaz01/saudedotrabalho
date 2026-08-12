import { useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  FileDown,
  Loader2,
  Lock,
  MessageSquareText,
  Plus,
  Save,
  Send,
  Users,
} from "lucide-react";

const api = (trpc as any).dds;

type DdsForm = {
  title: string;
  theme: string;
  objective: string;
  content: string;
  sessionDate: string;
  durationMinutes: number;
  facilitatorName: string;
  branchId: number | null;
  sectorId: number | null;
};

function emptyForm(): DdsForm {
  return {
    title: "",
    theme: "",
    objective: "",
    content: "",
    sessionDate: new Date().toISOString().slice(0, 10),
    durationMinutes: 10,
    facilitatorName: "",
    branchId: null,
    sectorId: null,
  };
}

export default function AdminDds() {
  const listQ = api.listAdmin.useQuery();
  const filtersQ = api.filters.useQuery();
  const sessions = (listQ.data ?? []) as any[];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<DdsForm>(emptyForm());
  const detailQ = api.detailAdmin.useQuery(
    { id: selectedId ?? 0 },
    { enabled: Boolean(selectedId) }
  );
  const selected =
    sessions.find(item => Number(item.id) === selectedId) ?? null;

  const sectors = useMemo(() => {
    const all = (filtersQ.data?.sectors ?? []) as any[];
    return form.branchId
      ? all.filter(item => Number(item.branch_id) === form.branchId)
      : all;
  }, [filtersQ.data?.sectors, form.branchId]);

  const saveMut = api.upsert.useMutation({
    onSuccess: async (result: any) => {
      toast.success("DDS salvo com sucesso.");
      setSelectedId(Number(result.id));
      await listQ.refetch();
    },
    onError: (error: any) =>
      toast.error(error?.message ?? "Nao foi possivel salvar o DDS."),
  });
  const publishMut = api.publish.useMutation({
    onSuccess: async (result: any) => {
      toast.success(`DDS publicado para ${result.assigned} colaborador(es).`);
      await Promise.all([listQ.refetch(), detailQ.refetch()]);
    },
    onError: (error: any) =>
      toast.error(error?.message ?? "Nao foi possivel publicar."),
  });
  const closeMut = api.close.useMutation({
    onSuccess: async () => {
      toast.success("DDS encerrado.");
      await Promise.all([listQ.refetch(), detailQ.refetch()]);
    },
    onError: (error: any) =>
      toast.error(error?.message ?? "Nao foi possivel encerrar."),
  });
  const reportMut = api.reportPdf.useMutation({
    onSuccess: (result: any) => {
      if (result.url) window.open(result.url, "_blank");
      toast.success("Relatorio de evidencias gerado.");
    },
    onError: (error: any) =>
      toast.error(error?.message ?? "Nao foi possivel gerar o PDF."),
  });

  function selectSession(item: any) {
    setSelectedId(Number(item.id));
    setForm({
      title: item.title ?? "",
      theme: item.theme ?? "",
      objective: item.objective ?? "",
      content: item.content ?? "",
      sessionDate: String(item.session_date ?? "").slice(0, 10),
      durationMinutes: Number(item.duration_minutes ?? 10),
      facilitatorName: item.facilitator_name ?? "",
      branchId: item.branch_id ? Number(item.branch_id) : null,
      sectorId: item.sector_id ? Number(item.sector_id) : null,
    });
  }

  function save() {
    if (form.title.trim().length < 3)
      return toast.error("Informe o titulo do DDS.");
    if (form.content.trim().length < 20)
      return toast.error("Inclua um conteudo mais completo para o DDS.");
    saveMut.mutate({ id: selectedId ?? undefined, ...form });
  }

  function publish() {
    if (!selectedId) return;
    if (
      !confirm(
        "Publicar este DDS para o publico selecionado? Cada colaborador recebera um registro individual de participacao."
      )
    )
      return;
    publishMut.mutate({ id: selectedId });
  }

  function close() {
    if (!selectedId) return;
    if (
      !confirm(
        "Encerrar este DDS? Apos o encerramento, novas confirmacoes nao serao aceitas."
      )
    )
      return;
    closeMut.mutate({ id: selectedId });
  }

  const totals = sessions.reduce(
    (acc, item) => {
      acc.assigned += Number(item.assigned_count ?? 0);
      acc.completed += Number(item.completed_count ?? 0);
      if (item.status === "publicado") acc.open += 1;
      return acc;
    },
    { assigned: 0, completed: 0, open: 0 }
  );

  return (
    <AppLayout>
      <main className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
              <MessageSquareText className="text-teal-600" size={25} /> DDS
              Online
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Dialogos de seguranca com distribuicao, confirmacao individual e
              evidencias auditaveis.
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedId(null);
              setForm(emptyForm());
            }}
            className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            <Plus size={16} /> Novo DDS
          </button>
        </header>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric
            label="DDS cadastrados"
            value={sessions.length}
            icon={<MessageSquareText size={17} />}
          />
          <Metric
            label="Em andamento"
            value={totals.open}
            icon={<Clock3 size={17} />}
          />
          <Metric
            label="Participantes"
            value={totals.assigned}
            icon={<Users size={17} />}
          />
          <Metric
            label="Confirmacoes"
            value={totals.completed}
            icon={<CheckCircle2 size={17} />}
          />
        </section>

        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="border-r border-slate-200 pr-0 lg:pr-5">
            <h2 className="mb-3 text-sm font-bold uppercase text-slate-500">
              DDS cadastrados
            </h2>
            <div className="max-h-[690px] space-y-2 overflow-y-auto pr-1">
              {listQ.isLoading && <Loading />}
              {!listQ.isLoading && sessions.length === 0 && (
                <p className="border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  Nenhum DDS cadastrado.
                </p>
              )}
              {sessions.map(item => {
                const active = Number(item.id) === selectedId;
                const assigned = Number(item.assigned_count ?? 0);
                const completed = Number(item.completed_count ?? 0);
                return (
                  <button
                    key={item.id}
                    onClick={() => selectSession(item)}
                    className={`w-full border-l-4 p-3 text-left transition ${active ? "border-teal-600 bg-teal-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                  >
                    <span className="block text-sm font-semibold text-slate-900">
                      {item.title}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {datePt(item.session_date)} · {item.duration_minutes} min
                    </span>
                    <span className="mt-2 flex items-center justify-between text-xs">
                      <Status value={item.status} />
                      <span className="text-slate-500">
                        {completed}/{assigned} confirmados
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="min-w-0 space-y-5">
            <div className="border-b border-slate-200 pb-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Titulo">
                  <input
                    className="field"
                    value={form.title}
                    onChange={event =>
                      setForm({ ...form, title: event.target.value })
                    }
                    placeholder="Ex.: Prevencao de quedas em escadas"
                  />
                </Field>
                <Field label="Tema">
                  <input
                    className="field"
                    value={form.theme}
                    onChange={event =>
                      setForm({ ...form, theme: event.target.value })
                    }
                    placeholder="Ex.: Trabalho em altura"
                  />
                </Field>
                <Field label="Data">
                  <input
                    type="date"
                    className="field"
                    value={form.sessionDate}
                    onChange={event =>
                      setForm({ ...form, sessionDate: event.target.value })
                    }
                  />
                </Field>
                <Field label="Duracao prevista (minutos)">
                  <input
                    type="number"
                    min={1}
                    max={240}
                    className="field"
                    value={form.durationMinutes}
                    onChange={event =>
                      setForm({
                        ...form,
                        durationMinutes: Number(event.target.value || 10),
                      })
                    }
                  />
                </Field>
                <Field label="Facilitador">
                  <input
                    className="field"
                    value={form.facilitatorName}
                    onChange={event =>
                      setForm({ ...form, facilitatorName: event.target.value })
                    }
                    placeholder="Nome do responsavel"
                  />
                </Field>
                <div />
                <Field label="Filial">
                  <select
                    className="field"
                    value={form.branchId ?? ""}
                    onChange={event =>
                      setForm({
                        ...form,
                        branchId: event.target.value
                          ? Number(event.target.value)
                          : null,
                        sectorId: null,
                      })
                    }
                  >
                    <option value="">Todas as filiais</option>
                    {(filtersQ.data?.branches ?? []).map((item: any) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Setor">
                  <select
                    className="field"
                    value={form.sectorId ?? ""}
                    onChange={event =>
                      setForm({
                        ...form,
                        sectorId: event.target.value
                          ? Number(event.target.value)
                          : null,
                      })
                    }
                  >
                    <option value="">Todos os setores</option>
                    {sectors.map((item: any) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="md:col-span-2">
                  <Field label="Objetivo">
                    <textarea
                      className="field min-h-20"
                      value={form.objective}
                      onChange={event =>
                        setForm({ ...form, objective: event.target.value })
                      }
                      placeholder="O que os participantes devem compreender ao final"
                    />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="Conteudo do DDS">
                    <textarea
                      className="field min-h-60"
                      value={form.content}
                      onChange={event =>
                        setForm({ ...form, content: event.target.value })
                      }
                      placeholder="Descreva orientacoes, riscos, medidas preventivas e condutas esperadas."
                    />
                  </Field>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  onClick={save}
                  disabled={
                    saveMut.isPending || selected?.status === "encerrado"
                  }
                  className="action border border-slate-300 bg-white text-slate-800"
                >
                  {saveMut.isPending ? (
                    <Loader2 className="animate-spin" size={15} />
                  ) : (
                    <Save size={15} />
                  )}{" "}
                  Salvar
                </button>
                {selectedId && selected?.status !== "encerrado" && (
                  <button
                    onClick={publish}
                    disabled={publishMut.isPending}
                    className="action bg-teal-700 text-white"
                  >
                    {publishMut.isPending ? (
                      <Loader2 className="animate-spin" size={15} />
                    ) : (
                      <Send size={15} />
                    )}{" "}
                    Publicar
                  </button>
                )}
                {selectedId && selected?.status === "publicado" && (
                  <button
                    onClick={close}
                    disabled={closeMut.isPending}
                    className="action bg-slate-800 text-white"
                  >
                    <Lock size={15} /> Encerrar
                  </button>
                )}
                {selectedId && (
                  <button
                    onClick={() => reportMut.mutate({ id: selectedId })}
                    disabled={reportMut.isPending}
                    className="action border border-slate-300 bg-white text-slate-800"
                  >
                    {reportMut.isPending ? (
                      <Loader2 className="animate-spin" size={15} />
                    ) : (
                      <FileDown size={15} />
                    )}{" "}
                    Evidencias PDF
                  </button>
                )}
              </div>
            </div>

            {selectedId && (
              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-bold text-slate-900">
                      Participacao individual
                    </h2>
                    <p className="text-xs text-slate-500">
                      Protocolo:{" "}
                      <b>
                        {detailQ.data?.session?.protocol_code ??
                          selected?.protocol_code ??
                          "-"}
                      </b>
                    </p>
                  </div>
                  <span className="text-xs text-slate-500">
                    Atualizado pelo registro de cada colaborador
                  </span>
                </div>
                <div className="overflow-x-auto border border-slate-200">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                      <tr>
                        <th className="p-2">Colaborador</th>
                        <th className="p-2">Filial / Setor</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Tempo</th>
                        <th className="p-2">Confirmacao</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detailQ.data?.participants ?? []).map((person: any) => (
                        <tr key={person.id} className="border-t">
                          <td className="p-2">
                            <b>{person.name}</b>
                            <div className="text-xs text-slate-500">
                              {person.position || "Cargo nao informado"}
                            </div>
                          </td>
                          <td className="p-2">
                            {person.branch_name || "-"}
                            <div className="text-xs text-slate-500">
                              {person.sector_name || "-"}
                            </div>
                          </td>
                          <td className="p-2">
                            {person.status === "concluido" ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700">
                                <CheckCircle2 size={14} /> Concluido
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-700">
                                <Circle size={14} /> Pendente
                              </span>
                            )}
                          </td>
                          <td className="p-2">
                            {formatSeconds(person.attendance_seconds)}
                          </td>
                          <td className="p-2 font-mono text-xs">
                            {person.acknowledgment_code || "-"}
                          </td>
                        </tr>
                      ))}
                      {!detailQ.isLoading &&
                        (detailQ.data?.participants ?? []).length === 0 && (
                          <tr>
                            <td
                              colSpan={5}
                              className="p-5 text-center text-slate-500"
                            >
                              Publique o DDS para criar os registros
                              individuais.
                            </td>
                          </tr>
                        )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
        <style>{`.field{width:100%;min-height:40px;border:1px solid #cbd5e1;border-radius:6px;background:white;padding:8px 10px;font-size:14px}.field:focus{outline:2px solid rgba(13,148,136,.18);border-color:#0d9488}.action{display:inline-flex;align-items:center;gap:7px;border-radius:6px;padding:8px 12px;font-size:14px;font-weight:600}.action:disabled{cursor:not-allowed;opacity:.5}`}</style>
      </main>
    </AppLayout>
  );
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between text-slate-500">
        <span className="text-xs font-medium">{label}</span>
        {icon}
      </div>
      <strong className="mt-1 block text-2xl text-slate-900">{value}</strong>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}

function Status({ value }: { value: string }) {
  const styles: Record<string, string> = {
    publicado: "bg-teal-100 text-teal-800",
    encerrado: "bg-slate-200 text-slate-700",
    rascunho: "bg-amber-100 text-amber-800",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-semibold ${styles[value] ?? styles.rascunho}`}
    >
      {value}
    </span>
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

function formatSeconds(value: unknown) {
  const seconds = Number(value ?? 0);
  if (!seconds) return "-";
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ${seconds % 60}s`;
}

function Loading() {
  return (
    <div className="flex justify-center p-5">
      <Loader2 className="animate-spin text-slate-400" size={20} />
    </div>
  );
}
