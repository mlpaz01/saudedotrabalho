import { useState } from "react";
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
import { Building2, CalendarDays, Download, Mail, Plus, Syringe, UserRound } from "lucide-react";
import { toast } from "sonner";

type Tab = "vacinas" | "parceiros" | "campanhas" | "populacao" | "registros";
type DialogKind = "vacina" | "parceiro" | "campanha" | "registro" | null;

function nowLocal() {
  const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return date.toISOString().slice(0, 16);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminVaccination() {
  const [tab, setTab] = useState<Tab>("vacinas");
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [campaignId, setCampaignId] = useState(0);
  const [workerSearch, setWorkerSearch] = useState("");
  const [branchId, setBranchId] = useState(0);
  const [sectorId, setSectorId] = useState(0);
  const [gseId, setGseId] = useState(0);
  const [selectedWorkers, setSelectedWorkers] = useState<number[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<number[]>([]);
  const vaccinesQ = trpc.medical.listVaccines.useQuery();
  const partnersQ = trpc.medical.listVaccinePartners.useQuery();
  const campaignsQ = trpc.medical.listVaccineCampaigns.useQuery();
  const recordsQ = trpc.medical.listVaccinationRecords.useQuery();
  const collaboratorsQ = trpc.medical.listCollaborators.useQuery();
  const workersQ = trpc.occupationalLifecycle.listWorkers.useQuery({ query: workerSearch || undefined });
  const structureQ = trpc.occupationalLifecycle.listStructure.useQuery();
  const gsesQ = trpc.occupationalLifecycle.listGses.useQuery();
  const populationQ = trpc.occupationalLifecycle.listVaccineCampaignPopulation.useQuery({ campaignId: campaignId || 1 }, { enabled: Boolean(campaignId) });
  const refresh = () => {
    vaccinesQ.refetch();
    partnersQ.refetch();
    campaignsQ.refetch();
    recordsQ.refetch();
  };
  const vaccineSave = trpc.medical.upsertVaccine.useMutation({
    onSuccess: () => {
      refresh();
      setDialog(null);
      toast.success("Vacina cadastrada.");
    },
    onError: error => toast.error(error.message),
  });
  const partnerSave = trpc.medical.upsertVaccinePartner.useMutation({
    onSuccess: () => {
      refresh();
      setDialog(null);
      toast.success("Parceiro cadastrado.");
    },
    onError: error => toast.error(error.message),
  });
  const campaignSave = trpc.medical.createVaccineCampaign.useMutation({
    onSuccess: () => {
      refresh();
      setDialog(null);
      toast.success("Campanha criada.");
    },
    onError: error => toast.error(error.message),
  });
  const recordSave = trpc.medical.recordVaccination.useMutation({
    onSuccess: () => {
      refresh();
      setDialog(null);
      toast.success("Dose registrada e comprovante arquivado.");
    },
    onError: error => toast.error(error.message),
  });
  const populationSave = trpc.occupationalLifecycle.setVaccineCampaignPopulation.useMutation({ onSuccess: result => { populationQ.refetch(); setSelectedWorkers([]); toast.success(`${result.selected} colaborador(es) incluído(s) na convocação.`); }, onError: error => toast.error(error.message) });
  const attendanceSave = trpc.occupationalLifecycle.updateVaccinationAttendance.useMutation({ onSuccess: () => populationQ.refetch(), onError: error => toast.error(error.message) });
  const emailPopulation = trpc.occupationalLifecycle.sendVaccineCampaignEmails.useMutation({ onSuccess: result => { populationQ.refetch(); toast.success(`${result.sent} comunicação(ões) processada(s); ${result.failed} falha(s).`); }, onError: error => toast.error(error.message) });
  const proofPopulation = trpc.occupationalLifecycle.generateVaccineCampaignProofs.useMutation({ onSuccess: result => { const anchor = document.createElement("a"); anchor.href = result.dataBase64; anchor.download = result.fileName; anchor.click(); toast.success(`${result.total} comprovante(s) gerado(s).`); }, onError: error => toast.error(error.message) });
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "vacinas", label: "Vacinas" },
    { id: "parceiros", label: "Parceiros" },
    { id: "campanhas", label: "Campanhas" },
    { id: "populacao", label: "População e presença" },
    { id: "registros", label: "Doses registradas" },
  ];
  const action =
    tab === "vacinas"
      ? () => setDialog("vacina")
      : tab === "parceiros"
        ? () => setDialog("parceiro")
        : tab === "campanhas"
          ? () => setDialog("campanha")
          : tab === "registros" ? () => setDialog("registro") : null;
  return (
    <AppLayout>
      <div className="mx-auto max-w-[1450px] space-y-4 p-4 md:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-teal-700">
              <Syringe size={15} /> SESMT
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">
              Gestão de Vacinação
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Catálogo, parceiros, campanhas, doses, alertas e comprovantes.
            </p>
          </div>
          {action ? <Button onClick={action}>
            <Plus className="mr-1" size={15} /> Novo registro
          </Button> : null}
        </header>

        <div className="grid gap-3 sm:grid-cols-4">
          <Metric icon={<Syringe size={17} />} label="Vacinas" value={(vaccinesQ.data || []).length} />
          <Metric icon={<Building2 size={17} />} label="Parceiros" value={(partnersQ.data || []).length} />
          <Metric icon={<CalendarDays size={17} />} label="Campanhas" value={(campaignsQ.data || []).length} />
          <Metric icon={<UserRound size={17} />} label="Doses registradas" value={(recordsQ.data || []).length} />
        </div>

        <section className="border bg-white">
          <div className="flex gap-1 overflow-x-auto border-b px-3">
            {tabs.map(item => (
              <button
                className={`h-11 border-b-2 px-4 text-sm font-medium ${tab === item.id ? "border-teal-600 text-teal-800" : "border-transparent text-slate-500"}`}
                key={item.id}
                onClick={() => setTab(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="p-4">
            {tab === "vacinas" ? (
              <SimpleTable
                headers={["Vacina", "Fabricante", "Doses", "Intervalo", "Situação"]}
                rows={((vaccinesQ.data || []) as any[]).map(row => [
                  row.name,
                  row.manufacturer || "-",
                  row.dose_count,
                  row.interval_days ? `${row.interval_days} dias` : "-",
                  Number(row.is_active) ? "Ativa" : "Inativa",
                ])}
              />
            ) : null}
            {tab === "parceiros" ? (
              <SimpleTable
                headers={["Parceiro", "CNPJ", "Responsável", "Contato"]}
                rows={((partnersQ.data || []) as any[]).map(row => [
                  row.name,
                  row.cnpj || "-",
                  row.contact_name || "-",
                  row.phone || row.email || "-",
                ])}
              />
            ) : null}
            {tab === "campanhas" ? (
              <SimpleTable
                headers={["Campanha", "Vacina", "Data", "Local", "Público", "Parceiro"]}
                rows={((campaignsQ.data || []) as any[]).map(row => [
                  row.name,
                  row.vaccine_name,
                  new Date(row.campaign_at).toLocaleString("pt-BR"),
                  row.location || "-",
                  row.audience_text || "-",
                  row.partner_name || "-",
                ])}
              />
            ) : null}
            {tab === "registros" ? (
              <SimpleTable
                headers={["Colaborador", "CPF", "Vacina", "Dose", "Data", "Lote", "Próxima dose"]}
                rows={((recordsQ.data || []) as any[]).map(row => [
                  row.collaborator_name,
                  row.cpf || "-",
                  row.vaccine_name,
                  row.dose_number,
                  row.vaccination_date,
                  row.lot || "-",
                  row.next_dose_date || "-",
                ])}
              />
            ) : null}
            {tab === "populacao" ? <VaccinationPopulation
              campaigns={(campaignsQ.data || []) as any[]}
              campaignId={campaignId}
              setCampaignId={setCampaignId}
              workers={(workersQ.data || []) as any[]}
              structure={structureQ.data as any}
              gses={(gsesQ.data || []) as any[]}
              search={workerSearch}
              setSearch={setWorkerSearch}
              branchId={branchId}
              setBranchId={setBranchId}
              sectorId={sectorId}
              setSectorId={setSectorId}
              gseId={gseId}
              setGseId={setGseId}
              selectedWorkers={selectedWorkers}
              setSelectedWorkers={setSelectedWorkers}
              participants={(populationQ.data || []) as any[]}
              selectedParticipants={selectedParticipants}
              setSelectedParticipants={setSelectedParticipants}
              savePopulation={(ids: number[]) => populationSave.mutate({ campaignId, collaboratorIds: ids })}
              saveAttendance={(id: number, status: any) => attendanceSave.mutate({ id, status })}
              sendEmails={() => emailPopulation.mutate({ campaignId, participantIds: selectedParticipants })}
              generateProofs={() => proofPopulation.mutate({ campaignId, participantIds: selectedParticipants })}
              busy={populationSave.isPending || attendanceSave.isPending || emailPopulation.isPending || proofPopulation.isPending}
            /> : null}
          </div>
        </section>
      </div>

      <VaccinationDialog
        kind={dialog}
        close={() => setDialog(null)}
        vaccines={(vaccinesQ.data || []) as any[]}
        partners={(partnersQ.data || []) as any[]}
        campaigns={(campaignsQ.data || []) as any[]}
        collaborators={(collaboratorsQ.data || []) as any[]}
        busy={
          vaccineSave.isPending ||
          partnerSave.isPending ||
          campaignSave.isPending ||
          recordSave.isPending
        }
        saveVaccine={payload => vaccineSave.mutate(payload)}
        savePartner={payload => partnerSave.mutate(payload)}
        saveCampaign={payload => campaignSave.mutate(payload)}
        saveRecord={payload => recordSave.mutate(payload)}
      />
    </AppLayout>
  );
}

function VaccinationPopulation(props: any) {
  const filteredWorkers = props.workers.filter((row: any) => (!props.branchId || Number(row.branch_id) === props.branchId) && (!props.sectorId || Number(row.sector_id) === props.sectorId) && (!props.gseId || Number(row.gse_id) === props.gseId));
  const participantWorkerIds = new Set(props.participants.map((row: any) => Number(row.collaborator_id)));
  const availableWorkers = filteredWorkers.filter((row: any) => !participantWorkerIds.has(Number(row.id)));
  const coverage = props.participants.length ? Math.round(props.participants.filter((row: any) => row.status === "vacinado").length / props.participants.length * 100) : 0;
  return <div className="space-y-4">
    <div className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_repeat(3,minmax(150px,220px))]">
      <label className="text-xs font-semibold">Campanha<select className="mt-1 h-10 w-full border bg-white px-3 text-sm" value={props.campaignId} onChange={event => { props.setCampaignId(Number(event.target.value)); props.setSelectedParticipants([]); props.setSelectedWorkers([]); }}><option value={0}>Selecione a campanha</option>{props.campaigns.map((row: any) => <option key={row.id} value={row.id}>{row.name} · {new Date(row.campaign_at).toLocaleDateString("pt-BR")}</option>)}</select></label>
      <label className="text-xs font-semibold">Filial<select className="mt-1 h-10 w-full border bg-white px-3 text-sm" value={props.branchId} onChange={event => props.setBranchId(Number(event.target.value))}><option value={0}>Todas</option>{(props.structure?.branches || []).map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      <label className="text-xs font-semibold">Setor<select className="mt-1 h-10 w-full border bg-white px-3 text-sm" value={props.sectorId} onChange={event => props.setSectorId(Number(event.target.value))}><option value={0}>Todos</option>{(props.structure?.sectors || []).filter((row: any) => !props.branchId || Number(row.branch_id) === props.branchId).map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      <label className="text-xs font-semibold">GSE<select className="mt-1 h-10 w-full border bg-white px-3 text-sm" value={props.gseId} onChange={event => props.setGseId(Number(event.target.value))}><option value={0}>Todos</option>{props.gses.map((row: any) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></label>
    </div>
    {!props.campaignId ? <div className="border-l-4 border-amber-400 bg-amber-50 p-4 text-sm">Selecione uma campanha para montar a população convocada.</div> : <>
      <div className="grid gap-3 sm:grid-cols-4"><Metric icon={<UserRound size={17} />} label="Convocados" value={props.participants.length} /><Metric icon={<Syringe size={17} />} label="Vacinados" value={props.participants.filter((row: any) => row.status === "vacinado").length} /><Metric icon={<CalendarDays size={17} />} label="Ausentes / pendentes" value={props.participants.filter((row: any) => row.status !== "vacinado").length} /><Metric icon={<Syringe size={17} />} label="Cobertura" value={coverage} /></div>
      <section className="border"><div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 p-3"><div><b>Selecionar população</b><p className="text-xs text-slate-500">Filtros estruturais usam os mesmos cadastros de filial, setor e GSE da plataforma.</p></div><Button disabled={props.busy || !props.selectedWorkers.length} onClick={() => props.savePopulation(props.selectedWorkers)}>Incluir {props.selectedWorkers.length} convocado(s)</Button></div><div className="p-3"><Input className="mb-3" placeholder="Buscar nome, CPF, matrícula ou cargo" value={props.search} onChange={event => props.setSearch(event.target.value)} /><div className="max-h-56 overflow-auto border"><table className="w-full min-w-[760px] text-sm"><thead className="sticky top-0 bg-white text-xs"><tr><th className="w-10 p-2"><input type="checkbox" checked={Boolean(availableWorkers.length) && props.selectedWorkers.length === availableWorkers.length} onChange={event => props.setSelectedWorkers(event.target.checked ? availableWorkers.map((row: any) => Number(row.id)) : [])} /></th><th className="p-2 text-left">Trabalhador</th><th className="p-2 text-left">Filial / Setor</th><th className="p-2 text-left">Cargo</th><th className="p-2 text-left">GSE</th></tr></thead><tbody>{availableWorkers.map((row: any) => <tr key={row.id} className="border-t"><td className="p-2 text-center"><input type="checkbox" checked={props.selectedWorkers.includes(Number(row.id))} onChange={() => props.setSelectedWorkers((current: number[]) => current.includes(Number(row.id)) ? current.filter(id => id !== Number(row.id)) : [...current, Number(row.id)])} /></td><td className="p-2 font-medium">{row.name}<br /><span className="text-xs text-slate-500">{row.cpf || row.employee_registration || "Sem identificador"}</span></td><td className="p-2">{row.branch_name || "-"} / {row.sector_name || "-"}</td><td className="p-2">{row.position || "-"}</td><td className="p-2">{row.gse_code || "Sem GSE"}</td></tr>)}</tbody></table></div></div></section>
      <section className="border"><div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 p-3"><div><b>Convocados e presença</b><p className="text-xs text-slate-500">A comunicação e os comprovantes são individuais, ainda que gerados em lote.</p></div><div className="flex gap-2"><Button variant="outline" disabled={props.busy || !props.selectedParticipants.length} onClick={props.generateProofs}><Download className="mr-2" size={14} /> Comprovantes ({props.selectedParticipants.length})</Button><Button disabled={props.busy || !props.selectedParticipants.length} onClick={props.sendEmails}><Mail className="mr-2" size={14} /> Enviar e-mail ({props.selectedParticipants.length})</Button></div></div><div className="overflow-auto"><table className="w-full min-w-[980px] text-sm"><thead className="text-xs"><tr><th className="w-10 p-2"><input type="checkbox" checked={Boolean(props.participants.length) && props.selectedParticipants.length === props.participants.length} onChange={event => props.setSelectedParticipants(event.target.checked ? props.participants.map((row: any) => Number(row.id)) : [])} /></th><th className="p-2 text-left">Trabalhador</th><th className="p-2 text-left">Filial / Setor</th><th className="p-2 text-left">Comunicação</th><th className="p-2 text-left">Situação</th><th className="p-2 text-left">Motivo</th></tr></thead><tbody>{props.participants.map((row: any) => <tr key={row.id} className="border-t"><td className="p-2 text-center"><input type="checkbox" checked={props.selectedParticipants.includes(Number(row.id))} onChange={() => props.setSelectedParticipants((current: number[]) => current.includes(Number(row.id)) ? current.filter(id => id !== Number(row.id)) : [...current, Number(row.id)])} /></td><td className="p-2 font-medium">{row.collaborator_name}<br /><span className="text-xs text-slate-500">{row.cpf || "Sem CPF"}</span></td><td className="p-2">{row.branch_name || "-"} / {row.sector_name || "-"}</td><td className="p-2"><Badge className="rounded-sm bg-slate-100 text-slate-700">{row.notification_status}</Badge></td><td className="p-2"><select className="h-9 border bg-white px-2 text-sm" value={row.status} onChange={event => props.saveAttendance(Number(row.id), event.target.value)}><option value="convocado">Convocado</option><option value="vacinado">Vacinado</option><option value="ausente">Ausente</option><option value="recusou">Recusou</option><option value="afastado">Afastado</option><option value="ferias">Férias</option><option value="outro">Outro</option></select></td><td className="p-2">{row.absence_reason || "-"}</td></tr>)}</tbody></table>{!props.participants.length && <p className="p-6 text-center text-sm text-slate-500">Nenhum colaborador convocado.</p>}</div></section>
    </>}
  </div>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex min-h-20 items-center gap-3 border bg-white p-3">
      <span className="text-teal-700">{icon}</span>
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-xl font-bold">{value}</div>
      </div>
    </div>
  );
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: any[][] }) {
  return (
    <div className="overflow-auto border">
      <table className="w-full min-w-[850px] text-sm">
        <thead className="bg-slate-50 text-xs text-slate-600">
          <tr>{headers.map(header => <th className="p-2 text-left" key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr className="border-t" key={index}>
              {row.map((cell, cellIndex) => <td className="p-2" key={cellIndex}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length ? <p className="p-4 text-sm text-slate-500">Nenhum registro encontrado.</p> : null}
    </div>
  );
}

function VaccinationDialog({
  kind,
  close,
  vaccines,
  partners,
  campaigns,
  collaborators,
  busy,
  saveVaccine,
  savePartner,
  saveCampaign,
  saveRecord,
}: {
  kind: DialogKind;
  close: () => void;
  vaccines: any[];
  partners: any[];
  campaigns: any[];
  collaborators: any[];
  busy: boolean;
  saveVaccine: (p: any) => void;
  savePartner: (p: any) => void;
  saveCampaign: (p: any) => void;
  saveRecord: (p: any) => void;
}) {
  const [form, setForm] = useState<Record<string, any>>({});
  const set = (key: string, value: any) => setForm(current => ({ ...current, [key]: value }));
  const submit = () => {
    if (kind === "vacina")
      saveVaccine({
        name: form.name || "",
        manufacturer: form.manufacturer || undefined,
        vaccineType: form.vaccineType || undefined,
        indication: form.indication || undefined,
        doseCount: Number(form.doseCount || 1),
        intervalDays: form.intervalDays ? Number(form.intervalDays) : null,
        notes: form.notes || undefined,
        isActive: true,
      });
    if (kind === "parceiro")
      savePartner({
        name: form.name || "",
        cnpj: form.cnpj || undefined,
        contactName: form.contactName || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
      });
    if (kind === "campanha")
      saveCampaign({
        vaccineId: Number(form.vaccineId || 0),
        partnerId: form.partnerId ? Number(form.partnerId) : null,
        name: form.name || "",
        campaignAt: form.campaignAt || nowLocal(),
        location: form.location || undefined,
        audienceText: form.audienceText || undefined,
        estimatedQuantity: form.estimatedQuantity ? Number(form.estimatedQuantity) : null,
        additionalInfo: form.additionalInfo || undefined,
      });
    if (kind === "registro")
      saveRecord({
        collaboratorId: Number(form.collaboratorId || 0),
        vaccineId: Number(form.vaccineId || 0),
        campaignId: form.campaignId ? Number(form.campaignId) : null,
        vaccinationDate: form.vaccinationDate || today(),
        doseNumber: Number(form.doseNumber || 1),
        lot: form.lot || undefined,
        manufacturer: form.manufacturer || undefined,
        location: form.location || undefined,
        appliedBy: form.appliedBy || undefined,
        nextDoseDate: form.nextDoseDate || null,
        observations: form.observations || undefined,
      });
  };
  const title =
    kind === "vacina"
      ? "Cadastrar vacina"
      : kind === "parceiro"
        ? "Cadastrar parceiro"
        : kind === "campanha"
          ? "Criar campanha"
          : "Registrar dose";
  return (
    <Dialog
      open={Boolean(kind)}
      onOpenChange={value => {
        if (!value) {
          setForm({});
          close();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          {kind === "vacina" ? (
            <>
              <Input placeholder="Nome da vacina" value={form.name || ""} onChange={e => set("name", e.target.value)} />
              <div className="grid gap-3 md:grid-cols-2">
                <Input placeholder="Fabricante" value={form.manufacturer || ""} onChange={e => set("manufacturer", e.target.value)} />
                <Input placeholder="Tipo" value={form.vaccineType || ""} onChange={e => set("vaccineType", e.target.value)} />
                <Input type="number" min={1} placeholder="Número de doses" value={form.doseCount || ""} onChange={e => set("doseCount", e.target.value)} />
                <Input type="number" min={0} placeholder="Intervalo em dias" value={form.intervalDays || ""} onChange={e => set("intervalDays", e.target.value)} />
              </div>
              <Textarea placeholder="Indicação" value={form.indication || ""} onChange={e => set("indication", e.target.value)} />
            </>
          ) : null}
          {kind === "parceiro" ? (
            <>
              <Input placeholder="Nome do parceiro" value={form.name || ""} onChange={e => set("name", e.target.value)} />
              <div className="grid gap-3 md:grid-cols-2">
                <Input placeholder="CNPJ" value={form.cnpj || ""} onChange={e => set("cnpj", e.target.value)} />
                <Input placeholder="Responsável" value={form.contactName || ""} onChange={e => set("contactName", e.target.value)} />
                <Input placeholder="Telefone" value={form.phone || ""} onChange={e => set("phone", e.target.value)} />
                <Input type="email" placeholder="E-mail" value={form.email || ""} onChange={e => set("email", e.target.value)} />
              </div>
              <Textarea placeholder="Endereço" value={form.address || ""} onChange={e => set("address", e.target.value)} />
            </>
          ) : null}
          {kind === "campanha" ? (
            <>
              <Input placeholder="Nome da campanha" value={form.name || ""} onChange={e => set("name", e.target.value)} />
              <div className="grid gap-3 md:grid-cols-2">
                <select className="h-10 border bg-white px-2 text-sm" value={form.vaccineId || ""} onChange={e => set("vaccineId", e.target.value)}>
                  <option value="">Selecione a vacina</option>{vaccines.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
                </select>
                <select className="h-10 border bg-white px-2 text-sm" value={form.partnerId || ""} onChange={e => set("partnerId", e.target.value)}>
                  <option value="">Sem parceiro</option>{partners.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
                </select>
                <Input type="datetime-local" value={form.campaignAt || nowLocal()} onChange={e => set("campaignAt", e.target.value)} />
                <Input placeholder="Local" value={form.location || ""} onChange={e => set("location", e.target.value)} />
                <Input type="number" min={0} placeholder="Quantidade estimada" value={form.estimatedQuantity || ""} onChange={e => set("estimatedQuantity", e.target.value)} />
              </div>
              <Textarea placeholder="Público-alvo" value={form.audienceText || ""} onChange={e => set("audienceText", e.target.value)} />
              <Textarea placeholder="Informações adicionais" value={form.additionalInfo || ""} onChange={e => set("additionalInfo", e.target.value)} />
            </>
          ) : null}
          {kind === "registro" ? (
            <>
              <select className="h-10 border bg-white px-2 text-sm" value={form.collaboratorId || ""} onChange={e => set("collaboratorId", e.target.value)}>
                <option value="">Selecione o colaborador</option>{collaborators.map(row => <option key={row.id} value={row.id}>{row.name} · {row.cpf || "sem CPF"}</option>)}
              </select>
              <div className="grid gap-3 md:grid-cols-2">
                <select className="h-10 border bg-white px-2 text-sm" value={form.vaccineId || ""} onChange={e => set("vaccineId", e.target.value)}>
                  <option value="">Selecione a vacina</option>{vaccines.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
                </select>
                <select className="h-10 border bg-white px-2 text-sm" value={form.campaignId || ""} onChange={e => set("campaignId", e.target.value)}>
                  <option value="">Sem campanha</option>{campaigns.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
                </select>
                <Input type="date" value={form.vaccinationDate || today()} onChange={e => set("vaccinationDate", e.target.value)} />
                <Input type="number" min={1} placeholder="Dose" value={form.doseNumber || ""} onChange={e => set("doseNumber", e.target.value)} />
                <Input placeholder="Lote" value={form.lot || ""} onChange={e => set("lot", e.target.value)} />
                <Input placeholder="Fabricante" value={form.manufacturer || ""} onChange={e => set("manufacturer", e.target.value)} />
                <Input placeholder="Local" value={form.location || ""} onChange={e => set("location", e.target.value)} />
                <Input placeholder="Aplicador" value={form.appliedBy || ""} onChange={e => set("appliedBy", e.target.value)} />
                <Input type="date" value={form.nextDoseDate || ""} onChange={e => set("nextDoseDate", e.target.value)} />
              </div>
              <Textarea placeholder="Observações" value={form.observations || ""} onChange={e => set("observations", e.target.value)} />
            </>
          ) : null}
          <Button disabled={busy} onClick={submit}>{busy ? "Salvando..." : "Salvar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
