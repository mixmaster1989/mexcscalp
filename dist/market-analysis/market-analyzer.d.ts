import { LocalMinimumSignal, MarketAnalysis } from './strategies/local-minimum-strategy';
export interface AnalyzerConfig {
    symbols: string[];
    intervals: string[];
    updateInterval: number;
    enableWebSocket: boolean;
    enableRest: boolean;
}
export declare class MarketAnalyzer {
    private restClient;
    private wsClient;
    private strategy;
    private config;
    private isRunning;
    private updateTimer;
    private onSignal?;
    private onAnalysis?;
    private onError?;
    constructor(config: AnalyzerConfig);
    /**
     * Запустить анализатор
     */
    start(): Promise<void>;
    /**
     * Остановить анализатор
     */
    stop(): void;
    /**
     * Инициализация WebSocket
     */
    private initializeWebSocket;
    /**
     * Загрузка исторических данных
     */
    private loadHistoricalData;
    /**
     * Запуск периодического обновления
     */
    private startPeriodicUpdate;
    /**
     * Обработка обновления свечей
     */
    private handleKlineUpdate;
    /**
     * Обработка обновления сделок
     */
    private handleTradeUpdate;
    /**
     * Выполнить анализ
     */
    private performAnalysis;
    /**
     * Отобразить статус
     */
    private displayStatus;
    /**
     * Получить анализ рынка для символа
     */
    getMarketAnalysis(symbol: string): MarketAnalysis | null;
    /**
     * Установить обработчик сигналов
     */
    setOnSignal(callback: (signal: LocalMinimumSignal) => void): void;
    /**
     * Установить обработчик анализа
     */
    setOnAnalysis(callback: (analysis: MarketAnalysis) => void): void;
    /**
     * Установить обработчик ошибок
     */
    setOnError(callback: (error: Error) => void): void;
}
//# sourceMappingURL=market-analyzer.d.ts.map