"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketSnapshotLogger = void 0;
class MarketSnapshotLogger {
    snapshots = [];
    maxSnapshots = 10000;
    /**
     * Создать снимок состояния рынка
     */
    createSnapshot(symbol, analysis, currentCandle, historicalCandles) {
        const now = new Date();
        // Вычисляем дополнительные метрики
        const priceChange1m = this.calculatePriceChange(historicalCandles, 1);
        const priceChange5m = this.calculatePriceChange(historicalCandles, 5);
        const priceChange15m = this.calculatePriceChange(historicalCandles, 15);
        const priceChange1h = this.calculatePriceChange(historicalCandles, 60);
        const volatility = this.calculateVolatility(historicalCandles, 20);
        const spread = this.calculateSpread(currentCandle);
        // Расстояния до уровней
        const distanceToSupport = analysis.support ?
            ((analysis.currentPrice - analysis.support) / analysis.currentPrice) * 100 : null;
        const distanceToResistance = analysis.resistance ?
            ((analysis.resistance - analysis.currentPrice) / analysis.currentPrice) * 100 : null;
        const snapshot = {
            timestamp: analysis.timestamp,
            symbol,
            price: analysis.currentPrice,
            currentVolume: currentCandle.volume,
            indicators: {
                rsi: analysis.rsi,
                macd: analysis.macd,
                bollinger: analysis.bollinger,
                ema: {
                    ema21: analysis.macd.macd, // Временно, нужно добавить в MarketAnalysis
                    ema50: analysis.macd.signal, // Временно
                    ema200: analysis.macd.histogram // Временно
                },
                stochastic: {
                    k: analysis.rsi, // Временно, нужно добавить в MarketAnalysis
                    d: analysis.rsi // Временно
                }
            },
            trend: {
                direction: analysis.trend,
                strength: analysis.trendStrength,
                isLocalMinimum: analysis.isLocalMinimum
            },
            volumeAnalysis: {
                ratio: analysis.volume.ratio,
                isIncreasing: analysis.volume.isIncreasing,
                averageVolume: this.calculateAverageVolume(historicalCandles, 20)
            },
            levels: {
                support: analysis.support,
                resistance: analysis.resistance,
                distanceToSupport,
                distanceToResistance
            },
            time: {
                hour: now.getHours(),
                dayOfWeek: now.getDay(),
                isMarketOpen: this.isMarketOpen(now)
            },
            metrics: {
                priceChange1m,
                priceChange5m,
                priceChange15m,
                priceChange1h,
                volatility,
                spread
            }
        };
        this.addSnapshot(snapshot);
        return snapshot;
    }
    /**
     * Добавить снимок в коллекцию
     */
    addSnapshot(snapshot) {
        this.snapshots.push(snapshot);
        // Ограничиваем количество снимков
        if (this.snapshots.length > this.maxSnapshots) {
            this.snapshots.splice(0, this.snapshots.length - this.maxSnapshots);
        }
    }
    /**
     * Вычислить изменение цены за период
     */
    calculatePriceChange(candles, minutes) {
        if (candles.length < minutes)
            return 0;
        const currentPrice = candles[candles.length - 1].close;
        const pastPrice = candles[candles.length - minutes - 1].close;
        return ((currentPrice - pastPrice) / pastPrice) * 100;
    }
    /**
     * Вычислить волатильность
     */
    calculateVolatility(candles, period) {
        if (candles.length < period)
            return 0;
        const recentCandles = candles.slice(-period);
        const returns = recentCandles.map((candle, i) => {
            if (i === 0)
                return 0;
            return (candle.close - recentCandles[i - 1].close) / recentCandles[i - 1].close;
        });
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
        return Math.sqrt(variance) * 100; // В процентах
    }
    /**
     * Вычислить спред (упрощенно)
     */
    calculateSpread(candle) {
        return ((candle.high - candle.low) / candle.close) * 100;
    }
    /**
     * Вычислить средний объем
     */
    calculateAverageVolume(candles, period) {
        if (candles.length < period)
            return 0;
        const recentVolumes = candles.slice(-period).map(c => c.volume);
        return recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
    }
    /**
     * Проверить, открыт ли рынок
     */
    isMarketOpen(date) {
        const hour = date.getHours();
        const day = date.getDay();
        // Криптовалютный рынок работает 24/7, но можно добавить логику
        return true;
    }
    /**
     * Получить все снимки
     */
    getAllSnapshots() {
        return [...this.snapshots];
    }
    /**
     * Получить снимки по символу
     */
    getSnapshotsBySymbol(symbol) {
        return this.snapshots.filter(s => s.symbol === symbol);
    }
    /**
     * Получить последние N снимков
     */
    getLastSnapshots(count) {
        return this.snapshots.slice(-count);
    }
    /**
     * Очистить снимки
     */
    clearSnapshots() {
        this.snapshots = [];
    }
    /**
     * Сохранить снимки в файл
     */
    async saveToFile(filename) {
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const data = JSON.stringify(this.snapshots, null, 2);
        await fs.writeFile(filename, data, 'utf8');
    }
    /**
     * Загрузить снимки из файла
     */
    async loadFromFile(filename) {
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const data = await fs.readFile(filename, 'utf8');
        this.snapshots = JSON.parse(data);
    }
}
exports.MarketSnapshotLogger = MarketSnapshotLogger;
//# sourceMappingURL=market-snapshot.js.map