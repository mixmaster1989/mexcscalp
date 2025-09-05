const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

// Читаем текущий .env файл
let envContent = fs.readFileSync(envPath, 'utf8');

// Обновляем настройки
envContent = envContent.replace(/LEVELS=2/g, 'LEVELS=6');
envContent = envContent.replace(/MAX_TOTAL_NOTIONAL=20/g, 'MAX_TOTAL_NOTIONAL=40');

// Записываем обновленный файл
fs.writeFileSync(envPath, envContent);

console.log('✅ Настройки обновлены:');
console.log('   LEVELS: 2 → 6');
console.log('   MAX_TOTAL_NOTIONAL: $20 → $40');
console.log('   MAX_TOTAL_ORDERS: остается 10'); 