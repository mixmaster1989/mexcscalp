import { EventEmitter } from 'events';
import { MexcWebSocketClient } from '../exchanges/mexcWebSocket';
import { MexcRestClient } from '../exchanges/mexcRest';
import { MicroStatsCalculator } from './alpha';
import { RiskManager } from './risk';
import { Config, LayerState, OrderBookTick, MicroStats, SessionStats, Layer } from './types';

export class PingPongEngine extends EventEmitter {
  private layers: Map<string, Layer> = new Map();
  private microStats: MicroStats | null = null;
  private sessionStats: SessionStats;
  private isRunning = false;
  private updateInterval: NodeJS.Timeout | null = null;
  private watchdogInterval: NodeJS.Timeout | null = null;
  private lastOrderBookTime = 0;
  private lastTradeTime = 0;
  private priceHistory: number[] = [];

  constructor(
    private config: Config,
    private wsClient: MexcWebSocketClient,
    private restClient: MexcRestClient,
    private statsCalculator: MicroStatsCalculator,
    private riskManager: RiskManager
  ) {
    super();
    
    this.sessionStats = {
      totalPnL: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      consecutiveLosses: 0,
      fillsPerMinute: 0,
      avgTradeDuration: 0,
      dailyDrawdown: 0,
      startTime: Date.now(),
      lastTradeTime: Date.now()
    };
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.wsClient.on('orderbook', (tick: OrderBookTick) => {
      this.handleOrderBookTick(tick);
    });

    this.wsClient.on('trade', (tick: any) => {
      this.handleTradeTick(tick);
    });

    this.wsClient.on('connected', () => {
      this.start();
    });

    this.wsClient.on('disconnected', () => {
      this.stop();
    });
  }

  private handleOrderBookTick(tick: OrderBookTick): void {
    this.lastOrderBookTime = Date.now();
    
    // Обновляем историю цен
    this.priceHistory.push(tick.bidPrice);
    if (this.priceHistory.length > 120) {
      this.priceHistory.shift();
    }
    
    // Вычисляем микро-статистику
    this.microStats = this.statsCalculator.calculateMicroStats(tick, this.priceHistory, this.config);
    
    if (this.microStats) {
      this.emit('microStats', this.microStats);
    }
  }

  private handleTradeTick(tick: any): void {
    this.lastTradeTime = Date.now();
    this.emit('trade', tick);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.emit('started');
    
    // Запускаем основной цикл обновления
    this.updateInterval = setInterval(() => {
      this.updateCycle();
    }, this.config.updateIntervalMs);
    
    // Запускаем watchdog
    this.watchdogInterval = setInterval(() => {
      this.watchdog();
    }, 1000);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    // Останавливаем таймеры
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
    
    // Отменяем все открытые ордера
    try {
      await this.restClient.cancelAllOpenOrders(this.config.symbol);
    } catch (error) {
      console.error('Ошибка отмены ордеров:', error);
    }
    
    this.emit('stopped');
  }

  private async updateCycle(): Promise<void> {
    if (!this.isRunning || !this.microStats) return;
    
    try {
      // Проверяем риск-менеджмент
      if (!this.riskManager.canTrade(this.sessionStats)) {
        return;
      }
      
      // Обновляем состояние слоев
      await this.updateLayers();
      
      // Создаем новые слои если нужно
      await this.createNewLayers();
      
    } catch (error) {
      console.error('Ошибка в цикле обновления:', error);
      this.emit('error', error);
    }
  }

  private async updateLayers(): Promise<void> {
    const layersToRemove: string[] = [];
    
    for (const [layerId, layer] of this.layers) {
      try {
        await this.updateLayer(layer);
        
        // Удаляем завершенные слои
        if (layer.state === LayerState.IDLE) {
          layersToRemove.push(layerId);
        }
      } catch (error) {
        console.error(`Ошибка обновления слоя ${layerId}:`, error);
        layersToRemove.push(layerId);
      }
    }
    
    // Удаляем завершенные слои
    for (const layerId of layersToRemove) {
      this.layers.delete(layerId);
    }
  }

  private async updateLayer(layer: Layer): Promise<void> {
    const now = Date.now();
    
    switch (layer.state) {
      case LayerState.PENDING_BUY:
        await this.updatePendingBuyLayer(layer, now);
        break;
      case LayerState.LONG_PING:
        await this.updateLongPingLayer(layer, now);
        break;
      case LayerState.COOLDOWN:
        await this.updateCooldownLayer(layer, now);
        break;
    }
  }

  private async updatePendingBuyLayer(layer: Layer, now: number): Promise<void> {
    // Проверяем TTL
    if (layer.expireAt && now > layer.expireAt) {
      await this.cancelLayerOrder(layer);
      layer.state = LayerState.IDLE;
      return;
    }
    
    // Проверяем исполнение ордера
    if (layer.buyOrderId) {
      try {
        const order = await this.restClient.getOrder(this.config.symbol, layer.buyOrderId);
        if (order.status === 'FILLED') {
          await this.handleBuyOrderFilled(layer, order);
        }
      } catch (error) {
        console.error('Ошибка проверки ордера:', error);
      }
    }
  }

  private async updateLongPingLayer(layer: Layer, now: number): Promise<void> {
    // Проверяем TTL
    if (layer.expireAt && now > layer.expireAt) {
      await this.emergencyCloseLayer(layer);
      layer.state = LayerState.COOLDOWN;
      layer.resumeAt = now + this.config.cooldownSeconds * 1000;
      return;
    }
    
    // Проверяем стоп-лосс
    if (this.microStats && layer.slPrice && this.microStats.mid <= layer.slPrice) {
      await this.emergencyCloseLayer(layer);
      layer.state = LayerState.COOLDOWN;
      layer.resumeAt = now + this.config.cooldownSeconds * 1000;
      return;
    }
    
    // Проверяем исполнение sell ордера
    if (layer.sellOrderId) {
      try {
        const order = await this.restClient.getOrder(this.config.symbol, layer.sellOrderId);
        if (order.status === 'FILLED') {
          await this.handleSellOrderFilled(layer, order);
        }
      } catch (error) {
        console.error('Ошибка проверки sell ордера:', error);
      }
    }
  }

  private async updateCooldownLayer(layer: Layer, now: number): Promise<void> {
    if (layer.resumeAt && now >= layer.resumeAt) {
      layer.state = LayerState.IDLE;
    }
  }

  private async createNewLayers(): Promise<void> {
    if (!this.microStats) return;
    
    const activeLayers = Array.from(this.layers.values()).filter(
      layer => layer.state !== LayerState.IDLE
    );
    
    if (activeLayers.length >= this.config.maxLayers) return;
    
    // Проверяем условия для создания нового слоя
    if (this.canCreateNewLayer()) {
      await this.createNewLayer();
    }
  }

  private canCreateNewLayer(): boolean {
    if (!this.microStats) return false;
    
    // Проверяем условия рынка
    return this.riskManager.isMarketConditionSuitable(
      this.microStats.spread,
      this.microStats.mid,
      this.microStats.sigma1s,
      1, // bidQty - упрощенно
      1, // askQty - упрощенно
      this.config.orderNotional / this.microStats.mid
    );
  }

  private async createNewLayer(): Promise<void> {
    if (!this.microStats) return;
    
    const layerId = `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const buyPrice = this.microStats.mid - this.microStats.s;
    const quantity = this.config.orderNotional / this.microStats.mid;
    
    try {
      const order = await this.restClient.placeOrder(
        this.config.symbol,
        'BUY',
        'LIMIT',
        quantity,
        buyPrice
      );
      
      const layer: Layer = {
        id: layerId,
        state: LayerState.PENDING_BUY,
        buyOrderId: order.id,
        buyPrice,
        quantity,
        expireAt: Date.now() + this.config.ttlSeconds * 1000
      };
      
      this.layers.set(layerId, layer);
      
    } catch (error) {
      console.error('Ошибка создания слоя:', error);
    }
  }

  private async handleBuyOrderFilled(layer: Layer, order: any): Promise<void> {
    layer.entryPrice = parseFloat(order.price);
    layer.slPrice = layer.entryPrice - this.microStats!.sl;
    
    // Размещаем sell ордер
    const sellPrice = layer.entryPrice + this.microStats!.tp;
    
    try {
      const sellOrder = await this.restClient.placeOrder(
        this.config.symbol,
        'SELL',
        'LIMIT',
        layer.quantity!,
        sellPrice
      );
      
      layer.sellOrderId = sellOrder.id;
      layer.sellPrice = sellPrice;
      layer.state = LayerState.LONG_PING;
      layer.expireAt = Date.now() + this.config.ttlSeconds * 1000;
      
    } catch (error) {
      console.error('Ошибка размещения sell ордера:', error);
      await this.emergencyCloseLayer(layer);
      layer.state = LayerState.COOLDOWN;
      layer.resumeAt = Date.now() + this.config.cooldownSeconds * 1000;
    }
  }

  private async handleSellOrderFilled(layer: Layer, order: any): Promise<void> {
    const pnl = (parseFloat(order.price) - layer.entryPrice!) * layer.quantity!;
    
    // Обновляем статистику
    this.updateSessionStats(layer, pnl > 0);
    
    layer.state = LayerState.IDLE;
  }

  private async emergencyCloseLayer(layer: Layer): Promise<void> {
    try {
      // Отменяем sell ордер если есть
      if (layer.sellOrderId) {
        await this.restClient.cancelOrder(this.config.symbol, layer.sellOrderId);
      }
      
      // Продаем по рынку (агрессивный лимит)
      if (this.microStats) {
        const marketSellPrice = this.microStats.mid - this.microStats.spread * 0.5;
        await this.restClient.placeOrder(
          this.config.symbol,
          'SELL',
          'LIMIT',
          layer.quantity!,
          marketSellPrice
        );
      }
      
    } catch (error) {
      console.error('Ошибка аварийного закрытия слоя:', error);
    }
  }

  private async cancelLayerOrder(layer: Layer): Promise<void> {
    try {
      if (layer.buyOrderId) {
        await this.restClient.cancelOrder(this.config.symbol, layer.buyOrderId);
      }
      if (layer.sellOrderId) {
        await this.restClient.cancelOrder(this.config.symbol, layer.sellOrderId);
      }
    } catch (error) {
      console.error('Ошибка отмены ордера слоя:', error);
    }
  }

  private updateSessionStats(layer: Layer, isWin: boolean): void {
    this.sessionStats.totalTrades++;
    this.sessionStats.lastTradeTime = Date.now();
    
    if (isWin) {
      this.sessionStats.winningTrades++;
      this.sessionStats.consecutiveLosses = 0;
    } else {
      this.sessionStats.losingTrades++;
      this.sessionStats.consecutiveLosses++;
    }
    
    // Обновляем fills per minute
    const runtime = (Date.now() - this.sessionStats.startTime) / 1000 / 60;
    this.sessionStats.fillsPerMinute = this.sessionStats.totalTrades / Math.max(runtime, 1);
  }

  private watchdog(): void {
    if (!this.isRunning) return;
    
    const now = Date.now();
    
    // Проверяем задержку данных
    if (now - this.lastOrderBookTime > 5000) {
      console.log('⚠️ Нет данных стакана более 5 секунд');
    }
    
    if (now - this.lastTradeTime > 10000) {
      console.log('⚠️ Нет сделок более 10 секунд');
    }
    
    // Проверяем watchdog timeout
    if (now - this.sessionStats.lastTradeTime > this.config.watchdogTimeoutSeconds * 1000) {
      console.log('🐕 Watchdog: нет сделок, уменьшаем s');
      // Здесь можно добавить логику уменьшения s
    }
  }

  // Публичные методы для получения состояния
  getLayers(): Layer[] {
    return Array.from(this.layers.values());
  }

  getMicroStats(): MicroStats | null {
    return this.microStats;
  }

  getSessionStats(): SessionStats {
    return { ...this.sessionStats };
  }

  isEngineRunning(): boolean {
    return this.isRunning;
  }
}
