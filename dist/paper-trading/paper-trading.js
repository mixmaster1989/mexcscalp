"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaperTradingSystem = void 0;
const market_snapshot_1 = require("./data/market-snapshot");
class PaperTradingSystem {
    trades = new Map();
    closedTrades = [];
    snapshotLogger;
    balance = 10000; // Начальный баланс $10,000
    positionSize = 0.1; // 10% от баланса на сделку
    maxOpenTrades = 3;
    tradeTimeout = 60; // Таймаут сделки в минутах
    constructor() {
        this.snapshotLogger = new market_snapshot_1.MarketSnapshotLogger();
    }
    /**
     * Обработать сигнал и создать сделку
     */
    processSignal(signal, analysis, currentCandle, historicalCandles) {
        // Проверяем лимиты
        if (this.trades.size >= this.maxOpenTrades) {
            console.log(`⚠️ Достигнут лимит открытых сделок: ${this.maxOpenTrades}`);
            return null;
        }
        // Проверяем баланс
        const requiredAmount = this.balance * this.positionSize;
        if (requiredAmount < 100) { // Минимум $100
            console.log('⚠️ Недостаточно средств для открытия сделки');
            return null;
        }
        // Создаем снимок рынка
        const snapshot = this.snapshotLogger.createSnapshot(signal.symbol, analysis, currentCandle, historicalCandles);
        // Создаем сделку
        const trade = {
            id: this.generateTradeId(),
            symbol: signal.symbol,
            side: signal.signal,
            entryPrice: signal.entryPrice,
            entryTime: Date.now(),
            quantity: requiredAmount / signal.entryPrice,
            stopLoss: signal.stopLoss,
            takeProfit: signal.takeProfit,
            marketSnapshot: snapshot,
            status: 'OPEN'
        };
        // Сохраняем сделку
        this.trades.set(trade.id, trade);
        // Обновляем баланс
        this.balance -= requiredAmount;
        console.log(`✅ Сделка создана: ${trade.id}`);
        console.log(`   Символ: ${trade.symbol}`);
        console.log(`   Сторона: ${trade.side}`);
        console.log(`   Цена входа: $${trade.entryPrice.toFixed(4)}`);
        console.log(`   Количество: ${trade.quantity.toFixed(6)}`);
        console.log(`   Стоп-лосс: $${trade.stopLoss.toFixed(4)}`);
        console.log(`   Тейк-профит: $${trade.takeProfit.toFixed(4)}`);
        return trade;
    }
    /**
     * Обновить открытые сделки с текущими ценами
     */
    updateTrades(currentPrices) {
        const now = Date.now();
        const tradesToClose = [];
        for (const [tradeId, trade] of this.trades) {
            if (trade.status !== 'OPEN')
                continue;
            const currentPrice = currentPrices.get(trade.symbol);
            if (!currentPrice)
                continue;
            // Проверяем условия закрытия
            let shouldClose = false;
            let exitReason = 'MANUAL';
            // Стоп-лосс
            if (trade.side === 'BUY' && currentPrice <= trade.stopLoss) {
                shouldClose = true;
                exitReason = 'STOP_LOSS';
            }
            else if (trade.side === 'SELL' && currentPrice >= trade.stopLoss) {
                shouldClose = true;
                exitReason = 'STOP_LOSS';
            }
            // Тейк-профит
            if (trade.side === 'BUY' && currentPrice >= trade.takeProfit) {
                shouldClose = true;
                exitReason = 'TAKE_PROFIT';
            }
            else if (trade.side === 'SELL' && currentPrice <= trade.takeProfit) {
                shouldClose = true;
                exitReason = 'TAKE_PROFIT';
            }
            // Таймаут
            const duration = (now - trade.entryTime) / (1000 * 60); // в минутах
            if (duration >= this.tradeTimeout) {
                shouldClose = true;
                exitReason = 'TIMEOUT';
            }
            if (shouldClose) {
                this.closeTrade(tradeId, currentPrice, exitReason);
                tradesToClose.push(tradeId);
            }
        }
        // Удаляем закрытые сделки из активных
        for (const tradeId of tradesToClose) {
            this.trades.delete(tradeId);
        }
    }
    /**
     * Закрыть сделку
     */
    closeTrade(tradeId, exitPrice, reason) {
        const trade = this.trades.get(tradeId);
        if (!trade)
            return;
        const now = Date.now();
        const duration = (now - trade.entryTime) / (1000 * 60); // в минутах
        // Рассчитываем P&L
        let pnl;
        if (trade.side === 'BUY') {
            pnl = (exitPrice - trade.entryPrice) * trade.quantity;
        }
        else {
            pnl = (trade.entryPrice - exitPrice) * trade.quantity;
        }
        const pnlPercent = (pnl / (trade.entryPrice * trade.quantity)) * 100;
        // Обновляем сделку
        trade.exitPrice = exitPrice;
        trade.exitTime = now;
        trade.exitReason = reason;
        trade.pnl = pnl;
        trade.pnlPercent = pnlPercent;
        trade.duration = duration;
        trade.status = 'CLOSED';
        // Обновляем баланс
        this.balance += (trade.entryPrice * trade.quantity) + pnl;
        // Перемещаем в закрытые сделки
        this.closedTrades.push(trade);
        console.log(`\n🔚 Сделка закрыта: ${trade.id}`);
        console.log(`   Причина: ${reason}`);
        console.log(`   Цена выхода: $${exitPrice.toFixed(4)}`);
        console.log(`   P&L: $${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`);
        console.log(`   Длительность: ${duration.toFixed(1)} мин`);
    }
    /**
     * Получить открытые сделки
     */
    getOpenTrades() {
        return Array.from(this.trades.values()).filter(trade => trade.status === 'OPEN');
    }
    /**
     * Получить закрытые сделки
     */
    getClosedTrades() {
        return this.closedTrades;
    }
    /**
     * Получить все снимки рынка
     */
    getAllMarketSnapshots() {
        return this.snapshotLogger.getAllSnapshots();
    }
    /**
     * Получить статистику торговли
     */
    getTradingStats() {
        const totalTrades = this.closedTrades.length;
        const winningTrades = this.closedTrades.filter(trade => (trade.pnl || 0) > 0).length;
        const losingTrades = this.closedTrades.filter(trade => (trade.pnl || 0) < 0).length;
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
        const totalPnL = this.closedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
        const averagePnL = totalTrades > 0 ? totalPnL / totalTrades : 0;
        const bestTrade = Math.max(...this.closedTrades.map(trade => trade.pnl || 0), 0);
        const worstTrade = Math.min(...this.closedTrades.map(trade => trade.pnl || 0), 0);
        const averageDuration = totalTrades > 0
            ? this.closedTrades.reduce((sum, trade) => sum + (trade.duration || 0), 0) / totalTrades
            : 0;
        const grossProfit = this.closedTrades
            .filter(trade => (trade.pnl || 0) > 0)
            .reduce((sum, trade) => sum + (trade.pnl || 0), 0);
        const grossLoss = Math.abs(this.closedTrades
            .filter(trade => (trade.pnl || 0) < 0)
            .reduce((sum, trade) => sum + (trade.pnl || 0), 0));
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
        return {
            totalTrades,
            winningTrades,
            losingTrades,
            winRate,
            totalPnL,
            averagePnL,
            bestTrade,
            worstTrade,
            averageDuration,
            profitFactor
        };
    }
    /**
     * Получить баланс
     */
    getBalance() {
        return this.balance;
    }
    /**
     * Сохранить данные
     */
    async saveData() {
        // Здесь можно добавить сохранение в файл или базу данных
        console.log('💾 Данные сохранены');
    }
    /**
     * Генерировать ID сделки
     */
    generateTradeId() {
        return `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.PaperTradingSystem = PaperTradingSystem;
//# sourceMappingURL=paper-trading.js.map