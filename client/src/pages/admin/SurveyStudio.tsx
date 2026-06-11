import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Sparkles, Loader2, CheckCircle2, AlertTriangle, BarChart3,
  ClipboardList, Brain, Frown, ShieldAlert, GraduationCap, Edit3, ChevronRight
} from "lucide-react";

const TYPES = [
  { value: "climate", label: "Clima organizacional", icon: BarChart3, desc: "Liderança, carga, reconhecimento" },
  { value: "psychosocial", label: "Riscos psicossociais NR-01", icon: ShieldAlert, desc: "Conforme NR-01 atualizada" },
  { value: "burnout", label: "Burnout (MBI)", icon: Frown, desc: "Exaustão emocional, despersonalização" },
  { value: "harassment", label: "Assédio moral/sexual", icon: AlertTriangle, desc: "Anônima por padrão" },
  { value: "knowledge", label: "Quiz de conhecimento", icon: GraduationCap, desc: "Múltipla escolha com resposta correta" },
  { value: "custom", label: "Personalizada", icon: Edit3, desc: "Descreva o que precisa" },
];

export default function SurveyStudio() {
  const [, setLocation] = useLocation();
  const [topic, setTopic] = useState("");
  const [surveyType, setSurveyType] = useState<any>("climate");
  const [questionCount, setQuestionCount] = useState(10);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [publishImmediately, setPublishImmediately] = useState(true);

  const [generationId, setGenerationId] = useState<number | null>(null);
  const [percent, setPercent] = useState(0);
  const [message, setMessage] = useState("");
  const [isFailed, setIsFailed] = useState(false);
  const [generatedSurveyId, setGeneratedSurveyId] = useState<number | null>(null);

  const generateMut = trpc.surveyStudio.generate.useMutation({
    onSuccess: (data: any) => { setGenerationId(data.generationId); setIsFailed(false); },
    onError: (e: any) => toast.error(e.message || "Erro ao iniciar geração"),
  });

  const statusQ = trpc.surveyStudio.getStatus.useQuery(
    { id: Number(generationId) },
    { enabled: !!generationId, refetchInterval: generationId ? 2000 : false }
  );

  useEffect(() => {
    const d: any = statusQ.data;
    if (!d) return;
    setPercent(d.progressPercent ?? 0);
    setMessage(d.progressMessage ?? "");
    if (d.status === "done") {
      setGeneratedSurveyId(d.generatedSurveyId);
      toast.success("Pesquisa criada!");
    } else if (d.status === "failed") {
      setIsFailed(true);
    }
  }, [statusQ.data]);

  const isGenerating = !!generationId && !generatedSurveyId && !isFailed;
  const isDone = !!generatedSurveyId;

  function start() {
    if (!topic.trim() || topic.trim().length < 5) {
      toast.error("Descreva o tema com pelo menos 5 caracteres");
      return;
    }
    setGenerationId(null);
    setGeneratedSurveyId(null);
    setIsFailed(false);
    setPercent(0);
    setMessage("");
    generateMut.mutate({ topic: topic.trim(), surveyType, questionCount, isAnonymous, publishImmediately });
  }

  function reset() {
    setGenerationId(null);
    setGeneratedSurveyId(null);
    setIsFailed(false);
    setPercent(0);
    setMessage("");
    setTopic("");
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="relative pl-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-500 to-transparent rounded-full" />
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            <Sparkles className="text-amber-500" size={22} /> Estúdio de Pesquisas
          </h1>
          <p className="text-sm text-muted-foreground">Gere pesquisas completas com IA · clima, burnout, NR-01, quizzes</p>
        </div>

        {isDone ? (
          <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-8 text-center space-y-4">
            <CheckCircle2 size={48} className="text-emerald-500 mx-auto" />
            <h2 className="text-xl font-bold text-emerald-700">Pesquisa criada com sucesso!</h2>
            <p className="text-muted-foreground">Sua pesquisa foi salva como rascunho. Revise as perguntas e publique quando estiver pronta.</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={reset} variant="outline">Gerar outra</Button>
              <Button onClick={() => setLocation("/admin/pesquisas")} className="bg-primary text-primary-foreground gap-2">
                Ver pesquisa <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        ) : isFailed ? (
          <div className="bg-white rounded-2xl border border-rose-200 shadow-sm p-8 text-center space-y-4">
            <AlertTriangle size={48} className="text-rose-500 mx-auto" />
            <h2 className="text-xl font-bold text-rose-700">Falha na geração</h2>
            <p className="text-sm text-muted-foreground">{message || "Tente novamente em alguns instantes."}</p>
            <Button onClick={reset} variant="outline">Tentar novamente</Button>
          </div>
        ) : isGenerating ? (
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 shadow-sm p-8 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center">
                <Loader2 size={22} className="text-white animate-spin" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-900">{message || "Gerando pesquisa..."}</p>
                <p className="text-xs text-amber-700">{percent}% concluído</p>
              </div>
            </div>
            <div className="h-3 bg-white/60 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500 rounded-full" style={{ width: `${percent}%` }} />
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-5">
            {/* Type selector */}
            <div>
              <label className="text-sm font-semibold mb-2 block">Tipo de pesquisa</label>
              <div className="grid grid-cols-2 gap-2">
                {TYPES.map(t => {
                  const Icon = t.icon;
                  const active = surveyType === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setSurveyType(t.value)}
                      className={`text-left rounded-xl border p-3 transition-all ${active ? "border-amber-400 bg-amber-50 ring-1 ring-amber-300" : "border-border hover:border-amber-200 hover:bg-amber-50/30"}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon size={14} className={active ? "text-amber-600" : "text-muted-foreground"} />
                        <span className="text-xs font-semibold">{t.label}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{t.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Topic */}
            <div>
              <label className="text-sm font-semibold mb-2 block">Tema / contexto</label>
              <Textarea
                rows={3}
                placeholder="Ex: Avaliar clima após reorganização da área comercial, com foco em comunicação e reconhecimento"
                value={topic}
                onChange={e => setTopic(e.target.value)}
              />
            </div>

            {/* Question count + anonymous */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold mb-2 block">Nº de perguntas</label>
                <Input type="number" min={3} max={50} value={questionCount} onChange={e => setQuestionCount(parseInt(e.target.value || "10"))} />
              </div>
              <div>
                <label className="text-sm font-semibold mb-2 block">Anônima?</label>
                <label className="flex items-center gap-2 h-10 cursor-pointer">
                  <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)} className="w-4 h-4 accent-amber-500" />
                  <span className="text-sm">Respostas anônimas</span>
                </label>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={publishImmediately} onChange={e => setPublishImmediately(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
                <span className="text-sm font-medium text-emerald-900">Publicar imediatamente</span>
                <span className="text-xs text-emerald-700 ml-auto">{publishImmediately ? "Funcionários verão e poderão responder" : "Ficará como rascunho até você publicar"}</span>
              </label>
            </div>

            <Button onClick={start} disabled={generateMut.isPending} className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white gap-2 h-12 text-base font-semibold">
              {generateMut.isPending ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
              Gerar pesquisa com IA
            </Button>

            {surveyType === "knowledge" && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800 flex items-center gap-2">
                <Brain size={14} /> Distribuição da resposta correta será aleatória entre A/B/C/D
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
