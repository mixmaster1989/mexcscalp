"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loggingConfig = exports.defaultConfig = void 0;
exports.validateConfig = validateConfig;
exports.defaultConfig = {
    // Основные параметры
    deposit: 100, // USDT
    targetPairs: ['ETH/USDC', 'BTC/USDC'],
    maxParallelPositions: 5,
    positionSizePercent: 8, // 8% от депо на сделку (можем держать 5 позиций = 40% депо)
    // Временные параметры
    minTradeTimeMs: 30 * 1000, // 30 секунд
    maxTradeTimeMs: 3 * 60 * 1000, // 3 минуты
    marketScanIntervalMs: 1000, // Сканировать рынок каждую секунду
    // Прибыль и убытки
    targetProfitPercent: 0.2, // 0.2% целевая прибыль
    minProfitPercent: 0.1, // Минимум 0.1%
    maxProfitPercent: 0.3, // Максимум 0.3%
    stopLossPercent: 0.08, // 0.08% стоп-лосс (меньше минимальной прибыли)
    maxLossPerTrade: 0.2, // Максимум 0.2% депо на убыток
    // Дневные лимиты
    dailyLossLimit: 5, // 5% от депо в день
    dailyTargetProfit: 2, // 2% от депо в день
    // Волатильность
    minVolatilityThreshold: 0.05, // 0.05% минимальная волатильность
    volatilityPeriodMs: 60 * 1000, // 1 минута для расчета волатильности
    // Технические индикаторы
    emaFastPeriod: 5, // Быстрая EMA 5 периодов
    emaSlowPeriod: 15, // Медленная EMA 15 периодов
    // Стакан ордеров
    minOrderbookDepth: 200, // Минимум 200 USDT в стакане
    maxSpreadPercent: 0.1, // Максимум 0.1% спред
    // Риск-менеджмент
    maxGapPercent: 2, // 2% максимальный гэп
    emergencyStopEnabled: true,
    // Адаптивность
    adaptiveTpSl: true,
    volatilityMultiplier: 1.5 // Множитель для адаптации под волатильность
};
exports.loggingConfig = {
    logLevel: 'info',
    logToFile: true,
    logFilePath: './logs/scalper.log',
    maxLogFiles: 5,
    maxLogSize: '10MB'
};
// Валидация конфигурации
function validateConfig(config) {
    const errors = [];
    if (config.deposit <= 0) {
        errors.push('Депозит должен быть положительным');
    }
    if (config.positionSizePercent <= 0 || config.positionSizePercent > 50) {
        errors.push('Размер позиции должен быть от 0% до 50%');
    }
    if (config.maxParallelPositions * config.positionSizePercent > 100) {
        errors.push('Сумма всех позиций не должна превышать 100% депо');
    }
    if (config.stopLossPercent >= config.minProfitPercent) {
        errors.push('Стоп-лосс должен быть меньше минимальной прибыли');
    }
    if (config.dailyLossLimit <= 0 || config.dailyLossLimit > 50) {
        errors.push('Дневной лимит убытка должен быть от 0% до 50%');
    }
    if (config.targetPairs.length === 0) {
        errors.push('Должна быть указана хотя бы одна торговая пара');
    }
    return errors;
}
//# sourceMappingURL=trading.js.map