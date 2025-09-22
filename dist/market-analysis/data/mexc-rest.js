"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MexcRestClient = void 0;
const axios_1 = __importDefault(require("axios"));
class MexcRestClient {
    client;
    baseUrl = 'https://api.mexc.com';
    constructor() {
        this.client = axios_1.default.create({
            baseURL: this.baseUrl,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
    /**
     * Получить исторические данные свечей
     */
    async getKlines(symbol, interval, limit = 500) {
        try {
            const response = await this.client.get('/api/v3/klines', {
                params: {
                    symbol: symbol.replace('/', ''),
                    interval,
                    limit,
                },
            });
            return response.data.map((kline) => ({
                openTime: kline[0],
                open: kline[1],
                high: kline[2],
                low: kline[3],
                close: kline[4],
                volume: kline[5],
                closeTime: kline[6],
                quoteAssetVolume: kline[7],
                numberOfTrades: kline[8],
                takerBuyBaseAssetVolume: kline[9],
                takerBuyQuoteAssetVolume: kline[10],
            }));
        }
        catch (error) {
            console.error('Ошибка получения данных свечей:', error);
            throw error;
        }
    }
    /**
     * Получить текущую цену и статистику
     */
    async getTicker(symbol) {
        try {
            const response = await this.client.get('/api/v3/ticker/24hr', {
                params: {
                    symbol: symbol.replace('/', ''),
                },
            });
            return response.data;
        }
        catch (error) {
            console.error('Ошибка получения тикера:', error);
            throw error;
        }
    }
    /**
     * Получить стакан заявок
     */
    async getOrderBook(symbol, limit = 100) {
        try {
            const response = await this.client.get('/api/v3/depth', {
                params: {
                    symbol: symbol.replace('/', ''),
                    limit,
                },
            });
            return {
                symbol,
                bids: response.data.bids,
                asks: response.data.asks,
                timestamp: Date.now(),
            };
        }
        catch (error) {
            console.error('Ошибка получения стакана заявок:', error);
            throw error;
        }
    }
    /**
     * Получить информацию о торговых парах
     */
    async getExchangeInfo() {
        try {
            const response = await this.client.get('/api/v3/exchangeInfo');
            return response.data;
        }
        catch (error) {
            console.error('Ошибка получения информации о бирже:', error);
            throw error;
        }
    }
}
exports.MexcRestClient = MexcRestClient;
//# sourceMappingURL=mexc-rest.js.map