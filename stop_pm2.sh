#!/bin/bash

echo "🛑 ОСТАНОВКА MEXC PAPER TRADING СИСТЕМЫ"
echo "=" | head -c 50; echo

# Останавливаем процесс
npx pm2 stop mexc-paper-trading

# Удаляем процесс
npx pm2 delete mexc-paper-trading

echo "✅ Система остановлена"
echo "📊 Статус:"
npx pm2 status
