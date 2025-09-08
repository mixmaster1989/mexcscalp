"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MicroStatsCalculator = void 0;
class MicroStatsCalculator {
    constructor() {
        this.priceHistory = [];
        this.logReturns = [];
    }
    calculateMicroStats(orderBook, priceHistory, config) {
        // Проверяем входные параметры
        if (!orderBook || !config) {
            return null;
        }
        if (!orderBook.bidPrice || !orderBook.askPrice) {
            return null;
        }
        const mid = (orderBook.bidPrice + orderBook.askPrice) / 2;
        const spread = orderBook.askPrice - orderBook.bidPrice;
        // Обновляем историю лог-доходностей
        this.updateLogReturns(priceHistory);
        // Вычисляем 1-сек волатильность
        const sigma1s = this.calculateVolatility();
        // Базовый шаг входа
        const sRaw = mid * config.ksig * sigma1s;
        // Минимальные и максимальные значения
        const sMin = mid * (config.sMinPercent / 100);
        const sMax = mid * (config.sMaxPercent / 100);
        // Клампы и минимумы
        const tickSize = this.getTickSize(mid);
        const minS = Math.max(0.5 * spread + tickSize, sMin);
        const s = Math.max(Math.min(sRaw, sMax), minS);
        // Цель профита и стоп-лосс
        const tp = s * config.tpMultiplier;
        const sl = s * config.slMultiplier;
        return {
            mid,
            spread,
            sigma1s,
            s,
            tp,
            sl,
            timestamp: Date.now()
        };
    }
    updateLogReturns(priceHistory) {
        if (priceHistory.length < 2)
            return;
        // Вычисляем лог-доходности
        for (let i = 1; i < priceHistory.length; i++) {
            const prevPrice = priceHistory[i - 1];
            const currPrice = priceHistory[i];
            // Проверяем на валидность цен
            if (prevPrice > 0 && currPrice > 0 && isFinite(prevPrice) && isFinite(currPrice)) {
                const logReturn = Math.log(currPrice / prevPrice);
                if (isFinite(logReturn)) {
                    this.logReturns.push(logReturn);
                }
            }
        }
        // Ограничиваем историю до 120 значений (для 1-сек вола)
        if (this.logReturns.length > 120) {
            this.logReturns.shift();
        }
    }
    calculateVolatility() {
        if (this.logReturns.length < 2)
            return 0.001; // Дефолтная волатильность
        // Вычисляем стандартное отклонение лог-доходностей
        const mean = this.logReturns.reduce((sum, r) => sum + r, 0) / this.logReturns.length;
        const variance = this.logReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / this.logReturns.length;
        const volatility = Math.sqrt(variance);
        return isFinite(volatility) ? volatility : 0.001;
    }
    getTickSize(price) {
        // Определяем размер тика в зависимости от цены
        if (price >= 1000)
            return 0.01;
        if (price >= 100)
            return 0.001;
        if (price >= 10)
            return 0.0001;
        if (price >= 1)
            return 0.00001;
        return 0.000001;
    }
    // Метод для адаптации параметров на основе производительности
    adaptParameters(currentStats, fillsPerMinute, consecutiveLosses, config) {
        let newS = currentStats.s;
        let newOrderNotional = config.orderNotional;
        // Если мало сделок - уменьшаем s
        if (fillsPerMinute < 10) {
            newS *= 0.8; // Уменьшаем на 20%
        }
        // Если много убыточных сделок подряд - увеличиваем s
        if (consecutiveLosses > 5) {
            newS *= 1.2; // Увеличиваем на 20%
            newOrderNotional *= 0.7; // Уменьшаем размер ордера на 30%
        }
        // Если критически много убытков - более агрессивные изменения
        if (consecutiveLosses > config.maxConsecutiveLosses) {
            newS *= 1.3; // Увеличиваем на 30%
            newOrderNotional *= 0.7; // Уменьшаем размер ордера на 30%
        }
        return { s: newS, orderNotional: newOrderNotional };
    }
    // Метод для расчета book imbalance
    calculateBookImbalance(orderBook) {
        const bidSize = orderBook.bidQty;
        const askSize = orderBook.askQty;
        if (bidSize + askSize === 0)
            return 0.5;
        return bidSize / (bidSize + askSize);
    }
    // Метод для корректировки цен на основе book imbalance
    adjustPricesForImbalance(buyPrice, sellPrice, imbalance, config) {
        const adjustment = 0.1; // 10% корректировка
        if (imbalance > 0.6) {
            // Больше покупателей - смещаем buy ближе, sell дальше
            return {
                buyPrice: buyPrice + (buyPrice * adjustment * 0.1),
                sellPrice: sellPrice + (sellPrice * adjustment * 0.15)
            };
        }
        else if (imbalance < 0.4) {
            // Больше продавцов - смещаем sell ближе, buy дальше
            return {
                buyPrice: buyPrice - (buyPrice * adjustment * 0.15),
                sellPrice: sellPrice - (sellPrice * adjustment * 0.1)
            };
        }
        return { buyPrice, sellPrice };
    }
}
exports.MicroStatsCalculator = MicroStatsCalculator;
//# sourceMappingURL=alpha.js.map