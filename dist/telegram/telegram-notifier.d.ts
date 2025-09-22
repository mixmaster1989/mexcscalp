export declare class TelegramNotifier {
    private bot;
    private chatIds;
    constructor(botToken: string, chatIds: string);
    /**
     * Отправить уведомление о запуске системы
     */
    sendSystemStarted(): Promise<void>;
    /**
     * Отправить анализ сделки
     */
    sendTradeAnalysis(symbol: string, action: string, price: number, confidence: number, reasoning: string, patterns: string[], marketConditions: string[], recommendation: string): Promise<void>;
    /**
     * Отправить отчет о рынке
     */
    sendMarketReport(totalTrades: number, winRate: number, profitFactor: number, bestPattern: string, currentTrend: string, recommendations: string[]): Promise<void>;
    /**
     * Отправить LLM комментарий
     */
    sendLLMCommentary(title: string, marketOverview: string, tradingOpportunities: string[], riskAssessment: string, recommendations: string[]): Promise<void>;
    /**
     * Отправить ошибку
     */
    sendError(title: string, message: string): Promise<void>;
    /**
     * Отправить тестовое сообщение
     */
    sendTestMessage(): Promise<void>;
    /**
     * Отправить сообщение во все чаты
     */
    private sendToAllChats;
}
//# sourceMappingURL=telegram-notifier.d.ts.map