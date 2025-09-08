import { EventEmitter } from 'events';
import pino from 'pino';
import { TradingStats, SystemStatus } from './types';
import { Fill, MarketRegime } from '../core/types';
/**
 * Простой Telegram бот без авторизации - просто шлет уведомления в группу
 * Теперь с шутками для Васечка и командным стилем "мы"
 */
export declare class MexcTelegramBot extends EventEmitter {
    private bot;
    private logger;
    private groupChatId;
    private getTradingStats;
    private getSystemStatus;
    private onTradingCommand;
    private isRunning;
    private startTime;
    private messageCount;
    private jokeCount;
    constructor(token: string, groupChatId: number, getTradingStats: () => TradingStats, getSystemStatus: () => SystemStatus, onTradingCommand: (command: string, chatId: number) => Promise<string>, logger: pino.Logger);
    /**
     * Запустить бота
     */
    start(): Promise<void>;
    /**
     * Остановить бота
     */
    stop(): Promise<void>;
    /**
     * Настроить обработчики событий
     */
    private setupEventHandlers;
    /**
     * Обработать сообщение
     */
    private handleMessage;
    /**
     * Обработать команду статуса
     */
    private handleStatusCommand;
    /**
     * Обработать команду статистики
     */
    private handleStatsCommand;
    /**
     * Отправить сообщение в группу
     */
    sendMessage(message: string): Promise<void>;
    /**
     * Уведомление о сделке
     */
    notifyTrade(fill: Fill): Promise<void>;
    /**
     * Уведомление об изменении режима
     */
    notifyRegimeChange(previous: MarketRegime, current: MarketRegime, confidence: number): Promise<void>;
    /**
     * Уведомление об ошибке
     */
    notifyError(error: Error, context: string): Promise<void>;
    /**
     * Критическое уведомление
     */
    notifyCritical(title: string, text: string): Promise<void>;
    /**
     * Системное уведомление
     */
    notifySystem(title: string, text: string): Promise<void>;
    /**
     * Получить иконку статуса
     */
    private getStatusIcon;
    /**
     * Форматировать время работы
     */
    private formatUptime;
    /**
     * Форматировать время
     */
    private formatTime;
    /**
     * Проверить, запущен ли бот
     */
    isBotRunning(): boolean;
}
//# sourceMappingURL=bot.d.ts.map