# AGENTS.md — Guia para agentes (Codex / Claude) e desenvolvedores

Este arquivo é o briefing oficial do projeto. **Leia antes de qualquer alteração.**
Vale para Codex, Claude Code e qualquer pessoa desenvolvendo de outro computador.

## O que é
Saúde do Trabalho — SaaS de saúde mental corporativa e conformidade **NR-01**
(análise de risco psicossocial, PGR, biblioteca preventiva, cursos, pesquisas DRPS/AEP).

## Stack
- Front: React + TypeScript + Vite, Wouter, tRPC, Tailwind, Sonner
- Back: Node 20, tRPC, Drizzle ORM + MySQL 8 (driver mysql2)
- Gerenciador de pacotes: **pnpm** (NÃO use npm install — há `pnpm-lock.yaml`)
- Processo: PM2 · Web server: Nginx · TLS: Certbot

## Fonte da verdade = GitHub
Repo: `git@github.com:mlpaz01/saudedotrabalho.git`
- `main`    → **PRODUÇÃO** (VPS nova `76.13.161.14`, domínio `saudedotrabalho.com`)
- `develop` → **DEV** (VPS atual `2.24.104.195`, `dev.saudedotrabalho.com`) — onde o Marcio vê e o Bruno testa

**Nunca** edite arquivos direto no servidor (nada de SFTP/scp). Todo código passa pelo GitHub.

## Fluxo de trabalho obrigatório
1. `git checkout develop && git pull origin develop` — sempre comece sincronizado.
2. Faça as alterações.
3. `pnpm install` (se mudou dependências) e **`npm run build`** — não faça commit se o build quebrar.
4. `git commit` com mensagem clara + `git push origin develop`.
5. Deploy em DEV → o Bruno testa.
6. **Só com o OK do Bruno**: merge `develop` → `main`, tag `vX.Y.Z`, avisar o cliente, deploy em PROD.

Não pule a etapa do Bruno. Produção só recebe versão aprovada.

## Deploy
- **Produção** (VPS nova): `ssh root@76.13.161.14` → `cd /var/www/saudedotrabalho && bash deploy.sh`
  (faz `git reset --hard origin/main` + `pnpm install` + `npm run build` + `pm2 restart`)
- **Dev** (VPS atual): mesmo padrão, porém na branch `develop`.
- Acesso SSH é por **chave** (sem senha). As chaves ficam no `~/.ssh` do Marcio.

## Regras de segurança
- **Nunca** commite `.env` nem segredos (já está no `.gitignore`). Cada servidor tem seu `.env`.
- Segredos de produção (senha MySQL, JWT, SMTP_ENC_KEY) ficam só no servidor e num cofre local do Marcio, fora do repo.
- Scripts locais de deploy/diagnóstico (`*.py`, `*.bak`) são ignorados pelo git — não versione.

## Convenções que já custaram caro (não repita)
- `index.html` deve ter `<html lang="pt-BR" translate="no">` + meta notranslate.
  (lang errado + tradução do navegador = crash `insertBefore` do React.)
- `db.execute(drzSql\`...\`)` pode retornar `[rows, fields]` OU array puro — sempre desserialize
  defensivamente: `Array.isArray(r[0]) ? r[0] : Array.isArray(r) ? r : []`.
- Nginx: o shell do SPA (`/plataforma`) é servido com `no-cache` — não cacheie o index.

## Comandos úteis
- `pnpm install` — instala dependências
- `pnpm dev` / `npm run dev` — ambiente local (precisa de `.env` com `DATABASE_URL`)
- `npm run build` — build de produção (vite + esbuild)
- `npm run check` — typecheck (tsc)
