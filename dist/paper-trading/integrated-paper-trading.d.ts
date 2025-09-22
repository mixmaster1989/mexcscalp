import 'dotenv/config';
import { PaperTrade } from './paper-trading';
export interface SystemConfig {
    symbols: string[];
    intervals: string[];
    updateInterval: number;
    enableWebSocket: boolean;
    enableRest: boolean;
    positionSize: number;
    maxOpenTrades: number;
    tradeTimeout: number;
    analysisInterval: number;
}
export declare class IntegratedPaperTradingSystem {
    private analyzer;
    private paperTrading;
    private config;
    private isRunning;
    private analysisTimer;
    private lastAnalysisTime;
    constructor(config: SystemConfig);
    /**
     * Запустить интегрированную систему
     */
    start(): Promise<void>;
    /**
     * Остановить систему
     */
    stop(): void;
    /**
     * Настроить обработчики анализатора
     */
    private setupAnalyzerHandlers;
    /**
     * Обработать анализ рынка
     */
    private handleMarketAnalysis;
    /**
     * Запустить периодический анализ
     */
    private startPeriodicAnalysis;
    /**
     * Выполнить анализ результатов
     */
    private performAnalysis;
    /**
     * Отобразить отчет анализа
     */
    private displayAnalysisReport;
    /**
     * Получить текущую статистику
     */
    getCurrentStats(): import("./paper-trading").TradingStats;
    /**
     * Получить открытые сделки
     */
    getOpenTrades(): PaperTrade[];
    /**
     * Получить баланс
     */
    getBalance(): number;
}
//# sourceMappingURL=integrated-paper-trading.d.ts.map