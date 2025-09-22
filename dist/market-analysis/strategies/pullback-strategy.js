"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PullbackStrategy = void 0;
const technical_indicators_1 = require("../indicators/technical-indicators");
class PullbackStrategy {
    candles = new Map();
    minCandles = 100;
    lookbackPeriod = 20;
    /**
     * Обновить данные свечей
     */
    updateCandles(symbol, newCandle) {
        if (!this.candles.has(symbol)) {
            this.candles.set(symbol, []);
        }
        const candles = this.candles.get(symbol);
        candles.push(newCandle);
        // Ограничиваем количество свечей
        if (candles.length > 500) {
            candles.splice(0, candles.length - 500);
        }
    }
    /**
     * Получить анализ рынка
     */
    getMarketAnalysis(symbol) {
        const candles = this.candles.get(symbol);
        if (!candles || candles.length < this.minCandles) {
            return null;
        }
        const currentPrice = candles[candles.length - 1].close;
        const currentCandle = candles[candles.length - 1];
        // Анализ тренда
        const ema21 = technical_indicators_1.MovingAverages.getLastEMA(candles, 21);
        const ema50 = technical_indicators_1.MovingAverages.getLastEMA(candles, 50);
        const ema200 = technical_indicators_1.MovingAverages.getLastEMA(candles, 200);
        let trend = 'SIDEWAYS';
        let trendStrength = 0;
        if (ema21 > ema50 && ema50 > ema200) {
            trend = 'UP';
            trendStrength = Math.min(100, ((ema21 - ema200) / ema200) * 1000);
        }
        else if (ema21 < ema50 && ema50 < ema200) {
            trend = 'DOWN';
            trendStrength = Math.min(100, ((ema200 - ema21) / ema200) * 1000);
        }
        // RSI
        const rsi = technical_indicators_1.RSI.calculate(candles, 14);
        // MACD
        const macd = technical_indicators_1.MACD.calculate(candles);
        // Bollinger Bands
        const bollinger = technical_indicators_1.BollingerBands.calculate(candles);
        const bbPosition = ((currentPrice - bollinger.lower) / (bollinger.upper - bollinger.lower)) * 100;
        // Volume Analysis
        const volumeRatio = technical_indicators_1.VolumeAnalysis.getVolumeRatio(candles);
        const isVolumeIncreasing = volumeRatio > 1.2;
        // Support and Resistance
        const levels = technical_indicators_1.SupportResistance.findLevels(candles, 5);
        const support = levels.supports.length > 0 ? Math.max(...levels.supports) : null;
        const resistance = levels.resistances.length > 0 ? Math.min(...levels.resistances) : null;
        // Расчет уровня отката
        let pullbackLevel = 0;
        if (trend === 'UP' && resistance) {
            const range = resistance - ema50;
            const currentRange = currentPrice - ema50;
            pullbackLevel = (currentRange / range) * 100;
        }
        else if (trend === 'DOWN' && support) {
            const range = ema50 - support;
            const currentRange = ema50 - currentPrice;
            pullbackLevel = (currentRange / range) * 100;
        }
        return {
            symbol,
            trend,
            trendStrength: Math.max(0, Math.min(100, trendStrength)),
            pullbackLevel: Math.max(0, Math.min(100, pullbackLevel)),
            rsi,
            macd,
            bollinger: {
                ...bollinger,
                position: Math.max(0, Math.min(100, bbPosition))
            },
            volume: {
                ratio: volumeRatio,
                isIncreasing: isVolumeIncreasing
            },
            support,
            resistance,
            currentPrice,
            timestamp: currentCandle.timestamp
        };
    }
    /**
     * Получить сигнал на покупку в откате
     */
    getPullbackSignal(symbol) {
        const analysis = this.getMarketAnalysis(symbol);
        if (!analysis) {
            return null;
        }
        const { trend, trendStrength, pullbackLevel, rsi, macd, bollinger, volume, support, currentPrice } = analysis;
        // Условия для входа в откат
        let confidence = 0;
        let reason = '';
        // 1. Основной тренд должен быть восходящим
        if (trend === 'UP' && trendStrength > 30) {
            confidence += 20;
            reason += 'Восходящий тренд. ';
        }
        else {
            return {
                symbol,
                signal: 'HOLD',
                confidence: 0,
                entryPrice: currentPrice,
                stopLoss: currentPrice,
                takeProfit: currentPrice,
                reason: 'Тренд не восходящий',
                timestamp: analysis.timestamp
            };
        }
        // 2. Цена должна откатиться к уровню поддержки (30-70% отката)
        if (pullbackLevel >= 30 && pullbackLevel <= 70) {
            confidence += 25;
            reason += `Откат ${pullbackLevel.toFixed(1)}%. `;
        }
        else if (pullbackLevel > 70) {
            confidence += 15;
            reason += `Глубокий откат ${pullbackLevel.toFixed(1)}%. `;
        }
        // 3. RSI показывает перепроданность
        if (rsi < 40) {
            confidence += 20;
            reason += `RSI перепродан ${rsi.toFixed(1)}. `;
        }
        else if (rsi < 50) {
            confidence += 10;
            reason += `RSI ${rsi.toFixed(1)}. `;
        }
        // 4. MACD готов к развороту
        if (macd.histogram > macd.signal * 0.5) {
            confidence += 15;
            reason += 'MACD готов к развороту. ';
        }
        // 5. Цена у нижней границы Bollinger Bands
        if (bollinger.position < 30) {
            confidence += 15;
            reason += 'У нижней границы BB. ';
        }
        // 6. Объемы подтверждают
        if (volume.isIncreasing) {
            confidence += 10;
            reason += 'Объемы растут. ';
        }
        // 7. Цена у уровня поддержки
        if (support && currentPrice <= support * 1.002) { // 0.2% допуск
            confidence += 15;
            reason += 'У уровня поддержки. ';
        }
        // Определяем сигнал
        let signal = 'HOLD';
        if (confidence >= 70) {
            signal = 'BUY';
        }
        else if (confidence >= 50) {
            signal = 'HOLD'; // Ждем лучших условий
        }
        // Расчет уровней
        const stopLoss = support ? support * 0.998 : currentPrice * 0.995; // 0.2-0.5% ниже поддержки
        const takeProfit = currentPrice * 1.02; // 2% цель
        return {
            symbol,
            signal,
            confidence,
            entryPrice: currentPrice,
            stopLoss,
            takeProfit,
            reason: reason.trim(),
            timestamp: analysis.timestamp
        };
    }
    /**
     * Получить статистику по символу
     */
    getSymbolStats(symbol) {
        const candles = this.candles.get(symbol);
        if (!candles || candles.length === 0) {
            return null;
        }
        return {
            candleCount: candles.length,
            lastUpdate: candles[candles.length - 1].timestamp
        };
    }
}
exports.PullbackStrategy = PullbackStrategy;
//# sourceMappingURL=pullback-strategy.js.map