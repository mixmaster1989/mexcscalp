"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MexcRestClient = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
class MexcRestClient {
    constructor(apiKey, secretKey) {
        this.apiKey = apiKey;
        this.secretKey = secretKey;
        this.client = axios_1.default.create({
            baseURL: 'https://api.mexc.com',
            timeout: 10000,
            headers: {
                'X-MEXC-APIKEY': this.apiKey,
                'Content-Type': 'application/json'
            }
        });
    }
    generateSignature(params) {
        return crypto_1.default
            .createHmac('sha256', this.secretKey)
            .update(params)
            .digest('hex');
    }
    buildQueryString(params) {
        return Object.keys(params)
            .sort()
            .map(key => `${key}=${params[key]}`)
            .join('&');
    }
    parseQueryString(params) {
        const parsed = {};
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null) {
                parsed[key] = value;
            }
        }
        return parsed;
    }
    async getAccountInfo() {
        const timestamp = Date.now();
        const params = { timestamp };
        const queryString = this.buildQueryString(params);
        const signature = this.generateSignature(queryString);
        const parsedParams = this.parseQueryString(params);
        const response = await this.client.get('/api/v3/account', {
            params: { ...parsedParams, signature }
        });
        return response.data;
    }
    async placeOrder(symbol, side, type, quantity, price) {
        const timestamp = Date.now();
        const params = {
            symbol,
            side,
            type,
            quantity,
            timestamp
        };
        if (price !== undefined) {
            params.price = price;
        }
        const queryString = this.buildQueryString(params);
        const signature = this.generateSignature(queryString);
        const parsedParams = this.parseQueryString(params);
        const response = await this.client.post('/api/v3/order', null, {
            params: { ...parsedParams, signature }
        });
        return response.data;
    }
    async cancelOrder(symbol, orderId) {
        const timestamp = Date.now();
        const params = {
            symbol,
            orderId,
            timestamp
        };
        const queryString = this.buildQueryString(params);
        const signature = this.generateSignature(queryString);
        const parsedParams = this.parseQueryString(params);
        const response = await this.client.delete('/api/v3/order', {
            params: { ...parsedParams, signature }
        });
        return response.data;
    }
    async cancelAllOpenOrders(symbol) {
        const timestamp = Date.now();
        const params = {
            symbol,
            timestamp
        };
        const queryString = this.buildQueryString(params);
        const signature = this.generateSignature(queryString);
        const parsedParams = this.parseQueryString(params);
        const response = await this.client.delete('/api/v3/openOrders', {
            params: { ...parsedParams, signature }
        });
        return response.data;
    }
    async getOrder(symbol, orderId) {
        const timestamp = Date.now();
        const params = {
            symbol,
            orderId,
            timestamp
        };
        const queryString = this.buildQueryString(params);
        const signature = this.generateSignature(queryString);
        const parsedParams = this.parseQueryString(params);
        const response = await this.client.get('/api/v3/order', {
            params: { ...parsedParams, signature }
        });
        return response.data;
    }
    async getOpenOrders(symbol) {
        const timestamp = Date.now();
        const params = { timestamp };
        if (symbol) {
            params.symbol = symbol;
        }
        const queryString = this.buildQueryString(params);
        const signature = this.generateSignature(queryString);
        const parsedParams = this.parseQueryString(params);
        const response = await this.client.get('/api/v3/openOrders', {
            params: { ...parsedParams, signature }
        });
        return response.data;
    }
    async getMyTrades(symbol, limit) {
        const timestamp = Date.now();
        const params = {
            symbol,
            timestamp
        };
        if (limit) {
            params.limit = limit;
        }
        const queryString = this.buildQueryString(params);
        const signature = this.generateSignature(queryString);
        const parsedParams = this.parseQueryString(params);
        const response = await this.client.get('/api/v3/myTrades', {
            params: { ...parsedParams, signature }
        });
        return response.data;
    }
    async getPrice(symbol) {
        const response = await this.client.get('/api/v3/ticker/price', {
            params: { symbol }
        });
        return response.data;
    }
    async getBookTicker(symbol) {
        const response = await this.client.get('/api/v3/ticker/bookTicker', {
            params: { symbol }
        });
        return response.data;
    }
    async ping() {
        const response = await this.client.get('/api/v3/ping');
        return response.data;
    }
    async getServerTime() {
        const response = await this.client.get('/api/v3/time');
        return response.data;
    }
}
exports.MexcRestClient = MexcRestClient;
//# sourceMappingURL=mexcRest.js.map