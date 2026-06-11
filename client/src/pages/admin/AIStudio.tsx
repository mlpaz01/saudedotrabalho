import { useState, useEffect, useRef } from "react";


import AppLayout from "@/components/AppLayout";


import { trpc } from "@/lib/trpc";


import { Button } from "@/components/ui/button";


import { Input } from "@/components/ui/input";


import { Textarea } from "@/components/ui/textarea";


import { toast } from "sonner";


import {


  Sparkles, Wand2, CheckCircle2, Loader2, XCircle,


  BookOpen, Eye, ChevronDown, History, Pause, Gamepad2, Play,


} from "lucide-react";


import {


  Dialog, DialogContent, DialogHeader, DialogTitle,


} from "@/components/ui/dialog";





const STAGES = [


  { label: "Estrutura",    threshold: 10 },


  { label: "Aulas",        threshold: 70 },


  { label: "Questionario", threshold: 82 },


  { label: "Certificados", threshold: 95 },


  { label: "Finalizando",  threshold: 100 },


];





function stageIcon(done: boolean, isActive: boolean) {


  if (done) return <CheckCircle2 size={14} className="text-green-600"/>;


  if (isActive) return <Loader2 size={14} className="animate-spin text-amber-600"/>;


  return <Pause size={14} className="text-muted-foreground/40"/>;


}





export default function AIStudio() {


  const [prompt, setPrompt] = useState("");


  const [level, setLevel] = useState("intermediario");


  const [duration, setDuration] = useState("30");


  const [jobId, setJobId] = useState<string | null>(null);


  const [isGenerating, setIsGenerating] = useState(false);


  const [isDone, setIsDone] = useState(false);


  const [isFailed, setIsFailed] = useState(false);


  const [percent, setPercent] = useState(0);


  const [message, setMessage] = useState("");


  const [historyOpen, setHistoryOpen] = useState(false);
  const [seenLessons, setSeenLessons] = useState<string[]>([]);
  const [previewOutline, setPreviewOutline] = useState<any>(null);
  const [generatedModuleId, setGeneratedModuleId] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [dotCount, setDotCount] = useState(0);
  const startTimeRef = useRef<number>(0);

  // Parse progress messages to extract lesson titles for live preview
  useEffect(() => {
    if (!isGenerating) { setSeenLessons([]); return; }
    const m = message.match(/Criando aula \d+\/\d+: "(.+?)"/);
    if (m) {
      const title = m[1];
      setSeenLessons(prev => prev.includes(title) ? prev : [...prev, title]);
    }
  }, [message, isGenerating]);


  // Elapsed timer — ticks every second while generating
  useEffect(() => {
    if (isGenerating) {
      startTimeRef.current = Date.now();
      setElapsed(0);
      setDotCount(0);
      const t = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
        setDotCount(d => (d + 1) % 4);
      }, 1000);
      return () => clearInterval(t);
    }
  }, [isGenerating]);

  function fmtElapsed(s: number) {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s/60)}m ${s%60}s`;
  }

  const [previewId, setPreviewId] = useState<number | null>(null);


  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);





  const generateMutation = trpc.aiStudio.generate.useMutation({


    onSuccess: (data: any) => {


      setJobId(data.generationId);


      setIsGenerating(true);


      setPercent(0);


      setMessage("Iniciando geração...");


    },


    onError: (e: any) => toast.error(e.message),


  });





  const historyQuery = trpc.aiStudio.list.useQuery(undefined, { refetchInterval: isGenerating ? 5000 : false });





  const statusQuery = trpc.aiStudio.getStatus.useQuery(


    { id: Number(jobId) },


    {


      enabled: !!jobId && isGenerating,


      refetchInterval: isGenerating ? 2000 : false,


    }


  );





  useEffect(() => {


    if (!statusQuery.data) return;


    const d = statusQuery.data as any;


    setPercent(d.progressPercent ?? 0);


    setMessage(d.progressMessage ?? "");
    if (d.generatedModuleId) setGeneratedModuleId(d.generatedModuleId);


    if (d.status === "done") {


      setIsGenerating(false);


      setIsDone(true);


      historyQuery.refetch();


    } else if (d.status === "failed") {


      setIsGenerating(false);


      setIsFailed(true);


    }


  }, [statusQuery.data]);





  function handleGenerate() {


    if (!prompt.trim()) { toast.error("Descreva o curso"); return; }


    setIsDone(false);


    setIsFailed(false);


    setJobId(null);


    generateMutation.mutate({


      prompt: prompt.trim(),


      level,


      targetDurationMinutes: parseInt(duration) || 30,


    });


  }





  function reset() {


    setIsGenerating(false);


    setIsDone(false);


    setIsFailed(false);


    setJobId(null);


    setPercent(0);


    setMessage("");


  }





  const history = historyQuery.data ?? [];





  const previewQuery = trpc.aiStudio.get.useQuery(


    { id: previewId! },


    { enabled: previewId !== null }


  );





  return (


    <AppLayout>


      <div className="p-6 max-w-4xl mx-auto space-y-6">





        {/* Header */}


        <div className="relative pl-4">


          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-amber-500 to-transparent" />


          <div className="flex items-center gap-2">


            <Sparkles size={22} className="text-amber-500" />


            <h1 className="text-3xl font-bold text-primary" style={{ fontFamily: "'Playfair Display', serif" }}>


              Estúdio de Criação


            </h1>


          </div>


        </div>





        {/* Main content area */}


        {isDone ? (


          <div className="bg-white rounded-2xl border border-green-200 shadow-sm p-8 text-center space-y-4">


            <CheckCircle2 size={48} className="text-green-500 mx-auto" />


            <h2 className="text-xl font-bold text-green-700">Curso gerado com sucesso!</h2>


            <p className="text-muted-foreground">O curso foi criado e está disponível em Cursos.</p>


            <div className="flex gap-3 justify-center flex-wrap">


              <Button onClick={reset} variant="outline">Gerar outro</Button>

              {generatedModuleId && (
                <Button onClick={() => window.location.href = `/plataforma/missao/curso/${generatedModuleId}?preview=1`} className="bg-sky-600 hover:bg-sky-700 text-white gap-2">
                  <Gamepad2 size={16} /> Pré-visualizar jogo
                </Button>
              )}

              <Button onClick={() => window.location.href = generatedModuleId ? `/plataforma/modulos/${generatedModuleId}` : '/plataforma/admin/modulos'} className="bg-primary text-primary-foreground gap-2">


                <BookOpen size={16} /> Ver Cursos


              </Button>


            </div>


          </div>


        ) : isFailed ? (


          <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-8 text-center space-y-4">


            <XCircle size={48} className="text-red-500 mx-auto" />


            <h2 className="text-xl font-bold text-red-700">Falha na geração</h2>


            <p className="text-muted-foreground">{message || "Ocorreu um erro ao gerar o curso."}</p>


            <Button onClick={reset} variant="outline">Tentar novamente</Button>


          </div>


        ) : isGenerating ? (


          <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">


            {/* Top: course being built */}


            <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4">


              <p className="text-white/70 text-xs font-medium uppercase tracking-wider mb-1">Gerando curso</p>


              <p className="text-white font-bold text-lg leading-tight">{prompt.length > 70 ? prompt.slice(0,70)+'...' : prompt}</p>


            </div>





            {/* Body: 2 columns */}


            <div className="flex gap-0 min-h-[320px]">


              {/* Left: vertical steps */}


              <div className="w-48 flex-shrink-0 border-r border-border p-4 space-y-1">


                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Etapas</p>


                {STAGES.map((s, i) => {


                  const done = percent >= s.threshold;


                  const currentIdx = STAGES.findIndex(x => x.threshold > percent);


                  const isActive = i === currentIdx;


                  return (


                    <div key={s.label} className={`flex items-center gap-2.5 px-2 py-2 rounded-lg transition-colors ${isActive ? 'bg-amber-50 border border-amber-200' : ''}`}>


                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-green-100' : isActive ? 'bg-amber-100' : 'bg-muted'}`}>


                        {stageIcon(done, isActive)}


                      </div>


                      <span className={`text-sm font-medium ${done ? 'text-green-700' : isActive ? 'text-amber-700 font-semibold' : 'text-muted-foreground'}`}>{s.label}</span>


                    </div>


                  );


                })}


              </div>





              {/* Right: progress detail + live preview */}
              <div className="flex-1 p-6 flex flex-col gap-5 min-h-0">
                {/* Animated progress */}
                <div className="flex items-center gap-4">
                  <div className="relative flex-shrink-0">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30 animate-pulse">
                      <Wand2 className="text-white" size={24}/>
                    </div>
                    <div className="absolute inset-0 rounded-full border-4 border-amber-300/40 animate-ping"/>
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm font-semibold text-primary leading-snug">
                      {message || "Processando"}{".".repeat(dotCount)}
                    </p>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div style={{width:`${Math.max(percent, 3)}%`}} className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-700"/>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Loader2 size={10} className="animate-spin"/>
                        Em andamento — {fmtElapsed(elapsed)}
                      </span>
                      <span className="font-bold text-amber-600">{percent}%</span>
                    </div>
                  </div>
                </div>
                {/* Phase-aware live preview */}
                <div className="flex-1 min-h-0 overflow-y-auto space-y-2">

                  {/* Phase 1: Estrutura — show unit/lesson tree */}
                  {percent >= 10 && percent < 70 && previewOutline?.units?.length > 0 && seenLessons.length === 0 && (
                    <div className="border border-border rounded-xl overflow-hidden">
                      <div className="bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border flex items-center gap-1.5">
                        <BookOpen size={11}/> Estrutura do curso
                      </div>
                      <div className="divide-y divide-border max-h-48 overflow-y-auto">
                        {previewOutline.units.map((unit: any, ui: number) => (
                          <div key={ui} className="px-3 py-2">
                            <p className="text-xs font-semibold text-primary mb-1">Unidade {ui+1}: {unit.title}</p>
                            <div className="space-y-0.5 pl-2">
                              {(unit.lessonTitles ?? []).map((lt: string, li: number) => (
                                <div key={li} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <div className="w-1 h-1 rounded-full bg-amber-400 flex-shrink-0"/>
                                  {lt}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Phase 2: Aulas — show lessons being created */}
                  {seenLessons.length > 0 && (
                    <div className="border border-border rounded-xl overflow-hidden">
                      <div className="bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border flex items-center gap-1.5">
                        <CheckCircle2 size={11} className="text-green-500"/> Aulas geradas ({seenLessons.length})
                      </div>
                      <div className="divide-y divide-border max-h-48 overflow-y-auto">
                        {seenLessons.map((title: string, i: number) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-2">
                            <CheckCircle2 size={12} className="text-green-500 flex-shrink-0"/>
                            <span className="text-xs text-foreground truncate">{title}</span>
                          </div>
                        ))}
                        {percent < 72 && (
                          <div className="flex items-center gap-2 px-3 py-2">
                            <Loader2 size={12} className="text-amber-500 animate-spin flex-shrink-0"/>
                            <span className="text-xs text-muted-foreground italic">Gerando próxima aula...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Phase 3: Avaliação */}
                  {percent >= 72 && percent < 82 && (
                    <div className="border border-amber-200 rounded-xl bg-amber-50 px-4 py-3 flex items-center gap-3">
                      <Loader2 size={16} className="text-amber-500 animate-spin flex-shrink-0"/>
                      <div>
                        <p className="text-xs font-semibold text-amber-700">Criando avaliação final</p>
                        <p className="text-xs text-amber-600 mt-0.5">5 questões de múltipla escolha sobre todo o conteúdo</p>
                      </div>
                    </div>
                  )}

                  {/* Phase 4: PDF */}
                  {percent >= 82 && percent < 100 && (
                    <div className="border border-blue-200 rounded-xl bg-blue-50 px-4 py-3 flex items-center gap-3">
                      <Loader2 size={16} className="text-blue-500 animate-spin flex-shrink-0"/>
                      <div>
                        <p className="text-xs font-semibold text-blue-700">Gerando PDF do curso</p>
                        <p className="text-xs text-blue-600 mt-0.5">Compilando todo o conteúdo em documento</p>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          </div>

        ) : (


          /* Generation form */


          <div className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-5">


            <div>


              <label className="text-sm font-semibold mb-1.5 block">Descreva o curso que deseja criar *</label>


              <Textarea


                placeholder="Ex: Curso sobre gestão do estresse para equipes de saúde, abordando técnicas de respiração, mindfulness e comunicação não-violenta..."


                value={prompt}


                onChange={e => setPrompt(e.target.value)}


                rows={4}


                className="resize-none"


              />


            </div>


            <div className="grid grid-cols-2 gap-4">


              <div>


                <label className="text-sm font-semibold mb-1.5 block">Nível</label>


                <select


                  value={level}


                  onChange={e => setLevel(e.target.value)}


                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"


                >


                  <option value="iniciante">Iniciante</option>


                  <option value="intermediario">Intermediário</option>


                  <option value="avancado">Avançado</option>


                </select>


              </div>


              <div>


                <label className="text-sm font-semibold mb-1.5 block">Duração (minutos)</label>


                <Input


                  type="number"


                  min="10"


                  max="120"


                  value={duration}


                  onChange={e => setDuration(e.target.value)}


                />


              </div>


            </div>


            <Button


              onClick={handleGenerate}


              disabled={generateMutation.isPending || !prompt.trim()}


              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold gap-2 h-11"


            >


              <Sparkles size={18} />


              {generateMutation.isPending ? "Iniciando..." : "Gerar Curso com IA"}


            </Button>


          </div>


        )}





        {/* History */}


        {history.length > 0 && (


          <div className="bg-white rounded-2xl border border-border shadow-sm">


            <button onClick={() => setHistoryOpen(v => !v)} className="w-full flex items-center justify-between p-4 hover:bg-muted/30 rounded-2xl transition-colors">


              <div className="flex items-center gap-2">


                <History size={16} className="text-muted-foreground"/>


                <span className="font-semibold text-sm text-foreground">Gerações recentes</span>


                <span className="bg-muted text-muted-foreground text-xs rounded-full px-2 py-0.5">{history.length}</span>


              </div>


              <ChevronDown size={16} className={`text-muted-foreground transition-transform ${historyOpen ? 'rotate-180' : ''}`}/>


            </button>


            {historyOpen && (


              <div className="border-t border-border divide-y divide-border">


                {history.map((g: any) => (


                  <div key={g.id} className="flex items-center gap-3 px-4 py-3">


                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${g.status==='done'?'bg-green-500':g.status==='failed'?'bg-red-500':'bg-amber-500 animate-pulse'}`}/>


                    <div className="flex-1 min-w-0">


                      <p className="text-sm font-medium text-foreground truncate">{g.prompt}</p>


                      <p className="text-xs text-muted-foreground">{g.targetDurationMinutes} min · {g.level} · {new Date(g.createdAt).toLocaleDateString('pt-BR')}</p>


                    </div>


                    {g.status==='done' && (


                      <button onClick={() => setPreviewId(g.id)} className="text-xs text-primary hover:underline flex items-center gap-1 flex-shrink-0"><Eye size={12}/> Ver</button>


                    )}

                    {g.status==='done' && g.generatedModuleId && (
                      <button onClick={() => window.location.href = `/plataforma/missao/curso/${g.generatedModuleId}?preview=1`} className="text-xs text-sky-600 hover:underline flex items-center gap-1 flex-shrink-0"><Play size={12}/> Jogar</button>
                    )}


                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${g.status==='done'?'bg-green-100 text-green-700':g.status==='failed'?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700'}`}>


                      {g.status==='done'?'concluído':g.status==='failed'?'falhou':'gerando'}


                    </span>


                  </div>


                ))}


              </div>


            )}


          </div>


        )}





      </div>





      {/* Preview Modal */}


      <Dialog open={previewId !== null} onOpenChange={open => !open && setPreviewId(null)}>


        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">


          <DialogHeader>


            <DialogTitle style={{ fontFamily: "'Playfair Display', serif" }}>Prévia do Curso</DialogTitle>


          </DialogHeader>


          {previewQuery.isLoading ? (


            <div className="py-10 text-center text-muted-foreground">Carregando...</div>


          ) : previewQuery.data ? (


            <div className="space-y-4">


              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-lg text-primary">{(previewQuery.data as any).title ?? (previewQuery.data as any).prompt}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{(previewQuery.data as any).description}</p>
                </div>
                {(previewQuery.data as any).generatedModuleId && (
                  <Button onClick={() => window.location.href = `/plataforma/missao/curso/${(previewQuery.data as any).generatedModuleId}?preview=1`} className="bg-sky-600 hover:bg-sky-700 text-white gap-2 flex-shrink-0">
                    <Gamepad2 size={16} /> Jogar prévia
                  </Button>
                )}
              </div>


              {(previewQuery.data as any).lessons?.length > 0 && (


                <div>


                  <p className="text-sm font-semibold mb-2">Aulas:</p>


                  <div className="space-y-2">


                    {(previewQuery.data as any).lessons.map((l: any, i: number) => (


                      <div key={i} className="flex gap-3 p-3 bg-muted/30 rounded-lg">


                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">{i+1}</span>


                        <div>


                          <p className="text-sm font-medium">{l.title}</p>


                          {l.description && <p className="text-xs text-muted-foreground mt-0.5">{l.description}</p>}


                        </div>


                      </div>


                    ))}


                  </div>


                </div>


              )}


            </div>


          ) : null}


        </DialogContent>


      </Dialog>


    </AppLayout>


  );


}



