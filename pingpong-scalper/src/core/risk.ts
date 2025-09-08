import { SessionStats, Config, AccountInfo } from './types';

export class RiskManager {
  private dailyStartBalance = 0;
  private maxDailyDrawdown = 0;
  private apiErrorCount = 0;
  private lastApiErrorTime = 0;
  private killSwitchTriggered = false;

  constructor(private config: Config) {}

  canTrade(sessionStats: SessionStats | null): boolean {
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

  private isDailyDrawdownExceeded(sessionStats: SessionStats): boolean {
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

  private isApiErrorRateTooHigh(): boolean {
    const now = Date.now();
    const timeWindow = 60000; // 1 минута
    
    // Сбрасываем счетчик если прошло больше минуты
    if (now - this.lastApiErrorTime > timeWindow) {
      this.apiErrorCount = 0;
    }
    
    return this.apiErrorCount > 10; // Более 10 ошибок в минуту
  }

  recordApiError(): void {
    this.apiErrorCount++;
    this.lastApiErrorTime = Date.now();
    
    if (this.apiErrorCount > 20) {
      console.log('🚨 Критическое количество API ошибок, активируем kill-switch');
      this.triggerKillSwitch();
    }
  }

  triggerKillSwitch(): void {
    this.killSwitchTriggered = true;
    console.log('🚨 KILL-SWITCH АКТИВИРОВАН!');
  }

  resetKillSwitch(): void {
    this.killSwitchTriggered = false;
    this.apiErrorCount = 0;
    console.log('✅ Kill-switch сброшен');
  }

  updateDailyStats(accountInfo: AccountInfo, initialBalance: number): void {
    if (!accountInfo || !accountInfo.balances) {
      return;
    }

    const currentBalance = this.calculateTotalBalance(accountInfo);
    if (initialBalance > 0 && isFinite(currentBalance) && isFinite(initialBalance)) {
      const drawdown = (initialBalance - currentBalance) / initialBalance * 100;
      this.maxDailyDrawdown = Math.max(this.maxDailyDrawdown, drawdown);
    }
  }

  private calculateTotalBalance(accountInfo: AccountInfo): number {
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

  getMaxDailyDrawdown(): number {
    return this.maxDailyDrawdown;
  }

  isKillSwitchActive(): boolean {
    return this.killSwitchTriggered;
  }

  // Метод для проверки лимитов инвентаря
  canOpenNewPosition(
    accountInfo: AccountInfo,
    currentEthBalance: number,
    ethPrice: number
  ): boolean {
    if (!accountInfo || !isFinite(currentEthBalance) || !isFinite(ethPrice)) {
      return false;
    }

    const totalValue = this.calculateTotalBalance(accountInfo);
    const maxLongValue = totalValue * (this.config.maxLongQtyPercent / 100);
    const currentLongValue = currentEthBalance * ethPrice;
    
    return currentLongValue < maxLongValue;
  }

  // Метод для расчета максимального размера ордера
  calculateMaxOrderSize(
    accountInfo: AccountInfo,
    ethPrice: number
  ): number {
    if (!accountInfo || !isFinite(ethPrice) || ethPrice <= 0) {
      return 0;
    }

    const totalValue = this.calculateTotalBalance(accountInfo);
    const maxOrderValue = totalValue * 0.1; // Максимум 10% от баланса на один ордер
    
    return maxOrderValue / ethPrice;
  }

  // Метод для проверки минимального спреда
  isSpreadAcceptable(spread: number, mid: number): boolean {
    if (!isFinite(spread) || !isFinite(mid) || mid <= 0) {
      return false;
    }

    const spreadPercent = (spread / mid) * 100;
    return spreadPercent >= 0.01; // Минимум 0.01% спред
  }

  // Метод для проверки волатильности
  isVolatilityAcceptable(sigma1s: number): boolean {
    if (!isFinite(sigma1s)) {
      return false;
    }

    return sigma1s >= 0.0001 && sigma1s <= 0.01; // От 0.01% до 1%
  }

  // Метод для проверки ликвидности
  isLiquiditySufficient(bidQty: number, askQty: number, orderSize: number): boolean {
    if (!isFinite(bidQty) || !isFinite(askQty) || !isFinite(orderSize)) {
      return false;
    }

    const minLiquidity = orderSize * 2; // Минимум в 2 раза больше нашего ордера
    return bidQty >= minLiquidity && askQty >= minLiquidity;
  }

  // Метод для расчета позиционного лимита
  calculatePositionLimit(accountInfo: AccountInfo): number {
    if (!accountInfo) {
      return 0;
    }

    const totalValue = this.calculateTotalBalance(accountInfo);
    return totalValue * (this.config.maxLongQtyPercent / 100);
  }

  // Метод для проверки времени торговли (если нужно)
  isTradingTimeAllowed(): boolean {
    // Здесь можно добавить логику для ограничения времени торговли
    // Например, не торговать в выходные или в определенные часы
    return true;
  }

  // Метод для проверки состояния рынка
  isMarketConditionSuitable(
    spread: number,
    mid: number,
    sigma1s: number,
    bidQty: number,
    askQty: number,
    orderSize: number
  ): boolean {
    return (
      this.isSpreadAcceptable(spread, mid) &&
      this.isVolatilityAcceptable(sigma1s) &&
      this.isLiquiditySufficient(bidQty, askQty, orderSize) &&
      this.isTradingTimeAllowed()
    );
  }
}
