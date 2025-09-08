"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatsUtils = exports.TimeUtils = exports.RoundingUtils = exports.TFICalculator = exports.OBICalculator = exports.ZScoreCalculator = exports.EMACalculator = exports.VWAPCalculator = exports.ATRCalculator = void 0;
/**
 * Математические утилиты для торговых индикаторов
 */
// Класс для вычисления ATR (Average True Range)
class ATRCalculator {
    highs = [];
    lows = [];
    closes = [];
    period;
    constructor(period) {
        this.period = period;
    }
    /**
     * Добавить новую свечу и вычислить ATR
     */
    addCandle(high, low, close) {
        this.highs.push(high);
        this.lows.push(low);
        this.closes.push(close);
        // Ограничиваем размер массивов
        if (this.highs.length > this.period + 1) {
            this.highs.shift();
            this.lows.shift();
            this.closes.shift();
        }
        if (this.closes.length < 2)
            return null;
        const trueRanges = [];
        for (let i = 1; i < this.closes.length; i++) {
            const tr1 = this.highs[i] - this.lows[i];
            const tr2 = Math.abs(this.highs[i] - this.closes[i - 1]);
            const tr3 = Math.abs(this.lows[i] - this.closes[i - 1]);
            const trueRange = Math.max(tr1, tr2, tr3);
            trueRanges.push(trueRange);
        }
        if (trueRanges.length < this.period)
            return null;
        const atr = trueRanges.slice(-this.period).reduce((sum, tr) => sum + tr, 0) / this.period;
        return {
            value: atr,
            period: this.period,
            timestamp: Date.now()
        };
    }
}
exports.ATRCalculator = ATRCalculator;
// Класс для вычисления VWAP (Volume Weighted Average Price)
class VWAPCalculator {
    trades = [];
    windowMs;
    constructor(windowMs) {
        this.windowMs = windowMs;
    }
    /**
     * Добавить новую сделку и вычислить VWAP
     */
    addTrade(price, volume) {
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
exports.VWAPCalculator = VWAPCalculator;
// Класс для вычисления EMA (Exponential Moving Average)
class EMACalculator {
    alpha;
    ema = null;
    period;
    constructor(period) {
        this.period = period;
        this.alpha = 2 / (period + 1);
    }
    /**
     * Добавить новое значение и вычислить EMA
     */
    addValue(value) {
        if (this.ema === null) {
            this.ema = value;
        }
        else {
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
    getValue() {
        return this.ema;
    }
}
exports.EMACalculator = EMACalculator;
// Класс для вычисления Z-Score
class ZScoreCalculator {
    values = [];
    period;
    constructor(period) {
        this.period = period;
    }
    /**
     * Добавить новое значение и вычислить Z-Score
     */
    addValue(value, reference) {
        this.values.push(value);
        if (this.values.length > this.period) {
            this.values.shift();
        }
        if (this.values.length < 2)
            return 0;
        const mean = this.values.reduce((sum, v) => sum + v, 0) / this.values.length;
        const variance = this.values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / this.values.length;
        const stdDev = Math.sqrt(variance);
        if (stdDev === 0)
            return 0;
        return (reference - mean) / stdDev;
    }
}
exports.ZScoreCalculator = ZScoreCalculator;
// Класс для вычисления OBI (Order Book Imbalance)
class OBICalculator {
    /**
     * Вычислить OBI на основе стакана
     */
    calculate(bids, asks, levels = 5) {
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
exports.OBICalculator = OBICalculator;
// Класс для вычисления TFI (Trade Flow Imbalance)
class TFICalculator {
    trades = [];
    windowMs;
    constructor(windowMs) {
        this.windowMs = windowMs;
    }
    /**
     * Добавить новую сделку и вычислить TFI
     */
    addTrade(side, volume) {
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
            }
            else {
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
exports.TFICalculator = TFICalculator;
// Утилиты округления
class RoundingUtils {
    /**
     * Округлить цену к тику
     */
    static roundToTick(price, tickSize) {
        if (tickSize === 0)
            return price;
        return Math.round(price / tickSize) * tickSize;
    }
    /**
     * Округлить количество к шагу
     */
    static roundToStep(quantity, stepSize) {
        if (stepSize === 0)
            return quantity;
        return Math.floor(quantity / stepSize) * stepSize;
    }
    /**
     * Проверить минимальный размер позиции
     */
    static validateNotional(price, quantity, minNotional) {
        return price * quantity >= minNotional;
    }
    /**
     * Вычислить размер позиции для заданного notional
     */
    static calculateQuantityForNotional(price, notional, stepSize) {
        const rawQuantity = notional / price;
        return this.roundToStep(rawQuantity, stepSize);
    }
    /**
     * Проверить валидность цены и количества
     */
    static validateOrder(price, quantity, tickSize, stepSize, minNotional) {
        const errors = [];
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
exports.RoundingUtils = RoundingUtils;
// Утилиты для работы с временем
class TimeUtils {
    /**
     * Получить монотонное время в миллисекундах
     */
    static getMonotonicTime() {
        return Date.now();
    }
    /**
     * Получить Unix timestamp в миллисекундах
     */
    static getTimestamp() {
        return Date.now();
    }
    /**
     * Проверить, не устарели ли данные
     */
    static isStale(timestamp, maxAgeMs) {
        return Date.now() - timestamp > maxAgeMs;
    }
    /**
     * Форматировать время для логов
     */
    static formatTime(timestamp = Date.now()) {
        return new Date(timestamp).toISOString();
    }
}
exports.TimeUtils = TimeUtils;
// Статистические утилиты
class StatsUtils {
    /**
     * Вычислить среднее значение
     */
    static mean(values) {
        if (values.length === 0)
            return 0;
        return values.reduce((sum, v) => sum + v, 0) / values.length;
    }
    /**
     * Вычислить стандартное отклонение
     */
    static standardDeviation(values) {
        if (values.length < 2)
            return 0;
        const mean = this.mean(values);
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }
    /**
     * Вычислить процентиль
     */
    static percentile(values, p) {
        if (values.length === 0)
            return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const index = (p / 100) * (sorted.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        if (lower === upper)
            return sorted[lower];
        const weight = index - lower;
        return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    }
    /**
     * Вычислить Sharpe ratio
     */
    static sharpeRatio(returns, riskFreeRate = 0) {
        if (returns.length < 2)
            return 0;
        const excessReturns = returns.map(r => r - riskFreeRate);
        const meanExcess = this.mean(excessReturns);
        const stdExcess = this.standardDeviation(excessReturns);
        return stdExcess > 0 ? meanExcess / stdExcess : 0;
    }
}
exports.StatsUtils = StatsUtils;
//# sourceMappingURL=math.js.map