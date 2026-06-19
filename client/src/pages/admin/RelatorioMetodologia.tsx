import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";

export default function RelatorioMetodologia() {
  const q = trpc.compliance.relatorioMetodologiaData.useQuery();

  useEffect(() => {
    if (q.data) {
      document.title = `Relatório de Legitimidade — ${q.data.company?.name ?? "Empresa"}`;
    }
  }, [q.data]);

  if (q.isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 16 }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "#0ea5e9" }} />
        <p style={{ color: "#64748b" }}>Gerando relatório...</p>
      </div>
    );
  }

  const d = q.data;
  if (!d) return <div style={{ padding: 40, textAlign: "center", color: "#ef4444" }}>Dados não disponíveis.</div>;

  const now = new Date(d.generatedAt);
  const dateStr = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const partRate = d.stats.totalEmp > 0 ? Math.min(100, Math.round((d.stats.respondentes / d.stats.totalEmp) * 100)) : 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; color: #1e293b; background: #f8fafc; }
        .page { max-width: 900px; margin: 0 auto; padding: 40px; background: white; }
        h3 { font-size: 14px; font-weight: 700; color: #0f172a; border-left: 4px solid #0ea5e9; padding-left: 10px; margin: 28px 0 14px; }
        p { font-size: 13px; line-height: 1.7; color: #334155; margin-bottom: 10px; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; }
        .card-label { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
        .card-value { font-size: 22px; font-weight: 800; color: #0f172a; }
        .card-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
        th { background: #f1f5f9; padding: 8px 12px; text-align: left; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; }
        td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }
        .highlight { background: #eff6ff; border-left: 3px solid #3b82f6; padding: 12px 16px; border-radius: 0 8px 8px 0; font-size: 13px; margin: 10px 0; }
        .warn { background: #fffbeb; border-left: 3px solid #f59e0b; padding: 12px 16px; border-radius: 0 8px 8px 0; font-size: 13px; margin: 10px 0; }
        .no-print { position: fixed; top: 20px; right: 20px; z-index: 100; }
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          .page { padding: 20px; max-width: 100%; }
          h3 { page-break-after: avoid; }
        }
      `}</style>

      <button className="no-print"
        onClick={() => window.print()}
        style={{ background: "#0ea5e9", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
        🖨️ Imprimir / Salvar PDF
      </button>

      <div className="page">
        {/* Capa */}
        <div style={{ borderBottom: "3px solid #0ea5e9", paddingBottom: 28, marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#0ea5e9", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
                Saúde do Trabalho · Plataforma de Gestão SST
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", lineHeight: 1.2 }}>
                Relatório de Legitimidade Metodológica
              </h1>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "#0ea5e9", marginTop: 4 }}>
                Gestão de Riscos Psicossociais — NR-01 / Portaria MTE 1.419/2024
              </h2>
            </div>
            <div style={{ textAlign: "right", fontSize: 12, color: "#64748b" }}>
              <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 14 }}>{d.company?.name ?? "—"}</div>
              {d.company?.cnpj && <div>CNPJ: {d.company.cnpj}</div>}
              <div style={{ marginTop: 8 }}>Emitido em: {dateStr} às {timeStr}</div>
            </div>
          </div>
        </div>

        {/* Resumo Quantitativo */}
        <div className="grid2" style={{ marginBottom: 28 }}>
          {[
            { label: "Colaboradores Avaliados", value: d.stats.respondentes, sub: `de ${d.stats.totalEmp} (${partRate}% de adesão)` },
            { label: "Instrumentos Aplicados", value: d.stats.surveyCount, sub: "pesquisas com respostas registradas" },
            { label: "Certificados Emitidos", value: d.stats.certCount, sub: "com código de validação único" },
            { label: "Aceites Eletrônicos", value: d.stats.termCount, sub: "com IP, data e hora registrados" },
          ].map(item => (
            <div key={item.label} className="card">
              <div className="card-label">{item.label}</div>
              <div className="card-value">{item.value}</div>
              <div className="card-sub">{item.sub}</div>
            </div>
          ))}
        </div>

        {/* 1. Apresentação */}
        <h3>1. Apresentação da Metodologia</h3>
        <p>
          Este documento descreve a metodologia empregada pela empresa <strong>{d.company?.name ?? "—"}</strong> para
          o gerenciamento dos riscos psicossociais ocupacionais, em conformidade com a <strong>NR-01 (atualizada pela
          Portaria MTE nº 1.419/2024)</strong>, que passou a exigir a identificação, avaliação e controle dos fatores
          de risco psicossocial como parte integrante do Gerenciamento de Riscos Ocupacionais (GRO).
        </p>
        <p>
          A plataforma Saúde do Trabalho foi utilizada como sistema de suporte ao GRO, integrando aplicação
          de instrumentos validados, trilha de capacitação, plano de ação, emissão de certificados e registros
          de auditoria, garantindo rastreabilidade ponta a ponta.
        </p>

        {/* 2. Base Legal */}
        <h3>2. Base Legal e Normativa</h3>
        <table>
          <thead><tr><th>Norma / Portaria</th><th>Conteúdo Relevante</th></tr></thead>
          <tbody>
            {[
              ["NR-01 (Portaria MTE 1.419/2024)", "Disposições Gerais e GRO — obrigatoriedade da gestão de riscos psicossociais"],
              ["Portaria MTE 1.419, de 28/08/2024", "Inclusão dos fatores de risco psicossociais na NR-01"],
              ["CLT, Art. 157 e 168", "Responsabilidades do empregador em saúde e segurança do trabalho"],
              ["LGPD — Lei 13.709/2018", "Tratamento de dados pessoais dos trabalhadores nas avaliações"],
              ["Resolução CFP nº 25/2023", "Orientações éticas sobre avaliações psicológicas organizacionais"],
              ["NR-04", "SESMT — suporte técnico nas avaliações ocupacionais"],
            ].map(([n, c]) => (
              <tr key={n}><td style={{ fontWeight: 600, width: 260 }}>{n}</td><td>{c}</td></tr>
            ))}
          </tbody>
        </table>

        {/* 3. Instrumentos */}
        <h3>3. Instrumentos de Avaliação Utilizados</h3>
        <p>
          Os instrumentos de avaliação psicossocial são questionários estruturados, aplicados digitalmente
          com controle de identidade, timestamp e IP de acesso, garantindo autenticidade das respostas.
        </p>
        {d.surveyNames.length > 0 && (
          <table>
            <thead><tr><th>Instrumento Aplicado</th><th>Tipo / Finalidade</th></tr></thead>
            <tbody>
              {d.surveyNames.map((s: any, i: number) => (
                <tr key={i}><td>{s.title ?? `Instrumento ${i + 1}`}</td><td>{s.type ?? "Avaliação psicossocial"}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="highlight" style={{ marginTop: 14 }}>
          <strong>13 Fatores NR-01 avaliados:</strong> Assédio de qualquer natureza · Falta de suporte ·
          Má gestão de mudanças · Baixa clareza de papel · Baixas recompensas · Baixa autonomia ·
          Baixa justiça organizacional · Eventos violentos · Subcarga · Sobrecarga ·
          Maus relacionamentos · Dificuldade de comunicação · Trabalho remoto/isolado.
        </div>

        {/* 4. Cadeia de Custódia */}
        <h3>4. Cadeia de Custódia das Evidências</h3>
        <p>
          Cada evidência gerada na plataforma passa por uma cadeia de custódia digital que garante
          sua autenticidade, integridade e não-repúdio:
        </p>
        <table>
          <thead><tr><th>Tipo de Evidência</th><th>Como é Registrado</th><th>Rastreabilidade</th></tr></thead>
          <tbody>
            {[
              ["Respostas a Pesquisas", "Armazenamento individual por usuário autenticado", "User ID + Timestamp + IP"],
              ["Aceites Eletrônicos", "Texto integral do termo + confirmação explícita", "User ID + IP + Data/Hora"],
              ["Conclusão de Cursos", "Progresso por aula, avaliação com pontuação mínima", "User ID + Pontuação + Data"],
              ["Certificados", "Código único alfanumérico gerado automaticamente", "Código validável + Data emissão"],
              ["Trilha de Auditoria", "Log de cada ação relevante na plataforma", "Ação + Entidade + IP + Timestamp"],
            ].map(([t, c, r]) => (
              <tr key={t}><td style={{ fontWeight: 600 }}>{t}</td><td>{c}</td><td style={{ fontFamily: "monospace", fontSize: 11 }}>{r}</td></tr>
            ))}
          </tbody>
        </table>

        {d.stats.auditCount > 0 && (
          <div className="highlight" style={{ marginTop: 10 }}>
            A plataforma registrou <strong>{d.stats.auditCount.toLocaleString("pt-BR")} evento(s)</strong> na trilha de auditoria
            para esta empresa, disponíveis para apresentação em fiscalizações e processos administrativos.
          </div>
        )}

        {/* 5. Confidencialidade e LGPD */}
        <h3>5. Confidencialidade e Proteção de Dados (LGPD)</h3>
        <p>
          Todo o tratamento de dados pessoais dos colaboradores observa os princípios da
          <strong> Lei Geral de Proteção de Dados — LGPD (Lei 13.709/2018)</strong>:
        </p>
        {[
          ["Finalidade", "Dados coletados exclusivamente para fins de saúde ocupacional e GRO/NR-01."],
          ["Adequação e Necessidade", "Coleta mínima — somente dados essenciais à avaliação psicossocial."],
          ["Transparência", "Colaboradores informados sobre os instrumentos aplicados e finalidade."],
          ["Segurança", "Dados armazenados em servidor dedicado com acesso restrito e criptografado."],
          ["Anonimização", "Relatórios consolidados não identificam individualmente respondentes, exceto quando necessário para laudos."],
          ["Direitos do Titular", "Colaboradores podem solicitar acesso, correção ou exclusão de seus dados pessoais."],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", gap: 12, marginBottom: 8 }}>
            <strong style={{ minWidth: 160, fontSize: 13, color: "#0369a1" }}>{k}:</strong>
            <p style={{ margin: 0 }}>{v}</p>
          </div>
        ))}

        {/* 6. Integridade e Rastreabilidade */}
        <h3>6. Integridade e Rastreabilidade</h3>
        <p>
          A integridade metodológica é assegurada pelos seguintes mecanismos técnicos e organizacionais:
        </p>
        {[
          "Cada resposta de pesquisa é associada a um usuário autenticado com e-mail verificado.",
          "Aceites eletrônicos registram o endereço IP, data, hora e o texto exato do termo aceito.",
          "Certificados possuem código único verificável diretamente na plataforma.",
          "Modificações em dados críticos são registradas na trilha de auditoria com identificação do usuário, IP e timestamp.",
          "Backups regulares garantem a preservação das evidências mesmo em caso de incidentes técnicos.",
          "Acesso ao sistema é controlado por perfis de permissão (RH, SESMT, Admin, Colaborador).",
        ].map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 13, alignItems: "flex-start" }}>
            <span style={{ color: "#0ea5e9", fontWeight: 700, flexShrink: 0 }}>✓</span>
            <span>{item}</span>
          </div>
        ))}

        {/* 7. Responsável */}
        <h3>7. Responsável Técnico pela Metodologia</h3>
        {d.respTec ? (
          <table>
            <tbody>
              {[
                ["Nome", d.respTec.name],
                ["Conselho Profissional", `${d.respTec.council ?? "—"} ${d.respTec.council_number ?? ""}`],
                ["Função / Cargo", d.respTec.role ?? "—"],
              ].map(([k, v]) => (
                <tr key={k}><td style={{ width: 220, fontWeight: 600, color: "#475569" }}>{k}</td><td>{v}</td></tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="warn">
            ⚠️ Nenhum responsável técnico cadastrado. Para auditoria completa, cadastre o RT em <strong>PGR {'>'} Responsáveis Técnicos</strong>.
          </div>
        )}

        {/* Conclusão */}
        <h3>8. Conclusão e Declaração de Conformidade</h3>
        <p>
          A empresa <strong>{d.company?.name ?? "—"}</strong> declara, por meio deste documento, que a gestão dos
          riscos psicossociais ocupacionais foi conduzida em conformidade com os requisitos da NR-01
          (Portaria MTE 1.419/2024), utilizando instrumentos validados, registros eletrônicos rastreáveis
          e trilha de auditoria com evidências digitais íntegras e não repudiáveis.
        </p>
        <p>
          As evidências aqui referenciadas ({d.stats.respondentes} avaliações, {d.stats.certCount} certificados,
          {" "}{d.stats.termCount} aceites eletrônicos) estão armazenadas na plataforma e disponíveis para
          apresentação a auditores, fiscais do trabalho e juízes em eventuais processos trabalhistas ou administrativos.
        </p>

        {/* Assinatura */}
        <div style={{ marginTop: 48, borderTop: "2px solid #e2e8f0", paddingTop: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
            <div>
              <div style={{ height: 60, borderBottom: "1px solid #1e293b", marginBottom: 8 }} />
              <div style={{ fontSize: 12, color: "#475569" }}>
                {d.respTec ? (
                  <><strong>{d.respTec.name}</strong><br />{d.respTec.council ?? ""} {d.respTec.council_number ?? ""}<br />Responsável Técnico</>
                ) : (
                  <span style={{ color: "#ef4444" }}>Responsável Técnico não cadastrado</span>
                )}
              </div>
            </div>
            <div>
              <div style={{ height: 60, borderBottom: "1px solid #1e293b", marginBottom: 8 }} />
              <div style={{ fontSize: 12, color: "#475569" }}>
                Representante Legal<br />{d.company?.name ?? ""}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 24, fontSize: 10, color: "#94a3b8", textAlign: "center" }}>
            Documento gerado automaticamente em {dateStr} às {timeStr} pela Plataforma Saúde do Trabalho ·
            Evidências armazenadas com hash de integridade, timestamp e IP · Documento com valor técnico, não substitui laudo pericial.
          </div>
        </div>
      </div>
    </>
  );
}
