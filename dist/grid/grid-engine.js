"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GridEngine = void 0;
require("dotenv/config");
const axios_1 = __importDefault(require("axios"));
const mexc_spot_1 = require("../exchange/mexc-spot");
const notifier_1 = require("../telegram/notifier");
class GridEngine {
    client;
    notifier;
    baseUrl;
    cfg;
    running = false;
    state = {};
    constructor(cfg) {
        this.client = new mexc_spot_1.MexcSpotClient();
        this.notifier = new notifier_1.TelegramNotifier();
        this.baseUrl = process.env.MEXC_BASE_URL || 'https://api.mexc.com';
        this.cfg = cfg;
    }
    async book() {
        const url = `${this.baseUrl}/api/v3/ticker/bookTicker`;
        const r = await axios_1.default.get(url, { params: { symbol: this.cfg.symbol } });
        return { bid: parseFloat(r.data.bidPrice), ask: parseFloat(r.data.askPrice) };
    }
    async placeGridOnce() {
        const { bid, ask } = await this.book();
        const center = (bid + ask) / 2;
        const step = this.cfg.stepUsd;
        // округления по точности символа
        const exInfo = await axios_1.default.get(`${this.baseUrl}/api/v3/exchangeInfo`);
        const s = (exInfo.data.symbols || []).find((x) => x.symbol === this.cfg.symbol);
        const pricePrecision = parseInt(String(s?.quotePrecision ?? 2), 10);
        const baseStepStr = s?.baseSizePrecision || '0.000001';
        const baseStepDigits = (baseStepStr.split('.')[1] || '').length;
        const baseStep = parseFloat(baseStepStr);
        // расчёт qty от targetNotional
        let qty = this.cfg.targetNotional / center;
        qty = parseFloat(Math.max(qty, baseStep).toFixed(baseStepDigits));
        const buyPrice = parseFloat((center - step / 2).toFixed(pricePrecision));
        const sellPrice = parseFloat((center + step / 2).toFixed(pricePrecision));
        // Разместим лимитные ордера
        await this.client.placeOrder({ symbol: this.cfg.symbol, side: 'BUY', type: 'LIMIT', timeInForce: 'GTC', quantity: qty.toString(), price: buyPrice.toString() });
        await new Promise(resolve => setTimeout(resolve, 1000)); // задержка 1 сек
        await this.client.placeOrder({ symbol: this.cfg.symbol, side: 'SELL', type: 'LIMIT', timeInForce: 'GTC', quantity: qty.toString(), price: sellPrice.toString() });
    }
    async sendSummaryIfDue() {
        const now = Date.now();
        const last = this.state.lastSummaryTs || 0;
        const intervalMs = 10 * 60 * 1000;
        if (now - last < intervalMs)
            return;
        const startTime = now - intervalMs;
        const trades = await this.client.getMyTrades(this.cfg.symbol, { startTime, endTime: now, limit: 100 });
        if (!Array.isArray(trades) || trades.length === 0) {
            this.state.lastSummaryTs = now;
            return;
        }
        let buyQty = 0, sellQty = 0, buyUsd = 0, sellUsd = 0;
        const lines = [];
        for (const t of trades) {
            const isBuy = t.isBuyer === true;
            const price = parseFloat(t.price || t.p || '0');
            const qty = parseFloat(t.qty || t.q || '0');
            const usd = price * qty;
            lines.push(`${isBuy ? 'BUY' : 'SELL'} ${qty} @ ${price}`);
            if (isBuy) {
                buyQty += qty;
                buyUsd += usd;
            }
            else {
                sellQty += qty;
                sellUsd += usd;
            }
        }
        const pnl = sellUsd - buyUsd;
        const text = `⏱️ 10m summary ${this.cfg.symbol}\nTrades: ${trades.length}\n${lines.slice(-10).join('\n')}\nBuy: ${buyQty.toFixed(6)} (${buyUsd.toFixed(2)} USDC)\nSell: ${sellQty.toFixed(6)} (${sellUsd.toFixed(2)} USDC)\n<b>PNL:</b> ${pnl.toFixed(2)} USDC`;
        await this.notifier.sendMessage(text);
        this.state.lastSummaryTs = now;
    }
    async start() {
        if (this.running)
            return;
        this.running = true;
        await new Promise(resolve => setTimeout(resolve, 2000)); // задержка 2 сек перед размещением
        await this.placeGridOnce();
        const recenterMs = Math.max(5, this.cfg.recenterSec) * 1000;
        const loop = async () => {
            if (!this.running)
                return;
            try {
                await this.sendSummaryIfDue();
            }
            catch (e) {
                console.error('summary error:', e?.message || e);
            }
            setTimeout(loop, 3000);
        };
        const recenter = async () => {
            if (!this.running)
                return;
            try {
                // отменим открытые ордера и переставим (упрощенно: отмена всех по символу)
                await this.client.getOpenOrders(this.cfg.symbol).then(async (oo) => {
                    for (const o of oo) {
                        try {
                            await this.client.cancelOrder({ symbol: this.cfg.symbol, orderId: o.orderId || o.id });
                            await new Promise(resolve => setTimeout(resolve, 500)); // задержка 0.5 сек между отменами
                        }
                        catch { }
                    }
                });
                await new Promise(resolve => setTimeout(resolve, 2000)); // задержка 2 сек перед размещением
                await this.placeGridOnce();
            }
            catch (e) {
                console.error('recenter error:', e?.message || e);
            }
            setTimeout(recenter, recenterMs);
        };
        loop();
        recenter();
    }
    stop() {
        this.running = false;
    }
}
exports.GridEngine = GridEngine;
//# sourceMappingURL=grid-engine.js.map