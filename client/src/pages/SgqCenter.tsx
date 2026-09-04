import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GitBranch,
  GraduationCap,
  Library,
  ListChecks,
  RefreshCcw,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const modules = [
  { key: "documentos", label: "Documentos", icon: FileText },
  { key: "processos", label: "Processos", icon: GitBranch },
  { key: "fluxos", label: "Workflows", icon: RefreshCcw },
  { key: "nao_conformidades", label: "Não conformidades", icon: AlertTriangle },
  { key: "causa_raiz", label: "Causa raiz", icon: Target },
  { key: "planos_acao", label: "Planos de ação", icon: ClipboardCheck },
  { key: "riscos_corporativos", label: "Riscos corporativos", icon: ShieldCheck },
  { key: "auditorias", label: "Auditorias", icon: CheckCircle2 },
  { key: "checklists", label: "Checklists", icon: ListChecks },
  { key: "indicadores", label: "Indicadores", icon: BarChart3 },
  { key: "fornecedores", label: "Fornecedores", icon: Users },
  { key: "treinamentos", label: "Treinamentos SGQ", icon: GraduationCap },
  { key: "competencias", label: "Matriz de competências", icon: Users },
  { key: "reunioes_atas", label: "Reuniões e atas", icon: FileText },
  { key: "melhoria_continua", label: "Melhoria contínua", icon: RefreshCcw },
  { key: "biblioteca", label: "Biblioteca corporativa", icon: Library },
  { key: "conformidade_sgq", label: "Central de conformidade", icon: ShieldCheck },
] as const;

const statuses = ["rascunho", "em_andamento", "pendente", "concluido", "aprovado"];

function tone(status: string) {
  if (["concluido", "aprovado"].includes(status)) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "pendente") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

export default function SgqCenter() {
  const { user } = useAuth();
  const isGlobal = ["admin_global", "super_admin"].includes(String(user?.role || ""));
  const [moduleKey, setModuleKey] = useState<(typeof modules)[number]["key"]>("nao_conformidades");
  const [adminOwnerType, setAdminOwnerType] = useState<"company" | "white_label">("company");
  const [adminOwnerId, setAdminOwnerId] = useState("");
  const [adminEnabled, setAdminEnabled] = useState(true);
  const [adminPlan, setAdminPlan] = useState("sgq_start");
  const [adminNotes, setAdminNotes] = useState("");
  const [adminModules, setAdminModules] = useState<string[]>(modules.map(item => item.key));
  const [trainingForm, setTrainingForm] = useState({
    code: "",
    title: "",
    category: "Qualidade",
    workloadMinutes: "120",
    validityMonths: "24",
    description: "",
    availableToWhiteLabel: true,
  });
  const [form, setForm] = useState({
    title: "",
    code: "",
    status: "pendente",
    severity: "",
    processName: "",
    dueDate: "",
    notes: "",
  });
  const utils = trpc.useUtils();
  const summaryQ = trpc.sgq.summary.useQuery();
  const recordsQ = trpc.sgq.listRecords.useQuery({ moduleKey });
  const trainingsQ = trpc.sgq.listTrainingCatalog.useQuery();
  const productSettingsQ = (trpc.sgq as any).listProductSettings.useQuery(undefined, {
    enabled: isGlobal,
  });
  const companiesQ = (trpc.superAdmin as any).listCompanies.useQuery(undefined, {
    enabled: isGlobal,
  });
  const whiteLabelsQ = (trpc.superAdmin as any).whiteLabelListPartners.useQuery(undefined, {
    enabled: isGlobal,
  });
  const saveSettings = (trpc.sgq as any).setProductSettings.useMutation({
    onSuccess: () => {
      toast.success("Configuração comercial do SGQ salva.");
      productSettingsQ.refetch();
      summaryQ.refetch();
    },
    onError: (error: any) => toast.error(error.message || "Não foi possível salvar a configuração SGQ."),
  });
  const saveOfficialTraining = (trpc.sgq as any).upsertOfficialTraining.useMutation({
    onSuccess: () => {
      toast.success("Treinamento oficial SGQ publicado.");
      setTrainingForm({
        code: "",
        title: "",
        category: "Qualidade",
        workloadMinutes: "120",
        validityMonths: "24",
        description: "",
        availableToWhiteLabel: true,
      });
      trainingsQ.refetch();
      summaryQ.refetch();
    },
    onError: (error: any) => toast.error(error.message || "Não foi possível publicar o treinamento."),
  });
  const saveRecord = trpc.sgq.upsertRecord.useMutation({
    onSuccess: () => {
      toast.success("Registro SGQ salvo.");
      setForm({
        title: "",
        code: "",
        status: "pendente",
        severity: "",
        processName: "",
        dueDate: "",
        notes: "",
      });
      utils.sgq.summary.invalidate();
      utils.sgq.listRecords.invalidate();
    },
  });
  const archiveRecord = trpc.sgq.archiveRecord.useMutation({
    onSuccess: () => {
      toast.success("Registro arquivado.");
      utils.sgq.summary.invalidate();
      utils.sgq.listRecords.invalidate();
    },
  });
  const counters = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of (summaryQ.data?.counters || []) as any[]) {
      map.set(`${row.module_key}:${row.status}`, Number(row.total || 0));
    }
    return map;
  }, [summaryQ.data]);
  const totalByModule = (key: string) =>
    statuses.reduce((sum, status) => sum + (counters.get(`${key}:${status}`) || 0), 0);
  const selected = modules.find(item => item.key === moduleKey) || modules[0];
  const records = (recordsQ.data || []) as any[];
  const set = (key: string, value: string) =>
    setForm(current => ({ ...current, [key]: value }));
  const ownerOptions =
    adminOwnerType === "company"
      ? ((companiesQ.data || []) as any[]).map(company => ({
          id: Number(company.id),
          label: `${company.name}${company.cnpj ? ` - ${company.cnpj}` : ""}`,
        }))
      : ((whiteLabelsQ.data || []) as any[]).map(label => ({
          id: Number(label.id),
          label: label.brand_name || label.company_name || label.name || `White Label #${label.id}`,
        }));
  const toggleAdminModule = (key: string, checked: boolean) =>
    setAdminModules(current =>
      checked ? Array.from(new Set([...current, key])) : current.filter(item => item !== key)
    );

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-teal-700">
              Vertical independente
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">
              SGQ - Sistema de Gestão da Qualidade
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Documentos, processos, não conformidades, auditorias, indicadores,
              fornecedores e treinamentos corporativos em uma área própria, sem
              depender dos módulos de SST.
            </p>
          </div>
          <Badge className="rounded-sm border bg-white px-3 py-1 text-slate-700">
            {summaryQ.data?.settings?.product_enabled ? "Produto habilitado" : "Produto em parametrização"}
          </Badge>
        </div>

        {isGlobal && (
          <section className="border bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Administração SuperAdmin
                </p>
                <h2 className="text-lg font-semibold text-slate-900">
                  Produto SGQ, White Label e treinamentos oficiais
                </h2>
                <p className="text-sm text-slate-600">
                  Controle comercial independente da vertical SGQ. O cliente pode
                  contratar SGQ sem depender de SESMT, PGR, PCMSO ou SST.
                </p>
              </div>
              <Badge className="rounded-sm border border-teal-200 bg-teal-50 text-teal-800">
                SuperAdmin controla e publica
              </Badge>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="border p-3">
                <h3 className="font-semibold text-slate-900">
                  Habilitação por empresa ou White Label
                </h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="text-xs font-semibold">
                    Tipo
                    <select
                      className="mt-1 h-10 w-full border bg-white px-3 text-sm"
                      value={adminOwnerType}
                      onChange={event => {
                        setAdminOwnerType(event.target.value as "company" | "white_label");
                        setAdminOwnerId("");
                      }}
                    >
                      <option value="company">Empresa cliente</option>
                      <option value="white_label">White Label</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold">
                    Destino
                    <select
                      className="mt-1 h-10 w-full border bg-white px-3 text-sm"
                      value={adminOwnerId}
                      onChange={event => setAdminOwnerId(event.target.value)}
                    >
                      <option value="">Selecione</option>
                      {ownerOptions.map(option => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold">
                    Plano comercial
                    <select
                      className="mt-1 h-10 w-full border bg-white px-3 text-sm"
                      value={adminPlan}
                      onChange={event => setAdminPlan(event.target.value)}
                    >
                      <option value="sgq_start">SGQ Start</option>
                      <option value="sgq_business">SGQ Business</option>
                      <option value="sgq_premium">SGQ Premium</option>
                      <option value="sgq_white_label">SGQ White Label</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={adminEnabled}
                      onChange={event => setAdminEnabled(event.target.checked)}
                    />
                    Produto habilitado
                  </label>
                  <label className="text-xs font-semibold md:col-span-2">
                    Observações comerciais
                    <Textarea
                      className="mt-1"
                      value={adminNotes}
                      onChange={event => setAdminNotes(event.target.value)}
                      placeholder="Ex.: contratado apenas SGQ Business, sem módulos de SST."
                    />
                  </label>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {modules.map(item => (
                    <label key={item.key} className="flex items-center gap-2 border px-3 py-2 text-xs">
                      <input
                        type="checkbox"
                        checked={adminModules.includes(item.key)}
                        onChange={event => toggleAdminModule(item.key, event.target.checked)}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex justify-end">
                  <Button
                    disabled={!adminOwnerId || saveSettings.isPending}
                    onClick={() =>
                      saveSettings.mutate({
                        ownerType: adminOwnerType,
                        ownerId: Number(adminOwnerId),
                        enabled: adminEnabled,
                        modules: adminModules,
                        commercialPlan: adminPlan,
                        notes: adminNotes || undefined,
                      })
                    }
                  >
                    Salvar habilitação
                  </Button>
                </div>
              </div>

              <div className="border p-3">
                <h3 className="font-semibold text-slate-900">
                  Treinamento oficial SGQ
                </h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="text-xs font-semibold">
                    Código
                    <Input className="mt-1" value={trainingForm.code} onChange={event => setTrainingForm(current => ({ ...current, code: event.target.value }))} />
                  </label>
                  <label className="text-xs font-semibold">
                    Categoria
                    <Input className="mt-1" value={trainingForm.category} onChange={event => setTrainingForm(current => ({ ...current, category: event.target.value }))} />
                  </label>
                  <label className="text-xs font-semibold md:col-span-2">
                    Nome do curso
                    <Input className="mt-1" value={trainingForm.title} onChange={event => setTrainingForm(current => ({ ...current, title: event.target.value }))} />
                  </label>
                  <label className="text-xs font-semibold">
                    Carga horária em minutos
                    <Input className="mt-1" type="number" value={trainingForm.workloadMinutes} onChange={event => setTrainingForm(current => ({ ...current, workloadMinutes: event.target.value }))} />
                  </label>
                  <label className="text-xs font-semibold">
                    Validade em meses
                    <Input className="mt-1" type="number" value={trainingForm.validityMonths} onChange={event => setTrainingForm(current => ({ ...current, validityMonths: event.target.value }))} />
                  </label>
                  <label className="flex items-center gap-2 border px-3 py-2 text-sm md:col-span-2">
                    <input
                      type="checkbox"
                      checked={trainingForm.availableToWhiteLabel}
                      onChange={event => setTrainingForm(current => ({ ...current, availableToWhiteLabel: event.target.checked }))}
                    />
                    Disponibilizar para White Labels
                  </label>
                  <label className="text-xs font-semibold md:col-span-2">
                    Descrição comercial/técnica
                    <Textarea className="mt-1" value={trainingForm.description} onChange={event => setTrainingForm(current => ({ ...current, description: event.target.value }))} />
                  </label>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button
                    disabled={!trainingForm.code.trim() || !trainingForm.title.trim() || saveOfficialTraining.isPending}
                    onClick={() =>
                      saveOfficialTraining.mutate({
                        code: trainingForm.code.trim(),
                        title: trainingForm.title.trim(),
                        category: trainingForm.category || undefined,
                        workloadMinutes: Number(trainingForm.workloadMinutes || 0),
                        validityMonths: trainingForm.validityMonths ? Number(trainingForm.validityMonths) : null,
                        description: trainingForm.description || undefined,
                        modules: ["treinamentos", "competencias", "conformidade_sgq"],
                        availableToWhiteLabel: trainingForm.availableToWhiteLabel,
                      })
                    }
                  >
                    Publicar treinamento
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-2">Destino</th>
                    <th className="p-2">Plano</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Módulos</th>
                  </tr>
                </thead>
                <tbody>
                  {((productSettingsQ.data || []) as any[]).map(row => (
                    <tr key={`${row.owner_type}-${row.owner_id}`} className="border-t">
                      <td className="p-2">
                        <b>{row.company_name || `${row.owner_type} #${row.owner_id}`}</b>
                        <p className="text-xs text-slate-500">{row.company_cnpj || row.owner_type}</p>
                      </td>
                      <td className="p-2">{row.commercial_plan || "-"}</td>
                      <td className="p-2">{Number(row.product_enabled) ? "Habilitado" : "Desabilitado"}</td>
                      <td className="p-2">{Array.isArray(row.modules) ? row.modules.length : 0}</td>
                    </tr>
                  ))}
                  {!productSettingsQ.data?.length && (
                    <tr>
                      <td className="p-5 text-center text-sm text-slate-500" colSpan={4}>
                        Nenhuma habilitação SGQ registrada ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="Registros vencidos" value={summaryQ.data?.overdue || 0} />
          <Metric label="Treinamentos oficiais" value={summaryQ.data?.officialTrainings || 0} />
          <Metric label="Módulos SGQ" value={modules.length} />
          <Metric label="Registros do módulo" value={records.length} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[290px_minmax(0,1fr)]">
          <div className="space-y-2">
            {modules.map(item => {
              const Icon = item.icon;
              const active = item.key === moduleKey;
              return (
                <button
                  key={item.key}
                  className={`flex w-full items-center justify-between border px-3 py-2 text-left text-sm transition ${
                    active ? "border-teal-500 bg-teal-50 text-teal-900" : "bg-white hover:bg-slate-50"
                  }`}
                  onClick={() => setModuleKey(item.key)}
                >
                  <span className="flex items-center gap-2">
                    <Icon size={16} />
                    {item.label}
                  </span>
                  <span className="text-xs text-slate-500">{totalByModule(item.key)}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-4">
            <section className="border bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {selected.label}
                  </h2>
                  <p className="text-sm text-slate-600">
                    Registre itens do SGQ com status, processo, responsável,
                    prazo, evidências e dados complementares.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="text-xs font-semibold">
                  Título
                  <Input className="mt-1" value={form.title} onChange={e => set("title", e.target.value)} />
                </label>
                <label className="text-xs font-semibold">
                  Código
                  <Input className="mt-1" value={form.code} onChange={e => set("code", e.target.value)} placeholder="NC-2026-001" />
                </label>
                <label className="text-xs font-semibold">
                  Status
                  <select className="mt-1 h-10 w-full border bg-white px-3 text-sm" value={form.status} onChange={e => set("status", e.target.value)}>
                    {statuses.map(status => (
                      <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold">
                  Severidade / prioridade
                  <Input className="mt-1" value={form.severity} onChange={e => set("severity", e.target.value)} placeholder="Baixa, média, alta..." />
                </label>
                <label className="text-xs font-semibold">
                  Processo
                  <Input className="mt-1" value={form.processName} onChange={e => set("processName", e.target.value)} />
                </label>
                <label className="text-xs font-semibold">
                  Prazo
                  <Input className="mt-1" type="date" value={form.dueDate} onChange={e => set("dueDate", e.target.value)} />
                </label>
                <label className="text-xs font-semibold md:col-span-2">
                  Observações e evidências
                  <Textarea className="mt-1" value={form.notes} onChange={e => set("notes", e.target.value)} />
                </label>
              </div>
              <div className="mt-3 flex justify-end">
                <Button
                  disabled={!form.title.trim() || saveRecord.isPending}
                  onClick={() =>
                    saveRecord.mutate({
                      moduleKey,
                      title: form.title,
                      code: form.code || undefined,
                      status: form.status,
                      severity: form.severity || undefined,
                      processName: form.processName || undefined,
                      dueDate: form.dueDate || undefined,
                      metadata: { notes: form.notes },
                    })
                  }
                >
                  Salvar no SGQ
                </Button>
              </div>
            </section>

            <section className="border bg-white p-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Registros do módulo
              </h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="p-2">Item</th>
                      <th className="p-2">Processo</th>
                      <th className="p-2">Prazo</th>
                      <th className="p-2">Status</th>
                      <th className="p-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(row => (
                      <tr key={row.id} className="border-t">
                        <td className="p-2">
                          <b>{row.title}</b>
                          <p className="text-xs text-slate-500">{row.code || "sem código"}</p>
                        </td>
                        <td className="p-2">{row.process_name || "-"}</td>
                        <td className="p-2">{row.due_date || "-"}</td>
                        <td className="p-2">
                          <Badge className={`rounded-sm border ${tone(row.status)}`}>
                            {String(row.status).replaceAll("_", " ")}
                          </Badge>
                        </td>
                        <td className="p-2 text-right">
                          <Button size="sm" variant="outline" onClick={() => archiveRecord.mutate({ id: Number(row.id) })}>
                            Arquivar
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {!records.length && (
                      <tr>
                        <td className="p-8 text-center text-sm text-slate-500" colSpan={5}>
                          Nenhum registro neste módulo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="border bg-white p-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <BookOpen size={18} /> Catálogo oficial de treinamentos SGQ
              </h2>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {((trainingsQ.data || []) as any[]).slice(0, 8).map(item => (
                  <div key={item.id} className="border p-3 text-sm">
                    <b>{item.title}</b>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.code} · {item.category || "Qualidade"} · {item.workload_minutes || 0} min
                    </p>
                  </div>
                ))}
                {!trainingsQ.data?.length && (
                  <p className="text-sm text-slate-500">
                    O SuperAdmin ainda não publicou treinamentos oficiais de SGQ.
                  </p>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border bg-white p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
