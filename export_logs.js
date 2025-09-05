#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('📋 Экспорт логов mexcscalp...\n');

try {
    // Получаем последние 300 строк логов
    console.log('📊 Получение последних 300 строк логов...');
    const logs = execSync('pm2 logs mexcscalp --lines 300 --nostream', { 
        encoding: 'utf8',
        cwd: process.cwd()
    });
    
    // Создаем имя файла с текущей датой и временем
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `mexcscalp_logs_${timestamp}.txt`;
    
    // Создаем папку logs если её нет
    const logsDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
        console.log('📁 Создана папка logs/');
    }
    
    // Путь к файлу
    const filepath = path.join(logsDir, filename);
    
    // Записываем логи в файл
    fs.writeFileSync(filepath, logs);
    
    // Получаем размер файла
    const stats = fs.statSync(filepath);
    const fileSizeInKB = (stats.size / 1024).toFixed(2);
    
    console.log('✅ Логи успешно экспортированы!');
    console.log(`📁 Файл: ${filepath}`);
    console.log(`📏 Размер: ${fileSizeInKB} KB`);
    console.log(`📊 Строк: ${logs.split('\n').length}`);
    console.log(`⏰ Время: ${now.toLocaleString('ru-RU')}`);
    
    // Показываем первые 5 строк для проверки
    console.log('\n📋 Первые 5 строк логов:');
    console.log('─'.repeat(80));
    const lines = logs.split('\n').slice(0, 5);
    lines.forEach((line, index) => {
        if (line.trim()) {
            console.log(`${index + 1}: ${line}`);
        }
    });
    
    if (logs.split('\n').length > 5) {
        console.log('...');
        console.log(`... и еще ${logs.split('\n').length - 5} строк`);
    }
    
} catch (error) {
    console.error('❌ Ошибка экспорта логов:', error.message);
    
    if (error.message.includes('pm2')) {
        console.log('\n💡 Возможные решения:');
        console.log('1. Убедитесь, что PM2 установлен: npm install -g pm2');
        console.log('2. Проверьте, что процесс mexcscalp запущен: pm2 status');
        console.log('3. Попробуйте запустить от имени root или с sudo');
    }
    
    process.exit(1);
}

console.log('\n🎉 Экспорт завершен!'); 