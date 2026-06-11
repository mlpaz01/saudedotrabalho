import { useState } from "react";



import { useLocation } from "wouter";



import AppLayout from "@/components/AppLayout";



import { trpc } from "@/lib/trpc";



import { Button } from "@/components/ui/button";



import { Input } from "@/components/ui/input";



import { Textarea } from "@/components/ui/textarea";



import { toast } from "sonner";



import { ChevronRight, ChevronLeft, Check, BookOpen, Video, HelpCircle, Award, Rocket } from "lucide-react";







const STEPS = [



  { id: 1, label: "Informacoes Basicas", icon: <BookOpen size={16} /> },



  { id: 2, label: "Aulas", icon: <Video size={16} /> },



  { id: 3, label: "Quiz", icon: <HelpCircle size={16} /> },



  { id: 4, label: "Certificado", icon: <Award size={16} /> },



  { id: 5, label: "Publicar", icon: <Rocket size={16} /> },



];







interface ModuleForm {



  title: string;



  description: string;



  durationMinutes: number;



  thumbnailUrl: string;



  certTitle: string;



  certBody: string;



  certSignerName: string;



  certSignerRole: string;



  isActive: boolean;



}







interface LessonDraft {



  title: string;



  videoUrl: string;



  orderIndex: number;



}







export default function AdminModuleWizard() {



  const [, setLocation] = useLocation();



  const [step, setStep] = useState(1);



  const [moduleId, setModuleId] = useState<number | null>(null);



  const [form, setForm] = useState<ModuleForm>({



    title: "",



    description: "",



    durationMinutes: 30,



    thumbnailUrl: "",



    certTitle: "Certificado de Conclusao",



    certBody: "Certificamos que {nome} concluiu com exito o modulo {modulo}.",



    certSignerName: "Coordenador de SST",



    certSignerRole: "Saude do Trabalho",



    isActive: false,



  });



  const [lessons, setLessons] = useState<LessonDraft[]>([



    { title: "", videoUrl: "", orderIndex: 1 },



  ]);







  const createModuleMut = trpc.admin.createModule.useMutation({



    onSuccess: (data: any) => {



      setModuleId(data.id);



      toast.success("Modulo criado! Continue configurando.");



      setStep(2);



    },



    onError: (e: any) => toast.error(e.message),



  });







  const updateModuleMut = trpc.admin.updateModuleAdmin.useMutation({



    onSuccess: () => toast.success("Modulo atualizado!"),



    onError: (e: any) => toast.error(e.message),



  });







  const createLessonMut = (trpc.lessons as any).create.useMutation({



    onError: (e: any) => toast.error(e.message),



  });







  const set = (key: keyof ModuleForm, value: string | number | boolean) =>



    setForm((f) => ({ ...f, [key]: value }));







  async function handleStep1() {



    if (!form.title.trim()) { toast.error("Titulo obrigatorio"); return; }



    createModuleMut.mutate({



      title: form.title,



      description: form.description,



      durationMinutes: form.durationMinutes,



      // thumbnailUrl: form.thumbnailUrl, // not in create input



      isActive: false,



    });



  }







  async function handleStep2() {



    if (!moduleId) return;



    for (let i = 0; i < lessons.length; i++) {



      const l = lessons[i];



      if (!l.title.trim() || !l.videoUrl.trim()) continue;



      await createLessonMut.mutateAsync({ moduleId, title: l.title, videoUrl: l.videoUrl, orderIndex: l.orderIndex });



    }



    toast.success("Aulas salvas!");



    setStep(3);



  }







  async function handleStep3() {



    setStep(4);



  }







  async function handleStep4() {



    if (!moduleId) return;



    await updateModuleMut.mutateAsync({



      id: moduleId,



      certTitle: form.certTitle,



      certBody: form.certBody,



      certSignerName: form.certSignerName,



      certSignerRole: form.certSignerRole,



    });



    setStep(5);



  }







  async function handlePublish() {



    if (!moduleId) return;



    await updateModuleMut.mutateAsync({ id: moduleId, isActive: true });



    toast.success("Modulo publicado com sucesso!");



    setLocation("/admin/modulos");



  }







  async function handleSaveDraft() {



    if (!moduleId) return;



    toast.success("Rascunho salvo!");



    setLocation("/admin/modulos");



  }







  function addLesson() {



    setLessons((ls) => [...ls, { title: "", videoUrl: "", orderIndex: ls.length + 1 }]);



  }







  function updateLesson(i: number, key: keyof LessonDraft, value: string | number) {



    setLessons((ls) => ls.map((l, idx) => idx === i ? { ...l, [key]: value } : l));



  }







  function removeLesson(i: number) {



    setLessons((ls) => ls.filter((_, idx) => idx !== i));



  }







  return (



    <AppLayout>



      <div className="p-6 max-w-3xl mx-auto space-y-6">



        {/* Header */}



        <div className="relative pl-4">



          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary to-transparent" />



          <h1 className="text-2xl font-bold text-primary" style={{ fontFamily: "'Playfair Display', serif" }}>



            Novo Modulo



          </h1>



          <p className="text-muted-foreground text-sm mt-0.5">Crie um novo modulo de treinamento passo a passo</p>



        </div>







        {/* Step indicator */}



        <div className="flex items-center gap-0">



          {STEPS.map((s, i) => (



            <div key={s.id} className="flex items-center flex-1 last:flex-none">



              <div



                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-colors ${



                  step === s.id



                    ? "bg-primary text-white"



                    : step > s.id



                    ? "bg-green-100 text-green-700"



                    : "bg-muted text-muted-foreground"



                }`}



              >



                {step > s.id ? <Check size={12} /> : s.icon}



                <span className="hidden sm:inline">{s.label}</span>



              </div>



              {i < STEPS.length - 1 && (



                <div className={`h-0.5 flex-1 mx-1 ${step > s.id ? "bg-green-300" : "bg-border"}`} />



              )}



            </div>



          ))}



        </div>







        {/* Step content */}



        <div className="bg-white rounded-xl border border-border p-6 shadow-sm">



          {/* Step 1: Basic Info */}



          {step === 1 && (



            <div className="space-y-4">



              <h2 className="font-semibold text-lg">Informacoes Basicas</h2>



              <div>



                <label className="text-sm font-medium mb-1 block">Titulo do Modulo *</label>



                <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex: Saude Mental no Trabalho" />



              </div>



              <div>



                <label className="text-sm font-medium mb-1 block">Descricao</label>



                <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Descreva o conteudo deste modulo..." rows={3} />



              </div>



              <div className="grid grid-cols-2 gap-4">



                <div>



                  <label className="text-sm font-medium mb-1 block">Duracao (minutos)</label>



                  <Input type="number" value={form.durationMinutes} onChange={(e) => set("durationMinutes", Number(e.target.value))} min={1} />



                </div>



                <div>



                  <label className="text-sm font-medium mb-1 block">URL da Capa (thumbnail)</label>



                  <Input value={form.thumbnailUrl} onChange={(e) => set("thumbnailUrl", e.target.value)} placeholder="https://..." />



                </div>



              </div>



              <div className="flex justify-end pt-2">



                <Button onClick={handleStep1} disabled={createModuleMut.isPending} className="gap-2">



                  {createModuleMut.isPending ? "Salvando..." : "Proximo"} <ChevronRight size={16} />



                </Button>



              </div>



            </div>



          )}







          {/* Step 2: Lessons */}



          {step === 2 && (



            <div className="space-y-4">



              <h2 className="font-semibold text-lg">Aulas</h2>



              <p className="text-sm text-muted-foreground">Adicione as aulas do modulo. Voce pode adicionar mais aulas depois.</p>



              {lessons.map((l, i) => (



                <div key={i} className="border border-border rounded-lg p-4 space-y-3">



                  <div className="flex items-center justify-between">



                    <span className="text-sm font-medium text-muted-foreground">Aula {i + 1}</span>



                    {lessons.length > 1 && (



                      <button onClick={() => removeLesson(i)} className="text-xs text-red-500 hover:text-red-700">Remover</button>



                    )}



                  </div>



                  <Input value={l.title} onChange={(e) => updateLesson(i, "title", e.target.value)} placeholder="Titulo da aula" />



                  <Input value={l.videoUrl} onChange={(e) => updateLesson(i, "videoUrl", e.target.value)} placeholder="URL do video (YouTube, Vimeo ou direto)" />



                </div>



              ))}



              <Button variant="outline" onClick={addLesson} className="w-full">+ Adicionar Aula</Button>



              <div className="flex justify-between pt-2">



                <Button variant="outline" onClick={() => setStep(1)} className="gap-2"><ChevronLeft size={16} /> Voltar</Button>



                <Button onClick={handleStep2} className="gap-2">Proximo <ChevronRight size={16} /></Button>



              </div>



            </div>



          )}







          {/* Step 3: Quiz */}



          {step === 3 && (



            <div className="space-y-4">



              <h2 className="font-semibold text-lg">Quiz</h2>



              <p className="text-sm text-muted-foreground">



                Os quizzes sao configurados individualmente em cada aula, dentro de <strong>Admin &gt; Modulos &gt; Editar</strong>.



                Voce pode pular esta etapa e configurar quizzes posteriormente.



              </p>



              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">



                <strong>Dica:</strong> Apos publicar o modulo, acesse a edicao de cada aula para adicionar perguntas de avaliacao.



              </div>



              <div className="flex justify-between pt-2">



                <Button variant="outline" onClick={() => setStep(2)} className="gap-2"><ChevronLeft size={16} /> Voltar</Button>



                <Button onClick={handleStep3} className="gap-2">Proximo <ChevronRight size={16} /></Button>



              </div>



            </div>



          )}







          {/* Step 4: Certificate */}



          {step === 4 && (



            <div className="space-y-4">



              <h2 className="font-semibold text-lg">Certificado</h2>



              <div>



                <label className="text-sm font-medium mb-1 block">Titulo do Certificado</label>



                <Input value={form.certTitle} onChange={(e) => set("certTitle", e.target.value)} />



              </div>



              <div>



                <label className="text-sm font-medium mb-1 block">Texto do Certificado</label>



                <Textarea value={form.certBody} onChange={(e) => set("certBody", e.target.value)} rows={3} />



                <p className="text-xs text-muted-foreground mt-1">Use {"{nome}"} e {"{modulo}"} como variaveis.</p>



              </div>



              <div className="grid grid-cols-2 gap-4">



                <div>



                  <label className="text-sm font-medium mb-1 block">Nome do Signatario</label>



                  <Input value={form.certSignerName} onChange={(e) => set("certSignerName", e.target.value)} />



                </div>



                <div>



                  <label className="text-sm font-medium mb-1 block">Cargo do Signatario</label>



                  <Input value={form.certSignerRole} onChange={(e) => set("certSignerRole", e.target.value)} />



                </div>



              </div>



              <div className="flex justify-between pt-2">



                <Button variant="outline" onClick={() => setStep(3)} className="gap-2"><ChevronLeft size={16} /> Voltar</Button>



                <Button onClick={handleStep4} className="gap-2">Proximo <ChevronRight size={16} /></Button>



              </div>



            </div>



          )}







          {/* Step 5: Publish */}



          {step === 5 && (



            <div className="space-y-4">



              <h2 className="font-semibold text-lg">Publicar Modulo</h2>



              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">



                <p className="font-medium text-green-800">Resumo do modulo</p>



                <p className="text-sm text-green-700"><strong>Titulo:</strong> {form.title}</p>



                <p className="text-sm text-green-700"><strong>Aulas:</strong> {lessons.filter(l => l.title).length} aula(s)</p>



                <p className="text-sm text-green-700"><strong>Duracao:</strong> {form.durationMinutes} minutos</p>



                <p className="text-sm text-green-700"><strong>Certificado:</strong> {form.certTitle}</p>



              </div>



              <p className="text-sm text-muted-foreground">



                Publicar tornara o modulo visivel para os colaboradores. Voce pode salvar como rascunho e publicar depois.



              </p>



              <div className="flex justify-between gap-3 pt-2">



                <Button variant="outline" onClick={() => setStep(4)} className="gap-2"><ChevronLeft size={16} /> Voltar</Button>



                <div className="flex gap-2">



                  <Button variant="outline" onClick={handleSaveDraft}>Salvar Rascunho</Button>



                  <Button onClick={handlePublish} className="gap-2 bg-green-600 hover:bg-green-700">



                    <Rocket size={16} /> Publicar Agora



                  </Button>



                </div>



              </div>



            </div>



          )}



        </div>



      </div>



    </AppLayout>



  );



}



