"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PingPongEngine = void 0;
const events_1 = require("events");
const types_1 = require("./types");
class PingPongEngine extends events_1.EventEmitter {
    constructor(config, wsClient, restClient, statsCalculator, riskManager) {
        super();
        this.config = config;
        this.wsClient = wsClient;
        this.restClient = restClient;
        this.statsCalculator = statsCalculator;
        this.riskManager = riskManager;
        this.layers = new Map();
        this.microStats = null;
        this.isRunning = false;
        this.updateInterval = null;
        this.watchdogInterval = null;
        this.lastOrderBookTime = 0;
        this.lastTradeTime = 0;
        this.priceHistory = [];
        this.sessionStats = {
            totalPnL: 0,
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            consecutiveLosses: 0,
            fillsPerMinute: 0,
            avgTradeDuration: 0,
            dailyDrawdown: 0,
            startTime: Date.now(),
            lastTradeTime: Date.now()
        };
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        this.wsClient.on('orderbook', (tick) => {
            this.handleOrderBookTick(tick);
        });
        this.wsClient.on('trade', (tick) => {
            this.handleTradeTick(tick);
        });
        this.wsClient.on('connected', () => {
            this.start();
        });
        this.wsClient.on('disconnected', () => {
            this.stop();
        });
    }
    handleOrderBookTick(tick) {
        this.lastOrderBookTime = Date.now();
        // Обновляем историю цен
        this.priceHistory.push(tick.bidPrice);
        if (this.priceHistory.length > 120) {
            this.priceHistory.shift();
        }
        // Вычисляем микро-статистику
        this.microStats = this.statsCalculator.calculateMicroStats(tick, this.priceHistory, this.config);
        if (this.microStats) {
            this.emit('microStats', this.microStats);
        }
    }
    handleTradeTick(tick) {
        this.lastTradeTime = Date.now();
        this.emit('trade', tick);
    }
    async start() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        this.emit('started');
        // Запускаем основной цикл обновления
        this.updateInterval = setInterval(() => {
            this.updateCycle();
        }, this.config.updateIntervalMs);
        // Запускаем watchdog
        this.watchdogInterval = setInterval(() => {
            this.watchdog();
        }, 1000);
    }
    async stop() {
        if (!this.isRunning)
            return;
        this.isRunning = false;
        // Останавливаем таймеры
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        if (this.watchdogInterval) {
            clearInterval(this.watchdogInterval);
            this.watchdogInterval = null;
        }
        // Отменяем все открытые ордера
        try {
            await this.restClient.cancelAllOpenOrders(this.config.symbol);
        }
        catch (error) {
            console.error('Ошибка отмены ордеров:', error);
        }
        this.emit('stopped');
    }
    async updateCycle() {
        if (!this.isRunning || !this.microStats)
            return;
        try {
            // Проверяем риск-менеджмент
            if (!this.riskManager.canTrade(this.sessionStats)) {
                return;
            }
            // Обновляем состояние слоев
            await this.updateLayers();
            // Создаем новые слои если нужно
            await this.createNewLayers();
        }
        catch (error) {
            console.error('Ошибка в цикле обновления:', error);
            this.emit('error', error);
        }
    }
    async updateLayers() {
        const layersToRemove = [];
        for (const [layerId, layer] of this.layers) {
            try {
                await this.updateLayer(layer);
                // Удаляем завершенные слои
                if (layer.state === types_1.LayerState.IDLE) {
                    layersToRemove.push(layerId);
                }
            }
            catch (error) {
                console.error(`Ошибка обновления слоя ${layerId}:`, error);
                layersToRemove.push(layerId);
            }
        }
        // Удаляем завершенные слои
        for (const layerId of layersToRemove) {
            this.layers.delete(layerId);
        }
    }
    async updateLayer(layer) {
        const now = Date.now();
        switch (layer.state) {
            case types_1.LayerState.PENDING_BUY:
                await this.updatePendingBuyLayer(layer, now);
                break;
            case types_1.LayerState.LONG_PING:
                await this.updateLongPingLayer(layer, now);
                break;
            case types_1.LayerState.COOLDOWN:
                await this.updateCooldownLayer(layer, now);
                break;
        }
    }
    async updatePendingBuyLayer(layer, now) {
        // Проверяем TTL
        if (layer.expireAt && now > layer.expireAt) {
            await this.cancelLayerOrder(layer);
            layer.state = types_1.LayerState.IDLE;
            return;
        }
        // Проверяем исполнение ордера
        if (layer.buyOrderId) {
            try {
                const order = await this.restClient.getOrder(this.config.symbol, layer.buyOrderId);
                if (order.status === 'FILLED') {
                    await this.handleBuyOrderFilled(layer, order);
                }
            }
            catch (error) {
                console.error('Ошибка проверки ордера:', error);
            }
        }
    }
    async updateLongPingLayer(layer, now) {
        // Проверяем TTL
        if (layer.expireAt && now > layer.expireAt) {
            await this.emergencyCloseLayer(layer);
            layer.state = types_1.LayerState.COOLDOWN;
            layer.resumeAt = now + this.config.cooldownSeconds * 1000;
            return;
        }
        // Проверяем стоп-лосс
        if (this.microStats && layer.slPrice && this.microStats.mid <= layer.slPrice) {
            await this.emergencyCloseLayer(layer);
            layer.state = types_1.LayerState.COOLDOWN;
            layer.resumeAt = now + this.config.cooldownSeconds * 1000;
            return;
        }
        // Проверяем исполнение sell ордера
        if (layer.sellOrderId) {
            try {
                const order = await this.restClient.getOrder(this.config.symbol, layer.sellOrderId);
                if (order.status === 'FILLED') {
                    await this.handleSellOrderFilled(layer, order);
                }
            }
            catch (error) {
                console.error('Ошибка проверки sell ордера:', error);
            }
        }
    }
    async updateCooldownLayer(layer, now) {
        if (layer.resumeAt && now >= layer.resumeAt) {
            layer.state = types_1.LayerState.IDLE;
        }
    }
    async createNewLayers() {
        if (!this.microStats)
            return;
        const activeLayers = Array.from(this.layers.values()).filter(layer => layer.state !== types_1.LayerState.IDLE);
        if (activeLayers.length >= this.config.maxLayers)
            return;
        // Проверяем условия для создания нового слоя
        if (this.canCreateNewLayer()) {
            await this.createNewLayer();
        }
    }
    canCreateNewLayer() {
        if (!this.microStats)
            return false;
        // Проверяем условия рынка
        return this.riskManager.isMarketConditionSuitable(this.microStats.spread, this.microStats.mid, this.microStats.sigma1s, 1, // bidQty - упрощенно
        1, // askQty - упрощенно
        this.config.orderNotional / this.microStats.mid);
    }
    async createNewLayer() {
        if (!this.microStats)
            return;
        const layerId = `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const buyPrice = this.microStats.mid - this.microStats.s;
        const quantity = this.config.orderNotional / this.microStats.mid;
        try {
            const order = await this.restClient.placeOrder(this.config.symbol, 'BUY', 'LIMIT', quantity, buyPrice);
            const layer = {
                id: layerId,
                state: types_1.LayerState.PENDING_BUY,
                buyOrderId: order.id,
                buyPrice,
                quantity,
                expireAt: Date.now() + this.config.ttlSeconds * 1000
            };
            this.layers.set(layerId, layer);
        }
        catch (error) {
            console.error('Ошибка создания слоя:', error);
        }
    }
    async handleBuyOrderFilled(layer, order) {
        layer.entryPrice = parseFloat(order.price);
        layer.slPrice = layer.entryPrice - this.microStats.sl;
        // Размещаем sell ордер
        const sellPrice = layer.entryPrice + this.microStats.tp;
        try {
            const sellOrder = await this.restClient.placeOrder(this.config.symbol, 'SELL', 'LIMIT', layer.quantity, sellPrice);
            layer.sellOrderId = sellOrder.id;
            layer.sellPrice = sellPrice;
            layer.state = types_1.LayerState.LONG_PING;
            layer.expireAt = Date.now() + this.config.ttlSeconds * 1000;
        }
        catch (error) {
            console.error('Ошибка размещения sell ордера:', error);
            await this.emergencyCloseLayer(layer);
            layer.state = types_1.LayerState.COOLDOWN;
            layer.resumeAt = Date.now() + this.config.cooldownSeconds * 1000;
        }
    }
    async handleSellOrderFilled(layer, order) {
        const pnl = (parseFloat(order.price) - layer.entryPrice) * layer.quantity;
        // Обновляем статистику
        this.updateSessionStats(layer, pnl > 0);
        layer.state = types_1.LayerState.IDLE;
    }
    async emergencyCloseLayer(layer) {
        try {
            // Отменяем sell ордер если есть
            if (layer.sellOrderId) {
                await this.restClient.cancelOrder(this.config.symbol, layer.sellOrderId);
            }
            // Продаем по рынку (агрессивный лимит)
            if (this.microStats) {
                const marketSellPrice = this.microStats.mid - this.microStats.spread * 0.5;
                await this.restClient.placeOrder(this.config.symbol, 'SELL', 'LIMIT', layer.quantity, marketSellPrice);
            }
        }
        catch (error) {
            console.error('Ошибка аварийного закрытия слоя:', error);
        }
    }
    async cancelLayerOrder(layer) {
        try {
            if (layer.buyOrderId) {
                await this.restClient.cancelOrder(this.config.symbol, layer.buyOrderId);
            }
            if (layer.sellOrderId) {
                await this.restClient.cancelOrder(this.config.symbol, layer.sellOrderId);
            }
        }
        catch (error) {
            console.error('Ошибка отмены ордера слоя:', error);
        }
    }
    updateSessionStats(layer, isWin) {
        this.sessionStats.totalTrades++;
        this.sessionStats.lastTradeTime = Date.now();
        if (isWin) {
            this.sessionStats.winningTrades++;
            this.sessionStats.consecutiveLosses = 0;
        }
        else {
            this.sessionStats.losingTrades++;
            this.sessionStats.consecutiveLosses++;
        }
        // Обновляем fills per minute
        const runtime = (Date.now() - this.sessionStats.startTime) / 1000 / 60;
        this.sessionStats.fillsPerMinute = this.sessionStats.totalTrades / Math.max(runtime, 1);
    }
    watchdog() {
        if (!this.isRunning)
            return;
        const now = Date.now();
        // Проверяем задержку данных
        if (now - this.lastOrderBookTime > 5000) {
            console.log('⚠️ Нет данных стакана более 5 секунд');
        }
        if (now - this.lastTradeTime > 10000) {
            console.log('⚠️ Нет сделок более 10 секунд');
        }
        // Проверяем watchdog timeout
        if (now - this.sessionStats.lastTradeTime > this.config.watchdogTimeoutSeconds * 1000) {
            console.log('🐕 Watchdog: нет сделок, уменьшаем s');
            // Здесь можно добавить логику уменьшения s
        }
    }
    // Публичные методы для получения состояния
    getLayers() {
        return Array.from(this.layers.values());
    }
    getMicroStats() {
        return this.microStats;
    }
    getSessionStats() {
        return { ...this.sessionStats };
    }
    isEngineRunning() {
        return this.isRunning;
    }
}
exports.PingPongEngine = PingPongEngine;
//# sourceMappingURL=engine.js.map