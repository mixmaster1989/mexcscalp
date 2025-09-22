export interface PriceData {
    timestamp: number;
    price: number;
    volume?: number;
}
export interface OrderbookData {
    bids: Array<{
        price: number;
        quantity: number;
    }>;
    asks: Array<{
        price: number;
        quantity: number;
    }>;
    timestamp: number;
}
export interface VolatilityData {
    value: number;
    period: number;
    timestamp: number;
}
export interface EMAData {
    fast: number;
    slow: number;
    signal: 'bullish' | 'bearish' | 'neutral';
    timestamp: number;
}
export interface OrderbookAnalysis {
    bidDepth: number;
    askDepth: number;
    spread: number;
    imbalance: number;
    liquidity: 'high' | 'medium' | 'low';
    timestamp: number;
}
/**
 * Класс для расчета технических индикаторов
 */
export declare class TechnicalIndicators {
    private priceSeries;
    private emaCache;
    /**
     * Добавить новую цену
     */
    addPrice(symbol: string, price: number, volume?: number): void;
    /**
     * Рассчитать волатильность за период
     */
    calculateVolatility(symbol: string, periodMs: number): VolatilityData | null;
    /**
     * Рассчитать EMA (экспоненциальная скользящая средняя)
     */
    calculateEMA(symbol: string, fastPeriod: number, slowPeriod: number): EMAData | null;
    /**
     * Анализ стакана ордеров
     */
    analyzeOrderbook(data: OrderbookData, currentPrice: number): OrderbookAnalysis;
    /**
     * Проверить условия для входа в сделку
     */
    checkEntryConditions(symbol: string, volatility: VolatilityData, ema: EMAData, orderbook: OrderbookAnalysis, config: {
        minVolatility: number;
        maxSpread: number;
        minDepth: number;
    }): {
        canEnter: boolean;
        direction?: 'buy' | 'sell';
        confidence: number;
        reasons: string[];
    };
    /**
     * Адаптивный расчет TP/SL на основе волатильности
     */
    calculateAdaptiveLevels(entryPrice: number, volatility: VolatilityData, direction: 'buy' | 'sell', baseTPPercent: number, baseSLPercent: number, volatilityMultiplier?: number): {
        takeProfit: number;
        stopLoss: number;
    };
}
//# sourceMappingURL=technical.d.ts.map