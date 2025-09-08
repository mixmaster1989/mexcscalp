"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegimeDetector = void 0;
const math_1 = require("./math");
const events_1 = require("events");
/**
 * Детектор режимов рынка
 * Анализирует ATR, z-score от VWAP, OBI и TFI для определения режима
 */
class RegimeDetector extends events_1.EventEmitter {
    config;
    atr1m;
    atr5m;
    vwap;
    zscore;
    obi;
    tfi;
    currentRegime = 'normal';
    lastRegimeData = null;
    // Буферы для вычислений
    priceBuffer = [];
    volumeBuffer = [];
    candleBuffer = [];
    constructor(config) {
        super();
        this.config = config;
        // Инициализируем калькуляторы
        this.atr1m = new math_1.ATRCalculator(config.regime.atr_window_1m);
        this.atr5m = new math_1.ATRCalculator(config.regime.atr_window_5m);
        this.vwap = new math_1.VWAPCalculator(config.regime.vwap_window_sec * 1000);
        this.zscore = new math_1.ZScoreCalculator(60); // 60 периодов для z-score
        this.obi = new math_1.OBICalculator();
        this.tfi = new math_1.TFICalculator(config.regime.tfi_window_sec * 1000);
    }
    /**
     * Обновить данные свечи для ATR
     */
    updateCandle(high, low, close, volume) {
        const timestamp = Date.now();
        // Добавляем в буфер свечей
        this.candleBuffer.push({ high, low, close, volume, timestamp });
        // Ограничиваем размер буфера
        if (this.candleBuffer.length > 300) {
            this.candleBuffer.shift();
        }
        // Обновляем ATR
        this.atr1m.addCandle(high, low, close);
        this.atr5m.addCandle(high, low, close);
        // Обновляем VWAP
        this.vwap.addTrade(close, volume);
        // Добавляем цену в буфер для z-score
        this.priceBuffer.push(close);
        if (this.priceBuffer.length > 100) {
            this.priceBuffer.shift();
        }
        // Пересчитываем режим
        this.detectRegime();
    }
    /**
     * Обновить данные сделки для TFI
     */
    updateTrade(price, quantity, isBuyerMaker) {
        const side = isBuyerMaker ? 'sell' : 'buy';
        this.tfi.addTrade(side, quantity);
        // Пересчитываем режим
        this.detectRegime();
    }
    /**
     * Обновить данные стакана для OBI
     */
    updateOrderbook(bids, asks) {
        // Пересчитываем режим
        this.detectRegime();
    }
    /**
     * Определить текущий режим рынка
     */
    detectRegime() {
        const indicators = this.calculateIndicators();
        if (!indicators) {
            return; // Недостаточно данных
        }
        const regime = this.classifyRegime(indicators);
        const confidence = this.calculateConfidence(indicators, regime);
        const regimeData = {
            regime,
            confidence,
            indicators,
            timestamp: Date.now()
        };
        // Проверяем изменение режима
        if (this.currentRegime !== regime) {
            const previousRegime = this.currentRegime;
            this.currentRegime = regime;
            this.emit('regimeChange', {
                previous: previousRegime,
                current: regime,
                data: regimeData
            });
        }
        this.lastRegimeData = regimeData;
        this.emit('regimeUpdate', regimeData);
    }
    /**
     * Вычислить все индикаторы
     */
    calculateIndicators() {
        if (this.candleBuffer.length < 10 || this.priceBuffer.length < 10) {
            return null;
        }
        // Получаем ATR данные
        const atr1mData = this.atr1m.addCandle(this.candleBuffer[this.candleBuffer.length - 1].high, this.candleBuffer[this.candleBuffer.length - 1].low, this.candleBuffer[this.candleBuffer.length - 1].close);
        const atr5mData = this.atr5m.addCandle(this.candleBuffer[this.candleBuffer.length - 1].high, this.candleBuffer[this.candleBuffer.length - 1].low, this.candleBuffer[this.candleBuffer.length - 1].close);
        if (!atr1mData || !atr5mData) {
            return null;
        }
        // Получаем VWAP
        const vwapData = this.vwap.addTrade(this.candleBuffer[this.candleBuffer.length - 1].close, this.candleBuffer[this.candleBuffer.length - 1].volume);
        // Вычисляем z-score относительно VWAP
        const currentPrice = this.priceBuffer[this.priceBuffer.length - 1];
        const zScore = this.zscore.addValue(currentPrice, vwapData.value);
        // Получаем последние данные OBI и TFI (если есть)
        // Для простоты используем нулевые значения, если данных нет
        let obi = 0.5;
        let tfi = 0.5;
        // В реальной реализации здесь должны быть актуальные данные из стакана и сделок
        return {
            atr1m: atr1mData.value,
            atr5m: atr5mData.value,
            zScore,
            obi,
            tfi
        };
    }
    /**
     * Классифицировать режим на основе индикаторов
     */
    classifyRegime(indicators) {
        const { atr1m, atr5m, zScore, obi, tfi } = indicators;
        // Нормализуем ATR относительно цены
        const avgPrice = this.priceBuffer.reduce((sum, p) => sum + p, 0) / this.priceBuffer.length;
        const atr1mPct = (atr1m / avgPrice) * 100;
        const atr5mPct = (atr5m / avgPrice) * 100;
        // Определяем режим по правилам
        // Shock режим: высокая волатильность или экстремальный z-score
        if (Math.abs(zScore) > this.config.regime.z_max ||
            atr1mPct > 0.5 || // Высокая волатильность
            atr5mPct > 1.0) {
            return 'shock';
        }
        // Quiet режим: низкая волатильность и нормальный z-score
        if (atr1mPct < 0.1 &&
            atr5mPct < 0.2 &&
            Math.abs(zScore) < 1.0 &&
            Math.abs(obi - 0.5) < 0.1 && // Сбалансированный стакан
            Math.abs(tfi - 0.5) < 0.1) { // Сбалансированный поток сделок
            return 'quiet';
        }
        // Normal режим: все остальные случаи
        return 'normal';
    }
    /**
     * Вычислить уверенность в классификации
     */
    calculateConfidence(indicators, regime) {
        const { atr1m, atr5m, zScore, obi, tfi } = indicators;
        // Нормализуем ATR
        const avgPrice = this.priceBuffer.reduce((sum, p) => sum + p, 0) / this.priceBuffer.length;
        const atr1mPct = (atr1m / avgPrice) * 100;
        const atr5mPct = (atr5m / avgPrice) * 100;
        let confidence = 0.5; // Базовая уверенность
        switch (regime) {
            case 'shock':
                // Чем выше волатильность или z-score, тем выше уверенность
                confidence = Math.min(0.95, 0.5 + Math.max(Math.abs(zScore) / this.config.regime.z_max * 0.4, atr1mPct / 0.5 * 0.4, atr5mPct / 1.0 * 0.4));
                break;
            case 'quiet':
                // Чем ниже волатильность, тем выше уверенность
                confidence = Math.min(0.95, 0.5 + ((0.1 - Math.min(0.1, atr1mPct)) / 0.1 * 0.2 +
                    (0.2 - Math.min(0.2, atr5mPct)) / 0.2 * 0.2 +
                    (1.0 - Math.min(1.0, Math.abs(zScore))) / 1.0 * 0.1));
                break;
            case 'normal':
                // Средняя уверенность для нормального режима
                confidence = 0.7;
                break;
        }
        return Math.max(0.1, Math.min(0.95, confidence));
    }
    /**
     * Получить текущий режим
     */
    getCurrentRegime() {
        return this.currentRegime;
    }
    /**
     * Получить последние данные режима
     */
    getLastRegimeData() {
        return this.lastRegimeData;
    }
    /**
     * Проверить, стабилен ли текущий режим
     */
    isRegimeStable(minDurationMs = 30000) {
        if (!this.lastRegimeData) {
            return false;
        }
        return Date.now() - this.lastRegimeData.timestamp >= minDurationMs;
    }
    /**
     * Получить рекомендации по параметрам для текущего режима
     */
    getRegimeParameters() {
        const regime = this.currentRegime;
        const hedgehogConfig = this.config.hedgehog;
        const hybridConfig = this.config.hybrid;
        switch (regime) {
            case 'quiet':
                return {
                    tpBps: hedgehogConfig.tp_bps.quiet,
                    offsetMultiplier: 0.8, // Уменьшаем оффсет
                    stepMultiplier: 0.8, // Уменьшаем шаг
                    maxLevels: Math.max(2, hedgehogConfig.levels - 1),
                    enableLadder: true
                };
            case 'shock':
                return {
                    tpBps: hedgehogConfig.tp_bps.shock,
                    offsetMultiplier: 1.5, // Увеличиваем оффсет
                    stepMultiplier: 1.5, // Увеличиваем шаг
                    maxLevels: Math.min(hedgehogConfig.levels, 3),
                    enableLadder: !hybridConfig.enable_in_shock
                };
            case 'normal':
            default:
                return {
                    tpBps: hedgehogConfig.tp_bps.normal,
                    offsetMultiplier: 1.0,
                    stepMultiplier: 1.0,
                    maxLevels: hedgehogConfig.levels,
                    enableLadder: true
                };
        }
    }
    /**
     * Сбросить состояние детектора
     */
    reset() {
        this.currentRegime = 'normal';
        this.lastRegimeData = null;
        this.priceBuffer = [];
        this.volumeBuffer = [];
        this.candleBuffer = [];
        // Пересоздаем калькуляторы
        this.atr1m = new math_1.ATRCalculator(this.config.regime.atr_window_1m);
        this.atr5m = new math_1.ATRCalculator(this.config.regime.atr_window_5m);
        this.vwap = new math_1.VWAPCalculator(this.config.regime.vwap_window_sec * 1000);
        this.zscore = new math_1.ZScoreCalculator(60);
        this.tfi = new math_1.TFICalculator(this.config.regime.tfi_window_sec * 1000);
    }
}
exports.RegimeDetector = RegimeDetector;
//# sourceMappingURL=regime.js.map