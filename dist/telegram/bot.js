"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MexcTelegramBot = void 0;
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const events_1 = require("events");
/**
 * Простой Telegram бот без авторизации - просто шлет уведомления в группу
 * Теперь с шутками для Васечка и командным стилем "мы"
 */
class MexcTelegramBot extends events_1.EventEmitter {
    bot;
    logger;
    groupChatId;
    getTradingStats;
    getSystemStatus;
    onTradingCommand;
    isRunning = false;
    startTime = Date.now();
    messageCount = 0;
    jokeCount = 0;
    constructor(token, groupChatId, getTradingStats, getSystemStatus, onTradingCommand, logger) {
        super();
        this.logger = logger;
        this.bot = new node_telegram_bot_api_1.default(token, { polling: true });
        this.groupChatId = groupChatId;
        this.getTradingStats = getTradingStats;
        this.getSystemStatus = getSystemStatus;
        this.onTradingCommand = onTradingCommand;
        this.setupEventHandlers();
    }
    /**
     * Запустить бота
     */
    async start() {
        try {
            this.isRunning = true;
            this.startTime = Date.now();
            this.logger.info('🤖 Мы запустили Telegram бота');
            // Уведомляем в группу о запуске (без дополнительных вставок)
            await this.sendMessage('🚀 *Мы запустили MEXC Scalp Bot*\n\nСистема готова к торговле!');
        }
        catch (error) {
            this.logger.error('Ошибка запуска Telegram бота:', error);
            throw error;
        }
    }
    /**
     * Остановить бота
     */
    async stop() {
        try {
            this.isRunning = false;
            await this.sendMessage('⏹️ *Мы остановили MEXC Scalp Bot*\n\nСистема остановлена для обслуживания.');
            await this.bot.stopPolling();
            this.logger.info('🤖 Мы остановили Telegram бота');
        }
        catch (error) {
            this.logger.error('Ошибка остановки Telegram бота:', error);
        }
    }
    /**
     * Настроить обработчики событий
     */
    setupEventHandlers() {
        this.bot.on('message', async (msg) => {
            try {
                await this.handleMessage(msg);
            }
            catch (error) {
                this.logger.error('Ошибка обработки сообщения:', error);
            }
        });
        this.bot.on('error', (error) => {
            this.logger.warn('Telegram error (suppressed):', error.message);
        });
        // Polling отключен, обработчик не нужен
        // this.bot.on('polling_error', (error) => {});
    }
    /**
     * Обработать сообщение
     */
    async handleMessage(msg) {
        if (!msg.text)
            return;
        const chatId = msg.chat.id;
        const text = msg.text.toLowerCase();
        try {
            if (text === '/start') {
                await this.bot.sendMessage(chatId, '👋 Привет! Мы - команда MEXC Scalp Bot!\n\nМы торгуем ETH/USDC автоматически.');
            }
            else if (text === '/status') {
                await this.handleStatusCommand(chatId);
            }
            else if (text === '/stats') {
                await this.handleStatsCommand(chatId);
            }
            else if (text.startsWith('/')) {
                const command = text.substring(1);
                const response = await this.onTradingCommand(command, chatId);
                await this.bot.sendMessage(chatId, response);
            }
        }
        catch (error) {
            await this.bot.sendMessage(chatId, `❌ Ошибка: ${error}`);
        }
    }
    /**
     * Обработать команду статуса
     */
    async handleStatusCommand(chatId) {
        const status = this.getSystemStatus();
        const message = `
🤖 *Статус нашей системы*

*Система:* ${this.getStatusIcon(status.systemStatus)} \`${status.systemStatus}\`
*Торговля:* ${this.getStatusIcon(status.tradingEnabled ? 'active' : 'stopped')} \`${status.tradingEnabled ? 'ВКЛЮЧЕНА' : 'ОТКЛЮЧЕНА'}\`
*Баланс:* \$${status.totalBalance.toFixed(2)}
*Время работы:* ${this.formatUptime(Date.now() - this.startTime)}

*Время:* ${this.formatTime(Date.now())}
    `;
        await this.bot.sendMessage(chatId, message);
    }
    /**
     * Обработать команду статистики
     */
    async handleStatsCommand(chatId) {
        const stats = this.getTradingStats();
        const message = `
📊 *Наша торговая статистика*

*Всего сделок:* \`${stats.totalTrades}\`
*Прибыльных:* \`${stats.profitableTrades}\`
*Убыточных:* \`${stats.losingTrades}\`
*Win Rate:* \`${stats.winRate.toFixed(1)}%\`
*Общая P&L:* \$${stats.totalPnL.toFixed(2)}
*P&L сегодня:* \$${stats.dailyPnL.toFixed(2)}
*Макс. просадка:* \$${stats.maxDrawdown.toFixed(2)}

*Время:* ${this.formatTime(Date.now())}
    `;
        await this.bot.sendMessage(chatId, message);
    }
    /**
     * Отправить сообщение в группу
     */
    async sendMessage(message) {
        try {
            this.messageCount++;
            this.logger.info('📤 Отправляем сообщение в Telegram:', {
                chatId: this.groupChatId,
                messageLength: message.length,
                messageCount: this.messageCount
            });
            await this.bot.sendMessage(this.groupChatId, message, { parse_mode: 'Markdown' });
            this.logger.info('✅ Сообщение успешно отправлено в Telegram');
        }
        catch (error) {
            // Детальная отладка ошибки отправки
            this.logger.error('🔴 ОШИБКА ОТПРАВКИ СООБЩЕНИЯ:', {
                message: error.message,
                code: error.code,
                stack: error.stack,
                name: error.name,
                chatId: this.groupChatId,
                fullError: JSON.stringify(error, null, 2)
            });
            // Проверяем тип ошибки
            if (error.message && error.message.includes('AggregateError')) {
                this.logger.error('🚨 ОБНАРУЖЕН AGGREGATE ERROR ПРИ ОТПРАВКЕ!');
            }
            // Проверяем код ошибки
            if (error.code === 'EFATAL') {
                this.logger.error('💀 КРИТИЧЕСКАЯ ОШИБКА EFATAL ПРИ ОТПРАВКЕ!');
            }
            this.logger.error('Ошибка отправки сообщения:', error);
        }
    }
    /**
     * Уведомление о сделке
     */
    async notifyTrade(fill) {
        this.jokeCount++;
        const sideIcon = fill.side === 'buy' ? '🟢' : '🔴';
        const message = `
${sideIcon} *Мы совершили сделку ${fill.side.toUpperCase()}*

*Цена:* \`$${fill.price.toFixed(4)}\`
*Количество:* \`${fill.quantity.toFixed(6)} ETH\`
*Сумма:* \`$${(fill.price * fill.quantity).toFixed(2)}\`
*Время:* ${this.formatTime(fill.timestamp)}
    `;
        await this.sendMessage(message);
    }
    /**
     * Уведомление об изменении режима
     */
    async notifyRegimeChange(previous, current, confidence) {
        const regimeIcons = { quiet: '🌙', normal: '☀️', shock: '⚡' };
        const message = `
${regimeIcons[current]} *Мы изменили режим рынка*

*Предыдущий:* \`${previous}\` ${regimeIcons[previous]}
*Новый:* \`${current}\` ${regimeIcons[current]}
*Уверенность:* \`${(confidence * 100).toFixed(1)}%\`
*Время:* ${this.formatTime(Date.now())}
    `;
        await this.sendMessage(message);
    }
    /**
     * Уведомление об ошибке
     */
    async notifyError(error, context) {
        const message = `
❌ *У нас системная ошибка*

*Контекст:* \`${context}\`
*Ошибка:* \`${error.message}\`
*Время:* ${this.formatTime(Date.now())}
    `;
        await this.sendMessage(message);
    }
    /**
     * Критическое уведомление
     */
    async notifyCritical(title, text) {
        const message = `
🚨 *${title}*

${text}

*Время:* ${this.formatTime(Date.now())}
    `;
        await this.sendMessage(message);
    }
    /**
     * Системное уведомление
     */
    async notifySystem(title, text) {
        const message = `
🤖 *${title}*

${text}

*Время:* ${this.formatTime(Date.now())}
    `;
        await this.sendMessage(message);
    }
    /**
     * Получить иконку статуса
     */
    getStatusIcon(status) {
        switch (status) {
            case 'running':
            case 'active':
                return '✅';
            case 'stopped':
            case 'paused':
                return '⏸';
            case 'error':
                return '❌';
            default:
                return '⚪';
        }
    }
    /**
     * Форматировать время работы
     */
    formatUptime(uptimeMs) {
        const seconds = Math.floor(uptimeMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (days > 0) {
            return `${days}д ${hours % 24}ч`;
        }
        else if (hours > 0) {
            return `${hours}ч ${minutes % 60}м`;
        }
        else {
            return `${minutes}м`;
        }
    }
    /**
     * Форматировать время
     */
    formatTime(timestamp) {
        return new Date(timestamp).toLocaleString('ru-RU', {
            timeZone: 'Europe/Moscow',
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    /**
     * Проверить, запущен ли бот
     */
    isBotRunning() {
        return this.isRunning;
    }
}
exports.MexcTelegramBot = MexcTelegramBot;
//# sourceMappingURL=bot.js.map