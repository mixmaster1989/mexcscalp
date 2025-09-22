"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportResistance = exports.VolumeAnalysis = exports.Stochastic = exports.MACD = exports.BollingerBands = exports.RSI = exports.MovingAverages = void 0;
/**
 * Простые скользящие средние
 */
class MovingAverages {
    /**
     * Простая скользящая средняя (SMA)
     */
    static sma(data, period) {
        const result = [];
        for (let i = period - 1; i < data.length; i++) {
            const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            result.push(sum / period);
        }
        return result;
    }
    /**
     * Экспоненциальная скользящая средняя (EMA)
     */
    static ema(data, period) {
        const result = [];
        const multiplier = 2 / (period + 1);
        // Первое значение - это SMA
        const firstSMA = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
        result.push(firstSMA);
        for (let i = period; i < data.length; i++) {
            const ema = (data[i] - result[result.length - 1]) * multiplier + result[result.length - 1];
            result.push(ema);
        }
        return result;
    }
    /**
     * Получить последние значения EMA
     */
    static getLastEMA(candles, period) {
        const closes = candles.map(c => c.close);
        const emaValues = this.ema(closes, period);
        return emaValues[emaValues.length - 1] || 0;
    }
}
exports.MovingAverages = MovingAverages;
/**
 * RSI (Relative Strength Index)
 */
class RSI {
    static calculate(candles, period = 14) {
        if (candles.length < period + 1)
            return 50;
        const closes = candles.map(c => c.close);
        const gains = [];
        const losses = [];
        for (let i = 1; i < closes.length; i++) {
            const change = closes[i] - closes[i - 1];
            gains.push(change > 0 ? change : 0);
            losses.push(change < 0 ? Math.abs(change) : 0);
        }
        const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
        const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
        if (avgLoss === 0)
            return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }
}
exports.RSI = RSI;
/**
 * Bollinger Bands
 */
class BollingerBands {
    static calculate(candles, period = 20, stdDev = 2) {
        const closes = candles.map(c => c.close);
        const sma = MovingAverages.sma(closes, period);
        const middle = sma[sma.length - 1] || 0;
        // Вычисляем стандартное отклонение
        const recentCloses = closes.slice(-period);
        const variance = recentCloses.reduce((sum, close) => {
            return sum + Math.pow(close - middle, 2);
        }, 0) / period;
        const standardDeviation = Math.sqrt(variance);
        return {
            upper: middle + (standardDeviation * stdDev),
            middle,
            lower: middle - (standardDeviation * stdDev)
        };
    }
}
exports.BollingerBands = BollingerBands;
/**
 * MACD
 */
class MACD {
    static calculate(candles, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        const closes = candles.map(c => c.close);
        const fastEMA = MovingAverages.ema(closes, fastPeriod);
        const slowEMA = MovingAverages.ema(closes, slowPeriod);
        const macdLine = fastEMA.map((fast, i) => fast - slowEMA[i]);
        const signalLine = MovingAverages.ema(macdLine, signalPeriod);
        const macd = macdLine[macdLine.length - 1] || 0;
        const signal = signalLine[signalLine.length - 1] || 0;
        const histogram = macd - signal;
        return { macd, signal, histogram };
    }
}
exports.MACD = MACD;
/**
 * Stochastic Oscillator
 */
class Stochastic {
    static calculate(candles, kPeriod = 14, dPeriod = 3) {
        if (candles.length < kPeriod)
            return { k: 50, d: 50 };
        const recentCandles = candles.slice(-kPeriod);
        const highestHigh = Math.max(...recentCandles.map(c => c.high));
        const lowestLow = Math.min(...recentCandles.map(c => c.low));
        const currentClose = candles[candles.length - 1].close;
        const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
        // Для упрощения, D = K (в реальности это SMA от K)
        return { k, d: k };
    }
}
exports.Stochastic = Stochastic;
/**
 * Volume Analysis
 */
class VolumeAnalysis {
    /**
     * Средний объем за период
     */
    static getAverageVolume(candles, period = 20) {
        const volumes = candles.slice(-period).map(c => c.volume);
        return volumes.reduce((a, b) => a + b, 0) / volumes.length;
    }
    /**
     * Отношение текущего объема к среднему
     */
    static getVolumeRatio(candles, period = 20) {
        const currentVolume = candles[candles.length - 1].volume;
        const avgVolume = this.getAverageVolume(candles, period);
        return currentVolume / avgVolume;
    }
}
exports.VolumeAnalysis = VolumeAnalysis;
/**
 * Support and Resistance Levels
 */
class SupportResistance {
    /**
     * Найти локальные максимумы и минимумы
     */
    static findLevels(candles, lookback = 5) {
        const supports = [];
        const resistances = [];
        for (let i = lookback; i < candles.length - lookback; i++) {
            const current = candles[i];
            const left = candles.slice(i - lookback, i);
            const right = candles.slice(i + 1, i + lookback + 1);
            // Проверяем на локальный минимум (поддержка)
            const isLocalMin = left.every(c => c.low >= current.low) &&
                right.every(c => c.low >= current.low);
            if (isLocalMin) {
                supports.push(current.low);
            }
            // Проверяем на локальный максимум (сопротивление)
            const isLocalMax = left.every(c => c.high <= current.high) &&
                right.every(c => c.high <= current.high);
            if (isLocalMax) {
                resistances.push(current.high);
            }
        }
        return { supports, resistances };
    }
}
exports.SupportResistance = SupportResistance;
//# sourceMappingURL=technical-indicators.js.map