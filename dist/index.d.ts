/**
 * Главный класс торговой системы MEXC Scalp Bot
 */
declare class MexcScalpBot {
    private logger;
    private config;
    private restClient;
    private wsClient;
    private regimeDetector;
    private hedgehogStrategy;
    private telegramBot;
    private instrument;
    private isRunning;
    private shutdownInProgress;
    constructor();
    /**
     * Загрузить и валидировать конфигурацию
     */
    private loadConfig;
    /**
     * Инициализировать API клиенты
     */
    private initClients;
    /**
     * Получить метаданные инструмента
     */
    private loadInstrumentInfo;
    /**
     * Инициализировать торговые компоненты
     */
    private initTradingComponents;
    /**
     * Инициализировать Telegram бота
     */
    private initTelegramBot;
    /**
     * Получить торговую статистику для Telegram бота
     */
    private getTradingStats;
    /**
     * Получить статус системы для Telegram бота
     */
    private getSystemStatus;
    Обработать(): any;
    торговую: any;
    команду: any;
    из: any;
    Telegram: any;
    (): any;
}
export { MexcScalpBot };
//# sourceMappingURL=index.d.ts.map