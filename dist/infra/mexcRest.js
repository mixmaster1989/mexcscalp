"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MexcRestClient = void 0;
const Mexc = __importStar(require("mexc-api-sdk"));
/**
 * MEXC REST API клиент на основе официального SDK
 */
class MexcRestClient {
    client;
    constructor(apiKey, secretKey, baseUrl = 'https://api.mexc.com') {
        this.client = new Mexc.Spot(apiKey, secretKey);
    }
    /**
     * Получить информацию об инструменте
     */
    async getExchangeInfo(symbol) {
        try {
            // Конвертируем ETH/USDC в ETHUSDC для MEXC API
            const mexcSymbol = symbol ? symbol.replace('/', '') : undefined;
            const response = await this.client.exchangeInfo(mexcSymbol ? { symbol: mexcSymbol } : {});
            const symbols = mexcSymbol ?
                response.symbols.filter((s) => s.symbol === mexcSymbol) :
                response.symbols;
            return symbols.map((s) => {
                // MEXC может не возвращать фильтры, используем значения по умолчанию
                const priceFilter = s.filters?.find((f) => f.filterType === 'PRICE_FILTER');
                const lotFilter = s.filters?.find((f) => f.filterType === 'LOT_SIZE');
                const notionalFilter = s.filters?.find((f) => f.filterType === 'MIN_NOTIONAL');
                return {
                    symbol: s.symbol,
                    baseAsset: s.baseAsset,
                    quoteAsset: s.quoteAsset,
                    tickSize: parseFloat(priceFilter?.tickSize || '0.01'), // Дефолт для ETH
                    stepSize: parseFloat(lotFilter?.stepSize || '0.000001'), // Дефолт для ETH
                    minNotional: parseFloat(notionalFilter?.minNotional || '1'), // Минимум 1 USDT
                    maxNotional: parseFloat(notionalFilter?.maxNotional || '1000000'),
                    minQty: parseFloat(lotFilter?.minQty || '0.000001'),
                    maxQty: parseFloat(lotFilter?.maxQty || '1000')
                };
            });
        }
        catch (error) {
            throw new Error(`Ошибка получения информации об инструменте: ${error}`);
        }
    }
    /**
     * Получить информацию об аккаунте
     */
    async getAccountInfo() {
        try {
            const response = await this.client.accountInfo();
            return {
                balances: response.balances.map((b) => ({
                    asset: b.asset,
                    free: parseFloat(b.free),
                    locked: parseFloat(b.locked)
                })),
                canTrade: response.canTrade || true,
                canWithdraw: response.canWithdraw || true,
                canDeposit: response.canDeposit || true,
                updateTime: response.updateTime || Date.now()
            };
        }
        catch (error) {
            throw new Error(`Ошибка получения информации об аккаунте: ${error}`);
        }
    }
    /**
     * Разместить новый ордер
     */
    async placeOrder(symbol, side, type, quantity, price, clientOrderId) {
        try {
            const mexcSymbol = symbol.replace('/', ''); // ETH/USDC -> ETHUSDC
            const options = {
                quantity: quantity.toString()
            };
            if (price !== undefined) {
                options.price = price.toString();
            }
            if (clientOrderId) {
                options.newClientOrderId = clientOrderId;
            }
            // Для лимитных ордеров добавляем timeInForce
            if (type === 'LIMIT') {
                options.timeInForce = 'GTC';
            }
            const response = await this.client.newOrder(mexcSymbol, side.toUpperCase(), type, options);
            return {
                id: response.orderId.toString(),
                clientOrderId: response.clientOrderId || clientOrderId || '',
                symbol: response.symbol,
                side: side,
                type: type,
                price: parseFloat(response.price || '0'),
                quantity: parseFloat(response.origQty || quantity.toString()),
                filled: parseFloat(response.executedQty || '0'),
                status: response.status,
                timestamp: response.transactTime || Date.now(),
                updateTime: response.transactTime || Date.now()
            };
        }
        catch (error) {
            throw new Error(`Ошибка размещения ордера: ${error.message}`);
        }
    }
    /**
     * Отменить ордер
     */
    async cancelOrder(symbol, orderId, clientOrderId) {
        try {
            const mexcSymbol = symbol.replace('/', '');
            const options = {};
            if (orderId) {
                options.orderId = orderId;
            }
            else if (clientOrderId) {
                options.origClientOrderId = clientOrderId;
            }
            else {
                throw new Error('Необходимо указать orderId или clientOrderId');
            }
            const response = await this.client.cancelOrder(mexcSymbol, options);
            return {
                id: response.orderId.toString(),
                clientOrderId: response.clientOrderId || '',
                symbol: response.symbol,
                side: response.side.toLowerCase(),
                type: response.type,
                price: parseFloat(response.price || '0'),
                quantity: parseFloat(response.origQty || '0'),
                filled: parseFloat(response.executedQty || '0'),
                status: response.status,
                timestamp: response.transactTime || Date.now(),
                updateTime: response.transactTime || Date.now()
            };
        }
        catch (error) {
            throw new Error(`Ошибка отмены ордера: ${error.message}`);
        }
    }
    /**
     * Отменить все открытые ордера по символу
     */
    async cancelAllOrders(symbol) {
        try {
            const mexcSymbol = symbol.replace('/', '');
            const response = await this.client.cancelOpenOrders(mexcSymbol);
            return response.map((order) => ({
                id: order.orderId.toString(),
                clientOrderId: order.clientOrderId || '',
                symbol: order.symbol,
                side: order.side.toLowerCase(),
                type: order.type,
                price: parseFloat(order.price || '0'),
                quantity: parseFloat(order.origQty || '0'),
                filled: parseFloat(order.executedQty || '0'),
                status: order.status,
                timestamp: order.time || Date.now(),
                updateTime: order.updateTime || Date.now()
            }));
        }
        catch (error) {
            throw new Error(`Ошибка отмены всех ордеров: ${error.message}`);
        }
    }
    /**
     * Получить статус ордера
     */
    async getOrder(symbol, orderId, clientOrderId) {
        try {
            const mexcSymbol = symbol.replace('/', '');
            const options = {};
            if (orderId) {
                options.orderId = orderId;
            }
            else if (clientOrderId) {
                options.origClientOrderId = clientOrderId;
            }
            else {
                throw new Error('Необходимо указать orderId или clientOrderId');
            }
            const response = await this.client.queryOrder(mexcSymbol, options);
            return {
                id: response.orderId.toString(),
                clientOrderId: response.clientOrderId || '',
                symbol: response.symbol,
                side: response.side.toLowerCase(),
                type: response.type,
                price: parseFloat(response.price || '0'),
                quantity: parseFloat(response.origQty || '0'),
                filled: parseFloat(response.executedQty || '0'),
                status: response.status,
                timestamp: response.time || Date.now(),
                updateTime: response.updateTime || Date.now()
            };
        }
        catch (error) {
            throw new Error(`Ошибка получения ордера: ${error.message}`);
        }
    }
    /**
     * Получить все открытые ордера
     */
    async getOpenOrders(symbol) {
        try {
            const mexcSymbol = symbol ? symbol.replace('/', '') : undefined;
            const response = await this.client.openOrders(mexcSymbol);
            return response.map((order) => ({
                id: order.orderId.toString(),
                clientOrderId: order.clientOrderId || '',
                symbol: order.symbol,
                side: order.side.toLowerCase(),
                type: order.type,
                price: parseFloat(order.price || '0'),
                quantity: parseFloat(order.origQty || '0'),
                filled: parseFloat(order.executedQty || '0'),
                status: order.status,
                timestamp: order.time || Date.now(),
                updateTime: order.updateTime || Date.now()
            }));
        }
        catch (error) {
            throw new Error(`Ошибка получения открытых ордеров: ${error.message}`);
        }
    }
    /**
     * Получить историю сделок
     */
    async getMyTrades(symbol, limit = 100, fromId) {
        try {
            const mexcSymbol = symbol.replace('/', '');
            const options = { limit };
            if (fromId) {
                options.fromId = fromId;
            }
            const response = await this.client.accountTradeList(mexcSymbol, options);
            return response.map((trade) => ({
                id: trade.id.toString(),
                orderId: trade.orderId.toString(),
                clientOrderId: '', // MEXC не возвращает clientOrderId в истории сделок
                symbol: trade.symbol,
                price: parseFloat(trade.price),
                quantity: parseFloat(trade.qty),
                fee: parseFloat(trade.commission),
                side: trade.isBuyer ? 'buy' : 'sell',
                timestamp: trade.time
            }));
        }
        catch (error) {
            throw new Error(`Ошибка получения истории сделок: ${error.message}`);
        }
    }
    /**
     * Получить текущую цену символа
     */
    async getPrice(symbol) {
        try {
            const mexcSymbol = symbol.replace('/', '');
            const response = await this.client.tickerPrice(mexcSymbol);
            return parseFloat(response.price);
        }
        catch (error) {
            throw new Error(`Ошибка получения цены: ${error.message}`);
        }
    }
    /**
     * Получить лучшие цены покупки и продажи
     */
    async getBookTicker(symbol) {
        try {
            const mexcSymbol = symbol.replace('/', '');
            const response = await this.client.bookTicker(mexcSymbol);
            return {
                bidPrice: parseFloat(response.bidPrice),
                bidQty: parseFloat(response.bidQty),
                askPrice: parseFloat(response.askPrice),
                askQty: parseFloat(response.askQty)
            };
        }
        catch (error) {
            throw new Error(`Ошибка получения лучших цен: ${error.message}`);
        }
    }
    /**
     * Проверить соединение с API
     */
    async ping() {
        try {
            await this.client.ping();
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Получить время сервера
     */
    async getServerTime() {
        try {
            const response = await this.client.time();
            return response.serverTime;
        }
        catch (error) {
            throw new Error(`Ошибка получения времени сервера: ${error.message}`);
        }
    }
}
exports.MexcRestClient = MexcRestClient;
//# sourceMappingURL=mexcRest.js.map