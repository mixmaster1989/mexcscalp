import { MexcRestClient } from '../infra/mexcRest';
import { Order, Instrument } from './types';
/**
 * Интерфейс для конфигурации OrderManager
 */
interface OrderManagerConfig {
    ttl_order_sec: number;
    refresh_sec: number;
    delta_ticks_for_replace: number;
    recentering_trigger: number;
    no_fill_watchdog_min: number;
    min_spread_ticks: number;
    staleness_ms: number;
    cancel_rate_per_min: number;
}
/**
 * Менеджер ордеров с TTL, репрайсом и перецентровкой
 */
export declare class OrderManager {
    private config;
    private restClient;
    private instrument;
    private quoteLevels;
    private lastCenter;
    private lastFillTime;
    private cancelTokens;
    private lastCancelReset;
    private offset;
    private step;
    private maxLevels;
    constructor(config: OrderManagerConfig, restClient: MexcRestClient, instrument: Instrument);
    /**
     * Установить параметры стратегии
     */
    setStrategyParams(offset: number, step: number, maxLevels: number): void;
    /**
     * Обновить центр цены
     */
    updateCenter(midPrice: number): void;
    /**
     * Зарегистрировать исполнение ордера
     */
    onFill(): void;
    /**
     * Основной цикл управления ордерами
     */
    manageOrders(currentOrders: Order[], midPrice: number, bestBid: number, bestAsk: number, spread: number): Promise<void>;
    /**
     * Проверить TTL и репрайс ордеров
     */
    private checkTTLAndReprice;
    /**
     * Перевыставить ордер по новой цене
     */
    private repriceOrder;
    /**
     * Вычислить новую цену для ордера
     */
    private calculateNewPrice;
    /**
     * Проверить необходимость перецентровки
     */
    private checkRecentering;
    /**
     * Перецентровать уровни вокруг нового центра
     */
    private recenterLevels;
    /**
     * Проверить watchdog на отсутствие сделок
     */
    private checkNoFillWatchdog;
    /**
     * Корректировка при отсутствии сделок
     */
    private adjustForNoFills;
    /**
     * Обновить верхний уровень
     */
    private updateTopLevel;
    /**
     * Проверить фильтры
     */
    private passesFilters;
    /**
     * Отменить ордер с rate limiting
     */
    private cancelOrder;
    /**
     * Получить статистику
     */
    getStats(): any;
}
export {};
//# sourceMappingURL=orderManager.d.ts.map