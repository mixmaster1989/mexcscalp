"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HedgehogStrategy = void 0;
const events_1 = require("events");
const math_1 = require("../core/math");
/**
 * Стратегия "Ёршики" - двусторонние лимитные ордера
 * Выставляет симметричные уровни покупки и продажи вокруг средней цены
 */
class HedgehogStrategy extends events_1.EventEmitter {
    config;
    instrument;
    restClient;
    isActive = false;
    quoteLevels = new Map();
    takeProfitOrders = new Map();
    // Текущее состояние
    midPrice = 0;
    currentInventory = 0; // В базовой валюте
    inventoryNotional = 0; // В котировочной валюте
    atr1m = 0;
    // Параметры режима
    currentRegime = 'normal';
    regimeParams = {
        tpBps: 12,
        offsetMultiplier: 1.0,
        stepMultiplier: 1.0,
        maxLevels: 4,
        enableLadder: true
    };
    constructor(config, instrument, restClient) {
        super();
        this.config = config;
        this.instrument = instrument;
        this.restClient = restClient;
    }
    /**
     * Запустить стратегию
     */
    async start() {
        if (this.isActive) {
            return;
        }
        this.isActive = true;
        this.emit('started');
    }
    /**
     * Остановить стратегию
     */
    async stop() {
        if (!this.isActive) {
            return;
        }
        this.isActive = false;
        // Отменяем все активные ордера
        await this.cancelAllOrders();
        this.emit('stopped');
    }
    /**
     * Обновить рыночные данные
     */
    updateMarketData(midPrice, atr1m) {
        this.midPrice = midPrice;
        this.atr1m = atr1m;
        if (this.isActive) {
            this.updateQuotes();
        }
    }
    /**
     * Обновить параметры режима
     */
    updateRegimeParameters(regime, params) {
        this.currentRegime = regime;
        this.regimeParams = params;
        if (this.isActive) {
            this.updateQuotes();
        }
    }
    /**
     * Обработать исполнение ордера
     */
    async onFill(fill) {
        const level = this.findLevelByOrderId(fill.orderId);
        if (!level) {
            return;
        }
        // Обновляем инвентарь
        const inventoryChange = fill.side === 'buy' ? fill.quantity : -fill.quantity;
        this.currentInventory += inventoryChange;
        this.inventoryNotional += fill.side === 'buy' ? -fill.price * fill.quantity : fill.price * fill.quantity;
        // Создаем Take Profit ордер
        await this.createTakeProfitOrder(fill, level);
        // Восстанавливаем уровень (replenish)
        await this.replenishLevel(level);
        // Проверяем skew и обновляем котировки
        this.updateQuotes();
        this.emit('fill', fill);
    }
    /**
     * Обновить котировки
     */
    async updateQuotes() {
        if (!this.isActive || this.midPrice === 0 || this.atr1m === 0) {
            return;
        }
        // Проверяем фильтры
        if (!this.passesFilters()) {
            await this.pauseQuoting();
            return;
        }
        // Вычисляем параметры
        const offset = this.regimeParams.offsetMultiplier * this.config.hedgehog.offset_k_atr1m * this.atr1m;
        const step = this.regimeParams.stepMultiplier * this.config.hedgehog.step_k_atr1m * this.atr1m;
        const maxLevels = this.regimeParams.maxLevels;
        // Проверяем skew
        const inventoryLimit = this.config.deposit_usd * this.config.risk.max_inventory_pct;
        const inventorySkew = Math.abs(this.inventoryNotional) / inventoryLimit;
        const shouldSkewBuy = this.inventoryNotional < -inventoryLimit * this.config.hedgehog.skew_alpha;
        const shouldSkewSell = this.inventoryNotional > inventoryLimit * this.config.hedgehog.skew_alpha;
        // Генерируем новые уровни
        const newLevels = [];
        for (let i = 1; i <= maxLevels; i++) {
            // Buy уровень
            if (!shouldSkewSell) {
                const buyPrice = math_1.RoundingUtils.roundToTick(this.midPrice - offset - (i - 1) * step, this.instrument.tickSize);
                const buyQty = this.calculateLevelQuantity(i, 'buy');
                if (buyQty > 0 && math_1.RoundingUtils.validateNotional(buyPrice, buyQty, this.instrument.minNotional)) {
                    newLevels.push({
                        level: i,
                        side: 'buy',
                        price: buyPrice,
                        quantity: buyQty,
                        clientOrderId: this.generateClientOrderId('buy', i),
                        isActive: false,
                        timestamp: Date.now()
                    });
                }
            }
            // Sell уровень
            if (!shouldSkewBuy) {
                const sellPrice = math_1.RoundingUtils.roundToTick(this.midPrice + offset + (i - 1) * step, this.instrument.tickSize);
                const sellQty = this.calculateLevelQuantity(i, 'sell');
                if (sellQty > 0 && math_1.RoundingUtils.validateNotional(sellPrice, sellQty, this.instrument.minNotional)) {
                    newLevels.push({
                        level: i,
                        side: 'sell',
                        price: sellPrice,
                        quantity: sellQty,
                        clientOrderId: this.generateClientOrderId('sell', i),
                        isActive: false,
                        timestamp: Date.now()
                    });
                }
            }
        }
        // Обновляем ордера
        await this.updateOrders(newLevels);
    }
    /**
     * Вычислить количество для уровня
     */
    calculateLevelQuantity(level, side) {
        const baseSize = this.config.deposit_usd * 0.01; // 1% от депозита на уровень
        const geometryFactor = Math.pow(this.config.hedgehog.size_geometry_r, level - 1);
        const notional = baseSize * geometryFactor;
        return math_1.RoundingUtils.calculateQuantityForNotional(this.midPrice, notional, this.instrument.stepSize);
    }
    /**
     * Обновить ордера
     */
    async updateOrders(newLevels) {
        // Отменяем устаревшие ордера
        const toCancel = [];
        for (const [clientOrderId, level] of this.quoteLevels) {
            const stillNeeded = newLevels.find(l => l.side === level.side &&
                l.level === level.level &&
                Math.abs(l.price - level.price) < this.instrument.tickSize * 0.1);
            if (!stillNeeded && level.isActive) {
                toCancel.push(clientOrderId);
            }
        }
        // Отменяем ордера батчем
        if (toCancel.length > 0) {
            await this.cancelOrders(toCancel);
        }
        // Размещаем новые ордера
        for (const level of newLevels) {
            const existingLevel = Array.from(this.quoteLevels.values()).find(l => l.side === level.side &&
                l.level === level.level &&
                Math.abs(l.price - level.price) < this.instrument.tickSize * 0.1);
            if (!existingLevel) {
                await this.placeOrder(level);
            }
        }
    }
    /**
     * Разместить ордер
     */
    async placeOrder(level) {
        try {
            const order = await this.restClient.placeOrder(this.instrument.symbol, level.side, 'LIMIT', level.quantity, level.price, level.clientOrderId);
            level.orderId = order.id;
            level.isActive = true;
            this.quoteLevels.set(level.clientOrderId, level);
            this.emit('orderPlaced', order);
        }
        catch (error) {
            this.emit('error', new Error(`Ошибка размещения ордера: ${error}`));
        }
    }
    /**
     * Отменить ордера
     */
    async cancelOrders(clientOrderIds) {
        for (const clientOrderId of clientOrderIds) {
            try {
                const level = this.quoteLevels.get(clientOrderId);
                if (level && level.isActive) {
                    await this.restClient.cancelOrder(this.instrument.symbol, level.orderId, clientOrderId);
                    level.isActive = false;
                    this.quoteLevels.delete(clientOrderId);
                    this.emit('orderCanceled', clientOrderId);
                }
            }
            catch (error) {
                this.emit('error', new Error(`Ошибка отмены ордера ${clientOrderId}: ${error}`));
            }
        }
    }
    /**
     * Отменить все ордера
     */
    async cancelAllOrders() {
        const activeOrders = Array.from(this.quoteLevels.keys()).filter(id => this.quoteLevels.get(id)?.isActive);
        if (activeOrders.length > 0) {
            await this.cancelOrders(activeOrders);
        }
        // Также отменяем все Take Profit ордера
        const activeTPs = Array.from(this.takeProfitOrders.values()).filter(tp => tp.isActive);
        for (const tp of activeTPs) {
            try {
                await this.restClient.cancelOrder(this.instrument.symbol, tp.id, tp.clientOrderId);
                tp.isActive = false;
                this.takeProfitOrders.delete(tp.id);
            }
            catch (error) {
                // Игнорируем ошибки отмены TP
            }
        }
    }
    /**
     * Создать Take Profit ордер
     */
    async createTakeProfitOrder(fill, level) {
        const tpSide = fill.side === 'buy' ? 'sell' : 'buy';
        const tpBps = this.regimeParams.tpBps;
        const tpMultiplier = fill.side === 'buy' ? (1 + tpBps / 10000) : (1 - tpBps / 10000);
        const tpPrice = math_1.RoundingUtils.roundToTick(fill.price * tpMultiplier, this.instrument.tickSize);
        const clientOrderId = this.generateClientOrderId(`tp_${fill.side}`, Date.now());
        try {
            const tpOrder = await this.restClient.placeOrder(this.instrument.symbol, tpSide, 'LIMIT', fill.quantity, tpPrice, clientOrderId);
            const tpData = {
                id: tpOrder.id,
                clientOrderId: clientOrderId,
                fillId: fill.id,
                side: tpSide,
                price: tpPrice,
                quantity: fill.quantity,
                entryPrice: fill.price,
                isActive: true,
                timestamp: Date.now()
            };
            this.takeProfitOrders.set(tpOrder.id, tpData);
            this.emit('takeProfitCreated', tpData);
        }
        catch (error) {
            this.emit('error', new Error(`Ошибка создания Take Profit: ${error}`));
        }
    }
    /**
     * Восстановить уровень после исполнения
     */
    async replenishLevel(level) {
        // Создаем новый уровень глубже
        const newLevel = { ...level };
        newLevel.clientOrderId = this.generateClientOrderId(level.side, level.level);
        newLevel.isActive = false;
        newLevel.timestamp = Date.now();
        // Сдвигаем цену глубже на один шаг
        const step = this.regimeParams.stepMultiplier * this.config.hedgehog.step_k_atr1m * this.atr1m;
        if (level.side === 'buy') {
            newLevel.price = math_1.RoundingUtils.roundToTick(level.price - step, this.instrument.tickSize);
        }
        else {
            newLevel.price = math_1.RoundingUtils.roundToTick(level.price + step, this.instrument.tickSize);
        }
        // Размещаем новый ордер
        await this.placeOrder(newLevel);
    }
    /**
     * Проверить фильтры
     */
    passesFilters() {
        // Проверка минимального спреда (здесь упрощенно)
        const minSpread = this.config.filters.min_spread_ticks * this.instrument.tickSize;
        // В реальной реализации нужны данные стакана
        // Проверка staleness данных
        // В реальной реализации проверяем время последнего обновления
        return true;
    }
    /**
     * Приостановить котирование
     */
    async pauseQuoting() {
        await this.cancelAllOrders();
        this.emit('quotingPaused');
    }
    /**
     * Найти уровень по ID ордера
     */
    findLevelByOrderId(orderId) {
        return Array.from(this.quoteLevels.values()).find(level => level.orderId === orderId);
    }
    /**
     * Генерировать clientOrderId
     */
    generateClientOrderId(side, level) {
        const timestamp = Date.now();
        const nonce = Math.floor(Math.random() * 1000);
        return `hedgehog_${side}_${level}_${timestamp}_${nonce}`;
    }
    /**
     * Получить статистику стратегии
     */
    getStats() {
        return {
            isActive: this.isActive,
            activeLevels: Array.from(this.quoteLevels.values()).filter(l => l.isActive).length,
            activeTakeProfits: Array.from(this.takeProfitOrders.values()).filter(tp => tp.isActive).length,
            currentInventory: this.currentInventory,
            inventoryNotional: this.inventoryNotional,
            currentRegime: this.currentRegime,
            midPrice: this.midPrice,
            atr1m: this.atr1m
        };
    }
    /**
     * Получить активные уровни
     */
    getActiveLevels() {
        return Array.from(this.quoteLevels.values()).filter(level => level.isActive);
    }
    /**
     * Получить активные Take Profit ордера
     */
    getActiveTakeProfits() {
        return Array.from(this.takeProfitOrders.values()).filter(tp => tp.isActive);
    }
}
exports.HedgehogStrategy = HedgehogStrategy;
//# sourceMappingURL=hedgehog.js.map