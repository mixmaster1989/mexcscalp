import TelegramBot from 'node-telegram-bot-api';
import { TelegramAuth } from './auth';
import { TradingStats, SystemStatus } from './types';
/**
 * Обработчики команд Telegram бота
 */
export declare class TelegramCommands {
    private auth;
    private getTradingStats;
    private getSystemStatus;
    private onTradingCommand;
    constructor(auth: TelegramAuth, getTradingStats: () => TradingStats, getSystemStatus: () => SystemStatus, onTradingCommand: (command: string, chatId: number) => Promise<string>);
    /**
     * Обработать команду /start
     */
    handleStart(bot: TelegramBot, chatId: number, username?: string, firstName?: string, lastName?: string): Promise<void>;
    /**
     * Обработать команду /auth
     */
    handleAuth(bot: TelegramBot, chatId: number, key: string, username?: string, firstName?: string, lastName?: string): Promise<void>;
    /**
     * Обработать команду /status
     */
    handleStatus(bot: TelegramBot, chatId: number): Promise<void>;
    /**
     * Обработать команду /stats
     */
    handleStats(bot: TelegramBot, chatId: number): Promise<void>;
    /**
     * Обработать команды торговли (только для админов)
     */
    handleTradingCommand(bot: TelegramBot, chatId: number, command: string): Promise<void>;
    /**
     * Обработать команду /help
     */
    handleHelp(bot: TelegramBot, chatId: number): Promise<void>;
    /**
     * Получить главную клавиатуру
     */
    private getMainKeyboard;
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
}
//# sourceMappingURL=commands.d.ts.map