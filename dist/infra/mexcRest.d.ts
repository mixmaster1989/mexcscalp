import { Order, OrderType, Side, Instrument, AccountInfo, Fill } from '../core/types';
/**
 * MEXC REST API клиент на основе официального SDK
 */
export declare class MexcRestClient {
    private client;
    constructor(apiKey: string, secretKey: string, baseUrl?: string);
    /**
     * Получить информацию об инструменте
     */
    getExchangeInfo(symbol?: string): Promise<Instrument[]>;
    /**
     * Получить информацию об аккаунте
     */
    getAccountInfo(): Promise<AccountInfo>;
    /**
     * Разместить новый ордер
     */
    placeOrder(symbol: string, side: Side, type: OrderType, quantity: number, price?: number, clientOrderId?: string): Promise<Order>;
    /**
     * Отменить ордер
     */
    cancelOrder(symbol: string, orderId?: string, clientOrderId?: string): Promise<Order>;
    /**
     * Отменить все открытые ордера по символу
     */
    cancelAllOrders(symbol: string): Promise<Order[]>;
    /**
     * Получить статус ордера
     */
    getOrder(symbol: string, orderId?: string, clientOrderId?: string): Promise<Order>;
    /**
     * Получить все открытые ордера
     */
    getOpenOrders(symbol?: string): Promise<Order[]>;
    /**
     * Получить историю сделок
     */
    getMyTrades(symbol: string, limit?: number, fromId?: string): Promise<Fill[]>;
    /**
     * Получить текущую цену символа
     */
    getPrice(symbol: string): Promise<number>;
    /**
     * Получить лучшие цены покупки и продажи
     */
    getBookTicker(symbol: string): Promise<{
        bidPrice: number;
        bidQty: number;
        askPrice: number;
        askQty: number;
    }>;
    /**
     * Проверить соединение с API
     */
    ping(): Promise<boolean>;
    /**
     * Получить время сервера
     */
    getServerTime(): Promise<number>;
}
//# sourceMappingURL=mexcRest.d.ts.map