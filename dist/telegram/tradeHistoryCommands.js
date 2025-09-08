"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeHistoryCommands = void 0;
const tradeHistory_1 = require("../metrics/tradeHistory");
/**
 * Команды Telegram бота для работы с историей сделок
 */
class TradeHistoryCommands {
    bot;
    tradeHistoryService;
    constructor(bot, apiKey, secretKey) {
        this.bot = bot;
        this.tradeHistoryService = new tradeHistory_1.TradeHistoryService(apiKey, secretKey);
        this.registerCommands();
    }
    /**
     * Регистрируем команды
     */
    registerCommands() {
        // Команда /trades - история сделок за сутки
        this.bot.onText(/\/trades/, this.handleDailyTrades.bind(this));
        // Команда /stats - статистика за сутки
        this.bot.onText(/\/stats/, this.handleDailyStats.bind(this));
        // Команда /top - лучшие сделки
        this.bot.onText(/\/top/, this.handleTopTrades.bind(this));
        // Команда /worst - худшие сделки
        this.bot.onText(/\/worst/, this.handleWorstTrades.bind(this));
    }
    /**
     * Обработчик команды /trades
     */
    async handleDailyTrades(msg) {
        const chatId = msg.chat.id;
        try {
            await this.bot.sendMessage(chatId, '📊 Получаю историю сделок за сутки...');
            const trades = await this.tradeHistoryService.getDailyTradeHistory();
            if (trades.length === 0) {
                await this.bot.sendMessage(chatId, 'ℹ️ За последние 24 часа сделок не найдено');
                return;
            }
            // Формируем сообщение с историей сделок
            let message = `📈 История сделок за сутки (${trades.length} шт.):\n\n`;
            trades.slice(0, 10).forEach((trade, index) => {
                const time = new Date(trade.timestamp).toLocaleTimeString('ru-RU');
                const side = trade.side === 'buy' ? '🟢 BUY' : '🔴 SELL';
                const pnl = trade.pnl >= 0 ? `+${trade.pnl.toFixed(4)}` : trade.pnl.toFixed(4);
                message += `${index + 1}. ${trade.symbol} ${side}\n`;
                message += `   PnL: ${pnl} USDT | ${time}\n`;
                message += `   Стратегия: ${trade.strategy || 'N/A'}\n\n`;
            });
            if (trades.length > 10) {
                message += `... и еще ${trades.length - 10} сделок`;
            }
            await this.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
        }
        catch (error) {
            console.error('Ошибка получения истории сделок:', error);
            await this.bot.sendMessage(chatId, '❌ Ошибка получения истории сделок');
        }
    }
    /**
     * Обработчик команды /stats
     */
    async handleDailyStats(msg) {
        const chatId = msg.chat.id;
        try {
            await this.bot.sendMessage(chatId, '📊 Рассчитываю статистику за сутки...');
            const stats = await this.tradeHistoryService.getDailyTradeStats();
            const message = `
📊 <b>Статистика за сутки:</b>

📈 Всего сделок: <b>${stats.totalTrades}</b>
✅ Прибыльных: <b>${stats.winningTrades}</b>
❌ Убыточных: <b>${stats.losingTrades}</b>
🎯 Винрейт: <b>${stats.winRate.toFixed(2)}%</b>

💰 Общий PnL: <b>${stats.totalPnl.toFixed(4)} USDT</b>
📊 Средний PnL: <b>${stats.avgPnl.toFixed(4)} USDT</b>
💸 Общие комиссии: <b>${stats.totalFees.toFixed(4)} USDT</b>

🏆 Лучшая сделка: <b>${stats.bestTrade.toFixed(4)} USDT</b>
💸 Худшая сделка: <b>${stats.worstTrade.toFixed(4)} USDT</b>
      `;
            await this.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
        }
        catch (error) {
            console.error('Ошибка получения статистики:', error);
            await this.bot.sendMessage(chatId, '❌ Ошибка получения статистики');
        }
    }
    /**
     * Обработчик команды /top
     */
    async handleTopTrades(msg) {
        const chatId = msg.chat.id;
        try {
            await this.bot.sendMessage(chatId, '🏆 Получаю лучшие сделки...');
            const topTrades = await this.tradeHistoryService.getTopTrades(5);
            if (topTrades.length === 0) {
                await this.bot.sendMessage(chatId, 'ℹ️ Прибыльных сделок не найдено');
                return;
            }
            let message = '🏆 <b>ТОП-5 ЛУЧШИХ СДЕЛОК:</b>\n\n';
            topTrades.forEach((trade, index) => {
                const time = new Date(trade.timestamp).toLocaleTimeString('ru-RU');
                const side = trade.side === 'buy' ? '🟢 BUY' : '🔴 SELL';
                message += `${index + 1}. ${trade.symbol} ${side}\n`;
                message += `   PnL: <b>+${trade.pnl.toFixed(4)} USDT</b>\n`;
                message += `   Время: ${time}\n`;
                message += `   Стратегия: ${trade.strategy || 'N/A'}\n\n`;
            });
            await this.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
        }
        catch (error) {
            console.error('Ошибка получения лучших сделок:', error);
            await this.bot.sendMessage(chatId, '❌ Ошибка получения лучших сделок');
        }
    }
    /**
     * Обработчик команды /worst
     */
    async handleWorstTrades(msg) {
        const chatId = msg.chat.id;
        try {
            await this.bot.sendMessage(chatId, '💸 Получаю худшие сделки...');
            const worstTrades = await this.tradeHistoryService.getWorstTrades(5);
            if (worstTrades.length === 0) {
                await this.bot.sendMessage(chatId, 'ℹ️ Убыточных сделок не найдено');
                return;
            }
            let message = '💸 <b>ТОП-5 ХУДШИХ СДЕЛОК:</b>\n\n';
            worstTrades.forEach((trade, index) => {
                const time = new Date(trade.timestamp).toLocaleTimeString('ru-RU');
                const side = trade.side === 'buy' ? '🟢 BUY' : '🔴 SELL';
                message += `${index + 1}. ${trade.symbol} ${side}\n`;
                message += `   PnL: <b>${trade.pnl.toFixed(4)} USDT</b>\n`;
                message += `   Время: ${time}\n`;
                message += `   Стратегия: ${trade.strategy || 'N/A'}\n\n`;
            });
            await this.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
        }
        catch (error) {
            console.error('Ошибка получения худших сделок:', error);
            await this.bot.sendMessage(chatId, '❌ Ошибка получения худших сделок');
        }
    }
}
exports.TradeHistoryCommands = TradeHistoryCommands;
//# sourceMappingURL=tradeHistoryCommands.js.map