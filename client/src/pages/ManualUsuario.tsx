import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  ExternalLink,
  HelpCircle,
  Loader2,
  Search,
  Wrench,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

export default function ManualUsuario() {
  const initialSlug = new URLSearchParams(window.location.search).get("artigo");
  const [query, setQuery] = useState("");
  const [module, setModule] = useState("");
  const [slug, setSlug] = useState<string | null>(initialSlug);
  const searchQ = (trpc.knowledge as any).search.useQuery({
    query,
    module: module || undefined,
    limit: 40,
  });
  const articleQ = (trpc.knowledge as any).get.useQuery(
    { slug: slug || "_" },
    { enabled: !!slug }
  );
  const articles = (searchQ.data?.articles ?? []) as any[];
  const modules = (searchQ.data?.modules ?? []) as string[];

  useEffect(() => {
    const url = new URL(window.location.href);
    if (slug) url.searchParams.set("artigo", slug);
    else url.searchParams.delete("artigo");
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }, [slug]);

  return (
    <AppLayout>
      <main className="mx-auto max-w-6xl p-6">
        {slug ? (
          <Article
            article={articleQ.data}
            loading={articleQ.isLoading}
            onBack={() => setSlug(null)}
          />
        ) : (
          <>
            <header className="mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                  <BookOpen size={22} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-primary">
                    Manual do Usuário
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Procedimentos da plataforma organizados para o seu perfil de
                    acesso.
                  </p>
                </div>
              </div>
            </header>
            <section className="border-y bg-white py-5">
              <label
                className="text-sm font-semibold text-slate-800"
                htmlFor="knowledge-search"
              >
                O que você precisa fazer?
              </label>
              <div className="relative mt-2">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <Input
                  id="knowledge-search"
                  className="h-12 pl-10 text-base"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Ex.: Como cobrar somente a filial Bahia?"
                />
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                <button
                  className={`whitespace-nowrap rounded-md border px-3 py-1.5 text-sm ${!module ? "border-primary bg-primary text-white" : "bg-white"}`}
                  onClick={() => setModule("")}
                >
                  Todos
                </button>
                {modules.map(item => (
                  <button
                    key={item}
                    className={`whitespace-nowrap rounded-md border px-3 py-1.5 text-sm ${module === item ? "border-primary bg-primary text-white" : "bg-white"}`}
                    onClick={() => setModule(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </section>
            {searchQ.isLoading ? (
              <div className="flex justify-center p-16">
                <Loader2 className="animate-spin" />
              </div>
            ) : (
              <section className="grid gap-3 py-6 md:grid-cols-2">
                {articles.map(article => (
                  <button
                    key={article.slug}
                    onClick={() => setSlug(article.slug)}
                    className="border-b bg-white p-4 text-left transition-colors hover:bg-slate-50"
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <span className="rounded bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase text-slate-600">
                        {article.module}
                      </span>
                      <ExternalLink size={15} className="text-slate-400" />
                    </div>
                    <h2 className="font-semibold text-slate-900">
                      {article.title}
                    </h2>
                    <p className="mt-1 text-sm leading-5 text-slate-600">
                      {article.summary}
                    </p>
                    <div className="mt-3 text-xs font-medium text-primary">
                      {article.accessPath}
                    </div>
                  </button>
                ))}
              </section>
            )}
            {!searchQ.isLoading && !articles.length && (
              <div className="py-16 text-center">
                <HelpCircle className="mx-auto text-slate-400" />
                <h2 className="mt-3 font-semibold">Nenhum artigo encontrado</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Tente outra palavra ou abra o Suporte para consultar a IA.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </AppLayout>
  );
}

function Article({
  article,
  loading,
  onBack,
}: {
  article: any;
  loading: boolean;
  onBack: () => void;
}) {
  if (loading || !article)
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="animate-spin" />
      </div>
    );
  return (
    <article>
      <Button variant="ghost" className="mb-4 -ml-3" onClick={onBack}>
        <ArrowLeft size={16} />
        Voltar ao manual
      </Button>
      <header className="border-b pb-5">
        <div className="text-xs font-semibold uppercase text-emerald-700">
          {article.module}
        </div>
        <h1 className="mt-1 text-3xl font-bold text-primary">
          {article.title}
        </h1>
        <p className="mt-2 max-w-3xl text-slate-600">{article.summary}</p>
        <div className="mt-4 inline-flex rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
          Caminho: {article.accessPath}
        </div>
      </header>
      <div className="grid gap-8 py-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <DocSection title="O que é?">
            <p>{article.whatIs}</p>
          </DocSection>
          <DocSection title="Para que serve?">
            <p>{article.purpose}</p>
          </DocSection>
          <DocSection title="Passo a passo">
            <ol className="space-y-3">
              {article.steps.map((step: string, index: number) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </DocSection>
          {article.screenshots?.length > 0 && (
            <DocSection title="Telas da plataforma">
              <div className="space-y-4">
                {article.screenshots.map((shot: any) => (
                  <figure key={shot.url}>
                    <img
                      src={shot.url}
                      alt={shot.alt}
                      className="w-full border"
                    />
                    <figcaption className="mt-1 text-xs text-slate-500">
                      {shot.caption || shot.alt}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </DocSection>
          )}
          {article.videoUrl && (
            <DocSection title="Vídeo de orientação">
              <a href={article.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-white">
                <ExternalLink size={16} /> Assistir ao vídeo
              </a>
            </DocSection>
          )}
          <DocSection title="Perguntas frequentes">
            <div className="divide-y">
              {article.faq.length ? (
                article.faq.map((item: any) => (
                  <details key={item.question} className="py-3">
                    <summary className="cursor-pointer font-semibold">
                      {item.question}
                    </summary>
                    <p className="mt-2 text-sm text-slate-600">{item.answer}</p>
                  </details>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  Nenhuma pergunta frequente cadastrada para este artigo.
                </p>
              )}
            </div>
          </DocSection>
          <DocSection title="Problemas comuns">
            <div className="space-y-3">
              {article.problems.length ? (
                article.problems.map((item: any) => (
                  <div
                    key={item.problem}
                    className="border-l-2 border-amber-400 pl-3"
                  >
                    <b>{item.problem}</b>
                    <p className="mt-1 text-sm text-slate-600">
                      {item.solution}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  Consulte os cuidados ao lado ou utilize o Suporte.
                </p>
              )}
            </div>
          </DocSection>
        </div>
        <aside>
          <div className="sticky top-4 border-y bg-amber-50 py-4">
            <h2 className="flex items-center gap-2 font-semibold text-amber-900">
              <AlertTriangle size={17} />
              Cuidados e observações
            </h2>
            <ul className="mt-3 space-y-3 text-sm text-amber-950">
              {article.cautions.map((item: string) => (
                <li key={item} className="flex gap-2">
                  <span>•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <a
            href={article.route}
            className="mt-4 flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-white"
          >
            <Wrench size={16} />
            Abrir funcionalidade
          </a>
          <div className="mt-3 text-center text-xs text-slate-400">
            Atualizado em{" "}
            {new Date(`${article.updatedAt}T12:00:00`).toLocaleDateString(
              "pt-BR"
            )}
          </div>
        </aside>
      </div>
    </article>
  );
}

function DocSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-xl font-bold text-primary">{title}</h2>
      <div className="leading-7 text-slate-700">{children}</div>
    </section>
  );
}
