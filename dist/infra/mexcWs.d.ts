import { EventEmitter } from 'events';
import { Orderbook, Trade, Tick } from '../core/types';
/**
 * События WebSocket клиента
 */
export interface MexcWsEvents {
    'connected': () => void;
    'disconnected': () => void;
    'error': (error: Error) => void;
    'tick': (tick: Tick) => void;
    'trade': (trade: Trade) => void;
    'orderbook': (orderbook: Orderbook) => void;
    'bookTicker': (data: {
        symbol: string;
        bidPrice: number;
        bidQty: number;
        askPrice: number;
        askQty: number;
    }) => void;
}
/**
 * MEXC WebSocket клиент
 */
export declare class MexcWebSocketClient extends EventEmitter {
    private ws;
    private wsUrl;
    private subscriptions;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private reconnectDelay;
    private heartbeatInterval;
    private heartbeatIntervalMs;
    private isConnecting;
    private shouldReconnect;
    constructor(wsUrl?: string, maxReconnectAttempts?: number, reconnectDelay?: number, heartbeatIntervalMs?: number);
    /**
     * Подключиться к WebSocket
     */
    connect(): Promise<void>;
    /**
     * Отключиться от WebSocket
     */
    disconnect(): void;
    /**
     * Переподключиться
     */
    private reconnect;
    /**
     * Запустить heartbeat
     */
    private startHeartbeat;
    /**
     * Остановить heartbeat
     */
    private stopHeartbeat;
    /**
     * Переподписаться на все потоки после переподключения
     */
    private resubscribe;
    /**
     * Отправить сообщение в WebSocket
     */
    private sendMessage;
    /**
     * Обработать входящее сообщение
     */
    private handleMessage;
    /**
     * Обработать данные тикера
     */
    private handleTickerData;
    /**
     * Обработать данные сделок
     */
    private handleTradeData;
    /**
     * Обработать данные стакана
     */
    private handleDepthData;
    /**
     * Обработать данные лучших цен
     */
    private handleBookTickerData;
    /**
     * Подписаться на тикер символа
     */
    subscribeTicker(symbol: string): void;
    /**
     * Подписаться на сделки символа
     */
    subscribeTrades(symbol: string): void;
    /**
     * Подписаться на стакан символа
     */
    subscribeOrderbook(symbol: string, levels?: number): void;
    /**
     * Подписаться на лучшие цены символа
     */
    subscribeBookTicker(symbol: string): void;
    /**
     * Отписаться от потока
     */
    unsubscribe(symbol: string, streamType: string): void;
    /**
     * Получить статус подключения
     */
    isConnected(): boolean;
    /**
     * Получить количество активных подписок
     */
    getSubscriptionCount(): number;
}
//# sourceMappingURL=mexcWs.d.ts.map