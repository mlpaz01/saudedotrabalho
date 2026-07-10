import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  HeartPulse,
  Link2,
  PlayCircle,
  ShieldCheck,
  Video,
} from "lucide-react";
import { toast } from "sonner";

type FirstAidItem = {
  id: number;
  contentType: "course" | "material" | "video" | "link";
  moduleId: number | null;
  title: string;
  description?: string | null;
  url?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  provider?: string | null;
  isRequired: boolean;
  validityMonths?: number | null;
  durationMinutes?: number;
  percent: number;
  isCompleted: boolean;
  timeSpentSeconds: number;
  certificate?: { code: string; url?: string | null } | null;
};

function pct(n: number) {
  return `${Math.max(0, Math.min(100, Math.round(Number(n || 0))))}%`;
}

function embedUrl(url?: string | null) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "");
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : url;
    }
  } catch (_) {}
  return url;
}

export default function FirstAid() {
  const q = (trpc.firstaid as any).learningForEmployee.useQuery();
  const markMut = (trpc.firstaid as any).markLearningProgress.useMutation({
    onSuccess: () => {
      q.refetch();
      toast.success("Progresso registrado.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Nao foi possivel registrar o progresso."),
  });

  const data = q.data as any;
  const summary = data?.summary ?? { total: 0, completed: 0, required: 0, pendingRequired: 0, certificates: 0 };
  const courses = (data?.courses ?? []) as FirstAidItem[];
  const resources = (data?.resources ?? []) as FirstAidItem[];

  function mark(item: FirstAidItem, completed = false) {
    markMut.mutate({
      contentId: item.id,
      percentWatched: completed ? 100 : Math.max(item.percent || 0, 10),
      timeSpentSeconds: completed ? 60 : 15,
      completed,
    });
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-6 space-y-6">
          <header className="rounded-lg border border-emerald-200 bg-white p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-700">
                  <HeartPulse size={16} /> Area permanente de aprendizagem
                </div>
                <h1 className="mt-2 text-2xl font-bold text-slate-900">Nocoes de Primeiros Socorros</h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-600">
                  Conteudos educativos, treinamentos e materiais de apoio disponibilizados pela empresa.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:min-w-[420px]">
                <Metric label="Conteudos" value={summary.total} />
                <Metric label="Concluidos" value={summary.completed} />
                <Metric label="Obrigatorios" value={summary.required} />
                <Metric label="Certificados" value={summary.certificates} />
              </div>
            </div>
          </header>

          {q.isLoading && (
            <div className="rounded-lg border bg-white p-10 text-center text-sm text-slate-500">Carregando conteudos...</div>
          )}

          {!q.isLoading && summary.total === 0 && (
            <div className="rounded-lg border-2 border-dashed bg-white p-10 text-center">
              <ShieldCheck size={42} className="mx-auto text-emerald-600" />
              <h2 className="mt-3 text-lg font-semibold text-slate-900">Nenhum conteudo publicado ainda.</h2>
              <p className="mt-1 text-sm text-slate-500">Quando RH ou SESMT liberar materiais de primeiros socorros, eles aparecerao aqui.</p>
            </div>
          )}

          {courses.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                  <BookOpen size={18} className="text-emerald-700" /> Cursos da plataforma
                </h2>
                {summary.pendingRequired > 0 && (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                    {summary.pendingRequired} obrigatorio(s) pendente(s)
                  </span>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {courses.map((course) => (
                  <div key={course.id} className="rounded-lg border bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-900">{course.title}</h3>
                          {course.isRequired && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">Obrigatorio</span>}
                        </div>
                        {course.description && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{course.description}</p>}
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          {course.durationMinutes ? <span className="inline-flex items-center gap-1"><Clock size={13} /> {course.durationMinutes} min</span> : null}
                          {course.certificate ? <span className="inline-flex items-center gap-1 text-emerald-700"><Award size={13} /> Certificado emitido</span> : null}
                        </div>
                      </div>
                      <Status done={course.isCompleted} />
                    </div>
                    <Progress value={course.percent} />
                    <div className="mt-4 flex flex-wrap gap-2">
                      {course.moduleId && (
                        <Link href={`/cursos/${course.moduleId}`}>
                          <a className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
                            <PlayCircle size={15} /> {course.percent > 0 ? "Continuar" : "Iniciar"}
                          </a>
                        </Link>
                      )}
                      {course.certificate?.url && (
                        <a href={course.certificate.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                          <Award size={15} /> Ver certificado
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {resources.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <FileText size={18} className="text-sky-700" /> Materiais, videos e links
              </h2>
              <div className="grid gap-3 lg:grid-cols-3">
                {resources.map((item) => (
                  <ResourceCard key={item.id} item={item} onStart={() => mark(item)} onComplete={() => mark(item, true)} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="text-[11px] font-semibold uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <div className="mt-4">
      <div className="mb-1 flex justify-between text-xs font-medium text-slate-500">
        <span>Progresso</span>
        <span>{pct(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-emerald-600" style={{ width: pct(value) }} />
      </div>
    </div>
  );
}

function Status({ done }: { done: boolean }) {
  return done ? (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
      <CheckCircle2 size={13} /> Concluido
    </span>
  ) : (
    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">Pendente</span>
  );
}

function ResourceCard({ item, onStart, onComplete }: { item: FirstAidItem; onStart: () => void; onComplete: () => void }) {
  const href = item.fileUrl || item.url || "#";
  const embedded = item.contentType === "video" ? embedUrl(item.url || item.fileUrl) : null;
  const Icon = item.contentType === "video" ? Video : item.contentType === "link" ? Link2 : FileText;

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-sky-50 text-sky-700">
            <Icon size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-slate-900">{item.title}</h3>
              {item.isRequired && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">Obrigatorio</span>}
            </div>
            {item.description && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{item.description}</p>}
          </div>
        </div>
        <Status done={item.isCompleted} />
      </div>

      {embedded && (
        <div className="mt-3 aspect-video overflow-hidden rounded-md border bg-slate-100">
          <iframe title={item.title} src={embedded} className="h-full w-full" allowFullScreen onLoad={onStart} />
        </div>
      )}

      <Progress value={item.percent} />

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          onClick={onStart}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ExternalLink size={15} /> Abrir
        </a>
        {!item.isCompleted && (
          <button onClick={onComplete} className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
            <CheckCircle2 size={15} /> Marcar concluido
          </button>
        )}
      </div>
    </div>
  );
}
