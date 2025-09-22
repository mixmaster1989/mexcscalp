import { EventEmitter } from 'events';
import pino from 'pino';
import { MexcRestClient } from '../infra/mexcRest';
import { Config, Instrument, Fill } from '../core/types';
export declare class GridStrategy extends EventEmitter {
    private readonly config;
    private readonly instrument;
    private readonly rest;
    private readonly logger;
    private readonly symbol;
    private readonly levelsPerSide;
    private readonly stepTicks;
    private readonly tpBps;
    private readonly baseOrderUsd;
    private bestBid;
    private bestAsk;
    private isRunning;
    private baseFree;
    private activeGrid;
    constructor(config: Config, instrument: Instrument, rest: MexcRestClient, logger: pino.Logger);
    start(): Promise<void>;
    stop(): Promise<void>;
    private refreshBalances;
    onBookTicker(bidPrice: number, askPrice: number): Promise<void>;
    private seedGrid;
    onFill(fill: Fill): Promise<void>;
    private cancelAll;
    private place;
    private coid;
}
//# sourceMappingURL=grid.d.ts.map