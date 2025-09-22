import 'dotenv/config';
import { TradingConfig } from '../config/trading';
export interface BotStatus {
    isRunning: boolean;
    uptime: number;
    version: string;
    lastUpdate: number;
    apiConnected: boolean;
    wsConnected: boolean;
    positionsCount: number;
    dailyPnL: number;
    totalTrades: number;
    winRate: number;
    errorCount: number;
    lastError?: string;
}
export interface BotStats {
    status: BotStatus;
    strategy: any;
    risk: any;
    positions: any;
    performance: any;
}
/**
 * Главный класс торгового бота-скальпера
 */
export declare class ScalperBot {
    private config;
    private mexcRest;
    private mexcWs;
    private strategy;
    private riskManager;
    private positionManager;
    private statsLogger;
    private logger;
    private telegram;
    private isRunning;
    private startTime;
    private errorCount;
    private lastError?;
    private healthCheckInterval?;
    constructor(customConfig?: Partial<TradingConfig>);
    /**
     * Запустить бота
     */
    start(): Promise<void>;
    /**
     * Остановить бота
     */
    stop(): Promise<void>;
    /**
     * Получить статистику бота
     */
    getStats(): BotStats;
    /**
     * Получить краткий отчет
     */
    getQuickReport(): string;
    /**
     * Экстренная остановка
     */
    emergencyStop(reason: string): Promise<void>;
    /**
     * Перезапустить бота
     */
    restart(): Promise<void>;
    /**
     * Проверить соединение с API
     */
    private validateApiConnection;
    /**
     * Настроить логгер
     */
    private setupLogger;
    /**
     * Настроить обработчики событий
     */
    private setupEventHandlers;
    /**
     * Запустить мониторинг здоровья бота
     */
    private startHealthCheck;
    /**
     * Выполнить проверку здоровья
     */
    private performHealthCheck;
    /**
     * Получить конфигурацию
     */
    getConfig(): TradingConfig;
    /**
     * Обновить конфигурацию (только некоторые параметры)
     */
    updateConfig(updates: Partial<TradingConfig>): boolean;
}
//# sourceMappingURL=scalper-bot.d.ts.map