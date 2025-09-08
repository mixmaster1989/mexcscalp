"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderManager = void 0;
/**
 * Менеджер ордеров с TTL, репрайсом и перецентровкой
 */
class OrderManager {
    config;
    restClient;
    instrument;
    quoteLevels = new Map();
    lastCenter = 0;
    lastFillTime = Date.now();
    cancelTokens = 0;
    lastCancelReset = Date.now();
    // Параметры стратегии
    offset = 0;
    step = 0;
    maxLevels = 4;
    constructor(config, restClient, instrument) {
        this.config = config;
        this.restClient = restClient;
        this.instrument = instrument;
    }
    /**
     * Установить параметры стратегии
     */
    setStrategyParams(offset, step, maxLevels) {
        this.offset = offset;
        this.step = step;
        this.maxLevels = maxLevels;
    }
    /**
     * Обновить центр цены
     */
    updateCenter(midPrice) {
        this.lastCenter = midPrice;
    }
    /**
     * Зарегистрировать исполнение ордера
     */
    onFill() {
        this.lastFillTime = Date.now();
    }
    /**
     * Основной цикл управления ордерами
     */
    async manageOrders(currentOrders, midPrice, bestBid, bestAsk, spread) {
        try {
            // Проверяем фильтры
            if (!this.passesFilters(spread)) {
                console.log('⚠️ Фильтры не пройдены, пропускаем управление ордерами');
                return;
            }
            // Обновляем центр
            this.updateCenter(midPrice);
            // Проверяем TTL и репрайс
            await this.checkTTLAndReprice(currentOrders, bestBid, bestAsk);
            // Проверяем перецентровку
            await this.checkRecentering();
            // Проверяем watchdog
            await this.checkNoFillWatchdog();
            // Обновляем верхний уровень
            await this.updateTopLevel(bestBid, bestAsk);
        }
        catch (error) {
            console.error('❌ Ошибка в manageOrders:', error);
        }
    }
    /**
     * Проверить TTL и репрайс ордеров
     */
    async checkTTLAndReprice(currentOrders, bestBid, bestAsk) {
        const now = Date.now();
        const ttlMs = this.config.ttl_order_sec * 1000;
        const deltaTicks = this.config.delta_ticks_for_replace * this.instrument.tickSize;
        for (const order of currentOrders) {
            const orderAge = now - order.timestamp;
            const priceDiff = Math.abs(order.side === 'buy' ?
                bestBid - order.price :
                order.price - bestAsk);
            // Проверяем TTL или большой отход цены
            if (orderAge > ttlMs || priceDiff > deltaTicks) {
                console.log(`🔄 Репрайс ордера ${order.id}: возраст=${Math.round(orderAge / 1000)}с, отход=${priceDiff.toFixed(6)}`);
                await this.repriceOrder(order, bestBid, bestAsk);
            }
        }
    }
    /**
     * Перевыставить ордер по новой цене
     */
    async repriceOrder(order, bestBid, bestAsk) {
        try {
            // Отменяем старый ордер
            await this.cancelOrder(order.symbol, order.id);
            // Вычисляем новую цену
            const newPrice = this.calculateNewPrice(order.side, bestBid, bestAsk);
            if (newPrice > 0) {
                // Размещаем новый ордер
                const newOrder = await this.restClient.placeOrder(order.symbol, order.side, 'LIMIT', order.quantity, newPrice, `REPRICE_${Date.now()}`);
                console.log(`✅ Ордер перевыставлен: ${order.side} ${order.quantity} @ $${newPrice}`);
            }
        }
        catch (error) {
            console.error(`❌ Ошибка репрайса ордера ${order.id}:`, error);
        }
    }
    /**
     * Вычислить новую цену для ордера
     */
    calculateNewPrice(side, bestBid, bestAsk) {
        if (side === 'buy') {
            // BUY ордер - не выше best bid
            return Math.max(bestBid - this.instrument.tickSize, bestBid - this.offset);
        }
        else {
            // SELL ордер - не ниже best ask
            return Math.min(bestAsk + this.instrument.tickSize, bestAsk + this.offset);
        }
    }
    /**
     * Проверить необходимость перецентровки
     */
    async checkRecentering() {
        const centerDiff = Math.abs(this.lastCenter - this.lastCenter);
        const threshold = this.config.recentering_trigger * this.step;
        if (centerDiff > threshold) {
            console.log(`🔄 Перецентровка: сдвиг=${centerDiff.toFixed(6)}, порог=${threshold.toFixed(6)}`);
            await this.recenterLevels();
        }
    }
    /**
     * Перецентровать уровни вокруг нового центра
     */
    async recenterLevels() {
        // Логика перецентровки будет добавлена позже
        console.log('📊 Перецентровка уровней (пока заглушка)');
    }
    /**
     * Проверить watchdog на отсутствие сделок
     */
    async checkNoFillWatchdog() {
        const now = Date.now();
        const timeSinceLastFill = now - this.lastFillTime;
        const watchdogMs = this.config.no_fill_watchdog_min * 60 * 1000;
        if (timeSinceLastFill > watchdogMs) {
            console.log(`⚠️ Watchdog: ${Math.round(timeSinceLastFill / 60000)} мин без сделок`);
            await this.adjustForNoFills();
        }
    }
    /**
     * Корректировка при отсутствии сделок
     */
    async adjustForNoFills() {
        // Уменьшаем offset на 10-15%
        this.offset *= 0.85;
        console.log(`📉 Offset уменьшен до ${this.offset.toFixed(6)}`);
        // Логика паузы будет добавлена позже
    }
    /**
     * Обновить верхний уровень
     */
    async updateTopLevel(bestBid, bestAsk) {
        // Логика обновления верхнего уровня будет добавлена позже
        console.log('🔝 Обновление верхнего уровня (пока заглушка)');
    }
    /**
     * Проверить фильтры
     */
    passesFilters(spread) {
        // Проверка минимального спреда
        const minSpread = this.config.min_spread_ticks * this.instrument.tickSize;
        if (spread < minSpread) {
            console.log(`⚠️ Спред слишком мал: ${spread.toFixed(6)} < ${minSpread.toFixed(6)}`);
            return false;
        }
        // Проверка свежести данных
        const now = Date.now();
        if (now - this.lastCenter > this.config.staleness_ms) {
            console.log(`⚠️ Данные устарели: ${Math.round((now - this.lastCenter) / 1000)}с`);
            return false;
        }
        return true;
    }
    /**
     * Отменить ордер с rate limiting
     */
    async cancelOrder(symbol, orderId) {
        // Проверяем rate limit
        const now = Date.now();
        if (now - this.lastCancelReset > 60000) {
            this.cancelTokens = this.config.cancel_rate_per_min;
            this.lastCancelReset = now;
        }
        if (this.cancelTokens <= 0) {
            console.log('⚠️ Rate limit достигнут для отмены ордеров');
            return;
        }
        try {
            await this.restClient.cancelOrder(symbol, orderId);
            this.cancelTokens--;
            console.log(`✅ Ордер отменен: ${orderId}`);
        }
        catch (error) {
            console.error(`❌ Ошибка отмены ордера ${orderId}:`, error);
        }
    }
    /**
     * Получить статистику
     */
    getStats() {
        return {
            lastCenter: this.lastCenter,
            lastFillTime: this.lastFillTime,
            timeSinceLastFill: Date.now() - this.lastFillTime,
            cancelTokens: this.cancelTokens,
            quoteLevels: this.quoteLevels.size
        };
    }
}
exports.OrderManager = OrderManager;
//# sourceMappingURL=orderManager.js.map