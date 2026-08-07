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
  Archive,
  CheckCircle2,
  Download,
  FileCheck2,
  FileSearch,
  FileText,
  Link2,
  Paperclip,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

type DocumentType = "ltcat" | "insalubridade" | "periculosidade";

const TYPES: Array<{ id: DocumentType; label: string; short: string }> = [
  { id: "ltcat", label: "LTCAT", short: "Condições ambientais" },
  { id: "insalubridade", label: "Insalubridade", short: "NR-15" },
  { id: "periculosidade", label: "Periculosidade", short: "NR-16" },
];

function downloadData(dataBase64: string, fileName: string) {
  const anchor = document.createElement("a");
  anchor.href = dataBase64;
  anchor.download = fileName;
  anchor.click();
}

function statusLabel(status?: string) {
  return (
    {
      rascunho: "Rascunho",
      em_revisao: "Em revisão",
      vigente: "Vigente",
      arquivado: "Arquivado",
    }[status || ""] || status || "Não informado"
  );
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="font-semibold text-slate-950">{title}</h2>
          {description ? (
            <p className="mt-1 max-w-4xl text-xs text-slate-500">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-h-20 border bg-slate-50 p-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-bold text-slate-950">{value}</div>
    </div>
  );
}

export default function TechnicalDocuments() {
  const utils = trpc.useUtils();
  const [type, setType] = useState<DocumentType>("ltcat");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDraft, setDialogDraft] = useState<any>(null);
  const [pgrId, setPgrId] = useState(0);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [shareRole, setShareRole] = useState<"medico" | "rh" | "company_admin">(
    "medico"
  );

  const summaryQ = trpc.technicalDocuments.summary.useQuery();
  const pgrsQ = trpc.technicalDocuments.listPgrs.useQuery();
  const sharedPcmsoQ = trpc.medical.listSharedPcmso.useQuery();
  const listQ = trpc.technicalDocuments.list.useQuery({ type });
  const detailQ = trpc.technicalDocuments.get.useQuery(
    { id: selectedId || 0 },
    { enabled: Boolean(selectedId) }
  );

  useEffect(() => {
    const rows = (listQ.data || []) as any[];
    if (!rows.length) {
      setSelectedId(null);
      return;
    }
    if (!rows.some(row => Number(row.id) === selectedId)) {
      setSelectedId(Number(rows[0].id));
    }
  }, [listQ.data, selectedId]);

  const refresh = () => {
    summaryQ.refetch();
    listQ.refetch();
    if (selectedId) detailQ.refetch();
  };

  const upsert = trpc.technicalDocuments.upsert.useMutation({
    onSuccess: result => {
      setSelectedId(result.id);
      setDialogOpen(false);
      refresh();
      toast.success("Documento técnico salvo.");
    },
    onError: error => toast.error(error.message),
  });
  const importPgr = trpc.technicalDocuments.importPgr.useMutation({
    onSuccess: result => {
      refresh();
      toast.success(`${result.imported} risco(s) importado(s) do PGR.`);
    },
    onError: error => toast.error(error.message),
  });
  const generateAi = trpc.technicalDocuments.generateWithAi.useMutation({
    onSuccess: result => {
      refresh();
      toast.success(
        result.usedAi
          ? "Estrutura preparada pela IA para revisão técnica."
          : "Estrutura segura preparada sem o provedor externo de IA."
      );
    },
    onError: error => toast.error(error.message),
  });
  const decideRisk = trpc.technicalDocuments.decideRisk.useMutation({
    onSuccess: () => {
      detailQ.refetch();
      toast.success("Decisão técnica registrada.");
    },
    onError: error => toast.error(error.message),
  });
  const audit = trpc.technicalDocuments.audit.useMutation({
    onSuccess: result => {
      refresh();
      toast.success(`Auditoria concluída: ${result.score}%.`);
    },
    onError: error => toast.error(error.message),
  });
  const sign = trpc.technicalDocuments.sign.useMutation({
    onSuccess: () => {
      refresh();
      toast.success("Documento assinado e publicado como vigente.");
    },
    onError: error => toast.error(error.message),
  });
  const archive = trpc.technicalDocuments.archive.useMutation({
    onSuccess: () => {
      refresh();
      toast.success("Documento arquivado com histórico preservado.");
    },
    onError: error => toast.error(error.message),
  });
  const generatePdf = trpc.technicalDocuments.generatePdf.useMutation({
    onSuccess: result => {
      downloadData(result.dataBase64, result.fileName);
      refresh();
      toast.success(`PDF versão ${result.version} gerado e arquivado.`);
    },
    onError: error => toast.error(error.message),
  });
  const addAttachment = trpc.technicalDocuments.addAttachment.useMutation({
    onSuccess: () => {
      setAttachmentOpen(false);
      detailQ.refetch();
      toast.success("Evidência arquivada.");
    },
    onError: error => toast.error(error.message),
  });
  const share = trpc.technicalDocuments.share.useMutation({
    onSuccess: () => {
      detailQ.refetch();
      toast.success("Compartilhamento controlado registrado.");
    },
    onError: error => toast.error(error.message),
  });

  async function download(kind: "attachment" | "version", id: number) {
    try {
      const result = await utils.client.technicalDocuments.download.query({
        kind,
        id,
      });
      downloadData(result.dataBase64, result.fileName);
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível baixar o arquivo.");
    }
  }

  async function downloadPcmso(id: number) {
    try {
      const result = await utils.client.medical.downloadPrivate.query({
        kind: "pcmso_version",
        id,
      });
      downloadData(result.dataBase64, result.fileName);
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível baixar o PCMSO.");
    }
  }

  const summary = (summaryQ.data || {}) as any;
  const rows = (listQ.data || []) as any[];
  const detail = detailQ.data as any;
  const document = detail?.document;
  const risks = (detail?.risks || []) as any[];
  const groups = useMemo(() => {
    const map = new Map<string, any[]>();
    risks.forEach(row => {
      const key = row.gse_name || "GSE não identificado";
      map.set(key, [...(map.get(key) || []), row]);
    });
    return [...map.entries()];
  }, [risks]);
  const latestAudit = detail?.audits?.[0];
  const busy =
    importPgr.isPending ||
    generateAi.isPending ||
    audit.isPending ||
    sign.isPending ||
    archive.isPending ||
    generatePdf.isPending;

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1600px] space-y-4 p-4 md:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-teal-700">
              <FileCheck2 size={15} /> SESMT
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">
              Documentos Técnicos
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              LTCAT, Insalubridade e Periculosidade integrados ao PGR e ao GSE.
            </p>
          </div>
          <Button
            onClick={() => {
              setDialogDraft(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-1" size={15} /> Novo documento
          </Button>
        </header>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
          <Metric label="Total" value={Number(summary.total || 0)} />
          <Metric label="LTCAT" value={Number(summary.ltcat || 0)} />
          <Metric
            label="Insalubridade"
            value={Number(summary.insalubridade || 0)}
          />
          <Metric
            label="Periculosidade"
            value={Number(summary.periculosidade || 0)}
          />
          <Metric label="Vigentes" value={Number(summary.vigente || 0)} />
          <Metric
            label="Revisar PGR"
            value={Number(summary.revisar_pgr || 0)}
          />
          <Metric
            label="Conformidade média"
            value={`${Math.round(Number(summary.conformidade || 0))}%`}
          />
        </div>

        <div className="flex gap-1 overflow-x-auto border-b">
          {TYPES.map(item => (
            <button
              className={`h-10 border-b-2 px-4 text-sm font-medium ${
                type === item.id
                  ? "border-teal-600 text-teal-800"
                  : "border-transparent text-slate-500"
              }`}
              key={item.id}
              onClick={() => setType(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        <Section
          title="Ecossistema documental"
          description="Uma única base conecta PGR, PCMSO e laudos técnicos. O PCMSO permanece sob responsabilidade médica e é apresentado aqui somente para consulta do SESMT."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="PGRs disponíveis" value={(pgrsQ.data || []).length} />
            <Metric
              label="PCMSOs"
              value={(sharedPcmsoQ.data || []).length}
            />
            <Metric label="LTCAT" value={Number(summary.ltcat || 0)} />
            <Metric
              label="Insalubridade"
              value={Number(summary.insalubridade || 0)}
            />
            <Metric
              label="Periculosidade"
              value={Number(summary.periculosidade || 0)}
            />
          </div>
          {(sharedPcmsoQ.data || []).length ? (
            <div className="mt-4 divide-y border">
              {((sharedPcmsoQ.data || []) as any[]).map(row => (
                <div
                  className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm"
                  key={row.id}
                >
                  <div>
                    <b>{row.title}</b>
                    <span className="mt-1 block text-xs text-slate-500">
                      {statusLabel(row.status)} · {row.doctor_name || "Médico não informado"} · versão {Math.max(0, Number(row.current_version || 1) - 1)}
                    </span>
                  </div>
                  {row.latest_version_id ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadPcmso(Number(row.latest_version_id))}
                    >
                      <Download className="mr-1" size={14} /> Consultar PCMSO
                    </Button>
                  ) : (
                    <Badge variant="outline" className="rounded-sm">
                      Sem PDF publicado
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </Section>

        <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
          <aside className="border bg-white">
            <div className="border-b p-3 text-sm font-semibold">
              {TYPES.find(item => item.id === type)?.label}
            </div>
            <div className="max-h-[720px] divide-y overflow-y-auto">
              {rows.map(row => (
                <button
                  className={`w-full p-3 text-left ${
                    Number(row.id) === selectedId
                      ? "bg-teal-50"
                      : "hover:bg-slate-50"
                  }`}
                  key={row.id}
                  onClick={() => setSelectedId(Number(row.id))}
                  type="button"
                >
                  <b className="line-clamp-2 text-sm">{row.title}</b>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span>{statusLabel(row.status)}</span>
                    <span>{Number(row.compliance_score || 0)}%</span>
                  </div>
                  {Number(row.review_required) ? (
                    <span className="mt-2 flex items-center gap-1 text-xs font-medium text-amber-700">
                      <AlertTriangle size={12} /> PGR alterado
                    </span>
                  ) : null}
                </button>
              ))}
              {!rows.length ? (
                <p className="p-5 text-sm text-slate-500">
                  Nenhum documento deste tipo.
                </p>
              ) : null}
            </div>
          </aside>

          <main className="min-w-0 space-y-4">
            {document ? (
              <>
                {Number(document.review_required) ? (
                  <div className="flex gap-3 border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                    <AlertTriangle className="shrink-0" size={18} />
                    <div>
                      <b>O PGR foi atualizado após a última sincronização.</b>
                      <p className="mt-1">
                        Reimporte os riscos e revise as conclusões antes de emitir
                        nova versão.
                      </p>
                    </div>
                  </div>
                ) : null}

                <Section
                  title={document.title}
                  description={`${statusLabel(document.status)} · PGR: ${document.pgr_title || "não selecionado"} · versão ${document.current_version || 1}`}
                  action={
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDialogDraft(document);
                          setDialogOpen(true);
                        }}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAttachmentOpen(true)}
                      >
                        <Paperclip className="mr-1" size={14} /> Anexo
                      </Button>
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => generatePdf.mutate({ id: document.id })}
                      >
                        <Download className="mr-1" size={14} /> PDF
                      </Button>
                    </div>
                  }
                >
                  <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <select
                      className="h-10 border bg-white px-3 text-sm"
                      value={pgrId}
                      onChange={event => setPgrId(Number(event.target.value))}
                    >
                      <option value={0}>Selecione o PGR de referência</option>
                      {((pgrsQ.data || []) as any[]).map(row => (
                        <option key={row.id} value={row.id}>
                          {row.title} · {statusLabel(row.status)}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      disabled={!pgrId || busy}
                      onClick={() =>
                        importPgr.mutate({
                          documentId: document.id,
                          pgrId,
                        })
                      }
                    >
                      <RefreshCw className="mr-1" size={14} /> Importar PGR
                    </Button>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    <Metric label="GSEs" value={groups.length} />
                    <Metric label="Riscos" value={risks.length} />
                    <Metric
                      label="Pendentes"
                      value={risks.filter(row => row.decision_status !== "validado").length}
                    />
                    <Metric
                      label="Conformidade"
                      value={`${Number(document.compliance_score || 0)}%`}
                    />
                  </div>
                </Section>

                <Section
                  title="Assistente técnico"
                  description="A IA estrutura o documento e verifica completude. Não inventa medições e não substitui inspeção, laudo, perícia ou responsabilidade técnica."
                  action={
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => generateAi.mutate({ id: document.id })}
                      >
                        <Sparkles className="mr-1" size={14} /> Gerar estrutura
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => audit.mutate({ id: document.id })}
                      >
                        <FileSearch className="mr-1" size={14} /> Auditar
                      </Button>
                    </div>
                  }
                >
                  {latestAudit ? (
                    <div className="grid gap-3 md:grid-cols-[120px_1fr]">
                      <div className="border bg-slate-50 p-3 text-center">
                        <b className="text-2xl text-teal-800">
                          {latestAudit.score}%
                        </b>
                        <span className="block text-xs text-slate-500">
                          última auditoria
                        </span>
                      </div>
                      <div className="text-sm text-slate-600">
                        {latestAudit.commentary}
                        <p className="mt-2 text-xs font-medium text-amber-800">
                          Resultado assistivo. A assinatura técnica continua sendo
                          decisão humana e rastreável.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Execute a auditoria após revisar os riscos e o texto.
                    </p>
                  )}
                </Section>

                <Section
                  title="Análise técnica por GSE"
                  description="Os dados básicos vêm do PGR. O responsável registra avaliação, evidências e conclusão própria para cada risco."
                >
                  <div className="space-y-5">
                    {groups.map(([gse, groupRisks]) => (
                      <div className="border" key={gse}>
                        <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3">
                          <div>
                            <span className="text-xs font-semibold uppercase text-teal-700">
                              GSE
                            </span>
                            <h3 className="font-semibold">{gse}</h3>
                          </div>
                          <Badge variant="outline" className="rounded-sm">
                            {groupRisks.length} risco(s)
                          </Badge>
                        </div>
                        <div className="divide-y">
                          {groupRisks.map(row => (
                            <TechnicalRiskRow
                              key={row.id}
                              row={row}
                              save={payload => decideRisk.mutate(payload)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                    {!groups.length ? (
                      <p className="border border-dashed p-8 text-center text-sm text-slate-500">
                        Importe o PGR para iniciar a análise por GSE.
                      </p>
                    ) : null}
                  </div>
                </Section>

                <Section
                  title="Compartilhamento controlado"
                  description="O acesso é concedido por perfil dentro da mesma empresa e permanece registrado na trilha de auditoria."
                  action={
                    <div className="flex gap-2">
                      <select
                        className="h-9 border bg-white px-2 text-sm"
                        value={shareRole}
                        onChange={event => setShareRole(event.target.value as any)}
                      >
                        <option value="medico">Médico</option>
                        <option value="rh">RH</option>
                        <option value="company_admin">Administrador da empresa</option>
                      </select>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          share.mutate({
                            documentId: document.id,
                            targetRole: shareRole,
                          })
                        }
                      >
                        <Link2 className="mr-1" size={14} /> Compartilhar
                      </Button>
                    </div>
                  }
                >
                  <div className="divide-y border text-sm">
                    {(detail?.shares || []).map((row: any) => (
                      <div className="flex items-center justify-between p-3" key={row.id}>
                        <span>Perfil: {row.target_role}</span>
                        <span className="text-xs text-slate-500">
                          {new Date(row.created_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                    ))}
                    {!detail?.shares?.length ? (
                      <p className="p-3 text-slate-500">
                        Nenhum compartilhamento adicional.
                      </p>
                    ) : null}
                  </div>
                </Section>

                <Section
                  title="Documentos, versões e assinatura"
                  description="Arquivos privados, PDFs versionados, hash de assinatura e histórico preservado."
                  action={
                    <div className="flex flex-wrap gap-2">
                      {document.status !== "vigente" ? (
                        <Button
                          disabled={busy}
                          onClick={() =>
                            sign.mutate({ id: document.id, confirmation: true })
                          }
                        >
                          <ShieldCheck className="mr-1" size={14} /> Assinar
                        </Button>
                      ) : null}
                      {document.status !== "arquivado" ? (
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => archive.mutate({ id: document.id })}
                        >
                          <Archive className="mr-1" size={14} /> Arquivar
                        </Button>
                      ) : null}
                    </div>
                  }
                >
                  <div className="grid gap-6 md:grid-cols-2">
                    <FileList
                      title="Anexos e evidências"
                      rows={detail?.attachments || []}
                      empty="Nenhum anexo."
                      label={row => row.title || row.file_name}
                      open={row => download("attachment", Number(row.id))}
                    />
                    <FileList
                      title="Versões geradas"
                      rows={detail?.versions || []}
                      empty="Nenhuma versão gerada."
                      label={row =>
                        `Versão ${row.version_number} · ${new Date(row.generated_at).toLocaleString("pt-BR")}`
                      }
                      open={row => download("version", Number(row.id))}
                    />
                  </div>
                </Section>
              </>
            ) : (
              <div className="border border-dashed bg-white p-12 text-center text-sm text-slate-500">
                Selecione ou crie um documento técnico.
              </div>
            )}
          </main>
        </div>
      </div>

      <DocumentDialog
        open={dialogOpen}
        close={() => setDialogOpen(false)}
        initial={dialogDraft}
        initialType={type}
        pgrs={(pgrsQ.data || []) as any[]}
        busy={upsert.isPending}
        save={payload => upsert.mutate(payload)}
      />
      <AttachmentDialog
        open={attachmentOpen}
        close={() => setAttachmentOpen(false)}
        documentId={selectedId}
        busy={addAttachment.isPending}
        save={payload => addAttachment.mutate(payload)}
      />
    </AppLayout>
  );
}

function TechnicalRiskRow({ row, save }: { row: any; save: (p: any) => void }) {
  const [kind, setKind] = useState(row.evaluation_kind || "qualitativa");
  const [methodology, setMethodology] = useState(row.methodology || "");
  const [measurement, setMeasurement] = useState(row.measurement_result || "");
  const [reference, setReference] = useState(row.tolerance_reference || "");
  const [exposure, setExposure] = useState(row.exposure_characterization || "");
  const [controls, setControls] = useState(row.control_assessment || "");
  const [conclusion, setConclusion] = useState(row.technical_conclusion || "");
  return (
    <div className="grid gap-4 p-4 xl:grid-cols-[0.9fr_1fr_1.1fr]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <b className="text-sm">{row.risk_name}</b>
          <Badge variant="outline" className="rounded-sm">
            {row.risk_classification || "Sem classificação"}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {row.risk_type || "-"} · Fonte: {row.source || "-"}
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">
          {row.technical_detail || "Sem detalhamento técnico no PGR."}
        </p>
      </div>
      <div className="grid gap-2">
        <label className="text-xs font-semibold text-slate-700">
          Tipo de avaliação
          <select
            className="mt-1 h-9 w-full border bg-white px-2 text-sm"
            value={kind}
            onChange={event => setKind(event.target.value)}
          >
            <option value="qualitativa">Qualitativa</option>
            <option value="quantitativa">Quantitativa</option>
            <option value="nao_aplicavel">Não aplicável ao escopo</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-700">
          Metodologia
          <Textarea
            className="mt-1 min-h-16"
            value={methodology}
            onChange={event => setMethodology(event.target.value)}
          />
        </label>
        <label className="text-xs font-semibold text-slate-700">
          Medição ou resultado
          <Textarea
            className="mt-1 min-h-16"
            value={measurement}
            onChange={event => setMeasurement(event.target.value)}
            placeholder="Não inventar resultados. Registre somente evidências reais."
          />
        </label>
        <label className="text-xs font-semibold text-slate-700">
          Limite, critério ou referência
          <Textarea
            className="mt-1 min-h-16"
            value={reference}
            onChange={event => setReference(event.target.value)}
          />
        </label>
      </div>
      <div className="grid gap-2">
        <label className="text-xs font-semibold text-slate-700">
          Caracterização da exposição
          <Textarea
            className="mt-1 min-h-16"
            value={exposure}
            onChange={event => setExposure(event.target.value)}
          />
        </label>
        <label className="text-xs font-semibold text-slate-700">
          Avaliação dos controles
          <Textarea
            className="mt-1 min-h-16"
            value={controls}
            onChange={event => setControls(event.target.value)}
          />
        </label>
        <label className="text-xs font-semibold text-slate-700">
          Conclusão técnica
          <Textarea
            className="mt-1 min-h-24"
            value={conclusion}
            onChange={event => setConclusion(event.target.value)}
          />
        </label>
        <Button
          disabled={conclusion.trim().length < 10}
          onClick={() =>
            save({
              id: Number(row.id),
              evaluationKind: kind,
              methodology: methodology || undefined,
              measurementResult: measurement || undefined,
              toleranceReference: reference || undefined,
              exposureCharacterization: exposure || undefined,
              controlAssessment: controls || undefined,
              technicalConclusion: conclusion.trim(),
            })
          }
        >
          <CheckCircle2 className="mr-1" size={14} /> Validar decisão
        </Button>
      </div>
    </div>
  );
}

function FileList({
  title,
  rows,
  empty,
  label,
  open,
}: {
  title: string;
  rows: any[];
  empty: string;
  label: (row: any) => string;
  open: (row: any) => void;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="divide-y border">
        {rows.map(row => (
          <button
            className="flex w-full items-center justify-between gap-3 p-3 text-left text-sm hover:bg-slate-50"
            key={row.id}
            onClick={() => open(row)}
            type="button"
          >
            <span>{label(row)}</span>
            <Download className="shrink-0" size={14} />
          </button>
        ))}
        {!rows.length ? <p className="p-3 text-sm text-slate-500">{empty}</p> : null}
      </div>
    </div>
  );
}

function DocumentDialog({
  open,
  close,
  initial,
  initialType,
  pgrs,
  save,
  busy,
}: {
  open: boolean;
  close: () => void;
  initial: any;
  initialType: DocumentType;
  pgrs: any[];
  save: (payload: any) => void;
  busy: boolean;
}) {
  const [type, setType] = useState<DocumentType>(initialType);
  const [pgrId, setPgrId] = useState(0);
  const [title, setTitle] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [objective, setObjective] = useState("");
  const [legalBasis, setLegalBasis] = useState("");
  const [methodology, setMethodology] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [responsibleName, setResponsibleName] = useState("");
  const [profession, setProfession] = useState("");
  const [registration, setRegistration] = useState("");
  const [art, setArt] = useState("");
  const [chapters, setChapters] = useState<Array<{ title: string; content: string }>>(
    []
  );
  useEffect(() => {
    let parsed: any[] = [];
    try {
      parsed = JSON.parse(initial?.chapters_json || "[]");
    } catch {}
    setType(initial?.document_type || initialType);
    setPgrId(Number(initial?.pgr_id || 0));
    setTitle(initial?.title || "");
    setValidFrom(String(initial?.valid_from || "").slice(0, 10));
    setValidUntil(String(initial?.valid_until || "").slice(0, 10));
    setObjective(initial?.objective || "");
    setLegalBasis(initial?.legal_basis || "");
    setMethodology(initial?.methodology || "");
    setConclusion(initial?.conclusion || "");
    setResponsibleName(initial?.responsible_name || "");
    setProfession(initial?.responsible_profession || "");
    setRegistration(initial?.responsible_registration || "");
    setArt(initial?.responsible_art || "");
    setChapters(parsed);
  }, [initial, initialType, open]);
  return (
    <Dialog open={open} onOpenChange={value => !value && close()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Editar documento técnico" : "Novo documento técnico"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold text-slate-700">
              Tipo
              <select
                className="mt-1 h-10 w-full border bg-white px-2 text-sm"
                disabled={Boolean(initial)}
                value={type}
                onChange={event => setType(event.target.value as DocumentType)}
              >
                {TYPES.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700">
              PGR de referência
              <select
                className="mt-1 h-10 w-full border bg-white px-2 text-sm"
                value={pgrId}
                onChange={event => setPgrId(Number(event.target.value))}
              >
                <option value={0}>Definir depois</option>
                {pgrs.map(row => (
                  <option key={row.id} value={row.id}>
                    {row.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="text-xs font-semibold text-slate-700">
            Título
            <Input
              className="mt-1"
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="Gerado automaticamente se ficar em branco"
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold text-slate-700">
              Vigência inicial
              <Input
                className="mt-1"
                type="date"
                value={validFrom}
                onChange={event => setValidFrom(event.target.value)}
              />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Vigência final
              <Input
                className="mt-1"
                type="date"
                value={validUntil}
                onChange={event => setValidUntil(event.target.value)}
              />
            </label>
          </div>
          <label className="text-xs font-semibold text-slate-700">
            Objetivo e escopo
            <Textarea
              className="mt-1 min-h-20"
              value={objective}
              onChange={event => setObjective(event.target.value)}
            />
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Fundamentação legal e técnica
            <Textarea
              className="mt-1 min-h-20"
              value={legalBasis}
              onChange={event => setLegalBasis(event.target.value)}
            />
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Metodologia
            <Textarea
              className="mt-1 min-h-24"
              value={methodology}
              onChange={event => setMethodology(event.target.value)}
            />
          </label>
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
                <Plus className="mr-1" size={14} /> Capítulo
              </Button>
            </div>
            <div className="space-y-3">
              {chapters.map((chapter, index) => (
                <div className="border bg-slate-50 p-3" key={index}>
                  <Input
                    value={chapter.title}
                    onChange={event =>
                      setChapters(rows =>
                        rows.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, title: event.target.value }
                            : row
                        )
                      )
                    }
                    placeholder="Título do capítulo"
                  />
                  <Textarea
                    className="mt-2 min-h-20"
                    value={chapter.content}
                    onChange={event =>
                      setChapters(rows =>
                        rows.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, content: event.target.value }
                            : row
                        )
                      )
                    }
                  />
                  <Button
                    className="mt-1 text-rose-700"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setChapters(rows => rows.filter((_, rowIndex) => rowIndex !== index))
                    }
                  >
                    Remover
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <label className="text-xs font-semibold text-slate-700">
            Conclusão técnica
            <Textarea
              className="mt-1 min-h-24"
              value={conclusion}
              onChange={event => setConclusion(event.target.value)}
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold text-slate-700">
              Responsável técnico
              <Input
                className="mt-1"
                value={responsibleName}
                onChange={event => setResponsibleName(event.target.value)}
              />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Profissão
              <Input
                className="mt-1"
                value={profession}
                onChange={event => setProfession(event.target.value)}
              />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Registro profissional
              <Input
                className="mt-1"
                value={registration}
                onChange={event => setRegistration(event.target.value)}
              />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              ART ou documento equivalente
              <Input
                className="mt-1"
                value={art}
                onChange={event => setArt(event.target.value)}
              />
            </label>
          </div>
          <Button
            disabled={busy}
            onClick={() =>
              save({
                id: initial?.id,
                type,
                pgrId: pgrId || null,
                title: title.trim(),
                validFrom: validFrom || null,
                validUntil: validUntil || null,
                objective: objective || undefined,
                legalBasis: legalBasis || undefined,
                methodology: methodology || undefined,
                chapters,
                conclusion: conclusion || undefined,
                responsibleName: responsibleName || undefined,
                responsibleProfession: profession || undefined,
                responsibleRegistration: registration || undefined,
                responsibleArt: art || undefined,
              })
            }
          >
            {busy ? "Salvando..." : "Salvar documento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AttachmentDialog({
  open,
  close,
  documentId,
  save,
  busy,
}: {
  open: boolean;
  close: () => void;
  documentId: number | null;
  save: (payload: any) => void;
  busy: boolean;
}) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const submit = () => {
    if (!documentId || !file) return;
    const reader = new FileReader();
    reader.onload = () =>
      save({
        documentId,
        title: title || undefined,
        fileName: file.name,
        fileBase64: String(reader.result),
      });
    reader.onerror = () => toast.error("Não foi possível ler o arquivo.");
    reader.readAsDataURL(file);
  };
  return (
    <Dialog open={open} onOpenChange={value => !value && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anexar evidência</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Input
            value={title}
            onChange={event => setTitle(event.target.value)}
            placeholder="Título ou identificação"
          />
          <Input
            type="file"
            onChange={event => setFile(event.target.files?.[0] || null)}
          />
          <Button disabled={!file || busy} onClick={submit}>
            {busy ? "Arquivando..." : "Arquivar evidência"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
