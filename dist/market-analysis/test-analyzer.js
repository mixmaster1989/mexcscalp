"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testAnalyzer = testAnalyzer;
require("dotenv/config");
const market_analyzer_1 = require("./market-analyzer");
/**
 * Тест анализатора рынка
 */
async function testAnalyzer() {
    console.log('🧪 Тестирование анализатора рынка...');
    const config = {
        symbols: ['ETH/USDC', 'BTC/USDC'],
        intervals: ['1m', '5m'],
        updateInterval: 10000, // 10 секунд
        enableWebSocket: true,
        enableRest: true
    };
    const analyzer = new market_analyzer_1.MarketAnalyzer(config);
    // Настраиваем обработчики
    analyzer.setOnSignal((signal) => {
        console.log(`\n🎯 Получен сигнал: ${signal.signal} для ${signal.symbol}`);
        console.log(`   Уверенность: ${signal.confidence}%`);
        console.log(`   Причина: ${signal.reason}`);
    });
    analyzer.setOnAnalysis((analysis) => {
        const trendEmoji = analysis.trend === 'UP' ? '📈' : analysis.trend === 'DOWN' ? '📉' : '➡️';
        const minEmoji = analysis.isLocalMinimum ? '🔍' : '';
        console.log(`${trendEmoji} ${analysis.symbol}: ${analysis.trend} (${analysis.trendStrength.toFixed(1)}%) | ` +
            `RSI: ${analysis.rsi.toFixed(1)} | ${minEmoji}Лок.мин: ${analysis.isLocalMinimum} | ` +
            `BB: ${analysis.bollinger.position.toFixed(1)}%`);
    });
    analyzer.setOnError((error) => {
        console.error('❌ Ошибка анализатора:', error);
    });
    try {
        await analyzer.start();
        console.log('✅ Анализатор запущен и работает...');
        console.log('💡 Нажмите Ctrl+C для остановки');
        // Graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n🛑 Получен сигнал остановки...');
            analyzer.stop();
            console.log('✅ Анализатор остановлен');
            process.exit(0);
        });
    }
    catch (error) {
        console.error('❌ Ошибка запуска:', error);
        process.exit(1);
    }
}
// Запуск теста
if (require.main === module) {
    testAnalyzer().catch(console.error);
}
//# sourceMappingURL=test-analyzer.js.map