"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MexcWebSocketClient = void 0;
const ws_1 = __importDefault(require("ws"));
const events_1 = require("events");
/**
 * MEXC WebSocket клиент
 */
class MexcWebSocketClient extends events_1.EventEmitter {
    ws = null;
    wsUrl;
    subscriptions = new Set();
    reconnectAttempts = 0;
    maxReconnectAttempts;
    reconnectDelay;
    heartbeatInterval = null;
    heartbeatIntervalMs;
    isConnecting = false;
    shouldReconnect = true;
    constructor(wsUrl = 'wss://wbs.mexc.com/ws', maxReconnectAttempts = 10, reconnectDelay = 5000, heartbeatIntervalMs = 30000) {
        super();
        this.wsUrl = wsUrl;
        this.maxReconnectAttempts = maxReconnectAttempts;
        this.reconnectDelay = reconnectDelay;
        this.heartbeatIntervalMs = heartbeatIntervalMs;
    }
    /**
     * Подключиться к WebSocket
     */
    async connect() {
        if (this.isConnecting || (this.ws && this.ws.readyState === ws_1.default.OPEN)) {
            return;
        }
        this.isConnecting = true;
        return new Promise((resolve, reject) => {
            try {
                this.ws = new ws_1.default(this.wsUrl);
                this.ws.on('open', () => {
                    this.isConnecting = false;
                    this.reconnectAttempts = 0;
                    this.startHeartbeat();
                    this.resubscribe();
                    this.emit('connected');
                    resolve();
                });
                this.ws.on('message', (data) => {
                    try {
                        this.handleMessage(data.toString());
                    }
                    catch (error) {
                        this.emit('error', new Error(`Ошибка обработки сообщения: ${error}`));
                    }
                });
                this.ws.on('close', (code, reason) => {
                    this.isConnecting = false;
                    this.stopHeartbeat();
                    this.emit('disconnected');
                    if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                        setTimeout(() => this.reconnect(), this.reconnectDelay);
                    }
                });
                this.ws.on('error', (error) => {
                    this.isConnecting = false;
                    this.emit('error', error);
                    reject(error);
                });
                this.ws.on('pong', () => {
                    // Получен ответ на ping
                });
            }
            catch (error) {
                this.isConnecting = false;
                reject(error);
            }
        });
    }
    /**
     * Отключиться от WebSocket
     */
    disconnect() {
        this.shouldReconnect = false;
        this.stopHeartbeat();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
    /**
     * Переподключиться
     */
    async reconnect() {
        this.reconnectAttempts++;
        try {
            await this.connect();
        }
        catch (error) {
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                setTimeout(() => this.reconnect(), this.reconnectDelay);
            }
            else {
                this.emit('error', new Error('Превышено максимальное количество попыток переподключения'));
            }
        }
    }
    /**
     * Запустить heartbeat
     */
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === ws_1.default.OPEN) {
                this.ws.ping();
            }
        }, this.heartbeatIntervalMs);
    }
    /**
     * Остановить heartbeat
     */
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    /**
     * Переподписаться на все потоки после переподключения
     */
    resubscribe() {
        for (const subscription of this.subscriptions) {
            this.sendMessage(subscription);
        }
    }
    /**
     * Отправить сообщение в WebSocket
     */
    sendMessage(message) {
        if (this.ws && this.ws.readyState === ws_1.default.OPEN) {
            this.ws.send(message);
        }
    }
    /**
     * Обработать входящее сообщение
     */
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            // Обработка различных типов сообщений
            if (message.stream && message.data) {
                const stream = message.stream;
                const streamData = message.data;
                if (stream.includes('@ticker')) {
                    this.handleTickerData(streamData);
                }
                else if (stream.includes('@trade')) {
                    this.handleTradeData(streamData, stream);
                }
                else if (stream.includes('@depth')) {
                    this.handleDepthData(streamData, stream);
                }
                else if (stream.includes('@bookTicker')) {
                    this.handleBookTickerData(streamData);
                }
            }
        }
        catch (error) {
            this.emit('error', new Error(`Ошибка парсинга сообщения: ${error}`));
        }
    }
    /**
     * Обработать данные тикера
     */
    handleTickerData(data) {
        const tick = {
            symbol: data.s,
            price: parseFloat(data.c),
            quantity: parseFloat(data.v),
            side: parseFloat(data.c) > parseFloat(data.o) ? 'buy' : 'sell',
            timestamp: data.E
        };
        this.emit('tick', tick);
    }
    /**
     * Обработать данные сделок
     */
    handleTradeData(data, stream) {
        const symbol = stream.split('@')[0].toUpperCase();
        const trade = {
            id: data.t.toString(),
            symbol: symbol,
            price: parseFloat(data.p),
            quantity: parseFloat(data.q),
            side: data.m ? 'sell' : 'buy', // m = true означает, что покупатель является market maker
            timestamp: data.T,
            buyer: !data.m
        };
        this.emit('trade', trade);
    }
    /**
     * Обработать данные стакана
     */
    handleDepthData(data, stream) {
        const symbol = stream.split('@')[0].toUpperCase();
        const orderbook = {
            symbol: symbol,
            bids: data.b.map((level) => ({
                price: parseFloat(level[0]),
                quantity: parseFloat(level[1])
            })),
            asks: data.a.map((level) => ({
                price: parseFloat(level[0]),
                quantity: parseFloat(level[1])
            })),
            timestamp: Date.now(),
            lastUpdateId: data.u
        };
        this.emit('orderbook', orderbook);
    }
    /**
     * Обработать данные лучших цен
     */
    handleBookTickerData(data) {
        const bookTicker = {
            symbol: data.s,
            bidPrice: parseFloat(data.b),
            bidQty: parseFloat(data.B),
            askPrice: parseFloat(data.a),
            askQty: parseFloat(data.A)
        };
        this.emit('bookTicker', bookTicker);
    }
    /**
     * Подписаться на тикер символа
     */
    subscribeTicker(symbol) {
        const stream = `${symbol.toLowerCase()}@ticker`;
        const subscription = JSON.stringify({
            method: 'SUBSCRIBE',
            params: [stream],
            id: Date.now()
        });
        this.subscriptions.add(subscription);
        this.sendMessage(subscription);
    }
    /**
     * Подписаться на сделки символа
     */
    subscribeTrades(symbol) {
        const stream = `${symbol.toLowerCase()}@trade`;
        const subscription = JSON.stringify({
            method: 'SUBSCRIBE',
            params: [stream],
            id: Date.now()
        });
        this.subscriptions.add(subscription);
        this.sendMessage(subscription);
    }
    /**
     * Подписаться на стакан символа
     */
    subscribeOrderbook(symbol, levels = 20) {
        const stream = `${symbol.toLowerCase()}@depth${levels}`;
        const subscription = JSON.stringify({
            method: 'SUBSCRIBE',
            params: [stream],
            id: Date.now()
        });
        this.subscriptions.add(subscription);
        this.sendMessage(subscription);
    }
    /**
     * Подписаться на лучшие цены символа
     */
    subscribeBookTicker(symbol) {
        const stream = `${symbol.toLowerCase()}@bookTicker`;
        const subscription = JSON.stringify({
            method: 'SUBSCRIBE',
            params: [stream],
            id: Date.now()
        });
        this.subscriptions.add(subscription);
        this.sendMessage(subscription);
    }
    /**
     * Отписаться от потока
     */
    unsubscribe(symbol, streamType) {
        const stream = `${symbol.toLowerCase()}@${streamType}`;
        const unsubscription = JSON.stringify({
            method: 'UNSUBSCRIBE',
            params: [stream],
            id: Date.now()
        });
        // Удаляем из подписок
        for (const subscription of this.subscriptions) {
            if (subscription.includes(stream)) {
                this.subscriptions.delete(subscription);
                break;
            }
        }
        this.sendMessage(unsubscription);
    }
    /**
     * Получить статус подключения
     */
    isConnected() {
        return this.ws !== null && this.ws.readyState === ws_1.default.OPEN;
    }
    /**
     * Получить количество активных подписок
     */
    getSubscriptionCount() {
        return this.subscriptions.size;
    }
}
exports.MexcWebSocketClient = MexcWebSocketClient;
//# sourceMappingURL=mexcWs.js.map