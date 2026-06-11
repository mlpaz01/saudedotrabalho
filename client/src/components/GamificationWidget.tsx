import { trpc } from "@/lib/trpc";
import { Star, Trophy, Zap } from "lucide-react";

const LEVELS = [
  { name: "Iniciante", min: 0, max: 99, color: "text-gray-500", bg: "bg-gray-100" },
  { name: "Aprendiz", min: 100, max: 299, color: "text-blue-600", bg: "bg-blue-100" },
  { name: "Profissional", min: 300, max: 699, color: "text-green-600", bg: "bg-green-100" },
  { name: "Especialista", min: 700, max: 1499, color: "text-purple-600", bg: "bg-purple-100" },
  { name: "Mestre SST", min: 1500, max: Infinity, color: "text-amber-600", bg: "bg-amber-100" },
];

function getLevel(points: number) {
  return LEVELS.find(l => points >= l.min && points <= l.max) ?? LEVELS[0];
}

export default function GamificationWidget() {
  const { data } = trpc.gamification.myPoints.useQuery(undefined, { staleTime: 60_000 });
  const points = data?.total ?? 0;
  const level = getLevel(points);
  const nextLevel = LEVELS.find(l => l.min > points);
  const pct = nextLevel ? Math.min(100, ((points - level.min) / (nextLevel.min - level.min)) * 100) : 100;

  return (
    <div className="mx-3 mb-3 rounded-xl border border-sidebar-border bg-sidebar-accent/30 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-full ${level.bg} flex items-center justify-center`}>
          <Trophy size={14} className={level.color} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-sidebar-foreground truncate">{level.name}</p>
          <p className="text-xs text-sidebar-foreground/60">{points} pontos</p>
        </div>
        <Star size={14} className="text-amber-400" />
      </div>
      {nextLevel && (
        <div>
          <div className="flex justify-between text-xs text-sidebar-foreground/50 mb-1">
            <span></span>
            <span>Prox: {nextLevel.name} ({nextLevel.min}pts)</span>
          </div>
          <div className="h-1.5 bg-sidebar-border rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      {!nextLevel && (
        <p className="text-xs text-amber-600 font-medium flex items-center gap-1"><Zap size={12} /> Nivel maximo atingido!</p>
      )}
    </div>
  );
}
