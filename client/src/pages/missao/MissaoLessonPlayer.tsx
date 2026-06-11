import { useParams, useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { BlockRenderer } from "@/components/missao/blocks";
import { toast } from "sonner";
import { X, Heart, Trophy, Sparkles, Award, Eye, Loader2, Infinity as InfinityIcon } from "lucide-react";

export default function MissaoLessonPlayer() {
  const params = useParams() as { lessonId: string };
  const lessonId = Number(params.lessonId);
  const [, setLocation] = useLocation();
  const search = useSearch();
  const isPreview = new URLSearchParams(search).get("preview") === "1";

  const { data, isLoading } = trpc.missao.getLessonBlocks.useQuery({ lessonId }, { refetchOnWindowFocus: false });
  const submitBlock = trpc.missao.submitBlockAnswer.useMutation();
  const completeLesson = trpc.missao.completeLesson.useMutation();
  const generateCert = trpc.certificates.generate.useMutation();
  const stats = trpc.missao.getUserStats.useQuery(undefined, { refetchOnWindowFocus: false, enabled: !isPreview });
  const utils = trpc.useUtils();

  const [idx, setIdx] = useState(0);
  const [attempts, setAttempts] = useState<Record<number, number>>({});
  const [phase, setPhase] = useState<"idle" | "feedback" | "done" | "outofhearts">("idle");
  const [correctFlash, setCorrectFlash] = useState<number | null>(null);
  const [lastWasCorrect, setLastWasCorrect] = useState<boolean | null>(null);
  const [lastXp, setLastXp] = useState(0);
  const [heartsLeft, setHeartsLeft] = useState<number>(5);
  const [endStats, setEndStats] = useState<any>(null);
  const [certLoading, setCertLoading] = useState(false);
  // acumuladores locais usados no modo prévia (não toca no backend)
  const previewXp = useRef(0);
  const previewCorrect = useRef(0);

  const blocks = data?.blocks ?? [];
  const totalBlocks = blocks.length;
  const currentBlock = blocks[idx];
  const progressPct = totalBlocks > 0 ? Math.round((idx / totalBlocks) * 100) : 0;
  const moduleId = data?.lesson?.moduleId;
  const backTo = `/missao/curso/${moduleId ?? ""}${isPreview ? "?preview=1" : ""}`;

  useEffect(() => {
    if (!isPreview && stats.data?.hearts !== undefined) setHeartsLeft(stats.data.hearts);
  }, [stats.data?.hearts, isPreview]);

  const onAnswer = async (isCorrect: boolean, attempt: number) => {
    if (!currentBlock) return;
    const blockId = currentBlock.id;
    const aCount = (attempts[blockId] ?? 0) + 1;
    setAttempts({ ...attempts, [blockId]: aCount });

    // Modo prévia: pontuação local, sem consumir vidas nem gravar no banco
    if (isPreview) {
      const xp = isCorrect ? 10 : 0;
      if (isCorrect) { previewXp.current += xp; previewCorrect.current += 1; }
      setLastWasCorrect(isCorrect);
      setLastXp(xp);
      if (isCorrect) {
        setCorrectFlash(xp);
        setTimeout(() => { setCorrectFlash(null); goNext(); }, 900);
      } else {
        setPhase("feedback");
      }
      return;
    }

    let lastXpLocal = 0;
    try {
      const res = await submitBlock.mutateAsync({ blockId, lessonId, isCorrect, attempt: aCount });
      lastXpLocal = res.xpEarned ?? 0;
      setLastWasCorrect(isCorrect);
      setLastXp(lastXpLocal);
      setHeartsLeft(res.heartsLeft ?? heartsLeft);
      if ((res.heartsLeft ?? 5) <= 0 && !isCorrect) {
        setPhase("outofhearts");
        return;
      }
    } catch (e) {
      console.error(e);
    }

    if (isCorrect) {
      // Auto-advance: show brief +XP toast, no click needed
      setCorrectFlash(lastXpLocal);
      setTimeout(() => {
        setCorrectFlash(null);
        goNext();
      }, 900);
    } else {
      setPhase("feedback");
    }
  };

  const goNext = async () => {
    setPhase("idle");
    setLastWasCorrect(null);
    if (idx + 1 >= totalBlocks) {
      if (isPreview) {
        const acc = totalBlocks > 0 ? Math.round((previewCorrect.current / totalBlocks) * 100) : 0;
        setEndStats({ totalXp: previewXp.current, accuracy: acc, courseCompleted: false });
        setPhase("done");
        return;
      }
      // Complete lesson
      try {
        const res = await completeLesson.mutateAsync({ lessonId });
        setEndStats(res);
      } catch (e) { console.error(e); }
      utils.missao.getUserStats.invalidate();
      utils.missao.getCourseStructure.invalidate();
      setPhase("done");
    } else {
      setIdx(idx + 1);
    }
  };

  async function handleGetCertificate() {
    if (!moduleId) return;
    setCertLoading(true);
    try {
      await generateCert.mutateAsync({ moduleId });
      toast.success("Certificado emitido!");
      setLocation("/certificados");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível emitir o certificado.");
    } finally {
      setCertLoading(false);
    }
  }

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-white"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!data || totalBlocks === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4 p-6 bg-white">
        <p className="text-muted-foreground">Esta aula não tem blocos disponíveis.</p>
        <Button onClick={() => setLocation(backTo)} variant="outline">Voltar</Button>
      </div>
    );
  }

  // End-of-lesson card
  if (phase === "done") {
    const courseDone = !!endStats?.courseCompleted && !isPreview;
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 ${courseDone ? "bg-gradient-to-b from-amber-50 to-amber-100" : "bg-gradient-to-b from-amber-50 to-emerald-50"}`}>
        <div className="w-full max-w-md text-center">
          <div className={`w-28 h-28 mx-auto mb-6 rounded-full flex items-center justify-center animate-bounce ${courseDone ? "bg-amber-200 border-4 border-amber-400" : "bg-amber-100 border-4 border-amber-300"}`}>
            {courseDone ? <Award className="w-14 h-14 text-amber-600" /> : <Trophy className="w-14 h-14 text-amber-500" />}
          </div>
          <h1 className="text-3xl font-extrabold mb-2">{courseDone ? "Curso concluído! 🎉" : "Lição concluída!"}</h1>
          <p className="text-muted-foreground mb-6">{data.lesson.title}</p>
          {isPreview && (
            <div className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 bg-sky-100 px-3 py-1 rounded-full">
              <Eye className="w-3.5 h-3.5" /> Modo prévia — progresso não foi salvo
            </div>
          )}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white rounded-2xl p-3 border-2 border-amber-200">
              <Sparkles className="w-5 h-5 text-amber-500 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">XP</p>
              <p className="text-xl font-extrabold text-amber-600">{endStats?.totalXp ?? 0}</p>
            </div>
            <div className="bg-white rounded-2xl p-3 border-2 border-emerald-200">
              <p className="text-xs text-muted-foreground mt-1">Acurácia</p>
              <p className="text-xl font-extrabold text-emerald-600">{endStats?.accuracy ?? 0}%</p>
            </div>
            <div className="bg-white rounded-2xl p-3 border-2 border-rose-200">
              <Heart className="w-5 h-5 text-rose-500 fill-rose-500 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Vidas</p>
              <p className="text-xl font-extrabold text-rose-600">{isPreview ? "∞" : heartsLeft}</p>
            </div>
          </div>

          {courseDone && (
            <Button onClick={handleGetCertificate} disabled={certLoading}
              className="w-full h-14 rounded-2xl font-bold text-base mb-3 bg-amber-500 hover:bg-amber-600 text-white gap-2">
              {certLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Award className="w-5 h-5" />}
              Emitir meu certificado
            </Button>
          )}

          <Button onClick={() => setLocation(backTo)} variant={courseDone ? "outline" : "default"} className="w-full h-14 rounded-2xl font-bold text-base">
            {isPreview ? "Voltar ao curso" : "Continuar Missão"}
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "outofhearts") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-rose-50 to-white">
        <div className="w-full max-w-md text-center">
          <div className="w-28 h-28 mx-auto mb-6 rounded-full bg-rose-100 border-4 border-rose-300 flex items-center justify-center">
            <Heart className="w-14 h-14 text-rose-500" />
          </div>
          <h1 className="text-2xl font-extrabold mb-2">Sem vidas!</h1>
          <p className="text-muted-foreground mb-6">Volte amanhã ou pratique uma lição antiga para recuperar.</p>
          <Button onClick={() => setLocation(backTo)} className="w-full h-14 rounded-2xl font-bold">
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Modo prévia banner */}
      {isPreview && (
        <div className="bg-sky-600 text-white text-center text-xs font-semibold py-1.5 flex items-center justify-center gap-1.5">
          <Eye className="w-3.5 h-3.5" /> Modo prévia — você está experimentando o jogo. Nada será salvo.
        </div>
      )}
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b">
        <div className="max-w-2xl mx-auto px-3 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => { if (isPreview || confirm("Sair da lição? Seu progresso ficará salvo.")) setLocation(backTo); }}>
            <X className="w-5 h-5" />
          </Button>
          <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex items-center gap-1 font-bold text-rose-600">
            <Heart className="w-5 h-5 fill-rose-500 text-rose-500" />
            {isPreview ? <InfinityIcon className="w-5 h-5" /> : <span>{heartsLeft}</span>}
          </div>
        </div>
      </div>

      {/* Block content */}
      <div className="flex-1 p-5 sm:p-8 flex items-start sm:items-center justify-center overflow-y-auto pb-32">
        {phase === "idle" && currentBlock && (
          <BlockRenderer key={currentBlock.id} type={currentBlock.type} data={currentBlock.data} onAnswer={onAnswer} />
        )}
        {phase === "feedback" && (
          <div className="w-full max-w-md mx-auto" />
        )}
      </div>

      {/* Correct flash toast — auto dismisses, no click */}
      {correctFlash !== null && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 animate-bounce">
          <div className="bg-emerald-500 text-white font-extrabold text-xl px-8 py-3 rounded-2xl shadow-xl flex items-center gap-3">
            <span>✓</span>
            <span>{correctFlash > 0 ? `+${correctFlash} XP` : "Correto!"}</span>
          </div>
        </div>
      )}

      {/* Feedback strip — wrong answers only */}
      {phase === "feedback" && (
        <div className={"fixed bottom-0 left-0 right-0 z-20 bg-rose-50 border-t-4 border-rose-500 p-4 sm:p-5"}>
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <div className="flex-1">
              <p className="font-extrabold text-lg text-rose-700">Resposta incorreta</p>
              <p className="text-sm text-rose-600">{isPreview ? "No modo real você perderia 1 vida." : "Você perdeu 1 vida."}</p>
            </div>
            <Button onClick={goNext} className={`h-12 px-8 rounded-2xl font-bold ${lastWasCorrect ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"} text-white`}>
              Continuar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
