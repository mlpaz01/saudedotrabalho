import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  Accessibility,
  Activity,
  FileUp,
  Ear,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
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

export default function AdminOccupationalPrograms() {
  const api = (trpc as any).useUtils();
  const [tab, setTab] = useState<"pcd" | "pca">("pcd");
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
  const documentsQ = (
    trpc as any
  ).occupationalPrograms.listPcdDocuments.useQuery(
    { caseId: Number(pcdForm.id || 0) },
    { enabled: Boolean(pcdForm.id) }
  );

  const refresh = async () => {
    await Promise.all([
      api.occupationalPrograms.dashboard.invalidate(),
      api.occupationalPrograms.listPcdCases.invalidate(),
      api.occupationalPrograms.listPcaCases.invalidate(),
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
              Programas Ocupacionais
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Validação documental de PCD e acompanhamento operacional do PCA.
            </p>
          </div>
          <Button variant="outline" onClick={refresh} className="gap-2">
            <RefreshCw size={16} /> Atualizar
          </Button>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["PCD declarados", dashboard?.pcd?.declared ?? 0],
            ["PCD validados", dashboard?.pcd?.validated ?? 0],
            ["Casos PCA em aberto", dashboard?.pca?.openCases ?? 0],
            ["Expostos a ruído", dashboard?.pca?.exposedWorkers ?? 0],
          ].map(([label, value]) => (
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

        <div className="flex gap-1 border-b">
          <button
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium ${tab === "pcd" ? "border-cyan-700 text-cyan-800" : "border-transparent text-slate-500"}`}
            onClick={() => setTab("pcd")}
          >
            <Accessibility size={17} /> Gestão de PCD
          </button>
          <button
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium ${tab === "pca" ? "border-cyan-700 text-cyan-800" : "border-transparent text-slate-500"}`}
            onClick={() => setTab("pca")}
          >
            <Ear size={17} /> PCA
          </button>
        </div>

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
                      <div
                        key={row.id}
                        className="rounded border px-3 py-2 text-xs"
                      >
                        <div className="font-medium text-slate-700">
                          {row.file_name}
                        </div>
                        <div className="text-slate-500">
                          {row.document_status} · {row.uploaded_by_name}
                        </div>
                      </div>
                    ))}
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
      </div>
    </AppLayout>
  );
}
