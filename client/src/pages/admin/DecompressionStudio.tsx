import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Sparkles, Loader2, CheckCircle2, AlertTriangle, Wind, Brain,
  Activity, MessageCircle, Target, Zap, ChevronRight
} from "lucide-react";

const THEMES = [
  { value: "breathing", label: "Respiração", icon: Wind, desc: "Padrões guiados (4-7-8, box)" },
  { value: "meditation", label: "Meditação", icon: Brain, desc: "Roteiros guiados curtos" },
  { value: "stretching", label: "Alongamento", icon: Activity, desc: "Sequência de movimentos" },
  { value: "reflection", label: "Reflexão", icon: MessageCircle, desc: "Perguntas para pausar e pensar" },
  { value: "focus", label: "Foco", icon: Target, desc: "Reset mental + grounding 5-4-3-2-1" },
  { value: "energy", label: "Energia", icon: Zap, desc: "Micro-pausa energizante" },
];
const TONES = [
  { value: "calm", label: "Calmo" },
  { value: "energizing", label: "Energizante" },
  { value: "reflective", label: "Reflexivo" },
];

export default function DecompressionStudio() {
  const [, setLocation] = useLocation();
  const [theme, setTheme] = useState<any>("breathing");
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [tone, setTone] = useState<any>("calm");
  const [customPrompt, setCustomPrompt] = useState("");

  const [generationId, setGenerationId] = useState<number | null>(null);
  const [percent, setPercent] = useState(0);
  const [message, setMessage] = useState("");
  const [isFailed, setIsFailed] = useState(false);
  const [generatedActivityId, setGeneratedActivityId] = useState<number | null>(null);

  const generateMut = trpc.decompressionStudio.generate.useMutation({
    onSuccess: (data: any) => { setGenerationId(data.generationId); setIsFailed(false); },
    onError: (e: any) => toast.error(e.message || "Erro ao iniciar geração"),
  });

  const statusQ = trpc.decompressionStudio.getStatus.useQuery(
    { id: Number(generationId) },
    { enabled: !!generationId, refetchInterval: generationId ? 2000 : false }
  );

  useEffect(() => {
    const d: any = statusQ.data;
    if (!d) return;
    setPercent(d.progressPercent ?? 0);
    setMessage(d.progressMessage ?? "");
    if (d.status === "done") {
      setGeneratedActivityId(d.generatedActivityId);
      toast.success("Atividade criada!");
    } else if (d.status === "failed") {
      setIsFailed(true);
    }
  }, [statusQ.data]);

  const isGenerating = !!generationId && !generatedActivityId && !isFailed;
  const isDone = !!generatedActivityId;

  function start() {
    setGenerationId(null);
    setGeneratedActivityId(null);
    setIsFailed(false);
    setPercent(0);
    setMessage("");
    generateMut.mutate({ theme, durationMinutes, tone, customPrompt: customPrompt.trim() || undefined });
  }

  function reset() {
    setGenerationId(null);
    setGeneratedActivityId(null);
    setIsFailed(false);
    setPercent(0);
    setMessage("");
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="relative pl-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500 to-transparent rounded-full" />
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            <Sparkles className="text-emerald-500" size={22} /> Estúdio de Descompressão
          </h1>
          <p className="text-sm text-muted-foreground">Gere atividades de pausa, respiração e bem-estar com IA</p>
        </div>

        {isDone ? (
          <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-8 text-center space-y-4">
            <CheckCircle2 size={48} className="text-emerald-500 mx-auto" />
            <h2 className="text-xl font-bold text-emerald-700">Atividade criada!</h2>
            <p className="text-muted-foreground">A atividade foi salva e está disponível na área de Descompressão.</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={reset} variant="outline">Gerar outra</Button>
              <Button onClick={() => setLocation("/admin/descompressao")} className="bg-primary text-primary-foreground gap-2">
                Ver atividade <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        ) : isFailed ? (
          <div className="bg-white rounded-2xl border border-rose-200 shadow-sm p-8 text-center space-y-4">
            <AlertTriangle size={48} className="text-rose-500 mx-auto" />
            <h2 className="text-xl font-bold text-rose-700">Falha na geração</h2>
            <p className="text-sm text-muted-foreground">{message || "Tente novamente."}</p>
            <Button onClick={reset} variant="outline">Tentar novamente</Button>
          </div>
        ) : isGenerating ? (
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 shadow-sm p-8 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center">
                <Loader2 size={22} className="text-white animate-spin" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-emerald-900">{message || "Gerando atividade..."}</p>
                <p className="text-xs text-emerald-700">{percent}% concluído</p>
              </div>
            </div>
            <div className="h-3 bg-white/60 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500 rounded-full" style={{ width: `${percent}%` }} />
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-5">
            <div>
              <label className="text-sm font-semibold mb-2 block">Tema</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {THEMES.map(t => {
                  const Icon = t.icon;
                  const active = theme === t.value;
                  return (
                    <button key={t.value} type="button" onClick={() => setTheme(t.value)}
                      className={`text-left rounded-xl border p-3 transition-all ${active ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-300" : "border-border hover:border-emerald-200 hover:bg-emerald-50/30"}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Icon size={14} className={active ? "text-emerald-600" : "text-muted-foreground"} />
                        <span className="text-xs font-semibold">{t.label}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{t.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold mb-2 block">Duração (min)</label>
                <input type="number" min={1} max={30} value={durationMinutes}
                  onChange={e => setDurationMinutes(parseInt(e.target.value || "5"))}
                  className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm" />
              </div>
              <div>
                <label className="text-sm font-semibold mb-2 block">Tom</label>
                <select value={tone} onChange={e => setTone(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm">
                  {TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold mb-2 block">Orientação adicional (opcional)</label>
              <Textarea rows={2} placeholder="Ex: focar em alívio para dor cervical de quem trabalha no computador"
                value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} />
            </div>

            <Button onClick={start} disabled={generateMut.isPending}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white gap-2 h-12 text-base font-semibold">
              {generateMut.isPending ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
              Gerar atividade com IA
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
