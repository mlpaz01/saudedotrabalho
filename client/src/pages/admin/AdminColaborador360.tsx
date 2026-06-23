import { useState } from "react";
import { useLocation } from "wouter";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft, CalendarPlus, Plus, AlertTriangle, ShieldAlert, Activity,
  TrendingDown, TrendingUp, Minus, Heart, Briefcase, MapPin, Clock,
  Sparkles, FileText, MessageSquareHeart, CheckCircle2, CalendarClock,
  Stethoscope, Brain, Coffee, Users, ClipboardList, RotateCcw,
  BookOpen, Award, ClipboardCheck, Mail, GraduationCap,
  Calculator, ChevronDown,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
} from "recharts";

function initials(name?: string | null) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtMonth(d?: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

// Semantic colors keyed to the wellbeing severity buckets.
const SEV = {
  bom: { ring: "#10b981", text: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", chip: "bg-emerald-100 text-emerald-700" },
  moderado: { ring: "#f59e0b", text: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", chip: "bg-amber-100 text-amber-700" },
  alto: { ring: "#f97316", text: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", chip: "bg-orange-100 text-orange-700" },
  critico: { ring: "#ef4444", text: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200", chip: "bg-rose-100 text-rose-700" },
  neutro: { ring: "#94a3b8", text: "text-slate-500", bg: "bg-slate-50", border: "border-slate-200", chip: "bg-slate-100 text-slate-600" },
} as const;

function sevFor(score: number | null): keyof typeof SEV {
  if (score == null) return "neutro";
  if (score >= 80) return "bom";
  if (score >= 60) return "moderado";
  if (score >= 40) return "alto";
  return "critico";
}

function ScoreCircle({ score }: { score: number | null }) {
  const sev = sevFor(score);
  const color = SEV[sev].ring;
  const pct = score ?? 0;
  const R = 52;
  const C = 2 * Math.PI * R;
  const dash = (pct / 100) * C;
  return (
    <div className="relative w-32 h-32 shrink-0">
      <svg viewBox="0 0 120 120" className="w-32 h-32 -rotate-90">
        <circle cx="60" cy="60" r={R} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={R} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`} style={{ transition: "stroke-dasharray .8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-foreground leading-none">{score ?? "—"}</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">bem-estar</span>
      </div>
    </div>
  );
}

const TECH_ICONS: Record<string, any> = {
  "Escuta ativa": MessageSquareHeart,
  "Pausas programadas": Coffee,
  "Mindfulness": Brain,
  "TCC breve": Brain,
  "Ergonomia cognitiva": Activity,
  "Redistribuição de carga": Users,
  "Encaminhamento clínico": Stethoscope,
  "Reconhecimento e feedback": Sparkles,
};

const JOURNEY_ICONS: Record<string, any> = {
  coaching: Sparkles,
  mood_survey: Heart,
  nr01_assessment: ClipboardList,
  return_leave: RotateCcw,
  conversation: MessageSquareHeart,
  intervention: Activity,
};

const JOURNEY_STATUS: Record<string, { label: string; chip: string }> = {
  concluido: { label: "Concluído", chip: "bg-emerald-100 text-emerald-700" },
  agendado: { label: "Agendado", chip: "bg-blue-100 text-blue-700" },
  em_andamento: { label: "Em andamento", chip: "bg-amber-100 text-amber-700" },
  cancelado: { label: "Cancelado", chip: "bg-slate-100 text-slate-500" },
};

function trendIcon(trend?: string | null) {
  if (trend === "subindo") return <TrendingUp size={14} className="text-emerald-600" />;
  if (trend === "caindo") return <TrendingDown size={14} className="text-rose-600" />;
  return <Minus size={14} className="text-slate-400" />;
}

const SEV_PT: Record<string, string> = { baixo: "Baixo", moderado: "Moderado", alto: "Alto", critico: "Crítico" };
function CalcMemorySection({ cm }: { cm: any }) {
  const [open, setOpen] = useState(false);
  if (!cm) return null;
  return (
    <div className="rounded-2xl border border-border bg-white">
      <button onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-5 py-4 text-left">
        <Calculator size={18} className="text-primary" />
        <span className="font-semibold text-foreground flex-1">Memória de Cálculo e Critérios de Recomendação</span>
        <ChevronDown size={18} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-5 border-t border-border pt-4">
          {/* Como o score foi calculado */}
          <div>
            <div className="text-sm font-semibold text-slate-800 mb-2">Como o Índice de Bem-Estar foi calculado</div>
            <div className="text-sm text-slate-600 mb-2">Parte de <strong>{cm.base}</strong> pontos e desconta penalidades por sinal (penalidade da severidade × peso):</div>
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-slate-500 border-b border-border">
                <th className="text-left py-1.5">Fator avaliado</th><th className="text-left">Severidade</th>
                <th className="text-center">Peso</th><th className="text-right">Penalidade</th></tr></thead>
              <tbody>
                <tr className="border-b border-border/50"><td className="py-1.5 text-slate-700">Base inicial</td><td>—</td><td className="text-center">—</td><td className="text-right text-emerald-600 font-medium">+{cm.base}</td></tr>
                {(cm.signalsApplied ?? []).map((s: any, i: number) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-1.5 text-slate-700">{s.label}{s.value != null ? <span className="text-slate-400"> ({s.value})</span> : null}</td>
                    <td>{SEV_PT[s.severity] ?? s.severity}</td>
                    <td className="text-center">{s.weight}</td>
                    <td className={`text-right font-medium ${s.penalty > 0 ? "text-rose-600" : "text-slate-400"}`}>{s.penalty > 0 ? `−${s.penalty}` : "0"}</td>
                  </tr>
                ))}
                {(cm.signalsApplied ?? []).length === 0 && (
                  <tr><td colSpan={4} className="py-2 text-slate-400 italic text-xs">Sem sinais registrados — índice permanece em {cm.base}.</td></tr>
                )}
                <tr className="font-semibold"><td className="py-1.5 text-slate-900">Índice final</td><td></td><td></td><td className="text-right text-primary text-base">{cm.score}</td></tr>
              </tbody>
            </table>
          </div>
          {/* Criterios de classificacao */}
          <div>
            <div className="text-sm font-semibold text-slate-800 mb-2">Critérios de classificação</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(cm.criteria ?? []).map((c: any, i: number) => {
                const isCurrent = cm.classification?.label === c.label;
                return (
                  <div key={i} className={`text-sm rounded-lg px-3 py-2 border ${isCurrent ? "border-primary bg-primary/5 font-semibold" : "border-border"}`}>
                    <span className="text-slate-500">≥ {c.min}:</span> {c.label}{isCurrent ? " ← atual" : ""}
                  </div>
                );
              })}
            </div>
          </div>
          {/* Dimensoes derivadas */}
          <div>
            <div className="text-sm font-semibold text-slate-800 mb-2">Dimensões derivadas</div>
            <ul className="text-sm text-slate-600 space-y-1">
              <li><strong>Risco de burnout:</strong> {cap(cm.derived?.burnoutRisk?.value)} <span className="text-slate-400">— {cm.derived?.burnoutRisk?.rule}</span></li>
              <li><strong>Carga de trabalho:</strong> {cap(cm.derived?.workloadLevel?.value) || "—"} <span className="text-slate-400">— {cm.derived?.workloadLevel?.rule}</span></li>
              <li><strong>Engajamento:</strong> {cm.derived?.engagementPct?.value != null ? `${cm.derived.engagementPct.value}%` : "—"} <span className="text-slate-400">— {cm.derived?.engagementPct?.rule}</span></li>
            </ul>
          </div>
          {/* Gatilhos da recomendacao */}
          <div>
            <div className="text-sm font-semibold text-slate-800 mb-2">Gatilhos da recomendação automática</div>
            <div className="space-y-2">
              {(cm.triggers ?? []).map((t: any, i: number) => (
                <div key={i} className={`text-sm rounded-lg px-3 py-2 border ${t.active ? "border-amber-300 bg-amber-50" : "border-border opacity-70"}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${t.active ? "bg-amber-200 text-amber-900" : "bg-slate-100 text-slate-500"}`}>{t.active ? "ATIVO" : "inativo"}</span>
                    <span className="text-slate-700">{t.cond}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">→ {t.leadsTo}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">Os critérios acima são aplicados automaticamente pela plataforma. As recomendações não substituem avaliação clínica.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminColaborador360({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const q = trpc.lessons.collaborator360.useQuery({ userId: id }, { enabled: !!id });
  const utils = trpc.useUtils();

  const [showIntervention, setShowIntervention] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  const addIntervention = trpc.lessons.addIntervention.useMutation({
    onSuccess: () => {
      toast.success("Intervenção registrada");
      setShowIntervention(false);
      utils.lessons.collaborator360.invalidate({ userId: id });
    },
    onError: (e) => toast.error(e.message),
  });
  const scheduleConversation = trpc.lessons.scheduleConversation.useMutation({
    onSuccess: () => {
      toast.success("Conversa agendada");
      setShowSchedule(false);
      utils.lessons.collaborator360.invalidate({ userId: id });
    },
    onError: (e) => toast.error(e.message),
  });

  if (q.isLoading) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-muted-foreground">Carregando visão do colaborador…</div>
      </AppLayout>
    );
  }
  if (q.error || !q.data) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-rose-600">{q.error?.message ?? "Colaborador não encontrado"}</div>
      </AppLayout>
    );
  }

  const d = q.data;
  const u = d.user;
  const idx = d.index;
  const sev = idx.severity as keyof typeof SEV;
  const sevc = SEV[sev] ?? SEV.neutro;
  const location = [u.unitName, u.unitCity && u.unitState ? `${u.unitCity}/${u.unitState}` : u.unitCity]
    .filter(Boolean).join(" · ");

  const alertColor =
    d.alert?.level === "critico" ? SEV.critico :
    d.alert?.level === "alto" ? SEV.alto : SEV.moderado;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Back */}
        <button
          onClick={() => setLocation("/admin/usuarios")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} /> Voltar para colaboradores
        </button>

        {/* HERO */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
          <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center">
            <div className="flex items-center gap-5 flex-1 min-w-0">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-white text-2xl font-bold flex items-center justify-center shrink-0">
                {initials(u.name)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-foreground truncate">{u.name}</h1>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${sevc.chip}`}>
                    {idx.statusLabel}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                  <Briefcase size={14} /> {u.cargo ?? "Colaborador"}
                  {u.sectorName ? <span>· {u.sectorName}</span> : null}
                  {u.companyName ? <span>· {u.companyName}</span> : null}
                </div>
                <div className="text-xs text-muted-foreground mt-2 flex items-center gap-4 flex-wrap">
                  {location && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {location}</span>}
                  <span className="inline-flex items-center gap-1"><Clock size={12} /> Último acesso {fmtDate(u.lastSignedIn)}</span>
                  <span className="inline-flex items-center gap-1">{trendIcon(idx.trend)} Tendência {idx.trend ?? "—"}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <ScoreCircle score={idx.score} />
              <div className="flex flex-col gap-2">
                <Button onClick={() => setShowSchedule(true)} className="gap-2">
                  <CalendarPlus size={16} /> Agendar conversa
                </Button>
                <Button variant="outline" onClick={() => setShowIntervention(true)} className="gap-2">
                  <Plus size={16} /> Nova intervenção
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* INTELLIGENT ALERT */}
        {d.alert && (
          <div className={`rounded-2xl border ${alertColor.border} ${alertColor.bg} p-5 flex gap-4`}>
            <div className={`shrink-0 ${alertColor.text}`}>
              {d.alert.level === "critico" ? <ShieldAlert size={28} /> : <AlertTriangle size={28} />}
            </div>
            <div className="flex-1">
              <div className={`font-semibold ${alertColor.text}`}>{d.alert.title}</div>
              <p className="text-sm text-slate-700 mt-1 leading-relaxed">{d.alert.message}</p>
              <div className="flex gap-2 mt-3 flex-wrap">
                {d.alert.actions?.map((a: string) => (
                  <button
                    key={a}
                    onClick={() => {
                      if (a === "Agendar conversa") setShowSchedule(true);
                      else if (a === "Roteiro de conversa")
                        window.open("/pdfs/roteiro-conversa.pdf", "_blank");
                      else if (a === "Protocolo NR-01")
                        window.open("/pdfs/protocolo-nr01.pdf", "_blank");
                      else toast.info(`${a}: abrindo material de apoio…`);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-border hover:border-primary/40 hover:text-primary inline-flex items-center gap-1.5"
                  >
                    <FileText size={13} /> {a}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MEMÓRIA DE CÁLCULO E CRITÉRIOS DE RECOMENDAÇÃO */}
        <CalcMemorySection cm={d.calcMemory} />

        {/* KPI ROW */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Risco de burnout" value={cap(idx.burnoutRisk)} tone={idx.burnoutRisk} icon={<Brain size={18} />} />
          <KpiCard label="Carga de trabalho" value={cap(idx.workloadLevel)} tone={workloadTone(idx.workloadLevel)} icon={<Activity size={18} />} />
          <KpiCard label="Engajamento" value={idx.engagementPct != null ? `${idx.engagementPct}%` : "—"} tone={engTone(idx.engagementPct)} icon={<Heart size={18} />} />
          <KpiCard label="Sem afastar há" value={idx.daysWithoutLeave != null ? `${idx.daysWithoutLeave} dias` : "—"} tone="baixo" icon={<CalendarClock size={18} />} />
        </div>

        {/* EVOLUTION CHART */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Evolução do índice de bem-estar</h2>
            <span className="text-xs text-muted-foreground">Últimos {d.history.length} meses</span>
          </div>
          {d.history.length === 0 ? (
            <Empty>Sem histórico suficiente.</Empty>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={d.history.map((h: any) => ({ mes: fmtMonth(h.month), score: h.score }))}>
                  <defs>
                    <linearGradient id="wbgrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={sevc.ring} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={sevc.ring} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} width={28} />
                  <RTooltip formatter={(v: any) => [`${v}`, "Índice"]} />
                  <Area type="monotone" dataKey="score" stroke={sevc.ring} strokeWidth={3} fill="url(#wbgrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CARE JOURNEY */}
          <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
            <h2 className="font-semibold text-foreground mb-4">Jornada de cuidado</h2>
            {d.journey.length === 0 ? (
              <Empty>Nenhum evento registrado.</Empty>
            ) : (
              <ol className="relative border-l-2 border-slate-100 ml-3 space-y-5">
                {d.journey.map((e: any) => {
                  const Ic = JOURNEY_ICONS[e.type] ?? Activity;
                  const st = JOURNEY_STATUS[e.status] ?? JOURNEY_STATUS.concluido;
                  return (
                    <li key={e.id} className="ml-6">
                      <span className="absolute -left-[11px] w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center ring-4 ring-white">
                        <Ic size={11} />
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{e.title}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${st.chip}`}>{st.label}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{fmtDate(e.date)}</div>
                      {e.description && <p className="text-xs text-slate-600 mt-1">{e.description}</p>}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* PROTOCOLS + NEXT STEPS */}
          <div className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-5">
            <div>
              <h2 className="font-semibold text-foreground mb-3">Técnicas e protocolos aplicados</h2>
              {d.interventions.length === 0 ? (
                <Empty>Nenhuma técnica aplicada ainda.</Empty>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {d.interventions.map((it: any) => {
                    const Ic = TECH_ICONS[it.technique] ?? CheckCircle2;
                    return (
                      <span key={it.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-primary/5 text-primary border border-primary/15">
                        <Ic size={13} /> {it.technique}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Sparkles size={15} className="text-amber-500" /> Próximos passos sugeridos
              </h3>
              {d.nextSteps.length === 0 ? (
                <Empty>Sem sugestões no momento.</Empty>
              ) : (
                <ul className="space-y-2">
                  {d.nextSteps.map((s: any) => (
                    <li key={s.id} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 size={15} className="text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-medium text-foreground">{s.technique}</span>
                        {s.notes && <span className="text-muted-foreground"> — {s.notes}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* LEAVE HISTORY */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
          <h2 className="font-semibold text-foreground mb-4">Histórico de afastamentos</h2>
          {d.leaves.length === 0 ? (
            <Empty>Nenhum afastamento registrado.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="py-2 pr-4 font-medium">Período</th>
                    <th className="py-2 pr-4 font-medium">Motivo</th>
                    <th className="py-2 pr-4 font-medium">Grupo CID</th>
                    <th className="py-2 font-medium text-right">Dias</th>
                  </tr>
                </thead>
                <tbody>
                  {d.leaves.map((l: any) => (
                    <tr key={l.id} className="border-b border-slate-50">
                      <td className="py-2.5 pr-4">{fmtDate(l.startDate)} → {fmtDate(l.endDate)}</td>
                      <td className="py-2.5 pr-4">{l.reason ?? "—"}</td>
                      <td className="py-2.5 pr-4">
                        {l.cidGroup ? <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-mono">{l.cidGroup}</span> : "—"}
                      </td>
                      <td className="py-2.5 text-right font-medium">{l.days ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-3">
            Por conformidade com a LGPD, exibimos apenas o grupo CID (não o diagnóstico individual). Esta visão é restrita a perfis de saúde/RH autorizados.
          </p>
        </div>

        {/* DESENVOLVIMENTO E FORMAÇÃO */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
          <h2 className="font-semibold text-foreground mb-1 flex items-center gap-2">
            <GraduationCap size={18} className="text-primary" /> Desenvolvimento e formação
          </h2>
          <p className="text-xs text-muted-foreground mb-5">Progresso em cursos, pesquisas respondidas e certificados emitidos.</p>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cursos */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <BookOpen size={15} className="text-primary" /> Cursos
                <span className="text-xs font-normal text-muted-foreground">({d.courses.length})</span>
              </h3>
              {d.courses.length === 0 ? (
                <Empty>Nenhum curso iniciado.</Empty>
              ) : (
                <div className="space-y-3">
                  {d.courses.map((c: any) => {
                    const pct = c.isCompleted ? 100 : Math.round(c.percentWatched);
                    return (
                      <div key={c.moduleId} className="border border-border rounded-lg p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-foreground truncate">{c.moduleTitle}</span>
                          <span className={`text-xs font-semibold shrink-0 ${c.isCompleted ? "text-emerald-600" : "text-amber-600"}`}>{pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 mt-2 overflow-hidden">
                          <div className={`h-full rounded-full ${c.isCompleted ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1.5">
                          {c.isCompleted ? `Concluído em ${fmtDate(c.completedAt)}` : `Último acesso ${fmtDate(c.lastWatchedAt)}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pesquisas */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <ClipboardCheck size={15} className="text-primary" /> Pesquisas respondidas
                <span className="text-xs font-normal text-muted-foreground">({d.surveys.length})</span>
              </h3>
              {d.surveys.length === 0 ? (
                <Empty>Nenhuma pesquisa respondida.</Empty>
              ) : (
                <div className="space-y-2">
                  {d.surveys.map((s: any) => (
                    <div key={s.surveyId} className="border border-border rounded-lg p-3">
                      <div className="text-sm font-medium text-foreground">{s.surveyTitle}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{fmtDate(s.submittedAt)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Certificados */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Award size={15} className="text-primary" /> Certificados
                <span className="text-xs font-normal text-muted-foreground">({d.certificates.length})</span>
              </h3>
              {d.certificates.length === 0 ? (
                <Empty>Nenhum certificado emitido.</Empty>
              ) : (
                <div className="space-y-2">
                  {d.certificates.map((c: any) => (
                    <div key={c.id} className="border border-border rounded-lg p-3">
                      <div className="text-sm font-medium text-foreground">{c.moduleTitle}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                        <span className="font-mono">{c.certificateCode}</span>
                        <span>· emitido {fmtDate(c.issuedAt)}</span>
                        {c.expiresAt && <span>· válido até {fmtDate(c.expiresAt)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-border text-sm text-muted-foreground flex items-center gap-2">
            <Mail size={14} /> {u.email ?? "—"}
          </div>
        </div>
      </div>

      {/* Nova intervenção dialog */}
      <InterventionDialog
        open={showIntervention}
        onClose={() => setShowIntervention(false)}
        onSubmit={(technique, notes) => addIntervention.mutate({ userId: id, technique, notes: notes || undefined })}
        loading={addIntervention.isPending}
      />
      {/* Agendar conversa dialog */}
      <ScheduleDialog
        open={showSchedule}
        onClose={() => setShowSchedule(false)}
        onSubmit={(title, eventDate, description) =>
          scheduleConversation.mutate({ userId: id, title: title || undefined, eventDate, description: description || undefined })
        }
        loading={scheduleConversation.isPending}
      />
    </AppLayout>
  );
}

function cap(s?: string | null) {
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function workloadTone(w?: string | null) {
  if (w === "critica") return "critico";
  if (w === "alta") return "alto";
  if (w === "media") return "moderado";
  return "baixo";
}
function engTone(p?: number | null) {
  if (p == null) return "neutro";
  if (p >= 75) return "baixo";
  if (p >= 50) return "moderado";
  return "alto";
}

function KpiCard({ label, value, tone, icon }: { label: string; value: string; tone?: string | null; icon: React.ReactNode }) {
  const c = SEV[(tone as keyof typeof SEV)] ?? SEV.neutro;
  return (
    <div className="bg-white rounded-2xl border border-border shadow-sm p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={c.text}>{icon}</span>
      </div>
      <div className={`text-xl font-bold mt-2 ${c.text}`}>{value}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-muted-foreground py-4 text-center">{children}</div>;
}

const TECHNIQUE_OPTIONS = [
  "Escuta ativa", "Pausas programadas", "Mindfulness", "TCC breve",
  "Ergonomia cognitiva", "Redistribuição de carga", "Encaminhamento clínico", "Reconhecimento e feedback",
];

function InterventionDialog({ open, onClose, onSubmit, loading }: any) {
  const [technique, setTechnique] = useState(TECHNIQUE_OPTIONS[0]);
  const [notes, setNotes] = useState("");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova intervenção</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Técnica / protocolo</Label>
            <select
              value={technique}
              onChange={(e) => setTechnique(e.target.value)}
              className="w-full mt-1 h-10 rounded-md border border-border px-3 text-sm bg-white"
            >
              {TECHNIQUE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <Label>Observações (opcional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contexto da intervenção…" className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSubmit(technique, notes)} disabled={loading}>
            {loading ? "Salvando…" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleDialog({ open, onClose, onSubmit, loading }: any) {
  const [title, setTitle] = useState("Conversa de acompanhamento");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");

  // Also try to book via the new scheduling system
  const profQuery = trpc.scheduling.listProfessionals.useQuery({}, { enabled: open });
  const [profId, setProfId] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState("");
  const slotsQuery = trpc.scheduling.getAvailableSlots.useQuery(
    { professionalId: profId ?? 0, date },
    { enabled: !!profId && !!date }
  );
  const bookMut = trpc.scheduling.bookAppointment.useMutation({
    onSuccess: () => { toast.success("Conversa agendada com sucesso!"); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const profs = profQuery.data ?? [];
  const slots = slotsQuery.data ?? [];

  function handleBook() {
    if (!date) { toast.error("Informe a data"); return; }
    if (profId && selectedTime) {
      bookMut.mutate({ professionalId: profId, date, time: selectedTime, notes: description || undefined });
    } else {
      // Fallback to old calendar-note approach
      if (!date) { toast.error("Informe a data"); return; }
      onSubmit(title, date, description);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Agendar conversa de acolhimento</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {profs.length > 0 && (
            <div>
              <Label>Profissional</Label>
              <select
                value={profId ?? ""}
                onChange={e => { setProfId(Number(e.target.value) || null); setSelectedTime(""); }}
                className="w-full mt-1 h-10 rounded-md border border-border px-3 text-sm bg-white"
              >
                <option value="">— Selecione um profissional —</option>
                {profs.map(p => <option key={p.id} value={p.id}>{p.name}{p.specialty ? ` (${p.specialty})` : ""}</option>)}
              </select>
            </div>
          )}
          <div>
            <Label>Data</Label>
            <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setSelectedTime(""); }} className="mt-1" />
          </div>
          {profId && date && slots.length > 0 && (
            <div>
              <Label>Horário disponível</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {slots.map(s => (
                  <button
                    key={s}
                    onClick={() => setSelectedTime(s)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${selectedTime === s ? "bg-primary text-white border-primary" : "border-slate-200 hover:border-primary"}`}
                  >{s}</button>
                ))}
              </div>
            </div>
          )}
          {profId && date && slots.length === 0 && !slotsQuery.isLoading && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">Nenhum horário disponível nesta data. Escolha outra data.</p>
          )}
          {(!profId || profs.length === 0) && (
            <>
              <div>
                <Label>Título</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
              </div>
            </>
          )}
          <div>
            <Label>Observações (opcional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Objetivo da conversa…" className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleBook} disabled={loading || bookMut.isPending || (!!profId && !selectedTime)}>
            {loading || bookMut.isPending ? "Agendando…" : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

