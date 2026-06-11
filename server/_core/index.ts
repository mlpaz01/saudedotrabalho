import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  // Trust the nginx reverse-proxy so req.protocol reflects HTTPS and
  // req.ip contains the real client IP (required for SameSite=None + Secure cookies).
  app.set("trust proxy", 1);
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  app.use("/uploads", express.static("/var/www/saudedotrabalho/uploads"));
app.use("/pdfs", express.static("/var/www/saudedotrabalho/public/pdfs"));
  registerOAuthRoutes(app);

  // Public certificate verification (no auth)
  app.get(['/verificar/:codigo', '/plataforma/verificar/:codigo'], async (req, res) => {
    try {
      const { codigo } = req.params;
      const { getCertificateByCode, getUserById, getModuleById } = await import("../db");
      const c = await getCertificateByCode(codigo);
      if (!c) {
        return res.status(404).send(`<!doctype html><html><head><title>Certificado não encontrado</title><meta charset="utf-8"></head><body style="font-family:system-ui;padding:40px;max-width:600px;margin:auto;text-align:center;"><h1 style="color:#dc2626;">Certificado não encontrado</h1><p>O código <strong>${String(codigo).replace(/[<>]/g, '')}</strong> não foi localizado em nossa base.</p></body></html>`);
      }
      const user = await getUserById(c.userId);
      const mod = await getModuleById(c.moduleId);
      const esc = (s: any) => String(s ?? '—').replace(/[<>]/g, '');
      res.send(`<!doctype html><html><head><title>Certificado válido — Saúde do Trabalho</title><meta charset="utf-8"><style>body{font-family:system-ui;padding:40px;max-width:700px;margin:auto;}.box{background:#d1fae5;border:2px solid #10b981;border-radius:12px;padding:24px;}h1{color:#047857;}table{width:100%;margin-top:20px;border-collapse:collapse;}td{padding:10px;border-bottom:1px solid #e5e7eb;}td:first-child{font-weight:600;color:#374151;width:200px;}</style></head><body><div class="box"><h1>✓ Certificado autêntico</h1><p>Este certificado foi emitido pela plataforma <strong>Saúde do Trabalho</strong> e está registrado em nossa base.</p></div><table><tr><td>Código</td><td>${esc(c.certificateCode)}</td></tr><tr><td>Nome do titular</td><td>${esc(user?.name)}</td></tr><tr><td>E-mail</td><td>${esc(user?.email)}</td></tr><tr><td>Módulo concluído</td><td>${esc(mod?.title)}</td></tr><tr><td>Data de emissão</td><td>${c.issuedAt ? new Date(c.issuedAt as any).toLocaleString('pt-BR') : '—'}</td></tr></table><p style="margin-top:30px;font-size:0.85rem;color:#6b7280;">Verificação consultada em ${new Date().toLocaleString('pt-BR')}.</p></body></html>`);
    } catch (e) {
      console.error('[verificar] error', e);
      res.status(500).send('Erro ao verificar certificado');
    }
  });

  // ── Template downloads (CSV + documents) ────────────────────────────────
  app.get("/api/templates/colaboradores.csv", (_req, res) => {
    const csv = "email,nome,filial,setor,perfil\njoao@empresa.com,João Silva,Matriz,RH,Colaborador\nmaria@empresa.com,Maria Souza,Filial SP,TI,Chefia\n";
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="colaboradores_template.csv"');
    res.send("\uFEFF" + csv);
  });

  app.get("/api/templates/drps.csv", (_req, res) => {
    const csv = "setor,respondente_id,P01_Demanda_Quantitativa,P02_Pressao_Tempo,P03_Autonomia,P04_Apoio_Gestor,P05_Apoio_Colegas,P06_Reconhecimento,P07_Conflito_Papeis,P08_Clareza_Papeis,P09_Equidade,P10_Satisfacao,P11_Cultura_Organizacional,P12_Seguranca_Emprego,P13_Relacionamento_Trabalho\nRH,001,3,2,4,3,1,2,3,2,4,3,2,1,3\n";
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="drps_template.csv"');
    res.send("\uFEFF" + csv);
  });

  app.get("/api/templates/aep.csv", (_req, res) => {
    const csv = "setor,ergonomia_geral,posto_trabalho,esforco_fisico,postura,iluminacao,ruido,temperatura,vibracoes,observacoes\nProducao,3,2,4,3,2,1,2,1,Ajuste necessario na cadeira\n";
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="aep_template.csv"');
    res.send("\uFEFF" + csv);
  });

  app.get("/api/templates/roteiro-conversa", (_req, res) => {
    const html = `<!DOCTYPE html><html lang='pt-BR'><head><meta charset='UTF-8'><title>Roteiro de Conversa</title>
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6}
h1{color:#1e3a5f;border-bottom:2px solid #2d7a5f;padding-bottom:10px}
h2{color:#2d7a5f;margin-top:24px}.section{background:#f8f9fa;padding:16px;border-left:4px solid #2d7a5f;margin:16px 0;border-radius:4px}
p{margin:8px 0}</style></head><body>
<h1>Roteiro de Conversa — Acolhimento Psicossocial</h1>
<p><strong>Instrumento auxiliar para gestores e equipe de RH/Saúde</strong></p>
<h2>1. Abertura (5-10 min)</h2><div class='section'>
<p>• Agradeça a disponibilidade do colaborador</p>
<p>• Explique que a conversa é sigilosa e tem caráter de apoio</p>
<p>• Deixe claro que não há julgamentos — o objetivo é entender e ajudar</p>
</div>
<h2>2. Escuta Ativa (15-20 min)</h2><div class='section'>
<p>• "Como você está se sentindo em relação ao trabalho?"</p>
<p>• "Há algo que tem te preocupado ou dificultado seu dia a dia?"</p>
<p>• "Você tem conseguido descansar? Como está seu sono?"</p>
<p>• "Você se sente apoiado pela equipe e gestão?"</p>
</div>
<h2>3. Identificação de Necessidades (10 min)</h2><div class='section'>
<p>• Verifique se há sinais de sobrecarga, conflito, isolamento ou adoecimento</p>
<p>• Pergunte se o colaborador conhece os recursos de apoio disponíveis</p>
<p>• "O que poderia ajudar você a se sentir melhor no trabalho?"</p>
</div>
<h2>4. Encaminhamentos (5 min)</h2><div class='section'>
<p>• Indique os recursos: EAP, psicólogo, médico do trabalho</p>
<p>• Defina ações de acompanhamento, se necessário</p>
<p>• Registre na plataforma (Agendamento → Nova conversa)</p>
</div>
<h2>5. Encerramento</h2><div class='section'>
<p>• Agradeça a confiança</p>
<p>• Reforce o caráter confidencial da conversa</p>
<p>• Combine próximos passos, se houver</p>
</div>
<p style='margin-top:40px;font-size:12px;color:#666'>Documento gerado pela Plataforma Saúde do Trabalho — NR-01 / Avaliação de Riscos Psicossociais</p>
</body></html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="roteiro_conversa.html"');
    res.send(html);
  });

  app.get("/api/templates/protocolo-nr01", (_req, res) => {
    const html = `<!DOCTYPE html><html lang='pt-BR'><head><meta charset='UTF-8'><title>Protocolo NR-01</title>
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6}
h1{color:#1e3a5f;border-bottom:2px solid #2d7a5f;padding-bottom:10px}
h2{color:#2d7a5f;margin-top:24px}table{width:100%;border-collapse:collapse;margin:16px 0}
th,td{border:1px solid #ddd;padding:8px 12px;text-align:left}th{background:#1e3a5f;color:#fff}
tr:nth-child(even){background:#f8f9fa}.tag{display:inline-block;padding:2px 8px;border-radius:12px;font-size:12px}
.obrigatorio{background:#fee2e2;color:#991b1b}.recomendado{background:#dcfce7;color:#166534}
</style></head><body>
<h1>Protocolo de Conformidade NR-01</h1>
<p><strong>Requisitos de Gerenciamento de Riscos Psicossociais conforme NR-01 (Portaria MTE 1.419/2024)</strong></p>
<h2>Etapas Obrigatórias</h2>
<table><thead><tr><th>Etapa</th><th>Ação</th><th>Prazo</th><th>Status</th></tr></thead><tbody>
<tr><td>1. Identificação</td><td>Mapear fatores de risco psicossocial com instrumento validado (DRPS)</td><td>Até 26/05/2025</td><td><span class='tag obrigatorio'>Obrigatório</span></td></tr>
<tr><td>2. Avaliação</td><td>Calcular gravidade e probabilidade; gerar matriz de risco</td><td>Contínuo</td><td><span class='tag obrigatorio'>Obrigatório</span></td></tr>
<tr><td>3. Plano de Ação</td><td>Definir medidas preventivas e corretivas por fator de risco</td><td>30 dias após avaliação</td><td><span class='tag obrigatorio'>Obrigatório</span></td></tr>
<tr><td>4. Monitoramento</td><td>Revisar avaliação e plano anualmente ou após mudanças significativas</td><td>Anual</td><td><span class='tag obrigatorio'>Obrigatório</span></td></tr>
<tr><td>5. Participação</td><td>Incluir trabalhadores e CIPA/CIPD no processo de avaliação</td><td>Contínuo</td><td><span class='tag recomendado'>Recomendado</span></td></tr>
<tr><td>6. PGR</td><td>Integrar resultados ao Programa de Gerenciamento de Riscos</td><td>Com o PGR</td><td><span class='tag obrigatorio'>Obrigatório</span></td></tr>
</tbody></table>
<h2>Documentos Obrigatórios</h2>
<table><thead><tr><th>Documento</th><th>Descrição</th></tr></thead><tbody>
<tr><td>Laudo Técnico NR-01</td><td>Laudo com metodologia, matriz, plano e assinatura do responsável técnico</td></tr>
<tr><td>PGR — Programa de Gerenciamento de Riscos</td><td>Documento integrado com inventário de riscos físicos e psicossociais</td></tr>
<tr><td>Registros de treinamentos</td><td>Comprovação de capacitação de gestores e equipes</td></tr>
<tr><td>Atas de reuniões da CIPA/CIPD</td><td>Participação dos trabalhadores nas avaliações</td></tr>
</tbody></table>
<p style='margin-top:40px;font-size:12px;color:#666'>Plataforma Saúde do Trabalho — Referência: NR-01, Portaria MTE 1.419/2024 e Norma ISO 45003</p>
</body></html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="protocolo_nr01.html"');
    res.send(html);
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Landing page
  app.get("/", (_req, res) => {
    res.sendFile("/var/www/saudedotrabalho/site_index.html");
  });

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);

