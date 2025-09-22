import { CandleData } from '../indicators/technical-indicators';
export interface PullbackSignal {
    symbol: string;
    signal: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    reason: string;
    timestamp: number;
}
export interface MarketAnalysis {
    symbol: string;
    trend: 'UP' | 'DOWN' | 'SIDEWAYS';
    trendStrength: number;
    pullbackLevel: number;
    rsi: number;
    macd: {
        macd: number;
        signal: number;
        histogram: number;
    };
    bollinger: {
        upper: number;
        middle: number;
        lower: number;
        position: number;
    };
    volume: {
        ratio: number;
        isIncreasing: boolean;
    };
    support: number | null;
    resistance: number | null;
    currentPrice: number;
    timestamp: number;
}
export declare class PullbackStrategy {
    private candles;
    private readonly minCandles;
    private readonly lookbackPeriod;
    /**
     * Обновить данные свечей
     */
    updateCandles(symbol: string, newCandle: CandleData): void;
    /**
     * Получить анализ рынка
     */
    getMarketAnalysis(symbol: string): MarketAnalysis | null;
    /**
     * Получить сигнал на покупку в откате
     */
    getPullbackSignal(symbol: string): PullbackSignal | null;
    /**
     * Получить статистику по символу
     */
    getSymbolStats(symbol: string): {
        candleCount: number;
        lastUpdate: number;
    } | null;
}
//# sourceMappingURL=pullback-strategy.d.ts.map