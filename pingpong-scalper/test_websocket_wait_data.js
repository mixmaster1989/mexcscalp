const WebSocket = require('ws');

console.log('🔍 ТЕСТ ОЖИДАНИЯ РЕАЛЬНЫХ ДАННЫХ');

const wsUrl = 'wss://wbs-api.mexc.com/ws';
const ws = new WebSocket(wsUrl);

let ackReceived = false;
let dataCount = 0;

ws.on('open', () => {
    console.log('✅ Подключились к WebSocket');
    
    // Подписываемся на bookTicker для ETHUSDT
    const sub = {
        method: 'SUBSCRIPTION',
        params: ['spot@public.aggre.bookTicker.v3.api.pb@100ms@ETHUSDT']
    };
    ws.send(JSON.stringify(sub));
    console.log('📡 Отправили подписку на bookTicker ETHUSDT');
});

ws.on('message', (data) => {
    try {
        // Проверяем, JSON ли это (ACK сообщения)
        if (typeof data === 'string' || data instanceof String) {
            const ack = JSON.parse(String(data));
            console.log('📨 ACK сообщение:', ack);
            if (!ackReceived && ack.code === 0) {
                ackReceived = true;
                console.log('✅ Подписка подтверждена, ожидаем данные...');
            }
            return;
        }

        // Это бинарные данные - реальные market data
        const buffer = data;
        dataCount++;
        console.log(`📊 ПОЛУЧЕНЫ РЫНОЧНЫЕ ДАННЫЕ #${dataCount}:`);
        console.log(`   Размер: ${buffer.length} байт`);
        console.log(`   Hex: ${buffer.toString('hex').substring(0, 60)}...`);
        console.log(`   UTF8: ${buffer.toString('utf8', 0, Math.min(60, buffer.length))}...`);
        
        // Парсим формат MEXC
        if (buffer.length >= 4) {
            const channelLength = buffer.readUInt32LE(0);
            if (buffer.length >= 4 + channelLength) {
                const channel = buffer.toString('utf8', 4, 4 + channelLength);
                const protobufData = buffer.slice(4 + channelLength);
                
                console.log(`   Канал: ${channel}`);
                console.log(`   Данные: ${protobufData.length} байт`);
                
                // Ищем цены в protobuf данных
                const dataStr = protobufData.toString('utf8');
                const prices = dataStr.match(/\d+\.\d+/g);
                if (prices) {
                    console.log(`   Цены найдены: ${prices.slice(0, 4).join(', ')}`);
                }
            }
        }
        
        if (dataCount >= 3) {
            console.log('🎉 Получили достаточно данных, завершаем тест');
            ws.close();
        }
    } catch (error) {
        console.error('❌ Ошибка обработки сообщения:', error);
    }
});

ws.on('error', (error) => {
    console.error('❌ WebSocket ошибка:', error.message);
});

ws.on('close', () => {
    console.log('🔌 WebSocket закрыт');
    process.exit(0);
});

// Таймаут на 30 секунд
setTimeout(() => {
    console.log('⏰ Таймаут! Закрываем соединение...');
    if (dataCount === 0) {
        console.log('❌ Данные не были получены');
    }
    ws.close();
}, 30000);
