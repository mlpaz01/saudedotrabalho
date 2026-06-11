import { trpc } from "@/lib/trpc";
import { Heart, Flame, Star } from "lucide-react";

export default function HeartsXpHud({ compact = false }: { compact?: boolean }) {
  const { data } = trpc.missao.getUserStats.useQuery(undefined, {
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  });
  const hearts = data?.hearts ?? 5;
  const streak = data?.streakDays ?? 0;
  const xp = data?.totalXp ?? 0;

  return (
    <div className={`flex items-center gap-${compact ? 3 : 4} ${compact ? "text-sm" : ""}`}>
      <div className="flex items-center gap-1.5 font-bold">
        <Heart className={`${compact ? "w-4 h-4" : "w-5 h-5"} text-rose-500 fill-rose-500`} />
        <span className="text-rose-600">{hearts}</span>
      </div>
      <div className="flex items-center gap-1.5 font-bold">
        <Flame className={`${compact ? "w-4 h-4" : "w-5 h-5"} text-orange-500 fill-orange-400`} />
        <span className="text-orange-600">{streak}</span>
      </div>
      <div className="flex items-center gap-1.5 font-bold">
        <Star className={`${compact ? "w-4 h-4" : "w-5 h-5"} text-amber-500 fill-amber-400`} />
        <span className="text-amber-700">{xp}</span>
      </div>
    </div>
  );
}
