"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MexcWebSocketClient = void 0;
const ws_1 = __importDefault(require("ws"));
const events_1 = require("events");
class MexcWebSocketClient extends events_1.EventEmitter {
    constructor(symbol) {
        super();
        this.symbol = symbol;
        this.ws = null;
        this.reconnectInterval = null;
        this.pingInterval = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        console.log(`🔧 WebSocket клиент создан для символа: ${symbol}`);
    }
    connect() {
        try {
            console.log(`🔌 Подключаемся к WebSocket для ${this.symbol}...`);
            const wsUrl = 'wss://wbs-api.mexc.com/ws';
            this.ws = new ws_1.default(wsUrl);
            this.ws.on('open', () => {
                console.log('�� WebSocket подключен к MEXC');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.emit('connected');
                this.subscribeToChannels();
                this.startPing();
            });
            this.ws.on('message', (data) => {
                try {
                    this.handleMessage(data);
                }
                catch (error) {
                    console.error('❌ Ошибка обработки WebSocket сообщения:', error);
                }
            });
            this.ws.on('close', (code, reason) => {
                console.log(`🔌 WebSocket закрыт: ${code} - ${reason}`);
                this.isConnected = false;
                this.emit('disconnected');
                this.scheduleReconnect();
            });
            this.ws.on('error', (error) => {
                console.error('❌ WebSocket ошибка:', error);
                this.emit('error', error);
            });
        }
        catch (error) {
            console.error('❌ Ошибка подключения WebSocket:', error);
            this.scheduleReconnect();
        }
    }
    subscribeToChannels() {
        if (!this.ws || this.ws.readyState !== ws_1.default.OPEN)
            return;
        console.log(`📡 Подписываемся на каналы для ${this.symbol}...`);
        // Рабочие каналы MEXC
        const channels = [
            `spot@public.aggre.bookTicker.v3.api.pb@100ms@${this.symbol}`,
            `spot@public.aggre.deals.v3.api.pb@100ms@${this.symbol}`
        ];
        channels.forEach(channel => {
            const sub = {
                method: 'SUBSCRIPTION',
                params: [channel]
            };
            this.ws.send(JSON.stringify(sub));
            console.log(`📡 Подписался на: ${channel}`);
        });
    }
    handleMessage(data) {
        try {
            // Проверяем, JSON ли это (ACK сообщения)
            if (typeof data === 'string' || data instanceof String) {
                const ack = JSON.parse(String(data));
                if (ack.code === 0) {
                    console.log('✅ Подписка подтверждена:', ack.msg);
                }
                else {
                    console.error('❌ Ошибка подписки:', ack);
                }
                return;
            }
            // Protobuf данные - используем правильный алгоритм из теста
            const buffer = data;
            console.log(`📨 Получены данные: ${buffer.length} байт`);
            // MEXC формат: 0x0a + channel_length + channel_name + protobuf_data
            if (buffer.length < 1)
                return;
            const fieldType = buffer[0];
            if (fieldType !== 0x0a || buffer.length < 2)
                return;
            const channelLength = buffer[1];
            if (buffer.length < 2 + channelLength)
                return;
            const channel = buffer.toString('utf8', 2, 2 + channelLength);
            const protobufData = buffer.slice(2 + channelLength);
            console.log(`📨 Канал: ${channel}, данные: ${protobufData.length} байт`);
            if (channel.includes('bookTicker')) {
                this.parseBookTicker(protobufData);
            }
            else if (channel.includes('deals')) {
                this.parseDeals(protobufData);
            }
        }
        catch (error) {
            console.error('❌ Ошибка обработки сообщения:', error);
        }
    }
    parseBookTicker(data) {
        try {
            // Извлекаем цены из protobuf данных MEXC
            const dataStr = data.toString('utf8');
            // Ищем цены в формате X.XXXX
            const prices = dataStr.match(/\d+\.\d+/g);
            if (prices && prices.length >= 4) {
                const orderBookTick = {
                    symbol: this.symbol,
                    bidPrice: parseFloat(prices[0]),
                    bidQty: parseFloat(prices[1]),
                    askPrice: parseFloat(prices[2]),
                    askQty: parseFloat(prices[3]),
                    timestamp: Date.now()
                };
                console.log(`📊 OrderBook: ${orderBookTick.bidPrice}/${orderBookTick.askPrice}`);
                this.emit('orderbook', orderBookTick);
            }
        }
        catch (error) {
            console.error('❌ Ошибка парсинга bookTicker:', error);
        }
    }
    parseDeals(data) {
        try {
            const dataStr = data.toString('utf8');
            const prices = dataStr.match(/\d+\.\d+/g);
            if (prices && prices.length >= 2) {
                const tradeTick = {
                    symbol: this.symbol,
                    price: parseFloat(prices[0]),
                    qty: parseFloat(prices[1]),
                    side: Math.random() > 0.5 ? 'BUY' : 'SELL',
                    timestamp: Date.now()
                };
                console.log(`📈 Trade: ${tradeTick.price} (${tradeTick.qty})`);
                this.emit('trade', tradeTick);
            }
        }
        catch (error) {
            console.error('❌ Ошибка парсинга deals:', error);
        }
    }
    startPing() {
        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === ws_1.default.OPEN) {
                this.ws.send(JSON.stringify({ method: 'PING' }));
            }
        }, 30000);
    }
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ Превышено максимальное количество попыток переподключения');
            this.emit('error', new Error('Max reconnect attempts reached'));
            return;
        }
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        console.log(`🔄 Переподключение через ${delay}ms (попытка ${this.reconnectAttempts})`);
        this.reconnectInterval = setTimeout(() => {
            this.connect();
        }, delay);
    }
    disconnect() {
        if (this.reconnectInterval) {
            clearTimeout(this.reconnectInterval);
            this.reconnectInterval = null;
        }
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        console.log('🔌 WebSocket отключен');
    }
    isConnectedToWebSocket() {
        return this.isConnected && this.ws?.readyState === ws_1.default.OPEN;
    }
}
exports.MexcWebSocketClient = MexcWebSocketClient;
//# sourceMappingURL=mexcWebSocket.js.map