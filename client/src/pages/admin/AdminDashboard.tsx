import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";

// ── Donut SVG for status distribution ───────────────────────────────────────
function DonutStatus({ active, pending, inactive }: { active: number; pending: number; inactive: number }) {
  const total = active + pending + inactive || 1;
  const COLORS = ["#2EA56A", "#F59E0B", "#94A3B8"];
  const values = [active, pending, inactive];
  const labels = ["Ativos", "Pendentes", "Inativos"];

  const r = 50;
  const cx = 60;
  const cy = 60;
  let cumAngle = -Math.PI / 2;

  const slices = values.map((v, i) => {
    const pct = v / total;
    const angle = pct * 2 * Math.PI;
    const x1 = cx + r * Math.cos(cumAngle);
    const y1 = cy + r * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + r * Math.cos(cumAngle);
    const y2 = cy + r * Math.sin(cumAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    return { v, pct, x1, y1, x2, y2, largeArc, color: COLORS[i], angle, label: labels[i] };
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <svg width={120} height={120} viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
        {slices.map((sl, i) => {
          if (sl.angle < 0.01) return null;
          return (
            <path
              key={i}
              d={`M ${cx} ${cy} L ${sl.x1} ${sl.y1} A ${r} ${r} 0 ${sl.largeArc} 1 ${sl.x2} ${sl.y2} Z`}
              fill={sl.color}
              stroke="#fff"
              strokeWidth={2}
            />
          );
        })}
        <circle cx={cx} cy={cy} r={30} fill="white" />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={14} fontWeight={800} fontFamily="'Plus Jakarta Sans',sans-serif" fill="#1E293B">
          {total}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize={8} fill="#94A3B8" fontFamily="'Plus Jakarta Sans',sans-serif">
          total
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {slices.map((sl, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: sl.color, flexShrink: 0, display: "inline-block" }} />
            <span style={{ fontSize: 13, color: "#475569" }}>{sl.label}</span>
            <span style={{ marginLeft: "auto", fontWeight: 700, fontSize: 13, color: "#1E293B", paddingLeft: 12 }}>{sl.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = trpc.admin.stats.useQuery();
  const { data: sectorData } = trpc.admin.sectorEngagement.useQuery();
  const { data: usersResp } = trpc.admin.listUsers.useQuery({});

  const sectors = sectorData ?? [];
  const pendingUsers = ((usersResp?.data ?? []) as any[]).filter((u: any) => !u.hasSetPassword);

  const totalUsers = Number(stats?.totalUsers ?? 0);
  const activeUsers = Number(stats?.activeUsers ?? 0);
  const inactiveUsers = Math.max(0, totalUsers - activeUsers - pendingUsers.length);

  // ── Styles ────────────────────────────────────────────────────────────────
  const PAGE_BG = "#F4F6F9";
  const CARD: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #E9EDF2",
    borderRadius: 16,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    overflow: "hidden",
  };
  const CARD_PAD: React.CSSProperties = { padding: "20px 24px" };
  const SERIF: React.CSSProperties = { fontFamily: "'Lora', Georgia, serif" };
  const SANS: React.CSSProperties = { fontFamily: "'Plus Jakarta Sans', sans-serif" };
  const GREEN = "#2EA56A";
  const GREEN_DARK = "#228A57";

  return (
    <AppLayout>
      <div style={{ background: PAGE_BG, minHeight: "100vh", padding: "32px 24px 48px", ...SANS }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>

          {/* ── 1. HEAD ─────────────────────────────────────────────────────── */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ ...SERIF, fontSize: 28, fontWeight: 700, color: "#1E293B", margin: 0, lineHeight: 1.3 }}>
              Visão 360° — Saúde Ocupacional
            </h1>
            <p style={{ fontSize: 14, color: "#64748B", marginTop: 6, marginBottom: 0 }}>
              Panorama consolidado de colaboradores, exames e conformidade regulatória.
            </p>
          </div>

          {/* ── 2. HERO BANNER ──────────────────────────────────────────────── */}
          <div style={{ marginBottom: 28, position: "relative", borderRadius: 16, overflow: "hidden" }}>
            {/* Amber/orange gradient */}
            <div
              style={{
                background: "linear-gradient(135deg, #F59E0B 0%, #EA580C 55%, #DC2626 100%)",
                borderRadius: 16,
                padding: "32px 36px",
                display: "flex",
                alignItems: "center",
                gap: 28,
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Decorative circle bleed right */}
              <div
                style={{
                  position: "absolute",
                  right: -60,
                  top: -60,
                  width: 280,
                  height: 280,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.08)",
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  right: 40,
                  bottom: -80,
                  width: 200,
                  height: 200,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.06)",
                  pointerEvents: "none",
                }}
              />

              {/* Shield logo */}
              <div style={{ flexShrink: 0, position: "relative", zIndex: 1 }}>
                <svg width={56} height={68} viewBox="0 0 56 68" fill="none">
                  <path
                    d="M28 2L4 12v22c0 14.4 10.3 27.9 24 31.2C41.7 61.9 52 48.4 52 34V12L28 2z"
                    fill="rgba(255,255,255,0.25)"
                    stroke="rgba(255,255,255,0.6)"
                    strokeWidth={2}
                  />
                  <path
                    d="M20 34l6 6 12-12"
                    stroke="white"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              {/* Text */}
              <div style={{ position: "relative", zIndex: 1, flex: 1 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.75)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Saúde do Trabalho
                </p>
                <h2 style={{ ...SERIF, margin: "6px 0 8px", fontSize: 24, fontWeight: 700, color: "#fff", lineHeight: 1.25 }}>
                  Cuidando de quem cuida da sua empresa.
                </h2>
                <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.8)", maxWidth: 460 }}>
                  Gestão integrada de medicina ocupacional, conformidade NR e bem-estar psicossocial — tudo em um único painel.
                </p>
              </div>
            </div>
          </div>

          {/* ── 3. KPI CARDS ────────────────────────────────────────────────── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 16,
              marginBottom: 28,
            }}
          >
            {/* Colaboradores */}
            <div style={CARD}>
              <div style={{ ...CARD_PAD }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>Colaboradores</span>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(46,165,106,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx={9} cy={7} r={4} />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, color: "#1E293B", lineHeight: 1 }}>
                  {statsLoading ? <span style={{ display: "inline-block", width: 60, height: 32, background: "#E9EDF2", borderRadius: 6 }} /> : totalUsers}
                </div>
                <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>
                  {activeUsers} ativos
                </div>
              </div>
            </div>

            {/* Pendências Críticas */}
            <div style={CARD}>
              <div style={{ ...CARD_PAD }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>Pendências Críticas</span>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(239,68,68,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1={12} y1={9} x2={12} y2={13} />
                      <line x1={12} y1={17} x2="12.01" y2={17} />
                    </svg>
                  </div>
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, color: "#1E293B", lineHeight: 1 }}>
                  {pendingUsers.length}
                </div>
                <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>
                  aguardando primeiro acesso
                </div>
              </div>
            </div>

            {/* Exames Próximos */}
            <div style={CARD}>
              <div style={{ ...CARD_PAD }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>Exames Próximos</span>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(59,130,246,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <rect x={3} y={4} width={18} height={18} rx={2} ry={2} />
                      <line x1={16} y1={2} x2={16} y2={6} />
                      <line x1={8} y1={2} x2={8} y2={6} />
                      <line x1={3} y1={10} x2={21} y2={10} />
                    </svg>
                  </div>
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, color: "#1E293B", lineHeight: 1 }}>
                  0
                </div>
                <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>
                  nos próximos 30 dias
                </div>
              </div>
            </div>

            {/* Atestados Ativos — dark card */}
            <div style={{ ...CARD, background: "#1E293B" }}>
              <div style={{ ...CARD_PAD }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>Atestados Ativos</span>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1={16} y1={13} x2={8} y2={13} />
                      <line x1={16} y1={17} x2={8} y2={17} />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </div>
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, color: "#fff", lineHeight: 1 }}>
                  0
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
                  em aberto este mês
                </div>
              </div>
            </div>
          </div>

          {/* ── 4. GRID 3 ───────────────────────────────────────────────────── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 16,
              marginBottom: 28,
            }}
          >
            {/* Alertas Prioritários */}
            <div style={CARD}>
              <div style={{ ...CARD_PAD, borderBottom: "1px solid #E9EDF2" }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1E293B" }}>Alertas Prioritários</h3>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94A3B8" }}>Ações que requerem atenção</p>
              </div>
              <div style={{ padding: "12px 0" }}>
                {pendingUsers.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 24px" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444", flexShrink: 0, marginTop: 4 }} />
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#1E293B" }}>
                          {pendingUsers.length} colaborador{pendingUsers.length > 1 ? "es" : ""} sem acesso
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94A3B8" }}>Nunca realizaram o primeiro login</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 24px" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#F59E0B", flexShrink: 0, marginTop: 4 }} />
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#1E293B" }}>Exames ASO pendentes</p>
                        <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94A3B8" }}>Verifique a agenda de exames periódicos</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 24px" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3B82F6", flexShrink: 0, marginTop: 4 }} />
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#1E293B" }}>Conformidade NR-01</p>
                        <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94A3B8" }}>Atualize o inventário de riscos psicossociais</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 24px" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: GREEN, flexShrink: 0, marginTop: 4 }} />
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#1E293B" }}>Nenhuma pendência crítica</p>
                        <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94A3B8" }}>Todos os indicadores estão normais</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 24px" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#F59E0B", flexShrink: 0, marginTop: 4 }} />
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#1E293B" }}>Revisão periódica recomendada</p>
                        <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94A3B8" }}>Agende os exames ASO do próximo trimestre</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 24px" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3B82F6", flexShrink: 0, marginTop: 4 }} />
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#1E293B" }}>Pesquisa de clima disponível</p>
                        <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94A3B8" }}>Inicie uma nova avaliação psicossocial</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Índice de Saúde por Departamento */}
            <div style={CARD}>
              <div style={{ ...CARD_PAD, borderBottom: "1px solid #E9EDF2" }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1E293B" }}>Índice de Saúde por Departamento</h3>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94A3B8" }}>Taxa de ativação por setor</p>
              </div>
              <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                {sectors.length === 0 ? (
                  <p style={{ fontSize: 13, color: "#94A3B8", textAlign: "center", padding: "16px 0" }}>Sem dados de setor</p>
                ) : (
                  sectors.slice(0, 6).map((s: any, i: number) => {
                    const total = Number(s.total ?? 0);
                    const active = Number(s.active ?? 0);
                    const pct = total > 0 ? Math.round((active / total) * 100) : 0;
                    const barColor = pct >= 80 ? GREEN : pct >= 60 ? "#F59E0B" : "#EF4444";
                    return (
                      <div key={i}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                          <span style={{ fontSize: 13, color: "#334155", fontWeight: 500 }}>{s.sector ?? "—"}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: barColor }}>{pct}%</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 99, background: "#E9EDF2", overflow: "hidden" }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${pct}%`,
                              borderRadius: 99,
                              background: barColor,
                              transition: "width 0.5s ease",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Distribuição do Status */}
            <div style={CARD}>
              <div style={{ ...CARD_PAD, borderBottom: "1px solid #E9EDF2" }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1E293B" }}>Distribuição do Status</h3>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94A3B8" }}>Colaboradores por situação</p>
              </div>
              <div style={{ padding: "20px 24px" }}>
                <DonutStatus
                  active={activeUsers}
                  pending={pendingUsers.length}
                  inactive={inactiveUsers}
                />
              </div>
            </div>
          </div>

          {/* ── 5. GRID BOTTOM ──────────────────────────────────────────────── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr",
              gap: 16,
            }}
          >
            {/* Próximos Exames ASO */}
            <div style={CARD}>
              <div style={{ ...CARD_PAD, borderBottom: "1px solid #E9EDF2" }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1E293B" }}>Próximos Exames ASO</h3>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94A3B8" }}>Agenda dos próximos 60 dias</p>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #E9EDF2" }}>
                      <th style={{ padding: "10px 24px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Colaborador</th>
                      <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Tipo</th>
                      <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Data</th>
                      <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: "Ana Souza", type: "Periódico", date: "10/07/2025", status: "Agendado", statusColor: "#3B82F6" },
                      { name: "Carlos Lima", type: "Admissional", date: "15/07/2025", status: "Pendente", statusColor: "#F59E0B" },
                      { name: "Maria Fernanda", type: "Retorno", date: "22/07/2025", status: "Agendado", statusColor: "#3B82F6" },
                    ].map((row, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "12px 24px", fontWeight: 600, color: "#1E293B" }}>{row.name}</td>
                        <td style={{ padding: "12px 16px", color: "#64748B" }}>{row.type}</td>
                        <td style={{ padding: "12px 16px", color: "#64748B" }}>{row.date}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{
                            display: "inline-block",
                            padding: "2px 10px",
                            borderRadius: 99,
                            fontSize: 11,
                            fontWeight: 700,
                            background: `${row.statusColor}18`,
                            color: row.statusColor,
                          }}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={4} style={{ padding: "14px 24px", textAlign: "center", color: "#94A3B8", fontSize: 12 }}>
                        Nenhum outro exame agendado nos próximos 60 dias
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* IA: insight preventivo */}
            <div style={{ ...CARD, background: "linear-gradient(160deg, #f0fdf6 0%, #fff 60%)" }}>
              <div style={{ ...CARD_PAD, borderBottom: "1px solid #E9EDF2" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {/* Brain icon */}
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(46,165,106,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24A2.5 2.5 0 0 1 9.5 2" />
                      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24A2.5 2.5 0 0 0 14.5 2" />
                    </svg>
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1E293B" }}>IA: Insight Preventivo</h3>
                    <p style={{ margin: 0, fontSize: 12, color: "#94A3B8" }}>Análise inteligente da saúde da equipe</p>
                  </div>
                </div>
              </div>
              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ padding: "14px 16px", background: "rgba(46,165,106,0.07)", borderRadius: 10, borderLeft: `3px solid ${GREEN}` }}>
                  <p style={{ margin: 0, fontSize: 13, color: "#1E293B", lineHeight: 1.6 }}>
                    {totalUsers > 0
                      ? `Com ${activeUsers} de ${totalUsers} colaboradores ativos (${Math.round((activeUsers / totalUsers) * 100)}%), sua equipe demonstra boa adesão à plataforma.`
                      : "Adicione colaboradores para começar a receber insights preventivos personalizados."}
                  </p>
                </div>

                {pendingUsers.length > 0 && (
                  <div style={{ padding: "14px 16px", background: "rgba(239,68,68,0.06)", borderRadius: 10, borderLeft: "3px solid #EF4444" }}>
                    <p style={{ margin: 0, fontSize: 13, color: "#1E293B", lineHeight: 1.6 }}>
                      <strong>{pendingUsers.length} colaborador{pendingUsers.length > 1 ? "es" : ""}</strong> ainda não realizaram o primeiro acesso. O engajamento precoce reduz em até 40% as ocorrências de absenteísmo.
                    </p>
                  </div>
                )}

                <div style={{ padding: "14px 16px", background: "rgba(59,130,246,0.06)", borderRadius: 10, borderLeft: "3px solid #3B82F6" }}>
                  <p style={{ margin: 0, fontSize: 13, color: "#1E293B", lineHeight: 1.6 }}>
                    Recomendação: realize pesquisas de clima trimestrais para monitorar indicadores de saúde psicossocial conforme exige a NR-01 atualizada.
                  </p>
                </div>

                <a
                  href="/admin/survey-studio"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "10px 18px",
                    background: GREEN,
                    color: "#fff",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 700,
                    textDecoration: "none",
                    alignSelf: "flex-start",
                    marginTop: 4,
                    boxShadow: `0 4px 14px rgba(46,165,106,0.3)`,
                  }}
                >
                  Iniciar pesquisa de clima
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <line x1={5} y1={12} x2={19} y2={12} />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
