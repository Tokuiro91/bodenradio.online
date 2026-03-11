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
  # Preserve untracked or modified files (like database.sqlite) during pull
  git fetch origin
  git checkout BODEN-STADT
  # Force checkout or ignore specific local changes that block pull
  git checkout radio-backend/database.sqlite || true
  git checkout radio-backend/server.js || true
  git pull origin BODEN-STADT
  echo "   → npm install for root..."
  npm ci --legacy-peer-deps --silent
  echo "   → npm install for backend..."
  cd radio-backend && npm install --silent && cd ..
  echo "   → next build..."
  npm run build
  
  # Ensure persistent directories exist and have correct permissions
  mkdir -p /var/radio/music
  mkdir -p /var/radio/uploads
  mkdir -p /var/radio/mixes
  chmod -R 777 /var/radio
  
  # Ensure target directory structure exists in app data (empty, not symlinked)
  mkdir -p data/radio/music
  mkdir -p data/radio/uploads
  mkdir -p data/radio/mixes
  
  # Remove symlinks if they exist to prevent build errors
  rm -rf data/radio/music data/radio/uploads data/radio/mixes
  mkdir -p data/radio/music data/radio/uploads data/radio/mixes
  
  # REMOVED public/radio/mixes symlink because it breaks Turbopack build
  rm -rf public/radio
  
  # Move existing files from old uploads to unified dir if any (backward compatibility)
  if [ -d "public/uploads/audio" ]; then
    find public/uploads/audio -name "*.mp3" -exec mv {} /var/radio/music/ \; 2>/dev/null || true
  fi
  
  # Clean and re-create symlinks for backward compatibility (web access)
  mkdir -p public/uploads/audio
  rm -f public/uploads/audio/*.mp3
  find /var/radio/music -maxdepth 1 -name "*.mp3" -exec ln -sf {} public/uploads/audio/ \; 2>/dev/null || true
  
  # Symlink for broadcast media uploads
  mkdir -p public/broadcast-media
  rm -f public/broadcast-media/*
  find /var/radio/uploads -maxdepth 1 -not -path '*/.*' -exec ln -sf {} public/broadcast-media/ \; 2>/dev/null || true

  # Stop and remove Azuracast containers if they exist
  echo "   → stopping Azuracast containers..."
  docker ps -a --filter "name=azuracast" -q | xargs -r docker stop || true
  docker ps -a --filter "name=azuracast" -q | xargs -r docker rm || true

  echo "   → перезапуск PM2..."

  pm2 restart agileradio
  pm2 restart agileradio-backend
  echo "   → PM2 статус:"
  pm2 list
ENDSSH

echo ""
echo "✅ Деплой завершён! Сайт обновлён: https://bodenradio.online"
