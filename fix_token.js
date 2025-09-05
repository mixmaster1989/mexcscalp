#!/usr/bin/env node

const fs = require('fs');

console.log('🔧 Исправление токена Telegram бота...\n');

try {
  // Читаем текущий .env файл
  const envContent = fs.readFileSync('.env', 'utf8');
  
  // Заменяем неправильный токен на правильный
  const fixedContent = envContent.replace(
    'TELEGRAM_BOT_TOKEN=7975252884',
    'TELEGRAM_BOT_TOKEN=7975252884:AAHCMfBpWXS67g2dyWEdmEmONjs6BUe2r94'
  );
  
  // Записываем исправленный файл
  fs.writeFileSync('.env', fixedContent);
  
  console.log('✅ Токен Telegram бота исправлен!');
  console.log('🔑 Новый токен: 7975252884:AAHCMfBpWXS67g2dyWEdmEmONjs6BUe2r94');
  console.log('⏰ Время исправления:', new Date().toLocaleString('ru-RU'));
  
} catch (error) {
  console.error('❌ Ошибка исправления токена:', error.message);
  process.exit(1);
}

console.log('\n🎉 Токен исправлен!'); 