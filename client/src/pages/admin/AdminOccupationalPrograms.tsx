import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  Download,
  History,
  FileUp,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearch } from "wouter";
import { toast } from "sonner";

const pcdStatusLabels: Record<string, string> = {
  pendente: "Pendente",
  em_analise: "Em análise",
  validado: "Validado",
  nao_validado: "Não validado",
  necessita_complementacao: "Necessita complementação",
};

const pcaStatusLabels: Record<string, string> = {
  triagem_pendente: "Triagem pendente",
  convocacao_pendente: "Convocação pendente",
  avaliacao_medica: "Avaliação médica",
  encaminhado: "Encaminhado",
  repeticao_pendente: "Repetição pendente",
  acompanhamento: "Em acompanhamento",
  concluido: "Concluído",
};

const badgeClass = (status: string) => {
  if (["validado", "concluido"].includes(status))
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (["nao_validado"].includes(status))
    return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
};

const emptyPcd = {
  id: undefined as number | undefined,
  collaboratorId: 0,
  declaredType: "pcd",
  disabilityType: "",
  description: "",
  status: "pendente",
  validationConclusion: "",
  complementaryAssessment: "",
  quotaEligible: false,
  nextReviewDate: "",
};

export default function AdminOccupationalPrograms({
  mode = "pcd",
}: {
  mode?: "pcd" | "pca";
}) {
  const api = (trpc as any).useUtils();
  const tab = mode;
  const locationSearch = useSearch();
  const contextualCollaboratorId = Number(
    new URLSearchParams(locationSearch).get("collaboratorId") || 0
  );
  const [contextApplied, setContextApplied] = useState(false);
  const [search, setSearch] = useState("");
  const [pcdForm, setPcdForm] = useState<any>(emptyPcd);
  const [selectedPca, setSelectedPca] = useState<any>(null);
  const [actionText, setActionText] = useState("");
  const [actionType, setActionType] = useState("convocacao");

  const dashboardQ = (trpc as any).occupationalPrograms.dashboard.useQuery();
  const workersQ = (trpc as any).occupationalPrograms.listWorkers.useQuery({
    search: search || undefined,
  });
  const pcdQ = (trpc as any).occupationalPrograms.listPcdCases.useQuery();
  const pcaQ = (trpc as any).occupationalPrograms.listPcaCases.useQuery();
  const reportsQ = (trpc as any).occupationalPrograms.programReports.useQuery();
  const documentsQ = (
    trpc as any
  ).occupationalPrograms.listPcdDocuments.useQuery(
    { caseId: Number(pcdForm.id || 0) },
    { enabled: Boolean(pcdForm.id) }
  );
  const auditQ = (trpc as any).occupationalPrograms.listPcdAudit.useQuery(
    { caseId: Number(pcdForm.id || 0) },
    { enabled: Boolean(pcdForm.id) }
  );

  const refresh = async () => {
    await Promise.all([
      api.occupationalPrograms.dashboard.invalidate(),
      api.occupationalPrograms.listPcdCases.invalidate(),
      api.occupationalPrograms.listPcaCases.invalidate(),
      api.occupationalPrograms.programReports.invalidate(),
    ]);
  };

  const savePcd = (trpc as any).occupationalPrograms.upsertPcdCase.useMutation({
    onSuccess: async (result: any) => {
      toast.success("Análise PCD salva com rastreabilidade.");
      setPcdForm((current: any) => ({ ...current, id: result.id }));
      await refresh();
    },
    onError: (error: any) => toast.error(error.message),
  });

  const uploadDocument = (
    trpc as any
  ).occupationalPrograms.uploadPcdDocument.useMutation({
    onSuccess: async () => {
      toast.success("Documento armazenado no dossiê de validação.");
      await documentsQ.refetch();
      await refresh();
    },
    onError: (error: any) => toast.error(error.message),
  });

  const syncPca = (
    trpc as any
  ).occupationalPrograms.syncPcaCandidates.useMutation({
    onSuccess: async (result: any) => {
      toast.success(
        result.inserted
          ? `${result.inserted} resultado(s) encaminhado(s) para triagem.`
          : "Nenhum novo resultado audiométrico exige triagem."
      );
      await refresh();
    },
    onError: (error: any) => toast.error(error.message),
  });

  const updatePca = (
    trpc as any
  ).occupationalPrograms.updatePcaCase.useMutation({
    onSuccess: async () => {
      toast.success("Acompanhamento do PCA atualizado.");
      await refresh();
    },
    onError: (error: any) => toast.error(error.message),
  });

  const addAction = (trpc as any).occupationalPrograms.addPcaAction.useMutation(
    {
      onSuccess: async () => {
        toast.success("Ação registrada no histórico do PCA.");
        setActionText("");
        await refresh();
      },
      onError: (error: any) => toast.error(error.message),
    }
  );

  const workers = (workersQ.data || []) as any[];
  const pcdCases = (pcdQ.data || []) as any[];
  const pcaCases = (pcaQ.data || []) as any[];
  const dashboard = dashboardQ.data as any;

  const selectedWorker = useMemo(
    () =>
      workers.find(row => Number(row.id) === Number(pcdForm.collaboratorId)),
    [workers, pcdForm.collaboratorId]
  );

  const startEditPcd = (row: any) => {
    setPcdForm({
      id: Number(row.id),
      collaboratorId: Number(row.collaborator_id),
      declaredType: row.declared_type || "pcd",
      disabilityType: row.disability_type || "",
      description: row.description || "",
      status: row.status || "pendente",
      validationConclusion: row.validation_conclusion || "",
      complementaryAssessment: row.complementary_assessment || "",
      quotaEligible: Boolean(row.quota_eligible),
      nextReviewDate: row.next_review_date
        ? String(row.next_review_date).slice(0, 10)
        : "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    if (tab !== "pcd" || contextApplied || !contextualCollaboratorId || pcdQ.isLoading) return;
    const existing = pcdCases.find(
      row => Number(row.collaborator_id) === contextualCollaboratorId
    );
    if (existing) startEditPcd(existing);
    else setPcdForm((current: any) => ({ ...current, collaboratorId: contextualCollaboratorId }));
    setContextApplied(true);
  }, [contextApplied, contextualCollaboratorId, pcdCases, pcdQ.isLoading, tab]);

  const handleFile = (file?: File) => {
    if (!file || !pcdForm.id) return;
    const reader = new FileReader();
    reader.onload = () =>
      uploadDocument.mutate({
        caseId: Number(pcdForm.id),
        documentType: "Laudo ou documento comprobatório",
        documentStatus: "pendente",
        fileName: file.name,
        fileBase64: String(reader.result || ""),
      });
    reader.readAsDataURL(file);
  };

  const submitPcd = () => {
    if (!pcdForm.collaboratorId) {
      toast.error("Selecione o colaborador.");
      return;
    }
    savePcd.mutate({
      ...pcdForm,
      collaboratorId: Number(pcdForm.collaboratorId),
      nextReviewDate: pcdForm.nextReviewDate || null,
    });
  };

  const saveSelectedPca = () => {
    if (!selectedPca) return;
    updatePca.mutate({
      id: Number(selectedPca.id),
      status: selectedPca.status,
      findingSummary: selectedPca.finding_summary || "",
      comparisonSummary: selectedPca.comparison_summary || "",
      repeatExamRequired: Boolean(selectedPca.repeat_exam_required),
      entReferralRequired: Boolean(selectedPca.ent_referral_required),
      occupationalNexusReview:
        selectedPca.occupational_nexus_review || "nao_avaliado",
      catReviewStatus: selectedPca.cat_review_status || "nao_avaliado",
      medicalConclusion: selectedPca.medical_conclusion || "",
      nextAction: selectedPca.next_action || "",
      dueDate: selectedPca.due_date
        ? String(selectedPca.due_date).slice(0, 10)
        : null,
    });
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1500px] space-y-5 p-4 md:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {tab === "pcd"
                ? "Gestão de PCD"
                : "Programa de Conservação Auditiva"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {tab === "pcd"
                ? "Análise documental, validação, cota, dossiê e indicadores de pessoas com deficiência."
                : "Triagem audiométrica, convocações, encaminhamentos e acompanhamento do PCA."}
            </p>
          </div>
          <Button variant="outline" onClick={refresh} className="gap-2">
            <RefreshCw size={16} /> Atualizar
          </Button>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(tab === "pcd"
            ? [
                ["PCD declarados", dashboard?.pcd?.declared ?? 0],
                ["PCD validados", dashboard?.pcd?.validated ?? 0],
                ["Análises pendentes", dashboard?.pcd?.pending ?? 0],
                ["Lacuna estimada da cota", dashboard?.pcd?.estimatedGap ?? 0],
              ]
            : [
                ["Casos PCA", dashboard?.pca?.total ?? 0],
                ["Casos em aberto", dashboard?.pca?.openCases ?? 0],
                ["Repetições pendentes", dashboard?.pca?.repeats ?? 0],
                ["Expostos a ruído", dashboard?.pca?.exposedWorkers ?? 0],
              ]
          ).map(([label, value]) => (
            <div key={String(label)} className="rounded-md border bg-white p-4">
              <div className="text-xs font-medium uppercase text-slate-500">
                {label}
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">
                {String(value)}
              </div>
            </div>
          ))}
        </section>

        {tab === "pcd" ? (
          <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
            <section className="space-y-4 rounded-md border bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Análise documental</h2>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPcdForm(emptyPcd)}
                  className="gap-1"
                >
                  <Plus size={15} /> Nova
                </Button>
              </div>
              <div>
                <Label>Buscar colaborador</Label>
                <div className="relative mt-1">
                  <Search
                    className="absolute left-3 top-2.5 text-slate-400"
                    size={16}
                  />
                  <Input
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    className="pl-9"
                    placeholder="Nome, CPF ou matrícula"
                  />
                </div>
              </div>
              <div>
                <Label>Colaborador</Label>
                <select
                  value={pcdForm.collaboratorId}
                  onChange={event =>
                    setPcdForm({
                      ...pcdForm,
                      collaboratorId: Number(event.target.value),
                    })
                  }
                  className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm"
                >
                  <option value={0}>Selecione</option>
                  {workers.map(row => (
                    <option key={row.id} value={row.id}>
                      {row.name} {row.cpf ? `- ${row.cpf}` : ""}
                    </option>
                  ))}
                </select>
                {selectedWorker && (
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedWorker.position || "Sem cargo"} ·{" "}
                    {selectedWorker.branch_name || "Sem filial"}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo</Label>
                  <select
                    value={pcdForm.declaredType}
                    onChange={event =>
                      setPcdForm({
                        ...pcdForm,
                        declaredType: event.target.value,
                      })
                    }
                    className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm"
                  >
                    <option value="pcd">PCD declarada</option>
                    <option value="reabilitado_inss">Reabilitado INSS</option>
                  </select>
                </div>
                <div>
                  <Label>Status</Label>
                  <select
                    value={pcdForm.status}
                    onChange={event =>
                      setPcdForm({ ...pcdForm, status: event.target.value })
                    }
                    className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm"
                  >
                    {Object.entries(pcdStatusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <Label>Tipo de deficiência</Label>
                <Input
                  value={pcdForm.disabilityType}
                  onChange={event =>
                    setPcdForm({
                      ...pcdForm,
                      disabilityType: event.target.value,
                    })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Documentação e contexto</Label>
                <Textarea
                  value={pcdForm.description}
                  onChange={event =>
                    setPcdForm({ ...pcdForm, description: event.target.value })
                  }
                  className="mt-1 min-h-20"
                />
              </div>
              <div>
                <Label>Conclusão da análise</Label>
                <Textarea
                  value={pcdForm.validationConclusion}
                  onChange={event =>
                    setPcdForm({
                      ...pcdForm,
                      validationConclusion: event.target.value,
                    })
                  }
                  className="mt-1 min-h-20"
                />
              </div>
              <div>
                <Label>Avaliação complementar necessária</Label>
                <Textarea
                  value={pcdForm.complementaryAssessment}
                  onChange={event =>
                    setPcdForm({
                      ...pcdForm,
                      complementaryAssessment: event.target.value,
                    })
                  }
                  className="mt-1 min-h-16"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="quotaEligible"
                  type="checkbox"
                  checked={pcdForm.quotaEligible}
                  onChange={event =>
                    setPcdForm({
                      ...pcdForm,
                      quotaEligible: event.target.checked,
                    })
                  }
                />
                <Label htmlFor="quotaEligible">
                  Considerar na cota após validação
                </Label>
              </div>
              <div>
                <Label>Próxima revisão</Label>
                <Input
                  type="date"
                  value={pcdForm.nextReviewDate}
                  onChange={event =>
                    setPcdForm({
                      ...pcdForm,
                      nextReviewDate: event.target.value,
                    })
                  }
                  className="mt-1"
                />
              </div>
              <Button
                onClick={submitPcd}
                disabled={savePcd.isPending}
                className="w-full gap-2"
              >
                {savePcd.isPending ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Save size={16} />
                )}
                Salvar análise
              </Button>
              {pcdForm.id && (
                <div className="border-t pt-4">
                  <Label htmlFor="pcd-file" className="mb-2 block">
                    Adicionar documento
                  </Label>
                  <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed text-sm text-slate-600 hover:bg-slate-50">
                    <FileUp size={16} /> Selecionar arquivo
                    <input
                      id="pcd-file"
                      type="file"
                      className="hidden"
                      onChange={event => handleFile(event.target.files?.[0])}
                    />
                  </label>
                  <div className="mt-3 space-y-2">
                    {((documentsQ.data || []) as any[]).map(row => (
                      <PcdDocumentRow
                        key={row.id}
                        row={row}
                        onSaved={async () => {
                          await Promise.all([documentsQ.refetch(), auditQ.refetch(), refresh()]);
                        }}
                      />
                    ))}
                  </div>
                  <div className="mt-4 border-t pt-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <History size={15} /> Histórico da avaliação
                    </div>
                    <div className="max-h-48 space-y-2 overflow-y-auto">
                      {((auditQ.data || []) as any[]).map(row => (
                        <div key={row.id} className="border-l-2 border-slate-300 pl-3 text-xs">
                          <div className="font-medium text-slate-700">
                            {row.action === "pcd_case_created"
                              ? "Avaliação criada"
                              : "Avaliação atualizada"}
                          </div>
                          <div className="text-slate-500">
                            {row.actor_name || "Usuário da plataforma"} ·{" "}
                            {new Date(row.created_at).toLocaleString("pt-BR")}
                          </div>
                          <div className="mt-1 text-slate-600">
                            {auditChangeSummary(row)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-md border bg-white">
              <div className="border-b p-4">
                <h2 className="font-semibold">Validações da empresa</h2>
                <p className="text-sm text-slate-500">
                  Declarados, auditados e efetivamente validados permanecem
                  separados.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="p-3">Colaborador</th>
                      <th className="p-3">Filial / setor</th>
                      <th className="p-3">Deficiência</th>
                      <th className="p-3">Documentos</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pcdCases.map(row => (
                      <tr
                        key={row.id}
                        onClick={() => startEditPcd(row)}
                        className="cursor-pointer border-t hover:bg-slate-50"
                      >
                        <td className="p-3">
                          <div className="font-medium">
                            {row.collaborator_name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {row.cpf ||
                              row.employee_registration ||
                              "Sem identificador"}
                          </div>
                        </td>
                        <td className="p-3 text-slate-600">
                          {row.branch_name || "-"} / {row.sector_name || "-"}
                        </td>
                        <td className="p-3">
                          {row.disability_type || "Em análise"}
                        </td>
                        <td className="p-3">{row.documents_count || 0}</td>
                        <td className="p-3">
                          <span
                            className={`rounded border px-2 py-1 text-xs ${badgeClass(row.status)}`}
                          >
                            {pcdStatusLabels[row.status] || row.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={event => {
                              event.stopPropagation();
                              startEditPcd(row);
                            }}
                          >
                            <Pencil size={14} /> Editar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-5">
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-white p-5">
              <div>
                <h2 className="font-semibold">
                  Programa de Conservação Auditiva
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Resultados alterados entram em triagem. O sistema não
                  diagnostica PAIR e não abre CAT automaticamente.
                </p>
              </div>
              <Button
                onClick={() => syncPca.mutate()}
                disabled={syncPca.isPending}
                className="gap-2"
              >
                {syncPca.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Activity size={16} />
                )}
                Sincronizar audiometrias
              </Button>
            </section>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
              <section className="overflow-hidden rounded-md border bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="p-3">Colaborador</th>
                        <th className="p-3">GSE</th>
                        <th className="p-3">Audiometria</th>
                        <th className="p-3">Pendências</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pcaCases.map(row => (
                        <tr
                          key={row.id}
                          onClick={() => setSelectedPca({ ...row })}
                          className="cursor-pointer border-t hover:bg-slate-50"
                        >
                          <td className="p-3">
                            <div className="font-medium">
                              {row.collaborator_name}
                            </div>
                            <div className="text-xs text-slate-500">
                              {row.position || "Sem cargo"}
                            </div>
                          </td>
                          <td className="p-3">
                            {row.gse_code || row.gse_name || "Não vinculado"}
                          </td>
                          <td className="p-3">
                            <div>{row.exam_name || "Audiometria"}</div>
                            <div className="text-xs text-slate-500">
                              {row.result_classification ||
                                "Pendente de revisão"}
                            </div>
                          </td>
                          <td className="p-3">{row.pending_actions || 0}</td>
                          <td className="p-3">
                            <span
                              className={`rounded border px-2 py-1 text-xs ${badgeClass(row.status)}`}
                            >
                              {pcaStatusLabels[row.status] || row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-md border bg-white p-5">
                {!selectedPca ? (
                  <div className="py-16 text-center text-sm text-slate-500">
                    Selecione um trabalhador para registrar a avaliação e a
                    próxima ação.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <h2 className="font-semibold">
                        {selectedPca.collaborator_name}
                      </h2>
                      <p className="text-sm text-slate-500">
                        {selectedPca.exam_name || "Audiometria"} ·{" "}
                        {selectedPca.gse_name || "Sem GSE"}
                      </p>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <select
                        value={selectedPca.status}
                        onChange={event =>
                          setSelectedPca({
                            ...selectedPca,
                            status: event.target.value,
                          })
                        }
                        className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm"
                      >
                        {Object.entries(pcaStatusLabels).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                    <div>
                      <Label>Achado e comparação</Label>
                      <Textarea
                        value={selectedPca.finding_summary || ""}
                        onChange={event =>
                          setSelectedPca({
                            ...selectedPca,
                            finding_summary: event.target.value,
                          })
                        }
                        className="mt-1 min-h-20"
                      />
                    </div>
                    <div>
                      <Label>Conclusão médica</Label>
                      <Textarea
                        value={selectedPca.medical_conclusion || ""}
                        onChange={event =>
                          setSelectedPca({
                            ...selectedPca,
                            medical_conclusion: event.target.value,
                          })
                        }
                        className="mt-1 min-h-20"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <label className="flex items-center gap-2 rounded border p-3">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedPca.repeat_exam_required)}
                          onChange={event =>
                            setSelectedPca({
                              ...selectedPca,
                              repeat_exam_required: event.target.checked,
                            })
                          }
                        />
                        Repetir exame
                      </label>
                      <label className="flex items-center gap-2 rounded border p-3">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedPca.ent_referral_required)}
                          onChange={event =>
                            setSelectedPca({
                              ...selectedPca,
                              ent_referral_required: event.target.checked,
                            })
                          }
                        />
                        Otorrino
                      </label>
                    </div>
                    <div>
                      <Label>Investigação de nexo</Label>
                      <select
                        value={
                          selectedPca.occupational_nexus_review ||
                          "nao_avaliado"
                        }
                        onChange={event =>
                          setSelectedPca({
                            ...selectedPca,
                            occupational_nexus_review: event.target.value,
                          })
                        }
                        className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm"
                      >
                        <option value="nao_avaliado">Não avaliado</option>
                        <option value="investigar">Investigar</option>
                        <option value="descartado">Descartado</option>
                        <option value="confirmado_pelo_medico">
                          Confirmado pelo médico
                        </option>
                      </select>
                    </div>
                    <div>
                      <Label>Avaliação de CAT</Label>
                      <select
                        value={selectedPca.cat_review_status || "nao_avaliado"}
                        onChange={event =>
                          setSelectedPca({
                            ...selectedPca,
                            cat_review_status: event.target.value,
                          })
                        }
                        className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm"
                      >
                        <option value="nao_avaliado">Não avaliada</option>
                        <option value="avaliar">Avaliar tecnicamente</option>
                        <option value="nao_indicada">Não indicada</option>
                        <option value="indicada_pelo_medico">
                          Indicada pelo médico
                        </option>
                      </select>
                    </div>
                    <Button
                      onClick={saveSelectedPca}
                      disabled={updatePca.isPending}
                      className="w-full gap-2"
                    >
                      <Save size={16} /> Salvar acompanhamento
                    </Button>
                    <div className="border-t pt-4">
                      <Label>Nova ação</Label>
                      <select
                        value={actionType}
                        onChange={event => setActionType(event.target.value)}
                        className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm"
                      >
                        <option value="convocacao">Convocação</option>
                        <option value="avaliacao_medica">
                          Avaliação médica
                        </option>
                        <option value="encaminhamento_otorrino">
                          Encaminhamento ao otorrino
                        </option>
                        <option value="repeticao_audiometria">
                          Repetição de audiometria
                        </option>
                        <option value="acompanhamento">Acompanhamento</option>
                        <option value="outro">Outra ação</option>
                      </select>
                      <Textarea
                        value={actionText}
                        onChange={event => setActionText(event.target.value)}
                        className="mt-2 min-h-20"
                        placeholder="Descreva a providência, responsável e prazo."
                      />
                      <Button
                        variant="outline"
                        className="mt-2 w-full gap-2"
                        disabled={!actionText.trim() || addAction.isPending}
                        onClick={() =>
                          addAction.mutate({
                            caseId: Number(selectedPca.id),
                            actionType,
                            description: actionText,
                            scheduledFor: null,
                          })
                        }
                      >
                        <Plus size={16} /> Registrar ação
                      </Button>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        <ProgramReportSection mode={tab} data={(reportsQ.data as any)?.[tab]} />
      </div>
    </AppLayout>
  );
}

function auditChangeSummary(row: any) {
  try {
    const before = row.before_json ? JSON.parse(row.before_json) : null;
    const after = row.after_json ? JSON.parse(row.after_json) : null;
    if (!before) return row.action.includes("document") ? "Documento adicionado à avaliação." : "Registro inicial criado.";
    const changes: string[] = [];
    const pairs = [
      ["status", "Status"],
      ["documentStatus", "Situação do documento"],
      ["disabilityType", "Tipo de deficiência"],
      ["quotaEligible", "Cota"],
      ["nextReviewDate", "Próxima revisão"],
    ];
    for (const [key, label] of pairs) {
      const previous = before[key] ?? before[String(key).replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)];
      const current = after?.[key];
      if (current !== undefined && String(previous ?? "") !== String(current ?? ""))
        changes.push(`${label}: ${String(previous ?? "não informado").replace(/_/g, " ")} → ${String(current ?? "não informado").replace(/_/g, " ")}`);
    }
    return changes.length ? changes.join(" · ") : "Conteúdo e observações atualizados.";
  } catch {
    return "Alteração registrada com rastreabilidade.";
  }
}

function PcdDocumentRow({ row, onSaved }: { row: any; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    documentType: row.document_type || "Laudo ou documento comprobatório",
    documentDate: row.document_date ? String(row.document_date).slice(0, 10) : "",
    professionalName: row.professional_name || "",
    professionalRegistration: row.professional_registration || "",
    documentStatus: row.document_status || "pendente",
    notes: row.notes || "",
  });
  const update = (trpc as any).occupationalPrograms.updatePcdDocument.useMutation({
    onSuccess: () => {
      toast.success("Documento atualizado com rastreabilidade.");
      setEditing(false);
      onSaved();
    },
    onError: (error: any) => toast.error(error.message),
  });
  if (!editing) return (
    <div className="rounded border px-3 py-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-700">{row.file_name}</div>
          <div className="text-slate-500">{String(row.document_status).replace(/_/g, " ")} · {row.uploaded_by_name}</div>
          {row.notes && <div className="mt-1 text-slate-600">{row.notes}</div>}
        </div>
        <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => setEditing(true)}>
          <Pencil size={12} /> Editar
        </Button>
      </div>
    </div>
  );
  return (
    <div className="space-y-2 rounded border bg-slate-50 p-3 text-xs">
      <Input value={form.documentType} onChange={event => setForm({...form, documentType:event.target.value})} placeholder="Tipo de documento" />
      <div className="grid grid-cols-2 gap-2">
        <Input type="date" value={form.documentDate} onChange={event => setForm({...form, documentDate:event.target.value})} />
        <select className="rounded-md border bg-white px-2" value={form.documentStatus} onChange={event => setForm({...form, documentStatus:event.target.value})}>
          <option value="pendente">Pendente</option><option value="aprovado">Aprovado</option><option value="nao_validado">Não validado</option>
        </select>
      </div>
      <Input value={form.professionalName} onChange={event => setForm({...form, professionalName:event.target.value})} placeholder="Profissional responsável" />
      <Input value={form.professionalRegistration} onChange={event => setForm({...form, professionalRegistration:event.target.value})} placeholder="Registro profissional" />
      <Textarea value={form.notes} onChange={event => setForm({...form, notes:event.target.value})} placeholder="Observações sobre a análise documental" />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
        <Button size="sm" disabled={update.isPending || !form.documentType.trim()} onClick={() => update.mutate({id:Number(row.id),...form,documentDate:form.documentDate||null})}>Salvar documento</Button>
      </div>
    </div>
  );
}

function ProgramReportSection({ mode, data }: { mode: "pcd" | "pca"; data: any }) {
  const groups = mode === "pcd"
    ? [
        ["Situação da avaliação", data?.byStatus || []],
        ["Tipo de deficiência", data?.byDisability || []],
        ["Distribuição por filial", data?.byBranch || []],
        ["Distribuição por setor", data?.bySector || []],
        ["Distribuição por cargo", data?.byPosition || []],
      ]
    : [
        ["Situação do acompanhamento", data?.byStatus || []],
        ["Distribuição por filial", data?.byBranch || []],
        ["Distribuição por setor", data?.bySector || []],
        ["Distribuição por GSE", data?.byGse || []],
      ];

  const exportCsv = () => {
    const rows = [["Indicador", "Categoria", "Quantidade"]];
    groups.forEach(([title, values]: any) =>
      values.forEach((row: any) => rows.push([title, row.label, String(row.total)]))
    );
    const csv = rows
      .map(row => row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio_${mode}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="border-t pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Indicadores e relatório {mode === "pcd" ? "de PCD" : "do PCA"}
          </h2>
          <p className="text-sm text-slate-500">
            Consolidação própria do programa, sem misturar as duas metodologias.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={exportCsv}>
          <Download size={15} /> Exportar relatório
        </Button>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map(([title, values]: any) => (
          <div key={title} className="border bg-white">
            <h3 className="border-b px-4 py-3 text-sm font-semibold">{title}</h3>
            <div className="divide-y">
              {values.map((row: any) => (
                <div key={`${title}-${row.label}`} className="flex justify-between gap-3 px-4 py-2 text-sm">
                  <span className="text-slate-600">{String(row.label || "Não informado").replace(/_/g, " ")}</span>
                  <b>{row.total}</b>
                </div>
              ))}
              {!values.length && <p className="px-4 py-5 text-sm text-slate-500">Sem dados consolidados.</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
