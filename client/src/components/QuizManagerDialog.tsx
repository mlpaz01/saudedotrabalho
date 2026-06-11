import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ListChecks } from "lucide-react";
import { toast } from "sonner";

interface Option { optionText: string; isCorrect: boolean }
interface Question { questionText: string; options: Option[] }

interface Props {
  lessonId: number | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function emptyQuestion(): Question {
  return {
    questionText: "",
    options: [
      { optionText: "", isCorrect: true },
      { optionText: "", isCorrect: false },
      { optionText: "", isCorrect: false },
      { optionText: "", isCorrect: false },
    ],
  };
}

export default function QuizManagerDialog({ lessonId, open, onOpenChange }: Props) {
  const enabled = !!lessonId && open;
  const quizQuery = trpc.admin.getQuiz.useQuery({ lessonId: lessonId ?? 0 }, { enabled });
  const utils = trpc.useUtils();
  const [passingScore, setPassingScore] = useState(70);
  const [questions, setQuestions] = useState<Question[]>([emptyQuestion()]);

  useEffect(() => {
    if (!enabled) return;
    if (quizQuery.data) {
      setPassingScore(quizQuery.data.passingScore ?? 70);
      if (quizQuery.data.questions?.length) {
        setQuestions(quizQuery.data.questions.map((q: any) => ({
          questionText: q.questionText,
          options: q.options.map((o: any) => ({ optionText: o.optionText, isCorrect: o.isCorrect === 1 })),
        })));
      } else {
        setQuestions([emptyQuestion()]);
      }
    }
  }, [quizQuery.data, enabled]);

  const upsert = trpc.admin.upsertQuiz.useMutation({
    onSuccess: () => {
      toast.success("Quiz salvo!");
      utils.admin.getQuiz.invalidate({ lessonId: lessonId ?? 0 });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  function updateQuestionText(idx: number, text: string) {
    setQuestions((qs) => qs.map((q, i) => (i === idx ? { ...q, questionText: text } : q)));
  }
  function updateOptionText(qIdx: number, oIdx: number, text: string) {
    setQuestions((qs) => qs.map((q, i) =>
      i !== qIdx ? q : { ...q, options: q.options.map((o, j) => (j === oIdx ? { ...o, optionText: text } : o)) }
    ));
  }
  function setCorrect(qIdx: number, oIdx: number) {
    setQuestions((qs) => qs.map((q, i) =>
      i !== qIdx ? q : { ...q, options: q.options.map((o, j) => ({ ...o, isCorrect: j === oIdx })) }
    ));
  }
  function addQuestion() { setQuestions((qs) => [...qs, emptyQuestion()]); }
  function removeQuestion(idx: number) { setQuestions((qs) => qs.filter((_, i) => i !== idx)); }

  function handleSave() {
    if (!lessonId) return;
    for (const q of questions) {
      if (!q.questionText.trim()) {
        toast.error("Todas as questões precisam de enunciado.");
        return;
      }
      if (!q.options.some((o) => o.isCorrect)) {
        toast.error("Cada questão precisa de uma alternativa correta.");
        return;
      }
      if (q.options.some((o) => !o.optionText.trim())) {
        toast.error("Todas as alternativas precisam de texto.");
        return;
      }
    }
    upsert.mutate({ lessonId, passingScore, questions });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks size={18} /> Configurar Quiz
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium block mb-1">Nota mínima para aprovação (%)</label>
            <Input
              type="number"
              min={0}
              max={100}
              value={passingScore}
              onChange={(e) => setPassingScore(Number(e.target.value))}
              className="max-w-[120px]"
            />
          </div>

          {questions.map((q, qIdx) => (
            <div key={qIdx} className="border border-border rounded-lg p-3 space-y-2 bg-muted/20">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Questão {qIdx + 1}</span>
                {questions.length > 1 && (
                  <Button size="sm" variant="ghost" className="ml-auto h-7 w-7 p-0 text-red-500"
                    onClick={() => removeQuestion(qIdx)}>
                    <Trash2 size={13} />
                  </Button>
                )}
              </div>
              <Input
                placeholder="Enunciado da questão"
                value={q.questionText}
                onChange={(e) => updateQuestionText(qIdx, e.target.value)}
              />
              <div className="space-y-1.5">
                {q.options.map((o, oIdx) => (
                  <div key={oIdx} className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={o.isCorrect}
                      onChange={() => setCorrect(qIdx, oIdx)}
                      title="Marcar como correta"
                    />
                    <Input
                      className="flex-1"
                      placeholder={`Alternativa ${oIdx + 1}`}
                      value={o.optionText}
                      onChange={(e) => updateOptionText(qIdx, oIdx, e.target.value)}
                    />
                    {o.isCorrect && (
                      <span className="text-xs text-green-700 bg-green-100 px-1.5 py-0.5 rounded">Correta</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <Button variant="outline" onClick={addQuestion} className="gap-1">
            <Plus size={14} /> Adicionar Questão
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={upsert.isPending} className="bg-primary text-white">
            {upsert.isPending ? "Salvando..." : "Salvar Quiz"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
