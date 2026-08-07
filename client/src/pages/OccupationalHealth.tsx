import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  AlertTriangle,
  Archive,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Download,
  FileText,
  HeartPulse,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

const api = (trpc as any).occupationalHealth;
const healthRoles = new Set([
  "rh",
  "sesmt",
  "admin",
  "company_admin",
  "admin_global",
  "super_admin",
]);
const statusLabel: Record<string, string> = {
  pendente: "Pendente",
  em_analise: "Em análise",
  validado: "Validado",
  validado_com_ressalva: "Validado com ressalva",
  necessita_correcao: "Necessita correção",
  arquivado: "Arquivado",
  retorno_previsto: "Retorno previsto",
  aguardando_retorno: "Aguardando retorno",
  retornou: "Retornou",
  retorno_pendente: "Retorno pendente",
  afastamento_prorrogado: "Afastamento prorrogado",
  novo_afastamento: "Novo afastamento",
  encaminhado_avaliacao: "Encaminhado para avaliação",
  retorno_concluido: "Retorno concluído",
};
function fmt(v: any) {
  return v ? new Date(v).toLocaleDateString("pt-BR") : "-";
}
function num(v: any) {
  return Number(v || 0).toLocaleString("pt-BR");
}

export default function OccupationalHealth() {
  const { user } = useAuth();
  const role = String(user?.role || "");
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6">
        <style>{`.field{width:100%;border:1px solid #cbd5e1;border-radius:6px;padding:8px;background:#fff;min-height:38px}.field:focus{outline:2px solid rgba(14,44,70,.15);border-color:#0E2C46}`}</style>
        {healthRoles.has(role) ? (
          <AdminView />
        ) : role === "chefia" ? (
          <ManagerView />
        ) : (
          <EmployeeView />
        )}
      </div>
    </AppLayout>
  );
}

function PageHeader({ employee = false }: { employee?: boolean }) {
  return (
    <header className="mb-5">
      <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
        <HeartPulse size={24} />
        {employee
          ? "Meus Atestados e Afastamentos"
          : "Gestão de Atestados e Afastamentos"}
      </h1>
      <p className="text-sm text-muted-foreground mt-1">
        {employee
          ? "Envie documentos e acompanhe análise, afastamento e retorno."
          : "Validação, absenteísmo, recorrências, retorno ao trabalho e auditoria."}
      </p>
    </header>
  );
}

function EmployeeView() {
  const q = api.myCases.useQuery();
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHeader employee />
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">
          Seus documentos ficam protegidos e disponíveis apenas aos perfis
          autorizados.
        </p>
        <Button onClick={() => setOpen(true)}>
          <Plus size={14} />
          Novo documento
        </Button>
      </div>
      <div className="border rounded-md bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-3 text-left">Tipo</th>
              <th className="p-3 text-left">Período</th>
              <th className="p-3 text-right">Duração</th>
              <th className="p-3 text-left">Análise</th>
              <th className="p-3 text-left">Retorno</th>
              <th className="p-3 text-left">Alertas</th>
            </tr>
          </thead>
          <tbody>
            {(q.data ?? []).map((c: any) => (
              <tr key={c.id} className="border-t">
                <td className="p-3 capitalize">{c.document_type}</td>
                <td className="p-3">
                  {fmt(c.start_date)} a {fmt(c.end_date)}
                </td>
                <td className="p-3 text-right">
                  {c.duration_unit === "hours"
                    ? `${c.total_hours} h`
                    : `${c.total_days} dia(s)`}
                </td>
                <td className="p-3 font-medium">
                  {statusLabel[c.status] || c.status}
                </td>
                <td className="p-3">
                  {statusLabel[c.return_status] || c.return_status}
                  <div className="text-xs text-muted-foreground">
                    {fmt(c.return_expected_date)}
                  </div>
                </td>
                <td className="p-3">
                  {c.benefit_review_required ? (
                    <Tag text="> 15 dias" tone="rose" />
                  ) : null}
                  {c.recurrence_review_required ? (
                    <Tag text="Recorrência" tone="amber" />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!q.data?.length && <Empty text="Nenhum documento registrado." />}
      </div>
      {open && (
        <NewCaseModal
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            q.refetch();
          }}
        />
      )}
    </>
  );
}

function NewCaseModal({ onClose, onSaved }: { onClose: any; onSaved: any }) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState<any>({
    documentType: "atestado",
    durationUnit: "days",
    issueDate: today,
    startDate: today,
    endDate: today,
    totalDays: 1,
    totalHours: 0,
    issuerName: "",
    issuerRegistration: "",
    cidCode: "",
    medicalReason: "",
    administrativeNote: "",
    file: null,
  });
  const create = api.create.useMutation({
    onSuccess: (r: any) => {
      toast.success(
        r.recurrenceReviewRequired
          ? "Documento enviado. Foi sinalizada possível recorrência para análise."
          : "Documento enviado ao RH."
      );
      onSaved();
    },
    onError: (e: any) => toast.error(e.message),
  });
  function save() {
    if (!f.file) return toast.error("Anexe o documento.");
    const reader = new FileReader();
    reader.onload = () =>
      create.mutate({
        ...f,
        fileBase64: String(reader.result),
        fileName: f.file.name,
        mimeType: f.file.type,
        file: undefined,
      });
    reader.readAsDataURL(f.file);
  }
  return (
    <Modal title="Novo atestado ou afastamento" onClose={onClose}>
      <div className="grid md:grid-cols-2 gap-3">
        <Field label="Tipo">
          <select
            className="field"
            value={f.documentType}
            onChange={e => setF({ ...f, documentType: e.target.value })}
          >
            <option value="atestado">Atestado</option>
            <option value="declaracao">Declaração</option>
            <option value="afastamento">Afastamento</option>
            <option value="outro">Outro</option>
          </select>
        </Field>
        <Field label="Forma de duração">
          <select
            className="field"
            value={f.durationUnit}
            onChange={e => setF({ ...f, durationUnit: e.target.value })}
          >
            <option value="days">Em dias</option>
            <option value="hours">Em horas</option>
          </select>
        </Field>
        <Field label="Data de emissão">
          <Input
            type="date"
            value={f.issueDate}
            onChange={e => setF({ ...f, issueDate: e.target.value })}
          />
        </Field>
        <Field label="Data inicial">
          <Input
            type="date"
            value={f.startDate}
            onChange={e => setF({ ...f, startDate: e.target.value })}
          />
        </Field>
        <Field label="Data final">
          <Input
            type="date"
            value={f.endDate}
            onChange={e => setF({ ...f, endDate: e.target.value })}
          />
        </Field>
        {f.durationUnit === "days" ? (
          <Field label="Quantidade de dias">
            <Input
              type="number"
              min={1}
              value={f.totalDays}
              onChange={e => setF({ ...f, totalDays: Number(e.target.value) })}
            />
          </Field>
        ) : (
          <>
            <Field label="Quantidade de horas">
              <Input
                type="number"
                step="0.5"
                value={f.totalHours}
                onChange={e =>
                  setF({ ...f, totalHours: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Horário inicial">
              <Input
                type="time"
                value={f.startTime || ""}
                onChange={e => setF({ ...f, startTime: e.target.value })}
              />
            </Field>
            <Field label="Horário final">
              <Input
                type="time"
                value={f.endTime || ""}
                onChange={e => setF({ ...f, endTime: e.target.value })}
              />
            </Field>
          </>
        )}
        <Field label="Profissional emitente">
          <Input
            value={f.issuerName}
            onChange={e => setF({ ...f, issuerName: e.target.value })}
          />
        </Field>
        <Field label="Registro profissional">
          <Input
            value={f.issuerRegistration}
            onChange={e => setF({ ...f, issuerRegistration: e.target.value })}
          />
        </Field>
        <Field label="CID, quando aplicável">
          <Input
            value={f.cidCode}
            onChange={e => setF({ ...f, cidCode: e.target.value })}
          />
          <span className="text-[11px] text-muted-foreground">
            Campo sensível, visível somente a perfis autorizados.
          </span>
        </Field>
        <Field label="Observação administrativa">
          <Input
            value={f.administrativeNote}
            onChange={e => setF({ ...f, administrativeNote: e.target.value })}
          />
        </Field>
        <Field label="Documento" wide>
          <label className="border-2 border-dashed rounded-md p-5 flex items-center justify-center gap-2 cursor-pointer">
            <Upload size={18} />
            {f.file?.name || "Selecionar PDF, PNG ou JPG"}
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              className="hidden"
              onChange={e => setF({ ...f, file: e.target.files?.[0] || null })}
            />
          </label>
        </Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={save} disabled={create.isPending}>
          {create.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Upload size={14} />
          )}
          Enviar para análise
        </Button>
      </div>
    </Modal>
  );
}

type AdminTab =
  | "dashboard"
  | "queue"
  | "archive"
  | "alerts"
  | "returns"
  | "reports";
function AdminView() {
  const [tab, setTab] = useState<AdminTab>("dashboard");
  const [manualOpen, setManualOpen] = useState(false);
  const tabs: Array<[AdminTab, string, any]> = [
    ["dashboard", "Absenteísmo", BarChart3],
    ["queue", "Fila de análise", FileText],
    ["archive", "Arquivo de atestados", Archive],
    ["alerts", "Alertas", AlertTriangle],
    ["returns", "Retorno ao trabalho", RotateCcw],
    ["reports", "Relatórios", Download],
  ];
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <PageHeader />
        <Button onClick={() => setManualOpen(true)}>
          <Plus size={14} />
          Cadastrar atestado manualmente
        </Button>
      </div>
      <div className="flex gap-1 border-b overflow-x-auto mb-5">
        {tabs.map(([k, l, I]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3 py-2 border-b-2 -mb-px text-sm whitespace-nowrap ${tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
          >
            <span className="inline-flex items-center gap-1.5">
              <I size={14} />
              {l}
            </span>
          </button>
        ))}
      </div>
      {tab === "dashboard" && <Dashboard />}
      {tab === "queue" && <Queue />}
      {tab === "archive" && <LeaveArchive />}
      {tab === "alerts" && <Alerts />}
      {tab === "returns" && <Returns />}
      {tab === "reports" && <Reports />}
      {manualOpen && (
        <ManualCaseModal
          onClose={() => setManualOpen(false)}
          onSaved={() => {
            setManualOpen(false);
            setTab("queue");
          }}
        />
      )}
    </>
  );
}

function Dashboard() {
  const q = api.dashboard.useQuery();
  const d = q.data || {};
  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Atestados e afastamentos" value={num(d.total_cases)} />
        <Metric label="Dias perdidos" value={num(d.days_lost)} />
        <Metric label="Horas perdidas" value={num(d.hours_lost)} />
        <Metric label="Taxa de absenteísmo" value={`${num(d.absence_rate)}%`} />
        <Metric
          label="Média de dias"
          value={Number(d.avg_days || 0).toFixed(1)}
        />
        <Metric
          label="Recorrências em análise"
          value={num(d.recurrent_cases)}
        />
        <Metric label="Acima de 15 dias" value={num(d.over_15_days)} />
        <Metric label="Pendentes" value={num(d.pending_cases)} />
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <SimpleBars title="Por mês" rows={d.byMonth || []} valueKey="days" />
        <SimpleBars title="Por setor" rows={d.bySector || []} valueKey="days" />
      </div>
    </div>
  );
}
function SimpleBars({
  title,
  rows,
  valueKey,
}: {
  title: string;
  rows: any[];
  valueKey: string;
}) {
  const max = Math.max(1, ...rows.map(x => Number(x[valueKey] || 0)));
  return (
    <section className="border-t pt-4">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-3 space-y-2">
        {rows.map((r: any) => (
          <div key={r.label}>
            <div className="flex justify-between text-xs">
              <span>{r.label}</span>
              <b>{r[valueKey] || 0} dia(s)</b>
            </div>
            <div className="h-2 bg-slate-100 mt-1">
              <div
                className="h-2 bg-primary"
                style={{
                  width: `${Math.max(3, (Number(r[valueKey] || 0) / max) * 100)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ManualCaseModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const collaboratorsQ = api.collaborators.useQuery();
  const [f, setF] = useState<any>({
    collaboratorId: "",
    documentType: "atestado",
    durationUnit: "days",
    issueDate: today,
    startDate: today,
    endDate: today,
    totalDays: 1,
    totalHours: 0,
    issuerName: "",
    issuerRegistration: "",
    cidCode: "",
    administrativeNote: "",
    file: null,
  });
  const [ocrResult, setOcrResult] = useState<any>(null);
  const create = api.createManual.useMutation({
    onSuccess: () => {
      toast.success("Atestado cadastrado e enviado à fila de análise.");
      onSaved();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const ocr = api.analyzeDocument.useMutation({
    onSuccess: (result: any) => {
      setOcrResult(result);
      if (!result.available) return toast.warning(result.message);
      const x = result.fields || {};
      setF((old: any) => ({
        ...old,
        documentType: [
          "atestado",
          "declaracao",
          "afastamento",
          "outro",
        ].includes(x.documentType)
          ? x.documentType
          : old.documentType,
        issueDate: x.issueDate || old.issueDate,
        startDate: x.startDate || old.startDate,
        endDate: x.endDate || old.endDate,
        totalDays: Number(x.totalDays || old.totalDays),
        totalHours: Number(x.totalHours || old.totalHours),
        issuerName: x.issuerName || old.issuerName,
        issuerRegistration: x.issuerRegistration || old.issuerRegistration,
        cidCode: x.cidCode || old.cidCode,
      }));
      toast.success("Leitura concluída. Confira todos os campos.");
    },
    onError: (e: any) => toast.error(e.message),
  });
  async function runOcr() {
    if (!f.file) return toast.error("Selecione uma foto do documento.");
    ocr.mutate({
      fileBase64: await readAsDataUrl(f.file),
      mimeType: f.file.type,
    });
  }
  async function save() {
    if (!f.collaboratorId) return toast.error("Selecione o colaborador.");
    if (!f.file) return toast.error("Anexe o documento original.");
    create.mutate({
      ...f,
      collaboratorId: Number(f.collaboratorId),
      fileBase64: await readAsDataUrl(f.file),
      fileName: f.file.name,
      mimeType: f.file.type,
      file: undefined,
    });
  }
  return (
    <Modal title="Cadastrar atestado manualmente" onClose={onClose}>
      <p className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        Use quando o RH receber o documento físico. O arquivo original será
        preservado no armazenamento privado e enviado à fila de análise.
      </p>
      <div className="grid md:grid-cols-2 gap-3">
        <Field label="Colaborador" wide>
          <select
            className="field"
            value={f.collaboratorId}
            onChange={e => setF({ ...f, collaboratorId: e.target.value })}
          >
            <option value="">Selecione...</option>
            {(collaboratorsQ.data || []).map((u: any) => (
              <option key={u.id} value={u.id}>
                {u.name} · {u.cpf || u.email || "sem identificador"} ·{" "}
                {u.branch_name || ""}/{u.sector_name || ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tipo">
          <select
            className="field"
            value={f.documentType}
            onChange={e => setF({ ...f, documentType: e.target.value })}
          >
            <option value="atestado">Atestado</option>
            <option value="declaracao">Declaração</option>
            <option value="afastamento">Afastamento</option>
            <option value="outro">Outro</option>
          </select>
        </Field>
        <Field label="Duração">
          <select
            className="field"
            value={f.durationUnit}
            onChange={e => setF({ ...f, durationUnit: e.target.value })}
          >
            <option value="days">Em dias</option>
            <option value="hours">Em horas</option>
          </select>
        </Field>
        <Field label="Data de emissão">
          <Input
            type="date"
            value={f.issueDate}
            onChange={e => setF({ ...f, issueDate: e.target.value })}
          />
        </Field>
        <Field label="Data inicial">
          <Input
            type="date"
            value={f.startDate}
            onChange={e => setF({ ...f, startDate: e.target.value })}
          />
        </Field>
        <Field label="Data final">
          <Input
            type="date"
            value={f.endDate}
            onChange={e => setF({ ...f, endDate: e.target.value })}
          />
        </Field>
        {f.durationUnit === "days" ? (
          <Field label="Quantidade de dias">
            <Input
              type="number"
              min={1}
              value={f.totalDays}
              onChange={e => setF({ ...f, totalDays: Number(e.target.value) })}
            />
          </Field>
        ) : (
          <Field label="Quantidade de horas">
            <Input
              type="number"
              min={0.5}
              step="0.5"
              value={f.totalHours}
              onChange={e => setF({ ...f, totalHours: Number(e.target.value) })}
            />
          </Field>
        )}
        <Field label="Profissional emitente">
          <Input
            value={f.issuerName}
            onChange={e => setF({ ...f, issuerName: e.target.value })}
          />
        </Field>
        <Field label="Registro profissional">
          <Input
            value={f.issuerRegistration}
            onChange={e => setF({ ...f, issuerRegistration: e.target.value })}
          />
        </Field>
        <Field label="CID, quando aplicável">
          <Input
            value={f.cidCode}
            onChange={e => setF({ ...f, cidCode: e.target.value })}
          />
          <span className="text-[11px] text-muted-foreground">
            Dado sensível. A chefia não terá acesso.
          </span>
        </Field>
        <Field label="Observação administrativa">
          <Input
            value={f.administrativeNote}
            onChange={e => setF({ ...f, administrativeNote: e.target.value })}
          />
        </Field>
        <Field label="Documento original" wide>
          <label className="border-2 border-dashed rounded-md p-5 flex items-center justify-center gap-2 cursor-pointer">
            <Upload size={18} />
            {f.file?.name || "Selecionar PDF, PNG ou JPG"}
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              className="hidden"
              onChange={e => {
                setF({ ...f, file: e.target.files?.[0] || null });
                setOcrResult(null);
              }}
            />
          </label>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              OCR é assistivo e não comprova autenticidade.
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={runOcr}
              disabled={!f.file || ocr.isPending}
            >
              {ocr.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              Ler com OCR
            </Button>
          </div>
          {ocrResult && (
            <div
              className={`mt-2 rounded p-2 text-xs ${ocrResult.available ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}
            >
              {ocrResult.message}
              {ocrResult.warnings?.length ? (
                <ul className="mt-1 list-disc pl-4">
                  {ocrResult.warnings.map((w: string) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={save} disabled={create.isPending}>
          {create.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Upload size={14} />
          )}
          Enviar para análise
        </Button>
      </div>
    </Modal>
  );
}

function LeaveArchive() {
  const [filters, setFilters] = useState<any>({});
  const [selected, setSelected] = useState<number | null>(null);
  const q = api.archive.useQuery(filters);
  const rows = q.data || [];
  const employees = Array.from(
    new Map(
      rows.map((r: any) => [Number(r.collaborator_id), r.collaborator_name])
    ).entries()
  ) as Array<[number, string]>;
  const branches = Array.from(
    new Map(
      rows
        .filter((r: any) => r.branch_id)
        .map((r: any) => [Number(r.branch_id), r.branch_name])
    ).entries()
  ) as Array<[number, string]>;
  const sectors = Array.from(
    new Map(
      rows
        .filter((r: any) => r.sector_id)
        .map((r: any) => [Number(r.sector_id), r.sector_name])
    ).entries()
  ) as Array<[number, string]>;
  return (
    <>
      <div className="mb-4 grid gap-2 md:grid-cols-7">
        <select
          className="field"
          value={filters.collaboratorId || ""}
          onChange={e =>
            setFilters({
              ...filters,
              collaboratorId: e.target.value
                ? Number(e.target.value)
                : undefined,
            })
          }
        >
          <option value="">Todos os funcionários</option>
          {employees.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          className="field"
          value={filters.branchId || ""}
          onChange={e =>
            setFilters({
              ...filters,
              branchId: e.target.value ? Number(e.target.value) : undefined,
              sectorId: undefined,
            })
          }
        >
          <option value="">Todas as filiais</option>
          {branches.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          className="field"
          value={filters.sectorId || ""}
          onChange={e =>
            setFilters({
              ...filters,
              sectorId: e.target.value ? Number(e.target.value) : undefined,
            })
          }
        >
          <option value="">Todos os setores</option>
          {sectors.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          className="field"
          value={filters.documentType || ""}
          onChange={e =>
            setFilters({
              ...filters,
              documentType: e.target.value || undefined,
            })
          }
        >
          <option value="">Todos os tipos</option>
          <option value="atestado">Atestado</option>
          <option value="declaracao">Declaração</option>
          <option value="afastamento">Afastamento</option>
          <option value="outro">Outro</option>
        </select>
        <Input
          type="number"
          min={2000}
          max={2100}
          placeholder="Ano"
          value={filters.year || ""}
          onChange={e =>
            setFilters({
              ...filters,
              year: e.target.value ? Number(e.target.value) : undefined,
            })
          }
        />
        <Input
          type="date"
          value={filters.dateFrom || ""}
          onChange={e =>
            setFilters({ ...filters, dateFrom: e.target.value || undefined })
          }
        />
        <Input
          type="date"
          value={filters.dateTo || ""}
          onChange={e =>
            setFilters({ ...filters, dateTo: e.target.value || undefined })
          }
        />
      </div>
      <div className="overflow-x-auto rounded-md border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-3 text-left">Funcionário</th>
              <th className="p-3 text-left">Filial / Setor</th>
              <th className="p-3 text-left">Documento</th>
              <th className="p-3 text-left">Período</th>
              <th className="p-3 text-left">Arquivado por</th>
              <th className="p-3">Arquivos</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c: any) => (
              <tr key={c.id} className="border-t">
                <td className="p-3">
                  <b>{c.collaborator_name}</b>
                  <div className="text-xs text-muted-foreground">
                    {c.cpf || "-"}
                  </div>
                </td>
                <td className="p-3">
                  {c.branch_name || "-"} / {c.sector_name || "-"}
                </td>
                <td className="p-3 capitalize">
                  {c.document_type}
                  <div className="text-xs text-muted-foreground">
                    {fmt(c.issue_date)}
                  </div>
                </td>
                <td className="p-3">
                  {fmt(c.start_date)} a {fmt(c.end_date)}
                </td>
                <td className="p-3">
                  {c.archived_by_name || "-"}
                  <div className="text-xs text-muted-foreground">
                    {c.archived_at
                      ? new Date(c.archived_at).toLocaleString("pt-BR")
                      : "-"}
                  </div>
                </td>
                <td className="p-3 text-center">{c.documents_count}</td>
                <td className="p-3 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelected(Number(c.id))}
                  >
                    <Search size={14} />
                    Consultar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <Empty text="Nenhum documento arquivado com estes filtros." />
        )}
      </div>
      {selected && (
        <CaseModal
          id={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setSelected(null);
            q.refetch();
          }}
        />
      )}
    </>
  );
}

function Queue() {
  const q = api.listQueue.useQuery();
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <>
      <div className="border rounded-md bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-3 text-left">Colaborador</th>
              <th className="p-3 text-left">Período</th>
              <th className="p-3 text-right">Duração</th>
              <th className="p-3 text-left">Consistência</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {(q.data ?? []).map((c: any) => (
              <tr key={c.id} className="border-t">
                <td className="p-3">
                  <b>{c.collaborator_name}</b>
                  <div className="text-xs text-muted-foreground">
                    {c.branch_name || ""} · {c.sector_name || ""}
                  </div>
                </td>
                <td className="p-3">
                  {fmt(c.start_date)} a {fmt(c.end_date)}
                </td>
                <td className="p-3 text-right">
                  {c.duration_unit === "hours"
                    ? `${c.total_hours} h`
                    : `${c.total_days} d`}
                </td>
                <td className="p-3">{c.consistency_status}</td>
                <td className="p-3">{statusLabel[c.status] || c.status}</td>
                <td className="p-3 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelected(Number(c.id))}
                  >
                    <Search size={14} />
                    Analisar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!q.data?.length && <Empty text="Nenhum caso na fila." />}
      </div>
      {selected && (
        <CaseModal
          id={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setSelected(null);
            q.refetch();
          }}
        />
      )}
    </>
  );
}

function CaseModal({
  id,
  onClose,
  onChanged,
}: {
  id: number;
  onClose: any;
  onChanged: any;
}) {
  const q = api.getCase.useQuery({ id });
  const [status, setStatus] = useState("em_analise");
  const [note, setNote] = useState("");
  const review = api.review.useMutation({
    onSuccess: () => {
      toast.success("Análise registrada.");
      onChanged();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const c = q.data;
  useEffect(() => {
    if (c?.status) setStatus(String(c.status));
  }, [c?.status]);
  if (!c)
    return (
      <Modal title="Analisar documento" onClose={onClose}>
        <Loader2 className="animate-spin mx-auto" />
      </Modal>
    );
  return (
    <Modal title="Analisar atestado ou afastamento" onClose={onClose}>
      <div className="grid md:grid-cols-2 gap-3 text-sm">
        <Info label="Colaborador" value={c.collaborator_name} />
        <Info
          label="Período"
          value={`${fmt(c.start_date)} a ${fmt(c.end_date)}`}
        />
        <Info
          label="Duração"
          value={
            c.duration_unit === "hours"
              ? `${c.total_hours} horas`
              : `${c.total_days} dias`
          }
        />
        <Info
          label="Profissional"
          value={`${c.issuer_name || "-"} · ${c.issuer_registration || "-"}`}
        />
        <Info label="CID" value={c.cid_code || "Não informado"} />
        <Info label="Consistência" value={c.consistency_status} />
      </div>
      {c.consistency_details && (
        <div className="mt-3 bg-amber-50 border border-amber-200 p-3 text-sm">
          {String(c.consistency_details)}
        </div>
      )}
      <h3 className="font-semibold mt-4">Documentos protegidos</h3>
      <div className="divide-y border rounded mt-2">
        {c.documents.map((d: any) => (
          <div key={d.id} className="p-3 flex justify-between">
            <span>
              {d.file_name} · versão {d.document_version}
            </span>
            <DocumentButton id={Number(d.id)} />
          </div>
        ))}
      </div>
      <h3 className="font-semibold mt-4">Histórico e auditoria</h3>
      <div className="mt-2 max-h-40 divide-y overflow-auto rounded border">
        {(c.events || []).map((event: any) => (
          <div key={event.id} className="p-3 text-xs">
            <div className="flex justify-between gap-3">
              <b>{event.event_type}</b>
              <span className="text-muted-foreground">
                {new Date(event.created_at).toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="mt-1 text-slate-600">
              {event.actor_name || event.user_name || "Sistema"} ·{" "}
              {event.previous_status || "início"} → {event.new_status || "-"}
            </div>
            {event.public_note && <p className="mt-1">{event.public_note}</p>}
          </div>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-3 mt-4">
        <Field label="Situação">
          <select
            className="field"
            value={status}
            onChange={e => setStatus(e.target.value)}
          >
            {[
              "pendente",
              "em_analise",
              "validado",
              "validado_com_ressalva",
              "necessita_correcao",
              "arquivado",
            ].map(x => (
              <option key={x} value={x}>
                {statusLabel[x]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Observação interna">
          <Input value={note} onChange={e => setNote(e.target.value)} />
        </Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          onClick={() =>
            review.mutate({
              id,
              status,
              reviewNote: note,
              needsOccupationalReview: false,
            })
          }
        >
          <CheckCircle2 size={14} />
          Registrar análise
        </Button>
      </div>
    </Modal>
  );
}

function DocumentButton({ id }: { id: number }) {
  const q = api.downloadDocument.useQuery({ id }, { enabled: false });
  async function open() {
    const r = await q.refetch();
    const d = r.data;
    if (!d) return;
    const a = document.createElement("a");
    a.href = d.dataBase64;
    a.download = d.fileName;
    a.click();
  }
  return (
    <button className="text-primary text-sm" onClick={open}>
      {q.isFetching ? "Preparando..." : "Baixar"}
    </button>
  );
}

function ManagerView() {
  const q = api.managerAbsences.useQuery();
  return (
    <>
      <PageHeader />
      <div className="mb-4 border-l-4 border-primary bg-slate-50 p-3 text-sm">
        Esta visão contém apenas informações administrativas. CID, documento
        médico e observações sensíveis não são exibidos para a chefia.
      </div>
      <AbsenceTable rows={q.data ?? []} />
    </>
  );
}
function AbsenceTable({ rows }: { rows: any[] }) {
  return (
    <div className="border rounded-md bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="p-3 text-left">Colaborador</th>
            <th className="p-3 text-left">Período</th>
            <th className="p-3 text-left">Situação administrativa</th>
            <th className="p-3 text-left">Retorno previsto</th>
            <th className="p-3 text-left">Retorno efetivo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(c => (
            <tr key={c.id} className="border-t">
              <td className="p-3">
                <b>{c.collaborator_name}</b>
                <div className="text-xs text-muted-foreground">
                  {c.sector_name || ""}
                </div>
              </td>
              <td className="p-3">
                {fmt(c.start_date)} a {fmt(c.end_date)}
              </td>
              <td className="p-3">{statusLabel[c.status] || c.status}</td>
              <td className="p-3">{fmt(c.return_expected_date)}</td>
              <td className="p-3">{fmt(c.return_actual_date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <Empty text="Nenhuma ausência registrada para sua equipe." />
      )}
    </div>
  );
}

function Alerts() {
  const q = api.alerts.useQuery();
  const resolve = api.resolveAlert.useMutation({
    onSuccess: () => q.refetch(),
  });
  return (
    <div className="space-y-2">
      {(q.data ?? []).map((a: any) => (
        <div
          key={a.id}
          className="border-l-4 border-amber-500 bg-white border-y border-r p-4 flex justify-between gap-3"
        >
          <div>
            <b>{a.title}</b>
            <div className="text-sm mt-1">
              {a.collaborator_name} · {a.message}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => resolve.mutate({ id: Number(a.id) })}
          >
            Resolver
          </Button>
        </div>
      ))}
      {!q.data?.length && <Empty text="Nenhum alerta aberto." />}
    </div>
  );
}

function Returns() {
  const q = api.listQueue.useQuery();
  const rows = (q.data ?? []).filter((x: any) =>
    ["validado", "validado_com_ressalva"].includes(x.status)
  );
  const update = api.updateReturn.useMutation({
    onSuccess: () => {
      toast.success("Retorno atualizado.");
      q.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="border rounded-md bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="p-3 text-left">Colaborador</th>
            <th className="p-3">Retorno previsto</th>
            <th className="p-3">Situação</th>
            <th className="p-3">Registrar</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c: any) => (
            <tr key={c.id} className="border-t">
              <td className="p-3">
                <b>{c.collaborator_name}</b>
                <div className="text-xs text-muted-foreground">
                  Afastamento até {fmt(c.end_date)}
                </div>
              </td>
              <td className="p-3 text-center">{fmt(c.return_expected_date)}</td>
              <td className="p-3 text-center">
                {statusLabel[c.return_status] || c.return_status}
              </td>
              <td className="p-3">
                <select
                  className="field"
                  value={c.return_status}
                  onChange={e =>
                    update.mutate({
                      id: Number(c.id),
                      returnStatus: e.target.value,
                      note: "Atualizado pela gestão de retorno",
                    })
                  }
                >
                  {[
                    "retorno_previsto",
                    "aguardando_retorno",
                    "retornou",
                    "retorno_pendente",
                    "afastamento_prorrogado",
                    "novo_afastamento",
                    "encaminhado_avaliacao",
                    "retorno_concluido",
                  ].map(x => (
                    <option key={x} value={x}>
                      {statusLabel[x]}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <Empty text="Nenhum retorno em acompanhamento." />}
    </div>
  );
}

function Reports() {
  const csv = api.exportCsv.useQuery(undefined, { enabled: false });
  const cid = api.cidReport.useQuery();
  const pdf = api.generatePdf.useMutation({
    onSuccess: (r: any) => downloadUrl(r.dataBase64, r.fileName),
    onError: (e: any) => toast.error(e.message),
  });
  async function download() {
    const r = await csv.refetch();
    const blob = new Blob(["\ufeff" + (r.data?.csv || "")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    downloadUrl(url, "atestados_afastamentos.csv");
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function downloadUrl(url: string, fileName: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b pb-4">
        <div>
          <h3 className="font-semibold">Relatórios de Saúde Ocupacional</h3>
          <p className="text-sm text-muted-foreground">
            Exportação administrativa com rastreabilidade e proteção de dados
            sensíveis.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => pdf.mutate({ includeCid: false })}
            disabled={pdf.isPending}
          >
            <FileText size={14} />
            PDF administrativo
          </Button>
          <Button
            variant="outline"
            onClick={() => pdf.mutate({ includeCid: true })}
            disabled={pdf.isPending}
          >
            <HeartPulse size={14} />
            PDF epidemiológico
          </Button>
          <Button onClick={download}>
            <Download size={14} />
            Excel/CSV
          </Button>
        </div>
      </div>
      <div className="border-l-4 border-amber-500 bg-amber-50 p-3 text-sm">
        O PDF epidemiológico contém dados sensíveis e deve permanecer restrito
        aos perfis autorizados de RH e Saúde Ocupacional.
      </div>
      <h3 className="font-semibold">Análise epidemiológica por CID</h3>
      <div className="border rounded-md bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-3 text-left">CID</th>
              <th className="p-3 text-right">Casos</th>
              <th className="p-3 text-right">Dias perdidos</th>
            </tr>
          </thead>
          <tbody>
            {(cid.data ?? []).map((x: any) => (
              <tr key={x.cid} className="border-t">
                <td className="p-3">{x.cid}</td>
                <td className="p-3 text-right">{x.cases}</td>
                <td className="p-3 text-right">{x.days_lost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: any;
  children: any;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-md shadow-xl max-w-3xl w-full max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between z-10">
          <h2 className="font-bold text-lg">{title}</h2>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: any;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "md:col-span-2" : ""}>
      <span className="block text-xs font-semibold mb-1">{label}</span>
      {children}
    </label>
  );
}
function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="border-b pb-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium mt-1">{value}</div>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div className="border bg-white rounded-md p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold text-primary mt-2">{value}</div>
    </div>
  );
}
function Tag({ text, tone }: { text: string; tone: string }) {
  return (
    <span
      className={`inline-block text-[11px] px-2 py-0.5 rounded-full mr-1 ${tone === "rose" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}
    >
      {text}
    </span>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="p-10 text-center text-sm text-muted-foreground">{text}</div>
  );
}
