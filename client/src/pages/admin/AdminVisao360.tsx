import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

// ─── colour tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#F4F6F9",
  surface: "#FFFFFF",
  surface2: "#F7F9FB",
  border: "#E9EDF2",
  border2: "#E0E6ED",
  line: "#EFF2F6",
  ink: "#1C2A36",
  ink2: "#62707D",
  ink3: "#92A0AC",
  navy: "#0E2C46",
  navyTop: "#123451",
  navyBot: "#0A2138",
  green: "#2EA56A",
  greenD: "#228A57",
  greenL: "#43C285",
  amber: "#E8B23E",
  orange: "#E58638",
  red: "#E15648",
  blue: "#3D86D6",
  teal: "#1E8C86",
  violet: "#7C6BE6",
  gray: "#C2CBD4",
  greenSoft: "rgba(46,165,106,.12)",
  redSoft: "rgba(225,86,72,.12)",
  amberSoft: "rgba(232,178,62,.16)",
  orangeSoft: "rgba(229,134,56,.15)",
  blueSoft: "rgba(61,134,214,.12)",
} as const;

// ─── SVG helpers ──────────────────────────────────────────────────────────────
function IconUsers() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconAlert() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function IconFile() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}
function IconChevronRight({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
function IconArrowUp() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}
function IconArrowDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  );
}
function IconSparkle() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  );
}
function IconInfo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}
function IconBrain() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.14" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.14" />
    </svg>
  );
}
function IconMoreVertical() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}
function IconDownload() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────
interface DonutSegment { label: string; value: number; color: string }

function DonutChart({ segments, total }: { segments: DonutSegment[]; total: number }) {
  const r = 66;
  const cx = 86;
  const cy = 86;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  const arcs = segments.map((seg) => {
    const pct = total > 0 ? seg.value / total : 0;
    const dash = pct * circ;
    const gap = circ - dash;
    const startOffset = circ * (1 - offset / total);
    offset += seg.value;
    return { ...seg, dash, gap, startOffset };
  });

  return (
    <svg viewBox="0 0 172 172" width="172" height="172">
      {/* base track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#EDF1F5" strokeWidth="20" />
      {/* segments */}
      {arcs.map((arc, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={arc.color}
          strokeWidth="20"
          strokeDasharray={`${arc.dash} ${arc.gap}`}
          strokeDashoffset={arc.startOffset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: "stroke-dasharray 0.8s ease" }}
        />
      ))}
    </svg>
  );
}

// ─── Shared card styles ───────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  boxShadow: "0 1px 4px rgba(14,44,70,.07)",
  padding: "22px 24px",
};

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminVisao360() {
  const [, navigate] = useLocation();

  const usersQuery = trpc.admin.listUsers.useQuery({ page: 1, limit: 50 });
  const statsQuery = trpc.admin.stats.useQuery();
  const sectorQuery = trpc.admin.sectorEngagement.useQuery();

  const users = usersQuery.data?.data ?? [];
  const total = usersQuery.data?.total ?? statsQuery.data?.totalUsers ?? 0;
  const sectors = sectorQuery.data ?? [];

  // pending users = those who haven't set a password yet
  const pendingUsers = users.filter((u) => !u.hasSetPassword);
  const pendingCount = pendingUsers.length;

  // table rows — first 5 users with enough data to show
  const tableUsers = users.slice(0, 5);

  // Donut segments (static placeholder proportional to real total)
  const donutTotal = total > 0 ? total : 1249;
  const donutSegments: DonutSegment[] = [
    { label: "Apto", value: Math.round(donutTotal * 0.652), color: C.green },
    { label: "Apto c/ restrição", value: Math.round(donutTotal * 0.178), color: C.amber },
    { label: "Inapto temporário", value: Math.round(donutTotal * 0.072), color: C.orange },
    { label: "Inapto permanente", value: Math.round(donutTotal * 0.027), color: C.red },
    { label: "Não avaliado", value: Math.round(donutTotal * 0.073), color: C.gray },
  ];
  const donutActual = donutSegments.reduce((a, s) => a + s.value, 0);

  // sector progress bars
  const deptBars = sectors.length > 0
    ? sectors.slice(0, 6).map((s) => ({
        name: s.sector ?? "Sem setor",
        pct: s.total > 0 ? Math.round((Number(s.active) / Number(s.total)) * 100) : 0,
      }))
    : [
        { name: "Administrativo", pct: 92 },
        { name: "Operações", pct: 78 },
        { name: "Comercial", pct: 85 },
        { name: "Produção", pct: 66 },
        { name: "Logística", pct: 59 },
      ];

  const barColor = (pct: number) => pct >= 75 ? C.green : pct >= 60 ? C.amber : C.orange;

  // avatar colours
  const avatarColors = [C.green, C.orange, C.teal, C.violet, C.blue];
  const initials = (name?: string | null, email?: string) => {
    if (name) {
      const parts = name.trim().split(" ");
      return parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : parts[0].slice(0, 2).toUpperCase();
    }
    return (email ?? "?").slice(0, 2).toUpperCase();
  };

  // exam day offsets (static for now)
  const examDays = [7, 12, 18, 22, 28];
  const examTypes = ["ASO Periódico", "ASO Admissional", "ASO de Retorno", "ASO Periódico", "ASO Demissional"];
  const examUnits = ["SP - Pinheiros", "RJ - Centro", "SP - Vila Mariana", "SP - Paulista", "SP - Itaim"];

  return (
    <AppLayout>
      <div style={{ background: C.bg, minHeight: "100vh", padding: "24px 30px 44px", maxWidth: 1680, margin: "0 auto" }}>

        {/* ── PAGE HEAD ─────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "stretch", gap: 0, marginBottom: 28 }}>
          {/* left: title + subtitle */}
          <div style={{ flex: 1, paddingRight: 28, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <h1 style={{
              fontFamily: "'Lora', 'Playfair Display', Georgia, serif",
              fontSize: 34,
              fontWeight: 700,
              color: C.navy,
              margin: 0,
              letterSpacing: "-0.02em",
            }}>
              Visão 360°
            </h1>
            <p style={{ color: C.ink2, fontSize: 14, marginTop: 8, lineHeight: 1.6, maxWidth: 480 }}>
              Panorama completo de saúde ocupacional, exames, pendências e distribuição de status de todos os colaboradores da plataforma.
            </p>
          </div>

          {/* right: hero banner */}
          <div style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: "18px 0 0 18px",
            minHeight: 172,
            width: 480,
            flexShrink: 0,
            boxShadow: "0 4px 24px rgba(14,44,70,.18)",
            background: "#b9651f",
            marginRight: -30,
          }}>
            {/* photo */}
            <img
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80"
              alt=""
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
            {/* gradient overlay */}
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(90deg,#a0541a 0%,#c4762f 30%,rgba(185,100,40,.92) 44%,rgba(185,100,40,.55) 58%,rgba(185,100,40,.15) 72%,transparent 84%)",
            }} />
            {/* content */}
            <div style={{
              position: "absolute", left: 28, top: "50%", transform: "translateY(-50%)",
              display: "flex", alignItems: "center", gap: 14, zIndex: 2,
            }}>
              <div style={{ width: 52, height: 52, flexShrink: 0, filter: "drop-shadow(0 3px 8px rgba(0,0,0,.3))" }}>
                <IconShield />
              </div>
              <div style={{
                fontFamily: "'Lora', 'Playfair Display', Georgia, serif",
                fontSize: 20, fontWeight: 600, color: "#fff",
                textShadow: "0 2px 10px rgba(80,30,0,.35)",
                display: "flex", flexDirection: "column", gap: 2,
              }}>
                <span>Cuidando de quem cuida</span>
                <span>da sua empresa.</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── KPI STRIP ────────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18, marginBottom: 22 }}>

          {/* KPI 1 — Colaboradores */}
          <div style={{ ...cardStyle, transition: ".16s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, display: "grid", placeItems: "center", background: C.greenSoft, color: C.greenD, flexShrink: 0 }}>
                <IconUsers />
              </div>
              <div style={{ fontSize: 13, color: C.ink2, fontWeight: 600 }}>Colaboradores</div>
            </div>
            <div style={{ fontSize: 31, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 14, color: C.ink }}>
              {usersQuery.isLoading ? <span style={{ display: "inline-block", width: 80, height: 32, background: "#eee", borderRadius: 8 }} /> : total.toLocaleString("pt-BR")}
            </div>
            <div style={{ fontSize: 12, color: C.ink3, fontWeight: 600, marginTop: 9, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color: C.greenD }}><IconArrowUp />3,2%</span> vs mês anterior
            </div>
          </div>

          {/* KPI 2 — Pendências Críticas */}
          <div style={{ ...cardStyle, transition: ".16s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, display: "grid", placeItems: "center", background: C.redSoft, color: C.red, flexShrink: 0 }}>
                <IconAlert />
              </div>
              <div style={{ fontSize: 13, color: C.ink2, fontWeight: 600 }}>Pendências Críticas</div>
            </div>
            <div style={{ fontSize: 31, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 14, color: C.ink }}>
              {usersQuery.isLoading ? <span style={{ display: "inline-block", width: 60, height: 32, background: "#eee", borderRadius: 8 }} /> : pendingCount}
            </div>
            <div style={{ fontSize: 12, color: C.ink3, fontWeight: 600, marginTop: 9, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color: C.red }}><IconArrowDown />15%</span> vs mês anterior
            </div>
          </div>

          {/* KPI 3 — Exames Próximos */}
          <div style={{ ...cardStyle, transition: ".16s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, display: "grid", placeItems: "center", background: C.blueSoft, color: C.blue, flexShrink: 0 }}>
                <IconCalendar />
              </div>
              <div style={{ fontSize: 13, color: C.ink2, fontWeight: 600 }}>Exames Próximos</div>
            </div>
            <div style={{ fontSize: 31, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 14, color: C.ink }}>72</div>
            <div style={{ fontSize: 12, color: C.ink3, fontWeight: 600, marginTop: 9 }}>Próximos 30 dias</div>
          </div>

          {/* KPI 4 — Atestados Ativos (dark) */}
          <div style={{
            background: `linear-gradient(145deg, ${C.navyTop}, ${C.navyBot})`,
            border: `1px solid ${C.navyBot}`,
            borderRadius: 16,
            padding: "20px 22px",
            boxShadow: "0 1px 4px rgba(14,44,70,.2)",
            transition: ".16s",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, display: "grid", placeItems: "center", background: "rgba(255,255,255,.08)", color: "#fff", flexShrink: 0 }}>
                <IconFile />
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.65)", fontWeight: 600 }}>Atestados Ativos</div>
            </div>
            <div style={{ fontSize: 31, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 14, color: "#fff" }}>26</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)", fontWeight: 600, marginTop: 9, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color: C.greenL }}><IconArrowDown />8%</span> vs mês anterior
            </div>
          </div>
        </div>

        {/* ── GRID 3 ───────────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.02fr 1.04fr", gap: 20, marginBottom: 22 }}>

          {/* Col 1 — Alertas Prioritários */}
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.ink }}>Alertas Prioritários</h3>
              </div>
              <button
                onClick={() => navigate("/admin/usuarios")}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: C.greenD, padding: 0 }}
              >
                Ver todos →
              </button>
            </div>

            {/* Alert rows */}
            {[
              {
                dot: C.red,
                title: `${pendingCount} pendência${pendingCount !== 1 ? "s" : ""} crítica${pendingCount !== 1 ? "s" : ""} precisam de atenção`,
                sub: "Usuários sem senha configurada",
              },
              { dot: C.orange, title: "72 exames vencem nos próximos 30 dias", sub: "ASO Periódico e Admissional" },
              { dot: C.amber, title: "5 colaboradores com atestado há mais de 15 dias", sub: "Requer acompanhamento médico" },
            ].map((alert, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 13,
                padding: i === 0 ? "2px 0 16px" : "16px 0",
                borderTop: i === 0 ? "none" : `1px solid ${C.line}`,
              }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: alert.dot, flexShrink: 0, marginTop: 5 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, lineHeight: 1.4 }}>{alert.title}</div>
                  <div style={{ fontSize: 12, color: C.ink3, marginTop: 3 }}>{alert.sub}</div>
                </div>
                <span style={{ color: C.ink3, display: "flex", alignItems: "center" }}><IconChevronRight /></span>
              </div>
            ))}
          </div>

          {/* Col 2 — Índice de Saúde por Departamento */}
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.ink }}>Índice de Saúde por Departamento</h3>
              <button
                onClick={() => navigate("/admin/relatorios")}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: C.greenD, padding: 0, whiteSpace: "nowrap" }}
              >
                Ver relatório →
              </button>
            </div>
            {deptBars.map((dept, i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 8 }}>{dept.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, height: 9, borderRadius: 6, background: "#EDF1F5", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 6,
                      width: `${dept.pct}%`,
                      background: barColor(dept.pct),
                      transition: "width 1s cubic-bezier(.3,.7,.3,1)",
                    }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, width: 40, textAlign: "right", color: C.ink }}>{dept.pct}%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Col 3 — Distribuição do Status */}
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.ink }}>Distribuição do Status</h3>
              <button
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: C.greenD, padding: 0 }}
              >
                Ver detalhes →
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
              {/* donut */}
              <div style={{ position: "relative", width: 172, height: 172, flexShrink: 0 }}>
                <DonutChart segments={donutSegments} total={donutActual} />
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-0.02em", color: C.navy }}>
                    {total > 0 ? total.toLocaleString("pt-BR") : donutActual.toLocaleString("pt-BR")}
                  </div>
                  <div style={{ fontSize: 11, color: C.ink3, fontWeight: 600, marginTop: 2 }}>colaboradores</div>
                </div>
              </div>
              {/* legend */}
              <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                {donutSegments.map((seg, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                    <i style={{ width: 10, height: 10, borderRadius: "50%", background: seg.color, flexShrink: 0, fontStyle: "normal" }} />
                    <span style={{ flex: 1, color: C.ink2, fontWeight: 600 }}>{seg.label}</span>
                    <span style={{ fontWeight: 700, color: C.ink }}>{seg.value.toLocaleString("pt-BR")}</span>
                    <span style={{ color: C.ink3, fontWeight: 600, marginLeft: 6, fontSize: 11 }}>
                      {donutActual > 0 ? `${Math.round((seg.value / donutActual) * 1000) / 10}%` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── BOTTOM GRID ──────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1.78fr 1fr", gap: 20 }}>

          {/* Left — Próximos Exames */}
          <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
            {/* card header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px 14px", borderBottom: `1px solid ${C.border}` }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.ink }}>Próximos Exames ASO e Ocupacionais</h3>
              <button style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: C.greenSoft, color: C.greenD,
                border: "none", borderRadius: 9, padding: "7px 14px",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>
                <IconDownload />Exportar relatório
              </button>
            </div>

            {/* table */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Colaborador", "Cargo", "Tipo de Exame", "Vencimento", "Unidade", "Status", "Ações"].map((h) => (
                      <th key={h} style={{
                        textAlign: "left", fontSize: 11, fontWeight: 700, color: C.ink3,
                        padding: "0 16px 14px", borderBottom: `1px solid ${C.border}`,
                        paddingTop: 14,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {usersQuery.isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={7} style={{ padding: "14px 16px" }}>
                          <div style={{ height: 16, background: "#eee", borderRadius: 6 }} />
                        </td>
                      </tr>
                    ))
                  ) : tableUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: "32px 16px", textAlign: "center", color: C.ink3, fontSize: 13 }}>
                        Nenhum colaborador encontrado
                      </td>
                    </tr>
                  ) : (
                    tableUsers.map((u, i) => {
                      const days = examDays[i % examDays.length];
                      const venc = new Date();
                      venc.setDate(venc.getDate() + days);
                      return (
                        <tr key={u.id} style={{ borderTop: `1px solid ${C.line}`, background: "transparent" }}
                          onMouseEnter={e => (e.currentTarget.style.background = C.surface2)}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          {/* Colaborador */}
                          <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                              <div style={{
                                width: 34, height: 34, borderRadius: "50%",
                                background: avatarColors[i % avatarColors.length],
                                display: "grid", placeItems: "center",
                                color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0,
                              }}>
                                {initials(u.employeeName, u.email)}
                              </div>
                              <div>
                                <button
                                  onClick={() => navigate(`/admin/colaboradores/${u.id}`)}
                                  style={{
                                    background: "none", border: "none", cursor: "pointer",
                                    fontWeight: 700, color: C.ink, fontSize: 13, padding: 0,
                                    textAlign: "left",
                                  }}
                                >
                                  {u.employeeName ?? u.email.split("@")[0]}
                                </button>
                                <div style={{ fontSize: 11, color: C.ink3, marginTop: 1, fontWeight: 500 }}>{u.email}</div>
                              </div>
                            </div>
                          </td>
                          {/* Cargo */}
                          <td style={{ padding: "14px 16px", fontSize: 13, color: C.ink2, verticalAlign: "middle" }}>
                            {u.sector ?? "Colaborador"}
                          </td>
                          {/* Tipo */}
                          <td style={{ padding: "14px 16px", fontSize: 13, color: C.ink2, verticalAlign: "middle" }}>
                            {examTypes[i % examTypes.length]}
                          </td>
                          {/* Vencimento */}
                          <td style={{ padding: "14px 16px", fontSize: 13, color: C.ink2, verticalAlign: "middle" }}>
                            {venc.toLocaleDateString("pt-BR")}
                          </td>
                          {/* Unidade */}
                          <td style={{ padding: "14px 16px", fontSize: 13, color: C.ink2, verticalAlign: "middle" }}>
                            {u.company ?? examUnits[i % examUnits.length]}
                          </td>
                          {/* Status */}
                          <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                            <span style={{
                              fontSize: 11, fontWeight: 700, padding: "5px 11px", borderRadius: 8,
                              color: "#c2761d", background: C.amberSoft, whiteSpace: "nowrap",
                            }}>
                              Em {days} dias
                            </span>
                          </td>
                          {/* Ações */}
                          <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <button style={{
                                fontSize: 12, fontWeight: 700, color: C.greenD,
                                background: C.greenSoft, padding: "8px 16px", borderRadius: 9,
                                border: "none", cursor: "pointer",
                              }}>
                                Agendar
                              </button>
                              <button style={{
                                width: 28, height: 28, borderRadius: 8, color: C.ink3,
                                background: "none", border: `1px solid ${C.border}`,
                                display: "grid", placeItems: "center", cursor: "pointer",
                              }}>
                                <IconMoreVertical />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* card footer */}
            <div style={{ padding: "12px 22px", borderTop: `1px solid ${C.line}`, display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => navigate("/admin/usuarios")}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: C.greenD, padding: 0 }}
              >
                Ver todos os exames →
              </button>
            </div>
          </div>

          {/* Right — IA Insight */}
          <div style={{ ...cardStyle, display: "flex", flexDirection: "column" }}>
            {/* header */}
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 18 }}>
              <span style={{ color: C.greenD, display: "flex" }}><IconSparkle /></span>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.ink, flex: 1 }}>IA: insight preventivo</h3>
              <span style={{ color: C.ink3, display: "flex", cursor: "pointer" }}><IconInfo /></span>
            </div>

            {/* body */}
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flex: 1 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, color: C.ink2, lineHeight: 1.55, marginBottom: 13 }}>
                  A análise dos dados de <strong style={{ color: C.ink, fontWeight: 700 }}>engajamento por setor</strong> indica que colaboradores de Logística e Produção apresentam os menores índices de adesão aos programas de saúde, com risco elevado de absenteísmo no próximo trimestre.
                </p>
                <p style={{ fontSize: 13, color: C.ink2, lineHeight: 1.55, marginBottom: 0 }}>
                  Recomenda-se priorizar <strong style={{ color: C.ink, fontWeight: 700 }}>campanhas de conscientização</strong> e agendamento proativo de ASOs vencidos nesses setores para reduzir em até <strong style={{ color: C.ink, fontWeight: 700 }}>23% as pendências críticas</strong> até o fim do mês.
                </p>
              </div>
              <div style={{
                width: 92, height: 92, borderRadius: 16, flexShrink: 0,
                background: C.greenSoft, display: "grid", placeItems: "center", color: C.greenD,
              }}>
                <IconBrain />
              </div>
            </div>

            {/* footer */}
            <div style={{ marginTop: "auto", paddingTop: 18, borderTop: `1px solid ${C.line}`, display: "flex", justifyContent: "flex-end" }}>
              <button
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: C.greenD, padding: 0 }}
              >
                Ver recomendações →
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
