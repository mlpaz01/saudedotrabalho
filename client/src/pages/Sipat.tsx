import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Calendar, Video, Image as ImageIcon, FileText, Gift, ExternalLink, Trophy, Sparkles, BookOpen, X, Award, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { toast } from "sonner";

/**
 * R5-P9 #13 — SIPAT interativa para o Colaborador.
 * Mostra a edição ATIVA da empresa: banner, tema, cronograma do evento,
 * materiais (vídeos/PDF/imagens), sorteios e atalhos pra cursos.
 */
export default function Sipat() {
  const { data, isLoading } = trpc.sipat.activeForUser.useQuery();

  // P13 #2 — Banner da SIPAT exibido automaticamente ao abrir (como nas Campanhas
  // Preventivas), com opção de fechar. Um flag por sessão evita reabrir a cada navegação.
  const [showBanner, setShowBanner] = useState(false);
  const edId = (data?.edition as any)?.id;
  const bannerUrl = (data?.edition as any)?.banner_url;
  useEffect(() => {
    if (bannerUrl && edId) {
      try {
        const key = `sipat_banner_seen_${edId}`;
        if (!sessionStorage.getItem(key)) setShowBanner(true);
      } catch { setShowBanner(true); }
    }
  }, [bannerUrl, edId]);
  function fecharBanner() {
    setShowBanner(false);
    try { if (edId) sessionStorage.setItem(`sipat_banner_seen_${edId}`, "1"); } catch { /* ignore */ }
  }

  // P15 #3 — telemetria básica de acesso ao portal da SIPAT (base dos indicadores de participação)
  const logAccessMut = (trpc.sipat as any).logAccess.useMutation();
  useEffect(() => {
    if (edId) logAccessMut.mutate({ editionId: edId, accessType: "portal" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edId]);

  const certStatusQ = (trpc.sipat as any).myCertificateStatus.useQuery({ editionId: edId }, { enabled: !!edId });
  const issueCertMut = (trpc.sipat as any).issueMyCertificate.useMutation({
    onSuccess: (r: any) => { toast.success("Certificado emitido!"); certStatusQ.refetch(); if (r?.url) window.open(r.url, "_blank"); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao emitir certificado"),
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 max-w-5xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-40 bg-muted rounded-xl" />
            <div className="h-6 bg-muted rounded w-1/3" />
            <div className="h-24 bg-muted rounded" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!data || !data.edition) {
    return (
      <AppLayout>
        <div className="p-6 max-w-3xl mx-auto text-center">
          <Sparkles size={48} className="mx-auto text-amber-400 mb-3" />
          <h1 className="text-xl font-bold mb-2">Nenhuma SIPAT ativa no momento</h1>
          <p className="text-sm text-muted-foreground">
            Quando o RH abrir a próxima Semana Interna de Prevenção de Acidentes,
            ela aparece aqui com cronograma, materiais, palestras e sorteios.
          </p>
        </div>
      </AppLayout>
    );
  }

  const ed = data.edition as any;
  const schedule = (data.schedule ?? []) as any[];
  const materials = (data.materials ?? []) as any[];
  const raffles = (data.raffles ?? []) as any[];
  const color = ed.color || "#0ea5e9";
  const banner = ed.banner_url;

  // Agrupar cronograma por dia
  const scheduleByDay = schedule.reduce((acc: Record<string, any[]>, s: any) => {
    const key = String(s.day).slice(0, 10);
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});
  const days = Object.keys(scheduleByDay).sort();

  // Separar materiais por tipo
  const videos = materials.filter((m) => m.kind === "video");
  const docs = materials.filter((m) => m.kind === "pdf" || m.kind === "document");
  const images = materials.filter((m) => m.kind === "image");
  // R5-P12 #4 — conteúdo do Estúdio inserido na SIPAT (cursos e pesquisas)
  const cursos = materials.filter((m) => m.kind === "course");
  const pesquisas = materials.filter((m) => m.kind === "survey");
  const otherMats = materials.filter((m) => !["video", "pdf", "document", "image", "course", "survey"].includes(m.kind));

  function fmtDate(iso: string) {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  }

  return (
    <AppLayout>
      {/* P13 #2 — Banner automático (popup) ao abrir a SIPAT */}
      {showBanner && banner && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4"
          onClick={fecharBanner}
        >
          <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={fecharBanner}
              aria-label="Fechar"
              className="absolute -top-3 -right-3 bg-white text-slate-700 rounded-full p-1.5 shadow-lg hover:bg-slate-100"
            >
              <X size={18} />
            </button>
            <img src={banner} alt={ed.theme || `SIPAT ${ed.year}`} className="w-full rounded-2xl shadow-2xl max-h-[80vh] object-contain bg-black" />
            <div className="text-center mt-3">
              <button onClick={fecharBanner} className="text-white/90 text-sm underline hover:text-white">
                Continuar navegando
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        {/* Banner */}
        <div
          className="rounded-2xl overflow-hidden text-white shadow-xl relative"
          style={{ background: banner ? `url(${banner}) center/cover` : `linear-gradient(135deg, ${color}, ${color}88)` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/30 to-transparent" />
          <div className="relative p-7 md:p-10">
            <p className="text-xs font-bold uppercase tracking-widest opacity-80">SIPAT {ed.year}</p>
            <h1 className="text-3xl md:text-4xl font-extrabold mt-1" style={{ fontFamily: "'Playfair Display', serif" }}>
              {ed.theme || `Semana Interna de Prevenção ${ed.year}`}
            </h1>
            {(ed.starts_at || ed.ends_at) && (
              <p className="text-sm mt-2 opacity-90 flex items-center gap-2">
                <Calendar size={14} />
                {ed.starts_at ? new Date(ed.starts_at).toLocaleDateString("pt-BR") : "—"}
                {" → "}
                {ed.ends_at ? new Date(ed.ends_at).toLocaleDateString("pt-BR") : "—"}
              </p>
            )}
          </div>
        </div>

        {/* Cronograma */}
        {days.length > 0 && (
          <section className="bg-white border rounded-xl p-5">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color }}>
              <Calendar size={18} /> Cronograma
            </h2>
            <div className="space-y-4">
              {days.map((d) => (
                <div key={d}>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 capitalize">{fmtDate(d)}</p>
                  <div className="space-y-2">
                    {scheduleByDay[d].map((s) => (
                      <div key={s.id} className="border-l-4 pl-3 py-1.5" style={{ borderColor: color }}>
                        <div className="flex items-baseline gap-2">
                          {s.time && <span className="text-xs font-bold text-slate-500">{String(s.time).slice(0, 5)}</span>}
                          <span className="font-semibold text-sm">{s.title}</span>
                        </div>
                        {s.description && <p className="text-xs text-slate-600 mt-0.5">{s.description}</p>}
                        {s.meeting_url && (
                          <a href={s.meeting_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-1">
                            <Video size={11} /> Entrar na palestra
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* R5-P12 #4 — Cursos e pesquisas do Estúdio adicionados à SIPAT */}
        {(cursos.length > 0 || pesquisas.length > 0) && (
          <section className="bg-white border rounded-xl p-5">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><Sparkles size={18} className="text-emerald-600" /> Cursos e pesquisas da SIPAT</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {cursos.map((m) => (
                <Link key={m.id} href={m.url}>
                  <a className="block border rounded-lg p-3 hover:shadow-md hover:border-emerald-300 transition-all">
                    <BookOpen size={18} className="text-emerald-600 mb-1" />
                    <p className="font-semibold text-sm">{m.title}</p>
                    <p className="text-xs text-slate-500 mt-1">Curso · começar →</p>
                  </a>
                </Link>
              ))}
              {pesquisas.map((m) => (
                <Link key={m.id} href={m.url}>
                  <a className="block border rounded-lg p-3 hover:shadow-md hover:border-sky-300 transition-all">
                    <FileText size={18} className="text-sky-600 mb-1" />
                    <p className="font-semibold text-sm">{m.title}</p>
                    <p className="text-xs text-slate-500 mt-1">Pesquisa · responder →</p>
                  </a>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Vídeos */}
        {videos.length > 0 && (
          <section className="bg-white border rounded-xl p-5">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><Video size={18} className="text-rose-600" /> Vídeos e Palestras gravadas</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {videos.map((m) => (
                <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className="block border rounded-lg p-3 hover:shadow-md hover:border-rose-300 transition-all">
                  <Video size={18} className="text-rose-600 mb-1" />
                  <p className="font-semibold text-sm">{m.title}</p>
                  <p className="text-xs text-slate-500 mt-1 inline-flex items-center gap-1">Assistir <ExternalLink size={10} /></p>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* PDFs e materiais */}
        {(docs.length > 0 || otherMats.length > 0) && (
          <section className="bg-white border rounded-xl p-5">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><FileText size={18} className="text-blue-600" /> Materiais para download</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {[...docs, ...otherMats].map((m) => (
                <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className="block border rounded-lg p-3 hover:shadow-md hover:border-blue-300 transition-all">
                  <FileText size={18} className="text-blue-600 mb-1" />
                  <p className="font-semibold text-sm">{m.title}</p>
                  <p className="text-xs text-slate-500 mt-1 uppercase">{m.kind}</p>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Imagens */}
        {images.length > 0 && (
          <section className="bg-white border rounded-xl p-5">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><ImageIcon size={18} className="text-purple-600" /> Galeria</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {images.map((m) => (
                <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className="block group">
                  <img src={m.url} alt={m.title} className="w-full h-40 object-cover rounded-lg group-hover:opacity-90 transition-opacity" />
                  <p className="text-xs text-slate-600 mt-1 truncate">{m.title}</p>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Sorteios */}
        {raffles.length > 0 && (
          <section className="bg-gradient-to-br from-amber-50 to-yellow-100 border border-amber-200 rounded-xl p-5">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2 text-amber-900"><Gift size={18} /> Sorteios</h2>
            <div className="space-y-2">
              {raffles.map((r) => (
                <div key={r.id} className="bg-white border rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm flex items-center gap-2">
                      <Trophy size={14} className="text-amber-600" />
                      {r.prize}
                    </p>
                    {r.winner_name ? (
                      <p className="text-xs text-emerald-700 mt-1">🎉 Sorteado: <b>{r.winner_name}</b></p>
                    ) : (
                      <p className="text-xs text-slate-500 mt-1">Aguardando sorteio</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Cursos liberados durante a SIPAT */}
        <section className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <h2 className="text-lg font-bold mb-2 flex items-center gap-2 text-emerald-900"><Sparkles size={18} /> Continue sua jornada</h2>
          <p className="text-sm text-emerald-800 mb-3">
            Aproveite a SIPAT pra avançar nos cursos disponíveis, conquistar certificados e pontos.
          </p>
          <div className="flex gap-2">
            <Link href="/cursos"><a className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Ver meus cursos</a></Link>
            <Link href="/certificados"><a className="inline-flex items-center gap-2 border border-emerald-600 text-emerald-700 hover:bg-white text-sm font-semibold px-4 py-2 rounded-lg">Meus certificados</a></Link>
          </div>
        </section>

        {/* P15 #3 — Certificado de Participação da SIPAT */}
        {certStatusQ.data && certStatusQ.data.requiredCourses > 0 && (
          <section className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
            <h2 className="text-lg font-bold mb-2 flex items-center gap-2 text-indigo-900"><Award size={18} /> Certificado de Participação</h2>
            {certStatusQ.data.alreadyIssued ? (
              <div className="flex items-center gap-2">
                <p className="text-sm text-indigo-800">Seu certificado desta SIPAT já foi emitido.</p>
                {certStatusQ.data.certUrl && (
                  <a href={certStatusQ.data.certUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-indigo-700 hover:underline">Baixar novamente</a>
                )}
              </div>
            ) : certStatusQ.data.eligible ? (
              <div>
                <p className="text-sm text-indigo-800 mb-3">Você concluiu todos os cursos vinculados a esta SIPAT — seu certificado está pronto para ser emitido.</p>
                <button
                  onClick={() => issueCertMut.mutate({ editionId: edId })}
                  disabled={issueCertMut.isPending}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
                >
                  {issueCertMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Award size={14} />} Emitir meu certificado
                </button>
              </div>
            ) : (
              <p className="text-sm text-indigo-800">
                Conclua os cursos vinculados a esta SIPAT para liberar seu certificado ({certStatusQ.data.completedCourses}/{certStatusQ.data.requiredCourses} concluídos).
              </p>
            )}
          </section>
        )}
      </div>
    </AppLayout>
  );
}
