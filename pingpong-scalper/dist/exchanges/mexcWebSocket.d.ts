import { EventEmitter } from 'events';
export declare class MexcWebSocketClient extends EventEmitter {
    private symbol;
    private ws;
    private reconnectInterval;
    private pingInterval;
    private isConnected;
    private reconnectAttempts;
    private maxReconnectAttempts;
    constructor(symbol: string);
    connect(): void;
    private subscribeToChannels;
    private handleMessage;
    private parseBookTicker;
    private parseDeals;
    private startPing;
    private scheduleReconnect;
    disconnect(): void;
    isConnectedToWebSocket(): boolean;
}
//# sourceMappingURL=mexcWebSocket.d.ts.map