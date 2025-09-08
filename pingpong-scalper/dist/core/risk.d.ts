import { SessionStats, Config, AccountInfo } from './types';
export declare class RiskManager {
    private config;
    private dailyStartBalance;
    private maxDailyDrawdown;
    private apiErrorCount;
    private lastApiErrorTime;
    private killSwitchTriggered;
    constructor(config: Config);
    canTrade(sessionStats: SessionStats | null): boolean;
    private isDailyDrawdownExceeded;
    private isApiErrorRateTooHigh;
    recordApiError(): void;
    triggerKillSwitch(): void;
    resetKillSwitch(): void;
    updateDailyStats(accountInfo: AccountInfo, initialBalance: number): void;
    private calculateTotalBalance;
    getMaxDailyDrawdown(): number;
    isKillSwitchActive(): boolean;
    canOpenNewPosition(accountInfo: AccountInfo, currentEthBalance: number, ethPrice: number): boolean;
    calculateMaxOrderSize(accountInfo: AccountInfo, ethPrice: number): number;
    isSpreadAcceptable(spread: number, mid: number): boolean;
    isVolatilityAcceptable(sigma1s: number): boolean;
    isLiquiditySufficient(bidQty: number, askQty: number, orderSize: number): boolean;
    calculatePositionLimit(accountInfo: AccountInfo): number;
    isTradingTimeAllowed(): boolean;
    isMarketConditionSuitable(spread: number, mid: number, sigma1s: number, bidQty: number, askQty: number, orderSize: number): boolean;
}
//# sourceMappingURL=risk.d.ts.map