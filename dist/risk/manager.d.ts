import { TradingConfig } from '../config/trading';
export interface RiskMetrics {
    dailyPnL: number;
    dailyTrades: number;
    currentPositions: number;
    exposurePercent: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    maxDrawdown: number;
    consecutiveLosses: number;
    lastTradeTime: number;
}
export interface TradeResult {
    id: string;
    symbol: string;
    side: 'buy' | 'sell';
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    pnl: number;
    pnlPercent: number;
    timestamp: number;
    duration: number;
    reason: 'take_profit' | 'stop_loss' | 'timeout' | 'emergency';
}
export interface PositionInfo {
    id: string;
    symbol: string;
    side: 'buy' | 'sell';
    entryPrice: number;
    quantity: number;
    takeProfit: number;
    stopLoss: number;
    entryTime: number;
    currentPrice?: number;
    unrealizedPnL?: number;
}
/**
 * Менеджер рисков
 */
export declare class RiskManager {
    private config;
    private metrics;
    private tradeHistory;
    private dailyStartTime;
    private emergencyStop;
    private lastPauseCheck;
    constructor(config: TradingConfig);
    /**
     * Проверить можно ли открыть новую позицию
     */
    canOpenPosition(symbol: string, side: 'buy' | 'sell', quantity: number, price: number): {
        allowed: boolean;
        reason?: string;
    };
    /**
     * Зарегистрировать открытие позиции
     */
    onPositionOpened(position: PositionInfo): void;
    /**
     * Зарегистрировать закрытие позиции
     */
    onPositionClosed(position: PositionInfo, exitPrice: number, reason: TradeResult['reason']): TradeResult;
    /**
     * Проверить нужно ли закрыть позицию по времени
     */
    shouldCloseByTime(position: PositionInfo): boolean;
    /**
     * Проверить цену на аварийный гэп
     */
    checkEmergencyGap(oldPrice: number, newPrice: number): boolean;
    /**
     * Сбросить аварийный стоп
     */
    resetEmergencyStop(): void;
    /**
     * Получить текущие метрики
     */
    getMetrics(): RiskMetrics;
    /**
     * Получить историю сделок за сегодня
     */
    getTodayTrades(): TradeResult[];
    /**
     * Получить статистику производительности
     */
    getPerformanceStats(): {
        totalTrades: number;
        winningTrades: number;
        losingTrades: number;
        winRate: number;
        avgProfit: number;
        avgLoss: number;
        profitFactor: number;
        sharpeRatio: number;
        maxDrawdown: number;
    };
    /**
     * Проверить нужно ли сделать паузу в торговле
     */
    shouldPause(): boolean;
    /**
     * Обновить дневную статистику (вызывать каждый день)
     */
    resetDailyStats(): void;
    private updateMetrics;
    private updateDrawdown;
    private getDayStart;
    private calculateStdDev;
}
//# sourceMappingURL=manager.d.ts.map