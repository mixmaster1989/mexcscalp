"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegratedTradingSystem = void 0;
require("dotenv/config");
const market_analyzer_1 = require("./market-analysis/market-analyzer");
const paper_trading_1 = require("./paper-trading/paper-trading");
const result_analyzer_1 = require("./paper-trading/analysis/result-analyzer");
const llm_analyzer_1 = require("./llm/llm-analyzer");
const telegram_notifier_1 = require("./telegram/telegram-notifier");
class IntegratedTradingSystem {
    analyzer;
    paperTrading;
    llmAnalyzer;
    telegramNotifier;
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
        // Создаем LLM анализатор
        this.llmAnalyzer = new llm_analyzer_1.LLMAnalyzer(process.env.LLM_API);
        // Создаем Telegram уведомления
        this.telegramNotifier = new telegram_notifier_1.TelegramNotifier(process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_ADMIN_CHAT_IDS);
    }
    /**
     * Запустить интегрированную систему
     */
    async start() {
        console.log('🚀 Запуск интегрированной системы с LLM и Telegram...');
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
            console.log(`🤖 LLM анализ: ${this.config.llmEnabled ? 'включен' : 'отключен'}`);
            console.log(`📱 Telegram уведомления: ${this.config.telegramEnabled ? 'включены' : 'отключены'}`);
            // Отправляем уведомление о запуске
            if (this.config.telegramEnabled) {
                await this.telegramNotifier.sendSystemStarted();
            }
        }
        catch (error) {
            console.error('❌ Ошибка запуска системы:', error);
            if (this.config.telegramEnabled) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                await this.telegramNotifier.sendError('Ошибка запуска системы', errorMessage);
            }
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
        // Обработчик сигналов
        this.analyzer.setOnSignal(async (signal) => {
            if (signal.signal === 'BUY') {
                await this.handleBuySignal(signal);
            }
        });
        // Обработчик анализа рынка
        this.analyzer.setOnAnalysis((analysis) => {
            this.handleMarketAnalysis(analysis);
        });
        // Обработчик ошибок
        this.analyzer.setOnError(async (error) => {
            console.error('❌ Ошибка анализатора:', error);
            if (this.config.telegramEnabled) {
                await this.telegramNotifier.sendError('Ошибка анализатора', error.message);
            }
        });
    }
    /**
     * Обработать сигнал на покупку
     */
    async handleBuySignal(signal) {
        console.log(`\n🎯 Получен сигнал BUY для ${signal.symbol}`);
        console.log(`   Уверенность: ${signal.confidence}%`);
        console.log(`   Причина: ${signal.reason}`);
        // Получаем анализ рынка для создания снимка
        const analysis = this.analyzer.getMarketAnalysis(signal.symbol);
        if (!analysis) {
            console.log('⚠️ Нет данных анализа для создания снимка');
            return;
        }
        // Создаем сделку
        const currentCandle = {
            open: analysis.currentPrice,
            high: analysis.currentPrice * 1.001,
            low: analysis.currentPrice * 0.999,
            close: analysis.currentPrice,
            volume: 1000,
            timestamp: analysis.timestamp
        };
        const historicalCandles = [currentCandle];
        const trade = this.paperTrading.processSignal(signal, analysis, currentCandle, historicalCandles);
        if (trade) {
            console.log(`✅ Сделка создана: ${trade.id}`);
            // LLM анализ сделки
            if (this.config.llmEnabled) {
                try {
                    const llmAnalysis = await this.llmAnalyzer.analyzeTrade(trade, trade.marketSnapshot, signal);
                    console.log('🧠 LLM анализ завершен');
                    // Отправляем анализ в Telegram
                    if (this.config.telegramEnabled) {
                        await this.telegramNotifier.sendTradeAnalysis(trade.symbol, llmAnalysis.action, trade.entryPrice, llmAnalysis.confidence, llmAnalysis.reasoning, llmAnalysis.patterns, llmAnalysis.marketConditions, llmAnalysis.recommendation);
                    }
                }
                catch (error) {
                    console.error('❌ Ошибка LLM анализа:', error);
                }
            }
        }
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
            // LLM анализ результатов
            if (this.config.llmEnabled) {
                try {
                    const llmSummary = await this.llmAnalyzer.analyzeResults(closedTrades, marketSnapshots, report.summary);
                    console.log('🧠 LLM анализ результатов завершен');
                    // Отправляем отчет в Telegram
                    if (this.config.telegramEnabled) {
                        await this.telegramNotifier.sendMarketReport(report.summary.totalTrades, report.summary.winRate, report.summary.profitFactor, llmSummary.tradingOpportunities[0] || "Не определен", llmSummary.marketOverview, llmSummary.recommendations);
                    }
                }
                catch (error) {
                    console.error('❌ Ошибка LLM анализа результатов:', error);
                }
            }
            // Сохраняем данные
            await this.paperTrading.saveData();
            this.lastAnalysisTime = now;
        }
        catch (error) {
            console.error('❌ Ошибка анализа:', error);
            if (this.config.telegramEnabled) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                await this.telegramNotifier.sendError('Ошибка анализа', errorMessage);
            }
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
    /**
     * Отправить тестовое сообщение
     */
    async sendTestMessage() {
        if (this.config.telegramEnabled) {
            await this.telegramNotifier.sendTestMessage();
        }
    }
}
exports.IntegratedTradingSystem = IntegratedTradingSystem;
//# sourceMappingURL=integrated-system.js.map