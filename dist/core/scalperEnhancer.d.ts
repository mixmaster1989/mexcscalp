import { MexcRestClient } from '../infra/mexcRest';
import { Instrument } from './types';
/**
 * Конфигурация для улучшенного скальпера
 */
export interface ScalperEnhancerConfig {
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
 * Улучшенный скальпер с сервисной логикой
 */
export declare class ScalperEnhancer {
    private orderManager;
    private marketDataManager;
    private restClient;
    private instrument;
    private config;
    private isActive;
    private lastFillTime;
    private lastStatusUpdate;
    constructor(config: ScalperEnhancerConfig, restClient: MexcRestClient, instrument: Instrument);
    /**
     * Запустить улучшенный скальпер
     */
    start(): Promise<void>;
    /**
     * Остановить улучшенный скальпер
     */
    stop(): Promise<void>;
    /**
     * Проверить фильтры (дополнение к основной логике)
     */
    checkFilters(currentOrders: any[], currentPrice: number): Promise<boolean>;
    /**
     * Основной цикл управления ордерами (оставляем для совместимости)
     */
    manageOrders(currentOrders: any[]): Promise<void>;
    /**
     * Зарегистрировать исполнение ордера
     */
    onFill(): void;
    /**
     * Проверить фильтры
     */
    private passesFilters;
    /**
     * Обновить статус
     */
    private updateStatus;
    /**
     * Получить статистику
     */
    getStats(): any;
    /**
     * Получить конфигурацию
     */
    getConfig(): ScalperEnhancerConfig;
}
/**
 * Фабрика для создания конфигурации по умолчанию
 */
export declare function createDefaultConfig(): ScalperEnhancerConfig;
//# sourceMappingURL=scalperEnhancer.d.ts.map