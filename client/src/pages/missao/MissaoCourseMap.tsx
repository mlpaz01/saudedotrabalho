import { useParams, useLocation, useSearch, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import HeartsXpHud from "@/components/missao/HeartsXpHud";
import { ArrowLeft, BookOpen, Check, Lock, Play, Shield, HardHat, Brain, Heart, AlertTriangle, Flame, Zap, Hammer, Eye } from "lucide-react";

const ICONS: Record<string, any> = {
  shield: Shield, hardhat: HardHat, book: BookOpen, brain: Brain, heart: Heart,
  alert: AlertTriangle, flame: Flame, electrical: Zap, hammer: Hammer, warning: AlertTriangle,
};

export default function MissaoCourseMap() {
  const params = useParams() as { moduleId: string };
  const moduleId = Number(params.moduleId);
  const [, setLocation] = useLocation();
  const search = useSearch();
  const isPreview = new URLSearchParams(search).get("preview") === "1";
  const { data, isLoading } = trpc.missao.getCourseStructure.useQuery({ moduleId }, { refetchOnWindowFocus: false });

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <p className="text-muted-foreground">Curso não encontrado.</p>
        <Link href="/inicio"><Button variant="outline">Voltar</Button></Link>
      </div>
    );
  }

  // Determine current (first not-completed) lesson
  const flatLessons = (data.units ?? []).flatMap(u => u.lessons.map(l => ({ ...l, unitTitle: u.title })));
  const currentIdx = flatLessons.findIndex(l => l.progress?.status !== "completed");

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      {/* Modo prévia banner */}
      {isPreview && (
        <div className="bg-sky-600 text-white text-center text-xs font-semibold py-1.5 flex items-center justify-center gap-1.5">
          <Eye className="w-3.5 h-3.5" /> Modo prévia — todas as aulas liberadas para você experimentar o jogo.
        </div>
      )}
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation(isPreview ? "/admin/ai-studio" : "/inicio")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-base truncate">{data.module.title}</h1>
            <p className="text-xs text-muted-foreground truncate">{data.module.description}</p>
          </div>
          {!isPreview && <HeartsXpHud compact />}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {data.units.map((unit, uIdx) => {
          const Icon = ICONS[unit.icon] ?? BookOpen;
          return (
            <div key={unit.id} className="mb-10">
              {/* Unit header */}
              <div className="flex items-center gap-3 mb-6 bg-primary/90 text-white rounded-2xl p-4 shadow-md">
                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-7 h-7" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider opacity-80">Unidade {uIdx + 1}</p>
                  <h2 className="font-bold text-lg leading-tight">{unit.title}</h2>
                  {unit.description && <p className="text-sm opacity-80 mt-0.5 line-clamp-1">{unit.description}</p>}
                </div>
              </div>

              {/* Lessons as snake path */}
              <div className="flex flex-col items-center gap-3">
                {unit.lessons.map((lesson, lIdx) => {
                  const globalIdx = flatLessons.findIndex(l => l.id === lesson.id);
                  const status = lesson.progress?.status ?? "not_started";
                  const isCompleted = status === "completed";
                  const isCurrent = globalIdx === currentIdx;
                  const isLocked = !isPreview && globalIdx > currentIdx && !isCompleted && currentIdx !== -1;
                  const offset = lIdx % 2 === 0 ? "-translate-x-12" : "translate-x-12";

                  let nodeCls = "bg-white border-4 border-muted-foreground/20 text-muted-foreground";
                  let label: any = <Play className="w-7 h-7" />;
                  if (isCompleted) { nodeCls = "bg-emerald-500 border-4 border-emerald-600 text-white shadow-lg"; label = <Check className="w-8 h-8" />; }
                  else if (isCurrent) { nodeCls = "bg-amber-400 border-4 border-amber-500 text-white shadow-xl animate-pulse"; label = <Play className="w-7 h-7 fill-white" />; }
                  else if (isLocked) { nodeCls = "bg-muted border-4 border-muted-foreground/20 text-muted-foreground/60"; label = <Lock className="w-6 h-6" />; }

                  return (
                    <div key={lesson.id} className={`flex items-center gap-3 transform ${offset} transition`}>
                      <button
                        onClick={() => !isLocked && setLocation(`/missao/aula/${lesson.id}${isPreview ? "?preview=1" : ""}`)}
                        disabled={isLocked}
                        className={`w-20 h-20 rounded-full flex items-center justify-center font-bold text-2xl ${nodeCls} ${!isLocked ? "active:scale-95" : ""}`}
                      >
                        {label}
                      </button>
                      <div className="max-w-[180px]">
                        <p className={`text-sm font-bold leading-tight ${isLocked ? "text-muted-foreground/60" : ""}`}>{lesson.title}</p>
                        <p className="text-xs text-muted-foreground">{lesson.estimatedMinutes ?? 3} min</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="text-center py-8 text-sm text-muted-foreground">
          🎯 Continue avançando, uma aula por dia!
        </div>
      </div>
    </div>
  );
}

