import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, Printer } from "lucide-react";

/**
 * SP6 EXTRA — Página de impressão de uma pesquisa para distribuição em papel.
 *
 * URL: /admin/pesquisas/imprimir/:surveyId?setor=N
 *
 * Renderiza uma folha A4 com todas as questões, opções marcáveis (círculos) e
 * código do setor no rodapé. O RH/SESMT imprime, distribui aos colaboradores
 * analfabetos digitais, eles respondem a caneta e o RH transcreve depois via
 * /admin/pesquisas/importar/:surveyId.
 */
export default function SurveyImprimir() {
  const params = useParams() as { surveyId: string };
  const surveyId = Number(params.surveyId);
  const [loc] = useLocation();
  const sectorId = (() => {
    try { return Number(new URLSearchParams(loc.split("?")[1] ?? "").get("setor") ?? "0") || undefined; }
    catch { return undefined; }
  })();

  const q = trpc.compliance.surveyPrintable.useQuery({ surveyId, sectorId });
  useEffect(() => { if (q.data) document.title = `Imprimir — ${q.data.survey.title}`; }, [q.data]);

  if (q.isLoading || !q.data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 16 }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "#0ea5e9" }} />
        <p style={{ color: "#64748b" }}>Preparando formulário...</p>
      </div>
    );
  }
  const d = q.data;
  const today = new Date().toLocaleDateString("pt-BR");
  const setorLabel = d.sector ? `Setor: ${d.sector.name}` : "Setor: __________________________";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; color: #0f172a; background: #f8fafc; }
        .page { max-width: 720px; margin: 0 auto; padding: 30px; background: white; }
        .hdr { border-bottom: 3px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px; }
        .hdr h1 { font-size: 20px; font-weight: 800; }
        .hdr p { font-size: 12px; color: #475569; margin-top: 4px; }
        .meta { font-size: 11px; color: #64748b; margin-bottom: 16px; padding: 8px; background: #f1f5f9; border-radius: 6px; }
        .q { margin: 14px 0; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; }
        .q .num { font-size: 11px; color: #0ea5e9; font-weight: 700; }
        .q .txt { font-size: 13px; font-weight: 500; margin: 4px 0; }
        .opts { display: flex; gap: 14px; font-size: 12px; margin-top: 8px; flex-wrap: wrap; }
        .opt { display: flex; align-items: center; gap: 6px; }
        .opt .circle { display: inline-block; width: 16px; height: 16px; border: 2px solid #0f172a; border-radius: 50%; }
        .text-line { border-bottom: 1px solid #94a3b8; height: 22px; margin-top: 6px; }
        .footer { margin-top: 30px; padding-top: 12px; border-top: 1px dashed #cbd5e1; font-size: 10px; color: #64748b; text-align: center; }
        .no-print { position: fixed; top: 16px; right: 16px; z-index: 100; }
        .btn { background: #0ea5e9; color: white; border: none; padding: 8px 14px; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 13px; }
        @page { size: A4; margin: 12mm; }
        @media print { .no-print { display: none !important; } body { background: white; } .page { padding: 0; max-width: none; } }
      `}</style>
      <div className="no-print">
        <button className="btn" onClick={() => window.print()}>
          <Printer size={14} /> Imprimir
        </button>
      </div>
      <div className="page">
        <div className="hdr">
          <h1>{d.survey.title}</h1>
          {d.survey.description && <p>{d.survey.description}</p>}
        </div>
        <div className="meta">
          <b>{d.company?.name ?? "—"}</b><br />
          {setorLabel} &nbsp;·&nbsp; Data: {today} &nbsp;·&nbsp; <b>Esta resposta é anônima.</b>
        </div>
        {(d.questions ?? []).map((q: any, i: number) => {
          const type = String(q.question_type || "text").toLowerCase();
          let opts: string[] = [];
          try {
            const parsed = q.options ? JSON.parse(q.options) : null;
            opts = Array.isArray(parsed) ? parsed : [];
          } catch (_) {}
          // Se não tem options e é likert, usa padrão NR-01
          if (opts.length === 0 && (type.includes("likert") || type.includes("scale"))) {
            opts = ["1 Discordo totalmente", "2 Discordo", "3 Neutro", "4 Concordo", "5 Concordo totalmente"];
          }
          return (
            <div key={q.id} className="q">
              <div className="num">Questão {i + 1}</div>
              <div className="txt">{q.question_text}</div>
              {opts.length > 0 ? (
                <div className="opts">
                  {opts.map((o, oi) => (
                    <div key={oi} className="opt">
                      <span className="circle" />
                      <span>{o}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="text-line" />
                  <div className="text-line" />
                </>
              )}
            </div>
          );
        })}
        <div className="footer">
          Folha gerada em {today} · Plataforma Saúde do Trabalho · ID: SURVEY-{surveyId}{sectorId ? `-SETOR-${sectorId}` : ""}
        </div>
      </div>
    </>
  );
}
