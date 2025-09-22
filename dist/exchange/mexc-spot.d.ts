export interface PlaceOrderParams {
    symbol: string;
    side: 'BUY' | 'SELL';
    type?: 'LIMIT' | 'MARKET';
    quantity?: string;
    quoteOrderQty?: string;
    price?: string;
    timeInForce?: 'GTC' | 'IOC' | 'FOK';
    recvWindow?: number;
}
export interface CancelOrderParams {
    symbol: string;
    orderId?: string;
    origClientOrderId?: string;
    recvWindow?: number;
}
export interface MexcSpotClientConfig {
    apiKey: string;
    apiSecret: string;
    baseUrl?: string;
    timeoutMs?: number;
}
export declare class MexcSpotClient {
    private client;
    private apiKey;
    private apiSecret;
    constructor(config?: Partial<MexcSpotClientConfig>);
    private sign;
    private buildQuery;
    private signedRequest;
    getAccountInfo(): Promise<any>;
    getOpenOrders(symbol?: string): Promise<any[]>;
    placeOrder(params: PlaceOrderParams): Promise<any>;
    cancelOrder(params: CancelOrderParams): Promise<any>;
    getMyTrades(symbol: string, options?: {
        limit?: number;
        startTime?: number;
        endTime?: number;
    }): Promise<any[]>;
    getPrice(symbol: string): Promise<any>;
    getAllPrices(): Promise<any>;
    get24hrTicker(symbol: string): Promise<any>;
}
//# sourceMappingURL=mexc-spot.d.ts.map