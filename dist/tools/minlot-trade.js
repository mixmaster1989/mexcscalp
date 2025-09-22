"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const axios_1 = __importDefault(require("axios"));
const mexc_spot_1 = require("../exchange/mexc-spot");
const BASE_URL = process.env.MEXC_BASE_URL || 'https://api.mexc.com';
const SYMBOL = process.env.SYMBOL || 'ETHUSDC';
async function getBookTicker(symbol) {
    const url = `${BASE_URL}/api/v3/ticker/bookTicker`;
    const resp = await axios_1.default.get(url, { params: { symbol } });
    return { bid: parseFloat(resp.data.bidPrice), ask: parseFloat(resp.data.askPrice) };
}
async function getExchangeInfo(symbol) {
    const url = `${BASE_URL}/api/v3/exchangeInfo`;
    const resp = await axios_1.default.get(url);
    const s = (resp.data.symbols || []).find((x) => x.symbol === symbol);
    if (!s)
        throw new Error('Symbol not found in exchangeInfo');
    return s;
}
async function main() {
    console.log(`MinLot trade for ${SYMBOL}`);
    const client = new mexc_spot_1.MexcSpotClient();
    const s = await getExchangeInfo(SYMBOL);
    const baseStepStr = s.baseSizePrecision || '0.000001';
    const baseStepDigits = (baseStepStr.split('.')[1] || '').length;
    const baseStep = parseFloat(baseStepStr);
    const pricePrecision = parseInt(String(s.quotePrecision ?? 2), 10);
    const { bid, ask } = await getBookTicker(SYMBOL);
    console.log('Book:', { bid, ask });
    if (!isFinite(bid) || !isFinite(ask))
        throw new Error('Invalid bookTicker');
    const targetNotional = 1.2; // чуть выше 1 USDC для гарантии прохождения фильтра
    let qty = targetNotional / ask;
    qty = parseFloat(Math.max(qty, baseStep).toFixed(baseStepDigits));
    const buyPrice = parseFloat(ask.toFixed(pricePrecision));
    console.log(`Placing BUY LIMIT qty=${qty} price=${buyPrice}`);
    const buyRes = await client.placeOrder({
        symbol: SYMBOL,
        side: 'BUY',
        type: 'LIMIT',
        quantity: qty.toString(),
        price: buyPrice.toString(),
        timeInForce: 'GTC'
    });
    console.log('BUY result:', buyRes);
    const filledQty = parseFloat((buyRes.executedQty || buyRes.origQty || qty).toString());
    const sellPrice = parseFloat(bid.toFixed(pricePrecision));
    console.log(`Placing SELL LIMIT qty=${filledQty} price=${sellPrice}`);
    const sellRes = await client.placeOrder({
        symbol: SYMBOL,
        side: 'SELL',
        type: 'LIMIT',
        quantity: filledQty.toString(),
        price: sellPrice.toString(),
        timeInForce: 'GTC'
    });
    console.log('SELL result:', sellRes);
}
if (require.main === module) {
    main().catch(err => { console.error('Error:', err?.response?.data || err?.message || err); process.exit(1); });
}
//# sourceMappingURL=minlot-trade.js.map