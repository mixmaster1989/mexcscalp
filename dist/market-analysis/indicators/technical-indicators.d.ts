export interface CandleData {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timestamp: number;
}
export interface IndicatorResult {
    value: number;
    timestamp: number;
}
/**
 * Простые скользящие средние
 */
export declare class MovingAverages {
    /**
     * Простая скользящая средняя (SMA)
     */
    static sma(data: number[], period: number): number[];
    /**
     * Экспоненциальная скользящая средняя (EMA)
     */
    static ema(data: number[], period: number): number[];
    /**
     * Получить последние значения EMA
     */
    static getLastEMA(candles: CandleData[], period: number): number;
}
/**
 * RSI (Relative Strength Index)
 */
export declare class RSI {
    static calculate(candles: CandleData[], period?: number): number;
}
/**
 * Bollinger Bands
 */
export declare class BollingerBands {
    static calculate(candles: CandleData[], period?: number, stdDev?: number): {
        upper: number;
        middle: number;
        lower: number;
    };
}
/**
 * MACD
 */
export declare class MACD {
    static calculate(candles: CandleData[], fastPeriod?: number, slowPeriod?: number, signalPeriod?: number): {
        macd: number;
        signal: number;
        histogram: number;
    };
}
/**
 * Stochastic Oscillator
 */
export declare class Stochastic {
    static calculate(candles: CandleData[], kPeriod?: number, dPeriod?: number): {
        k: number;
        d: number;
    };
}
/**
 * Volume Analysis
 */
export declare class VolumeAnalysis {
    /**
     * Средний объем за период
     */
    static getAverageVolume(candles: CandleData[], period?: number): number;
    /**
     * Отношение текущего объема к среднему
     */
    static getVolumeRatio(candles: CandleData[], period?: number): number;
}
/**
 * Support and Resistance Levels
 */
export declare class SupportResistance {
    /**
     * Найти локальные максимумы и минимумы
     */
    static findLevels(candles: CandleData[], lookback?: number): {
        supports: number[];
        resistances: number[];
    };
}
//# sourceMappingURL=technical-indicators.d.ts.map