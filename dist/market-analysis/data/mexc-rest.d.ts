export interface KlineData {
    openTime: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
    closeTime: number;
    quoteAssetVolume: string;
    numberOfTrades: number;
    takerBuyBaseAssetVolume: string;
    takerBuyQuoteAssetVolume: string;
}
export interface TickerData {
    symbol: string;
    priceChange: string;
    priceChangePercent: string;
    weightedAvgPrice: string;
    prevClosePrice: string;
    lastPrice: string;
    lastQty: string;
    bidPrice: string;
    bidQty: string;
    askPrice: string;
    askQty: string;
    openPrice: string;
    highPrice: string;
    lowPrice: string;
    volume: string;
    quoteVolume: string;
    openTime: number;
    closeTime: number;
    firstId: number;
    lastId: number;
    count: number;
}
export interface OrderBookData {
    symbol: string;
    bids: [string, string][];
    asks: [string, string][];
    timestamp: number;
}
export declare class MexcRestClient {
    private client;
    private baseUrl;
    constructor();
    /**
     * Получить исторические данные свечей
     */
    getKlines(symbol: string, interval: string, limit?: number): Promise<KlineData[]>;
    /**
     * Получить текущую цену и статистику
     */
    getTicker(symbol: string): Promise<TickerData>;
    /**
     * Получить стакан заявок
     */
    getOrderBook(symbol: string, limit?: number): Promise<OrderBookData>;
    /**
     * Получить информацию о торговых парах
     */
    getExchangeInfo(): Promise<any>;
}
//# sourceMappingURL=mexc-rest.d.ts.map