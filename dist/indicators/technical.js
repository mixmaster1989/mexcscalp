"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TechnicalIndicators = void 0;
/**
 * Класс для расчета технических индикаторов
 */
class TechnicalIndicators {
    priceSeries = new Map();
    emaCache = new Map();
    /**
     * Добавить новую цену
     */
    addPrice(symbol, price, volume) {
        const timestamp = Date.now();
        if (!this.priceSeries.has(symbol)) {
            this.priceSeries.set(symbol, []);
        }
        const series = this.priceSeries.get(symbol);
        series.push({ timestamp, price, volume });
        // Оставляем только последние 100 точек для экономии памяти
        if (series.length > 100) {
            series.splice(0, series.length - 100);
        }
    }
    /**
     * Рассчитать волатильность за период
     */
    calculateVolatility(symbol, periodMs) {
        const series = this.priceSeries.get(symbol);
        if (!series || series.length < 2)
            return null;
        const now = Date.now();
        const cutoffTime = now - periodMs;
        // Фильтруем цены за нужный период
        const periodPrices = series.filter(p => p.timestamp >= cutoffTime);
        if (periodPrices.length < 2)
            return null;
        // Рассчитываем стандартное отклонение
        const prices = periodPrices.map(p => p.price);
        const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
        const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
        const stdDev = Math.sqrt(variance);
        // Волатильность как процент от средней цены
        const volatility = (stdDev / mean) * 100;
        return {
            value: volatility,
            period: periodMs,
            timestamp: now
        };
    }
    /**
     * Рассчитать EMA (экспоненциальная скользящая средняя)
     */
    calculateEMA(symbol, fastPeriod, slowPeriod) {
        const series = this.priceSeries.get(symbol);
        if (!series || series.length < 2)
            return null; // Минимум 2 точки для расчета
        const currentPrice = series[series.length - 1].price;
        const cached = this.emaCache.get(symbol);
        let fastEMA;
        let slowEMA;
        if (cached) {
            // Обновляем существующие EMA
            const fastAlpha = 2 / (fastPeriod + 1);
            const slowAlpha = 2 / (slowPeriod + 1);
            fastEMA = fastAlpha * currentPrice + (1 - fastAlpha) * cached.fast;
            slowEMA = slowAlpha * currentPrice + (1 - slowAlpha) * cached.slow;
        }
        else {
            // Инициализируем EMA как простую среднюю
            const fastPrices = series.slice(-fastPeriod);
            const slowPrices = series.slice(-slowPeriod);
            fastEMA = fastPrices.reduce((sum, p) => sum + p.price, 0) / fastPrices.length;
            slowEMA = slowPrices.reduce((sum, p) => sum + p.price, 0) / slowPrices.length;
        }
        // Кэшируем результат
        this.emaCache.set(symbol, { fast: fastEMA, slow: slowEMA });
        // Определяем сигнал
        let signal;
        const emaRatio = (fastEMA - slowEMA) / slowEMA * 100;
        if (emaRatio > 0.05) {
            signal = 'bullish';
        }
        else if (emaRatio < -0.05) {
            signal = 'bearish';
        }
        else {
            signal = 'neutral';
        }
        return {
            fast: fastEMA,
            slow: slowEMA,
            signal,
            timestamp: Date.now()
        };
    }
    /**
     * Анализ стакана ордеров
     */
    analyzeOrderbook(data, currentPrice) {
        const { bids, asks } = data;
        // Рассчитываем глубину стакана в USDT
        const bidDepth = bids.reduce((sum, bid) => sum + (bid.price * bid.quantity), 0);
        const askDepth = asks.reduce((sum, ask) => sum + (ask.price * ask.quantity), 0);
        // Спред
        const bestBid = bids[0]?.price || 0;
        const bestAsk = asks[0]?.price || 0;
        const spread = bestAsk > 0 ? ((bestAsk - bestBid) / bestBid) * 100 : 0;
        // Дисбаланс стакана
        const totalDepth = bidDepth + askDepth;
        const imbalance = totalDepth > 0 ? (bidDepth - askDepth) / totalDepth : 0;
        // Оценка ликвидности
        let liquidity;
        if (totalDepth > 1000) {
            liquidity = 'high';
        }
        else if (totalDepth > 200) {
            liquidity = 'medium';
        }
        else {
            liquidity = 'low';
        }
        return {
            bidDepth,
            askDepth,
            spread,
            imbalance,
            liquidity,
            timestamp: data.timestamp
        };
    }
    /**
     * Проверить условия для входа в сделку
     */
    checkEntryConditions(symbol, volatility, ema, orderbook, config) {
        const reasons = [];
        let confidence = 0;
        // Проверка волатильности
        if (volatility.value < config.minVolatility) {
            return {
                canEnter: false,
                confidence: 0,
                reasons: ['Недостаточная волатильность']
            };
        }
        confidence += 25;
        reasons.push('Волатильность достаточная');
        // Проверка спреда
        if (orderbook.spread > config.maxSpread) {
            return {
                canEnter: false,
                confidence: 0,
                reasons: ['Слишком большой спред']
            };
        }
        confidence += 20;
        reasons.push('Спред приемлемый');
        // Проверка ликвидности
        if (orderbook.bidDepth + orderbook.askDepth < config.minDepth) {
            return {
                canEnter: false,
                confidence: 0,
                reasons: ['Недостаточная ликвидность']
            };
        }
        confidence += 25;
        reasons.push('Ликвидность достаточная');
        // Определение направления по EMA
        let direction;
        if (ema.signal === 'bullish') {
            direction = 'buy';
            confidence += 20;
            reasons.push('EMA бычий сигнал');
        }
        else if (ema.signal === 'bearish') {
            direction = 'sell';
            confidence += 20;
            reasons.push('EMA медвежий сигнал');
        }
        else {
            confidence += 5;
            reasons.push('EMA нейтральный');
        }
        // Дополнительный бонус за дисбаланс стакана
        if (Math.abs(orderbook.imbalance) > 0.2) {
            confidence += 10;
            if (orderbook.imbalance > 0.2 && direction === 'buy') {
                confidence += 10;
                reasons.push('Дисбаланс стакана в пользу покупок');
            }
            else if (orderbook.imbalance < -0.2 && direction === 'sell') {
                confidence += 10;
                reasons.push('Дисбаланс стакана в пользу продаж');
            }
        }
        // Если EMA нейтральный но условия хорошие - случайное направление
        if (confidence >= 60 && direction === undefined) {
            direction = Math.random() > 0.5 ? 'buy' : 'sell';
            confidence += 10;
            reasons.push('Случайное направление при высокой волатильности');
        }
        return {
            canEnter: confidence >= 60,
            direction,
            confidence,
            reasons
        };
    }
    /**
     * Адаптивный расчет TP/SL на основе волатильности
     */
    calculateAdaptiveLevels(entryPrice, volatility, direction, baseTPPercent, baseSLPercent, volatilityMultiplier = 1.5) {
        // Адаптируем уровни под волатильность
        const volMultiplier = Math.max(0.5, Math.min(3, volatility.value * volatilityMultiplier));
        const adaptedTPPercent = baseTPPercent * volMultiplier;
        const adaptedSLPercent = baseSLPercent * volMultiplier;
        if (direction === 'buy') {
            const takeProfit = entryPrice * (1 + adaptedTPPercent / 100);
            const stopLoss = entryPrice * (1 - adaptedSLPercent / 100);
            return { takeProfit, stopLoss };
        }
        else {
            const takeProfit = entryPrice * (1 - adaptedTPPercent / 100);
            const stopLoss = entryPrice * (1 + adaptedSLPercent / 100);
            return { takeProfit, stopLoss };
        }
    }
}
exports.TechnicalIndicators = TechnicalIndicators;
//# sourceMappingURL=technical.js.map