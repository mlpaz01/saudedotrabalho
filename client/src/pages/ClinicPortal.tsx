import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileCheck2,
  FileClock,
  FileText,
  Loader2,
  Microscope,
  Printer,
  Search,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

const STATUS: Record<string, { label: string; cls: string }> = {
  recebida: { label: "Recebida", cls: "bg-slate-100 text-slate-700" },
  agendamento_pendente: {
    label: "Agendamento pendente",
    cls: "bg-amber-100 text-amber-800",
  },
  agendada: { label: "Agendada", cls: "bg-sky-100 text-sky-800" },
  atendimento_realizado: {
    label: "Atendimento realizado",
    cls: "bg-indigo-100 text-indigo-800",
  },
  resultado_pendente: {
    label: "Resultado pendente",
    cls: "bg-orange-100 text-orange-800",
  },
  resultado_enviado: {
    label: "Resultado enviado",
    cls: "bg-teal-100 text-teal-800",
  },
  concluida: { label: "Concluída", cls: "bg-emerald-100 text-emerald-800" },
};

const STATUS_OPTIONS = Object.keys(STATUS);

const STATUS_TRANSITIONS: Record<string, string[]> = {
  recebida: [
    "recebida",
    "agendamento_pendente",
    "agendada",
    "atendimento_realizado",
  ],
  agendamento_pendente: [
    "agendamento_pendente",
    "agendada",
    "atendimento_realizado",
  ],
  agendada: ["agendada", "agendamento_pendente", "atendimento_realizado"],
  atendimento_realizado: [
    "atendimento_realizado",
    "resultado_pendente",
    "resultado_enviado",
  ],
  resultado_pendente: ["resultado_pendente", "resultado_enviado"],
  resultado_enviado: ["resultado_enviado", "resultado_pendente", "concluida"],
  concluida: ["concluida"],
};

function localDate(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? String(value).slice(0, 16)
    : date.toLocaleString("pt-BR");
}

function inputDateTime(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function downloadDataUrl(payload: { fileName: string; dataBase64: string }) {
  const link = document.createElement("a");
  link.href = payload.dataBase64;
  link.download = payload.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function Metric({ label, value, icon: Icon, tone = "teal" }: any) {
  const colors: Record<string, string> = {
    teal: "border-teal-200 bg-teal-50 text-teal-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    sky: "border-sky-200 bg-sky-50 text-sky-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };
  return (
    <div className={`border p-4 ${colors[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase">{label}</span>
        <Icon size={18} />
      </div>
      <strong className="mt-3 block text-2xl">{Number(value || 0)}</strong>
    </div>
  );
}

export default function ClinicPortal() {
  const now = new Date();
  const [tab, setTab] = useState<"orders" | "billing">("orders");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [dialog, setDialog] = useState<"status" | "result" | "proof" | null>(
    null
  );
  const [from, setFrom] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  );
  const [to, setTo] = useState(
    new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10)
  );
  const utils = trpc.useUtils();
  const profileQ = trpc.clinicPortal.profile.useQuery();
  const dashboardQ = trpc.clinicPortal.dashboard.useQuery();
  const ordersQ = trpc.clinicPortal.listOrders.useQuery({
    search: search || undefined,
    status: (status || undefined) as any,
  });
  const billingQ = trpc.clinicPortal.billing.useQuery(
    { from, to },
    { enabled: tab === "billing" }
  );
  const refresh = async () => {
    await Promise.all([
      utils.clinicPortal.dashboard.invalidate(),
      utils.clinicPortal.listOrders.invalidate(),
      utils.clinicPortal.billing.invalidate(),
    ]);
  };
  const pdf = trpc.clinicPortal.getRequestPdf.useMutation({
    onSuccess: data => downloadDataUrl(data),
    onError: error => toast.error(error.message),
  });
  const proofDownload = trpc.clinicPortal.downloadSignedProof.useMutation({
    onSuccess: data => downloadDataUrl(data),
    onError: error => toast.error(error.message),
  });
  const billingPdf = trpc.clinicPortal.generateBillingPdf.useMutation({
    onSuccess: data => downloadDataUrl(data),
    onError: error => toast.error(error.message),
  });

  const orders = ordersQ.data || [];
  const pending = useMemo(
    () =>
      orders.filter(
        (item: any) =>
          !["resultado_enviado", "concluida"].includes(item.workflow_status)
      ),
    [orders]
  );

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1500px] space-y-5 p-4 md:p-6">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
          <div>
            <div className="flex items-center gap-2 text-teal-700">
              <Building2 size={20} />
              <span className="text-xs font-bold uppercase">
                Clínica credenciada
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              {profileQ.data?.trade_name ||
                profileQ.data?.legal_name ||
                "Portal de atendimentos"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Requisições encaminhadas, resultados, comprovantes e produção
              financeira · {Number(profileQ.data?.linkedCompanies || 1)}{" "}
              empresa(s) vinculada(s).
            </p>
          </div>
          <Badge
            variant="outline"
            className="border-emerald-300 text-emerald-700"
          >
            Credenciamento ativo
          </Badge>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric
            label="Recebidas"
            value={dashboardQ.data?.total}
            icon={FileClock}
          />
          <Metric
            label="Aguardando agenda"
            value={dashboardQ.data?.scheduling_pending}
            icon={CalendarClock}
            tone="amber"
          />
          <Metric
            label="Agendadas"
            value={dashboardQ.data?.scheduled}
            icon={ClipboardCheck}
            tone="sky"
          />
          <Metric
            label="Resultados pendentes"
            value={dashboardQ.data?.result_pending}
            icon={Microscope}
            tone="amber"
          />
          <Metric
            label="Comprovantes pendentes"
            value={dashboardQ.data?.proof_pending}
            icon={FileCheck2}
            tone="amber"
          />
        </div>

        <div className="flex gap-2 border-b">
          <button
            className={`border-b-2 px-4 py-3 text-sm font-semibold ${tab === "orders" ? "border-teal-600 text-teal-800" : "border-transparent text-slate-500"}`}
            onClick={() => setTab("orders")}
          >
            Requisições
          </button>
          <button
            className={`border-b-2 px-4 py-3 text-sm font-semibold ${tab === "billing" ? "border-teal-600 text-teal-800" : "border-transparent text-slate-500"}`}
            onClick={() => setTab("billing")}
          >
            Demonstrativo e faturamento
          </button>
        </div>

        {tab === "orders" ? (
          <section className="border bg-white">
            <div className="flex flex-wrap items-end gap-3 border-b p-4">
              <label className="min-w-[260px] flex-1 text-xs font-semibold">
                Pesquisar
                <div className="relative mt-1">
                  <Search
                    className="absolute left-3 top-3 text-slate-400"
                    size={15}
                  />
                  <Input
                    className="pl-9"
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Nome, CPF, matrícula, exame ou requisição"
                  />
                </div>
              </label>
              <label className="text-xs font-semibold">
                Situação
                <select
                  className="mt-1 h-10 min-w-[220px] border bg-white px-3 text-sm"
                  value={status}
                  onChange={event => setStatus(event.target.value)}
                >
                  <option value="">Todas</option>
                  {STATUS_OPTIONS.map(key => (
                    <option key={key} value={key}>
                      {STATUS[key].label}
                    </option>
                  ))}
                </select>
              </label>
              <span className="pb-2 text-xs text-slate-500">
                {pending.length} em fluxo operacional
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1150px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-3">Requisição</th>
                    <th className="p-3">Funcionário</th>
                    <th className="p-3">Exame</th>
                    <th className="p-3">Agenda / realização</th>
                    <th className="p-3">Situação</th>
                    <th className="p-3">Comprovante</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((row: any) => (
                    <tr key={row.id} className="border-t align-top">
                      <td className="p-3">
                        <b>{row.order_number}</b>
                        <div className="mt-1 text-xs text-slate-500">
                          {row.company_name}
                          <br />
                          Válida até{" "}
                          {String(row.valid_until || "-").slice(0, 10)}
                        </div>
                      </td>
                      <td className="p-3">
                        <b>{row.collaborator_name}</b>
                        <div className="text-xs text-slate-500">
                          CPF {row.cpf || "-"}
                          <br />
                          {row.position || "Cargo não informado"}
                        </div>
                      </td>
                      <td className="p-3">
                        {row.exam_name}
                        <div className="text-xs text-slate-500">
                          {[row.branch_name, row.sector_name]
                            .filter(Boolean)
                            .join(" / ")}
                        </div>
                      </td>
                      <td className="p-3 text-xs">
                        Agenda: {localDate(row.scheduled_at)}
                        <br />
                        Realização: {localDate(row.performed_at)}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold ${STATUS[row.workflow_status]?.cls || "bg-slate-100"}`}
                        >
                          {STATUS[row.workflow_status]?.label ||
                            row.workflow_status}
                        </span>
                      </td>
                      <td className="p-3">
                        {row.proof_private_path ? (
                          <button
                            className="text-xs font-semibold text-emerald-700 underline"
                            onClick={() =>
                              proofDownload.mutate({ orderId: Number(row.id) })
                            }
                          >
                            Anexado
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-amber-700">
                            Pendente
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="outline"
                            title="Imprimir requisição"
                            onClick={() =>
                              pdf.mutate({ orderId: Number(row.id) })
                            }
                          >
                            <Printer size={15} />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            title="Atualizar atendimento"
                            onClick={() => {
                              setSelected(row);
                              setDialog("status");
                            }}
                          >
                            <CalendarClock size={15} />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            title="Lançar resultado"
                            onClick={() => {
                              setSelected(row);
                              setDialog("result");
                            }}
                          >
                            <Microscope size={15} />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            title="Anexar requisição assinada"
                            onClick={() => {
                              setSelected(row);
                              setDialog("proof");
                            }}
                          >
                            <Upload size={15} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!orders.length && !ordersQ.isLoading && (
                <p className="p-8 text-center text-sm text-slate-500">
                  Nenhuma requisição foi direcionada a esta clínica.
                </p>
              )}
            </div>
          </section>
        ) : (
          <BillingPanel
            from={from}
            to={to}
            setFrom={setFrom}
            setTo={setTo}
            data={billingQ.data}
            loading={billingQ.isLoading}
            generate={() => billingPdf.mutate({ from, to })}
            generating={billingPdf.isPending}
            downloadProof={(orderId: number) =>
              proofDownload.mutate({ orderId })
            }
          />
        )}
      </div>
      <StatusDialog
        row={dialog === "status" ? selected : null}
        close={() => setDialog(null)}
        saved={refresh}
      />
      <ResultDialog
        row={dialog === "result" ? selected : null}
        close={() => setDialog(null)}
        saved={refresh}
      />
      <ProofDialog
        row={dialog === "proof" ? selected : null}
        close={() => setDialog(null)}
        saved={refresh}
      />
    </AppLayout>
  );
}

function StatusDialog({ row, close, saved }: any) {
  const [form, setForm] = useState<any>({});
  useEffect(() => setForm({}), [row?.id]);
  const mutation = trpc.clinicPortal.updateOrder.useMutation({
    onSuccess: async () => {
      toast.success("Atendimento atualizado.");
      await saved();
      close();
    },
    onError: error => toast.error(error.message),
  });
  const value = (key: string, fallback: any = "") => form[key] ?? fallback;
  return (
    <Dialog open={Boolean(row)} onOpenChange={open => !open && close()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Atualizar atendimento</DialogTitle>
        </DialogHeader>
        {row && (
          <div className="space-y-4">
            <div className="border bg-slate-50 p-3 text-sm">
              <b>{row.collaborator_name}</b>
              <br />
              {row.exam_name} · {row.order_number}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs font-semibold">
                Situação
                <select
                  className="mt-1 h-10 w-full border bg-white px-3"
                  value={value("status", row.workflow_status)}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                >
                  {(
                    STATUS_TRANSITIONS[row.workflow_status] || [
                      row.workflow_status,
                    ]
                  ).map(key => (
                    <option key={key} value={key}>
                      {STATUS[key].label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold">
                Valor do atendimento
                <Input
                  className="mt-1"
                  type="number"
                  min="0"
                  step="0.01"
                  value={value("amount", row.amount || "")}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                />
              </label>
              <label className="text-xs font-semibold">
                Agendamento
                <Input
                  className="mt-1"
                  type="datetime-local"
                  value={value("scheduledAt", inputDateTime(row.scheduled_at))}
                  onChange={e =>
                    setForm({ ...form, scheduledAt: e.target.value })
                  }
                />
              </label>
              <label className="text-xs font-semibold">
                Realização
                <Input
                  className="mt-1"
                  type="datetime-local"
                  value={value("performedAt", inputDateTime(row.performed_at))}
                  onChange={e =>
                    setForm({ ...form, performedAt: e.target.value })
                  }
                />
              </label>
              <label className="text-xs font-semibold">
                Profissional responsável
                <Input
                  className="mt-1"
                  value={value("professionalName", row.professional_name || "")}
                  onChange={e =>
                    setForm({ ...form, professionalName: e.target.value })
                  }
                />
              </label>
              <div className="grid grid-cols-[110px_1fr] gap-2">
                <label className="text-xs font-semibold">
                  Conselho
                  <Input
                    className="mt-1"
                    placeholder="CRM, CRFa..."
                    value={value(
                      "registryType",
                      row.professional_registry_type || ""
                    )}
                    onChange={e =>
                      setForm({ ...form, registryType: e.target.value })
                    }
                  />
                </label>
                <label className="text-xs font-semibold">
                  Registro
                  <Input
                    className="mt-1"
                    value={value(
                      "registryNumber",
                      row.professional_registry_number || ""
                    )}
                    onChange={e =>
                      setForm({ ...form, registryNumber: e.target.value })
                    }
                  />
                </label>
              </div>
            </div>
            <label className="block text-xs font-semibold">
              Observações
              <Textarea
                className="mt-1"
                value={value("notes", row.notes || "")}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={close}>
                Cancelar
              </Button>
              <Button
                disabled={mutation.isPending}
                onClick={() =>
                  mutation.mutate({
                    orderId: Number(row.id),
                    status: value("status", row.workflow_status),
                    scheduledAt:
                      value("scheduledAt", inputDateTime(row.scheduled_at)) ||
                      null,
                    performedAt:
                      value("performedAt", inputDateTime(row.performed_at)) ||
                      null,
                    professionalName:
                      value("professionalName", row.professional_name || "") ||
                      undefined,
                    registryType:
                      value(
                        "registryType",
                        row.professional_registry_type || ""
                      ) || undefined,
                    registryNumber:
                      value(
                        "registryNumber",
                        row.professional_registry_number || ""
                      ) || undefined,
                    notes: value("notes", row.notes || "") || undefined,
                    amount:
                      value("amount", row.amount || "") === ""
                        ? null
                        : Number(value("amount", row.amount)),
                  })
                }
              >
                {mutation.isPending ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={15} />
                )}
                Salvar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResultDialog({ row, close, saved }: any) {
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<any>({
    resultType: "qualitativo",
    performedAt: "",
    methodName: "",
    resultSummary: "",
    referenceText: "",
    parameters: [],
  });
  useEffect(() => {
    setFile(null);
    setForm({
      resultType: "qualitativo",
      performedAt: inputDateTime(row?.performed_at),
      methodName: "",
      resultSummary: "",
      referenceText: "",
      parameters: [],
    });
  }, [row?.id]);
  const ocr = trpc.clinicPortal.analyzeResultOcr.useMutation({
    onSuccess: data => {
      setForm((f: any) => ({
        ...f,
        resultType: data.resultType || f.resultType,
        performedAt: data.performedDate
          ? `${data.performedDate}T12:00`
          : f.performedAt,
        methodName: data.methodName || "",
        resultSummary: data.resultSummary || "",
        referenceText: data.referenceText || "",
        parameters: Array.isArray(data.parameters) ? data.parameters : [],
      }));
      toast.success("Leitura concluída. Revise antes de salvar.");
    },
    onError: e => toast.error(e.message),
  });
  const save = trpc.clinicPortal.submitResult.useMutation({
    onSuccess: async () => {
      toast.success("Resultado enviado ao SESMT e vinculado ao funcionário.");
      await saved();
      close();
    },
    onError: e => toast.error(e.message),
  });
  const analyze = async () => {
    if (!file || !file.type.startsWith("image/"))
      return toast.error("Para OCR, selecione uma imagem PNG ou JPG.");
    ocr.mutate({
      orderId: Number(row.id),
      fileName: file.name,
      mimeType: file.type as any,
      fileBase64: await fileAsDataUrl(file),
    });
  };
  const submit = async () => {
    if (!form.performedAt) return toast.error("Informe a data da realização.");
    const encoded = file ? await fileAsDataUrl(file) : undefined;
    save.mutate({
      orderId: Number(row.id),
      performedAt: form.performedAt,
      resultType: form.resultType,
      methodName: form.methodName || undefined,
      resultSummary: form.resultSummary || undefined,
      referenceText: form.referenceText || undefined,
      parameters: form.parameters || [],
      fileName: file?.name,
      fileBase64: encoded,
    });
  };
  return (
    <Dialog open={Boolean(row)} onOpenChange={open => !open && close()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Lançar resultado do exame</DialogTitle>
        </DialogHeader>
        {row && (
          <div className="space-y-4">
            <div className="border bg-slate-50 p-3 text-sm">
              <b>{row.collaborator_name}</b>
              <br />
              {row.exam_name} · {row.order_number}
            </div>
            <div className="border-l-4 border-amber-400 bg-amber-50 p-3 text-xs">
              O OCR auxilia a digitação e não conclui diagnóstico, autenticidade
              ou aptidão. Revise todos os campos antes de enviar.
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs font-semibold">
                Data da realização
                <Input
                  className="mt-1"
                  type="datetime-local"
                  value={form.performedAt}
                  onChange={e =>
                    setForm({ ...form, performedAt: e.target.value })
                  }
                />
              </label>
              <label className="text-xs font-semibold">
                Tipo do resultado
                <select
                  className="mt-1 h-10 w-full border bg-white px-3"
                  value={form.resultType}
                  onChange={e =>
                    setForm({ ...form, resultType: e.target.value })
                  }
                >
                  <option value="qualitativo">Qualitativo</option>
                  <option value="quantitativo">Quantitativo</option>
                  <option value="misto">Misto</option>
                </select>
              </label>
            </div>
            <label className="block text-xs font-semibold">
              Método laboratorial
              <Input
                className="mt-1"
                value={form.methodName}
                onChange={e => setForm({ ...form, methodName: e.target.value })}
                placeholder="Ex.: impedância, citometria, espectrofotometria"
              />
            </label>
            <label className="block text-xs font-semibold">
              Documento original
              <Input
                className="mt-1"
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
            </label>
            {file?.type.startsWith("image/") && (
              <Button
                variant="outline"
                disabled={ocr.isPending}
                onClick={analyze}
              >
                {ocr.isPending ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Microscope size={15} />
                )}
                Ler com OCR
              </Button>
            )}
            <label className="block text-xs font-semibold">
              Resumo do resultado
              <Textarea
                className="mt-1"
                value={form.resultSummary}
                onChange={e =>
                  setForm({ ...form, resultSummary: e.target.value })
                }
              />
            </label>
            <label className="block text-xs font-semibold">
              Referência informada no laudo
              <Textarea
                className="mt-1"
                value={form.referenceText}
                onChange={e =>
                  setForm({ ...form, referenceText: e.target.value })
                }
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={close}>
                Cancelar
              </Button>
              <Button disabled={save.isPending} onClick={submit}>
                {save.isPending ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Upload size={15} />
                )}
                Enviar resultado
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProofDialog({ row, close, saved }: any) {
  const [file, setFile] = useState<File | null>(null);
  const [performedAt, setPerformedAt] = useState(
    inputDateTime(row?.performed_at)
  );
  const [name, setName] = useState(row?.professional_name || "");
  const [type, setType] = useState(row?.professional_registry_type || "");
  const [number, setNumber] = useState(row?.professional_registry_number || "");
  useEffect(() => {
    setFile(null);
    setPerformedAt(inputDateTime(row?.performed_at));
    setName(row?.professional_name || "");
    setType(row?.professional_registry_type || "");
    setNumber(row?.professional_registry_number || "");
  }, [row?.id]);
  const mutation = trpc.clinicPortal.uploadSignedProof.useMutation({
    onSuccess: async () => {
      toast.success("Comprovante assinado arquivado.");
      await saved();
      close();
    },
    onError: e => toast.error(e.message),
  });
  const submit = async () => {
    if (!file || !performedAt || !name.trim() || !type.trim() || !number.trim())
      return toast.error(
        "Preencha a realização, o profissional, o registro e selecione o comprovante."
      );
    mutation.mutate({
      orderId: Number(row.id),
      fileName: file.name,
      fileBase64: await fileAsDataUrl(file),
      performedAt,
      professionalName: name,
      registryType: type,
      registryNumber: number,
    });
  };
  return (
    <Dialog open={Boolean(row)} onOpenChange={open => !open && close()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Anexar requisição assinada</DialogTitle>
        </DialogHeader>
        {row && (
          <div className="space-y-4">
            <div className="border bg-slate-50 p-3 text-sm">
              <b>{row.collaborator_name}</b>
              <br />
              {row.exam_name} · {row.order_number}
            </div>
            <label className="block text-xs font-semibold">
              Data e hora da realização
              <Input
                className="mt-1"
                type="datetime-local"
                value={performedAt}
                onChange={e => setPerformedAt(e.target.value)}
              />
            </label>
            <label className="block text-xs font-semibold">
              Profissional responsável
              <Input
                className="mt-1"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </label>
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <label className="text-xs font-semibold">
                Conselho
                <Input
                  className="mt-1"
                  placeholder="CRM, CRFa..."
                  value={type}
                  onChange={e => setType(e.target.value)}
                />
              </label>
              <label className="text-xs font-semibold">
                Número/UF
                <Input
                  className="mt-1"
                  value={number}
                  onChange={e => setNumber(e.target.value)}
                />
              </label>
            </div>
            <label className="block text-xs font-semibold">
              Requisição assinada
              <Input
                className="mt-1"
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={close}>
                Cancelar
              </Button>
              <Button disabled={mutation.isPending} onClick={submit}>
                {mutation.isPending ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <FileCheck2 size={15} />
                )}
                Arquivar comprovante
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BillingPanel({
  from,
  to,
  setFrom,
  setTo,
  data,
  loading,
  generate,
  generating,
  downloadProof,
}: any) {
  const summary = data?.summary || {};
  return (
    <section className="border bg-white">
      <div className="flex flex-wrap items-end gap-3 border-b p-4">
        <label className="text-xs font-semibold">
          Data inicial
          <Input
            className="mt-1"
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
          />
        </label>
        <label className="text-xs font-semibold">
          Data final
          <Input
            className="mt-1"
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
          />
        </label>
        <Button onClick={generate} disabled={generating}>
          {generating ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Download size={15} />
          )}
          Gerar demonstrativo PDF
        </Button>
      </div>
      <div className="grid gap-3 border-b p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Atendimentos"
          value={summary.attendances}
          icon={ClipboardCheck}
        />
        <Metric
          label="Com comprovante"
          value={summary.withProof}
          icon={FileCheck2}
          tone="emerald"
        />
        <Metric
          label="Comprovante pendente"
          value={summary.missingProof}
          icon={FileClock}
          tone="amber"
        />
        <div className="border border-sky-200 bg-sky-50 p-4 text-sky-800">
          <span className="text-xs font-semibold uppercase">Valor total</span>
          <strong className="mt-3 block text-2xl">
            {Number(summary.total || 0).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </strong>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="p-3">Requisição</th>
              <th className="p-3">Funcionário</th>
              <th className="p-3">Exame</th>
              <th className="p-3">Realização</th>
              <th className="p-3">Valor</th>
              <th className="p-3">Comprovante</th>
            </tr>
          </thead>
          <tbody>
            {(data?.rows || []).map((row: any) => (
              <tr key={row.order_id} className="border-t">
                <td className="p-3 font-semibold">{row.order_number}</td>
                <td className="p-3">
                  {row.collaborator_name}
                  <div className="text-xs text-slate-500">{row.cpf || "-"}</div>
                </td>
                <td className="p-3">{row.exam_name}</td>
                <td className="p-3">{localDate(row.performed_at)}</td>
                <td className="p-3">
                  {Number(row.amount || 0).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </td>
                <td className="p-3">
                  {row.proof_private_path ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadProof(Number(row.order_id))}
                    >
                      <FileText size={14} />
                      Abrir
                    </Button>
                  ) : (
                    <span className="text-xs font-semibold text-amber-700">
                      Pendente
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && (
          <p className="p-8 text-center text-sm text-slate-500">
            Carregando produção...
          </p>
        )}
        {!loading && !data?.rows?.length && (
          <p className="p-8 text-center text-sm text-slate-500">
            Nenhum atendimento realizado no período.
          </p>
        )}
      </div>
    </section>
  );
}
