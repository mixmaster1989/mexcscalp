"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MexcSpotClient = void 0;
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
class MexcSpotClient {
    client;
    apiKey;
    apiSecret;
    constructor(config) {
        const apiKey = process.env.MEXC_API_KEY || '';
        const apiSecret = process.env.MEXC_SECRET_KEY || '';
        this.apiKey = config?.apiKey ?? apiKey;
        this.apiSecret = config?.apiSecret ?? apiSecret;
        if (!this.apiKey || !this.apiSecret) {
            throw new Error('MEXC API credentials are missing. Set MEXC_API_KEY and MEXC_SECRET_KEY in environment.');
        }
        this.client = axios_1.default.create({
            baseURL: config?.baseUrl ?? (process.env.MEXC_BASE_URL || 'https://api.mexc.com'),
            timeout: config?.timeoutMs ?? 15000,
            headers: { 'Content-Type': 'application/json', 'X-MEXC-APIKEY': this.apiKey }
        });
    }
    sign(query) {
        return crypto_1.default.createHmac('sha256', this.apiSecret).update(query).digest('hex');
    }
    buildQuery(params) {
        return Object.keys(params)
            .filter((k) => params[k] !== undefined && params[k] !== null)
            .sort()
            .map((k) => `${k}=${encodeURIComponent(String(params[k]))}`)
            .join('&');
    }
    async signedRequest(method, path, params = {}) {
        const timestamp = Date.now();
        const recvWindow = params.recvWindow ?? Number(process.env.MEXC_RECV_WINDOW || 60000);
        const baseParams = { ...params, timestamp, recvWindow };
        const query = this.buildQuery(baseParams);
        const signature = this.sign(query);
        const url = `${path}?${query}&signature=${signature}`;
        const response = await this.client.request({ method, url });
        return response.data;
    }
    async getAccountInfo() {
        return this.signedRequest('GET', '/api/v3/account');
    }
    async getOpenOrders(symbol) {
        const params = {};
        if (symbol)
            params.symbol = symbol;
        return this.signedRequest('GET', '/api/v3/openOrders', params);
    }
    async placeOrder(params) {
        const payload = {
            symbol: params.symbol,
            side: params.side,
            type: params.type ?? 'MARKET',
            timeInForce: params.timeInForce,
            quantity: params.quantity,
            quoteOrderQty: params.quoteOrderQty,
            price: params.price,
            recvWindow: params.recvWindow
        };
        return this.signedRequest('POST', '/api/v3/order', payload);
    }
    async cancelOrder(params) {
        const payload = {
            symbol: params.symbol,
            orderId: params.orderId,
            origClientOrderId: params.origClientOrderId,
            recvWindow: params.recvWindow
        };
        return this.signedRequest('DELETE', '/api/v3/order', payload);
    }
    async getMyTrades(symbol, options) {
        const params = { symbol };
        if (options?.limit)
            params.limit = options.limit;
        if (options?.startTime)
            params.startTime = options.startTime;
        if (options?.endTime)
            params.endTime = options.endTime;
        return this.signedRequest('GET', '/api/v3/myTrades', params);
    }
    async getPrice(symbol) {
        return this.client.get(`/api/v3/ticker/price?symbol=${symbol}`);
    }
    async getAllPrices() {
        return this.client.get('/api/v3/ticker/price');
    }
    async get24hrTicker(symbol) {
        return this.client.get(`/api/v3/ticker/24hr?symbol=${symbol}`);
    }
}
exports.MexcSpotClient = MexcSpotClient;
//# sourceMappingURL=mexc-spot.js.map