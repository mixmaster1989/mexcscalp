"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
require("dotenv/config");
const integrated_paper_trading_1 = require("./paper-trading/integrated-paper-trading");
/**
 * Главный файл paper trading системы
 */
async function main() {
    console.log('🚀 MEXC Paper Trading System');
    console.log('📊 Поиск локальных минимумов для покупки');
    // Конфигурация системы
    const config = {
        symbols: ['ETH/USDC', 'BTC/USDC'],
        intervals: ['1m', '5m'],
        updateInterval: 5000, // 5 секунд
        enableWebSocket: true,
        enableRest: true,
        positionSize: 0.1, // 10% от баланса на сделку
        maxOpenTrades: 2, // Максимум 2 открытые сделки
        tradeTimeout: 30, // Таймаут сделки 30 минут
        analysisInterval: 10 // Анализ каждые 10 минут
    };
    // Создаем систему
    const system = new integrated_paper_trading_1.IntegratedPaperTradingSystem(config);
    try {
        // Запускаем систему
        await system.start();
        console.log('✅ Paper trading система запущена и работает...');
        console.log('💡 Система будет искать локальные минимумы для покупки');
        console.log('💡 Нажмите Ctrl+C для остановки');
        // Показываем статистику каждые 2 минуты
        const statsInterval = setInterval(() => {
            const stats = system.getCurrentStats();
            const balance = system.getBalance();
            const openTrades = system.getOpenTrades();
            console.log(`\n📊 СТАТУС: Баланс: $${balance.toFixed(2)} | Сделок: ${stats.totalTrades} | Винрейт: ${stats.winRate.toFixed(1)}% | Открыто: ${openTrades.length}`);
        }, 2 * 60 * 1000);
        // Graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n🛑 Получен сигнал остановки...');
            clearInterval(statsInterval);
            system.stop();
            console.log('✅ Paper trading система остановлена');
            process.exit(0);
        });
    }
    catch (error) {
        console.error('❌ Ошибка запуска:', error);
        process.exit(1);
    }
}
// Запуск приложения
if (require.main === module) {
    main().catch(console.error);
}
//# sourceMappingURL=paper-trading-main.js.map