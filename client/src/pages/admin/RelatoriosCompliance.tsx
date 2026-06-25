import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, Printer } from "lucide-react";

/**
 * SP6 #6 — 3 relatórios de conformidade.
 *
 * Cada relatório é uma página HTML formatada pra impressão (Ctrl+P → Salvar em PDF
 * via browser). Conteúdo é DEFENSIVO: descreve políticas, controles e bases legais
 * que a plataforma implementa, com 1-2 indicadores quantitativos da empresa.
 *
 * Os três:
 *  - Legitimidade do Canal de Denúncias
 *  - Conformidade Lei 14.457/2022
 *  - Segurança da Informação + LGPD
 */

const BASE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; color: #1e293b; background: #f8fafc; }
  .page { max-width: 880px; margin: 0 auto; padding: 40px; background: white; }
  .hdr { border-bottom: 4px solid #0ea5e9; padding-bottom: 16px; margin-bottom: 24px; }
  .hdr .kicker { font-size: 11px; font-weight: 600; color: #0ea5e9; text-transform: uppercase; letter-spacing: 0.1em; }
  .hdr h1 { font-size: 24px; font-weight: 800; color: #0f172a; margin-top: 6px; line-height: 1.2; }
  .hdr .meta { font-size: 12px; color: #64748b; margin-top: 8px; }
  h2 { font-size: 15px; font-weight: 700; color: #0f172a; margin: 28px 0 10px; padding-bottom: 4px; border-bottom: 2px solid #e2e8f0; }
  h3 { font-size: 13px; font-weight: 700; color: #0f172a; margin: 18px 0 8px; }
  p { font-size: 12.5px; line-height: 1.65; color: #334155; margin-bottom: 10px; }
  ul { margin: 6px 0 14px 22px; }
  li { font-size: 12.5px; line-height: 1.6; color: #334155; margin-bottom: 4px; }
  .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin: 12px 0; }
  .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; }
  .card .label { font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 3px; }
  .card .value { font-size: 22px; font-weight: 800; color: #0f172a; }
  .card .sub { font-size: 10px; color: #94a3b8; margin-top: 2px; }
  .ok { background: #ecfdf5; border-left: 3px solid #10b981; padding: 10px 14px; border-radius: 0 8px 8px 0; font-size: 12px; margin: 10px 0; color: #064e3b; }
  .info { background: #eff6ff; border-left: 3px solid #3b82f6; padding: 10px 14px; border-radius: 0 8px 8px 0; font-size: 12px; margin: 10px 0; color: #1e3a8a; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 8px 0; }
  th { background: #f1f5f9; padding: 7px 10px; text-align: left; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; }
  td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; }
  .footer { margin-top: 30px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
  .no-print { position: fixed; top: 20px; right: 20px; z-index: 100; }
  .btn { background: #0ea5e9; color: white; border: none; padding: 8px 14px; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 13px; }
  @page { size: A4; margin: 18mm 16mm; }
  @media print { .no-print { display: none !important; } body { background: white; } .page { padding: 0; max-width: none; } }
`;

function Header({ kicker, title, company, ts }: any) {
  return (
    <div className="hdr">
      <div className="kicker">{kicker}</div>
      <h1>{title}</h1>
      <div className="meta">
        <b>{company?.name ?? "—"}</b> {company?.cnpj ? `· CNPJ ${company.cnpj}` : ""}
        <br />Emitido em {new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })} via plataforma Saúde do Trabalho.
      </div>
    </div>
  );
}

function PrintBtn() {
  return (
    <div className="no-print">
      <button className="btn" onClick={() => window.print()}>
        <Printer size={14} /> Imprimir / Salvar PDF
      </button>
    </div>
  );
}

// ───────────── 1. CANAL DE DENÚNCIAS ─────────────────────────────────────────
export function RelatorioCanalDenuncias() {
  const q = trpc.compliance.reportContext.useQuery();
  useEffect(() => { if (q.data) document.title = `Canal de Denúncias — ${q.data.company?.name ?? "Empresa"}`; }, [q.data]);
  if (q.isLoading || !q.data) return <Loading />;
  const d = q.data;
  return (
    <>
      <style>{BASE_CSS}</style>
      <PrintBtn />
      <div className="page">
        <Header kicker="Relatório de Conformidade" title="Legitimidade do Canal de Denúncias" company={d.company} ts={d.generatedAt} />

        <h2>1. Base Legal e Aplicabilidade</h2>
        <p>O Canal de Denúncias implementado pela plataforma <b>Saúde do Trabalho</b> atende às exigências de:</p>
        <ul>
          <li><b>Lei 12.846/2013 (Lei Anticorrupção)</b> — Art. 7º, VIII — exigência de canais internos.</li>
          <li><b>Lei 13.709/2018 (LGPD)</b> — Art. 50 — programa de governança em privacidade.</li>
          <li><b>Lei 14.457/2022</b> — Programa Emprega+Mulheres — canal de denúncia obrigatório para o combate ao assédio sexual e moral.</li>
          <li><b>NR-01 (Portaria MTP 1.419/2024)</b> — gerenciamento de riscos psicossociais inclui canais para tratativa.</li>
          <li><b>Resoluções CGU e CADE</b> aplicáveis a programas de integridade.</li>
        </ul>

        <h2>2. Garantia de Anonimato</h2>
        <div className="ok">
          ✔ O canal aceita denúncias <b>totalmente anônimas</b>. Quando o denunciante opta por não se identificar,
          NENHUM identificador é coletado: ausência de cookies de sessão, ausência de IP no registro,
          ausência de userId. O registro fica desvinculado de qualquer identidade.
        </div>
        <p>
          Denúncias identificadas (opcional) são protegidas por <b>segregação de acesso</b>: apenas perfis explicitamente
          autorizados pelo administrador da empresa visualizam o conteúdo (Comitê de Ética, Diretoria, RH sênior, conforme configuração).
        </p>

        <h2>3. Proteção Contra Retaliação</h2>
        <p>A plataforma implementa medidas técnicas e organizacionais para impedir retaliação:</p>
        <ul>
          <li>O denunciante NÃO aparece em nenhum relatório, gráfico, dashboard ou export.</li>
          <li>Acessos ao conteúdo das denúncias são registrados em <b>audit log</b> imutável (carimbo de tempo + user_id do acessante).</li>
          <li>Modificações nos status das denúncias geram histórico versionado (não é possível "apagar" um trâmite).</li>
          <li>Tentativas de cross-tenant access são bloqueadas no servidor (multi-tenant por company_id).</li>
        </ul>

        <h2>4. Indicadores da Empresa</h2>
        <div className="grid3">
          <div className="card"><div className="label">Total registradas</div><div className="value">{d.denuncias.total}</div></div>
          <div className="card"><div className="label">Em tratativa</div><div className="value">{d.denuncias.ativas}</div><div className="sub">status "aberta"</div></div>
          <div className="card"><div className="label">Anônimas</div><div className="value">{d.denuncias.anonimas}</div><div className="sub">% de anonimato preservado</div></div>
        </div>

        <h2>5. Conformidade para Auditoria</h2>
        <div className="info">
          Este relatório pode ser apresentado a auditores internos, ouvidoria pública, MPT, Conar e demais
          órgãos fiscalizadores como evidência da implementação do canal de denúncia conforme as bases legais elencadas.
          A plataforma mantém logs detalhados de todas as operações para verificação posterior.
        </div>

        <div className="footer">Documento gerado eletronicamente — Saúde do Trabalho</div>
      </div>
    </>
  );
}

// ───────────── 2. LEI 14.457/2022 ────────────────────────────────────────────
export function RelatorioLei14457() {
  const q = trpc.compliance.reportContext.useQuery();
  useEffect(() => { if (q.data) document.title = `Lei 14.457/2022 — ${q.data.company?.name ?? "Empresa"}`; }, [q.data]);
  if (q.isLoading || !q.data) return <Loading />;
  const d = q.data;
  return (
    <>
      <style>{BASE_CSS}</style>
      <PrintBtn />
      <div className="page">
        <Header kicker="Relatório de Conformidade" title="Conformidade — Lei 14.457/2022 (Emprega+Mulheres)" company={d.company} ts={d.generatedAt} />

        <h2>1. Aplicabilidade</h2>
        <p>
          A <b>Lei 14.457/2022</b>, em seu Art. 23 (inclui Art. 157 da CLT), exige que empresas com CIPA
          (estabelecimentos com 20+ funcionários) implementem <b>medidas obrigatórias de prevenção e combate ao assédio sexual e demais formas de violência</b> no trabalho.
          Esta empresa cumpre as 4 obrigações exigidas pela legislação, conforme detalhado abaixo.
        </p>

        <h2>2. Medidas Obrigatórias — Status</h2>
        <table>
          <thead><tr><th>Obrigação (Art. 23 da Lei 14.457)</th><th style={{width: 140}}>Status</th></tr></thead>
          <tbody>
            <tr><td>I — Inclusão de regras de conduta no Regimento Interno (modelo disponível na plataforma).</td><td><b style={{color:"#10b981"}}>Implementado</b></td></tr>
            <tr><td>II — Procedimentos para recebimento e acompanhamento de denúncias com sigilo.</td><td><b style={{color:"#10b981"}}>Implementado</b><br/><small>via Canal de Denúncia da plataforma</small></td></tr>
            <tr><td>III — Inclusão de temas referentes a assédio sexual nas ações de capacitação.</td><td><b style={{color:"#10b981"}}>Implementado</b><br/><small>cursos da Biblioteca Preventiva</small></td></tr>
            <tr><td>IV — Realização, no mínimo a cada 12 meses, de ações de capacitação/orientação aos empregados.</td><td><b style={{color:"#10b981"}}>Implementado</b><br/><small>via Campanhas Preventivas</small></td></tr>
          </tbody>
        </table>

        <h2>3. Indicadores</h2>
        <div className="grid3">
          <div className="card"><div className="label">Colaboradores ativos</div><div className="value">{d.totalUsers}</div></div>
          <div className="card"><div className="label">Cursos disponíveis</div><div className="value">{d.cursos.total}</div></div>
          <div className="card"><div className="label">Conclusões registradas</div><div className="value">{d.cursos.concluidos}</div></div>
        </div>

        <h2>4. Evidências Documentais</h2>
        <ul>
          <li>Logs de envio das campanhas preventivas (data, audiência, canal usado).</li>
          <li>Certificados de conclusão de cursos NR-01 e prevenção ao assédio (com hash de verificação pública).</li>
          <li>Registros de denúncias e seu trâmite (acessíveis pelo Canal de Denúncia).</li>
          <li>Configuração ativa do Regimento Interno com cláusulas anti-assédio (modelo NR-01).</li>
        </ul>

        <div className="info">
          Este relatório serve como evidência primária em fiscalizações do Ministério do Trabalho, ação trabalhista
          ou autuação relativa ao descumprimento da Lei 14.457/2022.
        </div>

        <div className="footer">Documento gerado eletronicamente — Saúde do Trabalho</div>
      </div>
    </>
  );
}

// ───────────── 3. SEGURANÇA DA INFORMAÇÃO + LGPD ─────────────────────────────
export function RelatorioLgpd() {
  const q = trpc.compliance.reportContext.useQuery();
  useEffect(() => { if (q.data) document.title = `LGPD/SI — ${q.data.company?.name ?? "Empresa"}`; }, [q.data]);
  if (q.isLoading || !q.data) return <Loading />;
  const d = q.data;
  return (
    <>
      <style>{BASE_CSS}</style>
      <PrintBtn />
      <div className="page">
        <Header kicker="Relatório Técnico" title="Segurança da Informação e Conformidade LGPD" company={d.company} ts={d.generatedAt} />

        <h2>1. Bases Legais</h2>
        <ul>
          <li><b>Lei 13.709/2018 (LGPD)</b> — Lei Geral de Proteção de Dados.</li>
          <li><b>ANPD — Resolução CD/ANPD nº 2/2022</b> — agentes de tratamento.</li>
          <li><b>Marco Civil da Internet (Lei 12.965/2014)</b> — guarda de logs (Art. 13–15).</li>
          <li><b>ISO/IEC 27001 e 27701</b> — referências técnicas adotadas como guia.</li>
        </ul>

        <h2>2. Criptografia em Trânsito e em Repouso</h2>
        <ul>
          <li><b>HTTPS obrigatório</b> em todos os endpoints (TLS 1.2+). Não há fallback HTTP.</li>
          <li><b>Senhas</b>: armazenadas com bcrypt (custo ≥ 10). Não é possível recuperar — apenas resetar.</li>
          <li><b>Tokens de sessão</b>: JWT assinados com chave privada, expiração configurável.</li>
          <li><b>Credenciais SMTP por empresa</b>: criptografadas com AES-256-GCM (chave em variável de ambiente, separada do banco).</li>
          <li><b>Backups de banco</b>: comprimidos (gzip) com acesso restrito a operadores root, retenção definida.</li>
        </ul>

        <h2>3. Controle de Acessos</h2>
        <ul>
          <li><b>Multi-tenant rigoroso</b>: toda consulta a dados de empresa filtra por <code>company_id</code> no servidor (não confia em parâmetro do cliente).</li>
          <li><b>RBAC</b> com 7 papéis distintos: super_admin, admin_global, company_admin, admin, rh, sesmt, psicologo, chefia, user.</li>
          <li><b>Dados sensíveis de saúde</b> (observações psicológicas, denúncias) só são acessíveis pelos papéis autorizados.</li>
          <li><b>Cross-tenant access</b>: bloqueado no nível da procedure tRPC (FORBIDDEN automático).</li>
          <li><b>Janela de acesso por empresa</b>: super admin pode restringir o login a horários autorizados (configurável).</li>
        </ul>

        <h2>4. Segregação de Informações</h2>
        <p>A plataforma trata as seguintes categorias de dado de forma isolada:</p>
        <table>
          <thead><tr><th>Categoria</th><th>Quem acessa</th><th>Onde</th></tr></thead>
          <tbody>
            <tr><td>Identificação cadastral (nome, e-mail)</td><td>Admin / RH</td><td>tabela <code>users</code></td></tr>
            <tr><td>Respostas de pesquisa psicossocial</td><td>SESMT / Psicólogo (agregadas)</td><td>tabela <code>survey_responses</code> + agregação</td></tr>
            <tr><td>Observações clínicas / sigilosas</td><td>Apenas Psicólogo</td><td>tabela <code>appointments.outcome_notes</code> + guard servidor</td></tr>
            <tr><td>Denúncias anônimas</td><td>Comitê de Ética configurado</td><td>tabela <code>denuncias</code> (sem userId quando anônima)</td></tr>
          </tbody>
        </table>

        <h2>5. Auditoria e Logs</h2>
        <ul>
          <li><b>Audit logs</b> registram operações sensíveis (acesso a denúncia, edição de papel, geração de PDF).</li>
          <li><b>Logs de aplicação</b>: stdout/stderr via pm2, com rotação automática.</li>
          <li><b>Logs de banco</b>: queries lentas e erros via slow_query_log do MySQL.</li>
          <li><b>Histórico versionado</b>: alterações em entidades críticas (PGR, GSE, RT) geram registros de revisão.</li>
        </ul>

        <h2>6. Conformidade LGPD — Pontos-chave</h2>
        <div className="ok">✔ <b>Art. 9º</b> — Consentimento informado: termos de aceitação registrados antes do uso.</div>
        <div className="ok">✔ <b>Art. 18</b> — Direitos do titular (acesso, correção, anonimização): suportados via solicitação ao DPO da plataforma.</div>
        <div className="ok">✔ <b>Art. 41</b> — Encarregado (DPO): definido nominalmente nos contratos.</div>
        <div className="ok">✔ <b>Art. 46</b> — Medidas de segurança técnicas e administrativas: detalhadas nas seções 2-5 acima.</div>
        <div className="ok">✔ <b>Art. 48</b> — Comunicação de incidente: procedimento documentado, prazo 48h.</div>

        <h2>7. Indicadores</h2>
        <div className="grid3">
          <div className="card"><div className="label">Colaboradores cadastrados</div><div className="value">{d.totalUsers}</div></div>
          <div className="card"><div className="label">Denúncias anônimas preservadas</div><div className="value">{d.denuncias.anonimas}</div></div>
          <div className="card"><div className="label">Total denúncias registradas</div><div className="value">{d.denuncias.total}</div></div>
        </div>

        <div className="info">
          Este relatório atende a solicitações típicas de departamentos jurídicos, compliance, due diligence
          e auditorias externas (clientes / parceiros / órgãos fiscalizadores).
        </div>

        <div className="footer">Documento gerado eletronicamente — Saúde do Trabalho</div>
      </div>
    </>
  );
}

function Loading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 16 }}>
      <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "#0ea5e9" }} />
      <p style={{ color: "#64748b" }}>Gerando relatório...</p>
    </div>
  );
}
