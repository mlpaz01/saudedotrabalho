# Estudo técnico para integração SST com o eSocial

## Decisão executiva

A integração é viável, mas deve entrar em produção somente após homologação em Produção Restrita, validação jurídica e contábil dos fluxos e definição formal de quem assina e transmite em nome de cada empregador. A plataforma já pode preparar os dados, as tabelas e a fila de eventos. A transmissão oficial deve permanecer desabilitada até a conclusão dos controles descritos neste documento.

Referência técnica considerada: leiaute eSocial S-1.3 consolidado até a NT 06/2026, seus XSDs e o Manual de Orientação do Desenvolvedor publicados no portal oficial.

## Escopo recomendado

| Evento | Origem na plataforma                                     | Primeira entrega                        |
| ------ | -------------------------------------------------------- | --------------------------------------- |
| S-2210 | CAT, trabalhador, tabelas oficiais e atendimento         | Sim                                     |
| S-2220 | PCMSO, exame ocupacional, ASO e médico                   | Sim                                     |
| S-2230 | Atestados e afastamentos validados                       | Sim, após saneamento do módulo          |
| S-2240 | PGR, GSE, riscos, agentes, EPC/EPI e responsável técnico | Sim, em fase posterior ao S-2210/S-2220 |
| S-3000 | Exclusão controlada de evento aceito                     | Sim, junto de cada evento habilitado    |

Retificações não devem sobrescrever o histórico local. Cada retificação cria nova versão, mantém o recibo anterior, registra o motivo e respeita as dependências cronológicas entre eventos.

## Arquitetura proposta

1. Um gerador por tipo de evento transforma dados normalizados em um modelo imutável.
2. O modelo é validado pelas regras internas e pelo XSD da versão ativa.
3. O XML é assinado com certificado ICP-Brasil autorizado para o empregador.
4. Uma fila idempotente transmite lotes ao Web Service do eSocial.
5. Um processo de consulta acompanha o lote até o resultado final.
6. Recibo, protocolo, XML enviado, XML retornado, ocorrências e versões são preservados.
7. Rejeições voltam para uma fila operacional com mensagem compreensível e vínculo ao campo de origem.

Cada evento precisa de uma chave idempotente por empresa, trabalhador, tipo, competência/data e versão. Repetições de rede não podem gerar duplicidade.

## Certificados e segregação

O Web Service exige certificado digital. A solução deve aceitar A1 e avaliar A3 conforme o modo de operação, mas a recomendação para automação em servidor é A1 com armazenamento criptografado e isolado por empresa.

Requisitos mínimos:

- cofre de segredos ou serviço de chaves, nunca arquivo PFX no banco ou repositório;
- senha criptografada com chave fora do banco;
- acesso restrito ao processo de assinatura;
- rotação, validade, revogação e alertas;
- registro de quem cadastrou e autorizou o certificado;
- teste de cadeia ICP-Brasil e cadeia do servidor eSocial;
- isolamento absoluto entre certificados de CNPJs e redes White Label.

## Modelo de dados mínimo

Criar uma entidade de transmissão com: empresa, evento, entidade de origem, versão do leiaute, ambiente, identificador, XML canônico, hash, status, número do lote, protocolo, recibo, tentativas, próxima tentativa, ocorrências, certificado utilizado, usuário solicitante e trilha temporal.

Estados recomendados: rascunho, validando, inválido, pronto, assinado, em_fila, enviado, processando, aceito, rejeitado, retificação_pendente, exclusão_pendente e cancelado_localmente.

## Regras por evento

### S-2210

Usar as tabelas oficiais internas para agente causador, situação geradora, parte do corpo e natureza da lesão. A IA pode sugerir somente itens existentes e nunca decide a classificação. Antes de transmitir, validar empregador, vínculo, datas, emitente, local, atendimento, médico e dependências com afastamentos.

### S-2220

Transmitir somente com PCMSO válido, procedimento do catálogo, data, tipo de exame ocupacional, ASO finalizado, médico e CRM. Monitoração pontual deve permanecer distinta do exame periódico e só integrar o evento quando houver enquadramento técnico confirmado.

### S-2230

Usar apenas afastamentos validados pelo RH/SESMT. Preservar dados clínicos sensíveis e enviar apenas os campos exigidos. Tratar prorrogação, retorno, recorrência, retificação e exclusão sem inferir automaticamente direito previdenciário.

### S-2240

Exigir cadeia consistente PGR, GSE, trabalhador, agentes, intensidade/concentração quando aplicável, EPC/EPI, metodologia e responsável. Impedir envio se o GSE do PGR divergir do Catálogo Mestre.

### S-3000

Permitir somente para evento aceito, com recibo conhecido, motivo registrado, dupla confirmação e auditoria. A exclusão no eSocial não apaga o histórico local.

## Homologação

1. Cadastrar empregador e certificado de teste.
2. Gerar casos válidos, inválidos, retificados e excluídos para cada evento.
3. Validar XML localmente contra os XSDs vigentes.
4. Transmitir na Produção Restrita e consultar o processamento.
5. Validar recibos, erros, reenvios, indisponibilidade e idempotência.
6. Executar teste de segregação entre duas empresas.
7. Realizar teste de expiração e troca de certificado.
8. Aprovar evidências com responsável de SST, médico, jurídico/LGPD e contabilidade.
9. Liberar produção por empresa e por evento usando feature flags.

## Segurança e LGPD

Os XMLs de SST podem conter dados pessoais e dados de saúde. Devem ser criptografados em trânsito e repouso, ter acesso por menor privilégio, logs sem conteúdo clínico, retenção configurada e trilha de acesso. White Labels não podem acessar certificados, eventos ou recibos de outras redes ou empresas.

## Estimativa inicial

| Fase                                               | Esforço estimado |
| -------------------------------------------------- | ---------------: |
| Fundação, certificados, XSD, fila e auditoria      |  120 a 180 horas |
| S-2210 e S-3000 correspondente                     |   80 a 120 horas |
| S-2220 e S-3000 correspondente                     |  100 a 150 horas |
| S-2230 e S-3000 correspondente                     |   80 a 120 horas |
| S-2240 e S-3000 correspondente                     |  120 a 180 horas |
| Homologação, segurança, operação e observabilidade |  100 a 160 horas |

Faixa total preliminar: 600 a 910 horas. A estimativa deve ser refinada após prova de conceito com certificado, um CNPJ piloto e os XSDs efetivamente selecionados.

## Custos recorrentes

Os Web Services públicos não implicam, por si, cobrança por evento. Os custos do produto virão de certificado digital, cofre de segredos, processamento, armazenamento de XML e evidências, monitoramento, suporte e atualização contínua de leiautes. Recomenda-se cobrar setup por CNPJ, mensalidade de operação e franquia de eventos, preservando margem para suporte e mudanças normativas.

## Critérios de pronto para vender

- Produção Restrita aprovada para todos os fluxos contratados.
- Certificados isolados e com alertas de validade.
- Painel de transmissões, recibos, rejeições e reprocessamento.
- Política de suporte e responsabilidade contratual definida.
- Atualização versionada de XSD e regras.
- Recuperação de desastre testada.
- Auditoria de segregação multiempresa aprovada.

Até esses critérios serem cumpridos, a interface deve declarar claramente que os eventos estão preparados ou pendentes de integração, sem afirmar que foram transmitidos ao eSocial.

## Fontes oficiais

- https://www.gov.br/esocial/pt-br/documentacao-tecnica
- https://www.gov.br/esocial/pt-br/documentacao-tecnica/leiautes-esocial-versao-s-1-3-nt-06-2026/index.html
- https://www.gov.br/esocial/pt-br/acesso-ao-sistema/ambiente-de-producao-restrita
