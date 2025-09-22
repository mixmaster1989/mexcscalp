"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegratedPaperTradingSystem = void 0;
require("dotenv/config");
const market_analyzer_1 = require("../market-analysis/market-analyzer");
const paper_trading_1 = require("./paper-trading");
const result_analyzer_1 = require("./analysis/result-analyzer");
class IntegratedPaperTradingSystem {
    analyzer;
    paperTrading;
    config;
    isRunning = false;
    analysisTimer = null;
    lastAnalysisTime = 0;
    constructor(config) {
        this.config = config;
        // Создаем анализатор рынка
        const analyzerConfig = {
            symbols: config.symbols,
            intervals: config.intervals,
            updateInterval: config.updateInterval,
            enableWebSocket: config.enableWebSocket,
            enableRest: config.enableRest
        };
        this.analyzer = new market_analyzer_1.MarketAnalyzer(analyzerConfig);
        // Создаем систему paper trading
        this.paperTrading = new paper_trading_1.PaperTradingSystem();
    }
    /**
     * Запустить интегрированную систему
     */
    async start() {
        console.log('🚀 Запуск интегрированной системы paper trading...');
        try {
            // Настраиваем обработчики анализатора
            this.setupAnalyzerHandlers();
            // Запускаем анализатор
            await this.analyzer.start();
            // Запускаем периодический анализ
            this.startPeriodicAnalysis();
            this.isRunning = true;
            console.log('✅ Интегрированная система запущена');
            console.log(`💰 Начальный баланс: $${this.paperTrading.getBalance().toFixed(2)}`);
            console.log(`📊 Торговые пары: ${this.config.symbols.join(', ')}`);
            console.log(`🎯 Размер позиции: ${this.config.positionSize * 100}%`);
            console.log(`📈 Максимум открытых сделок: ${this.config.maxOpenTrades}`);
        }
        catch (error) {
            console.error('❌ Ошибка запуска системы:', error);
            throw error;
        }
    }
    /**
     * Остановить систему
     */
    stop() {
        console.log('🛑 Остановка интегрированной системы...');
        this.isRunning = false;
        if (this.analysisTimer) {
            clearInterval(this.analysisTimer);
            this.analysisTimer = null;
        }
        this.analyzer.stop();
        console.log('✅ Система остановлена');
    }
    /**
     * Настроить обработчики анализатора
     */
    setupAnalyzerHandlers() {
        // Обработчик анализа рынка
        this.analyzer.setOnAnalysis((analysis) => {
            this.handleMarketAnalysis(analysis);
        });
        // Обработчик ошибок
        this.analyzer.setOnError((error) => {
            console.error('❌ Ошибка анализатора:', error);
        });
    }
    /**
     * Обработать анализ рынка
     */
    handleMarketAnalysis(analysis) {
        // Обновляем открытые сделки с текущими ценами
        const currentPrices = new Map();
        currentPrices.set(analysis.symbol, analysis.currentPrice);
        this.paperTrading.updateTrades(currentPrices);
    }
    /**
     * Запустить периодический анализ
     */
    startPeriodicAnalysis() {
        this.analysisTimer = setInterval(async () => {
            await this.performAnalysis();
        }, this.config.analysisInterval * 60 * 1000);
    }
    /**
     * Выполнить анализ результатов
     */
    async performAnalysis() {
        if (!this.isRunning)
            return;
        const now = Date.now();
        const timeSinceLastAnalysis = (now - this.lastAnalysisTime) / (1000 * 60);
        if (timeSinceLastAnalysis < this.config.analysisInterval)
            return;
        console.log('\n📊 Выполняем анализ результатов...');
        try {
            // Получаем данные
            const closedTrades = this.paperTrading.getClosedTrades();
            const marketSnapshots = this.paperTrading.getAllMarketSnapshots();
            if (closedTrades.length === 0) {
                console.log('📝 Нет закрытых сделок для анализа');
                return;
            }
            // Создаем анализатор
            const analyzer = new result_analyzer_1.ResultAnalyzer(closedTrades, marketSnapshots);
            // Генерируем отчет
            const report = analyzer.generateReport();
            // Выводим результаты
            this.displayAnalysisReport(report);
            // Сохраняем данные
            await this.paperTrading.saveData();
            this.lastAnalysisTime = now;
        }
        catch (error) {
            console.error('❌ Ошибка анализа:', error);
        }
    }
    /**
     * Отобразить отчет анализа
     */
    displayAnalysisReport(report) {
        console.log('\n' + '═'.repeat(60));
        console.log('📊 ОТЧЕТ АНАЛИЗА РЕЗУЛЬТАТОВ');
        console.log('═'.repeat(60));
        // Общая статистика
        console.log(`\n📈 ОБЩАЯ СТАТИСТИКА:`);
        console.log(`   Всего сделок: ${report.summary.totalTrades}`);
        console.log(`   Винрейт: ${report.summary.winRate.toFixed(1)}%`);
        console.log(`   Profit Factor: ${report.summary.profitFactor.toFixed(2)}`);
        console.log(`   Лучший паттерн: ${report.summary.bestPattern}`);
        console.log(`   Худший паттерн: ${report.summary.worstPattern}`);
        // Топ корреляции
        console.log(`\n🔗 ТОП КОРРЕЛЯЦИИ:`);
        report.correlations.slice(0, 5).forEach((corr, i) => {
            const emoji = Math.abs(corr.correlation) > 0.5 ? '🔥' : Math.abs(corr.correlation) > 0.3 ? '⚡' : '📊';
            console.log(`   ${i + 1}. ${emoji} ${corr.factor}: ${corr.correlation.toFixed(3)} (${corr.description})`);
        });
        // Топ паттерны
        console.log(`\n🎯 ТОП ПАТТЕРНЫ:`);
        report.patterns.slice(0, 5).forEach((pattern, i) => {
            const emoji = pattern.winRate > 70 ? '🏆' : pattern.winRate > 60 ? '🥇' : pattern.winRate > 50 ? '🥈' : '🥉';
            console.log(`   ${i + 1}. ${emoji} ${pattern.pattern}: ${pattern.winRate.toFixed(1)}% (${pattern.frequency} случаев)`);
        });
        // Рекомендации
        if (report.recommendations.length > 0) {
            console.log(`\n💡 РЕКОМЕНДАЦИИ:`);
            report.recommendations.slice(0, 5).forEach((rec, i) => {
                console.log(`   ${i + 1}. ${rec}`);
            });
        }
        console.log('\n' + '═'.repeat(60));
    }
    /**
     * Получить текущую статистику
     */
    getCurrentStats() {
        return this.paperTrading.getTradingStats();
    }
    /**
     * Получить открытые сделки
     */
    getOpenTrades() {
        return this.paperTrading.getOpenTrades();
    }
    /**
     * Получить баланс
     */
    getBalance() {
        return this.paperTrading.getBalance();
    }
}
exports.IntegratedPaperTradingSystem = IntegratedPaperTradingSystem;
//# sourceMappingURL=integrated-paper-trading.js.map