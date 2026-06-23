#!/usr/bin/env bash
# Deploy de PRODUCAO (VPS nova) — puxa do GitHub (branch main), instala, builda e reinicia.
# Requer a deploy key configurada no GitHub (Settings > Deploy keys).
set -euo pipefail
cd /var/www/saudedotrabalho

echo "[deploy] buscando atualizacoes (origin/main)..."
git fetch origin main
git reset --hard origin/main

echo "[deploy] instalando dependencias..."
pnpm install --frozen-lockfile

echo "[deploy] build..."
npm run build

echo "[deploy] reiniciando app..."
pm2 restart saudedotrabalho --update-env
pm2 save

echo "[deploy] concluido em $(git rev-parse --short HEAD)"
