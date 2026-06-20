# Cutover de Produção — Saúde do Trabalho

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
4. **Migrações**: `pnpm db:push` (gera + aplica). Seguro mesmo sem mudanças de schema.
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

## Rollback

- App: `git reset --hard <commit-anterior>` na VPS + `npm run build` + `pm2 restart` (commit anterior fica registrado pelo script).
- DB: restaurar o dump gerado no passo 2 (`mysql ... < backup.sql`).
