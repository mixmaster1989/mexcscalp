#!/usr/bin/env node

require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');

console.log('🧪 ТЕСТИРОВАНИЕ ВСЕХ КОМПОНЕНТОВ MEXCSCALP');
console.log('='.repeat(60));

// Функция для выполнения команды с таймаутом
function runCommand(command, timeout = 30000) {
    try {
        console.log(`\n🔄 Выполняю: ${command}`);
        const result = execSync(command, { 
            timeout, 
            encoding: 'utf8',
            stdio: 'pipe'
        });
        console.log('✅ Успешно');
        return { success: true, output: result };
    } catch (error) {
        console.log(`❌ Ошибка: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// Тест 1: Проверка сборки проекта
function testBuild() {
    console.log('\n📦 ТЕСТ 1: Сборка проекта');
    console.log('-'.repeat(40));
    
    const result = runCommand('npm run build');
    if (result.success) {
        console.log('✅ Проект успешно собран');
        return true;
    } else {
        console.log('❌ Ошибка сборки');
        return false;
    }
}

// Тест 2: Проверка зависимостей
function testDependencies() {
    console.log('\n📚 ТЕСТ 2: Проверка зависимостей');
    console.log('-'.repeat(40));
    
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const requiredDeps = ['axios', 'dotenv', 'ws', 'pino'];
    
    let allPresent = true;
    requiredDeps.forEach(dep => {
        if (packageJson.dependencies[dep]) {
            console.log(`✅ ${dep}: ${packageJson.dependencies[dep]}`);
        } else {
            console.log(`❌ ${dep}: отсутствует`);
            allPresent = false;
        }
    });
    
    return allPresent;
}

// Тест 3: Проверка .env файла
function testEnvFile() {
    console.log('\n🔧 ТЕСТ 3: Проверка .env файла');
    console.log('-'.repeat(40));
    
    const requiredVars = [
        'MEXC_API_KEY',
        'MEXC_SECRET_KEY', 
        'TELEGRAM_BOT_TOKEN',
        'TELEGRAM_ADMIN_CHAT_IDS',
        'LLM_API'
    ];
    
    let allPresent = true;
    requiredVars.forEach(varName => {
        if (process.env[varName]) {
            console.log(`✅ ${varName}: настроен`);
        } else {
            console.log(`❌ ${varName}: отсутствует`);
            allPresent = false;
        }
    });
    
    return allPresent;
}

// Тест 4: Проверка TypeScript компиляции
function testTypeScript() {
    console.log('\n🔨 ТЕСТ 4: Проверка TypeScript');
    console.log('-'.repeat(40));
    
    const result = runCommand('npx tsc --noEmit');
    if (result.success) {
        console.log('✅ TypeScript компиляция без ошибок');
        return true;
    } else {
        console.log('❌ Ошибки TypeScript');
        return false;
    }
}

// Тест 5: Проверка структуры файлов
function testFileStructure() {
    console.log('\n📁 ТЕСТ 5: Проверка структуры файлов');
    console.log('-'.repeat(40));
    
    const requiredFiles = [
        'src/main.ts',
        'src/paper-trading-main.ts',
        'src/market-analysis/market-analyzer.ts',
        'src/paper-trading/paper-trading.ts',
        'src/paper-trading/data/market-snapshot.ts',
        'src/paper-trading/analysis/result-analyzer.ts',
        'dist/main.js',
        'dist/paper-trading-main.js'
    ];
    
    let allPresent = true;
    requiredFiles.forEach(file => {
        if (fs.existsSync(file)) {
            console.log(`✅ ${file}`);
        } else {
            console.log(`❌ ${file}: отсутствует`);
            allPresent = false;
        }
    });
    
    return allPresent;
}

// Тест 6: Проверка импортов
function testImports() {
    console.log('\n🔗 ТЕСТ 6: Проверка импортов');
    console.log('-'.repeat(40));
    
    try {
        // Проверяем что основные модули можно импортировать
        const mainModule = require('./dist/main.js');
        console.log('✅ main.js импортируется');
        
        const paperTradingModule = require('./dist/paper-trading-main.js');
        console.log('✅ paper-trading-main.js импортируется');
        
        return true;
    } catch (error) {
        console.log(`❌ Ошибка импорта: ${error.message}`);
        return false;
    }
}

// Тест 7: Проверка API подключений
async function testApiConnections() {
    console.log('\n🌐 ТЕСТ 7: Проверка API подключений');
    console.log('-'.repeat(40));
    
    try {
        const axios = require('axios');
        
        // Тест MEXC API
        console.log('🔄 Тестирую MEXC API...');
        const mexcResponse = await axios.get('https://api.mexc.com/api/v3/ping', { timeout: 10000 });
        if (mexcResponse.status === 200) {
            console.log('✅ MEXC API доступен');
        } else {
            console.log('❌ MEXC API недоступен');
            return false;
        }
        
        // Тест Cloud.ru LLM API
        console.log('🔄 Тестирую Cloud.ru LLM API...');
        const llmResponse = await axios.post(
            'https://foundation-models.api.cloud.ru/v1/chat/completions',
            {
                model: 'openai/gpt-oss-120b',
                messages: [{ role: 'user', content: 'Тест' }],
                max_tokens: 10
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.LLM_API}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            }
        );
        
        if (llmResponse.status === 200) {
            console.log('✅ Cloud.ru LLM API доступен');
        } else {
            console.log('❌ Cloud.ru LLM API недоступен');
            return false;
        }
        
        return true;
    } catch (error) {
        console.log(`❌ Ошибка API: ${error.message}`);
        return false;
    }
}

// Основная функция тестирования
async function runAllTests() {
    console.log('🚀 Запуск полного тестирования...\n');
    
    const tests = [
        { name: 'Сборка проекта', fn: testBuild },
        { name: 'Зависимости', fn: testDependencies },
        { name: '.env файл', fn: testEnvFile },
        { name: 'TypeScript', fn: testTypeScript },
        { name: 'Структура файлов', fn: testFileStructure },
        { name: 'Импорты', fn: testImports },
        { name: 'API подключения', fn: testApiConnections }
    ];
    
    const results = [];
    
    for (const test of tests) {
        try {
            const result = await test.fn();
            results.push({ name: test.name, success: result });
        } catch (error) {
            console.log(`❌ Критическая ошибка в тесте "${test.name}": ${error.message}`);
            results.push({ name: test.name, success: false });
        }
    }
    
    // Итоговый отчет
    console.log('\n' + '='.repeat(60));
    console.log('📊 ИТОГОВЫЙ ОТЧЕТ ТЕСТИРОВАНИЯ');
    console.log('='.repeat(60));
    
    let passedTests = 0;
    results.forEach((result, index) => {
        const status = result.success ? '✅' : '❌';
        console.log(`${status} ${index + 1}. ${result.name}`);
        if (result.success) passedTests++;
    });
    
    console.log(`\n📈 Результат: ${passedTests}/${results.length} тестов пройдено`);
    
    if (passedTests === results.length) {
        console.log('🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ! Проект готов к запуску.');
        return true;
    } else {
        console.log('⚠️  НЕКОТОРЫЕ ТЕСТЫ НЕ ПРОЙДЕНЫ. Требуется исправление.');
        return false;
    }
}

// Запуск тестов
if (require.main === module) {
    runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('❌ Критическая ошибка:', error);
        process.exit(1);
    });
}

module.exports = { runAllTests };
