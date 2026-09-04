export type PlatformFeatureManifestItem = {
  code: string;
  version: string;
  name: string;
  category: string;
  pillarCode: string;
  moduleName: string;
  description: string;
  problem: string;
  objective: string;
  benefits: string[];
  resources: string[];
  audience: string[];
  flow: string[];
  integrations: string[];
  indicators: string[];
  roles: string[];
  route: string;
  keywords: string[];
  planNames: string[];
};

export const PLATFORM_RELEASE = {
  code: "2026.09.02-sgq-pcmso-aso-contexto",
  title: "SGQ independente, PCMSO/ASO integrado e Portfólio Vivo",
  summary:
    "Inclui a vertical SGQ como produto independente, reforça a ligação colaborador-GSE-PGR-PCMSO para anamnese/ASO e amplia a base viva de funcionalidades comerciais.",
};

function employeeExperienceFeature(
  code: string,
  name: string,
  description: string,
  resources: string[],
  flow: string[],
  integrations: string[] = ["Portal do Colaborador", "Dossiê do Colaborador", "Comunicações"]
): PlatformFeatureManifestItem {
  return {
    code,
    version: "1.0.0",
    name,
    category: "Experiência do Colaborador",
    pillarCode: "employee_experience",
    moduleName: "Portal do Colaborador",
    description,
    problem:
      "O colaborador precisa localizar documentos, cursos, comprovantes e solicitações sem depender de mensagens soltas ou reenvios manuais.",
    objective:
      "Concentrar a experiência individual do trabalhador em uma área simples, segura e conectada aos módulos que geram cada documento.",
    benefits: [
      "Entrega segunda via digital e individualizada.",
      "Reduz solicitações manuais ao RH e ao SESMT.",
      "Mantém histórico organizado por CPF, matrícula e perfil.",
      "Conecta comunicação, ciência e documentos em um único acesso.",
    ],
    resources,
    audience: ["Colaboradores", "RH", "SESMT", "Gestores"],
    flow,
    integrations,
    indicators: ["Documentos disponíveis", "Acessos", "Pendências", "Ciências registradas"],
    roles: ["user", "employee", "collaborator", "rh", "sesmt", "admin", "company_admin", "super_admin"],
    route: "/colaborador",
    keywords: [code.replace(/_/g, " "), name.toLowerCase(), "colaborador", "portal", "dossiê"],
    planNames: ["Professional", "Business", "Enterprise"],
  };
}

const EMPLOYEE_EXPERIENCE_FEATURES: PlatformFeatureManifestItem[] = [
  employeeExperienceFeature(
    "employee_home",
    "Início do Colaborador",
    "Página inicial individual com avisos, documentos recentes, pendências e atalhos para os serviços do colaborador.",
    ["Resumo individual", "Pendências", "Avisos", "Atalhos por módulo"],
    ["Acessar portal", "Ver pendências", "Abrir documento", "Registrar ciência"]
  ),
  employeeExperienceFeature(
    "employee_courses",
    "Meus Cursos",
    "Acesso individual aos cursos disponíveis, andamento das aulas, conclusão e histórico de aprendizagem.",
    ["Cursos disponíveis", "Andamento", "Conclusão", "Histórico"],
    ["Curso liberado", "Colaborador acessa", "Conclui", "Histórico atualizado"],
    ["Cursos", "Studio", "Certificados", "Dossiê"]
  ),
  employeeExperienceFeature(
    "employee_mandatory_training",
    "Treinamentos Obrigatórios do Colaborador",
    "Lista individual dos treinamentos obrigatórios, prazos, vencimentos, reciclagens e certificados vinculados.",
    ["Treinamentos obrigatórios", "Prazo", "Reciclagem", "Certificado"],
    ["Treinamento atribuído", "Notificação", "Conclusão", "Certificado", "Reciclagem"],
    ["Treinamentos Obrigatórios", "Cursos", "Certificados", "Dossiê"]
  ),
  employeeExperienceFeature(
    "employee_qualifications",
    "Qualificações e Habilitações",
    "Consulta individual de qualificações, habilitações, documentos comprobatórios, validade e situação cadastral.",
    ["Habilitações", "Validade", "Documentos", "Status"],
    ["Documento vinculado", "Validade controlada", "Dossiê atualizado", "Alerta quando aplicável"],
    ["Qualificações", "Dossiê", "Treinamentos"]
  ),
  employeeExperienceFeature(
    "employee_first_aid",
    "Primeiros Socorros do Colaborador",
    "Acesso a orientações, evidências e conteúdos relacionados a primeiros socorros e campanhas de prevenção.",
    ["Orientações", "Conteúdos", "Participação", "Evidências"],
    ["Conteúdo publicado", "Colaborador acessa", "Ciência registrada", "Histórico atualizado"],
    ["Primeiros Socorros", "Campanhas", "DDS"]
  ),
  employeeExperienceFeature(
    "employee_epi_epc",
    "Meu EPI/EPC",
    "Histórico individual de EPI/EPC recebidos, datas, quantidades, recibos, assinaturas e status de entrega.",
    ["Entregas individuais", "Recibos", "Assinaturas", "Histórico anual"],
    ["SESMT entrega", "Colaborador recebe", "Ciência registrada", "Dossiê atualizado"],
    ["EPI/EPC", "Biometria", "Dossiê", "Relatórios"]
  ),
  employeeExperienceFeature(
    "employee_dds",
    "Meu DDS",
    "Participação individual em DDS online, registro de presença, ciência, protocolo e histórico por período.",
    ["DDS online", "Presença", "Ciência", "Protocolo"],
    ["DDS publicado", "Colaborador participa", "Ciência registrada", "Indicador atualizado"],
    ["DDS Online", "CIPA", "Treinamentos", "Dossiê"]
  ),
  employeeExperienceFeature(
    "employee_vaccination",
    "Minhas Vacinas",
    "Comprovantes, convocações e histórico vacinal individual integrado às campanhas e controles de saúde.",
    ["Comprovantes", "Convocações", "Histórico", "Status"],
    ["Campanha aberta", "Colaborador convocado", "Comprovante vinculado", "Histórico atualizado"],
    ["Vacinação", "Campanhas", "Dossiê"]
  ),
  employeeExperienceFeature(
    "employee_leaves",
    "Meus Atestados e Afastamentos",
    "Área individual para consulta e acompanhamento de atestados, afastamentos, status e documentos vinculados.",
    ["Atestados", "Afastamentos", "Status", "Documentos"],
    ["Documento enviado", "Análise", "Status atualizado", "Histórico individual"],
    ["Atestados", "Afastamentos", "Dossiê"]
  ),
  employeeExperienceFeature(
    "employee_occupational_documents",
    "Documentos Ocupacionais",
    "Segunda via digital de requisições, ASOs, encaminhamentos e documentos ocupacionais ativos do colaborador.",
    ["Requisições ativas", "ASOs", "Encaminhamentos", "Documentos vigentes"],
    ["Documento emitido", "Vínculo individual", "Notificação", "Consulta segura"],
    ["Requisições", "ASO", "Central Médica", "SESMT", "Dossiê"]
  ),
  employeeExperienceFeature(
    "employee_certificates",
    "Certificados do Colaborador",
    "Central individual de certificados emitidos pela plataforma ou vinculados por integração com treinamentos.",
    ["Certificados", "Validade", "Download", "Histórico"],
    ["Curso concluído", "Certificado emitido", "Disponibilização", "Dossiê atualizado"],
    ["Cursos", "Treinamentos Obrigatórios", "Dossiê"]
  ),
  employeeExperienceFeature(
    "employee_surveys",
    "Pesquisas do Colaborador",
    "Acesso individual às pesquisas, questionários e avaliações permitidas ao colaborador, com controle por perfil.",
    ["Pesquisas", "Questionários", "Status", "Participação"],
    ["Pesquisa publicada", "Convocação", "Resposta", "Indicador agregado"],
    ["Pesquisas", "DRPS", "AEP", "Campanhas"]
  ),
  employeeExperienceFeature(
    "employee_campaigns",
    "Campanhas do Colaborador",
    "Comunicações, campanhas preventivas e ações internas organizadas no acesso individual do trabalhador.",
    ["Campanhas", "Comunicados", "Participação", "Histórico"],
    ["Campanha criada", "Público definido", "Colaborador acessa", "Resultado consolidado"],
    ["Campanhas", "Comunicações", "Saúde Preventiva"]
  ),
  employeeExperienceFeature(
    "employee_sipat",
    "SIPAT no Portal do Colaborador",
    "Participação em programação, conteúdos e evidências de SIPAT dentro do acesso individual.",
    ["Programação", "Conteúdos", "Participação", "Evidências"],
    ["SIPAT publicada", "Colaborador participa", "Presença registrada", "Relatório consolidado"],
    ["SIPAT", "CIPA", "Cursos", "Campanhas"]
  ),
  employeeExperienceFeature(
    "employee_cipa",
    "CIPA no Portal do Colaborador",
    "Acesso às comunicações, processos eleitorais, atas, convocações e conteúdos de CIPA aplicáveis ao trabalhador.",
    ["Comunicados", "Processo eleitoral", "Atas", "Participação"],
    ["Processo publicado", "Colaborador acessa", "Participação registrada", "Histórico atualizado"],
    ["CIPA", "Atas", "SIPAT", "Treinamentos"]
  ),
  employeeExperienceFeature(
    "employee_decompression",
    "Área de Descompressão",
    "Conteúdos e recursos de apoio ao bem-estar do colaborador, conectados às ações de saúde e engajamento.",
    ["Conteúdos", "Bem-estar", "Acesso individual", "Campanhas"],
    ["Conteúdo publicado", "Colaborador acessa", "Engajamento medido", "Campanha aprimorada"],
    ["Campanhas", "Saúde Preventiva", "Engajamento"]
  ),
  employeeExperienceFeature(
    "employee_ethics_channel",
    "Canal de Denúncia do Colaborador",
    "Acesso protegido ao canal de ética, acompanhamento de protocolo e comunicação segura conforme regras da empresa.",
    ["Relato protegido", "Protocolo", "Acompanhamento", "Rastreabilidade"],
    ["Relato criado", "Protocolo gerado", "Tratativa", "Registro preservado"],
    ["Canal de Ética", "Governança", "Auditoria"]
  ),
  employeeExperienceFeature(
    "employee_manual",
    "Manual do Usuário do Colaborador",
    "Orientações e artigos específicos para que o colaborador utilize os recursos liberados em seu perfil.",
    ["Artigos", "Vídeos", "Busca", "Orientações por perfil"],
    ["Artigo publicado", "Perfil relacionado", "Colaborador consulta", "Dúvida reduzida"],
    ["Manuais e Orientações", "Base de Conhecimento", "White Label"]
  ),
  employeeExperienceFeature(
    "employee_support",
    "Suporte ao Colaborador",
    "Canal de apoio para dúvidas operacionais, solicitações e acompanhamento de atendimento dentro da plataforma.",
    ["Solicitações", "Status", "Histórico", "Comunicação"],
    ["Solicitação aberta", "Triagem", "Resposta", "Conclusão"],
    ["Suporte", "Comunicações", "Dossiê"]
  ),
];

function sgqFeature(
  code: string,
  name: string,
  description: string,
  resources: string[],
  flow: string[],
  indicators: string[]
): PlatformFeatureManifestItem {
  return {
    code,
    version: "1.0.0",
    name,
    category: "SGQ - Gestão da Qualidade",
    pillarCode: "sgq_quality",
    moduleName: "Central SGQ",
    description,
    problem:
      "A gestão da qualidade costuma ficar dispersa entre planilhas, documentos soltos, evidências sem vínculo e controles paralelos.",
    objective:
      "Organizar a operação de qualidade em uma vertical própria, modular e integrada ao ecossistema comercial da plataforma.",
    benefits: [
      "Centraliza registros e evidências de qualidade.",
      "Mantém histórico e rastreabilidade por empresa.",
      "Permite operação SGQ independente da SST.",
      "Prepara a oferta comercial para clientes SGQ-only e White Labels.",
    ],
    resources,
    audience: ["Qualidade", "Diretoria", "RH", "Treinamento", "Auditores"],
    flow,
    integrations: ["Central SGQ", "Treinamentos", "Documentos", "Indicadores", "CRM", "White Label"],
    indicators,
    roles: ["gestor_qualidade", "qualidade", "treinamento", "rh", "admin", "company_admin", "admin_global", "super_admin"],
    route: "/admin/sgq",
    keywords: [code.replace(/_/g, " "), name.toLowerCase(), "sgq", "qualidade", "iso"],
    planNames: ["SGQ Start", "SGQ Business", "SGQ Enterprise"],
  };
}

const SGQ_FEATURES: PlatformFeatureManifestItem[] = [
  sgqFeature(
    "sgq_vertical",
    "Vertical SGQ Independente",
    "Produto próprio para gestão da qualidade, habilitado por cliente ou White Label sem obrigar contratação dos módulos de SST.",
    ["Habilitação por produto", "Perfis de qualidade", "Módulos independentes", "Planos comerciais SGQ"],
    ["Habilitar SGQ", "Configurar módulos", "Criar usuários", "Operar registros", "Acompanhar indicadores"],
    ["Clientes SGQ", "Módulos ativos", "Registros por status"]
  ),
  sgqFeature(
    "sgq_nonconformities",
    "Não Conformidades e Causa Raiz",
    "Controle de ocorrências, desvios, 5 porquês, Ishikawa, ações corretivas e acompanhamento até a conclusão.",
    ["Registro de NC", "Causa raiz", "Plano de ação", "Evidências", "Auditoria"],
    ["Ocorrência", "Análise", "Causa", "Ação", "Verificação", "Encerramento"],
    ["NC abertas", "NC vencidas", "Ações concluídas", "Recorrências"]
  ),
  sgqFeature(
    "sgq_document_process_control",
    "Documentos, Processos e Workflows SGQ",
    "Gestão de documentos, processos, fluxos de aprovação, revisão, vigência e biblioteca corporativa de qualidade.",
    ["Documentos controlados", "Processos", "Workflows", "Biblioteca", "Revisões"],
    ["Criar documento", "Revisar", "Aprovar", "Publicar", "Controlar vigência"],
    ["Documentos vigentes", "Revisões pendentes", "Processos mapeados"]
  ),
  sgqFeature(
    "sgq_audits_indicators",
    "Auditorias, Checklists e Indicadores SGQ",
    "Planejamento de auditorias, checklists, evidências, achados, indicadores e painel executivo da qualidade.",
    ["Auditorias", "Checklists", "Achados", "KPIs", "Dashboard executivo"],
    ["Planejar", "Executar checklist", "Registrar achados", "Gerar ações", "Medir indicadores"],
    ["Auditorias no prazo", "Achados", "Indicadores críticos", "Conformidade"]
  ),
  sgqFeature(
    "sgq_supplier_training",
    "Fornecedores, Treinamentos e Competências SGQ",
    "Controle de fornecedores, treinamentos corporativos, matriz de competências e evidências de capacitação da qualidade.",
    ["Fornecedores", "Treinamentos oficiais", "Matriz de competência", "Validade", "Evidências"],
    ["Cadastrar requisito", "Vincular público", "Treinar", "Evidenciar", "Reavaliar"],
    ["Fornecedores avaliados", "Treinamentos pendentes", "Competências vencidas"]
  ),
];

export const PLATFORM_FEATURE_MANIFEST: PlatformFeatureManifestItem[] = [
  ...EMPLOYEE_EXPERIENCE_FEATURES,
  ...SGQ_FEATURES,
  {
    code: "mandatory_training",
    version: "1.0.0",
    name: "Treinamentos Obrigatórios",
    category: "Conteúdo e Aprendizagem",
    pillarCode: "learning",
    moduleName: "Treinamentos Obrigatórios",
    description:
      "Centro corporativo para transformar cursos do Studio em capacitações obrigatórias com público, prazo, certificado, validade e reciclagem.",
    problem:
      "Cursos legais e corporativos são controlados em planilhas, sem cobrança escalonada, vínculo organizacional ou visão da chefia.",
    objective:
      "Direcionar cada capacitação ao público correto e acompanhar todo o ciclo até a conclusão, o certificado e a próxima reciclagem.",
    benefits: [
      "Atribui cursos por empresa, filial, setor, cargo, GSE ou colaborador.",
      "Centraliza prazos, pendências, vencimentos e certificados.",
      "Notifica por canal interno, e-mail e WhatsApp quando disponível.",
      "Integra o histórico de capacitação ao dossiê do colaborador.",
    ],
    resources: [
      "Cursos produzidos no Studio",
      "Público-alvo segmentado",
      "Prazos e reciclagens",
      "Gestão da equipe",
      "Certificados",
      "Relatórios e comunicações",
      "Perfil responsável por Treinamentos",
    ],
    audience: ["Treinamento", "RH", "SESMT", "Chefia", "Colaboradores"],
    flow: ["Studio", "Curso", "Público-alvo", "Prazo", "Comunicação", "Conclusão", "Certificado", "Reciclagem"],
    integrations: ["Studio", "Cursos", "Certificados", "Colaboradores", "GSE", "Dossiê", "Comunicações"],
    indicators: ["Atribuídos", "Concluídos", "Pendentes", "Vencidos", "Próximos do vencimento"],
    roles: ["treinamento", "rh", "sesmt", "chefia", "admin", "company_admin", "admin_global", "super_admin", "user"],
    route: "/treinamentos-obrigatorios",
    keywords: ["treinamento obrigatório", "curso", "reciclagem", "certificado", "prazo", "pendente", "lms"],
    planNames: ["Business", "Enterprise"],
  },
  {
    code: "pcd_management",
    version: "2.0.0",
    name: "Gestão de PCD",
    category: "Conformidade e Saúde",
    pillarCode: "occupational_health",
    moduleName: "Gestão de PCD",
    description:
      "Validação documental, enquadramento, auditoria e indicadores de pessoas com deficiência, integrados ao dossiê do colaborador.",
    problem:
      "Declarações e documentos de PCD ficam dispersos, sem distinguir cadastro, análise técnica e validação efetiva.",
    objective:
      "Transformar a gestão de PCD em um processo rastreável de identificação, análise, validação, acompanhamento e conformidade.",
    benefits: [
      "Distingue PCD declarado, em análise e validado.",
      "Mantém histórico completo de alterações e documentos.",
      "Consolida indicadores por filial, setor, cargo e tipo de deficiência.",
      "Sinaliza a condição validada no dossiê administrativo sem expor conteúdo clínico indevido.",
    ],
    resources: [
      "Avaliação editável com trilha de auditoria",
      "Documentos comprobatórios privados",
      "Status e revisão periódica",
      "Indicadores e estimativa de cota",
      "Integração com o dossiê",
    ],
    audience: ["RH", "SESMT", "Médico", "Administrador"],
    flow: ["Identificação", "Documentação", "Análise", "Validação", "Dossiê", "Indicadores"],
    integrations: ["Colaboradores", "Dossiê", "Central Médica", "Central de Conformidade", "Análise Personalizada"],
    indicators: ["PCDs declarados", "PCDs validados", "Pendências documentais", "Distribuição organizacional"],
    roles: ["rh", "sesmt", "medico", "admin", "company_admin", "admin_global", "super_admin"],
    route: "/admin/gestao-pcd",
    keywords: ["pcd", "deficiência", "cota", "laudo", "validação", "dossiê"],
    planNames: ["Business", "Enterprise"],
  },
  {
    code: "pca",
    version: "2.0.0",
    name: "PCA - Conservação Auditiva",
    category: "Conformidade e Saúde",
    pillarCode: "occupational_health",
    moduleName: "PCA",
    description:
      "Programa operacional conectado ao risco de ruído, audiometrias, acompanhamento médico, convocações e encaminhamentos.",
    problem:
      "Alterações audiométricas podem permanecer sem triagem, convocação e acompanhamento documentado.",
    objective:
      "Organizar a população exposta e o acompanhamento de resultados audiométricos sem automatizar diagnóstico ou decisão médica.",
    benefits: [
      "Identifica resultados que exigem revisão profissional.",
      "Organiza convocação, repetição e encaminhamento.",
      "Mantém histórico por colaborador, GSE, filial e setor.",
      "Entrega indicadores operacionais para prevenção e gestão.",
    ],
    resources: ["Sincronização de audiometrias", "Triagem", "Plano de acompanhamento", "Encaminhamentos", "Indicadores por GSE"],
    audience: ["SESMT", "Médico", "Administrador"],
    flow: ["Risco de ruído", "Audiometria", "Triagem", "Avaliação médica", "Acompanhamento", "Conclusão"],
    integrations: ["PGR", "GSE", "PCMSO", "Exames", "Central Médica", "CAT"],
    indicators: ["População exposta", "Alterações", "Repetições", "Encaminhamentos", "Pendências"],
    roles: ["sesmt", "medico", "admin", "company_admin", "admin_global", "super_admin"],
    route: "/admin/pca",
    keywords: ["pca", "audiometria", "ruído", "otorrino", "conservação auditiva"],
    planNames: ["Business", "Enterprise"],
  },
  {
    code: "clinic_portal",
    version: "1.0.0",
    name: "Portal de Clínicas Credenciadas",
    category: "Conformidade e Saúde",
    pillarCode: "integrations",
    moduleName: "Clínicas",
    description:
      "Integra requisições, atendimento, resultados, comprovantes e demonstrativos com clínicas externas credenciadas.",
    problem:
      "Requisições e resultados circulam por e-mail, planilhas e aplicativos sem visibilidade do andamento ou segregação adequada.",
    objective:
      "Conectar SESMT, clínica e colaborador em um fluxo individualizado e auditável.",
    benefits: ["Acompanhamento de status", "Segregação por encaminhamento", "Resultados com OCR assistivo", "Comprovação e faturamento"],
    resources: ["Perfil próprio", "Fila de requisições", "Upload de resultados", "Comprovante assinado", "Demonstrativo de atendimentos"],
    audience: ["Clínicas", "SESMT", "Colaboradores"],
    flow: ["Requisição", "Clínica", "Agendamento", "Atendimento", "Resultado", "Comprovante"],
    integrations: ["Requisições", "Exames", "Portal do Colaborador", "OCR", "Dossiê"],
    indicators: ["Requisições recebidas", "Atendimentos", "Resultados pendentes", "Comprovantes"],
    roles: ["sesmt", "admin", "company_admin", "admin_global", "super_admin"],
    route: "/admin/clinicas-credenciadas",
    keywords: ["clínica", "credenciado", "requisição", "resultado", "faturamento"],
    planNames: ["Enterprise"],
  },
  {
    code: "clinic_result_updates",
    version: "1.0.0",
    name: "Atualizações de Resultados da Clínica para o SESMT",
    category: "Integrações e Operação",
    pillarCode: "integrations",
    moduleName: "Atualizações SESMT x Médico",
    description:
      "Quando a clínica lança ou atualiza um resultado, o SESMT recebe uma atualização técnica com colaborador, exame, status, classificação e dados do prestador.",
    problem:
      "Resultados enviados por clínicas podem chegar sem aviso claro ao SESMT, dificultando acompanhamento, conferência e providências.",
    objective:
      "Transformar o lançamento de resultados pela clínica em uma atualização rastreável para o SESMT e, quando necessário, para o médico.",
    benefits: ["Aviso claro ao SESMT", "Identificação do colaborador", "Classificação do resultado", "Histórico de providências"],
    resources: ["Evento técnico", "Status da atualização", "Resumo do exame", "Dados da clínica", "Auditoria"],
    audience: ["SESMT", "Médico", "Clínicas"],
    flow: ["Clínica lança resultado", "Triagem técnica", "Atualização criada", "SESMT acompanha", "Providência registrada"],
    integrations: ["Portal de Clínicas", "Exames", "Atualizações SESMT x Médico", "Dossiê", "Central Médica"],
    indicators: ["Resultados recebidos", "Resultados pendentes de revisão", "Resultados alterados", "Providências"],
    roles: ["sesmt", "medico", "clinic", "admin", "company_admin", "super_admin"],
    route: "/admin/atualizacoes-tecnicas",
    keywords: ["clínica", "resultado", "sesmt", "médico", "atualização", "exame"],
    planNames: ["Enterprise"],
  },
  {
    code: "provider_contracts",
    version: "1.0.0",
    name: "Contratos de Prestadores, Clínicas e Terceiros",
    category: "Governança e Contratos",
    pillarCode: "governance",
    moduleName: "CRM Comercial",
    description:
      "Modelos e cláusulas-base para médicos, clínicas, laboratórios, consultores, terceiros e prestadores com acesso restrito à plataforma.",
    problem:
      "Prestadores externos precisam de regras claras de acesso, confidencialidade, lançamento de dados, rastreabilidade e revogação.",
    objective:
      "Apoiar a formalização jurídica de prestadores com contratos versionados, cláusulas reutilizáveis e histórico operacional.",
    benefits: ["Modelos por tipo de contrato", "Cláusulas reutilizáveis", "Revisão jurídica controlada", "Histórico de assinatura"],
    resources: ["Contrato de prestador", "Cláusulas LGPD", "Responsabilidade por dados", "Revogação de acesso", "Auditoria"],
    audience: ["SuperAdmin", "Comercial", "Jurídico", "White Label"],
    flow: ["Modelo", "Cláusulas", "Contrato", "Assinatura", "Histórico", "Revogação"],
    integrations: ["CRM", "Contratos", "Clínicas", "White Label", "Auditoria"],
    indicators: ["Contratos ativos", "Pendentes de assinatura", "Prestadores vinculados"],
    roles: ["company_admin", "admin_global", "super_admin"],
    route: "/super-admin/crm",
    keywords: ["contrato", "prestador", "clínica", "laboratório", "médico", "terceiro", "lgpd"],
    planNames: [],
  },
  {
    code: "occupational_exam_reference_library",
    version: "1.0.0",
    name: "Biblioteca Inicial de Exames Ocupacionais",
    category: "Conformidade e Saúde",
    pillarCode: "occupational_health",
    moduleName: "Catálogo de Exames",
    description:
      "Carga inicial de exames ocupacionais com tipo, periodicidade sugerida e orientação para parametrização de referências sob validação médica.",
    problem:
      "Empresas novas precisam cadastrar manualmente exames básicos antes de utilizar PCMSO, requisições, OCR e triagem de resultados.",
    objective:
      "Entregar uma biblioteca operacional inicial sem inventar valores clínicos, mantendo a revisão do médico responsável.",
    benefits: ["Reduz cadastro inicial", "Padroniza nomes", "Apoia OCR e PCMSO", "Mantém decisão técnica com o médico"],
    resources: ["Exames comuns", "Periodicidade padrão", "Orientação técnica", "Regras de referência versionadas"],
    audience: ["Médico", "SESMT", "Administrador"],
    flow: ["Biblioteca base", "Validação médica", "PCMSO", "Requisições", "Resultado", "Triagem"],
    integrations: ["Catálogo de Exames", "PCMSO", "Requisições", "OCR", "Central Médica"],
    indicators: ["Exames cadastrados", "Regras validadas", "Resultados triados", "Pendências médicas"],
    roles: ["medico", "sesmt", "admin", "company_admin", "super_admin"],
    route: "/admin/operacao-ocupacional",
    keywords: ["exame", "referência", "normal", "alterado", "ocr", "catálogo"],
    planNames: ["Business", "Enterprise"],
  },
  {
    code: "custom_analytics",
    version: "2.0.0",
    name: "Análise Personalizada e BI",
    category: "Tecnologia e Operações",
    pillarCode: "business_intelligence",
    moduleName: "Análises",
    description:
      "Construtor de métricas e relatórios que consome fontes estruturadas da plataforma com dimensões e filtros configuráveis.",
    problem:
      "Cada novo módulo exige relatórios isolados, aumentando o tempo de desenvolvimento e fragmentando a leitura dos dados.",
    objective:
      "Disponibilizar uma camada de BI reutilizável para que o usuário construa análises sem depender de um relatório novo por funcionalidade.",
    benefits: ["Métricas configuráveis", "Filtros organizacionais", "Consultas salvas", "Compartilhamento com a equipe"],
    resources: ["Fontes de dados", "Métricas", "Dimensões", "Filtros", "Gráficos e tabelas"],
    audience: ["RH", "SESMT", "Administradores", "Diretoria"],
    flow: ["Fonte", "Métrica", "Dimensão", "Filtros", "Visualização", "Análise salva"],
    integrations: ["PCD", "PCA", "Cursos", "Pesquisas", "Riscos", "Exames"],
    indicators: ["Métricas por filial", "Métricas por setor", "Evolução temporal", "Status operacionais"],
    roles: ["rh", "sesmt", "admin", "company_admin", "admin_global", "super_admin"],
    route: "/admin/analises",
    keywords: ["análise personalizada", "bi", "métrica", "relatório", "indicador"],
    planNames: ["Professional", "Business", "Enterprise"],
  },
  {
    code: "commercial_portfolio",
    version: "1.0.0",
    name: "Portfólio Comercial Vivo",
    category: "Tecnologia e Operações",
    pillarCode: "strategic_differentials",
    moduleName: "CRM Comercial",
    description:
      "Gera apresentações comerciais completas ou segmentadas a partir da fonte oficial de funcionalidades e da identidade de cada rede.",
    problem:
      "Apresentações manuais ficam desatualizadas e não refletem com segurança o produto disponível em cada White Label.",
    objective:
      "Transformar a plataforma em sua própria ferramenta de apresentação e conversão comercial.",
    benefits: ["Conteúdo sempre atualizado", "Seleção por pilar ou módulo", "Identidade White Label", "PDF pronto para reunião"],
    resources: ["Portfólio completo", "Portfólio personalizado", "Seleção por pilares", "PDF premium", "Modelos salvos"],
    audience: ["SuperAdmin", "SuperAdmin de rede", "Comercial"],
    flow: ["Selecionar escopo", "Revisar conteúdo", "Aplicar marca", "Gerar PDF", "Apresentar"],
    integrations: ["Catálogo", "Planos", "White Label", "Manual", "CRM"],
    indicators: ["Funcionalidades apresentadas", "Pilares selecionados", "Versão da base"],
    roles: ["company_admin", "super_admin"],
    route: "/super-admin/crm",
    keywords: ["portfólio", "comercial", "apresentação", "pdf", "white label"],
    planNames: [],
  },
  {
    code: "s2221_toxicological",
    version: "1.0.0",
    name: "S-2221 - Exame Toxicológico",
    category: "Conformidade e Saúde",
    pillarCode: "esocial",
    moduleName: "S-2221",
    description: "Gestão dos exames toxicológicos de motoristas profissionais empregados, validação cadastral e acompanhamento do evento no eSocial.",
    problem: "Exames, prazos e retornos do S-2221 ficam dispersos e podem ser transmitidos com dados cadastrais ou códigos inválidos.",
    objective: "Conferir o exame na origem, acompanhar pendências e manter rastreabilidade até o retorno do eSocial.",
    benefits: ["Validação do código oficial", "Indicadores clicáveis", "Prazo operacional", "Histórico de envio, erro e retorno"],
    resources: ["Cadastro do exame", "Motoristas profissionais", "Resultado interno restrito", "Conferência eSocial", "Central de Conformidade"],
    audience: ["SESMT", "Administrador"],
    flow: ["Funcionário", "Exame", "Validação", "Conferência", "Envio", "Retorno"],
    integrations: ["Colaboradores", "eSocial", "Central de Conformidade", "Auditoria"],
    indicators: ["Em dia", "Pendentes", "Aguardando resultado", "Pendentes de envio", "Rejeitados"],
    roles: ["sesmt", "admin", "company_admin", "admin_global", "super_admin"],
    route: "/admin/esocial/s2221",
    keywords: ["s-2221", "toxicológico", "motorista", "esocial", "laboratório", "código do exame"],
    planNames: ["Business", "Enterprise"],
  },
  {
    code: "biometric_identity",
    version: "1.0.0",
    name: "Identificação Biométrica PLUS",
    category: "Tecnologia e Operações",
    pillarCode: "technology",
    moduleName: "Identificação Biométrica",
    description: "Identificação e ciência eletrônica em processos ocupacionais com evidência, dispositivo, finalidade e governança própria.",
    problem: "Comprovações em papel geram retrabalho, armazenamento físico e dificuldade de demonstrar autoria e ciência.",
    objective: "Registrar evidências eletrônicas verificáveis sem armazenar a biometria bruta na aplicação.",
    benefits: ["Redução de papel", "Rastreabilidade", "Controle de equipamentos", "Governança LGPD", "Evidência por hash"],
    resources: ["Configuração por empresa", "Equipamentos", "Vínculos", "Revogação", "Retenção", "Histórico de evidências"],
    audience: ["SuperAdmin", "SESMT", "RH", "Administrador"],
    flow: ["Habilitação", "Governança", "Equipamento", "Vínculo", "Ciência", "Evidência", "Auditoria"],
    integrations: ["EPI/EPC", "ASO", "DDS", "Ordem de Serviço", "Treinamentos", "Documentos"],
    indicators: ["Equipamentos ativos", "Identificações ativas", "Evidências", "Retenções a revisar"],
    roles: ["sesmt", "rh", "admin", "company_admin", "admin_global", "super_admin"],
    route: "/admin/biometria",
    keywords: ["biometria", "assinatura", "ciência", "lgpd", "evidência", "epi"],
    planNames: ["Enterprise"],
  },
  {
    code: "white_label_course_library",
    version: "1.0.0",
    name: "Biblioteca White Label de Cursos",
    category: "Conteúdo e Aprendizagem",
    pillarCode: "learning",
    moduleName: "Biblioteca de Cursos",
    description: "Seleção, organização e distribuição de cursos oficiais pelo administrador da rede, sem acesso ao Estúdio estrutural.",
    problem: "Acesso irrestrito ao Estúdio mistura produção central com operação comercial das redes.",
    objective: "Separar a criação oficial da seleção e distribuição permitida a cada White Label.",
    benefits: ["Conteúdo oficial preservado", "Autonomia operacional", "Distribuição por cliente", "Histórico sem duplicação"],
    resources: ["Catálogo publicado", "Seleção da rede", "Título comercial", "Ordem", "Clientes autorizados"],
    audience: ["SuperAdmin da White Label"],
    flow: ["Curso oficial", "Seleção", "Organização", "Cliente autorizado", "Disponibilização"],
    integrations: ["Estúdio", "Cursos", "White Label", "Clientes", "Treinamentos Obrigatórios"],
    indicators: ["Cursos oficiais", "Cursos selecionados", "Clientes atendidos"],
    roles: ["company_admin"],
    route: "/rede/biblioteca-cursos",
    keywords: ["white label", "biblioteca", "curso", "studio", "distribuição"],
    planNames: ["Enterprise"],
  },
];
