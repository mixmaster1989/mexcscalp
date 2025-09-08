"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScalperEnhancer = void 0;
exports.createDefaultConfig = createDefaultConfig;
const orderManager_1 = require("./orderManager");
const marketData_1 = require("./marketData");
/**
 * Улучшенный скальпер с сервисной логикой
 */
class ScalperEnhancer {
    orderManager;
    marketDataManager;
    restClient;
    instrument;
    config;
    isActive = false;
    lastFillTime = Date.now();
    lastStatusUpdate = 0;
    constructor(config, restClient, instrument) {
        this.config = config;
        this.restClient = restClient;
        this.instrument = instrument;
        // Создаем менеджеры
        this.orderManager = new orderManager_1.OrderManager(config, restClient, instrument);
        this.marketDataManager = new marketData_1.MarketDataManager(restClient, instrument.symbol, instrument.tickSize);
    }
    /**
     * Запустить улучшенный скальпер
     */
    async start() {
        if (this.isActive)
            return;
        this.isActive = true;
        console.log('🚀 ScalperEnhancer запущен');
        // Устанавливаем параметры стратегии (из main.ts)
        this.orderManager.setStrategyParams(5.70, 4.275, 4);
    }
    /**
     * Остановить улучшенный скальпер
     */
    async stop() {
        if (!this.isActive)
            return;
        this.isActive = false;
        console.log('🛑 ScalperEnhancer остановлен');
    }
    /**
     * Проверить фильтры (дополнение к основной логике)
     */
    async checkFilters(currentOrders, currentPrice) {
        if (!this.isActive)
            return true;
        try {
            // Получаем рыночные данные
            const marketData = await this.marketDataManager.getMarketData();
            // Проверяем фильтры
            if (!this.passesFilters(marketData)) {
                console.log('⚠️ Фильтры не пройдены, пропускаем размещение ордеров');
                return false;
            }
            // Обновляем статус
            await this.updateStatus(currentOrders, marketData);
            return true;
        }
        catch (error) {
            console.error('❌ Ошибка в checkFilters:', error);
            return true; // В случае ошибки пропускаем
        }
    }
    /**
     * Основной цикл управления ордерами (оставляем для совместимости)
     */
    async manageOrders(currentOrders) {
        if (!this.isActive)
            return;
        try {
            // Получаем рыночные данные
            const marketData = await this.marketDataManager.getMarketData();
            // Проверяем фильтры
            if (!this.passesFilters(marketData)) {
                console.log('⚠️ Фильтры не пройдены, пропускаем управление');
                return;
            }
            // Управляем ордерами через OrderManager
            await this.orderManager.manageOrders(currentOrders, marketData.midPrice, marketData.bestBid, marketData.bestAsk, marketData.spread);
            // Обновляем статус
            await this.updateStatus(currentOrders, marketData);
        }
        catch (error) {
            console.error('❌ Ошибка в manageOrders:', error);
        }
    }
    /**
     * Зарегистрировать исполнение ордера
     */
    onFill() {
        this.lastFillTime = Date.now();
        this.orderManager.onFill();
    }
    /**
     * Проверить фильтры
     */
    passesFilters(marketData) {
        // Проверка минимального спреда
        if (marketData.spreadTicks < this.config.min_spread_ticks) {
            console.log(`⚠️ Спред слишком мал: ${marketData.spreadTicks} < ${this.config.min_spread_ticks}`);
            return false;
        }
        // Проверка свежести данных
        const dataAge = Date.now() - marketData.timestamp;
        if (dataAge > this.config.staleness_ms) {
            console.log(`⚠️ Данные устарели: ${Math.round(dataAge / 1000)}с > ${Math.round(this.config.staleness_ms / 1000)}с`);
            return false;
        }
        // Дополнительная проверка - если timestamp слишком старый, пропускаем
        if (dataAge > 300000) { // 5 минут
            console.log(`⚠️ Timestamp слишком старый: ${Math.round(dataAge / 1000)}с, пропускаем`);
            return false;
        }
        return true;
    }
    /**
     * Обновить статус
     */
    async updateStatus(orders, marketData) {
        const now = Date.now();
        if (now - this.lastStatusUpdate < this.config.refresh_sec * 1000) {
            return;
        }
        const buyOrders = orders.filter((o) => o.side === 'BUY').length;
        const sellOrders = orders.filter((o) => o.side === 'SELL').length;
        console.log(`📊 Статус: ${buyOrders} buy, ${sellOrders} sell | Спред: ${marketData.spreadTicks} тиков | Цена: $${marketData.midPrice.toFixed(2)}`);
        this.lastStatusUpdate = now;
    }
    /**
     * Получить статистику
     */
    getStats() {
        const orderStats = this.orderManager.getStats();
        const marketData = this.marketDataManager.getCachedData();
        return {
            ...orderStats,
            marketData,
            isActive: this.isActive,
            timeSinceLastFill: Date.now() - this.lastFillTime
        };
    }
    /**
     * Получить конфигурацию
     */
    getConfig() {
        return this.config;
    }
}
exports.ScalperEnhancer = ScalperEnhancer;
/**
 * Фабрика для создания конфигурации по умолчанию
 */
function createDefaultConfig() {
    return {
        ttl_order_sec: 45,
        refresh_sec: 15,
        delta_ticks_for_replace: 3,
        recentering_trigger: 0.5,
        no_fill_watchdog_min: 7,
        min_spread_ticks: 2,
        staleness_ms: 30000, // 5 секунд вместо 300мс
        cancel_rate_per_min: 30
    };
}
//# sourceMappingURL=scalperEnhancer.js.map