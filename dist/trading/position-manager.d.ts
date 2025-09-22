import { MexcRestClient } from '../infra/mexcRest';
import { PositionInfo, TradeResult } from '../risk/manager';
import { TradingConfig } from '../config/trading';
import { TelegramNotifications } from '../telegram/notifications';
import pino from 'pino';
export interface PositionUpdate {
    position: PositionInfo;
    currentPrice: number;
    unrealizedPnL: number;
    shouldClose: boolean;
    closeReason?: 'take_profit' | 'stop_loss' | 'timeout';
}
/**
 * Менеджер позиций
 */
export declare class PositionManager {
    private positions;
    private mexcClient;
    private config;
    private logger;
    private telegram;
    constructor(mexcClient: MexcRestClient, config: TradingConfig, logger: pino.Logger, telegram?: TelegramNotifications | null);
    /**
     * Открыть новую позицию
     */
    openPosition(symbol: string, side: 'buy' | 'sell', quantity: number, price: number, takeProfit: number, stopLoss: number): Promise<PositionInfo>;
    /**
     * Закрыть позицию
     */
    closePosition(positionId: string, reason: TradeResult['reason']): Promise<TradeResult | null>;
    /**
     * Обновить все позиции текущими ценами
     */
    updatePositions(): Promise<PositionUpdate[]>;
    /**
     * Проверить условия закрытия позиции
     */
    private checkCloseConditions;
    /**
     * Экстренно закрыть все позиции
     */
    closeAllPositions(reason?: TradeResult['reason']): Promise<TradeResult[]>;
    /**
     * Получить все активные позиции
     */
    getActivePositions(): PositionInfo[];
    /**
     * Получить позицию по ID
     */
    getPosition(positionId: string): PositionInfo | undefined;
    /**
     * Получить количество позиций
     */
    getPositionCount(): number;
    /**
     * Получить позиции по символу
     */
    getPositionsBySymbol(symbol: string): PositionInfo[];
    /**
     * Получить общую экспозицию в USDT
     */
    getTotalExposure(): number;
    /**
     * Рассчитать адаптивные уровни TP/SL
     */
    calculateAdaptiveLevels(entryPrice: number, side: 'buy' | 'sell', volatility: number): {
        takeProfit: number;
        stopLoss: number;
    };
    /**
     * Проверить не превышен ли лимит позиций на символ
     */
    canOpenPositionForSymbol(symbol: string): boolean;
    /**
     * Получить статистику по позициям
     */
    getPositionStats(): {
        totalPositions: number;
        buyPositions: number;
        sellPositions: number;
        totalExposure: number;
        avgDuration: number;
        symbolDistribution: Record<string, number>;
    };
}
//# sourceMappingURL=position-manager.d.ts.map