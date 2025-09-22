import { MarketSnapshot } from './data/market-snapshot';
import { LocalMinimumSignal, MarketAnalysis } from '../market-analysis/strategies/local-minimum-strategy';
import { CandleData } from '../market-analysis/indicators/technical-indicators';
export interface PaperTrade {
    id: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    entryPrice: number;
    entryTime: number;
    quantity: number;
    stopLoss: number;
    takeProfit: number;
    marketSnapshot: MarketSnapshot;
    exitPrice?: number;
    exitTime?: number;
    exitReason?: 'STOP_LOSS' | 'TAKE_PROFIT' | 'MANUAL' | 'TIMEOUT';
    pnl?: number;
    pnlPercent?: number;
    duration?: number;
    status: 'OPEN' | 'CLOSED';
}
export interface TradingStats {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalPnL: number;
    averagePnL: number;
    bestTrade: number;
    worstTrade: number;
    averageDuration: number;
    profitFactor: number;
}
export declare class PaperTradingSystem {
    private trades;
    private closedTrades;
    private snapshotLogger;
    private balance;
    private positionSize;
    private maxOpenTrades;
    private tradeTimeout;
    constructor();
    /**
     * Обработать сигнал и создать сделку
     */
    processSignal(signal: LocalMinimumSignal, analysis: MarketAnalysis, currentCandle: CandleData, historicalCandles: CandleData[]): PaperTrade | null;
    /**
     * Обновить открытые сделки с текущими ценами
     */
    updateTrades(currentPrices: Map<string, number>): void;
    /**
     * Закрыть сделку
     */
    private closeTrade;
    /**
     * Получить открытые сделки
     */
    getOpenTrades(): PaperTrade[];
    /**
     * Получить закрытые сделки
     */
    getClosedTrades(): PaperTrade[];
    /**
     * Получить все снимки рынка
     */
    getAllMarketSnapshots(): MarketSnapshot[];
    /**
     * Получить статистику торговли
     */
    getTradingStats(): TradingStats;
    /**
     * Получить баланс
     */
    getBalance(): number;
    /**
     * Сохранить данные
     */
    saveData(): Promise<void>;
    /**
     * Генерировать ID сделки
     */
    private generateTradeId;
}
//# sourceMappingURL=paper-trading.d.ts.map