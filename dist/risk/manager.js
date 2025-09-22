"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskManager = void 0;
/**
 * Менеджер рисков
 */
class RiskManager {
    config;
    metrics;
    tradeHistory = [];
    dailyStartTime;
    emergencyStop = false;
    lastPauseCheck = 0;
    constructor(config) {
        this.config = config;
        this.dailyStartTime = this.getDayStart();
        this.metrics = {
            dailyPnL: 0,
            dailyTrades: 0,
            currentPositions: 0,
            exposurePercent: 0,
            winRate: 0,
            avgWin: 0,
            avgLoss: 0,
            maxDrawdown: 0,
            consecutiveLosses: 0,
            lastTradeTime: 0
        };
    }
    /**
     * Проверить можно ли открыть новую позицию
     */
    canOpenPosition(symbol, side, quantity, price) {
        // Проверка аварийного стопа
        if (this.emergencyStop) {
            return { allowed: false, reason: 'Активирован аварийный стоп' };
        }
        // Проверка дневного лимита убытков
        if (this.metrics.dailyPnL <= -this.config.dailyLossLimit) {
            return { allowed: false, reason: 'Достигнут дневной лимит убытков' };
        }
        // Проверка дневной цели
        if (this.metrics.dailyPnL >= this.config.dailyTargetProfit) {
            return { allowed: false, reason: 'Достигнута дневная цель прибыли' };
        }
        // Проверка максимального количества позиций
        if (this.metrics.currentPositions >= this.config.maxParallelPositions) {
            return { allowed: false, reason: 'Достигнуто максимальное количество позиций' };
        }
        // Проверка размера позиции
        const positionValue = quantity * price;
        const positionPercent = (positionValue / this.config.deposit) * 100;
        if (positionPercent > this.config.positionSizePercent) {
            return { allowed: false, reason: 'Размер позиции превышает лимит' };
        }
        // Проверка общей экспозиции
        const newExposure = this.metrics.exposurePercent + positionPercent;
        if (newExposure > this.config.maxParallelPositions * this.config.positionSizePercent) {
            return { allowed: false, reason: 'Превышен лимит общей экспозиции' };
        }
        // Проверка подряд идущих убытков
        if (this.metrics.consecutiveLosses >= 5) {
            return { allowed: false, reason: 'Слишком много подряд убыточных сделок' };
        }
        return { allowed: true };
    }
    /**
     * Зарегистрировать открытие позиции
     */
    onPositionOpened(position) {
        this.metrics.currentPositions++;
        const positionValue = position.quantity * position.entryPrice;
        const positionPercent = (positionValue / this.config.deposit) * 100;
        this.metrics.exposurePercent += positionPercent;
    }
    /**
     * Зарегистрировать закрытие позиции
     */
    onPositionClosed(position, exitPrice, reason) {
        this.metrics.currentPositions--;
        // Убираем экспозицию
        const positionValue = position.quantity * position.entryPrice;
        const positionPercent = (positionValue / this.config.deposit) * 100;
        this.metrics.exposurePercent -= positionPercent;
        // Рассчитываем PnL
        let pnl;
        if (position.side === 'buy') {
            pnl = (exitPrice - position.entryPrice) * position.quantity;
        }
        else {
            pnl = (position.entryPrice - exitPrice) * position.quantity;
        }
        const pnlPercent = (pnl / (position.quantity * position.entryPrice)) * 100;
        // Создаем результат сделки
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
        // Обновляем статистику
        this.updateMetrics(trade);
        this.tradeHistory.push(trade);
        // Ограничиваем историю последними 1000 сделок
        if (this.tradeHistory.length > 1000) {
            this.tradeHistory.splice(0, this.tradeHistory.length - 1000);
        }
        return trade;
    }
    /**
     * Проверить нужно ли закрыть позицию по времени
     */
    shouldCloseByTime(position) {
        const duration = Date.now() - position.entryTime;
        return duration >= this.config.maxTradeTimeMs;
    }
    /**
     * Проверить цену на аварийный гэп
     */
    checkEmergencyGap(oldPrice, newPrice) {
        const gapPercent = Math.abs((newPrice - oldPrice) / oldPrice) * 100;
        if (gapPercent > this.config.maxGapPercent) {
            this.emergencyStop = true;
            return true;
        }
        return false;
    }
    /**
     * Сбросить аварийный стоп
     */
    resetEmergencyStop() {
        this.emergencyStop = false;
    }
    /**
     * Получить текущие метрики
     */
    getMetrics() {
        return { ...this.metrics };
    }
    /**
     * Получить историю сделок за сегодня
     */
    getTodayTrades() {
        const todayStart = this.getDayStart();
        return this.tradeHistory.filter(t => t.timestamp >= todayStart);
    }
    /**
     * Получить статистику производительности
     */
    getPerformanceStats() {
        const todayTrades = this.getTodayTrades();
        const winningTrades = todayTrades.filter(t => t.pnl > 0);
        const losingTrades = todayTrades.filter(t => t.pnl < 0);
        const winRate = todayTrades.length > 0 ? (winningTrades.length / todayTrades.length) * 100 : 0;
        const avgProfit = winningTrades.length > 0 ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length : 0;
        const avgLoss = losingTrades.length > 0 ? Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length) : 0;
        const totalProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
        const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
        const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : 0;
        // Упрощенный расчет Sharpe Ratio
        const avgReturn = todayTrades.length > 0 ? todayTrades.reduce((sum, t) => sum + t.pnlPercent, 0) / todayTrades.length : 0;
        const returns = todayTrades.map(t => t.pnlPercent);
        const stdDev = this.calculateStdDev(returns);
        const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;
        return {
            totalTrades: todayTrades.length,
            winningTrades: winningTrades.length,
            losingTrades: losingTrades.length,
            winRate,
            avgProfit,
            avgLoss,
            profitFactor,
            sharpeRatio,
            maxDrawdown: this.metrics.maxDrawdown
        };
    }
    /**
     * Проверить нужно ли сделать паузу в торговле
     */
    shouldPause() {
        // Пауза после серии убытков
        if (this.metrics.consecutiveLosses >= 3) {
            console.log(`🛑 RiskManager: Пауза - слишком много убытков подряд (${this.metrics.consecutiveLosses})`);
            return true;
        }
        // Пауза если достигли дневного лимита
        const lossLimitReached = this.metrics.dailyPnL <= -this.config.dailyLossLimit;
        const profitTargetReached = this.metrics.dailyPnL >= this.config.dailyTargetProfit;
        if (lossLimitReached || profitTargetReached) {
            console.log(`🛑 RiskManager: Пауза - дневной лимит достигнут. PnL: ${this.metrics.dailyPnL}, лимит убытков: -${this.config.dailyLossLimit}, цель прибыли: ${this.config.dailyTargetProfit}`);
            return true;
        }
        // Логируем состояние для отладки (раз в минуту)
        const now = Date.now();
        if (!this.lastPauseCheck || now - this.lastPauseCheck > 60000) {
            this.lastPauseCheck = now;
            console.log(`📊 RiskManager: PnL=${this.metrics.dailyPnL}, убытки подряд=${this.metrics.consecutiveLosses}, торговля разрешена`);
        }
        return false;
    }
    /**
     * Обновить дневную статистику (вызывать каждый день)
     */
    resetDailyStats() {
        const newDayStart = this.getDayStart();
        if (newDayStart > this.dailyStartTime) {
            this.dailyStartTime = newDayStart;
            this.metrics.dailyPnL = 0;
            this.metrics.dailyTrades = 0;
            this.metrics.consecutiveLosses = 0;
            this.emergencyStop = false;
        }
    }
    updateMetrics(trade) {
        // Обновляем дневную статистику
        this.metrics.dailyPnL += trade.pnl;
        this.metrics.dailyTrades++;
        this.metrics.lastTradeTime = trade.timestamp;
        // Обновляем счетчик убытков подряд
        if (trade.pnl < 0) {
            this.metrics.consecutiveLosses++;
        }
        else {
            this.metrics.consecutiveLosses = 0;
        }
        // Обновляем общую статистику
        const allTrades = this.tradeHistory.concat([trade]);
        const winningTrades = allTrades.filter(t => t.pnl > 0);
        this.metrics.winRate = allTrades.length > 0 ? (winningTrades.length / allTrades.length) * 100 : 0;
        this.metrics.avgWin = winningTrades.length > 0 ?
            winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length : 0;
        const losingTrades = allTrades.filter(t => t.pnl < 0);
        this.metrics.avgLoss = losingTrades.length > 0 ?
            losingTrades.reduce((sum, t) => sum + Math.abs(t.pnl), 0) / losingTrades.length : 0;
        // Обновляем максимальную просадку
        this.updateDrawdown();
    }
    updateDrawdown() {
        const todayTrades = this.getTodayTrades();
        if (todayTrades.length === 0)
            return;
        let peak = 0;
        let currentPnL = 0;
        let maxDD = 0;
        for (const trade of todayTrades) {
            currentPnL += trade.pnl;
            if (currentPnL > peak) {
                peak = currentPnL;
            }
            const drawdown = peak - currentPnL;
            if (drawdown > maxDD) {
                maxDD = drawdown;
            }
        }
        this.metrics.maxDrawdown = (maxDD / this.config.deposit) * 100;
    }
    getDayStart() {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    }
    calculateStdDev(values) {
        if (values.length === 0)
            return 0;
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }
}
exports.RiskManager = RiskManager;
//# sourceMappingURL=manager.js.map