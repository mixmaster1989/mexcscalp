import * as Mexc from 'mexc-api-sdk';
import { Order, OrderStatus, OrderType, Side, Instrument, AccountInfo, Fill } from '../core/types';

/**
 * MEXC REST API клиент на основе официального SDK
 */
export class MexcRestClient {
  private client: any;

  constructor(apiKey: string, secretKey: string, baseUrl: string = 'https://api.mexc.com') {
    this.client = new Mexc.Spot(apiKey, secretKey);
  }

  /**
   * Получить информацию об инструменте
   */
  async getExchangeInfo(symbol?: string): Promise<Instrument[]> {
    try {
      // Конвертируем ETH/USDC в ETHUSDC для MEXC API
      const mexcSymbol = symbol ? symbol.replace('/', '') : undefined;
      const response = await this.client.exchangeInfo(mexcSymbol ? { symbol: mexcSymbol } : {});

      const symbols = mexcSymbol ? 
        response.symbols.filter((s: any) => s.symbol === mexcSymbol) : 
        response.symbols;

      return symbols.map((s: any) => {
        // MEXC может не возвращать фильтры, используем значения по умолчанию
        const priceFilter = s.filters?.find((f: any) => f.filterType === 'PRICE_FILTER');
        const lotFilter = s.filters?.find((f: any) => f.filterType === 'LOT_SIZE');
        const notionalFilter = s.filters?.find((f: any) => f.filterType === 'MIN_NOTIONAL');
        
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
    } catch (error) {
      throw new Error(`Ошибка получения информации об инструменте: ${error}`);
    }
  }

  /**
   * Получить информацию об аккаунте
   */
  async getAccountInfo(): Promise<AccountInfo> {
    try {
      const response = await this.client.accountInfo();
      
      return {
        balances: response.balances.map((b: any) => ({
          asset: b.asset,
          free: parseFloat(b.free),
          locked: parseFloat(b.locked)
        })),
        canTrade: response.canTrade || true,
        canWithdraw: response.canWithdraw || true,
        canDeposit: response.canDeposit || true,
        updateTime: response.updateTime || Date.now()
      };
    } catch (error) {
      throw new Error(`Ошибка получения информации об аккаунте: ${error}`);
    }
  }

  /**
   * Разместить новый ордер
   */
  async placeOrder(
    symbol: string,
    side: Side,
    type: OrderType,
    quantity: number,
    price?: number,
    clientOrderId?: string
  ): Promise<Order> {
    try {
      const mexcSymbol = symbol.replace('/', ''); // ETH/USDC -> ETHUSDC
      
      const options: any = {
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

      const response = await this.client.newOrder(
        mexcSymbol,
        side.toUpperCase(),
        type,
        options
      );

      return {
        id: response.orderId.toString(),
        clientOrderId: response.clientOrderId || clientOrderId || '',
        symbol: response.symbol,
        side: side,
        type: type,
        price: parseFloat(response.price || '0'),
        quantity: parseFloat(response.origQty || quantity.toString()),
        filled: parseFloat(response.executedQty || '0'),
        status: response.status as OrderStatus,
        timestamp: response.transactTime || Date.now(),
        updateTime: response.transactTime || Date.now()
      };
    } catch (error: any) {
      throw new Error(`Ошибка размещения ордера: ${error.message}`);
    }
  }

  /**
   * Отменить ордер
   */
  async cancelOrder(symbol: string, orderId?: string, clientOrderId?: string): Promise<Order> {
    try {
      const mexcSymbol = symbol.replace('/', '');
      
      const options: any = {};
      if (orderId) {
        options.orderId = orderId;
      } else if (clientOrderId) {
        options.origClientOrderId = clientOrderId;
      } else {
        throw new Error('Необходимо указать orderId или clientOrderId');
      }

      const response = await this.client.cancelOrder(mexcSymbol, options);

      return {
        id: response.orderId.toString(),
        clientOrderId: response.clientOrderId || '',
        symbol: response.symbol,
        side: response.side.toLowerCase() as Side,
        type: response.type as OrderType,
        price: parseFloat(response.price || '0'),
        quantity: parseFloat(response.origQty || '0'),
        filled: parseFloat(response.executedQty || '0'),
        status: response.status as OrderStatus,
        timestamp: response.transactTime || Date.now(),
        updateTime: response.transactTime || Date.now()
      };
    } catch (error: any) {
      throw new Error(`Ошибка отмены ордера: ${error.message}`);
    }
  }

  /**
   * Отменить все открытые ордера по символу
   */
  async cancelAllOrders(symbol: string): Promise<Order[]> {
    try {
      const mexcSymbol = symbol.replace('/', '');
      const response = await this.client.cancelOpenOrders(mexcSymbol);

      return response.map((order: any) => ({
        id: order.orderId.toString(),
        clientOrderId: order.clientOrderId || '',
        symbol: order.symbol,
        side: order.side.toLowerCase() as Side,
        type: order.type as OrderType,
        price: parseFloat(order.price || '0'),
        quantity: parseFloat(order.origQty || '0'),
        filled: parseFloat(order.executedQty || '0'),
        status: order.status as OrderStatus,
        timestamp: order.time || Date.now(),
        updateTime: order.updateTime || Date.now()
      }));
    } catch (error: any) {
      throw new Error(`Ошибка отмены всех ордеров: ${error.message}`);
    }
  }

  /**
   * Получить статус ордера
   */
  async getOrder(symbol: string, orderId?: string, clientOrderId?: string): Promise<Order> {
    try {
      const mexcSymbol = symbol.replace('/', '');
      
      const options: any = {};
      if (orderId) {
        options.orderId = orderId;
      } else if (clientOrderId) {
        options.origClientOrderId = clientOrderId;
      } else {
        throw new Error('Необходимо указать orderId или clientOrderId');
      }

      const response = await this.client.queryOrder(mexcSymbol, options);

      return {
        id: response.orderId.toString(),
        clientOrderId: response.clientOrderId || '',
        symbol: response.symbol,
        side: response.side.toLowerCase() as Side,
        type: response.type as OrderType,
        price: parseFloat(response.price || '0'),
        quantity: parseFloat(response.origQty || '0'),
        filled: parseFloat(response.executedQty || '0'),
        status: response.status as OrderStatus,
        timestamp: response.time || Date.now(),
        updateTime: response.updateTime || Date.now()
      };
    } catch (error: any) {
      throw new Error(`Ошибка получения ордера: ${error.message}`);
    }
  }

  /**
   * Получить все открытые ордера
   */
  async getOpenOrders(symbol?: string): Promise<Order[]> {
    try {
      const mexcSymbol = symbol ? symbol.replace('/', '') : undefined;
      const response = await this.client.openOrders(mexcSymbol);

      return response.map((order: any) => ({
        id: order.orderId.toString(),
        clientOrderId: order.clientOrderId || '',
        symbol: order.symbol,
        side: order.side.toLowerCase() as Side,
        type: order.type as OrderType,
        price: parseFloat(order.price || '0'),
        quantity: parseFloat(order.origQty || '0'),
        filled: parseFloat(order.executedQty || '0'),
        status: order.status as OrderStatus,
        timestamp: order.time || Date.now(),
        updateTime: order.updateTime || Date.now()
      }));
    } catch (error: any) {
      throw new Error(`Ошибка получения открытых ордеров: ${error.message}`);
    }
  }

  /**
   * Получить историю сделок
   */
  async getMyTrades(symbol: string, limit: number = 100, fromId?: string): Promise<Fill[]> {
    try {
      const mexcSymbol = symbol.replace('/', '');
      const options: any = { limit };
      if (fromId) {
        options.fromId = fromId;
      }

      const response = await this.client.accountTradeList(mexcSymbol, options);

      return response.map((trade: any) => ({
        id: trade.id.toString(),
        orderId: trade.orderId.toString(),
        clientOrderId: '', // MEXC не возвращает clientOrderId в истории сделок
        symbol: trade.symbol,
        price: parseFloat(trade.price),
        quantity: parseFloat(trade.qty),
        fee: parseFloat(trade.commission),
        side: trade.isBuyer ? 'buy' : 'sell' as Side,
        timestamp: trade.time
      }));
    } catch (error: any) {
      throw new Error(`Ошибка получения истории сделок: ${error.message}`);
    }
  }

  /**
   * Получить текущую цену символа
   */
  async getPrice(symbol: string): Promise<number> {
    try {
      const mexcSymbol = symbol.replace('/', '');
      const response = await this.client.tickerPrice(mexcSymbol);
      
      return parseFloat(response.price);
    } catch (error: any) {
      throw new Error(`Ошибка получения цены: ${error.message}`);
    }
  }

  /**
   * Получить лучшие цены покупки и продажи
   */
  async getBookTicker(symbol: string): Promise<{ bidPrice: number; bidQty: number; askPrice: number; askQty: number }> {
    try {
      const mexcSymbol = symbol.replace('/', '');
      const response = await this.client.bookTicker(mexcSymbol);
      
      return {
        bidPrice: parseFloat(response.bidPrice),
        bidQty: parseFloat(response.bidQty),
        askPrice: parseFloat(response.askPrice),
        askQty: parseFloat(response.askQty)
      };
    } catch (error: any) {
      throw new Error(`Ошибка получения лучших цен: ${error.message}`);
    }
  }

  /**
   * Проверить соединение с API
   */
  async ping(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Получить время сервера
   */
  async getServerTime(): Promise<number> {
    try {
      const response = await this.client.time();
      return response.serverTime;
    } catch (error: any) {
      throw new Error(`Ошибка получения времени сервера: ${error.message}`);
    }
  }
} 