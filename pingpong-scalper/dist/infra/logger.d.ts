export declare class Logger {
    private logger;
    constructor();
    info(message: string, data?: any): void;
    error(message: string, error?: any): void;
    warn(message: string, data?: any): void;
    debug(message: string, data?: any): void;
    trade(message: string, data?: any): void;
    order(message: string, data?: any): void;
    risk(message: string, data?: any): void;
    pnl(message: string, data?: any): void;
    stats(message: string, data?: any): void;
}
export declare const logger: Logger;
//# sourceMappingURL=logger.d.ts.map