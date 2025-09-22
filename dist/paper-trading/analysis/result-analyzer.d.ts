import { PaperTrade } from '../paper-trading';
import { MarketSnapshot } from '../data/market-snapshot';
export interface AnalysisReport {
    summary: {
        totalTrades: number;
        winRate: number;
        profitFactor: number;
        bestPattern: string;
        worstPattern: string;
    };
    correlations: Array<{
        factor: string;
        correlation: number;
        description: string;
    }>;
    patterns: Array<{
        pattern: string;
        winRate: number;
        frequency: number;
    }>;
    recommendations: string[];
}
export declare class ResultAnalyzer {
    private trades;
    private snapshots;
    constructor(trades: PaperTrade[], snapshots: MarketSnapshot[]);
    /**
     * Анализировать результаты торговли
     */
    analyzeTrades(): AnalysisReport;
    /**
     * Найти корреляции между факторами и успехом
     */
    private findCorrelations;
    /**
     * Вычислить корреляцию между фактором и успехом
     */
    private calculateCorrelation;
    /**
     * Найти выигрышные паттерны
     */
    private findWinningPatterns;
    /**
     * Генерировать рекомендации
     */
    private generateRecommendations;
    /**
     * Генерировать сводку
     */
    private generateSummary;
    /**
     * Вычислить винрейт
     */
    private calculateWinRate;
    /**
     * Вычислить profit factor
     */
    private calculateProfitFactor;
    /**
     * Получить описание фактора
     */
    private getFactorDescription;
    /**
     * Генерировать отчет
     */
    generateReport(): AnalysisReport;
}
//# sourceMappingURL=result-analyzer.d.ts.map