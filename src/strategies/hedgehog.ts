import { EventEmitter } from 'events';
import { Order, Side, Config, Instrument, MarketRegime, Fill } from '../core/types';
import { RoundingUtils } from '../core/math';
import { MexcRestClient } from '../infra/mexcRest';

/**
 * Интерфейс для уровня котировок
 */
interface QuoteLevel {
  level: number;
  side: Side;
  price: number;
  quantity: number;
  orderId?: string;
  clientOrderId: string;
  isActive: boolean;
  timestamp: number;
}

/**
 * Интерфейс для Take Profit ордера
 */
interface TakeProfitOrder {
  id: string;
  clientOrderId: string;
  fillId: string;
  side: Side;
  price: number;
  quantity: number;
  entryPrice: number;
  isActive: boolean;
  timestamp: number;
}

/**
 * Стратегия "Ёршики" - двусторонние лимитные ордера
 * Выставляет симметричные уровни покупки и продажи вокруг средней цены
 */
export class HedgehogStrategy extends EventEmitter {
  private config: Config;
  private instrument: Instrument;
  private restClient: MexcRestClient;
  
  private isActive: boolean = false;
  private quoteLevels: Map<string, QuoteLevel> = new Map();
  private takeProfitOrders: Map<string, TakeProfitOrder> = new Map();
  
  // Текущее состояние
  private midPrice: number = 0;
  private currentInventory: number = 0; // В базовой валюте
  private inventoryNotional: number = 0; // В котировочной валюте
  private atr1m: number = 0;
  
  // Параметры режима
  private currentRegime: MarketRegime = 'normal';
  private regimeParams = {
    tpBps: 12,
    offsetMultiplier: 1.0,
    stepMultiplier: 1.0,
    maxLevels: 4,
    enableLadder: true
  };

  constructor(
    config: Config,
    instrument: Instrument,
    restClient: MexcRestClient
  ) {
    super();
    this.config = config;
    this.instrument = instrument;
    this.restClient = restClient;
  }

  /**
   * Запустить стратегию
   */
  async start(): Promise<void> {
    if (this.isActive) {
      return;
    }

    this.isActive = true;
    this.emit('started');
  }

  /**
   * Остановить стратегию
   */
  async stop(): Promise<void> {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;
    
    // Отменяем все активные ордера
    await this.cancelAllOrders();
    
    this.emit('stopped');
  }

  /**
   * Обновить рыночные данные
   */
  updateMarketData(midPrice: number, atr1m: number): void {
    this.midPrice = midPrice;
    this.atr1m = atr1m;
    
    if (this.isActive) {
      this.updateQuotes();
    }
  }

  /**
   * Обновить параметры режима
   */
  updateRegimeParameters(regime: MarketRegime, params: any): void {
    this.currentRegime = regime;
    this.regimeParams = params;
    
    if (this.isActive) {
      this.updateQuotes();
    }
  }

  /**
   * Обработать исполнение ордера
   */
  async onFill(fill: Fill): Promise<void> {
    const level = this.findLevelByOrderId(fill.orderId);
    if (!level) {
      return;
    }

    // Обновляем инвентарь
    const inventoryChange = fill.side === 'buy' ? fill.quantity : -fill.quantity;
    this.currentInventory += inventoryChange;
    this.inventoryNotional += fill.side === 'buy' ? -fill.price * fill.quantity : fill.price * fill.quantity;

    // Создаем Take Profit ордер
    await this.createTakeProfitOrder(fill, level);

    // Восстанавливаем уровень (replenish)
    await this.replenishLevel(level);

    // Проверяем skew и обновляем котировки
    this.updateQuotes();

    this.emit('fill', fill);
  }

  /**
   * Обновить котировки
   */
  private async updateQuotes(): Promise<void> {
    if (!this.isActive || this.midPrice === 0 || this.atr1m === 0) {
      return;
    }

    // Проверяем фильтры
    if (!this.passesFilters()) {
      await this.pauseQuoting();
      return;
    }

    // Вычисляем параметры
    const offset = this.regimeParams.offsetMultiplier * this.config.hedgehog.offset_k_atr1m * this.atr1m;
    const step = this.regimeParams.stepMultiplier * this.config.hedgehog.step_k_atr1m * this.atr1m;
    const maxLevels = this.regimeParams.maxLevels;

    // Проверяем skew
    const inventoryLimit = this.config.deposit_usd * this.config.risk.max_inventory_pct;
    const inventorySkew = Math.abs(this.inventoryNotional) / inventoryLimit;
    const shouldSkewBuy = this.inventoryNotional < -inventoryLimit * this.config.hedgehog.skew_alpha;
    const shouldSkewSell = this.inventoryNotional > inventoryLimit * this.config.hedgehog.skew_alpha;

    // Генерируем новые уровни
    const newLevels: QuoteLevel[] = [];

    for (let i = 1; i <= maxLevels; i++) {
      // Buy уровень
      if (!shouldSkewSell) {
        const buyPrice = RoundingUtils.roundToTick(
          this.midPrice - offset - (i - 1) * step,
          this.instrument.tickSize
        );
        const buyQty = this.calculateLevelQuantity(i, 'buy');
        
        if (buyQty > 0 && RoundingUtils.validateNotional(buyPrice, buyQty, this.instrument.minNotional)) {
          newLevels.push({
            level: i,
            side: 'buy',
            price: buyPrice,
            quantity: buyQty,
            clientOrderId: this.generateClientOrderId('buy', i),
            isActive: false,
            timestamp: Date.now()
          });
        }
      }

      // Sell уровень
      if (!shouldSkewBuy) {
        const sellPrice = RoundingUtils.roundToTick(
          this.midPrice + offset + (i - 1) * step,
          this.instrument.tickSize
        );
        const sellQty = this.calculateLevelQuantity(i, 'sell');
        
        if (sellQty > 0 && RoundingUtils.validateNotional(sellPrice, sellQty, this.instrument.minNotional)) {
          newLevels.push({
            level: i,
            side: 'sell',
            price: sellPrice,
            quantity: sellQty,
            clientOrderId: this.generateClientOrderId('sell', i),
            isActive: false,
            timestamp: Date.now()
          });
        }
      }
    }

    // Обновляем ордера
    await this.updateOrders(newLevels);
  }

  /**
   * Вычислить количество для уровня
   */
  private calculateLevelQuantity(level: number, side: Side): number {
    const baseSize = this.config.deposit_usd * 0.01; // 1% от депозита на уровень
    const geometryFactor = Math.pow(this.config.hedgehog.size_geometry_r, level - 1);
    const notional = baseSize * geometryFactor;
    
    return RoundingUtils.calculateQuantityForNotional(
      this.midPrice,
      notional,
      this.instrument.stepSize
    );
  }

  /**
   * Обновить ордера
   */
  private async updateOrders(newLevels: QuoteLevel[]): Promise<void> {
    // Отменяем устаревшие ордера
    const toCancel: string[] = [];
    for (const [clientOrderId, level] of this.quoteLevels) {
      const stillNeeded = newLevels.find(l => 
        l.side === level.side && 
        l.level === level.level &&
        Math.abs(l.price - level.price) < this.instrument.tickSize * 0.1
      );
      
      if (!stillNeeded && level.isActive) {
        toCancel.push(clientOrderId);
      }
    }

    // Отменяем ордера батчем
    if (toCancel.length > 0) {
      await this.cancelOrders(toCancel);
    }

    // Размещаем новые ордера
    for (const level of newLevels) {
      const existingLevel = Array.from(this.quoteLevels.values()).find(l =>
        l.side === level.side && 
        l.level === level.level &&
        Math.abs(l.price - level.price) < this.instrument.tickSize * 0.1
      );

      if (!existingLevel) {
        await this.placeOrder(level);
      }
    }
  }

  /**
   * Разместить ордер
   */
  private async placeOrder(level: QuoteLevel): Promise<void> {
    try {
      const order = await this.restClient.placeOrder(
        this.instrument.symbol,
        level.side,
        'LIMIT',
        level.quantity,
        level.price,
        level.clientOrderId
      );

      level.orderId = order.id;
      level.isActive = true;
      this.quoteLevels.set(level.clientOrderId, level);

      this.emit('orderPlaced', order);
    } catch (error) {
      this.emit('error', new Error(`Ошибка размещения ордера: ${error}`));
    }
  }

  /**
   * Отменить ордера
   */
  private async cancelOrders(clientOrderIds: string[]): Promise<void> {
    for (const clientOrderId of clientOrderIds) {
      try {
        const level = this.quoteLevels.get(clientOrderId);
        if (level && level.isActive) {
          await this.restClient.cancelOrder(this.instrument.symbol, level.orderId, clientOrderId);
          level.isActive = false;
          this.quoteLevels.delete(clientOrderId);
          
          this.emit('orderCanceled', clientOrderId);
        }
      } catch (error) {
        this.emit('error', new Error(`Ошибка отмены ордера ${clientOrderId}: ${error}`));
      }
    }
  }

  /**
   * Отменить все ордера
   */
  private async cancelAllOrders(): Promise<void> {
    const activeOrders = Array.from(this.quoteLevels.keys()).filter(id => 
      this.quoteLevels.get(id)?.isActive
    );
    
    if (activeOrders.length > 0) {
      await this.cancelOrders(activeOrders);
    }

    // Также отменяем все Take Profit ордера
    const activeTPs = Array.from(this.takeProfitOrders.values()).filter(tp => tp.isActive);
    for (const tp of activeTPs) {
      try {
        await this.restClient.cancelOrder(this.instrument.symbol, tp.id, tp.clientOrderId);
        tp.isActive = false;
        this.takeProfitOrders.delete(tp.id);
      } catch (error) {
        // Игнорируем ошибки отмены TP
      }
    }
  }

  /**
   * Создать Take Profit ордер
   */
  private async createTakeProfitOrder(fill: Fill, level: QuoteLevel): Promise<void> {
    const tpSide: Side = fill.side === 'buy' ? 'sell' : 'buy';
    const tpBps = this.regimeParams.tpBps;
    const tpMultiplier = fill.side === 'buy' ? (1 + tpBps / 10000) : (1 - tpBps / 10000);
    
    const tpPrice = RoundingUtils.roundToTick(
      fill.price * tpMultiplier,
      this.instrument.tickSize
    );

    const clientOrderId = this.generateClientOrderId(`tp_${fill.side}`, Date.now());

    try {
      const tpOrder = await this.restClient.placeOrder(
        this.instrument.symbol,
        tpSide,
        'LIMIT',
        fill.quantity,
        tpPrice,
        clientOrderId
      );

      const tpData: TakeProfitOrder = {
        id: tpOrder.id,
        clientOrderId: clientOrderId,
        fillId: fill.id,
        side: tpSide,
        price: tpPrice,
        quantity: fill.quantity,
        entryPrice: fill.price,
        isActive: true,
        timestamp: Date.now()
      };

      this.takeProfitOrders.set(tpOrder.id, tpData);
      this.emit('takeProfitCreated', tpData);
    } catch (error) {
      this.emit('error', new Error(`Ошибка создания Take Profit: ${error}`));
    }
  }

  /**
   * Восстановить уровень после исполнения
   */
  private async replenishLevel(level: QuoteLevel): Promise<void> {
    // Создаем новый уровень глубже
    const newLevel = { ...level };
    newLevel.clientOrderId = this.generateClientOrderId(level.side, level.level);
    newLevel.isActive = false;
    newLevel.timestamp = Date.now();
    
    // Сдвигаем цену глубже на один шаг
    const step = this.regimeParams.stepMultiplier * this.config.hedgehog.step_k_atr1m * this.atr1m;
    
    if (level.side === 'buy') {
      newLevel.price = RoundingUtils.roundToTick(level.price - step, this.instrument.tickSize);
    } else {
      newLevel.price = RoundingUtils.roundToTick(level.price + step, this.instrument.tickSize);
    }

    // Размещаем новый ордер
    await this.placeOrder(newLevel);
  }

  /**
   * Проверить фильтры
   */
  private passesFilters(): boolean {
    // Проверка минимального спреда (здесь упрощенно)
    const minSpread = this.config.filters.min_spread_ticks * this.instrument.tickSize;
    // В реальной реализации нужны данные стакана
    
    // Проверка staleness данных
    // В реальной реализации проверяем время последнего обновления
    
    return true;
  }

  /**
   * Приостановить котирование
   */
  private async pauseQuoting(): Promise<void> {
    await this.cancelAllOrders();
    this.emit('quotingPaused');
  }

  /**
   * Найти уровень по ID ордера
   */
  private findLevelByOrderId(orderId: string): QuoteLevel | undefined {
    return Array.from(this.quoteLevels.values()).find(level => level.orderId === orderId);
  }

  /**
   * Генерировать clientOrderId
   */
  private generateClientOrderId(side: string, level: number | string): string {
    const timestamp = Date.now();
    const nonce = Math.floor(Math.random() * 1000);
    return `hedgehog_${side}_${level}_${timestamp}_${nonce}`;
  }

  /**
   * Получить статистику стратегии
   */
  getStats() {
    return {
      isActive: this.isActive,
      activeLevels: Array.from(this.quoteLevels.values()).filter(l => l.isActive).length,
      activeTakeProfits: Array.from(this.takeProfitOrders.values()).filter(tp => tp.isActive).length,
      currentInventory: this.currentInventory,
      inventoryNotional: this.inventoryNotional,
      currentRegime: this.currentRegime,
      midPrice: this.midPrice,
      atr1m: this.atr1m
    };
  }

  /**
   * Получить активные уровни
   */
  getActiveLevels(): QuoteLevel[] {
    return Array.from(this.quoteLevels.values()).filter(level => level.isActive);
  }

  /**
   * Получить активные Take Profit ордера
   */
  getActiveTakeProfits(): TakeProfitOrder[] {
    return Array.from(this.takeProfitOrders.values()).filter(tp => tp.isActive);
  }
} 