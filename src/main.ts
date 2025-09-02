import 'dotenv/config';
import * as Mexc from 'mexc-api-sdk';
import TelegramBot from 'node-telegram-bot-api';
import { initDatabase } from './storage/db';
import pino from 'pino';

const { getRandomJoke } = require('../jokes');

class MexcScalper {
  private restClient: any;
  private telegramBot: TelegramBot;
  private logger: pino.Logger;
  private db: any | null = null;
  private isRunning = false;
  private lastOrders: any[] = [];
  private totalTrades = 0;
  private sessionPnL = 0;
  private lastStatusUpdate = 0;
  // Anti-stall helpers
  private orderBirth: Map<string, number> = new Map();
  private ttlMs: number = parseInt(process.env.TTL_MS || '45000', 10);
  private deltaTicksForReplace: number = parseInt(process.env.DELTA_TICKS || '3', 10);
  private minRepriceIntervalMs: number = parseInt(process.env.REPRICE_MIN_INTERVAL_MS || '15000', 10);
  private tickSize: number = parseFloat(process.env.TICK_SIZE || '0.01');
  private stepSize: number = parseFloat(process.env.STEP_SIZE || '0.000001');
  private minNotional: number = parseFloat(process.env.MIN_NOTIONAL || '1');
  private minQty: number = parseFloat(process.env.MIN_QTY || '0');
  private cancelTimestamps: number[] = [];
  private orderNotionalUsd: number = parseFloat(process.env.ORDER_NOTIONAL_USD || '1.5');
  private recvWindow: number = parseInt(process.env.MEXC_RECV_WINDOW || '60000', 10);
  private autoSeedEth: boolean = String(process.env.AUTO_SEED_ETH || 'false').toLowerCase() === 'true';
  private seedBaseUsd: number = parseFloat(process.env.SEED_BASE_USD || '10');

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
    await this.loadExchangeFilters('ETHUSDC');
    try {
      this.db = await initDatabase(process.env.DATABASE_PATH || './data/mexc_bot.db');
      this.logger.info('Database initialized');
    } catch (e) {
      this.logger.warn({ err: e }, 'Failed to initialize database');
    }
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

    // Lightweight healthcheck (server time drift)
    setInterval(async () => {
      try {
        await this.healthcheck();
      } catch (e) {
        this.logger.warn({ err: e }, 'Healthcheck failed');
      }
    }, 300000);
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
      const currentOrders = await (async () => {
        try {
          // Some SDKs accept options with recvWindow as second argument
          const o = await (this.restClient.openOrders('ETHUSDC', { recvWindow: this.recvWindow })
            .catch(() => this.restClient.openOrders('ETHUSDC')));
          return o;
        } catch (e: any) {
          const msg = String(e?.message || '');
          if (msg.includes('recvWindow') || msg.includes('700003')) {
            try { await this.restClient.time?.(); } catch {}
            try { return await this.restClient.openOrders('ETHUSDC'); } catch {}
          }
          throw e;
        }
      })();
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

      // Anti-stall: refresh outdated BUY/SELL orders (TTL or drift)
      await this.refreshStaleBuyOrders(currentOrders, bestBid, bestAsk, mid);
      await this.refreshStaleSellOrders(currentOrders, bestBid, bestAsk, mid);

      if (buyOrders < levels) await this.placeMissingBuyOrders(currentOrders, mid, bestBid, bestAsk, levels);
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

  private async placeMissingBuyOrders(currentOrders: any[], priceBase: number, bestBid?: number, bestAsk?: number, levels: number = 4): Promise<void> {
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
      // Additional maker-guard BUY: keep at/below bestBid with a safety gap
      if (typeof bestBid === 'number' && isFinite(bestBid)) {
        const gapTicks = Math.max(1, parseInt(process.env.MAKER_GUARD_GAP_TICKS || '1', 10));
        const guard = this.roundToTick(bestBid - gapTicks * this.tickSize);
        if (roundedPrice > guard) roundedPrice = guard;
      }
      // Quantity: target notional rounded to step, ensure minNotional and minQty
      let qty = this.roundToStep((parseFloat(process.env.ORDER_NOTIONAL_USD || '1.5')) / Math.max(roundedPrice, 1e-8));
      if (this.minQty && qty < this.minQty) qty = this.minQty;
      if (roundedPrice * qty < (this.minNotional || 1)) {
        qty = this.roundToStep((this.minNotional || 1) / Math.max(roundedPrice, 1e-8));
      }
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
            newClientOrderId: clientOrderId,\n            recvWindow: this.recvWindow,\n          }\n        );
        await this.logEvent('ORDER_PLACED', { side: 'BUY', level, price: roundedPrice, qty, clientOrderId });
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
      const account = await this.restClient.accountInfo({ recvWindow: this.recvWindow });
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
      // Additional maker-guard SELL: keep at/above bestAsk with a safety gap
      if (typeof bestAsk === 'number' && isFinite(bestAsk)) {
        const gapTicks = Math.max(1, parseInt(process.env.MAKER_GUARD_GAP_TICKS || '1', 10));
        const guard = this.roundToTick(bestAsk + gapTicks * this.tickSize);
        if (roundedPrice < guard) roundedPrice = guard;
      }
      // Quantity: target notional rounded to step, ensure minNotional and minQty
      let qty = this.roundToStep((parseFloat(process.env.ORDER_NOTIONAL_USD || '1.5')) / Math.max(roundedPrice, 1e-8));
      if (this.minQty && qty < this.minQty) qty = this.minQty;
      if (roundedPrice * qty < (this.minNotional || 1)) {
        qty = this.roundToStep((this.minNotional || 1) / Math.max(roundedPrice, 1e-8));
      }
      if (freeEth < qty) {
        if (this.autoSeedEth && String(process.env.DRY_RUN).toLowerCase() !== 'true') {
          await this.ensureBaseInventory(priceBase, qty);
          try {
            const account2 = await this.restClient.accountInfo({ recvWindow: this.recvWindow });
            const ethBal2 = (account2.balances || []).find((b: any) => (b.asset || b.symbol || '').toUpperCase() === 'ETH');
            if (ethBal2) freeEth = parseFloat(ethBal2.free || '0');
          } catch {}
        }
        if (freeEth < qty) {
          this.logger.warn(`Skip SELL L${level}: insufficient ETH free=${freeEth} < qty=${qty}`);
          break;
        }
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
            recvWindow: this.recvWindow,
            timeInForce: 'GTC',
            price: roundedPrice.toString(),
            quantity: qty.toString(),
            newClientOrderId: clientOrderId,
          }
        );
        await this.logEvent('ORDER_PLACED', { side: 'SELL', level, price: roundedPrice, qty, clientOrderId });
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
        const age = Date.now() - placedAt; if (age < this.minRepriceIntervalMs) { continue; } const op = parseFloat(o.price || o.origPrice || '0');
        const driftTicks = bestBid && op ? Math.floor((bestBid - op) / this.tickSize) : 0;
        if (age > this.ttlMs || driftTicks > this.deltaTicksForReplace) {
          try {
            if (!this.canCancelNow()) {
              this.logger.warn('Cancel rate limit reached, skipping BUY refresh');
              continue;
            }
            await this.restClient.cancelOrder('ETHUSDC', { origClientOrderId: coid, recvWindow: this.recvWindow });
            await this.logEvent('ORDER_CANCELED', { side: 'BUY', clientOrderId: coid });
            // parse level from clientOrderId
            const level = this.parseLevelFromClientId(coid) ?? 0;
            const offset = 5.7;
            const step = 4.275;
            let newPrice = this.roundToTick(priceBase - offset - step * level);
            const gapTicks = Math.max(1, parseInt(process.env.MAKER_GUARD_GAP_TICKS || '1', 10));
            const guard = this.roundToTick(bestBid - gapTicks * this.tickSize);
            if (newPrice > guard) newPrice = guard;
            let qty = this.roundToStep((parseFloat(process.env.ORDER_NOTIONAL_USD || '1.5')) / Math.max(newPrice, 1e-8));
            if (this.minQty && qty < this.minQty) qty = this.minQty;
            if (newPrice * qty < (this.minNotional || 1)) {
              qty = this.roundToStep((this.minNotional || 1) / Math.max(newPrice, 1e-8));
            }
            const newId = `AUTO_BUY_${level}_${Date.now()}`;
            await this.restClient.newOrder('ETHUSDC', 'BUY', 'LIMIT', {
              timeInForce: 'GTC',
              price: newPrice.toString(),
              quantity: qty.toString(),
              newClientOrderId: newId,
              recvWindow: this.recvWindow,
            });
            await this.logEvent('ORDER_REPRICED', { side: 'BUY', level, price: newPrice, qty, clientOrderId: newId });
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

  // Cancel and re-place sell orders that are too old or too shallow vs current ask
  private async refreshStaleSellOrders(currentOrders: any[], bestBid: number, bestAsk: number, priceBase: number): Promise<void> {
    try {
      const sellOrders = currentOrders.filter((o: any) => o.side === 'SELL');
      for (const o of sellOrders) {
        const coid: string = o.clientOrderId || o.origClientOrderId || '';
        if (!coid) continue;
        const placedAt = this.orderBirth.get(coid) || Date.now();
        if (!this.orderBirth.has(coid)) this.orderBirth.set(coid, placedAt);
        const age = Date.now() - placedAt; if (age < this.minRepriceIntervalMs) { continue; } const op = parseFloat(o.price || o.origPrice || '0');
        const driftTicks = bestAsk && op ? Math.floor((op - bestAsk) / this.tickSize) : 0; // how far below ask
        if (age > this.ttlMs || driftTicks > this.deltaTicksForReplace) {
          try {
            if (!this.canCancelNow()) {
              this.logger.warn('Cancel rate limit reached, skipping SELL refresh');
              continue;
            }
            await this.restClient.cancelOrder('ETHUSDC', { origClientOrderId: coid });
            const level = this.parseLevelFromClientId(coid) ?? 0;
            const offset = 5.7;
            const step = 4.275;
            let newPrice = this.roundToTick(priceBase + offset + step * level);
            // Maker-guard SELL: floor at/above bestAsk with gap
            const gapTicks = Math.max(1, parseInt(process.env.MAKER_GUARD_GAP_TICKS || '1', 10));
            const guard = this.roundToTick(bestAsk + gapTicks * this.tickSize);
            if (newPrice < guard) newPrice = guard;
            let qty = this.roundToStep((parseFloat(process.env.ORDER_NOTIONAL_USD || '1.5')) / Math.max(newPrice, 1e-8));
            if (this.minQty && qty < this.minQty) qty = this.minQty;
            if (newPrice * qty < (this.minNotional || 1)) {
              qty = this.roundToStep((this.minNotional || 1) / Math.max(newPrice, 1e-8));
            }
            const newId = `AUTO_SELL_${level}_${Date.now()}`;
            await this.restClient.newOrder('ETHUSDC', 'SELL', 'LIMIT', { recvWindow: this.recvWindow, recvWindow: this.recvWindow, 
              timeInForce: 'GTC',
              price: newPrice.toString(),
              quantity: qty.toString(),
              newClientOrderId: newId,
            });
            this.orderBirth.delete(coid);
            this.orderBirth.set(newId, Date.now());
            this.logger.info(`Repriced SELL L${level} -> $${newPrice} (age=${Math.round(age/1000)}s, drift=${driftTicks}t)`);
            await new Promise((r) => setTimeout(r, 400));
          } catch (err) {
            this.logger.error({ err }, `Failed to refresh SELL order ${coid}`);
          }
        }
      }
    } catch (e) {
      this.logger.error({ err: e }, 'refreshStaleSellOrders failed');
    }
  }

  private getBalanceMessage(): string {
    return 'Balance summary: (not implemented)';
  }

  private roundToStep(qty: number): number {
    if (!this.stepSize || !isFinite(this.stepSize)) return qty;
    const k = Math.floor(qty / this.stepSize);
    const n = k * this.stepSize;
    const decimals = (this.stepSize.toString().split('.')[1] || '').length;
    return Number(n.toFixed(decimals));
  }

  private canCancelNow(): boolean {
    const limit = parseInt(process.env.CANCEL_RATE_PER_MIN || '30', 10);
    const now = Date.now();
    this.cancelTimestamps = this.cancelTimestamps.filter((t) => now - t < 60_000);
    if (this.cancelTimestamps.length >= limit) return false;
    this.cancelTimestamps.push(now);
    return true;
  }

  private async loadExchangeFilters(symbol: string): Promise<void> {
    try {
      const info = await this.restClient.exchangeInfo({ symbol });
      const arr = (info?.symbols ?? []);
      const s = Array.isArray(arr) ? arr.find((x: any) => x.symbol === symbol) : undefined;
      const priceFilter = s?.filters?.find((f: any) => f.filterType === 'PRICE_FILTER');
      const lotFilter = s?.filters?.find((f: any) => f.filterType === 'LOT_SIZE');
      const notionalFilter = s?.filters?.find((f: any) => f.filterType === 'MIN_NOTIONAL');
      if (priceFilter?.tickSize) this.tickSize = parseFloat(priceFilter.tickSize);
      if (lotFilter?.stepSize) this.stepSize = parseFloat(lotFilter.stepSize);
      if (lotFilter?.minQty) this.minQty = parseFloat(lotFilter.minQty);
      if (notionalFilter?.minNotional) this.minNotional = parseFloat(notionalFilter.minNotional);
      this.logger.info({ tickSize: this.tickSize, stepSize: this.stepSize, minNotional: this.minNotional, minQty: this.minQty }, 'Loaded exchange filters');
    } catch (e) {
      this.logger.warn({ err: e }, 'Failed to load exchange filters, using defaults');
    }
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

  private async logEvent(type: string, payload: any): Promise<void> {
    try {
      if (!this.db?.run) return;
      await this.db.run('INSERT INTO events (ts, type, payload_json) VALUES (?, ?, ?)', [Date.now(), type, JSON.stringify(payload)]);
    } catch (e) {
      this.logger.warn({ err: e }, 'Failed to log event');
    }
  }

  private async healthcheck(): Promise<void> {
    try {
      const t = await this.restClient.time?.();
      const serverTime = t?.serverTime ?? t?.server_time ?? undefined;
      if (serverTime) {
        const drift = Math.abs(Date.now() - Number(serverTime));
        if (drift > 5000) {
          this.logger.warn({ driftMs: drift }, 'Server time drift detected');
        }
      }
    } catch (e) {
      this.logger.warn({ err: e }, 'Failed to query server time');
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






