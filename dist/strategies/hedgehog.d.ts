import { EventEmitter } from 'events';
import { Side, Config, Instrument, MarketRegime, Fill } from '../core/types';
import { MexcRestClient } from '../infra/mexcRest';
/**
 * Интерфейс для уровня котировок
 */
interface QuoteLevel {
    level: number;
    side: Side;
    price: number;
    quantity: number;
    orderId?: string;
    clientOrderId: string;
    isActive: boolean;
    timestamp: number;
}
/**
 * Интерфейс для Take Profit ордера
 */
interface TakeProfitOrder {
    id: string;
    clientOrderId: string;
    fillId: string;
    side: Side;
    price: number;
    quantity: number;
    entryPrice: number;
    isActive: boolean;
    timestamp: number;
}
/**
 * Стратегия "Ёршики" - двусторонние лимитные ордера
 * Выставляет симметричные уровни покупки и продажи вокруг средней цены
 */
export declare class HedgehogStrategy extends EventEmitter {
    private config;
    private instrument;
    private restClient;
    private isActive;
    private quoteLevels;
    private takeProfitOrders;
    private midPrice;
    private currentInventory;
    private inventoryNotional;
    private atr1m;
    private currentRegime;
    private regimeParams;
    constructor(config: Config, instrument: Instrument, restClient: MexcRestClient);
    /**
     * Запустить стратегию
     */
    start(): Promise<void>;
    /**
     * Остановить стратегию
     */
    stop(): Promise<void>;
    /**
     * Обновить рыночные данные
     */
    updateMarketData(midPrice: number, atr1m: number): void;
    /**
     * Обновить параметры режима
     */
    updateRegimeParameters(regime: MarketRegime, params: any): void;
    /**
     * Обработать исполнение ордера
     */
    onFill(fill: Fill): Promise<void>;
    /**
     * Обновить котировки
     */
    private updateQuotes;
    /**
     * Вычислить количество для уровня
     */
    private calculateLevelQuantity;
    /**
     * Обновить ордера
     */
    private updateOrders;
    /**
     * Разместить ордер
     */
    private placeOrder;
    /**
     * Отменить ордера
     */
    private cancelOrders;
    /**
     * Отменить все ордера
     */
    private cancelAllOrders;
    /**
     * Создать Take Profit ордер
     */
    private createTakeProfitOrder;
    /**
     * Восстановить уровень после исполнения
     */
    private replenishLevel;
    /**
     * Проверить фильтры
     */
    private passesFilters;
    /**
     * Приостановить котирование
     */
    private pauseQuoting;
    /**
     * Найти уровень по ID ордера
     */
    private findLevelByOrderId;
    /**
     * Генерировать clientOrderId
     */
    private generateClientOrderId;
    /**
     * Получить статистику стратегии
     */
    getStats(): {
        isActive: boolean;
        activeLevels: number;
        activeTakeProfits: number;
        currentInventory: number;
        inventoryNotional: number;
        currentRegime: MarketRegime;
        midPrice: number;
        atr1m: number;
    };
    /**
     * Получить активные уровни
     */
    getActiveLevels(): QuoteLevel[];
    /**
     * Получить активные Take Profit ордера
     */
    getActiveTakeProfits(): TakeProfitOrder[];
}
export {};
//# sourceMappingURL=hedgehog.d.ts.map