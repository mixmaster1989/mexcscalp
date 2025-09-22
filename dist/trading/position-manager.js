"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PositionManager = void 0;
/**
 * Менеджер позиций
 */
class PositionManager {
    positions = new Map();
    mexcClient;
    config;
    logger;
    telegram;
    constructor(mexcClient, config, logger, telegram = null) {
        this.mexcClient = mexcClient;
        this.config = config;
        this.logger = logger;
        this.telegram = telegram;
    }
    /**
     * Открыть новую позицию
     */
    async openPosition(symbol, side, quantity, price, takeProfit, stopLoss) {
        try {
            // Размещаем лимитный ордер на бирже (MARKET не поддерживается для данного символа)
            const order = await this.mexcClient.placeOrder(symbol, side, 'LIMIT', // Используем лимитные ордера вместо MARKET
            quantity, price // Устанавливаем цену для лимитного ордера
            );
            // Создаем позицию
            const position = {
                id: order.id,
                symbol,
                side,
                entryPrice: price, // В реальности нужно брать из order.price после исполнения
                quantity,
                takeProfit,
                stopLoss,
                entryTime: Date.now()
            };
            this.positions.set(position.id, position);
            this.logger.info({
                position,
                order
            }, `Открыта позиция ${side} ${symbol}`);
            return position;
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
                symbol,
                side,
                quantity,
                price
            }, 'Ошибка открытия позиции');
            throw error;
        }
    }
    /**
     * Закрыть позицию
     */
    async closePosition(positionId, reason) {
        const position = this.positions.get(positionId);
        if (!position) {
            this.logger.warn({ positionId }, 'Позиция не найдена для закрытия');
            return null;
        }
        try {
            // Получаем текущую цену для лимитного ордера
            const ticker = await this.mexcClient.getBookTicker(position.symbol);
            const currentPrice = position.side === 'buy' ? ticker.bidPrice : ticker.askPrice;
            // Размещаем противоположный лимитный ордер для закрытия
            const closeSide = position.side === 'buy' ? 'sell' : 'buy';
            const closeOrder = await this.mexcClient.placeOrder(position.symbol, closeSide, 'LIMIT', position.quantity, currentPrice // Используем текущую цену для лимитного ордера
            );
            // Используем текущую цену как цену закрытия (в реальности из closeOrder.price)
            const exitPrice = currentPrice;
            // Рассчитываем PnL
            let pnl;
            if (position.side === 'buy') {
                pnl = (exitPrice - position.entryPrice) * position.quantity;
            }
            else {
                pnl = (position.entryPrice - exitPrice) * position.quantity;
            }
            const pnlPercent = (pnl / (position.quantity * position.entryPrice)) * 100;
            const trade = {
                id: position.id,
                symbol: position.symbol,
                side: position.side,
                entryPrice: position.entryPrice,
                exitPrice,
                quantity: position.quantity,
                pnl,
                pnlPercent,
                timestamp: Date.now(),
                duration: Date.now() - position.entryTime,
                reason
            };
            // Удаляем позицию из активных
            this.positions.delete(positionId);
            this.logger.info({
                trade,
                closeOrder
            }, `Закрыта позиция ${position.side} ${position.symbol}, PnL: ${pnl.toFixed(4)}`);
            return trade;
        }
        catch (error) {
            this.logger.error({ error, positionId, position }, 'Ошибка закрытия позиции');
            throw error;
        }
    }
    /**
     * Обновить все позиции текущими ценами
     */
    async updatePositions() {
        const updates = [];
        const symbols = new Set(Array.from(this.positions.values()).map(p => p.symbol));
        // Получаем текущие цены для всех символов
        const prices = new Map();
        for (const symbol of symbols) {
            try {
                const ticker = await this.mexcClient.getBookTicker(symbol);
                const midPrice = (ticker.bidPrice + ticker.askPrice) / 2;
                prices.set(symbol, midPrice);
            }
            catch (error) {
                this.logger.warn({ error, symbol }, 'Ошибка получения цены');
            }
        }
        // Обновляем каждую позицию
        for (const position of this.positions.values()) {
            const currentPrice = prices.get(position.symbol);
            if (!currentPrice)
                continue;
            // Рассчитываем нереализованный PnL
            let unrealizedPnL;
            if (position.side === 'buy') {
                unrealizedPnL = (currentPrice - position.entryPrice) * position.quantity;
            }
            else {
                unrealizedPnL = (position.entryPrice - currentPrice) * position.quantity;
            }
            // Проверяем условия закрытия
            const update = this.checkCloseConditions(position, currentPrice, unrealizedPnL);
            updates.push({
                position,
                currentPrice,
                unrealizedPnL,
                shouldClose: update.shouldClose,
                closeReason: update.reason
            });
        }
        return updates;
    }
    /**
     * Проверить условия закрытия позиции
     */
    checkCloseConditions(position, currentPrice, unrealizedPnL) {
        // Проверка тейк-профита
        if (position.side === 'buy' && currentPrice >= position.takeProfit) {
            return { shouldClose: true, reason: 'take_profit' };
        }
        if (position.side === 'sell' && currentPrice <= position.takeProfit) {
            return { shouldClose: true, reason: 'take_profit' };
        }
        // Проверка стоп-лосса
        if (position.side === 'buy' && currentPrice <= position.stopLoss) {
            return { shouldClose: true, reason: 'stop_loss' };
        }
        if (position.side === 'sell' && currentPrice >= position.stopLoss) {
            return { shouldClose: true, reason: 'stop_loss' };
        }
        // Проверка тайм-аута
        const duration = Date.now() - position.entryTime;
        if (duration >= this.config.maxTradeTimeMs) {
            return { shouldClose: true, reason: 'timeout' };
        }
        return { shouldClose: false };
    }
    /**
     * Экстренно закрыть все позиции
     */
    async closeAllPositions(reason = 'emergency') {
        const results = [];
        const positionIds = Array.from(this.positions.keys());
        this.logger.warn({ count: positionIds.length }, 'Экстренно закрываем все позиции');
        for (const positionId of positionIds) {
            try {
                const result = await this.closePosition(positionId, reason);
                if (result) {
                    results.push(result);
                }
            }
            catch (error) {
                this.logger.error({ error, positionId }, 'Ошибка при экстренном закрытии позиции');
            }
        }
        return results;
    }
    /**
     * Получить все активные позиции
     */
    getActivePositions() {
        return Array.from(this.positions.values());
    }
    /**
     * Получить позицию по ID
     */
    getPosition(positionId) {
        return this.positions.get(positionId);
    }
    /**
     * Получить количество позиций
     */
    getPositionCount() {
        return this.positions.size;
    }
    /**
     * Получить позиции по символу
     */
    getPositionsBySymbol(symbol) {
        return Array.from(this.positions.values()).filter(p => p.symbol === symbol);
    }
    /**
     * Получить общую экспозицию в USDT
     */
    getTotalExposure() {
        let totalExposure = 0;
        for (const position of this.positions.values()) {
            totalExposure += position.quantity * position.entryPrice;
        }
        return totalExposure;
    }
    /**
     * Рассчитать адаптивные уровни TP/SL
     */
    calculateAdaptiveLevels(entryPrice, side, volatility) {
        // Базовые уровни из конфига
        let tpPercent = this.config.targetProfitPercent;
        let slPercent = this.config.stopLossPercent;
        // Адаптируем под волатильность
        if (this.config.adaptiveTpSl) {
            const volMultiplier = Math.max(0.5, Math.min(3, volatility * this.config.volatilityMultiplier));
            tpPercent *= volMultiplier;
            slPercent *= volMultiplier;
        }
        if (side === 'buy') {
            return {
                takeProfit: entryPrice * (1 + tpPercent / 100),
                stopLoss: entryPrice * (1 - slPercent / 100)
            };
        }
        else {
            return {
                takeProfit: entryPrice * (1 - tpPercent / 100),
                stopLoss: entryPrice * (1 + slPercent / 100)
            };
        }
    }
    /**
     * Проверить не превышен ли лимит позиций на символ
     */
    canOpenPositionForSymbol(symbol) {
        const symbolPositions = this.getPositionsBySymbol(symbol);
        // Максимум 2 позиции на один символ
        return symbolPositions.length < 2;
    }
    /**
     * Получить статистику по позициям
     */
    getPositionStats() {
        const positions = this.getActivePositions();
        const now = Date.now();
        const stats = {
            totalPositions: positions.length,
            buyPositions: positions.filter(p => p.side === 'buy').length,
            sellPositions: positions.filter(p => p.side === 'sell').length,
            totalExposure: this.getTotalExposure(),
            avgDuration: 0,
            symbolDistribution: {}
        };
        // Средняя длительность
        if (positions.length > 0) {
            const totalDuration = positions.reduce((sum, p) => sum + (now - p.entryTime), 0);
            stats.avgDuration = totalDuration / positions.length;
        }
        // Распределение по символам
        for (const position of positions) {
            stats.symbolDistribution[position.symbol] = (stats.symbolDistribution[position.symbol] || 0) + 1;
        }
        return stats;
    }
}
exports.PositionManager = PositionManager;
//# sourceMappingURL=position-manager.js.map