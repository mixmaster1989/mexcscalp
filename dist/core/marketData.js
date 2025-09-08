"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketDataManager = void 0;
/**
 * Менеджер рыночных данных
 */
class MarketDataManager {
    restClient;
    symbol;
    tickSize;
    lastUpdate = 0;
    cache = null;
    cacheTTL = 1000; // 1 секунда
    constructor(restClient, symbol, tickSize) {
        this.restClient = restClient;
        this.symbol = symbol;
        this.tickSize = tickSize;
    }
    /**
     * Получить актуальные рыночные данные
     */
    async getMarketData() {
        const now = Date.now();
        // Проверяем кеш
        if (this.cache && (now - this.lastUpdate) < this.cacheTTL) {
            return this.cache;
        }
        try {
            // Получаем book ticker (best bid/ask)
            const bookTicker = await this.restClient.getBookTicker(this.symbol);
            const bestBid = bookTicker.bidPrice;
            const bestAsk = bookTicker.askPrice;
            const midPrice = (bestBid + bestAsk) / 2;
            const spread = bestAsk - bestBid;
            const spreadTicks = Math.round(spread / this.tickSize);
            const marketData = {
                symbol: this.symbol,
                midPrice,
                bestBid,
                bestAsk,
                spread,
                spreadTicks,
                timestamp: now
            };
            // Обновляем кеш
            this.cache = marketData;
            this.lastUpdate = now;
            return marketData;
        }
        catch (error) {
            console.error('❌ Ошибка получения рыночных данных:', error);
            // Возвращаем кеш если есть, иначе заглушку
            if (this.cache) {
                return this.cache;
            }
            throw new Error(`Не удалось получить рыночные данные для ${this.symbol}`);
        }
    }
    /**
     * Получить только mid price
     */
    async getMidPrice() {
        try {
            const price = await this.restClient.getPrice(this.symbol);
            return price;
        }
        catch (error) {
            console.error('❌ Ошибка получения цены:', error);
            throw error;
        }
    }
    /**
     * Получить спред в тиках
     */
    async getSpreadTicks() {
        const marketData = await this.getMarketData();
        return marketData.spreadTicks;
    }
    /**
     * Проверить, актуальны ли данные
     */
    isDataFresh(maxAgeMs = 5000) {
        if (!this.cache)
            return false;
        return (Date.now() - this.lastUpdate) < maxAgeMs;
    }
    /**
     * Получить последние данные из кеша
     */
    getCachedData() {
        return this.cache;
    }
    /**
     * Очистить кеш
     */
    clearCache() {
        this.cache = null;
        this.lastUpdate = 0;
    }
    /**
     * Установить TTL кеша
     */
    setCacheTTL(ttlMs) {
        this.cacheTTL = ttlMs;
    }
}
exports.MarketDataManager = MarketDataManager;
//# sourceMappingURL=marketData.js.map