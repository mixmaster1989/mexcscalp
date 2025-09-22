import pino from 'pino';
export interface TradeStatistics {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    totalProfit: number;
    totalLoss: number;
    netProfit: number;
    profitFactor: number;
    maxDrawdown: number;
    avgTradeDuration: number;
    avgTradesPerDay: number;
    bestTrade: number;
    worstTrade: number;
    consecutiveWins: number;
    consecutiveLosses: number;
    sharpeRatio: number;
}
export interface DailyStats {
    date: string;
    trades: number;
    profit: number;
    winRate: number;
    maxDrawdown: number;
    volume: number;
}
export interface PairStats {
    symbol: string;
    trades: number;
    profit: number;
    winRate: number;
    avgProfit: number;
    lastTradeTime: number;
}
/**
 * Логгер статистики торговли
 */
export declare class StatisticsLogger {
    private logger;
    private statsFile;
    private dailyStatsFile;
    constructor(logger: pino.Logger);
    /**
     * Логировать завершенную сделку
     */
    logTrade(trade: {
        id: string;
        symbol: string;
        side: 'buy' | 'sell';
        entryPrice: number;
        exitPrice: number;
        quantity: number;
        pnl: number;
        pnlPercent: number;
        duration: number;
        timestamp: number;
        reason: string;
    }): void;
    /**
     * Логировать периодическую статистику
     */
    logPeriodic(botStats: any): void;
    /**
     * Логировать открытие позиции
     */
    logPositionOpen(position: {
        id: string;
        symbol: string;
        side: 'buy' | 'sell';
        entryPrice: number;
        quantity: number;
        takeProfit: number;
        stopLoss: number;
    }): void;
    /**
     * Логировать ошибки торговли
     */
    logTradingError(error: {
        type: 'position_open' | 'position_close' | 'api_error' | 'websocket_error' | 'strategy_error';
        message: string;
        symbol?: string;
        details?: any;
    }): void;
    /**
     * Генерировать отчет за день
     */
    generateDailyReport(): string;
    /**
     * Генерировать отчет по торговым парам
     */
    generatePairReport(): string;
    /**
     * Рассчитать статистику торговли
     */
    calculateTradeStatistics(): TradeStatistics;
    private saveTradeToFile;
    private saveDailyStats;
    private saveErrorToFile;
    private loadTradesFromFile;
    private loadDailyStats;
    private calculatePairStats;
    private formatDuration;
    private getEmptyStats;
    private calculateMaxDrawdown;
    private calculateConsecutiveWins;
    private calculateConsecutiveLosses;
    private calculateSharpeRatio;
    private calculateAvgTradesPerDay;
}
//# sourceMappingURL=statistics.d.ts.map