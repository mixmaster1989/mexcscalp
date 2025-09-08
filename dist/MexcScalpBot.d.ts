export declare class MexcScalpBot {
    private restClient;
    private telegramBot;
    private logger;
    private isRunning;
    constructor();
    start(): Promise<void>;
    stop(): Promise<void>;
    private setupTelegramHandlers;
    private sendTelegramMessage;
    isBotRunning(): boolean;
}
//# sourceMappingURL=MexcScalpBot.d.ts.map