// /var/www/saudedotrabalho/client/src/data/healthCampaigns.ts
// Biblioteca / Central de Saúde Preventiva.
// Calendário anual completo (12 meses) de campanhas de conscientização +
// temas corporativos permanentes. Cada campanha é um "pacote" estratégico:
// e-mail template, cursos sugeridos, pesquisas rápidas, materiais (DDS/cartilha/
// banner/vídeo) e quiz de avaliação.
//
// Fluxo: o gestor SELECIONA o conteúdo desejado dentro da campanha e, se quiser,
// encaminha a seleção para /admin/campanhas?healthTemplate={id}&include=email,survey,course,material,quiz

export type SuggestedMaterial = {
  label: string;
  // tipo de peça — define o ícone/badge no detalhe
  type: "dds" | "cartilha" | "banner" | "video" | "infografico" | "comunicado";
};

export type SuggestedSurvey = {
  label: string;
  // tópico curto da pesquisa rápida (pulse)
  topic: string;
};

export type SuggestedQuiz = {
  label: string;
  questions: number;
};

export type HealthCampaignTemplate = {
  id: string;
  name: string;
  cause: string;
  month: number; // 1-12 ; 0 = permanente/corporativo
  monthLabel: string;
  colorHex: string;
  colorName: string;
  textOnColor: "white" | "dark";
  permanent?: boolean; // tema corporativo permanente (não atrelado a um mês)
  description: string;
  suggestedEmailSubject: string;
  suggestedEmailBody: string; // HTML curto
  suggestedActions: string[];
  suggestedCourseTopics: string[];
  suggestedSurveys: SuggestedSurvey[];
  suggestedMaterials: SuggestedMaterial[];
  suggestedQuiz: SuggestedQuiz;
};

export const HEALTH_CAMPAIGNS: HealthCampaignTemplate[] = [
  // ─────────────────────────────── JANEIRO ───────────────────────────────
  {
    id: "janeiro-branco",
    name: "Janeiro Branco",
    cause: "Saúde Mental",
    month: 1,
    monthLabel: "Janeiro",
    colorHex: "#F5F5F5",
    colorName: "Branco",
    textOnColor: "dark",
    description: "Movimento de conscientização sobre saúde mental e bem-estar emocional. Foco em prevenção, autocuidado e quebra de estigmas.",
    suggestedEmailSubject: "Janeiro Branco: cuide da sua saúde mental",
    suggestedEmailBody: "<h2 style=\"color:#444\">Janeiro Branco — Saúde Mental em primeiro lugar</h2><p>Este mês a Consultoria Saúde do Trabalho convida você a olhar para dentro. Saúde mental não é luxo, é base. Reservamos para você um curso curto e uma atividade de descompressão guiada.</p><ul><li>5 sinais de que sua mente pede uma pausa</li><li>Como pedir ajuda sem culpa</li><li>Respiração 4-7-8 (3 min)</li></ul><p>Você não está sozinho(a).</p>",
    suggestedActions: ["Disparar pesquisa de clima emocional", "Liberar trilha 'Saúde Mental no Trabalho'", "Agendar roda de conversa com psicólogo"],
    suggestedCourseTopics: ["Saúde mental no trabalho", "Sinais de burnout", "Pedir ajuda sem estigma"],
    suggestedSurveys: [
      { label: "Pulso de Clima Emocional", topic: "Como você tem se sentido nas últimas 2 semanas?" },
      { label: "Carga e Pausas", topic: "Você consegue fazer pausas durante o expediente?" },
    ],
    suggestedMaterials: [
      { label: "DDS: 5 sinais de alerta da mente", type: "dds" },
      { label: "Cartilha: Saúde Mental no Trabalho", type: "cartilha" },
      { label: "Banner mural: Você não está sozinho(a)", type: "banner" },
      { label: "Vídeo curto: Respiração 4-7-8", type: "video" },
    ],
    suggestedQuiz: { label: "Quiz: Mitos e verdades sobre saúde mental", questions: 6 },
  },
  {
    id: "janeiro-roxo",
    name: "Janeiro Roxo",
    cause: "Hanseníase",
    month: 1,
    monthLabel: "Janeiro",
    colorHex: "#6B21A8",
    colorName: "Roxo",
    textOnColor: "white",
    description: "Campanha de conscientização sobre a hanseníase: doença com cura, diagnóstico precoce e combate ao preconceito.",
    suggestedEmailSubject: "Janeiro Roxo: hanseníase tem cura — informação salva",
    suggestedEmailBody: "<h2 style=\"color:#6B21A8\">Janeiro Roxo — Hanseníase</h2><p>A hanseníase tem cura e o tratamento é gratuito pelo SUS. Conheça os sinais: manchas claras na pele com perda de sensibilidade, formigamento nas mãos e pés, força muscular reduzida.</p><p>Procure uma unidade de saúde ao primeiro sinal. Quanto mais cedo o diagnóstico, menores os impactos.</p>",
    suggestedActions: ["Enviar comunicado informativo", "Cartilha digital sobre sinais e sintomas"],
    suggestedCourseTopics: ["Hanseníase: mitos e verdades", "Sinais precoces"],
    suggestedSurveys: [
      { label: "Conhecimento sobre Hanseníase", topic: "Você sabe identificar os primeiros sinais da hanseníase?" },
    ],
    suggestedMaterials: [
      { label: "Cartilha: Sinais e sintomas da hanseníase", type: "cartilha" },
      { label: "Comunicado: Hanseníase tem cura", type: "comunicado" },
      { label: "Infográfico: Manchas que merecem atenção", type: "infografico" },
    ],
    suggestedQuiz: { label: "Quiz: Hanseníase — mitos e verdades", questions: 5 },
  },

  // ─────────────────────────────── FEVEREIRO ──────────────────────────────
  {
    id: "fevereiro-laranja",
    name: "Fevereiro Laranja",
    cause: "Leucemia",
    month: 2,
    monthLabel: "Fevereiro",
    colorHex: "#F97316",
    colorName: "Laranja",
    textOnColor: "white",
    description: "Conscientização sobre leucemia e a importância da doação de medula óssea para salvar vidas.",
    suggestedEmailSubject: "Fevereiro Laranja: você pode salvar uma vida",
    suggestedEmailBody: "<h2 style=\"color:#F97316\">Fevereiro Laranja — Combate à Leucemia</h2><p>1 em cada 100 mil pessoas precisa de um transplante de medula. Você pode ser a chance que falta. Cadastre-se no REDOME — é simples, rápido e indolor.</p><p>Doar medula é doar tempo. Doar tempo é doar vida.</p>",
    suggestedActions: ["Mutirão de cadastro REDOME", "Palestra com hematologista"],
    suggestedCourseTopics: ["Doação de medula óssea", "Leucemia: diagnóstico e tratamento"],
    suggestedSurveys: [
      { label: "Interesse em doar medula", topic: "Você já é cadastrado(a) no REDOME?" },
    ],
    suggestedMaterials: [
      { label: "Cartilha: Como se cadastrar no REDOME", type: "cartilha" },
      { label: "Banner: Doar medula é doar vida", type: "banner" },
      { label: "DDS: Leucemia e diagnóstico precoce", type: "dds" },
    ],
    suggestedQuiz: { label: "Quiz: Doação de medula óssea", questions: 5 },
  },
  {
    id: "fevereiro-roxo",
    name: "Fevereiro Roxo",
    cause: "Lúpus, Alzheimer e Fibromialgia",
    month: 2,
    monthLabel: "Fevereiro",
    colorHex: "#7C3AED",
    colorName: "Roxo",
    textOnColor: "white",
    description: "Conscientização sobre três doenças crônicas que afetam silenciosamente milhões: lúpus, Alzheimer e fibromialgia.",
    suggestedEmailSubject: "Fevereiro Roxo: dor invisível também é dor",
    suggestedEmailBody: "<h2 style=\"color:#7C3AED\">Fevereiro Roxo</h2><p>Lúpus, Alzheimer e Fibromialgia são doenças crônicas que afetam pessoas próximas a você — talvez sem você saber. O acolhimento começa pela informação.</p><p>Reconheça os sinais, respeite o ritmo, ofereça apoio.</p>",
    suggestedActions: ["Comunicado informativo", "Grupo de apoio interno"],
    suggestedCourseTopics: ["Doenças crônicas no trabalho", "Acolhimento de colegas com dor invisível"],
    suggestedSurveys: [
      { label: "Dor invisível no trabalho", topic: "Você convive com dor crônica que afeta seu dia a dia?" },
    ],
    suggestedMaterials: [
      { label: "Cartilha: Convivendo com doenças crônicas", type: "cartilha" },
      { label: "Comunicado: Dor invisível também é dor", type: "comunicado" },
      { label: "Infográfico: Lúpus, Alzheimer e Fibromialgia", type: "infografico" },
    ],
    suggestedQuiz: { label: "Quiz: Doenças crônicas e empatia", questions: 5 },
  },

  // ─────────────────────────────── MARÇO ──────────────────────────────────
  {
    id: "marco-azul-marinho",
    name: "Março Azul-Marinho",
    cause: "Câncer Colorretal",
    month: 3,
    monthLabel: "Março",
    colorHex: "#1E3A8A",
    colorName: "Azul-Marinho",
    textOnColor: "white",
    description: "Prevenção e diagnóstico precoce do câncer colorretal — um dos cânceres mais comuns e com alta taxa de cura quando detectado cedo.",
    suggestedEmailSubject: "Março Azul-Marinho: previna o câncer colorretal",
    suggestedEmailBody: "<h2 style=\"color:#1E3A8A\">Março Azul-Marinho</h2><p>O câncer colorretal é altamente curável quando detectado no início. A partir dos 45 anos (ou antes, se há histórico familiar), a colonoscopia salva vidas.</p><p>Alimentação rica em fibras, atividade física e exames regulares: a tríade que protege seu intestino.</p>",
    suggestedActions: ["Lembrete de check-up anual", "Campanha de alimentação saudável"],
    suggestedCourseTopics: ["Câncer colorretal: prevenção", "Alimentação e saúde intestinal"],
    suggestedSurveys: [
      { label: "Hábitos intestinais e exames", topic: "Há quanto tempo você não faz um check-up?" },
    ],
    suggestedMaterials: [
      { label: "DDS: Sinais de alerta do intestino", type: "dds" },
      { label: "Cartilha: Alimentação rica em fibras", type: "cartilha" },
      { label: "Banner: Cuide do seu intestino", type: "banner" },
    ],
    suggestedQuiz: { label: "Quiz: Prevenção do câncer colorretal", questions: 5 },
  },
  {
    id: "marco-lilas",
    name: "Março Lilás",
    cause: "Câncer de Colo de Útero e Endometriose",
    month: 3,
    monthLabel: "Março",
    colorHex: "#C084FC",
    colorName: "Lilás",
    textOnColor: "dark",
    description: "Conscientização sobre o câncer de colo do útero (prevenível com vacina HPV e Papanicolau) e sobre a endometriose, condição que afeta a saúde da mulher trabalhadora.",
    suggestedEmailSubject: "Março Lilás: saúde da mulher é prioridade o ano inteiro",
    suggestedEmailBody: "<h2 style=\"color:#9D4EDD\">Março Lilás — Saúde da Mulher</h2><p>O câncer de colo do útero é quase 100% prevenível com a vacina contra o HPV e o exame Papanicolau. A endometriose, que afeta 1 em cada 10 mulheres, exige diagnóstico e acolhimento.</p><p>Mulheres: agendem seus exames preventivos. Empresas: acolham e flexibilizem nas crises.</p>",
    suggestedActions: ["Lembrete de Papanicolau e vacina HPV", "Sensibilizar lideranças sobre endometriose"],
    suggestedCourseTopics: ["Saúde da mulher no trabalho", "Endometriose e produtividade"],
    suggestedSurveys: [
      { label: "Saúde da mulher", topic: "Você está com seus exames preventivos em dia?" },
    ],
    suggestedMaterials: [
      { label: "Cartilha: Prevenção do câncer de colo de útero", type: "cartilha" },
      { label: "Infográfico: Endometriose — sinais e direitos", type: "infografico" },
      { label: "Comunicado: Saúde da mulher trabalhadora", type: "comunicado" },
    ],
    suggestedQuiz: { label: "Quiz: HPV, Papanicolau e endometriose", questions: 6 },
  },

  // ─────────────────────────────── ABRIL ──────────────────────────────────
  {
    id: "abril-verde",
    name: "Abril Verde",
    cause: "Saúde e Segurança no Trabalho",
    month: 4,
    monthLabel: "Abril",
    colorHex: "#22C55E",
    colorName: "Verde",
    textOnColor: "white",
    description: "Mês mundial da Segurança e Saúde no Trabalho (28/04). Prevenção de acidentes e doenças ocupacionais, valorização da CIPA e da cultura de segurança.",
    suggestedEmailSubject: "Abril Verde: segurança no trabalho é compromisso de todos",
    suggestedEmailBody: "<h2 style=\"color:#16A34A\">Abril Verde — Saúde e Segurança no Trabalho</h2><p>28 de abril é o Dia Mundial em Memória das Vítimas de Acidentes de Trabalho. Cada acidente é evitável. Use o EPI, respeite os procedimentos, reporte condições inseguras e cuide do colega ao lado.</p><p>Segurança não é regra: é cultura.</p>",
    suggestedActions: ["Semana Interna de Prevenção (SIPAT)", "Inspeção de segurança com a CIPA", "Reforço de uso de EPI"],
    suggestedCourseTopics: ["Cultura de segurança", "Uso correto de EPIs", "Prevenção de acidentes"],
    suggestedSurveys: [
      { label: "Percepção de Segurança", topic: "Você se sente seguro(a) no seu posto de trabalho?" },
      { label: "Quase-acidentes", topic: "Você já presenciou uma situação de quase-acidente?" },
    ],
    suggestedMaterials: [
      { label: "DDS: 10 atitudes que evitam acidentes", type: "dds" },
      { label: "Cartilha: Uso correto de EPIs", type: "cartilha" },
      { label: "Banner: Segurança é cultura", type: "banner" },
      { label: "Vídeo: Abril Verde — memória e prevenção", type: "video" },
    ],
    suggestedQuiz: { label: "Quiz: Segurança no trabalho e EPIs", questions: 8 },
  },
  {
    id: "abril-azul",
    name: "Abril Azul",
    cause: "Autismo",
    month: 4,
    monthLabel: "Abril",
    colorHex: "#3B82F6",
    colorName: "Azul",
    textOnColor: "white",
    description: "Conscientização sobre o Transtorno do Espectro Autista (TEA): inclusão, respeito às diferenças e direitos.",
    suggestedEmailSubject: "Abril Azul: cada pessoa, um universo",
    suggestedEmailBody: "<h2 style=\"color:#3B82F6\">Abril Azul — Conscientização sobre o Autismo</h2><p>O autismo é um espectro: cada pessoa autista é única. Inclusão começa por ouvir, respeitar tempos diferentes e remover barreiras de comunicação.</p><p>Você convive com pessoas autistas todos os dias — colegas, familiares, clientes. Aprenda a acolher.</p>",
    suggestedActions: ["Treinamento em neurodiversidade no trabalho", "Revisão de práticas inclusivas"],
    suggestedCourseTopics: ["TEA no ambiente de trabalho", "Inclusão e neurodiversidade"],
    suggestedSurveys: [
      { label: "Inclusão e neurodiversidade", topic: "Nossa empresa é um ambiente inclusivo para pessoas neurodivergentes?" },
    ],
    suggestedMaterials: [
      { label: "Cartilha: Neurodiversidade no trabalho", type: "cartilha" },
      { label: "Comunicado: Cada pessoa, um universo", type: "comunicado" },
      { label: "Infográfico: Como acolher colegas autistas", type: "infografico" },
    ],
    suggestedQuiz: { label: "Quiz: Autismo e inclusão", questions: 5 },
  },

  // ─────────────────────────────── MAIO ───────────────────────────────────
  {
    id: "maio-amarelo",
    name: "Maio Amarelo",
    cause: "Segurança no Trânsito",
    month: 5,
    monthLabel: "Maio",
    colorHex: "#FACC15",
    colorName: "Amarelo",
    textOnColor: "dark",
    description: "Movimento mundial pela vida no trânsito. Conscientização sobre direção segura, álcool zero e respeito às leis.",
    suggestedEmailSubject: "Maio Amarelo: sua vida vale mais que qualquer pressa",
    suggestedEmailBody: "<h2 style=\"color:#CA8A04\">Maio Amarelo — Vida no Trânsito</h2><p>A cada hora, 4 pessoas morrem em acidentes de trânsito no Brasil. Direção defensiva, uso do cinto, capacete, álcool zero e celular guardado: regras simples que salvam vidas.</p><p>Chegue bem. Seus colegas e sua família te esperam.</p>",
    suggestedActions: ["Treinamento de direção defensiva", "Lembretes nos veículos da frota"],
    suggestedCourseTopics: ["Direção defensiva", "Riscos no deslocamento casa-trabalho"],
    suggestedSurveys: [
      { label: "Deslocamento seguro", topic: "Como você avalia sua segurança no trajeto casa-trabalho?" },
    ],
    suggestedMaterials: [
      { label: "DDS: Direção defensiva em 5 minutos", type: "dds" },
      { label: "Banner: Sua vida vale mais que a pressa", type: "banner" },
      { label: "Adesivo de frota: Álcool zero", type: "comunicado" },
    ],
    suggestedQuiz: { label: "Quiz: Segurança no trânsito", questions: 6 },
  },
  {
    id: "maio-vermelho",
    name: "Maio Vermelho",
    cause: "Hepatites Virais",
    month: 5,
    monthLabel: "Maio",
    colorHex: "#DC2626",
    colorName: "Vermelho",
    textOnColor: "white",
    description: "Combate às hepatites virais (A, B, C, D, E). Diagnóstico precoce, vacinação e tratamento gratuito pelo SUS.",
    suggestedEmailSubject: "Maio Vermelho: hepatite tem cura — faça o teste",
    suggestedEmailBody: "<h2 style=\"color:#DC2626\">Maio Vermelho — Hepatites Virais</h2><p>Existe vacina contra hepatite A e B. A hepatite C tem cura. Mas só descobre quem testa. O exame é simples e gratuito no SUS.</p><p>Cheque sua carteira de vacinação. Faça o teste rápido.</p>",
    suggestedActions: ["Verificação de vacinação", "Mutirão de teste rápido"],
    suggestedCourseTopics: ["Hepatites: prevenção", "Vacinação do adulto"],
    suggestedSurveys: [
      { label: "Carteira de vacinação", topic: "Você sabe se sua vacinação está em dia?" },
    ],
    suggestedMaterials: [
      { label: "Cartilha: Hepatites A, B, C, D e E", type: "cartilha" },
      { label: "Comunicado: Faça o teste rápido", type: "comunicado" },
      { label: "Infográfico: Vacinação do adulto", type: "infografico" },
    ],
    suggestedQuiz: { label: "Quiz: Hepatites virais", questions: 5 },
  },

  // ─────────────────────────────── JUNHO ──────────────────────────────────
  {
    id: "junho-verde",
    name: "Junho Verde",
    cause: "Conscientização Ambiental e Saúde",
    month: 6,
    monthLabel: "Junho",
    colorHex: "#16A34A",
    colorName: "Verde",
    textOnColor: "white",
    description: "Mês do Meio Ambiente (05/06). Conexão entre meio ambiente saudável, sustentabilidade e qualidade de vida no trabalho.",
    suggestedEmailSubject: "Junho Verde: ambiente saudável, pessoas saudáveis",
    suggestedEmailBody: "<h2 style=\"color:#16A34A\">Junho Verde — Meio Ambiente e Saúde</h2><p>Um planeta saudável é a base de uma vida saudável. Pequenas atitudes no trabalho — economizar energia, reduzir resíduos, descartar corretamente — protegem a saúde de todos.</p><p>Sustentabilidade também é saúde ocupacional.</p>",
    suggestedActions: ["Mutirão de coleta seletiva", "Desafio de redução de resíduos", "Plantio simbólico"],
    suggestedCourseTopics: ["Sustentabilidade no trabalho", "Saúde ambiental e ocupacional"],
    suggestedSurveys: [
      { label: "Práticas sustentáveis", topic: "Nossa empresa adota boas práticas ambientais?" },
    ],
    suggestedMaterials: [
      { label: "DDS: Descarte correto de resíduos", type: "dds" },
      { label: "Banner: Ambiente saudável, pessoas saudáveis", type: "banner" },
      { label: "Cartilha: Coleta seletiva no trabalho", type: "cartilha" },
    ],
    suggestedQuiz: { label: "Quiz: Sustentabilidade e saúde", questions: 5 },
  },
  {
    id: "junho-vermelho",
    name: "Junho Vermelho",
    cause: "Doação de Sangue",
    month: 6,
    monthLabel: "Junho",
    colorHex: "#B91C1C",
    colorName: "Vermelho",
    textOnColor: "white",
    description: "Incentivo à doação de sangue. Uma bolsa pode salvar até 4 vidas. Em junho, os estoques caem por causa do frio.",
    suggestedEmailSubject: "Junho Vermelho: uma hora sua, 4 vidas salvas",
    suggestedEmailBody: "<h2 style=\"color:#B91C1C\">Junho Vermelho — Doe Sangue</h2><p>Uma única doação pode salvar até 4 vidas. O processo leva menos de 1 hora, não dói e seu corpo repõe tudo em poucos dias. Os estoques caem no inverno — sua doação importa AGORA.</p>",
    suggestedActions: ["Folga remunerada para doadores", "Carona coletiva ao hemocentro"],
    suggestedCourseTopics: ["Doação de sangue: mitos", "Quem pode doar"],
    suggestedSurveys: [
      { label: "Doação de sangue", topic: "Você doaria sangue se a empresa organizasse uma ação?" },
    ],
    suggestedMaterials: [
      { label: "Cartilha: Quem pode doar sangue", type: "cartilha" },
      { label: "Banner: Uma hora sua, 4 vidas salvas", type: "banner" },
      { label: "Comunicado: Mutirão no hemocentro", type: "comunicado" },
    ],
    suggestedQuiz: { label: "Quiz: Doação de sangue — mitos e verdades", questions: 5 },
  },

  // ─────────────────────────────── JULHO ──────────────────────────────────
  {
    id: "julho-verde",
    name: "Julho Verde",
    cause: "Câncer de Cabeça e Pescoço",
    month: 7,
    monthLabel: "Julho",
    colorHex: "#15803D",
    colorName: "Verde",
    textOnColor: "white",
    description: "Prevenção dos cânceres de cabeça e pescoço (boca, laringe, faringe, tireoide). Tabagismo e álcool são os maiores fatores de risco.",
    suggestedEmailSubject: "Julho Verde: previna o câncer de cabeça e pescoço",
    suggestedEmailBody: "<h2 style=\"color:#15803D\">Julho Verde — Câncer de Cabeça e Pescoço</h2><p>Feridas na boca que não cicatrizam, rouquidão persistente por mais de 15 dias e caroços no pescoço merecem atenção médica. Tabagismo e álcool multiplicam o risco.</p><p>Visite o dentista, faça autoexame da boca e reduza fatores de risco.</p>",
    suggestedActions: ["Campanha antitabagismo", "Comunicado sobre autoexame da boca"],
    suggestedCourseTopics: ["Câncer de cabeça e pescoço", "Tabagismo: como parar"],
    suggestedSurveys: [
      { label: "Tabagismo", topic: "Você gostaria de apoio para parar de fumar?" },
    ],
    suggestedMaterials: [
      { label: "DDS: Autoexame da boca", type: "dds" },
      { label: "Cartilha: Câncer de cabeça e pescoço", type: "cartilha" },
      { label: "Banner: Rouquidão por +15 dias? Investigue", type: "banner" },
    ],
    suggestedQuiz: { label: "Quiz: Câncer de cabeça e pescoço", questions: 5 },
  },
  {
    id: "julho-amarelo",
    name: "Julho Amarelo",
    cause: "Câncer Ósseo e Hepatites Virais",
    month: 7,
    monthLabel: "Julho",
    colorHex: "#EAB308",
    colorName: "Amarelo",
    textOnColor: "dark",
    description: "Conscientização sobre cânceres ósseos (sarcomas) e reforço às hepatites virais — Dia Mundial em 28/07.",
    suggestedEmailSubject: "Julho Amarelo: hepatites e câncer ósseo",
    suggestedEmailBody: "<h2 style=\"color:#CA8A04\">Julho Amarelo</h2><p>Dores ósseas persistentes não são 'coisa da idade'. Sarcomas afetam jovens. E 28/07 é o Dia Mundial das Hepatites — teste rápido e vacina protegem você.</p>",
    suggestedActions: ["Comunicado sobre dores persistentes", "Reforço de vacinação"],
    suggestedCourseTopics: ["Dor crônica vs alerta", "Hepatites virais"],
    suggestedSurveys: [
      { label: "Dores persistentes", topic: "Você sente dores ósseas que não passam?" },
    ],
    suggestedMaterials: [
      { label: "DDS: Quando a dor é sinal de alerta", type: "dds" },
      { label: "Comunicado: 28/07 Dia Mundial das Hepatites", type: "comunicado" },
      { label: "Infográfico: Sarcomas — sinais", type: "infografico" },
    ],
    suggestedQuiz: { label: "Quiz: Câncer ósseo e hepatites", questions: 5 },
  },

  // ─────────────────────────────── AGOSTO ─────────────────────────────────
  {
    id: "agosto-laranja",
    name: "Agosto Laranja",
    cause: "Esclerose Múltipla",
    month: 8,
    monthLabel: "Agosto",
    colorHex: "#EA580C",
    colorName: "Laranja",
    textOnColor: "white",
    description: "Conscientização sobre a esclerose múltipla, doença neurológica crônica que afeta adultos jovens em idade produtiva. Foco em diagnóstico precoce e inclusão.",
    suggestedEmailSubject: "Agosto Laranja: esclerose múltipla — conhecer é acolher",
    suggestedEmailBody: "<h2 style=\"color:#EA580C\">Agosto Laranja — Esclerose Múltipla</h2><p>A esclerose múltipla afeta principalmente adultos jovens. Fadiga intensa, formigamentos, alterações de visão e equilíbrio são alguns sinais. Com tratamento, a maioria mantém vida ativa e produtiva.</p><p>No trabalho, flexibilidade e empatia fazem toda a diferença.</p>",
    suggestedActions: ["Comunicado informativo", "Revisar políticas de flexibilidade"],
    suggestedCourseTopics: ["Esclerose múltipla no trabalho", "Inclusão de pessoas com doenças neurológicas"],
    suggestedSurveys: [
      { label: "Acolhimento de doenças crônicas", topic: "Nossa empresa acolhe quem tem condições crônicas?" },
    ],
    suggestedMaterials: [
      { label: "Cartilha: Esclerose múltipla — o que é", type: "cartilha" },
      { label: "Comunicado: Conhecer é acolher", type: "comunicado" },
      { label: "Infográfico: Sinais da esclerose múltipla", type: "infografico" },
    ],
    suggestedQuiz: { label: "Quiz: Esclerose múltipla", questions: 5 },
  },
  {
    id: "agosto-dourado",
    name: "Agosto Dourado",
    cause: "Aleitamento Materno",
    month: 8,
    monthLabel: "Agosto",
    colorHex: "#D4A017",
    colorName: "Dourado",
    textOnColor: "white",
    description: "Promoção do aleitamento materno como padrão-ouro de nutrição infantil. Apoio às mães trabalhadoras.",
    suggestedEmailSubject: "Agosto Dourado: amamentar é um direito, apoiar é dever de todos",
    suggestedEmailBody: "<h2 style=\"color:#D4A017\">Agosto Dourado — Aleitamento Materno</h2><p>O leite materno é o melhor alimento até os 6 meses. Mães que voltam ao trabalho têm direito a 2 pausas de 30 minutos por dia para amamentar ou ordenhar, até o bebê completar 6 meses.</p><p>Sua empresa apoia? Compartilhe nossa sala de apoio à amamentação.</p>",
    suggestedActions: ["Divulgar sala de amamentação", "Roda de conversa com mães"],
    suggestedCourseTopics: ["Direitos da mãe trabalhadora", "Retorno ao trabalho pós-licença"],
    suggestedSurveys: [
      { label: "Apoio à maternidade", topic: "A empresa oferece condições adequadas para mães lactantes?" },
    ],
    suggestedMaterials: [
      { label: "Cartilha: Direitos da mãe lactante", type: "cartilha" },
      { label: "Banner: Sala de apoio à amamentação", type: "banner" },
      { label: "Comunicado: Amamentar é um direito", type: "comunicado" },
    ],
    suggestedQuiz: { label: "Quiz: Aleitamento e direitos", questions: 5 },
  },
  {
    id: "agosto-lilas",
    name: "Agosto Lilás",
    cause: "Combate à Violência contra a Mulher",
    month: 8,
    monthLabel: "Agosto",
    colorHex: "#9D4EDD",
    colorName: "Lilás",
    textOnColor: "white",
    description: "Mês da Lei Maria da Penha (07/08). Combate à violência contra a mulher e divulgação de canais de denúncia e acolhimento.",
    suggestedEmailSubject: "Agosto Lilás: respeito não tem exceção",
    suggestedEmailBody: "<h2 style=\"color:#9D4EDD\">Agosto Lilás — Não à Violência contra a Mulher</h2><p>A Lei Maria da Penha completa mais um ano. Violência não é só física: é também psicológica, moral, patrimonial e sexual. Denuncie pelo 180 (Central de Atendimento à Mulher).</p><p>No trabalho, acolha. Em casa, proteja. Em todo lugar, respeite.</p>",
    suggestedActions: ["Divulgação do canal 180", "Treinamento sobre assédio e respeito"],
    suggestedCourseTopics: ["Respeito e combate ao assédio", "Violência contra a mulher: como ajudar"],
    suggestedSurveys: [
      { label: "Ambiente de respeito", topic: "Você se sente respeitado(a) no ambiente de trabalho?" },
    ],
    suggestedMaterials: [
      { label: "Cartilha: Tipos de violência e o canal 180", type: "cartilha" },
      { label: "Banner: Respeito não tem exceção", type: "banner" },
      { label: "Comunicado: Lei Maria da Penha", type: "comunicado" },
    ],
    suggestedQuiz: { label: "Quiz: Respeito e combate à violência", questions: 6 },
  },

  // ─────────────────────────────── SETEMBRO ───────────────────────────────
  {
    id: "setembro-amarelo",
    name: "Setembro Amarelo",
    cause: "Prevenção ao Suicídio",
    month: 9,
    monthLabel: "Setembro",
    colorHex: "#FACC15",
    colorName: "Amarelo",
    textOnColor: "dark",
    description: "Campanha nacional de prevenção ao suicídio. Falar sobre o tema salva vidas. CVV: 188.",
    suggestedEmailSubject: "Setembro Amarelo: falar é a melhor solução",
    suggestedEmailBody: "<h2 style=\"color:#CA8A04\">Setembro Amarelo — Prevenção ao Suicídio</h2><p>9 em cada 10 suicídios podem ser evitados. Se você ou alguém próximo está em sofrimento, fale. Ligue 188 (CVV — 24h, gratuito, sigiloso) ou procure um CAPS.</p><p>Sua dor importa. Sua vida importa.</p>",
    suggestedActions: ["Roda de conversa sobre saúde mental", "Divulgação canal CVV 188", "Treinamento de gestores em sinais de alerta"],
    suggestedCourseTopics: ["Prevenção ao suicídio", "Sinais de alerta em colegas", "Como acolher quem sofre"],
    suggestedSurveys: [
      { label: "Pulso de bem-estar", topic: "Como está seu bem-estar emocional este mês?" },
      { label: "Rede de apoio", topic: "Você saberia para onde encaminhar um colega em sofrimento?" },
    ],
    suggestedMaterials: [
      { label: "DDS: Como acolher um colega em sofrimento", type: "dds" },
      { label: "Cartilha: Sinais de alerta e o CVV 188", type: "cartilha" },
      { label: "Banner: Falar é a melhor solução", type: "banner" },
      { label: "Vídeo: Setembro Amarelo — você não está sozinho", type: "video" },
    ],
    suggestedQuiz: { label: "Quiz: Prevenção ao suicídio e acolhimento", questions: 6 },
  },
  {
    id: "setembro-vermelho",
    name: "Setembro Vermelho",
    cause: "Saúde do Coração",
    month: 9,
    monthLabel: "Setembro",
    colorHex: "#DC2626",
    colorName: "Vermelho",
    textOnColor: "white",
    description: "Prevenção de doenças cardiovasculares — principal causa de morte no Brasil. Dia Mundial em 29/09.",
    suggestedEmailSubject: "Setembro Vermelho: seu coração merece atenção",
    suggestedEmailBody: "<h2 style=\"color:#DC2626\">Setembro Vermelho — Saúde do Coração</h2><p>Doenças cardiovasculares matam mais que qualquer outra causa no Brasil. Medir pressão, controlar colesterol, mexer o corpo 30min/dia, parar de fumar e reduzir o sal são atitudes que salvam.</p><p>Marque seu check-up cardiovascular ainda este mês.</p>",
    suggestedActions: ["Aferição de pressão no local", "Desafio de caminhada"],
    suggestedCourseTopics: ["Saúde cardiovascular no trabalho", "Estresse e coração"],
    suggestedSurveys: [
      { label: "Hábitos cardiovasculares", topic: "Quantos dias por semana você se exercita?" },
    ],
    suggestedMaterials: [
      { label: "DDS: Pressão arterial sob controle", type: "dds" },
      { label: "Cartilha: 5 atitudes pelo seu coração", type: "cartilha" },
      { label: "Banner: Desafio da caminhada", type: "banner" },
    ],
    suggestedQuiz: { label: "Quiz: Saúde do coração", questions: 6 },
  },

  // ─────────────────────────────── OUTUBRO ────────────────────────────────
  {
    id: "outubro-rosa",
    name: "Outubro Rosa",
    cause: "Câncer de Mama",
    month: 10,
    monthLabel: "Outubro",
    colorHex: "#EC4899",
    colorName: "Rosa",
    textOnColor: "white",
    description: "Movimento internacional de prevenção e diagnóstico precoce do câncer de mama. Autoexame mensal e mamografia anual a partir dos 40.",
    suggestedEmailSubject: "Outubro Rosa: o autocuidado começa em você",
    suggestedEmailBody: "<h2 style=\"color:#EC4899\">Outubro Rosa — Câncer de Mama</h2><p>O câncer de mama tem mais de 95% de chance de cura quando detectado cedo. O autoexame mensal é gratuito e leva 5 minutos. A mamografia anual a partir dos 40 anos salva vidas.</p><p>Cuide de você. Lembre uma amiga. Compartilhe informação.</p>",
    suggestedActions: ["Mutirão de mamografia", "Palestra com mastologista", "Iluminação de rosa do prédio"],
    suggestedCourseTopics: ["Autoexame da mama", "Câncer de mama: prevenção"],
    suggestedSurveys: [
      { label: "Exames preventivos da mulher", topic: "Você está com a mamografia / exames em dia?" },
    ],
    suggestedMaterials: [
      { label: "DDS: Como fazer o autoexame da mama", type: "dds" },
      { label: "Cartilha: Câncer de mama — prevenção", type: "cartilha" },
      { label: "Banner: O autocuidado começa em você", type: "banner" },
      { label: "Vídeo: Outubro Rosa", type: "video" },
    ],
    suggestedQuiz: { label: "Quiz: Câncer de mama e autoexame", questions: 6 },
  },
  {
    id: "outubro-verde",
    name: "Outubro Verde",
    cause: "Paralisia Cerebral e Inclusão",
    month: 10,
    monthLabel: "Outubro",
    colorHex: "#16A34A",
    colorName: "Verde",
    textOnColor: "white",
    description: "Conscientização sobre paralisia cerebral e inclusão de pessoas com deficiência no ambiente de trabalho. Dia Mundial em 06/10.",
    suggestedEmailSubject: "Outubro Verde: inclusão é para todos",
    suggestedEmailBody: "<h2 style=\"color:#16A34A\">Outubro Verde — Inclusão</h2><p>A paralisia cerebral não é doença e não é contagiosa: é uma condição que afeta o movimento. Pessoas com deficiência têm muito a contribuir — basta remover as barreiras.</p><p>Acessibilidade, respeito e oportunidades reais: isso é inclusão.</p>",
    suggestedActions: ["Revisar acessibilidade do ambiente", "Treinamento sobre inclusão de PCD"],
    suggestedCourseTopics: ["Inclusão de PCD no trabalho", "Acessibilidade e respeito"],
    suggestedSurveys: [
      { label: "Acessibilidade", topic: "Nosso ambiente é acessível para pessoas com deficiência?" },
    ],
    suggestedMaterials: [
      { label: "Cartilha: Inclusão de PCD no trabalho", type: "cartilha" },
      { label: "Comunicado: Inclusão é para todos", type: "comunicado" },
      { label: "Infográfico: Mitos sobre paralisia cerebral", type: "infografico" },
    ],
    suggestedQuiz: { label: "Quiz: Inclusão e acessibilidade", questions: 5 },
  },

  // ─────────────────────────────── NOVEMBRO ───────────────────────────────
  {
    id: "novembro-azul",
    name: "Novembro Azul",
    cause: "Câncer de Próstata e Saúde do Homem",
    month: 11,
    monthLabel: "Novembro",
    colorHex: "#1D4ED8",
    colorName: "Azul",
    textOnColor: "white",
    description: "Conscientização sobre prevenção e diagnóstico precoce do câncer de próstata. Quebra do tabu masculino sobre o exame.",
    suggestedEmailSubject: "Novembro Azul: cuidar de si é coisa de homem",
    suggestedEmailBody: "<h2 style=\"color:#1D4ED8\">Novembro Azul — Câncer de Próstata</h2><p>1 em cada 8 homens terá câncer de próstata. Detectado cedo, tem mais de 90% de chance de cura. A partir dos 50 (ou 45 se há histórico familiar), o exame é fundamental.</p><p>Vá ao urologista. Cuidar da saúde não diminui ninguém.</p>",
    suggestedActions: ["Palestra com urologista", "Comunicado de check-up masculino"],
    suggestedCourseTopics: ["Saúde do homem", "Câncer de próstata: mitos"],
    suggestedSurveys: [
      { label: "Saúde do homem", topic: "Há quanto tempo você não vai ao médico?" },
    ],
    suggestedMaterials: [
      { label: "DDS: Saúde do homem — quebrando tabus", type: "dds" },
      { label: "Cartilha: Câncer de próstata — mitos e verdades", type: "cartilha" },
      { label: "Banner: Cuidar de si é coisa de homem", type: "banner" },
    ],
    suggestedQuiz: { label: "Quiz: Saúde do homem", questions: 5 },
  },
  {
    id: "novembro-laranja",
    name: "Novembro Laranja",
    cause: "Diabetes",
    month: 11,
    monthLabel: "Novembro",
    colorHex: "#F97316",
    colorName: "Laranja",
    textOnColor: "white",
    description: "Conscientização sobre o diabetes (Dia Mundial em 14/11). Prevenção, controle glicêmico e hábitos saudáveis.",
    suggestedEmailSubject: "Novembro Laranja: diabetes sob controle, vida em dia",
    suggestedEmailBody: "<h2 style=\"color:#F97316\">Novembro Laranja — Diabetes</h2><p>O diabetes tipo 2 pode ser prevenido com alimentação equilibrada, atividade física e controle do peso. Sede excessiva, cansaço e vontade frequente de urinar são sinais de alerta.</p><p>Faça o exame de glicemia. Conhecer seus números é o primeiro passo.</p>",
    suggestedActions: ["Aferição de glicemia no local", "Campanha de alimentação saudável"],
    suggestedCourseTopics: ["Diabetes: prevenção e controle", "Alimentação saudável no trabalho"],
    suggestedSurveys: [
      { label: "Risco de diabetes", topic: "Você conhece seus níveis de glicemia?" },
    ],
    suggestedMaterials: [
      { label: "DDS: Sinais de alerta do diabetes", type: "dds" },
      { label: "Cartilha: Prevenção do diabetes tipo 2", type: "cartilha" },
      { label: "Banner: Conheça seus números", type: "banner" },
    ],
    suggestedQuiz: { label: "Quiz: Diabetes — prevenção e controle", questions: 6 },
  },

  // ─────────────────────────────── DEZEMBRO ───────────────────────────────
  {
    id: "dezembro-vermelho",
    name: "Dezembro Vermelho",
    cause: "Luta contra a AIDS",
    month: 12,
    monthLabel: "Dezembro",
    colorHex: "#B91C1C",
    colorName: "Vermelho",
    textOnColor: "white",
    description: "Dia Mundial de Luta contra a AIDS (1º/12). Combate ao estigma, prevenção combinada e tratamento gratuito.",
    suggestedEmailSubject: "Dezembro Vermelho: informação é a melhor prevenção",
    suggestedEmailBody: "<h2 style=\"color:#B91C1C\">Dezembro Vermelho — Luta contra a AIDS</h2><p>Hoje, pessoas vivendo com HIV em tratamento têm vida normal e <strong>não transmitem</strong> o vírus (I=I, indetectável = intransmissível). Preservativo, PrEP, PEP e teste rápido: a prevenção é combinada.</p><p>Estigma mata mais que o vírus. Informe-se.</p>",
    suggestedActions: ["Teste rápido no local", "Comunicado contra o estigma"],
    suggestedCourseTopics: ["HIV/AIDS hoje", "Prevenção combinada"],
    suggestedSurveys: [
      { label: "Conhecimento sobre HIV", topic: "Você sabe o que significa I=I (indetectável = intransmissível)?" },
    ],
    suggestedMaterials: [
      { label: "Cartilha: Prevenção combinada", type: "cartilha" },
      { label: "Comunicado: Estigma mata mais que o vírus", type: "comunicado" },
      { label: "Infográfico: PrEP, PEP e teste rápido", type: "infografico" },
    ],
    suggestedQuiz: { label: "Quiz: HIV/AIDS hoje", questions: 5 },
  },
  {
    id: "dezembro-laranja",
    name: "Dezembro Laranja",
    cause: "Câncer de Pele",
    month: 12,
    monthLabel: "Dezembro",
    colorHex: "#F97316",
    colorName: "Laranja",
    textOnColor: "white",
    description: "Prevenção do câncer de pele — o mais comum no Brasil. Proteção solar diária e atenção a manchas suspeitas.",
    suggestedEmailSubject: "Dezembro Laranja: protetor solar todo dia, não só no verão",
    suggestedEmailBody: "<h2 style=\"color:#F97316\">Dezembro Laranja — Câncer de Pele</h2><p>O câncer de pele é o mais frequente no Brasil — e o mais evitável. Use protetor solar FPS 30+ todos os dias, mesmo nublado. Olhe seu corpo no espelho: manchas que mudam de cor, tamanho ou bordas merecem ida ao dermatologista.</p>",
    suggestedActions: ["Distribuir protetor solar para trabalho externo", "Comunicado sobre regra ABCDE"],
    suggestedCourseTopics: ["Proteção solar no trabalho", "Câncer de pele: sinais"],
    suggestedSurveys: [
      { label: "Exposição solar no trabalho", topic: "Você trabalha exposto(a) ao sol? Usa proteção?" },
    ],
    suggestedMaterials: [
      { label: "DDS: Regra ABCDE das pintas", type: "dds" },
      { label: "Cartilha: Proteção solar no trabalho", type: "cartilha" },
      { label: "Banner: Protetor solar todo dia", type: "banner" },
    ],
    suggestedQuiz: { label: "Quiz: Câncer de pele e proteção solar", questions: 5 },
  },

  // ───────────────────── TEMAS CORPORATIVOS PERMANENTES ────────────────────
  {
    id: "perm-ergonomia",
    name: "Ergonomia & Postura",
    cause: "Saúde Ocupacional (permanente)",
    month: 0,
    monthLabel: "Permanente",
    colorHex: "#0EA5E9",
    colorName: "Azul Ciano",
    textOnColor: "white",
    permanent: true,
    description: "Tema corporativo permanente: prevenção de LER/DORT, postura, pausas e ginástica laboral. Pode ser ativado a qualquer momento do ano.",
    suggestedEmailSubject: "Cuide da sua postura: pequenas pausas, grandes resultados",
    suggestedEmailBody: "<h2 style=\"color:#0EA5E9\">Ergonomia & Postura</h2><p>Lesões por esforço repetitivo se constroem em silêncio. Ajuste sua cadeira e monitor, faça micropausas a cada 50 minutos e movimente-se. A ginástica laboral de 5 minutos previne dores e aumenta o foco.</p>",
    suggestedActions: ["Ginástica laboral diária", "Avaliação ergonômica dos postos", "Campanha de micropausas"],
    suggestedCourseTopics: ["Ergonomia no trabalho", "Prevenção de LER/DORT", "Ginástica laboral"],
    suggestedSurveys: [
      { label: "Desconforto musculoesquelético", topic: "Você sente dores relacionadas à sua postura no trabalho?" },
    ],
    suggestedMaterials: [
      { label: "DDS: Ajuste seu posto de trabalho", type: "dds" },
      { label: "Cartilha: Ergonomia e micropausas", type: "cartilha" },
      { label: "Vídeo: Ginástica laboral em 5 minutos", type: "video" },
    ],
    suggestedQuiz: { label: "Quiz: Ergonomia e postura", questions: 6 },
  },
  {
    id: "perm-saude-mental",
    name: "Bem-Estar & Saúde Mental",
    cause: "Saúde Mental (permanente)",
    month: 0,
    monthLabel: "Permanente",
    colorHex: "#8B5CF6",
    colorName: "Violeta",
    textOnColor: "white",
    permanent: true,
    description: "Tema corporativo permanente: gestão do estresse, equilíbrio e prevenção do burnout. Alinhado à NR-01 (riscos psicossociais). Ative continuamente.",
    suggestedEmailSubject: "Bem-estar mental: um compromisso o ano inteiro",
    suggestedEmailBody: "<h2 style=\"color:#8B5CF6\">Bem-Estar & Saúde Mental</h2><p>Saúde mental não é um evento de um mês — é cuidado contínuo. Pausas reais, limites saudáveis e uma rede de apoio acessível reduzem o estresse e previnem o burnout.</p><p>Conte conosco. Conte com a equipe.</p>",
    suggestedActions: ["Pesquisa de riscos psicossociais (NR-01)", "Roda de conversa mensal", "Trilha de descompressão"],
    suggestedCourseTopics: ["Gestão do estresse", "Prevenção do burnout", "Riscos psicossociais (NR-01)"],
    suggestedSurveys: [
      { label: "Riscos Psicossociais (DRPS)", topic: "Avaliação de fatores psicossociais conforme NR-01" },
      { label: "Pulso de bem-estar", topic: "Como você avalia seu nível de estresse esta semana?" },
    ],
    suggestedMaterials: [
      { label: "DDS: Sinais de esgotamento", type: "dds" },
      { label: "Cartilha: Equilíbrio e limites saudáveis", type: "cartilha" },
      { label: "Vídeo: Pausa guiada de 3 minutos", type: "video" },
    ],
    suggestedQuiz: { label: "Quiz: Estresse e burnout", questions: 6 },
  },
  {
    id: "perm-prevencao-acidentes",
    name: "Prevenção de Acidentes",
    cause: "Segurança do Trabalho (permanente)",
    month: 0,
    monthLabel: "Permanente",
    colorHex: "#16A34A",
    colorName: "Verde Segurança",
    textOnColor: "white",
    permanent: true,
    description: "Tema corporativo permanente: cultura de segurança, uso de EPI, ordem e limpeza (5S) e reporte de quase-acidentes. Base para o DDS diário.",
    suggestedEmailSubject: "Segurança todos os dias: a meta é acidente zero",
    suggestedEmailBody: "<h2 style=\"color:#16A34A\">Prevenção de Acidentes</h2><p>Segurança é uma escolha diária. Antes de iniciar a tarefa, pergunte-se: estou usando o EPI correto? A área está organizada? Há algo inseguro a reportar? Sua atenção protege você e seus colegas.</p>",
    suggestedActions: ["DDS diário", "Auditoria comportamental de segurança", "Programa de reporte de quase-acidentes"],
    suggestedCourseTopics: ["Cultura de segurança", "Uso de EPIs", "Programa 5S"],
    suggestedSurveys: [
      { label: "Percepção de segurança", topic: "Você se sente seguro(a) para reportar condições inseguras?" },
    ],
    suggestedMaterials: [
      { label: "DDS: Checklist antes da tarefa", type: "dds" },
      { label: "Cartilha: Cultura de segurança e 5S", type: "cartilha" },
      { label: "Banner: A meta é acidente zero", type: "banner" },
    ],
    suggestedQuiz: { label: "Quiz: Cultura de segurança", questions: 8 },
  },
];

export function getHealthCampaignById(id: string): HealthCampaignTemplate | undefined {
  return HEALTH_CAMPAIGNS.find(c => c.id === id);
}

// Cor de fundo translúcida para chips/badges a partir do hex da campanha.
export function campaignTint(hex: string): string {
  return hex + "22";
}
