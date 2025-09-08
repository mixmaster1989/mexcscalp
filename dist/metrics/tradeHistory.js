"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeHistoryService = void 0;
const db_1 = require("../storage/db");
const mexcRest_1 = require("../infra/mexcRest");
/**
 * Класс для работы с историей сделок
 */
class TradeHistoryService {
    db;
    mexcClient;
    constructor(apiKey, secretKey) {
        this.db = (0, db_1.getDatabase)();
        this.mexcClient = new mexcRest_1.MexcRestClient(apiKey, secretKey);
    }
    /**
     * Получить историю сделок за последние 24 часа
     */
    async getDailyTradeHistory() {
        try {
            // Получаем сделки через API MEXC за последние 24 часа
            const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
            // Получаем сделки по ETHUSDC (основная пара скальпера)
            const ethTrades = await this.mexcClient.getMyTrades('ETHUSDC', 1000);
            // Фильтруем сделки за последние 24 часа
            const recentTrades = ethTrades.filter(trade => trade.timestamp >= oneDayAgo);
            // Конвертируем в формат TradeHistoryItem
            const tradeHistory = recentTrades.map(trade => ({
                tradeId: trade.id,
                symbol: trade.symbol,
                side: trade.side,
                entryPrice: trade.price,
                exitPrice: trade.price,
                quantity: trade.quantity,
                pnl: 0, // PnL будет рассчитан позже
                fee: 0, // На MEXC нет комиссий по ETH/USDC
                timestamp: trade.timestamp,
                strategy: 'mexc-scalper-auto',
                orderId: trade.orderId
            }));
            // Рассчитываем PnL для пар сделок BUY/SELL
            return this.calculateTradePairsPnL(tradeHistory);
            // Сортируем по времени (новые сначала)
            return tradeHistory.sort((a, b) => b.timestamp - a.timestamp);
        }
        catch (error) {
            console.error('Ошибка получения истории сделок через API:', error);
            throw new Error(`Не удалось получить историю сделок через API: ${error}`);
        }
    }
    /**
     * Получить историю сделок за указанный период
     */
    async getTradeHistory(startTime, endTime) {
        try {
            // Получаем сделки через API MEXC за указанный период
            const ethTrades = await this.mexcClient.getMyTrades('ETHUSDC', 1000);
            // Фильтруем сделки по периоду
            const periodTrades = ethTrades.filter(trade => trade.timestamp >= startTime && trade.timestamp <= endTime);
            // Конвертируем в формат TradeHistoryItem
            const tradeHistory = periodTrades.map(trade => ({
                tradeId: trade.id,
                symbol: trade.symbol,
                side: trade.side,
                entryPrice: trade.price,
                exitPrice: trade.price,
                quantity: trade.quantity,
                pnl: 0, // PnL будет рассчитан позже
                fee: 0, // На MEXC нет комиссий по ETH/USDC
                timestamp: trade.timestamp,
                strategy: 'mexc-scalper-auto',
                orderId: trade.orderId
            }));
            // Рассчитываем PnL для пар сделок BUY/SELL
            const tradesWithPnL = this.calculateTradePairsPnL(tradeHistory);
            return tradesWithPnL.sort((a, b) => b.timestamp - a.timestamp);
        }
        catch (error) {
            console.error('Ошибка получения истории сделок за период через API:', error);
            throw new Error(`Не удалось получить историю сделок за период через API: ${error}`);
        }
    }
    /**
     * Получить статистику по сделкам за сутки
     */
    async getDailyTradeStats() {
        const trades = await this.getDailyTradeHistory();
        return this.calculateTradeStats(trades);
    }
    /**
     * Получить статистику по сделкам за период
     */
    async getTradeStats(startTime, endTime) {
        const trades = await this.getTradeHistory(startTime, endTime);
        return this.calculateTradeStats(trades);
    }
    /**
     * Рассчитать PnL для пар сделок BUY/SELL
     */
    calculateTradePairsPnL(trades) {
        const buyTrades = trades.filter(t => t.side === 'buy').sort((a, b) => a.timestamp - b.timestamp);
        const sellTrades = trades.filter(t => t.side === 'sell').sort((a, b) => a.timestamp - b.timestamp);
        const tradesWithPnL = [...trades];
        // Сопоставляем BUY и SELL сделки для расчета PnL
        let buyIndex = 0;
        let sellIndex = 0;
        while (buyIndex < buyTrades.length && sellIndex < sellTrades.length) {
            const buyTrade = buyTrades[buyIndex];
            const sellTrade = sellTrades[sellIndex];
            // Ищем соответствующие сделки в основном массиве
            const buyTradeInMain = tradesWithPnL.find(t => t.tradeId === buyTrade.tradeId);
            const sellTradeInMain = tradesWithPnL.find(t => t.tradeId === sellTrade.tradeId);
            if (buyTradeInMain && sellTradeInMain) {
                // Рассчитываем PnL: (Цена продажи - Цена покупки) * Количество
                const pnl = (sellTrade.exitPrice - buyTrade.entryPrice) * buyTrade.quantity;
                // Обновляем PnL в обеих сделках
                buyTradeInMain.pnl = pnl;
                sellTradeInMain.pnl = pnl;
                // Обновляем цены входа и выхода
                buyTradeInMain.entryPrice = buyTrade.entryPrice;
                buyTradeInMain.exitPrice = sellTrade.exitPrice;
                sellTradeInMain.entryPrice = buyTrade.entryPrice;
                sellTradeInMain.exitPrice = sellTrade.exitPrice;
            }
            buyIndex++;
            sellIndex++;
        }
        return tradesWithPnL;
    }
    /**
     * Рассчитать статистику по сделкам
     */
    calculateTradeStats(trades) {
        if (trades.length === 0) {
            return {
                totalTrades: 0,
                winningTrades: 0,
                losingTrades: 0,
                totalPnl: 0,
                totalFees: 0,
                avgPnl: 0,
                winRate: 0,
                bestTrade: 0,
                worstTrade: 0,
                avgDuration: 0
            };
        }
        const winningTrades = trades.filter(t => t.pnl > 0);
        const losingTrades = trades.filter(t => t.pnl < 0);
        const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
        const totalFees = trades.reduce((sum, t) => sum + t.fee, 0);
        const bestTrade = Math.max(...trades.map(t => t.pnl));
        const worstTrade = Math.min(...trades.map(t => t.pnl));
        return {
            totalTrades: trades.length,
            winningTrades: winningTrades.length,
            losingTrades: losingTrades.length,
            totalPnl,
            totalFees,
            avgPnl: totalPnl / trades.length,
            winRate: (winningTrades.length / trades.length) * 100,
            bestTrade,
            worstTrade,
            avgDuration: 0 // Пока не реализовано
        };
    }
    /**
     * Экспортировать историю сделок в CSV
     */
    async exportToCSV(trades) {
        const headers = [
            'Trade ID',
            'Symbol',
            'Side',
            'Entry Price',
            'Exit Price',
            'Quantity',
            'PnL',
            'Fee',
            'Timestamp',
            'Strategy',
            'Order ID'
        ];
        const rows = trades.map(t => [
            t.tradeId,
            t.symbol,
            t.side,
            t.entryPrice,
            t.exitPrice,
            t.quantity,
            t.pnl,
            t.fee,
            new Date(t.timestamp).toISOString(),
            t.strategy || '',
            t.orderId
        ]);
        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');
        return csvContent;
    }
    /**
     * Получить топ-5 лучших сделок за сутки
     */
    async getTopTrades(limit = 5) {
        const trades = await this.getDailyTradeHistory();
        return trades
            .filter(t => t.pnl > 0)
            .sort((a, b) => b.pnl - a.pnl)
            .slice(0, limit);
    }
    /**
     * Получить худшие сделки за сутки
     */
    async getWorstTrades(limit = 5) {
        const trades = await this.getDailyTradeHistory();
        return trades
            .filter(t => t.pnl < 0)
            .sort((a, b) => a.pnl - b.pnl)
            .slice(0, limit);
    }
}
exports.TradeHistoryService = TradeHistoryService;
//# sourceMappingURL=tradeHistory.js.map