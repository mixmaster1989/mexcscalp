export declare class MexcRestClient {
    private client;
    private apiKey;
    private secretKey;
    constructor(apiKey: string, secretKey: string);
    private generateSignature;
    private buildQueryString;
    private parseQueryString;
    getAccountInfo(): Promise<any>;
    placeOrder(symbol: string, side: string, type: string, quantity: number, price?: number): Promise<any>;
    cancelOrder(symbol: string, orderId: string): Promise<any>;
    cancelAllOpenOrders(symbol: string): Promise<any>;
    getOrder(symbol: string, orderId: string): Promise<any>;
    getOpenOrders(symbol?: string): Promise<any>;
    getMyTrades(symbol: string, limit?: number): Promise<any>;
    getPrice(symbol: string): Promise<any>;
    getBookTicker(symbol: string): Promise<any>;
    ping(): Promise<any>;
    getServerTime(): Promise<any>;
}
//# sourceMappingURL=mexcRest.d.ts.map