import 'dotenv/config';
export interface GridConfig {
    symbol: string;
    stepUsd: number;
    levelsEachSide: number;
    targetNotional: number;
    recenterSec: number;
}
export declare class GridEngine {
    private client;
    private notifier;
    private baseUrl;
    private cfg;
    private running;
    private state;
    constructor(cfg: GridConfig);
    private book;
    private placeGridOnce;
    private sendSummaryIfDue;
    start(): Promise<void>;
    stop(): void;
}
//# sourceMappingURL=grid-engine.d.ts.map