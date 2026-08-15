export type KnowledgeArticle = {
  slug: string;
  title: string;
  summary: string;
  module: string;
  route: string;
  roles: string[];
  keywords: string[];
  whatIs: string;
  purpose: string;
  accessPath: string;
  steps: string[];
  cautions: string[];
  faq: Array<{ question: string; answer: string }>;
  problems: Array<{ problem: string; solution: string }>;
  screenshots: Array<{ url: string; alt: string; caption?: string }>;
  videoUrl?: string | null;
  updatedAt: string;
};

const allStaff = [
  "user",
  "chefia",
  "cipa",
  "sesmt",
  "rh",
  "admin",
  "company_admin",
  "admin_global",
  "super_admin",
  "psicologo",
  "medico",
];
const management = [
  "chefia",
  "cipa",
  "sesmt",
  "rh",
  "admin",
  "company_admin",
  "admin_global",
  "super_admin",
  "psicologo",
  "medico",
];
const adminHealth = [
  "sesmt",
  "rh",
  "admin",
  "company_admin",
  "admin_global",
  "super_admin",
  "medico",
];
const updatedAt = "2026-08-06";

export const knowledgeArticles: KnowledgeArticle[] = [
  {
    slug: "criar-ciclo-analise-risco",
    title: "Como criar e conduzir um ciclo de análise de risco",
    summary:
      "Criação do ciclo, escolha dos questionários, responsável técnico, coleta, cruzamento DRPS/AEP e encerramento.",
    module: "Análise de Risco",
    route: "/admin/analise-risco",
    roles: adminHealth,
    keywords: [
      "ciclo",
      "novo ciclo",
      "análise de risco",
      "drps",
      "aep",
      "responsável técnico",
      "coleta",
    ],
    whatIs:
      "O ciclo reúne, em um período controlado, as pesquisas DRPS e AEP, o cruzamento por setor e os documentos técnicos derivados.",
    purpose:
      "Garantir que coleta, análise e evidências permaneçam vinculadas ao mesmo contexto de empresa, filial, setor e responsável técnico.",
    accessPath: "Menu > Análise de Risco > Ciclos > Novo Ciclo",
    steps: [
      "Confirme a empresa, filial e setor que formarão o escopo.",
      "Selecione os templates de DRPS e AEP definidos para a empresa.",
      "Informe o nome do ciclo e o responsável técnico.",
      "Revise anonimato, público e período antes de iniciar a coleta.",
      "Acompanhe o DRPS somente por participação agregada e a AEP por pendências autorizadas.",
      "Calcule a matriz apenas para setores com cruzamento mínimo válido.",
      "Revise inventário, plano de ação e cronograma antes de encerrar.",
    ],
    cautions: [
      "O responsável técnico pode ser corrigido enquanto o ciclo estiver aberto; após o encerramento, o registro é histórico.",
      "Setores sem ao menos uma resposta válida de DRPS e AEP não devem compor a conclusão técnica.",
      "Nunca encerre o ciclo antes de revisar pendências e documentos.",
    ],
    faq: [
      {
        question: "Posso criar um ciclo para uma única filial?",
        answer:
          "Sim. Defina a filial no escopo; filtros, gráficos e relatórios respeitarão esse limite.",
      },
      {
        question: "A resposta anônima identifica o colaborador?",
        answer:
          "Não. No DRPS, a plataforma não registra conclusão individual nem disponibiliza lista de respondentes ou não respondentes.",
      },
    ],
    problems: [
      {
        problem: "Um setor não aparece na matriz.",
        solution:
          "Confira se existem respostas válidas de DRPS e AEP para o setor e se ele pertence ao escopo do ciclo.",
      },
      {
        problem: "Não consigo alterar o responsável técnico.",
        solution:
          "Verifique se o ciclo já foi concluído ou arquivado; nesses estados o responsável é histórico.",
      },
    ],
    screenshots: [],
    updatedAt,
  },
  {
    slug: "cobrar-drps-aep-segmentado",
    title: "Como enviar lembrete geral do DRPS e cobrar pendências da AEP",
    summary:
      "Participação agregada no DRPS e filtros individuais somente para a AEP.",
    module: "Análise de Risco",
    route: "/admin/analise-risco",
    roles: adminHealth,
    keywords: [
      "cobrar drps",
      "cobrar aep",
      "faltosos",
      "pendentes",
      "filial bahia",
      "lembrete",
      "campanha",
    ],
    whatIs:
      "No DRPS, um lembrete geral é enviado a todo o público elegível. Na AEP, a plataforma permite cobrança segmentada dos gestores pendentes.",
    purpose:
      "Aumentar a participação sem quebrar o anonimato do DRPS e acompanhar individualmente apenas a AEP.",
    accessPath:
      "Menu > Análise de Risco > Ciclos > Abrir ciclo > Participação DRPS ou Cobrar AEP",
    steps: [
      "No DRPS, consulte elegíveis, respostas, percentual, meta e diferença para a meta.",
      "Envie o lembrete geral para todo o público elegível, sem comparar nomes com respostas.",
      "Na AEP, filtre filial, setor e cargo.",
      "Revise os gestores pendentes e desmarque exceções, se necessário.",
      "Confira a quantidade e confirme a cobrança da AEP.",
    ],
    cautions: [
      "Nenhum envio ocorre ao abrir a janela.",
      "O DRPS não admite seleção individual, lista de faltosos ou cobrança somente de não respondentes.",
      "Se a lista mudar entre a revisão e o envio, a plataforma bloqueia a campanha e pede nova conferência.",
      "AEP é apresentada apenas para perfis elegíveis.",
    ],
    faq: [
      {
        question: "Posso cobrar uma única pessoa?",
        answer:
          "Somente na AEP. No DRPS, qualquer lembrete é geral e não identifica pendentes.",
      },
    ],
    problems: [
      {
        problem: "A quantidade mudou.",
        solution:
          "Alguém concluiu ou teve o cadastro alterado. Reabra a seleção e confirme a lista atual.",
      },
    ],
    screenshots: [],
    updatedAt,
  },
  {
    slug: "relatorio-pendencias-ciclo",
    title: "Relatório de pendências AEP e participação agregada DRPS",
    summary:
      "Consulta nominal de pendências somente da AEP e indicadores agregados para o DRPS.",
    module: "Análise de Risco",
    route: "/admin/analise-risco",
    roles: adminHealth,
    keywords: [
      "relatório faltosos",
      "pendências ciclo",
      "exportar pendentes",
      "conclusão drps",
      "conclusão aep",
    ],
    whatIs:
      "Uma visão individual de envio e conclusão da AEP. O DRPS aparece apenas como total de elegíveis, respostas e participação.",
    purpose:
      "Apoiar o fechamento metodológico preservando o anonimato integral do DRPS.",
    accessPath:
      "Menu > Análise de Risco > Ciclos > Abrir ciclo > Relatório de pendências",
    steps: [
      "Consulte a participação agregada do DRPS.",
      "Abra Pendências AEP para a visão individual autorizada.",
      "Aplique filial, setor, cargo, situação e período.",
      "Exporte somente os registros da AEP em CSV.",
    ],
    cautions: [
      "Não existe relatório individual de conclusão ou pendência do DRPS.",
      "CPF e identificadores devem ser tratados conforme LGPD.",
    ],
    faq: [],
    problems: [],
    screenshots: [],
    updatedAt,
  },
  {
    slug: "cadastrar-importar-colaboradores",
    title: "Como cadastrar e importar colaboradores",
    summary:
      "Cadastro individual, CSV por e-mail ou CPF e aplicação exata dos perfis informados.",
    module: "Colaboradores",
    route: "/admin/usuarios",
    roles: ["rh", "admin", "company_admin", "admin_global", "super_admin"],
    keywords: [
      "cadastrar funcionário",
      "importar colaboradores",
      "csv",
      "perfil chefia",
      "cpf",
      "e-mail corporativo",
    ],
    whatIs:
      "O cadastro mestre de pessoas da empresa, utilizado pelos módulos de pesquisa, treinamento, CIPA, EPI, atestados e indicadores.",
    purpose:
      "Manter identidade, vínculo organizacional, perfil e situação funcional consistentes em toda a plataforma.",
    accessPath: "Menu > Colaboradores > Importação",
    steps: [
      "Confirme o método de login configurado para a empresa.",
      "Baixe o template correspondente.",
      "Preencha CPF ou e-mail, nome, filial, setor, cargo e perfil.",
      "Use vírgula dentro da célula quando o colaborador possuir mais de um perfil.",
      "Faça a pré-visualização e corrija linhas inválidas.",
      "Confirme a importação e revise o resumo.",
    ],
    cautions: [
      "O perfil informado é aplicado sem inferência pelo cargo ou setor.",
      "Não exclua colaboradores para representar desligamento; altere o status funcional.",
      "CPF deve ser único dentro da regra de cadastro da plataforma.",
    ],
    faq: [
      {
        question: "Posso informar Chefia e CIPA?",
        answer:
          "Sim. Informe os dois perfis na mesma célula, separados por vírgula.",
      },
    ],
    problems: [
      {
        problem: "As colunas foram interpretadas incorretamente.",
        solution:
          "Use o template gerado para o método de acesso atual e mantenha o cabeçalho original.",
      },
    ],
    screenshots: [],
    updatedAt,
  },
  {
    slug: "atestados-rh-ocr-arquivo",
    title: "Cadastrar, analisar e arquivar atestados pelo RH",
    summary:
      "Cadastro manual, OCR assistivo, fila de análise, documento privado e Arquivo de Atestados.",
    module: "Saúde Ocupacional",
    route: "/admin/atestados-afastamentos",
    roles: adminHealth,
    keywords: [
      "cadastrar atestado",
      "atestado físico",
      "ocr",
      "arquivo de atestados",
      "afastamento",
      "rh",
    ],
    whatIs:
      "O fluxo administrativo e documental para atestados, declarações e afastamentos recebidos do colaborador ou diretamente pelo RH.",
    purpose:
      "Preservar o original, controlar análise, alertas, retorno e auditoria sem depender de arquivos paralelos.",
    accessPath:
      "Menu > Gestão de Atestados e Afastamentos > Cadastrar atestado manualmente",
    steps: [
      "Selecione o colaborador.",
      "Anexe o PDF ou a foto original.",
      "Para PNG/JPG, use Ler com OCR e confira cada sugestão.",
      "Complete datas, duração e emitente.",
      "Envie à fila de análise.",
      "Registre a decisão e observação interna.",
      "Ao finalizar, altere o status para Arquivado; o documento aparecerá no Arquivo de Atestados.",
    ],
    cautions: [
      "OCR não autentica documentos e não substitui conferência humana.",
      "CID é dado pessoal sensível e não é exibido à chefia.",
      "Alertas de 15 e 60 dias recomendam análise; não determinam benefício previdenciário.",
    ],
    faq: [
      {
        question: "O original é substituído pelo OCR?",
        answer:
          "Não. O arquivo original permanece privado e versionado; o OCR somente sugere campos.",
      },
    ],
    problems: [
      {
        problem: "O OCR não leu o PDF.",
        solution:
          "Use uma foto PNG/JPG legível ou preencha manualmente. O PDF continuará preservado normalmente.",
      },
    ],
    screenshots: [],
    updatedAt,
  },
  {
    slug: "gerar-pgr",
    title: "Como gerar e revisar o PGR",
    summary:
      "Escopo, GSE/GHE, inventário, medidas, anexos e conferência antes do PDF.",
    module: "PGR",
    route: "/admin/pgr",
    roles: [
      "sesmt",
      "rh",
      "admin",
      "company_admin",
      "admin_global",
      "super_admin",
    ],
    keywords: ["gerar pgr", "pgr", "anexos", "inventário", "gse", "ghe"],
    whatIs:
      "O gerador consolida dados reais de riscos, grupos, medidas, planos e anexos da empresa.",
    purpose:
      "Produzir um documento rastreável sem redigitação das informações já geridas na plataforma.",
    accessPath: "Menu > PGR > Gerador de PGR",
    steps: [
      "Selecione empresa, filial, setor ou GSE/GHE.",
      "Revise identificação e responsáveis técnicos.",
      "Confira perigos, avaliações e detalhamentos técnicos.",
      "Revise inventário, medidas e plano de ação.",
      "Selecione os anexos aplicáveis.",
      "Gere o PDF e faça conferência técnica antes de aprovar.",
    ],
    cautions: [
      "O PDF reflete os dados existentes no momento da geração.",
      "IA pode apoiar redação, mas a responsabilidade técnica e a conferência permanecem humanas.",
    ],
    faq: [],
    problems: [],
    screenshots: [],
    updatedAt,
  },
  {
    slug: "gse-ghe-detalhamento",
    title: "Como cadastrar GSE/GHE e detalhar riscos",
    summary:
      "Fluxo de grupos, perigos, riscos, detalhamento técnico e vínculo ao PGR.",
    module: "GSE/GHE",
    route: "/admin/gse",
    roles: ["sesmt", "admin", "company_admin", "admin_global", "super_admin"],
    keywords: [
      "gse",
      "ghe",
      "detalhamento técnico",
      "risco",
      "perigo",
      "salvar próximo risco",
    ],
    whatIs:
      "A estrutura que relaciona grupos de exposição, atividades, perigos, avaliações e controles.",
    purpose:
      "Alimentar inventário, matriz, EPI/EPC, plano de ação e PGR com uma fonte técnica única.",
    accessPath: "Menu > GSE/GHE",
    steps: [
      "Crie ou selecione o grupo.",
      "Vincule filial, setor, cargos e atividades.",
      "Inclua o perigo e o risco.",
      "Salve o risco.",
      "Preencha o detalhamento técnico e revise a sugestão de IA, quando utilizada.",
      "Marque medidas e evidências.",
      "Confirme o indicador de detalhamento concluído.",
    ],
    cautions: [
      "Não invente medições, limites ou referências.",
      "No celular, mantenha a tela aberta até a confirmação de salvamento.",
    ],
    faq: [],
    problems: [],
    screenshots: [],
    updatedAt,
  },
  {
    slug: "cipa-eleicao-comunicacoes",
    title: "Como conduzir a eleição da CIPA",
    summary:
      "Inscrições, votação secreta, faltosos, confirmações de comunicação e apuração.",
    module: "CIPA",
    route: "/admin/cipa",
    roles: [
      "cipa",
      "rh",
      "sesmt",
      "admin",
      "company_admin",
      "admin_global",
      "super_admin",
    ],
    keywords: [
      "cipa",
      "abrir inscrição",
      "abrir votação",
      "apuração",
      "faltosos eleição",
      "voto secreto",
    ],
    whatIs:
      "O fluxo digital de preparação, participação, voto secreto, apuração e evidências da eleição.",
    purpose:
      "Aumentar participação sem revelar o candidato escolhido por cada colaborador.",
    accessPath: "Menu > CIPA > Eleições",
    steps: [
      "Cadastre a eleição e os prazos.",
      "Revise a base elegível.",
      "Ao abrir inscrições, leia a confirmação de comunicação.",
      "Cadastre candidatos e abra a votação somente após revisão.",
      "Acompanhe apenas participação e faltosos.",
      "Apure após o encerramento e confirme a divulgação.",
    ],
    cautions: [
      "Abrir inscrições, abrir votação e apurar podem disparar comunicações.",
      "A plataforma exige confirmação explícita antes da mudança.",
      "Nunca utilize relatórios para tentar inferir o voto.",
    ],
    faq: [],
    problems: [],
    screenshots: [],
    updatedAt,
  },
  {
    slug: "atas-corporativas",
    title: "Como criar, imprimir e arquivar uma ata corporativa",
    summary:
      "Reunião, decisões, plano de ação, PDF, assinaturas físicas e evidência digitalizada.",
    module: "Atas Corporativas",
    route: "/admin/atas-corporativas",
    roles: management,
    keywords: [
      "ata corporativa",
      "assinaturas participantes",
      "reunião",
      "plano de ação",
      "ata assinada",
    ],
    whatIs:
      "O registro estruturado de reuniões corporativas e ações decorrentes.",
    purpose:
      "Preservar decisões, responsáveis, prazos, anexos e assinaturas para consulta e auditoria.",
    accessPath: "Menu > Atas Corporativas",
    steps: [
      "Cadastre título, data, participantes e descrição.",
      "Registre decisões e ações.",
      "Gere o PDF, que contém a seção de assinaturas.",
      "Imprima e colha assinaturas quando necessário.",
      "Digitalize o documento assinado.",
      "Anexe como Ata impressa com assinaturas.",
    ],
    cautions: [
      "Mantenha o PDF original e o digitalizado assinado.",
      "Não exclua evidências que sustentem ações em andamento.",
    ],
    faq: [],
    problems: [],
    screenshots: [],
    updatedAt,
  },
  {
    slug: "gestao-epi-epc",
    title: "Como operar a Gestão de EPI/EPC",
    summary:
      "Cadastro, PGR/GSE, treinamento, estoque, entrega, recibo e conformidade NR-06.",
    module: "EPI/EPC",
    route: "/admin/epi-epc",
    roles: [
      "sesmt",
      "rh",
      "admin",
      "company_admin",
      "admin_global",
      "super_admin",
    ],
    keywords: ["epi", "epc", "nr 06", "ca", "entrega", "estoque", "recibo"],
    whatIs:
      "A gestão digital do ciclo de equipamentos de proteção e suas evidências.",
    purpose:
      "Relacionar risco, seleção, estoque, treinamento, entrega, recibo, substituição e PGR.",
    accessPath: "Menu > Gestão de EPI/EPC",
    steps: [
      "Cadastre EPI ou EPC.",
      "Separe controle do CA e validade do produto.",
      "Vincule ao GSE/GHE e ao risco, quando aplicável.",
      "Defina treinamento e estoque.",
      "Registre a entrega individual ou em lote.",
      "Gere o recibo e obtenha o documento assinado.",
      "Acompanhe alertas e relatórios.",
    ],
    cautions: [
      "CA vencido não significa automaticamente produto vencido, e CA válido não garante a condição física do EPI.",
      "IA nunca deve inventar número de CA.",
    ],
    faq: [],
    problems: [],
    screenshots: [],
    updatedAt,
  },
  {
    slug: "studio-cursos-ia",
    title: "Como criar cursos com o Estúdio de IA",
    summary:
      "Planejamento, nível, duração, revisão pedagógica, publicação e certificados.",
    module: "Cursos",
    route: "/admin/ai-studio",
    roles: [
      "rh",
      "sesmt",
      "admin",
      "company_admin",
      "admin_global",
      "super_admin",
    ],
    keywords: [
      "criar curso",
      "estúdio ia",
      "curso com ia",
      "nível iniciante",
      "certificado",
      "publicar curso",
    ],
    whatIs:
      "Um assistente para estruturar cursos, aulas, atividades e avaliações dentro do motor oficial da plataforma.",
    purpose:
      "Acelerar produção sem retirar a revisão humana de conteúdo técnico, linguagem e direitos de uso.",
    accessPath: "Menu > Cursos > Estúdio de Criação",
    steps: [
      "Descreva o objetivo e o público.",
      "Escolha nível e duração.",
      "Gere a estrutura.",
      "Revise densidade, português, imagens e referências.",
      "Ajuste perguntas e nota mínima.",
      "Publique para os públicos autorizados.",
      "Faça um teste completo como aluno.",
    ],
    cautions: [
      "Conteúdo técnico sério exige validação por profissional competente.",
      "Evite texto gerado dentro de imagens.",
      "Verifique carga horária, progresso e critérios do certificado.",
    ],
    faq: [],
    problems: [],
    screenshots: [],
    updatedAt,
  },
  {
    slug: "pesquisas-anonimas",
    title: "Como criar pesquisas e preservar o anonimato",
    summary:
      "Templates, público, anonimato, conclusão e uso responsável dos resultados.",
    module: "Pesquisas",
    route: "/admin/pesquisas",
    roles: [
      "psicologo",
      "rh",
      "sesmt",
      "admin",
      "company_admin",
      "admin_global",
      "super_admin",
    ],
    keywords: [
      "pesquisa anônima",
      "drps anônimo",
      "criar pesquisa",
      "template",
      "psicólogo",
      "lgpd",
    ],
    whatIs:
      "A coleta estruturada de respostas identificadas ou anônimas conforme a finalidade definida.",
    purpose:
      "Permitir diagnóstico e acompanhamento sem expor respostas individuais quando o anonimato for necessário.",
    accessPath: "Menu > Pesquisas",
    steps: [
      "Escolha ou crie o template.",
      "Defina finalidade, público e obrigatoriedade.",
      "Ative anonimato antes de publicar, quando aplicável.",
      "Revise perguntas e escalas.",
      "Publique e acompanhe somente conclusão e indicadores permitidos.",
      "Analise resultados agregados.",
    ],
    cautions: [
      "Anonimato deve ser definido antes da coleta.",
      "A conclusão pode ser registrada separadamente da resposta para controle de pendência.",
      "Evite recortes com grupos tão pequenos que permitam reidentificação.",
    ],
    faq: [],
    problems: [],
    screenshots: [],
    updatedAt,
  },
  {
    slug: "white-label-rede",
    title: "Como administrar uma rede White Label",
    summary:
      "Marca, domínio, empresas, planos, créditos de IA e isolamento entre clientes.",
    module: "White Label",
    route: "/plataforma/super-admin/white-label",
    roles: ["company_admin", "admin_global", "super_admin"],
    keywords: [
      "white label",
      "logo",
      "domínio",
      "rede",
      "clientes cnpj",
      "créditos ia",
      "plano",
    ],
    whatIs:
      "Uma rede com marca e gestão comercial próprias, subordinada ao SuperAdmin global.",
    purpose:
      "Permitir operação independente sem acesso cruzado entre redes ou empresas clientes.",
    accessPath: "SuperAdmin > White Label",
    steps: [
      "Cadastre parceiro, plano e limites.",
      "Configure marca, logo, cores e domínio.",
      "Vincule somente os CNPJs da rede.",
      "Defina franquias e créditos de IA.",
      "Valide o domínio e faça a prévia por impersonação.",
      "Crie o administrador da rede e teste as permissões.",
    ],
    cautions: [
      "Uma rede nunca deve consultar dados comerciais ou operacionais de outra.",
      "O SuperAdmin global mantém supervisão macro.",
      "Teste logo e domínio sem cache antes da liberação.",
    ],
    faq: [],
    problems: [],
    screenshots: [],
    updatedAt,
  },
  {
    slug: "meus-cursos-certificados",
    title: "Como fazer cursos e emitir certificados",
    summary: "Acesso do colaborador, progresso, avaliação final e certificado.",
    module: "Área do Colaborador",
    route: "/cursos",
    roles: allStaff,
    keywords: [
      "meus cursos",
      "certificado",
      "curso pendente",
      "progresso",
      "avaliação",
    ],
    whatIs: "A área individual de aprendizagem e evidências de conclusão.",
    purpose:
      "Organizar conteúdos obrigatórios e livres, avaliações, prazos e certificados.",
    accessPath: "Menu > Cursos",
    steps: [
      "Abra o curso atribuído.",
      "Conclua aulas e atividades na ordem definida.",
      "Realize a avaliação final quando houver.",
      "Atinja a nota mínima.",
      "Abra ou baixe o certificado após a conclusão.",
    ],
    cautions: [
      "Não feche a aula antes de o progresso ser confirmado.",
      "O certificado só é emitido quando todos os critérios forem cumpridos.",
    ],
    faq: [],
    problems: [],
    screenshots: [],
    updatedAt,
  },
  {
    slug: "central-medica-prontuario",
    title: "Como utilizar a Central Médica e o prontuário ocupacional",
    summary:
      "Acesso restrito do Médico aos colaboradores, atendimentos, encaminhamentos, atestados, medicamentos e linha do tempo ocupacional.",
    module: "Central Médica",
    route: "/medico",
    roles: ["medico"],
    keywords: [
      "médico",
      "central médica",
      "prontuário",
      "atendimento",
      "encaminhamento",
      "atestado",
      "medicamento",
    ],
    whatIs:
      "A Central Médica é o espaço clínico segregado da plataforma para registrar e consultar informações médicas e ocupacionais.",
    purpose:
      "Preservar continuidade assistencial, rastreabilidade e sigilo profissional sem misturar prontuário clínico com o dossiê administrativo do RH.",
    accessPath: "Menu do perfil Médico > Central Médica",
    steps: [
      "Cadastre seu CRM, UF e especialidade no Dashboard Médico.",
      "Abra Colaboradores e selecione explicitamente o paciente.",
      "Use Novo atendimento para registrar motivo, anotações clínicas, conduta e orientações.",
      "Registre encaminhamento, atestado ou medicamento pelos comandos do prontuário quando aplicável.",
      "Confira a linha do tempo e a auditoria antes de encerrar o atendimento.",
    ],
    cautions: [
      "Anotações clínicas não devem ser copiadas para campos administrativos.",
      "RH, SESMT e chefias não recebem acesso automático ao prontuário.",
      "Use o resumo administrativo do atestado somente para informações necessárias ao fluxo de trabalho.",
    ],
    faq: [
      {
        question: "O RH visualiza minhas anotações clínicas?",
        answer:
          "Não. O dossiê administrativo e o prontuário ocupacional têm permissões diferentes.",
      },
    ],
    problems: [
      {
        problem: "Não consigo criar um PCMSO.",
        solution:
          "Confirme se seu usuário possui o perfil Médico e se CRM e UF foram preenchidos no Dashboard Médico.",
      },
    ],
    screenshots: [],
    updatedAt,
  },
  {
    slug: "pcmso-importar-pgr",
    title: "Como elaborar o PCMSO a partir do PGR",
    summary:
      "Criação, importação dos riscos por GSE, decisão médica, capítulos, anexos, PDF e versionamento do PCMSO.",
    module: "PCMSO",
    route: "/medico",
    roles: ["medico"],
    keywords: [
      "pcmso",
      "pgr",
      "gse",
      "risco",
      "exame",
      "monitoramento",
      "anexo",
      "pdf",
    ],
    whatIs:
      "O editor de PCMSO recebe os riscos existentes no PGR e permite ao Médico decidir, risco a risco, a forma de monitoramento.",
    purpose:
      "Evitar redigitação e manter rastreabilidade entre PGR, GSE, risco e decisão médica, sem prescrição automática pela plataforma.",
    accessPath: "Central Médica > PCMSO",
    steps: [
      "Crie o PCMSO e informe vigência, textos-base e PGR de referência.",
      "Clique em Importar PGR para carregar GSEs, riscos, classificações e detalhamentos.",
      "Para cada risco, escolha avaliação clínica, exame complementar ou não aplicável e registre a justificativa.",
      "Edite o PCMSO para incluir capítulos, cabeçalho e rodapé.",
      "Anexe os documentos oficiais nos números 1 a 8.",
      "Gere e arquive o PDF somente depois de revisar todas as decisões médicas.",
    ],
    cautions: [
      "A importação do PGR não define exames automaticamente.",
      "A plataforma bloqueia a geração quando existe risco sem decisão médica.",
      "Cada PDF gera uma versão histórica imutável em armazenamento privado.",
    ],
    faq: [
      {
        question: "Todo risco exige exame complementar?",
        answer:
          "Não. O Médico pode definir avaliação clínica ou registrar que não se aplica, sempre com justificativa técnica.",
      },
    ],
    problems: [
      {
        problem: "O PGR não aparece para importação.",
        solution:
          "Confirme se o PGR pertence à mesma empresa e se foi salvo no Gerador de PGR.",
      },
    ],
    screenshots: [],
    updatedAt,
  },
  {
    slug: "campanha-vacinacao-corporativa",
    title: "Como cadastrar vacinas, parceiros e campanhas",
    summary:
      "Planejamento da campanha, registro das doses, próxima dose e integração com o prontuário, o dossiê e o portal do colaborador.",
    module: "Vacinação",
    route: "/medico",
    roles: ["medico"],
    keywords: [
      "vacina",
      "vacinação",
      "campanha",
      "dose",
      "lote",
      "parceiro",
      "comprovante",
    ],
    whatIs:
      "O módulo organiza o catálogo de vacinas, prestadores, campanhas e registros individuais de imunização ocupacional.",
    purpose:
      "Acompanhar doses aplicadas e futuras, preservar evidências e disponibilizar ao colaborador apenas o seu próprio histórico.",
    accessPath: "Central Médica > Vacinação",
    steps: [
      "Cadastre a vacina, fabricante, quantidade de doses e intervalo.",
      "Cadastre a clínica, laboratório ou prestador parceiro.",
      "Crie a campanha com data, local, público e quantidade estimada.",
      "Selecione um colaborador no prontuário e registre a dose, lote e próxima dose.",
      "Confirme o registro na linha do tempo e no portal Minhas Vacinas.",
    ],
    cautions: [
      "Confira lote e data antes de salvar.",
      "O colaborador visualiza somente seus próprios registros.",
    ],
    faq: [],
    problems: [],
    screenshots: [],
    updatedAt,
  },
  {
    slug: "dossie-colaborador",
    title: "Como consultar e complementar o Dossiê do Colaborador",
    summary:
      "Consulta integrada de documentos, certificados, EPI/EPC, vacinação e afastamentos sem duplicar os registros de origem.",
    module: "Colaboradores",
    route: "/admin/usuarios",
    roles: [
      "rh",
      "admin",
      "company_admin",
      "admin_global",
      "super_admin",
      "sesmt",
    ],
    keywords: [
      "dossiê",
      "documentos",
      "certificados",
      "epi",
      "vacinação",
      "atestados",
      "colaborador",
    ],
    whatIs:
      "O dossiê é a visão documental administrativa do colaborador, formada por referências aos módulos de origem e arquivos externos adicionados pelo usuário autorizado.",
    purpose:
      "Reunir evidências sem cópias desnecessárias e sem expor anotações clínicas do prontuário médico.",
    accessPath: "Colaboradores > abrir Visão 360 > Dossiê do colaborador",
    steps: [
      "Abra a Visão 360 do colaborador.",
      "Clique em Dossiê do colaborador.",
      "Consulte os blocos integrados.",
      "Use Adicionar documento somente para arquivos que ainda não existem em outro módulo.",
      "Escolha a categoria correta e arquive o original.",
    ],
    cautions: [
      "Não use o dossiê administrativo para anotações clínicas.",
      "Certificados, EPI/EPC, vacinação e afastamentos integrados não precisam de novo upload.",
    ],
    faq: [],
    problems: [],
    screenshots: [],
    updatedAt,
  },
  {
    slug: "portal-clinica-credenciada",
    title: "Como operar o Portal da Clínica Credenciada",
    summary:
      "Recebimento de requisições, agendamento, realização, envio de resultados, comprovantes assinados e demonstrativo de atendimentos.",
    module: "Clínica Credenciada",
    route: "/clinica",
    roles: ["clinica"],
    keywords: [
      "clínica",
      "credenciado",
      "requisição",
      "agendamento",
      "resultado",
      "ocr",
      "comprovante",
      "faturamento",
      "demonstrativo",
    ],
    whatIs:
      "O portal é a área restrita da clínica credenciada para tratar exclusivamente as requisições encaminhadas pelo SESMT.",
    purpose:
      "Acompanhar o atendimento sem acesso livre ao cadastro da empresa, devolver resultados com rastreabilidade e comprovar a produção do período.",
    accessPath: "Menu > Portal da Clínica",
    steps: [
      "Abra Requisições e localize o trabalhador pelo nome, CPF, matrícula, exame ou número da requisição.",
      "Atualize a situação para agendamento pendente ou agendada e informe a data quando ela estiver definida.",
      "Depois do atendimento, registre a data de realização e o profissional responsável.",
      "Use Lançar resultado para digitar as informações ou ler uma imagem com OCR; sempre revise as sugestões antes do envio.",
      "Imprima a requisição, colha a assinatura do credenciado e anexe a via assinada na mesma requisição.",
      "Abra Demonstrativo e faturamento, selecione o período e confira valores e comprovantes pendentes antes de gerar o PDF.",
    ],
    cautions: [
      "A clínica visualiza somente trabalhadores com requisições encaminhadas para o seu credenciamento.",
      "O OCR auxilia a digitação e não substitui a conferência do profissional responsável.",
      "O comprovante assinado deve permanecer vinculado ao atendimento correspondente.",
    ],
    faq: [
      {
        question: "Posso pesquisar outro colaborador da empresa?",
        answer:
          "Não. A pesquisa funciona apenas dentro das requisições encaminhadas à clínica.",
      },
      {
        question: "O resultado enviado fica ligado a quem?",
        answer:
          "A plataforma usa o trabalhador, o exame e a empresa definidos na requisição original; esses vínculos não podem ser trocados pela clínica.",
      },
    ],
    problems: [
      {
        problem: "A requisição não aparece no portal.",
        solution:
          "Peça ao SESMT para confirmar se a requisição vigente foi direcionada ao mesmo credenciado e CNPJ do seu acesso.",
      },
      {
        problem: "O demonstrativo indica comprovante pendente.",
        solution:
          "Abra a requisição correspondente e anexe a via assinada pelo profissional que realizou o atendimento.",
      },
    ],
    screenshots: [],
    updatedAt,
  },
];

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function canReadKnowledgeArticle(
  article: KnowledgeArticle,
  role: string
) {
  return (
    article.roles.includes(role) ||
    ["admin_global", "super_admin"].includes(role)
  );
}

export function searchKnowledgeArticles(
  query: string,
  role: string,
  limit = 12
) {
  return searchKnowledgeArticleList(knowledgeArticles, query, role, limit);
}

export function searchKnowledgeArticleList(
  articles: KnowledgeArticle[],
  query: string,
  role: string,
  limit = 12
) {
  const terms = normalize(query)
    .split(/\s+/)
    .filter(term => term.length > 1);
  return articles
    .filter(article => canReadKnowledgeArticle(article, role))
    .map(article => {
      const title = normalize(article.title);
      const keywords = normalize(article.keywords.join(" "));
      const body = normalize(
        [
          article.summary,
          article.whatIs,
          article.purpose,
          article.accessPath,
          ...article.steps,
          ...article.cautions,
        ].join(" ")
      );
      const score = terms.length
        ? terms.reduce(
            (sum, term) =>
              sum +
              (title.includes(term) ? 8 : 0) +
              (keywords.includes(term) ? 5 : 0) +
              (body.includes(term) ? 1 : 0),
            0
          )
        : 1;
      return { article, score };
    })
    .filter(item => item.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || a.article.title.localeCompare(b.article.title)
    )
    .slice(0, limit)
    .map(item => item.article);
}
