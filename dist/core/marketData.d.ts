import { MexcRestClient } from '../infra/mexcRest';
/**
 * Интерфейс для рыночных данных
 */
export interface MarketData {
    symbol: string;
    midPrice: number;
    bestBid: number;
    bestAsk: number;
    spread: number;
    spreadTicks: number;
    timestamp: number;
}
/**
 * Менеджер рыночных данных
 */
export declare class MarketDataManager {
    private restClient;
    private symbol;
    private tickSize;
    private lastUpdate;
    private cache;
    private cacheTTL;
    constructor(restClient: MexcRestClient, symbol: string, tickSize: number);
    /**
     * Получить актуальные рыночные данные
     */
    getMarketData(): Promise<MarketData>;
    /**
     * Получить только mid price
     */
    getMidPrice(): Promise<number>;
    /**
     * Получить спред в тиках
     */
    getSpreadTicks(): Promise<number>;
    /**
     * Проверить, актуальны ли данные
     */
    isDataFresh(maxAgeMs?: number): boolean;
    /**
     * Получить последние данные из кеша
     */
    getCachedData(): MarketData | null;
    /**
     * Очистить кеш
     */
    clearCache(): void;
    /**
     * Установить TTL кеша
     */
    setCacheTTL(ttlMs: number): void;
}
//# sourceMappingURL=marketData.d.ts.map