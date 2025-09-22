"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketAnalyzer = void 0;
const mexc_rest_1 = require("./data/mexc-rest");
const mexc_websocket_1 = require("./data/mexc-websocket");
const local_minimum_strategy_1 = require("./strategies/local-minimum-strategy");
class MarketAnalyzer {
    restClient;
    wsClient = null;
    strategy;
    config;
    isRunning = false;
    updateTimer = null;
    // Callbacks
    onSignal;
    onAnalysis;
    onError;
    constructor(config) {
        this.config = config;
        this.restClient = new mexc_rest_1.MexcRestClient();
        this.strategy = new local_minimum_strategy_1.LocalMinimumStrategy();
    }
    /**
     * Запустить анализатор
     */
    async start() {
        console.log('🚀 Запуск анализатора рынка...');
        try {
            // Инициализация WebSocket
            if (this.config.enableWebSocket) {
                await this.initializeWebSocket();
            }
            // Загрузка исторических данных
            if (this.config.enableRest) {
                await this.loadHistoricalData();
            }
            // Запуск периодического обновления
            this.startPeriodicUpdate();
            this.isRunning = true;
            console.log('✅ Анализатор рынка запущен');
        }
        catch (error) {
            console.error('❌ Ошибка запуска анализатора:', error);
            throw error;
        }
    }
    /**
     * Остановить анализатор
     */
    stop() {
        console.log('🛑 Остановка анализатора рынка...');
        this.isRunning = false;
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
        if (this.wsClient) {
            this.wsClient.close();
            this.wsClient = null;
        }
        console.log('✅ Анализатор остановлен');
    }
    /**
     * Инициализация WebSocket
     */
    async initializeWebSocket() {
        this.wsClient = new mexc_websocket_1.MexcWebSocketClient();
        // Обработчики WebSocket
        this.wsClient.setOnConnect(() => {
            console.log('✅ WebSocket подключен к MEXC');
        });
        this.wsClient.setOnDisconnect(() => {
            console.log('❌ WebSocket соединение закрыто');
        });
        this.wsClient.setOnKlineUpdate((update) => {
            this.handleKlineUpdate(update);
        });
        this.wsClient.setOnTradeUpdate((update) => {
            this.handleTradeUpdate(update);
        });
        this.wsClient.setOnError((error) => {
            console.error('❌ WebSocket ошибка:', error);
            if (this.onError) {
                this.onError(error);
            }
        });
        // Подписка на данные
        for (const symbol of this.config.symbols) {
            for (const interval of this.config.intervals) {
                this.wsClient.subscribeKlines(symbol, interval);
                console.log(`📊 Подписка на свечи ${symbol} ${interval}`);
            }
            this.wsClient.subscribeTrades(symbol);
            console.log(`💰 Подписка на сделки ${symbol}`);
        }
    }
    /**
     * Загрузка исторических данных
     */
    async loadHistoricalData() {
        console.log('📊 Загрузка исторических данных...');
        for (const symbol of this.config.symbols) {
            try {
                const klines = await this.restClient.getKlines(symbol, '1m', 500);
                // Конвертируем в CandleData
                const candles = klines.map(kline => ({
                    open: parseFloat(kline.open),
                    high: parseFloat(kline.high),
                    low: parseFloat(kline.low),
                    close: parseFloat(kline.close),
                    volume: parseFloat(kline.volume),
                    timestamp: kline.openTime
                }));
                // Обновляем стратегию
                for (const candle of candles) {
                    this.strategy.updateCandles(symbol, candle);
                }
                console.log(`✅ Загружено ${candles.length} свечей для ${symbol}`);
            }
            catch (error) {
                console.error(`❌ Ошибка загрузки данных для ${symbol}:`, error);
            }
        }
    }
    /**
     * Запуск периодического обновления
     */
    startPeriodicUpdate() {
        this.updateTimer = setInterval(() => {
            this.performAnalysis();
        }, this.config.updateInterval);
    }
    /**
     * Обработка обновления свечей
     */
    handleKlineUpdate(update) {
        const candle = {
            open: parseFloat(update.kline.open),
            high: parseFloat(update.kline.high),
            low: parseFloat(update.kline.low),
            close: parseFloat(update.kline.close),
            volume: parseFloat(update.kline.volume),
            timestamp: update.kline.openTime
        };
        this.strategy.updateCandles(update.symbol, candle);
        this.performAnalysis();
    }
    /**
     * Обработка обновления сделок
     */
    handleTradeUpdate(update) {
        // Пока не используем данные о сделках
    }
    /**
     * Выполнить анализ
     */
    performAnalysis() {
        if (!this.isRunning)
            return;
        for (const symbol of this.config.symbols) {
            try {
                // Получаем анализ рынка
                const analysis = this.strategy.getMarketAnalysis(symbol);
                if (analysis) {
                    // Отправляем анализ
                    if (this.onAnalysis) {
                        this.onAnalysis(analysis);
                    }
                    // Получаем сигнал
                    const signal = this.strategy.getLocalMinimumSignal(symbol);
                    if (signal && signal.signal === 'BUY') {
                        // Отправляем сигнал
                        if (this.onSignal) {
                            this.onSignal(signal);
                        }
                    }
                    // Выводим статус
                    this.displayStatus(symbol, analysis);
                }
            }
            catch (error) {
                console.error(`❌ Ошибка анализа ${symbol}:`, error);
                if (this.onError) {
                    this.onError(error);
                }
            }
        }
    }
    /**
     * Отобразить статус
     */
    displayStatus(symbol, analysis) {
        const trendEmoji = analysis.trend === 'UP' ? '📈' : analysis.trend === 'DOWN' ? '📉' : '➡️';
        const minEmoji = analysis.isLocalMinimum ? '🔍' : '';
        console.log(`${trendEmoji} ${symbol}: ${analysis.trend} (${analysis.trendStrength.toFixed(1)}%) | ` +
            `RSI: ${analysis.rsi.toFixed(1)} | ${minEmoji}Лок.мин: ${analysis.isLocalMinimum} | ` +
            `BB: ${analysis.bollinger.position.toFixed(1)}%`);
    }
    /**
     * Получить анализ рынка для символа
     */
    getMarketAnalysis(symbol) {
        return this.strategy.getMarketAnalysis(symbol);
    }
    /**
     * Установить обработчик сигналов
     */
    setOnSignal(callback) {
        this.onSignal = callback;
    }
    /**
     * Установить обработчик анализа
     */
    setOnAnalysis(callback) {
        this.onAnalysis = callback;
    }
    /**
     * Установить обработчик ошибок
     */
    setOnError(callback) {
        this.onError = callback;
    }
}
exports.MarketAnalyzer = MarketAnalyzer;
//# sourceMappingURL=market-analyzer.js.map