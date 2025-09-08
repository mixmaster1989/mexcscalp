import TelegramBot from 'node-telegram-bot-api';
import { TelegramAuth } from './auth';
import { TelegramNotification } from './types';
import { Fill, MarketRegime } from '../core/types';
/**
 * Система уведомлений Telegram бота
 */
export declare class TelegramNotifications {
    private bot;
    private auth;
    private isEnabled;
    private messageQueue;
    private sendingInProgress;
    constructor(bot: TelegramBot, auth: TelegramAuth);
    /**
     * Отправить уведомление
     */
    sendNotification(notification: TelegramNotification): Promise<void>;
    /**
     * Уведомление о сделке
     */
    notifyTrade(fill: Fill): Promise<void>;
    /**
     * Уведомление об изменении режима рынка
     */
    notifyRegimeChange(previous: MarketRegime, current: MarketRegime, confidence: number): Promise<void>;
    /**
     * Уведомление об ошибке
     */
    notifyError(error: Error, context: string): Promise<void>;
    /**
     * Критическое уведомление (kill-switch, emergency stop)
     */
    notifyCritical(title: string, message: string, data?: any): Promise<void>;
    /**
     * Системное уведомление (запуск, остановка)
     */
    notifySystem(title: string, message: string, data?: any): Promise<void>;
    /**
     * Уведомление о прибыли/убытке
     */
    notifyPnL(pnl: number, totalTrades: number, winRate: number): Promise<void>;
    /**
     * Уведомление о достижении лимитов
     */
    notifyLimitReached(limitType: string, currentValue: number, maxValue: number): Promise<void>;
    /**
     * Форматировать уведомление
     */
    private formatNotification;
    /**
     * Получить опции сообщения
     */
    private getMessageOptions;
    /**
     * Получить описание режима рынка
     */
    private getRegimeDescription;
    /**
     * Запустить обработчик очереди сообщений
     */
    private startMessageProcessor;
    /**
     * Форматировать время
     */
    private formatTime;
    /**
     * Включить/выключить уведомления
     */
    setEnabled(enabled: boolean): void;
    /**
     * Получить статус уведомлений
     */
    isNotificationsEnabled(): boolean;
    /**
     * Получить размер очереди сообщений
     */
    getQueueSize(): number;
    /**
     * Очистить очередь сообщений
     */
    clearQueue(): void;
    /**
     * Отправить тестовое уведомление
     */
    sendTestNotification(chatId: number): Promise<void>;
}
//# sourceMappingURL=notifications.d.ts.map