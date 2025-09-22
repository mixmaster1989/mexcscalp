import 'dotenv/config';
import { Telegraf } from 'telegraf';

export class TelegramNotifier {
  private bot: Telegraf;
  private chatIds: string[];

  constructor(token?: string, chatIds?: string[]) {
    const t = token || process.env.TELEGRAM_BOT_TOKEN || '';
    if (!t) throw new Error('TELEGRAM_BOT_TOKEN is missing');
    this.bot = new Telegraf(t);
    const ids = chatIds || (process.env.TELEGRAM_ADMIN_CHAT_IDS || '').split(',').map(s=>s.trim()).filter(Boolean);
    this.chatIds = ids;
  }

  async sendMessage(text: string) {
    for (const id of this.chatIds) {
      try {
        await this.bot.telegram.sendMessage(id, text, { parse_mode: 'HTML' });
      } catch (e) {
        console.error('Telegram send error:', (e as any)?.message || e);
      }
    }
  }

  async sendPNL(symbol: string, qty: number, buyPrice: number, sellPrice: number, feePct: number = 0) {
    const gross = (sellPrice - buyPrice) * qty;
    const fee = feePct > 0 ? feePct * (buyPrice + sellPrice) * qty : 0;
    const pnl = gross - fee;
    const text = `💹 <b>PNL</b> ${symbol}\nQty: ${qty}\nBuy: ${buyPrice}\nSell: ${sellPrice}\nGross: ${gross.toFixed(6)}\nFee: ${fee.toFixed(6)}\n<b>Net:</b> ${pnl.toFixed(6)}`;
    await this.sendMessage(text);
  }
} 