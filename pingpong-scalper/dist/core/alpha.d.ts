import { OrderBookTick, MicroStats, Config } from './types';
export declare class MicroStatsCalculator {
    private priceHistory;
    private logReturns;
    calculateMicroStats(orderBook: OrderBookTick | null, priceHistory: number[], config: Config | null): MicroStats | null;
    private updateLogReturns;
    private calculateVolatility;
    private getTickSize;
    adaptParameters(currentStats: MicroStats, fillsPerMinute: number, consecutiveLosses: number, config: Config): {
        s: number;
        orderNotional: number;
    };
    calculateBookImbalance(orderBook: OrderBookTick): number;
    adjustPricesForImbalance(buyPrice: number, sellPrice: number, imbalance: number, config: Config): {
        buyPrice: number;
        sellPrice: number;
    };
}
//# sourceMappingURL=alpha.d.ts.map