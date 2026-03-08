#!/bin/bash
# ============================================================
#  Agile Radio — Pull Production Data Script
#  Использование: ./pull-prod-data.sh
#
#  Синхронизирует:
#  • data/*.json (артисты, слушатели, настройки)
#  • public/uploads/ (картинки и аудио)
# ============================================================

VPS_IP="163.245.219.4"
VPS_USER="root"
VPS_PASS="Tokuiro372510@"
VPS_DIR="/var/www/agileradio"

echo "📥 Синхронизация данных с PRODUCTION на localhost..."

# Проверяем наличие sshpass
if ! command -v sshpass &> /dev/null; then
    echo "❌ Ошибка: sshpass не установлен. Установите его: brew install sshpass"
    exit 1
fi

# 1. Синхронизируем папку data
echo "📂 Синхронизация базы данных (JSON)..."
sshpass -p "$VPS_PASS" scp -o StrictHostKeyChecking=no "$VPS_USER@$VPS_IP:$VPS_DIR/data/*.json" ./data/
echo "   ✅ JSON файлы обновлены"

# 2. Синхронизируем uploads
echo "🖼️  Синхронизация загруженных файлов (uploads)..."
mkdir -p public/uploads
sshpass -p "$VPS_PASS" rsync -avz -e "sshpass -p '$VPS_PASS' ssh -o StrictHostKeyChecking=no" "$VPS_USER@$VPS_IP:$VPS_DIR/public/uploads/" ./public/uploads/
echo "   ✅ Папка uploads синхронизирована"

echo "✨ Готово! Локальная база теперь совпадает с серверной."
