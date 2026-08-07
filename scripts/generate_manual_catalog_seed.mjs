import fs from "node:fs";
import path from "node:path";

const [sourcePath, targetPath] = process.argv.slice(2);
if (!sourcePath || !targetPath) {
  throw new Error("Use: node generate_manual_catalog_seed.mjs catalog.json target.ts");
}

const workbook = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const sheet = workbook.find(item => item.name === "Artigos");
if (!sheet) throw new Error("A aba Artigos não foi encontrada.");
const [headers, ...rows] = sheet.values;
const index = Object.fromEntries(headers.map((header, i) => [header, i]));

const roleMap = new Map([
  ["Colaborador", "user"],
  ["Chefia", "chefia"],
  ["CIPA", "cipa"],
  ["SESMT", "sesmt"],
  ["RH", "rh"],
  ["Administrador", "admin"],
  ["SuperAdmin da rede", "company_admin"],
  ["Psicólogo", "psicologo"],
  ["Médico", "medico"],
]);

const routeMap = {
  "/13-fatores-nr01": "/admin/fatores",
  "/acoes-vinculadas": "/admin/acoes-vinculadas",
  "/agendamentos": "/admin/agenda",
  "/analise-risco": "/admin/analise-risco",
  "/analises": "/admin/analises",
  "/arquivos-sst": "/admin/arquivos",
  "/atas-corporativas": "/admin/atas-corporativas",
  "/atestados-afastamentos": "/admin/atestados-afastamentos",
  "/biblioteca": "/admin/biblioteca",
  "/biblioteca-preventiva": "/admin/biblioteca-preventiva",
  "/campanhas": "/campanhas",
  "/cipa": "/cipa",
  "/colaborador": "/inicio",
  "/colaboradores": "/admin/usuarios",
  "/cursos": "/cursos",
  "/dashboard": "/dashboard",
  "/dashboard-ciclos": "/admin/ciclos-dashboard",
  "/descompressao": "/area-de-descompressao",
  "/empresas": "/admin/empresas",
  "/epi-epc": "/admin/gestao-epi-epc",
  "/filiais": "/admin/filiais",
  "/kit-primeiros-socorros": "/admin/primeiros-socorros",
  "/lembretes": "/admin/lembretes",
  "/pcmso": "/medico",
  "/pesquisas": "/pesquisas",
  "/plano-acao": "/admin/plano-acao-prazos",
  "/riscos-psicossociais": "/admin/riscos-psicossociais",
  "/saude-ocupacional": "/medico",
  "/setores": "/admin/setores",
  "/sipat": "/sipat",
  "/super-admin": "/super-admin",
  "/super-admin/catalogo-master": "/super-admin/catalogo",
  "/super-admin/clientes": "/super-admin/clientes",
  "/super-admin/crm-financeiro": "/super-admin/crm",
  "/super-admin/horarios": "/super-admin/horarios",
  "/super-admin/integracoes": "/super-admin/integracoes",
  "/super-admin/manuais": "/super-admin/manuais",
  "/super-admin/white-label": "/super-admin/white-label",
  "/upload-questionarios": "/admin/pesquisas/upload-impresso",
  "/vencimentos": "/admin/vencimentos",
  "/visao-360": "/admin/visao-360",
};

function split(value, separator = /[;\n]/) {
  return String(value || "")
    .split(separator)
    .map(item => item.trim())
    .filter(Boolean);
}

function value(row, name) {
  return row[index[name]] ?? "";
}

const articles = rows.map((row, rowIndex) => {
  const sourceRoute = String(value(row, "Rota da funcionalidade") || "/manual");
  const roles = split(value(row, "Perfis autorizados"))
    .map(role => roleMap.get(role))
    .filter(Boolean);
  let route = routeMap[sourceRoute] || sourceRoute;
  if (sourceRoute === "/epi-epc" && roles.includes("user")) route = "/meu-epi-epc";
  if (sourceRoute === "/kit-primeiros-socorros" && roles.includes("user"))
    route = "/primeiros-socorros";
  if (sourceRoute === "/atestados-afastamentos" && roles.includes("user"))
    route = "/meus-atestados";
  const summary = String(value(row, "Resumo") || "").trim();
  const whatIs = String(value(row, "O que é?") || "").trim();
  const purpose = String(value(row, "Para que serve?") || "").trim();
  const steps = split(value(row, "Passos"), /\n/);
  const cautions = split(value(row, "Cuidados"), /\n/);
  const warnings = [];
  if (!routeMap[sourceRoute] && sourceRoute !== "/manual")
    warnings.push(`Rota não mapeada: ${sourceRoute}`);
  if (!roles.length) warnings.push("Nenhum perfil interno reconhecido.");
  if (summary.startsWith("Guia prático: utilização"))
    warnings.push("Resumo genérico; revisar aderência à tela real.");
  if (whatIs.length < 40 || purpose.length < 40)
    warnings.push("Conteúdo conceitual curto; aprofundar antes de publicar.");
  if (steps.length < 3) warnings.push("Passo a passo insuficiente.");
  if (route.startsWith("/admin/") && roles.some(role => ["user", "cipa"].includes(role)))
    warnings.push("Perfis de colaborador/CIPA não acessam diretamente a rota administrativa.");
  if (route === "/medico" && roles.some(role => role !== "medico"))
    warnings.push("A rota médica possui perfis adicionais no catálogo; separar o artigo por perfil.");
  if (route.startsWith("/super-admin") && roles.some(role => role !== "super_admin"))
    warnings.push("Rota global exige SuperAdmin, mas o catálogo inclui outro perfil.");
  return {
    slug: String(value(row, "Slug")),
    title: String(value(row, "Título")),
    summary,
    module: String(value(row, "Módulo")),
    route,
    sourceRoute,
    roles,
    keywords: split(value(row, "Palavras-chave"), /\n/),
    whatIs,
    purpose,
    accessPath: String(value(row, "Como acessar?") || ""),
    steps,
    cautions,
    faq: [],
    problems: [],
    screenshots: [],
    videoUrl: null,
    sortOrder: Number(value(row, "Ordem") || rowIndex + 1),
    workflowStatus: "em_validacao",
    auditStatus: warnings.length ? "revisar" : "estrutura_ok",
    auditNotes: warnings.join("\n"),
    sourceName: "Catalogo_Completo_Manual_Saude_do_Trabalho_163_Artigos_Perfil.xlsx",
    sourceRow: rowIndex + 2,
    sourcePublishedFlag: String(value(row, "Artigo publicado") || ""),
  };
});

const duplicateSlugs = articles.filter(
  (article, index) => articles.findIndex(item => item.slug === article.slug) !== index
);
if (duplicateSlugs.length) throw new Error("Há slugs duplicados no catálogo.");
if (articles.length !== 163)
  throw new Error(`Esperados 163 artigos; encontrados ${articles.length}.`);

const output = `// Arquivo gerado mecanicamente a partir do catálogo Excel validado.\n// Não editar manualmente; ajuste o Excel ou o gerador e execute novamente.\n\nexport const manualCatalogSeed = ${JSON.stringify(articles, null, 2)} as const;\n`;
fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, output, "utf8");
console.log(`Gerados ${articles.length} artigos em ${targetPath}.`);
