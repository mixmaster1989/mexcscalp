import TelegramBot from 'node-telegram-bot-api';
/**
 * Команды Telegram бота для работы с историей сделок
 */
export declare class TradeHistoryCommands {
    private bot;
    private tradeHistoryService;
    constructor(bot: TelegramBot, apiKey: string, secretKey: string);
    /**
     * Регистрируем команды
     */
    private registerCommands;
    /**
     * Обработчик команды /trades
     */
    private handleDailyTrades;
    /**
     * Обработчик команды /stats
     */
    private handleDailyStats;
    /**
     * Обработчик команды /top
     */
    private handleTopTrades;
    /**
     * Обработчик команды /worst
     */
    private handleWorstTrades;
}
//# sourceMappingURL=tradeHistoryCommands.d.ts.map