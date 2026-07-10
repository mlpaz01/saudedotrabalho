import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  AlertCircle, BookOpen, Award, ClipboardList, ArrowRight, PlayCircle, Trophy, HeartHandshake,
  CalendarClock, Video, X,
} from "lucide-react";

// R5-P12 #2 — Lembrete permanente da consulta agendada no perfil do colaborador.
function ConsultaAgendadaBanner() {
  const q = (trpc.scheduling as any).myUpcomingAppointment.useQuery();
  const cancelMut = (trpc.scheduling as any).cancelMyAppointment.useMutation({
    onSuccess: () => { toast.success("Consulta cancelada."); q.refetch?.(); },
    onError: (e: any) => toast.error(e.message),
  });
  const a = q.data;
  if (!a) return null;
  const dt = a.scheduledAt ? new Date(a.scheduledAt) : null;
  const dataStr = dt ? dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }) : "—";
  const horaStr = dt ? dt.toTimeString().slice(0, 5) : "—";
  return (
    <Card className="border-l-4 border-sky-500 bg-sky-50">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <CalendarClock className="w-6 h-6 text-sky-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-sky-900 text-sm mb-1">Você possui uma consulta psicológica agendada</p>
            <div className="text-sm text-sky-900/90 space-y-0.5">
              <div><b className="capitalize">{dataStr}</b> às <b>{horaStr}</b> · {a.durationMinutes} min</div>
              <div>Psicólogo(a): <b>{a.professionalName}</b>{a.specialty ? ` — ${a.specialty}` : ""}</div>
              {a.meetingUrl ? (
                <a href={a.meetingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-700 font-semibold hover:underline mt-1">
                  <Video size={13} /> Entrar na sua consulta
                </a>
              ) : (
                <div className="text-xs text-sky-700/80 mt-1">O link de acesso será enviado ao seu e-mail no dia da consulta.</div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <Link href="/agendar-acolhimento">
                <a className="text-xs font-semibold border border-sky-600 text-sky-700 hover:bg-white px-3 py-1.5 rounded-lg inline-flex items-center gap-1">Visualizar detalhes</a>
              </Link>
              <button
                onClick={() => { if (confirm("Deseja realmente desmarcar/cancelar esta consulta?")) cancelMut.mutate({ id: a.id }); }}
                disabled={cancelMut.isPending}
                className="text-xs font-semibold border border-rose-300 text-rose-700 hover:bg-white px-3 py-1.5 rounded-lg inline-flex items-center gap-1"
              ><X size={13} /> Desmarcar / Cancelar</button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function daysUntil(dt: any): number {
  if (!dt) return Infinity;
  return Math.ceil((new Date(dt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function EmployeeHome() {
  const { user } = useAuth();
  const { data } = trpc.dashboard.employeeHome.useQuery();
  const { data: modules } = trpc.modules.list.useQuery();
  const { data: trails } = trpc.trails.listActive.useQuery();
  const { data: certs } = trpc.certificates.getUserCertificates.useQuery();
  // Bruno R5-P5/Fase3 #1 — Pesquisas reais (eram 0 hardcoded em alguns dashboards)
  const { data: mySurveys } = trpc.surveys.listForUser.useQuery();
  // Bruno R5-P8 #2 — Card de ação preventiva (psicólogo disponível no setor)
  const sectorRisksQ = trpc.riskCorrelation.sectorRisksForUser.useQuery(undefined, { enabled: !!user?.id });
  const sectorAlerts = (sectorRisksQ.data as any)?.alerts ?? [];
  const hasPreventivoCard = sectorAlerts.length > 0;

  const firstName = (user?.name ?? user?.email ?? "Você").split(" ")[0];
  const initial = (user?.name ?? user?.email ?? "U")[0].toUpperCase();

  const nextLesson = data?.nextLesson;
  const certsExpiring = data?.myCertsExpiring ?? [];
  // Bruno R5-P5/Fase3 #2 — Pontuação real = 10 × cursos concluídos + 25 × certificados emitidos.
  // Antes vinha 0 porque `gamificationPoints` nunca foi calculado e ficava no fallback.
  const completedModules = Array.isArray(modules)
    ? (modules as any[]).filter((m: any) => m.percentWatched === 100 || m.isCompleted).length
    : 0;
  const certsCount = Array.isArray(certs) ? (certs as any[]).length : 0;
  const pendingSurveys = Array.isArray(mySurveys) ? (mySurveys as any[]).length : 0;
  const priorSurveys = Array.isArray(mySurveys) ? (mySurveys as any[]).filter((s: any) => s.isPriority).length : 0;
  const points = (data?.gamificationPoints ?? 0) > 0
    ? data?.gamificationPoints
    : completedModules * 10 + certsCount * 25;
  const expiringSoon = certsExpiring.find((c: any) => {
    const d = daysUntil(c.expiresAt);
    return d <= 60 && d >= 0;
  });

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Greeting */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center text-xl font-bold">
            {initial}
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
              Olá, {firstName} 👋
            </h1>
            <p className="text-muted-foreground text-sm">Bem-vindo(a) de volta à sua jornada de aprendizado</p>
          </div>
        </div>

        {/* R5-P12 #2 — lembrete permanente de consulta agendada */}
        <ConsultaAgendadaBanner />

        {/* Bruno R5-P8 #2 — Card preventivo: atendimento psicológico disponível no setor */}
        {hasPreventivoCard && (
          <Card className="border-l-4 border-emerald-500 bg-emerald-50">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <HeartHandshake className="w-6 h-6 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-bold text-emerald-900 mb-2 text-sm">
                    Cuidado com você é prioridade 💚
                  </p>
                  <p className="text-sm text-emerald-800 leading-relaxed mb-3">
                    Como parte das ações preventivas de promoção da saúde ocupacional, foi
                    disponibilizada aos colaboradores do seu setor uma conversa sigilosa com uma
                    psicóloga da plataforma. Esse é um espaço de escuta, orientação e acolhimento,
                    totalmente confidencial.
                  </p>
                  <Link href="/agendar-acolhimento">
                    <Button className="bg-emerald-700 hover:bg-emerald-800 text-white gap-2 text-sm">
                      📅 Agendar atendimento psicológico
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Yellow alert for cert expiring soon */}
        {expiringSoon && (
          <Card className="border-yellow-300 bg-yellow-50">
            <CardContent className="p-4 flex items-center gap-4">
              <AlertCircle className="w-8 h-8 text-yellow-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-yellow-900">
                  Seu certificado de {expiringSoon.moduleTitle} vence em {daysUntil(expiringSoon.expiresAt)} dias
                </p>
                <p className="text-sm text-yellow-700">Refaça o curso para manter-se em conformidade.</p>
              </div>
              <Link href={`/modulos/${expiringSoon.moduleId}`}>
                <Button className="bg-yellow-600 hover:bg-yellow-700 gap-2">
                  Refazer agora <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        
        {/* Bruno R5-P5 #8 — Termo "Jogar" substituído por "Continuar" e tom comercial mais profissional */}
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-white shadow-xl">
          <CardContent className="p-6 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-widest opacity-90 mb-1">Microaprendizado</p>
              <h2 className="text-2xl font-extrabold mb-1">Continuar Aprendizado</h2>
              <p className="text-sm opacity-90">Aulas curtas de 3 min — mantenha sua trilha em dia.</p>
            </div>
            <Link href={nextLesson?.moduleId ? `/missao/curso/${nextLesson.moduleId}` : "/modulos"}>
              <Button variant="secondary" size="lg" className="gap-2 font-extrabold rounded-2xl shadow-lg">
                <PlayCircle className="w-5 h-5" /> Continuar
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Continue de onde parou */}
        {nextLesson && (
          <Card className="bg-gradient-to-r from-primary to-primary/80 text-white">
            <CardContent className="p-5 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide opacity-80 mb-1">Continue de onde parou</p>
                <h2 className="text-lg font-bold mb-2 truncate">{nextLesson.title}</h2>
                <div className="flex items-center gap-3">
                  <Progress value={nextLesson.percentWatched ?? 0} className="h-2 flex-1 bg-white/30" />
                  <span className="text-sm font-bold whitespace-nowrap">{nextLesson.percentWatched ?? 0}%</span>
                </div>
              </div>
              <Link href={(nextLesson as any).isGame ? `/missao/curso/${nextLesson.moduleId}` : `/modulos/${nextLesson.moduleId}`}>
                <Button variant="secondary" size="lg" className="gap-2 font-bold">
                  <PlayCircle className="w-5 h-5" /> Continuar
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Trilhas (horizontal scroll) */}
        {(trails ?? []).length > 0 && (
          <div>
            <h2 className="text-lg font-bold mb-3">Minhas trilhas</h2>
            <div className="flex gap-4 overflow-x-auto pb-3">
              {(trails ?? []).map((t: any) => (
                <Link key={t.id} href="/trilhas">
                  <Card className="w-64 flex-shrink-0 cursor-pointer hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-2 line-clamp-2">{t.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{t.description}</p>
                      <Progress value={0} className="h-1.5" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 3 cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/modulos">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5">
                <BookOpen className="w-8 h-8 text-primary mb-2" />
                <p className="text-2xl font-bold">{(modules ?? []).length}</p>
                <p className="text-sm text-muted-foreground">Meus cursos</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/pesquisas">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5">
                <ClipboardList className="w-8 h-8 text-blue-600 mb-2" />
                <p className="text-2xl font-bold">{pendingSurveys}</p>
                <p className="text-sm text-muted-foreground">
                  Pesquisas pendentes
                  {priorSurveys > 0 && <span className="ml-1 inline-block bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{priorSurveys} obrigatória(s)</span>}
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/certificados">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5">
                <Award className="w-8 h-8 text-yellow-600 mb-2" />
                <p className="text-2xl font-bold">{(certs ?? []).length}</p>
                <p className="text-sm text-muted-foreground">Meus certificados</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Gamification widget */}
        <Card className="bg-gradient-to-r from-amber-50 to-yellow-100 border-yellow-300">
          <CardContent className="p-5 flex items-center gap-4">
            <Trophy className="w-10 h-10 text-amber-600" />
            <div className="flex-1">
              <p className="font-bold text-amber-900">{points} pontos</p>
              <p className="text-xs text-amber-700">Continue completando cursos para ganhar mais!</p>
            </div>
            <Badge className="bg-amber-200 text-amber-900">Nível {Math.floor(points / 100) + 1}</Badge>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
