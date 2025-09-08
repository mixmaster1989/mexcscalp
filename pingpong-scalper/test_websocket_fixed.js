const { MexcWebSocketClient } = require('./dist/exchanges/mexcWebSocket');

console.log('🧪 ТЕСТ ИСПРАВЛЕННОГО WEBSOCKET КЛИЕНТА');

const ws = new MexcWebSocketClient('ETHUSDT');

ws.on('connected', () => {
    console.log('✅ Подключился к WebSocket');
});

ws.on('orderbook', (orderbook) => {
    console.log('📊 Получен стакан:', {
        bid: `${orderbook.bidPrice} (${orderbook.bidQty})`,
        ask: `${orderbook.askPrice} (${orderbook.askQty})`,
        spread: (orderbook.askPrice - orderbook.bidPrice).toFixed(2)
    });
});

ws.on('trade', (trade) => {
    console.log('📈 Получена сделка:', {
        price: trade.price,
        qty: trade.qty,
        side: trade.side
    });
});

ws.on('error', (error) => {
    console.error('❌ Ошибка WebSocket:', error.message);
});

ws.on('disconnected', () => {
    console.log('🔌 WebSocket отключен');
});

// Подключаемся
ws.connect();

// Остановим через 10 секунд
setTimeout(() => {
    console.log('🛑 Останавливаем тест...');
    ws.disconnect();
    process.exit(0);
}, 10000);
