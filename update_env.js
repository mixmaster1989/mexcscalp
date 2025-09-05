#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Обновление .env файла...\n');

// Новая конфигурация
const newEnvContent = `# MEXC API Configuration
MEXC_API_KEY=mx0vgl1f470xehWJCT
MEXC_SECRET_KEY=67761938aebb4898b5e444a0133c0473
MEXC_BASE_URL=https://api.mexc.com
MEXC_WS_URL=wss://wbs.mexc.com/ws

# Database
DATABASE_PATH=./data/mexc_bot.db

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/mexc_bot.log

# Bot Configuration
CONFIG_FILE=./config/defaults.ethusdc.json
SYMBOL=ETHUSDC
DEPOSIT_USD=100

# Trading toggles
ENABLE_TRADING=true
DRY_RUN=false

# Exchange filters (fallbacks — реальные подтянутся из exchangeInfo)
TICK_SIZE=0.01
STEP_SIZE=0.000001
MIN_NOTIONAL=1
MIN_QTY=0

# Order sizing and maker-guard
ORDER_NOTIONAL_USD=1.5
MAKER_GUARD_GAP_TICKS=1

# Repricing/TTL/cancel limits
TTL_MS=45000
DELTA_TICKS=3
REPRICE_MIN_INTERVAL_MS=15000
CANCEL_RATE_PER_MIN=30

# REST timing
MEXC_RECV_WINDOW=60000

# Auto-seed base inventory for SELLs (spot needs ETH)
AUTO_SEED_ETH=false
SEED_BASE_USD=10

# Dashboard
DASHBOARD_PORT=3000
ENABLE_DASHBOARD=true

# Telegram Bot
TELEGRAM_BOT_TOKEN=7975252884
# TELEGRAM_ADMIN_CHAT_IDS=-1002707629038
`;

try {
  // Создаем бэкап текущего .env
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = `.env.backup.${timestamp}`;
  
  if (fs.existsSync('.env')) {
    fs.copyFileSync('.env', backupPath);
    console.log(`✅ Создан бэкап: ${backupPath}`);
  }
  
  // Записываем новую конфигурацию
  fs.writeFileSync('.env', newEnvContent);
  
  // Проверяем размер файла
  const stats = fs.statSync('.env');
  const fileSizeInBytes = stats.size;
  
  console.log('✅ .env файл успешно обновлен!');
  console.log(`📏 Размер файла: ${fileSizeInBytes} байт`);
  console.log(`⏰ Время обновления: ${new Date().toLocaleString('ru-RU')}`);
  
  // Показываем первые несколько строк для проверки
  console.log('\n📋 Первые строки нового .env файла:');
  console.log('─'.repeat(50));
  const lines = newEnvContent.split('\n').slice(0, 10);
  lines.forEach((line, index) => {
    if (line.trim()) {
      console.log(`${index + 1}: ${line}`);
    }
  });
  
  if (newEnvContent.split('\n').length > 10) {
    console.log('...');
    console.log(`... и еще ${newEnvContent.split('\n').length - 10} строк`);
  }
  
  console.log('\n🎉 Обновление завершено!');
  
} catch (error) {
  console.error('❌ Ошибка обновления .env файла:', error.message);
  process.exit(1);
} 