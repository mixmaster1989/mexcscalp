"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const mexc_spot_1 = require("../exchange/mexc-spot");
async function main() {
    const symbol = process.env.SYMBOL || 'ETHUSDC';
    const minutes = parseInt(process.env.ANALYZE_MINUTES || '60', 10);
    const now = Date.now();
    const startTime = now - minutes * 60 * 1000;
    const client = new mexc_spot_1.MexcSpotClient();
    const trades = await client.getMyTrades(symbol, { startTime, endTime: now, limit: 500 });
    console.log(`Symbol=${symbol} window=${minutes}m trades=${Array.isArray(trades) ? trades.length : 0}`);
    if (!Array.isArray(trades) || trades.length === 0)
        return;
    let buyQty = 0, sellQty = 0, buyUsd = 0, sellUsd = 0;
    for (const t of trades) {
        const isBuy = t.isBuyer === true;
        const price = parseFloat(t.price || t.p || '0');
        const qty = parseFloat(t.qty || t.q || '0');
        const usd = price * qty;
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
    console.log(`BuyQty=${buyQty.toFixed(6)} BuyUSD=${buyUsd.toFixed(2)} SellQty=${sellQty.toFixed(6)} SellUSD=${sellUsd.toFixed(2)} PNL=${pnl.toFixed(2)} USDC`);
}
if (require.main === module) {
    main().catch(err => { console.error('Error:', err?.response?.data || err?.message || err); process.exit(1); });
}
//# sourceMappingURL=analyze-trades.js.map