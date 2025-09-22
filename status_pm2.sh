#!/bin/bash

echo "📊 СТАТУС MEXC PAPER TRADING СИСТЕМЫ"
echo "=" | head -c 50; echo

# Показываем статус PM2
npx pm2 status

echo ""
echo "📋 ДОСТУПНЫЕ КОМАНДЫ:"
echo "• npx pm2 logs mexc-paper-trading - показать логи"
echo "• npx pm2 restart mexc-paper-trading - перезапустить"
echo "• npx pm2 stop mexc-paper-trading - остановить"
echo "• npx pm2 monit - мониторинг в реальном времени"
