const { MexcWebSocketClient } = require('./dist/exchanges/mexcWebSocket');

console.log('🎯 ТЕСТ ТОЛЬКО WEBSOCKET БЕЗ REST API');

const ws = new MexcWebSocketClient('ETHUSDT');
let orderBookCount = 0;
let tradeCount = 0;

ws.on('connected', () => {
    console.log('✅ WebSocket подключен к MEXC');
});

ws.on('orderbook', (orderbook) => {
    orderBookCount++;
    if (orderBookCount <= 5) { // Показываем только первые 5
        console.log(`📊 OrderBook #${orderBookCount}:`, {
            bid: `${orderbook.bidPrice} (${orderbook.bidQty})`,
            ask: `${orderbook.askPrice} (${orderbook.askQty})`,
            spread: (orderbook.askPrice - orderbook.bidPrice).toFixed(2)
        });
    }
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

ws.on('disconnected', () => {
    console.log('🔌 WebSocket отключен');
});

// Подключаемся
console.log('🔄 Подключаемся к WebSocket...');
ws.connect();

// Остановим через 15 секунд
setTimeout(() => {
    console.log('\n🏁 РЕЗУЛЬТАТЫ ТЕСТА:');
    console.log(`   OrderBook обновлений: ${orderBookCount}`);
    console.log(`   Trade обновлений: ${tradeCount}`);
    if (orderBookCount > 0) {
        console.log('✅ WebSocket работает корректно!');
        console.log('🎉 Пинг-понг скальпер готов к работе!');
    } else {
        console.log('❌ WebSocket не получает данные');
    }
    ws.disconnect();
    process.exit(0);
}, 15000);
