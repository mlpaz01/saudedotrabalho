import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

export default function SurveyAnswer() {
  const [, params] = useRoute("/pesquisas/:id/responder");
  const [, setLocation] = useLocation();
  const id = Number(params?.id ?? 0);
  const sQ = trpc.surveys.get.useQuery({ id }, { enabled: !!id });
  const submitMut = trpc.surveys.submit.useMutation({
    onSuccess: () => { toast.success("Obrigado por participar!"); setLocation("/pesquisas"); },
    onError: (e) => toast.error(e.message),
  });
  const [answers, setAnswers] = useState<Record<number, string>>({});

  if (!sQ.data) return <AppLayout><div className="p-6 text-muted-foreground">Carregando...</div></AppLayout>;
  const s = sQ.data;
  const qs = s.questions ?? [];

  // Determine likert scale labels based on category
  const cat = String((s as any).category || "").toLowerCase();
  const frequencyScales = ["psychosocial","burnout","harassment","frequency"];
  const isFrequency = frequencyScales.some(k => cat.includes(k));
  const likertScale = isFrequency
    ? ["Nunca", "Raramente", "Às vezes", "Frequentemente", "Sempre"]
    : ["Discordo totalmente", "Discordo", "Neutro", "Concordo", "Concordo totalmente"];
  const hasLikert = qs.some((q: any) => q.questionType === "likert");

  function setA(qid: number, v: string) { setAnswers(a => ({ ...a, [qid]: v })); }

  function handleSubmit() {
    const list = qs.filter((q: any) => q.isRequired).map((q: any) => q.id);
    for (const qid of list) {
      if (!answers[qid] || answers[qid].trim() === "") { toast.error("Responda todas as perguntas obrigatórias."); return; }
    }
    const arr = Object.entries(answers).map(([qid, v]) => ({ questionId: Number(qid), value: v }));
    submitMut.mutate({ surveyId: id, answers: arr });
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-primary" style={{ fontFamily: "'Playfair Display', serif" }}>{s.title}</h1>
          <p className="text-muted-foreground text-sm">{s.description}</p>
          {s.isAnonymous && <p className="text-xs text-green-700 mt-1">🔒 Suas respostas são anônimas.</p>}
        </div>

        <div className="space-y-4">
          {hasLikert && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-900 mb-2 uppercase tracking-wider">Escala de resposta</p>
              <div className="grid grid-cols-5 gap-2">
                {likertScale.map((label, idx) => (
                  <div key={idx} className="text-center">
                    <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold mb-1">{idx + 1}</div>
                    <p className="text-[10px] text-blue-900 leading-tight">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {qs.map((q: any, i: number) => (
            <div key={q.id} className="bg-white rounded-xl border border-border p-5 shadow-sm">
              <p className="font-medium text-sm mb-3">{i + 1}. {q.questionText} {q.isRequired && <span className="text-red-500">*</span>}</p>
              {q.questionType === "likert" && (
                <div>
                  <div className="grid grid-cols-5 gap-2">
                    {likertScale.map((opt, idx) => {
                      const n = idx + 1;
                      const active = answers[q.id] === String(n);
                      return (
                        <button
                          key={n}
                          onClick={() => setA(q.id, String(n))}
                          className={`py-3 px-1 rounded-lg border text-center transition-all flex flex-col items-center justify-center gap-1 min-h-[68px] ${active ? "border-primary bg-primary text-white shadow-sm" : "border-border hover:border-primary hover:bg-primary/5"}`}
                        >
                          <span className={`text-base font-bold ${active ? "" : "text-primary"}`}>{n}</span>
                          <span className={`text-[10px] leading-tight ${active ? "text-white/90" : "text-muted-foreground"}`}>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {q.questionType === "nps" && (
                <div className="grid grid-cols-11 gap-1">
                  {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button key={n} onClick={() => setA(q.id, String(n))} className={`py-2 rounded border text-xs font-semibold ${answers[q.id] === String(n) ? "border-primary bg-primary text-white" : "border-border hover:border-primary"}`}>{n}</button>
                  ))}
                </div>
              )}
              {(q.questionType === "single" || q.questionType === "multiple") && Array.isArray(q.options) && (
                <div className="space-y-2">
                  {q.options.map((opt: string, j: number) => (
                    <label key={j} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type={q.questionType === "single" ? "radio" : "checkbox"} name={`q_${q.id}`} checked={answers[q.id] === opt} onChange={() => setA(q.id, opt)} />
                      {opt}
                    </label>
                  ))}
                </div>
              )}
              {q.questionType === "text" && (
                <Textarea value={answers[q.id] ?? ""} onChange={e => setA(q.id, e.target.value)} rows={3} placeholder="Sua resposta..." />
              )}
            </div>
          ))}
        </div>

        <Button onClick={handleSubmit} disabled={submitMut.isPending} className="w-full gap-2"><CheckCircle2 size={16} /> Enviar respostas</Button>
      </div>
    </AppLayout>
  );
}
