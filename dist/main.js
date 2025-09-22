"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
require("dotenv/config");
const mexc_spot_1 = require("./exchange/mexc-spot");
async function main() {
    console.log('🚀 MEXC Spot minimal client (buy/sell/cancel)');
    const client = new mexc_spot_1.MexcSpotClient();
    try {
        const account = await client.getAccountInfo();
        console.log('👤 Account info loaded');
        // Примеры:
        // const buy = await client.placeOrder({ symbol: process.env.SYMBOL || 'ETHUSDC', side: 'BUY', type: 'MARKET', quoteOrderQty: '5' });
        // console.log('🟢 BUY order placed', buy);
        // const sell = await client.placeOrder({ symbol: process.env.SYMBOL || 'ETHUSDC', side: 'SELL', type: 'MARKET', quantity: '0.01' });
        // console.log('🔴 SELL order placed', sell);
        // const cancel = await client.cancelOrder({ symbol: process.env.SYMBOL || 'ETHUSDC', orderId: '123456789' });
        // console.log('✖️ Order canceled', cancel);
        console.log('✅ Minimal client ready. Uncomment examples to execute operations.');
    }
    catch (error) {
        console.error('❌ Error:', error?.message || error);
        process.exit(1);
    }
    process.on('SIGINT', () => {
        console.log('\n🛑 Stopping...');
        process.exit(0);
    });
}
if (require.main === module) {
    main().catch(console.error);
}
//# sourceMappingURL=main.js.map