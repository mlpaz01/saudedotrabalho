import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";

function BarH({ value }: { value: number }) {
  const c = value >= 70 ? "#059669" : value >= 40 ? "#D97706" : "#DC2626";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 8, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: 8, width: `${value}%`, background: c, borderRadius: 4 }} />
      </div>
      <span style={{ fontWeight: 700, color: c, width: 40, textAlign: "right", fontSize: 13 }}>{value}%</span>
    </div>
  );
}

export default function RelatorioFiscalizacao() {
  const q = trpc.compliance.relatorioFiscalizacaoData.useQuery();

  useEffect(() => {
    if (q.data) {
      document.title = `Relatório Fiscalização NR-01 — ${q.data.company?.name ?? "Empresa"}`;
    }
  }, [q.data]);

  if (q.isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 16 }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "#059669" }} />
        <p style={{ color: "#64748b" }}>Gerando relatório...</p>
      </div>
    );
  }

  const d = q.data;
  if (!d) return <div style={{ padding: 40, textAlign: "center", color: "#ef4444" }}>Dados não disponíveis.</div>;

  const now = new Date(d.generatedAt);
  const dateStr = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const statusLabel = (s: string) =>
    ({ completed: "Concluído", done: "Concluído", in_progress: "Em Andamento", pending: "Pendente", cancelled: "Cancelado" }[s] ?? s);
  const riskColor = (l: string) =>
    ({ alto: "#DC2626", medio: "#D97706", baixo: "#059669", critico: "#7c3aed" }[(l || "").toLowerCase()] ?? "#64748b");

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; color: #1e293b; background: #f8fafc; }
        .page { max-width: 900px; margin: 0 auto; padding: 40px; background: white; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #f1f5f9; padding: 8px 12px; text-align: left; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; }
        td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }
        tr:last-child td { border-bottom: none; }
        .section { margin-top: 32px; }
        .section-title { font-size: 14px; font-weight: 700; color: #0f172a; border-left: 4px solid #059669; padding-left: 10px; margin-bottom: 14px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
        .no-print { position: fixed; top: 20px; right: 20px; z-index: 100; }
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          .page { padding: 20px; max-width: 100%; }
        }
      `}</style>

      <button className="no-print"
        onClick={() => window.print()}
        style={{ background: "#059669", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 600, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
        🖨️ Imprimir / Salvar PDF
      </button>

      <div className="page">
        {/* Capa */}
        <div style={{ borderBottom: "3px solid #059669", paddingBottom: 28, marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#059669", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
                Saúde do Trabalho · Plataforma de Gestão SST
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", lineHeight: 1.2 }}>
                Relatório para Fiscalização
              </h1>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "#059669", marginTop: 4 }}>
                NR-01 — Gerenciamento de Riscos Ocupacionais
              </h2>
            </div>
            <div style={{ textAlign: "right", fontSize: 12, color: "#64748b" }}>
              <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 14 }}>{d.company?.name ?? "—"}</div>
              {d.company?.cnpj && <div>CNPJ: {d.company.cnpj}</div>}
              {d.company?.city && <div>{d.company.city}{d.company.state ? `, ${d.company.state}` : ""}</div>}
              <div style={{ marginTop: 8 }}>Emitido em: {dateStr} às {timeStr}</div>
            </div>
          </div>
        </div>

        {/* Score */}
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: 20, marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>ÍNDICE GERAL DE CONFORMIDADE NR-01</div>
              <div style={{ fontSize: 42, fontWeight: 800, color: d.score >= 70 ? "#059669" : d.score >= 40 ? "#D97706" : "#DC2626", lineHeight: 1 }}>{d.score}%</div>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                {d.score >= 70 ? "✅ Empresa pronta para fiscalização" : d.score >= 40 ? "⚠️ Conformidade parcial — ações necessárias" : "❌ Atenção urgente — múltiplas não conformidades"}
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {d.axes.map((ax: any) => (
              <div key={ax.label}>
                <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>{ax.label}</div>
                <BarH value={ax.score} />
              </div>
            ))}
          </div>
        </div>

        {/* Dados Gerais */}
        <div className="section">
          <div className="section-title">1. Dados da Empresa</div>
          <table>
            <tbody>
              {[
                ["Razão Social", d.company?.name ?? "—"],
                ["CNPJ", d.company?.cnpj ?? "—"],
                ["Endereço", d.company?.address ?? "—"],
                ["Município/UF", d.company?.city ? `${d.company.city}/${d.company.state ?? ""}` : "—"],
                ["Total de Colaboradores", String(d.stats.totalEmp)],
                ["Responsável Técnico", d.respTec ? `${d.respTec.name} (${d.respTec.council ?? ""} ${d.respTec.council_number ?? ""})` : "Não cadastrado"],
              ].map(([k, v]) => (
                <tr key={k}><td style={{ width: 220, fontWeight: 600, color: "#475569" }}>{k}</td><td>{v}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Participação */}
        <div className="section">
          <div className="section-title">2. Participação dos Trabalhadores</div>
          <table>
            <tbody>
              {[
                ["Total de Trabalhadores", String(d.stats.totalEmp)],
                ["Respondentes (Pesquisas)", `${d.stats.respondentes} (${d.stats.partRate}%)`],
                ["Pesquisas Aplicadas", String(d.surveys.length)],
              ].map(([k, v]) => (
                <tr key={k}><td style={{ width: 280, fontWeight: 600, color: "#475569" }}>{k}</td><td>{v}</td></tr>
              ))}
            </tbody>
          </table>
          {d.surveys.length > 0 && (
            <table style={{ marginTop: 10 }}>
              <thead><tr><th>Instrumento Aplicado</th><th>Tipo</th><th>Respondentes</th></tr></thead>
              <tbody>
                {d.surveys.map((s: any, i: number) => (
                  <tr key={i}><td>{s.title ?? `Pesquisa #${i + 1}`}</td><td>{s.type ?? "—"}</td><td>{s.respondentes}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Inventário */}
        <div className="section">
          <div className="section-title">3. Inventário de Riscos Identificados ({d.inventory.length} registro(s))</div>
          {d.inventory.length === 0 ? (
            <div style={{ padding: 16, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", fontSize: 13 }}>
              ⚠️ Nenhum risco identificado no inventário. Obrigatório pela NR-01.
            </div>
          ) : (
            <table>
              <thead><tr><th>Descrição do Risco</th><th>Tipo</th><th>Nível</th><th>Setor</th></tr></thead>
              <tbody>
                {d.inventory.map((r: any, i: number) => (
                  <tr key={i}>
                    <td>{r.description ?? "—"}</td>
                    <td>{r.risk_type ?? "—"}</td>
                    <td><span className="badge" style={{ background: riskColor(r.risk_level) + "20", color: riskColor(r.risk_level) }}>{r.risk_level ?? "—"}</span></td>
                    <td>{r.sector_name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Plano de Ação */}
        <div className="section">
          <div className="section-title">4. Plano de Ação ({d.planItems.length} ação(ões))</div>
          {d.planItems.length === 0 ? (
            <div style={{ padding: 16, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", fontSize: 13 }}>
              ⚠️ Nenhuma ação cadastrada. Exigido pelo GRO/NR-01.
            </div>
          ) : (
            <table>
              <thead><tr><th>Ação</th><th>Responsável</th><th>Prazo</th><th>Status</th></tr></thead>
              <tbody>
                {d.planItems.map((p: any, i: number) => {
                  const overdue = p.due_date && new Date(p.due_date) < new Date() && !["completed","done"].includes(p.status);
                  return (
                    <tr key={i}>
                      <td>{p.title ?? "—"}</td>
                      <td>{p.responsible ?? "—"}</td>
                      <td style={{ color: overdue ? "#dc2626" : "inherit", fontWeight: overdue ? 700 : 400 }}>
                        {p.due_date ? new Date(p.due_date).toLocaleDateString("pt-BR") : "—"}
                        {overdue && " ⚠️"}
                      </td>
                      <td>{statusLabel(p.status)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {d.stats.planOverdue > 0 && (
            <div style={{ marginTop: 8, padding: 10, background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, fontSize: 12, color: "#c2410c" }}>
              ⚠️ {d.stats.planOverdue} ação(ões) com prazo vencido. Regularização imediata recomendada.
            </div>
          )}
        </div>

        {/* 13 Fatores */}
        <div className="section">
          <div className="section-title">5. Endereçamento dos 13 Fatores NR-01</div>
          <table>
            <thead><tr><th>Código</th><th>Fator de Risco Psicossocial</th><th>Cursos Vinculados</th><th>Situação</th></tr></thead>
            <tbody>
              {d.factors.map((f: any) => (
                <tr key={f.code}>
                  <td style={{ fontFamily: "monospace" }}>{f.code}</td>
                  <td>{f.name}</td>
                  <td style={{ textAlign: "center" }}>{f.cursos}</td>
                  <td>
                    <span className="badge" style={f.cursos > 0 ? { background: "#d1fae5", color: "#065f46" } : { background: "#fee2e2", color: "#991b1b" }}>
                      {f.cursos > 0 ? "✅ Endereçado" : "❌ Pendente"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Capacitação */}
        <div className="section">
          <div className="section-title">6. Capacitação e Treinamentos</div>
          <table>
            <tbody>
              {[
                ["Colaboradores com ao menos 1 curso concluído", `${d.stats.completers} de ${d.stats.totalEmp} (${d.stats.completionRate}%)`],
                ["Cursos vinculados a fatores NR-01", String(d.stats.coursesLinked)],
              ].map(([k, v]) => (
                <tr key={k}><td style={{ width: 340, fontWeight: 600, color: "#475569" }}>{k}</td><td>{v}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Certificados */}
        <div className="section">
          <div className="section-title">7. Certificados Emitidos ({d.certs.length})</div>
          {d.certs.length === 0 ? (
            <div style={{ padding: 14, background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, fontSize: 13, color: "#92400e" }}>
              Nenhum certificado emitido. Completar treinamentos para gerar evidências auditáveis.
            </div>
          ) : (
            <table>
              <thead><tr><th>Colaborador</th><th>E-mail</th><th>Código do Certificado</th><th>Data de Emissão</th></tr></thead>
              <tbody>
                {d.certs.map((c: any, i: number) => (
                  <tr key={i}>
                    <td>{c.user_name ?? "—"}</td>
                    <td>{c.email ?? "—"}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 11 }}>{c.certificate_code}</td>
                    <td>{c.issued_at ? new Date(c.issued_at).toLocaleDateString("pt-BR") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Assinatura */}
        <div className="section" style={{ marginTop: 48, borderTop: "2px solid #e2e8f0", paddingTop: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
            <div>
              <div style={{ height: 60, borderBottom: "1px solid #1e293b", marginBottom: 8 }} />
              <div style={{ fontSize: 12, color: "#475569" }}>
                {d.respTec ? (
                  <>
                    <strong>{d.respTec.name}</strong><br />
                    {d.respTec.council ?? ""} {d.respTec.council_number ?? ""}<br />
                    Responsável Técnico
                  </>
                ) : (
                  <span style={{ color: "#ef4444" }}>Responsável Técnico não cadastrado</span>
                )}
              </div>
            </div>
            <div>
              <div style={{ height: 60, borderBottom: "1px solid #1e293b", marginBottom: 8 }} />
              <div style={{ fontSize: 12, color: "#475569" }}>
                Representante Legal<br />
                {d.company?.name ?? ""}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 24, fontSize: 10, color: "#94a3b8", textAlign: "center" }}>
            Relatório gerado automaticamente pela Plataforma Saúde do Trabalho em {dateStr} às {timeStr} · As evidências referenciadas estão armazenadas com timestamp, IP e hash de integridade.
          </div>
        </div>
      </div>
    </>
  );
}
