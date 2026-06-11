import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

const UCG_STYLES = `@import url('https://fonts.googleapis.com/css2?family=Lora:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
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
.ucg-body{padding:13px 15px 15px;flex:1;display:flex;flex-direction:column;gap:7px}
.ucg-cat{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;width:fit-content;white-space:nowrap}
.ucg-card-title{font-size:13.5px;font-weight:700;color:#0E2C46;line-height:1.35;letter-spacing:-.01em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ucg-card-desc{font-size:12px;color:#62707D;line-height:1.5;flex:1;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ucg-meta{display:flex;align-items:center;gap:10px;font-size:11px;color:#92A0AC;font-weight:500;flex-wrap:wrap;margin-top:1px}
.ucg-meta-item{display:flex;align-items:center;gap:3px}
.ucg-meta-item svg{width:11px;height:11px;stroke:currentColor;fill:none;stroke-width:2;flex-shrink:0}
.ucg-footer{display:flex;gap:6px;margin-top:8px;padding-top:9px;border-top:1px solid #EFF2F6}
.ucg-fb{flex:1;padding:7px 8px;border-radius:9px;font-size:12px;font-weight:600;border:none;cursor:pointer;transition:all .14s;display:flex;align-items:center;justify-content:center;gap:4px;font-family:inherit}
.ucg-fb svg{width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2}
.ucg-fp{background:#0E2C46;color:#fff}
.ucg-fp:hover{background:#123451}
.ucg-status-badge{position:absolute;top:9px;right:9px;font-size:9.5px;font-weight:700;padding:3px 8px;border-radius:6px}
.ucg-sb-anon{background:rgba(124,58,237,.85);color:#fff}
.ucg-empty{grid-column:1/-1;text-align:center;padding:56px 20px;color:#92A0AC}
.ucg-empty svg{width:36px;height:36px;margin:0 auto 10px;display:block;opacity:.28;stroke:currentColor;fill:none;stroke-width:1.5}
.ucg-empty p{font-size:14px;font-weight:600;color:#62707D}`;

function surveyCategory(category: string | undefined) {
  const c = (category || '').toLowerCase();
  if (c.includes('psico') || c.includes('drps') || c.includes('nr-01') || c.includes('nr01')) return { label: 'DRPS', bg: 'rgba(29,78,216,.12)', color: '#1D4ED8', grad: 'linear-gradient(135deg,#1e3a8a,#3B82F6)' };
  if (c.includes('aep') || c.includes('ergon')) return { label: 'AEP', bg: 'rgba(124,58,237,.12)', color: '#7C3AED', grad: 'linear-gradient(135deg,#4c1d95,#A855F7)' };
  if (c.includes('clima') || c.includes('satisf') || c.includes('engaj')) return { label: 'Clima', bg: 'rgba(5,150,105,.12)', color: '#059669', grad: 'linear-gradient(135deg,#064e3b,#10B981)' };
  if (c.includes('burnout') || c.includes('estresse') || c.includes('esgot')) return { label: 'Burnout', bg: 'rgba(217,119,6,.12)', color: '#D97706', grad: 'linear-gradient(135deg,#78350f,#F59E0B)' };
  if (c.includes('assédio') || c.includes('assedio') || c.includes('sexual') || c.includes('moral')) return { label: 'Assédio', bg: 'rgba(220,38,38,.12)', color: '#DC2626', grad: 'linear-gradient(135deg,#7f1d1d,#EF4444)' };
  return { label: 'Geral', bg: 'rgba(100,116,139,.12)', color: '#475569', grad: 'linear-gradient(135deg,#334155,#475569)' };
}

const FILTERS = ['Todas', 'DRPS', 'AEP', 'Clima', 'Burnout', 'Assédio', 'Outras'] as const;

export default function EmployeeSurveys() {
  const { data: surveys, isLoading } = trpc.surveys.listForUser.useQuery();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('Todas');

  const list: any[] = (surveys as any[]) || [];

  const counts = useMemo(() => {
    const m: Record<string, number> = { Todas: list.length, DRPS: 0, AEP: 0, Clima: 0, Burnout: 0, 'Assédio': 0, Outras: 0 };
    list.forEach((s) => {
      const lbl = surveyCategory(s.category).label;
      if (lbl === 'Geral') m['Outras']++;
      else if (m[lbl] !== undefined) m[lbl]++;
      else m['Outras']++;
    });
    return m;
  }, [list]);

  const filtered = useMemo(() => {
    return list.filter((s) => {
      const matchSearch = !search || (s.title || '').toLowerCase().includes(search.toLowerCase()) || (s.description || '').toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;
      if (filter === 'Todas') return true;
      const lbl = surveyCategory(s.category).label;
      if (filter === 'Outras') return lbl === 'Geral';
      return lbl === filter;
    });
  }, [list, search, filter]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: UCG_STYLES }} />
      <div className="ucg-page">
        <div className="ucg-wrap">
          <div className="ucg-header">
            <h1 className="ucg-title">Pesquisas</h1>
            <p className="ucg-subtitle">Sua opinião conta. Participe e nos ajude a melhorar.</p>
          </div>

          <div className="ucg-toolbar">
            <div className="ucg-search-wrap">
              <svg className="ucg-search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              <input className="ucg-search" placeholder="Buscar pesquisas..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="ucg-filters">
              {FILTERS.map((f) => (
                <button key={f} className={`ucg-pill ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                  {f}
                  <span className="ucg-cnt">{counts[f] ?? 0}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="ucg-grid">
            {isLoading && <div className="ucg-empty"><p>Carregando...</p></div>}
            {!isLoading && filtered.length === 0 && (
              <div className="ucg-empty">
                <svg viewBox="0 0 24 24"><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /></svg>
                <p>Nenhuma pesquisa pendente no momento</p>
              </div>
            )}
            {!isLoading && filtered.map((s) => {
              const cat = surveyCategory(s.category);
              const qCount = Array.isArray(s.questions) ? s.questions.length : (typeof s.questionCount === 'number' ? s.questionCount : null);
              return (
                <Link key={s.id} href={`/pesquisas/${s.id}/responder`} className="ucg-card">
                  <div className="ucg-thumb" style={{ background: cat.grad }}>
                    <div className="ucg-thumb-icon">
                      <svg viewBox="0 0 24 24"><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M9 12h6M9 16h6" /></svg>
                    </div>
                    {s.isAnonymous && <span className="ucg-status-badge ucg-sb-anon">ANÔNIMA</span>}
                  </div>
                  <div className="ucg-body">
                    <span className="ucg-cat" style={{ background: cat.bg, color: cat.color }}>{cat.label}</span>
                    <div className="ucg-card-title">{s.title}</div>
                    {s.description && <div className="ucg-card-desc">{s.description}</div>}
                    {qCount !== null && (
                      <div className="ucg-meta">
                        <span className="ucg-meta-item">
                          <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                          {qCount} {qCount === 1 ? 'pergunta' : 'perguntas'}
                        </span>
                      </div>
                    )}
                    <div className="ucg-footer">
                      <button className="ucg-fb ucg-fp" type="button">
                        Responder
                        <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                      </button>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
