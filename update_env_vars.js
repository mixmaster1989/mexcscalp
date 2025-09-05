const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

// Читаем текущий .env файл
let envContent = fs.readFileSync(envPath, 'utf8');

// Добавляем недостающие переменные после ORDER_NOTIONAL_USD
const newVars = `
# Risk management
LEVELS=6
MAX_TOTAL_ORDERS=10
MAX_TOTAL_NOTIONAL=40`;

// Вставляем после ORDER_NOTIONAL_USD
envContent = envContent.replace(
  /ORDER_NOTIONAL_USD=1\.5/,
  `ORDER_NOTIONAL_USD=1.5${newVars}`
);

// Записываем обновленный файл
fs.writeFileSync(envPath, envContent);

console.log('✅ Переменные добавлены в .env:');
console.log('   LEVELS=6');
console.log('   MAX_TOTAL_ORDERS=10');
console.log('   MAX_TOTAL_NOTIONAL=40'); 