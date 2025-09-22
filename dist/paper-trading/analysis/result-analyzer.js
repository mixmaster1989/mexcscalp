"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResultAnalyzer = void 0;
class ResultAnalyzer {
    trades;
    snapshots;
    constructor(trades, snapshots) {
        this.trades = trades;
        this.snapshots = snapshots;
    }
    /**
     * Анализировать результаты торговли
     */
    analyzeTrades() {
        const correlations = this.findCorrelations();
        const patterns = this.findWinningPatterns();
        const recommendations = this.generateRecommendations(correlations, patterns);
        return {
            summary: this.generateSummary(),
            correlations,
            patterns,
            recommendations
        };
    }
    /**
     * Найти корреляции между факторами и успехом
     */
    findCorrelations() {
        const factors = [
            { name: 'rsi', getter: (s) => s.indicators.rsi },
            { name: 'macd_histogram', getter: (s) => s.indicators.macd.histogram },
            { name: 'bollinger_position', getter: (s) => s.indicators.bollinger.position },
            { name: 'volume_ratio', getter: (s) => s.volumeAnalysis.ratio },
            { name: 'trend_strength', getter: (s) => s.trend.strength },
            { name: 'is_local_minimum', getter: (s) => s.trend.isLocalMinimum ? 1 : 0 },
            { name: 'distance_to_support', getter: (s) => s.levels.distanceToSupport || 0 },
            { name: 'distance_to_resistance', getter: (s) => s.levels.distanceToResistance || 0 }
        ];
        const correlations = factors.map(factor => {
            const correlation = this.calculateCorrelation(factor.name, factor.getter);
            return {
                factor: factor.name,
                correlation,
                description: this.getFactorDescription(factor.name)
            };
        });
        return correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
    }
    /**
     * Вычислить корреляцию между фактором и успехом
     */
    calculateCorrelation(factorName, getter) {
        const factorValues = [];
        const successValues = [];
        this.trades.forEach(trade => {
            const snapshot = this.snapshots.find(s => s.symbol === trade.symbol && Math.abs(s.timestamp - trade.entryTime) < 60000);
            if (snapshot) {
                factorValues.push(getter(snapshot));
                successValues.push(trade.pnl || 0);
            }
        });
        if (factorValues.length === 0)
            return 0;
        const meanFactor = factorValues.reduce((a, b) => a + b, 0) / factorValues.length;
        const meanSuccess = successValues.reduce((a, b) => a + b, 0) / successValues.length;
        let numerator = 0;
        let sumSquaredFactor = 0;
        let sumSquaredSuccess = 0;
        for (let i = 0; i < factorValues.length; i++) {
            const factorDiff = factorValues[i] - meanFactor;
            const successDiff = successValues[i] - meanSuccess;
            numerator += factorDiff * successDiff;
            sumSquaredFactor += factorDiff * factorDiff;
            sumSquaredSuccess += successDiff * successDiff;
        }
        const denominator = Math.sqrt(sumSquaredFactor * sumSquaredSuccess);
        return denominator === 0 ? 0 : numerator / denominator;
    }
    /**
     * Найти выигрышные паттерны
     */
    findWinningPatterns() {
        const patterns = [
            {
                name: 'Локальный минимум + RSI перепродан',
                condition: (s) => s.trend.isLocalMinimum && s.indicators.rsi < 40
            },
            {
                name: 'Локальный минимум + Bollinger нижняя граница',
                condition: (s) => s.trend.isLocalMinimum && s.indicators.bollinger.position < 25
            },
            {
                name: 'Локальный минимум + MACD готов к развороту',
                condition: (s) => s.trend.isLocalMinimum && s.indicators.macd.histogram > 0
            },
            {
                name: 'Локальный минимум + растущие объемы',
                condition: (s) => s.trend.isLocalMinimum && s.volumeAnalysis.isIncreasing
            },
            {
                name: 'Локальный минимум + у поддержки',
                condition: (s) => s.trend.isLocalMinimum && s.levels.distanceToSupport !== null && s.levels.distanceToSupport < 1
            },
            {
                name: 'RSI перепродан + Bollinger нижняя граница',
                condition: (s) => s.indicators.rsi < 40 && s.indicators.bollinger.position < 25
            },
            {
                name: 'Восходящий тренд + локальный минимум',
                condition: (s) => s.trend.direction === 'UP' && s.trend.isLocalMinimum
            }
        ];
        const patternResults = patterns.map(pattern => {
            const matchingTrades = this.trades.filter(trade => {
                const snapshot = this.snapshots.find(s => s.symbol === trade.symbol && Math.abs(s.timestamp - trade.entryTime) < 60000);
                return snapshot && pattern.condition(snapshot);
            });
            const winningTrades = matchingTrades.filter(trade => (trade.pnl || 0) > 0);
            const winRate = matchingTrades.length > 0 ? (winningTrades.length / matchingTrades.length) * 100 : 0;
            return {
                pattern: pattern.name,
                winRate,
                frequency: matchingTrades.length
            };
        });
        return patternResults
            .filter(p => p.frequency > 0)
            .sort((a, b) => b.winRate - a.winRate);
    }
    /**
     * Генерировать рекомендации
     */
    generateRecommendations(correlations, patterns) {
        const recommendations = [];
        // Рекомендации на основе корреляций
        const strongPositiveCorr = correlations.filter(c => c.correlation > 0.3);
        const strongNegativeCorr = correlations.filter(c => c.correlation < -0.3);
        if (strongPositiveCorr.length > 0) {
            recommendations.push(`Увеличить вес факторов: ${strongPositiveCorr.map(c => c.factor).join(', ')}`);
        }
        if (strongNegativeCorr.length > 0) {
            recommendations.push(`Избегать факторов: ${strongNegativeCorr.map(c => c.factor).join(', ')}`);
        }
        // Рекомендации на основе паттернов
        const bestPatterns = patterns.filter(p => p.winRate > 70 && p.frequency > 2);
        if (bestPatterns.length > 0) {
            recommendations.push(`Фокусироваться на паттернах: ${bestPatterns.map(p => p.pattern).join(', ')}`);
        }
        const worstPatterns = patterns.filter(p => p.winRate < 30 && p.frequency > 2);
        if (worstPatterns.length > 0) {
            recommendations.push(`Избегать паттернов: ${worstPatterns.map(p => p.pattern).join(', ')}`);
        }
        // Общие рекомендации
        const totalTrades = this.trades.length;
        const winRate = this.calculateWinRate();
        if (winRate < 50) {
            recommendations.push('Рассмотреть более строгие критерии входа');
        }
        if (totalTrades < 10) {
            recommendations.push('Недостаточно данных для анализа. Продолжить сбор данных');
        }
        return recommendations;
    }
    /**
     * Генерировать сводку
     */
    generateSummary() {
        const totalTrades = this.trades.length;
        const winRate = this.calculateWinRate();
        const profitFactor = this.calculateProfitFactor();
        const bestPattern = this.findWinningPatterns()[0]?.pattern || 'Не определен';
        const worstPattern = this.findWinningPatterns().slice(-1)[0]?.pattern || 'Не определен';
        return {
            totalTrades,
            winRate,
            profitFactor,
            bestPattern,
            worstPattern
        };
    }
    /**
     * Вычислить винрейт
     */
    calculateWinRate() {
        if (this.trades.length === 0)
            return 0;
        const winningTrades = this.trades.filter(trade => (trade.pnl || 0) > 0);
        return (winningTrades.length / this.trades.length) * 100;
    }
    /**
     * Вычислить profit factor
     */
    calculateProfitFactor() {
        const grossProfit = this.trades
            .filter(trade => (trade.pnl || 0) > 0)
            .reduce((sum, trade) => sum + (trade.pnl || 0), 0);
        const grossLoss = Math.abs(this.trades
            .filter(trade => (trade.pnl || 0) < 0)
            .reduce((sum, trade) => sum + (trade.pnl || 0), 0));
        return grossLoss === 0 ? 0 : grossProfit / grossLoss;
    }
    /**
     * Получить описание фактора
     */
    getFactorDescription(factorName) {
        const descriptions = {
            'rsi': 'RSI индикатор',
            'macd_histogram': 'MACD гистограмма',
            'bollinger_position': 'Позиция в полосах Боллинджера',
            'volume_ratio': 'Соотношение объемов',
            'trend_strength': 'Сила тренда',
            'is_local_minimum': 'Локальный минимум',
            'distance_to_support': 'Расстояние до поддержки',
            'distance_to_resistance': 'Расстояние до сопротивления'
        };
        return descriptions[factorName] || factorName;
    }
    /**
     * Генерировать отчет
     */
    generateReport() {
        return this.analyzeTrades();
    }
}
exports.ResultAnalyzer = ResultAnalyzer;
//# sourceMappingURL=result-analyzer.js.map