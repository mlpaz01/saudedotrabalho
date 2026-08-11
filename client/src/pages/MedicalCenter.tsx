import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import PcmsoWorkspace from "@/components/medical/PcmsoWorkspace";
import { RichTextEditor } from "@/components/RichTextEditor";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  Archive,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardPlus,
  Download,
  Eye,
  FileHeart,
  FileText,
  FolderLock,
  History,
  Microscope,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Syringe,
  UserRound,
} from "lucide-react";

type Tab =
  | "dashboard"
  | "pessoas"
  | "prontuario"
  | "atendimentos"
  | "pcmso"
  | "exames"
  | "atestados"
  | "vacinacao"
  | "encaminhamentos"
  | "documentos"
  | "relatorios";

const tabs: Array<{ id: Tab; label: string; icon: any }> = [
  { id: "dashboard", label: "Dashboard Médico", icon: Activity },
  { id: "pessoas", label: "Colaboradores", icon: UserRound },
  { id: "prontuario", label: "Prontuário", icon: FolderLock },
  { id: "atendimentos", label: "Atendimentos", icon: Stethoscope },
  { id: "pcmso", label: "PCMSO", icon: FileHeart },
  { id: "exames", label: "Exames", icon: Microscope },
  { id: "atestados", label: "Atestados", icon: FileText },
  { id: "vacinacao", label: "Vacinação", icon: Syringe },
  { id: "encaminhamentos", label: "Encaminhamentos", icon: ClipboardPlus },
  { id: "documentos", label: "Documentos", icon: FolderLock },
  { id: "relatorios", label: "Relatórios", icon: History },
];

function localDateTime() {
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

function downloadData(dataBase64: string, fileName: string) {
  const anchor = document.createElement("a");
  anchor.href = dataBase64;
  anchor.download = fileName;
  anchor.click();
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-semibold text-slate-700">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function Panel({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="border bg-white">
      <div className="flex items-start justify-between gap-4 border-b px-4 py-3">
        <div>
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function MedicalCenter() {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [search, setSearch] = useState("");
  const [patientId, setPatientId] = useState<number | null>(null);
  const [encounterOpen, setEncounterOpen] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);
  const [certificateOpen, setCertificateOpen] = useState(false);
  const [medicationOpen, setMedicationOpen] = useState(false);
  const [programOpen, setProgramOpen] = useState(false);
  const [programDraft, setProgramDraft] = useState<any>(null);
  const [annexOpen, setAnnexOpen] = useState(false);
  const [vaccineOpen, setVaccineOpen] = useState(false);
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [vaccinationOpen, setVaccinationOpen] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(
    null
  );
  const [selectedTechnicalId, setSelectedTechnicalId] = useState<number | null>(
    null
  );

  const dashboardQ = trpc.medical.dashboard.useQuery();
  const profileQ = trpc.medical.getDoctorProfile.useQuery();
  const collaboratorsQ = trpc.medical.listCollaborators.useQuery();
  const programsQ = trpc.medical.listPrograms.useQuery();
  const pgrsQ = trpc.medical.listPgrs.useQuery();
  const pcmsoDefaultsQ = trpc.medical.getPcmsoDefaultText.useQuery();
  const examsQ = trpc.medical.listExams.useQuery();
  const vaccinesQ = trpc.medical.listVaccines.useQuery();
  const partnersQ = trpc.medical.listVaccinePartners.useQuery();
  const campaignsQ = trpc.medical.listVaccineCampaigns.useQuery();
  const recordQ = trpc.medical.getPatientRecord.useQuery(
    { collaboratorId: patientId || 0 },
    { enabled: !!patientId }
  );
  const programQ = trpc.medical.getProgram.useQuery(
    { id: selectedProgramId || 0 },
    { enabled: !!selectedProgramId }
  );
  const auditQ = trpc.medical.auditTrail.useQuery(
    { limit: 100 },
    { enabled: tab === "relatorios" }
  );
  const technicalDocsQ = trpc.technicalDocuments.list.useQuery(undefined, {
    enabled: tab === "documentos",
  });
  const technicalDetailQ = trpc.technicalDocuments.get.useQuery(
    { id: selectedTechnicalId || 0 },
    { enabled: tab === "documentos" && Boolean(selectedTechnicalId) }
  );

  useEffect(() => {
    const rows = (technicalDocsQ.data || []) as any[];
    if (tab === "documentos" && rows.length && !selectedTechnicalId) {
      setSelectedTechnicalId(Number(rows[0].id));
    }
  }, [tab, technicalDocsQ.data, selectedTechnicalId]);

  const collaborators = useMemo(
    () =>
      ((collaboratorsQ.data || []) as any[]).filter(row => {
        const needle = search.trim().toLowerCase();
        return (
          !needle ||
          [
            row.name,
            row.cpf,
            row.position,
            row.branch_name,
            row.sector_name,
          ].some(value =>
            String(value || "")
              .toLowerCase()
              .includes(needle)
          )
        );
      }),
    [collaboratorsQ.data, search]
  );

  const profileSave = trpc.medical.saveDoctorProfile.useMutation({
    onSuccess: () => {
      profileQ.refetch();
      toast.success("Perfil médico atualizado.");
    },
    onError: error => toast.error(error.message),
  });
  const encounterCreate = trpc.medical.createEncounter.useMutation({
    onSuccess: () => {
      recordQ.refetch();
      setEncounterOpen(false);
      toast.success("Atendimento registrado com trilha de auditoria.");
    },
    onError: error => toast.error(error.message),
  });
  const referralCreate = trpc.medical.createReferral.useMutation({
    onSuccess: () => {
      recordQ.refetch();
      setReferralOpen(false);
      toast.success("Encaminhamento registrado.");
    },
    onError: error => toast.error(error.message),
  });
  const certificateCreate = trpc.medical.createCertificate.useMutation({
    onSuccess: () => {
      recordQ.refetch();
      setCertificateOpen(false);
      toast.success("Atestado médico registrado e assinado eletronicamente.");
    },
    onError: error => toast.error(error.message),
  });
  const medicationCreate = trpc.medical.recordMedication.useMutation({
    onSuccess: () => {
      recordQ.refetch();
      setMedicationOpen(false);
      toast.success("Medicamento registrado.");
    },
    onError: error => toast.error(error.message),
  });
  const programSave = trpc.medical.upsertProgram.useMutation({
    onSuccess: result => {
      programsQ.refetch();
      setSelectedProgramId(result.id);
      setProgramOpen(false);
      toast.success("PCMSO salvo.");
    },
    onError: error => toast.error(error.message),
  });
  const importPgr = trpc.medical.importPgr.useMutation({
    onSuccess: result => {
      programQ.refetch();
      programsQ.refetch();
      toast.success(`${result.imported} risco(s) importado(s) do PGR.`);
    },
    onError: error => toast.error(error.message),
  });
  const decideMonitoring = trpc.medical.decideMonitoring.useMutation({
    onSuccess: async result => {
      await programQ.refetch();
      toast.success(
        (result as any)?.ignored
          ? "Sugestão da IA descartada."
          : "Decisão médica salva e atualizada na matriz."
      );
    },
    onError: error => toast.error(error.message),
  });
  const annexSave = trpc.medical.addAnnex.useMutation({
    onSuccess: () => {
      programQ.refetch();
      setAnnexOpen(false);
      toast.success("Anexo arquivado no PCMSO.");
    },
    onError: error => toast.error(error.message),
  });
  const vaccineSave = trpc.medical.upsertVaccine.useMutation({
    onSuccess: () => {
      vaccinesQ.refetch();
      setVaccineOpen(false);
      toast.success("Vacina cadastrada.");
    },
    onError: error => toast.error(error.message),
  });
  const partnerSave = trpc.medical.upsertVaccinePartner.useMutation({
    onSuccess: () => {
      partnersQ.refetch();
      setPartnerOpen(false);
      toast.success("Parceiro cadastrado.");
    },
    onError: error => toast.error(error.message),
  });
  const campaignSave = trpc.medical.createVaccineCampaign.useMutation({
    onSuccess: () => {
      campaignsQ.refetch();
      setCampaignOpen(false);
      toast.success("Campanha de vacinação criada.");
    },
    onError: error => toast.error(error.message),
  });
  const vaccinationSave = trpc.medical.recordVaccination.useMutation({
    onSuccess: () => {
      recordQ.refetch();
      setVaccinationOpen(false);
      toast.success("Vacinação registrada no prontuário e no dossiê.");
    },
    onError: error => toast.error(error.message),
  });
  const pdfGenerate = trpc.medical.generatePcmsoPdf.useMutation({
    onSuccess: result => {
      downloadData(result.dataBase64, result.fileName);
      programQ.refetch();
      toast.success(`PCMSO versão ${result.version} gerado e arquivado.`);
    },
    onError: error => toast.error(error.message),
  });
  const pcmsoAi = trpc.medical.generatePcmsoWithAi.useMutation({
    onSuccess: result => {
      programQ.refetch();
      toast.success(
        result.usedAi
          ? "PCMSO estruturado pela IA para revisão médica."
          : "Estrutura segura gerada; o provedor de IA não estava disponível."
      );
    },
    onError: error => toast.error(error.message),
  });
  const pcmsoAudit = trpc.medical.auditPcmso.useMutation({
    onSuccess: result => {
      programQ.refetch();
      toast.success(`Auditoria concluída: ${result.score}% de atendimento.`);
    },
    onError: error => toast.error(error.message),
  });
  const analyticalReport = trpc.medical.generateAnalyticalReport.useMutation({
    onSuccess: () => {
      programQ.refetch();
      toast.success("Relatório analítico gerado para revisão médica.");
    },
    onError: error => toast.error(error.message),
  });
  const reviewAnalytical = trpc.medical.reviewAnalyticalReport.useMutation({
    onSuccess: () => {
      programQ.refetch();
      toast.success("Relatório analítico atualizado.");
    },
    onError: error => toast.error(error.message),
  });
  const discardAnalytical = trpc.medical.discardAnalyticalReport.useMutation({
    onSuccess: () => {
      programQ.refetch();
      toast.success(
        "Versão descartada. O histórico foi preservado para auditoria."
      );
    },
    onError: error => toast.error(error.message),
  });
  const savePcmso = trpc.medical.savePcmso.useMutation({
    onSuccess: result => {
      programQ.refetch();
      programsQ.refetch();
      toast.success(
        `PCMSO salvo como ${String(result.status).replaceAll("_", " ")}. A publicação permanece independente.`
      );
    },
    onError: error => toast.error(error.message),
  });
  const pgrReview = trpc.medical.requestPgrReview.useMutation({
    onSuccess: () => {
      programQ.refetch();
      toast.success("Solicitação de reavaliação encaminhada ao fluxo do PGR.");
    },
    onError: error => toast.error(error.message),
  });
  const signPcmso = trpc.medical.signAndPublishPcmso.useMutation({
    onSuccess: () => {
      programQ.refetch();
      programsQ.refetch();
      toast.success("PCMSO assinado eletronicamente e publicado como vigente.");
    },
    onError: error => toast.error(error.message),
  });
  const archivePcmso = trpc.medical.archivePcmso.useMutation({
    onSuccess: () => {
      programQ.refetch();
      programsQ.refetch();
      toast.success("PCMSO arquivado com histórico preservado.");
    },
    onError: error => toast.error(error.message),
  });

  async function downloadPrivate(
    kind: "pcmso_annex" | "pcmso_version",
    id: number
  ) {
    try {
      const result = await (utils as any).client.medical.downloadPrivate.query({
        kind,
        id,
      });
      downloadData(result.dataBase64, result.fileName);
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível baixar o documento.");
    }
  }

  async function downloadTechnicalVersion(id: number) {
    try {
      const result = await utils.client.technicalDocuments.download.query({
        kind: "version",
        id,
      });
      downloadData(result.dataBase64, result.fileName);
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível baixar o documento.");
    }
  }

  function selectPatient(id: number, target: Tab = "prontuario") {
    setPatientId(id);
    setTab(target);
  }

  const selectedProgram = (programQ.data as any)?.program;
  const patient = (recordQ.data as any)?.patient;

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1500px] space-y-5 p-4 md:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-teal-700">
              <ShieldCheck size={15} /> Área clínica restrita
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">
              Central Médica
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Medicina do Trabalho, PCMSO e prontuário eletrônico ocupacional.
            </p>
          </div>
          <Badge className="rounded-sm bg-emerald-100 text-emerald-800">
            Perfil Médico
          </Badge>
        </header>

        <div className="flex gap-1 overflow-x-auto border-b pb-1">
          {tabs.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`flex h-9 shrink-0 items-center gap-2 border-b-2 px-3 text-xs font-medium ${tab === item.id ? "border-teal-600 text-teal-800" : "border-transparent text-slate-500 hover:text-slate-900"}`}
              >
                <Icon size={14} />
                {item.label}
              </button>
            );
          })}
        </div>

        {tab === "dashboard" && (
          <Dashboard
            data={dashboardQ.data as any}
            profile={profileQ.data as any}
            onSave={(data: any) => profileSave.mutate(data)}
            saving={profileSave.isPending}
          />
        )}

        {tab === "pessoas" && (
          <Panel
            title="Colaboradores"
            subtitle="Acesso ao prontuário ocorre somente após a seleção explícita do paciente."
          >
            <div className="relative mb-4 max-w-lg">
              <Search
                className="absolute left-3 top-2.5 text-slate-400"
                size={16}
              />
              <Input
                className="pl-9"
                placeholder="Buscar por nome, CPF, cargo, filial ou setor"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
            </div>
            <div className="overflow-auto border">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="p-2 text-left">Colaborador</th>
                    <th className="p-2 text-left">CPF</th>
                    <th className="p-2 text-left">Cargo</th>
                    <th className="p-2 text-left">Filial / Setor</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {collaborators.map(row => (
                    <tr key={row.id} className="border-t">
                      <td className="p-2 font-medium">{row.name}</td>
                      <td className="p-2">{row.cpf || "-"}</td>
                      <td className="p-2">{row.position || "-"}</td>
                      <td className="p-2">
                        {row.branch_name || "-"} / {row.sector_name || "-"}
                      </td>
                      <td className="p-2 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => selectPatient(Number(row.id))}
                        >
                          Abrir prontuário
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {(
          [
            "prontuario",
            "atendimentos",
            "atestados",
            "encaminhamentos",
          ] as Tab[]
        ).includes(tab) && (
          <PatientWorkspace
            patient={patient}
            data={recordQ.data as any}
            collaborators={collaborators}
            patientId={patientId}
            onSelect={setPatientId}
            onNewEncounter={() => setEncounterOpen(true)}
            onNewReferral={() => setReferralOpen(true)}
            onNewCertificate={() => setCertificateOpen(true)}
            onNewMedication={() => setMedicationOpen(true)}
          />
        )}

        {tab === "pcmso" && (
          <PcmsoWorkspace
            programs={(programsQ.data || []) as any[]}
            pgrs={(pgrsQ.data || []) as any[]}
            exams={(examsQ.data || []) as any[]}
            selectedId={selectedProgramId}
            select={setSelectedProgramId}
            data={programQ.data as any}
            onNew={() => {
              setProgramDraft(null);
              setProgramOpen(true);
            }}
            onEdit={() => {
              setProgramDraft(selectedProgram);
              setProgramOpen(true);
            }}
            onAnnex={() => setAnnexOpen(true)}
            onDownload={downloadPrivate}
            onImport={pgrId =>
              selectedProgramId &&
              importPgr.mutate({ pcmsoId: selectedProgramId, pgrId })
            }
            onDecision={payload => decideMonitoring.mutate(payload)}
            onGenerateAi={() =>
              selectedProgramId && pcmsoAi.mutate({ id: selectedProgramId })
            }
            onAudit={() =>
              selectedProgramId && pcmsoAudit.mutate({ id: selectedProgramId })
            }
            onAnalyticalReport={payload =>
              selectedProgramId &&
              analyticalReport.mutate({
                pcmsoId: selectedProgramId,
                ...payload,
              })
            }
            onReviewAnalytical={payload => reviewAnalytical.mutate(payload)}
            onDiscardAnalytical={payload => discardAnalytical.mutate(payload)}
            onPgrReview={payload =>
              selectedProgramId &&
              pgrReview.mutate({ pcmsoId: selectedProgramId, ...payload })
            }
            onSign={() =>
              selectedProgramId &&
              signPcmso.mutate({ id: selectedProgramId, confirmation: true })
            }
            onSave={() =>
              selectedProgramId && savePcmso.mutate({ id: selectedProgramId })
            }
            onArchive={() =>
              selectedProgramId &&
              archivePcmso.mutate({ id: selectedProgramId })
            }
            onPdf={() =>
              selectedProgramId && pdfGenerate.mutate({ id: selectedProgramId })
            }
            busy={
              importPgr.isPending ||
              pdfGenerate.isPending ||
              pcmsoAi.isPending ||
              pcmsoAudit.isPending ||
              analyticalReport.isPending ||
              discardAnalytical.isPending ||
              savePcmso.isPending ||
              signPcmso.isPending ||
              archivePcmso.isPending
            }
          />
        )}

        {tab === "exames" && (
          <Panel
            title="Exames ocupacionais e ASO"
            subtitle="O PCMSO define o planejamento; a execução clínica e os ASOs permanecem vinculados ao prontuário, sem cadastro paralelo de exames."
          >
            <div className="grid gap-3 md:grid-cols-5">
              {[
                "Admissional",
                "Periódico",
                "Retorno ao trabalho",
                "Mudança de risco",
                "Demissional",
              ].map(name => (
                <div
                  className="border bg-slate-50 p-3 text-sm font-semibold"
                  key={name}
                >
                  <CheckCircle2 className="mb-2 text-teal-700" size={18} />
                  {name}
                </div>
              ))}
            </div>
          </Panel>
        )}

        {tab === "vacinacao" && (
          <Panel
            title="Campanha de Vacinação Corporativa"
            subtitle="Consulta médica das vacinas, campanhas, doses e comprovantes. A gestão operacional é realizada pelo SESMT."
          >
            <div className="grid gap-5 lg:grid-cols-3">
              <div>
                <h3 className="mb-2 text-sm font-semibold">
                  Vacinas cadastradas
                </h3>
                <div className="space-y-2">
                  {((vaccinesQ.data || []) as any[]).map(row => (
                    <div key={row.id} className="border p-3">
                      <b>{row.name}</b>
                      <div className="text-xs text-slate-500">
                        {row.manufacturer || "Fabricante não informado"} ·{" "}
                        {row.dose_count} dose(s)
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Parceiros</h3>
                <div className="space-y-2">
                  {((partnersQ.data || []) as any[]).map(row => (
                    <div key={row.id} className="border p-3">
                      <b>{row.name}</b>
                      <div className="text-xs text-slate-500">
                        {row.cnpj || "CNPJ não informado"} ·{" "}
                        {row.phone || row.email || "Sem contato"}
                      </div>
                    </div>
                  ))}
                  {!partnersQ.data?.length && (
                    <p className="text-sm text-slate-500">
                      Nenhum parceiro cadastrado.
                    </p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Campanhas</h3>
                <div className="space-y-2">
                  {((campaignsQ.data || []) as any[]).map(row => (
                    <div key={row.id} className="border p-3">
                      <b>{row.name}</b>
                      <div className="text-xs text-slate-500">
                        {row.vaccine_name} ·{" "}
                        {new Date(row.campaign_at).toLocaleString("pt-BR")} ·{" "}
                        {row.partner_name || "sem parceiro"}
                      </div>
                    </div>
                  ))}
                  {!campaignsQ.data?.length && (
                    <p className="text-sm text-slate-500">
                      Nenhuma campanha cadastrada.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Panel>
        )}

        {tab === "documentos" && (
          <Panel
            title="Documentos médicos e técnicos"
            subtitle="Consulta restrita a PCMSO, LTCAT, Insalubridade e Periculosidade da empresa. A edição dos laudos técnicos permanece com o SESMT."
          >
            <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
              <div className="divide-y border">
                {((technicalDocsQ.data || []) as any[]).map(row => (
                  <button
                    className={`w-full p-3 text-left text-sm ${selectedTechnicalId === Number(row.id) ? "bg-teal-50" : "hover:bg-slate-50"}`}
                    key={row.id}
                    onClick={() => setSelectedTechnicalId(Number(row.id))}
                    type="button"
                  >
                    <b className="line-clamp-2">{row.title}</b>
                    <span className="mt-1 block text-xs text-slate-500">
                      {row.document_type?.toUpperCase()} · {row.status} ·{" "}
                      {Number(row.compliance_score || 0)}%
                    </span>
                  </button>
                ))}
                {!technicalDocsQ.data?.length ? (
                  <p className="p-3 text-sm text-slate-500">
                    Nenhum laudo técnico compartilhado nesta empresa.
                  </p>
                ) : null}
              </div>
              <div className="border p-4">
                {(technicalDetailQ.data as any)?.document ? (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
                      <div>
                        <h3 className="font-semibold">
                          {(technicalDetailQ.data as any).document.title}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          PGR:{" "}
                          {(technicalDetailQ.data as any).document.pgr_title ||
                            "-"}{" "}
                          · consulta somente
                        </p>
                      </div>
                      <Badge variant="outline" className="rounded-sm">
                        {(technicalDetailQ.data as any).document.status}
                      </Badge>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">
                      {(technicalDetailQ.data as any).document.conclusion ||
                        "Conclusão técnica ainda não registrada."}
                    </p>
                    <div className="mt-4 divide-y border">
                      {((technicalDetailQ.data as any).versions || []).map(
                        (version: any) => (
                          <button
                            className="flex w-full items-center justify-between p-3 text-left text-sm hover:bg-slate-50"
                            key={version.id}
                            onClick={() =>
                              downloadTechnicalVersion(Number(version.id))
                            }
                            type="button"
                          >
                            Versão {version.version_number} ·{" "}
                            {new Date(version.generated_at).toLocaleString(
                              "pt-BR"
                            )}
                            <Download size={14} />
                          </button>
                        )
                      )}
                      {!(technicalDetailQ.data as any).versions?.length ? (
                        <p className="p-3 text-sm text-slate-500">
                          Nenhuma versão em PDF disponível.
                        </p>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">
                    Selecione um documento para consulta.
                  </p>
                )}
              </div>
            </div>
          </Panel>
        )}

        {tab === "relatorios" && (
          <Panel
            title="Auditoria da Central Médica"
            subtitle="Leituras e alterações relevantes ficam registradas com usuário, data, entidade e paciente."
          >
            <div className="overflow-auto border">
              <table className="w-full min-w-[700px] text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-2 text-left">Data</th>
                    <th className="p-2 text-left">Usuário</th>
                    <th className="p-2 text-left">Ação</th>
                    <th className="p-2 text-left">Entidade</th>
                    <th className="p-2 text-left">Paciente</th>
                  </tr>
                </thead>
                <tbody>
                  {((auditQ.data || []) as any[]).map(row => (
                    <tr className="border-t" key={row.id}>
                      <td className="p-2">
                        {new Date(row.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="p-2">{row.actor_name}</td>
                      <td className="p-2">{row.action}</td>
                      <td className="p-2">
                        {row.entity_type} #{row.entity_id || "-"}
                      </td>
                      <td className="p-2">{row.collaborator_id || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        <EncounterDialog
          open={encounterOpen}
          close={() => setEncounterOpen(false)}
          patientId={patientId}
          save={payload => encounterCreate.mutate(payload)}
          busy={encounterCreate.isPending}
        />
        <ReferralDialog
          open={referralOpen}
          close={() => setReferralOpen(false)}
          patientId={patientId}
          save={payload => referralCreate.mutate(payload)}
          busy={referralCreate.isPending}
        />
        <CertificateDialog
          open={certificateOpen}
          close={() => setCertificateOpen(false)}
          patientId={patientId}
          save={payload => certificateCreate.mutate(payload)}
          busy={certificateCreate.isPending}
        />
        <MedicationDialog
          open={medicationOpen}
          close={() => setMedicationOpen(false)}
          patientId={patientId}
          save={payload => medicationCreate.mutate(payload)}
          busy={medicationCreate.isPending}
        />
        <ProgramDialog
          open={programOpen}
          close={() => setProgramOpen(false)}
          initial={programDraft}
          defaults={pcmsoDefaultsQ.data as any}
          pgrs={(pgrsQ.data || []) as any[]}
          save={payload => programSave.mutate(payload)}
          busy={programSave.isPending}
        />
        <AnnexDialog
          open={annexOpen}
          close={() => setAnnexOpen(false)}
          pcmsoId={selectedProgramId}
          save={payload => annexSave.mutate(payload)}
          busy={annexSave.isPending}
        />
        <VaccineDialog
          open={vaccineOpen}
          close={() => setVaccineOpen(false)}
          save={payload => vaccineSave.mutate(payload)}
          busy={vaccineSave.isPending}
        />
        <PartnerDialog
          open={partnerOpen}
          close={() => setPartnerOpen(false)}
          save={payload => partnerSave.mutate(payload)}
          busy={partnerSave.isPending}
        />
        <CampaignDialog
          open={campaignOpen}
          close={() => setCampaignOpen(false)}
          vaccines={(vaccinesQ.data || []) as any[]}
          partners={(partnersQ.data || []) as any[]}
          save={payload => campaignSave.mutate(payload)}
          busy={campaignSave.isPending}
        />
        <VaccinationDialog
          open={vaccinationOpen}
          close={() => setVaccinationOpen(false)}
          patientId={patientId}
          vaccines={(vaccinesQ.data || []) as any[]}
          save={payload => vaccinationSave.mutate(payload)}
          busy={vaccinationSave.isPending}
        />
      </div>
    </AppLayout>
  );
}

function Dashboard({
  data,
  profile,
  onSave,
  saving,
}: {
  data: any;
  profile: any;
  onSave: (data: any) => void;
  saving: boolean;
}) {
  const [crm, setCrm] = useState(profile?.crm || "");
  const [crmState, setCrmState] = useState(profile?.crm_state || "");
  const [specialty, setSpecialty] = useState(
    profile?.specialty || "Medicina do Trabalho"
  );
  const [signatureBase64, setSignatureBase64] = useState("");
  const [signatureFileName, setSignatureFileName] = useState("");
  useEffect(() => {
    setCrm(profile?.crm || "");
    setCrmState(profile?.crm_state || "");
    setSpecialty(profile?.specialty || "Medicina do Trabalho");
    setSignatureBase64("");
    setSignatureFileName("");
  }, [
    profile?.crm,
    profile?.crm_state,
    profile?.specialty,
    profile?.has_signature,
  ]);
  const cards = [
    ["PCMSO cadastrados", data?.pcmsoTotal || 0],
    ["PCMSO vigentes", data?.pcmsoActive || 0],
    ["Atendimentos no mês", data?.encountersMonth || 0],
    ["Atestados em análise", data?.pendingLeaves || 0],
    ["Registros de vacinação", data?.vaccinationRecords || 0],
    ["Doses próximas", data?.vaccineDosesDue || 0],
  ];
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {cards.map(([label, value]) => (
          <div className="border bg-white p-4" key={String(label)}>
            <div className="text-2xl font-bold text-teal-800">{value}</div>
            <div className="mt-1 text-xs text-slate-500">{label}</div>
          </div>
        ))}
      </div>
      <Panel
        title="Identificação do médico responsável"
        subtitle="CRM, UF e especialidade são exigidos para criar e assinar versões do PCMSO."
      >
        <div className="grid gap-3 md:grid-cols-5">
          <Field label="CRM">
            <Input
              value={crm}
              onChange={e => setCrm(e.target.value)}
              placeholder="123456"
            />
          </Field>
          <Field label="UF">
            <Input
              value={crmState}
              onChange={e => setCrmState(e.target.value.toUpperCase())}
              maxLength={2}
              placeholder="RJ"
            />
          </Field>
          <Field label="Especialidade">
            <Input
              value={specialty}
              onChange={e => setSpecialty(e.target.value)}
            />
          </Field>
          <Field label="Assinatura do médico">
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={event => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.size > 8_000_000) {
                  toast.error("A assinatura deve ter no máximo 8 MB.");
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                  setSignatureBase64(String(reader.result || ""));
                  setSignatureFileName(file.name);
                };
                reader.readAsDataURL(file);
              }}
            />
            <span className="mt-1 block text-[11px] text-slate-500">
              {signatureBase64
                ? "Nova assinatura pronta para salvar"
                : profile?.has_signature
                  ? "Assinatura cadastrada"
                  : "Nenhuma assinatura cadastrada"}
            </span>
          </Field>
          <div className="flex items-end">
            <Button
              disabled={!crm || crmState.length !== 2 || saving}
              onClick={() =>
                onSave({
                  crm,
                  crmState,
                  specialty,
                  signatureBase64: signatureBase64 || undefined,
                  signatureFileName: signatureFileName || undefined,
                })
              }
            >
              Salvar perfil
            </Button>
          </div>
        </div>
      </Panel>
      <div className="border-l-4 border-amber-500 bg-amber-50 p-4 text-sm text-amber-950">
        <b>Confidencialidade:</b> registros clínicos não são exibidos
        automaticamente ao RH, ao SESMT ou às chefias. A Central Médica mantém
        escopo próprio e auditoria de acesso.
      </div>
    </div>
  );
}

function PatientWorkspace({
  patient,
  data,
  collaborators,
  patientId,
  onSelect,
  onNewEncounter,
  onNewReferral,
  onNewCertificate,
  onNewMedication,
}: {
  patient: any;
  data: any;
  collaborators: any[];
  patientId: number | null;
  onSelect: (id: number) => void;
  onNewEncounter: () => void;
  onNewReferral: () => void;
  onNewCertificate: () => void;
  onNewMedication: () => void;
}) {
  if (!patientId)
    return (
      <Panel title="Selecione um colaborador">
        <select
          className="w-full max-w-lg border bg-white p-2 text-sm"
          value=""
          onChange={e => onSelect(Number(e.target.value))}
        >
          <option value="">Selecione...</option>
          {collaborators.map(row => (
            <option key={row.id} value={row.id}>
              {row.name} · {row.cpf || "sem CPF"}
            </option>
          ))}
        </select>
      </Panel>
    );
  const events = [
    ...(data?.encounters || []).map((x: any) => ({
      ...x,
      kind: "Atendimento",
      date: x.encounter_at,
      title: x.encounter_type,
      detail: x.conduct,
    })),
    ...(data?.referrals || []).map((x: any) => ({
      ...x,
      kind: "Encaminhamento",
      date: x.referral_date,
      title: x.destination_type,
      detail: x.destination_name,
    })),
    ...(data?.certificates || []).map((x: any) => ({
      ...x,
      kind: "Atestado médico",
      date: x.issue_date,
      title: x.administrative_summary || "Atestado emitido",
      detail: `${x.total_days} dia(s) / ${x.total_hours} hora(s)`,
    })),
    ...(data?.vaccinations || []).map((x: any) => ({
      ...x,
      kind: "Vacinação",
      date: x.vaccination_date,
      title: x.vaccine_name,
      detail: `Dose ${x.dose_number}`,
    })),
  ].sort(
    (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  return (
    <div className="space-y-4">
      <Panel
        title={patient?.name || "Prontuário"}
        subtitle={`${patient?.cpf || "CPF não informado"} · ${patient?.position || "Cargo não informado"} · ${patient?.branch_name || "-"} / ${patient?.sector_name || "-"}`}
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="outline" onClick={onNewReferral}>
              <ClipboardPlus size={14} className="mr-1" /> Encaminhar
            </Button>
            <Button size="sm" variant="outline" onClick={onNewCertificate}>
              <FileText size={14} className="mr-1" /> Atestado
            </Button>
            <Button size="sm" variant="outline" onClick={onNewMedication}>
              <Plus size={14} className="mr-1" /> Medicamento
            </Button>
            <Button size="sm" onClick={onNewEncounter}>
              <Plus size={14} className="mr-1" /> Novo atendimento
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ["Atendimentos", data?.encounters?.length || 0],
            ["Encaminhamentos", data?.referrals?.length || 0],
            ["Atestados médicos", data?.certificates?.length || 0],
            ["Vacinas", data?.vaccinations?.length || 0],
          ].map(([label, value]) => (
            <div key={String(label)} className="bg-slate-50 p-3">
              <b className="text-xl text-teal-800">{value}</b>
              <div className="text-xs text-slate-500">{label}</div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel
        title="Linha do tempo médico-ocupacional"
        subtitle="Eventos em ordem cronológica; conteúdo clínico permanece nesta área restrita."
      >
        <div className="space-y-3">
          {events.map((event: any, index) => (
            <div
              key={`${event.kind}-${event.id}-${index}`}
              className="grid gap-2 border-l-2 border-teal-500 pl-4 sm:grid-cols-[150px_1fr]"
            >
              <div className="text-xs text-slate-500">
                {new Date(event.date).toLocaleString("pt-BR")}
              </div>
              <div>
                <Badge variant="outline" className="rounded-sm">
                  {event.kind}
                </Badge>
                <div className="mt-1 font-semibold">{event.title}</div>
                <div className="text-sm text-slate-600">
                  {event.detail || "Sem observação adicional"}
                </div>
              </div>
            </div>
          ))}
          {!events.length && (
            <p className="text-sm text-slate-500">Nenhum evento registrado.</p>
          )}
        </div>
      </Panel>
    </div>
  );
}

function LegacyPcmsoWorkspace({
  programs,
  pgrs,
  exams,
  selectedId,
  select,
  data,
  onNew,
  onEdit,
  onAnnex,
  onDownload,
  onImport,
  onDecision,
  onPdf,
  busy,
}: {
  programs: any[];
  pgrs: any[];
  exams: any[];
  selectedId: number | null;
  select: (id: number) => void;
  data: any;
  onNew: () => void;
  onEdit: () => void;
  onAnnex: () => void;
  onDownload: (kind: "pcmso_annex" | "pcmso_version", id: number) => void;
  onImport: (id: number) => void;
  onDecision: (payload: any) => void;
  onPdf: () => void;
  busy: boolean;
}) {
  const [pgrId, setPgrId] = useState(0);
  const program = data?.program;
  const monitoring = data?.monitoring || [];
  return (
    <div className="space-y-4">
      <Panel
        title="Programas PCMSO"
        subtitle="O Médico elabora, revisa, assina, gera e arquiva o PCMSO."
        action={
          <Button size="sm" onClick={onNew}>
            <Plus size={14} className="mr-1" /> Novo PCMSO
          </Button>
        }
      >
        <div className="flex flex-wrap gap-2">
          {programs.map(row => (
            <button
              key={row.id}
              className={`border px-3 py-2 text-left text-sm ${selectedId === row.id ? "border-teal-600 bg-teal-50" : "bg-white"}`}
              onClick={() => select(Number(row.id))}
            >
              <b>{row.title}</b>
              <div className="text-xs text-slate-500">
                {row.status} · versão {row.current_version}
              </div>
            </button>
          ))}
          {!programs.length && (
            <p className="text-sm text-slate-500">Nenhum PCMSO criado.</p>
          )}
        </div>
      </Panel>
      {program && (
        <>
          <Panel
            title={program.title}
            subtitle={`Vigência: ${program.valid_from || "-"} a ${program.valid_until || "-"} · Médico: ${program.doctor_name} ${program.doctor_crm}`}
            action={
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={onEdit}>
                  Editar
                </Button>
                <Button size="sm" variant="outline" onClick={onAnnex}>
                  Anexar documento
                </Button>
                <Button size="sm" disabled={busy} onClick={onPdf}>
                  <Download size={14} className="mr-1" /> Gerar e arquivar PDF
                </Button>
              </div>
            }
          >
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <select
                className="border bg-white p-2 text-sm"
                value={pgrId}
                onChange={e => setPgrId(Number(e.target.value))}
              >
                <option value={0}>Selecione o PGR que será utilizado...</option>
                {pgrs.map(row => (
                  <option value={row.id} key={row.id}>
                    {row.title} · {row.status}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                disabled={!pgrId || busy}
                onClick={() => onImport(pgrId)}
              >
                <RefreshCw size={14} className="mr-1" /> Importar PGR
              </Button>
            </div>
          </Panel>
          <Panel
            title="Riscos e monitoramento médico"
            subtitle="A importação não prescreve exames. Cada linha exige decisão médica registrada."
          >
            <div className="overflow-auto border">
              <table className="w-full min-w-[1100px] text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-2 text-left">GSE / Risco</th>
                    <th className="p-2 text-left">Classificação</th>
                    <th className="p-2 text-left">Detalhamento do PGR</th>
                    <th className="p-2 text-left">Decisão médica</th>
                    <th className="p-2 text-left">Periodicidade</th>
                    <th className="p-2 text-left">Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {monitoring.map((row: any) => (
                    <LegacyMonitoringRow
                      key={row.id}
                      row={row}
                      exams={exams}
                      save={onDecision}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel
            title="Anexos e versões"
            subtitle="Anexos 1 a 8 e PDFs versionados são mantidos em armazenamento privado."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold">Anexos</h3>
                {(data.annexes || []).map((row: any) => (
                  <button
                    type="button"
                    className="flex w-full items-center justify-between border-b py-2 text-left text-sm hover:text-teal-700"
                    key={row.id}
                    onClick={() => onDownload("pcmso_annex", Number(row.id))}
                  >
                    <span>
                      Anexo {row.annex_number} · {row.title || row.file_name}
                    </span>
                    <Download size={14} />
                  </button>
                ))}
                {!data.annexes?.length && (
                  <p className="text-sm text-slate-500">Nenhum anexo.</p>
                )}
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Versões</h3>
                {(data.versions || []).map((row: any) => (
                  <button
                    type="button"
                    className="flex w-full items-center justify-between border-b py-2 text-left text-sm hover:text-teal-700"
                    key={row.id}
                    onClick={() => onDownload("pcmso_version", Number(row.id))}
                  >
                    <span>
                      Versão {row.version_number} ·{" "}
                      {new Date(row.generated_at).toLocaleString("pt-BR")}
                    </span>
                    <Download size={14} />
                  </button>
                ))}
                {!data.versions?.length && (
                  <p className="text-sm text-slate-500">
                    Nenhuma versão gerada.
                  </p>
                )}
              </div>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

function LegacyMonitoringRow({
  row,
  exams,
  save,
}: {
  row: any;
  exams: any[];
  save: (payload: any) => void;
}) {
  const [kind, setKind] = useState(row.monitoring_kind || "nao_definido");
  const [examId, setExamId] = useState(row.exam_id || 0);
  const [periodicity, setPeriodicity] = useState(row.periodicity || "");
  const [observations, setObservations] = useState(row.observations || "");
  return (
    <tr className="border-t align-top">
      <td className="p-2">
        <b>{row.gse_name || "Sem GSE"}</b>
        <div className="mt-1">{row.risk_name}</div>
        <div className="text-slate-500">{row.risk_type}</div>
      </td>
      <td className="p-2">{row.risk_classification || "-"}</td>
      <td className="max-w-sm whitespace-pre-wrap p-2 text-slate-600">
        {row.technical_detail || "Sem detalhamento importado"}
      </td>
      <td className="p-2">
        <select
          className="w-full border bg-white p-1"
          value={kind}
          onChange={e => setKind(e.target.value)}
        >
          <option value="nao_definido">Não definido</option>
          <option value="avaliacao_clinica">Avaliação clínica</option>
          <option value="exame_complementar">Exame complementar</option>
          <option value="nao_aplicavel">Não aplicável</option>
        </select>
        {kind === "exame_complementar" ? (
          <select
            className="mt-1 w-full border bg-white p-1"
            value={examId}
            onChange={e => setExamId(Number(e.target.value))}
          >
            <option value={0}>Selecione o exame</option>
            {exams
              .filter(x => Number(x.is_active))
              .map(x => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </select>
        ) : kind === "avaliacao_clinica" ? (
          <div className="mt-1 border border-sky-200 bg-sky-50 p-2 text-xs text-sky-900">
            Consulta clínica ocupacional. O procedimento será vinculado
            automaticamente ao catálogo mestre.
          </div>
        ) : null}
      </td>
      <td className="p-2">
        <Input
          className="h-8 text-xs"
          value={periodicity}
          onChange={e => setPeriodicity(e.target.value)}
          placeholder="Ex.: anual"
        />
      </td>
      <td className="p-2">
        <Textarea
          className="min-h-16 text-xs"
          value={observations}
          onChange={e => setObservations(e.target.value)}
        />
        <Button
          size="sm"
          className="mt-1 w-full"
          onClick={() =>
            save({
              id: Number(row.id),
              monitoringKind: kind,
              examId: examId || null,
              monitoringName:
                kind === "avaliacao_clinica"
                  ? "Consulta clínica ocupacional"
                  : undefined,
              periodicity: periodicity || undefined,
              observations: observations || undefined,
            })
          }
        >
          Salvar decisão
        </Button>
      </td>
    </tr>
  );
}

function EncounterDialog({
  open,
  close,
  patientId,
  save,
  busy,
}: {
  open: boolean;
  close: () => void;
  patientId: number | null;
  save: (p: any) => void;
  busy: boolean;
}) {
  const [type, setType] = useState("consulta_ambulatorial");
  const [at, setAt] = useState(localDateTime());
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [conduct, setConduct] = useState("");
  const [guidance, setGuidance] = useState("");
  return (
    <Dialog open={open} onOpenChange={value => !value && close()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo atendimento médico</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Tipo">
            <select
              className="w-full border bg-white p-2 text-sm"
              value={type}
              onChange={e => setType(e.target.value)}
            >
              <option value="consulta_ambulatorial">
                Consulta ambulatorial
              </option>
              <option value="posto_medico">Atendimento no posto médico</option>
              <option value="avaliacao_clinica">Avaliação clínica</option>
              <option value="acidente_incidente">Acidente ou incidente</option>
              <option value="orientacao">Orientação médica</option>
              <option value="outro">Outro</option>
            </select>
          </Field>
          <Field label="Data e horário">
            <Input
              type="datetime-local"
              value={at}
              onChange={e => setAt(e.target.value)}
            />
          </Field>
          <Field label="Motivo">
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </Field>
          <Field label="Anotações médicas">
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} />
          </Field>
          <Field label="Conduta">
            <Textarea
              value={conduct}
              onChange={e => setConduct(e.target.value)}
            />
          </Field>
          <Field label="Orientações">
            <Textarea
              value={guidance}
              onChange={e => setGuidance(e.target.value)}
            />
          </Field>
          <Button
            disabled={!patientId || busy}
            onClick={() =>
              patientId &&
              save({
                collaboratorId: patientId,
                encounterAt: new Date(at).toISOString(),
                encounterType: type,
                reason,
                clinicalNotes: notes,
                conduct,
                guidance,
              })
            }
          >
            Registrar atendimento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReferralDialog({
  open,
  close,
  patientId,
  save,
  busy,
}: {
  open: boolean;
  close: () => void;
  patientId: number | null;
  save: (p: any) => void;
  busy: boolean;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState("especialista");
  const [destination, setDestination] = useState("");
  const [reason, setReason] = useState("");
  const [guidance, setGuidance] = useState("");
  return (
    <Dialog open={open} onOpenChange={value => !value && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo encaminhamento</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Data">
            <Input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </Field>
          <Field label="Destino">
            <select
              className="w-full border bg-white p-2 text-sm"
              value={type}
              onChange={e => setType(e.target.value)}
            >
              <option value="emergencia">Emergência</option>
              <option value="pronto_atendimento">Pronto atendimento</option>
              <option value="especialista">Especialista</option>
              <option value="clinica">Clínica</option>
              <option value="laboratorio">Laboratório</option>
              <option value="servico_externo">Serviço externo</option>
            </select>
          </Field>
          <Field label="Local ou profissional">
            <Input
              value={destination}
              onChange={e => setDestination(e.target.value)}
            />
          </Field>
          <Field label="Motivo">
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </Field>
          <Field label="Orientação">
            <Textarea
              value={guidance}
              onChange={e => setGuidance(e.target.value)}
            />
          </Field>
          <Button
            disabled={!patientId || busy}
            onClick={() =>
              patientId &&
              save({
                collaboratorId: patientId,
                referralDate: date,
                destinationType: type,
                destinationName: destination || undefined,
                reason,
                guidance,
              })
            }
          >
            Registrar encaminhamento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CertificateDialog({
  open,
  close,
  patientId,
  save,
  busy,
}: {
  open: boolean;
  close: () => void;
  patientId: number | null;
  save: (p: any) => void;
  busy: boolean;
}) {
  const [issueDate, setIssueDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [startAt, setStartAt] = useState(localDateTime());
  const [endAt, setEndAt] = useState(localDateTime());
  const [days, setDays] = useState(0);
  const [hours, setHours] = useState(0);
  const [returnDate, setReturnDate] = useState("");
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <Dialog open={open} onOpenChange={value => !value && close()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Emitir atestado médico</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Emissão">
              <Input
                type="date"
                value={issueDate}
                onChange={e => setIssueDate(e.target.value)}
              />
            </Field>
            <Field label="Início">
              <Input
                type="datetime-local"
                value={startAt}
                onChange={e => setStartAt(e.target.value)}
              />
            </Field>
            <Field label="Término">
              <Input
                type="datetime-local"
                value={endAt}
                onChange={e => setEndAt(e.target.value)}
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Dias">
              <Input
                type="number"
                min={0}
                value={days}
                onChange={e => setDays(Number(e.target.value))}
              />
            </Field>
            <Field label="Horas">
              <Input
                type="number"
                min={0}
                value={hours}
                onChange={e => setHours(Number(e.target.value))}
              />
            </Field>
            <Field label="Retorno">
              <Input
                type="date"
                value={returnDate}
                onChange={e => setReturnDate(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Resumo administrativo">
            <Textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="Texto que pode orientar o fluxo administrativo sem expor informação clínica desnecessária."
            />
          </Field>
          <Field label="Notas clínicas privadas">
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} />
          </Field>
          <Button
            disabled={!patientId || busy || new Date(endAt) < new Date(startAt)}
            onClick={() =>
              patientId &&
              save({
                collaboratorId: patientId,
                issueDate,
                startAt: new Date(startAt).toISOString(),
                endAt: new Date(endAt).toISOString(),
                totalDays: days,
                totalHours: hours,
                returnDate: returnDate || null,
                administrativeSummary: summary,
                clinicalPrivateNotes: notes,
              })
            }
          >
            Emitir e registrar assinatura eletrônica
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MedicationDialog({
  open,
  close,
  patientId,
  save,
  busy,
}: {
  open: boolean;
  close: () => void;
  patientId: number | null;
  save: (p: any) => void;
  busy: boolean;
}) {
  const [medication, setMedication] = useState("");
  const [quantity, setQuantity] = useState("");
  const [at, setAt] = useState(localDateTime());
  const [guidance, setGuidance] = useState("");
  const [observations, setObservations] = useState("");
  return (
    <Dialog open={open} onOpenChange={value => !value && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar medicamento</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Medicamento">
            <Input
              value={medication}
              onChange={e => setMedication(e.target.value)}
            />
          </Field>
          <Field label="Quantidade">
            <Input
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
            />
          </Field>
          <Field label="Data e horário">
            <Input
              type="datetime-local"
              value={at}
              onChange={e => setAt(e.target.value)}
            />
          </Field>
          <Field label="Orientação">
            <Textarea
              value={guidance}
              onChange={e => setGuidance(e.target.value)}
            />
          </Field>
          <Field label="Observações">
            <Textarea
              value={observations}
              onChange={e => setObservations(e.target.value)}
            />
          </Field>
          <Button
            disabled={!patientId || !medication.trim() || busy}
            onClick={() =>
              patientId &&
              save({
                collaboratorId: patientId,
                medication: medication.trim(),
                quantity: quantity || undefined,
                administeredAt: new Date(at).toISOString(),
                guidance,
                observations,
              })
            }
          >
            Registrar medicamento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AnnexDialog({
  open,
  close,
  pcmsoId,
  save,
  busy,
}: {
  open: boolean;
  close: () => void;
  pcmsoId: number | null;
  save: (p: any) => void;
  busy: boolean;
}) {
  const [annex, setAnnex] = useState(1);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const submit = () => {
    if (!pcmsoId || !file) return;
    if (file.size > 12 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 12 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      save({
        pcmsoId,
        annexNumber: annex,
        title: title || undefined,
        fileName: file.name,
        fileBase64: String(reader.result),
        sortOrder: 0,
      });
    reader.onerror = () => toast.error("Não foi possível ler o arquivo.");
    reader.readAsDataURL(file);
  };
  return (
    <Dialog open={open} onOpenChange={value => !value && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anexar documento ao PCMSO</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Número do anexo">
            <select
              className="w-full border bg-white p-2 text-sm"
              value={annex}
              onChange={e => setAnnex(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map(value => (
                <option key={value} value={value}>
                  Anexo {value}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Título">
            <Input value={title} onChange={e => setTitle(e.target.value)} />
          </Field>
          <Field label="Arquivo">
            <Input
              type="file"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
          </Field>
          <Button disabled={!pcmsoId || !file || busy} onClick={submit}>
            {busy ? "Arquivando..." : "Arquivar anexo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProgramDialog({
  open,
  close,
  initial,
  defaults,
  pgrs,
  save,
  busy,
}: {
  open: boolean;
  close: () => void;
  initial: any;
  defaults?: { introduction?: string; conclusion?: string } | null;
  pgrs: any[];
  save: (p: any) => void;
  busy: boolean;
}) {
  const [title, setTitle] = useState("");
  const [pgrId, setPgrId] = useState(0);
  const [status, setStatus] = useState("rascunho");
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [intro, setIntro] = useState("");
  const [objective, setObjective] = useState("");
  const [methodology, setMethodology] = useState("");
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [chapters, setChapters] = useState<
    Array<{ title: string; content: string }>
  >([]);
  useEffect(() => {
    let parsed: any[] = [];
    try {
      parsed = JSON.parse(initial?.chapters_json || "[]");
    } catch {}
    setTitle(initial?.title || "");
    setPgrId(Number(initial?.pgr_id || 0));
    setStatus(initial?.status || "rascunho");
    setFrom(String(initial?.valid_from || "").slice(0, 10));
    setUntil(String(initial?.valid_until || "").slice(0, 10));
    setIntro(initial?.introduction || defaults?.introduction || "");
    setObjective(initial?.objective || "");
    setMethodology(initial?.methodology || "");
    setHeaderText(initial?.header_text || "");
    setFooterText(initial?.footer_text || "");
    setChapters(
      initial
        ? parsed
        : defaults?.conclusion
          ? [{ title: "Conclusão", content: defaults.conclusion }]
          : []
    );
  }, [initial, open, defaults]);
  const updateChapter = (
    index: number,
    key: "title" | "content",
    value: string
  ) =>
    setChapters(rows =>
      rows.map((row, i) => (i === index ? { ...row, [key]: value } : row))
    );
  return (
    <Dialog open={open} onOpenChange={value => !value && close()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar PCMSO" : "Novo PCMSO"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Título">
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Gerado automaticamente com empresa, filial e ano"
            />
            <span className="mt-1 block text-[11px] font-normal text-slate-500">
              Se ficar em branco, a plataforma criará o título no padrão PCMSO -
              Empresa - Filial - Ano.
            </span>
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="PGR de referência">
              <select
                className="w-full border bg-white p-2 text-sm"
                value={pgrId}
                onChange={e => setPgrId(Number(e.target.value))}
              >
                <option value={0}>Definir depois</option>
                {pgrs.map(row => (
                  <option key={row.id} value={row.id}>
                    {row.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Situação">
              <select
                className="w-full border bg-white p-2 text-sm"
                value={status}
                onChange={e => setStatus(e.target.value)}
              >
                <option value="rascunho">Rascunho</option>
                <option value="em_revisao">Em revisão</option>
                {initial?.status === "vigente" ? (
                  <option value="vigente">Vigente</option>
                ) : null}
                <option value="arquivado">Arquivado</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Início da vigência">
              <Input
                type="date"
                value={from}
                onChange={e => setFrom(e.target.value)}
              />
            </Field>
            <Field label="Fim da vigência">
              <Input
                type="date"
                value={until}
                onChange={e => setUntil(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Introdução">
            <RichTextEditor
              value={intro}
              onChange={setIntro}
              minHeight={180}
              placeholder="Digite a introdução do PCMSO..."
            />
          </Field>
          <Field label="Objetivo">
            <RichTextEditor
              value={objective}
              onChange={setObjective}
              minHeight={140}
              placeholder="Digite os objetivos do PCMSO..."
            />
          </Field>
          <Field label="Metodologia">
            <RichTextEditor
              value={methodology}
              onChange={setMethodology}
              minHeight={160}
              placeholder="Digite a metodologia do PCMSO..."
            />
          </Field>
          <div className="border p-3">
            <div className="mb-3 flex items-center justify-between">
              <b className="text-sm">Capítulos adicionais</b>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setChapters(rows => [...rows, { title: "", content: "" }])
                }
              >
                <Plus size={14} className="mr-1" /> Capítulo
              </Button>
            </div>
            <div className="space-y-3">
              {chapters.map((chapter, index) => (
                <div className="border bg-slate-50 p-3" key={index}>
                  <Input
                    value={chapter.title}
                    onChange={e =>
                      updateChapter(index, "title", e.target.value)
                    }
                    placeholder="Título do capítulo"
                  />
                  <div className="mt-2">
                    <RichTextEditor
                      value={chapter.content}
                      onChange={value => updateChapter(index, "content", value)}
                      minHeight={130}
                      placeholder="Conteúdo do capítulo"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1 text-rose-700"
                    onClick={() =>
                      setChapters(rows => rows.filter((_, i) => i !== index))
                    }
                  >
                    Remover capítulo
                  </Button>
                </div>
              ))}
              {!chapters.length && (
                <p className="text-xs text-slate-500">
                  Adicione capítulos próprios para complementar o texto-base.
                </p>
              )}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Cabeçalho">
              <Input
                value={headerText}
                onChange={e => setHeaderText(e.target.value)}
              />
            </Field>
            <Field label="Rodapé">
              <Input
                value={footerText}
                onChange={e => setFooterText(e.target.value)}
              />
            </Field>
          </div>
          <Button
            disabled={busy}
            onClick={() =>
              save({
                id: initial?.id,
                title: title.trim(),
                pgrId: pgrId || null,
                status,
                validFrom: from || null,
                validUntil: until || null,
                introduction: intro,
                objective,
                methodology,
                chapters,
                headerText,
                footerText,
              })
            }
          >
            {busy
              ? "Salvando..."
              : initial
                ? "Salvar alterações"
                : "Criar PCMSO"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExamDialog({
  open,
  close,
  save,
  busy,
}: {
  open: boolean;
  close: () => void;
  save: (p: any) => void;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("complementar");
  const [periodicity, setPeriodicity] = useState("");
  const [description, setDescription] = useState("");
  return (
    <Dialog open={open} onOpenChange={v => !v && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo exame ou monitoramento</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Nome">
            <Input value={name} onChange={e => setName(e.target.value)} />
          </Field>
          <Field label="Tipo">
            <select
              className="w-full border bg-white p-2 text-sm"
              value={type}
              onChange={e => setType(e.target.value)}
            >
              <option value="clinico">Clínico</option>
              <option value="complementar">Complementar</option>
            </select>
          </Field>
          <Field label="Periodicidade padrão">
            <Input
              value={periodicity}
              onChange={e => setPeriodicity(e.target.value)}
            />
          </Field>
          <Field label="Descrição">
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </Field>
          <Button
            disabled={!name || busy}
            onClick={() =>
              save({
                name,
                examType: type,
                defaultPeriodicity: periodicity || undefined,
                description: description || undefined,
                isActive: true,
              })
            }
          >
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VaccineDialog({
  open,
  close,
  save,
  busy,
}: {
  open: boolean;
  close: () => void;
  save: (p: any) => void;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [doseCount, setDoseCount] = useState(1);
  const [intervalDays, setIntervalDays] = useState(0);
  return (
    <Dialog open={open} onOpenChange={v => !v && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar vacina</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Nome">
            <Input value={name} onChange={e => setName(e.target.value)} />
          </Field>
          <Field label="Fabricante">
            <Input
              value={manufacturer}
              onChange={e => setManufacturer(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Número de doses">
              <Input
                type="number"
                min={1}
                value={doseCount}
                onChange={e => setDoseCount(Number(e.target.value))}
              />
            </Field>
            <Field label="Intervalo em dias">
              <Input
                type="number"
                min={0}
                value={intervalDays}
                onChange={e => setIntervalDays(Number(e.target.value))}
              />
            </Field>
          </div>
          <Button
            disabled={!name || busy}
            onClick={() =>
              save({
                name,
                manufacturer: manufacturer || undefined,
                doseCount,
                intervalDays: intervalDays || null,
                isActive: true,
              })
            }
          >
            Cadastrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PartnerDialog({
  open,
  close,
  save,
  busy,
}: {
  open: boolean;
  close: () => void;
  save: (p: any) => void;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  return (
    <Dialog open={open} onOpenChange={value => !value && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar parceiro de vacinação</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Nome">
            <Input value={name} onChange={e => setName(e.target.value)} />
          </Field>
          <Field label="CNPJ">
            <Input value={cnpj} onChange={e => setCnpj(e.target.value)} />
          </Field>
          <Field label="Responsável">
            <Input value={contact} onChange={e => setContact(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefone">
              <Input value={phone} onChange={e => setPhone(e.target.value)} />
            </Field>
            <Field label="E-mail">
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Endereço">
            <Textarea
              value={address}
              onChange={e => setAddress(e.target.value)}
            />
          </Field>
          <Button
            disabled={!name.trim() || busy}
            onClick={() =>
              save({
                name: name.trim(),
                cnpj: cnpj || undefined,
                contactName: contact || undefined,
                phone: phone || undefined,
                email: email || undefined,
                address: address || undefined,
              })
            }
          >
            Cadastrar parceiro
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CampaignDialog({
  open,
  close,
  vaccines,
  partners,
  save,
  busy,
}: {
  open: boolean;
  close: () => void;
  vaccines: any[];
  partners: any[];
  save: (p: any) => void;
  busy: boolean;
}) {
  const [vaccineId, setVaccineId] = useState(0);
  const [partnerId, setPartnerId] = useState(0);
  const [name, setName] = useState("");
  const [at, setAt] = useState(localDateTime());
  const [location, setLocation] = useState("");
  const [audience, setAudience] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [info, setInfo] = useState("");
  return (
    <Dialog open={open} onOpenChange={value => !value && close()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova campanha de vacinação</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Nome da campanha">
            <Input value={name} onChange={e => setName(e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Vacina">
              <select
                className="w-full border bg-white p-2 text-sm"
                value={vaccineId}
                onChange={e => setVaccineId(Number(e.target.value))}
              >
                <option value={0}>Selecione</option>
                {vaccines.map(row => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Parceiro">
              <select
                className="w-full border bg-white p-2 text-sm"
                value={partnerId}
                onChange={e => setPartnerId(Number(e.target.value))}
              >
                <option value={0}>Sem parceiro</option>
                {partners.map(row => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Data e horário">
              <Input
                type="datetime-local"
                value={at}
                onChange={e => setAt(e.target.value)}
              />
            </Field>
            <Field label="Local">
              <Input
                value={location}
                onChange={e => setLocation(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Público">
            <Textarea
              value={audience}
              onChange={e => setAudience(e.target.value)}
              placeholder="Filiais, setores ou grupos envolvidos"
            />
          </Field>
          <Field label="Quantidade estimada">
            <Input
              type="number"
              min={0}
              value={quantity}
              onChange={e => setQuantity(Number(e.target.value))}
            />
          </Field>
          <Field label="Informações adicionais">
            <Textarea value={info} onChange={e => setInfo(e.target.value)} />
          </Field>
          <Button
            disabled={!name.trim() || !vaccineId || busy}
            onClick={() =>
              save({
                vaccineId,
                partnerId: partnerId || null,
                name: name.trim(),
                campaignAt: new Date(at).toISOString(),
                location: location || undefined,
                audienceText: audience || undefined,
                estimatedQuantity: quantity || null,
                additionalInfo: info || undefined,
              })
            }
          >
            Criar campanha
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VaccinationDialog({
  open,
  close,
  patientId,
  vaccines,
  save,
  busy,
}: {
  open: boolean;
  close: () => void;
  patientId: number | null;
  vaccines: any[];
  save: (p: any) => void;
  busy: boolean;
}) {
  const [vaccineId, setVaccineId] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dose, setDose] = useState(1);
  const [lot, setLot] = useState("");
  const [next, setNext] = useState("");
  return (
    <Dialog open={open} onOpenChange={v => !v && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar vacinação</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Vacina">
            <select
              className="w-full border bg-white p-2 text-sm"
              value={vaccineId}
              onChange={e => setVaccineId(Number(e.target.value))}
            >
              <option value={0}>Selecione</option>
              {vaccines.map(row => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">
              <Input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </Field>
            <Field label="Dose">
              <Input
                type="number"
                min={1}
                value={dose}
                onChange={e => setDose(Number(e.target.value))}
              />
            </Field>
          </div>
          <Field label="Lote">
            <Input value={lot} onChange={e => setLot(e.target.value)} />
          </Field>
          <Field label="Próxima dose">
            <Input
              type="date"
              value={next}
              onChange={e => setNext(e.target.value)}
            />
          </Field>
          <Button
            disabled={!patientId || !vaccineId || busy}
            onClick={() =>
              patientId &&
              save({
                collaboratorId: patientId,
                vaccineId,
                vaccinationDate: date,
                doseNumber: dose,
                lot: lot || undefined,
                nextDoseDate: next || null,
              })
            }
          >
            Registrar dose
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
