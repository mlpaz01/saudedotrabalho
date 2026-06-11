import { useState } from "react";
import { useRoute, Link } from "wouter";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, ArrowLeft, Play } from "lucide-react";

const QUESTION_TYPES = [
  { value: "likert", label: "Likert (1-5)" },
  { value: "multiple", label: "Múltipla escolha" },
  { value: "single", label: "Resposta única" },
  { value: "text", label: "Texto livre" },
  { value: "nps", label: "NPS (0-10)" },
];

export default function SurveyBuilder() {
  const [, params] = useRoute("/admin/pesquisas/:id/editar");
  const id = Number(params?.id ?? 0);
  const sQ = trpc.surveys.get.useQuery({ id }, { enabled: !!id });
  const utils = trpc.useUtils();
  const addQ = trpc.surveys.addQuestion.useMutation({
    onSuccess: () => { utils.surveys.get.invalidate({ id }); setText(""); setOptionsRaw(""); toast.success("Pergunta adicionada"); },
    onError: (e) => toast.error(e.message),
  });
  const delQ = trpc.surveys.deleteQuestion.useMutation({
    onSuccess: () => { utils.surveys.get.invalidate({ id }); toast.success("Pergunta removida"); },
  });
  const launchMut = trpc.surveys.launch.useMutation({
    onSuccess: () => { utils.surveys.get.invalidate({ id }); toast.success("Pesquisa lançada!"); },
  });

  const [type, setType] = useState("likert");
  const [text, setText] = useState("");
  const [optionsRaw, setOptionsRaw] = useState("");

  if (!sQ.data) return <AppLayout><div className="p-6 text-muted-foreground">Carregando...</div></AppLayout>;
  const s = sQ.data;
  const questions = s.questions ?? [];

  function handleAdd() {
    if (!text.trim()) { toast.error("Texto obrigatório"); return; }
    let options: any = undefined;
    if ((type === "multiple" || type === "single") && optionsRaw.trim()) {
      options = optionsRaw.split(/\n|;/).map(o => o.trim()).filter(Boolean);
    }
    addQ.mutate({ surveyId: id, questionText: text, questionType: type, options, isRequired: true, orderIndex: questions.length + 1 });
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Link href="/admin/pesquisas"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft size={14} /> Voltar</Button></Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary" style={{ fontFamily: "'Playfair Display', serif" }}>{s.title}</h1>
            <p className="text-muted-foreground text-sm">{s.description}</p>
          </div>
          {s.status === "draft" && <Button onClick={() => launchMut.mutate({ id })} className="gap-2 bg-green-600 hover:bg-green-700"><Play size={14} /> Lançar pesquisa</Button>}
        </div>

        <div className="bg-white rounded-xl border border-border p-6 shadow-sm space-y-4">
          <h2 className="font-semibold">Perguntas ({questions.length})</h2>
          <div className="space-y-2">
            {questions.map((q: any, i: number) => (
              <div key={q.id} className="border border-border rounded-lg p-3 flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{q.questionText}</p>
                  <p className="text-xs text-muted-foreground">{QUESTION_TYPES.find(t => t.value === q.questionType)?.label ?? q.questionType}</p>
                  {q.options && Array.isArray(q.options) && (
                    <p className="text-xs text-muted-foreground mt-1">Opções: {q.options.join(" · ")}</p>
                  )}
                </div>
                <button onClick={() => delQ.mutate({ id: q.id })} className="text-destructive hover:opacity-70"><Trash2 size={14} /></button>
              </div>
            ))}
            {questions.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma pergunta ainda.</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border p-6 shadow-sm space-y-3">
          <h3 className="font-semibold">Adicionar pergunta</h3>
          <div>
            <label className="text-sm font-medium mb-1 block">Tipo</label>
            <select value={type} onChange={e => setType(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white">
              {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Pergunta</label>
            <Textarea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder="Escreva a pergunta..." />
          </div>
          {(type === "multiple" || type === "single") && (
            <div>
              <label className="text-sm font-medium mb-1 block">Opções (uma por linha)</label>
              <Textarea value={optionsRaw} onChange={e => setOptionsRaw(e.target.value)} rows={3} placeholder="Sim\nNão\nNão sei" />
            </div>
          )}
          <Button onClick={handleAdd} className="gap-2"><Plus size={14} /> Adicionar</Button>
        </div>
      </div>
    </AppLayout>
  );
}
