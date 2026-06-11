// All 10 block renderers in one file for compactness.
// Each renderer follows a common contract:
//   props: { data, onAnswer(isCorrect, attempt) }
// Renderers either:
//   - call onAnswer(true, 1) immediately when user taps "Continuar" (concept/example/reflection)
//   - or wait for user to pick/submit, then call onAnswer(correct, attempt)

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";

type RendererProps = {
  data: any;
  onAnswer: (isCorrect: boolean, attempt: number) => void;
  feedback?: "idle" | "correct" | "wrong";
};

export function ConceptBlock({ data, onAnswer }: RendererProps) {
  return (
    <div className="flex flex-col items-center text-center w-full max-w-md mx-auto">
      {data?.imageUrl && (
        <img src={data.imageUrl} alt="" className="w-40 h-40 sm:w-56 sm:h-56 object-cover rounded-3xl mb-6 shadow-md" />
      )}
      <h2 className="text-2xl font-extrabold mb-3 text-foreground">{data?.title ?? "Conceito"}</h2>
      <p className="text-base text-muted-foreground leading-relaxed whitespace-pre-wrap">{data?.body}</p>
      <Button onClick={() => onAnswer(true, 1)} className="mt-8 w-full font-bold text-base h-14 rounded-2xl">
        Continuar
      </Button>
    </div>
  );
}

export function ExampleBlock({ data, onAnswer }: RendererProps) {
  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto">
      {data?.imageUrl && (
        <img src={data.imageUrl} alt="" className="w-40 h-40 sm:w-56 sm:h-56 object-cover rounded-3xl mb-4 shadow-md" />
      )}
      <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 mb-4">
        <p className="text-sm font-bold uppercase tracking-wider text-amber-700 mb-2">Exemplo</p>
        <p className="text-base text-foreground leading-relaxed">{data?.scenario}</p>
      </div>
      <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4 mb-4">
        <p className="text-sm font-bold uppercase tracking-wider text-emerald-700 mb-1">O que isso ensina</p>
        <p className="text-base text-foreground">{data?.takeaway}</p>
      </div>
      <Button onClick={() => onAnswer(true, 1)} className="mt-4 w-full font-bold text-base h-14 rounded-2xl">
        Continuar
      </Button>
    </div>
  );
}

function MultiOptionBase({ data, onAnswer, large }: RendererProps & { large?: boolean }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const isCorrect = picked === data?.correctIndex;

  const submit = () => {
    if (picked == null) return;
    const a = attempt + 1;
    setAttempt(a);
    setSubmitted(true);
    setTimeout(() => onAnswer(isCorrect, a), 600);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <h2 className={`font-extrabold mb-6 text-foreground ${large ? "text-2xl" : "text-xl"}`}>{data?.question}</h2>
      <div className="space-y-3">
        {(data?.options ?? []).map((opt: string, i: number) => {
          const isPicked = picked === i;
          const isRight = i === data?.correctIndex;
          let cls = "border-2 bg-white hover:bg-muted/50";
          if (submitted) {
            if (isRight) cls = "border-2 border-emerald-500 bg-emerald-50";
            else if (isPicked) cls = "border-2 border-rose-500 bg-rose-50";
            else cls = "border-2 border-border bg-white opacity-60";
          } else if (isPicked) {
            cls = "border-2 border-primary bg-primary/10";
          }
          return (
            <button
              key={i}
              onClick={() => !submitted && setPicked(i)}
              className={`w-full text-left rounded-2xl p-4 text-base font-medium transition ${cls}`}
              disabled={submitted}
            >
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-muted text-xs font-bold mr-3">{String.fromCharCode(65 + i)}</span>
              {opt}
            </button>
          );
        })}
      </div>
      {!submitted && (
        <Button onClick={submit} disabled={picked == null} className="mt-6 w-full font-bold text-base h-14 rounded-2xl">
          Verificar
        </Button>
      )}
      {submitted && !isCorrect && (
        <div className="mt-4 p-4 rounded-2xl bg-rose-50 border-2 border-rose-300">
          <p className={`font-bold mb-1 ${isCorrect ? "text-emerald-700" : "text-rose-700"}`}>
            {!isCorrect && `Resposta: ${data?.options?.[data?.correctIndex] ?? ""}`}
          </p>
          {data?.explanation && <p className="text-sm text-foreground/80">{data.explanation}</p>}
        </div>
      )}
    </div>
  );
}

export function QuickCheckBlock(props: RendererProps) { return <MultiOptionBase {...props} />; }
export function MultipleChoiceBlock(props: RendererProps) { return <MultiOptionBase {...props} large />; }

export function TrueFalseBlock({ data, onAnswer }: RendererProps) {
  const [picked, setPicked] = useState<boolean | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const correct = picked === data?.answer;
  const submit = (val: boolean) => {
    setPicked(val);
    setSubmitted(true);
    setTimeout(() => onAnswer(val === data?.answer, 1), 600);
  };
  return (
    <div className="w-full max-w-md mx-auto">
      <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Verdadeiro ou Falso?</p>
      <h2 className="text-xl font-extrabold mb-6 leading-snug">{data?.statement}</h2>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => !submitted && submit(true)}
          className={`rounded-2xl h-20 font-bold text-lg border-2 transition ${submitted ? (data?.answer === true ? "bg-emerald-50 border-emerald-500 text-emerald-700" : (picked === true ? "bg-rose-50 border-rose-500 text-rose-700" : "opacity-50")) : "bg-white border-border hover:border-primary"}`}
          disabled={submitted}
        >
          Verdadeiro
        </button>
        <button
          onClick={() => !submitted && submit(false)}
          className={`rounded-2xl h-20 font-bold text-lg border-2 transition ${submitted ? (data?.answer === false ? "bg-emerald-50 border-emerald-500 text-emerald-700" : (picked === false ? "bg-rose-50 border-rose-500 text-rose-700" : "opacity-50")) : "bg-white border-border hover:border-primary"}`}
          disabled={submitted}
        >
          Falso
        </button>
      </div>
      {submitted && !correct && (
        <div className="mt-4 p-4 rounded-2xl bg-rose-50 border-2 border-rose-300">
          <p className={`font-bold mb-1 ${correct ? "text-emerald-700" : "text-rose-700"}`}>{!correct && `Resposta: ${data?.answer ? "Verdadeiro" : "Falso"}`}</p>
          {data?.explanation && <p className="text-sm text-foreground/80">{data.explanation}</p>}
        </div>
      )}
    </div>
  );
}

export function FillBlankBlock({ data, onAnswer }: RendererProps) {
  const parts: string[] = String(data?.template ?? "").split("____");
  const blanks = Math.max(0, parts.length - 1);
  const [picks, setPicks] = useState<(string | null)[]>(Array(blanks).fill(null));
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [submitted, setSubmitted] = useState(false);
  const bank: string[] = data?.wordBank ?? [];
  const correctAnswers: string[] = data?.correctAnswers ?? [];

  const allFilled = picks.every(p => p != null);
  const isCorrect = allFilled && picks.every((p, i) => (p ?? "").toLowerCase() === (correctAnswers[i] ?? "").toLowerCase());

  const submit = () => {
    setSubmitted(true);
    setTimeout(() => onAnswer(isCorrect, 1), 700);
  };

  const setBlank = (word: string) => {
    if (submitted) return;
    const next = [...picks];
    next[activeIdx] = word;
    setPicks(next);
    const nextEmpty = next.findIndex(x => x == null);
    if (nextEmpty >= 0) setActiveIdx(nextEmpty);
  };

  const clearBlank = (i: number) => {
    if (submitted) return;
    const next = [...picks];
    next[i] = null;
    setPicks(next);
    setActiveIdx(i);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Complete a frase</p>
      <div className="bg-white border-2 border-border rounded-2xl p-5 text-lg leading-relaxed mb-5">
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < blanks && (
              <button
                onClick={() => activeIdx !== i ? setActiveIdx(i) : clearBlank(i)}
                className={`inline-block min-w-[80px] mx-1 px-2 py-0.5 rounded-lg border-2 font-bold ${picks[i] ? "bg-primary/10 border-primary text-primary" : activeIdx === i ? "border-primary border-dashed bg-primary/5" : "border-muted-foreground/40 border-dashed"}`}
              >
                {picks[i] ?? "____"}
              </button>
            )}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {bank.map((w, i) => {
          const used = picks.includes(w);
          return (
            <button
              key={i}
              onClick={() => !used && setBlank(w)}
              disabled={used || submitted}
              className={`px-4 py-2 rounded-xl border-2 font-bold text-sm transition ${used ? "opacity-30 border-border" : "border-border bg-white hover:border-primary"}`}
            >
              {w}
            </button>
          );
        })}
      </div>
      {!submitted && (
        <Button onClick={submit} disabled={!allFilled} className="w-full font-bold h-14 rounded-2xl">Verificar</Button>
      )}
      {submitted && !isCorrect && (
        <div className="mt-4 p-4 rounded-2xl bg-rose-50 border-2 border-rose-300">
          <p className={`font-bold mb-1 ${isCorrect ? "text-emerald-700" : "text-rose-700"}`}>{!isCorrect && `Resposta: ${correctAnswers.join(" / ")}`}</p>
          {data?.explanation && <p className="text-sm text-foreground/80">{data.explanation}</p>}
        </div>
      )}
    </div>
  );
}

export function DragOrderBlock({ data, onAnswer }: RendererProps) {
  const initial: string[] = Array.isArray(data?.items) ? [...data.items] : [];
  const [order, setOrder] = useState<string[]>(initial);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const correctOrder: string[] = data?.correctOrder ?? [];
  const isCorrect = order.length === correctOrder.length && order.every((x, i) => x === correctOrder[i]);

  const tap = (i: number) => {
    if (submitted) return;
    if (selected == null) { setSelected(i); return; }
    if (selected === i) { setSelected(null); return; }
    const next = [...order];
    [next[selected], next[i]] = [next[i], next[selected]];
    setOrder(next);
    setSelected(null);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Ordene</p>
      <h2 className="text-lg font-bold mb-5">{data?.instruction}</h2>
      <p className="text-xs text-muted-foreground mb-3">Toque em dois itens para trocar a ordem.</p>
      <div className="space-y-2 mb-5">
        {order.map((item, i) => (
          <button
            key={i}
            onClick={() => tap(i)}
            disabled={submitted}
            className={`w-full text-left p-4 rounded-2xl border-2 font-medium flex items-center gap-3 transition ${selected === i ? "border-primary bg-primary/10" : "border-border bg-white"}`}
          >
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-muted text-xs font-bold">{i + 1}</span>
            <span className="flex-1">{item}</span>
          </button>
        ))}
      </div>
      {!submitted && (
        <Button onClick={() => { setSubmitted(true); setTimeout(() => onAnswer(isCorrect, 1), 600); }} className="w-full font-bold h-14 rounded-2xl">Verificar</Button>
      )}
      {submitted && !isCorrect && (
        <div className="mt-4 p-4 rounded-2xl bg-rose-50 border-2 border-rose-300">
          <p className={`font-bold mb-1 ${isCorrect ? "text-emerald-700" : "text-rose-700"}`}>{!isCorrect && `Ordem correta: ${correctOrder.join(" → ")}`}</p>
          {data?.explanation && <p className="text-sm text-foreground/80">{data.explanation}</p>}
        </div>
      )}
    </div>
  );
}

export function MatchPairsBlock({ data, onAnswer }: RendererProps) {
  const left: string[] = data?.leftItems ?? [];
  const right: string[] = data?.rightItems ?? [];
  const correctPairs: number[][] = data?.correctPairs ?? [];
  const [pairs, setPairs] = useState<Array<[number, number]>>([]);
  const [pickedLeft, setPickedLeft] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const isLeftPaired = (i: number) => pairs.some(p => p[0] === i);
  const isRightPaired = (i: number) => pairs.some(p => p[1] === i);
  const allPaired = pairs.length === left.length;

  const isCorrect = allPaired && pairs.every(p => correctPairs.some(c => c[0] === p[0] && c[1] === p[1]));

  const tapLeft = (i: number) => {
    if (submitted || isLeftPaired(i)) return;
    setPickedLeft(i);
  };
  const tapRight = (j: number) => {
    if (submitted || isRightPaired(j) || pickedLeft == null) return;
    setPairs([...pairs, [pickedLeft, j]]);
    setPickedLeft(null);
  };

  const colorFor = (lefti: number) => {
    const idx = pairs.findIndex(p => p[0] === lefti);
    const colors = ["bg-sky-100 border-sky-400 text-sky-700", "bg-amber-100 border-amber-400 text-amber-700", "bg-violet-100 border-violet-400 text-violet-700", "bg-rose-100 border-rose-400 text-rose-700", "bg-emerald-100 border-emerald-400 text-emerald-700"];
    return idx >= 0 ? colors[idx % colors.length] : "";
  };
  const colorForRight = (righti: number) => {
    const p = pairs.findIndex(pp => pp[1] === righti);
    if (p < 0) return "";
    const colors = ["bg-sky-100 border-sky-400 text-sky-700", "bg-amber-100 border-amber-400 text-amber-700", "bg-violet-100 border-violet-400 text-violet-700", "bg-rose-100 border-rose-400 text-rose-700", "bg-emerald-100 border-emerald-400 text-emerald-700"];
    return colors[p % colors.length];
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Associe</p>
      <h2 className="text-lg font-bold mb-5">{data?.instruction}</h2>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="space-y-2">
          {left.map((item, i) => (
            <button key={i} onClick={() => tapLeft(i)} disabled={submitted || isLeftPaired(i)}
              className={`w-full p-3 rounded-xl border-2 text-sm font-medium transition ${pickedLeft === i ? "border-primary bg-primary/10" : isLeftPaired(i) ? colorFor(i) : "border-border bg-white"}`}>
              {item}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {right.map((item, j) => (
            <button key={j} onClick={() => tapRight(j)} disabled={submitted || isRightPaired(j)}
              className={`w-full p-3 rounded-xl border-2 text-sm font-medium transition ${isRightPaired(j) ? colorForRight(j) : "border-border bg-white"}`}>
              {item}
            </button>
          ))}
        </div>
      </div>
      {pairs.length > 0 && !submitted && (
        <button onClick={() => setPairs([])} className="text-xs text-muted-foreground underline mb-3">Limpar</button>
      )}
      {!submitted && (
        <Button onClick={() => { setSubmitted(true); setTimeout(() => onAnswer(isCorrect, 1), 600); }} disabled={!allPaired} className="w-full font-bold h-14 rounded-2xl">Verificar</Button>
      )}
      {submitted && !isCorrect && (
        <div className="mt-4 p-4 rounded-2xl bg-rose-50 border-2 border-rose-300">
          <p className={`font-bold mb-1 ${isCorrect ? "text-emerald-700" : "text-rose-700"}`}>{!isCorrect && "Algumas associações estavam erradas."}</p>
          {data?.explanation && <p className="text-sm text-foreground/80">{data.explanation}</p>}
        </div>
      )}
    </div>
  );
}

export function ScenarioChoiceBlock({ data, onAnswer }: RendererProps) {
  const [picked, setPicked] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const choices: any[] = data?.choices ?? [];
  const isBest = picked != null && choices[picked]?.isBest === true;

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-sky-50 border-2 border-sky-200 rounded-2xl p-4 mb-4">
        <p className="text-sm font-bold uppercase tracking-wider text-sky-700 mb-2">Cenário</p>
        <p className="text-base text-foreground leading-relaxed">{data?.scenario}</p>
      </div>
      <h2 className="text-lg font-bold mb-4">{data?.question}</h2>
      <div className="space-y-3 mb-4">
        {choices.map((c, i) => {
          const isPicked = picked === i;
          let cls = "border-border bg-white hover:border-primary";
          if (submitted) {
            if (c.isBest) cls = "border-emerald-500 bg-emerald-50";
            else if (isPicked) cls = "border-rose-500 bg-rose-50";
            else cls = "border-border bg-white opacity-60";
          } else if (isPicked) cls = "border-primary bg-primary/10";
          return (
            <button key={i} onClick={() => !submitted && setPicked(i)} disabled={submitted}
              className={`w-full text-left p-4 rounded-2xl border-2 font-medium transition ${cls}`}>
              <p className="text-base">{c.text}</p>
              {submitted && c.outcome && <p className="text-xs mt-2 opacity-70">→ {c.outcome}</p>}
            </button>
          );
        })}
      </div>
      {!submitted && (
        <Button onClick={() => { setSubmitted(true); setTimeout(() => onAnswer(isBest, 1), 800); }} disabled={picked == null} className="w-full font-bold h-14 rounded-2xl">Decidir</Button>
      )}
      {submitted && (
        <div className={`mt-4 p-4 rounded-2xl ${isBest ? "bg-emerald-50 border-2 border-emerald-300" : "bg-rose-50 border-2 border-rose-300"}`}>
          <p className={`font-bold ${isBest ? "text-emerald-700" : "text-rose-700"}`}>
            {isBest ? "Excelente decisão!" : "Existia uma escolha melhor."}
          </p>
        </div>
      )}
    </div>
  );
}

export function ReflectionBlock({ data, onAnswer }: RendererProps) {
  const [text, setText] = useState("");
  return (
    <div className="w-full max-w-md mx-auto">
      <p className="text-sm font-bold uppercase tracking-wider text-violet-600 mb-2">Reflexão</p>
      <h2 className="text-xl font-bold mb-3">{data?.question}</h2>
      {data?.guidance && <p className="text-sm text-muted-foreground mb-4">{data.guidance}</p>}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder="Anote aqui o que veio à sua mente..."
        className="w-full p-4 rounded-2xl border-2 border-border focus:border-primary outline-none text-base resize-none mb-4"
      />
      <Button onClick={() => onAnswer(true, 1)} className="w-full font-bold h-14 rounded-2xl">Continuar</Button>
    </div>
  );
}

export function FallbackBlock({ onAnswer }: RendererProps) {
  return (
    <div className="w-full max-w-md mx-auto text-center">
      <p className="text-muted-foreground mb-4">Bloco indisponível.</p>
      <Button onClick={() => onAnswer(true, 1)} variant="outline" className="rounded-2xl">Pular →</Button>
    </div>
  );
}

const Renderers: Record<string, (p: RendererProps) => JSX.Element> = {
  concept: ConceptBlock,
  example: ExampleBlock,
  quick_check: QuickCheckBlock,
  multiple_choice: MultipleChoiceBlock,
  true_false: TrueFalseBlock,
  fill_blank: FillBlankBlock,
  drag_order: DragOrderBlock,
  match_pairs: MatchPairsBlock,
  scenario_choice: ScenarioChoiceBlock,
  reflection: ReflectionBlock,
};

export function BlockRenderer({ type, data, onAnswer }: { type: string; data: any; onAnswer: (isCorrect: boolean, attempt: number) => void }) {
  const Comp = Renderers[type] ?? FallbackBlock;
  return <Comp data={data} onAnswer={onAnswer} />;
}
