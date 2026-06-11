import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, ListChecks, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface Props {
  lessonId: number;
  onPassed: () => void;
}

export default function QuizSection({ lessonId, onPassed }: Props) {
  const { data: quiz, isLoading } = trpc.quiz.getByLesson.useQuery({ lessonId });
  const { data: myAttemptsData, refetch: refetchAttempts } = trpc.quiz.myAttempts.useQuery({ lessonId });
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<{ score: number; passed: boolean; passingScore: number } | null>(null);

  const submit = trpc.quiz.submit.useMutation({
    onSuccess: (data) => {
      setResult(data);
      refetchAttempts();
      if (data.passed) {
        toast.success(`Quiz aprovado! Pontuação: ${data.score}%`);
        onPassed();
      } else {
        toast.error(`Pontuação ${data.score}% — necessário ${data.passingScore}% para aprovação.`);
      }
    },
    onError: (e) => toast.error(e.message),
  });

  // If user already passed, signal completion
  useEffect(() => {
    if (myAttemptsData?.hasPassed) {
      onPassed();
    }
  }, [myAttemptsData?.hasPassed]);

  if (isLoading) {
    return <div className="bg-white rounded-xl border border-border p-4 animate-pulse h-40" />;
  }

  if (!quiz) {
    return null;
  }

  const alreadyPassed = myAttemptsData?.hasPassed;

  function handleSelect(questionId: number, optionId: number) {
    setAnswers((p) => ({ ...p, [questionId]: optionId }));
  }

  function handleSubmit() {
    if (!quiz) return;
    if (Object.keys(answers).length < quiz.questions.length) {
      toast.error("Responda todas as questões antes de enviar.");
      return;
    }
    submit.mutate({
      lessonId,
      answers: Object.entries(answers).map(([qId, oId]) => ({
        questionId: Number(qId),
        selectedOptionId: Number(oId),
      })),
    });
  }

  function handleRetry() {
    setAnswers({});
    setResult(null);
  }

  if (alreadyPassed && !result) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
        <CheckCircle2 size={20} className="text-green-600 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-green-800 text-sm">Quiz já aprovado</p>
          <p className="text-xs text-green-700">Você foi aprovado neste quiz anteriormente.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-border p-4 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <ListChecks size={18} className="text-primary" />
        <h3 className="font-semibold text-foreground">Questionário de verificação</h3>
        <span className="ml-auto text-xs text-muted-foreground">Aprovação: {quiz.passingScore}%</span>
      </div>

      {quiz.questions.map((q, idx) => (
        <div key={q.id} className="border-t border-border pt-3">
          <p className="font-medium text-sm text-foreground mb-2">
            {idx + 1}. {q.questionText}
          </p>
          <div className="space-y-1.5">
            {q.options.map((o: any) => (
              <label
                key={o.id}
                className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer text-sm transition-colors
                  ${answers[q.id] === o.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
              >
                <input
                  type="radio"
                  name={`q-${q.id}`}
                  className="mt-1"
                  checked={answers[q.id] === o.id}
                  onChange={() => handleSelect(q.id, o.id)}
                  disabled={submit.isPending}
                />
                <span>{o.optionText}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      {result && (
        <div
          className={`rounded-lg p-3 flex items-center gap-2 ${
            result.passed
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {result.passed ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          <p className="text-sm">
            {result.passed ? "Parabéns! Você foi aprovado." : "Não foi dessa vez. Revise o conteúdo e tente novamente."}{" "}
            <strong>Pontuação: {result.score}%</strong> (mínimo: {result.passingScore}%)
          </p>
        </div>
      )}

      <div className="flex gap-2">
        {result && !result.passed ? (
          <Button onClick={handleRetry} variant="outline" className="gap-2">
            <RotateCcw size={14} /> Refazer
          </Button>
        ) : null}
        {!result || !result.passed ? (
          <Button
            onClick={handleSubmit}
            disabled={submit.isPending}
            className="bg-primary hover:bg-primary/90 text-white"
          >
            {submit.isPending ? "Enviando..." : "Enviar respostas"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
