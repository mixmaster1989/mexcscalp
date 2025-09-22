export interface KlineUpdate {
    symbol: string;
    kline: {
        openTime: number;
        closeTime: number;
        symbol: string;
        interval: string;
        firstTradeId: number;
        lastTradeId: number;
        open: string;
        close: string;
        high: string;
        low: string;
        volume: string;
        count: number;
        quoteVolume: string;
        takerBuyBaseVolume: string;
        takerBuyQuoteVolume: string;
        isFinal: boolean;
    };
}
export interface TradeUpdate {
    symbol: string;
    price: string;
    quantity: string;
    time: number;
    isBuyerMaker: boolean;
}
export declare class MexcWebSocketClient {
    private ws;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private reconnectInterval;
    private isConnected;
    private onKlineUpdate?;
    private onTradeUpdate?;
    private onConnect?;
    private onDisconnect?;
    private onError?;
    constructor();
    private connect;
    private handleMessage;
    private handleReconnect;
    /**
     * Подписаться на обновления свечей
     */
    subscribeKlines(symbol: string, interval: string): void;
    /**
     * Подписаться на сделки
     */
    subscribeTrades(symbol: string): void;
    setOnKlineUpdate(callback: (data: KlineUpdate) => void): void;
    setOnTradeUpdate(callback: (data: TradeUpdate) => void): void;
    setOnConnect(callback: () => void): void;
    setOnDisconnect(callback: () => void): void;
    setOnError(callback: (error: Error) => void): void;
    /**
     * Закрыть соединение
     */
    close(): void;
    /**
     * Проверить статус подключения
     */
    getConnectionStatus(): boolean;
}
//# sourceMappingURL=mexc-websocket.d.ts.map