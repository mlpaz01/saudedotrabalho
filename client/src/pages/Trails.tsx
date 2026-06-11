import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Route, BookOpen, CheckCircle2, Lock, ChevronRight, Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function Trails() {
  const trailsQ = trpc.trails.listActive.useQuery();
  const progressQ = trpc.progress.getUserProgress.useQuery();
  const trails = trailsQ.data ?? [];
  const progressList = progressQ.data ?? [];

  function getModuleCompleted(moduleId: number) {
    return progressList.find(p => p.moduleId === moduleId)?.isCompleted ?? false;
  }

  if (trailsQ.isLoading) return (
    <AppLayout>
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="relative pl-4">
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary to-transparent" />
          <h1 className="text-3xl font-bold text-primary" style={{ fontFamily: "'Playfair Display', serif" }}>
            Trilhas de Aprendizagem
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Sua jornada de desenvolvimento em saude e bem-estar</p>
        </div>

        {trails.length === 0 && (
          <div className="bg-white rounded-xl border border-border p-12 text-center">
            <Route size={40} className="mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-medium">Nenhuma trilha disponivel no momento</p>
          </div>
        )}

        <div className="space-y-6">
          {trails.map((trail) => (
            <TrailCard key={trail.id} trail={trail} getModuleCompleted={getModuleCompleted} />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

function TrailCard({ trail, getModuleCompleted }: { trail: any; getModuleCompleted: (id: number) => boolean }) {
  const [expanded, setExpanded] = useState(false);
  const trailModsQ = trpc.trails.getModules.useQuery({ trailId: trail.id });
  const modulesQ = trpc.modules.list.useQuery();
  const trailMods = trailModsQ.data ?? [];
  const allModules = modulesQ.data ?? [];

  const completedCount = trailMods.filter(tm => tm.moduleId != null && getModuleCompleted(tm.moduleId)).length;
  const pct = trailMods.length > 0 ? Math.round((completedCount / trailMods.length) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
      {/* Trail header */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          {trail.thumbnailUrl ? (
            <img src={trail.thumbnailUrl} alt={trail.title} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
              <Route size={28} className="text-white" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-bold text-lg text-primary truncate" style={{ fontFamily: "'Playfair Display', serif" }}>{trail.title}</h2>
              {trail.isSequential && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 flex-shrink-0">Sequencial</span>}
            </div>
            {trail.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{trail.description}</p>}
            {trail.objective && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground mb-3">
                <Target size={14} className="text-accent flex-shrink-0 mt-0.5" />
                <span className="italic">{trail.objective}</span>
              </div>
            )}
            {trailMods.length > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{completedCount}/{trailMods.length} modulos concluidos</span>
                  <span className="font-medium text-primary">{pct}%</span>
                </div>
                <Progress value={pct} className="h-2" />
              </div>
            )}
          </div>
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-primary transition-colors mt-1">
            <ChevronRight size={20} className={`transition-transform ${expanded ? "rotate-90" : ""}`} />
          </button>
        </div>
      </div>

      {/* Trail modules */}
      {expanded && (
        <div className="border-t border-border divide-y divide-border">
          {trailMods.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">Nenhum modulo nesta trilha.</div>}
          {trailMods.map((tm: any, idx: number) => {
            const mod = allModules.find(m => m.id === tm.moduleId);
            if (!mod) return null;
            const done = tm.moduleId != null ? getModuleCompleted(tm.moduleId) : false;
            const locked = trail.isSequential && idx > 0 && trailMods[idx - 1].moduleId != null && !getModuleCompleted(trailMods[idx - 1].moduleId!);

            return (
              <div key={tm.id} className={`flex items-center gap-4 p-4 ${locked ? "opacity-50" : ""}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${done ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                  {done ? <CheckCircle2 size={18} /> : locked ? <Lock size={14} /> : idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{mod.title}</p>
                  <p className="text-xs text-muted-foreground">{mod.durationMinutes ?? 0} min</p>
                </div>
                {!locked && (
                  <Link href={`/modulos/${mod.id}`}>
                    <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${done ? "bg-green-100 text-green-700" : "bg-primary text-white"}`}>
                      {done ? "Revisar" : "Iniciar"}
                    </span>
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
