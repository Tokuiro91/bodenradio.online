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
  git pull origin BODEN-STADT
  echo "   → npm install for root..."
  npm ci --legacy-peer-deps --silent
  echo "   → npm install for backend..."
  cd radio-backend && npm install --silent && cd ..
  echo "   → next build..."
  npm run build
  
  echo "   → Unifying audio directories (/var/radio/music)..."
  # Support both old and new data structures
  mkdir -p /var/radio/music
  mkdir -p /var/radio/uploads
  
  # Ensure target directories exist in app data
  mkdir -p data/radio/music
  mkdir -p data/radio/uploads

  # Symlink app data to persistent /var/radio storage if not already symlinked
  if [ ! -L "data/radio/music" ]; then
    rm -rf data/radio/music && ln -s /var/radio/music data/radio/music
  fi
  if [ ! -L "data/radio/uploads" ]; then
    rm -rf data/radio/uploads && ln -s /var/radio/uploads data/radio/uploads
  fi

  # Permissions for backend
  chmod -R 775 /var/radio/music /var/radio/uploads
  
  # Move existing files from old uploads to unified dir if any (backward compatibility)
  if [ -d "public/uploads/audio" ]; then
    find public/uploads/audio -name "*.mp3" -exec mv {} /var/radio/music/ \; 2>/dev/null || true
  fi
  
  # Re-create and symlink for backward compatibility (web access)
  mkdir -p public/uploads/audio
  ln -sf /var/radio/music/*.mp3 public/uploads/audio/ 2>/dev/null || true
  
  # Symlink for broadcast media uploads
  mkdir -p public/broadcast-media
  ln -sf /var/radio/uploads/* public/broadcast-media/ 2>/dev/null || true

  echo "   → перезапуск PM2..."

  pm2 restart agileradio
  pm2 restart agileradio-backend
  echo "   → PM2 статус:"
  pm2 list
ENDSSH

echo ""
echo "✅ Деплой завершён! Сайт обновлён: https://bodenradio.online"
