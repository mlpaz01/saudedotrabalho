import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  AlertCircle, BookOpen, Award, ClipboardList, ArrowRight, PlayCircle, Trophy
} from "lucide-react";

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

  const firstName = (user?.name ?? user?.email ?? "Você").split(" ")[0];
  const initial = (user?.name ?? user?.email ?? "U")[0].toUpperCase();

  const nextLesson = data?.nextLesson;
  const certsExpiring = data?.myCertsExpiring ?? [];
  const points = data?.gamificationPoints ?? 0;
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

        
        {/* Missao CTA - revolutionary microlearning */}
        <Card className="bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-white shadow-xl">
          <CardContent className="p-6 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-widest opacity-90 mb-1">Novo!</p>
              <h2 className="text-2xl font-extrabold mb-1">Continuar Missão</h2>
              <p className="text-sm opacity-90">Microaulas de 3 min, ganhe XP, mantenha sua sequência.</p>
            </div>
            <Link href={nextLesson?.moduleId ? `/missao/curso/${nextLesson.moduleId}` : "/modulos"}>
              <Button variant="secondary" size="lg" className="gap-2 font-extrabold rounded-2xl shadow-lg">
                🎯 Jogar
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
          <Card>
            <CardContent className="p-5">
              <ClipboardList className="w-8 h-8 text-blue-600 mb-2" />
              <p className="text-2xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">Pesquisas pendentes</p>
            </CardContent>
          </Card>
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
