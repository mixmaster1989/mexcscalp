export interface TradeAnalysis {
    action: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    reasoning: string;
    patterns: string[];
    marketConditions: string[];
    recommendation: string;
}
export interface MarketSummary {
    timestamp: number;
    symbols: Array<{
        symbol: string;
        price: number;
        trend: 'UP' | 'DOWN' | 'SIDEWAYS';
        trendStrength: number;
        rsi: number;
        isLocalMinimum: boolean;
        bollingerPosition: number;
        volumeRatio: number;
        support: number | null;
        resistance: number | null;
    }>;
    totalTrades: number;
    openTrades: number;
    balance: number;
    winRate: number;
}
export interface MarketSituationAnalysis {
    marketOverview: string;
    tradingOpportunities: string[];
    riskAssessment: string;
    recommendations: string[];
}
export declare class LLMAnalyzer {
    private apiKey;
    private baseUrl;
    private maxRetries;
    private retryDelay;
    constructor(apiKey: string);
    analyzeTrade(trade: any, marketSnapshot: any, signal: any): Promise<TradeAnalysis>;
    analyzeResults(trades: any[], snapshots: any[], summary: any): Promise<MarketSituationAnalysis>;
    analyzeMarketSituation(marketSummary: MarketSummary): Promise<MarketSituationAnalysis>;
    private callLLMWithRetry;
    private buildTradeAnalysisPrompt;
    private buildResultsAnalysisPrompt;
    private buildMarketSituationPrompt;
    private callLLM;
    private parseTradeAnalysis;
    private parseResultsAnalysis;
    private parseMarketSituationAnalysis;
    private extractJSON;
    private getDefaultTradeAnalysis;
    private getDefaultResultsAnalysis;
    private getDefaultMarketSituationAnalysis;
    private sleep;
}
//# sourceMappingURL=llm-analyzer.d.ts.map