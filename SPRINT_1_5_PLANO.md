# Sprint 1.5 — Plano consolidado (mensagens do Bruno 21/06 noite + 22/06 manhã)

> Cutover novamente adiado. As 2 mensagens do Bruno juntam **bloqueios reais
> do cutover** (Sprint 1.5) + **épicos novos** (Sprint 2+). Esta é a separação.

## Status do cutover

⏸ **Adiado de novo.** Motivo: Bruno validou em dev e achou que as
funcionalidades da Sprint 1 (Importações Inteligentes + GSE Manager) só aparecem
em PGRs já existentes — quem cria "Novo PGR" não vê nada. Isso bloqueia a
validação correta. Antes de cutover, fazer Sprint 1.5.

---

## Sprint 1.5 — bloqueios diretos do cutover (esta semana)

### A1. ✅ habilitar GSE/Imports no "Novo PGR" — **CRÍTICO**
Hoje `editId === "new"` é string; o `AdminPGRGseManager` e o painel de
"Importações Inteligentes" exigem `typeof editId === "number"`, então só
aparecem após o primeiro SALVAR. Bruno clica "Novo PGR", preenche o modal de
escopo e fica olhando para um formulário tradicional, sem o bloco GSE nem os
botões "Importar do RH"/"Importar Ciclo Psicossocial".

**Correção:** criar procedure `pgr.createBlank({ branchId })` que cria o PGR
vazio no banco imediatamente após o usuário confirmar o modal de escopo,
retornando `id` numérico. Modal "Continuar" chama essa procedure → onSuccess
faz `openEditor(novoId)` → editId numérico → todos os blocos aparecem de cara.

### A2. ✅ Importador de colaboradores: template com Cargo — **CRÍTICO**
Tornei Cargo obrigatório no backend mas a UI do `AdminUsers` não foi
atualizada. Bruno digita o cargo em coluna errada → sistema diz "Cargo
obrigatório" → ele acha que está com bug.

**Correção:** atualizar `AdminUsers.tsx` com:
- Coluna "Cargo" na ordem correta do template
- Texto de instrução claro mostrando o cabeçalho esperado
- Mapeamento case-insensitive de variações: `cargo`, `função`, `function`, `position`
- CSV exemplo atualizado para download

### A3. ✅ "Marise Paiva" hardcoded como RT default — **CRÍTICO**
Varredura encontrou em **9 lugares**:
- `server/routers.ts:16665` (INSERT default em `createAssessment`)
- `server/_core/risk_pdf.ts` (8 ocorrências como fallback `|| "Marise Paiva — CRP 55-33301"`)

**Risco:** novo cliente sem RT cadastrado → PDFs saem assinados pela Marise
(assinatura indevida em laudos com força legal).

**Correção:** quando não há RT cadastrado, mostrar `[Responsável técnico não
cadastrado]` em destaque + bloquear ou avisar grande no PDF.

### A4. ✅ deploy + verificação logado do "Novo PGR do zero"
Smoke E2E como SESMT: clicar "Novo PGR" → confirmar escopo → ver GSE Manager
+ Imports já visíveis → importar RH → importar ciclo → criar GSE → gerar PDF.

---

## Resposta direta à mensagem do Bruno 22/06 manhã

### B1. ✅ "MF Conexões" hardcoded — RESPOSTA CONCRETA
**Varredura:** `grep -i "MF Conex" -r client/ server/` → **zero matches**.
O nome aparece nos PDFs porque é o valor de `companies.name` do tenant em
dev. Para um novo cliente, vai aparecer o nome do novo cliente automaticamente.

**Único hardcode real encontrado** é a `Marise Paiva` como RT (item A3 acima).

### B2/B3. Biblioteca Preventiva — vai pra Sprint 2 (épico médio)
Detalhamento na Sprint 2 abaixo.

---

## Sprint 2 — épicos confirmados (depois do cutover Sprint 1.5)

| # | Tema | Estimativa | Risco |
|---|---|---|---|
| 1 | Biblioteca Preventiva: botão "Disparar Campanha" dentro da campanha (envia tudo: estáticos + interativos) + desativar aba antiga dentro de "Biblioteca" | 1 semana | Baixo |
| 2 | Superadmin: gestão de horários por cliente + bloqueio fora do expediente | 2 semanas | **Alto** |
| 3 | Reestruturação perfil psicólogo + integração Meet/Teams | 2 semanas | Médio |
| 4 | Importação de clientes/empresas: revisar template/instruções (semelhante ao A2 de colaborador) | 3 dias | Baixo |
| 5 | IA real GSE (Sugerir Inventário/Matriz/Plano cruzando RH+AEP+psicossocial+eSocial+NRs) | 3 semanas | Médio |
| 6 | Central de Conformidade do PGR (estilo NR-01) | 1 semana | Baixo |
| 7 | Reaproveitamento de PGR anterior + revisão com diff | 1 semana | Médio |

(Detalhes em `PGR_PSICOLOGO_ROADMAP.md`)

---

## Decisão pra continuar

Plano sugerido:
1. Eu implemento Sprint 1.5 agora (A1 + A2 + A3) em sessão focada
2. Deploy dev + smoke verde
3. Marcio testa pessoalmente o fluxo "Novo PGR do zero"
4. Se OK, comunica Bruno e dispara cutover
5. Sprint 2 começa em seguida

Sequência alternativa que NÃO recomendo: deixar A3 (Marise hardcoded) pra
Sprint 2. Justificativa: assinatura indevida em laudos com força legal é
risco jurídico. Não vai dar problema enquanto for só MF Conexões em dev, mas
no DIA que um cliente novo gerar PDF sem cadastrar RT → laudo errado.
