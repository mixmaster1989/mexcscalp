import { MarketAnalysis } from '../../market-analysis/strategies/local-minimum-strategy';
import { CandleData } from '../../market-analysis/indicators/technical-indicators';
export interface MarketSnapshot {
    timestamp: number;
    symbol: string;
    price: number;
    currentVolume: number;
    indicators: {
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
        ema: {
            ema21: number;
            ema50: number;
            ema200: number;
        };
        stochastic: {
            k: number;
            d: number;
        };
    };
    trend: {
        direction: 'UP' | 'DOWN' | 'SIDEWAYS';
        strength: number;
        isLocalMinimum: boolean;
    };
    volumeAnalysis: {
        ratio: number;
        isIncreasing: boolean;
        averageVolume: number;
    };
    levels: {
        support: number | null;
        resistance: number | null;
        distanceToSupport: number | null;
        distanceToResistance: number | null;
    };
    time: {
        hour: number;
        dayOfWeek: number;
        isMarketOpen: boolean;
    };
    metrics: {
        priceChange1m: number;
        priceChange5m: number;
        priceChange15m: number;
        priceChange1h: number;
        volatility: number;
        spread: number;
    };
}
export declare class MarketSnapshotLogger {
    private snapshots;
    private readonly maxSnapshots;
    /**
     * Создать снимок состояния рынка
     */
    createSnapshot(symbol: string, analysis: MarketAnalysis, currentCandle: CandleData, historicalCandles: CandleData[]): MarketSnapshot;
    /**
     * Добавить снимок в коллекцию
     */
    private addSnapshot;
    /**
     * Вычислить изменение цены за период
     */
    private calculatePriceChange;
    /**
     * Вычислить волатильность
     */
    private calculateVolatility;
    /**
     * Вычислить спред (упрощенно)
     */
    private calculateSpread;
    /**
     * Вычислить средний объем
     */
    private calculateAverageVolume;
    /**
     * Проверить, открыт ли рынок
     */
    private isMarketOpen;
    /**
     * Получить все снимки
     */
    getAllSnapshots(): MarketSnapshot[];
    /**
     * Получить снимки по символу
     */
    getSnapshotsBySymbol(symbol: string): MarketSnapshot[];
    /**
     * Получить последние N снимков
     */
    getLastSnapshots(count: number): MarketSnapshot[];
    /**
     * Очистить снимки
     */
    clearSnapshots(): void;
    /**
     * Сохранить снимки в файл
     */
    saveToFile(filename: string): Promise<void>;
    /**
     * Загрузить снимки из файла
     */
    loadFromFile(filename: string): Promise<void>;
}
//# sourceMappingURL=market-snapshot.d.ts.map