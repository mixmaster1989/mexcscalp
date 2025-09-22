export interface TradingConfig {
    deposit: number;
    targetPairs: string[];
    maxParallelPositions: number;
    positionSizePercent: number;
    minTradeTimeMs: number;
    maxTradeTimeMs: number;
    marketScanIntervalMs: number;
    targetProfitPercent: number;
    minProfitPercent: number;
    maxProfitPercent: number;
    stopLossPercent: number;
    maxLossPerTrade: number;
    dailyLossLimit: number;
    dailyTargetProfit: number;
    minVolatilityThreshold: number;
    volatilityPeriodMs: number;
    emaFastPeriod: number;
    emaSlowPeriod: number;
    minOrderbookDepth: number;
    maxSpreadPercent: number;
    maxGapPercent: number;
    emergencyStopEnabled: boolean;
    adaptiveTpSl: boolean;
    volatilityMultiplier: number;
}
export declare const defaultConfig: TradingConfig;
export interface LoggingConfig {
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    logToFile: boolean;
    logFilePath: string;
    maxLogFiles: number;
    maxLogSize: string;
}
export declare const loggingConfig: LoggingConfig;
export declare function validateConfig(config: TradingConfig): string[];
//# sourceMappingURL=trading.d.ts.map