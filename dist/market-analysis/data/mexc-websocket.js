"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MexcWebSocketClient = void 0;
const ws_1 = __importDefault(require("ws"));
class MexcWebSocketClient {
    ws = null;
    reconnectAttempts = 0;
    maxReconnectAttempts = 5;
    reconnectInterval = 5000;
    isConnected = false;
    // Callbacks
    onKlineUpdate;
    onTradeUpdate;
    onConnect;
    onDisconnect;
    onError;
    constructor() {
        this.connect();
    }
    connect() {
        try {
            this.ws = new ws_1.default('wss://wbs.mexc.com/ws');
            this.ws.on('open', () => {
                console.log('✅ WebSocket подключен к MEXC');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.onConnect?.();
            });
            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleMessage(message);
                }
                catch (error) {
                    console.error('Ошибка парсинга сообщения:', error);
                }
            });
            this.ws.on('close', () => {
                console.log('❌ WebSocket соединение закрыто');
                this.isConnected = false;
                this.onDisconnect?.();
                this.handleReconnect();
            });
            this.ws.on('error', (error) => {
                console.error('❌ WebSocket ошибка:', error);
                this.onError?.(error);
            });
        }
        catch (error) {
            console.error('Ошибка подключения WebSocket:', error);
            this.handleReconnect();
        }
    }
    handleMessage(message) {
        if (message.c === 'spot@public.kline.v3.api@BTCUSDT') {
            // Обработка обновлений свечей
            const klineData = {
                symbol: 'BTC/USDT',
                kline: message.d
            };
            this.onKlineUpdate?.(klineData);
        }
        else if (message.c === 'spot@public.deals.v3.api@BTCUSDT') {
            // Обработка сделок
            const tradeData = {
                symbol: 'BTC/USDT',
                price: message.d.p,
                quantity: message.d.q,
                time: message.d.t,
                isBuyerMaker: message.d.T === 2
            };
            this.onTradeUpdate?.(tradeData);
        }
    }
    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Попытка переподключения ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
            setTimeout(() => {
                this.connect();
            }, this.reconnectInterval);
        }
        else {
            console.error('❌ Максимальное количество попыток переподключения достигнуто');
        }
    }
    /**
     * Подписаться на обновления свечей
     */
    subscribeKlines(symbol, interval) {
        if (!this.isConnected || !this.ws) {
            console.error('WebSocket не подключен');
            return;
        }
        const subscribeMessage = {
            method: 'SUBSCRIPTION',
            params: [`spot@public.kline.v3.api@${symbol.replace('/', '')}`]
        };
        this.ws.send(JSON.stringify(subscribeMessage));
        console.log(`📊 Подписка на свечи ${symbol} ${interval}`);
    }
    /**
     * Подписаться на сделки
     */
    subscribeTrades(symbol) {
        if (!this.isConnected || !this.ws) {
            console.error('WebSocket не подключен');
            return;
        }
        const subscribeMessage = {
            method: 'SUBSCRIPTION',
            params: [`spot@public.deals.v3.api@${symbol.replace('/', '')}`]
        };
        this.ws.send(JSON.stringify(subscribeMessage));
        console.log(`💰 Подписка на сделки ${symbol}`);
    }
    // Сеттеры для колбэков
    setOnKlineUpdate(callback) {
        this.onKlineUpdate = callback;
    }
    setOnTradeUpdate(callback) {
        this.onTradeUpdate = callback;
    }
    setOnConnect(callback) {
        this.onConnect = callback;
    }
    setOnDisconnect(callback) {
        this.onDisconnect = callback;
    }
    setOnError(callback) {
        this.onError = callback;
    }
    /**
     * Закрыть соединение
     */
    close() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
    /**
     * Проверить статус подключения
     */
    getConnectionStatus() {
        return this.isConnected;
    }
}
exports.MexcWebSocketClient = MexcWebSocketClient;
//# sourceMappingURL=mexc-websocket.js.map