const WebSocket = require('ws');

console.log('🔍 ДЕТАЛЬНЫЙ ТЕСТ WEBSOCKET ПАРСИНГА');

const wsUrl = 'wss://wbs-api.mexc.com/ws';
const ws = new WebSocket(wsUrl);

ws.on('open', () => {
    console.log('✅ Подключились к WebSocket');
    
    const sub = {
        method: 'SUBSCRIPTION',
        params: ['spot@public.aggre.bookTicker.v3.api.pb@100ms@ETHUSDT']
    };
    ws.send(JSON.stringify(sub));
    console.log('📡 Отправили подписку на bookTicker ETHUSDT');
});

ws.on('message', (data) => {
    try {
        // JSON ACK сообщения
        if (typeof data === 'string' || data instanceof String) {
            const ack = JSON.parse(String(data));
            console.log('📨 ACK:', ack);
            return;
        }

        // Protobuf данные
        const buffer = data;
        console.log(`\n📊 АНАЛИЗ PROTOBUF ДАННЫХ (${buffer.length} байт):`);
        
        // Показываем первые байты в разных форматах
        console.log(`   Первые 20 байт (hex): ${buffer.toString('hex', 0, 20)}`);
        console.log(`   Первые 20 байт (dec): ${Array.from(buffer.slice(0, 20)).join(' ')}`);
        
        // Парсим по алгоритму MEXC
        if (buffer.length >= 1) {
            // Первый байт - тип поля protobuf (обычно 0x0a для строки)
            const fieldType = buffer[0];
            console.log(`   Field type: 0x${fieldType.toString(16)}`);
            
            if (fieldType === 0x0a && buffer.length >= 2) {
                // Второй байт - длина канала
                const channelLength = buffer[1];
                console.log(`   Channel length: ${channelLength}`);
                
                if (buffer.length >= 2 + channelLength) {
                    const channel = buffer.toString('utf8', 2, 2 + channelLength);
                    console.log(`   Channel: ${channel}`);
                    
                    const protobufData = buffer.slice(2 + channelLength);
                    console.log(`   Market data: ${protobufData.length} байт`);
                    
                    // Анализируем market data
                    if (protobufData.length > 0) {
                        console.log(`   Market data hex: ${protobufData.toString('hex', 0, Math.min(40, protobufData.length))}`);
                        
                        // Ищем символ инструмента
                        const symbolMatch = protobufData.toString('utf8').match(/ETH\w+/);
                        if (symbolMatch) {
                            console.log(`   Symbol found: ${symbolMatch[0]}`);
                        }
                        
                        // Ищем цены (числа с точкой)
                        const dataStr = protobufData.toString('utf8');
                        const prices = dataStr.match(/\d+\.\d+/g);
                        if (prices) {
                            console.log(`   Prices found: ${prices.slice(0, 6).join(', ')}`);
                            
                            if (prices.length >= 4) {
                                console.log(`   📊 PARSED TICKER:`);
                                console.log(`      BID: ${prices[0]} (${prices[1]})`);
                                console.log(`      ASK: ${prices[2]} (${prices[3]})`);
                                console.log(`      SPREAD: ${(parseFloat(prices[2]) - parseFloat(prices[0])).toFixed(2)}`);
                            }
                        }
                    }
                }
            }
        }
        
        // Остановимся после 2 market data пакетов
        if (buffer.length > 80) { // Игнорируем маленькие ACK пакеты
            setTimeout(() => {
                console.log('🛑 Завершаем детальный анализ');
                ws.close();
            }, 2000);
        }
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
    }
});

ws.on('close', () => {
    console.log('🔌 WebSocket закрыт');
    process.exit(0);
});

setTimeout(() => {
    console.log('⏰ Таймаут теста');
    ws.close();
}, 15000);
