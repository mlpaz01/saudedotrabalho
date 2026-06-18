import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Library, BookOpen, ClipboardList, Leaf, Sparkles, Wand2,
  CheckCircle2, Brain, ShieldAlert, BarChart3, Clock, Loader2, Search,
  Wind, Eye, Zap, Dumbbell, ClipboardCheck, PlusCircle, Play,
  HeartPulse, Send,
} from "lucide-react";
import { HEALTH_CAMPAIGNS, type HealthCampaignTemplate } from "@/data/healthCampaigns";

/* ─── CSS ─────────────────────────────────────────────────────────── */
const CSS = `
.ucg-page { background: #F4F6F9; min-height: 100vh; }
.ucg-wrap { padding: 24px 30px 44px; max-width: 1680px; margin: 0 auto; }
.ucg-header { margin-bottom: 20px; }
.ucg-title { font-family: 'Lora', 'Playfair Display', Georgia, serif; font-size: 28px; font-weight: 700; color: #0E2C46; letter-spacing: -0.01em; }
.ucg-subtitle { font-size: 13.5px; color: #62707D; margin-top: 6px; font-weight: 500; line-height: 1.5; }
.ucg-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 22px; flex-wrap: wrap; }
.ucg-search-wrap { position: relative; flex: 1; min-width: 200px; max-width: 380px; }
.ucg-search-wrap svg.search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 15px; height: 15px; color: #94a3b8; stroke: currentColor; fill: none; stroke-width: 2; pointer-events: none; }
.ucg-search { width: 100%; padding: 9px 13px 9px 34px; border: 1.5px solid #E0E6ED; border-radius: 11px; font-size: 13px; font-family: inherit; background: #fff; outline: none; color: #1C2A36; box-shadow: 0 1px 3px rgba(0,0,0,.04); transition: border-color .15s, box-shadow .15s; }
.ucg-search:focus { border-color: #2EA56A; box-shadow: 0 0 0 3px rgba(46,165,106,.1); }
.ucg-search::placeholder { color: #94a3b8; }
.ucg-filters { display: flex; gap: 6px; flex-wrap: wrap; }
.ucg-pill { padding: 7px 16px; border-radius: 999px; font-size: 12.5px; font-weight: 600; cursor: pointer; border: 1.5px solid #E0E6ED; background: #fff; color: #62707D; transition: all .15s; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; }
.ucg-pill:hover { border-color: #0E2C46; color: #0E2C46; }
.ucg-pill.active { background: #0E2C46; color: #fff; border-color: #0E2C46; }
.ucg-pill svg { width: 14px; height: 14px; }
.ucg-count { font-size: 11px; font-weight: 700; padding: 1px 6px; border-radius: 20px; background: rgba(255,255,255,.2); }
.ucg-pill:not(.active) .ucg-count { background: rgba(14,44,70,.08); color: #0E2C46; }
.ucg-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
@media (max-width: 1280px) { .ucg-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 900px)  { .ucg-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 560px)  { .ucg-grid { grid-template-columns: 1fr; } }
.ucg-card { background: #fff; border: 1.5px solid #E9EDF2; border-radius: 16px; overflow: hidden; transition: box-shadow .18s, transform .18s, border-color .18s; display: flex; flex-direction: column; }
.ucg-card:hover { box-shadow: 0 8px 28px -8px rgba(14,44,70,.15); transform: translateY(-2px); border-color: #D4DCE6; }
.ucg-stripe { height: 5px; flex-shrink: 0; }
.ucg-body { padding: 14px 16px 16px; flex: 1; display: flex; flex-direction: column; gap: 8px; }
.ucg-cat-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.ucg-cat { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; width: fit-content; }
.ucg-anon { font-size: 11px; color: #92A0AC; font-weight: 500; white-space: nowrap; }
.ucg-card-title { font-size: 14px; font-weight: 700; color: #0E2C46; line-height: 1.35; letter-spacing: -0.01em; }
.ucg-card-desc { font-size: 12.5px; color: #62707D; line-height: 1.5; flex: 1; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.ucg-meta { display: flex; align-items: center; gap: 12px; font-size: 11.5px; color: #92A0AC; font-weight: 500; flex-wrap: wrap; margin-top: 2px; }
.ucg-meta svg { width: 13px; height: 13px; stroke: currentColor; fill: none; stroke-width: 2; flex-shrink: 0; }
.ucg-meta span { display: flex; align-items: center; gap: 4px; }
.ucg-footer { display: flex; gap: 6px; margin-top: 10px; padding-top: 10px; border-top: 1px solid #EFF2F6; }
.ucg-footer-btn { flex: 1; padding: 7px 10px; border-radius: 9px; font-size: 12px; font-weight: 600; border: none; cursor: pointer; transition: all .14s; display: flex; align-items: center; justify-content: center; gap: 5px; white-space: nowrap; }
.ucg-footer-btn svg { width: 13px; height: 13px; stroke: currentColor; fill: none; stroke-width: 2; }
.ucg-footer-primary { background: #0E2C46; color: #fff; }
.ucg-footer-primary:hover { background: #123451; }
.ucg-footer-ghost { background: #F4F6F9; color: #0E2C46; flex: 0 0 auto; }
.ucg-footer-ghost:hover { background: #E9EDF2; }
.ucg-empty { grid-column: 1/-1; text-align: center; padding: 60px 20px; color: #92A0AC; }
.ucg-empty svg { width: 40px; height: 40px; margin: 0 auto 12px; opacity: .3; }
.ucg-empty p { font-size: 14px; font-weight: 500; }
.ucg-empty small { font-size: 12.5px; margin-top: 4px; display: block; }
.ucg-skel { background: linear-gradient(90deg,#E9EDF2 0%,#F4F6F9 50%,#E9EDF2 100%); background-size: 200% 100%; animation: shimmer 1.3s infinite; border-radius: 8px; }
@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
.ucg-month-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #92A0AC; margin: 0 0 10px; }
.ucg-health-banner { background: #FFF8F0; border: 1.5px solid #FFE4B5; border-radius: 14px; padding: 14px 18px; display: flex; gap: 12px; align-items: flex-start; margin-bottom: 6px; }
.ucg-health-banner svg { color: #D97706; flex-shrink: 0; margin-top: 2px; }
.ucg-health-banner-title { font-size: 13.5px; font-weight: 700; color: #0E2C46; margin: 0 0 4px; }
.ucg-health-banner-desc { font-size: 12px; color: #62707D; line-height: 1.5; margin: 0; }
`;

/* ─── Category configs ────────────────────────────────────────────── */
type TabId = "surveys" | "modules" | "decompression" | "saude";

const SURVEY_CFG: Record<string, { label: string; stripeColor: string; catBg: string; catColor: string; Icon: any }> = {
  psicossocial: { label: "DRPS — quantitativa", stripeColor: "#3B82F6", catBg: "rgba(59,130,246,.12)",  catColor: "#1D4ED8", Icon: Brain },
  aep:          { label: "AEP — qualitativa",   stripeColor: "#A855F7", catBg: "rgba(168,85,247,.12)", catColor: "#7C3AED", Icon: ClipboardList },
  clima:        { label: "Clima",               stripeColor: "#10B981", catBg: "rgba(16,185,129,.12)", catColor: "#059669", Icon: BarChart3 },
  burnout:      { label: "Burnout",             stripeColor: "#F59E0B", catBg: "rgba(245,158,11,.12)", catColor: "#B45309", Icon: ShieldAlert },
  assedio:      { label: "Assédio",             stripeColor: "#EF4444", catBg: "rgba(239,68,68,.12)",  catColor: "#DC2626", Icon: ShieldAlert },
};

const DECOMP_CFG: Record<string, { label: string; stripeColor: string; catBg: string; catColor: string; Icon: any }> = {
  breathing:  { label: "Respiração",  stripeColor: "#38BDF8", catBg: "rgba(56,189,248,.12)",  catColor: "#0284C7", Icon: Wind },
  meditation: { label: "Meditação",   stripeColor: "#A78BFA", catBg: "rgba(167,139,250,.12)", catColor: "#7C3AED", Icon: Eye },
  stretching: { label: "Alongamento", stripeColor: "#34D399", catBg: "rgba(52,211,153,.12)",  catColor: "#059669", Icon: Dumbbell },
  reflection: { label: "Reflexão",    stripeColor: "#FCD34D", catBg: "rgba(252,211,77,.12)",  catColor: "#B45309", Icon: Eye },
  focus:      { label: "Foco",        stripeColor: "#818CF8", catBg: "rgba(129,140,248,.12)", catColor: "#4338CA", Icon: Brain },
  energy:     { label: "Energia",     stripeColor: "#FB923C", catBg: "rgba(251,146,60,.12)",  catColor: "#EA580C", Icon: Zap },
};

const MODULE_STRIPE = "#F59E0B";

/* ─── Skeleton cards ─────────────────────────────────────────────── */
function SkeletonCards() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="ucg-card">
          <div className="ucg-skel ucg-stripe" />
          <div className="ucg-body">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div className="ucg-skel" style={{ height: 18, width: "45%", borderRadius: 999 }} />
              <div className="ucg-skel" style={{ height: 18, width: "20%", borderRadius: 999 }} />
            </div>
            <div className="ucg-skel" style={{ height: 16, width: "80%" }} />
            <div className="ucg-skel" style={{ height: 13, width: "60%" }} />
            <div className="ucg-skel" style={{ height: 13, width: "35%" }} />
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <div className="ucg-skel" style={{ flex: 1, height: 32, borderRadius: 9 }} />
              <div className="ucg-skel" style={{ width: 90, height: 32, borderRadius: 9 }} />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

/* ─── Main component ──────────────────────────────────────────────── */
export default function AdminLibrary() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<TabId>("surveys");
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<null | { type: "survey" | "module" | "decompression"; templateId: number; title: string }>(null);

  const listQ = trpc.templateLibrary.list.useQuery();
  const applyMut = trpc.templateLibrary.applyTemplate.useMutation({
    onSuccess: (data: any) => {
      toast.success("Template aplicado à sua empresa!", {
        action: data?.link ? {
          label: "Abrir",
          onClick: () => setLocation(data.link),
        } : undefined,
      });
      setConfirm(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao aplicar template"),
  });

  function launchHealthCampaign(c: HealthCampaignTemplate) {
    setLocation(`/admin/campanhas?healthTemplate=${c.id}`);
  }

  function customize(type: "survey" | "module" | "decompression", templateId: number, title: string) {
    if (type === "survey") {
      setLocation(`/admin/pesquisas/estudio?templateId=${templateId}&topic=${encodeURIComponent(title)}`);
    } else if (type === "module") {
      setLocation(`/admin/ai-studio?templateId=${templateId}&prompt=${encodeURIComponent(title)}`);
    } else {
      setLocation(`/admin/descompressao/estudio?templateId=${templateId}&topic=${encodeURIComponent(title)}`);
    }
  }

  const data = listQ.data;
  const surveys     = data?.surveys      ?? [];
  const modulesList = data?.modules      ?? [];
  const decompList  = data?.decompression ?? [];

  const tabs: Array<{ id: TabId; label: string; count: number; Icon: any }> = [
    { id: "surveys",      label: "Pesquisas",       count: surveys.length,          Icon: ClipboardList },
    { id: "modules",      label: "Cursos",           count: modulesList.length,      Icon: BookOpen },
    { id: "decompression",label: "Descompressão",    count: decompList.length,       Icon: Leaf },
    { id: "saude",        label: "Saúde Preventiva", count: HEALTH_CAMPAIGNS.length, Icon: HeartPulse },
  ];

  const q = search.toLowerCase();

  const visibleSurveys = useMemo(() =>
    surveys.filter((s: any) =>
      !q || s.title?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q) || s.category?.toLowerCase().includes(q)
    ), [surveys, q]);

  const visibleModules = useMemo(() =>
    modulesList.filter((m: any) =>
      !q || m.title?.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q)
    ), [modulesList, q]);

  const visibleDecomp = useMemo(() =>
    decompList.filter((a: any) =>
      !q || a.title?.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q) || a.type?.toLowerCase().includes(q)
    ), [decompList, q]);

  return (
    <AppLayout>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="ucg-page">
        <div className="ucg-wrap">

          {/* Header */}
          <div className="ucg-header">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Library size={26} style={{ color: "#F59E0B" }} />
              <h1 className="ucg-title">Biblioteca da Consultoria</h1>
            </div>
            <p className="ucg-subtitle">
              Templates prontos e validados · pesquisas, cursos preventivos e atividades de descompressão
            </p>
          </div>

          {/* Toolbar */}
          <div className="ucg-toolbar">
            {/* Search */}
            <div className="ucg-search-wrap">
              <Search className="search-icon" />
              <input
                className="ucg-search"
                placeholder="Buscar templates..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Category filter pills */}
            <div className="ucg-filters">
              {tabs.map(t => {
                const Icon = t.Icon;
                return (
                  <button
                    key={t.id}
                    className={`ucg-pill${tab === t.id ? " active" : ""}`}
                    onClick={() => setTab(t.id)}
                  >
                    <Icon />
                    {t.label}
                    <span className="ucg-count">{t.count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid */}
          <div className="ucg-grid">
            {listQ.isLoading && <SkeletonCards />}

            {/* ── Surveys ── */}
            {!listQ.isLoading && tab === "surveys" && (
              visibleSurveys.length === 0
                ? (
                  <div className="ucg-empty">
                    <Library />
                    <p>Nenhuma pesquisa encontrada.</p>
                    {q && <small>Tente outro termo de busca.</small>}
                  </div>
                )
                : visibleSurveys.map((s: any) => {
                  const cfg = SURVEY_CFG[s.category] ?? { label: s.category ?? "Custom", stripeColor: "#64748b", catBg: "rgba(100,116,139,.12)", catColor: "#475569", Icon: ClipboardList };
                  return (
                    <div key={s.id} className="ucg-card">
                      <div className="ucg-stripe" style={{ background: cfg.stripeColor }} />
                      <div className="ucg-body">
                        <div className="ucg-cat-row">
                          <span className="ucg-cat" style={{ background: cfg.catBg, color: cfg.catColor }}>{cfg.label}</span>
                          <span className="ucg-anon">{s.isAnonymous ? "anônima" : "identificada"}</span>
                        </div>
                        <div className="ucg-card-title">{s.title}</div>
                        {s.description && <div className="ucg-card-desc">{s.description}</div>}
                        <div className="ucg-meta">
                          <span><ClipboardList />{Number(s.questionCount ?? 0)} perguntas</span>
                        </div>
                        <div className="ucg-footer">
                          <button
                            className="ucg-footer-btn ucg-footer-primary"
                            onClick={() => setConfirm({ type: "survey", templateId: s.id, title: s.title })}
                          >
                            <ClipboardCheck />Aplicar à empresa
                          </button>
                          <button
                            className="ucg-footer-btn ucg-footer-ghost"
                            onClick={() => customize("survey", s.id, s.title)}
                          >
                            <Wand2 />Personalizar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
            )}

            {/* ── Modules ── */}
            {!listQ.isLoading && tab === "modules" && (
              visibleModules.length === 0
                ? (
                  <div className="ucg-empty">
                    <BookOpen />
                    <p>Nenhum curso encontrado.</p>
                    {q && <small>Tente outro termo de busca.</small>}
                  </div>
                )
                : visibleModules.map((m: any) => (
                  <div key={m.id} className="ucg-card">
                    <div className="ucg-stripe" style={{ background: MODULE_STRIPE }} />
                    <div className="ucg-body">
                      <div className="ucg-cat-row">
                        <span className="ucg-cat" style={{ background: "rgba(245,158,11,.12)", color: "#B45309" }}>Programa Preventivo</span>
                      </div>
                      <div className="ucg-card-title">{m.title}</div>
                      {m.description && <div className="ucg-card-desc">{m.description}</div>}
                      <div className="ucg-meta">
                        <span><BookOpen />{Number(m.lessonCount ?? 0)} aulas</span>
                        <span><Clock />{Number(m.durationMinutes ?? 0)} min</span>
                      </div>
                      <div className="ucg-footer">
                        <button
                          className="ucg-footer-btn ucg-footer-primary"
                          onClick={() => setConfirm({ type: "module", templateId: m.id, title: m.title })}
                        >
                          <PlusCircle />Adicionar ao programa
                        </button>
                        <button
                          className="ucg-footer-btn ucg-footer-ghost"
                          onClick={() => customize("module", m.id, m.title)}
                        >
                          <Eye />Ver conteúdo
                        </button>
                      </div>
                    </div>
                  </div>
                ))
            )}

            {/* ── Decompression ── */}
            {!listQ.isLoading && tab === "decompression" && (
              visibleDecomp.length === 0
                ? (
                  <div className="ucg-empty">
                    <Leaf />
                    <p>Nenhuma atividade encontrada.</p>
                    {q && <small>Tente outro termo de busca.</small>}
                  </div>
                )
                : visibleDecomp.map((a: any) => {
                  const cfg = DECOMP_CFG[a.type] ?? DECOMP_CFG[a.category] ?? { label: a.type ?? "Outro", stripeColor: "#10B981", catBg: "rgba(16,185,129,.12)", catColor: "#059669", Icon: Leaf };
                  return (
                    <div key={a.id} className="ucg-card">
                      <div className="ucg-stripe" style={{ background: cfg.stripeColor }} />
                      <div className="ucg-body">
                        <div className="ucg-cat-row">
                          <span className="ucg-cat" style={{ background: cfg.catBg, color: cfg.catColor }}>{cfg.label}</span>
                          <span className="ucg-anon"><Clock size={11} style={{ display: "inline", verticalAlign: "middle" }} /> {Number(a.durationMinutes ?? 0)} min</span>
                        </div>
                        <div className="ucg-card-title">{a.title}</div>
                        {a.description && <div className="ucg-card-desc">{a.description}</div>}
                        <div className="ucg-footer">
                          <button
                            className="ucg-footer-btn ucg-footer-primary"
                            onClick={() => setConfirm({ type: "decompression", templateId: a.id, title: a.title })}
                          >
                            <Sparkles />Disponibilizar
                          </button>
                          <button
                            className="ucg-footer-btn ucg-footer-ghost"
                            onClick={() => customize("decompression", a.id, a.title)}
                          >
                            <Play />Experimentar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
            {/* ── Saúde Preventiva ── */}
            {tab === "saude" && (
              <>
                <div className="ucg-health-banner" style={{ gridColumn: "1/-1" }}>
                  <HeartPulse size={20} />
                  <div>
                    <p className="ucg-health-banner-title">Calendário anual de saúde preventiva</p>
                    <p className="ucg-health-banner-desc">
                      {HEALTH_CAMPAIGNS.length} campanhas prontas — cada cor representa uma causa. Clique em <strong>Lançar campanha</strong> para abrir o estúdio com e-mail, ações e cursos pré-preenchidos.
                    </p>
                  </div>
                </div>

                {[1,2,3,4,5,6,7,8,9,10,11,12].map(month => {
                  const items = HEALTH_CAMPAIGNS.filter(c => c.month === month && (!q || c.name.toLowerCase().includes(q) || c.cause.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)));
                  if (!items.length) return null;
                  return (
                    <div key={month} style={{ gridColumn: "1/-1" }}>
                      <p className="ucg-month-label">{items[0].monthLabel}</p>
                      <div className="ucg-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
                        {items.map(c => (
                          <div key={c.id} className="ucg-card">
                            <div className="ucg-stripe" style={{ background: c.colorHex }} />
                            <div className="ucg-body">
                              <div className="ucg-cat-row">
                                <span className="ucg-cat" style={{ background: c.colorHex + "22", color: c.colorHex === "#F5F5F5" ? "#444" : c.colorHex }}>
                                  {c.colorName}
                                </span>
                                <span className="ucg-anon">{c.cause}</span>
                              </div>
                              <div className="ucg-card-title">{c.name}</div>
                              <div className="ucg-card-desc">{c.description}</div>
                              <div className="ucg-meta">
                                <span><Sparkles size={11} />{c.suggestedActions.length} ações sugeridas</span>
                              </div>
                              <div className="ucg-footer">
                                <button
                                  className="ucg-footer-btn ucg-footer-primary"
                                  onClick={() => launchHealthCampaign(c)}
                                >
                                  <Send size={13} />Lançar campanha
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

          </div>
        </div>
      </div>

      {/* Confirm dialog */}
      <AlertDialog open={!!confirm} onOpenChange={(open) => { if (!open) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={20} style={{ color: "#F59E0B" }} /> Aplicar template à sua empresa
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vamos copiar <strong>"{confirm?.title}"</strong> para a sua empresa. Você poderá editar, ativar e personalizar livremente depois — o template original permanece intacto na biblioteca.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applyMut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={applyMut.isPending}
              onClick={() => {
                if (!confirm) return;
                applyMut.mutate({ type: confirm.type, templateId: confirm.templateId });
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {applyMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Aplicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
