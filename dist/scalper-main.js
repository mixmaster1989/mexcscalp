#!/usr/bin/env ts-node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const scalper_bot_1 = require("./bot/scalper-bot");
const trading_1 = require("./config/trading");
const fs_1 = __importDefault(require("fs"));
/**
 * Главная функция запуска ScalperBot
 */
async function main() {
    console.log('🚀 Запуск MEXC ScalperBot...');
    try {
        // Проверяем переменные окружения
        validateEnvironment();
        // Загружаем конфигурацию
        const config = loadConfiguration();
        // Создаем и запускаем бота
        const bot = new scalper_bot_1.ScalperBot(config);
        console.log('✅ Инициализация завершена, запуск торговли...');
        await bot.start();
        // Логируем статус каждые 30 секунд
        const statusInterval = setInterval(() => {
            console.log(bot.getQuickReport());
        }, 30000);
        // Логируем дневную статистику каждые 5 минут
        const dailyStatsInterval = setInterval(() => {
            const stats = bot.getStats();
            console.log('\n📊 Текущие показатели:');
            console.log(`Позиций: ${stats.status.positionsCount}`);
            console.log(`Дневной PnL: ${stats.status.dailyPnL.toFixed(2)} USDT`);
            console.log(`Винрейт: ${stats.performance.winRate.toFixed(1)}%`);
            console.log(`Profit Factor: ${stats.performance.profitFactor.toFixed(2)}`);
        }, 5 * 60 * 1000);
        // Graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n🛑 Получен сигнал остановки...');
            clearInterval(statusInterval);
            clearInterval(dailyStatsInterval);
            try {
                await bot.stop();
                console.log('✅ Бот успешно остановлен');
                process.exit(0);
            }
            catch (error) {
                console.error('❌ Ошибка остановки:', error);
                process.exit(1);
            }
        });
    }
    catch (error) {
        console.error('❌ Критическая ошибка:', error);
        process.exit(1);
    }
}
/**
 * Проверить переменные окружения
 */
function validateEnvironment() {
    const required = ['MEXC_API_KEY', 'MEXC_SECRET_KEY'];
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Отсутствуют переменные окружения: ${missing.join(', ')}`);
    }
    console.log('✅ Переменные окружения проверены');
}
/**
 * Загрузить конфигурацию
 */
function loadConfiguration() {
    const configPath = process.env.CONFIG_PATH || './config/trading.json';
    let customConfig = {};
    // Загружаем пользовательскую конфигурацию если есть
    if (fs_1.default.existsSync(configPath)) {
        try {
            const configData = fs_1.default.readFileSync(configPath, 'utf-8');
            customConfig = JSON.parse(configData);
            console.log(`✅ Конфигурация загружена из ${configPath}`);
        }
        catch (error) {
            console.warn(`⚠️ Ошибка загрузки конфигурации из ${configPath}, используются значения по умолчанию`);
        }
    }
    else {
        console.log('✅ Используется конфигурация по умолчанию');
    }
    // Переопределяем параметры из переменных окружения
    const envOverrides = {};
    if (process.env.DEPOSIT) {
        envOverrides.deposit = parseFloat(process.env.DEPOSIT);
    }
    if (process.env.POSITION_SIZE_PERCENT) {
        envOverrides.positionSizePercent = parseFloat(process.env.POSITION_SIZE_PERCENT);
    }
    if (process.env.TARGET_PROFIT_PERCENT) {
        envOverrides.targetProfitPercent = parseFloat(process.env.TARGET_PROFIT_PERCENT);
    }
    if (process.env.STOP_LOSS_PERCENT) {
        envOverrides.stopLossPercent = parseFloat(process.env.STOP_LOSS_PERCENT);
    }
    if (process.env.TRADING_PAIRS) {
        envOverrides.targetPairs = process.env.TRADING_PAIRS.split(',').map(p => p.trim());
    }
    const finalConfig = { ...trading_1.defaultConfig, ...customConfig, ...envOverrides };
    console.log('📋 Конфигурация торговли:');
    console.log(`  💰 Депозит: ${finalConfig.deposit} USDT`);
    console.log(`  📊 Торговые пары: ${finalConfig.targetPairs.join(', ')}`);
    console.log(`  💹 Размер позиции: ${finalConfig.positionSizePercent}% депо`);
    console.log(`  🎯 Цель прибыли: ${finalConfig.targetProfitPercent}%`);
    console.log(`  🛡️ Стоп-лосс: ${finalConfig.stopLossPercent}%`);
    console.log(`  ⏱️ Длительность сделок: ${finalConfig.minTradeTimeMs / 1000}-${finalConfig.maxTradeTimeMs / 1000} сек`);
    return finalConfig;
}
/**
 * Создать пример конфигурации
 */
function createExampleConfig() {
    const exampleConfig = {
        deposit: 100,
        targetPairs: ['ETH/USDC', 'BTC/USDC'],
        positionSizePercent: 8,
        targetProfitPercent: 0.2,
        stopLossPercent: 0.3,
        dailyLossLimit: 5,
        dailyTargetProfit: 2,
        minVolatilityThreshold: 0.05,
        maxSpreadPercent: 0.1
    };
    const configDir = './config';
    if (!fs_1.default.existsSync(configDir)) {
        fs_1.default.mkdirSync(configDir, { recursive: true });
    }
    fs_1.default.writeFileSync('./config/trading.json', JSON.stringify(exampleConfig, null, 2));
    console.log('✅ Создан пример конфигурации в ./config/trading.json');
}
/**
 * CLI команды
 */
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🤖 MEXC ScalperBot - Автоматический торговый бот

Использование:
  npm run start              Запустить бота
  npm run start:example      Создать пример конфигурации
  
Переменные окружения:
  MEXC_API_KEY              API ключ MEXC (обязательно)
  MEXC_SECRET_KEY           Секретный ключ MEXC (обязательно)
  CONFIG_PATH               Путь к файлу конфигурации
  DEPOSIT                   Размер депозита в USDT
  POSITION_SIZE_PERCENT     Размер позиции в % от депо
  TARGET_PROFIT_PERCENT     Целевая прибыль в %
  STOP_LOSS_PERCENT         Стоп-лосс в %
  TRADING_PAIRS             Торговые пары через запятую

Примеры:
  DEPOSIT=200 npm run start
  TRADING_PAIRS="ETH/USDC,BTC/USDC" npm run start
  
Для получения API ключей:
  1. Зарегистрируйтесь на MEXC
  2. Создайте API ключи в настройках аккаунта
  3. Добавьте их в файл .env
  `);
    process.exit(0);
}
if (args.includes('--create-config')) {
    createExampleConfig();
    process.exit(0);
}
// Запускаем основную функцию
main().catch(error => {
    console.error('💥 Фатальная ошибка:', error);
    process.exit(1);
});
//# sourceMappingURL=scalper-main.js.map