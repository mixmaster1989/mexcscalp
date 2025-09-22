import { VolatilityData, EMAData, OrderbookAnalysis } from '../indicators/technical';
import { RiskManager } from '../risk/manager';
import { PositionManager } from '../trading/position-manager';
import { TradingConfig } from '../config/trading';
import { MexcRestClient } from '../infra/mexcRest';
import { MexcWebSocketClient } from '../infra/mexcWs';
import { TelegramNotifications } from '../telegram/notifications';
import pino from 'pino';
export interface MarketData {
    symbol: string;
    price: number;
    volume: number;
    timestamp: number;
    volatility?: VolatilityData;
    ema?: EMAData;
    orderbook?: OrderbookAnalysis;
}
export interface TradingSignal {
    symbol: string;
    action: 'buy' | 'sell' | 'hold';
    confidence: number;
    price: number;
    quantity: number;
    takeProfit?: number;
    stopLoss?: number;
    reasons: string[];
    timestamp: number;
}
/**
 * Скальпинговая торговая стратегия
 */
export declare class ScalpingStrategy {
    private config;
    private mexcRest;
    private mexcWs;
    private indicators;
    private riskManager;
    private positionManager;
    private logger;
    private telegram;
    private marketData;
    private lastPrices;
    private isRunning;
    constructor(config: TradingConfig, mexcRest: MexcRestClient, mexcWs: MexcWebSocketClient, riskManager: RiskManager, positionManager: PositionManager, logger: pino.Logger, telegram?: TelegramNotifications | null);
    /**
     * Запустить стратегию
     */
    start(): Promise<void>;
    /**
     * Остановить стратегию
     */
    stop(): Promise<void>;
    /**
     * Настроить обработчики WebSocket
     */
    private setupWebSocketHandlers;
    /**
     * Обработать обновление лучших цен
     */
    private handleBookTicker;
    /**
     * Обработать сделку
     */
    private handleTrade;
    /**
     * Основной торговый цикл
     */
    private startTradingLoop;
    /**
     * Обновить все позиции
     */
    private updatePositions;
    /**
     * Сканировать рынок на предмет торговых сигналов
     */
    private scanForSignals;
    /**
     * Анализировать символ и генерировать сигнал
     */
    private analyzeSymbol;
    /**
     * Исполнить торговый сигнал
     */
    private executeSignal;
    /**
     * Рассчитать размер позиции
     */
    private calculatePositionSize;
    /**
     * Получить статистику стратегии
     */
    getStrategyStats(): {
        isRunning: boolean;
        marketData: Record<string, MarketData>;
        riskMetrics: any;
        positionStats: any;
        performance: any;
    };
    /**
     * Получить последние торговые сигналы
     */
    getLastSignals(): Promise<TradingSignal[]>;
    /**
     * Принудительно закрыть все позиции
     */
    forceCloseAllPositions(): Promise<void>;
}
//# sourceMappingURL=scalping.d.ts.map