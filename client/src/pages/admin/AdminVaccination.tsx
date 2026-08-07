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
import { Building2, CalendarDays, Plus, Syringe, UserRound } from "lucide-react";
import { toast } from "sonner";

type Tab = "vacinas" | "parceiros" | "campanhas" | "registros";
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
  const vaccinesQ = trpc.medical.listVaccines.useQuery();
  const partnersQ = trpc.medical.listVaccinePartners.useQuery();
  const campaignsQ = trpc.medical.listVaccineCampaigns.useQuery();
  const recordsQ = trpc.medical.listVaccinationRecords.useQuery();
  const collaboratorsQ = trpc.medical.listCollaborators.useQuery();
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
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "vacinas", label: "Vacinas" },
    { id: "parceiros", label: "Parceiros" },
    { id: "campanhas", label: "Campanhas" },
    { id: "registros", label: "Doses registradas" },
  ];
  const action =
    tab === "vacinas"
      ? () => setDialog("vacina")
      : tab === "parceiros"
        ? () => setDialog("parceiro")
        : tab === "campanhas"
          ? () => setDialog("campanha")
          : () => setDialog("registro");
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
          <Button onClick={action}>
            <Plus className="mr-1" size={15} /> Novo registro
          </Button>
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
