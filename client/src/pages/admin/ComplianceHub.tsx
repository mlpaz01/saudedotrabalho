import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ShieldCheck, AlertTriangle, AlertOctagon, CheckCircle2,
  FileText, Download, Loader2,
  ClipboardCheck, Users, BookOpen, FileSearch, Printer,
  ChevronDown, ChevronRight, BarChart3, Building2, Layers,
  ExternalLink, ShieldAlert, ListChecks, ScrollText,
} from "lucide-react";

type TabId = "overview" | "fiscalizacao" | "evidencias" | "dossie" | "documentos";

const AXIS_ICONS: Record<string, any> = {
  ciclo: ShieldCheck,
  inventario: ListChecks,
  plano: ClipboardCheck,
  participacao: Users,
  treinamento: BookOpen,
  evidencias: FileSearch,
};

const DOCS_OFICIAIS = [
  { titulo: "Texto Oficial NR-01 Atualizado", descricao: "Portaria MTE nÂº 1.419/2024 â€” DisposiÃ§Ãµes Gerais e GRO", url: "https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/consultas-publicas/arquivos/nr-01_atualizada2024.pdf", tag: "NR-01" },
  { titulo: "Guia de Fatores de Risco Psicossociais", descricao: "Guia prÃ¡tico do MTE sobre identificaÃ§Ã£o e gestÃ£o de riscos psicossociais", url: "https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/consultas-publicas/arquivos/guia-riscos-psicossociais.pdf", tag: "Psicossocial" },
  { titulo: "Manual do GRO / PGR", descricao: "Manual de orientaÃ§Ãµes para elaboraÃ§Ã£o do Programa de Gerenciamento de Riscos", url: "https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/consultas-publicas/arquivos/manual-gro-pgr.pdf", tag: "GRO/PGR" },
  { titulo: "Perguntas e Respostas â€” NR-01", descricao: "FAQ oficial do MinistÃ©rio do Trabalho e Emprego sobre a NR-01", url: "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/seguranca-e-saude-no-trabalho/ctpp-nrs/normas-regulamentadoras/nr-01", tag: "FAQ" },
  { titulo: "Portaria MTE 1.419/2024", descricao: "Portaria que aprova as alteraÃ§Ãµes da NR-01 incluindo riscos psicossociais", url: "https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/consultas-publicas/arquivos/portaria-1419-2024.pdf", tag: "LegislaÃ§Ã£o" },
  { titulo: "Nota TÃ©cnica â€” AvaliaÃ§Ã£o Psicossocial", descricao: "OrientaÃ§Ãµes tÃ©cnicas sobre instrumentos e metodologias aceitas pela fiscalizaÃ§Ã£o", url: "https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/consultas-publicas/arquivos/nota-tecnica-psicossocial.pdf", tag: "Nota TÃ©cnica" },
];

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 70 ? "#059669" : score >= 40 ? "#D97706" : "#DC2626";
  const label = score >= 70 ? "Pronto para FiscalizaÃ§Ã£o" : score >= 40 ? "Conformidade parcial" : "AtenÃ§Ã£o necessÃ¡ria";
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
    { min: 40, label: "GestÃ£o Psicossocial Ativa" },
    { min: 60, label: "EvidÃªncias AuditÃ¡veis" },
    { min: 80, label: "Conformidade NR-01 Monitorada" },
  ].filter(s => score >= s.min);
  if (!seals.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {seals.map(s => (
        <span key={s.label} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
          ðŸ† {s.label}
        </span>
      ))}
      <p className="w-full text-xs text-slate-400 mt-0.5">Selos calculados com base em evidÃªncias reais na plataforma. NÃ£o representam certificaÃ§Ã£o oficial.</p>
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
  const usersQ   = trpc.audit.listAuditUsers.useQuery();
  const dossieQ  = trpc.audit.evidenceReport.useQuery({ userId: dossieUserId ?? 0 }, { enabled: !!dossieUserId });
  const evidQ    = trpc.compliance.nr01Evidences.useQuery();
  const simMut   = trpc.compliance.simulateFiscalizacao.useMutation({
    onSuccess: (r) => { setSimResult(r); setSimRunning(false); },
    onError:   (e) => { toast.error(e?.message ?? "Erro na simulaÃ§Ã£o"); setSimRunning(false); },
  });

  const st    = statusQ.data;
  const score = st?.score ?? 0;
  const axes  = (st?.axes ?? []) as any[];

  const TABS: { id: TabId; label: string; icon: any }[] = [
    { id: "overview",     label: "VisÃ£o Geral",          icon: BarChart3 },
    { id: "fiscalizacao", label: "Simular FiscalizaÃ§Ã£o", icon: ClipboardCheck },
    { id: "evidencias",   label: "EvidÃªncias",           icon: FileSearch },
    { id: "dossie",       label: "DossiÃª Individual",    icon: Users },
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
              <p className="text-sm text-slate-500">ProntidÃ£o para fiscalizaÃ§Ãµes Â· EvidÃªncias auditÃ¡veis Â· GestÃ£o dos 13 fatores de risco psicossocial</p>
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

        {/* â”€â”€ VISÃƒO GERAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {tab === "overview" && (
          <div className="space-y-5">
            {statusQ.isLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-400" size={28} /></div>
            ) : (
              <>
                <div className="bg-white rounded-xl border p-6 flex flex-col md:flex-row items-center gap-8">
                  <ScoreGauge score={score} />
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-lg mb-1">Ãndice de Conformidade NR-01</h2>
                    <p className="text-sm text-slate-500 mb-3">
                      Calculado automaticamente: ciclos ativos, inventÃ¡rio, plano de aÃ§Ã£o,
                      participaÃ§Ã£o nas pesquisas, treinamentos e evidÃªncias documentais.
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
                    <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Building2 size={15} /> Ranking de ConclusÃ£o por Setor</h3>
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

        {/* â”€â”€ SIMULAR FISCALIZAÃ‡ÃƒO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {tab === "fiscalizacao" && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border p-6">
              <h2 className="font-semibold text-lg mb-2">SimulaÃ§Ã£o de FiscalizaÃ§Ã£o NR-01</h2>
              <p className="text-sm text-slate-500 mb-4">
                Analisa automaticamente os mesmos 6 eixos verificados por um Auditor Fiscal do Trabalho
                em fiscalizaÃ§Ãµes de riscos psicossociais: inventÃ¡rio, plano de aÃ§Ã£o, participaÃ§Ã£o,
                fatores de risco, capacitaÃ§Ã£o e evidÃªncias.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => { setSimRunning(true); setSimResult(null); simMut.mutate(); }}
                  disabled={simRunning} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                  {simRunning ? <Loader2 size={15} className="animate-spin" /> : <ClipboardCheck size={15} />}
                  {simRunning ? "Analisando dados..." : "Iniciar Simulação Agora"}
                </Button>
                <Button variant="outline" className="gap-2"
                  onClick={() => window.open("/admin/compliance/relatorio-fiscalizacao", "_blank")}>
                  <ScrollText size={15} /> Gerar Relatório para Fiscalização
                </Button>
                <Button variant="outline" className="gap-2"
                  onClick={() => window.open("/admin/compliance/relatorio-metodologia", "_blank")}>
                  <FileText size={15} /> Gerar Relatório de Legitimidade Metodológica
                </Button>
              </div>
            </div>

            {simRunning && (
              <div className="text-center py-12 bg-white rounded-xl border">
                <Loader2 size={32} className="mx-auto mb-3 animate-spin text-emerald-500" />
                <p className="font-medium text-slate-700">Cruzando dados da empresa com os critÃ©rios da NR-01...</p>
                <p className="text-xs text-slate-400 mt-1">InventÃ¡rio Â· Plano de aÃ§Ã£o Â· ParticipaÃ§Ã£o Â· CapacitaÃ§Ã£o Â· EvidÃªncias</p>
              </div>
            )}

            {simResult && !simRunning && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: "conformidades", label: "Conformidades",     Icon: CheckCircle2,  bg: "emerald" },
                    { key: "alertas",       label: "Alertas",           Icon: AlertTriangle, bg: "amber" },
                    { key: "nao_conf",      label: "NÃ£o Conformidades", Icon: AlertOctagon,  bg: "rose" },
                  ].map(({ key, label, Icon, bg }) => (
                    <div key={key} className={`bg-${bg}-50 border border-${bg}-200 rounded-xl p-4 text-center`}>
                      <Icon size={22} className={`mx-auto text-${bg}-600 mb-1`} />
                      <div className={`text-2xl font-bold text-${bg}-700`}>{(simResult[key] ?? []).length}</div>
                      <div className={`text-xs font-medium text-${bg}-600`}>{label}</div>
                    </div>
                  ))}
                </div>

                {[
                  { key: "conformidades", title: "âœ… Conformidades",       c: "emerald" },
                  { key: "alertas",       title: "âš ï¸ Alertas",             c: "amber" },
                  { key: "nao_conf",      title: "âŒ NÃ£o Conformidades",   c: "rose" },
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
                            <div className="font-medium text-sm">{item.eixo} â€” {item.check}</div>
                            {item.detail && <div className="text-xs text-slate-500 mt-0.5">{item.detail}</div>}
                            {item.acao  && <div className={`text-xs text-${c}-700 mt-1 font-medium`}>ðŸ’¡ {item.acao}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <Button variant="outline" className="w-full gap-2" onClick={() => window.print()}>
                  <Printer size={15} /> Imprimir RelatÃ³rio da SimulaÃ§Ã£o
                </Button>
              </div>
            )}
          </div>
        )}

        {/* â”€â”€ EVIDÃŠNCIAS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {tab === "evidencias" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-semibold text-lg mb-1">EvidÃªncias Vinculadas NR-01</h2>
              <p className="text-sm text-slate-500">Registros auditÃ¡veis gerados automaticamente â€” disponÃ­veis para fiscalizaÃ§Ãµes e processos judiciais.</p>
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

        {/* â”€â”€ DOSSIÃŠ INDIVIDUAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {tab === "dossie" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border p-5 print:hidden">
              <h2 className="font-semibold text-lg mb-3">DossiÃª Individual do Colaborador</h2>
              <p className="text-sm text-slate-500 mb-4">
                Trilha completa por colaborador: cursos, certificados, aceites eletrÃ´nicos (com IP e timestamp),
                tentativas de quiz e trilha de auditoria.
              </p>
              <div className="flex gap-3 items-center">
                <select className="flex-1 max-w-sm border rounded-lg px-3 py-2 text-sm bg-white"
                  value={dossieUserId ?? ""}
                  onChange={(e) => setDossieUserId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">â€” Selecione um colaborador â€”</option>
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
                      {[["Nome", r.user?.name ?? "â€”"], ["E-mail", r.user?.email ?? "â€”"], ["FunÃ§Ã£o", r.user?.role ?? "â€”"], ["ID", String(r.user?.id ?? "â€”")], ["Cadastro", r.user?.createdAt ? new Date(r.user.createdAt).toLocaleDateString("pt-BR") : "â€”"]].map(([k, v]) => (
                        <div key={k}><div className="text-xs text-slate-400 mb-0.5">{k}</div><div className="font-medium">{v}</div></div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border p-5">
                    <h3 className="font-semibold mb-3 text-sm flex items-center gap-2"><BookOpen size={14} /> Certificados ({r.certs?.length ?? 0})</h3>
                    {!r.certs?.length ? <p className="text-sm text-slate-400">Nenhum certificado emitido.</p> : (
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 text-left"><tr><th className="p-2">CÃ³digo</th><th className="p-2">Curso</th><th className="p-2">Data</th></tr></thead>
                        <tbody>
                          {r.certs.map((c: any) => (
                            <tr key={c.id} className="border-t">
                              <td className="p-2 font-mono">{c.certificateCode}</td>
                              <td className="p-2">Curso #{c.moduleId}</td>
                              <td className="p-2">{c.issuedAt ? new Date(c.issuedAt).toLocaleString("pt-BR") : "â€”"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="bg-white rounded-xl border p-5">
                    <h3 className="font-semibold mb-3 text-sm flex items-center gap-2"><CheckCircle2 size={14} /> Aceites EletrÃ´nicos ({r.acceptances?.length ?? 0})</h3>
                    {!r.acceptances?.length ? <p className="text-sm text-slate-400">Nenhum aceite registrado.</p> : (
                      <div className="space-y-2">
                        {r.acceptances.map((a: any) => (
                          <div key={a.id} className="border rounded-lg p-3 text-xs">
                            <div className="text-slate-400 mb-1">Curso #{a.moduleId} Â· {a.acceptedAt ? new Date(a.acceptedAt).toLocaleString("pt-BR") : "â€”"} Â· IP: {a.ipAddress ?? "â€”"}</div>
                            <p className="italic text-slate-700">"{a.termText}"</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-xl border p-5">
                    <h3 className="font-semibold mb-3 text-sm flex items-center gap-2"><ClipboardCheck size={14} /> AvaliaÃ§Ãµes ({r.attempts?.length ?? 0})</h3>
                    {!r.attempts?.length ? <p className="text-sm text-slate-400">Nenhuma tentativa registrada.</p> : (
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 text-left"><tr><th className="p-2">Quiz</th><th className="p-2">PontuaÃ§Ã£o</th><th className="p-2">Status</th><th className="p-2">Data</th><th className="p-2">IP</th></tr></thead>
                        <tbody>
                          {r.attempts.map((a: any) => (
                            <tr key={a.id} className="border-t">
                              <td className="p-2">#{a.quizId}</td>
                              <td className="p-2">{a.score}%</td>
                              <td className="p-2">{a.passed ? <span className="text-emerald-600 font-medium">Aprovado</span> : <span className="text-rose-600">Reprovado</span>}</td>
                              <td className="p-2">{a.startedAt ? new Date(a.startedAt).toLocaleString("pt-BR") : "â€”"}</td>
                              <td className="p-2 font-mono">{a.ipAddress ?? "â€”"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="bg-white rounded-xl border p-5">
                    <h3 className="font-semibold mb-3 text-sm flex items-center gap-2"><FileSearch size={14} /> Trilha de Auditoria</h3>
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-left"><tr><th className="p-2">Quando</th><th className="p-2">AÃ§Ã£o</th><th className="p-2">Entidade</th><th className="p-2">IP</th></tr></thead>
                      <tbody>
                        {!(r.auditTrail ?? []).length ? (
                          <tr><td colSpan={4} className="p-3 text-center text-slate-400">Nenhum evento registrado.</td></tr>
                        ) : r.auditTrail.map((l: any) => (
                          <tr key={l.id} className="border-t">
                            <td className="p-2">{l.createdAt ? new Date(l.createdAt).toLocaleString("pt-BR") : "â€”"}</td>
                            <td className="p-2 font-mono">{l.action}</td>
                            <td className="p-2">{l.entityType ? `${l.entityType}#${l.entityId}` : "â€”"}</td>
                            <td className="p-2 font-mono">{l.ipAddress ?? "â€”"}</td>
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

        {/* â”€â”€ DOCUMENTOS OFICIAIS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {tab === "documentos" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-semibold text-lg mb-1">Documentos Oficiais NR-01</h2>
              <p className="text-sm text-slate-500">Links diretos para fontes oficiais do MinistÃ©rio do Trabalho e Emprego relacionados Ã  NR-01.</p>
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
              <strong>Aviso:</strong> Links apontam para documentos do MinistÃ©rio do Trabalho e Emprego.
              Se algum link estiver indisponÃ­vel, acesse diretamente{" "}
              <a href="https://www.gov.br/trabalho-e-emprego" target="_blank" rel="noreferrer" className="underline font-medium">www.gov.br/trabalho-e-emprego</a>.
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
