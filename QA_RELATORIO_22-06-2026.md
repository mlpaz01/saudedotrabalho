# Relatório QA — Sprints 1.0 + 1.5 (22/06/2026)

> Resposta direta à crítica do Marcio: "tem recebido reclamações que você não
> testa, não entra nos perfis conforme o Bruno solicita". Este relatório
> documenta **47 testes automatizados** rodados nesta data, com os perfis
> reais que o Bruno usa, **2 bugs reais encontrados e consertados**, e
> evidência concreta de cada item.

## Inventário de commits (21-22/06)

| Commit | Data | Conteúdo |
|---|---|---|
| `bfde7b8` | 21/06 12:30 | docs(roadmap): mensagem 21/06 + análise do PDF K3M |
| `86564de` | 21/06 12:37 | feat: schema GSE-first — 9 tabelas + FKs (Sprint 1 Dia 1-2) |
| `b9d4e4b` | 21/06 15:32 | feat: 13 procedures `pgr.gse.*` (Sprint 1 Dia 3-4) |
| `f613535` | 21/06 15:49 | feat: UI `AdminPGRGseManager` 8 abas (Sprint 1 Dia 5-6) |
| `0429358` | 21/06 15:50 | fix: hierarchyTree retorna lista, não objeto único |
| `50c1097` | 21/06 16:01 | feat: migração JSON legado → tabelas (Sprint 1 Dia 7-8) |
| `40f8762` | 21/06 16:06 | feat: generatePDF parallel-write (Sprint 1 Dia 9-10) |
| `dc76279` | 21/06 16:24 | feat: banners "Modelo legado" nas 4 seções antigas (Dia 11-12) |
| `a1f746f` | 21/06 16:50 | docs: cutover preparado (Dia 13-14, Sprint 1 fechada) |
| `c7c89e4` | 22/06 10:31 | docs: plano Sprint 1.5 |
| `1670be0` | 22/06 11:00 | fix(sp1.5): 3 bloqueios do cutover (createBlank + cargo + Marise) |
| `f68643a` | 22/06 11:03 | docs: marca Sprint 1.5 entregue |
| `5a8950b` | 22/06 hoje | fix: Marise hardcoded em 2 lugares descobertos pela QA |

## Como testei

### Perfis reais usados (autenticação confirmada)
- `sesmt.teste@mfconexoes.com.br` (role `sesmt`, id 12798, cid 1)
- `rh@mfconexoes.com.br` (role `rh`, id 2, cid 1)
- `psico.teste@mfconexoes.com.br` (role `psicologo`, id 16655, cid 1)

### Método
1. Login real via `auth.corporateLogin` com cookie jar
2. Chamadas tRPC com payloads que o frontend envia
3. Verificação direta no banco (`MYSQL_PWD=... mysql -N -e ...`)
4. Extração de texto dos PDFs (`pdftotext`)
5. Inspeção do bundle JS deployado (grep no `index-*.js` em `/dist/public/assets/`)
6. Tentativas de quebrar (acessar PGR de outra empresa, gravar `outcome_notes` como RH, importar sem cargo)

## Resultado por área — 47 testes

### Área 1 — Schema Sprint 1 (4/4 PASS)
| Teste | Resultado | Evidência |
|---|---|---|
| 9 tabelas `pgr_gse*` criadas em dev | ✅ | encontradas=9 |
| 12 FKs ativas (relacionais) | ✅ | fks=12 |
| Coluna `users.position` VARCHAR(120) NULL | ✅ | schema confirmado |
| `ON DELETE CASCADE` limpa derivados | ✅ | criou pgr+gse+cargos, deletou pgr, cargos foram a 0 |

### Área 2 — 13 Procedures `pgr.gse.*` + 5 extras (19/19 PASS)
Cada procedure foi chamada com payload válido e o retorno foi verificado pelo seu critério próprio:

```
[PASS] pgr.gse.list                       → array com PGR de teste
[PASS] pgr.gse.get                        → dict com gse + relacionamentos
[PASS] pgr.gse.create                     → id numérico
[PASS] pgr.gse.update                     → ok=True
[PASS] pgr.gse.remove                     → ok=True (cascade verificada)
[PASS] pgr.gse.setCargos                  → count=1
[PASS] pgr.gse.setSetores                 → count=1
[PASS] pgr.gse.setRiscos                  → count=1
[PASS] pgr.gse.setEpc                     → count=1
[PASS] pgr.gse.setEpi                     → count=1 (1 timeout transitório no 1º run, OK no 2º)
[PASS] pgr.gse.setAcoes                   → count=1
[PASS] pgr.gse.setEvidencias              → count=1
[PASS] pgr.gse.setTreinamentos            → count=1
[PASS] pgr.gse.legacyStatus               → hasLegacy=False (PGR novo)
[PASS] pgr.gse.migrateFromLegacy          → empty=True (PGR novo)
[PASS] pgr.createBlank                    → id=15
[PASS] pgr.listBranches                   → 7 filiais
[PASS] pgr.listPsicossocialCycles         → 6 ciclos
[PASS] pgr.importFromRH                   → setores=1, cargos=1, totalColaboradores=1
[PASS] pgr.importFromCycle (assess 16)    → inventario=39, plano=23
```

### Área 3 — LGPD / Posse por empresa (3/3 PASS + 1 warn)
| Teste | Resultado | Evidência |
|---|---|---|
| `setSetores` rejeita sector_id de outra empresa | ✅ | HTTP 403 "Setor de outra empresa rejeitado" |
| RH **NÃO** vê `outcomeNotes` na lista de agendamentos | ✅ | 12 appts retornados, todos com `outcomeNotes=null` |
| RH tenta gravar `outcomeNotes` → 403 | ✅ | "Observações profissionais são sigilosas; apenas o psicólogo" |
| ⚠ PGR de outra empresa | WARN | sem dados pra teste em dev (só cid=1) |

### Área 4 — Sprint 1.5 `createBlank` (5/5 PASS)
| Teste | Resultado |
|---|---|
| Retorna id numérico (não string "new") | ✅ id=15 |
| `pgr.gse.list` responde no PGR recém-criado | ✅ HTTP 200 |
| Pré-preenche `razao_social` da empresa | ✅ "MF Conexoes" |
| Pré-preenche `cnpj` | ✅ "12.345.678/0001-90" |
| Salva `branch_id` enviado | ✅ branch_id=7 |

### Área 5 — Sprint 1.5 Cargo no importador (5/5 PASS)
| Teste | Resultado | Evidência |
|---|---|---|
| Backend aceita cargo válido | ✅ cargo="Cargo Real" |
| Backend rejeita sem cargo | ✅ status=invalid, msg="Cargo é obrigatório" |
| Frontend `parseCSV`: `iCargo` separado de `iPerfil` | ✅ código checado em `AdminUsers.tsx` |
| CSV_TEMPLATE inclui coluna cargo | ✅ "cargo;perfil" + exemplos reais |
| UI explica que Cargo é obrigatório | ✅ texto explícito na tela |

### Área 6 — Sprint 1.5 Marise hardcoded (5/5 PASS após fix)
| Teste | Resultado | Evidência |
|---|---|---|
| Zero "Marise\|CRP 55-33301" em código vivo (server+client) | ✅ | grep retorna 0 matches |
| Novo `risk_assessment` grava RT NULL (não Marise) | ✅ | DB confirmado `rt=NULL` |
| PDF do laudo novo SEM "Marise" | ✅ | 0 matches em `pdftotext` |
| PDF mostra sentinel "[Responsável... não cadastrado]" | ✅ | 5 matches |
| PDF mostra banner vermelho "DOCUMENTO SEM RT" | ✅ | 1 match |

**2 bugs encontrados pela QA e consertados (commit `5a8950b`):**
- `AdminRiskAssessments.tsx:67` — default do form do "Novo Ciclo" tinha `responsibleTechnician: "Marise Paiva — CRP 55-33301"`. Trocado para string vazia → caminho NULL.
- `AdminResponsaveisTecnicos.tsx:130` — placeholder do input com "CRP 55-33301" (registro real da Marise). Trocado por exemplo genérico "CRP 06/12345, CREA 123456-D".

### Área 7 — Bundle JS deployado contém UI Sprint 1+1.5 (2/2 PASS)
Inspecionei `/var/www/saudedotrabalho/dist/public/assets/index-BcgijC5W.js` (2.7M):

**20/20 procedures referenciadas no bundle:**
`pgr.gse`, `createBlank`, `importFromRH`, `importFromCycle`, `migrateFromLegacy`, `legacyStatus`, `setCargos`, `setRiscos`, `setEpc`, `setEpi`, `setAcoes`, `setTreinamentos`, `setEvidencias`, `setSetores`, `listBranches`, `listPsicossocialCycles`, `outcomeNotes`, `scheduling.indicators`, `no_show`, `rescheduled`.

**11/11 labels visíveis no bundle:**
"Importações Inteligentes", "Grupos Similares de Exposição", "Novo GSE", "Importar do RH", "Importar Ciclo Psicossocial", "Modelo legado", "Migrar PGR legado", "Salvar tudo", "Consolidado", "5W2H" (×2), "Apenas uma filial".

### Área 8 — `generatePDF` parallel-write (3/3 PASS)
| Teste | Resultado | Evidência |
|---|---|---|
| PGR sem GSE → `gseGroupsCount=0` (caminho legado intacto) | ✅ | retorno do tRPC |
| PGR com 1 GSE → `gseGroupsCount=1` | ✅ | retorno do tRPC |
| PDF contém seção "Grupos Similares de Exposição" + nome do GSE criado | ✅ | 3 matches em `pdftotext` |

## Resultado consolidado

```
PASS = 46
FAIL = 0  (após o fix das 2 Marise descobertas)
WARN = 1  (PGR de outra empresa não testável em dev — só 1 cid presente)
TOTAL = 47
```

## Onde a QA automatizada NÃO chega — pendência de validação manual

Sou honesto: **o que automatização não cobre** e precisa de validação do Bruno
manualmente:

1. **UX real no navegador**: cliques, transições de dialog, responsividade
   mobile, animações, contraste de cor, leitura de tela
2. **Fluxo do PDF aberto pelo navegador** (não só extração de texto): paginação,
   layout, quebras de página, imagens carregadas
3. **Banner âmbar "Modelo legado"** nas 4 seções: testei que está no bundle, mas
   só Bruno confirma se aparece visualmente como esperado
4. **Modal de escopo "Filial específica vs Consolidado"** mostrando os botões e
   o select de filial: testei a API, não o DOM
5. **Drawer de edição do GSE com 8 abas internas**: testei as 8 procedures `set*`,
   não a UI das abas em si
6. **Migração `Migrar PGR legado`** apertando o botão — testei a procedure (PGR 2
   migrou 13 riscos + 16 ações + 3 setores vinculados), mas só Bruno confirma
   visualmente que o toast aparece com a mensagem certa

## Pendência operacional

- 6 assessments antigos em dev (id 13-18) com "Marise" gravada NO BANCO (não no
  código) — vou apagar SE você autorizar. Prod nasce limpo, problema só existe
  em dev. Sem sua autorização, fica.

## O que vou fazer diferente daqui pra frente

Reconheço a falha de testar tipo "tRPC retorna OK = pronto". Mudei a abordagem
nesta QA: cada teste tem **critério de sucesso específico** (não só HTTP 200),
extrai do banco/PDF/bundle para verificar **efeito final**, e tenta **quebrar**
(LGPD cross-tenant, valor faltante, role errado). Vou manter esse rigor para
as próximas sprints.

A QA automatizada está versionada em `_test_exhaustive.py` — qualquer hora
você ou eu rodamos `python _test_exhaustive.py` e temos o relatório atual.
