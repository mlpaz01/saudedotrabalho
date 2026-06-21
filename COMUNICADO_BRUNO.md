# Comunicado para o Bruno — Sprint 1 PGR Inteligente pronta

> Rascunho que o Marcio pode editar e enviar (e-mail/WhatsApp).
> Eu (Claude) não envio nada — só preparo o texto.

---

## Assunto: Sprint 1 do PGR Inteligente pronta em dev — cutover esta semana

Oi Bruno,

Recapitulando: depois da sua mensagem do dia 21 (com o PDF da K3M Engenharia
comparando o nosso PGR ao modelo de mercado), você apontou com razão que
estávamos digitalizando um formulário em vez de reestruturar o módulo. Decidi
**adiar o cutover** que estava marcado pra fazer a reestruturação direito.

Em vez de remendar a tela, refizemos a arquitetura: agora o **GSE (Grupo
Similar de Exposição) é a espinha dorsal** do PGR. Tudo (cargos, setores,
riscos, EPC, EPI, plano 5W2H, treinamentos, evidências) está vinculado ao
GSE — não a setor isolado, não a JSON no documento.

**O que dá pra você testar agora em dev (`dev.saudedotrabalho.com`):**

1. **Criar um PGR** com escopo "filial específica" ou "consolidado"
2. **Importar do RH** (puxa filiais/setores/cargos cadastrados)
3. **Importar Ciclo Psicossocial** (traz inventário + plano do ciclo escolhido)
4. **Bloco "Grupos Similares de Exposição (GSE)"** no topo do editor:
   - Botão "Novo GSE" abre dialog com nome, descrição, contagem trab/H/M
   - Cada GSE tem 8 abas: Cargos, Setores, Riscos, EPC, EPI, Ações 5W2H,
     Evidências, Treinamentos
   - Tudo é salvo com "Salvar tudo" no rodapé
5. **PGR que você já tinha** ganhou um banner âmbar "PGR tem dados antigos"
   com botão **"Migrar PGR legado"** — clica e ele converte automaticamente
   `ghe_funcoes/inventario/plano_psicossocial` em um GSE pré-populado pra
   você reorganizar
6. **PDF gerado** agora tem capítulo dedicado "Grupos Similares de Exposição
   (GSE) — Modelo NR-01" com tabela colorida sev/prob/risco por GSE

As 4 seções antigas (GSE em JSON, Inventário, EPC, EPI) ganharam badge
**"Modelo legado"** em fundo âmbar. Ainda funcionam, mas vão ser removidas
na Sprint 2 — a ideia é você migrar progressivamente.

**O que ainda NÃO entrou (roadmap nas próximas sprints):**

- IA real contextualizada (Sugerir Inventário/Matriz/Plano a partir de
  cargo+setor+atividade+AEP+psicossocial+NR-06+eSocial 23/24)
- Integração Google Meet/Teams pro psicólogo
- Controle de jornada por empresa com bloqueio de acesso
- Reaproveitamento de PGR anterior + revisão com diff
- Central de Conformidade do PGR (estilo NR-01)
- Auditoria Inteligente expandida
- Evidências com upload completo + composição no PDF
- Tabelas eSocial 23 e 24 importadas

Tudo isso está documentado em `PGR_PSICOLOGO_ROADMAP.md`. Próximo passo
imediato: cutover do que está estabilizado, e Sprint 2 começa em seguida.

**Pra você fazer:**

1. Loga em `dev.saudedotrabalho.com` como `sesmt.teste@mfconexoes.com.br`
2. Cria um PGR de teste (ou migra um existente — PGRs 2 e 3 estão prontos pra isso)
3. Me avisa por aqui se você concorda com a estrutura GSE-first ou se prefere
   ajustar algo antes do cutover

Quando você der o OK, eu disparo o `cutover_prod.py` e a versão sobe pra
produção (`saudedotrabalho.com`).

Abraço,
Marcio
