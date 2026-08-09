import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ShieldCheck, AlertTriangle, AlertOctagon, CheckCircle2, FileCheck2,
  FileText, Download, Loader2,
  ClipboardCheck, Users, BookOpen, FileSearch, Printer,
  ChevronDown, ChevronRight, BarChart3, Building2, Layers,
  ExternalLink, ShieldAlert, ListChecks, ScrollText, GraduationCap, Stethoscope,
} from "lucide-react";

type TabId = "overview" | "fiscalizacao" | "evidencias" | "dossie" | "documentos" | "maturidade" | "primeiros_socorros" | "epi_epc" | "occupational_docs" | "occupational_lifecycle";

const AXIS_ICONS: Record<string, any> = {
  ciclo: ShieldCheck,
  inventario: ListChecks,
  plano: ClipboardCheck,
  participacao: Users,
  treinamento: BookOpen,
  evidencias: FileSearch,
};

const DOCS_OFICIAIS = [
  { titulo: "NR-01 — Normas Regulamentadoras Vigentes", descricao: "Texto oficial vigente da NR-01 (Disposições Gerais e GRO)", url: "https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-1", tag: "NR-01" },
  { titulo: "Portaria MTE nº 1.419/2024", descricao: "Altera a NR-01 incluindo os fatores de risco psicossociais (PDF oficial)", url: "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/seguranca-e-saude-no-trabalho/sst-portarias/2024/portaria-mte-no-1-419-nr-01-gro-nova-redacao.pdf", tag: "Legislação" },
  { titulo: "Guia NR-01 Revisado — Riscos Psicossociais", descricao: "Guia prático do MTE sobre identificação e gestão dos riscos psicossociais (PDF oficial)", url: "https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/guia-nr-01-revisado.pdf", tag: "Psicossocial" },
  { titulo: "Perguntas e Respostas — NR-01", descricao: "FAQ oficial do Ministério do Trabalho e Emprego sobre a NR-01", url: "https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora", tag: "FAQ" },
  { titulo: "Manual GRO / PGR", descricao: "Portal oficial de Segurança e Saúde no Trabalho (GRO/PGR)", url: "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/seguranca-e-saude-no-trabalho", tag: "GRO/PGR" },
  { titulo: "Inclusão dos Riscos Psicossociais na NR-01", descricao: "Comunicado oficial do MTE sobre a atualização da norma", url: "https://www.gov.br/trabalho-e-emprego/pt-br/noticias-e-conteudo/2024/Setembro/governo-federal-atualiza-nr-01-para-incluir-riscos-psicossociais-e-reconstitui-comissao-do-benzeno", tag: "Atualização" },
];

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 70 ? "#059669" : score >= 40 ? "#D97706" : "#DC2626";
  const label = score >= 70 ? "Pronto para Fiscalização" : score >= 40 ? "Conformidade parcial" : "Atenção necessária";
  const dash = Math.round((score / 100) * 188);
  return (
    <div className="text-center flex-shrink-0">
      <svg width="140" height="85" viewBox="0 0 140 85">
        <path d="M10 78 A60 60 0 0 1 130 78" fill="none" stroke="#e5e7eb" strokeWidth="14" strokeLinecap="round" />
        <path d="M10 78 A60 60 0 0 1 130 78" fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${dash} 188`} />
        <text x="70" y="72" textAnchor="middle" fontSize="22" fontWeight="700" fill={color}>{score}%</text>
      </svg>
      <div className="text-xs font-semibold mt-0.5" style={{ color }}>{label}</div>
    </div>
  );
}

function ComplianceSeal({ score }: { score: number }) {
  const seals = [
    { min: 40, label: "Gestão Psicossocial Ativa" },
    { min: 60, label: "Evidências Auditáveis" },
    { min: 80, label: "Conformidade NR-01 Monitorada" },
  ].filter(s => score >= s.min);
  if (!seals.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {seals.map(s => (
        <span key={s.label} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
          🏆 {s.label}
        </span>
      ))}
      <p className="w-full text-xs text-slate-400 mt-0.5">Selos calculados com base em evidências reais na plataforma. Não representam certificação oficial.</p>
    </div>
  );
}

function FirstAidCompliancePanel() {
  const reportQ = (trpc.firstaid as any).report.useQuery();
  const pdfMut = (trpc.firstaid as any).generateReportPdf.useMutation({
    onSuccess: (r: any) => {
      if (r?.url) window.open(r.url, "_blank");
      toast.success("PDF de Primeiros Socorros gerado.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao gerar PDF."),
  });
  const d = reportQ.data as any;
  const cards = [
    ["Kits ativos", d?.summary?.kits ?? 0],
    ["Itens cadastrados", d?.summary?.items ?? 0],
    ["Vencidos", d?.summary?.expired ?? 0],
    ["Vence em 30 dias", d?.summary?.soon30 ?? 0],
    ["Faltantes", d?.summary?.missing ?? 0],
    ["Estoque crítico", d?.summary?.critical ?? 0],
  ];
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border p-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-lg mb-1">Relatório de Primeiros Socorros</h2>
          <p className="text-sm text-slate-500">Evidência de kits, validade, itens faltantes, estoque e distribuição por filial/setor.</p>
        </div>
        <Button onClick={() => pdfMut.mutate()} disabled={pdfMut.isPending} className="gap-2">
          {pdfMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />} Gerar PDF
        </Button>
      </div>
      {reportQ.isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-400" /></div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {cards.map(([label, value]) => (
              <div key={label} className="bg-white rounded-xl border p-4">
                <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold">{label}</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{value}</div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-5 py-3 border-b bg-slate-50 font-semibold text-sm">Visão por filial e setor</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr><th className="text-left p-2">Filial</th><th className="text-left p-2">Setor</th><th className="p-2">Kits</th><th className="p-2">Itens</th><th className="p-2">Vencidos</th><th className="p-2">30 dias</th><th className="p-2">Faltantes</th><th className="p-2">Críticos</th></tr>
                </thead>
                <tbody>
                  {(d?.byLocation ?? []).map((r: any, i: number) => (
                    <tr key={`${r.branchName}-${r.sectorName}-${i}`} className="border-t">
                      <td className="p-2">{r.branchName}</td><td className="p-2">{r.sectorName}</td><td className="p-2 text-center">{r.kits}</td><td className="p-2 text-center">{r.items}</td><td className="p-2 text-center">{r.expired}</td><td className="p-2 text-center">{r.soon30}</td><td className="p-2 text-center">{r.missing}</td><td className="p-2 text-center">{r.critical}</td>
                    </tr>
                  ))}
                  {!(d?.byLocation ?? []).length && <tr><td colSpan={8} className="p-5 text-center text-slate-400">Nenhum kit cadastrado.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function EpiEpcCompliancePanel() {
  const reportQ = (trpc as any).epiEpc.report.useQuery();
  const pdfMut = (trpc as any).epiEpc.generateReportPdf.useMutation({
    onSuccess: (r: any) => {
      if (r?.url) window.open(r.url, "_blank");
      toast.success("PDF de Gestão de EPI/EPC gerado.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao gerar PDF."),
  });
  const d = reportQ.data as any;
  const cards = [
    ["EPIs", d?.summary?.epis ?? 0],
    ["EPCs", d?.summary?.epcs ?? 0],
    ["Vinculados ao PGR", d?.summary?.linkedToPgr ?? 0],
    ["CAs vencidos", d?.summary?.caExpired ?? 0],
    ["Produtos vencidos", d?.summary?.productExpired ?? 0],
    ["Pendentes assinatura", d?.summary?.pendingSignature ?? 0],
  ];
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border p-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-lg mb-1">Gestão de EPI / EPC — NR-06</h2>
          <p className="text-sm text-slate-500">Evidência de CA, validade do produto, vínculo PGR/GSE, entregas, assinaturas, estoque e pendências.</p>
        </div>
        <Button onClick={() => pdfMut.mutate()} disabled={pdfMut.isPending} className="gap-2">
          {pdfMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />} Gerar PDF
        </Button>
      </div>
      {reportQ.isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-400" /></div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {cards.map(([label, value]) => (
              <div key={label} className="bg-white rounded-xl border p-4">
                <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold">{label}</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{value}</div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-5 py-3 border-b bg-slate-50 font-semibold text-sm">Pendências por filial e setor</div>
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr><th className="text-left p-2">Filial</th><th className="text-left p-2">Setor</th><th className="p-2">EPIs</th><th className="p-2">EPCs</th><th className="p-2">CA vencido</th><th className="p-2">Produto vencido</th><th className="p-2">Estoque crítico</th></tr>
              </thead>
              <tbody>
                {(d?.byLocation ?? []).map((r: any, i: number) => (
                  <tr key={i} className="border-t"><td className="p-2">{r.branchName}</td><td className="p-2">{r.sectorName}</td><td className="p-2 text-center">{r.epis}</td><td className="p-2 text-center">{r.epcs}</td><td className="p-2 text-center">{r.caExpired}</td><td className="p-2 text-center">{r.productExpired}</td><td className="p-2 text-center">{r.stockCritical}</td></tr>
                ))}
                {!(d?.byLocation ?? []).length && <tr><td colSpan={7} className="p-5 text-center text-slate-400">Nenhum EPI/EPC cadastrado.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function OccupationalLifecycleCompliancePanel() {
  const dashboardQ = trpc.occupationalLifecycle.dashboard.useQuery();
  const populationQ = trpc.occupationalLifecycle.listExamPopulation.useQuery();
  const data = dashboardQ.data as any;
  const population = (populationQ.data || []) as any[];
  const cards = [
    ["Cobertura GSE", `${Number(data?.gse_coverage || 0)}%`, Number(data?.workers_without_gse || 0) === 0],
    ["Trabalhadores sem GSE", Number(data?.workers_without_gse || 0), Number(data?.workers_without_gse || 0) === 0],
    ["Exames previstos", population.length, true],
    ["Exames sem requisição", population.filter(row => row.operational_status === "requisicao_pendente").length, !population.some(row => row.operational_status === "requisicao_pendente")],
    ["Resultados a revisar", Number(data?.pending_results || 0), Number(data?.pending_results || 0) === 0],
    ["CATs sem transmissão", Number(data?.pending_cats || 0), Number(data?.pending_cats || 0) === 0],
  ];
  return <div className="space-y-4"><div className="flex flex-wrap items-start justify-between gap-3 border bg-white p-5"><div><h2 className="text-lg font-semibold">Conformidade da Saúde Ocupacional</h2><p className="mt-1 text-sm text-slate-500">GSE mestre, PCMSO, exames, resultados, ASO e CAT em uma única cadeia rastreável.</p></div><a className="inline-flex h-10 items-center border px-4 text-sm font-semibold text-teal-800" href="/admin/saude-ocupacional">Abrir operação ocupacional</a></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{cards.map(([label, value, compliant]) => <div key={String(label)} className={`border p-4 ${compliant ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}><div className="text-xs font-semibold uppercase text-slate-500">{label}</div><div className="mt-2 text-2xl font-bold text-slate-950">{value as any}</div><div className={`mt-2 text-xs font-semibold ${compliant ? "text-emerald-700" : "text-amber-700"}`}>{compliant ? "Conforme" : "Requer atenção"}</div></div>)}</div><div className="border-l-4 border-sky-500 bg-sky-50 p-4 text-sm">Os indicadores são calculados sobre os dados atuais da empresa. Eventos S-2210, S-2220 e S-2240 permanecem marcados como pendentes até que a integração oficial com o eSocial seja disponibilizada.</div></div>;
}

function OccupationalDocumentsCompliancePanel() {
  const summaryQ = trpc.technicalDocuments.complianceSummary.useQuery();
  const data = summaryQ.data as any;
  const documentsByType = new Map(
    ((data?.documentsByType || []) as any[]).map(row => [
      String(row.document_type),
      row,
    ])
  );
  const pcmso = data?.pcmso || {};
  if (summaryQ.isLoading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-slate-400" />
      </div>
    );
  const technicalRow = (type: string, label: string) => {
    const summary: any = documentsByType.get(type) || {};
    return {
      label,
      total: Number(summary.total || 0),
      active: Number(summary.vigente || 0),
      review: Number(summary.revisar_pgr || 0),
      score: Math.round(Number(summary.score || 0)),
      pending: Number(summary.pendencias || 0),
    };
  };
  const rows = [
    {
      label: "PCMSO",
      total: Number(pcmso.total || 0),
      active: Number(pcmso.vigente || 0),
      review: Number(pcmso.revisar_pgr || 0),
      score: Math.round(Number(pcmso.score || 0)),
      pending: Number(pcmso.pendencias || 0),
    },
    technicalRow("ltcat", "LTCAT"),
    technicalRow("insalubridade", "Insalubridade"),
    technicalRow("periculosidade", "Periculosidade"),
  ];
  const checklistRows = [
    ["PCMSO", data?.checklists?.pcmso],
    ["LTCAT", data?.checklists?.technical?.ltcat],
    ["Insalubridade", data?.checklists?.technical?.insalubridade],
    ["Periculosidade", data?.checklists?.technical?.periculosidade],
  ] as Array<[string, any]>;
  return (
    <div className="space-y-4">
      <div className="border bg-white p-5">
        <h2 className="text-lg font-semibold">PCMSO e Documentos Técnicos</h2>
        <p className="mt-1 text-sm text-slate-500">
          Conformidade calculada sobre programas e laudos reais, integração com
          o PGR, decisões técnicas, auditorias e versões vigentes.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {rows.map(row => {
          const status = row.score >= 80 ? "Conforme" : row.score >= 50 ? "Atenção" : "Não conforme";
          const toneClass =
            row.score >= 80
              ? "text-emerald-700"
              : row.score >= 50
                ? "text-amber-700"
                : "text-rose-700";
          return (
            <div className="border bg-white p-4" key={row.label}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{row.label}</h3>
                <span className={`text-xs font-semibold ${toneClass}`}>
                  {status}
                </span>
              </div>
              <div className="mt-4 text-3xl font-bold">{row.score}%</div>
              <div className="mt-3 space-y-1 text-xs text-slate-500">
                <div>Total cadastrado: {row.total}</div>
                <div>Vigentes: {row.active}</div>
                <div>Pendencias registradas: {row.pending}</div>
                <div>Revisões após alteração do PGR: {row.review}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {checklistRows.map(([label, audit]) => {
          const checks = (audit?.requirements || audit?.checks || []) as any[];
          return (
            <section className="border bg-white p-4" key={label}>
              <h3 className="font-semibold">Checklist {label}</h3>
              <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                {audit?.title || "Nenhuma auditoria registrada"}
              </p>
              {checks.length ? (
                <div className="mt-3 divide-y border text-xs">
                  {checks.map((check, index) => {
                    const passed = Boolean(check.passed ?? check.ok);
                    return (
                      <div
                        className="flex items-start justify-between gap-3 p-2"
                        key={`${label}-${check.key || index}`}
                      >
                        <span>{check.label}</span>
                        <span
                          className={
                            passed
                              ? "font-semibold text-emerald-700"
                              : "font-semibold text-rose-700"
                          }
                        >
                          {passed ? "Conforme" : "Pendente"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 border border-dashed p-3 text-xs text-slate-500">
                  Execute a auditoria no documento para gerar o checklist por requisito.
                </p>
              )}
            </section>
          );
        })}
      </div>
      <div className="border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
        Os índices verificam completude e rastreabilidade. Não representam
        certificação, perícia ou aprovação automática do conteúdo técnico.
      </div>
    </div>
  );
}

export default function ComplianceHub() {
  const [tab, setTab] = useState<TabId>("overview");
  const [simRunning, setSimRunning] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);
  const [dossieUserId, setDossieUserId] = useState<number | null>(null);
  const [expandedAxis, setExpandedAxis] = useState<string | null>(null);

  const statusQ  = trpc.compliance.nr01Status.useQuery();
  const maturityQ = trpc.compliance.maturityIndex.useQuery();
  const usersQ   = trpc.audit.listAuditUsers.useQuery();
  const dossieQ  = trpc.audit.evidenceReport.useQuery({ userId: dossieUserId ?? 0 }, { enabled: !!dossieUserId });
  const evidQ    = trpc.compliance.nr01Evidences.useQuery();
  const simMut   = trpc.compliance.simulateFiscalizacao.useMutation({
    onSuccess: (r) => { setSimResult(r); setSimRunning(false); },
    onError:   (e) => { toast.error(e?.message ?? "Erro na simulação"); setSimRunning(false); },
  });

  const st    = statusQ.data;
  const score = st?.score ?? 0;
  const axes  = (st?.axes ?? []) as any[];

  const TABS: { id: TabId; label: string; icon: any }[] = [
    { id: "overview",     label: "Visão Geral",          icon: BarChart3 },
    { id: "maturidade",   label: "Maturidade",           icon: ShieldAlert },
    { id: "fiscalizacao", label: "Simular Fiscalização", icon: ClipboardCheck },
    { id: "evidencias",   label: "Evidências",           icon: FileSearch },
    { id: "primeiros_socorros", label: "Primeiros Socorros", icon: FileText },
    { id: "epi_epc", label: "EPI / EPC", icon: ShieldAlert },
    { id: "occupational_lifecycle", label: "Saúde Ocupacional", icon: Stethoscope },
    { id: "occupational_docs", label: "PCMSO e Laudos", icon: FileCheck2 },
    { id: "dossie",       label: "Dossiê Individual",    icon: Users },
    { id: "documentos",   label: "Documentos Oficiais",  icon: Download },
  ];

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div className="relative pl-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500 to-transparent rounded-full" />
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="text-emerald-600" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>Central de Conformidade NR-01</h1>
              <p className="text-sm text-slate-500">Prontidão para fiscalizações · Evidências auditáveis · Gestão dos 13 fatores de risco psicossocial</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border p-1 inline-flex flex-wrap gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2 transition-colors ${tab === id ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-100"}`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {/* ── VISÃO GERAL ───────────────────────────────────────────────────── */}
        {tab === "overview" && (
          <div className="space-y-5">
            {statusQ.isLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-400" size={28} /></div>
            ) : (
              <>
                <div className="bg-white rounded-xl border p-6 flex flex-col md:flex-row items-center gap-8">
                  <ScoreGauge score={score} />
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-lg mb-1">Índice de Conformidade NR-01</h2>
                    <p className="text-sm text-slate-500 mb-3">
                      Calculado automaticamente: ciclos ativos, inventário, plano de ação,
                      participação nas pesquisas, treinamentos e evidências documentais.
                    </p>
                    <ComplianceSeal score={score} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {axes.map((ax: any) => {
                    const Icon = AXIS_ICONS[ax.axis] ?? ShieldAlert;
                    const isOpen = expandedAxis === ax.axis;
                    const c = ax.score >= 70 ? "emerald" : ax.score >= 40 ? "amber" : "rose";
                    return (
                      <div key={ax.axis} className="bg-white rounded-xl border overflow-hidden">
                        <button className="w-full p-4 text-left flex items-center gap-3 hover:bg-slate-50"
                          onClick={() => setExpandedAxis(isOpen ? null : ax.axis)}>
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center bg-${c}-50 flex-shrink-0`}>
                            <Icon size={16} className={`text-${c}-600`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium leading-tight">{ax.label}</div>
                            <div className={`w-full bg-slate-100 rounded-full h-1.5 mt-1.5`}>
                              <div className={`h-1.5 rounded-full bg-${c}-500 transition-all`} style={{ width: `${ax.score}%` }} />
                            </div>
                          </div>
                          <span className={`text-sm font-bold text-${c}-600 w-10 text-right flex-shrink-0`}>{ax.score}%</span>
                          {isOpen ? <ChevronDown size={15} className="text-slate-400 flex-shrink-0" /> : <ChevronRight size={15} className="text-slate-400 flex-shrink-0" />}
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4 border-t bg-slate-50 pt-3 space-y-1.5">
                            {(ax.details ?? []).map((d: any, i: number) => (
                              <div key={i} className="flex items-start gap-2 text-xs">
                                {d.ok
                                  ? <CheckCircle2 size={13} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                                  : d.warn
                                  ? <AlertTriangle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                                  : <AlertOctagon size={13} className="text-rose-500 mt-0.5 flex-shrink-0" />}
                                <span className="text-slate-700">{d.text}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {(st?.ranking ?? []).length > 0 && (
                  <div className="bg-white rounded-xl border p-5">
                    <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Building2 size={15} /> Ranking de Conclusão por Setor</h3>
                    <div className="space-y-2">
                      {(st!.ranking as any[]).map((r: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 text-sm">
                          <span className="text-slate-400 w-5 text-right text-xs">{i + 1}.</span>
                          <span className="flex-1 font-medium text-sm">{r.name}</span>
                          <div className="w-32 bg-slate-100 rounded-full h-2">
                            <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${r.score}%` }} />
                          </div>
                          <span className="text-xs font-bold w-10 text-right">{r.score}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* P18 #21 — Bruno: visão executiva única (Conformidade Geral + eixos) pra
            reuniões com cliente/auditoria, separada do operacional de "Visão Geral". */}
        {tab === "maturidade" && (
          <div className="space-y-5">
            {maturityQ.isLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-400" size={28} /></div>
            ) : !maturityQ.data ? (
              <div className="bg-white rounded-xl border p-8 text-center text-sm text-slate-400">Sem dados suficientes ainda.</div>
            ) : (
              <>
                <div className="bg-white rounded-xl border p-6 flex flex-col md:flex-row items-center gap-8">
                  <ScoreGauge score={maturityQ.data.conformidadeGeral} />
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-lg mb-1">Índice de Maturidade em Conformidade</h2>
                    <p className="text-sm text-slate-500">
                      {maturityQ.data.company?.name} — visão executiva combinando pesquisas, treinamentos
                      prioritários, evidências documentais, plano de ação, CIPA, SIPAT e primeiros socorros.
                      Pensado para reuniões com clientes e auditorias.
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-xl border p-5">
                  <h3 className="font-semibold text-sm mb-4">Distribuição por eixo</h3>
                  <div className="space-y-3">
                    {(maturityQ.data.axes as any[]).map((ax) => {
                      const c = ax.score >= 70 ? "emerald" : ax.score >= 40 ? "amber" : "rose";
                      return (
                        <div key={ax.key} className="flex items-center gap-3">
                          <span className="text-sm w-40 flex-shrink-0">{ax.label}</span>
                          <div className="flex-1 bg-slate-100 rounded-full h-2.5">
                            <div className={`h-2.5 rounded-full bg-${c}-500`} style={{ width: `${ax.score}%` }} />
                          </div>
                          <span className={`text-sm font-bold w-12 text-right text-${c}-600`}>{ax.score}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white rounded-xl border p-5 text-xs text-slate-500 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><span className="text-slate-400">DRPS respondido:</span> {maturityQ.data.details.drpsRespondido ? "Sim" : "Não"}</div>
                  <div><span className="text-slate-400">AEP respondido:</span> {maturityQ.data.details.aepRespondido ? "Sim" : "Não"}</div>
                  <div><span className="text-slate-400">Participação pesquisas:</span> {maturityQ.data.details.respondentes}/{maturityQ.data.details.totalEmp}</div>
                  <div><span className="text-slate-400">Ações no prazo:</span> {maturityQ.data.details.planCount - maturityQ.data.details.planOverdue}/{maturityQ.data.details.planCount}</div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── SIMULAR FISCALIZAÇÃO ──────────────────────────────────────────── */}
        {tab === "fiscalizacao" && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border p-6">
              <h2 className="font-semibold text-lg mb-2">Simulação de Fiscalização NR-01</h2>
              <p className="text-sm text-slate-500 mb-4">
                Analisa automaticamente os mesmos 6 eixos verificados por um Auditor Fiscal do Trabalho
                em fiscalizações de riscos psicossociais: inventário, plano de ação, participação,
                fatores de risco, capacitação e evidências.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => { setSimRunning(true); setSimResult(null); simMut.mutate(); }}
                  disabled={simRunning} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                  {simRunning ? <Loader2 size={15} className="animate-spin" /> : <ClipboardCheck size={15} />}
                  {simRunning ? "Analisando dados..." : "Iniciar Simulação Agora"}
                </Button>
                <Button variant="outline" className="gap-2"
                  onClick={() => window.open("/plataforma/admin/compliance/relatorio-fiscalizacao", "_blank")}>
                  <ScrollText size={15} /> Gerar Relatório para Fiscalização
                </Button>
                <Button variant="outline" className="gap-2"
                  onClick={() => window.open("/plataforma/admin/compliance/relatorio-metodologia", "_blank")}>
                  <FileText size={15} /> Gerar Relatório de Legitimidade Metodológica
                </Button>
              </div>
              {/* SP6 #6 — 3 relatórios novos */}
              <div className="mt-3 pt-3 border-t flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-2"
                  onClick={() => window.open("/plataforma/admin/compliance/canal-denuncias", "_blank")}>
                  <FileText size={13} /> Canal de Denúncias
                </Button>
                <Button variant="outline" size="sm" className="gap-2"
                  onClick={() => window.open("/plataforma/admin/compliance/lei-14457", "_blank")}>
                  <FileText size={13} /> Lei 14.457/2022
                </Button>
                <Button variant="outline" size="sm" className="gap-2"
                  onClick={() => window.open("/plataforma/admin/compliance/lgpd", "_blank")}>
                  <FileText size={13} /> LGPD + Segurança da Informação
                </Button>
              </div>
            </div>

            {simRunning && (
              <div className="text-center py-12 bg-white rounded-xl border">
                <Loader2 size={32} className="mx-auto mb-3 animate-spin text-emerald-500" />
                <p className="font-medium text-slate-700">Cruzando dados da empresa com os critérios da NR-01...</p>
                <p className="text-xs text-slate-400 mt-1">Inventário · Plano de ação · Participação · Capacitação · Evidências</p>
              </div>
            )}

            {simResult && !simRunning && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: "conformidades", label: "Conformidades",     Icon: CheckCircle2,  bg: "emerald" },
                    { key: "alertas",       label: "Alertas",           Icon: AlertTriangle, bg: "amber" },
                    { key: "nao_conf",      label: "Não Conformidades", Icon: AlertOctagon,  bg: "rose" },
                  ].map(({ key, label, Icon, bg }) => (
                    <div key={key} className={`bg-${bg}-50 border border-${bg}-200 rounded-xl p-4 text-center`}>
                      <Icon size={22} className={`mx-auto text-${bg}-600 mb-1`} />
                      <div className={`text-2xl font-bold text-${bg}-700`}>{(simResult[key] ?? []).length}</div>
                      <div className={`text-xs font-medium text-${bg}-600`}>{label}</div>
                    </div>
                  ))}
                </div>

                {[
                  { key: "conformidades", title: "✅ Conformidades",       c: "emerald" },
                  { key: "alertas",       title: "⚠️ Alertas",             c: "amber" },
                  { key: "nao_conf",      title: "❌ Não Conformidades",   c: "rose" },
                ].map(({ key, title, c }) => {
                  const items: any[] = simResult[key] ?? [];
                  if (!items.length) return null;
                  return (
                    <div key={key} className={`bg-white rounded-xl border border-${c}-200 overflow-hidden`}>
                      <div className={`px-5 py-3 border-b border-${c}-100 bg-${c}-50`}>
                        <h3 className={`font-semibold text-${c}-800 text-sm`}>{title} ({items.length})</h3>
                      </div>
                      <div className="divide-y">
                        {items.map((item: any, i: number) => (
                          <div key={i} className="px-5 py-3">
                            <div className="font-medium text-sm">{item.eixo} — {item.check}</div>
                            {item.detail && <div className="text-xs text-slate-500 mt-0.5">{item.detail}</div>}
                            {item.acao  && <div className={`text-xs text-${c}-700 mt-1 font-medium`}>💡 {item.acao}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <Button variant="outline" className="w-full gap-2" onClick={() => window.print()}>
                  <Printer size={15} /> Imprimir Relatório da Simulação
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── EVIDÊNCIAS ────────────────────────────────────────────────────── */}
        {tab === "evidencias" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-semibold text-lg mb-1">Evidências Vinculadas NR-01</h2>
              <p className="text-sm text-slate-500">Registros auditáveis gerados automaticamente — disponíveis para fiscalizações e processos judiciais.</p>
            </div>
            {evidQ.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-400" /></div>
            ) : (
              <div className="space-y-3">
                {(evidQ.data ?? []).map((group: any) => (
                  <div key={group.category} className="bg-white rounded-xl border overflow-hidden">
                    <div className="px-5 py-3 border-b bg-slate-50 flex items-center gap-2">
                      <Layers size={14} className="text-slate-400" />
                      <h3 className="font-semibold text-sm">{group.category}</h3>
                      <span className="ml-auto text-xs text-slate-400">{group.items.length} registro(s)</span>
                    </div>
                    {group.items.length === 0 ? (
                      <div className="px-5 py-4 text-xs text-slate-400 italic">Nenhum registro encontrado nesta categoria.</div>
                    ) : (
                      <div className="divide-y">
                        {group.items.map((item: any, i: number) => (
                          <div key={i} className="px-5 py-3 flex items-center gap-3">
                            <FileText size={13} className="text-slate-300 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{item.label}</div>
                              {item.detail && <div className="text-xs text-slate-400">{item.detail}</div>}
                            </div>
                            {item.url && (
                              <a href={item.url} target="_blank" rel="noreferrer"
                                className="text-xs text-emerald-600 hover:underline inline-flex items-center gap-1 flex-shrink-0">
                                <ExternalLink size={12} /> Abrir
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PRIMEIROS SOCORROS ───────────────────────────────────────────── */}
        {tab === "primeiros_socorros" && <FirstAidCompliancePanel />}

        {tab === "epi_epc" && <EpiEpcCompliancePanel />}

        {tab === "occupational_docs" && <OccupationalDocumentsCompliancePanel />}
        {tab === "occupational_lifecycle" && <OccupationalLifecycleCompliancePanel />}

        {/* ── DOSSIÊ INDIVIDUAL ─────────────────────────────────────────────── */}
        {tab === "dossie" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border p-5 print:hidden">
              <h2 className="font-semibold text-lg mb-3">Dossiê Individual do Colaborador</h2>
              <p className="text-sm text-slate-500 mb-4">
                Trilha completa por colaborador: cursos, certificados, aceites eletrônicos (com IP e timestamp),
                tentativas de quiz e trilha de auditoria.
              </p>
              <div className="flex gap-3 items-center">
                <select className="flex-1 max-w-sm border rounded-lg px-3 py-2 text-sm bg-white"
                  value={dossieUserId ?? ""}
                  onChange={(e) => setDossieUserId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">— Selecione um colaborador —</option>
                  {(usersQ.data ?? []).map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name ?? u.email} ({u.email})</option>
                  ))}
                </select>
                {dossieUserId && (
                  <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
                    <Printer size={14} /> Imprimir
                  </Button>
                )}
              </div>
            </div>

            {dossieQ.isLoading && <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>}

            {dossieQ.data && (() => {
              const r = dossieQ.data as any;
              return (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border p-5">
                    <h3 className="font-semibold mb-3 text-sm flex items-center gap-2"><Users size={14} /> Dados do Colaborador</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      {[["Nome", r.user?.name ?? "—"], ["E-mail", r.user?.email ?? "—"], ["Função", r.user?.role ?? "—"], ["ID", String(r.user?.id ?? "—")], ["Cadastro", r.user?.createdAt ? new Date(r.user.createdAt).toLocaleDateString("pt-BR") : "—"]].map(([k, v]) => (
                        <div key={k}><div className="text-xs text-slate-400 mb-0.5">{k}</div><div className="font-medium">{v}</div></div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border p-5">
                    {/* P18 #14 — Bruno (Tatiana/CAMED): conclusão de curso é evidência válida mesmo
                        sem certificado emitido (emissão é manual, pós-conclusão). Sem isso o dossiê
                        ficava zerado apesar de trilha real de lesson_completed. */}
                    <h3 className="font-semibold mb-3 text-sm flex items-center gap-2"><GraduationCap size={14} /> Cursos Concluídos ({r.completedModules?.length ?? 0})</h3>
                    {!r.completedModules?.length ? <p className="text-sm text-slate-400">Nenhum curso concluído ainda.</p> : (
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 text-left"><tr><th className="p-2">Curso</th><th className="p-2">Concluído em</th><th className="p-2">Certificado</th></tr></thead>
                        <tbody>
                          {r.completedModules.map((m: any) => {
                            const cert = (r.certs ?? []).find((c: any) => Number(c.moduleId) === Number(m.moduleId));
                            return (
                              <tr key={m.moduleId} className="border-t">
                                <td className="p-2">{m.moduleTitle}</td>
                                <td className="p-2">{m.completedAt ? new Date(m.completedAt).toLocaleString("pt-BR") : "—"}</td>
                                <td className="p-2">{cert ? <span className="text-emerald-600 font-medium">Emitido</span> : <span className="text-amber-600">Não emitido</span>}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="bg-white rounded-xl border p-5">
                    <h3 className="font-semibold mb-3 text-sm flex items-center gap-2"><BookOpen size={14} /> Certificados ({r.certs?.length ?? 0})</h3>
                    {!r.certs?.length ? <p className="text-sm text-slate-400">Nenhum certificado emitido.</p> : (
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 text-left"><tr><th className="p-2">Código</th><th className="p-2">Curso</th><th className="p-2">Data</th></tr></thead>
                        <tbody>
                          {r.certs.map((c: any) => (
                            <tr key={c.id} className="border-t">
                              <td className="p-2 font-mono">{c.certificateCode}</td>
                              <td className="p-2">Curso #{c.moduleId}</td>
                              <td className="p-2">{c.issuedAt ? new Date(c.issuedAt).toLocaleString("pt-BR") : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="bg-white rounded-xl border p-5">
                    <h3 className="font-semibold mb-3 text-sm flex items-center gap-2"><CheckCircle2 size={14} /> Aceites Eletrônicos ({r.acceptances?.length ?? 0})</h3>
                    {!r.acceptances?.length ? <p className="text-sm text-slate-400">Nenhum aceite registrado.</p> : (
                      <div className="space-y-2">
                        {r.acceptances.map((a: any) => (
                          <div key={a.id} className="border rounded-lg p-3 text-xs">
                            <div className="text-slate-400 mb-1">Curso #{a.moduleId} · {a.acceptedAt ? new Date(a.acceptedAt).toLocaleString("pt-BR") : "—"} · IP: {a.ipAddress ?? "—"}</div>
                            <p className="italic text-slate-700">"{a.termText}"</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-xl border p-5">
                    <h3 className="font-semibold mb-3 text-sm flex items-center gap-2"><ClipboardCheck size={14} /> Avaliações ({r.attempts?.length ?? 0})</h3>
                    {!r.attempts?.length ? <p className="text-sm text-slate-400">Nenhuma tentativa registrada.</p> : (
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 text-left"><tr><th className="p-2">Quiz</th><th className="p-2">Pontuação</th><th className="p-2">Status</th><th className="p-2">Data</th><th className="p-2">IP</th></tr></thead>
                        <tbody>
                          {r.attempts.map((a: any) => (
                            <tr key={a.id} className="border-t">
                              <td className="p-2">#{a.quizId}</td>
                              <td className="p-2">{a.score}%</td>
                              <td className="p-2">{a.passed ? <span className="text-emerald-600 font-medium">Aprovado</span> : <span className="text-rose-600">Reprovado</span>}</td>
                              <td className="p-2">{a.startedAt ? new Date(a.startedAt).toLocaleString("pt-BR") : "—"}</td>
                              <td className="p-2 font-mono">{a.ipAddress ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="bg-white rounded-xl border p-5">
                    <h3 className="font-semibold mb-3 text-sm flex items-center gap-2"><FileSearch size={14} /> Trilha de Auditoria</h3>
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-left"><tr><th className="p-2">Quando</th><th className="p-2">Ação</th><th className="p-2">Entidade</th><th className="p-2">IP</th></tr></thead>
                      <tbody>
                        {!(r.auditTrail ?? []).length ? (
                          <tr><td colSpan={4} className="p-3 text-center text-slate-400">Nenhum evento registrado.</td></tr>
                        ) : r.auditTrail.map((l: any) => (
                          <tr key={l.id} className="border-t">
                            <td className="p-2">{l.createdAt ? new Date(l.createdAt).toLocaleString("pt-BR") : "—"}</td>
                            <td className="p-2 font-mono">{l.action}</td>
                            <td className="p-2">{l.entityType ? `${l.entityType}#${l.entityId}` : "—"}</td>
                            <td className="p-2 font-mono">{l.ipAddress ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── DOCUMENTOS OFICIAIS ───────────────────────────────────────────── */}
        {tab === "documentos" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-semibold text-lg mb-1">Documentos Oficiais NR-01</h2>
              <p className="text-sm text-slate-500">Links diretos para fontes oficiais do Ministério do Trabalho e Emprego relacionados à NR-01.</p>
            </div>
            {/* R5-P9 #16: Metodologia oficial de coleta de dados psicossociais (digital + impressa com OCR/termo/recibo) */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <ScrollText size={18} className="text-indigo-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-indigo-900 mb-1">Metodologia de Coleta de Dados Psicossociais</h3>
                  <p className="text-xs text-indigo-800 leading-relaxed mb-2">
                    Duas vias operacionais oficiais, em conformidade com NR-01, Lei 14.457/2022 e LGPD:
                  </p>
                  <ul className="text-xs text-indigo-900 space-y-1 list-disc pl-4 mb-2">
                    <li><b>Digital:</b> DRPS/MBI online na plataforma, respostas anônimas agregadas por setor.</li>
                    <li><b>Impressa:</b> impressão → aplicação → lançamento em lote pelo RH com <b>Termo de Confidencialidade</b> eletrônico (nome+CPF+cargo), <b>Recibo de Confidencialidade</b> em PDF com código único + QR Code de rastreabilidade fixado externamente ao envelope lacrado, e integração automática no banco como respostas anônimas.</li>
                  </ul>
                  <p className="text-xs text-indigo-700">
                    Esta metodologia é <b>renderizada automaticamente</b> em todo PGR emitido pela plataforma, garantindo
                    documentação técnica consistente para auditoria externa.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DOCS_OFICIAIS.map((doc) => (
                <div key={doc.titulo} className="bg-white rounded-xl border p-5 flex gap-4 hover:border-emerald-300 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <FileText size={18} className="text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-sm leading-tight">{doc.titulo}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex-shrink-0">{doc.tag}</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{doc.descricao}</p>
                    <a href={doc.url} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline font-medium">
                      <Download size={12} /> Acessar documento oficial
                    </a>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
              <strong>Aviso:</strong> Links apontam para documentos do Ministério do Trabalho e Emprego.
              Se algum link estiver indisponível, acesse diretamente{" "}
              <a href="https://www.gov.br/trabalho-e-emprego" target="_blank" rel="noreferrer" className="underline font-medium">www.gov.br/trabalho-e-emprego</a>.
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
