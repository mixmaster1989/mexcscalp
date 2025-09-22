import { EventEmitter } from 'events';
import pino from 'pino';
import { MexcRestClient } from '../infra/mexcRest';
import { Config, Instrument, Fill } from '../core/types';
/**
 * Стратегия PingPong: один тикет в рынок, берем спред, не застреваем
 * Правила:
 * - Никогда не открываем SELL, если нет инвентаря (иначе Oversold)
 * - В нейтральном состоянии: ставим только один лимит-maker с минимальным notional
 * - После fill: сразу ставим TP в противоположную сторону на tp_bps, отменяя встречный ордер
 * - Если позиция висит дольше max_position_duration_sec или цена ушла против больше cutLossBps — выходим MARKET
 * - Публикуем только PnL (+/-)
 */
export declare class PingPongStrategy extends EventEmitter {
    private readonly config;
    private readonly instrument;
    private readonly rest;
    private readonly logger;
    private readonly symbol;
    private readonly minSpreadTicks;
    private readonly tpBps;
    private readonly maxHoldMs;
    private readonly cutLossBps;
    private readonly baseOrderUsd;
    private bestBid;
    private bestAsk;
    private activeBuy;
    private activeSell;
    private positionQty;
    private entryPrice;
    private entryTs;
    private baseFree;
    private isRunning;
    constructor(config: Config, instrument: Instrument, rest: MexcRestClient, logger: pino.Logger);
    start(): Promise<void>;
    stop(): Promise<void>;
    private refreshBalances;
    /**
     * Обновление лучших цен
     */
    onBookTicker(bidPrice: number, askPrice: number, bidQty: number, askQty: number): Promise<void>;
    /**
     * Обработка исполнения
     */
    onFill(fill: Fill): Promise<void>;
    private ensureNeutralQuotes;
    private placeTakeProfit;
    private maybeExitPosition;
    private cancelAll;
    private cancel;
    private place;
    private coid;
}
//# sourceMappingURL=pingpong.d.ts.map