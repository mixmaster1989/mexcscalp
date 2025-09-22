"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramNotifications = void 0;
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
/**
 * Telegram уведомления для торгового бота
 */
class TelegramNotifications {
    bot = null;
    config;
    logger;
    chatId;
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        this.chatId = config.chatId;
        if (config.enabled && config.botToken) {
            try {
                this.bot = new node_telegram_bot_api_1.default(config.botToken, { polling: false });
                this.logger.info('Telegram бот инициализирован');
            }
            catch (error) {
                this.logger.error({ error }, 'Ошибка инициализации Telegram бота');
                this.config.enabled = false;
            }
        }
    }
    /**
     * Отправить уведомление о запуске бота
     */
    async sendStartupMessage(config) {
        if (!this.isEnabled())
            return;
        const message = `
🚀 *MEXC ScalperBot запущен!*

📋 *Конфигурация:*
💰 Депозит: ${config.deposit} USDT
📊 Пары: ${config.targetPairs.join(', ')}
💹 Размер позиции: ${config.positionSizePercent}%
🎯 Цель прибыли: ${config.targetProfitPercent}%
🛡️ Стоп-лосс: ${config.stopLossPercent}%
⏱️ Время сделки: ${config.minTradeTimeMs / 1000}-${config.maxTradeTimeMs / 1000}с

✅ Бот готов к торговле!
    `.trim();
        await this.sendMessage(message);
    }
    /**
     * Уведомление об открытии позиции
     */
    async notifyPositionOpened(position) {
        if (!this.isEnabled())
            return;
        const sideEmoji = position.side === 'buy' ? '🟢' : '🔴';
        const positionValue = position.quantity * position.entryPrice;
        const tpDistance = Math.abs((position.takeProfit - position.entryPrice) / position.entryPrice * 100);
        const slDistance = Math.abs((position.stopLoss - position.entryPrice) / position.entryPrice * 100);
        const message = `
${sideEmoji} *Позиция открыта*

📊 ${position.symbol}
📈 ${position.side.toUpperCase()} ${position.quantity}
💰 Цена: $${position.entryPrice.toFixed(2)}
💵 Сумма: $${positionValue.toFixed(2)}

🎯 TP: $${position.takeProfit.toFixed(2)} (+${tpDistance.toFixed(2)}%)
🛡️ SL: $${position.stopLoss.toFixed(2)} (-${slDistance.toFixed(2)}%)
    `.trim();
        await this.sendMessage(message);
    }
    /**
     * Уведомление о закрытии позиции
     */
    async notifyPositionClosed(trade) {
        if (!this.isEnabled())
            return;
        const isProfit = trade.pnl > 0;
        const emoji = isProfit ? '✅' : '❌';
        const pnlSign = isProfit ? '+' : '';
        const reasonText = this.getReasonText(trade.reason);
        const message = `
${emoji} *Позиция закрыта*

📊 ${trade.symbol}
📈 ${trade.side.toUpperCase()} ${trade.quantity}
💰 Вход: $${trade.entryPrice.toFixed(2)}
💰 Выход: $${trade.exitPrice.toFixed(2)}

💵 PnL: ${pnlSign}$${trade.pnl.toFixed(4)} (${pnlSign}${trade.pnlPercent.toFixed(2)}%)
⏱️ Время: ${this.formatDuration(trade.duration)}
📝 Причина: ${reasonText}
    `.trim();
        await this.sendMessage(message);
    }
    /**
     * Уведомление об ошибке
     */
    async notifyError(error) {
        if (!this.isEnabled())
            return;
        const emoji = error.critical ? '🚨' : '⚠️';
        const priority = error.critical ? 'КРИТИЧЕСКАЯ' : 'Предупреждение';
        const message = `
${emoji} *${priority} ошибка*

🔧 Тип: ${error.type}
📊 Пара: ${error.symbol || 'N/A'}
📝 Описание: ${error.message}
    `.trim();
        await this.sendMessage(message);
    }
    /**
     * Периодический отчет
     */
    async sendPeriodicReport(stats) {
        if (!this.isEnabled())
            return;
        const uptimeFormatted = this.formatDuration(stats.uptime);
        const pnlEmoji = stats.dailyPnL >= 0 ? '📈' : '📉';
        const pnlSign = stats.dailyPnL >= 0 ? '+' : '';
        const message = `
📊 *Отчет ScalperBot*

⏱️ Время работы: ${uptimeFormatted}
📍 Активных позиций: ${stats.positionsCount}
${pnlEmoji} Дневной PnL: ${pnlSign}$${stats.dailyPnL.toFixed(2)}
📈 Всего сделок: ${stats.totalTrades}
🎯 Винрейт: ${stats.winRate.toFixed(1)}%
💰 Profit Factor: ${stats.profitFactor.toFixed(2)}
    `.trim();
        await this.sendMessage(message);
    }
    /**
     * Уведомление об остановке
     */
    async sendShutdownMessage(reason = 'Пользователь') {
        if (!this.isEnabled())
            return;
        const message = `
🛑 *ScalperBot остановлен*

📝 Причина: ${reason}
⏰ Время: ${new Date().toLocaleString('ru-RU')}

💤 Бот завершил работу
    `.trim();
        await this.sendMessage(message);
    }
    /**
     * Проверить статус Telegram
     */
    async checkStatus() {
        if (!this.isEnabled())
            return false;
        try {
            await this.bot.getMe();
            return true;
        }
        catch (error) {
            this.logger.warn({ error }, 'Ошибка проверки Telegram статуса');
            return false;
        }
    }
    isEnabled() {
        return this.config.enabled && this.bot !== null;
    }
    async sendMessage(text) {
        if (!this.isEnabled())
            return;
        try {
            await this.bot.sendMessage(this.chatId, text, {
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            });
        }
        catch (error) {
            this.logger.error({ error, text }, 'Ошибка отправки Telegram сообщения');
        }
    }
    getReasonText(reason) {
        const reasons = {
            'take_profit': '🎯 Take Profit',
            'stop_loss': '🛡️ Stop Loss',
            'timeout': '⏰ Тайм-аут',
            'emergency': '🚨 Аварийное закрытие'
        };
        return reasons[reason] || reason;
    }
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        if (hours > 0) {
            return `${hours}ч ${minutes % 60}м`;
        }
        else if (minutes > 0) {
            return `${minutes}м ${seconds % 60}с`;
        }
        else {
            return `${seconds}с`;
        }
    }
}
exports.TelegramNotifications = TelegramNotifications;
//# sourceMappingURL=notifications.js.map