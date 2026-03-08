#!/bin/bash
# ============================================================
#  Boden Radio — Rollback Script
#  Использование: ./rollback.sh
#  Показывает последние коммиты и откатывает на выбранный
# ============================================================

VPS_IP="193.233.19.203"
VPS_USER="root"
VPS_PASS="tYbrC2G70GY7"
VPS_DIR="/var/www/agileradio"

echo "🔄 Boden Radio — Откат версии"
echo "================================"
echo ""

# Показываем последние 10 коммитов
echo "📋 Последние коммиты:"
echo ""
git log --oneline -10 | nl -w2 -s") "
echo ""

# Предлагаем выбрать номер
read -p "Введи номер коммита для отката (1-10) или Enter для отмены: " CHOICE

if [ -z "$CHOICE" ]; then
  echo "❌ Отмена"
  exit 0
fi

# Получаем ID коммита по номеру
COMMIT_HASH=$(git log --oneline -10 | sed -n "${CHOICE}p" | awk '{print $1}')
COMMIT_MSG=$(git log --oneline -10 | sed -n "${CHOICE}p" | cut -d' ' -f2-)

if [ -z "$COMMIT_HASH" ]; then
  echo "❌ Неверный номер"
  exit 1
fi

echo ""
echo "⚠️  Откат на: $COMMIT_HASH — $COMMIT_MSG"
read -p "Подтвердить? (y/n): " CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "❌ Отмена"
  exit 0
fi

echo ""
echo "🖥️  Откат на VPS..."
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_IP" bash -s << ENDSSH
  set -e
  cd $VPS_DIR

  echo "   💾 Сохраняем артистов..."
  cp -f data/artists.json /tmp/artists_backup.json 2>/dev/null || true
  cp -rf public/uploads/ /tmp/uploads_backup/ 2>/dev/null || true

  echo "   → git reset to $COMMIT_HASH..."
  git fetch origin
  git reset --hard $COMMIT_HASH

  echo "   → npm install..."
  npm ci --legacy-peer-deps --silent

  echo "   → next build..."
  npm run build

  echo "   🔄 Восстанавливаем артистов..."
  cp -f /tmp/artists_backup.json data/artists.json 2>/dev/null || true
  cp -rf /tmp/uploads_backup/. public/uploads/ 2>/dev/null || true

  echo "   → перезапуск PM2..."
  pm2 restart agileradio
ENDSSH

echo ""
echo "✅ Откат выполнен на: $COMMIT_HASH — $COMMIT_MSG"
echo "   Сайт: http://bodenradio.online"
echo ""
echo "ℹ️  Чтобы вернуть VPS обратно в синхронизацию с GitHub, запусти:"
echo "   ./deploy-safe.sh"
