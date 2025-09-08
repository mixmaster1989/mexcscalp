"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskManager = void 0;
class RiskManager {
    constructor(config) {
        this.config = config;
        this.dailyStartBalance = 0;
        this.maxDailyDrawdown = 0;
        this.apiErrorCount = 0;
        this.lastApiErrorTime = 0;
        this.killSwitchTriggered = false;
    }
    canTrade(sessionStats) {
        // Проверяем входные параметры
        if (!sessionStats) {
            return false;
        }
        // Проверяем kill-switch
        if (this.killSwitchTriggered) {
            return false;
        }
        // Проверяем дневную просадку - только отрицательные значения
        if (this.isDailyDrawdownExceeded(sessionStats)) {
            console.log('🛑 Дневная просадка превышена, останавливаем торговлю');
            this.triggerKillSwitch();
            return false;
        }
        // Проверяем серию убытков
        if (sessionStats.consecutiveLosses >= this.config.maxConsecutiveLosses) {
            console.log('⚠️ Превышена максимальная серия убытков');
            return false;
        }
        // Проверяем API ошибки
        if (this.isApiErrorRateTooHigh()) {
            console.log('⚠️ Слишком много API ошибок, пауза');
            return false;
        }
        return true;
    }
    isDailyDrawdownExceeded(sessionStats) {
        if (typeof sessionStats.dailyDrawdown !== 'number' || !isFinite(sessionStats.dailyDrawdown)) {
            return false;
        }
        // Только отрицательные значения считаются просадкой
        if (sessionStats.dailyDrawdown >= 0) {
            return false;
        }
        const currentDrawdown = Math.abs(sessionStats.dailyDrawdown);
        return currentDrawdown >= this.config.stopDayPercent;
    }
    isApiErrorRateTooHigh() {
        const now = Date.now();
        const timeWindow = 60000; // 1 минута
        // Сбрасываем счетчик если прошло больше минуты
        if (now - this.lastApiErrorTime > timeWindow) {
            this.apiErrorCount = 0;
        }
        return this.apiErrorCount > 10; // Более 10 ошибок в минуту
    }
    recordApiError() {
        this.apiErrorCount++;
        this.lastApiErrorTime = Date.now();
        if (this.apiErrorCount > 20) {
            console.log('🚨 Критическое количество API ошибок, активируем kill-switch');
            this.triggerKillSwitch();
        }
    }
    triggerKillSwitch() {
        this.killSwitchTriggered = true;
        console.log('🚨 KILL-SWITCH АКТИВИРОВАН!');
    }
    resetKillSwitch() {
        this.killSwitchTriggered = false;
        this.apiErrorCount = 0;
        console.log('✅ Kill-switch сброшен');
    }
    updateDailyStats(accountInfo, initialBalance) {
        if (!accountInfo || !accountInfo.balances) {
            return;
        }
        const currentBalance = this.calculateTotalBalance(accountInfo);
        if (initialBalance > 0 && isFinite(currentBalance) && isFinite(initialBalance)) {
            const drawdown = (initialBalance - currentBalance) / initialBalance * 100;
            this.maxDailyDrawdown = Math.max(this.maxDailyDrawdown, drawdown);
        }
    }
    calculateTotalBalance(accountInfo) {
        if (!accountInfo || !accountInfo.balances) {
            return 0;
        }
        // Упрощенный расчет - только USDC баланс
        const usdcBalance = accountInfo.balances.find(b => b.asset === 'USDC');
        if (!usdcBalance || !usdcBalance.free) {
            return 0;
        }
        const balance = parseFloat(usdcBalance.free);
        return isFinite(balance) ? balance : 0;
    }
    getMaxDailyDrawdown() {
        return this.maxDailyDrawdown;
    }
    isKillSwitchActive() {
        return this.killSwitchTriggered;
    }
    // Метод для проверки лимитов инвентаря
    canOpenNewPosition(accountInfo, currentEthBalance, ethPrice) {
        if (!accountInfo || !isFinite(currentEthBalance) || !isFinite(ethPrice)) {
            return false;
        }
        const totalValue = this.calculateTotalBalance(accountInfo);
        const maxLongValue = totalValue * (this.config.maxLongQtyPercent / 100);
        const currentLongValue = currentEthBalance * ethPrice;
        return currentLongValue < maxLongValue;
    }
    // Метод для расчета максимального размера ордера
    calculateMaxOrderSize(accountInfo, ethPrice) {
        if (!accountInfo || !isFinite(ethPrice) || ethPrice <= 0) {
            return 0;
        }
        const totalValue = this.calculateTotalBalance(accountInfo);
        const maxOrderValue = totalValue * 0.1; // Максимум 10% от баланса на один ордер
        return maxOrderValue / ethPrice;
    }
    // Метод для проверки минимального спреда
    isSpreadAcceptable(spread, mid) {
        if (!isFinite(spread) || !isFinite(mid) || mid <= 0) {
            return false;
        }
        const spreadPercent = (spread / mid) * 100;
        return spreadPercent >= 0.01; // Минимум 0.01% спред
    }
    // Метод для проверки волатильности
    isVolatilityAcceptable(sigma1s) {
        if (!isFinite(sigma1s)) {
            return false;
        }
        return sigma1s >= 0.0001 && sigma1s <= 0.01; // От 0.01% до 1%
    }
    // Метод для проверки ликвидности
    isLiquiditySufficient(bidQty, askQty, orderSize) {
        if (!isFinite(bidQty) || !isFinite(askQty) || !isFinite(orderSize)) {
            return false;
        }
        const minLiquidity = orderSize * 2; // Минимум в 2 раза больше нашего ордера
        return bidQty >= minLiquidity && askQty >= minLiquidity;
    }
    // Метод для расчета позиционного лимита
    calculatePositionLimit(accountInfo) {
        if (!accountInfo) {
            return 0;
        }
        const totalValue = this.calculateTotalBalance(accountInfo);
        return totalValue * (this.config.maxLongQtyPercent / 100);
    }
    // Метод для проверки времени торговли (если нужно)
    isTradingTimeAllowed() {
        // Здесь можно добавить логику для ограничения времени торговли
        // Например, не торговать в выходные или в определенные часы
        return true;
    }
    // Метод для проверки состояния рынка
    isMarketConditionSuitable(spread, mid, sigma1s, bidQty, askQty, orderSize) {
        return (this.isSpreadAcceptable(spread, mid) &&
            this.isVolatilityAcceptable(sigma1s) &&
            this.isLiquiditySufficient(bidQty, askQty, orderSize) &&
            this.isTradingTimeAllowed());
    }
}
exports.RiskManager = RiskManager;
//# sourceMappingURL=risk.js.map