#!/bin/bash

echo "🚀 Запуск MEXC Integrated Trading System через PM2..."

# Создаем директорию для логов
mkdir -p logs

# Останавливаем предыдущие процессы
npx pm2 stop mexc-integrated-trading 2>/dev/null || true
npx pm2 delete mexc-integrated-trading 2>/dev/null || true

# Запускаем новую версию
npx pm2 start ecosystem.config.js

echo "✅ Система запущена!"
echo "📊 Статус: npx pm2 status"
echo "📋 Логи: npx pm2 logs mexc-integrated-trading"
echo "🛑 Остановка: npx pm2 stop mexc-integrated-trading"
