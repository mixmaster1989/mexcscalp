import { ATRData, VWAPData, EMAData, OBIData, TFIData, OrderbookLevel, Trade } from './types';

/**
 * Математические утилиты для торговых индикаторов
 */

// Класс для вычисления ATR (Average True Range)
export class ATRCalculator {
  private highs: number[] = [];
  private lows: number[] = [];
  private closes: number[] = [];
  private period: number;

  constructor(period: number) {
    this.period = period;
  }

  /**
   * Добавить новую свечу и вычислить ATR
   */
  addCandle(high: number, low: number, close: number): ATRData | null {
    this.highs.push(high);
    this.lows.push(low);
    this.closes.push(close);

    // Ограничиваем размер массивов
    if (this.highs.length > this.period + 1) {
      this.highs.shift();
      this.lows.shift();
      this.closes.shift();
    }

    if (this.closes.length < 2) return null;

    const trueRanges: number[] = [];
    
    for (let i = 1; i < this.closes.length; i++) {
      const tr1 = this.highs[i] - this.lows[i];
      const tr2 = Math.abs(this.highs[i] - this.closes[i - 1]);
      const tr3 = Math.abs(this.lows[i] - this.closes[i - 1]);
      const trueRange = Math.max(tr1, tr2, tr3);
      trueRanges.push(trueRange);
    }

    if (trueRanges.length < this.period) return null;

    const atr = trueRanges.slice(-this.period).reduce((sum, tr) => sum + tr, 0) / this.period;

    return {
      value: atr,
      period: this.period,
      timestamp: Date.now()
    };
  }
}

// Класс для вычисления VWAP (Volume Weighted Average Price)
export class VWAPCalculator {
  private trades: Array<{ price: number; volume: number; timestamp: number }> = [];
  private windowMs: number;

  constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  /**
   * Добавить новую сделку и вычислить VWAP
   */
  addTrade(price: number, volume: number): VWAPData {
    const now = Date.now();
    this.trades.push({ price, volume, timestamp: now });

    // Удаляем старые сделки вне окна
    const cutoff = now - this.windowMs;
    this.trades = this.trades.filter(trade => trade.timestamp >= cutoff);

    let totalVolume = 0;
    let totalValue = 0;

    for (const trade of this.trades) {
      totalVolume += trade.volume;
      totalValue += trade.price * trade.volume;
    }

    const vwap = totalVolume > 0 ? totalValue / totalVolume : 0;

    return {
      value: vwap,
      volume: totalVolume,
      timestamp: now
    };
  }
}

// Класс для вычисления EMA (Exponential Moving Average)
export class EMACalculator {
  private alpha: number;
  private ema: number | null = null;
  private period: number;

  constructor(period: number) {
    this.period = period;
    this.alpha = 2 / (period + 1);
  }

  /**
   * Добавить новое значение и вычислить EMA
   */
  addValue(value: number): EMAData {
    if (this.ema === null) {
      this.ema = value;
    } else {
      this.ema = this.alpha * value + (1 - this.alpha) * this.ema;
    }

    return {
      value: this.ema,
      period: this.period,
      timestamp: Date.now()
    };
  }

  /**
   * Получить текущее значение EMA
   */
  getValue(): number | null {
    return this.ema;
  }
}

// Класс для вычисления Z-Score
export class ZScoreCalculator {
  private values: number[] = [];
  private period: number;

  constructor(period: number) {
    this.period = period;
  }

  /**
   * Добавить новое значение и вычислить Z-Score
   */
  addValue(value: number, reference: number): number {
    this.values.push(value);

    if (this.values.length > this.period) {
      this.values.shift();
    }

    if (this.values.length < 2) return 0;

    const mean = this.values.reduce((sum, v) => sum + v, 0) / this.values.length;
    const variance = this.values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / this.values.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    return (reference - mean) / stdDev;
  }
}

// Класс для вычисления OBI (Order Book Imbalance)
export class OBICalculator {
  /**
   * Вычислить OBI на основе стакана
   */
  calculate(bids: OrderbookLevel[], asks: OrderbookLevel[], levels: number = 5): OBIData {
    const topBids = bids.slice(0, levels);
    const topAsks = asks.slice(0, levels);

    const bidDepth = topBids.reduce((sum, level) => sum + level.price * level.quantity, 0);
    const askDepth = topAsks.reduce((sum, level) => sum + level.price * level.quantity, 0);

    const totalDepth = bidDepth + askDepth;
    const obi = totalDepth > 0 ? bidDepth / totalDepth : 0.5;

    return {
      value: obi,
      bidDepth,
      askDepth,
      timestamp: Date.now()
    };
  }
}

// Класс для вычисления TFI (Trade Flow Imbalance)
export class TFICalculator {
  private trades: Array<{ side: 'buy' | 'sell'; volume: number; timestamp: number }> = [];
  private windowMs: number;

  constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  /**
   * Добавить новую сделку и вычислить TFI
   */
  addTrade(side: 'buy' | 'sell', volume: number): TFIData {
    const now = Date.now();
    this.trades.push({ side, volume, timestamp: now });

    // Удаляем старые сделки вне окна
    const cutoff = now - this.windowMs;
    this.trades = this.trades.filter(trade => trade.timestamp >= cutoff);

    let buyVolume = 0;
    let sellVolume = 0;

    for (const trade of this.trades) {
      if (trade.side === 'buy') {
        buyVolume += trade.volume;
      } else {
        sellVolume += trade.volume;
      }
    }

    const totalVolume = buyVolume + sellVolume;
    const tfi = totalVolume > 0 ? buyVolume / totalVolume : 0.5;

    return {
      value: tfi,
      buyVolume,
      sellVolume,
      timestamp: now
    };
  }
}

// Утилиты округления
export class RoundingUtils {
  /**
   * Округлить цену к тику
   */
  static roundToTick(price: number, tickSize: number): number {
    if (tickSize === 0) return price;
    return Math.round(price / tickSize) * tickSize;
  }

  /**
   * Округлить количество к шагу
   */
  static roundToStep(quantity: number, stepSize: number): number {
    if (stepSize === 0) return quantity;
    return Math.floor(quantity / stepSize) * stepSize;
  }

  /**
   * Проверить минимальный размер позиции
   */
  static validateNotional(price: number, quantity: number, minNotional: number): boolean {
    return price * quantity >= minNotional;
  }

  /**
   * Вычислить размер позиции для заданного notional
   */
  static calculateQuantityForNotional(price: number, notional: number, stepSize: number): number {
    const rawQuantity = notional / price;
    return this.roundToStep(rawQuantity, stepSize);
  }

  /**
   * Проверить валидность цены и количества
   */
  static validateOrder(
    price: number,
    quantity: number,
    tickSize: number,
    stepSize: number,
    minNotional: number
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Проверка округления цены
    const roundedPrice = this.roundToTick(price, tickSize);
    if (Math.abs(price - roundedPrice) > 1e-8) {
      errors.push(`Price ${price} не соответствует tickSize ${tickSize}`);
    }

    // Проверка округления количества
    const roundedQuantity = this.roundToStep(quantity, stepSize);
    if (Math.abs(quantity - roundedQuantity) > 1e-8) {
      errors.push(`Quantity ${quantity} не соответствует stepSize ${stepSize}`);
    }

    // Проверка минимального notional
    if (!this.validateNotional(price, quantity, minNotional)) {
      errors.push(`Notional ${price * quantity} меньше минимального ${minNotional}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Утилиты для работы с временем
export class TimeUtils {
  /**
   * Получить монотонное время в миллисекундах
   */
  static getMonotonicTime(): number {
    return Date.now();
  }

  /**
   * Получить Unix timestamp в миллисекундах
   */
  static getTimestamp(): number {
    return Date.now();
  }

  /**
   * Проверить, не устарели ли данные
   */
  static isStale(timestamp: number, maxAgeMs: number): boolean {
    return Date.now() - timestamp > maxAgeMs;
  }

  /**
   * Форматировать время для логов
   */
  static formatTime(timestamp: number = Date.now()): string {
    return new Date(timestamp).toISOString();
  }
}

// Статистические утилиты
export class StatsUtils {
  /**
   * Вычислить среднее значение
   */
  static mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Вычислить стандартное отклонение
   */
  static standardDeviation(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = this.mean(values);
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Вычислить процентиль
   */
  static percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) return sorted[lower];
    
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  /**
   * Вычислить Sharpe ratio
   */
  static sharpeRatio(returns: number[], riskFreeRate: number = 0): number {
    if (returns.length < 2) return 0;
    const excessReturns = returns.map(r => r - riskFreeRate);
    const meanExcess = this.mean(excessReturns);
    const stdExcess = this.standardDeviation(excessReturns);
    return stdExcess > 0 ? meanExcess / stdExcess : 0;
  }
} 