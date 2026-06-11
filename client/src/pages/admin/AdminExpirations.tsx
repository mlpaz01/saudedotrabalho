import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";

/* ── urgency helpers ──────────────────────────────────────────────────────── */
function daysUntil(expiresAt: string | Date | null | undefined): number | null {
  if (!expiresAt) return null;
  const now = Date.now();
  const exp = new Date(expiresAt).getTime();
  return Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
}

type UrgencyKey = "vencido" | "semana" | "30d" | "60d" | "ok";

function urgencyOf(expiresAt: string | Date | null | undefined, status: string): UrgencyKey {
  if (status === "expired") return "vencido";
  const d = daysUntil(expiresAt);
  if (d === null) return "ok";
  if (d < 0) return "vencido";
  if (d <= 7) return "semana";
  if (d <= 30) return "30d";
  if (d <= 60) return "60d";
  return "ok";
}

const URGENCY_CONFIG: Record<UrgencyKey, { label: string; bg: string; color: string; grad: string; badge: string }> = {
  vencido: { label: "Vencido",      bg: "rgba(220,38,38,.12)",   color: "#b83225", grad: "linear-gradient(135deg,#7f1d1d,#EF4444)", badge: "#b83225" },
  semana:  { label: "Esta semana",  bg: "rgba(229,134,56,.12)",  color: "#c4581a", grad: "linear-gradient(135deg,#431407,#F97316)", badge: "#c4581a" },
  "30d":   { label: "30 dias",      bg: "rgba(232,178,62,.12)",  color: "#a07a10", grad: "linear-gradient(135deg,#78350f,#FBBF24)", badge: "#a07a10" },
  "60d":   { label: "60 dias",      bg: "rgba(46,165,106,.12)",  color: "#228A57", grad: "linear-gradient(135deg,#064e3b,#10B981)", badge: "#228A57" },
  ok:      { label: "Em dia",       bg: "rgba(100,116,139,.12)", color: "#475569", grad: "linear-gradient(135deg,#334155,#475569)", badge: "#475569" },
};

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function dayLabel(expiresAt: string | Date | null | undefined, status: string): string {
  const d = daysUntil(expiresAt);
  if (d === null) return "Sem vencimento";
  if (d < 0) return `Vencido há ${Math.abs(d)} dias`;
  if (d === 0) return "Vence hoje";
  if (d === 1) return "Vence amanhã";
  return `${d} dias restantes`;
}

/* ── filter tabs ──────────────────────────────────────────────────────────── */
type FilterKey = "todos" | UrgencyKey;

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "todos",  label: "Todos" },
  { key: "vencido", label: "Vencido" },
  { key: "semana",  label: "Esta semana" },
  { key: "30d",     label: "30 dias" },
  { key: "60d",     label: "60 dias" },
];

/* ── main component ───────────────────────────────────────────────────────── */
export default function AdminExpirations() {
  const [filter, setFilter]   = useState<FilterKey>("todos");
  const [search, setSearch]   = useState("");

  const { data: raw, isLoading, refetch } = trpc.admin.companyExpirations.useQuery(undefined, { refetchOnWindowFocus: false });

  const items = useMemo(() => {
    const list = (raw ?? []).map((r: any) => ({
      ...r,
      urgency: urgencyOf(r.expiresAt, r.status ?? ""),
    }));
    // Sort by expiresAt ascending (nulls last)
    list.sort((a: any, b: any) => {
      const ax = a.expiresAt ? new Date(a.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
      const bx = b.expiresAt ? new Date(b.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
      return ax - bx;
    });
    return list;
  }, [raw]);

  const counts: Record<FilterKey, number> = useMemo(() => {
    const c: Record<FilterKey, number> = { todos: 0, vencido: 0, semana: 0, "30d": 0, "60d": 0, ok: 0 };
    for (const it of items) {
      c.todos++;
      if (it.urgency !== "ok") (c as any)[it.urgency]++;
    }
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    let list = filter === "todos" ? items : items.filter((it: any) => it.urgency === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((it: any) =>
        (it.licenseType ?? "").toLowerCase().includes(q) ||
        (it.licenseNumber ?? "").toLowerCase().includes(q) ||
        (it.userName ?? "").toLowerCase().includes(q) ||
        (it.userEmail ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, filter, search]);

  return (
    <AppLayout>
      <div className="ucg-page">
        <div className="ucg-wrap">

          {/* Header */}
          <div className="ucg-header">
            <h1 className="ucg-title">Vencimentos</h1>
            <p className="ucg-subtitle">Treinamentos, exames e certificados vencendo nos próximos dias</p>
          </div>

          {/* Toolbar */}
          <div className="ucg-toolbar">
            {/* Search */}
            <div className="ucg-search-wrap">
              <svg className="ucg-search-icon" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="ucg-search"
                placeholder="Buscar por tipo, colaborador..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Filter pills */}
            <div className="ucg-filters">
              {FILTER_TABS.map(tab => (
                <button
                  key={tab.key}
                  className={`ucg-pill${filter === tab.key ? " active" : ""}`}
                  onClick={() => setFilter(tab.key)}
                >
                  {tab.label}
                  {(counts as any)[tab.key] > 0 && (
                    <span className="ucg-cnt">{(counts as any)[tab.key]}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="ucg-actions">
              <button className="ucg-btn-ghost" onClick={() => refetch()}>
                <svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                Atualizar
              </button>
            </div>
          </div>

          {/* Grid */}
          <div className="ucg-grid">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))
            ) : filtered.length === 0 ? (
              <div className="ucg-empty">
                <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <p>{search ? "Nenhum resultado para a busca" : "Nenhum vencimento encontrado"}</p>
                <small>{search ? "Tente outros termos" : "Não há registros nesta categoria"}</small>
              </div>
            ) : (
              filtered.map((item: any) => (
                <ExpirationCard key={item.id} item={item} />
              ))
            )}
          </div>

        </div>
      </div>

      <style>{STYLES}</style>
    </AppLayout>
  );
}

/* ── Card ─────────────────────────────────────────────────────────────────── */
function ExpirationCard({ item }: { item: any }) {
  const urg  = item.urgency as UrgencyKey;
  const cfg  = URGENCY_CONFIG[urg] ?? URGENCY_CONFIG.ok;
  const days = daysUntil(item.expiresAt);

  return (
    <div className="ucg-card">
      {/* Thumb with gradient by urgency */}
      <div className="ucg-thumb" style={{ background: cfg.grad }}>
        <div className="ucg-thumb-icon">
          <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
        </div>
        {/* Status badge */}
        <span
          className="ucg-status-badge"
          style={{ background: cfg.badge + "cc", color: "#fff" }}
        >
          {cfg.label}
        </span>
      </div>

      {/* Body */}
      <div className="ucg-body">
        {/* Category pill */}
        <span className="ucg-cat" style={{ background: cfg.bg, color: cfg.color }}>
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          {cfg.label}
        </span>

        {/* Title: license type */}
        <div className="ucg-card-title">{item.licenseType || "Licença/Certificado"}</div>

        {/* Desc: employee + email */}
        <div className="ucg-card-desc">
          {item.userName || "Colaborador não identificado"}
          {item.userEmail ? ` · ${item.userEmail}` : ""}
        </div>

        {/* Meta */}
        <div className="ucg-meta">
          {item.licenseNumber && (
            <span className="ucg-meta-item">
              <svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              Nº {item.licenseNumber}
            </span>
          )}
          <span className="ucg-meta-item">
            <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Vence: {fmtDate(item.expiresAt)}
          </span>
          <span className="ucg-meta-item" style={{ color: cfg.color, fontWeight: 600 }}>
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {dayLabel(item.expiresAt, item.status ?? "")}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="ucg-footer">
        <button
          className="ucg-fb ucg-fg"
          onClick={() => toast.info(`Colaborador: ${item.userName ?? item.userEmail ?? "—"}\nTipo: ${item.licenseType}\nNúmero: ${item.licenseNumber ?? "—"}\nVencimento: ${fmtDate(item.expiresAt)}`)}
        >
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Ver detalhes
        </button>
        <button
          className="ucg-fb ucg-fp"
          style={urg === "vencido" || urg === "semana" ? { background: cfg.badge } : {}}
          onClick={() => toast.info(`Ação para ${item.userName ?? item.userEmail}: renovar ${item.licenseType}`)}
        >
          <svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          {urg === "vencido" ? "Renovar" : "Notificar"}
        </button>
      </div>
    </div>
  );
}

/* ── Skeleton ─────────────────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="ucg-card" style={{ pointerEvents: "none" }}>
      <div className="ucg-thumb ucg-skel" style={{ minHeight: 110 }} />
      <div className="ucg-body" style={{ gap: 8 }}>
        <div className="ucg-skel" style={{ height: 18, width: "55%", borderRadius: 6 }} />
        <div className="ucg-skel" style={{ height: 14, width: "80%", borderRadius: 6 }} />
        <div className="ucg-skel" style={{ height: 12, width: "65%", borderRadius: 6 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <div className="ucg-skel" style={{ height: 11, width: 80, borderRadius: 6 }} />
          <div className="ucg-skel" style={{ height: 11, width: 90, borderRadius: 6 }} />
        </div>
      </div>
      <div className="ucg-footer">
        <div className="ucg-skel" style={{ flex: 1, height: 30, borderRadius: 9 }} />
        <div className="ucg-skel" style={{ flex: 1, height: 30, borderRadius: 9 }} />
      </div>
    </div>
  );
}

/* ── Styles ───────────────────────────────────────────────────────────────── */
const STYLES = `
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
.ucg-actions{margin-left:auto;display:flex;gap:8px;align-items:center}
.ucg-btn-primary{display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:10px;font-size:13px;font-weight:700;background:linear-gradient(135deg,#2EA56A,#1a7a46);color:#fff;border:none;cursor:pointer;box-shadow:0 3px 12px rgba(46,165,106,.25);transition:all .15s;font-family:inherit;white-space:nowrap}
.ucg-btn-primary:hover{transform:translateY(-1px);box-shadow:0 5px 16px rgba(46,165,106,.35)}
.ucg-btn-primary svg{width:15px;height:15px;stroke:#fff;fill:none;stroke-width:2}
.ucg-btn-ghost{display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:10px;font-size:13px;font-weight:600;background:#fff;color:#0E2C46;border:1.5px solid #E0E6ED;cursor:pointer;transition:all .15s;font-family:inherit;white-space:nowrap}
.ucg-btn-ghost:hover{border-color:#0E2C46}
.ucg-btn-ghost svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2}
.ucg-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
@media(max-width:1280px){.ucg-grid{grid-template-columns:repeat(3,1fr)}}
@media(max-width:900px){.ucg-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.ucg-grid{grid-template-columns:1fr}}
.ucg-card{background:#fff;border:1.5px solid #E9EDF2;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;transition:box-shadow .18s,transform .18s,border-color .18s}
.ucg-card:hover{box-shadow:0 8px 28px -8px rgba(14,44,70,.14);transform:translateY(-2px);border-color:#D4DCE6}
.ucg-thumb{position:relative;aspect-ratio:16/9;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.ucg-thumb-icon{width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,.22);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center}
.ucg-thumb-icon svg{width:24px;height:24px;stroke:#fff;fill:none;stroke-width:1.8}
.ucg-body{padding:13px 15px 15px;flex:1;display:flex;flex-direction:column;gap:7px}
.ucg-cat{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;width:fit-content;white-space:nowrap}
.ucg-cat svg{width:11px;height:11px;stroke:currentColor;fill:none;stroke-width:2}
.ucg-card-title{font-size:13.5px;font-weight:700;color:#0E2C46;line-height:1.35;letter-spacing:-.01em}
.ucg-card-desc{font-size:12px;color:#62707D;line-height:1.5;flex:1;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ucg-meta{display:flex;align-items:center;gap:10px;font-size:11px;color:#92A0AC;font-weight:500;flex-wrap:wrap;margin-top:1px}
.ucg-meta-item{display:flex;align-items:center;gap:3px}
.ucg-meta-item svg{width:11px;height:11px;stroke:currentColor;fill:none;stroke-width:2;flex-shrink:0}
.ucg-footer{display:flex;gap:6px;margin-top:8px;padding-top:9px;border-top:1px solid #EFF2F6}
.ucg-fb{flex:1;padding:7px 8px;border-radius:9px;font-size:12px;font-weight:600;border:none;cursor:pointer;transition:all .14s;display:flex;align-items:center;justify-content:center;gap:4px;font-family:inherit}
.ucg-fb svg{width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2}
.ucg-fp{background:#0E2C46;color:#fff}
.ucg-fp:hover{background:#123451}
.ucg-fg{background:#F4F6F9;color:#0E2C46}
.ucg-fg:hover{background:#E9EDF2}
.ucg-fd{background:rgba(225,86,72,.1);color:#c0392b}
.ucg-fd:hover{background:rgba(225,86,72,.16)}
.ucg-empty{grid-column:1/-1;text-align:center;padding:56px 20px;color:#92A0AC}
.ucg-empty svg{width:36px;height:36px;margin:0 auto 10px;display:block;opacity:.28;stroke:currentColor;fill:none;stroke-width:1.5}
.ucg-empty p{font-size:14px;font-weight:600;color:#62707D}
.ucg-empty small{font-size:12px;margin-top:4px;display:block}
.ucg-skel{background:linear-gradient(90deg,#E9EDF2 0%,#F4F6F9 50%,#E9EDF2 100%);background-size:200% 100%;animation:shimmer 1.3s infinite;border-radius:8px}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.ucg-status-badge{position:absolute;top:9px;right:9px;font-size:9.5px;font-weight:700;padding:3px 8px;border-radius:6px}
`;
