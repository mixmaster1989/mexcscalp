import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

export class MexcRestClient {
  private client: AxiosInstance;
  private apiKey: string;
  private secretKey: string;

  constructor(apiKey: string, secretKey: string) {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    
    this.client = axios.create({
      baseURL: 'https://api.mexc.com',
      timeout: 10000,
      headers: {
        'X-MEXC-APIKEY': this.apiKey,
        'Content-Type': 'application/json'
      }
    });
  }

  private generateSignature(params: string): string {
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(params)
      .digest('hex');
  }

  private buildQueryString(params: Record<string, any>): string {
    return Object.keys(params)
      .sort()
      .map(key => `${key}=${(params as any)[key]}`)
      .join('&');
  }

  private parseQueryString(params: Record<string, any>): Record<string, any> {
    const parsed: Record<string, any> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        parsed[key] = value;
      }
    }
    return parsed;
  }

  async getAccountInfo(): Promise<any> {
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

  async placeOrder(
    symbol: string,
    side: string,
    type: string,
    quantity: number,
    price?: number
  ): Promise<any> {
    const timestamp = Date.now();
    const params: Record<string, any> = {
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

  async cancelOrder(symbol: string, orderId: string): Promise<any> {
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

  async cancelAllOpenOrders(symbol: string): Promise<any> {
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

  async getOrder(symbol: string, orderId: string): Promise<any> {
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

  async getOpenOrders(symbol?: string): Promise<any> {
    const timestamp = Date.now();
    const params: Record<string, any> = { timestamp };
    
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

  async getMyTrades(symbol: string, limit?: number): Promise<any> {
    const timestamp = Date.now();
    const params: Record<string, any> = {
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

  async getPrice(symbol: string): Promise<any> {
    const response = await this.client.get('/api/v3/ticker/price', {
      params: { symbol }
    });
    
    return response.data;
  }

  async getBookTicker(symbol: string): Promise<any> {
    const response = await this.client.get('/api/v3/ticker/bookTicker', {
      params: { symbol }
    });
    
    return response.data;
  }

  async ping(): Promise<any> {
    const response = await this.client.get('/api/v3/ping');
    return response.data;
  }

  async getServerTime(): Promise<any> {
    const response = await this.client.get('/api/v3/time');
    return response.data;
  }
}
