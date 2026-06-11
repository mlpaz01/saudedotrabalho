import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

/* ── helpers ─────────────────────────────────────────────────── */
function isOverdue(endDate: string | null, status: string) {
  if (!endDate || status === "concluido" || status === "cancelado") return false;
  return new Date(endDate) < new Date();
}
function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("pt-BR");
}

function priorityConfig(priority: string): { label: string; bg: string; color: string; grad: string } {
  const p = (priority || "").toLowerCase();
  if (p === "critica" || p === "crítica") return { label: "Crítica", bg: "rgba(220,38,38,.14)", color: "#b83225", grad: "linear-gradient(135deg,#7f1d1d,#EF4444)" };
  if (p === "alta") return { label: "Alta", bg: "rgba(229,134,56,.14)", color: "#c4581a", grad: "linear-gradient(135deg,#431407,#F97316)" };
  if (p === "media" || p === "média") return { label: "Média", bg: "rgba(232,178,62,.14)", color: "#a07a10", grad: "linear-gradient(135deg,#78350f,#FBBF24)" };
  return { label: "Baixa", bg: "rgba(46,165,106,.14)", color: "#228A57", grad: "linear-gradient(135deg,#064e3b,#6EE7B7)" };
}

const STATUS_OPTIONS = [
  { value: "programado",   label: "Programado" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluido",    label: "Concluído" },
  { value: "atrasado",     label: "Atrasado" },
  { value: "cancelado",    label: "Cancelado" },
];

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Lora:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
.ucg-page{background:#F4F6F9;min-height:100vh;font-family:'Plus Jakarta Sans',system-ui,sans-serif}
.ucg-wrap{padding:24px 30px 44px;max-width:1680px;margin:0 auto}
.ucg-header{margin-bottom:18px}
.ucg-title{font-family:'Lora',Georgia,serif;font-size:27px;font-weight:700;color:#0E2C46;letter-spacing:-.01em;line-height:1.15}
.ucg-subtitle{font-size:13px;color:#62707D;margin-top:6px;font-weight:500;line-height:1.5}
.ucg-toolbar{display:flex;align-items:center;gap:10px;margin-bottom:20px;flex-wrap:wrap}
.ucg-search-wrap{position:relative;flex:1;min-width:180px;max-width:340px}
.ucg-search-icon{position:absolute;left:11px;top:50%;transform:translateY(-50%);width:14px;height:14px;color:#94a3b8;stroke:currentColor;fill:none;stroke-width:2;pointer-events:none}
.ucg-search{width:100%;padding:9px 12px 9px 32px;border:1.5px solid #E0E6ED;border-radius:11px;font-size:13px;font-family:inherit;background:#fff;outline:none;color:#1C2A36;transition:border-color .15s,box-shadow .15s}
.ucg-search:focus{border-color:#2EA56A;box-shadow:0 0 0 3px rgba(46,165,106,.1)}
.ucg-search::placeholder{color:#94a3b8}
.ucg-filters{display:flex;gap:6px;flex-wrap:wrap}
.ucg-pill{padding:7px 15px;border-radius:999px;font-size:12.5px;font-weight:600;cursor:pointer;border:1.5px solid #E0E6ED;background:#fff;color:#62707D;transition:all .15s;white-space:nowrap;display:inline-flex;align-items:center;gap:6px;font-family:inherit}
.ucg-pill:hover{border-color:#0E2C46;color:#0E2C46}
.ucg-pill.active{background:#0E2C46;color:#fff;border-color:#0E2C46}
.ucg-cnt{font-size:10.5px;font-weight:700;padding:1px 6px;border-radius:20px;background:rgba(255,255,255,.22)}
.ucg-pill:not(.active) .ucg-cnt{background:rgba(14,44,70,.09);color:#0E2C46}
.ucg-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
@media(max-width:1280px){.ucg-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:700px){.ucg-grid{grid-template-columns:1fr}}
.ucg-card{background:#fff;border:1.5px solid #E9EDF2;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;transition:box-shadow .18s,transform .18s,border-color .18s}
.ucg-card:hover{box-shadow:0 8px 28px -8px rgba(14,44,70,.14);transform:translateY(-2px);border-color:#D4DCE6}
.ucg-card.overdue{border-color:#f5b8b3}
.ucg-thumb{position:relative;aspect-ratio:16/5;overflow:hidden;flex-shrink:0;display:flex;align-items:center;padding:0 16px}
.ucg-thumb-content{position:relative;z-index:1;display:flex;align-items:center;gap:10px;flex:1;min-width:0}
.ucg-factor-badge{font-size:11px;font-weight:800;color:rgba(255,255,255,.85);letter-spacing:.05em;background:rgba(0,0,0,.18);padding:3px 9px;border-radius:999px;white-space:nowrap;flex-shrink:0}
.ucg-overdue-dot{width:8px;height:8px;border-radius:50%;background:#ff6b6b;border:2px solid rgba(255,255,255,.7);flex-shrink:0}
.ucg-body{padding:13px 15px 15px;flex:1;display:flex;flex-direction:column;gap:7px}
.ucg-cat{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;width:fit-content;white-space:nowrap}
.ucg-card-title{font-size:13.5px;font-weight:700;color:#0E2C46;line-height:1.35;letter-spacing:-.01em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ucg-card-desc{font-size:12px;color:#62707D;line-height:1.5;flex:1;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ucg-meta{display:flex;align-items:center;gap:10px;font-size:11px;color:#92A0AC;font-weight:500;flex-wrap:wrap;margin-top:1px}
.ucg-meta-item{display:flex;align-items:center;gap:3px}
.ucg-meta-item svg{width:11px;height:11px;stroke:currentColor;fill:none;stroke-width:2;flex-shrink:0}
.ucg-meta-item.overdue-text{color:#b83225;font-weight:700}
.ucg-course-row{display:flex;align-items:center;gap:6px;font-size:12px;padding:6px 0 2px}
.ucg-course-row svg{width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2;flex-shrink:0}
.ucg-course-label{color:#2460a8;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}
.ucg-no-course{color:#94a3b8;font-style:italic;flex:1}
.ucg-footer{display:flex;gap:6px;margin-top:8px;padding:10px 15px 14px;border-top:1px solid #EFF2F6;align-items:center}
.ucg-fb{flex:1;padding:7px 8px;border-radius:9px;font-size:12px;font-weight:600;border:none;cursor:pointer;transition:all .14s;display:flex;align-items:center;justify-content:center;gap:4px;font-family:inherit}
.ucg-fb svg{width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2}
.ucg-fg{background:#F4F6F9;color:#0E2C46}
.ucg-fg:hover{background:#E9EDF2}
.ucg-empty{grid-column:1/-1;text-align:center;padding:56px 20px;color:#92A0AC}
.ucg-empty svg{width:36px;height:36px;margin:0 auto 10px;display:block;opacity:.28;stroke:currentColor;fill:none;stroke-width:1.5}
.ucg-empty p{font-size:14px;font-weight:600;color:#62707D}
.ucg-empty small{font-size:12px;margin-top:4px;display:block}
.ucg-skel{background:linear-gradient(90deg,#E9EDF2 0%,#F4F6F9 50%,#E9EDF2 100%);background-size:200% 100%;animation:shimmer 1.3s infinite;border-radius:8px}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.ucg-kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
@media(max-width:700px){.ucg-kpi-row{grid-template-columns:repeat(2,1fr)}}
.ucg-kpi{background:#fff;border:1.5px solid #E9EDF2;border-radius:14px;padding:14px 16px}
.ucg-kpi-val{font-size:26px;font-weight:800;color:#0E2C46;line-height:1}
.ucg-kpi-val.green{color:#228A57}
.ucg-kpi-val.red{color:#b83225}
.ucg-kpi-val.amber{color:#a07a10}
.ucg-kpi-lbl{font-size:11.5px;color:#62707D;margin-top:4px;font-weight:500}
.ucg-progress{background:#fff;border:1.5px solid #E9EDF2;border-radius:14px;padding:14px 16px;margin-bottom:20px}
.ucg-progress-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.ucg-progress-label{font-size:13px;font-weight:600;color:#0E2C46}
.ucg-progress-sub{font-size:12px;color:#62707D}
.ucg-progress-bar{height:10px;background:#E9EDF2;border-radius:999px;overflow:hidden}
.ucg-progress-fill{height:100%;background:linear-gradient(90deg,#1a7a46,#2EA56A);border-radius:999px;transition:width .4s}
.ucg-progress-pct{font-size:11.5px;color:#62707D;margin-top:4px}
.ucg-filter-section{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}
.ucg-filter-label{font-size:11px;font-weight:700;color:#92A0AC;letter-spacing:.06em;text-transform:uppercase}
.ucg-link-inline{display:flex;flex-direction:column;gap:6px;padding:6px 0 2px}
.ucg-link-inline-row{display:flex;gap:6px}
.ucg-save-btn{font-size:11px;font-weight:700;padding:5px 12px;border-radius:8px;background:#0E2C46;color:#fff;border:none;cursor:pointer}
.ucg-cancel-btn{font-size:11px;font-weight:600;padding:5px 10px;border-radius:8px;background:#F4F6F9;color:#62707D;border:1.5px solid #E0E6ED;cursor:pointer}
`;

export default function AdminAcoesVinculadas() {
  const actionsQ  = trpc.riskAssessment.allActionItems.useQuery();
  const modulesQ  = trpc.admin.listModules.useQuery(undefined, { staleTime: 60000 });
  const updateMut = trpc.riskAssessment.updateActionItemStatus.useMutation({
    onSuccess: () => { toast.success("Status atualizado"); actionsQ.refetch(); },
  });
  const linkMut = trpc.riskAssessment.linkModuleToAction.useMutation({
    onSuccess: () => { toast.success("Curso vinculado!"); actionsQ.refetch(); },
  });

  const [search, setSearch]                 = useState("");
  const [filterPriority, setFilterPriority] = useState("todos");
  const [filterStatus, setFilterStatus]     = useState("todos");
  const [linkingId, setLinkingId]           = useState<number | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string>("");

  const items: any[]   = actionsQ.data ?? [];
  const modules: any[] = modulesQ.data ?? [];

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const q = search.toLowerCase();
      if (q && ![item.factorName, item.actionDescription, item.sectorName, item.responsibleParty, item.moduleTitle, item.factorCode, item.cycleName]
        .join(" ").toLowerCase().includes(q)) return false;
      if (filterPriority !== "todos" && item.priority !== filterPriority) return false;
      if (filterStatus !== "todos" && item.status !== filterStatus) return false;
      return true;
    });
  }, [items, search, filterPriority, filterStatus]);

  const stats = useMemo(() => ({
    total:      items.length,
    concluido:  items.filter(i => i.status === "concluido").length,
    atrasado:   items.filter(i => isOverdue(i.endDate, i.status)).length,
    sem_modulo: items.filter(i => !i.moduleId).length,
  }), [items]);

  const priCounts = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach(i => { map[i.priority] = (map[i.priority] ?? 0) + 1; });
    return map;
  }, [items]);

  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach(i => { map[i.status] = (map[i.status] ?? 0) + 1; });
    return map;
  }, [items]);

  function handleLinkSave(actionId: number) {
    linkMut.mutate({ actionId, moduleId: selectedModuleId ? Number(selectedModuleId) : null });
    setLinkingId(null);
    setSelectedModuleId("");
  }

  const pct = stats.total > 0 ? Math.round((stats.concluido / stats.total) * 100) : 0;

  return (
    <AppLayout>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ucg-page">
        <div className="ucg-wrap">

          {/* Header */}
          <div className="ucg-header">
            <div className="ucg-title">Ações Vinculadas ao Laudo</div>
            <div className="ucg-subtitle">
              Motor de correlação: riscos → ações preventivas → cursos → vencimentos → monitoramento
            </div>
          </div>

          {/* KPI row */}
          <div className="ucg-kpi-row">
            <div className="ucg-kpi">
              <div className="ucg-kpi-val">{stats.total}</div>
              <div className="ucg-kpi-lbl">Total de ações</div>
            </div>
            <div className="ucg-kpi">
              <div className="ucg-kpi-val green">{stats.concluido}</div>
              <div className="ucg-kpi-lbl">Concluídas</div>
            </div>
            <div className="ucg-kpi">
              <div className="ucg-kpi-val red">{stats.atrasado}</div>
              <div className="ucg-kpi-lbl">Em atraso</div>
            </div>
            <div className="ucg-kpi">
              <div className="ucg-kpi-val amber">{stats.sem_modulo}</div>
              <div className="ucg-kpi-lbl">Sem curso vinculado</div>
            </div>
          </div>

          {/* Progress bar */}
          {stats.total > 0 && (
            <div className="ucg-progress">
              <div className="ucg-progress-header">
                <span className="ucg-progress-label">Progresso geral</span>
                <span className="ucg-progress-sub">{stats.concluido}/{stats.total} ações concluídas</span>
              </div>
              <div className="ucg-progress-bar">
                <div className="ucg-progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="ucg-progress-pct">{pct}% concluído</div>
            </div>
          )}

          {/* Toolbar + search */}
          <div className="ucg-toolbar">
            <div className="ucg-search-wrap">
              <svg className="ucg-search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                className="ucg-search"
                placeholder="Buscar ação, fator, setor, responsável..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Priority filter */}
          <div className="ucg-filter-section">
            <div className="ucg-filter-label">Prioridade</div>
            <div className="ucg-filters">
              <button
                className={`ucg-pill${filterPriority === "todos" ? " active" : ""}`}
                onClick={() => setFilterPriority("todos")}
              >
                Todas
                <span className="ucg-cnt">{items.length}</span>
              </button>
              {[
                { value: "critica", label: "Crítica" },
                { value: "alta",    label: "Alta" },
                { value: "media",   label: "Média" },
                { value: "baixa",   label: "Baixa" },
              ].map(p => (
                <button
                  key={p.value}
                  className={`ucg-pill${filterPriority === p.value ? " active" : ""}`}
                  onClick={() => setFilterPriority(p.value)}
                >
                  {p.label}
                  {(priCounts[p.value] ?? 0) > 0 && (
                    <span className="ucg-cnt">{priCounts[p.value]}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Status filter */}
          <div className="ucg-filter-section" style={{ marginBottom: 20 }}>
            <div className="ucg-filter-label">Status</div>
            <div className="ucg-filters">
              <button
                className={`ucg-pill${filterStatus === "todos" ? " active" : ""}`}
                onClick={() => setFilterStatus("todos")}
              >
                Todos os status
              </button>
              {[
                { value: "programado",   label: "Programado" },
                { value: "em_andamento", label: "Em andamento" },
                { value: "concluido",    label: "Concluído" },
                { value: "atrasado",     label: "Atrasado" },
              ].map(s => (
                <button
                  key={s.value}
                  className={`ucg-pill${filterStatus === s.value ? " active" : ""}`}
                  onClick={() => setFilterStatus(s.value)}
                >
                  {s.label}
                  {(statusCounts[s.value] ?? 0) > 0 && (
                    <span className="ucg-cnt">{statusCounts[s.value]}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          {actionsQ.isLoading ? (
            <div className="ucg-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="ucg-card">
                  <div className="ucg-skel" style={{ height: 72 }} />
                  <div className="ucg-body" style={{ gap: 10 }}>
                    <div className="ucg-skel" style={{ height: 12, width: "45%" }} />
                    <div className="ucg-skel" style={{ height: 38 }} />
                    <div className="ucg-skel" style={{ height: 11, width: "80%" }} />
                    <div className="ucg-skel" style={{ height: 11, width: "55%" }} />
                    <div className="ucg-skel" style={{ height: 11, width: "65%" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="ucg-grid">
              {filtered.length === 0 ? (
                <div className="ucg-empty">
                  <svg viewBox="0 0 24 24"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                  <p>Nenhuma ação encontrada</p>
                  <small>As ações são geradas automaticamente a partir das análises de risco psicossocial.</small>
                </div>
              ) : filtered.map((item: any) => {
                const overdue   = isOverdue(item.endDate, item.status);
                const priCfg    = priorityConfig(item.priority);
                const isLinking = linkingId === item.id;
                const deadline  = fmtDate(item.endDate);

                return (
                  <div key={item.id} className={`ucg-card${overdue ? " overdue" : ""}`}>

                    {/* Thumb */}
                    <div className="ucg-thumb" style={{ background: priCfg.grad }}>
                      <div className="ucg-thumb-content">
                        {overdue && <div className="ucg-overdue-dot" title="Atrasado" />}
                        {item.factorCode && (
                          <span className="ucg-factor-badge">{item.factorCode}</span>
                        )}
                      </div>
                    </div>

                    {/* Body */}
                    <div className="ucg-body">
                      {/* Priority category pill */}
                      <span className="ucg-cat" style={{ background: priCfg.bg, color: priCfg.color }}>
                        {priCfg.label}
                      </span>

                      {/* Title: action description */}
                      <div className="ucg-card-title">{item.actionDescription}</div>

                      {/* Desc: factorCode + factorName */}
                      {item.factorName && (
                        <div className="ucg-card-desc">
                          {item.factorCode ? `${item.factorCode} — ` : ""}{item.factorName}
                        </div>
                      )}

                      {/* Meta */}
                      <div className="ucg-meta">
                        {item.sectorName && (
                          <div className="ucg-meta-item">
                            <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                            {item.sectorName}
                          </div>
                        )}
                        {item.responsibleParty && (
                          <div className="ucg-meta-item">
                            <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            {item.responsibleParty}
                          </div>
                        )}
                        {deadline && (
                          <div className={`ucg-meta-item${overdue ? " overdue-text" : ""}`}>
                            <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            Prazo: {deadline}{overdue ? " — Atrasado" : ""}
                          </div>
                        )}
                        {item.cycleName && (
                          <div className="ucg-meta-item" style={{ opacity: .75 }}>
                            <svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                            {item.cycleName}
                          </div>
                        )}
                      </div>

                      {/* Course linked */}
                      {isLinking ? (
                        <div className="ucg-link-inline">
                          <Select value={selectedModuleId} onValueChange={setSelectedModuleId}>
                            <SelectTrigger style={{ height: 32, fontSize: 12 }}>
                              <SelectValue placeholder="Selecione um curso..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">— Remover vínculo —</SelectItem>
                              {modules
                                .filter((m: any) => m.publishStatus === "published" || !m.publishStatus)
                                .map((m: any) => (
                                  <SelectItem key={m.id} value={String(m.id)} style={{ fontSize: 12 }}>
                                    {m.title}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <div className="ucg-link-inline-row">
                            <button className="ucg-save-btn" onClick={() => handleLinkSave(item.id)}>
                              Salvar
                            </button>
                            <button className="ucg-cancel-btn" onClick={() => setLinkingId(null)}>
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="ucg-course-row">
                          {/* BookOpen icon */}
                          <svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                          {item.moduleId ? (
                            <span className="ucg-course-label">{item.moduleTitle}</span>
                          ) : (
                            <span className="ucg-no-course">Sem curso vinculado</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Footer: status select + vincular/trocar button */}
                    <div className="ucg-footer">
                      <Select
                        value={item.status}
                        onValueChange={(v) => updateMut.mutate({ id: item.id, status: v })}
                      >
                        <SelectTrigger style={{ height: 32, fontSize: 12 }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(s => (
                            <SelectItem key={s.value} value={s.value} style={{ fontSize: 12 }}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!isLinking && (
                        <button
                          className="ucg-fb ucg-fg"
                          style={{ flex: "0 0 auto", padding: "7px 13px", whiteSpace: "nowrap" }}
                          onClick={() => {
                            setLinkingId(item.id);
                            setSelectedModuleId(item.moduleId ? String(item.moduleId) : "");
                          }}
                        >
                          <svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                          {item.moduleId ? "Trocar" : "Vincular"}
                        </button>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
