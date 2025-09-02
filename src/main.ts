import 'dotenv/config';
import * as Mexc from 'mexc-api-sdk';
import TelegramBot from 'node-telegram-bot-api';
import pino from 'pino';

const { getRandomJoke } = require('../jokes');

class MexcScalper {
  private restClient: any;
  private telegramBot: TelegramBot;
  private logger: pino.Logger;
  private isRunning = false;
  private lastOrders: any[] = [];
  private totalTrades = 0;
  private sessionPnL = 0;
  private lastStatusUpdate = 0;
  // Anti-stall helpers
  private orderBirth: Map<string, number> = new Map();
  private ttlMs: number = parseInt(process.env.TTL_MS || '45000', 10);
  private deltaTicksForReplace: number = parseInt(process.env.DELTA_TICKS || '3', 10);
  private tickSize: number = parseFloat(process.env.TICK_SIZE || '0.01');

  constructor() {
    this.restClient = new (Mexc as any).Spot(
      process.env.MEXC_API_KEY!,
      process.env.MEXC_SECRET_KEY!
    );
    this.telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: true });
    this.logger = pino({ level: process.env.LOG_LEVEL || 'info' });
    this.setupTelegramHandlers();
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.logger.info('Starting MEXC scalper');
    await this.initializeOrders();
    await this.sendTelegramMessage(
      '*MEXC Scalper Started*\n\n' +
        'Orders will be maintained every 30s.\n\n' +
        getRandomJoke()
    );
    setInterval(async () => {
      try {
        if (this.isRunning) {
          await this.maintainOrders();
        }
      } catch (error) {
        this.logger.error({ err: error }, 'Error in maintainOrders');
      }
    }, 30000);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    const finalReport =
      '*MEXC Scalper Stopped*\n\n' +
      'Session summary:\n' +
      `• Total trades: ${this.totalTrades}\n` +
      `• Session P&L: $${this.sessionPnL.toFixed(2)}\n\n` +
      getRandomJoke();
    await this.sendTelegramMessage(finalReport);
    this.logger.info('Stopped MEXC scalper');
  }

  private async initializeOrders(): Promise<void> {
    try {
      const orders = await this.restClient.openOrders('ETHUSDC');
      this.lastOrders = orders || [];
      this.logger.info({ count: this.lastOrders.length }, 'Loaded open orders');
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to load open orders');
    }
  }

  private async maintainOrders(): Promise<void> {
    try {
      const currentOrders = await this.restClient.openOrders('ETHUSDC');
      const currentPrice = await this.restClient.tickerPrice('ETHUSDC');
      const price = parseFloat(currentPrice.price);
      // Best bid/ask for drift and maker-guard
      const book = await this.restClient.bookTicker('ETHUSDC');
      const bestBid = parseFloat(book.bidPrice || book.bid || book.bestBid || book.b || '0');
      const bestAsk = parseFloat(book.askPrice || book.ask || book.bestAsk || book.a || '0');
      const mid = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : price;

      const levels = parseInt(process.env.LEVELS || '4', 10);
      const buyOrders = currentOrders.filter((o: any) => o.side === 'BUY').length;
      const sellOrders = currentOrders.filter((o: any) => o.side === 'SELL').length;
      this.logger.info(`Open orders: ${buyOrders} buy, ${sellOrders} sell`);

      // Anti-stall: refresh outdated BUY orders (TTL or drift)
      await this.refreshStaleBuyOrders(currentOrders, bestBid, bestAsk, mid);

      if (buyOrders < levels) await this.placeMissingBuyOrders(currentOrders, mid, bestAsk, levels);
      if (sellOrders < levels) await this.placeMissingSellOrders(currentOrders, mid, bestBid, bestAsk, levels);

      const now = Date.now();
      if (now - this.lastStatusUpdate > 15 * 60 * 1000) {
        await this.sendStatusUpdate(currentOrders);
        this.lastStatusUpdate = now;
      }
      this.lastOrders = currentOrders;
    } catch (error) {
      this.logger.error({ err: error }, 'Error during order maintenance');
    }
  }

  private async placeMissingBuyOrders(currentOrders: any[], priceBase: number, bestAsk?: number, levels: number = 4): Promise<void> {
    if (String(process.env.DRY_RUN).toLowerCase() === 'true') {
      this.logger.info('DRY_RUN enabled: skipping BUY order placement');
      return;
    }
    const existingBuyOrders = currentOrders.filter((o: any) => o.side === 'BUY');
    const neededBuyOrders = levels - existingBuyOrders.length;
    if (neededBuyOrders <= 0) return;

    const offset = 5.7;
    const step = 4.275;
    for (let i = 0; i < neededBuyOrders; i++) {
      const level = existingBuyOrders.length + i;
      const orderPrice = priceBase - offset - step * level;
      let roundedPrice = this.roundToTick(orderPrice);
      if (bestAsk) {
        // Maker-guard: не залезть в спред
        const maxMakerPrice = this.roundToTick(bestAsk - this.tickSize);
        if (roundedPrice >= maxMakerPrice) roundedPrice = maxMakerPrice;
      }
      const qty = 0.000345;
      try {
        const timestamp = Date.now();
        const clientOrderId = `AUTO_BUY_${level}_${timestamp}`;
        // mexc-api-sdk signature: newOrder(symbol, side, orderType, options)
        await this.restClient.newOrder(
          'ETHUSDC',
          'BUY',
          'LIMIT',
          {
            timeInForce: 'GTC',
            price: roundedPrice.toString(),
            quantity: qty.toString(),
            newClientOrderId: clientOrderId,
          }
        );
        this.orderBirth.set(clientOrderId, timestamp);
        this.logger.info(`Placed BUY L${level} at $${roundedPrice}`);
        await new Promise((r) => setTimeout(r, 1000));
      } catch (error) {
        this.logger.error({ err: error }, `Failed to place BUY level ${level}`);
      }
    }
  }

  private async placeMissingSellOrders(currentOrders: any[], priceBase: number, bestBid?: number, bestAsk?: number, levels: number = 4): Promise<void> {
    if (String(process.env.DRY_RUN).toLowerCase() === 'true') {
      this.logger.info('DRY_RUN enabled: skipping SELL order placement');
      return;
    }
    const existingSellOrders = currentOrders.filter((o: any) => o.side === 'SELL');
    const neededSellOrders = levels - existingSellOrders.length;
    if (neededSellOrders <= 0) return;

    // Check free ETH to avoid Oversold (30005)
    let freeEth = 0;
    try {
      const account = await this.restClient.accountInfo();
      const ethBal = (account.balances || []).find((b: any) => (b.asset || b.symbol || '').toUpperCase() === 'ETH');
      if (ethBal) {
        freeEth = parseFloat(ethBal.free || '0');
      }
    } catch (e) {
      this.logger.warn({ err: e }, 'Failed to fetch accountInfo for SELL balance check');
    }

    const offset = 5.7;
    const step = 4.275;
    for (let i = 0; i < neededSellOrders; i++) {
      const level = existingSellOrders.length + i;
      const orderPrice = priceBase + offset + step * level;
      let roundedPrice = this.roundToTick(orderPrice);
      if (bestBid && bestAsk) {
        // Maker-guard для SELL: цена не ниже bestBid и не внутри спреда
        const minMakerPrice = this.roundToTick(bestBid + this.tickSize);
        if (roundedPrice <= minMakerPrice) roundedPrice = minMakerPrice;
      }
      const qty = 0.000344; // ~ $1.5 notional
      if (freeEth < qty) {
        this.logger.warn(`Skip SELL L${level}: insufficient ETH free=${freeEth} < qty=${qty}`);
        break;
      }
      try {
        const timestamp = Date.now();
        const clientOrderId = `AUTO_SELL_${level}_${timestamp}`;
        // mexc-api-sdk signature: newOrder(symbol, side, orderType, options)
        await this.restClient.newOrder(
          'ETHUSDC',
          'SELL',
          'LIMIT',
          {
            timeInForce: 'GTC',
            price: roundedPrice.toString(),
            quantity: qty.toString(),
            newClientOrderId: clientOrderId,
          }
        );
        this.logger.info(`Placed SELL L${level} at $${roundedPrice}`);
        await new Promise((r) => setTimeout(r, 1000));
        freeEth -= qty; // reduce local estimate
      } catch (error) {
        this.logger.error({ err: error }, `Failed to place SELL level ${level}`);
      }
    }
  }

  // Cancel and re-place buy orders that are too old or too deep vs current bid
  private async refreshStaleBuyOrders(currentOrders: any[], bestBid: number, bestAsk: number, priceBase: number): Promise<void> {
    try {
      const buyOrders = currentOrders.filter((o: any) => o.side === 'BUY');
      for (const o of buyOrders) {
        const coid: string = o.clientOrderId || o.origClientOrderId || '';
        if (!coid) continue;
        const placedAt = this.orderBirth.get(coid) || Date.now();
        if (!this.orderBirth.has(coid)) this.orderBirth.set(coid, placedAt);
        const age = Date.now() - placedAt;
        const op = parseFloat(o.price || o.origPrice || '0');
        const driftTicks = bestBid && op ? Math.floor((bestBid - op) / this.tickSize) : 0;
        if (age > this.ttlMs || driftTicks > this.deltaTicksForReplace) {
          try {
            await this.restClient.cancelOrder('ETHUSDC', { origClientOrderId: coid });
            // parse level from clientOrderId
            const level = this.parseLevelFromClientId(coid) ?? 0;
            const offset = 5.7;
            const step = 4.275;
            let newPrice = this.roundToTick(priceBase - offset - step * level);
            const maxMakerPrice = this.roundToTick(bestAsk - this.tickSize);
            if (newPrice >= maxMakerPrice) newPrice = maxMakerPrice;
            const qty = 0.000345;
            const newId = `AUTO_BUY_${level}_${Date.now()}`;
            await this.restClient.newOrder('ETHUSDC', 'BUY', 'LIMIT', {
              timeInForce: 'GTC',
              price: newPrice.toString(),
              quantity: qty.toString(),
              newClientOrderId: newId,
            });
            this.orderBirth.delete(coid);
            this.orderBirth.set(newId, Date.now());
            this.logger.info(`Repriced BUY L${level} -> $${newPrice} (age=${Math.round(age/1000)}s, drift=${driftTicks}t)`);
            // brief spacing to avoid rate-limit
            await new Promise((r) => setTimeout(r, 400));
          } catch (err) {
            this.logger.error({ err }, `Failed to refresh BUY order ${coid}`);
          }
        }
      }
    } catch (e) {
      this.logger.error({ err: e }, 'refreshStaleBuyOrders failed');
    }
  }

  private roundToTick(v: number): number {
    if (!this.tickSize || !isFinite(this.tickSize)) return Math.round(v * 100) / 100; // fallback to cents
    const n = Math.round(v / this.tickSize) * this.tickSize;
    // Fix floating point artifacts, keep appropriate decimals
    const decimals = (this.tickSize.toString().split('.')[1] || '').length;
    return Number(n.toFixed(decimals));
  }

  private parseLevelFromClientId(id: string): number | undefined {
    // Expecting patterns like AUTO_BUY_{level}_{ts} or AUTO_SELL_{level}_{ts}
    try {
      const parts = id.split('_');
      if (parts.length >= 3) {
        const lvl = parseInt(parts[2], 10);
        if (!isNaN(lvl)) return lvl;
      }
    } catch {}
    return undefined;
  }

  private async sendStatusUpdate(orders: any[]): Promise<void> {
    try {
      const buyOrders = orders.filter((o: any) => o.side === 'BUY').length;
      const sellOrders = orders.filter((o: any) => o.side === 'SELL').length;
      let message = '*Status Update*\n\n';
      message += this.getBalanceMessage() + '\n\n';
      message += `Open orders: BUY ${buyOrders}, SELL ${sellOrders}, TOTAL ${orders.length}\n`;
      message += `Trades: ${this.totalTrades}\n`;
      message += `P&L: $${this.sessionPnL.toFixed(2)}\n\n`;
      message += getRandomJoke();
      await this.sendTelegramMessage(message);
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to send status update');
    }
  }

  private getBalanceMessage(): string {
    return 'Balance summary: (not implemented)';
  }

  private setupTelegramHandlers(): void {
    this.telegramBot.on('message', async (msg) => {
      if (!msg.text) return;
      try {
        if (msg.text === '/start') {
          await this.telegramBot.sendMessage(
            msg.chat.id,
            'Welcome! This is MEXC scalper bot.\n\n' + getRandomJoke()
          );
        } else if (msg.text === '/status') {
          const status = this.isRunning ? 'RUNNING (maintaining orders)' : 'STOPPED';
          await this.telegramBot.sendMessage(
            msg.chat.id,
            `Bot status: ${status}\n\n` + getRandomJoke()
          );
        }
      } catch (error) {
        this.logger.error({ err: error }, 'Telegram error');
      }
    });
  }

  private async sendTelegramMessage(text: string): Promise<void> {
    try {
      await this.telegramBot.sendMessage(
        Number(process.env.TELEGRAM_ADMIN_CHAT_IDS!),
        text,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to send Telegram message');
    }
  }
}

async function main() {
  try {
    console.log('Starting MEXC scalper...');
    const scalper = new MexcScalper();
    await scalper.start();
    process.on('SIGINT', async () => {
      console.log('SIGINT received, shutting down...');
      await scalper.stop();
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, shutting down...');
      await scalper.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
