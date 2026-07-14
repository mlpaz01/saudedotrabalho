import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import {
  Activity, Users, ClipboardList, BookOpen, CheckCircle2, TrendingUp, HeartHandshake, Clock,
} from "lucide-react";

/**
 * Bruno R5-P8 #2 — Painel da Chefia com linguagem preventiva (sem termos de risco).
 * Mostra ações disponíveis ao colaborador chefia sem expor terminologia clínica.
 */
export default function ChefiaDashboard() {
  const { user } = useAuth();
  const sectorId = (user as any)?.sectorId;
  const [showCourses, setShowCourses] = useState(false);

  const sectorRisksQ = trpc.riskCorrelation.sectorRisksForUser.useQuery(
    { userId: user?.id },
    { enabled: !!user?.id }
  );
  const planoQ = trpc.riskCorrelation.coursesPlanoAcao.useQuery(
    { sectorId },
    { enabled: !!sectorId }
  );
  const dashQ = trpc.riskCorrelation.cycleDashboard.useQuery();

  const sectorData = sectorRisksQ.data as any;
  const planoData = planoQ.data as any;
  const dashData = dashQ.data as any;

  const sectorName = sectorData?.sectorName || "—";
  const cycle = sectorData?.cycle;
  const alerts = sectorData?.alerts ?? [];
  const hasActions = alerts.length > 0;

  const prio = planoData?.prioritarios ?? [];
  const overdue = prio.filter((p: any) => p.isOverdue);
  const due15 = prio.filter((p: any) => !p.isOverdue && p.daysLeft !== null && p.daysLeft <= 15);
  const onTime = prio.filter((p: any) => !p.isOverdue && (p.daysLeft === null || p.daysLeft > 15));

  const mySector = (dashData?.rankingSetores ?? []).find((s: any) => s.id === sectorId);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-5">
        <header>
          <h1
            className="text-2xl font-bold flex items-center gap-2"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            <Activity size={22} className="text-purple-600" />
            Painel de Gestão — {sectorName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão do seu setor.{" "}
            {cycle ? (
              <>
                Referência: <b>{cycle.name}</b>
              </>
            ) : (
              "Aguardando ciclo de avaliação."
            )}
          </p>
        </header>

        {/* KPIs principais — linguagem neutra */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border rounded-xl p-4">
            <div className="text-xs uppercase font-bold text-slate-500">Ações preventivas ativas</div>
            <div className="text-3xl font-extrabold text-purple-700 mt-1">{prio.length}</div>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <div className="text-xs uppercase font-bold text-slate-500">Conteúdos prioritários</div>
            <div className="text-3xl font-extrabold text-amber-700 mt-1">{prio.length}</div>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <div className="text-xs uppercase font-bold text-slate-500">Prazo crítico</div>
            <div className="text-3xl font-extrabold text-rose-700 mt-1">{overdue.length + due15.length}</div>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <div className="text-xs uppercase font-bold text-slate-500">Saúde ocupacional</div>
            <div
              className="text-3xl font-extrabold mt-1"
              style={{
                color: mySector
                  ? mySector.healthPercent >= 70
                    ? "#10b981"
                    : mySector.healthPercent >= 50
                    ? "#f59e0b"
                    : "#dc2626"
                  : "#94a3b8",
              }}
            >
              {mySector ? `${mySector.healthPercent}%` : "—"}
            </div>
          </div>
        </div>

        {/* Bloco de ações preventivas — linguagem exata do Bruno */}
        {hasActions && (
          <section className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-5">
            <div className="flex items-start gap-3 mb-4">
              <HeartHandshake size={24} className="text-emerald-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h2 className="font-bold text-emerald-900 text-base mb-1">
                  Ações preventivas de saúde disponíveis no seu setor
                </h2>
                <p className="text-sm text-emerald-800 leading-relaxed">
                  Como parte das ações preventivas de promoção da saúde ocupacional, foi
                  disponibilizada aos colaboradores do seu setor uma conversa sigilosa com uma
                  psicóloga da plataforma. Esse é um espaço de escuta, orientação e acolhimento,
                  totalmente confidencial.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/agendar-acolhimento">
                <a className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors">
                  📅 Agendar atendimento psicológico
                </a>
              </Link>
              {prio.length > 0 && (
                <button
                  onClick={() => setShowCourses(v => !v)}
                  className="inline-flex items-center gap-2 border border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
                >
                  <BookOpen size={14} />
                  {showCourses ? "Ocultar conteúdos" : `Ver ${prio.length} conteúdos disponíveis`}
                </button>
              )}
            </div>

            {showCourses && prio.length > 0 && (
              <div className="mt-4 space-y-1.5">
                {prio.slice(0, 8).map((c: any) => (
                  <Link key={c.moduleId} href={`/modulos/${c.moduleId}`}>
                    <a className="flex items-center gap-2 text-sm text-emerald-900 hover:text-emerald-700 py-1 border-b border-emerald-100 last:border-0">
                      <BookOpen size={12} className="flex-shrink-0 text-emerald-600" />
                      <span className="flex-1">{c.moduleTitle}</span>
                      {c.daysLeft !== null && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            c.isOverdue
                              ? "bg-rose-100 text-rose-800"
                              : c.daysLeft <= 15
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {c.isOverdue
                            ? `${Math.abs(c.daysLeft)}d vencido`
                            : `${c.daysLeft}d restantes`}
                        </span>
                      )}
                    </a>
                  </Link>
                ))}
                {prio.length > 8 && (
                  <Link href="/admin/plano-acao-prazos">
                    <a className="text-xs text-emerald-700 hover:underline block mt-1">
                      Ver todos os {prio.length} conteúdos →
                    </a>
                  </Link>
                )}
              </div>
            )}
          </section>
        )}

        {/* Plano de Ação — resumo de prazos */}
        {prio.length > 0 && (
          <section className="bg-white border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-base flex items-center gap-2">
                <Clock size={16} className="text-amber-600" /> Cronograma preventivo do setor
              </h2>
              <Link href="/admin/plano-acao-prazos">
                <a className="text-xs text-sky-700 hover:underline">Ver detalhes →</a>
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="bg-rose-50 border border-rose-200 rounded p-3 text-center">
                <div className="text-xs font-bold text-rose-800">PRAZO VENCIDO</div>
                <div className="text-2xl font-extrabold text-rose-700">{overdue.length}</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-center">
                <div className="text-xs font-bold text-amber-800">VENCE EM 15 DIAS</div>
                <div className="text-2xl font-extrabold text-amber-700">{due15.length}</div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-center">
                <div className="text-xs font-bold text-emerald-800">NO PRAZO</div>
                <div className="text-2xl font-extrabold text-emerald-700">{onTime.length}</div>
              </div>
            </div>
          </section>
        )}

        {/* R5-P11 #5 — atalhos restaurados; Campanhas é leitura pra Chefia (backend libera read). */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Link href="/admin/plano-acao-prazos">
            <a className="block bg-white border rounded-xl p-4 hover:shadow-md transition-all">
              <Clock size={22} className="text-amber-600 mb-2" />
              <div className="font-semibold text-sm">Prazos do plano de ação</div>
              <div className="text-xs text-slate-500">Conteúdos vencidos, próximos do vencimento e no prazo</div>
            </a>
          </Link>
          <Link href="/admin/campanhas">
            <a className="block bg-white border rounded-xl p-4 hover:shadow-md transition-all">
              <ClipboardList size={22} className="text-purple-600 mb-2" />
              <div className="font-semibold text-sm">Campanhas do setor</div>
              <div className="text-xs text-slate-500">Comunicados, cursos e pesquisas enviados (leitura)</div>
            </a>
          </Link>
        </section>

        {/* Sem dados */}
        {!hasActions && !planoQ.isLoading && (
          <div className="bg-white border rounded-xl p-8 text-center">
            <CheckCircle2 size={36} className="text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-emerald-800">
              Nenhuma ação preventiva ativa no momento.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Assim que houver dados do ciclo de avaliação, as ações aparecem aqui automaticamente.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
