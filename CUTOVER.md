# Cutover de Produção — Saúde do Trabalho

> ✅ **SPRINT 1 PGR INTELIGENTE CONCLUÍDA (2026-06-21).** Cutover pronto para
> disparar após OK do Bruno + aviso do Marcio. Detalhes da sprint:
> [PGR_PSICOLOGO_ROADMAP.md](./PGR_PSICOLOGO_ROADMAP.md).

## Mudanças desta versão (Sprint 1 + correções pré-cutover)

### Correções 4º giro (bugs do Bruno)
- Gerador de PGR caía → `<Sparkles>` sem import em AdminPGR
- GHE e EPC davam 404 → procedures estavam no router `analytics`, movidas para `pgr`
- Arquivos SST falha ao enviar → `\${...}` literal no SQL, escape corrigido
- Responsável Técnico "No procedure found" → router `responsibleTechnicians` criado
- Regressão psicossocial/AEP por setor → segmentação restaurada (1 ciclo + sector_id)

### PGR (pré-Sprint 1)
- Modal "Filial específica vs Consolidado" na criação do PGR
- Coluna `users.position` (cargo obrigatório no importador de RH)
- Botão "Importar do RH" + "Importar Ciclo Psicossocial" no editor

### Psicólogo (pré-Sprint 1)
- Status expandidos (agendado/confirmado/realizado/cancelado/no_show/reagendado)
- Observações Profissionais sigilosas (`outcome_notes`, LGPD: RH bloqueado)
- Aba Indicadores (total/comparecimento/no-show/evolução 12 meses)

### Sprint 1 PGR Inteligente — GSE-first (novo)
- **9 tabelas novas** (`pgr_gse`, `pgr_gse_cargos/setores/riscos/epc/epi/acoes/evidencias/treinamentos`)
- **13 procedures** em `pgr.gse.*` (CRUD + 8 `set*` idempotentes + migrate/legacyStatus)
- **UI Gestão de GSE** com 8 abas internas no editor do PGR
- **Migração JSON legado → tabelas** idempotente, com fuzzy match de setor
- **`generatePDF` refatorado** em parallel-write — GSE quando houver, JSON legado quando não
- **Banners "Modelo legado"** nas 4 seções antigas (a serem removidas na Sprint 2)

Promoção **dev → produção**. Só executar **após o OK do Bruno** em todas as pendências
e **com aviso explícito do Marcio**. Dev continua sendo o ambiente de testes do Bruno.

## Ambientes

| | DEV (testes do Bruno) | PRODUÇÃO |
|---|---|---|
| VPS | `2.24.104.195` (antiga) | `76.13.161.14` (nova, exclusiva deste projeto) |
| Branch | `develop` | `main` |
| Acesso SSH | senha root | **chave** `~/.ssh/id_ed25519_sdtprod` (publickey-only) |
| Domínio | `dev.saudedotrabalho.com` | `saudedotrabalho.com` |
| Deploy | `bash deploy_dev.sh` | `bash deploy.sh` |
| App | PM2 `saudedotrabalho` (porta 3000) | PM2 `saudedotrabalho` (porta 3000) |
| DB | `saudedotrabalho` (dados de teste) | `saudedotrabalho` (limpo: 1 user seed) |

Fonte da verdade = GitHub. Deploy é sempre `git pull` + build (nunca SFTP).

## Pré-cutover (fazer ANTES do merge)

- [ ] Bruno validou as 2 pendências (Importador Visão 360 + Agenda do Psicólogo) e o resto da lista.
- [ ] Marcio deu o aviso explícito para promover.
- [ ] Bump de versão em `client/src/version.ts` (ex.: `1.0.0.1` → `1.0.1.0`), commit em `develop`.
- [ ] `develop` está verde (sem erro de build no último `deploy_dev.sh`).

## Cutover (automatizável: `python cutover_prod.py --confirm`)

1. **Merge** `develop` → `main` (local) e `git push origin main`.
2. **Backup do DB de prod** antes de qualquer mudança de schema (`mysqldump`).
3. **deploy.sh** na VPS de prod: `git reset --hard origin/main` → `pnpm install` → `npm run build` → `pm2 restart`.
4. **Migrações de schema da Sprint 1** (aplicadas pelo `cutover_prod.py` ANTES do build):
   - **9 tabelas novas** via `drizzle/sql/2026-06-21_pgr_gse_init.sql` (DDL idempotente com `CREATE TABLE IF NOT EXISTS`)
   - **Coluna `users.position`** via `ALTER TABLE users ADD COLUMN position VARCHAR(120) NULL` (idempotente: só roda se a coluna não existe)
   - **`pnpm db:push`** depois do deploy, para ajustes finos do Drizzle.
5. **Pós-checks**:
   - [ ] `pm2` status = `online`, sem reinícios em loop (`pm2 logs --lines 30`).
   - [ ] `https://saudedotrabalho.com/` responde (302/200).
   - [ ] Login real de um perfil + 2-3 endpoints tRPC (smoke logado).
   - [ ] Rodapé mostra a nova versão.

## Pós-cutover (uma vez, manual)

- [ ] **SMTP**: DB de prod nasce limpo → configurar `company_smtp_settings` uma vez
      (host `smtpout.secureserver.net:465 SSL`, user `contato@saudedotrabalho.com`,
      senha `saude@123`). Como super admin tem `company_id NULL`, configurar pela UI
      impersonando a empresa, ou inserir cifrado pela chave do runtime (ver `project-sdt-smtp`).
      Validar com `companySmtp.test` + `sendTestEmail` real.
- [ ] Criar/ativar os usuários reais que o Bruno indicar (prod não herda os usuários de teste de dev).
- [ ] Avisar o Bruno/Marcio que prod está no ar com a versão X.

## Validação pós-cutover da Sprint 1 (suite logado, ~5 min)

Após cutover bem-sucedido, rodar este smoke logado como SESMT em **produção**
para garantir que a Sprint 1 funciona ponta a ponta:

```python
# Snippet adaptado do smoke E2E que passou 100% em dev (Dia 11-12).
import json, urllib.request, urllib.parse, http.cookiejar
HOST = "saudedotrabalho.com"  # PROD
cj = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
op.open(urllib.request.Request(
    f"https://{HOST}/api/trpc/auth.corporateLogin",
    data=json.dumps({"json":{"email":"<sesmt_email_prod>","password":"<senha_prod>"}}).encode(),
    headers={"Content-Type":"application/json"}, method="POST"), timeout=30).read()
# Confirmar que pgr.gse.list responde (mesmo vazio) — comprova que router subiu
url = f"https://{HOST}/api/trpc/pgr.gse.list?input=" + urllib.parse.quote(json.dumps({"json":{"pgrId":1}}))
r = op.open(url, timeout=10); print("pgr.gse.list:", r.status)
```

Suite mínima:
1. Login real OK
2. `pgr.gse.list` responde (mesmo vazio) — comprova que router e tabelas subiram
3. Criar 1 PGR de teste → `pgr.gse.create` → `pgr.gse.setRiscos` → `pgr.generatePDF`
4. Confirmar `gseGroupsCount > 0` no retorno
5. Apagar o PGR de teste (CASCADE limpa GSE)
6. RH logado em produção: `scheduling.listAppointments` devolve `outcomeNotes: null` (LGPD)

## Rollback

- App: `git reset --hard <commit-anterior>` na VPS + `npm run build` + `pm2 restart` (commit anterior fica registrado pelo script).
- DB: restaurar o dump gerado no passo 2 (`mysql ... < backup.sql`).
