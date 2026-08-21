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
  code: "2026.08.21-pgr-training-ecosystem",
  title: "Gestão documental do PGR e treinamentos corporativos obrigatórios",
  summary:
    "Evolui revisões do PGR, comunicação SESMT x Médico e cria o centro corporativo de treinamentos, certificados, prazos e reciclagens.",
};

export const PLATFORM_FEATURE_MANIFEST: PlatformFeatureManifestItem[] = [
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
];
