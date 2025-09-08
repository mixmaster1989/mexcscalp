import { MexcRestClient } from '../infra/mexcRest';
/**
 * Интерфейс для истории сделок
 */
export interface TradeHistoryItem {
    tradeId: string;
    symbol: string;
    side: 'buy' | 'sell';
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    pnl: number;
    fee: number;
    timestamp: number;
    strategy?: string;
    orderId: string;
}
/**
 * Статистика по сделкам
 */
export interface TradeStats {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnl: number;
    totalFees: number;
    avgPnl: number;
    winRate: number;
    bestTrade: number;
    worstTrade: number;
    avgDuration: number;
}
/**
 * Класс для работы с историей сделок
 */
export declare class TradeHistoryService {
    private db;
    mexcClient: MexcRestClient;
    constructor(apiKey: string, secretKey: string);
    /**
     * Получить историю сделок за последние 24 часа
     */
    getDailyTradeHistory(): Promise<TradeHistoryItem[]>;
    /**
     * Получить историю сделок за указанный период
     */
    getTradeHistory(startTime: number, endTime: number): Promise<TradeHistoryItem[]>;
    /**
     * Получить статистику по сделкам за сутки
     */
    getDailyTradeStats(): Promise<TradeStats>;
    /**
     * Получить статистику по сделкам за период
     */
    getTradeStats(startTime: number, endTime: number): Promise<TradeStats>;
    /**
     * Рассчитать PnL для пар сделок BUY/SELL
     */
    private calculateTradePairsPnL;
    /**
     * Рассчитать статистику по сделкам
     */
    private calculateTradeStats;
    /**
     * Экспортировать историю сделок в CSV
     */
    exportToCSV(trades: TradeHistoryItem[]): Promise<string>;
    /**
     * Получить топ-5 лучших сделок за сутки
     */
    getTopTrades(limit?: number): Promise<TradeHistoryItem[]>;
    /**
     * Получить худшие сделки за сутки
     */
    getWorstTrades(limit?: number): Promise<TradeHistoryItem[]>;
}
//# sourceMappingURL=tradeHistory.d.ts.map