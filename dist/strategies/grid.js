"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GridStrategy = void 0;
const events_1 = require("events");
const math_1 = require("../core/math");
class GridStrategy extends events_1.EventEmitter {
    config;
    instrument;
    rest;
    logger;
    symbol;
    // Параметры сетки
    levelsPerSide;
    stepTicks;
    tpBps;
    baseOrderUsd;
    // Состояние
    bestBid = 0;
    bestAsk = 0;
    isRunning = false;
    baseFree = 0; // базовый актив
    activeGrid = new Map(); // key = clientOrderId
    constructor(config, instrument, rest, logger) {
        super();
        this.config = config;
        this.instrument = instrument;
        this.rest = rest;
        this.logger = logger;
        this.symbol = instrument.symbol;
        // Простая сетка: по умолчанию 2 уровня на сторону с шагом 1 тик, TP = hedgehog.tp_bps.normal
        this.levelsPerSide = 2;
        this.stepTicks = 1;
        this.tpBps = config.hedgehog.tp_bps.normal;
        this.baseOrderUsd = config.base_order_usd || 5.0;
    }
    async start() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        await this.refreshBalances();
        this.logger.info(`Grid started for ${this.symbol}: levelsPerSide=${this.levelsPerSide}, stepTicks=${this.stepTicks}, tp=${this.tpBps}bps`);
        // ПРИНУДИТЕЛЬНО запускаем сетку сразу с текущими ценами REST
        try {
            const price = await this.rest.getPrice(this.symbol);
            this.bestBid = price * 0.999; // имитация bid
            this.bestAsk = price * 1.001; // имитация ask
            await this.seedGrid();
            this.logger.info('Grid FORCE seeded from REST price');
        }
        catch (e) {
            this.logger.error({ err: e }, 'Grid force seed failed');
        }
    }
    async stop() {
        if (!this.isRunning)
            return;
        this.isRunning = false;
        await this.cancelAll();
        this.logger.info('Grid stopped');
    }
    async refreshBalances() {
        try {
            const acct = await this.rest.getAccountInfo();
            const base = acct.balances.find(b => b.asset === this.instrument.baseAsset);
            this.baseFree = base ? base.free : 0;
            this.logger.info(`Balances: ${this.instrument.baseAsset} free=${this.baseFree}`);
        }
        catch (e) {
            this.logger.warn({ err: e }, 'Balance load failed');
        }
    }
    async onBookTicker(bidPrice, askPrice) {
        if (!this.isRunning)
            return;
        const first = this.bestBid === 0 || this.bestAsk === 0;
        this.bestBid = bidPrice;
        this.bestAsk = askPrice;
        if (first) {
            await this.seedGrid();
        }
    }
    async seedGrid() {
        await this.cancelAll();
        const priceRef = this.bestBid > 0 ? this.bestBid : await this.rest.getPrice(this.symbol);
        const qty = math_1.RoundingUtils.calculateQuantityForNotional(priceRef, this.baseOrderUsd, this.instrument.stepSize);
        this.logger.info(`Grid seed: bid=${this.bestBid} ask=${this.bestAsk} priceRef=${priceRef} qty=${qty} baseOrderUsd=${this.baseOrderUsd}`);
        if (qty <= 0) {
            this.logger.warn('Grid seed: qty=0. Check stepSize/minNotional');
            return;
        }
        // BUY уровни ниже bid - ПРИНУДИТЕЛЬНО размещаем
        for (let i = 1; i <= this.levelsPerSide; i++) {
            const price = math_1.RoundingUtils.roundToTick(this.bestBid - i * this.stepTicks * this.instrument.tickSize, this.instrument.tickSize);
            this.logger.info(`Grid BUY L${-i}: trying price=${price} qty=${qty} notional=${price * qty} minNotional=${this.instrument.minNotional}`);
            await this.place('buy', price, qty, -i);
        }
        // SELL уровни выше ask (только при наличии инвентаря)
        this.logger.info(`Grid SELL check: baseFree=${this.baseFree} needed=${qty}`);
        if (this.baseFree >= qty) {
            for (let i = 1; i <= this.levelsPerSide; i++) {
                const price = math_1.RoundingUtils.roundToTick(this.bestAsk + i * this.stepTicks * this.instrument.tickSize, this.instrument.tickSize);
                this.logger.info(`Grid SELL L${i}: trying price=${price} qty=${qty} notional=${price * qty} minNotional=${this.instrument.minNotional}`);
                await this.place('sell', price, qty, i);
            }
        }
        else {
            this.logger.info('Grid SELL: skipped, insufficient baseFree');
        }
    }
    async onFill(fill) {
        // Уведомление в Telegram о сделке
        const pnl = fill.side === 'sell' ? (fill.price - fill.price * 0.9988) * fill.quantity : 0; // примерная прибыль на sell
        this.emit('trade', {
            side: fill.side,
            price: fill.price,
            quantity: fill.quantity,
            pnl
        });
        // BUY fill -> ставим SELL TP; SELL fill -> ставим BUY ниже (ре-пополнение сетки)
        if (fill.side === 'buy') {
            // TP на bps
            const tpPrice = math_1.RoundingUtils.roundToTick(fill.price * (1 + this.tpBps / 10000), this.instrument.tickSize);
            const qty = math_1.RoundingUtils.roundToStep(fill.quantity, this.instrument.stepSize);
            if (math_1.RoundingUtils.validateNotional(tpPrice, qty, this.instrument.minNotional)) {
                await this.place('sell', tpPrice, qty, 0);
            }
        }
        else {
            // После продажи — восстановим buy ниже
            const step = this.stepTicks * this.instrument.tickSize;
            const price = math_1.RoundingUtils.roundToTick(Math.max(0, fill.price - step), this.instrument.tickSize);
            const qty = math_1.RoundingUtils.roundToStep(fill.quantity, this.instrument.stepSize);
            if (math_1.RoundingUtils.validateNotional(price, qty, this.instrument.minNotional)) {
                await this.place('buy', price, qty, 0);
            }
        }
    }
    async cancelAll() {
        const tasks = [];
        for (const [, go] of this.activeGrid) {
            if (go.isActive && go.id) {
                tasks.push(this.rest.cancelOrder(this.symbol, go.id, go.clientOrderId).catch(() => { }));
            }
        }
        if (tasks.length)
            await Promise.all(tasks);
        this.activeGrid.clear();
    }
    async place(side, price, quantity, level) {
        try {
            const coid = this.coid(side, level);
            const order = await this.rest.placeOrder(this.symbol, side, 'LIMIT', quantity, price, coid);
            const go = { id: order.id, clientOrderId: order.clientOrderId, side, price, quantity, level, isActive: true };
            this.activeGrid.set(order.clientOrderId || coid, go);
            const notional = price * quantity;
            this.logger.info(`GRID place ${side.toUpperCase()} L${level}: price=${price} qty=${quantity} ($${notional.toFixed(2)})`);
            // Уведомление в Telegram о размещении ордера
            this.emit('orderPlaced', {
                side,
                price,
                quantity,
                level,
                notional
            });
        }
        catch (e) {
            this.logger.error({ err: e }, `GRID place error ${side} @${price}`);
        }
    }
    coid(side, level) {
        return `grid_${side}_${level}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }
}
exports.GridStrategy = GridStrategy;
//# sourceMappingURL=grid.js.map