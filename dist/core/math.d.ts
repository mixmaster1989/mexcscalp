import { ATRData, VWAPData, EMAData, OBIData, TFIData, OrderbookLevel } from './types';
/**
 * Математические утилиты для торговых индикаторов
 */
export declare class ATRCalculator {
    private highs;
    private lows;
    private closes;
    private period;
    constructor(period: number);
    /**
     * Добавить новую свечу и вычислить ATR
     */
    addCandle(high: number, low: number, close: number): ATRData | null;
}
export declare class VWAPCalculator {
    private trades;
    private windowMs;
    constructor(windowMs: number);
    /**
     * Добавить новую сделку и вычислить VWAP
     */
    addTrade(price: number, volume: number): VWAPData;
}
export declare class EMACalculator {
    private alpha;
    private ema;
    private period;
    constructor(period: number);
    /**
     * Добавить новое значение и вычислить EMA
     */
    addValue(value: number): EMAData;
    /**
     * Получить текущее значение EMA
     */
    getValue(): number | null;
}
export declare class ZScoreCalculator {
    private values;
    private period;
    constructor(period: number);
    /**
     * Добавить новое значение и вычислить Z-Score
     */
    addValue(value: number, reference: number): number;
}
export declare class OBICalculator {
    /**
     * Вычислить OBI на основе стакана
     */
    calculate(bids: OrderbookLevel[], asks: OrderbookLevel[], levels?: number): OBIData;
}
export declare class TFICalculator {
    private trades;
    private windowMs;
    constructor(windowMs: number);
    /**
     * Добавить новую сделку и вычислить TFI
     */
    addTrade(side: 'buy' | 'sell', volume: number): TFIData;
}
export declare class RoundingUtils {
    /**
     * Округлить цену к тику
     */
    static roundToTick(price: number, tickSize: number): number;
    /**
     * Округлить количество к шагу
     */
    static roundToStep(quantity: number, stepSize: number): number;
    /**
     * Проверить минимальный размер позиции
     */
    static validateNotional(price: number, quantity: number, minNotional: number): boolean;
    /**
     * Вычислить размер позиции для заданного notional
     */
    static calculateQuantityForNotional(price: number, notional: number, stepSize: number): number;
    /**
     * Проверить валидность цены и количества
     */
    static validateOrder(price: number, quantity: number, tickSize: number, stepSize: number, minNotional: number): {
        valid: boolean;
        errors: string[];
    };
}
export declare class TimeUtils {
    /**
     * Получить монотонное время в миллисекундах
     */
    static getMonotonicTime(): number;
    /**
     * Получить Unix timestamp в миллисекундах
     */
    static getTimestamp(): number;
    /**
     * Проверить, не устарели ли данные
     */
    static isStale(timestamp: number, maxAgeMs: number): boolean;
    /**
     * Форматировать время для логов
     */
    static formatTime(timestamp?: number): string;
}
export declare class StatsUtils {
    /**
     * Вычислить среднее значение
     */
    static mean(values: number[]): number;
    /**
     * Вычислить стандартное отклонение
     */
    static standardDeviation(values: number[]): number;
    /**
     * Вычислить процентиль
     */
    static percentile(values: number[], p: number): number;
    /**
     * Вычислить Sharpe ratio
     */
    static sharpeRatio(returns: number[], riskFreeRate?: number): number;
}
//# sourceMappingURL=math.d.ts.map