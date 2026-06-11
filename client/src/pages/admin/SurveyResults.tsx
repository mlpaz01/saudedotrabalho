import { useRoute, Link } from "wouter";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle, TrendingUp } from "lucide-react";

export default function SurveyResults() {
  const [, params] = useRoute("/admin/pesquisas/:id/resultados");
  const id = Number(params?.id ?? 0);
  const sQ = trpc.surveys.get.useQuery({ id }, { enabled: !!id });
  const rQ = trpc.surveys.results.useQuery({ id }, { enabled: !!id });

  if (!sQ.data || !rQ.data) return <AppLayout><div className="p-6 text-muted-foreground">Carregando...</div></AppLayout>;
  const s = sQ.data;
  const r = rQ.data;

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Link href="/admin/pesquisas"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft size={14} /> Voltar</Button></Link>
        <div>
          <h1 className="text-2xl font-bold text-primary" style={{ fontFamily: "'Playfair Display', serif" }}>{s.title}</h1>
          <p className="text-muted-foreground text-sm">Resultados da pesquisa</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">Total de respostas</p>
            <p className="text-3xl font-bold text-primary mt-1">{r.totalResponses}</p>
          </div>
          <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="text-xl font-semibold text-primary mt-1 capitalize">{s.status}</p>
          </div>
          <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">Tipo</p>
            <p className="text-xl font-semibold text-primary mt-1">{s.isAnonymous ? "Anônima" : "Identificada"}</p>
          </div>
        </div>

        {/* Critical zones */}
        {r.byQuestion.some((q: any) => q.average !== null && q.average < 2.5 && q.questionType === "likert") && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-red-800">Alertas automáticos</p>
              <ul className="text-sm text-red-700 mt-1 space-y-0.5">
                {r.byQuestion.filter((q: any) => q.average !== null && q.average < 2.5 && q.questionType === "likert").map((q: any) => (
                  <li key={q.questionId}>• Pergunta em zona crítica (média {q.average}/5): "{q.questionText}"</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-border p-6 shadow-sm space-y-5">
          <h2 className="font-semibold flex items-center gap-2"><TrendingUp size={18} /> Resultados por pergunta</h2>
          {r.byQuestion.map((q: any, i: number) => (
            <div key={q.questionId} className="border-t border-border pt-4 first:border-t-0 first:pt-0">
              <p className="text-sm font-medium">{i + 1}. {q.questionText}</p>
              {q.average !== null && (
                <p className={`text-sm mt-1 font-semibold ${q.average < 2.5 ? "text-red-600" : q.average < 3.5 ? "text-yellow-600" : "text-green-600"}`}>Média: {q.average}{q.questionType === "nps" ? " / 10" : " / 5"}</p>
              )}
              <div className="mt-2 space-y-1">
                {(q.distribution ?? []).map((d: any, j: number) => (
                  <div key={j} className="flex items-center gap-2 text-xs">
                    <span className="w-20 truncate text-muted-foreground">{d.v}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${r.totalResponses > 0 ? (Number(d.c) / r.totalResponses) * 100 : 0}%` }} />
                    </div>
                    <span className="w-10 text-right text-muted-foreground">{d.c}</span>
                  </div>
                ))}
                {(q.distribution ?? []).length === 0 && <p className="text-xs text-muted-foreground">Nenhuma resposta ainda.</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
