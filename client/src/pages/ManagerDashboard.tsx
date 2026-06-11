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

  const compliance = data?.mandatoryComplianceRate ?? 0;
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
            <Link href="/admin/modulos">
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
                <p className="text-3xl font-bold">0</p>
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

        {/* Quick actions */}
        <div>
          <h2 className="text-lg font-bold mb-3">Ações rápidas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-100">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <Sparkles className="w-8 h-8 text-amber-600" />
                  <Badge className="bg-amber-200 text-amber-900 text-xs">Em breve</Badge>
                </div>
                <h3 className="font-bold mb-1">🤖 Criar curso com IA</h3>
                <p className="text-xs text-muted-foreground">Gere cursos personalizados em minutos</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-gradient-to-br from-blue-50 to-cyan-100">
              <CardContent className="p-5">
                <ClipboardList className="w-8 h-8 text-blue-600 mb-3" />
                <h3 className="font-bold mb-1">📊 Lançar pesquisa de clima</h3>
                <p className="text-xs text-muted-foreground">Avalie engajamento dos colaboradores</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-gradient-to-br from-green-50 to-emerald-100">
              <CardContent className="p-5">
                <FileText className="w-8 h-8 text-green-600 mb-3" />
                <h3 className="font-bold mb-1">📋 Gerar relatório PGR</h3>
                <p className="text-xs text-muted-foreground">Programa de Gerenciamento de Riscos</p>
              </CardContent>
            </Card>
            <Link href="/admin/usuarios">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-gradient-to-br from-violet-50 to-purple-100">
                <CardContent className="p-5">
                  <UserPlus className="w-8 h-8 text-violet-600 mb-3" />
                  <h3 className="font-bold mb-1">👥 Convidar colaboradores</h3>
                  <p className="text-xs text-muted-foreground">Adicionar novos usuários à plataforma</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Upcoming expirations table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Próximos vencimentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {isLoading ? "Carregando..." : "Nenhum vencimento próximo."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground uppercase">
                      <th className="py-2 px-2">Colaborador</th>
                      <th className="py-2 px-2">Item</th>
                      <th className="py-2 px-2">Vence em</th>
                      <th className="py-2 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcoming.map((row: any) => {
                      const d = daysUntil(row.expiresAt);
                      return (
                        <tr key={row.certId} className="border-b last:border-0">
                          <td className="py-2 px-2">{row.userName ?? row.userEmail}</td>
                          <td className="py-2 px-2">{row.moduleTitle}</td>
                          <td className="py-2 px-2">
                            {row.expiresAt
                              ? (d < 0 ? `Há ${Math.abs(d)} dias` : `${d} dias`)
                              : "—"}
                          </td>
                          <td className="py-2 px-2"><StatusBadge status={row.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-3 text-right">
              <Link href="/admin/vencimentos">
                <Button variant="ghost" size="sm" className="gap-1">
                  Ver todos <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
