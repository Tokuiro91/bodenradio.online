#!/bin/bash
# ============================================================
#  Agile Radio — Safe Deploy Script (сохраняет артистов)
#  Использование: ./deploy-safe.sh "Описание изменений"
#
#  Отличие от deploy.sh:
#  • Перед обновлением делает БЭКАП data/artists.json и uploads/
#  • После обновления ВОССТАНАВЛИВАЕТ их
#  → Артисты добавленные через админку НЕ пропадут
# ============================================================

VPS_IP="163.245.219.4"
VPS_USER="root"
VPS_PASS="Tokuiro372510@"
VPS_DIR="/var/www/agileradio"
COMMIT_MSG="${1:-update}"

set -e

echo "🚀 Безопасный деплой (артисты сохранятся)..."

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
echo "   ✅ Push на GitHub выполнен"

# ── 2. Обновляем сервер БЕЗ потери данных ────────────────────
echo ""
echo "🖥️  Шаг 2: Обновление VPS (с сохранением артистов)..."
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_IP" << 'ENDSSH'
  set -e
  cd /var/www/agileradio

  # Бэкап данных которые НЕ должны перезаписываться
  echo "   💾 Сохраняем артистов и загруженные файлы..."
  cp -f data/artists.json /tmp/artists_backup.json 2>/dev/null && echo "   ✅ artists.json → /tmp/artists_backup.json" || echo "   ⚠️  artists.json не найден, пропускаем"
  cp -f data/artist-db.json /tmp/artist_db_backup.json 2>/dev/null && echo "   ✅ artist-db.json → /tmp/artist_db_backup.json" || echo "   ⚠️  artist-db.json не найден, пропускаем"
  cp -rf public/uploads/ /tmp/uploads_backup/ 2>/dev/null && echo "   ✅ uploads/ → /tmp/uploads_backup/" || echo "   ⚠️  uploads/ не найден, пропускаем"

  # Обновляем код (сбрасываем artists.json чтобы не было конфликта — у нас есть бэкап)
  echo "   → git pull..."
  git reset --hard HEAD
  git pull origin BODEN-STADT

  echo "   → npm install..."
  npm ci --legacy-peer-deps --silent

  echo "   → next build..."
  npm run build

  # Восстанавливаем данные
  echo "   🔄 Восстанавливаем артистов и загруженные файлы..."
  cp -f /tmp/artists_backup.json data/artists.json 2>/dev/null && echo "   ✅ artists.json восстановлен" || echo "   ⚠️  Нечего восстанавливать"
  cp -f /tmp/artist_db_backup.json data/artist-db.json 2>/dev/null && echo "   ✅ artist-db.json восстановлен" || echo "   ⚠️  Нечего восстанавливать"
  cp -rf /tmp/uploads_backup/. public/uploads/ 2>/dev/null && echo "   ✅ uploads/ восстановлены" || echo "   ⚠️  Нечего восстанавливать"

  # Перезапускаем
  echo "   → перезапуск PM2..."
  pm2 restart agileradio
  pm2 list
ENDSSH

echo ""
echo "✅ Безопасный деплой завершён!"
echo "   Сайт: https://agileradio.online"
echo "   Артисты и загруженные файлы сохранены ✅"
