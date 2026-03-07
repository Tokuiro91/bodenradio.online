#!/bin/bash
# ============================================================
#  Agile Radio — Deploy Script
#  Использование: ./deploy.sh "Описание изменений"
# ============================================================

VPS_IP="163.245.219.4"
VPS_USER="root"
VPS_PASS="Tokuiro372510@"
VPS_DIR="/var/www/agileradio"
COMMIT_MSG="${1:-update}"

set -e

echo "🚀 Начинаем деплой..."

# ── 1. Коммитим и пушим локальные изменения ──────────────────
echo ""
echo "📦 Шаг 1: Коммит и push на GitHub..."
git add -A
if git diff --cached --quiet; then
  echo "   ℹ️  Нет новых изменений для коммита"
else
  git commit -m "$COMMIT_MSG"
  echo "   ✅ Закоммичено: $COMMIT_MSG"
fi
git push origin BODEN-STADT
echo "   ✅ Push na GitHub выполнен"

# ── 2. Обновляем сервер ──────────────────────────────────────
echo ""
echo "🖥️  Шаг 2: Обновление VPS..."
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_IP" << 'ENDSSH'
  set -e
  cd /var/www/agileradio
  echo "   → git checkout BODEN-STADT && pull..."
  git stash
  git fetch origin
  git checkout BODEN-STADT
  git pull origin BODEN-STADT
  git stash pop || true
  echo "   → npm install for root..."
  npm ci --legacy-peer-deps --silent
  echo "   → npm install for backend..."
  cd radio-backend && npm install --silent && cd ..
  echo "   → next build..."
  npm run build
  echo "   → перезапуск PM2..."
  pm2 restart agileradio
  pm2 restart agileradio-backend
  echo "   → PM2 статус:"
  pm2 list
ENDSSH

echo ""
echo "✅ Деплой завершён! Сайт обновлён: https://bodenstadt.online"
