import { MarketRegime, RegimeData, Config } from './types';
import { EventEmitter } from 'events';
/**
 * Детектор режимов рынка
 * Анализирует ATR, z-score от VWAP, OBI и TFI для определения режима
 */
export declare class RegimeDetector extends EventEmitter {
    private config;
    private atr1m;
    private atr5m;
    private vwap;
    private zscore;
    private obi;
    private tfi;
    private currentRegime;
    private lastRegimeData;
    private priceBuffer;
    private volumeBuffer;
    private candleBuffer;
    constructor(config: Config);
    /**
     * Обновить данные свечи для ATR
     */
    updateCandle(high: number, low: number, close: number, volume: number): void;
    /**
     * Обновить данные сделки для TFI
     */
    updateTrade(price: number, quantity: number, isBuyerMaker: boolean): void;
    /**
     * Обновить данные стакана для OBI
     */
    updateOrderbook(bids: Array<{
        price: number;
        quantity: number;
    }>, asks: Array<{
        price: number;
        quantity: number;
    }>): void;
    /**
     * Определить текущий режим рынка
     */
    private detectRegime;
    /**
     * Вычислить все индикаторы
     */
    private calculateIndicators;
    /**
     * Классифицировать режим на основе индикаторов
     */
    private classifyRegime;
    /**
     * Вычислить уверенность в классификации
     */
    private calculateConfidence;
    /**
     * Получить текущий режим
     */
    getCurrentRegime(): MarketRegime;
    /**
     * Получить последние данные режима
     */
    getLastRegimeData(): RegimeData | null;
    /**
     * Проверить, стабилен ли текущий режим
     */
    isRegimeStable(minDurationMs?: number): boolean;
    /**
     * Получить рекомендации по параметрам для текущего режима
     */
    getRegimeParameters(): {
        tpBps: number;
        offsetMultiplier: number;
        stepMultiplier: number;
        maxLevels: number;
        enableLadder: boolean;
    };
    /**
     * Сбросить состояние детектора
     */
    reset(): void;
}
//# sourceMappingURL=regime.d.ts.map