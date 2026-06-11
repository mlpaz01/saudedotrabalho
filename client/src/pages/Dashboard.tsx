import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PlayCircle, Clock, BookOpen, ArrowRight } from "lucide-react";

function ModuleCard({ module, progress, cert }: { module: any; progress?: any; cert?: boolean }) {
  const pct = progress?.percentWatched ?? 0;
  const completed = cert || progress?.isCompleted;
  return (
    <Link href={'/modulos/' + module.id}>
      <div className="group flex-shrink-0 w-60 rounded-xl overflow-hidden border bg-card hover:shadow-lg transition-all cursor-pointer">
        <div className="relative h-32 bg-gradient-to-br from-primary/20 to-teal-500/10 flex items-center justify-center overflow-hidden">
          {module.thumbnailUrl ? <img src={module.thumbnailUrl} alt={module.title} className="w-full h-full object-cover" /> : <BookOpen className="w-10 h-10 text-primary/30" />}
          {completed && <div className="absolute top-2 right-2"><Badge className="bg-green-500 text-white text-xs">Concluido</Badge></div>}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <PlayCircle className="w-12 h-12 text-white opacity-0 group-hover:opacity-90 transition-opacity" />
          </div>
        </div>
        <div className="p-3">
          <h3 className="font-semibold text-sm leading-tight mb-2 line-clamp-2">{module.title}</h3>
          {module.durationMinutes && <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2"><Clock className="w-3 h-3" />{module.durationMinutes} min</div>}
          {pct > 0 && !completed && <><Progress value={pct} className="h-1.5 mb-1" /><p className="text-xs text-muted-foreground">{pct}% concluido</p></>}
        </div>
      </div>
    </Link>
  );
}

function HScroll({ title, items, progressMap, certSet }: { title: string; items: any[]; progressMap: Record<number,any>; certSet: Set<number> }) {
  if (!items.length) return null;
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4"><h2 className="text-lg font-bold">{title}</h2><Badge variant="secondary">{items.length}</Badge></div>
      <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide">
        {items.map(m => <ModuleCard key={m.id} module={m} progress={progressMap[m.id]} cert={certSet.has(m.id)} />)}
      </div>
    </section>
  );
}

export default function Dashboard() {
  const { data: modules } = trpc.modules.list.useQuery();
  const { data: progressList } = trpc.progress.getUserProgress.useQuery();
  const { data: certs } = trpc.certificates.getUserCertificates.useQuery();
  const progressMap = useMemo(() => {
    const map: Record<number, any> = {};
    (progressList ?? []).forEach((p: any) => { map[p.moduleId] = p; });
    return map;
  }, [progressList]);
  const certSet = useMemo(() => new Set((certs ?? []).map((c: any) => c.moduleId)), [certs]);
  const active = (modules ?? []).filter((m: any) => m.isActive);
  const inProgress = active.filter(m => (progressMap[m.id]?.percentWatched ?? 0) > 0 && !progressMap[m.id]?.isCompleted && !certSet.has(m.id));
  const notStarted = active.filter(m => !(progressMap[m.id]?.percentWatched > 0) && !certSet.has(m.id));
  const completed = active.filter(m => progressMap[m.id]?.isCompleted || certSet.has(m.id));
  const cont = [...inProgress].sort((a,b) => (progressMap[b.id]?.percentWatched??0)-(progressMap[a.id]?.percentWatched??0))[0];
  return (
    <div className="p-6 max-w-5xl mx-auto">
      {cont && (
        <Card className="mb-8 bg-gradient-to-r from-primary to-primary/80 text-white overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">Continue de onde parou</p>
              <h2 className="text-lg font-bold mb-2 truncate">{cont.title}</h2>
              <div className="flex items-center gap-3">
                <Progress value={progressMap[cont.id]?.percentWatched ?? 0} className="h-2 flex-1 bg-white/30" />
                <span className="text-sm font-bold whitespace-nowrap">{progressMap[cont.id]?.percentWatched ?? 0}%</span>
              </div>
            </div>
            <Link href={'/modulos/' + cont.id}>
              <Button variant="secondary" size="lg" className="gap-2 flex-shrink-0 font-bold">Continuar <ArrowRight className="w-5 h-5" /></Button>
            </Link>
          </CardContent>
        </Card>
      )}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-primary">{inProgress.length}</p><p className="text-xs text-muted-foreground mt-1">Em andamento</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-green-500">{completed.length}</p><p className="text-xs text-muted-foreground mt-1">Concluidos</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-yellow-500">{(certs??[]).length}</p><p className="text-xs text-muted-foreground mt-1">Certificados</p></CardContent></Card>
      </div>
      <HScroll title="Em andamento" items={inProgress} progressMap={progressMap} certSet={certSet} />
      <HScroll title="Disponiveis" items={notStarted} progressMap={progressMap} certSet={certSet} />
      <HScroll title="Concluidos" items={completed} progressMap={progressMap} certSet={certSet} />
    </div>
  );
}
