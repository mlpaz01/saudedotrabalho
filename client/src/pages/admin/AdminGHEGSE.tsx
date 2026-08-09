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
  AlertTriangle,
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  FileCheck2,
  Filter,
  History,
  Layers,
  Link2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";

type DetailTab = "trabalhadores" | "escopo" | "pgr" | "historico";

function Metric({ label, value, tone = "slate" }: { label: string; value: number | string; tone?: "slate" | "teal" | "amber" | "red" }) {
  const colors = {
    slate: "border-slate-200 bg-white text-slate-950",
    teal: "border-teal-200 bg-teal-50 text-teal-950",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    red: "border-red-200 bg-red-50 text-red-950",
  };
  return (
    <div className={`min-h-24 border p-4 ${colors[tone]}`}>
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function Panel({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="font-semibold text-slate-950">{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function statusBadge(status: string) {
  const value = String(status || "");
  const className = value === "ativo"
    ? "bg-emerald-100 text-emerald-800"
    : value === "em_revisao"
      ? "bg-amber-100 text-amber-800"
      : "bg-slate-100 text-slate-700";
  return <Badge className={`rounded-sm ${className}`}>{value.replaceAll("_", " ")}</Badge>;
}

export default function AdminGHEGSE() {
  const utils = trpc.useUtils();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("trabalhadores");
  const [gseOpen, setGseOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [branchId, setBranchId] = useState(0);
  const [sectorId, setSectorId] = useState(0);
  const [onlyWithout, setOnlyWithout] = useState(false);
  const [selectedWorkers, setSelectedWorkers] = useState<number[]>([]);

  const dashboardQ = trpc.occupationalLifecycle.dashboard.useQuery();
  const listQ = trpc.occupationalLifecycle.listGses.useQuery();
  const structureQ = trpc.occupationalLifecycle.listStructure.useQuery();
  const detailQ = trpc.occupationalLifecycle.getGse.useQuery(
    { id: selectedId || 0 },
    { enabled: Boolean(selectedId) }
  );
  const workersQ = trpc.occupationalLifecycle.listWorkers.useQuery({
    branchId: branchId || undefined,
    sectorId: sectorId || undefined,
    query: query || undefined,
    onlyWithoutGse: onlyWithout || undefined,
  });
  const alertsQ = trpc.occupationalLifecycle.listMovementAlerts.useQuery();

  const invalidate = async () => {
    await Promise.all([
      utils.occupationalLifecycle.dashboard.invalidate(),
      utils.occupationalLifecycle.listGses.invalidate(),
      utils.occupationalLifecycle.listWorkers.invalidate(),
      utils.occupationalLifecycle.listMovementAlerts.invalidate(),
      utils.occupationalLifecycle.getGse.invalidate(),
    ]);
  };

  const saveGse = trpc.occupationalLifecycle.upsertGse.useMutation({
    onSuccess: async result => {
      await invalidate();
      setSelectedId(result.id);
      setGseOpen(false);
      toast.success("GSE mestre salvo com histórico preservado.");
    },
    onError: error => toast.error(error.message),
  });
  const assign = trpc.occupationalLifecycle.assignWorkers.useMutation({
    onSuccess: async result => {
      await invalidate();
      setAssignOpen(false);
      setSelectedWorkers([]);
      toast.success(`${result.assigned} trabalhador(es) atribuídos ao GSE.`);
    },
    onError: error => toast.error(error.message),
  });
  const migrate = trpc.occupationalLifecycle.migratePgrGses.useMutation({
    onSuccess: async result => {
      await invalidate();
      toast.success(`${result.created} GSE(s) mestre criados e ${result.linked} contexto(s) de PGR vinculados.`);
    },
    onError: error => toast.error(error.message),
  });
  const linkPgr = trpc.occupationalLifecycle.linkPgr.useMutation({
    onSuccess: async () => {
      await invalidate();
      setLinkOpen(false);
      toast.success("PGR vinculado ao GSE mestre.");
    },
    onError: error => toast.error(error.message),
  });
  const resolveAlert = trpc.occupationalLifecycle.resolveMovementAlert.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("Movimentação analisada pelo SESMT.");
    },
    onError: error => toast.error(error.message),
  });

  const gses = (listQ.data || []) as any[];
  const detail = detailQ.data as any;
  const workers = (workersQ.data || []) as any[];
  const alerts = ((alertsQ.data || []) as any[]).filter(row => row.status === "pendente" || row.status === "adiado");
  const dashboard = dashboardQ.data as any;

  const selectedGse = useMemo(
    () => gses.find(row => Number(row.id) === selectedId) || null,
    [gses, selectedId]
  );

  function toggleWorker(id: number) {
    setSelectedWorkers(current =>
      current.includes(id) ? current.filter(item => item !== id) : [...current, id]
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1540px] space-y-5 p-4 md:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-teal-700">
              <ShieldCheck size={15} /> Chave ocupacional do trabalhador
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Parametrização dos GSE</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Entidade mestre que conecta trabalhador, estrutura organizacional, PGR, PCMSO, exames, resultados e ASO.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => migrate.mutate()} disabled={migrate.isPending}>
              <RefreshCw size={15} className="mr-2" /> Migrar GSEs dos PGRs
            </Button>
            <Button onClick={() => { setEditing(null); setGseOpen(true); }}>
              <Plus size={15} className="mr-2" /> Novo GSE
            </Button>
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="GSEs ativos" value={Number(dashboard?.gses || 0)} tone="teal" />
          <Metric label="Trabalhadores ativos" value={Number(dashboard?.active_workers || 0)} />
          <Metric label="Cobertura de GSE" value={`${Number(dashboard?.gse_coverage || 0)}%`} tone="teal" />
          <Metric label="Sem GSE" value={Number(dashboard?.workers_without_gse || 0)} tone={Number(dashboard?.workers_without_gse || 0) ? "red" : "teal"} />
          <Metric label="Movimentações a revisar" value={Number(dashboard?.movement_alerts || 0)} tone={Number(dashboard?.movement_alerts || 0) ? "amber" : "teal"} />
        </div>

        {alerts.length > 0 && (
          <Panel
            title="Movimentações organizacionais identificadas"
            subtitle="Mudanças de filial, setor ou cargo nunca alteram o GSE automaticamente. O SESMT decide e a plataforma registra a vigência."
            action={<Badge className="rounded-sm bg-amber-100 text-amber-800">{alerts.length} pendência(s)</Badge>}
          >
            <div className="space-y-2">
              {alerts.slice(0, 12).map(alert => (
                <div key={alert.id} className="flex flex-wrap items-center justify-between gap-3 border p-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{alert.collaborator_name}</p>
                    <p className="text-xs text-slate-500">
                      Atual: {alert.branch_name || "-"} / {alert.sector_name || "-"} / {alert.position || "-"} · GSE {alert.gse_code} - {alert.gse_name}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => resolveAlert.mutate({ id: Number(alert.id), resolution: "manter_gse", notes: "Estrutura revisada; GSE atual mantido." })}>
                      Manter GSE
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => resolveAlert.mutate({ id: Number(alert.id), resolution: "analisar_posteriormente" })}>
                      Analisar depois
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Panel
            title="GSEs mestres"
            subtitle="O código é único e permanece como identificador histórico."
            action={<Badge variant="outline" className="rounded-sm">{gses.length}</Badge>}
          >
            <div className="space-y-2">
              {listQ.isLoading && <p className="text-sm text-slate-500">Carregando grupos...</p>}
              {!listQ.isLoading && gses.length === 0 && (
                <div className="py-10 text-center text-sm text-slate-500">
                  <Layers className="mx-auto mb-3 text-slate-300" />
                  Crie um GSE ou migre os grupos já existentes nos PGRs.
                </div>
              )}
              {gses.map(row => (
                <button
                  key={row.id}
                  onClick={() => setSelectedId(Number(row.id))}
                  className={`w-full border p-3 text-left transition ${selectedId === Number(row.id) ? "border-teal-500 bg-teal-50" : "border-slate-200 hover:border-slate-300"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-teal-700">{row.code}</p>
                      <p className="truncate font-semibold text-slate-950">{row.name}</p>
                    </div>
                    {statusBadge(row.status)}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-slate-500">
                    <span>{Number(row.worker_count || 0)} pessoas</span>
                    <span>{Number(row.scope_count || 0)} escopos</span>
                    <span>{Number(row.pgr_count || 0)} PGRs</span>
                  </div>
                </button>
              ))}
            </div>
          </Panel>

          {!selectedGse ? (
            <section className="flex min-h-[420px] items-center justify-center border bg-white p-8 text-center">
              <div>
                <Layers className="mx-auto mb-3 text-slate-300" size={40} />
                <h2 className="font-semibold text-slate-900">Selecione um GSE</h2>
                <p className="mt-1 text-sm text-slate-500">Veja trabalhadores, vínculos ao PGR, escopo e histórico.</p>
              </div>
            </section>
          ) : (
            <section className="border bg-white">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className="rounded-sm bg-teal-100 text-teal-800">{selectedGse.code}</Badge>
                    {statusBadge(selectedGse.status)}
                  </div>
                  <h2 className="mt-2 text-xl font-bold text-slate-950">{selectedGse.name}</h2>
                  <p className="mt-1 max-w-3xl text-sm text-slate-500">{selectedGse.description || "Sem descrição técnica."}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setEditing({ ...selectedGse, scope: detail?.scope || [] }); setGseOpen(true); }}>
                    Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setLinkOpen(true)}>
                    <Link2 size={14} className="mr-1" /> Vincular PGR
                  </Button>
                  <Button size="sm" onClick={() => setAssignOpen(true)}>
                    <UserCheck size={14} className="mr-1" /> Atribuir trabalhadores
                  </Button>
                </div>
              </div>

              <div className="flex gap-1 overflow-x-auto border-b px-3 pt-2">
                {([
                  ["trabalhadores", "Trabalhadores", Users],
                  ["escopo", "Escopo organizacional", Building2],
                  ["pgr", "PGR e riscos", FileCheck2],
                  ["historico", "Histórico", History],
                ] as const).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    onClick={() => setDetailTab(id)}
                    className={`flex h-9 shrink-0 items-center gap-2 border-b-2 px-3 text-xs font-semibold ${detailTab === id ? "border-teal-600 text-teal-800" : "border-transparent text-slate-500"}`}
                  >
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {detailTab === "trabalhadores" && (
                  <div className="overflow-auto border">
                    <table className="w-full min-w-[820px] text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-600">
                        <tr><th className="p-2 text-left">Trabalhador</th><th className="p-2 text-left">CPF / Matrícula</th><th className="p-2 text-left">Filial / Setor</th><th className="p-2 text-left">Cargo</th><th className="p-2 text-left">Vigência atual</th><th className="p-2 text-left">Origem</th></tr>
                      </thead>
                      <tbody>
                        {(detail?.workers || []).map((row: any) => (
                          <tr key={row.id} className="border-t">
                            <td className="p-2 font-medium">{row.name}</td>
                            <td className="p-2">{row.cpf || "-"}<br /><span className="text-xs text-slate-500">{row.employee_registration || "Sem matrícula"}</span></td>
                            <td className="p-2">{row.branch_name || "-"} / {row.sector_name || "-"}</td>
                            <td className="p-2">{row.position || "-"}</td>
                            <td className="p-2">{row.valid_from ? new Date(row.valid_from).toLocaleDateString("pt-BR") : "-"}</td>
                            <td className="p-2">{row.origin}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!detail?.workers?.length && <p className="p-8 text-center text-sm text-slate-500">Nenhum trabalhador atribuído.</p>}
                  </div>
                )}

                {detailTab === "escopo" && (
                  <div className="grid gap-3 md:grid-cols-2">
                    {(detail?.scope || []).map((row: any) => (
                      <div key={row.id} className="border p-3">
                        <p className="font-semibold text-slate-900">{row.branch_name || "Todas as filiais"}</p>
                        <p className="mt-1 text-sm text-slate-600">Setor: {row.sector_name || "Todos"}</p>
                        <p className="text-sm text-slate-600">Cargo: {row.position_name || "Todos"}</p>
                        {row.cost_center && <p className="text-sm text-slate-600">Centro de custo: {row.cost_center}</p>}
                      </div>
                    ))}
                    {!detail?.scope?.length && <p className="text-sm text-slate-500">O escopo ainda não foi parametrizado. Atribuições individuais permanecem válidas.</p>}
                  </div>
                )}

                {detailTab === "pgr" && (
                  <div className="space-y-3">
                    <div className="border-l-4 border-teal-500 bg-teal-50 p-3 text-sm text-teal-950">
                      O GSE mestre é a identidade única. Cada PGR recebe apenas um contexto de risco vinculado, sem recriar o grupo ou sua população.
                    </div>
                    {(detail?.pgrs || []).map((row: any) => (
                      <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 border p-3">
                        <div><p className="font-semibold text-slate-900">{row.pgr_title}</p><p className="text-xs text-slate-500">Contexto: {row.pgr_gse_name} · vínculo {new Date(row.linked_at).toLocaleDateString("pt-BR")}</p></div>
                        <Badge variant="outline" className="rounded-sm">PGR #{row.pgr_id}</Badge>
                      </div>
                    ))}
                    {!detail?.pgrs?.length && <p className="text-sm text-slate-500">Nenhum PGR vinculado.</p>}
                  </div>
                )}

                {detailTab === "historico" && (
                  <div className="overflow-auto border">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="p-2 text-left">Trabalhador</th><th className="p-2 text-left">Início</th><th className="p-2 text-left">Fim</th><th className="p-2 text-left">Motivo</th><th className="p-2 text-left">Origem</th><th className="p-2 text-left">Situação</th></tr></thead>
                      <tbody>{(detail?.history || []).map((row: any) => <tr key={row.id} className="border-t"><td className="p-2 font-medium">{row.collaborator_name}</td><td className="p-2">{new Date(row.valid_from).toLocaleString("pt-BR")}</td><td className="p-2">{row.valid_until ? new Date(row.valid_until).toLocaleString("pt-BR") : "Atual"}</td><td className="p-2">{row.reason}</td><td className="p-2">{row.origin}</td><td className="p-2">{Number(row.is_current) === 1 ? <Badge className="rounded-sm bg-emerald-100 text-emerald-800">vigente</Badge> : <Badge variant="outline" className="rounded-sm">histórico</Badge>}</td></tr>)}</tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        <GseDialog open={gseOpen} close={() => setGseOpen(false)} initial={editing} structure={structureQ.data as any} busy={saveGse.isPending} save={payload => saveGse.mutate(payload)} />
        <AssignDialog
          open={assignOpen}
          close={() => setAssignOpen(false)}
          gse={selectedGse}
          workers={workers}
          structure={structureQ.data as any}
          selected={selectedWorkers}
          toggle={toggleWorker}
          selectAll={() => setSelectedWorkers(workers.map(row => Number(row.id)))}
          clear={() => setSelectedWorkers([])}
          query={query}
          setQuery={setQuery}
          branchId={branchId}
          setBranchId={setBranchId}
          sectorId={sectorId}
          setSectorId={setSectorId}
          onlyWithout={onlyWithout}
          setOnlyWithout={setOnlyWithout}
          busy={assign.isPending}
          confirm={(reason: string, origin: "manual" | "importacao" | "api" | "totvs" | "validacao_sesmt") => selectedId && assign.mutate({ gseId: selectedId, collaboratorIds: selectedWorkers, reason, origin })}
        />
        <LinkDialog open={linkOpen} close={() => setLinkOpen(false)} gse={selectedGse} pgrs={(structureQ.data as any)?.pgrs || []} busy={linkPgr.isPending} confirm={pgrId => selectedId && linkPgr.mutate({ gseId: selectedId, pgrId })} />
      </div>
    </AppLayout>
  );
}

function GseDialog({ open, close, initial, structure, busy, save }: { open: boolean; close: () => void; initial: any; structure: any; busy: boolean; save: (payload: any) => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("ativo");
  const [notes, setNotes] = useState("");
  const [branchId, setBranchId] = useState(0);
  const [sectorId, setSectorId] = useState(0);
  const [position, setPosition] = useState("");
  const [costCenter, setCostCenter] = useState("");
  const key = `${open}:${initial?.id || "new"}`;
  useEffect(() => {
    if (!open) return;
    setCode(initial?.code || ""); setName(initial?.name || ""); setDescription(initial?.description || ""); setStatus(initial?.status || "ativo"); setNotes(initial?.technical_notes || "");
    const scope = initial?.scope?.[0] || {};
    setBranchId(Number(scope.branch_id || 0)); setSectorId(Number(scope.sector_id || 0)); setPosition(scope.position_name || ""); setCostCenter(scope.cost_center || "");
  }, [key, open, initial]);
  return (
    <Dialog open={open} onOpenChange={value => !value && close()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{initial?.id ? "Editar GSE mestre" : "Novo GSE mestre"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold text-slate-700">Código interno<Input className="mt-1" value={code} onChange={event => setCode(event.target.value)} placeholder="GSE-001" /></label>
          <label className="text-xs font-semibold text-slate-700">Nome<Input className="mt-1" value={name} onChange={event => setName(event.target.value)} placeholder="Operacional Logística" /></label>
          <label className="md:col-span-2 text-xs font-semibold text-slate-700">Descrição<Textarea className="mt-1" value={description} onChange={event => setDescription(event.target.value)} /></label>
          <label className="text-xs font-semibold text-slate-700">Situação<select className="mt-1 h-10 w-full border bg-white px-3 text-sm" value={status} onChange={event => setStatus(event.target.value)}><option value="ativo">Ativo</option><option value="em_revisao">Em revisão</option><option value="inativo">Inativo</option></select></label>
          <div />
          <div className="md:col-span-2 border-t pt-3"><p className="text-sm font-semibold text-slate-900">Escopo organizacional inicial</p><p className="text-xs text-slate-500">Pode ser ampliado posteriormente sem alterar o código histórico.</p></div>
          <label className="text-xs font-semibold text-slate-700">Filial<select className="mt-1 h-10 w-full border bg-white px-3 text-sm" value={branchId} onChange={event => setBranchId(Number(event.target.value))}><option value={0}>Todas / não definida</option>{(structure?.branches || []).map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-700">Setor<select className="mt-1 h-10 w-full border bg-white px-3 text-sm" value={sectorId} onChange={event => setSectorId(Number(event.target.value))}><option value={0}>Todos / não definido</option>{(structure?.sectors || []).filter((row: any) => !branchId || Number(row.branch_id) === branchId).map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-700">Cargo<Input className="mt-1" value={position} onChange={event => setPosition(event.target.value)} /></label>
          <label className="text-xs font-semibold text-slate-700">Centro de custo<Input className="mt-1" value={costCenter} onChange={event => setCostCenter(event.target.value)} /></label>
          <label className="md:col-span-2 text-xs font-semibold text-slate-700">Observações técnicas<Textarea className="mt-1" value={notes} onChange={event => setNotes(event.target.value)} /></label>
          <div className="md:col-span-2 flex justify-end gap-2"><Button variant="outline" onClick={close}>Cancelar</Button><Button disabled={busy || !code.trim() || !name.trim()} onClick={() => save({ id: initial?.id ? Number(initial.id) : undefined, code, name, description: description || undefined, status, technicalNotes: notes || undefined, scope: branchId || sectorId || position || costCenter ? [{ branchId: branchId || null, sectorId: sectorId || null, positionName: position || null, costCenter: costCenter || null }] : [] })}>{busy ? "Salvando..." : "Salvar GSE"}</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog(props: any) {
  const [reason, setReason] = useState("Parametrização inicial validada pelo SESMT");
  const [origin, setOrigin] = useState("manual");
  return (
    <Dialog open={props.open} onOpenChange={(value: boolean) => !value && props.close()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader><DialogTitle>Atribuir trabalhadores a {props.gse?.code} - {props.gse?.name}</DialogTitle></DialogHeader>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2"><Search className="absolute left-3 top-3 text-slate-400" size={15} /><Input className="pl-9" value={props.query} onChange={(event: any) => props.setQuery(event.target.value)} placeholder="Nome, CPF, matrícula ou cargo" /></div>
          <select className="h-10 border bg-white px-3 text-sm" value={props.branchId} onChange={(event: any) => props.setBranchId(Number(event.target.value))}><option value={0}>Todas as filiais</option>{(props.structure?.branches || []).map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
          <select className="h-10 border bg-white px-3 text-sm" value={props.sectorId} onChange={(event: any) => props.setSectorId(Number(event.target.value))}><option value={0}>Todos os setores</option>{(props.structure?.sectors || []).filter((row: any) => !props.branchId || Number(row.branch_id) === props.branchId).map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <label className="flex items-center gap-2"><input type="checkbox" checked={props.onlyWithout} onChange={(event: any) => props.setOnlyWithout(event.target.checked)} /> Mostrar somente trabalhadores sem GSE</label>
          <div className="flex gap-2"><Button size="sm" variant="outline" onClick={props.selectAll}>Selecionar encontrados</Button><Button size="sm" variant="ghost" onClick={props.clear}>Limpar</Button></div>
        </div>
        <div className="max-h-[370px] overflow-auto border">
          <table className="w-full min-w-[800px] text-sm"><thead className="sticky top-0 bg-slate-50 text-xs text-slate-600"><tr><th className="w-10 p-2"></th><th className="p-2 text-left">Trabalhador</th><th className="p-2 text-left">Filial / Setor</th><th className="p-2 text-left">Cargo</th><th className="p-2 text-left">GSE atual</th></tr></thead><tbody>{props.workers.map((row: any) => <tr key={row.id} className="border-t"><td className="p-2 text-center"><input type="checkbox" checked={props.selected.includes(Number(row.id))} onChange={() => props.toggle(Number(row.id))} /></td><td className="p-2"><span className="font-medium">{row.name}</span><br /><span className="text-xs text-slate-500">{row.cpf || row.employee_registration || "Sem identificador"}</span></td><td className="p-2">{row.branch_name || "-"} / {row.sector_name || "-"}</td><td className="p-2">{row.position || "-"}</td><td className="p-2">{row.gse_code ? `${row.gse_code} - ${row.gse_name}` : <span className="text-amber-700">Sem GSE</span>}</td></tr>)}</tbody></table>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_220px]"><label className="text-xs font-semibold text-slate-700">Motivo da atribuição<Input className="mt-1" value={reason} onChange={event => setReason(event.target.value)} /></label><label className="text-xs font-semibold text-slate-700">Origem<select className="mt-1 h-10 w-full border bg-white px-3 text-sm" value={origin} onChange={event => setOrigin(event.target.value)}><option value="manual">Manual</option><option value="importacao">Importação</option><option value="api">API</option><option value="totvs">TOTVS</option><option value="validacao_sesmt">Validação SESMT</option></select></label></div>
        <div className="flex items-center justify-between"><span className="text-sm font-semibold text-teal-800">{props.selected.length} trabalhador(es) selecionado(s)</span><div className="flex gap-2"><Button variant="outline" onClick={props.close}>Cancelar</Button><Button disabled={!props.selected.length || !reason.trim() || props.busy} onClick={() => props.confirm(reason, origin)}>{props.busy ? "Atribuindo..." : "Confirmar atribuição"}</Button></div></div>
      </DialogContent>
    </Dialog>
  );
}

function LinkDialog({ open, close, gse, pgrs, busy, confirm }: { open: boolean; close: () => void; gse: any; pgrs: any[]; busy: boolean; confirm: (id: number) => void }) {
  const [pgrId, setPgrId] = useState(0);
  return (
    <Dialog open={open} onOpenChange={value => !value && close()}>
      <DialogContent><DialogHeader><DialogTitle>Vincular PGR a {gse?.code}</DialogTitle></DialogHeader><div className="space-y-4"><p className="text-sm text-slate-600">Será criado um contexto de risco vinculado ao GSE mestre. A população e a identidade do grupo continuam nesta parametrização.</p><select className="h-10 w-full border bg-white px-3 text-sm" value={pgrId} onChange={event => setPgrId(Number(event.target.value))}><option value={0}>Selecione o PGR</option>{pgrs.map(row => <option key={row.id} value={row.id}>{row.title} · {row.status}</option>)}</select><div className="flex justify-end gap-2"><Button variant="outline" onClick={close}>Cancelar</Button><Button disabled={!pgrId || busy} onClick={() => confirm(pgrId)}>{busy ? "Vinculando..." : "Vincular"}</Button></div></div></DialogContent>
    </Dialog>
  );
}
