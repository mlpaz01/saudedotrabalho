# Saúde do Trabalho - TODO

## Schema & Backend
- [x] Schema: tabelas companies, corporate_emails, users (com role), modules, progress, certificates, decompression_videos, reminder_settings
- [x] Migração SQL executada
- [x] Seed dos 11 módulos no banco
- [x] tRPC: autenticação por e-mail corporativo (login, primeiro acesso/set-password)
- [x] tRPC: importação em massa de e-mails via CSV (admin)
- [x] tRPC: listagem e acesso aos módulos
- [x] tRPC: registro de progresso por módulo (percentual + concluído)
- [x] tRPC: geração e download de certificado (canvas/PNG)
- [x] tRPC: listagem de vídeos da Área de Descompressão
- [x] tRPC: dashboard do funcionário (progresso geral, módulos em andamento)
- [x] tRPC: painel admin (relatórios, engajamento por setor, configuração de lembretes)
- [x] tRPC: envio de lembretes por e-mail (configurável por X dias)

## Frontend - Identidade Visual
- [x] Paleta: azul-marinho, verde-folha, lavanda, rosa blush, menta pálida
- [x] Tipografia serifada elegante (Playfair Display) + sans-serif minimalista (Inter)
- [x] Detalhes geométricos delicados (colchetes, linhas verticais)
- [x] Gradientes suaves e espaço negativo equilibrado
- [x] Design responsivo (mobile e desktop)
- [x] Upload da logomarca Saúde do Trabalho

## Frontend - Páginas
- [x] Página de Login (e-mail corporativo)
- [x] Página de Primeiro Acesso (definir senha)
- [x] Dashboard do Funcionário (home personalizada)
- [x] Listagem dos 11 Módulos de Treinamento
- [x] Player de Vídeo com controle de progresso
- [x] Área de Descompressão (yoga, meditação, respiração)
- [x] Página de Certificados do usuário
- [x] Painel Admin: visão geral e relatórios
- [x] Painel Admin: importação de usuários CSV
- [x] Painel Admin: configuração de lembretes
- [x] Painel Admin: gestão de módulos e vídeos

## Funcionalidades Especiais
- [x] Geração de certificado com nome do funcionário e módulo
- [x] Sistema de lembretes automáticos por e-mail (X dias configurável)
- [x] Alertas para RH sobre baixo engajamento por setor

## Testes
- [x] Testes Vitest para autenticação (login/logout)
- [x] Testes Vitest para controle de acesso admin (FORBIDDEN para user, OK para admin/rh)
- [x] Testes Vitest para módulos e certificados

## Correções Reportadas (08/05/2026)

- [x] Corrigir certificado: "Not found" ao tentar visualizar/baixar (URL /manus-storage/certificates/... não funciona em produção)
- [x] Adicionar área admin para gerenciar vídeos da Área de Descompressão
- [x] Adicionar área admin para configurar certificado de cada módulo (título, texto, assinatura) com reflexo correto na área do funcionário

## Melhorias Solicitadas (09/05/2026)

- [x] CRUD completo de módulos no admin (criar, editar, excluir — igual à Descompressão)
- [x] Configuração do certificado integrada dentro da edição do módulo (remover menu "Certificados" do admin)
- [x] Hierarquia Módulo → Aulas: cada módulo pode ter múltiplas aulas/vídeos (como LMS)
- [x] AdminModules reescrito com CRUD + cert config + gestão de aulas por módulo
- [x] ModulePlayer atualizado para exibir lista de aulas e navegar entre elas
- [x] Progresso calculado por aulas assistidas dentro do módulo
