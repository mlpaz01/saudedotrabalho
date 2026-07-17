import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

type LessonSeed = {
  title: string;
  minutes: number;
  focus: string;
  evidence: string[];
  activity: string;
};

type UnitSeed = {
  title: string;
  minutes: number;
  clause: string;
  icon: string;
  objective: string;
  imagePrompt: string;
  lessons: LessonSeed[];
};

const COURSE_TITLE = "Interpretação da ABNT NBR ISO 9001:2015 — incluindo a Emenda 1:2024";
const COURSE_DURATION = 960;
const COURSE_SLUG = "iso9001-2015-amd1-2024-interpretacao";
const COURSE_DESCRIPTION = [
  "Curso livre EAD de 16 horas para interpretação prática da ABNT NBR ISO 9001:2015, incluindo a Emenda 1:2024 sobre ação climática.",
  "A formação percorre fundamentos, estrutura harmonizada, cláusulas 4 a 10, evidências de conformidade, estudo de caso e avaliação final.",
  "O objetivo é capacitar participantes a compreender requisitos e aplicar raciocínio de qualidade, sem transformar o treinamento em curso de auditor líder.",
].join("\n\n");

const IMAGE_DIR = path.join(process.cwd(), "uploads", "images", COURSE_SLUG);
const IMAGE_URL_PREFIX = `/uploads/images/${COURSE_SLUG}`;
const OPENROUTER_IMAGE_MODEL = "google/gemini-2.5-flash-image";

const units: UnitSeed[] = [
  {
    title: "Módulo 1 — Fundamentos da gestão da qualidade",
    minutes: 90,
    clause: "Fundamentos",
    icon: "book-open",
    objective: "Construir a base conceitual para interpretar a ISO 9001 como sistema de gestão, não como lista de documentos.",
    imagePrompt: "professional Brazilian quality management training room, process map on wall, diverse employees, clean corporate style, no logos, 16:9",
    lessons: [
      lesson("O que são ISO, ABNT e normas de sistemas de gestão", 18, "papel da ISO, adoção pela ABNT e uso de normas como referência de gestão", ["escopo normativo entendido", "política de uso de normas", "responsáveis definidos"], "Liste quais normas ou requisitos externos influenciam a qualidade na sua organização."),
      lesson("Família ISO 9000 e vocabulário essencial", 18, "relação entre ISO 9000, ISO 9001, ISO 9004 e termos usados em qualidade", ["glossário interno", "treinamento de conceitos", "padronização de linguagem"], "Separe três termos usados pela empresa e descreva como eles aparecem nos processos."),
      lesson("Implantação, treinamento, auditoria e certificação", 18, "diferença entre aprender a norma, implementar requisitos, auditar evidências e obter certificação", ["plano de implantação", "programa de auditoria", "certificado válido"], "Classifique uma ação recente como treinamento, implantação, auditoria ou certificação."),
      lesson("Sete princípios da gestão da qualidade", 18, "foco no cliente, liderança, engajamento, processo, melhoria, evidência e relacionamento", ["indicadores por princípio", "práticas de liderança", "gestão de fornecedores"], "Escolha um princípio e indique uma evidência que prove sua aplicação."),
      lesson("PDCA, abordagem de processos e pensamento baseado em riscos", 18, "integração entre ciclo PDCA, processos e riscos para interpretar requisitos", ["mapa de processos", "riscos por processo", "ações monitoradas"], "Desenhe mentalmente um processo e identifique entrada, saída, risco e indicador."),
    ],
  },
  {
    title: "Módulo 2 — Estrutura da norma",
    minutes: 30,
    clause: "Estrutura",
    icon: "layers",
    objective: "Entender como a norma está organizada e como as cláusulas 4 a 10 se conectam.",
    imagePrompt: "modern document architecture diagram for ISO management system, clauses 4 to 10 as abstract blocks, corporate classroom, no readable standard text, 16:9",
    lessons: [
      lesson("Estrutura harmonizada e lógica das cláusulas", 15, "organização comum das normas de sistemas de gestão e fluxo das cláusulas 4 a 10", ["matriz de requisitos", "responsabilidades por cláusula", "mapa PDCA"], "Relacione cláusulas 4 a 10 ao ciclo PDCA."),
      lesson("Objetivo, referências, termos e campo de aplicação", 15, "como interpretar cláusulas iniciais sem confundi-las com requisitos operacionais", ["escopo formal", "lista de referências", "controle de termos"], "Explique por que o escopo precisa ser coerente com processos reais."),
    ],
  },
  {
    title: "Módulo 3 — Cláusula 4: contexto da organização",
    minutes: 120,
    clause: "Cláusula 4",
    icon: "building-2",
    objective: "Interpretar contexto, partes interessadas, escopo e processos do sistema de gestão da qualidade.",
    imagePrompt: "business team reviewing organizational context, stakeholder map, climate risk note, process interaction board, realistic corporate photo, 16:9",
    lessons: [
      lesson("Questões internas e externas", 20, "identificação de fatores que afetam a capacidade de entregar qualidade", ["análise de contexto", "SWOT ou PESTEL", "registro de revisão periódica"], "Liste duas questões internas e duas externas que afetam a qualidade."),
      lesson("Partes interessadas e suas necessidades", 20, "clientes, órgãos reguladores, fornecedores, colaboradores e outras partes relevantes", ["matriz de partes interessadas", "requisitos monitorados", "critérios de atualização"], "Indique uma parte interessada e um requisito que ela impõe."),
      lesson("Escopo do sistema de gestão da qualidade", 20, "definição de limites, aplicabilidade e justificativas coerentes", ["declaração de escopo", "processos cobertos", "justificativas de não aplicabilidade"], "Revise se o escopo da empresa cobre o que é vendido ao cliente."),
      lesson("Processos do SGQ e suas interações", 20, "entradas, saídas, sequência, interação e responsáveis por processo", ["mapa de processos", "SIPOC", "matriz de interação"], "Escolha um processo e descreva entrada, atividade, saída e cliente interno."),
      lesson("Indicadores, responsáveis e critérios dos processos", 20, "monitoramento mínimo para saber se os processos alcançam resultados planejados", ["indicadores definidos", "metas", "rotina de análise"], "Transforme uma reclamação recorrente em indicador de processo."),
      lesson("Mudanças climáticas no contexto da organização", 20, "Emenda 1:2024 e análise de relevância da mudança climática no contexto e nas partes interessadas", ["registro de análise climática", "partes interessadas revisadas", "decisão documentada"], "Defina se clima é relevante para um processo e justifique tecnicamente."),
    ],
  },
  {
    title: "Módulo 4 — Cláusula 5: liderança",
    minutes: 90,
    clause: "Cláusula 5",
    icon: "users",
    objective: "Interpretar liderança como responsabilidade ativa da alta direção sobre o SGQ.",
    imagePrompt: "executive leadership team discussing quality policy and customer focus, professional meeting, balanced diverse people, no logos, 16:9",
    lessons: [
      lesson("Liderança e comprometimento", 18, "papel da direção em integrar qualidade à estratégia e apoiar processos", ["atas de reunião", "metas de qualidade", "recursos aprovados"], "Identifique uma evidência real de envolvimento da direção."),
      lesson("Foco no cliente", 18, "entendimento de requisitos, satisfação e capacidade de entregar valor", ["pesquisas de satisfação", "análise de reclamações", "indicadores de entrega"], "Escolha um requisito do cliente e indique como ele é monitorado."),
      lesson("Política da qualidade", 18, "política como direcionamento compatível com contexto, objetivos e melhoria", ["política aprovada", "comunicação interna", "revisão documentada"], "Reescreva em linguagem simples o compromisso central da política."),
      lesson("Papéis, responsabilidades e autoridades", 18, "clareza sobre quem decide, executa, verifica e responde pelo SGQ", ["organograma", "matriz RACI", "descrições de função"], "Indique um ponto em que falta clareza de autoridade."),
      lesson("Participação da alta direção na prática", 18, "como evitar SGQ isolado em uma área e sustentar rotina de gestão", ["reuniões críticas", "decisões registradas", "cobrança de resultados"], "Planeje uma pauta de 15 minutos para a direção acompanhar qualidade."),
    ],
  },
  {
    title: "Módulo 5 — Cláusula 6: planejamento",
    minutes: 90,
    clause: "Cláusula 6",
    icon: "target",
    objective: "Planejar riscos, oportunidades, objetivos, metas e mudanças de forma rastreável.",
    imagePrompt: "quality planning workshop with risk matrix, objectives dashboard, action plan board, corporate realistic style, 16:9",
    lessons: [
      lesson("Riscos e oportunidades", 18, "identificação e tratamento do que pode afetar resultados do SGQ", ["matriz de riscos", "planos de ação", "registro de oportunidades"], "Converta uma falha recorrente em risco e oportunidade."),
      lesson("Objetivos da qualidade", 18, "objetivos mensuráveis, coerentes com política e relevantes para processos", ["objetivos aprovados", "indicadores", "responsáveis"], "Escreva um objetivo com indicador, meta e prazo."),
      lesson("Indicadores, metas e acompanhamento", 18, "critérios para medir desempenho sem criar métricas decorativas", ["painel de indicadores", "análise crítica", "tratativas"], "Avalie se um indicador mede resultado ou apenas esforço."),
      lesson("Planos de ação e responsabilidades", 18, "planejamento com responsáveis, recursos, prazos e verificação de eficácia", ["5W2H", "status das ações", "evidência de conclusão"], "Transforme uma meta atrasada em plano 5W2H."),
      lesson("Planejamento de mudanças", 18, "controle de mudanças para evitar impacto negativo em processos e clientes", ["registro de mudança", "análise de impacto", "comunicação"], "Liste impactos de trocar um fornecedor crítico."),
    ],
  },
  {
    title: "Módulo 6 — Cláusula 7: apoio",
    minutes: 120,
    clause: "Cláusula 7",
    icon: "settings",
    objective: "Interpretar recursos, competência, comunicação e informação documentada como sustentação do SGQ.",
    imagePrompt: "quality support resources, calibrated measurement equipment, training records, controlled documents, professional workplace, 16:9",
    lessons: [
      lesson("Pessoas, infraestrutura e ambiente", 20, "recursos necessários para operação e conformidade", ["dimensionamento de equipe", "manutenção", "condições ambientais"], "Identifique um recurso que, se faltar, compromete a qualidade."),
      lesson("Monitoramento, medição e calibração", 20, "confiabilidade dos recursos usados para medir conformidade", ["certificados de calibração", "plano de verificação", "identificação de equipamentos"], "Escolha um instrumento e indique como provar sua confiabilidade."),
      lesson("Conhecimento organizacional", 20, "retenção e atualização do conhecimento crítico para operar processos", ["lições aprendidas", "procedimentos", "matriz de conhecimento"], "Indique um conhecimento que hoje depende de uma única pessoa."),
      lesson("Competência e conscientização", 20, "competência requerida, evidência de atendimento e consciência do impacto do trabalho", ["matriz de competência", "treinamentos", "avaliação de eficácia"], "Diferencie presença em treinamento de competência demonstrada."),
      lesson("Comunicação interna e externa", 20, "o que comunicar, quando, para quem, por qual meio e com qual responsável", ["plano de comunicação", "registros enviados", "canais definidos"], "Crie uma regra de comunicação para alteração de requisito do cliente."),
      lesson("Informação documentada", 20, "criação, atualização, controle, distribuição e retenção de documentos e registros", ["lista mestra", "controle de revisão", "registros protegidos"], "Explique por que documento controlado e registro têm funções diferentes."),
    ],
  },
  {
    title: "Módulo 7 — Cláusula 8: operação",
    minutes: 180,
    clause: "Cláusula 8",
    icon: "workflow",
    objective: "Interpretar requisitos operacionais desde o pedido do cliente até liberação e controle de não conformidades.",
    imagePrompt: "industrial and service operation quality control, customer requirements, supplier evaluation, traceability labels, modern workplace, 16:9",
    lessons: [
      lesson("Planejamento e controle operacional", 20, "como garantir que processos ocorram sob condições planejadas", ["procedimentos operacionais", "critérios de aceitação", "registros de produção"], "Defina uma condição controlada para um processo crítico."),
      lesson("Comunicação com clientes", 20, "informações, contratos, feedback, reclamações e contingências", ["canais de atendimento", "registros de reclamação", "comunicação contratual"], "Descreva como uma reclamação vira entrada de melhoria."),
      lesson("Requisitos para produtos e serviços", 20, "determinação, análise crítica e mudanças em requisitos", ["análise de contrato", "aprovação técnica", "registro de alteração"], "Identifique risco de aceitar pedido sem análise crítica."),
      lesson("Projeto e desenvolvimento", 20, "controle de etapas, entradas, saídas, análise crítica, verificação e validação", ["plano de projeto", "registros de validação", "controle de mudanças"], "Diferencie verificar se foi feito certo de validar se atende ao uso."),
      lesson("Fornecedores externos", 20, "seleção, avaliação, monitoramento e controle de provedores externos", ["critérios de homologação", "avaliação de desempenho", "planos de desenvolvimento"], "Defina um critério de avaliação para fornecedor crítico."),
      lesson("Produção e prestação de serviços", 20, "controle da execução, competências, instruções, equipamentos e monitoramento", ["instruções de trabalho", "checklists", "registros de execução"], "Indique uma evidência de que o serviço foi prestado como planejado."),
      lesson("Identificação, rastreabilidade e preservação", 20, "identificar status, histórico, materiais, produtos e preservar conformidade", ["etiquetas", "lotes", "controle de armazenamento"], "Defina como rastrear um problema até sua origem."),
      lesson("Liberação de produtos e serviços", 20, "critérios, aprovação e registros antes da entrega ao cliente", ["inspeção final", "assinatura de liberação", "registro de aceite"], "Liste o mínimo que precisa existir antes de liberar uma entrega."),
      lesson("Controle de saídas não conformes", 20, "identificar, segregar, corrigir, autorizar concessões e evitar uso indevido", ["registro de não conformidade", "disposição", "aprovação de concessão"], "Escolha a melhor disposição para uma saída não conforme."),
    ],
  },
  {
    title: "Módulo 8 — Cláusula 9: avaliação de desempenho",
    minutes: 90,
    clause: "Cláusula 9",
    icon: "bar-chart-3",
    objective: "Avaliar desempenho por dados, auditorias internas e análise crítica pela direção.",
    imagePrompt: "quality performance dashboard, internal audit checklist, management review meeting, data driven decisions, corporate realistic, 16:9",
    lessons: [
      lesson("Monitoramento e medição do SGQ", 18, "o que medir, quando medir, como analisar e como usar resultados", ["plano de medição", "indicadores", "registros de análise"], "Escolha um processo e defina frequência de monitoramento."),
      lesson("Satisfação do cliente", 18, "métodos diretos e indiretos para entender percepção do cliente", ["pesquisa", "NPS", "reclamações e elogios"], "Compare uma métrica direta e uma indireta de satisfação."),
      lesson("Análise e avaliação de dados", 18, "transformar dados em decisões e prioridades de gestão", ["relatórios gerenciais", "tendências", "ações derivadas"], "Explique quando uma variação vira problema de gestão."),
      lesson("Auditoria interna", 18, "planejamento, critérios, independência, evidências e relatório de auditoria", ["programa de auditoria", "checklist", "relatório e ações"], "Diferencie auditoria de inspeção operacional."),
      lesson("Análise crítica pela direção", 18, "entradas, decisões e saídas da revisão do SGQ pela alta direção", ["ata de análise crítica", "decisões", "recursos definidos"], "Monte três entradas indispensáveis para uma análise crítica."),
    ],
  },
  {
    title: "Módulo 9 — Cláusula 10: melhoria",
    minutes: 60,
    clause: "Cláusula 10",
    icon: "trending-up",
    objective: "Aplicar melhoria, ação corretiva e verificação de eficácia com rastreabilidade.",
    imagePrompt: "continuous improvement board, root cause analysis, corrective action workflow, professional quality team, 16:9",
    lessons: [
      lesson("Não conformidade, correção e ação corretiva", 20, "diferença entre corrigir efeito imediato e eliminar causa", ["registro de NC", "correção", "ação corretiva"], "Classifique uma ação como correção ou ação corretiva."),
      lesson("Análise de causa e eficácia", 20, "métodos de causa raiz e verificação se o problema deixou de ocorrer", ["5 porquês", "Ishikawa", "evidência de eficácia"], "Aplique os 5 porquês a uma falha simples."),
      lesson("Melhoria contínua", 20, "uso de dados, aprendizado e oportunidades para melhorar o SGQ", ["lições aprendidas", "projetos de melhoria", "indicadores evolutivos"], "Proponha uma melhoria pequena e mensurável para um processo."),
    ],
  },
  {
    title: "Módulo 10 — Aplicação prática e avaliação",
    minutes: 90,
    clause: "Prática",
    icon: "clipboard-check",
    objective: "Consolidar interpretação por estudo de caso, evidências e avaliação final.",
    imagePrompt: "quality management case study workshop, evidence checklist, final assessment, professional e-learning style, 16:9",
    lessons: [
      lesson("Estudo de caso: empresa em crescimento", 20, "interpretação integrada de contexto, liderança, planejamento e operação", ["diagnóstico inicial", "matriz de lacunas", "plano priorizado"], "Identifique três lacunas do estudo de caso."),
      lesson("Identificação de requisitos aplicáveis", 20, "como localizar quais requisitos impactam cada processo sem decorar a norma", ["matriz processo x requisito", "responsáveis", "evidências"], "Associe um processo a três cláusulas aplicáveis."),
      lesson("Exemplos de evidências de conformidade", 20, "evidência suficiente, pertinente, atualizada e rastreável", ["registros", "indicadores", "atas, planos e relatórios"], "Diga por que uma evidência pode ser real, mas insuficiente."),
      lesson("Exercício de interpretação e preparação para avaliação", 30, "síntese das cláusulas 4 a 10 e preparação para prova final", ["resumo por cláusula", "checklist final", "plano de estudo"], "Escreva uma frase explicando a lógica da ISO 9001 de ponta a ponta."),
    ],
  },
];

const finalExam = [
  q("Qual interpretação melhor representa a ISO 9001:2015?", ["Um manual fixo de procedimentos obrigatórios", "Um sistema de gestão voltado a processos, clientes, riscos, desempenho e melhoria", "Uma norma exclusiva para auditorias externas", "Um conjunto de formulários padronizados"], 1, "A norma deve ser interpretada como sistema de gestão integrado aos processos e resultados."),
  q("Na cláusula 4, o contexto da organização serve principalmente para:", ["Definir uniformes e crachás", "Entender fatores internos e externos que afetam o SGQ", "Substituir auditorias internas", "Eliminar a necessidade de indicadores"], 1, "O contexto direciona escopo, riscos, partes interessadas e processos."),
  q("A Emenda 1:2024 exige que a organização:", ["Implante inventário de carbono em todos os casos", "Determine se mudança climática é questão relevante para seu SGQ", "Obtenha certificação ambiental obrigatória", "Substitua a ISO 9001 pela ISO 14001"], 1, "A análise de relevância deve ser feita no contexto e nas partes interessadas."),
  q("Uma boa definição de escopo deve ser:", ["Genérica para cobrir qualquer atividade futura", "Coerente com produtos, serviços, processos e limites reais do SGQ", "Restrita apenas ao setor da qualidade", "Copiada de outra empresa certificada"], 1, "O escopo precisa refletir a realidade operacional e as aplicabilidades."),
  q("Na abordagem de processos, uma evidência forte é:", ["Lista isolada de cargos", "Mapa com entradas, saídas, responsáveis, indicadores e interações", "Somente a política da qualidade", "Certificado de fornecedor sem avaliação"], 1, "Processos precisam ser definidos, monitorados e integrados."),
  q("Liderança na ISO 9001 significa que a alta direção deve:", ["Delegar todo o SGQ ao consultor", "Demonstrar comprometimento, foco no cliente e integração do SGQ à estratégia", "Assinar documentos sem participar", "Acompanhar apenas auditoria externa"], 1, "A liderança é ativa e estratégica."),
  q("Objetivos da qualidade devem ser:", ["Mensuráveis, coerentes com a política e acompanhados", "Secretos para evitar cobrança", "Criados apenas no dia da auditoria", "Iguais em todas as empresas"], 0, "Objetivos precisam permitir análise de desempenho e ação."),
  q("Planejamento de mudanças é necessário para:", ["Impedir qualquer mudança", "Avaliar impactos antes de alterar processos, recursos ou requisitos", "Trocar documentos sem registro", "Evitar comunicação com clientes"], 1, "Mudanças mal controladas podem afetar conformidade e satisfação."),
  q("Competência deve ser evidenciada por:", ["Apenas presença em treinamento", "Requisitos definidos, atendimento demonstrado e eficácia quando aplicável", "Tempo de empresa como único critério", "Declaração verbal informal"], 1, "Treinamento não é sinônimo automático de competência."),
  q("Informação documentada inclui:", ["Apenas procedimentos", "Documentos e registros necessários para operação e evidência do SGQ", "Somente certificados externos", "Qualquer arquivo sem controle"], 1, "Documentos orientam; registros evidenciam o que ocorreu."),
  q("Na cláusula 8, análise crítica de requisitos ajuda a:", ["Aceitar pedidos sem avaliar capacidade", "Confirmar se requisitos do cliente e da organização podem ser atendidos", "Eliminar comunicação com fornecedores", "Substituir inspeção final"], 1, "Ela evita compromissos incompatíveis com a capacidade ou requisitos."),
  q("Controle de fornecedores externos deve considerar:", ["Preço apenas", "Critérios de seleção, avaliação, monitoramento e impacto no produto ou serviço", "Somente amizade comercial", "Apenas cadastro fiscal"], 1, "Fornecedores críticos afetam conformidade e devem ser controlados proporcionalmente."),
  q("Rastreabilidade é necessária quando:", ["Nunca, pois gera burocracia", "For requisito, controle interno ou necessário para investigar origem e destino", "Apenas em empresas industriais", "Somente em auditoria externa"], 1, "A rastreabilidade deve atender necessidade do processo e requisitos aplicáveis."),
  q("Saída não conforme deve ser:", ["Ignorada se o cliente não percebeu", "Identificada, controlada e tratada para impedir uso ou entrega indevida", "Sempre descartada sem análise", "Registrada somente se houver multa"], 1, "O tratamento deve ser adequado ao impacto e registrado."),
  q("Avaliação de desempenho depende de:", ["Dados analisados, indicadores, satisfação do cliente, auditorias e análise crítica", "Opiniões sem registro", "Auditoria externa anual apenas", "Número de documentos criados"], 0, "A cláusula 9 busca evidência objetiva para decisão."),
  q("Auditoria interna deve:", ["Procurar culpados", "Avaliar conformidade e eficácia com critérios definidos e imparcialidade", "Ser sempre feita pelo dono do processo", "Substituir ações corretivas"], 1, "Auditoria interna é ferramenta de avaliação, não punição."),
  q("Análise crítica pela direção deve gerar:", ["Apenas assinatura de presença", "Decisões, ações, necessidades de recursos e oportunidades de melhoria", "Um certificado automático", "Exclusão dos indicadores ruins"], 1, "A reunião deve produzir saídas úteis para o SGQ."),
  q("Correção e ação corretiva diferem porque:", ["São a mesma coisa", "Correção trata o efeito; ação corretiva trata causa para evitar recorrência", "Correção é sempre documental", "Ação corretiva dispensa verificação"], 1, "Essa diferença é essencial para melhoria real."),
  q("Verificação de eficácia significa:", ["Confirmar que a ação foi preenchida no sistema", "Avaliar se a ação resolveu a causa e reduziu ou eliminou recorrência", "Encerrar automaticamente após prazo", "Aguardar auditor externo"], 1, "Eficácia olha resultado, não apenas execução."),
  q("A melhor postura para interpretar a ISO 9001 é:", ["Decorar frases da norma", "Relacionar requisito, processo, risco, evidência e resultado pretendido", "Criar documentos para cada palavra", "Focar apenas no certificado"], 1, "Interpretação madura conecta requisito à gestão real."),
];

function lesson(title: string, minutes: number, focus: string, evidence: string[], activity: string): LessonSeed {
  return { title, minutes, focus, evidence, activity };
}

function q(question: string, options: string[], correctIndex: number, explanation: string) {
  return { question, options, correctIndex, explanation };
}

function escLike(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function connectionConfig() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const host = process.env.DB_HOST || "localhost";
  const user = process.env.DB_USER;
  const password = process.env.DB_PASS || process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;
  if (!user || !database) throw new Error("Configure DATABASE_URL ou DB_USER/DB_PASS/DB_NAME.");
  return { host, user, password, database, multipleStatements: false };
}

async function openrouterImage(prompt: string, filename: string): Promise<string | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.warn("[images] OPENROUTER_API_KEY ausente; imagem nao gerada:", filename);
    return null;
  }
  await fs.mkdir(IMAGE_DIR, { recursive: true });
  const outPath = path.join(IMAGE_DIR, filename);
  const outUrl = `${IMAGE_URL_PREFIX}/${filename}`;
  if (!process.env.FORCE_IMAGES) {
    try {
      await fs.access(outPath);
      return outUrl;
    } catch {
      // generate
    }
  }

  const res = await fetch("https://openrouter.ai/api/v1/images", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
      "HTTP-Referer": "https://saudedotrabalho.com",
      "X-Title": "Saude do Trabalho ISO 9001 Super Course",
    },
    body: JSON.stringify({
      model: OPENROUTER_IMAGE_MODEL,
      prompt,
      aspect_ratio: "16:9",
      resolution: "1K",
      output_format: "png",
      provider: { order: ["google-ai-studio"], allow_fallbacks: true },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.warn(`[images] OpenRouter falhou ${res.status}: ${detail.slice(0, 220)}`);
    return null;
  }
  const data: any = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) {
    console.warn("[images] OpenRouter nao retornou b64_json:", filename);
    return null;
  }
  await fs.writeFile(outPath, Buffer.from(b64, "base64"));
  console.log(`[images] ${filename} gerada via ${OPENROUTER_IMAGE_MODEL}`);
  return outUrl;
}

function fallbackImageUrl(prompt: string, seed: number) {
  const encoded = encodeURIComponent(`corporate quality management training, ${prompt}, professional, realistic, 16:9, no logos, no readable text`);
  return `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=576&seed=${seed}&nologo=true`;
}

async function buildImages() {
  const coverPrompt = [
    "hero image for an e-learning course about ISO 9001 quality management interpretation in Brazil",
    "professional corporate training, process maps, quality dashboard, climate action note, diverse adults",
    "premium realistic commercial style, no logos, no readable standard text, no certificate mockup, 16:9",
  ].join(", ");
  const cover = await openrouterImage(coverPrompt, "cover.png") || fallbackImageUrl(coverPrompt, 9001);
  const byUnit = new Map<string, string>();
  for (let i = 0; i < units.length; i++) {
    const filename = `unit-${String(i + 1).padStart(2, "0")}.png`;
    const prompt = `${units[i].imagePrompt}, premium e-learning illustration, no brand logo, no readable ISO text`;
    const url = await openrouterImage(prompt, filename) || fallbackImageUrl(prompt, 9100 + i);
    byUnit.set(units[i].title, url);
  }
  return { cover, byUnit };
}

function conceptBody(unit: UnitSeed, lesson: LessonSeed) {
  return [
    `Nesta aula, o foco é interpretar ${lesson.focus}. A leitura correta da ISO 9001 parte do resultado pretendido: entregar produtos e serviços conformes, aumentar a satisfação do cliente e melhorar continuamente o sistema de gestão.`,
    `A interpretação prática evita decorar texto normativo. O participante deve perguntar: qual processo é afetado, qual risco existe, quem é responsável, qual critério demonstra controle e qual evidência comprova que o requisito funciona na rotina.`,
    `No contexto de ${unit.clause}, a organização precisa conectar o requisito às decisões reais da empresa. Isso inclui responsabilidades, registros, indicadores e ações proporcionais ao impacto sobre cliente, conformidade e desempenho.`,
  ].join("\n\n");
}

function lessonBlocks(unit: UnitSeed, lesson: LessonSeed, imageUrl: string) {
  const evidenceList = lesson.evidence.join(", ");
  return [
    {
      type: "concept",
      data: {
        title: lesson.title,
        body: conceptBody(unit, lesson),
        imageUrl,
      },
      xp: 5,
    },
    {
      type: "example",
      data: {
        scenario: `Em uma empresa que está organizando o SGQ, a equipe percebe que ${lesson.focus}. Em vez de criar um documento genérico, ela relaciona o requisito ao processo, define responsável, estabelece critério de controle e guarda evidências como: ${evidenceList}.`,
        takeaway: "Uma evidência só é útil quando demonstra prática real, está atualizada e permite rastrear decisão, execução ou resultado.",
        imageUrl,
      },
      xp: 5,
    },
    {
      type: "quick_check",
      data: {
        question: `Qual é a melhor forma de interpretar esta aula sobre ${lesson.title.toLowerCase()}?`,
        options: [
          "Criar um documento para arquivar, mesmo sem relação com o processo.",
          "Relacionar requisito, processo, responsável, critério e evidência.",
          "Esperar a auditoria externa indicar o que fazer.",
          "Tratar o requisito como responsabilidade exclusiva do setor da qualidade.",
        ],
        correctIndex: 1,
        explanation: "A ISO 9001 deve ser interpretada por aplicação prática e evidência de funcionamento do sistema.",
      },
      xp: 10,
    },
    {
      type: "scenario_choice",
      data: {
        scenario: `Durante uma revisão interna, a equipe precisa demonstrar ${lesson.focus}. Há pouco tempo para preparar a reunião e existem registros espalhados em setores diferentes.`,
        question: "Qual decisão é tecnicamente mais adequada?",
        choices: [
          { text: "Montar uma apresentação bonita sem checar evidências.", outcome: "A aparência melhora, mas a rastreabilidade continua fraca.", isBest: false },
          { text: "Selecionar evidências reais, confirmar responsáveis e registrar lacunas para ação.", outcome: "A decisão preserva verdade técnica e gera melhoria rastreável.", isBest: true },
          { text: "Excluir indicadores ruins para evitar questionamentos.", outcome: "Isso compromete transparência e análise de desempenho.", isBest: false },
        ],
      },
      xp: 10,
    },
    {
      type: "reflection",
      data: {
        question: "Atividade prática",
        guidance: lesson.activity,
      },
      xp: 5,
    },
  ];
}

async function main() {
  const conn = await mysql.createConnection(connectionConfig() as any);
  const generateImages = process.argv.includes("--generate-images") || process.env.GENERATE_IMAGES === "1";
  const images = generateImages
    ? await buildImages()
    : { cover: fallbackImageUrl("ISO 9001 quality management e-learning cover", 9001), byUnit: new Map(units.map((u, i) => [u.title, fallbackImageUrl(u.imagePrompt, 9100 + i)])) };

  const [existingRows] = await conn.execute<any[]>(
    "SELECT id FROM modules WHERE title = ? OR title LIKE ? ORDER BY id DESC LIMIT 1",
    [COURSE_TITLE, `%${escLike("Interpretação da ABNT NBR ISO 9001:2015")}%`],
  );
  let moduleId = Number(existingRows?.[0]?.id || 0);

  if (moduleId) {
    const [[progress]] = await conn.execute<any[]>(
      `SELECT
        (SELECT COUNT(*) FROM user_progress WHERE moduleId=?) +
        (SELECT COUNT(*) FROM lesson_progress WHERE moduleId=?) +
        (SELECT COUNT(*) FROM certificates WHERE moduleId=?) AS cnt`,
      [moduleId, moduleId, moduleId],
    );
    const progressCount = Number(progress?.cnt || 0);
    if (progressCount > 0 && process.env.FORCE_REPLACE !== "1") {
      throw new Error(`Curso existente #${moduleId} ja possui ${progressCount} registro(s) de progresso/certificado. Rode com FORCE_REPLACE=1 para substituir conteudo.`);
    }
  }

  await conn.beginTransaction();
  try {
    if (!moduleId) {
      const [result] = await conn.execute<any>(
        `INSERT INTO modules
          (orderIndex, title, description, durationMinutes, isActive, publish_status, certTitle, certBody, certSignerName, certSignerRole, is_mandatory, profession, is_catalog_master, created_by_company_id, image_url, is_template, template_category)
         VALUES (?, ?, ?, ?, 1, 'published', ?, ?, ?, ?, 0, ?, 1, NULL, ?, 0, ?)`,
        [
          9001,
          COURSE_TITLE,
          COURSE_DESCRIPTION,
          COURSE_DURATION,
          "Interpretação da ABNT NBR ISO 9001:2015",
          "Concluiu o curso livre de 16 horas sobre Interpretação da ABNT NBR ISO 9001:2015, incluindo a Emenda 1:2024 — Mudanças relativas à ação climática.",
          "Heitor",
          "Responsável Técnico",
          "Qualidade / ISO",
          images.cover,
          "iso",
        ],
      );
      moduleId = Number(result.insertId);
    } else {
      await conn.execute(
        `UPDATE modules SET
          orderIndex=?, title=?, description=?, durationMinutes=?, isActive=1, publish_status='published',
          certTitle=?, certBody=?, certSignerName=?, certSignerRole=?, profession=?, is_catalog_master=1,
          created_by_company_id=NULL, image_url=?, template_category='iso', updatedAt=NOW()
         WHERE id=?`,
        [
          9001,
          COURSE_TITLE,
          COURSE_DESCRIPTION,
          COURSE_DURATION,
          "Interpretação da ABNT NBR ISO 9001:2015",
          "Concluiu o curso livre de 16 horas sobre Interpretação da ABNT NBR ISO 9001:2015, incluindo a Emenda 1:2024 — Mudanças relativas à ação climática.",
          "Heitor",
          "Responsável Técnico",
          "Qualidade / ISO",
          images.cover,
          moduleId,
        ],
      );
      const [lessonRows] = await conn.execute<any[]>("SELECT id FROM lessons WHERE moduleId=?", [moduleId]);
      const lessonIds = lessonRows.map((r) => Number(r.id)).filter(Boolean);
      if (lessonIds.length) {
        await conn.query(`DELETE FROM lesson_blocks WHERE lesson_id IN (${lessonIds.map(() => "?").join(",")})`, lessonIds);
      }
      await conn.execute("DELETE FROM ai_module_exams WHERE module_id=?", [moduleId]);
      await conn.execute("DELETE FROM lessons WHERE moduleId=?", [moduleId]);
      await conn.execute("DELETE FROM units WHERE module_id=?", [moduleId]);
    }

    let lessonOrder = 0;
    for (let unitIndex = 0; unitIndex < units.length; unitIndex++) {
      const unit = units[unitIndex];
      const [unitResult] = await conn.execute<any>(
        "INSERT INTO units (module_id, title, description, order_index, icon, is_active) VALUES (?, ?, ?, ?, ?, 1)",
        [moduleId, unit.title, `${unit.objective} Carga horária: ${unit.minutes} minutos.`, unitIndex + 1, unit.icon],
      );
      const unitId = Number(unitResult.insertId);
      const imageUrl = images.byUnit.get(unit.title) || images.cover;
      for (const item of unit.lessons) {
        lessonOrder++;
        const content = [
          `Objetivo: ${item.focus}.`,
          `Evidências esperadas: ${item.evidence.join("; ")}.`,
          `Atividade: ${item.activity}`,
        ].join("\n\n");
        const [lessonResult] = await conn.execute<any>(
          `INSERT INTO lessons
            (moduleId, unit_id, orderIndex, title, description, content, durationMinutes, estimated_minutes, isActive, image_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          [moduleId, unitId, lessonOrder, item.title, item.focus, content, item.minutes, item.minutes, imageUrl],
        );
        const lessonId = Number(lessonResult.insertId);
        const blocks = lessonBlocks(unit, item, imageUrl);
        for (let i = 0; i < blocks.length; i++) {
          await conn.execute(
            "INSERT INTO lesson_blocks (lesson_id, block_type, content, order_index, xp_reward) VALUES (?, ?, ?, ?, ?)",
            [lessonId, blocks[i].type, JSON.stringify(blocks[i].data), i + 1, blocks[i].xp],
          );
        }
      }
    }

    for (let i = 0; i < finalExam.length; i++) {
      const item = finalExam[i];
      await conn.execute(
        "INSERT INTO ai_module_exams (module_id, question_text, options, correct_index, explanation, order_index) VALUES (?, ?, ?, ?, ?, ?)",
        [moduleId, item.question, JSON.stringify(item.options), item.correctIndex, item.explanation, i + 1],
      );
    }

    await conn.commit();
    console.log(JSON.stringify({
      ok: true,
      moduleId,
      title: COURSE_TITLE,
      durationMinutes: COURSE_DURATION,
      units: units.length,
      lessons: units.reduce((sum, u) => sum + u.lessons.length, 0),
      finalExamQuestions: finalExam.length,
      images: generateImages ? "openrouter" : "fallback-url",
      url: `/missao/curso/${moduleId}`,
    }, null, 2));
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
