"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramNotifier = void 0;
require("dotenv/config");
const telegraf_1 = require("telegraf");
class TelegramNotifier {
    bot;
    chatIds;
    constructor(token, chatIds) {
        const t = token || process.env.TELEGRAM_BOT_TOKEN || '';
        if (!t)
            throw new Error('TELEGRAM_BOT_TOKEN is missing');
        this.bot = new telegraf_1.Telegraf(t);
        const ids = chatIds || (process.env.TELEGRAM_ADMIN_CHAT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
        this.chatIds = ids;
    }
    async sendMessage(text) {
        for (const id of this.chatIds) {
            try {
                await this.bot.telegram.sendMessage(id, text, { parse_mode: 'HTML' });
            }
            catch (e) {
                console.error('Telegram send error:', e?.message || e);
            }
        }
    }
    async sendPNL(symbol, qty, buyPrice, sellPrice, feePct = 0) {
        const gross = (sellPrice - buyPrice) * qty;
        const fee = feePct > 0 ? feePct * (buyPrice + sellPrice) * qty : 0;
        const pnl = gross - fee;
        const text = `💹 <b>PNL</b> ${symbol}\nQty: ${qty}\nBuy: ${buyPrice}\nSell: ${sellPrice}\nGross: ${gross.toFixed(6)}\nFee: ${fee.toFixed(6)}\n<b>Net:</b> ${pnl.toFixed(6)}`;
        await this.sendMessage(text);
    }
}
exports.TelegramNotifier = TelegramNotifier;
//# sourceMappingURL=notifier.js.map