import { useParams, Link } from "wouter";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CheckCircle2, Clock, Award, BookOpen, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function AdminStudentHistory() {
  const params = useParams<{ id: string }>();
  const userId = parseInt(params.id ?? "0");

  const historyQ = trpc.admin.studentHistory.useQuery({ userId }, { enabled: !!userId });
  const data = historyQ.data;

  if (historyQ.isLoading) return (
    <AppLayout>
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  );

  if (!data) return (
    <AppLayout>
      <div className="p-6 text-muted-foreground">Historico nao encontrado.</div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Back + header */}
        <div className="flex items-center gap-3">
          <Link href="/admin/usuarios">
            <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors">
              <ArrowLeft size={16} />
            </button>
          </Link>
          <div className="relative pl-4">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary to-transparent" />
            <h1 className="text-2xl font-bold text-primary" style={{ fontFamily: "'Playfair Display', serif" }}>
              Historico do Colaborador
            </h1>
            <p className="text-muted-foreground text-sm">{(data.user as any)?.email} · {(data.user as any)?.name ?? "Sem nome"}</p>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Modulos Iniciados", value: data.progress.length, icon: <BookOpen size={18} className="text-blue-600" />, bg: "bg-blue-50" },
            { label: "Concluidos", value: data.progress.filter((p: any) => p.isCompleted).length, icon: <CheckCircle2 size={18} className="text-green-600" />, bg: "bg-green-50" },
            { label: "Certificados", value: data.certificates.length, icon: <Award size={18} className="text-amber-600" />, bg: "bg-amber-50" },
            { label: "Progresso Medio", value: `${data.progress.length > 0 ? Math.round(data.progress.reduce((a: number, p: any) => a + Number(p.percentWatched), 0) / data.progress.length) : 0}%`, icon: <TrendingUp size={18} className="text-purple-600" />, bg: "bg-purple-50" },
          ].map(kpi => (
            <div key={kpi.label} className="bg-white rounded-xl border border-border p-4 shadow-sm">
              <div className={`w-9 h-9 ${kpi.bg} rounded-lg flex items-center justify-center mb-3`}>{kpi.icon}</div>
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Module progress list */}
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold">Progresso por Modulo</h2>
          </div>
          {data.progress.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">Nenhum modulo iniciado ainda.</div>
          )}
          <div className="divide-y divide-border">
            {data.progress.map((p: any) => (
              <div key={p.moduleId} className="p-4 flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${p.isCompleted ? "bg-green-100" : "bg-muted"}`}>
                  {p.isCompleted ? <CheckCircle2 size={16} className="text-green-600" /> : <Clock size={16} className="text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{p.moduleTitle}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress value={Number(p.percentWatched)} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground flex-shrink-0">{Math.round(Number(p.percentWatched))}%</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.isCompleted ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                    {p.isCompleted ? "Concluido" : "Em andamento"}
                  </span>
                  {p.completedAt && <p className="text-xs text-muted-foreground mt-1">{new Date(p.completedAt).toLocaleDateString("pt-BR")}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Certificates */}
        {data.certificates.length > 0 && (
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="font-semibold">Certificados Emitidos</h2>
            </div>
            <div className="divide-y divide-border">
              {data.certificates.map((c: any) => (
                <div key={c.id} className="p-4 flex items-center gap-4">
                  <Award size={18} className="text-amber-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{c.moduleTitle}</p>
                    <p className="text-xs text-muted-foreground">{new Date(c.issuedAt).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">{c.certificateCode}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
