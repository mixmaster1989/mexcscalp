#!/usr/bin/env node
require('dotenv').config();
const { MexcRestClient } = require('./dist/infra/mexcRest');
const TelegramBot = require('node-telegram-bot-api');
const pino = require('pino');

console.log('🚀 РЕАЛЬНЫЙ СКАЛЬПЕР - Лесенка + Ёршики\n');

class RealScalper {
  constructor() {
    this.restClient = new MexcRestClient(process.env.MEXC_API_KEY, process.env.MEXC_SECRET_KEY);
    this.telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
    // Настройка логирования
    this.logger = pino({ level: 'info' });
    
    // Создаем отдельные логгеры для разных типов событий
    this.orderLogger = pino({
      level: 'info',
      transport: {
        target: 'pino/file',
        options: { destination: './logs/orders.log' }
      }
    });
    
    this.errorLogger = pino({
      level: 'error',
      transport: {
        target: 'pino/file',
        options: { destination: './logs/errors.log' }
      }
    });
    
    // Конфигурация
    this.config = {
      symbol: 'ETHUSDC',
      deposit_usd: 100,
      mode: 'hedgehog', // 'ladder' или 'hedgehog'
      
      // Лесенка
      ladder: {
        levels: 7,
        k_step: 0.8,
        tp_pct: 0.12,
        geometry_r: 1.2,
        z_max: 3
      },
      
      // Ёршики
      hedgehog: {
        levels: 5,
        offset_k: 0.5,
        step_k: 0.6,
        tp_pct: 0.10,
        max_direction_usd: 20,
        order_size_usd: 5
      },
      
      // Риск-менеджмент
      risk: {
        max_notional_per_symbol: 50, // 50% от депо
        max_drawdown_pct: 5,
        max_consecutive_losses: 3,
        emergency_stop_atr_multiplier: 2
      },
      
      // Тайминги
      timing: {
        main_loop_interval_ms: 5000,
        reprice_interval_ms: 30000,
        status_update_interval_ms: 900000,
        order_ttl_ms: 300000, // 5 минут
        max_distance_atr_multiplier: 1
      }
    };
    
    // Состояние
    this.state = 'QUOTING';
    this.isRunning = false;
    this.activeOrders = new Map();
    this.takeProfitOrders = new Map();
    this.inventory = 0;
    this.inventoryNotional = 0;
    this.consecutiveLosses = 0;
    this.totalPnL = 0;
    this.lastStatusUpdate = 0;
    
    // Технические индикаторы
    this.indicators = {
      vwap_1h: 0,
      atr_1m: 0,
      atr_5m: 0,
      ema_20: 0,
      ema_50: 0,
      midPrice: 0
    };
    
    // История цен для расчета индикаторов
    this.priceHistory = [];
    this.tradeHistory = [];
  }

  async start() {
    try {
      this.isRunning = true;
      this.logger.info('🚀 Запуск реального скальпера');
      
      // Инициализация
      await this.initializeIndicators();
      await this.cancelAllOrders();
      
      // Уведомление
      await this.sendTelegramMessage(
        `🚀 *РЕАЛЬНЫЙ СКАЛЬПЕР ЗАПУЩЕН*\n\n` +
        `📊 Режим: ${this.config.mode === 'ladder' ? 'Лесенка' : 'Ёршики'}\n` +
        `💰 Депозит: ${this.config.deposit_usd} USDC\n` +
        `🎯 Пара: ${this.config.symbol}\n\n` +
        `⚡ Автоматический скальпинг активен!`
      );
      
      // Основной цикл
      setInterval(async () => {
        try {
          await this.mainLoop();
        } catch (error) {
          this.errorLogger.error('Ошибка в основном цикле:', error);
        }
      }, 5000); // Каждые 5 секунд
      
    } catch (error) {
      this.errorLogger.error('Ошибка запуска:', error);
      throw error;
    }
  }

  async mainLoop() {
    if (!this.isRunning) return;
    
    try {
      // Обновляем рыночные данные
      await this.updateMarketData();
      
      // Проверяем риск-менеджмент
      if (!this.passRiskChecks()) {
        await this.emergencyStop();
        return;
      }
      
      // Обрабатываем исполнения
      await this.processFills();
      
      // Обновляем ордера в зависимости от режима
      if (this.config.mode === 'ladder') {
        this.logger.info('🔄 Режим: Лесенка');
        await this.updateLadderOrders();
      } else {
        this.logger.info('🔄 Режим: Ёршики');
        await this.updateHedgehogOrders();
      }
      
      // Логируем статус
      this.logStatus();
      
      // Периодические статусы каждые 15 минут
      const now = Date.now();
      if (now - this.lastStatusUpdate > 15 * 60 * 1000) {
        await this.sendPeriodicStatus();
        this.lastStatusUpdate = now;
      }
      
    } catch (error) {
      this.errorLogger.error('Ошибка в основном цикле:', error);
    }
  }

  async updateMarketData() {
    try {
      // Получаем текущую цену
      const ticker = await this.restClient.getBookTicker(this.config.symbol);
      this.indicators.midPrice = (parseFloat(ticker.bidPrice) + parseFloat(ticker.askPrice)) / 2;
      
      // Получаем последние сделки для расчета индикаторов
      const trades = await this.restClient.getMyTrades(this.config.symbol, 100);
      
      // Обновляем историю цен
      this.updatePriceHistory();
      
      // Рассчитываем индикаторы
      await this.calculateIndicators();
      
    } catch (error) {
      this.errorLogger.error('Ошибка обновления рыночных данных:', error);
    }
  }

  updatePriceHistory() {
    const now = Date.now();
    this.priceHistory.push({
      price: this.indicators.midPrice,
      timestamp: now,
      volume: 0.001 // Заглушка
    });
    
    // Оставляем только последний час
    const oneHourAgo = now - 60 * 60 * 1000;
    this.priceHistory = this.priceHistory.filter(p => p.timestamp > oneHourAgo);
  }

  async calculateIndicators() {
    if (this.priceHistory.length < 20) return;
    
    // VWAP за 1 час
    let totalVolume = 0;
    let totalVolumePrice = 0;
    
    this.priceHistory.forEach(p => {
      totalVolume += p.volume;
      totalVolumePrice += p.price * p.volume;
    });
    
    this.indicators.vwap_1h = totalVolume > 0 ? totalVolumePrice / totalVolume : this.indicators.midPrice;
    
    // ATR (упрощенный)
    if (this.priceHistory.length >= 2) {
      const recent = this.priceHistory.slice(-20);
      let atrSum = 0;
      
      for (let i = 1; i < recent.length; i++) {
        atrSum += Math.abs(recent[i].price - recent[i-1].price);
      }
      
      this.indicators.atr_1m = atrSum / (recent.length - 1);
      this.indicators.atr_5m = this.indicators.atr_1m * 2; // Упрощение
    }
    
    // EMA (упрощенный)
    if (this.priceHistory.length >= 50) {
      const recent = this.priceHistory.slice(-50);
      this.indicators.ema_20 = this.calculateEMA(recent.slice(-20), 20);
      this.indicators.ema_50 = this.calculateEMA(recent, 50);
    }
  }

  calculateEMA(prices, period) {
    if (prices.length === 0) return 0;
    
    const multiplier = 2 / (period + 1);
    let ema = prices[0].price;
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i].price * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }

  async updateLadderOrders() {
    try {
      const center = this.indicators.vwap_1h;
      const atr = this.indicators.atr_1m;
      
      // Проверяем анти-хайп фильтр
      const priceDeviation = Math.abs(this.indicators.midPrice - center);
      if (priceDeviation > this.config.ladder.z_max * this.indicators.atr_5m) {
        this.logger.info('⏸️ Анти-хайп фильтр: пауза покупок');
        return;
      }
      
      // Получаем текущие ордера
      const currentOrders = await this.restClient.getOpenOrders(this.config.symbol);
      
      // Отменяем старые ордера, которые ушли далеко от цены
      await this.cancelStaleOrders(center, atr, currentOrders);
      
      const buyOrders = currentOrders.filter(o => o.side === 'buy');
      
      // Если недостаточно buy ордеров, добавляем
      if (buyOrders.length < this.config.ladder.levels) {
        await this.placeLadderBuyOrders(center, atr, buyOrders.length);
      }
      
    } catch (error) {
      this.errorLogger.error('Ошибка обновления лесенки:', error);
    }
  }

  async placeLadderBuyOrders(center, atr, existingCount) {
    const step = Math.ceil(this.config.ladder.k_step * atr * 100) / 100; // Округляем до тика
    const needed = this.config.ladder.levels - existingCount;
    
    // Базовый размер
    const baseSize = (this.config.deposit_usd * 0.1) / center; // 10% от депо
    const r = this.config.ladder.geometry_r;
    
    for (let i = 0; i < needed; i++) {
      const level = existingCount + i;
      const price = center - (level + 1) * step;
      const size = baseSize * Math.pow(r, level);
      
      if (size < 0.0001) continue; // Минимальный размер
      
      try {
        const clientOrderId = `LADDER_BUY_${level}_${Date.now()}`;
        
        const order = await this.restClient.placeOrder(
          this.config.symbol,
          'buy',
          'limit',
          size,
          price,
          clientOrderId
        );
        
        this.orderLogger.info(`✅ BUY ордер размещен: ${price} x ${size} (ID: ${order.id})`);
        
        this.activeOrders.set(clientOrderId, {
          id: order.id,
          side: 'buy',
          price: price,
          quantity: size,
          level: level,
          type: 'ladder'
        });
        
        this.logger.info(`📈 Лесенка BUY ${level}: ${price} x ${size}`);
        
      } catch (error) {
        this.errorLogger.error(`Ошибка размещения лесенки ${level}:`, error);
      }
    }
  }

  async updateHedgehogOrders() {
    try {
      this.logger.info(`🔄 Обновление ёршиков... (режим: ${this.state})`);
      const center = this.indicators.midPrice;
      const atr = this.indicators.atr_1m;
      
      // Проверяем режим работы
      if (this.state === 'SELL_ONLY') {
        this.logger.info('📤 Режим "только продажи" - размещаем только SELL ордера');
      }
      
      // Проверяем лимит по направлению (20 USDC в каждую сторону)
      const maxDirectionUsd = this.config.hedgehog.max_direction_usd || 20;
      if (this.inventoryNotional > maxDirectionUsd) {
        this.logger.info('⚠️ Лимит LONG превышен, приостанавливаем BUY ордера');
        return;
      }
      
      // Получаем текущие ордера
      const currentOrders = await this.restClient.getOpenOrders(this.config.symbol);
      
      // Обновляем ёршики (внутри будет проверка лимитов)
      await this.updateHedgehogLevels(center, atr, currentOrders);
      
    } catch (error) {
      this.errorLogger.error('Ошибка обновления ёршиков:', error);
    }
  }

  async cancelStaleOrders(center, atr, currentOrders) {
    try {
      const maxDistance = this.config.timing.max_distance_atr_multiplier * atr;
      const maxAge = this.config.timing.order_ttl_ms;
      const now = Date.now();
      
      for (const order of currentOrders) {
        const orderPrice = parseFloat(order.price);
        const distance = Math.abs(orderPrice - center);
        const age = now - (order.time || order.timestamp || 0);
        
        // Отменяем ордера, которые:
        // 1. Ушли далеко от центра (> 3 ATR)
        // 2. Или слишком старые (> 5 минут)
        if (distance > maxDistance || age > maxAge) {
          try {
            await this.restClient.cancelOrder(this.config.symbol, order.id);
            this.orderLogger.info(`🗑️ Отменен старый ордер: ${order.side} ${orderPrice} (расстояние: ${distance.toFixed(2)}, возраст: ${Math.round(age/1000)}с)`);
            
            // Удаляем из активных ордеров
            for (const [key, activeOrder] of this.activeOrders.entries()) {
              if (activeOrder.id === order.id) {
                this.activeOrders.delete(key);
                break;
              }
            }
          } catch (error) {
            this.errorLogger.error(`Ошибка отмены старого ордера ${order.id}:`, error);
          }
        }
      }
    } catch (error) {
      this.errorLogger.error('Ошибка отмены старых ордеров:', error);
    }
  }

  async updateHedgehogLevels(center, atr, currentOrders) {
    const offset = Math.ceil(this.config.hedgehog.offset_k * atr * 100) / 100;
    const step = Math.ceil(this.config.hedgehog.step_k * atr * 100) / 100;
    
    // Отменяем старые ордера, которые ушли далеко от цены
    await this.cancelStaleOrders(center, atr, currentOrders);
    
    // Проверяем skew
    const shouldSkewBuy = this.inventoryNotional < -this.config.deposit_usd * 0.01;
    const shouldSkewSell = this.inventoryNotional > this.config.deposit_usd * 0.01;
    
    // Размещаем buy уровни (только если не в режиме "только продажи")
    if (!shouldSkewSell && this.state !== 'SELL_ONLY') {
      for (let i = 1; i <= this.config.hedgehog.levels; i++) {
        const price = center - offset - (i - 1) * step;
        const quantity = center > 0 ? this.config.hedgehog.order_size_usd / center : 0.001; // Размер из конфига
        
        const clientOrderId = `HEDGEHOG_BUY_${i}_${Date.now()}`;
        
        // Проверяем, есть ли уже такой ордер
        const exists = currentOrders.find(o => 
          o.side === 'buy' && 
          Math.abs(parseFloat(o.price) - price) < 0.01
        );
        
        if (!exists) {
          try {
            const order = await this.restClient.placeOrder(
              this.config.symbol,
              'buy',
              'limit',
              quantity,
              price,
              clientOrderId
            );
            
            this.orderLogger.info(`✅ BUY ёршик размещен: ${price} x ${quantity} (ID: ${order.id})`);
            
            this.activeOrders.set(clientOrderId, {
              id: order.id,
              side: 'buy',
              price: price,
              quantity: quantity,
              level: i,
              type: 'hedgehog'
            });
            
            this.logger.info(`🟢 Ёршик BUY ${i}: ${price} x ${quantity}`);
            
          } catch (error) {
            this.errorLogger.error(`Ошибка ёршика BUY ${i}:`, error);
          }
        }
      }
    }
    
    // Размещаем sell уровни (только если есть ETH для продажи)
    if (!shouldSkewBuy && this.inventory > 0) {
      for (let i = 1; i <= this.config.hedgehog.levels; i++) {
        const price = center + offset + (i - 1) * step;
        const quantity = center > 0 ? this.config.hedgehog.order_size_usd / center : 0.001; // Размер из конфига
        
        const clientOrderId = `HEDGEHOG_SELL_${i}_${Date.now()}`;
        
        const exists = currentOrders.find(o => 
          o.side === 'sell' && 
          Math.abs(parseFloat(o.price) - price) < 0.01
        );
        
        if (!exists) {
          try {
            const order = await this.restClient.placeOrder(
              this.config.symbol,
              'sell',
              'limit',
              quantity,
              price,
              clientOrderId
            );
            
            this.orderLogger.info(`✅ SELL ёршик размещен: ${price} x ${quantity} (ID: ${order.id})`);
            
            this.activeOrders.set(clientOrderId, {
              id: order.id,
              side: 'sell',
              price: price,
              quantity: quantity,
              level: i,
              type: 'hedgehog'
            });
            
            this.logger.info(`🔴 Ёршик SELL ${i}: ${price} x ${quantity}`);
            
          } catch (error) {
            // Это не ошибка - просто нет ETH для продажи
            this.logger.warn(`⚠️ Нет ETH для SELL ${i}: ${error.message}`);
          }
        }
      }
    } else if (!shouldSkewBuy && this.inventory <= 0) {
      this.orderLogger.info('ℹ️ Нет ETH для размещения SELL ордеров, ждем исполнения BUY ордеров');
    }
  }

  async processFills() {
    try {
      // Получаем последние сделки
      const trades = await this.restClient.getMyTrades(this.config.symbol, 10);
      
      for (const trade of trades) {
        const tradeKey = `${trade.id}_${trade.timestamp}`;
        
        if (!this.tradeHistory.includes(tradeKey)) {
          this.tradeHistory.push(tradeKey);
          
          // Обрабатываем новую сделку
          await this.handleFill(trade);
        }
      }
      
    } catch (error) {
      this.errorLogger.error('Ошибка обработки исполнений:', error);
    }
  }

  async handleFill(trade) {
    try {
      this.logger.info(`💰 Исполнение: ${trade.side} ${trade.price} x ${trade.quantity}`);
      
      // Обновляем инвентарь
      const inventoryChange = trade.side === 'buy' ? parseFloat(trade.quantity) : -parseFloat(trade.quantity);
      this.inventory += inventoryChange;
      this.inventoryNotional += trade.side === 'buy' ? 
        parseFloat(trade.price) * parseFloat(trade.quantity) : 
        -parseFloat(trade.price) * parseFloat(trade.quantity);
      
      // Отправляем уведомление о сделке
      await this.sendTradeNotification(trade);
      
      // Ставим Take Profit
      await this.placeTakeProfit(trade);
      
      // Восстанавливаем уровень (для ёршиков)
      if (this.config.mode === 'hedgehog') {
        await this.replenishLevel(trade);
      }
      
    } catch (error) {
      this.errorLogger.error('Ошибка обработки исполнения:', error);
    }
  }

  async placeTakeProfit(trade) {
    try {
      const tpSide = trade.side === 'buy' ? 'sell' : 'buy';
      const tpPct = this.config.mode === 'ladder' ? 
        this.config.ladder.tp_pct : 
        this.config.hedgehog.tp_pct;
      
      const tpPrice = trade.side === 'buy' ? 
        parseFloat(trade.price) * (1 + tpPct / 100) :
        parseFloat(trade.price) * (1 - tpPct / 100);
      
      const clientOrderId = `TP_${trade.side}_${Date.now()}`;
      
      // Используем минимальный размер из конфига для TP
      const minQuantity = tpPrice > 0 ? this.config.hedgehog.order_size_usd / tpPrice : 0.001;
      
      const tpOrder = await this.restClient.placeOrder(
        this.config.symbol,
        tpSide,
        'limit',
        minQuantity,
        tpPrice,
        clientOrderId
      );
      
      this.orderLogger.info(`🎯 TP ордер размещен: ${tpSide} ${tpPrice} x ${minQuantity} (ID: ${tpOrder.id})`);
      
      this.takeProfitOrders.set(clientOrderId, {
        id: tpOrder.id,
        side: tpSide,
        price: tpPrice,
        quantity: minQuantity,
        entryPrice: parseFloat(trade.price),
        originalTrade: trade
      });
      
      this.logger.info(`🎯 TP ${tpSide}: ${tpPrice} x ${minQuantity}`);
      
      // Уведомление о размещении TP
      await this.sendTPNotification(trade, tpPrice, tpSide);
      
    } catch (error) {
      this.errorLogger.error(`Ошибка размещения TP: ${error.message || error}`, { error: error.toString() });
    }
  }

  async replenishLevel(trade) {
    try {
      // Для ёршиков - восстанавливаем выбитый уровень глубже
      const center = this.indicators.midPrice;
      const atr = this.indicators.atr_1m;
      const step = Math.ceil(this.config.hedgehog.step_k * atr * 100) / 100;
      
      // Размещаем ордер в том же направлении, что и исполненный
      const newPrice = trade.side === 'buy' ? 
        parseFloat(trade.price) - step :
        parseFloat(trade.price) + step;
      
      const clientOrderId = `REPLENISH_${trade.side}_${Date.now()}`;
      
      // Проверяем лимит по направлению перед размещением
      const maxDirectionUsd = this.config.hedgehog.max_direction_usd || 20;
      if (trade.side === 'buy' && this.inventoryNotional > maxDirectionUsd) {
        this.logger.info('⚠️ Лимит LONG превышен, пропускаем восстановление BUY');
        return;
      }
      if (trade.side === 'sell' && this.inventoryNotional < -maxDirectionUsd) {
        this.logger.info('⚠️ Лимит SHORT превышен, пропускаем восстановление SELL');
        return;
      }
      
      // Используем минимальный размер из конфига для восстановления
      const minQuantity = newPrice > 0 ? this.config.hedgehog.order_size_usd / newPrice : 0.001;
      
      const order = await this.restClient.placeOrder(
        this.config.symbol,
        trade.side,
        'limit',
        minQuantity,
        newPrice,
        clientOrderId
      );
      
      this.orderLogger.info(`🔄 Восстановление ${trade.side}: ${newPrice} x ${minQuantity} (ID: ${order.id})`);
      
      // Добавляем в активные ордера
      this.activeOrders.set(clientOrderId, {
        id: order.id,
        side: trade.side,
        price: newPrice,
        quantity: minQuantity,
        type: 'replenish'
      });
      
      this.logger.info(`🔄 Восстановление ${trade.side}: ${newPrice} x ${minQuantity}`);
      
    } catch (error) {
      this.errorLogger.error(`Ошибка восстановления уровня: ${error.message || error}`, { error: error.toString() });
    }
  }

  passRiskChecks() {
    // Проверка просадки
    if (this.totalPnL < -this.config.deposit_usd * this.config.risk.max_drawdown_pct / 100) {
      this.errorLogger.error('❌ Превышена максимальная просадка');
      return false;
    }
    
    // Проверка последовательных убытков
    if (this.consecutiveLosses >= this.config.risk.max_consecutive_losses) {
      this.errorLogger.error('❌ Слишком много убытков подряд');
      return false;
    }
    
    // Проверка лимита по инструменту - НЕ ОСТАНАВЛИВАЕМ, А ПЕРЕКЛЮЧАЕМ РЕЖИМ
    const currentNotional = Math.abs(this.inventoryNotional);
    if (currentNotional > this.config.deposit_usd * this.config.risk.max_notional_per_symbol / 100) {
      this.logger.info('⚠️ Превышен лимит по инструменту - переключаемся в режим "только продажи"');
      this.state = 'SELL_ONLY'; // Переключаем в режим только продаж
      return true; // Продолжаем работу, но в другом режиме
    }
    
    // Если лимит в норме, возвращаемся в обычный режим
    if (this.state === 'SELL_ONLY' && currentNotional <= this.config.deposit_usd * this.config.risk.max_notional_per_symbol / 100 * 0.8) {
      this.logger.info('✅ Лимит восстановлен - возвращаемся в обычный режим');
      this.state = 'QUOTING';
    }
    
    return true;
  }

  async emergencyStop() {
    this.errorLogger.error('🚨 АВАРИЙНАЯ ОСТАНОВКА');
    
    await this.cancelAllOrders();
    this.isRunning = false;
    
    await this.sendTelegramMessage(
      '🚨 *АВАРИЙНАЯ ОСТАНОВКА*\n\n' +
      `💰 PnL: ${this.totalPnL.toFixed(2)} USDC\n` +
      `📊 Инвентарь: ${this.inventory.toFixed(6)} ETH\n` +
      `💸 Инвентарь в $: ${this.inventoryNotional.toFixed(2)} USDC\n` +
      `❌ Убытков подряд: ${this.consecutiveLosses}\n\n` +
      'Бот остановлен для защиты депозита!'
    );
  }

  async cancelAllOrders() {
    try {
      const orders = await this.restClient.getOpenOrders(this.config.symbol);
      
      for (const order of orders) {
        try {
          await this.restClient.cancelOrder(this.config.symbol, order.id);
        } catch (error) {
          // Игнорируем ошибки отмены
        }
      }
      
      this.activeOrders.clear();
      this.takeProfitOrders.clear();
      
      this.orderLogger.info('🗑️ Все ордера отменены');
      
    } catch (error) {
      this.errorLogger.error('Ошибка отмены ордеров:', error);
    }
  }

  async initializeIndicators() {
    // Инициализируем индикаторы начальными значениями
    const ticker = await this.restClient.getBookTicker(this.config.symbol);
    this.indicators.midPrice = (parseFloat(ticker.bidPrice) + parseFloat(ticker.askPrice)) / 2;
    this.indicators.vwap_1h = this.indicators.midPrice;
    this.indicators.atr_1m = this.indicators.midPrice * 0.001; // 0.1% как начальное значение
    this.indicators.atr_5m = this.indicators.atr_1m * 2;
    
    this.logger.info('📊 Индикаторы инициализированы');
  }

  logStatus() {
    const status = {
      mode: this.config.mode,
      midPrice: this.indicators.midPrice.toFixed(2),
      vwap: this.indicators.vwap_1h.toFixed(2),
      atr: this.indicators.atr_1m.toFixed(4),
      inventory: this.inventory.toFixed(6),
      inventoryNotional: this.inventoryNotional.toFixed(2),
      activeOrders: this.activeOrders.size,
      takeProfitOrders: this.takeProfitOrders.size,
      totalPnL: this.totalPnL.toFixed(2)
    };
    
    this.logger.info('📊 Статус:', status);
  }

  async sendTelegramMessage(text) {
    try {
      await this.telegramBot.sendMessage(
        process.env.TELEGRAM_ADMIN_CHAT_IDS,
        text,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      this.errorLogger.error('Ошибка отправки в Telegram:', error);
    }
  }

  async sendTradeNotification(trade) {
    try {
      const side = trade.side === 'buy' ? '🟢 ПОКУПКА' : '🔴 ПРОДАЖА';
      const notional = (parseFloat(trade.price) * parseFloat(trade.quantity)).toFixed(2);
      const time = new Date().toLocaleTimeString('ru-RU');
      
      const message = 
        `💰 *СДЕЛКА ИСПОЛНЕНА*\n\n` +
        `${side}\n` +
        `💵 Цена: ${trade.price} USDC\n` +
        `📊 Количество: ${trade.quantity} ETH\n` +
        `💸 Сумма: ${notional} USDC\n` +
        `⏰ Время: ${time}\n\n` +
        `📈 *Статус:*\n` +
        `• Инвентарь: ${this.inventory.toFixed(6)} ETH\n` +
        `• В $: ${this.inventoryNotional.toFixed(2)} USDC\n` +
        `• Режим: ${this.config.mode === 'ladder' ? 'Лесенка' : 'Ёршики'}\n\n` +
        `🎯 TP размещен автоматически`;

      await this.sendTelegramMessage(message);
      
    } catch (error) {
      this.errorLogger.error('Ошибка отправки уведомления о сделке:', error);
    }
  }

  async sendTPNotification(trade, tpPrice, tpSide) {
    try {
      const tpPct = this.config.mode === 'ladder' ? 
        this.config.ladder.tp_pct : 
        this.config.hedgehog.tp_pct;
      
      const expectedProfit = Math.abs(tpPrice - parseFloat(trade.price)) * parseFloat(trade.quantity);
      
      const message = 
        `🎯 *TAKE PROFIT РАЗМЕЩЕН*\n\n` +
        `📊 ${tpSide.toUpperCase()}: ${tpPrice} USDC\n` +
        `📈 Ожидаемая прибыль: ${expectedProfit.toFixed(4)} USDC\n` +
        `📊 TP: ${tpPct}%\n` +
        `⏰ Время: ${new Date().toLocaleTimeString('ru-RU')}`;

      await this.sendTelegramMessage(message);
      
    } catch (error) {
      this.errorLogger.error('Ошибка отправки уведомления о TP:', error);
    }
  }

  async sendPeriodicStatus() {
    try {
      const currentOrders = await this.restClient.getOpenOrders(this.config.symbol);
      const buyOrders = currentOrders.filter(o => o.side === 'buy').length;
      const sellOrders = currentOrders.filter(o => o.side === 'sell').length;
      
      const message = 
        `📊 *ПЕРИОДИЧЕСКИЙ СТАТУС*\n\n` +
        `🎯 Режим: ${this.config.mode === 'ladder' ? 'Лесенка' : 'Ёршики'}\n` +
        `💰 Цена: ${this.indicators.midPrice.toFixed(2)} USDC\n` +
        `📈 VWAP: ${this.indicators.vwap_1h.toFixed(2)} USDC\n` +
        `📊 ATR: ${this.indicators.atr_1m.toFixed(4)} USDC\n\n` +
        `🟢 Buy ордеров: ${buyOrders}\n` +
        `🔴 Sell ордеров: ${sellOrders}\n` +
        `📊 Всего: ${currentOrders.length}\n\n` +
        `📈 *Позиция:*\n` +
        `• Инвентарь: ${this.inventory.toFixed(6)} ETH\n` +
        `• В $: ${this.inventoryNotional.toFixed(2)} USDC\n` +
        `• PnL: ${this.totalPnL.toFixed(2)} USDC\n\n` +
        `⏰ ${new Date().toLocaleTimeString('ru-RU')}`;

      await this.sendTelegramMessage(message);
      
    } catch (error) {
      this.errorLogger.error('Ошибка отправки периодического статуса:', error);
    }
  }

  async stop() {
    this.isRunning = false;
    await this.cancelAllOrders();
    
    await this.sendTelegramMessage(
      '🛑 *СКАЛЬПЕР ОСТАНОВЛЕН*\n\n' +
      `💰 Финальный PnL: ${this.totalPnL.toFixed(2)} USDC\n` +
      `📊 Инвентарь: ${this.inventory.toFixed(6)} ETH\n` +
      `💸 Инвентарь в $: ${this.inventoryNotional.toFixed(2)} USDC`
    );
    
    this.logger.info('🛑 Скальпер остановлен');
  }
}

// Запуск
async function main() {
  try {
    console.log('🚀 Запуск реального скальпера...');
    
    const scalper = new RealScalper();
    await scalper.start();
    
    console.log('✅ Реальный скальпер запущен!');
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('🛑 Получен SIGINT, завершаем...');
      await scalper.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('🛑 Получен SIGTERM, завершаем...');
      await scalper.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  }
}

main();
