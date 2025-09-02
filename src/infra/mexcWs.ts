import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { Orderbook, Trade, Tick } from '../core/types';

/**
 * События WebSocket клиента
 */
export interface MexcWsEvents {
  'connected': () => void;
  'disconnected': () => void;
  'error': (error: Error) => void;
  'tick': (tick: Tick) => void;
  'trade': (trade: Trade) => void;
  'orderbook': (orderbook: Orderbook) => void;
  'bookTicker': (data: { symbol: string; bidPrice: number; bidQty: number; askPrice: number; askQty: number }) => void;
}

/**
 * MEXC WebSocket клиент
 */
export class MexcWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private subscriptions: Set<string> = new Set();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number;
  private reconnectDelay: number;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private heartbeatIntervalMs: number;
  private isConnecting: boolean = false;
  private shouldReconnect: boolean = true;

  constructor(
    wsUrl: string = 'wss://wbs.mexc.com/ws',
    maxReconnectAttempts: number = 10,
    reconnectDelay: number = 5000,
    heartbeatIntervalMs: number = 30000
  ) {
    super();
    this.wsUrl = wsUrl;
    this.maxReconnectAttempts = maxReconnectAttempts;
    this.reconnectDelay = reconnectDelay;
    this.heartbeatIntervalMs = heartbeatIntervalMs;
  }

  /**
   * Подключиться к WebSocket
   */
  async connect(): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.on('open', () => {
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.resubscribe();
          this.emit('connected');
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            this.handleMessage(data.toString());
          } catch (error) {
            this.emit('error', new Error(`Ошибка обработки сообщения: ${error}`));
          }
        });

        this.ws.on('close', (code: number, reason: string) => {
          this.isConnecting = false;
          this.stopHeartbeat();
          this.emit('disconnected');
          
          if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            setTimeout(() => this.reconnect(), this.reconnectDelay);
          }
        });

        this.ws.on('error', (error: Error) => {
          this.isConnecting = false;
          this.emit('error', error);
          reject(error);
        });

        this.ws.on('pong', () => {
          // Получен ответ на ping
        });

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Отключиться от WebSocket
   */
  disconnect(): void {
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
  private async reconnect(): Promise<void> {
    this.reconnectAttempts++;
    
    try {
      await this.connect();
    } catch (error) {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(() => this.reconnect(), this.reconnectDelay);
      } else {
        this.emit('error', new Error('Превышено максимальное количество попыток переподключения'));
      }
    }
  }

  /**
   * Запустить heartbeat
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, this.heartbeatIntervalMs);
  }

  /**
   * Остановить heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Переподписаться на все потоки после переподключения
   */
  private resubscribe(): void {
    for (const subscription of this.subscriptions) {
      this.sendMessage(subscription);
    }
  }

  /**
   * Отправить сообщение в WebSocket
   */
  private sendMessage(message: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    }
  }

  /**
   * Обработать входящее сообщение
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      // Обработка различных типов сообщений
      if (message.stream && message.data) {
        const stream = message.stream;
        const streamData = message.data;

        if (stream.includes('@ticker')) {
          this.handleTickerData(streamData);
        } else if (stream.includes('@trade')) {
          this.handleTradeData(streamData, stream);
        } else if (stream.includes('@depth')) {
          this.handleDepthData(streamData, stream);
        } else if (stream.includes('@bookTicker')) {
          this.handleBookTickerData(streamData);
        }
      }
    } catch (error) {
      this.emit('error', new Error(`Ошибка парсинга сообщения: ${error}`));
    }
  }

  /**
   * Обработать данные тикера
   */
  private handleTickerData(data: any): void {
    const tick: Tick = {
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
  private handleTradeData(data: any, stream: string): void {
    const symbol = stream.split('@')[0].toUpperCase();
    
    const trade: Trade = {
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
  private handleDepthData(data: any, stream: string): void {
    const symbol = stream.split('@')[0].toUpperCase();
    
    const orderbook: Orderbook = {
      symbol: symbol,
      bids: data.b.map((level: any) => ({
        price: parseFloat(level[0]),
        quantity: parseFloat(level[1])
      })),
      asks: data.a.map((level: any) => ({
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
  private handleBookTickerData(data: any): void {
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
  subscribeTicker(symbol: string): void {
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
  subscribeTrades(symbol: string): void {
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
  subscribeOrderbook(symbol: string, levels: number = 20): void {
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
  subscribeBookTicker(symbol: string): void {
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
  unsubscribe(symbol: string, streamType: string): void {
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
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Получить количество активных подписок
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }
} 