import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { BookOpen, Clock, CheckCircle2, Play, Search, Lock, ChevronDown, ChevronRight } from "lucide-react";
import { useState, useMemo } from "react";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Lora:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
.mc-page{background:#F4F6F9;min-height:100vh;font-family:'Plus Jakarta Sans',system-ui,sans-serif}
.mc-wrap{padding:24px 30px 56px;max-width:1100px;margin:0 auto}
.mc-header{margin-bottom:18px}
.mc-title{font-family:'Lora',Georgia,serif;font-size:27px;font-weight:700;color:#0E2C46;letter-spacing:-.01em;line-height:1.15}
.mc-subtitle{font-size:13px;color:#62707D;margin-top:6px;font-weight:500}
.mc-progress-bar-wrap{background:#fff;border:1.5px solid #E9EDF2;border-radius:14px;padding:14px 18px;margin-bottom:28px;display:flex;align-items:center;gap:16px}
.mc-progress-label{font-size:13px;font-weight:700;color:#0E2C46}
.mc-progress-sub{font-size:11.5px;color:#62707D;margin-top:2px}
.mc-progress-bar{flex:1;height:8px;background:#EFF2F6;border-radius:999px;overflow:hidden}
.mc-progress-fill{height:100%;background:linear-gradient(90deg,#2EA56A,#43C285);border-radius:999px;transition:width .6s ease}
.mc-progress-pct{font-size:14px;font-weight:800;color:#2EA56A;min-width:42px;text-align:right}
/* Section headers */
.mc-section{margin-bottom:32px}
.mc-section-head{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.mc-section-icon{width:10px;height:10px;border-radius:2px;flex-shrink:0}
.mc-section-title{font-size:17px;font-weight:800;color:#0E2C46;letter-spacing:-.01em}
.mc-section-badge{font-size:10.5px;font-weight:700;padding:3px 10px;border-radius:8px;white-space:nowrap}
.mc-section-desc{font-size:12.5px;color:#62707D;margin-bottom:14px;line-height:1.5}
/* Program rows */
.mc-prog-list{display:flex;flex-direction:column;gap:8px}
.mc-prog-row{background:#fff;border-radius:14px;border:1.5px solid #E9EDF2;overflow:hidden;transition:box-shadow .18s}
.mc-prog-row:hover{box-shadow:0 4px 18px -6px rgba(14,44,70,.13)}
.mc-prog-row.prioritario{border-left-width:4px;border-left-style:solid;border-left-color:#DC2626}
.mc-prog-row.concluido{border-left-color:#059669}
.mc-prog-head{display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;user-select:none}
.mc-prog-num{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;flex-shrink:0}
.mc-prog-info{flex:1;min-width:0}
.mc-prog-name{font-size:14px;font-weight:700;color:#0E2C46;margin:0 0 3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mc-prog-meta{font-size:11.5px;color:#62707D;display:flex;align-items:center;gap:10px}
.mc-prog-bar-wrap{width:80px;flex-shrink:0}
.mc-prog-bar{height:5px;background:#EFF2F6;border-radius:999px;overflow:hidden}
.mc-prog-bar-fill{height:100%;border-radius:999px;transition:width .5s ease}
.mc-prog-pct{font-size:11px;font-weight:700;color:#62707D;text-align:right;margin-top:2px}
/* Module list inside program */
.mc-mod-list{border-top:1.5px solid #F0F3F7;padding:10px 16px;display:flex;flex-direction:column;gap:6px;background:#FAFBFC}
.mc-mod-item{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:10px;border:1.5px solid #E9EDF2;background:#fff;transition:box-shadow .15s}
.mc-mod-item:hover:not(.bloqueado){box-shadow:0 3px 12px -4px rgba(14,44,70,.12)}
.mc-mod-item.bloqueado{opacity:.6;cursor:not-allowed;background:#F9FAFB}
.mc-mod-state{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;font-weight:800}
.mc-mod-state.concluido{background:#059669;color:#fff}
.mc-mod-state.andamento{background:#2563EB;color:#fff}
.mc-mod-state.disponivel{background:#E9EDF2;color:#0E2C46}
.mc-mod-state.bloqueado{background:#E9EDF2;color:#94a3b8}
.mc-mod-info{flex:1;min-width:0}
.mc-mod-title{font-size:13px;font-weight:700;color:#0E2C46;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mc-mod-sub{font-size:11.5px;color:#62707D;display:flex;align-items:center;gap:6px;margin-top:1px}
.mc-mod-btn{padding:6px 14px;border-radius:8px;font-size:12px;font-weight:700;border:none;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0;transition:all .14s}
.mc-mod-btn.play{background:#0E2C46;color:#fff}
.mc-mod-btn.play:hover{background:#123451}
.mc-mod-btn.done{background:#059669;color:#fff}
.mc-mod-btn.done:hover{background:#047857}
/* Complementares grid */
.mc-comp-toolbar{display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.mc-search-wrap{position:relative;flex:1;min-width:180px;max-width:340px}
.mc-search-icon{position:absolute;left:11px;top:50%;transform:translateY(-50%);width:14px;height:14px;color:#94a3b8;stroke:currentColor;fill:none;stroke-width:2;pointer-events:none}
.mc-search{width:100%;padding:9px 12px 9px 32px;border:1.5px solid #E0E6ED;border-radius:11px;font-size:13px;font-family:inherit;background:#fff;outline:none;color:#1C2A36;transition:border-color .15s}
.mc-search:focus{border-color:#D97706;box-shadow:0 0 0 3px rgba(217,119,6,.1)}
.mc-pills{display:flex;gap:6px;flex-wrap:wrap}
.mc-pill{padding:7px 14px;border-radius:999px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid #E0E6ED;background:#fff;color:#62707D;transition:all .15s;white-space:nowrap;font-family:inherit}
.mc-pill:hover{border-color:#D97706;color:#D97706}
.mc-pill.active{background:#D97706;color:#fff;border-color:#D97706}
.mc-comp-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
@media(max-width:1280px){.mc-comp-grid{grid-template-columns:repeat(3,1fr)}}
@media(max-width:900px){.mc-comp-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.mc-comp-grid{grid-template-columns:1fr}}
.mc-card{background:#fff;border:1.5px solid #E9EDF2;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;transition:box-shadow .18s,transform .18s;cursor:pointer;text-decoration:none;color:inherit}
.mc-card:hover{box-shadow:0 6px 22px -6px rgba(14,44,70,.14);transform:translateY(-2px)}
.mc-card-stripe{height:4px;width:100%;flex-shrink:0}
.mc-card-body{padding:12px 14px 14px;flex:1;display:flex;flex-direction:column;gap:6px}
.mc-card-cat{font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:999px;width:fit-content;white-space:nowrap}
.mc-card-title{font-size:13px;font-weight:700;color:#0E2C46;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:34px}
.mc-card-dur{font-size:11px;color:#92A0AC;display:flex;align-items:center;gap:3px}
.mc-card-dur svg{width:11px;height:11px;stroke:currentColor;fill:none;stroke-width:2}
.mc-card-prog{height:4px;background:#EFF2F6;border-radius:999px;overflow:hidden;margin-top:auto}
.mc-card-prog-fill{height:100%;background:linear-gradient(90deg,#D97706,#F59E0B);border-radius:999px}
.mc-card-btn{padding:7px 8px;border-radius:8px;font-size:12px;font-weight:700;border:none;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:4px;margin-top:8px;transition:all .14s}
.mc-card-btn svg{width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2}
.mc-card-btn.start{background:#D97706;color:#fff}
.mc-card-btn.done{background:#059669;color:#fff}
.mc-empty{text-align:center;padding:56px 20px;color:#92A0AC;grid-column:1/-1}
.mc-empty svg{width:36px;height:36px;margin:0 auto 10px;display:block;opacity:.28;stroke:currentColor;fill:none;stroke-width:1.5}
`;

function catConfig(title: string) {
  const t = (title || "").toLowerCase();
  if (t.includes("nr-01") || t.includes("nr01") || t.includes("risco") || t.includes("pgr")) return { label: "NR-01", bg: "rgba(46,165,106,.12)", color: "#228A57", grad: "#2EA56A" };
  if (t.includes("mental") || t.includes("burnout") || t.includes("estresse") || t.includes("psico") || t.includes("neuro")) return { label: "Saúde Mental", bg: "rgba(124,58,237,.12)", color: "#7C3AED", grad: "#7C3AED" };
  if (t.includes("segurança") || t.includes("acidente") || t.includes("epi") || t.includes("epc")) return { label: "Segurança", bg: "rgba(217,119,6,.12)", color: "#D97706", grad: "#D97706" };
  if (t.includes("liderança") || t.includes("gestão") || t.includes("comunicação")) return { label: "Liderança", bg: "rgba(30,111,168,.12)", color: "#1e6fa8", grad: "#1e6fa8" };
  if (t.includes("ergonomia") || t.includes("postura")) return { label: "Ergonomia", bg: "rgba(14,116,144,.12)", color: "#0e7490", grad: "#0e7490" };
  if (t.includes("diversidade") || t.includes("assédio") || t.includes("compliance")) return { label: "Compliance", bg: "rgba(239,68,68,.12)", color: "#DC2626", grad: "#DC2626" };
  return { label: "Outros", bg: "rgba(100,116,139,.12)", color: "#475569", grad: "#475569" };
}

export default function Modules() {
  const programsQ = trpc.trainingPrograms.listForEmployee.useQuery();
  const [expandedPrograms, setExpandedPrograms] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("Todos");

  const data = programsQ.data;
  const prioritarios = data?.prioritarios ?? [];
  const obrigatorios = data?.obrigatorios ?? [];
  const allComps = data?.modules ?? [];

  const totalProgMods = useMemo(() => {
    const progs = [...prioritarios, ...obrigatorios];
    const total = progs.reduce((a, p: any) => a + p.totalMods, 0);
    const done = progs.reduce((a, p: any) => a + p.completedMods, 0);
    return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [prioritarios, obrigatorios]);

  const filteredComps = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allComps.filter((m: any) => {
      if (q && !m.title.toLowerCase().includes(q)) return false;
      if (catFilter !== "Todos" && catConfig(m.title).label !== catFilter) return false;
      return true;
    });
  }, [allComps, search, catFilter]);

  function toggleProgram(id: number) {
    setExpandedPrograms(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const progTotal = prioritarios.length + obrigatorios.length;

  return (
    <AppLayout>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="mc-page">
        <div className="mc-wrap">
          <div className="mc-header">
            <h1 className="mc-title">Meus Cursos</h1>
            <p className="mc-subtitle">Sua trilha integrada ao Plano de Ação Psicossocial</p>
          </div>

          {/* Overall progress */}
          {totalProgMods.total > 0 && (
            <div className="mc-progress-bar-wrap">
              <div>
                <div className="mc-progress-label">Progresso geral nas trilhas</div>
                <div className="mc-progress-sub">{totalProgMods.done} de {totalProgMods.total} módulos concluídos · {progTotal} programa{progTotal !== 1 ? "s" : ""}</div>
              </div>
              <div className="mc-progress-bar">
                <div className="mc-progress-fill" style={{ width: `${totalProgMods.pct}%` }} />
              </div>
              <div className="mc-progress-pct">{totalProgMods.pct}%</div>
            </div>
          )}

          {programsQ.isLoading && (
            <div style={{ textAlign: "center", padding: "56px 20px", color: "#62707D" }}>
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" style={{ margin: "0 auto 12px" }} />
              <p style={{ fontSize: 13 }}>Carregando seus programas...</p>
            </div>
          )}

          {/* ─── Prioritários ─────────────────────────────────────────── */}
          {prioritarios.length > 0 && (
            <div className="mc-section">
              <div className="mc-section-head">
                <div className="mc-section-icon" style={{ background: "#DC2626" }} />
                <span className="mc-section-title">Programas Prioritários para Você</span>
                <span className="mc-section-badge" style={{ background: "rgba(220,38,38,.1)", color: "#DC2626" }}>Prioritário</span>
              </div>
              <div className="mc-section-desc">
                Trilhas vinculadas aos fatores com risco identificado no seu setor — siga primeiro.
              </div>
              <div className="mc-prog-list">
                {prioritarios.map((p: any, i: number) => (
                  <ProgramRow
                    key={p.id}
                    p={p}
                    index={i + 1}
                    color="#DC2626"
                    fillColor="#DC2626"
                    isSequential={true}
                    expanded={expandedPrograms.has(p.id)}
                    onToggle={() => toggleProgram(p.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ─── Obrigatórios ─────────────────────────────────────────── */}
          {obrigatorios.length > 0 && (
            <div className="mc-section">
              <div className="mc-section-head">
                <div className="mc-section-icon" style={{ background: "#2563EB" }} />
                <span className="mc-section-title">Programas Obrigatórios</span>
                <span className="mc-section-badge" style={{ background: "rgba(37,99,235,.1)", color: "#2563EB" }}>Obrigatório</span>
              </div>
              <div className="mc-section-desc">
                Demais trilhas da NR-01 que todo colaborador deve concluir. Módulos em sequência.
              </div>
              <div className="mc-prog-list">
                {obrigatorios.map((p: any, i: number) => (
                  <ProgramRow
                    key={p.id}
                    p={p}
                    index={i + 1}
                    color="#2563EB"
                    fillColor="#2563EB"
                    isSequential={true}
                    expanded={expandedPrograms.has(p.id)}
                    onToggle={() => toggleProgram(p.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ─── Complementares ───────────────────────────────────────── */}
          {(!programsQ.isLoading) && (
            <div className="mc-section">
              <div className="mc-section-head">
                <div className="mc-section-icon" style={{ background: "#D97706" }} />
                <span className="mc-section-title">Cursos Complementares</span>
                <span className="mc-section-badge" style={{ background: "rgba(217,119,6,.1)", color: "#D97706" }}>Opcional</span>
              </div>
              <div className="mc-section-desc">
                Conteúdos avulsos opcionais — liderança, qualidade de vida, inteligência emocional.
              </div>
              <div className="mc-comp-toolbar">
                <div className="mc-search-wrap">
                  <Search className="mc-search-icon" />
                  <input
                    className="mc-search"
                    placeholder="Buscar curso..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <div className="mc-pills">
                  {["Todos", "NR-01", "Saúde Mental", "Segurança", "Liderança", "Ergonomia", "Compliance"].map(c => (
                    <button key={c} className={`mc-pill ${catFilter === c ? "active" : ""}`} onClick={() => setCatFilter(c)}>{c}</button>
                  ))}
                </div>
              </div>
              <div className="mc-comp-grid">
                {filteredComps.length === 0 && (
                  <div className="mc-empty">
                    <BookOpen />
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#62707D" }}>
                      {allComps.length === 0 ? "Todos os cursos disponíveis estão em programas de trilha." : "Nenhum curso encontrado."}
                    </p>
                  </div>
                )}
                {filteredComps.map((m: any) => {
                  const cat = catConfig(m.title);
                  const isCompleted = m.progress.isCompleted;
                  const pct = m.progress.pct;
                  const isStarted = !isCompleted && pct > 0;
                  const courseUrl = `/missao/curso/${m.id}`;
                  return (
                    <Link key={m.id} href={courseUrl}>
                      <a className="mc-card">
                        <div className="mc-card-stripe" style={{ background: cat.grad }} />
                        <div className="mc-card-body">
                          <span className="mc-card-cat" style={{ background: cat.bg, color: cat.color }}>{cat.label}</span>
                          <div className="mc-card-title">{m.title}</div>
                          {m.durationMinutes > 0 && (
                            <div className="mc-card-dur"><Clock /> {m.durationMinutes} min</div>
                          )}
                          {(isStarted || isCompleted) && (
                            <div className="mc-card-prog">
                              <div className="mc-card-prog-fill" style={{ width: `${isCompleted ? 100 : pct}%` }} />
                            </div>
                          )}
                          <button className={`mc-card-btn ${isCompleted ? "done" : "start"}`}>
                            {isCompleted ? <><CheckCircle2 />Concluído</> : isStarted ? <><Play />Continuar</> : <><Play />Iniciar</>}
                          </button>
                        </div>
                      </a>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function ProgramRow({ p, index, color, fillColor, isSequential, expanded, onToggle }: {
  p: any; index: number; color: string; fillColor: string;
  isSequential: boolean; expanded: boolean; onToggle: () => void;
}) {
  const mods: any[] = p.modules ?? [];

  // Determine module states for sequential lock
  function getState(i: number): "concluido" | "andamento" | "disponivel" | "bloqueado" {
    const m = mods[i];
    if (m.progress.isCompleted) return "concluido";
    if (m.progress.pct > 0) return "andamento";
    if (!isSequential) return "disponivel";
    if (i === 0) return "disponivel";
    const prev = mods[i - 1];
    if (prev.progress.isCompleted) return "disponivel";
    return "bloqueado";
  }

  const rowClass = `mc-prog-row${p.isPrioritario ? " prioritario" : ""}${p.isAllCompleted ? " concluido" : ""}`;

  return (
    <div className={rowClass}>
      <div className="mc-prog-head" onClick={onToggle}>
        {/* Number / check circle */}
        <div
          className="mc-prog-num"
          style={{
            background: p.isAllCompleted ? "#059669" : color,
            color: "#fff",
          }}
        >
          {p.isAllCompleted ? "✓" : index}
        </div>

        <div className="mc-prog-info">
          <div className="mc-prog-name">{p.name}</div>
          <div className="mc-prog-meta">
            <span>{p.totalMods} módulo{p.totalMods !== 1 ? "s" : ""}</span>
            {p.completedMods > 0 && <span>· {p.completedMods} concluído{p.completedMods !== 1 ? "s" : ""}</span>}
            {p.pct > 0 && <span>· {p.pct}%</span>}
          </div>
        </div>

        {/* Mini progress bar */}
        {p.totalMods > 0 && (
          <div className="mc-prog-bar-wrap">
            <div className="mc-prog-bar">
              <div className="mc-prog-bar-fill" style={{ width: `${p.pct}%`, background: p.isAllCompleted ? "#059669" : fillColor }} />
            </div>
            <div className="mc-prog-pct" style={{ color: p.isAllCompleted ? "#059669" : "#62707D" }}>{p.pct}%</div>
          </div>
        )}

        {expanded
          ? <ChevronDown size={16} style={{ color: "#62707D", flexShrink: 0 }} />
          : <ChevronRight size={16} style={{ color: "#62707D", flexShrink: 0 }} />
        }
      </div>

      {expanded && (
        <div className="mc-mod-list">
          {mods.length === 0 && (
            <div style={{ fontSize: 13, color: "#92A0AC", padding: "10px 0", textAlign: "center", fontStyle: "italic" }}>
              Este programa ainda não possui módulos cadastrados.
            </div>
          )}
          {mods.map((m: any, i: number) => {
            const state = getState(i);
            const isBloqueado = state === "bloqueado";
            const courseUrl = `/missao/curso/${m.moduleId}`;

            const stateLabel = state === "concluido" ? "✓ Concluído" : state === "andamento" ? "Em andamento" : isBloqueado ? "Bloqueado" : "";
            const stateBadgeColor = state === "concluido" ? "#059669" : state === "andamento" ? "#2563EB" : "#94a3b8";

            const modContent = (
              <div className={`mc-mod-item ${isBloqueado ? "bloqueado" : ""}`}>
                {/* State circle */}
                <div className={`mc-mod-state ${state}`}>
                  {state === "concluido" ? "✓" : state === "andamento" ? <div style={{ width: 8, height: 8, background: "#fff", borderRadius: 2 }} /> : state === "bloqueado" ? <Lock size={11} /> : i + 1}
                </div>

                <div className="mc-mod-info">
                  <div className="mc-mod-title">Módulo {i + 1}: {m.title}</div>
                  <div className="mc-mod-sub">
                    {m.durationMinutes > 0 && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Clock size={11} style={{ stroke: "#92A0AC" }} /> {m.durationMinutes} min</span>}
                    {stateLabel && (
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: "1px 7px", borderRadius: 6, background: `${stateBadgeColor}18`, color: stateBadgeColor }}>
                        {stateLabel}
                      </span>
                    )}
                    {isBloqueado && <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Conclua o módulo anterior para desbloquear</span>}
                  </div>
                </div>

                {!isBloqueado && (
                  <button className={`mc-mod-btn ${state === "concluido" ? "done" : "play"}`}>
                    {state === "concluido" ? "Revisar" : state === "andamento" ? "Continuar" : "Iniciar"}
                  </button>
                )}
                {isBloqueado && (
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "#E9EDF2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Lock size={14} style={{ color: "#94a3b8" }} />
                  </div>
                )}
              </div>
            );

            return isBloqueado ? (
              <div key={m.id}>{modContent}</div>
            ) : (
              <Link key={m.id} href={courseUrl}>
                <a style={{ textDecoration: "none", color: "inherit", display: "block" }}>{modContent}</a>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
