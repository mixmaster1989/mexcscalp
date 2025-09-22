"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatisticsLogger = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Логгер статистики торговли
 */
class StatisticsLogger {
    logger;
    statsFile;
    dailyStatsFile;
    constructor(logger) {
        this.logger = logger;
        this.statsFile = './logs/trading-stats.json';
        this.dailyStatsFile = './logs/daily-stats.json';
        // Создаем папку для статистики
        const logDir = path_1.default.dirname(this.statsFile);
        if (!fs_1.default.existsSync(logDir)) {
            fs_1.default.mkdirSync(logDir, { recursive: true });
        }
    }
    /**
     * Логировать завершенную сделку
     */
    logTrade(trade) {
        const tradeInfo = {
            ...trade,
            timestamp: new Date(trade.timestamp).toISOString(),
            duration: this.formatDuration(trade.duration),
            pnlFormatted: `${trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(4)} USDT`,
            pnlPercentFormatted: `${trade.pnlPercent >= 0 ? '+' : ''}${trade.pnlPercent.toFixed(2)}%`
        };
        // Логируем в консоль
        const emoji = trade.pnl >= 0 ? '✅' : '❌';
        this.logger.info(tradeInfo, `${emoji} Сделка ${trade.side.toUpperCase()} ${trade.symbol}: ${tradeInfo.pnlFormatted} (${tradeInfo.pnlPercentFormatted})`);
        // Сохраняем в файл
        this.saveTradeToFile(trade);
    }
    /**
     * Логировать периодическую статистику
     */
    logPeriodic(botStats) {
        const stats = botStats.performance;
        const risk = botStats.risk;
        const summary = {
            timestamp: new Date().toISOString(),
            dailyPnL: `${risk.dailyPnL >= 0 ? '+' : ''}${risk.dailyPnL.toFixed(2)} USDT`,
            totalTrades: stats.totalTrades,
            winRate: `${stats.winRate.toFixed(1)}%`,
            profitFactor: stats.profitFactor.toFixed(2),
            maxDrawdown: `${stats.maxDrawdown.toFixed(2)}%`,
            activePositions: botStats.positions.totalPositions,
            avgTradeDuration: this.formatDuration(botStats.positions.avgDuration)
        };
        this.logger.info(summary, '📊 Периодическая статистика');
        // Сохраняем дневную статистику
        this.saveDailyStats(risk, stats);
    }
    /**
     * Логировать открытие позиции
     */
    logPositionOpen(position) {
        const positionValue = position.quantity * position.entryPrice;
        const tpDistance = Math.abs((position.takeProfit - position.entryPrice) / position.entryPrice * 100);
        const slDistance = Math.abs((position.stopLoss - position.entryPrice) / position.entryPrice * 100);
        this.logger.info({
            position: {
                ...position,
                value: `${positionValue.toFixed(2)} USDT`,
                tpDistance: `${tpDistance.toFixed(2)}%`,
                slDistance: `${slDistance.toFixed(2)}%`
            }
        }, `🔓 Открыта позиция ${position.side.toUpperCase()} ${position.symbol}`);
    }
    /**
     * Логировать ошибки торговли
     */
    logTradingError(error) {
        this.logger.error({
            error: {
                ...error,
                timestamp: new Date().toISOString()
            }
        }, `❌ Ошибка торговли: ${error.message}`);
        // Сохраняем критические ошибки в отдельный файл
        if (error.type === 'api_error' || error.type === 'websocket_error') {
            this.saveErrorToFile(error);
        }
    }
    /**
     * Генерировать отчет за день
     */
    generateDailyReport() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const dailyStats = this.loadDailyStats();
            const todayStats = dailyStats.find(s => s.date === today);
            if (!todayStats) {
                return '📊 Данных за сегодня пока нет';
            }
            return `
📊 Дневной отчет (${today}):
├─ Сделок: ${todayStats.trades}
├─ Прибыль: ${todayStats.profit >= 0 ? '+' : ''}${todayStats.profit.toFixed(2)} USDT
├─ Винрейт: ${todayStats.winRate.toFixed(1)}%
├─ Макс. просадка: ${todayStats.maxDrawdown.toFixed(2)}%
└─ Объем: ${todayStats.volume.toFixed(2)} USDT
      `.trim();
        }
        catch (error) {
            this.logger.error({ error }, 'Ошибка генерации дневного отчета');
            return '❌ Ошибка генерации отчета';
        }
    }
    /**
     * Генерировать отчет по торговым парам
     */
    generatePairReport() {
        try {
            const pairStats = this.calculatePairStats();
            if (pairStats.length === 0) {
                return '📊 Данных по торговым парам нет';
            }
            let report = '📈 Статистика по парам:\n';
            pairStats.forEach((pair, index) => {
                const connector = index === pairStats.length - 1 ? '└─' : '├─';
                report += `${connector} ${pair.symbol}: ${pair.trades} сделок, `;
                report += `${pair.profit >= 0 ? '+' : ''}${pair.profit.toFixed(2)} USDT `;
                report += `(${pair.winRate.toFixed(1)}%)\n`;
            });
            return report.trim();
        }
        catch (error) {
            this.logger.error({ error }, 'Ошибка генерации отчета по парам');
            return '❌ Ошибка генерации отчета';
        }
    }
    /**
     * Рассчитать статистику торговли
     */
    calculateTradeStatistics() {
        try {
            const trades = this.loadTradesFromFile();
            if (trades.length === 0) {
                return this.getEmptyStats();
            }
            const winningTrades = trades.filter(t => t.pnl > 0);
            const losingTrades = trades.filter(t => t.pnl < 0);
            const totalProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
            const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
            const avgTradeDuration = trades.reduce((sum, t) => sum + t.duration, 0) / trades.length;
            const avgTradesPerDay = this.calculateAvgTradesPerDay(trades);
            return {
                totalTrades: trades.length,
                winningTrades: winningTrades.length,
                losingTrades: losingTrades.length,
                winRate: (winningTrades.length / trades.length) * 100,
                avgWin: winningTrades.length > 0 ? totalProfit / winningTrades.length : 0,
                avgLoss: losingTrades.length > 0 ? totalLoss / losingTrades.length : 0,
                totalProfit,
                totalLoss,
                netProfit: totalProfit - totalLoss,
                profitFactor: totalLoss > 0 ? totalProfit / totalLoss : 0,
                maxDrawdown: this.calculateMaxDrawdown(trades),
                avgTradeDuration,
                avgTradesPerDay,
                bestTrade: Math.max(...trades.map(t => t.pnl)),
                worstTrade: Math.min(...trades.map(t => t.pnl)),
                consecutiveWins: this.calculateConsecutiveWins(trades),
                consecutiveLosses: this.calculateConsecutiveLosses(trades),
                sharpeRatio: this.calculateSharpeRatio(trades)
            };
        }
        catch (error) {
            this.logger.error({ error }, 'Ошибка расчета статистики');
            return this.getEmptyStats();
        }
    }
    saveTradeToFile(trade) {
        try {
            const trades = this.loadTradesFromFile();
            trades.push(trade);
            // Оставляем только последние 1000 сделок
            if (trades.length > 1000) {
                trades.splice(0, trades.length - 1000);
            }
            fs_1.default.writeFileSync(this.statsFile, JSON.stringify(trades, null, 2));
        }
        catch (error) {
            this.logger.error({ error }, 'Ошибка сохранения сделки в файл');
        }
    }
    saveDailyStats(riskMetrics, performance) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const dailyStats = this.loadDailyStats();
            const todayIndex = dailyStats.findIndex(s => s.date === today);
            const todayStatsEntry = {
                date: today,
                trades: performance.totalTrades,
                profit: riskMetrics.dailyPnL,
                winRate: performance.winRate,
                maxDrawdown: performance.maxDrawdown,
                volume: 0 // Можно добавить подсчет объема
            };
            if (todayIndex >= 0) {
                dailyStats[todayIndex] = todayStatsEntry;
            }
            else {
                dailyStats.push(todayStatsEntry);
            }
            // Оставляем только последние 30 дней
            if (dailyStats.length > 30) {
                dailyStats.splice(0, dailyStats.length - 30);
            }
            fs_1.default.writeFileSync(this.dailyStatsFile, JSON.stringify(dailyStats, null, 2));
        }
        catch (error) {
            this.logger.error({ error }, 'Ошибка сохранения дневной статистики');
        }
    }
    saveErrorToFile(error) {
        try {
            const errorFile = './logs/errors.json';
            let errors = [];
            if (fs_1.default.existsSync(errorFile)) {
                errors = JSON.parse(fs_1.default.readFileSync(errorFile, 'utf-8'));
            }
            errors.push({
                ...error,
                timestamp: new Date().toISOString()
            });
            // Оставляем только последние 100 ошибок
            if (errors.length > 100) {
                errors.splice(0, errors.length - 100);
            }
            fs_1.default.writeFileSync(errorFile, JSON.stringify(errors, null, 2));
        }
        catch (err) {
            this.logger.error({ err }, 'Ошибка сохранения ошибки в файл');
        }
    }
    loadTradesFromFile() {
        try {
            if (fs_1.default.existsSync(this.statsFile)) {
                return JSON.parse(fs_1.default.readFileSync(this.statsFile, 'utf-8'));
            }
        }
        catch (error) {
            this.logger.error({ error }, 'Ошибка загрузки сделок из файла');
        }
        return [];
    }
    loadDailyStats() {
        try {
            if (fs_1.default.existsSync(this.dailyStatsFile)) {
                return JSON.parse(fs_1.default.readFileSync(this.dailyStatsFile, 'utf-8'));
            }
        }
        catch (error) {
            this.logger.error({ error }, 'Ошибка загрузки дневной статистики');
        }
        return [];
    }
    calculatePairStats() {
        const trades = this.loadTradesFromFile();
        const pairMap = new Map();
        // Группируем сделки по символам
        trades.forEach(trade => {
            if (!pairMap.has(trade.symbol)) {
                pairMap.set(trade.symbol, []);
            }
            pairMap.get(trade.symbol).push(trade);
        });
        // Рассчитываем статистику для каждой пары
        const pairStats = [];
        pairMap.forEach((pairTrades, symbol) => {
            const profit = pairTrades.reduce((sum, t) => sum + t.pnl, 0);
            const winningTrades = pairTrades.filter(t => t.pnl > 0).length;
            const winRate = (winningTrades / pairTrades.length) * 100;
            const lastTradeTime = Math.max(...pairTrades.map(t => t.timestamp));
            pairStats.push({
                symbol,
                trades: pairTrades.length,
                profit,
                winRate,
                avgProfit: profit / pairTrades.length,
                lastTradeTime
            });
        });
        return pairStats.sort((a, b) => b.profit - a.profit);
    }
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        if (hours > 0) {
            return `${hours}ч ${minutes % 60}м`;
        }
        else if (minutes > 0) {
            return `${minutes}м ${seconds % 60}с`;
        }
        else {
            return `${seconds}с`;
        }
    }
    getEmptyStats() {
        return {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            winRate: 0,
            avgWin: 0,
            avgLoss: 0,
            totalProfit: 0,
            totalLoss: 0,
            netProfit: 0,
            profitFactor: 0,
            maxDrawdown: 0,
            avgTradeDuration: 0,
            avgTradesPerDay: 0,
            bestTrade: 0,
            worstTrade: 0,
            consecutiveWins: 0,
            consecutiveLosses: 0,
            sharpeRatio: 0
        };
    }
    calculateMaxDrawdown(trades) {
        let peak = 0;
        let currentPnL = 0;
        let maxDD = 0;
        trades.forEach(trade => {
            currentPnL += trade.pnl;
            if (currentPnL > peak) {
                peak = currentPnL;
            }
            const drawdown = peak - currentPnL;
            if (drawdown > maxDD) {
                maxDD = drawdown;
            }
        });
        return maxDD;
    }
    calculateConsecutiveWins(trades) {
        let maxWins = 0;
        let currentWins = 0;
        trades.forEach(trade => {
            if (trade.pnl > 0) {
                currentWins++;
                maxWins = Math.max(maxWins, currentWins);
            }
            else {
                currentWins = 0;
            }
        });
        return maxWins;
    }
    calculateConsecutiveLosses(trades) {
        let maxLosses = 0;
        let currentLosses = 0;
        trades.forEach(trade => {
            if (trade.pnl < 0) {
                currentLosses++;
                maxLosses = Math.max(maxLosses, currentLosses);
            }
            else {
                currentLosses = 0;
            }
        });
        return maxLosses;
    }
    calculateSharpeRatio(trades) {
        if (trades.length < 2)
            return 0;
        const returns = trades.map(t => t.pnlPercent);
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);
        return stdDev > 0 ? avgReturn / stdDev : 0;
    }
    calculateAvgTradesPerDay(trades) {
        if (trades.length === 0)
            return 0;
        const firstTrade = Math.min(...trades.map(t => t.timestamp));
        const lastTrade = Math.max(...trades.map(t => t.timestamp));
        const daysSpan = (lastTrade - firstTrade) / (1000 * 60 * 60 * 24);
        return daysSpan > 0 ? trades.length / daysSpan : 0;
    }
}
exports.StatisticsLogger = StatisticsLogger;
//# sourceMappingURL=statistics.js.map