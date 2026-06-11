import AppLayout from "@/components/AppLayout";
import VideoPlayer from "@/components/VideoPlayer";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useParams } from "wouter";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, Award, ArrowLeft, Clock, BookOpen,
  Lock, ChevronRight, Download, FileText
} from "lucide-react";
import { Link } from "wouter";
import AcceptanceTermDialog from "@/components/AcceptanceTermDialog";
import { BlockRenderer } from "@/components/missao/blocks";

function isEmbedVideo(url: string): boolean {
  return url.includes("youtube") || url.includes("youtu.be") || url.includes("vimeo");
}

// ── Block-based lesson player ─────────────────────────────────────────────
function BlockLessonPlayer({
  lessonId,
  moduleId,
  lessonTitle,
  onComplete,
}: {
  lessonId: number;
  moduleId: number;
  lessonTitle: string;
  onComplete: () => void;
}) {
  const { data, isLoading } = trpc.missao.getLessonBlocks.useQuery(
    { lessonId },
    { refetchOnWindowFocus: false }
  );
  const submitBlock = trpc.missao.submitBlockAnswer.useMutation();
  const completeLesson = trpc.missao.completeLesson.useMutation();
  const utils = trpc.useUtils();

  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"idle" | "feedback">("idle");
  const [lastWasCorrect, setLastWasCorrect] = useState<boolean | null>(null);
  const [lastXp, setLastXp] = useState(0);
  const [attempts, setAttempts] = useState<Record<number, number>>({});

  const blocks = data?.blocks ?? [];
  const totalBlocks = blocks.length;
  const currentBlock = blocks[idx];
  const progressPct = totalBlocks > 0 ? Math.round(((idx) / totalBlocks) * 100) : 0;

  // Reset when lesson changes
  useEffect(() => { setIdx(0); setPhase("idle"); setAttempts({}); }, [lessonId]);

  const onAnswer = async (isCorrect: boolean, attempt: number) => {
    if (!currentBlock) return;
    const blockId = currentBlock.id;
    const aCount = (attempts[blockId] ?? 0) + 1;
    setAttempts(prev => ({ ...prev, [blockId]: aCount }));
    try {
      const res = await submitBlock.mutateAsync({ blockId, lessonId, isCorrect, attempt: aCount });
      setLastWasCorrect(isCorrect);
      setLastXp(res.xpEarned ?? 0);
    } catch (e) { setLastWasCorrect(isCorrect); setLastXp(0); }
    // Auto-advance on correct answer (no XP modal). Show feedback only when wrong.
    if (isCorrect) {
      if (idx + 1 >= totalBlocks) {
        try {
          await completeLesson.mutateAsync({ lessonId });
          utils.missao.getUserStats.invalidate();
        } catch {}
        onComplete();
      } else {
        setIdx(prev => prev + 1);
      }
    } else {
      setPhase("feedback");
    }
  };

  const goNext = async () => {
    setPhase("idle");
    setLastWasCorrect(null);
    if (idx + 1 >= totalBlocks) {
      try {
        await completeLesson.mutateAsync({ lessonId });
        utils.missao.getUserStats.invalidate();
      } catch {}
      onComplete();
    } else {
      setIdx(prev => prev + 1);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!totalBlocks) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <BookOpen size={40} className="text-muted-foreground opacity-40" />
        <p className="text-muted-foreground">Esta aula não tem conteúdo disponível.</p>
        <Button onClick={onComplete} variant="outline">Próxima aula</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[420px]">
      {/* Mini progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>{lessonTitle}</span>
          <span>{idx + 1}/{totalBlocks}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Block content */}
      <div className="flex-1 flex items-start justify-center py-2">
        {phase === "idle" && currentBlock && (
          <div className="w-full max-w-xl">
            <BlockRenderer
              key={`${lessonId}-${idx}`}
              type={currentBlock.type}
              data={currentBlock.data}
              onAnswer={onAnswer}
            />
          </div>
        )}
        {phase === "feedback" && (
          <div className="w-full max-w-xl flex flex-col items-center gap-4 pt-8">
            {lastWasCorrect ? (
              <div className="flex flex-col items-center gap-3">
                <CheckCircle2 size={56} className="text-emerald-500" />
                <p className="text-2xl font-extrabold text-emerald-700">
                  {lastXp > 0 ? `+${lastXp} XP` : "Correto!"}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center">
                  <span className="text-2xl">✗</span>
                </div>
                <p className="text-xl font-extrabold text-rose-600">Quase lá!</p>
              </div>
            )}
            <Button
              onClick={goNext}
              className={`mt-4 w-full max-w-xs h-14 rounded-2xl font-bold text-base ${
                lastWasCorrect
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-rose-600 hover:bg-rose-700 text-white"
              }`}
            >
              {idx + 1 >= totalBlocks ? "Concluir aula" : "Continuar"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ModulePlayer ─────────────────────────────────────────────────────
export default function ModulePlayer() {
  const params = useParams<{ id: string }>();
  const moduleId = parseInt(params.id ?? "0");
  const { user } = useAuth();
  const role = (user as any)?.role;
  const isAdminOrRh = role === "admin" || role === "rh" || role === "admin_global";
  const backUrl = isAdminOrRh ? "/admin/modulos" : "/modulos";

  const moduleQuery = trpc.modules.get.useQuery({ id: moduleId }, { enabled: !!moduleId });
  const lessonsQuery = trpc.lessons.listByModule.useQuery({ moduleId }, { enabled: !!moduleId });
  const lessonProgressQuery = trpc.lessons.getModuleProgress.useQuery({ moduleId }, { enabled: !!moduleId });
  const moduleProgressQuery = trpc.progress.getModuleProgress.useQuery({ moduleId }, { enabled: !!moduleId });
  const certQuery = trpc.certificates.download.useQuery({ moduleId }, { enabled: false, retry: false });
  const acceptanceQuery = trpc.audit.getAcceptance.useQuery({ moduleId }, { enabled: !!moduleId });
  const pdfQuery = trpc.aiStudio.getModulePdf.useQuery({ moduleId }, { enabled: !!moduleId, retry: false });

  const utils = trpc.useUtils();

  const [currentLessonId, setCurrentLessonId] = useState<number | null>(null);
  const [hasCert, setHasCert] = useState(false);
  const [showTermDialog, setShowTermDialog] = useState(false);

  const updateLessonProgress = trpc.lessons.updateProgress.useMutation({
    onSuccess: () => {
      utils.lessons.getModuleProgress.invalidate({ moduleId });
      utils.progress.getModuleProgress.invalidate({ moduleId });
      utils.progress.getUserProgress.invalidate();
    },
  });

  const generateCert = trpc.certificates.generate.useMutation({
    onSuccess: () => {
      toast.success("Certificado emitido!");
      utils.certificates.getUserCertificates.invalidate();
      setHasCert(true);
    },
    onError: (e) => toast.error(e.message),
  });

  // Set first lesson as default
  useEffect(() => {
    if (lessonsQuery.data && lessonsQuery.data.length > 0 && currentLessonId === null) {
      setCurrentLessonId(lessonsQuery.data[0].id);
    }
  }, [lessonsQuery.data]);

  // Check cert
  const isModuleCompleted = moduleProgressQuery.data?.isCompleted ?? false;
  useEffect(() => {
    if (isModuleCompleted) {
      certQuery.refetch().then(r => { if (r.data) setHasCert(true); });
    }
  }, [isModuleCompleted]);

  const lessons = lessonsQuery.data ?? [];
  const lessonProgressList = lessonProgressQuery.data ?? [];
  const mod = moduleQuery.data;
  const currentLesson = lessons.find(l => l.id === currentLessonId) ?? null;

  function isLessonCompleted(id: number) {
    return lessonProgressList.find(p => p.lessonId === id)?.isCompleted ?? false;
  }

  function handleLessonComplete() {
    if (!currentLesson) return;
    updateLessonProgress.mutate(
      { lessonId: currentLesson.id, moduleId, percentWatched: 100, isCompleted: true },
      {
        onSuccess: () => {
          toast.success("Aula concluída! +XP");
          const idx = lessons.findIndex(l => l.id === currentLesson.id);
          if (idx >= 0 && idx < lessons.length - 1) {
            setTimeout(() => setCurrentLessonId(lessons[idx + 1].id), 800);
          }
        },
      }
    );
  }

  const completedCount = lessonProgressList.filter(p => p.isCompleted).length;
  const totalLessons = lessons.length;
  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  function handlePrintCert() {
    if (!mod || !user) return;
    const certTitle = (mod as any).certTitle || "Certificado de Conclusão";
    const certBody = (mod as any).certBody || "Este certificado atesta a participação e aprovação no curso indicado, demonstrando o comprometimento com o desenvolvimento profissional e com a saúde, segurança e qualidade de vida no trabalho.";
    const completedAt = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${certTitle}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
<style>* { margin:0;padding:0;box-sizing:border-box; } body{font-family:'Inter',sans-serif;background:#fff;}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
.cert{width:100%;min-height:100vh;padding:40px;background:linear-gradient(135deg,#f5f3ff,#f0f7f4,#e8f4f8);display:flex;align-items:center;justify-content:center;}
.inner{width:100%;max-width:800px;border:3px solid #1e3a5f;border-radius:12px;padding:60px 80px;position:relative;text-align:center;}
.brand{color:#1e3a5f;font-family:'Playfair Display',serif;font-size:14px;font-weight:700;letter-spacing:4px;text-transform:uppercase;margin-bottom:30px;}
.cert-title{font-family:'Playfair Display',serif;font-size:32px;font-weight:700;color:#1e3a5f;margin-bottom:20px;}
.certifies{color:#888;font-size:14px;margin-bottom:10px;}
.name{font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#1e3a5f;border-bottom:2px solid #2d7a5f;display:inline-block;padding-bottom:6px;margin-bottom:16px;}
.body-text{color:#666;font-size:14px;line-height:1.6;margin-bottom:12px;max-width:500px;margin-left:auto;margin-right:auto;}
.module-name{font-family:'Playfair Display',serif;font-size:18px;font-weight:600;color:#2d7a5f;margin-bottom:8px;}
.date{color:#888;font-size:12px;margin-bottom:30px;}
</style></head><body>
<div class="cert"><div class="inner">
<p class="brand">Saúde do Trabalho</p>
<hr style="border-top:1px solid rgba(30,58,95,0.2);margin:20px 0"/>
<p class="cert-title">${certTitle}</p>
<p class="certifies">Certificamos que</p>
<p class="name">${user.name || user.email}</p>
<p class="body-text">${certBody}</p>
<p class="module-name">${mod.title}</p>
<p class="date">Concluído em ${completedAt}</p>
</div></div>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`);
    win.document.close();
  }

  function handleClickEmitCertificate() {
    if (acceptanceQuery.data) generateCert.mutate({ moduleId });
    else setShowTermDialog(true);
  }

  if (moduleQuery.isLoading || lessonsQuery.isLoading) {
    return (
      <AppLayout>
        <div className="p-6 max-w-6xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-1/3" />
            <div className="h-96 bg-muted rounded-xl" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!mod) {
    return (
      <AppLayout>
        <div className="p-6 text-center">
          <p className="text-muted-foreground">Curso não encontrado.</p>
          <Link href={backUrl}><Button className="mt-4">Voltar</Button></Link>
        </div>
      </AppLayout>
    );
  }

  const pdfPath = (pdfQuery.data as any)?.pdfPath;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
        {/* Back */}
        <div className="flex items-center justify-between">
          <Link href={backUrl}>
            <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft size={16} /> Voltar aos Cursos
            </button>
          </Link>
          {pdfPath && (
            <a
              href={pdfPath}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 text-sm font-medium border border-amber-200"
            >
              <Download size={14} /> Baixar PDF do curso
            </a>
          )}
        </div>

        {/* Module header + progress */}
        <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <BookOpen size={18} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-primary leading-snug" style={{ fontFamily: "'Playfair Display', serif" }}>
                {mod.title}
              </h1>
              {mod.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{mod.description}</p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-bold text-primary">{progressPercent}%</p>
              <p className="text-xs text-muted-foreground">{completedCount}/{totalLessons} aulas</p>
            </div>
          </div>
          <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-xl border border-border p-5 shadow-sm min-h-[480px]">
              {currentLesson ? (
                currentLesson.videoUrl ? (
                  /* Video lesson */
                  <div className="space-y-4">
                    <div className="rounded-xl overflow-hidden shadow-lg bg-black">
                      <VideoPlayer
                        url={currentLesson.videoUrl}
                        onTimeUpdate={() => {}}
                        onEnded={() => {
                          updateLessonProgress.mutate({ lessonId: currentLesson.id, moduleId, percentWatched: 100, isCompleted: true });
                        }}
                      />
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold text-lg text-foreground">{currentLesson.title}</h2>
                        {currentLesson.description && (
                          <p className="text-sm text-muted-foreground mt-1">{currentLesson.description}</p>
                        )}
                      </div>
                      {isLessonCompleted(currentLesson.id) && (
                        <div className="flex items-center gap-1 text-green-600 text-sm font-medium flex-shrink-0">
                          <CheckCircle2 size={16} /> Concluída
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Block-based lesson (AI generated) */
                  <BlockLessonPlayer
                    key={currentLesson.id}
                    lessonId={currentLesson.id}
                    moduleId={moduleId}
                    lessonTitle={currentLesson.title}
                    onComplete={handleLessonComplete}
                  />
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
                  <BookOpen size={40} className="opacity-30" />
                  <p>Selecione uma aula na lista para começar</p>
                </div>
              )}
            </div>

            {/* Certificate card */}
            {isModuleCompleted && (
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl border border-amber-200 p-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Award size={24} className="text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">🎉 Curso Concluído!</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {hasCert ? "Certificado emitido — imprima ou baixe abaixo." : "Você concluiu todas as aulas. Emita seu certificado!"}
                    </p>
                  </div>
                  {hasCert ? (
                    <Button onClick={handlePrintCert} className="bg-amber-600 hover:bg-amber-700 text-white gap-2 shrink-0">
                      <Award size={16} /> Imprimir
                    </Button>
                  ) : (
                    <Button onClick={handleClickEmitCertificate} disabled={generateCert.isPending} className="bg-amber-600 hover:bg-amber-700 text-white shrink-0">
                      {generateCert.isPending ? "Gerando..." : "Emitir Certificado"}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div>
            <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden sticky top-4">
              <div className="p-4 border-b border-border">
                <h2 className="font-semibold text-foreground flex items-center gap-2 text-sm">
                  <BookOpen size={15} className="text-primary" /> Aulas do Curso
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">{completedCount}/{totalLessons} concluídas</p>
              </div>
              {lessons.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">Nenhuma aula disponível.</div>
              ) : (
                <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
                  {lessons.map((lesson, i) => {
                    const completed = isLessonCompleted(lesson.id);
                    const isCurrent = currentLessonId === lesson.id;
                    return (
                      <button
                        key={lesson.id}
                        onClick={() => setCurrentLessonId(lesson.id)}
                        className={`w-full text-left p-3 flex items-center gap-3 transition-colors hover:bg-muted/50 ${isCurrent ? "bg-primary/5 border-l-2 border-primary" : ""}`}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold
                          ${completed ? "bg-green-100 text-green-600" : isCurrent ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
                          {completed ? <CheckCircle2 size={13} /> : i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${isCurrent ? "text-primary" : "text-foreground"}`}>
                            {lesson.title}
                          </p>
                          {lesson.durationMinutes ? (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Clock size={10} /> {lesson.durationMinutes} min
                            </p>
                          ) : null}
                        </div>
                        {isCurrent ? <ChevronRight size={13} className="text-primary flex-shrink-0" /> : null}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* PDF in sidebar too */}
              {pdfPath && (
                <div className="p-3 border-t border-border">
                  <a
                    href={pdfPath}
                    target="_blank"
                    rel="noopener"
                    className="flex items-center gap-2 w-full justify-center px-3 py-2 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 text-sm font-medium border border-slate-200"
                  >
                    <FileText size={14} /> Material do curso (PDF)
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        <AcceptanceTermDialog
          moduleId={moduleId}
          moduleTitle={mod.title}
          open={showTermDialog}
          onOpenChange={setShowTermDialog}
          onAccepted={() => {
            utils.audit.getAcceptance.invalidate({ moduleId });
            generateCert.mutate({ moduleId });
          }}
        />
      </div>
    </AppLayout>
  );
}
