"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalMinimumStrategy = void 0;
const technical_indicators_1 = require("../indicators/technical-indicators");
class LocalMinimumStrategy {
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
        if (candles.length > 1000) {
            candles.splice(0, candles.length - 1000);
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
        const currentCandle = candles[candles.length - 1];
        const currentPrice = currentCandle.close;
        // Moving Averages - извлекаем цены закрытия
        const closes = candles.map(c => c.close);
        const ema20Array = technical_indicators_1.MovingAverages.ema(closes, 20);
        const ema50Array = technical_indicators_1.MovingAverages.ema(closes, 50);
        const sma200Array = technical_indicators_1.MovingAverages.sma(closes, 200);
        // Берем последние значения
        const ema20 = ema20Array[ema20Array.length - 1];
        const ema50 = ema50Array[ema50Array.length - 1];
        const sma200 = sma200Array[sma200Array.length - 1];
        // RSI
        const rsi = technical_indicators_1.RSI.calculate(candles, 14);
        // MACD
        const macd = technical_indicators_1.MACD.calculate(candles);
        // Bollinger Bands
        const bollinger = technical_indicators_1.BollingerBands.calculate(candles, 20, 2);
        const bbPosition = ((currentPrice - bollinger.lower) / (bollinger.upper - bollinger.lower)) * 100;
        // Volume Analysis
        const volumeRatio = technical_indicators_1.VolumeAnalysis.getVolumeRatio(candles);
        const isVolumeIncreasing = volumeRatio > 1.2;
        // Support and Resistance
        const levels = technical_indicators_1.SupportResistance.findLevels(candles, 5);
        const support = levels.supports.length > 0 ? Math.max(...levels.supports) : null;
        const resistance = levels.resistances.length > 0 ? Math.min(...levels.resistances) : null;
        // Определение тренда
        let trend = 'SIDEWAYS';
        let trendStrength = 0;
        if (currentPrice > ema20 && ema20 > ema50 && ema50 > sma200) {
            trend = 'UP';
            trendStrength = Math.min(100, ((currentPrice - sma200) / sma200) * 100);
        }
        else if (currentPrice < ema20 && ema20 < ema50 && ema50 < sma200) {
            trend = 'DOWN';
            trendStrength = Math.min(100, ((sma200 - currentPrice) / sma200) * 100);
        }
        // Проверка на локальный минимум
        const isLocalMinimum = this.checkLocalMinimum(candles, currentPrice);
        return {
            symbol,
            trend,
            trendStrength: Math.max(0, Math.min(100, trendStrength)),
            isLocalMinimum,
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
     * Проверить является ли текущая цена локальным минимумом
     */
    checkLocalMinimum(candles, currentPrice) {
        if (candles.length < 10)
            return false;
        const lookback = Math.min(10, candles.length - 1);
        const recentCandles = candles.slice(-lookback - 1, -1); // исключаем текущую свечу
        // Проверяем что текущая цена ниже всех цен за последние N свечей
        const allPrices = recentCandles.flatMap(c => [c.high, c.low, c.close]);
        const minRecentPrice = Math.min(...allPrices);
        // Текущая цена должна быть ниже или равна минимальной за период
        const isMinimum = currentPrice <= minRecentPrice * 1.001; // 0.1% допуск
        // Дополнительная проверка: цена должна быть ниже EMA20
        const closes = candles.map(c => c.close);
        const ema20Array = technical_indicators_1.MovingAverages.ema(closes, 20);
        const ema20 = ema20Array[ema20Array.length - 1];
        const belowEMA = currentPrice < ema20;
        return isMinimum && belowEMA;
    }
    /**
     * Получить сигнал на покупку в локальном минимуме
     */
    getLocalMinimumSignal(symbol) {
        const analysis = this.getMarketAnalysis(symbol);
        if (!analysis) {
            return null;
        }
        const { trend, trendStrength, isLocalMinimum, rsi, macd, bollinger, volume, support, currentPrice } = analysis;
        // Условия для входа в локальном минимуме
        let confidence = 0;
        let reason = '';
        // 1. Должен быть локальный минимум
        if (isLocalMinimum) {
            confidence += 30;
            reason += 'Локальный минимум. ';
        }
        else {
            return {
                symbol,
                signal: 'HOLD',
                confidence: 0,
                entryPrice: currentPrice,
                stopLoss: currentPrice,
                takeProfit: currentPrice,
                reason: 'Не локальный минимум',
                timestamp: analysis.timestamp
            };
        }
        // 2. RSI показывает перепроданность (но не экстремальную)
        if (rsi >= 25 && rsi <= 45) {
            confidence += 25;
            reason += `RSI перепродан ${rsi.toFixed(1)}. `;
        }
        else if (rsi < 25) {
            confidence += 15; // Слишком перепродан - может быть еще падение
            reason += `RSI экстремально перепродан ${rsi.toFixed(1)}. `;
        }
        else if (rsi > 45) {
            confidence += 10;
            reason += `RSI ${rsi.toFixed(1)}. `;
        }
        // 3. Цена у нижней границы Bollinger Bands
        if (bollinger.position < 25) {
            confidence += 20;
            reason += 'У нижней границы BB. ';
        }
        else if (bollinger.position < 40) {
            confidence += 10;
            reason += 'Близко к нижней границе BB. ';
        }
        // 4. MACD показывает готовность к развороту
        if (macd.histogram > macd.signal * 0.3) {
            confidence += 15;
            reason += 'MACD готов к развороту. ';
        }
        // 5. Объемы подтверждают (растущие объемы на минимуме)
        if (volume.isIncreasing) {
            confidence += 10;
            reason += 'Объемы растут. ';
        }
        // 6. Цена у уровня поддержки
        if (support && currentPrice <= support * 1.005) { // 0.5% допуск
            confidence += 15;
            reason += 'У уровня поддержки. ';
        }
        // 7. Общий тренд не должен быть сильно нисходящим
        if (trend !== 'DOWN' || trendStrength < 50) {
            confidence += 10;
            reason += 'Тренд не сильно нисходящий. ';
        }
        // Определяем сигнал
        let signal = 'HOLD';
        if (confidence >= 80) {
            signal = 'BUY';
        }
        else if (confidence >= 60) {
            signal = 'HOLD'; // Ждем лучших условий
        }
        // Расчет уровней
        const stopLoss = support ? support * 0.995 : currentPrice * 0.98; // 0.5-2% ниже поддержки
        const takeProfit = currentPrice * 1.03; // 3% цель
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
exports.LocalMinimumStrategy = LocalMinimumStrategy;
//# sourceMappingURL=local-minimum-strategy.js.map