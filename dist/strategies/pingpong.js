"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PingPongStrategy = void 0;
const events_1 = require("events");
const math_1 = require("../core/math");
/**
 * Стратегия PingPong: один тикет в рынок, берем спред, не застреваем
 * Правила:
 * - Никогда не открываем SELL, если нет инвентаря (иначе Oversold)
 * - В нейтральном состоянии: ставим только один лимит-maker с минимальным notional
 * - После fill: сразу ставим TP в противоположную сторону на tp_bps, отменяя встречный ордер
 * - Если позиция висит дольше max_position_duration_sec или цена ушла против больше cutLossBps — выходим MARKET
 * - Публикуем только PnL (+/-)
 */
class PingPongStrategy extends events_1.EventEmitter {
    config;
    instrument;
    rest;
    logger;
    symbol;
    // Параметры
    minSpreadTicks;
    tpBps;
    maxHoldMs;
    cutLossBps;
    baseOrderUsd;
    // Состояние
    bestBid = 0;
    bestAsk = 0;
    activeBuy = null;
    activeSell = null;
    positionQty = 0; // базовый актив
    entryPrice = 0;
    entryTs = 0;
    // Баланс
    baseFree = 0;
    isRunning = false;
    constructor(config, instrument, rest, logger) {
        super();
        this.config = config;
        this.instrument = instrument;
        this.rest = rest;
        this.logger = logger;
        this.symbol = instrument.symbol;
        this.minSpreadTicks = config.filters.min_spread_ticks;
        // Используем hedgehog.tp_bps.normal как целевой профит в б.п.
        this.tpBps = config.hedgehog.tp_bps.normal;
        this.maxHoldMs = config.risk.max_position_duration_sec * 1000;
        // Страховочный стоп: 2x tp по умолчанию
        this.cutLossBps = Math.max(this.tpBps * 2, 10);
        // Размер заявки: минимум 1 USDC и 1% депозита
        this.baseOrderUsd = Math.max(config.filters.min_notional_usd, Math.max(1, config.deposit_usd * 0.01));
    }
    async start() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        await this.refreshBalances();
        this.logger.info(`PingPong started for ${this.symbol}. tp=${this.tpBps}bps, cutLoss=${this.cutLossBps}bps, maxHold=${this.maxHoldMs}ms`);
    }
    async stop() {
        if (!this.isRunning)
            return;
        this.isRunning = false;
        await this.cancelAll();
        this.logger.info('PingPong stopped');
    }
    async refreshBalances() {
        try {
            const acct = await this.rest.getAccountInfo();
            const base = acct.balances.find(b => b.asset === this.instrument.baseAsset);
            this.baseFree = base ? base.free : 0;
            this.logger.info(`Balances loaded: ${this.instrument.baseAsset} free=${this.baseFree}`);
        }
        catch (e) {
            this.logger.warn({ err: e }, 'Failed to load balances');
        }
    }
    /**
     * Обновление лучших цен
     */
    async onBookTicker(bidPrice, askPrice, bidQty, askQty) {
        this.bestBid = bidPrice;
        this.bestAsk = askPrice;
        if (!this.isRunning)
            return;
        // Проверка минимального спреда в тиках
        const spread = this.bestAsk - this.bestBid;
        const minSpread = this.minSpreadTicks * this.instrument.tickSize;
        const haveActive = !!(this.activeBuy || this.activeSell);
        if (spread < minSpread && haveActive) {
            this.logger.debug(`Skip quoting: spread=${spread.toFixed(6)} < min=${minSpread.toFixed(6)} (ticks=${this.minSpreadTicks})`);
            return; // не котируем если спред слишком мал, но даём шанс первому размещению
        }
        if (spread <= 0) {
            this.logger.debug(`Skip quoting: non-positive spread bid=${this.bestBid} ask=${this.bestAsk}`);
            return;
        }
        // Если есть открытая позиция — проверяем условия выхода
        if (this.positionQty > 0) {
            await this.maybeExitPosition();
            return;
        }
        // Нейтральное состояние: размещаем один лимит в сторону, где есть возможность
        // Если нет инвентаря — только BUY. Если есть >= требуемого — можно SELL.
        await this.ensureNeutralQuotes();
    }
    /**
     * Обработка исполнения
     */
    async onFill(fill) {
        // Обновляем баланс по факту
        if (fill.side === 'buy') {
            this.positionQty += fill.quantity;
            this.entryPrice = fill.price;
            this.entryTs = math_1.TimeUtils.getTimestamp();
            this.baseFree += fill.quantity; // получили базовый актив
            this.logger.info(`Fill BUY: qty=${fill.quantity}, price=${fill.price}. Position qty=${this.positionQty}`);
            // сразу выставляем TP
            await this.placeTakeProfit(fill.quantity, fill.price);
            // отменяем встречный ордер, если был
            if (this.activeSell?.isActive) {
                await this.cancel(this.activeSell);
                this.activeSell = null;
            }
            if (this.activeBuy?.isActive && this.activeBuy.id === fill.orderId) {
                this.activeBuy = null;
            }
        }
        else {
            // sell fill
            const realizedQty = Math.min(this.positionQty, fill.quantity);
            const pnl = (fill.price - this.entryPrice) * realizedQty;
            const trade = {
                pnlUsd: pnl,
                entryPrice: this.entryPrice,
                exitPrice: fill.price,
                quantity: realizedQty,
                side: 'buy',
                durationMs: math_1.TimeUtils.getTimestamp() - this.entryTs
            };
            this.logger.info(`Close SELL: qty=${realizedQty}, entry=${this.entryPrice}, exit=${fill.price}, pnl=${pnl.toFixed(4)} USD`);
            this.emit('tradeClosed', trade);
            this.positionQty = Math.max(0, this.positionQty - realizedQty);
            this.baseFree = Math.max(0, this.baseFree - realizedQty);
            if (this.positionQty === 0) {
                this.entryPrice = 0;
                this.entryTs = 0;
                // вернемся к нейтральным котировкам
                await this.ensureNeutralQuotes();
            }
            if (this.activeSell?.isActive && this.activeSell.id === fill.orderId) {
                this.activeSell = null;
            }
        }
    }
    async ensureNeutralQuotes() {
        // Отменяем всё перед обновлением
        await this.cancelAll();
        // Рассчитываем размер заявки в количестве
        const priceRef = this.bestBid > 0 ? this.bestBid : await this.rest.getPrice(this.symbol);
        const desiredQty = math_1.RoundingUtils.calculateQuantityForNotional(priceRef, this.baseOrderUsd, this.instrument.stepSize);
        if (desiredQty <= 0) {
            this.logger.warn(`DesiredQty=0 at price=${priceRef}. Check stepSize/minNotional`);
            return;
        }
        // BUY лимит чуть ниже bid, чтобы быть maker
        const buyPrice = math_1.RoundingUtils.roundToTick(this.bestBid - this.instrument.tickSize, this.instrument.tickSize);
        const buyValid = math_1.RoundingUtils.validateNotional(buyPrice, desiredQty, this.instrument.minNotional);
        if (buyValid) {
            this.logger.info(`Place BUY maker: price=${buyPrice}, qty=${desiredQty}`);
            this.activeBuy = await this.place('buy', buyPrice, desiredQty);
        }
        else {
            this.logger.debug(`Skip BUY: notional ${buyPrice * desiredQty} < min ${this.instrument.minNotional}`);
        }
        // SELL разрешаем только если хватает инвентаря
        if (this.baseFree >= desiredQty) {
            const sellPrice = math_1.RoundingUtils.roundToTick(this.bestAsk + this.instrument.tickSize, this.instrument.tickSize);
            const sellValid = math_1.RoundingUtils.validateNotional(sellPrice, desiredQty, this.instrument.minNotional);
            if (sellValid) {
                this.logger.info(`Place SELL maker: price=${sellPrice}, qty=${desiredQty}`);
                this.activeSell = await this.place('sell', sellPrice, desiredQty);
            }
            else {
                this.logger.debug(`Skip SELL: notional ${sellPrice * desiredQty} < min ${this.instrument.minNotional}`);
            }
        }
        else {
            this.logger.debug(`Skip SELL: baseFree=${this.baseFree} < needed=${desiredQty}`);
        }
    }
    async placeTakeProfit(quantity, entry) {
        const tpMultiplier = 1 + this.tpBps / 10000;
        const rawTp = entry * tpMultiplier;
        const tpPrice = math_1.RoundingUtils.roundToTick(rawTp, this.instrument.tickSize);
        const qty = math_1.RoundingUtils.roundToStep(quantity, this.instrument.stepSize);
        if (qty <= 0)
            return;
        if (!math_1.RoundingUtils.validateNotional(tpPrice, qty, this.instrument.minNotional)) {
            this.logger.debug(`Skip TP: notional ${tpPrice * qty} < min ${this.instrument.minNotional}`);
            return;
        }
        // размещаем SELL TP
        const order = await this.rest.placeOrder(this.symbol, 'sell', 'LIMIT', qty, tpPrice, this.coid('tp'));
        this.activeSell = {
            id: order.id,
            clientOrderId: order.clientOrderId,
            side: 'sell',
            price: tpPrice,
            quantity: qty,
            isActive: true
        };
        this.logger.info(`TP placed: price=${tpPrice}, qty=${qty}`);
    }
    async maybeExitPosition() {
        if (this.positionQty <= 0 || this.entryPrice <= 0)
            return;
        const now = math_1.TimeUtils.getTimestamp();
        const age = now - this.entryTs;
        const adverse = (this.entryPrice - this.bestBid) / this.entryPrice * 10000; // bps
        const shouldTimeExit = age > this.maxHoldMs;
        const shouldCutLoss = adverse > this.cutLossBps;
        if (shouldTimeExit || shouldCutLoss) {
            const qty = math_1.RoundingUtils.roundToStep(this.positionQty, this.instrument.stepSize);
            if (qty <= 0)
                return;
            this.logger.warn(`Exit position: ${shouldTimeExit ? 'time' : 'cutLoss'} qty=${qty}, entry=${this.entryPrice}, bid=${this.bestBid}`);
            // Выходим MARKET, чтобы не застрять
            const exit = await this.rest.placeOrder(this.symbol, 'sell', 'MARKET', qty, undefined, this.coid('mx'));
            // Притворимся fill-ом для учета pnl
            const fakeFill = {
                id: exit.id,
                orderId: exit.id,
                clientOrderId: exit.clientOrderId,
                symbol: this.symbol,
                price: exit.price > 0 ? exit.price : this.bestBid,
                quantity: qty,
                fee: 0,
                side: 'sell',
                timestamp: now
            };
            await this.onFill(fakeFill);
        }
    }
    async cancelAll() {
        const cancels = [];
        if (this.activeBuy?.isActive && this.activeBuy.id) {
            this.logger.debug(`Cancel BUY ${this.activeBuy.id}`);
            cancels.push(this.rest.cancelOrder(this.symbol, this.activeBuy.id, this.activeBuy.clientOrderId).catch(() => { }));
        }
        if (this.activeSell?.isActive && this.activeSell.id) {
            this.logger.debug(`Cancel SELL ${this.activeSell.id}`);
            cancels.push(this.rest.cancelOrder(this.symbol, this.activeSell.id, this.activeSell.clientOrderId).catch(() => { }));
        }
        if (cancels.length)
            await Promise.all(cancels);
        this.activeBuy = null;
        this.activeSell = null;
    }
    async cancel(order) {
        if (!order.isActive || !order.id)
            return;
        try {
            await this.rest.cancelOrder(this.symbol, order.id, order.clientOrderId);
            order.isActive = false;
        }
        catch (e) {
            this.logger.warn({ err: e }, 'Cancel error');
        }
    }
    async place(side, price, quantity) {
        try {
            const order = await this.rest.placeOrder(this.symbol, side, 'LIMIT', quantity, price, this.coid(side));
            this.logger.info(`Order placed: ${side.toUpperCase()} id=${order.id} price=${price} qty=${quantity}`);
            return {
                id: order.id,
                clientOrderId: order.clientOrderId,
                side,
                price,
                quantity,
                isActive: true
            };
        }
        catch (e) {
            this.logger.error({ err: e }, 'Place order error');
            return {
                clientOrderId: this.coid('err'),
                side,
                price,
                quantity,
                isActive: false
            };
        }
    }
    coid(kind) {
        return `pp_${kind}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }
}
exports.PingPongStrategy = PingPongStrategy;
//# sourceMappingURL=pingpong.js.map