import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { BookOpen, Clock, CheckCircle2, Play, Search } from "lucide-react";
import { useState, useMemo } from "react";

const UCG_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Lora:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
.ucg-page{background:#F4F6F9;min-height:100vh;font-family:'Plus Jakarta Sans',system-ui,sans-serif}
.ucg-wrap{padding:24px 30px 44px;max-width:1680px;margin:0 auto}
.ucg-header{margin-bottom:18px}
.ucg-title{font-family:'Lora',Georgia,serif;font-size:27px;font-weight:700;color:#0E2C46;letter-spacing:-.01em;line-height:1.15}
.ucg-subtitle{font-size:13px;color:#62707D;margin-top:6px;font-weight:500;line-height:1.5}
.ucg-progress{background:#fff;border:1.5px solid #E9EDF2;border-radius:14px;padding:14px 18px;margin-bottom:20px;display:flex;align-items:center;gap:16px}
.ucg-progress-text{flex:none;min-width:140px}
.ucg-progress-label{font-size:13px;font-weight:700;color:#0E2C46}
.ucg-progress-sub{font-size:11.5px;color:#62707D;margin-top:2px}
.ucg-progress-bar{flex:1;height:8px;background:#EFF2F6;border-radius:999px;overflow:hidden}
.ucg-progress-fill{height:100%;background:linear-gradient(90deg,#2EA56A,#43C285);border-radius:999px;transition:width .6s ease}
.ucg-progress-pct{font-size:14px;font-weight:800;color:#2EA56A;min-width:56px;text-align:right}
.ucg-toolbar{display:flex;align-items:center;gap:10px;margin-bottom:20px;flex-wrap:wrap}
.ucg-search-wrap{position:relative;flex:1;min-width:180px;max-width:340px}
.ucg-search-icon{position:absolute;left:11px;top:50%;transform:translateY(-50%);width:14px;height:14px;color:#94a3b8;stroke:currentColor;fill:none;stroke-width:2;pointer-events:none}
.ucg-search{width:100%;padding:9px 12px 9px 32px;border:1.5px solid #E0E6ED;border-radius:11px;font-size:13px;font-family:inherit;background:#fff;outline:none;color:#1C2A36;transition:border-color .15s,box-shadow .15s}
.ucg-search:focus{border-color:#2EA56A;box-shadow:0 0 0 3px rgba(46,165,106,.1)}
.ucg-filters{display:flex;gap:6px;flex-wrap:wrap}
.ucg-pill{padding:7px 15px;border-radius:999px;font-size:12.5px;font-weight:600;cursor:pointer;border:1.5px solid #E0E6ED;background:#fff;color:#62707D;transition:all .15s;white-space:nowrap;display:inline-flex;align-items:center;gap:6px;font-family:inherit}
.ucg-pill:hover{border-color:#0E2C46;color:#0E2C46}
.ucg-pill.active{background:#0E2C46;color:#fff;border-color:#0E2C46}
.ucg-cnt{font-size:10.5px;font-weight:700;padding:1px 6px;border-radius:20px;background:rgba(255,255,255,.22)}
.ucg-pill:not(.active) .ucg-cnt{background:rgba(14,44,70,.09);color:#0E2C46}
.ucg-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
@media(max-width:1280px){.ucg-grid{grid-template-columns:repeat(3,1fr)}}
@media(max-width:900px){.ucg-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.ucg-grid{grid-template-columns:1fr}}
.ucg-card{background:#fff;border:1.5px solid #E9EDF2;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;transition:box-shadow .18s,transform .18s,border-color .18s;cursor:pointer;text-decoration:none;color:inherit}
.ucg-card:hover{box-shadow:0 8px 28px -8px rgba(14,44,70,.14);transform:translateY(-2px);border-color:#D4DCE6}
.ucg-thumb{position:relative;aspect-ratio:16/9;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.ucg-thumb-icon{width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,.22);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center}
.ucg-thumb-icon svg{width:24px;height:24px;stroke:#fff;fill:none;stroke-width:1.8}
.ucg-status-badge{position:absolute;top:9px;right:9px;font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px}
.ucg-sb-completed{background:rgba(46,165,106,.95);color:#fff}
.ucg-sb-progress{background:rgba(59,130,196,.92);color:#fff}
.ucg-sb-new{background:rgba(232,178,62,.92);color:#fff}
.ucg-body{padding:13px 15px 15px;flex:1;display:flex;flex-direction:column;gap:7px}
.ucg-cat{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;width:fit-content;white-space:nowrap}
.ucg-card-title{font-size:13.5px;font-weight:700;color:#0E2C46;line-height:1.35;letter-spacing:-.01em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:36px}
.ucg-meta{display:flex;align-items:center;gap:10px;font-size:11px;color:#92A0AC;font-weight:500;flex-wrap:wrap;margin-top:1px}
.ucg-meta-item{display:flex;align-items:center;gap:3px}
.ucg-meta-item svg{width:11px;height:11px;stroke:currentColor;fill:none;stroke-width:2;flex-shrink:0}
.ucg-card-progress{height:5px;background:#EFF2F6;margin-top:auto;border-radius:999px;overflow:hidden}
.ucg-card-progress-fill{height:100%;background:linear-gradient(90deg,#2EA56A,#43C285);border-radius:999px}
.ucg-footer{display:flex;gap:6px;margin-top:8px;padding-top:9px;border-top:1px solid #EFF2F6}
.ucg-fb{flex:1;padding:8px 8px;border-radius:9px;font-size:12px;font-weight:700;border:none;cursor:pointer;transition:all .14s;display:flex;align-items:center;justify-content:center;gap:5px;font-family:inherit}
.ucg-fb svg{width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2}
.ucg-fp{background:#0E2C46;color:#fff}
.ucg-fp:hover{background:#123451}
.ucg-fcomplete{background:#2EA56A;color:#fff}
.ucg-empty{grid-column:1/-1;text-align:center;padding:56px 20px;color:#92A0AC}
.ucg-empty svg{width:36px;height:36px;margin:0 auto 10px;display:block;opacity:.28;stroke:currentColor;fill:none;stroke-width:1.5}
.ucg-empty p{font-size:14px;font-weight:600;color:#62707D}
`;

function courseCategory(title: string): { label: string; bg: string; color: string; grad: string } {
  const t = (title || '').toLowerCase();
  if (t.includes('nr-01') || t.includes('nr01') || t.includes('risco') || t.includes('pgr') || t.includes('gro')) return { label: 'NR-01', bg: 'rgba(46,165,106,.12)', color: '#228A57', grad: 'linear-gradient(135deg,#0E2C46,#2EA56A)' };
  if (t.includes('mental') || t.includes('burnout') || t.includes('estresse') || t.includes('psico') || t.includes('bem-estar') || t.includes('neuro')) return { label: 'Saúde Mental', bg: 'rgba(124,58,237,.12)', color: '#7C3AED', grad: 'linear-gradient(135deg,#1a7a6e,#6b21a8)' };
  if (t.includes('segurança') || t.includes('acidente') || t.includes('epi') || t.includes('epc') || t.includes('prevenção')) return { label: 'Segurança', bg: 'rgba(217,119,6,.12)', color: '#D97706', grad: 'linear-gradient(135deg,#0E2C46,#E8B23E)' };
  if (t.includes('liderança') || t.includes('gestão') || t.includes('comunicação') || t.includes('assertiva')) return { label: 'Liderança', bg: 'rgba(30,111,168,.12)', color: '#1e6fa8', grad: 'linear-gradient(135deg,#0E2C46,#1e6fa8)' };
  if (t.includes('ergonomia') || t.includes('postura') || t.includes('lombar')) return { label: 'Ergonomia', bg: 'rgba(14,116,144,.12)', color: '#0e7490', grad: 'linear-gradient(135deg,#0E2C46,#1a5c7a)' };
  if (t.includes('diversidade') || t.includes('inclusão') || t.includes('assédio')) return { label: 'Compliance', bg: 'rgba(239,68,68,.12)', color: '#DC2626', grad: 'linear-gradient(135deg,#7f1d1d,#EF4444)' };
  return { label: 'Outros', bg: 'rgba(100,116,139,.12)', color: '#475569', grad: 'linear-gradient(135deg,#334155,#475569)' };
}

type StatusFilter = "all" | "progress" | "completed" | "new";

export default function Modules() {
  const modulesQuery = trpc.modules.list.useQuery();
  const progressQuery = trpc.progress.getUserProgress.useQuery();

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("Todos");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const allModules = modulesQuery.data ?? [];
  const progress = progressQuery.data ?? [];
  const getProgress = (moduleId: number) => progress.find((p: any) => p.moduleId === moduleId);

  // Category counts
  const catCounts = useMemo(() => {
    const m: Record<string, number> = { Todos: allModules.length };
    allModules.forEach((mod: any) => {
      const c = courseCategory(mod.title).label;
      m[c] = (m[c] || 0) + 1;
    });
    return m;
  }, [allModules]);

  // Status counts
  const statusCounts = useMemo(() => {
    let completed = 0, prog = 0, neu = 0;
    allModules.forEach((mod: any) => {
      const p = getProgress(mod.id);
      if (p?.isCompleted) completed++;
      else if ((p?.percentWatched ?? 0) > 0) prog++;
      else neu++;
    });
    return { all: allModules.length, completed, progress: prog, new: neu };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allModules, progress]);

  // Filter
  const modules = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allModules.filter((m: any) => {
      if (q && !m.title.toLowerCase().includes(q)) return false;
      if (catFilter !== "Todos" && courseCategory(m.title).label !== catFilter) return false;
      const p = getProgress(m.id);
      const isCompleted = !!p?.isCompleted;
      const isStarted = !isCompleted && (p?.percentWatched ?? 0) > 0;
      if (statusFilter === "completed" && !isCompleted) return false;
      if (statusFilter === "progress" && !isStarted) return false;
      if (statusFilter === "new" && (isCompleted || isStarted)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allModules, search, catFilter, statusFilter, progress]);

  const categories = ["Todos", "NR-01", "Saúde Mental", "Segurança", "Liderança", "Ergonomia", "Compliance", "Outros"];
  const totalCompleted = statusCounts.completed;
  const overallPct = allModules.length > 0 ? Math.round((totalCompleted / allModules.length) * 100) : 0;

  return (
    <AppLayout>
      <style dangerouslySetInnerHTML={{ __html: UCG_CSS }} />
      <div className="ucg-page">
        <div className="ucg-wrap">
          {/* Header */}
          <div className="ucg-header">
            <h1 className="ucg-title">Meus Cursos</h1>
            <p className="ucg-subtitle">Continue de onde parou e explore novos conteúdos.</p>
          </div>

          {/* Overall progress */}
          {allModules.length > 0 && (
            <div className="ucg-progress">
              <div className="ucg-progress-text">
                <div className="ucg-progress-label">Progresso geral</div>
                <div className="ucg-progress-sub">{totalCompleted} de {allModules.length} concluídos</div>
              </div>
              <div className="ucg-progress-bar">
                <div className="ucg-progress-fill" style={{ width: `${overallPct}%` }} />
              </div>
              <div className="ucg-progress-pct">{overallPct}%</div>
            </div>
          )}

          {/* Toolbar */}
          <div className="ucg-toolbar">
            <div className="ucg-search-wrap">
              <Search className="ucg-search-icon" />
              <input
                className="ucg-search"
                placeholder="Buscar curso..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="ucg-filters">
              <button className={`ucg-pill ${statusFilter === "all" ? "active" : ""}`} onClick={() => setStatusFilter("all")}>Todos <span className="ucg-cnt">{statusCounts.all}</span></button>
              <button className={`ucg-pill ${statusFilter === "progress" ? "active" : ""}`} onClick={() => setStatusFilter("progress")}>Em andamento <span className="ucg-cnt">{statusCounts.progress}</span></button>
              <button className={`ucg-pill ${statusFilter === "completed" ? "active" : ""}`} onClick={() => setStatusFilter("completed")}>Concluídos <span className="ucg-cnt">{statusCounts.completed}</span></button>
              <button className={`ucg-pill ${statusFilter === "new" ? "active" : ""}`} onClick={() => setStatusFilter("new")}>Não iniciados <span className="ucg-cnt">{statusCounts.new}</span></button>
            </div>
          </div>

          {/* Category pills row */}
          <div className="ucg-toolbar" style={{ marginBottom: 22 }}>
            <div className="ucg-filters">
              {categories.map(c => (
                <button key={c} className={`ucg-pill ${catFilter === c ? "active" : ""}`} onClick={() => setCatFilter(c)}>
                  {c} <span className="ucg-cnt">{catCounts[c] ?? 0}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          <div className="ucg-grid">
            {modulesQuery.isLoading && Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="ucg-card" style={{ minHeight: 240 }}>
                <div style={{ aspectRatio: "16/9", background: "#EFF2F6" }} />
                <div className="ucg-body">
                  <div style={{ height: 18, width: "70%", background: "#EFF2F6", borderRadius: 6 }} />
                  <div style={{ height: 12, width: "40%", background: "#EFF2F6", borderRadius: 6 }} />
                </div>
              </div>
            ))}

            {!modulesQuery.isLoading && modules.length === 0 && (
              <div className="ucg-empty">
                <BookOpen />
                <p>Nenhum curso encontrado.</p>
              </div>
            )}

            {!modulesQuery.isLoading && modules.map((mod: any) => {
              const p = getProgress(mod.id);
              const isCompleted = !!p?.isCompleted;
              const percent = p?.percentWatched ?? 0;
              const isStarted = !isCompleted && percent > 0;
              const cat = courseCategory(mod.title);
              // All courses go to the new missao player flow now
              const courseUrl = `/missao/curso/${mod.id}`;

              return (
                <Link key={mod.id} href={courseUrl}>
                  <a className="ucg-card" style={{ display: "flex" }}>
                    {/* Thumbnail */}
                    <div className="ucg-thumb" style={{ background: cat.grad }}>
                      <div className="ucg-thumb-icon"><Play /></div>
                      {isCompleted && <span className="ucg-status-badge ucg-sb-completed">✓ Concluído</span>}
                      {isStarted && !isCompleted && <span className="ucg-status-badge ucg-sb-progress">{Math.round(percent)}%</span>}
                      {!isCompleted && !isStarted && <span className="ucg-status-badge ucg-sb-new">Novo</span>}
                    </div>

                    {/* Body */}
                    <div className="ucg-body">
                      <span className="ucg-cat" style={{ background: cat.bg, color: cat.color }}>{cat.label}</span>
                      <div className="ucg-card-title">{mod.title}</div>
                      <div className="ucg-meta">
                        <span className="ucg-meta-item"><Clock />{mod.durationMinutes ?? 0} min</span>
                      </div>
                      {(isStarted || isCompleted) && (
                        <div className="ucg-card-progress">
                          <div className="ucg-card-progress-fill" style={{ width: `${isCompleted ? 100 : percent}%` }} />
                        </div>
                      )}
                      <div className="ucg-footer">
                        {isCompleted ? (
                          <button className="ucg-fb ucg-fcomplete">
                            <CheckCircle2 />Concluído
                          </button>
                        ) : isStarted ? (
                          <button className="ucg-fb ucg-fp">
                            <Play />Continuar
                          </button>
                        ) : (
                          <button className="ucg-fb ucg-fp">
                            <Play />Iniciar
                          </button>
                        )}
                      </div>
                    </div>
                  </a>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
