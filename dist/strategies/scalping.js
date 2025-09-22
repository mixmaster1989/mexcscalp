"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScalpingStrategy = void 0;
const technical_1 = require("../indicators/technical");
/**
 * Скальпинговая торговая стратегия
 */
class ScalpingStrategy {
    config;
    mexcRest;
    mexcWs;
    indicators;
    riskManager;
    positionManager;
    logger;
    telegram;
    marketData = new Map();
    lastPrices = new Map();
    isRunning = false;
    constructor(config, mexcRest, mexcWs, riskManager, positionManager, logger, telegram = null) {
        this.config = config;
        this.mexcRest = mexcRest;
        this.mexcWs = mexcWs;
        this.riskManager = riskManager;
        this.positionManager = positionManager;
        this.logger = logger;
        this.telegram = telegram;
        this.indicators = new technical_1.TechnicalIndicators();
        this.setupWebSocketHandlers();
    }
    /**
     * Запустить стратегию
     */
    async start() {
        this.isRunning = true;
        this.logger.info('Запуск скальпинговой стратегии');
        // Сбрасываем историю цен при старте
        this.lastPrices.clear();
        // Подписываемся на рыночные данные
        for (const symbol of this.config.targetPairs) {
            this.logger.info({ symbol }, 'Подписываемся на символ');
            this.mexcWs.subscribeBookTicker(symbol);
            this.mexcWs.subscribeTrades(symbol);
            // Инициализируем данные
            this.marketData.set(symbol, {
                symbol,
                price: 0,
                volume: 0,
                timestamp: Date.now()
            });
        }
        // Запускаем основной торговый цикл
        this.startTradingLoop();
    }
    /**
     * Остановить стратегию
     */
    async stop() {
        this.isRunning = false;
        this.logger.info('Остановка скальпинговой стратегии');
        // Закрываем все позиции
        await this.positionManager.closeAllPositions('emergency');
    }
    /**
     * Настроить обработчики WebSocket
     */
    setupWebSocketHandlers() {
        this.mexcWs.on('bookTicker', (ticker) => {
            this.handleBookTicker(ticker);
        });
        this.mexcWs.on('trade', (trade) => {
            this.handleTrade(trade);
        });
        this.mexcWs.on('error', (error) => {
            this.logger.error({ error }, 'Ошибка WebSocket');
        });
    }
    /**
     * Обработать обновление лучших цен
     */
    async handleBookTicker(ticker) {
        this.logger.info({ ticker }, 'Получен BookTicker');
        const symbol = ticker.symbol;
        const midPrice = (ticker.bidPrice + ticker.askPrice) / 2;
        // Проверяем на аварийный гэп
        const lastPrice = this.lastPrices.get(symbol);
        if (lastPrice && this.riskManager.checkEmergencyGap(lastPrice, midPrice)) {
            this.logger.warn({ symbol, lastPrice, midPrice }, 'Обнаружен аварийный гэп');
            await this.positionManager.closeAllPositions('emergency');
            return;
        }
        this.lastPrices.set(symbol, midPrice);
        // Обновляем рыночные данные
        const marketData = this.marketData.get(symbol);
        if (marketData) {
            marketData.price = midPrice;
            marketData.timestamp = Date.now();
            // Добавляем цену в индикаторы
            this.indicators.addPrice(symbol, midPrice);
            // Логируем состояние индикаторов
            const series = this.indicators.priceSeries.get(symbol);
            const seriesLength = series ? series.length : 0;
            this.logger.info({ symbol, price: midPrice, seriesLength }, 'Цена добавлена в индикаторы');
            // Анализируем стакан
            marketData.orderbook = this.indicators.analyzeOrderbook({
                bids: [{ price: ticker.bidPrice, quantity: ticker.bidQty }],
                asks: [{ price: ticker.askPrice, quantity: ticker.askQty }],
                timestamp: Date.now()
            }, midPrice);
        }
    }
    /**
     * Обработать сделку
     */
    handleTrade(trade) {
        const symbol = trade.symbol;
        this.indicators.addPrice(symbol, trade.price, trade.quantity);
    }
    /**
     * Основной торговый цикл
     */
    startTradingLoop() {
        this.logger.info('🔄 Запуск торгового цикла');
        const loop = async () => {
            if (!this.isRunning) {
                this.logger.debug('⏹️ Торговый цикл остановлен');
                return;
            }
            try {
                this.logger.debug('📊 Торговый цикл: начало итерации');
                // Обновляем дневную статистику
                this.riskManager.resetDailyStats();
                // Обновляем позиции
                await this.updatePositions();
                // Ищем торговые сигналы
                const shouldPause = this.riskManager.shouldPause();
                this.logger.debug(`🛡️ Проверка риск-менеджера: shouldPause=${shouldPause}`);
                if (!shouldPause) {
                    this.logger.debug('🔍 Начинаем сканирование сигналов');
                    await this.scanForSignals();
                }
                else {
                    this.logger.info('⏸️ Торговля приостановлена риск-менеджером');
                }
            }
            catch (error) {
                this.logger.error({ error }, 'Ошибка в торговом цикле');
            }
            // Планируем следующую итерацию
            if (this.isRunning) {
                this.logger.debug(`⏰ Планируем следующую итерацию через ${this.config.marketScanIntervalMs}ms`);
                setTimeout(loop, this.config.marketScanIntervalMs);
            }
        };
        // Запускаем цикл
        this.logger.info(`⏰ Первая итерация торгового цикла через ${this.config.marketScanIntervalMs}ms`);
        setTimeout(loop, this.config.marketScanIntervalMs);
    }
    /**
     * Обновить все позиции
     */
    async updatePositions() {
        try {
            const updates = await this.positionManager.updatePositions();
            for (const update of updates) {
                if (update.shouldClose) {
                    await this.positionManager.closePosition(update.position.id, update.closeReason);
                    this.riskManager.onPositionClosed(update.position, update.currentPrice, update.closeReason);
                }
            }
        }
        catch (error) {
            this.logger.error({ error }, 'Ошибка обновления позиций');
        }
    }
    /**
     * Сканировать рынок на предмет торговых сигналов
     */
    async scanForSignals() {
        this.logger.debug(`🔍 Сканирование сигналов для ${this.config.targetPairs.length} символов`);
        for (const symbol of this.config.targetPairs) {
            try {
                this.logger.debug(`📈 Анализируем символ: ${symbol}`);
                const signal = await this.analyzeSymbol(symbol);
                if (signal && signal.action !== 'hold') {
                    this.logger.info({ signal }, `🎯 Найден торговый сигнал для ${symbol}`);
                    await this.executeSignal(signal);
                }
                else {
                    this.logger.debug(`📊 ${symbol}: ${signal ? 'HOLD сигнал' : 'нет сигнала'}`);
                }
            }
            catch (error) {
                this.logger.error({ error, symbol }, 'Ошибка анализа символа');
            }
        }
        this.logger.debug('✅ Сканирование сигналов завершено');
    }
    /**
     * Анализировать символ и генерировать сигнал
     */
    async analyzeSymbol(symbol) {
        const marketData = this.marketData.get(symbol);
        if (!marketData || marketData.price === 0) {
            this.logger.warn({ symbol, hasData: !!marketData, price: marketData?.price }, 'Нет рыночных данных для анализа');
            return null;
        }
        // Проверяем можем ли открыть позицию на этом символе
        if (!this.positionManager.canOpenPositionForSymbol(symbol)) {
            return null;
        }
        // Рассчитываем технические индикаторы
        const volatility = this.indicators.calculateVolatility(symbol, this.config.volatilityPeriodMs);
        const ema = this.indicators.calculateEMA(symbol, this.config.emaFastPeriod, this.config.emaSlowPeriod);
        if (!volatility || !ema || !marketData.orderbook) {
            this.logger.warn({
                symbol,
                hasVolatility: !!volatility,
                hasEma: !!ema,
                hasOrderbook: !!marketData.orderbook
            }, 'Недостаточно данных для анализа');
            return null;
        }
        // Проверяем условия входа
        const entryConditions = this.indicators.checkEntryConditions(symbol, volatility, ema, marketData.orderbook, {
            minVolatility: this.config.minVolatilityThreshold,
            maxSpread: this.config.maxSpreadPercent,
            minDepth: this.config.minOrderbookDepth
        });
        if (!entryConditions.canEnter || !entryConditions.direction) {
            this.logger.info({
                symbol,
                canEnter: entryConditions.canEnter,
                direction: entryConditions.direction,
                confidence: entryConditions.confidence,
                reasons: entryConditions.reasons,
                volatility: volatility.value,
                minVolatility: this.config.minVolatilityThreshold
            }, 'Сигнал HOLD - условия входа не выполнены');
            return {
                symbol,
                action: 'hold',
                confidence: entryConditions.confidence,
                price: marketData.price,
                quantity: 0,
                reasons: entryConditions.reasons,
                timestamp: Date.now()
            };
        }
        // Рассчитываем размер позиции
        const positionSize = this.calculatePositionSize(symbol, marketData.price);
        if (positionSize === 0)
            return null;
        // Рассчитываем TP/SL
        const levels = this.indicators.calculateAdaptiveLevels(marketData.price, volatility, entryConditions.direction, this.config.targetProfitPercent, this.config.stopLossPercent, this.config.volatilityMultiplier);
        return {
            symbol,
            action: entryConditions.direction,
            confidence: entryConditions.confidence,
            price: marketData.price,
            quantity: positionSize,
            takeProfit: levels.takeProfit,
            stopLoss: levels.stopLoss,
            reasons: entryConditions.reasons,
            timestamp: Date.now()
        };
    }
    /**
     * Исполнить торговый сигнал
     */
    async executeSignal(signal) {
        if (signal.action === 'hold')
            return;
        // Проверяем разрешение риск-менеджера
        const riskCheck = this.riskManager.canOpenPosition(signal.symbol, signal.action, signal.quantity, signal.price);
        if (!riskCheck.allowed) {
            this.logger.debug({
                signal,
                reason: riskCheck.reason
            }, 'Сигнал отклонен риск-менеджером');
            return;
        }
        try {
            // Открываем позицию
            const position = await this.positionManager.openPosition(signal.symbol, signal.action, signal.quantity, signal.price, signal.takeProfit, signal.stopLoss);
            // Регистрируем в риск-менеджере
            this.riskManager.onPositionOpened(position);
            this.logger.info({
                signal,
                position
            }, `Открыта позиция ${signal.action} ${signal.symbol}`);
            // Отправляем Telegram уведомление
            if (this.telegram) {
                await this.telegram.notifyPositionOpened({
                    id: position.id,
                    symbol: position.symbol,
                    side: position.side,
                    entryPrice: position.entryPrice,
                    quantity: position.quantity,
                    takeProfit: position.takeProfit,
                    stopLoss: position.stopLoss
                });
            }
        }
        catch (error) {
            const errorDetails = error instanceof Error ? {
                message: error.message,
                stack: error.stack,
                name: error.name,
                code: error.code,
                response: error.response?.data
            } : { message: String(error) };
            this.logger.error({
                error: errorDetails,
                signal
            }, 'Ошибка исполнения сигнала');
        }
    }
    /**
     * Рассчитать размер позиции
     */
    calculatePositionSize(symbol, price) {
        // Размер позиции в USDT
        const positionValueUSDT = (this.config.deposit * this.config.positionSizePercent) / 100;
        // Конвертируем в количество базового актива
        let quantity = positionValueUSDT / price;
        // Округляем до 3 знаков после запятой для MEXC (stepSize = 0.001)
        quantity = Math.floor(quantity * 1000) / 1000;
        return quantity;
    }
    /**
     * Получить статистику стратегии
     */
    getStrategyStats() {
        return {
            isRunning: this.isRunning,
            marketData: Object.fromEntries(this.marketData),
            riskMetrics: this.riskManager.getMetrics(),
            positionStats: this.positionManager.getPositionStats(),
            performance: this.riskManager.getPerformanceStats()
        };
    }
    /**
     * Получить последние торговые сигналы
     */
    async getLastSignals() {
        const signals = [];
        for (const symbol of this.config.targetPairs) {
            const signal = await this.analyzeSymbol(symbol);
            if (signal) {
                signals.push(signal);
            }
        }
        return signals;
    }
    /**
     * Принудительно закрыть все позиции
     */
    async forceCloseAllPositions() {
        this.logger.warn('Принудительное закрытие всех позиций');
        await this.positionManager.closeAllPositions('emergency');
    }
}
exports.ScalpingStrategy = ScalpingStrategy;
//# sourceMappingURL=scalping.js.map