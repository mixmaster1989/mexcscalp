const fs = require('fs');
const path = require('path');

console.log('🔍 Проверяю .env файл...');

try {
  const envPath = path.join(__dirname, '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  console.log('📄 Содержимое .env файла:');
  console.log('='.repeat(50));
  console.log(envContent);
  console.log('='.repeat(50));
  
  // Проверяем наличие MEXC ключей
  const hasMexcApiKey = envContent.includes('MEXC_API_KEY=') && !envContent.includes('MEXC_API_KEY=your_');
  const hasMexcSecret = envContent.includes('MEXC_SECRET_KEY=') && !envContent.includes('MEXC_SECRET_KEY=your_');
  
  console.log('�� Статус ключей:');
  console.log(`MEXC_API_KEY: ${hasMexcApiKey ? '✅ ЕСТЬ' : '❌ НЕТ'}`);
  console.log(`MEXC_SECRET_KEY: ${hasMexcSecret ? '✅ ЕСТЬ' : '❌ НЕТ'}`);
  
} catch (error) {
  console.error('❌ Ошибка чтения .env файла:', error.message);
}
