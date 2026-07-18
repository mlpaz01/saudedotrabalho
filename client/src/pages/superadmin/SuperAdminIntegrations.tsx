import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  CheckCircle2,
  Database,
  Play,
  RefreshCw,
  Save,
  ServerCog,
  ShieldCheck,
  XCircle,
} from "lucide-react";

const DEFAULT_FIELD_MAP = {
  cpf: "CPF",
  name: "NOME",
  email: "EMAIL",
  whatsapp: "TELEFONE",
  branch: "FILIAL",
  sector: "SECAO",
  position: "FUNCAO",
  admissionDate: "DATAADMISSAO",
  terminationDate: "DATADEMISSAO",
  status: "SITUACAO",
  registration: "CHAPA",
};

const DEFAULT_STATUS_MAP = {
  active: "A",
  away: "F,L,M",
  terminated: "D",
  death: "O",
};

function prettyJson(value: any) {
  return JSON.stringify(value, null, 2);
}

function parseJsonObject(value: string, label: string) {
  try {
    const parsed = JSON.parse(value || "{}");
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("invalid");
    return parsed as Record<string, string>;
  } catch {
    throw new Error(`${label} precisa ser um JSON válido.`);
  }
}

function statusBadge(row: any) {
  if (!row?.id) return { label: "Não configurado", cls: "bg-slate-100 text-slate-600" };
  if (row.last_test_ok === true) return { label: "Conexão validada", cls: "bg-emerald-100 text-emerald-700" };
  if (row.last_test_ok === false) return { label: "Falha no teste", cls: "bg-rose-100 text-rose-700" };
  return { label: "Configurado", cls: "bg-amber-100 text-amber-700" };
}

export default function SuperAdminIntegrations() {
  const connections = (trpc.superAdmin as any).listTotvsRmConnections.useQuery();
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const selectedSummary = useMemo(
    () => (connections.data ?? []).find((c: any) => Number(c.company_id) === Number(selectedCompanyId)),
    [connections.data, selectedCompanyId],
  );
  const detail = (trpc.superAdmin as any).getTotvsRmConnection.useQuery(
    { companyId: selectedCompanyId ?? 0 },
    { enabled: !!selectedCompanyId },
  );
  const logs = (trpc.superAdmin as any).listTotvsRmLogs.useQuery(
    { companyId: selectedCompanyId || undefined, limit: 30 },
    { enabled: true },
  );
  const save = (trpc.superAdmin as any).saveTotvsRmConnection.useMutation({
    onSuccess: () => {
      toast.success("Conector TOTVS RM salvo.");
      connections.refetch();
      detail.refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar conector."),
  });
  const test = (trpc.superAdmin as any).testTotvsRmConnection.useMutation({
    onSuccess: (result: any) => {
      if (result.ok) toast.success(result.message || "RM respondeu ao teste.");
      else toast.error(result.message || "Falha no teste do RM.");
      connections.refetch();
      detail.refetch();
      logs.refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao testar conexão."),
  });
  const dryRun = (trpc.superAdmin as any).runTotvsRmDryRun.useMutation({
    onSuccess: () => {
      toast.success("Prévia registrada no histórico.");
      logs.refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao executar prévia."),
  });

  const [form, setForm] = useState({
    rmVersion: "12.1.2602.181",
    baseUrl: "",
    integrationMode: "rest",
    authType: "basic",
    username: "",
    password: "",
    coligada: "",
    filial: "",
    restHealthcheckPath: "/RMSRestDataServer/rest",
    restEmployeePath: "",
    soapWsdlPath: "/wsDataServer/IwsDataServer?wsdl",
    soapDataServer: "",
    syncSchedule: "manual",
    isActive: true,
    fieldMapJson: prettyJson(DEFAULT_FIELD_MAP),
    statusMapJson: prettyJson(DEFAULT_STATUS_MAP),
  });

  useEffect(() => {
    const list = connections.data ?? [];
    if (!selectedCompanyId && list.length) setSelectedCompanyId(Number(list[0].company_id));
  }, [connections.data, selectedCompanyId]);

  useEffect(() => {
    const data = detail.data;
    if (!selectedCompanyId) return;
    if (!data) {
      setForm({
        rmVersion: "12.1.2602.181",
        baseUrl: "",
        integrationMode: "rest",
        authType: "basic",
        username: "",
        password: "",
        coligada: "",
        filial: "",
        restHealthcheckPath: "/RMSRestDataServer/rest",
        restEmployeePath: "",
        soapWsdlPath: "/wsDataServer/IwsDataServer?wsdl",
        soapDataServer: "",
        syncSchedule: "manual",
        isActive: true,
        fieldMapJson: prettyJson(DEFAULT_FIELD_MAP),
        statusMapJson: prettyJson(DEFAULT_STATUS_MAP),
      });
      return;
    }
    setForm({
      rmVersion: data.rm_version || "12.1.2602.181",
      baseUrl: data.base_url || "",
      integrationMode: data.integration_mode || "rest",
      authType: data.auth_type || "basic",
      username: data.username || "",
      password: "",
      coligada: data.coligada || "",
      filial: data.filial || "",
      restHealthcheckPath: data.rest_healthcheck_path || "/RMSRestDataServer/rest",
      restEmployeePath: data.rest_employee_path || "",
      soapWsdlPath: data.soap_wsdl_path || "/wsDataServer/IwsDataServer?wsdl",
      soapDataServer: data.soap_dataserver || "",
      syncSchedule: data.sync_schedule || "manual",
      isActive: data.is_active !== false,
      fieldMapJson: prettyJson(data.field_map && Object.keys(data.field_map).length ? data.field_map : DEFAULT_FIELD_MAP),
      statusMapJson: prettyJson(data.status_map && Object.keys(data.status_map).length ? data.status_map : DEFAULT_STATUS_MAP),
    });
  }, [detail.data, selectedCompanyId]);

  const handleSave = () => {
    if (!selectedCompanyId) return toast.error("Selecione uma empresa.");
    let fieldMap: Record<string, string>;
    let statusMap: Record<string, string>;
    try {
      fieldMap = parseJsonObject(form.fieldMapJson, "Mapeamento de campos");
      statusMap = parseJsonObject(form.statusMapJson, "Mapeamento de status");
    } catch (e: any) {
      toast.error(e.message);
      return;
    }
    save.mutate({
      companyId: selectedCompanyId,
      rmVersion: form.rmVersion,
      baseUrl: form.baseUrl,
      integrationMode: form.integrationMode,
      authType: form.authType,
      username: form.username || undefined,
      password: form.password || undefined,
      coligada: form.coligada || undefined,
      filial: form.filial || undefined,
      restHealthcheckPath: form.restHealthcheckPath || undefined,
      restEmployeePath: form.restEmployeePath || undefined,
      soapWsdlPath: form.soapWsdlPath || undefined,
      soapDataServer: form.soapDataServer || undefined,
      syncSchedule: form.syncSchedule,
      isActive: form.isActive,
      fieldMap,
      statusMap,
    });
  };

  const badge = statusBadge(selectedSummary);

  return (
    <AppLayout>
      <div className="p-6 space-y-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
              <ServerCog size={24} /> Integrações
            </h1>
            <p className="text-sm text-muted-foreground">
              Conector produto para TOTVS RM, validado para parametrização da versão 12.1.2602.181.
            </p>
          </div>
          <button
            onClick={() => connections.refetch()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white text-sm hover:bg-slate-50"
          >
            <RefreshCw size={15} /> Atualizar
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-5">
          <aside className="bg-white border rounded-lg overflow-hidden">
            <div className="p-4 border-b">
              <div className="font-semibold flex items-center gap-2"><Database size={16} /> Empresas</div>
              <div className="text-xs text-muted-foreground mt-1">Selecione o cliente para configurar o RM.</div>
            </div>
            <div className="max-h-[680px] overflow-y-auto">
              {(connections.data ?? []).map((row: any) => {
                const b = statusBadge(row);
                const active = Number(row.company_id) === Number(selectedCompanyId);
                return (
                  <button
                    key={row.company_id}
                    onClick={() => setSelectedCompanyId(Number(row.company_id))}
                    className={`w-full text-left p-3 border-b hover:bg-slate-50 ${active ? "bg-primary/5" : "bg-white"}`}
                  >
                    <div className="font-medium text-sm">{row.company_name}</div>
                    <div className="text-xs text-muted-foreground">{row.cnpj || "CNPJ não informado"}</div>
                    <span className={`inline-flex mt-2 px-2 py-0.5 rounded-full text-[11px] font-semibold ${b.cls}`}>{b.label}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="space-y-5">
            <section className="bg-white border rounded-lg p-5 space-y-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Conector TOTVS RM</div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedSummary?.company_name || "Selecione uma empresa"}</h2>
                </div>
                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${badge.cls}`}>
                  {selectedSummary?.last_test_ok ? <CheckCircle2 size={15} /> : selectedSummary?.last_test_ok === false ? <XCircle size={15} /> : <Activity size={15} />}
                  {badge.label}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Versão RM">
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.rmVersion} onChange={(e) => setForm({ ...form, rmVersion: e.target.value })} />
                </Field>
                <Field label="Modo">
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.integrationMode} onChange={(e) => setForm({ ...form, integrationMode: e.target.value })}>
                    <option value="rest">REST / RMSRestDataServer</option>
                    <option value="soap">SOAP / wsDataServer</option>
                    <option value="hybrid">Híbrido REST + SOAP</option>
                  </select>
                </Field>
                <Field label="Agenda">
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.syncSchedule} onChange={(e) => setForm({ ...form, syncSchedule: e.target.value })}>
                    <option value="manual">Manual</option>
                    <option value="daily">Diária</option>
                    <option value="weekly">Semanal</option>
                  </select>
                </Field>
              </div>

              <Field label="URL base do RM Host">
                <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="https://rm.cliente.com.br:8051" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} />
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Autenticação">
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.authType} onChange={(e) => setForm({ ...form, authType: e.target.value })}>
                    <option value="basic">Basic Auth</option>
                    <option value="none">Sem autenticação</option>
                  </select>
                </Field>
                <Field label="Usuário de integração">
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                </Field>
                <Field label={detail.data?.has_password ? "Nova senha (opcional)" : "Senha"}>
                  <input type="password" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Coligada padrão">
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.coligada} onChange={(e) => setForm({ ...form, coligada: e.target.value })} />
                </Field>
                <Field label="Filial padrão">
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.filial} onChange={(e) => setForm({ ...form, filial: e.target.value })} />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Healthcheck REST">
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.restHealthcheckPath} onChange={(e) => setForm({ ...form, restHealthcheckPath: e.target.value })} />
                </Field>
                <Field label="Endpoint/DataServer de colaboradores">
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="/RMSRestDataServer/rest/..." value={form.restEmployeePath} onChange={(e) => setForm({ ...form, restEmployeePath: e.target.value })} />
                </Field>
                <Field label="WSDL SOAP">
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.soapWsdlPath} onChange={(e) => setForm({ ...form, soapWsdlPath: e.target.value })} />
                </Field>
                <Field label="DataServer SOAP">
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Ex.: RMSPR_FUNCIONARIO" value={form.soapDataServer} onChange={(e) => setForm({ ...form, soapDataServer: e.target.value })} />
                </Field>
              </div>

              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                Conector ativo para esta empresa
              </label>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <Field label="Mapeamento de campos">
                  <textarea className="w-full border rounded-lg px-3 py-2 text-xs font-mono min-h-56" value={form.fieldMapJson} onChange={(e) => setForm({ ...form, fieldMapJson: e.target.value })} />
                </Field>
                <Field label="Mapeamento de status funcional">
                  <textarea className="w-full border rounded-lg px-3 py-2 text-xs font-mono min-h-56" value={form.statusMapJson} onChange={(e) => setForm({ ...form, statusMapJson: e.target.value })} />
                </Field>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button disabled={!selectedCompanyId || save.isPending} onClick={handleSave} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50">
                  <Save size={16} /> Salvar conector
                </button>
                <button disabled={!selectedCompanyId || test.isPending} onClick={() => selectedCompanyId && test.mutate({ companyId: selectedCompanyId })} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold bg-white hover:bg-slate-50 disabled:opacity-50">
                  <ShieldCheck size={16} /> Testar conexão
                </button>
                <button disabled={!selectedCompanyId || dryRun.isPending} onClick={() => selectedCompanyId && dryRun.mutate({ companyId: selectedCompanyId })} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold bg-white hover:bg-slate-50 disabled:opacity-50">
                  <Play size={16} /> Prévia estrutural
                </button>
              </div>
            </section>

            <section className="bg-white border rounded-lg overflow-hidden">
              <div className="p-4 border-b font-semibold">Histórico de testes e sincronizações</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="text-left p-3">Data</th>
                      <th className="text-left p-3">Empresa</th>
                      <th className="text-left p-3">Tipo</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-left p-3">Resumo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(logs.data ?? []).map((log: any) => (
                      <tr key={log.id} className="border-t align-top">
                        <td className="p-3 whitespace-nowrap">{log.started_at ? new Date(log.started_at).toLocaleString("pt-BR") : "-"}</td>
                        <td className="p-3">{log.company_name || `#${log.company_id}`}</td>
                        <td className="p-3">{log.run_type}</td>
                        <td className="p-3">{log.status}</td>
                        <td className="p-3 text-xs text-slate-600 max-w-xl">
                          {log.error_message || log.summary?.message || log.summary?.url || "-"}
                        </td>
                      </tr>
                    ))}
                    {(logs.data ?? []).length === 0 && (
                      <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum registro ainda.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </main>
        </div>
      </div>
    </AppLayout>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="block font-medium text-slate-700 mb-1">{label}</span>
      {children}
    </label>
  );
}
