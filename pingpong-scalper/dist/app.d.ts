import 'dotenv/config';
export declare class PingPongScalper {
    private restClient;
    private wsClient;
    private engine;
    private statsCalculator;
    private riskManager;
    private config;
    private isRunning;
    constructor();
    private loadConfig;
    private setupEventHandlers;
    start(): Promise<void>;
    stop(): Promise<void>;
    private startPeriodicReporting;
    private printSessionStats;
    private printFinalStats;
}
//# sourceMappingURL=app.d.ts.map