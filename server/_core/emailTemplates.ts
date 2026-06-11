// server/_core/emailTemplates.ts — pre-built campaign templates (PT-BR)
export const EMAIL_TEMPLATES: Record<
  string,
  { label: string; subject: string; body: string }
> = {
  course_friendly: {
    label: "Lembrete amigável - curso",
    subject: "Continue seu curso: {{course_title}}",
    body: `Olá {{name}},

Notamos que você ainda não concluiu o curso "{{course_title}}".

Falta pouco para você finalizar e receber seu certificado. Que tal reservar alguns minutos hoje?

Continuar curso: {{link}}

Conte conosco caso precise de ajuda.

Equipe Saúde do Trabalho`,
  },
  course_final_notice: {
    label: "Aviso final - curso",
    subject: "Aviso importante: curso pendente - {{course_title}}",
    body: `Olá {{name}},

Este é um lembrete final sobre o curso "{{course_title}}", obrigatório para todos os colaboradores.

Por favor, conclua o curso até a data limite para evitar pendências.

Acessar curso: {{link}}

Atenciosamente,
Equipe Saúde do Trabalho`,
  },
  survey_friendly: {
    label: "Lembrete amigável - pesquisa",
    subject: "Sua opinião importa: {{survey_title}}",
    body: `Olá {{name}},

Estamos coletando informações importantes sobre o ambiente de trabalho através da pesquisa "{{survey_title}}".

Suas respostas são anônimas e levam apenas alguns minutos. Sua participação faz toda a diferença!

Responder pesquisa: {{link}}

Obrigado pela colaboração!
Equipe Saúde do Trabalho`,
  },
  survey_final_notice: {
    label: "Aviso final - pesquisa",
    subject: "Última chamada: responda a pesquisa {{survey_title}}",
    body: `Olá {{name}},

A pesquisa "{{survey_title}}" será encerrada em breve. Sua participação ainda não foi registrada.

Por favor, dedique alguns minutos para responder. Suas respostas são essenciais para melhorarmos as condições de trabalho.

Responder agora: {{link}}

Equipe Saúde do Trabalho`,
  },
  custom: {
    label: "Personalizado",
    subject: "Mensagem da equipe Saúde do Trabalho",
    body: `Olá {{name}},

[Escreva sua mensagem aqui]

Atenciosamente,
Equipe Saúde do Trabalho`,
  },
};

export type EmailTemplateKey = keyof typeof EMAIL_TEMPLATES;
