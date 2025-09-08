const { MexcWebSocketClient } = require('./dist/exchanges/mexcWebSocket');

console.log('🎯 ФИНАЛЬНЫЙ ТЕСТ ИСПРАВЛЕННОГО WEBSOCKET КЛИЕНТА');

const ws = new MexcWebSocketClient('ETHUSDT');
let orderBookCount = 0;
let tradeCount = 0;

ws.on('connected', () => {
    console.log('✅ WebSocket подключен');
});

ws.on('orderbook', (orderbook) => {
    orderBookCount++;
    console.log(`📊 OrderBook #${orderBookCount}:`, {
        bid: `${orderbook.bidPrice} (${orderbook.bidQty})`,
        ask: `${orderbook.askPrice} (${orderbook.askQty})`,
        spread: (orderbook.askPrice - orderbook.bidPrice).toFixed(2)
    });
});

ws.on('trade', (trade) => {
    tradeCount++;
    console.log(`📈 Trade #${tradeCount}:`, {
        price: trade.price,
        qty: trade.qty,
        side: trade.side
    });
});

ws.on('error', (error) => {
    console.error('❌ Ошибка:', error.message);
});

// Подключаемся
ws.connect();

// Остановим через 10 секунд
setTimeout(() => {
    console.log('\n🏁 РЕЗУЛЬТАТЫ ТЕСТА:');
    console.log(`   OrderBook обновлений: ${orderBookCount}`);
    console.log(`   Trade обновлений: ${tradeCount}`);
    if (orderBookCount > 0 && tradeCount > 0) {
        console.log('✅ WebSocket работает корректно!');
    } else {
        console.log('❌ Не все данные получены');
    }
    ws.disconnect();
    process.exit(0);
}, 10000);
