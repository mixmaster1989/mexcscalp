import pino from 'pino';
export interface NotificationConfig {
    botToken: string;
    chatId: string;
    enabled: boolean;
}
export interface TradeNotification {
    type: 'position_opened' | 'position_closed' | 'error' | 'status';
    symbol: string;
    side?: 'buy' | 'sell';
    price?: number;
    quantity?: number;
    pnl?: number;
    reason?: string;
    message: string;
}
/**
 * Telegram уведомления для торгового бота
 */
export declare class TelegramNotifications {
    private bot;
    private config;
    private logger;
    private chatId;
    constructor(config: NotificationConfig, logger: pino.Logger);
    /**
     * Отправить уведомление о запуске бота
     */
    sendStartupMessage(config: any): Promise<void>;
    /**
     * Уведомление об открытии позиции
     */
    notifyPositionOpened(position: {
        id: string;
        symbol: string;
        side: 'buy' | 'sell';
        entryPrice: number;
        quantity: number;
        takeProfit: number;
        stopLoss: number;
    }): Promise<void>;
    /**
     * Уведомление о закрытии позиции
     */
    notifyPositionClosed(trade: {
        symbol: string;
        side: 'buy' | 'sell';
        entryPrice: number;
        exitPrice: number;
        quantity: number;
        pnl: number;
        pnlPercent: number;
        duration: number;
        reason: string;
    }): Promise<void>;
    /**
     * Уведомление об ошибке
     */
    notifyError(error: {
        type: string;
        message: string;
        symbol?: string;
        critical?: boolean;
    }): Promise<void>;
    /**
     * Периодический отчет
     */
    sendPeriodicReport(stats: {
        uptime: number;
        positionsCount: number;
        dailyPnL: number;
        totalTrades: number;
        winRate: number;
        profitFactor: number;
    }): Promise<void>;
    /**
     * Уведомление об остановке
     */
    sendShutdownMessage(reason?: string): Promise<void>;
    /**
     * Проверить статус Telegram
     */
    checkStatus(): Promise<boolean>;
    private isEnabled;
    private sendMessage;
    private getReasonText;
    private formatDuration;
}
//# sourceMappingURL=notifications.d.ts.map