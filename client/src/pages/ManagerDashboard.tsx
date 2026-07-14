import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  AlertTriangle, Users, BookOpen, BarChart3, ShieldCheck,
  Sparkles, ClipboardList, FileText, UserPlus, Clock, ArrowRight
} from "lucide-react";

function daysUntil(dt: any): number {
  if (!dt) return Infinity;
  const exp = new Date(dt).getTime();
  return Math.ceil((exp - Date.now()) / (1000 * 60 * 60 * 24));
}

function StatusBadge({ status }: { status: string }) {
  if (status === "expired") return <Badge className="bg-red-500 text-white">Vencido</Badge>;
  if (status === "expiring_soon") return <Badge className="bg-yellow-500 text-white">Vence em breve</Badge>;
  if (status === "valid") return <Badge className="bg-green-500 text-white">Válido</Badge>;
  return <Badge variant="secondary">Sem vencimento</Badge>;
}

export default function ManagerDashboard() {
  const { data, isLoading } = trpc.dashboard.managerOverview.useQuery();
  // Bruno R5-P5 final — usa MESMA fonte da Central de Conformidade NR-01
  // (`compliance.nr01Status` retorna `score`). `compliance.score` antigo dava
  // número diferente (média de completion_percent) e gerava o "10% vs 69%".
  const { data: nr01StatusQ } = trpc.compliance.nr01Status.useQuery();
  const compliance = typeof (nr01StatusQ as any)?.score === "number"
    ? Math.round((nr01StatusQ as any).score)
    : (data?.mandatoryComplianceRate ?? 0);
  // Bruno R5-P5 #4 — Pesquisas em campo eram HARDCODED em 0. Agora vem do overview real.
  const { data: overviewQ } = trpc.analytics.overview.useQuery();
  const surveysCount = Number((overviewQ as any)?.activeSurveys ?? 0);
  const expiring = data?.certsExpiring30d ?? 0;
  const expired = data?.certsExpired ?? 0;
  const totalEmp = data?.totalEmployees ?? 0;
  const activeTrainings = data?.activeTrainings ?? 0;
  const upcoming = data?.upcomingExpirations ?? [];

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
            Painel de Gestão
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral da sua operação de Saúde do Trabalho</p>
        </div>

        {/* Red alert */}
        {(expired > 0 || expiring > 0) && (
          <Card className="border-red-300 bg-red-50">
            <CardContent className="p-4 flex items-center gap-4">
              <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-red-800">
                  ⚠️ {expiring} certificados vencendo em 30 dias · {expired} vencidos
                </p>
                <p className="text-sm text-red-700">Tome ação para manter sua empresa em conformidade.</p>
              </div>
              <Link href="/admin/vencimentos">
                <Button variant="destructive" className="gap-2">
                  Ver detalhes <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* NR-01 compliance hero */}
        <Card className="bg-gradient-to-r from-primary to-primary/80 text-white overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide opacity-80 mb-1">Conformidade NR-01</p>
                <h2 className="text-xl font-bold">Sua empresa está {compliance}% pronta para NR-01</h2>
              </div>
              <ShieldCheck className="w-12 h-12 opacity-80" />
            </div>
            <Progress value={compliance} className="h-3 bg-white/30 mb-3" />
            {/* R5-P9 #2: rota correta é /admin/compliance (App.tsx:206 = ComplianceHub).
                 /admin/conformidade não existe → caía em fallback errado. */}
            <Link href="/admin/compliance">
              <Button variant="secondary" className="gap-2 font-bold">
                Continuar implementação <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-6 h-6 text-primary" />
                <p className="text-3xl font-bold">{totalEmp}</p>
              </div>
              <p className="text-xs text-muted-foreground">Colaboradores Ativos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-2">
                <BookOpen className="w-6 h-6 text-teal-600" />
                <p className="text-3xl font-bold">{activeTrainings}</p>
              </div>
              <p className="text-xs text-muted-foreground">Treinamentos em andamento</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-2">
                <BarChart3 className="w-6 h-6 text-blue-600" />
                <p className="text-3xl font-bold">{surveysCount}</p>
              </div>
              <p className="text-xs text-muted-foreground">Pesquisas em campo</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-2">
                <ShieldCheck className="w-6 h-6 text-green-600" />
                <p className="text-3xl font-bold">{compliance}%</p>
              </div>
              <p className="text-xs text-muted-foreground">Taxa de conformidade</p>
            </CardContent>
          </Card>
        </div>

        {/* R5-P10 #1 — Ações rápidas: atalho de ciclo aponta pra criação real;
            removidos "Agendar psicólogo" (não é da rotina RH) e "Solicitações de colaboradores"
            (exclusivo do Super Admin). */}
        <div>
          <h2 className="text-lg font-bold mb-3">Ações rápidas</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { href: "/admin/analise-risco", icon: "🧠", title: "Novo ciclo psicossocial", color: "from-purple-50 to-violet-100" },
              { href: "/admin/usuarios", icon: "👥", title: "Gerenciar colaboradores", color: "from-violet-50 to-purple-100" },
              { href: "/admin/usuarios?new=1", icon: "➕", title: "Cadastrar colaborador", color: "from-pink-50 to-rose-100" },
              { href: "/admin/campanhas", icon: "📨", title: "Enviar campanhas", color: "from-blue-50 to-cyan-100" },
              { href: "/admin/pesquisas", icon: "📋", title: "Pesquisas psicossociais", color: "from-cyan-50 to-sky-100" },
              { href: "/admin/pesquisas/upload-impresso", icon: "📨", title: "Upload de questionários impressos", color: "from-sky-50 to-blue-100" },
              { href: "/admin/sipat", icon: "🏆", title: "Gerenciar SIPAT", color: "from-amber-50 to-yellow-100" },
              { href: "/admin/visao-360", icon: "📊", title: "Indicadores da empresa", color: "from-green-50 to-emerald-100" },
              { href: "/admin/plano-acao-prazos", icon: "🎯", title: "Plano de ação", color: "from-emerald-50 to-teal-100" },
              { href: "/admin/biblioteca-preventiva", icon: "🛡️", title: "Campanhas preventivas", color: "from-teal-50 to-cyan-100" },
              { href: "/admin/vencimentos", icon: "⏰", title: "Pendências e vencimentos", color: "from-orange-50 to-red-100" },
              { href: "/admin/compliance", icon: "✅", title: "Relatórios gerenciais", color: "from-indigo-50 to-blue-100" },
              { href: "/admin/analises", icon: "📈", title: "Análises detalhadas", color: "from-fuchsia-50 to-pink-100" },
            ].map((a) => (
              <Link key={a.href} href={a.href}>
                <Card className={`hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer bg-gradient-to-br ${a.color} border-0`}>
                  <CardContent className="p-4">
                    <div className="text-2xl mb-1.5">{a.icon}</div>
                    <h3 className="font-semibold text-sm leading-tight">{a.title}</h3>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* R5-P10 #2 — Card "Próximos vencimentos" removido (Bruno: não agrega ao Dashboard RH;
            quem precisa olhar vencimento usa o atalho rápido ou /admin/vencimentos). */}
      </div>
    </AppLayout>
  );
}
