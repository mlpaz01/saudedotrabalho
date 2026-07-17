import "dotenv/config";
import * as mysql from "mysql2/promise";

const MODULE_ID = Number(process.env.ISO_MODULE_ID || 176);

type LessonRow = {
  id: number;
  title: string;
  description: string | null;
  content: string | null;
  durationMinutes: number | null;
  estimated_minutes: number | null;
  image_url: string | null;
  orderIndex: number;
  unitTitle: string | null;
};

type ExamRow = {
  question_text: string;
  options: string | string[];
  correct_index: number;
  explanation: string | null;
  order_index: number;
};

type BlockSeed = {
  type: string;
  data: Record<string, unknown>;
  xp: number;
};

type TopicProfile = {
  label: string;
  explanation: string;
  interpretation: string;
  evidence: string[];
  mistakes: string[];
  scenario: string;
  bestDecision: string;
  weakDecision: string;
  riskyDecision: string;
  quickQuestion: string;
  quickOptions: string[];
  quickCorrectIndex: number;
  quickExplanation: string;
  matchLeft: string[];
  matchRight: string[];
  matchPairs: number[][];
  activity: string;
};

function connectionConfig() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const host = process.env.DB_HOST || "localhost";
  const user = process.env.DB_USER;
  const password = process.env.DB_PASS || process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;
  if (!user || !database) throw new Error("Configure DATABASE_URL ou DB_USER/DB_PASS/DB_NAME.");
  return { host, user, password, database, multipleStatements: false };
}

function normalize(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseOptions(value: string | string[]) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function unitIntent(unitTitle: string) {
  const normalized = normalize(unitTitle);
  if (normalized.includes("clausula 4")) return "A aula deve conectar contexto, escopo, partes interessadas, processos e a Emenda 1:2024, sempre avaliando o impacto nos resultados pretendidos do SGQ.";
  if (normalized.includes("clausula 5")) return "A aula deve mostrar que liderança não é assinatura formal: é direção, recurso, cobrança de resultados, foco no cliente e integração do SGQ à estratégia.";
  if (normalized.includes("clausula 6")) return "A aula deve transformar planejamento em decisões rastreáveis: riscos, oportunidades, objetivos, metas, mudanças, responsáveis e verificação.";
  if (normalized.includes("clausula 7")) return "A aula deve tratar apoio como condição de operação: pessoas competentes, recursos confiáveis, comunicação e informação documentada sob controle.";
  if (normalized.includes("clausula 8")) return "A aula deve trazer a norma para a operação real: pedido, requisito, fornecedor, execução, rastreabilidade, liberação e controle de saídas não conformes.";
  if (normalized.includes("clausula 9")) return "A aula deve enfatizar análise por evidência: dados, satisfação do cliente, auditoria interna e análise crítica pela direção.";
  if (normalized.includes("clausula 10")) return "A aula deve diferenciar reação, correção, causa, ação corretiva, eficácia e melhoria contínua.";
  if (normalized.includes("aplicacao")) return "A aula deve consolidar a interpretação por estudo de caso, matriz requisito-processo-evidência e tomada de decisão.";
  if (normalized.includes("estrutura")) return "A aula deve explicar a arquitetura da norma e a relação lógica entre cláusulas, evitando leitura decorada.";
  return "A aula deve construir base conceitual sólida para interpretar a ISO 9001 como sistema de gestão orientado a processos, cliente, risco, evidência e melhoria.";
}

function fallbackProfile(title: string, unitTitle: string): TopicProfile {
  const topic = title.replace(/\s+/g, " ").trim();
  return {
    label: topic,
    explanation: [
      `${topic} deve ser entendido dentro do sistema de gestão da qualidade, e não como um requisito isolado ou uma tarefa documental. A interpretação madura começa perguntando qual resultado do SGQ pode ser afetado, qual processo executa a atividade, quem tem autoridade para decidir e qual evidência demonstra que a prática existe.`,
      unitIntent(unitTitle),
      "Em um curso de interpretação, o participante precisa aprender a raciocinar por encadeamento: requisito aplicável, processo afetado, risco ou oportunidade, controle adotado, evidência objetiva e análise de desempenho. Esse raciocínio é mais importante do que decorar frases da norma.",
    ].join("\n\n"),
    interpretation: [
      "Na prática, interprete o requisito perguntando: o que precisa ser determinado, implementado, mantido, controlado, medido ou melhorado? Depois verifique se a organização consegue demonstrar isso por registros, indicadores, decisões e resultados coerentes.",
      "Uma evidência isolada raramente é suficiente. O melhor julgamento técnico cruza documentos controlados, registros de execução, entrevistas, observação do processo e análise dos resultados obtidos.",
    ].join("\n\n"),
    evidence: [
      "procedimento, fluxo ou regra interna compatível com a prática real",
      "registro de execução com data, responsável e rastreabilidade",
      "indicador ou análise que mostre se o processo alcança o resultado esperado",
      "ação registrada quando houver desvio, mudança, risco ou oportunidade relevante",
    ],
    mistakes: [
      "tratar o requisito como checklist documental sem avaliar se o processo funciona",
      "aceitar evidência antiga, genérica ou sem relação com o processo analisado",
      "confundir existência de documento com conformidade operacional",
      "não conectar o tema com risco, cliente, desempenho e melhoria",
    ],
    scenario: `A empresa precisa demonstrar domínio sobre "${topic}" em uma análise interna. Existem documentos, mas parte da equipe executa o processo de forma diferente do que está descrito.`,
    bestDecision: "Comparar documento, prática real, registros e indicadores; registrar lacunas; definir ação com responsável e prazo.",
    weakDecision: "Atualizar apenas o documento para ficar mais bonito, sem verificar se a operação pratica aquilo.",
    riskyDecision: "Declarar conformidade porque existe um arquivo salvo, mesmo sem evidência de aplicação.",
    quickQuestion: `Qual é a melhor forma de interpretar "${topic}" em uma organização real?`,
    quickOptions: [
      "Relacionar requisito, processo, responsável, evidência, risco e resultado esperado.",
      "Procurar uma frase pronta e copiar para o procedimento.",
      "Criar um formulário novo mesmo que o processo não precise dele.",
      "Avaliar somente se existe certificado vigente.",
    ],
    quickCorrectIndex: 0,
    quickExplanation: "Interpretação de ISO 9001 exige conexão entre requisito e funcionamento real do SGQ, sustentada por evidência objetiva.",
    matchLeft: ["Requisito", "Processo", "Evidência", "Melhoria"],
    matchRight: ["O que precisa ser atendido", "Onde a prática acontece", "Como se demonstra a prática", "Como o sistema evolui"],
    matchPairs: [[0, 0], [1, 1], [2, 2], [3, 3]],
    activity: `Escolha um processo da empresa e descreva como "${topic}" aparece nele. Registre qual evidência provaria a prática e qual risco existe se ela não for controlada.`,
  };
}

const topicGuides: Array<[RegExp, Partial<TopicProfile>]> = [
  [/iso abnt normas sistemas gestao/, {
    label: "ISO, ABNT e normas de sistemas de gestão",
    explanation: "A ISO desenvolve normas internacionais; no Brasil, a ABNT publica a versão nacional quando aplicável. Para interpretação da ISO 9001, o ponto central é entender que a norma define requisitos para um sistema de gestão da qualidade, não uma lista universal de formulários. Cada organização precisa traduzir os requisitos para seus processos, porte, riscos, produtos, serviços e partes interessadas.\n\nA norma é aplicável a organizações de qualquer setor porque trabalha com princípios de gestão: foco no cliente, liderança, processos, evidências, melhoria e relacionamento com partes interessadas. Isso exige leitura contextualizada. Uma clínica, uma indústria e uma empresa de serviços podem atender ao mesmo requisito com controles diferentes, desde que consigam demonstrar resultado e conformidade.",
    evidence: ["escopo do SGQ coerente com produtos e serviços", "lista de requisitos normativos e legais aplicáveis", "responsáveis por manter normas atualizadas", "rotina de análise quando uma norma é revisada"],
    mistakes: ["achar que ISO cria um modelo único de documentação", "confundir norma de requisito com manual de consultoria", "copiar procedimento de outra empresa", "ignorar requisitos legais e de clientes no SGQ"],
  }],
  [/familia iso 9000 vocabulario/, {
    label: "Família ISO 9000 e vocabulário essencial",
    explanation: "A família ISO 9000 organiza conceitos, vocabulário, requisitos e diretrizes de gestão da qualidade. A ISO 9001 é a norma certificável de requisitos, enquanto a ISO 9000 apoia o entendimento dos termos e princípios. Em interpretação, vocabulário não é detalhe: palavras como requisito, processo, competência, eficácia, evidência, saída não conforme e informação documentada orientam decisões técnicas.\n\nQuando a equipe usa termos sem alinhamento, a análise perde precisão. Um exemplo comum é tratar treinamento como sinônimo de competência, ou correção como sinônimo de ação corretiva. O curso precisa formar o participante para reconhecer essas diferenças e aplicá-las em situações reais.",
    evidence: ["glossário interno ou material de nivelamento", "registros de treinamento conceitual", "procedimentos usando termos de forma consistente", "auditorias internas com critérios claros"],
    mistakes: ["usar termos populares em desacordo com a lógica da norma", "avaliar competência apenas por presença em treinamento", "chamar qualquer falha de não conformidade sem critério", "misturar documento controlado e registro"],
  }],
  [/implantacao treinamento auditoria certificacao/, {
    label: "Implantação, treinamento, auditoria e certificação",
    explanation: "Implantar é colocar o SGQ para funcionar; treinar é desenvolver entendimento e competência; auditar é avaliar conformidade e eficácia por evidência; certificar é obter avaliação independente por organismo competente. Esses quatro conceitos se relacionam, mas não são a mesma coisa. Uma empresa pode estar treinada e ainda não estar implantada; pode ter procedimentos e ainda falhar em auditoria; pode ser certificada e precisar melhorar continuamente.\n\nA interpretação correta evita promessas comerciais frágeis. Um curso de 16 horas pode formar base sólida de interpretação, mas não transforma automaticamente o participante em auditor líder nem garante certificação da empresa. Ele deve preparar a pessoa para entender requisitos, dialogar com processos, identificar evidências e apoiar implantação, auditorias internas e melhoria.",
    evidence: ["plano de implantação com responsáveis", "matriz de treinamento e competência", "programa de auditoria interna", "certificado emitido por organismo competente quando houver certificação"],
    mistakes: ["vender treinamento como certificação", "achar que certificado de aluno certifica a empresa", "auditar sem critério definido", "implantar documentos sem testar processos"],
  }],
  [/sete principios/, {
    label: "Sete princípios da gestão da qualidade",
    explanation: "Os sete princípios sustentam a leitura da ISO 9001: foco no cliente, liderança, engajamento das pessoas, abordagem de processos, melhoria, tomada de decisão baseada em evidências e gestão de relacionamento. Eles funcionam como lentes de interpretação. Quando houver dúvida sobre um requisito, pergunte qual princípio ele fortalece.\n\nPor exemplo, indicadores e análise crítica reforçam decisão baseada em evidências; controle de fornecedores reforça gestão de relacionamento; competências e conscientização reforçam engajamento das pessoas. A norma não deve ser ensinada como burocracia, mas como um modelo para tornar a organização mais previsível, confiável e capaz de aprender.",
    evidence: ["indicadores de satisfação e reclamações", "metas acompanhadas pela liderança", "ações de melhoria registradas", "avaliação de fornecedores e relacionamento crítico"],
    mistakes: ["decorar os princípios sem aplicá-los", "limitar qualidade ao setor da qualidade", "medir tudo sem usar dados para decidir", "ignorar fornecedores e clientes na análise do SGQ"],
  }],
  [/pdca abordagem processos pensamento baseado riscos/, {
    label: "PDCA, processos e pensamento baseado em riscos",
    explanation: "A ISO 9001 é estruturada para funcionar como ciclo de gestão: planejar, executar, verificar e agir. A abordagem de processos mostra onde o trabalho acontece; o pensamento baseado em riscos mostra o que pode impedir ou favorecer os resultados. Juntos, eles impedem que o SGQ vire um conjunto de documentos desconectados.\n\nInterpretar por processos significa enxergar entradas, atividades, saídas, clientes internos ou externos, responsáveis, recursos, critérios, indicadores e riscos. Interpretar por riscos significa tratar incertezas antes que virem reclamações, perdas, retrabalho ou descumprimento de requisitos.",
    evidence: ["mapa de processos com interações", "matriz de riscos e oportunidades por processo", "indicadores com análise crítica", "ações planejadas e verificadas"],
    mistakes: ["mapear processos apenas para auditoria", "tratar risco como tabela isolada", "criar indicadores sem meta ou decisão", "executar ações sem verificar eficácia"],
  }],
  [/estrutura harmonizada logica clausulas/, {
    label: "Estrutura harmonizada e lógica das cláusulas",
    explanation: "A estrutura das normas de sistemas de gestão facilita integração entre qualidade, meio ambiente, saúde e segurança e outros sistemas. Na ISO 9001, as cláusulas iniciais apresentam escopo, referências e termos; as cláusulas 4 a 10 concentram a lógica operacional do SGQ: contexto, liderança, planejamento, apoio, operação, avaliação e melhoria.\n\nEssa arquitetura segue uma sequência gerencial: compreender o ambiente, assumir liderança, planejar, prover suporte, operar, medir e melhorar. O aluno deve aprender a navegar por essa lógica, porque muitos requisitos dependem uns dos outros. Objetivos sem contexto são frágeis; operação sem recursos falha; melhoria sem avaliação vira opinião.",
    evidence: ["matriz que relacione cláusulas a processos", "responsáveis por requisitos", "calendário de avaliação do SGQ", "integração com outros sistemas de gestão quando houver"],
    mistakes: ["estudar cláusulas como capítulos isolados", "pular contexto e ir direto para formulário", "confundir estrutura com checklist de auditoria", "não relacionar planejamento, operação e desempenho"],
  }],
  [/objetivo referencias termos campo aplicacao/, {
    label: "Objetivo, referências, termos e campo de aplicação",
    explanation: "As cláusulas iniciais orientam a leitura: explicam a finalidade da norma, referências e vocabulário. Embora não sejam o miolo operacional, elas impedem interpretações erradas. O campo de aplicação reforça que a norma busca capacidade de fornecer produtos e serviços conformes e aumentar a satisfação do cliente por meio de um SGQ eficaz.\n\nA interpretação profissional conecta o objetivo da norma ao escopo real da organização. Não basta afirmar que a empresa tem qualidade; ela precisa demonstrar como seus processos atendem requisitos aplicáveis, controlam variações e melhoram resultados.",
    evidence: ["declaração de escopo", "relação entre produtos, serviços e processos", "critérios de aplicabilidade", "vocabulário usado nos documentos do SGQ"],
    mistakes: ["usar escopo genérico demais", "declarar exclusões sem justificativa", "ignorar termos técnicos", "confundir objetivo da norma com objetivo comercial da empresa"],
  }],
  [/questoes internas externas/, {
    label: "Questões internas e externas",
    explanation: "A organização precisa entender fatores que podem afetar sua capacidade de entregar produtos e serviços conformes e alcançar os resultados pretendidos do SGQ. Questões internas podem envolver cultura, competência, tecnologia, estrutura, capacidade produtiva e desempenho. Questões externas podem envolver mercado, legislação, fornecedores, concorrência, clima, economia e requisitos de clientes.\n\nA boa interpretação não exige uma ferramenta única. SWOT, PESTEL, matriz de contexto ou reunião estruturada podem funcionar, desde que a análise seja real, revisada e conectada a riscos, objetivos, processos e decisões.",
    evidence: ["análise de contexto atualizada", "registro de revisão pela direção", "riscos e oportunidades derivados do contexto", "ações quando uma questão afeta o SGQ"],
    mistakes: ["fazer SWOT decorativa", "não atualizar contexto quando muda mercado ou operação", "não converter contexto em decisão", "copiar lista de fatores sem relação com processos"],
  }],
  [/partes interessadas/, {
    label: "Partes interessadas e suas necessidades",
    explanation: "Partes interessadas relevantes são aquelas cujas necessidades ou expectativas podem afetar o SGQ. Clientes, órgãos reguladores, fornecedores, colaboradores, acionistas, comunidade e matriz corporativa podem ser relevantes, dependendo do contexto. O importante é distinguir interesse genérico de requisito relevante para a qualidade.\n\nA interpretação correta pede atualização e priorização. Nem toda expectativa vira requisito do SGQ, mas requisitos aplicáveis precisam ser conhecidos, monitorados e, quando necessário, tratados em processos, contratos, indicadores ou controles.",
    evidence: ["matriz de partes interessadas", "requisitos legais e contratuais monitorados", "responsável por atualização", "tratamento de mudanças em requisitos"],
    mistakes: ["listar todos os públicos sem avaliar relevância", "não definir quais requisitos serão tratados", "esquecer requisitos de cliente no planejamento", "ignorar exigências climáticas quando relevantes para partes interessadas"],
  }],
  [/escopo sistema gestao qualidade/, {
    label: "Escopo do sistema de gestão da qualidade",
    explanation: "O escopo define limites e aplicabilidade do SGQ. Deve refletir produtos e serviços oferecidos, unidades, processos, requisitos aplicáveis e justificativas para requisitos não aplicáveis. Um escopo bem definido protege a organização de ambiguidades e evita certificação ou auditoria sobre uma realidade que não corresponde ao negócio.\n\nA interpretação exige coerência: se uma atividade afeta a conformidade do produto ou serviço, provavelmente precisa estar considerada. Se um requisito não se aplica, a justificativa deve ser técnica, não apenas conveniente.",
    evidence: ["declaração formal de escopo", "processos incluídos e limites geográficos", "justificativas de não aplicabilidade", "coerência entre escopo, contratos e comunicação ao cliente"],
    mistakes: ["escopo amplo demais para parecer melhor", "excluir processo crítico sem justificativa", "não revisar escopo após mudança", "descrever atividade comercial diferente da prática real"],
  }],
  [/processos sgq interacoes/, {
    label: "Processos do SGQ e suas interações",
    explanation: "Processos são a espinha dorsal do SGQ. A organização precisa determinar processos necessários, suas entradas e saídas, sequência, interação, critérios, métodos, recursos, responsabilidades, riscos, oportunidades e formas de avaliação. Não é suficiente desenhar caixas; é preciso mostrar como o trabalho flui e como os resultados são controlados.\n\nUma boa interpretação avalia se o processo tem dono, critério de aceitação, indicador útil e conexão com outros processos. Quando uma saída vira entrada de outro processo, a interface precisa ser clara para evitar falhas.",
    evidence: ["mapa de processos ou SIPOC", "matriz de interação entre processos", "responsáveis e critérios por processo", "indicadores e riscos vinculados"],
    mistakes: ["criar mapa sem usar na gestão", "não definir dono do processo", "não controlar interface entre áreas", "medir processo com indicador irrelevante"],
  }],
  [/indicadores responsaveis criterios processos|indicadores metas acompanhamento/, {
    label: "Indicadores, responsáveis, critérios e metas",
    explanation: "Indicadores devem mostrar se processos e objetivos estão alcançando resultados. Um indicador bom tem finalidade, fórmula, fonte, frequência, responsável, meta e regra de análise. O valor está na decisão que ele permite, não no gráfico em si.\n\nPara interpretação da ISO 9001, o aluno precisa diferenciar indicador de esforço, indicador de resultado e indicador de tendência. Horas de treinamento, por exemplo, podem indicar esforço; redução de retrabalho ou melhoria na satisfação do cliente indicam resultado.",
    evidence: ["painel de indicadores com fórmulas", "metas aprovadas", "análise crítica periódica", "ações quando metas não são atingidas"],
    mistakes: ["medir o que é fácil, não o que é crítico", "não definir responsável", "não registrar análise", "alterar meta para esconder desempenho ruim"],
  }],
  [/mudancas climaticas contexto/, {
    label: "Mudanças climáticas no contexto da organização",
    explanation: "A Emenda 1:2024 acrescentou a necessidade de determinar se mudança climática é uma questão relevante para o SGQ e reforçou que partes interessadas podem ter requisitos relacionados ao tema. A interpretação correta não é presumir que toda empresa precisa criar inventário de carbono; é analisar relevância para produtos, serviços, processos, cadeia de suprimentos, requisitos legais, requisitos de cliente e resultados pretendidos do SGQ.\n\nSe a questão for relevante, deve entrar no mesmo ciclo de gestão usado para outros temas: contexto, partes interessadas, riscos e oportunidades, planejamento, operação, comunicação, avaliação e melhoria. Se não for relevante, a decisão precisa ser tecnicamente justificável e revisada quando o contexto mudar.",
    evidence: ["registro de análise de relevância climática", "requisitos climáticos de clientes ou partes interessadas", "riscos e oportunidades quando aplicável", "decisão documentada e revisada"],
    mistakes: ["tratar a emenda como ISO 14001 obrigatória", "ignorar totalmente o tema", "fazer declaração genérica sem análise", "não considerar requisitos de clientes ou cadeia de fornecimento"],
  }],
  [/lideranca comprometimento|participacao alta direcao/, {
    label: "Liderança e participação da alta direção",
    explanation: "A liderança na ISO 9001 exige participação real da alta direção. Isso inclui assumir responsabilidade pelo SGQ, integrar qualidade à estratégia, prover recursos, promover abordagem de processos, apoiar pessoas, acompanhar resultados e cobrar melhoria. Assinar política ou ata não basta.\n\nUma interpretação madura procura evidências de decisão: recursos aprovados, prioridades definidas, metas acompanhadas, obstáculos removidos e comunicação consistente sobre qualidade. O SGQ não pode ser um projeto isolado do responsável da qualidade.",
    evidence: ["atas com decisões e recursos", "metas acompanhadas pela direção", "comunicações da liderança", "ações corretivas ou melhorias priorizadas pela gestão"],
    mistakes: ["delegar todo o SGQ a um consultor", "participar apenas na auditoria externa", "assinar documentos sem conhecer desempenho", "não integrar qualidade ao planejamento do negócio"],
  }],
  [/foco cliente|comunicacao clientes|satisfacao cliente/, {
    label: "Foco, comunicação e satisfação do cliente",
    explanation: "Foco no cliente significa entender requisitos, atender compromissos, tratar reclamações, monitorar satisfação e aumentar a capacidade de entregar valor. Comunicação com cliente inclui informações sobre produtos e serviços, contratos, alterações, feedback, reclamações e contingências.\n\nA satisfação do cliente pode ser medida por pesquisas, reclamações, renovação de contratos, devoluções, indicadores de entrega, suporte e outros sinais. A interpretação correta combina fontes diretas e indiretas, porque ausência de reclamação não prova satisfação.",
    evidence: ["registros de requisitos do cliente", "canais e prazos de resposta", "pesquisas ou indicadores de satisfação", "tratamento de reclamações e análise de tendência"],
    mistakes: ["achar que cliente satisfeito é cliente silencioso", "não registrar mudança de requisito", "tratar reclamação sem causa raiz", "medir satisfação e não usar o dado"],
  }],
  [/politica qualidade/, {
    label: "Política da qualidade",
    explanation: "A política da qualidade deve expressar a direção da organização para o SGQ. Ela precisa ser compatível com contexto e estratégia, apoiar objetivos, incluir compromisso com requisitos aplicáveis e melhoria contínua, além de ser comunicada e entendida. O valor da política está em orientar decisões, não em ficar exposta na parede.\n\nPara interpretar, pergunte se a política conversa com os objetivos, indicadores, riscos e práticas reais. Se ninguém consegue explicar como a política se conecta ao trabalho diário, ela perdeu função gerencial.",
    evidence: ["política aprovada e controlada", "comunicação e entendimento por colaboradores", "objetivos derivados da política", "revisão quando contexto muda"],
    mistakes: ["copiar política de outra empresa", "usar texto genérico demais", "não demonstrar entendimento", "não relacionar política a objetivos mensuráveis"],
  }],
  [/papeis responsabilidades autoridades/, {
    label: "Papéis, responsabilidades e autoridades",
    explanation: "O SGQ precisa deixar claro quem decide, executa, verifica, aprova e responde por resultados. Responsabilidade sem autoridade cria gargalo; autoridade sem responsabilidade cria risco. A interpretação deve procurar clareza nas interfaces entre áreas e nos pontos críticos do processo.\n\nFerramentas como organograma, descrição de função, matriz RACI e procedimentos podem demonstrar isso. Porém, a evidência mais forte é a prática: pessoas sabem o que fazer, quando escalar e quais decisões podem tomar.",
    evidence: ["matriz RACI ou equivalente", "descrições de função", "alçadas de aprovação", "entrevistas coerentes com a prática"],
    mistakes: ["responsável definido apenas no papel", "processos com várias áreas e nenhuma autoridade clara", "não atualizar papéis após mudança organizacional", "centralizar decisões operacionais simples na direção"],
  }],
  [/riscos oportunidades/, {
    label: "Riscos e oportunidades",
    explanation: "Pensamento baseado em riscos exige identificar incertezas que podem afetar conformidade, satisfação do cliente e resultados do SGQ. Oportunidades também importam: reduzir retrabalho, melhorar prazo, automatizar controle, desenvolver fornecedor ou aumentar confiabilidade.\n\nA norma não exige uma metodologia única, mas exige coerência. O tratamento deve ser proporcional ao impacto. Riscos críticos pedem ações robustas, responsáveis e acompanhamento. Riscos baixos podem ser monitorados sem burocracia excessiva.",
    evidence: ["matriz ou registro de riscos por processo", "critérios de avaliação", "ações planejadas e responsáveis", "monitoramento de eficácia"],
    mistakes: ["usar risco como tabela decorativa", "não ligar risco ao processo", "não revisar após incidente ou mudança", "tratar todos os riscos com a mesma intensidade"],
  }],
  [/objetivos qualidade/, {
    label: "Objetivos da qualidade",
    explanation: "Objetivos da qualidade traduzem a política em metas mensuráveis. Devem ser coerentes com o contexto, relevantes para conformidade e satisfação do cliente, monitorados, comunicados e atualizados quando necessário. Um objetivo sem indicador, prazo e responsável vira intenção vaga.\n\nA interpretação deve avaliar se os objetivos orientam melhoria real. Reduzir reclamações, melhorar prazo de entrega, aumentar aprovação de primeira peça ou reduzir retrabalho são exemplos de objetivos que podem ser conectados ao desempenho do SGQ.",
    evidence: ["objetivos documentados", "indicadores e metas", "responsáveis e prazos", "análise periódica e ações"],
    mistakes: ["objetivos impossíveis de medir", "metas sem responsável", "objetivos desconectados da política", "não tratar desvio de meta"],
  }],
  [/planos acao responsabilidades/, {
    label: "Planos de ação e responsabilidades",
    explanation: "Planos de ação transformam decisão em execução. Um plano adequado define o que será feito, por quê, quem fará, quando, onde, como, custo quando aplicável e como será verificada a conclusão ou eficácia. Sem essa estrutura, a organização acumula intenções sem rastreabilidade.\n\nEm ISO 9001, planos de ação aparecem em riscos, objetivos, não conformidades, auditorias, reclamações e melhorias. O aluno deve aprender que encerrar ação não é apenas marcar como concluída; é verificar se a ação produziu o efeito esperado.",
    evidence: ["5W2H ou plano equivalente", "status e prazos", "evidências de execução", "verificação de eficácia quando aplicável"],
    mistakes: ["ação sem responsável", "prazo vencido sem justificativa", "concluir sem evidência", "confundir execução com eficácia"],
  }],
  [/planejamento mudancas/, {
    label: "Planejamento de mudanças",
    explanation: "Mudanças em processos, fornecedores, sistemas, pessoas, instalações, requisitos ou produtos podem afetar a conformidade. Planejar mudanças significa avaliar propósito, consequências, recursos, responsabilidades, integridade do SGQ e comunicação necessária antes de alterar a operação.\n\nA interpretação correta é proporcional. Nem toda mudança exige projeto complexo, mas mudanças com impacto em cliente, requisitos legais, rastreabilidade, competência ou capacidade precisam de análise formal.",
    evidence: ["registro de mudança", "análise de impacto", "aprovações necessárias", "comunicação e treinamento quando aplicável"],
    mistakes: ["mudar fornecedor crítico sem qualificação", "alterar processo sem atualizar instruções", "não avaliar impacto em cliente", "não treinar equipe após mudança"],
  }],
  [/pessoas infraestrutura ambiente/, {
    label: "Pessoas, infraestrutura e ambiente",
    explanation: "A organização precisa prover recursos necessários para operar e controlar processos. Pessoas, infraestrutura e ambiente de trabalho não são itens administrativos; eles afetam diretamente conformidade. Falta de equipe, equipamento inadequado, manutenção falha ou ambiente impróprio podem gerar produto ou serviço não conforme.\n\nA interpretação deve avaliar suficiência e adequação. O recurso existe? Está disponível quando necessário? É mantido? A equipe sabe usá-lo? Há controle quando o ambiente influencia resultado?",
    evidence: ["dimensionamento ou escala de equipe", "plano de manutenção", "registros de infraestrutura", "controles ambientais quando aplicável"],
    mistakes: ["ignorar gargalos de recurso", "tratar manutenção apenas após falha", "não controlar ambiente crítico", "não relacionar recurso com risco do processo"],
  }],
  [/monitoramento medicao calibracao/, {
    label: "Monitoramento, medição e calibração",
    explanation: "Quando a organização usa recursos para verificar conformidade, precisa garantir que esses recursos sejam adequados e confiáveis. Isso pode envolver calibração, verificação, identificação, proteção contra ajustes indevidos e avaliação quando um equipamento é encontrado fora de condição.\n\nA interpretação técnica pergunta: o instrumento mede o que precisa medir? Sua incerteza é aceitável? Está dentro da validade? Quem usa sabe interpretar o resultado? O que acontece se a medição anterior foi feita com equipamento inadequado?",
    evidence: ["plano de calibração ou verificação", "certificados rastreáveis", "identificação de status", "tratamento de medições potencialmente inválidas"],
    mistakes: ["calibrar tudo sem critério", "não avaliar impacto de equipamento vencido", "usar instrumento inadequado", "não proteger equipamento contra dano ou ajuste indevido"],
  }],
  [/conhecimento organizacional/, {
    label: "Conhecimento organizacional",
    explanation: "Conhecimento organizacional é aquilo que a empresa precisa reter e disponibilizar para operar seus processos e alcançar conformidade. Pode estar em procedimentos, lições aprendidas, experiência técnica, bancos de dados, treinamentos, padrões de engenharia e histórico de problemas.\n\nA interpretação deve olhar riscos de perda de conhecimento. Se apenas uma pessoa sabe executar uma atividade crítica, o SGQ está vulnerável. Se uma lição aprendida não vira padrão, a falha tende a se repetir.",
    evidence: ["procedimentos e instruções atualizados", "lições aprendidas", "matriz de conhecimento crítico", "plano de sucessão ou multiplicação"],
    mistakes: ["depender de conhecimento informal", "não registrar aprendizado de falhas", "não atualizar padrão após mudança", "confundir conhecimento com arquivo morto"],
  }],
  [/competencia conscientizacao/, {
    label: "Competência e conscientização",
    explanation: "Competência envolve educação, treinamento ou experiência necessários para executar atividades que afetam desempenho e conformidade. Conscientização é entender política, objetivos, contribuição individual, benefícios de melhorar e consequências de não cumprir requisitos.\n\nA interpretação correta diferencia presença em treinamento de competência demonstrada. Uma lista de presença pode provar participação, mas não prova que a pessoa executa corretamente. Para funções críticas, pode ser necessário avaliar prática, resultado, supervisão ou reciclagem.",
    evidence: ["matriz de competência", "registros de treinamento", "avaliação de eficácia", "critérios para funções críticas"],
    mistakes: ["treinar e não avaliar eficácia", "não definir competência requerida", "não reciclar após falha", "achar que conscientização é apenas assinar lista"],
  }],
  [/comunicacao interna externa/, {
    label: "Comunicação interna e externa",
    explanation: "A organização precisa definir o que comunicar, quando, para quem, como e por quem. Comunicação afeta requisitos de clientes, mudanças, reclamações, fornecedores, indicadores, auditorias, riscos e decisões. Falha de comunicação costuma aparecer como retrabalho, atraso ou promessa não cumprida.\n\nA interpretação deve observar se a comunicação é planejada e eficaz. Não basta haver canais; é preciso garantir que informação crítica chegue ao destinatário correto e gere ação quando necessário.",
    evidence: ["plano ou matriz de comunicação", "registros de comunicações críticas", "responsáveis por canal", "evidência de ciência quando aplicável"],
    mistakes: ["enviar mensagem sem confirmar entendimento", "não comunicar mudança de requisito", "usar canal informal para decisão crítica", "não registrar comunicação externa relevante"],
  }],
  [/informacao documentada/, {
    label: "Informação documentada",
    explanation: "Informação documentada inclui documentos necessários para orientar o SGQ e registros que demonstram execução. A ISO 9001 é flexível quanto ao formato, mas exige controle: criação, atualização, identificação, distribuição, acesso, armazenamento, retenção, proteção e disposição quando aplicável.\n\nA interpretação madura evita dois extremos: burocracia documental excessiva e ausência de controle. Documentos orientam como fazer; registros mostram o que foi feito. Ambos precisam ser confiáveis e adequados ao risco.",
    evidence: ["lista mestra ou controle equivalente", "histórico de revisão", "regras de acesso e retenção", "registros protegidos e recuperáveis"],
    mistakes: ["documento sem revisão", "registro sem data ou responsável", "usar versão obsoleta", "guardar tudo sem critério de retenção"],
  }],
  [/planejamento controle operacional/, {
    label: "Planejamento e controle operacional",
    explanation: "A operação precisa ocorrer sob condições planejadas. Isso inclui critérios para processos e produtos, controle de mudanças, recursos, instruções, monitoramento, registros e ações para controlar processos terceirizados quando aplicável. A cláusula 8 é onde a qualidade se materializa para o cliente.\n\nInterpretar controle operacional é perguntar: o processo sabe o que deve entregar, com qual critério, usando quais recursos, por quem, com qual registro e o que fazer quando algo sai do planejado?",
    evidence: ["procedimentos ou instruções operacionais", "critérios de aceitação", "registros de execução", "controle de mudanças operacionais"],
    mistakes: ["operar por costume sem critério", "não registrar etapas críticas", "não controlar mudança de produção ou serviço", "ter instrução que não reflete a prática"],
  }],
  [/requisitos produtos servicos/, {
    label: "Requisitos para produtos e serviços",
    explanation: "Antes de assumir compromisso com o cliente, a organização deve determinar e analisar criticamente requisitos aplicáveis. Isso inclui requisitos declarados, necessários ao uso pretendido, legais, regulamentares e internos. A análise crítica evita aceitar pedidos que a empresa não consegue cumprir.\n\nA interpretação prática avalia se requisitos foram entendidos, se divergências foram resolvidas, se mudanças foram comunicadas e se há registro antes de executar. Em serviços, essa etapa é tão importante quanto em produtos.",
    evidence: ["proposta ou contrato revisado", "registro de análise crítica", "aprovação técnica ou comercial", "controle de alteração de requisitos"],
    mistakes: ["aceitar pedido sem capacidade", "não registrar requisito verbal", "não comunicar mudança à operação", "ignorar requisito legal aplicável"],
  }],
  [/projeto desenvolvimento/, {
    label: "Projeto e desenvolvimento",
    explanation: "Projeto e desenvolvimento exigem controle de etapas: planejamento, entradas, controles, saídas, mudanças, verificação e validação. Verificar é confirmar que a saída atende ao especificado; validar é confirmar que atende ao uso pretendido. Essa diferença é essencial.\n\nA interpretação depende do negócio. Nem toda organização realiza projeto e desenvolvimento, mas se adapta produto, cria serviço, desenvolve solução ou altera especificação para cliente, pode haver requisito aplicável. A não aplicabilidade precisa ser justificada pelo escopo real.",
    evidence: ["plano de projeto", "entradas e saídas definidas", "registros de verificação e validação", "controle de mudanças de projeto"],
    mistakes: ["declarar não aplicável sem analisar", "confundir verificação com validação", "não controlar mudança de projeto", "não preservar registros de decisões técnicas"],
  }],
  [/fornecedores externos/, {
    label: "Fornecedores externos",
    explanation: "Fornecedores externos podem afetar a conformidade de produtos e serviços. A organização precisa definir critérios de seleção, avaliação, monitoramento e reavaliação, além de comunicar claramente requisitos aplicáveis. O nível de controle deve ser proporcional ao impacto do fornecimento.\n\nA interpretação correta separa fornecedor comum de fornecedor crítico. Um fornecedor que afeta segurança, prazo, requisito legal, rastreabilidade ou especificação técnica exige controle mais robusto.",
    evidence: ["critérios de homologação", "avaliação periódica", "requisitos comunicados ao fornecedor", "tratamento de desempenho insatisfatório"],
    mistakes: ["avaliar somente preço", "não classificar criticidade", "não comunicar requisito técnico", "manter fornecedor ruim sem ação"],
  }],
  [/producao prestacao servicos/, {
    label: "Produção e prestação de serviços",
    explanation: "A produção ou prestação de serviços deve acontecer em condições controladas: informação disponível, recursos adequados, monitoramento, pessoas competentes, critérios de aceitação, validação quando o resultado não puder ser verificado depois e atividades de pós-entrega quando aplicáveis.\n\nA interpretação deve olhar o chão da operação. O que a equipe realmente faz? Quais critérios usa? Onde registra? Como sabe que terminou? Como controla retrabalho, alteração e comunicação com cliente?",
    evidence: ["instruções de trabalho", "checklists de execução", "registros de serviço ou produção", "critérios de aceitação e liberação"],
    mistakes: ["instrução distante da prática", "executar sem critério de aceitação", "não registrar etapa crítica", "não controlar atividade pós-entrega"],
  }],
  [/identificacao rastreabilidade preservacao/, {
    label: "Identificação, rastreabilidade e preservação",
    explanation: "Identificação permite saber o que é, qual seu status e como deve ser tratado. Rastreabilidade permite reconstruir histórico quando necessário. Preservação evita perda de conformidade durante armazenamento, manuseio, transporte ou execução.\n\nA interpretação deve ser proporcional. Rastreabilidade pode ser exigida por lei, cliente, risco, contrato ou decisão interna. Se uma falha aparecer, a organização precisa localizar origem, lote, responsável, data, fornecedor ou serviço relacionado quando isso for necessário.",
    evidence: ["etiquetas, códigos ou identificação de status", "registro de lote ou serviço", "regras de armazenamento e preservação", "teste de rastreabilidade quando aplicável"],
    mistakes: ["identificar produto mas não status", "perder vínculo entre lote e cliente", "armazenar sem preservar condição", "rastrear só depois que ocorre problema"],
  }],
  [/liberacao produtos servicos/, {
    label: "Liberação de produtos e serviços",
    explanation: "Antes da entrega, a organização deve verificar se critérios de aceitação foram atendidos. A liberação precisa ser realizada por pessoa autorizada e manter registro quando aplicável. Entregar sem confirmação pode transferir não conformidade para o cliente.\n\nA interpretação deve avaliar critérios, autoridade e evidência. Quem pode liberar? Com base em quê? O que acontece se há pendência? Existe concessão aprovada quando necessário?",
    evidence: ["inspeção final ou aceite", "assinatura ou aprovação de liberação", "critérios de aceitação atendidos", "registros de concessão quando aplicável"],
    mistakes: ["liberar por urgência sem evidência", "não definir autoridade", "não registrar aceite", "tratar concessão informalmente"],
  }],
  [/saidas nao conformes/, {
    label: "Controle de saídas não conformes",
    explanation: "Saída não conforme é produto, serviço ou resultado de processo que não atende requisito. A organização precisa identificar, controlar e tratar para impedir uso ou entrega indevida. Tratamentos podem incluir correção, segregação, retorno, suspensão, concessão ou informação ao cliente, conforme impacto.\n\nA interpretação correta exige avaliar consequência. Uma falha documental simples não tem o mesmo peso de uma entrega insegura ou fora de requisito legal. O registro deve permitir rastrear decisão e responsabilidade.",
    evidence: ["registro de não conformidade", "identificação e segregação", "disposição aprovada", "comunicação ao cliente quando aplicável"],
    mistakes: ["esconder falha para não gerar indicador", "corrigir sem registrar", "conceder sem autoridade", "não avaliar impacto no cliente"],
  }],
  [/analise avaliacao dados/, {
    label: "Análise e avaliação de dados",
    explanation: "Dados só têm valor quando viram interpretação e decisão. A organização deve analisar informações sobre conformidade, satisfação do cliente, desempenho de processos, fornecedores, ações, riscos e oportunidades. Tendências podem mostrar problema antes de uma não conformidade explícita.\n\nA interpretação deve separar dado bruto, indicador, análise e ação. Um gráfico não é análise; análise explica causa provável, impacto, tendência, decisão e próximo passo.",
    evidence: ["relatórios com análise crítica", "tendências e comparativos", "ações derivadas de dados", "decisões em atas ou reuniões"],
    mistakes: ["mostrar gráfico sem comentário técnico", "agir somente quando meta estoura", "não analisar tendência", "não relacionar dados de fontes diferentes"],
  }],
  [/auditoria interna/, {
    label: "Auditoria interna",
    explanation: "Auditoria interna avalia se o SGQ está conforme critérios definidos e se está implementado e mantido de forma eficaz. Exige programa, critérios, escopo, imparcialidade, registros e acompanhamento de resultados. Não é caça a culpados nem simples inspeção operacional.\n\nA interpretação diferencia evidência objetiva de opinião. Auditorias boas cruzam entrevista, observação, registros e requisitos. Também geram aprendizado para melhoria, não apenas lista de não conformidades.",
    evidence: ["programa de auditoria", "plano e critérios", "relatórios com evidências", "ações e verificação de tratamento"],
    mistakes: ["auditor auditar o próprio trabalho sem imparcialidade", "checklist genérico demais", "não registrar evidência", "não acompanhar ações pós-auditoria"],
  }],
  [/analise critica direcao/, {
    label: "Análise crítica pela direção",
    explanation: "A análise crítica pela direção é o momento em que a alta direção avalia adequação, suficiência e eficácia do SGQ. Deve considerar desempenho, satisfação do cliente, objetivos, auditorias, não conformidades, ações, fornecedores, recursos, riscos, oportunidades e mudanças relevantes.\n\nA interpretação deve procurar saídas úteis: decisões, ações, recursos, mudanças e oportunidades de melhoria. Uma ata sem decisão não demonstra gestão efetiva.",
    evidence: ["ata de análise crítica", "entradas analisadas", "decisões e responsáveis", "acompanhamento das ações da direção"],
    mistakes: ["fazer reunião apenas para cumprir calendário", "não levar dados reais", "não registrar decisões", "não acompanhar ações definidas"],
  }],
  [/nao conformidade correcao acao corretiva/, {
    label: "Não conformidade, correção e ação corretiva",
    explanation: "Correção trata o efeito imediato; ação corretiva trata a causa para evitar recorrência. Uma organização pode corrigir um erro e ainda permanecer vulnerável se não investigar por que ele ocorreu. A ISO 9001 exige reação adequada, avaliação da necessidade de ação corretiva, implementação e análise de eficácia.\n\nA interpretação deve considerar impacto, recorrência, causa e proporcionalidade. Nem todo desvio simples exige investigação complexa, mas falhas críticas ou recorrentes precisam de tratamento robusto.",
    evidence: ["registro de não conformidade", "correção executada", "análise de causa", "ação corretiva e verificação de eficácia"],
    mistakes: ["chamar correção de ação corretiva", "pular causa raiz", "encerrar ação sem evidência", "não avaliar recorrência"],
  }],
  [/analise causa eficacia/, {
    label: "Análise de causa e eficácia",
    explanation: "Análise de causa busca entender por que a não conformidade ocorreu. Métodos como 5 porquês, Ishikawa, árvore de falhas ou análise de processo ajudam, mas a ferramenta não substitui raciocínio. Causa precisa ser plausível, evidenciada e tratável.\n\nVerificação de eficácia confirma se a ação resolveu a causa e reduziu recorrência. Não é a mesma coisa que verificar se a tarefa foi concluída. Uma ação feita pode ser ineficaz.",
    evidence: ["método de causa aplicado", "evidências que sustentam a causa", "ação relacionada à causa", "dados pós-ação demonstrando eficácia"],
    mistakes: ["parar no primeiro porquê", "culpar pessoa sem avaliar processo", "ação que não ataca causa", "verificar apenas cumprimento de prazo"],
  }],
  [/melhoria continua/, {
    label: "Melhoria contínua",
    explanation: "Melhoria contínua é aumentar a adequação, suficiência e eficácia do SGQ ao longo do tempo. Pode vir de auditorias, dados, reclamações, riscos, oportunidades, inovação, análise crítica e aprendizado operacional. Nem toda melhoria precisa ser grande; pequenas melhorias consistentes sustentam maturidade.\n\nA interpretação deve procurar evidência de aprendizado. A empresa identifica oportunidades? Prioriza? Executa? Mede resultado? Padroniza quando dá certo?",
    evidence: ["projetos ou ações de melhoria", "indicadores antes e depois", "lições aprendidas", "padronização de boas práticas"],
    mistakes: ["confundir melhoria com correção pontual", "não medir resultado", "não padronizar ganho obtido", "depender apenas de auditoria externa para melhorar"],
  }],
  [/estudo caso/, {
    label: "Estudo de caso integrado",
    explanation: "Um estudo de caso permite aplicar a norma como sistema. O participante deve identificar contexto, partes interessadas, processos críticos, riscos, objetivos, recursos, operação, indicadores, auditoria e melhoria. Essa integração mostra que as cláusulas 4 a 10 não são departamentos separados.\n\nA interpretação deve produzir diagnóstico prático: lacunas, evidências existentes, evidências faltantes, riscos prioritários e plano de ação. Isso aproxima o aluno do uso real da norma sem transformar o curso em auditoria formal.",
    evidence: ["matriz de lacunas", "mapa requisito-processo-evidência", "priorização de riscos", "plano de ação do estudo de caso"],
    mistakes: ["avaliar só documentação", "não priorizar lacunas por risco", "ignorar cliente e operação", "não conectar diagnóstico a ação"],
  }],
  [/identificacao requisitos aplicaveis/, {
    label: "Identificação de requisitos aplicáveis",
    explanation: "Identificar requisito aplicável é relacionar a norma ao processo, produto, serviço, cliente, legislação e escopo do SGQ. O aluno não precisa decorar a norma inteira; precisa saber fazer perguntas corretas e localizar quais requisitos afetam determinada situação.\n\nUma matriz processo x requisito x evidência ajuda muito. Ela mostra quais cláusulas impactam cada processo, quem é responsável e quais evidências demonstram atendimento.",
    evidence: ["matriz processo x requisito", "responsáveis por requisito", "evidências mínimas por processo", "critérios de aplicabilidade"],
    mistakes: ["decorar cláusulas sem entender processo", "aplicar requisito sem avaliar escopo", "não justificar não aplicabilidade", "usar checklist genérico sem contexto"],
  }],
  [/exemplos evidencias conformidade/, {
    label: "Evidências de conformidade",
    explanation: "Evidência de conformidade precisa ser objetiva, pertinente, atual, rastreável e suficiente. Pode ser documento, registro, entrevista, observação, indicador, ata, contrato, ordem de serviço, relatório, certificado ou outro dado verificável. O tipo depende do requisito e do processo.\n\nUma evidência pode ser real e ainda ser insuficiente. Uma ata prova que houve reunião, mas talvez não prove análise de dados. Um certificado prova calibração, mas talvez não prove que o instrumento foi usado corretamente.",
    evidence: ["documentos controlados", "registros de execução", "indicadores analisados", "entrevistas e observação coerentes com registros"],
    mistakes: ["aceitar evidência sem relação com requisito", "usar registro sem data", "confundir intenção com execução", "não verificar se a evidência está atualizada"],
  }],
  [/exercicio interpretacao preparacao avaliacao/, {
    label: "Exercício de interpretação e avaliação final",
    explanation: "A preparação final deve consolidar a lógica da ISO 9001: contexto define direção; liderança sustenta compromisso; planejamento trata riscos e objetivos; apoio garante recursos; operação entrega valor; avaliação mede desempenho; melhoria corrige e evolui. Essa visão sistêmica é a base da interpretação.\n\nA avaliação final deve medir raciocínio, não memorização. As perguntas precisam verificar se o aluno sabe relacionar requisito, processo, evidência, risco, decisão e melhoria em situações concretas.",
    evidence: ["resumo por cláusula", "matriz requisito-processo-evidência", "exercícios respondidos", "avaliação final com nota mínima e explicações"],
    mistakes: ["estudar apenas perguntas decoradas", "não revisar cláusulas em conjunto", "não praticar evidências", "confundir interpretação com auditoria líder"],
  }],
];

function mergeProfile(title: string, unitTitle: string): TopicProfile {
  const base = fallbackProfile(title, unitTitle);
  const normalized = normalize(title);
  const guide = topicGuides.find(([pattern]) => pattern.test(normalized))?.[1] || {};
  const merged = { ...base, ...guide };
  return {
    ...merged,
    evidence: guide.evidence || base.evidence,
    mistakes: guide.mistakes || base.mistakes,
    quickQuestion: guide.quickQuestion || base.quickQuestion,
    quickOptions: guide.quickOptions || base.quickOptions,
    quickCorrectIndex: typeof guide.quickCorrectIndex === "number" ? guide.quickCorrectIndex : base.quickCorrectIndex,
    quickExplanation: guide.quickExplanation || base.quickExplanation,
    matchLeft: guide.matchLeft || base.matchLeft,
    matchRight: guide.matchRight || base.matchRight,
    matchPairs: guide.matchPairs || base.matchPairs,
  };
}

function lessonBlocks(lesson: LessonRow): BlockSeed[] {
  const unitTitle = lesson.unitTitle || "";
  const profile = mergeProfile(lesson.title, unitTitle);
  const imageUrl = lesson.image_url || undefined;
  const time = Number(lesson.estimated_minutes || lesson.durationMinutes || 15);

  return [
    {
      type: "concept",
      data: {
        title: "Objetivo técnico da aula",
        body: [
          `Nesta aula, você vai interpretar ${profile.label} dentro da lógica da ISO 9001:2015 e da realidade operacional de uma organização.`,
          `Carga estimada: ${time} minutos. O foco não é decorar texto normativo, mas formar julgamento técnico para reconhecer requisito aplicável, processo afetado, evidência suficiente e consequência para o SGQ.`,
          unitIntent(unitTitle),
        ].join("\n\n"),
        imageUrl,
      },
      xp: 5,
    },
    {
      type: "concept",
      data: {
        title: "Explicação técnica",
        body: profile.explanation,
        imageUrl,
      },
      xp: 5,
    },
    {
      type: "concept",
      data: {
        title: "Como interpretar na prática",
        body: [
          profile.interpretation,
          "Use esta sequência mental: 1) qual requisito ou princípio está em jogo; 2) qual processo é afetado; 3) qual risco existe se isso falhar; 4) qual controle a organização definiu; 5) qual evidência prova que o controle funciona; 6) qual indicador ou análise mostra o resultado.",
          "Essa forma de leitura evita dois problemas comuns: excesso de burocracia sem valor e informalidade sem evidência. A interpretação profissional fica no meio: controle suficiente, proporcional ao risco e demonstrável por fatos.",
        ].join("\n\n"),
        imageUrl,
      },
      xp: 5,
    },
    {
      type: "example",
      data: {
        scenario: profile.scenario,
        takeaway: "O aprendizado principal é que conformidade não nasce de uma frase bonita no procedimento. Ela aparece quando documento, prática, registro, indicador e decisão contam a mesma história.",
        imageUrl,
      },
      xp: 5,
    },
    {
      type: "concept",
      data: {
        title: "Evidências esperadas",
        body: [
          "Ao avaliar esta aula em uma empresa real, procure evidências proporcionais ao risco e ao impacto no cliente. Exemplos úteis:",
          ...profile.evidence.map((item) => `- ${item}`),
          "Uma boa evidência deve responder a três perguntas: quem fez, quando fez e com base em qual critério. Quando uma dessas respostas falta, a rastreabilidade fica fraca.",
        ].join("\n"),
        imageUrl,
      },
      xp: 5,
    },
    {
      type: "concept",
      data: {
        title: "Erros comuns de interpretação",
        body: [
          "Evite estes desvios, porque eles reduzem a credibilidade técnica do SGQ:",
          ...profile.mistakes.map((item) => `- ${item}`),
          "Em auditorias, consultorias ou análises internas, esses erros costumam gerar retrabalho, não conformidades, evidências frágeis e perda de confiança no sistema.",
        ].join("\n"),
        imageUrl,
      },
      xp: 5,
    },
    {
      type: "scenario_choice",
      data: {
        scenario: profile.scenario,
        question: "Qual decisão demonstra melhor interpretação da ISO 9001?",
        choices: [
          { text: profile.weakDecision, outcome: "A decisão pode melhorar aparência documental, mas não demonstra funcionamento real do SGQ.", isBest: false },
          { text: profile.bestDecision, outcome: "Boa decisão: cruza evidências, preserva rastreabilidade e transforma lacuna em ação gerenciável.", isBest: true },
          { text: profile.riskyDecision, outcome: "Risco alto: existência de arquivo não prova conformidade nem eficácia do processo.", isBest: false },
        ],
      },
      xp: 10,
    },
    {
      type: "quick_check",
      data: {
        question: profile.quickQuestion,
        options: profile.quickOptions,
        correctIndex: profile.quickCorrectIndex,
        explanation: profile.quickExplanation,
      },
      xp: 10,
    },
    {
      type: "match_pairs",
      data: {
        instruction: "Associe cada elemento à sua função na interpretação do SGQ.",
        leftItems: profile.matchLeft,
        rightItems: profile.matchRight,
        correctPairs: profile.matchPairs,
        explanation: "A interpretação fica mais forte quando requisito, processo, evidência e melhoria são conectados de forma lógica.",
      },
      xp: 10,
    },
    {
      type: "reflection",
      data: {
        question: "Atividade aplicada",
        guidance: profile.activity,
      },
      xp: 5,
    },
  ];
}

function lessonSummary(lesson: LessonRow) {
  const profile = mergeProfile(lesson.title, lesson.unitTitle || "");
  return [
    `Objetivo: interpretar ${profile.label} com foco em requisito, processo, risco, evidência e melhoria.`,
    `Conteúdo: explicação técnica, aplicação prática, evidências esperadas, erros comuns, cenário de decisão, verificação rápida, associação de conceitos e atividade aplicada.`,
    `Atividade: ${profile.activity}`,
  ].join("\n\n");
}

async function main() {
  const conn = await mysql.createConnection(connectionConfig() as any);
  await conn.beginTransaction();
  try {
    const [lessons] = await conn.execute<LessonRow[] & any[]>(
      `SELECT l.id, l.title, l.description, l.content, l.durationMinutes, l.estimated_minutes,
              l.image_url, l.orderIndex, u.title AS unitTitle
         FROM lessons l
         LEFT JOIN units u ON u.id = l.unit_id
        WHERE l.moduleId=?
        ORDER BY l.orderIndex ASC`,
      [MODULE_ID],
    );
    if (!lessons.length) throw new Error(`Nenhuma aula encontrada para o modulo ${MODULE_ID}.`);

    const [examRows] = await conn.execute<ExamRow[] & any[]>(
      "SELECT question_text, options, correct_index, explanation, order_index FROM ai_module_exams WHERE module_id=? ORDER BY order_index ASC",
      [MODULE_ID],
    );

    for (const lesson of lessons) {
      const blocks = lessonBlocks(lesson);
      const isFinalLesson = Number(lesson.orderIndex) === lessons.length;
      if (isFinalLesson) {
        for (const exam of examRows) {
          blocks.push({
            type: "multiple_choice",
            data: {
              question: `Avaliação final ${exam.order_index}/${examRows.length} - ${exam.question_text}`,
              options: parseOptions(exam.options),
              correctIndex: Number(exam.correct_index || 0),
              explanation: exam.explanation || "",
            },
            xp: 10,
          });
        }
      }

      await conn.execute(
        "UPDATE lessons SET description=?, content=?, updatedAt=NOW() WHERE id=?",
        [
          `Aula aprofundada de interpretação: ${mergeProfile(lesson.title, lesson.unitTitle || "").label}.`,
          lessonSummary(lesson),
          lesson.id,
        ],
      );
      await conn.execute("DELETE FROM lesson_blocks WHERE lesson_id=?", [lesson.id]);
      for (let i = 0; i < blocks.length; i++) {
        await conn.execute(
          "INSERT INTO lesson_blocks (lesson_id, block_type, content, order_index, xp_reward) VALUES (?, ?, ?, ?, ?)",
          [lesson.id, blocks[i].type, JSON.stringify(blocks[i].data), i + 1, blocks[i].xp],
        );
      }
    }

    await conn.execute(
      `UPDATE modules
          SET description=?,
              durationMinutes=960,
              certBody=?,
              updatedAt=NOW()
        WHERE id=?`,
      [
        [
          "Curso livre EAD de 16 horas para interpretação prática da ABNT NBR ISO 9001:2015, incluindo a Emenda 1:2024 sobre ação climática.",
          "O conteúdo foi estruturado para formar base técnica consistente: fundamentos da qualidade, estrutura da norma, cláusulas 4 a 10, evidências de conformidade, erros comuns, cenários aplicados, atividades práticas e avaliação final.",
          "A formação prepara o participante para interpretar requisitos e apoiar implantação, manutenção, auditorias internas e melhoria do SGQ, sem se apresentar como curso de auditor líder.",
          "Conteúdo modular para futura atualização quando a nova edição da ISO 9001 for oficialmente publicada.",
        ].join("\n\n"),
        "Concluiu o curso livre de 16 horas sobre Interpretação da ABNT NBR ISO 9001:2015, incluindo a Emenda 1:2024 - Mudanças relativas à ação climática, com trilha de aprendizagem, atividades aplicadas e avaliação final.",
        MODULE_ID,
      ],
    );

    await conn.commit();

    const [stats] = await conn.execute<any[]>(
      `SELECT
          (SELECT COUNT(*)
             FROM lesson_blocks
            WHERE lesson_id IN (SELECT id FROM lessons WHERE moduleId=?)) AS total_blocks,
          (SELECT ROUND(AVG(CHAR_LENGTH(content)), 0)
             FROM lesson_blocks
            WHERE lesson_id IN (SELECT id FROM lessons WHERE moduleId=?)) AS avg_content_chars,
          (SELECT MIN(block_count)
             FROM (
               SELECT COUNT(lb.id) AS block_count
                 FROM lessons l
                 LEFT JOIN lesson_blocks lb ON lb.lesson_id = l.id
                WHERE l.moduleId=?
                GROUP BY l.id
             ) counts_min) AS min_blocks_per_lesson,
          (SELECT MAX(block_count)
             FROM (
               SELECT COUNT(lb.id) AS block_count
                 FROM lessons l
                 LEFT JOIN lesson_blocks lb ON lb.lesson_id = l.id
                WHERE l.moduleId=?
                GROUP BY l.id
             ) counts_max) AS max_blocks_per_lesson`,
      [MODULE_ID, MODULE_ID, MODULE_ID, MODULE_ID],
    );

    console.log(JSON.stringify({
      ok: true,
      moduleId: MODULE_ID,
      lessons: lessons.length,
      finalExamQuestions: examRows.length,
      stats: stats[0],
    }, null, 2));
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
